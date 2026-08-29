<template>
  <view v-if="totalPages > 1" class="pagination-bar">
    <view class="page-btn page-prev" :class="{ disabled: page <= 1 }" @click="changePage(page - 1)">
      <VIcon name="arrow-right" :size="2.4" color="var(--color-gold)" />
    </view>
    <text class="page-info">第 {{ page }} / {{ totalPages }} 页，共 {{ total }} 条</text>
    <view class="page-btn" :class="{ disabled: page >= totalPages }" @click="changePage(page + 1)">
      <VIcon name="arrow-right" :size="2.4" color="var(--color-gold)" />
    </view>
  </view>
</template>

<script>
import VIcon from './VIcon.vue'

export default {
  name: 'PaginationBar',
  components: { VIcon },
  props: {
    pagination: {
      type: Object,
      required: true
    }
  },
  computed: {
    page() {
      return Number(this.pagination.page) || 1
    },
    total() {
      return Number(this.pagination.total) || 0
    },
    totalPages() {
      return Number(this.pagination.totalPages) || 1
    }
  },
  methods: {
    changePage(nextPage) {
      if (nextPage < 1 || nextPage > this.totalPages || nextPage === this.page) return
      this.$emit('change', nextPage)
    }
  }
}
</script>

<style lang="scss" scoped>
.pagination-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1.5vh;
  padding-top: 1.5vh;
}

.page-btn {
  width: max(4vh, 36px);
  height: max(4vh, 36px);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-gold);
  background: rgba(255, 255, 255, 0.08);
  border-radius: 0.8vh;

  &:active {
    background: rgba(255, 215, 0, 0.16);
  }

  &.disabled {
    opacity: 0.35;
  }
}

.page-prev {
  transform: rotate(180deg);

  &:active {
    transform: rotate(180deg) scale(0.95);
  }
}

.page-info {
  color: rgba(255, 255, 255, 0.6);
  font-size: var(--text-xs);
}
</style>
