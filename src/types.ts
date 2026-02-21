export interface PageSnapshot {
  url: string;
  title: string;
  lang: string;
  landmarks: Landmark[];
  headings: Heading[];
  navLinks: NavLink[];
  contentGroups: ContentGroup[];
  forms: FormSnapshot[];
  buttons: ButtonSnapshot[];
  links: LinkSnapshot[];
  search?: { action: string; paramName: string };
}

export interface Landmark {
  role: string;
  label?: string;
}

export interface Heading {
  level: number;
  text: string;
  id?: string;
}

export interface NavLink {
  text: string;
  href: string;
  isCurrent: boolean;
}

export type ContentBlockType =
  | "paragraph"
  | "heading"
  | "list"
  | "image"
  | "blockquote"
  | "preformatted"
  | "table"
  | "definition-list";

export interface ContentBlock {
  type: ContentBlockType;
  text: string;
  level?: number;
  items?: string[];
  alt?: string;
  src?: string;
  rows?: string[][];
  headers?: string[];
  definitions?: Array<{ term: string; description: string }>;
  sourceContext?: "main" | "article" | "body";
}

export interface ContentGroup {
  heading?: { text: string; level: number };
  blocks: ContentBlock[];
  score: number;
  collapsed: boolean;
}

export interface FormSnapshot {
  action: string;
  method: string;
  label?: string;
  fields: FormField[];
}

export interface FormField {
  type: string;
  name: string;
  label: string;
  required: boolean;
  value?: string;
  options?: SelectOption[];
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface ButtonSnapshot {
  text: string;
  type: "submit" | "button" | "reset";
}

export interface LinkSnapshot {
  text: string;
  href: string;
  isFooter?: boolean;
}
