import fs from 'node:fs'
import JSZip from 'jszip'
import type { InputFile } from '@lingo-reader/shared'
import type { EncryptionKeys, EpubFileOptions, PathToProcessors } from './types'

export async function createZipFile(filePath: InputFile): Promise<ZipFile> {
  const zip = new ZipFile(filePath)
  await zip.loadZip()
  return zip
}

// wrap epub file into a class, epub file is a zip file
//  expose file operation(readFile, readImage..) to process the file in .zip
export class ZipFile {
  private jsZip!: JSZip
  private names!: Map<string, string>
  public getNames() {
    return [...this.names.values()]
  }

  private pathToProcessors: PathToProcessors = {}
  public useDeprocessors(processors: PathToProcessors) {
    this.pathToProcessors = {
      ...this.pathToProcessors,
      ...processors,
    }
  }

  constructor(private filePath: InputFile) { }

  public async loadZip() {
    this.jsZip = await this.readZip(this.filePath)
    this.names = new Map(Object.keys(this.jsZip.files).map(
      (name) => {
        return [name.toLowerCase(), name]
      },
    ))
  }

  private async readZip(file: InputFile): Promise<JSZip> {
    return new Promise((resolve, reject) => {
      if (__BROWSER__) {
        const reader = new FileReader()
        reader.onload = () => {
          new JSZip()
            .loadAsync(reader.result!)
            .then((zipFile) => {
              resolve(zipFile)
            })
        }
        reader.readAsArrayBuffer(file as File)
        reader.onerror = () => reject(reader.error)
      }
      else {
        const fileToLoad: Uint8Array = typeof file === 'string'
          ? new Uint8Array(fs.readFileSync(file))
          : file as Uint8Array
        new JSZip()
          .loadAsync(fileToLoad)
          .then((zipFile) => {
            resolve(zipFile)
          })
      }
    })
  }

  public async readFile(name: string): Promise<string> {
    const file = await this.readResource(name)
    return new TextDecoder().decode(file)
  }

  public async readResource(name: string): Promise<Uint8Array> {
    if (!this.hasFile(name)) {
      console.warn(`${name} file was not exit in ${this.filePath}, return an empty uint8 array`)
      return new Uint8Array()
    }
    const fileName = this.getFileName(name)!
    let file = await this.jsZip.file(fileName)!.async('uint8array')
    if (this.pathToProcessors[fileName]) {
      for (const processor of this.pathToProcessors[fileName]) {
        file = await processor(file)
      }
    }
    return file
  }

  public hasFile(name: string): boolean {
    return this.names.has(name.toLowerCase())
  }

  private getFileName(name: string): string | undefined {
    return this.names.get(name.toLowerCase())
  }
}

export const resourceExtensionToMimeType: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  ico: 'image/x-icon',
  tiff: 'image/tiff',
  tif: 'image/tiff',
  heic: 'image/heic',
  avif: 'image/avif',
  css: 'text/css',

  // video
  mp4: 'video/mp4',
  mkv: 'video/mkv',
  webm: 'video/webm',

  // audio
  mp3: 'audio/mp3',
  wav: 'audio/wav',
  ogg: 'audio/ogg',

  // font
  ttf: 'font/ttf',
  otf: 'font/otf',
  woff: 'font/woff',
  woff2: 'font/woff2',
  eot: 'font/eot',
}

export const savedResourceMediaTypePrefixes = new Set(Object.values(resourceExtensionToMimeType))

export const prefixMatch = /(?!xmlns)^.*:/

export function extractEncryptionKeys(options: EpubFileOptions): EncryptionKeys {
  const encryptionKeys: EncryptionKeys = {}
  // options
  if (options.rsaPrivateKey) {
    encryptionKeys.rsaPrivateKey = typeof options.rsaPrivateKey === 'string'
      ? Uint8Array.from(atob(options.rsaPrivateKey), c => c.charCodeAt(0))
      : options.rsaPrivateKey
  }
  if (options.aesSymmetricKey) {
    encryptionKeys.aesSymmetricKey = typeof options.aesSymmetricKey === 'string'
      ? Uint8Array.from(atob(options.aesSymmetricKey), c => c.charCodeAt(0))
      : options.aesSymmetricKey
  }
  return encryptionKeys
}

function withMemoize<Args extends any[], Return>(
  fn: (...args: Args) => Return,
): (...args: Args) => Return {
  const cache = new Map<string, Return>()

  return (...args: Args) => {
    const key = JSON.stringify(args)
    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = fn(...args)
    cache.set(key, result)
    return result
  }
}

export function smilTimeToSeconds(timeStr: string): number {
  // support "h:mm:ss.sss" , "mm:ss.sss" or  "12.5s"
  if (timeStr.endsWith('s')) {
    return Number.parseFloat(timeStr) // "12.5s" case
  }

  const parts = timeStr.split(':').map(Number)
  if (parts.length === 3) {
    const [h, m, s] = parts
    return h * 3600 + m * 60 + s
  }
  else if (parts.length === 2) {
    const [m, s] = parts
    return m * 60 + s
  }
  else {
    return Number(timeStr)
  }
}

export const cachedSmilTimeToSeconds = withMemoize(smilTimeToSeconds)
