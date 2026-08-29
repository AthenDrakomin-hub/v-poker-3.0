#!/usr/bin/env python3
"""V-Poker 实时监控脚本"""
import subprocess
import sys
from datetime import datetime

LOG_FILE = "/var/log/v-poker/api-error.log"
DB_CMD = "sudo -u postgres psql -d v_poker_2 -t --quiet"

def run_cmd(cmd):
    try:
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return result.stdout.strip()
    except:
        return ""

def check_errors():
    """检查最新错误日志"""
    errors = []
    try:
        result = subprocess.run(f"tail -100 {LOG_FILE}", shell=True, capture_output=True, text=True)
        lines = result.stdout.split('\n')[-20:]
        for line in lines:
            if '[ERROR]' in line and datetime.now().strftime('%Y-%m-%d') in line:
                errors.append(line.strip())
    except Exception as e:
        errors.append(f"读取日志失败: {e}")
    return errors

def check_db():
    """检查数据库状态"""
    status = {}
    cmd = f"{DB_CMD} -c \"SELECT COUNT(*) FROM rooms WHERE status NOT IN ('finished', 'archived');\""
    status['active_rooms'] = run_cmd(cmd)
    
    cmd = f"{DB_CMD} -c \"SELECT COUNT(*) FROM game_rounds WHERE turnover = 0 AND created_at > NOW() - INTERVAL '1 hour';\""
    status['zero_turnover'] = run_cmd(cmd)
    
    cmd = f"{DB_CMD} -c \"SELECT id, room_id, round_no, game_type, turnover FROM game_rounds ORDER BY id DESC LIMIT 3;\""
    status['recent_rounds'] = run_cmd(cmd)
    return status

def main():
    print(f"\n{'='*50}")
    print(f"V-Poker 监控报告 - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"{'='*50}\n")
    
    health = run_cmd("curl -s http://127.0.0.1:3001/api/health")
    pm2 = run_cmd("pm2 list --no-color | grep -c online")
    health_status = "✅" if '{"ok":true}' in health else "❌"
    print(f"【服务状态】")
    print(f"  API健康: {health_status}")
    print(f"  PM2进程: {pm2}/2 online")
    
    db = check_db()
    print(f"\n【数据库状态】")
    print(f"  活跃房间: {db['active_rooms']}个")
    print(f"  近1小时turnover=0: {db['zero_turnover']}条")
    
    if db['recent_rounds']:
        print(f"  最近回合:")
        for line in db['recent_rounds'].split('\n')[:3]:
            if line.strip():
                parts = line.split('|')
                if len(parts) >= 5:
                    print(f"    房间{parts[1].strip()} 第{parts[2].strip()}局 {parts[3].strip()} turnover={parts[4].strip()}")
    
    errors = check_errors()
    if errors:
        print(f"\n⚠️ 发现错误日志 ({len(errors)}条):")
        for err in errors[:5]:
            print(f"  - {err[:100]}")
        return 1
    else:
        print("\n✅ 无新错误")
        return 0

if __name__ == "__main__":
    exit(main())
