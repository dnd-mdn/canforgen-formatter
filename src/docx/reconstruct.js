import { intToRoman } from '../roman.js'

function numberToLetter(count, upper) {
    const cycles = Math.ceil(count / 26)
    const index = (count - 1) % 26
    const letter = String.fromCharCode((upper ? 65 : 97) + index)
    return letter.repeat(cycles)
}

function formatValue(numFmt, count) {
    switch (numFmt) {
        case 'lowerLetter': return numberToLetter(count, false)
        case 'upperLetter': return numberToLetter(count, true)
        case 'lowerRoman': return intToRoman(count).toLowerCase()
        case 'upperRoman': return intToRoman(count)
        case 'decimal':
        default: return String(count)
    }
}

function formatMarker(def, count) {
    if (def.numFmt === 'bullet') return '-'
    return def.lvlText.replace(/%\d/, formatValue(def.numFmt, count))
}

// Word never writes "a." or "iii)" as text for an auto-numbered paragraph --
// it just references a numId/ilvl and computes the marker at render time.
// This walks the paragraphs in document order, tracking a counter per
// (numId, ilvl) the same way Word would, and reconstructs the plain-text
// line that a faithful copy/paste would have produced, so it can be fed
// straight into the existing marker-detecting parseItems() pipeline.
export function reconstructPlainText(paragraphs, numbering) {
    const countsByNumId = new Map() // numId -> Map<ilvl, count>
    const lines = []
    let prevWasPlainText = false

    for (const p of paragraphs) {
        const def = p.numId != null ? numbering.get(`${p.numId}:${p.ilvl}`) : null
        if (!def) {
            // Word's paragraph mark is an unambiguous break -- two separate <w:p>
            // plain-text paragraphs are never the same paragraph, even without an
            // empty spacer paragraph between them in the source. A blank line here
            // keeps parseItems() from gluing them into one <p> downstream.
            if (prevWasPlainText && p.text.trim() && lines.length && lines[lines.length - 1].trim()) {
                lines.push('')
            }
            lines.push(p.text)
            prevWasPlainText = true
            continue
        }
        prevWasPlainText = false

        const levelCounts = countsByNumId.get(p.numId) || new Map()
        countsByNumId.set(p.numId, levelCounts)
        for (const ilvl of levelCounts.keys()) {
            if (ilvl > p.ilvl) levelCounts.delete(ilvl)
        }
        const count = (levelCounts.get(p.ilvl) ?? (def.start - 1)) + 1
        levelCounts.set(p.ilvl, count)

        const indent = '    '.repeat(p.ilvl)
        const marker = formatMarker(def, count)
        lines.push(`${indent}${marker} ${p.text}`)
    }

    return lines.join('\n')
}
