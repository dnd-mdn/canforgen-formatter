import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { romanToInt, intToRoman } from '../src/roman.js'

describe('intToRoman / romanToInt', () => {
    const cases = [
        [1, 'I'], [4, 'IV'], [9, 'IX'], [40, 'XL'], [90, 'XC'],
        [400, 'CD'], [900, 'CM'], [1994, 'MCMXCIV'], [58, 'LVIII'],
        [2000, 'MM'], [3999, 'MMMCMXCIX'],
    ]

    for (const [value, roman] of cases) {
        it(`converts ${value} <-> ${roman}`, () => {
            assert.equal(intToRoman(value), roman)
            assert.equal(romanToInt(roman), value)
        })
    }

    it('is case-insensitive', () => {
        assert.equal(romanToInt('mcmxciv'), 1994)
    })

    it('rejects non-canonical forms like IIV', () => {
        assert.equal(romanToInt('IIV'), null)
    })

    it('rejects non-roman characters', () => {
        assert.equal(romanToInt('ABC'), null)
    })

    it('rejects an empty string', () => {
        assert.equal(romanToInt(''), null)
    })
})
