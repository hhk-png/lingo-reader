import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { type Mobi, initMobiFile } from '../src'

describe('initMobiFile interface', () => {
  it('init mobi from memory in nodejs', async () => {
    // @ts-expect-error __BROWSER__ is for build process
    globalThis.__BROWSER__ = false

    const mobi = await initMobiFile(new Uint8Array(readFileSync('./example/taoyong.mobi')))

    expect(mobi.getFileInfo()).toEqual({
      fileName: '',
    })

    expect(mobi.getSpine().length).toBe(33)
  })

  it('init mobi from Uint8Array in browser', async () => {
    // @ts-expect-error __BROWSER__ is for build process
    globalThis.__BROWSER__ = true

    const mobi = await initMobiFile(new Uint8Array(readFileSync('./example/taoyong.mobi')))

    expect(mobi.getFileInfo()).toEqual({
      fileName: '',
    })

    expect(mobi.getSpine().length).toBe(33)
  })
})

describe('mobi class', () => {
  let mobi: Mobi
  beforeAll(async () => {
    // @ts-expect-error globalThis.__BROWSER__
    globalThis.__BROWSER__ = false
    mobi = await initMobiFile('./example/taoyong.mobi')
  })

  it('getFileInfo', () => {
    const fileInfo = mobi.getFileInfo()
    expect(fileInfo.fileName).toBe('taoyong.mobi')
  })

  it('getSpine', () => {
    const spine = mobi.getSpine()
    expect(spine.length).toBe(33)
    const lastlastSpine = spine[spine.length - 2]
    expect(lastlastSpine.id).toBe('31')
    expect(lastlastSpine.start).toBe(338161)
    expect(lastlastSpine.end).toBe(340617)
    expect(lastlastSpine.size).toBe(2440)
  })

  it('getToc', () => {
    const toc = mobi.getToc()
    expect(toc.length).toBe(30)
    expect(toc[toc.length - 1]).toEqual({ label: '后记', href: 'filepos:335070' })
  })

  it('loadChapter', () => {
    const spine = mobi.getSpine()
    const chapter = spine[0]
    const { html, css } = mobi.loadChapter(chapter.id)!
    const htmlSrc = html.match(/src="(.+?)"/)![1]
    expect(htmlSrc).toBe(path.resolve('./images/4.jpg'))
    expect(css.length).toBe(0)
    // cache
    const { html: html2, css: css2 } = mobi.loadChapter(chapter.id)!
    expect(html2).toBe(html)
    expect(css2).toEqual(css2)
  })

  it('load unexisted chapter', () => {
    expect(mobi.loadChapter('50')).toBeUndefined()
  })

  it('chapter id is not number', () => {
    expect(mobi.loadChapter('abc')).toBeUndefined()
  })

  it('resolveHref', () => {
    const toc = mobi.getToc()
    const href = toc[2].href
    const resolvedHref = mobi.resolveHref(href)
    expect(resolvedHref).toEqual({ id: '3', selector: '[id="filepos:8520"]' })
  })

  it('resolve incorrect href', () => {
    // incorrect href
    expect(mobi.resolveHref('incorrectHref:1')).toBeUndefined()
    // out of range filepos
    expect(mobi.resolveHref('filepos:8520000')).toBeUndefined()
  })

  // mobi has no guide

  it('getMetaData', () => {
    const metadata = mobi.getMetadata()
    expect(metadata).toEqual({
      identifier: '3279154688',
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

  it('getCoverImage', () => {
    const coverUrl = mobi.getCoverImage()
    expect(coverUrl).toBe(path.resolve('./images/cover.jpg'))
    const coverUrlCache = mobi.getCoverImage()
    expect(coverUrlCache).toBe(coverUrl)
  })

  it('destroy', () => {
    expect(() => mobi.destroy()).not.toThrowError()
  })
})

describe('init mobi in browser', () => {
  let mobi: Mobi
  beforeAll(async () => {
    const fileBuffer = readFileSync('./example/taoyong.mobi')
    const arrayBuffer = fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength)
    // @ts-expect-error globalThis.__BROWSER__
    globalThis.__BROWSER__ = true
    // @ts-expect-error File mock
    globalThis.File = class {
      async arrayBuffer() {
        return arrayBuffer
      }
    }
    // filename will be undefined in node env
    mobi = await initMobiFile(new File([], 'taoyong.mobi'))
  })
  afterAll(() => {
    // @ts-expect-error globalThis.__BROWSER__
    delete globalThis.__BROWSER__
    // @ts-expect-error File mock
    delete globalThis.File
  })

  it('loadChapter in browser', () => {
    const { html, css } = mobi.loadChapter('0')!
    const htmlSrc = html.match(/src="(.+?)"/)![1]
    expect(htmlSrc.startsWith('blob')).toBe(true)
    expect(css.length).toBe(0)
  })

  it('destroy', () => {
    expect(() => mobi.destroy()).not.toThrowError()
  })
})

describe('mobi corner case', () => {
  beforeAll(async () => {
    // @ts-expect-error globalThis.__BROWSER__
    globalThis.__BROWSER__ = false
  })

  it('replace a tag href (sway.mobi)', async () => {
    const mobi = await initMobiFile('./example/sway.mobi')
    const spine = mobi.getSpine()
    // src match with `fileposReg`
    const chapter = mobi.loadChapter(spine[0].id)
    const href = chapter!.html.match(/href="([^"]*)"/i)![1]
    expect(href).toBe('http://www.HachetteBookGroupUSA.com')
    // src do not match with `fileposReg`
    const chapter1 = mobi.loadChapter(spine[1].id)
    const aHref = chapter1?.html.match(/href="([^"]*)"/i)![1]
    expect(aHref?.startsWith('filepos')).toBe(true)
  })

  it('unexisting mobiLang (mobiLang.mobi)', async () => {
    const mobi = await initMobiFile('./example/mobiLang.mobi')
    const metadata = mobi.getMetadata()
    // mobiLang.mobi dosn't provide the correct language in the exth and file headers
    //  so we don't need to worry about what the language is.
    expect(metadata.language).toBe('und')
  })
})
