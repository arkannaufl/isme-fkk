# 📋 Langkah-Langkah Deployment ke VPS

Panduan lengkap untuk deploy perubahan terbaru ke VPS dan setup testing.

## 🚀 Step 1: Deploy Perubahan ke VPS

```bash
# 1. Masuk ke direktori project
cd /var/www/isme-fkk

# 2. Pull perubahan terbaru dari GitHub
git pull origin main

# 3. Masuk ke direktori backend
cd backend

# 4. Pastikan semua script baru sudah ada
ls -la *.sh
# Harus ada: check-config.sh, monitor-login.sh, test-login-load.sh, 
#            setup-test-users.sh, create-test-users.sh, fix-all.sh, dll
```

## 📦 Step 2: Update Dependencies (jika ada)

```bash
# Install/update Composer dependencies
composer install --no-dev --optimize-autoloader

# Clear cache
php artisan config:clear
php artisan cache:clear
php artisan route:clear
php artisan view:clear
```

## 🗄️ Step 3: Run Migrations (jika ada migration baru)

```bash
# Check apakah ada migration baru
php artisan migrate:status

# Run migrations (jika ada)
php artisan migrate --force
```

## 🔐 Step 4: Fix Permissions

```bash
# Berikan execute permission
sudo chmod +x fix-permissions.sh

# Run fix permissions
sudo ./fix-permissions.sh
```

## ⚡ Step 5: Run Optimasi Server (jika belum pernah run)

**⚠️ PENTING**: Script ini cukup dijalankan **1x saja** saat pertama kali setup atau setelah reinstall server.

```bash
# Berikan execute permission
sudo chmod +x fix-all.sh

# Run optimasi (auto backup & fix semua config)
sudo ./fix-all.sh
```

**Catatan:**
- Script akan otomatis backup semua config sebelum diubah
- Jika sudah pernah run sebelumnya, skip step ini
- Hanya perlu run lagi jika server di-reinstall atau config di-reset

## 🧪 Step 6: Setup Script Testing

```bash
# Berikan execute permission pada semua script
sudo chmod +x check-config.sh
sudo chmod +x monitor-login.sh
sudo chmod +x test-login-load.sh
sudo chmod +x setup-test-users.sh
sudo chmod +x create-test-users.sh

# Verify script bisa dijalankan
./check-config.sh
```

**⚠️ PENTING**: Pastikan semua file sudah di-pull dari git:
```bash
# Jika file belum ada, pull dulu
cd /var/www/isme-fkk
git pull origin main

# Lalu berikan permission
cd backend
sudo chmod +x *.sh
```

## 👥 Step 6.5: Setup Test Users (Opsional)

**⚠️ PENTING**: Jika database sudah pakai data real, password user sudah berbeda-beda.

### Option 1: Create Test Users Khusus (⭐ RECOMMENDED)

**✅ TIDAK PERLU TAHU PASSWORD ASLI DARI DATABASE REAL!**

```bash
# Pastikan file sudah di-pull dan punya permission
sudo chmod +x create-test-users.sh

# Create 50 test users dengan password yang diketahui (bisa di-set sendiri)
./create-test-users.sh -r mahasiswa -p test123 -c 50

# Jika ada permission denied saat generate file, jalankan dengan sudo:
sudo ./create-test-users.sh -r mahasiswa -p test123 -c 50

# File users_mahasiswa_test.txt akan otomatis di-generate
# Jika file dibuat di /tmp, gunakan path lengkap:
# ./test-login-load.sh -f /tmp/users_mahasiswa_test.txt -c 50 -t 100
```

**Troubleshooting Permission:**
```bash
# Jika masih permission denied, fix ownership direktori:
sudo chown -R $USER:$USER /var/www/isme-fkk/backend

# Atau jalankan script dengan sudo:
sudo ./create-test-users.sh -r mahasiswa -p test123 -c 50
```

**Keuntungan:**
- ✅ **TIDAK PERLU TAHU PASSWORD ASLI** - Buat test users baru dengan password yang bisa di-set sendiri
- ✅ Tidak mengganggu data real - Test users terpisah dari user real
- ✅ Bisa dihapus setelah testing - Tidak meninggalkan sampah di database

**Keuntungan:**
- ✅ Password diketahui (bisa di-set sendiri)
- ✅ Tidak mengganggu data real
- ✅ Bisa dihapus setelah testing

### Option 2: Test dengan 1 User

```bash
# Test dengan 1 user yang password-nya diketahui
./test-login-load.sh -u realusername -p realpassword -c 100 -t 100
```

### Option 3: Generate dari Database (Jika Password Sama)

```bash
# Hanya cocok jika semua users punya password yang sama
./setup-test-users.sh -r mahasiswa -p password123
```

## ✅ Step 7: Verifikasi Konfigurasi

