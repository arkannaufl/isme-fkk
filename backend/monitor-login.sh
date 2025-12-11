#!/bin/bash
# Script monitoring yang akan capture data otomatis saat terjadi masalah

LOG_DIR="/var/www/isme-fkk/backend/storage/logs"
LOG_FILE="$LOG_DIR/monitor_$(date +%Y%m%d).log"
INTERVAL=30  # Check every 30 seconds

# Create log file if not exists
touch "$LOG_FILE"

echo "=== Login Monitoring Started ===" | tee -a "$LOG_FILE"
echo "Log file: $LOG_FILE" | tee -a "$LOG_FILE"
echo "Interval: $INTERVAL seconds" | tee -a "$LOG_FILE"
echo "Press Ctrl+C to stop" | tee -a "$LOG_FILE"
echo "" | tee -a "$LOG_FILE"

while true; do
    TIMESTAMP=$(date '+%Y-%m-%d %H:%M:%S')
    
    # Redis info
    REDIS_CLIENTS=$(redis-cli INFO clients 2>/dev/null | grep connected_clients | cut -d: -f2 | tr -d '\r ' || echo "N/A")
    REDIS_MEMORY=$(redis-cli INFO memory 2>/dev/null | grep used_memory_human | cut -d: -f2 | tr -d '\r ' || echo "N/A")
    REDIS_KEYS=$(redis-cli DBSIZE 2>/dev/null || echo "N/A")
    
    # PHP-FPM processes
    PHP_PROCESSES=$(ps aux | grep php-fpm | grep -v grep | wc -l)
    PHP_IDLE=$(ps aux | grep php-fpm | grep -v grep | grep idle | wc -l)
    PHP_ACTIVE=$(ps aux | grep php-fpm | grep -v grep | grep -v idle | wc -l)
    
    # System memory
    MEM_INFO=$(free -m | grep Mem)
    MEM_TOTAL=$(echo $MEM_INFO | awk '{print $2}')
    MEM_USED=$(echo $MEM_INFO | awk '{print $3}')
    MEM_PERCENT=$((MEM_USED * 100 / MEM_TOTAL))
    
    # System load
    LOAD=$(uptime | awk -F'load average:' '{print $2}' | awk '{print $1}' | tr -d ',')
    
    # Laravel errors (last 5 minutes)
    ERROR_COUNT=$(tail -1000 "$LOG_DIR/laravel.log" 2>/dev/null | grep -c "$(date '+%Y-%m-%d %H:%M')" || echo "0")
    
    # Check for login-related errors
    LOGIN_ERRORS=$(tail -100 "$LOG_DIR/laravel.log" 2>/dev/null | grep -ic "login\|auth\|session\|redis\|timeout" || echo "0")
    
    # Database connections (if accessible)
    DB_CONN=$(mysql -u root -e "SHOW STATUS LIKE 'Threads_connected';" 2>/dev/null | tail -1 | awk '{print $2}' || echo "N/A")
    
    # Format output
    OUTPUT="[$TIMESTAMP] | Redis: $REDIS_CLIENTS clients, $REDIS_MEMORY, $REDIS_KEYS keys | PHP: $PHP_PROCESSES total ($PHP_ACTIVE active, $PHP_IDLE idle) | Mem: ${MEM_PERCENT}% (${MEM_USED}MB/${MEM_TOTAL}MB) | Load: $LOAD | Errors: $ERROR_COUNT | Login Errors: $LOGIN_ERRORS | DB Connections: $DB_CONN"
    
    echo "$OUTPUT" | tee -a "$LOG_FILE"
    
    # Alert if thresholds exceeded
    if [ "$MEM_PERCENT" -gt 80 ]; then
        echo "⚠️  ALERT: Memory usage high: ${MEM_PERCENT}%" | tee -a "$LOG_FILE"
    fi
    
    if [ "$PHP_PROCESSES" -gt 50 ]; then
        echo "⚠️  ALERT: High PHP-FPM processes: $PHP_PROCESSES" | tee -a "$LOG_FILE"
    fi
    
    if [ "$LOGIN_ERRORS" -gt 10 ]; then
        echo "⚠️  ALERT: High login errors detected: $LOGIN_ERRORS" | tee -a "$LOG_FILE"
    fi
    
    sleep $INTERVAL
done

