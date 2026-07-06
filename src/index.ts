import { defu } from 'defu';

import type MarkdownIt from 'markdown-it/lib';

import type { CamlOptions } from './types';

import { caml_attrs } from './caml';


function caml_plugin(md: MarkdownIt, opts?: Partial<CamlOptions>): void {
  // opts
  const defaults: CamlOptions = {
    attrs: {
      enable: true,
      render: true,
      title: 'Attributes',
    },
    cssNames: {
      attr: 'attr',
      wiki: 'wiki',
      invalid: 'invalid',
      reftype: 'reftype__',
      doctype: 'doctype__',
      attrbox: 'attrbox',
      attrItem: 'attr-item',
    },
  };
  // defu(opts, defaults): user opts win, defaults fill gaps — parity with wikirefs
  const fullOpts: CamlOptions = defu(opts, defaults) as CamlOptions;

  caml_attrs(md, fullOpts);
}

export type { CamlOptions };

export default caml_plugin;
