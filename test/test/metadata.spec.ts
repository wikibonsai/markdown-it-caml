import assert from 'node:assert/strict';
import sinon from 'sinon';

import type MarkdownIt from 'markdown-it';

import markdown from 'markdown-it';
import caml_plugin from '../../src';


let md: MarkdownIt;
let env: any;
let mockOpts: any;
let fakeAddAttr: any;

describe('metadata', () => {

  beforeEach(() => {
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    function mockAddAttr(env: any, key: string, value: string): void { return; }
    mockOpts = {
      fnameFromEnv: () => 'root',
      addAttr: mockAddAttr,
    };
    fakeAddAttr = sinon.replace(mockOpts, 'addAttr', sinon.fake.returns({}));
    md = markdown().use(caml_plugin, mockOpts);
    env = {};
  });

  const testMetaData = (params: any) =>
    () => {
      const mkdn: string = params.mkdn;
      md.render(mkdn, env);
      assert.strictEqual(fakeAddAttr.called, true);
      assert.deepStrictEqual(
        fakeAddAttr.getCall(0).args,
        [env, 'attribute', 'this-is-a-string'],
      );
    };

  describe('', () => {

    it('basic', testMetaData({
      mkdn: 'attribute::this-is-a-string\n',
    }));

  });

});
