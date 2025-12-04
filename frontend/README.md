# ISME Frontend

**React 18 + TypeScript Frontend untuk ISME - Integrated System Medical Education**

## 📋 Deskripsi

Frontend aplikasi ISME dibangun menggunakan React 18 dengan TypeScript untuk type safety. Aplikasi ini menggunakan Material UI dan Tailwind CSS untuk styling, dengan arsitektur component-based yang modular dan reusable.

## 🚀 Quick Start

### Prerequisites

- Node.js >= 20.x
- npm >= 9.x atau yarn >= 1.22.x

### Installation

```bash
# Install dependencies
npm install

# Setup environment
npm run setup:dev   # Development
# atau
npm run setup:prod  # Production

# Start development server
npm run dev

# Build for production
npm run build:prod
```

### Development Server

```bash
# Development mode dengan hot reload
npm run dev

# Preview production build
npm run build
npm run preview
```

## 📁 Struktur Direktori

```
frontend/
├── public/              # Static files
│   ├── images/         # Image assets
│   └── favicon.png     # Favicon
├── src/
│   ├── api/            # API client configuration
│   ├── components/     # Reusable components
│   │   ├── common/     # Common components
│   │   └── ...        # Feature-specific components
│   ├── context/        # React Context providers
│   ├── hooks/          # Custom React hooks
│   ├── icons/          # Icon components
│   ├── layout/         # Layout components
│   │   ├── AppLayout.tsx
│   │   ├── AppSidebar.tsx
│   │   └── AppHeader.tsx
│   ├── pages/          # Page components
│   │   ├── AuthPages/  # Authentication pages
│   │   └── ...        # Feature pages
│   ├── utils/          # Utility functions
│   ├── App.tsx         # Main App component
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── env.development     # Development environment variables
├── env.production      # Production environment variables
├── vite.config.ts      # Vite configuration
└── tsconfig.json       # TypeScript configuration
```

## 🔧 Configuration

### Environment Variables

File environment dikelola melalui command:
- `npm run setup:dev` - Setup untuk development
- `npm run setup:prod` - Setup untuk production

**Development (env.development)**:
```env
VITE_API_BASE_URL=http://localhost:8000/api
VITE_APP_NAME=ISME Development
```

**Production (env.production)**:
```env
VITE_API_BASE_URL=https://isme.fkkumj.ac.id/api
VITE_APP_NAME=ISME
```

### Vite Configuration

File `vite.config.ts` mengkonfigurasi:
- Build settings
- Plugin configuration
- Path aliases
- Proxy settings (development)

## 🎨 UI Components

### Material UI Components

Aplikasi menggunakan Material UI v7 untuk komponen dasar:
- **Buttons**: Primary, secondary, outlined, text buttons
- **TextFields**: Input fields dengan validation
- **Selects**: Dropdown selects dengan search
- **Dialogs & Modals**: Modal dialogs untuk confirmations
- **Tables**: Data tables dengan pagination dan sorting
- **Cards**: Content cards dengan elevation
- **Icons**: Material UI icons library
- **Chips**: Tags dan labels
- **Tabs**: Tab navigation
- **Snackbars**: Toast notifications

### Headless UI Components

Aplikasi menggunakan Headless UI untuk accessible components:
- **Listbox**: Custom select dropdowns
- **Dialog**: Accessible modal dialogs
- **Transition**: Smooth animations
- **Menu**: Dropdown menus

### Custom Components

Komponen custom yang dapat digunakan kembali:

**Common Components:**
- `RequireAuth`: Route protection dengan authentication check
- `RequireDosenRole`: Role-based route protection
- `RequireSuperAdmin`: Super admin only route protection
- `RoleBasedRedirect`: Redirect otomatis berdasarkan role
- `SessionExpiredModal`: Modal untuk session expired
- `ScrollToTop`: Scroll to top on route change
- `UniversalDashboard`: Universal dashboard dengan role-based redirect
- `RedirectIfAuth`: Redirect jika sudah authenticated
- `PageMeta`: Page metadata management
- `PageBreadCrumb`: Breadcrumb navigation
- `ComponentCard`: Reusable card component
- `ChartTab`: Chart tab component
- `ThemeToggleButton`: Dark/light mode toggle
- `ForceLogoutModal`: Modal untuk force logout

