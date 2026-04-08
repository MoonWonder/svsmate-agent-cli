import { emitKeypressEvents } from 'readline';
import { createInterface } from 'readline/promises';
import { stdin as input, stdout as output } from 'process';
import { SecretsStore } from '../storage/SecretsStore';
import { interruptedError, invalidArgumentError } from '../errors';

export interface Credentials {
  username: string;
  password: string;
}

export interface CredentialResolveOptions {
  username?: string;
  password?: string;
  allowPrompt?: boolean;
}

/**
 * 按 flags -> 环境变量 -> 本地存储 -> 交互输入 的顺序解析凭据。
 */
export async function resolveCredentials(
  options: CredentialResolveOptions,
  secretsStore: SecretsStore,
): Promise<Credentials | null> {
  const secrets = secretsStore.read();

  const username =
    options.username ??
    process.env.SVSMATE_USERNAME ??
    secrets.username;

  const password =
    options.password ??
    process.env.SVSMATE_PASSWORD ??
    secrets.password;

  if (username && password) {
    return { username, password };
  }

  if (!options.allowPrompt || !process.stdin.isTTY || !process.stdout.isTTY) {
    return null;
  }

  const rl = createInterface({ input, output, terminal: true });
  try {
    const askedUsername = username ?? (await rl.question('Blackboard 用户名: ')).trim();
    const askedPassword =
      password ??
      (await questionSilently('Blackboard 密码: ')).trim();

    if (!askedUsername || !askedPassword) {
      return null;
    }

    return {
      username: askedUsername,
      password: askedPassword,
    };
  } finally {
    rl.close();
  }
}

async function questionSilently(prompt: string): Promise<string> {
  if (!input.isTTY) {
    throw invalidArgumentError('当前环境不支持安全密码输入');
  }

  output.write(prompt);
  emitKeypressEvents(input);

  const previousRawMode = input.isRaw;
  input.setRawMode(true);
  input.resume();

  return await new Promise<string>((resolve, reject) => {
    let answer = '';

    const cleanup = () => {
      input.off('keypress', onKeypress);
      input.setRawMode(previousRawMode ?? false);
      output.write('\n');
    };

    const onKeypress = (chunk: string, key: { name?: string; ctrl?: boolean }) => {
      if (key.ctrl && key.name === 'c') {
        cleanup();
        reject(interruptedError('用户取消了密码输入'));
        return;
      }

      if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(answer);
        return;
      }

      if (key.name === 'backspace') {
        answer = answer.slice(0, -1);
        return;
      }

      if (chunk) {
        answer += chunk;
      }
    };

    input.on('keypress', onKeypress);
  });
}
