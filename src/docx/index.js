import { readZipEntries } from './zip.js'
import { parseNumbering } from './numbering.js'
import { parseParagraphs } from './paragraphs.js'
import { parseRelationships } from './relationships.js'
import { reconstructPlainText } from './reconstruct.js'

export async function parseDocxToPlainText(arrayBuffer) {
    const entries = await readZipEntries(arrayBuffer, [
        'word/document.xml',
        'word/numbering.xml',
        'word/_rels/document.xml.rels',
    ])
    const documentXml = entries.get('word/document.xml')
    if (!documentXml) throw new Error('Not a valid .docx file (missing word/document.xml)')
    const numberingXml = entries.get('word/numbering.xml')
    const relsXml = entries.get('word/_rels/document.xml.rels')

    const relationships = relsXml ? parseRelationships(relsXml) : new Map()
    const paragraphs = parseParagraphs(documentXml, relationships)
    const numbering = numberingXml ? parseNumbering(numberingXml) : new Map()
    return reconstructPlainText(paragraphs, numbering)
}
