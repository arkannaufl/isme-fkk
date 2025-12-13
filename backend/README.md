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
│   ├── Console/
│   │   └── Commands/     # Artisan commands
│   ├── Http/
│   │   ├── Controllers/  # API Controllers (61 controllers)
│   │   │   ├── AuthController.php
│   │   │   ├── UserController.php
│   │   │   ├── MataKuliahController.php
│   │   │   ├── PBLGenerateController.php
│   │   │   ├── CSRController.php
│   │   │   ├── ForumController.php
│   │   │   ├── SupportCenterController.php
│   │   │   ├── TicketController.php
│   │   │   ├── NotificationController.php
│   │   │   ├── ReportingController.php
│   │   │   ├── WhatsAppController.php
│   │   │   └── ... (48 controllers lainnya)
│   │   └── Middleware/    # Custom middleware (5 middleware)
│   │       ├── CheckRole.php
│   │       ├── ValidateActiveToken.php
│   │       ├── RateLimitMiddleware.php
│   │       ├── SanitizeInput.php
│   │       └── SecurityHeaders.php
│   ├── Imports/          # Excel import classes (6 imports)
│   │   ├── DosenImport.php
│   │   ├── MahasiswaImport.php
│   │   ├── HybridMahasiswaImport.php
│   │   ├── SuperFastMahasiswaImport.php
│   │   ├── TimAkademikImport.php
│   │   └── RuanganImport.php
│   ├── Models/           # Eloquent models (64 models)
│   ├── Services/         # Business logic services (2 services)
│   │   ├── SemesterService.php
│   │   └── WablasService.php
│   ├── Providers/
│   │   └── AppServiceProvider.php
│   └── Traits/           # Reusable traits
│       └── SendsWhatsAppNotification.php
├── config/               # Configuration files
│   ├── cache.php         # Cache configuration (Redis/Database)
│   ├── session.php       # Session configuration (Redis/Database)
│   ├── queue.php         # Queue configuration (Redis/Database)
│   ├── database.php      # Database configuration (MySQL with pooling)
│   ├── permission.php    # Spatie Permission config
│   └── activitylog.php   # Spatie Activity Log config
├── database/
│   ├── migrations/       # Database migrations (121 migrations)
│   └── seeders/         # Database seeders (11 seeders)
│       ├── DatabaseSeeder.php
│       ├── UserSeeder.php
│       ├── TahunAjaranSeeder.php
│       ├── MataKuliahSeeder.php
│       └── ... (7 seeders lainnya)
├── routes/
│   ├── api.php          # API routes (774 lines)
│   ├── web.php          # Web routes
│   └── console.php      # Console routes
├── storage/             # Storage files
│   ├── app/
│   │   └── public/      # Public storage (RPS, Materi, Signatures)
│   ├── framework/       # Framework cache
│   └── logs/            # Application logs
├── public/              # Public directory
│   └── storage -> ../storage/app/public # Storage symlink
├── setup-env.php        # Environment setup script
└── fix-permissions.sh   # Permission fix script for VPS
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
POST   /api/login                    # Login user (rate limit: 10/min)
POST   /api/logout                   # Logout user
GET    /api/me                       # Get current user
GET    /api/profile                  # Get user profile
PUT    /api/profile                  # Update profile
POST   /api/profile/avatar           # Update avatar
GET    /api/profile/check-availability # Check username/email availability
POST   /api/force-logout-by-token    # Force logout by token
POST   /api/force-logout-by-user     # Force logout by user ID
POST   /api/force-logout-by-username # Force logout by username
```

### User Management

```
GET    /api/users                    # List users (with pagination, default 50/page)
POST   /api/users                    # Create user
GET    /api/users/{id}               # Get user detail
PUT    /api/users/{id}               # Update user
DELETE /api/users/{id}               # Delete user
GET    /api/users/search             # Search users
GET    /api/users/{id}/jadwal-mengajar # Get jadwal mengajar dosen
GET    /api/users/{id}/email-status  # Get email verification status (Dosen)
PUT    /api/users/{id}/update-email  # Update email (Dosen)
POST   /api/users/import-dosen       # Import dosen from Excel (Super Admin)
POST   /api/users/import-mahasiswa   # Import mahasiswa from Excel (Super Admin)
POST   /api/users/import-tim-akademik # Import tim akademik from Excel (Super Admin)
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
GET    /api/mata-kuliah/peran-kurikulum-options # Get peran kurikulum options
GET    /api/mata-kuliah/keahlian-options # Get keahlian options
GET    /api/mata-kuliah/semester/{semester} # Get mata kuliah by semester
GET    /api/mata-kuliah-dosen        # Get mata kuliah dosen
GET    /api/mata-kuliah-dosen/{kode}/jadwal # Get jadwal dosen mata kuliah
GET    /api/mata-kuliah-with-materi  # Get mata kuliah with materi (pagination)
GET    /api/mata-kuliah-with-materi-all # Get all mata kuliah with materi
POST   /api/mata-kuliah/upload-rps   # Upload RPS
GET    /api/mata-kuliah/{kode}/download-rps # Download RPS
DELETE /api/mata-kuliah/{kode}/delete-rps # Delete RPS
POST   /api/mata-kuliah/upload-materi # Upload materi
GET    /api/mata-kuliah/{kode}/materi # Get materi
GET    /api/mata-kuliah/{kode}/download-materi # Download materi
DELETE /api/mata-kuliah/{kode}/delete-materi # Delete materi
PUT    /api/mata-kuliah/{kode}/update-materi-judul # Update materi judul
GET    /api/mata-kuliah/{kode}/dosen-permissions # Get dosen permissions
PUT    /api/mata-kuliah/{kode}/keahlian # Update keahlian
GET    /api/mata-kuliah/{kode}/keahlian # Get keahlian
```

### PBL (Problem Based Learning)

```
GET    /api/pbl-generate/pbls/all   # Get all PBLs
GET    /api/pbl-generate/pbls/{id}  # Get PBL detail
GET    /api/pbl-generate/pbls/{id}/assignments # Get PBL assignments
POST   /api/pbl-generate/generate   # Generate PBL assignments
POST   /api/pbl-generate/get-assignments # Get generated assignments
POST   /api/pbl-generate/assign-dosen # Assign dosen to PBL
POST   /api/pbl-generate/assign-mahasiswa # Assign mahasiswa to PBL
POST   /api/pbl-generate/assign-kelompok-kecil # Assign kelompok kecil
POST   /api/pbl-generate/assign-ruangan # Assign ruangan
POST   /api/pbl-generate/assign-jadwal # Assign jadwal
POST   /api/pbl-generate/assign-dosen-mengajar # Assign dosen mengajar
POST   /api/pbl-generate/assign-koordinator # Assign koordinator
POST   /api/pbl-generate/assign-tim-blok # Assign tim blok
POST   /api/pbl-generate/remove-assignment # Remove assignment
GET    /api/pbl-generate/pbls/{id}/dosen-options # Get dosen options
GET    /api/pbl-generate/pbls/{id}/mahasiswa-options # Get mahasiswa options
GET    /api/pbl-generate/pbls/{id}/kelompok-kecil-options # Get kelompok kecil options
GET    /api/pbl-generate/pbls/{id}/ruangan-options # Get ruangan options
GET    /api/pbl-generate/pbls/{id}/jadwal-options # Get jadwal options
```

### CSR (Community Service)

```
GET    /api/csr                     # List CSR
POST   /api/csr                     # Create CSR
GET    /api/csr/{id}                # Get CSR detail
PUT    /api/csr/{id}                # Update CSR
DELETE /api/csr/{id}                # Delete CSR
POST   /api/csr/import              # Import CSR from Excel
GET    /api/csr/options             # Get CSR options
GET    /api/csr/{id}/dosen          # Get dosen by CSR
POST   /api/csr/{id}/assign-dosen   # Assign dosen to CSR
DELETE /api/csr/{id}/remove-dosen/{dosenId} # Remove dosen from CSR
GET    /api/csr/{id}/mahasiswa      # Get mahasiswa by CSR
POST   /api/csr/{id}/assign-mahasiswa # Assign mahasiswa to CSR
DELETE /api/csr/{id}/remove-mahasiswa/{mahasiswaId} # Remove mahasiswa
GET    /api/csr/{id}/jadwal         # Get jadwal by CSR
POST   /api/csr/{id}/add-jadwal     # Add jadwal to CSR
DELETE /api/csr/{id}/remove-jadwal/{jadwalId} # Remove jadwal
GET    /api/csr/{id}/ruangan        # Get ruangan by CSR
POST   /api/csr/{id}/assign-ruangan # Assign ruangan to CSR
DELETE /api/csr/{id}/remove-ruangan/{ruanganId} # Remove ruangan
GET    /api/csr/{id}/detail-batch   # Get CSR detail batch
POST   /api/csr/{id}/detail-batch   # Create CSR detail batch
PUT    /api/csr/{id}/detail-batch/{detailBatchId} # Update detail batch
DELETE /api/csr/{id}/detail-batch/{detailBatchId} # Delete detail batch
```

### Kelompok & Kelas

```
# Kelompok Besar
GET    /api/kelompok-besar           # List kelompok besar
POST   /api/kelompok-besar           # Create kelompok besar
GET    /api/kelompok-besar/{id}      # Get kelompok besar detail
PUT    /api/kelompok-besar/{id}      # Update kelompok besar
DELETE /api/kelompok-besar/{id}      # Delete kelompok besar
POST   /api/kelompok-besar/import    # Import kelompok besar
GET    /api/kelompok-besar/options   # Get options
GET    /api/kelompok-besar/semester/{semesterId} # Get by semester ID
POST   /api/kelompok-besar/batch-by-semester # Batch by semester
GET    /api/kelompok-besar/{id}/mahasiswa # Get mahasiswa
POST   /api/kelompok-besar/{id}/assign-mahasiswa # Assign mahasiswa
DELETE /api/kelompok-besar/{id}/remove-mahasiswa/{mahasiswaId} # Remove mahasiswa
GET    /api/kelompok-besar/{id}/dosen # Get dosen
POST   /api/kelompok-besar/{id}/assign-dosen # Assign dosen
DELETE /api/kelompok-besar/{id}/remove-dosen/{dosenId} # Remove dosen

