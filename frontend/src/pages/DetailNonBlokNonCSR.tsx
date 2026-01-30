import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useRef, useMemo, useCallback } from 'react';
import api, { handleApiError } from '../utils/api';
import { ChevronLeftIcon } from '../icons';
import { AnimatePresence, motion } from 'framer-motion';
import Select from 'react-select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrash, faFileExcel, faDownload, faUpload, faExclamationTriangle, faCheckCircle, faEye } from '@fortawesome/free-solid-svg-icons';
import { getRuanganOptions } from '../utils/ruanganHelper';
import * as XLSX from 'xlsx';

// Constants
const SESSION_DURATION_MINUTES = 50;
const MAX_SESSIONS = 6;
const MIN_SESSIONS = 1;
const DEFAULT_PAGE_SIZE = 10;
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const EXCEL_COLUMN_WIDTHS = {
  TANGGAL: 12,
  JAM_MULAI: 10,
  JUMLAH_SESI: 6,
  KELOMPOK_BESAR: 15,
  DOSEN: 20,
  MATERI: 25,
  RUANGAN: 15,
  AGENDA: 20,
  MAHASISWA: 40,
  INFO_COLUMN: 50,
  INFO_COLUMN_LEFT: 30
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
  jenis_baris: 'materi' | 'agenda' | 'seminar_proposal' | 'sidang_skripsi';
  agenda?: string;
  materi?: string;
  dosen_id?: number;
  pembimbing_id?: number;
  komentator_ids?: number[];
  penguji_ids?: number[];
  mahasiswa_nims?: string[];
  ruangan_id: number | null;
  kelompok_besar_id?: number | null;
  use_ruangan?: boolean;
  status_konfirmasi?: string;
  dosen?: {
    id: number;
    name: string;
    nid: string;
  };
  pembimbing?: {
    id: number;
    name: string;
    nid: string;
  };
  komentator?: Array<{
    id: number;
    name: string;
    nid: string;
  }>;
  penguji?: Array<{
    id: number;
    name: string;
    nid: string;
  }>;
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
  jenis_baris: 'materi' | 'agenda' | 'seminar_proposal' | 'sidang_skripsi';
  jumlah_sesi: number;
  kelompok_besar_id?: number | null;
  nama_kelompok_besar?: string;
  dosen_id?: number | null;
  nama_dosen?: string;
  pembimbing_id?: number | null;
  nama_pembimbing?: string;
  komentator_ids?: number[];
  nama_komentator?: string | string[];
  penguji_ids?: number[];
  nama_penguji?: string | string[];
  mahasiswa_nims?: string[];
  nama_mahasiswa?: string | string[];
  materi?: string;
  ruangan_id: number | null;
  nama_ruangan?: string;
  agenda?: string;
  use_ruangan?: boolean;
}

interface MahasiswaOption {
  id: number;
  nim: string;
  name: string;
  label: string;
}

