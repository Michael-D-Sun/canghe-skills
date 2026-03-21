import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const execAsync = promisify(exec);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * 将 mermaid 代码渲染为 PNG 图片的 data URL
 * @param mermaidCode mermaid 图表源码
 * @param index 图表索引，用于生成唯一的临时文件名
 * @returns PNG 图片的 data URL (data:image/png;base64,...)
 */
export async function renderMermaidToPng(mermaidCode: string, index: number): Promise<string> {
  const tempDir = path.join(__dirname, '../../.mermaid-temp');
  const inputPath = path.join(tempDir, `diagram-${index}.mmd`);
  const outputPath = path.join(tempDir, `diagram-${index}.png`);

  // 创建临时目录
  await fs.promises.mkdir(tempDir, { recursive: true });

  // 写入 mermaid 源码
  await fs.promises.writeFile(inputPath, mermaidCode, 'utf-8');

  try {
    // 调用 mmdc 渲染，使用透明背景
    await execAsync(`mmdc -i "${inputPath}" -o "${outputPath}" -b transparent`);

    // 读取 PNG 并转为 base64
    const pngBuffer = await fs.promises.readFile(outputPath);
    const base64 = pngBuffer.toString('base64');

    return `data:image/png;base64,${base64}`;
  }
  catch (error) {
    console.error(`Failed to render mermaid diagram ${index}:`, error);
    // 渲染失败时返回错误占位图
    throw new Error(`Mermaid render failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  finally {
    // 清理临时文件
    try {
      await fs.promises.unlink(inputPath);
      await fs.promises.unlink(outputPath);
    }
    catch {
      // 忽略清理错误
    }
  }
}

/**
 * 批量渲染 mermaid 图表为 PNG
 * @param diagrams mermaid 图表数组 [{ code, id }]
 * @returns 渲染后的图表 Map<id, pngDataUrl>
 */
export async function renderMermaidDiagrams(
  diagrams: Array<{ code: string; id: string }>
): Promise<Map<string, string>> {
  const results = new Map<string, string>();

  for (let i = 0; i < diagrams.length; i++) {
    const diagram = diagrams[i];
    try {
      const pngDataUrl = await renderMermaidToPng(diagram.code, i);
      results.set(diagram.id, pngDataUrl);
    }
    catch (error) {
      console.error(`Failed to render diagram ${diagram.id}:`, error);
      // 渲染失败的图表跳过，保持原样或显示错误
    }
  }

  return results;
}
