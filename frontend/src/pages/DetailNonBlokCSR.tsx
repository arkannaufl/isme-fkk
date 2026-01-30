import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import api, { handleApiError } from '../utils/api';
import { ChevronLeftIcon } from '../icons';
import Select from 'react-select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrash, faFileExcel, faDownload, faUpload, faExclamationTriangle, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { AnimatePresence, motion } from 'framer-motion';
import { getRuanganOptions } from '../utils/ruanganHelper';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';

// Constants
const SESSION_DURATION_MINUTES = 50;
const CSR_REGULER_SESSIONS = 3;
const CSR_RESPONSI_SESSIONS = 2;
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const EXCEL_COLUMN_WIDTHS = {
  TANGGAL: 12,
  JAM_MULAI: 10,
  JENIS_CSR: 12,
  KELOMPOK_KECIL: 15,
  TOPIK: 35,
  KEAHLIAN: 15,
  DOSEN: 25,
  RUANGAN: 20,
  INFO_COLUMN: 50
};

interface MataKuliah {
  kode: string;
  nama: string;
  semester: number;
  periode: string;
  kurikulum: number;
  jenis: string;
  tipe_non_block?: string;
  tanggal_mulai?: string;
  tanggal_akhir?: string;
  durasi_minggu?: number | null;
  keahlian_required?: string[];
}

interface JadwalCSR {
  id?: number;
  mata_kuliah_kode: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  jumlah_sesi: number;
  jenis_csr: 'reguler' | 'responsi';
  dosen_id: number;
  ruangan_id: number;
  kelompok_kecil_id: number;
  kategori_id: number;
  topik: string;
  // SIAKAD fields
  siakad_kurikulum?: string;
  siakad_kode_mk?: string;
  siakad_nama_kelas?: string;
  siakad_jenis_pertemuan?: string;
  siakad_metode?: string;
  siakad_dosen_pengganti?: string;
  dosen?: {
    id: number;
    name: string;
    nid: string;
  };
  ruangan?: {
    id: number;
    nama: string;
    kapasitas?: number;
    gedung?: string;
    id_ruangan?: string;
  };
  kelompok_kecil?: {
    id: number;
    nama_kelompok: string;
  };
  kategori?: {
    id: number;
    nama: string;
    keahlian_required?: string[];
  };
}

interface KelompokKecilOption {
  id: number;
  nama_kelompok: string;
}

interface KategoriOption {
  id: number;
  nama: string;
  nomor_csr: number;
  keahlian_required?: string[];
}

interface DosenOption {
  id: number;
  name: string;
  nid: string;
  keahlian: string;
  csr_id: number;
  csr_nama: string;
  nomor_csr: number;
}

interface RuanganOption {
  id: number;
  nama: string;
  kapasitas?: number;
  gedung?: string;
  id_ruangan?: string;
}


interface JadwalCSRType {
  jenis_csr: 'reguler' | 'responsi';
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  jumlah_sesi: number;
  kelompok_kecil_id: number;
  topik: string;
  kategori_id: number;
  dosen_id: number;
  ruangan_id: number;
  nama_kelompok?: string;
  nama_keahlian?: string;
  nama_dosen?: string;
  nama_ruangan?: string;
  // SIAKAD fields
  siakad_kurikulum?: string;
  siakad_kode_mk?: string;
  siakad_nama_kelas?: string;
  siakad_jenis_pertemuan?: string;
  siakad_metode?: string;
  siakad_dosen_pengganti?: string;
}

// ========================================
// SIAKAD EXPORT CONSTANTS & CONFIGURATION
// ========================================

// SIAKAD template headers with line breaks for better readability
const SIAKAD_HEADERS = [
  'Kurikulum', 'Kode MK', 'Nama Kelas', 'Kelompok\n(Contoh: 1)', 'Topik',
  'Substansi\n(Lihat Daftar Substansi)', 'Jenis Pertemuan\n(Lihat Daftar Jenis Pertemuan)',
  'Metode\n(Lihat Daftar Metode)', 'Ruang\n(Lihat Daftar Ruang)', 'NIP Pengajar',
  'Dosen Pengganti\n(Y jika Ya)', 'Tanggal\n(YYYY-MM-DD)', 'Waktu Mulai\n(Lihat Daftar Waktu Mulai)',
  'Waktu Selesai\n(Lihat Daftar Waktu Selesai)'
];

// Column widths optimized for SIAKAD template readability
const SIAKAD_COLUMN_WIDTHS = [
  { width: 12 }, { width: 10 }, { width: 12 }, { width: 12 }, { width: 30 }, { width: 22 },
  { width: 30 }, { width: 25 }, { width: 25 }, { width: 15 }, { width: 18 }, { width: 15 },
  { width: 28 }, { width: 28 }
];

