import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import JSZip from 'jszip'
import { readZipEntries } from '../src/docx/zip.js'
import { parseNumbering } from '../src/docx/numbering.js'
import { parseParagraphs } from '../src/docx/paragraphs.js'
import { parseRelationships } from '../src/docx/relationships.js'
import { reconstructPlainText } from '../src/docx/reconstruct.js'
import { parseDocxToPlainText } from '../src/docx/index.js'
import { convert } from '../src/canforgen.js'
import { encodeLink, renderContent } from '../src/linkMarker.js'

async function buildZip(files) {
    const zip = new JSZip()
    for (const [name, content] of Object.entries(files)) zip.file(name, content)
    const buffer = await zip.generateAsync({ type: 'nodebuffer' })
    return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length)
}

describe('docx/zip', () => {
    it('reads and decodes a text entry', async () => {
        const zip = await buildZip({ 'hello.txt': 'Hello, world!' })
        const entries = await readZipEntries(zip, ['hello.txt'])
        assert.equal(entries.get('hello.txt'), 'Hello, world!')
    })

    it('only returns the requested entries', async () => {
        const zip = await buildZip({ 'a.txt': 'A', 'b.txt': 'B' })
        const entries = await readZipEntries(zip, ['b.txt'])
        assert.equal(entries.size, 1)
        assert.equal(entries.get('b.txt'), 'B')
    })

    it('returns an empty map when the requested entry is absent', async () => {
        const zip = await buildZip({ 'a.txt': 'A' })
        const entries = await readZipEntries(zip, ['missing.txt'])
        assert.equal(entries.size, 0)
    })
})

describe('docx/numbering', () => {
    const xml = `<w:numbering>
        <w:abstractNum w:abstractNumId="5">
            <w:lvl w:ilvl="0"><w:start w:val="1"/><w:numFmt w:val="lowerLetter"/><w:lvlText w:val="%1."/></w:lvl>
            <w:lvl w:ilvl="1"><w:start w:val="1"/><w:numFmt w:val="lowerRoman"/><w:lvlText w:val="%2)"/></w:lvl>
        </w:abstractNum>
        <w:num w:numId="11"><w:abstractNumId w:val="5"/></w:num>
    </w:numbering>`

    it('resolves numId/ilvl to a numFmt and lvlText', () => {
        const lookup = parseNumbering(xml)
        assert.deepEqual(lookup.get('11:0'), { numFmt: 'lowerLetter', lvlText: '%1.', start: 1 })
        assert.deepEqual(lookup.get('11:1'), { numFmt: 'lowerRoman', lvlText: '%2)', start: 1 })
    })

    it('returns undefined for an unknown numId', () => {
        const lookup = parseNumbering(xml)
        assert.equal(lookup.get('999:0'), undefined)
    })
})

