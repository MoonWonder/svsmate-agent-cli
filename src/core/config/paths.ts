import * as os from 'os';
import * as path from 'path';
import { ensureDir } from '../../utils/pathUtils';

/**
 * CLI 运行路径布局。
 */
export class AppPaths {
  readonly rootDir: string;
  readonly vaultDir: string;
  readonly cacheDir: string;
  readonly configDir: string;
  readonly calendarDir: string;
  readonly cookiesFile: string;
  readonly secretsFile: string;
  readonly calendarFile: string;

  constructor(rootDir?: string) {
    this.rootDir = resolveRootDir(rootDir);
    this.vaultDir = path.join(this.rootDir, 'bb-vault');
    this.cacheDir = path.join(this.rootDir, '.cache');
    this.configDir = path.join(this.rootDir, 'config');
    this.calendarDir = path.join(this.rootDir, 'calendar');
    this.cookiesFile = path.join(this.cacheDir, 'cookies.json');
    this.secretsFile = path.join(this.configDir, 'secrets.json');
    this.calendarFile = path.join(this.calendarDir, 'events.json');

    ensureDir(this.rootDir);
    ensureDir(this.vaultDir);
    ensureDir(this.cacheDir);
    ensureDir(this.configDir);
    ensureDir(this.calendarDir);
  }
}

function resolveRootDir(rootDir?: string): string {
  if (!rootDir || rootDir.trim() === '') {
    return path.join(os.homedir(), '.svsmate-agent');
  }

  if (rootDir.startsWith('~')) {
    return path.join(os.homedir(), rootDir.slice(1));
  }

  return path.resolve(rootDir);
}
