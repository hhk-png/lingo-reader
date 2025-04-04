import type { ParserOptions } from './xml2js-parser'
import { parseStringPromise } from './xml2js-parser'

export async function parsexml(str: string, optionsParserOptions: ParserOptions = {}) {
  const result = await parseStringPromise(str, optionsParserOptions)
  return result
}