describe('docx/paragraphs', () => {
    it('extracts plain text from a simple paragraph', () => {
        const xml = '<w:p><w:r><w:t>Hello</w:t></w:r></w:p>'
        assert.deepEqual(parseParagraphs(xml), [{ numId: null, ilvl: null, text: 'Hello' }])
    })

    it('converts a manual tab between runs into a space', () => {
        // Mirrors a real CANFORGEN paragraph: a typed "1." followed by a
        // <w:tab/> run before the body text, with no literal space.
        const xml = '<w:p><w:r><w:t>1.</w:t></w:r><w:r><w:tab/></w:r><w:r><w:t>It is my privilege</w:t></w:r></w:p>'
        assert.deepEqual(parseParagraphs(xml), [{ numId: null, ilvl: null, text: '1. It is my privilege' }])
    })

    it('reads numId/ilvl off an auto-numbered paragraph', () => {
        const xml = `<w:p>
            <w:pPr><w:numPr><w:ilvl w:val="1"/><w:numId w:val="11"/></w:numPr></w:pPr>
            <w:r><w:t>CWO Someone was appointed something</w:t></w:r>
        </w:p>`
        assert.deepEqual(parseParagraphs(xml), [{ numId: '11', ilvl: 1, text: 'CWO Someone was appointed something' }])
    })

    it('defaults ilvl to 0 when numPr omits it', () => {
        const xml = '<w:p><w:pPr><w:numPr><w:numId w:val="7"/></w:numPr></w:pPr><w:r><w:t>x</w:t></w:r></w:p>'
        assert.deepEqual(parseParagraphs(xml), [{ numId: '7', ilvl: 0, text: 'x' }])
    })

    it('drops tracked-change deletions', () => {
        const xml = '<w:p><w:r><w:t>Keep</w:t></w:r><w:del w:id="1"><w:r><w:delText> removed</w:delText></w:r></w:del></w:p>'
        assert.deepEqual(parseParagraphs(xml), [{ numId: null, ilvl: null, text: 'Keep' }])
    })

    it('parses multiple paragraphs in document order', () => {
        const xml = '<w:p><w:r><w:t>First</w:t></w:r></w:p><w:p><w:r><w:t>Second</w:t></w:r></w:p>'
        assert.deepEqual(parseParagraphs(xml), [
            { numId: null, ilvl: null, text: 'First' },
            { numId: null, ilvl: null, text: 'Second' },
        ])
    })

    it('resolves a hyperlink run into an encoded link marker using the relationship map', () => {
        const xml = '<w:p><w:r><w:t xml:space="preserve">See </w:t></w:r>' +
            '<w:hyperlink r:id="rId8" w:history="1"><w:r><w:t>the guide</w:t></w:r></w:hyperlink>' +
            '<w:r><w:t>.</w:t></w:r></w:p>'
        const relationships = new Map([['rId8', 'http://example.com/guide']])
        const [paragraph] = parseParagraphs(xml, relationships)
        assert.equal(paragraph.text, `See ${encodeLink('http://example.com/guide', 'the guide')}.`)
        assert.equal(
            renderContent(paragraph.text),
            'See <a href="http://example.com/guide">the guide</a>.'
        )
    })

    it('falls back to plain link text when the relationship id is unresolved', () => {
        const xml = '<w:hyperlink r:id="rIdMissing"><w:r><w:t>dangling link</w:t></w:r></w:hyperlink>'
        const [paragraph] = parseParagraphs(`<w:p>${xml}</w:p>`, new Map())
        assert.equal(paragraph.text, 'dangling link')
    })

    it('wraps a bold run in an encoded bold marker, rendered as <strong>', () => {
        const xml = '<w:p><w:r><w:rPr><w:b/></w:rPr><w:t>Refs:</w:t></w:r></w:p>'
        const [paragraph] = parseParagraphs(xml)
        assert.equal(paragraph.text, '**Refs:**')
        assert.equal(renderContent(paragraph.text), '<strong>Refs:</strong>')
    })

    it('leaves a plain run (no rPr) unwrapped', () => {
        const xml = '<w:p><w:r><w:t>plain text</w:t></w:r></w:p>'
        const [paragraph] = parseParagraphs(xml)
        assert.equal(paragraph.text, 'plain text')
    })

    it('does not bold a run whose rPr has other properties but no <w:b/>', () => {
        const xml = '<w:p><w:r><w:rPr><w:i/></w:rPr><w:t>italic only</w:t></w:r></w:p>'
        const [paragraph] = parseParagraphs(xml)
        assert.equal(paragraph.text, 'italic only')
    })

    it('respects an explicit <w:b w:val="false"/> turning off inherited bold', () => {
        const xml = '<w:p><w:r><w:rPr><w:b w:val="false"/></w:rPr><w:t>not bold</w:t></w:r></w:p>'
        const [paragraph] = parseParagraphs(xml)
        assert.equal(paragraph.text, 'not bold')
    })

    it('joins mixed bold and plain runs within one paragraph, only wrapping the bold run', () => {
        const xml = '<w:p><w:r><w:t xml:space="preserve">See </w:t></w:r>' +
            '<w:r><w:rPr><w:b/></w:rPr><w:t>important</w:t></w:r>' +
            '<w:r><w:t xml:space="preserve"> notice.</w:t></w:r></w:p>'
        const [paragraph] = parseParagraphs(xml)
        assert.equal(paragraph.text, 'See **important** notice.')
        assert.equal(renderContent(paragraph.text), 'See <strong>important</strong> notice.')
    })
})

