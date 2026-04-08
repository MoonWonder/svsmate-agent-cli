import * as path from 'path';
import { writeFile } from 'fs/promises';
import { Course, PageContent } from '../models/CourseModels';
import { CourseService } from '../services/CourseService';
import { DownloadItem, DownloadService } from '../services/DownloadService';
import { ensureSafeDir, safeName } from '../../utils/pathUtils';
import { downloadFailedError, invalidResponseError } from '../errors';

export interface SyncCourseOptions {
  metadataOnly?: boolean;
  onProgress?: (event: { stage: string; message: string; data?: unknown }) => void;
}

export interface CourseSyncResult {
  courseName: string;
  courseUrl: string;
  outputDir: string;
  pageCount: number;
  sectionCount: number;
  fileCount: number;
  downloadedCount: number;
  failedDownloads: Array<{ url: string; path: string }>;
}

/**
 * 将远端课程同步到本地目录。
 */
export class CourseSyncService {
  constructor(
    private readonly courseService: CourseService,
    private readonly downloadService: DownloadService,
  ) {}

  async syncCourse(
    course: Course,
    termDir: string,
    options: SyncCourseOptions = {},
  ): Promise<CourseSyncResult> {
    options.onProgress?.({
      stage: 'fetch_sidebar',
      message: '正在抓取课程侧边栏',
      data: { courseName: course.name, courseUrl: course.url },
    });

    const sidebar = await this.courseService.getSidebar(course.url);
    if (!Object.keys(sidebar).length) {
      throw invalidResponseError(`课程「${course.name}」未解析到侧边栏`, {
        courseName: course.name,
        courseUrl: course.url,
      });
    }

    const courseDir = ensureSafeDir(termDir, course.name);
    await writeFile(
      path.join(courseDir, 'course.json'),
      JSON.stringify({ course, sidebar }, null, 2),
      'utf8',
    );

    let pageCount = 0;
    let sectionCount = 0;
    let fileCount = 0;
    let downloadedCount = 0;
    const failedDownloads: DownloadItem[] = [];

    for (const [category, links] of Object.entries(sidebar)) {
      const categoryDir = ensureSafeDir(courseDir, category);
      options.onProgress?.({
        stage: 'sync_category',
        message: '正在同步分类',
        data: { courseName: course.name, category, pageCount: links.length },
      });

      for (const link of links) {
        if (link.title === '--Get Help' || link.title === '在线帮助') {
          continue;
        }

        options.onProgress?.({
          stage: 'sync_page',
          message: '正在同步页面',
          data: { courseName: course.name, category, pageTitle: link.title, pageUrl: link.url },
        });

        const page = await this.courseService.getPage(link.url);
        if (!Object.keys(page).length) {
          continue;
        }

        pageCount += 1;
        sectionCount += Object.keys(page).length;
        fileCount += countFiles(page);

        const pageDir = ensureSafeDir(categoryDir, link.title);
        await writeFile(
          path.join(pageDir, 'index.json'),
          JSON.stringify(
            {
              course: {
                name: course.name,
                url: course.url,
              },
              category,
              title: link.title,
              url: link.url,
              sections: page,
            },
            null,
            2,
          ),
          'utf8',
        );

        if (options.metadataOnly) {
          continue;
        }

        const queue = buildDownloadQueue(pageDir, page);
        options.onProgress?.({
          stage: 'download_files',
          message: '正在下载页面附件',
          data: { courseName: course.name, category, pageTitle: link.title, fileCount: queue.length },
        });
        const failed = await this.downloadService.downloadAll(queue);
        failedDownloads.push(...failed);
        downloadedCount += queue.length - failed.length;
      }
    }

    if (failedDownloads.length > 0 && downloadedCount === 0 && fileCount > 0) {
      throw downloadFailedError(`课程「${course.name}」的文件下载全部失败`, {
        courseName: course.name,
        fileCount,
        failedDownloads,
      });
    }

    return {
      courseName: course.name,
      courseUrl: course.url,
      outputDir: courseDir,
      pageCount,
      sectionCount,
      fileCount,
      downloadedCount,
      failedDownloads,
    };
  }
}

function buildDownloadQueue(pageDir: string, page: PageContent): DownloadItem[] {
  const queue: DownloadItem[] = [];

  for (const [section, content] of Object.entries(page)) {
    const sectionDir = ensureSafeDir(path.join(pageDir, 'files'), section);
    for (const file of content.files) {
      queue.push({
        url: file.url,
        path: path.join(sectionDir, safeName(file.name)),
      });
    }
  }

  return queue;
}

function countFiles(page: PageContent): number {
  return Object.values(page).reduce((sum, section) => sum + section.files.length, 0);
}
