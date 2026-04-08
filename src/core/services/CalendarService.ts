import fetch from 'node-fetch';
import { BBFetch } from '../http/BBFetch';
import { httpError, invalidResponseError, networkError } from '../errors';

const CAL_FEED_ENDPOINT = 'https://bb.sustech.edu.cn/webapps/calendar/calendarFeed/url';

/**
 * 日历相关远端接口。
 */
export class CalendarService {
  constructor(private readonly fetchClient: BBFetch) {}

  async fetchFeedUrl(): Promise<string> {
    let res;
    try {
      res = await this.fetchClient.get(CAL_FEED_ENDPOINT, { redirect: 'follow' });
    } catch (error) {
      throw networkError('获取日历订阅地址时发生网络错误', { url: CAL_FEED_ENDPOINT }, error);
    }

    if (res.status !== 200) {
      throw httpError('获取日历订阅地址失败', res.status, { url: CAL_FEED_ENDPOINT });
    }

    const url = (await res.text()).trim();
    const valid = /^https?:\/\/.*\.ics(?:\?.*)?$/.test(url);
    if (!valid) {
      throw invalidResponseError('Blackboard 返回了无效的日历地址', {
        sample: url.slice(0, 200),
      });
    }

    return url;
  }
}

/**
 * 下载原始 ICS 文本。
 */
export async function fetchIcsText(url: string): Promise<string> {
  let resp;
  try {
    resp = await fetch(url);
  } catch (error) {
    throw networkError('下载 ICS 时发生网络错误', { url }, error);
  }

  if (!resp.ok) {
    throw httpError('下载 ICS 失败', resp.status, { url });
  }

  return resp.text();
}
