// Public entry point: re-exports the individual modules and defines the
// end-to-end convert() used by the app.

export { PATTERNS } from './patterns.js'
export { intToRoman, romanToInt } from './roman.js'
export { parseItems } from './parseItems.js'
export { escapeHTML, buildHTML } from './buildHTML.js'

import { parseItems } from './parseItems.js'
import { buildHTML } from './buildHTML.js'

export function convert(text) {
    const trimmed = text.trim()
    if (!trimmed) return ''
    return buildHTML(parseItems(trimmed))
}
