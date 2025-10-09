import { getFileMimeType, mobiLang, unescapeHTML } from './utils'
import type { Resource } from './utils'
import { kf8Header, mobiHeader, palmdocHeader, pdbHeader } from './headers'
import type {
  GetStruct,
  Kf8Header,
  MobiHeader,
  MobiHeaderExtends,
  PalmdocHeader,
  PdbHeader,
} from './headers'
import type {
  DecompressFunc,
  Exth,
  MobiMetadata,
  Ncx,
  Offset,
} from './types'
import {
  decompressPalmDOC,
  getDecoder,
  getExth,
  getFont,
  getNCX,
  getRemoveTrailingEntries,
  getString,
  getStruct,
  getUint,
  huffcdic,
} from './book'

export class MobiFile {
  private fileArrayBuffer!: ArrayBuffer
  // extract from pdb header
  public recordsOffset!: Offset
  public recordsMagic!: string[]

  // book start index in records
  private start: number = 0

  // extract from first record
  public pdbHeader!: GetStruct<PdbHeader>
  public mobiHeader!: GetStruct<MobiHeader> & MobiHeaderExtends
  public palmdocHeader!: GetStruct<PalmdocHeader>
  public kf8Header?: GetStruct<Kf8Header>
  public exth?: Exth

  public isKf8: boolean = false
  // resource start index in records
  private resourceStart!: number

  public decoder!: TextDecoder
  public encoder!: TextEncoder
  public removeTrailingEntries!: (array: Uint8Array) => Uint8Array
  public decompress!: DecompressFunc

  constructor(file: ArrayBuffer) {
    this.fileArrayBuffer = file
    // pdbHeader, recordsOffset, recordsMagic
    this.parsePdbHeader()
    // palmdocHeader, mobiHeader, isKf8, exth
    this.parseFirstRecord(this.loadRecord(0))
    // resource start index in records
    this.resourceStart = this.mobiHeader.resourceStart
    if (!this.isKf8) {
      const boundary = this.exth!.boundary ?? 0xFFFFFFFF
      if (boundary < 0xFFFFFFFF) {
        try {
          this.parseFirstRecord(this.loadRecord(boundary))
          this.resourceStart = this.kf8Header?.resourceStart ?? this.mobiHeader.resourceStart
          this.start = boundary
          this.isKf8 = true
        }
        catch (e) {
          // console.warn('Failed to parse kf8 header, fallback to mobi header')
        }

        // console.warn('This seems to be a compatible file, which includes .kf8 and .mobi. '
        // + 'We will parse it as a mobi file.',
        // )
      }
    }

    // setup decoder, encoder, decompress, removeTrailingEntries
    this.setup()
  }

  decode(arr: ArrayBuffer): string {
    return this.decoder.decode(arr)
  }

  encode(str: string): Uint8Array {
    return this.encoder.encode(str)
  }

  loadRecord(index: number): ArrayBuffer {
    const [start, end] = this.recordsOffset[this.start + index]
    return this.fileArrayBuffer.slice(start, end)
  }

  loadMagic(index: number): string {
    return this.recordsMagic[this.start + index]
  }

  loadTextBuffer(index: number): Uint8Array {
    return this.decompress(
      this.removeTrailingEntries(
        new Uint8Array(
          this.loadRecord(index + 1),
        ),
      ),
    )
  }

  loadResource(index: number): Resource {
    const buf = this.loadRecord(this.resourceStart + index)
    const magic = getString(buf.slice(0, 4))
    let data: Uint8Array
    if (magic === 'FONT') {
      data = getFont(buf)
    }
    else if (magic === 'VIDE' || magic === 'AUDI') {
      data = new Uint8Array(buf.slice(12))
    }
    else {
      // no magic
      data = new Uint8Array(buf)
    }
    return {
      type: getFileMimeType(data),
      raw: data,
    }
  }

  getNCX(): Ncx | undefined {
    const index = this.mobiHeader.indx
    if (index < 0xFFFFFFFF) {
      return getNCX(index, this.loadRecord.bind(this))
    }
    return undefined
  }

