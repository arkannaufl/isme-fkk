# ISME - Integrated System Medical Education

**Sistem Terintegrasi untuk Pendidikan Kedokteran Fakultas Kedokteran dan Kesehatan Universitas Muhammadiyah Jakarta**

[![Laravel](https://img.shields.io/badge/Laravel-12.x-red.svg)](https://laravel.com)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org)
[![PHP](https://img.shields.io/badge/PHP-8.2+-purple.svg)](https://www.php.net)
[![MySQL](https://img.shields.io/badge/MySQL-8.0+-orange.svg)](https://www.mysql.com)
[![Redis](https://img.shields.io/badge/Redis-6.0+-red.svg)](https://redis.io)

## 📋 Deskripsi

ISME adalah sistem manajemen akademik terintegrasi yang dirancang khusus untuk Fakultas Kedokteran dan Kesehatan UMJ. Sistem ini mengelola seluruh aspek pendidikan kedokteran mulai dari manajemen mata kuliah, jadwal, absensi, penilaian, hingga forum diskusi dan support center.

## ✨ Fitur Utama

### 🎓 Manajemen Akademik
- **Mata Kuliah**: 
  - Manajemen mata kuliah Blok, Non-Blok, CSR, PBL, dan Jurnal Reading
  - Upload RPS (Rencana Pembelajaran Semester)
  - Upload Materi Pembelajaran
  - Mapping keahlian dosen ke mata kuliah
  - Peran kurikulum dosen (koordinator, tim blok, dosen mengajar)
- **Jadwal**: 
  - Sistem jadwal terintegrasi untuk kuliah besar, praktikum, seminar, dan CSR
  - Jadwal harian (combined view)
  - Jadwal jurnal reading
  - Jadwal persamaan persepsi
  - Jadwal non-blok non-CSR
  - Jadwal antara (semester antara)
- **Tahun Ajaran & Semester**: 
  - Manajemen tahun ajaran dan semester aktif
  - Semester ganjil/genap
  - Semester antara
  - Activation/deactivation semester
- **Ruangan**: 
  - Manajemen ruangan dengan validasi kapasitas
  - Filter ruangan by capacity
  - Ruangan options untuk assignments
- **Kelas & Kelompok**: 
  - Manajemen kelas per semester
  - Manajemen kelompok besar dan kecil
  - Kelompok antara (semester antara)
  - Assignment mahasiswa ke kelas/kelompok

### 👥 Manajemen User
- **Multi-Role**: Super Admin, Tim Akademik, Dosen, dan Mahasiswa
- **Role-Based Access Control**: Akses terbatas berdasarkan peran
- **User Management**: CRUD lengkap untuk semua jenis user
- **Import/Export Excel**: Import data user dalam jumlah besar
- **Digital Signature**: Signature upload untuk dosen
- **Avatar Upload**: Avatar upload untuk semua user
- **Email Verification**: Email verification untuk dosen
- **Mahasiswa Veteran**: Manajemen mahasiswa veteran dengan multi-semester support
- **User Search**: Advanced search dengan filter
- **Bulk Operations**: Bulk delete dan bulk operations

### 📚 Problem Based Learning (PBL)
- **PBL Generation**: Generate otomatis assignment PBL dengan algoritma
- **PBL Assignment**: Assignment dosen, mahasiswa, kelompok, ruangan, jadwal
- **Kelompok Kecil**: Manajemen kelompok kecil PBL
- **Kelompok Besar**: Manajemen kelompok besar PBL
- **PBL Antara**: PBL untuk semester antara
- **Penilaian PBL**: Sistem penilaian terintegrasi (regular & antara)
- **Dashboard PBL**: Monitoring dan tracking PBL
- **PBL Detail**: Detail PBL dengan semua assignments
- **Proportional Distribution**: Distribusi proporsional untuk assignments

### 🏥 Community Service (CSR)
- **CSR Management**: Manajemen kegiatan CSR
- **Jadwal CSR**: Penjadwalan kegiatan CSR
- **Kelompok CSR**: Manajemen kelompok CSR
- **Reporting CSR**: Laporan kegiatan CSR

### ✅ Sistem Absensi
- **QR Code Attendance**: Absensi menggunakan QR Code dengan html5-qrcode
- **QR Code Generation**: Generate QR code untuk jadwal menggunakan qrcode.react
- **Real-time Tracking**: Tracking absensi real-time
- **Multiple Types**: 
  - Absensi kuliah besar (regular & antara)
  - Absensi praktikum
  - Absensi seminar pleno
  - Absensi CSR
  - Absensi persamaan persepsi
  - Absensi non-blok non-CSR (regular & antara)
- **Detail Keabsenan**: Detail lengkap keabsenan mahasiswa dan dosen
- **Absensi Export**: Export laporan absensi ke PDF/Excel

### 📊 Penilaian & Evaluasi
- **Penilaian PBL**: Sistem penilaian PBL (regular & antara)
- **Seminar Proposal**: Penilaian seminar proposal dengan detail
- **Sidang Skripsi**: Penilaian sidang skripsi dengan detail
- **Jurnal Reading**: Penilaian jurnal reading (regular & antara)
- **Bimbingan Akhir**: Manajemen bimbingan akhir (seminar & sidang)
- **Hasil Penilaian**: View hasil penilaian untuk mahasiswa
- **Export Penilaian**: Export laporan penilaian ke PDF/Excel

### 💬 Forum Diskusi
- **Kategori Forum**: Forum terorganisir berdasarkan kategori
- **Reply & Like**: Sistem reply dan like
- **Bookmark**: Bookmark forum dan reply penting
- **Viewers Tracking**: Tracking pembaca forum

### 🎫 Support Center
- **Ticket System**: Sistem tiket untuk bug report dan feature request
- **Knowledge Base**: Basis pengetahuan untuk FAQ
- **Developer Assignment**: Assignment developer untuk tiket
- **Analytics**: Analytics dan metrics support center

### 📈 Reporting & Analytics
- **Reporting Dosen**: Laporan aktivitas dosen (CSR & PBL reports)
- **Activity Log**: Log aktivitas sistem dengan filter dan search
- **Dashboard Analytics**: Dashboard dengan berbagai metrics per role
- **Export Excel**: Export data ke Excel dengan formatting
- **Summary Statistics**: Summary statistics untuk reporting
- **Filter & Search**: Advanced filtering dan search functionality

### 📱 Integrasi WhatsApp
- **WhatsApp Bot**: Integrasi dengan Wablas API
- **WablasService**: Service untuk send messages, templates, group messaging
- **Notifikasi**: Notifikasi via WhatsApp
- **Webhook**: Webhook handling untuk message status
- **Logs**: Log pesan WhatsApp dengan status tracking
- **Settings**: Konfigurasi WhatsApp (token, secret key, base URL)

### 🔔 Notifikasi
- **Real-time Notifications**: Notifikasi real-time dengan polling
- **Role-based Notifications**: Notifikasi berdasarkan peran (dosen, mahasiswa, admin)
- **Notification Center**: Pusat notifikasi dengan unread count
- **Admin Notifications**: Admin notification management (Super Admin, Tim Akademik)
- **Notification Types**: System, assignment, reminder, status change
- **Notification Actions**: Mark as read, approve, reject, reschedule

## 🏗️ Arsitektur

```
isme-fkk/
├── backend/          # Laravel 12 API Backend
│   ├── app/
│   ├── config/
│   ├── database/
│   └── routes/
├── frontend/         # React 18 + TypeScript Frontend
│   ├── src/
│   │   ├── pages/
│   │   ├── components/
│   │   └── layout/
│   └── public/
└── README.md         # Dokumentasi utama
```

## 🚀 Quick Start

### Prerequisites

- **PHP** >= 8.2
- **Composer** >= 2.0
- **Node.js** >= 20.x
- **MySQL** >= 8.0
- **Redis** >= 6.0 (untuk production)

### Installation

1. **Clone Repository**
```bash
git clone https://github.com/your-org/isme-fkk.git
cd isme-fkk
```

2. **Setup Backend**
```bash
cd backend
composer install

# Setup environment (development - tidak perlu Redis)
composer run setup:dev

# APP_KEY akan auto-generate saat setup (jika kosong)

# Run migrations
php artisan migrate
php artisan db:seed
```

3. **Setup Frontend**
```bash
cd ../frontend
npm install
cp env.example .env
```

4. **Run Development**
```bash
# Backend
cd backend
composer run dev

# Frontend (terminal baru)
cd frontend
npm run dev
```

Lihat dokumentasi lengkap di:
- [Backend Documentation](./backend/README.md)
- [Frontend Documentation](./frontend/README.md)

## 🔧 Environment Setup

### Development
```bash
# Backend
cd backend
composer run setup:dev  # Auto-generate APP_KEY, auto-clear cache, setup email

# Frontend
cd frontend
npm run setup:dev
```

### Production
```bash
# Backend
cd backend
composer run setup:prod  # Auto-generate APP_KEY, auto-clear cache, setup email

# Frontend
cd frontend
npm run setup:prod
npm run build
```

**Fitur Otomatis:**
- ✅ **Auto-generate APP_KEY** - Jika `APP_KEY` kosong, akan di-generate otomatis dengan key unik per environment
- ✅ **Auto-clear cache** - Otomatis clear config, cache, route, dan view cache setelah setup
- ✅ **Email configuration** - Konfigurasi email Gmail sudah ter-setup (smtp.gmail.com:587)

**Email Configuration:**
- Development dan Production menggunakan Gmail SMTP
- Setup Gmail App Password: https://myaccount.google.com/apppasswords
- Email otomatis dikonfigurasi saat menjalankan `composer run setup:dev/prod`

## 🚀 Deployment & VPS Setup

### Setup Permissions untuk VPS

**⚠️ PENTING**: Setelah clone repository dan install dependencies di VPS, **WAJIB** menjalankan script `fix-permissions.sh` untuk memastikan semua permission sudah benar.

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

Script akan otomatis:
- Set ownership semua file ke `www-data:www-data` (web server user)
- Set permission yang benar untuk semua directory
- Test write permissions untuk memastikan web server bisa menulis
- Menampilkan summary dan hasil test

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
| `backend/storage/` | `775` | `www-data:www-data` | ✅ Writable |
| `backend/bootstrap/cache/` | `775` | `www-data:www-data` | ✅ Writable |
| `backend/storage/logs/` | `775` | `www-data:www-data` | ✅ Writable |
| `backend/.env` | `644` | `www-data:www-data` | ✅ Read-only |
| `backend/vendor/` | `755` | `www-data:www-data` | ✅ Read-only |
| `frontend/dist/` | `755` | `www-data:www-data` | ✅ Read-only |

Lihat dokumentasi lengkap di [Backend README](./backend/README.md#-deployment--vps-setup)

## 📦 Teknologi yang Digunakan

### Backend
- **Laravel 12**: PHP Framework dengan arsitektur MVC
- **Laravel Sanctum**: API Token Authentication
- **Spatie Permission**: Role & Permission Management (RBAC)
- **Spatie Activity Log**: Activity Logging untuk audit trail
- **Maatwebsite Excel**: Excel Import/Export (XLSX)
- **Laravel DomPDF**: PDF Generation untuk laporan
- **Jenssegers Agent**: User Agent Detection
- **Redis**: Caching, Session Storage, dan Queue (Production)
- **MySQL 8.0+**: Relational Database dengan connection pooling
- **PHP 8.2+**: Modern PHP dengan type hints dan attributes

### Frontend
- **React 18**: UI Framework dengan hooks dan concurrent features
- **TypeScript 5.7**: Type Safety dan IntelliSense
- **Vite 6**: Build Tool dengan HMR (Hot Module Replacement)
- **Material UI 7**: UI Component Library
- **Tailwind CSS 4**: Utility-first CSS framework
- **React Router 7**: Client-side routing
- **Axios**: HTTP Client dengan interceptors
- **ApexCharts & Recharts**: Charts dan data visualization
- **FullCalendar**: Calendar component untuk jadwal
- **TinyMCE & Quill**: Rich Text Editors
- **ExcelJS & XLSX**: Excel import/export
- **jsPDF & html2canvas**: PDF generation dan screenshot
- **html5-qrcode & qrcode.react**: QR Code generation dan scanning
- **react-signature-canvas**: Digital signature
- **Framer Motion**: Animations dan transitions
- **Headless UI**: Accessible UI components
- **React Beautiful DnD**: Drag and drop functionality
- **Swiper**: Touch slider component
- **date-fns**: Date manipulation library
- **Font Awesome**: Icon library

## 🔐 Security Features

- **Rate Limiting**: 120 requests/minute untuk API, 10 requests/minute untuk login
- **Token-based Authentication**: Laravel Sanctum
- **Role-Based Access Control**: Spatie Permission
- **Session Management**: Redis (Production) / Database (Development)
- **Activity Logging**: Log semua aktivitas penting
- **Input Validation**: Validasi input di backend dan frontend
- **SQL Injection Protection**: Eloquent ORM
- **XSS Protection**: Laravel Blade & React

## 📊 Performance Optimization

### Optimasi untuk 1000+ Users

Sistem ini dioptimalkan untuk menangani **1000+ concurrent users** dengan optimasi konfigurasi server:

**Konfigurasi yang Dioptimalkan:**
- **PHP-FPM**: `max_children = 150` (dari default 5) - Handle 150 request bersamaan
- **Apache**: `MaxRequestWorkers = 300` (dari default 150) - Handle 300 connection bersamaan
- **MySQL**: `max_connections = 500` (dari default 151) - Handle 500 connection bersamaan
- **Race Condition Fix**: Database lock untuk mencegah race condition saat banyak user login bersamaan

**Script Optimasi:**
- `fix-all.sh` - Script terpusat untuk optimasi semua konfigurasi (1x run, auto backup)
- `check-config.sh` - Script untuk checking konfigurasi
- `monitor-login.sh` - Script untuk monitoring real-time

**Cara Menggunakan:**
```bash
cd backend

# 1. Berikan execute permission (perlu sudo)
sudo chmod +x fix-all.sh

# 2. Jalankan script (perlu sudo karena akan ubah config sistem)
sudo ./fix-all.sh  # Run 1x saja, auto backup & fix semua config

# 3. Monitoring (tidak perlu sudo)
sudo chmod +x monitor-login.sh
./monitor-login.sh # Monitoring real-time
```

**Catatan:**
- `sudo chmod +x` diperlukan karena file mungkin dimiliki oleh `root` atau `www-data` setelah clone
- `sudo ./fix-all.sh` diperlukan karena script akan mengubah konfigurasi sistem di `/etc/php/`, `/etc/mysql/`, dan `/etc/apache2/`

Lihat dokumentasi lengkap di [Backend README](./backend/README.md#-performance-optimization-untuk-1000-users)

### Optimasi Aplikasi

- **Redis Caching**: Cache untuk session, cache, dan queue (Production)
- **Database Indexing**: Index pada kolom yang sering di-query
- **Pagination**: Pagination untuk data besar (default 50 items/page)
- **Eager Loading**: Optimasi query dengan eager loading
- **Connection Pooling**: MySQL connection pooling
- **Rate Limiting**: Mencegah abuse dan overload (120 req/min untuk API, 10 req/min untuk login)
- **Query Optimization**: Direct DB updates, batch operations, select specific columns

## 🧪 Testing

```bash
# Backend Tests
cd backend
composer run test

# Frontend Linting
cd frontend
npm run lint
```

## 📝 API Documentation

API menggunakan RESTful architecture. Base URL:
- **Development**: `http://localhost:8000/api`
- **Production**: `https://isme.fkkumj.ac.id/api`

Lihat dokumentasi lengkap API di [Backend README](./backend/README.md#api-endpoints)

## 🤝 Contributing

1. Fork repository
2. Create feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👥 Authors

- **Development Team** - Fakultas Kedokteran dan Kesehatan UMJ

## 🙏 Acknowledgments

- Fakultas Kedokteran dan Kesehatan Universitas Muhammadiyah Jakarta
- Semua kontributor dan pengguna sistem

## 📞 Support

Untuk support dan pertanyaan:
- **Support Center**: Login ke aplikasi dan akses Support Center
- **Documentation**: Lihat dokumentasi di folder `backend/` dan `frontend/`

---

**Version**: 2.0.2  
**Last Updated**: 11 Desember 2025

