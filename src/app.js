import { convert } from './canforgen.js'

function handleConvert() {
    const text = document.getElementById('input').value
    const html = convert(text)
    document.getElementById('output').value = html || '<!-- no list markers found -->'
    document.getElementById('preview').innerHTML = html || '<em class="text-muted">No list markers detected.</em>'
    document.getElementById('result').style.display = ''
}

function handleCopy() {
    navigator.clipboard.writeText(document.getElementById('output').value).then(() => {
        const btn = document.getElementById('copy-btn')
        btn.textContent = 'Copied!'
        setTimeout(() => btn.textContent = 'Copy', 1500)
    })
}

async function handleDocxUpload(event) {
    const file = event.target.files[0]
    const errorEl = document.getElementById('docx-error')
    errorEl.style.display = 'none'
    if (!file) return

    try {
        const { parseDocxToPlainText } = await import('./docx/index.js')
        const buffer = await file.arrayBuffer()
        const plainText = await parseDocxToPlainText(buffer)
        document.getElementById('input').value = plainText
        handleConvert()
    } catch (err) {
        errorEl.textContent = `Could not read that .docx file: ${err.message}`
        errorEl.style.display = ''
    }
}

document.getElementById('convert-btn').addEventListener('click', handleConvert)
document.getElementById('copy-btn').addEventListener('click', handleCopy)
document.getElementById('input').addEventListener('paste', () => setTimeout(handleConvert, 0))
document.getElementById('docx-input').addEventListener('change', handleDocxUpload)
