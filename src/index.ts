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
    },
    cssNames: {
      attr: 'attr',
      attrbox: 'attrbox',
      attrItem: 'attr-item',
      key: 'key__',
    },
  };
  // defu(opts, defaults): user opts win, defaults fill gaps — parity with wikirefs
  const fullOpts: CamlOptions = defu(opts, defaults) as CamlOptions;

  caml_attrs(md, fullOpts);
}

export type { CamlOptions };

export default caml_plugin;
