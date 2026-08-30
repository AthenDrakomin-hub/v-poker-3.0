/**
 * 无限滚动列表 Mixin
 * 替代 Web 端页码分页器，App 端拇指友好
 *
 * 使用方式：
 *   import infiniteList from '@/mixins/infiniteList.js'
 *   export default {
 *     mixins: [infiniteList],
 *     methods: {
 *       async fetchList(page) {
 *         const res = await getList({ page, pageSize: this.pageSize })
 *         return { data: res.list, total: res.total }
 *       }
 *     }
 *   }
 *
 * 模板中：
 *   <scroll-view scroll-y @scrolltolower="onLoadMore" refresher-enabled :refresher-triggered="refreshing" @refresherrefresh="onRefresh">
 *     <view v-for="item in list" :key="item.id">...</view>
 *     <ListFooter :loading="loadingMore" :no-more="noMore" :has-data="list.length > 0" />
 *   </scroll-view>
 */
export default {
  data() {
    return {
      list: [],
      page: 1,
      pageSize: 20,
      loadingMore: false,
      noMore: false,
      refreshing: false,
      listError: false
    }
  },
  methods: {
    /**
     * 拉取列表数据（由具体页面实现）
     * @param {number} page - 页码
     * @returns {Promise<{data: Array, total: number}>}
     */
    async fetchList() {
      return { data: [], total: 0 }
    },

    /**
     * 加载更多（scroll-view @scrolltolower 触发）
     */
    async onLoadMore() {
      if (this.loadingMore || this.noMore || this.refreshing) return
      this.loadingMore = true
      this.listError = false
      try {
        const nextPage = this.page + 1
        const res = await this.fetchList(nextPage)
        const items = res.data || res.list || []
        if (items.length > 0) {
          this.list = [...this.list, ...items]
          this.page = nextPage
        }
        const total = res.total || 0
        if (items.length < this.pageSize || this.list.length >= total) {
          this.noMore = true
        }
      } catch (e) {
        console.warn('[infiniteList] 加载更多失败:', e)
        this.listError = true
        uni.showToast({ title: '加载失败', icon: 'none' })
      } finally {
        this.loadingMore = false
      }
    },

    /**
     * 下拉刷新（scroll-view @refresherrefresh 或 onPullDownRefresh）
     */
    async onRefresh() {
      if (this.refreshing) return
      this.refreshing = true
      this.listError = false
      try {
        const res = await this.fetchList(1)
        this.list = res.data || res.list || []
        this.page = 1
        const total = res.total || 0
        this.noMore = this.list.length >= total || this.list.length < this.pageSize
      } catch (e) {
        console.warn('[infiniteList] 刷新失败:', e)
        this.listError = true
        uni.showToast({ title: '刷新失败', icon: 'none' })
      } finally {
        this.refreshing = false
        uni.stopPullDownRefresh && uni.stopPullDownRefresh()
      }
    },

    /**
     * 重置列表（切换筛选条件等场景调用）
     */
    resetList() {
      this.list = []
      this.page = 1
      this.noMore = false
      this.listError = false
    }
  }
}
