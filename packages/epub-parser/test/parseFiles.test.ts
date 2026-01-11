import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { describe, expect, it, vi } from 'vitest'
import { parsexml } from '@lingo-reader/shared'
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
} from '../src/parseFiles'
import { prefixMatch } from '../src/utils'
import { RsaPrivateKey } from './keys/encryptionKey'

describe('parseMimeType', () => {
  it('should return application/epub+zip', () => {
    const file = 'application/epub+zip'
    expect(parseMimeType(file)).toBe('application/epub+zip')
  })

  it('should throw an error when file content is not \'application/epub\'', () => {
    const file = 'application/epub'
    expect(() => parseMimeType(file)).toThrowError('Unsupported mime type')
  })
})

describe('parseContainer', () => {
  it('full-path is "19033/content.opf"', async () => {
    const containerXML = `
      <?xml version='1.0' encoding='utf-8'?>
      <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
        <rootfiles>
          <rootfile media-type="application/oebps-package+xml" full-path="19033/content.opf"/>
        </rootfiles>
      </container>
    `
    const containerAST = await parsexml(containerXML)
    expect(parseContainer(containerAST)).toBe('19033/content.opf')
  })

  it('should throw an error when rootfiles is not found', () => {
    const containerXMLWithNoRootFiles = `
      <?xml version='1.0' encoding='utf-8'?>
      <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
      </container>
    `
    expect(
      async () => {
        const containerAST = await parsexml(containerXMLWithNoRootFiles)
        parseContainer(containerAST)
      },
    ).rejects.toThrowError('No <rootfiles></rootfiles> tag found in meta-inf/container.xml')
  })

  it('media-type must be "application/oebps-package+xml"', () => {
    const containerXMLWithWrongMediaType = `
      <?xml version='1.0' encoding='utf-8'?>
      <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
        <rootfiles>
          <rootfile media-type="application/epub+zip" full-path="19033/content.opf"/>
        </rootfiles>
      </container>
    `
    expect(
      async () => {
        const containerAST = await parsexml(containerXMLWithWrongMediaType)
        parseContainer(containerAST)
      },
    ).rejects.toThrowError('media-type of <rootfile/> application/oebps-package+xml')
  })

  it('full-path must be a relative path', () => {
    const containerXMLWithAbsolutePath = `
      <?xml version='1.0' encoding='utf-8'?>
      <container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0">
        <rootfiles>
          <rootfile media-type="application/oebps-package+xml" full-path="/19033/content.opf"/>
        </rootfiles>
      </container>
    `
    expect(
      async () => {
        const containerAST = await parsexml(containerXMLWithAbsolutePath)
        parseContainer(containerAST)
      },
    ).rejects.toThrowError('full-path must be a relative path')
  })
})

/**
 * see /packages/epub-parser/test/fixtures/*
 */
