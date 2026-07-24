import { PATTERNS, isRomanKey, isNumericKey, isAlphaKey } from './patterns.js'
import { romanToInt } from './roman.js'

export function parseItems(text) {
    const items = []

    const lastItemAtIndent = indent => {
        for (let i = items.length - 1; i >= 0; i--) {
            if (items[i].indent === indent) return items[i]
        }
        return null
    }

    for (const line of text.split('\n')) {
        let matched = false
        const leading = line.match(/^\s*/)?.[0] || ''
        const indent = leading.replace(/\t/g, '    ').length
        for (const p of PATTERNS) {
            if (p.re.test(line)) {
                let romanValue = null
                let orderValue = null
                if (isRomanKey(p.key)) {
                    const marker = line.match(/^\s*([A-Za-z]+)[\.)]\s+/)?.[1] || ''
                    romanValue = romanToInt(marker)
                    if (romanValue === null) continue
                    orderValue = romanValue

                    const prev = lastItemAtIndent(indent)
                    const isSingleRomanLetter = marker.length === 1
                    const isAlwaysRoman = marker === 'I'

                    if (isSingleRomanLetter && !isAlwaysRoman) {
                        const prevIsRoman = prev && isRomanKey(prev.key) && typeof prev.romanValue === 'number'
                        const continuesRomanSequence = prevIsRoman && romanValue === prev.romanValue + 1
                        if (!continuesRomanSequence) continue
                    }
                } else if (isNumericKey(p.key)) {
                    const marker = line.match(/^\s*\(?(\d+)\)?[\.)]\s+/)?.[1]
                    if (marker) orderValue = Number(marker)
                } else if (isAlphaKey(p.key)) {
                    const marker = line.match(/^\s*\(?([A-Za-z])\)?[\.)]\s+/)?.[1]
                    if (marker) orderValue = marker.toLowerCase().charCodeAt(0) - 96
                }
                items.push({
                    key: p.key,
                    tag: p.tag,
                    type: p.type,
                    level: p.level,
                    indent,
                    romanValue,
                    orderValue,
                    content: line.replace(p.re, '').trim()
                })
                matched = true
                break
            }
        }
        if (!matched && line.trim() && items.length > 0) {
            items[items.length - 1].content += ' ' + line.trim()
        }
    }
    return items
}
