import type { EBookParser, InputFile } from '@lingo-reader/shared'
import { parsexml, path } from '@lingo-reader/shared'
import { existsSync, mkdirSync, unlink, writeFileSync } from './fsPolyfill'
import { type ZipFile, createZipFile, extractEncryptionKeys, prefixMatch, savedResourceMediaTypePrefixes } from './utils'
import type {
  EncryptionKeys,
  EpubCollection,
  EpubFileInfo,
  EpubFileOptions,
  EpubGuide,
  EpubMetadata,
  EpubProcessedChapter,
  EpubResolvedHref,
  EpubSpine,
  EpubToc,
  ManifestItem,
  NavList,
  NavPoint,
  PageList,
} from './types'
import {
  parseCollection,
  parseContainer,
  parseEncryption,
  parseGuide,
  parseManifest,
  parseMetadata,
  parseMimeType,
  parseNavList,
  parseNavMap,
  parsePageList,
  parseSpine,
} from './parseFiles'
import { getResourceUrl, parseSmil, revokeBlobUrls, transformHTML } from './transformChapter'
import { HREF_PREFIX } from './constant'
/*
  TODO: parse links in meta-inf/container.xml
*/

// wrapper for async constructor, because EpubFile class has async code
export async function initEpubFile(
  epubPath: InputFile,
  resourceSaveDir: string = './images',
  options: EpubFileOptions = {},
): Promise<EpubFile> {
  const epub = new EpubFile(epubPath, resourceSaveDir, options)
  await epub.loadEpub()
  await epub.parse()
  return epub
}

/**
 * The class EpubFile is an epub file parse manager.
 * It has a ZipFile instance used to read files in epub file. Its function
 *  is to read and parse(xml) the content of epub file and then hand it
 *  over to other functions for processing. Finally, the infomation extracted
 *  from epub file is stored in the form of EpubFile class attributes.
 */
export class EpubFile implements EBookParser {
  private fileName: string = ''
  private mimeType: string = ''
  public getFileInfo(): EpubFileInfo {
    return {
      fileName: this.fileName,
      mimetype: this.mimeType,
    }
  }

  /**
   * <metadata> in .opf file
   */
  private metadata?: EpubMetadata
  public getMetadata(): EpubMetadata {
    return this.metadata!
  }

  /**
   * <manifest> in .opf file
   */
  private manifest: Record<string, ManifestItem> = {}
  public getManifest(): Record<string, ManifestItem> {
    return this.manifest
  }

  /**
   * <spine> in .opf file
   */
  private spine: EpubSpine = []
  public getSpine(): EpubSpine {
    return this.spine
  }

  /**
   * <guide> in .opf file
   */
  private guide: EpubGuide = []
  public getGuide(): EpubGuide {
    // ??? maybe return manifest when there is no <guide> in .opf file
    return this.guide
  }

  /**
   * <collection> in .opf file
   */
  private collections: EpubCollection = []
  public getCollection(): EpubCollection {
    return this.collections
  }

  /**
   * <navMap> in .ncx file
   *  which is default value if there is no <navMap> in epub file
   */
  private navMap: NavPoint[] = []
  public getToc(): EpubToc {
    return this.navMap
  }

  /**
   * <pageList> in .ncx file
   *  which is default value if there is no <pageList> in epub file
   */
  private pageList!: PageList
  public getPageList(): PageList {
    return this.pageList
  }

  /**
   * <navList> in .ncx file,
   *  which is default value if there is no <navList> in epub file
   */
  private navList!: NavList

  public getNavList(): NavList {
    return this.navList
  }

  /**
   * zip processing class
   */
  private zip!: ZipFile

  private opfPath: string = ''
  private opfDir: string = ''
  private resourceSaveDir: string
  private encryptionKeys: EncryptionKeys = {}

  constructor(
    private epub: InputFile,
    resourceSaveDir: string = './images',
    private options: EpubFileOptions = {},
  ) {
    if (typeof epub === 'string') {
      this.fileName = path.basename(epub)
    }
    else if (epub instanceof Uint8Array) {
      this.fileName = ''
    }
    else {
      this.fileName = epub.name
    }

    this.resourceSaveDir = resourceSaveDir
    if (!existsSync(this.resourceSaveDir)) {
      mkdirSync(this.resourceSaveDir, { recursive: true })
    }

    this.encryptionKeys = extractEncryptionKeys(this.options)
  }

  async loadEpub(): Promise<void> {
    this.zip = await createZipFile(this.epub)
  }

  public async parse(): Promise<void> {
    // mimetype
    const mimetype = await this.zip.readFile('mimetype')
    this.mimeType = parseMimeType(mimetype)

    // meta-inf/container.xml
    const containerXml = await this.zip.readFile('meta-inf/container.xml')
    const containerAST = await parsexml(containerXml)
    // full-path
    this.opfPath = parseContainer(containerAST)
    this.opfDir = path.dirname(this.opfPath)

    // meta-inf/encryption.xml
    if (this.zip.hasFile('meta-inf/encryption.xml')) {
      const encryptionXml = await this.zip.readFile('meta-inf/encryption.xml')
      const encryptionAST = await parsexml(encryptionXml, {
        tagNameProcessors: [(str: string) => str.replace(prefixMatch, '')],
      })
      const pathToProcessors = await parseEncryption(encryptionAST, this.encryptionKeys)
      this.zip.useDeprocessors(pathToProcessors)
    }

    // .opf file
    await this.parseRootFile()
  }

