#!/usr/bin/env node

import * as path from 'path';
import { parseArgs } from 'util';
import { AppPaths } from './core/config/paths';
import { SecretsStore } from './core/storage/SecretsStore';
import { CookieStore } from './core/auth/CookieStore';
import { BBFetch } from './core/http/BBFetch';
import { CasClient } from './core/auth/CasClient';
import { resolveCredentials } from './core/auth/Credentials';
import { CourseService } from './core/services/CourseService';
import { DownloadService } from './core/services/DownloadService';
import { CourseSyncService } from './core/sync/CourseSyncService';
import { CalendarService, fetchIcsText } from './core/services/CalendarService';
import { JsonFileStore } from './core/storage/JsonFileStore';
import { Schedule } from './core/models/CalendarModels';
import { parseIcs } from './core/parser/CalendarParser';
import {
  authFailedError,
  downloadFailedError,
  invalidArgumentError,
  invalidCommandError,
  missingCredentialsError,
  normalizeError,
  resourceNotFoundError,
} from './core/errors';
import { CommandReporter, resolveOutputMode } from './utils/output';

type ParsedArgs = ReturnType<typeof parseArgs>;

const commonOptions = {
  root: { type: 'string' as const },
  json: { type: 'boolean' as const },
  output: { type: 'string' as const },
  username: { type: 'string' as const },
  password: { type: 'string' as const },
  save: { type: 'boolean' as const },
};

async function main(): Promise<void> {
  const [group, command, ...rest] = process.argv.slice(2);
  const implicitJson = !process.stdout.isTTY;

  if (!group || group === 'help' || group === '--help' || group === '-h') {
    process.stdout.write(`${helpText()}\n`);
    return;
  }

  const action = resolveAction(group, command);
  if (!action) {
    const reporter = new CommandReporter(
      `${group}${command ? `.${command}` : ''}`,
      resolveOutputMode(rest, implicitJson),
    );
    const cliError = invalidCommandError(`${group}${command ? ` ${command}` : ''}`);
    reporter.failure(cliError);
    process.exitCode = cliError.exitCode;
    return;
  }

  await runAction(action, rest, implicitJson, async (reporter) => {
    switch (action) {
      case 'auth.login':
        return handleAuthLogin(rest, reporter);
      case 'auth.status':
        return handleAuthStatus(rest, reporter);
      case 'auth.logout':
        return handleAuthLogout(rest, reporter);
      case 'courses.list':
        return handleCoursesList(rest, reporter);
      case 'courses.sync-term':
        return handleSyncTerm(rest, reporter);
      case 'courses.sync-course':
        return handleSyncCourse(rest, reporter);
      case 'calendar.sync':
        return handleCalendarSync(rest, reporter);
      case 'calendar.list':
        return handleCalendarList(rest, reporter);
      case 'materials.download':
        return handleMaterialDownload(rest, reporter);
    }
  });
}

async function runAction(
  action: string,
  argv: string[],
  implicitJson: boolean,
  executor: (reporter: CommandReporter) => Promise<unknown>,
): Promise<void> {
  const reporter = new CommandReporter(action, resolveOutputMode(argv, implicitJson));
  reporter.start({ argv });

  try {
    const data = await executor(reporter);
    reporter.success(data);
  } catch (error) {
    const cliError = normalizeError(error);
    reporter.failure(cliError);
    process.exitCode = cliError.exitCode;
  }
}

async function handleAuthLogin(argv: string[], reporter: CommandReporter): Promise<unknown> {
  const args = parseCommonArgs(argv);
  const runtime = createRuntime(args);

  reporter.progress({
    stage: 'resolve_credentials',
    message: '正在解析登录凭据',
  });

  const credentials = await resolveCredentials(
    {
      username: getString(args.values.username),
      password: getString(args.values.password),
      allowPrompt: true,
    },
    runtime.secretsStore,
  );

  if (!credentials) {
    throw missingCredentialsError();
  }

  reporter.progress({
    stage: 'authenticate',
    message: '正在登录 Blackboard',
    data: { username: credentials.username },
  });

  const loggedIn = await runtime.casClient.ensureLogin(credentials);
  if (!loggedIn) {
    throw authFailedError();
  }

  if (args.values.save) {
    runtime.secretsStore.merge({
      username: credentials.username,
      password: credentials.password,
    });
  }

  return {
    rootDir: runtime.paths.rootDir,
    username: credentials.username,
    savedCredentials: Boolean(args.values.save),
    loggedIn: true,
  };
}

