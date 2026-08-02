<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, onUnmounted, onUpdated, ref, useTemplateRef, watch } from 'vue'
import type { ResolvedHref } from '@lingo-reader/shared'
import { useI18n } from 'vue-i18n'
import { useBookStore } from '../../../store'
import {
  type Config,
  generateAdjusterConfig,
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
  hasCodeBlock,
} from '../sharedLogic'
import { useDebounce, useThrottle, withPx, withPxImportant } from '../../../utils'
import { useCodeHighlight } from '../useCodeHighlight'

const props = defineProps<{
  selectedTocItem: { id: string, selector: string }
}>()

const emits = defineEmits<{
  (event: 'infoDown'): void
  (event: 'receiveConfig', configList: Config[]): void
}>()

/**
 * i18n
 */
const { t } = useI18n()

/**
 * configs
 */
const fontFamily = ref<string>(`'Lucida Console', Courier, monospace`)
const columns = ref<number>(2)
const columnGap = ref<number>(20)
const fontSize = ref<number>(16)
const letterSpacing = ref<number>(0)
const pSpacing = ref<number>(5)
const paddingLeft = ref<number>(10)
const paddingRight = ref<number>(10)
const paddingTop = ref<number>(10)
const paddingBottom = ref<number>(10)
const codeBlockHeight = ref<number>(500)
const lineHeight = ref<number>(2)
const configList: Config[] = [
  generateFontFamilyConfig(fontFamily),
  generateAdjusterConfig('columns', 4, 1, 1, columns),
  generateAdjusterConfig('columnGap', Infinity, 0, 2, columnGap),
  generateFontSizeConfig(fontSize),
  generateLetterSpacingConfig(letterSpacing),
  generatePaddingLeftConfig(paddingLeft),
  generatePaddingRightConfig(paddingRight),
  generatePaddingTopConfig(paddingTop),
  generatePaddingBottomConfig(paddingBottom),
  generateLineHeightConfig(lineHeight),
  generateParaSpacingConfig(pSpacing),
  generateCodeBlockHeightConfig(codeBlockHeight),
]
onMounted(() => {
  emits('receiveConfig', configList)
})
onBeforeUnmount(() => {
  emits('receiveConfig', [])
})
/**
 * book
 */
const bookStore = useBookStore()
const { chapterNums, getChapterHTML, resolveHref } = useBookStore()
const currentChapterHTML = ref<string>('')

// template refs
const articleRef = useTemplateRef<HTMLElement>('articleRef')
useCodeHighlight(articleRef, currentChapterHTML)
const delta = ref<number>(0)
const maxPageIndex = ref<number>(0)
const index = ref<number>(0)

// load book
onMounted(async () => {
  currentChapterHTML.value = await getChapterHTML()
  // jump to the last read location
  nextTick(() => {
    index.value = Math.floor(bookStore.progressInChapter * maxPageIndex.value)
  })
})

async function skipToChapter(newV: ResolvedHref) {
  if (newV.id.length > 0) {
    currentChapterHTML.value = await bookStore.getChapterThroughId(newV.id)
    index.value = 0
  }
  if (newV.selector.length > 0) {
    const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
      const eleLeft = articleRef.value?.querySelector(newV.selector)?.getBoundingClientRect().left
      if (eleLeft) {
        recaculate()
        index.value = Math.min(Math.floor(eleLeft / delta.value), maxPageIndex.value)
      }
      clearTimeout(timer)
    }, 0)
  }
}

// load book when select toc item
watch(() => props.selectedTocItem, skipToChapter)

// handle a tag href, bind to article element
const handleATagHrefColumn = handleATagHref(resolveHref, skipToChapter)

watch(index, (newValue) => {
  // save the last read location
  // increasing newValue by 0.5 is to avoid progress decay when switching readers
  bookStore.progressInChapter = (newValue + 0.5) / maxPageIndex.value
})

function recaculatePage() {
  if (!articleRef.value)
    return

  const pageWidth = Number.parseFloat(
    window.getComputedStyle(articleRef.value!).width,
  ) || 0
  delta.value = pageWidth + columnGap.value

  const articleScrollWidth = articleRef.value.scrollWidth
  maxPageIndex.value = Math.floor(articleScrollWidth / pageWidth) - 1
}
function recaculateScroll() {
  articleRef.value!.scrollTo({
    top: 0,
    left: index.value * delta.value,
  })
}
function recaculate() {
  recaculatePage()
  recaculateScroll()
}
const recaculateWithDebounce = useDebounce(recaculate, 20)
onUpdated(recaculate)
onMounted(() => {
  // the layout of content is not completed in one cycle,
  //  so set 100ms timeout to recaculate some ref
  const timer: ReturnType<typeof setTimeout> = setTimeout(() => {
    recaculate()
    clearTimeout(timer)
  }, 100)
})
window.addEventListener('resize', recaculateWithDebounce)

