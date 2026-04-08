import { CliError } from '../core/errors';

export type OutputMode = 'text' | 'json' | 'jsonl';

export interface ReporterMeta {
  argv?: string[];
  rootDir?: string;
}

export interface ProgressPayload {
  message: string;
  stage?: string;
  data?: unknown;
}

/**
 * 根据命令行参数解析输出模式。
 */
export function resolveOutputMode(argv: string[], implicitJson: boolean): OutputMode {
  const outputFlagIndex = argv.findIndex((item) => item === '--output');
  if (outputFlagIndex >= 0) {
    const raw = argv[outputFlagIndex + 1];
    if (raw === 'text' || raw === 'json' || raw === 'jsonl') {
      return raw;
    }
  }

  if (argv.includes('--json')) {
    return 'json';
  }

  return implicitJson ? 'json' : 'text';
}

/**
 * 结构化输出器。`jsonl` 模式下会输出事件流。
 */
export class CommandReporter {
  private readonly schemaVersion = 1;

  constructor(
    readonly action: string,
    readonly mode: OutputMode,
  ) {}

  start(meta: ReporterMeta = {}): void {
    if (this.mode !== 'jsonl') {
      return;
    }

    this.emitJsonl('start', {
      action: this.action,
      meta,
    });
  }

  progress(payload: ProgressPayload): void {
    if (this.mode !== 'jsonl') {
      return;
    }

    this.emitJsonl('progress', {
      action: this.action,
      ...payload,
    });
  }

  success(data: unknown): void {
    const payload = {
      ok: true,
      action: this.action,
      timestamp: now(),
      data,
    };

    if (this.mode === 'jsonl') {
      this.emitJsonl('result', payload);
      return;
    }

    if (this.mode === 'json') {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }

    if (typeof data === 'string') {
      process.stdout.write(`${data}\n`);
      return;
    }

    process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
  }

  failure(error: CliError): void {
    const payload = {
      ok: false,
      action: this.action,
      timestamp: now(),
      error: {
        code: error.code,
        message: error.message,
        exitCode: error.exitCode,
        details: error.details ?? null,
      },
    };

    if (this.mode === 'jsonl') {
      this.emitJsonl('error', payload);
      return;
    }

    if (this.mode === 'json') {
      process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
      return;
    }

    process.stderr.write(`[${error.code}] ${error.message}\n`);
  }

  private emitJsonl(type: 'start' | 'progress' | 'result' | 'error', data: Record<string, unknown>): void {
    process.stdout.write(
      `${JSON.stringify({
        type,
        schemaVersion: this.schemaVersion,
        timestamp: now(),
        ...data,
      })}\n`,
    );
  }
}

function now(): string {
  return new Date().toISOString();
}