// Styling definitions for SIAKAD headers
const SIAKAD_STYLES = {
  greenOneLine: {
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF92D050' } },
    font: { bold: true, color: { argb: 'FF000000' } },
    alignment: { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true }
  },
  greenTwoLines: {
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FF92D050' } },
    font: { bold: true, color: { argb: 'FF000000' } },
    alignment: { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true }
  },
  orangeOneLine: {
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFC000' } },
    font: { bold: true, color: { argb: 'FF000000' } },
    alignment: { horizontal: 'left' as const, vertical: 'top' as const, wrapText: true }
  },
  orangeTwoLines: {
    fill: { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFFFC000' } },
    font: { bold: true, color: { argb: 'FF000000' } },
    alignment: { horizontal: 'left' as const, vertical: 'middle' as const, wrapText: true }
  }
};

// Column style mapping for SIAKAD headers
const SIAKAD_COLUMN_STYLES = {
  greenOneLine: [1, 2, 3, 5],      // A, B, C, E (Kurikulum, Kode MK, Nama Kelas, Topik)
  greenTwoLines: [7, 8, 12, 13, 14], // G, H, L, M, N (Jenis Pertemuan, Metode, Tanggal, Waktu Mulai, Waktu Selesai)
  orangeOneLine: [10],              // J (NIP Pengajar)
  orangeTwoLines: [4, 6, 9, 11]     // D, F, I, K (Kelompok, Substansi, Ruang, Dosen Pengganti)
};

// ========================================
// SIAKAD HELPER FUNCTIONS - REUSABLE & OPTIMIZED
// ========================================
/**
 * Apply SIAKAD styling to worksheet headers
 * @param worksheet - ExcelJS worksheet object
 */
const applySIAKADStyling = (worksheet: any) => {
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;

  // Apply green styling to SIAKAD fields (one line)
  SIAKAD_COLUMN_STYLES.greenOneLine.forEach(col => {
    headerRow.getCell(col).style = SIAKAD_STYLES.greenOneLine;
  });

  // Apply green styling to SIAKAD fields (two lines)
  SIAKAD_COLUMN_STYLES.greenTwoLines.forEach(col => {
    headerRow.getCell(col).style = SIAKAD_STYLES.greenTwoLines;
  });

  // Apply orange styling to system fields (one line)
  SIAKAD_COLUMN_STYLES.orangeOneLine.forEach(col => {
    headerRow.getCell(col).style = SIAKAD_STYLES.orangeOneLine;
  });

  // Apply orange styling to system fields (two lines)
  SIAKAD_COLUMN_STYLES.orangeTwoLines.forEach(col => {
    headerRow.getCell(col).style = SIAKAD_STYLES.orangeTwoLines;
  });

  // Set column widths
  worksheet.columns = SIAKAD_COLUMN_WIDTHS;
};

/**
 * Create information sheet for SIAKAD export
 * @param workbook - ExcelJS workbook object
 * @param data - Mata kuliah data
 * @param jadwalType - Type of schedule (csr, kuliah besar, etc.)
 * @param jadwalCount - Number of schedules exported
 */
const createSIAKADInfoSheet = (workbook: any, data: any, jadwalType: string, jadwalCount: number) => {
  const infoSheet = workbook.addWorksheet('Informasi');
  const infoData = [
    ["INFORMASI EXPORT SIAKAD"],
    [""],
    ["Kode Mata Kuliah", data?.kode || ""],
    ["Nama Mata Kuliah", data?.nama || ""],
    ["Tanggal Mulai", data?.tanggal_mulai ? new Date(data.tanggal_mulai).toISOString().split('T')[0] : ""],
    ["Tanggal Akhir", data?.tanggal_akhir ? new Date(data.tanggal_akhir).toISOString().split('T')[0] : ""],
    ["Kurikulum", data?.kurikulum || ""],
    ["Jenis", data?.jenis || ""],
    ["Tipe Non Block", data?.tipe_non_block || ""],
    ["Durasi Minggu", data?.durasi_minggu || ""],
    [""],
    [`TOTAL JADWAL ${jadwalType.toUpperCase()}`, jadwalCount],
    [""],
    ["CATATAN:"],
    [`• File ini berisi data jadwal ${jadwalType.toLowerCase()} dalam format SIAKAD`],
    ["• Format tanggal: YYYY-MM-DD"],
    ["• Format jam: HH:MM"],
    ["• Header dengan line break pada kolom:"],
    ["  Kelompok, Substansi, Jenis Pertemuan, Metode, Ruang,"],
    ["  Dosen Pengganti, Tanggal, Waktu Mulai, Waktu Selesai"],
  ];
  
  // Set column widths untuk mencegah text terpotong
  infoSheet.getColumn(1).width = 50; // Lebar kolom untuk informasi
  infoSheet.getColumn(2).width = 30; // Lebar kolom untuk value
  
  // Add data dengan styling (sama persis dengan Kuliah Besar)
  infoData.forEach((row, index) => {
    const worksheetRow = infoSheet.addRow(row);
    
    // Apply wrap text untuk semua cells
    worksheetRow.eachCell((cell: any) => {
      cell.alignment = { 
        vertical: 'top', 
        horizontal: 'left',
        wrapText: true 
      };
    });
    
    // Styling untuk header
    if (index === 0) {
      worksheetRow.font = { bold: true, size: 14 };
      worksheetRow.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    }
    
    // TIDAK ADA styling bold untuk "CATATAN:" (sesuai dengan Kuliah Besar)
  });
};

/**
 * Download Excel file to user's device
 * @param workbook - ExcelJS workbook object
 * @param filename - Name of the file to download
 */
const downloadExcelFile = async (workbook: any, filename: string) => {
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  window.URL.revokeObjectURL(url);
};

export default function DetailNonBlokCSR() {
  const { kode } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<MataKuliah | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [jadwalCSR, setJadwalCSR] = useState<JadwalCSR[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // State untuk dropdown options
  const [kelompokKecilList, setKelompokKecilList] = useState<KelompokKecilOption[]>([]);
  const [kategoriList, setKategoriList] = useState<KategoriOption[]>([]);
  const [dosenList, setDosenList] = useState<DosenOption[]>([]);
  const [ruanganList, setRuanganList] = useState<RuanganOption[]>([]);
  const [jamOptions, setJamOptions] = useState<string[]>([]);

  // Pagination state for CSR schedule
  const [csrPage, setCsrPage] = useState(1);
  const [csrPageSize, setCsrPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  const [form, setForm] = useState<{
    jenis_csr: 'reguler' | 'responsi' | '';
    tanggal: string;
    jam_mulai: string;
    jumlah_sesi: number;
    jam_selesai: string;
    dosen_id: number | null;
    ruangan_id: number | null;
    kelompok_kecil_id: number | null;
    kategori_id: number | null;
    topik: string;
  }>({
    jenis_csr: '',
    tanggal: '',
    jam_mulai: '',
    jumlah_sesi: 3,
    jam_selesai: '',
    dosen_id: null,
    ruangan_id: null,
    kelompok_kecil_id: null,
    kategori_id: null,
    topik: '',
  });
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [errorForm, setErrorForm] = useState(''); // Error frontend (validasi form)
  const [errorBackend, setErrorBackend] = useState(''); // Error backend (response API)
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteIndex, setSelectedDeleteIndex] = useState<number | null>(null);
  const [selectedKategoriValue, setSelectedKategoriValue] = useState<string | null>(null); // State untuk value dropdown
  const [selectedKeahlian, setSelectedKeahlian] = useState<string | null>(null); // State untuk keahlian yang dipilih

  // Memoized ruangan options untuk optimisasi performa
  const ruanganOptions = useMemo(() => getRuanganOptions(ruanganList || []), [ruanganList]);

  // Pagination logic functions - optimized with useCallback
  const getPaginatedData = useCallback((data: any[], page: number, pageSize: number): any[] => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, []);

  const getTotalPages = useCallback((dataLength: number, pageSize: number): number => {
    return Math.ceil(dataLength / pageSize);
  }, []);

  const resetPagination = useCallback(() => {
    setCsrPage(1);
  }, []);

  // State untuk import Excel CSR
  const [showCSRTemplateSelectionModal, setShowCSRTemplateSelectionModal] = useState(false);
  const [showCSRImportModal, setShowCSRImportModal] = useState(false);
  const [showCSRSIAKADImportModal, setShowCSRSIAKADImportModal] = useState(false);

  // State untuk Template Aplikasi
  const [csrImportFile, setCSRImportFile] = useState<File | null>(null);
  const [csrImportData, setCSRImportData] = useState<JadwalCSRType[]>([]);
  const [csrImportErrors, setCSRImportErrors] = useState<string[]>([]);
  const [csrCellErrors, setCSRCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [csrEditingCell, setCSREditingCell] = useState<{ row: number, key: string } | null>(null);
  const [csrImportPage, setCSRImportPage] = useState(1);
  const [csrImportPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [csrImportedCount, setCSRImportedCount] = useState(0);
  const [isCSRImporting, setIsCSRImporting] = useState(false);
  const csrFileInputRef = useRef<HTMLInputElement>(null);

  // State untuk Template SIAKAD
  const [csrSiakadImportFile, setCSRSiakadImportFile] = useState<File | null>(null);
  const [csrSiakadImportData, setCSRSiakadImportData] = useState<JadwalCSRType[]>([]);
  const [csrSiakadImportErrors, setCSRSiakadImportErrors] = useState<string[]>([]);
  const [csrSiakadCellErrors, setCSRSiakadCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [csrSiakadEditingCell, setCSRSiakadEditingCell] = useState<{ row: number, key: string } | null>(null);
  const [csrSiakadImportPage, setCSRSiakadImportPage] = useState(1);
  const [csrSiakadImportedCount, setCSRSiakadImportedCount] = useState(0);
  const [isCSRSiakadImporting, setIsCSRSiakadImporting] = useState(false);
  const csrSiakadFileInputRef = useRef<HTMLInputElement>(null);

  // State untuk bulk delete CSR
  const [selectedCSRItems, setSelectedCSRItems] = useState<number[]>([]);
  const [showCSRBulkDeleteModal, setShowCSRBulkDeleteModal] = useState(false);
  const [isCSRDeleting, setIsCSRDeleting] = useState(false);
  const [csrSuccess, setCSRSuccess] = useState<string | null>(null);

  // State untuk export Excel CSR
  const [showCSRExportModal, setShowCSRExportModal] = useState(false);
  const [selectedCSRExportTemplate, setSelectedCSRExportTemplate] = useState<'APLIKASI' | 'SIAKAD' | null>(null);

  // Hitung jam selesai otomatis - optimized with useCallback
  const hitungJamSelesai = useCallback((jamMulai: string, jumlahSesi: number) => {
    if (!jamMulai) return '';
    const [jamStr, menitStr] = jamMulai.split(/[.:]/);
    const jam = Number(jamStr);
    const menit = Number(menitStr);
    if (isNaN(jam) || isNaN(menit)) return '';
    const totalMenit = jam * 60 + menit + jumlahSesi * SESSION_DURATION_MINUTES;
    const jamAkhir = Math.floor(totalMenit / 60).toString().padStart(2, '0');
    const menitAkhir = (totalMenit % 60).toString().padStart(2, '0');
    return `${jamAkhir}.${menitAkhir}`;
  }, []);

  // Fungsi untuk download template Excel CSR
  const downloadCSRTemplate = async () => {
    try {
      // Ambil data yang diperlukan untuk template
      const kelompokKecilTersedia = kelompokKecilList.length > 0 ? kelompokKecilList.slice(0, 2) : [
        { id: 1, nama_kelompok: "1" },
        { id: 2, nama_kelompok: "2" }
      ];

      const ruanganTersedia = ruanganList.length > 0 ? ruanganList.slice(0, 2) : [
        { id: 1, nama: "Ruangan 1" },
        { id: 2, nama: "Ruangan 2" }
      ];

      const dosenTersedia = dosenList.length > 0 ? dosenList.slice(0, 2) : [
        { id: 1, name: "Dosen 1" },
        { id: 2, name: "Dosen 2" }
      ];

      const keahlianTersedia = kategoriList.length > 0 ? kategoriList.flatMap(kategori =>
        (kategori.keahlian_required || []).slice(0, 1)
      ).slice(0, 2) : ["Kardiologi", "Neurologi"];

      // Hitung jumlah mahasiswa per kelompok kecil (sama seperti PBL)
      const kelompokKecilWithCount = kelompokKecilList.reduce((acc: any[], item: any) => {
        const existingGroup = acc.find(group => group.nama_kelompok === item.nama_kelompok);
        if (existingGroup) {
          existingGroup.jumlah_anggota = (existingGroup.jumlah_anggota || 0) + 1;
        } else {
          acc.push({
            id: item.id,
            nama_kelompok: item.nama_kelompok,
            jumlah_anggota: 1
          });
        }
        return acc;
      }, []);

      // Generate tanggal dalam rentang mata kuliah
      const tanggalMulai = data?.tanggal_mulai;
      const tanggalAkhir = data?.tanggal_akhir;

      let contohTanggal1 = "2024-01-15";
      let contohTanggal2 = "2024-01-16";

      if (tanggalMulai && tanggalAkhir) {
        const mulai = new Date(tanggalMulai);
        const akhir = new Date(tanggalAkhir);
        const selisihHari = Math.floor((akhir.getTime() - mulai.getTime()) / (1000 * 60 * 60 * 24));

        // Contoh tanggal 1: 1/4 dari rentang
        const hari1 = Math.floor(selisihHari * 0.25);
        const contoh1 = new Date(mulai);
        contoh1.setDate(contoh1.getDate() + hari1);
        contohTanggal1 = contoh1.toISOString().split('T')[0];

        // Contoh tanggal 2: 3/4 dari rentang
        const hari2 = Math.floor(selisihHari * 0.75);
        const contoh2 = new Date(mulai);
        contoh2.setDate(contoh2.getDate() + hari2);
        contohTanggal2 = contoh2.toISOString().split('T')[0];
      }

      // Data template dengan data real
      const templateData = [
        {
          'Jenis CSR': 'reguler',
          'Tanggal': contohTanggal1,
          'Jam Mulai': '07.20',
          'Kelompok Kecil': kelompokKecilTersedia[0]?.nama_kelompok || '1',
          'Topik': 'Pemeriksaan Fisik Sistem Kardiovaskular',
          'Keahlian': keahlianTersedia[0] || 'Kardiologi',
          'Dosen': dosenTersedia[0]?.name || 'Dosen 1',
          'Ruangan': ruanganTersedia[0]?.nama || 'Ruangan 1'
        },
        {
          'Jenis CSR': 'responsi',
          'Tanggal': contohTanggal2,
          'Jam Mulai': '08.10',
          'Kelompok Kecil': kelompokKecilTersedia[1]?.nama_kelompok || '2',
          'Topik': 'Interpretasi EKG',
          'Keahlian': keahlianTersedia[1] || keahlianTersedia[0] || 'Kardiologi',
          'Dosen': dosenTersedia[1]?.name || dosenTersedia[0]?.name || 'Dosen 2',
          'Ruangan': ruanganTersedia[1]?.nama || 'Ruangan 2'
        }
      ];

      // Buat workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Template CSR dengan header yang eksplisit
      const ws = XLSX.utils.json_to_sheet(templateData, {
        header: ['Tanggal', 'Jam Mulai', 'Jenis CSR', 'Kelompok Kecil', 'Topik', 'Keahlian', 'Dosen', 'Ruangan']
      });

      // Set lebar kolom
      const colWidths = [
        { wch: EXCEL_COLUMN_WIDTHS.TANGGAL },
        { wch: EXCEL_COLUMN_WIDTHS.JAM_MULAI },
        { wch: EXCEL_COLUMN_WIDTHS.JENIS_CSR },
        { wch: EXCEL_COLUMN_WIDTHS.KELOMPOK_KECIL },
        { wch: EXCEL_COLUMN_WIDTHS.TOPIK },
        { wch: EXCEL_COLUMN_WIDTHS.KEAHLIAN },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: EXCEL_COLUMN_WIDTHS.RUANGAN }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Template CSR');

      // Sheet 2: Tips dan Info
      const infoData = [
        ['TIPS DAN INFORMASI IMPORT JADWAL CSR'],
        [''],
        ['CARA UPLOAD FILE:'],
        ['1. Download template ini dan isi dengan data jadwal CSR'],
        ['2. Pastikan semua kolom wajib diisi dengan benar'],
        ['3. Upload file Excel yang sudah diisi ke sistem'],
        ['4. Periksa preview data dan perbaiki error jika ada'],
        ['5. Klik "Import Data" untuk menyimpan jadwal'],
        [''],
        ['CARA EDIT DATA:'],
        ['1. Klik pada kolom yang ingin diedit di tabel preview'],
        ['2. Ketik atau paste data yang benar'],
        ['3. Sistem akan otomatis validasi dan update error'],
        ['4. Pastikan tidak ada error sebelum import'],
        [''],
        ['KETERSEDIAAN DATA:'],
        [''],
        ['JAM YANG TERSEDIA:'],
        ...jamOptions.map(jam => [`• ${jam}`]),
        [''],
        ['KELOMPOK KECIL YANG TERSEDIA:'],
        ...(kelompokKecilWithCount && kelompokKecilWithCount.length > 0 ?
          kelompokKecilWithCount
            .map(kelompok => [`• Kelompok ${kelompok.nama_kelompok} (${kelompok.jumlah_anggota} mahasiswa)`]) :
          [['• Belum ada data kelompok kecil']]
        ),
        [''],
        ['KEAHLIAN YANG TERSEDIA:'],
        ...(kategoriList.length > 0 ?
          kategoriList.flatMap(kategori =>
            (kategori.keahlian_required || []).slice(0, 3).map(keahlian => [`• ${keahlian} (${kategori.nomor_csr})`])
          ) :
          [['• Belum ada data keahlian']]
        ),
        [''],
        ['DOSEN YANG TERSEDIA (berdasarkan keahlian):'],
        ['• Dosen ditampilkan per keahlian untuk memudahkan pemilihan'],
        ['• Pastikan keahlian dosen sesuai dengan kategori CSR yang dipilih'],
        [''],
        ...(() => {
          // Group dosen by keahlian
          const dosenByKeahlian = new Map<string, typeof dosenList>();
          dosenList.forEach(dosen => {
            const keahlian = dosen.keahlian || 'Tidak ada keahlian';
            if (!dosenByKeahlian.has(keahlian)) {
              dosenByKeahlian.set(keahlian, []);
            }
            dosenByKeahlian.get(keahlian)!.push(dosen);
          });

          // Generate output per keahlian
          const result: string[][] = [];
          dosenByKeahlian.forEach((dosenGroup, keahlian) => {
            result.push([`${keahlian}:`]);
            dosenGroup.forEach(dosen => {
              result.push([`  • ${dosen.name}${dosen.nid ? ` (${dosen.nid})` : ''}`]);
            });
            result.push(['']); // Empty line between keahlian groups
          });
          
          return result.length > 1 ? result : [['• Belum ada data dosen']];
        })(),
        [''],
        ['RUANGAN YANG TERSEDIA:'],
        ...(ruanganList.length > 0 ?
          ruanganList.map(ruangan => [`• ${ruangan.nama}${ruangan.kapasitas ? ` (Kapasitas: ${ruangan.kapasitas} orang)` : ''}${ruangan.gedung ? ` - ${ruangan.gedung}` : ''}`]) :
          [['• Belum ada data ruangan']]
        ),
        [''],
        ['VALIDASI SISTEM:'],
        [''],
        ['VALIDASI TANGGAL:'],
        ['• Format: YYYY-MM-DD (contoh: 2024-01-15)'],
        ['• Wajib dalam rentang mata kuliah:'],
        [`  - Mulai: ${data?.tanggal_mulai ? new Date(data.tanggal_mulai).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}`],
        [`  - Akhir: ${data?.tanggal_akhir ? new Date(data.tanggal_akhir).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }) : '-'}`],
        [''],
        ['VALIDASI JAM:'],
        ['• Format: HH:MM atau HH.MM (contoh: 07:20 atau 07.20)'],
        ['• Jam mulai harus sesuai opsi yang tersedia'],
        ['• Jam selesai akan dihitung otomatis berdasarkan jenis CSR:'],
        ['  - CSR Reguler: Jam mulai + (3 x 50 menit)'],
        ['  - CSR Responsi: Jam mulai + (2 x 50 menit)'],
        [''],
        ['VALIDASI JENIS CSR:'],
        ['• Jenis CSR: "reguler" atau "responsi"'],
        [`• CSR Reguler = ${CSR_REGULER_SESSIONS} sesi (${CSR_REGULER_SESSIONS * SESSION_DURATION_MINUTES} menit)`],
        [`• CSR Responsi = ${CSR_RESPONSI_SESSIONS} sesi (${CSR_RESPONSI_SESSIONS * SESSION_DURATION_MINUTES} menit)`],
        [''],
        ['VALIDASI KELOMPOK KECIL:'],
        ['• Kelompok kecil wajib diisi'],
        ['• Nama kelompok kecil harus ada di database'],
        [''],
        ['VALIDASI KEAHLIAN:'],
        ['• Keahlian wajib diisi'],
        ['• Keahlian harus sesuai dengan dosen yang dipilih'],
        ['• Dosen harus memiliki keahlian yang sesuai'],
        [''],
        ['VALIDASI DOSEN:'],
        ['• Dosen wajib diisi (1 dosen)'],
        ['• Nama dosen harus ada di database'],
        ['• Dosen harus memiliki keahlian yang sesuai dengan keahlian yang dipilih'],
        [''],
        ['VALIDASI RUANGAN:'],
        ['• Ruangan wajib diisi'],
        ['• Nama ruangan harus ada di database'],
        ['• Kapasitas ruangan harus mencukupi jumlah mahasiswa'],
        [''],
        ['TIPS PENTING:'],
        ['• Gunakan data yang ada di list ketersediaan di atas'],
        ['• Periksa preview sebelum import'],
        ['• Edit langsung di tabel preview jika ada error'],
        ['• Sistem akan highlight error dengan warna merah'],
        ['• Tooltip akan menampilkan pesan error detail'],
        ['• Pastikan jadwal Dosen dan Ruangan tidak bentrok dengan jadwal lain']
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Tips dan Info');

      // Download file
      XLSX.writeFile(wb, `Template_Import_CSR_${data?.kode || 'MataKuliah'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      alert('Gagal mendownload template CSR. Silakan coba lagi.');
    }
  };

  // Helper function untuk konversi format waktu - optimized with useCallback
  const convertTimeFormat = useCallback((timeStr: string) => {
    if (!timeStr || timeStr.trim() === '') return '';

    // Hapus spasi dan konversi ke string
    const time = timeStr.toString().trim();

    // Cek apakah sudah dalam format yang benar (HH:MM atau HH.MM)
    if (time.match(/^\d{2}[:.]\d{2}$/)) {
      return time.replace('.', ':');
    }

    // Cek apakah format H:MM atau H.MM (1 digit jam)
    if (time.match(/^\d{1}[:.]\d{2}$/)) {
      return '0' + time.replace('.', ':');
    }

    return time;
  }, []);

  // Fungsi untuk membaca file Excel CSR
  const readCSRExcelFile = async (file: File) => {
    return new Promise<{ data: any[], headers: string[], format: 'template' | 'export' }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          // Ambil sheet pertama
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          // Konversi ke JSON
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          // Ambil header (baris pertama)
          const headers = jsonData[0] as string[];
          const headerStr = headers.join(' ').toLowerCase();

          // Deteksi format berdasarkan header
          // Format export template aplikasi: memiliki 'No' di awal, tanpa 'Jam Selesai' dan 'Sesi'
          // Format template download: tidak memiliki 'No' di awal
          let format: 'template' | 'export' = 'template';
          const hasNo = headerStr.includes('no') && headers[0]?.toLowerCase().includes('no');
          const hasJamSelesai = headerStr.includes('jam selesai');
          const hasSesi = headerStr.includes('sesi');

          // Jika ada 'No' di kolom pertama dan tidak ada 'Jam Selesai' dan 'Sesi', maka ini format export template aplikasi
          if (hasNo && !hasJamSelesai && !hasSesi) {
            format = 'export';
          }

          // Ambil data (baris kedua dan seterusnya)
          const dataRows = jsonData.slice(1).filter(row =>
            row && Array.isArray(row) && row.some(cell => cell !== undefined && cell !== '')
          );

          resolve({ data: dataRows, headers, format });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Fungsi untuk handle import Excel CSR
  const handleCSRImportExcel = async (file: File) => {
    try {
      const { data: excelData, headers, format } = await readCSRExcelFile(file);

      // Cek format header berdasarkan format yang dideteksi
      let expectedHeaders: string[];
      if (format === 'export') {
        expectedHeaders = ['No', 'Tanggal', 'Jam Mulai', 'Jenis CSR', 'Kelompok Kecil', 'Topik', 'Keahlian', 'Dosen', 'Ruangan'];
      } else {
        expectedHeaders = ['Tanggal', 'Jam Mulai', 'Jenis CSR', 'Kelompok Kecil', 'Topik', 'Keahlian', 'Dosen', 'Ruangan'];
      }

      // Simple strict validation - sama seperti DetailBlok.tsx
      const headerMatch = expectedHeaders.every(header => headers.includes(header));

      if (!headerMatch) {
        setCSRImportErrors(['Template tidak valid. Pastikan menggunakan template dari aplikasi ini.']);
        setShowCSRImportModal(true);
        return;
      }

      if (excelData.length === 0) {
        setCSRImportErrors(['File Excel kosong atau tidak memiliki data']);
        setShowCSRImportModal(true);
        return;
      }

      // Konversi data Excel ke format yang diinginkan berdasarkan format yang dideteksi
      const convertedData: JadwalCSRType[] = excelData.map((row: any[], index: number) => {
        let tanggal, jamMulai, jenisCSR, kelompokKecilNama, topik, keahlianNama, dosenNama, ruanganNama;

        if (format === 'export') {
          // Format export: No, Tanggal, Jam Mulai, Jenis CSR, Kelompok Kecil, Topik, Keahlian, Dosen, Ruangan
          tanggal = row[1]?.toString();
          jamMulai = row[2]?.toString();
          // Handle jenis CSR dari export yang mungkin "CSR Reguler" atau "CSR Responsi"
          const jenisCSRExport = row[3]?.toString().toLowerCase();
          jenisCSR = jenisCSRExport?.includes('reguler') ? 'reguler' : jenisCSRExport?.includes('responsi') ? 'responsi' : jenisCSRExport;
          kelompokKecilNama = row[4]?.toString();
          topik = row[5]?.toString();
          keahlianNama = row[6]?.toString();
          dosenNama = row[7]?.toString();
          ruanganNama = row[8]?.toString();
        } else {
          // Format template: Tanggal, Jam Mulai, Jenis CSR, Kelompok Kecil, Topik, Keahlian, Dosen, Ruangan
          tanggal = row[0]?.toString();
          jamMulai = row[1]?.toString();
          jenisCSR = row[2]?.toString().toLowerCase();
          kelompokKecilNama = row[3]?.toString();
          topik = row[4]?.toString();
          keahlianNama = row[5]?.toString();
          dosenNama = row[6]?.toString();
          ruanganNama = row[7]?.toString();
        }


        // Handle jam yang tidak valid dan normalize format
        if (jamMulai) {
          // Bersihkan data jam dari karakter yang tidak diinginkan
          jamMulai = jamMulai.toString().trim();
          // Handle jam yang tidak valid (00.00 atau kosong)
          if (jamMulai === '00.00' || jamMulai === '00:00' || jamMulai === '0' || jamMulai === '0.00') {
            jamMulai = '';
          } else {
            // Konversi format waktu dengan leading zero
            jamMulai = convertTimeFormat(jamMulai);
            // Normalize format jam (pastikan menggunakan format HH.MM)
            if (jamMulai.includes(':')) {
              jamMulai = jamMulai.replace(':', '.');
            }
            // Pastikan format jam valid (HH.MM)
            if (!/^\d{1,2}\.\d{2}$/.test(jamMulai)) {
              jamMulai = '';
            }
          }
        } else {
          jamMulai = '';
        }

        // Hitung jam selesai otomatis berdasarkan jenis CSR
        const jumlahSesi = jenisCSR === 'reguler' ? CSR_REGULER_SESSIONS : CSR_RESPONSI_SESSIONS;
        const jamSelesai = hitungJamSelesai(jamMulai || '08:00', jumlahSesi);


        // Cari ID berdasarkan nama
        const kelompokKecil = kelompokKecilList.find(k => k.nama_kelompok === kelompokKecilNama);
        const kategori = kategoriList.find(k => k.keahlian_required?.includes(keahlianNama));
        const dosen = dosenList.find(d => d.name === dosenNama);
        const ruangan = ruanganList.find(r => r.nama === ruanganNama);

        return {
          jenis_csr: jenisCSR as 'reguler' | 'responsi',
          tanggal: tanggal || '',
          jam_mulai: jamMulai || '',
          jam_selesai: jamSelesai,
          jumlah_sesi: jumlahSesi,
          kelompok_kecil_id: kelompokKecil?.id || 0,
          topik: topik || '',
          kategori_id: kategori?.id || 0,
          dosen_id: dosen?.id || 0,
          ruangan_id: ruangan?.id || 0,
          nama_kelompok: kelompokKecilNama,
          nama_keahlian: keahlianNama,
          nama_dosen: dosenNama,
          nama_ruangan: ruanganNama
        };
      });

      setCSRImportData(convertedData);

      // Validasi data setelah konversi
      const { cellErrors } = validateCSRExcelData(convertedData);
      setCSRCellErrors(cellErrors);
      setCSRImportErrors([]);
      setShowCSRImportModal(true);
    } catch (error) {
      setCSRImportErrors(['Gagal membaca file Excel: ' + (error as Error).message]);
      setShowCSRImportModal(true);
    }
  };

  // Helper function untuk validasi tanggal
  const validateDate = (tanggal: string, rowNumber: number): string | null => {
    if (!tanggal) {
      return `Baris ${rowNumber}: Tanggal wajib diisi`;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(tanggal)) {
      return `Baris ${rowNumber}: Format tanggal harus YYYY-MM-DD`;
    }

    // Validasi rentang tanggal mata kuliah
    const tanggalMulai = data?.tanggal_mulai ? new Date(data.tanggal_mulai) : null;
    const tanggalAkhir = data?.tanggal_akhir ? new Date(data.tanggal_akhir) : null;
    const tanggalJadwal = new Date(tanggal);

    if (tanggalMulai && tanggalAkhir && (tanggalJadwal < tanggalMulai || tanggalJadwal > tanggalAkhir)) {
      return `Baris ${rowNumber}: Tanggal di luar rentang mata kuliah`;
    }

    return null;
  };

  // Helper function untuk validasi jam
  const validateTime = (jam: string, rowNumber: number, fieldName: string): string | null => {
    if (!jam) {
      return `Baris ${rowNumber}: ${fieldName} wajib diisi`;
    }

    if (!/^\d{1,2}[.:]\d{2}$/.test(jam)) {
      return `Baris ${rowNumber}: Format ${fieldName} harus HH:MM atau HH.MM`;
    }

    // Validasi jam sesuai dengan opsi yang tersedia
    const normalizeTimeForComparison = (time: string): string => {
      if (!time) return time;
      return time.replace('.', ':');
    };

    const isTimeValid = (inputTime: string): boolean => {
      const normalizedInput = normalizeTimeForComparison(inputTime);
      return jamOptions.some(option => normalizeTimeForComparison(option) === normalizedInput);
    };

    if (!isTimeValid(jam)) {
      return `Baris ${rowNumber}: ${fieldName} "${jam}" tidak valid. Jam yang tersedia: ${jamOptions.join(', ')}`;
    }

    return null;
  };

  // Fungsi untuk validasi data Excel CSR
  const validateCSRExcelData = (dataRows: JadwalCSRType[]) => {
    const errors: { row: number, field: string, message: string }[] = [];

    dataRows.forEach((row, index) => {
      const rowNumber = index + 1;

      // Validasi jenis CSR
      if (!row.jenis_csr) {
        errors.push({ row: rowNumber, field: 'jenis_csr', message: `Baris ${rowNumber}: Jenis CSR wajib diisi` });
      } else if (!['reguler', 'responsi'].includes(row.jenis_csr)) {
        errors.push({ row: rowNumber, field: 'jenis_csr', message: `Baris ${rowNumber}: Jenis CSR harus "reguler" atau "responsi"` });
      }

      // Validasi tanggal
      const tanggalError = validateDate(row.tanggal, rowNumber);
      if (tanggalError) {
        errors.push({ row: rowNumber, field: 'tanggal', message: tanggalError });
      }

      // Validasi jam mulai
      const jamMulaiError = validateTime(row.jam_mulai, rowNumber, 'Jam Mulai');
      if (jamMulaiError) {
        errors.push({ row: rowNumber, field: 'jam_mulai', message: jamMulaiError });
      }

      // Validasi jumlah sesi berdasarkan jenis CSR (otomatis)
      const jumlahSesi = row.jenis_csr === 'reguler' ? CSR_REGULER_SESSIONS : CSR_RESPONSI_SESSIONS;


      // Validasi kelompok kecil
      if (!row.kelompok_kecil_id || row.kelompok_kecil_id === 0) {
        errors.push({ row: rowNumber, field: 'kelompok_kecil_id', message: `Baris ${rowNumber}: Kelompok kecil wajib diisi` });
      } else {
        const kelompokKecil = kelompokKecilList.find(k => k.id === row.kelompok_kecil_id);
        if (!kelompokKecil) {
          errors.push({ row: rowNumber, field: 'kelompok_kecil_id', message: `Baris ${rowNumber}: Kelompok kecil tidak ditemukan` });
        }
      }

      // Validasi topik
      if (!row.topik) {
        errors.push({ row: rowNumber, field: 'topik', message: `Baris ${rowNumber}: Topik wajib diisi` });
      }

      // Validasi keahlian/kategori
      if (!row.kategori_id || row.kategori_id === 0) {
        errors.push({ row: rowNumber, field: 'kategori_id', message: `Baris ${rowNumber}: Keahlian wajib diisi` });
      } else {
        const kategori = kategoriList.find(k => k.id === row.kategori_id);
        if (!kategori) {
          errors.push({ row: rowNumber, field: 'kategori_id', message: `Baris ${rowNumber}: Keahlian tidak ditemukan` });
        }
      }

      // Validasi dosen
      if (!row.dosen_id || row.dosen_id === 0) {
        errors.push({ row: rowNumber, field: 'dosen_id', message: `Baris ${rowNumber}: Dosen wajib diisi` });
      } else {
        const dosen = dosenList.find(d => d.id === row.dosen_id);
        if (!dosen) {
          errors.push({ row: rowNumber, field: 'dosen_id', message: `Baris ${rowNumber}: Dosen tidak ditemukan` });
        } else {
          // Validasi keahlian dosen sesuai dengan kategori
          if (row.kategori_id) {
            const kategori = kategoriList.find(k => k.id === row.kategori_id);
            if (kategori && kategori.keahlian_required && !kategori.keahlian_required.includes(dosen.keahlian)) {
              errors.push({
                row: rowNumber,
                field: 'dosen_id',
                message: `Baris ${rowNumber}: Dosen "${dosen.name}" tidak memiliki keahlian "${kategori.keahlian_required.join(', ')}"`
              });
            }
          }
        }
      }

      // Validasi ruangan
      if (!row.ruangan_id || row.ruangan_id === 0) {
        errors.push({ row: rowNumber, field: 'ruangan_id', message: `Baris ${rowNumber}: Ruangan wajib diisi` });
      } else {
        const ruangan = ruanganList.find(r => r.id === row.ruangan_id);
        if (!ruangan) {
          errors.push({ row: rowNumber, field: 'ruangan_id', message: `Baris ${rowNumber}: Ruangan tidak ditemukan` });
        }
      }
    });

    return { cellErrors: errors };
  };

  // Fungsi untuk submit import CSR
  const handleCSRSubmitImport = async () => {
    try {
      setIsCSRImporting(true);
      setCSRImportErrors([]);

      // Validasi data terlebih dahulu
      const { cellErrors } = validateCSRExcelData(csrImportData);

      if (cellErrors.length > 0) {
        setCSRCellErrors(cellErrors);
        setIsCSRImporting(false);
        return;
      }

      // Transform data untuk API
      const transformedData = csrImportData.map((row, index) => {
        // Normalize jam format - pastikan menggunakan format HH.MM
        let jamMulai = row.jam_mulai;
        let jamSelesai = row.jam_selesai;

        if (jamMulai && jamMulai.includes(':')) {
          jamMulai = jamMulai.replace(':', '.');
        }
        if (jamSelesai && jamSelesai.includes(':')) {
          jamSelesai = jamSelesai.replace(':', '.');
        }

        // Pastikan format jam valid sebelum dikirim
        if (jamMulai && !/^\d{1,2}\.\d{2}$/.test(jamMulai)) {
          jamMulai = '';
        }
        if (jamSelesai && !/^\d{1,2}\.\d{2}$/.test(jamSelesai)) {
          jamSelesai = '';
        }

        const transformedRow = {
          jenis_csr: row.jenis_csr,
          tanggal: row.tanggal,
          jam_mulai: jamMulai,
          jam_selesai: jamSelesai,
          jumlah_sesi: row.jumlah_sesi,
          kelompok_kecil_id: row.kelompok_kecil_id,
          topik: row.topik,
          kategori_id: row.kategori_id,
          dosen_id: row.dosen_id,
          ruangan_id: row.ruangan_id,
          // SIAKAD fields
          siakad_kurikulum: row.siakad_kurikulum || null,
          siakad_kode_mk: row.siakad_kode_mk || null,
          siakad_nama_kelas: row.siakad_nama_kelas || null,
          siakad_jenis_pertemuan: row.siakad_jenis_pertemuan || null,
          siakad_metode: row.siakad_metode || null,
          siakad_dosen_pengganti: row.siakad_dosen_pengganti || null
        };

        return transformedRow;
      });

      // Kirim ke backend
      const response = await api.post(`/csr/jadwal/${kode}/import`, {
        data: transformedData
      });

      if (response.data.success) {
        setCSRImportedCount(transformedData.length);
        setShowCSRImportModal(false);
        // Cleanup data setelah import berhasil
        setCSRImportData([]);
        setCSRImportFile(null);
        setCSRImportErrors([]);
        setCSRCellErrors([]);
        setCSREditingCell(null);
        setCSRImportPage(1);

        // Refresh data
        await fetchBatchData();
      } else {
        // Handle error dari response
        setCSRImportErrors([response.data.message || 'Terjadi kesalahan saat mengimport data']);
        // Tidak import data jika ada error - all or nothing
      }
    } catch (error: any) {
      // Handle error dari API response
      if (error.response?.status === 422) {
        const errorData = error.response.data;
        if (errorData.errors && Array.isArray(errorData.errors)) {
          // Parse error messages yang sudah dalam format "Baris X: [pesan]"
          const cellErrors = errorData.errors.map((err: string) => {
            // Extract row number dari error message
            const rowMatch = err.match(/Baris\s+(\d+):/);
            const row = rowMatch ? parseInt(rowMatch[1]) : 0;
            return {
              row: row,
              field: 'api',
              message: err
            };
          });
          setCSRCellErrors(cellErrors);
        } else {
          setCSRImportErrors([errorData.message || 'Terjadi kesalahan validasi']);
        }
      } else if (error.response?.data?.message) {
        setCSRImportErrors([error.response.data.message]);
      } else {
        setCSRImportErrors([handleApiError(error, 'Mengimport data CSR')]);
      }
    } finally {
      setIsCSRImporting(false);
    }
  };

  // Handler untuk upload file Excel CSR
  const handleCSRImportExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setCSRImportErrors(['Format file Excel tidak dikenali. Harap gunakan file .xlsx atau .xls']);
      setShowCSRImportModal(true);
      return;
    }

    setCSRImportFile(file);
    await handleCSRImportExcel(file);
  };

  // Handler untuk template selection
  const handleCSRTemplateSelection = (template: 'APLIKASI' | 'SIAKAD') => {
    setShowCSRTemplateSelectionModal(false);
    if (template === 'APLIKASI') {
      setShowCSRImportModal(true);
    } else {
      setShowCSRSIAKADImportModal(true);
    }
  };

  // Handler untuk hapus file CSR
  const handleCSRRemoveFile = () => {
    setCSRImportFile(null);
    setCSRImportData([]);
    setCSRImportErrors([]);
    setCSRCellErrors([]);
    setCSRImportPage(1);
    setCSREditingCell(null);
    if (csrFileInputRef.current) {
      csrFileInputRef.current.value = '';
    }
  };

  // Handler untuk edit cell CSR
  const handleCSREditCell = (rowIndex: number, field: string, value: any) => {
    const updatedData = [...csrImportData];
    updatedData[rowIndex] = { ...updatedData[rowIndex], [field]: value };

    // Jika mengedit jenis_csr atau jam_mulai, hitung ulang jam selesai dan jumlah sesi
    if (field === 'jenis_csr' || field === 'jam_mulai') {
      const jenisCSR = field === 'jenis_csr' ? value : updatedData[rowIndex].jenis_csr;
      const jamMulai = field === 'jam_mulai' ? value : updatedData[rowIndex].jam_mulai;
      const jumlahSesi = jenisCSR === 'reguler' ? CSR_REGULER_SESSIONS : CSR_RESPONSI_SESSIONS;
      const jamSelesai = hitungJamSelesai(jamMulai || '08:00', jumlahSesi);

      updatedData[rowIndex] = {
        ...updatedData[rowIndex],
        jam_selesai: jamSelesai,
        jumlah_sesi: jumlahSesi
      };
    }

    setCSRImportData(updatedData);

    // Re-validate data after edit
    const { cellErrors } = validateCSRExcelData(updatedData);
    setCSRCellErrors(cellErrors);
  };

  // Fungsi untuk render editable cell
  const renderCSREditableCell = (field: string, value: any, rowIndex: number, isReadOnly: boolean = false) => {
    const actualIndex = (csrImportPage - 1) * csrImportPageSize + rowIndex;
    const isEditing = csrEditingCell?.row === actualIndex && csrEditingCell?.key === field;
    const hasError = csrCellErrors.find(err => err.row === (actualIndex + 1) && err.field === field);

    return (
      <td
        className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${hasError ? 'bg-red-50 dark:bg-red-900/30' : ''}`}
        onClick={() => !isReadOnly && setCSREditingCell({ row: actualIndex, key: field })}
        title={hasError?.message || ''}
      >
        {isEditing ? (
          <input
            className="w-full px-1 border-none outline-none text-xs md:text-sm"
            value={value || ""}
            onChange={e => handleCSREditCell(actualIndex, field, e.target.value)}
            onBlur={() => setCSREditingCell(null)}
            autoFocus
          />
        ) : (
          <span className={hasError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
            {value || '-'}
          </span>
        )}
      </td>
    );
  };

  // Handler untuk edit kelompok kecil
  const handleCSRKelompokKecilEdit = (rowIndex: number, value: string) => {
    const kelompokKecil = kelompokKecilList.find(k => k.nama_kelompok === value);

    // Update data dan validasi sekaligus
    const updatedData = [...csrImportData];
    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      kelompok_kecil_id: kelompokKecil?.id || 0,
      nama_kelompok: value
    };

    setCSRImportData(updatedData);

    // Re-validate
    const { cellErrors } = validateCSRExcelData(updatedData);
    setCSRCellErrors(cellErrors);
  };

  // Handler untuk edit dosen
  const handleCSRDosenEdit = (rowIndex: number, value: string) => {
    const dosen = dosenList.find(d => d.name === value);

    // Update data dan validasi sekaligus
    const updatedData = [...csrImportData];
    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      dosen_id: dosen?.id || 0,
      nama_dosen: value
    };

    setCSRImportData(updatedData);

    // Re-validate
    const { cellErrors } = validateCSRExcelData(updatedData);
    setCSRCellErrors(cellErrors);
  };

  // Handler untuk edit ruangan
  const handleCSRRuanganEdit = (rowIndex: number, value: string) => {
    const ruangan = ruanganList.find(r => r.nama === value);

    // Update data dan validasi sekaligus
    const updatedData = [...csrImportData];
    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      ruangan_id: ruangan?.id || 0,
      nama_ruangan: value
    };

    setCSRImportData(updatedData);

    // Re-validate
    const { cellErrors } = validateCSRExcelData(updatedData);
    setCSRCellErrors(cellErrors);
  };

  // Handler untuk edit keahlian
  const handleCSRKeahlianEdit = (rowIndex: number, value: string) => {
    const kategori = kategoriList.find(k => k.keahlian_required?.includes(value));

    // Update data dan validasi sekaligus
    const updatedData = [...csrImportData];
    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      kategori_id: kategori?.id || 0,
      nama_keahlian: value
    };

    setCSRImportData(updatedData);

    // Re-validate
    const { cellErrors } = validateCSRExcelData(updatedData);
    setCSRCellErrors(cellErrors);
  };

  // ==================== SIAKAD TEMPLATE FUNCTIONS ====================

  // Validate SIAKAD template format
  const validateCSRSIAKADTemplateFormat = async (file: File): Promise<boolean> => {
    try {
      const { headers } = await readCSRExcelFile(file);

      const requiredHeaders = [
        'Tanggal\n(YYYY-MM-DD)',
        'Waktu Mulai\n(Lihat Daftar Waktu Mulai)',
        'Kelompok\n(Contoh: 1)',
        'Topik',
        'Ruang\n(Lihat Daftar Ruang)'
      ];

      // Function to check header with various line break formats
      const checkHeaderExists = (requiredHeader: string) => {
        // Check original format
        if (headers.includes(requiredHeader)) return true;

        // Check format without line break
        const withoutLineBreak = requiredHeader.replace(/\n.*/, '');
        if (headers.includes(withoutLineBreak)) return true;

        // Check format with \r\n
        const withWindowsLineBreak = requiredHeader.replace(/\n/g, '\r\n');
        if (headers.includes(withWindowsLineBreak)) return true;

        // Check format with \r\n and without parenthetical
        const withWindowsLineBreakNoParenthetical = withWindowsLineBreak.replace(/\([^)]*\)/g, '');
        if (headers.includes(withWindowsLineBreakNoParenthetical.trim())) return true;

        return false;
      };

      const isValid = requiredHeaders.every(header => checkHeaderExists(header));
      return isValid;
    } catch (error) {
      return false;
    }
  };

  // Read SIAKAD Excel file
  const readCSRSIAKADExcelFile = async (file: File) => {
    return new Promise<{ data: any[], headers: string[] }>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });

          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];

          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

          if (jsonData.length < 2) {
            reject(new Error('File Excel kosong atau tidak memiliki header'));
            return;
          }

          const headers = jsonData[0] as string[];
          const dataRows = jsonData.slice(1).filter(row =>
            row && Array.isArray(row) && row.some(cell => cell !== undefined && cell !== '')
          );

          resolve({ data: dataRows, headers });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Handle SIAKAD Excel import
  const handleCSRSIAKADImportExcel = async (file: File) => {
    try {
      // Validate template format
      const isValid = await validateCSRSIAKADTemplateFormat(file);
      if (!isValid) {
        setCSRSiakadImportErrors(['Template tidak valid. Pastikan menggunakan template SIAKAD yang benar.']);
        setShowCSRSIAKADImportModal(true);
        return;
      }

      const { data: excelData, headers } = await readCSRSIAKADExcelFile(file);

      if (excelData.length === 0) {
        setCSRSiakadImportErrors(['File Excel kosong atau tidak memiliki data']);
        setShowCSRSIAKADImportModal(true);
        return;
      }

      // Find column indices
      const findColumnIndex = (possibleNames: string[]) => {
        for (const name of possibleNames) {
          const index = headers.findIndex(h => {
            const headerLower = h.toLowerCase().replace(/\s+/g, '');
            const nameLower = name.toLowerCase().replace(/\s+/g, '');
            return headerLower.includes(nameLower) || nameLower.includes(headerLower);
          });
          if (index !== -1) return index;
        }
        return -1;
      };

      // Helper function to get value from multiple possible column names
      const getValueFromMultipleFormats = (possibleNames: string[], rowObj: any) => {
        for (const name of possibleNames) {
          const value = rowObj[name];
          if (value !== undefined && value !== null && value !== '') {
            return value.toString();
          }
        }
        return '';
      };

      // Convert data
      const convertedData: JadwalCSRType[] = excelData.map((row: any[], index) => {
        // Convert row array to object for easier access
        const rowObj: any = {};
        headers.forEach((header, idx) => {
          rowObj[header] = row[idx];
        });

        // Extract data from SIAKAD template
        const tanggal = getValueFromMultipleFormats(['Tanggal\n(YYYY-MM-DD)', 'Tanggal'], rowObj);
        const jamMulaiRaw = getValueFromMultipleFormats(['Waktu Mulai\n(Lihat Daftar Waktu Mulai)', 'Waktu Mulai'], rowObj);
        let jamMulai = convertTimeFormat(jamMulaiRaw);
        const jamSelesaiRaw = getValueFromMultipleFormats(['Waktu Selesai\n(Lihat Daftar Waktu Selesai)', 'Waktu Selesai'], rowObj);
        let jamSelesai = convertTimeFormat(jamSelesaiRaw);

        // SIAKAD fields dari file asli
        const siakadKurikulum = rowObj['Kurikulum'] || '';
        const siakadKodeMk = rowObj['Kode MK'] || '';
        const siakadNamaKelas = rowObj['Nama Kelas'] || '';
        const siakadJenisPertemuan = getValueFromMultipleFormats(['Jenis Pertemuan\n(Lihat Daftar Jenis Pertemuan)', 'Jenis Pertemuan'], rowObj);
        const siakadMetode = getValueFromMultipleFormats(['Metode\n(Lihat Daftar Metode)', 'Metode'], rowObj);
        const siakadDosenPengganti = rowObj['Dosen Pengganti\n(Y jika Ya)'] || '';

        // Data dari sistem
        const kelompokNama = getValueFromMultipleFormats(['Kelompok\n(Contoh: 1)', 'Kelompok'], rowObj);
        const topik = rowObj['Topik'] || '';
        const ruanganNama = getValueFromMultipleFormats(['Ruang\n(Lihat Daftar Ruang)', 'Ruang'], rowObj);
        const nipPengajar = rowObj['NIP Pengajar'] || '';

        // Find ruangan data - cari berdasarkan id_ruangan (kode ruangan) seperti di kuliah besar & praktikum
        const ruanganData = ruanganList?.find(r => r.id_ruangan === ruanganNama);

        // Find dosen data - cari berdasarkan NID
        const dosenData = dosenList?.find(d => d.nid === nipPengajar);

        // Find kelompok kecil data
        const kelompokKecilData = kelompokKecilList?.find(k => k.nama_kelompok === kelompokNama);

        // Calculate jam selesai if not provided
        let calculatedJamSelesai = jamSelesai;
        if (!calculatedJamSelesai && jamMulai) {
          // Default to 2 sessions for CSR
          calculatedJamSelesai = hitungJamSelesai(jamMulai, 2);
        }

        return {
          jenis_csr: '' as 'reguler' | 'responsi', // Must be filled manually
          tanggal: tanggal || '',
          jam_mulai: jamMulai || '',
          jam_selesai: calculatedJamSelesai,
          jumlah_sesi: 2, // Default 2 sessions for CSR
          kelompok_kecil_id: kelompokKecilData?.id || 0,
          topik: topik || '',
          kategori_id: 0, // Must be filled manually (keahlian)
          dosen_id: dosenData?.id || 0, // User isi manual di preview
          ruangan_id: ruanganData?.id || 0,
          nama_kelompok: kelompokKecilData?.nama_kelompok || kelompokNama,
          nama_keahlian: '', // Must be filled manually
          nama_dosen: dosenData?.name || '', // User isi manual di preview
          nama_ruangan: ruanganData?.nama || ruanganNama || '', // Display nama ruangan yang sudah di-mapping
          // SIAKAD fields
          siakad_kurikulum: siakadKurikulum,
          siakad_kode_mk: siakadKodeMk,
          siakad_nama_kelas: siakadNamaKelas,
          siakad_jenis_pertemuan: siakadJenisPertemuan,
          siakad_metode: siakadMetode,
          siakad_dosen_pengganti: siakadDosenPengganti
        };
      });

      setCSRSiakadImportData(convertedData);

      // Validate data
      const { cellErrors } = validateCSRSIAKADExcelData(convertedData);
      setCSRSiakadCellErrors(cellErrors);
      setCSRSiakadImportErrors([]);
      setShowCSRSIAKADImportModal(true);
    } catch (error) {
      setCSRSiakadImportErrors(['Gagal membaca file Excel: ' + (error as Error).message]);
      setShowCSRSIAKADImportModal(true);
    }
  };

  // Validate SIAKAD Excel data
  const validateCSRSIAKADExcelData = (dataRows: JadwalCSRType[]) => {
    const errors: { row: number, field: string, message: string }[] = [];

    dataRows.forEach((row, index) => {
      const rowNumber = index + 1;

      // Validasi jenis CSR (wajib diisi manual)
      if (!row.jenis_csr) {
        errors.push({ row: rowNumber, field: 'jenis_csr', message: `Baris ${rowNumber}: Jenis CSR wajib diisi manual` });
      } else if (!['reguler', 'responsi'].includes(row.jenis_csr)) {
        errors.push({ row: rowNumber, field: 'jenis_csr', message: `Baris ${rowNumber}: Jenis CSR harus "reguler" atau "responsi"` });
      }

      // Validasi tanggal
      const tanggalError = validateDate(row.tanggal, rowNumber);
      if (tanggalError) {
        errors.push({ row: rowNumber, field: 'tanggal', message: tanggalError });
      }

      // Validasi jam mulai
      const jamMulaiError = validateTime(row.jam_mulai, rowNumber, 'Jam Mulai');
      if (jamMulaiError) {
        errors.push({ row: rowNumber, field: 'jam_mulai', message: jamMulaiError });
      }

      // Validasi kelompok kecil
      if (!row.kelompok_kecil_id || row.kelompok_kecil_id === 0) {
        errors.push({ row: rowNumber, field: 'kelompok_kecil_id', message: `Baris ${rowNumber}: Kelompok kecil wajib diisi` });
      }

      // Validasi topik
      if (!row.topik) {
        errors.push({ row: rowNumber, field: 'topik', message: `Baris ${rowNumber}: Topik wajib diisi` });
      }

      // Validasi keahlian/kategori (wajib diisi manual)
      if (!row.kategori_id || row.kategori_id === 0) {
        errors.push({ row: rowNumber, field: 'kategori_id', message: `Baris ${rowNumber}: Keahlian wajib diisi manual` });
      }

      // Validasi dosen (wajib diisi manual)
      if (!row.dosen_id || row.dosen_id === 0) {
        errors.push({ row: rowNumber, field: 'dosen_id', message: `Baris ${rowNumber}: Dosen wajib diisi manual` });
      } else {
        const dosen = dosenList.find(d => d.id === row.dosen_id);
        if (dosen && row.kategori_id) {
          const kategori = kategoriList.find(k => k.id === row.kategori_id);
          if (kategori && kategori.keahlian_required && !kategori.keahlian_required.includes(dosen.keahlian)) {
            errors.push({
              row: rowNumber,
              field: 'dosen_id',
              message: `Baris ${rowNumber}: Dosen "${dosen.name}" tidak memiliki keahlian "${kategori.keahlian_required.join(', ')}"`
            });
          }
        }
      }

      // Validasi ruangan
      if (!row.ruangan_id || row.ruangan_id === 0) {
        errors.push({ row: rowNumber, field: 'ruangan_id', message: `Baris ${rowNumber}: Ruangan wajib diisi` });
      }
    });

    return { cellErrors: errors };
  };

  // Handle SIAKAD cell edit with auto-recalculate
  const handleCSRSiakadCellEdit = (rowIndex: number, field: string, value: any) => {
    const updatedData = [...csrSiakadImportData];
    updatedData[rowIndex] = { ...updatedData[rowIndex], [field]: value };

    // Auto-recalculate jam_selesai when jenis_csr or jam_mulai changes
    if (field === 'jenis_csr' || field === 'jam_mulai') {
      const jenisCSR = field === 'jenis_csr' ? value : updatedData[rowIndex].jenis_csr;
      const jamMulai = field === 'jam_mulai' ? value : updatedData[rowIndex].jam_mulai;
      const jumlahSesi = jenisCSR === 'reguler' ? CSR_REGULER_SESSIONS : CSR_RESPONSI_SESSIONS;
      const jamSelesai = hitungJamSelesai(jamMulai || '08:00', jumlahSesi);

      updatedData[rowIndex] = {
        ...updatedData[rowIndex],
        jam_selesai: jamSelesai,
        jumlah_sesi: jumlahSesi
      };
    }

    setCSRSiakadImportData(updatedData);

    // Re-validate
    const { cellErrors } = validateCSRSIAKADExcelData(updatedData);
    setCSRSiakadCellErrors(cellErrors);
  };

  // Handler untuk edit kelompok kecil SIAKAD
  const handleCSRSiakadKelompokKecilEdit = (rowIndex: number, value: string) => {
    const kelompokKecil = kelompokKecilList.find(k => k.nama_kelompok === value);

    const updatedData = [...csrSiakadImportData];
    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      kelompok_kecil_id: kelompokKecil?.id || 0,
      nama_kelompok: value
    };

    setCSRSiakadImportData(updatedData);

    const { cellErrors } = validateCSRSIAKADExcelData(updatedData);
    setCSRSiakadCellErrors(cellErrors);
  };

  // Handler untuk edit keahlian SIAKAD
  const handleCSRSiakadKeahlianEdit = (rowIndex: number, value: string) => {
    const kategori = kategoriList.find(k => k.keahlian_required?.includes(value));

    const updatedData = [...csrSiakadImportData];
    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      kategori_id: kategori?.id || 0,
      nama_keahlian: value
    };

    setCSRSiakadImportData(updatedData);

    const { cellErrors } = validateCSRSIAKADExcelData(updatedData);
    setCSRSiakadCellErrors(cellErrors);
  };

  // Handler untuk edit dosen SIAKAD
  const handleCSRSiakadDosenEdit = (rowIndex: number, value: string) => {
    const dosen = dosenList.find(d => d.name === value);

    const updatedData = [...csrSiakadImportData];
    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      dosen_id: dosen?.id || 0,
      nama_dosen: value
    };

    setCSRSiakadImportData(updatedData);

    const { cellErrors } = validateCSRSIAKADExcelData(updatedData);
    setCSRSiakadCellErrors(cellErrors);
  };

  // Handler untuk edit ruangan SIAKAD
  const handleCSRSiakadRuanganEdit = (rowIndex: number, value: string) => {
    const ruangan = ruanganList.find(r => r.nama === value);

    const updatedData = [...csrSiakadImportData];
    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      ruangan_id: ruangan?.id || 0,
      nama_ruangan: value
    };

    setCSRSiakadImportData(updatedData);

    const { cellErrors } = validateCSRSIAKADExcelData(updatedData);
    setCSRSiakadCellErrors(cellErrors);
  };

  // Submit SIAKAD import
  const handleCSRSiakadSubmitImport = async () => {
    try {
      setIsCSRSiakadImporting(true);
      setCSRSiakadImportErrors([]);

      // Validate data
      const { cellErrors } = validateCSRSIAKADExcelData(csrSiakadImportData);

      if (cellErrors.length > 0) {
        setCSRSiakadCellErrors(cellErrors);
        setIsCSRSiakadImporting(false);
        return;
      }

      // Transform data for API
      const transformedData = csrSiakadImportData.map((row) => {
        let jamMulai = row.jam_mulai;
        let jamSelesai = row.jam_selesai;

        if (jamMulai && jamMulai.includes(':')) {
          jamMulai = jamMulai.replace(':', '.');
        }
        if (jamSelesai && jamSelesai.includes(':')) {
          jamSelesai = jamSelesai.replace(':', '.');
        }

        return {
          jenis_csr: row.jenis_csr,
          tanggal: row.tanggal,
          jam_mulai: jamMulai,
          jam_selesai: jamSelesai,
          jumlah_sesi: row.jumlah_sesi,
          kelompok_kecil_id: row.kelompok_kecil_id,
          topik: row.topik,
          kategori_id: row.kategori_id,
          dosen_id: row.dosen_id,
          ruangan_id: row.ruangan_id,
          // SIAKAD fields
          siakad_kurikulum: row.siakad_kurikulum || null,
          siakad_kode_mk: row.siakad_kode_mk || null,
          siakad_nama_kelas: row.siakad_nama_kelas || null,
          siakad_jenis_pertemuan: row.siakad_jenis_pertemuan || null,
          siakad_metode: row.siakad_metode || null,
          siakad_dosen_pengganti: row.siakad_dosen_pengganti || null
        };
      });

      // Send to backend
      const response = await api.post(`/csr/jadwal/${kode}/import`, {
        data: transformedData
      });

      if (response.data.success) {
        setCSRSiakadImportedCount(transformedData.length);
        setShowCSRSIAKADImportModal(false);

        // Cleanup
        setCSRSiakadImportData([]);
        setCSRSiakadImportFile(null);
        setCSRSiakadImportErrors([]);
        setCSRSiakadCellErrors([]);
        setCSRSiakadEditingCell(null);
        setCSRSiakadImportPage(1);

        // Refresh data
        await fetchBatchData();
      } else {
        setCSRSiakadImportErrors([response.data.message || 'Terjadi kesalahan saat mengimport data']);
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        const errorData = error.response.data;
        if (errorData.errors && Array.isArray(errorData.errors)) {
          // Parse error messages yang sudah dalam format "Baris X: [pesan]"
          const cellErrors = errorData.errors.map((err: string) => {
            // Extract row number dari error message
            const rowMatch = err.match(/Baris\s+(\d+):/);
            const row = rowMatch ? parseInt(rowMatch[1]) : 0;
            return {
              row: row,
              field: 'api',
              message: err
            };
          });
          setCSRSiakadCellErrors(cellErrors);
        } else {
          setCSRSiakadImportErrors([errorData.message || 'Terjadi kesalahan validasi']);
        }
      } else if (error.response?.data?.message) {
        setCSRSiakadImportErrors([error.response.data.message]);
      } else {
        setCSRSiakadImportErrors([handleApiError(error, 'Mengimport data CSR SIAKAD')]);
      }
    } finally {
      setIsCSRSiakadImporting(false);
    }
  };

  // Handler untuk upload file SIAKAD
  const handleCSRSiakadImportExcelUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setCSRSiakadImportErrors(['Format file Excel tidak dikenali. Harap gunakan file .xlsx atau .xls']);
      setShowCSRSIAKADImportModal(true);
      return;
    }

    setCSRSiakadImportFile(file);
    await handleCSRSIAKADImportExcel(file);
  };

  // Handler untuk remove file SIAKAD
  const handleCSRSiakadRemoveFile = () => {
    setCSRSiakadImportFile(null);
    setCSRSiakadImportData([]);
    setCSRSiakadImportErrors([]);
    setCSRSiakadCellErrors([]);
    setCSRSiakadImportPage(1);
    setCSRSiakadEditingCell(null);
    if (csrSiakadFileInputRef.current) {
      csrSiakadFileInputRef.current.value = '';
    }
  };

  // ==================== END SIAKAD TEMPLATE FUNCTIONS ====================

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    let newForm = { ...form, [name]: value };
    if (name === 'jenis_csr') {
      newForm.jumlah_sesi = value === 'reguler' ? CSR_REGULER_SESSIONS : value === 'responsi' ? CSR_RESPONSI_SESSIONS : CSR_REGULER_SESSIONS;
      newForm.jam_selesai = hitungJamSelesai(newForm.jam_mulai, newForm.jumlah_sesi);
    }
    if (name === 'jam_mulai') {
      newForm.jam_selesai = hitungJamSelesai(value, newForm.jumlah_sesi);
    }
    // Validasi tanggal seperti di DetailBlok.tsx
    if (name === 'tanggal' && data && value) {
      const tglMulai = new Date(data.tanggal_mulai || '');
      const tglAkhir = new Date(data.tanggal_akhir || '');
      const tglInput = new Date(value);
      if (tglMulai && tglInput < tglMulai) {
        setErrorForm('Tanggal tidak boleh sebelum tanggal mulai!');
      } else if (tglAkhir && tglInput > tglAkhir) {
        setErrorForm('Tanggal tidak boleh setelah tanggal akhir!');
      } else {
        setErrorForm('');
      }
    }
    // Reset error backend when form changes
    setErrorBackend('');
    setForm(newForm);
  }

  async function handleTambahJadwal() {
    setErrorForm('');
    setErrorBackend('');

    if (!form.jenis_csr || !form.tanggal || !form.jam_mulai || !form.jam_selesai || !form.dosen_id || !form.ruangan_id || !form.kelompok_kecil_id || !form.kategori_id || !form.topik) {
      setErrorForm('Semua field harus diisi!');
      return;
    }

    if (errorForm) return;

    setIsSaving(true);
    try {
      if (editIndex !== null) {
        // Update existing jadwal
        const jadwalToUpdate = jadwalCSR[editIndex];
        await api.put(`/csr/jadwal/${kode}/${jadwalToUpdate.id}`, form);

        // Refresh data dengan batch API
        await fetchBatchData();
      } else {
        // Create new jadwal
        await api.post(`/csr/jadwal/${kode}`, form);

        // Refresh data dengan batch API
        await fetchBatchData();
      }

      setShowModal(false);
      setForm({
        jenis_csr: '',
        tanggal: '',
        jam_mulai: '',
        jumlah_sesi: CSR_REGULER_SESSIONS,
        jam_selesai: '',
        dosen_id: null,
        ruangan_id: null,
        kelompok_kecil_id: null,
        kategori_id: null,
        topik: '',
      });
      setSelectedKategoriValue(null);
      setSelectedKeahlian(null);
      setEditIndex(null);
    } catch (error: any) {
      // Handle error dari API response dengan lebih spesifik
      if (error.response?.data?.message) {
        setErrorBackend(error.response.data.message);
      } else {
        setErrorBackend(handleApiError(error, 'Menyimpan jadwal CSR'));
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditJadwal(idx: number) {
    // Validasi index dan data
    if (idx < 0 || idx >= jadwalCSR.length) {
      return;
    }

    const row = jadwalCSR[idx];

    // Validasi bahwa row ada dan memiliki ID
    if (!row || !row.id) {
      return;
    }

    // Cari data berdasarkan ID untuk memastikan data yang benar (jika ada perubahan urutan)
    const actualRow = jadwalCSR.find(j => j.id === row.id) || row;

    // Format tanggal untuk input date (YYYY-MM-DD)
    let formattedTanggal = '';
    if (actualRow.tanggal) {
      try {
        const date = new Date(actualRow.tanggal);
        if (!isNaN(date.getTime())) {
          formattedTanggal = date.toISOString().split('T')[0];
        }
      } catch (error) {
        formattedTanggal = '';
      }
    }

    // Konversi format jam dari HH:MM ke HH.MM untuk dropdown
    const formatJamUntukDropdown = (jam: string) => {
      if (!jam) return '';
      return jam.replace(':', '.');
    };

    const jamMulai = formatJamUntukDropdown(actualRow.jam_mulai || '');
    const jamSelesai = formatJamUntukDropdown(actualRow.jam_selesai || '');

    setForm({
      jenis_csr: actualRow.jenis_csr || '',
      tanggal: formattedTanggal,
      jam_mulai: jamMulai,
      jumlah_sesi: actualRow.jumlah_sesi || 3,
      jam_selesai: jamSelesai,
      dosen_id: actualRow.dosen_id || null,
      ruangan_id: actualRow.ruangan_id || null,
      kelompok_kecil_id: actualRow.kelompok_kecil_id || null,
      kategori_id: actualRow.kategori_id || null,
      topik: actualRow.topik || '',
    });

    // Set selectedKategoriValue untuk dropdown
    setSelectedKategoriValue(actualRow.kategori_id ? `${actualRow.kategori_id}_0` : null);

    // Set selectedKeahlian berdasarkan data yang ada
    if (actualRow.kategori_id) {
      const kategoriData = kategoriList.find(k => k.id === actualRow.kategori_id);
      if (kategoriData?.keahlian_required && kategoriData.keahlian_required.length > 0) {
        // Cari keahlian yang sesuai dengan dosen yang dipilih
        const selectedDosen = dosenList.find(d => d.id === actualRow.dosen_id);
        if (selectedDosen && selectedDosen.keahlian) {
          setSelectedKeahlian(selectedDosen.keahlian);
        } else {
          // Jika tidak ada dosen yang dipilih, gunakan keahlian pertama dari kategori
          setSelectedKeahlian(kategoriData.keahlian_required[0]);
        }
      } else {
        setSelectedKeahlian(null);
      }
    } else {
      setSelectedKeahlian(null);
    }

    // Set editIndex berdasarkan ID untuk memastikan konsistensi
    const actualIndex = jadwalCSR.findIndex(j => j.id === row.id);
    setEditIndex(actualIndex >= 0 ? actualIndex : idx);

    setShowModal(true);
    setErrorForm('');
    setErrorBackend('');
  }

  async function handleDeleteJadwal(idx: number) {
    try {
      const jadwalToDelete = jadwalCSR[idx];
      await api.delete(`/csr/jadwal/${kode}/${jadwalToDelete.id}`);

      // Refresh data dengan batch API
      await fetchBatchData();

      setShowDeleteModal(false);
      setSelectedDeleteIndex(null);
    } catch (error: any) {
      // Handle error dari API response dengan lebih spesifik
      if (error.response?.data?.message) {
        setErrorBackend(error.response.data.message);
      } else {
        setErrorBackend(handleApiError(error, 'Menghapus jadwal CSR'));
      }
    }
  }

  // Fetch batch data untuk optimasi performa
  // Fetch batch data - optimized with useCallback for reuse
  const fetchBatchData = useCallback(async (showLoading = true) => {
    if (!kode) return;

    if (showLoading) setLoading(true);

    try {
      const response = await api.get(`/csr/${kode}/batch-data`);
      const batchData = response.data;

      // Set mata kuliah data
      setData(batchData.mata_kuliah);

      // Set jadwal CSR data
      setJadwalCSR(batchData.jadwal_csr);

      // Set reference data
      setDosenList(batchData.dosen_list);
      setRuanganList(batchData.ruangan_list);
      setKelompokKecilList(batchData.kelompok_kecil);
      setKategoriList(batchData.kategori_list);
      setJamOptions(batchData.jam_options);

    } catch (error: any) {
      setError(handleApiError(error, 'Memuat data batch'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [kode]);

  // Fungsi untuk export Excel CSR (Template Aplikasi)
  const exportCSRExcelAplikasi = async () => {
    try {
      if (jadwalCSR.length === 0) {
        alert('Tidak ada data CSR untuk diekspor');
        return;
      }

      // Transform data untuk export
      const exportData = jadwalCSR.map((row, index) => {
        const dosen = dosenList.find(d => d.id === row.dosen_id);
        const ruangan = ruanganList.find(r => r.id === row.ruangan_id);
        const kelompokKecil = kelompokKecilList.find(k => k.id === row.kelompok_kecil_id);
        const kategori = kategoriList.find(k => k.id === row.kategori_id);

        return {
          'No': index + 1,
          'Tanggal': row.tanggal ? new Date(row.tanggal).toISOString().split('T')[0] : '',
          'Jam Mulai': row.jam_mulai || '',
          'Jenis CSR': row.jenis_csr === 'reguler' ? 'reguler' : row.jenis_csr === 'responsi' ? 'responsi' : row.jenis_csr,
          'Kelompok Kecil': kelompokKecil?.nama_kelompok || '',
          'Topik': row.topik,
          'Keahlian': kategori?.keahlian_required?.join(', ') || '',
          'Dosen': dosen?.name || '',
          'Ruangan': ruangan?.nama || ''
        };
      });

      // Buat workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Data CSR
      const ws = XLSX.utils.json_to_sheet(exportData, {
        header: ['No', 'Tanggal', 'Jam Mulai', 'Jenis CSR', 'Kelompok Kecil', 'Topik', 'Keahlian', 'Dosen', 'Ruangan']
      });

      // Set lebar kolom
      const colWidths = [
        { wch: 5 },  // No
        { wch: 12 }, // Tanggal
        { wch: 10 }, // Jam Mulai
        { wch: 12 }, // Jenis CSR
        { wch: 15 }, // Kelompok Kecil
        { wch: 30 }, // Topik
        { wch: 20 }, // Keahlian
        { wch: 25 }, // Dosen
        { wch: 20 }  // Ruangan
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Data CSR');

      // Sheet 2: Info Mata Kuliah
      const infoData = [
        ['INFORMASI MATA KULIAH'],
        [''],
        ['Kode Mata Kuliah', data?.kode || ''],
        ['Nama Mata Kuliah', data?.nama || ''],
        ['Semester', data?.semester || ''],
        ['Periode', data?.periode || ''],
        ['Kurikulum', data?.kurikulum || ''],
        ['Jenis', data?.jenis || ''],
        ['Tipe Non-Blok', data?.tipe_non_block || ''],
        ['Tanggal Mulai', data?.tanggal_mulai ? new Date(data.tanggal_mulai).toISOString().split('T')[0] : ''],
        ['Tanggal Akhir', data?.tanggal_akhir ? new Date(data.tanggal_akhir).toISOString().split('T')[0] : ''],
        ['Durasi Minggu', data?.durasi_minggu || ''],
        [''],
        [`TOTAL JADWAL CSR`, jadwalCSR.length],
        [''],
        ['CATATAN:'],
        ['• File ini berisi data jadwal CSR yang dapat di-import kembali ke aplikasi'],
        ['• Format tanggal: YYYY-MM-DD'],
        ['• Format jam: HH.MM atau HH:MM'],
        ['• Pastikan data dosen dan ruangan valid sebelum import'],
        [''],
        ['PANDUAN IMPORT KEMBALI:'],
        ['1. Pastikan format file sesuai dengan template aplikasi'],
        ['2. Jangan mengubah nama kolom header'],
        ['3. Jenis CSR: "reguler" (3 sesi) atau "responsi" (2 sesi)'],
        ['4. Jam selesai dihitung otomatis berdasarkan jenis CSR'],
        ['5. Pastikan data dosen, ruangan, kelompok kecil, dan keahlian valid sebelum import'],
        ['6. Sistem akan melakukan validasi data sebelum import'],
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: 30 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Info Mata Kuliah');

      // Download file
      const fileName = `Export_CSR_${data?.kode || 'MataKuliah'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Gagal mengekspor data CSR (Template Aplikasi)');
    }
  };

  // ========================================
  // CSR SIAKAD EXPORT FUNCTION - OPTIMIZED
  // ========================================
  const exportCSRExcelSIAKAD = async () => {
    try {
      if (jadwalCSR.length === 0) {
        alert('Tidak ada data CSR untuk diekspor');
        return;
      }

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Jadwal CSR SIAKAD');

      // Add headers and apply styling
      worksheet.addRow(SIAKAD_HEADERS);
      applySIAKADStyling(worksheet);

      // Add data rows with optimized performance
      jadwalCSR.forEach((row) => {
        // Find related data for mapping
        const dosen = dosenList.find(d => d.id === row.dosen_id);
        const ruangan = ruanganList.find(r => r.id === row.ruangan_id);
        const kelompok = kelompokKecilList.find(k => k.id === row.kelompok_kecil_id);
        const kategori = kategoriList.find(k => k.id === row.kategori_id);

        // Map data according to SIAKAD template requirements
        worksheet.addRow([
          // SIAKAD Fields (from original file) - Green headers
          row.siakad_kurikulum || '',
          row.siakad_kode_mk || '',
          row.siakad_nama_kelas || '',
          // System Fields - Orange headers
          kelompok?.nama_kelompok || '',
          row.topik || '',
          kategori?.keahlian_required?.join(', ') || '',
          // SIAKAD Fields (from original file) - Green headers
          row.siakad_jenis_pertemuan || '',
          row.siakad_metode || '',
          // System Fields - Orange headers
          ruangan?.id_ruangan || '',
          dosen?.nid || '',
          // SIAKAD Fields (from original file) - Green headers
          row.siakad_dosen_pengganti || '',
          // System Fields - Orange headers
          row.tanggal ? new Date(row.tanggal).toISOString().split('T')[0] : '',
          row.jam_mulai || '',
          row.jam_selesai || ''
        ]);
      });

      // Add info sheet and download
      createSIAKADInfoSheet(workbook, data, 'csr', jadwalCSR.length);
      const filename = `Export_CSR_SIAKAD_${data?.kode}_${new Date().toISOString().split('T')[0]}.xlsx`;
      await downloadExcelFile(workbook, filename);

    } catch (error) {
      alert('Gagal mengekspor data CSR (Template SIAKAD)');
    }
  };

  // Fungsi untuk menangani export berdasarkan template yang dipilih
  const handleCSRExport = async () => {
    if (selectedCSRExportTemplate === 'APLIKASI') {
      await exportCSRExcelAplikasi();
    } else if (selectedCSRExportTemplate === 'SIAKAD') {
      await exportCSRExcelSIAKAD();
    }
    setShowCSRExportModal(false);
    setSelectedCSRExportTemplate(null);
  };

  // Initial load dengan loading state
  // Fetch batch data on component mount
  useEffect(() => {
    fetchBatchData(true);
  }, [fetchBatchData]);

  // Effect untuk memastikan selectedKeahlian diset dengan benar saat edit modal
  useEffect(() => {
    if (showModal && editIndex !== null && form.dosen_id && dosenList.length > 0) {
      const selectedDosen = dosenList.find(d => d.id === form.dosen_id);
      if (selectedDosen && selectedDosen.keahlian && !selectedKeahlian) {
        setSelectedKeahlian(selectedDosen.keahlian);
      }
    }
  }, [showModal, editIndex, form.dosen_id, dosenList, selectedKeahlian]);

  // Effect to sync form.topik with selected Mata Kuliah (Keahlian) name
  useEffect(() => {
    if (showModal && selectedKategoriValue) {
      const validOptions = (kategoriList || [])
        .filter(k => k.nama && k.keahlian_required && k.keahlian_required.length > 0)
        .flatMap(k =>
          (k.keahlian_required || []).map((keahlian: string, index: number) => ({
            value: `${k.id}_${index}`,
            label: `${keahlian} (${k.nomor_csr})`
          }))
        );

      const selectedOpt = validOptions.find(opt => opt.value === selectedKategoriValue);
      if (selectedOpt) {
        const keahlianName = selectedOpt.label.split(' (')[0];
        if (form.topik !== keahlianName) {
          setForm(f => ({ ...f, topik: keahlianName }));
        }
      }
    }
  }, [showModal, selectedKategoriValue, kategoriList, form.topik]);

  // Auto-hide success messages and imported count (consolidated)
  useEffect(() => {
    const itemsToReset = [
      { value: csrImportedCount, setter: setCSRImportedCount, resetValue: 0 },
      { value: csrSiakadImportedCount, setter: setCSRSiakadImportedCount, resetValue: 0 },
      { value: csrSuccess, setter: setCSRSuccess, resetValue: null }
    ];

    const timers = itemsToReset
      .filter(item => item.value)
      .map(item => setTimeout(() => item.setter(item.resetValue as any), 5000));

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [csrImportedCount, csrSiakadImportedCount, csrSuccess]);

  // Fungsi untuk membuka halaman absensi
  const handleOpenAbsensi = (jadwal: JadwalCSR) => {
    navigate(`/absensi-csr/${kode}/${jadwal.id}`);
  };


  // Fungsi untuk bulk delete CSR
  const handleCSRBulkDelete = () => {
    if (selectedCSRItems.length === 0) return;
    setShowCSRBulkDeleteModal(true);
  };

  const confirmCSRBulkDelete = async () => {
    if (selectedCSRItems.length === 0) return;

    setIsCSRDeleting(true);
    try {
      // Delete all selected items
      await Promise.all(selectedCSRItems.map(id => api.delete(`/csr/jadwal/${kode}/${id}`)));

      // Set success message
      setCSRSuccess(`${selectedCSRItems.length} jadwal CSR berhasil dihapus.`);

      // Clear selections
      setSelectedCSRItems([]);

      // Close modal after successful delete
      setShowCSRBulkDeleteModal(false);

      // Refresh data
      await fetchBatchData();
    } catch (error: any) {
      setError(handleApiError(error, 'Menghapus jadwal CSR'));
    } finally {
      setIsCSRDeleting(false);
    }
  };

  const handleCSRSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedCSRItems(jadwalCSR.map(jadwal => jadwal.id!));
    } else {
      setSelectedCSRItems([]);
    }
  };

  const handleCSRSelectItem = (id: number) => {
    if (selectedCSRItems.includes(id)) {
      setSelectedCSRItems(selectedCSRItems.filter(itemId => itemId !== id));
    } else {
      setSelectedCSRItems([...selectedCSRItems, id]);
    }
  };





  if (loading) return (
    <div className="w-full mx-auto">
      {/* Header skeleton */}
      <div className="h-8 w-80 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
      <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-8" />

      {/* Info Mata Kuliah skeleton */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-8">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
              <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Info Tambahan skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
            <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
            <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Jadwal CSR skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
          <div className="max-w-full overflow-x-auto hide-scroll">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/5 text-sm">
              <thead className="border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Jenis CSR</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Hari/Tanggal</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pukul</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Waktu</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pengampu</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Mata Kuliah</th>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`skeleton-csr-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}>
                    <td className="px-4 py-4">
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-2 justify-center">
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
  if (error) return <div>{error}</div>;
  if (!data) return <div>Data tidak ditemukan</div>;

  return (
    <div>
      {/* Header */}
      <div className="pt-6 pb-2">
        <button
          onClick={() => navigate('/mata-kuliah')}
          className="flex items-center gap-2 text-brand-500 font-medium hover:text-brand-600 transition px-0 py-0 bg-transparent shadow-none"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Kembali
        </button>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{data.nama}</h1>
      <p className="text-gray-500 dark:text-gray-400 text-base mb-8">Informasi lengkap mata kuliah non blok CSR</p>

      {/* Card Info Utama */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-8 mb-8 shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Kode Mata Kuliah</div>
            <div className="text-lg font-bold text-gray-800 dark:text-white">{data.kode}</div>
          </div>
          <div>
            <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Nama Mata Kuliah</div>
            <div className="text-lg font-bold text-gray-800 dark:text-white">{data.nama}</div>
          </div>
          <div>
            <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Semester</div>
            <div className="text-base text-gray-800 dark:text-white">Semester {data.semester}</div>
          </div>
          <div>
            <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Periode</div>
            <div className="text-base text-gray-800 dark:text-white">{data.periode}</div>
          </div>
          <div>
            <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Kurikulum</div>
            <div className="text-base text-gray-800 dark:text-white">{data.kurikulum}</div>
          </div>
          <div>
            <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Jenis</div>
            <div className="text-base text-gray-800 dark:text-white">{data.jenis}</div>
          </div>
          <div>
            <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Tipe Non-Blok</div>
            <div className="text-base text-gray-800 dark:text-white">{data.tipe_non_block || '-'}</div>
          </div>
          <div>
            <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Keahlian Dibutuhkan</div>
            <div className="text-base text-gray-800 dark:text-white">
              {(data as any).keahlian_required && (data as any).keahlian_required.length > 0
                ? (data as any).keahlian_required.join(', ')
                : '-'}
            </div>
          </div>
        </div>
      </div>

      {/* Section Info Tambahan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Tanggal Mulai</div>
          <div className="text-base text-gray-800 dark:text-white">{data.tanggal_mulai ? new Date(data.tanggal_mulai).toLocaleDateString('id-ID') : '-'}</div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Tanggal Akhir</div>
          <div className="text-base text-gray-800 dark:text-white">{data.tanggal_akhir ? new Date(data.tanggal_akhir).toLocaleDateString('id-ID') : '-'}</div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Durasi Minggu</div>
          <div className="text-base text-gray-800 dark:text-white">{data.durasi_minggu || '-'}</div>
        </div>
      </div>

      {/* Placeholder untuk tabel/komponen lain */}
      {/* <div className="mt-8">Tabel/komponen lain di sini</div> */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Jadwal CSR</h2>
          <div className="flex items-center gap-3">
            {/* Import Excel Button */}
            <button
              onClick={() => setShowCSRTemplateSelectionModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform cursor-pointer">
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-brand-700 dark:text-brand-200" />
              Import Excel
            </button>

            {/* Download Template Button */}
            <button
              onClick={downloadCSRTemplate}
              className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
              Download Template Excel
            </button>

            {/* Export Excel Button */}
            <button
              onClick={() => setShowCSRExportModal(true)}
              disabled={jadwalCSR.length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs transition flex items-center gap-2 ${jadwalCSR.length === 0
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800'
                }`}
              title={jadwalCSR.length === 0 ? 'Tidak ada data CSR. Silakan tambahkan data jadwal terlebih dahulu untuk melakukan export.' : 'Export data CSR ke Excel'}
            >
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
              Export ke Excel
            </button>

            <button
              onClick={() => {
                setForm({
                  jenis_csr: '',
                  tanggal: '',
                  jam_mulai: '',
                  jumlah_sesi: CSR_REGULER_SESSIONS,
                  jam_selesai: '',
                  dosen_id: null,
                  ruangan_id: null,
                  kelompok_kecil_id: null,
                  kategori_id: null,
                  topik: '',
                });
                setSelectedKategoriValue(null);
                setSelectedKeahlian(null);
                setEditIndex(null);
                setShowModal(true);
                setErrorForm('');
                setErrorBackend('');
              }}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"
            >
              Tambah Jadwal
            </button>
          </div>
        </div>

        {/* Success Message CSR Import */}
        <AnimatePresence>
          {csrImportedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {csrImportedCount} jadwal CSR berhasil diimpor ke database.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Message CSR Bulk Delete */}
        <AnimatePresence>
          {csrSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {csrSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
          <div className="max-w-full overflow-x-auto hide-scroll" >
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/5 text-sm">
              <thead className="border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <button
                      type="button"
                      aria-checked={jadwalCSR.length > 0 && jadwalCSR.every(item => selectedCSRItems.includes(item.id!))}
                      role="checkbox"
                      onClick={() => handleCSRSelectAll(!(jadwalCSR.length > 0 && jadwalCSR.every(item => selectedCSRItems.includes(item.id!))))}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${jadwalCSR.length > 0 && jadwalCSR.every(item => selectedCSRItems.includes(item.id!)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                    >
                      {jadwalCSR.length > 0 && jadwalCSR.every(item => selectedCSRItems.includes(item.id!)) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <polyline points="20 7 11 17 4 10" />
                        </svg>
                      )}
                    </button>
                  </th>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Jenis CSR</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Hari/Tanggal</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pukul</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Waktu</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pengampu</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Mata Kuliah</th>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {jadwalCSR.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-6 text-gray-400">Tidak ada data CSR</td>
                  </tr>
                ) : (
                  getPaginatedData(jadwalCSR, csrPage, csrPageSize).map((row, i) => (
                    <tr key={row.id || i} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}>
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          aria-checked={selectedCSRItems.includes(row.id!)}
                          role="checkbox"
                          onClick={() => handleCSRSelectItem(row.id!)}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedCSRItems.includes(row.id!) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                        >
                          {selectedCSRItems.includes(row.id!) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <polyline points="20 7 11 17 4 10" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{(csrPage - 1) * csrPageSize + i + 1}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jenis_csr === 'reguler' ? 'CSR Reguler' : 'CSR Responsi'}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {new Date(row.tanggal).toLocaleDateString('id-ID', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jam_mulai?.replace('.', ':')}–{row.jam_selesai?.replace('.', ':')}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi}x50'</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.dosen?.name || '-'}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.ruangan?.nama || '-'}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.kelompok_kecil?.nama_kelompok ? `Kelompok ${row.kelompok_kecil.nama_kelompok}` : '-'}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap max-w-xs truncate" title={row.topik || '-'}>{row.topik || '-'}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.kategori?.nama || '-'}</td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleOpenAbsensi(row)} className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors shrink-0" title="Buka Absensi">
                            <FontAwesomeIcon icon={faCheckCircle} className="w-3.5 h-3.5 shrink-0" />
                            <span className="xl:inline whitespace-nowrap">Absensi</span>
                          </button>
                          <button onClick={() => {
                            // Cari index berdasarkan ID untuk memastikan data yang benar
                            const actualCSRIndex = (csrPage - 1) * csrPageSize + i;
                            const correctIndex = jadwalCSR.findIndex(j => j.id === row.id);
                            handleEditJadwal(correctIndex >= 0 ? correctIndex : actualCSRIndex);
                          }} className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors shrink-0" title="Edit Jadwal">
                            <FontAwesomeIcon icon={faPenToSquare} className="w-3.5 h-3.5 shrink-0" />
                            <span className="xl:inline whitespace-nowrap">Edit</span>
                          </button>
                          <button onClick={() => { setSelectedDeleteIndex(i); setShowDeleteModal(true); }} className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors shrink-0" title="Hapus Jadwal">
                            <FontAwesomeIcon icon={faTrash} className="w-3.5 h-3.5 shrink-0" />
                            <span className="xl:inline whitespace-nowrap">Hapus</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Tombol Hapus Terpilih untuk CSR */}
        {selectedCSRItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              disabled={isCSRDeleting}
              onClick={handleCSRBulkDelete}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${isCSRDeleting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-theme-xs hover:bg-red-600'}`}
            >
              {isCSRDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedCSRItems.length})`}
            </button>
          </div>
        )}

        {/* Pagination for CSR */}
        {true && (
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan {((csrPage - 1) * csrPageSize) + 1} - {Math.min(csrPage * csrPageSize, jadwalCSR.length)} dari {jadwalCSR.length} data
              </span>

              <select
                value={csrPageSize}
                onChange={(e) => {
                  setCsrPageSize(Number(e.target.value));
                  setCsrPage(1);
                }}
                className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1 max-w-[400px] overflow-x-auto pagination-scroll">
              <style
                dangerouslySetInnerHTML={{
                  __html: `
                  .pagination-scroll::-webkit-scrollbar {
                    height: 6px;
                  }
                  .pagination-scroll::-webkit-scrollbar-track {
                    background: #f1f5f9;
                    border-radius: 3px;
                  }
                  .pagination-scroll::-webkit-scrollbar-thumb {
                    background: #cbd5e1;
                    border-radius: 3px;
                  }
                  .pagination-scroll::-webkit-scrollbar-thumb:hover {
                    background: #94a3b8;
                  }
                  .dark .pagination-scroll::-webkit-scrollbar-track {
                    background: #1e293b;
                  }
                  .dark .pagination-scroll::-webkit-scrollbar-thumb {
                    background: #475569;
                  }
                  .dark .pagination-scroll::-webkit-scrollbar-thumb:hover {
                    background: #64748b;
                  }
                `,
                }}
              />

              <button
                onClick={() => setCsrPage((p) => Math.max(1, p - 1))}
                disabled={csrPage === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Previous
              </button>

              {/* Always show first page if it's not the current page */}
              {getTotalPages(jadwalCSR.length, csrPageSize) > 1 && (
                <button
                  onClick={() => setCsrPage(1)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${csrPage === 1
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                >
                  1
                </button>
              )}

              {/* Show pages around current page */}
              {Array.from({ length: getTotalPages(jadwalCSR.length, csrPageSize) }, (_, i) => {
                const pageNum = i + 1;
                // Show pages around current page (2 pages before and after)
                const shouldShow =
                  pageNum > 1 &&
                  pageNum < getTotalPages(jadwalCSR.length, csrPageSize) &&
                  pageNum >= csrPage - 2 &&
                  pageNum <= csrPage + 2;

                if (!shouldShow) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setCsrPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${csrPage === pageNum
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Show ellipsis if current page is far from end */}
              {csrPage < getTotalPages(jadwalCSR.length, csrPageSize) - 3 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">
                  ...
                </span>
              )}

              {/* Always show last page if it's not the first page */}
              {getTotalPages(jadwalCSR.length, csrPageSize) > 1 && (
                <button
                  onClick={() => setCsrPage(getTotalPages(jadwalCSR.length, csrPageSize))}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${csrPage === getTotalPages(jadwalCSR.length, csrPageSize)
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                >
                  {getTotalPages(jadwalCSR.length, csrPageSize)}
                </button>
              )}

              <button
                onClick={() => setCsrPage((p) => Math.min(getTotalPages(jadwalCSR.length, csrPageSize), p + 1))}
                disabled={csrPage === getTotalPages(jadwalCSR.length, csrPageSize)}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      {/* Modal input jadwal CSR */}
      {showModal && (
        <div className="fixed inset-0 z-9999999 flex items-center justify-center">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-sm" onClick={() => setShowModal(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-50 max-h-[90vh] overflow-y-auto hide-scroll">
            <button
              onClick={() => setShowModal(false)}
              className="absolute right-2 top-2 z-20 flex items-center justify-center rounded-full bg-white shadow-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white h-9 w-9 border border-gray-200 dark:border-gray-700 transition"
              aria-label="Tutup"
            >
              <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="w-6 h-6">
                <path fillRule="evenodd" clipRule="evenodd" d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z" fill="currentColor" />
              </svg>
            </button>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis CSR</label>
                <select
                  name="jenis_csr"
                  value={form.jenis_csr}
                  onChange={handleFormChange}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                >
                  <option value="">Pilih Jenis CSR</option>
                  <option value="reguler">CSR Reguler</option>
                  <option value="responsi">CSR Responsi</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelompok</label>
                {kelompokKecilList.length === 0 ? (
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                        Belum ada kelompok kecil yang ditambahkan untuk mata kuliah ini
                      </span>
                    </div>
                    <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                      Silakan tambahkan kelompok kecil terlebih dahulu di halaman Kelompok Detail
                    </p>
                  </div>
                ) : (
                  <Select
                    options={Array.from(
                      new Set((kelompokKecilList || []).map(k => k.nama_kelompok))
                    ).map(nama => ({
                      value: (kelompokKecilList || []).find(k => k.nama_kelompok === nama)?.id || 0,
                      label: `Kelompok ${nama}`
                    }))}
                    value={Array.from(
                      new Set((kelompokKecilList || []).map(k => k.nama_kelompok))
                    ).map(nama => ({
                      value: (kelompokKecilList || []).find(k => k.nama_kelompok === nama)?.id || 0,
                      label: `Kelompok ${nama}`
                    })).find(opt => opt.value === form.kelompok_kecil_id) || null}
                    onChange={opt => setForm(f => ({ ...f, kelompok_kecil_id: opt?.value || null }))}
                    placeholder="Pilih Kelompok"
                    isClearable
                    classNamePrefix="react-select"
                    className="react-select-container"
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f9fafb',
                        borderColor: state.isFocused
                          ? '#3b82f6'
                          : (document.documentElement.classList.contains('dark') ? '#334155' : '#d1d5db'),
                        color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                        boxShadow: state.isFocused ? '0 0 0 2px #3b82f633' : undefined,
                        borderRadius: '0.75rem',
                        minHeight: '2.5rem',
                        fontSize: '1rem',
                        paddingLeft: '0.75rem',
                        paddingRight: '0.75rem',
                        '&:hover': { borderColor: '#3b82f6' },
                      }),
                      menu: base => ({
                        ...base,
                        zIndex: 9999,
                        fontSize: '1rem',
                        backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
                        color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? '#3b82f6'
                          : state.isFocused
                            ? (document.documentElement.classList.contains('dark') ? '#334155' : '#e0e7ff')
                            : (document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff'),
                        color: state.isSelected
                          ? '#fff'
                          : (document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937'),
                        fontSize: '1rem',
                      }),
                      singleValue: base => ({
                        ...base,
                        color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                      }),
                      placeholder: base => ({
                        ...base,
                        color: document.documentElement.classList.contains('dark') ? '#64748b' : '#6b7280',
                      }),
                      input: base => ({
                        ...base,
                        color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                      }),
                      dropdownIndicator: base => ({
                        ...base,
                        color: document.documentElement.classList.contains('dark') ? '#64748b' : '#6b7280',
                        '&:hover': { color: '#3b82f6' },
                      }),
                      indicatorSeparator: base => ({
                        ...base,
                        backgroundColor: 'transparent',
                      }),
                    }}
                  />
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hari/Tanggal</label>
                <input type="date" name="tanggal" value={form.tanggal} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                {errorForm && <div className="text-sm text-red-500 mt-2">{errorForm}</div>}
              </div>
              <div className="flex gap-2">
                <div className="flex-1">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Mulai</label>
                  <Select
                    options={jamOptions.map(j => ({ value: j, label: j }))}
                    value={jamOptions.length > 0 ? jamOptions.map(j => ({ value: j, label: j })).find(opt => opt.value === form.jam_mulai) || null : null}
                    onChange={opt => {
                      const value = opt?.value || '';
                      setForm(f => ({
                        ...f,
                        jam_mulai: value,
                        jam_selesai: hitungJamSelesai(value, f.jumlah_sesi)
                      }));
                    }}

                    classNamePrefix="react-select"
                    className="react-select-container"
                    isClearable
                    placeholder="Pilih Jam Mulai"
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f9fafb',
                        borderColor: state.isFocused
                          ? '#3b82f6'
                          : (document.documentElement.classList.contains('dark') ? '#334155' : '#d1d5db'),
                        color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                        boxShadow: state.isFocused ? '0 0 0 2px #3b82f633' : undefined,
                        borderRadius: '0.75rem',
                        minHeight: '2.5rem',
                        fontSize: '1rem',
                        paddingLeft: '0.75rem',
                        paddingRight: '0.75rem',
                        '&:hover': { borderColor: '#3b82f6' },
                      }),
                      menu: base => ({
                        ...base,
                        zIndex: 9999,
                        fontSize: '1rem',
                        backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
                        color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? '#3b82f6'
                          : state.isFocused
                            ? (document.documentElement.classList.contains('dark') ? '#334155' : '#e0e7ff')
                            : (document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff'),
                        color: state.isSelected
                          ? '#fff'
                          : (document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937'),
                        fontSize: '1rem',
                      }),
                      singleValue: base => ({
                        ...base,
                        color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                      }),
                      placeholder: base => ({
                        ...base,
                        color: document.documentElement.classList.contains('dark') ? '#64748b' : '#6b7280',
                      }),
                      input: base => ({
                        ...base,
                        color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                      }),
                      dropdownIndicator: base => ({
                        ...base,
                        color: document.documentElement.classList.contains('dark') ? '#64748b' : '#6b7280',
                        '&:hover': { color: '#3b82f6' },
                      }),
                      indicatorSeparator: base => ({
                        ...base,
                        backgroundColor: 'transparent',
                      }),
                    }}
                  />
                </div>
                <div className="w-32">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">x 50 menit</label>
                  <input type="text" value={form.jumlah_sesi + " x 50'"} readOnly className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Selesai</label>
                <input type="text" name="jam_selesai" value={form.jam_selesai} readOnly className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Mata Kuliah</label>
                {(() => {
                  const validOptions = (kategoriList || [])
                    .filter(k => k.nama && k.keahlian_required && k.keahlian_required.length > 0)
                    .flatMap(k =>
                      (k.keahlian_required || []).map((keahlian: string, index: number) => ({
                        value: `${k.id}_${index}`,
                        label: `${keahlian} (${k.nomor_csr})`,
                        kategoriId: k.id,
                        keahlianIndex: index
                      }))
                    );

                  return validOptions.length === 0 ? (
                    <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                      <div className="flex items-center gap-2">
                        <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                        </svg>
                        <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                          Belum ada kategori CSR yang ditambahkan untuk mata kuliah ini
                        </span>
                      </div>
                      <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                        Silakan tambahkan kategori CSR terlebih dahulu di halaman CSR Detail
                      </p>
                    </div>
                  ) : (
                    <Select
                      options={validOptions}
                      value={validOptions.find(opt => opt.value === selectedKategoriValue) || null}
                      onChange={opt => {
                        const kategoriId = opt?.value ? parseInt(opt.value.split('_')[0]) : null;
                        const keahlianIndex = opt?.value ? parseInt(opt.value.split('_')[1]) : 0;
                        setForm(f => ({
                          ...f,
                          kategori_id: kategoriId,
                          dosen_id: null // Reset dosen when kategori changes
                        }));
                        setSelectedKategoriValue(opt?.value || null); // Simpan value dropdown
                        setErrorForm(''); // Reset error when selection changes

                        // Simpan keahlian yang dipilih
                        if (opt?.value) {
                          const kategoriData = kategoriList.find(k => k.id === kategoriId);
                          if (kategoriData && kategoriData.keahlian_required) {
                            setSelectedKeahlian(kategoriData.keahlian_required[keahlianIndex]);
                          }
                        } else {
                          setSelectedKeahlian(null);
                        }

                        // Reset dosen list ketika kategori berubah
                        if (kategoriId === null) {
                          setDosenList([]);
                        }
                      }}
                      placeholder="Pilih Keahlian"
                      isClearable
                      classNamePrefix="react-select"
                      className="react-select-container"
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f9fafb',
                          borderColor: state.isFocused
                            ? '#3b82f6'
                            : (document.documentElement.classList.contains('dark') ? '#334155' : '#d1d5db'),
                          color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                          boxShadow: state.isFocused ? '0 0 0 2px #3b82f633' : undefined,
                          borderRadius: '0.75rem',
                          minHeight: '2.5rem',
                          fontSize: '1rem',
                          paddingLeft: '0.75rem',
                          paddingRight: '0.75rem',
                          '&:hover': { borderColor: '#3b82f6' },
                        }),
                        menu: base => ({
                          ...base,
                          zIndex: 9999,
                          fontSize: '1rem',
                          backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
                          color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isSelected
                            ? '#3b82f6'
                            : state.isFocused
                              ? (document.documentElement.classList.contains('dark') ? '#334155' : '#e0e7ff')
                              : (document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff'),
                          color: state.isSelected
                            ? '#fff'
                            : (document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937'),
                          fontSize: '1rem',
                        }),
                        singleValue: base => ({
                          ...base,
                          color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                        }),
                        placeholder: base => ({
                          ...base,
                          color: document.documentElement.classList.contains('dark') ? '#64748b' : '#6b7280',
                        }),
                        input: base => ({
                          ...base,
                          color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                        }),
                        dropdownIndicator: base => ({
                          ...base,
                          color: document.documentElement.classList.contains('dark') ? '#64748b' : '#6b7280',
                          '&:hover': { color: '#3b82f6' },
                        }),
                        indicatorSeparator: base => ({
                          ...base,
                          backgroundColor: 'transparent',
                        }),
                      }}
                    />
                  );
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topik</label>
                <input
                  type="text"
                  name="topik"
                  value={form.topik}
                  readOnly
                  placeholder="Pilih Mata Kuliah terlebih dahulu"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-300 font-normal text-sm cursor-not-allowed"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pengampu</label>
                {(() => {
                  // Filter dosen berdasarkan keahlian yang dipilih
                  let filteredDosen: DosenOption[] = [];

                  if (selectedKeahlian) {
                    filteredDosen = (dosenList || []).filter(d => d.keahlian === selectedKeahlian);
                  } else if (form.dosen_id) {
                    // Jika tidak ada selectedKeahlian tapi ada dosen_id, cari dosen yang sesuai
                    const selectedDosen = (dosenList || []).find(d => d.id === form.dosen_id);
                    if (selectedDosen) {
                      filteredDosen = [selectedDosen];
                      // Set selectedKeahlian jika belum diset
                      if (!selectedKeahlian) {
                        setSelectedKeahlian(selectedDosen.keahlian);
                      }
                    }
                  }

                  // Warning jika tidak ada data dosen sama sekali
                  if (dosenList.length === 0) {
                    return (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                            Belum ada dosen yang ditambahkan untuk mata kuliah ini
                          </span>
                        </div>
                        <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                          Silakan tambahkan dosen terlebih dahulu di halaman Dosen Detail
                        </p>
                      </div>
                    );
                  }

                  // Warning jika kategori sudah dipilih tapi tidak ada dosen untuk keahlian tersebut
                  if (form.kategori_id && filteredDosen.length === 0 && selectedKeahlian) {
                    return (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                            Belum ada dosen yang di-assign untuk keahlian "{selectedKeahlian}"
                          </span>
                        </div>
                        <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                          Silakan tugaskan dosen di halaman CSR Detail terlebih dahulu
                        </p>
                      </div>
                    );
                  }

                  return (
                    <Select
                      options={filteredDosen.map(d => ({
                        value: d.id,
                        label: d.name
                      }))}
                      value={filteredDosen.map(d => ({
                        value: d.id,
                        label: d.name
                      })).find(opt => opt.value === form.dosen_id) || null}
                      onChange={opt => {
                        setForm(f => ({ ...f, dosen_id: opt?.value || null }));
                        setErrorForm(''); // Reset error when selection changes
                      }}
                      placeholder={form.kategori_id
                        ? (filteredDosen.length > 0
                          ? `Pilih Dosen untuk keahlian "${selectedKeahlian}"`
                          : `Tidak ada dosen ditugaskan untuk keahlian "${selectedKeahlian}"`)
                        : "Pilih Keahlian terlebih dahulu"
                      }
                      isClearable
                      isDisabled={!form.kategori_id}
                      classNamePrefix="react-select"
                      className="react-select-container"
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f9fafb',
                          borderColor: state.isFocused
                            ? '#3b82f6'
                            : (document.documentElement.classList.contains('dark') ? '#334155' : '#d1d5db'),
                          color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                          boxShadow: state.isFocused ? '0 0 0 2px #3b82f633' : undefined,
                          borderRadius: '0.75rem',
                          minHeight: '2.5rem',
                          fontSize: '1rem',
                          paddingLeft: '0.75rem',
                          paddingRight: '0.75rem',
                          '&:hover': { borderColor: '#3b82f6' },
                        }),
                        menu: base => ({
                          ...base,
                          zIndex: 9999,
                          fontSize: '1rem',
                          backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
                          color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                        }),
                        option: (base, state) => ({
                          ...base,
                          backgroundColor: state.isSelected
                            ? '#3b82f6'
                            : state.isFocused
                              ? (document.documentElement.classList.contains('dark') ? '#334155' : '#e0e7ff')
                              : (document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff'),
                          color: state.isSelected
                            ? '#fff'
                            : (document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937'),
                          fontSize: '1rem',
                        }),
                        singleValue: base => ({
                          ...base,
                          color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                        }),
                        placeholder: base => ({
                          ...base,
                          color: document.documentElement.classList.contains('dark') ? '#64748b' : '#6b7280',
                        }),
                        input: base => ({
                          ...base,
                          color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                        }),
                        dropdownIndicator: base => ({
                          ...base,
                          color: document.documentElement.classList.contains('dark') ? '#64748b' : '#6b7280',
                          '&:hover': { color: '#3b82f6' },
                        }),
                        indicatorSeparator: base => ({
                          ...base,
                          backgroundColor: 'transparent',
                        }),
                      }}
                    />
                  );
                })()}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Ruangan</label>
                {ruanganList.length === 0 ? (
                  <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                      <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                        Belum ada ruangan yang ditambahkan untuk mata kuliah ini
                      </span>
                    </div>
                    <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                      Silakan tambahkan ruangan terlebih dahulu di halaman Ruangan Detail
                    </p>
                  </div>
                ) : (
                  <Select
                    options={ruanganOptions}
                    value={ruanganOptions.find(opt => opt.value === form.ruangan_id) || null}
                    onChange={opt => setForm(f => ({ ...f, ruangan_id: opt?.value || null }))}
                    placeholder="Pilih Ruangan"
                    isClearable
                    classNamePrefix="react-select"
                    className="react-select-container"
                    styles={{
                      control: (base, state) => ({
                        ...base,
                        backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#f9fafb',
                        borderColor: state.isFocused
                          ? '#3b82f6'
                          : (document.documentElement.classList.contains('dark') ? '#334155' : '#d1d5db'),
                        color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                        boxShadow: state.isFocused ? '0 0 0 2px #3b82f633' : undefined,
                        borderRadius: '0.75rem',
                        minHeight: '2.5rem',
                        fontSize: '1rem',
                        paddingLeft: '0.75rem',
                        paddingRight: '0.75rem',
                        '&:hover': { borderColor: '#3b82f6' },
                      }),
                      menu: base => ({
                        ...base,
                        zIndex: 9999,
                        fontSize: '1rem',
                        backgroundColor: document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff',
                        color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                      }),
                      option: (base, state) => ({
                        ...base,
                        backgroundColor: state.isSelected
                          ? '#3b82f6'
                          : state.isFocused
                            ? (document.documentElement.classList.contains('dark') ? '#334155' : '#e0e7ff')
                            : (document.documentElement.classList.contains('dark') ? '#1e293b' : '#fff'),
                        color: state.isSelected
                          ? '#fff'
                          : (document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937'),
                        fontSize: '1rem',
                      }),
                      singleValue: base => ({
                        ...base,
                        color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                      }),
                      placeholder: base => ({
                        ...base,
                        color: document.documentElement.classList.contains('dark') ? '#64748b' : '#6b7280',
                      }),
                      input: base => ({
                        ...base,
                        color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                      }),
                      dropdownIndicator: base => ({
                        ...base,
                        color: document.documentElement.classList.contains('dark') ? '#64748b' : '#6b7280',
                        '&:hover': { color: '#3b82f6' },
                      }),
                      indicatorSeparator: base => ({
                        ...base,
                        backgroundColor: 'transparent',
                      }),
                    }}
                  />
                )}
              </div>
              {/* Error dari backend */}
              {errorBackend && (
                <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-center">
                    <svg className="w-8 h-8 text-red-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-sm text-red-700 dark:text-red-300">{errorBackend}</span>
                  </div>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-4">
                <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition">Batal</button>
                <button
                  onClick={handleTambahJadwal}
                  className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  disabled={!form.jenis_csr || !form.tanggal || !form.jam_mulai || !form.jam_selesai || !form.dosen_id || !form.ruangan_id || !form.kelompok_kecil_id || !form.kategori_id || !form.topik || isSaving}
                >
                  {isSaving ? (
                    <>
                      <svg
                        className="w-4 h-4 animate-spin text-white"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="none"
                        viewBox="0 0 24 24"
                      >
                        <circle
                          className="opacity-25"
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="4"
                        ></circle>
                        <path
                          className="opacity-75"
                          fill="currentColor"
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        ></path>
                      </svg>
                      Menyimpan...
                    </>
                  ) : (editIndex !== null ? 'Simpan' : 'Tambah Jadwal')}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-50">
              <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Konfirmasi Hapus</h2>
              <p className="mb-6 text-gray-500 dark:text-gray-300">Apakah Anda yakin ingin menghapus data ini? Data yang dihapus tidak dapat dikembalikan.</p>
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition">Batal</button>
                <button onClick={() => { if (selectedDeleteIndex !== null) { handleDeleteJadwal(selectedDeleteIndex); setShowDeleteModal(false); setSelectedDeleteIndex(null); } }} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition">Hapus</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Modal Pilihan Template CSR */}
      <AnimatePresence>
        {showCSRTemplateSelectionModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowCSRTemplateSelectionModal(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowCSRTemplateSelectionModal(false)}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="w-6 h-6"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>

              <div>
                <div className="flex items-center justify-between pb-4 sm:pb-6">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                      Pilih Format Template
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Pilih format template yang sesuai dengan file Excel Anda
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-3 sm:mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Pilih jenis template yang ingin digunakan
                    </label>
                  </div>

                  <div className="space-y-3">
                    {/* Template Aplikasi */}
                    <div
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
                      onClick={() => handleCSRTemplateSelection('APLIKASI')}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Template Aplikasi
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            File dari download template atau export Excel aplikasi ini
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Template SIAKAD */}
                    <div
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200"
                      onClick={() => handleCSRTemplateSelection('SIAKAD')}
                    >
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Template SIAKAD
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            File dari sistem SIAKAD dengan format standar
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Import Excel CSR - Template Aplikasi */}
      <AnimatePresence>
        {showCSRImportModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowCSRImportModal(false)}
            />
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-6xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowCSRImportModal(false)}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="w-6 h-6"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>

              {/* Header */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Import Jadwal CSR - Template Aplikasi</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Preview dan validasi data sebelum import</p>
              </div>
              {/* Upload File Section */}
              {!csrImportFile && (
                <div className="mb-6">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-brand-500 dark:hover:border-brand-400 transition-colors">
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon icon={faFileExcel} className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Upload File Excel</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Pilih file Excel dengan format template aplikasi (.xlsx, .xls)
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors cursor-pointer">
                        <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                        Pilih File
                        <input
                          ref={csrFileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleCSRImportExcelUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* File Info */}
              {csrImportFile && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-800 dark:text-blue-200">{csrImportFile.name}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-300">
                        {(csrImportFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={handleCSRRemoveFile}
                      className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                      title="Hapus file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Error Messages */}
              {(csrImportErrors.length > 0 ||
                csrCellErrors.length > 0) && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        <FontAwesomeIcon
                          icon={faExclamationTriangle}
                          className="w-5 h-5 text-red-500"
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                          Error Validasi (
                          {csrImportErrors.length +
                            csrCellErrors.length}{" "}
                          error)
                        </h3>
                        <div className="max-h-40 overflow-y-auto">
                          {/* Error dari API response */}
                          {csrImportErrors.map((err, idx) => (
                            <p
                              key={idx}
                              className="text-sm text-red-600 dark:text-red-400 mb-1"
                            >
                              • {err}
                            </p>
                          ))}
                          {/* Error cell/detail */}
                          {csrCellErrors.map((err, idx) => (
                            <p
                              key={`cell-${idx}`}
                              className="text-sm text-red-600 dark:text-red-400 mb-1"
                            >
                              • {err.message}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* Preview Data Table */}
              {csrImportData.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      Preview Data ({csrImportData.length} jadwal)
                    </h3>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      File: {csrImportFile?.name}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
                    <div className="max-w-full overflow-x-auto hide-scroll">
                      <table className="min-w-full divide-y divide-gray-100 dark:divide-white/5 text-sm">
                        <thead className="border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Tanggal</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Jam Mulai</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Jenis CSR</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok Kecil</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Keahlian</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Dosen</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csrImportData.slice((csrImportPage - 1) * csrImportPageSize, csrImportPage * csrImportPageSize).map((row, index) => {
                            const actualIndex = (csrImportPage - 1) * csrImportPageSize + index;
                            const cellError = (field: string) => csrCellErrors.find(err => err.row === (actualIndex + 1) && err.field === field);

                            return (
                              <tr key={actualIndex}>
                                <td className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap">
                                  {actualIndex + 1}
                                </td>
                                {renderCSREditableCell('tanggal', row.tanggal, index)}
                                {renderCSREditableCell('jam_mulai', row.jam_mulai, index)}
                                {renderCSREditableCell('jenis_csr', row.jenis_csr, index)}

                                {/* Kelompok Kecil - Special handling */}
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${csrEditingCell?.row === actualIndex && csrEditingCell?.key === 'nama_kelompok' ? 'border-2 border-brand-500' : ''} ${cellError('kelompok_kecil_id') ? 'bg-red-50 dark:bg-red-900/30' : ''}`}
                                  onClick={() => setCSREditingCell({ row: actualIndex, key: 'nama_kelompok' })}
                                  title={cellError('kelompok_kecil_id')?.message || ''}
                                >
                                  {csrEditingCell?.row === actualIndex && csrEditingCell?.key === 'nama_kelompok' ? (
                                    <input
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                      value={row.nama_kelompok || ""}
                                      onChange={e => handleCSRKelompokKecilEdit(actualIndex, e.target.value)}
                                      onBlur={() => setCSREditingCell(null)}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={cellError('kelompok_kecil_id') ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                      {kelompokKecilList.find(k => k.id === row.kelompok_kecil_id)?.nama_kelompok || row.nama_kelompok || 'Tidak ditemukan'}
                                    </span>
                                  )}
                                </td>

                                {renderCSREditableCell('topik', row.topik, index)}
                                {/* Keahlian - Special handling */}
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${csrEditingCell?.row === actualIndex && csrEditingCell?.key === 'nama_keahlian' ? 'border-2 border-brand-500' : ''} ${cellError('kategori_id') ? 'bg-red-50 dark:bg-red-900/30' : ''}`}
                                  onClick={() => setCSREditingCell({ row: actualIndex, key: 'nama_keahlian' })}
                                  title={cellError('kategori_id')?.message || ''}
                                >
                                  {csrEditingCell?.row === actualIndex && csrEditingCell?.key === 'nama_keahlian' ? (
                                    <input
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                      value={row.nama_keahlian || ""}
                                      onChange={e => handleCSRKeahlianEdit(actualIndex, e.target.value)}
                                      onBlur={() => setCSREditingCell(null)}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={cellError('kategori_id') ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                      {row.nama_keahlian || '-'}
                                    </span>
                                  )}
                                </td>

                                {/* Dosen - Special handling */}
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${csrEditingCell?.row === actualIndex && csrEditingCell?.key === 'nama_dosen' ? 'border-2 border-brand-500' : ''} ${cellError('dosen_id') ? 'bg-red-50 dark:bg-red-900/30' : ''}`}
                                  onClick={() => setCSREditingCell({ row: actualIndex, key: 'nama_dosen' })}
                                  title={cellError('dosen_id')?.message || ''}
                                >
                                  {csrEditingCell?.row === actualIndex && csrEditingCell?.key === 'nama_dosen' ? (
                                    <input
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                      value={row.nama_dosen || ""}
                                      onChange={e => handleCSRDosenEdit(actualIndex, e.target.value)}
                                      onBlur={() => setCSREditingCell(null)}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={cellError('dosen_id') ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                      {dosenList.find(d => d.id === row.dosen_id)?.name || row.nama_dosen || 'Tidak ditemukan'}
                                    </span>
                                  )}
                                </td>

                                {/* Ruangan - Special handling */}
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${csrEditingCell?.row === actualIndex && csrEditingCell?.key === 'nama_ruangan' ? 'border-2 border-brand-500' : ''} ${cellError('ruangan_id') ? 'bg-red-50 dark:bg-red-900/30' : ''}`}
                                  onClick={() => setCSREditingCell({ row: actualIndex, key: 'nama_ruangan' })}
                                  title={cellError('ruangan_id')?.message || ''}
                                >
                                  {csrEditingCell?.row === actualIndex && csrEditingCell?.key === 'nama_ruangan' ? (
                                    <input
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                      value={row.nama_ruangan || ""}
                                      onChange={e => handleCSRRuanganEdit(actualIndex, e.target.value)}
                                      onBlur={() => setCSREditingCell(null)}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={cellError('ruangan_id') ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                      {ruanganList.find(r => r.id === row.ruangan_id)?.nama || row.nama_ruangan || 'Tidak ditemukan'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      {csrImportData.length > csrImportPageSize && (
                        <div className="flex items-center justify-between px-6 py-4 bg-gray-50 dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            Menampilkan {((csrImportPage - 1) * csrImportPageSize) + 1} sampai {Math.min(csrImportPage * csrImportPageSize, csrImportData.length)} dari {csrImportData.length} data
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setCSRImportPage(prev => Math.max(1, prev - 1))}
                              disabled={csrImportPage === 1}
                              className="px-3 py-1 text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
                            >
                              Previous
                            </button>
                            <span className="px-3 py-1 text-sm text-gray-700 dark:text-gray-300">
                              {csrImportPage} / {Math.ceil(csrImportData.length / csrImportPageSize)}
                            </span>
                            <button
                              onClick={() => setCSRImportPage(prev => Math.min(Math.ceil(csrImportData.length / csrImportPageSize), prev + 1))}
                              disabled={csrImportPage >= Math.ceil(csrImportData.length / csrImportPageSize)}
                              className="px-3 py-1 text-sm bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons - Template Aplikasi */}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowCSRImportModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Batal
                </button>
                {csrImportData.length > 0 && csrCellErrors.length === 0 && (
                  <button
                    onClick={handleCSRSubmitImport}
                    disabled={isCSRImporting}
                    className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCSRImporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Importing...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                        Import Data ({csrImportData.length} jadwal)
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Import Excel CSR - Template SIAKAD */}
      <AnimatePresence>
        {showCSRSIAKADImportModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowCSRSIAKADImportModal(false)}
            />
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-6xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowCSRSIAKADImportModal(false)}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="w-6 h-6"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>

              {/* Header */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Import Jadwal CSR</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Template SIAKAD - Preview dan validasi data sebelum import</p>
              </div>
              {/* Info Box untuk Template SIAKAD */}
              <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                    <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                      Informasi Mapping Template SIAKAD
                    </h3>
                    <div className="text-sm text-green-700 dark:text-green-300 space-y-2">
                      <div>
                        <strong>Kolom yang tersedia di SIAKAD:</strong>
                        <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                          <li>Tanggal → Tanggal</li>
                          <li>Waktu Mulai → Jam mulai</li>
                          <li>Kelompok → Kelompok kecil</li>
                          <li>Topik → Topik</li>
                          <li>Ruang → Ruangan</li>
                        </ul>
                      </div>
                      <div>
                        <strong>Kolom yang <span className="text-red-600 dark:text-red-400">WAJIB diisi manual</span> (tidak ada di SIAKAD):</strong>
                        <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                          <li>Jenis CSR → Klik kolom "Kosong (isi manual)" untuk memilih (reguler/responsi)</li>
                          <li>Keahlian → Klik kolom "Kosong (isi manual)" untuk memilih keahlian</li>
                          <li>Dosen → Klik kolom "Kosong (isi manual)" untuk memilih dosen</li>
                          <li>Sesi → Klik kolom "Kosong (isi manual)" untuk mengisi</li>
                        </ul>
                      </div>
                      <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                        <strong>Tips:</strong> Klik pada kolom yang menampilkan "Kosong (isi manual)" untuk mengisi data yang diperlukan. Jam selesai akan otomatis dihitung berdasarkan jenis CSR: reguler = 3x50 menit, responsi = 2x50 menit.
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Upload File Section - SIAKAD */}
              {!csrSiakadImportFile && (
                <div className="mb-6">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-brand-500 dark:hover:border-brand-400 transition-colors">
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon icon={faFileExcel} className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Upload File Excel SIAKAD</h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Pilih file Excel dengan format SIAKAD (.xlsx, .xls)
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors cursor-pointer">
                        <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                        Pilih File
                        <input
                          ref={csrSiakadFileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleCSRSiakadImportExcelUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* File Info - SIAKAD */}
              {csrSiakadImportFile && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-800 dark:text-blue-200">{csrSiakadImportFile.name}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-300">
                        {(csrSiakadImportFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={handleCSRSiakadRemoveFile}
                      className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-500 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                      title="Hapus file"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}

              {/* Error Messages - SIAKAD */}
              {(csrSiakadImportErrors.length > 0 ||
                csrSiakadCellErrors.length > 0) && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        <FontAwesomeIcon
                          icon={faExclamationTriangle}
                          className="w-5 h-5 text-red-500"
                        />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                          Error Validasi (
                          {csrSiakadImportErrors.length +
                            csrSiakadCellErrors.length}{" "}
                          error)
                        </h3>
                        <div className="max-h-40 overflow-y-auto">
                          {/* Error dari API response */}
                          {csrSiakadImportErrors.map((err, idx) => (
                            <p
                              key={idx}
                              className="text-sm text-red-600 dark:text-red-400 mb-1"
                            >
                              • {err}
                            </p>
                          ))}
                          {/* Error cell/detail */}
                          {csrSiakadCellErrors.map((err, idx) => (
                            <p
                              key={`cell-${idx}`}
                              className="text-sm text-red-600 dark:text-red-400 mb-1"
                            >
                              • {err.message}
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              {/* Preview Data Table - SIAKAD */}
              {csrSiakadImportData.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      Preview Data ({csrSiakadImportData.length} jadwal)
                    </h3>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      File: {csrSiakadImportFile?.name}
                    </div>
                  </div>

                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/5 dark:bg-white/3">
                    <div className="max-w-full overflow-x-auto hide-scroll">
                      <table className="min-w-full divide-y divide-gray-100 dark:divide-white/5 text-sm">
                        <thead className="border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Tanggal</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Jam Mulai</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Jenis CSR</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok Kecil</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Keahlian</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Dosen</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                          </tr>
                        </thead>
                        <tbody>
                          {csrSiakadImportData.slice((csrSiakadImportPage - 1) * DEFAULT_PAGE_SIZE, csrSiakadImportPage * DEFAULT_PAGE_SIZE).map((row, index) => {
                            const actualIndex = (csrSiakadImportPage - 1) * DEFAULT_PAGE_SIZE + index;
                            const cellError = (field: string) => csrSiakadCellErrors.find(err => err.row === (actualIndex + 1) && err.field === field);

                            return (
                              <tr key={actualIndex}>
                                <td className="px-4 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap">
                                  {actualIndex + 1}
                                </td>

                                {/* Tanggal */}
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'tanggal' ? 'border-2 border-brand-500' : ''} ${cellError('tanggal') || (!row.tanggal || row.tanggal.trim() === '') ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                  onClick={() => setCSRSiakadEditingCell({ row: actualIndex, key: 'tanggal' })}
                                  title={cellError('tanggal')?.message || ''}
                                >
                                  {csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'tanggal' ? (
                                    <input
                                      type="text"
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                      value={row.tanggal || ''}
                                      onChange={e => handleCSRSiakadCellEdit(actualIndex, 'tanggal', e.target.value)}
                                      onBlur={() => setCSRSiakadEditingCell(null)}
                                      autoFocus
                                      placeholder="YYYY-MM-DD"
                                    />
                                  ) : (
                                    <span className={cellError('tanggal') || (!row.tanggal || row.tanggal.trim() === '') ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                      {row.tanggal || 'Wajib diisi'}
                                    </span>
                                  )}
                                </td>

                                {/* Jam Mulai */}
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'jam_mulai' ? 'border-2 border-brand-500' : ''} ${cellError('jam_mulai') ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                  onClick={() => setCSRSiakadEditingCell({ row: actualIndex, key: 'jam_mulai' })}
                                  title={cellError('jam_mulai')?.message || ''}
                                >
                                  {csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'jam_mulai' ? (
                                    <input
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                      value={row.jam_mulai || ''}
                                      onChange={e => handleCSRSiakadCellEdit(actualIndex, 'jam_mulai', e.target.value)}
                                      onBlur={() => setCSRSiakadEditingCell(null)}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={cellError('jam_mulai') ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                      {row.jam_mulai || '-'}
                                    </span>
                                  )}
                                </td>

                                {/* Jenis CSR */}
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'jenis_csr' ? 'border-2 border-brand-500' : ''} ${cellError('jenis_csr') || (!row.jenis_csr || row.jenis_csr.trim() === '') ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                  onClick={() => setCSRSiakadEditingCell({ row: actualIndex, key: 'jenis_csr' })}
                                  title={cellError('jenis_csr')?.message || ''}
                                >
                                  {csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'jenis_csr' ? (
                                    <input
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                      value={row.jenis_csr || ''}
                                      onChange={e => handleCSRSiakadCellEdit(actualIndex, 'jenis_csr', e.target.value)}
                                      onBlur={() => setCSRSiakadEditingCell(null)}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={cellError('jenis_csr') || (!row.jenis_csr || row.jenis_csr.trim() === '') ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                      {row.jenis_csr || 'Kosong (isi manual)'}
                                    </span>
                                  )}
                                </td>

                                {/* Kelompok Kecil */}
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'nama_kelompok' ? 'border-2 border-brand-500' : ''} ${cellError('kelompok_kecil_id') || (!row.nama_kelompok || row.nama_kelompok.trim() === '') ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                  onClick={() => setCSRSiakadEditingCell({ row: actualIndex, key: 'nama_kelompok' })}
                                  title={cellError('kelompok_kecil_id')?.message || ''}
                                >
                                  {csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'nama_kelompok' ? (
                                    <input
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                      value={row.nama_kelompok === 'Wajib diisi' ? "" : (row.nama_kelompok || "")}
                                      onChange={e => handleCSRSiakadKelompokKecilEdit(actualIndex, e.target.value)}
                                      onBlur={() => setCSRSiakadEditingCell(null)}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={cellError('kelompok_kecil_id') || (!row.nama_kelompok || row.nama_kelompok.trim() === '') ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                      {kelompokKecilList.find(k => k.id === row.kelompok_kecil_id)?.nama_kelompok || row.nama_kelompok || 'Wajib diisi'}
                                    </span>
                                  )}
                                </td>

                                {/* Topik */}
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'topik' ? 'border-2 border-brand-500' : ''} ${cellError('topik') ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                  onClick={() => setCSRSiakadEditingCell({ row: actualIndex, key: 'topik' })}
                                  title={cellError('topik')?.message || ''}
                                >
                                  {csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'topik' ? (
                                    <input
                                      type="text"
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                      value={row.topik || ''}
                                      onChange={e => handleCSRSiakadCellEdit(actualIndex, 'topik', e.target.value)}
                                      onBlur={() => setCSRSiakadEditingCell(null)}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={cellError('topik') ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                      {row.topik || '-'}
                                    </span>
                                  )}
                                </td>

                                {/* Keahlian */}
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'nama_keahlian' ? 'border-2 border-brand-500' : ''} ${cellError('kategori_id') || (!row.nama_keahlian || row.nama_keahlian.trim() === '') ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                  onClick={() => setCSRSiakadEditingCell({ row: actualIndex, key: 'nama_keahlian' })}
                                  title={cellError('kategori_id')?.message || ''}
                                >
                                  {csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'nama_keahlian' ? (
                                    <input
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                      value={row.nama_keahlian || ''}
                                      onChange={e => handleCSRSiakadKeahlianEdit(actualIndex, e.target.value)}
                                      onBlur={() => setCSRSiakadEditingCell(null)}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={cellError('kategori_id') || (!row.nama_keahlian || row.nama_keahlian.trim() === '') ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                      {row.nama_keahlian || 'Kosong (isi manual)'}
                                    </span>
                                  )}
                                </td>

                                {/* Dosen */}
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'nama_dosen' ? 'border-2 border-brand-500' : ''} ${cellError('dosen_id') || (!row.nama_dosen || row.nama_dosen.trim() === '') ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                  onClick={() => setCSRSiakadEditingCell({ row: actualIndex, key: 'nama_dosen' })}
                                  title={cellError('dosen_id')?.message || ''}
                                >
                                  {csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'nama_dosen' ? (
                                    <input
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                      value={row.nama_dosen || ''}
                                      onChange={e => handleCSRSiakadDosenEdit(actualIndex, e.target.value)}
                                      onBlur={() => setCSRSiakadEditingCell(null)}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={cellError('dosen_id') || (!row.nama_dosen || row.nama_dosen.trim() === '') ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                      {dosenList.find(d => d.id === row.dosen_id)?.name || row.nama_dosen || 'Kosong (isi manual)'}
                                    </span>
                                  )}
                                </td>

                                {/* Ruangan */}
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'nama_ruangan' ? 'border-2 border-brand-500' : ''} ${cellError('ruangan_id') || (!row.nama_ruangan || row.nama_ruangan.trim() === '') ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                  onClick={() => setCSRSiakadEditingCell({ row: actualIndex, key: 'nama_ruangan' })}
                                  title={cellError('ruangan_id')?.message || ''}
                                >
                                  {csrSiakadEditingCell?.row === actualIndex && csrSiakadEditingCell?.key === 'nama_ruangan' ? (
                                    <input
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                      value={row.nama_ruangan === 'Wajib diisi' ? "" : (row.nama_ruangan || "")}
                                      onChange={e => handleCSRSiakadRuanganEdit(actualIndex, e.target.value)}
                                      onBlur={() => setCSRSiakadEditingCell(null)}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={cellError('ruangan_id') || (!row.nama_ruangan || row.nama_ruangan.trim() === '') ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                      {ruanganList.find(r => r.id === row.ruangan_id)?.nama || row.nama_ruangan || 'Wajib diisi'}
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Pagination - SIAKAD */}
                  {csrSiakadImportData.length > DEFAULT_PAGE_SIZE && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Menampilkan {((csrSiakadImportPage - 1) * DEFAULT_PAGE_SIZE) + 1} - {Math.min(csrSiakadImportPage * DEFAULT_PAGE_SIZE, csrSiakadImportData.length)} dari {csrSiakadImportData.length} jadwal
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => setCSRSiakadImportPage(p => Math.max(1, p - 1))}
                          disabled={csrSiakadImportPage === 1}
                          className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Previous
                        </button>
                        <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                          Page {csrSiakadImportPage} of {Math.ceil(csrSiakadImportData.length / DEFAULT_PAGE_SIZE)}
                        </span>
                        <button
                          onClick={() => setCSRSiakadImportPage(p => Math.min(Math.ceil(csrSiakadImportData.length / DEFAULT_PAGE_SIZE), p + 1))}
                          disabled={csrSiakadImportPage >= Math.ceil(csrSiakadImportData.length / DEFAULT_PAGE_SIZE)}
                          className="px-3 py-1 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons - SIAKAD */}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowCSRSIAKADImportModal(false)}
                  className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Batal
                </button>
                {csrSiakadImportData.length > 0 && csrSiakadCellErrors.length === 0 && (
                  <button
                    onClick={handleCSRSiakadSubmitImport}
                    disabled={isCSRSiakadImporting}
                    className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isCSRSiakadImporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Importing...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                        Import Data ({csrSiakadImportData.length} jadwal)
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Konfirmasi Bulk Delete CSR */}
      <AnimatePresence>
        {showCSRBulkDeleteModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowCSRBulkDeleteModal(false)}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              <div className="flex items-center justify-between pb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Konfirmasi Hapus Data</h2>
              </div>
              <div>
                <p className="mb-6 text-gray-500 dark:text-gray-400">
                  Apakah Anda yakin ingin menghapus <span className="font-semibold text-gray-800 dark:text-white">
                    {selectedCSRItems.length}
                  </span> jadwal CSR terpilih? Data yang dihapus tidak dapat dikembalikan.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowCSRBulkDeleteModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmCSRBulkDelete}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center"
                    disabled={isCSRDeleting}
                  >
                    {isCSRDeleting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                        Menghapus...
                      </>
                    ) : (
                      'Hapus'
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Export CSR */}
      <AnimatePresence>
        {showCSRExportModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowCSRExportModal(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowCSRExportModal(false)}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="w-6 h-6"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>

              <div>
                <div className="flex items-center justify-between pb-4 sm:pb-6">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                      Pilih Format Template
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Pilih format template yang sesuai dengan file Excel Anda
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-3 sm:mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Pilih jenis template yang ingin digunakan
                    </label>
                  </div>

                  <div className="space-y-3">
                    {/* Template Aplikasi */}
                    <div
                      className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 ${selectedCSRExportTemplate === 'APLIKASI'
                        ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-600'
                        : ''
                        }`}
                      onClick={() => setSelectedCSRExportTemplate('APLIKASI')}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedCSRExportTemplate === 'APLIKASI'
                            ? 'bg-brand-500 border-brand-500'
                            : 'border-gray-300 dark:border-gray-600'
                            }`}
                        >
                          {selectedCSRExportTemplate === 'APLIKASI' && (
                            <svg
                              className="w-2.5 h-2.5 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Template Aplikasi
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            File dari download template atau export Excel aplikasi ini
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Template SIAKAD */}
                    <div
                      className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 ${selectedCSRExportTemplate === 'SIAKAD'
                        ? 'bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-600'
                        : ''
                        }`}
                      onClick={() => setSelectedCSRExportTemplate('SIAKAD')}
                    >
                      <div className="flex items-center space-x-3">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${selectedCSRExportTemplate === 'SIAKAD'
                            ? 'bg-brand-500 border-brand-500'
                            : 'border-gray-300 dark:border-gray-600'
                            }`}
                        >
                          {selectedCSRExportTemplate === 'SIAKAD' && (
                            <svg
                              className="w-2.5 h-2.5 text-white"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-green-600 dark:text-green-400" />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Template SIAKAD
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            File dari sistem SIAKAD dengan format standar
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 relative z-20">
                  <button
                    onClick={() => setShowCSRExportModal(false)}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleCSRExport}
                    disabled={!selectedCSRExportTemplate}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ease-in-out ${selectedCSRExportTemplate
                      ? 'bg-blue-600 hover:bg-blue-700 text-white'
                      : 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                      }`}
                  >
                    Export
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
} 
