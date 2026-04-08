export interface Announcement {
  content: string;
  url: string;
}

export interface Course {
  name: string;
  url: string;
  announcement: Announcement;
}

export type CoursesByTerm = Record<string, Course[]>;

export interface SidebarLink {
  title: string;
  url: string;
}

export type Sidebar = Record<string, SidebarLink[]>;

export interface PageFile {
  name: string;
  url: string;
}

export interface PageSection {
  text: string;
  files: PageFile[];
}

export type PageContent = Record<string, PageSection>;
