<template>
  <view class="chat-box" :class="{ 'chat-collapsed': collapsed }">
    <!-- 折叠/展开按钮 -->
    <view class="chat-toggle" @click="collapsed = !collapsed">
      <text class="toggle-icon">{{ collapsed ? '💬' : '✕' }}</text>
    </view>

    <!-- 聊天内容 -->
    <view v-show="!collapsed" class="chat-content">
      <!-- 消息列表 -->
      <scroll-view
        class="chat-messages"
        scroll-y
        :scroll-into-view="scrollToId"
        :scroll-with-animation="true"
      >
        <view
          v-for="(msg, index) in messages"
          :key="index"
          :id="'msg-' + index"
          class="chat-message"
          :class="{ 'msg-system': msg.type === 'system', 'msg-self': msg.isSelf, 'msg-voice': msg.type === 'voice' }"
        >
          <text v-if="msg.type === 'system'" class="msg-system-text">{{ msg.content }}</text>
          <template v-else>
            <text class="msg-sender">{{ msg.senderName }}:</text>
            <text class="msg-content">{{ msg.content }}</text>
            <text v-if="msg.type === 'voice'" class="msg-voice-icon">🔊</text>
          </template>
        </view>
      </scroll-view>

      <!-- 表情面板 -->
      <view v-if="showEmojiPanel" class="emoji-panel">
        <scroll-view class="emoji-scroll" scroll-x>
          <view class="emoji-list">
            <view
              v-for="(emoji, idx) in emojiList"
              :key="idx"
              class="emoji-item"
              @click="insertEmoji(emoji)"
            >
              <text class="emoji-text">{{ emoji }}</text>
            </view>
          </view>
        </scroll-view>
      </view>

      <!-- 快捷语音面板 -->
      <view v-if="showVoicePanel" class="voice-panel">
        <view class="voice-list">
          <view
            v-for="(item, idx) in quickVoiceList"
            :key="idx"
            class="voice-item"
            @click="sendQuickVoice(item)"
          >
            <text class="voice-icon">{{ item.icon }}</text>
            <text class="voice-text">{{ item.text }}</text>
          </view>
        </view>
      </view>

      <!-- 输入区域 -->
      <view class="chat-input-area">
        <view class="tool-btn" :class="{ active: showEmojiPanel }" @click="toggleEmojiPanel">
          <text class="tool-icon">😀</text>
        </view>
        <view class="tool-btn" :class="{ active: showVoicePanel }" @click="toggleVoicePanel">
          <text class="tool-icon">🎤</text>
        </view>
        <input
          class="chat-input"
          v-model="inputText"
          placeholder="说点什么..."
          placeholder-class="input-placeholder"
          :maxlength="50"
          @confirm="sendMessage"
          @focus="closePanels"
        />
        <view class="send-btn" :class="{ 'send-active': inputText }" @click="sendMessage">
          <text>发送</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script>
export default {
  name: 'ChatBox',
  props: {
    messages: {
      type: Array,
      default: () => []
    },
    defaultCollapsed: {
      type: Boolean,
      default: false
    }
  },
  emits: ['send', 'quick-voice'],
  data() {
    return {
      collapsed: this.defaultCollapsed,
      inputText: '',
      scrollToId: '',
      showEmojiPanel: false,
      showVoicePanel: false,
      emojiList: ['😀','😂','🤣','😎','🔥','💰','🎲','♠️','♥️','♦️','♣️','🤔','😱','🤯','👑','🎉','💪','🤝','🙏','😴','🤮','👍','👎','❤️','💔','🎯','🍀','⭐','💀','🤡'],
      quickVoiceList: [
        { key: 'hurry', icon: '⏰', text: '快点啊，等得花都谢了' },
        { key: 'wait', icon: '⌛', text: '等你好久了' },
        { key: 'luck', icon: '🍀', text: '运气不错啊' },
        { key: 'secure', icon: '💪', text: '这把稳了' },
        { key: 'bye', icon: '👋', text: '拜拜了您内' },
        { key: 'go', icon: '🔥', text: '加油，干就完了' },
        { key: 'nice', icon: '👍', text: '打得不错' },
        { key: 'pleasure', icon: '🤝', text: '承让承让' },
        { key: 'bluff', icon: '🎭', text: '你敢诈我？' },
        { key: 'allin', icon: '💎', text: '梭哈，一把定输赢' },
        { key: 'fold', icon: '🏳️', text: '这把弃了，下把再来' },
        { key: 'gg', icon: '🎮', text: 'GG，好局' },
      ]
    }
  },
  watch: {
    messages: {
      handler() {
        this.$nextTick(() => {
          if (this.messages.length > 0) {
            this.scrollToId = 'msg-' + (this.messages.length - 1)
          }
        })
      },
      deep: true
    }
  },
  methods: {
    sendMessage() {
      const text = this.inputText.trim()
      if (!text) return
      this.$emit('send', text)
      this.inputText = ''
      this.closePanels()
    },
    toggleEmojiPanel() {
      this.showEmojiPanel = !this.showEmojiPanel
      this.showVoicePanel = false
    },
    toggleVoicePanel() {
      this.showVoicePanel = !this.showVoicePanel
      this.showEmojiPanel = false
    },
    closePanels() {
      this.showEmojiPanel = false
      this.showVoicePanel = false
    },
    insertEmoji(emoji) {
      this.inputText += emoji
    },
    sendQuickVoice(item) {
      this.$emit('send', item.text, { type: 'voice', voiceKey: item.key })
      this.$emit('quick-voice', item)
      this.closePanels()
    }
  }
}
</script>

