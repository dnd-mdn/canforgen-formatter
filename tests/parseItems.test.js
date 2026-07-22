import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseItems } from '../src/parseItems.js'

describe('parseItems: marker recognition', () => {
    it('parses a flat numbered list (dot)', () => {
        const items = parseItems('1. First\n2. Second\n3. Third')
        assert.deepEqual(items.map(i => i.content), ['First', 'Second', 'Third'])
        assert.ok(items.every(i => i.key === 'num-dot'))
    })

    it('parses numbered lists with rparen markers', () => {
        const items = parseItems('1) First\n2) Second')
        assert.deepEqual(items.map(i => i.orderValue), [1, 2])
        assert.equal(items[0].key, 'num-rparen')
    })

    it('parses lettered lists and computes order from the letter (lowercase dot)', () => {
        const items = parseItems('a. First\nb. Second\nc. Third')
        assert.deepEqual(items.map(i => i.orderValue), [1, 2, 3])
        assert.ok(items.every(i => i.key === 'alpha-dot'))
    })

    it('parses lettered lists with rparen (lowercase)', () => {
        const items = parseItems('a) First\nb) Second')
        assert.ok(items.every(i => i.key === 'alpha-rparen'))
        assert.deepEqual(items.map(i => i.orderValue), [1, 2])
    })

    it('parses uppercase lettered lists distinctly from lowercase (dot)', () => {
        const items = parseItems('A. First\nB. Second')
        assert.ok(items.every(i => i.key === 'ALPHA-dot'))
    })

    it('parses uppercase lettered lists with rparen', () => {
        const items = parseItems('A) First\nB) Second')
        assert.ok(items.every(i => i.key === 'ALPHA-rparen'))
        assert.deepEqual(items.map(i => i.orderValue), [1, 2])
    })

    it('parses roman numerals with rparen (lowercase and uppercase)', () => {
        const lower = parseItems('iv) Fourth\nv) Fifth')
        assert.ok(lower.every(i => i.key === 'roman-lower-rparen'))
        assert.deepEqual(lower.map(i => i.romanValue), [4, 5])

        const upper = parseItems('IV) Fourth\nV) Fifth')
        assert.ok(upper.every(i => i.key === 'roman-rparen'))
        assert.deepEqual(upper.map(i => i.romanValue), [4, 5])
    })

    it('parses parenthesized numeric and alpha markers', () => {
        const items = parseItems('(1) First\n(a) Nested\n(A) Also nested')
        assert.deepEqual(items.map(i => i.key), ['num-paren', 'alpha-paren', 'ALPHA-paren'])
    })

    it('computes orderValue for ALPHA-paren from the letter position', () => {
        const items = parseItems('(A) First\n(B) Second\n(C) Third')
        assert.deepEqual(items.map(i => i.orderValue), [1, 2, 3])
    })

    it('parses bullet lists with -, *, and •, with no order value', () => {
        const items = parseItems('- one\n* two\n• three')
        assert.ok(items.every(i => i.key === 'ul'))
        assert.ok(items.every(i => i.orderValue === null))
        assert.deepEqual(items.map(i => i.content), ['one', 'two', 'three'])
    })
})

