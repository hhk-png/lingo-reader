<script setup lang="ts">


const emits = defineEmits<{
  (eName: 'mousedown', e: MouseEvent): void,
  (eName: 'mousemove', e: MouseEvent): void,
  (eName: 'mouseup', e?: MouseEvent): void
}>()


let isDragging = false
const onMouseMove = (e: MouseEvent) => {
  if (!isDragging) return
  emits('mousemove', e)
}
const onMouseUp = (e: MouseEvent) => {
  isDragging = false
  emits('mouseup', e)
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}
const resize = (e: MouseEvent) => {
  isDragging = true
  emits('mousedown', e)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

</script>

<template>
  <div @dragstart.prevent @mousedown="(e) => resize(e)" class="resizer-container">
    <div @dragstart.prevent class="resizer"></div>
  </div>
</template>

<style scoped>
.resizer-container {
  flex: 0 0 3px;
  background-color: #ddd;
  cursor: e-resize;
  position: relative;
}

.resizer {
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  width: 1rem;
  height: 100%;
  background-color: #ADD8E6;
  transition: opacity 1s;
  display: none;
}

.resizer-container:hover .resizer {
  display: block;
  opacity: 0.2;
}
</style>