describe('parseMetadata', async () => {
  const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

  const metadataFilePath = path.resolve(fileURLToPath(import.meta.url), '../fixtures/metadata.opf')
  const fileContent = readFileSync(metadataFilePath, 'utf-8')
  const metadataAST = await parsexml(fileContent)
  const metadata = parseMetadata(metadataAST.package.metadata1[0])

  it('simple field', () => {
    expect(metadata.rights).toBe('Public domain in the USA.')
    expect(metadata.coverage).toBe('United States')
    expect(metadata.description).toBe('Alice\'s')
    expect(metadata.format).toBe('application/epub+zip')
    expect(metadata.publisher).toBe('Project Gutenberg')
    expect(metadata.relation).toBe('http://www.gutenberg.org/ebooks/19033')
    expect(metadata.source).toBe('http://www.gutenberg.org/files/19033/19033-h/19033-h.htm')
    expect(metadata.type).toBe('text')
    expect(metadata.title).toBe('Alice\'s Adventures in Wonderland')
    expect(metadata.language).toBe('en')
  })

  it('date field', () => {
    expect(metadata.date).toEqual({
      publication: '2006-08-12',
      conversion: '2010-02-16T12:34:12.754941+00:00',
    })
  })

  it('identifier field', () => {
    expect(metadata.identifier).toEqual({
      id: 'http://www.gutenberg.org/ebooks/19033',
      scheme: 'URI',
    })
    expect(metadata.packageIdentifier).toEqual({
      id: 'uuid:19c0c5cb-002b-476f-baa7-fcf510414f95',
      identifierType: '06',
      scheme: 'onix:codelist5',
    })
  })

  it('subject field', () => {
    expect(metadata.subject![0]).toEqual({
      subject: 'Fantasy',
      authority: 'BISAC',
      term: 'FIC024000',
    })
    expect(metadata.subject![1]).toEqual({
      subject: 'Fantasy fiction, English',
      authority: '',
      term: '',
    })
  })

  it('creator field', () => {
    expect(metadata.creator![0]).toEqual({
      'contributor': 'creator',
      'fileAs': 'Murakami, Haruki',
      'alternateScript': '上',
      'role': '',
      'foaf:homepage': 'http://example.org/book-info/12389347',
    })
    expect(metadata.creator![1]).toEqual({
      contributor: 'Rev. Dr. Martin Luther King Jr.',
      fileAs: 'King, Martin Luther Jr.',
      role: 'aut',
    })
  })

  it('contributor field', () => {
    expect(metadata.contributor![0]).toEqual({
      contributor: 'author',
      fileAs: '',
      role: '',
    })
    expect(metadata.contributor![1]).toEqual({
      contributor: 'Gordon Robinson',
      fileAs: 'Robinson, Gordon',
      role: 'ill',
    })
  })

  it('refined id does not exist, include <meta> and <tag> refines', () => {
    expect(warnSpy).toBeCalled()
    warnSpy.mockRestore()
  })

  it('metas field', () => {
    expect(metadata.metas).toEqual({
      'cover': 'item32',
      'dcterms:modified': '2016-02-29T12:34:56Z',
    })
  })

  it('links field', () => {
    expect(metadata.links!.length).toBe(4)
    expect(metadata.links![3]).toEqual({
      href: 'description.html',
      rel: 'dcterms:description',
      mediaType: 'text/html',
    })
  })

  it('metadata with no <meta> in <package>', async () => {
    const metadata2 = parseMetadata(metadataAST.package.metadata2[0])
    expect(metadata2.metas).toEqual({})
  })
})

