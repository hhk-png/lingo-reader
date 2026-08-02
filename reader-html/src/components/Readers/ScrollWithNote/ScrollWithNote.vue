<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref, useTemplateRef, watch } from 'vue'
import type { ResolvedHref } from '@lingo-reader/shared'
import { useI18n } from 'vue-i18n'
import { useBookStore } from '../../../store'
import { useDebounce, withPx } from '../../../utils'
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
const pSpacing = ref<number>(5)
const textPaddingLeft = ref<number>(5)
const textPaddingRight = ref<number>(1)
const textPaddingTop = ref<number>(0)
const textPaddingBottom = ref<number>(300)
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
const articleWrapRef = useTemplateRef('articleWrapRef')

/**
 * book
 */
const bookStore = useBookStore()
const { chapterNums, getChapterHTML, resolveHref } = useBookStore()

const currentChapterHTML = ref<string>()

onMounted(async () => {
  currentChapterHTML.value = await getChapterHTML()
  nextTick(() => {
    // jump to the last read location
    const scrollHeight = articleWrapRef.value!.scrollHeight
    const targetPosition = bookStore.progressInChapter * scrollHeight
    articleWrapRef.value!.scrollTo({ top: targetPosition })
  })
})

// save read position
const handleArticleScroll = useDebounce(() => {
  const progress = articleWrapRef.value!.scrollTop / articleWrapRef.value!.scrollHeight
  bookStore.progressInChapter = progress
}, 500)

async function skipToChapter(newV: ResolvedHref) {
  if (newV.id.length > 0) {
    currentChapterHTML.value = await bookStore.getChapterThroughId(newV.id)
  }
  if (newV.selector.length > 0) {
    nextTick(() => {
      articleWrapRef.value!.querySelector(newV.selector)!.scrollIntoView()
    })
  }
}

// load book when select toc item
watch(() => props.selectedTocItem, skipToChapter)

// handle a tag href, bind to article element
const handleATagHrefScrollNote = handleATagHref(resolveHref, skipToChapter)

async function prevChapter() {
  if (bookStore.chapterIndex > 0) {
    bookStore.chapterIndex--
    currentChapterHTML.value = await getChapterHTML()
    articleWrapRef.value!.scrollTop = 0
  }
}
async function nextChapter() {
  if (bookStore.chapterIndex < chapterNums - 1) {
    bookStore.chapterIndex++
    currentChapterHTML.value = await getChapterHTML()
    articleWrapRef.value!.scrollTop = 0
  }
}

/**
 * textarea blur
 */
let isBlur = false
function noteBlur() {
  isBlur = true
}
function noteFocus() {
  emits('infoDown')
}

/**
 * resize width of note and article
 */
// swap button
const isReverse = ref<boolean>(false)
function swap() {
  isReverse.value = !isReverse.value
}
// resize
let startX = 0
// ban select chapter content in <article>
const isDragging = ref<boolean>(false)
const noteBasis = ref<number>(0)
const articleBasis = ref<number>(0)

function containerClick(e: MouseEvent) {
  if (isDragging.value || isBlur) {
    e.stopPropagation()
  }
  if (isBlur) {
    isBlur = false
  }
}

function onMouseMove(e: MouseEvent) {
  isDragging.value = true
  const delta = e.clientX - startX
  if (isReverse.value) {
    noteBasis.value -= delta * 2
    articleBasis.value += delta * 2
  }
  else {
    noteBasis.value += delta * 2
    articleBasis.value -= delta * 2
  }
  startX = e.clientX
}
function onMouseUp() {
  setTimeout(() => {
    isDragging.value = false
  }, 0)
}
function onMouseDown(e: MouseEvent) {
  startX = e.clientX
}
</script>

<template>
  <button class="swap-button" @click.stop="swap">
    {{ t("swap") }}
  </button>
  <div
    :style="{ fontSize: withPx(fontSize), letterSpacing: withPx(letterSpacing) }"
    :class="{ 'flex-row-reverse': isReverse }" class="article-container" @click="(e) => containerClick(e)"
  >
    <div :style="{ flexBasis: withPx(noteBasis) }" class="note">
      <textarea name="note" @blur="noteBlur" @focus="noteFocus" @click.stop />
    </div>
    <Resizer @mousedown="onMouseDown" @mousemove="onMouseMove" @mouseup="onMouseUp" />
    <!-- this -->
    <div
      ref="articleWrapRef" :style="{
        fontFamily,
        lineHeight,
        'paddingLeft': withPx(textPaddingLeft),
        'paddingRight': withPx(textPaddingRight),
        'paddingTop': withPx(textPaddingTop),
        'paddingBottom': withPx(textPaddingBottom),
        'flexBasis': withPx(articleBasis),
        '--p-spacing': withPx(pSpacing),
        '--code-block-height': withPx(codeBlockHeight),
      }" :class="{ 'user-select-none': isDragging }" class="article-wrap"
      @scroll="handleArticleScroll"
    >
      <button class="button prev-chapter" @click.stop="prevChapter">
        {{ t('prevChapter') }}
      </button>
      <button class="button next-chapter" @click.stop="nextChapter">
        {{ t('nextChapter') }}
      </button>
      <article class="article-text" @click="handleATagHrefScrollNote" v-html="currentChapterHTML" />
    </div>
  </div>
</template>

<style scoped>
.user-select-none {
  user-select: none;
}

.flex-row-reverse {
  flex-direction: row-reverse;
}

.swap-button {
  position: fixed;
  padding: 5px;
  font-family: Lucida Console;
  background-color: #f0f0f0;
  border: 1px solid #000;
  border-radius: 5px;
  opacity: 0.2;
  bottom: 10px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 1;

  &:hover {
    opacity: 1;
  }
}

.article-container {
  height: 100vh;
  min-width: 100vh;
  display: flex;
  margin: 0;
  box-sizing: border-box;
  font-family: 'Lucida Console', Courier, monospace;
  font-size: 20px;
  background-color: #f0f0f0;
}

.note {
  flex: 1 1;
}

.note textarea {
  display: block;
  box-sizing: border-box;
  height: 100vh;
  width: 100%;
  padding: 2rem;
  border: none;
  outline: none;
  resize: none;
}

.article-wrap {
  display: block;
  box-sizing: border-box;
  min-height: 100vh;
  min-width: 140px;
  flex: 1 1;
  overflow-y: auto;
}

.prev-chapter {
  position: fixed;
  top: 10px;
  right: 10px;
  opacity: 0.2;
}

.next-chapter {
  position: fixed;
  bottom: 10px;
  right: 10px;
  opacity: 0.2;
}

.prev-chapter:hover,
.next-chapter:hover {
  opacity: 1;
  background-color: white;
}

/* To remove default css set by inline style */
.article-text * {
  font-family: inherit !important;
  font-size: inherit !important;
  line-height: inherit !important;
  letter-spacing: inherit !important;
}

.article-text :deep(img) {
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
  margin-bottom: var(--p-spacing, 5px);
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
