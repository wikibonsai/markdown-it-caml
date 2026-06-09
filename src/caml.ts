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
    // LINE.KEY uses restrictive value pattern (excludes brackets) to avoid
    // swallowing typed wikilinks like ':linktype::[[target]].'
    // Fallback: if LINE.KEY fails, try permissive match for wiki values,
    // but reject if there's content after ']]' (typed wikilink indicator)
    let lineOneMatch: RegExpExecArray | null = CAML.RGX.LINE.KEY.exec(chunk);
    if (lineOneMatch === null) {
      const permissive: RegExp = new RegExp(
        '^' + CAML.RGX.MARKER.KEY_PRFX.source + '?'
        + '(' + CAML.RGX.VALID_CHARS.KEY.source + ')'
        + CAML.RGX.MARKER.COL.source
        + '(' + CAML.RGX.VALID_CHARS.VAL.source + ')?'
        + '$', 'im'
      );
      lineOneMatch = permissive.exec(chunk);
      if (lineOneMatch === null) {
        return false;
      }
      // reject typed wikilinks: value has content after ']]'
      const val: string | undefined = lineOneMatch[2];
      if (val && /\]\][^\],]/.test(val)) {
        return false;
      }
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

    // helper: collect multi-line block continuation lines and build CamlValData
    function collectMultiLineBlock(indicator: string, prefix: string): CamlValData {
      const blockLines: string[] = [];
      // collect continuation lines: indented or empty
      while ((startLine + iterLine) < endLine) {
        const contPos: number = state.bMarks[startLine + iterLine];
        const contMax: number = state.eMarks[startLine + iterLine];
        const contLine: string = state.src.substring(contPos, contMax);
        // empty line is part of block
        if (contLine.trim() === '') {
          blockLines.push(contLine);
          iterLine += 1;
          continue;
        }
        // indented line is part of block
        if (/^\s/.test(contLine)) {
          blockLines.push(contLine);
          iterLine += 1;
          continue;
        }
        // non-empty, non-indented line ends the block
        break;
      }
      const blockContent: string = blockLines.join('\n');
      // for keep mode (+), include trailing blank lines in the raw block
      const hasTrailingBlank: boolean = (blockLines.length > 0 && blockLines[blockLines.length - 1].trim() === '');
      const isKeepMode: boolean = indicator.endsWith('+');
      const rawBlock: string = prefix + indicator + '\n' + blockContent + (isKeepMode && hasTrailingBlank ? '\n' : '');
      // use CAML.load on the full attr line to get the correctly processed value
      // include trailing newline if block ended with an empty line to preserve
      // trailing newline semantics for folded/literal mode
      const trailingNewline: boolean = !isKeepMode && (blockLines.length > 0 && blockLines[blockLines.length - 1] === '');
      const fullAttrLine: string = ':' + key + '::' + rawBlock + (trailingNewline ? '\n' : '');
      const loadResult: any = CAML.load(fullAttrLine);
      const processedValue: string = (loadResult && loadResult.data && loadResult.data[key] !== undefined)
        ? String(loadResult.data[key])
        : '';
      return {
        type: 'string',
        string: rawBlock,
        value: processedValue,
      };
    }

    const MULTILINE_RGX: RegExp = new RegExp('^' + CAML.RGX.MARKER.MLINE_STR.source + '$');

    // values
    //   - multi-line string (folded >, literal |, chomped >-, >|)
    if ((value !== '') && (value !== null) && (value !== undefined) && MULTILINE_RGX.test(value.trim())) {
      iterLine += 1;
      const typedItem: CamlValData = collectMultiLineBlock(value.trim(), ' ');
      curAttrItems.push(typedItem as any);
    //   - single/comma-separated list
    } else if ((value !== '') && (value !== null) && (value !== undefined)) {
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
      // last value: check if it's a multi-line indicator
      const lastVal: string = curVal.trim();
      if (MULTILINE_RGX.test(lastVal)) {
        // collect multi-line block for the last comma-separated item
        const typedItem: CamlValData = collectMultiLineBlock(lastVal, '');
        curAttrItems.push(typedItem as any);
      } else {
        curAttrItems.push(lastVal);
      }
    //   - mkdn-separated list
    } else {
      // loop through each markdown-style list item
      // do-while: https://stackoverflow.com/a/6323598
      do {
        // increment
        iterLine += 1;
        if ((startLine + iterLine) >= endLine) { m = null; break; }
        pos = state.bMarks[startLine + iterLine];
        max = state.eMarks[startLine + iterLine];
        const thisChunk: string = state.src.substring(pos, max);
        m = CAML.RGX.LINE.LIST_ITEM.exec(thisChunk);
        if (m !== null) {
          // m[0]: full match;
          // m[1]: bullet type;
          // m[2]: filename / value
          const listItemVal: string = m[2];
          if (MULTILINE_RGX.test(listItemVal.trim())) {
            // next line starts continuation block
            iterLine += 1;
            const typedItem: CamlValData = collectMultiLineBlock(listItemVal.trim(), '');
            curAttrItems.push(typedItem as any);
          } else {
            curAttrItems.push(listItemVal);
          }
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
      const resolvedItems: CamlValData[] = [];
      for (const attrItem of curAttrItems) {
        // multi-line items are already resolved
        if (typeof attrItem === 'object' && attrItem !== null && 'type' in attrItem) {
          resolvedItems.push(attrItem);
        } else {
          const typedItem: CamlValData = CAML.resolve(attrItem);
          resolvedItems.push(typedItem);
        }
      }
      for (const item of resolvedItems) {
        state.env.attrs[key].push(item);
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
        let tokItem: Token;
        // if markdown-it-wikirefs is installed and item is wiki type,
        // use wikiattr_val token so wikirefs can render it
        if (item.type === 'wiki' && md.renderer.rules.wikiattr_val) {
          tokItem = new state.Token('wikiattr_val', '', 1);
          const filename: string | undefined = item.value;
          if (!filename) { continue; }
          tokItem.attrSet('key', key);
          tokItem.attrSet('val', filename);
        } else {
          tokItem = new state.Token('attr_val', '', 1);
          tokItem.attrSet('key', key);
          tokItem.attrSet('type', item.type);
          // for multi-line strings, use 'value' (the processed/joined text)
          // for all other items, use 'string' (the raw display text)
          if (item.type === 'string' && item.string && item.string.includes('\n')) {
            tokItem.attrSet('val', String(item.value));
          } else {
            tokItem.attrSet('val', item.string);
          }
        }
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
      const strValue: string | null = token.attrGet('val');
      const keySlug: string = key ? key.trim().toLowerCase().replace(/ /g, '-').replace(/[^\w-]+/g, '') : '';
      // convert newlines to <br> for proper HTML rendering of multi-line values
      const displayValue: string = strValue ? strValue.replace(/\n/g, '<br>') : '';
      const rendered: string = `<span class="${opts.cssNames.attr} ${valType} ${keySlug}">${displayValue}</span>`;
      return `<dd>${rendered}</dd>\n`;
    }
  }

  /* eslint-disable-next-line @typescript-eslint/no-unused-vars */
  function attr_close(tokens: Token[], index: number, mdOpts: MarkdownIt.Options, env?: any): string {
    delete env.cur_attr_key;
    return '</dl>\n</aside>\n';
  }
};
