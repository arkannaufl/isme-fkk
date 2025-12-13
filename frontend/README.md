# ISME Frontend Application

**React 18 + TypeScript SPA for Integrated System Medical Education**

[![React](https://img.shields.io/badge/React-18.2.0-blue.svg)](https://reactjs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7.2-blue.svg)](https://www.typescriptlang.org)
[![Vite](https://img.shields.io/badge/Vite-6.1.0-purple.svg)](https://vitejs.dev)
[![Material UI](https://img.shields.io/badge/Material%20UI-7.1.1-blue.svg)](https://mui.com)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4.0.8-38bdf8.svg)](https://tailwindcss.com)

**Version:** 2.0.2  
**Build Tool:** Vite 6  
**Package Manager:** npm

---

## 1. Frontend Purpose and Responsibilities

The ISME frontend is a single-page application (SPA) that serves as the user interface layer for an academic management system. It provides:

- **User Interface**: Responsive, accessible UI for all user roles (super_admin, tim_akademik, dosen, mahasiswa)
- **API Integration**: RESTful API consumption via Axios with interceptors for authentication, error handling, and retry logic
- **State Management**: React Context API for global state (session, theme, sidebar) and local component state for UI interactions
- **Routing**: Client-side routing with React Router 7, including protected routes and role-based access control
- **Data Presentation**: Complex data tables, forms, charts, calendars, and export functionality (Excel, PDF)
- **Real-Time Features**: QR code scanning for attendance, notification polling, live updates
- **Accessibility**: ARIA-compliant components, keyboard navigation, screen reader support
- **Performance**: Code splitting, lazy loading, optimized re-renders, efficient data fetching

The frontend operates independently from the backend, communicating exclusively via REST API. It handles all presentation logic, form validation, user interactions, and client-side optimizations while delegating business logic and data persistence to the backend.

---

## 2. Application Architecture and Folder Structure

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (Client)                      │
│  ┌───────────────────────────────────────────────────┐  │
│  │         React 18 SPA (Vite Build)                 │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │  React Router 7 (Client-Side Routing)       │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │  Context Providers (Session, Theme, Sidebar) │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │  Pages (82 components)                      │ │  │
│  │  │  - Dashboard pages (role-specific)          │ │  │
│  │  │  - CRUD pages (MataKuliah, CSR, PBL, etc.)   │ │  │
│  │  │  - Attendance pages (QR scanning, manual)   │ │  │
│  │  │  - Assessment pages (grading, evaluation)     │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │  Components (Reusable UI)                   │ │  │
│  │  │  - Layout (Header, Sidebar, AppLayout)      │ │  │
│  │  │  - Common (Modals, Forms, Tables)           │ │  │
│  │  │  - Rich Editors (TinyMCE, Quill)            │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  │  ┌─────────────────────────────────────────────┐ │  │
│  │  │  Utils (API client, helpers, exports)       │ │  │
│  │  └─────────────────────────────────────────────┘ │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        │ HTTPS/REST API
                        │ Bearer Token Auth
┌───────────────────────▼───────────────────────────────────┐
│              Laravel 12 Backend API                       │
└───────────────────────────────────────────────────────────┘
```

### Folder Structure

```
frontend/
├── public/                    # Static assets
│   ├── images/               # Images (logos, backgrounds, icons)
│   └── favicon.png           # Favicon
│
├── src/
│   ├── api/                  # API client generation
│   │   └── generateApi.ts    # API endpoint definitions
│   │
│   ├── components/           # Reusable components
│   │   ├── common/           # Common components (14 files)
│   │   │   ├── RequireAuth.tsx
│   │   │   ├── RequireDosenRole.tsx
│   │   │   ├── RoleBasedRedirect.tsx
│   │   │   ├── SessionExpiredModal.tsx
│   │   │   ├── UniversalDashboard.tsx
│   │   │   └── ...
│   │   ├── header/           # Header components
│   │   │   ├── Header.tsx
│   │   │   ├── NotificationDropdown.tsx
│   │   │   └── UserDropdown.tsx
│   │   ├── UserProfile/      # User profile components
│   │   ├── QuillEditor.tsx   # Rich text editor (Quill)
│   │   ├── TinyMCEEditor.tsx # Rich text editor (TinyMCE)
│   │   └── IconPicker.tsx    # Icon selection component
│   │
│   ├── context/              # React Context providers
│   │   ├── SessionContext.tsx # Session management
│   │   ├── ThemeContext.tsx   # Theme (light/dark) management
│   │   └── SidebarContext.tsx # Sidebar state management
│   │
│   ├── hooks/                # Custom React hooks
│   │   ├── useIKDIndicators.ts
│   │   └── useModal.ts
│   │
│   ├── icons/                # SVG icons (60+ files)
│   │   └── index.ts          # Icon exports
│   │
│   ├── layout/               # Layout components
│   │   ├── AppLayout.tsx     # Main application layout
│   │   ├── AppHeader.tsx     # Top header bar
│   │   ├── AppSidebar.tsx    # Side navigation
│   │   └── Backdrop.tsx      # Mobile backdrop overlay
│   │
│   ├── pages/                # Page components (82 files)
│   │   ├── AuthPages/        # Authentication pages
│   │   │   └── SignIn.tsx
│   │   ├── RekapIKD/         # IKD management pages
│   │   │   ├── AIK.tsx
│   │   │   ├── MEU.tsx
│   │   │   ├── Profesi.tsx
│   │   │   └── ...
│   │   ├── DashboardSuperAdmin.tsx
│   │   ├── DashboardTimAkademik.tsx
│   │   ├── DashboardDosen.tsx
│   │   ├── DashboardMahasiswa.tsx
│   │   ├── MataKuliah.tsx
│   │   ├── CSR.tsx
│   │   ├── PBL.tsx
│   │   ├── DetailBlok.tsx
│   │   ├── DosenAbsensiKuliahBesar.tsx
│   │   ├── PenilaianPBLPage.tsx
│   │   └── ... (70+ more pages)
│   │
│   ├── utils/                # Utility functions
│   │   ├── api.ts            # Axios instance & interceptors
│   │   ├── exportUtils.ts    # Excel/PDF export helpers
│   │   └── ruanganHelper.ts # Room helper functions
│   │
│   ├── App.tsx               # Main app component (routing)
│   ├── main.tsx              # Application entry point
│   ├── index.css             # Global styles (Tailwind CSS)
│   └── vite-env.d.ts         # Vite type definitions
│
├── .env                       # Environment variables (generated)
├── env.development            # Development environment template
├── env.production             # Production environment template
├── env.example                # Environment example
├── setup-env.js               # Environment setup script
├── vite.config.ts             # Vite configuration
├── tsconfig.json              # TypeScript configuration
├── package.json               # Dependencies and scripts
└── README.md                  # This file
```

### Key Architectural Patterns

**Component Hierarchy:**
```
App
  └── SessionProvider
      └── Router
          └── Routes
              ├── RequireAuth (Protected Routes)
              │   └── AppLayout
              │       ├── SidebarProvider
              │       ├── ThemeProvider
              │       ├── AppHeader
              │       ├── AppSidebar
              │       └── Outlet (Page Components)
              └── Public Routes (SignIn)
```

**Data Flow:**
```
User Action → Component Event Handler → API Call (utils/api.ts) 
  → Axios Interceptor (add token) → Backend API 
  → Response → Axios Interceptor (handle errors) 
  → Component State Update → UI Re-render
```

---

## 3. State Management and Data Fetching Strategy

### State Management Approach

**No Global State Library**: The application uses React's built-in state management without Redux, Zustand, or similar libraries.

**State Management Layers:**

1. **Global State (React Context):**
   - `SessionContext`: Session expiration state
   - `ThemeContext`: Light/dark theme preference
   - `SidebarContext`: Sidebar expanded/collapsed state

2. **Local Component State (useState):**
   - Form inputs, modal visibility, loading states
   - Table pagination, filters, selections
   - Component-specific UI state

3. **Persistent State (localStorage):**
   - Authentication token (`token`)
   - User data (`user`)
   - Theme preference (`theme`)

**Context Implementation Example:**
```typescript
// SessionContext.tsx
export function SessionProvider({ children }: { children: ReactNode }) {
  const [isSessionExpired, setSessionExpired] = useState(false);
  return (
    <SessionContext.Provider value={{ isSessionExpired, setSessionExpired }}>
      {children}
    </SessionContext.Provider>
  );
}
```

### Data Fetching Strategy

**Axios-Based API Client:**
- Centralized Axios instance in `utils/api.ts`
- Request/response interceptors for authentication and error handling
- Automatic token injection via request interceptor
- Automatic error handling and session expiration via response interceptor

**Data Fetching Patterns:**

1. **useEffect + useState Pattern:**
```typescript
const [data, setData] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchData = async () => {
    try {
      const response = await api.get('/endpoint');
      setData(response.data);
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, []);
```

2. **On-Demand Fetching:**
- Data fetched on component mount
- Refetch on filter/search changes
- Manual refresh via user actions

3. **Optimistic Updates:**
- UI updates immediately on user actions
- Rollback on API error
- Used for actions like likes, bookmarks

4. **Pagination:**
- Server-side pagination for large datasets
- Default page size: 50 items
- Page size options: 10, 25, 50, 100

**API Client Features:**
- **Retry Logic**: Automatic retry for network errors (3 attempts with exponential backoff)
- **Timeout**: 30-second timeout for requests
- **Error Handling**: Centralized `handleApiError` function
- **Token Management**: Automatic token injection and refresh
- **Session Expiration**: Automatic logout on 401 responses

**Example API Call:**
```typescript
import api, { handleApiError } from '../utils/api';

const fetchUsers = async () => {
  try {
    const response = await api.get('/users', {
      params: { role: 'dosen', page: 1, per_page: 50 }
    });
    return response.data;
  } catch (error) {
    const errorMessage = handleApiError(error, 'Fetch Users');
    console.error(errorMessage);
    throw error;
  }
};
```

---

## 4. Authentication Flow and Protected Routes

### Authentication Flow

**Login Process:**
```
1. User submits credentials → SignIn.tsx
2. POST /api/login → Backend API
3. Receive access_token + user data
4. Store token in localStorage
5. Store user data in localStorage
6. Navigate to role-based dashboard
```

**Token Storage:**
- Token: `localStorage.getItem('token')`
- User: `localStorage.getItem('user')` (JSON string)

**Token Validation:**
- Token validated on every protected route access
- `RequireAuth` component calls `/api/me` to verify token
- Invalid token triggers automatic logout

**Logout Process:**
```
1. User clicks logout → POST /api/logout
2. Backend invalidates token
3. Frontend clears localStorage
4. Redirect to /login
```

### Protected Routes Implementation

**Route Protection Hierarchy:**
```
Public Routes (no auth required)
  └── /login

Protected Routes (auth required)
  └── RequireAuth component
      └── AppLayout
          ├── Role-based routes
          │   ├── RequireDosenRole (for specific roles)
          │   └── RequireSuperAdmin (for super_admin only)
          └── Universal routes (accessible by all authenticated users)
```

**RequireAuth Component:**
```typescript
// Checks for token, validates via /api/me, redirects to /login if invalid
export default function RequireAuth() {
  const token = localStorage.getItem("token");
  
  useEffect(() => {
    if (token) {
      api.get("/me").catch(() => {
        localStorage.clear();
        window.location.href = '/login';
      });
    }
  }, [token]);
  
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  
  return <Outlet />;
}
```

**RequireDosenRole Component:**
```typescript
// Checks user role against allowed roles
export default function RequireDosenRole({ 
  children, 
  allowedRoles 
}: RequireDosenRoleProps) {
  const user = JSON.parse(localStorage.getItem("user") || "{}");
  
  if (!allowedRoles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}
```

**Route Configuration Example:**
```typescript
<Route element={<RequireAuth />}>
  <Route element={<AppLayout />}>
    <Route path="/mata-kuliah" element={
<RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
  <MataKuliah />
</RequireDosenRole>
    } />
  </Route>
</Route>
```

**Session Expiration Handling:**
- API interceptor detects 401 responses
- Dispatches `sessionExpired` custom event
- `SessionExpiredModal` displays with message
- User redirected to login after modal dismissal

---

## 5. Role-Based UI Rendering

### Role System

**Four Primary Roles:**
- `super_admin`: Full system access
- `tim_akademik`: Academic management
- `dosen`: Teaching operations
- `mahasiswa`: Student operations

### Role-Based Rendering Strategies

**1. Route-Level Protection:**
- Routes protected by `RequireDosenRole` or `RequireSuperAdmin`
- Unauthorized users redirected to dashboard

**2. Component-Level Conditional Rendering:**
```typescript
const user = JSON.parse(localStorage.getItem("user") || "{}");

{user.role === "super_admin" && (
  <Button onClick={handleAdminAction}>Admin Action</Button>
)}
```

**3. Sidebar Menu Filtering:**
- `AppSidebar` filters menu items based on user role
- Role-specific menu sections displayed/hidden

**4. Dashboard Routing:**
- `RoleBasedRedirect` redirects to role-specific dashboard
- `UniversalDashboard` renders role-appropriate content

**5. Feature-Level Access:**
- Export buttons shown only to authorized roles
- Bulk operations restricted to specific roles
- Admin panels hidden from non-admin users

**Role-Based Redirect Example:**
```typescript
// RoleBasedRedirect.tsx
const user = getUser();
if (location.pathname === "/") {
  navigate("/dashboard"); // Universal dashboard handles role-specific content
}
```

**Universal Dashboard:**
- Single dashboard component for all roles
- Conditionally renders role-specific widgets
- Fetches role-appropriate data from backend

**Example Role Check:**
```typescript
const getUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "{}");
  } catch {
    return {};
  }
};

const user = getUser();
const isAdmin = user.role === "super_admin";
const isDosen = ["super_admin", "tim_akademik", "dosen"].includes(user.role);
```

---

## 6. Main Feature Pages and Flows

### Dashboard Pages (Role-Specific)

**DashboardSuperAdmin:**
- System statistics (users, courses, schedules)
- Activity logs overview
- Export/import functionality
- System configuration access

**DashboardTimAkademik:**
- Academic overview (courses, schedules, PBL assignments)
- Pending confirmations
- Academic reporting
- Course management quick access

**DashboardDosen:**
- Teaching schedule overview
- Pending confirmations
- Upcoming classes
- Quick attendance access

**DashboardMahasiswa:**
- Personal schedule
- Attendance summary
- Grade overview
- Upcoming assignments

### Academic Management Pages

**MataKuliah (Course Management):**
- CRUD operations for courses
- Filter by kurikulum, blok, semester
- Excel import/export
- CSR, PBL, Jurnal Reading management
- Keahlian (expertise) assignment

**CSR (Community Service):**
- CSR activity management
- Dosen-mata kuliah mapping
- Keahlian requirements
- Schedule management

**PBL (Problem-Based Learning):**
- PBL generation (algorithmic assignment)
- Dosen, mahasiswa, kelompok assignment
- Schedule management
- Assessment integration

**DetailBlok / DetailBlokAntara:**
- Comprehensive blok management
- Multiple schedule types (kuliah besar, praktikum, PBL)
- Excel import/export for schedules
- Bulk operations

### Scheduling Pages

**Jadwal Harian (Daily Schedule):**
- Combined view of all schedule types
- Date-based filtering
- Calendar view integration

**Schedule Detail Pages:**
- `KuliahBesarDetail`: Large class schedule details
- `PBLDetail`: PBL schedule details
- `CSRDetail`: CSR schedule details
- Confirmation workflow for dosen

### Attendance Pages

**Dosen Attendance Pages:**
- `DosenAbsensiKuliahBesar`: Take attendance for large classes
- `DosenAbsensiPraktikum`: Take attendance for practicums
- `DosenAbsensiSeminarPleno`: Take attendance for seminars
- QR code generation for sessions

**Mahasiswa Attendance Pages:**
- `AbSenQRMahasiswa`: QR code scanning for attendance
- `DetailAbSenMahasiswa`: Attendance detail view
- Multiple attendance types (kuliah besar, praktikum, CSR, etc.)

**Attendance Flow:**
```
1. Dosen generates QR code for session
2. QR code displayed/printed
3. Mahasiswa scans QR code
4. System validates QR token
5. Attendance recorded
6. Real-time update in attendance list
```

### Assessment Pages

**PenilaianPBLPage / PenilaianPBLAntaraPage:**
- PBL assessment submission
- Multi-criteria grading
- Finalization workflow
- Export functionality

**PenilaianSeminarProposal:**
- Seminar proposal assessment
- Multiple evaluators
- Weighted scoring
- Result aggregation

**PenilaianSidangSkripsi:**
- Thesis defense assessment
- Comprehensive evaluation criteria
- Moderator oversight
- Final grade calculation

**PenilaianJurnalPage / PenilaianJurnalAntaraPage:**
- Journal reading assessment
- Regular and inter-semester support

### User Management Pages

**Dosen / TimAkademik / Mahasiswa:**
- User listing with filters
- CRUD operations
- Excel import/export
- Bulk operations
- Profile management

**MahasiswaVeteran:**
- Veteran student management
- Multi-semester support
- Special handling

### Forum and Support

**ForumDiskusi:**
- Categorized forum posts
- Reply, like, bookmark functionality
- Search and filtering

**SupportCenter:**
- Ticket system
- Knowledge base
- Developer assignment

### IKD Management Pages

**RekapIKD (IKD Recap):**
- Multiple IKD unit pages (AIK, MEU, Profesi, Kemahasiswaan, SDM, UPTJurnal, UPTPPM)
- Pedoman poin management
- User IKD tracking
- Tim Akademik IKD overview
- Dosen IKD tracking

### Common User Flows

**Course Creation Flow:**
```
1. Navigate to MataKuliah page
2. Click "Tambah Mata Kuliah"
3. Fill form (kode, nama, kurikulum, blok, etc.)
4. Add CSR/PBL/Jurnal Reading if applicable
5. Submit → API call → Success notification
6. Redirect to course list
```

**PBL Generation Flow:**
```
1. Navigate to PBLGenerate page
2. Select blok and parameters
3. Click "Generate PBL"
4. Algorithm assigns dosen, mahasiswa, kelompok, ruangan
5. Review generated assignments
6. Confirm or regenerate
7. Save to database
```

**Attendance Taking Flow:**
```
1. Dosen navigates to attendance page
2. Selects session
3. Generates QR code (or uses manual entry)
4. Mahasiswa scans QR code
5. System validates and records attendance
6. Real-time update in attendance list
```

---

## 7. Environment Configuration

### Environment Variables

**File Structure:**
- `.env`: Active environment file (generated by setup script)
- `env.development`: Development template
- `env.production`: Production template
- `env.example`: Example file

### Environment Variables

**VITE_API_URL:**
- Development: `http://localhost:8000`
- Production: `https://isme.fkkumj.ac.id`
- Used by Axios instance in `utils/api.ts`

**NODE_ENV:**
- `development` or `production`
- Used by Vite for build optimizations

### Environment Setup

**Setup Script:**
```bash
# Development
npm run setup:dev
# Copies env.development to .env

# Production
npm run setup:prod
# Copies env.production to .env
```

**Manual Setup:**
```bash
# Copy template
cp env.development .env
# or
cp env.production .env

# Edit .env file
VITE_API_URL=http://localhost:8000
NODE_ENV=development
```

**Environment File Example:**
```env
# API Configuration
VITE_API_URL=http://localhost:8000

# Environment
NODE_ENV=development
```

### Accessing Environment Variables

**In Code:**
```typescript
const API_URL = import.meta.env.VITE_API_URL;
// Note: Only variables prefixed with VITE_ are exposed to client code
```

**In Vite Config:**
```typescript
// vite.config.ts
export default defineConfig({
  // Environment variables available via import.meta.env
});
```

---

## 8. Build and Deployment Process

### Development Build

**Start Development Server:**
```bash
npm run dev
# Starts Vite dev server on http://localhost:5173
# Hot Module Replacement (HMR) enabled
```

**Development Features:**
- Fast refresh (component state preserved on edit)
- Source maps for debugging
- Error overlay in browser
- HMR for instant updates

### Production Build

**Build Command:**
```bash
# Setup environment + build
npm run build:prod

# Or separately
npm run setup:prod
npm run build
```

**Build Output:**
- `dist/` directory contains production build
- Optimized and minified JavaScript/CSS
- Asset hashing for cache busting
- Tree-shaking for unused code removal

**Build Process:**
```
1. TypeScript compilation (tsc --noEmit --skipLibCheck)
2. Vite build (optimization, minification, bundling)
3. Asset processing (images, fonts, etc.)
4. Output to dist/
```

### Deployment Steps

**1. Build for Production:**
```bash
cd frontend
npm install
npm run build:prod
```

**2. Deploy to Web Server:**
```bash
# Copy dist/ to web server
scp -r dist/* user@server:/var/www/isme-fkk/frontend/

# Or use deployment script
# Configure nginx/apache to serve dist/ directory
```

**3. Web Server Configuration (Nginx Example):**
```nginx
server {
    listen 80;
    server_name isme.fkkumj.ac.id;
    root /var/www/isme-fkk/frontend/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location /api {
        proxy_pass http://localhost:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

**4. Apache Configuration:**
```apache
<VirtualHost *:80>
    ServerName isme.fkkumj.ac.id
    DocumentRoot /var/www/isme-fkk/frontend/dist

    <Directory /var/www/isme-fkk/frontend/dist>
        Options -Indexes +FollowSymLinks
        AllowOverride All
        Require all granted
    </Directory>

    # SPA routing support
    RewriteEngine On
    RewriteBase /
    RewriteRule ^index\.html$ - [L]
    RewriteCond %{REQUEST_FILENAME} !-f
    RewriteCond %{REQUEST_FILENAME} !-d
    RewriteRule . /index.html [L]

    # API proxy
    ProxyPass /api http://localhost:8000/api
    ProxyPassReverse /api http://localhost:8000/api
</VirtualHost>
```

### Build Optimization

**Vite Optimizations:**
- Code splitting (automatic chunk splitting)
- Tree shaking (removes unused code)
- Minification (JavaScript and CSS)
- Asset optimization (images, fonts)
- Gzip compression (via web server)

**Bundle Analysis:**
```bash
# Install bundle analyzer
npm install --save-dev rollup-plugin-visualizer

# Add to vite.config.ts and rebuild
```

### Deployment Checklist

- [ ] Environment variables configured (`.env`)
- [ ] API URL set correctly (`VITE_API_URL`)
- [ ] Production build completed (`npm run build:prod`)
- [ ] `dist/` directory deployed to web server
- [ ] Web server configured (nginx/apache)
- [ ] SPA routing configured (fallback to `index.html`)
- [ ] API proxy configured (if needed)
- [ ] HTTPS enabled (production)
- [ ] CORS configured on backend (if frontend on different domain)
- [ ] Error tracking configured (if using Sentry, etc.)

---

## 9. UI/UX Principles Applied

### Design System

**Typography:**
- Font: Outfit (Google Fonts)
- Responsive font sizes (title-2xl to text-xs)
- Consistent line heights

**Color System:**
- Brand colors (green palette: brand-25 to brand-900)
- Semantic colors (success, error, warning, info)
- Dark mode support (via ThemeContext)

**Spacing:**
- Consistent spacing scale (Tailwind defaults)
- Responsive padding/margins

### Responsive Design

**Breakpoints:**
- `2xsm`: 375px
- `xsm`: 425px
- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px
- `3xl`: 2000px

**Mobile-First Approach:**
- Base styles for mobile
- Progressive enhancement for larger screens
- Sidebar collapses on mobile
- Touch-friendly button sizes

**Responsive Patterns:**
```typescript
// Mobile: stacked layout
<div className="flex flex-col md:flex-row">
  <div className="w-full md:w-1/2">Content</div>
</div>

// Mobile: hidden elements
<div className="hidden md:block">Desktop Only</div>
```

### Accessibility (a11y)

**ARIA Compliance:**
- Semantic HTML elements
- ARIA labels for icons and buttons
- ARIA live regions for dynamic content
- Keyboard navigation support

**Keyboard Navigation:**
- Tab order logical
- Enter/Space for button activation
- Escape to close modals
- Arrow keys for navigation (where applicable)

**Screen Reader Support:**
- Alt text for images
- Descriptive button labels
- Form field labels
- Error message announcements

### User Experience Patterns

**Loading States:**
- Skeleton loaders for data tables
- Spinner for async operations
- Progress indicators for long operations
- Optimistic UI updates where appropriate

**Error Handling:**
- User-friendly error messages
- Validation errors displayed inline
- Network error retry prompts
- Session expiration modal

**Feedback Mechanisms:**
- Success notifications (toast messages)
- Error notifications
- Confirmation dialogs for destructive actions
- Form validation feedback

**Data Tables:**
- Pagination (server-side)
- Sorting and filtering
- Bulk selection
- Export functionality (Excel, PDF)
- Responsive table design (scroll on mobile)

**Forms:**
- Real-time validation
- Clear error messages
- Required field indicators
- Auto-save (where applicable)
- Confirmation for destructive actions

### Dark Mode

**Implementation:**
- `ThemeContext` manages theme state
- Stored in `localStorage`
- Toggle button in header
- Tailwind dark mode classes (`dark:`)

**Usage:**
```typescript
const { theme, toggleTheme } = useTheme();

<div className="bg-white dark:bg-gray-800">
  <p className="text-gray-900 dark:text-white">Content</p>
</div>
```

### Performance Optimizations

**Code Splitting:**
- Route-based code splitting (React Router)
- Lazy loading for heavy components
- Dynamic imports for large libraries

**Render Optimization:**
- `React.memo` for expensive components
- `useMemo` for computed values
- `useCallback` for event handlers
- Avoid unnecessary re-renders

**Asset Optimization:**
- Image optimization (compression, formats)
- Font subsetting
- SVG icons (scalable, lightweight)
- Lazy loading for images

**Network Optimization:**
- Request debouncing for search
- Pagination for large datasets
- Caching strategies (where applicable)
- Retry logic for failed requests

---

## 10. Known Limitations and Future Improvements

### Current Limitations

**1. State Management:**
- No global state management library (Redux, Zustand)
- Prop drilling in some components
- Local state duplication across similar components
- **Future**: Consider Zustand or Redux Toolkit for complex state

**2. Real-Time Features:**
- Notifications use polling (not WebSocket)
- No real-time updates for collaborative features
- **Future**: Implement WebSocket for real-time notifications and updates

**3. Bundle Size:**
- Large initial bundle size
- Some heavy libraries loaded upfront
- **Future**: Implement code splitting, lazy loading, tree shaking optimization

**4. Error Tracking:**
- No centralized error tracking (Sentry, LogRocket)
- Errors logged to console only
- **Future**: Integrate error tracking service

**5. Testing:**
- Limited test coverage
- No E2E tests
- **Future**: Add unit tests (Jest, React Testing Library), E2E tests (Playwright, Cypress)

**6. Performance:**
- Some large tables render all rows (virtualization needed)
- Heavy re-renders in complex forms
- **Future**: Implement virtual scrolling, optimize re-renders

**7. Accessibility:**
- Some components lack full ARIA support
- Keyboard navigation incomplete in some areas
- **Future**: Comprehensive accessibility audit and improvements

**8. Offline Support:**
- No offline functionality
- No service worker for caching
- **Future**: Implement PWA features, service worker, offline support

### Future Improvements

**Short-Term (Next Release):**
- [ ] Implement virtual scrolling for large tables
- [ ] Add comprehensive error tracking (Sentry)
- [ ] Improve accessibility (ARIA, keyboard navigation)
- [ ] Optimize bundle size (code splitting, lazy loading)
- [ ] Add unit tests for critical components

**Medium-Term:**
- [ ] Implement WebSocket for real-time features
- [ ] Add global state management (Zustand/Redux)
- [ ] Implement PWA features (service worker, offline support)
- [ ] Add E2E tests (Playwright/Cypress)
- [ ] Performance monitoring and optimization

**Long-Term:**
- [ ] Micro-frontend architecture (if scale requires)
- [ ] Advanced caching strategies
- [ ] GraphQL migration (if needed)
- [ ] Mobile app (React Native)
- [ ] Advanced analytics and reporting

### Technical Debt

**Code Organization:**
- Some large component files (3000+ lines)
- Duplicate logic across components
- **Action**: Refactor into smaller components, extract shared logic

**Type Safety:**
- Some `any` types used
- Incomplete TypeScript coverage
- **Action**: Improve type definitions, eliminate `any` types

**Documentation:**
- Limited inline documentation
- No Storybook for components
- **Action**: Add JSDoc comments, implement Storybook

**Dependencies:**
- Some outdated dependencies
- Large dependency tree
- **Action**: Regular dependency updates, audit unused dependencies

---

## Additional Resources

- **React Documentation**: https://react.dev
- **TypeScript Documentation**: https://www.typescriptlang.org/docs
- **Vite Documentation**: https://vitejs.dev
- **React Router Documentation**: https://reactrouter.com
- **Material UI Documentation**: https://mui.com
- **Tailwind CSS Documentation**: https://tailwindcss.com
- **Axios Documentation**: https://axios-http.com

---

## Development Commands

```bash
# Install dependencies
npm install

# Development server
npm run dev

# Production build
npm run build

# Lint code
npm run lint

# Setup environment
npm run setup:dev    # Development
npm run setup:prod    # Production

# Preview production build
npm run preview
```

---

**Version**: 2.0.2  
**Last Updated**: December 13, 2025  
**Maintained By**: Development Team - Fakultas Kedokteran dan Kesehatan UMJ
