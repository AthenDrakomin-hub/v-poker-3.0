/**
 * V-Poker 6角色全功能API测试
 * 覆盖：管理员、总代理、一级代理、二级代理、玩家、客服
 */
const BASE = 'http://localhost:3001/api';

async function req(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', 'x-device-id': 'fulltest', ...(opts.headers || {}) };
  if (opts.token) headers.Authorization = `Bearer ${opts.token}`;
  const res = await fetch(`${BASE}${path}`, { ...opts, headers });
  const text = await res.text();
  let data;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data };
}

const results = [];
function pass(role, feature) { results.push({ role, feature, status: 'PASS' }); }
function fail(role, feature, detail) { results.push({ role, feature, status: 'FAIL', detail }); }
function skip(role, feature, reason) { results.push({ role, feature, status: 'SKIP', detail: reason }); }

async function login(account, password) {
  const r = await req('/auth/login', { method: 'POST', body: JSON.stringify({ account, password }) });
  return r.data?.token;
}

async function main() {
  console.log('========== V-Poker 6角色全功能API测试 ==========\n');

  // ==================== 1. 管理员 ====================
  console.log('--- 1. 管理员 admin ---');
  const adminToken = await login('admin', 'admin123');
  if (!adminToken) { fail('管理员', '登录', '无token'); return; }
  pass('管理员', '登录');

  const adminTests = [
    ['全局概览统计', '/admin/overview'],
    ['用户列表', '/admin/users?page=1&pageSize=20'],
    ['用户搜索', '/admin/users?search=player'],
    ['用户详情', '/admin/users/4'],
    ['房间列表', '/admin/rooms?page=1&pageSize=20'],
    ['代理树', '/admin/agent-tree'],
    ['财务流水', '/admin/transactions?page=1&pageSize=20'],
    ['审计日志', '/admin/audit-logs?page=1&pageSize=20'],
    ['客服列表', '/admin/cs-staff'],
    ['经济配置', '/admin/economy/config'],
    ['登录日志', '/admin/login-logs?page=1&pageSize=20'],
    ['权限列表', '/admin/permissions'],
    ['客服报表', '/admin/cs-report'],
    ['客服操作流水', '/admin/cs-operations?page=1&pageSize=20'],
  ];
  for (const [name, path] of adminTests) {
    const r = await req(path, { token: adminToken });
    if (r.status === 200) pass('管理员', name);
    else fail('管理员', name, `status=${r.status}`);
  }

  // 管理员调账
  const adj = await req('/admin/adjust-points', { method: 'POST', token: adminToken, body: JSON.stringify({ userId: 5, amount: 500, reason: '全功能测试' }) });
  if (adj.status === 200) pass('管理员', '用户调账');
  else fail('管理员', '用户调账', `status=${adj.status}`);

  // ==================== 2. 总代理 ====================
  console.log('\n--- 2. 总代理 top_agent ---');
  const topToken = await login('topagent', 'agent123');
  if (!topToken) { fail('总代理', '登录', '无token'); }
  else {
    pass('总代理', '登录');
    const topTests = [
      ['推广数据', '/agent/promotion-stats'],
      ['下线玩家', '/agent/players?page=1&pageSize=20'],
      ['邀请码查看', '/agent/invite-code'],
      ['筹码交易记录', '/agent/transactions?page=1&pageSize=20'],
      ['代理账本', '/agent/ledger'],
      ['分配明细', '/agent/commission-details'],
      ['我的房间', '/rooms/mine?page=1&pageSize=20'],
      ['房间模板', '/rooms/templates'],
    ];
    for (const [name, path] of topTests) {
      const r = await req(path, { token: topToken });
      if (r.status === 200) pass('总代理', name);
      else fail('总代理', name, `status=${r.status}`);
    }

    // 总代理创建房间
    const createRoom = await req('/rooms', { method: 'POST', token: topToken, body: JSON.stringify({ gameType: 'niuniu', level: 'top', initialPoints: 10000, password: '123456' }) });
    if (createRoom.status === 200 && createRoom.data?.room?.id) {
      pass('总代理', '创建房间');
      const topRoomId = createRoom.data.room.id;
      // 总代理给下线上筹码
      const recharge = await req('/agent/recharge', { method: 'POST', token: topToken, body: JSON.stringify({ userId: 5, amount: 200, reason: '总代测试上分' }) });
      if (recharge.status === 200) pass('总代理', '给下线上筹码');
      else fail('总代理', '给下线上筹码', `status=${recharge.status}`);
    } else {
      fail('总代理', '创建房间', `status=${createRoom.status}`);
    }
  }

  // ==================== 3. 一级代理 ====================
  console.log('\n--- 3. 一级代理 agent ---');
  const agentToken = await login('agent01', 'agent123');
  if (!agentToken) { fail('一级代理', '登录', '无token'); }
  else {
    pass('一级代理', '登录');
    const agentTests = [
      ['下线玩家', '/agent/players?page=1&pageSize=20'],
      ['邀请码查看', '/agent/invite-code'],
      ['筹码交易记录', '/agent/transactions?page=1&pageSize=20'],
      ['代理账本', '/agent/ledger'],
      ['我的房间', '/rooms/mine?page=1&pageSize=20'],
      ['房间模板', '/rooms/templates'],
    ];
    for (const [name, path] of agentTests) {
      const r = await req(path, { token: agentToken });
      if (r.status === 200) pass('一级代理', name);
      else fail('一级代理', name, `status=${r.status}`);
    }

    // 创建房间
    const cr = await req('/rooms', { method: 'POST', token: agentToken, body: JSON.stringify({ gameType: 'jinhua', level: 'junior', initialPoints: 10000, password: '123456' }) });
    if (cr.status === 200 && cr.data?.room?.id) {
      pass('一级代理', '创建房间');
      const roomId = cr.data.room.id;
      const roomNo = cr.data.room.roomNo;
      // 房间详情
      const rd = await req(`/rooms/${roomId}`, { token: agentToken });
      if (rd.status === 200) pass('一级代理', '房间详情');
      else fail('一级代理', '房间详情', `status=${rd.status}`);

      // 给下线上筹码
      const rc = await req('/agent/recharge', { method: 'POST', token: agentToken, body: JSON.stringify({ userId: 5, amount: 100, reason: '一级代理测试' }) });
      if (rc.status === 200) pass('一级代理', '给下线上筹码');
      else fail('一级代理', '给下线上筹码', `status=${rc.status}`);

      // 玩家加入+准备+开局（用player01）
      const pToken = await login('player01', 'player123');
      if (pToken) {
        // 先离开之前的房间
        await req('/rooms/leave', { method: 'POST', token: pToken });
        const join = await req('/rooms/join', { method: 'POST', token: pToken, body: JSON.stringify({ roomNo, password: '123456', spectate: false }) });
        if (join.status === 200 && join.data?.seatType === 'player') {
          pass('一级代理', '玩家加入房间');
          const ready = await req(`/rooms/${roomId}/ready`, { method: 'POST', token: pToken });
          if (ready.status === 200) pass('一级代理', '玩家准备');
          else fail('一级代理', '玩家准备', `status=${ready.status}`);
          // 代理也加入+准备
          await req('/rooms/join', { method: 'POST', token: agentToken, body: JSON.stringify({ roomNo, password: '123456', spectate: false }) });
          await req(`/rooms/${roomId}/ready`, { method: 'POST', token: agentToken });
          // 开局
          const start = await req(`/rooms/${roomId}/hand`, { method: 'POST', token: agentToken });
          if (start.status === 200 && start.data?.hand) {
            pass('一级代理', '开始游戏(发牌)');
            console.log(`  游戏阶段: ${start.data.hand.phase}, 玩家数: ${start.data.hand.seats?.length}`);
          } else {
            fail('一级代理', '开始游戏(发牌)', `status=${start.status}`);
          }
        } else {
          fail('一级代理', '玩家加入房间', `status=${join.status}, seatType=${join.data?.seatType}`);
        }
      }
    } else {
      fail('一级代理', '创建房间', `status=${cr.status}`);
    }
  }

  // ==================== 4. 二级代理 ====================
  console.log('\n--- 4. 二级代理 agent02 ---');
  const l2Token = await login('agent02', 'agent123');
  if (!l2Token) { fail('二级代理', '登录', '无token'); }
  else {
    pass('二级代理', '登录');
    const l2Tests = [
      ['下线玩家', '/agent/players?page=1&pageSize=20'],
      ['邀请码查看', '/agent/invite-code'],
      ['筹码交易记录', '/agent/transactions?page=1&pageSize=20'],
      ['代理账本', '/agent/ledger'],
      ['我的房间', '/rooms/mine?page=1&pageSize=20'],
      ['房间模板', '/rooms/templates'],
    ];
    for (const [name, path] of l2Tests) {
      const r = await req(path, { token: l2Token });
      if (r.status === 200) pass('二级代理', name);
      else fail('二级代理', name, `status=${r.status}`);
    }

    // 二级代理创建房间
    const l2cr = await req('/rooms', { method: 'POST', token: l2Token, body: JSON.stringify({ gameType: 'sangong', level: 'junior', initialPoints: 10000, password: '123456' }) });
    if (l2cr.status === 200 && l2cr.data?.room?.id) {
      pass('二级代理', '创建房间');
    } else {
      fail('二级代理', '创建房间', `status=${l2cr.status}, ${JSON.stringify(l2cr.data).substring(0, 100)}`);
    }

    // 二级代理邀请码注册新玩家
    const l2Invite = await req('/agent/invite-code', { token: l2Token });
    const l2Code = l2Invite.data?.inviteCode;
    if (l2Code) {
      const newAcc = 'l2player_' + Math.floor(Math.random() * 10000);
      const reg = await req('/auth/register', { method: 'POST', body: JSON.stringify({ account: newAcc, password: 'player123', confirmPassword: 'player123', nickname: '二级代理下线', securityCode: '888888', inviteCode: l2Code }) });
      if (reg.status === 200 && reg.data?.user?.id) {
        pass('二级代理', '邀请码注册玩家');
        // 二级代理给新玩家上筹码
        const l2rc = await req('/agent/recharge', { method: 'POST', token: l2Token, body: JSON.stringify({ userId: reg.data.user.id, amount: 500, reason: '二级代理上分' }) });
        if (l2rc.status === 200) pass('二级代理', '给下线上筹码');
        else fail('二级代理', '给下线上筹码', `status=${l2rc.status}`);
      } else {
        fail('二级代理', '邀请码注册玩家', `status=${reg.status}`);
      }
    }
  }

  // ==================== 5. 玩家 ====================
  console.log('\n--- 5. 玩家 player ---');
  const playerToken = await login('player01', 'player123');
  if (!playerToken) { fail('玩家', '登录', '无token'); }
  else {
    pass('玩家', '登录');
    const playerTests = [
      ['个人信息', '/profile'],
      ['钱包余额', '/wallet/balance'],
      ['钱包交易', '/wallet/transactions?page=1&pageSize=20'],
      ['游戏历史', '/games/history?page=1&pageSize=20'],
      ['未读消息', '/messages/unread-count'],
      ['我的房间', '/rooms/joined'],
    ];
    for (const [name, path] of playerTests) {
      const r = await req(path, { token: playerToken });
      if (r.status === 200) pass('玩家', name);
      else fail('玩家', name, `status=${r.status}`);
    }

    // 玩家注册流程（用一级代理邀请码）
    const agentT = await login('agent01', 'agent123');
    const inv = await req('/agent/invite-code', { token: agentT });
    const invCode = inv.data?.inviteCode;
    if (invCode) {
      const newPlayer = 'newplayer_' + Math.floor(Math.random() * 10000);
      const reg = await req('/auth/register', { method: 'POST', body: JSON.stringify({ account: newPlayer, password: 'player123', confirmPassword: 'player123', nickname: '新测试玩家', securityCode: '888888', inviteCode: invCode }) });
      if (reg.status === 200) pass('玩家', '邀请码注册');
      else fail('玩家', '邀请码注册', `status=${reg.status}`);
    }
  }

  // ==================== 6. 客服 ====================
  console.log('\n--- 6. 客服 customer_service ---');
  const csToken = await login('cs01', 'cs123456');
  if (!csToken) { fail('客服', '登录', '无token'); }
  else {
    pass('客服', '登录');
    const csTests = [
      ['客服操作流水', '/admin/cs-operations?page=1&pageSize=20'],
      ['客服会话列表', '/admin/cs/conversations'],
      ['个人信息', '/profile'],
    ];
    for (const [name, path] of csTests) {
      const r = await req(path, { token: csToken });
      if (r.status === 200) pass('客服', name);
      else fail('客服', name, `status=${r.status}`);
    }

    // 客服给玩家上分
    const csAdj = await req('/admin/cs-operations', { method: 'POST', token: csToken, body: JSON.stringify({ userId: 5, action: 'add', amount: 100, reason: '客服测试上分' }) });
    if (csAdj.status === 200) pass('客服', '给玩家上筹码');
    else fail('客服', '给玩家上筹码', `status=${csAdj.status}, ${JSON.stringify(csAdj.data).substring(0, 100)}`);
  }

  // ==================== 汇总 ====================
  console.log('\n========== 测试汇总 ==========');
  const passed = results.filter(r => r.status === 'PASS').length;
  const failed = results.filter(r => r.status === 'FAIL').length;
  const skipped = results.filter(r => r.status === 'SKIP').length;
  console.log(`通过: ${passed} / ${results.length}`);
  console.log(`失败: ${failed}`);
  console.log(`跳过: ${skipped}`);

  if (failed > 0) {
    console.log('\n失败项:');
    results.filter(r => r.status === 'FAIL').forEach(r => {
      console.log(`  ❌ [${r.role}] ${r.feature} — ${r.detail}`);
    });
  }

  // 按角色统计
  console.log('\n按角色统计:');
  const roles = [...new Set(results.map(r => r.role))];
  for (const role of roles) {
    const roleResults = results.filter(r => r.role === role);
    const rp = roleResults.filter(r => r.status === 'PASS').length;
    const rf = roleResults.filter(r => r.status === 'FAIL').length;
    console.log(`  ${role}: ${rp}/${roleResults.length} 通过${rf > 0 ? `, ${rf}失败` : ''}`);
  }
}

main().catch(e => console.error('FATAL:', e.message));