**Editor Components:**
- `QuillEditor`: Rich text editor menggunakan Quill
- `QuillViewer`: Quill content viewer
- `TinyMCEEditor`: Rich text editor menggunakan TinyMCE
- `TinyMCEViewer`: TinyMCE content viewer

**User Profile Components:**
- `UserInfoCard`: User information card
- `UserMetaCard`: User metadata card

**Header Components:**
- `Header`: Main header dengan navigation
- `NotificationDropdown`: Notification dropdown
- `UserDropdown`: User profile dropdown

**Other Components:**
- `IconPicker`: Icon picker component

## 📄 Pages & Routes

### Authentication
- `/sign-in` - Login page dengan single-device login enforcement

### Dashboard
- `/dashboard` - Universal dashboard (redirect otomatis berdasarkan role)
- `/dashboard-super-admin` - Super admin dashboard (redirected dari `/dashboard`)
- `/dashboard-tim-akademik` - Tim akademik dashboard dengan analytics
- `/dashboard-dosen` - Dosen dashboard dengan jadwal hari ini
- `/dashboard-mahasiswa` - Mahasiswa dashboard dengan jadwal dan notifikasi

### User Management
- `/dosen` - Manajemen dosen dengan peran multi (Super Admin, Tim Akademik)
- `/mahasiswa` - Manajemen mahasiswa dengan filter semester (Super Admin, Tim Akademik)
- `/tim-akademik` - Manajemen tim akademik (Super Admin)
- `/profile` - User profile dengan avatar upload
- `/mahasiswa-veteran` - Manajemen mahasiswa veteran

### Mata Kuliah
- `/mata-kuliah` - Manajemen mata kuliah dengan materi (Super Admin, Tim Akademik)
- `/mata-kuliah-dosen` - Mata kuliah dosen dengan detail (Dosen)
- `/mata-kuliah-dosen/:kode` - Detail mata kuliah dosen
- `/mata-kuliah-mahasiswa` - Mata kuliah mahasiswa (Mahasiswa)
- `/mata-kuliah-keahlian` - Mapping keahlian dosen ke mata kuliah

### PBL (Problem Based Learning)
- `/pbl` - List PBL (Super Admin, Tim Akademik)
- `/pbl/blok/:blokId` - Detail PBL dengan assignments
- `/pbl/generate/:blokId` - Generate PBL assignments otomatis
- `/pbl/keahlian` - Mapping keahlian untuk PBL

### CSR (Community Service)
- `/csr` - Manajemen CSR (Super Admin, Tim Akademik)
- `/csr/:csrId` - Detail CSR dengan assignments

### Jadwal
- `/kuliah-besar/:kode/:jadwalId` - Detail kuliah besar
- `/peta-akademik` - Peta akademik overview
- `/peta-blok` - Peta blok dengan filter semester
- `/peta-blok/:semester` - Peta blok per semester
- `/peta-blok/:semester/:blok` - Detail peta blok

### Absensi Mahasiswa
- `/mahasiswa/absensi-kuliah-besar` - Absensi QR untuk kuliah besar
- `/mahasiswa/absensi-kuliah-besar/:kode/:jadwalId` - Detail absensi kuliah besar
- `/mahasiswa/absensi-non-blok-non-csr/:kode/:jadwalId` - Absensi non-blok non-CSR
- `/mahasiswa/absensi-praktikum/:kode/:jadwalId` - Absensi praktikum
- `/mahasiswa/absensi-seminar-pleno/:kode/:jadwalId` - Absensi seminar pleno
- `/mahasiswa/absensi-kuliah-besar-antara/:kode/:jadwalId` - Absensi kuliah besar antara
- `/detail-mahasiswa-keabsenan` - Detail keabsenan mahasiswa

