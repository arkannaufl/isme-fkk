# ISME Backend API

**Laravel 12 Backend API untuk ISME - Integrated System Medical Education**

## 📋 Deskripsi

Backend API untuk sistem manajemen akademik ISME menggunakan Laravel 12 dengan arsitektur RESTful API. Sistem ini dirancang untuk menangani 1000+ concurrent users dengan optimasi Redis, caching, dan rate limiting.

## 🚀 Quick Start

### Prerequisites

- PHP >= 8.2
- Composer >= 2.0
- MySQL >= 8.0
- Redis >= 6.0 (untuk production)

### Installation

```bash
# Install dependencies
composer install

# Setup environment
composer run setup:dev  # Development (tidak perlu Redis)
# atau
composer run setup:prod # Production (perlu Redis)

# APP_KEY akan auto-generate saat setup (jika kosong)

# Run migrations
php artisan migrate

# Seed database
php artisan db:seed

# Clear config cache
php artisan config:clear
```

### Development Server

```bash
# Run development server dengan queue worker
composer run dev

# Atau manual
php artisan serve
php artisan queue:listen
```

## 📁 Struktur Direktori

```
backend/
├── app/
│   ├── Console/          # Artisan commands
│   ├── Http/
│   │   ├── Controllers/  # API Controllers
│   │   └── Middleware/    # Custom middleware
│   ├── Imports/          # Excel import classes
│   ├── Models/           # Eloquent models
│   ├── Services/         # Business logic services
│   └── Traits/           # Reusable traits
├── config/               # Configuration files
├── database/
│   ├── migrations/       # Database migrations
│   └── seeders/         # Database seeders
├── routes/
│   └── api.php          # API routes
└── storage/             # Storage files
```

## 🔧 Configuration

### Environment Variables

File `.env` dikelola melalui command:
- `composer run setup:dev` - Setup untuk development (menggunakan database cache)
- `composer run setup:prod` - Setup untuk production (menggunakan Redis)

**Development (.env.development)**:
```env
APP_ENV=local
APP_DEBUG=true
APP_KEY=                    # Auto-generate saat setup
CACHE_STORE=database
SESSION_DRIVER=database
QUEUE_CONNECTION=database
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=epicgsnew20@gmail.com
MAIL_PASSWORD="gpon stlr elhd rmcx"
MAIL_FROM_ADDRESS="epicgsnew20@gmail.com"
MAIL_FROM_NAME="${APP_NAME}"
```

**Production (.env.production)**:
```env
APP_ENV=production
APP_DEBUG=false
APP_KEY=                    # Auto-generate saat setup
CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
REDIS_HOST=127.0.0.1
REDIS_PORT=6379
REDIS_DB=0
REDIS_CACHE_DB=1
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=epicgsnew20@gmail.com
MAIL_PASSWORD="gpon stlr elhd rmcx"
MAIL_FROM_ADDRESS="epicgsnew20@gmail.com"
MAIL_FROM_NAME="${APP_NAME}"
```

### Email Configuration

Sistem menggunakan **Gmail SMTP** untuk pengiriman email (OTP, notifikasi, dll).

**Setup Gmail App Password:**
1. Aktifkan 2-Step Verification di Google Account
2. Buat App Password: https://myaccount.google.com/apppasswords
3. Gunakan App Password sebagai `MAIL_PASSWORD` (bukan password biasa)

**Catatan:**
- Email akan otomatis dikonfigurasi saat menjalankan `composer run setup:dev` atau `composer run setup:prod`
- Untuk production, pertimbangkan menggunakan service email khusus (SendGrid, Mailgun, dll)

### Auto-Setup Features

**Fitur Otomatis saat `composer run setup:dev/prod`:**
- ✅ **Auto-generate APP_KEY** - Jika `APP_KEY` kosong, akan di-generate otomatis dengan key unik per environment
- ✅ **Auto-clear cache** - Otomatis clear config, cache, route, dan view cache setelah setup
- ✅ **Email configuration** - Konfigurasi email Gmail sudah ter-setup

