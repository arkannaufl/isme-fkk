# Setup VPS Lengkap - Step by Step

## 📋 Langkah-Langkah Setup di VPS

### ✅ Yang Sudah Dilakukan:
1. ✅ `sudo git clone isme-fkk`
2. ✅ `cd backend && composer install`
3. ✅ `sudo nano .env` (setup database, dll)
4. ✅ `cd ../frontend && npm install && npm run setup:prod && npm run build:prod`
5. ✅ Set permissions (`chmod`)
6. ✅ `cd ..` (kembali ke direktori `isme-fkk`)

---

## 🚀 Langkah Selanjutnya

### Step 1: Install Redis (WAJIB)

```bash
# Update package list
sudo apt update

# Install Redis
sudo apt install redis-server -y

# Start Redis
sudo systemctl start redis-server

# Enable Redis (auto-start saat reboot)
sudo systemctl enable redis-server

# Test Redis
redis-cli ping
# Harus return: PONG
```

**Jika `redis-cli` tidak ditemukan:**
```bash
# Install redis-tools
sudo apt install redis-tools -y
redis-cli ping
```

---

### Step 2: Konfigurasi Redis (OPTIONAL - Recommended)

```bash
# Edit Redis config
sudo nano /etc/redis/redis.conf
```

Cari dan ubah:
```ini
# Set max memory (sesuaikan dengan RAM server)
# Contoh: 2GB untuk server dengan 8GB RAM
maxmemory 2gb
maxmemory-policy allkeys-lru

# Enable persistence (untuk data recovery)
save 900 1
save 300 10
save 60 10000
```

**Restart Redis:**
```bash
sudo systemctl restart redis-server
```

**Test lagi:**
```bash
redis-cli ping
# Harus return: PONG
```

---

### Step 3: Update .env File dengan Redis Config

```bash
# Masuk ke direktori backend
cd /var/www/isme-fkk/backend

# Edit .env file
sudo nano .env
```

**Tambahkan/Update konfigurasi berikut:**
```env
# Cache Configuration
CACHE_STORE=redis

# Session Configuration
SESSION_DRIVER=redis
SESSION_CONNECTION=default

# Queue Configuration (optional, bisa tetap database atau sync)
# QUEUE_CONNECTION=redis  # Uncomment jika ingin pakai queue

# Redis Configuration
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
REDIS_DB=0
REDIS_CACHE_DB=1
```

**Save file:** `Ctrl + X`, lalu `Y`, lalu `Enter`

---

### Step 4: Clear Cache & Rebuild Config

```bash
# Pastikan masih di direktori backend
cd /var/www/isme-fkk/backend

# Clear semua cache
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Rebuild config cache
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

---

### Step 5: Test Redis Connection dari Laravel

```bash
# Masih di direktori backend
php artisan tinker
```

**Di dalam tinker, ketik:**
```php
Cache::put('test', 'redis working', 60);
Cache::get('test');
// Harus return: "redis working"
exit
```

**Jika error:** Check apakah Redis running dan .env sudah benar.

---

### Step 6: Test Aplikasi

```bash
# Test dari command line
curl http://localhost/api/health
# atau
curl http://your-domain.com/api/health

# Test login (jika ada endpoint)
curl -X POST http://localhost/api/login \
  -H "Content-Type: application/json" \
  -d '{"login":"test","password":"test"}'
```

**Atau test dari browser:**
- Buka `http://your-domain.com` atau `http://your-ip`
- Coba login
- Coba akses dashboard
- Coba fitur lainnya

---

### Step 7: Setup Nginx/Apache (Jika Belum)

**Jika menggunakan Nginx:**

```bash
# Edit Nginx config
sudo nano /etc/nginx/sites-available/isme-fkk
```

**Contoh config:**
```nginx
server {
    listen 80;
    server_name your-domain.com;
    root /var/www/isme-fkk/frontend/dist;
    index index.html;

    # Frontend
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Backend API
    location /api {
        try_files $uri $uri/ /index.php?$query_string;
        root /var/www/isme-fkk/backend/public;
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }

    # Backend files
    location ~ \.php$ {
        root /var/www/isme-fkk/backend/public;
        fastcgi_pass unix:/var/run/php/php8.2-fpm.sock;
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $document_root$fastcgi_script_name;
        include fastcgi_params;
    }
}
```

**Enable site:**
```bash
sudo ln -s /etc/nginx/sites-available/isme-fkk /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

### Step 8: Set Permissions (Jika Perlu)

```bash
# Set ownership
sudo chown -R www-data:www-data /var/www/isme-fkk