### Absensi Dosen
- `/absensi-kuliah-besar/:kode/:jadwalId` - Absensi dosen kuliah besar
- `/absensi-kuliah-besar-antara/:kode/:jadwalId` - Absensi dosen kuliah besar antara
- `/absensi-non-blok-non-csr/:kode/:jadwalId` - Absensi dosen non-blok non-CSR
- `/absensi-non-blok-non-csr-antara/:kode/:jadwalId` - Absensi dosen non-blok non-CSR antara
- `/absensi-praktikum/:kode/:jadwalId` - Absensi dosen praktikum
- `/absensi-seminar-pleno/:kode/:jadwalId` - Absensi dosen seminar pleno
- `/absensi-csr/:kode/:jadwalId` - Absensi CSR
- `/absensi-persamaan-persepsi/:kode/:jadwalId` - Absensi persamaan persepsi
- `/dosen-riwayat` - Riwayat absensi dosen
- `/dosen/:id/riwayat` - Riwayat absensi dosen spesifik

### Penilaian
- `/penilaian-pbl` - Penilaian PBL
- `/penilaian-pbl-antara` - Penilaian PBL antara
- `/penilaian-seminar-proposal` - Penilaian seminar proposal
- `/penilaian-sidang-skripsi` - Penilaian sidang skripsi
- `/penilaian-jurnal` - Penilaian jurnal reading
- `/penilaian-jurnal-antara` - Penilaian jurnal reading antara
- `/bimbingan-akhir` - Bimbingan akhir (seminar & sidang)
- `/bimbingan-akhir/seminar-proposal/:id` - Detail seminar proposal
- `/bimbingan-akhir/seminar-proposal/:id/penilaian` - Penilaian seminar proposal
- `/bimbingan-akhir/sidang-skripsi/:id` - Detail sidang skripsi
- `/bimbingan-akhir/sidang-skripsi/:id/penilaian` - Penilaian sidang skripsi

### Detail Blok & Non-Blok
- `/detail-blok/:kode` - Detail blok dengan jadwal dan absensi
- `/detail-blok-antara/:kode` - Detail blok antara
- `/detail-non-blok-csr/:kode` - Detail non-blok CSR
- `/detail-non-blok-non-csr/:kode` - Detail non-blok non-CSR
- `/detail-non-blok-non-csr-antara/:kode` - Detail non-blok non-CSR antara

### Kelas & Kelompok
- `/kelas` - Manajemen kelas per semester
- `/kelas/:id` - Detail kelas dengan mahasiswa
- `/kelompok` - Manajemen kelompok (besar & kecil)
- `/kelompok-besar` - Manajemen kelompok besar
- `/kelompok-kecil` - Manajemen kelompok kecil

### Forum Diskusi
- `/forum` - Forum diskusi dengan kategori
- `/forum/:slug` - Detail forum dengan replies
- `/forum/category/:slug` - Forum per kategori
- `/bookmarks` - Bookmark forum dan replies

### Support Center
- `/support-center` - Support center dengan ticket system
- `/support-center/knowledge` - Knowledge base
- `/admin-notifications` - Admin notifications management (Super Admin, Tim Akademik)

### Reporting
- `/reporting/dosen` - Reporting dosen (CSR & PBL)
- `/reporting/histori` - Activity log dengan filter

### Lainnya
- `/tahun-ajaran` - Manajemen tahun ajaran (Super Admin)
- `/ruangan` - Manajemen ruangan dengan kapasitas
- `/whatsapp-test` - Test WhatsApp integration (Super Admin)

## 🔐 Authentication & Authorization

### Authentication Flow

1. User login di `/sign-in`
2. Backend mengembalikan token (Laravel Sanctum)
3. Token disimpan di localStorage
4. Token dikirim di header setiap API request
5. Middleware `validate.token` memvalidasi token di backend

### Role-Based Access

Routes dilindungi dengan `RequireDosenRole` component:

```tsx
<RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
  <MataKuliah />
</RequireDosenRole>
```

### Session Management

- Session expired detection
- Auto logout jika token tidak valid
- Modal notifikasi session expired
- Force logout functionality

## 📡 API Integration

### API Client

File `src/api/index.ts` mengkonfigurasi Axios client:

```typescript
import api from '@/api';

// GET request
const response = await api.get('/users');

// POST request
const response = await api.post('/users', data);

// PUT request
const response = await api.put(`/users/${id}`, data);

// DELETE request
const response = await api.delete(`/users/${id}`);
```