### Redis Configuration

Redis digunakan untuk:
- **Session Storage** (Production)
- **Cache Storage** (Production)
- **Queue Processing** (Production)

Database digunakan untuk:
- **Session Storage** (Development)
- **Cache Storage** (Development)
- **Queue Processing** (Development)

## 📡 API Endpoints

### Authentication

```
POST   /api/login                    # Login user
POST   /api/logout                   # Logout user
GET    /api/me                       # Get current user
GET    /api/profile                  # Get user profile
PUT    /api/profile                  # Update profile
POST   /api/force-logout-by-token    # Force logout by token
POST   /api/force-logout-by-user     # Force logout by user
POST   /api/force-logout-by-username # Force logout by username
```

### User Management

```
GET    /api/users                    # List users (with pagination)
POST   /api/users                    # Create user
GET    /api/users/{id}               # Get user detail
PUT    /api/users/{id}               # Update user
DELETE /api/users/{id}               # Delete user
GET    /api/users/search             # Search users
POST   /api/users/import-dosen       # Import dosen from Excel
POST   /api/users/import-mahasiswa   # Import mahasiswa from Excel
POST   /api/users/import-tim-akademik # Import tim akademik from Excel
```

### Mata Kuliah

```
GET    /api/mata-kuliah              # List mata kuliah
POST   /api/mata-kuliah              # Create mata kuliah
GET    /api/mata-kuliah/{kode}      # Get mata kuliah detail
PUT    /api/mata-kuliah/{kode}      # Update mata kuliah
DELETE /api/mata-kuliah/{kode}      # Delete mata kuliah
POST   /api/mata-kuliah/bulk-import # Bulk import mata kuliah
GET    /api/mata-kuliah/filter-options # Get filter options
GET    /api/mata-kuliah-with-materi  # Get mata kuliah with materi (pagination)
```

### PBL (Problem Based Learning)

```
GET    /api/pbls/all                # Get all PBLs
GET    /api/pbls                    # Get all PBLs (paginated)
GET    /api/mata-kuliah/{kode}/pbls # Get PBLs by mata kuliah
POST   /api/mata-kuliah/{kode}/pbls # Create PBL
PUT    /api/pbls/{id}               # Update PBL
DELETE /api/pbls/{id}               # Delete PBL
POST   /api/pbl-generate/generate    # Generate PBL assignments
```

### CSR (Community Service)

```
GET    /api/csr                     # List CSR
POST   /api/csr                     # Create CSR
GET    /api/csr/{id}                # Get CSR detail
PUT    /api/csr/{id}                # Update CSR
DELETE /api/csr/{id}                # Delete CSR
POST   /api/csr/import              # Import CSR from Excel
GET    /api/csr/{id}/dosen          # Get dosen by CSR
POST   /api/csr/{id}/assign-dosen   # Assign dosen to CSR
```

### Jadwal

```
GET    /api/jadwal-kuliah-besar     # List jadwal kuliah besar
POST   /api/jadwal-kuliah-besar     # Create jadwal
GET    /api/jadwal-csr              # List jadwal CSR
GET    /api/jadwal-praktikum        # List jadwal praktikum
GET    /api/jadwal-pbl              # List jadwal PBL
GET    /api/jadwal-harian           # Get jadwal harian (combined)
```

### Absensi

```
GET    /api/keabsenan-mahasiswa/{id} # Get keabsenan mahasiswa
POST   /api/absensi/scan-qr         # Scan QR code untuk absensi
GET    /api/absensi/dosen/{id}      # Get absensi dosen
```

### Penilaian

```
GET    /api/penilaian-pbl          # Get penilaian PBL
POST   /api/penilaian-pbl          # Create penilaian PBL
GET    /api/penilaian-seminar-proposal # Get penilaian seminar proposal
POST   /api/penilaian-seminar-proposal # Create penilaian
GET    /api/penilaian-sidang-skripsi   # Get penilaian sidang skripsi
POST   /api/penilaian-sidang-skripsi   # Create penilaian
```

