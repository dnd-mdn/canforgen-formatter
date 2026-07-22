// Line-marker patterns, tried in order. Roman patterns must precede alpha patterns
// so that ambiguous single letters (e.g. "v.") are resolved as roman first.
export const PATTERNS = [
    { key: 'num-dot',      re: /^\s*\d+\.\s+/,      tag: 'ol', type: '1', level: 1 },
    { key: 'num-rparen',   re: /^\s*\d+\)\s+/,      tag: 'ol', type: '1', level: 1 },
    { key: 'roman-lower-dot',    re: /^\s*[ivxlcdm]+\.\s+/, tag: 'ol', type: 'i', level: 3 },
    { key: 'roman-lower-rparen', re: /^\s*[ivxlcdm]+\)\s+/, tag: 'ol', type: 'i', level: 3 },
    { key: 'roman-dot',    re: /^\s*[IVXLCDM]+\.\s+/, tag: 'ol', type: 'I', level: 3 },
    { key: 'roman-rparen', re: /^\s*[IVXLCDM]+\)\s+/, tag: 'ol', type: 'I', level: 3 },
    { key: 'alpha-dot',    re: /^\s*[a-z]\.\s+/,    tag: 'ol', type: 'a', level: 2 },
    { key: 'alpha-rparen', re: /^\s*[a-z]\)\s+/,    tag: 'ol', type: 'a', level: 2 },
    { key: 'ALPHA-dot',    re: /^\s*[A-Z]\.\s+/,    tag: 'ol', type: 'A', level: 2 },
    { key: 'ALPHA-rparen', re: /^\s*[A-Z]\)\s+/,    tag: 'ol', type: 'A', level: 2 },
    { key: 'num-paren',    re: /^\s*\(\d+\)\s+/,    tag: 'ol', type: '1', level: 3 },
    { key: 'alpha-paren',  re: /^\s*\([a-z]\)\s+/,  tag: 'ol', type: 'a', level: 4 },
    { key: 'ALPHA-paren',  re: /^\s*\([A-Z]\)\s+/,  tag: 'ol', type: 'A', level: 4 },
    { key: 'ul',           re: /^\s*[-*•]\s+/,       tag: 'ul', type: null, level: 2 },
]

export const isRomanKey = key => key.startsWith('roman-')
export const isNumericKey = key => key.startsWith('num-')
export const isAlphaKey = key => key.startsWith('alpha-') || key.startsWith('ALPHA-')
