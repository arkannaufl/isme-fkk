#!/bin/bash
# Script terpusat untuk memperbaiki semua konfigurasi untuk 1000+ users
# Optimized untuk: PHP-FPM, Apache, MySQL

echo "=========================================="
echo "  FIXING ALL LOGIN BOTTLENECK ISSUES"
echo "  For 1000+ Users"
echo "=========================================="
echo ""

cd /var/www/isme-fkk/backend || exit 1

# ============================================
# 1. FIX PHP-FPM CONFIGURATION
# ============================================
echo "1. Fixing PHP-FPM configuration..."
echo "-----------------------------------"

# Deteksi PHP version otomatis
PHP_VERSION=$(php -v | head -n1 | cut -d' ' -f2 | cut -d'.' -f1,2)
PHP_FPM_CONF="/etc/php/${PHP_VERSION}/fpm/pool.d/www.conf"
PHP_BACKUP="${PHP_FPM_CONF}.backup.$(date +%Y%m%d_%H%M%S)"

# Fallback jika PHP version tidak terdeteksi
if [ ! -f "$PHP_FPM_CONF" ]; then
    echo "⚠️  Config not found at $PHP_FPM_CONF"
    echo "Trying PHP 8.4..."
    PHP_VERSION="8.4"
    PHP_FPM_CONF="/etc/php/${PHP_VERSION}/fpm/pool.d/www.conf"
    PHP_BACKUP="${PHP_FPM_CONF}.backup.$(date +%Y%m%d_%H%M%S)"
fi

if [ -f "$PHP_FPM_CONF" ]; then
    echo "PHP Version: $PHP_VERSION"
    echo "Config file: $PHP_FPM_CONF"
    echo "Creating backup: $PHP_BACKUP"
    sudo cp "$PHP_FPM_CONF" "$PHP_BACKUP"
    echo "✅ Backup created"
    
    # Update PHP-FPM config untuk 1000+ users
    echo "Updating PHP-FPM configuration..."
    sudo sed -i 's/^pm\.max_children = .*/pm.max_children = 150/' "$PHP_FPM_CONF"
    sudo sed -i 's/^pm\.start_servers = .*/pm.start_servers = 30/' "$PHP_FPM_CONF"
    sudo sed -i 's/^pm\.min_spare_servers = .*/pm.min_spare_servers = 15/' "$PHP_FPM_CONF"
    sudo sed -i 's/^pm\.max_spare_servers = .*/pm.max_spare_servers = 50/' "$PHP_FPM_CONF"
    sudo sed -i 's/^pm\.max_requests = .*/pm.max_requests = 1000/' "$PHP_FPM_CONF" || echo "pm.max_requests = 1000" | sudo tee -a "$PHP_FPM_CONF"
    
    echo "✅ PHP-FPM configuration updated"
    echo "New settings:"
    grep -E "pm\.(max_children|start_servers|min_spare|max_spare|max_requests)" "$PHP_FPM_CONF" | grep -v "^;" | head -5
    
    # Test dan restart
    echo ""
    echo "Testing PHP-FPM configuration..."
    if command -v php-fpm${PHP_VERSION} &> /dev/null; then
        sudo php-fpm${PHP_VERSION} -t > /dev/null 2>&1
    elif command -v php-fpm &> /dev/null; then
        sudo php-fpm -t > /dev/null 2>&1
    fi
    
    if [ $? -eq 0 ]; then
        echo "✅ Configuration is valid"
        sudo systemctl restart php${PHP_VERSION}-fpm
        echo "✅ PHP-FPM restarted"
    else
        echo "❌ Configuration error! Restoring backup..."
        sudo cp "$PHP_BACKUP" "$PHP_FPM_CONF"
        echo "✅ Backup restored"
    fi
else
    echo "❌ PHP-FPM config not found"
fi

echo ""

# ============================================
# 2. FIX MYSQL CONFIGURATION
# ============================================
echo "2. Fixing MySQL configuration..."
echo "-----------------------------------"

MYSQL_CONF="/etc/mysql/mysql.conf.d/mysqld.cnf"
MYSQL_BACKUP="${MYSQL_CONF}.backup.$(date +%Y%m%d_%H%M%S)"