<style lang="scss" scoped>
.chat-box {
  position: relative;
  width: 44vw;
  min-width: 280rpx;
  max-width: calc(100vw - 14vw - 56px);
  height: min(44vh, 420rpx);
  min-height: 300rpx;
  background: rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16rpx;
  overflow: hidden;
  z-index: 30;
  transition: all 0.3s ease;
}

.chat-collapsed {
  width: 64rpx;
  height: 64rpx;
  border-radius: 50%;
}

.chat-toggle {
  position: absolute;
  top: 8rpx;
  right: 8rpx;
  width: 40rpx;
  height: 40rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 50%;
  z-index: 10;
}

.toggle-icon {
  font-size: var(--text-lg);
}

.chat-collapsed .chat-toggle {
  position: static;
  width: 100%;
  height: 100%;
  border-radius: 50%;
}

.chat-content {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding-top: 8rpx;
  min-height: 0;
}

.chat-messages {
  flex: 1;
  padding: 8rpx 12rpx;
  min-height: 0;
  max-height: none;
}

.chat-message {
  margin-bottom: 6rpx;
  font-size: var(--text-lg);
  line-height: 1.4;
  word-break: break-all;
}

.msg-system {
  text-align: center;
}

.msg-system-text {
  color: rgba(255, 215, 0, 0.7);
  font-size: var(--text-lg);
}

.msg-sender {
  color: rgba(255, 215, 0, 0.8);
  margin-right: 4rpx;
}

.msg-self .msg-sender {
  color: var(--color-info);
}

.msg-content {
  color: rgba(255, 255, 255, 0.85);
}

.msg-voice-icon {
  margin-left: 4rpx;
  font-size: var(--text-base);
}

/* 表情面板 */
.emoji-panel {
  background: rgba(0, 0, 0, 0.6);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 8rpx 0;
  flex-shrink: 0;
}

.emoji-scroll {
  white-space: nowrap;
}

.emoji-list {
  display: inline-flex;
  padding: 0 8rpx;
  gap: 4rpx;
}

.emoji-item {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8rpx;
}

.emoji-item:active {
  background: rgba(255, 255, 255, 0.1);
}

.emoji-text {
  font-size: var(--text-2xl);
}

/* 快捷语音面板 */
.voice-panel {
  background: rgba(0, 0, 0, 0.6);
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  padding: 8rpx;
  max-height: 16vh;
  overflow-y: auto;
  flex-shrink: 0;
}

.voice-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6rpx;
}

.voice-item {
  display: flex;
  align-items: center;
  gap: 4rpx;
  padding: 6rpx 10rpx;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 20rpx;
  border: 1px solid rgba(255, 215, 0, 0.2);
}

.voice-item:active {
  background: rgba(255, 215, 0, 0.15);
}

.voice-icon {
  font-size: var(--text-lg);
}

.voice-text {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.85);
  white-space: nowrap;
}

/* 输入区域 */
.chat-input-area {
  display: flex;
  align-items: center;
  gap: 6rpx;
  padding: 8rpx 10rpx;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: rgba(0, 0, 0, 0.4);
  flex-shrink: 0;
}

.tool-btn {
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 50%;
  flex-shrink: 0;
}

.tool-btn.active {
  background: rgba(255, 215, 0, 0.2);
}

.tool-btn:active {
  background: rgba(255, 255, 255, 0.15);
}

.tool-icon {
  font-size: var(--text-xl);
}

.chat-input {
  flex: 1;
  height: 48rpx;
  padding: 0 12rpx;
  background: rgba(255, 255, 255, 0.08);
  border-radius: 24rpx;
  color: #fff;
  font-size: var(--text-lg);
}

.input-placeholder {
  color: rgba(255, 255, 255, 0.3);
}

.send-btn {
  padding: 0 16rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 24rpx;
  flex-shrink: 0;
}

.send-active {
  background: linear-gradient(135deg, var(--color-gold), var(--color-gold-dark));
}

.send-btn text {
  font-size: var(--text-lg);
  color: rgba(255, 255, 255, 0.6);
}

.send-active text {
  color: var(--color-bg-card);
  font-weight: 600;
}

@media (max-width: 600px) {
  .chat-box {
    width: 52vw;
    height: min(48vh, 460rpx);
  }
}
</style>