  getMetadata(): MobiMetadata {
    const mobi = this.mobiHeader
    const exth = this.exth
    return {
      identifier: this.mobiHeader.uid.toString(),
      title: exth?.title || mobi.title,
      author: exth?.creator?.map(unescapeHTML) ?? [],
      publisher: exth?.publisher ?? '',
      // language in exth is many, we use the first one in this case
      language: exth?.language?.[0] ?? mobi.language,
      published: exth?.date ?? '',
      description: exth?.description ?? '',
      subject: exth?.subject?.map(unescapeHTML) ?? [],
      rights: exth?.rights ?? '',
      contributor: exth?.contributor ?? [],
    }
  }

  getCoverImage(): Resource | undefined {
    const exth = this.exth
    const coverOffset = Number(exth!.coverOffset ?? 0xFFFFFFFF)
    const thumbnailOffset = Number(exth!.thumbnailOffset ?? 0xFFFFFFFF)
    const offset = coverOffset < 0xFFFFFFFF
      ? coverOffset
      : thumbnailOffset < 0xFFFFFFFF
        ? thumbnailOffset
        : undefined
    if (offset) {
      return this.loadResource(offset)
    }
    return undefined
  }

  public parsePdbHeader() {
    const pdb = getStruct(pdbHeader, this.fileArrayBuffer.slice(0, 78))
    pdb.name = pdb.name.replace(/\0.*$/, '')
    this.pdbHeader = pdb
    const recordsBuffer = this.fileArrayBuffer.slice(78, 78 + pdb.numRecords * 8)

    const recordsStart = Array.from(
      { length: pdb.numRecords },
      (_, i) => getUint(recordsBuffer.slice(i * 8, i * 8 + 4)),
    )
    this.recordsOffset = recordsStart.map(
      (start, i) => [start, recordsStart[i + 1]],
    )

    this.recordsMagic = recordsStart.map(
      val => getString(this.fileArrayBuffer.slice(val, val + 4)),
    )
  }

  // palmdocHeader, mobiHeader, isKf8, exth
  public parseFirstRecord(firstRecord: ArrayBuffer) {
    // palmdocHeader
    this.palmdocHeader = getStruct(palmdocHeader, firstRecord.slice(0, 16))

    // mobiHeader
    const mobi = getStruct(mobiHeader, firstRecord)
    if (mobi.magic !== 'MOBI') {
      throw new Error('Missing MOBI header')
    }
    const { titleOffset, titleLength, localeLanguage, localeRegion } = mobi
    // extend mobiHeader through mobi property, title and language
    const lang = mobiLang[localeLanguage.toString()] ?? []
    const mobiHeaderExtends: MobiHeaderExtends = {
      title: getString(firstRecord.slice(titleOffset, titleOffset + titleLength)),
      language: lang[localeRegion >> 2] ?? lang[0] ?? 'unknown',
    }
    this.mobiHeader = Object.assign(mobi, mobiHeaderExtends)

    // kf8Header
    this.kf8Header = mobi.version >= 8
      ? getStruct(kf8Header, firstRecord)
      : undefined
    // isKf8
    this.isKf8 = mobi.version >= 8

    // exth, 16 is the length of palmdocHeader
    this.exth = mobi.exthFlag & 0b100_0000
      ? getExth(firstRecord.slice(mobi.length + 16), mobi.encoding)
      : undefined
  }

  // setup decoder, encoder, decompress, removeTrailingEntries
  public setup() {
    this.decoder = getDecoder(this.mobiHeader.encoding.toString())
    this.encoder = new TextEncoder()

    // set up decompressor
    const compression = this.palmdocHeader.compression
    if (compression === 1) {
      this.decompress = f => f
    }
    else if (compression === 2) {
      this.decompress = decompressPalmDOC
    }
    else if (compression === 17480) {
      this.decompress = huffcdic(this.mobiHeader, this.loadRecord.bind(this))
    }
    else {
      throw new Error('Unsupported compression')
    }

    // set up function for removing trailing bytes
    const trailingFlags = this.mobiHeader.trailingFlags
    this.removeTrailingEntries = getRemoveTrailingEntries(trailingFlags)
  }
}
