#!/bin/bash
# V-Poker 后台监控脚本
# 每5分钟检查一次服务状态

LOG_FILE="/tmp/v-poker-monitor.log"

while true; do
    echo "=== $(date '+%Y-%m-%d %H:%M:%S') ===" >> $LOG_FILE
    cd /opt/texas-platform && python3 scripts/monitor.py >> $LOG_FILE 2>&1
    echo "" >> $LOG_FILE
    sleep 300
done
