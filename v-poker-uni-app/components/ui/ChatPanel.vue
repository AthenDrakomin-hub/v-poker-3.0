<template>
  <view class="chat-panel" :class="{ 'chat-panel-fullscreen': fullscreen }">
    <!-- 聊天头部 -->
    <view class="chat-header">
      <view class="chat-header-left">
        <view class="chat-avatar" :style="peerAvatarStyle">
          <PreviewImage v-if="peerAvatarUrl" class="chat-avatar-img" :src="peerAvatarUrl" :urls="[peerAvatarUrl]" mode="aspectFill" />
          <text v-else class="chat-avatar-text">{{ peerInitial }}</text>
        </view>
        <view class="chat-header-info">
          <text class="chat-peer-name">{{ peerName }}</text>
          <text class="chat-peer-role">{{ peerRoleText }}</text>
        </view>
      </view>
      <view class="chat-header-right">
        <view v-if="isCs" class="chat-transfer-btn touch-active" @click="showTransferModal = true">
          <text>转接</text>
        </view>
        <view v-if="!fullscreen" class="chat-close" @click="$emit('close')">
          <text>✕</text>
        </view>
      </view>
    </view>

    <!-- 转接弹窗 -->
    <view v-if="showTransferModal" class="transfer-overlay" @click="showTransferModal = false">
      <view class="transfer-modal glass" @click.stop>
        <view class="transfer-header">
          <text class="transfer-title">转接会话</text>
          <view class="transfer-close" @click="showTransferModal = false">✕</view>
        </view>
        <view class="transfer-body">
          <text class="transfer-hint">目标客服 ID：</text>
          <input class="transfer-reason" type="number" v-model="transferTargetId" placeholder="请输入目标客服 ID" />
          <input class="transfer-reason" v-model="transferReason" placeholder="转接原因（可选）" maxlength="50" />
        </view>
        <view class="transfer-footer">
          <view class="transfer-btn cancel touch-active" @click="showTransferModal = false">取消</view>
          <view class="transfer-btn confirm touch-active" :class="{ disabled: !transferTargetId || isTransferring }" @click="confirmTransfer">
            <text>{{ isTransferring ? '转接中...' : '确认转接' }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 消息列表 -->
    <scroll-view
      class="chat-messages"
      scroll-y
      :scroll-into-view="scrollToId"
      :scroll-with-animation="true"
      @scrolltolower="onScrollToLower"
      refresher-enabled
      :refresher-triggered="isLoadingMore"
      refresher-text="加载更早消息"
      @refresherrefresh="loadMoreMessages"
    >
      <!-- 加载更早提示 -->
      <view v-if="hasMore && !isLoadingMore" class="load-more-hint" @click="loadMoreMessages">
        <text>↓ 下拉加载更早消息</text>
      </view>
      <view v-if="isLoadingMore" class="load-more-hint">
        <text>加载中...</text>
      </view>
      <view v-if="!hasMore && messages.length > 0" class="load-more-hint">
        <text>—— 没有更早的消息了 ——</text>
      </view>

      <view v-if="loading && messages.length === 0" class="chat-loading">
        <text>加载中...</text>
      </view>
      <view v-else-if="loadError && messages.length === 0" class="chat-error">
        <text class="error-text">{{ loadError }}</text>
        <view class="retry-btn touch-active" @click="loadMessages">点击重试</view>
      </view>
      <view v-else-if="messages.length === 0" class="chat-empty">
        <text>暂无消息</text>
        <text class="empty-sub">发送一条消息开始对话</text>
      </view>

      <view
        v-for="(msg, idx) in messages"
        :key="msg.id || ('local-' + idx)"
        :id="'msg-' + idx"
        class="chat-msg-row"
        :class="{ 'msg-self': msg.senderId === myId, 'msg-other': msg.senderId !== myId, 'msg-sending': msg._sending, 'msg-failed': msg._failed }"
      >
        <!-- 日期分隔线 -->
        <view v-if="shouldShowDateDivider(idx)" class="date-divider">
          <text>{{ formatDate(msg.createdAt) }}</text>
        </view>

        <view class="chat-bubble" :class="getBubbleClass(msg)">
          <!-- 筹码申请卡片 -->
          <view v-if="msg.type === 'chip_request' && msg.relatedData" class="chip-request-card">
            <text class="chip-request-title">💰 筹码申请</text>
            <text class="chip-request-amount">
              {{ msg.relatedData.amount > 0 ? '申请上分' : '申请下分' }}
              {{ formatPoints(Math.abs(msg.relatedData.amount || 0)) }}
            </text>
            <text v-if="msg.relatedData.note" class="chip-request-note">备注：{{ msg.relatedData.note }}</text>
            <view class="chip-request-footer">
              <text class="chip-request-status" :class="msg.status">{{ statusText(msg.status) }}</text>
              <!-- 客服端：处理按钮 -->
              <view v-if="canProcessChipRequest && msg.status === 'unread' && msg.senderId !== myId" class="chip-actions">
                <view class="chip-action-btn processed touch-active" @click="processChipRequest(msg)">已处理</view>
              </view>
            </view>
          </view>
          <!-- 系统消息 -->
          <view v-else-if="msg.type === 'system'" class="system-msg">
            <text>{{ msg.content }}</text>
          </view>
          <!-- 普通文字 -->
          <text v-else class="chat-msg-text">{{ msg.content }}</text>

          <!-- 消息底部：时间 + 状态 -->
          <view class="chat-msg-footer">
            <text class="chat-msg-time">{{ formatTime(msg.createdAt) }}</text>
            <text v-if="msg._sending" class="msg-status sending">发送中</text>
            <text v-else-if="msg._failed" class="msg-status failed" @click="resendMessage(msg)">发送失败·点击重试</text>
          </view>
        </view>
      </view>
    </scroll-view>

    <!-- 快捷操作（代理端） -->
    <view v-if="showQuickActions && !isCs" class="chat-quick-actions">
      <view class="quick-action-btn touch-active" :class="{ active: showChipRequest }" @click="showChipRequest = !showChipRequest">
        <text>💰 申请筹码</text>
      </view>
    </view>

    <!-- 筹码申请面板 -->
    <view v-if="showChipRequest" class="chip-request-panel">
      <view class="chip-request-inputs">
        <view class="chip-input-row">
          <view class="chip-type-tabs">
            <view class="chip-type-tab" :class="{ active: chipAmount >= 0 }" @click="chipAmount = Math.abs(chipAmount) || 100">上分</view>
            <view class="chip-type-tab" :class="{ active: chipAmount < 0 }" @click="chipAmount = -(Math.abs(chipAmount) || 100)">下分</view>
          </view>
          <input class="chip-input" type="number" v-model="chipAmount" placeholder="金额" />
        </view>
        <input class="chip-input" v-model="chipNote" placeholder="备注（可选，最多50字）" maxlength="50" />
        <view class="chip-note-count">{{ chipNote.length }}/50</view>
      </view>
      <view class="chip-request-btns">
        <view class="chip-btn chip-cancel touch-active" @click="showChipRequest = false">取消</view>
        <view class="chip-btn chip-send touch-active" :class="{ disabled: !canSendChipRequest }" @click="sendChipRequest">发送申请</view>
      </view>
    </view>

    <!-- 输入区域 -->
    <view class="chat-input-area" :class="{ 'keyboard-up': keyboardHeight > 0 }">
      <input
        class="chat-input"
        v-model="inputText"
        placeholder="输入消息..."
        :maxlength="500"
        :disabled="isSending"
        @confirm="sendText"
        @focus="onInputFocus"
        @blur="onInputBlur"
      />
      <view class="input-counter">{{ inputText.length }}/500</view>
      <view
        class="chat-send-btn touch-active"
        :class="{ active: canSend, disabled: !canSend || isSending }"
        @click="sendText"
      >
        <text>{{ isSending ? '...' : '发送' }}</text>
      </view>
    </view>
  </view>
</template>

<script>
import { getMessages, sendMessage, markMessagesRead, processChipRequest as apiProcessChipRequest, transferSession } from '../../api/messages.js'
import { userState } from '../../store/user.js'

export default {
  name: 'ChatPanel',
  props: {
    peerId: { type: Number, required: true },
    peerName: { type: String, default: '客服' },
    peerRole: { type: String, default: 'customer_service' },
    fullscreen: { type: Boolean, default: false },
    showQuickActions: { type: Boolean, default: true },
    isCs: { type: Boolean, default: false },
    canProcessChipRequest: { type: Boolean, default: false },
  },
  data() {
    return {
      myId: userState.id,
      messages: [],
      inputText: '',
      loading: false,
      loadError: '',
      isLoadingMore: false,
      hasMore: false,
      oldestId: null,
      scrollToId: '',
      showChipRequest: false,
      chipAmount: 100,
      chipNote: '',
      isSending: false,
      pollTimer: null,
      pollRetryCount: 0,
      keyboardHeight: 0,
      lastReadMsgId: 0,
      // 转接会话
      showTransferModal: false,
      transferTargetId: null,
      transferReason: '',
      isTransferring: false,
    }
  },
  computed: {
    canSend() {
      return this.inputText.trim().length > 0 && !this.isSending
    },
    canSendChipRequest() {
      const amt = Number(this.chipAmount)
      return amt !== 0 && !this.isSending
    },
    peerInitial() {
      return (this.peerName || '?').charAt(0).toUpperCase()
    },
    peerColor() {
      const colors = ['var(--color-danger)', 'var(--color-info)', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F']
      let hash = 0
      for (let i = 0; i < (this.peerName || '').length; i++) {
        hash = this.peerName.charCodeAt(i) + ((hash << 5) - hash)
      }
      return colors[Math.abs(hash) % colors.length]
    },
    peerRoleText() {
      const map = { customer_service: '客服', agent: '代理', top_agent: '总代理', admin: '管理员', player: '玩家' }
      return map[this.peerRole] || this.peerRole
    },
    peerAvatarUrl() {
      // 客服角色使用统一客服头像
      if (this.peerRole === 'customer_service') {
        return 'https://static.yefeng.us.cc/static/images/cs-avatar.png'
      }
      return ''
    },
    peerAvatarStyle() {
      if (this.peerAvatarUrl) {
        return { background: 'transparent', overflow: 'hidden' }
      }
      return { background: this.peerColor }
    },
  },
  watch: {
    peerId(newId) {
      if (newId) {
        this.messages = []
        this.hasMore = false
        this.oldestId = null
        this.loadMessages()
      }
    },
    showTransferModal(val) {
      if (val) {
        this.transferTargetId = null
        this.transferReason = ''
      }
    },
  },
  mounted() {
    this.loadMessages()
    this.startPolling()
  },
  beforeUnmount() {
    this.stopPolling()
  },
  methods: {
    formatPoints(p) {
      if (p >= 10000) return (p / 10000).toFixed(1) + '万'
      return String(p)
    },
    async loadMessages() {
      this.loading = true
      this.loadError = ''
      try {
        const res = await getMessages(this.peerId)
        this.messages = res.messages || res.data?.messages || res.data || res || []
        this.hasMore = res.hasMore || false
        this.oldestId = res.oldestId || null
        this.scrollToBottom()
        this.markAsRead()
      } catch (e) {
        console.error('[Chat] 加载消息失败', e)
        this.loadError = e?.error || e?.message || '加载失败，请检查网络'
      } finally {
        this.loading = false
      }
    },
    async loadMoreMessages() {
      if (this.isLoadingMore || !this.hasMore || !this.oldestId) return
      this.isLoadingMore = true
      try {
        const res = await getMessages(this.peerId, this.oldestId)
        const older = res.messages || []
        if (older.length > 0) {
          this.messages = [...older, ...this.messages]
          this.oldestId = res.oldestId || older[0].id
        }
        this.hasMore = res.hasMore || false
      } catch (e) {
        console.error('[Chat] 加载更多失败', e)
      } finally {
        this.isLoadingMore = false
      }
    },
    onScrollToLower() {
      // 滚动到底部时不做特殊处理
    },
    startPolling() {
      this.pollRetryCount = 0
      this.pollTimer = setInterval(() => {
        this.pollNewMessages()
      }, 5000)
    },
    stopPolling() {
      if (this.pollTimer) {
        clearInterval(this.pollTimer)
        this.pollTimer = null
      }
    },
    async pollNewMessages() {
      try {
        const res = await getMessages(this.peerId)
        const newMsgs = res.messages || []
        // 只在有新消息时更新
        if (newMsgs.length > this.messages.length) {
          const lastLocalId = this.messages.length > 0 ? this.messages[this.messages.length - 1].id : 0
          const fresh = newMsgs.filter(m => m.id > lastLocalId)
          if (fresh.length > 0) {
            this.messages = [...this.messages, ...fresh]
            this.hasMore = res.hasMore || false
            this.scrollToBottom()
            // 新消息提示音
            if (fresh.some(m => m.senderId !== this.myId)) {
              this.$emit('new-message')
            }
          }
        }
        this.markAsRead()
        this.pollRetryCount = 0
      } catch (e) {
        // 网络错误：指数退避，最多重试到30秒
        this.pollRetryCount++
        if (this.pollRetryCount > 3) {
          console.warn('[Chat] 轮询连续失败，已暂停')
        }
      }
    },
    async markAsRead() {
      const unreadReceived = this.messages.filter(m => m.receiverId === this.myId && m.status === 'unread' && m.id > this.lastReadMsgId)
      if (unreadReceived.length > 0) {
        this.lastReadMsgId = unreadReceived[unreadReceived.length - 1].id
        try {
          await markMessagesRead(this.peerId)
          // 本地标记为已读
          this.messages.forEach(m => {
            if (m.receiverId === this.myId && m.status === 'unread') m.status = 'read'
          })
          this.$emit('messages-read')
        } catch (e) {
          // 静默失败，下次轮询会重试
        }
      }
    },
    async sendText() {
      const text = this.inputText.trim()
      if (!text || this.isSending) return
      this.isSending = true
      // 本地先添加消息（乐观更新）
      const localMsg = {
        id: 'local-' + Date.now(),
        senderId: this.myId,
        senderRole: userState.role,
        receiverId: this.peerId,
        receiverRole: this.peerRole,
        content: text,
        type: 'text',
        status: 'read',
        createdAt: new Date().toISOString(),
        _sending: true,
        _failed: false,
      }
      this.messages.push(localMsg)
      this.inputText = ''
      this.scrollToBottom()

      try {
        const res = await sendMessage(this.peerId, text, 'text')
        // 替换本地消息为服务器返回的真实消息
        const idx = this.messages.findIndex(m => m.id === localMsg.id)
        if (idx >= 0 && res.message) {
          this.messages.splice(idx, 1, { ...res.message, _sending: false })
        }
      } catch (e) {
        // 发送失败，标记为失败状态
        const idx = this.messages.findIndex(m => m.id === localMsg.id)
        if (idx >= 0) {
          this.messages[idx]._sending = false
          this.messages[idx]._failed = true
          this.messages[idx]._error = e?.error || e?.message || '发送失败'
        }
        uni.showToast({ title: e?.error || '发送失败', icon: 'none' })
      } finally {
        this.isSending = false
      }
    },
    async resendMessage(msg) {
      if (this.isSending) return
      this.isSending = true
      msg._sending = true
      msg._failed = false
      try {
        const res = await sendMessage(this.peerId, msg.content, msg.type || 'text', msg.relatedData || null)
        const idx = this.messages.findIndex(m => m.id === msg.id)
        if (idx >= 0 && res.message) {
          this.messages.splice(idx, 1, { ...res.message, _sending: false })
        }
        uni.showToast({ title: '重发成功', icon: 'success' })
      } catch (e) {
        msg._sending = false
        msg._failed = true
        uni.showToast({ title: e?.error || '重发失败', icon: 'none' })
      } finally {
        this.isSending = false
      }
    },
    async sendChipRequest() {
      const amount = Number(this.chipAmount)
      if (!amount || amount === 0 || this.isSending) {
        uni.showToast({ title: '请输入有效金额', icon: 'none' })
        return
      }
      if (Math.abs(amount) > 1000000) {
        uni.showToast({ title: '单次不能超过100万', icon: 'none' })
        return
      }
      this.isSending = true
      const content = `${amount > 0 ? '申请上分' : '申请下分'} ${this.formatPoints(Math.abs(amount))} 筹码${this.chipNote ? '，备注：' + this.chipNote : ''}`

      try {
        await sendMessage(this.peerId, content, 'chip_request', {
          amount,
          action: amount > 0 ? 'add' : 'subtract',
          note: this.chipNote,
        })
        this.chipAmount = 100
        this.chipNote = ''
        this.showChipRequest = false
        await this.loadMessages()
        uni.showToast({ title: '申请已发送', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: e?.error || '发送失败', icon: 'none' })
      } finally {
        this.isSending = false
      }
    },
    async processChipRequest(msg) {
      // 客服标记筹码申请为已处理
      try {
        await apiProcessChipRequest(msg.id)
        msg.status = 'processed'
        uni.showToast({ title: '已标记为处理', icon: 'success' })
      } catch (e) {
        uni.showToast({ title: e?.error || '处理失败', icon: 'none' })
      }
    },
    scrollToBottom() {
      this.$nextTick(() => {
        if (this.messages.length > 0) {
          this.scrollToId = 'msg-' + (this.messages.length - 1)
        }
      })
    },
    onInputFocus() {
      // 键盘弹起时滚动到底部
      setTimeout(() => this.scrollToBottom(), 300)
    },
    onInputBlur() {
      this.keyboardHeight = 0
    },
    shouldShowDateDivider(idx) {
      if (idx === 0) return true
      const prev = this.messages[idx - 1]
      const curr = this.messages[idx]
      if (!prev?.createdAt || !curr?.createdAt) return false
      return this.formatDate(prev.createdAt) !== this.formatDate(curr.createdAt)
    },
    formatDate(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      const now = new Date()
      const today = `${now.getFullYear()}-${now.getMonth() + 1}-${now.getDate()}`
      const that = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
      if (today === that) return '今天'
      const yesterday = new Date(now)
      yesterday.setDate(yesterday.getDate() - 1)
      const yest = `${yesterday.getFullYear()}-${yesterday.getMonth() + 1}-${yesterday.getDate()}`
      if (that === yest) return '昨天'
      return `${d.getMonth() + 1}月${d.getDate()}日`
    },
    formatTime(ts) {
      if (!ts) return ''
      const d = new Date(ts)
      const h = String(d.getHours()).padStart(2, '0')
      const m = String(d.getMinutes()).padStart(2, '0')
      return `${h}:${m}`
    },
    statusText(status) {
      const map = { unread: '待处理', read: '已读', processed: '已处理' }
      return map[status] || status
    },
    getBubbleClass(msg) {
      const classes = []
      if (msg.type === 'chip_request') classes.push('bubble-request')
      else if (msg.type === 'chip_response') classes.push('bubble-response')
      else if (msg.type === 'system') classes.push('bubble-system')
      if (msg._failed) classes.push('bubble-failed')
      return classes.join(' ')
    },
    // ========== 转接会话 ==========
    async confirmTransfer() {
      if (!this.transferTargetId || this.isTransferring) return
      const targetCsId = Number(this.transferTargetId)
      if (!Number.isSafeInteger(targetCsId) || targetCsId <= 0) {
        uni.showToast({ title: '请输入有效客服 ID', icon: 'none' })
        return
      }
      this.isTransferring = true
      try {
        await transferSession(this.peerId, targetCsId, this.transferReason)
        uni.showToast({ title: '转接成功', icon: 'success' })
        this.showTransferModal = false
        this.transferTargetId = null
        this.transferReason = ''
        // 关闭聊天窗口
        this.$emit('close')
      } catch (e) {
        uni.showToast({ title: e?.error || '转接失败', icon: 'none' })
      } finally {
        this.isTransferring = false
      }
    },
  },
}
</script>

<style lang="scss" scoped>
.chat-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: rgba(20, 20, 20, 0.95);
}

.chat-panel-fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 200;
}

