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
  `'Tahoma', 'Geneva', sans-serif`,
  `'Verdana', 'Geneva', sans-serif`,
  `'Georgia', 'Times New Roman', Times, serif`,
  `'Trebuchet MS', Helvetica, sans-serif`,
  `'Courier New', Courier, monospace`,
  `'Impact', 'Charcoal', sans-serif`,
  `'Comic Sans MS', cursive, sans-serif`,
  `'Lucida Sans', 'Lucida Grande', sans-serif`,
  `'Palatino Linotype', 'Book Antiqua', Palatino, serif`,
  `'Arial', Helvetica, sans-serif`,
  `'Times', 'Times New Roman', serif`,
  `'Consolas', 'Monaco', monospace`,
  `'Microsoft YaHei', '微软雅黑', 'Heiti SC', '黑体', sans-serif`,
  `'PingFang SC', '苹方', 'Heiti', '黑体', sans-serif`,
  `'SimSun', '宋体', 'Times New Roman', serif`,
  `'SimHei', '黑体', sans-serif`,
  `'KaiTi', '楷体', serif`,
  `'FangSong', '仿宋', serif`,
  `'Microsoft JhengHei', '微软正黑体', 'Heiti', sans-serif`,
  `'STHeiti', '华文黑体', sans-serif`,
  `'STKaiti', '华文楷体', serif`,
  `'STSong', '华文宋体', serif`,
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

export function generatePaddingLeftConfig(paddingOneDirection: Ref<number, number>) {
  return generateAdjusterConfig('paddingLeft', Infinity, -Infinity, 2, paddingOneDirection)
}

export function generatePaddingRightConfig(paddingOneDirection: Ref<number, number>) {
  return generateAdjusterConfig('paddingRight', Infinity, -Infinity, 2, paddingOneDirection)
}

export function generatePaddingTopConfig(paddingOneDirection: Ref<number, number>) {
  return generateAdjusterConfig('paddingTop', Infinity, -Infinity, 2, paddingOneDirection)
}

export function generatePaddingBottomConfig(paddingOneDirection: Ref<number, number>) {
  return generateAdjusterConfig('paddingBottom', Infinity, -Infinity, 2, paddingOneDirection)
}
export function generateParaSpacingConfig(pSpacing: Ref<number, number>) {
  return generateAdjusterConfig('paraSpacing', Infinity, 0, 1, pSpacing)
}

export function generateCodeBlockHeightConfig(codeBlockHeight: Ref<number, number>) {
  return generateAdjusterConfig('codeBlockHeight', 1000, 100, 20, codeBlockHeight)
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
        console.warn(`Can't resolve href: ${aTag.href}`)
        window.open(aTag.href, '_blank')
      }
    }
  }
}

export function hasCodeBlock(target: HTMLElement): boolean {
  // `closest` also matches descendants added by syntax highlighting
  // (e.g. `span.tok-keyword` inside `pre > code`)
  return target.closest('pre') !== null
}
