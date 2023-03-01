import { CamlOptions } from '../src/types';

// types

export interface TestCase {
  descr: string,               // test description
  error?: boolean,             // test reflects an error state
  opts?: Partial<CamlOptions>, // plugin options
  mkdn: string,                // markdown input
  html: string,                // html output
  data: any,                   // data payload
}
