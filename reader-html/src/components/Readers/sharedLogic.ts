import type { Ref } from 'vue'
import type { ResolvedHref } from '@lingo-reader/shared'
import type { Mode } from '../DropDown'

interface AdjusterConfig {
  type: 'adjuster'
  name: string
  max: number
  min: number
  delta: number
  value: Ref
}

interface SelectionConfig {
  type: 'selection'
  name: string
  selectOptions: Mode[]
  value: Ref
}

export type Config = AdjusterConfig | SelectionConfig

export function generateAdjusterConfig(
  name: string,
  max: number,
  min: number,
  delta: number,
  value: Ref,
): AdjusterConfig {
  if (max < min) {
    throw new Error(`max(${max}) must be greater than min(${min}).`)
  }
  return {
    type: 'adjuster',
    name,
    max,
    min,
    delta,
    value,
  }
}

export function generateSelectionConfig(
  name: string,
  selectOptions: Mode[],
  value: Ref,
): SelectionConfig {
  return {
    type: 'selection',
    name,
    selectOptions,
    value,
  }
}

const fontFamilyList: string[] = [
  `'Lucida Console', Courier, monospace`,
  `'Franklin Gothic Medium', 'Arial Narrow', Arial, sans-serif`,
]
export function generateFontFamilyConfig(fontFamily: Ref<string, string>) {
  return generateSelectionConfig(
    'fontFamily',
    fontFamilyList.map(val => ({ name: val })),
    fontFamily,
  )
}

export function generateFontSizeConfig(fontSize: Ref<number, number>) {
  return generateAdjusterConfig('fontSize', 50, 5, 1, fontSize)
}

export function generateLetterSpacingConfig(letterSpacing: Ref<number, number>) {
  return generateAdjusterConfig('letterSpacing', 10, 0, 0.5, letterSpacing)
}

export function generateLineHeightConfig(lineHeight: Ref<number, number>) {
  return generateAdjusterConfig('lineHeight', 10, 0, 0.1, lineHeight)
}

export function generatePaddingConfig(name: string, paddingOneDirection: Ref<number, number>) {
  return generateAdjusterConfig(name, Infinity, -Infinity, 2, paddingOneDirection)
}

export function generateParaSpacingConfig(pSpacing: Ref<number, number>) {
  return generateAdjusterConfig('pSpacing', Infinity, 0, 1, pSpacing)
}

function findATag(e: MouseEvent): HTMLAnchorElement | undefined {
  const composedPath = e.composedPath()
  const currentTarget = e.currentTarget
  for (const el of composedPath) {
    if (el === currentTarget) {
      return undefined
    }
    if ((el as HTMLElement).tagName === 'A') {
      return el as HTMLAnchorElement
    }
  }
  return undefined
}

export function handleATagHref(
  resolveHref: (href: string) => ResolvedHref | undefined,
  skipToChapter: (resolvedHref: ResolvedHref) => Promise<void>,
) {
  return (e: MouseEvent) => {
    const aTag = findATag(e)

    // there is no need jump when <a> don't have href
    if (aTag?.href) {
      e.preventDefault()
      e.stopPropagation()
      const resolvedHref = resolveHref(aTag.href)
      if (resolvedHref) {
        skipToChapter(resolvedHref)
      }
      else {
        window.open(aTag.href, '_blank')
      }
    }
  }
}
