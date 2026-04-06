import { existsSync, mkdirSync, unlink } from 'node:fs'
import type { EBookParser, InputFile } from '@lingo-reader/shared'
import type {
  MimeToExt,
} from './utils'
import {
  MIME,
  saveResource,
} from './utils'
import {
  concatTypedArrays,
  getFragmentSelector,
  getIndexData,
  getMobiFileName,
  getStruct,
  getUint,
  kindleResourceRegex,
  makePosURI,
  parsePosURI,
  toArrayBuffer,
} from './book'
import { MobiFile } from './mobiFile'
import { fdstHeader } from './headers'
import type {
  FragTable,
  Kf8Chapter,
  Kf8CssPart,
  Kf8FileInfo,
  Kf8Guide,
  Kf8Metadata,
  Kf8ProcessedChapter,
  Kf8ResolvedHref,
  Kf8Spine,
  Kf8Toc,
  Kf8TocItem,
  NcxItem,
  SkelTable,
} from './types'

export async function initKf8File(file: InputFile, resourceSaveDir?: string) {
  const kf8 = new Kf8(file, resourceSaveDir)
  await kf8.innerLoadFile()
  await kf8.innerInit()

  return kf8
}

export class Kf8 implements EBookParser {
  private fileArrayBuffer!: ArrayBuffer
  private mobiFile!: MobiFile

  private fileName = ''

  private fdstTable: number[][] = []
  private fullRawLength: number = 0
  private skelTable: SkelTable = []
  private fragTable: FragTable = []
  private chapters: Kf8Chapter[] = []
  private toc: Kf8Toc = []

  private fragmentOffsets = new Map<number, number[]>()
  private fragmentSelectors = new Map<number, Map<number, string>>()

  private rawHead: Uint8Array<ArrayBuffer> = new Uint8Array()
  private rawTail: Uint8Array<ArrayBuffer> = new Uint8Array()
  private lastLoadedHead: number = -1
  private lastLoadedTail: number = -1

  private resourceCache = new Map<string, string>()
  private chapterCache = new Map<number, Kf8ProcessedChapter>()

  private idToChapter = new Map<number, Kf8Chapter>()
  private resourceSaveDir = './images'

  getFileInfo(): Kf8FileInfo {
    return {
      fileName: this.fileName,
    }
  }

  getMetadata(): Kf8Metadata {
    return this.mobiFile.getMetadata()
  }

  getCoverImage(): string {
    if (this.resourceCache.has('cover')) {
      return this.resourceCache.get('cover')!
    }

    const coverImage = this.mobiFile.getCoverImage()
    let coverUrl = ''
    if (coverImage) {
      coverUrl = saveResource(coverImage.raw, coverImage.type, 'cover', this.resourceSaveDir)
      this.resourceCache.set('cover', coverUrl)
    }
    return coverUrl
  }

  getSpine(): Kf8Spine {
    return this.chapters
  }

  getToc(): Kf8Toc {
    return this.toc
  }

  constructor(private file: InputFile, resourceSaveDir: string = './images') {
    this.fileName = getMobiFileName(file)

    this.resourceSaveDir = resourceSaveDir
    if (!__BROWSER__ && !existsSync(this.resourceSaveDir)) {
      mkdirSync(this.resourceSaveDir, { recursive: true })
    }
  }

  async innerLoadFile() {
    this.fileArrayBuffer = await toArrayBuffer(this.file)
    this.mobiFile = new MobiFile(this.fileArrayBuffer, this.fileName)
  }

