import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'

const htmlEntityMap: Record<string, string> = {
  '&lt;': '<',
  '&gt;': '>',
  '&amp;': '&',
  '&quot;': '"',
  '&#39;': '\'',
}
export function unescapeHTML(str: string): string {
  if (!str.includes('&')) {
    return str
  }

  return str.replace(/&(#x[\dA-Fa-f]+|#\d+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity.startsWith('#x')) {
      // Handle hexadecimal entities
      return String.fromCodePoint(Number.parseInt(entity.slice(2), 16))
    }
    else if (entity.startsWith('#')) {
      // Handle decimal entities
      return String.fromCodePoint(Number.parseInt(entity.slice(1), 10))
    }
    else {
      // Handle named entities
      return htmlEntityMap[match] || match
    }
  })
}

/**
 * resource type
 */
export const MIME = {
  XML: 'application/xml',
  XHTML: 'application/xhtml+xml',
  HTML: 'text/html',
  CSS: 'text/css',
  SVG: 'image/svg+xml',
}

type FileMimeType =
  'image/jpeg' | 'image/png' | 'image/gif' | 'image/bmp' |
  'image/svg+xml' | 'text/css' | 'application/xml' | 'application/xhtml+xml' |
  'text/html' | 'video/mp4' | 'video/mkv' | 'video/webm' | 'audio/mp3' |
  'audio/wav' | 'audio/ogg' | 'font/ttf' | 'font/otf' | 'font/woff' |
  'font/woff2' | 'font/eot' | 'unknown' | 'image/jpg'

type FileExt =
  'jpg' | 'png' | 'gif' | 'bmp' | 'svg' | 'css' | 'xml' | 'xhtml' |
  'html' | 'mp4' | 'mkv' | 'webm' | 'mp3' | 'wav' | 'ogg' | 'ttf' |
  'otf' | 'woff' | 'woff2' | 'eot' | 'bin' | 'jpeg'

export const MimeToExt: Record<FileMimeType, FileExt> = {
  // image
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/bmp': 'bmp',
  'image/svg+xml': 'svg',

  // text
  'text/css': 'css',
  'application/xml': 'xml',
  'application/xhtml+xml': 'xhtml',
  'text/html': 'html',

  // video
  'video/mp4': 'mp4',
  'video/mkv': 'mkv',
  'video/webm': 'webm',

  // audio
  'audio/mp3': 'mp3',
  'audio/wav': 'wav',
  'audio/ogg': 'ogg',

  // font
  'font/ttf': 'ttf',
  'font/otf': 'otf',
  'font/woff': 'woff',
  'font/woff2': 'woff2',
  'font/eot': 'eot',

  // unknown
  'unknown': 'bin',
}

const fileSignatures: Record<string, FileMimeType> = {
  'ffd8ff': 'image/jpeg',
  '89504e47': 'image/png',
  '47494638': 'image/gif',
  '424d': 'image/bmp',
  '3c737667': 'image/svg+xml',
  '00000018': 'video/mp4',
  '00000020': 'video/mp4',
  '1a45dfa3': 'video/mkv',
  '1f43b675': 'video/webm',
  '494433': 'audio/mp3',
  '52494646': 'audio/wav',
  '4f676753': 'audio/ogg',
  '00010000': 'font/ttf',
  '74727565': 'font/ttf',
  '4f54544f': 'font/otf',
  '774f4646': 'font/woff',
  '774f4632': 'font/woff2',
  '504c': 'font/eot',
}

export function getFileMimeType(fileBuffer: Uint8Array): FileMimeType {
  const header = fileBuffer.slice(0, 12)
  const hexHeader = Array.from(header)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')

  for (const [signature, type] of Object.entries(fileSignatures)) {
    if (hexHeader.startsWith(signature)) {
      return type
    }
  }

  return 'unknown'
}

export interface Resource {
  type: FileMimeType
  raw: Uint8Array
}