# Kelompok Kecil
GET    /api/kelompok-kecil           # List kelompok kecil
POST   /api/kelompok-kecil           # Create kelompok kecil
GET    /api/kelompok-kecil/{id}      # Get detail
PUT    /api/kelompok-kecil/{id}      # Update
DELETE /api/kelompok-kecil/{id}      # Delete
POST   /api/kelompok-kecil/import    # Import
GET    /api/kelompok-kecil/options   # Get options
GET    /api/kelompok-kecil/{id}/mahasiswa # Get mahasiswa
POST   /api/kelompok-kecil/{id}/assign-mahasiswa # Assign mahasiswa
DELETE /api/kelompok-kecil/{id}/remove-mahasiswa/{mahasiswaId} # Remove
GET    /api/kelompok-kecil/{id}/dosen # Get dosen
POST   /api/kelompok-kecil/{id}/assign-dosen # Assign dosen
DELETE /api/kelompok-kecil/{id}/remove-dosen/{dosenId} # Remove dosen

# Kelas - REMOVED (using Kelompok Kecil directly)

# Kelompok Besar Antara
GET    /api/kelompok-besar-antara   # List
POST   /api/kelompok-besar-antara   # Create
GET    /api/kelompok-besar-antara/{id} # Get detail
PUT    /api/kelompok-besar-antara/{id} # Update
DELETE /api/kelompok-besar-antara/{id} # Delete
POST   /api/kelompok-besar-antara/import # Import
GET    /api/kelompok-besar-antara/options # Get options