.chat-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2vh 3vh;
  background: rgba(0, 0, 0, 0.3);
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
}

.chat-header-left {
  display: flex;
  align-items: center;
  gap: 2vh;
}

.chat-avatar {
  width: 6vh;
  height: 6vh;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  overflow: hidden;
}

.chat-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.chat-avatar-text {
  font-size: var(--text-xl);
  color: #fff;
  font-weight: 600;
}

.chat-header-info {
  display: flex;
  flex-direction: column;
}

.chat-peer-name {
  font-size: var(--text-lg);
  color: var(--color-text);
  font-weight: 600;
}

.chat-peer-role {
  font-size: var(--text-sm);
  color: rgba(255, 215, 0, 0.7);
}

.chat-header-right {
  display: flex;
  align-items: center;
  gap: 1.5vh;
}

.chat-transfer-btn {
  padding: 0.8vh 2vh;
  background: rgba(255, 215, 0, 0.15);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 1.5vh;
  font-size: var(--text-sm);
  color: var(--color-gold);
}

.chat-close {
  width: 5vh;
  height: 5vh;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(255, 255, 255, 0.5);
  font-size: var(--text-lg);
}

/* 转接弹窗 */
.transfer-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.7);
  z-index: 300;
  display: flex;
  align-items: center;
  justify-content: center;
}

