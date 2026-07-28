// Parses word/numbering.xml into a lookup of how each (numId, ilvl) pair
// should render its marker. Word never stores "a." or "iii)" as text for an
// auto-numbered list -- it stores a numId/ilvl reference here and computes
// the marker at render time, so we have to do the same.

import { attrVal } from './xml.js'

function parseAbstractNums(xml) {
    const abstractNums = new Map() // abstractNumId -> Map<ilvl, {numFmt, lvlText, start}>

    for (const m of xml.matchAll(/<w:abstractNum w:abstractNumId="(\d+)"[^>]*>([\s\S]*?)<\/w:abstractNum>/g)) {
        const abstractNumId = m[1]
        const levels = new Map()
        for (const lvlMatch of m[2].matchAll(/<w:lvl w:ilvl="(\d+)"[^>]*>([\s\S]*?)<\/w:lvl>/g)) {
            const ilvl = lvlMatch[1]
            const body = lvlMatch[2]
            const numFmt = attrVal(body, 'numFmt') || 'decimal'
            const lvlText = attrVal(body, 'lvlText') || '%1.'
            const start = Number(attrVal(body, 'start') || '1')
            levels.set(ilvl, { numFmt, lvlText, start })
        }
        abstractNums.set(abstractNumId, levels)
    }
    return abstractNums
}

// Returns a Map<`${numId}:${ilvl}`, {numFmt, lvlText, start}>.
export function parseNumbering(xml) {
    const abstractNums = parseAbstractNums(xml)

    const lookup = new Map()
    for (const m of xml.matchAll(/<w:num w:numId="(\d+)"[^>]*>([\s\S]*?)<\/w:num>/g)) {
        const abstractNumId = attrVal(m[2], 'abstractNumId')
        const levels = abstractNumId && abstractNums.get(abstractNumId)
        if (!levels) continue
        for (const [ilvl, def] of levels) {
            lookup.set(`${m[1]}:${ilvl}`, def)
        }
    }
    return lookup
}
