import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { encodeLink, renderContent } from '../src/linkMarker.js'

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
