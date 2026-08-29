<template>
  <view class="extended-operations glass">
    <view class="operations-tabs">
      <view v-for="item in tabs" :key="item.key" class="operation-tab" :class="{ active: activeTab === item.key }" @click="selectTab(item.key)">
        <VIcon :name="item.icon" :size="2" :color="activeTab === item.key ? 'var(--color-gold)' : 'var(--color-text-muted)'" />
        <text>{{ item.label }}</text>
      </view>
    </view>

    <view v-if="activeTab === 'roomHistory'" class="operation-content">
      <view class="operation-toolbar"><input v-model="roomQuery.roomNo" class="operation-input" placeholder="房间号" @confirm="loadRoomHistory(1)" /><view class="operation-button" @click="loadRoomHistory(1)">查询</view></view>
      <view v-for="room in roomHistory" :key="room.roomNo" class="operation-row" @click="loadRounds(room)"><view><text class="row-title">房间 #{{ room.roomNo }}</text><text class="row-sub">{{ formatGameType(room.gameType) }} · {{ room.level }} · {{ room.rounds || room.totalRounds || 0 }} 局</text></view><view class="row-metrics"><text>流水 {{ room.totalFlow || 0 }}</text><text>抽水 {{ room.totalRake || 0 }}</text></view></view>
      <view v-if="selectedRoom" class="rounds-panel"><text class="panel-title">房间 #{{ selectedRoom.roomNo }} 单局审计</text><view v-for="round in roomRounds" :key="round.id" class="round-row"><text>第 {{ round.roundNo }} 局</text><text>{{ round.handName || '-' }}</text><text :class="round.delta >= 0 ? 'positive' : 'negative'">{{ round.delta >= 0 ? '+' : '' }}{{ round.delta || 0 }}</text><text>底池 {{ round.potBeforeRake || 0 }} / 抽水 {{ round.rake || 0 }}</text></view><view v-if="!roomRounds.length" class="empty">暂无单局记录</view></view>
      <view v-if="!roomHistory.length && !loading" class="empty">暂无房间汇总</view>
    </view>

    <view v-else-if="activeTab === 'approvals'" class="operation-content">
      <view v-for="item in approvals" :key="item.id" class="operation-row"><view><text class="row-title">{{ item.type || item.action || '待复核操作' }}</text><text class="row-sub">{{ item.reason || item.createdAt || '-' }}</text></view><view class="row-actions"><text class="approve" @click="review(item, true)">通过</text><text class="reject" @click="review(item, false)">拒绝</text></view></view><view v-if="!approvals.length && !loading" class="empty">暂无待复核请求</view>
    </view>

    <view v-else-if="activeTab === 'anomalies'" class="operation-content">
      <view class="operation-toolbar"><input v-model="anomalyForm.roomId" class="operation-input" type="number" placeholder="房间 ID" /><input v-model="anomalyForm.type" class="operation-input" placeholder="异常类型" /><input v-model="anomalyForm.detail" class="operation-input" placeholder="异常说明" /><view class="operation-button" @click="createAnomaly">登记</view></view>
      <view v-for="item in anomalies" :key="item.id" class="operation-row"><view><text class="row-title">{{ item.type || '房间异常' }}</text><text class="row-sub">{{ item.detail || item.description || '-' }}</text></view><text>{{ formatTime(item.createdAt) }}</text></view><view v-if="!anomalies.length && !loading" class="empty">输入房间 ID 查询或登记异常</view>
    </view>

    <view v-else-if="activeTab === 'conversations'" class="operation-content">
      <view v-for="item in conversations" :key="item.id" class="operation-row"><view><text class="row-title">{{ item.csName || item.staffName || '客服会话' }}</text><text class="row-sub">{{ item.userName || item.userId || '-' }} · {{ formatConversationStatus(item.status) }}</text></view><text>{{ formatTime(item.updatedAt || item.createdAt) }}</text></view><view v-if="!conversations.length && !loading" class="empty">暂无客服会话</view>
    </view>

    <view v-else-if="activeTab === 'agents'" class="operation-content">
      <view class="operation-toolbar"><input v-model="agentId" class="operation-input" type="number" placeholder="代理 ID（佣金报表）" /><view class="operation-button" @click="loadCommission">查询佣金</view></view>
      <view v-for="item in agentTree" :key="item.id" class="operation-row"><view><text class="row-title">{{ item.nickname || item.account || '代理 #' + item.id }}</text><text class="row-sub">层级 {{ item.level || '-' }} · 下级 {{ item.childrenCount || item.subCount || 0 }}</text></view><text>{{ formatConversationStatus(item.status) }}</text></view><view v-for="item in commissionReport" :key="item.id" class="round-row"><text>{{ item.gameType || '佣金' }}</text><text>{{ item.period || item.createdAt || '-' }}</text><text class="positive">{{ item.commissionAmount || item.amount || 0 }}</text></view><view v-if="!agentTree.length && !loading" class="empty">暂无代理树数据</view>
    </view>

    <view v-else class="operation-content">
      <view class="operation-toolbar"><input v-model="draftContent" class="operation-input" placeholder="草稿 JSON" /><view class="operation-button" @click="createDraft">创建草稿</view><input v-model="draftId" class="operation-input" placeholder="草稿或历史版本 ID" /><view class="operation-button" @click="publishDraft">发布草稿</view><view class="operation-button danger" @click="rollback">回滚配置</view></view>
      <view v-for="item in configHistory" :key="item.id" class="operation-row"><view><text class="row-title">{{ item.version || item.name || '配置版本 #' + item.id }}</text><text class="row-sub">{{ item.note || item.description || '-' }}</text></view><text>{{ formatTime(item.createdAt) }}</text></view><view v-if="!configHistory.length && !loading" class="empty">暂无配置历史</view>
    </view>
  </view>
