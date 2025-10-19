<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import FileSelect from '../../components/FileSelect/FileSelect.vue'
import { useBookStore, useLocaleStore } from '../../store'

const router = useRouter()
const bookStore = useBookStore()
const localeStore = useLocaleStore()

/**
 * i18n
 */
const { locale, t } = useI18n()

/**
 * switch language
 */
const languageList = [
  'English',
  '中文',
] as const
// ensure synchronization with the store
if (localeStore.currLanguage === '') {
  localeStore.currLanguage = languageList[0]
}
const i18Map: Record<string, string> = {
  English: 'en',
  中文: 'zh',
}
function selectLanguage(item: string) {
  localeStore.currLanguage = item
  if (i18Map[item]) {
    locale.value = i18Map[item]
  }
}

/**
 * select file
 */
async function processFile(file: File) {
  try {
    await bookStore.initBook(file)
    router.push('/book')
  }
  catch (err: any) {
    const fileName = encodeURIComponent(file.name)
    const errorMessage = encodeURIComponent(err.message)
    const issueTitle = encodeURIComponent(`Parse ${fileName} failed: ${errorMessage}`)
    const issueBody = encodeURIComponent(t('issueBody'))
    const urlToJump = encodeURIComponent(`https://github.com/hhk-png/lingo-reader/issues/new?title=${issueTitle}&body=${issueBody}`)
    const confirmMessage = t('errorMessageToUpload', {
      fileName,
      errorMessage,
      urlToJump,
      issueTitle,
    })
    // eslint-disable-next-line no-alert
    const isOpen = confirm(confirmMessage)
    if (isOpen) {
      window.open(urlToJump, '_blank')
    }
  }
}
</script>

<template>
  <header class="header">
    <div class="left">
      <div class="logo">
        <img class="logo-image" src="/logo.jpg" alt="logo">
      </div>
      <span class="lingo-reader">lingo reader</span>
    </div>
    <div class="middle" />
    <div class="right">
      <!-- github -->
      <a href="https://github.com/hhk-png/lingo-reader" target="_blank" class="github" title="GitHub" />
      <!-- switch language -->
      <div class="language-selector">
        <span class="curr-language">
          {{ localeStore.currLanguage }}
        </span>
        <!-- Current Language Display -->
        <div class="language-dropdown">
          <span v-for="item in languageList" :key="item" class="language-item" @click="selectLanguage(item)">
            {{ item }}
          </span>
        </div>
      </div>
    </div>
  </header>
  <section class="section">
    <FileSelect @file-change="processFile" />
  </section>
</template>

<style scoped>
.header {
  height: 64px;
  line-height: 64px;
  display: flex;
}

.header .left {
  height: 100%;
  display: flex;
  flex: 1 1;
  padding-left: 5px;
}

.logo {
  height: 64px;
  width: 64px;
}

.logo-image {
  height: 100%;
}

/* logo font style */
@keyframes neonGlow {
  0% {
    text-shadow: 0 0 3px #00eaff, 0 0 8px #00eaff, 0 0 12px #00eaff;
  }

  50% {
    text-shadow: 0 0 5px #00ffea, 0 0 12px #00ffea, 0 0 18px #00ffea;
  }

  100% {
    text-shadow: 0 0 3px #00eaff, 0 0 8px #00eaff, 0 0 12px #00eaff;
  }
}

.lingo-reader {
  font-family: Comic Sans MS, sans-serif;
  font-size: 32px;
  font-weight: bold;
  color: #00eaff;
  text-transform: uppercase;
  letter-spacing: 3px;
  padding: 5px 10px;
  border-radius: 5px;
  animation: neonGlow 1.5s infinite alternate;
  display: inline-block;
}

.header .right {
  flex: 0.3 1;
  padding-top: 8px;
  display: flex;
}

.github {
  display: inline-block;
  width: 50px;
  height: 50px;
  background: url('/public/github.svg') no-repeat center center;
  background-size: contain;
}

/* switch language */
.language-selector {
  position: relative;
  border-radius: 5px;
  cursor: pointer;
  padding-left: 20px;
  width: 60px;
}

/* switch icon */
.curr-language {
  display: block;
  position: relative;
}

.curr-language::after {
  position: absolute;
  content: '⇄';
  font-size: 8px;
  top: 2px;
  left: -8px;
}

.language-dropdown {
  display: none;
  position: absolute;
  top: 50px;
  right: 0;
  background-color: #fff;
  border-radius: 5px;
  min-width: 150px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

.language-dropdown .language-item {
  display: block;
  padding-left: 10px;
  color: #333;
  text-decoration: none;
}

.language-dropdown .language-item:hover {
  background-color: #f0f0f0;
}

.language-selector:hover .language-dropdown {
  display: block;
}

.section {
  height: calc(100vh - 64px);
  display: flex;
  justify-content: center;
  align-items: center;
}
</style>
