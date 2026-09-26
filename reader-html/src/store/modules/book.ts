import type { EpubFile, EpubSpine } from '@lingo-reader/epub-parser'
import { initEpubFile } from '@lingo-reader/epub-parser'
import { defineStore } from 'pinia'
import { ref } from 'vue'
import DOMPurify from 'dompurify'
import { initKf8File, initMobiFile } from '@lingo-reader/mobi-parser'
import type { Kf8, Kf8Spine, Mobi, MobiSpine } from '@lingo-reader/mobi-parser'
import type { FileInfo, ResolvedHref, Toc } from '@lingo-reader/shared'
import type { Fb2File, Fb2Spine } from '@lingo-reader/fb2-parser'
import { initFb2File } from '@lingo-reader/fb2-parser'

const useBookStore = defineStore('ebook', () => {
  let book: EpubFile | Mobi | Kf8 | Fb2File | undefined
  let spine: EpubSpine | MobiSpine | Kf8Spine | Fb2Spine = []
  const chapterIndex = ref<number>(0)
  const chapterNums = ref<number>(0)
  const progressInChapter = ref<number>(0)
  let fileInfo: FileInfo = {
    fileName: '',
  }

  const initBook = async (file: File) => {
    if (file.name.endsWith('epub')) {
      // don't support decryption in `reader-html`
      book = await initEpubFile(file, undefined)
      spine = book.getSpine()
      chapterNums.value = spine.length
      fileInfo = book.getFileInfo()
    }
    else if (file.name.endsWith('mobi')) {
      book = await initMobiFile(file)
      spine = book.getSpine()
      chapterNums.value = spine.length
      fileInfo = book.getFileInfo()
    }
    else if (file.name.endsWith('kf8') || file.name.endsWith('azw3')) {
      book = await initKf8File(file)
      spine = book.getSpine()
      chapterNums.value = spine.length
      fileInfo = book.getFileInfo()
    }
    else if (file.name.endsWith('fb2')) {
      book = await initFb2File(file)
      spine = book.getSpine()
      chapterNums.value = spine.length
      fileInfo = book.getFileInfo()
    }
    else {
      throw new Error('Unsupported file type')
    }
  }

  const chapterCache = new Map<string, string>()
  const getChapterHTMLFromId = async (id: string): Promise<string> => {
    if (chapterCache.has(id)) {
      return chapterCache.get(id)!
    }

    const { html } = await book!.loadChapter(id)!
    // for security
    const purifiedDom = DOMPurify.sanitize(html, {
      ALLOWED_URI_REGEXP: /^(blob|https|epub|filepos|kindle|fb2)/i,
      ADD_URI_SAFE_ATTR: ['width', 'height'],
    })
    chapterCache.set(id, purifiedDom)
    return purifiedDom
  }

  const getChapterHTML = async () => {
    const id = spine[chapterIndex.value].id
    return await getChapterHTMLFromId(id)
  }

  const getChapterThroughId = async (id: string) => {
    chapterIndex.value = spine.findIndex(item => item.id === id)
    return await getChapterHTMLFromId(id)
  }

  const getSpineIds = (): string[] => {
    return spine.map(item => item.id)
  }

  const getToc = (): Toc => {
    const toc = book!.getToc()
    for (const item of toc) {
      if (item.label.length === 0) {
        item.label = item.href
      }
    }
    return toc
  }

  const getFileName = () => {
    return fileInfo.fileName
  }

  const reset = () => {
    book!.destroy()
    book = undefined
    spine = []
    chapterIndex.value = 0
    chapterNums.value = 0
    progressInChapter.value = 0
    // clear chapter cache to avoid image conflict in different books
    chapterCache.clear()
  }

  const existBook = (): boolean => {
    return book !== undefined
  }

  const resolveHref = (href: string): ResolvedHref | undefined => {
    return book!.resolveHref(href)
  }

  const getMetadata = () => {
    return undefined
  }

  return {
    chapterIndex,
    chapterNums,
    progressInChapter,
    initBook,
    getChapterHTML,
    getChapterThroughId,
    getSpineIds,
    getToc,
    getFileName,
    reset,
    existBook,
    resolveHref,
    getMetadata,
  }
})

export default useBookStore
