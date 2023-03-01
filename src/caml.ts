import type MarkdownIt from 'markdown-it/lib';
import type Token from 'markdown-it/lib/token';
import type StateCore from 'markdown-it/lib/rules_core/state_core';
import type StateBlock from 'markdown-it/lib/rules_block/state_block';

import type { CamlValData } from 'caml-mkdn';
import type { CamlOptions } from './types';

import * as CAML from 'caml-mkdn';


export const caml_attrs = (md: MarkdownIt, opts: CamlOptions): void => {

  // ruler rules //

  // the 'caml' block rule is the parse that drives the markdown-it-caml plugin
  // should execute just before 'markdown-it-wikirefs': 
  // [ ..., 'hr', 'caml', 'wikiattr', 'list', ... ]
  // 
  // note: 'attrs' is added as an extra dummy 'alt' specifically for markdown-it-wikirefs interop
  md.block.ruler.after('hr', 'caml', caml_rule, { alt: ['paragraph', 'attrs'] });  // in case bugs show up: [ 'paragraph', 'reference', 'blockquote', 'list' ]
  // the 'attrbox' rule is the midpoint between the parse and render rules.
  if (opts.attrs.render) {
    md.core.ruler.after('inline', 'attrbox', attrbox);
  }

  // render rules //

  md.renderer.rules.metadata_caml = metadata_caml;
  md.renderer.rules.attr_open     = attr_open;
  md.renderer.rules.attr_key      = attr_key;
  md.renderer.rules.attr_val      = attr_val;
  md.renderer.rules.attr_close    = attr_close;

  // ruler

  function caml_rule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
    // init
    if (!state.env.attrs) { state.env.attrs = {}; }

    // from: https://github.com/markdown-it/markdown-it/blob/df4607f1d4d4be7fdc32e71c04109aea8cc373fa/lib/rules_block/list.js#L132
    // if it's indented more than 3 spaces, it should be a code block
    if (state.sCount[startLine] - state.blkIndent >= 4) { return false; }

    // 'bMarks' = beginning of line markers
    // 'eMarks' = end of line markers
    let pos: number = state.bMarks[startLine];
    let max: number = state.eMarks[startLine];

    // 'attrs' must be at the top-most-level
    // !('list' | 'blockquote' | 'reference' | 'footnote')
    if ((state.parentType !== 'root') && (state.parentType !== 'paragraph')) {
      return false;
    }
    const chunk: string = state.src.substring(pos, max);
    const lineOneMatch: RegExpExecArray | null = CAML.RGX.LINE.KEY.exec(chunk);
    if (lineOneMatch === null) {
      return false;
    }
    // is in a list item
    // note: this is only necessary for unprefixed wikiattrs
    // todo: keep an eye on this...might cause problems...
    if ((lineOneMatch[0].indexOf('- ') === 0)
    || (lineOneMatch[0].indexOf('* ') === 0)
    || (lineOneMatch[0].indexOf('+ ') === 0)
    ) {
      return false;
    }

    // "Don't run any pairs in validation mode":
    // 'silent' is used when this rule is being checked against 
    // in another rule to see whether or not the other rule should 
    // kick out for this (or some other) one. return 'true' to 
    // signify that the kick out should happen.
    if (silent) {
      return true;
    }

    /*
     * handle match and return true
     */
    let iterLine: number = 0;
    let m: RegExpExecArray | null;
    const curAttrItems: string[] = [];

    const key: string = lineOneMatch[1].trim();
    const value: string = lineOneMatch[2];

    // values
    //   - single/comma-separated list
    if ((value !== '') && (value !== null) && (value !== undefined)) {
      iterLine += 1;
      let curVal: string = '';
      let inDoubleQuote: boolean = false;
      let inSingleQuote: boolean = false;
      for (const char of value) {
        // comma separation
        if ((!inDoubleQuote && !inSingleQuote) && (char === ',')) {
          curAttrItems.push(curVal.trim());
          curVal = '';
          continue;
        }
        // quote
        if (/"/.test(char)) {
          inDoubleQuote = !inDoubleQuote;
        }
        if (/'/.test(char)) {
          inSingleQuote = !inSingleQuote;
        }
        // char
        curVal += char;
      }
      // single / last value
      curAttrItems.push(curVal.trim());
    //   - mkdn-separated list
    } else {
      // loop through each markdown-style list item
      // do-while: https://stackoverflow.com/a/6323598
      do {
        // increment
        iterLine += 1;
        pos = state.bMarks[startLine + iterLine];
        max = state.eMarks[startLine + iterLine];
        const thisChunk: string = state.src.substring(pos, max);
        m = CAML.RGX.LINE.LIST_ITEM.exec(thisChunk);
        if (m !== null) {
          // m[0]: full match;
          // m[1]: bullet type;
          // m[2]: filename
          curAttrItems.push(m[2]);
        }
      } while (m);
    }

    // set 'state.env.attrs' to trigger tokens -- if valid.
    if (curAttrItems.length === 0) {
      return false;
    } else {
      // init
      if (!state.env.attrs[key]) { state.env.attrs[key] = []; }
      // prep renderables
      for (const attrItem of curAttrItems) {
        const typedItem: CamlValData = CAML.resolve(attrItem);
        state.env.attrs[key].push(typedItem);
      }
      // metadata
      if (opts.addAttr) {
        const tok: Token = new state.Token('metadata_caml', '', 0);
        state.tokens.push(tok);
        tok.attrSet('key', key);
        tok.attrSet('vals', state.env.attrs[key].map((item: any) => item.string));
      }
      state.line += iterLine;
      return true;
    }
  }

  function attrbox(state: StateCore): void {
    if (!state.env.attrs
    || (JSON.stringify(state.env.attrs) === '{}')
    || (Object.keys(state.env.attrs).length === 0)
    ) {
      return;
    }
    const tokens: Token[] = [];

    // open //

    const tokOpen: Token = new state.Token('attr_open', '', 0);
    // tokOpen.map = [startLine, iterLine];
    tokens.push(tokOpen);

    // body //

    for (const key in state.env.attrs) {
      // key / linktype
      const tokType: Token = new state.Token('attr_key', '', 0);
      tokType.attrSet('key', key);
      tokens.push(tokType);
      // values / items
      for (const item of state.env.attrs[key]) {
        // wikirefs
        // todo: only add token if 'markdown-it-wikirefs' is detected
        let tokItem: Token;
        if (item.type === 'wiki') {
          tokItem = new state.Token('wikiattr_val', '', 1);
          const filename: string | undefined = item.filename;
          if (!filename) { continue; }
          tokItem.attrSet('key', key);
          tokItem.attrSet('val', filename);
        // primitives
        } else {
          tokItem = new state.Token('attr_val', '', 1);
          tokItem.attrSet('key', key);
          tokItem.attrSet('type', item.type);
          tokItem.attrSet('val', item.string);
        } //else {
        // todo: error
        // }
        tokens.push(tokItem);
      }
    }

    // close //

    const tokClose: Token = new state.Token('attr_close', '', 0);
    tokens.push(tokClose);

    // add infobox tokens to **front** of token stream (should occur after flush)
    if (tokens) { state.tokens = tokens.concat(state.tokens); }
  }

  // "render"

  function metadata_caml(tokens: Token[], index: number, mdOpts: MarkdownIt.Options, env?: any): string {
    const token: Token = tokens[index];
    const attrtype: string | null = token.attrGet('key');
    // @ts-expect-error: forcing array -- technically not supposed to, but it works so nicely here (see note above)
    const filenames: string[] | null = token.attrGet('vals');
    if (attrtype && filenames && opts.addAttr) {
      for (const filename of filenames) {
        opts.addAttr(env, attrtype, filename);
      }
    }
    return '';
  }

  // render

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  function attr_open(tokens: Token[], index: number, mdOpts: MarkdownIt.Options, env?: any): string {
    return `<aside class="${opts.cssNames.attrbox}">\n<span class="${opts.cssNames.attrboxTitle}">${opts.attrs.title}</span>\n<dl>\n`;
  }

  // attr : key : attrtype
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  function attr_key(tokens: Token[], index: number, mdOpts: MarkdownIt.Options, env?: any): string {
    const token: Token = tokens[index];
    const key: string | null = token.attrGet('key');
    if (key === null) {
      return '<dt>attr key error</dt>\n';
    } else {
      return `<dt>${key}</dt>\n`;
    }
  }

  // attr : val(s) : item(s)
  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  function attr_val(tokens: Token[], index: number, mdOpts: MarkdownIt.Options, env?: any): string {
    const token: Token = tokens[index];
    // invalid
    if (token === null) {
      return '<dd>attr error</dd>\n';// primitives
    } else {
      const key: string | null = token.attrGet('key');
      const valType: string | null = token.attrGet('type');
      let strValue: string | null = token.attrGet('val');
      // multi-line string
      if (strValue?.includes('\n')) {
        // const newlinesKeep: string = (strValue[0] === '|') ? '\n' : '';
        // const chompKeep: string = (strValue[1] === '-') ? '\n' : '';
        // const strArray: string[] = strValue.split('\n')
        // strValue = strArray.map((line: string) => (line === '') ? '' : `<span>${line}</span>`).join(newlinesKeep).concat(chompKeep);
      // single line
      } else {
        const keySlug: string = key ? key.trim().toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') : '';
        strValue = `<span class="${opts.cssNames.attr} ${valType} ${keySlug}">${strValue}</span>`;
      }
      return `<dd>${strValue}</dd>\n`;
    }
  }

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  function attr_close(tokens: Token[], index: number, mdOpts: MarkdownIt.Options, env?: any): string {
    delete env.cur_attr_key;
    return '</dl>\n</aside>\n';
  }
};
