<template>
  <view class="my-rooms-panel">
    <view class="rooms-header">
      <view><text class="rooms-title">我的房间</text><text class="rooms-subtitle">已加入的房间可直接继续，无需再次输入密码</text></view>
      <view v-if="isAgent" class="create-room-btn" @click="$emit('create')"><VIcon name="plus" :size="2" color="var(--color-bg-card)" /><text>创建房间</text></view>
    </view>
    <view class="rooms-tabs">
      <view class="rooms-tab" :class="{ active: activeTab === 'joined' }" @click="activeTab = 'joined'">继续游戏 {{ joinedRooms.length }}</view>
      <view v-if="isAgent" class="rooms-tab" :class="{ active: activeTab === 'owned' }" @click="activeTab = 'owned'">我创建的 {{ ownedRooms.length }}</view>
      <view class="rooms-tab" :class="{ active: activeTab === 'history' }" @click="switchToHistory">游戏历史</view>
      <text class="refresh" @click="$emit('refresh')">刷新</text>
    </view>
    <scroll-view class="rooms-list" scroll-y>
      <view v-if="activeTab === 'history'">
        <view v-if="historyLoading" class="rooms-empty"><text>正在加载历史记录</text></view>
        <view v-else-if="gameHistory.length === 0" class="rooms-empty"><text>暂无游戏历史</text></view>
        <view v-else v-for="(item, index) in gameHistory" :key="item.id || index" class="history-card">
          <view class="history-main">
            <view class="history-type"><VIcon name="cards" :size="2" color="var(--color-gold)" /></view>
            <view class="history-info">
              <text class="history-name">{{ formatGame(item.gameType) || '未知游戏' }}</text>
              <text class="history-meta">房间#{{ item.roomNo || item.roomId || '-' }} · {{ formatTime(item.createdAt || item.time) }}</text>
            </view>
          </view>
          <view class="history-result">
            <text class="history-amount" :class="(item.delta || item.profit || 0) >= 0 ? 'profit' : 'loss'">
              {{ (item.delta || item.profit || 0) >= 0 ? '+' : '' }}{{ item.delta || item.profit || 0 }}
            </text>
          </view>
        </view>
      </view>
      <view v-else>
      <view v-if="loading" class="rooms-empty"><text>正在加载房间</text></view>
      <view v-else-if="currentRooms.length === 0" class="rooms-empty"><text>{{ activeTab === 'joined' ? '暂无可继续的房间' : '暂未创建房间' }}</text></view>
      <view v-else v-for="(room, index) in currentRooms" :key="room.id || room.roomId || room.roomNo || index" class="room-card">
        <view class="room-card-main">
          <view class="room-type"><VIcon name="cards" :size="2.3" color="var(--color-gold)" /></view>
          <view class="room-info"><text class="room-name">{{ room.name || room.roomName || formatGame(room.gameType) || '游戏房间' }}</text><text class="room-meta">房间号 {{ room.roomNo || room.roomCode || room.id || room.roomId }} · {{ room.currentRound || room.handNo || 0 }}/25 局</text></view>
          <view class="room-status" :class="roomStatusClass(room)">{{ room.statusName || room.status || '可进入' }}</view>
        </view>
        <view class="room-actions">
          <view v-if="activeTab === 'owned'" class="room-action secondary" @click="$emit('share', room)">复制邀请</view>
          <view class="room-action primary" @click="$emit('enter', room)">{{ activeTab === 'owned' ? '房主进入' : '继续游戏' }}</view>
        </view>
      </view>
      </view>
    </scroll-view>
  </view>
</template>

