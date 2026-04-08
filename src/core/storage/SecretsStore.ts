import { JsonFileStore } from './JsonFileStore';

export interface SecretsData {
  username?: string;
  password?: string;
  calendarUrl?: string;
}

/**
 * 本地敏感信息存储。
 *
 * 这里采用文件形式持久化，优先服务自动化场景。
 */
export class SecretsStore {
  private readonly store: JsonFileStore<SecretsData>;

  constructor(filePath: string) {
    this.store = new JsonFileStore<SecretsData>(filePath, {});
  }

  read(): SecretsData {
    return this.store.read();
  }

  write(next: SecretsData): void {
    this.store.write(next);
  }

  merge(patch: Partial<SecretsData>): SecretsData {
    const current = this.read();
    const merged = { ...current, ...patch };
    this.write(merged);
    return merged;
  }

  clear(): void {
    this.write({});
  }
}