  async innerInit() {
    const loadRecord = this.mobiFile.loadRecord.bind(this.mobiFile)
    const kf8Header = this.mobiFile.kf8Header!
    const fdstBuffer = this.mobiFile.loadRecord(kf8Header!.fdst)
    const fdst = getStruct(fdstHeader, fdstBuffer)
    if (fdst.magic !== 'FDST') {
      throw new Error('Missing FDST record')
    }
    // fdstTable
    const fdstTable = Array.from(
      { length: fdst.numEntries },
      (_, i) => 12 + i * 8,
    ).map(offset => [
      getUint(fdstBuffer.slice(offset, offset + 4)),
      getUint(fdstBuffer.slice(offset + 4, offset + 8)),
    ])
    this.fdstTable = fdstTable
    this.fullRawLength = fdstTable[fdstTable.length - 1][1]

    // skelTable
    const skelData = getIndexData(kf8Header.skel, loadRecord)
    const skelTable = skelData.table.map(({ name, tagMap }, index) => ({
      index,
      name,
      numFrag: tagMap[1][0],
      offset: tagMap[6][0],
      length: tagMap[6][1],
    }))
    this.skelTable = skelTable

    // fragTable
    const fragData = getIndexData(kf8Header.frag, loadRecord)
    const fragTable = fragData.table.map(({ name, tagMap }) => ({
      insertOffset: Number.parseInt(name),
      selector: fragData.cncx[tagMap[2][0]],
      index: tagMap[4][0],
      offset: tagMap[6][0],
      length: tagMap[6][1],
    }))
    this.fragTable = fragTable

    // chapter obj array
    const chapters = this.skelTable.reduce((acc, skel, index) => {
      const last = acc[acc.length - 1]
      const fragStart = last?.fragEnd ?? 0
      const fragEnd = fragStart + skel.numFrag
      const frags = this.fragTable.slice(fragStart, fragEnd)
      const length = skel.length + frags.reduce((a, v) => a + v.length, 0)
      const totalLength = (last?.totalLength ?? 0) + length
      const chapter = { id: index.toString(), skel, frags, fragEnd, length, totalLength }
      this.idToChapter.set(index, chapter)

      acc.push(chapter)
      return acc
    }, [] as Kf8Chapter[])
    this.chapters = chapters

    // table of contents
    const ncx = this.mobiFile.getNCX()
    if (ncx) {
      const map: (item: NcxItem) => Kf8TocItem = ({ label, pos, children }) => {
        const [fid, off] = pos
        const href = makePosURI(fid, off)
        const arr = this.fragmentOffsets.get(fid)
        if (arr) {
          arr.push(off)
        }
        else {
          this.fragmentOffsets.set(fid, [off])
        }
        return { label, href, children: children?.map(map) }
      }
      this.toc = ncx.map(map)
    }
  }

  getGuide(): Kf8Guide | undefined {
    const index = this.mobiFile.kf8Header!.guide
    if (index < 0xFFFFFFFF) {
      const loadRecord = this.mobiFile.loadRecord.bind(this.mobiFile)
      const { table, cncx } = getIndexData(index, loadRecord)
      return table.map(({ name, tagMap }) => ({
        label: cncx[tagMap[1][0]] ?? '',
        type: name?.split(/\s/),
        href: makePosURI(tagMap[6]?.[0] ?? tagMap[3]?.[0]),
      }))
    }
    return undefined
  }

  private loadRaw(start: number, end: number): Uint8Array {
    const distanceHead = end - this.rawHead.length
    const distanceEnd = this.fullRawLength === 0
      ? Infinity
      : (this.fullRawLength - this.rawTail.length) - start
    // load from the start
    if (distanceHead < 0 || distanceHead < distanceEnd) {
      while (this.rawHead.length < end) {
        this.lastLoadedHead++
        const index = this.lastLoadedHead
        const data = this.mobiFile.loadTextBuffer(index)
        this.rawHead = concatTypedArrays([this.rawHead, data]) as Uint8Array<ArrayBuffer>
      }
      return this.rawHead.slice(start, end)
    }
    // load from the end
    while (this.fullRawLength - this.rawTail.length > start) {
      this.lastLoadedTail++
      const index = this.mobiFile.palmdocHeader.numTextRecords - 1 - this.lastLoadedTail
      const data = this.mobiFile.loadTextBuffer(index)
      this.rawTail = concatTypedArrays([data, this.rawTail]) as Uint8Array<ArrayBuffer>
    }
    const rawTailStart = this.fullRawLength - this.rawTail.length
    return this.rawTail.slice(start - rawTailStart, end - rawTailStart)
  }

  private loadText(chapter: Kf8Chapter): string {
    const { skel, frags, length } = chapter
    const raw = this.loadRaw(skel.offset, skel.offset + length)
    let skeleton = raw.slice(0, skel.length)
    for (const frag of frags) {
      const insertOffset = frag.insertOffset - skel.offset
      const offset = skel.length + frag.offset
      const fragRaw = raw.slice(offset, offset + frag.length)
      skeleton = concatTypedArrays([
        skeleton.slice(0, insertOffset),
        fragRaw,
        skeleton.slice(insertOffset),
      ])

      const offsets = this.fragmentOffsets.get(frag.index)
      if (offsets) {
        for (const offset of offsets) {
          const str = this.mobiFile.decode(fragRaw.buffer).slice(offset)
          const selector = getFragmentSelector(str)
          if (selector) {
            this.cacheFragmentSelector(frag.index, offset, selector)
          }
        }
      }
    }
    return this.mobiFile.decode(skeleton.buffer)
  }