.transfer-modal {
  width: 55vh;
  max-height: 70vh;
  border-radius: 2vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid rgba(255, 215, 0, 0.2);
}

.transfer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 2vh 3vh;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.transfer-title {
  font-size: var(--text-lg);
  color: var(--color-text);
  font-weight: 600;
}

.transfer-close {
  font-size: var(--text-base);
  color: rgba(255, 255, 255, 0.5);
}

.transfer-body {
  flex: 1;
  padding: 2vh 3vh;
  overflow-y: auto;
}

.transfer-hint {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.5);
  display: block;
  margin-bottom: 1.5vh;
}

.transfer-list {
  max-height: 35vh;
  margin-bottom: 2vh;
}

.transfer-item {
  display: flex;
  align-items: center;
  gap: 1.5vh;
  padding: 1.5vh;
  border-radius: 1.5vh;
  margin-bottom: 1vh;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid transparent;
}

.transfer-item.active {
  background: rgba(255, 215, 0, 0.1);
  border-color: rgba(255, 215, 0, 0.3);
}

.transfer-avatar {
  width: 5vh;
  height: 5vh;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: var(--text-base);
  color: #fff;
  font-weight: 600;
  flex-shrink: 0;
  overflow: hidden;
}

.transfer-avatar-img {
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.transfer-info {
  flex: 1;
  min-width: 0;
}

.transfer-name {
  font-size: var(--text-base);
  color: var(--color-text);
  display: block;
}

.transfer-meta {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.4);
  display: block;
  margin-top: 0.3vh;
}