# Kelompok Kecil Antara
GET    /api/kelompok-kecil-antara   # List
POST   /api/kelompok-kecil-antara   # Create
GET    /api/kelompok-kecil-antara/{id} # Get detail
PUT    /api/kelompok-kecil-antara/{id} # Update
DELETE /api/kelompok-kecil-antara/{id} # Delete
POST   /api/kelompok-kecil-antara/import # Import
GET    /api/kelompok-kecil-antara/options # Get options
```

### Jadwal

```
# Jadwal Kuliah Besar
GET    /api/jadwal-kuliah-besar     # List jadwal kuliah besar
POST   /api/jadwal-kuliah-besar     # Create jadwal
GET    /api/jadwal-kuliah-besar/{id} # Get detail
PUT    /api/jadwal-kuliah-besar/{id} # Update
DELETE /api/jadwal-kuliah-besar/{id} # Delete
POST   /api/jadwal-kuliah-besar/import # Import
GET    /api/jadwal-kuliah-besar/options # Get options
GET    /api/jadwal-kuliah-besar/{id}/dosen # Get dosen
POST   /api/jadwal-kuliah-besar/{id}/assign-dosen # Assign dosen
DELETE /api/jadwal-kuliah-besar/{id}/remove-dosen/{dosenId} # Remove dosen
GET    /api/jadwal-kuliah-besar/{id}/ruangan # Get ruangan
POST   /api/jadwal-kuliah-besar/{id}/assign-ruangan # Assign ruangan
DELETE /api/jadwal-kuliah-besar/{id}/remove-ruangan/{ruanganId} # Remove ruangan

# Jadwal CSR
GET    /api/jadwal-csr              # List jadwal CSR
POST   /api/jadwal-csr              # Create
GET    /api/jadwal-csr/{id}         # Get detail
PUT    /api/jadwal-csr/{id}         # Update
DELETE /api/jadwal-csr/{id}         # Delete
POST   /api/jadwal-csr/import       # Import
GET    /api/jadwal-csr/options      # Get options

# Jadwal Non-Blok Non-CSR
GET    /api/jadwal-non-blok-non-csr # List
POST   /api/jadwal-non-blok-non-csr # Create
GET    /api/jadwal-non-blok-non-csr/{id} # Get detail
PUT    /api/jadwal-non-blok-non-csr/{id} # Update
DELETE /api/jadwal-non-blok-non-csr/{id} # Delete
POST   /api/jadwal-non-blok-non-csr/import # Import
GET    /api/jadwal-non-blok-non-csr/options # Get options

# Jadwal Praktikum
GET    /api/jadwal-praktikum        # List
POST   /api/jadwal-praktikum        # Create
GET    /api/jadwal-praktikum/{id}   # Get detail
PUT    /api/jadwal-praktikum/{id}   # Update
DELETE /api/jadwal-praktikum/{id}   # Delete
POST   /api/jadwal-praktikum/import # Import
GET    /api/jadwal-praktikum/options # Get options

# Jadwal Jurnal Reading
GET    /api/jadwal-jurnal-reading   # List
POST   /api/jadwal-jurnal-reading   # Create
GET    /api/jadwal-jurnal-reading/{id} # Get detail
PUT    /api/jadwal-jurnal-reading/{id} # Update
DELETE /api/jadwal-jurnal-reading/{id} # Delete
POST   /api/jadwal-jurnal-reading/import # Import
GET    /api/jadwal-jurnal-reading/options # Get options