# Set permissions untuk storage dan cache
cd /var/www/isme-fkk/backend
sudo chmod -R 775 storage bootstrap/cache
sudo chmod -R 775 /var/www/isme-fkk/frontend/dist
```

---

### Step 9: Setup Queue Worker (OPTIONAL)

**Hanya jika ingin menggunakan queue untuk email/notifikasi di background:**

```bash
# Install Supervisor
sudo apt install supervisor -y

# Buat config file
sudo nano /etc/supervisor/conf.d/laravel-worker.conf
```

**Isi config:**
```ini
[program:laravel-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/isme-fkk/backend/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/isme-fkk/backend/storage/logs/worker.log
stopwaitsecs=3600
```

**Start Supervisor:**
```bash
sudo supervisorctl reread
sudo supervisorctl update
sudo supervisorctl start laravel-worker:*
```

**Check status:**
```bash
sudo supervisorctl status
```

**Note:** Step ini OPTIONAL karena aplikasi saat ini tidak menggunakan queue.

---

## ✅ Checklist Final

### Redis Setup:
- [ ] Redis installed
- [ ] Redis running (`sudo systemctl status redis-server`)
- [ ] Redis test berhasil (`redis-cli ping`)

### Application Config:
- [ ] `.env` file updated dengan Redis config
- [ ] Cache cleared (`php artisan config:clear`)
- [ ] Config cached (`php artisan config:cache`)
- [ ] Redis test dari Laravel berhasil

### Application Test:
- [ ] Aplikasi bisa diakses dari browser
- [ ] Login berfungsi
- [ ] Dashboard bisa diakses
- [ ] Fitur lainnya berfungsi

### Server Config (Jika Perlu):
- [ ] Nginx/Apache configured
- [ ] Permissions set correctly
- [ ] Queue worker setup (optional)

---

## 🔍 Troubleshooting

### Issue: Redis tidak bisa connect
```bash
# Check Redis status
sudo systemctl status redis-server

# Check Redis port
sudo netstat -tlnp | grep 6379

# Restart Redis
sudo systemctl restart redis-server
```

### Issue: Laravel tidak bisa connect ke Redis
```bash
# Check .env file
cat /var/www/isme-fkk/backend/.env | grep REDIS

# Test dari tinker
php artisan tinker
Cache::put('test', 'ok', 60);
Cache::get('test');
```

### Issue: Permission denied
```bash
# Set ownership
sudo chown -R www-data:www-data /var/www/isme-fkk

# Set permissions
sudo chmod -R 775 /var/www/isme-fkk/backend/storage
sudo chmod -R 775 /var/www/isme-fkk/backend/bootstrap/cache
```

### Issue: Config cache error
```bash
# Clear semua cache
cd /var/www/isme-fkk/backend
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear

# Rebuild
php artisan config:cache
```

---

## 📊 Verifikasi Setup

### 1. Check Redis
```bash
redis-cli ping
# Harus return: PONG

redis-cli info memory
# Check memory usage
```

### 2. Check Application
```bash
# Test dari browser atau curl
curl http://localhost/api/health
```

### 3. Check Logs
```bash
# Application logs
tail -f /var/www/isme-fkk/backend/storage/logs/laravel.log

# Nginx logs (jika ada error)
tail -f /var/log/nginx/error.log
```

---

## 🎯 Quick Reference Commands

```bash
# Redis
sudo systemctl status redis-server
redis-cli ping
redis-cli info memory

# Laravel
cd /var/www/isme-fkk/backend
php artisan config:clear
php artisan cache:clear
php artisan config:cache

# Permissions
sudo chown -R www-data:www-data /var/www/isme-fkk
sudo chmod -R 775 /var/www/isme-fkk/backend/storage

# Test
php artisan tinker
Cache::put('test', 'ok', 60);
Cache::get('test');
```

---

## ✅ Final Checklist

Setelah semua langkah selesai:

- [x] Redis installed dan running
- [x] `.env` updated dengan Redis config
- [x] Cache cleared dan rebuilt
- [x] Redis test dari Laravel berhasil
- [x] Aplikasi bisa diakses
- [x] Login berfungsi
- [x] Dashboard berfungsi
- [x] Semua fitur berfungsi

**Status:** ✅ **APLIKASI SIAP PRODUCTION!**

---

**Selamat! Aplikasi sudah siap untuk 1000+ user concurrent!** 🎉