.transfer-check {
  color: var(--color-gold);
  font-size: var(--text-lg);
  font-weight: 600;
}

.transfer-empty {
  text-align: center;
  padding: 3vh 0;
  color: rgba(255, 255, 255, 0.3);
  font-size: var(--text-sm);
}

.transfer-reason {
  width: 100%;
  height: 5vh;
  padding: 0 2vh;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 1vh;
  color: #fff;
  font-size: var(--text-sm);
  box-sizing: border-box;
}

.transfer-footer {
  display: flex;
  gap: 1.5vh;
  padding: 2vh 3vh;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
}

.transfer-btn {
  flex: 1;
  height: 5.5vh;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 1.5vh;
  font-size: var(--text-base);
}

.transfer-btn.cancel {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

.transfer-btn.confirm {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg-card);
  font-weight: 600;
}

.transfer-btn.confirm.disabled {
  opacity: 0.5;
}

.chat-messages {
  flex: 1;
  padding: 2vh 3vh;
  overflow-y: auto;
}

.load-more-hint {
  text-align: center;
  padding: 1.5vh 0;
  color: rgba(255, 255, 255, 0.3);
  font-size: var(--text-sm);
}

.chat-loading, .chat-empty {
  text-align: center;
  padding: 4vh 0;
  color: rgba(255, 255, 255, 0.4);
  font-size: var(--text-sm);
}