### Error Handling

Error handling dilakukan di:
- API interceptor untuk 401 (unauthorized)
- Global error handler
- Component-level error handling

### Pagination Handling

API responses menggunakan pagination. Handle dengan:

```typescript
const res = await api.get("/users?role=dosen&per_page=1000");
// Handle pagination response
const usersData = Array.isArray(res.data) 
  ? res.data 
  : (res.data?.data || []);
setData(usersData);
```

## 🎯 State Management

### React Context

Aplikasi menggunakan React Context untuk global state:
- **SessionContext**: Session management, session expiry detection, auto-logout
- **ThemeContext**: Dark/light mode theme management
- **AppWrapper**: Global app wrapper dengan metadata management

### Local State

Komponen menggunakan React hooks untuk local state:
- `useState`: Local component state management
- `useEffect`: Side effects dan lifecycle management
- `useCallback`: Memoized callbacks untuk optimasi
- `useMemo`: Memoized values untuk expensive calculations
- `useRef`: DOM references dan mutable values
- `useContext`: Access global context values

### State Patterns

**Form State:**
```typescript
const [form, setForm] = useState({ name: '', email: '' });
const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
```

**API Data State:**
```typescript
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

**Pagination State:**
```typescript
const [pagination, setPagination] = useState({
  current_page: 1,
  last_page: 1,
  per_page: 50,
  total: 0
});
```

## 📊 Data Visualization

### Charts & Graphs

Aplikasi menggunakan multiple charting libraries:
- **ApexCharts**: Advanced charts (line, bar, area, pie, donut, radar)
- **Recharts**: Composable charting library (line, bar, area, pie, scatter)
- **React ApexCharts**: ApexCharts React wrapper
- **Material UI Charts**: MUI chart components (jika digunakan)

**Chart Types:**
- Line charts untuk trends
- Bar charts untuk comparisons
- Pie/Donut charts untuk distributions
- Area charts untuk cumulative data
- Radar charts untuk multi-dimensional data

### Calendar

- **FullCalendar**: Full-featured calendar component
  - Day grid view
  - Time grid view
  - List view
  - Interaction (drag & drop, click events)
- Custom calendar views untuk absensi tracking
- Calendar integration dengan jadwal data

### Maps

- **React JVectorMap**: Vector maps untuk geographic visualization
- World map component untuk data visualization

## 📤 Excel Import/Export

Aplikasi menggunakan multiple libraries untuk Excel operations:

### Excel Export

**ExcelJS** untuk advanced Excel export:
```typescript
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Data');

// Add data dengan styling
worksheet.addRow(['Column1', 'Column2']);
worksheet.columns = [
  { header: 'Column 1', key: 'col1', width: 20 },
  { header: 'Column 2', key: 'col2', width: 20 }
];

// Export
const buffer = await workbook.xlsx.writeBuffer();
// Download menggunakan file-saver
```

**XLSX** untuk simple Excel export:
```typescript
import * as XLSX from 'xlsx';

const worksheet = XLSX.utils.json_to_sheet(data);
const workbook = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(workbook, worksheet, 'Sheet1');
XLSX.writeFile(workbook, 'export.xlsx');
```

### Excel Import

Aplikasi menggunakan **XLSX** untuk parsing Excel files:
```typescript
import * as XLSX from 'xlsx';

const file = event.target.files[0];
const data = await file.arrayBuffer();
const workbook = XLSX.read(data);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(worksheet);
```

### PDF Export

**jsPDF** untuk PDF generation:
```typescript
import jsPDF from 'jspdf';
import 'jspdf-autotable';

const doc = new jsPDF();
doc.text('Title', 10, 10);
doc.autoTable({ columns, body: data });
doc.save('export.pdf');
```

**html2canvas** untuk screenshot to PDF:
```typescript
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

const canvas = await html2canvas(element);
const imgData = canvas.toDataURL('image/png');
const pdf = new jsPDF();
pdf.addImage(imgData, 'PNG', 0, 0);
pdf.save('screenshot.pdf');
```

## 🎨 Styling

### Tailwind CSS 4

Aplikasi menggunakan Tailwind CSS 4 untuk utility-first styling:

```tsx
<div className="flex items-center justify-between p-4 bg-white dark:bg-gray-800 rounded-lg shadow">
  <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Title</h1>
