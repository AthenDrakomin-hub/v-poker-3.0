<template>
  <VuIcon :name="iconName" :size="iconSize" :color="color || 'currentColor'" />
</template>

<script>
import VuIcon from 'vu-icons/uniapp/icon'

export default {
  name: 'VIcon',
  components: { VuIcon },
  props: {
    name: {
      type: String,
      required: true
    },
    size: {
      type: [Number, String],
      default: 2.5
    },
    color: {
      type: String,
      default: ''
    }
  },
  computed: {
    iconName() {
      const aliases = {
        back: 'arrow-left',
        gear: 'settings',
        cards: 'layers-3',
        coin: 'circle-dollar-sign',
        more: 'ellipsis',
        warning: 'triangle-alert',
        headset: 'headset',
        help: 'circle-question-mark',
        chat: 'message-circle',
        refresh: 'refresh-cw',
        bull: 'circle',
        fan: 'wind',
      }
      return aliases[this.name] || this.name
    },
    iconSize() {
      const raw = String(this.size)
      const value = parseFloat(raw)
      if (!Number.isFinite(value)) return 24
      try {
        const systemInfo = uni.getSystemInfoSync()
        if (raw.endsWith('px')) return Math.round(value)
        if (raw.endsWith('rpx')) return Math.round(systemInfo.windowWidth * value / 750)
        return Math.round(systemInfo.windowHeight * value / 100)
      } catch (e) {
        return Math.round(value * 8)
      }
    }
  }
}
</script>