.empty-sub {
  display: block;
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.25);
  margin-top: 1vh;
}

.chat-error {
  text-align: center;
  padding: 4vh 2vh;
}

.error-text {
  color: var(--color-danger);
  font-size: var(--text-sm);
  display: block;
}

.retry-btn {
  display: inline-block;
  margin-top: 2vh;
  padding: 1vh 3vh;
  background: rgba(255, 215, 0, 0.15);
  border: 1px solid rgba(255, 215, 0, 0.3);
  border-radius: 2vh;
  color: var(--color-gold);
  font-size: var(--text-sm);
}

.date-divider {
  text-align: center;
  margin: 2vh 0 1vh;
}

.date-divider text {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.3);
  background: rgba(0, 0, 0, 0.3);
  padding: 0.3vh 2vh;
  border-radius: 2vh;
}

.chat-msg-row {
  display: flex;
  margin-bottom: 1.5vh;
}

.msg-self {
  justify-content: flex-end;
}

.msg-other {
  justify-content: flex-start;
}

.chat-bubble {
  max-width: 70%;
  padding: 1.5vh 2vh;
  border-radius: 2vh;
  position: relative;
  min-width: 8vh;
}

.msg-self .chat-bubble {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg-card);
}

.msg-other .chat-bubble {
  background: rgba(255, 255, 255, 0.1);
  color: var(--color-text);
}

