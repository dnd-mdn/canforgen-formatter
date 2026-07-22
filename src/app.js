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

document.getElementById('convert-btn').addEventListener('click', handleConvert)
document.getElementById('copy-btn').addEventListener('click', handleCopy)
document.getElementById('input').addEventListener('paste', () => setTimeout(handleConvert, 0))