export default function DetailNonBlokNonCSR() {
  const { kode } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<MataKuliah | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State untuk modal input jadwal
  const [showModal, setShowModal] = useState(false);
  const [jadwalMateriKuliah, setJadwalMateriKuliah] = useState<JadwalNonBlokNonCSR[]>([]);
  const [jadwalAgendaKhusus, setJadwalAgendaKhusus] = useState<JadwalNonBlokNonCSR[]>([]);
  const [jadwalSeminarProposal, setJadwalSeminarProposal] = useState<JadwalNonBlokNonCSR[]>([]);
  const [jadwalSidangSkripsi, setJadwalSidangSkripsi] = useState<JadwalNonBlokNonCSR[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    hariTanggal: '',
    jamMulai: '',
    jumlahKali: 2,
    jamSelesai: '',
    pengampu: null as number | null,
    materi: '',
    lokasi: null as number | null,
    jenisBaris: 'materi' as 'materi' | 'agenda' | 'seminar_proposal' | 'sidang_skripsi',
    agenda: '', // hanya untuk agenda khusus
    kelompokBesar: null as number | null,
    pembimbing: null as number | null, // untuk seminar proposal dan sidang skripsi
    komentator: [] as number[], // hanya untuk seminar proposal, maksimal 2
    penguji: [] as number[], // hanya untuk sidang skripsi, maksimal 2
    mahasiswa: [] as string[], // untuk seminar proposal dan sidang skripsi, array NIM
    useRuangan: true,
  });
  const [errorForm, setErrorForm] = useState(''); // Error frontend (validasi form)
  const [errorBackend, setErrorBackend] = useState(''); // Error backend (response API)
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteIndex, setSelectedDeleteIndex] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Helper function untuk format tanggal ke YYYY-MM-DD
  const formatDateToISO = (date: string | Date | null | undefined): string => {
    if (!date) return '';
    return new Date(date).toISOString().split('T')[0];
  };

  // Pagination logic functions - optimized with useCallback
  const getPaginatedData = useCallback(<T,>(data: T[], page: number, pageSize: number): T[] => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  }, []);

  const getTotalPages = useCallback((dataLength: number, pageSize: number): number => {
    return Math.ceil(dataLength / pageSize);
  }, []);

  // State untuk dropdown options
  const [dosenList, setDosenList] = useState<DosenOption[]>([]);
  const [ruanganList, setRuanganList] = useState<RuanganOption[]>([]);
  const [jamOptions, setJamOptions] = useState<string[]>([]);
  const [kelompokBesarAgendaOptions, setKelompokBesarAgendaOptions] = useState<{ id: string | number, label: string, jumlah_mahasiswa: number }[]>([]);
  const [kelompokBesarMateriOptions, setKelompokBesarMateriOptions] = useState<{ id: string | number, label: string, jumlah_mahasiswa: number }[]>([]);
  const [mahasiswaList, setMahasiswaList] = useState<MahasiswaOption[]>([]);

  // Pagination state for Materi Kuliah
  const [materiPage, setMateriPage] = useState(1);
  const [materiPageSize, setMateriPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  // Pagination state for Agenda Khusus
  const [agendaPage, setAgendaPage] = useState(1);
  const [agendaPageSize, setAgendaPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  // State untuk import Excel Materi Kuliah
  const [showMateriUploadModal, setShowMateriUploadModal] = useState(false); // Modal upload file
  const [showMateriImportModal, setShowMateriImportModal] = useState(false); // Modal preview
  const [materiImportFile, setMateriImportFile] = useState<File | null>(null); // Persistence: file tetap ada
  const [materiImportData, setMateriImportData] = useState<JadwalNonBlokNonCSRType[]>([]); // Persistence: data tetap ada
  const [materiImportErrors, setMateriImportErrors] = useState<string[]>([]);
  const [materiCellErrors, setMateriCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [materiEditingCell, setMateriEditingCell] = useState<{ row: number, key: string } | null>(null);
  const [materiImportPage, setMateriImportPage] = useState(1);
  const [materiImportPageSize, setMateriImportPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [materiImportedCount, setMateriImportedCount] = useState(0);
  const materiFileInputRef = useRef<HTMLInputElement>(null);
  const [isMateriImporting, setIsMateriImporting] = useState(false);

  // State untuk import Excel Agenda Khusus
  const [showAgendaUploadModal, setShowAgendaUploadModal] = useState(false); // Modal upload file
  const [showAgendaImportModal, setShowAgendaImportModal] = useState(false); // Modal preview
  const [agendaImportFile, setAgendaImportFile] = useState<File | null>(null); // Persistence: file tetap ada
  const [agendaImportData, setAgendaImportData] = useState<JadwalNonBlokNonCSRType[]>([]); // Persistence: data tetap ada
  const [agendaImportErrors, setAgendaImportErrors] = useState<string[]>([]);
  const [agendaCellErrors, setAgendaCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [agendaEditingCell, setAgendaEditingCell] = useState<{ row: number, key: string } | null>(null);
  const [agendaImportPage, setAgendaImportPage] = useState(1);
  const [agendaImportPageSize, setAgendaImportPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [agendaImportedCount, setAgendaImportedCount] = useState(0);
  const agendaFileInputRef = useRef<HTMLInputElement>(null);
  const [isAgendaImporting, setIsAgendaImporting] = useState(false);


  // State untuk bulk delete Materi Kuliah
  const [selectedMateriItems, setSelectedMateriItems] = useState<number[]>([]);
  const [isMateriDeleting, setIsMateriDeleting] = useState(false);
  const [materiSuccess, setMateriSuccess] = useState<string | null>(null);
  const [showMateriBulkDeleteModal, setShowMateriBulkDeleteModal] = useState(false);

  // State untuk bulk delete Agenda Khusus
  const [selectedAgendaItems, setSelectedAgendaItems] = useState<number[]>([]);
  const [isAgendaDeleting, setIsAgendaDeleting] = useState(false);
  const [agendaSuccess, setAgendaSuccess] = useState<string | null>(null);
  const [showAgendaBulkDeleteModal, setShowAgendaBulkDeleteModal] = useState(false);

  // Pagination state for Seminar Proposal
  const [seminarPage, setSeminarPage] = useState(1);
  const [seminarPageSize, setSeminarPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  // State untuk import Excel Seminar Proposal
  const [showSeminarUploadModal, setShowSeminarUploadModal] = useState(false);
  const [seminarImportFile, setSeminarImportFile] = useState<File | null>(null);
  const [seminarImportData, setSeminarImportData] = useState<JadwalNonBlokNonCSRType[]>([]);
  const [seminarImportErrors, setSeminarImportErrors] = useState<string[]>([]);
  const [seminarCellErrors, setSeminarCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [seminarEditingCell, setSeminarEditingCell] = useState<{ row: number, key: string } | null>(null);
  const [seminarImportPage, setSeminarImportPage] = useState(1);
  const [seminarImportPageSize, setSeminarImportPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [seminarImportedCount, setSeminarImportedCount] = useState(0);
  const seminarFileInputRef = useRef<HTMLInputElement>(null);
  const seminarImportDataRef = useRef<JadwalNonBlokNonCSRType[]>([]);
  const [isSeminarImporting, setIsSeminarImporting] = useState(false);

  // State untuk bulk delete Seminar Proposal
  const [selectedSeminarItems, setSelectedSeminarItems] = useState<number[]>([]);
  const [isSeminarDeleting, setIsSeminarDeleting] = useState(false);
  const [seminarSuccess, setSeminarSuccess] = useState<string | null>(null);
  const [showSeminarBulkDeleteModal, setShowSeminarBulkDeleteModal] = useState(false);

  // Pagination state for Sidang Skripsi
  const [sidangPage, setSidangPage] = useState(1);
  const [sidangPageSize, setSidangPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  // State untuk import Excel Sidang Skripsi
  const [showSidangUploadModal, setShowSidangUploadModal] = useState(false);
  const [sidangImportFile, setSidangImportFile] = useState<File | null>(null);
  const [sidangImportData, setSidangImportData] = useState<JadwalNonBlokNonCSRType[]>([]);
  const [sidangImportErrors, setSidangImportErrors] = useState<string[]>([]);
  const [sidangCellErrors, setSidangCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [sidangEditingCell, setSidangEditingCell] = useState<{ row: number, key: string } | null>(null);
  const [sidangImportPage, setSidangImportPage] = useState(1);
  const [sidangImportPageSize, setSidangImportPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [sidangImportedCount, setSidangImportedCount] = useState(0);
  const sidangFileInputRef = useRef<HTMLInputElement>(null);
  const sidangImportDataRef = useRef<JadwalNonBlokNonCSRType[]>([]);
  const [isSidangImporting, setIsSidangImporting] = useState(false);

  // State untuk bulk delete Sidang Skripsi
  const [selectedSidangItems, setSelectedSidangItems] = useState<number[]>([]);
  const [isSidangDeleting, setIsSidangDeleting] = useState(false);
  const [sidangSuccess, setSidangSuccess] = useState<string | null>(null);
  const [showSidangBulkDeleteModal, setShowSidangBulkDeleteModal] = useState(false);

  // State untuk modal daftar mahasiswa
  const [showMahasiswaModal, setShowMahasiswaModal] = useState(false);
  const [selectedMahasiswaList, setSelectedMahasiswaList] = useState<MahasiswaOption[]>([]);
  const [mahasiswaSearchQuery, setMahasiswaSearchQuery] = useState('');
  const [mahasiswaModalPage, setMahasiswaModalPage] = useState(1);
  const [mahasiswaModalPageSize, setMahasiswaModalPageSize] = useState(10);

  // Memoized ruangan options untuk optimisasi performa
  const ruanganOptions = useMemo(() => getRuanganOptions(ruanganList || []), [ruanganList]);

  // Reset form function - optimized with useCallback
  const resetForm = useCallback(() => {
    setForm({
      hariTanggal: '',
      jamMulai: '',
      jumlahKali: 2,
      jamSelesai: '',
      pengampu: null,
      materi: '',
      lokasi: null,
      jenisBaris: 'materi' as 'materi' | 'agenda' | 'seminar_proposal' | 'sidang_skripsi',
      agenda: '',
      kelompokBesar: null,
      pembimbing: null,
      komentator: [],
      penguji: [],
      mahasiswa: [],
      useRuangan: true,
    });
    setEditIndex(null);
    setErrorForm('');
    setErrorBackend('');
  }, []);



  // Helper functions - optimized with useCallback
  const formatTanggalKonsisten = useCallback((dateStr: string) => {
    if (!dateStr) return '';

    const date = new Date(dateStr);
    const hari = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const hariIndo = hari[date.getDay()];

    // Format tanggal DD/MM/YYYY
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();

    return `${hariIndo}, ${day}/${month}/${year}`;
  }, []);

  const formatJamTanpaDetik = useCallback((jam: string) => {
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
  }, []);

  // Hitung jam selesai otomatis - optimized with useCallback
  const hitungJamSelesai = useCallback((jamMulai: string, jumlahKali: number) => {
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
  }, []);

  // Download template Excel untuk Non-Blok Non-CSR
  // Helper function untuk membuat Sheet Tips dan Info
  const createTipsAndInfoSheet = (jenis: 'materi' | 'agenda'): any[][] => {
    if (!data) return [];

    const startDate = new Date(data.tanggal_mulai || '');
    const endDate = new Date(data.tanggal_akhir || '');
    const isMateri = jenis === 'materi';

    return [
      [`TIPS DAN INFORMASI IMPORT JADWAL ${isMateri ? 'MATERI KULIAH' : 'AGENDA KHUSUS'}`],
      [''],
      ['CARA UPLOAD FILE:'],
      [`1. Download template ini dan isi dengan data jadwal ${isMateri ? 'Materi Kuliah' : 'Agenda Khusus'}`],
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
      [`KELOMPOK BESAR YANG TERSEDIA (Semester ${data.semester}):`],
      ...(isMateri ?
        (kelompokBesarMateriOptions.length > 0 ?
          kelompokBesarMateriOptions.map(kb => [`• ${kb.label} (${kb.jumlah_mahasiswa} mahasiswa)`]) :
          [['• Belum ada data kelompok besar']]
        ) :
        (kelompokBesarAgendaOptions.length > 0 ?
          kelompokBesarAgendaOptions.map(kb => [`• ${kb.label} (${kb.jumlah_mahasiswa} mahasiswa)`]) :
          [['• Belum ada data kelompok besar']]
        )
      ),
      ...(isMateri ? [
        [''],
        ['DOSEN YANG TERSEDIA:'],
        ...(dosenList.length > 0 ?
          dosenList.map(dosen => [`• ${dosen.name}`]) :
          [['• Belum ada data dosen']]
        )
      ] : []),
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
      [`  - Mulai: ${startDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`],
      [`  - Akhir: ${endDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`],
      [''],
      ['VALIDASI JAM:'],
      ['• Format: HH:MM atau HH.MM (contoh: 07:20 atau 07.20)'],
      ['• Jam mulai harus sesuai opsi yang tersedia'],
      ['• Jam selesai akan dihitung otomatis:'],
      ['  Jam selesai = Jam mulai + (Sesi × 50 menit)'],
      ['  Contoh: 07:20 + (2 × 50 menit) = 09:00'],
      [''],
      ['VALIDASI SESI:'],
      [`• Sesi: ${MIN_SESSIONS}-${MAX_SESSIONS} (1 sesi = 50 menit)`],
      ['• Digunakan untuk menghitung jam selesai otomatis'],
      [''],
      ...(isMateri ? [
        ['VALIDASI MATERI KULIAH:'],
        ['• Untuk Materi Kuliah (wajib isi: Dosen, Materi, Ruangan)'],
        ['• Dosen, Materi, dan Ruangan tidak boleh kosong']
      ] : [
        ['VALIDASI AGENDA KHUSUS:'],
        ['• Untuk Agenda Khusus (wajib isi: Agenda)'],
        ['• Ruangan opsional (boleh dikosongkan untuk agenda online)']
      ]),
      [''],
      ['VALIDASI KELOMPOK BESAR:'],
      [`• Kelompok besar wajib diisi (harus semester ${data.semester})`],
      ['• ID kelompok besar harus sesuai dengan semester mata kuliah'],
      ['• Sistem akan validasi otomatis'],
      [''],
      ['TIPS PENTING:'],
      ['• Gunakan data yang ada di list ketersediaan di atas'],
      ['• Periksa preview sebelum import'],
      ['• Edit langsung di tabel preview jika ada error'],
      ['• Sistem akan highlight error dengan warna merah'],
      ['• Tooltip akan menampilkan pesan error detail'],
      ...(isMateri ? [
        ['• Pastikan kapasitas ruangan mencukupi (jumlah mahasiswa + 1 dosen)'],
        ['• Sistem akan cek konflik jadwal (dosen, ruangan, kelompok besar)']
      ] : [
        ['• Ruangan boleh dikosongkan jika agenda tidak memerlukan ruangan']
      ])
    ];
  };

  // Helper function untuk membuat Sheet Tips dan Info untuk Seminar & Sidang
  const createSeminarTipsAndInfoSheet = (jenis: 'seminar-proposal' | 'sidang-skripsi'): any[][] => {
    if (!data) return [];

    const startDate = new Date(data.tanggal_mulai || '');
    const endDate = new Date(data.tanggal_akhir || '');
    const isSeminar = jenis === 'seminar-proposal';
    const roleType = isSeminar ? 'Komentator' : 'Penguji';

    return [
      [`TIPS DAN INFORMASI IMPORT JADWAL ${isSeminar ? 'SEMINAR PROPOSAL' : 'SIDANG SKRIPSI'}`],
      [''],
      ['CARA UPLOAD FILE:'],
      [`1. Download template ini dan isi dengan data jadwal ${isSeminar ? 'Seminar Proposal' : 'Sidang Skripsi'}`],
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
      ['DOSEN YANG TERSEDIA:'],
      ...(dosenList.length > 0 ?
        dosenList.map(dosen => [`• ${dosen.name}${dosen.nid ? ` (${dosen.nid})` : ''}`]) :
        [['• Belum ada data dosen']]
      ),
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
      [`  - Mulai: ${startDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`],
      [`  - Akhir: ${endDate.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`],
      [''],
      ['VALIDASI JAM:'],
      ['• Format: HH:MM atau HH.MM (contoh: 07:20 atau 07.20)'],
      ['• Jam mulai harus sesuai opsi yang tersedia'],
      ['• Jam selesai akan dihitung otomatis:'],
      ['  Jam selesai = Jam mulai + (Sesi × 50 menit)'],
      ['  Contoh: 07:20 + (2 × 50 menit) = 09:00'],
      [''],
      ['VALIDASI SESI:'],
      ['• Sesi: 1-6 (1 sesi = 50 menit)'],
      ['• Digunakan untuk menghitung jam selesai otomatis'],
      [''],
      ['VALIDASI PEMBIMBING:'],
      ['• Pembimbing wajib diisi (1 dosen)'],
      ['• Nama dosen harus sesuai dengan data di sistem'],
      [''],
      [`VALIDASI ${roleType.toUpperCase()}:`],
      [`• ${roleType} minimal 1 dosen (bisa multiple dengan backslash separator)`],
      [`• Untuk multiple ${roleType.toLowerCase()}, pisahkan dengan backslash \\ (contoh: Dr. John Doe\\Dr. Jane Smith)`],
      ['• Catatan: Gunakan backslash (bukan koma) karena beberapa dosen memiliki gelar dengan koma'],
      [`• Dosen yang sama TIDAK BOLEH dipilih sebagai Pembimbing dan ${roleType}`],
      [''],
      ['VALIDASI MAHASISWA:'],
      ['• Mahasiswa minimal 1, tidak ada batasan maksimal'],
      ['• Masukkan nama mahasiswa, dipisah koma jika lebih dari 1'],
      ['  Contoh: Nama Mahasiswa 1, Nama Mahasiswa 2'],
      [''],
      ['VALIDASI RUANGAN:'],
      ['• Ruangan opsional (boleh dikosongkan)'],
      ['• Jika diisi, nama ruangan harus sesuai dengan data di sistem'],
      ['• Sistem akan cek konflik jadwal ruangan'],
      [`• Kapasitas ruangan harus mencukupi (Pembimbing + ${roleType} + Mahasiswa)`],
      [''],
      ['TIPS PENTING:'],
      ['• Gunakan data yang ada di list ketersediaan di atas'],
      ['• Periksa preview sebelum import'],
      ['• Edit langsung di tabel preview jika ada error'],
      ['• Sistem akan highlight error dengan warna merah'],
      ['• Tooltip akan menampilkan pesan error detail'],
      [`• Pastikan tidak ada dosen yang sama di Pembimbing dan ${roleType}`],
      ['• Sistem akan cek konflik jadwal (mahasiswa, dosen, ruangan)']
    ];
  };

  // Fungsi download template Excel untuk Materi Kuliah
  const downloadMateriTemplate = async () => {
    if (!data) return;

    try {
      const startDate = new Date(data.tanggal_mulai || '');
      const endDate = new Date(data.tanggal_akhir || '');
      const exampleDate1 = new Date(startDate.getTime() + (1 * 24 * 60 * 60 * 1000));
      const exampleDate2 = new Date(startDate.getTime() + (2 * 24 * 60 * 60 * 1000));

      // Template data untuk Materi Kuliah (hanya kolom yang relevan)
      const templateData = [
        ['Tanggal', 'Jam Mulai', 'Sesi', 'Kelompok Besar', 'Dosen', 'Materi', 'Ruangan'],
        [
          formatDateToISO(exampleDate1),
          '07.20',
          '2',
          data.semester?.toString() || '1',
          dosenList[0]?.name || 'Dosen 1',
          'Pengantar Mata Kuliah',
          ruanganList[0]?.nama || 'Ruang 1'
        ],
        [
          formatDateToISO(exampleDate2),
          '08.20',
          '3',
          data.semester?.toString() || '1',
          dosenList[0]?.name || 'Dosen 1',
          'Materi Lanjutan',
          ruanganList[0]?.nama || 'Ruang 1'
        ]
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(templateData);
      ws['!cols'] = [
        { wch: EXCEL_COLUMN_WIDTHS.TANGGAL },
        { wch: EXCEL_COLUMN_WIDTHS.JAM_MULAI },
        { wch: EXCEL_COLUMN_WIDTHS.JUMLAH_SESI },
        { wch: EXCEL_COLUMN_WIDTHS.KELOMPOK_BESAR },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: EXCEL_COLUMN_WIDTHS.MATERI },
        { wch: EXCEL_COLUMN_WIDTHS.RUANGAN }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Template Materi Kuliah');

      // Sheet 2: Tips dan Info
      const infoData = createTipsAndInfoSheet('materi');
      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN_LEFT }, { wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Tips dan Info');

      XLSX.writeFile(wb, `Template_Import_MateriKuliah_${data.kode}_${formatDateToISO(new Date())}.xlsx`);
    } catch (error) {
      alert('Gagal mendownload template Materi Kuliah. Silakan coba lagi.');
    }
  };

  // Fungsi download template Excel untuk Agenda Khusus
  const downloadAgendaTemplate = async () => {
    if (!data) return;

    try {
      const startDate = new Date(data.tanggal_mulai || '');
      const endDate = new Date(data.tanggal_akhir || '');
      const exampleDate1 = new Date(startDate.getTime() + (1 * 24 * 60 * 60 * 1000));
      const exampleDate2 = new Date(startDate.getTime() + (2 * 24 * 60 * 60 * 1000));

      // Template data untuk Agenda Khusus (hanya kolom yang relevan)
      const templateData = [
        ['Tanggal', 'Jam Mulai', 'Sesi', 'Kelompok Besar', 'Ruangan', 'Agenda'],
        [
          formatDateToISO(exampleDate1),
          '08.20',
          '2',
          data.semester?.toString() || '1',
          ruanganList[0]?.nama || 'Ruang 1',
          'Ujian Tengah Semester'
        ],
        [
          formatDateToISO(exampleDate2),
          '10.40',
          '2',
          data.semester?.toString() || '1',
          '',
          'Seminar Kesehatan Online'
        ]
      ];

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.aoa_to_sheet(templateData);
      ws['!cols'] = [
        { wch: EXCEL_COLUMN_WIDTHS.TANGGAL },
        { wch: EXCEL_COLUMN_WIDTHS.JAM_MULAI },
        { wch: EXCEL_COLUMN_WIDTHS.JUMLAH_SESI },
        { wch: EXCEL_COLUMN_WIDTHS.KELOMPOK_BESAR },
        { wch: EXCEL_COLUMN_WIDTHS.RUANGAN },
        { wch: EXCEL_COLUMN_WIDTHS.AGENDA }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Template Agenda Khusus');

      // Sheet 2: Tips dan Info
      const infoData = createTipsAndInfoSheet('agenda');
      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN_LEFT }, { wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Tips dan Info');

      XLSX.writeFile(wb, `Template_Import_AgendaKhusus_${data.kode}_${formatDateToISO(new Date())}.xlsx`);
    } catch (error) {
      alert('Gagal mendownload template Agenda Khusus. Silakan coba lagi.');
    }
  };

  // Fungsi download template Excel untuk Seminar Proposal
  const downloadSeminarTemplate = async () => {
    if (!data) return;

    try {
      const wb = XLSX.utils.book_new();

      // Data sheet dengan data real yang tersedia
      const startDate = data?.tanggal_mulai ? new Date(data.tanggal_mulai) : new Date();
      const endDate = data?.tanggal_akhir ? new Date(data.tanggal_akhir) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      // Generate contoh tanggal dalam rentang mata kuliah
      const generateContohTanggal = () => {
        const selisihHari = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const hari1 = Math.floor(selisihHari * 0.25);
        const hari2 = Math.floor(selisihHari * 0.75);
        
        const tanggal1 = new Date(startDate.getTime() + hari1 * 24 * 60 * 60 * 1000);
        const tanggal2 = new Date(startDate.getTime() + hari2 * 24 * 60 * 60 * 1000);
        
        return [
          tanggal1.toISOString().split("T")[0],
          tanggal2.toISOString().split("T")[0]
        ];
      };
      
      const [contohTanggal1, contohTanggal2] = generateContohTanggal();
      
      // Ambil contoh data real yang tersedia
      const contohPembimbing = dosenList[0]?.name || "Nama Dosen Pembimbing";
      const contohKomentator1 = dosenList[1]?.name || dosenList[0]?.name || "Nama Dosen Komentator 1";
      const contohKomentator2 = dosenList[2]?.name || dosenList[1]?.name || dosenList[0]?.name || "Nama Dosen Komentator 2";
      const contohRuangan = ruanganList[0]?.nama || "Nama Ruangan";
      
      // Data template dengan 2 contoh baris menggunakan data real
      const seminarData = [
        {
          'Tanggal': contohTanggal1,
          'Jam Mulai': '08.00',
          'Sesi': 2,
          'Pembimbing': contohPembimbing,
          'Komentator': `${contohKomentator1}\\${contohKomentator2}`,
          'Mahasiswa (Nama, dipisah koma)': 'Nama Mahasiswa 1, Nama Mahasiswa 2',
          'Ruangan': contohRuangan
        },
        {
          'Tanggal': contohTanggal2,
          'Jam Mulai': '10.00',
          'Sesi': 3,
          'Pembimbing': contohPembimbing,
          'Komentator': contohKomentator1,
          'Mahasiswa (Nama, dipisah koma)': 'Nama Mahasiswa 3, Nama Mahasiswa 4',
          'Ruangan': contohRuangan
        }
      ];
      const ws = XLSX.utils.json_to_sheet(seminarData, {
        header: ['Tanggal', 'Jam Mulai', 'Sesi', 'Pembimbing', 'Komentator', 'Mahasiswa (Nama, dipisah koma)', 'Ruangan']
      });
      ws['!cols'] = [
        { wch: EXCEL_COLUMN_WIDTHS.TANGGAL },
        { wch: EXCEL_COLUMN_WIDTHS.JAM_MULAI },
        { wch: EXCEL_COLUMN_WIDTHS.JUMLAH_SESI },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: EXCEL_COLUMN_WIDTHS.MAHASISWA },
        { wch: EXCEL_COLUMN_WIDTHS.RUANGAN }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Data Seminar Proposal');

      // Sheet 2: Tips dan Info menggunakan helper function
      const tipsData = createSeminarTipsAndInfoSheet('seminar-proposal');
      const tipsWs = XLSX.utils.aoa_to_sheet(tipsData);
      tipsWs['!cols'] = [{ wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN_LEFT }, { wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN }];
      XLSX.utils.book_append_sheet(wb, tipsWs, 'Tips dan Info');

      // Template tidak perlu sheet Info Mata Kuliah, hanya untuk export
      XLSX.writeFile(wb, `Template_Import_SeminarProposal_${data.kode}_${formatDateToISO(new Date())}.xlsx`);
    } catch (error) {
      alert('Gagal mendownload template Seminar Proposal. Silakan coba lagi.');
    }
  };

  // Fungsi download template Excel untuk Sidang Skripsi
  const downloadSidangTemplate = async () => {
    if (!data) return;

    try {
      const wb = XLSX.utils.book_new();

      // Data sheet dengan data real yang tersedia
      const startDate = data?.tanggal_mulai ? new Date(data.tanggal_mulai) : new Date();
      const endDate = data?.tanggal_akhir ? new Date(data.tanggal_akhir) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      // Generate contoh tanggal dalam rentang mata kuliah
      const generateContohTanggal = () => {
        const selisihHari = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const hari1 = Math.floor(selisihHari * 0.25);
        const hari2 = Math.floor(selisihHari * 0.75);
        
        const tanggal1 = new Date(startDate.getTime() + hari1 * 24 * 60 * 60 * 1000);
        const tanggal2 = new Date(startDate.getTime() + hari2 * 24 * 60 * 60 * 1000);
        
        return [
          tanggal1.toISOString().split("T")[0],
          tanggal2.toISOString().split("T")[0]
        ];
      };
      
      const [contohTanggal1, contohTanggal2] = generateContohTanggal();
      
      // Ambil contoh data real yang tersedia
      const contohPembimbing = dosenList[0]?.name || "Nama Dosen Pembimbing";
      const contohPenguji1 = dosenList[1]?.name || dosenList[0]?.name || "Nama Dosen Penguji 1";
      const contohPenguji2 = dosenList[2]?.name || dosenList[1]?.name || dosenList[0]?.name || "Nama Dosen Penguji 2";
      const contohRuangan = ruanganList[0]?.nama || "Nama Ruangan";
      
      // Data template dengan 2 contoh baris menggunakan data real
      const sidangData = [
        {
          'Tanggal': contohTanggal1,
          'Jam Mulai': '08.00',
          'Sesi': 2,
          'Pembimbing': contohPembimbing,
          'Penguji': `${contohPenguji1}\\${contohPenguji2}`,
          'Mahasiswa (Nama, dipisah koma)': 'Nama Mahasiswa 1, Nama Mahasiswa 2',
          'Ruangan': contohRuangan
        },
        {
          'Tanggal': contohTanggal2,
          'Jam Mulai': '10.00',
          'Sesi': 3,
          'Pembimbing': contohPembimbing,
          'Penguji': contohPenguji1,
          'Mahasiswa (Nama, dipisah koma)': 'Nama Mahasiswa 3, Nama Mahasiswa 4',
          'Ruangan': contohRuangan
        }
      ];
      const ws = XLSX.utils.json_to_sheet(sidangData, {
        header: ['Tanggal', 'Jam Mulai', 'Sesi', 'Pembimbing', 'Penguji', 'Mahasiswa (Nama, dipisah koma)', 'Ruangan']
      });
      ws['!cols'] = [
        { wch: EXCEL_COLUMN_WIDTHS.TANGGAL },
        { wch: EXCEL_COLUMN_WIDTHS.JAM_MULAI },
        { wch: EXCEL_COLUMN_WIDTHS.JUMLAH_SESI },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: EXCEL_COLUMN_WIDTHS.MAHASISWA },
        { wch: EXCEL_COLUMN_WIDTHS.RUANGAN }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Data Sidang Skripsi');

      // Sheet 2: Tips dan Info menggunakan helper function
      const tipsData = createSeminarTipsAndInfoSheet('sidang-skripsi');
      const tipsWs = XLSX.utils.aoa_to_sheet(tipsData);
      tipsWs['!cols'] = [{ wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN_LEFT }, { wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN }];
      XLSX.utils.book_append_sheet(wb, tipsWs, 'Tips dan Info');

      // Template tidak perlu sheet Info Mata Kuliah, hanya untuk export
      XLSX.writeFile(wb, `Template_Import_SidangSkripsi_${data.kode}_${formatDateToISO(new Date())}.xlsx`);
    } catch (error) {
      alert('Gagal mendownload template Sidang Skripsi. Silakan coba lagi.');
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
        errors.push({ row: rowNum, field: 'tanggal', message: `Baris ${rowNum}: Tanggal wajib diisi` });
      } else if (!/^\d{4}-\d{2}-\d{2}$/.test(row.tanggal)) {
        errors.push({ row: rowNum, field: 'tanggal', message: `Baris ${rowNum}: Format tanggal harus YYYY-MM-DD` });
      } else {
        // Validasi tanggal yang valid (misal: 2026-02-30 tidak valid)
        const dateObj = new Date(row.tanggal);
        if (isNaN(dateObj.getTime()) || row.tanggal !== dateObj.toISOString().split('T')[0]) {
          errors.push({ row: rowNum, field: 'tanggal', message: `Baris ${rowNum}: Tanggal tidak valid` });
        } else {
          // Validasi rentang tanggal mata kuliah (WAJIB)
          if (!data || !data.tanggal_mulai || !data.tanggal_akhir) {
            errors.push({ row: rowNum, field: 'tanggal', message: `Baris ${rowNum}: Data mata kuliah tidak lengkap. Tidak dapat memvalidasi rentang tanggal` });
          } else {
            const startDate = new Date(data.tanggal_mulai);
            const endDate = new Date(data.tanggal_akhir);
            const inputDate = new Date(row.tanggal);

            // Set waktu ke 00:00:00 untuk perbandingan yang akurat
            startDate.setHours(0, 0, 0, 0);
            endDate.setHours(23, 59, 59, 999);
            inputDate.setHours(0, 0, 0, 0);

            if (inputDate < startDate || inputDate > endDate) {
              const startDateFormatted = startDate.toLocaleDateString('id-ID');
              const endDateFormatted = endDate.toLocaleDateString('id-ID');
              errors.push({
                row: rowNum,
                field: 'tanggal',
                message: `Baris ${rowNum}: Tanggal di luar rentang mata kuliah (${startDateFormatted} - ${endDateFormatted})`
              });
            }
          }
        }
      }

      // Validasi jam mulai
      if (!row.jam_mulai) {
        errors.push({ row: rowNum, field: 'jam_mulai', message: `Baris ${rowNum}: Jam Mulai wajib diisi` });
      } else if (!/^\d{1,2}[.:]\d{2}$/.test(row.jam_mulai)) {
        errors.push({ row: rowNum, field: 'jam_mulai', message: `Baris ${rowNum}: Format Jam Mulai harus HH:MM atau HH.MM` });
      } else {
        const jamMulaiInput = row.jam_mulai.replace(':', '.');
        if (!jamOptions.includes(jamMulaiInput)) {
          errors.push({ row: rowNum, field: 'jam_mulai', message: `Baris ${rowNum}: Jam Mulai "${row.jam_mulai}" tidak valid. Jam yang tersedia: ${jamOptions.join(', ')}` });
        }
      }


      // Validasi jenis baris sudah tidak diperlukan karena jadwal sudah dipisah (materi, agenda, seminar_proposal masing-masing punya tombol import sendiri)

      // Validasi jumlah sesi
      if (!row.jumlah_sesi) {
        errors.push({ row: rowNum, field: 'jumlah_sesi', message: `Baris ${rowNum}: Sesi wajib diisi` });
      } else if (row.jumlah_sesi < MIN_SESSIONS || row.jumlah_sesi > MAX_SESSIONS) {
        errors.push({ row: rowNum, field: 'jumlah_sesi', message: `Baris ${rowNum}: Sesi harus antara ${MIN_SESSIONS}-${MAX_SESSIONS}` });
      }

      // Validasi kelompok besar (hanya untuk materi dan agenda, bukan seminar_proposal atau sidang_skripsi)
      if (row.jenis_baris !== 'seminar_proposal' && row.jenis_baris !== 'sidang_skripsi') {
        if (!row.kelompok_besar_id || row.kelompok_besar_id === null) {
          errors.push({ row: rowNum, field: 'kelompok_besar_id', message: `Baris ${rowNum}: Kelompok besar ID wajib diisi` });
        } else {
          // Gunakan options yang tepat berdasarkan jenis_baris
          const kelompokBesarOptions = row.jenis_baris === 'materi' ? kelompokBesarMateriOptions : kelompokBesarAgendaOptions;
          const validKelompokBesarIds = kelompokBesarOptions.map(kb => Number(kb.id));

          // Cari kelompok besar dari semua options (materi dan agenda) untuk mendapatkan label
          const allKelompokBesarOptions = [...kelompokBesarMateriOptions, ...kelompokBesarAgendaOptions];
          const kelompokBesarFound = allKelompokBesarOptions.find(kb => Number(kb.id) === row.kelompok_besar_id);

          // Validasi semester mata kuliah (prioritas utama)
          let hasSemesterError = false;
          if (data && data.semester) {
            const mataKuliahSemester = parseInt(data.semester.toString());
            if (typeof mataKuliahSemester === 'number' && mataKuliahSemester > 0 && row.kelompok_besar_id !== mataKuliahSemester) {
              errors.push({ row: rowNum, field: 'kelompok_besar_id', message: `Baris ${rowNum}: Kelompok besar ID ${row.kelompok_besar_id} tidak sesuai dengan semester mata kuliah (${mataKuliahSemester}). Hanya boleh menggunakan kelompok besar semester ${mataKuliahSemester}` });
              hasSemesterError = true;
            }
          }

          // Validasi apakah kelompok besar ada di options yang tersedia (hanya jika belum ada error semester)
          if (!hasSemesterError && !validKelompokBesarIds.includes(row.kelompok_besar_id)) {
            const availableIds = kelompokBesarOptions.map(kb => kb.id).join(', ');
            errors.push({ row: rowNum, field: 'kelompok_besar_id', message: `Baris ${rowNum}: Kelompok besar ID ${row.kelompok_besar_id} tidak ditemukan. ID yang tersedia: ${availableIds}` });
          }
        }
      }

      // Validasi khusus untuk jenis materi
      if (row.jenis_baris === 'materi') {
        // Validasi dosen - cek nama_dosen dulu, lalu cari ID-nya
        if (!row.nama_dosen || row.nama_dosen.trim() === '') {
          errors.push({ row: rowNum, field: 'dosen_id', message: `Baris ${rowNum}: Dosen wajib diisi` });
        } else {
          const dosenOption = dosenList.find(d => d.name === row.nama_dosen || `${d.name} (${d.nid})` === row.nama_dosen || d.name.includes(row.nama_dosen) || d.nid === row.nama_dosen);
          if (!dosenOption) {
            errors.push({ row: rowNum, field: 'dosen_id', message: `Baris ${rowNum}: Dosen "${row.nama_dosen}" tidak ditemukan` });
          } else if (!row.dosen_id || row.dosen_id === null) {
            // Update dosen_id jika belum di-set
            row.dosen_id = dosenOption.id;
          }
        }

        // Validasi materi
        if (!row.materi || row.materi.trim() === '') {
          errors.push({ row: rowNum, field: 'materi', message: `Baris ${rowNum}: Materi wajib diisi` });
        }

        // Validasi ruangan - cek nama_ruangan dulu, lalu cari ID-nya
        if (!row.nama_ruangan || row.nama_ruangan.trim() === '') {
          errors.push({ row: rowNum, field: 'ruangan_id', message: `Baris ${rowNum}: Ruangan wajib diisi` });
        } else {
          const ruanganOption = ruanganList.find(r => r.nama === row.nama_ruangan || r.nama.includes(row.nama_ruangan) || r.id.toString() === row.nama_ruangan);
          if (!ruanganOption) {
            errors.push({ row: rowNum, field: 'ruangan_id', message: `Baris ${rowNum}: Ruangan "${row.nama_ruangan}" tidak ditemukan` });
          } else if (!row.ruangan_id || row.ruangan_id === null) {
            // Update ruangan_id jika belum di-set
            row.ruangan_id = ruanganOption.id;
          }
        }
      }

      // Validasi khusus untuk jenis agenda
      if (row.jenis_baris === 'agenda') {
        // Validasi keterangan agenda
        if (!row.agenda || row.agenda.trim() === '') {
          errors.push({ row: rowNum, field: 'agenda', message: `Baris ${rowNum}: Agenda wajib diisi untuk jenis agenda` });
        }

        // Validasi ruangan (opsional untuk agenda) - cek nama_ruangan dulu, lalu cari ID-nya
        if (row.nama_ruangan && row.nama_ruangan.trim() !== '') {
          const ruanganOption = ruanganList.find(r => r.nama === row.nama_ruangan || r.nama.includes(row.nama_ruangan) || r.id.toString() === row.nama_ruangan);
          if (!ruanganOption) {
            errors.push({ row: rowNum, field: 'ruangan_id', message: `Baris ${rowNum}: Ruangan "${row.nama_ruangan}" tidak ditemukan` });
          } else if (!row.ruangan_id || row.ruangan_id === null) {
            // Update ruangan_id jika belum di-set
            row.ruangan_id = ruanganOption.id;
          }
        }
      }

      // Validasi khusus untuk jenis seminar_proposal
      if (row.jenis_baris === 'seminar_proposal') {
        // Validasi pembimbing
        if (!row.nama_pembimbing || row.nama_pembimbing.trim() === '') {
          errors.push({ row: rowNum, field: 'pembimbing_id', message: `Baris ${rowNum}: Pembimbing wajib diisi` });
        } else {
          // Cek apakah ada koma (berarti lebih dari 1 pembimbing)
          const pembimbingNames = typeof row.nama_pembimbing === 'string'
            ? row.nama_pembimbing.split(',').map((n: string) => n.trim()).filter(Boolean)
            : [row.nama_pembimbing];

          if (pembimbingNames.length > 1) {
            errors.push({ row: rowNum, field: 'pembimbing_id', message: `Baris ${rowNum}: Pembimbing maksimal 1` });
          } else {
            const pembimbingOption = dosenList.find(d =>
              d.name.toLowerCase() === row.nama_pembimbing.toLowerCase() ||
              `${d.name} (${d.nid})`.toLowerCase() === row.nama_pembimbing.toLowerCase() ||
              d.nid === row.nama_pembimbing ||
              d.id.toString() === row.nama_pembimbing
            );
            if (!pembimbingOption) {
              errors.push({ row: rowNum, field: 'pembimbing_id', message: `Baris ${rowNum}: Pembimbing "${row.nama_pembimbing}" tidak ditemukan` });
            } else {
              if (!row.pembimbing_id || row.pembimbing_id === null) {
                row.pembimbing_id = pembimbingOption.id;
              }
              // Validasi: Cek apakah pembimbing yang dipilih sudah ada di komentator
              if (row.komentator_ids && row.komentator_ids.includes(pembimbingOption.id)) {
                errors.push({ row: rowNum, field: 'pembimbing_id', message: `Baris ${rowNum}: Dosen "${pembimbingOption.name}" sudah dipilih sebagai Komentator. Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Komentator` });
              }
            }
          }
        }

        // Validasi komentator
        // Parse nama_komentator - gunakan backslash sebagai pemisah karena beberapa dosen memiliki gelar dengan koma
        const namaKomentator = row.nama_komentator || '';
        if (!namaKomentator || (String(namaKomentator).trim() === '')) {
          errors.push({ row: rowNum, field: 'komentator_ids', message: `Baris ${rowNum}: Komentator wajib diisi minimal 1` });
        } else {
          // Parse dosen names dengan backslash separator
          const komentatorNames = (typeof namaKomentator === 'string' ? namaKomentator : String(namaKomentator))
            .split('\\')
            .map((n: string) => n.trim())
            .filter((n: string) => n !== '');

          if (komentatorNames.length === 0) {
            errors.push({ row: rowNum, field: 'komentator_ids', message: `Baris ${rowNum}: Komentator wajib diisi minimal 1` });
          } else if (komentatorNames.length > 2) {
            errors.push({ row: rowNum, field: 'komentator_ids', message: `Baris ${rowNum}: Komentator maksimal 2` });
          } else {
            const komentatorIds: number[] = [];
            const invalidKomentatorNames: string[] = [];

            komentatorNames.forEach((nama: string) => {
              const komentatorOption = dosenList.find(d =>
                d.name.toLowerCase() === nama.toLowerCase() ||
                `${d.name} (${d.nid})`.toLowerCase() === nama.toLowerCase() ||
                d.nid === nama ||
                d.id.toString() === nama
              );
              if (!komentatorOption) {
                invalidKomentatorNames.push(nama);
              } else {
                komentatorIds.push(komentatorOption.id);
              }
            });

            if (invalidKomentatorNames.length > 0) {
              errors.push({ row: rowNum, field: 'komentator_ids', message: `Baris ${rowNum}: Komentator tidak valid: "${invalidKomentatorNames.join(', ')}". Pastikan semua nama komentator valid` });
            }

            if (komentatorIds.length === 0) {
              errors.push({ row: rowNum, field: 'komentator_ids', message: `Baris ${rowNum}: Komentator wajib diisi dengan minimal 1 komentator yang valid` });
            } else {
              // Set komentator_ids untuk digunakan saat submit
              (row as any).komentator_ids = komentatorIds;
              
              // Validasi: Cek apakah ada dosen yang sama di pembimbing dan komentator
              if (row.pembimbing_id && komentatorIds.includes(row.pembimbing_id)) {
                const pembimbingName = dosenList.find(d => d.id === row.pembimbing_id)?.name || 'N/A';
                errors.push({ row: rowNum, field: 'komentator_ids', message: `Baris ${rowNum}: Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Komentator: ${pembimbingName}` });
              }
              
              // Validasi: Cek apakah ada duplikasi komentator
              const uniqueKomentatorIds = [...new Set(komentatorIds)];
              if (uniqueKomentatorIds.length < komentatorIds.length) {
                // Cari nama komentator yang duplikat
                const komentatorNamesMapped = komentatorNames.map((nama: string) => {
                  const komentatorOption = dosenList.find(d =>
                    d.name.toLowerCase() === nama.toLowerCase() ||
                    `${d.name} (${d.nid})`.toLowerCase() === nama.toLowerCase() ||
                    d.nid === nama ||
                    d.id.toString() === nama
                  );
                  return komentatorOption ? komentatorOption.name : nama;
                });
                
                const duplicates = komentatorNamesMapped.filter((name, index) => komentatorNamesMapped.indexOf(name) !== index);
                const uniqueDuplicates = [...new Set(duplicates)];
                
                errors.push({ 
                  row: rowNum, 
                  field: 'komentator_ids', 
                  message: `Baris ${rowNum}: Komentator tidak boleh duplikat: "${uniqueDuplicates.join(', ')}"` 
                });
              }
            }
          }
        }

        // Validasi mahasiswa
        const mahasiswaNims = row.mahasiswa_nims || [];
        if (mahasiswaNims.length === 0) {
          errors.push({ row: rowNum, field: 'mahasiswa_nims', message: `Baris ${rowNum}: Mahasiswa wajib diisi minimal 1` });
        }

        // Validasi nama mahasiswa (input user) - tambahan untuk memastikan error tetap muncul saat input invalid
        if (row.nama_mahasiswa) {
          const mahasiswaStr = Array.isArray(row.nama_mahasiswa) ? row.nama_mahasiswa.join(', ') : row.nama_mahasiswa;
          if (mahasiswaStr.trim() !== '') {
            // Parse string menjadi array untuk validasi
            const mahasiswaInputs = mahasiswaStr.split(',').map((n: string) => n.trim()).filter(Boolean);

            if (mahasiswaInputs.length > 0) {
              // Validasi apakah semua input valid (nama atau NIM)
              const invalidInputs: string[] = [];
              mahasiswaInputs.forEach((input: string) => {
                if (input && input.trim() !== '') {
                  // Cek apakah input adalah nama yang valid atau NIM yang valid
                  const mahasiswaByName = mahasiswaList.find(m =>
                    m.name.toLowerCase() === input.toLowerCase()
                  );
                  const mahasiswaByNim = mahasiswaList.find(m =>
                    m.nim.toLowerCase() === input.toLowerCase()
                  );

                  if (!mahasiswaByName && !mahasiswaByNim) {
                    invalidInputs.push(input);
                  }
                }
              });

              if (invalidInputs.length > 0) {
                errors.push({ row: rowNum, field: 'mahasiswa_nims', message: `Baris ${rowNum}: Mahasiswa "${invalidInputs.join(', ')}" tidak ditemukan` });
              }
              
              // Validasi: Cek apakah ada duplikasi mahasiswa
              const uniqueMahasiswaInputs = [...new Set(mahasiswaInputs)];
              if (uniqueMahasiswaInputs.length < mahasiswaInputs.length) {
                const duplicates = mahasiswaInputs.filter((input, index) => mahasiswaInputs.indexOf(input) !== index);
                const uniqueDuplicates = [...new Set(duplicates)];
                
                errors.push({ 
                  row: rowNum, 
                  field: 'mahasiswa_nims', 
                  message: `Baris ${rowNum}: Mahasiswa tidak boleh duplikat: "${uniqueDuplicates.join(', ')}"` 
                });
              }
            }
          }
        }

        // Validasi ruangan (opsional)
        if (row.nama_ruangan && row.nama_ruangan.trim() !== '') {
          // Cari ruangan yang cocok persis untuk validasi
          const exactMatchRuangan = ruanganList.find(r => r.nama === row.nama_ruangan || r.id.toString() === row.nama_ruangan);
          
          // Cari ruangan yang cocok parsial untuk update ID (jika perlu)
          const partialMatchRuangan = ruanganList.find(r => r.nama === row.nama_ruangan || r.nama.includes(row.nama_ruangan) || r.id.toString() === row.nama_ruangan);
          
          // Validasi: hanya ruangan yang cocok persis yang dianggap valid
          if (!exactMatchRuangan) {
            errors.push({ row: rowNum, field: 'ruangan_id', message: `Baris ${rowNum}: Ruangan "${row.nama_ruangan}" tidak ditemukan` });
          } else if (!row.ruangan_id || row.ruangan_id === null) {
            // Update ruangan_id hanya jika ada exact match
            row.ruangan_id = exactMatchRuangan.id;
          } else {
            // Validasi kapasitas ruangan untuk seminar proposal: pembimbing (1) + komentator + mahasiswa
            const jumlahPembimbing = row.pembimbing_id ? 1 : 0;
            const jumlahKomentator = (row.komentator_ids || []).length;
            const jumlahMahasiswa = (row.mahasiswa_nims || []).length;
            const totalPeserta = jumlahPembimbing + jumlahKomentator + jumlahMahasiswa;

            if (totalPeserta > 0 && exactMatchRuangan.kapasitas < totalPeserta) {
              const detailPeserta = [];
              if (jumlahPembimbing > 0) detailPeserta.push(`${jumlahPembimbing} pembimbing`);
              if (jumlahKomentator > 0) detailPeserta.push(`${jumlahKomentator} komentator`);
              if (jumlahMahasiswa > 0) detailPeserta.push(`${jumlahMahasiswa} mahasiswa`);
              const detailPesertaStr = detailPeserta.join(' + ');

              errors.push({
                row: rowNum,
                field: 'ruangan_id',
                message: `Baris ${rowNum}: Kapasitas ruangan ${exactMatchRuangan.nama} (${exactMatchRuangan.kapasitas}) tidak cukup untuk ${totalPeserta} orang (${detailPesertaStr})`
              });
            }
          }
        }
      }

      // Validasi khusus untuk jenis sidang_skripsi
      if (row.jenis_baris === 'sidang_skripsi') {
        // Validasi pembimbing
        if (!row.nama_pembimbing || row.nama_pembimbing.trim() === '') {
          errors.push({ row: rowNum, field: 'pembimbing_id', message: `Baris ${rowNum}: Pembimbing wajib diisi` });
        } else {
          // Cek apakah ada koma (berarti lebih dari 1 pembimbing)
          const pembimbingNames = typeof row.nama_pembimbing === 'string'
            ? row.nama_pembimbing.split(',').map((n: string) => n.trim()).filter(Boolean)
            : [row.nama_pembimbing];

          if (pembimbingNames.length > 1) {
            errors.push({ row: rowNum, field: 'pembimbing_id', message: `Baris ${rowNum}: Pembimbing maksimal 1` });
          } else {
            const pembimbingOption = dosenList.find(d =>
              d.name.toLowerCase() === row.nama_pembimbing.toLowerCase() ||
              `${d.name} (${d.nid})`.toLowerCase() === row.nama_pembimbing.toLowerCase() ||
              d.nid === row.nama_pembimbing ||
              d.id.toString() === row.nama_pembimbing
            );
            if (!pembimbingOption) {
              errors.push({ row: rowNum, field: 'pembimbing_id', message: `Baris ${rowNum}: Pembimbing "${row.nama_pembimbing}" tidak ditemukan` });
            } else {
              if (!row.pembimbing_id || row.pembimbing_id === null) {
                row.pembimbing_id = pembimbingOption.id;
              }
              // Validasi: Cek apakah pembimbing yang dipilih sudah ada di penguji
              if (row.penguji_ids && row.penguji_ids.includes(pembimbingOption.id)) {
                errors.push({ row: rowNum, field: 'pembimbing_id', message: `Baris ${rowNum}: Dosen "${pembimbingOption.name}" sudah dipilih sebagai Penguji. Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Penguji` });
              }
            }
          }
        }

        // Validasi penguji
        // Parse nama_penguji - gunakan backslash sebagai pemisah karena beberapa dosen memiliki gelar dengan koma
        const namaPenguji = row.nama_penguji || '';
        if (!namaPenguji || (String(namaPenguji).trim() === '')) {
          errors.push({ row: rowNum, field: 'penguji_ids', message: `Baris ${rowNum}: Penguji wajib diisi minimal 1` });
        } else {
          // Parse dosen names dengan backslash separator
          const pengujiNames = (typeof namaPenguji === 'string' ? namaPenguji : String(namaPenguji))
            .split('\\')
            .map((n: string) => n.trim())
            .filter((n: string) => n !== '');

          if (pengujiNames.length === 0) {
            errors.push({ row: rowNum, field: 'penguji_ids', message: `Baris ${rowNum}: Penguji wajib diisi minimal 1` });
          } else {
            const pengujiIds: number[] = [];
            const invalidPengujiNames: string[] = [];

            pengujiNames.forEach((nama: string) => {
              const pengujiOption = dosenList.find(d =>
                d.name.toLowerCase() === nama.toLowerCase() ||
                `${d.name} (${d.nid})`.toLowerCase() === nama.toLowerCase() ||
                d.nid === nama ||
                d.id.toString() === nama
              );
              if (!pengujiOption) {
                invalidPengujiNames.push(nama);
              } else {
                pengujiIds.push(pengujiOption.id);
              }
            });

            if (invalidPengujiNames.length > 0) {
              errors.push({ row: rowNum, field: 'penguji_ids', message: `Baris ${rowNum}: Penguji tidak valid: "${invalidPengujiNames.join(', ')}". Pastikan semua nama penguji valid` });
            }

            if (pengujiIds.length === 0) {
              errors.push({ row: rowNum, field: 'penguji_ids', message: `Baris ${rowNum}: Penguji wajib diisi dengan minimal 1 penguji yang valid` });
            } else {
              // Set penguji_ids untuk digunakan saat submit
              (row as any).penguji_ids = pengujiIds;
              
              // Validasi: Cek apakah ada dosen yang sama di pembimbing dan penguji
              if (row.pembimbing_id && pengujiIds.includes(row.pembimbing_id)) {
                const pembimbingName = dosenList.find(d => d.id === row.pembimbing_id)?.name || 'N/A';
                errors.push({ row: rowNum, field: 'penguji_ids', message: `Baris ${rowNum}: Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Penguji: ${pembimbingName}` });
              }
              
              // Validasi: Cek apakah ada duplikasi penguji
              const uniquePengujiIds = [...new Set(pengujiIds)];
              if (uniquePengujiIds.length < pengujiIds.length) {
                // Cari nama penguji yang duplikat
                const pengujiNamesMapped = pengujiNames.map((nama: string) => {
                  const pengujiOption = dosenList.find(d =>
                    d.name.toLowerCase() === nama.toLowerCase() ||
                    `${d.name} (${d.nid})`.toLowerCase() === nama.toLowerCase() ||
                    d.nid === nama ||
                    d.id.toString() === nama
                  );
                  return pengujiOption ? pengujiOption.name : nama;
                });
                
                const duplicates = pengujiNamesMapped.filter((name, index) => pengujiNamesMapped.indexOf(name) !== index);
                const uniqueDuplicates = [...new Set(duplicates)];
                
                errors.push({ 
                  row: rowNum, 
                  field: 'penguji_ids', 
                  message: `Baris ${rowNum}: Penguji tidak boleh duplikat: "${uniqueDuplicates.join(', ')}"` 
                });
              }
            }
          }
        }

        // Validasi mahasiswa
        const mahasiswaNims = row.mahasiswa_nims || [];
        if (mahasiswaNims.length === 0) {
          errors.push({ row: rowNum, field: 'mahasiswa_nims', message: `Baris ${rowNum}: Mahasiswa wajib diisi minimal 1` });
        }

        // Validasi nama mahasiswa (input user) - tambahan untuk memastikan error tetap muncul saat input invalid
        if (row.nama_mahasiswa) {
          const mahasiswaStr = Array.isArray(row.nama_mahasiswa) ? row.nama_mahasiswa.join(', ') : row.nama_mahasiswa;
          if (mahasiswaStr.trim() !== '') {
            // Parse string menjadi array untuk validasi
            const mahasiswaInputs = mahasiswaStr.split(',').map((n: string) => n.trim()).filter(Boolean);

            if (mahasiswaInputs.length > 0) {
              // Validasi apakah semua input valid (nama atau NIM)
              const invalidInputs: string[] = [];
              mahasiswaInputs.forEach((input: string) => {
                if (input && input.trim() !== '') {
                  // Cek apakah input adalah nama yang valid atau NIM yang valid
                  const mahasiswaByName = mahasiswaList.find(m =>
                    m.name.toLowerCase() === input.toLowerCase()
                  );
                  const mahasiswaByNim = mahasiswaList.find(m =>
                    m.nim.toLowerCase() === input.toLowerCase()
                  );

                  if (!mahasiswaByName && !mahasiswaByNim) {
                    invalidInputs.push(input);
                  }
                }
              });

              if (invalidInputs.length > 0) {
                errors.push({ row: rowNum, field: 'mahasiswa_nims', message: `Baris ${rowNum}: Mahasiswa "${invalidInputs.join(', ')}" tidak ditemukan` });
              }
              
              // Validasi: Cek apakah ada duplikasi mahasiswa
              const uniqueMahasiswaInputs = [...new Set(mahasiswaInputs)];
              if (uniqueMahasiswaInputs.length < mahasiswaInputs.length) {
                const duplicates = mahasiswaInputs.filter((input, index) => mahasiswaInputs.indexOf(input) !== index);
                const uniqueDuplicates = [...new Set(duplicates)];
                
                errors.push({ 
                  row: rowNum, 
                  field: 'mahasiswa_nims', 
                  message: `Baris ${rowNum}: Mahasiswa tidak boleh duplikat: "${uniqueDuplicates.join(', ')}"` 
                });
              }
            }
          }
        }

        // Validasi ruangan (opsional)
        if (row.nama_ruangan && row.nama_ruangan.trim() !== '') {
          // Cari ruangan yang cocok persis untuk validasi
          const exactMatchRuangan = ruanganList.find(r => r.nama === row.nama_ruangan || r.id.toString() === row.nama_ruangan);
          
          // Cari ruangan yang cocok parsial untuk update ID (jika perlu)
          const partialMatchRuangan = ruanganList.find(r => r.nama === row.nama_ruangan || r.nama.includes(row.nama_ruangan) || r.id.toString() === row.nama_ruangan);
          
          // Validasi: hanya ruangan yang cocok persis yang dianggap valid
          if (!exactMatchRuangan) {
            errors.push({ row: rowNum, field: 'ruangan_id', message: `Baris ${rowNum}: Ruangan "${row.nama_ruangan}" tidak ditemukan` });
          } else if (!row.ruangan_id || row.ruangan_id === null) {
            // Update ruangan_id hanya jika ada exact match
            row.ruangan_id = exactMatchRuangan.id;
          } else {
            // Validasi kapasitas ruangan untuk sidang skripsi: pembimbing (1) + penguji + mahasiswa
            const jumlahPembimbing = row.pembimbing_id ? 1 : 0;
            const jumlahPenguji = (row.penguji_ids || []).length;
            const jumlahMahasiswa = (row.mahasiswa_nims || []).length;
            const totalPeserta = jumlahPembimbing + jumlahPenguji + jumlahMahasiswa;

            if (totalPeserta > 0 && exactMatchRuangan.kapasitas < totalPeserta) {
              const detailPeserta = [];
              if (jumlahPembimbing > 0) detailPeserta.push(`${jumlahPembimbing} pembimbing`);
              if (jumlahPenguji > 0) detailPeserta.push(`${jumlahPenguji} penguji`);
              if (jumlahMahasiswa > 0) detailPeserta.push(`${jumlahMahasiswa} mahasiswa`);
              const detailPesertaStr = detailPeserta.join(' + ');

              errors.push({
                row: rowNum,
                field: 'ruangan_id',
                message: `Baris ${rowNum}: Kapasitas ruangan ${exactMatchRuangan.nama} (${exactMatchRuangan.kapasitas}) tidak cukup untuk ${totalPeserta} orang (${detailPesertaStr})`
              });
            }
          }
        }
      }
    });

    return errors;
  };

  // Helper function untuk convert Excel data ke format aplikasi
  const convertExcelDataToAppFormat = (excelData: any[][], jenisBaris: 'materi' | 'agenda'): JadwalNonBlokNonCSRType[] => {
    return excelData.map((row, index) => {
      const rowNum = index + 1;

      // Parse kelompok besar ID (index 3 untuk kedua jenis)
      let kelompokBesarId = null;
      if (row[3] && row[3] !== '') {
        const kelompokBesarValue = row[3].toString().trim();
        kelompokBesarId = parseInt(kelompokBesarValue) || null;
      }

      // Parse dosen ID (hanya untuk materi, index 4)
      let dosenId = null;
      if (jenisBaris === 'materi' && row[4] && row[4] !== '') {
        const dosenOption = dosenList.find(d => d.name === row[4] || `${d.name} (${d.nid})` === row[4] || d.name.includes(row[4]) || d.nid === row[4]);
        dosenId = dosenOption ? dosenOption.id : null;
      }

      // Parse ruangan ID (index berbeda untuk materi dan agenda)
      let ruanganId = null;
      if (jenisBaris === 'materi') {
        // Materi: Ruangan di index 6
        if (row[6] && row[6] !== '') {
          const ruanganOption = ruanganList.find(r => r.nama === row[6] || r.nama.includes(row[6]) || r.id.toString() === row[6]);
          ruanganId = ruanganOption ? ruanganOption.id : null;
        }
      } else {
        // Agenda: Ruangan di index 4
        if (row[4] && row[4] !== '') {
          const ruanganOption = ruanganList.find(r => r.nama === row[4] || r.nama.includes(row[4]) || r.id.toString() === row[4]);
          ruanganId = ruanganOption ? ruanganOption.id : null;
        }
      }

      // Parse tanggal
      let tanggal = '';
      if (row[0]) {
        if (typeof row[0] === 'number') {
          // Excel date serial number
          tanggal = XLSX.SSF.format('yyyy-mm-dd', row[0]);
        } else {
          // String date
          const dateStr = row[0].toString().trim();
          // Coba parse berbagai format
          const dateObj = new Date(dateStr);
          if (!isNaN(dateObj.getTime())) {
            // Format ke YYYY-MM-DD
            tanggal = dateObj.toISOString().split('T')[0];
          } else {
            // Jika tidak bisa di-parse, gunakan string asli (akan divalidasi nanti)
            tanggal = dateStr;
          }
        }
        // Validasi format akhir
        const dateObj = new Date(tanggal);
        if (isNaN(dateObj.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
          // Jika tidak valid, set empty (akan divalidasi nanti)
          tanggal = '';
        }
      }

      const jamMulaiRaw = row[1] || '';
      const jamMulai = convertTimeFormat(jamMulaiRaw);
      const jumlahSesi = parseInt(row[2]) || 0; // Sesi di index 2
      const jamSelesai = hitungJamSelesai(jamMulai, jumlahSesi);

      // Parse materi (hanya untuk materi, index 5)
      const materi = jenisBaris === 'materi' ? (row[5] || '') : '';

      // Parse agenda (hanya untuk agenda, index 5)
      const agenda = jenisBaris === 'agenda' ? (row[5] || '') : '';

      // Parse nama dosen (hanya untuk materi, index 4)
      const namaDosen = jenisBaris === 'materi' ? (row[4] || '') : '';

      // Parse nama ruangan
      const namaRuangan = jenisBaris === 'materi' ? (row[6] || '') : (row[4] || '');

      return {
        tanggal: tanggal,
        jam_mulai: jamMulai,
        jam_selesai: jamSelesai,
        jenis_baris: jenisBaris,
        jumlah_sesi: jumlahSesi,
        kelompok_besar_id: kelompokBesarId,
        nama_kelompok_besar: row[3] || '',
        dosen_id: dosenId,
        nama_dosen: namaDosen,
        materi: materi,
        ruangan_id: ruanganId,
        nama_ruangan: namaRuangan,
        agenda: agenda,
        use_ruangan: ruanganId !== null
      };
    });
  };

  // Handle upload file untuk Materi Kuliah (dari modal upload)
  const handleMateriFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setMateriImportErrors(['Format file Excel tidak dikenali. Harap gunakan file .xlsx atau .xls']);
      setMateriImportFile(file); // Set file untuk persistence
      return;
    }

    // Process file
    await handleMateriProcessFile(file);
  };

  // Process file Excel untuk Materi Kuliah
  const handleMateriProcessFile = async (file: File) => {
    // Reset error states (tapi jangan reset data untuk persistence)
    setMateriImportErrors([]);
    setMateriCellErrors([]);

    try {
      // Read Excel file
      const { headers, data: excelData } = await readNonBlokExcelFile(file);

      // Validate headers untuk Materi Kuliah (tanpa kolom Jenis Baris)
      const expectedHeaders = ['Tanggal', 'Jam Mulai', 'Sesi', 'Kelompok Besar', 'Dosen', 'Materi', 'Ruangan'];
      const headerMatch = expectedHeaders.every(header => headers.includes(header));

      if (!headerMatch) {
        setMateriImportErrors(['Template tidak valid. Pastikan menggunakan template dari aplikasi ini.']);
        setMateriImportFile(file); // Set file untuk persistence
        return;
      }

      if (excelData.length === 0) {
        setMateriImportErrors(["File Excel kosong atau tidak memiliki data"]);
        setMateriImportFile(file); // Set file untuk persistence
        return;
      }

      // Convert Excel data to our format
      const convertedData = convertExcelDataToAppFormat(excelData, 'materi');

      // Semua data sudah otomatis jenis_baris = 'materi'
      const materiData = convertedData;

      if (materiData.length === 0) {
        setMateriImportErrors(['File Excel tidak mengandung data Materi Kuliah. Pastikan file yang diupload adalah template Materi Kuliah.']);
        setMateriImportFile(file); // Set file untuk persistence
        return;
      }

      // Validate data
      const validationErrors = validateNonBlokExcelData(materiData);
      setMateriCellErrors(validationErrors);

      // Set data and file (persistence)
      setMateriImportData(materiData);
      setMateriImportFile(file);

      // File sudah di-set, preview akan muncul di modal yang sama

    } catch (error: any) {
      setMateriImportErrors([error.message || 'Terjadi kesalahan saat membaca file Excel']);
      setMateriImportFile(file); // Set file untuk persistence
    }
  };

  // Handle upload file untuk Agenda Khusus (dari modal upload)
  const handleAgendaFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setAgendaImportErrors(['Format file Excel tidak dikenali. Harap gunakan file .xlsx atau .xls']);
      setAgendaImportFile(file); // Set file untuk persistence
      return;
    }

    // Process file
    await handleAgendaProcessFile(file);
  };

  // Process file Excel untuk Agenda Khusus
  const handleAgendaProcessFile = async (file: File) => {
    // Reset error states (tapi jangan reset data untuk persistence)
    setAgendaImportErrors([]);
    setAgendaCellErrors([]);

    try {
      // Read Excel file
      const { headers, data: excelData } = await readNonBlokExcelFile(file);

      // Validate headers untuk Agenda Khusus (tanpa kolom Jenis Baris, Dosen, Materi)
      const expectedHeaders = ['Tanggal', 'Jam Mulai', 'Sesi', 'Kelompok Besar', 'Ruangan', 'Agenda'];
      const headerMatch = expectedHeaders.every(header => headers.includes(header));

      if (!headerMatch) {
        setAgendaImportErrors(['Template tidak valid. Pastikan menggunakan template dari aplikasi ini.']);
        setAgendaImportFile(file); // Set file untuk persistence
        return;
      }

      if (excelData.length === 0) {
        setAgendaImportErrors(["File Excel kosong atau tidak memiliki data"]);
        setAgendaImportFile(file); // Set file untuk persistence
        return;
      }

      // Convert Excel data to our format
      const convertedData = convertExcelDataToAppFormat(excelData, 'agenda');

      // Semua data sudah otomatis jenis_baris = 'agenda'
      const agendaData = convertedData;

      if (agendaData.length === 0) {
        setAgendaImportErrors(['File Excel tidak mengandung data Agenda Khusus. Pastikan file yang diupload adalah template Agenda Khusus.']);
        setAgendaImportFile(file); // Set file untuk persistence
        return;
      }

      // Validate data
      const validationErrors = validateNonBlokExcelData(agendaData);
      setAgendaCellErrors(validationErrors);

      // Set data and file (persistence)
      setAgendaImportData(agendaData);
      setAgendaImportFile(file);

      // File sudah di-set, preview akan muncul di modal yang sama

    } catch (error: any) {
      setAgendaImportErrors([error.message || 'Terjadi kesalahan saat membaca file Excel']);
      setAgendaImportFile(file); // Set file untuk persistence
    }
  };

  // Submit import Excel untuk Materi Kuliah
  const handleMateriSubmitImport = async () => {
    if (!kode || materiImportData.length === 0) return;

    setIsMateriImporting(true);
    setMateriImportErrors([]);

    try {
      // Final validation
      const validationErrors = validateNonBlokExcelData(materiImportData);
      if (validationErrors.length > 0) {
        setMateriCellErrors(validationErrors);
        setIsMateriImporting(false);
        return;
      }

      // Transform data for API
      const apiData = materiImportData.map(row => ({
        tanggal: row.tanggal,
        jam_mulai: row.jam_mulai,
        jam_selesai: row.jam_selesai,
        jenis_baris: 'materi',
        jumlah_sesi: row.jumlah_sesi,
        kelompok_besar_id: row.kelompok_besar_id,
        dosen_id: row.dosen_id,
        materi: row.materi,
        ruangan_id: row.ruangan_id,
        agenda: '',
        use_ruangan: true
      }));

      // Send to API
      const response = await api.post(`/non-blok-non-csr/jadwal/${kode}/import`, {
        data: apiData
      });

      if (response.data.success) {
        setMateriImportedCount(materiImportData.length);
        setShowMateriUploadModal(false);
        setShowMateriImportModal(false);
        // Reset semua state setelah import berhasil
        setMateriImportData([]);
        setMateriImportErrors([]);
        setMateriCellErrors([]);
        setMateriEditingCell(null);
        setMateriImportFile(null);
        setMateriImportPage(1);
        if (materiFileInputRef.current) {
          materiFileInputRef.current.value = '';
        }
        await fetchBatchData();
      } else {
        setMateriImportErrors([response.data.message || 'Terjadi kesalahan saat mengimport data']);
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        const errorData = error.response.data;
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const cellErrors = errorData.errors.map((err: string) => {
            const rowMatch = err.match(/Baris\s+(\d+):/);
            const row = rowMatch ? parseInt(rowMatch[1]) : 0;
            return {
              row: row,
              field: 'api',
              message: err
            };
          });
          setMateriCellErrors(cellErrors);
        } else {
          setMateriImportErrors([errorData.message || 'Terjadi kesalahan validasi']);
        }
      } else {
        const errorMessage = error.response?.data?.message || 'Terjadi kesalahan saat mengimport data';
        setMateriImportErrors([errorMessage]);
      }
    } finally {
      setIsMateriImporting(false);
    }
  };

  // Submit import Excel untuk Agenda Khusus
  const handleAgendaSubmitImport = async () => {
    if (!kode || agendaImportData.length === 0) return;

    setIsAgendaImporting(true);
    setAgendaImportErrors([]);

    try {
      // Final validation
      const validationErrors = validateNonBlokExcelData(agendaImportData);
      if (validationErrors.length > 0) {
        setAgendaCellErrors(validationErrors);
        setIsAgendaImporting(false);
        return;
      }

      // Transform data for API
      const apiData = agendaImportData.map(row => ({
        tanggal: row.tanggal,
        jam_mulai: row.jam_mulai,
        jam_selesai: row.jam_selesai,
        jenis_baris: 'agenda',
        jumlah_sesi: row.jumlah_sesi,
        kelompok_besar_id: row.kelompok_besar_id,
        dosen_id: null,
        materi: '',
        ruangan_id: row.ruangan_id,
        agenda: row.agenda,
        use_ruangan: row.ruangan_id !== null
      }));

      // Send to API
      const response = await api.post(`/non-blok-non-csr/jadwal/${kode}/import`, {
        data: apiData
      });

      if (response.data.success) {
        setAgendaImportedCount(agendaImportData.length);
        setShowAgendaUploadModal(false);
        setShowAgendaImportModal(false);
        // Reset semua state setelah import berhasil
        setAgendaImportData([]);
        setAgendaImportErrors([]);
        setAgendaCellErrors([]);
        setAgendaEditingCell(null);
        setAgendaImportFile(null);
        setAgendaImportPage(1);
        if (agendaFileInputRef.current) {
          agendaFileInputRef.current.value = '';
        }
        await fetchBatchData();
      } else {
        setAgendaImportErrors([response.data.message || 'Terjadi kesalahan saat mengimport data']);
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        const errorData = error.response.data;
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const cellErrors = errorData.errors.map((err: string) => {
            const rowMatch = err.match(/Baris\s+(\d+):/);
            const row = rowMatch ? parseInt(rowMatch[1]) : 0;
            return {
              row: row,
              field: 'api',
              message: err
            };
          });
          setAgendaCellErrors(cellErrors);
        } else {
          setAgendaImportErrors([errorData.message || 'Terjadi kesalahan validasi']);
        }
      } else {
        const errorMessage = error.response?.data?.message || 'Terjadi kesalahan saat mengimport data';
        setAgendaImportErrors([errorMessage]);
      }
    } finally {
      setIsAgendaImporting(false);
    }
  };

  // Close upload modal untuk Materi Kuliah
  const handleMateriCloseUploadModal = () => {
    setShowMateriUploadModal(false);
    // Tidak menghapus file untuk persistence
  };

  // Close import modal untuk Materi Kuliah
  const handleMateriCloseImportModal = () => {
    setShowMateriImportModal(false);
    // Tidak menghapus data untuk persistence
  };

  // Handler untuk hapus file Materi Kuliah
  const handleMateriRemoveFile = () => {
    setMateriImportFile(null);
    setMateriImportData([]);
    setMateriImportErrors([]);
    setMateriCellErrors([]);
    setMateriEditingCell(null);
    setMateriImportPage(1);
    if (materiFileInputRef.current) {
      materiFileInputRef.current.value = '';
    }
  };

  // Close upload modal untuk Agenda Khusus
  const handleAgendaCloseUploadModal = () => {
    setShowAgendaUploadModal(false);
    // Tidak menghapus file untuk persistence
  };

  // Close import modal untuk Agenda Khusus
  const handleAgendaCloseImportModal = () => {
    setShowAgendaImportModal(false);
    // Tidak menghapus data untuk persistence
  };

  // Handler untuk hapus file Agenda Khusus
  const handleAgendaRemoveFile = () => {
    setAgendaImportFile(null);
    setAgendaImportData([]);
    setAgendaImportErrors([]);
    setAgendaCellErrors([]);
    setAgendaEditingCell(null);
    setAgendaImportPage(1);
    if (agendaFileInputRef.current) {
      agendaFileInputRef.current.value = '';
    }
  };

  // Handle upload file untuk Seminar Proposal (dari modal upload)
  const handleSeminarFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setSeminarImportErrors(['Format file Excel tidak dikenali. Harap gunakan file .xlsx atau .xls']);
      setSeminarImportFile(file);
      return;
    }

    // Process file
    await handleSeminarProcessFile(file);
  };

  // Process file Excel untuk Seminar Proposal
  const handleSeminarProcessFile = async (file: File) => {
    setSeminarImportErrors([]);
    setSeminarCellErrors([]);

    try {
      const { headers, data: excelData } = await readNonBlokExcelFile(file);

      // Validate headers untuk Seminar Proposal (menerima header dengan NIM atau Nama)
      // Komentator sekarang menggunakan 1 kolom saja (bukan 2 kolom terpisah)
      const expectedHeaders = ['Tanggal', 'Jam Mulai', 'Sesi', 'Pembimbing', 'Komentator', 'Ruangan'];
      const mahasiswaHeader = headers.find(h => h.toLowerCase().includes('mahasiswa'));
      const headerMatch = expectedHeaders.every(header => headers.includes(header)) && mahasiswaHeader !== undefined;

      if (!headerMatch) {
        setSeminarImportErrors(['Template tidak valid. Pastikan menggunakan template dari aplikasi ini.']);
        setSeminarImportFile(file);
        return;
      }

      if (excelData.length === 0) {
        setSeminarImportErrors(["File Excel kosong atau tidak memiliki data"]);
        setSeminarImportFile(file);
        return;
      }

      // Convert Excel data to our format
      const convertedData = excelData.map((row: any[], index: number) => {
        const tanggal = row[0] || '';
        const jamMulaiRaw = row[1] || '';
        const jamMulai = convertTimeFormat(jamMulaiRaw);
        const jumlahSesi = parseInt(row[2]) || 0;
        const jamSelesai = hitungJamSelesai(jamMulai, jumlahSesi);
        const namaPembimbing = row[3] || '';
        const namaKomentator = row[4] || ''; // Sekarang 1 kolom saja (bukan 2 kolom terpisah)
        const mahasiswaNims = row[5] || ''; // Index bergeser karena komentator jadi 1 kolom
        const namaRuangan = row[6] || ''; // Index bergeser

        // Find pembimbing
        const pembimbing = dosenList.find(d =>
          d.name.toLowerCase() === namaPembimbing.toLowerCase() ||
          d.id.toString() === namaPembimbing
        );
        const pembimbingId = pembimbing?.id || null;

        // Helper untuk parse dosen names ke IDs (gunakan backslash sebagai pemisah)
        // Gunakan backslash karena beberapa dosen memiliki gelar dengan koma (contoh: Gustiwanan spd, mpd, spg)
        const parseDosenNames = (dosenStr: string) => {
          if (!dosenStr || dosenStr.trim() === "") return [];
          const dosenNames = dosenStr
            .split("\\")
            .map((n: string) => n.trim())
            .filter((n: string) => n);
          const dosenIds: number[] = [];
          dosenNames.forEach((namaDosen: string) => {
            const dosen = dosenList.find(
              (d) => d.name.toLowerCase() === namaDosen.toLowerCase() ||
                d.id.toString() === namaDosen
            );
            if (dosen) {
              dosenIds.push(dosen.id);
            }
          });
          return dosenIds;
        };

        // Parse komentator (bisa multiple dengan backslash separator)
        const komentatorIds = parseDosenNames(namaKomentator);

        // Parse mahasiswa - bisa berupa nama atau NIM (dipisah koma)
        // Coba cari berdasarkan nama dulu, jika tidak ditemukan coba sebagai NIM
        const mahasiswaInputs = mahasiswaNims.split(',').map(input => input.trim()).filter(Boolean);
        const mahasiswaNimsArray: string[] = [];

        for (const input of mahasiswaInputs) {
          // Coba cari berdasarkan nama
          const mahasiswaByName = mahasiswaList.find(m =>
            m.name.toLowerCase() === input.toLowerCase()
          );

          if (mahasiswaByName) {
            mahasiswaNimsArray.push(mahasiswaByName.nim);
          } else {
            // Jika tidak ditemukan sebagai nama, anggap sebagai NIM
            mahasiswaNimsArray.push(input);
          }
        }

        // Find ruangan
        const ruangan = ruanganList.find(r =>
          r.nama.toLowerCase() === namaRuangan.toLowerCase() ||
          r.id.toString() === namaRuangan
        );
        const ruanganId = ruangan?.id || null;

        return {
          tanggal: tanggal,
          jam_mulai: jamMulai,
          jam_selesai: jamSelesai,
          jenis_baris: 'seminar_proposal' as const,
          jumlah_sesi: jumlahSesi,
          pembimbing_id: pembimbingId,
          nama_pembimbing: namaPembimbing,
          komentator_ids: komentatorIds,
          nama_komentator: namaKomentator, // Sekarang string saja, bukan array
          mahasiswa_nims: mahasiswaNimsArray,
          nama_mahasiswa: mahasiswaNimsArray,
          ruangan_id: ruanganId,
          nama_ruangan: namaRuangan,
          use_ruangan: ruanganId !== null,
          kelompok_besar_id: null,
          dosen_id: null
        };
      });

      if (convertedData.length === 0) {
        setSeminarImportErrors(['File Excel tidak mengandung data Seminar Proposal. Pastikan file yang diupload adalah template Seminar Proposal.']);
        setSeminarImportFile(file);
        return;
      }

      // Validate data
      const validationErrors = validateNonBlokExcelData(convertedData);
      setSeminarCellErrors(validationErrors);

      setSeminarImportData(convertedData);
      seminarImportDataRef.current = convertedData;
      setSeminarImportFile(file);

    } catch (error: any) {
      setSeminarImportErrors([error.message || 'Terjadi kesalahan saat membaca file Excel']);
      setSeminarImportFile(file);
    }
  };

  // Submit import Excel untuk Seminar Proposal
  const handleSeminarSubmitImport = async () => {
    if (!kode || seminarImportData.length === 0) return;

    setIsSeminarImporting(true);
    setSeminarImportErrors([]);

    try {
      // Final validation
      const validationErrors = validateNonBlokExcelData(seminarImportData);
      if (validationErrors.length > 0) {
        setSeminarCellErrors(validationErrors);
        setIsSeminarImporting(false);
        return;
      }

      // Transform data for API
      const apiData = seminarImportData.map(row => ({
        tanggal: row.tanggal,
        jam_mulai: row.jam_mulai,
        jam_selesai: row.jam_selesai,
        jenis_baris: 'seminar_proposal',
        jumlah_sesi: row.jumlah_sesi,
        pembimbing_id: row.pembimbing_id,
        komentator_ids: row.komentator_ids,
        mahasiswa_nims: row.mahasiswa_nims,
        ruangan_id: row.ruangan_id,
        use_ruangan: row.ruangan_id !== null
      }));

      // Send to API
      const response = await api.post(`/non-blok-non-csr/jadwal/${kode}/import`, {
        data: apiData
      });

      if (response.data.success) {
        setSeminarImportedCount(seminarImportData.length);
        setShowSeminarUploadModal(false);
        // Reset semua state setelah import berhasil
        setSeminarImportData([]);
        seminarImportDataRef.current = [];
        setSeminarImportErrors([]);
        setSeminarCellErrors([]);
        setSeminarEditingCell(null);
        setSeminarImportFile(null);
        setSeminarImportPage(1);
        if (seminarFileInputRef.current) {
          seminarFileInputRef.current.value = '';
        }
        await fetchBatchData();
      } else {
        setSeminarImportErrors([response.data.message || 'Terjadi kesalahan saat mengimport data']);
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        const errorData = error.response.data;
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const cellErrors = errorData.errors.map((err: string) => {
            const rowMatch = err.match(/Baris\s+(\d+):/);
            const row = rowMatch ? parseInt(rowMatch[1]) : 0;
            return {
              row: row,
              field: 'api',
              message: err
            };
          });
          setSeminarCellErrors(cellErrors);
        } else {
          setSeminarImportErrors([errorData.message || 'Terjadi kesalahan validasi']);
        }
      } else {
        const errorMessage = error.response?.data?.message || 'Terjadi kesalahan saat mengimport data';
        setSeminarImportErrors([errorMessage]);
      }
    } finally {
      setIsSeminarImporting(false);
    }
  };

  // Close upload modal untuk Seminar Proposal
  const handleSeminarCloseUploadModal = () => {
    setShowSeminarUploadModal(false);
  };

  // Handler untuk hapus file Seminar Proposal
  const handleSeminarRemoveFile = () => {
    setSeminarImportFile(null);
    setSeminarImportData([]);
    setSeminarImportErrors([]);
    setSeminarCellErrors([]);
    setSeminarEditingCell(null);
    setSeminarImportPage(1);
    if (seminarFileInputRef.current) {
      seminarFileInputRef.current.value = '';
    }
  };

  // Handle upload file untuk Sidang Skripsi (dari modal upload)
  const handleSidangFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setSidangImportErrors(['Format file Excel tidak dikenali. Harap gunakan file .xlsx atau .xls']);
      setSidangImportFile(file);
      return;
    }

    // Process file
    await handleSidangProcessFile(file);
  };

  // Process file Excel untuk Sidang Skripsi
  const handleSidangProcessFile = async (file: File) => {
    setSidangImportErrors([]);
    setSidangCellErrors([]);

    try {
      const { headers, data: excelData } = await readNonBlokExcelFile(file);

      // Validate headers untuk Sidang Skripsi (menerima header dengan NIM atau Nama)
      // Penguji sekarang menggunakan 1 kolom saja (bukan 2 kolom terpisah)
      const expectedHeaders = ['Tanggal', 'Jam Mulai', 'Sesi', 'Pembimbing', 'Penguji', 'Ruangan'];
      const mahasiswaHeader = headers.find(h => h.toLowerCase().includes('mahasiswa'));
      const headerMatch = expectedHeaders.every(header => headers.includes(header)) && mahasiswaHeader !== undefined;

      if (!headerMatch) {
        setSidangImportErrors(['Template tidak valid. Pastikan menggunakan template dari aplikasi ini.']);
        setSidangImportFile(file);
        return;
      }

      if (excelData.length === 0) {
        setSidangImportErrors(["File Excel kosong atau tidak memiliki data"]);
        setSidangImportFile(file);
        return;
      }

      // Convert Excel data to our format
      const convertedData = excelData.map((row: any[], index: number) => {
        const tanggal = row[0] || '';
        const jamMulaiRaw = row[1] || '';
        const jamMulai = convertTimeFormat(jamMulaiRaw);
        const jumlahSesi = parseInt(row[2]) || 0;
        const jamSelesai = hitungJamSelesai(jamMulai, jumlahSesi);
        const namaPembimbing = row[3] || '';
        const namaPenguji = row[4] || ''; // Sekarang 1 kolom saja (bukan 2 kolom terpisah)
        const mahasiswaNims = row[5] || ''; // Index bergeser karena penguji jadi 1 kolom
        const namaRuangan = row[6] || ''; // Index bergeser

        // Find pembimbing
        const pembimbing = dosenList.find(d =>
          d.name.toLowerCase() === namaPembimbing.toLowerCase() ||
          d.id.toString() === namaPembimbing
        );
        const pembimbingId = pembimbing?.id || null;

        // Helper untuk parse dosen names ke IDs (gunakan backslash sebagai pemisah)
        // Gunakan backslash karena beberapa dosen memiliki gelar dengan koma (contoh: Gustiwanan spd, mpd, spg)
        const parseDosenNames = (dosenStr: string) => {
          if (!dosenStr || dosenStr.trim() === "") return [];
          const dosenNames = dosenStr
            .split("\\")
            .map((n: string) => n.trim())
            .filter((n: string) => n);
          const dosenIds: number[] = [];
          dosenNames.forEach((namaDosen: string) => {
            const dosen = dosenList.find(
              (d) => d.name.toLowerCase() === namaDosen.toLowerCase() ||
                d.id.toString() === namaDosen
            );
            if (dosen) {
              dosenIds.push(dosen.id);
            }
          });
          return dosenIds;
        };

        // Parse penguji (bisa multiple dengan backslash separator)
        const pengujiIds = parseDosenNames(namaPenguji);

        // Parse mahasiswa - bisa berupa nama atau NIM (dipisah koma)
        // Coba cari berdasarkan nama dulu, jika tidak ditemukan coba sebagai NIM
        const mahasiswaInputs = mahasiswaNims.split(',').map(input => input.trim()).filter(Boolean);
        const mahasiswaNimsArray: string[] = [];

        for (const input of mahasiswaInputs) {
          // Coba cari berdasarkan nama
          const mahasiswaByName = mahasiswaList.find(m =>
            m.name.toLowerCase() === input.toLowerCase()
          );

          if (mahasiswaByName) {
            mahasiswaNimsArray.push(mahasiswaByName.nim);
          } else {
            // Jika tidak ditemukan sebagai nama, anggap sebagai NIM
            mahasiswaNimsArray.push(input);
          }
        }

        // Find ruangan
        const ruangan = ruanganList.find(r =>
          r.nama.toLowerCase() === namaRuangan.toLowerCase() ||
          r.id.toString() === namaRuangan
        );
        const ruanganId = ruangan?.id || null;

        return {
          tanggal: tanggal,
          jam_mulai: jamMulai,
          jam_selesai: jamSelesai,
          jenis_baris: 'sidang_skripsi' as const,
          jumlah_sesi: jumlahSesi,
          pembimbing_id: pembimbingId,
          nama_pembimbing: namaPembimbing,
          penguji_ids: pengujiIds,
          nama_penguji: namaPenguji, // Sekarang string saja, bukan array
          mahasiswa_nims: mahasiswaNimsArray,
          nama_mahasiswa: mahasiswaNimsArray,
          ruangan_id: ruanganId,
          nama_ruangan: namaRuangan,
          use_ruangan: ruanganId !== null,
          kelompok_besar_id: null,
          dosen_id: null
        };
      });

      if (convertedData.length === 0) {
        setSidangImportErrors(['File Excel tidak mengandung data Sidang Skripsi. Pastikan file yang diupload adalah template Sidang Skripsi.']);
        setSidangImportFile(file);
        return;
      }

      // Validate data
      const validationErrors = validateNonBlokExcelData(convertedData);
      setSidangCellErrors(validationErrors);

      setSidangImportData(convertedData);
      sidangImportDataRef.current = convertedData;
      setSidangImportFile(file);

    } catch (error: any) {
      setSidangImportErrors([error.message || 'Terjadi kesalahan saat membaca file Excel']);
      setSidangImportFile(file);
    }
  };

  // Submit import Excel untuk Sidang Skripsi
  const handleSidangSubmitImport = async () => {
    if (!kode || sidangImportData.length === 0) return;

    setIsSidangImporting(true);
    setSidangImportErrors([]);

    try {
      // Final validation
      const validationErrors = validateNonBlokExcelData(sidangImportData);
      if (validationErrors.length > 0) {
        setSidangCellErrors(validationErrors);
        setIsSidangImporting(false);
        return;
      }

      // Transform data for API
      const apiData = sidangImportData.map(row => ({
        tanggal: row.tanggal,
        jam_mulai: row.jam_mulai,
        jam_selesai: row.jam_selesai,
        jenis_baris: 'sidang_skripsi',
        jumlah_sesi: row.jumlah_sesi,
        pembimbing_id: row.pembimbing_id,
        penguji_ids: row.penguji_ids,
        mahasiswa_nims: row.mahasiswa_nims,
        ruangan_id: row.ruangan_id,
        use_ruangan: row.ruangan_id !== null
      }));

      // Send to API
      const response = await api.post(`/non-blok-non-csr/jadwal/${kode}/import`, {
        data: apiData
      });

      if (response.data.success) {
        setSidangImportedCount(sidangImportData.length);
        setShowSidangUploadModal(false);
        // Reset semua state setelah import berhasil
        setSidangImportData([]);
        sidangImportDataRef.current = [];
        setSidangImportErrors([]);
        setSidangCellErrors([]);
        setSidangEditingCell(null);
        setSidangImportFile(null);
        setSidangImportPage(1);
        if (sidangFileInputRef.current) {
          sidangFileInputRef.current.value = '';
        }
        await fetchBatchData();
      } else {
        setSidangImportErrors([response.data.message || 'Terjadi kesalahan saat mengimport data']);
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        const errorData = error.response.data;
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const cellErrors = errorData.errors.map((err: string) => {
            const rowMatch = err.match(/Baris\s+(\d+):/);
            const row = rowMatch ? parseInt(rowMatch[1]) : 0;
            return {
              row: row,
              field: 'api',
              message: err
            };
          });
          setSidangCellErrors(cellErrors);
        } else {
          setSidangImportErrors([errorData.message || 'Terjadi kesalahan validasi']);
        }
      } else {
        const errorMessage = error.response?.data?.message || 'Terjadi kesalahan saat mengimport data';
        setSidangImportErrors([errorMessage]);
      }
    } finally {
      setIsSidangImporting(false);
    }
  };

  // Close upload modal untuk Sidang Skripsi
  const handleSidangCloseUploadModal = () => {
    setShowSidangUploadModal(false);
  };

  // Handler untuk hapus file Sidang Skripsi
  const handleSidangRemoveFile = () => {
    setSidangImportFile(null);
    setSidangImportData([]);
    setSidangImportErrors([]);
    setSidangCellErrors([]);
    setSidangEditingCell(null);
    setSidangImportPage(1);
    if (sidangFileInputRef.current) {
      sidangFileInputRef.current.value = '';
    }
  };

  // Edit cell untuk Materi Kuliah
  const handleMateriEditCell = (rowIndex: number, field: string, value: any) => {
    const updatedData = [...materiImportData];

    // Jika field adalah nama_dosen, simpan nama yang diketik user (tidak auto-fill)
    if (field === 'nama_dosen') {
      updatedData[rowIndex].nama_dosen = value;
      // Cari ID-nya untuk validasi (tapi tidak mengubah nama yang diketik user)
      const dosenOption = dosenList.find(d =>
        d.name.toLowerCase() === value.toLowerCase() ||
        `${d.name} (${d.nid})`.toLowerCase() === value.toLowerCase() ||
        d.nid === value
      );
      updatedData[rowIndex].dosen_id = dosenOption ? dosenOption.id : null;
    }
    // Jika field adalah nama_ruangan, simpan nama yang diketik user (tidak auto-fill)
    else if (field === 'nama_ruangan') {
      updatedData[rowIndex].nama_ruangan = value;
      // Cari ID-nya untuk validasi (tapi tidak mengubah nama yang diketik user)
      const ruanganOption = ruanganList.find(r =>
        r.nama.toLowerCase() === value.toLowerCase() ||
        r.id.toString() === value
      );
      updatedData[rowIndex].ruangan_id = ruanganOption ? ruanganOption.id : null;
    }
    // Field lainnya langsung di-update
    else {
      updatedData[rowIndex] = { ...updatedData[rowIndex], [field]: value };
    }

    if (field === 'jam_mulai' || field === 'jumlah_sesi') {
      const jamMulai = field === 'jam_mulai' ? value : updatedData[rowIndex].jam_mulai;
      const jumlahSesi = field === 'jumlah_sesi' ? value : updatedData[rowIndex].jumlah_sesi;
      updatedData[rowIndex].jam_selesai = hitungJamSelesai(jamMulai, jumlahSesi);
    }

    setMateriImportData(updatedData);

    // Clear cell error untuk field yang sedang di-edit (hanya untuk baris yang sedang di-edit)
    const rowNumber = rowIndex + 1;
    setMateriCellErrors((prev) =>
      prev.filter((err) => {
        // Hapus error untuk baris yang sedang di-edit
        if (err.row === rowNumber) {
          if (field === 'nama_dosen' && err.field === 'dosen_id') return false;
          if (field === 'nama_ruangan' && err.field === 'ruangan_id') return false;
          if (err.field === field) return false;
        }
        return true; // Keep errors for other rows
      })
    );

    // Re-validate field yang sedang di-edit
    const row = updatedData[rowIndex];

    if (field === 'nama_dosen') {
      if (!value || value.trim() === '') {
        setMateriCellErrors((prev) => [
          ...prev,
          { row: rowNumber, field: 'dosen_id', message: `Baris ${rowNumber}: Dosen wajib diisi` }
        ]);
      } else {
        const dosenOption = dosenList.find(d =>
          d.name.toLowerCase() === value.toLowerCase() ||
          `${d.name} (${d.nid})`.toLowerCase() === value.toLowerCase() ||
          d.nid === value
        );
        if (!dosenOption) {
          setMateriCellErrors((prev) => [
            ...prev,
            { row: rowNumber, field: 'dosen_id', message: `Baris ${rowNumber}: Dosen "${value}" tidak ditemukan` }
          ]);
        }
      }
    } else if (field === 'nama_ruangan') {
      if (!value || value.trim() === '') {
        setMateriCellErrors((prev) => [
          ...prev,
          { row: rowNumber, field: 'ruangan_id', message: `Baris ${rowNumber}: Ruangan wajib diisi` }
        ]);
      } else {
        const ruanganOption = ruanganList.find(r =>
          r.nama.toLowerCase() === value.toLowerCase() ||
          r.id.toString() === value
        );
        if (!ruanganOption) {
          setMateriCellErrors((prev) => [
            ...prev,
            { row: rowNumber, field: 'ruangan_id', message: `Baris ${rowNumber}: Ruangan "${value}" tidak ditemukan` }
          ]);
        }
      }
    } else {
      // Validasi lengkap untuk field lainnya
      const validationErrors = validateNonBlokExcelData(updatedData);
      setMateriCellErrors(validationErrors);
    }
  };

  const handleMateriFinishEdit = () => {
    setMateriEditingCell(null);
  };

  // Edit cell untuk Agenda Khusus
  const handleAgendaEditCell = (rowIndex: number, field: string, value: any) => {
    const updatedData = [...agendaImportData];

    // Jika field adalah nama_ruangan, simpan nama yang diketik user (tidak auto-fill)
    if (field === 'nama_ruangan') {
      updatedData[rowIndex].nama_ruangan = value;
      // Cari ID-nya untuk validasi (tapi tidak mengubah nama yang diketik user)
      const ruanganOption = ruanganList.find(r =>
        r.nama.toLowerCase() === value.toLowerCase() ||
        r.id.toString() === value
      );
      updatedData[rowIndex].ruangan_id = ruanganOption ? ruanganOption.id : null;
    }
    // Field lainnya langsung di-update
    else {
      updatedData[rowIndex] = { ...updatedData[rowIndex], [field]: value };
    }

    if (field === 'jam_mulai' || field === 'jumlah_sesi') {
      const jamMulai = field === 'jam_mulai' ? value : updatedData[rowIndex].jam_mulai;
      const jumlahSesi = field === 'jumlah_sesi' ? value : updatedData[rowIndex].jumlah_sesi;
      updatedData[rowIndex].jam_selesai = hitungJamSelesai(jamMulai, jumlahSesi);
    }

    setAgendaImportData(updatedData);

    // Clear cell error untuk field yang sedang di-edit (hanya untuk baris yang sedang di-edit)
    const rowNumber = rowIndex + 1;
    setAgendaCellErrors((prev) =>
      prev.filter((err) => {
        // Hapus error untuk baris yang sedang di-edit
        if (err.row === rowNumber) {
          if (field === 'nama_ruangan' && err.field === 'ruangan_id') return false;
          if (err.field === field) return false;
        }
        return true; // Keep errors for other rows
      })
    );

    // Re-validate field yang sedang di-edit
    const row = updatedData[rowIndex];

    if (field === 'nama_ruangan') {
      if (value && value.trim() !== '') {
        const ruanganOption = ruanganList.find(r =>
          r.nama.toLowerCase() === value.toLowerCase() ||
          r.id.toString() === value
        );
        if (!ruanganOption) {
          setAgendaCellErrors((prev) => [
            ...prev,
            { row: rowNumber, field: 'ruangan_id', message: `Baris ${rowNumber}: Ruangan "${value}" tidak ditemukan` }
          ]);
        }
      }
    } else {
      // Validasi lengkap untuk field lainnya
      const validationErrors = validateNonBlokExcelData(updatedData);
      setAgendaCellErrors(validationErrors);
    }
  };

  const handleAgendaFinishEdit = () => {
    setAgendaEditingCell(null);
  };

  // Edit cell untuk Seminar Proposal
  const handleSeminarEditCell = (rowIndex: number, field: string, value: any) => {
    const updatedData = [...seminarImportData];

    // Jika field adalah nama_pembimbing, simpan nama yang diketik user
    if (field === 'nama_pembimbing') {
      updatedData[rowIndex].nama_pembimbing = value;
      // Cek apakah ada koma (berarti lebih dari 1 pembimbing) - jika ada, langsung set null dan biarkan validasi yang handle
      const pembimbingNames = typeof value === 'string' ? value.split(',').map((n: string) => n.trim()).filter(Boolean) : [value];
      if (pembimbingNames.length > 1) {
        updatedData[rowIndex].pembimbing_id = null; // Akan divalidasi nanti
      } else {
        const pembimbingOption = dosenList.find(d =>
          d.name.toLowerCase() === value.toLowerCase() ||
          `${d.name} (${d.nid})`.toLowerCase() === value.toLowerCase() ||
          d.nid === value
        );
        updatedData[rowIndex].pembimbing_id = pembimbingOption ? pembimbingOption.id : null;
      }
    }
    // Jika field adalah nama_komentator, simpan nama yang diketik user (sebagai string, bukan array)
    else if (field === 'nama_komentator') {
      // Simpan sebagai string untuk memungkinkan user mengetik spasi dan koma dengan bebas
      updatedData[rowIndex].nama_komentator = value;

      // Konversi ke array dan cari ID hanya untuk validasi, tapi jangan simpan sebagai array
      const komentatorNames = typeof value === 'string' ? value.split(',').map((n: string) => n.trim()).filter(Boolean) : (Array.isArray(value) ? value : []);
      const komentatorIds: number[] = [];
      komentatorNames.forEach((nama: string) => {
        if (nama && nama.trim() !== '') {
          const komentatorOption = dosenList.find(d =>
            d.name.toLowerCase() === nama.toLowerCase() ||
            `${d.name} (${d.nid})`.toLowerCase() === nama.toLowerCase() ||
            d.nid === nama
          );
          if (komentatorOption) {
            komentatorIds.push(komentatorOption.id);
          }
        }
      });
      updatedData[rowIndex].komentator_ids = komentatorIds;
    }
    // Jika field adalah nama_mahasiswa, simpan nama yang diketik user (sebagai string, bukan array)
    else if (field === 'nama_mahasiswa') {
      // Simpan sebagai string untuk memungkinkan user mengetik spasi dan koma dengan bebas
      updatedData[rowIndex].nama_mahasiswa = value;

      // Konversi ke array dan cari NIM hanya untuk validasi, tapi jangan simpan sebagai array
      const mahasiswaInputs = typeof value === 'string' ? value.split(',').map((n: string) => n.trim()).filter(Boolean) : (Array.isArray(value) ? value : []);

      // Konversi nama ke NIM jika perlu
      const mahasiswaNims: string[] = [];
      mahasiswaInputs.forEach((input: string) => {
        if (input && input.trim() !== '') {
          // Coba cari berdasarkan nama dulu
          const mahasiswaByName = mahasiswaList.find(m =>
            m.name.toLowerCase() === input.toLowerCase()
          );

          if (mahasiswaByName) {
            mahasiswaNims.push(mahasiswaByName.nim);
          } else {
            // Jika tidak ditemukan sebagai nama, anggap sebagai NIM
            mahasiswaNims.push(input);
          }
        }
      });
      updatedData[rowIndex].mahasiswa_nims = mahasiswaNims;
    }
    // Jika field adalah nama_ruangan, simpan nama yang diketik user
    else if (field === 'nama_ruangan') {
      updatedData[rowIndex].nama_ruangan = value;
      const ruanganOption = ruanganList.find(r =>
        r.nama.toLowerCase() === value.toLowerCase() ||
        r.id.toString() === value
      );
      updatedData[rowIndex].ruangan_id = ruanganOption ? ruanganOption.id : null;
    }
    // Field lainnya langsung di-update
    else {
      updatedData[rowIndex] = { ...updatedData[rowIndex], [field]: value };
    }

    if (field === 'jam_mulai' || field === 'jumlah_sesi') {
      const jamMulai = field === 'jam_mulai' ? value : updatedData[rowIndex].jam_mulai;
      const jumlahSesi = field === 'jumlah_sesi' ? value : updatedData[rowIndex].jumlah_sesi;
      updatedData[rowIndex].jam_selesai = hitungJamSelesai(jamMulai, jumlahSesi);
    }

    // Clear cell error untuk field yang sedang di-edit sebelum update data
    const rowNumber = rowIndex + 1;
    setSeminarCellErrors((prev) =>
      prev.filter((err) => {
        if (err.row === rowNumber) {
          if (field === 'nama_pembimbing' && err.field === 'pembimbing_id') return false;
          if (field === 'nama_komentator' && err.field === 'komentator_ids') return false;
          if (field === 'nama_mahasiswa' && err.field === 'mahasiswa_nims') return false;
          if (field === 'nama_ruangan' && err.field === 'ruangan_id') return false;
          if (err.field === field) return false;
        }
        return true;
      })
    );

    setSeminarImportData(updatedData);
    seminarImportDataRef.current = updatedData;

    // Re-validate field yang sedang di-edit
    const row = updatedData[rowIndex];

    if (field === 'nama_pembimbing') {
      if (!value || value.trim() === '') {
        setSeminarCellErrors((prev) => [
          ...prev,
          { row: rowNumber, field: 'pembimbing_id', message: `Baris ${rowNumber}: Pembimbing wajib diisi` }
        ]);
      } else {
        // Cek apakah ada koma (berarti lebih dari 1 pembimbing)
        const pembimbingNames = typeof value === 'string' ? value.split(',').map((n: string) => n.trim()).filter(Boolean) : [value];
        if (pembimbingNames.length > 1) {
          setSeminarCellErrors((prev) => [
            ...prev,
            { row: rowNumber, field: 'pembimbing_id', message: `Baris ${rowNumber}: Pembimbing maksimal 1` }
          ]);
        } else {
          const pembimbingOption = dosenList.find(d =>
            d.name.toLowerCase() === value.toLowerCase() ||
            `${d.name} (${d.nid})`.toLowerCase() === value.toLowerCase() ||
            d.nid === value
          );
          if (!pembimbingOption) {
            setSeminarCellErrors((prev) => [
              ...prev,
              { row: rowNumber, field: 'pembimbing_id', message: `Baris ${rowNumber}: Pembimbing "${value}" tidak ditemukan` }
            ]);
          } else {
            // Validasi: Cek apakah pembimbing yang dipilih sudah ada di komentator
            if (row.komentator_ids && row.komentator_ids.includes(pembimbingOption.id)) {
              const pembimbingName = pembimbingOption.name;
              setSeminarCellErrors((prev) => [
                ...prev,
                { row: rowNumber, field: 'pembimbing_id', message: `Baris ${rowNumber}: Dosen "${pembimbingName}" sudah dipilih sebagai Komentator. Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Komentator` }
              ]);
            }
          }
        }
      }
    } else if (field === 'nama_komentator') {
      // Parse string menjadi array untuk validasi
      const komentatorNames = typeof value === 'string'
        ? value.split(',').map((n: string) => n.trim()).filter(Boolean)
        : (Array.isArray(value) ? value : []);

      if (komentatorNames.length === 0) {
        setSeminarCellErrors((prev) => [
          ...prev,
          { row: rowNumber, field: 'komentator_ids', message: `Baris ${rowNumber}: Komentator wajib diisi minimal 1` }
        ]);
      } else if (komentatorNames.length > 2) {
        setSeminarCellErrors((prev) => [
          ...prev,
          { row: rowNumber, field: 'komentator_ids', message: `Baris ${rowNumber}: Komentator maksimal 2` }
        ]);
      } else {
        // Validasi apakah setiap komentator valid (ada di dosenList)
        const invalidKomentators: string[] = [];
        komentatorNames.forEach((nama: string) => {
          if (nama && nama.trim() !== '') {
            const komentatorOption = dosenList.find(d =>
              d.name.toLowerCase() === nama.toLowerCase() ||
              `${d.name} (${d.nid})`.toLowerCase() === nama.toLowerCase() ||
              d.nid === nama
            );
            if (!komentatorOption) {
              invalidKomentators.push(nama);
            }
          }
        });

        if (invalidKomentators.length > 0) {
          setSeminarCellErrors((prev) => [
            ...prev,
            { row: rowNumber, field: 'komentator_ids', message: `Baris ${rowNumber}: Komentator "${invalidKomentators.join(', ')}" tidak ditemukan` }
          ]);
        } else {
          // Validasi: Cek apakah ada komentator yang sama dengan pembimbing
          const komentatorIds: number[] = [];
          komentatorNames.forEach((nama: string) => {
            if (nama && nama.trim() !== '') {
              const komentatorOption = dosenList.find(d =>
                d.name.toLowerCase() === nama.toLowerCase() ||
                `${d.name} (${d.nid})`.toLowerCase() === nama.toLowerCase() ||
                d.nid === nama
              );
              if (komentatorOption) {
                komentatorIds.push(komentatorOption.id);
              }
            }
          });

          if (row.pembimbing_id && komentatorIds.includes(row.pembimbing_id)) {
            const pembimbingDosen = dosenList.find(d => d.id === row.pembimbing_id);
            const pembimbingName = pembimbingDosen ? pembimbingDosen.name : 'N/A';
            setSeminarCellErrors((prev) => [
              ...prev,
              { row: rowNumber, field: 'komentator_ids', message: `Baris ${rowNumber}: Dosen "${pembimbingName}" sudah dipilih sebagai Pembimbing. Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Komentator` }
            ]);
          }
        }
      }
    } else if (field === 'nama_mahasiswa') {
      // Parse string menjadi array untuk validasi
      const mahasiswaInputs = typeof value === 'string'
        ? value.split(',').map((n: string) => n.trim()).filter(Boolean)
        : (Array.isArray(value) ? value : []);

      if (mahasiswaInputs.length === 0) {
        setSeminarCellErrors((prev) => [
          ...prev,
          { row: rowNumber, field: 'mahasiswa_nims', message: `Baris ${rowNumber}: Mahasiswa wajib diisi minimal 1` }
        ]);
      } else {
        // Validasi apakah semua input valid (nama atau NIM)
        const invalidInputs: string[] = [];
        mahasiswaInputs.forEach((input: string) => {
          if (input && input.trim() !== '') {
            // Cek apakah input adalah nama yang valid atau NIM yang valid
            const mahasiswaByName = mahasiswaList.find(m =>
              m.name.toLowerCase() === input.toLowerCase()
            );
            const mahasiswaByNim = mahasiswaList.find(m =>
              m.nim.toLowerCase() === input.toLowerCase()
            );

            if (!mahasiswaByName && !mahasiswaByNim) {
              invalidInputs.push(input);
            }
          }
        });

        if (invalidInputs.length > 0) {
          setSeminarCellErrors((prev) => [
            ...prev,
            { row: rowNumber, field: 'mahasiswa_nims', message: `Baris ${rowNumber}: Mahasiswa "${invalidInputs.join(', ')}" tidak ditemukan` }
          ]);
        }
      }
    } else if (field === 'nama_ruangan') {
      if (value && value.trim() !== '') {
        const ruanganOption = ruanganList.find(r =>
          r.nama.toLowerCase() === value.toLowerCase() ||
          r.id.toString() === value
        );
        if (!ruanganOption) {
          setSeminarCellErrors((prev) => [
            ...prev,
            { row: rowNumber, field: 'ruangan_id', message: `Baris ${rowNumber}: Ruangan "${value}" tidak ditemukan` }
          ]);
        } else {
          // Validasi kapasitas ruangan untuk seminar proposal: pembimbing (1) + komentator + mahasiswa
          const jumlahPembimbing = row.pembimbing_id ? 1 : 0;
          const jumlahKomentator = (row.komentator_ids || []).length;
          const jumlahMahasiswa = (row.mahasiswa_nims || []).length;
          const totalPeserta = jumlahPembimbing + jumlahKomentator + jumlahMahasiswa;

          if (totalPeserta > 0 && ruanganOption.kapasitas < totalPeserta) {
            const detailPeserta = [];
            if (jumlahPembimbing > 0) detailPeserta.push(`${jumlahPembimbing} pembimbing`);
            if (jumlahKomentator > 0) detailPeserta.push(`${jumlahKomentator} komentator`);
            if (jumlahMahasiswa > 0) detailPeserta.push(`${jumlahMahasiswa} mahasiswa`);
            const detailPesertaStr = detailPeserta.join(' + ');

            setSeminarCellErrors((prev) => [
              ...prev,
              { row: rowNumber, field: 'ruangan_id', message: `Baris ${rowNumber}: Kapasitas ruangan ${ruanganOption.nama} (${ruanganOption.kapasitas}) tidak cukup untuk ${totalPeserta} orang (${detailPesertaStr})` }
            ]);
          }
        }
      }
    } else {
      // Validasi lengkap untuk field lainnya
      const validationErrors = validateNonBlokExcelData(updatedData);
      setSeminarCellErrors(validationErrors);
    }
  };

  const handleSeminarFinishEdit = () => {
    setSeminarEditingCell(null);
    // Lakukan validasi lengkap termasuk bentrok antar baris saat selesai edit
    // Gunakan ref untuk memastikan menggunakan data terbaru
    const validationErrors = validateNonBlokExcelData(seminarImportDataRef.current);
    setSeminarCellErrors(validationErrors);
  };

  // Edit cell untuk Sidang Skripsi
  const handleSidangEditCell = (rowIndex: number, field: string, value: any) => {
    const updatedData = [...sidangImportData];

    // Jika field adalah nama_pembimbing, simpan nama yang diketik user
    if (field === 'nama_pembimbing') {
      updatedData[rowIndex].nama_pembimbing = value;
      // Cek apakah ada koma (berarti lebih dari 1 pembimbing) - jika ada, langsung set null dan biarkan validasi yang handle
      const pembimbingNames = typeof value === 'string' ? value.split(',').map((n: string) => n.trim()).filter(Boolean) : [value];
      if (pembimbingNames.length > 1) {
        updatedData[rowIndex].pembimbing_id = null; // Akan divalidasi nanti
      } else {
        const pembimbingOption = dosenList.find(d =>
          d.name.toLowerCase() === value.toLowerCase() ||
          `${d.name} (${d.nid})`.toLowerCase() === value.toLowerCase() ||
          d.nid === value
        );
        updatedData[rowIndex].pembimbing_id = pembimbingOption ? pembimbingOption.id : null;
      }
    }
    // Jika field adalah nama_penguji, simpan nama yang diketik user (sebagai string, bukan array)
    else if (field === 'nama_penguji') {
      // Simpan sebagai string untuk memungkinkan user mengetik spasi dan koma dengan bebas
      updatedData[rowIndex].nama_penguji = value;

      // Konversi ke array dan cari ID hanya untuk validasi, tapi jangan simpan sebagai array
      const pengujiNames = typeof value === 'string' ? value.split(',').map((n: string) => n.trim()).filter(Boolean) : (Array.isArray(value) ? value : []);
      const pengujiIds: number[] = [];
      pengujiNames.forEach((nama: string) => {
        if (nama && nama.trim() !== '') {
          const pengujiOption = dosenList.find(d =>
            d.name.toLowerCase() === nama.toLowerCase() ||
            `${d.name} (${d.nid})`.toLowerCase() === nama.toLowerCase() ||
            d.nid === nama
          );
          if (pengujiOption) {
            pengujiIds.push(pengujiOption.id);
          }
        }
      });
      updatedData[rowIndex].penguji_ids = pengujiIds;
    }
    // Jika field adalah nama_mahasiswa, simpan nama yang diketik user (sebagai string, bukan array)
    else if (field === 'nama_mahasiswa') {
      // Simpan sebagai string untuk memungkinkan user mengetik spasi dan koma dengan bebas
      updatedData[rowIndex].nama_mahasiswa = value;

      // Konversi ke array dan cari NIM hanya untuk validasi, tapi jangan simpan sebagai array
      const mahasiswaInputs = typeof value === 'string' ? value.split(',').map((n: string) => n.trim()).filter(Boolean) : (Array.isArray(value) ? value : []);

      // Konversi nama ke NIM jika perlu
      const mahasiswaNims: string[] = [];
      mahasiswaInputs.forEach((input: string) => {
        if (input && input.trim() !== '') {
          // Coba cari berdasarkan nama dulu
          const mahasiswaByName = mahasiswaList.find(m =>
            m.name.toLowerCase() === input.toLowerCase()
          );

          if (mahasiswaByName) {
            mahasiswaNims.push(mahasiswaByName.nim);
          } else {
            // Jika tidak ditemukan sebagai nama, anggap sebagai NIM
            mahasiswaNims.push(input);
          }
        }
      });
      updatedData[rowIndex].mahasiswa_nims = mahasiswaNims;
    }
    // Jika field adalah nama_ruangan, simpan nama yang diketik user
    else if (field === 'nama_ruangan') {
      updatedData[rowIndex].nama_ruangan = value;
      const ruanganOption = ruanganList.find(r =>
        r.nama.toLowerCase() === value.toLowerCase() ||
        r.id.toString() === value
      );
      updatedData[rowIndex].ruangan_id = ruanganOption ? ruanganOption.id : null;
    }
    // Field lainnya langsung di-update
    else {
      updatedData[rowIndex] = { ...updatedData[rowIndex], [field]: value };
    }

    if (field === 'jam_mulai' || field === 'jumlah_sesi') {
      const jamMulai = field === 'jam_mulai' ? value : updatedData[rowIndex].jam_mulai;
      const jumlahSesi = field === 'jumlah_sesi' ? value : updatedData[rowIndex].jumlah_sesi;
      updatedData[rowIndex].jam_selesai = hitungJamSelesai(jamMulai, jumlahSesi);
    }

    setSidangImportData(updatedData);
    sidangImportDataRef.current = updatedData;

    // Clear cell error untuk field yang sedang di-edit sebelum update data
    const rowNumber = rowIndex + 1;
    setSidangCellErrors((prev) =>
      prev.filter((err) => {
        if (err.row === rowNumber) {
          if (field === 'nama_pembimbing' && err.field === 'pembimbing_id') return false;
          if (field === 'nama_penguji' && err.field === 'penguji_ids') return false;
          if (field === 'nama_mahasiswa' && err.field === 'mahasiswa_nims') return false;
          if (field === 'nama_ruangan' && err.field === 'ruangan_id') return false;
          if (err.field === field) return false;
        }
        return true;
      })
    );

    setSidangImportData(updatedData);
    sidangImportDataRef.current = updatedData;

    // Re-validate field yang sedang di-edit
    const row = updatedData[rowIndex];

    if (field === 'nama_pembimbing') {
      if (!value || value.trim() === '') {
        setSidangCellErrors((prev) => [
          ...prev,
          { row: rowNumber, field: 'pembimbing_id', message: `Baris ${rowNumber}: Pembimbing wajib diisi` }
        ]);
      } else {
        // Cek apakah ada koma (berarti lebih dari 1 pembimbing)
        const pembimbingNames = typeof value === 'string' ? value.split(',').map((n: string) => n.trim()).filter(Boolean) : [value];
        if (pembimbingNames.length > 1) {
          setSidangCellErrors((prev) => [
            ...prev,
            { row: rowNumber, field: 'pembimbing_id', message: `Baris ${rowNumber}: Pembimbing maksimal 1` }
          ]);
        } else {
          const pembimbingOption = dosenList.find(d =>
            d.name.toLowerCase() === value.toLowerCase() ||
            `${d.name} (${d.nid})`.toLowerCase() === value.toLowerCase() ||
            d.nid === value
          );
          if (!pembimbingOption) {
            setSidangCellErrors((prev) => [
              ...prev,
              { row: rowNumber, field: 'pembimbing_id', message: `Baris ${rowNumber}: Pembimbing "${value}" tidak ditemukan` }
            ]);
          } else {
            // Validasi: Cek apakah pembimbing yang dipilih sudah ada di penguji
            if (row.penguji_ids && row.penguji_ids.includes(pembimbingOption.id)) {
              const pembimbingName = pembimbingOption.name;
              setSidangCellErrors((prev) => [
                ...prev,
                { row: rowNumber, field: 'pembimbing_id', message: `Baris ${rowNumber}: Dosen "${pembimbingName}" sudah dipilih sebagai Penguji. Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Penguji` }
              ]);
            }
          }
        }
      }
    } else if (field === 'nama_penguji') {
      // Parse string dengan backslash separator (gunakan backslash karena beberapa dosen memiliki gelar dengan koma)
      const pengujiNames = typeof value === 'string'
        ? value.split('\\').map((n: string) => n.trim()).filter(Boolean)
        : (Array.isArray(value) ? value : []);

      // Update penguji_ids berdasarkan nama yang valid
      const pengujiIds: number[] = [];
      pengujiNames.forEach((nama: string) => {
        if (nama && nama.trim() !== '') {
          const pengujiOption = dosenList.find(d =>
            d.name.toLowerCase() === nama.toLowerCase() ||
            `${d.name} (${d.nid})`.toLowerCase() === nama.toLowerCase() ||
            d.nid === nama
          );
          if (pengujiOption) {
            pengujiIds.push(pengujiOption.id);
          }
        }
      });
      updatedData[rowIndex].penguji_ids = pengujiIds;
      setSidangImportData(updatedData);
      sidangImportDataRef.current = updatedData;

      if (pengujiNames.length === 0) {
        setSidangCellErrors((prev) => [
          ...prev,
          { row: rowNumber, field: 'penguji_ids', message: `Baris ${rowNumber}: Penguji wajib diisi minimal 2` }
        ]);
      } else if (pengujiNames.length < 2) {
        setSidangCellErrors((prev) => [
          ...prev,
          { row: rowNumber, field: 'penguji_ids', message: `Baris ${rowNumber}: Penguji wajib diisi minimal 2` }
        ]);
      } else if (pengujiNames.length > 2) {
        setSidangCellErrors((prev) => [
          ...prev,
          { row: rowNumber, field: 'penguji_ids', message: `Baris ${rowNumber}: Penguji maksimal 2` }
        ]);
      } else {
        // Validasi apakah setiap penguji valid (ada di dosenList)
        const invalidPengujis: string[] = [];
        pengujiNames.forEach((nama: string) => {
          if (nama && nama.trim() !== '') {
            const pengujiOption = dosenList.find(d =>
              d.name.toLowerCase() === nama.toLowerCase() ||
              `${d.name} (${d.nid})`.toLowerCase() === nama.toLowerCase() ||
              d.nid === nama
            );
            if (!pengujiOption) {
              invalidPengujis.push(nama);
            }
          }
        });

        if (invalidPengujis.length > 0) {
          setSidangCellErrors((prev) => [
            ...prev,
            { row: rowNumber, field: 'penguji_ids', message: `Baris ${rowNumber}: Penguji "${invalidPengujis.join(', ')}" tidak ditemukan` }
          ]);
        } else {
          // Validasi: Cek apakah ada penguji yang sama dengan pembimbing
          const pengujiIds: number[] = [];
          pengujiNames.forEach((nama: string) => {
            if (nama && nama.trim() !== '') {
              const pengujiOption = dosenList.find(d =>
                d.name.toLowerCase() === nama.toLowerCase() ||
                `${d.name} (${d.nid})`.toLowerCase() === nama.toLowerCase() ||
                d.nid === nama
              );
              if (pengujiOption) {
                pengujiIds.push(pengujiOption.id);
              }
            }
          });

          if (row.pembimbing_id && pengujiIds.includes(row.pembimbing_id)) {
            const pembimbingDosen = dosenList.find(d => d.id === row.pembimbing_id);
            const pembimbingName = pembimbingDosen ? pembimbingDosen.name : 'N/A';
            setSidangCellErrors((prev) => [
              ...prev,
              { row: rowNumber, field: 'penguji_ids', message: `Baris ${rowNumber}: Dosen "${pembimbingName}" sudah dipilih sebagai Pembimbing. Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Penguji` }
            ]);
          }
        }
      }
    } else if (field === 'nama_mahasiswa') {
      // Parse string menjadi array untuk validasi
      const mahasiswaInputs = typeof value === 'string'
        ? value.split(',').map((n: string) => n.trim()).filter(Boolean)
        : (Array.isArray(value) ? value : []);

      // Konversi nama ke NIM jika perlu
      const mahasiswaNims: string[] = [];
      mahasiswaInputs.forEach((input: string) => {
        if (input && input.trim() !== '') {
          // Coba cari berdasarkan nama dulu
          const mahasiswaByName = mahasiswaList.find(m =>
            m.name.toLowerCase() === input.toLowerCase()
          );

          if (mahasiswaByName) {
            mahasiswaNims.push(mahasiswaByName.nim);
          } else {
            // Jika tidak ditemukan sebagai nama, coba cari berdasarkan NIM
            const mahasiswaByNim = mahasiswaList.find(m =>
              m.nim.toLowerCase() === input.toLowerCase()
            );

            if (mahasiswaByNim) {
              mahasiswaNims.push(mahasiswaByNim.nim);
            } else {
              // Jika tidak ditemukan, anggap sebagai NIM (akan divalidasi nanti)
              mahasiswaNims.push(input);
            }
          }
        }
      });
      updatedData[rowIndex].mahasiswa_nims = mahasiswaNims;
      setSidangImportData(updatedData);
      sidangImportDataRef.current = updatedData;

      if (mahasiswaInputs.length === 0) {
        setSidangCellErrors((prev) => [
          ...prev,
          { row: rowNumber, field: 'mahasiswa_nims', message: `Baris ${rowNumber}: Mahasiswa wajib diisi` }
        ]);
      } else {
        // Validasi apakah setiap mahasiswa valid (ada di mahasiswaList)
        const invalidInputs: string[] = [];
        mahasiswaInputs.forEach((input: string) => {
          if (input && input.trim() !== '') {
            const mahasiswaByName = mahasiswaList.find(m =>
              m.name.toLowerCase() === input.toLowerCase()
            );
            const mahasiswaByNim = mahasiswaList.find(m =>
              m.nim.toLowerCase() === input.toLowerCase()
            );

            if (!mahasiswaByName && !mahasiswaByNim) {
              invalidInputs.push(input);
            }
          }
        });

        if (invalidInputs.length > 0) {
          setSidangCellErrors((prev) => [
            ...prev,
            { row: rowNumber, field: 'mahasiswa_nims', message: `Baris ${rowNumber}: Mahasiswa "${invalidInputs.join(', ')}" tidak ditemukan` }
          ]);
        }
      }
    } else if (field === 'nama_ruangan') {
      if (value && value.trim() !== '') {
        const ruanganOption = ruanganList.find(r =>
          r.nama.toLowerCase() === value.toLowerCase() ||
          r.id.toString() === value
        );
        if (!ruanganOption) {
          setSidangCellErrors((prev) => [
            ...prev,
            { row: rowNumber, field: 'ruangan_id', message: `Baris ${rowNumber}: Ruangan "${value}" tidak ditemukan` }
          ]);
        } else {
          // Validasi kapasitas ruangan untuk sidang skripsi: pembimbing (1) + penguji (2) + mahasiswa
          const jumlahPembimbing = row.pembimbing_id ? 1 : 0;
          const jumlahPenguji = (row.penguji_ids || []).length;
          const jumlahMahasiswa = (row.mahasiswa_nims || []).length;
          const totalPeserta = jumlahPembimbing + jumlahPenguji + jumlahMahasiswa;

          if (totalPeserta > 0 && ruanganOption.kapasitas < totalPeserta) {
            const detailPeserta = [];
            if (jumlahPembimbing > 0) detailPeserta.push(`${jumlahPembimbing} pembimbing`);
            if (jumlahPenguji > 0) detailPeserta.push(`${jumlahPenguji} penguji`);
            if (jumlahMahasiswa > 0) detailPeserta.push(`${jumlahMahasiswa} mahasiswa`);
            const detailPesertaStr = detailPeserta.join(' + ');

            setSidangCellErrors((prev) => [
              ...prev,
              { row: rowNumber, field: 'ruangan_id', message: `Baris ${rowNumber}: Kapasitas ruangan ${ruanganOption.nama} (${ruanganOption.kapasitas}) tidak cukup untuk ${totalPeserta} orang (${detailPesertaStr})` }
            ]);
          }
        }
      }
    } else {
      // Validasi lengkap untuk field lainnya
      const validationErrors = validateNonBlokExcelData(updatedData);
      setSidangCellErrors(validationErrors);
    }
  };

  const handleSidangFinishEdit = () => {
    setSidangEditingCell(null);
    // Lakukan validasi lengkap termasuk bentrok antar baris saat selesai edit
    // Gunakan ref untuk memastikan menggunakan data terbaru
    const validationErrors = validateNonBlokExcelData(sidangImportDataRef.current);
    setSidangCellErrors(validationErrors);
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

  function handleEditJadwal(idx: number, jenisBaris: 'materi' | 'agenda' | 'seminar_proposal' | 'sidang_skripsi') {
    // Pilih array yang sesuai berdasarkan jenis baris
    const jadwalArray = jenisBaris === 'materi' ? jadwalMateriKuliah : jenisBaris === 'agenda' ? jadwalAgendaKhusus : jenisBaris === 'seminar_proposal' ? jadwalSeminarProposal : jadwalSidangSkripsi;

    // Validasi index dan data
    if (idx < 0 || idx >= jadwalArray.length) {
      return;
    }

    const row = jadwalArray[idx];

    // Validasi bahwa row ada dan memiliki ID
    if (!row || !row.id) {
      return;
    }

    // Cari data berdasarkan ID untuk memastikan data yang benar (jika ada perubahan urutan)
    const actualRow = jadwalArray.find(j => j.id === row.id) || row;

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

    setForm({
      hariTanggal: formattedTanggal,
      jamMulai: formatJamUntukDropdown(actualRow.jam_mulai || ''),
      jumlahKali: actualRow.jumlah_sesi || 2,
      jamSelesai: formatJamUntukDropdown(actualRow.jam_selesai || ''),
      pengampu: actualRow.dosen_id || null,
      materi: actualRow.materi || '',
      lokasi: actualRow.use_ruangan ? (actualRow.ruangan_id || null) : null,
      jenisBaris: actualRow.jenis_baris || 'materi',
      agenda: actualRow.agenda || '',
      kelompokBesar: actualRow.kelompok_besar_id || null,
      pembimbing: actualRow.pembimbing_id || null,
      komentator: actualRow.komentator_ids || [],
      penguji: actualRow.penguji_ids || [],
      mahasiswa: actualRow.mahasiswa_nims || [],
      useRuangan: actualRow.use_ruangan !== undefined ? actualRow.use_ruangan : true,
    });

    // Set editIndex berdasarkan ID untuk memastikan konsistensi
    const actualIndex = jadwalArray.findIndex(j => j.id === row.id);
    setEditIndex(actualIndex >= 0 ? actualIndex : idx);

    setShowModal(true);
    setErrorForm('');
    setErrorBackend('');
  }

  async function handleDeleteJadwal(idx: number, jenisBaris: 'materi' | 'agenda' | 'seminar_proposal' | 'sidang_skripsi') {
    // Pilih array yang sesuai berdasarkan jenis baris
    const jadwalArray = jenisBaris === 'materi' ? jadwalMateriKuliah : jenisBaris === 'agenda' ? jadwalAgendaKhusus : jenisBaris === 'seminar_proposal' ? jadwalSeminarProposal : jadwalSidangSkripsi;
    const jadwal = jadwalArray[idx];

    setIsDeleting(true);
    try {
      await api.delete(`/non-blok-non-csr/jadwal/${kode}/${jadwal.id}`);

      // Refresh data dengan batch API
      await fetchBatchData(false);

      setShowDeleteModal(false);
      setSelectedDeleteIndex(null);
    } catch (error: any) {
      setErrorBackend(handleApiError(error, 'Menghapus jadwal'));
    } finally {
      setIsDeleting(false);
    }
  }

  async function handleTambahJadwal() {
    setErrorForm('');
    setErrorBackend('');
    if (!form.hariTanggal ||
      (form.jenisBaris === 'materi' && (!form.jamMulai || !form.jumlahKali || !form.pengampu || !form.materi || !form.lokasi)) ||
      (form.jenisBaris === 'agenda' && (!form.agenda || (form.useRuangan && !form.lokasi))) ||
      (form.jenisBaris === 'seminar_proposal' && (!form.jamMulai || !form.jumlahKali || !form.pembimbing || form.komentator.length === 0 || form.mahasiswa.length === 0)) ||
      (form.jenisBaris === 'sidang_skripsi' && (!form.jamMulai || !form.jumlahKali || !form.pembimbing || form.penguji.length === 0 || form.mahasiswa.length === 0))) {
      setErrorForm('Semua field wajib harus diisi!');
      return;
    }

    // Validasi: Cek apakah ada dosen yang sama di pembimbing dan komentator (untuk Seminar Proposal)
    if (form.jenisBaris === 'seminar_proposal' && form.pembimbing && form.komentator.includes(form.pembimbing)) {
      setErrorForm('Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Komentator');
      return;
    }

    // Validasi: Cek apakah ada dosen yang sama di pembimbing dan penguji (untuk Sidang Skripsi)
    if (form.jenisBaris === 'sidang_skripsi' && form.pembimbing && form.penguji.includes(form.pembimbing)) {
      setErrorForm('Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Penguji');
      return;
    }

    // Validasi kapasitas ruangan dilakukan di backend
    // Frontend hanya melakukan validasi field wajib

    setIsSaving(true);
    try {
      const jadwalData: any = {
        tanggal: form.hariTanggal,
        jam_mulai: form.jamMulai,
        jam_selesai: form.jamSelesai,
        jumlah_sesi: form.jumlahKali,
        jenis_baris: form.jenisBaris,
        agenda: form.agenda,
        materi: form.materi,
        dosen_id: form.pengampu,
        ruangan_id: form.jenisBaris === 'materi' ? form.lokasi : (form.useRuangan ? form.lokasi : null),
        kelompok_besar_id: form.kelompokBesar,
        use_ruangan: form.jenisBaris === 'materi' ? true : form.useRuangan,
      };

      // Tambahkan field untuk Seminar Proposal
      if (form.jenisBaris === 'seminar_proposal') {
        jadwalData.pembimbing_id = form.pembimbing;
        jadwalData.komentator_ids = form.komentator;
        jadwalData.mahasiswa_nims = form.mahasiswa;
        jadwalData.ruangan_id = form.lokasi;
        jadwalData.use_ruangan = form.lokasi ? true : false;
      }

      // Tambahkan field untuk Sidang Skripsi
      if (form.jenisBaris === 'sidang_skripsi') {
        jadwalData.pembimbing_id = form.pembimbing;
        jadwalData.penguji_ids = form.penguji;
        jadwalData.mahasiswa_nims = form.mahasiswa;
        jadwalData.ruangan_id = form.lokasi;
        jadwalData.use_ruangan = form.lokasi ? true : false;
      }

      if (editIndex !== null) {
        // Pilih array berdasarkan jenis baris yang sedang di-edit
        const jadwalArray = form.jenisBaris === 'materi' ? jadwalMateriKuliah : form.jenisBaris === 'agenda' ? jadwalAgendaKhusus : form.jenisBaris === 'seminar_proposal' ? jadwalSeminarProposal : jadwalSidangSkripsi;
        const jadwal = jadwalArray[editIndex];
        await api.put(`/non-blok-non-csr/jadwal/${kode}/${jadwal.id}`, jadwalData);
      } else {
        await api.post(`/non-blok-non-csr/jadwal/${kode}`, jadwalData);
      }

      // Refresh data dengan batch API
      await fetchBatchData(false);

      setShowModal(false);
      resetForm();
    } catch (error: any) {
      // Ambil pesan error spesifik dari backend jika ada
      let errorMessage = '';

      // Prioritas 1: validation errors dari Laravel (paling spesifik)
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorMessages: string[] = [];

        // Ambil semua error messages
        Object.keys(errors).forEach(key => {
          const fieldErrors = Array.isArray(errors[key]) ? errors[key] : [errors[key]];
          fieldErrors.forEach((err: string) => {
            errorMessages.push(err);
          });
        });

        if (errorMessages.length > 0) {
          errorMessage = errorMessages.join('. ');
        }
      }

      // Prioritas 2: message dari backend (jika bukan pesan generic)
      if (!errorMessage && error.response?.data?.message) {
        const backendMessage = error.response.data.message;
        // Jika message adalah pesan generic, cek field error untuk pesan yang lebih spesifik
        if (backendMessage === 'Gagal menambahkan jadwal Non Blok Non CSR' ||
          backendMessage === 'Gagal mengupdate jadwal Non Blok Non CSR') {
          // Cek field error untuk pesan yang lebih spesifik
          if (error.response?.data?.error) {
            errorMessage = error.response.data.error;
          } else {
            errorMessage = backendMessage;
          }
        } else {
          // Gunakan message langsung jika bukan pesan generic
          errorMessage = backendMessage;
        }
      }

      // Prioritas 3: error field dari backend (jika belum ada error message)
      if (!errorMessage && error.response?.data?.error) {
        errorMessage = error.response.data.error;
      }

      // Prioritas 4: error message dari axios
      if (!errorMessage && error.message) {
        errorMessage = error.message;
      }

      // Fallback: generic error
      if (!errorMessage) {
        errorMessage = handleApiError(error, 'Menyimpan jadwal');
      }

      setErrorBackend(errorMessage);
    } finally {
      setIsSaving(false);
    }
  }

  // Fungsi untuk export Excel Materi Kuliah
  const exportMateriKuliahExcel = async () => {
    try {
      if (jadwalMateriKuliah.length === 0) {
        alert('Tidak ada data Materi Kuliah untuk diekspor');
        return;
      }

      // Transform data untuk export (hanya kolom yang relevan untuk Materi Kuliah)
      const exportData = jadwalMateriKuliah.map((row) => {
        const dosen = dosenList.find(d => d.id === row.dosen_id);
        const ruangan = ruanganList.find(r => r.id === row.ruangan_id);

        return {
          'Tanggal': formatDateToISO(row.tanggal),
          'Jam Mulai': row.jam_mulai,
          'Sesi': row.jumlah_sesi,
          'Kelompok Besar': row.kelompok_besar_id || '',
          'Dosen': dosen?.name || '',
          'Materi': row.materi || '',
          'Ruangan': ruangan?.nama || ''
        };
      });

      // Buat workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Data Materi Kuliah
      const ws = XLSX.utils.json_to_sheet(exportData, {
        header: ['Tanggal', 'Jam Mulai', 'Sesi', 'Kelompok Besar', 'Dosen', 'Materi', 'Ruangan']
      });

      // Set lebar kolom menggunakan konstanta
      ws['!cols'] = [
        { wch: EXCEL_COLUMN_WIDTHS.TANGGAL },
        { wch: EXCEL_COLUMN_WIDTHS.JAM_MULAI },
        { wch: EXCEL_COLUMN_WIDTHS.JUMLAH_SESI },
        { wch: EXCEL_COLUMN_WIDTHS.KELOMPOK_BESAR },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: EXCEL_COLUMN_WIDTHS.MATERI },
        { wch: EXCEL_COLUMN_WIDTHS.RUANGAN }
      ];

      XLSX.utils.book_append_sheet(wb, ws, 'Data Materi Kuliah');

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
        ['Tanggal Mulai', formatDateToISO(data?.tanggal_mulai)],
        ['Tanggal Akhir', formatDateToISO(data?.tanggal_akhir)],
        ['Durasi Minggu', data?.durasi_minggu || ''],
        [''],
        [`TOTAL JADWAL MATERI KULIAH`, jadwalMateriKuliah.length],
        [''],
        ['CATATAN:'],
        ['• File ini berisi data jadwal Materi Kuliah yang dapat di-import kembali ke aplikasi'],
        ['• Format tanggal: YYYY-MM-DD'],
        ['• Format jam: HH.MM atau HH:MM'],
        ['• Pastikan data dosen dan ruangan valid sebelum import'],
        [''],
        ['PANDUAN IMPORT KEMBALI:'],
        ['1. Pastikan format file sesuai dengan template aplikasi'],
        ['2. Jangan mengubah nama kolom header'],
        ['3. Kolom wajib: Tanggal, Jam Mulai, Sesi, Kelompok Besar, Dosen, Materi, Ruangan'],
        ['4. Format tanggal: YYYY-MM-DD (contoh: 2024-01-15)'],
        ['5. Format jam: HH:MM atau HH.MM (contoh: 07:20 atau 07.20)'],
        ['6. Sesi: 1-6 (1 sesi = 50 menit)'],
        ['7. Pastikan data dosen, ruangan, dan kelompok besar valid'],
        ['8. Sistem akan validasi kapasitas ruangan (mahasiswa + 1 dosen)'],
        ['9. Sistem akan melakukan validasi data sebelum import'],
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN_LEFT }, { wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Info Mata Kuliah');

      // Download file
      const fileName = `Export_MateriKuliah_${data?.kode || 'MataKuliah'}_${formatDateToISO(new Date())}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Gagal mengekspor data Materi Kuliah');
    }
  };

  // Fungsi untuk export Excel Agenda Khusus
  const exportAgendaKhususExcel = async () => {
    try {
      if (jadwalAgendaKhusus.length === 0) {
        alert('Tidak ada data Agenda Khusus untuk diekspor');
        return;
      }

      // Transform data untuk export (hanya kolom yang relevan untuk Agenda Khusus)
      const exportData = jadwalAgendaKhusus.map((row) => {
        const ruangan = ruanganList.find(r => r.id === row.ruangan_id);

        return {
          'Tanggal': formatDateToISO(row.tanggal),
          'Jam Mulai': row.jam_mulai,
          'Sesi': row.jumlah_sesi,
          'Kelompok Besar': row.kelompok_besar_id || '',
          'Ruangan': ruangan?.nama || '',
          'Agenda': row.agenda || ''
        };
      });

      // Buat workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Data Agenda Khusus
      const ws = XLSX.utils.json_to_sheet(exportData, {
        header: ['Tanggal', 'Jam Mulai', 'Sesi', 'Kelompok Besar', 'Ruangan', 'Agenda']
      });
      ws['!cols'] = [
        { wch: EXCEL_COLUMN_WIDTHS.TANGGAL },
        { wch: EXCEL_COLUMN_WIDTHS.JAM_MULAI },
        { wch: EXCEL_COLUMN_WIDTHS.JUMLAH_SESI },
        { wch: EXCEL_COLUMN_WIDTHS.KELOMPOK_BESAR },
        { wch: EXCEL_COLUMN_WIDTHS.RUANGAN },
        { wch: EXCEL_COLUMN_WIDTHS.AGENDA }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Data Agenda Khusus');

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
        ['Tanggal Mulai', formatDateToISO(data?.tanggal_mulai)],
        ['Tanggal Akhir', formatDateToISO(data?.tanggal_akhir)],
        ['Durasi Minggu', data?.durasi_minggu || ''],
        [''],
        [`TOTAL JADWAL AGENDA KHUSUS`, jadwalAgendaKhusus.length],
        [''],
        ['CATATAN:'],
        ['• File ini berisi data jadwal Agenda Khusus yang dapat di-import kembali ke aplikasi'],
        ['• Format tanggal: YYYY-MM-DD'],
        ['• Format jam: HH.MM atau HH:MM'],
        ['• Pastikan data ruangan dan kelompok besar valid (jika diisi)'],
        [''],
        ['PANDUAN IMPORT KEMBALI:'],
        ['1. Pastikan format file sesuai dengan template aplikasi'],
        ['2. Jangan mengubah nama kolom header'],
        ['3. Kolom wajib: Tanggal, Jam Mulai, Sesi, Kelompok Besar, Agenda'],
        ['4. Kolom opsional: Ruangan (boleh dikosongkan untuk agenda online)'],
        ['5. Format tanggal: YYYY-MM-DD (contoh: 2024-01-15)'],
        ['6. Format jam: HH:MM atau HH.MM (contoh: 07:20 atau 07.20)'],
        ['7. Sesi: 1-6 (1 sesi = 50 menit)'],
        ['8. Pastikan data ruangan dan kelompok besar valid (jika diisi)'],
        ['9. Sistem akan melakukan validasi data sebelum import'],
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN_LEFT }, { wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Info Mata Kuliah');

      // Download file
      const fileName = `Export_AgendaKhusus_${data?.kode || 'MataKuliah'}_${formatDateToISO(new Date())}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Gagal mengekspor data Agenda Khusus');
    }
  };

  // Fungsi untuk export Excel Seminar Proposal
  const exportSeminarProposalExcel = async () => {
    try {
      if (jadwalSeminarProposal.length === 0) {
        alert('Tidak ada data Seminar Proposal untuk diekspor');
        return;
      }

      // Transform data untuk export (menggunakan format yang sama dengan template)
      const exportData = jadwalSeminarProposal.map((row) => {
        const pembimbing = dosenList.find(d => d.id === row.pembimbing_id);
        const komentatorNames = row.komentator_ids && row.komentator_ids.length > 0
          ? row.komentator_ids.map((id: number) => {
            const dosen = dosenList.find(d => d.id === id);
            return dosen?.name || '';
          }).filter(Boolean)
          : [];
        const komentator = komentatorNames.length > 0 ? komentatorNames.join('\\') : '';
        const ruangan = ruanganList.find(r => r.id === row.ruangan_id);
        // Ambil nama mahasiswa dari mahasiswaList berdasarkan NIM
        const mahasiswaNames = row.mahasiswa_nims
          ? row.mahasiswa_nims.map((nim: string) => {
            const mahasiswa = mahasiswaList.find(m => m.nim === nim);
            return mahasiswa ? mahasiswa.name : null;
          }).filter(Boolean).join(', ')
          : '';

        return {
          'Tanggal': formatDateToISO(row.tanggal),
          'Jam Mulai': row.jam_mulai,
          'Sesi': row.jumlah_sesi,
          'Pembimbing': pembimbing?.name || '',
          'Komentator': komentator,
          'Mahasiswa (Nama, dipisah koma)': mahasiswaNames,
          'Ruangan': ruangan?.nama || ''
        };
      });

      // Buat workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Data Seminar Proposal (menggunakan header yang sama dengan template)
      const ws = XLSX.utils.json_to_sheet(exportData, {
        header: ['Tanggal', 'Jam Mulai', 'Sesi', 'Pembimbing', 'Komentator', 'Mahasiswa (Nama, dipisah koma)', 'Ruangan']
      });
      ws['!cols'] = [
        { wch: EXCEL_COLUMN_WIDTHS.TANGGAL },
        { wch: EXCEL_COLUMN_WIDTHS.JAM_MULAI },
        { wch: EXCEL_COLUMN_WIDTHS.JUMLAH_SESI },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: 40 },
        { wch: EXCEL_COLUMN_WIDTHS.RUANGAN }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Data Seminar Proposal');

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
        ['Tanggal Mulai', formatDateToISO(data?.tanggal_mulai)],
        ['Tanggal Akhir', formatDateToISO(data?.tanggal_akhir)],
        ['Durasi Minggu', data?.durasi_minggu || ''],
        [''],
        [`TOTAL JADWAL SEMINAR PROPOSAL`, jadwalSeminarProposal.length],
        [''],
        ['CATATAN:'],
        ['• File ini berisi data jadwal Seminar Proposal yang dapat di-import kembali ke aplikasi'],
        ['• Format tanggal: YYYY-MM-DD'],
        ['• Format jam: HH.MM atau HH:MM'],
        ['• Pastikan data dosen, ruangan, dan mahasiswa valid sebelum import'],
        [''],
        ['PANDUAN IMPORT KEMBALI:'],
        ['1. Pastikan format file sesuai dengan template aplikasi'],
        ['2. Jangan mengubah nama kolom header'],
        ['3. Pembimbing: Nama dosen (1 dosen, wajib)'],
        ['4. Komentator: Nama dosen, minimal 1 maksimal 2'],
        ['5. Mahasiswa: Nama mahasiswa, dipisah koma jika lebih dari 1'],
        ['6. Ruangan: Nama ruangan (opsional, kosongkan untuk online)'],
        ['7. Format tanggal: YYYY-MM-DD (contoh: 2024-01-15)'],
        ['8. Format jam: HH:MM atau HH.MM (contoh: 07:20 atau 07.20)'],
        ['9. Dosen yang sama TIDAK BOLEH dipilih sebagai Pembimbing dan Komentator'],
        ['10. Sistem akan melakukan validasi data sebelum import'],
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN_LEFT }, { wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Info Mata Kuliah');

      // Download file
      const fileName = `Export_SeminarProposal_${data?.kode || 'MataKuliah'}_${formatDateToISO(new Date())}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Gagal mengekspor data Seminar Proposal');
    }
  };

  // Fungsi untuk export Excel Sidang Skripsi
  const exportSidangSkripsiExcel = async () => {
    try {
      if (jadwalSidangSkripsi.length === 0) {
        alert('Tidak ada data Sidang Skripsi untuk diekspor');
        return;
      }

      // Transform data untuk export (menggunakan format yang sama dengan template)
      const exportData = jadwalSidangSkripsi.map((row) => {
        const pembimbing = dosenList.find(d => d.id === row.pembimbing_id);
        const pengujiNames = row.penguji_ids && row.penguji_ids.length > 0
          ? row.penguji_ids.map((id: number) => {
            const dosen = dosenList.find(d => d.id === id);
            return dosen?.name || '';
          }).filter(Boolean)
          : [];
        const penguji = pengujiNames.length > 0 ? pengujiNames.join('\\') : '';
        const ruangan = ruanganList.find(r => r.id === row.ruangan_id);
        // Ambil nama mahasiswa dari mahasiswaList berdasarkan NIM
        const mahasiswaNames = row.mahasiswa_nims
          ? row.mahasiswa_nims.map((nim: string) => {
            const mahasiswa = mahasiswaList.find(m => m.nim === nim);
            return mahasiswa ? mahasiswa.name : null;
          }).filter(Boolean).join(', ')
          : '';

        return {
          'Tanggal': formatDateToISO(row.tanggal),
          'Jam Mulai': row.jam_mulai,
          'Sesi': row.jumlah_sesi,
          'Pembimbing': pembimbing?.name || '',
          'Penguji': penguji,
          'Mahasiswa (Nama, dipisah koma)': mahasiswaNames,
          'Ruangan': ruangan?.nama || ''
        };
      });

      // Buat workbook
      const wb = XLSX.utils.book_new();

      // Sheet 1: Data Sidang Skripsi (menggunakan header yang sama dengan template)
      const ws = XLSX.utils.json_to_sheet(exportData, {
        header: ['Tanggal', 'Jam Mulai', 'Sesi', 'Pembimbing', 'Penguji', 'Mahasiswa (Nama, dipisah koma)', 'Ruangan']
      });
      ws['!cols'] = [
        { wch: EXCEL_COLUMN_WIDTHS.TANGGAL },
        { wch: EXCEL_COLUMN_WIDTHS.JAM_MULAI },
        { wch: EXCEL_COLUMN_WIDTHS.JUMLAH_SESI },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: 40 },
        { wch: EXCEL_COLUMN_WIDTHS.RUANGAN }
      ];
      XLSX.utils.book_append_sheet(wb, ws, 'Data Sidang Skripsi');

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
        ['Tanggal Mulai', formatDateToISO(data?.tanggal_mulai)],
        ['Tanggal Akhir', formatDateToISO(data?.tanggal_akhir)],
        ['Durasi Minggu', data?.durasi_minggu || ''],
        [''],
        [`TOTAL JADWAL SIDANG SKRIPSI`, jadwalSidangSkripsi.length],
        [''],
        ['CATATAN:'],
        ['• File ini berisi data jadwal Sidang Skripsi yang dapat di-import kembali ke aplikasi'],
        ['• Format tanggal: YYYY-MM-DD'],
        ['• Format jam: HH.MM atau HH:MM'],
        ['• Pastikan data dosen, ruangan, dan mahasiswa valid sebelum import'],
        [''],
        ['PANDUAN IMPORT KEMBALI:'],
        ['1. Pastikan format file sesuai dengan template aplikasi'],
        ['2. Jangan mengubah nama kolom header'],
        ['3. Pembimbing: Nama dosen (1 dosen, wajib)'],
        ['4. Penguji: Nama dosen, minimal 1 maksimal 2 (gunakan backslash \\ untuk multi-select)'],
        ['5. Mahasiswa: Nama mahasiswa, dipisah koma jika lebih dari 1'],
        ['6. Ruangan: Nama ruangan (opsional, kosongkan untuk online)'],
        ['7. Format tanggal: YYYY-MM-DD (contoh: 2024-01-15)'],
        ['8. Format jam: HH:MM atau HH.MM (contoh: 07:20 atau 07.20)'],
        ['9. Dosen yang sama TIDAK BOLEH dipilih sebagai Pembimbing dan Penguji'],
        ['10. Sistem akan melakukan validasi data sebelum import'],
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN_LEFT }, { wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Info Mata Kuliah');

      // Download file
      const fileName = `Export_SidangSkripsi_${data?.kode || 'MataKuliah'}_${formatDateToISO(new Date())}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Gagal mengekspor data Sidang Skripsi');
    }
  };

  // Initial load dengan loading state
  // Fetch batch data - optimized with useCallback for reuse
  const fetchBatchData = useCallback(async (showLoading = true) => {
    if (!kode) return;

    if (showLoading) setLoading(true);

    try {
      const response = await api.get(`/non-blok-non-csr/${kode}/batch-data`);
      const batchData = response.data;

      // Set mata kuliah data
      setData(batchData.mata_kuliah);

      // Set jadwal Non-Blok Non-CSR data - pisahkan berdasarkan jenis_baris
      const allJadwal = batchData.jadwal_non_blok_non_csr || [];
      setJadwalMateriKuliah(allJadwal.filter((j: JadwalNonBlokNonCSR) => j.jenis_baris === 'materi'));
      setJadwalAgendaKhusus(allJadwal.filter((j: JadwalNonBlokNonCSR) => j.jenis_baris === 'agenda'));
      setJadwalSeminarProposal(allJadwal.filter((j: JadwalNonBlokNonCSR) => j.jenis_baris === 'seminar_proposal'));
      setJadwalSidangSkripsi(allJadwal.filter((j: JadwalNonBlokNonCSR) => j.jenis_baris === 'sidang_skripsi'));

      // Set reference data
      setDosenList(batchData.dosen_list);
      setRuanganList(batchData.ruangan_list);
      setJamOptions(batchData.jam_options);
      setKelompokBesarAgendaOptions(batchData.kelompok_besar_agenda_options || []);
      setKelompokBesarMateriOptions(batchData.kelompok_besar_materi_options || []);
      setMahasiswaList(batchData.mahasiswa_list || []);

    } catch (error: any) {
      setError(handleApiError(error, 'Memuat data batch'));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [kode]);

  // Fetch batch data on component mount
  useEffect(() => {
    fetchBatchData(true);
  }, [fetchBatchData]);

  // Effect untuk auto-hide success message Materi Kuliah bulk delete
  useEffect(() => {
    if (materiSuccess) {
      const timer = setTimeout(() => {
        setMateriSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [materiSuccess]);

  // Effect untuk auto-hide success message Agenda Khusus bulk delete
  useEffect(() => {
    if (agendaSuccess) {
      const timer = setTimeout(() => {
        setAgendaSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [agendaSuccess]);

  // Effect untuk auto-hide success message Seminar Proposal bulk delete
  useEffect(() => {
    if (seminarSuccess) {
      const timer = setTimeout(() => {
        setSeminarSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [seminarSuccess]);

  // Effect untuk auto-hide success message Sidang Skripsi bulk delete
  useEffect(() => {
    if (sidangSuccess) {
      const timer = setTimeout(() => {
        setSidangSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [sidangSuccess]);

  // Fungsi untuk bulk delete Materi Kuliah - tampilkan modal konfirmasi
  const handleMateriBulkDelete = () => {
    if (selectedMateriItems.length === 0) return;
    setShowMateriBulkDeleteModal(true);
  };

  // Fungsi untuk konfirmasi bulk delete Materi Kuliah
  const confirmMateriBulkDelete = async () => {
    if (selectedMateriItems.length === 0) return;

    setIsMateriDeleting(true);
    try {
      // Delete all selected items
      await Promise.all(selectedMateriItems.map(id => api.delete(`/non-blok-non-csr/jadwal/${kode}/${id}`)));

      // Set success message
      setMateriSuccess(`${selectedMateriItems.length} jadwal Materi Kuliah berhasil dihapus.`);

      // Clear selections
      setSelectedMateriItems([]);

      // Close modal
      setShowMateriBulkDeleteModal(false);

      // Refresh data
      await fetchBatchData();
    } catch (error: any) {
      setError(handleApiError(error, 'Menghapus jadwal Materi Kuliah'));
    } finally {
      setIsMateriDeleting(false);
    }
  };

  // Fungsi untuk bulk delete Agenda Khusus - tampilkan modal konfirmasi
  const handleAgendaBulkDelete = () => {
    if (selectedAgendaItems.length === 0) return;
    setShowAgendaBulkDeleteModal(true);
  };

  // Fungsi untuk konfirmasi bulk delete Agenda Khusus
  const confirmAgendaBulkDelete = async () => {
    if (selectedAgendaItems.length === 0) return;

    setIsAgendaDeleting(true);
    try {
      // Delete all selected items
      await Promise.all(selectedAgendaItems.map(id => api.delete(`/non-blok-non-csr/jadwal/${kode}/${id}`)));

      // Set success message
      setAgendaSuccess(`${selectedAgendaItems.length} jadwal Agenda Khusus berhasil dihapus.`);

      // Clear selections
      setSelectedAgendaItems([]);

      // Close modal
      setShowAgendaBulkDeleteModal(false);

      // Refresh data
      await fetchBatchData();
    } catch (error: any) {
      setError(handleApiError(error, 'Menghapus jadwal Agenda Khusus'));
    } finally {
      setIsAgendaDeleting(false);
    }
  };

  // Fungsi untuk bulk delete Seminar Proposal - tampilkan modal konfirmasi
  const handleSeminarBulkDelete = () => {
    if (selectedSeminarItems.length === 0) return;
    setShowSeminarBulkDeleteModal(true);
  };

  // Fungsi untuk konfirmasi bulk delete Seminar Proposal
  const confirmSeminarBulkDelete = async () => {
    if (selectedSeminarItems.length === 0) return;

    setIsSeminarDeleting(true);
    try {
      // Delete all selected items
      await Promise.all(selectedSeminarItems.map(id => api.delete(`/non-blok-non-csr/jadwal/${kode}/${id}`)));

      // Set success message
      setSeminarSuccess(`${selectedSeminarItems.length} jadwal Seminar Proposal berhasil dihapus.`);

      // Clear selections
      setSelectedSeminarItems([]);

      // Close modal
      setShowSeminarBulkDeleteModal(false);

      // Refresh data
      await fetchBatchData();
    } catch (error: any) {
      setError(handleApiError(error, 'Menghapus jadwal Seminar Proposal'));
    } finally {
      setIsSeminarDeleting(false);
    }
  };

  // Select handlers untuk Materi Kuliah
  const handleMateriSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedMateriItems(jadwalMateriKuliah.map(jadwal => jadwal.id!));
    } else {
      setSelectedMateriItems([]);
    }
  };

  const handleMateriSelectItem = (id: number) => {
    if (selectedMateriItems.includes(id)) {
      setSelectedMateriItems(selectedMateriItems.filter(itemId => itemId !== id));
    } else {
      setSelectedMateriItems([...selectedMateriItems, id]);
    }
  };

  // Select handlers untuk Agenda Khusus
  const handleAgendaSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedAgendaItems(jadwalAgendaKhusus.map(jadwal => jadwal.id!));
    } else {
      setSelectedAgendaItems([]);
    }
  };

  // Select handlers untuk Seminar Proposal
  const handleSeminarSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSeminarItems(jadwalSeminarProposal.map(jadwal => jadwal.id!));
    } else {
      setSelectedSeminarItems([]);
    }
  };

  const handleSeminarSelectItem = (id: number) => {
    if (selectedSeminarItems.includes(id)) {
      setSelectedSeminarItems(selectedSeminarItems.filter(itemId => itemId !== id));
    } else {
      setSelectedSeminarItems([...selectedSeminarItems, id]);
    }
  };

  // Fungsi untuk bulk delete Sidang Skripsi - tampilkan modal konfirmasi
  const handleSidangBulkDelete = () => {
    if (selectedSidangItems.length === 0) return;
    setShowSidangBulkDeleteModal(true);
  };

  // Fungsi untuk konfirmasi bulk delete Sidang Skripsi
  const confirmSidangBulkDelete = async () => {
    if (selectedSidangItems.length === 0) return;

    setIsSidangDeleting(true);
    try {
      // Delete all selected items
      await Promise.all(selectedSidangItems.map(id => api.delete(`/non-blok-non-csr/jadwal/${kode}/${id}`)));

      // Set success message
      setSidangSuccess(`${selectedSidangItems.length} jadwal Sidang Skripsi berhasil dihapus.`);

      // Clear selections
      setSelectedSidangItems([]);

      // Close modal
      setShowSidangBulkDeleteModal(false);

      // Refresh data
      await fetchBatchData();
    } catch (error: any) {
      setError(handleApiError(error, 'Menghapus jadwal Sidang Skripsi'));
    } finally {
      setIsSidangDeleting(false);
    }
  };

  // Select handlers untuk Sidang Skripsi
  const handleSidangSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedSidangItems(jadwalSidangSkripsi.map(jadwal => jadwal.id!));
    } else {
      setSelectedSidangItems([]);
    }
  };

  const handleSidangSelectItem = (id: number) => {
    if (selectedSidangItems.includes(id)) {
      setSelectedSidangItems(selectedSidangItems.filter(itemId => itemId !== id));
    } else {
      setSelectedSidangItems([...selectedSidangItems, id]);
    }
  };

  const handleAgendaSelectItem = (id: number) => {
    if (selectedAgendaItems.includes(id)) {
      setSelectedAgendaItems(selectedAgendaItems.filter(itemId => itemId !== id));
    } else {
      setSelectedAgendaItems([...selectedAgendaItems, id]);
    }
  };

  if (loading) return (
    <div className="w-full mx-auto">
      {/* Header skeleton */}
      <div className="pt-6 pb-2">
        <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
      </div>
      <div className="h-8 w-80 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
      <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-8" />

      {/* Info Mata Kuliah skeleton */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-8 mb-8 shadow">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
              <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>

      {/* Info Tambahan skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
            <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
            <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        ))}
      </div>

      {/* Section Materi Kuliah skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="h-7 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-9 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse" />
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
                {Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`skeleton-materi-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}>
                    <td className="px-4 py-4 text-center">
                      <div className="h-5 w-5 bg-gray-200 dark:bg-gray-600 rounded mx-auto animate-pulse" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-28 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-40 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-28 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1.5 justify-center">
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section Agenda Khusus skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="h-7 w-36 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-9 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse" />
                  </th>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Hari/Tanggal</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pukul</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Waktu</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Agenda</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`skeleton-agenda-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}>
                    <td className="px-4 py-4 text-center">
                      <div className="h-5 w-5 bg-gray-200 dark:bg-gray-600 rounded mx-auto animate-pulse" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-28 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-40 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-28 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1.5 justify-center">
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section Seminar Proposal skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="h-7 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-9 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse" />
                  </th>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Hari/Tanggal</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pukul</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Waktu</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pembimbing</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Komentator</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400" style={{ minWidth: '300px' }}>Mahasiswa</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`skeleton-seminar-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}>
                    <td className="px-4 py-4 text-center">
                      <div className="h-5 w-5 bg-gray-200 dark:bg-gray-600 rounded mx-auto animate-pulse" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-28 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-36 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4" style={{ minWidth: '300px' }}>
                      <div className="h-4 w-40 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1.5 justify-center">
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section Sidang Skripsi skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div className="h-7 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="flex items-center gap-2">
            <div className="h-9 w-28 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-9 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-9 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          </div>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded mx-auto animate-pulse" />
                  </th>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Hari/Tanggal</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pukul</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Waktu</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pembimbing</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Penguji</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400" style={{ minWidth: '300px' }}>Mahasiswa</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 3 }).map((_, index) => (
                  <tr key={`skeleton-sidang-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}>
                    <td className="px-4 py-4 text-center">
                      <div className="h-5 w-5 bg-gray-200 dark:bg-gray-600 rounded mx-auto animate-pulse" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="h-4 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-28 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-36 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4" style={{ minWidth: '300px' }}>
                      <div className="h-4 w-40 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex gap-1.5 justify-center">
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
                        <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse" />
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
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        {data.nama}
      </h1>
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

      {/* Section Materi Kuliah */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">
            Materi Kuliah
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowMateriUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform cursor-pointer">
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-brand-700 dark:text-brand-200" />
              Import Excel
            </button>
            <button
              onClick={downloadMateriTemplate}
              className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
              Download Template Excel
            </button>
            <button
              onClick={exportMateriKuliahExcel}
              disabled={jadwalMateriKuliah.length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs transition flex items-center gap-2 ${jadwalMateriKuliah.length === 0
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800'
                }`}
              title={jadwalMateriKuliah.length === 0 ? 'Tidak ada data Materi Kuliah. Silakan tambahkan data jadwal terlebih dahulu untuk melakukan export.' : 'Export data Materi Kuliah ke Excel'}
            >
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
              Export ke Excel
            </button>
            <button
              onClick={() => {
                setForm({
                  hariTanggal: '',
                  jamMulai: '',
                  jumlahKali: 2,
                  jamSelesai: '',
                  pengampu: null,
                  materi: '',
                  lokasi: null,
                  jenisBaris: 'materi',
                  agenda: '',
                  kelompokBesar: null,
                  pembimbing: null,
                  komentator: [],
                  penguji: [],
                  mahasiswa: [],
                  useRuangan: true,
                });
                setEditIndex(null);
                setShowModal(true);
                setErrorForm('');
                setErrorBackend('');
              }}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition-all duration-300 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                  Menyimpan...
                </>
              ) : (
                'Tambah Jadwal'
              )}
            </button>
          </div>
        </div>

        {/* Success Message Import Materi Kuliah */}
        <AnimatePresence>
          {materiImportedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
              onAnimationComplete={() => {
                setTimeout(() => {
                  setMateriImportedCount(0);
                }, 5000);
              }}
            >
              {materiImportedCount} jadwal Materi Kuliah berhasil diimpor ke database.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Message Bulk Delete Materi */}
        <AnimatePresence>
          {materiSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {materiSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabel Materi Kuliah */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <button
                      type="button"
                      aria-checked={jadwalMateriKuliah.length > 0 && jadwalMateriKuliah.every(item => selectedMateriItems.includes(item.id!))}
                      role="checkbox"
                      onClick={() => handleMateriSelectAll(!(jadwalMateriKuliah.length > 0 && jadwalMateriKuliah.every(item => selectedMateriItems.includes(item.id!))))}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${jadwalMateriKuliah.length > 0 && jadwalMateriKuliah.every(item => selectedMateriItems.includes(item.id!)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                    >
                      {jadwalMateriKuliah.length > 0 && jadwalMateriKuliah.every(item => selectedMateriItems.includes(item.id!)) && (
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
                {jadwalMateriKuliah.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-6 text-gray-400">Tidak ada data Materi Kuliah</td>
                  </tr>
                ) : (
                  getPaginatedData(
                    jadwalMateriKuliah
                      .slice()
                      .sort((a, b) => {
                        const dateA = new Date(a.tanggal);
                        const dateB = new Date(b.tanggal);
                        return dateA.getTime() - dateB.getTime();
                      }),
                    materiPage,
                    materiPageSize
                  ).map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}>
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          aria-checked={selectedMateriItems.includes(row.id!)}
                          role="checkbox"
                          onClick={() => handleMateriSelectItem(row.id!)}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedMateriItems.includes(row.id!) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                        >
                          {selectedMateriItems.includes(row.id!) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <polyline points="20 7 11 17 4 10" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{(materiPage - 1) * materiPageSize + idx + 1}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatTanggalKonsisten(row.tanggal)}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatJamTanpaDetik(row.jam_mulai)}–{formatJamTanpaDetik(row.jam_selesai)}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi} x 50 menit</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.dosen?.name || ''}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90`}>{row.materi}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {row.kelompok_besar_id ? `Kelompok Besar Semester ${row.kelompok_besar_id}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {row.ruangan?.nama || ''}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                          {/* Tombol Absensi - tampilkan jika ada dosen yang terdaftar */}
                          {(row.dosen_id || row.dosen) && (
                            <button
                              onClick={() => navigate(`/absensi-non-blok-non-csr/${kode}/${row.id}`)}
                              className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors shrink-0"
                              title="Buka Absensi"
                            >
                              <FontAwesomeIcon icon={faCheckCircle} className="w-3.5 h-3.5 shrink-0" />
                              <span className="xl:inline whitespace-nowrap">Absensi</span>
                            </button>
                          )}
                          <button onClick={() => {
                            const correctIndex = jadwalMateriKuliah.findIndex(j => j.id === row.id);
                            handleEditJadwal(correctIndex >= 0 ? correctIndex : idx, 'materi');
                          }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition mr-1" title="Edit Jadwal">
                            <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                            <span className="inline">Edit</span>
                          </button>
                          <button onClick={() => {
                            const correctIndex = jadwalMateriKuliah.findIndex(j => j.id === row.id);
                            setSelectedDeleteIndex(correctIndex >= 0 ? correctIndex : idx);
                            setForm({ ...form, jenisBaris: 'materi' });
                            setShowDeleteModal(true);
                          }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" title="Hapus Jadwal">
                            <FontAwesomeIcon icon={faTrash} className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                            <span className="inline">Hapus</span>
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

        {/* Tombol Hapus Terpilih untuk Materi Kuliah */}
        {selectedMateriItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              disabled={isMateriDeleting}
              onClick={handleMateriBulkDelete}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${isMateriDeleting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-theme-xs hover:bg-red-600'}`}
            >
              {isMateriDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedMateriItems.length})`}
            </button>
          </div>
        )}

        {/* Pagination for Materi Kuliah */}
        {jadwalMateriKuliah.length > 0 && (
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan {((materiPage - 1) * materiPageSize) + 1} - {Math.min(materiPage * materiPageSize, jadwalMateriKuliah.length)} dari {jadwalMateriKuliah.length} data
              </span>

              <select
                value={materiPageSize}
                onChange={(e) => {
                  setMateriPageSize(Number(e.target.value));
                  setMateriPage(1);
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
              <button
                onClick={() => setMateriPage((p) => Math.max(1, p - 1))}
                disabled={materiPage === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Previous
              </button>

              {/* Always show first page if it's not the current page */}
              {getTotalPages(jadwalMateriKuliah.length, materiPageSize) > 1 && (
                <button
                  onClick={() => setMateriPage(1)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${materiPage === 1
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                >
                  1
                </button>
              )}

              {/* Show pages around current page */}
              {Array.from({ length: getTotalPages(jadwalMateriKuliah.length, materiPageSize) }, (_, i) => {
                const pageNum = i + 1;
                // Show pages around current page (2 pages before and after)
                const shouldShow =
                  pageNum > 1 &&
                  pageNum < getTotalPages(jadwalMateriKuliah.length, materiPageSize) &&
                  pageNum >= materiPage - 2 &&
                  pageNum <= materiPage + 2;

                if (!shouldShow) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setMateriPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${materiPage === pageNum
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Show ellipsis if current page is far from end */}
              {materiPage < getTotalPages(jadwalMateriKuliah.length, materiPageSize) - 3 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">
                  ...
                </span>
              )}

              {/* Always show last page if it's not the first page */}
              {getTotalPages(jadwalMateriKuliah.length, materiPageSize) > 1 && (
                <button
                  onClick={() => setMateriPage(getTotalPages(jadwalMateriKuliah.length, materiPageSize))}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${materiPage === getTotalPages(jadwalMateriKuliah.length, materiPageSize)
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                >
                  {getTotalPages(jadwalMateriKuliah.length, materiPageSize)}
                </button>
              )}

              <button
                onClick={() => setMateriPage((p) => Math.min(getTotalPages(jadwalMateriKuliah.length, materiPageSize), p + 1))}
                disabled={materiPage === getTotalPages(jadwalMateriKuliah.length, materiPageSize)}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section Agenda Khusus */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">
            Agenda Khusus
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAgendaUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform cursor-pointer">
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-brand-700 dark:text-brand-200" />
              Import Excel
            </button>
            <button
              onClick={downloadAgendaTemplate}
              className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
              Download Template Excel
            </button>
            <button
              onClick={exportAgendaKhususExcel}
              disabled={jadwalAgendaKhusus.length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs transition flex items-center gap-2 ${jadwalAgendaKhusus.length === 0
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800'
                }`}
              title={jadwalAgendaKhusus.length === 0 ? 'Tidak ada data Agenda Khusus. Silakan tambahkan data jadwal terlebih dahulu untuk melakukan export.' : 'Export data Agenda Khusus ke Excel'}
            >
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
              Export ke Excel
            </button>
            <button
              onClick={() => {
                setForm({
                  hariTanggal: '',
                  jamMulai: '',
                  jumlahKali: 2,
                  jamSelesai: '',
                  pengampu: null,
                  materi: '',
                  lokasi: null,
                  jenisBaris: 'agenda',
                  agenda: '',
                  kelompokBesar: null,
                  pembimbing: null,
                  komentator: [],
                  penguji: [],
                  mahasiswa: [],
                  useRuangan: true,
                });
                setEditIndex(null);
                setShowModal(true);
                setErrorForm('');
                setErrorBackend('');
              }}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition-all duration-300 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                  Menyimpan...
                </>
              ) : (
                'Tambah Jadwal'
              )}
            </button>
          </div>
        </div>

        {/* Success Message Import Agenda Khusus */}
        <AnimatePresence>
          {agendaImportedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
              onAnimationComplete={() => {
                setTimeout(() => {
                  setAgendaImportedCount(0);
                }, 5000);
              }}
            >
              {agendaImportedCount} jadwal Agenda Khusus berhasil diimpor ke database.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Message Bulk Delete Agenda */}
        <AnimatePresence>
          {agendaSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {agendaSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabel Agenda Khusus */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <button
                      type="button"
                      aria-checked={jadwalAgendaKhusus.length > 0 && jadwalAgendaKhusus.every(item => selectedAgendaItems.includes(item.id!))}
                      role="checkbox"
                      onClick={() => handleAgendaSelectAll(!(jadwalAgendaKhusus.length > 0 && jadwalAgendaKhusus.every(item => selectedAgendaItems.includes(item.id!))))}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${jadwalAgendaKhusus.length > 0 && jadwalAgendaKhusus.every(item => selectedAgendaItems.includes(item.id!)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                    >
                      {jadwalAgendaKhusus.length > 0 && jadwalAgendaKhusus.every(item => selectedAgendaItems.includes(item.id!)) && (
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
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Agenda</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {jadwalAgendaKhusus.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-6 text-gray-400">Tidak ada data Agenda Khusus</td>
                  </tr>
                ) : (
                  getPaginatedData(
                    jadwalAgendaKhusus
                      .slice()
                      .sort((a, b) => {
                        const dateA = new Date(a.tanggal);
                        const dateB = new Date(b.tanggal);
                        return dateA.getTime() - dateB.getTime();
                      }),
                    agendaPage,
                    agendaPageSize
                  ).map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}>
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          aria-checked={selectedAgendaItems.includes(row.id!)}
                          role="checkbox"
                          onClick={() => handleAgendaSelectItem(row.id!)}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedAgendaItems.includes(row.id!) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                        >
                          {selectedAgendaItems.includes(row.id!) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <polyline points="20 7 11 17 4 10" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{(agendaPage - 1) * agendaPageSize + idx + 1}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatTanggalKonsisten(row.tanggal)}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatJamTanpaDetik(row.jam_mulai)}–{formatJamTanpaDetik(row.jam_selesai)}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi} x 50 menit</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.agenda}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {row.kelompok_besar_id ? `Kelompok Besar Semester ${row.kelompok_besar_id}` : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {row.use_ruangan ? (row.ruangan?.nama || '') : '-'}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                          <button onClick={() => {
                            const correctIndex = jadwalAgendaKhusus.findIndex(j => j.id === row.id);
                            handleEditJadwal(correctIndex >= 0 ? correctIndex : idx, 'agenda');
                          }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition mr-1" title="Edit Jadwal">
                            <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                            <span className="inline">Edit</span>
                          </button>
                          <button onClick={() => {
                            const correctIndex = jadwalAgendaKhusus.findIndex(j => j.id === row.id);
                            setSelectedDeleteIndex(correctIndex >= 0 ? correctIndex : idx);
                            setForm({ ...form, jenisBaris: 'agenda' });
                            setShowDeleteModal(true);
                          }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" title="Hapus Jadwal">
                            <FontAwesomeIcon icon={faTrash} className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />
                            <span className="inline">Hapus</span>
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

        {/* Tombol Hapus Terpilih untuk Agenda Khusus */}
        {selectedAgendaItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              disabled={isAgendaDeleting}
              onClick={handleAgendaBulkDelete}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${isAgendaDeleting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-theme-xs hover:bg-red-600'}`}
            >
              {isAgendaDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedAgendaItems.length})`}
            </button>
          </div>
        )}

        {/* Pagination for Agenda Khusus */}
        {jadwalAgendaKhusus.length > 0 && (
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan {((agendaPage - 1) * agendaPageSize) + 1} - {Math.min(agendaPage * agendaPageSize, jadwalAgendaKhusus.length)} dari {jadwalAgendaKhusus.length} data
              </span>

              <select
                value={agendaPageSize}
                onChange={(e) => {
                  setAgendaPageSize(Number(e.target.value));
                  setAgendaPage(1);
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
              <button
                onClick={() => setAgendaPage((p) => Math.max(1, p - 1))}
                disabled={agendaPage === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Previous
              </button>

              {/* Always show first page if it's not the current page */}
              {getTotalPages(jadwalAgendaKhusus.length, agendaPageSize) > 1 && (
                <button
                  onClick={() => setAgendaPage(1)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${agendaPage === 1
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                >
                  1
                </button>
              )}

              {/* Show pages around current page */}
              {Array.from({ length: getTotalPages(jadwalAgendaKhusus.length, agendaPageSize) }, (_, i) => {
                const pageNum = i + 1;
                const shouldShow =
                  pageNum > 1 &&
                  pageNum < getTotalPages(jadwalAgendaKhusus.length, agendaPageSize) &&
                  pageNum >= agendaPage - 2 &&
                  pageNum <= agendaPage + 2;

                if (!shouldShow) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setAgendaPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${agendaPage === pageNum
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Show ellipsis if current page is far from end */}
              {agendaPage < getTotalPages(jadwalAgendaKhusus.length, agendaPageSize) - 3 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">
                  ...
                </span>
              )}

              {/* Always show last page if it's not the first page */}
              {getTotalPages(jadwalAgendaKhusus.length, agendaPageSize) > 1 && (
                <button
                  onClick={() => setAgendaPage(getTotalPages(jadwalAgendaKhusus.length, agendaPageSize))}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${agendaPage === getTotalPages(jadwalAgendaKhusus.length, agendaPageSize)
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                >
                  {getTotalPages(jadwalAgendaKhusus.length, agendaPageSize)}
                </button>
              )}

              <button
                onClick={() => setAgendaPage((p) => Math.min(getTotalPages(jadwalAgendaKhusus.length, agendaPageSize), p + 1))}
                disabled={agendaPage === getTotalPages(jadwalAgendaKhusus.length, agendaPageSize)}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section Seminar Proposal */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">
            Seminar Proposal
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSeminarUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform cursor-pointer">
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-brand-700 dark:text-brand-200" />
              Import Excel
            </button>
            <button
              onClick={downloadSeminarTemplate}
              className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
              Download Template Excel
            </button>
            <button
              onClick={exportSeminarProposalExcel}
              disabled={jadwalSeminarProposal.length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs transition flex items-center gap-2 ${jadwalSeminarProposal.length === 0
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800'
                }`}
              title={jadwalSeminarProposal.length === 0 ? 'Tidak ada data Seminar Proposal. Silakan tambahkan data jadwal terlebih dahulu untuk melakukan export.' : 'Export data Seminar Proposal ke Excel'}
            >
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
              Export ke Excel
            </button>
            <button
              onClick={() => {
                setForm({
                  hariTanggal: '',
                  jamMulai: '',
                  jumlahKali: 2,
                  jamSelesai: '',
                  pengampu: null,
                  materi: '',
                  lokasi: null,
                  jenisBaris: 'seminar_proposal',
                  agenda: '',
                  kelompokBesar: null,
                  pembimbing: null,
                  komentator: [],
                  penguji: [],
                  mahasiswa: [],
                  useRuangan: true,
                });
                setEditIndex(null);
                setShowModal(true);
                setErrorForm('');
                setErrorBackend('');
              }}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition-all duration-300 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                  Menyimpan...
                </>
              ) : (
                'Tambah Jadwal'
              )}
            </button>
          </div>
        </div>

        {/* Success Message Import Seminar Proposal */}
        <AnimatePresence>
          {seminarImportedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
              onAnimationComplete={() => {
                setTimeout(() => {
                  setSeminarImportedCount(0);
                }, 5000);
              }}
            >
              {seminarImportedCount} jadwal Seminar Proposal berhasil diimpor ke database.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Message Bulk Delete Seminar */}
        <AnimatePresence>
          {seminarSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {seminarSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabel Seminar Proposal */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <button
                      type="button"
                      aria-checked={jadwalSeminarProposal.length > 0 && jadwalSeminarProposal.every(item => selectedSeminarItems.includes(item.id!))}
                      role="checkbox"
                      onClick={() => handleSeminarSelectAll(!(jadwalSeminarProposal.length > 0 && jadwalSeminarProposal.every(item => selectedSeminarItems.includes(item.id!))))}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${jadwalSeminarProposal.length > 0 && jadwalSeminarProposal.every(item => selectedSeminarItems.includes(item.id!)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                    >
                      {jadwalSeminarProposal.length > 0 && jadwalSeminarProposal.every(item => selectedSeminarItems.includes(item.id!)) && (
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
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pembimbing</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Komentator</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400" style={{ minWidth: '300px' }}>Mahasiswa</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {jadwalSeminarProposal.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-6 text-gray-400">Tidak ada data Seminar Proposal</td>
                  </tr>
                ) : (
                  getPaginatedData(
                    jadwalSeminarProposal
                      .slice()
                      .sort((a, b) => {
                        const dateA = new Date(a.tanggal);
                        const dateB = new Date(b.tanggal);
                        return dateA.getTime() - dateB.getTime();
                      }),
                    seminarPage,
                    seminarPageSize
                  ).map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}>
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          aria-checked={selectedSeminarItems.includes(row.id!)}
                          role="checkbox"
                          onClick={() => handleSeminarSelectItem(row.id!)}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedSeminarItems.includes(row.id!) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                        >
                          {selectedSeminarItems.includes(row.id!) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <polyline points="20 7 11 17 4 10" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{(seminarPage - 1) * seminarPageSize + idx + 1}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatTanggalKonsisten(row.tanggal)}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatJamTanpaDetik(row.jam_mulai)}–{formatJamTanpaDetik(row.jam_selesai)}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi} x 50 menit</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.pembimbing?.name || '-'}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {row.komentator && Array.isArray(row.komentator) && row.komentator.length > 0
                          ? row.komentator.map((k: any) => k.name || k).join(', ')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90" style={{ minWidth: '300px' }}>
                        {(() => {
                          if (!row.mahasiswa_nims || row.mahasiswa_nims.length === 0) {
                            return '-';
                          }

                          // Ambil nama mahasiswa dari mahasiswaList berdasarkan NIM
                          const mahasiswaNames = row.mahasiswa_nims
                            .map((nim: string) => {
                              const mahasiswa = mahasiswaList.find(m => m.nim === nim);
                              return mahasiswa ? mahasiswa.name : null;
                            })
                            .filter(Boolean);

                          const displayCount = 3;
                          const displayNames = mahasiswaNames.slice(0, displayCount);
                          const remainingCount = mahasiswaNames.length - displayCount;

                          return (
                            <div className="flex flex-wrap items-center gap-1">
                              {displayNames.map((name, idx) => (
                                <span key={idx} className="text-sm">
                                  {name}
                                  {idx < displayNames.length - 1 && ','}
                                </span>
                              ))}
                              {remainingCount > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const allMahasiswa = row.mahasiswa_nims
                                      .map((nim: string) => mahasiswaList.find(m => m.nim === nim))
                                      .filter(Boolean) as MahasiswaOption[];
                                    setSelectedMahasiswaList(allMahasiswa);
                                    setMahasiswaSearchQuery('');
                                    setMahasiswaModalPage(1);
                                    setShowMahasiswaModal(true);
                                  }}
                                  className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 font-medium underline cursor-pointer ml-1"
                                >
                                  +{remainingCount} lebih banyak
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {row.ruangan?.nama || '-'}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                          <button onClick={(e) => {
                            e.stopPropagation();
                            if (row.id) {
                              navigate(`/bimbingan-akhir/seminar-proposal/${row.id}`);
                            }
                          }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-500 hover:text-green-700 dark:hover:text-green-300 transition mr-1" title="Detail Seminar Proposal">
                            <FontAwesomeIcon icon={faEye} className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                            <span className="hidden sm:inline">Detail</span>
                          </button>
                          <button onClick={() => {
                            const correctIndex = jadwalSeminarProposal.findIndex(j => j.id === row.id);
                            handleEditJadwal(correctIndex >= 0 ? correctIndex : idx, 'seminar_proposal');
                          }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition mr-1" title="Edit Jadwal">
                            <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button onClick={() => {
                            const correctIndex = jadwalSeminarProposal.findIndex(j => j.id === row.id);
                            setSelectedDeleteIndex(correctIndex >= 0 ? correctIndex : idx);
                            setForm({ ...form, jenisBaris: 'seminar_proposal' });
                            setShowDeleteModal(true);
                          }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" title="Hapus Jadwal">
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

        {/* Tombol Hapus Terpilih untuk Seminar Proposal */}
        {selectedSeminarItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              disabled={isSeminarDeleting}
              onClick={() => setShowSeminarBulkDeleteModal(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${isSeminarDeleting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-theme-xs hover:bg-red-600'}`}
            >
              {isSeminarDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedSeminarItems.length})`}
            </button>
          </div>
        )}

        {/* Pagination for Seminar Proposal */}
        {jadwalSeminarProposal.length > 0 && (
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan {((seminarPage - 1) * seminarPageSize) + 1} - {Math.min(seminarPage * seminarPageSize, jadwalSeminarProposal.length)} dari {jadwalSeminarProposal.length} data
              </span>

              <select
                value={seminarPageSize}
                onChange={(e) => {
                  setSeminarPageSize(Number(e.target.value));
                  setSeminarPage(1);
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
              <button
                onClick={() => setSeminarPage((p) => Math.max(1, p - 1))}
                disabled={seminarPage === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Previous
              </button>

              {/* Always show first page if it's not the current page */}
              {getTotalPages(jadwalSeminarProposal.length, seminarPageSize) > 1 && (
                <button
                  onClick={() => setSeminarPage(1)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${seminarPage === 1
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                >
                  1
                </button>
              )}

              {/* Show pages around current page */}
              {Array.from({ length: getTotalPages(jadwalSeminarProposal.length, seminarPageSize) }, (_, i) => {
                const pageNum = i + 1;
                // Show pages around current page (2 pages before and after)
                const shouldShow =
                  pageNum > 1 &&
                  pageNum < getTotalPages(jadwalSeminarProposal.length, seminarPageSize) &&
                  pageNum >= seminarPage - 2 &&
                  pageNum <= seminarPage + 2;

                if (!shouldShow) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setSeminarPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${seminarPage === pageNum
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Show ellipsis if current page is far from end */}
              {seminarPage < getTotalPages(jadwalSeminarProposal.length, seminarPageSize) - 3 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">
                  ...
                </span>
              )}

              {/* Always show last page if it's not the first page */}
              {getTotalPages(jadwalSeminarProposal.length, seminarPageSize) > 1 && (
                <button
                  onClick={() => setSeminarPage(getTotalPages(jadwalSeminarProposal.length, seminarPageSize))}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${seminarPage === getTotalPages(jadwalSeminarProposal.length, seminarPageSize)
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                >
                  {getTotalPages(jadwalSeminarProposal.length, seminarPageSize)}
                </button>
              )}

              <button
                onClick={() => setSeminarPage((p) => Math.min(getTotalPages(jadwalSeminarProposal.length, seminarPageSize), p + 1))}
                disabled={seminarPage === getTotalPages(jadwalSeminarProposal.length, seminarPageSize)}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Section Sidang Skripsi */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">
            Sidang Skripsi
          </h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSidangUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform cursor-pointer">
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-brand-700 dark:text-brand-200" />
              Import Excel
            </button>
            <button
              onClick={downloadSidangTemplate}
              className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
              Download Template Excel
            </button>
            <button
              onClick={exportSidangSkripsiExcel}
              disabled={jadwalSidangSkripsi.length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs transition flex items-center gap-2 ${jadwalSidangSkripsi.length === 0
                ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed'
                : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800'
                }`}
              title={jadwalSidangSkripsi.length === 0 ? 'Tidak ada data Sidang Skripsi. Silakan tambahkan data jadwal terlebih dahulu untuk melakukan export.' : 'Export data Sidang Skripsi ke Excel'}
            >
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
              Export ke Excel
            </button>
            <button
              onClick={() => {
                setForm({
                  hariTanggal: '',
                  jamMulai: '',
                  jumlahKali: 2,
                  jamSelesai: '',
                  pengampu: null,
                  materi: '',
                  lokasi: null,
                  jenisBaris: 'sidang_skripsi',
                  agenda: '',
                  kelompokBesar: null,
                  pembimbing: null,
                  komentator: [],
                  penguji: [],
                  mahasiswa: [],
                  useRuangan: true,
                });
                setEditIndex(null);
                setShowModal(true);
                setErrorForm('');
                setErrorBackend('');
              }}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition-all duration-300 flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <svg className="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>
                  Menyimpan...
                </>
              ) : (
                'Tambah Jadwal'
              )}
            </button>
          </div>
        </div>

        {/* Success Message Import Sidang Skripsi */}
        <AnimatePresence>
          {sidangImportedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
              onAnimationComplete={() => {
                setTimeout(() => {
                  setSidangImportedCount(0);
                }, 5000);
              }}
            >
              {sidangImportedCount} jadwal Sidang Skripsi berhasil diimpor ke database.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Success Message Bulk Delete Sidang Skripsi */}
        <AnimatePresence>
          {sidangSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {sidangSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tabel Sidang Skripsi */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <button
                      type="button"
                      aria-checked={jadwalSidangSkripsi.length > 0 && jadwalSidangSkripsi.every(item => selectedSidangItems.includes(item.id!))}
                      role="checkbox"
                      onClick={() => handleSidangSelectAll(!(jadwalSidangSkripsi.length > 0 && jadwalSidangSkripsi.every(item => selectedSidangItems.includes(item.id!))))}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${jadwalSidangSkripsi.length > 0 && jadwalSidangSkripsi.every(item => selectedSidangItems.includes(item.id!)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                    >
                      {jadwalSidangSkripsi.length > 0 && jadwalSidangSkripsi.every(item => selectedSidangItems.includes(item.id!)) && (
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
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pembimbing</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Penguji</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400" style={{ minWidth: '300px' }}>Mahasiswa</th>
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {jadwalSidangSkripsi.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-6 text-gray-400">Tidak ada data Sidang Skripsi</td>
                  </tr>
                ) : (
                  getPaginatedData(
                    jadwalSidangSkripsi
                      .slice()
                      .sort((a, b) => {
                        const dateA = new Date(a.tanggal);
                        const dateB = new Date(b.tanggal);
                        return dateA.getTime() - dateB.getTime();
                      }),
                    sidangPage,
                    sidangPageSize
                  ).map((row, idx) => (
                    <tr key={row.id} className={idx % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}>
                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          aria-checked={selectedSidangItems.includes(row.id!)}
                          role="checkbox"
                          onClick={() => handleSidangSelectItem(row.id!)}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedSidangItems.includes(row.id!) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                        >
                          {selectedSidangItems.includes(row.id!) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <polyline points="20 7 11 17 4 10" />
                            </svg>
                          )}
                        </button>
                      </td>
                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{(sidangPage - 1) * sidangPageSize + idx + 1}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatTanggalKonsisten(row.tanggal)}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatJamTanpaDetik(row.jam_mulai)}–{formatJamTanpaDetik(row.jam_selesai)}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi} x 50 menit</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.pembimbing?.name || '-'}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {row.penguji && Array.isArray(row.penguji) && row.penguji.length > 0
                          ? row.penguji.map((p: any) => p.name || p).join(', ')
                          : '-'}
                      </td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90" style={{ minWidth: '300px' }}>
                        {(() => {
                          if (!row.mahasiswa_nims || row.mahasiswa_nims.length === 0) {
                            return '-';
                          }

                          // Ambil nama mahasiswa dari mahasiswaList berdasarkan NIM
                          const mahasiswaNames = row.mahasiswa_nims
                            .map((nim: string) => {
                              const mahasiswa = mahasiswaList.find(m => m.nim === nim);
                              return mahasiswa ? mahasiswa.name : null;
                            })
                            .filter(Boolean);

                          const displayCount = 3;
                          const displayNames = mahasiswaNames.slice(0, displayCount);
                          const remainingCount = mahasiswaNames.length - displayCount;

                          return (
                            <div className="flex flex-wrap items-center gap-1">
                              {displayNames.map((name, idx) => (
                                <span key={idx} className="text-sm">
                                  {name}
                                  {idx < displayNames.length - 1 && ','}
                                </span>
                              ))}
                              {remainingCount > 0 && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const allMahasiswa = row.mahasiswa_nims
                                      .map((nim: string) => mahasiswaList.find(m => m.nim === nim))
                                      .filter(Boolean) as MahasiswaOption[];
                                    setSelectedMahasiswaList(allMahasiswa);
                                    setMahasiswaSearchQuery('');
                                    setMahasiswaModalPage(1);
                                    setShowMahasiswaModal(true);
                                  }}
                                  className="text-sm text-brand-500 hover:text-brand-600 dark:text-brand-400 dark:hover:text-brand-300 font-medium underline cursor-pointer ml-1"
                                >
                                  +{remainingCount} lebih banyak
                                </button>
                              )}
                            </div>
                          );
                        })()}
                      </td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {row.ruangan?.nama || '-'}
                      </td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5 flex-nowrap">
                          <button onClick={(e) => {
                            e.stopPropagation();
                            if (row.id) {
                              navigate(`/bimbingan-akhir/sidang-skripsi/${row.id}`);
                            }
                          }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-500 hover:text-green-700 dark:hover:text-green-300 transition mr-1" title="Detail Sidang Skripsi">
                            <FontAwesomeIcon icon={faEye} className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                            <span className="hidden sm:inline">Detail</span>
                          </button>
                          <button onClick={() => {
                            const correctIndex = jadwalSidangSkripsi.findIndex(j => j.id === row.id);
                            handleEditJadwal(correctIndex >= 0 ? correctIndex : idx, 'sidang_skripsi');
                          }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition mr-1" title="Edit Jadwal">
                            <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button onClick={() => {
                            const correctIndex = jadwalSidangSkripsi.findIndex(j => j.id === row.id);
                            setSelectedDeleteIndex(correctIndex >= 0 ? correctIndex : idx);
                            setForm({ ...form, jenisBaris: 'sidang_skripsi' });
                            setShowDeleteModal(true);
                          }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" title="Hapus Jadwal">
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

        {/* Tombol Hapus Terpilih untuk Sidang Skripsi */}
        {selectedSidangItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              disabled={isSidangDeleting}
              onClick={() => setShowSidangBulkDeleteModal(true)}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${isSidangDeleting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-theme-xs hover:bg-red-600'}`}
            >
              {isSidangDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedSidangItems.length})`}
            </button>
          </div>
        )}

        {/* Pagination for Sidang Skripsi */}
        {jadwalSidangSkripsi.length > 0 && (
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan {((sidangPage - 1) * sidangPageSize) + 1} - {Math.min(sidangPage * sidangPageSize, jadwalSidangSkripsi.length)} dari {jadwalSidangSkripsi.length} data
              </span>

              <select
                value={sidangPageSize}
                onChange={(e) => {
                  setSidangPageSize(Number(e.target.value));
                  setSidangPage(1);
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
              <button
                onClick={() => setSidangPage((p) => Math.max(1, p - 1))}
                disabled={sidangPage === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Previous
              </button>

              {/* Always show first page if it's not the current page */}
              {getTotalPages(jadwalSidangSkripsi.length, sidangPageSize) > 1 && (
                <button
                  onClick={() => setSidangPage(1)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${sidangPage === 1
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                >
                  1
                </button>
              )}

              {/* Show pages around current page */}
              {Array.from({ length: getTotalPages(jadwalSidangSkripsi.length, sidangPageSize) }, (_, i) => {
                const pageNum = i + 1;
                // Show pages around current page (2 pages before and after)
                const shouldShow =
                  pageNum > 1 &&
                  pageNum < getTotalPages(jadwalSidangSkripsi.length, sidangPageSize) &&
                  pageNum >= sidangPage - 2 &&
                  pageNum <= sidangPage + 2;

                if (!shouldShow) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setSidangPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${sidangPage === pageNum
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Show ellipsis if current page is far from end */}
              {sidangPage < getTotalPages(jadwalSidangSkripsi.length, sidangPageSize) - 3 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">
                  ...
                </span>
              )}

              {/* Always show last page if it's not the first page */}
              {getTotalPages(jadwalSidangSkripsi.length, sidangPageSize) > 1 && (
                <button
                  onClick={() => setSidangPage(getTotalPages(jadwalSidangSkripsi.length, sidangPageSize))}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${sidangPage === getTotalPages(jadwalSidangSkripsi.length, sidangPageSize)
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                >
                  {getTotalPages(jadwalSidangSkripsi.length, sidangPageSize)}
                </button>
              )}

              <button
                onClick={() => setSidangPage((p) => Math.min(getTotalPages(jadwalSidangSkripsi.length, sidangPageSize), p + 1))}
                disabled={sidangPage === getTotalPages(jadwalSidangSkripsi.length, sidangPageSize)}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* MODAL INPUT JADWAL */}
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
                <select name="jenisBaris" value={form.jenisBaris} onChange={handleFormChange} disabled className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base cursor-not-allowed">
                  <option value="materi">Materi Kuliah</option>
                  <option value="agenda">Agenda Khusus</option>
                  <option value="seminar_proposal">Seminar Proposal</option>
                  <option value="sidang_skripsi">Sidang Skripsi</option>
                </select>
              </div>
              <div className="space-y-4">
                {form.jenisBaris === 'agenda' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Hari/Tanggal
                      </label>
                      <input
                        type="date"
                        name="hariTanggal"
                        value={form.hariTanggal || ""}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      {errorForm && (
                        <div className="text-sm text-red-500 mt-2">
                          {errorForm}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Jam Mulai
                        </label>
                        <Select
                          options={jamOptions.map((j: string) => ({
                            value: j,
                            label: j,
                          }))}
                          value={
                            jamOptions
                              .map((j: string) => ({ value: j, label: j }))
                              .find(
                                (opt: any) => opt.value === form.jamMulai
                              ) || null
                          }
                          onChange={(opt: any) => {
                            const value = opt?.value || "";
                            setForm((f) => ({
                              ...f,
                              jamMulai: value,
                              jamSelesai: hitungJamSelesai(
                                value,
                                f.jumlahKali
                              ),
                            }));
                          }}
                          classNamePrefix="react-select"
                          className="react-select-container"
                          isClearable
                          placeholder="Pilih Jam Mulai"
                          styles={{
                            control: (base, state) => ({
                              ...base,
                              backgroundColor:
                                document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#f9fafb",
                              borderColor: state.isFocused
                                ? "#3b82f6"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#334155"
                                  : "#d1d5db",
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                              boxShadow: state.isFocused
                                ? "0 0 0 2px #3b82f633"
                                : undefined,
                              borderRadius: "0.75rem",
                              minHeight: "2.5rem",
                              fontSize: "1rem",
                              paddingLeft: "0.75rem",
                              paddingRight: "0.75rem",
                              "&:hover": { borderColor: "#3b82f6" },
                            }),
                            menu: (base) => ({
                              ...base,
                              zIndex: 9999,
                              fontSize: "1rem",
                              backgroundColor:
                                document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#fff",
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isSelected
                                ? "#3b82f6"
                                : state.isFocused
                                  ? document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#334155"
                                    : "#e0e7ff"
                                  : document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#1e293b"
                                    : "#fff",
                              color: state.isSelected
                                ? "#fff"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#fff"
                                  : "#1f2937",
                              fontSize: "1rem",
                            }),
                            singleValue: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            placeholder: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#64748b"
                                : "#6b7280",
                            }),
                            input: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            dropdownIndicator: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#64748b"
                                : "#6b7280",
                              "&:hover": { color: "#3b82f6" },
                            }),
                            indicatorSeparator: (base) => ({
                              ...base,
                              backgroundColor: "transparent",
                            }),
                          }}
                        />
                      </div>

                      <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          x 50 menit
                        </label>
                        <select
                          name="jumlahKali"
                          value={form.jumlahKali}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <option key={n} value={n}>
                              {n} x 50'
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Jam Selesai
                      </label>
                      <input
                        type="text"
                        name="jamSelesai"
                        value={form.jamSelesai}
                        readOnly
                        className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Agenda
                      </label>
                      <input
                        type="text"
                        name="agenda"
                        value={form.agenda}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Kelompok Besar
                      </label>
                      {kelompokBesarAgendaOptions.length === 0 ? (
                        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                          <div className="flex items-center gap-2">
                            <svg
                              className="w-5 h-5 text-orange-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                              Belum ada kelompok besar yang ditambahkan untuk
                              mata kuliah ini
                            </span>
                          </div>
                          <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                            Silakan tambahkan kelompok besar terlebih dahulu
                            di halaman Kelompok Detail
                          </p>
                        </div>
                      ) : (
                        <Select
                          options={kelompokBesarAgendaOptions.map((k) => ({
                            value: Number(k.id),
                            label: k.label,
                          }))}
                          value={
                            kelompokBesarAgendaOptions
                              .map((k) => ({
                                value: Number(k.id),
                                label: k.label,
                              }))
                              .find(
                                (opt) => opt.value === form.kelompokBesar
                              ) || null
                          }
                          onChange={(opt) =>
                            setForm((f) => ({
                              ...f,
                              kelompokBesar: opt ? Number(opt.value) : null,
                            }))
                          }
                          placeholder="Pilih Kelompok Besar"
                          isClearable
                          isSearchable={false}
                          classNamePrefix="react-select"
                          className="react-select-container"
                          styles={{
                            control: (base, state) => ({
                              ...base,
                              backgroundColor:
                                document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#f9fafb",
                              borderColor: state.isFocused
                                ? "#3b82f6"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#334155"
                                  : "#d1d5db",
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                              boxShadow: state.isFocused
                                ? "0 0 0 2px #3b82f633"
                                : undefined,
                              borderRadius: "0.75rem",
                              minHeight: "2.5rem",
                              fontSize: "1rem",
                              paddingLeft: "0.75rem",
                              paddingRight: "0.75rem",
                              "&:hover": { borderColor: "#3b82f6" },
                            }),
                            menu: (base) => ({
                              ...base,
                              zIndex: 9999,
                              fontSize: "1rem",
                              backgroundColor:
                                document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#fff",
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isSelected
                                ? "#3b82f6"
                                : state.isFocused
                                  ? document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#334155"
                                    : "#e0e7ff"
                                  : document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#1e293b"
                                    : "#fff",
                              color: state.isSelected
                                ? "#fff"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#fff"
                                  : "#1f2937",
                              fontSize: "1rem",
                            }),
                            singleValue: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            placeholder: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#64748b"
                                : "#6b7280",
                            }),
                            input: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            dropdownIndicator: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#64748b"
                                : "#6b7280",
                              "&:hover": { color: "#3b82f6" },
                            }),
                            indicatorSeparator: (base) => ({
                              ...base,
                              backgroundColor: "transparent",
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
                            onChange={(e) =>
                              setForm((f) => ({
                                ...f,
                                useRuangan: e.target.checked,
                              }))
                            }
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

                    {form.useRuangan && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Ruangan
                        </label>
                        {ruanganList.length === 0 ? (
                          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                            <div className="flex items-center gap-2">
                              <svg
                                className="w-5 h-5 text-orange-500"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                  clipRule="evenodd"
                                />
                              </svg>
                              <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                                Belum ada ruangan yang ditambahkan untuk mata
                                kuliah ini
                              </span>
                            </div>
                            <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                              Silakan tambahkan ruangan terlebih dahulu di
                              halaman Ruangan Detail
                            </p>
                          </div>
                        ) : (
                          <Select
                            options={ruanganOptions}
                            value={
                              ruanganOptions.find(
                                (opt: any) => opt.value === form.lokasi
                              ) || null
                            }
                            onChange={(opt: any) => {
                              setForm({ ...form, lokasi: opt?.value || null });
                              setErrorForm("");
                            }}
                            placeholder="Pilih Ruangan"
                            isClearable
                            classNamePrefix="react-select"
                            className="react-select-container"
                            styles={{
                              control: (base, state) => ({
                                ...base,
                                backgroundColor: state.isDisabled
                                  ? document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#1e293b"
                                    : "#f3f4f6"
                                  : document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#1e293b"
                                    : "#f9fafb",
                                borderColor: state.isFocused
                                  ? "#3b82f6"
                                  : document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#334155"
                                    : "#d1d5db",
                                boxShadow: state.isFocused
                                  ? "0 0 0 2px #3b82f633"
                                  : undefined,
                                borderRadius: "0.75rem",
                                minHeight: "2.5rem",
                                fontSize: "1rem",
                                color: document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#fff"
                                  : "#1f2937",
                                paddingLeft: "0.75rem",
                                paddingRight: "0.75rem",
                                "&:hover": { borderColor: "#3b82f6" },
                              }),
                              menu: (base) => ({
                                ...base,
                                zIndex: 9999,
                                fontSize: "1rem",
                                backgroundColor:
                                  document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#1e293b"
                                    : "#fff",
                                color: document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#fff"
                                  : "#1f2937",
                              }),
                              option: (base, state) => ({
                                ...base,
                                backgroundColor: state.isSelected
                                  ? "#3b82f6"
                                  : state.isFocused
                                    ? document.documentElement.classList.contains(
                                      "dark"
                                    )
                                      ? "#334155"
                                      : "#e0e7ff"
                                    : document.documentElement.classList.contains(
                                      "dark"
                                    )
                                      ? "#1e293b"
                                      : "#fff",
                                color: state.isSelected
                                  ? "#fff"
                                  : document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#fff"
                                    : "#1f2937",
                                fontSize: "1rem",
                              }),
                              singleValue: (base) => ({
                                ...base,
                                color: document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#fff"
                                  : "#1f2937",
                              }),
                              placeholder: (base) => ({
                                ...base,
                                color: document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#64748b"
                                  : "#6b7280",
                              }),
                              input: (base) => ({
                                ...base,
                                color: document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#fff"
                                  : "#1f2937",
                              }),
                              dropdownIndicator: (base) => ({
                                ...base,
                                color: document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#64748b"
                                  : "#6b7280",
                                "&:hover": { color: "#3b82f6" },
                              }),
                              indicatorSeparator: (base) => ({
                                ...base,
                                backgroundColor: "transparent",
                              }),
                            }}
                          />
                        )}
                      </div>
                    )}
                  </>
                ) : form.jenisBaris === 'seminar_proposal' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Hari/Tanggal
                      </label>
                      <input
                        type="date"
                        name="hariTanggal"
                        value={form.hariTanggal || ""}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      {errorForm && (errorForm.includes('Tanggal tidak boleh') || errorForm.includes('tidak boleh sebelum') || errorForm.includes('tidak boleh setelah')) && (
                        <div className="text-sm text-red-500 mt-2">{errorForm}</div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Jam Mulai
                        </label>
                        <Select
                          options={jamOptions.map((j: string) => ({
                            value: j,
                            label: j,
                          }))}
                          value={
                            jamOptions
                              .map((j: string) => ({ value: j, label: j }))
                              .find(
                                (opt: any) => opt.value === form.jamMulai
                              ) || null
                          }
                          onChange={(opt: any) => {
                            const value = opt?.value || "";
                            setForm((f) => ({
                              ...f,
                              jamMulai: value,
                              jamSelesai: hitungJamSelesai(
                                value,
                                f.jumlahKali
                              ),
                            }));
                          }}
                          classNamePrefix="react-select"
                          className="react-select-container"
                          isClearable
                          placeholder="Pilih Jam Mulai"
                          styles={{
                            control: (base, state) => ({
                              ...base,
                              backgroundColor:
                                document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#f9fafb",
                              borderColor: state.isFocused
                                ? "#3b82f6"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#334155"
                                  : "#d1d5db",
                              boxShadow: state.isFocused
                                ? "0 0 0 2px #3b82f633"
                                : undefined,
                              borderRadius: "0.75rem",
                              minHeight: "2.5rem",
                              fontSize: "1rem",
                              paddingLeft: "0.75rem",
                              paddingRight: "0.75rem",
                              "&:hover": { borderColor: "#3b82f6" },
                            }),
                            menu: (base) => ({
                              ...base,
                              zIndex: 9999,
                              fontSize: "1rem",
                              backgroundColor:
                                document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#fff",
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isSelected
                                ? "#3b82f6"
                                : state.isFocused
                                  ? document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#334155"
                                    : "#e0e7ff"
                                  : document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#1e293b"
                                    : "#fff",
                              color: state.isSelected
                                ? "#fff"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#fff"
                                  : "#1f2937",
                              fontSize: "1rem",
                            }),
                            singleValue: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            placeholder: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#64748b"
                                : "#6b7280",
                            }),
                            input: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            dropdownIndicator: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#64748b"
                                : "#6b7280",
                              "&:hover": { color: "#3b82f6" },
                            }),
                            indicatorSeparator: (base) => ({
                              ...base,
                              backgroundColor: "transparent",
                            }),
                          }}
                        />
                      </div>

                      <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          x 50 menit
                        </label>
                        <select
                          name="jumlahKali"
                          value={form.jumlahKali}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <option key={n} value={n}>
                              {n} x 50'
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Jam Selesai
                      </label>
                      <input
                        type="text"
                        name="jamSelesai"
                        value={form.jamSelesai || ""}
                        readOnly
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Pembimbing
                      </label>
                      <Select
                        options={dosenList
                          .filter((d: DosenOption) => {
                            // Filter out dosen yang sudah dipilih sebagai komentator (untuk Seminar Proposal)
                            if (form.jenisBaris === 'seminar_proposal' && form.komentator.includes(d.id)) {
                              return false;
                            }
                            // Filter out dosen yang sudah dipilih sebagai penguji (untuk Sidang Skripsi)
                            if (form.jenisBaris === 'sidang_skripsi' && form.penguji.includes(d.id)) {
                              return false;
                            }
                            return true;
                          })
                          .map((d: DosenOption) => ({
                            value: d.id,
                            label: d.name,
                          }))}
                        value={
                          dosenList
                            .map((d: DosenOption) => ({
                              value: d.id,
                              label: d.name,
                            }))
                            .find((opt: any) => opt.value === form.pembimbing) || null
                        }
                        onChange={(opt: any) => {
                          const newPembimbingId = opt?.value || null;
                          // Validasi: Cek apakah dosen yang dipilih sudah ada di komentator (untuk Seminar Proposal)
                          if (form.jenisBaris === 'seminar_proposal' && newPembimbingId && form.komentator.includes(newPembimbingId)) {
                            setErrorForm('Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Komentator');
                            return;
                          }
                          // Validasi: Cek apakah dosen yang dipilih sudah ada di penguji (untuk Sidang Skripsi)
                          if (form.jenisBaris === 'sidang_skripsi' && newPembimbingId && form.penguji.includes(newPembimbingId)) {
                            setErrorForm('Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Penguji');
                            return;
                          }
                          setForm({ ...form, pembimbing: newPembimbingId });
                          setErrorForm("");
                        }}
                        placeholder="Pilih Pembimbing"
                        isClearable
                        classNamePrefix="react-select"
                        className="react-select-container"
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            backgroundColor:
                              document.documentElement.classList.contains("dark")
                                ? "#1e293b"
                                : "#f9fafb",
                            borderColor: state.isFocused
                              ? "#3b82f6"
                              : document.documentElement.classList.contains("dark")
                                ? "#334155"
                                : "#d1d5db",
                            boxShadow: state.isFocused
                              ? "0 0 0 2px #3b82f633"
                              : undefined,
                            borderRadius: "0.75rem",
                            minHeight: "2.5rem",
                            fontSize: "1rem",
                            paddingLeft: "0.75rem",
                            paddingRight: "0.75rem",
                            "&:hover": { borderColor: "#3b82f6" },
                          }),
                          menu: (base) => ({
                            ...base,
                            zIndex: 9999,
                            fontSize: "1rem",
                            backgroundColor:
                              document.documentElement.classList.contains("dark")
                                ? "#1e293b"
                                : "#fff",
                            color: document.documentElement.classList.contains("dark")
                              ? "#fff"
                              : "#1f2937",
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isSelected
                              ? "#3b82f6"
                              : state.isFocused
                                ? document.documentElement.classList.contains("dark")
                                  ? "#334155"
                                  : "#e0e7ff"
                                : document.documentElement.classList.contains("dark")
                                  ? "#1e293b"
                                  : "#fff",
                            color: state.isSelected
                              ? "#fff"
                              : document.documentElement.classList.contains("dark")
                                ? "#fff"
                                : "#1f2937",
                            fontSize: "1rem",
                          }),
                          singleValue: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains("dark")
                              ? "#fff"
                              : "#1f2937",
                          }),
                          placeholder: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains("dark")
                              ? "#64748b"
                              : "#6b7280",
                          }),
                          input: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains("dark")
                              ? "#fff"
                              : "#1f2937",
                          }),
                          dropdownIndicator: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains("dark")
                              ? "#64748b"
                              : "#6b7280",
                            "&:hover": { color: "#3b82f6" },
                          }),
                          indicatorSeparator: (base) => ({
                            ...base,
                            backgroundColor: "transparent",
                          }),
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Komentator (Maksimal 2)
                      </label>
                      <Select
                        isMulti
                        options={dosenList
                          .filter((d: DosenOption) => {
                            // Filter out dosen yang sudah dipilih sebagai pembimbing
                            if (form.pembimbing === d.id) {
                              return false;
                            }
                            return true;
                          })
                          .map((d: DosenOption) => ({
                            value: d.id,
                            label: d.name,
                          }))}
                        value={
                          dosenList
                            .map((d: DosenOption) => ({
                              value: d.id,
                              label: d.name,
                            }))
                            .filter((opt: any) => form.komentator.includes(opt.value)) || []
                        }
                        onChange={(opts: any) => {
                          const selectedIds = opts ? opts.map((opt: any) => opt.value) : [];
                          if (selectedIds.length > 2) {
                            setErrorForm("Komentator maksimal 2 orang");
                            return;
                          }
                          // Validasi: Cek apakah ada dosen yang sama di pembimbing
                          if (form.pembimbing && selectedIds.includes(form.pembimbing)) {
                            setErrorForm('Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Komentator');
                            return;
                          }
                          setForm({ ...form, komentator: selectedIds });
                          setErrorForm("");
                        }}
                        placeholder="Pilih Komentator (Maksimal 2)"
                        isClearable
                        classNamePrefix="react-select"
                        className="react-select-container"
                        maxMenuHeight={200}
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            backgroundColor:
                              document.documentElement.classList.contains("dark")
                                ? "#1e293b"
                                : "#f9fafb",
                            borderColor: state.isFocused
                              ? "#3b82f6"
                              : document.documentElement.classList.contains("dark")
                                ? "#334155"
                                : "#d1d5db",
                            boxShadow: state.isFocused
                              ? "0 0 0 2px #3b82f633"
                              : undefined,
                            borderRadius: "0.75rem",
                            minHeight: "2.5rem",
                            fontSize: "1rem",
                            paddingLeft: "0.75rem",
                            paddingRight: "0.75rem",
                            "&:hover": { borderColor: "#3b82f6" },
                          }),
                          menu: (base) => ({
                            ...base,
                            zIndex: 9999,
                            fontSize: "1rem",
                            backgroundColor:
                              document.documentElement.classList.contains("dark")
                                ? "#1e293b"
                                : "#fff",
                            color: document.documentElement.classList.contains("dark")
                              ? "#fff"
                              : "#1f2937",
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isSelected
                              ? "#3b82f6"
                              : state.isFocused
                                ? document.documentElement.classList.contains("dark")
                                  ? "#334155"
                                  : "#e0e7ff"
                                : document.documentElement.classList.contains("dark")
                                  ? "#1e293b"
                                  : "#fff",
                            color: state.isSelected
                              ? "#fff"
                              : document.documentElement.classList.contains("dark")
                                ? "#fff"
                                : "#1f2937",
                            fontSize: "1rem",
                          }),
                          multiValue: (base) => ({
                            ...base,
                            backgroundColor: "#3b82f6",
                            color: "#fff",
                          }),
                          multiValueLabel: (base) => ({
                            ...base,
                            color: "#fff",
                          }),
                          multiValueRemove: (base) => ({
                            ...base,
                            color: "#fff",
                            "&:hover": {
                              backgroundColor: "#2563eb",
                              color: "#fff",
                            },
                          }),
                          placeholder: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains("dark")
                              ? "#64748b"
                              : "#6b7280",
                          }),
                          input: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains("dark")
                              ? "#fff"
                              : "#1f2937",
                          }),
                          dropdownIndicator: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains("dark")
                              ? "#64748b"
                              : "#6b7280",
                            "&:hover": { color: "#3b82f6" },
                          }),
                          indicatorSeparator: (base) => ({
                            ...base,
                            backgroundColor: "transparent",
                          }),
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Mahasiswa
                      </label>
                      <Select
                        isMulti
                        options={mahasiswaList.map((m: MahasiswaOption) => ({
                          value: m.nim,
                          label: m.label,
                        }))}
                        value={
                          mahasiswaList
                            .map((m: MahasiswaOption) => ({
                              value: m.nim,
                              label: m.label,
                            }))
                            .filter((opt: any) => form.mahasiswa.includes(opt.value)) || []
                        }
                        onChange={(opts: any) => {
                          const selectedNims = opts ? opts.map((opt: any) => opt.value) : [];
                          setForm({ ...form, mahasiswa: selectedNims });
                          setErrorForm("");
                        }}
                        placeholder="Pilih Mahasiswa"
                        isClearable
                        classNamePrefix="react-select"
                        className="react-select-container"
                        maxMenuHeight={200}
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            backgroundColor:
                              document.documentElement.classList.contains("dark")
                                ? "#1e293b"
                                : "#f9fafb",
                            borderColor: state.isFocused
                              ? "#3b82f6"
                              : document.documentElement.classList.contains("dark")
                                ? "#334155"
                                : "#d1d5db",
                            boxShadow: state.isFocused
                              ? "0 0 0 2px #3b82f633"
                              : undefined,
                            borderRadius: "0.75rem",
                            minHeight: "2.5rem",
                            fontSize: "1rem",
                            paddingLeft: "0.75rem",
                            paddingRight: "0.75rem",
                            "&:hover": { borderColor: "#3b82f6" },
                          }),
                          menu: (base) => ({
                            ...base,
                            zIndex: 9999,
                            fontSize: "1rem",
                            backgroundColor:
                              document.documentElement.classList.contains("dark")
                                ? "#1e293b"
                                : "#fff",
                            color: document.documentElement.classList.contains("dark")
                              ? "#fff"
                              : "#1f2937",
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isSelected
                              ? "#3b82f6"
                              : state.isFocused
                                ? document.documentElement.classList.contains("dark")
                                  ? "#334155"
                                  : "#e0e7ff"
                                : document.documentElement.classList.contains("dark")
                                  ? "#1e293b"
                                  : "#fff",
                            color: state.isSelected
                              ? "#fff"
                              : document.documentElement.classList.contains("dark")
                                ? "#fff"
                                : "#1f2937",
                            fontSize: "1rem",
                          }),
                          multiValue: (base) => ({
                            ...base,
                            backgroundColor: "#3b82f6",
                            color: "#fff",
                          }),
                          multiValueLabel: (base) => ({
                            ...base,
                            color: "#fff",
                          }),
                          multiValueRemove: (base) => ({
                            ...base,
                            color: "#fff",
                            "&:hover": {
                              backgroundColor: "#2563eb",
                              color: "#fff",
                            },
                          }),
                          placeholder: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains("dark")
                              ? "#64748b"
                              : "#6b7280",
                          }),
                          input: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains("dark")
                              ? "#fff"
                              : "#1f2937",
                          }),
                          dropdownIndicator: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains("dark")
                              ? "#64748b"
                              : "#6b7280",
                            "&:hover": { color: "#3b82f6" },
                          }),
                          indicatorSeparator: (base) => ({
                            ...base,
                            backgroundColor: "transparent",
                          }),
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Ruangan
                      </label>
                      {ruanganList.length === 0 ? (
                        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                          <div className="flex items-center gap-2">
                            <svg
                              className="w-5 h-5 text-orange-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                              Belum ada ruangan yang ditambahkan untuk mata
                              kuliah ini
                            </span>
                          </div>
                          <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                            Silakan tambahkan ruangan terlebih dahulu di
                            halaman Ruangan Detail
                          </p>
                        </div>
                      ) : (
                        <Select
                          options={getRuanganOptions(ruanganList || [])}
                          value={
                            getRuanganOptions(ruanganList || []).find(
                              (opt: any) => opt.value === form.lokasi
                            ) || null
                          }
                          onChange={(opt: any) => {
                            setForm({ ...form, lokasi: opt?.value || null });
                            setErrorForm("");
                          }}
                          placeholder="Pilih Ruangan"
                          isClearable
                          classNamePrefix="react-select"
                          className="react-select-container"
                          styles={{
                            control: (base, state) => ({
                              ...base,
                              backgroundColor: state.isDisabled
                                ? document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#f3f4f6"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#f9fafb",
                              borderColor: state.isFocused
                                ? "#3b82f6"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#334155"
                                  : "#d1d5db",
                              boxShadow: state.isFocused
                                ? "0 0 0 2px #3b82f633"
                                : undefined,
                              borderRadius: "0.75rem",
                              minHeight: "2.5rem",
                              fontSize: "1rem",
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                              paddingLeft: "0.75rem",
                              paddingRight: "0.75rem",
                              "&:hover": { borderColor: "#3b82f6" },
                            }),
                            menu: (base) => ({
                              ...base,
                              zIndex: 9999,
                              fontSize: "1rem",
                              backgroundColor:
                                document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#fff",
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isSelected
                                ? "#3b82f6"
                                : state.isFocused
                                  ? document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#334155"
                                    : "#e0e7ff"
                                  : document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#1e293b"
                                    : "#fff",
                              color: state.isSelected
                                ? "#fff"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#fff"
                                  : "#1f2937",
                              fontSize: "1rem",
                            }),
                            singleValue: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            placeholder: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#64748b"
                                : "#6b7280",
                            }),
                            input: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            dropdownIndicator: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#64748b"
                                : "#6b7280",
                              "&:hover": { color: "#3b82f6" },
                            }),
                            indicatorSeparator: (base) => ({
                              ...base,
                              backgroundColor: "transparent",
                            }),
                          }}
                        />
                      )}
                    </div>
                  </>
                ) : form.jenisBaris === 'sidang_skripsi' ? (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Hari/Tanggal
                      </label>
                      <input
                        type="date"
                        name="hariTanggal"
                        value={form.hariTanggal || ""}
                        onChange={handleFormChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                      {errorForm && (errorForm.includes('Tanggal tidak boleh') || errorForm.includes('tidak boleh sebelum') || errorForm.includes('tidak boleh setelah')) && (
                        <div className="text-sm text-red-500 mt-2">{errorForm}</div>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Jam Mulai
                        </label>
                        <Select
                          options={jamOptions.map((j: string) => ({
                            value: j,
                            label: j,
                          }))}
                          value={
                            jamOptions
                              .map((j: string) => ({ value: j, label: j }))
                              .find(
                                (opt: any) => opt.value === form.jamMulai
                              ) || null
                          }
                          onChange={(opt: any) => {
                            const value = opt?.value || "";
                            setForm((f) => ({
                              ...f,
                              jamMulai: value,
                              jamSelesai: hitungJamSelesai(
                                value,
                                f.jumlahKali
                              ),
                            }));
                            setErrorForm("");
                          }}
                          placeholder="Pilih Jam Mulai"
                          classNamePrefix="react-select"
                          className="react-select-container"
                          styles={{
                            control: (base, state) => ({
                              ...base,
                              backgroundColor: state.isDisabled
                                ? document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#f3f4f6"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#f9fafb",
                              borderColor: state.isFocused
                                ? "#3b82f6"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#334155"
                                  : "#d1d5db",
                              boxShadow: state.isFocused
                                ? "0 0 0 2px #3b82f633"
                                : undefined,
                              borderRadius: "0.75rem",
                              minHeight: "2.5rem",
                              fontSize: "1rem",
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                              paddingLeft: "0.75rem",
                              paddingRight: "0.75rem",
                              "&:hover": { borderColor: "#3b82f6" },
                            }),
                            menu: (base) => ({
                              ...base,
                              zIndex: 9999,
                              fontSize: "1rem",
                              backgroundColor:
                                document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#fff",
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isSelected
                                ? "#3b82f6"
                                : state.isFocused
                                  ? document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#334155"
                                    : "#e0e7ff"
                                  : document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#1e293b"
                                    : "#fff",
                              color: state.isSelected
                                ? "#fff"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#fff"
                                  : "#1f2937",
                              fontSize: "1rem",
                            }),
                            singleValue: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            placeholder: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#64748b"
                                : "#6b7280",
                            }),
                            input: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            dropdownIndicator: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#64748b"
                                : "#6b7280",
                              "&:hover": { color: "#3b82f6" },
                            }),
                            indicatorSeparator: (base) => ({
                              ...base,
                              backgroundColor: "transparent",
                            }),
                          }}
                        />
                      </div>

                      <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          x 50 menit
                        </label>
                        <select
                          name="jumlahKali"
                          value={form.jumlahKali}
                          onChange={handleFormChange}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                        >
                          {[1, 2, 3, 4, 5, 6].map((n) => (
                            <option key={n} value={n}>
                              {n} x 50'
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Jam Selesai
                      </label>
                      <input
                        type="text"
                        name="jamSelesai"
                        value={form.jamSelesai || ""}
                        readOnly
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Pembimbing
                      </label>
                      <Select
                        options={dosenList
                          .filter((d: DosenOption) => {
                            // Filter out dosen yang sudah dipilih sebagai penguji
                            if (form.penguji.includes(d.id)) {
                              return false;
                            }
                            return true;
                          })
                          .map((d: DosenOption) => ({
                            value: d.id,
                            label: d.name,
                          }))}
                        value={
                          dosenList
                            .map((d: DosenOption) => ({
                              value: d.id,
                              label: d.name,
                            }))
                            .find((opt: any) => opt.value === form.pembimbing) ||
                          null
                        }
                        onChange={(opt: any) => {
                          setForm({ ...form, pembimbing: opt?.value || null });
                          setErrorForm("");
                        }}
                        placeholder="Pilih Pembimbing"
                        isClearable
                        classNamePrefix="react-select"
                        className="react-select-container"
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            backgroundColor: state.isDisabled
                              ? document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#1e293b"
                                : "#f3f4f6"
                              : document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#1e293b"
                                : "#f9fafb",
                            borderColor: state.isFocused
                              ? "#3b82f6"
                              : document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#334155"
                                : "#d1d5db",
                            boxShadow: state.isFocused
                              ? "0 0 0 2px #3b82f633"
                              : undefined,
                            borderRadius: "0.75rem",
                            minHeight: "2.5rem",
                            fontSize: "1rem",
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#fff"
                              : "#1f2937",
                            paddingLeft: "0.75rem",
                            paddingRight: "0.75rem",
                            "&:hover": { borderColor: "#3b82f6" },
                          }),
                          menu: (base) => ({
                            ...base,
                            zIndex: 9999,
                            fontSize: "1rem",
                            backgroundColor:
                              document.documentElement.classList.contains("dark")
                                ? "#1e293b"
                                : "#fff",
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#fff"
                              : "#1f2937",
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isSelected
                              ? "#3b82f6"
                              : state.isFocused
                                ? document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#334155"
                                  : "#e0e7ff"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#fff",
                            color: state.isSelected
                              ? "#fff"
                              : document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            fontSize: "1rem",
                          }),
                          singleValue: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#fff"
                              : "#1f2937",
                          }),
                          placeholder: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#64748b"
                              : "#6b7280",
                          }),
                          input: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#fff"
                              : "#1f2937",
                          }),
                          dropdownIndicator: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#64748b"
                              : "#6b7280",
                            "&:hover": { color: "#3b82f6" },
                          }),
                          indicatorSeparator: (base) => ({
                            ...base,
                            backgroundColor: "transparent",
                          }),
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Penguji (Maksimal 2)
                      </label>
                      <Select
                        isMulti
                        options={dosenList
                          .filter((d: DosenOption) => {
                            // Filter out dosen yang sudah dipilih sebagai pembimbing
                            if (form.pembimbing === d.id) {
                              return false;
                            }
                            return true;
                          })
                          .map((d: DosenOption) => ({
                            value: d.id,
                            label: d.name,
                          }))}
                        value={
                          dosenList
                            .map((d: DosenOption) => ({
                              value: d.id,
                              label: d.name,
                            }))
                            .filter((opt: any) =>
                              form.penguji.includes(opt.value)
                            ) || []
                        }
                        onChange={(opts: any) => {
                          const selectedIds = opts
                            ? opts.map((opt: any) => opt.value)
                            : [];
                          if (selectedIds.length > 2) {
                            setErrorForm("Penguji maksimal 2 orang");
                            return;
                          }
                          // Validasi: Cek apakah ada dosen yang sama di pembimbing
                          if (form.pembimbing && selectedIds.includes(form.pembimbing)) {
                            setErrorForm('Dosen yang sama tidak boleh dipilih sebagai Pembimbing dan Penguji');
                            return;
                          }
                          setForm({ ...form, penguji: selectedIds });
                          setErrorForm("");
                        }}
                        placeholder="Pilih Penguji (Maksimal 2)"
                        isClearable
                        classNamePrefix="react-select"
                        className="react-select-container"
                        maxMenuHeight={200}
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            backgroundColor:
                              document.documentElement.classList.contains("dark")
                                ? "#1e293b"
                                : "#f9fafb",
                            borderColor: state.isFocused
                              ? "#3b82f6"
                              : document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#334155"
                                : "#d1d5db",
                            boxShadow: state.isFocused
                              ? "0 0 0 2px #3b82f633"
                              : undefined,
                            borderRadius: "0.75rem",
                            minHeight: "2.5rem",
                            fontSize: "1rem",
                            paddingLeft: "0.75rem",
                            paddingRight: "0.75rem",
                            "&:hover": { borderColor: "#3b82f6" },
                          }),
                          menu: (base) => ({
                            ...base,
                            zIndex: 9999,
                            fontSize: "1rem",
                            backgroundColor:
                              document.documentElement.classList.contains("dark")
                                ? "#1e293b"
                                : "#fff",
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#fff"
                              : "#1f2937",
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isSelected
                              ? "#3b82f6"
                              : state.isFocused
                                ? document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#334155"
                                  : "#e0e7ff"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#fff",
                            color: state.isSelected
                              ? "#fff"
                              : document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            fontSize: "1rem",
                          }),
                          multiValue: (base) => ({
                            ...base,
                            backgroundColor: "#3b82f6",
                            color: "#fff",
                          }),
                          multiValueLabel: (base) => ({
                            ...base,
                            color: "#fff",
                          }),
                          multiValueRemove: (base) => ({
                            ...base,
                            color: "#fff",
                            "&:hover": {
                              backgroundColor: "#2563eb",
                              color: "#fff",
                            },
                          }),
                          placeholder: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#64748b"
                              : "#6b7280",
                          }),
                          input: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#fff"
                              : "#1f2937",
                          }),
                          dropdownIndicator: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#64748b"
                              : "#6b7280",
                            "&:hover": { color: "#3b82f6" },
                          }),
                          indicatorSeparator: (base) => ({
                            ...base,
                            backgroundColor: "transparent",
                          }),
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Mahasiswa
                      </label>
                      <Select
                        isMulti
                        options={mahasiswaList.map((m: MahasiswaOption) => ({
                          value: m.nim,
                          label: m.label,
                        }))}
                        value={
                          mahasiswaList
                            .map((m: MahasiswaOption) => ({
                              value: m.nim,
                              label: m.label,
                            }))
                            .filter((opt: any) =>
                              form.mahasiswa.includes(opt.value)
                            ) || []
                        }
                        onChange={(opts: any) => {
                          const selectedNims = opts
                            ? opts.map((opt: any) => opt.value)
                            : [];
                          setForm({ ...form, mahasiswa: selectedNims });
                          setErrorForm("");
                        }}
                        placeholder="Pilih Mahasiswa"
                        isClearable
                        classNamePrefix="react-select"
                        className="react-select-container"
                        maxMenuHeight={200}
                        styles={{
                          control: (base, state) => ({
                            ...base,
                            backgroundColor:
                              document.documentElement.classList.contains("dark")
                                ? "#1e293b"
                                : "#f9fafb",
                            borderColor: state.isFocused
                              ? "#3b82f6"
                              : document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#334155"
                                : "#d1d5db",
                            boxShadow: state.isFocused
                              ? "0 0 0 2px #3b82f633"
                              : undefined,
                            borderRadius: "0.75rem",
                            minHeight: "2.5rem",
                            fontSize: "1rem",
                            paddingLeft: "0.75rem",
                            paddingRight: "0.75rem",
                            "&:hover": { borderColor: "#3b82f6" },
                          }),
                          menu: (base) => ({
                            ...base,
                            zIndex: 9999,
                            fontSize: "1rem",
                            backgroundColor:
                              document.documentElement.classList.contains("dark")
                                ? "#1e293b"
                                : "#fff",
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#fff"
                              : "#1f2937",
                          }),
                          option: (base, state) => ({
                            ...base,
                            backgroundColor: state.isSelected
                              ? "#3b82f6"
                              : state.isFocused
                                ? document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#334155"
                                  : "#e0e7ff"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#fff",
                            color: state.isSelected
                              ? "#fff"
                              : document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            fontSize: "1rem",
                          }),
                          multiValue: (base) => ({
                            ...base,
                            backgroundColor: "#3b82f6",
                            color: "#fff",
                          }),
                          multiValueLabel: (base) => ({
                            ...base,
                            color: "#fff",
                          }),
                          multiValueRemove: (base) => ({
                            ...base,
                            color: "#fff",
                            "&:hover": {
                              backgroundColor: "#2563eb",
                              color: "#fff",
                            },
                          }),
                          placeholder: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#64748b"
                              : "#6b7280",
                          }),
                          input: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#fff"
                              : "#1f2937",
                          }),
                          dropdownIndicator: (base) => ({
                            ...base,
                            color: document.documentElement.classList.contains(
                              "dark"
                            )
                              ? "#64748b"
                              : "#6b7280",
                            "&:hover": { color: "#3b82f6" },
                          }),
                          indicatorSeparator: (base) => ({
                            ...base,
                            backgroundColor: "transparent",
                          }),
                        }}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Ruangan
                      </label>
                      {ruanganList.length === 0 ? (
                        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                          <div className="flex items-center gap-2">
                            <svg
                              className="w-5 h-5 text-orange-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                              Belum ada ruangan yang ditambahkan untuk mata
                              kuliah ini
                            </span>
                          </div>
                          <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                            Silakan tambahkan ruangan terlebih dahulu di
                            halaman Ruangan Detail
                          </p>
                        </div>
                      ) : (
                        <Select
                          options={getRuanganOptions(ruanganList || [])}
                          value={
                            getRuanganOptions(ruanganList || []).find(
                              (opt: any) => opt.value === form.lokasi
                            ) || null
                          }
                          onChange={(opt: any) => {
                            setForm({ ...form, lokasi: opt?.value || null });
                            setErrorForm("");
                          }}
                          placeholder="Pilih Ruangan"
                          isClearable
                          classNamePrefix="react-select"
                          className="react-select-container"
                          styles={{
                            control: (base, state) => ({
                              ...base,
                              backgroundColor: state.isDisabled
                                ? document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#f3f4f6"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#f9fafb",
                              borderColor: state.isFocused
                                ? "#3b82f6"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#334155"
                                  : "#d1d5db",
                              boxShadow: state.isFocused
                                ? "0 0 0 2px #3b82f633"
                                : undefined,
                              borderRadius: "0.75rem",
                              minHeight: "2.5rem",
                              fontSize: "1rem",
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                              paddingLeft: "0.75rem",
                              paddingRight: "0.75rem",
                              "&:hover": { borderColor: "#3b82f6" },
                            }),
                            menu: (base) => ({
                              ...base,
                              zIndex: 9999,
                              fontSize: "1rem",
                              backgroundColor:
                                document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#1e293b"
                                  : "#fff",
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            option: (base, state) => ({
                              ...base,
                              backgroundColor: state.isSelected
                                ? "#3b82f6"
                                : state.isFocused
                                  ? document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#334155"
                                    : "#e0e7ff"
                                  : document.documentElement.classList.contains(
                                    "dark"
                                  )
                                    ? "#1e293b"
                                    : "#fff",
                              color: state.isSelected
                                ? "#fff"
                                : document.documentElement.classList.contains(
                                  "dark"
                                )
                                  ? "#fff"
                                  : "#1f2937",
                              fontSize: "1rem",
                            }),
                            singleValue: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            placeholder: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#64748b"
                                : "#6b7280",
                            }),
                            input: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#fff"
                                : "#1f2937",
                            }),
                            dropdownIndicator: (base) => ({
                              ...base,
                              color: document.documentElement.classList.contains(
                                "dark"
                              )
                                ? "#64748b"
                                : "#6b7280",
                              "&:hover": { color: "#3b82f6" },
                            }),
                            indicatorSeparator: (base) => ({
                              ...base,
                              backgroundColor: "transparent",
                            }),
                          }}
                        />
                      )}
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hari/Tanggal</label>
                      <input type="date" name="hariTanggal" value={form.hariTanggal} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      {errorForm && (errorForm.includes('Tanggal tidak boleh') || errorForm.includes('tidak boleh sebelum') || errorForm.includes('tidak boleh setelah')) && (
                        <div className="text-sm text-red-500 mt-2">{errorForm}</div>
                      )}
                    </div>
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
                              fontSize: '1rem',
                              color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
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
                        <select name="jumlahKali" value={form.jumlahKali} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500">
                          {[1, 2, 3, 4, 5, 6].map(n => <option key={n} value={n}>{n} x 50'</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="mt-2">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Selesai</label>
                      <input type="text" name="jamSelesai" value={form.jamSelesai} readOnly className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed" />
                    </div>
                  </>
                )}
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
                        options={(dosenList || []).map((d: any) => ({ value: d.id, label: d.name }))}
                        value={(dosenList || []).map((d: any) => ({ value: d.id, label: d.name })).find((opt: any) => opt.value === form.pengampu) || null}
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
                            fontSize: '1rem',
                            color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
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
                        onChange={opt => {
                          setForm(f => ({ ...f, kelompokBesar: opt ? Number(opt.value) : null }));
                          setErrorForm(''); // Reset error when selection changes
                        }}
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
                )}
                {form.jenisBaris === 'materi' && (
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
                            fontSize: '1rem',
                            color: document.documentElement.classList.contains('dark') ? '#fff' : '#1f2937',
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
                <button onClick={handleTambahJadwal} className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" disabled={!form.hariTanggal || (form.jenisBaris === 'materi' && (!form.jamMulai || !form.jumlahKali || !form.pengampu || !form.materi || !form.lokasi)) || (form.jenisBaris === 'agenda' && (!form.agenda || (form.useRuangan && !form.lokasi))) || !!errorForm || isSaving}>{isSaving ? (<><svg className="w-4 h-4 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>Menyimpan...</>) : (editIndex !== null ? 'Simpan' : 'Tambah Jadwal')}</button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL KONFIRMASI HAPUS */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowDeleteModal(false)}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              <div className="flex items-center justify-between pb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  Konfirmasi Hapus Data
                </h2>
              </div>
              <div>
                <p className="mb-6 text-gray-500 dark:text-gray-400">
                  Apakah Anda yakin ingin menghapus data ini? Data yang dihapus tidak dapat dikembalikan.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowDeleteModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => { if (selectedDeleteIndex !== null) { handleDeleteJadwal(selectedDeleteIndex, form.jenisBaris); } }}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <>
                        <svg
                          className="w-5 h-5 mr-2 animate-spin text-white"
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
                        Menghapus...
                      </>
                    ) : (
                      "Hapus"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL KONFIRMASI BULK DELETE MATERI KULIAH */}
      <AnimatePresence>
        {showMateriBulkDeleteModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowMateriBulkDeleteModal(false)}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              <div className="flex items-center justify-between pb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  Konfirmasi Hapus Data
                </h2>
              </div>
              <div>
                <p className="mb-6 text-gray-500 dark:text-gray-400">
                  Apakah Anda yakin ingin menghapus{" "}
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {selectedMateriItems.length}
                  </span>{" "}
                  jadwal Materi Kuliah terpilih? Data yang dihapus tidak dapat dikembalikan.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowMateriBulkDeleteModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmMateriBulkDelete}
                    disabled={isMateriDeleting}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isMateriDeleting ? (
                      <>
                        <svg
                          className="w-5 h-5 mr-2 animate-spin text-white"
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
                        Menghapus...
                      </>
                    ) : (
                      "Hapus"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL KONFIRMASI BULK DELETE AGENDA KHUSUS */}
      <AnimatePresence>
        {showAgendaBulkDeleteModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowAgendaBulkDeleteModal(false)}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              <div className="flex items-center justify-between pb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  Konfirmasi Hapus Data
                </h2>
              </div>
              <div>
                <p className="mb-6 text-gray-500 dark:text-gray-400">
                  Apakah Anda yakin ingin menghapus{" "}
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {selectedAgendaItems.length}
                  </span>{" "}
                  jadwal Agenda Khusus terpilih? Data yang dihapus tidak dapat dikembalikan.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowAgendaBulkDeleteModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmAgendaBulkDelete}
                    disabled={isAgendaDeleting}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAgendaDeleting ? (
                      <>
                        <svg
                          className="w-5 h-5 mr-2 animate-spin text-white"
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
                        Menghapus...
                      </>
                    ) : (
                      "Hapus"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL UPLOAD FILE MATERI KULIAH */}
      <AnimatePresence>
        {showMateriUploadModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handleMateriCloseUploadModal}
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
                onClick={handleMateriCloseUploadModal}
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
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Import Jadwal Materi Kuliah
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Preview dan validasi data sebelum import
                </p>
              </div>

              {!materiImportFile ? (
                /* Upload Section */
                <div className="mb-6">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-brand-500 dark:hover:border-brand-400 transition-colors">
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon
                          icon={faFileExcel}
                          className="w-8 h-8 text-brand-600 dark:text-brand-400"
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Upload File Excel
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Pilih file Excel dengan format template Materi Kuliah (.xlsx, .xls)
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors cursor-pointer">
                        <FontAwesomeIcon
                          icon={faUpload}
                          className="w-4 h-4"
                        />
                        Pilih File
                        <input
                          ref={materiFileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleMateriFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                /* Preview Section */
                <>

                  {/* File Info */}
                  {materiImportFile && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FontAwesomeIcon
                          icon={faFileExcel}
                          className="w-5 h-5 text-blue-500"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-blue-800 dark:text-blue-200">
                            {materiImportFile.name}
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-300">
                            {(materiImportFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setMateriImportFile(null);
                            setMateriImportData([]);
                            setMateriImportErrors([]);
                            setMateriCellErrors([]);
                            if (materiFileInputRef.current) {
                              materiFileInputRef.current.value = "";
                            }
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                          title="Hapus file"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error Messages */}
                  {(materiImportErrors.length > 0 ||
                    materiCellErrors.length > 0) && (
                      <div className="mb-6">
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <FontAwesomeIcon
                              icon={faExclamationTriangle}
                              className="w-5 h-5 text-red-500"
                            />
                            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                              Error Validasi (
                              {materiImportErrors.length +
                                materiCellErrors.length}{" "}
                              error)
                            </h3>
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            {materiImportErrors.map((error, index) => (
                              <p
                                key={index}
                                className="text-sm text-red-600 dark:text-red-400 mb-1"
                              >
                                • {error}
                              </p>
                            ))}
                            {materiCellErrors.map((error, index) => (
                              <p
                                key={index}
                                className="text-sm text-red-600 dark:text-red-400 mb-1"
                              >
                                • {error.field === 'api'
                                  ? error.message
                                  : error.message}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Preview Table */}
                  {materiImportData.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Preview Data ({materiImportData.length} jadwal Materi Kuliah)
                        </h3>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            File: {materiImportFile?.name}
                          </div>
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
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Sesi</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok Besar</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Dosen</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Materi</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {materiImportData
                                .slice((materiImportPage - 1) * materiImportPageSize, materiImportPage * materiImportPageSize)
                                .map((row, index) => {
                                  const actualIndex = (materiImportPage - 1) * materiImportPageSize + index;

                                  const renderEditableCell = (field: string, value: any, isNumeric = false) => {
                                    const isEditing = materiEditingCell?.row === actualIndex && materiEditingCell?.key === field;
                                    const cellError = materiCellErrors.find(err => err.row === actualIndex + 1 && err.field === field);

                                    return (
                                      <td
                                        className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                        onClick={() => setMateriEditingCell({ row: actualIndex, key: field })}
                                        title={cellError ? cellError.message : ''}
                                      >
                                        {isEditing ? (
                                          <input
                                            className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                            type={isNumeric ? "number" : "text"}
                                            value={value || ""}
                                            onChange={e => handleMateriEditCell(actualIndex, field, isNumeric ? parseInt(e.target.value) : e.target.value)}
                                            onBlur={handleMateriFinishEdit}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                handleMateriFinishEdit();
                                              }
                                              if (e.key === 'Escape') {
                                                handleMateriFinishEdit();
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
                                      className={`${index % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}`}
                                    >
                                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{actualIndex + 1}</td>
                                      {renderEditableCell('tanggal', row.tanggal)}
                                      {renderEditableCell('jam_mulai', row.jam_mulai)}
                                      {renderEditableCell('jumlah_sesi', row.jumlah_sesi, true)}
                                      {(() => {
                                        const field = 'kelompok_besar_id';
                                        const isEditing = materiEditingCell?.row === actualIndex && materiEditingCell?.key === field;
                                        const cellError = materiCellErrors.find(err => err.row === actualIndex + 1 && err.field === field);

                                        // Cari dari semua options (materi dan agenda) untuk menampilkan label yang benar
                                        const allKelompokBesarOptions = [...kelompokBesarMateriOptions, ...kelompokBesarAgendaOptions];
                                        const kelompokBesar = allKelompokBesarOptions.find(kb => Number(kb.id) === row.kelompok_besar_id);

                                        // Buat label dengan format yang benar, selalu tampilkan jumlah mahasiswa jika ada
                                        let displayLabel = '';
                                        if (kelompokBesar) {
                                          // Jika ditemukan di options, gunakan label yang sudah ada (sudah include jumlah mahasiswa)
                                          displayLabel = kelompokBesar.label;
                                        } else if (row.kelompok_besar_id && row.kelompok_besar_id !== 0) {
                                          // Jika tidak ditemukan, cari lagi dari semua options (untuk mendapatkan jumlah mahasiswa)
                                          // Backend sekarang mengirim semua semester, jadi seharusnya selalu ditemukan
                                          const kelompokBesarWithSameSemester = allKelompokBesarOptions.find(kb => Number(kb.id) === row.kelompok_besar_id);

                                          if (kelompokBesarWithSameSemester?.jumlah_mahasiswa) {
                                            displayLabel = `Kelompok Besar Semester ${row.kelompok_besar_id} (${kelompokBesarWithSameSemester.jumlah_mahasiswa} mahasiswa)`;
                                          } else {
                                            // Jika benar-benar tidak ada data jumlah mahasiswa, tampilkan tanpa jumlah
                                            displayLabel = `Kelompok Besar Semester ${row.kelompok_besar_id}`;
                                          }
                                        } else {
                                          displayLabel = 'Tidak ditemukan';
                                        }

                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                            onClick={() => setMateriEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                                type="number"
                                                value={row.kelompok_besar_id || ""}
                                                onChange={e => handleMateriEditCell(actualIndex, field, parseInt(e.target.value))}
                                                onBlur={handleMateriFinishEdit}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    handleMateriFinishEdit();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    handleMateriFinishEdit();
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                                {displayLabel}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })()}
                                      {(() => {
                                        const field = 'nama_dosen';
                                        const isEditing = materiEditingCell?.row === actualIndex && materiEditingCell?.key === field;
                                        const cellError = materiCellErrors.find(err => err.row === actualIndex + 1 && err.field === 'dosen_id');
                                        const dosen = dosenList.find(d => d.id === row.dosen_id);

                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                            onClick={() => setMateriEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                                type="text"
                                                value={row.nama_dosen || ""}
                                                onChange={e => handleMateriEditCell(actualIndex, field, e.target.value)}
                                                onBlur={handleMateriFinishEdit}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    handleMateriFinishEdit();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    handleMateriFinishEdit();
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                                {dosen ? dosen.name : (row.nama_dosen || 'Tidak ditemukan')}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })()}
                                      {renderEditableCell('materi', row.materi || '')}
                                      {(() => {
                                        const field = 'nama_ruangan';
                                        const isEditing = materiEditingCell?.row === actualIndex && materiEditingCell?.key === field;
                                        const cellError = materiCellErrors.find(err => err.row === actualIndex + 1 && err.field === 'ruangan_id');
                                        const ruangan = ruanganList.find(r => r.id === row.ruangan_id);

                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                            onClick={() => setMateriEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                                type="text"
                                                value={row.nama_ruangan || ""}
                                                onChange={e => handleMateriEditCell(actualIndex, field, e.target.value)}
                                                onBlur={handleMateriFinishEdit}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    handleMateriFinishEdit();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    handleMateriFinishEdit();
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                                {ruangan ? ruangan.nama : (row.nama_ruangan || 'Tidak ditemukan')}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })()}
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Pagination untuk Import Preview */}
                      {materiImportData.length > materiImportPageSize && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-4">
                            <select
                              value={materiImportPageSize}
                              onChange={e => { setMateriImportPageSize(Number(e.target.value)); setMateriImportPage(1); }}
                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            >
                              <option value={5}>5 per halaman</option>
                              <option value={10}>10 per halaman</option>
                              <option value={20}>20 per halaman</option>
                              <option value={50}>50 per halaman</option>
                            </select>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Menampilkan {((materiImportPage - 1) * materiImportPageSize) + 1}-{Math.min(materiImportPage * materiImportPageSize, materiImportData.length)} dari {materiImportData.length} jadwal
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setMateriImportPage(p => Math.max(1, p - 1))}
                              disabled={materiImportPage === 1}
                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                            >
                              Prev
                            </button>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Halaman {materiImportPage} dari {Math.ceil(materiImportData.length / materiImportPageSize)}
                            </span>
                            <button
                              onClick={() => setMateriImportPage(p => Math.min(Math.ceil(materiImportData.length / materiImportPageSize), p + 1))}
                              disabled={materiImportPage >= Math.ceil(materiImportData.length / materiImportPageSize)}
                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </>
              )}

              {/* Footer */}
              <div className={`flex justify-end gap-3 pt-6 ${materiImportFile ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}>
                <button
                  onClick={handleMateriCloseUploadModal}
                  className="px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Batal
                </button>
                {materiImportFile && materiImportData.length > 0 &&
                  materiImportErrors.length === 0 &&
                  materiCellErrors.length === 0 && (
                    <button
                      onClick={handleMateriSubmitImport}
                      disabled={isMateriImporting}
                      className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isMateriImporting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Importing...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon
                            icon={faUpload}
                            className="w-4 h-4"
                          />
                          Import Data ({materiImportData.length} jadwal)
                        </>
                      )}
                    </button>
                  )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* MODAL UPLOAD FILE AGENDA KHUSUS */}
      <AnimatePresence>
        {showAgendaUploadModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handleAgendaCloseUploadModal}
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
                onClick={handleAgendaCloseUploadModal}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="w-6 h-6">
                  <path fillRule="evenodd" clipRule="evenodd" d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z" fill="currentColor" />
                </svg>
              </button>

              {/* Header */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Import Jadwal Agenda Khusus
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Preview dan validasi data sebelum import
                </p>
              </div>

              {!agendaImportFile ? (
                /* Upload Section */
                <div className="mb-6">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-brand-500 dark:hover:border-brand-400 transition-colors">
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon
                          icon={faFileExcel}
                          className="w-8 h-8 text-brand-600 dark:text-brand-400"
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Upload File Excel
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Pilih file Excel dengan format template Agenda Khusus (.xlsx, .xls)
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors cursor-pointer">
                        <FontAwesomeIcon
                          icon={faUpload}
                          className="w-4 h-4"
                        />
                        Pilih File
                        <input
                          ref={agendaFileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleAgendaFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                /* Preview Section */
                <>
                  {/* File Info */}
                  {agendaImportFile && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FontAwesomeIcon
                          icon={faFileExcel}
                          className="w-5 h-5 text-blue-500"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-blue-800 dark:text-blue-200">
                            {agendaImportFile.name}
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-300">
                            {(agendaImportFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          onClick={() => {
                            setAgendaImportFile(null);
                            setAgendaImportData([]);
                            setAgendaImportErrors([]);
                            setAgendaCellErrors([]);
                            if (agendaFileInputRef.current) {
                              agendaFileInputRef.current.value = "";
                            }
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                          title="Hapus file"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error Messages */}
                  {(agendaImportErrors.length > 0 ||
                    agendaCellErrors.length > 0) && (
                      <div className="mb-6">
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <FontAwesomeIcon
                              icon={faExclamationTriangle}
                              className="w-5 h-5 text-red-500"
                            />
                            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                              Error Validasi (
                              {agendaImportErrors.length +
                                agendaCellErrors.length}{" "}
                              error)
                            </h3>
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            {agendaImportErrors.map((error, index) => (
                              <p
                                key={index}
                                className="text-sm text-red-600 dark:text-red-400 mb-1"
                              >
                                • {error}
                              </p>
                            ))}
                            {agendaCellErrors.map((error, index) => (
                              <p
                                key={index}
                                className="text-sm text-red-600 dark:text-red-400 mb-1"
                              >
                                • {error.field === 'api'
                                  ? error.message
                                  : error.message}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Preview Table */}
                  {agendaImportData.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Preview Data ({agendaImportData.length} jadwal Agenda Khusus)
                        </h3>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            File: {agendaImportFile?.name}
                          </div>
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
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Sesi</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok Besar</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Agenda</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {agendaImportData
                                .slice((agendaImportPage - 1) * agendaImportPageSize, agendaImportPage * agendaImportPageSize)
                                .map((row, index) => {
                                  const actualIndex = (agendaImportPage - 1) * agendaImportPageSize + index;

                                  const renderEditableCell = (field: string, value: any, isNumeric = false) => {
                                    const isEditing = agendaEditingCell?.row === actualIndex && agendaEditingCell?.key === field;
                                    const cellError = agendaCellErrors.find(err => err.row === actualIndex + 1 && err.field === field);

                                    return (
                                      <td
                                        className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                        onClick={() => setAgendaEditingCell({ row: actualIndex, key: field })}
                                        title={cellError ? cellError.message : ''}
                                      >
                                        {isEditing ? (
                                          <input
                                            className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                            type={isNumeric ? "number" : "text"}
                                            value={value || ""}
                                            onChange={e => handleAgendaEditCell(actualIndex, field, isNumeric ? parseInt(e.target.value) : e.target.value)}
                                            onBlur={handleAgendaFinishEdit}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                handleAgendaFinishEdit();
                                              }
                                              if (e.key === 'Escape') {
                                                handleAgendaFinishEdit();
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

                                  // Cari dari semua options (materi dan agenda) untuk menampilkan label yang benar
                                  const allKelompokBesarOptions = [...kelompokBesarMateriOptions, ...kelompokBesarAgendaOptions];
                                  const kelompokBesar = allKelompokBesarOptions.find(kb => Number(kb.id) === row.kelompok_besar_id);
                                  const ruangan = ruanganList.find(r => r.id === row.ruangan_id);

                                  // Buat label dengan format yang benar, selalu tampilkan jumlah mahasiswa jika ada
                                  let displayLabel = '';
                                  if (kelompokBesar) {
                                    // Jika ditemukan di options, gunakan label yang sudah ada (sudah include jumlah mahasiswa)
                                    displayLabel = kelompokBesar.label;
                                  } else if (row.kelompok_besar_id && row.kelompok_besar_id !== 0) {
                                    // Jika tidak ditemukan, cari lagi dari semua options (untuk mendapatkan jumlah mahasiswa)
                                    // Backend sekarang mengirim semua semester, jadi seharusnya selalu ditemukan
                                    const kelompokBesarWithSameSemester = allKelompokBesarOptions.find(kb => Number(kb.id) === row.kelompok_besar_id);

                                    if (kelompokBesarWithSameSemester?.jumlah_mahasiswa) {
                                      displayLabel = `Kelompok Besar Semester ${row.kelompok_besar_id} (${kelompokBesarWithSameSemester.jumlah_mahasiswa} mahasiswa)`;
                                    } else {
                                      // Jika benar-benar tidak ada data jumlah mahasiswa, tampilkan tanpa jumlah
                                      displayLabel = `Kelompok Besar Semester ${row.kelompok_besar_id}`;
                                    }
                                  } else {
                                    displayLabel = '-';
                                  }

                                  const cellError = agendaCellErrors.find(err => err.row === actualIndex + 1 && err.field === 'kelompok_besar_id');

                                  return (
                                    <tr
                                      key={actualIndex}
                                      className={`${index % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}`}
                                    >
                                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{actualIndex + 1}</td>
                                      {renderEditableCell('tanggal', row.tanggal)}
                                      {renderEditableCell('jam_mulai', row.jam_mulai)}
                                      {renderEditableCell('jumlah_sesi', row.jumlah_sesi, true)}
                                      {(() => {
                                        const field = 'kelompok_besar_id';
                                        const isEditing = agendaEditingCell?.row === actualIndex && agendaEditingCell?.key === field;

                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                            onClick={() => setAgendaEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                                type="number"
                                                value={row.kelompok_besar_id || ""}
                                                onChange={e => handleAgendaEditCell(actualIndex, field, parseInt(e.target.value))}
                                                onBlur={handleAgendaFinishEdit}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    handleAgendaFinishEdit();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    handleAgendaFinishEdit();
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                                {displayLabel}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })()}
                                      {renderEditableCell('agenda', row.agenda)}
                                      {(() => {
                                        const field = 'nama_ruangan';
                                        const isEditing = agendaEditingCell?.row === actualIndex && agendaEditingCell?.key === field;
                                        const cellError = agendaCellErrors.find(err => err.row === actualIndex + 1 && err.field === 'ruangan_id');
                                        const ruangan = ruanganList.find(r => r.id === row.ruangan_id);

                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                            onClick={() => setAgendaEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                                type="text"
                                                value={row.nama_ruangan || ""}
                                                onChange={e => handleAgendaEditCell(actualIndex, field, e.target.value)}
                                                onBlur={handleAgendaFinishEdit}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    handleAgendaFinishEdit();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    handleAgendaFinishEdit();
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                                {ruangan ? ruangan.nama : (row.nama_ruangan || '-')}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })()}
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Pagination untuk Import Preview */}
                      {agendaImportData.length > agendaImportPageSize && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-4">
                            <select
                              value={agendaImportPageSize}
                              onChange={e => { setAgendaImportPageSize(Number(e.target.value)); setAgendaImportPage(1); }}
                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            >
                              <option value={5}>5 per halaman</option>
                              <option value={10}>10 per halaman</option>
                              <option value={20}>20 per halaman</option>
                              <option value={50}>50 per halaman</option>
                            </select>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Menampilkan {((agendaImportPage - 1) * agendaImportPageSize) + 1}-{Math.min(agendaImportPage * agendaImportPageSize, agendaImportData.length)} dari {agendaImportData.length} jadwal
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setAgendaImportPage(p => Math.max(1, p - 1))}
                              disabled={agendaImportPage === 1}
                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                            >
                              Prev
                            </button>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Halaman {agendaImportPage} dari {Math.ceil(agendaImportData.length / agendaImportPageSize)}
                            </span>
                            <button
                              onClick={() => setAgendaImportPage(p => Math.min(Math.ceil(agendaImportData.length / agendaImportPageSize), p + 1))}
                              disabled={agendaImportPage >= Math.ceil(agendaImportData.length / agendaImportPageSize)}
                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </>
              )}

              {/* Footer */}
              <div className={`flex justify-end gap-3 pt-6 ${agendaImportFile ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}>
                <button
                  onClick={handleAgendaCloseUploadModal}
                  className="px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Batal
                </button>
                {agendaImportFile && agendaImportData.length > 0 &&
                  agendaImportErrors.length === 0 &&
                  agendaCellErrors.length === 0 && (
                    <button
                      onClick={handleAgendaSubmitImport}
                      disabled={isAgendaImporting}
                      className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isAgendaImporting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Importing...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon
                            icon={faUpload}
                            className="w-4 h-4"
                          />
                          Import Data ({agendaImportData.length} jadwal)
                        </>
                      )}
                    </button>
                  )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL UPLOAD FILE SEMINAR PROPOSAL */}
      <AnimatePresence>
        {showSeminarUploadModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handleSeminarCloseUploadModal}
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
                onClick={handleSeminarCloseUploadModal}
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
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Import Jadwal Seminar Proposal
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Preview dan validasi data sebelum import
                </p>
              </div>

              {!seminarImportFile ? (
                /* Upload Section */
                <div className="mb-6">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-brand-500 dark:hover:border-brand-400 transition-colors">
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon
                          icon={faFileExcel}
                          className="w-8 h-8 text-brand-600 dark:text-brand-400"
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Upload File Excel
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Pilih file Excel dengan format template Seminar Proposal (.xlsx, .xls)
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors cursor-pointer">
                        <FontAwesomeIcon
                          icon={faUpload}
                          className="w-4 h-4"
                        />
                        Pilih File
                        <input
                          ref={seminarFileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleSeminarFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                /* Preview Section */
                <>
                  {/* File Info */}
                  {seminarImportFile && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FontAwesomeIcon
                          icon={faFileExcel}
                          className="w-5 h-5 text-blue-500"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-blue-800 dark:text-blue-200">
                            {seminarImportFile.name}
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-300">
                            {(seminarImportFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          onClick={handleSeminarRemoveFile}
                          className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                          title="Hapus file"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error Messages */}
                  {(seminarImportErrors.length > 0 ||
                    seminarCellErrors.length > 0) && (
                      <div className="mb-6">
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <FontAwesomeIcon
                              icon={faExclamationTriangle}
                              className="w-5 h-5 text-red-500"
                            />
                            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                              Error Validasi (
                              {seminarImportErrors.length +
                                seminarCellErrors.length}{" "}
                              error)
                            </h3>
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            {seminarImportErrors.map((error, index) => (
                              <p
                                key={index}
                                className="text-sm text-red-600 dark:text-red-400 mb-1"
                              >
                                • {error}
                              </p>
                            ))}
                            {seminarCellErrors.map((error, index) => (
                              <p
                                key={index}
                                className="text-sm text-red-600 dark:text-red-400 mb-1"
                              >
                                • {error.field === 'api'
                                  ? error.message
                                  : error.message}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Preview Table */}
                  {seminarImportData.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Preview Data ({seminarImportData.length} jadwal Seminar Proposal)
                        </h3>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            File: {seminarImportFile?.name}
                          </div>
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
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Sesi</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pembimbing</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Komentator</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Mahasiswa</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {seminarImportData
                                .slice((seminarImportPage - 1) * seminarImportPageSize, seminarImportPage * seminarImportPageSize)
                                .map((row, index) => {
                                  const actualIndex = (seminarImportPage - 1) * seminarImportPageSize + index;

                                  const renderEditableCell = (field: string, value: any, isNumeric = false) => {
                                    const isEditing = seminarEditingCell?.row === actualIndex && seminarEditingCell?.key === field;
                                    const cellError = seminarCellErrors.find(err => err.row === actualIndex + 1 && err.field === field);

                                    return (
                                      <td
                                        className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                        onClick={() => setSeminarEditingCell({ row: actualIndex, key: field })}
                                        title={cellError ? cellError.message : ''}
                                      >
                                        {isEditing ? (
                                          <input
                                            className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                            type={isNumeric ? "number" : "text"}
                                            value={value || ""}
                                            onChange={e => handleSeminarEditCell(actualIndex, field, isNumeric ? parseInt(e.target.value) : e.target.value)}
                                            onBlur={handleSeminarFinishEdit}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                handleSeminarFinishEdit();
                                              }
                                              if (e.key === 'Escape') {
                                                handleSeminarFinishEdit();
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
                                      className={`${index % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}`}
                                    >
                                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{actualIndex + 1}</td>
                                      {renderEditableCell('tanggal', row.tanggal)}
                                      {renderEditableCell('jam_mulai', row.jam_mulai)}
                                      {renderEditableCell('jumlah_sesi', row.jumlah_sesi, true)}
                                      {(() => {
                                        const field = 'nama_pembimbing';
                                        const isEditing = seminarEditingCell?.row === actualIndex && seminarEditingCell?.key === field;
                                        const cellError = seminarCellErrors.find(err => err.row === actualIndex + 1 && err.field === 'pembimbing_id');
                                        const pembimbing = dosenList.find(d => d.id === row.pembimbing_id);

                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                            onClick={() => setSeminarEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                                type="text"
                                                value={row.nama_pembimbing || ""}
                                                onChange={e => handleSeminarEditCell(actualIndex, field, e.target.value)}
                                                onBlur={handleSeminarFinishEdit}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    handleSeminarFinishEdit();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    handleSeminarFinishEdit();
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                                {pembimbing ? pembimbing.name : (row.nama_pembimbing || 'Tidak ditemukan')}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })()}
                                      {(() => {
                                        const field = 'nama_komentator';
                                        const isEditing = seminarEditingCell?.row === actualIndex && seminarEditingCell?.key === field;
                                        const cellError = seminarCellErrors.find(err => err.row === actualIndex + 1 && err.field === 'komentator_ids');
                                        // Tampilkan komentator dengan backslash separator (konsisten dengan format edit)
                                        const komentatorNames = row.nama_komentator
                                          ? (typeof row.nama_komentator === 'string' ? row.nama_komentator : '')
                                          : (row.komentator_ids && row.komentator_ids.length > 0
                                            ? row.komentator_ids.map((id: number) => {
                                              const dosen = dosenList.find(d => d.id === id);
                                              return dosen?.name || '';
                                            }).filter(Boolean).join('\\')
                                            : '');

                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                            onClick={() => setSeminarEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                                type="text"
                                                value={typeof row.nama_komentator === 'string' ? row.nama_komentator : (komentatorNames || "")}
                                                onChange={e => handleSeminarEditCell(actualIndex, field, e.target.value)}
                                                onBlur={handleSeminarFinishEdit}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    handleSeminarFinishEdit();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    handleSeminarFinishEdit();
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                                {komentatorNames || 'Tidak ditemukan'}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })()}
                                      {(() => {
                                        const field = 'nama_mahasiswa';
                                        const isEditing = seminarEditingCell?.row === actualIndex && seminarEditingCell?.key === field;
                                        const cellError = seminarCellErrors.find(err => err.row === actualIndex + 1 && err.field === 'mahasiswa_nims');
                                        // Ambil nama mahasiswa dari mahasiswaList berdasarkan NIM
                                        const mahasiswaNames = row.mahasiswa_nims && row.mahasiswa_nims.length > 0
                                          ? row.mahasiswa_nims.map((nim: string) => {
                                            const mahasiswa = mahasiswaList.find(m => m.nim === nim);
                                            return mahasiswa ? mahasiswa.name : null;
                                          }).filter(Boolean).join(', ')
                                          : '';

                                        // Untuk editing, gunakan nama mahasiswa (bukan NIM atau nama_mahasiswa dari row)
                                        const editingValue = typeof row.nama_mahasiswa === 'string'
                                          ? row.nama_mahasiswa
                                          : (mahasiswaNames || (Array.isArray(row.nama_mahasiswa) ? row.nama_mahasiswa.join(', ') : ""));

                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                            onClick={() => setSeminarEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                                type="text"
                                                value={editingValue}
                                                onChange={e => handleSeminarEditCell(actualIndex, field, e.target.value)}
                                                onBlur={handleSeminarFinishEdit}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    handleSeminarFinishEdit();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    handleSeminarFinishEdit();
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                                {mahasiswaNames || (typeof row.nama_mahasiswa === 'string' ? row.nama_mahasiswa : (Array.isArray(row.nama_mahasiswa) ? row.nama_mahasiswa.join(', ') : 'Tidak ditemukan'))}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })()}
                                      {(() => {
                                        const field = 'nama_ruangan';
                                        const isEditing = seminarEditingCell?.row === actualIndex && seminarEditingCell?.key === field;
                                        const cellError = seminarCellErrors.find(err => err.row === actualIndex + 1 && err.field === 'ruangan_id');
                                        const ruangan = ruanganList.find(r => r.id === row.ruangan_id);

                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                            onClick={() => setSeminarEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                                type="text"
                                                value={row.nama_ruangan || ""}
                                                onChange={e => handleSeminarEditCell(actualIndex, field, e.target.value)}
                                                onBlur={handleSeminarFinishEdit}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    handleSeminarFinishEdit();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    handleSeminarFinishEdit();
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                                {ruangan ? ruangan.nama : (row.nama_ruangan || 'Tidak ditemukan')}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })()}
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Pagination untuk Import Preview */}
                      {seminarImportData.length > seminarImportPageSize && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-4">
                            <select
                              value={seminarImportPageSize}
                              onChange={e => { setSeminarImportPageSize(Number(e.target.value)); setSeminarImportPage(1); }}
                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            >
                              <option value={5}>5 per halaman</option>
                              <option value={10}>10 per halaman</option>
                              <option value={20}>20 per halaman</option>
                              <option value={50}>50 per halaman</option>
                            </select>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Menampilkan {((seminarImportPage - 1) * seminarImportPageSize) + 1}-{Math.min(seminarImportPage * seminarImportPageSize, seminarImportData.length)} dari {seminarImportData.length} jadwal
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSeminarImportPage(p => Math.max(1, p - 1))}
                              disabled={seminarImportPage === 1}
                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                            >
                              Prev
                            </button>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Halaman {seminarImportPage} dari {Math.ceil(seminarImportData.length / seminarImportPageSize)}
                            </span>
                            <button
                              onClick={() => setSeminarImportPage(p => Math.min(Math.ceil(seminarImportData.length / seminarImportPageSize), p + 1))}
                              disabled={seminarImportPage >= Math.ceil(seminarImportData.length / seminarImportPageSize)}
                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </>
              )}

              {/* Footer */}
              <div className={`flex justify-end gap-3 pt-6 ${seminarImportFile ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}>
                <button
                  onClick={handleSeminarCloseUploadModal}
                  className="px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Batal
                </button>
                {seminarImportFile && seminarImportData.length > 0 &&
                  seminarImportErrors.length === 0 &&
                  seminarCellErrors.length === 0 && (
                    <button
                      onClick={handleSeminarSubmitImport}
                      disabled={isSeminarImporting}
                      className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSeminarImporting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Importing...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon
                            icon={faUpload}
                            className="w-4 h-4"
                          />
                          Import Data ({seminarImportData.length} jadwal)
                        </>
                      )}
                    </button>
                  )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>


      {/* Modal Daftar Mahasiswa */}
      <AnimatePresence>
        {showMahasiswaModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowMahasiswaModal(false)}
            />
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowMahasiswaModal(false)}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="w-6 h-6">
                  <path fillRule="evenodd" clipRule="evenodd" d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z" fill="currentColor" />
                </svg>
              </button>

              {/* Header */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Daftar Mahasiswa
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Total {selectedMahasiswaList.length} mahasiswa
                </p>
              </div>

              {/* Search Bar */}
              <div className="mb-6">
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Cari berdasarkan nama atau NIM..."
                    value={mahasiswaSearchQuery}
                    onChange={(e) => {
                      setMahasiswaSearchQuery(e.target.value);
                      setMahasiswaModalPage(1); // Reset ke halaman 1 saat search
                    }}
                    className="w-full px-4 py-3 pl-10 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                  <svg
                    className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                  {mahasiswaSearchQuery && (
                    <button
                      onClick={() => {
                        setMahasiswaSearchQuery('');
                        setMahasiswaModalPage(1);
                      }}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              </div>

              {/* Filtered Results Info */}
              {(() => {
                const filteredMahasiswa = selectedMahasiswaList.filter((m) => {
                  if (!mahasiswaSearchQuery.trim()) return true;
                  const query = mahasiswaSearchQuery.toLowerCase().trim();
                  return (
                    m.name.toLowerCase().includes(query) ||
                    m.nim.toLowerCase().includes(query)
                  );
                });
                const totalPages = Math.ceil(filteredMahasiswa.length / mahasiswaModalPageSize);
                const paginatedData = filteredMahasiswa.slice(
                  (mahasiswaModalPage - 1) * mahasiswaModalPageSize,
                  mahasiswaModalPage * mahasiswaModalPageSize
                );

                return (
                  <>
                    {mahasiswaSearchQuery && (
                      <div className="mb-4 text-sm text-gray-600 dark:text-gray-400">
                        Menampilkan {filteredMahasiswa.length} dari {selectedMahasiswaList.length} mahasiswa
                      </div>
                    )}

                    {/* Table */}
                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                      <div className="max-w-full overflow-x-auto hide-scroll">
                        <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                          <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>
                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">NIM</th>
                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Nama</th>
                            </tr>
                          </thead>
                          <tbody>
                            {paginatedData.length === 0 ? (
                              <tr>
                                <td colSpan={3} className="text-center py-6 text-gray-400">
                                  {mahasiswaSearchQuery ? 'Tidak ada mahasiswa yang sesuai dengan pencarian' : 'Tidak ada data mahasiswa'}
                                </td>
                              </tr>
                            ) : (
                              paginatedData.map((mahasiswa, idx) => {
                                const actualIndex = (mahasiswaModalPage - 1) * mahasiswaModalPageSize + idx;
                                return (
                                  <tr key={mahasiswa.id} className={idx % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}>
                                    <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{actualIndex + 1}</td>
                                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{mahasiswa.nim}</td>
                                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{mahasiswa.name}</td>
                                  </tr>
                                );
                              })
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Pagination */}
                    {filteredMahasiswa.length > mahasiswaModalPageSize && (
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700 mt-6">
                        <div className="flex items-center gap-4">
                          <select
                            value={mahasiswaModalPageSize}
                            onChange={(e) => {
                              setMahasiswaModalPageSize(Number(e.target.value));
                              setMahasiswaModalPage(1);
                            }}
                            className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                          >
                            <option value={10}>10 per halaman</option>
                            <option value={20}>20 per halaman</option>
                            <option value={50}>50 per halaman</option>
                            <option value={100}>100 per halaman</option>
                          </select>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Menampilkan {((mahasiswaModalPage - 1) * mahasiswaModalPageSize) + 1}-{Math.min(mahasiswaModalPage * mahasiswaModalPageSize, filteredMahasiswa.length)} dari {filteredMahasiswa.length} mahasiswa
                          </span>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setMahasiswaModalPage((p) => Math.max(1, p - 1))}
                            disabled={mahasiswaModalPage === 1}
                            className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Prev
                          </button>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Halaman {mahasiswaModalPage} dari {totalPages}
                          </span>
                          <button
                            onClick={() => setMahasiswaModalPage((p) => Math.min(totalPages, p + 1))}
                            disabled={mahasiswaModalPage >= totalPages}
                            className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            Next
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700 mt-6">
                      <button
                        onClick={() => {
                          setShowMahasiswaModal(false);
                          setMahasiswaSearchQuery('');
                          setMahasiswaModalPage(1);
                        }}
                        className="px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                      >
                        Tutup
                      </button>
                    </div>
                  </>
                );
              })()}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL KONFIRMASI BULK DELETE SEMINAR PROPOSAL */}
      <AnimatePresence>
        {showSeminarBulkDeleteModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowSeminarBulkDeleteModal(false)}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              <div className="flex items-center justify-between pb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  Konfirmasi Hapus Data
                </h2>
              </div>
              <div>
                <p className="mb-6 text-gray-500 dark:text-gray-400">
                  Apakah Anda yakin ingin menghapus{" "}
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {selectedSeminarItems.length}
                  </span>{" "}
                  jadwal Seminar Proposal terpilih? Data yang dihapus tidak dapat dikembalikan.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowSeminarBulkDeleteModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmSeminarBulkDelete}
                    disabled={isSeminarDeleting}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSeminarDeleting ? (
                      <>
                        <svg
                          className="w-5 h-5 mr-2 animate-spin text-white"
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
                        Menghapus...
                      </>
                    ) : (
                      "Hapus"
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL IMPORT EXCEL SIDANG SKRIPSI */}
      <AnimatePresence>
        {showSidangUploadModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handleSidangCloseUploadModal}
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
                onClick={handleSidangCloseUploadModal}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="w-6 h-6">
                  <path fillRule="evenodd" clipRule="evenodd" d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z" fill="currentColor" />
                </svg>
              </button>

              {/* Header */}
              <div className="mb-6">
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                  Import Jadwal Sidang Skripsi
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Preview dan validasi data sebelum import
                </p>
              </div>

              {!sidangImportFile ? (
                /* Upload Section */
                <div className="mb-6">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-brand-500 dark:hover:border-brand-400 transition-colors">
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon
                          icon={faFileExcel}
                          className="w-8 h-8 text-brand-600 dark:text-brand-400"
                        />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Upload File Excel
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Pilih file Excel dengan format template Sidang Skripsi (.xlsx, .xls)
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors cursor-pointer">
                        <FontAwesomeIcon
                          icon={faUpload}
                          className="w-4 h-4"
                        />
                        Pilih File
                        <input
                          ref={sidangFileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleSidangFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              ) : (
                /* Preview Section */
                <>
                  {/* File Info */}
                  {sidangImportFile && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FontAwesomeIcon
                          icon={faFileExcel}
                          className="w-5 h-5 text-blue-500"
                        />
                        <div className="flex-1">
                          <p className="font-medium text-blue-800 dark:text-blue-200">
                            {sidangImportFile.name}
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-300">
                            {(sidangImportFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          onClick={handleSidangRemoveFile}
                          className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                          title="Hapus file"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Error Messages */}
                  {(sidangImportErrors.length > 0 ||
                    sidangCellErrors.length > 0) && (
                      <div className="mb-6">
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <FontAwesomeIcon
                              icon={faExclamationTriangle}
                              className="w-5 h-5 text-red-500"
                            />
                            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                              Error Validasi (
                              {sidangImportErrors.length +
                                sidangCellErrors.length}{" "}
                              error)
                            </h3>
                          </div>
                          <div className="max-h-40 overflow-y-auto">
                            {sidangImportErrors.map((error, index) => (
                              <p
                                key={index}
                                className="text-sm text-red-600 dark:text-red-400 mb-1"
                              >
                                • {error}
                              </p>
                            ))}
                            {sidangCellErrors.map((error, index) => (
                              <p
                                key={index}
                                className="text-sm text-red-600 dark:text-red-400 mb-1"
                              >
                                • {error.field === 'api'
                                  ? error.message
                                  : error.message}
                              </p>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                  {/* Preview Table */}
                  {sidangImportData.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Preview Data ({sidangImportData.length} jadwal Sidang Skripsi)
                        </h3>
                        <div className="flex items-center gap-3">
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            File: {sidangImportFile?.name}
                          </div>
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
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Sesi</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pembimbing</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Penguji</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Mahasiswa</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sidangImportData
                                .slice((sidangImportPage - 1) * sidangImportPageSize, sidangImportPage * sidangImportPageSize)
                                .map((row, index) => {
                                  const actualIndex = (sidangImportPage - 1) * sidangImportPageSize + index;

                                  const renderEditableCell = (field: string, value: any, isNumeric = false) => {
                                    const isEditing = sidangEditingCell?.row === actualIndex && sidangEditingCell?.key === field;
                                    const cellError = sidangCellErrors.find(err => err.row === actualIndex + 1 && err.field === field);

                                    return (
                                      <td
                                        className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                        onClick={() => setSidangEditingCell({ row: actualIndex, key: field })}
                                        title={cellError ? cellError.message : ''}
                                      >
                                        {isEditing ? (
                                          <input
                                            className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                            type={isNumeric ? "number" : "text"}
                                            value={value || ""}
                                            onChange={e => handleSidangEditCell(actualIndex, field, isNumeric ? parseInt(e.target.value) : e.target.value)}
                                            onBlur={handleSidangFinishEdit}
                                            onKeyDown={e => {
                                              if (e.key === 'Enter') {
                                                handleSidangFinishEdit();
                                              }
                                              if (e.key === 'Escape') {
                                                handleSidangFinishEdit();
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
                                      className={`${index % 2 === 1 ? 'bg-gray-50 dark:bg-white/2' : ''}`}
                                    >
                                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{actualIndex + 1}</td>
                                      {renderEditableCell('tanggal', row.tanggal)}
                                      {renderEditableCell('jam_mulai', row.jam_mulai)}
                                      {renderEditableCell('jumlah_sesi', row.jumlah_sesi, true)}
                                      {(() => {
                                        const field = 'nama_pembimbing';
                                        const isEditing = sidangEditingCell?.row === actualIndex && sidangEditingCell?.key === field;
                                        const cellError = sidangCellErrors.find(err => err.row === actualIndex + 1 && err.field === 'pembimbing_id');
                                        const pembimbing = dosenList.find(d => d.id === row.pembimbing_id);

                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                            onClick={() => setSidangEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                                type="text"
                                                value={row.nama_pembimbing || ""}
                                                onChange={e => handleSidangEditCell(actualIndex, field, e.target.value)}
                                                onBlur={handleSidangFinishEdit}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    handleSidangFinishEdit();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    handleSidangFinishEdit();
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                                {pembimbing ? pembimbing.name : (row.nama_pembimbing || 'Tidak ditemukan')}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })()}
                                      {(() => {
                                        const field = 'nama_penguji';
                                        const isEditing = sidangEditingCell?.row === actualIndex && sidangEditingCell?.key === field;
                                        const cellError = sidangCellErrors.find(err => err.row === actualIndex + 1 && err.field === 'penguji_ids');

                                        // Tampilkan penguji names dengan backslash separator (bukan koma)
                                        // Jika ada nama_penguji (string), gunakan itu. Jika tidak, buat dari penguji_ids
                                        let pengujiNames = '';
                                        if (row.nama_penguji && typeof row.nama_penguji === 'string') {
                                          pengujiNames = row.nama_penguji;
                                        } else if (row.penguji_ids && row.penguji_ids.length > 0) {
                                          pengujiNames = row.penguji_ids.map((id: number) => {
                                            const dosen = dosenList.find(d => d.id === id);
                                            return dosen?.name || '';
                                          }).filter(Boolean).join('\\');
                                        }

                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                            onClick={() => setSidangEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                                type="text"
                                                value={typeof row.nama_penguji === 'string' ? row.nama_penguji : (pengujiNames || "")}
                                                onChange={e => handleSidangEditCell(actualIndex, field, e.target.value)}
                                                onBlur={handleSidangFinishEdit}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    handleSidangFinishEdit();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    handleSidangFinishEdit();
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                                {pengujiNames || 'Tidak ditemukan'}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })()}
                                      {(() => {
                                        const field = 'nama_mahasiswa';
                                        const isEditing = sidangEditingCell?.row === actualIndex && sidangEditingCell?.key === field;
                                        const cellError = sidangCellErrors.find(err => err.row === actualIndex + 1 && err.field === 'mahasiswa_nims');
                                        // Ambil nama mahasiswa dari mahasiswaList berdasarkan NIM
                                        const mahasiswaNames = row.mahasiswa_nims && row.mahasiswa_nims.length > 0
                                          ? row.mahasiswa_nims.map((nim: string) => {
                                            const mahasiswa = mahasiswaList.find(m => m.nim === nim);
                                            return mahasiswa ? mahasiswa.name : null;
                                          }).filter(Boolean).join(', ')
                                          : '';

                                        // Untuk editing, gunakan nama mahasiswa (bukan NIM atau nama_mahasiswa dari row)
                                        const editingValue = typeof row.nama_mahasiswa === 'string'
                                          ? row.nama_mahasiswa
                                          : (mahasiswaNames || (Array.isArray(row.nama_mahasiswa) ? row.nama_mahasiswa.join(', ') : ""));

                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                            onClick={() => setSidangEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                                type="text"
                                                value={editingValue}
                                                onChange={e => handleSidangEditCell(actualIndex, field, e.target.value)}
                                                onBlur={handleSidangFinishEdit}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    handleSidangFinishEdit();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    handleSidangFinishEdit();
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                                {mahasiswaNames || (typeof row.nama_mahasiswa === 'string' ? row.nama_mahasiswa : (Array.isArray(row.nama_mahasiswa) ? row.nama_mahasiswa.join(', ') : 'Tidak ditemukan'))}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })()}
                                      {(() => {
                                        const field = 'nama_ruangan';
                                        const isEditing = sidangEditingCell?.row === actualIndex && sidangEditingCell?.key === field;
                                        const cellError = sidangCellErrors.find(err => err.row === actualIndex + 1 && err.field === 'ruangan_id');
                                        const ruangan = ruanganList.find(r => r.id === row.ruangan_id);

                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                            onClick={() => setSidangEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                                type="text"
                                                value={row.nama_ruangan || ""}
                                                onChange={e => handleSidangEditCell(actualIndex, field, e.target.value)}
                                                onBlur={handleSidangFinishEdit}
                                                onKeyDown={e => {
                                                  if (e.key === 'Enter') {
                                                    handleSidangFinishEdit();
                                                  }
                                                  if (e.key === 'Escape') {
                                                    handleSidangFinishEdit();
                                                  }
                                                }}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                                {ruangan ? ruangan.nama : (row.nama_ruangan || 'Tidak ditemukan')}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      })()}
                                    </tr>
                                  );
                                })}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      {/* Pagination untuk Import Preview */}
                      {sidangImportData.length > sidangImportPageSize && (
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                          <div className="flex items-center gap-4">
                            <select
                              value={sidangImportPageSize}
                              onChange={e => { setSidangImportPageSize(Number(e.target.value)); setSidangImportPage(1); }}
                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                            >
                              <option value={5}>5 per halaman</option>
                              <option value={10}>10 per halaman</option>
                              <option value={20}>20 per halaman</option>
                              <option value={50}>50 per halaman</option>
                            </select>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Menampilkan {((sidangImportPage - 1) * sidangImportPageSize) + 1}-{Math.min(sidangImportPage * sidangImportPageSize, sidangImportData.length)} dari {sidangImportData.length} jadwal
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setSidangImportPage(p => Math.max(1, p - 1))}
                              disabled={sidangImportPage === 1}
                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                            >
                              Prev
                            </button>
                            <span className="text-sm text-gray-500 dark:text-gray-400">
                              Halaman {sidangImportPage} dari {Math.ceil(sidangImportData.length / sidangImportPageSize)}
                            </span>
                            <button
                              onClick={() => setSidangImportPage(p => Math.min(Math.ceil(sidangImportData.length / sidangImportPageSize), p + 1))}
                              disabled={sidangImportPage >= Math.ceil(sidangImportData.length / sidangImportPageSize)}
                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                </>
              )}

              {/* Footer */}
              <div className={`flex justify-end gap-3 pt-6 ${sidangImportFile ? 'border-t border-gray-200 dark:border-gray-700' : ''}`}>
                <button
                  onClick={handleSidangCloseUploadModal}
                  className="px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Batal
                </button>
                {sidangImportFile && sidangImportData.length > 0 &&
                  sidangImportErrors.length === 0 &&
                  sidangCellErrors.length === 0 && (
                    <button
                      onClick={handleSidangSubmitImport}
                      disabled={isSidangImporting}
                      className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                      {isSidangImporting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                          Importing...
                        </>
                      ) : (
                        <>
                          <FontAwesomeIcon
                            icon={faUpload}
                            className="w-4 h-4"
                          />
                          Import Data ({sidangImportData.length} jadwal)
                        </>
                      )}
                    </button>
                  )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL KONFIRMASI BULK DELETE SIDANG SKRIPSI */}
      <AnimatePresence>
        {showSidangBulkDeleteModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowSidangBulkDeleteModal(false)}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              <div className="flex items-center justify-between pb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  Konfirmasi Hapus Data
                </h2>
              </div>
              <div>
                <p className="mb-6 text-gray-500 dark:text-gray-400">
                  Apakah Anda yakin ingin menghapus{" "}
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {selectedSidangItems.length}
                  </span>{" "}
                  jadwal Sidang Skripsi terpilih? Data yang dihapus tidak dapat dikembalikan.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowSidangBulkDeleteModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmSidangBulkDelete}
                    disabled={isSidangDeleting}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSidangDeleting ? (
                      <>
                        <svg
                          className="w-5 h-5 mr-2 animate-spin text-white"
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
                        Menghapus...
                      </>
                    ) : (
                      "Hapus"
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
