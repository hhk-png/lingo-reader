import { URL, fileURLToPath } from 'node:url'
import { readFile } from 'node:fs/promises'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { parsexml } from '@lingo-reader/shared'
import { type Fb2File, initFb2File } from '../src/index'
import { parseBinary } from '../src/parseXmlNodes'

describe('initFb2File in node', () => {
  let fb2: Fb2File
  beforeAll(async () => {
    // @ts-expect-error globalThis.__BROWSER__
    globalThis.__BROWSER__ = false
    fb2 = await initFb2File('./example/many-languages.fb2')
  })

  it('getMetadata', () => {
    const metadata = fb2.getMetadata()
    const metadataLen = Object.keys(metadata).length
    const author = metadata.author
    expect(metadataLen).toBe(13)
    expect(author?.firstName).toBe('Infogrid')
    expect(author!.name).toBe('Infogrid Pacific')
    expect(author?.email).toBe('')
    expect(metadata.translator).toBe('John Doe')
    expect(metadata.history).toBe('<div><p>This book was first uploaded in 2010, revised in 2012 to fix typos,and converted to FB2 in 2025 with updated metadata.</p></div>')
  })

  it('getFileInfo', () => {
    expect(fb2.getFileInfo()).toEqual({
      fileName: 'many-languages.fb2',
    })
  })

  it('getToc', () => {
    const toc = fb2.getToc()
    const firstTocItem = toc[0]
    const lastTocItem = toc[toc.length - 1]
    expect(toc.length).toBe(32)
    expect(firstTocItem.label).toBe('')
    expect(firstTocItem.href).toBe('fb2:lingo_fb2_0')
    expect(lastTocItem.label).toBe('footnotes')
    expect(lastTocItem.href).toBe('fb2:lingo_fb2_31')
  })

  it('getSpine', () => {
    const spine = fb2.getSpine()
    expect(spine.length).toBe(32)
    expect(spine[spine.length - 1]).toEqual({ id: 'lingo_fb2_31' })
  })

  it('getCoverImage', () => {
    const coverImageUrl = fb2.getCoverImage()
    expect(coverImageUrl.endsWith('_0.jpg')).toBe(true)
    const cachedUrl = fb2.getCoverImage()
    expect(cachedUrl).toBe(coverImageUrl)
  })

  it('resolveHref', () => {
    // fb2:lingo_fb2_0
    const resolvedHref = fb2.resolveHref('fb2:lingo_fb2_0')
    expect(resolvedHref?.id).toBe('lingo_fb2_0')
    expect(resolvedHref?.selector).toBe('')
    // fb2:lingo_fb2_0#first_section
    const resolvedHref2 = fb2.resolveHref('fb2:lingo_fb2_0#first_section')
    expect(resolvedHref2?.id).toBe('lingo_fb2_0')
    expect(resolvedHref2?.selector).toBe('[id="first_section"]')
    // don't start with fb2
    expect(fb2.resolveHref('abc:')).toBeUndefined()
    // chapter id is not exist
    expect(fb2.resolveHref('fb2:nonexist#first_section')).toBeUndefined()
  })

  it('loadChapter', () => {
    const spine = fb2.getSpine()
    // firstChapter
    const firstChapter = fb2.loadChapter(spine[0].id)
    expect(firstChapter?.html.length).toBeGreaterThan(4)
    expect(firstChapter?.css[0].href.endsWith('css')).toBe(true)

    // load Cached first chapter
    const firstChapter2 = fb2.loadChapter(spine[0].id)
    expect(firstChapter2?.html.length).toBe(firstChapter?.html.length)

    // secondChapter, with <a> and <img>
    const secondChapter = fb2.loadChapter(spine[1].id)
    const html = secondChapter!.html
    const aTags = [...html.matchAll(/<a\b[^>]*>/gi)].map(val => val[0])
    expect(aTags[0].indexOf('note')).toBe(46)
    expect(aTags[1].indexOf('#first_section')).toBe(24)
    expect(aTags[2].indexOf('http')).toBe(9)
    const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map(val => val[0])
    const srcVal = imgs[0].match('src="(.*)"')?.[1]
    expect(srcVal?.endsWith('_11.jpg')).toBe(true)

    // load non-exist chapter
    expect(fb2.loadChapter('non-exist')).toBeUndefined()
  })

  it('destroy', () => {
    expect(() => {
      fb2.destroy()
    }).not.toThrowError()
  })
})