</template>

<script>
import { formatGameType, formatConversationStatus } from '../../utils/format.js'
import VIcon from '../ui/VIcon.vue'
import { getAdminRoomHistory, getAdminRoomRounds, getPendingApprovals, approveRequest, rejectRequest, getRoomAnomalies, createRoomAnomaly, getCsConversations, getAgentTree, getAgentCommissionReport, getConfigHistory, createConfigDraft, publishConfigDraft, rollbackConfig } from '../../api/admin.js'

export default {
  name: 'AdminExtendedOperations',
  components: { VIcon },
  data() {
    return {
      activeTab: 'roomHistory', loading: false, roomQuery: { roomNo: '' }, roomHistory: [], selectedRoom: null, roomRounds: [], approvals: [], anomalies: [], conversations: [], agentTree: [], commissionReport: [], configHistory: [], agentId: '', draftId: '', draftContent: '{}', anomalyForm: { roomId: '', type: '', detail: '' },
      tabs: [{ key: 'roomHistory', label: '房间档案', icon: 'cards' }, { key: 'approvals', label: '双人复核', icon: 'check' }, { key: 'anomalies', label: '异常事件', icon: 'warning' }, { key: 'conversations', label: '客服会话', icon: 'headset' }, { key: 'agents', label: '代理报表', icon: 'user' }, { key: 'config', label: '配置版本', icon: 'gear' }]
    }
  },
  mounted() { this.loadRoomHistory(1) },
  methods: {
    formatConversationStatus,
    normalize(res) { return Array.isArray(res?.data) ? res.data : (res?.list || res?.data?.list || []) },
    async selectTab(tab) { this.activeTab = tab; const loaders = { roomHistory: () => this.loadRoomHistory(1), approvals: this.loadApprovals, conversations: this.loadConversations, agents: this.loadAgentTree, config: this.loadConfigHistory }; if (loaders[tab]) await loaders[tab]() },
    async loadRoomHistory(page) { this.loading = true; try { const res = await getAdminRoomHistory({ page, pageSize: 20, roomNo: this.roomQuery.roomNo || undefined }); this.roomHistory = this.normalize(res) } catch (e) { this.notify(e, '加载房间汇总失败') } finally { this.loading = false } },
    async loadRounds(room) { this.selectedRoom = room; this.roomRounds = []; try { const res = await getAdminRoomRounds(room.roomNo, { page: 1, pageSize: 100 }); this.roomRounds = this.normalize(res) } catch (e) { this.notify(e, '加载单局审计失败') } },
    async loadApprovals() { this.loading = true; try { this.approvals = this.normalize(await getPendingApprovals({ page: 1, pageSize: 50 })) } catch (e) { this.notify(e, '加载待复核请求失败') } finally { this.loading = false } },
    review(item, approved) { uni.showModal({ title: approved ? '通过复核' : '拒绝复核', content: approved ? '确认通过该请求？' : '确认拒绝该请求？', success: async result => { if (!result.confirm) return; try { await (approved ? approveRequest(item.id) : rejectRequest(item.id, '管理员拒绝')); uni.showToast({ title: '操作成功', icon: 'success' }); this.loadApprovals() } catch (e) { this.notify(e, '复核操作失败') } } }) },
    async createAnomaly() { const roomId = Number(this.anomalyForm.roomId); if (!roomId || !this.anomalyForm.type || !this.anomalyForm.detail) return uni.showToast({ title: '请填写房间、类型和说明', icon: 'none' }); try { await createRoomAnomaly(roomId, { type: this.anomalyForm.type, detail: this.anomalyForm.detail }); uni.showToast({ title: '异常已登记', icon: 'success' }); const res = await getRoomAnomalies(roomId, { page: 1, pageSize: 50 }); this.anomalies = this.normalize(res) } catch (e) { this.notify(e, '登记异常失败') } },
    async loadConversations() { this.loading = true; try { this.conversations = this.normalize(await getCsConversations({ page: 1, pageSize: 50 })) } catch (e) { this.notify(e, '加载客服会话失败') } finally { this.loading = false } },
    async loadAgentTree() { this.loading = true; try { this.agentTree = this.normalize(await getAgentTree()) } catch (e) { this.notify(e, '加载代理树失败') } finally { this.loading = false } },
    async loadCommission() { if (!this.agentId) return uni.showToast({ title: '请输入代理 ID', icon: 'none' }); try { this.commissionReport = this.normalize(await getAgentCommissionReport(this.agentId, { page: 1, pageSize: 50 })) } catch (e) { this.notify(e, '加载佣金报表失败') } },
    async loadConfigHistory() { this.loading = true; try { this.configHistory = this.normalize(await getConfigHistory({ page: 1, pageSize: 50 })) } catch (e) { this.notify(e, '加载配置历史失败') } finally { this.loading = false } },
    async createDraft() { try { const content = JSON.parse(this.draftContent || '{}'); await createConfigDraft(content); uni.showToast({ title: '草稿已创建', icon: 'success' }); this.loadConfigHistory() } catch (e) { this.notify(e, e instanceof SyntaxError ? '草稿 JSON 格式错误' : '创建草稿失败') } },
    async publishDraft() { if (!this.draftId) return uni.showToast({ title: '请输入草稿 ID', icon: 'none' }); try { await publishConfigDraft(this.draftId); uni.showToast({ title: '草稿已发布', icon: 'success' }); this.loadConfigHistory() } catch (e) { this.notify(e, '发布草稿失败') } },
    async rollback() { if (!this.draftId) return uni.showToast({ title: '请输入历史版本 ID', icon: 'none' }); try { await rollbackConfig({ versionId: this.draftId }); uni.showToast({ title: '配置已回滚', icon: 'success' }); this.loadConfigHistory() } catch (e) { this.notify(e, '回滚配置失败') } },
    formatTime(value) { if (!value) return '-'; const date = new Date(value); return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false }) },
    notify(error, fallback) { uni.showToast({ title: error?.error || error?.message || fallback, icon: 'none' }) }
  }
}
</script>

