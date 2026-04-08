import { URLSearchParams } from 'url';
import * as cheerio from 'cheerio';
import { BBFetch } from '../http/BBFetch';
import { Credentials } from './Credentials';

/**
 * 处理南科大 CAS 到 Blackboard 的登录流程。
 */
export class CasClient {
  private static readonly CAS_URL = 'https://cas.sustech.edu.cn/cas/login';
  private static readonly SERVICE_URL = 'https://bb.sustech.edu.cn/webapps/login/';

  constructor(private readonly fetch: BBFetch) {}

  async ensureLogin(credentials?: Credentials | null): Promise<boolean> {
    if (await this.quickCheck()) {
      return true;
    }

    if (!credentials) {
      return false;
    }

    const execution = await this.fetchExecution();
    if (!execution) {
      return false;
    }

    const ticketUrl = await this.submitCredentials(credentials, execution);
    if (!ticketUrl) {
      return false;
    }

    return this.validateServiceTicket(ticketUrl);
  }

  async quickCheck(): Promise<boolean> {
    const res = await this.fetch.get('https://bb.sustech.edu.cn/ultra/course', {
      redirect: 'manual',
    });

    if (res.status === 200) {
      return true;
    }

    if (res.status === 302) {
      const location = res.headers.get('location') ?? '';
      if (location.includes('cas.sustech.edu.cn')) {
        return false;
      }
    }

    const meRes = await this.fetch.get(
      'https://bb.sustech.edu.cn/learn/api/public/v1/users/me',
      { redirect: 'manual' },
    );

    return meRes.status === 200;
  }

  private async fetchExecution(): Promise<string | null> {
    const url = `${CasClient.CAS_URL}?service=${encodeURIComponent(CasClient.SERVICE_URL)}`;
    const res = await this.fetch.get(url, { redirect: 'follow' });
    if (res.status !== 200) {
      return null;
    }

    const html = await res.text();
    const $ = cheerio.load(html);
    const execution = $('input[name="execution"]').val();
    return execution ? String(execution) : null;
  }

  private async submitCredentials(
    credentials: Credentials,
    execution: string,
  ): Promise<string | null> {
    const url = `${CasClient.CAS_URL}?service=${encodeURIComponent(CasClient.SERVICE_URL)}`;

    const body = new URLSearchParams({
      username: credentials.username,
      password: credentials.password,
      execution,
      _eventId: 'submit',
      geolocation: '',
      submit: '登录',
    });

    const res = await this.fetch.post(url, body, { redirect: 'manual' });
    if (res.status !== 302) {
      return null;
    }

    const location = res.headers.get('location') ?? '';
    if (location.includes('authenticationFailure')) {
      return null;
    }

    return location.includes('ticket=') ? location : null;
  }

  private async validateServiceTicket(ticketUrl: string): Promise<boolean> {
    const res = await this.fetch.get(ticketUrl, { redirect: 'follow' });
    const ok = res.status === 200 && res.url.includes('bb.sustech.edu.cn');
    if (ok) {
      this.fetch.saveCookies();
    }
    return ok;
  }
}
