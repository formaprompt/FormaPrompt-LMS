export function byteaToPngDataUrl(value) {
  if (!value || typeof value !== 'string') return ''
  if (value.startsWith('data:image/png;base64,')) return value

  if (value.startsWith('\\x')) {
    const hex = value.slice(2)
    if (!hex || hex.length % 2 !== 0 || !/^[0-9a-f]+$/i.test(hex)) return ''
    const chunks = []
    for (let offset = 0; offset < hex.length; offset += 16384) {
      const chunk = hex.slice(offset, offset + 16384)
      let binary = ''
      for (let index = 0; index < chunk.length; index += 2) {
        binary += String.fromCharCode(Number.parseInt(chunk.slice(index, index + 2), 16))
      }
      chunks.push(binary)
    }
    return `data:image/png;base64,${window.btoa(chunks.join(''))}`
  }

  return `data:image/png;base64,${value}`
}

export function shortSignatureHash(value) {
  return value ? `${value.slice(0, 12)}…${value.slice(-8)}` : ''
}
