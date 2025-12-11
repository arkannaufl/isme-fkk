#!/bin/bash
# Script untuk cek konfigurasi yang mungkin jadi bottleneck

echo "=== CHECKING CONFIGURATION FOR LOGIN BOTTLENECK ==="
echo ""

cd /var/www/isme-fkk/backend || exit 1

# 1. PHP-FPM Configuration
echo "1. PHP-FPM CONFIGURATION:"
echo "------------------------"
PHP_VERSION=$(php -v | head -n1 | cut -d' ' -f2 | cut -d'.' -f1,2)
PHP_FPM_CONF="/etc/php/${PHP_VERSION}/fpm/pool.d/www.conf"

if [ -f "$PHP_FPM_CONF" ]; then
    echo "Config file: $PHP_FPM_CONF"
    echo ""
    echo "Current settings:"
    grep -E "pm\.(max_children|start_servers|min_spare|max_spare|max_requests)" "$PHP_FPM_CONF" | grep -v "^;" | head -5
    echo ""
    echo "⚠️  Recommendation:"
    echo "   pm.max_children should be at least 150 for 1000+ users"
    echo "   pm.start_servers should be 30"
    echo "   (Formula: 10% concurrent users * 1.5 buffer)"
    echo ""
else
    echo "❌ PHP-FPM config not found"
fi

# 2. Session Configuration
echo ""
echo "2. SESSION CONFIGURATION:"
echo "------------------------"
if [ -f ".env" ]; then
    echo "SESSION_DRIVER: $(grep SESSION_DRIVER .env | cut -d'=' -f2)"
    echo "SESSION_LIFETIME: $(grep SESSION_LIFETIME .env | cut -d'=' -f2) minutes"
    echo "CACHE_STORE: $(grep CACHE_STORE .env | cut -d'=' -f2)"
    echo ""
    SESSION_LIFETIME=$(grep SESSION_LIFETIME .env | cut -d'=' -f2)
    if [ -z "$SESSION_LIFETIME" ] || [ "$SESSION_LIFETIME" -lt 60 ]; then
        echo "⚠️  WARNING: SESSION_LIFETIME is too low (< 60 minutes)"
        echo "   This might cause users to be logged out frequently"
    fi
else
    echo "❌ .env file not found"
fi

# 3. Redis Configurationa
echo ""
echo "3. REDIS CONFIGURATION:"
echo "------------------------"
if command -v redis-cli &> /dev/null; then
    echo "Redis Status:"
    redis-cli ping 2>/dev/null && echo "✅ Redis is running" || echo "❌ Redis is not running"
    echo ""
    echo "Current Redis Info:"
    redis-cli INFO clients | grep -E "connected_clients|total_connections_received" 2>/dev/null || echo "Cannot connect to Redis"
    echo ""
    REDIS_CONF="/etc/redis/redis.conf"
    if [ -f "$REDIS_CONF" ]; then
        echo "Redis Config:"
        grep -E "^maxclients|^maxmemory" "$REDIS_CONF" | head -2
        echo ""
        MAXCLIENTS=$(grep "^maxclients" "$REDIS_CONF" | awk '{print $2}')
        if [ -z "$MAXCLIENTS" ] || [ "$MAXCLIENTS" -lt 1000 ]; then
            echo "⚠️  WARNING: maxclients might be too low"
            echo "   Recommendation: maxclients 10000"
        fi
    fi
else
    echo "❌ Redis CLI not found"
fi

# 4. MySQL Configuration
echo ""
echo "4. MYSQL CONFIGURATION:"
echo "------------------------"
if command -v mysql &> /dev/null; then
    # Try to get DB credentials from .env
    if [ -f ".env" ]; then
        DB_USER=$(grep "^DB_USERNAME" .env | cut -d'=' -f2 | tr -d ' ')
        DB_PASS=$(grep "^DB_PASSWORD" .env | cut -d'=' -f2 | tr -d ' ')
        
        if [ -n "$DB_USER" ] && [ -n "$DB_PASS" ]; then
            MAX_CONN=$(mysql -u"$DB_USER" -p"$DB_PASS" -e "SHOW VARIABLES LIKE 'max_connections';" 2>/dev/null | tail -1 | awk '{print $2}')
            CURR_CONN=$(mysql -u"$DB_USER" -p"$DB_PASS" -e "SHOW STATUS LIKE 'Threads_connected';" 2>/dev/null | tail -1 | awk '{print $2}')
            
            if [ -n "$MAX_CONN" ]; then
                echo "Max Connections: $MAX_CONN"
                echo "Current Connections: $CURR_CONN"
                echo ""
                if [ "$MAX_CONN" -lt 300 ]; then
                    echo "⚠️  WARNING: max_connections might be too low for 1000+ users"
                    echo "   Recommendation: max_connections 500 for 1000+ users"
                    echo "   (10% concurrent = 100, with 5x buffer = 500)"
                fi
            fi
        else
            echo "⚠️  Cannot read DB credentials from .env"
        fi
    fi
else
    echo "❌ MySQL client not found"
fi

# 5. Nginx Configuration
echo ""
echo "5. NGINX CONFIGURATION:"
echo "------------------------"
if command -v nginx &> /dev/null; then
    NGINX_CONF="/etc/nginx/nginx.conf"
    if [ -f "$NGINX_CONF" ]; then
        WORKER_PROC=$(grep "^worker_processes" "$NGINX_CONF" | awk '{print $2}' | tr -d ';')
        WORKER_CONN=$(grep "worker_connections" "$NGINX_CONF" | awk '{print $2}' | tr -d ';')
        
        echo "Worker Processes: $WORKER_PROC"
        echo "Worker Connections: $WORKER_CONN"
        echo ""
        if [ -n "$WORKER_CONN" ] && [ "$WORKER_CONN" -lt 1024 ]; then
            echo "⚠️  WARNING: worker_connections might be too low"
            echo "   Recommendation: worker_connections 2048 or higher"
        fi
    fi
else
    echo "❌ Nginx not found"
fi

# 6. Current Resource Usage
echo ""
echo "6. CURRENT RESOURCE USAGE:"
echo "------------------------"
echo "Memory:"
free -h | grep Mem
echo ""
echo "PHP-FPM Processes:"
PHP_COUNT=$(ps aux | grep php-fpm | grep -v grep | wc -l)
echo "   Active: $PHP_COUNT"
echo ""
echo "System Load:"
uptime

# 7. Check for potential race conditions
echo ""
echo "7. CODE ANALYSIS:"
echo "------------------------"
echo "Checking AuthController for potential issues..."
if [ -f "app/Http/Controllers/AuthController.php" ]; then
    if grep -q "is_logged_in" app/Http/Controllers/AuthController.php; then
        echo "⚠️  Found: Single device login check (is_logged_in)"
        echo "   This might cause race condition if many users login simultaneously"
        echo "   Consider using database locks or Redis atomic operations"
    fi
fi

echo ""
echo "=== SUMMARY ==="
echo "Run this script and check for ⚠️ warnings above"
echo "These are potential bottlenecks that need to be addressed"