// page turning
async function nextPage() {
  if (index.value >= maxPageIndex.value) {
    if (bookStore.chapterIndex + 1 < chapterNums) {
      bookStore.chapterIndex++
      currentChapterHTML.value = await getChapterHTML()
      recaculatePage()
      index.value = 0
      recaculateScroll()
    }
  }
  else {
    index.value++
    recaculateScroll()
  }
}
async function prevPage() {
  if (index.value <= 0) {
    if (bookStore.chapterIndex - 1 >= 0) {
      bookStore.chapterIndex--
      currentChapterHTML.value = await getChapterHTML()
      nextTick(() => {
        recaculatePage()
        index.value = Math.max(0, maxPageIndex.value)
        recaculateScroll()
      })
    }
  }
  else {
    index.value--
    recaculateScroll()
  }
}

const wheelEvent = useThrottle((e: WheelEvent) => {
  const target = e.target as HTMLElement
  // prevent scrolling when the mouse is over a code block
  if (hasCodeBlock(target)) {
    return
  }

  emits('infoDown')
  if (e.deltaY > 0) {
    nextPage()
  }
  else {
    prevPage()
  }
}, 400)
const keyDownEvent = useDebounce((e: KeyboardEvent) => {
  e.preventDefault()
  if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
    nextPage()
  }
  else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
    prevPage()
  }
  else {
    return
  }
  emits('infoDown')
}, 150)
document.addEventListener('wheel', wheelEvent, { passive: true })
document.addEventListener('keydown', keyDownEvent)

onUnmounted(() => {
  window.removeEventListener('resize', recaculateWithDebounce)
  document.removeEventListener('wheel', wheelEvent)
  document.removeEventListener('keydown', keyDownEvent)
})
</script>

<template>
  <div
    class="container" :style="{
      fontFamily,
      paddingLeft: withPxImportant(paddingLeft),
      paddingRight: withPxImportant(paddingRight),
      paddingTop: withPxImportant(paddingTop),
      paddingBottom: withPxImportant(paddingBottom),
    }"
  >
    <!-- nextPage and prevPage button -->
    <button class="next-page-button" @click.stop="nextPage">
      {{ t('nextPage') }}
    </button>
    <button class="prev-page-button" @click.stop="prevPage">
      {{ t('prevPage') }}
    </button>
    <!-- !!!maybe error -->
    <span class="progress">{{ index + 1 }} / {{ maxPageIndex === -1 ? 1 : maxPageIndex + 1 }}</span>

    <!-- text -->
    <article
      ref="articleRef" class="article" :style="{
        columns,
        lineHeight,
        'fontSize': withPxImportant(fontSize),
        'columnGap': withPx(columnGap),
        'letterSpacing': withPx(letterSpacing),
        '--p-spacing': withPx(pSpacing),
        '--code-block-height': withPx(codeBlockHeight),
      }" @click="handleATagHrefColumn"
    >
      <div class="article-text" v-html="currentChapterHTML" />

      <!-- placeholder for making sure the scrolling logic working as expected -->
      <div style="width: 100%; height: 100%;" />
    </article>
  </div>
</template>

<style scoped>
/* text */
.container {
  margin: 0;
  box-sizing: border-box;
  height: 100vh;
  width: 100vw;
  background-color: #f0f0f0;
  overflow: hidden;
  position: relative;
}

.article {
  box-sizing: border-box;
  column-fill: auto;
  height: 100%;
  width: 100%;
  overflow: hidden;
  overflow-wrap: break-word;
}

/* To remove default css set by inline style */
.article-text * {
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
  letter-spacing: inherit !important;
}

.article-text :deep(p) {
  text-indent: 2rem;
  margin-bottom: var(--p-spacing, 0);
}

.article-text :deep(li p) {
  text-indent: 0;
}

.article-text :deep(figure p) {
  text-indent: 0;
}

.article-text :deep(figure) {
  text-align: center;
}

.article-text :deep(img) {
  display: block;
  margin: auto;
  max-width: 100%;
  max-height: 97vh;
  object-fit: contain;
}

.article-text :deep(pre) {
  background-color: rgba(204, 201, 194, 0.3);
  overflow: hidden;
  height: var(--code-block-height, 500px);
  overflow: auto;
  padding: 4px;
}

.article-text :deep(code) {
  /* Keep whitespace, but allow auto wrap */
  word-wrap: break-word;
  /* Wrap lines at long words (old standard) */
  word-break: break-word;
  /* Handling line breaks for long words (better compatibility) */
}

.article-text :deep(a) {
  word-wrap: break-word;
  /* Allow long words to wrap */
  white-space: normal;
  /* Ensure that the text can wrap */
  /* word-break: break-all; */
  /* Force line breaks in words */
}

.article-text :deep(table) {
  table-layout: fixed;
  width: 100%;
  word-wrap: break-word;
}

/* prev and next page button */
.next-page-button,
.prev-page-button {
  position: absolute;
  bottom: 0;
  right: 0;
  margin: 5px;
  padding: 5px;
  background-color: #f0f0f0;
  border: 1px solid #000;
  border-radius: 5px;
  opacity: 0.2;
}

.next-page-button:hover,
.prev-page-button:hover {
  opacity: 1;
}

.prev-page-button {
  right: auto;
  left: 0;
}

.progress {
  position: absolute;
  left: 50%;
  bottom: 0;
  transform: translate(-50%);
  opacity: 0.5;
}
</style>
