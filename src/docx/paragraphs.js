// Parses word/document.xml into a flat list of paragraphs, each with its
// list reference (numId/ilvl) if it's part of an auto-numbered list, and its
// plain-text content. Doesn't handle tables or text boxes -- CANFORGEN
// bodies are plain paragraph flow.

import { encodeLink } from '../linkMarker.js'
import { attrVal } from './xml.js'

function extractText(body, relationships) {
    // Drop tracked-change deletions; their text shouldn't appear in output.
    const withoutDeletions = body.replace(/<w:del[ >][\s\S]*?<\/w:del>/g, '')

    let text = ''
    const tokenRe = /<w:hyperlink[^>]*\sr:id="([^"]+)"[^>]*>([\s\S]*?)<\/w:hyperlink>|<w:t[^>]*>([^<]*)<\/w:t>|<w:tab\s*\/>|<w:br\s*\/>/g
    let m
    while ((m = tokenRe.exec(withoutDeletions))) {
        if (m[1] !== undefined) {
            // A hyperlink's URL isn't in this text at all -- it's a relationship
            // id that has to be resolved via _rels/document.xml.rels.
            const href = relationships.get(m[1])
            const linkText = extractText(m[2], relationships)
            text += href ? encodeLink(href, linkText) : linkText
        } else if (m[3] !== undefined) {
            text += m[3]
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