async function handleAuthStatus(argv: string[], reporter: CommandReporter): Promise<unknown> {
  const args = parseCommonArgs(argv);
  const runtime = createRuntime(args);
  const secrets = runtime.secretsStore.read();

  reporter.progress({
    stage: 'check_session',
    message: '正在检查当前 Blackboard 会话',
  });

  const loggedIn = await runtime.casClient.quickCheck();

  return {
    rootDir: runtime.paths.rootDir,
    storedUsername: secrets.username ?? null,
    hasStoredCredentials: Boolean(secrets.username && secrets.password),
    hasCalendarUrl: Boolean(secrets.calendarUrl),
    loggedIn,
  };
}

async function handleAuthLogout(argv: string[], reporter: CommandReporter): Promise<unknown> {
  const args = parseCommonArgs(argv);
  const runtime = createRuntime(args);

  reporter.progress({
    stage: 'clear_state',
    message: '正在清理凭据和 Cookie',
  });

  runtime.fetchClient.clearCookies();
  runtime.secretsStore.clear();

  return {
    rootDir: runtime.paths.rootDir,
    cleared: true,
  };
}

async function handleCoursesList(argv: string[], reporter: CommandReporter): Promise<unknown> {
  const args = parseCommonArgs(argv);
  const runtime = createRuntime(args);
  await ensureAuthenticated(runtime, args, reporter, true);

  reporter.progress({
    stage: 'fetch_courses',
    message: '正在拉取课程列表',
  });

  const terms = await runtime.courseService.listCourses();
  return {
    rootDir: runtime.paths.rootDir,
    terms,
  };
}

async function handleSyncTerm(argv: string[], reporter: CommandReporter): Promise<unknown> {
  const args = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      ...commonOptions,
      'metadata-only': { type: 'boolean' as const },
    },
  });
  validateOutputOption(getString(args.values.output));

  const termId = args.positionals[0]?.trim();
  if (!termId) {
    throw invalidArgumentError('缺少学期标识，例如：courses sync-term 25spring');
  }

  const runtime = createRuntime(args);
  await ensureAuthenticated(runtime, args, reporter, true);

  reporter.progress({
    stage: 'fetch_courses',
    message: '正在拉取课程列表',
    data: { termId },
  });

  const all = await runtime.courseService.listCourses();
  const courses = all[termId];
  if (!courses?.length) {
    throw resourceNotFoundError(`未找到学期 ${termId} 的课程。`, { termId });
  }

  const termDir = path.join(runtime.paths.vaultDir, termId);
  const results = [];
  for (const course of courses) {
    reporter.progress({
      stage: 'sync_course',
      message: '正在同步课程',
      data: { termId, courseName: course.name },
    });

    const result = await runtime.courseSyncService.syncCourse(course, termDir, {
      metadataOnly: Boolean(args.values['metadata-only']),
      onProgress: (event) => reporter.progress(event),
    });

    reporter.progress({
      stage: 'course_synced',
      message: '课程同步完成',
      data: {
        courseName: result.courseName,
        pageCount: result.pageCount,
        downloadedCount: result.downloadedCount,
      },
    });

    results.push(result);
  }

  return {
    rootDir: runtime.paths.rootDir,
    termId,
    courseCount: results.length,
    metadataOnly: Boolean(args.values['metadata-only']),
    outputDir: termDir,
    courses: results,
  };
}

async function handleSyncCourse(argv: string[], reporter: CommandReporter): Promise<unknown> {
  const args = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      ...commonOptions,
      'metadata-only': { type: 'boolean' as const },
      'course-url': { type: 'string' as const },
      'term-id': { type: 'string' as const },
      'course-name': { type: 'string' as const },
    },
  });
  validateOutputOption(getString(args.values.output));

  const runtime = createRuntime(args);
  await ensureAuthenticated(runtime, args, reporter, true);

  reporter.progress({
    stage: 'fetch_courses',
    message: '正在拉取课程列表',
  });

  const all = await runtime.courseService.listCourses();
  const resolved = resolveCourse(
    all,
    getString(args.values['course-url']),
    getString(args.values['term-id']),
    getString(args.values['course-name']),
  );

  const termDir = path.join(runtime.paths.vaultDir, resolved.termId);
  reporter.progress({
    stage: 'sync_course',
    message: '正在同步指定课程',
    data: {
      termId: resolved.termId,
      courseName: resolved.course.name,
    },
  });

  const result = await runtime.courseSyncService.syncCourse(resolved.course, termDir, {
    metadataOnly: Boolean(args.values['metadata-only']),
    onProgress: (event) => reporter.progress(event),
  });

  return {
    rootDir: runtime.paths.rootDir,
    termId: resolved.termId,
    metadataOnly: Boolean(args.values['metadata-only']),
    course: result,
  };
}