if [ -f "$MYSQL_CONF" ]; then
    echo "Config file: $MYSQL_CONF"
    echo "Creating backup: $MYSQL_BACKUP"
    sudo cp "$MYSQL_CONF" "$MYSQL_BACKUP"
    echo "✅ Backup created"
    
    # Update max_connections untuk 1000+ users
    CURRENT_MAX=$(grep "^max_connections" "$MYSQL_CONF" | awk '{print $2}' | tr -d ' ')
    
    if [ -z "$CURRENT_MAX" ]; then
        echo "Adding max_connections = 500 to [mysqld] section..."
        sudo sed -i '/\[mysqld\]/a max_connections = 500' "$MYSQL_CONF"
    else
        echo "Updating max_connections from $CURRENT_MAX to 500..."
        sudo sed -i 's/^max_connections = .*/max_connections = 500/' "$MYSQL_CONF"
    fi
    
    echo "✅ MySQL configuration updated"
    echo "New setting:"
    grep "^max_connections" "$MYSQL_CONF"
    
    echo ""
    echo "Restarting MySQL..."
    sudo systemctl restart mysql
    echo "✅ MySQL restarted"
else
    echo "❌ MySQL config file not found at $MYSQL_CONF"
    echo "Trying alternative locations..."
    for alt_conf in /etc/my.cnf /etc/mysql/my.cnf; do
        if [ -f "$alt_conf" ]; then
            echo "Found config at: $alt_conf"
            sudo cp "$alt_conf" "${alt_conf}.backup.$(date +%Y%m%d_%H%M%S)"
            echo "Please manually edit $alt_conf and add: max_connections = 500 under [mysqld] section"
            break
        fi
    done
fi

echo ""

# ============================================
# 3. FIX APACHE CONFIGURATION
# ============================================
echo "3. Fixing Apache configuration..."
echo "-----------------------------------"

# Deteksi MPM yang digunakan
MPM_TYPE=$(apache2ctl -V 2>/dev/null | grep "Server MPM" | awk '{print $3}' || echo "prefork")
echo "Detected MPM: $MPM_TYPE"

# Backup configs
APACHE_CONF="/etc/apache2/apache2.conf"
MPM_PREFORK_CONF="/etc/apache2/mods-available/mpm_prefork.conf"
MPM_EVENT_CONF="/etc/apache2/mods-available/mpm_event.conf"
MPM_WORKER_CONF="/etc/apache2/mods-available/mpm_worker.conf"

APACHE_BACKUP_DIR="/etc/apache2/backup_$(date +%Y%m%d_%H%M%S)"
sudo mkdir -p "$APACHE_BACKUP_DIR"

echo "Creating backups..."
if [ -f "$APACHE_CONF" ]; then
    sudo cp "$APACHE_CONF" "$APACHE_BACKUP_DIR/apache2.conf.backup"
fi
if [ -f "$MPM_PREFORK_CONF" ]; then
    sudo cp "$MPM_PREFORK_CONF" "$APACHE_BACKUP_DIR/mpm_prefork.conf.backup"
fi
if [ -f "$MPM_EVENT_CONF" ]; then
    sudo cp "$MPM_EVENT_CONF" "$APACHE_BACKUP_DIR/mpm_event.conf.backup"
fi
echo "✅ Backups created in $APACHE_BACKUP_DIR"

# Update berdasarkan MPM type
if [ "$MPM_TYPE" = "prefork" ]; then
    echo "Updating MPM Prefork configuration..."
    
    if [ -f "$MPM_PREFORK_CONF" ]; then
        sudo sed -i 's/^[[:space:]]*MaxRequestWorkers[[:space:]]*.*/        MaxRequestWorkers         300/' "$MPM_PREFORK_CONF"
        sudo sed -i 's/^[[:space:]]*ServerLimit[[:space:]]*.*/        ServerLimit                 300/' "$MPM_PREFORK_CONF"
        sudo sed -i 's/^[[:space:]]*StartServers[[:space:]]*.*/        StartServers                  30/' "$MPM_PREFORK_CONF"
        sudo sed -i 's/^[[:space:]]*MinSpareServers[[:space:]]*.*/        MinSpareServers             20/' "$MPM_PREFORK_CONF"
        sudo sed -i 's/^[[:space:]]*MaxSpareServers[[:space:]]*.*/        MaxSpareServers             50/' "$MPM_PREFORK_CONF"
        echo "✅ Prefork configuration updated"
    else
        echo "❌ Prefork config not found"
    fi
    
