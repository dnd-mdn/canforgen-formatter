import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { parseItems } from '../src/parseItems.js'
import { buildHTML } from '../src/buildHTML.js'

describe('buildHTML: basic structure', () => {
    it('returns an empty string for no items', () => {
        assert.equal(buildHTML([]), '')
    })

    it('builds a simple ordered list', () => {
        const html = buildHTML(parseItems('1. First\n2. Second'))
        assert.equal(html, '<ol>\n  <li>First\n  </li>\n  <li>Second\n  </li>\n</ol>')
    })

    it('builds a simple unordered list', () => {
        const html = buildHTML(parseItems('- One\n- Two'))
        assert.equal(html, '<ul>\n  <li>One\n  </li>\n  <li>Two\n  </li>\n</ul>')
    })

    it('applies a type attribute for non-numeric ordered lists', () => {
        const html = buildHTML(parseItems('a. One\nb. Two'))
        assert.match(html, /<ol type="a">/)
    })

    it('omits the type attribute for numeric ordered lists', () => {
        const html = buildHTML(parseItems('1. One\n2. Two'))
        assert.ok(!html.includes('type='))
    })

    it('never emits a type="null" attribute for bullet lists', () => {
        const html = buildHTML(parseItems('- One\n- Two'))
        assert.ok(!html.includes('type='))
    })

    it('escapes HTML-special characters in item content', () => {
        const html = buildHTML(parseItems('1. A <b>bold</b> & risky item'))
        assert.ok(html.includes('A &lt;b&gt;bold&lt;/b&gt; &amp; risky item'))
    })
})

describe('buildHTML: alphabetic list overflow past z', () => {
    it('keeps items continuing past z (aa, ab) in a single ol, letting the browser render the counters', () => {
        const html = buildHTML(parseItems('x. Item x\ny. Item y\nz. Item z\naa. Item aa\nab. Item ab'))
        assert.equal((html.match(/<ol/g) || []).length, 1)
        assert.equal((html.match(/<li>/g) || []).length, 5)
        assert.match(html, /<ol type="a">/)
        assert.equal(
            html,
            '<ol type="a">\n' +
            '  <li>Item x\n' +
            '  </li>\n' +
            '  <li>Item y\n' +
            '  </li>\n' +
            '  <li>Item z\n' +
            '  </li>\n' +
            '  <li>Item aa\n' +
            '  </li>\n' +
            '  <li>Item ab\n' +
            '  </li>\n' +
            '</ol>'
        )
    })
})

describe('buildHTML: nesting by indentation', () => {
    it('nests a lettered list inside a numbered item via indentation', () => {
        const html = buildHTML(parseItems('1. Top\n   a. Nested\n2. Top two'))
        assert.ok(html.includes('<ol>\n  <li>Top\n    <ol type="a">\n      <li>Nested\n      </li>\n    </ol>\n  </li>\n  <li>Top two'))
    })

    it('supports three levels of indentation-based nesting', () => {
        const html = buildHTML(parseItems('1. A\n   a. B\n      ii. C\n2. D'))
        assert.equal(
            html,
            '<ol>\n' +
            '  <li>A\n' +
            '    <ol type="a">\n' +
            '      <li>B\n' +
            '        <ol type="i">\n' +
            '          <li>C\n' +
            '          </li>\n' +
            '        </ol>\n' +
            '      </li>\n' +
            '    </ol>\n' +
            '  </li>\n' +
            '  <li>D\n' +
            '  </li>\n' +
            '</ol>'
        )
    })

    it('dedents fully back to the root list from any nesting depth', () => {
        const html = buildHTML(parseItems('1. A\n   a. B\n      i. C\n2. D'))
        assert.equal((html.match(/<ol/g) || []).length, (html.match(/<\/ol>/g) || []).length)
        assert.equal((html.match(/<li>/g) || []).length, (html.match(/<\/li>/g) || []).length)
    })
})

