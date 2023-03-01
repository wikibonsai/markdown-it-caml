import { merge } from 'lodash';

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
      attrbox: 'attrbox',
      attrboxTitle: 'attrbox-title',
    },
  };
  const fullOpts: CamlOptions = merge(defaults, opts);

  caml_attrs(md, fullOpts);
}

export type { CamlOptions };

export default caml_plugin;
