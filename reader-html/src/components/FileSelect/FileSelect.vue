<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { width, height } = defineProps<{
  width?: number
  height?: number
}>()

const emits = defineEmits<{
  fileChange: [file: File]
}>()

/**
 * i18n
 */
const { t } = useI18n()

/**
 * get file
 */
// process file, emit fileChange event
function processFile(file: File) {
  emits('fileChange', file)
}

// select file
function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  if (target && target.files) {
    const file = target.files[0]
    processFile(file)
  }
}

// container drag and drop
const isDragging = ref(false)
function handleDragEnter() {
  isDragging.value = true
}
function handleDragOver() {
  isDragging.value = true
}
function handleDragLeave() {
  isDragging.value = false
}
function handleDrop(e: DragEvent) {
  isDragging.value = false

  if (e.dataTransfer && e.dataTransfer.files) {
    const file = e.dataTransfer.files[0]
    processFile(file)
  }
}
</script>

<template>
  <div
    :style="{ width: `${width}rem`, height: `${height}rem` }" class="file-upload-container" @dragenter.prevent="handleDragEnter"
    @dragover.prevent="handleDragOver" @dragleave.prevent="handleDragLeave" @drop.prevent="handleDrop"
  >
    <!-- drag overlay -->
    <div v-show="isDragging" class="drag-overlay">
      <p>Release the file for parsing</p>
    </div>

    <!-- file select -->
    <div class="get-file-content">
      <!-- file select button -->
      <label v-show="!isDragging" for="fileInput" class="file-input-label">{{ t("selectFile") }}</label>
      <!-- hidden file input -->
      <input id="fileInput" type="file" class="file-input" accept=".epub,.mobi,.kf8,.azw3,.fb2" @change="handleFileChange">
    </div>

    <!-- file support -->
    <span v-show="!isDragging" class="info">
      {{ t('supportedFileTypsPrefix') }}
      <b>.epub</b> <b>.mobi</b> <b>.azw3(.kf8)</b> <b>.fb2</b>
      {{ t('supportedFileTypsSuffix') }}
      <a class="error-feedback" href="https://github.com/hhk-png/lingo-reader/issues/new" target="_blank">{{ t('errorFeedback') }}</a>
    </span>
  </div>
</template>

<style scoped>
/* main container */
.file-upload-container {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
  border: 2px dashed #aaa;
  border-radius: 10px;
  width: 38rem;
  height: 32rem;
}

.drag-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background-color: rgba(76, 175, 80, 0.5);
  color: white;
  font-size: 18px;
  border-radius: 10px;
  z-index: 10;
  pointer-events: none;
}

.get-file-content {
  display: flex;
}

/* file select button css */
.file-input-label {
  padding: 10px 20px;
  background-color: #4caf4f;
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 16px;
  margin-bottom: 10px;
}

.file-input {
  display: none;
  pointer-events: none;
}

.info {
  font-size: 12px;
  color: #aaa;
  pointer-events: none;
}

.error-feedback {
  pointer-events: auto;
}
</style>