describe('docx/relationships', () => {
    it('maps relationship ids to their targets', () => {
        const xml = '<Relationships>' +
            '<Relationship Id="rId8" Type="http://.../hyperlink" Target="http://cda.mil.ca/cds/index-eng.asp" TargetMode="External"/>' +
            '<Relationship Id="rId2" Type="http://.../numbering" Target="numbering.xml"/>' +
            '</Relationships>'
        const map = parseRelationships(xml)
        assert.equal(map.get('rId8'), 'http://cda.mil.ca/cds/index-eng.asp')
        assert.equal(map.get('rId2'), 'numbering.xml')
    })
})

describe('docx/reconstruct', () => {
    const numbering = new Map([
        ['11:0', { numFmt: 'lowerLetter', lvlText: '%1.', start: 1 }],
        ['11:1', { numFmt: 'lowerRoman', lvlText: '%2)', start: 1 }],
        ['18:0', { numFmt: 'decimal', lvlText: '(%1)', start: 1 }],
        ['19:0', { numFmt: 'bullet', lvlText: '', start: 1 }],
    ])

    it('passes through plain paragraphs unchanged', () => {
        const paragraphs = [{ numId: null, ilvl: null, text: '1. Purpose' }]
        assert.equal(reconstructPlainText(paragraphs, numbering), '1. Purpose')
    })

    it('inserts a blank line between two consecutive plain-text Word paragraphs with no spacer between them', () => {
        // Word's paragraph mark alone means "new paragraph" -- even without an
        // empty spacer <w:p>, e.g. a header line immediately followed by a title
        // paragraph -- so downstream parseItems() must see them as separate <p>s.
        const paragraphs = [
            { numId: null, ilvl: null, text: 'CANFORGEN 130/26 CMP 057/26 211707Z JUL 26' },
            { numId: null, ilvl: null, text: '**2026 TITLE**' },
        ]
        assert.equal(
            reconstructPlainText(paragraphs, numbering),
            'CANFORGEN 130/26 CMP 057/26 211707Z JUL 26\n\n**2026 TITLE**'
        )
    })

    it('does not double up a blank line when an explicit empty spacer paragraph is already present', () => {
        const paragraphs = [
            { numId: null, ilvl: null, text: 'First paragraph' },
            { numId: null, ilvl: null, text: '' },
            { numId: null, ilvl: null, text: 'Second paragraph' },
        ]
        assert.equal(
            reconstructPlainText(paragraphs, numbering),
            'First paragraph\n\nSecond paragraph'
        )
    })

    it('does not insert a blank line between a list item and the plain paragraph that follows it', () => {
        const paragraphs = [
            { numId: '11', ilvl: 0, text: 'First sub-point' },
            { numId: null, ilvl: null, text: 'Signed by General Someone' },
        ]
        assert.equal(
            reconstructPlainText(paragraphs, numbering),
            'a. First sub-point\nSigned by General Someone'
        )
    })

    it('synthesizes incrementing letter markers for an auto-numbered list', () => {
        const paragraphs = [
            { numId: '11', ilvl: 0, text: 'First sub-point' },
            { numId: '11', ilvl: 0, text: 'Second sub-point' },
            { numId: '11', ilvl: 0, text: 'Third sub-point' },
        ]
        assert.equal(
            reconstructPlainText(paragraphs, numbering),
            'a. First sub-point\nb. Second sub-point\nc. Third sub-point'
        )
    })

    it('synthesizes roman markers at a nested level using lvlText wrapping', () => {
        const paragraphs = [
            { numId: '11', ilvl: 1, text: 'First' },
            { numId: '11', ilvl: 1, text: 'Second' },
        ]
        assert.equal(
            reconstructPlainText(paragraphs, numbering),
            '    i) First\n    ii) Second'
        )
    })

    it('resets a deeper level when the list returns to a shallower one', () => {
        const paragraphs = [
            { numId: '11', ilvl: 0, text: 'a' },
            { numId: '11', ilvl: 1, text: 'nested one' },
            { numId: '11', ilvl: 1, text: 'nested two' },
            { numId: '11', ilvl: 0, text: 'b' },
            { numId: '11', ilvl: 1, text: 'nested again, should restart at i' },
        ]
        const lines = reconstructPlainText(paragraphs, numbering).split('\n')
        assert.equal(lines[0], 'a. a')
        assert.equal(lines[1], '    i) nested one')
        assert.equal(lines[2], '    ii) nested two')
        assert.equal(lines[3], 'b. b')
        assert.equal(lines[4], '    i) nested again, should restart at i')
    })

    it('keeps separate lists (different numId) independently numbered', () => {
        const paragraphs = [
            { numId: '11', ilvl: 0, text: 'list one, a' },
            { numId: '18', ilvl: 0, text: 'list two, one' },
        ]
        const lines = reconstructPlainText(paragraphs, numbering).split('\n')
        assert.equal(lines[0], 'a. list one, a')
        assert.equal(lines[1], '(1) list two, one')
    })

    it('renders bullet-format lists as a hyphen marker', () => {
        const paragraphs = [{ numId: '19', ilvl: 0, text: 'bullet point' }]
        assert.equal(reconstructPlainText(paragraphs, numbering), '- bullet point')
    })

    it('falls back to raw text when the numId/ilvl has no definition', () => {
        const paragraphs = [{ numId: '999', ilvl: 0, text: 'undefined list' }]
        assert.equal(reconstructPlainText(paragraphs, numbering), 'undefined list')
    })
})

