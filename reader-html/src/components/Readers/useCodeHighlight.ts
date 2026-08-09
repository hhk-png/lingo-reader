import { nextTick, watch } from 'vue'
import type { Ref } from 'vue'
import { useI18n } from 'vue-i18n'

type TokenType = 'comment' | 'string' | 'number' | 'keyword' | 'function' | 'property'

/**
 * Generic syntax highlighter with no language detection.
 *
 * A single regex pass matches the lexical shapes that are common to most
 * programming languages, so any `pre > code` block gets readable coloring
 * without knowing what language it is. Order in the alternation matters:
 * comments and strings are greedier, keywords win over function names so
 * `if (` is colored as a keyword rather than a call.
 */
const TOKEN_PATTERN = new RegExp([
  // comments
  /(?<comment>\/\*[\s\S]*?\*\/|<!--[\s\S]*?-->|\/\/[^\n]*|(?:^|(?<=\s))#(?![0-9a-f]{3,6}\b)[^\n]*)/i,
  // strings (double, single, template literal, python triple-quoted)
  /(?<string>"""(?:[^"\\]|\\.)*"""|'''(?:[^'\\]|\\.)*'''|"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`)/,
  // numbers (hex, binary, octal, decimal with exponent)
  /(?<number>\b0x[0-9a-f]+\b|\b0b[01]+\b|\b0o[0-7]+\b|\b\d+(?:\.\d+)?(?:e[+-]?\d+)?\b)/i,
  // keywords (checked before function names)
  /(?<keyword>\b(?:if|else|elif|for|while|do|switch|case|default|break|continue|return|function|def|class|interface|struct|enum|import|from|export|require|const|let|var|new|this|super|self|null|undefined|true|false|True|False|None|nil|try|catch|finally|throw|async|await|yield|static|private|public|protected|delete|in|of|instanceof|typeof|void|with|as|lambda|and|or|not|is|pass|print|printf)\b)/,
  // function calls: identifier followed by `(`
  /(?<function>\b[A-Z_$][\w$]*)(?=\s*\()/i,
  // property access: `.name`
  /(?<property>\.\s*[A-Z_$][\w$]*)/i,
].map(regex => regex.source).join('|'), 'g')

function escapeHTML(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function highlightCode(code: string): string {
  return code.replace(TOKEN_PATTERN, (match, ...rest) => {
    const groups = rest[rest.length - 1] as Record<string, string | undefined>
    const type: TokenType = groups.comment
      ? 'comment'
      : groups.string
        ? 'string'
        : groups.number
          ? 'number'
          : groups.keyword
            ? 'keyword'
            : groups.function
              ? 'function'
              : 'property'
    return `<span class="tok-${type}">${escapeHTML(match)}</span>`
  })
}

// Cache of highlighted HTML keyed by raw code text. Re-rendering the same code
// (chapter switches, reader switches, back-and-forth navigation) creates fresh
// DOM, so the `data-highlighted` guard can't help there; this cache avoids
// re-tokenizing identical code. Shared across all reader instances.
const highlightCache = new Map<string, string>()
const CACHE_MAX_SIZE = 500

function highlightElement(el: HTMLElement) {
  if (el.dataset.highlighted === 'yes') {
    return
  }
  const code = el.textContent ?? ''
  if (code.length === 0) {
    return
  }

  let html = highlightCache.get(code)
  if (!html) {
    html = highlightCode(code)
    highlightCache.set(code, html)
    // keep the cache bounded by evicting the oldest entry
    if (highlightCache.size > CACHE_MAX_SIZE) {
      highlightCache.delete(highlightCache.keys().next().value!)
    }
  }

  el.innerHTML = html
  el.dataset.highlighted = 'yes'
}

/**
 * Copy text to the clipboard, falling back to a hidden textarea for contexts
 * (e.g. embedded webviews) where the async Clipboard API is unavailable or
 * permission-restricted.
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
 * The injected wrapper/button are not part of the component templates, so their
 * styles live in a single global style tag instead of the readers' scoped CSS.
 * `!important` is needed on inherited props because readers force inheritance
 * via `.article-text * { font-size: inherit !important; ... }`.
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
 * Wrap a `pre` in a positioned container and append a copy button to its
 * top-right corner. The wrapper keeps the button in place while the code block
 * itself scrolls. Copying reads `pre.textContent`, i.e. the raw code rather
 * than the highlighted markup.
 */
function addCopyButton(pre: HTMLElement, t: (key: string) => string) {
  if (pre.dataset.copyAdded === 'yes') {
    return
  }
  pre.dataset.copyAdded = 'yes'

  // nothing to copy for an empty code block
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
 * Highlight every `pre code` block inside `containerRef` and attach a copy
 * button to each `pre`.
 *
 * Chapters are rendered with `v-html`, so every time the source HTML changes
 * Vue replaces the inner HTML and wipes the previous highlighting. This
 * composable re-applies highlighting after each change (and on mount).
 *
 * @param containerRef element that contains the rendered chapter HTML
 * @param sourceRef    the chapter HTML string bound to `v-html`
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
