import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { encodeLink, encodeBold, renderContent } from '../src/linkMarker.js'

describe('encodeLink / renderContent', () => {
    it('encodes as familiar markdown link syntax', () => {
        assert.equal(encodeLink('https://example.com', 'our site'), '[our site](https://example.com)')
    })

    it('renders an encoded link as an anchor tag', () => {
        const content = `Visit ${encodeLink('https://example.com', 'our site')} for details`
        assert.equal(renderContent(content), 'Visit <a href="https://example.com">our site</a> for details')
    })

    it('escapes plain text around the link normally', () => {
        const content = `A & B ${encodeLink('https://example.com', 'link')} <tag>`
        assert.equal(renderContent(content), 'A &amp; B <a href="https://example.com">link</a> &lt;tag&gt;')
    })

    it('escapes special characters in both the href and the link text', () => {
        const content = encodeLink('https://example.com?a=1&b=2', 'A & B <text>')
        assert.equal(
            renderContent(content),
            '<a href="https://example.com?a=1&amp;b=2">A &amp; B &lt;text&gt;</a>'
        )
    })

    it('renders plain content with no links unchanged (aside from escaping)', () => {
        assert.equal(renderContent('just plain text'), 'just plain text')
    })

    it('handles multiple links in the same content', () => {
        const content = `${encodeLink('https://a.example', 'A')} and ${encodeLink('https://b.example', 'B')}`
        assert.equal(
            renderContent(content),
            '<a href="https://a.example">A</a> and <a href="https://b.example">B</a>'
        )
    })
})

describe('encodeBold / renderContent (bold)', () => {
    it('encodes as familiar markdown bold syntax', () => {
        assert.equal(encodeBold('Refs:'), '**Refs:**')
    })

    it('renders an encoded bold marker as a <strong> tag', () => {
        assert.equal(renderContent(`${encodeBold('CANFORGEN 1/26')} header`), '<strong>CANFORGEN 1/26</strong> header')
    })

    it('escapes special characters inside bold text', () => {
        assert.equal(renderContent(encodeBold('A & B <tag>')), '<strong>A &amp; B &lt;tag&gt;</strong>')
    })

    it('handles a link and a bold span in the same content independently', () => {
        const content = `${encodeBold('Refs:')} see ${encodeLink('https://example.com', 'here')}`
        assert.equal(
            renderContent(content),
            '<strong>Refs:</strong> see <a href="https://example.com">here</a>'
        )
    })
})

describe('renderContent: .mil.ca network-access disclaimer', () => {
    it('appends the English disclaimer after a .mil.ca link by default', () => {
        const content = encodeLink('https://cda.mil.ca/cds/index-eng.asp', 'the guide')
        assert.equal(
            renderContent(content),
            '<a href="https://cda.mil.ca/cds/index-eng.asp">the guide</a> (Accessible only on the National Defence network)'
        )
    })

    it('appends the French disclaimer when lang is "fr"', () => {
        const content = encodeLink('https://cmp-cpm.mil.ca/some/path', 'le guide')
        assert.equal(
            renderContent(content, 'fr'),
            '<a href="https://cmp-cpm.mil.ca/some/path">le guide</a> (Accessible uniquement sur le réseau de la Défense nationale)'
        )
    })

    it('matches a bare mil.ca host and any subdomain, not just a fixed prefix', () => {
        assert.ok(renderContent(encodeLink('https://mil.ca', 'x')).includes('National Defence network'))
        assert.ok(renderContent(encodeLink('https://a.b.mil.ca', 'x')).includes('National Defence network'))
    })

    it('does not add a disclaimer for a non-.mil.ca link', () => {
        const content = encodeLink('https://example.com', 'our site')
        assert.equal(renderContent(content), '<a href="https://example.com">our site</a>')
    })

    it('does not falsely match when "mil.ca" appears only in the path, not the host', () => {
        const content = encodeLink('https://evil.example/mil.ca', 'suspicious')
        assert.ok(!renderContent(content).includes('National Defence network'))
    })

    it('does not add a disclaimer for a malformed href', () => {
        const content = encodeLink('not a url', 'broken')
        assert.equal(renderContent(content), '<a href="not a url">broken</a>')
    })
})

describe('renderContent: mailto spelled-out punctuation', () => {
    it('converts (at), (dash), (plus), and (underscore) to symbols in mailto link text', () => {
        const content = encodeLink(
            'mailto:++OTGRECRUIT@CANSOFCOM@OTTAWA-HULL',
            '(plus)(plus)otgrecruit(at)cansofcom(at)ottawa(dash)hull'
        )
        assert.equal(
            renderContent(content),
            '<a href="mailto:++OTGRECRUIT@CANSOFCOM@OTTAWA-HULL">++otgrecruit@cansofcom@ottawa-hull</a>'
        )
    })

    it('converts (underscore) as well', () => {
        const content = encodeLink('mailto:CJIRU_RECRUITING@forces.gc.ca', 'cjiru(underscore)recruiting(at)forces.gc.ca')
        assert.equal(
            renderContent(content),
            '<a href="mailto:CJIRU_RECRUITING@forces.gc.ca">cjiru_recruiting@forces.gc.ca</a>'
        )
    })

    it('is case-insensitive on the token spelling', () => {
        const content = encodeLink('mailto:a@b.com', 'a(AT)b.com')
        assert.equal(renderContent(content), '<a href="mailto:a@b.com">a@b.com</a>')
    })

    it('leaves the href itself untouched', () => {
        const content = encodeLink('mailto:a@b.com', 'a(at)b.com')
        assert.match(renderContent(content), /href="mailto:a@b\.com"/)
    })

    it('does not touch (at)/(dash)/(plus)/(underscore)-shaped text in a non-mailto link', () => {
        const content = encodeLink('https://example.com', 'a(at)b(dash)c')
        assert.equal(renderContent(content), '<a href="https://example.com">a(at)b(dash)c</a>')
    })

    it('leaves ordinary mailto text with no spelled-out tokens unchanged', () => {
        const content = encodeLink('mailto:csor.recruiting@forces.gc.ca', 'csor.recruiting@forces.gc.ca')
        assert.equal(renderContent(content), '<a href="mailto:csor.recruiting@forces.gc.ca">csor.recruiting@forces.gc.ca</a>')
    })
})