.msg-sending .chat-bubble {
  opacity: 0.6;
}

.msg-failed .chat-bubble {
  border: 1px solid var(--color-danger);
}

.chat-msg-text {
  font-size: var(--text-base);
  line-height: 1.4;
  word-break: break-all;
  white-space: pre-wrap;
}

.chat-msg-footer {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 1vh;
  margin-top: 0.5vh;
}

.chat-msg-time {
  font-size: var(--text-xs);
  opacity: 0.5;
}

.msg-status {
  font-size: var(--text-xs);
}

.msg-status.sending {
  color: rgba(255, 255, 255, 0.5);
}

.msg-status.failed {
  color: var(--color-danger);
  text-decoration: underline;
}

.system-msg {
  text-align: center;
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
}

.bubble-request {
  background: rgba(72, 187, 120, 0.15) !important;
  border: 1px solid rgba(72, 187, 120, 0.3);
}

.bubble-response {
  background: rgba(255, 215, 0, 0.15) !important;
  border: 1px solid rgba(255, 215, 0, 0.3);
}

.bubble-system {
  background: transparent !important;
  border: none;
  max-width: 90%;
}

.bubble-failed {
  border-color: var(--color-danger) !important;
}

.chip-request-card {
  display: flex;
  flex-direction: column;
  gap: 0.8vh;
}