### Forum Diskusi

```
GET    /api/forum                   # List forums
POST   /api/forum                   # Create forum
GET    /api/forum/{slug}           # Get forum detail
PUT    /api/forum/{id}             # Update forum
DELETE /api/forum/{id}             # Delete forum
POST   /api/forum/{id}/reply       # Reply to forum
POST   /api/forum/{id}/like        # Like forum
GET    /api/forum/bookmarks         # Get bookmarks
```

### Support Center

```
GET    /api/support-center/tickets # Get tickets
POST   /api/support-center/tickets # Create ticket
GET    /api/support-center/tickets/{id} # Get ticket detail
PUT    /api/support-center/tickets/{id}/status # Update ticket status
POST   /api/support-center/tickets/{id}/rate # Rate ticket
GET    /api/support-center/knowledge # Get knowledge base
```

### Reporting

```
GET    /api/reporting               # Get activity logs (paginated)
GET    /api/reporting/summary       # Get summary
GET    /api/reporting/dosen-csr     # Get dosen CSR report
GET    /api/reporting/dosen-pbl     # Get dosen PBL report
GET    /api/reporting/jadwal-all    # Get all jadwal
GET    /api/reporting/export        # Export report
```

### WhatsApp

```
POST   /api/whatsapp/send          # Send WhatsApp message
GET    /api/whatsapp/logs          # Get WhatsApp logs
GET    /api/whatsapp/settings      # Get WhatsApp settings
PUT    /api/whatsapp/settings      # Update WhatsApp settings
POST   /api/whatsapp/webhook       # Webhook from Wablas
```

## 🔐 Authentication & Authorization

### Authentication
- **Laravel Sanctum**: Token-based authentication
- **Session Management**: Redis (Production) / Database (Development)
- **Token Validation**: Middleware `validate.token` untuk validasi token aktif

### Authorization
- **Spatie Permission**: Role-based access control
- **Roles**: `super_admin`, `tim_akademik`, `dosen`, `mahasiswa`
- **Middleware**: `role:super_admin,tim_akademik` untuk role-based routes

### Rate Limiting
- **Login**: 10 requests per minute
- **API Routes**: 120 requests per minute per user/IP
- **Global Middleware**: Applied to all authenticated routes

## 🗄️ Database

### Migrations

```bash
# Run migrations
php artisan migrate

# Rollback last migration
php artisan migrate:rollback

# Fresh migration (drop all tables)
php artisan migrate:fresh

# Fresh migration with seeding
php artisan migrate:fresh --seed
```

### Seeders

```bash
# Run all seeders
php artisan db:seed

# Run specific seeder
php artisan db:seed --class=UserSeeder
```

Available seeders:
- `UserSeeder`: Seed users (super admin, tim akademik, dosen, mahasiswa)
- `TahunAjaranSeeder`: Seed tahun ajaran
- `MataKuliahSeeder`: Seed mata kuliah
- `RuanganSeeder`: Seed ruangan
- `ForumCategorySeeder`: Seed forum categories
- `DeveloperSeeder`: Seed developers untuk support center

## 🔄 Queue & Jobs

### Queue Configuration

**Development**: Database queue
**Production**: Redis queue

### Queue Worker

```bash
# Start queue worker
php artisan queue:work

# Start queue worker dengan auto-restart
php artisan queue:listen

# Process specific queue
php artisan queue:work --queue=emails,notifications
```

### Supervisor (Production)

Untuk production, gunakan Supervisor untuk manage queue worker:

```ini
[program:isme-queue-worker]
process_name=%(program_name)s_%(process_num)02d
command=php /var/www/isme-fkk/backend/artisan queue:work redis --sleep=3 --tries=3 --max-time=3600
autostart=true
autorestart=true
stopasgroup=true
killasgroup=true
user=www-data
numprocs=2
redirect_stderr=true
stdout_logfile=/var/www/isme-fkk/backend/storage/logs/queue-worker.log
stopwaitsecs=3600
```

## 📊 Caching

### Cache Configuration

