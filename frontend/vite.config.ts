import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    svgr({
      svgrOptions: {
        icon: true,
        // This will transform your SVG to a React component
        exportType: "named",
        namedExport: "ReactComponent",
      },
    }),
  ],
  server: {
    host: '0.0.0.0',
    port: 5173,
    strictPort: false
  },
  build: {
    // Set NODE_ENV for production builds
    // Vite automatically sets NODE_ENV=production during build, so we don't need it in .env
    rollupOptions: {
      output: {
        manualChunks: {
          // React core libraries
          'react-vendor': ['react', 'react-dom', 'react-router', 'react-router-dom'],
          
          // UI libraries
          'ui-vendor': [
            '@mui/material',
            '@mui/icons-material',
            '@emotion/react',
            '@emotion/styled',
            '@headlessui/react',
            '@fortawesome/react-fontawesome',
            '@fortawesome/fontawesome-svg-core',
            '@fortawesome/free-solid-svg-icons',
            '@fortawesome/free-regular-svg-icons',
            '@fortawesome/free-brands-svg-icons',
          ],
          
          // Chart libraries
          'chart-vendor': ['apexcharts', 'react-apexcharts', 'recharts'],
          
          // Calendar libraries
          'calendar-vendor': [
            '@fullcalendar/core',
            '@fullcalendar/react',
            '@fullcalendar/daygrid',
            '@fullcalendar/timegrid',
            '@fullcalendar/list',
            '@fullcalendar/interaction',
          ],
          
          // Heavy export libraries - these are often dynamically imported
          'export-vendor': ['exceljs', 'jszip', 'jspdf', 'jspdf-autotable', 'file-saver'],
          
          // PDF/Image libraries
          'pdf-vendor': ['html2canvas'],
          
          // Other heavy libraries
          'editor-vendor': ['@tinymce/tinymce-react', 'quill', 'react-quill'],
          
          // Utility libraries
          'utils-vendor': [
            'axios',
            'date-fns',
            'flatpickr',
            'xlsx',
            'html5-qrcode',
            'qrcode.react',
            'react-beautiful-dnd',
            'react-dnd',
            'react-dnd-html5-backend',
            'react-dropzone',
            'react-select',
            'swiper',
            'framer-motion',
            'react-helmet-async',
            'react-icons',
            'react-signature-canvas',
            '@react-jvectormap/core',
            '@react-jvectormap/world',
          ],
        },
      },
    },
    // Increase chunk size warning limit to 1000 KB (1 MB)
    // The main chunk will still be large, but we've split vendors
    chunkSizeWarningLimit: 1000,
    // Optimize build output (esbuild is faster than terser)
    minify: 'esbuild',
    // Disable source maps in production to reduce bundle size
    sourcemap: false,
    // Optimize asset handling
    assetsInlineLimit: 4096, // Inline assets smaller than 4kb
    // CSS code splitting
    cssCodeSplit: true,
    // Optimize chunk size
    target: 'es2015', // Support modern browsers for smaller bundles
  },
});
