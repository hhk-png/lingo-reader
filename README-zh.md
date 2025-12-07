# 简介

**lingo-reader** 是一个用于解析电子书文件的库。目前支持解析 **.epub**、**.mobi** 、 **.azw3**（**.kf8**）和 **.fb2** 格式的文件，并提供了一套统一的 API。

此外，你还可以访问 https://hhk-png.github.io/lingo-reader/ 来直接阅读电子书。这个网站是基于该解析库开发的。

各个解析库的详细解释可以查看对应子项目下的 `README.md` 文件：[epub-parser README.md](./packages/epub-parser/README-zh.md)，[mobi-parser README.md](./packages/mobi-parser/README-zh.md)，[kf8-parser README.md](./packages/mobi-parser/README-zh.md)，[fb2-parser README.md](./packages/fb2-parser/README-zh.md)。

# Install

```shell
pnpm install @lingo-reader/epub-parser
pnpm install @lingo-reader/mobi-parser # 包括moi和azw3文件的解析
pnpm install @lingo-reader/fb2-parser
pnpm install @lingo-reader/shared # 包含统一API的类型
```

# Contributing Guide

see [https://github.com/hhk-png/lingo-reader?tab=contributing-ov-file](https://github.com/hhk-png/lingo-reader?tab=contributing-ov-file)

 在提交 Pull Request 之前，请务必阅读此内容，并在提交信息的开头添加提交类型前缀。

# Usage in Browser

```typescript
import type { EpubFile, EpubSpine } from '@lingo-reader/epub-parser'
import { initEpubFile } from '@lingo-reader/epub-parser'
import { initKf8File, initMobiFile } from '@lingo-reader/mobi-parser'
import type { Kf8, Kf8Spine, Mobi, MobiSpine } from '@lingo-reader/mobi-parser'
import type { FileInfo } from '@lingo-reader/shared'
import type { Fb2File, Fb2Spine } from '@lingo-reader/fb2-parser'
import { initFb2File } from '@lingo-reader/fb2-parser'

let book: EpubFile | Mobi | Kf8 | undefined
let spine: EpubSpine | MobiSpine | Kf8Spine = []
let fileInfo: FileInfo = {
  fileName: '',
}

async function initBook(file: File) {
  if (file.name.endsWith('epub')) {
    book = await initEpubFile(file)
    spine = book.getSpine()
    fileInfo = book.getFileInfo()
  }
  else if (file.name.endsWith('mobi')) {
    book = await initMobiFile(file)
    spine = book.getSpine()
    fileInfo = book.getFileInfo()
  }
  else if (file.name.endsWith('kf8') || file.name.endsWith('azw3')) {
    book = await initKf8File(file)
    spine = book.getSpine()
    fileInfo = book.getFileInfo()
  }
  else if (file.name.endsWith('fb2')) {
    book = await initFb2File(file)
    spine = book.getSpine()
    chapterNums.value = spine.length
    fileInfo = book.getFileInfo()
  }
}
await initBook()
// toc
console.log(book.getToc())

for (let i = 0; i < spine.length; i++) {
  const id = spine[i].id
  // loadChapter
  const chapter = book!.loadChapter(id)
  console.log(chapter)
}

// destroy
book!.destroy()
```

# Init File

针对每种电子书文件，各子包都暴露出了一个init方法，epub、mobi、azw3(kf8)、fb2对应的方法分别是`initEpubFile`、`initMobiFile`、`initKf8File`、`initFb2File`，它们返回的对象都implements了下面的EBookParser接口，在一定程度上统一，但又保持了各自文件类型的特点。请选择对应的文档查看更详细的描述。

# Unified API

针对不同电子书文件的，**lingo-reader** 提供了如下的统一的 api：

```typescript
export interface EBookParser {
  getSpine: () => Spine
  loadChapter: (
    id: string
  ) => Promise<ProcessedChapter | undefined> | ProcessedChapter | undefined
  getToc: () => Toc
  getMetadata: () => Metadata
  getFileInfo: () => FileInfo
  getCover?: () => string
  resolveHref: (href: string) => ResolvedHref | undefined
  destroy: () => void
}
```

使用方式如下，以 `epub-parser` 为例：

```typescript
import type { EpubFile } from '@lingo-reader/epub-parser'
import { initEpubFile } from '@lingo-reader/epub-parser'

let book: EpubFile
async function initBook(file: File): EpubFile {
  if (file.name.endsWith('epub')) {
    book = await initEpubFile(file)
  }
  return book
}
```

**@lingo-reader/epub-parser** 只暴露出了 initEpubFile 方法和与该方法相关的类型。上述是在浏览器中的使用方法，需要传入一个 File 对象，File 对象通过 type 为 file 的 input 标签获得。**@lingo-reader/epub-parser** 也支持在 node 环境下运行，只是此时要传入的参数是文件的地址。

`initEpubFile` 的返回对象实现了 EBookParser 接口，并且也根据电子书文件的不同会提供额外的特定 api，可以查阅相应解析器的详细文档：[epub-parser](./packages/epub-parser/README-zh.md)，[mobi-parser](./packages/mobi-parser/README-zh.md)，[kf8-parser](./packages/mobi-parser/README-zh.md)。

## getSpine: () => Spine

```typescript
interface SpineItem {
  id: string
}
type Spine = SpineItem[]
```

一本书从前到后由多个章节，包括前言、版权信息、第一章、第二章等等，getSpine 的目的是获取这些章节描述对象的数组，如上述代码所示。每个章节对象一定要有的字段是 id，用于后续加载章节的文字和 css 资源。

## loadChapter: (id: string) => Promise<ProcessedChapter | undefined> | ProcessedChapter | undefined

`loadChapter` 的参数是章节的 id，返回值为处理后的章节对象。因电子书文件解析方式的不同，返回的章节对象可能是一个 `Promise`。如下面的 `ProcessedChapter` 接口所示。如果返回值为 `undefined`，说明没有该章节。

```typescript
interface CssPart {
  id: string
  href: string
}

interface ProcessedChapter {
  css: CssPart[]
  html: string
}
```

在电子书文件中，一般一个章节是一个 html(or xhtml)文件。因此处理后的章节对象包括两部分，一部分是 body 标签下的 html 正文字符串。另一部分是 css，该 css 从章节文件的 link 标签中解析出来，在此以 blob url 的形式给出，即 `CssPart` 中的 `href` 字段，并附带一个该 url 对应的 `id`。css 的 blob url 可以供 link 标签直接引用，也可以通过 fetch api 来获取 css 文本，然后做进一步的处理，比如在 css 选择器前面添加某个 dom 元素的 id，实现 scoped css。

## getToc: () => Toc | undefined

toc 即 table of contents，目录。

```typescript
export interface TocItem {
  label: string
  href: string
  id?: string
  children?: TocItem[]
}
export type Toc = TocItem[]
```

`getToc` 返回的目录是一个数组，数组项中的 `label` 代表目录项的名称。`href` 为内部跳转链接，通过`resolveHref` 来获取该链接对应的章节 id，和 dom 元素的选择器，比如 `[id="example"]`。在获取到章节的 html 之后，通过 `querySelector` 就可以获取要跳转到的元素。`id` 为章节的 id，为可选字段，与 `resolveHref` 解析出来的 id 一致。`children` 为子目录项。epub 中的 toc 也是其中的 `navMap`。

## getMetadata: () => Metadata

电子书的元数据包括书名、语言、描述、作者、日期等字段。因为对应字段的值包括字符串、对象、数组等类型，不同电子书之间难以统一，所以在此将其值的类型设置为了 `any`。具体的可以查看各电子书解析器的详细解释。

```typescript
type Metadata = Record<string, any>
```

## getFileInfo: () => FileInfo

```typescript
interface FileInfo {
  fileName: string
}
```

`FileInfo` 目前有一个公共的文件名 `fileName`，`epub-parser` 中还会有一个 `mimetype` 字段，以后可能会进行扩展。

## getCover?: () => string

该方法目的是获取书籍封面的图片，返回值是一个图像的 blob url，可以供 img 标签直接引用。是一个可选方法。

## resolveHref: (href: string) => ResolvedHref | undefined

在书籍中会有跳转到其他章节的内部链接，也有指向外部网站的外部链接。`resolveHref` 将内部链接解析成内部章节的 id 和书籍 html 中的选择器。如果传入的是外部链接或者是一个不存在的内部链接，会返回 undefined，外部链接比如https://www.example.com。

```typescript
export interface ResolvedHref {
  id: string
  selector: string
}
```

## destroy: () => void

用于清除在文件解析过程中创建的 blob url 等，防止内存泄漏。

# 安全问题

在进行文件解析时，从章节中提取出来的 html 没有经过安全处理，有可能会被 xss 攻击。在解析库中并没有打算对这一点进行处理，而是在 reader-html 上层应用中使用 DOMPurify 弥补了这一缺陷。

# TODO：

1. 处理epub-parser保存文件的问题，
3. 看epub 3.4规范
4. 阅读进度
5. media-overlay语音朗读功能
6. epub的mimetype需要重新整理
7. Parsing may replace some characters in the file path by their percent encoded alternative. For example, A/B/C/file name.xhtml becomes A/B/C/file%20name.xhtml.
8. 非 codec 资源：先压缩（Deflate）再加密，以节省体积。
   codec 资源（音视频）：不要压缩，只加密，避免性能问题和播放问题。
9. The package element attributes
10. 整理epub metadata，rendition:layout，rendition:orientation，rendition:spread，rendition:flow，rendition:align-x-center
11. 有几个警告打印需要清除，mobi
