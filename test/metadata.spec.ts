import assert from 'node:assert/strict';
import sinon from 'sinon';

import type MarkdownIt from 'markdown-it';

import markdown from 'markdown-it';
import caml_plugin from '../src';
// the wikirefs sibling is a devDep for the co-registration (dual) case ONLY. gate on it:
// if it isn't installed, the dual case SKIPS rather than crashing on a missing import.
/* eslint-disable @typescript-eslint/no-var-requires */
let wikirefs_plugin: any;
try { const m = require('markdown-it-wikirefs'); wikirefs_plugin = (m && m.default) || m; } catch { /* sibling absent — dual case skips */ }
/* eslint-enable @typescript-eslint/no-var-requires */
const hasWikirefsSibling: boolean = !!wikirefs_plugin;

import { makeMockWikiRefsOpts } from './config';


let env: any;
let mockOpts: any;
let fakeAddAttr: any;

// metadata: the addAttr() callback. markdown-it-caml's signature is (env, key, value) — env
// is threaded so value-passing works across stages (e.g. recursive embeds). caml reports the
// literal '[[fname]]' as the value; the parsed value carries on env.attrs[key][i]: a plain
// caml value stays type 'string' (value == the literal), and — when a wikirefs sibling is
// co-registered — a wiki value is typed 'wiki' with the resolved target as value ('fname-a').
// See caml-wikiref-handoff.
describe('metadata', () => {

  beforeEach(() => {
    /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
    function mockAddAttr(env: any, key: string, value: string): void { return; }
    mockOpts = {
      fnameFromEnv: () => 'root',
      addAttr: mockAddAttr,
    };
    fakeAddAttr = sinon.replace(mockOpts, 'addAttr', sinon.fake.returns({}));
    env = {};
  });

  afterEach(() => {
    sinon.restore();
  });

  const testMetaData = (params: any) =>
    () => {
      const md: MarkdownIt = params.wikirefs
        ? markdown().use(caml_plugin, mockOpts).use(wikirefs_plugin, makeMockWikiRefsOpts())
        : markdown().use(caml_plugin, mockOpts);
      md.render(params.mkdn, env);
      assert.strictEqual(fakeAddAttr.called, true);
      const args: any[] = fakeAddAttr.getCall(0).args;
      assert.deepStrictEqual(args, [env, ...params.args]);
      // the parsed value (with its resolved wiki target) rides on env
      if (params.envAttr) {
        const parsed: any = args[0].attrs[params.args[0]][0];
        assert.strictEqual(parsed.type, params.envAttr.type);
        assert.strictEqual(parsed.value, params.envAttr.value);
      }
    };

  describe('addAttr()', () => {

    it('primitive; string type', testMetaData({
      mkdn: 'attribute::this-is-a-string\n',
      args: ['attribute', 'this-is-a-string'],
      envAttr: { type: 'string', value: 'this-is-a-string' },
    }));

    it('wiki type; caml alone', testMetaData({
      mkdn: 'attrtype::[[fname-a]]\n',
      args: ['attrtype', '[[fname-a]]'],
      envAttr: { type: 'string', value: '[[fname-a]]' },
    }));

    (hasWikirefsSibling ? it : it.skip)('wiki type; caml + wikirefs', testMetaData({
      wikirefs: true,
      mkdn: 'attrtype::[[fname-a]]\n',
      args: ['attrtype', '[[fname-a]]'],
      envAttr: { type: 'wiki', value: 'fname-a' },
    }));

  });

});
