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
- **Mata Kuliah**: Manajemen mata kuliah Blok, Non-Blok, CSR, PBL, dan Jurnal Reading
- **Jadwal**: Sistem jadwal terintegrasi untuk kuliah besar, praktikum, seminar, dan CSR
- **Tahun Ajaran & Semester**: Manajemen tahun ajaran dan semester aktif
- **Ruangan**: Manajemen ruangan dengan validasi kapasitas

### 👥 Manajemen User
- **Multi-Role**: Super Admin, Tim Akademik, Dosen, dan Mahasiswa
- **Role-Based Access Control**: Akses terbatas berdasarkan peran
- **User Management**: CRUD lengkap untuk semua jenis user
- **Import/Export Excel**: Import data user dalam jumlah besar

### 📚 Problem Based Learning (PBL)
- **PBL Generation**: Generate otomatis assignment PBL
- **Kelompok Kecil**: Manajemen kelompok kecil PBL
- **Penilaian PBL**: Sistem penilaian terintegrasi
- **Dashboard PBL**: Monitoring dan tracking PBL

### 🏥 Community Service (CSR)
- **CSR Management**: Manajemen kegiatan CSR
- **Jadwal CSR**: Penjadwalan kegiatan CSR
- **Kelompok CSR**: Manajemen kelompok CSR
- **Reporting CSR**: Laporan kegiatan CSR

### ✅ Sistem Absensi
- **QR Code Attendance**: Absensi menggunakan QR Code
- **Real-time Tracking**: Tracking absensi real-time
- **Multiple Types**: Absensi untuk kuliah besar, praktikum, seminar, CSR
- **Detail Keabsenan**: Detail lengkap keabsenan mahasiswa

### 📊 Penilaian & Evaluasi
- **Penilaian PBL**: Sistem penilaian PBL
- **Seminar Proposal**: Penilaian seminar proposal
- **Sidang Skripsi**: Penilaian sidang skripsi
- **Jurnal Reading**: Penilaian jurnal reading

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
- **Reporting Dosen**: Laporan aktivitas dosen
- **Activity Log**: Log aktivitas sistem
- **Dashboard Analytics**: Dashboard dengan berbagai metrics
- **Export Excel**: Export data ke Excel

### 📱 Integrasi WhatsApp
- **WhatsApp Bot**: Integrasi dengan Wablas API
- **Notifikasi**: Notifikasi via WhatsApp
- **Logs**: Log pesan WhatsApp
- **Settings**: Konfigurasi WhatsApp

### 🔔 Notifikasi
- **Real-time Notifications**: Notifikasi real-time
- **Role-based Notifications**: Notifikasi berdasarkan peran
- **Notification Center**: Pusat notifikasi

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
cp .env.example .env
php artisan key:generate
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
composer run setup:dev

# Frontend
cd frontend
npm run setup:dev
```

### Production
```bash
# Backend
cd backend
composer run setup:prod

# Frontend
cd frontend
npm run setup:prod
npm run build
```

## 📦 Teknologi yang Digunakan

### Backend
- **Laravel 12**: PHP Framework
- **Laravel Sanctum**: API Authentication
- **Spatie Permission**: Role & Permission Management
- **Spatie Activity Log**: Activity Logging
- **Maatwebsite Excel**: Excel Import/Export
- **Laravel DomPDF**: PDF Generation
- **Redis**: Caching & Queue (Production)
- **MySQL**: Database

### Frontend
- **React 18**: UI Framework
- **TypeScript**: Type Safety
- **Vite**: Build Tool
- **Material UI**: UI Components
- **Tailwind CSS**: Styling
- **React Router**: Routing
- **Axios**: HTTP Client
- **ApexCharts**: Charts & Graphs
- **FullCalendar**: Calendar Component
- **TinyMCE**: Rich Text Editor
- **ExcelJS**: Excel Export

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

- **Redis Caching**: Cache untuk session, cache, dan queue (Production)
- **Database Indexing**: Index pada kolom yang sering di-query
- **Pagination**: Pagination untuk data besar
- **Eager Loading**: Optimasi query dengan eager loading
- **Connection Pooling**: MySQL connection pooling
- **Rate Limiting**: Mencegah abuse dan overload

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
- **Email**: support@isme.fkkumj.ac.id
- **Support Center**: Login ke aplikasi dan akses Support Center
- **Documentation**: Lihat dokumentasi di folder `backend/` dan `frontend/`

---

**Version**: 2.0.2  
**Last Updated**: December 2024