**Development**: Database cache
**Production**: Redis cache

### Cache Commands

```bash
# Clear all cache
php artisan cache:clear

# Clear config cache
php artisan config:clear

# Clear route cache
php artisan route:clear

# Clear view cache
php artisan view:clear

# Cache all
php artisan config:cache
php artisan route:cache
php artisan view:cache
```

### Cache Usage

```php
// Cache dengan TTL
Cache::put('key', 'value', now()->addMinutes(60));

// Cache remember
$value = Cache::remember('key', 60, function () {
    return DB::table('users')->get();
});

// Cache forget
Cache::forget('key');
```

## 📝 Activity Logging

Sistem menggunakan **Spatie Activity Log** untuk logging aktivitas:

```php
activity()
    ->causedBy($user)
    ->performedOn($model)
    ->log('User created new mata kuliah');
```

Logs dapat diakses melalui:
- API: `GET /api/reporting`
- Frontend: Halaman Histori

## 📤 Excel Import/Export

### Import

```php
// Import dosen
POST /api/users/import-dosen
Content-Type: multipart/form-data
file: [Excel file]

// Import mahasiswa
POST /api/users/import-mahasiswa
Content-Type: multipart/form-data
file: [Excel file]
```

### Export

```php
// Export report
GET /api/reporting/export
GET /api/report/export-excel-non-blok
```

## 🔒 Security Features

1. **Rate Limiting**: Mencegah brute force dan abuse
2. **Token Validation**: Validasi token aktif di setiap request
3. **Role-Based Access**: Akses terbatas berdasarkan role
4. **Input Validation**: Validasi semua input
5. **SQL Injection Protection**: Eloquent ORM
6. **XSS Protection**: Laravel Blade escaping
7. **CSRF Protection**: Laravel CSRF tokens
8. **Activity Logging**: Log semua aktivitas penting

## ⚡ Performance Optimization

1. **Redis Caching**: Cache untuk session, cache, dan queue
2. **Database Indexing**: Index pada kolom yang sering di-query
3. **Pagination**: Pagination untuk data besar (default 50 items)
4. **Eager Loading**: Optimasi query dengan eager loading
5. **Connection Pooling**: MySQL connection pooling
6. **Query Optimization**: Optimasi query dengan select specific columns

## 🧪 Testing

```bash
# Run tests
composer run test

# Run specific test
php artisan test --filter UserControllerTest

# Run with coverage
php artisan test --coverage
```

## 📦 Dependencies

### Main Dependencies
- `laravel/framework`: ^12.0
- `laravel/sanctum`: ^4.1
- `spatie/laravel-permission`: ^6.19
- `spatie/laravel-activitylog`: ^4.10
- `maatwebsite/excel`: ^3.1
- `barryvdh/laravel-dompdf`: ^3.1

### Development Dependencies
- `phpunit/phpunit`: ^11.5.3
- `laravel/pint`: ^1.13
- `fakerphp/faker`: ^1.23

## 🛠️ Artisan Commands

```bash
# Generate controller
php artisan make:controller UserController

# Generate model
php artisan make:model User -m

# Generate migration
php artisan make:migration create_users_table

# Generate seeder
php artisan make:seeder UserSeeder

# Tinker (interactive shell)
php artisan tinker

# List all routes
php artisan route:list

# Clear all caches
php artisan optimize:clear
```

## 📚 Additional Resources