describe('parseManifest', async () => {
  const manifestFilePath = path.resolve(fileURLToPath(import.meta.url), '../fixtures/manifest.opf')
  const fileContent = readFileSync(manifestFilePath, 'utf-8')
  const metadataAST = await parsexml(fileContent)
  it('normal resource', () => {
    const manifest = parseManifest(metadataAST.package.manifest0[0], '19033/')

    expect(manifest.c2).toEqual({
      id: 'c2',
      href: '19033/c2.xhtml',
      mediaType: 'application/xhtml+xml',
      properties: 'scripted mathml',
      mediaOverlay: '',
    })

    expect(manifest.ch1).toEqual({
      id: 'ch1',
      href: '19033/chapter1.xhtml',
      mediaType: 'application/xhtml+xml',
      properties: '',
      mediaOverlay: 'ch1_audio',
    })

    expect(manifest.item14).toEqual({
      id: 'item14',
      href: '19033/www.gutenberg.org@files@19033@19033-h@images@i010_th.jpg',
      mediaType: 'image/jpeg',
      properties: '',
      mediaOverlay: '',
    })

    expect(manifest.item29).toEqual({
      id: 'item29',
      href: '19033/pgepub.css',
      mediaType: 'text/css',
      properties: '',
      mediaOverlay: '',
    })

    expect(manifest.item32).toEqual({
      id: 'item32',
      href: '19033/www.gutenberg.org@files@19033@19033-h@19033-h-0.htm',
      mediaType: 'application/xhtml+xml',
      properties: '',
      mediaOverlay: '',
    })

    expect(manifest.ncx).toEqual({
      id: 'ncx',
      href: '19033/toc.ncx',
      mediaType: 'application/x-dtbncx+xml',
      properties: '',
      mediaOverlay: '',
    })
  })

  it('fallback', () => {
    const manifest = parseManifest(metadataAST.package.manifest1[0], '19033/')

    expect(manifest.img02.fallback).toEqual(['img01', 'infographic-svg'])
    expect(manifest.img01.fallback).toEqual(['infographic-svg'])
    expect(manifest['infographic-svg'].fallback).toBeUndefined()
    expect(manifest.img03.fallback).toEqual(['img01', 'infographic-svg'])
    expect(manifest.img04.fallback).toEqual(['img03', 'img01', 'infographic-svg'])
  })

  it('fallback cycle reference', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
    const manifest = parseManifest(metadataAST.package.manifest2[0], '19033/')

    expect(manifest.xhtml1).toEqual({
      id: 'xhtml1',
      href: '19033/html1',
      mediaType: 'application/xhtml+xml',
      fallback: ['xhtml2'],
      mediaOverlay: '',
      properties: '',
    })

    expect(manifest.xhtml2).toEqual({
      id: 'xhtml2',
      href: '19033/html2',
      mediaType: 'application/xhtml+xml',
      fallback: ['xhtml1'],
      mediaOverlay: '',
      properties: '',
    })

    expect(manifest.xhtml3).toEqual({
      id: 'xhtml3',
      href: '19033/html3',
      mediaType: 'application/xhtml+xml',
      fallback: ['xhtml2', 'xhtml1'],
      mediaOverlay: '',
      properties: '',
    })

    // cycle reference warning
    expect(warnSpy).toBeCalled()
    warnSpy.mockRestore()
  })

  it('lack of necessary info: href', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
    parseManifest(metadataAST.package.manifest3[0], '19033/')
    expect(warnSpy).toBeCalledWith('The item in manifest must have attributes id, href and mediaType. So skip this item.')
    warnSpy.mockRestore()
  })

  it('no <item>', () => {
    expect(
      () => parseManifest(metadataAST.package.manifest4[0], ''),
    ).toThrowError('The manifest element must contain one or more item elements')
  })
})

describe('parseSpine', async () => {
  const spineFilePath = path.resolve(fileURLToPath(import.meta.url), '../fixtures/spine.opf')
  const fileContent = readFileSync(spineFilePath, 'utf-8')
  const spineAST = await parsexml(fileContent)

  it('should handle tocPath, idref and linear', () => {
    const manifest = {
      'ncx': {
        id: 'ncx',
        href: 'toc.ncx',
        mediaType: 'application/x-dtbncx+xml',
        properties: '',
        mediaOverlay: '',
      },
      'intro': {
        id: 'intro',
        href: 'intro.xhtml',
        mediaType: 'application/xhtml+xml',
        properties: '',
        mediaOverlay: '',
      },
      'c1': {
        id: 'c1',
        href: 'chapter1.xhtml',
        mediaType: 'application/xhtml+xml',
        properties: '',
        mediaOverlay: '',
      },
      'c1-answerkey': {
        id: 'c1-answerkey',
        href: 'chapter1-answerkey.xhtml',
        mediaType: 'application/xhtml+xml',
        properties: '',
        mediaOverlay: '',
      },
    }
    const { tocPath, spine } = parseSpine(spineAST.package.spine0[0], manifest)
    expect(tocPath).toBe('toc.ncx')
    expect(spine.length).toBe(3)
    expect(spine[2]).toEqual({
      id: 'c1-answerkey',
      href: 'epub:chapter1-answerkey.xhtml',
      mediaType: 'application/xhtml+xml',
      properties: '',
      mediaOverlay: '',
      linear: 'no',
    })
  })

  it('will throw an error when itemref is not found', () => {
    expect(
      () => parseSpine(spineAST.package.spine1[0], {}),
    ).toThrowError('The spine element must contain one or more itemref elements')
  })

  it('toc path id is not found', () => {
    const manifest = {
      intro: {
        id: 'intro',
        href: 'intro.xhtml',
        mediaType: 'application/xhtml+xml',
        properties: '',
        mediaOverlay: '',
      },
    }
    const { tocPath, spine } = parseSpine(spineAST.package.spine2[0], manifest)
    expect(tocPath).toBe('')
    expect(spine.length).toBe(1)
  })
})

