import * as cheerio from 'cheerio';
import { parseStringPromise } from 'xml2js';
import { Announcement, Course, CoursesByTerm } from '../models/CourseModels';

/**
 * 解析 Blackboard 返回的课程列表 XML。
 */
export async function parseCourseList(xml: string): Promise<CoursesByTerm> {
  const parsed = (await parseStringPromise(xml, {
    explicitArray: false,
    trim: true,
    explicitCharkey: true,
  })) as { contents?: { _: string } };

  const html = parsed?.contents?._ ?? '';
  const $ = cheerio.load(html);
  const terms: CoursesByTerm = {};

  $('h3.termHeading-coursefakeclass').each((_, h3) => {
    const termName = $(h3).text().trim();
    const termId = normalizeTerm(termName);
    terms[termId] = [];

    const anchor = $(h3).find('a[id]');
    const idMatch = anchor.attr('id')?.match(/termCourses__\d+_\d+/);
    if (!idMatch) {
      return;
    }

    const listId = `_3_1${idMatch[0]}`;
    const listDiv = $(`div#${listId}`);

    listDiv.find('li').each((__, li) => {
      const a = $(li).find('a[href]').first();
      const href = (a.attr('href') ?? '').trim();
      if (!a.length || href.includes('announcement')) {
        return;
      }

      const announcement: Announcement = { content: '', url: '' };
      const block = $(li).find('div.courseDataBlock');

      if (block.length) {
        block.find('span.dataBlockLabel').remove();
        const ann = block.find('a[href]').first();
        if (ann.length) {
          announcement.content = ann.text().trim();
          announcement.url = absolute((ann.attr('href') ?? '').trim());
        }
      }

      const course: Course = {
        name: a.text().trim(),
        url: absolute(href),
        announcement,
      };

      terms[termId]?.push(course);
    });
  });

  return terms;
}

function absolute(href: string): string {
  return href.startsWith('http') ? href : `https://bb.sustech.edu.cn${href}`;
}

function normalizeTerm(termName: string): string {
  const match = termName.match(/（(Spring|Fall|Summer|Winter)\s+(\d{4})）/);
  if (!match) {
    return termName;
  }

  const season = match[1].toLowerCase();
  const year = match[2].slice(-2);
  return `${year}${season}`;
}
