export enum ExitCode {
  OK = 0,
  USAGE = 2,
  AUTH = 3,
  NETWORK = 4,
  NOT_FOUND = 5,
  IO = 6,
  INTERNAL = 10,
}

export type ErrorCode =
  | 'INVALID_COMMAND'
  | 'INVALID_ARGUMENT'
  | 'AUTH_CREDENTIALS_MISSING'
  | 'AUTH_FAILED'
  | 'NETWORK_ERROR'
  | 'HTTP_ERROR'
  | 'RESOURCE_NOT_FOUND'
  | 'INVALID_RESPONSE'
  | 'DOWNLOAD_FAILED'
  | 'IO_ERROR'
  | 'INTERRUPTED'
  | 'INTERNAL_ERROR';

export interface CliErrorOptions {
  cause?: unknown;
  details?: unknown;
}

/**
 * 统一的命令行错误对象，包含稳定错误码和退出码。
 */
export class CliError extends Error {
  readonly code: ErrorCode;
  readonly exitCode: ExitCode;
  readonly details?: unknown;
  override readonly cause?: unknown;

  constructor(
    message: string,
    code: ErrorCode,
    exitCode: ExitCode,
    options: CliErrorOptions = {},
  ) {
    super(message);
    this.name = 'CliError';
    this.code = code;
    this.exitCode = exitCode;
    this.details = options.details;
    this.cause = options.cause;
  }
}

export function invalidCommandError(command: string): CliError {
  return new CliError(
    `未知命令：${command}`,
    'INVALID_COMMAND',
    ExitCode.USAGE,
    { details: { command } },
  );
}

export function invalidArgumentError(message: string, details?: unknown): CliError {
  return new CliError(message, 'INVALID_ARGUMENT', ExitCode.USAGE, { details });
}

export function missingCredentialsError(): CliError {
  return new CliError(
    '缺少 Blackboard 凭据，请通过 --username/--password、环境变量或交互输入提供。',
    'AUTH_CREDENTIALS_MISSING',
    ExitCode.AUTH,
  );
}

export function authFailedError(message = 'Blackboard 登录失败，请检查用户名或密码。'): CliError {
  return new CliError(message, 'AUTH_FAILED', ExitCode.AUTH);
}

export function resourceNotFoundError(message: string, details?: unknown): CliError {
  return new CliError(message, 'RESOURCE_NOT_FOUND', ExitCode.NOT_FOUND, { details });
}

export function invalidResponseError(message: string, details?: unknown): CliError {
  return new CliError(message, 'INVALID_RESPONSE', ExitCode.NETWORK, { details });
}

export function httpError(message: string, status: number, details?: unknown): CliError {
  return new CliError(message, 'HTTP_ERROR', ExitCode.NETWORK, {
    details: { status, ...(asRecord(details) ?? {}) },
  });
}

export function networkError(message: string, details?: unknown, cause?: unknown): CliError {
  return new CliError(message, 'NETWORK_ERROR', ExitCode.NETWORK, { details, cause });
}

export function downloadFailedError(message: string, details?: unknown): CliError {
  return new CliError(message, 'DOWNLOAD_FAILED', ExitCode.IO, { details });
}

export function ioError(message: string, details?: unknown, cause?: unknown): CliError {
  return new CliError(message, 'IO_ERROR', ExitCode.IO, { details, cause });
}

export function interruptedError(message: string): CliError {
  return new CliError(message, 'INTERRUPTED', ExitCode.AUTH);
}

export function normalizeError(error: unknown): CliError {
  if (error instanceof CliError) {
    return error;
  }

  if (isParseArgsError(error)) {
    return invalidArgumentError(error.message, {
      parseCode: (error as NodeJS.ErrnoException).code,
    });
  }

  if (isNodeFetchError(error)) {
    return networkError(error.message, { fetchType: (error as { type?: string }).type }, error);
  }

  if (isIoError(error)) {
    return ioError(error.message, { errno: error.code, path: error.path }, error);
  }

  if (error instanceof Error) {
    return new CliError(error.message, 'INTERNAL_ERROR', ExitCode.INTERNAL, { cause: error });
  }

  return new CliError(String(error), 'INTERNAL_ERROR', ExitCode.INTERNAL);
}

function isParseArgsError(error: unknown): error is TypeError & { code?: string } {
  const maybe = error as { code?: string } | null;
  return (
    error instanceof TypeError &&
    typeof maybe?.code === 'string' &&
    maybe.code.startsWith('ERR_PARSE_ARGS_')
  );
}

function isNodeFetchError(error: unknown): error is Error & { type?: string } {
  return error instanceof Error && error.name === 'FetchError';
}

function isIoError(error: unknown): error is NodeJS.ErrnoException {
  return (
    error instanceof Error &&
    typeof (error as NodeJS.ErrnoException).code === 'string' &&
    [
      'EACCES',
      'EEXIST',
      'EISDIR',
      'EMFILE',
      'ENOENT',
      'ENOSPC',
      'ENOTDIR',
      'EPERM',
    ].includes((error as NodeJS.ErrnoException).code ?? '')
  );
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : undefined;
}