describe('parseGuide', async () => {
  const guideFilePath = path.resolve(fileURLToPath(import.meta.url), '../fixtures/guide.opf')
  const fileContent = readFileSync(guideFilePath, 'utf-8')
  const guideAST = await parsexml(fileContent)

  it('should parse guide reference: type, title, href', () => {
    const guide = parseGuide(guideAST.package.guide0[0], '19033/')
    expect(guide.length).toBe(3)
    expect(guide[2]).toEqual({
      type: 'other.intro',
      title: 'Introduction',
      href: 'epub:19033/intro.html',
    })
  })

  it('will throw an error when reference is not found', () => {
    expect(
      () => parseGuide(guideAST.package.guide1[0], ''),
    ).toThrowError('Within the package there may be one guide element, containing one or more reference elements.')
  })
})

describe('parseCollection', async () => {
  const collectionFilePath = path.resolve(fileURLToPath(import.meta.url), '../fixtures/collection.opf')
  const fileContent = readFileSync(collectionFilePath, 'utf-8')
  const collectionAST = await parsexml(fileContent)

  it('should parse collection', () => {
    const collections = parseCollection(collectionAST.package.collection, '19033/')
    expect(collections.length).toBe(1)
    expect(collections).toEqual([{
      role: 'index',
      links: [
        '19033/subjectIndex01.xhtml',
        '19033/subjectIndex02.xhtml',
        '19033/subjectIndex03.xhtml',
      ],
    }])
  })
})

// .ncx file
describe('parseNcx', async () => {
  const navMapFilePath = path.resolve(fileURLToPath(import.meta.url), '../fixtures/toc.ncx')
  const fileContent = readFileSync(navMapFilePath, 'utf-8')
  const ncxAST = await parsexml(fileContent)

  it('parse navMap', () => {
    const hrefToIdMap = {
      'OEBPS/content.html': 'id',
    }
    const navMap = parseNavMap(
      ncxAST.ncx.navMap[0],
      hrefToIdMap,
      'OEBPS/',
    )
    expect(navMap.length).toBe(3)
    expect(navMap[0].children!.length).toBe(1)
    expect(navMap[2]).toEqual({
      label: '',
      href: 'epub:OEBPS/,content2.html#ch_3',
      id: undefined,
      playOrder: '',
    })
  })

  it('parse pageList without top navLabel', () => {
    const pageList = parsePageList(
      ncxAST.ncx.pageList[0],
      {
        'OEBPS/content.html': 'id',
      },
      'OEBPS/',
    )
    expect(pageList.label).toBe('')
    expect(pageList.pageTargets.length).toBe(3)
    expect(pageList.pageTargets[2]).toEqual({
      label: '',
      value: '',
      href: 'epub:OEBPS/content3.html#p3',
      playOrder: '',
      type: '',
      correspondId: undefined,
    })
  })

  it('parse pageList with top navLabel', () => {
    const pageList = parsePageList(
      ncxAST.ncx.pageList2[0],
      {
        'OEBPS/content.html': 'id',
      },
      'OEBPS/',
    )
    expect(pageList.label).toBe('1')
    expect(pageList.pageTargets.length).toBe(1)
  })

  it('parse navList', () => {
    const navList = parseNavList(
      ncxAST.ncx.navList[0],
      {
        'OEBPS/content.html': 'id',
      },
      'OEBPS/',
    )
    expect(navList.label).toBe('List of Illustrations')
    expect(navList.navTargets.length).toBe(3)
    expect(navList.navTargets[2]).toEqual({
      label: '',
      href: 'epub:OEBPS/content2.html#ill2',
      correspondId: undefined,
    })
  })
})