# Jadwal Persamaan Persepsi
GET    /api/jadwal-persamaan-persepsi # List
POST   /api/jadwal-persamaan-persepsi # Create
GET    /api/jadwal-persamaan-persepsi/{id} # Get detail
PUT    /api/jadwal-persamaan-persepsi/{id} # Update
DELETE /api/jadwal-persamaan-persepsi/{id} # Delete
POST   /api/jadwal-persamaan-persepsi/import # Import
GET    /api/jadwal-persamaan-persepsi/options # Get options

# Jadwal Harian (Combined)
GET    /api/jadwal-harian           # Get jadwal harian (combined semua jenis)
POST   /api/jadwal-harian           # Create
GET    /api/jadwal-harian/{id}      # Get detail
PUT    /api/jadwal-harian/{id}      # Update
DELETE /api/jadwal-harian/{id}      # Delete
POST   /api/jadwal-harian/import    # Import
GET    /api/jadwal-harian/options   # Get options
GET    /api/jadwal-harian/dosen/{dosenId} # Get jadwal dosen
GET    /api/jadwal-harian/mahasiswa/{mahasiswaId} # Get jadwal mahasiswa
```

### Absensi

```
GET    /api/mahasiswa/{id}/jadwal-kuliah # Get jadwal kuliah mahasiswa
GET    /api/mahasiswa/{id}/nilai    # Get nilai mahasiswa
GET    /api/mahasiswa/{id}/absensi  # Get absensi mahasiswa
GET    /api/keabsenan-mahasiswa/{id} # Get keabsenan mahasiswa
POST   /api/absensi/scan-qr         # Scan QR code untuk absensi
GET    /api/absensi/dosen/{id}      # Get absensi dosen
```

### Penilaian

```
# Penilaian PBL
GET    /api/penilaian-pbl          # Get penilaian PBL
POST   /api/penilaian-pbl          # Create penilaian PBL
GET    /api/penilaian-pbl/{id}     # Get detail
PUT    /api/penilaian-pbl/{id}     # Update
DELETE /api/penilaian-pbl/{id}     # Delete

# Penilaian Seminar Proposal
GET    /api/penilaian-seminar-proposal # Get penilaian
POST   /api/penilaian-seminar-proposal # Create penilaian
GET    /api/penilaian-seminar-proposal/{id} # Get detail
PUT    /api/penilaian-seminar-proposal/{id} # Update
DELETE /api/penilaian-seminar-proposal/{id} # Delete

# Penilaian Sidang Skripsi
GET    /api/penilaian-sidang-skripsi   # Get penilaian
POST   /api/penilaian-sidang-skripsi   # Create penilaian
GET    /api/penilaian-sidang-skripsi/{id} # Get detail
PUT    /api/penilaian-sidang-skripsi/{id} # Update
DELETE /api/penilaian-sidang-skripsi/{id} # Delete

# Penilaian Jurnal Reading
GET    /api/penilaian-jurnal-reading   # Get penilaian
POST   /api/penilaian-jurnal-reading   # Create penilaian
GET    /api/penilaian-jurnal-reading/{id} # Get detail
PUT    /api/penilaian-jurnal-reading/{id} # Update
DELETE /api/penilaian-jurnal-reading/{id} # Delete
```

### Forum Diskusi

```
GET    /api/forum                   # List forums (paginated, default 15/page)
POST   /api/forum                   # Create forum
GET    /api/forum/{id}              # Get forum detail dengan replies
PUT    /api/forum/{id}              # Update forum
DELETE /api/forum/{id}              # Delete forum
POST   /api/forum/{id}/reply       # Reply to forum
PUT    /api/forum/replies/{id}     # Update reply
DELETE /api/forum/replies/{id}     # Delete reply
POST   /api/forum/{id}/like        # Like forum
POST   /api/forum/{id}/bookmark    # Bookmark forum
POST   /api/forum/replies/{id}/like # Like reply
POST   /api/forum/replies/{id}/bookmark # Bookmark reply
GET    /api/forum/bookmarks         # Get bookmarks
GET    /api/forum/categories        # Get categories
POST   /api/forum/categories        # Create category (Super Admin, Tim Akademik)
PUT    /api/forum/categories/{id}   # Update category
DELETE /api/forum/categories/{id}  # Delete category
GET    /api/forum/categories/{slug}/forums # Get forums by category (paginated)
POST   /api/forum/{id}/attachments # Add attachment
DELETE /api/forum/attachments/{id} # Delete attachment
```

### Support Center

```
# Tickets
GET    /api/support-center/tickets # Get tickets (paginated, default 50/page)
GET    /api/support-center/all-tickets # Get all tickets (Super Admin, paginated)
POST   /api/support-center/tickets # Create ticket
GET    /api/support-center/tickets/{id} # Get ticket detail
PUT    /api/support-center/tickets/{id}/status # Update ticket status
POST   /api/support-center/tickets/{id}/rate # Rate ticket

