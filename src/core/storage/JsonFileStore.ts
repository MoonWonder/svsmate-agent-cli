import * as fs from 'fs';
import * as path from 'path';
import { ensureDir, ensureJsonFile } from '../../utils/pathUtils';

/**
 * 通用 JSON 文件存储。
 */
export class JsonFileStore<T> {
  constructor(
    private readonly filePath: string,
    private readonly defaultValue: T,
  ) {
    ensureJsonFile(this.filePath, this.defaultValue);
  }

  read(): T {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8');
      return JSON.parse(raw) as T;
    } catch {
      return this.defaultValue;
    }
  }

  write(value: T): void {
    ensureDir(path.dirname(this.filePath));
    fs.writeFileSync(this.filePath, JSON.stringify(value, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  }
}