describe('parseEncryption', async () => {
  // @ts-expect-error __BROWSER__ is for build process
  globalThis.__BROWSER__ = false

  const encryptions = readFileSync(
    fileURLToPath(new URL('./fixtures/encryption.xml', import.meta.url)),
    'utf-8',
  )
  const encryptionsAST = await parsexml(encryptions, {
    tagNameProcessors: [(str: string) => str.replace(prefixMatch, '')],
  })
  const enc = encryptionsAST.enc

  it('has encryptedKeys but no rsaPrivateKey provided', async () => {
    const enc0 = enc.enc0[0]
    // Warning: if <encryption> in root, its children will be an object
    // but if <encryption> is in <package> and others, its children will be an array
    enc0.encryption = enc0.encryption[0]

    await expect(async () => {
      await parseEncryption(enc.enc0[0], {})
    }).rejects.toThrowError('Please provide the RSA private key to decrypt the encrypted AES keys.')
  })

  it('the file encrypted with aes, but no aesKey provided', async () => {
    const enc1 = enc.enc1[0]
    enc1.encryption = enc1.encryption[0]
    await expect(async () => {
      await parseEncryption(enc1, {})
    }).rejects.toThrowError('The file is encrypted with AES, but no symmetric key is provided.')
  })

  it('unsupported asymmetric encryption(except for rsa)', async () => {
    const enc2 = enc.enc2[0]
    enc2.encryption = enc2.encryption[0]
    await expect(async () => {
      await parseEncryption(enc2, {
        rsaPrivateKey: Buffer.from('private key', 'base64'),
      })
    }).rejects.toThrowError('Unsupported encryption algorithm: kw-rsa-oaep. Only RSA and AES algorithms are supported.')
  })

  it('no symmetric key found for id', async () => {
    const enc3 = enc.enc3[0]
    enc3.encryption = enc3.encryption[0]
    await expect(async () => {
      await parseEncryption(enc3, {
        rsaPrivateKey: Buffer.from(RsaPrivateKey, 'base64'),
      })
    }).rejects.toThrowError('No symmetric key found for id "NOID". Skipping decryption for file "EPUB/xhtml/cover.xhtml"')
  })

  it('unsupported encryption symmetric algorithm', async () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })
    const enc4 = enc.enc4[0]
    enc4.encryption = enc4.encryption[0]
    await parseEncryption(enc4, {
      aesSymmetricKey: Buffer.from('symmetric key', 'base64'),
    })
    expect(warnSpy).toBeCalled()
    expect(warnSpy).toHaveBeenCalledWith(
      'Unsupported encryption algorithm: kw-aes192-cbc. Only AES and RSA algorithms are supported.',
    )
    warnSpy.mockRestore()
  })

  it('lingo-reader doesn\'t support font obfuscation', async () => {
    const enc5 = enc.enc5[0]
    enc5.encryption = enc5.encryption[0]
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => { })
    const res = await parseEncryption(enc5, {})
    expect(consoleWarn).toBeCalledWith('lingo-reader doesn\'t handle font obfuscation and it doesn\'t read the font file.')
    expect(res).toEqual({})
    consoleWarn.mockRestore()
  })

  it('font obfuscation and normal encrypted data', async () => {
    const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => { })
    const enc6 = enc.enc6[0]
    enc6.encryption = enc6.encryption[0]
    const res = await parseEncryption(enc6, {
      aesSymmetricKey: Buffer.from('symmetric key', 'base64'),
    })
    expect(consoleWarn).toBeCalledWith('lingo-reader doesn\'t handle font obfuscation and it doesn\'t read the font file.')
    expect(res['EPUB/xhtml/chapter2.xhtml'].length).toBe(2)
    consoleWarn.mockRestore()
  })
})
