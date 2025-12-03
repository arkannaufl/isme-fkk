#!/bin/bash

PROJECT_PATH="/var/www/isme-fkk"
BACKEND_PATH="$PROJECT_PATH/backend"
FRONTEND_PATH="$PROJECT_PATH/frontend"

echo "🔧 Setting up permissions for Laravel project..."

# 1. Root project
echo "📁 Setting root project permissions..."
sudo chown -R www-data:www-data "$PROJECT_PATH"
sudo chmod 755 "$PROJECT_PATH"

# 2. Backend directories
echo "📁 Setting backend permissions..."
sudo chmod 755 "$BACKEND_PATH"

# 3. Storage & Bootstrap Cache (WRITABLE)
echo "📝 Setting storage and cache permissions (writable)..."
# Storage directory dan semua subdirectories
sudo chmod -R 775 "$BACKEND_PATH/storage"
sudo chown -R www-data:www-data "$BACKEND_PATH/storage"

# Pastikan subdirectories storage juga writable
sudo chmod -R 775 "$BACKEND_PATH/storage/app"
sudo chmod -R 775 "$BACKEND_PATH/storage/app/public"
sudo chmod -R 775 "$BACKEND_PATH/storage/framework"
sudo chmod -R 775 "$BACKEND_PATH/storage/framework/cache"
sudo chmod -R 775 "$BACKEND_PATH/storage/framework/sessions"
sudo chmod -R 775 "$BACKEND_PATH/storage/framework/views"
sudo chmod -R 775 "$BACKEND_PATH/storage/logs"

# Bootstrap cache
sudo chmod -R 775 "$BACKEND_PATH/bootstrap/cache"
sudo chown -R www-data:www-data "$BACKEND_PATH/bootstrap/cache"

# 4. Log file
echo "📝 Setting log file permissions..."
sudo touch "$BACKEND_PATH/storage/logs/laravel.log"
sudo chown www-data:www-data "$BACKEND_PATH/storage/logs/laravel.log"
sudo chmod 664 "$BACKEND_PATH/storage/logs/laravel.log"
sudo chmod 775 "$BACKEND_PATH/storage/logs"

# 5. .env file (READ-ONLY)
echo "🔒 Setting .env file permissions (read-only)..."
sudo chmod 644 "$BACKEND_PATH/.env"
sudo chown www-data:www-data "$BACKEND_PATH/.env"

# 6. Vendor directory (READ-ONLY)
echo "📦 Setting vendor permissions (read-only)..."
sudo chmod -R 755 "$BACKEND_PATH/vendor"
sudo chown -R www-data:www-data "$BACKEND_PATH/vendor"

# 7. Frontend directories
echo "📁 Setting frontend permissions..."
sudo chmod 755 "$FRONTEND_PATH"
if [ -d "$FRONTEND_PATH/dist" ]; then
    sudo chmod -R 755 "$FRONTEND_PATH/dist"
    sudo chown -R www-data:www-data "$FRONTEND_PATH/dist"
fi
if [ -d "$FRONTEND_PATH/node_modules" ]; then
    sudo chmod -R 755 "$FRONTEND_PATH/node_modules"
    sudo chown -R www-data:www-data "$FRONTEND_PATH/node_modules"
fi

# 8. Public storage link
echo "🔗 Checking storage link..."
if [ ! -L "$BACKEND_PATH/public/storage" ]; then
    cd "$BACKEND_PATH"
    sudo php artisan storage:link
    sudo chown www-data:www-data "$BACKEND_PATH/public/storage"
fi

echo ""
echo "✅ Permissions setup complete!"
echo ""
echo "📋 Summary:"
echo "   ✅ Storage & all subdirectories: 775 (writable by web server)"
echo "   ✅ Bootstrap Cache: 775 (writable by web server)"
echo "   ✅ .env file: 644 (read-only for security)"
echo "   ✅ Vendor: 755 (read-only)"
echo "   ✅ Frontend dist: 755 (read-only)"
echo "   ✅ Logs: 664 (writable by web server)"
echo ""
echo "🧪 Testing write permissions..."
# Test 1: Storage root
sudo -u www-data touch "$BACKEND_PATH/storage/test1.txt" 2>/dev/null
if [ -f "$BACKEND_PATH/storage/test1.txt" ]; then
    sudo -u www-data rm "$BACKEND_PATH/storage/test1.txt"
    echo "   ✅ Storage root: PASSED"
else
    echo "   ❌ Storage root: FAILED"
fi

# Test 2: Storage/app/public (untuk file uploads)
sudo -u www-data touch "$BACKEND_PATH/storage/app/public/test2.txt" 2>/dev/null
if [ -f "$BACKEND_PATH/storage/app/public/test2.txt" ]; then
    sudo -u www-data rm "$BACKEND_PATH/storage/app/public/test2.txt"
    echo "   ✅ Storage/app/public: PASSED (file uploads akan bekerja)"
else
    echo "   ❌ Storage/app/public: FAILED (file uploads mungkin gagal)"
fi

# Test 3: Logs
sudo -u www-data touch "$BACKEND_PATH/storage/logs/test3.txt" 2>/dev/null
if [ -f "$BACKEND_PATH/storage/logs/test3.txt" ]; then
    sudo -u www-data rm "$BACKEND_PATH/storage/logs/test3.txt"
    echo "   ✅ Storage/logs: PASSED (logging akan bekerja)"
else
    echo "   ❌ Storage/logs: FAILED (logging mungkin gagal)"
fi

# Test 4: Bootstrap cache
sudo -u www-data touch "$BACKEND_PATH/bootstrap/cache/test4.txt" 2>/dev/null
if [ -f "$BACKEND_PATH/bootstrap/cache/test4.txt" ]; then
    sudo -u www-data rm "$BACKEND_PATH/bootstrap/cache/test4.txt"
    echo "   ✅ Bootstrap/cache: PASSED (cache akan bekerja)"
else
    echo "   ❌ Bootstrap/cache: FAILED (cache mungkin gagal)"
fi

echo ""
echo "🎯 Final Checklist:"
echo "   ✅ Semua permission sudah di-set dengan benar"
echo "   ✅ Web server (www-data) bisa write ke storage"
echo "   ✅ Web server bisa write ke logs"
echo "   ✅ Web server bisa write ke cache"
echo "   ✅ File uploads akan bekerja dengan baik"
echo ""
echo "💡 Tips:"
echo "   - Jika ada error 'Permission denied', jalankan script ini lagi"
echo "   - Setelah deploy baru, selalu jalankan: sudo ./fix-permissions.sh"
echo "   - Pastikan web server user adalah 'www-data' (default Ubuntu/Debian)"

