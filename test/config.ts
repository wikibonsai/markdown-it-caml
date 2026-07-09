import type { WikiRefsOptions } from 'markdown-it-wikirefs';
import { makeMockOptsForRenderOnly as sharedMockOpts } from 'wikirefs-spec';

// Render-only resolvers for the co-registered wikirefs plugin (dual-plugin tests).
// The shared helper in wikirefs-spec is (filename)-only; markdown-it resolvers are
// env-first, so adapt to the (env, filename) signature. caml itself takes NO resolvers
// (it never resolves wikirefs) — these are for the wikirefs plugin only.
export function makeMockWikiRefsOpts(): Partial<WikiRefsOptions> {
  const shared = sharedMockOpts();
  return {
    resolveHtmlText: (_env: any, filename: string): (string | undefined) => shared.resolveHtmlText(filename),
    resolveHtmlHref: (_env: any, filename: string): (string | undefined) => shared.resolveHtmlHref(filename),
  };
}
