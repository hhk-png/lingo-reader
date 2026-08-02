<script setup lang='ts'>
import { nextTick, onBeforeUnmount, onMounted, onUnmounted, ref, useTemplateRef, watch } from 'vue'
import type { ResolvedHref } from '@lingo-reader/shared'
import { useI18n } from 'vue-i18n'
import { useBookStore } from '../../../store'
import { useDebounce, useDomSize, withPx } from '../../../utils'
import { useCodeHighlight } from '../useCodeHighlight'
import Resizer from '../../Resizer/Resizer.vue'
import {
  type Config,
  generateCodeBlockHeightConfig,
  generateFontFamilyConfig,
  generateFontSizeConfig,
  generateLetterSpacingConfig,
  generateLineHeightConfig,
  generatePaddingBottomConfig,
  generatePaddingLeftConfig,
  generatePaddingRightConfig,
  generatePaddingTopConfig,
  generateParaSpacingConfig,
  handleATagHref,
} from '../sharedLogic'

const props = defineProps<{
  selectedTocItem: { id: string, selector: string }
}>()

const emits = defineEmits<{
  (e: 'infoDown'): void
  (event: 'receiveConfig', configList: Config[]): void
}>()

/**
 * i18n
 */
const { t } = useI18n()

const fontFamily = ref<string>(`'Lucida Console', Courier, monospace`)
const fontSize = ref<number>(16)
const letterSpacing = ref<number>(0)
const lineHeight = ref<number>(2)
const textPaddingLeft = ref<number>(2)
const textPaddingRight = ref<number>(2)
const textPaddingTop = ref<number>(0)
const textPaddingBottom = ref<number>(300)
// Another way to implement dynamic paragraph spacing is to use dynamic injection of <style>
const pSpacing = ref<number>(5)
const codeBlockHeight = ref<number>(500)
const configList: Config[] = [
  generateFontFamilyConfig(fontFamily),
  generateFontSizeConfig(fontSize),
  generateLetterSpacingConfig(letterSpacing),
  generateLineHeightConfig(lineHeight),
  generateParaSpacingConfig(pSpacing),
  generatePaddingLeftConfig(textPaddingLeft),
  generatePaddingRightConfig(textPaddingRight),
  generatePaddingTopConfig(textPaddingTop),
  generatePaddingBottomConfig(textPaddingBottom),
  generateCodeBlockHeightConfig(codeBlockHeight),
]
onMounted(() => {
  emits('receiveConfig', configList)
})
onBeforeUnmount(() => {
  emits('receiveConfig', [])
})

/**
 * button positioning
 */
const containerRef = useTemplateRef('containerRef')
const { width: containerWidth } = useDomSize(containerRef)
/**
 * book
 */
const bookStore = useBookStore()
const { chapterNums, getChapterHTML, resolveHref } = useBookStore()
const currentChapterHTML = ref<string>()
useCodeHighlight(containerRef, currentChapterHTML)
onMounted(async () => {
  currentChapterHTML.value = await getChapterHTML()
  nextTick(() => {
    // jump to the last read location
    const scrollHeight = containerRef.value!.scrollHeight
    const targetPosition = bookStore.progressInChapter * scrollHeight
    window.scrollTo({ top: targetPosition })
    // ??? cannot work, why?
    // containerRef.value!.scrollTop = targetPosition
  })
})

// save read position
const saveReadPos = useDebounce(() => {
  const progress = document.documentElement?.scrollTop / document.documentElement.scrollHeight
  bookStore.progressInChapter = progress
}, 500)
window.addEventListener('scroll', saveReadPos)
// if you don't clear the events on the window, there will be strange bug
onUnmounted(() => {
  window.removeEventListener('scroll', saveReadPos)
})

async function skipToChapter(newV: ResolvedHref) {
  if (newV.id.length > 0) {
    currentChapterHTML.value = await bookStore.getChapterThroughId(newV.id)
  }
  if (newV.selector.length > 0) {
    nextTick(() => {
      const targetEle = containerRef.value!.querySelector(newV.selector)
      if (targetEle) {
        targetEle.scrollIntoView()
      }
    })
  }
}

// load book when select toc item
watch(() => props.selectedTocItem, skipToChapter)

// handle a tag href, bind to article element
const handleATagHrefScroll = handleATagHref(resolveHref, skipToChapter)

/**
 * chapter turning
 */