# Knowledge Base
GET    /api/support-center/knowledge # Get knowledge base
GET    /api/support-center/knowledge/all # Get all knowledge (Super Admin)
POST   /api/support-center/knowledge # Create knowledge
GET    /api/support-center/knowledge/{id} # Get detail
PUT    /api/support-center/knowledge/{id} # Update
DELETE /api/support-center/knowledge/{id} # Delete

# Developers
GET    /api/support-center/developers # Get developers
GET    /api/support-center/developers/{id} # Get developer detail
POST   /api/support-center/developers # Create developer (Super Admin)
PUT    /api/support-center/developers/{id} # Update developer
DELETE /api/support-center/developers/{id} # Delete developer

# Metrics
GET    /api/support-center/metrics # Get metrics
GET    /api/support-center/metrics/ticket-stats # Get ticket statistics
GET    /api/support-center/metrics/priority-stats # Get priority statistics
GET    /api/support-center/metrics/developer-workload # Get developer workload
GET    /api/support-center/metrics/monthly-trends # Get monthly trends

# Public Forms (no auth required)
POST   /api/support-center/bug-report # Submit bug report
POST   /api/support-center/feature-request # Submit feature request
POST   /api/support-center/contact # Submit contact form
```

### Reporting

```
GET    /api/reporting               # Get activity logs (paginated, default 15/page)
GET    /api/reporting/summary       # Get summary statistics
GET    /api/reporting/export        # Export report to Excel
GET    /api/reporting/dosen-csr     # Get dosen CSR report (paginated)
GET    /api/reporting/dosen-pbl     # Get dosen PBL report (paginated)
GET    /api/reporting/jadwal-all    # Get all jadwal
GET    /api/reporting/blok-data-excel # Get blok data for Excel export
```

### Notifications

```
GET    /api/notifications/dosen/{id} # Get notifications for dosen (paginated, default 50/page)
GET    /api/notifications/admin/all  # Get all notifications for admin (paginated)
GET    /api/notifications/admin/stats # Get notification statistics
GET    /api/notifications/pending-dosen # Get pending dosen notifications
POST   /api/notifications/send-reminder # Send reminder notification
POST   /api/notifications/ask-again # Ask again notification
POST   /api/notifications/replace-dosen # Replace dosen notification
POST   /api/notifications/send-status-change # Send status change notification
POST   /api/notifications/approve-reschedule # Approve reschedule
POST   /api/notifications/reject-reschedule # Reject reschedule
POST   /api/notifications/admin/reset # Reset notifications (Super Admin)
```

### WhatsApp

```
POST   /api/whatsapp/send-message   # Send WhatsApp message
GET    /api/whatsapp/settings       # Get WhatsApp settings
PUT    /api/whatsapp/settings       # Update WhatsApp settings
POST   /api/whatsapp/webhook        # Webhook from Wablas (no auth)
```

### Admin

```
GET    /api/admin/dashboard-stats   # Get dashboard statistics (Super Admin)
GET    /api/admin/user-activity-logs # Get user activity logs (paginated)
GET    /api/admin/system-health     # Get system health status
```

### Tahun Ajaran

```
GET    /api/tahun-ajaran            # List tahun ajaran
POST   /api/tahun-ajaran            # Create tahun ajaran
GET    /api/tahun-ajaran/{id}       # Get tahun ajaran detail
PUT    /api/tahun-ajaran/{id}       # Update tahun ajaran
DELETE /api/tahun-ajaran/{id}       # Delete tahun ajaran
POST   /api/tahun-ajaran/{id}/activate # Activate tahun ajaran
GET    /api/tahun-ajaran/active     # Get active tahun ajaran
GET    /api/tahun-ajaran/available-semesters # Get available semesters
POST   /api/tahun-ajaran/{id}/add-semester # Add semester
DELETE /api/tahun-ajaran/{id}/remove-semester/{semesterId} # Remove semester
POST   /api/tahun-ajaran/{id}/activate-semester/{semesterId} # Activate semester
```

### Ruangan

```
GET    /api/ruangan                 # List ruangan
POST   /api/ruangan                 # Create ruangan
GET    /api/ruangan/{id}            # Get ruangan detail
PUT    /api/ruangan/{id}            # Update ruangan
DELETE /api/ruangan/{id}            # Delete ruangan
POST   /api/ruangan/import          # Import ruangan from Excel
GET    /api/ruangan/by-capacity     # Get ruangan by capacity
GET    /api/ruangan/options         # Get ruangan options
```

### Proportional Distribution

```
POST   /api/proportional-distribution/distribute # Distribute assignments
GET    /api/proportional-distribution/status     # Get distribution status
GET    /api/proportional-distribution/results    # Get distribution results
```

### Mahasiswa Veteran

```
GET    /api/mahasiswa-veteran       # Get mahasiswa veteran (paginated)
POST   /api/mahasiswa-veteran/toggle # Toggle veteran status
POST   /api/mahasiswa-veteran/bulk-toggle # Bulk toggle veteran status
GET    /api/mahasiswa-veteran/statistics # Get veteran statistics
POST   /api/mahasiswa-veteran/toggle-multi-veteran # Toggle multi-veteran
POST   /api/mahasiswa-veteran/add-to-semester # Add veteran to semester
POST   /api/mahasiswa-veteran/remove-from-semester # Remove from semester
POST   /api/mahasiswa-veteran/release-from-semester # Release from semester
```

## 🔐 Authentication & Authorization

### Authentication
- **Laravel Sanctum**: Token-based authentication dengan API tokens
- **Session Management**: Redis (Production) / Database (Development)
- **Token Validation**: Middleware `validate.token` untuk validasi token aktif
- **Single-Device Login**: Enforcement dengan `is_logged_in` dan `current_token` tracking
- **Session Expiry**: Auto-logout jika session expired atau token tidak valid
- **Force Logout**: Force logout by token, user ID, atau username

### Authorization
- **Spatie Permission**: Role-based access control (RBAC)
- **Roles**: 
  - `super_admin`: Full access
  - `tim_akademik`: Academic team access
  - `dosen`: Lecturer access
  - `mahasiswa`: Student access
- **Middleware**: 
  - `role:super_admin,tim_akademik` untuk role-based routes
  - `auth:sanctum` untuk authentication
  - `validate.token` untuk token validation

### Rate Limiting
- **Login Endpoint**: 10 requests per minute (mencegah brute force)
- **API Routes**: 120 requests per minute per user/IP (global middleware)
- **Custom Middleware**: `RateLimitMiddleware` dengan per-user atau per-IP tracking
- **Rate Limit Headers**: `X-RateLimit-Limit` dan `X-RateLimit-Remaining` dalam response

### Custom Middleware

**ValidateActiveToken** (`validate.token`):
- Validasi token aktif di setiap request
- Cache user login status untuk optimasi (5 menit TTL)
- Single-device login enforcement
- Auto-logout jika session expired atau device conflict

**RateLimitMiddleware** (`throttle`):
- Rate limiting dengan per-user atau per-IP tracking
- Configurable max attempts dan decay minutes
- Rate limit headers dalam response

**CheckRole** (`role`):
- Role-based route protection
- Multiple roles support (comma-separated)
- Unauthorized response dengan role information

**SanitizeInput** (`sanitize`):
- Input sanitization untuk security
- XSS prevention

**SecurityHeaders** (`security.headers`):
- Security headers untuk HTTP responses
- Applied globally untuk semua routes

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
    ->withProperties(['key' => 'value'])
    ->log('User created new mata kuliah');
```

