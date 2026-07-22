export function escapeHTML(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function buildHTML(items) {
    if (!items.length) return ''
    let out = ''
    const stack = [] // { key, tag, level, indent, listDepth, itemDepth, lastOrder }
    const pad = n => '  '.repeat(n)

    const openList = (item, listDepth) => {
        const itemDepth = listDepth + 1
        const attrs = item.tag === 'ol' && item.type !== '1' ? ` type="${item.type}"` : ''
        out += `${pad(listDepth)}<${item.tag}${attrs}>\n${pad(itemDepth)}<li>${escapeHTML(item.content)}\n`
        stack.push({
            key: item.key,
            tag: item.tag,
            level: item.level,
            indent: item.indent,
            listDepth,
            itemDepth,
            lastOrder: typeof item.orderValue === 'number' ? item.orderValue : null
        })
    }

    for (const item of items) {
        if (stack.length === 0) {
            openList(item, 0)
            continue
        }

        const top = stack[stack.length - 1]

        if (item.indent > top.indent) {
            // Deeper indentation starts a nested list inside the current item.
            openList(item, top.itemDepth + 1)
            continue
        }

        while (stack.length > 0 && item.indent < stack[stack.length - 1].indent) {
            const { tag, listDepth, itemDepth } = stack[stack.length - 1]
            out += `${pad(itemDepth)}</li>\n${pad(listDepth)}</${tag}>\n`
            stack.pop()
        }

        if (stack.length === 0) {
            openList(item, 0)
            continue
        }

        const current = stack[stack.length - 1]

        if (current.indent === item.indent && item.level > current.level) {
            // Style progression (e.g., 1. -> a. -> (1), or a skipped level like 1. -> (1))
            // nests one level deeper, even when indentation is flat.
            openList(item, current.itemDepth + 1)
        } else {
            if (current.indent === item.indent && item.level < current.level) {
                while (stack.length > 0) {
                    const top = stack[stack.length - 1]
                    if (top.indent !== item.indent || top.level <= item.level) break
                    out += `${pad(top.itemDepth)}</li>\n${pad(top.listDepth)}</${top.tag}>\n`
                    stack.pop()
                }
            }

            if (stack.length === 0) {
                openList(item, 0)
                continue
            }

            const active = stack[stack.length - 1]
            if (active.indent === item.indent && active.key === item.key) {
                const hasOrder = typeof active.lastOrder === 'number' && typeof item.orderValue === 'number'
                const shouldRestartList = hasOrder && item.orderValue <= active.lastOrder

                if (shouldRestartList) {
                    // Numbering/lettering reset at same style and indent: start a sibling list.
                    const { tag, listDepth, itemDepth } = active
                    out += `${pad(itemDepth)}</li>\n${pad(listDepth)}</${tag}>\n`
                    stack.pop()
                    const nextDepth = stack.length ? stack[stack.length - 1].itemDepth + 1 : 0
                    openList(item, nextDepth)
                } else {
                    // Same list level and marker style: close current item and open the next item.
                    const { itemDepth } = active
                    out += `${pad(itemDepth)}</li>\n${pad(itemDepth)}<li>${escapeHTML(item.content)}\n`
                    if (typeof item.orderValue === 'number') active.lastOrder = item.orderValue
                }
            } else {
                // Different style at same depth: close current list and start a sibling list.
                const { tag, listDepth, itemDepth } = active
                out += `${pad(itemDepth)}</li>\n${pad(listDepth)}</${tag}>\n`
                stack.pop()
                const nextDepth = stack.length ? stack[stack.length - 1].itemDepth + 1 : 0
                openList(item, nextDepth)
            }
        }
    }

    while (stack.length > 0) {
        const { tag, listDepth, itemDepth } = stack[stack.length - 1]
        out += `${pad(itemDepth)}</li>\n${pad(listDepth)}</${tag}>\n`
        stack.pop()
    }

    return out.trim()
}
