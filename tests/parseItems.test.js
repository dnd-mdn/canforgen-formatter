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
    it('treats "i." as alpha (not roman) in isolation to support alphabetic lists', () => {
        const items = parseItems('i. First')
        assert.equal(items[0].key, 'alpha-dot')
        assert.equal(items[0].orderValue, 9)
    })

    it('treats "I." as roman numeral one, not alpha, even in isolation', () => {
        const items = parseItems('I. First')
        assert.equal(items[0].key, 'roman-dot')
        assert.equal(items[0].romanValue, 1)
    })

    it('a run of "ii., iii." stays roman (but single i. is alpha)', () => {
        const items = parseItems('ii. Second\niii. Third')
        assert.ok(items.every(i => i.key === 'roman-lower-dot'))
        assert.deepEqual(items.map(i => i.romanValue), [2, 3])
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
    // A line that fails every marker pattern is never a valid list item, but it's
    // still real document text -- it's kept as its own paragraph rather than
    // silently dropped, the same as any other freeform (non-list) content.
    it('keeps an invalid multi-letter roman numeral as a paragraph (matches no list pattern)', () => {
        const items = parseItems('iix. Bad roman numeral')
        assert.deepEqual(items, [{
            key: 'p', tag: 'p', type: null, level: null, indent: 0,
            romanValue: null, orderValue: null, sectionBreak: false, lang: 'en',
            content: 'iix. Bad roman numeral'
        }])
    })

    it('does not match a two-letter non-roman marker like "aa." as a list item', () => {
        const items = parseItems('aa. Not a valid single-letter marker')
        assert.equal(items.length, 1)
        assert.equal(items[0].tag, 'p')
        assert.equal(items[0].content, 'aa. Not a valid single-letter marker')
    })

    it('requires whitespace after the marker punctuation', () => {
        const items = parseItems('1.NoSpaceAfterDot')
        assert.equal(items.length, 1)
        assert.equal(items[0].tag, 'p')
        assert.equal(items[0].content, '1.NoSpaceAfterDot')
    })

    it('an invalid leading marker line is kept as a paragraph, and continuation lines glue onto it', () => {
        const items = parseItems('iix. Bad roman\nnext line text')
        assert.equal(items.length, 1)
        assert.equal(items[0].tag, 'p')
        assert.equal(items[0].content, 'iix. Bad roman next line text')
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

    it('keeps a plain paragraph with no markers as a single paragraph block', () => {
        const items = parseItems('Just a paragraph\nwith no markers')
        assert.equal(items.length, 1)
        assert.equal(items[0].tag, 'p')
        assert.equal(items[0].content, 'Just a paragraph with no markers')
    })
})

describe('parseItems: header/label paragraphs are preserved, not dropped', () => {
    it('keeps a leading message header line as its own paragraph before the first list', () => {
        const items = parseItems('CANFORGEN 1/26 XXX 001/26 011200Z JAN 26\n\n1. First point.\n2. Second point.')
        assert.equal(items.length, 3)
        assert.equal(items[0].tag, 'p')
        assert.equal(items[0].content, 'CANFORGEN 1/26 XXX 001/26 011200Z JAN 26')
        assert.equal(items[1].key, 'num-dot')
        assert.equal(items[1].content, 'First point.')
    })

    it('splits two leading paragraphs separated by a blank line into separate <p> blocks', () => {
        const items = parseItems('CANFORGEN 1/26 XXX 001/26 011200Z JAN 26\n\nRefs:\n\nA. First ref')
        assert.equal(items.length, 3)
        assert.deepEqual(items.map(i => i.tag), ['p', 'p', 'ol'])
        assert.equal(items[0].content, 'CANFORGEN 1/26 XXX 001/26 011200Z JAN 26')
        assert.equal(items[1].content, 'Refs:')
        assert.equal(items[2].key, 'ALPHA-dot')
    })

    it('merges a paragraph split across lines by a docx soft line break (no blank line) into one block', () => {
        const items = parseItems('First line of header\nsecond line, same paragraph')
        assert.equal(items.length, 1)
        assert.equal(items[0].tag, 'p')
        assert.equal(items[0].content, 'First line of header second line, same paragraph')
    })

    it('does not glue a trailing paragraph onto a preceding list item across a section break', () => {
        const items = parseItems('1. First\nEnd of English text//le texte français suit\nTitre français\nA. Second')
        assert.equal(items.length, 2)
        assert.equal(items[0].content, 'First')
        assert.equal(items[1].content, 'Second')
    })
})

describe('parseItems: alphabetic lists with ambiguous single letters', () => {
    it('parses a lowercase alphabetic list from a through i (dot)', () => {
        const items = parseItems('a. First\nb. Second\nc. Third\nd. Fourth\ne. Fifth\nf. Sixth\ng. Seventh\nh. Eighth\ni. Ninth')
        assert.equal(items.length, 9)
        assert.ok(items.every(i => i.key === 'alpha-dot'), 'all items should be alpha-dot, not roman')
        assert.deepEqual(items.map(i => i.orderValue), [1, 2, 3, 4, 5, 6, 7, 8, 9])
        assert.deepEqual(items.map(i => i.content), ['First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth'])
    })

    it('parses a lowercase alphabetic list from a through i (rparen)', () => {
        const items = parseItems('a) First\nb) Second\nc) Third\nd) Fourth\ne) Fifth\nf) Sixth\ng) Seventh\nh) Eighth\ni) Ninth')
        assert.equal(items.length, 9)
        assert.ok(items.every(i => i.key === 'alpha-rparen'), 'all items should be alpha-rparen, not roman')
        assert.deepEqual(items.map(i => i.orderValue), [1, 2, 3, 4, 5, 6, 7, 8, 9])
    })

    it('parses an uppercase alphabetic list from A through H (dot); uppercase I is always roman', () => {
        const items = parseItems('A. First\nB. Second\nC. Third\nD. Fourth\nE. Fifth\nF. Sixth\nG. Seventh\nH. Eighth')
        assert.equal(items.length, 8)
        assert.ok(items.every(i => i.key === 'ALPHA-dot'), 'A-H should all be ALPHA-dot')
        assert.deepEqual(items.map(i => i.orderValue), [1, 2, 3, 4, 5, 6, 7, 8])

        // Uppercase I is unambiguous roman, even in alphabetic context
        const withI = parseItems('A. First\nB. Second\nI. Roman One')
        assert.equal(withI[0].key, 'ALPHA-dot')
        assert.equal(withI[1].key, 'ALPHA-dot')
        assert.equal(withI[2].key, 'roman-dot', 'uppercase I is always treated as roman')
        assert.equal(withI[2].romanValue, 1)
    })

    it('parses an uppercase alphabetic list from A through H (rparen)', () => {
        const items = parseItems('A) First\nB) Second\nC) Third\nD) Fourth\nE) Fifth\nF) Sixth\nG) Seventh\nH) Eighth')
        assert.equal(items.length, 8)
        assert.ok(items.every(i => i.key === 'ALPHA-rparen'), 'A-H should all be ALPHA-rparen')
        assert.deepEqual(items.map(i => i.orderValue), [1, 2, 3, 4, 5, 6, 7, 8])
    })

    it('handles lowercase v in alphabetic context (should be alpha)', () => {
        const items = parseItems('a. First\nb. Second\nc. Third\nd. Fourth\ne. Fifth\nf. Sixth\ng. Seventh\nh. Eighth\ni. Ninth\nj. Tenth\nk. Eleventh\nl. Twelfth\nm. Thirteenth\nn. Fourteenth\no. Fifteenth\np. Sixteenth\nq. Seventeenth\nr. Eighteenth\ns. Nineteenth\nt. Twentieth\nu. Twenty-first\nv. Twenty-second')
        assert.equal(items.length, 22)
        const vItem = items.find(i => i.orderValue === 22)
        assert.equal(vItem.key, 'alpha-dot', 'v should be treated as alpha letter, not roman')
        assert.equal(vItem.content, 'Twenty-second')
    })

    it('handles lowercase x in alphabetic context (should be alpha)', () => {
        const items = parseItems('a) letter a\nb) letter b\nc) letter c\nd) letter d\ne) letter e\nf) letter f\ng) letter g\nh) letter h\ni) letter i\nj) letter j\nk) letter k\nl) letter l\nm) letter m\nn) letter n\no) letter o\np) letter p\nq) letter q\nr) letter r\ns) letter s\nt) letter t\nu) letter u\nv) letter v\nw) letter w\nx) letter x')
        assert.equal(items.length, 24)
        const xItem = items.find(i => i.orderValue === 24)
        assert.equal(xItem.key, 'alpha-rparen', 'x should be treated as alpha letter, not roman')
        assert.equal(xItem.content, 'letter x')
    })

    it('disambiguates: single "i." in isolation is treated as alpha to support alphabetic lists', () => {
        // Lowercase 'i' in isolation defaults to alpha (the 9th letter), not roman.
        // If you need lowercase roman numerals, use multi-letter forms like "ii." or uppercase "I."
        const items = parseItems('i. First item')
        assert.equal(items[0].key, 'alpha-dot')
        assert.equal(items[0].orderValue, 9)
    })

    it('disambiguates: single "v." in isolation should default to alpha (no prior roman context)', () => {
        // "v." alone is ambiguous but with proper parsing it should still match alpha pattern
        const items = parseItems('v. Single item')
        assert.equal(items[0].key, 'alpha-dot')
        assert.equal(items[0].orderValue, 22)
    })

    it('early alphabet letters that double as roman numerals (c, d) stay alpha in sequences', () => {
        // c = 100 in roman, 3rd letter; d = 500 in roman, 4th letter
        // In alphabetic context, they should remain alphabetic
        const items = parseItems('a. First\nb. Second\nc. Third\nd. Fourth\ne. Fifth')
        assert.equal(items.length, 5)
        assert.deepEqual(items.map(i => i.key), ['alpha-dot', 'alpha-dot', 'alpha-dot', 'alpha-dot', 'alpha-dot'])
        assert.deepEqual(items.map(i => i.orderValue), [1, 2, 3, 4, 5])
    })

    it('later alphabet letters that double as roman numerals (l, m) stay alpha in sequences', () => {
        // l = 50 in roman, 12th letter; m = 1000 in roman, 13th letter
        const items = parseItems('j. Tenth\nk. Eleventh\nl. Twelfth\nm. Thirteenth\nn. Fourteenth')
        assert.equal(items.length, 5)
        assert.ok(items.every(i => i.key === 'alpha-dot'))
        assert.deepEqual(items.map(i => i.orderValue), [10, 11, 12, 13, 14])
    })

    it('parenthesized ambiguous letters are clearly alpha, never roman', () => {
        const items = parseItems('(a) First\n(b) Second\n(c) Third\n(d) Fourth\n(l) Twelfth\n(m) Thirteenth')
        assert.equal(items.length, 6)
        assert.ok(items.every(i => i.key === 'alpha-paren'))
        assert.deepEqual(items.map(i => i.orderValue), [1, 2, 3, 4, 12, 13])
    })

    it('mixed dot and rparen for ambiguous letters stays alpha', () => {
        const items = parseItems('a. First\nb) Second\nc. Third\nd) Fourth\nl. Twelfth\nm) Thirteenth')
        assert.equal(items.length, 6)
        assert.deepEqual(items.map(i => i.key), ['alpha-dot', 'alpha-rparen', 'alpha-dot', 'alpha-rparen', 'alpha-dot', 'alpha-rparen'])
    })

    it('ambiguous letters preceded by clear multi-letter roman stay roman', () => {
        // If we start with a valid multi-letter roman like "xl" (40), then single "l" continues as roman
        const items = parseItems('xl. Forty\nli. Fifty-one')
        assert.equal(items[0].key, 'roman-lower-dot')
        assert.equal(items[0].romanValue, 40)
        // "li" is multi-letter, so it's definitely roman
        assert.equal(items[1].key, 'roman-lower-dot')
        assert.equal(items[1].romanValue, 51)
    })
})

describe('parseItems: alphabetic list overflow past z (aa, ab, ...)', () => {
    it('continues a lowercase alpha list past z into aa, ab (dot)', () => {
        const items = parseItems('x. Item x\ny. Item y\nz. Item z\naa. Item aa\nab. Item ab')
        assert.equal(items.length, 5)
        assert.ok(items.every(i => i.key === 'alpha-dot'), 'aa./ab. should stay alpha-dot, not be dropped')
        assert.deepEqual(items.map(i => i.orderValue), [24, 25, 26, 27, 28])
        assert.deepEqual(items.map(i => i.content), ['Item x', 'Item y', 'Item z', 'Item aa', 'Item ab'])
    })

    it('continues a lowercase alpha list past z into aa, ab (rparen)', () => {
        const items = parseItems('y) Item y\nz) Item z\naa) Item aa\nab) Item ab')
        assert.ok(items.every(i => i.key === 'alpha-rparen'))
        assert.deepEqual(items.map(i => i.orderValue), [25, 26, 27, 28])
    })

    it('continues an uppercase alpha list past Z into AA, AB', () => {
        const items = parseItems('Y. Item Y\nZ. Item Z\nAA. Item AA\nAB. Item AB')
        assert.ok(items.every(i => i.key === 'ALPHA-dot'))
        assert.deepEqual(items.map(i => i.orderValue), [25, 26, 27, 28])
    })

    it('continues a parenthesized alpha list past z into (aa), (ab)', () => {
        const items = parseItems('(y) Item y\n(z) Item z\n(aa) Item aa\n(ab) Item ab')
        assert.ok(items.every(i => i.key === 'alpha-paren'))
        assert.deepEqual(items.map(i => i.orderValue), [25, 26, 27, 28])
    })

    it('does not treat an ordinary lowercase word ending a sentence as an overflow marker', () => {
        const items = parseItems('a. First item\nb. Second item\nalso. this is prose, not a list marker.')
        assert.equal(items.length, 2)
        assert.equal(items[1].content, 'Second item also. this is prose, not a list marker.')
    })

    it('does not treat a multi-letter marker as overflow when it does not continue the sequence', () => {
        // "z." is the 26th letter; "ac." would be the 29th, skipping 27 (aa) and 28 (ab),
        // so it is not a valid continuation and should not be recognized as a marker.
        const items = parseItems('z. Item z\nac. Not a valid continuation')
        assert.equal(items.length, 1)
        assert.equal(items[0].content, 'Item z ac. Not a valid continuation')
    })

    it('continues an alpha overflow sequence through two-letter markers built purely from roman-charset letters', () => {
        // "z." (26) is followed by two-letter markers like "aa." (27) through "cc." (81).
        // "cc.", "cl.", "cm.", "dc.", "dd.", "mm.", etc. are also valid multi-letter roman
        // numerals, so without a fix they'd be misread as roman and split the list.
        const lines = []
        for (let i = 1; i <= 90; i++) {
            let s = ''
            let n = i
            while (n > 0) { const rem = (n - 1) % 26; s = String.fromCharCode(97 + rem) + s; n = Math.floor((n - 1) / 26) }
            lines.push(`${s}. Item ${i}`)
        }
        const items = parseItems(lines.join('\n'))
        assert.equal(items.length, 90)
        assert.ok(items.every(i => i.key === 'alpha-dot'), 'the whole list should stay alpha-dot, not split into roman sublists')
        assert.deepEqual(items.map(i => i.orderValue), Array.from({ length: 90 }, (_, i) => i + 1))
    })

    it('a lone two-letter roman-charset marker with no preceding alpha context is still read as roman', () => {
        const items = parseItems('cc. Two hundred')
        assert.equal(items[0].key, 'roman-lower-dot')
        assert.equal(items[0].romanValue, 200)
    })

    it('continues an overflow sequence across dot/rparen style, like roman numerals do', () => {
        const items = parseItems('z) Item z\naa. Item aa')
        assert.equal(items.length, 2)
        assert.equal(items[0].key, 'alpha-rparen')
        assert.equal(items[1].key, 'alpha-dot')
        assert.equal(items[1].orderValue, 27)
        assert.equal(items[1].content, 'Item aa')
    })
})

describe('parseItems: inline reference-label markers', () => {
    it('splits "References: A. text" so A. is recognized as a list item, keeping the label as a paragraph', () => {
        const items = parseItems('References: A. First ref\nB. Second ref')
        assert.equal(items.length, 3)
        assert.deepEqual(items.map(i => i.tag), ['p', 'ol', 'ol'])
        assert.equal(items[0].content, 'References:')
        assert.deepEqual(items.slice(1).map(i => i.key), ['ALPHA-dot', 'ALPHA-dot'])
        assert.deepEqual(items.slice(1).map(i => i.content), ['First ref', 'Second ref'])
    })

    it('recognizes REFS:, Ref:, and Refs: as the same label', () => {
        assert.equal(parseItems('REFS: A. x')[1].key, 'ALPHA-dot')
        assert.equal(parseItems('Ref: A. x')[1].key, 'ALPHA-dot')
        assert.equal(parseItems('Refs: A. x')[1].key, 'ALPHA-dot')
    })

    it('recognizes accented French label variants (Référence(s):, Réf(s):)', () => {
        assert.equal(parseItems('Référence: A. x')[1].key, 'ALPHA-dot')
        assert.equal(parseItems('Références: A. x')[1].key, 'ALPHA-dot')
        assert.equal(parseItems('Réf: A. x')[1].key, 'ALPHA-dot')
        assert.equal(parseItems('Réfs: A. x')[1].key, 'ALPHA-dot')
    })

    it('keeps an unlabeled line with a colon before it as a paragraph, unaffected by reference-splitting', () => {
        const items = parseItems('Note: see A. below for details')
        assert.equal(items.length, 1)
        assert.equal(items[0].tag, 'p')
        assert.equal(items[0].content, 'Note: see A. below for details')
    })
})

describe('parseItems: bilingual section break', () => {
    it('marks the next item after "End of English text//..." with sectionBreak', () => {
        const items = parseItems('1. First\nEnd of English text//le texte français suit\nA. Second')
        assert.equal(items.length, 2)
        assert.equal(items[0].sectionBreak, false)
        assert.equal(items[1].sectionBreak, true)
    })

    it('recognizes the reversed French-first separator too', () => {
        const items = parseItems('1. Premier\nFin du texte français//English text follows\nA. Second')
        assert.equal(items[1].sectionBreak, true)
    })

    it('drops unmatched lines between the separator and the next marker instead of gluing them', () => {
        const items = parseItems('1. First\nEnd of English text//le texte français suit\nTitre français\nA. Second')
        assert.equal(items.length, 2)
        assert.equal(items[0].content, 'First')
        assert.equal(items[1].content, 'Second')
    })

    it('does not treat an ordinary line mentioning both languages as a break', () => {
        const items = parseItems('1. This message is in english and français both')
        assert.equal(items.length, 1)
        assert.equal(items[0].sectionBreak, false)
    })

    it('defaults to English when there is no language break in the document', () => {
        const items = parseItems('1. First\n2. Second')
        assert.ok(items.every(i => i.lang === 'en'))
    })

    it('switches items to French after "End of English text//...suit"', () => {
        const items = parseItems('1. English\nEnd of English text//le texte français suit\n1. French')
        assert.equal(items[0].lang, 'en')
        assert.equal(items[1].lang, 'fr')
    })

    it('switches items back to English after "Fin du texte français//...follows"', () => {
        const items = parseItems(
            '1. English one\n' +
            'End of English text//le texte français suit\n' +
            '1. French one\n' +
            'Fin du texte français//English text follows\n' +
            '1. English two'
        )
        assert.equal(items[0].lang, 'en')
        assert.equal(items[1].lang, 'fr')
        assert.equal(items[2].lang, 'en')
    })

    it('treats a run of 3+ blank lines as an implicit language break', () => {
        const items = parseItems('1. English\n\n\n\n1. French')
        assert.equal(items[0].lang, 'en')
        assert.equal(items[0].sectionBreak, false)
        assert.equal(items[1].lang, 'fr')
        assert.equal(items[1].sectionBreak, true)
    })

    it('does not treat a single blank line (the normal item gap) as a language break', () => {
        const items = parseItems('1. First\n\n2. Second')
        assert.equal(items[1].sectionBreak, false)
        assert.equal(items[1].lang, 'en')
    })

    it('does not treat two blank lines as a language break', () => {
        const items = parseItems('1. First\n\n\n2. Second')
        assert.equal(items[1].sectionBreak, false)
        assert.equal(items[1].lang, 'en')
    })

    it('toggles back and forth across multiple blank-run breaks', () => {
        const items = parseItems('1. English\n\n\n\n1. French\n\n\n\n1. English again')
        assert.deepEqual(items.map(i => i.lang), ['en', 'fr', 'en'])
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
