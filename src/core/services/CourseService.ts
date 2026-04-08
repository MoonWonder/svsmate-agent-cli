import { BBFetch } from '../http/BBFetch';
import { parseCourseList } from '../parser/CourseListParser';
import { parsePage } from '../parser/PageParser';
import { parseSidebar } from '../parser/SidebarParser';
import { CoursesByTerm, PageContent, Sidebar } from '../models/CourseModels';
import { httpError, networkError } from '../errors';

/**
 * 课程数据获取服务。
 */
export class CourseService {
  constructor(private readonly fetch: BBFetch) {}

  async listCourses(): Promise<CoursesByTerm> {
    const url = 'https://bb.sustech.edu.cn/webapps/portal/execute/tabs/tabAction';
    const body = new URLSearchParams({
      action: 'refreshAjaxModule',
      modId: '_3_1',
      tabId: '_1_1',
      tab_tab_group_id: '_1_1',
    });

    let res;
    try {
      res = await this.fetch.post(url, body);
    } catch (error) {
      throw networkError('获取课程列表时发生网络错误', { url }, error);
    }

    if (res.status !== 200) {
      throw httpError('获取课程列表失败', res.status, { url });
    }

    return parseCourseList(await res.text());
  }

  async getSidebar(courseUrl: string): Promise<Sidebar> {
    let res;
    try {
      res = await this.fetch.get(courseUrl, { redirect: 'follow' });
    } catch (error) {
      throw networkError('获取课程导航时发生网络错误', { courseUrl }, error);
    }

    if (res.status !== 200) {
      throw httpError('获取课程导航失败', res.status, { courseUrl });
    }

    return parseSidebar(await res.text());
  }

  async getPage(pageUrl: string): Promise<PageContent> {
    let res;
    try {
      res = await this.fetch.get(pageUrl, { redirect: 'follow' });
    } catch (error) {
      throw networkError('获取课程页面时发生网络错误', { pageUrl }, error);
    }

    if (res.status !== 200) {
      throw httpError('获取页面失败', res.status, { pageUrl });
    }

    return parsePage(await res.text());
  }
}
