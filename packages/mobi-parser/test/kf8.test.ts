import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { type Kf8, initKf8File } from '../src'

describe('kf8 class', () => {
  let kf8: Kf8
  beforeAll(async () => {
    // @ts-expect-error globalThis.__BROWSER__
    globalThis.__BROWSER__ = false
    kf8 = await initKf8File('./example/taoyong.azw3')
  })

  it('getSpine', () => {
    const spine = kf8.getSpine()
    expect(spine.length).toBe(32)
    const lastSpine = spine[spine.length - 1]
    expect(lastSpine).toEqual({
      id: '31',
      skel: {
        index: 31,
        name: 'SKEL0000000031',
        numFrag: 1,
        offset: 358611,
        length: 284,
      },
      frags: [
        {
          index: 61,
          insertOffset: 358879,
          length: 3100,
          offset: 0,
          selector: 'P-//*[@aid=\'TI1E0\']',
        },
      ],
      fragEnd: 62,
      length: 3384,
      totalLength: 361995,
    })
  })

  // TODO: add test cases with children
  it('getToc', () => {
    const toc = kf8.getToc()
    expect(toc!.length).toBe(30)
    const lastToc = toc![toc!.length - 1]
    expect(lastToc).toEqual({
      label: '后记',
      href: 'kindle:pos:fid:001S:off:0000000000',
      children: undefined,
    })
  })

  it('loadChapter when id exist in spine', () => {
    const spine = kf8.getSpine()
    const chapter = spine[0]
    // test cache
    const { html, css } = kf8.loadChapter(chapter.id)!
    const { html: html2, css: css2 } = kf8.loadChapter(chapter.id)!
    expect(html).toBe(html2)
    expect(css).toEqual(css2)
    // html src should be replaced
    const htmlSrc = html.match('src="(.+?)"')![1]
    expect(htmlSrc).toBe(path.resolve('./images', '0007.jpg'))
    // css href
    expect(css).toEqual([
      {
        id: '0002',
        href: path.resolve('./images', '0002.css'),
      },
      {
        id: '0001',
        href: path.resolve('./images', '0001.css'),
      },
    ])
    // fileExist
    expect(existsSync(htmlSrc)).toBeTruthy()
    expect(existsSync(css[0].href)).toBeTruthy()
    expect(existsSync(css[1].href)).toBeTruthy()
  })

  it('loadChapter when id not exist in spine', () => {
    const chapter = kf8.loadChapter('100')
    expect(chapter).toBeUndefined()
  })

  it('loadChapter when id is not a number', () => {
    expect(kf8.loadChapter('abc')).toBeUndefined()
  })

  it('resolveHref when href format is correct', () => {
    const toc = kf8.getToc()
    // kindle:pos:fid:0000:off:0000000000
    const href = toc![0].href
    const resolvedHref = kf8.resolveHref(href)
    expect(resolvedHref).toEqual({
      id: '0',
      selector: '[id="calibre_pb_0"]',
    })
    // cache
    const resolvedHref2 = kf8.resolveHref(href)
    expect(resolvedHref).toEqual(resolvedHref2)
    // uncached
    const uncachedHref = kf8.resolveHref('kindle:pos:fid:0000:off:0000000023')
    expect(uncachedHref).toEqual({ id: '0', selector: '[aid="2"]' })
  })

  it('resolveHref when href format is incorrect', () => {
    const resolvedHref = kf8.resolveHref('wrong:href')
    expect(resolvedHref).toBeUndefined()
    // chapter not exist
    const resolvedHref2 = kf8.resolveHref('kindle:pos:fid:0032:off:0000000000')
    expect(resolvedHref2).toBeUndefined()
  })

  it('getGuide', () => {
    const guide = kf8.getGuide()
    expect(guide).toEqual([
      {
        label: 'Table of Contents',
        type: ['toc'],
        href: 'kindle:pos:fid:001T:off:0000000000',
      },
    ])
  })

  it('getMetadata', () => {
    const metadata = kf8.getMetadata()
    expect(metadata).toEqual({
      identifier: '2681144926',
      title: '自造',
      author: ['陶勇'],
      publisher: 'www.huibooks.com',
      language: 'zh',
      published: '2021-11-30 16:00:00+00:00',
      description: '',
      subject: ['汇书网'],
      rights: '',
      contributor: ['calibre (7.0.0) [https://calibre-ebook.com]'],
    })
  })

  it('getFileInfo', () => {
    const fileInfo = kf8.getFileInfo()
    expect(fileInfo.fileName).toBe('taoyong.azw3')
  })

  it('getCover', () => {
    const coverSrc = kf8.getCoverImage()
    expect(coverSrc).toBe(path.resolve('./images', 'cover.jpg'))
    // for cache
    const coverSrc2 = kf8.getCoverImage()
    expect(coverSrc).toBe(coverSrc2)
  })

  it('destroy', () => {
    expect(() => kf8.destroy()).not.toThrowError()
  })
})

