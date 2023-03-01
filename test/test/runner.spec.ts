import assert from 'node:assert/strict';

import type MarkdownIt from 'markdown-it';
import type { CamlValData } from 'caml-mkdn';
import type { CamlOptions } from '../../src/types';

import markdown from 'markdown-it';
import caml_plugin from '../../src';

import type { CamlTestCase } from 'caml-spec';
import { camlCases } from 'caml-spec';


let env: any;
let mockOpts: Partial<CamlOptions>;
let md: MarkdownIt;

function run(contextMsg: string, tests: CamlTestCase[]): void {
  context(contextMsg, () => {
    let i = 0;
    for(const test of tests) {
      const desc: string = `[${('00' + (++i)).slice(-3)}] ` + (test.descr || '');
      it(desc, () => {
        const mkdn: string = test.mkdn;
        const expdHTML: string = test.html;
        const expdData: CamlValData = test.parseData;
        const actlHTML: string = md.render(mkdn, env);
        assert.strictEqual(actlHTML, expdHTML);
        assert.deepStrictEqual(env.attrs, expdData);
      });
    }
  });
}

describe('markdown-it-caml', () => {

  beforeEach(() => {
    // mockOpts = makeMockOptsForRenderOnly();
    md = markdown().use(caml_plugin, mockOpts);
    env = { absPath: '/tests/fixtures/file-with-caml-attrs.md' };
  });

  describe('render', () => {

    // go
    run('mkdn -> html', camlCases);

  });

});
