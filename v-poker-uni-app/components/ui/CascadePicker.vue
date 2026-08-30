<template>
  <view v-if="visible" class="cascade-mask" @click="close">
    <view class="cascade-panel" @click.stop>
      <view class="cascade-header">
        <text class="cascade-cancel" @click="close">取消</text>
        <text class="cascade-title">{{ title }}</text>
        <text class="cascade-confirm" @click="confirm">确定</text>
      </view>
      <picker-view class="cascade-picker" :value="pickerValue" @change="onPickerChange">
        <picker-view-column v-for="(col, ci) in columns" :key="ci">
          <view v-for="(opt, oi) in col" :key="oi" class="picker-item touch-target">
            <text>{{ opt.label }}</text>
          </view>
        </picker-view-column>
      </picker-view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'CascadePicker',
  props: {
    visible: { type: Boolean, default: false },
    title: { type: String, default: '请选择' },
    treeData: { type: Array, default: () => [] },
    level: { type: Number, default: 2 }
  },
  data() {
    return {
      pickerValue: [0, 0],
      columns: [[], []]
    }
  },
  watch: {
    visible(val) {
      if (val) {
        this.pickerValue = [0, 0]
        this.initColumns()
      }
    },
    treeData: {
      immediate: true,
      handler() { this.initColumns() }
    }
  },
  methods: {
    initColumns() {
      this.columns[0] = this.treeData || []
      const first = this.treeData?.[this.pickerValue[0]]
      this.columns[1] = first?.children || []
    },
    onPickerChange(e) {
      const val = [...e.detail.value]
      if (val[0] !== this.pickerValue[0]) {
        this.columns[1] = this.treeData[val[0]]?.children || []
        val[1] = 0
      }
      this.pickerValue = val
    },
    confirm() {
      const result = this.pickerValue.map((v, i) => this.columns[i]?.[v]).filter(Boolean)
      uni.vibrateShort && uni.vibrateShort({ type: 'light' })
      this.$emit('confirm', result)
      this.close()
    },
    close() {
      this.$emit('update:visible', false)
    }
  }
}
</script>

<style lang="scss" scoped>
.cascade-mask {
  position: fixed;
  inset: 0;
  z-index: 999;
  background: rgba(0,0,0,0.5);
  display: flex;
  align-items: flex-end;
}
.cascade-panel {
  width: 100%;
  background: var(--color-bg-card, #1A1A2E);
  border-radius: 16px 16px 0 0;
  padding-bottom: env(safe-area-inset-bottom);
}
.cascade-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 44px;
  padding: 0 4vw;
  border-bottom: 1px solid rgba(255,255,255,0.08);
}
.cascade-cancel { color: var(--color-text-muted, rgba(255,255,255,0.6)); font-size: 2.6vh; }
.cascade-title { font-weight: 600; color: var(--color-text, #E8E8E8); font-size: 2.8vh; }
.cascade-confirm { color: var(--color-gold, #FFD700); font-weight: 600; font-size: 2.6vh; }
.cascade-picker { width: 100%; height: 36vh; }
.picker-item {
  height: 44px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-text, #E8E8E8);
  font-size: 2.6vh;
}
</style>