```bash
# Check konfigurasi server
./check-config.sh

# Pastikan semua sudah optimal:
# - PHP-FPM max_children: 150
# - Apache MaxRequestWorkers: 300
# - MySQL max_connections: 500
```

## 🧪 Step 8: Test dengan Load Testing

### Option A: Test dengan Load Testing Script (Recommended)

**Terminal 1 - Start Monitoring:**
```bash
cd /var/www/isme-fkk/backend
./monitor-login.sh
```

**Terminal 2 - Run Load Test:**
```bash
cd /var/www/isme-fkk/backend

# ⭐ RECOMMENDED: Test dengan test users khusus (setelah create-test-users.sh)
# Test gradual: mulai dari 50 concurrent users
./test-login-load.sh -f users_mahasiswa_test.txt -c 50 -t 100

# Jika sukses, test dengan 100 concurrent users
./test-login-load.sh -r mahasiswa -c 100 -t 200

# Jika masih sukses, test dengan 150 concurrent users (limit max_children)
./test-login-load.sh -r mahasiswa -c 150 -t 300

# Atau test dengan file users.txt (jika sudah generate)
./test-login-load.sh -f users.txt -c 50 -t 100
```

**Catatan:**
- Default password dari seeder adalah `password`
- Tidak perlu setting username/password manual
- Script akan otomatis ambil dari database

**Atau test dengan 1 user untuk test race condition:**
```bash
# Test dengan 1 user, 100 concurrent requests
./test-login-load.sh -u testuser -p password123 -c 100 -t 100
```

### Option B: Test dengan User Real (Opsional)

Jika ingin test dengan user real:
1. Suruh 10 user login bersamaan → Monitor 5-10 menit
2. Jika OK, suruh 50 user login → Monitor lagi
3. Jika OK, suruh 100 user login → Monitor lagi
4. Jika OK, suruh 150 user login (limit max_children)

## 📊 Step 9: Monitor Hasil Testing

**Check Monitoring Log:**
```bash
# Real-time monitoring log
tail -f storage/logs/monitor_$(date +%Y%m%d).log

# Check error log
tail -f storage/logs/laravel.log | grep -i "error\|exception"

# Check resource usage
free -h
ps aux | grep php-fpm | wc -l
htop
```

**Check Load Test Results:**
- Success rate harus > 90%
- Response time harus < 2 detik
- Tidak ada banyak failed requests
- Tidak ada banyak rate limited requests

## 🔍 Step 10: Troubleshooting (jika ada masalah)

### Jika Success Rate < 90%:

1. **Check PHP-FPM:**
   ```bash
   sudo systemctl status php8.4-fpm
   sudo systemctl restart php8.4-fpm
   ```

2. **Check MySQL:**
   ```bash
   mysql -e "SHOW PROCESSLIST;"
   mysql -e "SHOW VARIABLES LIKE 'max_connections';"
   ```

3. **Check Redis:**
   ```bash
   redis-cli PING
   redis-cli INFO clients
   ```

4. **Check Apache:**
   ```bash
   sudo systemctl status apache2
   sudo apache2ctl -M | grep mpm
   ```

### Jika Ada Banyak Rate Limited:

Edit `routes/api.php` dan adjust rate limiting:
```php
// Ubah dari throttle:10,1 ke throttle:20,1 atau lebih tinggi
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:20,1');
```

## ✅ Checklist Deployment

- [ ] Git pull berhasil
- [ ] Dependencies terupdate
- [ ] Migrations berhasil (jika ada)
- [ ] Permissions sudah benar
- [ ] Optimasi server sudah dijalankan (jika belum)
- [ ] Script testing sudah bisa dijalankan
- [ ] Konfigurasi server sudah optimal
- [ ] Load testing berhasil dengan success rate > 90%
- [ ] Monitoring menunjukkan resource usage normal
- [ ] Tidak ada error di log

## 📝 Catatan Penting

1. **Fix-all.sh**: Hanya perlu dijalankan 1x saja, tidak perlu setiap deploy
2. **Fix-permissions.sh**: Bisa dijalankan setiap deploy jika ada masalah permission
3. **Load Testing**: Bisa dijalankan kapan saja untuk test kapasitas
4. **Monitoring**: Disarankan dijalankan saat load testing untuk melihat resource usage

## 🆘 Quick Reference

```bash
# Deploy cepat (tanpa optimasi, jika sudah pernah setup)
cd /var/www/isme-fkk && git pull && cd backend && \
composer install --no-dev --optimize-autoloader && \
php artisan migrate --force && \
php artisan config:clear && \
sudo ./fix-permissions.sh

# Test cepat
./test-login-load.sh -r mahasiswa -c 50 -t 100

# Monitor cepat
./monitor-login.sh
```

