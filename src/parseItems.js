import { PATTERNS, isRomanKey, isNumericKey, isAlphaKey } from './patterns.js'
import { romanToInt } from './roman.js'

// "References: A. text" (also Refs:/REFS:/Référence(s):/Réf(s):) glues the first
// marker onto the label line, hiding it from the per-line marker detection below.
// Split the marker onto its own line so it can be recognized like the rest of the list.
const REFERENCE_LABEL_RE = /^([ \t]*(?:r[ée]f[ée]rences?|r[ée]fs?)[ \t]*:)[ \t]+(?=\S)/gimu

// The fixed bilingual-boundary line CANFORGENs use between language versions
// ("End of English text//le texte français suit", or reversed for French-first
// messages). Whatever follows is an unrelated new section, not a continuation
// of the item above it, and its first marker should start a fresh top-level
// list rather than nesting under whatever list was still open.
const LANGUAGE_BREAK_EN_RE = /end of english text|english text follows/i
const LANGUAGE_BREAK_FR_RE = /texte fran[çc]ais/i
const isLanguageBreakLine = line => LANGUAGE_BREAK_EN_RE.test(line) && LANGUAGE_BREAK_FR_RE.test(line)

// Which language the break line hands off to: "End of English text" means French
// follows; "Fin du texte français" means English follows. Falls back to toggling
// the current language if the line matches isLanguageBreakLine but neither
// specific "ends" phrase is present.
function nextLanguage(line, currentLang) {
    if (/end of english text/i.test(line)) return 'fr'
    if (/fin du texte fran[çc]ais/i.test(line)) return 'en'
    return currentLang === 'en' ? 'fr' : 'en'
}

export function parseItems(text) {
    text = text.replace(REFERENCE_LABEL_RE, '$1\n')
    const items = []
    let sectionBreakPending = false
    let currentLang = 'en'

    const lastItemAtIndent = indent => {
        for (let i = items.length - 1; i >= 0; i--) {
            if (items[i].indent === indent) return items[i]
        }
        return null
    }

    for (const line of text.split('\n')) {
        if (isLanguageBreakLine(line)) {
            sectionBreakPending = true
            currentLang = nextLanguage(line, currentLang)
            continue
        }

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
                    sectionBreak: sectionBreakPending,
                    lang: currentLang,
                    content: line.replace(p.re, '').trim()
                })
                sectionBreakPending = false
                matched = true
                break
            }
        }
        if (!matched && line.trim() && items.length > 0 && !sectionBreakPending) {
            items[items.length - 1].content += ' ' + line.trim()
        }
    }
    return items
}
