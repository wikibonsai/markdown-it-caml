import type MarkdownIt from 'markdown-it/lib';

import type { CamlOptions } from './types';

import { caml_attrs } from './caml';


function deepMerge(target: any, ...sources: any[]): any {
  const result = { ...target };
  for (const source of sources) {
    if (!source) continue;
    for (const key of Object.keys(source)) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])
          && target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])) {
        result[key] = deepMerge(target[key], source[key]);
      } else {
        result[key] = source[key];
      }
    }
  }
  return result;
}

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
      attrItem: 'attr-item',
      attrboxTitle: 'attrbox-title',
    },
  };
  const fullOpts: CamlOptions = deepMerge(defaults, opts);

  caml_attrs(md, fullOpts);
}

export type { CamlOptions };

export default caml_plugin;
