import * as cheerio from 'cheerio';
import { Sidebar } from '../models/CourseModels';

/**
 * 解析课程左侧导航栏。
 */
export function parseSidebar(html: string): Sidebar {
  const $ = cheerio.load(html);
  const sidebar: Sidebar = {};
  const menu = $('#courseMenuPalette_contents');

  if (!menu.length) {
    return sidebar;
  }

  let current: string | null = null;

  menu.find('li').each((_, li) => {
    const h3 = $(li).find('h3');
    if (h3.length) {
      current = h3.text().trim();
      if (current) {
        sidebar[current] = [];
      }
      return;
    }

    if (!current) {
      return;
    }

    const a = $(li).find('a[href]').first();
    if (!a.length) {
      return;
    }

    const title = a.text().trim();
    const url = new URL(a.attr('href') ?? '', 'https://bb.sustech.edu.cn').toString();
    sidebar[current]?.push({ title, url });
  });

  return sidebar;
}