**Logged Activities:**
- User management (create, update, delete)
- Mata kuliah operations
- PBL assignments
- CSR assignments
- Jadwal changes
- Absensi records
- Penilaian submissions
- Forum posts dan replies
- Support center tickets

**Logs dapat diakses melalui:**
- API: `GET /api/reporting` (paginated, default 15/page)
- Frontend: Halaman Histori dengan filter dan search
- Export: `GET /api/reporting/export` untuk Excel export

**Log Features:**
- Filter by action, module, date range
- Search functionality
- Summary statistics
- Export to Excel

## 📤 Excel Import/Export

### Import

Sistem menggunakan **Maatwebsite Excel** untuk import data:

**Available Imports:**
- `POST /api/users/import-dosen` - Import dosen dari Excel
- `POST /api/users/import-mahasiswa` - Import mahasiswa dari Excel
- `POST /api/users/import-tim-akademik` - Import tim akademik dari Excel
- `POST /api/mata-kuliah/bulk-import` - Bulk import mata kuliah
- `POST /api/ruangan/import` - Import ruangan
- `POST /api/csr/import` - Import CSR
- `POST /api/kelompok-besar/import` - Import kelompok besar
- `POST /api/kelompok-kecil/import` - Import kelompok kecil
- ~~`POST /api/kelas/import` - Import kelas~~ (REMOVED - using Kelompok Kecil directly)
- `POST /api/jadwal-kuliah-besar/import` - Import jadwal kuliah besar
- `POST /api/jadwal-csr/import` - Import jadwal CSR
- `POST /api/jadwal-praktikum/import` - Import jadwal praktikum
- `POST /api/jadwal-jurnal-reading/import` - Import jadwal jurnal reading
- `POST /api/jadwal-persamaan-persepsi/import` - Import jadwal persamaan persepsi
- `POST /api/jadwal-harian/import` - Import jadwal harian
- `POST /api/mata-kuliah-csr/import` - Import mata kuliah CSR
- `POST /api/mata-kuliah-pbl/import` - Import mata kuliah PBL
- `POST /api/mata-kuliah-jurnal-reading/import` - Import mata kuliah jurnal reading

**Import Classes:**
- `DosenImport.php` - Import dosen dengan validasi
- `MahasiswaImport.php` - Import mahasiswa standard
- `HybridMahasiswaImport.php` - Import mahasiswa hybrid
- `SuperFastMahasiswaImport.php` - Import mahasiswa optimized
- `TimAkademikImport.php` - Import tim akademik
- `RuanganImport.php` - Import ruangan

**Import Features:**
- Batch processing untuk large files
- Validation sebelum import
- Error reporting dengan row numbers
- Queue processing untuk large imports (optional)

### Export