describe('init kf8 in browser', () => {
  let kf8: Kf8
  beforeAll(async () => {
    const fileBuffer = readFileSync('./example/taoyong.azw3')
    const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
    // @ts-expect-error globalThis.__BROWSER__
    globalThis.__BROWSER__ = true
    // @ts-expect-error File mock
    globalThis.File = class {
      async arrayBuffer() {
        return arrayBuffer
      }
    }
    kf8 = await initKf8File(new File([], 'taoyong.azw3'))
  })
  afterAll(() => {
    // @ts-expect-error globalThis.__BROWSER__
    delete globalThis.__BROWSER__
    // @ts-expect-error File mock
    delete globalThis.File
  })
  it('kf8 class', () => {
    expect(kf8).toBeDefined()
  })

  it('loadChapter in browser', () => {
    const spine = kf8.getSpine()
    const chapter = spine[0]
    const { html, css } = kf8.loadChapter(chapter.id)!
    // html src should be replaced
    const htmlSrc = html.match('src="(.+?)"')![1]
    expect(htmlSrc.startsWith('blob')).toBe(true)
    // css href
    const cssHrefs = css.map(item => item.href)
    cssHrefs.forEach((href) => {
      expect(href.startsWith('blob')).toBe(true)
    })
  })

  it('getFileInfo', () => {
    const fileInfo = kf8.getFileInfo()
    expect(fileInfo.fileName).toBe('')
  })

  it('destroy', () => {
    expect(() => kf8.destroy()).not.toThrowError()
  })
})

describe('compatible .azw3 file', () => {
  beforeAll(() => {
    // @ts-expect-error globalThis.__BROWSER__
    globalThis.__BROWSER__ = false
  })

  it('quanyecha.azw3', async () => {
    const warnSpyOn = vi.spyOn(console, 'warn').mockImplementation(() => { })
    const kf8 = await initKf8File('./example/quanyecha.azw3')
    const spine = kf8.getSpine()
    expect(spine.length).toBe(64)

    const firstSpineHtml = kf8.loadChapter(spine[1].id)!.html.trim()
    expect(firstSpineHtml.length).toBeGreaterThan(100)
    expect(warnSpyOn).not.toHaveBeenCalledWith()
    warnSpyOn.mockRestore()
  })

  it('quanyecha.mobi', async () => {
    const warnSpyOn = vi.spyOn(console, 'warn').mockImplementation(() => { })
    const kf8 = await initKf8File('./example/quanyecha.mobi')
    const spine = kf8.getSpine()
    expect(spine.length).toBe(64)

    const firstSpineHtml = kf8.loadChapter(spine[4].id)!.html.trim()
    expect(firstSpineHtml.length).toBeGreaterThan(100)
    expect(warnSpyOn).toHaveBeenCalledWith('File "quanyecha.mobi" is a compatible file. Please change the file extension to .azw3 to make it parse correctly.')
    warnSpyOn.mockRestore()
  })
})
