import fetch, { RequestInit, Response } from 'node-fetch';
import fetchCookie from 'fetch-cookie';
import { CookieJar } from 'tough-cookie';
import { CookieStore } from '../auth/CookieStore';

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

/**
 * 带 Cookie 持久化能力的 HTTP 封装。
 */
export class BBFetch {
  private readonly client: (url: string, init?: RequestInit) => Promise<Response>;

  constructor(private readonly cookieStore: CookieStore) {
    this.client = fetchCookie(fetch, this.cookieStore.cookieJar as any);
  }

  get jar(): CookieJar {
    return this.cookieStore.cookieJar;
  }

  saveCookies(): void {
    this.cookieStore.save();
  }

  clearCookies(): void {
    this.cookieStore.clear();
  }

  async get(url: string, init: RequestInit = {}): Promise<Response> {
    return this.client(url, {
      redirect: init.redirect ?? 'manual',
      headers: {
        'User-Agent': USER_AGENT,
        ...(init.headers ?? {}),
      },
      ...init,
    });
  }

  async post(url: string, body: unknown, init: RequestInit = {}): Promise<Response> {
    return this.client(url, {
      method: 'POST',
      body: body as RequestInit['body'],
      headers: {
        'User-Agent': USER_AGENT,
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(init.headers ?? {}),
      },
      redirect: init.redirect ?? 'manual',
      ...init,
    });
  }
}