  loadChapter(id: string): Kf8ProcessedChapter | undefined {
    const numId = Number.parseInt(id)
    if (Number.isNaN(numId)) {
      return undefined
    }
    if (this.chapterCache.has(numId)) {
      return this.chapterCache.get(numId)
    }

    const chapter = this.idToChapter.get(numId)
    if (chapter) {
      const processed = this.replace(this.loadText(chapter))

      this.chapterCache.set(numId, processed)
      return processed
    }
    return undefined
  }

  private cacheFragmentSelector(id: number, offset: number, selector: string) {
    const map = this.fragmentSelectors.get(id)
    if (map) {
      map.set(offset, selector)
    }
    else {
      const map: Map<number, string> = new Map()
      this.fragmentSelectors.set(id, map)
      map.set(offset, selector)
    }
  }

  private loadFlow(index: number) {
    if (index < 0xFFFFFFFF) {
      return this.loadRaw(this.fdstTable[index][0], this.fdstTable[index][1])
    }
    return undefined
  }

  resolveHref(href: string): Kf8ResolvedHref | undefined {
    // is external link
    if (/^(?!blob|kindle)\w+:/i.test(href)) {
      return undefined
    }
    const { fid, off } = parsePosURI(href)
    const chapter = this.chapters.find(
      chapter => chapter.frags.some(
        frag => frag.index === fid,
      ),
    )
    if (!chapter) {
      return undefined
    }
    // return selector if cache
    const id = chapter.id
    const savedSelector = this.fragmentSelectors.get(fid)?.get(off)
    if (savedSelector) {
      return { id, selector: savedSelector }
    }

    // load fragment selector
    const { skel, frags } = chapter
    const frag = frags.find(frag => frag.index === fid)!
    const offset = skel.offset + skel.length + frag.offset
    const fragRaw = this.loadRaw(offset, offset + frag.length)
    const str = this.mobiFile.decode(fragRaw.buffer as ArrayBuffer).slice(off)
    const selector = getFragmentSelector(str)
    this.cacheFragmentSelector(fid, off, selector!)

    return { id, selector }
  }

  private replaceResources(str: string): string {
    return str.replace(
      new RegExp(kindleResourceRegex, 'gi'),
      (matched: string, resourceType: string, id: string, type: string) => {
        // cache
        if (this.resourceCache.has(matched)) {
          return this.resourceCache.get(matched)!
        }

        // load resource buffer
        const raw = resourceType === 'flow'
          ? this.loadFlow(Number.parseInt(id))
          : this.mobiFile.loadResource(Number.parseInt(id, 36) - 1).raw

        let blobData: Uint8Array | string = ''

        // TODO?: should handle xml html and xhtml file?
        // get blobData based on type
        if (type === MIME.CSS || type === MIME.SVG) {
          const text = this.mobiFile.decode(raw?.buffer as ArrayBuffer)
          const textReplaced = this.replaceResources(text)
          blobData = textReplaced
        }
        else {
          blobData = raw!
        }

        // convert to blob url
        const url = saveResource(blobData, type as keyof typeof MimeToExt, id, this.resourceSaveDir)

        this.resourceCache.set(matched, url)
        return url
      },
    )
  }

  private replace(str: string): Kf8ProcessedChapter {
    // css Part
    const cssUrls: Kf8CssPart[] = []
    const head = str.match(/<head[^>]*>([\s\S]*)<\/head>/i)![1]
    const links = head.match(/<link[^>]*>/gi) ?? []
    for (const link of links) {
      const linkHref = link.match(/href="([^"]*)"/i)![1]
      const id = link.match(kindleResourceRegex)![2]
      const href = this.replaceResources(linkHref)
      cssUrls.push({
        id,
        href,
      })
    }

    // html part
    const body = str.match(/<body[^>]*>([\s\S]*)<\/body>/i)![1]
    const bodyReplaced = this.replaceResources(body)

    return {
      html: bodyReplaced,
      css: cssUrls,
    }
  }

  destroy() {
    this.resourceCache.forEach((url) => {
      if (__BROWSER__) {
        URL.revokeObjectURL(url)
      }
      else {
        if (existsSync(url)) {
          unlink(url, () => { })
        }
      }
    })
  }
}