describe('buildHTML: nesting and dedenting by style progression (no indent change)', () => {
    it('nests a lettered list inside a numbered item via style progression alone', () => {
        const html = buildHTML(parseItems('1. Top\na. Nested without indent'))
        assert.match(html, /<ol type="a">/)
        const firstLiClose = html.indexOf('</li>')
        const nestedListOpen = html.indexOf('<ol type="a">')
        assert.ok(nestedListOpen < firstLiClose)
    })

    it('nests a bullet list inside a numbered item via style progression (ul is level 2, same as alpha)', () => {
        const html = buildHTML(parseItems('1. First\n- Bullet item'))
        assert.equal(
            html,
            '<ol>\n' +
            '  <li>First\n' +
            '    <ul>\n' +
            '      <li>Bullet item\n' +
            '      </li>\n' +
            '    </ul>\n' +
            '  </li>\n' +
            '</ol>'
        )
    })

    it('closes the nested list and starts a sibling top-level list when the level decreases without an indent change', () => {
        const html = buildHTML(parseItems('a. Alpha one\n1. Num one'))
        assert.equal(
            html,
            '<ol type="a">\n' +
            '  <li>Alpha one\n' +
            '  </li>\n' +
            '</ol>\n' +
            '<ol>\n' +
            '  <li>Num one\n' +
            '  </li>\n' +
            '</ol>'
        )
    })

    it('nests one level deeper when the style skips a conventional level (1. straight to ii., no a.)', () => {
        const html = buildHTML(parseItems('1. Top\nii. Skips a level'))
        assert.equal(
            html,
            '<ol>\n' +
            '  <li>Top\n' +
            '    <ol type="i">\n' +
            '      <li>Skips a level\n' +
            '      </li>\n' +
            '    </ol>\n' +
            '  </li>\n' +
            '</ol>'
        )
    })

    it('nests one level deeper when the style skips multiple conventional levels (1. straight to (a))', () => {
        const html = buildHTML(parseItems('1. Top\n(a) Skips two levels'))
        assert.equal(
            html,
            '<ol>\n' +
            '  <li>Top\n' +
            '    <ol type="a">\n' +
            '      <li>Skips two levels\n' +
            '      </li>\n' +
            '    </ol>\n' +
            '  </li>\n' +
            '</ol>'
        )
    })

    it('dedents through multiple skipped levels in one step, matching the multi-level nest', () => {
        const html = buildHTML(parseItems('1. Top\n(a) Deep\n1. Back to top'))
        assert.equal((html.match(/<ol/g) || []).length, (html.match(/<\/ol>/g) || []).length)
        assert.ok(html.includes('Back to top'))
        // "Back to top" restarts numbering (order 1 again), so it is a sibling top-level list,
        // not a child of the first.
        assert.equal((html.match(/^<ol>/gm) || []).length, 2)
    })
})

describe('buildHTML: numbering/lettering restart within the same style and indent', () => {
    it('starts a sibling list when numeric numbering restarts', () => {
        const html = buildHTML(parseItems('1. First list item one\n2. First list item two\n1. Second list item one'))
        const matches = html.match(/<ol>/g)
        assert.equal(matches.length, 2)
    })

    it('starts a sibling list when alpha lettering restarts', () => {
        const html = buildHTML(parseItems('a. First\nb. Second\na. Restarted'))
        const matches = html.match(/<ol type="a">/g)
        assert.equal(matches.length, 2)
    })

    it('starts a sibling list when roman numbering restarts', () => {
        const html = buildHTML(parseItems('ii. First\niii. Second\nii. Restarted'))
        const matches = html.match(/<ol type="i">/g)
        assert.equal(matches.length, 2)
    })

    it('does not restart when numbering merely continues to increase', () => {
        const html = buildHTML(parseItems('1. One\n2. Two\n3. Three'))
        const matches = html.match(/<ol>/g)
        assert.equal(matches.length, 1)
    })

    it('scopes restart detection to nested lists independently per parent', () => {
        // Each parent's nested alpha list restarts at "a" without triggering a spurious
        // restart-list split, because the two alpha lists are separate stack frames.
        const html = buildHTML(parseItems('1. A\n   a. A1\n   b. A2\n2. B\n   a. B1'))
        const matches = html.match(/<ol type="a">/g)
        assert.equal(matches.length, 2)
        assert.ok(html.includes('A1'))
        assert.ok(html.includes('B1'))
    })
})

