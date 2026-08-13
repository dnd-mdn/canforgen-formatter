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
const LINK_AND_BOLD_RE = String.raw`\[([^[\]]*)\]\(([^()]*)\)|\*\*([^*]+)\*\*`

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

// Bare email addresses typed or pasted as plain text (never a real docx
// hyperlink) aren't linked at all otherwise. Both the normal symbol and the
// spelled-out accessible token (see MAILTO_TOKENS above) are recognized for
// each punctuation mark, since CANFORGEN authors use either inconsistently.
const AT = String.raw`(?:@|\(at\))`
const PLUS = String.raw`(?:\+|\(plus\))`
const DASH = String.raw`(?:-|\(dash\))`
const UNDERSCORE = String.raw`(?:_|\(underscore\))`

// local-part@domain.tld -- the local part and domain labels may each use the
// spelled-out tokens in place of -, _, or +.
const EMAIL_SRC = String.raw`[A-Za-z0-9](?:[A-Za-z0-9.]|${DASH}|${UNDERSCORE}|${PLUS})*${AT}` +
    String.raw`[A-Za-z0-9](?:[A-Za-z0-9]|${DASH})*(?:\.[A-Za-z0-9](?:[A-Za-z0-9]|${DASH})*)+`

// DND's legacy intranet/GroupWise-style address: one or two leading "+" (or
// spelled "(plus)"), then three @-separated segments -- display name, org
// unit, location -- e.g. "+CMP ARC - CRA CPM@CMP D Mil Pers Mgt@Ottawa-Hull".
// These aren't real internet addresses (a mailto: link to one won't work),
// but canada.ca's own published CANFORGENs link them the same as real emails,
// so this matches that rather than silently leaving them as plain text.
const GROUPWISE_WORDS = String.raw`[A-Za-z](?:[A-Za-z0-9 '.]|${DASH}|${UNDERSCORE}){0,60}?`
const GROUPWISE_SRC = String.raw`${PLUS}{1,2}${GROUPWISE_WORDS}${AT}${GROUPWISE_WORDS}${AT}` +
    String.raw`[A-Za-z](?:[A-Za-z0-9]|${DASH}){0,40}`

// Single combined tokenizer: explicit [text](url) links and **bold** markers,
// plus bare email/pseudo-addresses typed or pasted as plain text (never a real
// docx hyperlink, so otherwise never linked at all). The GroupWise form is
// tried before the plain email form -- it's the more specific, longer match,
// and trying email first would grab only its trailing "word@word" pair and
// leave the "+...@" prefix as stray text.
const TOKEN_RE = new RegExp(`${LINK_AND_BOLD_RE}|(${GROUPWISE_SRC})|(${EMAIL_SRC})`, 'gi')

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
        } else if (m[4] !== undefined || m[5] !== undefined) {
            // A bare email or GroupWise-style address typed as plain text --
            // never a real docx hyperlink, so the mailto: href has to be built
            // from the matched text itself (normalized to real punctuation).
            const bareAddress = m[4] ?? m[5]
            const href = `mailto:${encodeURI(normalizeMailtoText(bareAddress))}`
            result += `<a href="${escapeAttribute(href)}">${escapeHTML(bareAddress)}</a>`
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