  private savedResourcePath: string[] = []
  private hrefToIdMap: Record<string, string> = {}
  /**
   * parse .opf file
   */
  private async parseRootFile(): Promise<void> {
    const rootFileOPF = await this.zip.readFile(this.opfPath)
    const xml = await parsexml(rootFileOPF)
    const rootFile = xml.package

    let tocPath = ''
    for (const key in rootFile) {
      switch (key) {
        case 'metadata': {
          this.metadata = parseMetadata(rootFile[key][0])
          break
        }
        case 'manifest': {
          // href will pad with 'epub:' except for manifest item
          //  we should use resolveHref to get the real href
          this.manifest = parseManifest(rootFile[key][0], this.opfDir)
          // save element if it is a resource, such as image, css
          // which was determined by media-type
          for (const key in this.manifest) {
            const manifestItem = this.manifest[key]

            this.hrefToIdMap[manifestItem.href] = manifestItem.id

            // css and image|font|audio|video
            if (
              savedResourceMediaTypePrefixes.has(manifestItem.mediaType)
              // exclude html and xhtml...
              || manifestItem.mediaType.startsWith('text/css')
            ) {
              const fileName: string = manifestItem.href.replace(/\//g, '_')
              const filePath = path.resolve(this.resourceSaveDir, fileName)
              this.savedResourcePath.push(filePath)
              writeFileSync(
                filePath,
                await this.zip.readResource(manifestItem.href),
              )
            }
          }
          break
        }
        case 'spine': {
          const res = parseSpine(rootFile[key][0], this.manifest)
          // .ncx file path
          tocPath = res.tocPath
          this.spine = res.spine
          break
        }
        case 'guide': {
          this.guide = parseGuide(rootFile[key][0], this.opfDir)
          break
        }
        case 'collection': {
          this.collections = parseCollection(rootFile[key], this.opfDir)
          break
        }
      }
    }

    // .ncx file
    if (tocPath.length > 0) {
      const tocDir = path.dirname(tocPath)
      const tocNcxFile = await this.zip.readFile(tocPath)
      const ncx = (await parsexml(tocNcxFile)).ncx
      // navMap
      if (ncx.navMap)
        this.navMap = parseNavMap(ncx.navMap[0], this.hrefToIdMap, tocDir)

      // pageList
      if (ncx.pageList)
        this.pageList = parsePageList(ncx.pageList[0], this.hrefToIdMap, tocDir)

      // navList
      if (ncx.navList)
        this.navList = parseNavList(ncx.navList[0], this.hrefToIdMap, tocDir)
    }
  }

  private chapterCache = new Map<string, EpubProcessedChapter>()
  /**
   * replace <img> src absolute path or blob url
   * @param id the manifest item id of the chapter
   * @returns replaced html string
   */
  public async loadChapter(id: string): Promise<EpubProcessedChapter> {
    if (this.chapterCache.has(id)) {
      return this.chapterCache.get(id)!
    }
    const htmlManifest = this.manifest[id]
    // html
    const xmlHref = htmlManifest.href
    const htmlDir = path.dirname(xmlHref)
    const transformed = transformHTML(
      await this.zip.readFile(xmlHref),
      htmlDir,
      this.resourceSaveDir,
    )
    // media-overlay
    const mediaOverlayId = htmlManifest.mediaOverlay
    if (mediaOverlayId) {
      const smilManifest = this.manifest[mediaOverlayId]
      const smilHref = smilManifest.href
      const audios = parseSmil(
        await parsexml(
          await this.zip.readFile(smilHref),
          {
            preserveChildrenOrder: true,
            explicitChildren: true,
            childkey: 'children',
          },
        ),
        path.dirname(smilHref),
        this.resourceSaveDir,
      )
      transformed.mediaOverlays = audios
    }

    this.chapterCache.set(id, transformed)
    return transformed
  }

  public resolveHref(href: string): EpubResolvedHref | undefined {
    if (!href.startsWith(HREF_PREFIX)) {
      return undefined
    }
    // remove 'epub:'
    href = href.slice(5).trim()
    const [urlPath, hrefId] = href.split('#')
    // id
    let id = ''
    if (this.hrefToIdMap[urlPath]) {
      id = this.hrefToIdMap[urlPath]
    }
    else {
      return undefined
    }
    // selector
    let selector = ''
    if (hrefId) {
      selector = `[id="${hrefId}"]`
    }
    return {
      id,
      selector,
    }
  }

  public getCoverImage(): string {
    const coverGuideRef = this.guide.find(ref => ref.type === 'cover')
    if (coverGuideRef) {
      const imageId = this.resolveHref(coverGuideRef.href)!.id
      const imageManifest = this.manifest[imageId]
      // imageManifest.href is an absolute path in zip, so the htmlDir is ''
      const imageSrc = getResourceUrl(imageManifest.href, '', this.resourceSaveDir)
      return imageSrc
    }
    return ''
  }

  public destroy() {
    // resource in file system
    this.savedResourcePath.forEach((filePath) => {
      if (existsSync(filePath)) {
        unlink(filePath)
      }
    })
    this.savedResourcePath.length = 0
    // blob urls
    revokeBlobUrls()
  }
}
