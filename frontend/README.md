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

Aplikasi menggunakan Material UI untuk komponen dasar:
- Buttons, TextFields, Selects
- Dialogs, Modals
- Tables, Cards
- Icons

### Custom Components

Komponen custom yang dapat digunakan kembali:
- `RequireAuth`: Route protection
- `RequireDosenRole`: Role-based route protection
- `RoleBasedRedirect`: Redirect berdasarkan role
- `SessionExpiredModal`: Modal untuk session expired
- `ScrollToTop`: Scroll to top on route change

## 📄 Pages & Routes

### Authentication
- `/sign-in` - Login page

### Dashboard
- `/dashboard` - Universal dashboard (redirect berdasarkan role)
- `/dashboard-super-admin` - Super admin dashboard
- `/dashboard-tim-akademik` - Tim akademik dashboard
- `/dashboard-dosen` - Dosen dashboard
- `/dashboard-mahasiswa` - Mahasiswa dashboard

### User Management
- `/dosen` - Manajemen dosen (Super Admin, Tim Akademik)
- `/mahasiswa` - Manajemen mahasiswa (Super Admin, Tim Akademik)
- `/tim-akademik` - Manajemen tim akademik (Super Admin)
- `/profile` - User profile

### Mata Kuliah
- `/mata-kuliah` - Manajemen mata kuliah (Super Admin, Tim Akademik)
- `/mata-kuliah-dosen` - Mata kuliah dosen (Dosen)
- `/mata-kuliah-mahasiswa` - Mata kuliah mahasiswa (Mahasiswa)
- `/mata-kuliah-keahlian` - Mapping keahlian dosen

### PBL (Problem Based Learning)
- `/pbl` - List PBL
- `/pbl-generate` - Generate PBL assignments
- `/pbl-detail/:id` - Detail PBL

### CSR (Community Service)
- `/csr` - Manajemen CSR
- `/csr-detail/:id` - Detail CSR

### Jadwal
- `/jadwal-kuliah-besar` - Jadwal kuliah besar
- `/jadwal-praktikum` - Jadwal praktikum
- `/jadwal-seminar` - Jadwal seminar
- `/jadwal-harian` - Jadwal harian (combined)

### Absensi
- `/mahasiswa/absensi-kuliah-besar` - Absensi QR untuk mahasiswa
- `/detail-mahasiswa-keabsenan` - Detail keabsenan mahasiswa
- `/dosen/absensi` - Absensi dosen

### Penilaian
- `/penilaian-pbl` - Penilaian PBL
- `/penilaian-seminar-proposal` - Penilaian seminar proposal
- `/penilaian-sidang-skripsi` - Penilaian sidang skripsi

### Forum Diskusi
- `/forum` - Forum diskusi
- `/forum/:slug` - Detail forum
- `/forum/categories` - Kategori forum

### Support Center
- `/support-center` - Support center dengan ticket system
- `/support-center/knowledge` - Knowledge base

### Reporting
- `/reporting/dosen` - Reporting dosen
- `/reporting/histori` - Activity log

### Lainnya
- `/tahun-ajaran` - Manajemen tahun ajaran
- `/ruangan` - Manajemen ruangan
- `/kelas` - Manajemen kelas
- `/kelompok-besar` - Manajemen kelompok besar
- `/kelompok-kecil` - Manajemen kelompok kecil
- `/peta-blok` - Peta blok
- `/peta-akademik` - Peta akademik

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

Aplikasi menggunakan React Context untuk:
- **SessionContext**: Session management
- **AuthContext**: Authentication state
- **NotificationContext**: Notifications

### Local State

Komponen menggunakan React hooks untuk local state:
- `useState`: Local component state
- `useEffect`: Side effects
- `useCallback`: Memoized callbacks
- `useMemo`: Memoized values

## 📊 Data Visualization

### Charts

Aplikasi menggunakan:
- **ApexCharts**: Charts dan graphs
- **Recharts**: Additional charts
- **Material UI Charts**: MUI chart components

### Calendar

- **FullCalendar**: Calendar component untuk jadwal
- Custom calendar views untuk absensi

## 📤 Excel Export

Aplikasi menggunakan **ExcelJS** untuk export:

```typescript
import ExcelJS from 'exceljs';

const workbook = new ExcelJS.Workbook();
const worksheet = workbook.addWorksheet('Data');

// Add data
worksheet.addRow(['Column1', 'Column2']);

// Export
const buffer = await workbook.xlsx.writeBuffer();
// Download file
```

## 🎨 Styling

### Tailwind CSS

Aplikasi menggunakan Tailwind CSS untuk utility-first styling:

```tsx
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow">
  <h1 className="text-2xl font-bold text-gray-800">Title</h1>
</div>
```

### Material UI

Material UI digunakan untuk komponen kompleks:
- Theme customization
- Responsive design
- Dark mode support (jika diperlukan)

### Custom Styles

File `src/index.css` berisi:
- Global styles
- Tailwind directives
- Custom CSS variables

## 🔔 Notifications

### Real-time Notifications

Notifikasi ditampilkan menggunakan:
- Toast notifications
- Notification center
- Badge indicators

### Notification Types

- Success
- Error
- Warning
- Info

## 📱 Responsive Design

Aplikasi responsive dengan breakpoints:
- Mobile: < 640px
- Tablet: 640px - 1024px
- Desktop: > 1024px

## 🧪 Testing

```bash
# Lint code
npm run lint

# Type check
npm run build  # TypeScript akan check types
```

## 📦 Dependencies

### Main Dependencies
- `react`: ^18.2.0
- `react-dom`: ^18.2.0
- `react-router-dom`: ^7.6.2
- `axios`: ^1.9.0
- `@mui/material`: ^7.1.1
- `tailwindcss`: ^4.0.8
- `typescript`: ~5.7.2

### UI Libraries
- `@fortawesome/react-fontawesome`: Icon library
- `@headlessui/react`: Headless UI components
- `framer-motion`: Animations
- `react-beautiful-dnd`: Drag and drop

### Charts & Visualization
- `apexcharts`: Charts
- `recharts`: Additional charts
- `@fullcalendar/react`: Calendar

### Utilities
- `date-fns`: Date manipulation
- `exceljs`: Excel export
- `jspdf`: PDF generation
- `html2canvas`: Screenshot
- `xlsx`: Excel parsing

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
```

### API Calls
```typescript
useEffect(() => {
  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/endpoint');
      setData(res.data);
    } catch (error) {
      console.error(error);
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
  await api.post('/endpoint', form);
};
```

## 📖 Additional Resources

- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs)
- [Material UI Documentation](https://mui.com)
- [Tailwind CSS Documentation](https://tailwindcss.com/docs)
- [Vite Documentation](https://vitejs.dev)

---

**Version**: 2.0.2  
**React Version**: 18.2.0  
**TypeScript Version**: 5.7.2  
**Node Version**: >= 20.x