.chip-request-title {
  font-size: var(--text-base);
  font-weight: 600;
  color: var(--color-success);
}

.chip-request-amount {
  font-size: var(--text-lg);
  font-weight: 700;
  color: var(--color-gold);
}

.chip-request-note {
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.7);
}

.chip-request-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 0.5vh;
}

.chip-request-status {
  font-size: var(--text-sm);
  padding: 0.3vh 1vh;
  border-radius: 1vh;
}

.chip-request-status.unread {
  background: rgba(255, 193, 7, 0.2);
  color: #FFC107;
}

.chip-request-status.processed {
  background: rgba(72, 187, 120, 0.2);
  color: var(--color-success);
}

.chip-actions {
  display: flex;
  gap: 1vh;
}

.chip-action-btn {
  padding: 0.5vh 1.5vh;
  border-radius: 1.5vh;
  font-size: var(--text-sm);
}

.chip-action-btn.processed {
  background: rgba(72, 187, 120, 0.2);
  color: var(--color-success);
  border: 1px solid rgba(72, 187, 120, 0.3);
}

.chat-quick-actions {
  display: flex;
  gap: 1.5vh;
  padding: 1vh 3vh;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.quick-action-btn {
  padding: 1vh 2vh;
  background: rgba(255, 255, 255, 0.08);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 2vh;
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.7);
}

