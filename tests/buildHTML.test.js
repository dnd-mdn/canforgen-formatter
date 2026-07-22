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

describe('buildHTML: nesting by indentation', () => {
    it('nests a lettered list inside a numbered item via indentation', () => {
        const html = buildHTML(parseItems('1. Top\n   a. Nested\n2. Top two'))
        assert.ok(html.includes('<ol>\n  <li>Top\n    <ol type="a">\n      <li>Nested\n      </li>\n    </ol>\n  </li>\n  <li>Top two'))
    })

    it('supports three levels of indentation-based nesting', () => {
        const html = buildHTML(parseItems('1. A\n   a. B\n      i. C\n2. D'))
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

    it('nests one level deeper when the style skips a conventional level (1. straight to i., no a.)', () => {
        const html = buildHTML(parseItems('1. Top\ni. Skips a level'))
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
        const html = buildHTML(parseItems('i. First\nii. Second\ni. Restarted'))
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
        const html = buildHTML(parseItems('i. Roman\n(1) Numparen same level'))
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