- [Laravel Documentation](https://laravel.com/docs)
- [Laravel Sanctum](https://laravel.com/docs/sanctum)
- [Spatie Permission](https://spatie.be/docs/laravel-permission)
- [Redis Documentation](https://redis.io/documentation)

## 🐛 Troubleshooting

### Redis Connection Error
```bash
# Check Redis status
redis-cli ping

# Check Redis connection
php artisan tinker
>>> Cache::put('test', 'value', 60);
>>> Cache::get('test');
```

### Queue Not Processing
```bash
# Check queue status
php artisan queue:work --once

# Clear failed jobs
php artisan queue:flush

# Retry failed jobs
php artisan queue:retry all
```

### Permission Issues
```bash
# Fix storage permissions
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

## 🚀 Deployment & VPS Setup

### Setup Permissions untuk VPS

Setelah clone repository dan install dependencies di VPS, **WAJIB** menjalankan script `fix-permissions.sh` untuk memastikan semua permission sudah benar.

#### Mengapa Perlu Fix Permissions?

Laravel memerlukan permission yang tepat agar:
- ✅ File uploads bisa berfungsi (RPS, Materi, Signature, dll)
- ✅ Logging bisa berfungsi (error logs, activity logs)
- ✅ Cache bisa berfungsi (config cache, route cache, view cache)
- ✅ Session bisa berfungsi (user sessions)
- ✅ Tidak ada error "Permission denied"

#### Cara Menjalankan Fix Permissions

```bash
# 1. Masuk ke direktori backend
cd /var/www/isme-fkk/backend

# 2. Berikan execute permission pada script
chmod +x fix-permissions.sh

# 3. Jalankan script dengan sudo
sudo ./fix-permissions.sh
```

#### Apa yang Dilakukan Script?

Script `fix-permissions.sh` akan:
1. ✅ Set ownership semua file ke `www-data:www-data` (web server user)
2. ✅ Set permission `775` pada `storage/` dan `bootstrap/cache/` (writable)
3. ✅ Set permission `644` pada `.env` (read-only untuk security)
4. ✅ Set permission `755` pada `vendor/` dan `frontend/dist/` (read-only)
5. ✅ Set permission `664` pada log files (writable)
6. ✅ Membuat storage link jika belum ada
7. ✅ Test write permissions untuk memastikan web server bisa menulis

#### Kapan Harus Menjalankan Script?

Jalankan script ini:
- ✅ **Setelah clone repository baru** di VPS
- ✅ **Setelah deploy update** (jika ada masalah permission)
- ✅ **Setelah ada error "Permission denied"**
- ✅ **Setelah mengubah ownership/permission secara manual**

#### Verifikasi Permission

Setelah menjalankan script, verifikasi dengan:

```bash
# Cek storage permissions
ls -la /var/www/isme-fkk/backend/storage | head -5

# Cek apakah web server bisa write
sudo -u www-data touch /var/www/isme-fkk/backend/storage/test.txt
sudo -u www-data rm /var/www/isme-fkk/backend/storage/test.txt
echo "✅ Jika tidak ada error, permission sudah benar!"
```

#### Checklist Permission yang Benar

| Directory/File | Permission | Owner | Status |
|----------------|------------|-------|--------|
| `storage/` | `775` | `www-data:www-data` | ✅ Writable |
| `bootstrap/cache/` | `775` | `www-data:www-data` | ✅ Writable |
| `storage/logs/` | `775` | `www-data:www-data` | ✅ Writable |
| `storage/logs/laravel.log` | `664` | `www-data:www-data` | ✅ Writable |
| `.env` | `644` | `www-data:www-data` | ✅ Read-only |
| `vendor/` | `755` | `www-data:www-data` | ✅ Read-only |
| `frontend/dist/` | `755` | `www-data:www-data` | ✅ Read-only |

#### Troubleshooting Permission

**Error: "The stream or file could not be opened"**
```bash
# Jalankan fix-permissions.sh lagi
sudo ./fix-permissions.sh
```

**Error: "Permission denied" saat upload file**
```bash
# Pastikan storage/app/public writable
sudo chmod -R 775 /var/www/isme-fkk/backend/storage/app/public
sudo chown -R www-data:www-data /var/www/isme-fkk/backend/storage/app/public
```

**Error: "Cache write failed"**
```bash
# Pastikan bootstrap/cache writable
sudo chmod -R 775 /var/www/isme-fkk/backend/bootstrap/cache
sudo chown -R www-data:www-data /var/www/isme-fkk/backend/bootstrap/cache
```

---

**Version**: 2.0.2  
**Laravel Version**: 12.x  
**PHP Version**: >= 8.2

