// A hyperlink's URL lives outside the paragraph text a docx exposes (it's a
// separate relationship, resolved by id). To carry it through the plain-text
// pipeline that parseItems()/buildHTML() operate on -- and keep it readable
// and editable in the plaintext textarea the app shows the user -- links are
// encoded inline using familiar Markdown link syntax: [text](href).

import { escapeHTML } from './html.js'

const LINK_RE = /\[([^[\]]*)\]\(([^()]*)\)/g

// .mil.ca links point at the National Defence intranet, which isn't reachable
// from outside that network -- flag them inline so readers aren't left
// wondering why the link doesn't load.
const MIL_CA_DISCLAIMER = {
    en: ' (Accessible only on the National Defence network)',
    fr: ' (Accessible uniquement sur le réseau de la Défense nationale)',
}

function isMilCaHost(href) {
    try {
        const { hostname } = new URL(href)
        return hostname === 'mil.ca' || hostname.endsWith('.mil.ca')
    } catch {
        return false
    }
}

function escapeAttribute(text) {
    return escapeHTML(text).replace(/"/g, '&quot;')
}

export function encodeLink(href, text) {
    return `[${text}](${href})`
}

export function renderContent(content, lang = 'en') {
    let result = ''
    let lastIndex = 0
    LINK_RE.lastIndex = 0
    let m
    while ((m = LINK_RE.exec(content))) {
        result += escapeHTML(content.slice(lastIndex, m.index))
        const href = m[2]
        result += `<a href="${escapeAttribute(href)}">${escapeHTML(m[1])}</a>`
        if (isMilCaHost(href)) result += escapeHTML(MIL_CA_DISCLAIMER[lang] ?? MIL_CA_DISCLAIMER.en)
        lastIndex = LINK_RE.lastIndex
    }
    result += escapeHTML(content.slice(lastIndex))
    return result
}