describe('buildHTML: differing marker style at the same depth', () => {
    it('splits into sibling lists when the key differs even if both are numeric (dot vs rparen)', () => {
        const html = buildHTML(parseItems('1. First\n2) Second'))
        const matches = html.match(/<ol>/g)
        assert.equal(matches.length, 2)
    })

    it('merges into a single list when the key matches and a roman sequence continues, even across mixed dot/rparen input styles', () => {
        // parseItems allows the sequence to continue, but buildHTML only merges into one <ol>
        // when the exact pattern key (including punctuation style) matches.
        const sameKeyHtml = buildHTML(parseItems('IV) Fourth\nV) Fifth'))
        assert.equal((sameKeyHtml.match(/<ol type="I">/g) || []).length, 1)

        const differentKeyHtml = buildHTML(parseItems('iv. Fourth\nv) Fifth'))
        assert.equal((differentKeyHtml.match(/<ol type="i">/g) || []).length, 2)
    })

    it('stays sibling (not nested) when two families share the same conventional level', () => {
        // roman (level 3) and num-paren (level 3) are conceptually the same depth,
        // so switching between them is a sibling list, not a level-skip nest.
        const html = buildHTML(parseItems('ii. Roman\n(1) Numparen same level'))
        assert.equal(
            html,
            '<ol type="i">\n' +
            '  <li>Roman\n' +
            '  </li>\n' +
            '</ol>\n' +
            '<ol>\n' +
            '  <li>Numparen same level\n' +
            '  </li>\n' +
            '</ol>'
        )
    })
})

describe('buildHTML: deeply nested lists (4+ levels)', () => {
    it('handles four levels of nesting correctly', () => {
        const html = buildHTML(parseItems('1. Level one\n   a. Level two\n      ii. Level three\n         (1) Level four'))
        // Verify correct nesting structure
        assert.ok(html.includes('<ol>'))
        assert.ok(html.includes('<ol type="a">'))
        assert.ok(html.includes('<ol type="i">'))
        assert.ok(html.includes('<ol>'), 'nested numeric list for level 4')
        // Verify all tags are properly closed
        assert.equal((html.match(/<ol/g) || []).length, (html.match(/<\/ol>/g) || []).length)
        assert.equal((html.match(/<li>/g) || []).length, (html.match(/<\/li>/g) || []).length)
        assert.ok(html.includes('Level one'))
        assert.ok(html.includes('Level four'))
    })

    it('handles five levels of nesting', () => {
        const html = buildHTML(parseItems('1. L1\n   a. L2\n      ii. L3\n         (1) L4\n            A. L5'))
        assert.equal((html.match(/<ol/g) || []).length, (html.match(/<\/ol>/g) || []).length)
        assert.equal((html.match(/<li>/g) || []).length, (html.match(/<\/li>/g) || []).length)
        assert.ok(html.includes('L5'))
    })

    it('properly dedents from deep nesting back to root level', () => {
        const html = buildHTML(parseItems('1. L1\n   a. L2\n      ii. L3\n2. Back to root'))
        // Count <ol> and </ol> - must be equal
        assert.equal((html.match(/<ol/g) || []).length, (html.match(/<\/ol>/g) || []).length)
        // Verify the structure transitions correctly
        assert.ok(html.includes('L3'))
        assert.ok(html.includes('Back to root'))
        // L1 and "Back to root" should be at same level (both in root <ol>)
        const firstLiEnd = html.indexOf('</li>')
        const secondL1Start = html.indexOf('Back to root')
        assert.ok(secondL1Start > firstLiEnd, 'items are in document order')
    })
})

describe('buildHTML: mixed punctuation at same level', () => {
    it('splits into separate lists when numeric dot and rparen mix', () => {
        const html = buildHTML(parseItems('1. Numeric dot\n2) Numeric rparen'))
        const numericDotLists = (html.match(/<ol>/g) || []).length
        assert.equal(numericDotLists, 2, 'should create two separate numeric lists')
    })

    it('splits alpha-dot and alpha-rparen into separate lists at same level', () => {
        const html = buildHTML(parseItems('a. Alpha dot\nb) Alpha rparen'))
        const alphaDotLists = (html.match(/<ol type="a">/g) || []).length
        assert.equal(alphaDotLists, 2, 'should create two separate alpha lists')
    })

    it('splits roman-dot and roman-rparen into separate lists at same level', () => {
        const html = buildHTML(parseItems('ii. Roman dot\niii) Roman rparen'))
        const romanDotLists = (html.match(/<ol type="i">/g) || []).length
        assert.equal(romanDotLists, 2, 'should create two separate roman lists')
    })

    it('creates sibling lists when switching between num-paren and roman at same level', () => {
        const html = buildHTML(parseItems('(1) Numeric paren\nii. Roman'))
        // Both should exist as separate lists
        assert.ok(html.includes('<ol>'), 'numeric list')
        assert.ok(html.includes('<ol type="i">'), 'roman list')
        const matches = html.match(/<\/ol>/g) || []
        assert.ok(matches.length >= 2, 'at least two lists closed')
    })
})