describe('parseItems: ambiguous single-letter roman numerals', () => {
    it('treats "i." as roman numeral one, not alpha, even in isolation', () => {
        const items = parseItems('i. First')
        assert.equal(items[0].key, 'roman-lower-dot')
        assert.equal(items[0].romanValue, 1)
    })

    it('treats "I." as roman numeral one, not alpha, even in isolation', () => {
        const items = parseItems('I. First')
        assert.equal(items[0].key, 'roman-dot')
        assert.equal(items[0].romanValue, 1)
    })

    it('a run of "i., ii., iii." stays roman throughout', () => {
        const items = parseItems('i. First\nii. Second\niii. Third')
        assert.ok(items.every(i => i.key === 'roman-lower-dot'))
        assert.deepEqual(items.map(i => i.romanValue), [1, 2, 3])
    })

    it('falls back to alpha for an isolated ambiguous letter like "v." (lowercase)', () => {
        const items = parseItems('v. Fifth item on its own')
        assert.equal(items[0].key, 'alpha-dot')
        assert.equal(items[0].romanValue, null)
        assert.equal(items[0].orderValue, 22)
    })

    it('falls back to alpha for an isolated ambiguous letter like "V." (uppercase)', () => {
        const items = parseItems('V. Fifth item on its own')
        assert.equal(items[0].key, 'ALPHA-dot')
        assert.equal(items[0].romanValue, null)
    })

    it('keeps a single roman letter as roman when it continues a sequence', () => {
        const items = parseItems('iv. Fourth\nv. Fifth')
        assert.equal(items[0].key, 'roman-lower-dot')
        assert.equal(items[1].key, 'roman-lower-dot')
        assert.equal(items[1].romanValue, 5)
    })

    it('continues a roman sequence even across dot/rparen style (parseItems level)', () => {
        const items = parseItems('iv. Fourth\nv) Fifth')
        assert.equal(items[0].key, 'roman-lower-dot')
        assert.equal(items[1].key, 'roman-lower-rparen')
        assert.equal(items[1].romanValue, 5)
    })

    it('does not continue a roman sequence across indentation boundaries', () => {
        // "v." at indent 0 has no prior roman item at indent 0, so it is ambiguous and falls to alpha,
        // even though there is an "iv." at a different indent.
        const items = parseItems('   iv. Fourth\nv. Fifth on its own')
        assert.equal(items[0].key, 'roman-lower-dot')
        assert.equal(items[1].key, 'alpha-dot')
    })

    it('does not continue a roman sequence when the value does not increment by one', () => {
        const items = parseItems('iv. Fourth\nx. Ten, not continuing')
        assert.equal(items[0].key, 'roman-lower-dot')
        // "x." alone is ambiguous and does not follow 4 -> falls back to alpha.
        assert.equal(items[1].key, 'alpha-dot')
    })

    it('treats a multi-letter roman marker as roman regardless of sequence context', () => {
        const items = parseItems('mm. Two thousand')
        assert.equal(items[0].key, 'roman-lower-dot')
        assert.equal(items[0].romanValue, 2000)
    })
})

describe('parseItems: malformed and non-matching markers', () => {
    it('drops an invalid multi-letter roman numeral entirely (matches no pattern)', () => {
        const items = parseItems('iix. Bad roman numeral')
        assert.deepEqual(items, [])
    })

    it('does not match a two-letter non-roman marker like "aa."', () => {
        const items = parseItems('aa. Not a valid single-letter marker')
        assert.deepEqual(items, [])
    })

    it('requires whitespace after the marker punctuation', () => {
        const items = parseItems('1.NoSpaceAfterDot')
        assert.deepEqual(items, [])
    })

    it('an invalid leading marker line is silently dropped, not merged into anything', () => {
        const items = parseItems('iix. Bad roman\nnext line text')
        assert.deepEqual(items, [])
    })
})

describe('parseItems: continuation lines and blank lines', () => {
    it('appends unmatched continuation lines to the previous item', () => {
        const items = parseItems('1. First line\ncontinued text\n2. Second')
        assert.equal(items.length, 2)
        assert.equal(items[0].content, 'First line continued text')
    })

    it('accumulates multiple continuation lines in order', () => {
        const items = parseItems('1. First\nsecond line\nthird line')
        assert.equal(items.length, 1)
        assert.equal(items[0].content, 'First second line third line')
    })

    it('ignores leading blank lines with no prior item', () => {
        const items = parseItems('\n\n1. First')
        assert.equal(items.length, 1)
        assert.equal(items[0].content, 'First')
    })

    it('ignores blank lines between items without altering content or count', () => {
        const items = parseItems('1. First\n\n2. Second')
        assert.equal(items.length, 2)
        assert.equal(items[0].content, 'First')
        assert.equal(items[1].content, 'Second')
    })

    it('returns an empty array for empty input', () => {
        assert.deepEqual(parseItems(''), [])
    })

    it('returns an empty array for a plain paragraph with no markers', () => {
        assert.deepEqual(parseItems('Just a paragraph\nwith no markers'), [])
    })
})

describe('parseItems: indentation and content extraction', () => {
    it('tracks indentation using spaces', () => {
        const items = parseItems('1. Top\n   a. Nested')
        assert.equal(items[0].indent, 0)
        assert.equal(items[1].indent, 3)
    })

    it('tracks indentation using tabs as 4 spaces', () => {
        const items = parseItems('1. Top\n\ta. Nested')
        assert.equal(items[0].indent, 0)
        assert.equal(items[1].indent, 4)
    })

    it('combines mixed tabs and spaces when computing indentation', () => {
        const items = parseItems('1. Top\n\t  a. Nested')
        assert.equal(items[1].indent, 6)
    })

    it('trims leading and trailing whitespace from content', () => {
        const items = parseItems('1.   Item with spaces   ')
        assert.equal(items[0].content, 'Item with spaces')
    })
})