describe('renderContent: bare email auto-linking', () => {
    it('links a plain email address typed as bare text (never a docx hyperlink)', () => {
        assert.equal(
            renderContent('Contact james.terpstra@forces.gc.ca for details.'),
            'Contact <a href="mailto:james.terpstra@forces.gc.ca">james.terpstra@forces.gc.ca</a> for details.'
        )
    })

    it('links a bare address with a hyphenated local part and multi-label domain', () => {
        assert.equal(
            renderContent('john.hounsell-drover@forces.gc.ca'),
            '<a href="mailto:john.hounsell-drover@forces.gc.ca">john.hounsell-drover@forces.gc.ca</a>'
        )
    })

    it('links a bare address written with spelled-out accessible tokens, keeping the original text but normalizing the href', () => {
        assert.equal(
            renderContent('otgrecruit(at)forces.gc.ca'),
            '<a href="mailto:otgrecruit@forces.gc.ca">otgrecruit(at)forces.gc.ca</a>'
        )
        assert.equal(
            renderContent('cjiru(underscore)recruiting(at)forces.gc.ca'),
            '<a href="mailto:cjiru_recruiting@forces.gc.ca">cjiru(underscore)recruiting(at)forces.gc.ca</a>'
        )
    })

    it('links multiple bare addresses in the same content independently', () => {
        const content = 'a@example.com or b@example.com'
        assert.equal(
            renderContent(content),
            '<a href="mailto:a@example.com">a@example.com</a> or <a href="mailto:b@example.com">b@example.com</a>'
        )
    })

    it('does not double-wrap an address that is already an encoded [text](url) link', () => {
        const content = encodeLink('mailto:a@example.com', 'a@example.com')
        assert.equal(renderContent(content), '<a href="mailto:a@example.com">a@example.com</a>')
    })

    it('does not linkify a bare address inside a **bold** span (no nested markdown)', () => {
        const content = encodeBold('Contact a@example.com')
        assert.equal(renderContent(content), '<strong>Contact a@example.com</strong>')
    })

    it('escapes HTML-special characters around a bare address', () => {
        assert.equal(
            renderContent('A & B a@example.com <tag>'),
            'A &amp; B <a href="mailto:a@example.com">a@example.com</a> &lt;tag&gt;'
        )
    })
})

describe('renderContent: DND GroupWise/intranet pseudo-address auto-linking', () => {
    it('links a single-"+" GroupWise address, matching canada.ca\'s own (non-functional) mailto behavior', () => {
        const content = 'Intranet: +CMP ARC - CRA CPM@CMP D Mil Pers Mgt@Ottawa-Hull, or by calling 1-833-445-1182.'
        assert.equal(
            renderContent(content),
            'Intranet: <a href="mailto:+CMP%20ARC%20-%20CRA%20CPM@CMP%20D%20Mil%20Pers%20Mgt@Ottawa-Hull">' +
            '+CMP ARC - CRA CPM@CMP D Mil Pers Mgt@Ottawa-Hull</a>, or by calling 1-833-445-1182.'
        )
    })

    it('links a double-"++" GroupWise address and stops the match at " or ", not swallowing the next contact', () => {
        const content = 'or ++otgrecruit@cansofcom@ottawa-hull or otgrecruit@forces.gc.ca'
        assert.equal(
            renderContent(content),
            'or <a href="mailto:++otgrecruit@cansofcom@ottawa-hull">++otgrecruit@cansofcom@ottawa-hull</a>' +
            ' or <a href="mailto:otgrecruit@forces.gc.ca">otgrecruit@forces.gc.ca</a>'
        )
    })

    it('links a GroupWise address with multi-word segments on both sides of "@"', () => {
        const content = '++cjiru recruiting@cfb trenton@trenton or cjiru_recruiting@forces.gc.ca'
        assert.equal(
            renderContent(content),
            '<a href="mailto:++cjiru%20recruiting@cfb%20trenton@trenton">++cjiru recruiting@cfb trenton@trenton</a>' +
            ' or <a href="mailto:cjiru_recruiting@forces.gc.ca">cjiru_recruiting@forces.gc.ca</a>'
        )
    })

    it('links a GroupWise address written with fully spelled-out accessible tokens', () => {
        assert.equal(
            renderContent('(plus)(plus)otgrecruit(at)cansofcom(at)ottawa(dash)hull'),
            '<a href="mailto:++otgrecruit@cansofcom@ottawa-hull">(plus)(plus)otgrecruit(at)cansofcom(at)ottawa(dash)hull</a>'
        )
    })

    it('does not mistake a "+1-xxx-xxx-xxxx" phone number for a GroupWise address (no letter follows the +)', () => {
        assert.equal(renderContent('call +1-833-445-1182 for help'), 'call +1-833-445-1182 for help')
    })
})