elif [ "$MPM_TYPE" = "event" ] || [ "$MPM_TYPE" = "worker" ]; then
    echo "Updating MPM Event/Worker configuration..."
    
    CONF_FILE=""
    if [ "$MPM_TYPE" = "event" ] && [ -f "$MPM_EVENT_CONF" ]; then
        CONF_FILE="$MPM_EVENT_CONF"
    elif [ "$MPM_TYPE" = "worker" ] && [ -f "$MPM_WORKER_CONF" ]; then
        CONF_FILE="$MPM_WORKER_CONF"
    fi
    
    if [ -n "$CONF_FILE" ]; then
        sudo sed -i 's/^[[:space:]]*MaxRequestWorkers[[:space:]]*.*/        MaxRequestWorkers         300/' "$CONF_FILE"
        sudo sed -i 's/^[[:space:]]*ThreadsPerChild[[:space:]]*.*/        ThreadsPerChild             25/' "$CONF_FILE"
        sudo sed -i 's/^[[:space:]]*ServerLimit[[:space:]]*.*/        ServerLimit                 12/' "$CONF_FILE"
        sudo sed -i 's/^[[:space:]]*StartServers[[:space:]]*.*/        StartServers                  4/' "$CONF_FILE"
        sudo sed -i 's/^[[:space:]]*MinSpareThreads[[:space:]]*.*/        MinSpareThreads             50/' "$CONF_FILE"
        sudo sed -i 's/^[[:space:]]*MaxSpareThreads[[:space:]]*.*/        MaxSpareThreads             200/' "$CONF_FILE"
        echo "✅ Event/Worker configuration updated"
    else
        echo "❌ Config file not found"
    fi
fi

# Test Apache config
echo ""
echo "Testing Apache configuration..."
sudo apache2ctl configtest > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Configuration is valid"
    echo "Reloading Apache..."
    sudo systemctl reload apache2
    echo "✅ Apache reloaded"
else
    echo "❌ Configuration error! Restoring backups..."
    if [ -f "$APACHE_BACKUP_DIR/apache2.conf.backup" ]; then
        sudo cp "$APACHE_BACKUP_DIR/apache2.conf.backup" "$APACHE_CONF"
    fi
    if [ -f "$APACHE_BACKUP_DIR/mpm_prefork.conf.backup" ]; then
        sudo cp "$APACHE_BACKUP_DIR/mpm_prefork.conf.backup" "$MPM_PREFORK_CONF"
    fi
    echo "✅ Backups restored"
fi

echo ""

# ============================================
# 4. CLEAR LARAVEL CACHE
# ============================================
echo "4. Clearing Laravel cache..."
echo "-----------------------------------"
php artisan config:clear
php artisan cache:clear
php artisan route:clear
echo "✅ Cache cleared"
echo ""

# ============================================
# 5. VERIFY CHANGES
# ============================================
echo "5. Verifying changes..."
echo "-----------------------------------"
if [ -f "check-config.sh" ]; then
    bash check-config.sh
else
    echo "⚠️  check-config.sh not found, skipping verification"
fi
echo ""

echo "=========================================="
echo "  ALL FIXES COMPLETED!"
echo "=========================================="
echo ""
echo "Summary of changes:"
echo "  ✅ PHP-FPM: max_children = 150 (was 5)"
echo "  ✅ MySQL: max_connections = 500 (was 151)"
echo "  ✅ Apache: MaxRequestWorkers = 300 (was 150)"
echo ""
echo "Backup locations:"
echo "  PHP-FPM: $PHP_BACKUP"
echo "  MySQL: $MYSQL_BACKUP"
echo "  Apache: $APACHE_BACKUP_DIR"
echo ""
echo "Next steps:"
echo "1. Test login dengan beberapa user bersamaan"
echo "2. Monitor dengan: ./monitor-login.sh"
echo "3. Check logs: tail -f storage/logs/laravel.log"
echo ""
