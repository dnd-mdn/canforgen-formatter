// Parses word/document.xml into a flat list of paragraphs, each with its
// list reference (numId/ilvl) if it's part of an auto-numbered list, and its
// plain-text content. Doesn't handle tables or text boxes -- CANFORGEN
// bodies are plain paragraph flow.

import { encodeLink, encodeBold } from '../linkMarker.js'
import { attrVal } from './xml.js'

// A run is bold if it carries <w:b/> (or <w:b w:val="..."/>) with a truthy value --
// <w:b w:val="false"/> (or "0"/"off") explicitly turns inherited bold back off.
function isBoldRun(rPr) {
    const m = rPr.match(/<w:b(\s[^>]*)?\/>/)
    if (!m) return false
    const val = m[1]?.match(/w:val="([^"]*)"/)?.[1]?.toLowerCase()
    return val === undefined || !['false', '0', 'off'].includes(val)
}

function extractRunText(runBody) {
    let text = ''
    const re = /<w:t[^>]*>([^<]*)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g
    let m
    while ((m = re.exec(runBody))) {
        if (m[1] !== undefined) text += m[1]
        else if (m[0].startsWith('<w:tab')) text += ' '
        else if (m[0].startsWith('<w:br')) text += '\n'
    }
    return text
}

function extractText(body, relationships) {
    // Drop tracked-change deletions; their text shouldn't appear in output.
    const withoutDeletions = body.replace(/<w:del[ >][\s\S]*?<\/w:del>/g, '')

    let text = ''
    const tokenRe = /<w:hyperlink[^>]*\sr:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>|<w:r(?:\s[^>]*)?>([\s\S]*?)<\/w:r>|<w:tab\s*\/>|<w:br\s*\/>/g
    let m
    while ((m = tokenRe.exec(withoutDeletions))) {
        if (m[1] !== undefined) {
            // A hyperlink's URL isn't in this text at all -- it's a relationship
            // id that has to be resolved via _rels/document.xml.rels.
            const href = relationships.get(m[1])
            const linkText = extractText(m[2], relationships)
            text += href ? encodeLink(href, linkText) : linkText
        } else if (m[3] !== undefined) {
            const runBody = m[3]
            const rPrMatch = runBody.match(/<w:rPr>([\s\S]*?)<\/w:rPr>/)
            const runText = extractRunText(runBody)
            text += rPrMatch && isBoldRun(rPrMatch[1]) && runText.trim() ? encodeBold(runText) : runText
        } else if (m[0].startsWith('<w:tab')) {
            text += ' '
        } else if (m[0].startsWith('<w:br')) {
            text += '\n'
        }
    }
    return text
}

export function parseParagraphs(xml, relationships = new Map()) {
    const paragraphs = []
    const paraRe = /<w:p(?:\s[^>]*)?>([\s\S]*?)<\/w:p>/g
    let m
    while ((m = paraRe.exec(xml))) {
        const body = m[1]
        const pPrMatch = body.match(/<w:pPr>([\s\S]*?)<\/w:pPr>/)
        const pPr = pPrMatch ? pPrMatch[1] : ''
        const bodyWithoutPPr = pPrMatch ? body.replace(pPrMatch[0], '') : body

        const numPrMatch = pPr.match(/<w:numPr>([\s\S]*?)<\/w:numPr>/)
        let numId = null
        let ilvl = null
        if (numPrMatch) {
            numId = attrVal(numPrMatch[1], 'numId') ?? null
            ilvl = Number(attrVal(numPrMatch[1], 'ilvl') ?? '0')
        }

        const text = extractText(bodyWithoutPPr, relationships).trim()
        paragraphs.push({ numId, ilvl, text })
    }
    return paragraphs
}
