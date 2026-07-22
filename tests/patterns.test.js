import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { PATTERNS } from '../src/patterns.js'

describe('PATTERNS', () => {
    it('checks roman patterns before alpha patterns (ordering determines ambiguity resolution)', () => {
        const romanIdx = PATTERNS.findIndex(p => p.key === 'roman-lower-dot')
        const alphaIdx = PATTERNS.findIndex(p => p.key === 'alpha-dot')
        assert.ok(romanIdx < alphaIdx)
    })

    it('checks numeric/roman/alpha dot-and-rparen patterns before parenthesized ones', () => {
        const rparenIdx = PATTERNS.findIndex(p => p.key === 'ALPHA-rparen')
        const parenIdx = PATTERNS.findIndex(p => p.key === 'num-paren')
        assert.ok(rparenIdx < parenIdx)
    })

    it('checks the bullet pattern last', () => {
        assert.equal(PATTERNS.at(-1).key, 'ul')
    })

    it('gives every pattern a unique key', () => {
        const keys = PATTERNS.map(p => p.key)
        assert.equal(new Set(keys).size, keys.length)
    })
})
