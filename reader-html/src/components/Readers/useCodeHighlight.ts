import { nextTick, watch } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { glowInner, glowSource } from 'glowglow'

/** Depth-first, document-order walk over every descendant of `root`. */
function walkNodes(root: Node, visit: (node: Node) => void): void {
  for (const child of Array.from(root.childNodes)) {
    visit(child)
    walkNodes(child, visit)
  }
}

interface Anchor {
  offset: number
  node: Element
}

/**
 * Read the code text and collect its `id`-carrying elements (page-break
 * markers), so navigation targets survive highlighting. Markers come from the
 * DOM, not the HTML string — the parser has already resolved entity escaping,
 * so a `<span>` meant to be shown as code is just a text node.
 * `glowSource()` owns the text transform and maps block offsets into it.
 */
function collectAnchors(codeEl: HTMLElement): { text: string, anchors: Anchor[] } {
  const { text, offset } = glowSource(codeEl.textContent ?? '')
  const candidates = new Set<Element>(codeEl.querySelectorAll('[id]'))
  if (candidates.size === 0) {
    return { text, anchors: [] }
  }

  const anchors: Anchor[] = []
  let rawLength = 0
  walkNodes(codeEl, (node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      rawLength += (node as Text).data.length
    }
    else if (candidates.has(node as Element)) {
      anchors.push({ offset: offset(rawLength), node: node as Element })
    }
  })
  return { text, anchors }
}

/** The text node holding `offset`, and how far into it that is. */
function findTextPosition(root: Node, offset: number): { node: Text, local: number } | undefined {
  let accumulated = 0
  let found: { node: Text, local: number } | undefined
  walkNodes(root, (node) => {
    if (found || node.nodeType !== Node.TEXT_NODE) {
      return
    }
    const text = node as Text
    if (offset <= accumulated + text.data.length) {
      found = { node: text, local: offset - accumulated }
      return
    }
    accumulated += text.data.length
  })
  return found
}

/**
 * Put the anchors back at their original character offsets. Most sit inside a
 * token (`// Ac|cess 3rd item`), hence the text-node split. Two markers sharing
 * an offset would re-locate to just before the one already inserted, so the
 * second is chained after the first.
 */
function insertAnchors(codeEl: HTMLElement, anchors: Anchor[]): void {
  let previous: Anchor | undefined

  for (const anchor of anchors) {
    if (previous && anchor.offset === previous.offset) {
      previous.node.parentNode?.insertBefore(anchor.node, previous.node.nextSibling)
      previous = anchor
      continue
    }

    const position = findTextPosition(codeEl, anchor.offset)
    if (!position) {
      console.warn(`Could not restore anchor #${anchor.node.id}: offset ${anchor.offset} is out of range.`)
      continue
    }

    const { node, local } = position
    const parent = node.parentNode
    if (!parent) {
      continue
    }
    if (local <= 0) {
      parent.insertBefore(anchor.node, node)
    }
    else if (local >= node.data.length) {
      parent.insertBefore(anchor.node, node.nextSibling)
    }
    else {
      parent.insertBefore(anchor.node, node.splitText(local))
    }
    previous = anchor
  }
}

// Highlighted HTML keyed by raw code text. `v-html` re-rendering makes the
// `data-highlighted` guard useless across chapters, but this cache still covers
// re-visits. Anchors are re-inserted after parsing, so they don't affect keys.
const highlightCache = new Map<string, string>()
const CACHE_MAX_SIZE = 500

function highlightElement(el: HTMLElement) {
  if (el.dataset.highlighted === 'yes') {
    return
  }
  const raw = el.textContent ?? ''
  if (raw.length === 0) {
    return
  }

  const { text, anchors } = collectAnchors(el)
  if (text.length === 0) {
    return
  }

  let html = highlightCache.get(raw)
  if (html === undefined) {
    // `glowInner()` returns only the markup, so `el` keeps its own attributes
    html = glowInner(text)
    highlightCache.set(raw, html)
    if (highlightCache.size > CACHE_MAX_SIZE) {
      highlightCache.delete(highlightCache.keys().next().value!)
    }
  }

  el.innerHTML = html
  insertAnchors(el, anchors)
  el.dataset.highlighted = 'yes'
}