**Available Exports:**
- `GET /api/reporting/export` - Export activity logs ke Excel
- `GET /api/reporting/dosen-csr` - Export dosen CSR report
- `GET /api/reporting/dosen-pbl` - Export dosen PBL report
- `GET /api/reporting/blok-data-excel` - Export blok data untuk Excel
- Frontend exports menggunakan ExcelJS/XLSX

**Export Features:**
- Excel format (.xlsx)
- Multiple sheets support
- Styling dan formatting
- Large data handling dengan chunking

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

### Caching Strategy

1. **Redis Caching** (Production):
   - Session storage untuk faster access
   - Cache storage untuk frequently accessed data
   - User login status caching (5 minutes TTL)
   - Cache dengan `Cache::remember()` untuk expensive queries

2. **Database Caching** (Development):
   - Fallback ke database cache jika Redis tidak tersedia
   - Session storage di database
   - Cache storage di database

### Database Optimization

1. **Connection Pooling**:
   - MySQL connection pooling configured
   - `PDO::ATTR_PERSISTENT => false` untuk better pooling
   - Min/Max connection pool settings

2. **Query Optimization**:
   - **Eager Loading**: `with()` untuk menghindari N+1 queries
   - **Select Specific Columns**: Hanya select kolom yang diperlukan
   - **Direct DB Updates**: `DB::table()->update()` untuk avoid model hydration overhead
   - **Batch Operations**: Batch insert/update untuk large datasets

3. **Database Indexing**:
   - Index pada kolom yang sering di-query
   - Foreign key indexes
   - Composite indexes untuk complex queries

### Pagination

1. **API Pagination**:
   - Default 50 items per page
   - Configurable dengan `per_page` parameter
   - Pagination metadata dalam response
   - Frontend handling untuk pagination objects

2. **Pagination Endpoints**:
   - `/api/users` - User list dengan pagination
   - `/api/mata-kuliah-with-materi` - Mata kuliah dengan pagination
   - `/api/forum` - Forum list dengan pagination (default 15/page)
   - `/api/support-center/tickets` - Tickets dengan pagination
   - `/api/reporting` - Activity logs dengan pagination (default 15/page)
   - `/api/notifications/dosen/{id}` - Notifications dengan pagination (default 50/page)

### Rate Limiting

1. **Login Protection**: 10 requests/minute untuk mencegah brute force
2. **Global API Protection**: 120 requests/minute untuk semua authenticated routes
3. **Per-User Tracking**: Rate limit berdasarkan user ID atau IP address

### Activity Logging Optimization

1. **Try-Catch Wrapping**: Activity logging wrapped dalam try-catch untuk tidak membebani response time
2. **Optional Logging**: Activity logging dapat di-disable via config
3. **Queue Processing**: Heavy logging dapat di-queue (optional)

### Frontend Optimization

1. **Pagination Handling**: Frontend components handle pagination responses dengan benar
2. **Batch API Calls**: `Promise.allSettled()` untuk parallel API calls
3. **Lazy Loading**: Code splitting untuk routes besar
4. **Memoization**: `useMemo` dan `useCallback` untuk expensive operations

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
- `laravel/framework`: ^12.28.1 - Core Laravel framework
- `laravel/sanctum`: ^4.2.0 - API token authentication
- `spatie/laravel-permission`: ^6.21.0 - Role & permission management
- `spatie/laravel-activitylog`: ^4.10.2 - Activity logging
- `maatwebsite/excel`: ^3.1.67 - Excel import/export
- `barryvdh/laravel-dompdf`: ^3.1.1 - PDF generation
- `jenssegers/agent`: ^2.6.4 - User agent detection

### Development Dependencies
- `phpunit/phpunit`: ^11.5.39 - Testing framework
- `laravel/pint`: ^1.24.0 - Code style fixer
- `laravel/pail`: ^1.2.3 - Log viewer
- `fakerphp/faker`: ^1.24.1 - Fake data generator
- `mockery/mockery`: ^1.6.12 - Mocking library
- `nunomaduro/collision`: ^8.8.2 - Error handler
- `laravel/sail`: ^1.45.0 - Docker development environment
- `laravel/tinker`: ^2.10.1 - REPL for Laravel

## 🛠️ Artisan Commands

### Development Commands

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

### Cache Commands

```bash
# Clear specific cache
php artisan config:clear    # Clear config cache
php artisan cache:clear      # Clear application cache
php artisan route:clear      # Clear route cache
php artisan view:clear       # Clear view cache

# Cache for production
php artisan config:cache     # Cache configuration
php artisan route:cache      # Cache routes
php artisan view:cache       # Cache views
php artisan optimize         # Cache all (config, routes, views, events)
```

### Database Commands

```bash
# Migrations
php artisan migrate                    # Run migrations
php artisan migrate:fresh              # Drop all tables and re-run migrations
php artisan migrate:fresh --seed       # Fresh migration with seeding
php artisan migrate:rollback           # Rollback last migration
php artisan migrate:status             # Show migration status

# Seeders
php artisan db:seed                    # Run all seeders
php artisan db:seed --class=UserSeeder # Run specific seeder
```

