import assert from 'node:assert/strict';

import type MarkdownIt from 'markdown-it';
import type { CamlValData } from 'caml-mkdn';
import type { CamlOptions } from '../src/types';

import markdown from 'markdown-it';
import caml_plugin from '../src';
import wikirefs_plugin from 'markdown-it-wikirefs';
import type { WikiRefsOptions } from 'markdown-it-wikirefs';

import type { CamlTestCase } from 'caml-spec';
import { camlCases } from 'caml-spec';
// shared wikirefs-spec fixture resolvers (adapted to markdown-it's env-first
// resolver signature below) — a caml wiki attr value is a wikiref.
import { makeMockOptsForRenderOnly } from 'wikirefs-spec';


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
        const expdData: CamlValData | undefined = test.data?.parse;
        const actlHTML: string = md.render(mkdn, env);
        assert.strictEqual(actlHTML, expdHTML);
        if (expdData !== undefined) {
          assert.deepStrictEqual(env.attrs, expdData);
        }
      });
    }
  });
}

describe('markdown-it-caml', () => {

  beforeEach(() => {
    // caml alone (no wikirefs): wiki attr values render as plain string spans (the
    // standalone contract in caml-spec). caml+wikirefs interop is covered separately.
    md = markdown().use(caml_plugin, mockOpts);
    env = { absPath: '/tests/fixtures/file-with-caml-attrs.md' };
  });

  describe('render', () => {

    // go
    run('mkdn -> html', camlCases);

  });

  describe('state management', () => {

    it('consecutive renders should not pollute each other\'s attrs', () => {
      // first render
      const env1: any = { absPath: '/tests/fixtures/doc1.md' };
      const html1: string = md.render(':title::First Document\n', env1);
      assert.ok(env1.attrs, 'env1.attrs should exist');
      assert.ok(env1.attrs['title'], 'env1 should have "title" key');

      // second render with fresh env
      const env2: any = { absPath: '/tests/fixtures/doc2.md' };
      const html2: string = md.render(':author::Jane Doe\n', env2);
      assert.ok(env2.attrs, 'env2.attrs should exist');
      assert.ok(env2.attrs['author'], 'env2 should have "author" key');
      assert.strictEqual(env2.attrs['title'], undefined, 'env2 should NOT have "title" from env1');
    });

    it('env from first render should remain unchanged after second render', () => {
      const env1: any = { absPath: '/tests/fixtures/doc1.md' };
      md.render(':color::blue\n', env1);
      const env1Snapshot = JSON.parse(JSON.stringify(env1.attrs));

      const env2: any = { absPath: '/tests/fixtures/doc2.md' };
      md.render(':color::red\n:size::large\n', env2);

      // env1 should still only have its original attrs
      assert.deepStrictEqual(env1.attrs, env1Snapshot, 'env1 attrs should be unchanged after second render');
      // env2 should have its own attrs
      assert.ok(env2.attrs['size'], 'env2 should have "size" key');
    });

  });

});
