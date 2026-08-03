import type MarkdownIt from 'markdown-it';


// option types

export interface OptAttr {
  enable: boolean;
  render: boolean;
}

export interface OptCssNames {
  attr: string;
  wiki: string;
  invalid: string;
  reftype: string;
  doctype: string;
  attrbox: string;
  attrItem: string;
}

export interface CamlOptions extends MarkdownIt.Options {
  // metadata functions
  addAttr?: (env: any, key: string, value: string) => void;
  // render opts
  attrs: OptAttr;
  cssNames: OptCssNames;
  // wiki value rendering — mirrors the markdown-it-wikirefs resolvers (env-first)
  // so caml renders wiki attr values as <a> links standalone; override to match
  // the co-installed wikirefs. NOTE: when markdown-it-wikirefs is co-registered,
  // caml delegates wiki attr values to it and these are unused.
  resolveHtmlHref?: (env: any, fname: string) => string | undefined;
  resolveHtmlText?: (env: any, fname: string) => string | undefined;
  resolveDocType?: (env: any, fname: string) => string | undefined;
  baseUrl?: string;
}