</div>
```

**Features:**
- Dark mode support dengan `dark:` prefix
- Responsive design dengan breakpoints (sm, md, lg, xl, 2xl)
- Custom theme colors dan spacing
- Utility classes untuk layout, typography, colors, spacing

### Material UI 7

Material UI digunakan untuk komponen kompleks:
- **Theme customization**: Custom theme dengan colors, typography, spacing
- **Responsive design**: Breakpoints dan responsive utilities
- **Dark mode support**: Theme switching dengan ThemeProvider
- **Component styling**: Styled components dengan Emotion
- **Icons**: Material UI icons library

### Custom Styles

File `src/index.css` berisi:
- Global styles dan resets
- Tailwind directives (`@tailwind base`, `@tailwind components`, `@tailwind utilities`)
- Custom CSS variables untuk theming
- Animation keyframes
- Custom utility classes

### Animation

**Framer Motion** untuk animations:
```tsx
import { motion } from 'framer-motion';

<motion.div
  initial={{ opacity: 0, y: 20 }}
  animate={{ opacity: 1, y: 0 }}
  transition={{ duration: 0.3 }}
>
  Content
</motion.div>
```

**Swiper** untuk touch sliders:
- Touch-enabled carousels
- Responsive breakpoints
- Navigation dan pagination

## 🔔 Notifications

### Real-time Notifications

Notifikasi ditampilkan menggunakan:
- **Toast notifications**: Material UI Snackbar untuk temporary notifications
- **Notification center**: Dropdown dengan list notifications
- **Badge indicators**: Badge pada icon untuk unread count
- **Modal notifications**: Modal untuk important notifications

### Notification Types

- **Success**: Green notification untuk success actions
- **Error**: Red notification untuk errors
- **Warning**: Orange notification untuk warnings
- **Info**: Blue notification untuk informational messages

### Notification Features

- Real-time updates via API polling
- Role-based notifications (dosen, mahasiswa, admin)
- Notification categories (system, assignment, reminder)
- Mark as read functionality
- Notification history
- Admin notification management

## 📱 Responsive Design

Aplikasi fully responsive dengan breakpoints:
- **Mobile**: < 640px (sm)
- **Tablet**: 640px - 1024px (md, lg)
- **Desktop**: > 1024px (xl, 2xl)

**Responsive Features:**
- Mobile-first design approach
- Collapsible sidebar pada mobile
- Responsive tables dengan horizontal scroll
- Touch-friendly buttons dan inputs
- Responsive grid layouts
- Adaptive navigation menu

## 🧪 Testing

```bash
# Lint code
npm run lint