<script>
import VIcon from '../ui/VIcon.vue'
import { formatGameType } from '../../utils/format.js'
import { getMyGameHistory } from '../../api/profile.js'
export default {
  name: 'MyRoomsPanel', components: { VIcon },
  props: { joinedRooms: { type: Array, default: () => [] }, ownedRooms: { type: Array, default: () => [] }, loading: Boolean, isAgent: Boolean },
  data() { return { activeTab: 'joined', gameHistory: [], historyLoading: false } },
  computed: { currentRooms() { return this.activeTab === 'owned' ? this.ownedRooms : this.joinedRooms } },
  methods: {
    formatGame: formatGameType,
    roomStatusClass(room) { return room.status === 'playing' ? 'playing' : 'waiting' },
    formatTime(time) {
      if (!time) return '-'
      try {
        const d = new Date(time)
        return `${d.getMonth()+1}/${d.getDate()} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      } catch(e) { return time }
    },
    async switchToHistory() {
      this.activeTab = 'history'
      if (this.gameHistory.length === 0) {
        await this.loadGameHistory()
      }
    },
    async loadGameHistory() {
      this.historyLoading = true
      try {
        const res = await getMyGameHistory()
        const data = res?.data || res || {}
        this.gameHistory = data.gameHistory || data.records || data.history || data.list || []
      } catch(e) {
        console.warn('[MyRooms] 加载游戏历史失败', e)
        this.gameHistory = []
      } finally {
        this.historyLoading = false
      }
    },
  }
}
</script>

<style lang="scss" scoped>
.my-rooms-panel { position: relative; z-index: 2; display: flex; flex: 1; min-height: 0; flex-direction: column; padding: 1.5vh 4vh 1vh; padding-left: calc(4vh + var(--safe-left)); padding-right: calc(4vh + var(--safe-right)); }
.rooms-header, .rooms-tabs, .room-card-main, .room-actions { display: flex; align-items: center; }
.rooms-header { justify-content: space-between; margin-bottom: 1.3vh; }
.rooms-title, .rooms-subtitle, .room-name, .room-meta { display: block; }
.rooms-title { color: #fff; font-size: var(--text-lg); font-weight: 700; }
.rooms-subtitle { margin-top: .3vh; color: rgba(255,255,255,.43); font-size: var(--text-xs); }
.create-room-btn, .room-action { display: flex; align-items: center; justify-content: center; gap: .6vh; border-radius: .8vh; font-size: var(--text-sm); font-weight: 600; }
.create-room-btn { padding: 1.1vh 1.8vh; background: var(--color-gold); color: var(--color-bg-card); }
.rooms-tabs { gap: 2vh; min-height: 5vh; border-bottom: .1vh solid rgba(255,255,255,.1); }
.rooms-tab { height: 100%; padding: 1vh 0; color: rgba(255,255,255,.45); font-size: var(--text-sm); }
.rooms-tab.active { color: var(--color-gold); border-bottom: .25vh solid var(--color-gold); }
.refresh { margin-left: auto; color: var(--color-gold); font-size: var(--text-sm); min-height: 44px; min-width: 56px; display: flex; align-items: center; justify-content: center; padding: 0 12px; border-radius: 8px; }
.rooms-list { flex: 1; min-height: 0; padding-top: 1vh; }
.room-card { padding: 1.2vh 1.5vh; margin-bottom: 1vh; border: .1vh solid rgba(255,255,255,.1); border-radius: 1vh; background: rgba(15,15,15,.72); }
.room-card-main { min-width: 0; }
.room-type { width: 5vh; height: 5vh; display: flex; align-items: center; justify-content: center; margin-right: 1.2vh; border-radius: .8vh; background: rgba(255,215,0,.12); flex-shrink: 0; }
.room-info { flex: 1; min-width: 0; }.room-name { color:#fff; font-size: var(--text-sm); font-weight:600; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }.room-meta { margin-top:.3vh; color:rgba(255,255,255,.4); font-size:var(--text-xs); }
.room-status { padding:.4vh .8vh; border-radius:.5vh; font-size:var(--text-xs); }.room-status.waiting { color:var(--color-gold); background:rgba(251,191,36,.12); }.room-status.playing { color:var(--color-success); background:rgba(74,222,128,.12); }
.room-actions { justify-content:flex-end; gap:1vh; margin-top:1vh; }.room-action { min-width:12vh; padding:1vh 1.5vh; }.room-action.secondary { color:rgba(255,255,255,.75); background:rgba(255,255,255,.08); }.room-action.primary { color:var(--color-bg-card); background:var(--color-gold); }
.rooms-empty { padding:8vh 0; color:rgba(255,255,255,.35); text-align:center; font-size:var(--text-sm); }
.history-card { display:flex; align-items:center; justify-content:space-between; padding:1.2vh 1.5vh; margin-bottom:1vh; border:.1vh solid rgba(255,255,255,.1); border-radius:1vh; background:rgba(15,15,15,.72); }
.history-main { display:flex; align-items:center; min-width:0; flex:1; }
.history-type { width:4.5vh; height:4.5vh; display:flex; align-items:center; justify-content:center; margin-right:1.2vh; border-radius:.8vh; background:rgba(255,215,0,.12); flex-shrink:0; }
.history-info { flex:1; min-width:0; }
.history-name { color:#fff; font-size:var(--text-sm); font-weight:600; display:block; }
.history-meta { margin-top:.3vh; color:rgba(255,255,255,.4); font-size:var(--text-xs); display:block; }
.history-result { flex-shrink:0; margin-left:1vh; min-width:80px; text-align:right; }
.history-amount { font-size:var(--text-md); font-weight:700; font-variant-numeric: tabular-nums; }
.history-amount.profit { color:var(--color-success); }
.history-amount.loss { color:var(--color-danger); }
</style>
