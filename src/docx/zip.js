import JSZip from 'jszip'

// Reads the given entry names out of a .docx (zip) archive and returns their
// decoded text content. Returns a Map<name, string> containing only the
// entries that were found.
export async function readZipEntries(arrayBuffer, names) {
    const zip = await JSZip.loadAsync(arrayBuffer)
    const result = new Map()
    for (const name of names) {
        const file = zip.file(name)
        if (file) result.set(name, await file.async('string'))
    }
    return result
}
