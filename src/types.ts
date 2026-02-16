export interface PageSnapshot {
  url: string;
  title: string;
  lang: string;
  landmarks: Landmark[];
  headings: Heading[];
  navLinks: NavLink[];
  mainContent: ContentBlock[];
  forms: FormSnapshot[];
  buttons: ButtonSnapshot[];
  links: LinkSnapshot[];
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
  | "preformatted";

export interface ContentBlock {
  type: ContentBlockType;
  text: string;
  level?: number;
  items?: string[];
  alt?: string;
  src?: string;
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
}
