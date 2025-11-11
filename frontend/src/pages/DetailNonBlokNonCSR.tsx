import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef } from 'react';
import api, { handleApiError } from '../utils/api';
import { ChevronLeftIcon } from '../icons';
import { AnimatePresence, motion } from 'framer-motion';
import Select from 'react-select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrash, faFileExcel, faDownload, faUpload, faExclamationTriangle, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { getRuanganOptions } from '../utils/ruanganHelper';
import * as XLSX from 'xlsx';

// Constants
const SESSION_DURATION_MINUTES = 50;
const MAX_SESSIONS = 6;
const MIN_SESSIONS = 1;
const TEMPLATE_DISPLAY_LIMIT = 10;
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const EXCEL_COLUMN_WIDTHS = {
  TANGGAL: 12,
  JAM_MULAI: 10,
  JENIS_BARIS: 12,
  SESI: 6,
  KELOMPOK_BESAR: 15,
  DOSEN: 20,
  MATERI: 25,
  RUANGAN: 15,
  AGENDA: 20,
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

interface JadwalNonBlokNonCSR {
  id?: number;
  mata_kuliah_kode: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  jumlah_sesi: number;
  jenis_baris: 'materi' | 'agenda';
  agenda?: string;
  materi?: string;
  dosen_id?: number;
  ruangan_id: number | null;
  kelompok_besar_id?: number | null;
  use_ruangan?: boolean;
  status_konfirmasi?: string;
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
  };
}

interface DosenOption {
  id: number;
  name: string;
  nid: string;
}

interface RuanganOption {
  id: number;
  nama: string;
  kapasitas?: number;
  gedung?: string;
}

interface JadwalNonBlokNonCSRType {
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  jenis_baris: 'materi' | 'agenda';
  jumlah_sesi: number;
  kelompok_besar_id: number | null;
  nama_kelompok_besar?: string;
  dosen_id: number | null;
  nama_dosen?: string;
  materi?: string;
  ruangan_id: number | null;
  nama_ruangan?: string;
  agenda?: string;
  use_ruangan?: boolean;
}

