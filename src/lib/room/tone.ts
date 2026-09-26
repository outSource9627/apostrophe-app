/**
 * A 440 Hz test tone as a WAV data URI, for the speaker check (SC-30). Generated
 * in JS so the app ships no audio asset; played through a hidden react-native-video.
 */
export function toneDataUri(freq = 440, seconds = 1.2, rate = 8000): string {
  const n = Math.floor(rate * seconds)
  const bytes = new Uint8Array(44 + n)
  const dv = new DataView(bytes.buffer)
  const w = (o: number, s: string) => { for (let i = 0; i < s.length; i++) bytes[o + i] = s.charCodeAt(i) }
  w(0, 'RIFF'); dv.setUint32(4, 36 + n, true); w(8, 'WAVE'); w(12, 'fmt ')
  dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true)
  dv.setUint32(24, rate, true); dv.setUint32(28, rate, true); dv.setUint16(32, 1, true); dv.setUint16(34, 8, true)
  w(36, 'data'); dv.setUint32(40, n, true)
  for (let i = 0; i < n; i++) {
    const fade = Math.min(1, i / 400, (n - i) / 400)
    bytes[44 + i] = 128 + Math.round(Math.sin((2 * Math.PI * freq * i) / rate) * 90 * fade)
  }
  return `data:audio/wav;base64,${base64(bytes)}`
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
function base64(b: Uint8Array): string {
  let out = ''
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i] << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0)
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < b.length ? B64[(n >> 6) & 63] : '=') + (i + 2 < b.length ? B64[n & 63] : '=')
  }
  return out
}