.quick-action-btn.active {
  background: rgba(255, 215, 0, 0.15);
  border-color: rgba(255, 215, 0, 0.4);
  color: var(--color-gold);
}

.chip-request-panel {
  padding: 2vh 3vh;
  background: rgba(0, 0, 0, 0.2);
  border-top: 1px solid rgba(255, 255, 255, 0.05);
  flex-shrink: 0;
}

.chip-request-inputs {
  display: flex;
  flex-direction: column;
  gap: 1vh;
  margin-bottom: 1.5vh;
}

.chip-input-row {
  display: flex;
  align-items: center;
  gap: 1.5vh;
}

.chip-type-tabs {
  display: flex;
  gap: 0.5vh;
}

.chip-type-tab {
  padding: 0.8vh 2vh;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 1.5vh;
  font-size: var(--text-sm);
  color: rgba(255, 255, 255, 0.6);
}

.chip-type-tab.active {
  background: rgba(255, 215, 0, 0.2);
  color: var(--color-gold);
}

.chip-input {
  flex: 1;
  height: 5vh;
  padding: 0 2vh;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 1vh;
  color: #fff;
  font-size: var(--text-sm);
}

.chip-note-count {
  text-align: right;
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.3);
}

.chip-request-btns {
  display: flex;
  gap: 1.5vh;
}

.chip-btn {
  flex: 1;
  height: 5vh;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 1vh;
  font-size: var(--text-sm);
}

.chip-cancel {
  background: rgba(255, 255, 255, 0.1);
  color: rgba(255, 255, 255, 0.6);
}

.chip-send {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg-card);
  font-weight: 600;
}

.chip-send.disabled {
  opacity: 0.5;
}

.chat-input-area {
  display: flex;
  align-items: center;
  gap: 1.5vh;
  padding: 2vh 3vh;
  background: rgba(0, 0, 0, 0.3);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  flex-shrink: 0;
  padding-bottom: calc(2vh + var(--safe-bottom, 0));
}

.chat-input {
  flex: 1;
  height: 5.5vh;
  padding: 0 2vh;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 3vh;
  color: #fff;
  font-size: var(--text-base);
}

.input-counter {
  font-size: var(--text-xs);
  color: rgba(255, 255, 255, 0.3);
  min-width: 6vh;
  text-align: right;
}

.chat-send-btn {
  padding: 0 3vh;
  height: 5.5vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 3vh;
  color: rgba(255, 255, 255, 0.5);
  font-size: var(--text-base);
  flex-shrink: 0;
}

.chat-send-btn.active {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
  color: var(--color-bg-card);
  font-weight: 600;
}

.chat-send-btn.disabled {
  opacity: 0.5;
}
</style>
