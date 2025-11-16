import { camelCase } from '@lingo-reader/shared'
import type {
  Author,
  CustomInfo,
  DocumentInfo,
  Fb2Metadata,
  Fb2ResourceMap,
  PublishInfo,
  TitleInfo,
} from './types'
import { extend, getFirstXmlNodeText } from './utils'

// <binary id="_" content-type>...<binary>
export function parseBinary(binaryAST: any): Fb2ResourceMap {
  const resourceMap: Fb2ResourceMap = new Map()
  for (const binary of binaryAST ?? []) {
    const $ = binary.$
    const id = $.id
    const contentType = $['content-type']
    if (!id || !contentType) {
      throw new Error('The <binary> element must have `id` and `content-type` attributes.')
    }
    resourceMap.set(id, {
      id,
      contentType: $['content-type'],
      base64Data: binary._,
    })
  }
  return resourceMap
}

function parseAuthor(authorAST: any): Author {
  const firstName = getFirstXmlNodeText(authorAST['first-name'])
  const middleName = getFirstXmlNodeText(authorAST['middle-name'])
  const lastName = getFirstXmlNodeText(authorAST['last-name'])
  const name = [firstName, middleName, lastName].filter(Boolean).join(' ')
  return {
    firstName,
    middleName,
    lastName,
    name,
    nickname: getFirstXmlNodeText(authorAST['first-name']),
    homePage: getFirstXmlNodeText(authorAST['home-page']),
    email: getFirstXmlNodeText(authorAST.email),
  }
}

function parseCoverpage(coverpageAST: any): string {
  const $ = coverpageAST.image[0].$
  return $['l:href'] ?? $['xlink:href']
}

export function parseTitleInfo(titleInfoAST: any): TitleInfo {
  const titleInfo: TitleInfo = {}

  const directMapFields: Record<string, keyof TitleInfo> = {
    'genre': 'type',
    'lang': 'language',
    'annotation': 'description',
    'book-title': 'title',
    'src-lang': 'srcLang',
  }

  for (const key in titleInfoAST) {
    const node = titleInfoAST[key]?.[0]

    if (key in directMapFields && node && '_' in node) {
      titleInfo[directMapFields[key]] = node._
      continue
    }

    switch (key) {
      case 'author': {
        titleInfo.author = parseAuthor(node)
        break
      }
      case 'coverpage': {
        // remove '#'
        titleInfo.coverImageId = parseCoverpage(node).slice(1)
        break
      }
    }
  }

  return titleInfo
}

export function parseDocumentInfo(documentInfoAST: any): DocumentInfo & { history?: any } {
  const documentInfo: DocumentInfo & { history?: any } = {}
  for (const key in documentInfoAST) {
    if (key === 'children') {
      continue
    }
    else if (key === 'author') {
      documentInfo.author = parseAuthor(documentInfoAST.author[0])
    }
    else if (key === 'history') {
      documentInfo.history = documentInfoAST.history[0]
    }
    else {
      documentInfo[camelCase(key) as keyof Omit<DocumentInfo, 'author'>]
        = getFirstXmlNodeText(documentInfoAST[key])
    }
  }

  return documentInfo
}

export function parsePublishInfo(publishInfoAST: any): PublishInfo {
  const publishInfo: PublishInfo = {}
  for (const key in publishInfoAST) {
    if (key === 'children') {
      continue
    }
    const node = publishInfoAST[key]
    publishInfo[camelCase(key) as keyof PublishInfo]
      = getFirstXmlNodeText(node)
  }

  return publishInfo
}

export function parseCustomInfo(customInfoAST: any): CustomInfo {
  const res: CustomInfo = {}
  for (const customInfo of customInfoAST) {
    const infoType = customInfo.$['info-type']
    res[infoType] = customInfo._
  }
  return res
}

export function parseDescription(descriptionAST: any) {
  const metadata: Fb2Metadata = {}
  let coverImageId = ''
  let history: any

  // title-info
  if (descriptionAST['title-info']) {
    const titleInfo = parseTitleInfo(descriptionAST['title-info'][0])
    coverImageId = titleInfo.coverImageId ?? ''
    extend(metadata, titleInfo, ['coverImageId'])
  }
  // document-info
  if (descriptionAST['document-info']) {
    const documentInfo = parseDocumentInfo(descriptionAST['document-info'][0])
    extend(metadata, documentInfo, ['history'])
    history = documentInfo.history
  }
  // publish-info
  if (descriptionAST['publish-info']) {
    const publishInfo = parsePublishInfo(descriptionAST['publish-info'][0])
    extend(metadata, publishInfo)
  }
  // custom-info info-type as key
  if (descriptionAST['custom-info']) {
    const customInfo = parseCustomInfo(descriptionAST['custom-info'])
    extend(metadata, customInfo)
  }

  return {
    metadata,
    coverImageId,
    history,
  }
}