# Type check
npm run build  # TypeScript akan check types
```

## 📦 Dependencies

### Core Framework
- `react`: ^18.2.0 - UI Framework
- `react-dom`: ^18.2.0 - React DOM rendering
- `react-router-dom`: ^7.6.2 - Client-side routing
- `typescript`: ~5.7.2 - Type safety
- `vite`: ^6.1.0 - Build tool

### UI Libraries
- `@mui/material`: ^7.1.1 - Material UI components
- `@mui/icons-material`: ^7.1.1 - Material UI icons
- `@emotion/react`: ^11.14.0 - CSS-in-JS untuk MUI
- `@emotion/styled`: ^11.14.0 - Styled components
- `tailwindcss`: ^4.0.8 - Utility-first CSS
- `@headlessui/react`: ^2.2.4 - Accessible UI components
- `framer-motion`: ^12.15.0 - Animations dan transitions
- `react-beautiful-dnd`: ^13.1.1 - Drag and drop (deprecated, masih digunakan)
- `react-dnd`: ^16.0.1 - Drag and drop alternative
- `swiper`: ^11.2.3 - Touch slider component

### Icons
- `@fortawesome/react-fontawesome`: ^0.2.2 - Font Awesome React wrapper
- `@fortawesome/fontawesome-svg-core`: ^6.7.2 - Font Awesome core
- `@fortawesome/free-solid-svg-icons`: ^6.7.2 - Solid icons
- `@fortawesome/free-regular-svg-icons`: ^7.0.0 - Regular icons
- `@fortawesome/free-brands-svg-icons`: ^7.0.0 - Brand icons
- `react-icons`: ^5.5.0 - Popular icon libraries

### Charts & Visualization
- `apexcharts`: ^4.1.0 - Advanced charts
- `react-apexcharts`: ^1.7.0 - ApexCharts React wrapper
- `recharts`: ^3.1.2 - Composable charting library
- `@fullcalendar/react`: ^6.1.15 - Full-featured calendar
- `@fullcalendar/core`: ^6.1.15 - Calendar core
- `@fullcalendar/daygrid`: ^6.1.15 - Day grid view
- `@fullcalendar/timegrid`: ^6.1.15 - Time grid view
- `@fullcalendar/list`: ^6.1.15 - List view
- `@fullcalendar/interaction`: ^6.1.15 - Interaction plugin
- `@react-jvectormap/core`: ^1.0.4 - Vector maps
- `@react-jvectormap/world`: ^1.1.2 - World map

### Rich Text Editors
- `@tinymce/tinymce-react`: ^6.3.0 - TinyMCE editor
- `react-quill`: ^2.0.0 - Quill editor wrapper
- `quill`: ^2.0.3 - Quill editor core

### Data Processing
- `axios`: ^1.9.0 - HTTP client
- `exceljs`: ^4.4.0 - Excel read/write
- `xlsx`: ^0.18.5 - Excel parsing
- `jszip`: ^3.10.1 - ZIP file handling
- `date-fns`: ^4.1.0 - Date manipulation
- `flatpickr`: ^4.6.13 - Date picker

### PDF & Export
- `jspdf`: ^3.0.3 - PDF generation
- `jspdf-autotable`: ^5.0.2 - PDF tables
- `html2canvas`: ^1.4.1 - HTML to canvas
- `file-saver`: ^2.0.5 - File download

### QR Code
- `html5-qrcode`: ^2.3.8 - QR code scanning
- `qrcode.react`: ^4.2.0 - QR code generation

### Forms & Input
- `react-select`: ^5.10.2 - Select component
- `react-dropzone`: ^14.3.5 - File upload
- `react-signature-canvas`: ^1.1.0-alpha.2 - Digital signature

### Utilities
- `clsx`: ^2.1.1 - Conditional className
- `tailwind-merge`: ^3.0.1 - Merge Tailwind classes
- `react-helmet-async`: ^2.0.5 - Document head management

## 🛠️ Development Tools

### Vite

Build tool yang digunakan:
- Fast HMR (Hot Module Replacement)
- Optimized production builds
- Plugin ecosystem

### TypeScript

Type safety dengan TypeScript:
- Strict mode enabled
- Type checking on build
- IntelliSense support

### ESLint

Code quality dengan ESLint:
- React hooks rules
- TypeScript rules
- Best practices

## 🚀 Build & Deployment

### Development Build

```bash
npm run dev
```

### Production Build

```bash
# Setup production environment
npm run setup:prod

# Build
npm run build:prod

# Output di folder dist/
```

### Deployment

1. Build aplikasi: `npm run build:prod`
2. Upload folder `dist/` ke web server
3. Konfigurasi web server untuk serve static files
4. Setup reverse proxy untuk API (jika diperlukan)

### Nginx Configuration (Example)

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

## 🐛 Troubleshooting

### Build Errors

```bash
# Clear node_modules dan reinstall
rm -rf node_modules package-lock.json
npm install

# Clear Vite cache
rm -rf node_modules/.vite
```

### Type Errors

```bash
# Check TypeScript errors
npx tsc --noEmit