export function saveResource(
  data: Uint8Array | string,
  type: FileMimeType,
  filename: string,
  imageSaveDir: string,
): string {
  if (__BROWSER__) {
    return URL.createObjectURL(new Blob([data as Uint8Array<ArrayBuffer> | string], { type }))
  }
  else {
    const fileName = `${filename}.${MimeToExt[type]}`
    const url = resolve(imageSaveDir, fileName)
    writeFileSync(url, data)
    return url
  }
}

export const mobiEncoding: Record<string, string> = {
  1252: 'windows-1252',
  65001: 'utf-8',
}

export const mobiLang: Record<string, (string | null)[]> = {
  1: ['ar', 'ar-SA', 'ar-IQ', 'ar-EG', 'ar-LY', 'ar-DZ', 'ar-MA', 'ar-TN', 'ar-OM', 'ar-YE', 'ar-SY', 'ar-JO', 'ar-LB', 'ar-KW', 'ar-AE', 'ar-BH', 'ar-QA'],
  2: ['bg'],
  3: ['ca'],
  4: ['zh', 'zh-TW', 'zh-CN', 'zh-HK', 'zh-SG'],
  5: ['cs'],
  6: ['da'],
  7: ['de', 'de-DE', 'de-CH', 'de-AT', 'de-LU', 'de-LI'],
  8: ['el'],
  9: ['en', 'en-US', 'en-GB', 'en-AU', 'en-CA', 'en-NZ', 'en-IE', 'en-ZA', 'en-JM', null, 'en-BZ', 'en-TT', 'en-ZW', 'en-PH'],
  10: ['es', 'es-ES', 'es-MX', null, 'es-GT', 'es-CR', 'es-PA', 'es-DO', 'es-VE', 'es-CO', 'es-PE', 'es-AR', 'es-EC', 'es-CL', 'es-UY', 'es-PY', 'es-BO', 'es-SV', 'es-HN', 'es-NI', 'es-PR'],
  11: ['fi'],
  12: ['fr', 'fr-FR', 'fr-BE', 'fr-CA', 'fr-CH', 'fr-LU', 'fr-MC'],
  13: ['he'],
  14: ['hu'],
  15: ['is'],
  16: ['it', 'it-IT', 'it-CH'],
  17: ['ja'],
  18: ['ko'],
  19: ['nl', 'nl-NL', 'nl-BE'],
  20: ['no', 'nb', 'nn'],
  21: ['pl'],
  22: ['pt', 'pt-BR', 'pt-PT'],
  23: ['rm'],
  24: ['ro'],
  25: ['ru'],
  26: ['hr', null, 'sr'],
  27: ['sk'],
  28: ['sq'],
  29: ['sv', 'sv-SE', 'sv-FI'],
  30: ['th'],
  31: ['tr'],
  32: ['ur'],
  33: ['id'],
  34: ['uk'],
  35: ['be'],
  36: ['sl'],
  37: ['et'],
  38: ['lv'],
  39: ['lt'],
  41: ['fa'],
  42: ['vi'],
  43: ['hy'],
  44: ['az'],
  45: ['eu'],
  46: ['hsb'],
  47: ['mk'],
  48: ['st'],
  49: ['ts'],
  50: ['tn'],
  52: ['xh'],
  53: ['zu'],
  54: ['af'],
  55: ['ka'],
  56: ['fo'],
  57: ['hi'],
  58: ['mt'],
  59: ['se'],
  62: ['ms'],
  63: ['kk'],
  65: ['sw'],
  67: ['uz', null, 'uz-UZ'],
  68: ['tt'],
  69: ['bn'],
  70: ['pa'],
  71: ['gu'],
  72: ['or'],
  73: ['ta'],
  74: ['te'],
  75: ['kn'],
  76: ['ml'],
  77: ['as'],
  78: ['mr'],
  79: ['sa'],
  82: ['cy', 'cy-GB'],
  83: ['gl', 'gl-ES'],
  87: ['kok'],
  97: ['ne'],
  98: ['fy'],
}
