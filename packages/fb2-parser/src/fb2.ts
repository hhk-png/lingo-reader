import { existsSync, mkdirSync, unlink } from 'node:fs'
import type { EBookParser, FileInfo, InputFile } from '@lingo-reader/shared'
import { parsexml } from '@lingo-reader/shared'
import {
  buildFb2Href,
  buildIdToSectionMap,
  extractFileData,
  getFirstXmlNodeText,
  saveResource,
  saveStylesheet,
  transformTagName,
} from './utils'
import type {
  Fb2ChapterMap,
  Fb2Metadata,
  Fb2ProcessedChapter,
  Fb2ResolvedHref,
  Fb2ResourceMap,
  Fb2Spine,
  Fb2Toc,
} from './types'
import { parseBinary, parseDescription } from './parseXmlNodes'
import { HREF_PREFIX, ID_PREFIX, STYLESHEET_ID } from './constant'

export async function initFb2File(
  fb2: InputFile,
  resourceSaveDir: string = './images',
) {
  const fb2Instance = new Fb2File(fb2, resourceSaveDir)
  await fb2Instance.loadFb2()

  return fb2Instance
}

// section Id and fb2 id are different

export class Fb2File implements EBookParser {
  // resource
  private resourceSaveDir: string

  // global id to Resource
  private resourceStore!: Fb2ResourceMap
  // id to url
  private resourceCache: Map<string, string> = new Map()
  // chapter id to processed chapter
  private chapterCache: Map<string, Fb2ProcessedChapter> = new Map()
  // stylesheet Url
  private stylesheetUrl: string = ''

  // chapters
  private chapterStore: Fb2ChapterMap = new Map()
  private idToChapterIdMap = new Map<string, string>()

  // Toc
  private tableOfContent: Fb2Toc = []
  public getToc() {
    return this.tableOfContent
  }

  // spine
  private spine: Fb2Spine = []
  public getSpine() {
    return this.spine
  }

  private metadata!: Fb2Metadata
  public getMetadata() {
    return this.metadata
  }

  private fileName!: string
  public getFileInfo(): FileInfo {
    return {
      fileName: this.fileName,
    }
  }

  private coverImageId!: string
  public getCoverImage(): string {
    if (this.resourceCache.has(this.coverImageId)) {
      return this.resourceCache.get(this.coverImageId)!
    }
    if (this.coverImageId.length > 0 && this.resourceStore.has(this.coverImageId)) {
      const resourcePath = saveResource(
        this.resourceStore.get(this.coverImageId)!,
        this.resourceSaveDir,
      )
      this.resourceCache.set(this.coverImageId, resourcePath)
      return resourcePath
    }
    return ''
  }

  constructor(
    private fb2: InputFile,
    resourceSaveDir: string = './images',
  ) {
    this.resourceSaveDir = resourceSaveDir
    if (!__BROWSER__ && !existsSync(this.resourceSaveDir)) {
      mkdirSync(this.resourceSaveDir, { recursive: true })
    }
  }

  public async loadFb2() {
    const { data: fb2Uint8Array, fileName } = await extractFileData(this.fb2)
    this.fileName = fileName
    // load fb2
    const res = await parsexml(fb2Uint8Array, {
      charsAsChildren: true,
      preserveChildrenOrder: true,
      explicitChildren: true,
      childkey: 'children',
      trim: true,
    })
    const fictionBook = res.FictionBook

    // parse xml node
    this.resourceStore = parseBinary(fictionBook.binary)

    // description
    const { metadata, coverImageId, history } = parseDescription(fictionBook.description[0])
    this.metadata = metadata
    this.coverImageId = coverImageId
    if (history) {
      this.metadata.history = this.serializeNode(history)
    }

    // stylesheet
    if (fictionBook.stylesheet) {
      this.stylesheetUrl = saveStylesheet(fictionBook.stylesheet[0]._, this.resourceSaveDir)
      this.resourceCache.set(STYLESHEET_ID, this.stylesheetUrl)
    }

    let sectionId = 0
    // body
    for (const body of fictionBook.body) {
      const isUnnamedBody = !body.$?.name
      for (const sectionNode of body.section) {
        // chapter id
        const id = ID_PREFIX + sectionId
        // get chapter name
        const name = isUnnamedBody
          ? getFirstXmlNodeText(sectionNode.title)
          : body.$.name
        // save chapter
        this.chapterStore.set(id, {
          id,
          sectionNode,
          ...(isUnnamedBody ? {} : { name }),
        })
        // add to spine
        this.spine.push({ id })
        // toc
        this.tableOfContent.push({
          label: name,
          href: buildFb2Href(id),
        })
        buildIdToSectionMap(id, sectionNode, this.idToChapterIdMap)
        sectionId++
      }
    }
  }