describe('buildHTML: bilingual section break', () => {
    it('flushes an open sub-list back to top level at the section break, even though the marker style would otherwise nest', () => {
        // "1." (level 1) is open with a nested "A." (level 2, indent 0) sub-list, per the normal
        // style-progression rule. After the bilingual separator, the next "A." should NOT nest
        // into that still-open sub-list -- it must start a fresh top-level list.
        const html = buildHTML(parseItems(
            '1. English body\nA. Nested under it normally\n' +
            'End of English text//le texte français suit\n' +
            'A. French reference, should not nest'
        ))
        assert.equal((html.match(/<ol/g) || []).length, (html.match(/<\/ol>/g) || []).length)
        assert.equal((html.match(/^<ol/gm) || []).length, 2, 'the post-break list is a new top-level list, not nested')
        const firstListEnd = html.indexOf('</ol>')
        const secondListStart = html.indexOf('French reference')
        assert.ok(secondListStart > firstListEnd, 'the post-break item comes after the first list is fully closed')
    })
})

describe('buildHTML: indentation edge cases', () => {
    it('handles consistent 3-space indentation', () => {
        const html = buildHTML(parseItems('1. Top\n   a. Nested with 3 spaces'))
        assert.ok(html.includes('Nested with 3 spaces'))
        assert.equal((html.match(/<ol/g) || []).length, (html.match(/<\/ol>/g) || []).length)
    })

    it('handles 4-space indentation (standard)', () => {
        const html = buildHTML(parseItems('1. Top\n    a. Nested with 4 spaces'))
        assert.ok(html.includes('Nested with 4 spaces'))
        assert.equal((html.match(/<ol/g) || []).length, (html.match(/<\/ol>/g) || []).length)
    })

    it('handles tab indentation (counts as 4 spaces)', () => {
        const html = buildHTML(parseItems('1. Top\n\ta. Nested with tab'))
        assert.ok(html.includes('Nested with tab'))
        assert.equal((html.match(/<ol/g) || []).length, (html.match(/<\/ol>/g) || []).length)
    })

    it('handles mixed tabs and spaces for indentation', () => {
        const html = buildHTML(parseItems('1. Top\n\t  a. Nested with tab+spaces'))
        assert.ok(html.includes('Nested with tab+spaces'))
        assert.equal((html.match(/<ol/g) || []).length, (html.match(/<\/ol>/g) || []).length)
    })

    it('treats irregular indentation as same level when indent is 0 or same', () => {
        // Items at indent 2 and 2 should be siblings
        const html = buildHTML(parseItems('  1. Indent 2a\n  2. Indent 2b'))
        assert.ok(html.includes('Indent 2a'))
        assert.ok(html.includes('Indent 2b'))
        const lists = (html.match(/<ol>/g) || []).length
        assert.equal(lists, 1, 'should be one list, not nested')
    })

    it('maintains nesting with varying indentation amounts', () => {
        const html = buildHTML(parseItems('1. Top\n   a. Indent 3\n      ii. Indent 6\n   b. Back to indent 3'))
        assert.ok(html.includes('Indent 3'))
        assert.ok(html.includes('Indent 6'))
        assert.ok(html.includes('Back to indent 3'))
        // Structure should be: one root list, nested alpha, nested roman under first alpha
        assert.equal((html.match(/<ol/g) || []).length, (html.match(/<\/ol>/g) || []).length)
        assert.equal((html.match(/<li>/g) || []).length, (html.match(/<\/li>/g) || []).length)
    })
})