/**
 * Copy to the clipboard, falling back to a hidden textarea where the async
 * Clipboard API is unavailable or permission-restricted.
 */
async function copyText(text: string): Promise<boolean> {
  if (navigator?.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return true
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.appendChild(textarea)
  textarea.focus()
  textarea.select()
  const ok = document.execCommand('copy')
  document.body.removeChild(textarea)
  return ok
}

/**
 * The wrapper/button aren't in the component templates, so their styles live in
 * one global style tag rather than the readers' scoped CSS.
 */
let copyButtonStyleInjected = false
function injectCopyButtonStyle() {
  if (copyButtonStyleInjected) {
    return
  }
  copyButtonStyleInjected = true
  const style = document.createElement('style')
  style.textContent = `
.code-block-wrapper {
  position: relative;
}

.code-copy-button {
  position: absolute;
  top: 4px;
  right: 20px;
  padding: 2px 8px;
  color: #333;
  background-color: rgba(240, 240, 240, 0.9);
  border: 1px solid #999;
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.4;
}

.code-copy-button:hover,
.code-copy-button.copied {
  opacity: 1;
}

.code-copy-button.copied {
  background-color: #4caf50;
  color: #fff;
  border-color: #4caf50;
}
`
  document.head.appendChild(style)
}

/**
 * Wrap a `pre` in a positioned container and add a copy button to its corner;
 * the wrapper keeps the button put while the code scrolls. Copies
 * `pre.textContent` — the raw code, not the highlighted markup.
 */
function addCopyButton(pre: HTMLElement, t: (key: string) => string) {
  if (pre.dataset.copyAdded === 'yes') {
    return
  }
  pre.dataset.copyAdded = 'yes'

  if ((pre.textContent ?? '').trim().length === 0) {
    return
  }

  const wrapper = document.createElement('div')
  wrapper.className = 'code-block-wrapper'

  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'code-copy-button'
  const copyButtonText = t('copy')
  button.title = copyButtonText
  button.textContent = copyButtonText

  let resetTimer: ReturnType<typeof setTimeout> | undefined
  button.addEventListener('click', async (e) => {
    e.stopPropagation()
    const copied = await copyText(pre.textContent ?? '')
    if (!copied) {
      return
    }
    button.textContent = t('copied')
    button.classList.add('copied')
    if (resetTimer) {
      clearTimeout(resetTimer)
    }
    resetTimer = setTimeout(() => {
      button.textContent = t('copy')
      button.classList.remove('copied')
    }, 2000)
  })

  pre.parentNode?.insertBefore(wrapper, pre)
  wrapper.appendChild(pre)
  wrapper.appendChild(button)
}

/**
 * Highlight every `pre code` in `containerRef` with glowglow and add a copy
 * button to each `pre`. Chapters render through `v-html`, so each source change
 * wipes the highlighting and it has to be reapplied on mount and on every swap.
 */
export function useCodeHighlight(
  containerRef: Readonly<Ref<HTMLElement | null | undefined>>,
  sourceRef: Readonly<Ref<string | undefined>>,
) {
  const { t } = useI18n()
  const highlight = () => {
    injectCopyButtonStyle()
    const root = containerRef.value
    if (!root) {
      return
    }
    root.querySelectorAll<HTMLElement>('pre').forEach((pre) => {
      const code = pre.querySelector<HTMLElement>('code')
      if (code) {
        highlightElement(code)
        addCopyButton(pre, t)
      }
    })
  }

  // v-html re-renders on a later flush, so apply on nextTick
  watch(sourceRef, () => {
    nextTick(highlight)
  }, { immediate: true })

  return highlight
}