### Storage Commands

```bash
# Create storage link
php artisan storage:link

# Clear storage
php artisan storage:clear
```

### Queue Commands

```bash
# Process queue
php artisan queue:work                  # Process queue jobs
php artisan queue:listen               # Listen for queue jobs (auto-restart)
php artisan queue:work --queue=emails  # Process specific queue

# Queue management
php artisan queue:failed               # List failed jobs
php artisan queue:retry all            # Retry all failed jobs
php artisan queue:flush                # Flush all failed jobs
```

### Environment Setup Commands

```bash
# Setup environment
composer run setup:dev   # Development setup (auto-generate APP_KEY, clear cache)
composer run setup:prod  # Production setup (auto-generate APP_KEY, clear cache)

# Development server dengan queue
composer run dev         # Run server, queue worker, dan vite concurrently
```

## 🔧 Services

### WablasService

Service untuk integrasi WhatsApp via Wablas API:

**Features:**
- Send WhatsApp messages
- Message templates
- Group messaging
- Message status tracking
- Webhook handling
- Logging dan error handling

**Usage:**
```php
use App\Services\WablasService;

$wablas = new WablasService();
$result = $wablas->sendMessage('6281234567890', 'Hello World');
```

### SemesterService

Service untuk manajemen semester:

**Features:**
- Get active semester
- Get available semesters
- Semester validation
- Semester mapping

## 📚 Additional Resources

- [Laravel 12 Documentation](https://laravel.com/docs/12.x)
- [Laravel Sanctum](https://laravel.com/docs/sanctum)
- [Spatie Permission](https://spatie.be/docs/laravel-permission)
- [Spatie Activity Log](https://spatie.be/docs/laravel-activitylog)
- [Maatwebsite Excel](https://docs.laravel-excel.com)
- [Laravel DomPDF](https://github.com/barryvdh/laravel-dompdf)
- [Redis Documentation](https://redis.io/documentation)
- [MySQL Documentation](https://dev.mysql.com/doc/)

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

## ⚡ Performance Optimization

Sistem ini dioptimalkan untuk menangani **1000+ concurrent users** dengan:
- **PHP-FPM**: `max_children = 150`
- **Apache**: `MaxRequestWorkers = 300`
- **MySQL**: `max_connections = 500`
- **Race Condition Fix**: Database lock untuk mencegah race condition saat banyak user login bersamaan
- **Rate Limiting**: 100 requests per minute per IP untuk login endpoint

### Deployment Steps ke VPS

**📋 Lihat panduan deployment di bagian "Deployment Steps ke VPS" di bawah ini**

**Quick Deploy:**
```bash
cd /var/www/isme-fkk && git pull && cd backend && \
composer install --no-dev --optimize-autoloader && \
php artisan migrate --force && \
php artisan config:clear && \
sudo ./fix-permissions.sh
```

**Full Setup (pertama kali):**
1. Deploy perubahan: `git pull`
2. Update dependencies: `composer install --no-dev --optimize-autoloader`
3. Run migrations: `php artisan migrate --force`
4. Fix permissions: `sudo ./fix-permissions.sh`

### Race Condition Fix

**AuthController** sudah diperbaiki dengan database lock untuk mencegah race condition saat banyak user login bersamaan:

```php
// Menggunakan DB::transaction dengan lockForUpdate()
return DB::transaction(function () use ($user, $request) {
    $lockedUser = User::where('id', $user->id)
        ->lockForUpdate() // Pessimistic locking
        ->first();
    // ... rest of login logic
});
```

Ini memastikan hanya satu request yang bisa update user pada saat yang sama, mencegah race condition.

## 🚀 Deployment & VPS Setup

### Setup Permissions untuk VPS

Setelah clone repository dan install dependencies di VPS, **WAJIB** menjalankan script `fix-permissions.sh` untuk memastikan semua permission sudah benar.

**Catatan Penting:**
- Semua command yang melibatkan `chmod` dan `chown` di VPS **WAJIB** menggunakan `sudo`
- File yang baru di-clone mungkin dimiliki oleh user yang melakukan clone, bukan `www-data`
- Script `fix-permissions.sh` akan mengubah ownership ke `www-data:www-data` setelah dijalankan

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
# ⚠️ PENTING: Gunakan sudo karena file mungkin dimiliki oleh root atau www-data
sudo chmod +x fix-permissions.sh

# 3. Jalankan script dengan sudo
sudo ./fix-permissions.sh
```

**Mengapa perlu `sudo` untuk `chmod +x`?**
- Setelah `git clone`, file mungkin dimiliki oleh user yang melakukan clone (bukan `www-data`)
- Untuk memberikan execute permission, perlu akses ke file tersebut
- Jika file dimiliki oleh `root` atau `www-data`, perlu `sudo` untuk mengubah permission
- Lebih aman menggunakan `sudo` untuk memastikan permission bisa diubah
- Setelah script dijalankan, ownership akan diubah ke `www-data:www-data` oleh script itu sendiri

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
**Laravel Version**: 12.28.1  
**PHP Version**: >= 8.2  
**Last Updated**: 11 Desember 2025