async function handleCalendarSync(argv: string[], reporter: CommandReporter): Promise<unknown> {
  const args = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      ...commonOptions,
      'force-refresh-url': { type: 'boolean' as const },
    },
  });
  validateOutputOption(getString(args.values.output));

  const runtime = createRuntime(args);
  await ensureAuthenticated(runtime, args, reporter, true);

  const secrets = runtime.secretsStore.read();
  let calendarUrl = secrets.calendarUrl;

  if (!calendarUrl || args.values['force-refresh-url']) {
    reporter.progress({
      stage: 'fetch_calendar_url',
      message: '正在刷新日历订阅地址',
    });

    calendarUrl = await runtime.calendarService.fetchFeedUrl();
    runtime.secretsStore.merge({ calendarUrl });
  }

  reporter.progress({
    stage: 'download_ics',
    message: '正在下载 ICS 日历数据',
  });

  const incoming = parseIcs(await fetchIcsText(calendarUrl));
  const calendarStore = new JsonFileStore<Record<string, Schedule>>(runtime.paths.calendarFile, {});
  const current = calendarStore.read();

  reporter.progress({
    stage: 'merge_calendar',
    message: '正在合并本地日历缓存',
    data: { incomingCount: incoming.length },
  });

  for (const event of incoming) {
    current[event.uid] = {
      ...(current[event.uid] ?? event),
      ...event,
      done: current[event.uid]?.done ?? false,
    };
  }

  calendarStore.write(current);
  const events = Object.values(current).sort((a, b) => a.start.localeCompare(b.start));

  return {
    rootDir: runtime.paths.rootDir,
    calendarUrlCached: true,
    eventCount: events.length,
    syncedCount: incoming.length,
    events,
  };
}

async function handleCalendarList(argv: string[], reporter: CommandReporter): Promise<unknown> {
  const args = parseCommonArgs(argv);
  const runtime = createRuntime(args);
  const calendarStore = new JsonFileStore<Record<string, Schedule>>(runtime.paths.calendarFile, {});

  reporter.progress({
    stage: 'read_calendar',
    message: '正在读取本地日历缓存',
  });

  const events = Object.values(calendarStore.read()).sort((a, b) => a.start.localeCompare(b.start));

  return {
    rootDir: runtime.paths.rootDir,
    eventCount: events.length,
    events,
  };
}

async function handleMaterialDownload(argv: string[], reporter: CommandReporter): Promise<unknown> {
  const args = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: {
      ...commonOptions,
      url: { type: 'string' as const },
      target: { type: 'string' as const },
      'file-output': { type: 'string' as const },
    },
  });
  validateOutputOption(getString(args.values.output));

  const url = getString(args.values.url);
  const outputPath = getString(args.values.target) ?? getString(args.values['file-output']);

  if (!url || !outputPath) {
    throw invalidArgumentError('materials download 需要同时提供 --url 和 --target。');
  }

  const runtime = createRuntime(args);
  await ensureAuthenticated(runtime, args, reporter, true);

  reporter.progress({
    stage: 'download_file',
    message: '正在下载 Blackboard 文件',
    data: { url, output: path.resolve(outputPath) },
  });

  const ok = await runtime.downloadService.download(url, path.resolve(outputPath));
  if (!ok) {
    throw downloadFailedError('文件下载失败。', { url, output: path.resolve(outputPath) });
  }

  return {
    rootDir: runtime.paths.rootDir,
    url,
    output: path.resolve(outputPath),
  };
}

function parseCommonArgs(argv: string[]): ParsedArgs {
  const args = parseArgs({
    args: argv,
    allowPositionals: true,
    strict: true,
    options: commonOptions,
  });
  validateOutputOption(getString(args.values.output));
  return args;
}

function createRuntime(args: ParsedArgs) {
  const paths = new AppPaths(getString(args.values.root));
  const secretsStore = new SecretsStore(paths.secretsFile);
  const cookieStore = new CookieStore(paths.cookiesFile);
  const fetchClient = new BBFetch(cookieStore);
  const casClient = new CasClient(fetchClient);
  const courseService = new CourseService(fetchClient);
  const downloadService = new DownloadService(fetchClient);
  const courseSyncService = new CourseSyncService(courseService, downloadService);
  const calendarService = new CalendarService(fetchClient);

  return {
    paths,
    secretsStore,
    fetchClient,
    casClient,
    courseService,
    downloadService,
    courseSyncService,
    calendarService,
  };
}

async function ensureAuthenticated(
  runtime: ReturnType<typeof createRuntime>,
  args: ParsedArgs,
  reporter: CommandReporter,
  allowPrompt: boolean,
): Promise<void> {
  reporter.progress({
    stage: 'resolve_credentials',
    message: '正在解析认证凭据',
  });

  const credentials = await resolveCredentials(
    {
      username: getString(args.values.username),
      password: getString(args.values.password),
      allowPrompt,
    },
    runtime.secretsStore,
  );

  reporter.progress({
    stage: 'authenticate',
    message: '正在建立 Blackboard 会话',
  });

  const loggedIn = await runtime.casClient.ensureLogin(credentials);
  if (!loggedIn) {
    if (!credentials) {
      throw authFailedError('Blackboard 登录失败，请先执行 auth login --save，或通过参数/环境变量提供凭据。');
    }
    throw authFailedError('Blackboard 登录失败，请检查用户名或密码。');
  }

  if (args.values.save && credentials) {
    runtime.secretsStore.merge({
      username: credentials.username,
      password: credentials.password,
    });
  }
}

