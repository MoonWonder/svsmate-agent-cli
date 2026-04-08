import * as fs from 'fs';
import * as path from 'path';
import { CookieJar } from 'tough-cookie';

/**
 * 将 CookieJar 持久化到本地文件。
 */
export class CookieStore {
  private readonly jar: CookieJar;

  constructor(private readonly filePath: string) {
    this.jar = this.load();
  }

  get cookieJar(): CookieJar {
    return this.jar;
  }

  save(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const json = this.jar.serializeSync();
    fs.writeFileSync(this.filePath, JSON.stringify(json, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
  }

  clear(): void {
    this.jar.removeAllCookiesSync();
    this.save();
  }

  private load(): CookieJar {
    try {
      if (fs.existsSync(this.filePath)) {
        const raw = fs.readFileSync(this.filePath, 'utf8');
        return CookieJar.deserializeSync(JSON.parse(raw));
      }
    } catch {
      return new CookieJar();
    }

    return new CookieJar();
  }
}
