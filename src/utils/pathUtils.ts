import * as fs from 'fs';
import * as path from 'path';

/**
 * 将任意名称转换为可安全落盘的文件名。
 */
export function safeName(name: string): string {
  let sanitized = name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_');

  const reservedWords = [
    'CON',
    'PRN',
    'AUX',
    'NUL',
    'COM1',
    'COM2',
    'COM3',
    'COM4',
    'COM5',
    'COM6',
    'COM7',
    'COM8',
    'COM9',
    'LPT1',
    'LPT2',
    'LPT3',
    'LPT4',
    'LPT5',
    'LPT6',
    'LPT7',
    'LPT8',
    'LPT9',
  ];

  if (reservedWords.includes(sanitized.toUpperCase())) {
    sanitized = `_${sanitized}`;
  }

  sanitized = sanitized.replace(/^[ .]+|[ .]+$/g, '');
  return sanitized ? sanitized.slice(0, 255) : '_';
}

/**
 * 确保目录存在并返回绝对路径。
 */
export function ensureDir(dirPath: string): string {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
  return dirPath;
}

/**
 * 在父目录下创建一个安全名称的子目录。
 */
export function ensureSafeDir(basePath: string, name?: string): string {
  const dirPath = name ? path.join(basePath, safeName(name)) : basePath;
  return ensureDir(dirPath);
}

/**
 * 仅当文件不存在时写入默认内容。
 */
export function ensureJsonFile(filePath: string, defaultContent: unknown): void {
  if (fs.existsSync(filePath)) {
    return;
  }

  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, JSON.stringify(defaultContent, null, 2), 'utf8');
}
