<script setup lang="ts">
import { ref, useTemplateRef } from 'vue'
import { Config } from '../../../components/Readers/sharedLogic'
import DropDown from '../../../components/DropDown'
import ValueAdjuster from '../../../components/ValueAdjuster/ValueAdjuster.vue'
import { useClickOutside } from '../../../utils'
import { useI18n } from "vue-i18n"

/**
 * i18n
 */
const { t } = useI18n()


defineProps<{
  config: Config[]
}>()
const showConfigPannel = ref<boolean>(false)
const tooglePannelShow = () => {
  showConfigPannel.value = !showConfigPannel.value
}

const configArea = useTemplateRef('configArea')
useClickOutside(configArea, () => {
  showConfigPannel.value = false
})

</script>

<template>
  <div @click.stop="tooglePannelShow" class="config" ref="configArea">
    <span class="tag"><img src="/config.svg" alt="config tag"></span>
    <div @wheel.stop.passive v-show="showConfigPannel" class="config-pannel">
      <div @click.stop v-if="!config.length" class="pannel-item">
        There is no configuration items provided by this reading mode.
      </div>
      <div @click.stop v-for="item in config" class="pannel-item">
        <!-- @vue-expect-error item.value is a ref, it can be handled by vue -->
        <DropDown v-if="item.type === 'selection'" :key="item.name + '-selection'" :label="t(item.name)"
          :modes="item.selectOptions" v-model:current-mode-name="item.value" :label-width="150"></DropDown>
        <!-- @vue-expect-error item.value is a ref, it can be handled by vue -->
        <ValueAdjuster v-else-if="item.type === 'adjuster'" :key="item.name + '-adjuster'" :label="t(item.name)"
          :max="item.max" :min="item.min" :delta="item.delta" v-model="item.value" :label-width="150">
        </ValueAdjuster>
      </div>
    </div>
  </div>
</template>

<style scoped>
.config {
  flex: 0;
  margin-left: 2rem;
  position: relative;
  height: 37px;
  display: flex;
  align-items: center;
}

.config .tag {
  cursor: pointer;
  width: 25px;
  height: 25px;
}

.config-pannel {
  position: absolute;
  top: 100%;
  left: 0;
  width: 400px;
  max-height: 75vh;
  overflow-y: auto;
  background-color: #fefefe;
  border-radius: 4px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  display: flex;
  flex-wrap: wrap;
}

.pannel-item {
  flex: 1 1 400px;
  padding: 10px;
}
</style>
