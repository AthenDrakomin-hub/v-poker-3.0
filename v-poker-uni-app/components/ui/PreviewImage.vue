<template>
  <image
    :src="src"
    :mode="mode"
    class="preview-image"
    :class="{ round: round, bordered: bordered }"
    :style="imgStyle"
    @click="onPreview"
    @error="onError"
  />
</template>

<script>
export default {
  name: 'PreviewImage',
  props: {
    src: { type: String, required: true },
    urls: { type: Array, default: null },
    mode: { type: String, default: 'aspectFill' },
    round: { type: Boolean, default: false },
    bordered: { type: Boolean, default: false },
    width: { type: String, default: '' },
    height: { type: String, default: '' }
  },
  computed: {
    imgStyle() {
      const s = {}
      if (this.width) s.width = this.width
      if (this.height) s.height = this.height
      return s
    }
  },
  methods: {
    onPreview() {
      const urls = this.urls || [this.src]
      uni.vibrateShort && uni.vibrateShort({ type: 'light' })
      uni.previewImage({
        current: this.src,
        urls,
        fail: () => {
          uni.showToast({ title: '图片加载失败', icon: 'none' })
        }
      })
    },
    onError() {
      console.warn('[PreviewImage] 加载失败:', this.src)
    }
  }
}
</script>

<style lang="scss" scoped>
.preview-image {
  display: block;
}
.preview-image.round {
  border-radius: 50%;
}
.preview-image.bordered {
  border: 2px solid rgba(255,215,0,0.3);
}
</style>
