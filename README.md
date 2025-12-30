<p align="center">
  <img src="frontend/public/images/logo/logo-isme-dark.svg" alt="ISME Logo" width="300" height="300">
</p>

# ISME - Integrated System Medical Education

**Enterprise Academic Management System for Medical Education**

[![Laravel](https://img.shields.io/badge/Laravel-12.x-red.svg)](https://laravel.com)
[![React](https://img.shields.io/badge/React-18.x-blue.svg)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-blue.svg)](https://www.typescriptlang.org)
[![PHP](https://img.shields.io/badge/PHP-8.2+-purple.svg)](https://www.php.net)
[![MySQL](https://img.shields.io/badge/MySQL-8.0+-orange.svg)](https://www.mysql.com)
[![Redis](https://img.shields.io/badge/Redis-6.0+-red.svg)](https://redis.io)

**Version:** 2.0.2  
**Institution:** Fakultas Kedokteran dan Kesehatan Universitas Muhammadiyah Jakarta  
**License:** MIT

---

## 1. Project Overview

ISME (Integrated System Medical Education) is an enterprise-grade academic management system designed specifically for medical education institutions. The system provides comprehensive lifecycle management for medical school curricula, from course administration and automated scheduling to attendance tracking, assessment management, and student-faculty coordination.

The platform addresses the complex requirements of Problem-Based Learning (PBL) methodologies, multi-type scheduling systems, and integrated assessment workflows unique to medical education programs.

---

## 2. Background and Problem Statement

### Institutional Context

Medical education programs require sophisticated management systems capable of handling:

- **Complex Scheduling**: Multiple concurrent schedule types (lectures, practicums, PBL sessions, seminars, Clinical Skills and Reasoning) with conflict resolution
- **Automated Assignment**: Optimal distribution of students, faculty, and resources across PBL groups using algorithmic approaches
- **Multi-Modal Attendance**: QR code-based and manual attendance tracking across diverse session types
- **Integrated Assessment**: Coordinated grading systems for PBL, journal readings, seminars, and thesis defenses
- **Regulatory Compliance**: Audit trails, activity logging, and comprehensive reporting for accreditation requirements

### Technical Challenges Addressed

1. **High Concurrency**: System must handle 1000+ concurrent users during peak academic periods
2. **Data Integrity**: Complex relationships between courses, schedules, groups, and assessments require transactional consistency
3. **Real-Time Coordination**: Faculty and student coordination requires timely notifications and status updates
4. **Scalability**: Academic data grows continuously; system must maintain performance over time
5. **Security**: Role-based access control with audit capabilities for sensitive academic data

---

## 3. System Scope and Main Capabilities

### Core Functional Modules

#### Academic Management
- **Course Management**: Complete CRUD for courses (Blok, Non-Blok, CSR, PBL, Jurnal Reading)
- **Academic Year & Semester**: Multi-semester management (Ganjil, Genap, Antara)
- **Room Management**: Capacity-aware room assignment with validation
- **Material Management**: RPS (Rencana Pembelajaran Semester) and course material uploads

#### Scheduling System
- **Multi-Type Scheduling**: Supports 8+ schedule types (lectures, practicums, PBL, CSR, seminars, etc.)
- **Conflict Detection**: Automated scheduling conflict identification and resolution
- **Confirmation Workflow**: Faculty confirmation system with rescheduling capabilities
- **Excel Import/Export**: Bulk schedule management via Excel templates

#### Problem-Based Learning (PBL)
- **Automated Generation**: Algorithmic PBL assignment generation with proportional distribution
- **Assignment Management**: Automated assignment of students, faculty, groups, rooms, and schedules
- **Assessment Integration**: Linked grading system with attendance tracking
- **Regular & Inter-Semester**: Support for both standard and inter-semester PBL programs

#### Attendance Management
- **QR Code System**: Time-limited QR token generation and scanning
- **Multi-Modal Entry**: QR scanning and manual entry options
- **Real-Time Tracking**: Live attendance updates across all session types
- **Export Capabilities**: PDF and Excel export for attendance reports

#### Assessment & Evaluation
- **Comprehensive Grading**: PBL, journal reading, seminar proposal, and thesis defense assessments
- **Multi-Evaluator Support**: Coordinated grading with multiple evaluators
- **Result Management**: Finalization workflows with moderator oversight
- **Export Functionality**: Assessment report generation

#### User & Group Management
- **Role-Based Users**: Four primary roles (super_admin, tim_akademik, dosen, mahasiswa) with granular permissions
- **Bulk Operations**: Excel-based import for users, schedules, and academic data
- **Group Management**: Large and small group management with inter-semester support
- **Veteran Student Management**: Special handling for multi-semester veteran students

#### Communication & Collaboration
- **Forum System**: Categorized discussion forums with replies, likes, and bookmarks
- **Notification System**: Real-time notifications with role-based filtering
- **WhatsApp Integration**: Wablas API integration for schedule and assignment notifications
- **Support Center**: Ticketing system with knowledge base and developer assignment

#### Reporting & Analytics
- **Activity Logging**: Comprehensive audit trail using Spatie Activity Log
- **Dashboard Analytics**: Role-specific dashboards with key metrics
- **Export Capabilities**: Excel export for reports, attendance, and assessments
- **IKD Management**: Indikator Kinerja Dosen (Lecturer Performance Indicators) tracking

---

## 4. High-Level Architecture

### System Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        CLIENT LAYER                          │
│  React 18 + TypeScript SPA (Vite Build)                     │
│  - Material UI 7 + Tailwind CSS 4                           │
│  - Axios HTTP Client with Interceptors                      │
│  - React Router 7 for Navigation                            │
│  - Context API for State Management                         │
└──────────────────────┬──────────────────────────────────────┘
                       │ HTTPS/REST API
                       │ Bearer Token Auth
┌──────────────────────▼──────────────────────────────────────┐
│                     API GATEWAY LAYER                        │
│  Laravel 12 RESTful API                                     │
│  - Rate Limiting (120 req/min)                              │
│  - CORS Configuration                                       │
│  - Request Validation                                        │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                  AUTHENTICATION LAYER                        │
│  Laravel Sanctum Token-Based Auth                            │
│  - Single-Device Login Enforcement                          │
│  - Token Validation Middleware                               │
│  - Role-Based Access Control                                 │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                    APPLICATION LAYER                         │
│  61 Controllers | 65 Models | 2 Services                   │
│  - Business Logic Processing                                 │
│  - Activity Logging (Spatie)                                 │
│  - Queue Job Processing                                      │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
┌───────▼────────┐          ┌────────▼────────┐
│  DATA LAYER    │          │   CACHE LAYER    │
│  MySQL 8.0+   │          │  Redis (Prod)    │
│  65+ Tables   │          │  Database (Dev)  │
│  Eloquent ORM  │          │  - Sessions      │
│  Transactions  │          │  - Cache         │
│  Indexing      │          │  - Queue         │
└────────────────┘          └──────────────────┘
```

### Component Interaction Flow

**Request Processing:**
```
Client Request → API Gateway → Authentication → Authorization → 
Controller → Service Layer → Model/Database → Response
```

**Authentication Flow:**
```
Login → Credential Validation → DB Transaction (Lock) → 
Token Generation → Status Update → Cache Invalidation → Token Return
```

**Scheduling Flow:**
```
Schedule Creation → Validation → Conflict Detection → 
Capacity Check → Database Insert → Notification Queue → Response
```

### Data Flow Patterns

- **Synchronous Operations**: CRUD operations, authentication, real-time queries
- **Asynchronous Operations**: Email notifications, WhatsApp messages, heavy imports (via queue)
- **Caching Strategy**: Redis (production) for sessions, cache, queues; Database fallback (development)
- **Session Management**: Token-based with single-device enforcement via database flags

---

## 5. Technology Stack Overview

### Backend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | Laravel | 12.28.1 | PHP MVC framework with ORM and routing |
| **Language** | PHP | 8.2+ | Server-side scripting with type hints |
| **Database** | MySQL | 8.0+ | Relational database with connection pooling |
| **Cache/Queue** | Redis | 6.0+ | Session storage, caching, queue processing (production) |
| **Authentication** | Laravel Sanctum | 4.2.0 | Token-based API authentication |
| **Authorization** | Custom RBAC | - | Role-based access control middleware |
| **Activity Logging** | Spatie Activity Log | 4.10.2 | Comprehensive audit trail |
| **Excel Processing** | Maatwebsite Excel | 3.1.67 | Import/export functionality |
| **PDF Generation** | Laravel DomPDF | 3.1.1 | Server-side PDF creation |
| **User Agent** | Jenssegers Agent | 2.6.4 | Device and browser detection |

### Frontend Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| **Framework** | React | 18.2.0 | UI component library |
| **Language** | TypeScript | 5.7.2 | Type-safe JavaScript |
| **Build Tool** | Vite | 6.1.0 | Fast build tool with HMR |
| **Routing** | React Router | 7.6.2 | Client-side routing |
| **HTTP Client** | Axios | 1.9.0 | API communication with interceptors |
| **UI Framework** | Material UI | 7.1.1 | Component library |
| **Styling** | Tailwind CSS | 4.0.8 | Utility-first CSS framework |
| **Charts** | ApexCharts/Recharts | 4.1.0/3.1.2 | Data visualization |
| **Calendar** | FullCalendar | 6.1.15 | Schedule visualization |
| **Excel** | ExcelJS/XLSX | 4.4.0/0.18.5 | Client-side Excel manipulation |
| **PDF** | jsPDF | 3.0.3 | Client-side PDF generation |
| **QR Code** | html5-qrcode/qrcode.react | 2.3.8/4.2.0 | QR code scanning and generation |

### Third-Party Integrations

- **Wablas API**: WhatsApp Business API for notifications
- **Gmail SMTP**: Email delivery service
- **Future**: Potential integration with SIAKAD (academic information system)

### Infrastructure Requirements

- **Web Server**: Apache/Nginx with PHP-FPM
- **PHP Configuration**: `max_children = 150` (concurrent requests)
- **Apache Configuration**: `MaxRequestWorkers = 300` (concurrent connections)
- **MySQL Configuration**: `max_connections = 500` (concurrent connections)
- **Redis**: Required for production (sessions, cache, queue)

---

## 6. User Roles Summary

### Role Hierarchy and Capabilities

| Role | Primary Responsibilities | Key Capabilities |
|------|-------------------------|------------------|
| **super_admin** | System administration and configuration | Full system access, user management, system configuration, IKD management, support center administration |
| **tim_akademik** | Academic program management | Course management, schedule administration, PBL assignment, CSR management, academic reporting |
| **dosen** | Teaching and assessment | Schedule confirmation, attendance taking, grade submission, course material access, notification management |
| **mahasiswa** | Academic participation | Schedule viewing, attendance submission, grade viewing, forum participation, profile management |
| **ketua_ikd** | IKD unit management | IKD pedoman poin management, unit-specific rekap access, bukti fisik management |

### Access Control Implementation

- **Authentication**: Laravel Sanctum token-based authentication
- **Authorization**: Custom `CheckRole` middleware with enum-based roles
- **Single-Device Login**: Enforced via database flags (`is_logged_in`, `current_token`)
- **Route Protection**: Middleware chain: `auth:sanctum` → `validate.token` → `role:roles`
- **Frontend Protection**: `RequireAuth` and `RequireDosenRole` components

### Permission Model

- **Current**: Enum-based role system in database
- **Future-Ready**: Spatie Permission package installed for granular permissions
- **Route-Level**: Role-based route protection
- **Feature-Level**: Component-level role checks in frontend

---

## 7. Repository Structure

### Project Organization

```
isme-fkk/
├── backend/                    # Laravel 12 API Backend
│   ├── app/
│   │   ├── Http/
│   │   │   ├── Controllers/    # 61 API controllers
│   │   │   └── Middleware/     # 5 custom middleware
│   │   ├── Models/             # 65 Eloquent models
│   │   ├── Services/           # Business logic services
│   │   ├── Imports/            # Excel import classes
│   │   └── Traits/             # Reusable traits
│   ├── database/
│   │   ├── migrations/         # 130 migration files
│   │   └── seeders/            # 11 database seeders
│   ├── routes/
│   │   └── api.php             # 813 lines of API routes
│   ├── config/                 # Configuration files
│   └── storage/                 # File storage and logs
│
├── frontend/                    # React 18 + TypeScript SPA
│   ├── src/
│   │   ├── pages/              # 82 page components
│   │   ├── components/          # Reusable UI components
│   │   ├── layout/              # Layout components
│   │   ├── context/             # React contexts
│   │   ├── utils/               # Utility functions
│   │   └── api/                 # API client
│   └── public/                  # Static assets
│
├── README.md                    # This file
└── backend/README.md            # Backend-specific documentation
```

### Key Directories

**Backend Controllers (61 files)**
- Authentication, User Management, Course Management
- Scheduling (8+ schedule types)
- PBL Generation, CSR Management
- Assessment, Attendance, Forum, Support Center
- Reporting, Notifications, WhatsApp Integration

**Frontend Pages (82 files)**
- Dashboard pages (role-specific)
- Course and schedule management pages
- Attendance and assessment pages
- User management, forum, support center
- IKD management pages

**Database Migrations (130 files)**
- User and authentication tables
- Academic management tables
- Scheduling tables (8+ types)
- Attendance tables (8+ types)
- Assessment tables
- Forum and support center tables
- Activity logging and system tables

---

## 8. Deployment and Environment Overview

### Environment Configuration

#### Development Environment
- **Cache**: Database cache driver
- **Session**: Database session driver
- **Queue**: Database queue driver
- **Redis**: Optional (not required)
- **Debug**: Enabled for development

#### Production Environment
- **Cache**: Redis cache driver
- **Session**: Redis session driver
- **Queue**: Redis queue driver
- **Redis**: Required for optimal performance
- **Debug**: Disabled for security

### Deployment Architecture

**Server Configuration:**
- PHP-FPM: `max_children = 150` (handles 150 concurrent requests)
- Apache: `MaxRequestWorkers = 300` (handles 300 concurrent connections)
- MySQL: `max_connections = 500` (handles 500 concurrent connections)
- Redis: Session storage, caching, queue processing
- Rate Limiting: 300 requests/minute per user/IP (supports 300+ concurrent users)

**File System:**
- Storage: `storage/app/public` for uploaded files (RPS, materials, signatures)
- Symlink: `public/storage` → `storage/app/public`
- Permissions: `www-data:www-data` ownership required
- Writable: `storage/` and `bootstrap/cache/` directories

**Database:**
- MySQL 8.0+ with utf8mb4 charset
- Connection pooling enabled
- Transaction support for data integrity
- Indexing on frequently queried columns

### Deployment Process

1. **Code Deployment**: Git-based deployment to production server
2. **Dependency Installation**: `composer install --no-dev --optimize-autoloader`
3. **Database Migration**: `php artisan migrate --force`
4. **Permission Setup**: Execute `fix-permissions.sh` script
5. **Cache Optimization**: `php artisan config:cache`, `route:cache`, `view:cache`
6. **Queue Worker**: Supervisor-managed queue workers for background jobs

### Environment Variables

Critical environment variables:
- `APP_KEY`: Application encryption key (auto-generated)
- `DB_*`: Database connection parameters
- `REDIS_*`: Redis connection parameters (production)
- `WABLAS_*`: WhatsApp API credentials
- `MAIL_*`: Email service configuration
- `CACHE_STORE`: Cache driver (database/redis)
- `SESSION_DRIVER`: Session driver (database/redis)
- `QUEUE_CONNECTION`: Queue driver (database/redis)

---

## 9. Security and Access Control Overview

### Authentication Mechanism

**Token-Based Authentication:**
- Laravel Sanctum for API token management
- Bearer token in Authorization header
- Token validation on every authenticated request
- Single-device login enforcement via database flags

**Login Process:**
- Database transaction with row-level locking (prevents race conditions)
- Password hashing via bcrypt
- Failed login attempt logging
- Rate limiting: 100 requests/minute for login endpoint

**Session Management:**
- Token expiration handling
- Automatic logout on token mismatch
- Force logout capabilities (by token, user ID, or username)
- Cache-based login status (5-minute TTL) for performance

### Authorization Framework

**Role-Based Access Control:**
- Four primary roles with hierarchical permissions
- Route-level protection via middleware
- Component-level protection in frontend
- Future-ready for granular permissions (Spatie Permission installed)

**Access Control Flow:**
```
Request → Authentication Check → Token Validation → 
Role Verification → Permission Check → Resource Access
```

### Security Features

**Input Validation:**
- Server-side validation for all inputs
- SQL injection protection via Eloquent ORM
- XSS protection via Laravel escaping and React
- CSRF protection for state-changing operations

**Rate Limiting:**
- Global API rate limit: 120 requests/minute per user/IP
- Login endpoint rate limit: 100 requests/minute
- Prevents brute force attacks and API abuse

**Activity Logging:**
- Comprehensive audit trail (Spatie Activity Log)
- Logs all important system activities
- User action tracking for accountability
- Exportable logs for compliance

**Data Protection:**
- Password hashing (bcrypt)
- Token encryption
- Secure file upload handling
- Environment variable protection

### Security Best Practices

- HTTPS required for production
- Environment variables for sensitive data
- Database transaction isolation
- Prepared statements (via Eloquent)
- Input sanitization middleware
- Security headers middleware
- Regular dependency updates

---

## 10. Development Status and Roadmap

### Current Status (Version 2.0.2)

**Production-Ready Features:**
- ✅ Complete academic management system
- ✅ Multi-type scheduling with conflict detection
- ✅ Automated PBL assignment generation
- ✅ QR code attendance system
- ✅ Comprehensive assessment management
- ✅ Forum and support center
- ✅ WhatsApp notification integration
- ✅ Role-based access control
- ✅ Activity logging and reporting
- ✅ Excel import/export capabilities

**Recent Major Updates:**
- ✅ Migration from "Kelas" to "Kelompok Kecil" system (December 2025)
- ✅ Enhanced Excel import with validation
- ✅ Table zoom feature for large datasets
- ✅ User creation improvements and linting fixes

### Performance Optimization

**Implemented:**
- Database connection pooling
- Redis caching (production)
- Query optimization (eager loading, specific column selection)
- Pagination for large datasets
- Rate limiting for API protection
- Activity logging optimization (try-catch wrapping)

**Target Metrics:**
- Supports 1000+ concurrent users
- Response time: < 500ms for standard operations
- Database query optimization: N+1 query prevention
- Cache hit rate: > 80% for frequently accessed data

### Known Limitations

1. **Real-Time Communication**: Currently using polling for notifications (WebSocket implementation recommended for future)
2. **File Storage**: Local filesystem storage (cloud storage migration recommended for scalability)
3. **Single-Device Login**: Strict enforcement (multi-device support may be required)
4. **Test Coverage**: Limited automated test coverage (comprehensive test suite recommended)

### Technical Debt

1. **Role System Migration**: Enum-based roles currently; Spatie Permission installed but not fully utilized
2. **Code Duplication**: Some repeated logic across controllers (service layer extraction recommended)
3. **Frontend Bundle Size**: Large bundle size (code splitting and lazy loading recommended)
4. **Documentation**: Some complex features need expanded documentation

### Roadmap Considerations

**Short-Term (Next Release):**
- Enhanced test coverage
- Performance monitoring integration
- Expanded API documentation
- Code splitting for frontend optimization

**Medium-Term:**
- WebSocket implementation for real-time notifications
- Cloud storage integration for file management
- Granular permission system (Spatie Permission migration)
- Multi-device login support

**Long-Term:**
- Microservices architecture consideration (if scale requires)
- Mobile application development
- Advanced analytics and reporting
- Integration with external academic systems (SIAKAD, etc.)

### Maintenance and Support

**Current Support Model:**
- Built-in support center with ticketing system
- Knowledge base for common issues
- Developer assignment for technical issues
- Activity logging for troubleshooting

**Recommended Practices:**
- Regular security updates
- Dependency version monitoring
- Performance monitoring
- Database optimization and maintenance
- Backup and disaster recovery procedures

---

## Additional Resources

- **Backend Documentation**: See `backend/README.md` for detailed API documentation
- **API Endpoints**: 200+ RESTful API endpoints documented in backend README
- **Database Schema**: 65+ tables with complex relationships (see migrations)

---

## License

This project is licensed under the MIT License.

---

## Contact and Support

For technical inquiries, feature requests, or support:
- **Support Center**: Available within the application (requires login)
- **Documentation**: Comprehensive documentation in `backend/README.md`

---

**Last Updated**: December 30, 2025  
**Maintained By**: Development Team - Fakultas Kedokteran dan Kesehatan UMJ
