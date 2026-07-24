import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseItems } from '../src/parseItems.js'
import { buildHTML } from '../src/buildHTML.js'
import { convert } from '../src/canforgen.js'

describe('convert', () => {
    it('returns an empty string for blank input', () => {
        assert.equal(convert('   \n  '), '')
    })

    it('returns an empty string when nothing in the input matches a list pattern', () => {
        assert.equal(convert('Just a paragraph\nwith no markers'), '')
    })

    it('produces the same result as parseItems + buildHTML', () => {
        const text = '1. First\n2. Second\n   a. Nested'
        assert.equal(convert(text), buildHTML(parseItems(text)))
    })

    it('handles a realistic multi-level CANFORGEN-style list', () => {
        const text = [
            '1. Purpose',
            '2. Details',
            '   a. Sub-point one',
            '   b. Sub-point two',
            '      ii. Deep point',
            '3. Summary',
        ].join('\n')
        const html = convert(text)
        assert.ok(html.includes('<ol>'))
        assert.ok(html.includes('<ol type="a">'))
        assert.ok(html.includes('<ol type="i">'))
        assert.ok(html.includes('Purpose'))
        assert.ok(html.includes('Deep point'))
        assert.equal((html.match(/<ol/g) || []).length, (html.match(/<\/ol>/g) || []).length)
        assert.equal((html.match(/<li>/g) || []).length, (html.match(/<\/li>/g) || []).length)
    })

    it('trims surrounding whitespace before parsing', () => {
        assert.equal(convert('\n\n  1. First\n2. Second\n\n'), convert('1. First\n2. Second'))
    })
})