describe('docx end-to-end', () => {
    it('produces valid nested HTML from a reconstructed CANFORGEN-style docx structure', () => {
        // Mirrors the real-world shape: typed top-level numbers, plus an
        // auto-numbered (numPr) sub-list with no literal marker in the XML.
        const numbering = new Map([['11:0', { numFmt: 'lowerLetter', lvlText: '%1.', start: 1 }]])
        const paragraphs = [
            { numId: null, ilvl: null, text: '1. Purpose of this message.' },
            { numId: null, ilvl: null, text: '2. The following have been appointed:' },
            { numId: '11', ilvl: 0, text: 'CWO Someone, in Role A;' },
            { numId: '11', ilvl: 0, text: 'CWO Someone Else, in Role B.' },
            { numId: null, ilvl: null, text: '3. Summary.' },
        ]
        const plainText = reconstructPlainText(paragraphs, numbering)
        const html = convert(plainText)

        assert.ok(html.includes('<ol type="a">'))
        assert.ok(html.includes('Role A'))
        assert.ok(html.includes('Role B'))
        assert.equal((html.match(/<ol/g) || []).length, (html.match(/<\/ol>/g) || []).length)
        assert.equal((html.match(/<li>/g) || []).length, (html.match(/<\/li>/g) || []).length)
    })
})

const sampleDocxPath = new URL('../sample/2026-U-CPO1-CWO CFG_ENG.docx', import.meta.url)
const hasSampleDocx = existsSync(sampleDocxPath)

describe('docx end-to-end (real sample file)', { skip: !hasSampleDocx && 'sample/*.docx not present' }, () => {
    it('extracts recognizable structure from the real CANFORGEN sample', async () => {
        const buffer = readFileSync(sampleDocxPath)
        const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.length)
        const plainText = await parseDocxToPlainText(arrayBuffer)
        const html = convert(plainText)

        assert.ok(plainText.includes('1. It is my privilege'))
        assert.ok(html.includes('<ol'))
        assert.ok(html.includes('<ol type="a">'))

        // Item 6 links "http://cda.mil.ca/cds/index-eng.asp" as real anchor
        // text -- the URL only exists in word/_rels/document.xml.rels, not
        // in the paragraph text itself, so this only works if that
        // relationship was actually resolved.
        assert.ok(html.includes('<a href="http://cda.mil.ca/cds/index-eng.asp">'))
    })
})