<style lang="scss" scoped>
.extended-operations{margin-top:2vh;padding:1.5vh;border:1px solid rgba(255,255,255,.08);border-radius:7px}.operations-tabs{display:flex;gap:.6vh;overflow-x:auto;padding-bottom:1vh}.operation-tab{height:40px;min-width:88px;padding:0 10px;display:flex;align-items:center;justify-content:center;gap:6px;border:1px solid rgba(255,255,255,.1);border-radius:5px;color:var(--color-text-muted);font-size:var(--text-xs);flex-shrink:0}.operation-tab.active{color:var(--color-text);border-color:rgba(255,215,0,.36);background:rgba(255,215,0,.1)}.operation-toolbar{display:flex;gap:8px;flex-wrap:wrap;margin:1vh 0}.operation-input{height:40px;min-width:120px;padding:0 10px;border:1px solid rgba(255,255,255,.12);border-radius:5px;background:rgba(0,0,0,.24);color:var(--color-text);font-size:var(--text-xs)}.operation-button{height:40px;padding:0 12px;display:flex;align-items:center;justify-content:center;border-radius:5px;background:rgba(255,215,0,.16);color:var(--color-gold);font-size:var(--text-xs)}.operation-button.danger{background:rgba(248,113,113,.12);color:#fca5a5}.operation-row,.round-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:1.1vh 0;border-top:1px solid rgba(255,255,255,.06);font-size:var(--text-xs)}.row-title,.row-sub{display:block}.row-title{color:var(--color-text);font-weight:600}.row-sub{margin-top:3px;color:var(--color-text-muted)}.row-metrics,.row-actions{display:flex;gap:12px;color:var(--color-text-muted)}.approve,.positive{color:var(--color-success)}.reject,.negative{color:var(--color-danger)}.rounds-panel{margin-top:1vh;padding:1vh;border-radius:5px;background:rgba(0,0,0,.18)}.panel-title{display:block;margin-bottom:.7vh;font-size:var(--text-xs);font-weight:700}.empty{padding:3vh 0;text-align:center;color:var(--color-text-muted);font-size:var(--text-xs)}@media(max-width:600px){.operation-row,.round-row{align-items:flex-start;flex-direction:column}.row-metrics,.row-actions{width:100%;justify-content:space-between}.operation-input{flex:1;min-width:0}}
</style>
