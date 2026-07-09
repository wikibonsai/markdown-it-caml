import assert from 'node:assert/strict';

import type MarkdownIt from 'markdown-it';
import type { CamlValData } from 'caml-mkdn';

import markdown from 'markdown-it';
import caml_plugin from '../src';

import type { CamlTestCase } from 'caml-spec';
import { camlCases, camlWithoutWikiRefsCases } from 'caml-spec';


// caml ALONE (no wikirefs co-registered). caml never resolves wikirefs: a wiki-valued
// attribute renders as a plain string span (<span class="attr string <key>">[[fname]]</span>).
// Runs the shared primitives (camlCases) + the standalone wiki cases
// (camlWithoutWikiRefsCases). The caml + wikirefs setup lives in runner-w-wiki.spec.ts.
let env: any;
let md: MarkdownIt;

function run(contextMsg: string, tests: CamlTestCase[]): void {
  context(contextMsg, () => {
    let i = 0;
    for(const test of tests) {
      const desc: string = `[${('00' + (++i)).slice(-3)}] ` + (test.descr || '');
      it(desc, () => {
        const expdHTML: string = test.html;
        const expdData: CamlValData | undefined = test.data?.parse;
        const actlHTML: string = md.render(test.mkdn, env);
        assert.strictEqual(actlHTML, expdHTML);
        if (expdData !== undefined) {
          assert.deepStrictEqual(env.attrs, expdData);
        }
      });
    }
  });
}

describe('markdown-it-caml: caml standalone (no wikirefs)', () => {

  beforeEach(() => {
    // caml takes no resolvers — it never resolves wikirefs.
    md = markdown().use(caml_plugin, {});
    env = { absPath: '/tests/fixtures/file-with-caml-attrs.md' };
  });

  describe('render', () => {

    run('mkdn -> html', ([] as CamlTestCase[]).concat(camlCases).concat(camlWithoutWikiRefsCases));

  });

  describe('state management', () => {

    it('consecutive renders should not pollute each other\'s attrs', () => {
      const env1: any = { absPath: '/tests/fixtures/doc1.md' };
      const html1: string = md.render(':title::First Document\n', env1);
      assert.ok(env1.attrs, 'env1.attrs should exist');
      assert.ok(env1.attrs['title'], 'env1 should have "title" key');

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

      assert.deepStrictEqual(env1.attrs, env1Snapshot, 'env1 attrs should be unchanged after second render');
      assert.ok(env2.attrs['size'], 'env2 should have "size" key');
    });

  });

});
