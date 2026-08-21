import type MarkdownIt from 'markdown-it';


// option types

export interface OptAttr {
  enable: boolean;
  render: boolean;
}

export interface OptCssNames {
  attr?: string;
  attrbox?: string;
  attrItem?: string;
  key?: string;
}

export interface CamlOptions extends MarkdownIt.Options {
  // metadata functions
  addAttr?: (env: any, key: string, value: string) => void;
  // render opts
  attrs: OptAttr;
  cssNames: OptCssNames;
}
