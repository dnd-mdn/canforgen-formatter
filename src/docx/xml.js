// Extracts a w:val="..." attribute off a self-closing OOXML element,
// e.g. <w:numFmt w:val="decimal"/>.
export function attrVal(xml, tag) {
    return xml.match(new RegExp(`<w:${tag}\\s+w:val="([^"]*)"`))?.[1]
}
