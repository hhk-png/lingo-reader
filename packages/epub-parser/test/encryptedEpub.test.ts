import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { Buffer } from 'node:buffer'
import { afterAll, describe, expect, it, vi } from 'vitest'
import { initEpubFile } from '../src'
import {
  AesSymmetricKey16,
  RsaPrivateKey,
} from './keys/encryptionKey'

function isJpg(img: Uint8Array): boolean {
  return img[0] === 0xFF && img[1] === 0xD8 && img[img.length - 2] === 0xFF && img[img.length - 1] === 0xD9
}

describe('initEpubFile options interface', () => {
  it('not throw error', async () => {
    const warnSpyOn = vi.spyOn(console, 'warn').mockImplementation(() => { })
    // @ts-expect-error __BROWSER__ is for build process
    globalThis.__BROWSER__ = false
    const epub = await initEpubFile(
      fileURLToPath(new URL('./encryptionEpub/rsa-sha1+aes-256-cbc-ctr-gcm.epub', import.meta.url)),
      './images',
      {
        rsaPrivateKey: new Uint8Array(Buffer.from(RsaPrivateKey, 'base64')),
        aesSymmetricKey: new Uint8Array(Buffer.from(AesSymmetricKey16, 'base64')),
      },
    )
    const spine = epub.getSpine()
    expect(spine.length).toBeGreaterThan(0)
    warnSpyOn.mockRestore()
  })
})

describe('rsa-sha1+aes-256-cbc-ctr-gcm.epub', async () => {
  const warnSpyOn = vi.spyOn(console, 'warn').mockImplementation(() => { })
  // @ts-expect-error __BROWSER__ is for build process
  globalThis.__BROWSER__ = false
  const epub = await initEpubFile(
    fileURLToPath(new URL('./encryptionEpub/rsa-sha1+aes-256-cbc-ctr-gcm.epub', import.meta.url)),
    './images',
    {
      rsaPrivateKey: RsaPrivateKey,
    },
  )
  const spine = epub.getSpine()
  afterAll(() => {
    warnSpyOn.mockRestore()
  })

  it('ePUB/xhtml/chapter2.xhtml', async () => {
    const item = spine[2]
    const a = await epub.loadChapter(item.id)
    expect(a.css.length).toBe(0)
    expect(a.html).toContain('<div id="chapter2.xhtml">')
  })

  it('ePUB/xhtml/chapter3.xhtml', async () => {
    const item = spine[3]
    const a = await epub.loadChapter(item.id)
    expect(a.css.length).toBe(0)
    expect(a.html).toContain('<div id="chapter3.xhtml">')
  })

  it('ePUB/xhtml/chapter4.xhtml', async () => {
    const item = spine[4]
    const a = await epub.loadChapter(item.id)
    expect(a.css.length).toBe(0)
    expect(a.html).toContain('<div id="chapter4.xhtml">')
  })

  it('ePUB/xhtml/chapter5.xhtml', async () => {
    const item = spine[5]
    const a = await epub.loadChapter(item.id)
    expect(a.css.length).toBe(0)
    expect(a.html).toContain('<div id="chapter5.xhtml">')
  })

  it('ePUB/images/cover.jpg', async () => {
    const item = spine[0]
    const cover = await epub.loadChapter(item.id)
    expect(cover.css.length).toBe(1)
    expect(cover.html).toContain('<img')

    const src = cover.html.match(/<img[^>]+src="([^"]+)"/)?.[1]
    const img = new Uint8Array(readFileSync(src!))
    expect(isJpg(img)).toBe(true)
  })
})

// rsa-sha256+aes192-cbc-ctr-gcm.epub
describe('rsa-sha256+aes192-cbc-ctr-gcm.epub', async () => {
  // @ts-expect-error __BROWSER__ is for build process
  globalThis.__BROWSER__ = false
  const epub = await initEpubFile(
    fileURLToPath(new URL('./encryptionEpub/rsa-sha256+aes192-cbc-ctr-gcm.epub', import.meta.url)),
    './images',
    {
      rsaPrivateKey: RsaPrivateKey,
    },
  )
  const spine = epub.getSpine()

  it('ePUB/xhtml/cover.xhtml', async () => {
    const item = spine[0]
    const chapter = await epub.loadChapter(item.id)
    expect(chapter.css.length).toBe(1)
    expect(chapter.html).toContain('<img')
  })

  it('ePUB/xhtml/chapter2.xhtml', async () => {
    const item = spine[2]
    const chapter = await epub.loadChapter(item.id)
    expect(chapter.css.length).toBe(0)
    expect(chapter.html).toContain('<div id="chapter2.xhtml">')
  })

  it('ePUB/xhtml/chapter3.xhtml', async () => {
    const item = spine[3]
    const chapter = await epub.loadChapter(item.id)
    expect(chapter.css.length).toBe(0)
    expect(chapter.html).toContain('<div id="chapter3.xhtml">')
  })

  it('ePUB/xhtml/chapter4.xhtml', async () => {
    const item = spine[4]
    const chapter = await epub.loadChapter(item.id)
    expect(chapter.css.length).toBe(0)
    expect(chapter.html).toContain('<div id="chapter4.xhtml">')
  })

  it('ePUB/xhtml/chapter5.xhtml', async () => {
    const item = spine[5]
    const chapter = await epub.loadChapter(item.id)
    expect(chapter.css.length).toBe(0)
    expect(chapter.html).toContain('<div id="chapter5.xhtml">')
  })
})

describe('aes128-cbc-ctr-gcm.epub', async () => {
  // @ts-expect-error __BROWSER__ is for build process
  globalThis.__BROWSER__ = false
  const epub = await initEpubFile(
    fileURLToPath(new URL('./encryptionEpub/aes128-cbc-ctr-gcm.epub', import.meta.url)),
    './images',
    {
      aesSymmetricKey: AesSymmetricKey16,
    },
  )
  const spine = epub.getSpine()
  // afterAll(() => {
  //   epub.destroy()
  // })

  // <!-- aes128-cbc + Compression + IV 16 byte -->
  it('ePUB/xhtml/cover.xhtml', async () => {
    const item = spine[0]
    const chapter = await epub.loadChapter(item.id)
    expect(chapter.css.length).toBe(1)
    expect(chapter.html).toContain('<img src=')
  })

  // <!-- aes128-ctr + Compression + IV 16 byte -->
  it('ePUB/xhtml/chapter2.xhtml', async () => {
    const item = spine[2]
    const chapter = await epub.loadChapter(item.id)
    expect(chapter.css.length).toBe(0)
    expect(chapter.html).toContain('<div id="chapter2.xhtml">')
  })

  // <!-- aes128-gcm + Compression + IV 12 byte -->
  it('ePUB/xhtml/chapter3.xhtml', async () => {
    const item = spine[3]
    const chapter = await epub.loadChapter(item.id)
    expect(chapter.css.length).toBe(0)
    expect(chapter.html).toContain('<div id="chapter3.xhtml">')
  })
})
