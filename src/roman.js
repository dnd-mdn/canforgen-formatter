export function intToRoman(value) {
    const table = [
        ['M', 1000], ['CM', 900], ['D', 500], ['CD', 400],
        ['C', 100], ['XC', 90], ['L', 50], ['XL', 40],
        ['X', 10], ['IX', 9], ['V', 5], ['IV', 4], ['I', 1],
    ]
    let n = value
    let out = ''
    for (const [sym, val] of table) {
        while (n >= val) {
            out += sym
            n -= val
        }
    }
    return out
}

export function romanToInt(marker) {
    const valueMap = { I: 1, V: 5, X: 10, L: 50, C: 100, D: 500, M: 1000 }
    const upper = marker.toUpperCase()
    if (!/^[IVXLCDM]+$/.test(upper)) return null

    let total = 0
    for (let i = 0; i < upper.length; i++) {
        const current = valueMap[upper[i]]
        const next = valueMap[upper[i + 1]] || 0
        total += current < next ? -current : current
    }

    // Reject non-canonical forms (e.g., IIV) by round-tripping.
    return intToRoman(total) === upper ? total : null
}