# Fix auto-fixable errors
npm run lint -- --fix
```

### API Connection Issues

1. Check `.env` file untuk `VITE_API_BASE_URL`
2. Check CORS settings di backend
3. Check network tab di browser DevTools

## 📚 Best Practices

1. **Component Structure**: Gunakan functional components dengan hooks
2. **Type Safety**: Gunakan TypeScript untuk semua komponen
3. **Error Handling**: Handle errors dengan try-catch dan error boundaries
4. **Loading States**: Tampilkan loading state untuk async operations
5. **Pagination**: Handle pagination responses dengan benar
6. **Code Splitting**: Gunakan lazy loading untuk routes besar
7. **Memoization**: Gunakan useMemo dan useCallback untuk optimasi
8. **Accessibility**: Gunakan semantic HTML dan ARIA attributes

## 🔄 State Management Patterns

### Local State
```typescript
const [data, setData] = useState<DataType[]>([]);
const [loading, setLoading] = useState(false);
const [error, setError] = useState<string | null>(null);
```

### API Calls dengan Pagination Handling
```typescript
useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/endpoint?per_page=1000');
      // Handle pagination response
      const data = Array.isArray(res.data) 
        ? res.data 
        : (res.data?.data || []);
      setData(data);
    } catch (error) {
      handleApiError(error, 'Fetch data');
      setError('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, []);
```

### Form Handling
```typescript
const [form, setForm] = useState({ name: '', email: '' });

const handleSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  try {
    await api.post('/endpoint', form);
    // Success handling
  } catch (error) {
    handleApiError(error, 'Submit form');
  }
};
```

### Batch API Calls
```typescript
const [results] = await Promise.allSettled([
  api.get('/endpoint1'),
  api.get('/endpoint2'),
  api.get('/endpoint3')
]);

// Handle results
results.forEach((result, index) => {
  if (result.status === 'fulfilled') {
    // Success
  } else {
    // Error
  }
});
```

## 🛠️ Utilities & Helpers

### API Utilities

**api.ts** - Centralized API client:
- Axios instance dengan base URL configuration
- Request/Response interceptors
- Token management (auto-inject, auto-refresh)
- Error handling dengan `handleApiError()`
- Retry logic dengan `retryWithBackoff()`
- User management dengan `getUser()`

**Usage:**
```typescript
import api, { handleApiError } from '@/utils/api';

// GET request
const res = await api.get('/endpoint');

// POST request dengan error handling
try {
  await api.post('/endpoint', data);
} catch (error) {
  handleApiError(error, 'Operation name');
}
```

### Export Utilities

**exportUtils.ts** - Export functionality:
- `exportToExcel()` - Export data ke Excel menggunakan ExcelJS
- `exportToPDF()` - Export data ke PDF menggunakan jsPDF
- `generateAttendanceReport()` - Generate laporan absensi
- `generateAssessmentReport()` - Generate laporan penilaian
- `exportMultipleFormats()` - Export ke multiple formats

### Helper Functions

**ruanganHelper.ts** - Ruangan utilities:
- `getRuanganOptions()` - Get ruangan options untuk select
- `getRuanganByCapacity()` - Get ruangan by capacity requirement

## 🎨 Context Providers

### SessionContext

Manajemen session dan session expiry:
- `isSessionExpired`: Boolean state untuk session expired
- `setSessionExpired`: Function untuk set session expired
- Auto-logout detection
- Session expiry modal trigger

**Usage:**
```typescript
import { useSession } from '@/context/SessionContext';

const { isSessionExpired, setSessionExpired } = useSession();
```

### ThemeContext

Manajemen theme (dark/light mode):
- `theme`: Current theme ('light' | 'dark')
- `toggleTheme()`: Toggle between light and dark mode
- LocalStorage persistence
- Automatic class toggling pada document

**Usage:**
```typescript
import { useTheme } from '@/context/ThemeContext';

const { theme, toggleTheme } = useTheme();
```

## 📖 Additional Resources

- [React 18 Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Material UI Documentation](https://mui.com)
- [Tailwind CSS 4 Documentation](https://tailwindcss.com/docs)
- [Vite 6 Documentation](https://vitejs.dev)
- [React Router 7 Documentation](https://reactrouter.com)
- [ApexCharts Documentation](https://apexcharts.com/docs/react-charts/)
- [FullCalendar Documentation](https://fullcalendar.io/docs/react)

---

**Version**: 2.0.2  
**React Version**: 18.2.0  
**TypeScript Version**: 5.7.2  
**Node Version**: >= 20.x  
**Last Updated**: 4 Desember 2025

