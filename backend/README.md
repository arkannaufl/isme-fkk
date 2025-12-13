# ISME Backend API

**Laravel 12 RESTful API for Integrated System Medical Education**

[![Laravel](https://img.shields.io/badge/Laravel-12.28.1-red.svg)](https://laravel.com)
[![PHP](https://img.shields.io/badge/PHP-8.2+-purple.svg)](https://www.php.net)
[![MySQL](https://img.shields.io/badge/MySQL-8.0+-orange.svg)](https://www.mysql.com)
[![Redis](https://img.shields.io/badge/Redis-6.0+-red.svg)](https://redis.io)

---

## 1. Backend Purpose and Responsibilities

The ISME backend is a RESTful API service that provides the core business logic and data management layer for an academic information system designed for medical education institutions. It serves as the single source of truth for all academic operations, handling:

- **Academic Data Management**: Course administration, scheduling, student-faculty assignments, and assessment workflows
- **Authentication & Authorization**: Token-based authentication with single-device login enforcement and role-based access control
- **Business Logic Processing**: Complex algorithms for PBL assignment generation, conflict detection, and proportional distribution
- **Data Persistence**: 65+ database tables with complex relationships managed through Eloquent ORM
- **Activity Logging**: Comprehensive audit trail for compliance and accountability
- **Third-Party Integration**: WhatsApp notifications via Wablas API, email services, and Excel import/export
- **Performance Optimization**: Caching strategies, connection pooling, and query optimization for 1000+ concurrent users

The backend operates independently from the frontend, communicating via JSON over HTTPS. It enforces business rules, validates all inputs, and maintains data integrity through database transactions and pessimistic locking.

---

## 2. Architecture Pattern

### RESTful API Architecture

The backend follows RESTful principles with resource-based routing:

- **Stateless**: Each request contains all necessary authentication and context
- **Resource-Oriented**: URLs represent resources (e.g., `/api/users`, `/api/mata-kuliah`)
- **HTTP Methods**: Standard CRUD operations mapped to HTTP verbs (GET, POST, PUT, PATCH, DELETE)
- **JSON Responses**: All responses in JSON format with consistent structure
- **Status Codes**: Appropriate HTTP status codes (200, 201, 400, 401, 403, 404, 422, 429, 500)

### Request Flow

```
Client Request
    ↓
API Gateway (routes/api.php)
    ↓
Middleware Stack
    ├── Rate Limiting (throttle:120,1)
    ├── Authentication (auth:sanctum)
    ├── Token Validation (validate.token)
    ├── Input Sanitization (sanitize.input)
    ├── Security Headers (security.headers)
    └── Role Authorization (role:roles)
    ↓
Controller
    ├── Request Validation
    ├── Business Logic
    ├── Service Layer (optional)
    └── Model Interaction
    ↓
Database (MySQL)
    ↓
Response (JSON)
```

### Layered Architecture

- **Presentation Layer**: Controllers handle HTTP requests/responses
- **Business Logic Layer**: Controllers and Services contain domain logic
- **Data Access Layer**: Eloquent Models abstract database operations
- **Infrastructure Layer**: Middleware, queues, caching, and external services

---

## 3. Authentication and Authorization Mechanism

### Authentication: Laravel Sanctum Token-Based

**Token Generation:**
- Tokens created via `$user->createToken('auth_token')->plainTextToken`
- Stored in `personal_access_tokens` table
- Bearer token sent in `Authorization: Bearer {token}` header

**Login Process:**
```php
// Pessimistic locking prevents race conditions
DB::transaction(function () use ($user) {
    $lockedUser = User::where('id', $user->id)
        ->lockForUpdate()
        ->first();
    
    if ($lockedUser->is_logged_in) {
        return response()->json(['message' => 'Already logged in'], 403);
    }
    
    $token = $lockedUser->createToken('auth_token')->plainTextToken;
    $lockedUser->update([
        'is_logged_in' => 1,
        'current_token' => $token,
    ]);
    
    return response()->json(['access_token' => $token]);
});
```

**Single-Device Login Enforcement:**
- `is_logged_in` flag in `users` table prevents concurrent logins
- `current_token` stores the active token
- `ValidateActiveToken` middleware checks token on every request
- Cache-based optimization (5-minute TTL) reduces database queries

**Token Validation Middleware:**
```php
// ValidateActiveToken.php
- Checks if user is authenticated
- Validates token matches current_token
- Verifies is_logged_in flag
- Returns 401 if token invalid or user logged out
```

**Rate Limiting:**
- Login endpoint: 100 requests/minute (prevents brute force)
- All authenticated endpoints: 120 requests/minute per user/IP
- Custom `RateLimitMiddleware` for fine-grained control

### Authorization: Role-Based Access Control (RBAC)

**Role System:**
- Enum-based roles stored in `users.role` column
- Four primary roles: `super_admin`, `tim_akademik`, `dosen`, `mahasiswa`
- Additional role: `ketua_ikd` (IKD unit head)

**CheckRole Middleware:**
```php
// Checks if authenticated user has required role(s)
public function handle(Request $request, Closure $next, ...$roles)
{
    if (!in_array($user->role, $roles)) {
        return response()->json(['message' => 'Access denied'], 403);
    }
    return $next($request);
}
```

**Route Protection:**
```php
// Single role
Route::middleware(['auth:sanctum', 'validate.token', 'role:super_admin'])
    ->get('/admin/users', [UserController::class, 'index']);

// Multiple roles
Route::middleware(['auth:sanctum', 'validate.token', 'role:super_admin,tim_akademik'])
    ->apiResource('mata-kuliah', MataKuliahController::class);
```

**Future-Ready:**
- Spatie Permission package installed but not fully utilized
- Current implementation uses simple enum-based roles
- Can migrate to granular permissions when needed

---

## 4. Role-Based Access Control Logic

### Role Hierarchy and Permissions

| Role | Access Level | Key Capabilities |
|------|-------------|------------------|
| **super_admin** | Full System Access | All CRUD operations, user management, system configuration, IKD management, support center administration, Excel imports |
| **tim_akademik** | Academic Management | Course management, schedule administration, PBL/CSR assignment, academic reporting, student-faculty coordination |
| **dosen** | Teaching Operations | Schedule confirmation, attendance taking, grade submission, course material access, own profile management |
| **mahasiswa** | Student Operations | Schedule viewing, attendance submission, grade viewing, forum participation, own profile management |
| **ketua_ikd** | IKD Unit Management | IKD pedoman poin management, unit-specific rekap access, bukti fisik management |

### Access Control Implementation

**Middleware Chain:**
1. `auth:sanctum` - Verifies token exists and is valid
2. `validate.token` - Ensures token matches current_token and user is logged in
3. `role:roles` - Checks user role against required roles

**Controller-Level Authorization:**
- Controllers check roles in constructor or methods
- Resource controllers use middleware for route-level protection
- Custom authorization logic in controllers for complex scenarios

**Frontend-Backend Coordination:**
- Frontend receives user role in login response
- Frontend implements `RequireAuth` and `RequireDosenRole` components
- Backend always validates authorization regardless of frontend checks

---

## 5. Main API Modules and Endpoints

### Authentication Module

**Base Path:** `/api`

| Endpoint | Method | Auth | Description |
|----------|--------|------|-------------|
| `/login` | POST | Public | User authentication (rate limit: 100/min) |
| `/logout` | POST | Required | Logout current session |
| `/me` | GET | Required | Get current authenticated user |
| `/profile` | GET/PUT | Required | Get/update user profile |
| `/profile/avatar` | POST | Required | Update user avatar |
| `/force-logout-by-token` | POST | Public | Force logout by token |
| `/force-logout-by-user` | POST | Required | Force logout by user ID (admin) |
| `/force-logout-by-username` | POST | Required | Force logout by username (admin) |

### User Management Module

**Base Path:** `/api/users`

| Endpoint | Method | Roles | Description |
|----------|--------|-------|-------------|
| `/users` | GET | super_admin, tim_akademik, dosen | List users with pagination and filters |
| `/users/{id}` | GET | super_admin, tim_akademik, dosen | Get user details |
| `/users` | POST | super_admin, tim_akademik, dosen | Create new user |
| `/users/{id}` | PUT/PATCH | super_admin, tim_akademik, dosen | Update user |
| `/users/{id}` | DELETE | super_admin | Delete user |
| `/users/search` | GET | Required | Search users by query |
| `/users/import-dosen` | POST | super_admin | Bulk import dosen from Excel |
| `/users/import-mahasiswa` | POST | super_admin | Bulk import mahasiswa from Excel |
| `/users/import-tim-akademik` | POST | super_admin | Bulk import tim akademik from Excel |
| `/users/{id}/jadwal-mengajar` | GET | Required | Get teaching schedule for dosen |

### Academic Management Module

**Mata Kuliah (Courses):**
- `GET /api/mata-kuliah` - List courses
- `POST /api/mata-kuliah` - Create course
- `GET /api/mata-kuliah/{id}` - Get course details
- `PUT /api/mata-kuliah/{id}` - Update course
- `DELETE /api/mata-kuliah/{id}` - Delete course
- `GET /api/mata-kuliah/filter-options` - Get filter options
- `GET /api/mata-kuliah/peran-kurikulum-options` - Get role options
- `GET /api/mata-kuliah/keahlian-options` - Get expertise options

**Tahun Ajaran & Semester:**
- `GET /api/tahun-ajaran` - List academic years
- `POST /api/tahun-ajaran` - Create academic year
- `DELETE /api/tahun-ajaran/{id}` - Delete academic year
- `POST /api/tahun-ajaran/{id}/activate` - Activate academic year
- `POST /api/semesters/{semester}/activate` - Activate semester
- `GET /api/tahun-ajaran/active` - Get active academic year
- `GET /api/tahun-ajaran/available-semesters` - Get available semesters

**Ruangan (Rooms):**
- `GET /api/ruangan` - List rooms with capacity filtering
- `POST /api/ruangan` - Create room
- `GET /api/ruangan/{id}` - Get room details
- `PUT /api/ruangan/{id}` - Update room
- `DELETE /api/ruangan/{id}` - Delete room

### Scheduling Module

**Jadwal Kuliah Besar (Large Class Schedules):**
- `GET /api/jadwal-kuliah-besar` - List schedules
- `POST /api/jadwal-kuliah-besar` - Create schedule
- `GET /api/jadwal-kuliah-besar/{id}` - Get schedule details
- `PUT /api/jadwal-kuliah-besar/{id}` - Update schedule
- `DELETE /api/jadwal-kuliah-besar/{id}` - Delete schedule
- `POST /api/jadwal-kuliah-besar/{id}/confirm` - Confirm schedule (dosen)
- `POST /api/jadwal-kuliah-besar/{id}/reschedule` - Request reschedule

**Jadwal Praktikum (Practicum Schedules):**
- `GET /api/jadwal-praktikum` - List practicum schedules
- `POST /api/jadwal-praktikum` - Create practicum schedule
- `GET /api/jadwal-praktikum/{id}` - Get schedule details
- `PUT /api/jadwal-praktikum/{id}` - Update schedule
- `DELETE /api/jadwal-praktikum/{id}` - Delete schedule
- `POST /api/jadwal-praktikum/{id}/assign-dosen` - Assign dosen
- `POST /api/jadwal-praktikum/{id}/generate-qr` - Generate QR code

**Jadwal PBL (PBL Schedules):**
- `GET /api/jadwal-pbl` - List PBL schedules
- `POST /api/jadwal-pbl` - Create PBL schedule
- `GET /api/jadwal-pbl/{id}` - Get schedule details
- `PUT /api/jadwal-pbl/{id}` - Update schedule
- `DELETE /api/jadwal-pbl/{id}` - Delete schedule
- `GET /api/pbls/{pblId}/jadwal` - Get schedules by PBL ID

**Jadwal CSR (Community Service Schedules):**
- `GET /api/jadwal-csr` - List CSR schedules
- `POST /api/jadwal-csr` - Create CSR schedule
- `GET /api/jadwal-csr/{id}` - Get schedule details
- `PUT /api/jadwal-csr/{id}` - Update schedule
- `DELETE /api/jadwal-csr/{id}` - Delete schedule

**Jadwal Jurnal Reading:**
- `GET /api/jadwal-jurnal-reading` - List journal reading schedules
- `POST /api/jadwal-jurnal-reading` - Create schedule
- `GET /api/jadwal-jurnal-reading/{id}` - Get schedule details
- `PUT /api/jadwal-jurnal-reading/{id}` - Update schedule
- `DELETE /api/jadwal-jurnal-reading/{id}` - Delete schedule

**Jadwal Harian (Daily Combined Schedule):**
- `GET /api/jadwal-harian` - Get combined daily schedule
- `GET /api/jadwal-harian/{date}` - Get schedule for specific date

### PBL Management Module

**PBL Generation:**
- `POST /api/pbls/generate` - Generate PBL assignments algorithmically
- `GET /api/pbls/check-blok/{blokId}` - Check if PBL already generated for blok
- `POST /api/pbls/assign-dosen-batch` - Batch assign dosen to PBL
- `POST /api/pbls/reset-dosen-batch` - Reset dosen assignments

**PBL Assignment:**
- `POST /api/pbls/{pbl}/assign-dosen` - Assign dosen to PBL
- `DELETE /api/pbls/{pbl}/unassign-dosen/{dosen}` - Unassign dosen
- `GET /api/pbls/{pbl}/assigned-dosen` - Get assigned dosen
- `POST /api/pbls/assigned-dosen-batch` - Batch get assigned dosen
- `DELETE /api/pbls/{pbl}/reset-dosen` - Reset all dosen assignments
- `GET /api/dosen/{dosenId}/pbl-assignments` - Get dosen PBL assignments

**PBL Mata Kuliah:**
- `GET /api/mata-kuliah/{mataKuliah}/pbls` - Get PBLs for course
- `POST /api/mata-kuliah/{mataKuliah}/pbls` - Create PBL for course
- `GET /api/pbls/all` - Get all PBLs
- `GET /api/pbls` - Get all PBLs (alternative endpoint)

### CSR Management Module

- `GET /api/csr` - List CSR activities
- `POST /api/csr` - Create CSR activity
- `GET /api/csr/{id}` - Get CSR details
- `PUT /api/csr/{id}` - Update CSR
- `DELETE /api/csr/{id}` - Delete CSR
- `GET /api/csrs` - Batch get CSRs
- `GET /api/csr/{csr}/mappings` - Get CSR-dosen mappings
- `POST /api/csr/{csr}/mappings` - Create mapping
- `DELETE /api/csr/{csr}/mappings/{dosen}/{keahlian}` - Delete mapping
- `DELETE /api/dosen/{dosenId}/csr-assignments` - Delete dosen CSR assignments

### Attendance Module

**Absensi Kuliah Besar:**
- `GET /api/absensi-kuliah-besar` - List attendance records
- `POST /api/absensi-kuliah-besar` - Create attendance record
- `GET /api/absensi-kuliah-besar/{id}` - Get attendance details
- `PUT /api/absensi-kuliah-besar/{id}` - Update attendance
- `POST /api/absensi-kuliah-besar/scan-qr` - Scan QR code for attendance

**Absensi Praktikum:**
- `GET /api/absensi-praktikum` - List practicum attendance
- `POST /api/absensi-praktikum` - Create attendance record
- `GET /api/absensi-praktikum/{id}` - Get attendance details
- `PUT /api/absensi-praktikum/{id}` - Update attendance

**Absensi PBL:**
- `GET /api/absensi-pbl` - List PBL attendance
- `POST /api/absensi-pbl` - Create attendance record
- `GET /api/absensi-pbl/{id}` - Get attendance details

**Absensi CSR:**
- `GET /api/absensi-csr` - List CSR attendance
- `POST /api/absensi-csr` - Create attendance record

### Assessment Module

**Penilaian PBL:**
- `GET /api/penilaian-pbl` - List PBL assessments
- `POST /api/penilaian-pbl` - Submit PBL assessment
- `GET /api/penilaian-pbl/{id}` - Get assessment details
- `PUT /api/penilaian-pbl/{id}` - Update assessment
- `POST /api/penilaian-pbl/{id}/finalize` - Finalize assessment

**Penilaian Seminar Proposal:**
- `GET /api/penilaian-seminar-proposal` - List seminar assessments
- `POST /api/penilaian-seminar-proposal` - Submit assessment
- `GET /api/penilaian-seminar-proposal/{id}` - Get assessment details

**Penilaian Sidang Skripsi:**
- `GET /api/penilaian-sidang-skripsi` - List thesis defense assessments
- `POST /api/penilaian-sidang-skripsi` - Submit assessment
- `GET /api/penilaian-sidang-skripsi/{id}` - Get assessment details

**Penilaian Jurnal Reading:**
- `GET /api/penilaian-jurnal-reading` - List journal reading assessments
- `POST /api/penilaian-jurnal-reading` - Submit assessment

### Forum Module

- `GET /api/forum` - List forum posts
- `POST /api/forum` - Create forum post
- `GET /api/forum/{id}` - Get forum post details
- `PUT /api/forum/{id}` - Update forum post
- `DELETE /api/forum/{id}` - Delete forum post
- `POST /api/forum/{id}/reply` - Reply to forum post
- `POST /api/forum/{id}/like` - Like forum post
- `POST /api/forum/{id}/bookmark` - Bookmark forum post

### Support Center Module

**Tickets:**
- `GET /api/tickets` - List support tickets
- `POST /api/tickets` - Create ticket
- `GET /api/tickets/{id}` - Get ticket details
- `PUT /api/tickets/{id}` - Update ticket
- `POST /api/tickets/{id}/assign-developer` - Assign developer

**Knowledge Base:**
- `GET /api/knowledge` - List knowledge base articles
- `POST /api/knowledge` - Create article
- `GET /api/knowledge/{id}` - Get article details
- `PUT /api/knowledge/{id}` - Update article

### Reporting Module

- `GET /api/reporting` - List activity logs (paginated, default 15/page)
- `GET /api/reporting/summary` - Get summary statistics
- `GET /api/reporting/export` - Export logs to Excel
- `GET /api/reporting/dosen-csr` - Get dosen CSR report
- `GET /api/reporting/dosen-pbl` - Get dosen PBL report
- `GET /api/reporting/jadwal-all` - Get all schedules report
- `GET /api/reporting/blok-data-excel` - Get blok data for Excel export

### Dashboard Module

- `GET /api/dashboard/super-admin` - Super admin dashboard statistics
- `GET /api/dashboard/tim-akademik` - Tim akademik dashboard statistics
- `GET /api/dashboard/dosen` - Dosen dashboard statistics
- `GET /api/dashboard/mahasiswa` - Mahasiswa dashboard statistics

### WhatsApp Integration Module

- `POST /api/whatsapp/send` - Send WhatsApp message
- `POST /api/whatsapp/send-template` - Send template message
- `POST /api/whatsapp/send-group` - Send group message
- `GET /api/whatsapp/logs` - Get message logs
- `POST /api/whatsapp/webhook` - Webhook for message status

### IKD Management Module

- `GET /api/rekap-ikd` - List IKD rekap
- `POST /api/rekap-ikd` - Create IKD rekap
- `GET /api/rekap-ikd/{id}` - Get IKD rekap details
- `PUT /api/rekap-ikd/{id}` - Update IKD rekap
- `GET /api/rekap-ikd/pedoman-poin` - Get pedoman poin options

---

## 6. Database Design Overview

### Database Technology

- **RDBMS**: MySQL 8.0+
- **ORM**: Laravel Eloquent
- **Connection Pooling**: Enabled (`sticky => true`, `PDO::ATTR_PERSISTENT => false`)
- **Charset**: utf8mb4 (supports full Unicode including emojis)
- **Collation**: utf8mb4_unicode_ci

### Schema Statistics

- **Total Tables**: 65+ tables
- **Total Migrations**: 130+ migration files
- **Relationships**: Complex many-to-many, one-to-many, and polymorphic relationships

### Core Tables

**User & Authentication:**
- `users` - User accounts with roles, academic info, veteran status
- `personal_access_tokens` - Laravel Sanctum tokens
- `password_reset_tokens` - Password reset tokens
- `sessions` - Session storage (database driver)

**Academic Management:**
- `tahun_ajaran` - Academic years
- `semesters` - Semester definitions (Ganjil, Genap, Antara)
- `mata_kuliah` - Course master data
- `mata_kuliah_csr` - CSR course definitions
- `mata_kuliah_pbl` - PBL course definitions
- `mata_kuliah_jurnal_reading` - Journal reading course definitions
- `ruangan` - Room master data with capacity

**Scheduling:**
- `jadwal_kuliah_besar` - Large class schedules
- `jadwal_praktikum` - Practicum schedules
- `jadwal_pbl` - PBL schedules
- `jadwal_csr` - CSR schedules
- `jadwal_jurnal_reading` - Journal reading schedules
- `jadwal_non_blok_non_csr` - Non-blok non-CSR schedules
- `jadwal_agenda_khusus` - Special agenda schedules
- `jadwal_persamaan_persepsi` - Perception alignment schedules
- `jadwal_praktikum_dosen` - Pivot table for practicum-dosen many-to-many
- `riwayat_konfirmasi_dosen` - Dosen confirmation history

**Groups:**
- `kelompok_besar` - Large groups (PBL)
- `kelompok_kecil` - Small groups (PBL, Practicum)
- `kelompok_besar_antara` - Inter-semester large groups
- `kelompok_kecil_antara` - Inter-semester small groups
- `kelompok_csr` - CSR groups

**Attendance:**
- `absensi_kuliah_besar` - Large class attendance
- `absensi_praktikum` - Practicum attendance
- `absensi_pbl` - PBL attendance
- `absensi_csr` - CSR attendance
- `absensi_jurnal_reading` - Journal reading attendance
- `absensi_non_blok_non_csr` - Non-blok non-CSR attendance
- `absensi_persamaan_persepsi` - Perception alignment attendance
- `absensi_agenda_khusus` - Special agenda attendance
- `absensi_dosen_praktikum` - Dosen practicum attendance

**Assessment:**
- `penilaian_pbl` - PBL assessments
- `penilaian_seminar_proposal` - Seminar proposal assessments
- `penilaian_sidang_skripsi` - Thesis defense assessments
- `penilaian_jurnal_reading` - Journal reading assessments

**Forum & Support:**
- `forum` - Forum posts
- `forum_replies` - Forum replies
- `forum_likes` - Forum likes
- `forum_bookmarks` - Forum bookmarks
- `tickets` - Support tickets
- `knowledge_base` - Knowledge base articles

**System:**
- `activity_log` - Spatie Activity Log (audit trail)
- `jobs` - Queue jobs
- `failed_jobs` - Failed queue jobs
- `job_batches` - Job batches
- `cache` - Cache storage (database driver)
- `cache_locks` - Cache locks

**IKD:**
- `rekap_ikd` - IKD rekap records
- `ikd_pedoman_poin` - IKD pedoman poin definitions

### Key Relationships

**User Relationships:**
- `User` has many `DosenPeran` (dosen roles in courses)
- `User` belongs to many `JadwalPraktikum` (via pivot)
- `User` has many `AbsensiKuliahBesar`, `AbsensiPraktikum`, etc.

**Course Relationships:**
- `MataKuliah` has many `MataKuliahPBL`, `MataKuliahCSR`, `MataKuliahJurnalReading`
- `MataKuliah` has many `JadwalKuliahBesar`, `JadwalPraktikum`

**Schedule Relationships:**
- `JadwalPraktikum` belongs to `MataKuliah`, `Ruangan`, `KelompokKecil`
- `JadwalPraktikum` belongs to many `User` (dosen) via pivot
- `JadwalPBL` belongs to `MataKuliahPBL`, `KelompokBesar`, `Ruangan`

**Group Relationships:**
- `KelompokBesar` has many `KelompokKecil`
- `KelompokKecil` belongs to `KelompokBesar`
- `KelompokKecil` has many `JadwalPraktikum`

### Database Conventions

- **Primary Keys**: `id` (auto-incrementing integer)
- **Foreign Keys**: `{table}_id` (e.g., `mata_kuliah_kode`, `ruangan_id`)
- **Timestamps**: `created_at`, `updated_at` (Laravel convention)
- **Soft Deletes**: Not used (hard deletes with activity logging)
- **Naming**: Snake_case for table and column names
- **Indexes**: Foreign keys automatically indexed, additional indexes on frequently queried columns

---

## 7. Environment Configuration

### Environment File Structure

The backend uses `.env` file for configuration. Setup scripts (`setup-env.php`, `composer run setup:dev/prod`) manage environment configuration.

### Critical Environment Variables

**Application:**
```env
APP_NAME=Isme
APP_ENV=local                    # local | production
APP_KEY=base64:...              # Auto-generated if empty
APP_DEBUG=true                  # false in production
APP_URL=http://localhost        # Production: https://isme.fkkumj.ac.id
```

**Database:**
```env
DB_CONNECTION=mysql
DB_HOST=127.0.0.1
DB_PORT=3306
DB_DATABASE=isme-db-local       # Production: isme-db
DB_USERNAME=root                # Production: isme-fkk
DB_PASSWORD=                    # Production: Ism3fkk@2025
```

**Cache & Session:**
```env
# Development
CACHE_STORE=database
SESSION_DRIVER=database
QUEUE_CONNECTION=database

# Production
CACHE_STORE=redis
SESSION_DRIVER=redis
QUEUE_CONNECTION=redis
```

**Redis (Production):**
```env
REDIS_CLIENT=phpredis
REDIS_HOST=127.0.0.1
REDIS_PASSWORD=null
REDIS_PORT=6379
REDIS_DB=0                      # Default database
REDIS_CACHE_DB=1                # Cache database (separate from default)
```

**Email (Gmail SMTP):**
```env
MAIL_MAILER=smtp
MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_USERNAME=epicgsnew20@gmail.com
MAIL_PASSWORD="gpon stlr elhd rmcx"  # Gmail App Password
MAIL_FROM_ADDRESS="epicgsnew20@gmail.com"
MAIL_FROM_NAME="${APP_NAME}"
```

**WhatsApp (Wablas API):**
```env
WABLAS_TOKEN=8nJAtEBEAggiJRZ4sii7wsTlbhEcDBXJnvPa9PZto5LN9n7U9nf3rZ3
WABLAS_SECRET_KEY=W6hDTKYG
WABLAS_BASE_URL=https://tegal.wablas.com/api
WABLAS_ENABLED=true
```

### Environment Setup Commands

**Development Setup:**
```bash
composer run setup:dev
# - Copies .env.development to .env
# - Auto-generates APP_KEY if empty
# - Sets CACHE_STORE=database, SESSION_DRIVER=database, QUEUE_CONNECTION=database
# - Clears all caches
```

**Production Setup:**
```bash
composer run setup:prod
# - Copies .env.production to .env
# - Auto-generates APP_KEY if empty
# - Sets CACHE_STORE=redis, SESSION_DRIVER=redis, QUEUE_CONNECTION=redis
# - Clears all caches
```

### Configuration Files

- `config/database.php` - Database connections and pooling
- `config/cache.php` - Cache stores (database/redis)
- `config/session.php` - Session drivers (database/redis)
- `config/queue.php` - Queue connections (database/redis)
- `config/auth.php` - Authentication configuration
- `config/permission.php` - Spatie Permission config
- `config/activitylog.php` - Spatie Activity Log config

---

## 8. Installation and Local Setup Steps

### Prerequisites

- **PHP**: >= 8.2 with extensions: `pdo_mysql`, `mbstring`, `xml`, `curl`, `zip`, `gd`, `redis`
- **Composer**: >= 2.0
- **MySQL**: >= 8.0
- **Redis**: >= 6.0 (optional for development, required for production)
- **Node.js**: >= 20.x (for frontend, not required for backend only)

### Installation Steps

**1. Clone Repository:**
```bash
git clone <repository-url>
cd isme-fkk/backend
```

**2. Install Dependencies:**
```bash
composer install
```

**3. Environment Setup:**
```bash
# Development (uses database cache, no Redis needed)
composer run setup:dev

# OR Production (requires Redis)
composer run setup:prod
```

**4. Database Setup:**
```bash
# Create database manually or update .env with existing database
# Then run migrations
php artisan migrate

# Seed database with initial data
php artisan db:seed
```

**5. Storage Link:**
```bash
# Create symbolic link for public storage
php artisan storage:link
```

**6. Permissions (Linux/Mac):**
```bash
# Set proper permissions for storage and cache
chmod -R 775 storage bootstrap/cache
chown -R www-data:www-data storage bootstrap/cache
```

**7. Start Development Server:**
```bash
# Option 1: Using composer script (runs server + queue worker)
composer run dev

# Option 2: Manual (separate terminals)
# Terminal 1: API server
php artisan serve

# Terminal 2: Queue worker (if using queues)
php artisan queue:work
```

### Verification

**Test API:**
```bash
# Health check (should return 401 Unauthorized - expected)
curl http://localhost:8000/api/me

# Login test
curl -X POST http://localhost:8000/api/login \
  -H "Content-Type: application/json" \
  -d '{"login":"testuser","password":"password"}'
```

**Check Database:**
```bash
php artisan tinker
>>> DB::connection()->getDatabaseName();
>>> User::count();
```

### Common Issues

**Issue: APP_KEY not set**
- Solution: Run `composer run setup:dev` or `php artisan key:generate`

**Issue: Database connection error**
- Solution: Check `.env` database credentials, ensure MySQL is running

**Issue: Permission denied (storage)**
- Solution: Run `chmod -R 775 storage bootstrap/cache` (Linux/Mac) or use `fix-permissions.sh`

**Issue: Redis connection error (production)**
- Solution: Ensure Redis is installed and running, check `REDIS_HOST` and `REDIS_PORT` in `.env`

---

## 9. Queue, Job, Scheduler, and Background Processes

### Queue System

**Queue Drivers:**
- **Development**: `database` (stores jobs in `jobs` table)
- **Production**: `redis` (stores jobs in Redis)

**Queue Configuration:**
```php
// config/queue.php
'default' => env('QUEUE_CONNECTION', 'database'),
'connections' => [
    'database' => [
        'driver' => 'database',
        'table' => 'jobs',
        'retry_after' => 90,
    ],
    'redis' => [
        'driver' => 'redis',
        'connection' => 'default',
        'queue' => 'default',
        'retry_after' => 90,
    ],
],
```

**Queue Tables:**
- `jobs` - Pending jobs
- `failed_jobs` - Failed jobs with exceptions
- `job_batches` - Job batches for batch processing

**Queue Worker Commands:**
```bash
# Process queue jobs (one-time)
php artisan queue:work

# Listen for queue jobs (auto-restart on code changes)
php artisan queue:listen

# Process specific queue
php artisan queue:work --queue=emails,notifications

# Retry failed jobs
php artisan queue:retry all

# List failed jobs
php artisan queue:failed

# Flush failed jobs
php artisan queue:flush
```

**Supervisor Configuration (Production):**
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

**Current Queue Usage:**
- Currently, the system is configured for queues but most operations are synchronous
- Queues are ready for: email notifications, WhatsApp messages, heavy Excel imports
- Future implementation: Move heavy operations to queues

### Artisan Commands

**Custom Commands:**
- `php artisan reset:schedules-notifications` - Reset all schedules and notifications (with confirmation)
- `php artisan seed:mata-kuliah-keahlian` - Seed mata kuliah keahlian data
- `php artisan seed:mata-kuliah-antara` - Seed inter-semester mata kuliah
- `php artisan cleanup:duplicate-jadwal` - Cleanup duplicate schedules

**Command Usage:**
```bash
# Reset schedules (with confirmation prompt)
php artisan reset:schedules-notifications

# Skip confirmation
php artisan reset:schedules-notifications --confirm
```

### Scheduled Tasks

**Current Status:**
- No scheduled tasks configured in `app/Console/Kernel.php`
- Laravel scheduler is available but not actively used
- Can be configured for: daily reports, cache cleanup, data archiving

**Scheduler Setup (Future):**
```php
// app/Console/Kernel.php
protected function schedule(Schedule $schedule)
{
    $schedule->command('cache:clear')->daily();
    $schedule->command('queue:retry all')->hourly();
}
```

**Running Scheduler:**
```bash
# Add to crontab (production)
* * * * * cd /var/www/isme-fkk/backend && php artisan schedule:run >> /dev/null 2>&1
```

### Background Processes

**Current Implementation:**
- Most operations are synchronous (immediate response)
- Heavy operations (Excel imports) run synchronously but could be queued
- WhatsApp messages can be queued (WablasService supports async)

**Future Optimization:**
- Move Excel imports to queues
- Queue email notifications
- Queue WhatsApp messages
- Implement job batching for bulk operations

---

## 10. Coding Standards and Conventions

### PHP Coding Standards

**PSR Standards:**
- **PSR-1**: Basic Coding Standard (class names, method names, constants)
- **PSR-12**: Extended Coding Style (indentation, braces, spacing)
- **PSR-4**: Autoloading Standard (namespace mapping)

**Laravel Conventions:**
- Follow Laravel naming conventions (controllers, models, migrations)
- Use Eloquent ORM for database operations
- Leverage Laravel features (validation, authorization, caching)

### File and Class Naming

**Controllers:**
- File: `PascalCase.php` (e.g., `UserController.php`)
- Class: `PascalCase` (e.g., `class UserController extends Controller`)
- Methods: `camelCase` (e.g., `public function index()`)

**Models:**
- File: `PascalCase.php` (e.g., `User.php`)
- Class: `PascalCase` (e.g., `class User extends Authenticatable`)
- Table: `snake_case` (e.g., `users` table for `User` model)

**Migrations:**
- File: `YYYY_MM_DD_HHMMSS_description.php` (e.g., `2025_01_15_000001_create_users_table.php`)
- Class: `PascalCase` (e.g., `class CreateUsersTable extends Migration`)

**Middleware:**
- File: `PascalCase.php` (e.g., `CheckRole.php`)
- Class: `PascalCase` (e.g., `class CheckRole`)

### Code Organization

**Controller Structure:**
```php
<?php

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    // Constructor (dependency injection)
    public function __construct(SemesterService $semesterService)
    {
        $this->semesterService = $semesterService;
    }

    // Index method (GET /resource)
    public function index(Request $request)
    {
        // Validation, query, response
    }

    // Store method (POST /resource)
    public function store(Request $request)
    {
        // Validation, creation, response
    }

    // Show method (GET /resource/{id})
    public function show($id)
    {
        // Query, response
    }

    // Update method (PUT/PATCH /resource/{id})
    public function update(Request $request, $id)
    {
        // Validation, update, response
    }

    // Destroy method (DELETE /resource/{id})
    public function destroy($id)
    {
        // Deletion, response
    }
}
```

**Model Structure:**
```php
<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Spatie\Activitylog\Traits\LogsActivity;

class User extends Model
{
    use HasFactory, LogsActivity;

    protected $fillable = [
        'name', 'email', 'role',
    ];

    protected $casts = [
        'email_verified_at' => 'datetime',
        'is_veteran' => 'boolean',
    ];

    // Relationships
    public function dosenPeran()
    {
        return $this->hasMany(DosenPeran::class);
    }

    // Activity Log
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty();
    }
}
```

### Naming Conventions

**Variables:**
- `camelCase` (e.g., `$userName`, `$isLoggedIn`)

**Constants:**
- `UPPER_SNAKE_CASE` (e.g., `const MAX_ATTEMPTS = 3`)

**Database:**
- Tables: `snake_case` (e.g., `jadwal_praktikum`)
- Columns: `snake_case` (e.g., `mata_kuliah_kode`, `created_at`)
- Foreign Keys: `{table}_id` (e.g., `ruangan_id`, `user_id`)

**Routes:**
- RESTful resource routes (e.g., `Route::apiResource('users', UserController::class)`)
- Custom routes use kebab-case (e.g., `/api/jadwal-harian`)

### Code Style Guidelines

**Indentation:**
- 4 spaces (no tabs)

**Braces:**
- Opening brace on same line for control structures
- Opening brace on new line for classes and methods

**Spacing:**
- One space after `if`, `for`, `foreach`, `while`
- No space after function name in function calls
- One blank line between methods

**Comments:**
- Use PHPDoc for classes and methods
- Inline comments for complex logic
- Avoid obvious comments

**Example:**
```php
/**
 * Get user by ID with dosen peran relationships.
 *
 * @param int $id
 * @return \Illuminate\Http\JsonResponse
 */
public function show($id)
{
    try {
        $user = User::with('dosenPeran.mataKuliah')->findOrFail($id);
        return response()->json($user);
    } catch (\Exception $e) {
        return response()->json(['message' => 'User not found'], 404);
    }
}
```

### Best Practices

**Validation:**
- Always validate input in controllers
- Use Form Request classes for complex validation
- Return validation errors with 422 status code

**Error Handling:**
- Use try-catch for database operations
- Log errors with context
- Return appropriate HTTP status codes
- Never expose sensitive information in error messages

**Database:**
- Use Eloquent ORM (avoid raw queries when possible)
- Use transactions for multi-step operations
- Use eager loading to prevent N+1 queries
- Use database indexes for frequently queried columns

**Security:**
- Always validate and sanitize input
- Use parameterized queries (Eloquent handles this)
- Hash passwords (bcrypt via `Hash::make()`)
- Use middleware for authentication and authorization
- Implement rate limiting

**Performance:**
- Use pagination for large datasets
- Cache frequently accessed data
- Optimize queries (select specific columns, use indexes)
- Use database connection pooling

### Activity Logging

**Spatie Activity Log:**
- Models use `LogsActivity` trait
- Logs all fillable attributes by default
- Logs only dirty attributes (changed fields)
- Custom descriptions for events

**Example:**
```php
// In Model
use Spatie\Activitylog\Traits\LogsActivity;

class User extends Model
{
    use LogsActivity;

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logFillable()
            ->logOnlyDirty()
            ->setDescriptionForEvent(fn(string $eventName) => "User telah di-{$eventName}");
    }
}
```

### Code Quality Tools

**Laravel Pint:**
- Installed as dev dependency
- PSR-12 code style enforcement
- Run: `./vendor/bin/pint`

**PHPUnit:**
- Installed as dev dependency
- Test files in `tests/` directory
- Run: `php artisan test` or `./vendor/bin/phpunit`

---

## Additional Resources

- **Laravel Documentation**: https://laravel.com/docs/12.x
- **Laravel Sanctum**: https://laravel.com/docs/sanctum
- **Spatie Permission**: https://spatie.be/docs/laravel-permission
- **Spatie Activity Log**: https://spatie.be/docs/laravel-activitylog
- **Maatwebsite Excel**: https://docs.laravel-excel.com
- **Laravel DomPDF**: https://github.com/barryvdh/laravel-dompdf

---

**Version**: 2.0.2  
**Last Updated**: December 13, 2025  
**Maintained By**: Development Team - Fakultas Kedokteran dan Kesehatan UMJ
