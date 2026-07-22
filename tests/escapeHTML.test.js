import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { escapeHTML } from '../src/buildHTML.js'

describe('escapeHTML', () => {
    it('escapes ampersands, angle brackets', () => {
        assert.equal(escapeHTML('A & B <tag> end'), 'A &amp; B &lt;tag&gt; end')
    })

    it('leaves plain text untouched', () => {
        assert.equal(escapeHTML('nothing special'), 'nothing special')
    })

    it('escapes ampersands before expanding entities (no double-escaping of &lt; etc.)', () => {
        assert.equal(escapeHTML('<'), '&lt;')
        assert.equal(escapeHTML('&lt;'), '&amp;lt;')
    })
})
