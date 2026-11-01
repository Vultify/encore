// Builds small but real audio files for tests, so tag reading runs against actual file formats.

interface Mp3Tags {
  title?: string
  artist?: string
  album?: string
  track?: string
  year?: string
  cover?: Buffer
  // The "sort as" fields. Some iTunes purchases have only these, with the main fields empty.
  sortTitle?: string
  sortArtist?: string
  sortAlbum?: string
}

// ID3v2.4 stores sizes as four 7-bit bytes.
const syncsafe = (n: number): Buffer => Buffer.from([(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f])

const frame = (id: string, data: Buffer): Buffer =>
  Buffer.concat([Buffer.from(id, 'latin1'), syncsafe(data.length), Buffer.from([0, 0]), data])

const textFrame = (id: string, value: string): Buffer => frame(id, Buffer.concat([Buffer.from([3]), Buffer.from(value, 'utf8')]))

// Encoding UTF-8, mime type, picture type 3 (front cover), empty description, image bytes.
const coverFrame = (image: Buffer): Buffer =>
  frame('APIC', Buffer.concat([Buffer.from([3]), Buffer.from('image/png\0', 'latin1'), Buffer.from([3, 0]), image]))

// Silent MPEG-1 Layer III frames at 128 kbps and 44.1 kHz, about 26 ms each.
function silentMp3Frames(seconds: number): Buffer {
  const count = Math.round((seconds * 44100) / 1152)
  const frames = Buffer.alloc(count * 417)
  for (let i = 0; i < count; i++) frames.writeUInt32BE(0xfffb9064, i * 417)
  return frames
}

export function makeMp3(seconds: number, tags: Mp3Tags): Buffer {
  const frames = [
    tags.title && textFrame('TIT2', tags.title),
    tags.artist && textFrame('TPE1', tags.artist),
    tags.album && textFrame('TALB', tags.album),
    tags.track && textFrame('TRCK', tags.track),
    tags.year && textFrame('TDRC', tags.year),
    tags.cover && coverFrame(tags.cover),
    tags.sortTitle && textFrame('TSOT', tags.sortTitle),
    tags.sortArtist && textFrame('TSOP', tags.sortArtist),
    tags.sortAlbum && textFrame('TSOA', tags.sortAlbum)
  ].filter((f): f is Buffer => Boolean(f))

  const body = Buffer.concat(frames)
  const header = Buffer.concat([Buffer.from('ID3', 'latin1'), Buffer.from([4, 0, 0]), syncsafe(body.length)])
  return Buffer.concat([header, body, silentMp3Frames(seconds)])
}

// A plain untagged 8 kHz mono 16-bit WAV of silence.
export function makeWav(seconds: number): Buffer {
  const rate = 8000
  const dataSize = rate * 2 * seconds
  const header = Buffer.alloc(44)
  header.write('RIFF', 0, 'latin1')
  header.writeUInt32LE(36 + dataSize, 4)
  header.write('WAVEfmt ', 8, 'latin1')
  header.writeUInt32LE(16, 16)
  header.writeUInt16LE(1, 20)
  header.writeUInt16LE(1, 22)
  header.writeUInt32LE(rate, 24)
  header.writeUInt32LE(rate * 2, 28)
  header.writeUInt16LE(2, 32)
  header.writeUInt16LE(16, 34)
  header.write('data', 36, 'latin1')
  header.writeUInt32LE(dataSize, 40)
  return Buffer.concat([header, Buffer.alloc(dataSize)])
}
