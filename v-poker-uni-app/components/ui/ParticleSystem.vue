<template>
  <canvas
    v-if="enabled"
    class="particle-canvas"
    :id="canvasId"
    :style="canvasStyle"
    canvas-id="particleCanvas"
  ></canvas>
</template>

<script>
// 双端兼容：App端service层无requestAnimationFrame，用setTimeout降级
const __raf = typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame : (fn) => setTimeout(fn, 16)
const __caf = typeof cancelAnimationFrame !== 'undefined' ? cancelAnimationFrame : (id) => clearTimeout(id)

export default {
  name: 'ParticleSystem',
  props: {
    // 主题配置中的粒子设置
    config: {
      type: Object,
      default: () => ({
        type: 'incense',
        count: 15,
        color: 'var(--color-gold-dark)',
        size: { min: 2, max: 5 },
        speed: { min: 0.3, max: 0.8 },
        direction: 'up',
        opacity: { min: 0.3, max: 0.7 },
      })
    },
    // 是否启用
    enabled: {
      type: Boolean,
      default: true
    },
    // 画布宽度
    width: {
      type: [Number, String],
      default: '100%'
    },
    // 画布高度
    height: {
      type: [Number, String],
      default: '100%'
    },
    // 帧率限制
    fps: {
      type: Number,
      default: 30
    }
  },
  data() {
    return {
      canvasId: 'particle-' + Date.now(),
      ctx: null,
      particles: [],
      animationId: null,
      lastTime: 0,
      frameInterval: 1000 / 30,
      canvasWidth: 0,
      canvasHeight: 0,
    }
  },
  computed: {
    canvasStyle() {
      return {
        width: typeof this.width === 'number' ? this.width + 'px' : this.width,
        height: typeof this.height === 'number' ? this.height + 'px' : this.height,
      }
    }
  },
  watch: {
    enabled(newVal) {
      if (newVal) {
        this.start()
      } else {
        this.stop()
      }
    },
    config: {
      handler() {
        this.initParticles()
      },
      deep: true
    }
  },
  mounted() {
    this.frameInterval = 1000 / this.fps
    this.$nextTick(() => {
      this.initCanvas()
    })
  },
  beforeUnmount() {
    this.stop()
  },
  methods: {
    // 初始化Canvas
    initCanvas() {
      try {
        const query = uni.createSelectorQuery().in(this)
        query.select('#' + this.canvasId)
          .fields({ node: true, size: true })
          .exec((res) => {
            if (res && res[0] && res[0].node) {
              const canvas = res[0].node
              this.ctx = canvas.getContext('2d')
              this.canvasWidth = res[0].width
              this.canvasHeight = res[0].height
              canvas.width = this.canvasWidth
              canvas.height = this.canvasHeight
              this.initParticles()
              this.start()
            }
          })
      } catch (e) {
        console.error('[Particle] Canvas初始化失败', e)
      }
    },

    // 初始化粒子
    initParticles() {
      this.particles = []
      const count = this.config.count || 15
      for (let i = 0; i < count; i++) {
        this.particles.push(this.createParticle(true))
      }
    },

    // 创建单个粒子
    createParticle(randomY = false) {
      const cfg = this.config
      const size = this.randomRange(cfg.size.min, cfg.size.max)
      const speed = this.randomRange(cfg.speed.min, cfg.speed.max)
      const opacity = this.randomRange(cfg.opacity.min, cfg.opacity.max)

      let x, y, vx, vy

      switch (cfg.type) {
        case 'incense': // 焚香：从底部上升
          x = this.canvasWidth * (0.3 + Math.random() * 0.4)
          y = randomY ? Math.random() * this.canvasHeight : this.canvasHeight + size
          vx = (Math.random() - 0.5) * 0.3
          vy = -speed
          break

        case 'falling_leaves': // 落叶：从顶部下落，带摇摆
          x = Math.random() * this.canvasWidth
          y = randomY ? Math.random() * this.canvasHeight : -size
          vx = (Math.random() - 0.5) * 0.5
          vy = speed
          break

        case 'steam': // 蒸汽：从底部上升，扩散
          x = this.canvasWidth * (0.2 + Math.random() * 0.6)
          y = randomY ? Math.random() * this.canvasHeight : this.canvasHeight + size
          vx = (Math.random() - 0.5) * 0.2
          vy = -speed * 0.5
          break

        case 'smoke': // 烟雾：随机方向，缓慢扩散
          x = Math.random() * this.canvasWidth
          y = Math.random() * this.canvasHeight
          vx = (Math.random() - 0.5) * 0.2
          vy = (Math.random() - 0.5) * 0.2
          break

        case 'data_rain': // 数据雨：从顶部下落
          x = Math.random() * this.canvasWidth
          y = randomY ? Math.random() * this.canvasHeight : -size
          vx = 0
          vy = speed * 2
          break

        default:
          x = Math.random() * this.canvasWidth
          y = Math.random() * this.canvasHeight
          vx = (Math.random() - 0.5) * speed
          vy = -speed
      }

      return {
        x, y, vx, vy,
        size,
        opacity,
        baseOpacity: opacity,
        color: cfg.color,
        type: cfg.type,
        sway: cfg.sway || false,
        swayOffset: Math.random() * Math.PI * 2,
        swaySpeed: 0.02 + Math.random() * 0.02,
        expand: cfg.expand || false,
        expandRate: 0.02 + Math.random() * 0.02,
        character: this.getRandomCharacter(),
        life: 1,
        decay: 0.002 + Math.random() * 0.003,
      }
    },

    // 获取随机字符（数据雨）
    getRandomCharacter() {
      const chars = this.config.characters || '01'
      return chars.charAt(Math.floor(Math.random() * chars.length))
    },

    // 随机范围
    randomRange(min, max) {
      return min + Math.random() * (max - min)
    },

    // 更新粒子
    updateParticle(p) {
      // 摇摆效果
      if (p.sway) {
        p.swayOffset += p.swaySpeed
        p.vx = Math.sin(p.swayOffset) * 0.8
      }

      // 位置更新
      p.x += p.vx
      p.y += p.vy

      // 扩散效果
      if (p.expand) {
        p.size += p.expandRate
        p.opacity = p.baseOpacity * (1 - p.size / 100)
      }

      // 生命周期
      p.life -= p.decay

      // 边界检测和重置
      if (p.type === 'incense' || p.type === 'steam') {
        if (p.y < -p.size * 2 || p.life <= 0) {
          Object.assign(p, this.createParticle(false))
        }
      } else if (p.type === 'falling_leaves' || p.type === 'data_rain') {
        if (p.y > this.canvasHeight + p.size * 2 || p.life <= 0) {
          Object.assign(p, this.createParticle(false))
        }
      } else if (p.type === 'smoke') {
        if (p.life <= 0 || p.x < -50 || p.x > this.canvasWidth + 50 ||
            p.y < -50 || p.y > this.canvasHeight + 50) {
          Object.assign(p, this.createParticle(false))
        }
      }
    },

    // 绘制粒子
    drawParticle(p) {
      if (!this.ctx) return
      const ctx = this.ctx

      ctx.save()
      ctx.globalAlpha = Math.max(0, p.opacity * p.life)

      switch (p.type) {
        case 'incense':
        case 'steam':
        case 'smoke':
          // 圆形粒子，带渐变
          const gradient = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size)
          gradient.addColorStop(0, p.color)
          gradient.addColorStop(1, 'transparent')
          ctx.fillStyle = gradient
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
          break

        case 'falling_leaves':
          // 叶子形状（椭圆）
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.ellipse(p.x, p.y, p.size * 0.6, p.size, p.swayOffset, 0, Math.PI * 2)
          ctx.fill()
          break

        case 'data_rain':
          // 字符
          ctx.fillStyle = p.color
          ctx.font = `${p.size * 4}px monospace`
          ctx.fillText(p.character, p.x, p.y)
          break

        default:
          ctx.fillStyle = p.color
          ctx.beginPath()
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2)
          ctx.fill()
      }

      ctx.restore()
    },

    // 动画循环
    animate(currentTime) {
      if (!this.enabled) return

      if (!this.lastTime) this.lastTime = currentTime
      const delta = currentTime - this.lastTime

      if (delta >= this.frameInterval) {
        this.lastTime = currentTime - (delta % this.frameInterval)

        // 清空画布
        if (this.ctx) {
          this.ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight)

          // 更新和绘制所有粒子
          this.particles.forEach(p => {
            this.updateParticle(p)
            this.drawParticle(p)
          })
        }
      }

      this.animationId = __raf(this.animate)
    },

    // 开始动画
    start() {
      if (this.animationId || !this.ctx) return
      this.animationId = __raf(this.animate)
    },

    // 停止动画
    stop() {
      if (this.animationId) {
        __caf(this.animationId)
        this.animationId = null
      }
      this.lastTime = 0
    },

    // 爆发粒子（开牌时调用）
    burst(x, y, count = 20, color = null) {
      for (let i = 0; i < count; i++) {
        const angle = (Math.PI * 2 * i) / count
        const speed = 2 + Math.random() * 4
        const p = {
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          size: 3 + Math.random() * 5,
          opacity: 1,
          baseOpacity: 1,
          color: color || this.config.color,
          type: 'burst',
          life: 1,
          decay: 0.02 + Math.random() * 0.02,
        }
        this.particles.push(p)
      }
      // 限制最大粒子数
      if (this.particles.length > 100) {
        this.particles = this.particles.slice(-100)
      }
    },
  }
}
</script>

<style lang="scss" scoped>
.particle-canvas {
  position: absolute;
  top: 0;
  left: 0;
  pointer-events: none;
  z-index: 1;
}
</style>
