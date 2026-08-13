// A hyperlink's URL lives outside the paragraph text a docx exposes (it's a
// separate relationship, resolved by id). To carry it through the plain-text
// pipeline that parseItems()/buildHTML() operate on -- and keep it readable
// and editable in the plaintext textarea the app shows the user -- links are
// encoded inline using familiar Markdown link syntax: [text](href).

import { escapeHTML } from './html.js'

// Bold runs (e.g. a docx w:b run, or a message header/label meant to stand out)
// are carried the same way as links -- as inline Markdown-style **bold** markers
// -- so they survive the plain-text pipeline and the plaintext textarea stays
// readable and editable.
const TOKEN_RE = /\[([^[\]]*)\]\(([^()]*)\)|\*\*([^*]+)\*\*/g

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

// Accessible-document conventions sometimes spell out email punctuation as
// words (screen readers read "@" oddly otherwise) -- e.g. "name(at)example.com".
// Restore the real characters in the visible link text for mailto: links.
const MAILTO_TOKENS = { '(at)': '@', '(dash)': '-', '(plus)': '+', '(underscore)': '_' }
const MAILTO_TOKEN_RE = /\(at\)|\(dash\)|\(plus\)|\(underscore\)/gi

function normalizeMailtoText(text) {
    return text.replace(MAILTO_TOKEN_RE, m => MAILTO_TOKENS[m.toLowerCase()])
}

function escapeAttribute(text) {
    return escapeHTML(text).replace(/"/g, '&quot;')
}

export function encodeLink(href, text) {
    return `[${text}](${href})`
}

export function encodeBold(text) {
    return `**${text}**`
}

export function renderContent(content, lang = 'en') {
    let result = ''
    let lastIndex = 0
    TOKEN_RE.lastIndex = 0
    let m
    while ((m = TOKEN_RE.exec(content))) {
        result += escapeHTML(content.slice(lastIndex, m.index))
        if (m[3] !== undefined) {
            result += `<strong>${escapeHTML(m[3])}</strong>`
        } else {
            const href = m[2]
            const isMailto = /^mailto:/i.test(href)
            const linkText = isMailto ? normalizeMailtoText(m[1]) : m[1]
            result += `<a href="${escapeAttribute(href)}">${escapeHTML(linkText)}</a>`
            if (isMilCaHost(href)) result += escapeHTML(MIL_CA_DISCLAIMER[lang] ?? MIL_CA_DISCLAIMER.en)
        }
        lastIndex = TOKEN_RE.lastIndex
    }
    result += escapeHTML(content.slice(lastIndex))
    return result
}
