// Parses a part's _rels/*.rels file into a lookup of relationship id -> target.
// Hyperlinks in document.xml reference r:id, never a URL directly -- the
// actual address only exists here.
export function parseRelationships(xml) {
    const map = new Map()
    for (const m of xml.matchAll(/<Relationship\s+Id="([^"]+)"[^>]*\sTarget="([^"]+)"/g)) {
        map.set(m[1], m[2])
    }
    return map
}
