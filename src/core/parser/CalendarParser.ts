import * as ical from 'node-ical';
import { Schedule } from '../models/CalendarModels';

/**
 * 将 ICS 事件转换为内部结构。
 */
export function toSchedule(event: ical.VEvent): Schedule {
  const title = event.summary ?? '(untitled)';
  const end = event.end.toISOString();

  return {
    uid: `${title}::${end}`,
    title,
    start: event.start.toISOString(),
    end,
    done: false,
  };
}

/**
 * 解析 ICS 文本，按标题和结束时间去重。
 */
export function parseIcs(icsText: string): Schedule[] {
  const parsed = ical.parseICS(icsText);
  const seen = new Map<string, Schedule>();

  for (const key of Object.keys(parsed)) {
    const entry = parsed[key];
    if (
      entry.type === 'VEVENT' &&
      entry.start &&
      entry.end &&
      entry.summary
    ) {
      const item = toSchedule(entry as ical.VEvent);
      const existing = seen.get(item.uid);
      if (!existing || new Date(item.end) > new Date(existing.end)) {
        seen.set(item.uid, item);
      }
    }
  }

  return Array.from(seen.values());
}