function resolveCourse(
  all: Record<string, Array<{ name: string; url: string; announcement: { content: string; url: string } }>>,
  courseUrl?: string,
  termId?: string,
  courseName?: string,
) {
  if (courseUrl) {
    for (const [currentTermId, courses] of Object.entries(all)) {
      const course = courses.find((item) => item.url === courseUrl);
      if (course) {
        return { termId: currentTermId, course };
      }
    }
    throw resourceNotFoundError(`未找到课程 URL：${courseUrl}`, { courseUrl });
  }

  if (termId && courseName) {
    const course = all[termId]?.find((item) => item.name === courseName);
    if (course) {
      return { termId, course };
    }
    throw resourceNotFoundError(`学期 ${termId} 下未找到课程：${courseName}`, {
      termId,
      courseName,
    });
  }

  throw invalidArgumentError(
    'courses sync-course 需要提供 --course-url，或同时提供 --term-id 和 --course-name。',
  );
}

function resolveAction(group?: string, command?: string): string | null {
  const key = `${group ?? ''}:${command ?? ''}`;
  switch (key) {
    case 'auth:login':
      return 'auth.login';
    case 'auth:status':
      return 'auth.status';
    case 'auth:logout':
      return 'auth.logout';
    case 'courses:list':
      return 'courses.list';
    case 'courses:sync-term':
      return 'courses.sync-term';
    case 'courses:sync-course':
      return 'courses.sync-course';
    case 'calendar:sync':
      return 'calendar.sync';
    case 'calendar:list':
      return 'calendar.list';
    case 'materials:download':
      return 'materials.download';
    default:
      return null;
  }
}

function validateOutputOption(value?: string): void {
  if (!value) {
    return;
  }

  if (!['text', 'json', 'jsonl'].includes(value)) {
    throw invalidArgumentError('--output 仅支持 text、json、jsonl。', { value });
  }
}

function getString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function helpText(): string {
  return [
    'SVSmate Agent CLI',
    '',
    '用法:',
    '  svsmate-agent auth login [--username <u> --password <p> --save] [--root <dir>] [--output <mode>]',
    '  svsmate-agent auth status [--root <dir>] [--output <mode>]',
    '  svsmate-agent auth logout [--root <dir>] [--output <mode>]',
    '  svsmate-agent courses list [--root <dir>] [--output <mode>]',
    '  svsmate-agent courses sync-term <termId> [--metadata-only] [--root <dir>] [--output <mode>]',
    '  svsmate-agent courses sync-course --course-url <url> [--metadata-only] [--root <dir>] [--output <mode>]',
    '  svsmate-agent courses sync-course --term-id <id> --course-name <name> [--metadata-only] [--root <dir>] [--output <mode>]',
    '  svsmate-agent calendar sync [--force-refresh-url] [--root <dir>] [--output <mode>]',
    '  svsmate-agent calendar list [--root <dir>] [--output <mode>]',
    '  svsmate-agent materials download --url <url> --target <file> [--root <dir>] [--output <mode>]',
    '',
    '输出模式:',
    '  text   适合人工阅读',
    '  json   输出单个稳定 JSON 对象',
    '  jsonl  输出事件流，包含 start/progress/result/error',
    '',
    '退出码:',
    '  0   成功',
    '  2   命令或参数错误',
    '  3   认证错误',
    '  4   网络、远端服务或响应格式错误',
    '  5   资源不存在',
    '  6   下载或本地 IO 错误',
    '  10  未分类内部错误',
    '',
    '错误码分类:',
    '  INVALID_COMMAND, INVALID_ARGUMENT, AUTH_CREDENTIALS_MISSING, AUTH_FAILED,',
    '  NETWORK_ERROR, HTTP_ERROR, RESOURCE_NOT_FOUND, INVALID_RESPONSE,',
    '  DOWNLOAD_FAILED, IO_ERROR, INTERRUPTED, INTERNAL_ERROR',
    '',
    '兼容性说明:',
    '  1. 旧参数 --json 仍保留，等价于 --output json。',
    '  2. stdout 非 TTY 且未指定 --output 时，默认走 json 模式。',
    '  3. jsonl 模式适合 agent 消费进度和最终结果。',
  ].join('\n');
}

void main();
