import { createWriteStream } from 'fs';
import { dirname } from 'path';
import { pipeline } from 'stream/promises';
import pLimit from 'p-limit';
import { BBFetch } from '../http/BBFetch';
import { ensureDir } from '../../utils/pathUtils';

export interface DownloadItem {
  url: string;
  path: string;
}

/**
 * 文件下载服务。
 */
export class DownloadService {
  constructor(
    private readonly fetch: BBFetch,
    private readonly concurrency = 4,
  ) {}

  async download(url: string, savePath: string): Promise<boolean> {
    ensureDir(dirname(savePath));

    const res = await this.fetch.get(url, { redirect: 'follow' });
    if (!res.ok || !res.body) {
      return false;
    }

    const fileStream = createWriteStream(savePath);
    await pipeline(res.body as any, fileStream);
    return true;
  }

  async downloadAll(items: DownloadItem[]): Promise<DownloadItem[]> {
    const failed: DownloadItem[] = [];
    const limit = pLimit(this.concurrency);

    await Promise.all(
      items.map((item) =>
        limit(async () => {
          const ok = await this.download(item.url, item.path);
          if (!ok) {
            failed.push(item);
          }
        }),
      ),
    );

    return failed;
  }
}