describe('fb2-parser corner case in node', () => {
  const isNode18 = process.version.startsWith('v18.')
  beforeAll(async () => {
    // @ts-expect-error globalThis.__BROWSER__
    globalThis.__BROWSER__ = false
    if (isNode18) {
      class FakeFile {
        name: string
        size: number
        type: string
        lastModified: number
        constructor(
          parts: (string | Uint8Array)[],
          name: string,
          options: { type?: string } = {},
        ) {
          this.name = name
          this.size = parts.reduce((sum, part) => sum + part.toString().length, 0)
          this.type = options.type || ''
          this.lastModified = Date.now()
        }
      }

      // @ts-expect-error node18
      globalThis.File = FakeFile
    }
  })

  afterAll(() => {
    if (isNode18) {
      // @ts-expect-error File
      globalThis.File = undefined
    }
  })

  it('to throw when <binary> without content-type', async () => {
    const binaryWithoutContentType = `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:xlink="http://www.w3.org/1999/xlink">
<!-- binary without content-type -->
<binary id="123">
xA5HSqm9vJY7jnJ5zRRUMtEyOzMuWJ47mpSTvHJ6UUUiWLcgApgDnrUCk7
m570UVSKXwlhOCAOlTzKoX7o/KiiqMpFebhOOOKi3sEXDEfjRRSLQ9XYuSWOcetIWY9ST+N
FFDGhG6N7DioYz8poopItCoMq2fWoCqiTgAdOgoooLQMSDgEgbu1DyPtb52/OiikPqELt5f
3j+dWMljg8j3oopBL4hknEJI4Oe1VYmbc3zHgcc0UUwLEnzIN3P1qm6jf0FFFA47lG4ZllU
AkDB6GoDI+AN7fnRRTN0TbiYeSTVBwA7nHINFFUilsSIflUdqfbk4NFFUhSHSKuAdoz9Kjl
GIcjg5ooqugkVnkfB+du3eq87vszuOfrRRQiiSzdm+8xP1NTOAHXA6nn3oooYiOUnL8ninK
TtxmiimMhZQH6DrVefhwR1z1ooq0CKN0zbPvHr61HbO5ySxJ9zRRWoD5GbJ+Y/nRRRSYH/9
k=
</binary>
</FictionBook>`
    const binaryAST = await parsexml(binaryWithoutContentType, {
      charsAsChildren: true,
      preserveChildrenOrder: true,
      explicitChildren: true,
      childkey: 'children',
    })
    expect(() => {
      parseBinary(binaryAST.FictionBook.binary)
    }).toThrowError('The <binary> element must have `id` and `content-type` attributes.')
  })

  it('to throw when <binary> without id', async () => {
    const binaryWithoutId = `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:xlink="http://www.w3.org/1999/xlink">
<binary content-type="image/jpeg">
xA5HSqm9vJY7jnJ5zRRUMtEyOzMuWJ47mpSTvHJ6UUUiWLcgApgDnrUCk7
m570UVSKXwlhOCAOlTzKoX7o/KiiqMpFebhOOOKi3sEXDEfjRRSLQ9XYuSWOcetIWY9ST+N
FFDGhG6N7DioYz8poopItCoMq2fWoCqiTgAdOgoooLQMSDgEgbu1DyPtb52/OiikPqELt5f
3j+dWMljg8j3oopBL4hknEJI4Oe1VYmbc3zHgcc0UUwLEnzIN3P1qm6jf0FFFA47lG4ZllU
AkDB6GoDI+AN7fnRRTN0TbiYeSTVBwA7nHINFFUilsSIflUdqfbk4NFFUhSHSKuAdoz9Kjl
GIcjg5ooqugkVnkfB+du3eq87vszuOfrRRQiiSzdm+8xP1NTOAHXA6nn3oooYiOUnL8ninK
TtxmiimMhZQH6DrVefhwR1z1ooq0CKN0zbPvHr61HbO5ySxJ9zRRWoD5GbJ+Y/nRRRSYH/9
k=
</binary>
</FictionBook>`
    const binaryAST = await parsexml(binaryWithoutId, {
      charsAsChildren: true,
      preserveChildrenOrder: true,
      explicitChildren: true,
      childkey: 'children',
    })
    expect(() => {
      parseBinary(binaryAST.FictionBook.binary)
    }).toThrowError('The <binary> element must have `id` and `content-type` attributes.')
  })

  it('not throw when there is no <binary>', async () => {
    const binaryWithoutId = `<?xml version="1.0" encoding="UTF-8"?>
<FictionBook xmlns="http://www.gribuser.ru/xml/fictionbook/2.0" xmlns:xlink="http://www.w3.org/1999/xlink">
  <body>
    some text
  </body>
</FictionBook>`
    const binaryAST = await parsexml(binaryWithoutId, {
      charsAsChildren: true,
      preserveChildrenOrder: true,
      explicitChildren: true,
      childkey: 'children',
    })
    expect(() => {
      parseBinary(binaryAST.FictionBook.binary)
    }).not.toThrowError()
  })

  it('coverImageId should be `` if it was not exist', async () => {
    const withoutCoverFilePath = fileURLToPath(new URL('./fixture/cover.fb2', import.meta.url).href)
    const fb2 = await initFb2File(withoutCoverFilePath)
    expect(fb2.getCoverImage()).toBe('')
    fb2.destroy()
  })

  it('fb2 without stylesheet', async () => {
    const withoutCoverFilePath = fileURLToPath(new URL('./fixture/cover.fb2', import.meta.url).href)
    const fb2 = await initFb2File(withoutCoverFilePath)
    const spine = fb2.getSpine()
    expect(fb2.loadChapter(spine[0].id)?.css.length).toBe(0)
    fb2.destroy()
  })

  it('load fb2 from memory', async () => {
    const withoutCoverFilePath = fileURLToPath(new URL('./fixture/cover.fb2', import.meta.url).href)
    const fb2File = await readFile(withoutCoverFilePath)
    const fb2 = await initFb2File(fb2File)
    expect(fb2.getSpine().length).toBe(1)
  })

  it('thrown error if pass File', async () => {
    await expect(async () => {
      await initFb2File(new File(['Hello, world!'], 'hello.txt', {
        type: 'text/plain',
      }))
    }).rejects.toThrowError('The `fb2` param cannot be a `File` in node env.')
  })

  it('test', async () => {
    const withoutCoverFilePath = fileURLToPath(new URL('./fixture/cover.fb2', import.meta.url).href)
    const fb2 = await initFb2File(withoutCoverFilePath)
    const html = fb2.loadChapter(fb2.getSpine()[0].id)!.html
    const charBeforeEm = html[html.indexOf('<em>') - 1]
    expect(charBeforeEm).toBe(' ')
    const charAfterCloseEm = html[html.indexOf('</em>') + 5]
    expect(charAfterCloseEm).toBe(' ')
  })
})