  private serializeAttr(attrs: Record<string, string>, tagName: string): string {
    if (!attrs) {
      return ''
    }

    const res: string[] = []
    for (const key in attrs) {
      const value = attrs[key]
      if (key === 'l:href' || key === 'xlink:href') {
        const id = value.slice(1)
        // <a>
        if (tagName === 'a' && this.idToChapterIdMap.has(id)) {
          res.push(`href="${buildFb2Href(
            this.idToChapterIdMap.get(id)!,
            id,
          )}"`)
        }
        else if (tagName === 'a' && value.startsWith('http')) {
          res.push(`href="${value}"`)
        }
        // <img>
        else if (tagName === 'img' && this.resourceStore.has(id)) {
          const resourceUrl = saveResource(
            this.resourceStore.get(id)!,
            this.resourceSaveDir,
          )
          this.resourceCache.set(id, resourceUrl)
          res.push(`src="${resourceUrl}"`)
        }
        else {
          res.push('')
        }
      }
      else {
        res.push(`${key}="${value}"`)
      }
    }
    return res.filter(Boolean).join(' ')
  }

  private serializeChildren(sectionNode: any) {
    const res: string[] = []
    for (const node of sectionNode.children) {
      if (node['#name'] === '__text__') {
        res.push(node._.replace(/^\s+|\s+$/g, ' '))
      }
      else {
        const { tag, isSelfClosing } = transformTagName(node['#name'])
        const attrStr = this.serializeAttr(node.$, tag)
        const targetAttrStr = attrStr.length > 0 ? (` ${attrStr}`) : ''
        let childrenStr = ''
        if (node.children) {
          childrenStr = this.serializeChildren(node)
        }
        res.push(
          isSelfClosing
            ? `<${tag}${targetAttrStr}/>`
            : `<${tag}${targetAttrStr}>${childrenStr}</${tag}>`,
        )
      }
    }
    return res.join('')
  }

  private serializeNode(sectionNode: any): string {
    const attrStr = this.serializeAttr(sectionNode.$, 'div')
    const childrenStr = this.serializeChildren(sectionNode)
    return `<div${attrStr}>${childrenStr}</div>`
  }

  public loadChapter(id: string): Fb2ProcessedChapter | undefined {
    if (!this.chapterStore.has(id)) {
      return undefined
    }
    if (this.chapterCache.has(id)) {
      return this.chapterCache.get(id)!
    }

    const chapter = this.chapterStore.get(id)!
    const transformedSection = {
      html: this.serializeNode(chapter.sectionNode),
      css: this.stylesheetUrl.length > 0
        ? [{ id: `${ID_PREFIX}css`, href: this.stylesheetUrl }]
        : [],
    }

    this.chapterCache.set(id, transformedSection)
    return transformedSection
  }

  public resolveHref(fb2Href: string): Fb2ResolvedHref | undefined {
    if (!fb2Href.startsWith(HREF_PREFIX)) {
      return undefined
    }
    // remove 'fb2:'
    fb2Href = fb2Href.slice(HREF_PREFIX.length).trim()
    const [chapterId, globalId] = fb2Href.split('#')
    const id = this.chapterStore.get(chapterId)?.id
    if (!id) {
      return undefined
    }
    let selector = ''
    if (globalId) {
      selector = `[id="${globalId}"]`
    }
    return {
      id,
      selector,
    }
  }

  public destroy() {
    this.resourceCache.forEach((path) => {
      if (__BROWSER__) {
        URL.revokeObjectURL(path)
      }
      else {
        if (existsSync(path)) {
          unlink(path, () => { })
        }
      }
    })
    this.resourceCache.clear()
    this.chapterCache.clear()
    this.resourceStore?.clear()
    this.chapterStore.clear()
  }
}