export default function DetailNonBlokNonCSR() {
  const { kode } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<MataKuliah | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State untuk modal input jadwal materi
  const [showModal, setShowModal] = useState(false);
  const [jadwalMateri, setJadwalMateri] = useState<JadwalNonBlokNonCSR[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    hariTanggal: '',
    jamMulai: '',
    jumlahKali: 2,
    jamSelesai: '',
    pengampu: null as number | null,
    materi: '',
    lokasi: null as number | null,
    jenisBaris: 'materi' as 'materi' | 'agenda',
    agenda: '', // hanya untuk agenda khusus
    kelompokBesar: null as number | null,
    useRuangan: true,
  });
  const [errorForm, setErrorForm] = useState(''); // Error frontend (validasi form)
  const [errorBackend, setErrorBackend] = useState(''); // Error backend (response API)
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteIndex, setSelectedDeleteIndex] = useState<number | null>(null);
  
  // Pagination logic functions
  const getPaginatedData = (data: any[], page: number, pageSize: number): any[] => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (dataLength: number, pageSize: number): number => {
    return Math.ceil(dataLength / pageSize);
  };

  const resetPagination = () => {
    setNonCsrPage(1);
  };
  
  // State untuk dropdown options
  const [dosenList, setDosenList] = useState<DosenOption[]>([]);
  const [ruanganList, setRuanganList] = useState<RuanganOption[]>([]);
  const [jamOptions, setJamOptions] = useState<string[]>([]);
  const [kelompokBesarAgendaOptions, setKelompokBesarAgendaOptions] = useState<{id: string | number, label: string, jumlah_mahasiswa: number}[]>([]);
  const [kelompokBesarMateriOptions, setKelompokBesarMateriOptions] = useState<{id: string | number, label: string, jumlah_mahasiswa: number}[]>([]);

  // Pagination state for Non-CSR schedule
  const [nonCsrPage, setNonCsrPage] = useState(1);
  const [nonCsrPageSize, setNonCsrPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  // State untuk import Excel Non-Blok Non-CSR
  const [showNonBlokImportModal, setShowNonBlokImportModal] = useState(false);
  const [nonBlokImportFile, setNonBlokImportFile] = useState<File | null>(null);
  const [nonBlokImportData, setNonBlokImportData] = useState<JadwalNonBlokNonCSRType[]>([]);
  const [nonBlokImportErrors, setNonBlokImportErrors] = useState<string[]>([]);
  const [nonBlokCellErrors, setNonBlokCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [nonBlokEditingCell, setNonBlokEditingCell] = useState<{ row: number, key: string } | null>(null);
  const [nonBlokImportPage, setNonBlokImportPage] = useState(1);
  const [nonBlokImportPageSize, setNonBlokImportPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [nonBlokImportedCount, setNonBlokImportedCount] = useState(0);
  const nonBlokFileInputRef = useRef<HTMLInputElement>(null);
  const [isNonBlokImporting, setIsNonBlokImporting] = useState(false);

  // State untuk bulk delete Non Blok Non CSR
  const [selectedNonBlokItems, setSelectedNonBlokItems] = useState<number[]>([]);
  const [showNonBlokBulkDeleteModal, setShowNonBlokBulkDeleteModal] = useState(false);
  const [isNonBlokDeleting, setIsNonBlokDeleting] = useState(false);
  const [nonBlokSuccess, setNonBlokSuccess] = useState<string | null>(null);

  // Reset form function
  const resetForm = () => {
    setForm({
      hariTanggal: '',
      jamMulai: '',
      jumlahKali: 2,
      jamSelesai: '',
      pengampu: null,
      materi: '',
      lokasi: null,
      jenisBaris: 'materi' as 'materi' | 'agenda',
      agenda: '',
      kelompokBesar: null,
      useRuangan: true,
    });
    setEditIndex(null);
    setErrorForm('');
    setErrorBackend('');
  };


  // Fetch batch data untuk optimasi performa
  const fetchBatchData = async () => {
    if (!kode) return;
    
    try {
      const response = await api.get(`/non-blok-non-csr/${kode}/batch-data`);
      const batchData = response.data;
      
      // Set mata kuliah data
      setData(batchData.mata_kuliah);
      
      // Set jadwal Non-Blok Non-CSR data
      setJadwalMateri(batchData.jadwal_non_blok_non_csr);
      
      // Set reference data
      setDosenList(batchData.dosen_list);
      setRuanganList(batchData.ruangan_list);
      setJamOptions(batchData.jam_options);
      setKelompokBesarAgendaOptions(batchData.kelompok_besar_agenda_options || []);
      setKelompokBesarMateriOptions(batchData.kelompok_besar_materi_options || []);
      
    } catch (error: any) {
      setError(handleApiError(error, 'Memuat data batch'));
    }
  };

  function formatTanggalKonsisten(dateStr: string) {
    if (!dateStr) return '';
    
    const date = new Date(dateStr);
    const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIndo = hari[date.getDay()];
    
    // Format tanggal DD/MM/YYYY
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    
    return `${hariIndo}, ${day}/${month}/${year}`;
  }

  function formatJamTanpaDetik(jam: string) {
    if (!jam) return '';
    // Jika format sudah HH:MM, return as is
    if (/^\d{2}:\d{2}$/.test(jam)) return jam;
    // Jika format HH:MM:SS, hapus detik
    if (/^\d{2}:\d{2}:\d{2}$/.test(jam)) {
      return jam.substring(0, 5);
    }
    // Jika format HH.MM, konversi ke HH:MM
    if (/^\d{2}\.\d{2}$/.test(jam)) {
      return jam.replace('.', ':');
    }
    return jam;
  }

  // Hitung jam selesai otomatis
  function hitungJamSelesai(jamMulai: string, jumlahKali: number) {
    if (!jamMulai) return '';
    // Support format jam dengan titik (misal 09.00, 07.20)
    const [jamStr, menitStr] = jamMulai.split(/[.:]/); // support titik atau titik dua
    const jam = Number(jamStr);
    const menit = Number(menitStr);
    if (isNaN(jam) || isNaN(menit)) return '';
    const totalMenit = jam * 60 + menit + jumlahKali * SESSION_DURATION_MINUTES;
    const jamAkhir = Math.floor(totalMenit / 60).toString().padStart(2, '0');
    const menitAkhir = (totalMenit % 60).toString().padStart(2, '0');
    return `${jamAkhir}.${menitAkhir}`;
  }

  // Download template Excel untuk Non-Blok Non-CSR
  const downloadNonBlokTemplate = async () => {
    if (!data) return;

    try {
      // Generate example dates within mata kuliah date range
        const startDate = new Date(data.tanggal_mulai || '');
        const endDate = new Date(data.tanggal_akhir || '');
      const exampleDate1 = new Date(startDate.getTime() + (1 * 24 * 60 * 60 * 1000)); // +1 day
      const exampleDate2 = new Date(startDate.getTime() + (2 * 24 * 60 * 60 * 1000)); // +2 days

      // Template data
      const templateData = [
        ['Tanggal', 'Jam Mulai', 'Jenis Baris', 'Sesi', 'Kelompok Besar', 'Dosen', 'Materi', 'Ruangan', 'Keterangan Agenda'],
        [
          exampleDate1.toISOString().split('T')[0],
          '07.20',
          'materi',
          '1',
          '1',
          dosenList[0]?.name || 'Dosen 1',
          'Pengantar Mata Kuliah',
          ruanganList[0]?.nama || 'Ruang 1'
        ],
        [
          exampleDate2.toISOString().split('T')[0],
          '08.20',
          'agenda',
          '1',
          '1',
          '',
          '',
          '',
          'UTS AIK 1'
        ]
      ];

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Add template sheet
      const ws = XLSX.utils.aoa_to_sheet(templateData);
      
      // Set column widths
      const colWidths = [
        { wch: EXCEL_COLUMN_WIDTHS.TANGGAL },
        { wch: EXCEL_COLUMN_WIDTHS.JAM_MULAI },
        { wch: EXCEL_COLUMN_WIDTHS.JENIS_BARIS },
        { wch: EXCEL_COLUMN_WIDTHS.SESI },
        { wch: EXCEL_COLUMN_WIDTHS.KELOMPOK_BESAR },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: EXCEL_COLUMN_WIDTHS.MATERI },
        { wch: EXCEL_COLUMN_WIDTHS.RUANGAN },
        { wch: EXCEL_COLUMN_WIDTHS.AGENDA }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'Template Non-Blok Non-CSR');

      // Add Tips dan Info sheet
      const infoData = [
        ['TIPS DAN INFORMASI IMPORT JADWAL NON-BLOK NON-CSR'],
        [''],
        ['📋 CARA UPLOAD FILE:'],
        ['1. Download template ini dan isi dengan data jadwal non-blok non-CSR'],
        ['2. Pastikan semua kolom wajib diisi dengan benar'],
        ['3. Upload file Excel yang sudah diisi ke sistem'],
        ['4. Periksa preview data dan perbaiki error jika ada'],
        ['5. Klik "Import Data" untuk menyimpan jadwal'],
        [''],
        ['✏️ CARA EDIT DATA:'],
        ['1. Klik pada kolom yang ingin diedit di tabel preview'],
        ['2. Ketik atau paste data yang benar'],
        ['3. Sistem akan otomatis validasi dan update error'],
        ['4. Pastikan tidak ada error sebelum import'],
        [''],
        ['📊 KETERSEDIAAN DATA:'],
        [''],
        ['⏰ JAM YANG TERSEDIA:'],
        ...jamOptions.map(jam => [`• ${jam}`]),
        [''],
        ['👥 KELOMPOK BESAR YANG TERSEDIA:'],
        ...(kelompokBesarAgendaOptions.length > 0 ? 
          kelompokBesarAgendaOptions.map(kb => [`• ${kb.label}`]) :
          [['• Belum ada data kelompok besar']]
        ),
        [''],
        ['👨‍🏫 DOSEN YANG TERSEDIA:'],
        ...(dosenList.length > 0 ? 
          dosenList.map(dosen => [`• ${dosen.name} (${dosen.nid})`]) :
          [['• Belum ada data dosen']]
        ),
        [''],
        ['🏢 RUANGAN YANG TERSEDIA:'],
        ...(ruanganList.length > 0 ? 
          ruanganList.map(ruangan => [`• ${ruangan.nama} (Kapasitas: ${ruangan.kapasitas || 'N/A'})`]) :
          [['• Belum ada data ruangan']]
        ),
        [''],
        ['⚠️ VALIDASI SISTEM:'],
        [''],
        ['📅 VALIDASI TANGGAL:'],
        ['• Format: YYYY-MM-DD (contoh: 2024-01-15)'],
        ['• Wajib dalam rentang mata kuliah:'],
        [`  - Mulai: ${startDate.toLocaleDateString('id-ID')}`],
        [`  - Akhir: ${endDate.toLocaleDateString('id-ID')}`],
        [''],
        ['⏰ VALIDASI JAM:'],
        ['• Format: HH:MM atau HH.MM (contoh: 07:20 atau 07.20)'],
        ['• Jam mulai harus sesuai opsi yang tersedia'],
        ['• Jam selesai akan divalidasi berdasarkan perhitungan:'],
        ['  Jam selesai = Jam mulai + (Jumlah sesi x 50 menit)'],
        ['  Contoh: 07:20 + (2 x 50 menit) = 09:00'],
        [''],
        ['📝 VALIDASI JENIS BARIS:'],
        ['• Jenis baris: materi atau agenda'],
        ['• materi: Untuk jadwal materi kuliah (wajib isi Dosen, Materi, Ruangan)'],
        ['• agenda: Untuk agenda khusus (wajib isi Keterangan Agenda, Ruangan opsional)'],
        [''],
        ['🔢 VALIDASI SESI:'],
        [`• Jumlah sesi: ${MIN_SESSIONS}-${MAX_SESSIONS}`],
        ['• Digunakan untuk menghitung jam selesai'],
        ['• 1 sesi = 50 menit'],
        [''],
        ['👨‍🏫 VALIDASI DOSEN:'],
        ['• Dosen wajib diisi untuk jenis baris "materi"'],
        ['• Nama dosen harus ada di database'],
        ['• Pastikan dosen tersedia untuk jadwal tersebut'],
        [''],
        ['🏢 VALIDASI RUANGAN:'],
        ['• Ruangan wajib diisi untuk jenis baris "materi"'],
        ['• Ruangan opsional untuk jenis baris "agenda"'],
        ['• Nama ruangan harus ada di database'],
        ['• Kapasitas ruangan harus mencukupi jumlah mahasiswa'],
        [''],
        ['👥 VALIDASI KELOMPOK BESAR:'],
        ['• Kelompok besar wajib diisi'],
        ['• Nama kelompok besar harus ada di database'],
        ['• Harus sesuai dengan semester mata kuliah'],
        [''],
        ['💡 TIPS PENTING:'],
        ['• Gunakan data yang ada di list ketersediaan di atas'],
        ['• Periksa preview sebelum import'],
        ['• Edit langsung di tabel preview jika ada error'],
        ['• Sistem akan highlight error dengan warna merah'],
        ['• Tooltip akan menampilkan pesan error detail']
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Tips dan Info');

      // Download file
      XLSX.writeFile(wb, `Template_Non_Blok_Non_CSR_${data.kode}.xlsx`);
    } catch (error) {
      console.error('Error downloading Non-Blok Non-CSR template:', error);
      alert('Gagal mendownload template Non-Blok Non-CSR. Silakan coba lagi.');
    }
  };

  // Helper function untuk konversi format waktu
  const convertTimeFormat = (timeStr: string) => {
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
    
    // Cek apakah format HH:MM atau HH.MM (2 digit jam)
    if (time.match(/^\d{2}[:.]\d{2}$/)) {
      return time.replace('.', ':');
    }
    
    // Jika tidak sesuai format, return as is
    return time;
  };

  // Read Excel file untuk Non-Blok Non-CSR
  const readNonBlokExcelFile = (file: File): Promise<{ headers: string[], data: any[][] }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target?.result as ArrayBuffer);
          const workbook = XLSX.read(data, { type: 'array' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
          
          if (jsonData.length < 2) {
            reject(new Error('File Excel harus memiliki minimal 2 baris (header dan data)'));
            return;
          }
          
          const headers = jsonData[0] as string[];
          const dataRows = jsonData.slice(1) as any[][];
          
          resolve({ headers, data: dataRows });
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file Excel'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Validasi data Excel Non-Blok Non-CSR
  const validateNonBlokExcelData = (importData: JadwalNonBlokNonCSRType[]): { row: number, field: string, message: string }[] => {
    const errors: { row: number, field: string, message: string }[] = [];
    
    if (!importData) return errors;

    importData.forEach((row, index) => {
      const rowNum = index + 1;

      // Validasi tanggal
      if (!row.tanggal) {
        errors.push({ row: rowNum, field: 'tanggal', message: `Tanggal wajib diisi (Baris ${rowNum}, Kolom Tanggal)` });
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.tanggal)) {
        errors.push({ row: rowNum, field: 'tanggal', message: `Format tanggal tidak valid (Baris ${rowNum}, Kolom Tanggal)` });
      } else {
        // Validasi tanggal yang valid (misal: 2026-02-30 tidak valid)
        const dateObj = new Date(row.tanggal);
        if (isNaN(dateObj.getTime()) || row.tanggal !== dateObj.toISOString().split('T')[0]) {
          errors.push({ row: rowNum, field: 'tanggal', message: `Tanggal tidak valid (Baris ${rowNum}, Kolom Tanggal)` });
        } else if (data && data.tanggal_mulai && data.tanggal_akhir) {
        const startDate = new Date(data.tanggal_mulai || '');
        const endDate = new Date(data.tanggal_akhir || '');
          const inputDate = new Date(row.tanggal);
          
          if (inputDate < startDate || inputDate > endDate) {
            errors.push({ row: rowNum, field: 'tanggal', message: `Tanggal di luar rentang mata kuliah (Baris ${rowNum}, Kolom Tanggal)` });
          }
        }
      }

      // Validasi jam mulai
      if (!row.jam_mulai) {
        errors.push({ row: rowNum, field: 'jam_mulai', message: `Jam mulai wajib diisi (Baris ${rowNum}, Kolom Jam Mulai)` });
      } else if (!/^\d{1,2}[.:]\d{2}$/.test(row.jam_mulai)) {
        errors.push({ row: rowNum, field: 'jam_mulai', message: `Format jam tidak valid (Baris ${rowNum}, Kolom Jam Mulai)` });
      } else {
        const jamMulaiInput = row.jam_mulai.replace(':', '.');
        if (!jamOptions.includes(jamMulaiInput)) {
          errors.push({ row: rowNum, field: 'jam_mulai', message: `Jam mulai "${jamMulaiInput}" tidak valid. Jam yang tersedia: ${jamOptions.join(', ')} (Baris ${rowNum}, Kolom Jam Mulai)` });
        }
      }


      // Validasi jenis baris
      if (!row.jenis_baris) {
        errors.push({ row: rowNum, field: 'jenis_baris', message: `Jenis baris wajib diisi (Baris ${rowNum}, Kolom Jenis Baris)` });
      } else if (!['materi', 'agenda'].includes(row.jenis_baris)) {
        errors.push({ row: rowNum, field: 'jenis_baris', message: `Jenis baris harus "materi" atau "agenda" (Baris ${rowNum}, Kolom Jenis Baris)` });
      }

      // Validasi sesi
      if (!row.jumlah_sesi) {
        errors.push({ row: rowNum, field: 'jumlah_sesi', message: `Sesi wajib diisi (Baris ${rowNum}, Kolom Sesi)` });
      } else       if (row.jumlah_sesi < MIN_SESSIONS || row.jumlah_sesi > MAX_SESSIONS) {
        errors.push({ row: rowNum, field: 'jumlah_sesi', message: `Sesi harus ${MIN_SESSIONS}-${MAX_SESSIONS} (Baris ${rowNum}, Kolom Sesi)` });
      }

      // Validasi kelompok besar
      if (!row.kelompok_besar_id || row.kelompok_besar_id === null) {
        errors.push({ row: rowNum, field: 'kelompok_besar_id', message: `Kelompok besar wajib diisi (Baris ${rowNum}, Kolom Kelompok Besar)` });
      } else {
        const validKelompokBesarIds = kelompokBesarAgendaOptions.map(kb => Number(kb.id));
        if (!validKelompokBesarIds.includes(row.kelompok_besar_id)) {
          const availableIds = kelompokBesarAgendaOptions.map(kb => kb.id).join(', ');
          errors.push({ row: rowNum, field: 'kelompok_besar_id', message: `Kelompok besar ID ${row.kelompok_besar_id} tidak ditemukan. ID yang tersedia: ${availableIds} (Baris ${rowNum}, Kolom Kelompok Besar)` });
        } else if (data && data.semester) {
          const mataKuliahSemester = parseInt(data.semester.toString());
          if (typeof mataKuliahSemester === 'number' && mataKuliahSemester > 0 && row.kelompok_besar_id !== mataKuliahSemester) {
            errors.push({ row: rowNum, field: 'kelompok_besar_id', message: `Kelompok besar ID ${row.kelompok_besar_id} tidak sesuai dengan semester mata kuliah (${mataKuliahSemester}). Hanya boleh menggunakan kelompok besar semester ${mataKuliahSemester}. (Baris ${rowNum}, Kolom Kelompok Besar)` });
          }
        }
      }

      // Validasi khusus untuk jenis materi
      if (row.jenis_baris === 'materi') {
        // Validasi dosen
        if (!row.dosen_id || row.dosen_id === null) {
          errors.push({ row: rowNum, field: 'dosen_id', message: `Dosen wajib diisi untuk jenis materi (Baris ${rowNum}, Kolom Dosen)` });
        } else {
          const validDosenIds = dosenList.map(d => d.id);
          if (!validDosenIds.includes(row.dosen_id)) {
            errors.push({ row: rowNum, field: 'dosen_id', message: `Dosen tidak ditemukan (Baris ${rowNum}, Kolom Dosen)` });
          }
        }

        // Validasi materi
        if (!row.materi || row.materi.trim() === '') {
          errors.push({ row: rowNum, field: 'materi', message: `Materi wajib diisi untuk jenis materi (Baris ${rowNum}, Kolom Materi)` });
        }

        // Validasi ruangan
        if (!row.ruangan_id || row.ruangan_id === null) {
          errors.push({ row: rowNum, field: 'ruangan_id', message: `Ruangan wajib diisi untuk jenis materi (Baris ${rowNum}, Kolom Ruangan)` });
        } else {
          const validRuanganIds = ruanganList.map(r => r.id);
          if (!validRuanganIds.includes(row.ruangan_id)) {
            errors.push({ row: rowNum, field: 'ruangan_id', message: `Ruangan tidak ditemukan (Baris ${rowNum}, Kolom Ruangan)` });
          }
        }
      }

      // Validasi khusus untuk jenis agenda
      if (row.jenis_baris === 'agenda') {
        // Validasi keterangan agenda
        if (!row.agenda || row.agenda.trim() === '') {
          errors.push({ row: rowNum, field: 'agenda', message: `Keterangan agenda wajib diisi untuk jenis agenda (Baris ${rowNum}, Kolom Keterangan Agenda)` });
        }

        // Validasi ruangan (opsional untuk agenda)
        if (row.ruangan_id && row.ruangan_id !== null) {
          const validRuanganIds = ruanganList.map(r => r.id);
          if (!validRuanganIds.includes(row.ruangan_id)) {
            errors.push({ row: rowNum, field: 'ruangan_id', message: `Ruangan tidak ditemukan (Baris ${rowNum}, Kolom Ruangan)` });
          }
        }
      }
    });

    return errors;
  };

  // Handle import Excel untuk Non-Blok Non-CSR
  const handleNonBlokImportExcel = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;


    // Reset states
    setNonBlokImportErrors([]);
    setNonBlokCellErrors([]);
    setNonBlokImportData([]);

    try {
      // Validate file type
      if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
        setNonBlokImportErrors(['Format file Excel tidak dikenali. Harap gunakan file .xlsx atau .xls']);
        return;
      }

      // Read Excel file
      const { headers, data: excelData } = await readNonBlokExcelFile(file);
      
      
      // Validate headers
      const expectedHeaders = ['Tanggal', 'Jam Mulai', 'Jenis Baris', 'Sesi', 'Kelompok Besar', 'Dosen', 'Materi', 'Ruangan', 'Keterangan Agenda'];
      
      const headerMatch = expectedHeaders.every(header => headers.includes(header));
      
      if (!headerMatch) {
        const missingHeaders = expectedHeaders.filter(header => !headers.includes(header));
        setNonBlokImportErrors(['Format file Excel tidak sesuai dengan template aplikasi. Pastikan kolom sesuai dengan template yang didownload.']);
        return;
      }

      // Convert Excel data to our format
      const convertedData = excelData.map((row, index) => {
        const rowNum = index + 1;
        
        
        // Parse kelompok besar ID - Mapping langsung dari Excel (biar user edit manual jika tidak valid)
        let kelompokBesarId = null;
        if (row[4] && row[4] !== '') {
          const kelompokBesarValue = row[4].toString().trim();
          
          // Mapping langsung dari Excel - biar user edit manual jika tidak valid
          kelompokBesarId = parseInt(kelompokBesarValue) || null;
        }

        // Parse dosen ID
        let dosenId = null;
        if (row[5] && row[5] !== '') {
          const dosenOption = dosenList.find(d => d.name === row[5] || `${d.name} (${d.nid})` === row[5] || d.name.includes(row[5]) || d.nid === row[5]);
          dosenId = dosenOption ? dosenOption.id : null;
        }

        // Parse ruangan ID
        let ruanganId = null;
        if (row[7] && row[7] !== '') {
          const ruanganOption = ruanganList.find(r => r.nama === row[7] || r.nama.includes(row[7]) || r.id.toString() === row[7]);
          ruanganId = ruanganOption ? ruanganOption.id : null;
        }

        // Parse dan validasi tanggal
        let tanggal = '';
        if (row[0]) {
          if (typeof row[0] === 'number') {
            tanggal = XLSX.SSF.format('yyyy-mm-dd', row[0]);
          } else {
            tanggal = row[0].toString();
          }
          
          // Validasi tanggal
          const dateObj = new Date(tanggal);
          if (isNaN(dateObj.getTime()) || tanggal !== dateObj.toISOString().split('T')[0]) {
            tanggal = ''; // Set empty jika tanggal tidak valid
          }
        }

        const jamMulaiRaw = row[1] || '';
        const jamMulai = convertTimeFormat(jamMulaiRaw);
        const jumlahSesi = parseInt(row[3]) || 0;
        const jamSelesai = hitungJamSelesai(jamMulai, jumlahSesi);

        const convertedRow = {
          tanggal: tanggal,
          jam_mulai: jamMulai,
          jam_selesai: jamSelesai,
          jenis_baris: row[2] || '',
          jumlah_sesi: jumlahSesi,
          kelompok_besar_id: kelompokBesarId,
          nama_kelompok_besar: row[4] || '',
          dosen_id: dosenId,
          nama_dosen: row[5] || '',
          materi: row[6] || '',
          ruangan_id: ruanganId,
          nama_ruangan: row[7] || '',
          agenda: row[8] || '',
          use_ruangan: row[8] && row[8] !== '' ? true : false
        };
        
        return convertedRow;
      });


      // Validate data
      const validationErrors = validateNonBlokExcelData(convertedData);
      setNonBlokCellErrors(validationErrors);

      // Set data and open modal
      setNonBlokImportData(convertedData);
      setNonBlokImportFile(file);
      setShowNonBlokImportModal(true);
      

    } catch (error: any) {
      setNonBlokImportErrors([error.message || 'Terjadi kesalahan saat membaca file Excel']);
    }
  };

  // Submit import Excel untuk Non-Blok Non-CSR
  const handleNonBlokSubmitImport = async () => {
    if (!kode || nonBlokImportData.length === 0) return;

    setIsNonBlokImporting(true);
    setNonBlokImportErrors([]);

    try {
      // Final validation
      const validationErrors = validateNonBlokExcelData(nonBlokImportData);
      if (validationErrors.length > 0) {
        setNonBlokCellErrors(validationErrors);
        setIsNonBlokImporting(false);
        return;
      }

      // Transform data for API
      const apiData = nonBlokImportData.map(row => ({
        tanggal: row.tanggal,
        jam_mulai: row.jam_mulai,
        jam_selesai: row.jam_selesai,
        jenis_baris: row.jenis_baris,
        jumlah_sesi: row.jumlah_sesi,
        kelompok_besar_id: row.kelompok_besar_id,
        dosen_id: row.dosen_id,
        materi: row.materi,
        ruangan_id: row.ruangan_id,
        agenda: row.agenda,
        use_ruangan: row.use_ruangan
      }));

      // Send to API
      const response = await api.post(`/non-blok-non-csr/jadwal/${kode}/import`, {
        data: apiData
      });

      if (response.data.success) {
        setNonBlokImportedCount(nonBlokImportData.length);
        setShowNonBlokImportModal(false);
        // Cleanup data setelah import berhasil
        setNonBlokImportData([]);
        setNonBlokImportFile(null);
        setNonBlokImportErrors([]);
        setNonBlokCellErrors([]);
        setNonBlokEditingCell(null);
        await fetchBatchData(); // Refresh data
      } else {
        setNonBlokImportErrors([response.data.message || 'Terjadi kesalahan saat mengimport data']);
        // Tidak import data jika ada error - all or nothing
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        const errorData = error.response.data;
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const cellErrors = errorData.errors.map((err: string, idx: number) => ({
            row: idx + 1,
            field: 'api',
            message: err
          }));
          setNonBlokCellErrors(cellErrors);
        } else {
          setNonBlokImportErrors([errorData.message || 'Terjadi kesalahan validasi']);
        }
      } else {
        const errorMessage = error.response?.data?.message || 'Terjadi kesalahan saat mengimport data';
        setNonBlokImportErrors([errorMessage]);
      }
    } finally {
      setIsNonBlokImporting(false);
    }
  };

  // Close import modal untuk Non-Blok Non-CSR
  const handleNonBlokCloseImportModal = () => {
    setShowNonBlokImportModal(false);
    // Tidak menghapus data untuk file persistence
  };

  // Handler untuk hapus file Non-Blok Non-CSR
  const handleNonBlokRemoveFile = () => {
    setNonBlokImportFile(null);
    setNonBlokImportData([]);
    setNonBlokImportErrors([]);
    setNonBlokCellErrors([]);
    setNonBlokEditingCell(null);
    setNonBlokImportPage(1);
    if (nonBlokFileInputRef.current) {
      nonBlokFileInputRef.current.value = '';
    }
  };

  // Edit cell untuk Non-Blok Non-CSR
  const handleNonBlokEditCell = (rowIndex: number, field: string, value: any) => {
    const updatedData = [...nonBlokImportData];
    updatedData[rowIndex] = { ...updatedData[rowIndex], [field]: value };
    
    // Recalculate jam_selesai if jam_mulai or jumlah_sesi is edited
    if (field === 'jam_mulai' || field === 'jumlah_sesi') {
      const jamMulai = field === 'jam_mulai' ? value : updatedData[rowIndex].jam_mulai;
      const jumlahSesi = field === 'jumlah_sesi' ? value : updatedData[rowIndex].jumlah_sesi;
      updatedData[rowIndex].jam_selesai = hitungJamSelesai(jamMulai, jumlahSesi);
    }
    
    setNonBlokImportData(updatedData);
    
    // Re-validate
    const validationErrors = validateNonBlokExcelData(updatedData);
    setNonBlokCellErrors(validationErrors);
  };

  // Finish editing cell
  const handleNonBlokFinishEdit = () => {
    setNonBlokEditingCell(null);
  };

  // Update jam selesai saat jam mulai/jumlah kali berubah
  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    let newForm = { ...form, [name]: value };
    if (name === 'jamMulai' || name === 'jumlahKali') {
      const jumlah = name === 'jumlahKali' ? Number(value) : Number(newForm.jumlahKali);
      newForm.jamSelesai = hitungJamSelesai(name === 'jamMulai' ? value : newForm.jamMulai, jumlah);
    }
    // Validasi tanggal harus dalam rentang tanggal mulai & akhir
    if (name === 'hariTanggal' && data && value) {
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
    // Reset backend error when form changes
    if (name === 'hariTanggal' || name === 'jamMulai' || name === 'jumlahKali' || name === 'materi' || name === 'agenda' || name === 'pengampu' || name === 'lokasi') {
      setErrorBackend('');
    }
    setForm(newForm);
  }

  function handleEditJadwal(idx: number) {
    const row = jadwalMateri[idx];
    
    // Format tanggal untuk input date (YYYY-MM-DD)
    let formattedTanggal = '';
    if (row.tanggal) {
      try {
        const date = new Date(row.tanggal);
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
    
    setForm({
      hariTanggal: formattedTanggal,
      jamMulai: formatJamUntukDropdown(row.jam_mulai),
      jumlahKali: row.jumlah_sesi,
      jamSelesai: formatJamUntukDropdown(row.jam_selesai),
      pengampu: row.dosen_id || null,
      materi: row.materi || '',
      lokasi: row.use_ruangan ? (row.ruangan_id || null) : null,
      jenisBaris: row.jenis_baris,
      agenda: row.agenda || '',
      kelompokBesar: row.kelompok_besar_id || null,
      useRuangan: row.use_ruangan !== undefined ? row.use_ruangan : true,
    });
    setEditIndex(idx);
    setShowModal(true);
    setErrorForm('');
    setErrorBackend('');
  }

  async function handleDeleteJadwal(idx: number) {
    const jadwal = jadwalMateri[idx];
    try {
      await api.delete(`/non-blok-non-csr/jadwal/${kode}/${jadwal.id}`);
      
      // Refresh data dengan batch API
      await fetchBatchData();
      
      setShowDeleteModal(false);
      setSelectedDeleteIndex(null);
    } catch (error: any) {
      setErrorBackend(handleApiError(error, 'Menghapus jadwal'));
    }
  }

  async function handleTambahJadwal() {
    setErrorForm('');
    setErrorBackend('');
    if (!form.hariTanggal || (form.jenisBaris === 'materi' && (!form.jamMulai || !form.jumlahKali || !form.pengampu || !form.materi || !form.lokasi)) || (form.jenisBaris === 'agenda' && (!form.agenda || (form.useRuangan && !form.lokasi)))) {
      setErrorForm('Semua field wajib harus diisi!');
      return;
    }
    
    setIsSaving(true);
    try {
      const jadwalData = {
        tanggal: form.hariTanggal,
        jam_mulai: form.jamMulai,
        jam_selesai: form.jamSelesai,
        jumlah_sesi: form.jumlahKali,
        jenis_baris: form.jenisBaris,
        agenda: form.agenda,
        materi: form.materi,
        dosen_id: form.pengampu,
        ruangan_id: form.useRuangan ? form.lokasi : null,
        kelompok_besar_id: form.kelompokBesar,
        use_ruangan: form.useRuangan,
      };

    if (editIndex !== null) {
        const jadwal = jadwalMateri[editIndex];
        await api.put(`/non-blok-non-csr/jadwal/${kode}/${jadwal.id}`, jadwalData);
      } else {
        await api.post(`/non-blok-non-csr/jadwal/${kode}`, jadwalData);
      }
      
      // Refresh data dengan batch API
      await fetchBatchData();
      
      setShowModal(false);
      resetForm();
    } catch (error: any) {
      setErrorBackend(handleApiError(error, 'Menyimpan jadwal'));
    } finally {
      setIsSaving(false);
    }
  }

  // Fungsi untuk export Excel Non-Blok Non-CSR
  const exportNonBlokNonCSRExcel = async () => {
    try {
      if (jadwalMateri.length === 0) {
        alert('Tidak ada data Non-Blok Non-CSR untuk diekspor');
        return;
      }

      // Transform data untuk export
      const exportData = jadwalMateri.map((row, index) => {
        const dosen = dosenList.find(d => d.id === row.dosen_id);
        const ruangan = ruanganList.find(r => r.id === row.ruangan_id);

        return {
          'Tanggal': row.tanggal ? new Date(row.tanggal).toISOString().split('T')[0] : '',
          'Jam Mulai': row.jam_mulai,
          'Jenis Baris': row.jenis_baris,
          'Sesi': row.jumlah_sesi,
          'Kelompok Besar': row.kelompok_besar_id || '',
          'Dosen': dosen?.name || '',
          'Materi': row.materi || '',
          'Ruangan': ruangan?.nama || '',
          'Keterangan Agenda': row.agenda || ''
        };
      });

      // Buat workbook
      const wb = XLSX.utils.book_new();
      
      // Sheet 1: Data Non-Blok Non-CSR
      const ws = XLSX.utils.json_to_sheet(exportData, {
        header: ['Tanggal', 'Jam Mulai', 'Jenis Baris', 'Sesi', 'Kelompok Besar', 'Dosen', 'Materi', 'Ruangan', 'Keterangan Agenda']
      });
      
      // Set lebar kolom
      const colWidths = [
        { wch: 12 }, // Tanggal
        { wch: 10 }, // Jam Mulai
        { wch: 12 }, // Jenis Baris
        { wch: 6 },  // Sesi
        { wch: 15 }, // Kelompok Besar
        { wch: 25 }, // Dosen
        { wch: 30 }, // Materi
        { wch: 20 }, // Ruangan
        { wch: 20 }  // Keterangan Agenda
      ];
      ws['!cols'] = colWidths;
      
      XLSX.utils.book_append_sheet(wb, ws, 'Data Non-Blok Non-CSR');

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
        ['TOTAL JADWAL NON-BLOK NON-CSR', jadwalMateri.length],
        [''],
        ['CATATAN:'],
        ['• File ini berisi data jadwal Non-Blok Non-CSR yang dapat di-import kembali ke aplikasi'],
        ['• Format tanggal: YYYY-MM-DD'],
        ['• Format jam: HH.MM atau HH:MM'],
        ['• Sesi: 1-6 (1 sesi = 50 menit)'],
        ['• Jenis: Jadwal Materi atau Agenda Khusus'],
        ['• Ruangan dapat dikosongkan jika tidak menggunakan ruangan'],
        ['• Pastikan data dosen, ruangan, dan kelompok besar valid sebelum import']
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: 30 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Info Mata Kuliah');

      // Download file
      const fileName = `Export_Non_Blok_Non_CSR_${data?.kode || 'MataKuliah'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Gagal mengekspor data Non-Blok Non-CSR');
    }
  };

  // Initial load dengan loading state
  const initialLoad = async () => {
    if (!kode) return;
    
    setLoading(true);
    
    try {
      const response = await api.get(`/non-blok-non-csr/${kode}/batch-data`);
      const batchData = response.data;
      
      // Set mata kuliah data
      setData(batchData.mata_kuliah);
      
      // Set jadwal Non-Blok Non-CSR data
      setJadwalMateri(batchData.jadwal_non_blok_non_csr);
      
      // Set reference data
      setDosenList(batchData.dosen_list);
      setRuanganList(batchData.ruangan_list);
      setJamOptions(batchData.jam_options);
      setKelompokBesarAgendaOptions(batchData.kelompok_besar_agenda_options || []);
      setKelompokBesarMateriOptions(batchData.kelompok_besar_materi_options || []);
      
    } catch (error: any) {
      setError(handleApiError(error, 'Memuat data batch'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch batch data on component mount
  useEffect(() => {
    initialLoad();
  }, [kode]);

  // Effect untuk auto-hide success message Non Blok bulk delete
  useEffect(() => {
    if (nonBlokSuccess) {
      const timer = setTimeout(() => {
        setNonBlokSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [nonBlokSuccess]);

  // Fungsi untuk bulk delete Non Blok Non CSR
  const handleNonBlokBulkDelete = () => {
    if (selectedNonBlokItems.length === 0) return;
    setShowNonBlokBulkDeleteModal(true);
  };

  const confirmNonBlokBulkDelete = async () => {
    if (selectedNonBlokItems.length === 0) return;
    
    setIsNonBlokDeleting(true);
    try {
      // Delete all selected items
      await Promise.all(selectedNonBlokItems.map(id => api.delete(`/non-blok-non-csr/jadwal/${kode}/${id}`)));
      
      // Set success message
      setNonBlokSuccess(`${selectedNonBlokItems.length} jadwal Non-Blok Non-CSR berhasil dihapus.`);
      
      // Clear selections
      setSelectedNonBlokItems([]);
      
      // Close modal after successful delete
      setShowNonBlokBulkDeleteModal(false);
      
      // Refresh data
      await fetchBatchData();
    } catch (error: any) {
      setError(handleApiError(error, 'Menghapus jadwal Non-Blok Non-CSR'));
    } finally {
      setIsNonBlokDeleting(false);
    }
  };

  const handleNonBlokSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedNonBlokItems(jadwalMateri.map(jadwal => jadwal.id!));
    } else {
      setSelectedNonBlokItems([]);
    }
  };

  const handleNonBlokSelectItem = (id: number) => {
    if (selectedNonBlokItems.includes(id)) {
      setSelectedNonBlokItems(selectedNonBlokItems.filter(itemId => itemId !== id));
    } else {
      setSelectedNonBlokItems([...selectedNonBlokItems, id]);
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
      
      {/* Jadwal Non-Blok Non-CSR skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-start mb-2">
          <div className="flex items-center gap-3">
            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-8 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-8 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Hari/Tanggal</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pukul</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Waktu</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pengampu</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Materi</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Lokasi</th>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`skeleton-nonblok-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>
                    <td className="px-4 py-4">
                      <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
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
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Non CSR Semester {data.semester}</h1>
      <p className="text-gray-500 dark:text-gray-400 text-base mb-8">Informasi lengkap mata kuliah non blok Non-CSR</p>

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
            <div className="mb-2 text-gray-500 text-xs font-semibold suppercase">Periode</div>
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
              {data?.keahlian_required && data.keahlian_required.length > 0 
                ? data.keahlian_required.join(', ') 
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

      {/* TOMBOL TAMBAH JADWAL MATERI */}
      <div className="flex gap-2 items-center mb-4">
        <button 
          onClick={() => setShowNonBlokImportModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform cursor-pointer">
          <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-brand-700 dark:text-brand-200" />
          Import Excel
        </button>
        <button
          onClick={downloadNonBlokTemplate}
          className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"
        >
          <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
          Download Template Excel
        </button>
        <button
          onClick={exportNonBlokNonCSRExcel}
          disabled={jadwalMateri.length === 0}
          className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs transition flex items-center gap-2 ${
            jadwalMateri.length === 0 
              ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed' 
              : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800'
          }`}
          title={jadwalMateri.length === 0 ? 'Tidak ada data Non-Blok Non-CSR. Silakan tambahkan data jadwal terlebih dahulu untuk melakukan export.' : 'Export data Non-Blok Non-CSR ke Excel'}
        >
          <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
          Export ke Excel
        </button>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
            setErrorForm('');
            setErrorBackend('');
          }}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition-all duration-300"
        >
          Tambah Jadwal
        </button>
      </div>


      {/* Success Message */}
      <AnimatePresence>
        {nonBlokImportedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            onAnimationComplete={() => {
              setTimeout(() => {
                setNonBlokImportedCount(0);
              }, 5000);
            }}
          >
            {nonBlokImportedCount} jadwal Non-Blok Non-CSR berhasil diimpor ke database.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Message Non Blok Bulk Delete */}
      <AnimatePresence>
        {nonBlokSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
          >
            {nonBlokSuccess}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tabel Jadwal Materi */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] mt-8">
        <div className="max-w-full overflow-x-auto hide-scroll">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
            <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  <button
                    type="button"
                    aria-checked={jadwalMateri.length > 0 && jadwalMateri.every(item => selectedNonBlokItems.includes(item.id!))}
                    role="checkbox"
                    onClick={() => handleNonBlokSelectAll(!(jadwalMateri.length > 0 && jadwalMateri.every(item => selectedNonBlokItems.includes(item.id!))))}
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${jadwalMateri.length > 0 && jadwalMateri.every(item => selectedNonBlokItems.includes(item.id!)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                  >
                    {jadwalMateri.length > 0 && jadwalMateri.every(item => selectedNonBlokItems.includes(item.id!)) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <polyline points="20 7 11 17 4 10" />
                      </svg>
                    )}
                  </button>
                </th>
                <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Hari/Tanggal</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pukul</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Waktu</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pengampu</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Materi</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Lokasi</th>
                <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {jadwalMateri.length === 0 ? (
                <tr>
                  <td colSpan={10} className="text-center py-6 text-gray-400">Tidak ada data jadwal</td>
                </tr>
              ) : (
                getPaginatedData(
                  jadwalMateri
                    .slice()
                    .sort((a, b) => {
                      const dateA = new Date(a.tanggal);
                      const dateB = new Date(b.tanggal);
                      return dateA.getTime() - dateB.getTime();
                    }),
                  nonCsrPage,
                  nonCsrPageSize
                ).map((row, idx) => (
                    <tr key={row.id} className={row.jenis_baris === 'agenda' ? 'bg-yellow-50 dark:bg-yellow-900/20' : (idx % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : '')}>
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          aria-checked={selectedNonBlokItems.includes(row.id!)}
                          role="checkbox"
                          onClick={() => handleNonBlokSelectItem(row.id!)}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedNonBlokItems.includes(row.id!) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                        >
                          {selectedNonBlokItems.includes(row.id!) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <polyline points="20 7 11 17 4 10" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{(nonCsrPage - 1) * nonCsrPageSize + idx + 1}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatTanggalKonsisten(row.tanggal)}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatJamTanpaDetik(row.jam_mulai)}–{formatJamTanpaDetik(row.jam_selesai)}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi} x 50 menit</td>
                      {row.jenis_baris === 'agenda' ? (
                        <>
                          <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">-</td>
                          <td className="px-6 py-4 text-center uppercase bg-yellow-100 dark:bg-yellow-900/40 text-gray-900 dark:text-white whitespace-nowrap">
                            {row.agenda}
                          </td>
                          <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                            {row.kelompok_besar_id ? `Kelompok Besar Semester ${row.kelompok_besar_id}` : '-'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.dosen?.name || ''}</td>
                          <td className={`px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90`}>{row.materi}</td>
                          <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                            {row.kelompok_besar_id ? `Kelompok Besar Semester ${row.kelompok_besar_id}` : '-'}
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {row.jenis_baris === 'agenda' && !row.use_ruangan ? '-' : (row.ruangan?.nama || '')}
                      </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {/* Tombol Absensi - hanya untuk jenis_baris === 'materi' dan status_konfirmasi === 'bisa' */}
                        {row.jenis_baris === 'materi' && row.status_konfirmasi === 'bisa' && (
                          <button 
                            onClick={() => navigate(`/absensi-non-blok-non-csr/${kode}/${row.id}`)} 
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-500 hover:text-green-700 dark:hover:text-green-300 transition mr-1" 
                            title="Buka Absensi"
                          >
                            <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                            <span className="hidden sm:inline">Absensi</span>
                          </button>
                        )}
                        <button onClick={() => handleEditJadwal(idx)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition mr-1" title="Edit Jadwal">
                          <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button onClick={() => { setSelectedDeleteIndex(idx); setShowDeleteModal(true); }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" title="Hapus Jadwal">
                          <FontAwesomeIcon icon={faTrash} className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                          <span className="hidden sm:inline">Hapus</span>
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

        {/* Tombol Hapus Terpilih untuk Non Blok Non CSR */}
        {selectedNonBlokItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              disabled={isNonBlokDeleting}
              onClick={handleNonBlokBulkDelete}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${isNonBlokDeleting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-theme-xs hover:bg-red-600'}`}
            >
              {isNonBlokDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedNonBlokItems.length})`}
            </button>
          </div>
        )}

        {/* Pagination for Non-CSR */}
        {true && (
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan {((nonCsrPage - 1) * nonCsrPageSize) + 1} - {Math.min(nonCsrPage * nonCsrPageSize, jadwalMateri.length)} dari {jadwalMateri.length} data
              </span>
              
              <select
                value={nonCsrPageSize}
                onChange={(e) => {
                  setNonCsrPageSize(Number(e.target.value));
                  setNonCsrPage(1);
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
                onClick={() => setNonCsrPage((p) => Math.max(1, p - 1))}
                disabled={nonCsrPage === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Previous
              </button>

              {/* Always show first page if it's not the current page */}
              {getTotalPages(jadwalMateri.length, nonCsrPageSize) > 1 && (
                <button
                  onClick={() => setNonCsrPage(1)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    nonCsrPage === 1
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  1
                </button>
              )}

              {/* Show pages around current page */}
              {Array.from({ length: getTotalPages(jadwalMateri.length, nonCsrPageSize) }, (_, i) => {
                const pageNum = i + 1;
                // Show pages around current page (2 pages before and after)
                const shouldShow =
                  pageNum > 1 &&
                  pageNum < getTotalPages(jadwalMateri.length, nonCsrPageSize) &&
                  pageNum >= nonCsrPage - 2 &&
                  pageNum <= nonCsrPage + 2;

                if (!shouldShow) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setNonCsrPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                      nonCsrPage === pageNum
                        ? "bg-brand-500 text-white"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Show ellipsis if current page is far from end */}
              {nonCsrPage < getTotalPages(jadwalMateri.length, nonCsrPageSize) - 3 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">
                  ...
                </span>
              )}

              {/* Always show last page if it's not the first page */}
              {getTotalPages(jadwalMateri.length, nonCsrPageSize) > 1 && (
                <button
                  onClick={() => setNonCsrPage(getTotalPages(jadwalMateri.length, nonCsrPageSize))}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    nonCsrPage === getTotalPages(jadwalMateri.length, nonCsrPageSize)
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {getTotalPages(jadwalMateri.length, nonCsrPageSize)}
                </button>
              )}

              <button
                onClick={() => setNonCsrPage((p) => Math.min(getTotalPages(jadwalMateri.length, nonCsrPageSize), p + 1))}
                disabled={nonCsrPage === getTotalPages(jadwalMateri.length, nonCsrPageSize)}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}

      {/* MODAL INPUT JADWAL MATERI */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-9999999 flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-sm"
              onClick={() => setShowModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-50 max-h-[90vh] overflow-y-auto hide-scroll"
              
            >

              <button
                onClick={() => setShowModal(false)}
                className="absolute right-2 top-2 z-20 flex items-center justify-center rounded-full bg-white shadow-lg text-gray-400 hover:bg-gray-100 hover:text-gray-700 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white h-9 w-9 border border-gray-200 dark:border-gray-700 transition"
                aria-label="Tutup"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="w-6 h-6">
                  <path fillRule="evenodd" clipRule="evenodd" d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z" fill="currentColor" />
                </svg>
              </button>
              {/* Jenis Baris */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jenis Baris</label>
                <select name="jenisBaris" value={form.jenisBaris} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                  <option value="materi">Jadwal Materi</option>
                  <option value="agenda">Agenda Khusus</option>
                </select>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hari/Tanggal</label>
                  <input type="date" name="hariTanggal" value={form.hariTanggal} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  {errorForm && <div className="text-sm text-red-500 mt-2">{errorForm}</div>}
                </div>
               {form.jenisBaris === 'agenda' && (
                 <>
                   <div>
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Keterangan Agenda</label>
                     <input type="text" name="agenda" value={form.agenda} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" placeholder="Contoh: UTS AIK 1, UAS, Libur, dll" />
                   </div>
                   <div>
                     <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelompok Besar</label>
                     {kelompokBesarAgendaOptions.length === 0 ? (
                       <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                         <div className="flex items-center gap-2">
                           <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                             <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                           </svg>
                           <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                             Belum ada kelompok besar yang ditambahkan untuk mata kuliah ini
                           </span>
                         </div>
                         <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                           Silakan tambahkan kelompok besar terlebih dahulu di halaman Kelompok Detail
                         </p>
                       </div>
                     ) : (
                       <Select
                         options={kelompokBesarAgendaOptions.map(k => ({ value: Number(k.id), label: k.label }))}
                         value={kelompokBesarAgendaOptions.map(k => ({ value: Number(k.id), label: k.label })).find(opt => opt.value === form.kelompokBesar) || null}
                         onChange={opt => setForm(f => ({ ...f, kelompokBesar: opt ? Number(opt.value) : null }))}
                         placeholder="Pilih Kelompok Besar"
                         isClearable
                         isSearchable={false}
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
                     <label className="flex items-center gap-2 cursor-pointer select-none text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                       <span className="relative flex items-center">
                         <input
                           type="checkbox"
                           checked={form.useRuangan}
                           onChange={(e) => setForm(f => ({ ...f, useRuangan: e.target.checked }))}
                           className={`
                             w-5 h-5
                             appearance-none
                             rounded-md
                             border-2
                             ${form.useRuangan
                               ? "border-brand-500 bg-brand-500"
                               : "border-brand-500 bg-transparent"
                             }
                             transition-colors
                             duration-150
                             focus:ring-2 focus:ring-brand-300
                             dark:focus:ring-brand-600
                             relative
                           `}
                           style={{ outline: "none" }}
                         />
                         {form.useRuangan && (
                           <svg
                             className="absolute left-0 top-0 w-5 h-5 pointer-events-none"
                             viewBox="0 0 20 20"
                             fill="none"
                             stroke="white"
                             strokeWidth="2.5"
                           >
                             <polyline points="5 11 9 15 15 7" />
                           </svg>
                         )}
                       </span>
                       <span className="select-none transition-colors duration-200 hover:text-brand-600 dark:hover:text-brand-400">
                         Gunakan Ruangan
                       </span>
                     </label>
                   </div>
                 </>
               )}
                <div className="flex gap-2">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Mulai</label>
                    <Select
                      options={jamOptions.map((j: string) => ({ value: j, label: j }))}
                      value={jamOptions.map((j: string) => ({ value: j, label: j })).find((opt: any) => opt.value === form.jamMulai) || null}
                      onChange={(opt: any) => {
                        const value = opt?.value || '';
                        setForm(f => ({
                          ...f,
                          jamMulai: value,
                          jamSelesai: hitungJamSelesai(value, f.jumlahKali)
                        }));
                      }}
                      classNamePrefix="react-select"
                      className="react-select-container"
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          backgroundColor: state.isDisabled
                            ? (document.documentElement.classList.contains('dark') ? '#1e293b' : '#f3f4f6')
                            : (document.documentElement.classList.contains('dark') ? '#1e293b' : '#f9fafb'),
                          borderColor: state.isFocused
                            ? '#3b82f6'
                            : (document.documentElement.classList.contains('dark') ? '#334155' : '#d1d5db'),
                          boxShadow: state.isFocused ? '0 0 0 2px #3b82f633' : undefined,
                          borderRadius: '0.5rem',
                          minHeight: '2.5rem',
                          fontSize: '0.875rem',
                          color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                          paddingLeft: '0.75rem',
                          paddingRight: '0.75rem',
                          '&:hover': { borderColor: '#3b82f6' },
                        }),
                        menu: base => ({
                          ...base,
                          zIndex: 9999,
                          fontSize: '0.875rem',
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
                          fontSize: '0.875rem',
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
                    <select name="jumlahKali" value={form.jumlahKali} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                      {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} x 50'</option>)}
                    </select>
                  </div>
                </div>
                <div className="mt-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Selesai</label>
                  <input type="text" name="jamSelesai" value={form.jamSelesai} readOnly className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed" />
                </div>
                {form.jenisBaris === 'materi' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pengampu</label>
                  {dosenList.length === 0 ? (
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
                  ) : (
                    <Select
                      options={(dosenList || []).map((d: any) => ({ value: d.id, label: `${d.name} (${d.nid})` }))}
                      value={(dosenList || []).map((d: any) => ({ value: d.id, label: `${d.name} (${d.nid})` })).find((opt: any) => opt.value === form.pengampu) || null}
                      onChange={(opt: any) => {
                        setForm({ ...form, pengampu: opt?.value || null });
                        setErrorForm(''); // Reset error when selection changes
                      }}
                      placeholder="Pilih Dosen"
                      isClearable
                      classNamePrefix="react-select"
                      className="react-select-container"
                      styles={{
                        control: (base, state) => ({
                          ...base,
                          backgroundColor: state.isDisabled
                            ? (document.documentElement.classList.contains('dark') ? '#1e293b' : '#f3f4f6')
                            : (document.documentElement.classList.contains('dark') ? '#1e293b' : '#f9fafb'),
                          borderColor: state.isFocused
                            ? '#3b82f6'
                            : (document.documentElement.classList.contains('dark') ? '#334155' : '#d1d5db'),
                          boxShadow: state.isFocused ? '0 0 0 2px #3b82f633' : undefined,
                          borderRadius: '0.5rem',
                          minHeight: '2.5rem',
                          fontSize: '0.875rem',
                          color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                          paddingLeft: '0.75rem',
                          paddingRight: '0.75rem',
                          '&:hover': { borderColor: '#3b82f6' },
                        }),
                        menu: base => ({
                          ...base,
                          zIndex: 9999,
                          fontSize: '0.875rem',
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
                          fontSize: '0.875rem',
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
                )}
                {form.jenisBaris === 'materi' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Materi</label>
                    <input type="text" name="materi" value={form.materi} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                )}
                {form.jenisBaris === 'materi' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelompok Besar</label>
                    {kelompokBesarMateriOptions.length === 0 ? (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                            Belum ada kelompok besar yang ditambahkan untuk mata kuliah ini
                          </span>
                        </div>
                        <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                          Silakan tambahkan kelompok besar terlebih dahulu di halaman Kelompok Detail
                        </p>
                      </div>
                    ) : (
                      <Select
                        options={kelompokBesarMateriOptions.map(k => ({ value: Number(k.id), label: k.label }))}
                        value={kelompokBesarMateriOptions.map(k => ({ value: Number(k.id), label: k.label })).find(opt => opt.value === form.kelompokBesar) || null}
                        onChange={opt => setForm(f => ({ ...f, kelompokBesar: opt ? Number(opt.value) : null }))}
                        placeholder="Pilih Kelompok Besar"
                        isClearable
                        isSearchable={false}
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
                            borderRadius: '0.5rem',
                            minHeight: '2.5rem',
                            fontSize: '0.875rem',
                            paddingLeft: '0.75rem',
                            paddingRight: '0.75rem',
                            '&:hover': { borderColor: '#3b82f6' },
                          }),
                          menu: base => ({
                            ...base,
                            zIndex: 9999,
                            fontSize: '0.875rem',
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
                            fontSize: '0.875rem',
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
                )}
                {(form.jenisBaris === 'materi' || (form.jenisBaris === 'agenda' && form.useRuangan)) && (
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
                        options={getRuanganOptions(ruanganList || [])}
                        value={getRuanganOptions(ruanganList || []).find((opt: any) => opt.value === form.lokasi) || null}
                        onChange={(opt: any) => {
                          setForm({ ...form, lokasi: opt?.value || null });
                          setErrorForm(''); // Reset error when selection changes
                        }}
                        placeholder="Pilih Ruangan"
                        isClearable
                        classNamePrefix="react-select"
                        className="react-select-container"
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            backgroundColor: state.isDisabled
                              ? (document.documentElement.classList.contains('dark') ? '#1e293b' : '#f3f4f6')
                              : (document.documentElement.classList.contains('dark') ? '#1e293b' : '#f9fafb'),
                            borderColor: state.isFocused
                              ? '#3b82f6'
                              : (document.documentElement.classList.contains('dark') ? '#334155' : '#d1d5db'),
                            boxShadow: state.isFocused ? '0 0 0 2px #3b82f633' : undefined,
                            borderRadius: '0.5rem',
                            minHeight: '2.5rem',
                            fontSize: '0.875rem',
                            color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
                            paddingLeft: '0.75rem',
                            paddingRight: '0.75rem',
                            '&:hover': { borderColor: '#3b82f6' },
                          }),
                          menu: base => ({
                            ...base,
                            zIndex: 9999,
                            fontSize: '0.875rem',
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
                            fontSize: '0.875rem',
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
                )}
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
              </div>
              <div className="flex justify-end gap-2 pt-6">
                <button onClick={() => {
                  setShowModal(false);
                  resetForm();
                }} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition">Batal</button>
                <button onClick={handleTambahJadwal} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed" disabled={!form.hariTanggal || (form.jenisBaris === 'materi' && (!form.jamMulai || !form.jumlahKali || !form.pengampu || !form.materi || !form.lokasi)) || (form.jenisBaris === 'agenda' && (!form.agenda || (form.useRuangan && !form.lokasi))) || !!errorForm || isSaving}>{editIndex !== null ? 'Simpan' : 'Tambah Jadwal'}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL KONFIRMASI HAPUS */}
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

       {/* MODAL IMPORT EXCEL NON-BLOK NON-CSR */}
       <AnimatePresence>
         {showNonBlokImportModal && (
           <div className="fixed inset-0 z-[100000] flex items-center justify-center">
             {/* Overlay */}
             <motion.div 
               initial={{ opacity: 0 }}
               animate={{ opacity: 1 }}
               exit={{ opacity: 0 }}
               className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
               onClick={handleNonBlokCloseImportModal}
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
                 onClick={handleNonBlokCloseImportModal}
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
                 <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Import Jadwal Non-Blok Non-CSR</h2>
                 <p className="text-sm text-gray-500 dark:text-gray-400">Preview dan validasi data sebelum import</p>
               </div>

              {/* Upload File Section */}
              {!nonBlokImportFile && (
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
                          ref={nonBlokFileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleNonBlokImportExcel}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* File Info */}
              {nonBlokImportFile && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-800 dark:text-blue-200">{nonBlokImportFile.name}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-300">
                        {(nonBlokImportFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={handleNonBlokRemoveFile}
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
              {(nonBlokImportErrors.length > 0 || nonBlokCellErrors.length > 0) && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                        Error Validasi ({nonBlokImportErrors.length + nonBlokCellErrors.length} error)
                      </h3>
                      <div className="max-h-40 overflow-y-auto">
                        {/* Error dari API response */}
                        {nonBlokImportErrors.map((err, idx) => (
                          <p key={idx} className="text-sm text-red-600 dark:text-red-400 mb-1">• {err}</p>
                        ))}
                        {/* Error cell/detail */}
                        {nonBlokCellErrors.map((err, idx) => (
                          <p key={idx} className="text-sm text-red-600 dark:text-red-400 mb-1">
                            • {err.message} (Baris {err.row}, Kolom {err.field.toUpperCase()})
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {nonBlokImportData.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      Preview Data ({nonBlokImportData.length} jadwal)
                    </h3>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      File: {nonBlokImportFile?.name}
                    </div>
                  </div>
                  
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <div className="max-w-full overflow-x-auto hide-scroll">
                      <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                        <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Tanggal</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Jam Mulai</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Jenis Baris</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Sesi</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok Besar</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Dosen</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Materi</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Keterangan Agenda</th>
                          </tr>
                        </thead>
                        <tbody>
                        {nonBlokImportData
                          .slice((nonBlokImportPage - 1) * nonBlokImportPageSize, nonBlokImportPage * nonBlokImportPageSize)
                          .map((row, index) => {
                            const actualIndex = (nonBlokImportPage - 1) * nonBlokImportPageSize + index;
                            
                            const renderEditableCell = (field: string, value: any, isNumeric = false) => {
                              const isEditing = nonBlokEditingCell?.row === actualIndex && nonBlokEditingCell?.key === field;
                              const cellError = nonBlokCellErrors.find(err => err.row === actualIndex + 1 && err.field === field);
                              
                              return (
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                  onClick={() => setNonBlokEditingCell({ row: actualIndex, key: field })}
                                  title={cellError ? cellError.message : ''}
                                >
                                  {isEditing ? (
                                    <input
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                      type={isNumeric ? "number" : "text"}
                                      value={value || ""}
                                      onChange={e => handleNonBlokEditCell(actualIndex, field, isNumeric ? parseInt(e.target.value) : e.target.value)}
                                      onBlur={handleNonBlokFinishEdit}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          handleNonBlokFinishEdit();
                                        }
                                        if (e.key === 'Escape') {
                                          handleNonBlokFinishEdit();
                                        }
                                      }}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>{value || '-'}</span>
                                  )}
                                </td>
                              );
                            };
                            
                            return (
                              <tr 
                                key={actualIndex} 
                                className={`${index % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}`}
                              >
                                <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{actualIndex + 1}</td>
                                {renderEditableCell('tanggal', row.tanggal)}
                                {renderEditableCell('jam_mulai', row.jam_mulai)}
                                {renderEditableCell('jenis_baris', row.jenis_baris)}
                                {renderEditableCell('jumlah_sesi', row.jumlah_sesi, true)}
                                {(() => {
                                  const field = 'kelompok_besar_id';
                                  const isEditing = nonBlokEditingCell?.row === actualIndex && nonBlokEditingCell?.key === field;
                                  const cellError = nonBlokCellErrors.find(err => err.row === actualIndex + 1 && err.field === field);
                                  const kelompokBesar = kelompokBesarAgendaOptions.find(kb => Number(kb.id) === row.kelompok_besar_id);
                                  
                                  return (
                                    <td
                                      className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                      onClick={() => setNonBlokEditingCell({ row: actualIndex, key: field })}
                                      title={cellError ? cellError.message : ''}
                                    >
                                      {isEditing ? (
                                        <input
                                          className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                          type="number"
                                          value={row.kelompok_besar_id || ""}
                                          onChange={e => handleNonBlokEditCell(actualIndex, field, parseInt(e.target.value))}
                                          onBlur={handleNonBlokFinishEdit}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                              handleNonBlokFinishEdit();
                                            }
                                            if (e.key === 'Escape') {
                                              handleNonBlokFinishEdit();
                                            }
                                          }}
                                          autoFocus
                                        />
                                      ) : (
                                        <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                          {kelompokBesar ? kelompokBesar.label : (row.kelompok_besar_id && row.kelompok_besar_id !== 0 ? row.kelompok_besar_id : 'Tidak ditemukan')}
                                        </span>
                                      )}
                                    </td>
                                  );
                                })()}
                                {renderEditableCell('nama_dosen', row.nama_dosen || '')}
                                {renderEditableCell('materi', row.materi || '')}
                                {renderEditableCell('nama_ruangan', row.nama_ruangan || '')}
                                {renderEditableCell('agenda', row.agenda || '')}
                              </tr>
                            );
                          })}
                      </tbody>
                  </table>
                </div>
              </div>
              
              {/* Pagination untuk Import Preview */}
              {nonBlokImportData.length > nonBlokImportPageSize && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <select
                      value={nonBlokImportPageSize}
                      onChange={e => { setNonBlokImportPageSize(Number(e.target.value)); setNonBlokImportPage(1); }}
                      className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      <option value={5}>5 per halaman</option>
                      <option value={10}>10 per halaman</option>
                      <option value={20}>20 per halaman</option>
                      <option value={50}>50 per halaman</option>
                    </select>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Menampilkan {((nonBlokImportPage - 1) * nonBlokImportPageSize) + 1}-{Math.min(nonBlokImportPage * nonBlokImportPageSize, nonBlokImportData.length)} dari {nonBlokImportData.length} jadwal
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setNonBlokImportPage(p => Math.max(1, p - 1))}
                      disabled={nonBlokImportPage === 1}
                      className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Halaman {nonBlokImportPage} dari {Math.ceil(nonBlokImportData.length / nonBlokImportPageSize)}
                    </span>
                    <button
                      onClick={() => setNonBlokImportPage(p => Math.min(Math.ceil(nonBlokImportData.length / nonBlokImportPageSize), p + 1))}
                      disabled={nonBlokImportPage >= Math.ceil(nonBlokImportData.length / nonBlokImportPageSize)}
                      className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-6">
                <button
                  onClick={handleNonBlokCloseImportModal}
                  className="px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Batal
                </button>
                {nonBlokImportData.length > 0 && nonBlokCellErrors.length === 0 && (
                  <button
                    onClick={handleNonBlokSubmitImport}
                    disabled={isNonBlokImporting}
                    className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isNonBlokImporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Importing...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                        Import Data ({nonBlokImportData.length} jadwal)
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Konfirmasi Bulk Delete Non Blok Non CSR */}
      <AnimatePresence>
        {showNonBlokBulkDeleteModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowNonBlokBulkDeleteModal(false)}
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
                    {selectedNonBlokItems.length}
                  </span> jadwal Non-Blok Non-CSR terpilih? Data yang dihapus tidak dapat dikembalikan.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowNonBlokBulkDeleteModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmNonBlokBulkDelete}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center"
                    disabled={isNonBlokDeleting}
                  >
                    {isNonBlokDeleting ? (
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
    </div>
  );
} 
