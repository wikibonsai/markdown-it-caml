import assert from 'node:assert/strict';

import type MarkdownIt from 'markdown-it';

import type { CamlOptions } from '../../src';

import markdown from 'markdown-it';
import caml_plugin from '../../src';

import type { TestCase } from '../types';


// let env: any;
let mockOpts: Partial<CamlOptions>;

function run(contextMsg: string, tests: TestCase[]): void {
  context(contextMsg, () => {
    let i: number = 0;
    for(const test of tests) {
      const desc: string = `[${('00' + (++i)).slice(-3)}] ` + (test.descr || '');
      it(desc, () => {
        const mkdn: string = test.mkdn;
        const expdHtml: string = test.html;
        const md: MarkdownIt = markdown().use(caml_plugin, mockOpts);
        const actlHtml: string = md.render(mkdn);
        assert.strictEqual(actlHtml, expdHtml);
      });
    }
  });
}

describe.skip('configs', () => {

  // todo
  // it('', run('msg', [{
  //   descr: '',
  //   mkdn: '',
  //   html: '',
  //   data: undefined,
  // }]));

});