describe('initFb2File in browser', () => {
  let fb2: Fb2File
  beforeAll(async () => {
    // @ts-expect-error globalThis.__BROWSER__
    globalThis.__BROWSER__ = true
    // mock File obj
    const mockFile: any = {
      async text() {
        return await readFile('./example/many-languages.fb2')
      },
      name: 'many-languages.fb2',
    }
    fb2 = await initFb2File(mockFile)
  })

  it('getMetadata', () => {
    const metadata = fb2.getMetadata()
    const metadataLen = Object.keys(metadata).length
    expect(metadataLen).toBe(13)
  })

  it('getFileInfo', () => {
    expect(fb2.getFileInfo()).toEqual({
      fileName: 'many-languages.fb2',
    })
  })

  it('getToc', () => {
    const toc = fb2.getToc()
    expect(toc.length).toBe(32)
  })

  it('getSpine', () => {
    const spine = fb2.getSpine()
    expect(spine.length).toBe(32)
  })

  it('getCoverImage', () => {
    const coverImageUrl = fb2.getCoverImage()
    expect(coverImageUrl.startsWith('blob')).toBe(true)
  })

  it('resolveHref', () => {
    const resolvedHref2 = fb2.resolveHref('fb2:lingo_fb2_0#first_section')
    expect(resolvedHref2?.id).toBe('lingo_fb2_0')
    expect(resolvedHref2?.selector).toBe('[id="first_section"]')
  })

  it('loadChapter', () => {
    const spine = fb2.getSpine()
    // firstChapter
    const firstChapter = fb2.loadChapter(spine[0].id)
    expect(firstChapter?.html.length).toBeGreaterThan(4)
    expect(firstChapter?.css[0].href.startsWith('blob')).toBe(true)

    // secondChapter, with <a> and <img>
    const secondChapter = fb2.loadChapter(spine[1].id)
    const html = secondChapter!.html
    const aTags = [...html.matchAll(/<a\b[^>]*>/gi)].map(val => val[0])
    expect(aTags[0].indexOf('note')).toBe(46)
    expect(aTags[1].indexOf('#first_section')).toBe(24)
    const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map(val => val[0])
    const srcVal = imgs[0].match('src="(.*)"')?.[1]
    expect(srcVal?.startsWith('blob')).toBe(true)
  })

  it('destroy', () => {
    expect(() => {
      fb2.destroy()
    }).not.toThrowError()
  })
})

describe('fb2-parser corner case in browser', () => {
  beforeAll(async () => {
    // @ts-expect-error globalThis.__BROWSER__
    globalThis.__BROWSER__ = true
  })

  it('throw error if initFb2File\'s first param is string', async () => {
    await expect(async () => {
      await initFb2File('example.fb2')
    }).rejects.toThrowError()
  })

  it('init fb2 file using Uint8Array', async () => {
    const fb2 = await initFb2File(await readFile('./example/many-languages.fb2'))
    expect(fb2).toBeDefined()
    expect(fb2.getSpine().length).toBe(32)
  })
})