async function prevChapter() {
  if (bookStore.chapterIndex > 0) {
    bookStore.chapterIndex--
    currentChapterHTML.value = await getChapterHTML()
    window.scrollTo({ top: 0 })
  }
}
async function nextChapter() {
  if (bookStore.chapterIndex < chapterNums - 1) {
    bookStore.chapterIndex++
    currentChapterHTML.value = await getChapterHTML()
    window.scrollTo({ top: 0 })
  }
}

/**
 * move drag bar
 */
const paddingLeft = ref<number>(200)
const paddingRight = ref<number>(200)
onMounted(() => {
  paddingLeft.value = 0.2 * containerWidth.value
  paddingRight.value = 0.2 * containerWidth.value
})
const isDragging = ref<boolean>(false)

let startX = 0
let dragType = ''
function barDrag(type: string, e: MouseEvent) {
  startX = e.clientX
  dragType = type
}
function onMouseMove(e: MouseEvent) {
  const delta = e.clientX - startX
  const maxPadding = containerWidth.value - 400
  isDragging.value = true
  emits('infoDown')

  if (dragType === 'left') {
    paddingLeft.value = Math.min(
      Math.max(0, paddingLeft.value + delta),
      maxPadding - paddingRight.value,
    )
  }
  else {
    paddingRight.value = Math.min(
      Math.max(0, paddingRight.value - delta),
      maxPadding - paddingLeft.value,
    )
  }

  startX = e.clientX
}
function onMouseUp() {
  setTimeout(() => {
    isDragging.value = false
  }, 0)
}
// mouseevent will trigger other's element click event,
//  so we need to stop it in this event loop.
function containerClick(e: MouseEvent) {
  if (isDragging.value) {
    e.stopPropagation()
  }
}
</script>

<template>
  <div
    ref="containerRef" :style="{ paddingLeft: withPx(paddingLeft), paddingRight: withPx(paddingRight) }"
    :class="{ 'user-select-none': isDragging }" class="article-container" @click="containerClick"
  >
    <button :style="{ left: withPx(containerWidth - paddingRight) }" class="button" @click.stop="nextChapter">
      {{ t('nextChapter') }}
    </button>
    <button :style="{ right: withPx(containerWidth - paddingLeft) }" class="button" @click.stop="prevChapter">
      {{ t('prevChapter') }}
    </button>
    <!-- book text -->
    <Resizer @mousedown="(e) => barDrag('left', e)" @mousemove="onMouseMove" @mouseup="onMouseUp" />

    <article
      :style="{
        fontFamily,
        lineHeight,
        'paddingLeft': withPx(textPaddingLeft),
        'paddingRight': withPx(textPaddingRight),
        'paddingTop': withPx(textPaddingTop),
        'paddingBottom': withPx(textPaddingBottom),
        'fontSize': withPx(fontSize),
        'letterSpacing': withPx(letterSpacing),
        '--p-spacing': withPx(pSpacing),
        '--code-block-height': withPx(codeBlockHeight),
      }" class="article-text" @click="handleATagHrefScroll" v-html="currentChapterHTML"
    />

    <Resizer @mousedown="(e) => barDrag('right', e)" @mousemove="onMouseMove" @mouseup="onMouseUp" />
  </div>
</template>

<style scoped>
.user-select-none {
  user-select: none;
}

.article-container {
  width: 100%;
  min-height: 100vh;
  display: flex;
  margin: 0;
  box-sizing: border-box;
  font-family: 'Lucida Console', Courier, monospace;
  background-color: #f0f0f0;
}

.article-container button {
  position: fixed;
  top: 10px;
  margin: 5px;
  padding: 5px;
  background-color: #f0f0f0;
  border: 1px solid #000;
  border-radius: 5px;
  opacity: 0.2;

  &:hover {
    opacity: 1;
  }
}

.article-text {
  flex: 1 0;
  box-sizing: border-box;
  min-width: 300px;
  margin: 0 0 0 5px;
}

/* To remove default css set by inline style */
.article-text * {
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
  letter-spacing: inherit !important;
}

.article-text :deep(img) {
  /* display: block; */
  /* margin: auto; */
  /* make img fit to its parent */
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.article-text :deep(pre) {
  background-color: rgba(204, 201, 194, 0.3);
  height: var(--code-block-height, 500px);
  overflow: auto;
  padding: 4px;
}

.article-text :deep(p) {
  text-indent: 2rem;
  margin-bottom: var(--p-spacing, 0);
}

.article-text :deep(li p) {
  text-indent: 0;
}

.article-text :deep(ul) {
  padding-left: 2em;
}

.article-text :deep(figure) {
  text-align: center;
}

.article-text :deep(table) {
  table-layout: fixed;
  width: 100%;
  word-wrap: break-word;
}
</style>
