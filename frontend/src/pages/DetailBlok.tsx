import { useParams, useNavigate } from 'react-router-dom';

import { useRef, useEffect, useState, useCallback, ChangeEvent } from 'react';
import api, { API_BASE_URL, handleApiError } from '../utils/api';

import { ChevronLeftIcon } from '../icons';

import { AnimatePresence, motion } from 'framer-motion';

import Select from 'react-select';

import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';

import { faPenToSquare, faTrash, faFileExcel, faDownload, faUpload, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';

import { getRuanganOptions } from '../utils/ruanganHelper';

import * as XLSX from 'xlsx';

// Constants
const SESSION_DURATION_MINUTES = 50;
const MAX_SESSIONS = 6;
const MIN_SESSIONS = 1;
const TEMPLATE_DISPLAY_LIMIT = 10;
const DEFAULT_PAGE_SIZE = 10;
const EXCEL_COLUMN_WIDTHS = {
  TANGGAL: 12,
  JAM_MULAI: 10,
  MATERI: 25,
  TOPIK: 30,
  KELAS_PRAKTIKUM: 15,
  DOSEN: 25,
  RUANGAN: 20,
  KELOMPOK_KECIL: 15,
  KELOMPOK_BESAR: 15,
  MODUL_PBL: 30,
  PBL_TIPE: 10,
  SESI: 6,
  INFO_COLUMN: 50
};

interface MataKuliah {

  kode: string;

  nama: string;

  semester: number;

  periode: string;

  kurikulum: number;

  jenis: string;

  blok?: number | null;

  tanggal_mulai?: string;

  tanggal_akhir?: string;

  durasi_minggu?: number | null;

  keahlian_required?: string[];

}



// Type definitions untuk jadwal

type JadwalKuliahBesarType = {

  id?: number;

  tanggal: string;

  jam_mulai: string;

  jam_selesai: string;

  materi: string;

  topik?: string;

  dosen_id: number;

  ruangan_id: number;

  jumlah_sesi: number;

  [key: string]: any;

};



type JadwalAgendaKhususType = {

  id?: number;

  tanggal: string;

  jam_mulai: string;

  jam_selesai: string;

  agenda: string;

  ruangan_id: number | null;

  kelompok_besar_id: number | null;

  use_ruangan: boolean;

  jumlah_sesi: number;

  [key: string]: any;

};



type JadwalPraktikumType = {

  id?: number;

  tanggal: string;

  jam_mulai: string;

  jam_selesai: string;

  topik: string;

  kelas_praktikum: string;

  dosen_id: number;

  ruangan_id: number;

  jumlah_sesi: number;

  [key: string]: any;

};



type JadwalJurnalReadingType = {

  id?: number;

  tanggal: string;

  jam_mulai: string;

  jam_selesai: string;

  topik: string;

  kelompok_kecil_id: number;

  dosen_id: number;

  ruangan_id: number;

  file_jurnal?: string;

  [key: string]: any;

};







type ModulPBLType = { id: number; modul_ke: string; nama_modul: string; };

type KelompokKecilType = { id: number; nama_kelompok: string; jumlah_anggota: number; };

type DosenType = { id: number; name: string; nid?: string; keahlian?: string | string[]; };

type RuanganType = { id: number; nama: string; kapasitas?: number; gedung?: string; };

type JadwalPBLType = {

  id?: number;

  tanggal: string;

  jam_mulai: string;

  jam_selesai: string;

  modul_pbl_id: number;

  kelompok_kecil_id: number;

  dosen_id: number;

  ruangan_id: number;

  [key: string]: any;

};







export default function DetailBlok() {

  const { kode } = useParams();

  const navigate = useNavigate();

  const [data, setData] = useState<MataKuliah | null>(null);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);
  
  // State untuk pesan sukses per section
  const [kuliahBesarSuccess, setKuliahBesarSuccess] = useState<string | null>(null);
  const [praktikumSuccess, setPraktikumSuccess] = useState<string | null>(null);
  const [agendaKhususSuccess, setAgendaKhususSuccess] = useState<string | null>(null);
  const [pblSuccess, setPblSuccess] = useState<string | null>(null);
  const [jurnalReadingSuccess, setJurnalReadingSuccess] = useState<string | null>(null);

  // Auto-hide pesan sukses bulk delete (refactored dengan custom logic)
  useEffect(() => {
    const successStates = [
      { value: kuliahBesarSuccess, setter: setKuliahBesarSuccess },
      { value: praktikumSuccess, setter: setPraktikumSuccess },
      { value: agendaKhususSuccess, setter: setAgendaKhususSuccess },
      { value: jurnalReadingSuccess, setter: setJurnalReadingSuccess }
    ];

    const timers = successStates
      .filter(state => state.value)
      .map(state => setTimeout(() => state.setter(null), 5000));

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [kuliahBesarSuccess, praktikumSuccess, agendaKhususSuccess, jurnalReadingSuccess]);



  // State untuk modal input jadwal materi

  const [showModal, setShowModal] = useState(false);



  const [form, setForm] = useState<{

    hariTanggal: string;

    jamMulai: string;

    jumlahKali: number;

    jamSelesai: string;

    pengampu: number | number[] | null;

    materi: string;

    topik: string;

    lokasi: number | null;

    jenisBaris: 'materi' | 'agenda' | 'praktikum' | 'pbl' | 'jurnal';

    agenda: string;

    kelasPraktikum: string;

    pblTipe: string;

    modul: number | null;

    kelompok: string;

    kelompokBesar: number | null;

    useRuangan: boolean;

    fileJurnal: File | null;

  }>({

    hariTanggal: '',

    jamMulai: '',

    jumlahKali: 2,

    jamSelesai: '',

    pengampu: null,

    materi: '',

    topik: '',

    lokasi: null,

    jenisBaris: 'materi',

    agenda: '',

    kelasPraktikum: '',

    pblTipe: '',

    modul: null,

    kelompok: '',

    kelompokBesar: null,

    useRuangan: true,

    fileJurnal: null,

  });

  const [errorForm, setErrorForm] = useState(''); // Error frontend (validasi form)

  const [errorBackend, setErrorBackend] = useState(''); // Error backend (response API)

  const [editIndex, setEditIndex] = useState<number | null>(null);

  const [dosenList, setDosenList] = useState<DosenType[]>([]);

  const [ruanganList, setRuanganList] = useState<RuanganType[]>([]);

  const [allDosenList, setAllDosenList] = useState<DosenType[]>([]);

  const [allRuanganList, setAllRuanganList] = useState<RuanganType[]>([]);

  const [jadwalPBL, setJadwalPBL] = useState<JadwalPBLType[]>([]);

  const [isSaving, setIsSaving] = useState(false);

  const [modulPBLList, setModulPBLList] = useState<ModulPBLType[]>([]);

  const [topikJurnalReadingList, setTopikJurnalReadingList] = useState<string[]>([]);

  const [kelompokKecilList, setKelompokKecilList] = useState<KelompokKecilType[]>([]);

  const [loadingPBL, setLoadingPBL] = useState(true);

  const [loadingDosenRuangan, setLoadingDosenRuangan] = useState(true);



  // Tambahkan state untuk materi dan pengampu dinamis

  const [materiOptions, setMateriOptions] = useState<string[]>([]);

  const [pengampuOptions, setPengampuOptions] = useState<DosenType[]>([]);

  const [kelompokBesarOptions, setKelompokBesarOptions] = useState<{id: string | number, label: string, jumlah_mahasiswa: number}[]>([]);

  const [kelompokBesarAgendaOptions, setKelompokBesarAgendaOptions] = useState<{id: string | number, label: string, jumlah_mahasiswa: number}[]>([]);

  const [jadwalKuliahBesar, setJadwalKuliahBesar] = useState<JadwalKuliahBesarType[]>([]);

  const [jadwalAgendaKhusus, setJadwalAgendaKhusus] = useState<JadwalAgendaKhususType[]>([]);

  const [jadwalPraktikum, setJadwalPraktikum] = useState<JadwalPraktikumType[]>([]);

  const [materiPraktikumOptions, setMateriPraktikumOptions] = useState<string[]>([]);

  const [kelasPraktikumOptions, setKelasPraktikumOptions] = useState<string[]>([]);

  const [pengampuPraktikumOptions, setPengampuPraktikumOptions] = useState<DosenType[]>([]);

  const [jadwalJurnalReading, setJadwalJurnalReading] = useState<JadwalJurnalReadingType[]>([]);

  const [jamOptions, setJamOptions] = useState<string[]>([]);

  

  // State untuk assigned dosen PBL

  const [assignedDosenPBL, setAssignedDosenPBL] = useState<DosenType[]>([]);

  const [hasAssignedPBL, setHasAssignedPBL] = useState(false);

  const [loadingAssignedPBL, setLoadingAssignedPBL] = useState(false);



  // State untuk import Excel
  const [showTemplateSelectionModal, setShowTemplateSelectionModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showSIAKADImportModal, setShowSIAKADImportModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<'LAMA' | 'SIAKAD' | null>(null);

  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<JadwalKuliahBesarType[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [cellErrors, setCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // State untuk import Excel SIAKAD
  const [siakadImportFile, setSiakadImportFile] = useState<File | null>(null);
  const [siakadImportData, setSiakadImportData] = useState<JadwalKuliahBesarType[]>([]);
  const [siakadImportErrors, setSiakadImportErrors] = useState<string[]>([]);
  const [siakadCellErrors, setSiakadCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [siakadEditingCell, setSiakadEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [isSiakadImporting, setIsSiakadImporting] = useState(false);
  const [siakadImportPage, setSiakadImportPage] = useState(1);
  const [siakadImportPageSize, setSiakadImportPageSize] = useState(DEFAULT_PAGE_SIZE);


  // State untuk import Excel Praktikum
  const [showPraktikumImportModal, setShowPraktikumImportModal] = useState(false);
  const [showPraktikumTemplateSelectionModal, setShowPraktikumTemplateSelectionModal] = useState(false);
  const [selectedPraktikumTemplate, setSelectedPraktikumTemplate] = useState<'LAMA' | 'SIAKAD' | null>(null);
  const [praktikumImportFile, setPraktikumImportFile] = useState<File | null>(null);
  const [praktikumImportData, setPraktikumImportData] = useState<JadwalPraktikumType[]>([]);
  const [praktikumImportErrors, setPraktikumImportErrors] = useState<string[]>([]);
  const [praktikumCellErrors, setPraktikumCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [praktikumEditingCell, setPraktikumEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [isPraktikumImporting, setIsPraktikumImporting] = useState(false);
  const [praktikumImportedCount, setPraktikumImportedCount] = useState(0);
  const [importedCount, setImportedCount] = useState(0);
  const [siakadImportedCount, setSiakadImportedCount] = useState(0);

  // State untuk import Excel Praktikum SIAKAD
  const [showPraktikumSiakadImportModal, setShowPraktikumSiakadImportModal] = useState(false);
  const [praktikumSiakadImportFile, setPraktikumSiakadImportFile] = useState<File | null>(null);
  const [praktikumSiakadImportData, setPraktikumSiakadImportData] = useState<JadwalPraktikumType[]>([]);
  const [praktikumSiakadImportErrors, setPraktikumSiakadImportErrors] = useState<string[]>([]);
  const [praktikumSiakadCellErrors, setPraktikumSiakadCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [praktikumSiakadEditingCell, setPraktikumSiakadEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [praktikumSiakadImportPage, setPraktikumSiakadImportPage] = useState(1);
  const [praktikumSiakadImportedCount, setPraktikumSiakadImportedCount] = useState(0);

  // State untuk import PBL Excel
  const [showPBLTemplateSelectionModal, setShowPBLTemplateSelectionModal] = useState(false);
  const [selectedPBLTemplate, setSelectedPBLTemplate] = useState<'LAMA' | 'SIAKAD' | null>(null);
  const [showPBLImportModal, setShowPBLImportModal] = useState(false);

  const [pblImportFile, setPBLImportFile] = useState<File | null>(null);

  const [pblImportData, setPBLImportData] = useState<JadwalPBLType[]>([]);
  const [pblImportErrors, setPBLImportErrors] = useState<string[]>([]);
  const [pblCellErrors, setPBLCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);

  const [pblEditingCell, setPBLEditingCell] = useState<{ row: number; key: string } | null>(null);

  const [isPBLImporting, setIsPBLImporting] = useState(false);

  // State untuk import Excel Agenda Khusus
  const [showAgendaKhususImportModal, setShowAgendaKhususImportModal] = useState(false);
  const [agendaKhususImportFile, setAgendaKhususImportFile] = useState<File | null>(null);
  const [agendaKhususImportData, setAgendaKhususImportData] = useState<JadwalAgendaKhususType[]>([]);
  const [agendaKhususImportErrors, setAgendaKhususImportErrors] = useState<string[]>([]);
  const [agendaKhususCellErrors, setAgendaKhususCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [agendaKhususEditingCell, setAgendaKhususEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [isAgendaKhususImporting, setIsAgendaKhususImporting] = useState(false);
  const [agendaKhususImportedCount, setAgendaKhususImportedCount] = useState(0);

  // State untuk import Excel Jurnal Reading
  const [showJurnalReadingImportModal, setShowJurnalReadingImportModal] = useState(false);
  const [jurnalReadingImportFile, setJurnalReadingImportFile] = useState<File | null>(null);
  const [jurnalReadingImportData, setJurnalReadingImportData] = useState<JadwalJurnalReadingType[]>([]);
  const [jurnalReadingImportErrors, setJurnalReadingImportErrors] = useState<string[]>([]);
  const [jurnalReadingCellErrors, setJurnalReadingCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [jurnalReadingEditingCell, setJurnalReadingEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [isJurnalReadingImporting, setIsJurnalReadingImporting] = useState(false);
  const [jurnalReadingImportedCount, setJurnalReadingImportedCount] = useState(0);

  // State untuk bulk delete
  const [selectedKuliahBesarItems, setSelectedKuliahBesarItems] = useState<number[]>([]);
  const [selectedPraktikumItems, setSelectedPraktikumItems] = useState<number[]>([]);
  const [selectedAgendaKhususItems, setSelectedAgendaKhususItems] = useState<number[]>([]);
  const [selectedPBLItems, setSelectedPBLItems] = useState<number[]>([]);
  const [selectedJurnalReadingItems, setSelectedJurnalReadingItems] = useState<number[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteType, setBulkDeleteType] = useState<'kuliah-besar' | 'praktikum' | 'agenda-khusus' | 'pbl' | 'jurnal-reading'>('kuliah-besar');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);



  const [pblImportedCount, setPBLImportedCount] = useState(0);

  // State untuk import Excel PBL SIAKAD
  const [pblSiakadImportFile, setPBLSiakadImportFile] = useState<File | null>(null);
  const [pblSiakadImportData, setPBLSiakadImportData] = useState<JadwalPBLType[]>([]);
  const [pblSiakadImportErrors, setPBLSiakadImportErrors] = useState<string[]>([]);
  const [pblSiakadCellErrors, setPBLSiakadCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [pblSiakadEditingCell, setPBLSiakadEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [pblSiakadImportPage, setPBLSiakadImportPage] = useState(1);
  const [pblSiakadImportedCount, setPBLSiakadImportedCount] = useState(0);

  // State untuk pagination PBL import preview

  const [pblImportPage, setPBLImportPage] = useState(1);

  const [pblImportPageSize, setPBLImportPageSize] = useState(DEFAULT_PAGE_SIZE);
  
  // State untuk menyimpan input sementara saat editing PBL
  const [pblDosenInput, setPBLDosenInput] = useState<string>('');
  const [pblRuanganInput, setPBLRuanganInput] = useState<string>('');
  

  // State untuk pagination import preview

  const [importPage, setImportPage] = useState(1);

  const [importPageSize, setImportPageSize] = useState(DEFAULT_PAGE_SIZE);
  
  // State untuk pagination Praktikum import preview
  const [praktikumImportPage, setPraktikumImportPage] = useState(1);
  const [praktikumImportPageSize, setPraktikumImportPageSize] = useState(DEFAULT_PAGE_SIZE);
  

  // Ref untuk input file Excel

  const fileInputRef = useRef<HTMLInputElement>(null);

  const pblFileInputRef = useRef<HTMLInputElement>(null);
  const pblSiakadFileInputRef = useRef<HTMLInputElement>(null);

  const praktikumFileInputRef = useRef<HTMLInputElement>(null);
  const praktikumSiakadFileInputRef = useRef<HTMLInputElement>(null);

  const agendaKhususFileInputRef = useRef<HTMLInputElement>(null);
  const jurnalReadingFileInputRef = useRef<HTMLInputElement>(null);


  // Fetch materi (keahlian) dari mata kuliah yang sedang dipilih

  const fetchMateriOptions = async () => {

    if (!data) return;

    try {

      // Ambil keahlian_required dari mata kuliah yang sedang dipilih

      const keahlianRequired = data.keahlian_required || [];

      setMateriOptions(keahlianRequired);

    } catch (error) {

      // Silent fail - materi options are not critical

    }

  };



  // Fetch pengampu dinamis setelah materi dipilih

  const fetchPengampuOptions = async (materi: string) => {

    if (!data || !materi) return;

    try {

      // Ambil semua dosen yang memiliki keahlian yang dipilih

      const res = await api.get(`/users?role=dosen&keahlian=${encodeURIComponent(materi)}`);

      const dosenList = res.data || [];

      

      // Filter dosen yang memiliki keahlian yang dipilih

      const filteredDosen = dosenList.filter((dosen: any) => {

        const keahlian = Array.isArray(dosen.keahlian) 

          ? dosen.keahlian 

          : (dosen.keahlian || '').split(',').map((k: string) => k.trim());

        return keahlian.includes(materi);

      });

      

      setPengampuOptions(filteredDosen);

    } catch (error) {

      // Silent fail - pengampu options are not critical

    }

  };



  // Fetch kelompok besar options

  const fetchKelompokBesarOptions = async () => {

    if (!data) return;

    try {

      const res = await api.get(`/kuliah-besar/kelompok-besar?semester=${data.semester}`);

      

      setKelompokBesarOptions(Array.isArray(res.data) ? res.data : []);

    } catch (err) {

      // Error fetching kelompok besar

    }

  };



  // Fetch kelompok besar options for agenda khusus

  const fetchKelompokBesarAgendaOptions = async () => {

    if (!data) return;

    try {

      const res = await api.get(`/agenda-khusus/kelompok-besar?semester=${data.semester}`);

      

      setKelompokBesarAgendaOptions(Array.isArray(res.data) ? res.data : []);

    } catch (err) {

      // Error fetching kelompok besar agenda

    }

  };







  // Fetch materi praktikum dinamis - ambil dari keahlian_required mata kuliah

  const fetchMateriPraktikum = async () => {

    if (!data) return;

    try {

      const keahlianRequired = data.keahlian_required || [];

      setMateriPraktikumOptions(keahlianRequired);

    } catch (error) {

      // Silent fail

    }

  };



  // Fetch kelas praktikum dinamis

  const fetchKelasPraktikum = async () => {

    if (!data) return [];
    try {

      const res = await api.get(`/kelas/semester/${data.semester}`);

      const kelasData = Array.isArray(res.data) ? res.data.map((k: any) => k.nama_kelas) : [];
      setKelasPraktikumOptions(kelasData);
      return kelasData; // Return data untuk digunakan langsung
    } catch (error) {

      return []; // Return empty array jika error
    }
  };

  // Fetch kelas praktikum untuk template Excel (dipanggil saat data dimuat)
  const fetchKelasPraktikumForTemplate = async (semester: number) => {
    try {
      const res = await api.get(`/kelas/semester/${semester}`);
      return Array.isArray(res.data) ? res.data.map((k: any) => k.nama_kelas) : [];
    } catch (error) {
      return [];
    }

  };



  // Fetch pengampu praktikum berdasarkan materi - ambil dosen yang punya keahlian yang dipilih

  const fetchPengampuPraktikum = async (materi: string) => {

    if (!data || !materi) return;

    try {

      const res = await api.get(`/users?role=dosen&keahlian=${encodeURIComponent(materi)}`);

      const dosenList = res.data || [];

      const filteredDosen = dosenList.filter((dosen: any) => {

        const keahlian = Array.isArray(dosen.keahlian)

          ? dosen.keahlian

          : (dosen.keahlian || '').split(',').map((k: string) => k.trim());

        return keahlian.includes(materi);

      });

      setPengampuPraktikumOptions(filteredDosen);

    } catch (error) {

      // Silent fail

    }

  };



  // Saat modal dibuka, fetch materi sesuai jenis baris

  useEffect(() => {

    if (showModal) {

      if (form.jenisBaris === 'materi') {

        fetchMateriOptions();

        fetchKelompokBesarOptions();

        // Fetch pengampu jika materi sudah dipilih (untuk edit)

        if (form.materi) {

          fetchPengampuOptions(form.materi);

        } else {

          setPengampuOptions([]);

        }

      } else if (form.jenisBaris === 'praktikum') {

        fetchMateriPraktikum();

        fetchKelasPraktikum();

        // Fetch pengampu jika materi sudah dipilih (untuk edit)

        if (form.materi) {

          fetchPengampuPraktikum(form.materi);

        } else {

          setPengampuPraktikumOptions([]);

        }

      } else if (form.jenisBaris === 'agenda') {

        fetchKelompokBesarAgendaOptions();

      }

    }

  }, [showModal, form.jenisBaris, form.materi]);



  // Saat materi dipilih, fetch pengampu

  useEffect(() => {

    if (form.jenisBaris === 'materi' && form.materi) {

      fetchPengampuOptions(form.materi);

    } else if (form.jenisBaris !== 'materi') {

      setPengampuOptions([]);

    }

  }, [form.jenisBaris, form.materi]);



  // Saat materi praktikum dipilih, fetch pengampu

  useEffect(() => {

    if (form.jenisBaris === 'praktikum' && form.materi) {

      fetchPengampuPraktikum(form.materi);

    } else if (form.jenisBaris !== 'praktikum') {

      setPengampuPraktikumOptions([]);

    }

  }, [form.jenisBaris, form.materi]);



  // Reset pengampu options ketika jenis baris berubah

  useEffect(() => {

    if (form.jenisBaris !== 'materi') {

      setPengampuOptions([]);

    }

    if (form.jenisBaris !== 'praktikum') {

      setPengampuPraktikumOptions([]);

    }

    // Reset materi ketika jenis baris berubah (hanya untuk tambah baru, bukan edit)

    if (form.materi && !showModal) {

      setForm(f => ({ ...f, materi: '', pengampu: form.jenisBaris === 'praktikum' ? [] : null }));

    }

  }, [form.jenisBaris, showModal]);





  // Fungsi untuk format tanggal yang konsisten seperti di Agenda Khusus

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



  function hitungJamSelesai(jamMulai: string, jumlahKali: number) {

    if (!jamMulai) return '';

    const [jamStr, menitStr] = jamMulai.split(/[.:]/);

    const jam = Number(jamStr);

    const menit = Number(menitStr);

    if (isNaN(jam) || isNaN(menit)) return '';

    const totalMenit = jam * 60 + menit + jumlahKali * SESSION_DURATION_MINUTES;
    const jamAkhir = Math.floor(totalMenit / 60).toString().padStart(2, '0');

    const menitAkhir = (totalMenit % 60).toString().padStart(2, '0');

    return `${jamAkhir}:${menitAkhir}`;

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



  // Helper function untuk truncate filename

  function truncateFileName(fileName: string, maxLength: number = 20) {

    if (!fileName) return '';

    if (fileName.length <= maxLength) return fileName;

    

    const dotIdx = fileName.lastIndexOf('.');

    if (dotIdx === -1) return fileName.slice(0, maxLength - 3) + '...';

    

    const ext = fileName.slice(dotIdx);

    const base = fileName.slice(0, maxLength - 3 - ext.length);

    return base + '...' + ext;

  }



  // Helper function untuk reset error form

  function resetErrorForm() {

    if (errorForm && !errorForm.includes('Tanggal tidak boleh') && !errorForm.includes('Hari/Tanggal sudah ada')) {

      setErrorForm('');

    }

    setErrorBackend(''); // Reset error backend

  }



  // Helper function untuk reset form dengan semua field yang diperlukan

  function resetForm(jenisBaris: 'materi' | 'agenda' | 'praktikum' | 'pbl' | 'jurnal' = 'materi') {

    setForm({

      hariTanggal: '',

      jamMulai: '',

      jumlahKali: jenisBaris === 'jurnal' ? 2 : 1,

      jamSelesai: '',

      pengampu: jenisBaris === 'praktikum' ? [] : null,

      materi: '',

      topik: '',

      lokasi: null,

      jenisBaris,

      agenda: '',

      kelasPraktikum: '',

      pblTipe: '',

      modul: null,

      kelompok: '',

      kelompokBesar: null,

      useRuangan: true,

      fileJurnal: null,

    });

  }



  // Helper function untuk membuat options ruangan

  const getRuanganOptionsLocal = () => {

    return getRuanganOptions(ruanganList || []);

  };



  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {

    const { name, value } = e.target;

    if (name === 'hariTanggal' && value && !/^\d{4}-\d{2}-\d{2}$/.test(value)) {

      // Jika value bukan format YYYY-MM-DD, jangan update form (biarkan user mengetik sampai valid)

      return;

    }

    let newForm = { ...form, [name]: value };

    if (name === 'jamMulai' || name === 'jumlahKali') {

      const jumlah = name === 'jumlahKali' ? Number(value) : Number(newForm.jumlahKali);

      newForm.jamSelesai = hitungJamSelesai(name === 'jamMulai' ? value : newForm.jamMulai, jumlah);

    }

    let isDuplicate = false;

    if (name === 'hariTanggal') {

      // Cek duplicate untuk PBL - hanya jika tanggal, kelompok, dan pbl_tipe sama

      if (form.jenisBaris === 'pbl') {

        isDuplicate = jadwalPBL.some((j: JadwalPBLType, idx: number) => {

          if (!j.tanggal) return false;

          const tglISO = j.tanggal.slice(0, 10);

        if (editIndex !== null && idx === editIndex) return false;

          

          // Cek apakah tanggal, kelompok, dan pbl_tipe sama

          const sameDate = tglISO === value;

          const sameGroup = j.kelompok_kecil?.nama_kelompok === form.kelompok;

          const samePblType = j.pbl_tipe === form.pblTipe;

          

          return sameDate && sameGroup && samePblType;

      });

      }

      if (isDuplicate) {

        setErrorForm('Hari/Tanggal sudah ada di jadwal PBL untuk kelompok dan tipe yang sama!');

      } else {

        setErrorForm('');

      }

    }

    if (name === 'hariTanggal' && data && value) {

      const tglMulai = new Date(data.tanggal_mulai || '');

      const tglAkhir = new Date(data.tanggal_akhir || '');

      const tglInput = new Date(value);

      if (tglMulai && tglInput < tglMulai) {

        setErrorForm('Tanggal tidak boleh sebelum tanggal mulai!');

      } else if (tglAkhir && tglInput > tglAkhir) {

        setErrorForm('Tanggal tidak boleh setelah tanggal akhir!');

      } else if (!isDuplicate) {

        setErrorForm('');

      }

    }

    setForm(newForm);

    

    // Reset error form ketika ada perubahan input (kecuali untuk validasi tanggal yang sudah ada)

    if (errorForm && !errorForm.includes('Tanggal tidak boleh') && !errorForm.includes('Hari/Tanggal sudah ada di jadwal PBL')) {

      setErrorForm('');

    }

    

    // Reset error dari backend ketika user mengubah form (untuk memberikan kesempatan retry)

    if (errorBackend) {

      setErrorBackend('');

    }

  }



  function handleEditJadwal(idx: number, jenisBaris?: string) {

    // Untuk PBL, gunakan jadwalPBL

    const row = jenisBaris === 'pbl' ? jadwalPBL[idx] : null;

    if (!row) return;

    let tglISO = '';

    if (row.hariTanggal) {

      if (/^\d{4}-\d{2}-\d{2}$/.test(row.hariTanggal)) {

        tglISO = row.hariTanggal;

      } else {

      const tglStr = row.hariTanggal.split(', ')[1];

        if (tglStr && /^\d{4}-\d{2}-\d{2}$/.test(tglStr)) {

          tglISO = tglStr;

        }

      }

    }

    if (row.jenisBaris === 'agenda') {

      setForm({

        hariTanggal: tglISO,

        jamMulai: String(row.jamMulai || row.pukul?.split('-')[0] || ''),

        jumlahKali: Number(row.jumlahKali || (row.waktu ? row.waktu.split('x')[0] : 2)),

        jamSelesai: String(row.jamSelesai || row.pukul?.split('-')[1] || ''),

        pengampu: Number(row.pengampu || row.dosen_id || 0),

        materi: String(row.materi || ''),

        topik: String(row.topik || ''),

        lokasi: Number(row.lokasi || row.ruangan_id || 0),

        jenisBaris: row.jenisBaris || 'materi',

        agenda: String(row.agenda || ''),

        kelasPraktikum: String(row.kelasPraktikum || ''),

        pblTipe: String((row as any).pbl_tipe ?? row.pblTipe ?? ''),

        modul: Number(row.modul || row.modul_pbl_id || 0),

        kelompok: String(row.kelompok || ''),

        kelompokBesar: null,

        useRuangan: true,

        fileJurnal: null,

      });

    } else if (row.jenisBaris === 'praktikum') {

      setForm({

        hariTanggal: tglISO,

        jamMulai: String(row.jamMulai || row.pukul?.split('-')[0] || ''),

        jumlahKali: Number(row.jumlahKali || (row.waktu ? row.waktu.split('x')[0] : 2)),

        jamSelesai: String(row.jamSelesai || row.pukul?.split('-')[1] || ''),

        pengampu: Number(row.pengampu || row.dosen_id || 0),

        materi: String(row.materi || row.topik || ''),

        topik: String(row.topik || row.materi || ''),

        lokasi: Number(row.lokasi || row.ruangan_id || 0),

        jenisBaris: 'praktikum',

        agenda: '',

        kelasPraktikum: String(row.kelasPraktikum || ''),

        pblTipe: '',

        modul: 0,

        kelompok: '',

        kelompokBesar: null,

        useRuangan: true,

        fileJurnal: null, // Tambahkan fileJurnal

      });

    } else if (row.jenisBaris === 'pbl' || jenisBaris === 'pbl') {

      // Cari nama kelompok dari relasi kelompok_kecil

      const namaKelompok = row.kelompok_kecil?.nama_kelompok || '';

      

      setForm({

        hariTanggal: row.tanggal, // Gunakan tanggal langsung dari backend

        jamMulai: String(row.jam_mulai || ''),

        jumlahKali: Number(row.jumlah_sesi || 2),

        jamSelesai: String(row.jam_selesai || ''),

        pengampu: Number(row.dosen_id || 0),

        materi: '',

        topik: '',

        lokasi: Number(row.ruangan_id || 0),

        jenisBaris: 'pbl',

        agenda: '',

        kelasPraktikum: '',

        pblTipe: String(row.pbl_tipe || ''),

        modul: Number(row.modul_pbl_id || 0),

        kelompok: namaKelompok,

        kelompokBesar: null,

        useRuangan: true,

        fileJurnal: null,

      });

    } else if (row.jenisBaris === 'jurnal') {

      setForm({

        hariTanggal: tglISO,

        jamMulai: String(row.jamMulai || row.pukul?.split('-')[0] || ''),

        jumlahKali: Number(row.jumlahKali || (row.waktu ? row.waktu.split('x')[0] : 1)),

        jamSelesai: String(row.jamSelesai || row.pukul?.split('-')[1] || ''),

        pengampu: Number(row.pengampu || row.dosen_id || 0),

        materi: '',

        topik: '',

        lokasi: Number(row.lokasi || row.ruangan_id || 0),

        jenisBaris: 'jurnal',

        agenda: '',

        kelasPraktikum: '',

        pblTipe: '',

        modul: 0,

        kelompok: '',

        kelompokBesar: null,

        useRuangan: true,

        fileJurnal: null, // Tambahkan fileJurnal

      });

    } else {

      setForm({

        hariTanggal: tglISO,

        jamMulai: String(row.pukul?.split('-')[0] || ''),

        jumlahKali: Number(row.waktu?.split('x')[0]) || 2,

        jamSelesai: String(row.pukul?.split('-')[1] || ''),

        pengampu: 0,

        materi: String(row.materi || row.topik || ''),

        topik: String(row.topik || row.materi || ''),

        lokasi: Number(row.lokasi || row.ruangan_id || 0),

        jenisBaris: 'materi',

        agenda: '',

        kelasPraktikum: '',

        pblTipe: '',

        modul: 0,

        kelompok: '',

        kelompokBesar: null,

        useRuangan: true,

        fileJurnal: null, // Tambahkan fileJurnal

      });

    }

    setEditIndex(idx);

    setErrorForm('');

    setShowModal(true);

    // Fetch semua ruangan

    fetchRuanganForModal();

  }





  async function handleTambahJadwal() {

    setErrorForm('');

    if (form.jenisBaris === 'pbl') {

      // Validasi field wajib

      if (

        !form.hariTanggal ||

        !form.jamMulai ||

        !form.jamSelesai ||

        form.modul == null ||

        !form.kelompok ||

        form.pengampu == null ||

        form.lokasi == null

      ) {

        setErrorForm('Semua field wajib diisi!');

        throw new Error('Semua field wajib diisi!');

      }

      // Ambil id kelompok kecil dari list

      const kelompokObj = kelompokKecilList.find(k => k.nama_kelompok === form.kelompok);

      const kelompok_kecil_id = kelompokObj ? kelompokObj.id : null;

      if (!kelompok_kecil_id) {

        setErrorForm('Kelompok kecil tidak valid!');

        throw new Error('Kelompok kecil tidak valid!');

      }

      // Siapkan payload

      const payload = {

        tanggal: form.hariTanggal,

        jam_mulai: form.jamMulai,

        jam_selesai: form.jamSelesai,

        jumlah_sesi: form.pblTipe === 'PBL 2' ? 3 : 2,

        modul_pbl_id: Number(form.modul),

        kelompok_kecil_id,

        dosen_id: Number(form.pengampu),

        ruangan_id: Number(form.lokasi),

        pbl_tipe: form.pblTipe,

        topik: form.topik,

        catatan: '',

      };

      

      // Gunakan handler khusus untuk PBL

      try {

        await handleTambahJadwalPBL(payload);

        // Hanya tutup modal jika berhasil (tidak ada error)

        setShowModal(false);

        resetForm('materi');

        setExistingFileJurnal(null);

        setEditIndex(null);

      } catch (err) {

        // Jika ada error, modal tetap terbuka dan error sudah dihandle di handleTambahJadwalPBL

        throw err;

      }

      return;

    }

    

    // Handle untuk jenis baris 'materi' (kuliah besar)

    if (form.jenisBaris === 'materi') {

      // Validasi field wajib untuk kuliah besar

      if (

        !form.hariTanggal ||

        !form.jamMulai ||

        !form.jamSelesai ||

        !form.materi ||

        !form.topik ||

        form.pengampu == null ||

        form.lokasi == null

      ) {

        setErrorForm('Semua field wajib diisi!');

        throw new Error('Semua field wajib diisi!');

      }

      

      // Gunakan handler khusus untuk kuliah besar

      await handleTambahJadwalKuliahBesar();

      return;

    }

    

    // Handle untuk jenis baris 'agenda' (agenda khusus)

    if (form.jenisBaris === 'agenda') {

      // Validasi field wajib untuk agenda khusus

      if (

        !form.hariTanggal ||

        !form.jamMulai ||

        !form.jamSelesai ||

        !form.agenda

      ) {

        setErrorForm('Semua field wajib diisi!');

        throw new Error('Semua field wajib diisi!');

      }

      

      // Validasi ruangan hanya jika menggunakan ruangan

      if (form.useRuangan && !form.lokasi) {

        setErrorForm('Ruangan wajib dipilih jika menggunakan ruangan!');

        throw new Error('Ruangan wajib dipilih jika menggunakan ruangan!');

      }

      

      // Gunakan handler khusus untuk agenda khusus

      await handleTambahJadwalAgendaKhusus();

      return;

    }

    

    // Handle untuk jenis baris 'praktikum'

    if (form.jenisBaris === 'praktikum') {

      // Validasi field wajib untuk praktikum

      if (

        !form.hariTanggal ||

        !form.jamMulai ||

        !form.jamSelesai ||

        !form.materi ||

        !form.kelasPraktikum ||

        form.lokasi == null ||

        !form.pengampu

      ) {

        setErrorForm('Semua field wajib diisi!');

        throw new Error('Semua field wajib diisi!');

      }

      

      // Gunakan handler khusus untuk praktikum

      await handleTambahJadwalPraktikum();

      return;

    }

    

  }



  // Hapus useEffect yang tidak perlu karena data sudah dalam format yang benar



  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const [selectedDeleteIndex, setSelectedDeleteIndex] = useState<number | null>(null);

  const [selectedDeleteType, setSelectedDeleteType] = useState<'materi' | 'pbl' | 'other'>('other');

  const [showDeleteAgendaModal, setShowDeleteAgendaModal] = useState(false);

  const [selectedDeleteAgendaIndex, setSelectedDeleteAgendaIndex] = useState<number | null>(null);

  const [showDeletePraktikumModal, setShowDeletePraktikumModal] = useState(false);

  const [selectedDeletePraktikumIndex, setSelectedDeletePraktikumIndex] = useState<number | null>(null);

  const [showDeleteJurnalReadingModal, setShowDeleteJurnalReadingModal] = useState(false);

  const [selectedDeleteJurnalReadingIndex, setSelectedDeleteJurnalReadingIndex] = useState<number | null>(null);

  const [isDragOver, setIsDragOver] = useState(false);

  const [existingFileJurnal, setExistingFileJurnal] = useState<{ name: string; url: string } | null>(null);



  // Fetch all data using optimized batch endpoint

  const fetchBatchData = useCallback(async () => {

    if (!kode) return;

    setLoadingPBL(true);

    setLoadingDosenRuangan(true);

    

    try {

      setError(null); // Reset error state

      const response = await api.get(`/mata-kuliah/${kode}/batch-data`);

      const batchData = response.data;

      

      // Set mata kuliah data

      setData(batchData.mata_kuliah);

      

      // Set jadwal data

      setJadwalPBL(Array.isArray(batchData.jadwal_pbl) ? batchData.jadwal_pbl : []);

      setJadwalKuliahBesar(Array.isArray(batchData.jadwal_kuliah_besar) ? batchData.jadwal_kuliah_besar : []);

      setJadwalAgendaKhusus(Array.isArray(batchData.jadwal_agenda_khusus) ? batchData.jadwal_agenda_khusus : []);

      setJadwalPraktikum(Array.isArray(batchData.jadwal_praktikum) ? batchData.jadwal_praktikum : []);

      setJadwalJurnalReading(Array.isArray(batchData.jadwal_jurnal_reading) ? batchData.jadwal_jurnal_reading : []);

      

      // Set reference data

      setModulPBLList(Array.isArray(batchData.modul_pbl) ? batchData.modul_pbl : []);

      // Set Jurnal Reading topics from database
      const jurnalReadingTopics = Array.isArray(batchData.jurnal_reading) 
        ? batchData.jurnal_reading.map((item: any) => item.nama_topik)
        : [];
      setTopikJurnalReadingList(jurnalReadingTopics);

      setKelompokKecilList(Array.isArray(batchData.kelompok_kecil) ? batchData.kelompok_kecil : []);

      setKelompokBesarOptions(Array.isArray(batchData.kelompok_besar) ? batchData.kelompok_besar : []);

      setAllRuanganList(Array.isArray(batchData.ruangan) ? batchData.ruangan : []);

      setRuanganList(Array.isArray(batchData.ruangan) ? batchData.ruangan : []);

      const kelasPraktikumData = Array.isArray(batchData.kelas_praktikum) ? batchData.kelas_praktikum.map((k: any) => k.nama || k) : [];
      // Hanya set jika ada data, jika tidak biarkan fetchKelasPraktikum yang mengisi
      if (kelasPraktikumData.length > 0) {
      setKelasPraktikumOptions(kelasPraktikumData);
      }
      setMateriPraktikumOptions(Array.isArray(batchData.materi_praktikum) ? batchData.materi_praktikum : []);

      setJamOptions(Array.isArray(batchData.jam_options) ? batchData.jam_options : []);

      // Set dosen data
      if (batchData.dosen) {
        setAllDosenList(Array.isArray(batchData.dosen.all) ? batchData.dosen.all : []);
        setDosenList(Array.isArray(batchData.dosen.matching) ? batchData.dosen.matching : []);
      }

    } catch (err) {

      setError('Gagal mengambil data batch');

      setLoading(false);

    } finally {

      setLoadingPBL(false);

      setLoadingDosenRuangan(false);

      setLoading(false);

    }

  }, [kode]);



  // Fetch semua ruangan

  const fetchAllRuangan = useCallback(async () => {

    try {

      const response = await api.get('/ruangan');

      setRuanganList(response.data);

    } catch (err) {

      setRuanganList([]);

    }

  }, []);



  // Fetch semua ruangan saat modal dibuka

  const fetchRuanganForModal = useCallback(async () => {

    await fetchAllRuangan();

  }, [fetchAllRuangan]);



  // Fetch assigned dosen PBL setelah modulPBLList ter-set

  const fetchAssignedDosenPBL = useCallback(async () => {

    if (!kode || modulPBLList.length === 0) {

      setAssignedDosenPBL([]);

      setHasAssignedPBL(false);

      return;

    }

    

    setLoadingAssignedPBL(true);

    try {

      const pblIds = modulPBLList.map(pbl => pbl.id).filter(Boolean);

      

      if (pblIds.length > 0) {

        const assignedRes = await api.post('/pbls/assigned-dosen-batch', { pbl_ids: pblIds });

        const assignedData = assignedRes.data || {};

        

        // Gabungkan semua assigned dosen dari semua PBL modul

        const dosenMap = new Map<number, DosenType>();

        Object.values(assignedData).forEach((dosenList) => {

          if (Array.isArray(dosenList)) {

            dosenList.forEach((dosen: DosenType) => {

              // Gunakan id dosen sebagai kunci untuk menghilangkan duplikasi

              if (!dosenMap.has(dosen.id)) {

                dosenMap.set(dosen.id, dosen);

              }

            });

          }

        });

        

        const assignedDosenArray = Array.from(dosenMap.values());

        setAssignedDosenPBL(assignedDosenArray);

        setHasAssignedPBL(assignedDosenArray.length > 0);

      } else {

        setAssignedDosenPBL([]);

        setHasAssignedPBL(false);

      }

    } catch (err) {

      setAssignedDosenPBL([]);

      setHasAssignedPBL(false);

    } finally {

      setLoadingAssignedPBL(false);

    }

  }, [kode, modulPBLList]);



  useEffect(() => {

    const loadData = async () => {
      await fetchBatchData();
      // Pastikan kelas praktikum ter-load setelah batch data
      await fetchKelasPraktikum();
    };
    
    loadData();

  }, [fetchBatchData]);

  // Auto-hide imported counts and PBL success message (consolidated)
  useEffect(() => {
    const countsToReset = [
      { value: importedCount, setter: setImportedCount, resetValue: 0 },
      { value: siakadImportedCount, setter: setSiakadImportedCount, resetValue: 0 },
      { value: praktikumImportedCount, setter: setPraktikumImportedCount, resetValue: 0 },
      { value: praktikumSiakadImportedCount, setter: setPraktikumSiakadImportedCount, resetValue: 0 },
      { value: pblImportedCount, setter: setPBLImportedCount, resetValue: 0 },
      { value: pblSiakadImportedCount, setter: setPBLSiakadImportedCount, resetValue: 0 },
      { value: agendaKhususImportedCount, setter: setAgendaKhususImportedCount, resetValue: 0 },
      { value: jurnalReadingImportedCount, setter: setJurnalReadingImportedCount, resetValue: 0 },
      { value: pblSuccess, setter: setPblSuccess, resetValue: null }
    ];

    const timers = countsToReset
      .filter(item => item.value)
      .map(item => setTimeout(() => item.setter(item.resetValue as any), 5000));

    return () => timers.forEach(timer => clearTimeout(timer));
  }, [
    importedCount, 
    siakadImportedCount, 
    praktikumImportedCount, 
    praktikumSiakadImportedCount,
    pblImportedCount,
    pblSiakadImportedCount,
    agendaKhususImportedCount,
    jurnalReadingImportedCount,
    pblSuccess
  ]);



  useEffect(() => {

    fetchAssignedDosenPBL();

  }, [fetchAssignedDosenPBL]);



  // Fetch materi options saat data berubah

  useEffect(() => {

    if (data) {

      fetchMateriOptions();

      fetchMateriPraktikum();

    }

  }, [data]);



  // Listen for PBL assignment updates from PBLGenerate page

  useEffect(() => {

    const handlePBLAssignmentUpdate = () => {

      fetchAssignedDosenPBL();

    };



    window.addEventListener('pbl-assignment-updated', handlePBLAssignmentUpdate);

    return () => {

      window.removeEventListener('pbl-assignment-updated', handlePBLAssignmentUpdate);

    };

  }, [fetchAssignedDosenPBL]);



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

      

      {/* Info Box Template Support skeleton */}

      <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">

        <div className="flex items-start gap-3">

          <div className="flex-shrink-0 w-5 h-5 mt-0.5">

            <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

          </div>

          <div className="flex-1">

            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />

            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mt-1 animate-pulse" />

          </div>

        </div>

      </div>

      {/* Kuliah Besar skeleton */}

      <div className="mb-8">

        <div className="flex items-center justify-between mb-2">

          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

          <div className="flex items-center gap-3">

            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

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

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Materi</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pengampu</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Lokasi</th>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>

                </tr>

              </thead>

              <tbody>

                {Array.from({ length: 3 }).map((_, index) => (

                  <tr key={`skeleton-kb-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>

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

                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>

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



      {/* Info Box Template Support skeleton */}

      <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">

        <div className="flex items-start gap-3">

          <div className="flex-shrink-0 w-5 h-5 mt-0.5">

            <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

          </div>

          <div className="flex-1">

            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />

            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mt-1 animate-pulse" />

          </div>

        </div>

      </div>

      {/* Praktikum skeleton */}

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

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">

          <div className="max-w-full overflow-x-auto hide-scroll">

            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">

              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">

                <tr>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Hari/Tanggal</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelas</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pukul</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Waktu</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Materi</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pengampu</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Lokasi</th>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>

                </tr>

              </thead>

              <tbody>

                {Array.from({ length: 3 }).map((_, index) => (

                  <tr key={`skeleton-praktikum-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>

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

                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>

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



      {/* Agenda Khusus skeleton */}

      <div className="mb-8">

        <div className="flex items-center justify-between mb-2">

          <div className="h-6 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

          <div className="flex items-center gap-3">

            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

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

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Agenda</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Lokasi</th>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>

                </tr>

              </thead>

              <tbody>

                {Array.from({ length: 3 }).map((_, index) => (

                  <tr key={`skeleton-agenda-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>

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

                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>

                    </td>

                    <td className="px-6 py-4">

                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>

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



      {/* Info Box Template Support skeleton */}

      <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-lg">

        <div className="flex items-start gap-3">

          <div className="flex-shrink-0 w-5 h-5 mt-0.5">

            <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

          </div>

          <div className="flex-1">

            <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />

            <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-3 w-3/4 bg-gray-200 dark:bg-gray-700 rounded mt-1 animate-pulse" />

          </div>

        </div>

      </div>

      {/* PBL skeleton */}

      <div className="mb-8">

        <div className="flex items-center justify-between mb-2">

          <div className="h-6 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

          <div className="flex items-center gap-3">

            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

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

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Modul</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Tutor</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Lokasi</th>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>

                </tr>

              </thead>

              <tbody>

                {Array.from({ length: 3 }).map((_, index) => (

                  <tr key={`skeleton-pbl-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>

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

                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>

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



      {/* Jurnal Reading skeleton */}

      <div className="mb-8">

        <div className="flex items-center justify-between mb-2">

          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

          <div className="flex items-center gap-3">

            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

            <div className="h-8 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />

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

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Tutor</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Lokasi</th>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>

                </tr>

              </thead>

              <tbody>

                {Array.from({ length: 3 }).map((_, index) => (

                  <tr key={`skeleton-jurnal-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>

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

                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>

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







  // Fungsi tambah jadwal PBL

  async function handleTambahJadwalPBL(formPBL: JadwalPBLType) {

    setErrorBackend('');

    // Reset error state



    // Pastikan jumlah_sesi sesuai dengan pbl_tipe

    const updatedFormPBL = {

      ...formPBL,

      jumlah_sesi: formPBL.pbl_tipe === 'PBL 2' ? 3 : 2

    };



    try {

      await api.post(`/mata-kuliah/${kode}/jadwal-pbl`, updatedFormPBL);

      fetchBatchData();

    } catch (err: any) {

      if (err.response && err.response.data && err.response.data.message) {

        setErrorBackend(err.response.data.message);

      } else {

        setErrorBackend('Gagal menambah jadwal PBL');

      }

      throw err; // Re-throw error agar bisa ditangkap oleh caller

    }

  }



  // Fungsi edit jadwal PBL

  async function handleEditJadwalPBL(id: number, formPBL: JadwalPBLType) {

    setErrorBackend('');

          // Reset error state



    

    // Tambahkan jumlah_sesi berdasarkan pbl_tipe

    const updatedFormPBL = {

      ...formPBL,

      jumlah_sesi: formPBL.pbl_tipe === 'PBL 2' ? 3 : 2

    };

    

    try {

      await api.put(`/mata-kuliah/${kode}/jadwal-pbl/${id}`, updatedFormPBL);

      fetchBatchData();

    } catch (err: any) {

      if (err.response && err.response.data && err.response.data.message) {

        setErrorBackend(err.response.data.message);

      } else {

        setErrorBackend('Gagal mengedit jadwal PBL');

      }

      throw err;

    }

  }



  // Fungsi hapus jadwal PBL

  async function handleDeleteJadwal(idx: number) {

    const jadwal = jadwalPBL[idx];

    if (!jadwal || !jadwal.id) {

      return;

    }

    setIsSaving(true);

    try {

      await api.delete(`/mata-kuliah/${kode}/jadwal-pbl/${jadwal.id}`);

      // Setelah sukses hapus di backend, refresh data dari backend

      await fetchBatchData();

    } catch (err) {

    }

    setIsSaving(false);

  }



  // Ambil unique nama kelompok dari kelompokKecilList

  const uniqueKelompok = Array.from(

    new Set(kelompokKecilList.map(k => k.nama_kelompok))

  ).map(nama => ({

    value: nama,

    label: `Kelompok ${nama}`,

  }));



  // Validasi bentrok frontend untuk kuliah besar





  // Handler tambah jadwal kuliah besar

  async function handleTambahJadwalKuliahBesar() {

    setErrorForm('');

    setErrorBackend('');

    // Validasi field wajib

    if (!form.hariTanggal || !form.jamMulai || !form.jamSelesai || !form.materi || !form.pengampu || !form.lokasi) {

      setErrorForm('Semua field wajib diisi!');

      return;

    }

    // Validasi bentrok frontend

    const payload = {

      tanggal: form.hariTanggal,

      jam_mulai: form.jamMulai,

      jam_selesai: form.jamSelesai,

        materi: form.materi,

        topik: form.topik,

        dosen_id: Number(form.pengampu),

      ruangan_id: Number(form.lokasi),

        kelompok_besar_id: form.kelompokBesar,

      jumlah_sesi: form.jumlahKali,

      };



    try {

      if (editIndex !== null && jadwalKuliahBesar[editIndex]?.id) {

        // Edit mode

        await api.put(`/kuliah-besar/jadwal/${data!.kode}/${jadwalKuliahBesar[editIndex].id}`, payload);

      } else {

        // Tambah mode

        await api.post(`/kuliah-besar/jadwal/${data!.kode}`, payload);

      }

      await fetchBatchData();

      setShowModal(false);

      setForm({ hariTanggal: '', jamMulai: '', jumlahKali: 2, jamSelesai: '', pengampu: null, materi: '', topik: '', lokasi: null, jenisBaris: 'materi', agenda: '', kelasPraktikum: '', pblTipe: '', modul: null, kelompok: '', kelompokBesar: null, useRuangan: true, fileJurnal: null });

      setExistingFileJurnal(null);

      setEditIndex(null);

    } catch (err: any) {

      setErrorBackend(err?.response?.data?.message || 'Gagal menyimpan jadwal kuliah besar');

      throw err;

    }

  }



  // Handler edit jadwal kuliah besar

  function handleEditJadwalKuliahBesar(idx: number) {

    const row = jadwalKuliahBesar[idx];

    setForm({

      hariTanggal: row.tanggal,

      jamMulai: row.jam_mulai,

      jumlahKali: row.jumlah_sesi || 2,

      jamSelesai: row.jam_selesai,

        pengampu: row.dosen_id,

      materi: row.materi,

      topik: row.topik || '',

      lokasi: row.ruangan_id,

      jenisBaris: 'materi',

      agenda: '',

      kelasPraktikum: '',

      pblTipe: '',

      modul: null,

      kelompok: '',

        kelompokBesar: row.kelompok_besar_id || null,

      useRuangan: true,

      fileJurnal: null,

    });

    setEditIndex(idx);

    setShowModal(true);

    resetErrorForm();

  }



  // Handler hapus jadwal kuliah besar

  async function handleDeleteJadwalKuliahBesar(idx: number) {

    const row = jadwalKuliahBesar[idx];

    if (!row?.id) return;

    setIsSaving(true);

    try {

      await api.delete(`/kuliah-besar/jadwal/${data!.kode}/${row.id}`);

      await fetchBatchData();

    } catch {}

    setIsSaving(false);

  }



  // Handler tambah jadwal agenda khusus

  async function handleTambahJadwalAgendaKhusus() {

    setErrorForm('');

    setErrorBackend('');

    // Validasi field wajib

    if (!form.hariTanggal || !form.jamMulai || !form.jamSelesai || !form.agenda) {

      setErrorForm('Semua field wajib diisi!');

      throw new Error('Semua field wajib diisi!');

    }

    

    // Validasi ruangan jika menggunakan ruangan

    if (form.useRuangan && !form.lokasi) {

      setErrorForm('Ruangan wajib dipilih jika menggunakan ruangan!');

      throw new Error('Ruangan wajib dipilih jika menggunakan ruangan!');

    }

    

    // Validasi bentrok frontend

    const payload = {

      tanggal: form.hariTanggal,

      jam_mulai: form.jamMulai,

      jam_selesai: form.jamSelesai,

      agenda: form.agenda,

      ruangan_id: form.useRuangan ? Number(form.lokasi) : null,

      kelompok_besar_id: form.kelompokBesar,

      use_ruangan: form.useRuangan,

      jumlah_sesi: form.jumlahKali,

    };



    try {

      if (editIndex !== null && jadwalAgendaKhusus[editIndex]?.id) {

        // Edit mode

        await api.put(`/agenda-khusus/jadwal/${data!.kode}/${jadwalAgendaKhusus[editIndex].id}`, payload);

      } else {

        // Tambah mode

        await api.post(`/agenda-khusus/jadwal/${data!.kode}`, payload);

      }

      await fetchBatchData();

      setShowModal(false);

      setForm({ hariTanggal: '', jamMulai: '', jumlahKali: 2, jamSelesai: '', pengampu: null, materi: '', topik: '', lokasi: null, jenisBaris: 'agenda', agenda: '', kelasPraktikum: '', pblTipe: '', modul: null, kelompok: '', kelompokBesar: null, useRuangan: true, fileJurnal: null });

      setExistingFileJurnal(null);

      setEditIndex(null);

    } catch (err: any) {

      setErrorBackend(err?.response?.data?.message || 'Gagal menyimpan jadwal agenda khusus');

      throw err;

    }

  }



  // Handler edit jadwal agenda khusus

  function handleEditJadwalAgendaKhusus(idx: number) {

    const row = jadwalAgendaKhusus[idx];

    setForm({

      hariTanggal: row.tanggal,

      jamMulai: row.jam_mulai,

      jumlahKali: row.jumlah_sesi || 2,

      jamSelesai: row.jam_selesai,

      pengampu: null,

      materi: '',

      topik: '',

      lokasi: row.use_ruangan ? row.ruangan_id : null,

      jenisBaris: 'agenda',

      agenda: row.agenda,

      kelasPraktikum: '',

      pblTipe: '',

      modul: null,

      kelompok: '',

      kelompokBesar: row.kelompok_besar_id || null,

      useRuangan: row.use_ruangan !== undefined ? row.use_ruangan : true,

      fileJurnal: null,

    });

    setEditIndex(idx);

    setShowModal(true);

    resetErrorForm();

  }



  // Handler hapus jadwal agenda khusus

  async function handleDeleteJadwalAgendaKhusus(idx: number) {

    setSelectedDeleteAgendaIndex(idx);

    setShowDeleteAgendaModal(true);

  }



  // Handler konfirmasi hapus agenda khusus

  async function handleConfirmDeleteAgendaKhusus() {

    if (selectedDeleteAgendaIndex === null) return;

    

    const row = jadwalAgendaKhusus[selectedDeleteAgendaIndex];

    if (!row?.id) return;

    

    setIsSaving(true);

    try {

      await api.delete(`/agenda-khusus/jadwal/${data!.kode}/${row.id}`);

      await fetchBatchData();

    } catch {}

    setIsSaving(false);

    setShowDeleteAgendaModal(false);

    setSelectedDeleteAgendaIndex(null);

  }







  // Handler tambah jadwal praktikum

  async function handleTambahJadwalPraktikum() {

    setErrorForm('');

    setErrorBackend('');

    // Validasi field wajib

    if (!form.hariTanggal || !form.jamMulai || !form.jamSelesai || !form.materi || !form.kelasPraktikum || !form.lokasi || !form.pengampu || (Array.isArray(form.pengampu) && form.pengampu.length === 0)) {

      setErrorForm('Semua field wajib diisi!');

      throw new Error('Semua field wajib diisi!');

    }

    // Validasi bentrok frontend

    const payload = {

      tanggal: form.hariTanggal,

      jam_mulai: form.jamMulai,

      jam_selesai: form.jamSelesai,

      materi: form.materi,

      topik: form.topik,

      kelas_praktikum: form.kelasPraktikum,

      ruangan_id: Number(form.lokasi),

      jumlah_sesi: form.jumlahKali,

      dosen_ids: Array.isArray(form.pengampu) ? form.pengampu : [form.pengampu],

    };



    try {

      if (editIndex !== null && jadwalPraktikum[editIndex]?.id) {

        // Edit mode

        await api.put(`/praktikum/jadwal/${data!.kode}/${jadwalPraktikum[editIndex].id}`, payload);

      } else {

        // Tambah mode

        await api.post(`/praktikum/jadwal/${data!.kode}`, payload);

      }

      await fetchBatchData();

      setShowModal(false);

      setForm({ hariTanggal: '', jamMulai: '', jumlahKali: 2, jamSelesai: '', pengampu: [], materi: '', topik: '', lokasi: null, jenisBaris: 'praktikum', agenda: '', kelasPraktikum: '', pblTipe: '', modul: null, kelompok: '', kelompokBesar: null, useRuangan: true, fileJurnal: null });

      setExistingFileJurnal(null);

      setEditIndex(null);

    } catch (err: any) {

      setErrorBackend(err?.response?.data?.message || 'Gagal menyimpan jadwal praktikum');

      throw err;

    }

  }



  // Handler edit jadwal praktikum

  function handleEditJadwalPraktikum(idx: number) {

    const row = jadwalPraktikum[idx];

    setForm({

      hariTanggal: row.tanggal,

      jamMulai: row.jam_mulai,

      jumlahKali: Number(row.jumlah_sesi || 2),

      jamSelesai: row.jam_selesai,

      pengampu: row.dosen?.map((d: any) => d.id) || [],

      materi: row.materi,

      topik: row.topik || '',

      lokasi: row.ruangan_id,

      jenisBaris: 'praktikum',

      agenda: '',

      kelasPraktikum: row.kelas_praktikum,

      pblTipe: '',

      modul: null,

      kelompok: '',

      kelompokBesar: null,

      useRuangan: true,

      fileJurnal: null,

    });

    setEditIndex(idx);

    setShowModal(true);

    resetErrorForm();

  }



  // Handler hapus jadwal praktikum

  async function handleDeleteJadwalPraktikum(idx: number) {

    setSelectedDeletePraktikumIndex(idx);

    setShowDeletePraktikumModal(true);

  }



  // Handler konfirmasi hapus praktikum

  async function handleConfirmDeletePraktikum() {

    if (selectedDeletePraktikumIndex === null) return;

    

    const row = jadwalPraktikum[selectedDeletePraktikumIndex];

    if (!row?.id) return;

    

    setIsSaving(true);

    try {

      await api.delete(`/praktikum/jadwal/${data!.kode}/${row.id}`);

      await fetchBatchData();

    } catch {}

    setIsSaving(false);

    setShowDeletePraktikumModal(false);

    setSelectedDeletePraktikumIndex(null);

  }







  // Handler tambah jadwal jurnal reading

  async function handleTambahJadwalJurnalReading() {

    setErrorForm('');

    setErrorBackend('');

    // Validasi field wajib

    if (!form.hariTanggal || !form.jamMulai || !form.jamSelesai || !form.topik || !form.kelompok || !form.pengampu || !form.lokasi) {

      setErrorForm('Semua field wajib diisi!');

      throw new Error('Semua field wajib diisi!');

    }

    

    // Validasi kelompok_kecil_id

    const kelompokKecilId = kelompokKecilList.find(k => k.nama_kelompok === form.kelompok)?.id;

    if (!kelompokKecilId) {

      setErrorForm('Kelompok tidak ditemukan!');

      throw new Error('Kelompok tidak ditemukan!');

    }

    

    // Validasi bentrok frontend

    const payload = {

      tanggal: form.hariTanggal,

      jam_mulai: form.jamMulai,

      jam_selesai: form.jamSelesai,

      jumlah_sesi: form.jumlahKali,

      kelompok_kecil_id: kelompokKecilId,

      dosen_id: Number(form.pengampu),

      ruangan_id: Number(form.lokasi),

      topik: form.topik,

    };

    



    

    try {

      const formData = new FormData();

      formData.append('tanggal', payload.tanggal);

      formData.append('jam_mulai', payload.jam_mulai);

      formData.append('jam_selesai', payload.jam_selesai);

      formData.append('jumlah_sesi', payload.jumlah_sesi.toString());

      formData.append('kelompok_kecil_id', payload.kelompok_kecil_id.toString());

      formData.append('dosen_id', payload.dosen_id.toString());

      formData.append('ruangan_id', payload.ruangan_id.toString());

      formData.append('topik', payload.topik);

      

      if (form.fileJurnal) {

        formData.append('file_jurnal', form.fileJurnal);

      }

      

      if (editIndex !== null && jadwalJurnalReading[editIndex]?.id) {

        // Edit mode - gunakan JSON untuk data biasa, FormData hanya jika ada file baru

        if (form.fileJurnal) {

          // Pastikan FormData terkirim dengan benar

          const editFormData = new FormData();

          editFormData.append('_method', 'PUT'); // Tambahkan _method untuk Laravel

          editFormData.append('tanggal', payload.tanggal);

          editFormData.append('jam_mulai', payload.jam_mulai);

          editFormData.append('jam_selesai', payload.jam_selesai);

          editFormData.append('jumlah_sesi', payload.jumlah_sesi.toString());

          editFormData.append('kelompok_kecil_id', payload.kelompok_kecil_id.toString());

          editFormData.append('dosen_id', payload.dosen_id.toString());

          editFormData.append('ruangan_id', payload.ruangan_id.toString());

          editFormData.append('topik', payload.topik);

          editFormData.append('file_jurnal', form.fileJurnal);

          

          await api.post(`/jurnal-reading/jadwal/${data!.kode}/${jadwalJurnalReading[editIndex].id}`, editFormData, {

            headers: {

              'Content-Type': 'multipart/form-data',

            },

          });

        } else {

          // Tidak ada file baru, gunakan JSON

          const jsonPayload = {

            tanggal: payload.tanggal,

            jam_mulai: payload.jam_mulai,

            jam_selesai: payload.jam_selesai,

            jumlah_sesi: payload.jumlah_sesi,

            kelompok_kecil_id: payload.kelompok_kecil_id,

            dosen_id: payload.dosen_id,

            ruangan_id: payload.ruangan_id,

            topik: payload.topik,

          };

          await api.put(`/jurnal-reading/jadwal/${data!.kode}/${jadwalJurnalReading[editIndex].id}`, jsonPayload);

        }

      } else {

        // Tambah mode - selalu gunakan FormData

        await api.post(`/jurnal-reading/jadwal/${data!.kode}`, formData, {

          headers: {

            'Content-Type': 'multipart/form-data',

          },

        });

      }

      

      await fetchBatchData();

      setShowModal(false);

      setForm({ hariTanggal: '', jamMulai: '', jumlahKali: 2, jamSelesai: '', pengampu: null, materi: '', topik: '', lokasi: null, jenisBaris: 'jurnal', agenda: '', kelasPraktikum: '', pblTipe: '', modul: null, kelompok: '', kelompokBesar: null, useRuangan: true, fileJurnal: null });

      setExistingFileJurnal(null);

      setEditIndex(null);

    } catch (err: any) {

      setErrorBackend(err?.response?.data?.message || 'Gagal menyimpan jadwal jurnal reading');

      throw err;

    }

  }



  // Handler edit jadwal jurnal reading

  function handleEditJadwalJurnalReading(idx: number) {

    const row = jadwalJurnalReading[idx];

    

    setForm({

      hariTanggal: row.tanggal || '',

      jamMulai: row.jam_mulai || '',

      jumlahKali: Number(row.jumlah_sesi || 1),

      jamSelesai: row.jam_selesai || '',

      pengampu: row.dosen_id || null,

      materi: '',

      topik: row.topik || '',

      lokasi: row.ruangan_id || null,

      jenisBaris: 'jurnal',

      agenda: '',

      kelasPraktikum: '',

      pblTipe: '',

      modul: null,

      kelompok: row.kelompok_kecil?.nama_kelompok || '',

      kelompokBesar: null,

      useRuangan: true,

      fileJurnal: null,

    });

    

    // Set informasi file yang sudah ada di backend

    if (row.file_jurnal) {

      setExistingFileJurnal({

        name: row.file_jurnal.split('/').pop() || 'File Jurnal',

        url: row.file_jurnal

      });

    } else {

      setExistingFileJurnal(null);

    }

    

    setEditIndex(idx);

    setShowModal(true);

    resetErrorForm();

  }



  // Handler hapus jadwal jurnal reading

  async function handleDeleteJadwalJurnalReading(idx: number) {

    setSelectedDeleteJurnalReadingIndex(idx);

    setShowDeleteJurnalReadingModal(true);

  }



  // Handler konfirmasi hapus jurnal reading

  async function handleConfirmDeleteJurnalReading() {

    if (selectedDeleteJurnalReadingIndex === null) return;

    

    const row = jadwalJurnalReading[selectedDeleteJurnalReadingIndex];

    if (!row?.id) return;

    

    setIsSaving(true);

    try {

      await api.delete(`/jurnal-reading/jadwal/${data!.kode}/${row.id}`);

      await fetchBatchData();

    } catch (err: any) {

      setErrorBackend('Gagal menghapus jadwal jurnal reading');

    }

    setIsSaving(false);

    setShowDeleteJurnalReadingModal(false);

    setSelectedDeleteJurnalReadingIndex(null);

  }

  // Fungsi untuk handle bulk delete
  const handleBulkDelete = (type: 'kuliah-besar' | 'praktikum' | 'agenda-khusus' | 'pbl' | 'jurnal-reading') => {
    setBulkDeleteType(type);
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    if (!kode) return;
    
    setIsBulkDeleting(true);
    
    try {
      let selectedItems: number[] = [];
      let endpoint = '';
      let successMessage = '';
      
      switch (bulkDeleteType) {
        case 'kuliah-besar':
          selectedItems = selectedKuliahBesarItems;
          endpoint = `/kuliah-besar/jadwal/${kode}`;
          successMessage = `${selectedItems.length} jadwal kuliah besar berhasil dihapus.`;
          break;
        case 'praktikum':
          selectedItems = selectedPraktikumItems;
          endpoint = `/praktikum/jadwal/${kode}`;
          successMessage = `${selectedItems.length} jadwal praktikum berhasil dihapus.`;
          break;
        case 'agenda-khusus':
          selectedItems = selectedAgendaKhususItems;
          endpoint = `/agenda-khusus/jadwal/${kode}`;
          successMessage = `${selectedItems.length} jadwal agenda khusus berhasil dihapus.`;
          break;
        case 'pbl':
          selectedItems = selectedPBLItems;
          endpoint = `/mata-kuliah/${kode}/jadwal-pbl`;
          successMessage = `${selectedItems.length} jadwal PBL berhasil dihapus.`;
          break;
        case 'jurnal-reading':
          selectedItems = selectedJurnalReadingItems;
          endpoint = `/jurnal-reading/jadwal/${kode}`;
          successMessage = `${selectedItems.length} jadwal jurnal reading berhasil dihapus.`;
          break;
      }
      
      // Delete all selected items
      await Promise.all(selectedItems.map(id => api.delete(`${endpoint}/${id}`)));
      
      // Show success message per section
      switch (bulkDeleteType) {
        case 'kuliah-besar':
          setKuliahBesarSuccess(successMessage);
          break;
        case 'praktikum':
          setPraktikumSuccess(successMessage);
          break;
        case 'agenda-khusus':
          setAgendaKhususSuccess(successMessage);
          break;
        case 'pbl':
          setPblSuccess(successMessage);
          break;
        case 'jurnal-reading':
          setJurnalReadingSuccess(successMessage);
          break;
      }
      
      // Clear selected items
      switch (bulkDeleteType) {
        case 'kuliah-besar':
          setSelectedKuliahBesarItems([]);
          break;
        case 'praktikum':
          setSelectedPraktikumItems([]);
          break;
        case 'agenda-khusus':
          setSelectedAgendaKhususItems([]);
          break;
        case 'pbl':
          setSelectedPBLItems([]);
          break;
        case 'jurnal-reading':
          setSelectedJurnalReadingItems([]);
          break;
      }
      
      // Close modal after successful delete
      setShowBulkDeleteModal(false);
      
      // Refresh data
      await fetchBatchData();
      
    } catch (err: any) {
      setErrorBackend('Gagal menghapus jadwal terpilih');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  // Helper functions untuk checkbox
  const handleSelectAll = (type: 'kuliah-besar' | 'praktikum' | 'agenda-khusus' | 'pbl' | 'jurnal-reading', allItems: any[]) => {
    const allIds = allItems.map(item => item.id).filter(id => id !== undefined);
    
    switch (type) {
      case 'kuliah-besar':
        if (selectedKuliahBesarItems.length === allIds.length) {
          setSelectedKuliahBesarItems([]);
        } else {
          setSelectedKuliahBesarItems(allIds);
        }
        break;
      case 'praktikum':
        if (selectedPraktikumItems.length === allIds.length) {
          setSelectedPraktikumItems([]);
        } else {
          setSelectedPraktikumItems(allIds);
        }
        break;
      case 'agenda-khusus':
        if (selectedAgendaKhususItems.length === allIds.length) {
          setSelectedAgendaKhususItems([]);
        } else {
          setSelectedAgendaKhususItems(allIds);
        }
        break;
      case 'pbl':
        if (selectedPBLItems.length === allIds.length) {
          setSelectedPBLItems([]);
        } else {
          setSelectedPBLItems(allIds);
        }
        break;
      case 'jurnal-reading':
        if (selectedJurnalReadingItems.length === allIds.length) {
          setSelectedJurnalReadingItems([]);
        } else {
          setSelectedJurnalReadingItems(allIds);
        }
        break;
    }
  };

  const handleSelectItem = (type: 'kuliah-besar' | 'praktikum' | 'agenda-khusus' | 'pbl' | 'jurnal-reading', itemId: number) => {
    switch (type) {
      case 'kuliah-besar':
        if (selectedKuliahBesarItems.includes(itemId)) {
          setSelectedKuliahBesarItems(selectedKuliahBesarItems.filter(id => id !== itemId));
        } else {
          setSelectedKuliahBesarItems([...selectedKuliahBesarItems, itemId]);
        }
        break;
      case 'praktikum':
        if (selectedPraktikumItems.includes(itemId)) {
          setSelectedPraktikumItems(selectedPraktikumItems.filter(id => id !== itemId));
        } else {
          setSelectedPraktikumItems([...selectedPraktikumItems, itemId]);
        }
        break;
      case 'agenda-khusus':
        if (selectedAgendaKhususItems.includes(itemId)) {
          setSelectedAgendaKhususItems(selectedAgendaKhususItems.filter(id => id !== itemId));
        } else {
          setSelectedAgendaKhususItems([...selectedAgendaKhususItems, itemId]);
        }
        break;
      case 'pbl':
        if (selectedPBLItems.includes(itemId)) {
          setSelectedPBLItems(selectedPBLItems.filter(id => id !== itemId));
        } else {
          setSelectedPBLItems([...selectedPBLItems, itemId]);
        }
        break;
      case 'jurnal-reading':
        if (selectedJurnalReadingItems.includes(itemId)) {
          setSelectedJurnalReadingItems(selectedJurnalReadingItems.filter(id => id !== itemId));
        } else {
          setSelectedJurnalReadingItems([...selectedJurnalReadingItems, itemId]);
        }
        break;
    }
  };

  // Fungsi untuk export Excel Kuliah Besar
  const exportKuliahBesarExcel = async () => {
    try {
      if (!data || jadwalKuliahBesar.length === 0) return;

      const wb = XLSX.utils.book_new();

      const kuliahBesarData = jadwalKuliahBesar.map((row, index) => {
        const dosen = allDosenList.find(d => d.id === row.dosen_id);
        const ruangan = allRuanganList.find(r => r.id === row.ruangan_id);

        return {
          'Tanggal': row.tanggal ? new Date(row.tanggal).toISOString().split('T')[0] : '',
          'Jam Mulai': row.jam_mulai,
          'Materi': row.materi || '',
          'Topik': row.topik || '',
          'Dosen': dosen?.name || '',
          'Ruangan': ruangan?.nama || '',
          'Kelompok Besar': row.kelompok_besar_id || '',
          'Sesi': row.jumlah_sesi
        };
      });

      const kuliahBesarWs = XLSX.utils.json_to_sheet(kuliahBesarData, {
        header: ['Tanggal', 'Jam Mulai', 'Materi', 'Topik', 'Dosen', 'Ruangan', 'Kelompok Besar', 'Sesi']
      });
      
      const kuliahBesarColWidths = [
        { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 25 }, { wch: 25 }, { wch: 20 }, { wch: 20 }, { wch: 6 }
      ];
      kuliahBesarWs['!cols'] = kuliahBesarColWidths;
      
      XLSX.utils.book_append_sheet(wb, kuliahBesarWs, 'Data Kuliah Besar');

      // Sheet Info Mata Kuliah
      const infoData = [
        ['INFORMASI MATA KULIAH'],
        [''],
        ['Kode Mata Kuliah', data?.kode || ''],
        ['Nama Mata Kuliah', data?.nama || ''],
        ['Semester', data?.semester || ''],
        ['Periode', data?.periode || ''],
        ['Kurikulum', data?.kurikulum || ''],
        ['Jenis', data?.jenis || ''],
        ['Blok', data?.blok || ''],
        ['Tanggal Mulai', data?.tanggal_mulai ? new Date(data.tanggal_mulai).toISOString().split('T')[0] : ''],
        ['Tanggal Akhir', data?.tanggal_akhir ? new Date(data.tanggal_akhir).toISOString().split('T')[0] : ''],
        ['Durasi Minggu', data?.durasi_minggu || ''],
        [''],
        ['TOTAL JADWAL KULIAH BESAR', jadwalKuliahBesar.length],
        [''],
        ['CATATAN:'],
        ['• File ini berisi data jadwal kuliah besar yang dapat di-import kembali ke aplikasi'],
        ['• Format tanggal: YYYY-MM-DD'],
        ['• Format jam: HH.MM atau HH:MM'],
        ['• Sesi: 1-6 (1 sesi = 50 menit)'],
        ['• Pastikan data dosen, ruangan, materi, dan kelompok besar valid sebelum import']
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: 30 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Info Mata Kuliah');

      const fileName = `Export_Kuliah_Besar_${data?.kode || 'MataKuliah'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Gagal mengekspor data jadwal kuliah besar');
    }
  };

  // Fungsi untuk export Excel Praktikum
  const exportPraktikumExcel = async () => {
    try {
      if (!data || jadwalPraktikum.length === 0) return;

      const wb = XLSX.utils.book_new();

      const praktikumData = jadwalPraktikum.map((row, index) => {
        // Praktikum bisa memiliki multiple dosen (array)
        const dosenNames = Array.isArray(row.dosen) 
          ? row.dosen.map((d: any) => d.name).join(', ')
          : '';
        const ruangan = allRuanganList.find(r => r.id === row.ruangan_id);

        return {
          'Tanggal': row.tanggal ? new Date(row.tanggal).toISOString().split('T')[0] : '',
          'Jam Mulai': row.jam_mulai,
          'Materi': row.materi || '',
          'Topik': row.topik || '',
          'Kelas Praktikum': row.kelas_praktikum || '',
          'Dosen': dosenNames,
          'Ruangan': ruangan?.nama || '',
          'Sesi': row.jumlah_sesi
        };
      });

      const praktikumWs = XLSX.utils.json_to_sheet(praktikumData, {
        header: ['Tanggal', 'Jam Mulai', 'Materi', 'Topik', 'Kelas Praktikum', 'Dosen', 'Ruangan', 'Sesi']
      });
      
      const praktikumColWidths = [
        { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 6 }
      ];
      praktikumWs['!cols'] = praktikumColWidths;
      
      XLSX.utils.book_append_sheet(wb, praktikumWs, 'Data Praktikum');

      // Sheet Info Mata Kuliah
      const infoData = [
        ['INFORMASI MATA KULIAH'],
        [''],
        ['Kode Mata Kuliah', data?.kode || ''],
        ['Nama Mata Kuliah', data?.nama || ''],
        ['Semester', data?.semester || ''],
        ['Periode', data?.periode || ''],
        ['Kurikulum', data?.kurikulum || ''],
        ['Jenis', data?.jenis || ''],
        ['Blok', data?.blok || ''],
        ['Tanggal Mulai', data?.tanggal_mulai ? new Date(data.tanggal_mulai).toISOString().split('T')[0] : ''],
        ['Tanggal Akhir', data?.tanggal_akhir ? new Date(data.tanggal_akhir).toISOString().split('T')[0] : ''],
        ['Durasi Minggu', data?.durasi_minggu || ''],
        [''],
        ['TOTAL JADWAL PRAKTIKUM', jadwalPraktikum.length],
        [''],
        ['CATATAN:'],
        ['• File ini berisi data jadwal praktikum yang dapat di-import kembali ke aplikasi'],
        ['• Format tanggal: YYYY-MM-DD'],
        ['• Format jam: HH.MM atau HH:MM'],
        ['• Sesi: 1-6 (1 sesi = 50 menit)'],
        ['• Pastikan data dosen, ruangan, materi, dan kelas praktikum valid sebelum import']
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: 30 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Info Mata Kuliah');

      const fileName = `Export_Praktikum_${data?.kode || 'MataKuliah'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Gagal mengekspor data jadwal praktikum');
    }
  };

  // Fungsi untuk export Excel Agenda Khusus
  const exportAgendaKhususExcel = async () => {
    try {
      if (!data || jadwalAgendaKhusus.length === 0) return;

      const wb = XLSX.utils.book_new();

      const agendaKhususData = jadwalAgendaKhusus.map((row, index) => {
        const ruangan = allRuanganList.find(r => r.id === row.ruangan_id);

        return {
          'Tanggal': row.tanggal ? new Date(row.tanggal).toISOString().split('T')[0] : '',
          'Jam Mulai': row.jam_mulai,
          'Agenda': row.agenda || '',
          'Ruangan': row.use_ruangan ? (ruangan?.nama || '') : '',
          'Kelompok Besar': row.kelompok_besar_id || '',
          'Sesi': row.jumlah_sesi
        };
      });

      const agendaKhususWs = XLSX.utils.json_to_sheet(agendaKhususData, {
        header: ['Tanggal', 'Jam Mulai', 'Agenda', 'Ruangan', 'Kelompok Besar', 'Sesi']
      });
      
      const agendaKhususColWidths = [
        { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 20 }, { wch: 15 }, { wch: 6 }
      ];
      agendaKhususWs['!cols'] = agendaKhususColWidths;
      
      XLSX.utils.book_append_sheet(wb, agendaKhususWs, 'Data Agenda Khusus');

      // Sheet Info Mata Kuliah
      const infoData = [
        ['INFORMASI MATA KULIAH'],
        [''],
        ['Kode Mata Kuliah', data?.kode || ''],
        ['Nama Mata Kuliah', data?.nama || ''],
        ['Semester', data?.semester || ''],
        ['Periode', data?.periode || ''],
        ['Kurikulum', data?.kurikulum || ''],
        ['Jenis', data?.jenis || ''],
        ['Blok', data?.blok || ''],
        ['Tanggal Mulai', data?.tanggal_mulai ? new Date(data.tanggal_mulai).toISOString().split('T')[0] : ''],
        ['Tanggal Akhir', data?.tanggal_akhir ? new Date(data.tanggal_akhir).toISOString().split('T')[0] : ''],
        ['Durasi Minggu', data?.durasi_minggu || ''],
        [''],
        ['TOTAL JADWAL AGENDA KHUSUS', jadwalAgendaKhusus.length],
        [''],
        ['CATATAN:'],
        ['• File ini berisi data jadwal agenda khusus yang dapat di-import kembali ke aplikasi'],
        ['• Format tanggal: YYYY-MM-DD'],
        ['• Format jam: HH.MM atau HH:MM'],
        ['• Sesi: 1-6 (1 sesi = 50 menit)'],
        ['• Pastikan data ruangan dan kelompok besar valid sebelum import']
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: 30 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Info Mata Kuliah');

      const fileName = `Export_Agenda_Khusus_${data?.kode || 'MataKuliah'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Gagal mengekspor data jadwal agenda khusus');
    }
  };

  // Fungsi untuk export Excel PBL
  const exportPBLExcel = async () => {
    try {
      if (!data || jadwalPBL.length === 0) return;

      const wb = XLSX.utils.book_new();

      const pblData = jadwalPBL.map((row, index) => {
        const dosen = allDosenList.find(d => d.id === row.dosen_id);
        const ruangan = allRuanganList.find(r => r.id === row.ruangan_id);
        const modul = modulPBLList.find(m => m.id === row.modul_pbl_id);
        const kelompok = kelompokKecilList.find(k => k.id === row.kelompok_kecil_id);

        return {
          'Tanggal': row.tanggal ? new Date(row.tanggal).toISOString().split('T')[0] : '',
          'Jam Mulai': row.jam_mulai,
          'Modul PBL': modul?.nama_modul || '',
          'Kelompok Kecil': kelompok?.nama_kelompok || '',
          'Dosen': dosen?.name || '',
          'Ruangan': ruangan?.nama || '',
          'PBL Tipe': row.pbl_tipe || ''
        };
      });

      const pblWs = XLSX.utils.json_to_sheet(pblData, {
        header: ['Tanggal', 'Jam Mulai', 'Modul PBL', 'Kelompok Kecil', 'Dosen', 'Ruangan', 'PBL Tipe']
      });
      
      const pblColWidths = [
        { wch: 12 }, { wch: 10 }, { wch: 30 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 10 }
      ];
      pblWs['!cols'] = pblColWidths;
      
      XLSX.utils.book_append_sheet(wb, pblWs, 'Data PBL');

      // Sheet Info Mata Kuliah
      const infoData = [
        ['INFORMASI MATA KULIAH'],
        [''],
        ['Kode Mata Kuliah', data?.kode || ''],
        ['Nama Mata Kuliah', data?.nama || ''],
        ['Semester', data?.semester || ''],
        ['Periode', data?.periode || ''],
        ['Kurikulum', data?.kurikulum || ''],
        ['Jenis', data?.jenis || ''],
        ['Blok', data?.blok || ''],
        ['Tanggal Mulai', data?.tanggal_mulai ? new Date(data.tanggal_mulai).toISOString().split('T')[0] : ''],
        ['Tanggal Akhir', data?.tanggal_akhir ? new Date(data.tanggal_akhir).toISOString().split('T')[0] : ''],
        ['Durasi Minggu', data?.durasi_minggu || ''],
        [''],
        ['TOTAL JADWAL PBL', jadwalPBL.length],
        [''],
        ['CATATAN:'],
        ['• File ini berisi data jadwal PBL yang dapat di-import kembali ke aplikasi'],
        ['• Format tanggal: YYYY-MM-DD'],
        ['• Format jam: HH.MM atau HH:MM'],
        ['• Pastikan data dosen, ruangan, modul PBL, dan kelompok kecil valid sebelum import']
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: 30 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Info Mata Kuliah');

      const fileName = `Export_PBL_${data?.kode || 'MataKuliah'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Gagal mengekspor data jadwal PBL');
    }
  };

  // Fungsi untuk export Excel Jurnal Reading
  const exportJurnalReadingExcel = async () => {
    try {
      if (!data || jadwalJurnalReading.length === 0) return;

      const wb = XLSX.utils.book_new();

      const jurnalReadingData = jadwalJurnalReading.map((row, index) => {
        const dosen = allDosenList.find(d => d.id === row.dosen_id);
        const ruangan = allRuanganList.find(r => r.id === row.ruangan_id);
        const kelompok = kelompokKecilList.find(k => k.id === row.kelompok_kecil_id);

        return {
          'Tanggal': row.tanggal ? new Date(row.tanggal).toISOString().split('T')[0] : '',
          'Jam Mulai': row.jam_mulai,
          'Sesi': row.jumlah_sesi,
          'Dosen': dosen?.name || '',
          'Ruangan': ruangan?.nama || '',
          'Kelompok Kecil': kelompok?.nama_kelompok || '',
          'Topik': row.topik || ''
        };
      });

      const jurnalReadingWs = XLSX.utils.json_to_sheet(jurnalReadingData, {
        header: ['Tanggal', 'Jam Mulai', 'Sesi', 'Dosen', 'Ruangan', 'Kelompok Kecil', 'Topik']
      });
      
      const jurnalReadingColWidths = [
        { wch: 12 }, { wch: 10 }, { wch: 6 }, { wch: 25 }, { wch: 20 }, { wch: 15 }, { wch: 30 }
      ];
      jurnalReadingWs['!cols'] = jurnalReadingColWidths;
      
      XLSX.utils.book_append_sheet(wb, jurnalReadingWs, 'Data Jurnal Reading');

      // Sheet Info Mata Kuliah
      const infoData = [
        ['INFORMASI MATA KULIAH'],
        [''],
        ['Kode Mata Kuliah', data?.kode || ''],
        ['Nama Mata Kuliah', data?.nama || ''],
        ['Semester', data?.semester || ''],
        ['Periode', data?.periode || ''],
        ['Kurikulum', data?.kurikulum || ''],
        ['Jenis', data?.jenis || ''],
        ['Blok', data?.blok || ''],
        ['Tanggal Mulai', data?.tanggal_mulai ? new Date(data.tanggal_mulai).toISOString().split('T')[0] : ''],
        ['Tanggal Akhir', data?.tanggal_akhir ? new Date(data.tanggal_akhir).toISOString().split('T')[0] : ''],
        ['Durasi Minggu', data?.durasi_minggu || ''],
        [''],
        ['TOTAL JADWAL JURNAL READING', jadwalJurnalReading.length],
        [''],
        ['CATATAN:'],
        ['• File ini berisi data jadwal jurnal reading yang dapat di-import kembali ke aplikasi'],
        ['• Format tanggal: YYYY-MM-DD'],
        ['• Format jam: HH.MM atau HH:MM'],
        ['• Sesi: 1-6 (1 sesi = 50 menit)'],
        ['• Pastikan data dosen, ruangan, dan kelompok kecil valid sebelum import']
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: 30 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, infoWs, 'Info Mata Kuliah');

      const fileName = `Export_Jurnal_Reading_${data?.kode || 'MataKuliah'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      alert('Gagal mengekspor data jadwal jurnal reading');
    }
  };

  // Fungsi untuk download template Excel

  // Fungsi untuk download template PBL Excel

  const downloadPBLTemplate = async () => {

    try {

      // Ambil data yang diperlukan untuk template

      const modulPBLOptions = modulPBLList || [];

      const kelompokKecilOptions = kelompokKecilList || [];

      const dosenOptions = allDosenList || [];

      const ruanganOptions = allRuanganList || [];




      // Generate contoh tanggal dalam rentang mata kuliah

      const tanggalMulai = data?.tanggal_mulai ? new Date(data.tanggal_mulai) : new Date();

      const tanggalAkhir = data?.tanggal_akhir ? new Date(data.tanggal_akhir) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

      

      const generateContohTanggal = () => {

        const start = new Date(tanggalMulai);

        const end = new Date(tanggalAkhir);

        const randomTime = start.getTime() + Math.random() * (end.getTime() - start.getTime());

        return new Date(randomTime).toISOString().split('T')[0];

      };



      // Data template

      const rawTemplateData = [
        {

          tanggal: generateContohTanggal(),

          jam_mulai: "08:00",

          modul_pbl: modulPBLOptions[0]?.nama_modul || "Modul 1: Anatomi",

          kelompok_kecil: kelompokKecilOptions[0]?.nama_kelompok || "Kelompok A1",

          dosen: dosenOptions[0]?.name || "Dr. John Doe",

          ruangan: ruanganOptions[0]?.nama || "R. Anatomi",

          pbl_tipe: "PBL 1"

        },

        {

          tanggal: generateContohTanggal(),

          jam_mulai: "10:00",

          modul_pbl: modulPBLOptions[1]?.nama_modul || "Modul 2: Fisiologi",

          kelompok_kecil: kelompokKecilOptions[1]?.nama_kelompok || "Kelompok A2",

          dosen: dosenOptions[1]?.name || "Dr. Jane Smith",

          ruangan: ruanganOptions[1]?.nama || "R. Fisiologi",

          pbl_tipe: "PBL 2"

        }

      ];


      // Transform rawTemplateData to match new headers
      const templateData = rawTemplateData.map(row => {
        return {
          'Tanggal': row.tanggal,
          'Jam Mulai': row.jam_mulai,
          'Modul PBL': row.modul_pbl,
          'Kelompok Kecil': row.kelompok_kecil,
          'Dosen': row.dosen,
          'Ruangan': row.ruangan,
          'PBL Tipe': row.pbl_tipe
        };
      });


      // Buat workbook

      const wb = XLSX.utils.book_new();



      // Sheet template dengan header yang eksplisit (Title Case dengan spasi)
      const ws = XLSX.utils.json_to_sheet(templateData, {
        header: ['Tanggal', 'Jam Mulai', 'Modul PBL', 'Kelompok Kecil', 'Dosen', 'Ruangan', 'PBL Tipe']
      });
      

      // Set lebar kolom

      const colWidths = [

        { wch: 12 }, // tanggal

        { wch: 10 }, // jam_mulai

        { wch: 25 }, // modul_pbl

        { wch: 15 }, // kelompok_kecil

        { wch: 20 }, // dosen

        { wch: 15 }, // ruangan

        { wch: 10 }  // pbl_tipe

      ];

      ws['!cols'] = colWidths;



      XLSX.utils.book_append_sheet(wb, ws, "Template PBL");


      // Sheet tips dan informasi
      const infoData = [

        ['TIPS DAN INFORMASI IMPORT JADWAL PBL'],
        [''],
        ['📋 CARA UPLOAD FILE:'],
        ['1. Download template ini dan isi dengan data jadwal PBL'],
        ['2. Pastikan semua kolom wajib diisi dengan benar'],
        ['3. Upload file Excel yang sudah diisi ke sistem'],
        ['4. Periksa preview data dan perbaiki error jika ada'],
        ['5. Klik "Import" untuk menyimpan jadwal'],
        [''],
        ['✏️ CARA EDIT DATA:'],
        ['1. Klik pada kolom yang ingin diedit di tabel preview'],
        ['2. Ketik atau paste data yang benar'],
        ['3. Sistem akan otomatis validasi dan update error'],
        ['4. Pastikan tidak ada error sebelum import'],
        [''],
        ['📊 KETERSEDIAAN DATA:'],
        [''],
        ['📚 MODUL PBL YANG TERSEDIA:'],
        ...modulPBLOptions
          .filter((modul, index, self) => 
            // Hapus duplikasi berdasarkan ID atau nama
            index === self.findIndex(m => 
              (modul.id && m.id === modul.id) || 
              (modul.nama_modul && m.nama_modul === modul.nama_modul)
            )
          )
          .slice(0, 10)
          .map(modul => {
            const namaModul = modul.nama_modul || `Modul ${modul.id || 'Unknown'}`;
            return [`• ${namaModul}`];
          }),
        [''],
        ['👥 KELOMPOK KECIL YANG TERSEDIA:'],
        ...(() => {
          // Kelompok data berdasarkan nama_kelompok dan hitung jumlah mahasiswa
          const kelompokMap = new Map();
          
          kelompokKecilOptions.forEach(item => {
            const namaKelompok = item.nama_kelompok || `Kelompok ${item.id || 'Unknown'}`;
            if (kelompokMap.has(namaKelompok)) {
              kelompokMap.set(namaKelompok, kelompokMap.get(namaKelompok) + 1);
            } else {
              kelompokMap.set(namaKelompok, 1);
            }
          });
          
          // Convert map to array dan ambil 10 pertama
          return Array.from(kelompokMap.entries())
            .slice(0, 10)
            .map(([namaKelompok, jumlahAnggota]) => 
              [`• ${namaKelompok} (${jumlahAnggota} mahasiswa)`]
            );
        })(),
        [''],
        ['👨‍🏫 DOSEN YANG TERSEDIA:'],
        ['• Dosen yang tersedia adalah dosen yang sudah di-generate untuk blok dan semester ini'],
        ['• Termasuk dosen standby yang ditugaskan untuk mata kuliah ini'],
        ...dosenOptions
          .filter((dosen, index, self) => 
            // Hapus duplikasi berdasarkan ID atau nama
            index === self.findIndex(d => 
              (dosen.id && d.id === dosen.id) || 
              (dosen.name && d.name === dosen.name)
            )
          )
          .slice(0, 10)
          .map(dosen => {
            const namaDosen = dosen.name || `Dosen ${dosen.id || 'Unknown'}`;
            return [`• ${namaDosen}`];
          }),
        [''],
        ['🏢 RUANGAN YANG TERSEDIA:'],
        ...ruanganOptions
          .filter((ruangan, index, self) => 
            // Hapus duplikasi berdasarkan ID atau nama
            index === self.findIndex(r => 
              (ruangan.id && r.id === ruangan.id) || 
              (ruangan.nama && r.nama === ruangan.nama)
            )
          )
          .slice(0, 10)
          .map(ruangan => {
            const namaRuangan = ruangan.nama || `Ruangan ${ruangan.id || 'Unknown'}`;
            const kapasitas = ruangan.kapasitas || 0;
            return [`• ${namaRuangan} (Kapasitas: ${kapasitas} orang)`];
          }),
        [''],
        ['⚠️ VALIDASI SISTEM:'],
        [''],
        ['📅 VALIDASI TANGGAL:'],
        ['• Format: YYYY-MM-DD (contoh: 2024-01-15)'],
        ['• Wajib dalam rentang mata kuliah:'],
        [`  - Mulai: ${tanggalMulai.toLocaleDateString('id-ID')}`],
        [`  - Akhir: ${tanggalAkhir.toLocaleDateString('id-ID')}`],
        [''],
        ['⏰ VALIDASI JAM:'],
        ['• Format: HH:MM (contoh: 08:00)'],
        ['• Jam mulai harus sesuai opsi yang tersedia:'],
        ['  07:20, 08:10, 09:00, 09:50, 10:40, 11:30, 12:35, 13:25, 14:15, 15:05, 15:35, 16:25, 17:15'],
        ['• Jam selesai akan divalidasi berdasarkan perhitungan:'],
        ['  Jam selesai = Jam mulai + (Jumlah sesi x 50 menit)'],
        ['  Contoh: 08:00 + (2 x 50 menit) = 09:40'],
        [''],
        ['📚 VALIDASI MODUL PBL:'],
        ['• Nama modul harus ada di database'],
        ['• Gunakan nama modul yang tersedia di list di atas'],
        [''],
        ['👥 VALIDASI KELOMPOK KECIL:'],
        ['• Nama kelompok kecil harus ada di database'],
        ['• Harus sesuai dengan semester mata kuliah'],
        [''],
        ['👨‍🏫 VALIDASI DOSEN:'],
        ['• Nama dosen harus ada di database'],
        ['• Dosen harus sudah di-generate untuk blok dan semester ini'],
        ['• Termasuk dosen standby yang ditugaskan'],
        [''],
        ['🏢 VALIDASI RUANGAN:'],
        ['• Nama ruangan harus ada di database'],
        ['• Pastikan ruangan tersedia untuk jadwal tersebut'],
        [''],
        ['🔢 VALIDASI PBL TIPE:'],
        ['• Hanya boleh diisi: PBL 1 atau PBL 2'],
        ['• PBL 1 = 2 sesi (100 menit)'],
        ['• PBL 2 = 3 sesi (150 menit)'],
        [''],
        ['📝 VALIDASI TOPIK:'],
        ['• Topik boleh dikosongkan'],
        ['• Jika diisi, pastikan relevan dengan modul PBL'],
        [''],
        ['💡 TIPS PENTING:'],
        ['• Gunakan data yang ada di list ketersediaan di atas'],
        ['• Pastikan dosen sudah di-generate untuk blok dan semester ini'],
        ['• Periksa preview sebelum import'],
        ['• Edit langsung di tabel preview jika ada error'],
        ['• Sistem akan highlight error dengan warna merah'],
        ['• Tooltip akan menampilkan pesan error detail']
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: 50 }];
      XLSX.utils.book_append_sheet(wb, infoWs, "Tips dan Info");


      // Download file

      const fileName = `Template_Import_PBL_${data?.nama || 'MataKuliah'}_${new Date().toISOString().split('T')[0]}.xlsx`;

      XLSX.writeFile(wb, fileName);

    } catch (error) {

    }
  };

  // Fungsi untuk download template Excel Praktikum
  const downloadPraktikumTemplate = async () => {
    if (!data) return;

    try {
      // Fetch kelas praktikum untuk template
      const kelasPraktikumForTemplate = await fetchKelasPraktikumForTemplate(data.semester);
      
      // Ambil data yang diperlukan untuk template
      const startDate = data?.tanggal_mulai ? new Date(data.tanggal_mulai) : new Date();
      const endDate = data?.tanggal_akhir ? new Date(data.tanggal_akhir) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      // Generate contoh tanggal
      const generateContohTanggal = () => {
        const selisihHari = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const hari1 = Math.floor(selisihHari * 0.25);
        const hari2 = Math.floor(selisihHari * 0.75);
        
        const tanggal1 = new Date(startDate.getTime() + (hari1 * 24 * 60 * 60 * 1000));
        const tanggal2 = new Date(startDate.getTime() + (hari2 * 24 * 60 * 60 * 1000));
        
        return [
          tanggal1.toISOString().split('T')[0],
          tanggal2.toISOString().split('T')[0]
        ];
      };

      const [contohTanggal1, contohTanggal2] = generateContohTanggal();

      // Data template
      const rawTemplateData = [
        {
          tanggal: contohTanggal1,
          jam_mulai: '07.20',
          jam_selesai: '08.10',
          materi: data?.keahlian_required?.[0] || 'Anatomi',
          topik: 'Anatomi Sistem Kardiovaskular',
          kelas_praktikum: kelasPraktikumForTemplate[0] || 'A',
          dosen_id: dosenList[0]?.id || 1,
          ruangan_id: ruanganList[0]?.id || 1,
          jumlah_sesi: 1
        },
        {
          tanggal: contohTanggal2,
          jam_mulai: '08.20',
          jam_selesai: '10.00',
          materi: data?.keahlian_required?.[1] || data?.keahlian_required?.[0] || 'Fisiologi',
          topik: 'Fisiologi Sistem Respirasi',
          kelas_praktikum: kelasPraktikumForTemplate[1] || kelasPraktikumForTemplate[0] || 'B',
          dosen_id: dosenList[1]?.id || 2,
          ruangan_id: ruanganList[1]?.id || 2,
          jumlah_sesi: 2
        }
      ];

      // Transform rawTemplateData to match new headers
      const templateData = rawTemplateData.map(row => ({
        'Tanggal': row.tanggal,
        'Jam Mulai': row.jam_mulai,
        'Materi': row.materi,
        'Topik': row.topik,
        'Kelas Praktikum': row.kelas_praktikum,
        'Dosen': dosenList.find(d => d.id === row.dosen_id)?.name || 'Dosen 1',
        'Ruangan': ruanganList.find(r => r.id === row.ruangan_id)?.nama || 'Ruang 1',
        'Sesi': row.jumlah_sesi
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Sheet template dengan header yang eksplisit (Title Case dengan spasi)
      const ws = XLSX.utils.json_to_sheet(templateData, {
        header: ['Tanggal', 'Jam Mulai', 'Materi', 'Topik', 'Kelas Praktikum', 'Dosen', 'Ruangan', 'Sesi']
      });
      
      // Set column widths
      const colWidths = [
        { wch: EXCEL_COLUMN_WIDTHS.TANGGAL },
        { wch: EXCEL_COLUMN_WIDTHS.JAM_MULAI },
        { wch: EXCEL_COLUMN_WIDTHS.TOPIK },
        { wch: EXCEL_COLUMN_WIDTHS.TOPIK },
        { wch: EXCEL_COLUMN_WIDTHS.KELOMPOK_BESAR },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: EXCEL_COLUMN_WIDTHS.RUANGAN },
        { wch: 8 }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Template Praktikum");

      // Sheet Tips dan Info
      const infoData: string[][] = [
        ['TIPS DAN INFO'],
        [''],
        ['CARA UPLOAD/EDIT TEMPLATE:'],
        ['1. Download template ini dan isi dengan data jadwal praktikum'],
        ['2. Pastikan format data sesuai dengan ketentuan'],
        ['3. Upload file yang sudah diisi'],
        ['4. Periksa preview data'],
        ['5. Klik "Import Data" untuk menyimpan'],
        [''],
        ['📊 KETERSEDIAAN DATA:'],
        [''],
        ['👨‍🏫 DOSEN YANG TERSEDIA (dengan keahlian):'],
        ...dosenList.slice(0, TEMPLATE_DISPLAY_LIMIT).map(dosen => {
          const keahlian = Array.isArray(dosen.keahlian) 
            ? dosen.keahlian 
            : (dosen.keahlian || '').split(',').map((k: string) => k.trim());
          return [`• ${dosen.name} - Keahlian: ${keahlian.join(', ')}`];
        }),
        [''],
        ['🏢 RUANGAN YANG TERSEDIA:'],
        ...ruanganList.slice(0, TEMPLATE_DISPLAY_LIMIT).map(ruangan => [`• ${ruangan.nama}`]),
        [''],
        ['📚 KELAS PRAKTIKUM YANG TERSEDIA:'],
        ...(kelasPraktikumForTemplate.length > 0 
          ? kelasPraktikumForTemplate.slice(0, TEMPLATE_DISPLAY_LIMIT).map(kelas => [`• ${kelas}`])
          : [['• Belum ada kelas praktikum yang dibuat untuk semester ini']]
        ),
        [''],
        ['📚 MATERI YANG TERSEDIA (dari keahlian_required mata kuliah):'],
        ...(data?.keahlian_required || []).slice(0, TEMPLATE_DISPLAY_LIMIT).map(keahlian => [`• ${keahlian}`]),
        [''],
        ['⚠️ VALIDASI SISTEM:'],
        [''],
        ['📅 VALIDASI TANGGAL:'],
        ['• Format: YYYY-MM-DD (contoh: 2024-01-15)'],
        ['• Tanggal harus dalam rentang mata kuliah'],
        [`• Rentang: ${startDate.toLocaleDateString('id-ID')} - ${endDate.toLocaleDateString('id-ID')}`],
        [''],
        ['⏰ VALIDASI JAM:'],
        ['• Format: HH.MM atau HH:MM (contoh: 07.20 atau 07:20)'],
        ['• Jam mulai harus sesuai dengan opsi yang tersedia'],
        ['• Jam selesai dihitung otomatis berdasarkan sesi'],
        ['• 1 sesi = 50 menit'],
        [''],
        ['📝 VALIDASI DATA:'],
        ['• Materi wajib diisi dan harus sesuai dengan keahlian mata kuliah'],
        ['• Topik wajib diisi'],
        ['• Kelas praktikum harus dari daftar yang tersedia'],
        ['• Dosen harus sesuai dengan materi yang dipilih'],
        ['• Ruangan harus valid dan tersedia'],
        ['• Sesi: 1-6 (1 sesi = 50 menit)'],
        [''],
        ['🔄 PERHITUNGAN JAM SELESAI:'],
        ['• 1 sesi: +50 menit dari jam mulai'],
        ['• 2 sesi: +100 menit dari jam mulai'],
        ['• 3 sesi: +150 menit dari jam mulai'],
        ['• 4 sesi: +200 menit dari jam mulai'],
        ['• 5 sesi: +250 menit dari jam mulai'],
        ['• 6 sesi: +300 menit dari jam mulai'],
        [''],
        ['💡 TIPS:'],
        ['• Gunakan data yang sudah tersedia di sistem'],
        ['• Pastikan tidak ada bentrok jadwal'],
        ['• Periksa kapasitas ruangan'],
        ['• Validasi data sebelum import']
      ];

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: EXCEL_COLUMN_WIDTHS.INFO_COLUMN }];
      XLSX.utils.book_append_sheet(wb, infoWs, "Tips dan Info");

      // Download file
      const fileName = `Template_Import_Praktikum_${data?.nama || 'MataKuliah'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
    }

  };



  const downloadTemplate = async () => {

    try {

      // Ambil data dosen dan ruangan yang tersedia

      const dosenTersedia = dosenList.length > 0 ? dosenList.slice(0, 2) : [

        { name: "Dosen 1" },

        { name: "Dosen 2" }

      ];

      

      const ruanganTersedia = ruanganList.length > 0 ? ruanganList.slice(0, 2) : [

        { nama: "Ruangan 1" },

        { nama: "Ruangan 2" }

      ];



      // Ambil data kelompok besar yang tersedia

      const kelompokBesarTersedia = kelompokBesarOptions.length > 0 ? kelompokBesarOptions.slice(0, 2) : [

        { id: 1, label: "Kelompok Besar Semester 1" },

        { id: 3, label: "Kelompok Besar Semester 3" }

      ];





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



      // Ambil materi dari keahlian_required mata kuliah

      const materiTersedia = data?.keahlian_required || [];

      

      // Cari dosen yang memiliki keahlian yang sesuai

      const dosenDenganKeahlian = dosenList.filter(dosen => {

        const keahlian = Array.isArray(dosen.keahlian) 

          ? dosen.keahlian 

          : (dosen.keahlian || '').split(',').map((k: string) => k.trim());

        return materiTersedia.some(materi => keahlian.includes(materi));

      });



      // Data template untuk jadwal kuliah besar menggunakan data yang tersedia

      const rawTemplateData = [
        {

          tanggal: contohTanggal1,

          jam_mulai: "08:00",

          materi: materiTersedia[0] || "Materi 1",

          topik: "Topik 1",

          nama_dosen: dosenDenganKeahlian[0]?.name || dosenTersedia[0]?.name || "Dosen 1",

          nama_ruangan: ruanganTersedia[0]?.nama || "Ruangan 1",

          kelompok_besar_id: kelompokBesarTersedia[0]?.id || 1,

          jumlah_sesi: 2

        },

        {

          tanggal: contohTanggal2,

          jam_mulai: "10:00",

          materi: materiTersedia[1] || materiTersedia[0] || "Materi 2",

          topik: "Topik 2",

          nama_dosen: dosenDenganKeahlian[1]?.name || dosenDenganKeahlian[0]?.name || dosenTersedia[1]?.name || "Dosen 2",

          nama_ruangan: ruanganTersedia[1]?.nama || "Ruangan 2",

          kelompok_besar_id: kelompokBesarTersedia[1]?.id || 3,

          jumlah_sesi: 2

        }

      ];



      // Transform rawTemplateData to match new headers
      const templateData = rawTemplateData.map(row => {
        return {
          'Tanggal': row.tanggal,
          'Jam Mulai': row.jam_mulai,
          'Materi': row.materi,
          'Topik': row.topik,
          'Dosen': row.nama_dosen,
          'Ruangan': row.nama_ruangan,
          'Kelompok Besar': row.kelompok_besar_id, // Hanya angka saja
          'Jumlah Sesi': row.jumlah_sesi
        };
      });

      // Buat worksheet dengan header yang eksplisit (Title Case dengan spasi)
      const ws = XLSX.utils.json_to_sheet(templateData, {

        header: ['Tanggal', 'Jam Mulai', 'Materi', 'Topik', 'Dosen', 'Ruangan', 'Kelompok Besar', 'Jumlah Sesi']
      });

      

      // Set lebar kolom

      const colWidths = [

        { wch: 12 }, // tanggal

        { wch: 10 }, // jam_mulai

        { wch: 25 }, // materi

        { wch: 25 }, // topik

        { wch: 20 }, // nama_dosen

        { wch: 20 }, // nama_ruangan

        { wch: 15 }, // kelompok_besar_id

        { wch: 8 }   // jumlah_sesi

      ];

      ws['!cols'] = colWidths;

      

      // Buat worksheet untuk tips dan informasi
                const infoData = [

                  ['TIPS DAN INFORMASI IMPORT JADWAL KULIAH BESAR'],
                  [''],
                  ['📋 CARA UPLOAD FILE:'],
                  ['1. Download template ini dan isi dengan data jadwal kuliah besar'],
                  ['2. Pastikan semua kolom wajib diisi dengan benar'],
                  ['3. Upload file Excel yang sudah diisi ke sistem'],
                  ['4. Periksa preview data dan perbaiki error jika ada'],
                  ['5. Klik "Import" untuk menyimpan jadwal'],
                  [''],
                  ['✏️ CARA EDIT DATA:'],
                  ['1. Klik pada kolom yang ingin diedit di tabel preview'],
                  ['2. Ketik atau paste data yang benar'],
                  ['3. Sistem akan otomatis validasi dan update error'],
                  ['4. Pastikan tidak ada error sebelum import'],
                  [''],
                  ['📊 KETERSEDIAAN DATA:'],
                  [''],
                  ['👨‍🏫 DOSEN YANG TERSEDIA (dengan keahlian):'],
                  ...dosenList.slice(0, TEMPLATE_DISPLAY_LIMIT).map(dosen => {
                    const keahlian = Array.isArray(dosen.keahlian) 

                      ? dosen.keahlian 

                      : (dosen.keahlian || '').split(',').map((k: string) => k.trim());

                    return [`• ${dosen.name} - Keahlian: ${keahlian.join(', ')}`];
                  }),

                  [''],

                  ['🏢 RUANGAN YANG TERSEDIA:'],
                  ...ruanganList.slice(0, TEMPLATE_DISPLAY_LIMIT).map(ruangan => [`• ${ruangan.nama}`]),
                  [''],

                  ['👥 KELOMPOK BESAR YANG TERSEDIA:'],
                  ...kelompokBesarOptions.slice(0, TEMPLATE_DISPLAY_LIMIT).map(kelompok => [`• ${kelompok.id} - ${kelompok.label}`]),
                  [''],

                  ['📚 MATERI YANG TERSEDIA (dari keahlian_required mata kuliah):'],
                  ...(data?.keahlian_required || []).slice(0, TEMPLATE_DISPLAY_LIMIT).map(keahlian => [`• ${keahlian}`]),
                  [''],

                  ['⚠️ VALIDASI SISTEM:'],
                  [''],
                  ['📅 VALIDASI TANGGAL:'],
                  ['• Format: YYYY-MM-DD (contoh: 2024-01-15)'],
                  ['• Wajib dalam rentang mata kuliah:'],
                  [`  - Mulai: ${tanggalMulai ? new Date(tanggalMulai).toLocaleDateString('id-ID') : 'Tidak tersedia'}`],
                  [`  - Akhir: ${tanggalAkhir ? new Date(tanggalAkhir).toLocaleDateString('id-ID') : 'Tidak tersedia'}`],
                  [''],
                  ['⏰ VALIDASI JAM:'],
                  ['• Format: HH:MM (contoh: 08:00)'],
                  ['• Jam mulai harus sesuai opsi yang tersedia:'],
                  ['  07:20, 08:10, 09:00, 09:50, 10:40, 11:30, 12:35, 13:25, 14:15, 15:05, 15:35, 16:25, 17:15'],
                  ['• Jam selesai akan divalidasi berdasarkan perhitungan:'],
                  ['  Jam selesai = Jam mulai + (Jumlah sesi x 50 menit)'],
                  ['  Contoh: 08:00 + (2 x 50 menit) = 09:40'],
                  [''],
                  ['👨‍🏫 VALIDASI DOSEN:'],
                  ['• Nama dosen harus ada di database'],
                  ['• Materi harus sesuai dengan keahlian dosen'],
                  ['• Sistem akan cek kecocokan keahlian otomatis'],
                  [''],
                  ['🏢 VALIDASI RUANGAN:'],
                  ['• Nama ruangan harus ada di database'],
                  ['• Pastikan ruangan tersedia untuk jadwal tersebut'],
                  [''],
                  ['👥 VALIDASI KELOMPOK BESAR:'],
                  ['• ID kelompok besar harus berupa angka (1, 3, 5, 7, dst)'],
                  ['• ID harus ada di database'],
                  ['• Hanya boleh menggunakan kelompok besar di semester yang sama dengan mata kuliah'],
                  [''],
                  ['📚 VALIDASI MATERI:'],
                  ['• Materi wajib diisi'],
                  ['• Harus sesuai dengan keahlian_required mata kuliah'],
                  ['• Topik boleh dikosongkan'],
                  [''],
                  ['🔢 VALIDASI JUMLAH SESI:'],
                  ['• Jumlah sesi: 1-6'],
                  ['• Digunakan untuk menghitung jam selesai'],
                  ['• 1 sesi = 50 menit'],
                  [''],
                  ['💡 TIPS PENTING:'],
                  ['• Gunakan data yang ada di list ketersediaan di atas'],
                  ['• Pastikan materi sesuai dengan keahlian dosen'],
                  ['• Periksa preview sebelum import'],
                  ['• Edit langsung di tabel preview jika ada error'],
                  ['• Sistem akan highlight error dengan warna merah'],
                  ['• Tooltip akan menampilkan pesan error detail']
                ];

      

      const infoWs = XLSX.utils.aoa_to_sheet(infoData);

      infoWs['!cols'] = [{ wch: 50 }];

      

      const wb = XLSX.utils.book_new();

      XLSX.utils.book_append_sheet(wb, ws, "Template Kuliah Besar");
      XLSX.utils.book_append_sheet(wb, infoWs, "Tips dan Info");
      XLSX.writeFile(wb, "Template_Import_JadwalKuliahBesar.xlsx");

    } catch (error) {

      // Error downloading template

    }

  };

  // Fungsi untuk download template Excel Agenda Khusus
  const downloadAgendaKhususTemplate = async () => {
    if (!data) return;

    try {
      // Ambil data yang diperlukan untuk template
      const startDate = data?.tanggal_mulai ? new Date(data.tanggal_mulai) : new Date();
      const endDate = data?.tanggal_akhir ? new Date(data.tanggal_akhir) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      // Generate contoh tanggal
      const generateContohTanggal = () => {
        const selisihHari = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const hari1 = Math.floor(selisihHari * 0.25);
        const hari2 = Math.floor(selisihHari * 0.75);
        
        const tanggal1 = new Date(startDate.getTime() + (hari1 * 24 * 60 * 60 * 1000));
        const tanggal2 = new Date(startDate.getTime() + (hari2 * 24 * 60 * 60 * 1000));
        
        return [
          tanggal1.toISOString().split('T')[0],
          tanggal2.toISOString().split('T')[0]
        ];
      };

      const [contohTanggal1, contohTanggal2] = generateContohTanggal();

      // Ambil kelompok besar yang tersedia
      const kelompokBesarTersedia = kelompokBesarOptions.length > 0 ? kelompokBesarOptions : [
        { id: 1, label: "Kelompok Besar Semester 1" }
      ];

      // Data template - 1 dengan ruangan, 1 tanpa ruangan
      const rawTemplateData = [
        {
          tanggal: contohTanggal1,
          jam_mulai: '07.20',
          agenda: 'Ujian Tengah Semester',
          ruangan: ruanganList[0]?.nama || 'Ruang 1',
          kelompok_besar_id: kelompokBesarTersedia[0]?.id || 1,
          jumlah_sesi: 2
        },
        {
          tanggal: contohTanggal2,
          jam_mulai: '10.40',
          agenda: 'Seminar Kesehatan Online',
          ruangan: '', // Tidak menggunakan ruangan
          kelompok_besar_id: kelompokBesarTersedia[1]?.id || kelompokBesarTersedia[0]?.id || 1,
          jumlah_sesi: 2
        }
      ];

      // Transform rawTemplateData to match new headers
      const templateData = rawTemplateData.map(row => ({
        'Tanggal': row.tanggal,
        'Jam Mulai': row.jam_mulai,
        'Agenda': row.agenda,
        'Ruangan': row.ruangan,
        'Kelompok Besar': row.kelompok_besar_id,
        'Jumlah Sesi': row.jumlah_sesi
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Sheet template dengan header yang eksplisit (Title Case dengan spasi)
      const ws = XLSX.utils.json_to_sheet(templateData, {
        header: ['Tanggal', 'Jam Mulai', 'Agenda', 'Ruangan', 'Kelompok Besar', 'Jumlah Sesi']
      });
      
      // Set column widths
      const colWidths = [
        { wch: EXCEL_COLUMN_WIDTHS.TANGGAL },
        { wch: EXCEL_COLUMN_WIDTHS.JAM_MULAI },
        { wch: EXCEL_COLUMN_WIDTHS.TOPIK },
        { wch: EXCEL_COLUMN_WIDTHS.RUANGAN },
        { wch: EXCEL_COLUMN_WIDTHS.KELOMPOK_BESAR },
        { wch: 8 }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Template Agenda Khusus");

      // Sheet Tips dan Info
      const infoData: string[][] = [
        ['TIPS DAN INFORMASI IMPORT JADWAL AGENDA KHUSUS'],
        [''],
        ['📋 CARA UPLOAD FILE:'],
        ['1. Download template ini dan isi dengan data jadwal agenda khusus'],
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
        ['🏢 RUANGAN YANG TERSEDIA:'],
        ...ruanganList.slice(0, TEMPLATE_DISPLAY_LIMIT).map(ruangan => [`• ${ruangan.nama}`]),
        [''],
        ['👥 KELOMPOK BESAR YANG TERSEDIA:'],
        ...kelompokBesarOptions.slice(0, TEMPLATE_DISPLAY_LIMIT).map(kelompok => [`• ${kelompok.id} - ${kelompok.label}`]),
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
        ['• Jam mulai harus sesuai opsi yang tersedia:'],
        ['  07:20, 08:10, 09:00, 09:50, 10:40, 11:30, 12:35, 13:25, 14:15, 15:05, 15:35, 16:25, 17:15'],
        ['• Jam selesai akan divalidasi berdasarkan perhitungan:'],
        ['  Jam selesai = Jam mulai + (Jumlah sesi x 50 menit)'],
        ['  Contoh: 07:20 + (2 x 50 menit) = 09:00'],
        [''],
        ['📝 VALIDASI AGENDA:'],
        ['• Agenda wajib diisi'],
        ['• Isi dengan deskripsi agenda yang jelas'],
        [''],
        ['🏢 VALIDASI RUANGAN:'],
        ['• Ruangan boleh dikosongkan untuk agenda online/tidak memerlukan ruangan'],
        ['• Jika diisi, nama ruangan harus ada di database'],
        ['• Pastikan ruangan tersedia untuk jadwal tersebut'],
        [''],
        ['👥 VALIDASI KELOMPOK BESAR:'],
        ['• ID kelompok besar harus berupa angka (1, 3, 5, 7, dst)'],
        ['• ID harus ada di database'],
        ['• Hanya boleh menggunakan kelompok besar di semester yang sama dengan mata kuliah'],
        [''],
        ['🔢 VALIDASI JUMLAH SESI:'],
        ['• Jumlah sesi: 1-6'],
        ['• Digunakan untuk menghitung jam selesai'],
        ['• 1 sesi = 50 menit'],
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
      XLSX.utils.book_append_sheet(wb, infoWs, "Tips dan Info");

      // Download file
      const fileName = `Template_Import_AgendaKhusus_${data?.nama || 'MataKuliah'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
    }
  };

  // Fungsi untuk menghitung jumlah sesi dari durasi jam

  const hitungJumlahSesi = (jamMulai: string, jamSelesai: string): number => {

    try {

      // Normalisasi format waktu (handle berbagai format)

      const normalizeTime = (time: string): string => {

        return time.replace(/\./g, ':').replace(/ /g, '');

      };



      const startTime = normalizeTime(jamMulai);

      const endTime = normalizeTime(jamSelesai);



      const [startH, startM] = startTime.split(":").map(Number);

      const [endH, endM] = endTime.split(":").map(Number);



      // Validasi input

      if (isNaN(startH) || isNaN(startM) || isNaN(endH) || isNaN(endM)) {

        throw new Error('Invalid time format');

      }



      const start = startH * 60 + startM;

      const end = endH * 60 + endM;

      const durasi = end - start;



      if (durasi <= 0) {

        throw new Error('End time must be after start time');

      }



      return Math.ceil(durasi / 50); // 1 sesi = 50 menit

    } catch (error) {

      return 2; // fallback ke 2 sesi

    }

  };


  const readExcelFile = (file: File): Promise<{ data: any[], headers: string[] }> => {
    return new Promise((resolve, reject) => {

      const reader = new FileReader();

      

      reader.onload = (e) => {

        try {

          const data = e.target?.result;

          const workbook = XLSX.read(data, { 

            type: "array",

            cellFormula: true,

            cellDates: true,

            dateNF: "yyyy-mm-dd"

          });

          

          const firstSheetName = workbook.SheetNames[0];

          const worksheet = workbook.Sheets[firstSheetName];

          

          const jsonData = XLSX.utils.sheet_to_json(worksheet, {

            header: 1,

            raw: false,

            defval: "",

            blankrows: false

          }) as any[][];

          

          // Ambil header row dengan guard agar tidak memanggil .map pada unknown

          const rawHeaderRow = Array.isArray(jsonData[0]) ? (jsonData[0] as any[]) : [];

          const headers = rawHeaderRow.map((h: any) => (h != null ? h.toString() : ''));

          

          // Deteksi apakah ada baris header kedua (berisi penjelasan dalam kurung)
          let headerRowCount = 1;
          if (jsonData.length > 1) {
            const secondRow = jsonData[1];
            if (Array.isArray(secondRow)) {
              // Cek apakah baris kedua berisi penjelasan header (teks dalam kurung)
              const hasParentheticalText = secondRow.some(cell => 
                cell && cell.toString().includes('(') && cell.toString().includes(')')
              );
              if (hasParentheticalText) {
                headerRowCount = 2;
              }
            }
          }

          // Skip header row(s) dan filter baris kosong
          const dataRows = jsonData.slice(headerRowCount).filter((row: any[]) => 
            row.some(cell => cell && cell.toString().trim() !== '')
          );

          // DEBUG: Log untuk melihat struktur data

          resolve({ data: dataRows, headers });
        } catch (error) {

          reject(error);

        }

      };

      

      reader.onerror = () => reject(new Error('Failed to read file'));

      reader.readAsArrayBuffer(file);

    });

  };



  // Helper function untuk validasi tanggal
  const validateDate = (tanggal: string, rowNumber: number): string | null => {
    if (!tanggal) {
      return `Tanggal wajib diisi (Baris ${rowNumber}, Kolom Tanggal)`;
    }
    
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(tanggal)) {
      return `Format tanggal harus YYYY-MM-DD (Baris ${rowNumber}, Kolom Tanggal)`;
    }
    
    // Validasi tanggal yang valid (misal: 2026-02-30 tidak valid)
    const dateObj = new Date(tanggal);
    if (isNaN(dateObj.getTime()) || tanggal !== dateObj.toISOString().split('T')[0]) {
      return `Tanggal tidak valid (Baris ${rowNumber}, Kolom Tanggal)`;
    }
    
    // Validasi rentang tanggal mata kuliah
    const tanggalMulai = data?.tanggal_mulai ? new Date(data.tanggal_mulai) : null;
    const tanggalAkhir = data?.tanggal_akhir ? new Date(data.tanggal_akhir) : null;
    const tanggalJadwal = new Date(tanggal);

    if (tanggalMulai && tanggalAkhir && (tanggalJadwal < tanggalMulai || tanggalJadwal > tanggalAkhir)) {
      return `Tanggal di luar rentang mata kuliah (${tanggalMulai.toLocaleDateString('id-ID')} - ${tanggalAkhir.toLocaleDateString('id-ID')}) (Baris ${rowNumber}, Kolom Tanggal)`;
    }
    
    return null;
  };

  // Helper function untuk validasi jam
  const validateTime = (jam: string, rowNumber: number, fieldName: string, availableTimes?: string[]): string | null => {
    if (!jam) {
      return `${fieldName} wajib diisi (Baris ${rowNumber}, Kolom ${fieldName})`;
    }
    
    if (!/^\d{1,2}[.:]\d{2}$/.test(jam)) {
      return `Format ${fieldName} harus HH:MM atau HH.MM (Baris ${rowNumber}, Kolom ${fieldName})`;
    }
    
    // Validasi jam sesuai dengan opsi yang tersedia
    if (availableTimes && availableTimes.length > 0) {
      const normalizeTimeForComparison = (time: string): string => {
        return time.replace(':', '.');
      };
      
      const normalizedInput = normalizeTimeForComparison(jam);
      const isTimeValid = availableTimes.some(option => normalizeTimeForComparison(option) === normalizedInput);
      
      if (!isTimeValid) {
          return `${fieldName} "${jam}" tidak valid. Jam yang tersedia: ${availableTimes.join(', ')} (Baris ${rowNumber}, Kolom ${fieldName})`;
      }
    }
    
    return null;
  };

  // Fungsi untuk validasi data Excel (menggunakan data yang sudah dikonversi)
  // Fungsi untuk validasi data Excel PBL
  const validatePBLExcelData = (convertedData: JadwalPBLType[]) => {
    const cellErrors: { row: number, field: string, message: string }[] = [];

    convertedData.forEach((row, index) => {
      const rowNumber = index + 1;

      // Validasi tanggal menggunakan helper function
      const tanggalError = validateDate(row.tanggal, rowNumber);
      if (tanggalError) {
        cellErrors.push({ row: index, field: 'tanggal', message: tanggalError });
      }

      // Validasi jam mulai menggunakan helper function dengan opsi jam yang tersedia
      const jamMulaiError = validateTime(row.jam_mulai, rowNumber, 'jam mulai', jamOptions);
      if (jamMulaiError) {
        cellErrors.push({ row: index, field: 'jam_mulai', message: jamMulaiError });
      }




      // Validasi modul PBL

      const namaModul = (row as any).nama_modul;
      if (!namaModul || namaModul.trim() === '') {
        cellErrors.push({ row: index, field: 'modul_pbl_id', message: `Modul PBL wajib diisi (Baris ${rowNumber}, Kolom Modul PBL)` });
      } else {
        // Cek apakah nama modul yang diketik user ada di database
        const modulPBL = modulPBLList?.find(m => m.nama_modul.toLowerCase() === namaModul.toLowerCase());
        if (!modulPBL) {

          cellErrors.push({ row: index, field: 'modul_pbl_id', message: `Modul PBL "${namaModul}" tidak ditemukan (Baris ${rowNumber}, Kolom Modul PBL)` });
        }

      }



      // Validasi kelompok kecil
      const namaKelompok = (row as any).nama_kelompok;
      if (!namaKelompok || namaKelompok.trim() === '') {
        cellErrors.push({ row: index, field: 'kelompok_kecil_id', message: `Kelompok kecil wajib diisi (Baris ${rowNumber}, Kolom Kelompok Kecil)` });
      } else {
        const kelompokKecil = kelompokKecilList?.find(k => k.nama_kelompok.toLowerCase() === namaKelompok.toLowerCase());
        if (!kelompokKecil) {
          cellErrors.push({ row: index, field: 'kelompok_kecil_id', message: `Kelompok kecil "${namaKelompok}" tidak ditemukan (Baris ${rowNumber}, Kolom Kelompok Kecil)` });
        }
      }

      // Validasi dosen - hanya dosen yang sudah di-generate untuk blok dan semester ini + dosen standby
      const namaDosen = (row as any).nama_dosen;
      if (!namaDosen || namaDosen.trim() === '') {
        cellErrors.push({ row: index, field: 'dosen_id', message: `Dosen wajib diisi (Baris ${rowNumber}, Kolom Dosen)` });
      } else {
        // Cari dosen berdasarkan nama yang diketik user
        const dosen = allDosenList?.find(d => d.name.toLowerCase() === namaDosen.toLowerCase());
        if (!dosen) {

          cellErrors.push({ row: index, field: 'dosen_id', message: `Dosen "${namaDosen}" tidak ditemukan (Baris ${rowNumber}, Kolom Dosen)` });
        } else {
          // Cek apakah dosen adalah dosen yang sudah di-generate untuk PBL atau dosen standby
          const isAssignedDosen = assignedDosenPBL?.some(d => d.id === dosen.id);
          const isStandbyDosen = dosen.name.toLowerCase().includes('standby');
          
          if (!isAssignedDosen && !isStandbyDosen) {
            cellErrors.push({ 
              row: index, 
              field: 'dosen_id', 
              message: `Dosen "${dosen.name}" tidak valid. Hanya boleh menggunakan dosen yang sudah di-generate untuk blok dan semester ini atau dosen standby (Baris ${rowNumber}, Kolom Dosen)` 
            });
          }
        }

      }



      // Validasi ruangan

      if (!row.ruangan_id) {
        cellErrors.push({ row: index, field: 'ruangan_id', message: `Ruangan wajib diisi (Baris ${rowNumber}, Kolom Ruangan)` });
      } else {
        const ruangan = allRuanganList?.find(r => r.id === row.ruangan_id);

        if (!ruangan) {

          cellErrors.push({ row: index, field: 'ruangan_id', message: `Ruangan tidak ditemukan (Baris ${rowNumber}, Kolom Ruangan)` });
        }
      }

      // Validasi PBL Tipe
      if (!row.pbl_tipe || row.pbl_tipe.trim() === '') {
        cellErrors.push({ row: index, field: 'pbl_tipe', message: `PBL Tipe wajib diisi (Baris ${rowNumber}, Kolom PBL Tipe)` });
      } else {
        const validPBLTipe = ['PBL 1', 'PBL 2'];
        if (!validPBLTipe.includes(row.pbl_tipe)) {
          cellErrors.push({ row: index, field: 'pbl_tipe', message: `PBL Tipe "${row.pbl_tipe}" tidak valid. Hanya boleh diisi: PBL 1 atau PBL 2 (Baris ${rowNumber}, Kolom PBL Tipe)` });
        }

      }

    });



    return { cellErrors };

  };



  // Validasi data Excel Praktikum
  const validatePraktikumExcelData = (convertedData: JadwalPraktikumType[], kelasOptions: string[] = kelasPraktikumOptions) => {
    const cellErrors: { row: number, field: string, message: string }[] = [];

    
    if (!convertedData) return { cellErrors };
    

    convertedData.forEach((row, index) => {

      const rowNumber = index + 1;

      // Validasi tanggal
      const dateError = validateDate(row.tanggal, rowNumber);
      if (dateError) {
        cellErrors.push({ row: rowNumber, field: 'tanggal', message: dateError });
      }

      // Validasi jam mulai
      const jamMulaiError = validateTime(row.jam_mulai, rowNumber, 'jam mulai', jamOptions);
      if (jamMulaiError) {
        cellErrors.push({ row: rowNumber, field: 'jam_mulai', message: jamMulaiError });
      }


      // Validasi materi - untuk SIAKAD template, materi HARUS diisi manual di preview table
      if (!row.materi || row.materi.trim() === '' || row.materi === 'Kosong (isi manual)') {
        cellErrors.push({ row: rowNumber, field: 'materi', message: `Materi wajib diisi (Baris ${rowNumber}, Kolom MATERI)` });
      } else {
        // Validasi materi harus dari keahlian_required mata kuliah
        const materiRelevan = data?.keahlian_required || [];
        if (!materiRelevan.includes(row.materi)) {
          cellErrors.push({ row: rowNumber, field: 'materi', message: `Materi "${row.materi}" tidak sesuai dengan keahlian mata kuliah. Materi yang tersedia: ${materiRelevan.join(', ')} (Baris ${rowNumber}, Kolom MATERI)` });
        }
      }

      // Validasi topik - untuk SIAKAD template, topik HARUS diisi manual di preview table
      if (!row.topik || row.topik.trim() === '') {
        cellErrors.push({ row: rowNumber, field: 'topik', message: `Topik wajib diisi (Baris ${rowNumber}, Kolom TOPIK)` });
      }

      // Validasi kelas praktikum
      if (!row.kelas_praktikum || row.kelas_praktikum.trim() === '') {
        cellErrors.push({ row: rowNumber, field: 'kelas_praktikum', message: `Kelas praktikum wajib diisi (Baris ${rowNumber}, Kolom KELAS_PRAKTIKUM)` });
      } else if (!kelasOptions.includes(row.kelas_praktikum)) {
        cellErrors.push({ row: rowNumber, field: 'kelas_praktikum', message: `Kelas praktikum "${row.kelas_praktikum}" tidak ditemukan. Kelas yang tersedia: ${kelasOptions.join(', ')} (Baris ${rowNumber}, Kolom KELAS_PRAKTIKUM)` });
      }

      // Validasi dosen - untuk SIAKAD template, dosen HARUS diisi manual di preview table
      const namaDosen = row.nama_dosen;
      if (!namaDosen || namaDosen.trim() === '' || namaDosen === 'Kosong (isi manual)') {
        cellErrors.push({ row: rowNumber, field: 'dosen_id', message: `Dosen wajib diisi (Baris ${rowNumber}, Kolom DOSEN)` });
      } else {
        // Cari dosen berdasarkan nama yang diketik user
        const dosen = allDosenList?.find(d => d.name.toLowerCase() === namaDosen.toLowerCase());
        if (!dosen) {
          cellErrors.push({ row: rowNumber, field: 'dosen_id', message: `Dosen "${namaDosen}" tidak ditemukan (Baris ${rowNumber}, Kolom DOSEN)` });
        } else {
          // Cek apakah dosen standby
          const isStandbyDosen = dosen.name.toLowerCase().includes('standby') || 
            (Array.isArray(dosen.keahlian) ? dosen.keahlian.some((k: string) => k.toLowerCase().includes("standby")) : 
             (dosen.keahlian || "").toLowerCase().includes("standby"));
          
          // Jika bukan dosen standby, validasi keahlian dengan materi
          if (!isStandbyDosen && row.materi && row.materi !== 'Kosong (isi manual)') {
          // Validasi keahlian dosen dengan materi (konsisten dengan Kuliah Besar)
          const keahlianDosen = Array.isArray(dosen.keahlian) 
            ? dosen.keahlian 
            : (dosen.keahlian || '').split(',').map((k: string) => k.trim());
          
          if (!keahlianDosen.includes(row.materi)) {
            cellErrors.push({ 
              row: rowNumber, 
              field: 'materi', 
              message: `Materi "${row.materi}" tidak sesuai dengan keahlian dosen "${dosen.name}". Keahlian dosen: ${keahlianDosen.join(', ')} (Baris ${rowNumber}, Kolom MATERI)` 
            });
          }
        }
          // Dosen standby tidak perlu validasi keahlian
        }
      }

      

      // Validasi ruangan (konsisten dengan Kuliah Besar)
      const namaRuangan = row.nama_ruangan;
      if (!namaRuangan || namaRuangan.trim() === '') {
        cellErrors.push({ row: rowNumber, field: 'ruangan_id', message: `Ruangan wajib diisi (Baris ${rowNumber}, Kolom RUANGAN)` });
      } else {
        const ruangan = allRuanganList?.find(r => r.nama.toLowerCase() === namaRuangan.toLowerCase());
        if (!ruangan) {
          cellErrors.push({ row: rowNumber, field: 'ruangan_id', message: `Ruangan "${namaRuangan}" tidak ditemukan (Baris ${rowNumber}, Kolom RUANGAN)` });
        }
      }

      // Validasi sesi
      if (!row.jumlah_sesi || row.jumlah_sesi < 1 || row.jumlah_sesi > 6) {
        cellErrors.push({ row: rowNumber, field: 'jumlah_sesi', message: `Sesi harus 1-6 (Baris ${rowNumber}, Kolom SESI)` });
      }
    });

    return { cellErrors };
  };

  // Validasi data Excel Agenda Khusus
  const validateAgendaKhususExcelData = (convertedData: JadwalAgendaKhususType[]) => {
    const cellErrors: { row: number, field: string, message: string }[] = [];
    
    if (!convertedData) return { cellErrors };
    
    convertedData.forEach((row, index) => {
      const rowNumber = index + 1;

      // Validasi tanggal
      const dateError = validateDate(row.tanggal, rowNumber);
      if (dateError) {
        cellErrors.push({ row: rowNumber, field: 'tanggal', message: dateError });
      }

      // Validasi jam mulai
      const jamMulaiError = validateTime(row.jam_mulai, rowNumber, 'jam mulai', jamOptions);
      if (jamMulaiError) {
        cellErrors.push({ row: rowNumber, field: 'jam_mulai', message: jamMulaiError });
      }

      // Validasi agenda
      if (!row.agenda || row.agenda.trim() === '') {
        cellErrors.push({ row: rowNumber, field: 'agenda', message: `Agenda wajib diisi (Baris ${rowNumber}, Kolom AGENDA)` });
      }

      // Validasi ruangan (boleh dikosongkan)
      const namaRuangan = row.nama_ruangan;
      if (namaRuangan && namaRuangan.trim() !== '') {
        const ruangan = allRuanganList?.find(r => r.nama.toLowerCase() === namaRuangan.toLowerCase());
        if (!ruangan) {
          cellErrors.push({ row: rowNumber, field: 'ruangan_id', message: `Ruangan "${namaRuangan}" tidak ditemukan (Baris ${rowNumber}, Kolom RUANGAN)` });
        }
      }

      // Validasi kelompok besar ID
      if (!row.kelompok_besar_id || row.kelompok_besar_id === 0) {
        cellErrors.push({ row: rowNumber, field: 'kelompok_besar_id', message: `Kelompok besar wajib diisi (Baris ${rowNumber}, Kolom KELOMPOK_BESAR)` });
      } else {
        const kelompokBesarId = parseInt(row.kelompok_besar_id.toString());
        if (isNaN(kelompokBesarId) || kelompokBesarId < 1) {
          cellErrors.push({ row: rowNumber, field: 'kelompok_besar_id', message: `Kelompok besar harus berupa angka positif (Baris ${rowNumber}, Kolom KELOMPOK_BESAR)` });
        } else {
          const kelompokBesar = kelompokBesarOptions.find(k => Number(k.id) === kelompokBesarId);
          if (!kelompokBesar) {
            cellErrors.push({ row: rowNumber, field: 'kelompok_besar_id', message: `Kelompok besar ID ${kelompokBesarId} tidak ditemukan (Baris ${rowNumber}, Kolom KELOMPOK_BESAR)` });
          } else {
            // Validasi semester kelompok besar sesuai dengan semester mata kuliah
            const mataKuliahSemester = data?.semester;
            if (mataKuliahSemester && kelompokBesarId != mataKuliahSemester) {
              cellErrors.push({ 
                row: rowNumber, 
                field: 'kelompok_besar_id', 
                message: `Kelompok besar ID ${kelompokBesarId} tidak sesuai dengan semester mata kuliah (${mataKuliahSemester}). Hanya boleh menggunakan kelompok besar semester ${mataKuliahSemester}. (Baris ${rowNumber}, Kolom KELOMPOK_BESAR)` 
              });
            }
          }
        }
      }

      // Validasi jumlah sesi
      if (!row.jumlah_sesi || row.jumlah_sesi < 1 || row.jumlah_sesi > 6) {
        cellErrors.push({ row: rowNumber, field: 'jumlah_sesi', message: `Jumlah sesi harus 1-6 (Baris ${rowNumber}, Kolom JUMLAH_SESI)` });
      }
    });

    return { cellErrors };
  };

  const validateExcelData = (convertedData: JadwalKuliahBesarType[], existingData?: JadwalKuliahBesarType[]) => {
    const errors: string[] = [];
    const cellErrors: { row: number, field: string, message: string }[] = [];
    
    convertedData.forEach((row, index) => {
      const rowNumber = index + 1;
      
      // Validasi tanggal menggunakan helper function
      const tanggalError = validateDate(row.tanggal, rowNumber);
      if (tanggalError) {
        cellErrors.push({ row: index, field: 'tanggal', message: tanggalError });
      }
      
      // Validasi jam mulai wajib diisi
      if (!row.jam_mulai || row.jam_mulai.trim() === '') {
        cellErrors.push({ row: index, field: 'jam_mulai', message: `Jam mulai wajib diisi (Baris ${rowNumber}, Kolom jam mulai)` });
      } else {
        const jamMulaiError = validateTime(row.jam_mulai, rowNumber, 'jam mulai', jamOptions);
        if (jamMulaiError) {
          cellErrors.push({ row: index, field: 'jam_mulai', message: jamMulaiError });
        }
      }
      
      
      // Validasi materi
      if (!row.materi || row.materi.trim() === '' || row.materi === 'Kosong (isi manual)') {
        cellErrors.push({ row: index, field: 'materi', message: `Materi wajib diisi (Baris ${rowNumber}, Kolom MATERI)` });
      } else {
        // Validate materi exists in available options
        const materiTersedia = data?.keahlian_required || [];
        if (!materiTersedia.includes(row.materi)) {
          cellErrors.push({ row: index, field: 'materi', message: `Materi "${row.materi}" tidak valid. Materi yang tersedia: ${materiTersedia.join(', ')} (Baris ${rowNumber}, Kolom MATERI)` });
        }
      }
      

      // Validasi kelompok besar ID

      if (!row.kelompok_besar_id || row.kelompok_besar_id === 0) {
        cellErrors.push({ row: index, field: 'kelompok_besar_id', message: `Kelompok besar ID wajib diisi (Baris ${rowNumber}, Kolom KELOMPOK_BESAR_ID)` });
      } else {
      const kelompokBesarId = parseInt(row.kelompok_besar_id.toString());

      if (isNaN(kelompokBesarId) || kelompokBesarId < 1) {

          cellErrors.push({ row: index, field: 'kelompok_besar_id', message: `Kelompok besar ID harus berupa angka positif (Baris ${rowNumber}, Kolom KELOMPOK_BESAR_ID)` });
      } else {

        // Validasi kelompok besar ID ada di database

        const kelompokBesar = kelompokBesarOptions.find(k => Number(k.id) === kelompokBesarId);


        if (!kelompokBesar) {

            cellErrors.push({ row: index, field: 'kelompok_besar_id', message: `Kelompok besar ID ${kelompokBesarId} tidak ditemukan (Baris ${rowNumber}, Kolom KELOMPOK_BESAR_ID)` });
        } else {

          // Validasi semester kelompok besar sesuai dengan semester mata kuliah

          const mataKuliahSemester = data?.semester;

          if (mataKuliahSemester && kelompokBesarId != mataKuliahSemester) {
              cellErrors.push({ 
                row: index, 
                field: 'kelompok_besar_id', 
                message: `Kelompok besar ID ${kelompokBesarId} tidak sesuai dengan semester mata kuliah (${mataKuliahSemester}). Hanya boleh menggunakan kelompok besar semester ${mataKuliahSemester}. (Baris ${rowNumber}, Kolom KELOMPOK_BESAR_ID)` 
              });
            }
          }

        }

      }

      

      // Validasi jumlah sesi
      if (!row.jumlah_sesi) {
        cellErrors.push({ row: index, field: 'jumlah_sesi', message: `Jumlah sesi wajib diisi (Baris ${rowNumber}, Kolom SESI)` });
      } else {
        const jumlahSesi = parseInt(row.jumlah_sesi.toString());
        if (isNaN(jumlahSesi) || jumlahSesi < 1 || jumlahSesi > 6) {
          cellErrors.push({ row: index, field: 'jumlah_sesi', message: `Jumlah sesi harus antara 1-6 (Baris ${rowNumber}, Kolom SESI)` });
        }
      }
      
      // Validasi dosen - untuk SIAKAD template, dosen HARUS diisi manual di preview table
      if (!row.dosen_id || row.dosen_id === 0 || row.dosen_id === null) {
        cellErrors.push({ row: index, field: 'dosen_id', message: `Dosen wajib diisi (Baris ${rowNumber}, Kolom Dosen)` });
      } else {
        // For SIAKAD template, validate by nama_dosen instead of dosen_id
        let dosen = null;
        if (row.nama_dosen) {
          dosen = allDosenList.find(d => d.name.toLowerCase() === row.nama_dosen.toLowerCase());
        } else {
          dosen = dosenList.find(d => d.id === row.dosen_id);
        }

        if (!dosen) {
          const dosenName = row.nama_dosen || 'ID ' + row.dosen_id;
          cellErrors.push({ row: index, field: 'dosen_id', message: `Dosen "${dosenName}" tidak ditemukan (Baris ${rowNumber}, Kolom Dosen)` });
        } else {
          // Cek apakah dosen standby
          const isStandbyDosen = dosen.name.toLowerCase().includes('standby') || 
            (Array.isArray(dosen.keahlian) ? dosen.keahlian.some((k: string) => k.toLowerCase().includes("standby")) : 
             (dosen.keahlian || "").toLowerCase().includes("standby"));
          
          // Jika bukan dosen standby, validasi keahlian dengan materi
          if (!isStandbyDosen && row.materi && row.materi !== 'Kosong (isi manual)') {
          // Validasi keahlian dosen dengan materi
          const keahlianDosen = Array.isArray(dosen.keahlian) 
            ? dosen.keahlian 
            : (dosen.keahlian || '').split(',').map((k: string) => k.trim());

          if (!keahlianDosen.includes(row.materi)) {
            cellErrors.push({ 
              row: index, 
              field: 'materi', 
              message: `Materi "${row.materi}" tidak sesuai dengan keahlian dosen "${dosen.name}". Keahlian dosen: ${keahlianDosen.join(', ')} (Baris ${rowNumber}, Kolom MATERI)` 
            });
          }
          }
          // Dosen standby tidak perlu validasi keahlian
        }
      }

      // Validasi ruangan
      const namaRuangan = row.nama_ruangan;
      if (!namaRuangan || namaRuangan.trim() === '') {
        cellErrors.push({ row: index, field: 'ruangan_id', message: `Ruangan wajib diisi (Baris ${rowNumber}, Kolom Ruangan)` });
      } else {
        const ruangan = allRuanganList?.find(r => r.nama.toLowerCase() === namaRuangan.toLowerCase());
        if (!ruangan) {
          cellErrors.push({ row: index, field: 'ruangan_id', message: `Ruangan "${namaRuangan}" tidak ditemukan (Baris ${rowNumber}, Kolom Ruangan)` });
        }
      }
    });

    return { errors, cellErrors };
  };

  // Handler untuk upload file Excel

  // Handler untuk upload file Excel PBL

  // Handle import Excel untuk Praktikum
  const handlePraktikumImportExcel = () => {
    // Langsung show template selection modal (konsisten dengan kuliah besar)
    setShowPraktikumTemplateSelectionModal(true);
  };

  // Handler untuk import Excel praktikum template lama
  const handlePraktikumLamaImportExcel = async (file?: File) => {
    const targetFile = file || praktikumImportFile;
    if (!targetFile) return;

    setIsPraktikumImporting(true);
    setPraktikumImportErrors([]);
    setPraktikumCellErrors([]);
    // setPraktikumImportData([]); // Jangan reset data, biarkan data yang sudah ada

    try {
      // Fetch kelas praktikum terlebih dahulu untuk validasi
      let kelasPraktikumData: string[] = [];
      if (data?.semester) {
        kelasPraktikumData = await fetchKelasPraktikum();
      }

      // Read Excel file
      const { data: rawData, headers } = await readExcelFile(targetFile);
      
      // Validate headers
      const expectedHeaders = ['Tanggal', 'Jam Mulai', 'Materi', 'Topik', 'Kelas Praktikum', 'Dosen', 'Ruangan', 'Sesi'];
      const headerMatch = expectedHeaders.every(header => headers.includes(header));
      
      if (!headerMatch) {
        const missingHeaders = expectedHeaders.filter(header => !headers.includes(header));
        setPraktikumImportErrors(['Format file Excel tidak sesuai dengan template aplikasi. Pastikan kolom sesuai dengan template yang didownload.']);
        setShowPraktikumImportModal(true);
        return;
      }

      // Helper function untuk konversi format jam (menambahkan leading zero)
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

      // Konversi data Excel ke format yang diharapkan
      const convertedData: JadwalPraktikumType[] = rawData.map((row: any[], index: number) => {
        // Convert array row to object using headers
        const rowObj: any = {};
        headers.forEach((header, idx) => {
          rowObj[header] = row[idx] || '';
        });

        // Mapping untuk header baru (Title Case) dan fallback ke header lama (snake_case)
        const tanggal = rowObj['Tanggal'] || rowObj.tanggal || '';
        const jamMulaiRaw = rowObj['Jam Mulai'] || rowObj.jam_mulai || '';
        const jamMulai = convertTimeFormat(jamMulaiRaw);
        const materi = rowObj['Materi'] || rowObj.materi || '';
        const topik = rowObj['Topik'] || rowObj.topik || '';
        const kelasPraktikum = rowObj['Kelas Praktikum'] || rowObj.kelas_praktikum || '';
        const dosen = rowObj['Dosen'] || rowObj.dosen || '';
        const ruangan = rowObj['Ruangan'] || rowObj.ruangan || '';
        const sesi = rowObj['Sesi'] || rowObj.jumlah_sesi || 1;

        // Find dosen data
        const dosenData = allDosenList?.find(d => d.name.toLowerCase() === dosen.toLowerCase());
        
        // Find ruangan data
        const ruanganData = allRuanganList?.find(r => r.nama.toLowerCase() === ruangan.toLowerCase());

        // Calculate jam selesai based on sesi
        const calculatedJamSelesai = hitungJamSelesai(jamMulai, parseInt(sesi.toString()));

        return {
          tanggal: tanggal,
          jam_mulai: jamMulai,
          jam_selesai: calculatedJamSelesai,
          materi: materi,
          topik: topik,
          kelas_praktikum: kelasPraktikum,
          dosen_id: dosenData?.id || 0,
          nama_dosen: dosen || dosenData?.name || '',
          ruangan_id: ruanganData?.id || 0,
          nama_ruangan: ruangan || ruanganData?.nama || '',
          jumlah_sesi: parseInt(sesi.toString())
        };
      });

      // Set data terlebih dahulu
      setPraktikumImportData(convertedData);
      setPraktikumImportFile(targetFile);
      
      // Validate data setelah fetch kelas praktikum selesai
      const { cellErrors } = validatePraktikumExcelData(convertedData, kelasPraktikumData);
      setPraktikumCellErrors(cellErrors);
      
      setShowPraktikumImportModal(true);
    } catch (error) {
      setPraktikumImportErrors(['Gagal membaca file Excel. Pastikan format file benar.']);
      setShowPraktikumImportModal(true);
    } finally {
      setIsPraktikumImporting(false);
      // Reset file input
      if (praktikumFileInputRef.current) {
        praktikumFileInputRef.current.value = '';
      }
    }
  };

  // Handler untuk import Excel praktikum template SIAKAD
  const handlePraktikumSIAKADImportExcel = async (file?: File) => {
    const targetFile = file || praktikumSiakadImportFile;
    if (!targetFile) return;

    setIsPraktikumImporting(true);
    setPraktikumSiakadImportErrors([]);
    setPraktikumSiakadCellErrors([]);
    // setPraktikumSiakadImportData([]); // Jangan reset data, biarkan data yang sudah ada

    try {
      // Fetch kelas praktikum terlebih dahulu untuk validasi
      let kelasPraktikumData: string[] = [];
      if (data?.semester) {
        kelasPraktikumData = await fetchKelasPraktikum();
      }

      // Read Excel file
      const { data: rawData, headers } = await readExcelFile(targetFile);
      
      // Validate template format
      const isValidTemplate = await validateTemplateFormat(targetFile, 'SIAKAD', 'praktikum');
      if (!isValidTemplate) {
        // Debug: Tampilkan headers yang sebenarnya ada di file
        const { headers } = await readExcelFile(targetFile);
        
        setPraktikumSiakadImportErrors([
          'Format file Excel tidak sesuai dengan template SIAKAD. Pastikan kolom sesuai dengan template yang didownload.',
          `Headers found: ${headers.join(', ')}`
        ]);
        setShowPraktikumSiakadImportModal(true);
        return;
      }

      // Konversi data Excel SIAKAD ke format yang diharapkan
      const convertedData: JadwalPraktikumType[] = rawData.map((row: any[], index: number) => {
        // Convert array row to object using headers
        const rowObj: any = {};
        headers.forEach((header, idx) => {
          rowObj[header] = row[idx] || '';
        });

        // Helper function untuk mendapatkan nilai dari berbagai format header
        const getValueFromMultipleFormats = (baseKey: string, rowObj: any) => {
          // Coba format asli dengan \n
          if (rowObj[baseKey]) return rowObj[baseKey];
          
          // Coba format dengan \r\n
          const withWindowsLineBreak = baseKey.replace(/\n/g, '\r\n');
          if (rowObj[withWindowsLineBreak]) return rowObj[withWindowsLineBreak];
          
          // Coba format tanpa line break
          const withoutLineBreak = baseKey.replace(/\n.*/, '');
          if (rowObj[withoutLineBreak]) return rowObj[withoutLineBreak];
          
          return '';
        };

        // Helper function untuk konversi format jam (menambahkan leading zero)
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

        // Mapping untuk template SIAKAD (menggunakan format header yang sebenarnya ada di file Excel)
        const tanggal = getValueFromMultipleFormats('Tanggal\n(YYYY-MM-DD)', rowObj);
        const jamMulaiRaw = getValueFromMultipleFormats('Waktu Mulai\n(Lihat Daftar Waktu Mulai)', rowObj);
        const jamMulai = convertTimeFormat(jamMulaiRaw);
        const topik = rowObj['Topik'] || '';
        const kelasPraktikum = rowObj['Nama Kelas'] || '';
        const kelompok = getValueFromMultipleFormats('Kelompok\n(Contoh: 1)', rowObj);
        const ruangan = getValueFromMultipleFormats('Ruang\n(Lihat Daftar Ruang)', rowObj);
        

        // Find ruangan data
        const ruanganData = allRuanganList?.find(r => r.nama.toLowerCase() === ruangan.toLowerCase());

        // Find kelompok besar data
        const kelompokBesarData = kelompokBesarOptions?.find(kb => kb.label.toLowerCase() === kelompok.toLowerCase());

        // Hitung jam selesai otomatis berdasarkan sistem
        const jumlahSesi = 2; // Default untuk praktikum
        const jamSelesai = hitungJamSelesai(jamMulai, jumlahSesi);

        return {
          tanggal: tanggal,
          jam_mulai: jamMulai,
          jam_selesai: jamSelesai,
          materi: 'Kosong (isi manual)', // User isi manual di preview
          topik: topik,
          kelas_praktikum: kelasPraktikum,
          dosen_id: null, // User isi manual di preview
          nama_dosen: 'Kosong (isi manual)', // User isi manual di preview
          ruangan_id: ruanganData?.id || 0,
          nama_ruangan: ruangan || ruanganData?.nama || '',
          jumlah_sesi: jumlahSesi,
          kelompok_besar_id: kelompokBesarData?.id || null
        };
      });

      // Set data terlebih dahulu
      setPraktikumSiakadImportData(convertedData);
      setPraktikumSiakadImportFile(targetFile);
      
      // Validate data setelah fetch kelas praktikum selesai
      const { cellErrors } = validatePraktikumExcelData(convertedData, kelasPraktikumData);
      setPraktikumSiakadCellErrors(cellErrors);
      
      setShowPraktikumSiakadImportModal(true);
    } catch (error) {
      setPraktikumSiakadImportErrors(['Gagal membaca file Excel. Pastikan format file benar.']);
      setShowPraktikumSiakadImportModal(true);
    } finally {
      setIsPraktikumImporting(false);
      // Reset file input
      if (praktikumFileInputRef.current) {
        praktikumFileInputRef.current.value = '';
      }
    }
  };

  // Handler untuk template selection PBL
  const handlePBLTemplateSelection = (template: 'LAMA' | 'SIAKAD') => {
    setSelectedPBLTemplate(template);
    setShowPBLTemplateSelectionModal(false);
    
    // Selalu buka modal yang sama untuk kedua template
    setShowPBLImportModal(true);
  };

  // Handler untuk menutup template selection modal PBL
  const handlePBLCloseTemplateSelectionModal = () => {
    setShowPBLTemplateSelectionModal(false);
    setSelectedPBLTemplate(null);
    setPBLImportFile(null);
    setPBLImportData([]);
    setPBLImportErrors([]);
    setPBLCellErrors([]);
    setPBLEditingCell(null);
    setPBLImportPage(1);
    if (pblFileInputRef.current) {
      pblFileInputRef.current.value = '';
    }
  };

  // Handler untuk upload file Excel PBL (template aplikasi dan SIAKAD)
  const handlePBLFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      // Set error berdasarkan template yang dipilih
      if (selectedPBLTemplate === 'LAMA') {
      setPBLCellErrors([{ row: 0, field: 'file', message: 'Format file Excel tidak dikenali. Harap gunakan file .xlsx atau .xls' }]);
      setPBLImportFile(file);
      } else {
        setPBLSiakadCellErrors([{ row: 0, field: 'file', message: 'Format file Excel tidak dikenali. Harap gunakan file .xlsx atau .xls' }]);
        setPBLSiakadImportFile(file);
      }
      return;
    }

    // Proses file sesuai template yang dipilih
    if (selectedPBLTemplate === 'LAMA') {
      handlePBLImportExcel(file);
    } else {
      handlePBLSIAKADImportExcel(file);
    }
  };

  const handlePBLImportExcel = async (file?: File) => {
    const targetFile = file || pblImportFile;
    if (!targetFile) return;



    try {

      setIsPBLImporting(true);

    setPBLImportErrors([]);
      setPBLCellErrors([]);

      setPBLImportData([]);



      // Baca file Excel

      const { data: rawData, headers }: { data: any[], headers: string[] } = await readExcelFile(file);

      

      if (rawData.length === 0) {

        setPBLCellErrors([{ row: 0, field: 'file', message: 'File Excel kosong atau tidak valid' }]);

        return;

      }



      // Helper function untuk konversi format jam (menambahkan leading zero)
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

      // Konversi data Excel ke format yang diharapkan

      const convertedData: JadwalPBLType[] = rawData.map((row: any[], index: number) => {
        // Convert array row to object using headers
        const rowObj: any = {};
        headers.forEach((header, idx) => {
          rowObj[header] = row[idx] || '';
        });

        // Mapping untuk header baru (Title Case) dan fallback ke header lama (snake_case)
        const tanggal = rowObj['Tanggal'] || rowObj.tanggal || '';
        const jamMulaiRaw = rowObj['Jam Mulai'] || rowObj.jam_mulai || '';
        const jamMulai = convertTimeFormat(jamMulaiRaw);
        const modulPBL = rowObj['Modul PBL'] || rowObj.modul_pbl || '';
        const kelompokKecil = rowObj['Kelompok Kecil'] || rowObj.kelompok_kecil || '';
        const dosen = rowObj['Dosen'] || rowObj.dosen || '';
        const ruangan = rowObj['Ruangan'] || rowObj.ruangan || '';
        const pblTipe = rowObj['PBL Tipe'] || rowObj.pbl_tipe || 'PBL 1';
        

        // Cari modul PBL berdasarkan nama

        const modulPBLData = modulPBLList?.find(m => 
          m.nama_modul.toLowerCase().includes(modulPBL.toLowerCase()) ||
          modulPBL.toLowerCase().includes(m.nama_modul.toLowerCase())
        );



        // Cari kelompok kecil berdasarkan nama

        const kelompokKecilData = kelompokKecilList?.find(k => 
          k.nama_kelompok.toLowerCase() === kelompokKecil.toLowerCase()
        );



        // Cari dosen berdasarkan nama

        const dosenData = allDosenList?.find(d => 
          d.name.toLowerCase() === dosen.toLowerCase()
        );
        
        // Cek apakah dosen valid (assigned dosen atau standby)
        let isValidDosen = false;
        if (dosenData) {
          const isAssignedDosen = assignedDosenPBL?.some(d => d.id === dosenData.id);
          const isStandbyDosen = dosenData.name.toLowerCase().includes('standby');
          isValidDosen = isAssignedDosen || isStandbyDosen;
        }


        // Cari ruangan berdasarkan nama

        const ruanganData = allRuanganList?.find(r => 
          r.nama.toLowerCase() === ruangan.toLowerCase()
        );



        // Hitung jam selesai berdasarkan PBL tipe
        const jumlahSesi = pblTipe === 'PBL 2' ? 3 : 2;
        const calculatedJamSelesai = hitungJamSelesai(jamMulai || '08:00', jumlahSesi);


        return {

          tanggal: tanggal,
          jam_mulai: jamMulai,
          jam_selesai: calculatedJamSelesai,
          modul_pbl_id: modulPBLData?.id || 0,
          nama_modul: modulPBL || modulPBLData?.nama_modul || '', // Set nama_modul field
          kelompok_kecil_id: kelompokKecilData?.id || 0,
          nama_kelompok: kelompokKecil || kelompokKecilData?.nama_kelompok || '', // Set nama_kelompok field
          dosen_id: isValidDosen ? (dosenData?.id || 0) : 0,
          nama_dosen: dosen || dosenData?.name || '', // Set nama_dosen field
          ruangan_id: ruanganData?.id || 0,
          nama_ruangan: ruangan || ruanganData?.nama || '', // Set nama_ruangan field
          pbl_tipe: pblTipe,
          jumlah_sesi: jumlahSesi

        };

      });



      // Validasi data

      const { cellErrors } = validatePBLExcelData(convertedData);

      

      setPBLCellErrors(cellErrors);

      setPBLImportData(convertedData);

      setPBLImportFile(file);

      setShowPBLImportModal(true);

    } catch (error) {

      setPBLCellErrors([{ row: 0, field: 'file', message: 'Gagal membaca file Excel. Pastikan format file benar.' }]);

    } finally {

      setIsPBLImporting(false);

      // Reset file input

      if (pblFileInputRef.current) {

        pblFileInputRef.current.value = '';

      }

    }

  };

  // Handler untuk import Excel template SIAKAD PBL dari input file
  const handlePBLSIAKADImportExcelFromInput = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await handlePBLSIAKADImportExcel(file);
  };

  // Handler untuk import Excel template SIAKAD PBL
  const handlePBLSIAKADImportExcel = async (file?: File) => {
    const targetFile = file || pblSiakadImportFile;
    if (!targetFile) return;

    setIsPBLImporting(true);
    setPBLSiakadImportErrors([]);
    setPBLSiakadCellErrors([]);

    try {
      // Read Excel file
      const { data: rawData, headers } = await readExcelFile(targetFile);
      
      // Validate template format
      const isValidTemplate = await validateTemplateFormat(targetFile, 'SIAKAD', 'pbl');
      if (!isValidTemplate) {
        // Debug: Tampilkan headers yang sebenarnya ada di file
        const { headers } = await readExcelFile(targetFile);
        
        setPBLSiakadImportErrors([
          'Format file Excel tidak sesuai dengan template SIAKAD. Pastikan kolom sesuai dengan template yang didownload.',
          `Headers found: ${headers.join(', ')}`
        ]);
        setPBLSiakadImportFile(targetFile);
        setShowPBLImportModal(true);
        return;
      }

      // Konversi data Excel SIAKAD ke format yang diharapkan
      const convertedData: JadwalPBLType[] = rawData.map((row: any[], index: number) => {
        // Convert array row to object using headers
        const rowObj: any = {};
        headers.forEach((header, idx) => {
          rowObj[header] = row[idx] || '';
        });

        // Helper function untuk mendapatkan nilai dari berbagai format header
        const getValueFromMultipleFormats = (baseKey: string, rowObj: any) => {
          // Coba format asli dengan \n
          if (rowObj[baseKey]) return rowObj[baseKey];
          
          // Coba format dengan \r\n
          const withWindowsLineBreak = baseKey.replace(/\n/g, '\r\n');
          if (rowObj[withWindowsLineBreak]) return rowObj[withWindowsLineBreak];
          
          // Coba format tanpa line break
          const withoutLineBreak = baseKey.replace(/\n.*/, '');
          if (rowObj[withoutLineBreak]) return rowObj[withoutLineBreak];
          
          return '';
        };

        // Helper function untuk konversi format jam (menambahkan leading zero)
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

        // Mapping untuk template SIAKAD PBL
        const tanggal = getValueFromMultipleFormats('Tanggal\n(YYYY-MM-DD)', rowObj);
        const jamMulaiRaw = getValueFromMultipleFormats('Waktu Mulai\n(Lihat Daftar Waktu Mulai)', rowObj);
        const jamMulai = convertTimeFormat(jamMulaiRaw);
        const topik = rowObj['Topik'] || '';
        const namaKelas = rowObj['Nama Kelas'] || '';
        const kelompok = getValueFromMultipleFormats('Kelompok\n(Contoh: 1)', rowObj);
        const ruangan = getValueFromMultipleFormats('Ruang\n(Lihat Daftar Ruang)', rowObj);
        const nipPengajar = rowObj['NIP Pengajar'] || '';

        // Find ruangan data
        const ruanganData = allRuanganList?.find(r => r.nama.toLowerCase() === ruangan.toLowerCase());

        // Find kelompok kecil data berdasarkan kelompok saja
        const kelompokKecilData = kelompokKecilList?.find(k => 
          k.nama_kelompok.toLowerCase() === kelompok.toLowerCase()
        );

        // Find dosen data berdasarkan NID
        const dosenData = allDosenList?.find(d => d.nid === nipPengajar);

        // Hitung jam selesai otomatis berdasarkan PBL tipe (default PBL 1 = 2 sesi)
        const pblTipe = 'PBL 1'; // Default untuk SIAKAD template
        const jumlahSesi = 2; // Default untuk PBL 1
        const calculatedJamSelesai = hitungJamSelesai(jamMulai || '08:00', jumlahSesi);

        return {
          tanggal: tanggal,
          jam_mulai: jamMulai,
          jam_selesai: calculatedJamSelesai,
          modul_pbl_id: 0, // User isi manual di preview
          nama_modul: 'Kosong (isi manual)', // User isi manual di preview
          kelompok_kecil_id: kelompokKecilData?.id || 0,
          nama_kelompok: kelompokKecilData?.nama_kelompok || kelompok,
          dosen_id: dosenData?.id || null, // User isi manual di preview
          nama_dosen: dosenData?.name || 'Kosong (isi manual)', // User isi manual di preview
          ruangan_id: ruanganData?.id || 0,
          nama_ruangan: ruangan || ruanganData?.nama || '',
          pbl_tipe: pblTipe, // Default PBL 1
          jumlah_sesi: jumlahSesi
        };
      });

      // Set data
      setPBLSiakadImportData(convertedData);
      setPBLSiakadImportFile(targetFile);
      
      // Validate data
      const { cellErrors } = validatePBLExcelData(convertedData);
      setPBLSiakadCellErrors(cellErrors);
      
      setShowPBLImportModal(true);
    } catch (error) {
      setPBLSiakadCellErrors([{ 
        row: 0, 
        field: 'file', 
        message: 'Gagal membaca file Excel. Pastikan format file benar.' 
      }]);
      setShowPBLImportModal(true);
    } finally {
      setIsPBLImporting(false);
      // Reset file input
      if (pblSiakadFileInputRef.current) {
        pblSiakadFileInputRef.current.value = '';
      }
    }
  };

  // Fungsi untuk validasi format template
  const validateTemplateFormat = async (file: File, expectedFormat: 'LAMA' | 'SIAKAD', type: 'kuliah-besar' | 'praktikum' | 'pbl' | 'agenda-khusus' = 'kuliah-besar'): Promise<boolean> => {
    try {
      const { headers } = await readExcelFile(file);
      
      if (expectedFormat === 'LAMA') {
        if (type === 'kuliah-besar') {
           // Template lama kuliah besar harus memiliki header: Tanggal, Jam Mulai, Materi, Dosen, Ruangan, Kelompok Besar
           const requiredHeaders = ['Tanggal', 'Jam Mulai', 'Materi', 'Dosen', 'Ruangan', 'Kelompok Besar'];
          const isValid = requiredHeaders.every(header => headers.includes(header));
          return isValid;
        } else if (type === 'praktikum') {
          // Template lama praktikum harus memiliki header: Tanggal, Jam Mulai, Materi, Topik, Kelas Praktikum, Dosen, Ruangan, Sesi
          const requiredHeaders = ['Tanggal', 'Jam Mulai', 'Materi', 'Topik', 'Kelas Praktikum', 'Dosen', 'Ruangan', 'Sesi'];
          const isValid = requiredHeaders.every(header => headers.includes(header));
          return isValid;
        } else if (type === 'pbl') {
          // Template lama PBL harus memiliki header: Tanggal, Jam Mulai, Modul PBL, Kelompok Kecil, Dosen, Ruangan, PBL Tipe
          const requiredHeaders = ['Tanggal', 'Jam Mulai', 'Modul PBL', 'Kelompok Kecil', 'Dosen', 'Ruangan', 'PBL Tipe'];
          const isValid = requiredHeaders.every(header => headers.includes(header));
          return isValid;
        } else if (type === 'agenda-khusus') {
          // Template lama agenda khusus harus memiliki header: Tanggal, Jam Mulai, Agenda, Ruangan, Kelompok Besar, Jumlah Sesi
          const requiredHeaders = ['Tanggal', 'Jam Mulai', 'Agenda', 'Ruangan', 'Kelompok Besar', 'Jumlah Sesi'];
          const isValid = requiredHeaders.every(header => headers.includes(header));
          return isValid;
        }
      } else if (expectedFormat === 'SIAKAD') {
        if (type === 'kuliah-besar') {
          // Template SIAKAD kuliah besar harus memiliki header yang sesuai dengan format SIAKAD
          const requiredHeaders = [
            'Tanggal\n(YYYY-MM-DD)', 
            'Waktu Mulai\n(Lihat Daftar Waktu Mulai)', 
            'Topik', 
            'NIP Pengajar', 
            'Ruang\n(Lihat Daftar Ruang)'
          ];
          
          // DEBUG: Log detail validasi untuk kuliah besar
          
          // Fungsi untuk mengecek header dengan berbagai format line break
          const checkHeaderExists = (requiredHeader: string) => {
            // Cek format asli
            if (headers.includes(requiredHeader)) return true;
            
            // Cek format tanpa line break (Template 1)
            const withoutLineBreak = requiredHeader.replace(/\n.*/, '');
            if (headers.includes(withoutLineBreak)) return true;
            
            // Cek format dengan \r\n (Template 2 & 3)
            const withWindowsLineBreak = requiredHeader.replace(/\n/g, '\r\n');
            if (headers.includes(withWindowsLineBreak)) return true;
            
            // Cek format dengan \r\n dan tanpa parenthetical
            const withWindowsLineBreakNoParenthetical = withWindowsLineBreak.replace(/\([^)]*\)/g, '');
            if (headers.includes(withWindowsLineBreakNoParenthetical.trim())) return true;
            
            return false;
          };
          
          requiredHeaders.forEach(requiredHeader => {
            const found = checkHeaderExists(requiredHeader);
            
            // Debug: cek berbagai format
            const withoutLineBreak = requiredHeader.replace(/\n.*/, '');
            const withWindowsLineBreak = requiredHeader.replace(/\n/g, '\r\n');
          });
          
          const isValid = requiredHeaders.every(header => checkHeaderExists(header));
          
          return isValid;
        } else if (type === 'praktikum') {
          // Template SIAKAD praktikum harus memiliki header yang sesuai dengan format SIAKAD
          // Headers dengan format yang sebenarnya ada di file Excel (dengan \n untuk line break)
          const requiredHeaders = [
            'Kurikulum',
            'Kode MK',
            'Nama Kelas',
            'Kelompok\n(Contoh: 1)',
            'Topik',
            'Substansi\n(Lihat Daftar Substansi)', // Header tambahan yang ada di file Excel
            'Jenis Pertemuan\n(Lihat Daftar Jenis Pertemuan)',
            'Metode\n(Lihat Daftar Metode)',
            'Ruang\n(Lihat Daftar Ruang)',
            'NIP Pengajar',
            'Dosen Pengganti\n(Y jika Ya)',
            'Tanggal\n(YYYY-MM-DD)',
            'Waktu Mulai\n(Lihat Daftar Waktu Mulai)',
            'Waktu Selesai\n(Lihat Daftar Waktu Selesai)'
          ];
          
          // DEBUG: Log detail validasi untuk praktikum
          
          // Fungsi untuk mengecek header dengan berbagai format line break
          const checkHeaderExists = (requiredHeader: string) => {
            // Cek format asli
            if (headers.includes(requiredHeader)) return true;
            
            // Cek format tanpa line break
            const withoutLineBreak = requiredHeader.replace(/\n.*/, '');
            if (headers.includes(withoutLineBreak)) return true;
            
            // Cek format dengan \r\n
            const withWindowsLineBreak = requiredHeader.replace(/\n/g, '\r\n');
            if (headers.includes(withWindowsLineBreak)) return true;
            
            // Cek format dengan \r\n dan tanpa parenthetical
            const withWindowsLineBreakNoParenthetical = withWindowsLineBreak.replace(/\([^)]*\)/g, '');
            if (headers.includes(withWindowsLineBreakNoParenthetical.trim())) return true;
            
            return false;
          };
          
          requiredHeaders.forEach(requiredHeader => {
            const found = checkHeaderExists(requiredHeader);
            
            // Debug: cek berbagai format
            const withoutLineBreak = requiredHeader.replace(/\n.*/, '');
            const withWindowsLineBreak = requiredHeader.replace(/\n/g, '\r\n');
          });
          
          const isValid = requiredHeaders.every(header => checkHeaderExists(header));
          
          return isValid;
        } else if (type === 'pbl') {
          // Template SIAKAD PBL harus memiliki header yang sesuai dengan format SIAKAD
          const requiredHeaders = [
            'Kurikulum',
            'Kode MK',
            'Nama Kelas',
            'Kelompok\n(Contoh: 1)',
            'Topik',
            'Substansi\n(Lihat Daftar Substansi)',
            'Jenis Pertemuan\n(Lihat Daftar Jenis Pertemuan)',
            'Metode\n(Lihat Daftar Metode)',
            'Ruang\n(Lihat Daftar Ruang)',
            'NIP Pengajar',
            'Dosen Pengganti\n(Y jika Ya)',
            'Tanggal\n(YYYY-MM-DD)',
            'Waktu Mulai\n(Lihat Daftar Waktu Mulai)',
            'Waktu Selesai\n(Lihat Daftar Waktu Selesai)'
          ];
          
          // DEBUG: Log detail validasi untuk PBL
          
          // Fungsi untuk mengecek header dengan berbagai format line break
          const checkHeaderExists = (requiredHeader: string) => {
            // Cek format asli
            if (headers.includes(requiredHeader)) return true;
            
            // Cek format tanpa line break
            const withoutLineBreak = requiredHeader.replace(/\n.*/, '');
            if (headers.includes(withoutLineBreak)) return true;
            
            // Cek format dengan \r\n
            const withWindowsLineBreak = requiredHeader.replace(/\n/g, '\r\n');
            if (headers.includes(withWindowsLineBreak)) return true;
            
            // Cek format dengan \r\n dan tanpa parenthetical
            const withWindowsLineBreakNoParenthetical = withWindowsLineBreak.replace(/\([^)]*\)/g, '');
            if (headers.includes(withWindowsLineBreakNoParenthetical.trim())) return true;
            
            return false;
          };
          
          requiredHeaders.forEach(requiredHeader => {
            const found = checkHeaderExists(requiredHeader);
            
            // Debug: cek berbagai format
            const withoutLineBreak = requiredHeader.replace(/\n.*/, '');
            const withWindowsLineBreak = requiredHeader.replace(/\n/g, '\r\n');
          });
          
          const isValid = requiredHeaders.every(header => checkHeaderExists(header));
          
          return isValid;
        }
      }
      
      return false;
    } catch (error) {
      return false;
    }
  };

  // Handler untuk template selection
  const handleTemplateSelection = (template: 'LAMA' | 'SIAKAD') => {
    setSelectedTemplate(template);
    setShowTemplateSelectionModal(false);
    
    // Selalu buka modal yang sama untuk kedua template
      setShowImportModal(true);
  };

  // Handler untuk template selection praktikum
  const handlePraktikumTemplateSelection = (template: 'LAMA' | 'SIAKAD') => {
    setSelectedPraktikumTemplate(template);
    setShowPraktikumTemplateSelectionModal(false);
    
    // Selalu buka modal yang sama untuk kedua template
    setShowPraktikumImportModal(true);
  };

  // Handler untuk menutup template selection modal
  const handlePraktikumCloseTemplateSelectionModal = () => {
    setShowPraktikumTemplateSelectionModal(false);
    setSelectedPraktikumTemplate(null);
    // Tidak menghapus data untuk file persistence
  };

  // Handler untuk upload file Excel praktikum Template Aplikasi
  const handlePraktikumFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setPraktikumImportErrors(['Format file Excel tidak dikenali. Harap gunakan file .xlsx atau .xls']);
      setPraktikumImportFile(file);
      return;
    }

    // Proses file template aplikasi
      handlePraktikumLamaImportExcel(file);
  };

  // Handler untuk upload file Excel praktikum SIAKAD
  const handlePraktikumSiakadFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.name.toLowerCase().endsWith('.xlsx') && !file.name.toLowerCase().endsWith('.xls')) {
      setPraktikumSiakadImportErrors(['Format file Excel tidak dikenali. Harap gunakan file .xlsx atau .xls']);
      setPraktikumSiakadImportFile(file);
      return;
    }

    // Proses file SIAKAD
    handlePraktikumSIAKADImportExcel(file);
  };

  // Handler untuk import Excel kuliah besar (template aplikasi dan SIAKAD)
  const handleImportExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Refresh data kelompok besar terlebih dahulu
    await fetchBatchData();

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      // Set error berdasarkan template yang dipilih
      if (selectedTemplate === 'LAMA') {
      setImportErrors(['File harus berformat Excel (.xlsx atau .xls)']);
      } else {
        setSiakadImportErrors(['File harus berformat Excel (.xlsx atau .xls)']);
      }
      setShowImportModal(true);
      return;
    }

    // Validasi template berdasarkan template yang dipilih
    const templateType = selectedTemplate === 'LAMA' ? 'LAMA' : 'SIAKAD';
    const isValidTemplate = await validateTemplateFormat(file, templateType);
    if (!isValidTemplate) {
      // Set error berdasarkan template yang dipilih
      if (selectedTemplate === 'LAMA') {
      setImportErrors(['Template tidak valid. Pastikan menggunakan template dari aplikasi ini.']);
      } else {
        setSiakadImportErrors(['Template tidak valid. Pastikan menggunakan template SIAKAD yang benar.']);
      }
      setShowImportModal(true);
      return;
    }

    // Jika file yang dipilih sama dengan file sebelumnya dan sudah ada data yang diedit,
    // tidak perlu memproses ulang file
    const currentFile = selectedTemplate === 'LAMA' ? importFile : siakadImportFile;
    const currentData = selectedTemplate === 'LAMA' ? importData : siakadImportData;
    
    const isSameFile = currentFile && 
      currentFile.name === file.name && 
      currentFile.size === file.size && 
      currentFile.lastModified === file.lastModified;

    if (isSameFile && currentData.length > 0) {
      // File sama dan sudah ada data, langsung buka modal dengan data yang sudah ada
      setShowImportModal(true);
      return;
    }

    // Jika file berbeda, reset data sebelumnya
    if (currentFile && !isSameFile) {
      if (selectedTemplate === 'LAMA') {
        resetImportData();
      } else {
        resetSIAKADImportData();
      }
    }

    // Set file dan error berdasarkan template yang dipilih
    if (selectedTemplate === 'LAMA') {
    setImportFile(file);
    setImportErrors([]);
    } else {
      setSiakadImportFile(file);
      setSiakadImportErrors([]);
    }

    

    try {

      const { data: excelData, headers } = await readExcelFile(file);
      

      if (excelData.length === 0) {
        // Set error berdasarkan template yang dipilih
        if (selectedTemplate === 'LAMA') {
        setImportErrors(['File Excel kosong atau tidak memiliki data']);
        } else {
          setSiakadImportErrors(['File Excel kosong atau tidak memiliki data']);
        }
        setShowImportModal(true);
        return;
      }



      // Helper function untuk konversi format jam (menambahkan leading zero)
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

      // Proses data berdasarkan template yang dipilih
      if (selectedTemplate === 'LAMA') {
        // Konversi ke format JadwalKuliahBesarType menggunakan format legacy
        const convertedData: JadwalKuliahBesarType[] = excelData.map(row => {
          const namaDosen = row[4].toString().trim();
          const namaRuangan = row[5].toString().trim();
          const kelompokBesarId = parseInt(row[6]);
          const jumlahSesi = parseInt(row[7]) || 2;
          const jamMulaiRaw = row[1].toString();
          const jamMulai = convertTimeFormat(jamMulaiRaw);

          const dosen = dosenList.find(d => d.name.toLowerCase() === namaDosen.toLowerCase());
          const ruangan = ruanganList.find(r => r.nama.toLowerCase() === namaRuangan.toLowerCase());

          // Hitung jam selesai otomatis berdasarkan sistem
          const jamSelesai = hitungJamSelesai(jamMulai, jumlahSesi);

        return {
            tanggal: row[0].toString(),
            jam_mulai: jamMulai,
            jam_selesai: jamSelesai,
            materi: row[2].toString(),
            topik: row[3] ? row[3].toString() : '',
            dosen_id: dosen?.id || 0,
            nama_dosen: namaDosen,
            ruangan_id: ruangan?.id || 0,
            nama_ruangan: namaRuangan,
            kelompok_besar_id: kelompokBesarId || 1,
            jumlah_sesi: jumlahSesi
          };
      });

      // Validasi data setelah konversi
      const validationResult = validateExcelData(convertedData, jadwalKuliahBesar);
      setImportErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors);
      setImportData(convertedData);
      } else {
        // Proses data SIAKAD - panggil handler SIAKAD langsung dengan file
        // Buat event object sederhana untuk handler SIAKAD
        const fakeEvent = {
          target: { files: [file] }
        } as unknown as ChangeEvent<HTMLInputElement>;
        await handleSIAKADImportExcel(fakeEvent);
        return;
      }

      setShowImportModal(true);

    } catch (error) {
      // Set error berdasarkan template yang dipilih
      if (selectedTemplate === 'LAMA') {
      setImportErrors(['Gagal membaca file Excel: ' + (error as Error).message]);
      } else {
        setSiakadImportErrors(['Gagal membaca file Excel: ' + (error as Error).message]);
      }
      setShowImportModal(true);
    } finally {

      if (fileInputRef.current) {

        fileInputRef.current.value = '';

      }

    }

  };

  // Handler untuk import Excel template SIAKAD
  const handleSIAKADImportExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;


    // Refresh data kelompok besar terlebih dahulu
    await fetchBatchData();

    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setSiakadImportErrors(['File harus berformat Excel (.xlsx atau .xls)']);
      setShowSIAKADImportModal(true);
      return;
    }

    // Validasi template
    const isValidTemplate = await validateTemplateFormat(file, 'SIAKAD');
    if (!isValidTemplate) {
      // Debug: Tampilkan headers yang sebenarnya ada di file
      const { headers } = await readExcelFile(file);
      
      setSiakadImportFile(file);
      setSiakadImportErrors([
        'Format file Excel tidak sesuai dengan template SIAKAD. Pastikan kolom sesuai dengan template yang didownload.',
        `Headers found: ${headers.join(', ')}`
      ]);
      setShowSIAKADImportModal(true);
      return;
    }

    // Jika file yang dipilih sama dengan file sebelumnya dan sudah ada data yang diedit,
    // tidak perlu memproses ulang file
    const isSameFile = siakadImportFile && 
      siakadImportFile.name === file.name && 
      siakadImportFile.size === file.size && 
      siakadImportFile.lastModified === file.lastModified;

    if (isSameFile && siakadImportData.length > 0) {
      // File sama dan sudah ada data, langsung buka modal dengan data yang sudah ada
      setShowSIAKADImportModal(true);
      return;
    }

    // Jika file berbeda, reset data sebelumnya
    if (siakadImportFile && !isSameFile) {
      resetSIAKADImportData();
    }

    setSiakadImportFile(file);
    setSiakadImportErrors([]);

    try {
      const { data: rawData, headers } = await readExcelFile(file);

      // DEBUG: Log data yang dibaca dari file Excel

      if (rawData.length === 0) {
        setSiakadImportErrors(['File Excel kosong atau tidak memiliki data']);
        setShowSIAKADImportModal(true);
        return;
      }

      // Konversi data SIAKAD ke format aplikasi
      const convertedData: JadwalKuliahBesarType[] = rawData.map((row: any[], index: number) => {
        const rowObj: any = {};
        headers.forEach((header, idx) => {
          rowObj[header] = row[idx] || '';
        });

        // DEBUG: Log konversi data untuk baris pertama
        if (index === 0) {
        }

        // Helper function untuk mendapatkan nilai dari berbagai format header
        const getValueFromMultipleFormats = (baseKey: string, rowObj: any) => {
          // Coba format asli dengan \n
          if (rowObj[baseKey]) return rowObj[baseKey];
          
          // Coba format dengan \r\n
          const withWindowsLineBreak = baseKey.replace(/\n/g, '\r\n');
          if (rowObj[withWindowsLineBreak]) return rowObj[withWindowsLineBreak];
          
          // Coba format tanpa line break
          const withoutLineBreak = baseKey.replace(/\n.*/, '');
          if (rowObj[withoutLineBreak]) return rowObj[withoutLineBreak];
          
          return '';
        };

        // Helper function untuk konversi format jam (menambahkan leading zero)
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

        const tanggal = getValueFromMultipleFormats('Tanggal\n(YYYY-MM-DD)', rowObj);
        const jamMulaiRaw = getValueFromMultipleFormats('Waktu Mulai\n(Lihat Daftar Waktu Mulai)', rowObj);
        const jamMulai = convertTimeFormat(jamMulaiRaw);
        const topik = rowObj['Topik'] || '';
        const namaRuangan = getValueFromMultipleFormats('Ruang\n(Lihat Daftar Ruang)', rowObj);
        const kelompokBesarId = getValueFromMultipleFormats('Kelompok\n(Contoh: 1)', rowObj);

        // DEBUG: Log nilai yang diekstrak untuk baris pertama
        if (index === 0) {
        }

        // Cari ruangan berdasarkan nama
        const ruangan = ruanganList.find(r => r.nama.toLowerCase() === namaRuangan.toLowerCase());

        // Hitung jam selesai otomatis berdasarkan sistem
        const jumlahSesi = 2; // Default 2 sesi
        const jamSelesai = hitungJamSelesai(jamMulai, jumlahSesi);

        return {
          tanggal: tanggal,
          jam_mulai: jamMulai,
          jam_selesai: jamSelesai,
          materi: 'Kosong (isi manual)', // Dikosongkan untuk template SIAKAD
          topik: topik,
          dosen_id: null, // Dikosongkan untuk template SIAKAD (akan diisi manual setelah import)
          nama_dosen: null, // Dikosongkan untuk template SIAKAD
          ruangan_id: ruangan?.id || 0,
          nama_ruangan: namaRuangan || 'Kosong (isi manual)',
          kelompok_besar_id: kelompokBesarId ? parseInt(kelompokBesarId) : 0,
          jumlah_sesi: jumlahSesi
        };
      });

      // Validasi data setelah konversi
      const validationResult = validateExcelData(convertedData, jadwalKuliahBesar);
      setSiakadImportErrors(validationResult.errors);
      setSiakadCellErrors(validationResult.cellErrors);

      setSiakadImportData(convertedData);

    } catch (error) {
      setSiakadImportErrors(['Gagal membaca file Excel: ' + (error as Error).message]);
      setShowSIAKADImportModal(true);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };



  // Handler untuk submit import
  // Handler untuk submit import PBL
  // Submit import Excel untuk Praktikum
  const handlePraktikumSubmitImport = async () => {
    const currentData = selectedPraktikumTemplate === 'LAMA' ? praktikumImportData : praktikumSiakadImportData;
    if (!kode || currentData.length === 0) return;

    setIsPraktikumImporting(true);
    if (selectedPraktikumTemplate === 'LAMA') {
    setPraktikumImportErrors([]);
    } else {
      setPraktikumSiakadImportErrors([]);
    }

    try {
      // Final validation
      const { cellErrors } = validatePraktikumExcelData(currentData);
      if (cellErrors.length > 0) {
        if (selectedPraktikumTemplate === 'LAMA') {
        setPraktikumCellErrors(cellErrors);
        } else {
          setPraktikumSiakadCellErrors(cellErrors);
        }
        setIsPraktikumImporting(false);
        return;
      }

        // Transform data for API
        const apiData = currentData.map(row => {
          // Untuk template SIAKAD, konversi nama ruangan/dosen ke ID
          let dosenId = row.dosen_id;
          let ruanganId = row.ruangan_id;
          
          if (selectedPraktikumTemplate === 'SIAKAD') {
            // Cari dosen berdasarkan nama
            const dosen = pengampuPraktikumOptions.find(d => d.name === row.nama_dosen);
            if (dosen) dosenId = dosen.id;
            
            // Cari ruangan berdasarkan nama
            const ruangan = ruanganList.find(r => r.nama === row.nama_ruangan);
            if (ruangan) ruanganId = ruangan.id;
          }
          
          return {
          tanggal: row.tanggal,
          jam_mulai: row.jam_mulai,
          jam_selesai: row.jam_selesai,
          sesi: row.jumlah_sesi, // Backend mengharapkan field 'sesi'
          materi: row.materi,
          topik: row.topik,
          kelas_praktikum: row.kelas_praktikum,
            dosen_id: dosenId,
            ruangan_id: ruanganId,
          jumlah_sesi: row.jumlah_sesi
          };
        });

      // Send to API
      const response = await api.post(`/praktikum/jadwal/${kode}/import`, {
        data: apiData
      });

      if (response.data.success) {
        setPraktikumImportedCount(currentData.length);
        setShowPraktikumImportModal(false);
        setShowPraktikumTemplateSelectionModal(false);
        // Reset semua data setelah import berhasil
        if (selectedPraktikumTemplate === 'LAMA') {
          setPraktikumImportData([]);
          setPraktikumImportErrors([]);
          setPraktikumCellErrors([]);
          setPraktikumEditingCell(null);
          setPraktikumImportFile(null);
          if (praktikumFileInputRef.current) {
            praktikumFileInputRef.current.value = '';
          }
        } else {
          setPraktikumSiakadImportData([]);
          setPraktikumSiakadImportErrors([]);
          setPraktikumSiakadCellErrors([]);
          setPraktikumSiakadEditingCell(null);
          setPraktikumSiakadImportFile(null);
          if (praktikumSiakadFileInputRef.current) {
            praktikumSiakadFileInputRef.current.value = '';
          }
        }
        setPraktikumImportPage(1);
        setSelectedPraktikumTemplate(null);
        await fetchBatchData(); // Refresh data
      } else {
        if (selectedPraktikumTemplate === 'LAMA') {
        setPraktikumImportErrors([response.data.message || 'Terjadi kesalahan saat mengimport data']);
        } else {
          setPraktikumSiakadImportErrors([response.data.message || 'Terjadi kesalahan saat mengimport data']);
        }
        // Tidak import data jika ada error - all or nothing
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        // Handle validation errors
        const errorData = error.response.data;
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const cellErrors = errorData.errors.map((err: string, idx: number) => ({
            row: idx + 1,
            field: 'general',
            message: err
          }));
          if (selectedPraktikumTemplate === 'LAMA') {
          setPraktikumCellErrors(cellErrors);
        } else {
            setPraktikumSiakadCellErrors(cellErrors);
          }
        } else {
          if (selectedPraktikumTemplate === 'LAMA') {
          setPraktikumImportErrors([errorData.message || 'Terjadi kesalahan validasi']);
          } else {
            setPraktikumSiakadImportErrors([errorData.message || 'Terjadi kesalahan validasi']);
          }
        }
      } else {
        if (selectedPraktikumTemplate === 'LAMA') {
        setPraktikumImportErrors([error.response?.data?.message || 'Terjadi kesalahan saat mengimport data']);
        } else {
          setPraktikumSiakadImportErrors([error.response?.data?.message || 'Terjadi kesalahan saat mengimport data']);
        }
      }
    } finally {
      setIsPraktikumImporting(false);
    }
  };

  const handlePBLSubmitImport = async () => {
    const currentData = selectedPBLTemplate === 'LAMA' ? pblImportData : pblSiakadImportData;
    const currentErrors = selectedPBLTemplate === 'LAMA' ? pblCellErrors : pblSiakadCellErrors;
    const currentImportErrors = selectedPBLTemplate === 'LAMA' ? pblImportErrors : pblSiakadImportErrors;
    
    if (currentData.length === 0) return;

    setIsPBLImporting(true);
    if (selectedPBLTemplate === 'LAMA') {
      setPBLImportErrors([]);
    } else {
      setPBLSiakadImportErrors([]);
    }

    try {
      // Final validation
      const { cellErrors } = validatePBLExcelData(currentData);
      if (cellErrors.length > 0) {
        if (selectedPBLTemplate === 'LAMA') {
          setPBLCellErrors(cellErrors);
        } else {
          setPBLSiakadCellErrors(cellErrors);
        }
        setIsPBLImporting(false);
        return;
      }

      const response = await api.post(`/mata-kuliah/${kode}/jadwal-pbl/import`, {
        data: currentData
      });

      if (response.data.success) {
        if (selectedPBLTemplate === 'LAMA') {
          setPBLImportedCount(response.data.success || currentData.length);
        } else {
          setPBLSiakadImportedCount(response.data.success || currentData.length);
        }
        setShowPBLImportModal(false);
        if (selectedPBLTemplate === 'LAMA') {
        setPBLImportData([]);
        setPBLImportFile(null);
          setPBLImportErrors([]);
        setPBLCellErrors([]);
        setPBLEditingCell(null);
        setPBLImportPage(1);
        } else {
          setPBLSiakadImportData([]);
          setPBLSiakadImportFile(null);
          setPBLSiakadImportErrors([]);
          setPBLSiakadCellErrors([]);
          setPBLSiakadEditingCell(null);
          setPBLSiakadImportPage(1);
        }
        await fetchBatchData(); // Refresh data
      } else {
        if (selectedPBLTemplate === 'LAMA') {
          setPBLImportErrors([response.data.message || 'Terjadi kesalahan saat mengimport data']);
        } else {
          setPBLSiakadImportErrors([response.data.message || 'Terjadi kesalahan saat mengimport data']);
        }
        // Tidak import data jika ada error - all or nothing
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        // Handle validation errors
        const errorData = error.response.data;
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const cellErrors = errorData.errors.map((err: string, idx: number) => ({
            row: idx + 1,
            field: 'api',
            message: err
          }));
          if (selectedPBLTemplate === 'LAMA') {
          setPBLCellErrors(cellErrors);
        } else {
            setPBLSiakadCellErrors(cellErrors);
        }
      } else {
          if (selectedPBLTemplate === 'LAMA') {
            setPBLImportErrors([errorData.message || 'Terjadi kesalahan validasi']);
          } else {
            setPBLSiakadImportErrors([errorData.message || 'Terjadi kesalahan validasi']);
          }
        }
      } else {
        if (selectedPBLTemplate === 'LAMA') {
          setPBLImportErrors([error.response?.data?.message || 'Gagal mengimpor data. Silakan coba lagi.']);
        } else {
          setPBLSiakadImportErrors([error.response?.data?.message || 'Gagal mengimpor data. Silakan coba lagi.']);
        }
      }
    } finally {
      setIsPBLImporting(false);
    }
  };

  // Fungsi untuk download template Excel Jurnal Reading
  const downloadJurnalReadingTemplate = async () => {
    if (!data) return;

    try {
      // Ambil data yang diperlukan untuk template
      const startDate = data?.tanggal_mulai ? new Date(data.tanggal_mulai) : new Date();
      const endDate = data?.tanggal_akhir ? new Date(data.tanggal_akhir) : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      
      // Generate contoh tanggal
      const generateContohTanggal = () => {
        const selisihHari = Math.floor((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const hari1 = Math.floor(selisihHari * 0.25);
        const hari2 = Math.floor(selisihHari * 0.75);
        
        const tanggal1 = new Date(startDate.getTime() + (hari1 * 24 * 60 * 60 * 1000));
        const tanggal2 = new Date(startDate.getTime() + (hari2 * 24 * 60 * 60 * 1000));
        
        return [
          tanggal1.toISOString().split('T')[0],
          tanggal2.toISOString().split('T')[0]
        ];
      };

      const [contohTanggal1, contohTanggal2] = generateContohTanggal();

      // Ambil kelompok kecil yang tersedia
      const kelompokKecilTersedia = kelompokKecilList.length > 0 ? kelompokKecilList : [
        { id: 1, nama_kelompok: "Kelompok A1" },
        { id: 2, nama_kelompok: "Kelompok A2" }
      ];

      // Data template
      const rawTemplateData = [
        {
          tanggal: contohTanggal1,
          jam_mulai: '07.20',
          topik: topikJurnalReadingList[0] || 'Contoh Topik 1',
          dosen: allDosenList[0]?.name || 'Dr. John Doe',
          ruangan: ruanganList[0]?.nama || 'Ruang 1',
          kelompok_kecil: kelompokKecilTersedia[0]?.nama_kelompok || 'Kelompok A1',
          jumlah_sesi: 2
        },
        {
          tanggal: contohTanggal2,
          jam_mulai: '10.40',
          topik: topikJurnalReadingList[1] || 'Contoh Topik 2',
          dosen: allDosenList[1]?.name || 'Dr. Jane Smith',
          ruangan: ruanganList[1]?.nama || 'Ruang 2',
          kelompok_kecil: kelompokKecilTersedia[1]?.nama_kelompok || 'Kelompok A2',
          jumlah_sesi: 2
        }
      ];

      // Transform rawTemplateData to match new headers
      const templateData = rawTemplateData.map(row => ({
        'Tanggal': row.tanggal,
        'Jam Mulai': row.jam_mulai,
        'Topik': row.topik,
        'Dosen': row.dosen,
        'Ruangan': row.ruangan,
        'Kelompok Kecil': row.kelompok_kecil,
        'Jumlah Sesi': row.jumlah_sesi
      }));

      // Create workbook
      const wb = XLSX.utils.book_new();
      
      // Sheet template dengan header yang eksplisit (Title Case dengan spasi)
      const ws = XLSX.utils.json_to_sheet(templateData, {
        header: ['Tanggal', 'Jam Mulai', 'Topik', 'Dosen', 'Ruangan', 'Kelompok Kecil', 'Jumlah Sesi']
      });
      
      // Set column widths
      const colWidths = [
        { wch: EXCEL_COLUMN_WIDTHS.TANGGAL },
        { wch: EXCEL_COLUMN_WIDTHS.JAM_MULAI },
        { wch: EXCEL_COLUMN_WIDTHS.TOPIK },
        { wch: EXCEL_COLUMN_WIDTHS.DOSEN },
        { wch: EXCEL_COLUMN_WIDTHS.RUANGAN },
        { wch: EXCEL_COLUMN_WIDTHS.KELOMPOK_KECIL },
        { wch: 8 }
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Template Jurnal Reading");

      // Sheet Tips dan Info
      const infoData: string[][] = [
        ['TIPS DAN INFORMASI IMPORT JADWAL JURNAL READING'],
        [''],
        ['📋 CARA UPLOAD FILE:'],
        ['1. Download template ini dan isi dengan data jadwal jurnal reading'],
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
        ['🏢 RUANGAN YANG TERSEDIA:'],
        ...ruanganList.slice(0, TEMPLATE_DISPLAY_LIMIT).map(ruangan => [`• ${ruangan.nama}`]),
        [''],
        ['👥 KELOMPOK KECIL YANG TERSEDIA:'],
        ...(() => {
          // Kelompok data berdasarkan nama_kelompok dan hitung jumlah mahasiswa
          const kelompokMap = new Map();
          
          kelompokKecilList.forEach(item => {
            const namaKelompok = item.nama_kelompok || `Kelompok ${item.id || 'Unknown'}`;
            if (kelompokMap.has(namaKelompok)) {
              kelompokMap.set(namaKelompok, kelompokMap.get(namaKelompok) + 1);
            } else {
              kelompokMap.set(namaKelompok, 1);
            }
          });
          
          // Convert map to array dan ambil 10 pertama
          return Array.from(kelompokMap.entries())
            .slice(0, 10)
            .map(([namaKelompok, jumlahAnggota]) => 
              [`• ${namaKelompok} (${jumlahAnggota} mahasiswa)`]
            );
        })(),
        [''],
        ['👨‍🏫 DOSEN YANG TERSEDIA:'],
        ['• Dosen yang tersedia adalah dosen yang sudah di-generate untuk blok dan semester ini'],
        ['• Termasuk dosen standby yang ditugaskan untuk mata kuliah ini'],
        ...allDosenList
          .filter((dosen, index, self) => 
            // Hapus duplikasi berdasarkan ID atau nama
            index === self.findIndex(d => 
              (dosen.id && d.id === dosen.id) || 
              (dosen.name && d.name === dosen.name)
            )
          )
          .slice(0, 10)
          .map(dosen => {
            const namaDosen = dosen.name || `Dosen ${dosen.id || 'Unknown'}`;
            return [`• ${namaDosen}`];
          }),
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
        ['• Jam mulai harus sesuai opsi yang tersedia:'],
        ['  07:20, 08:10, 09:00, 09:50, 10:40, 11:30, 12:35, 13:25, 14:15, 15:05, 15:35, 16:25, 17:15'],
        ['• Jam selesai akan divalidasi berdasarkan perhitungan:'],
        ['  Jam selesai = Jam mulai + (Jumlah sesi x 50 menit)'],
        ['  Contoh: 07:20 + (2 x 50 menit) = 09:00'],
        [''],
        ['📝 VALIDASI TOPIK:'],
        ['• Topik wajib diisi'],
        ['• Topik harus sesuai dengan daftar yang tersedia'],
        ['• Daftar topik yang tersedia:'],
        ...topikJurnalReadingList.map(topik => [`  - ${topik}`]),
        [''],
        ['👨‍🏫 VALIDASI DOSEN:'],
        ['• Dosen wajib diisi'],
        ['• Hanya boleh menggunakan dosen yang sudah di-generate untuk blok dan semester ini atau dosen standby'],
        ['• Nama dosen harus sesuai dengan yang ada di database'],
        [''],
        ['🏢 VALIDASI RUANGAN:'],
        ['• Ruangan wajib diisi'],
        ['• Nama ruangan harus ada di database'],
        ['• Pastikan ruangan tersedia untuk jadwal tersebut'],
        [''],
        ['👥 VALIDASI KELOMPOK KECIL:'],
        ['• Nama kelompok kecil wajib diisi'],
        ['• Nama kelompok kecil harus ada di database'],
        ['• Harus sesuai dengan semester mata kuliah'],
        [''],
        ['🔢 VALIDASI JUMLAH SESI:'],
        ['• Jumlah sesi: HARUS 2 (2 x 50 menit = 100 menit)'],
        ['• Digunakan untuk menghitung jam selesai'],
        ['• 1 sesi = 50 menit'],
        [''],
        ['📄 CATATAN PENTING:'],
        ['• File jurnal reading akan diupload secara manual melalui modal edit aplikasi'],
        ['• Template Excel ini hanya untuk jadwal, bukan untuk file jurnal'],
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
      XLSX.utils.book_append_sheet(wb, infoWs, "Tips dan Info");

      // Download file
      const fileName = `Template_Import_JurnalReading_${data?.nama || 'MataKuliah'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);

    } catch (error) {
      // Handle error silently
    }
  };

  // Validasi data Excel Jurnal Reading
  const validateJurnalReadingExcelData = (convertedData: JadwalJurnalReadingType[]) => {
    const cellErrors: { row: number, field: string, message: string }[] = [];
    
    if (!convertedData) return { cellErrors };
    
    convertedData.forEach((row, index) => {
      const rowNumber = index + 1;

      // Validasi tanggal
      const dateError = validateDate(row.tanggal, rowNumber);
      if (dateError) {
        cellErrors.push({ row: rowNumber, field: 'tanggal', message: dateError });
      }

      // Validasi jam mulai
      const jamMulaiError = validateTime(row.jam_mulai, rowNumber, 'jam mulai', jamOptions);
      if (jamMulaiError) {
        cellErrors.push({ row: rowNumber, field: 'jam_mulai', message: jamMulaiError });
      }

      // Validasi topik
      if (!row.topik || row.topik.trim() === '') {
        cellErrors.push({ row: rowNumber, field: 'topik', message: `Topik wajib diisi (Baris ${rowNumber}, Kolom TOPIK)` });
      } else {
        // Cek apakah topik yang diketik user ada di daftar topik yang tersedia
        const topikValid = topikJurnalReadingList.some(topik => topik.toLowerCase() === row.topik.toLowerCase());
        if (!topikValid) {
          cellErrors.push({ row: rowNumber, field: 'topik', message: `Topik "${row.topik}" tidak ditemukan. Gunakan topik yang tersedia: ${topikJurnalReadingList.join(', ')} (Baris ${rowNumber}, Kolom TOPIK)` });
        }
      }

      // Validasi dosen
      if (!row.nama_dosen || row.nama_dosen.trim() === '') {
        cellErrors.push({ row: rowNumber, field: 'dosen_id', message: `Dosen wajib diisi (Baris ${rowNumber}, Kolom DOSEN)` });
      } else {
        const dosen = allDosenList?.find(d => d.name.toLowerCase() === row.nama_dosen.toLowerCase());
        if (!dosen) {
          cellErrors.push({ row: rowNumber, field: 'dosen_id', message: `Dosen "${row.nama_dosen}" tidak ditemukan (Baris ${rowNumber}, Kolom DOSEN)` });
        } else {
          // Validasi dosen harus dosen yang sudah di-generate untuk blok/semester atau dosen standby
          const isAssignedDosen = dosenList.some(d => d.id === dosen.id);
          const isStandbyDosen = dosen.name.toLowerCase().includes('standby') || 
            (Array.isArray(dosen.keahlian) ? dosen.keahlian.some((k: string) => k.toLowerCase().includes("standby")) : 
             (dosen.keahlian || "").toLowerCase().includes("standby"));
          const isValidDosen = isAssignedDosen || isStandbyDosen;
          if (!isValidDosen) {
            cellErrors.push({ row: rowNumber, field: 'dosen_id', message: `Dosen "${row.nama_dosen}" tidak valid. Hanya boleh menggunakan dosen yang sudah di-generate untuk blok dan semester ini atau dosen standby (Baris ${rowNumber}, Kolom DOSEN)` });
          }
        }
      }

      // Validasi jumlah sesi (harus 2 untuk Jurnal Reading)
      if (!row.jumlah_sesi || row.jumlah_sesi !== 2) {
        cellErrors.push({ row: rowNumber, field: 'jumlah_sesi', message: `Jumlah sesi harus 2 untuk Jurnal Reading (Baris ${rowNumber}, Kolom SESI)` });
      }

      // Validasi ruangan (wajib diisi)
      const namaRuangan = row.nama_ruangan;
      if (!namaRuangan || namaRuangan.trim() === '') {
        cellErrors.push({ row: rowNumber, field: 'ruangan_id', message: `Ruangan wajib diisi (Baris ${rowNumber}, Kolom RUANGAN)` });
      } else {
        const ruangan = allRuanganList?.find(r => r.nama.toLowerCase() === namaRuangan.toLowerCase());
        if (!ruangan) {
          cellErrors.push({ row: rowNumber, field: 'ruangan_id', message: `Ruangan "${namaRuangan}" tidak ditemukan (Baris ${rowNumber}, Kolom RUANGAN)` });
        }
      }

      // Validasi kelompok kecil
      if (!row.nama_kelompok || row.nama_kelompok.trim() === '') {
        cellErrors.push({ row: rowNumber, field: 'kelompok_kecil_id', message: `Kelompok kecil wajib diisi (Baris ${rowNumber}, Kolom KELOMPOK_KECIL)` });
      } else {
        const kelompokKecil = kelompokKecilList?.find(k => k.nama_kelompok.toLowerCase() === row.nama_kelompok.toLowerCase());
        if (!kelompokKecil) {
          cellErrors.push({ row: rowNumber, field: 'kelompok_kecil_id', message: `Kelompok kecil "${row.nama_kelompok}" tidak ditemukan (Baris ${rowNumber}, Kolom KELOMPOK_KECIL)` });
        }
      }

      // Validasi jumlah sesi
      if (!row.jumlah_sesi || row.jumlah_sesi < 1 || row.jumlah_sesi > 6) {
        cellErrors.push({ row: rowNumber, field: 'jumlah_sesi', message: `Jumlah sesi harus 1-6 (Baris ${rowNumber}, Kolom JUMLAH_SESI)` });
      }
    });

    return { cellErrors };
  };

  // Handle file upload untuk Jurnal Reading
  const handleJurnalReadingFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setJurnalReadingImportFile(file);
    setJurnalReadingImportData([]);
    setJurnalReadingImportErrors([]);
    setJurnalReadingCellErrors([]);

    try {
      const { data: rows, headers } = await readExcelFile(file);

      // Helper function untuk konversi format jam (menambahkan leading zero)
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

      // Convert data Excel ke format Jurnal Reading
      const convertedData = rows.map((row: any[]) => {
        // Helper function untuk mencari ruangan berdasarkan nama
        const findRuangan = (namaRuangan: string) => {
          return allRuanganList?.find(r => r.nama.toLowerCase() === namaRuangan.toLowerCase());
        };

        // Helper function untuk mencari dosen berdasarkan nama
        const findDosen = (namaDosen: string) => {
          return allDosenList?.find(d => d.name.toLowerCase() === namaDosen.toLowerCase());
        };

        // Helper function untuk mencari kelompok kecil berdasarkan nama
        const findKelompokKecil = (namaKelompok: string) => {
          return kelompokKecilList?.find(k => k.nama_kelompok.toLowerCase() === namaKelompok.toLowerCase());
        };

        const namaRuangan = row[4]?.toString() || '';
        const namaDosen = row[3]?.toString() || '';
        const namaKelompok = row[5]?.toString() || '';

        const ruangan = findRuangan(namaRuangan);
        const dosen = findDosen(namaDosen);
        const kelompokKecil = findKelompokKecil(namaKelompok);

        // Konversi format jam
        const jamMulaiRaw = row[1]?.toString() || '';
        const jamMulai = convertTimeFormat(jamMulaiRaw);

        // Hitung jam selesai otomatis berdasarkan sistem
        const jumlahSesi = parseInt(row[6]?.toString() || '1');
        const jamSelesai = hitungJamSelesai(jamMulai, jumlahSesi);

        return {
          tanggal: row[0]?.toString() || '',
          jam_mulai: jamMulai,
          jam_selesai: jamSelesai,
          topik: row[2]?.toString() || '',
          nama_dosen: namaDosen,
          dosen_id: dosen?.id || null,
          nama_ruangan: namaRuangan,
          ruangan_id: ruangan?.id || null,
          nama_kelompok: namaKelompok,
          kelompok_kecil_id: kelompokKecil?.id || null,
          jumlah_sesi: jumlahSesi
        } as JadwalJurnalReadingType;
      });

      setJurnalReadingImportData(convertedData);

      // Validasi data
      const { cellErrors } = validateJurnalReadingExcelData(convertedData);
      setJurnalReadingCellErrors(cellErrors);

      // Buka modal
      setShowJurnalReadingImportModal(true);
    } catch (error) {
      setJurnalReadingImportErrors(['Gagal membaca file Excel. Pastikan format file sudah benar.']);
    }

    // Reset input file
    e.target.value = '';
  };

  // Handle edit cell untuk Jurnal Reading
  const handleJurnalReadingCellEdit = (rowIndex: number, key: string, value: any) => {
    const updatedData = [...jurnalReadingImportData];
    const row = updatedData[rowIndex];

    // Handle mapping untuk ruangan (wajib diisi)
    if (key === 'ruangan_id' || key === 'nama_ruangan') {
      if (value && value.trim() !== '') {
        const ruangan = allRuanganList?.find(r => r.nama.toLowerCase() === value.toLowerCase());
        if (ruangan) {
          row.ruangan_id = ruangan.id;
          row.nama_ruangan = ruangan.nama;
        } else {
          row.ruangan_id = null;
          row.nama_ruangan = value;
        }
      } else {
        row.ruangan_id = null;
        row.nama_ruangan = '';
      }
    } else if (key === 'dosen_id' || key === 'nama_dosen') {
      // Handle edit dosen
      if (value && value.trim() !== '') {
        const dosen = allDosenList?.find(d => d.name.toLowerCase() === value.toLowerCase());
        if (dosen) {
          row.dosen_id = dosen.id;
          row.nama_dosen = dosen.name;
        } else {
          row.dosen_id = null;
          row.nama_dosen = value;
        }
      } else {
        row.dosen_id = null;
        row.nama_dosen = '';
      }
    } else if (key === 'kelompok_kecil_id' || key === 'nama_kelompok') {
      // Handle edit kelompok kecil
      if (value && value.trim() !== '') {
        const kelompokKecil = kelompokKecilList?.find(k => k.nama_kelompok.toLowerCase() === value.toLowerCase());
        if (kelompokKecil) {
          row.kelompok_kecil_id = kelompokKecil.id;
          row.nama_kelompok = kelompokKecil.nama_kelompok;
        } else {
          row.kelompok_kecil_id = null;
          row.nama_kelompok = value;
        }
      } else {
        row.kelompok_kecil_id = null;
        row.nama_kelompok = '';
      }
    } else {
      (row as any)[key] = value;
    }

    // Jika mengedit jam_mulai atau jumlah_sesi, hitung ulang jam selesai
    if (key === 'jam_mulai' || key === 'jumlah_sesi') {
      const jamMulai = key === 'jam_mulai' ? value : row.jam_mulai;
      const jumlahSesi = key === 'jumlah_sesi' ? value : row.jumlah_sesi;
      const jamSelesai = hitungJamSelesai(jamMulai || '08:00', jumlahSesi || 1);
      row.jam_selesai = jamSelesai;
    }

    setJurnalReadingImportData(updatedData);

    // Re-validasi data
    const { cellErrors } = validateJurnalReadingExcelData(updatedData);
    setJurnalReadingCellErrors(cellErrors);
  };

  // Submit import Excel untuk Jurnal Reading
  const handleJurnalReadingSubmitImport = async () => {
    if (!kode || jurnalReadingImportData.length === 0) return;

    setIsJurnalReadingImporting(true);
    setJurnalReadingImportErrors([]);

    try {
      // Final validation
      const { cellErrors } = validateJurnalReadingExcelData(jurnalReadingImportData);
      if (cellErrors.length > 0) {
        setJurnalReadingCellErrors(cellErrors);
        setIsJurnalReadingImporting(false);
        return;
      }

      // Transform data for API
      const apiData = jurnalReadingImportData.map(row => ({
        tanggal: row.tanggal,
        jam_mulai: row.jam_mulai,
        jam_selesai: row.jam_selesai,
        jumlah_sesi: row.jumlah_sesi,
        topik: row.topik,
        dosen_id: row.dosen_id,
        ruangan_id: row.ruangan_id,
        kelompok_kecil_id: row.kelompok_kecil_id
      }));

      // Send to API
      const response = await api.post(`/jurnal-reading/jadwal/${kode}/import`, {
        data: apiData
      });

      if (response.data.success) {
        setJurnalReadingImportedCount(jurnalReadingImportData.length);
        setShowJurnalReadingImportModal(false);
        // Cleanup data setelah import berhasil
        setJurnalReadingImportData([]);
        setJurnalReadingImportFile(null);
        setJurnalReadingImportErrors([]);
        setJurnalReadingCellErrors([]);
        setJurnalReadingEditingCell(null);
        await fetchBatchData(); // Refresh data
      } else {
        setJurnalReadingImportErrors([response.data.message || 'Terjadi kesalahan saat mengimport data']);
        // Tidak import data jika ada error - all or nothing
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        // Handle validation errors
        const errorData = error.response.data;
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const cellErrors = errorData.errors.map((err: string, idx: number) => ({
            row: idx + 1,
            field: 'general',
            message: err
          }));
          setJurnalReadingCellErrors(cellErrors);
        } else {
          setJurnalReadingImportErrors([errorData.message || 'Terjadi kesalahan validasi']);
        }
      } else {
        setJurnalReadingImportErrors([error.response?.data?.message || 'Terjadi kesalahan saat mengimport data']);
      }
    } finally {
      setIsJurnalReadingImporting(false);
    }
  };

  // Close import modal untuk Jurnal Reading
  const handleJurnalReadingCloseImportModal = () => {
    setShowJurnalReadingImportModal(false);
    // Tidak menghapus data untuk file persistence
  };

  // Handler untuk hapus file Jurnal Reading
  const handleJurnalReadingRemoveFile = () => {
    setJurnalReadingImportFile(null);
    setJurnalReadingImportData([]);
    setJurnalReadingImportErrors([]);
    setJurnalReadingCellErrors([]);
    setJurnalReadingEditingCell(null);
    if (jurnalReadingFileInputRef.current) {
      jurnalReadingFileInputRef.current.value = '';
    }
  };

  // Finish editing cell untuk Jurnal Reading
  const handleJurnalReadingFinishEdit = () => {
    setJurnalReadingEditingCell(null);
  };

  // Handle file upload untuk Agenda Khusus
  const handleAgendaKhususFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAgendaKhususImportFile(file);
    setAgendaKhususImportData([]);
    setAgendaKhususImportErrors([]);
    setAgendaKhususCellErrors([]);

    try {
      const { data: rows, headers } = await readExcelFile(file);

      // Helper function untuk konversi format jam (menambahkan leading zero)
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

      // Convert data Excel ke format Agenda Khusus
      const convertedData = rows.map((row: any[]) => {
        // Helper function untuk mencari ruangan berdasarkan nama
        const findRuangan = (namaRuangan: string) => {
          return allRuanganList?.find(r => r.nama.toLowerCase() === namaRuangan.toLowerCase());
        };

        const namaRuangan = row[3]?.toString() || '';
        const ruangan = findRuangan(namaRuangan);

        // Konversi format jam
        const jamMulaiRaw = row[1]?.toString() || '';
        const jamMulai = convertTimeFormat(jamMulaiRaw);

        // Hitung jam selesai otomatis berdasarkan sistem
        const jumlahSesi = parseInt(row[5]?.toString() || '1');
        const jamSelesai = hitungJamSelesai(jamMulai, jumlahSesi);

        return {
          tanggal: row[0]?.toString() || '',
          jam_mulai: jamMulai,
          jam_selesai: jamSelesai,
          agenda: row[2]?.toString() || '',
          nama_ruangan: namaRuangan,
          ruangan_id: ruangan?.id || null,
          kelompok_besar_id: parseInt(row[4]?.toString() || '0'),
          jumlah_sesi: jumlahSesi,
          use_ruangan: !!(namaRuangan && namaRuangan.trim() !== '' && ruangan?.id)
        } as JadwalAgendaKhususType;
      });

      setAgendaKhususImportData(convertedData);

      // Validasi data
      const { cellErrors } = validateAgendaKhususExcelData(convertedData);
      setAgendaKhususCellErrors(cellErrors);

      // Buka modal
      setShowAgendaKhususImportModal(true);
    } catch (error) {
      setAgendaKhususImportErrors(['Gagal membaca file Excel. Pastikan format file sudah benar.']);
    }

    // Reset input file
    e.target.value = '';
  };

  // Handle edit cell untuk Agenda Khusus
  const handleAgendaKhususCellEdit = (rowIndex: number, key: string, value: any) => {
    const updatedData = [...agendaKhususImportData];
    const row = updatedData[rowIndex];

    // Handle mapping untuk ruangan (boleh dikosongkan)
    if (key === 'ruangan_id') {
      if (value && value.trim() !== '') {
        const ruangan = allRuanganList?.find(r => r.nama.toLowerCase() === value.toLowerCase());
        if (ruangan) {
          row.ruangan_id = ruangan.id;
          row.nama_ruangan = ruangan.nama;
          row.use_ruangan = true;
        } else {
          row.ruangan_id = null;
          row.nama_ruangan = value;
          row.use_ruangan = false;
        }
      } else {
        row.ruangan_id = null;
        row.nama_ruangan = '';
        row.use_ruangan = false;
      }
    } else if (key === 'nama_ruangan') {
      if (value && value.trim() !== '') {
        const ruangan = allRuanganList?.find(r => r.nama.toLowerCase() === value.toLowerCase());
        if (ruangan) {
          row.ruangan_id = ruangan.id;
          row.nama_ruangan = ruangan.nama;
          row.use_ruangan = true;
        } else {
          row.ruangan_id = null;
          row.nama_ruangan = value;
          row.use_ruangan = false;
        }
      } else {
        row.ruangan_id = null;
        row.nama_ruangan = '';
        row.use_ruangan = false;
      }
    } else if (key === 'kelompok_besar_id') {
      // Handle edit kelompok besar - user bisa input ID atau label
      if (typeof value === 'string' && value.includes('Semester')) {
        // User input label, cari ID-nya
        const kelompok = kelompokBesarOptions.find(k => k.label === value);
        if (kelompok) {
          row.kelompok_besar_id = Number(kelompok.id) || null;
        } else {
          row.kelompok_besar_id = parseInt(value) || null;
        }
      } else {
        // User input ID
        row.kelompok_besar_id = parseInt(value) || null;
      }
    } else {
      (row as any)[key] = value;
    }

    // Jika mengedit jam_mulai atau jumlah_sesi, hitung ulang jam selesai
    if (key === 'jam_mulai' || key === 'jumlah_sesi') {
      const jamMulai = key === 'jam_mulai' ? value : row.jam_mulai;
      const jumlahSesi = key === 'jumlah_sesi' ? value : row.jumlah_sesi;
      row.jam_selesai = hitungJamSelesai(jamMulai || '08:00', jumlahSesi || 1);
    }

    setAgendaKhususImportData(updatedData);

    // Re-validasi data
    const { cellErrors } = validateAgendaKhususExcelData(updatedData);
    setAgendaKhususCellErrors(cellErrors);
  };

  // Submit import Excel untuk Agenda Khusus
  const handleAgendaKhususSubmitImport = async () => {
    if (!kode || agendaKhususImportData.length === 0) return;

    setIsAgendaKhususImporting(true);
    setAgendaKhususImportErrors([]);

    try {
      // Final validation
      const { cellErrors } = validateAgendaKhususExcelData(agendaKhususImportData);
      if (cellErrors.length > 0) {
        setAgendaKhususCellErrors(cellErrors);
        setIsAgendaKhususImporting(false);
        return;
      }

      // Transform data for API
      const apiData = agendaKhususImportData.map(row => ({
        tanggal: row.tanggal,
        jam_mulai: row.jam_mulai,
        jam_selesai: row.jam_selesai,
        jumlah_sesi: row.jumlah_sesi,
        agenda: row.agenda,
        kelompok_besar_id: row.kelompok_besar_id,
        ruangan_id: row.ruangan_id,
        use_ruangan: row.use_ruangan
      }));

      // Send to API
      const response = await api.post(`/agenda-khusus/jadwal/${kode}/import`, {
        data: apiData
      });

      if (response.data.success) {
        setAgendaKhususImportedCount(agendaKhususImportData.length);
        setShowAgendaKhususImportModal(false);
        // Cleanup data setelah import berhasil
        setAgendaKhususImportData([]);
        setAgendaKhususImportFile(null);
        setAgendaKhususImportErrors([]);
        setAgendaKhususCellErrors([]);
        setAgendaKhususEditingCell(null);
        await fetchBatchData(); // Refresh data
      } else {
        setAgendaKhususImportErrors([response.data.message || 'Terjadi kesalahan saat mengimport data']);
        // Tidak import data jika ada error - all or nothing
      }
    } catch (error: any) {
      if (error.response?.status === 422) {
        // Handle validation errors
        const errorData = error.response.data;
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const cellErrors = errorData.errors.map((err: string, idx: number) => ({
            row: idx + 1,
            field: 'general',
            message: err
          }));
          setAgendaKhususCellErrors(cellErrors);
        } else {
          setAgendaKhususImportErrors([errorData.message || 'Terjadi kesalahan validasi']);
        }
      } else {
        setAgendaKhususImportErrors([error.response?.data?.message || 'Terjadi kesalahan saat mengimport data']);
      }
    } finally {
      setIsAgendaKhususImporting(false);
    }
  };



  const handleSubmitImport = async () => {
    const currentData = selectedTemplate === 'LAMA' ? importData : siakadImportData;
    if (currentData.length === 0) return;

    setIsImporting(true);

    // Set error berdasarkan template yang dipilih
    if (selectedTemplate === 'LAMA') {
    setImportErrors([]);
    } else {
      setSiakadImportErrors([]);
    }

    

    try {

      // Kirim data ke backend untuk validasi dan import

      const response = await api.post(`/kuliah-besar/import/${data!.kode}`, {

        data: currentData

      });

      

      // Tampilkan error jika ada

      if (response.data.errors && response.data.errors.length > 0) {
        // Set error berdasarkan template yang dipilih
        if (selectedTemplate === 'LAMA') {
        setImportErrors(response.data.errors);
        } else {
          setSiakadImportErrors(response.data.errors);
      }
        // Tidak import data jika ada error - all or nothing

      } else {
      
        // Hanya import jika tidak ada error sama sekali

      if (response.data.success > 0) {
          // Set imported count berdasarkan template yang dipilih
          if (selectedTemplate === 'LAMA') {
        setImportedCount(response.data.success);
          } else {
            setSiakadImportedCount(response.data.success);
          }

        await fetchBatchData(); // Refresh data


        setShowImportModal(false);

          // Reset data berdasarkan template yang dipilih
          if (selectedTemplate === 'LAMA') {
        setImportData([]);
        setImportFile(null);
        setImportErrors([]);
        setCellErrors([]);
        setEditingCell(null);
        setImportPage(1);
          } else {
            setSiakadImportData([]);
            setSiakadImportFile(null);
            setSiakadImportErrors([]);
            setSiakadCellErrors([]);
            setSiakadEditingCell(null);
            setSiakadImportPage(1);
          }

        }

      }

    } catch (error: any) {

      // Handle error response (termasuk status 422)

      if (error.response?.data?.errors && error.response.data.errors.length > 0) {
        // Set error berdasarkan template yang dipilih
        if (selectedTemplate === 'LAMA') {
        setImportErrors(error.response.data.errors);
        } else {
          setSiakadImportErrors(error.response.data.errors);
        }

      } else {

        const errorMessage = error.response?.data?.message || 'Gagal mengimport data';

        // Set error berdasarkan template yang dipilih
        if (selectedTemplate === 'LAMA') {
        setImportErrors([errorMessage]);
        } else {
          setSiakadImportErrors([errorMessage]);
        }

      }

    }

    

    setIsImporting(false);

  };

  // Handler untuk submit import SIAKAD
  const handleSIAKADSubmitImport = async () => {
    if (siakadImportData.length === 0) return;

    setIsSiakadImporting(true);
    setSiakadImportErrors([]);

    try {
      // Kirim data ke backend untuk validasi dan import
      const response = await api.post(`/kuliah-besar/import/${data!.kode}`, {
        data: siakadImportData
      });

      // Tampilkan error jika ada
      if (response.data.errors && response.data.errors.length > 0) {
        setSiakadImportErrors(response.data.errors);
        // Tidak import data jika ada error - all or nothing
      } else {
        // Hanya import jika tidak ada error sama sekali
      if (response.data.success > 0) {
        setImportedCount(response.data.success);
        await fetchBatchData(); // Refresh data
        setShowSIAKADImportModal(false);
        setSiakadImportData([]);
        setSiakadImportFile(null);
        setSiakadImportErrors([]);
        setSiakadCellErrors([]);
        setSiakadEditingCell(null);
        setImportPage(1);
        }
      }

    } catch (error: any) {
      // Handle error response (termasuk status 422)
      if (error.response?.data?.errors && error.response.data.errors.length > 0) {
        setSiakadImportErrors(error.response.data.errors);
      } else {
        const errorMessage = error.response?.data?.message || 'Gagal mengimport data';
        setSiakadImportErrors([errorMessage]);
      }
    }

    setIsSiakadImporting(false);
  };

  // Handler untuk close modal import

  // Handler untuk close modal import PBL

  // Close import modal untuk Praktikum Template Aplikasi
  const handlePraktikumCloseImportModal = () => {
    setShowPraktikumImportModal(false);
    // Tidak menghapus data untuk file persistence
  };

  // Close import modal untuk Praktikum SIAKAD
  const handlePraktikumSiakadCloseImportModal = () => {
    setShowPraktikumSiakadImportModal(false);
    // Tidak menghapus data untuk file persistence
  };

  // Handler untuk menghapus file Praktikum Template Aplikasi
  const handlePraktikumRemoveFile = () => {
    setPraktikumImportFile(null);
    setPraktikumImportData([]);
    setPraktikumImportErrors([]);
    setPraktikumCellErrors([]);
    setPraktikumEditingCell(null);
    setPraktikumImportPage(1);
    if (praktikumFileInputRef.current) {
      praktikumFileInputRef.current.value = '';
    }
  };

  // Handler untuk menghapus file Praktikum SIAKAD
  const handlePraktikumSiakadRemoveFile = () => {
    setPraktikumSiakadImportFile(null);
    setPraktikumSiakadImportData([]);
    setPraktikumSiakadImportErrors([]);
    setPraktikumSiakadCellErrors([]);
    setPraktikumSiakadEditingCell(null);
    setPraktikumSiakadImportPage(1);
    if (praktikumSiakadFileInputRef.current) {
      praktikumSiakadFileInputRef.current.value = '';
    }
  };

  // Edit cell untuk Praktikum
  const handlePraktikumCellEdit = (rowIdx: number, key: string, value: string | number) => {
    const updatedData = [...praktikumImportData];
    
    // Mapping field untuk dosen dan ruangan
    if (key === 'dosen_id') {
      updatedData[rowIdx] = { ...updatedData[rowIdx], nama_dosen: value as string };
      // Update dosen_id juga jika dosen ditemukan
      const dosen = allDosenList?.find(d => d.name.toLowerCase() === (value as string).toLowerCase());
      updatedData[rowIdx].dosen_id = dosen?.id || 0;
    } else if (key === 'ruangan_id') {
      updatedData[rowIdx] = { ...updatedData[rowIdx], nama_ruangan: value as string };
      // Update ruangan_id juga jika ruangan ditemukan
      const ruangan = allRuanganList?.find(r => r.nama.toLowerCase() === (value as string).toLowerCase());
      updatedData[rowIdx].ruangan_id = ruangan?.id || 0;
    } else {
      updatedData[rowIdx] = { ...updatedData[rowIdx], [key]: value };
    }
    
    // Jika mengedit jam_mulai atau jumlah_sesi, hitung ulang jam selesai
    if (key === 'jam_mulai' || key === 'jumlah_sesi') {
      const jamMulai = key === 'jam_mulai' ? value as string : updatedData[rowIdx].jam_mulai;
      const jumlahSesi = key === 'jumlah_sesi' ? value as number : updatedData[rowIdx].jumlah_sesi;
      const jamSelesai = hitungJamSelesai(jamMulai || '08:00', jumlahSesi || 2);
      updatedData[rowIdx].jam_selesai = jamSelesai;
    }
    
    setPraktikumImportData(updatedData);
    
    // Re-validate
    const { cellErrors } = validatePraktikumExcelData(updatedData);
    setPraktikumCellErrors(cellErrors);
  };

  // Finish editing cell untuk Praktikum
  const handlePraktikumFinishEdit = () => {
    setPraktikumEditingCell(null);
  };

  // Handler untuk edit manual SIAKAD praktikum (mirip dengan kuliah besar)
  const handlePraktikumSiakadMateriEdit = (rowIndex: number, materi: string) => {
    const newData = [...praktikumSiakadImportData];
    newData[rowIndex] = { 
      ...newData[rowIndex], 
      materi: materi 
    };
    setPraktikumSiakadImportData(newData);
    
    // Re-validate
    const { cellErrors } = validatePraktikumExcelData(newData);
    setPraktikumSiakadCellErrors(cellErrors);
  };

  // Edit cell untuk Praktikum SIAKAD
  const handlePraktikumSiakadCellEdit = (rowIdx: number, key: string, value: string | number) => {
    const updatedData = [...praktikumSiakadImportData];
    updatedData[rowIdx] = { ...updatedData[rowIdx], [key]: value };
    
    // Jika mengedit jam_mulai atau jumlah_sesi, hitung ulang jam selesai
    if (key === 'jam_mulai' || key === 'jumlah_sesi') {
      const jamMulai = key === 'jam_mulai' ? value as string : updatedData[rowIdx].jam_mulai;
      const jumlahSesi = key === 'jumlah_sesi' ? value as number : updatedData[rowIdx].jumlah_sesi;
      const jamSelesai = hitungJamSelesai(jamMulai || '08:00', jumlahSesi || 2);
      updatedData[rowIdx].jam_selesai = jamSelesai;
    }
    
    setPraktikumSiakadImportData(updatedData);
    
    // Re-validate
    const { cellErrors } = validatePraktikumExcelData(updatedData);
    setPraktikumSiakadCellErrors(cellErrors);
  };

  const handlePraktikumSiakadDosenEdit = (rowIndex: number, namaDosen: string) => {
    const newData = [...praktikumSiakadImportData];
    const dosen = allDosenList.find(d => d.name.toLowerCase() === namaDosen.toLowerCase());
    
    newData[rowIndex] = { 
      ...newData[rowIndex], 
      nama_dosen: namaDosen,
      dosen_id: dosen?.id || null
    };
    setPraktikumSiakadImportData(newData);
    
    // Re-validate
    const { cellErrors } = validatePraktikumExcelData(newData);
    setPraktikumSiakadCellErrors(cellErrors);
  };

  const handlePraktikumSiakadTopikEdit = (rowIndex: number, topik: string) => {
    const newData = [...praktikumSiakadImportData];
    newData[rowIndex] = { 
      ...newData[rowIndex], 
      topik: topik 
    };
    setPraktikumSiakadImportData(newData);
    
    // Re-validate
    const { cellErrors } = validatePraktikumExcelData(newData);
    setPraktikumSiakadCellErrors(cellErrors);
  };

  const handlePraktikumSiakadRuanganEdit = (rowIndex: number, namaRuangan: string) => {
    const newData = [...praktikumSiakadImportData];
    newData[rowIndex] = { 
      ...newData[rowIndex], 
      nama_ruangan: namaRuangan 
    };
    setPraktikumSiakadImportData(newData);
    
    // Re-validate
    const { cellErrors } = validatePraktikumExcelData(newData);
    setPraktikumSiakadCellErrors(cellErrors);
  };

  // Close import modal untuk Agenda Khusus
  const handleAgendaKhususCloseImportModal = () => {
    setShowAgendaKhususImportModal(false);
    // Tidak menghapus data untuk file persistence
  };

  // Handler untuk menghapus file Agenda Khusus
  const handleAgendaKhususRemoveFile = () => {
    setAgendaKhususImportFile(null);
    setAgendaKhususImportData([]);
    setAgendaKhususImportErrors([]);
    setAgendaKhususCellErrors([]);
    setAgendaKhususEditingCell(null);
    if (agendaKhususFileInputRef.current) {
      agendaKhususFileInputRef.current.value = '';
    }
  };

  // Finish editing cell untuk Agenda Khusus
  const handleAgendaKhususFinishEdit = () => {
    setAgendaKhususEditingCell(null);
  };

  const handlePBLCloseImportModal = () => {

    setShowPBLImportModal(false);

    // Tidak menghapus data untuk file persistence

    setSelectedPBLTemplate(null); // Reset template selection

  };

  // Handler untuk hapus file PBL
  const handlePBLRemoveFile = () => {
    if (selectedPBLTemplate === 'LAMA') {
      // Reset Template Aplikasi
      setPBLImportFile(null);
      setPBLImportData([]);
      setPBLImportErrors([]);
      setPBLCellErrors([]);
    setPBLEditingCell(null);
    setPBLImportPage(1);
    if (pblFileInputRef.current) {
      pblFileInputRef.current.value = '';
      }
    } else if (selectedPBLTemplate === 'SIAKAD') {
      // Reset SIAKAD
      setPBLSiakadImportFile(null);
      setPBLSiakadImportData([]);
      setPBLSiakadImportErrors([]);
      setPBLSiakadCellErrors([]);
      setPBLSiakadEditingCell(null);
      setPBLSiakadImportPage(1);
      if (pblSiakadFileInputRef.current) {
        pblSiakadFileInputRef.current.value = '';
      }
    }
  };



  const handlePBLCellEdit = (rowIdx: number, key: string, value: string) => {

    const newData = [...pblImportData];

    newData[rowIdx] = { ...newData[rowIdx], [key]: value };

    
    // Jika mengedit nama_modul, cari modul yang cocok dan set ID
    if (key === 'nama_modul') {
      const modul = modulPBLList?.find(m => 
        m.nama_modul.toLowerCase() === value.toLowerCase()
      );
      
      if (modul) {
        newData[rowIdx] = { ...newData[rowIdx], modul_pbl_id: modul.id };
      } else {
        newData[rowIdx] = { ...newData[rowIdx], modul_pbl_id: 0 };
      }
    }
    
    // Jika mengedit pbl_tipe, hitung ulang jam selesai dan jumlah sesi
    if (key === 'pbl_tipe') {
      const jumlahSesi = value === 'PBL 2' ? 3 : 2;
      const jamMulai = newData[rowIdx].jam_mulai || '08:00';
      const jamSelesai = hitungJamSelesai(jamMulai, jumlahSesi);
      newData[rowIdx] = { 
        ...newData[rowIdx], 
        jam_selesai: jamSelesai,
        jumlah_sesi: jumlahSesi
      };
    }
    
    // Jika mengedit jam_mulai, hitung ulang jam selesai berdasarkan pbl_tipe
    if (key === 'jam_mulai') {
      const pblTipe = newData[rowIdx].pbl_tipe || 'PBL 1';
      const jumlahSesi = pblTipe === 'PBL 2' ? 3 : 2;
      const jamSelesai = hitungJamSelesai(value, jumlahSesi);
      newData[rowIdx] = { 
        ...newData[rowIdx], 
        jam_selesai: jamSelesai
      };
    }
    
    setPBLImportData(newData);



    // Re-validate data

    const { cellErrors } = validatePBLExcelData(newData);

    setPBLCellErrors(cellErrors);

  };

  // Handler untuk edit cell PBL SIAKAD
  const handlePBLSIAKADCellEdit = (rowIdx: number, key: string, value: string) => {
    const newData = [...pblSiakadImportData];
    newData[rowIdx] = { ...newData[rowIdx], [key]: value };

    // Jika mengedit nama_modul, cari modul yang cocok dan set ID
    if (key === 'nama_modul') {
      const modul = modulPBLList?.find(m => 
        m.nama_modul.toLowerCase() === value.toLowerCase()
      );
      
      if (modul) {
        newData[rowIdx] = { ...newData[rowIdx], modul_pbl_id: modul.id };
      } else {
        newData[rowIdx] = { ...newData[rowIdx], modul_pbl_id: 0 };
      }
    }

    // Jika mengedit dosen_id, cari dosen yang cocok dan set ID
    if (key === 'dosen_id') {
      const dosen = allDosenList?.find(d => 
        d.name.toLowerCase() === value.toLowerCase()
      );
      
      if (dosen) {
        newData[rowIdx] = { ...newData[rowIdx], dosen_id: dosen.id };
      } else {
        newData[rowIdx] = { ...newData[rowIdx], dosen_id: null };
      }
    }

    // Jika mengedit pbl_tipe, hitung ulang jam selesai dan jumlah sesi
    if (key === 'pbl_tipe') {
      const jumlahSesi = value === 'PBL 2' ? 3 : 2;
      const jamMulai = newData[rowIdx].jam_mulai || '08:00';
      const jamSelesai = hitungJamSelesai(jamMulai, jumlahSesi);
      newData[rowIdx] = { 
        ...newData[rowIdx], 
        jam_selesai: jamSelesai,
        jumlah_sesi: jumlahSesi
      };
    }
    
    // Jika mengedit jam_mulai, hitung ulang jam selesai berdasarkan pbl_tipe
    if (key === 'jam_mulai') {
      const pblTipe = newData[rowIdx].pbl_tipe || 'PBL 1';
      const jumlahSesi = pblTipe === 'PBL 2' ? 3 : 2;
      const jamSelesai = hitungJamSelesai(value, jumlahSesi);
      newData[rowIdx] = { 
        ...newData[rowIdx], 
        jam_selesai: jamSelesai
      };
    }

    setPBLSiakadImportData(newData);

    // Re-validate data
    const { cellErrors } = validatePBLExcelData(newData);
    setPBLSiakadCellErrors(cellErrors);
  };

  const handlePBLDosenEdit = (rowIdx: number, value: string) => {

    const newData = [...pblImportData];

    const dosen = allDosenList?.find(d => d.name.toLowerCase() === value.toLowerCase());

    
    // Cek apakah dosen valid (assigned dosen atau standby)
    let isValidDosen = false;
    if (dosen) {
      const isAssignedDosen = assignedDosenPBL?.some(d => d.id === dosen.id);
      const isStandbyDosen = dosen.name.toLowerCase().includes('standby');
      isValidDosen = isAssignedDosen || isStandbyDosen;
    }
    
    newData[rowIdx] = { 

      ...newData[rowIdx], 

      dosen_id: isValidDosen ? (dosen?.id || 0) : 0,
      nama_dosen: value 

    };

    setPBLImportData(newData);



    // Re-validate data

    const { cellErrors } = validatePBLExcelData(newData);

    setPBLCellErrors(cellErrors);

  };

  // Handler untuk edit dosen PBL SIAKAD
  const handlePBLSiakadDosenEdit = (rowIdx: number, value: string) => {

    const newData = [...pblSiakadImportData];

    const dosen = allDosenList?.find(d => d.name.toLowerCase() === value.toLowerCase());

    
    // Cek apakah dosen valid (assigned dosen atau standby)
    let isValidDosen = false;
    if (dosen) {
      const isAssignedDosen = assignedDosenPBL?.some(d => d.id === dosen.id);
      const isStandbyDosen = dosen.name.toLowerCase().includes('standby');
      isValidDosen = isAssignedDosen || isStandbyDosen;
    }
    
    newData[rowIdx] = { 

      ...newData[rowIdx], 

      dosen_id: isValidDosen ? (dosen?.id || 0) : 0,
      nama_dosen: value 

    };

    setPBLSiakadImportData(newData);

    // Re-validate data

    const { cellErrors } = validatePBLExcelData(newData);

    setPBLSiakadCellErrors(cellErrors);

  };

  const handlePBLRuanganEdit = (rowIdx: number, value: string) => {

    const newData = [...pblImportData];

    const ruangan = allRuanganList?.find(r => r.nama.toLowerCase() === value.toLowerCase());

    newData[rowIdx] = { 

      ...newData[rowIdx], 

      ruangan_id: ruangan?.id || 0,

      nama_ruangan: value 

    };

    setPBLImportData(newData);



    // Re-validate data

    const { cellErrors } = validatePBLExcelData(newData);

    setPBLCellErrors(cellErrors);

  };

  // Handler untuk edit ruangan PBL SIAKAD
  const handlePBLSiakadRuanganEdit = (rowIdx: number, value: string) => {

    const newData = [...pblSiakadImportData];

    const ruangan = allRuanganList?.find(r => r.nama.toLowerCase() === value.toLowerCase());

    newData[rowIdx] = { 

      ...newData[rowIdx], 

      ruangan_id: ruangan?.id || 0,

      nama_ruangan: value 

    };

    setPBLSiakadImportData(newData);

    // Re-validate data

    const { cellErrors } = validatePBLExcelData(newData);

    setPBLSiakadCellErrors(cellErrors);

  };

  const handlePBLKelompokKecilEdit = (rowIdx: number, value: string) => {

    const newData = [...pblImportData];

    const kelompokKecil = kelompokKecilList?.find(k => k.nama_kelompok.toLowerCase() === value.toLowerCase());

    newData[rowIdx] = { 

      ...newData[rowIdx], 

      kelompok_kecil_id: kelompokKecil?.id || 0,

      nama_kelompok: value 

    };

    setPBLImportData(newData);



    // Re-validate data

    const { cellErrors } = validatePBLExcelData(newData);

    setPBLCellErrors(cellErrors);

  };

  // Handler untuk edit kelompok kecil PBL SIAKAD
  const handlePBLSiakadKelompokKecilEdit = (rowIdx: number, value: string) => {

    const newData = [...pblSiakadImportData];

    const kelompokKecil = kelompokKecilList?.find(k => k.nama_kelompok.toLowerCase() === value.toLowerCase());

    newData[rowIdx] = { 

      ...newData[rowIdx], 

      kelompok_kecil_id: kelompokKecil?.id || 0,

      nama_kelompok: value 

    };

    setPBLSiakadImportData(newData);

    // Re-validate data

    const { cellErrors } = validatePBLExcelData(newData);

    setPBLSiakadCellErrors(cellErrors);

  };

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    // Don't reset data - preserve file and edited data for next time modal opens
  };

  // Fungsi untuk mereset data import
  const resetImportData = () => {
    setImportData([]);
    setImportFile(null);
    setCellErrors([]);
    setEditingCell(null);
    setImportErrors([]);
    setImportPage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Fungsi untuk mereset data import SIAKAD
  const resetSIAKADImportData = () => {
    setSiakadImportData([]);
    setSiakadImportFile(null);
    setSiakadCellErrors([]);
    setSiakadEditingCell(null);
    setSiakadImportErrors([]);
    setSiakadImportPage(1);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Handler untuk close modal import SIAKAD
  const handleSIAKADCloseImportModal = () => {
    setShowSIAKADImportModal(false);
    // Don't reset data - preserve file and edited data for next time modal opens
  };

  // Handler untuk edit cell SIAKAD
  const handleSiakadCellEdit = (rowIndex: number, field: string, value: any) => {
    const newData = [...siakadImportData];
    newData[rowIndex] = { ...newData[rowIndex], [field]: value };
    
    // Jika mengedit jam_mulai atau jumlah_sesi, hitung ulang jam selesai
    if (field === 'jam_mulai' || field === 'jumlah_sesi') {
      const jamMulai = field === 'jam_mulai' ? value : newData[rowIndex].jam_mulai;
      const jumlahSesi = field === 'jumlah_sesi' ? parseInt(value) : newData[rowIndex].jumlah_sesi;
      const jamSelesai = hitungJamSelesai(jamMulai || '08:00', jumlahSesi || 2);
      newData[rowIndex].jam_selesai = jamSelesai;
    }
    
    setSiakadImportData(newData);
    
    // Clear cell error jika ada
    setSiakadCellErrors(prev => prev.filter(err => !(err.row === rowIndex && err.field === field)));

    // Re-validate the specific field for this row
    const row = newData[rowIndex];
    const rowNumber = rowIndex + 1;
    
    if (field === 'tanggal') {
      // Clear existing errors for this field first
      setSiakadCellErrors(prev => prev.filter(err => !(err.row === rowIndex && err.field === 'tanggal')));
      
      // Validate tanggal
      const tanggalError = validateDate(row.tanggal, rowNumber);
      if (tanggalError) {
        setSiakadCellErrors(prev => [...prev, { 
          row: rowIndex, 
          field: 'tanggal', 
          message: tanggalError
        }]);
      }
    } else if (field === 'kelompok_besar_id') {
      // Clear existing errors for this field first
      setSiakadCellErrors(prev => prev.filter(err => !(err.row === rowIndex && err.field === 'kelompok_besar_id')));
      
      // Validate kelompok besar ID
      if (!row.kelompok_besar_id || row.kelompok_besar_id === 0) {
        setSiakadCellErrors(prev => [...prev, { 
          row: rowIndex, 
          field: 'kelompok_besar_id', 
          message: `Kelompok besar ID wajib diisi (Baris ${rowNumber}, Kolom KELOMPOK_BESAR_ID)` 
        }]);
      } else {
        // Check if kelompok besar exists and matches semester
        const kelompokBesar = kelompokBesarOptions.find(k => Number(k.id) === row.kelompok_besar_id);
        if (!kelompokBesar) {
          setSiakadCellErrors(prev => [...prev, { 
            row: rowIndex, 
            field: 'kelompok_besar_id', 
            message: `Kelompok besar ID ${row.kelompok_besar_id} tidak ditemukan (Baris ${rowNumber}, Kolom KELOMPOK_BESAR_ID)` 
          }]);
        } else {
          // Extract semester from label (e.g., "Kelompok Besar Semester 1" -> 1)
          const semesterMatch = kelompokBesar.label.match(/Semester (\d+)/);
          const kelompokBesarSemester = semesterMatch ? parseInt(semesterMatch[1]) : null;
          
          if (kelompokBesarSemester !== Number(data?.semester)) {
            setSiakadCellErrors(prev => [...prev, { 
              row: rowIndex, 
              field: 'kelompok_besar_id', 
              message: `Kelompok besar ID ${row.kelompok_besar_id} tidak sesuai dengan semester mata kuliah (Baris ${rowNumber}, Kolom KELOMPOK_BESAR_ID)` 
            }]);
          }
        }
      }
    } else if (field === 'materi') {
      // Clear existing errors for this field first
      setSiakadCellErrors(prev => prev.filter(err => !(err.row === rowIndex && err.field === 'materi')));
      
      // Validate materi
      if (!row.materi || row.materi.trim() === '') {
        setSiakadCellErrors(prev => [...prev, { 
          row: rowIndex, 
          field: 'materi', 
          message: `Materi wajib diisi (Baris ${rowNumber}, Kolom MATERI)` 
        }]);
      } else {
        // Validate materi exists in available options
        const materiTersedia = data?.keahlian_required || [];
        if (!materiTersedia.includes(row.materi)) {
          setSiakadCellErrors(prev => [...prev, { 
            row: rowIndex, 
            field: 'materi', 
            message: `Materi "${row.materi}" tidak valid. Materi yang tersedia: ${materiTersedia.join(', ')} (Baris ${rowNumber}, Kolom MATERI)` 
          }]);
        } else if (row.nama_dosen && row.nama_dosen.trim() !== '') {
          // Re-validate dosen keahlian if both materi and dosen are filled
          const dosen = allDosenList.find(d => d.name.toLowerCase() === row.nama_dosen.toLowerCase());
          if (dosen) {
            const keahlianDosen = Array.isArray(dosen.keahlian) 
              ? dosen.keahlian 
              : (dosen.keahlian || '').split(',').map((k: string) => k.trim());
            
            if (!keahlianDosen.includes(row.materi)) {
              setSiakadCellErrors(prev => [...prev, { 
                row: rowIndex, 
                field: 'materi', 
                message: `Materi "${row.materi}" tidak sesuai dengan keahlian dosen "${dosen.name}". Keahlian dosen: ${keahlianDosen.join(', ')} (Baris ${rowNumber}, Kolom MATERI)` 
              }]);
            }
          }
        }
      }
    } else if (field === 'dosen_id') {
      // Clear existing errors for this field first
      setSiakadCellErrors(prev => prev.filter(err => !(err.row === rowIndex && err.field === 'dosen_id')));
      
      // Validate dosen
      if (!row.dosen_id || row.dosen_id === 0 || row.dosen_id === null) {
        setSiakadCellErrors(prev => [...prev, { 
          row: rowIndex, 
          field: 'dosen_id', 
          message: `Dosen wajib diisi (Baris ${rowNumber}, Kolom Dosen)` 
        }]);
      }
    } else if (field === 'nama_ruangan') {
      // Clear existing errors for this field first
      setSiakadCellErrors(prev => prev.filter(err => !(err.row === rowIndex && err.field === 'ruangan_id')));
      
      // Validate ruangan
      if (!row.nama_ruangan || row.nama_ruangan.trim() === '') {
        setSiakadCellErrors(prev => [...prev, { 
          row: rowIndex, 
          field: 'ruangan_id', 
          message: `Ruangan wajib diisi (Baris ${rowNumber}, Kolom Ruangan)` 
        }]);
      } else {
        const ruangan = allRuanganList?.find(r => r.nama.toLowerCase() === row.nama_ruangan.toLowerCase());
        if (!ruangan) {
          setSiakadCellErrors(prev => [...prev, { 
            row: rowIndex, 
            field: 'ruangan_id', 
            message: `Ruangan "${row.nama_ruangan}" tidak ditemukan (Baris ${rowNumber}, Kolom Ruangan)` 
          }]);
        }
      }
    } else if (field === 'jam_mulai') {
      // Clear existing errors for this field first
      setSiakadCellErrors(prev => prev.filter(err => !(err.row === rowIndex && err.field === 'jam_mulai')));
      
      // Validate jam mulai
      if (!row.jam_mulai || row.jam_mulai.trim() === '') {
        setSiakadCellErrors(prev => [...prev, { 
          row: rowIndex, 
          field: 'jam_mulai', 
          message: `Jam mulai wajib diisi (Baris ${rowNumber}, Kolom jam mulai)` 
        }]);
      } else {
        const jamMulaiError = validateTime(row.jam_mulai, rowNumber, 'jam mulai', jamOptions);
        if (jamMulaiError) {
          setSiakadCellErrors(prev => [...prev, { 
            row: rowIndex, 
            field: 'jam_mulai', 
            message: jamMulaiError 
          }]);
        }
      }
    } else if (field === 'jumlah_sesi') {
      // Clear existing errors for this field first
      setSiakadCellErrors(prev => prev.filter(err => !(err.row === rowIndex && err.field === 'jumlah_sesi')));
      
      // Validate jumlah sesi
      if (!row.jumlah_sesi || row.jumlah_sesi === 0) {
        setSiakadCellErrors(prev => [...prev, { 
          row: rowIndex, 
          field: 'jumlah_sesi', 
          message: `Jumlah sesi wajib diisi (Baris ${rowNumber}, Kolom SESI)` 
        }]);
      } else {
        const jumlahSesi = parseInt(row.jumlah_sesi.toString());
        if (isNaN(jumlahSesi) || jumlahSesi < 1 || jumlahSesi > 6) {
          setSiakadCellErrors(prev => [...prev, { 
            row: rowIndex, 
            field: 'jumlah_sesi', 
            message: `Jumlah sesi harus antara 1-6 (Baris ${rowNumber}, Kolom SESI)` 
              }]);
            }
          }
        }
    
    // Jalankan validasi lengkap untuk semua data setelah edit
    const validationResult = validateExcelData(newData, jadwalKuliahBesar);
    setSiakadImportErrors(validationResult.errors);
    setSiakadCellErrors(validationResult.cellErrors);
  };

  // Handler untuk edit dosen SIAKAD
  const handleSiakadDosenEdit = (rowIndex: number, namaDosen: string) => {
    const newData = [...siakadImportData];
    const dosen = allDosenList.find(d => d.name.toLowerCase() === namaDosen.toLowerCase());
    
    newData[rowIndex] = { 
      ...newData[rowIndex], 
      nama_dosen: namaDosen,
      dosen_id: dosen?.id || null
    };
    setSiakadImportData(newData);
    
    // Clear cell error jika ada
    setSiakadCellErrors(prev => prev.filter(err => !(err.row === rowIndex && err.field === 'dosen_id')));
    
    // Re-validate dosen field
    const rowNumber = rowIndex + 1;
    const row = newData[rowIndex];
    
    if (!namaDosen || namaDosen.trim() === '') {
      setSiakadCellErrors(prev => [...prev, { 
        row: rowIndex, 
        field: 'dosen_id', 
        message: `Dosen wajib diisi (Baris ${rowNumber}, Kolom Dosen)` 
      }]);
    } else {
      // Validate dosen exists (dosen sudah ditemukan di atas)
      if (!dosen) {
        setSiakadCellErrors(prev => [...prev, { 
          row: rowIndex, 
          field: 'dosen_id', 
          message: `Dosen "${namaDosen}" tidak ditemukan (Baris ${rowNumber}, Kolom Dosen)` 
        }]);
      } else if (row.materi && row.materi.trim() !== '' && row.materi !== 'Kosong (isi manual)') {
        // Validate dosen keahlian with materi
        const keahlianDosen = Array.isArray(dosen.keahlian) 
          ? dosen.keahlian 
          : (dosen.keahlian || '').split(',').map((k: string) => k.trim());
        
        if (!keahlianDosen.includes(row.materi)) {
          setSiakadCellErrors(prev => [...prev, { 
            row: rowIndex, 
            field: 'dosen_id', 
            message: `Dosen "${namaDosen}" tidak memiliki keahlian "${row.materi}". Keahlian dosen: ${keahlianDosen.join(', ')} (Baris ${rowNumber}, Kolom Dosen)` 
          }]);
        }
      }
    }
    
    // Jalankan validasi lengkap untuk semua data setelah edit
    const validationResult = validateExcelData(newData, jadwalKuliahBesar);
    setSiakadImportErrors(validationResult.errors);
    setSiakadCellErrors(validationResult.cellErrors);
  };

  // Handler untuk edit ruangan SIAKAD
  const handleSiakadRuanganEdit = (rowIndex: number, namaRuangan: string) => {
    const newData = [...siakadImportData];
    const ruangan = allRuanganList.find(r => r.nama === namaRuangan);
    
    newData[rowIndex] = { 
      ...newData[rowIndex], 
      nama_ruangan: namaRuangan,
      ruangan_id: ruangan?.id || null
    };
    setSiakadImportData(newData);
    
    // Clear cell error jika ada
    setSiakadCellErrors(prev => prev.filter(err => !(err.row === rowIndex && err.field === 'ruangan_id')));
    
    // Re-validate ruangan field
    const rowNumber = rowIndex + 1;
    if (!namaRuangan || namaRuangan.trim() === '') {
      setSiakadCellErrors(prev => [...prev, { 
        row: rowIndex, 
        field: 'ruangan_id', 
        message: `Ruangan wajib diisi (Baris ${rowNumber}, Kolom Ruangan)` 
      }]);
    } else if (!ruangan) {
      setSiakadCellErrors(prev => [...prev, { 
        row: rowIndex, 
        field: 'ruangan_id', 
        message: `Ruangan "${namaRuangan}" tidak ditemukan (Baris ${rowNumber}, Kolom Ruangan)` 
      }]);
    }
    
    // Jalankan validasi lengkap untuk semua data setelah edit
    const validationResult = validateExcelData(newData, jadwalKuliahBesar);
    setSiakadImportErrors(validationResult.errors);
    setSiakadCellErrors(validationResult.cellErrors);
  };

  // Logika pagination untuk import preview

  const importTotalPages = Math.ceil(importData.length / importPageSize);

  const importPaginatedData = importData.slice(

    (importPage - 1) * importPageSize,

    importPage * importPageSize

  );

  // Pagination untuk SIAKAD
  const siakadImportTotalPages = Math.ceil(siakadImportData.length / siakadImportPageSize);

  const siakadImportPaginatedData = siakadImportData.slice(
    (siakadImportPage - 1) * siakadImportPageSize,
    siakadImportPage * siakadImportPageSize
  );



  // Logika pagination untuk PBL import preview

  const pblImportTotalPages = Math.ceil(pblImportData.length / pblImportPageSize);

  const pblImportPaginatedData = pblImportData.slice(

    (pblImportPage - 1) * pblImportPageSize,

    pblImportPage * pblImportPageSize

  );

  // Logika pagination untuk PBL SIAKAD import preview

  const pblSiakadImportTotalPages = Math.ceil(pblSiakadImportData.length / pblImportPageSize);

  const pblSiakadImportPaginatedData = pblSiakadImportData.slice(

    (pblSiakadImportPage - 1) * pblImportPageSize,

    pblSiakadImportPage * pblImportPageSize

  );



  // Edit cell preview

  const handleCellEdit = (rowIdx: number, key: string, value: string) => {

    setImportData(prev => {

      const newData = [...prev];

      newData[rowIdx] = { ...newData[rowIdx], [key]: value };

      

      // Jika yang diedit adalah kelompok_besar_id, konversi ke number

      if (key === 'kelompok_besar_id') {

        newData[rowIdx][key] = parseInt(value) || 0;

      }

      

      // Jika mengedit jam_mulai atau jumlah_sesi, hitung ulang jam selesai

      if (key === 'jam_mulai' || key === 'jumlah_sesi') {

        const jamMulai = key === 'jam_mulai' ? value : newData[rowIdx].jam_mulai;

        const jumlahSesi = key === 'jumlah_sesi' ? parseInt(value) : newData[rowIdx].jumlah_sesi;

        const jamSelesai = hitungJamSelesai(jamMulai || '08:00', jumlahSesi || 2);

        newData[rowIdx].jam_selesai = jamSelesai;

      }

      

      const validationResult = validateExcelData(newData);

      setCellErrors(validationResult.cellErrors);

      setImportErrors(validationResult.errors);

      return newData;

    });

  };



  // Helper untuk handle edit dosen dengan pencarian

  const handleDosenEdit = (rowIdx: number, value: string) => {

    setImportData(prev => {

      const newData = [...prev];

      // Cari dosen di dosenList dulu, jika tidak ditemukan cari di allDosenList (untuk dosen standby)
      let selectedDosen = dosenList.find(d => d.name.toLowerCase() === value.toLowerCase());
      if (!selectedDosen) {
        selectedDosen = allDosenList.find(d => d.name.toLowerCase() === value.toLowerCase());
      }

      

      newData[rowIdx] = { 

        ...newData[rowIdx], 

        nama_dosen: value,

        dosen_id: selectedDosen?.id || null

      };

      

      const validationResult = validateExcelData(newData);

      setCellErrors(validationResult.cellErrors);

      setImportErrors(validationResult.errors);

      return newData;

    });

  };



  // Helper untuk handle edit ruangan dengan pencarian

  const handleRuanganEdit = (rowIdx: number, value: string) => {

    setImportData(prev => {

      const newData = [...prev];

      const selectedRuangan = ruanganList.find(r => r.nama.toLowerCase() === value.toLowerCase());

      

      // Update nama ruangan untuk display

      newData[rowIdx] = { 

        ...newData[rowIdx], 

        nama_ruangan: value,

        ruangan_id: selectedRuangan?.id || null

      };

      

      const validationResult = validateExcelData(newData);

      setCellErrors(validationResult.cellErrors);

      setImportErrors(validationResult.errors);

      return newData;

    });

  };







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

      <p className="text-gray-500 dark:text-gray-400 text-base mb-8">Informasi lengkap mata kuliah blok</p>



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

            <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Blok ke-</div>

            <div className="text-base text-gray-800 dark:text-white">{data.blok ?? '-'}</div>

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



      {/* Section Kuliah Besar */}

      <div className="mb-8">

        {/* Info Box untuk Template Support */}
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 mt-0.5">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                Dukungan Template Import Excel
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Fitur Import Excel mendukung 2 jenis template: <strong>Template Aplikasi</strong> (dari download template atau export Excel) dan <strong>Template SIAKAD</strong> (format standar dari sistem SIAKAD). Pilih template yang sesuai dengan file Excel Anda.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">

          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Kuliah Besar</h2>

          <div className="flex items-center gap-2">

            <button 
              onClick={() => setShowTemplateSelectionModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform"
            >
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-brand-700 dark:text-brand-200" />
              Import Excel
            </button>

            <button

              onClick={downloadTemplate}

              className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"

            >

              <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />

              Download Template Excel

            </button>

            {/* Export Excel Button */}
            <button
              onClick={exportKuliahBesarExcel}
              disabled={jadwalKuliahBesar.length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs transition flex items-center gap-2 ${
                jadwalKuliahBesar.length === 0
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                  : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800'
              }`}
              title={jadwalKuliahBesar.length === 0 
                ? 'Tidak ada data kuliah besar. Silakan tambahkan data jadwal terlebih dahulu untuk melakukan export.' 
                : 'Export data kuliah besar ke Excel'}
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

                topik: '',

                lokasi: null,

                jenisBaris: 'materi',

                agenda: '',

                kelasPraktikum: '',

                pblTipe: '',

                modul: null,

                kelompok: '',

                kelompokBesar: null,

                useRuangan: true,

                fileJurnal: null, // Tambahkan fileJurnal

              });

              setExistingFileJurnal(null);

              setEditIndex(null);

              setShowModal(true);

              setErrorForm('');

            }}

            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"

          >

            Tambah Jadwal

          </button>

        </div>

        </div>



        {/* Success Messages */}




        <AnimatePresence>

          {importedCount > 0 && (

            <motion.div

              initial={{ opacity: 0, y: -10 }}

              animate={{ opacity: 1, y: 0 }}

              exit={{ opacity: 0, y: -10 }}

              transition={{ duration: 0.2 }}

              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"

            >

              {importedCount} jadwal kuliah besar berhasil diimpor ke database.

            </motion.div>

          )}

        </AnimatePresence>

        {/* Pesan Sukses Bulk Delete untuk Kuliah Besar */}
        <AnimatePresence>
          {kuliahBesarSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {kuliahBesarSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">

          <div className="max-w-full overflow-x-auto hide-scroll">

            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">

              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">

                <tr>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <button
                      type="button"
                      aria-checked={jadwalKuliahBesar.length > 0 && jadwalKuliahBesar.every(item => selectedKuliahBesarItems.includes(item.id!))}
                      role="checkbox"
                      onClick={() => handleSelectAll('kuliah-besar', jadwalKuliahBesar)}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${jadwalKuliahBesar.length > 0 && jadwalKuliahBesar.every(item => selectedKuliahBesarItems.includes(item.id!)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                    >
                      {jadwalKuliahBesar.length > 0 && jadwalKuliahBesar.every(item => selectedKuliahBesarItems.includes(item.id!)) && (
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

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Materi</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pengampu</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Lokasi</th>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>

                </tr>

              </thead>

              <tbody>

                {jadwalKuliahBesar.length === 0 ? (

                    <tr>

                      <td colSpan={10} className="text-center py-6 text-gray-400">Tidak ada data Kuliah Besar</td>

                  </tr>

                ) : (

                    jadwalKuliahBesar.map((row, i) => {

                      const dosen = allDosenList.find(d => d.id === row.dosen_id);

                      const ruangan = allRuanganList.find(r => r.id === row.ruangan_id);

                    return (

                      <tr key={row.id} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>

                        <td className="px-4 py-4 text-center">
                          <button
                            type="button"
                            aria-checked={selectedKuliahBesarItems.includes(row.id!)}
                            role="checkbox"
                            onClick={() => handleSelectItem('kuliah-besar', row.id!)}
                            className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedKuliahBesarItems.includes(row.id!) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                          >
                            {selectedKuliahBesarItems.includes(row.id!) && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                                <polyline points="20 7 11 17 4 10" />
                              </svg>
                            )}
                          </button>
                        </td>

                        <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{i + 1}</td>

                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                          {row.tanggal ? formatTanggalKonsisten(row.tanggal) : ''}

                        </td>

                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatJamTanpaDetik(row.jam_mulai)}–{formatJamTanpaDetik(row.jam_selesai)}</td>

                          <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi || 1} x 50 menit</td>

                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.materi}</td>

                          <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{dosen?.name || `Dosen ${row.dosen_id}`}</td>

                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                          {row.kelompok_besar_id ? `Kelompok Besar Semester ${row.kelompok_besar_id}` : '-'}

                        </td>

                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.topik || row.materi}</td>

                          <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{ruangan?.nama || `Ruangan ${row.ruangan_id}`}</td>

                        <td className="px-4 py-4 text-center whitespace-nowrap">

                          <button onClick={() => handleEditJadwalKuliahBesar(i)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition mr-2" title="Edit Jadwal">

                            <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />

                            <span className="hidden sm:inline">Edit</span>

                          </button>

                          <button onClick={() => { 

                            setSelectedDeleteIndex(i); 

                            setSelectedDeleteType('materi');

                            setShowDeleteModal(true); 

                          }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" title="Hapus Jadwal">

                            <FontAwesomeIcon icon={faTrash} className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />

                            <span className="hidden sm:inline">Hapus</span>

                          </button>

                        </td>

                      </tr>

                    );

                  })

                )}

              </tbody>

            </table>

          </div>

        </div>

        {/* Tombol Hapus Terpilih untuk Kuliah Besar */}
        {selectedKuliahBesarItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              disabled={isBulkDeleting}
              onClick={() => handleBulkDelete('kuliah-besar')}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${isBulkDeleting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-theme-xs hover:bg-red-600'}`}
            >
              {isBulkDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedKuliahBesarItems.length})`}
            </button>
          </div>
        )}

      </div>



      {/* Section Praktikum */}

        <div className="mb-8">

        {/* Info Box untuk Template Support */}
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 mt-0.5">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                Dukungan Template Import Excel
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Fitur Import Excel mendukung 2 jenis template: <strong>Template Aplikasi</strong> (dari download template atau export Excel) dan <strong>Template SIAKAD</strong> (format standar dari sistem SIAKAD). Pilih template yang sesuai dengan file Excel Anda.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">

          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Praktikum</h2>

          <div className="flex gap-2 items-center">
            <button
              onClick={() => setShowPraktikumTemplateSelectionModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform cursor-pointer"
            >
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-brand-700 dark:text-brand-200" />
              Import Excel
            </button>
            <button
              onClick={downloadPraktikumTemplate}
              className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
              Download Template Excel
            </button>
            {/* Export Excel Button */}
            <button
              onClick={exportPraktikumExcel}
              disabled={jadwalPraktikum.length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs transition flex items-center gap-2 ${
                jadwalPraktikum.length === 0
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                  : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800'
              }`}
              title={jadwalPraktikum.length === 0 
                ? 'Tidak ada data praktikum. Silakan tambahkan data jadwal terlebih dahulu untuk melakukan export.' 
                : 'Export data praktikum ke Excel'}
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

                pengampu: [],

                materi: '',

                topik: '',

                lokasi: null,

                jenisBaris: 'praktikum',

                agenda: '',

                kelasPraktikum: '',

                pblTipe: '',

                modul: null,

                kelompok: '',

                kelompokBesar: null,

                useRuangan: true,

                fileJurnal: null,

              });

              setExistingFileJurnal(null);

              setEditIndex(null);

              setShowModal(true);

              setErrorForm('');

            }}

            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"

          >

            Tambah Jadwal

          </button>

          </div>
        </div>

        {/* Success Message untuk Praktikum */}
        <AnimatePresence>
          {praktikumImportedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
              onAnimationComplete={() => {
                setTimeout(() => {
                  setPraktikumImportedCount(0);
                }, 5000);
              }}
            >
              {praktikumImportedCount} jadwal Praktikum berhasil diimpor ke database.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pesan Sukses Bulk Delete untuk Praktikum */}
        <AnimatePresence>
          {praktikumSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {praktikumSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">

          <div className="max-w-full overflow-x-auto hide-scroll" >

            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">

              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">

                <tr>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <button
                      type="button"
                      aria-checked={jadwalPraktikum.length > 0 && jadwalPraktikum.every(item => selectedPraktikumItems.includes(item.id!))}
                      role="checkbox"
                      onClick={() => handleSelectAll('praktikum', jadwalPraktikum)}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${jadwalPraktikum.length > 0 && jadwalPraktikum.every(item => selectedPraktikumItems.includes(item.id!)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                    >
                      {jadwalPraktikum.length > 0 && jadwalPraktikum.every(item => selectedPraktikumItems.includes(item.id!)) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <polyline points="20 7 11 17 4 10" />
                        </svg>
                      )}
                    </button>
                  </th>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Hari/Tanggal</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelas</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pukul</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Waktu</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Materi</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pengampu</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Lokasi</th>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>

                </tr>

              </thead>

              <tbody>

                {jadwalPraktikum.length === 0 ? (

                  <tr>

                    <td colSpan={11} className="text-center py-6 text-gray-400">Tidak ada data Praktikum</td>

                  </tr>

                ) : (

                  jadwalPraktikum

                  .slice()

                  .sort((a: any, b: any) => {

                    const dateA = new Date(a.tanggal);

                    const dateB = new Date(b.tanggal);

                    return dateA.getTime() - dateB.getTime();

                  })

                  .map((row: any, i: number) => (

                  <tr key={row.id} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>

                    <td className="px-4 py-4 text-center">
                      <button
                        type="button"
                        aria-checked={selectedPraktikumItems.includes(row.id!)}
                        role="checkbox"
                        onClick={() => handleSelectItem('praktikum', row.id!)}
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedPraktikumItems.includes(row.id!) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                      >
                        {selectedPraktikumItems.includes(row.id!) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <polyline points="20 7 11 17 4 10" />
                          </svg>
                        )}
                      </button>
                    </td>

                    <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{i + 1}</td>

                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                      {formatTanggalKonsisten(row.tanggal)}

                    </td>

                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.kelas_praktikum}</td>

                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatJamTanpaDetik(row.jam_mulai)} - {formatJamTanpaDetik(row.jam_selesai)}</td>

                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi || 1} x 50 menit</td>

                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.materi}</td>

                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                      {row.dosen?.map((d: any) => d.name).join(', ') || 'Memuat...'}

                    </td>

                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.topik || row.materi}</td>

                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                      {row.ruangan?.nama || 'Memuat...'}

                    </td>

                    <td className="px-4 py-4 text-center whitespace-nowrap">

                      <button onClick={() => handleEditJadwalPraktikum(i)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition mr-2" title="Edit Jadwal">

                        <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />

                        <span className="hidden sm:inline">Edit</span>

                      </button>

                      <button onClick={() => handleDeleteJadwalPraktikum(i)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" title="Hapus Jadwal">

                        <FontAwesomeIcon icon={faTrash} className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />

                        <span className="hidden sm:inline">Hapus</span>

                      </button>

                    </td>

                  </tr>

                    ))

                )}

              </tbody>

            </table>

          </div>

        </div>

        {/* Tombol Hapus Terpilih untuk Praktikum */}
        {selectedPraktikumItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              disabled={isBulkDeleting}
              onClick={() => handleBulkDelete('praktikum')}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${isBulkDeleting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-theme-xs hover:bg-red-600'}`}
            >
              {isBulkDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedPraktikumItems.length})`}
            </button>
          </div>
        )}

      </div>

      {/* Section Agenda Khusus */}

      <div className="mb-8">

        <div className="flex items-center justify-between mb-4">

          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Agenda Khusus</h2>

          <div className="flex items-center gap-2">
            {/* Import Excel Button */}
            <button 
              onClick={() => setShowAgendaKhususImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform cursor-pointer">
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-brand-700 dark:text-brand-200" />
              Import Excel
            </button>

            {/* Download Template Button */}
            <button
              onClick={downloadAgendaKhususTemplate}
              className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
              Download Template Excel
            </button>

            {/* Export Excel Button */}
            <button
              onClick={exportAgendaKhususExcel}
              disabled={jadwalAgendaKhusus.length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs transition flex items-center gap-2 ${
                jadwalAgendaKhusus.length === 0
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                  : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800'
              }`}
              title={jadwalAgendaKhusus.length === 0 
                ? 'Tidak ada data agenda khusus. Silakan tambahkan data jadwal terlebih dahulu untuk melakukan export.' 
                : 'Export data agenda khusus ke Excel'}
            >
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
              Export ke Excel
            </button>

            {/* Tambah Jadwal Button */}
            <button

              onClick={() => {

                setForm({

                  hariTanggal: '',

                  jamMulai: '',

                  jumlahKali: 2,

                  jamSelesai: '',

                  pengampu: null,

                  materi: '',

                  topik: '',

                  lokasi: null,

                  jenisBaris: 'agenda',

                  agenda: '',

                  kelasPraktikum: '',

                  pblTipe: '',

                  modul: null,

                  kelompok: '',

                  kelompokBesar: null,

                  useRuangan: true,

                  fileJurnal: null,

                });

                setExistingFileJurnal(null);

                setEditIndex(null);

                setShowModal(true);

                setErrorForm('');

                // Fetch kelompok besar options untuk agenda khusus

                fetchKelompokBesarAgendaOptions();

              }}

              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"

            >

              Tambah Jadwal

            </button>
          </div>

        </div>

        {/* Success Message untuk Agenda Khusus */}
        <AnimatePresence>
          {agendaKhususImportedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
              onAnimationComplete={() => {
                setTimeout(() => {
                  setAgendaKhususImportedCount(0);
                }, 5000);
              }}
            >
              {agendaKhususImportedCount} jadwal Agenda Khusus berhasil diimpor ke database.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pesan Sukses Bulk Delete untuk Agenda Khusus */}
        <AnimatePresence>
          {agendaKhususSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {agendaKhususSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">

          <div className="max-w-full overflow-x-auto hide-scroll" >

            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">

              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">

                <tr>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <button
                      type="button"
                      aria-checked={jadwalAgendaKhusus.length > 0 && jadwalAgendaKhusus.every(item => selectedAgendaKhususItems.includes(item.id!))}
                      role="checkbox"
                      onClick={() => handleSelectAll('agenda-khusus', jadwalAgendaKhusus)}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${jadwalAgendaKhusus.length > 0 && jadwalAgendaKhusus.every(item => selectedAgendaKhususItems.includes(item.id!)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                    >
                      {jadwalAgendaKhusus.length > 0 && jadwalAgendaKhusus.every(item => selectedAgendaKhususItems.includes(item.id!)) && (
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

                  jadwalAgendaKhusus.map((row: any, i: number) => (

                    <tr key={row.id} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>

                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          aria-checked={selectedAgendaKhususItems.includes(row.id!)}
                          role="checkbox"
                          onClick={() => handleSelectItem('agenda-khusus', row.id!)}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedAgendaKhususItems.includes(row.id!) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                        >
                          {selectedAgendaKhususItems.includes(row.id!) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <polyline points="20 7 11 17 4 10" />
                            </svg>
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{i + 1}</td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                        {formatTanggalKonsisten(row.tanggal)}

                      </td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatJamTanpaDetik(row.jam_mulai)}–{formatJamTanpaDetik(row.jam_selesai)}</td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi || 1} x 50 menit</td>

                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.agenda}</td>

                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                      {row.kelompok_besar_id ? `Kelompok Besar Semester ${row.kelompok_besar_id}` : '-'}

                    </td>

                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                        {row.use_ruangan ? (allRuanganList.find(r => r.id === row.ruangan_id)?.nama || `Ruangan ${row.ruangan_id}`) : '-'}

                    </td>

                    <td className="px-4 py-4 text-center whitespace-nowrap">

                        <button onClick={() => handleEditJadwalAgendaKhusus(i)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition mr-2" title="Edit Jadwal">

                        <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />

                        <span className="hidden sm:inline">Edit</span>

                      </button>

                        <button onClick={() => handleDeleteJadwalAgendaKhusus(i)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" title="Hapus Jadwal">

                        <FontAwesomeIcon icon={faTrash} className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />

                        <span className="hidden sm:inline">Hapus</span>

                      </button>

                    </td>

                  </tr>

                    ))

                )}

              </tbody>

            </table>

          </div>

        </div>

        {/* Tombol Hapus Terpilih untuk Agenda Khusus */}
        {selectedAgendaKhususItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              disabled={isBulkDeleting}
              onClick={() => handleBulkDelete('agenda-khusus')}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${isBulkDeleting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-theme-xs hover:bg-red-600'}`}
            >
              {isBulkDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedAgendaKhususItems.length})`}
            </button>
          </div>
        )}

      </div>



      {/* Modal input jadwal materi */}

      <AnimatePresence>

        {showModal && (

          <>

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

                key={form.jenisBaris + String(editIndex)}

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

                  <div className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed">

                    {form.jenisBaris === 'materi' && 'Kuliah Besar'}

                    {form.jenisBaris === 'agenda' && 'Agenda Khusus'}

                    {form.jenisBaris === 'praktikum' && 'Praktikum'}

                    {form.jenisBaris === 'pbl' && 'PBL'}

                    {form.jenisBaris === 'jurnal' && 'Jurnal Reading'}

                  </div>

                </div>

                <div className="space-y-4">

                  {form.jenisBaris === 'materi' && (

                    <>

                  <div>

                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hari/Tanggal</label>

                    <input type="date" name="hariTanggal" value={form.hariTanggal || ''} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

                        {errorForm && <div className="text-sm text-red-500 mt-2">{errorForm}</div>}

                      </div>

                      <div className="flex gap-2">

                        <div className="flex-1">

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Mulai</label>

                          <Select

                            options={jamOptions.map((j: string) => ({ value: j, label: j }))}

                            value={jamOptions.map((j: string) => ({ value: j, label: j })).find((opt: any) => opt.value === form.jamMulai) || null}

                            onChange={opt => {

                              const value = opt?.value || '';

                              setForm(f => ({

                                ...f,

                                jamMulai: value,

                                jamSelesai: hitungJamSelesai(value, f.jumlahKali)

                              }));

                              resetErrorForm();

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

                          <select name="jumlahKali" value={form.jumlahKali} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">

                            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} x 50'</option>)}

                          </select>

                        </div>

                      </div>

                      <div className="mt-2">

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Selesai</label>

                        <input type="text" name="jamSelesai" value={form.jamSelesai} readOnly className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed" />

                      </div>

                        <div>

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Materi</label>

                          {materiOptions.length === 0 ? (

                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">

                              <div className="flex items-center gap-2">

                                <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">

                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />

                                </svg>

                                <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">

                                  Belum ada dosen yang bisa diambil keahliannya untuk menampilkan materi

                                </span>

                              </div>

                              <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">

                                Silakan tambahkan dosen terlebih dahulu di halaman Dosen Detail

                              </p>

                            </div>

                          ) : (

                            <Select

                              options={materiOptions.map((m: string) => ({ value: m, label: m }))}

                              value={materiOptions.map((m: string) => ({ value: m, label: m })).find((opt: any) => opt.value === form.materi) || null}

                              onChange={opt => {

                                setForm(f => ({ 

                                  ...f, 

                                  materi: opt?.value || '',

                                  pengampu: null // Reset pengampu ketika materi berubah

                                }));

                                // Reset pengampu options jika materi di-clear

                                if (!opt?.value) {

                                  setPengampuOptions([]);

                                }

                              }}

                              placeholder="Pilih Materi"

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

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pengampu</label>

                        {form.materi && pengampuOptions.length === 0 ? (

                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">

                              <div className="flex items-center gap-2">

                                <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">

                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />

                                </svg>

                                <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">

                                  Belum ada dosen yang memiliki keahlian "{form.materi}" untuk mata kuliah ini

                                </span>

                              </div>

                              <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">

                                Silakan tambahkan dosen dengan keahlian "{form.materi}" terlebih dahulu di halaman Dosen Detail

                              </p>

                            </div>

                          ) : (

                            <Select

                              options={pengampuOptions.map(d => ({ value: d.id, label: d.name }))}

                              value={pengampuOptions.map(d => ({ value: d.id, label: d.name })).find(opt => opt.value === form.pengampu) || null}

                              onChange={opt => {

                                setForm(f => ({ ...f, pengampu: opt ? Number(opt.value) : null }));

                                resetErrorForm();

                              }}

                              placeholder={form.materi ? "Pilih Dosen" : "Pilih materi terlebih dahulu"}

                              isDisabled={!form.materi}

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

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topik</label>

                        <input type="text" name="topik" value={form.topik} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelompok Besar</label>

                        {kelompokBesarOptions.length === 0 ? (

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

                              options={kelompokBesarOptions.map(k => ({ value: Number(k.id), label: k.label }))}

                              value={kelompokBesarOptions.find(k => Number(k.id) === form.kelompokBesar) ? { value: form.kelompokBesar, label: kelompokBesarOptions.find(k => Number(k.id) === form.kelompokBesar)?.label } : null}

                              onChange={opt => {

                      

                                setForm(f => ({ ...f, kelompokBesar: opt ? Number(opt.value) : null }));

                                resetErrorForm();

                              }}

                              isSearchable={false}

                              placeholder="Pilih Kelompok Besar"

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

                            options={getRuanganOptionsLocal()}

                            value={getRuanganOptionsLocal().find(opt => opt.value === form.lokasi) || null}

                            onChange={opt => {

                              setForm(f => ({ ...f, lokasi: opt ? Number(opt.value) : null }));

                              resetErrorForm();

                            }}

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

                    </>

                  )}

                  {form.jenisBaris === 'praktikum' && (

                    <>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hari/Tanggal</label>

                        <input type="date" name="hariTanggal" value={form.hariTanggal || ''} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

                        {errorForm && <div className="text-sm text-red-500 mt-2">{errorForm}</div>}

                      </div>

                    <div>

                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelas Praktikum</label>

                      {kelasPraktikumOptions.length === 0 ? (

                        <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">

                          <div className="flex items-center gap-2">

                            <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">

                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />

                            </svg>

                            <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">

                              Belum ada kelas praktikum yang ditambahkan untuk mata kuliah ini

                            </span>

                          </div>

                          <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">

                            Silakan tambahkan kelas praktikum terlebih dahulu di halaman Praktikum Detail

                          </p>

                        </div>

                      ) : (

                        <Select

                          options={kelasPraktikumOptions.map(k => ({ value: k, label: k }))}

                          value={kelasPraktikumOptions.find(k => k === form.kelasPraktikum) ? { value: form.kelasPraktikum, label: form.kelasPraktikum } : null}

                          onChange={opt => {

                            setForm(f => ({ ...f, kelasPraktikum: opt?.value || '' }));

                            resetErrorForm();

                          }}

                          placeholder="Pilih Kelas"

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

                      <div className="flex gap-2">

                        <div className="flex-1">

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Mulai</label>

                          <Select

                            options={jamOptions.map((j: string) => ({ value: j, label: j }))}

                            value={jamOptions.map((j: string) => ({ value: j, label: j })).find((opt: any) => opt.value === form.jamMulai) || null}

                            onChange={opt => {

                              const value = opt?.value || '';

                              setForm(f => ({

                                ...f,

                                jamMulai: value,

                                jamSelesai: hitungJamSelesai(value, f.jumlahKali)

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

                          <select name="jumlahKali" value={form.jumlahKali} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">

                            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} x 50'</option>)}

                          </select>

                        </div>

                      </div>

                      <div className="mt-2">

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Selesai</label>

                        <input type="text" name="jamSelesai" value={form.jamSelesai} readOnly className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed" />

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Materi</label>

                        {(form.jenisBaris === 'praktikum' ? materiPraktikumOptions.length === 0 : materiOptions.length === 0) ? (

                          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">

                            <div className="flex items-center gap-2">

                              <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">

                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />

                              </svg>

                              <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">

                                Belum ada dosen yang bisa diambil keahliannya untuk menampilkan materi

                              </span>

                            </div>

                            <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">

                              Silakan tambahkan dosen terlebih dahulu di halaman Dosen Detail

                            </p>

                          </div>

                        ) : (

                          <Select

                            options={form.jenisBaris === 'praktikum' ? materiPraktikumOptions.map(m => ({ value: m, label: m })) : materiOptions.map((m: string) => ({ value: m, label: m }))}

                            value={(form.jenisBaris === 'praktikum' ? materiPraktikumOptions.map(m => ({ value: m, label: m })) : materiOptions.map((m: string) => ({ value: m, label: m }))).find((opt: any) => opt.value === form.materi) || null}

                            onChange={opt => {

                              setForm(f => ({ 

                                ...f, 

                                materi: opt?.value || '',

                                pengampu: form.jenisBaris === 'praktikum' ? [] : null // Reset pengampu ketika materi berubah

                              }));

                              // Reset pengampu options jika materi di-clear

                              if (!opt?.value) {

                                if (form.jenisBaris === 'praktikum') {

                                  setPengampuPraktikumOptions([]);

                                } else {

                                  setPengampuOptions([]);

                                }

                              }

                              resetErrorForm();

                            }}

                            placeholder="Pilih Materi"

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

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pengampu</label>

                          {(['pbl', 'jurnal'].includes(form.jenisBaris)) && loadingAssignedPBL ? (

                            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">

                              <div className="flex items-center gap-2">

                                <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">

                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>

                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>

                                </svg>

                                <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">

                                  Memuat data assigned dosen...

                                </span>

                              </div>

                            </div>

                          ) : (form.jenisBaris === 'praktikum' && form.materi && pengampuPraktikumOptions.length === 0) ? (

                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">

                              <div className="flex items-center gap-2">

                                <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">

                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />

                                </svg>

                                <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">

                                  Belum ada dosen yang memiliki keahlian "{form.materi}" untuk mata kuliah ini

                                </span>

                              </div>

                              <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">

                                Silakan tambahkan dosen dengan keahlian "{form.materi}" terlebih dahulu di halaman Dosen Detail

                              </p>

                            </div>

                          ) : (['pbl', 'jurnal'].includes(form.jenisBaris)) && (!hasAssignedPBL || assignedDosenPBL.length === 0) ? (

                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">

                              <div className="flex items-center gap-2">

                                <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">

                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />

                                </svg>

                                <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">

                                  Belum ada dosen yang di-assign untuk PBL mata kuliah ini

                                </span>

                              </div>

                              <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">

                                Silakan generate dosen PBL terlebih dahulu di halaman PBL Generate

                              </p>

                            </div>

                          ) : (

                          <Select

                              options={(() => {

                                if (form.jenisBaris === 'praktikum') {

                                  return pengampuPraktikumOptions.map(d => ({ 

                              value: d.id, 

                              label: d.name,

                                    data: d 

                                  }));

                                } else if (['pbl', 'jurnal'].includes(form.jenisBaris)) {

                                  return assignedDosenPBL.map(d => ({ value: d.id, label: d.name }));

                                } else {

                                  return pengampuOptions.map(d => ({ value: d.id, label: d.name }));

                                }

                              })()}

                            value={(() => {

                              if (form.jenisBaris === 'praktikum') {

                                return Array.isArray(form.pengampu) 

                                  ? pengampuPraktikumOptions.filter(d => (form.pengampu as number[]).includes(d.id)).map(d => ({ 

                                      value: d.id, 

                                      label: d.name,

                                      data: d

                                    }))

                                  : null;

                                } else if (['pbl', 'jurnal'].includes(form.jenisBaris)) {

                                  return assignedDosenPBL.map(d => ({ value: d.id, label: d.name })).find(opt => opt.value === form.pengampu) || null;

                              } else {

                                return pengampuOptions.map(d => ({ value: d.id, label: d.name })).find(opt => opt.value === form.pengampu) || null;

                              }

                            })()}

                            onChange={opt => {

                              if (form.jenisBaris === 'praktikum') {

                                // For multi-select, opt is an array of selected options

                                setForm(f => ({ ...f, pengampu: opt ? (opt as { value: number; label: string; }[]).map(o => o.value) : [] }));

                              } else {

                                setForm(f => ({ ...f, pengampu: opt ? Number((opt as { value: number; label: string; }).value) : null }));

                              }

                              resetErrorForm();

                            }}

                              placeholder={(() => {

                                if (loadingAssignedPBL && (['pbl', 'jurnal'].includes(form.jenisBaris))) {

                                  return "Memuat...";

                                } else if (form.jenisBaris === 'praktikum') {

                                  return form.materi ? "Pilih Pengampu" : "Pilih materi terlebih dahulu";

                                } else {

                                  return "Pilih Pengampu";

                                }

                              })()}

                            isClearable

                            isMulti={form.jenisBaris === 'praktikum'}

                            isDisabled={form.jenisBaris === 'praktikum' && !form.materi}

                              isLoading={loadingAssignedPBL && (['pbl', 'jurnal'].includes(form.jenisBaris))}

                            classNamePrefix="react-select"

                            className="react-select-container"

                            formatOptionLabel={(option: any) => {

                              if (form.jenisBaris === 'praktikum' && option.data) {

                                const dosen = option.data;

                                const isStandby = Array.isArray(dosen.keahlian)

                                  ? dosen.keahlian.some((k: string) => k.toLowerCase().includes("standby"))

                                  : (dosen.keahlian || "").toLowerCase().includes("standby");

                                

                                return (

                                  <div className="flex items-center gap-2 p-2">

                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center ${

                                      isStandby ? "bg-yellow-400" : "bg-green-500"

                                    }`}>

                                      <span className="text-white text-xs font-bold">

                                        {dosen.name.charAt(0)}

                                      </span>

                                    </div>

                                    <span className={`text-xs font-medium ${

                                      isStandby

                                        ? "text-yellow-800 dark:text-yellow-200"

                                        : "text-green-700 dark:text-green-200"

                                    }`}>

                                      {dosen.name}

                                    </span>

                                  </div>

                                );

                              }

                              return option.label;

                            }}

                            formatGroupLabel={(data: any) => {

                              if (form.jenisBaris === 'praktikum') {

                                return (

                                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 py-1">

                                    {data.label}

                                  </div>

                                );

                              }

                              return data.label;

                            }}

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

                                padding: '0.5rem',

                              }),

                              multiValue: (base, state) => ({

                                ...base,

                                backgroundColor: state.data?.data?.keahlian?.some((k: string) => k.toLowerCase().includes("standby"))

                                  ? '#fef3c7' // yellow-100

                                  : '#dcfce7', // green-100

                                border: state.data?.data?.keahlian?.some((k: string) => k.toLowerCase().includes("standby"))

                                  ? '1px solid #fde68a' // yellow-200

                                  : '1px solid #bbf7d0', // green-200

                                borderRadius: '9999px', // rounded-full

                                padding: '0.25rem 0.75rem', // px-3 py-1

                                margin: '0.125rem',

                                display: 'flex',

                                alignItems: 'center',

                                gap: '0.5rem', // gap-2

                              }),

                              multiValueLabel: (base, state) => ({

                                ...base,

                                color: state.data?.data?.keahlian?.some((k: string) => k.toLowerCase().includes("standby"))

                                  ? '#92400e' // yellow-800

                                  : '#166534', // green-700

                                fontWeight: '500', // font-medium

                                fontSize: '0.75rem', // text-xs

                                display: 'flex',

                                alignItems: 'center',

                                gap: '0.5rem', // gap-2

                              }),

                                                             multiValueRemove: (base) => ({

                                ...base,

                                color: '#ef4444', // red-500

                                ':hover': {

                                  backgroundColor: '#fee2e2', // red-100

                                  color: '#dc2626', // red-600

                                },

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

                            components={{

                              MultiValue: ({ data, removeProps }: any) => {

                                if (form.jenisBaris === 'praktikum' && data.data) {

                                  const dosen = data.data;

                                  const isStandby = Array.isArray(dosen.keahlian)

                                    ? dosen.keahlian.some((k: string) => k.toLowerCase().includes("standby"))

                                    : (dosen.keahlian || "").toLowerCase().includes("standby");

                                  

                                  return (

                                    <div

                                      className={`flex items-center gap-2 px-3 py-1 rounded-full ${

                                        isStandby

                                          ? "bg-yellow-100 dark:bg-yellow-900/40"

                                          : "bg-green-100 dark:bg-green-900/40"

                                      }`}

                                    >

                                      <div

                                        className={`w-6 h-6 rounded-full flex items-center justify-center ${

                                          isStandby ? "bg-yellow-400" : "bg-green-500"

                                        }`}

                                      >

                                        <span className="text-white text-xs font-bold">

                                          {dosen.name.charAt(0)}

                                        </span>

                                      </div>

                                      <span

                                        className={`text-xs font-medium ${

                                          isStandby

                                            ? "text-yellow-800 dark:text-yellow-200"

                                            : "text-green-700 dark:text-green-200"

                                        }`}

                                      >

                                        {dosen.name}

                                      </span>

                                      <button

                                        className="ml-2 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition text-xs"

                                        title="Hapus dosen"

                                        {...removeProps}

                                      >

                                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">

                                          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />

                                        </svg>

                                      </button>

                                    </div>

                                  );

                                }

                                return null;

                              }

                            }}

                          />

                          )}

                        </div>

                        <div>

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topik</label>

                          <input type="text" name="topik" value={form.topik} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

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

                            options={getRuanganOptionsLocal()}

                            value={getRuanganOptionsLocal().find(opt => opt.value === form.lokasi) || null}

                            onChange={opt => setForm(f => ({ ...f, lokasi: opt ? Number(opt.value) : null }))}

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

                    </>

                  )}

                  {form.jenisBaris === 'agenda' && (

                    <>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hari/Tanggal</label>

                        <input type="date" name="hariTanggal" value={form.hariTanggal || ''} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

                        {errorForm && <div className="text-sm text-red-500 mt-2">{errorForm}</div>}

                      </div>

                      <div className="flex gap-2">

                        <div className="flex-1">

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Mulai</label>

                          <Select

                            options={jamOptions.map((j: string) => ({ value: j, label: j }))}

                            value={jamOptions.map((j: string) => ({ value: j, label: j })).find((opt: any) => opt.value === form.jamMulai) || null}

                            onChange={opt => {

                              const value = opt?.value || '';

                              setForm(f => ({

                                ...f,

                                jamMulai: value,

                                jamSelesai: hitungJamSelesai(value, f.jumlahKali)

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

                          <select name="jumlahKali" value={form.jumlahKali} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">

                            {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} x 50'</option>)}

                          </select>

                        </div>

                      </div>

                      <div className="mt-2">

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Selesai</label>

                        <input type="text" name="jamSelesai" value={form.jamSelesai} readOnly className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed" />

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Agenda</label>

                        <input type="text" name="agenda" value={form.agenda} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

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

                              options={getRuanganOptionsLocal()}

                              value={getRuanganOptionsLocal().find(opt => opt.value === form.lokasi) || null}

                              onChange={opt => setForm(f => ({ ...f, lokasi: opt ? Number(opt.value) : null }))}

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

                      )}

                    </>

                  )}

                  {form.jenisBaris === 'pbl' && (

                    <>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hari/Tanggal</label>

      

                        <input

                          type="date"

                          name="hariTanggal"

                          value={form.hariTanggal || ''}

                          onChange={handleFormChange}

                          className="w-full px-3 sa py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"

                        />

                        {errorForm && <div className="text-sm text-red-500 mt-2">{errorForm}</div>}

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Tipe PBL</label>

                        <select

                          name="pblTipe"

                          value={form.pblTipe}

                          onChange={e => {

                            const val = e.target.value;

                            setForm(f => ({

                              ...f,

                              pblTipe: val,

                              jumlahKali: val === 'PBL 1' ? 2 : val === 'PBL 2' ? 3 : 2,

                              jamSelesai: hitungJamSelesai(f.jamMulai, val === 'PBL 1' ? 2 : val === 'PBL 2' ? 3 : 2)

                            }));

                          }}

                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"

                        >

                          <option value="">Pilih Tipe PBL</option>

                          <option value="PBL 1">PBL 1</option>

                          <option value="PBL 2">PBL 2</option>

                        </select>

                      </div>

                      <div className="flex gap-2">

                        <div className="flex-1">

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Mulai</label>

                          <Select

                            options={jamOptions.map((j: string) => ({ value: j, label: j }))}

                            value={jamOptions.map((j: string) => ({ value: j, label: j })).find((opt: any) => opt.value === form.jamMulai) || null}

                            onChange={opt => {

                              const value = opt?.value || '';

                              setForm(f => ({

                                ...f,

                                jamMulai: value,

                                jamSelesai: hitungJamSelesai(value, f.jumlahKali)

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

                          <input type="text" value={form.jumlahKali + " x 50'"} readOnly className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed" />

                        </div>

                      </div>

                      <div className="mt-2">

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Selesai</label>

                        <input type="text" name="jamSelesai" value={form.jamSelesai} readOnly className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed" />

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Modul</label>

                        {modulPBLList.length === 0 ? (

                          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">

                            <div className="flex items-center gap-2">

                              <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">

                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />

                              </svg>

                              <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">

                                Belum ada modul PBL yang ditambahkan untuk mata kuliah ini

                              </span>

                            </div>

                            <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">

                              Silakan tambahkan modul PBL terlebih dahulu di halaman Modul PBL Detail

                            </p>

                          </div>

                        ) : (

                          <Select

                            options={modulPBLList.map(modul => ({ value: modul.id, label: modul.nama_modul }))}

                            value={modulPBLList.find(modul => modul.id === form.modul) ? { value: form.modul, label: modulPBLList.find(modul => modul.id === form.modul)!.nama_modul } : null}

                            onChange={opt => setForm(f => ({ ...f, modul: opt ? Number(opt.value) : null }))}

                            placeholder="Pilih Modul"

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

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelompok</label>

                        {uniqueKelompok.length === 0 ? (

                          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">

                            <div className="flex items-center gap-2">

                              <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">

                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />

                              </svg>

                              <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">

                                Belum ada kelompok kecil yang di-generate untuk semester ini

                              </span>

                            </div>

                            <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">

                              Silakan generate kelompok kecil terlebih dahulu di halaman Kelompok Kecil

                            </p>

                          </div>

                        ) : (

                        <Select

                          options={uniqueKelompok}

                          value={uniqueKelompok.find(opt => opt.value === form.kelompok) || null}

                            onChange={opt => {

                              setForm(f => ({ ...f, kelompok: opt?.value || '' }));

                              resetErrorForm();

                            }}

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

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pengampu</label>

                        {loadingAssignedPBL ? (

                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">

                            <div className="flex items-center gap-2">

                              <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">

                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>

                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>

                              </svg>

                              <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">

                                Memuat data assigned dosen...

                              </span>

                            </div>

                          </div>

                        ) : (!hasAssignedPBL || assignedDosenPBL.length === 0) ? (

                          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">

                            <div className="flex items-center gap-2">

                              <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">

                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />

                              </svg>

                              <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">

                                Belum ada dosen yang di-assign untuk PBL mata kuliah ini

                              </span>

                            </div>

                            <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">

                              Silakan generate dosen PBL terlebih dahulu di halaman PBL Generate

                            </p>

                          </div>

                        ) : (

                        <Select

                            options={assignedDosenPBL.map(d => ({ value: d.id, label: d.name }))}

                            value={assignedDosenPBL.map(d => ({ value: d.id, label: d.name })).find(opt => opt.value === form.pengampu) || null}

                          onChange={opt => setForm(f => ({ ...f, pengampu: opt ? Number(opt.value) : null }))}

                          placeholder="Pilih Dosen"

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

                      {(form.jenisBaris as string) === 'materi' && pengampuOptions.length === 0 && (

                        <div className="text-xs text-yellow-600 bg-yellow-50 rounded p-2 mt-2">

                          Data dosen pengampu belum di-generate untuk blok ini. Silakan generate di menu PBL Generate.

                        </div>

                      )}



                      {(form.jenisBaris as string) === 'praktikum' && pengampuPraktikumOptions.length === 0 && form.materi && (

                        <div className="text-xs text-yellow-600 bg-yellow-50 rounded p-2 mt-2">

                          Tidak ada dosen yang memiliki keahlian "{form.materi}" untuk praktikum ini. Silakan tambahkan keahlian dosen atau pilih keahlian lain.

                        </div>

                      )}

                      {(form.jenisBaris as string) === 'praktikum' && kelasPraktikumOptions.length === 0 && (

                        <div className="text-xs text-yellow-600 bg-yellow-50 rounded p-2 mt-2">

                          Belum ada kelas yang dibuat untuk semester ini. Silakan buat kelas terlebih dahulu di halaman Kelas.

                        </div>

                      )}

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

                            options={getRuanganOptionsLocal()}

                            value={getRuanganOptionsLocal().find(opt => opt.value === form.lokasi) || null}

                            onChange={opt => setForm(f => ({ ...f, lokasi: opt ? Number(opt.value) : null }))}

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

                    </>

                  )}

                  {form.jenisBaris === 'jurnal' && (

                    <>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Hari/Tanggal</label>

                        <input type="date" name="hariTanggal" value={form.hariTanggal || ''} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />

                        {errorForm && <div className="text-sm text-red-500 mt-2">{errorForm}</div>}

                      </div>

                      <div className="flex gap-2">

                        <div className="flex-1">

                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Mulai</label>

                          <Select

                            options={jamOptions.map((j: string) => ({ value: j, label: j }))}

                            value={jamOptions.map((j: string) => ({ value: j, label: j })).find((opt: any) => opt.value === form.jamMulai) || null}

                            onChange={opt => {

                              const value = opt?.value || '';

                              setForm(f => ({

                                ...f,

                                jamMulai: value,

                                jamSelesai: hitungJamSelesai(value, f.jumlahKali)

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

                          <select name="jumlahKali" value={form.jenisBaris === 'jurnal' ? 2 : form.jumlahKali} onChange={handleFormChange} disabled={form.jenisBaris === 'jurnal'} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:opacity-50 disabled:cursor-not-allowed">

                            {form.jenisBaris === 'jurnal' ? (
                              <option value={2}>2 x 50'</option>
                            ) : (
                              [1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} x 50'</option>)
                            )}

                          </select>

                        </div>

                      </div>

                      <div className="mt-2">

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Jam Selesai</label>

                        <input type="text" name="jamSelesai" value={form.jamSelesai} readOnly className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm cursor-not-allowed" />

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelompok</label>

                        {uniqueKelompok.length === 0 ? (

                          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">

                            <div className="flex items-center gap-2">

                              <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">

                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />

                              </svg>

                              <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">

                                Belum ada kelompok kecil yang di-generate untuk semester ini

                              </span>

                            </div>

                            <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">

                              Silakan generate kelompok kecil terlebih dahulu di halaman Kelompok Kecil

                            </p>

                          </div>

                        ) : (

                        <select name="kelompok" value={form.kelompok} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">

                          <option value="">Pilih Kelompok</option>

                          {uniqueKelompok.map(kelompok => (

                            <option key={kelompok.value} value={kelompok.value}>{kelompok.label}</option>

                          ))}

                        </select>

                        )}

                      </div>

                      <div>

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topik</label>

                        {topikJurnalReadingList.length === 0 ? (

                          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">

                            <div className="flex items-center gap-2">

                              <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">

                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />

                              </svg>

                              <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">

                                Belum ada topik jurnal reading yang tersedia untuk mata kuliah ini

                              </span>

                            </div>

                            <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">

                              Silakan tambahkan topik jurnal reading terlebih dahulu di halaman Mata Kuliah Detail

                            </p>

                          </div>

                        ) : (

                        <Select

                            options={topikJurnalReadingList.map(topik => ({ value: topik, label: topik }))}

                            value={topikJurnalReadingList.find(topik => topik === form.topik) ? { value: form.topik, label: form.topik } : null}

                            onChange={opt => setForm(f => ({ ...f, topik: opt ? opt.value : '' }))}

                            placeholder="Pilih Topik"

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

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pengampu</label>

                        {loadingAssignedPBL ? (

                          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">

                            <div className="flex items-center gap-2">

                              <svg className="w-5 h-5 text-blue-500 animate-spin" fill="none" viewBox="0 0 24 24">

                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>

                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>

                              </svg>

                              <span className="text-blue-700 dark:text-blue-300 text-sm font-medium">

                                Memuat data assigned dosen...

                              </span>

                            </div>

                          </div>

                        ) : (!hasAssignedPBL || assignedDosenPBL.length === 0) ? (

                          <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">

                            <div className="flex items-center gap-2">

                              <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">

                                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />

                              </svg>

                              <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">

                                Belum ada dosen yang di-assign untuk PBL mata kuliah ini

                              </span>

                            </div>

                            <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">

                              Silakan generate dosen PBL terlebih dahulu di halaman PBL Generate

                            </p>

                          </div>

                        ) : (

                        <Select

                            options={assignedDosenPBL.map(d => ({ value: d.id, label: d.name }))}

                            value={assignedDosenPBL.map(d => ({ value: d.id, label: d.name })).find(opt => opt.value === form.pengampu) || null}

                          onChange={opt => setForm(f => ({ ...f, pengampu: opt ? Number(opt.value) : null }))}

                          placeholder="Pilih Dosen"

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

                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Upload File Jurnal</label>

                        <div className="relative">

                          <input 

                            type="file" 

                            accept=".xlsx,.xls,.docx,.doc,.pdf" 

                            onChange={e => {

                              const file = e.target.files && e.target.files[0];

                              if (file) {

                                // Validasi ukuran file (10MB)

                                if (file.size <= 10 * 1024 * 1024) {

                                  setForm(f => ({ ...f, fileJurnal: file }));

                                  setExistingFileJurnal(null);

                                } else {

                                  setErrorForm('Ukuran file terlalu besar. Maksimal 10MB.');

                                  setForm(f => ({ ...f, fileJurnal: null }));

                                }

                              } else {

                                setForm(f => ({ ...f, fileJurnal: null }));

                              }

                            }} 

                            className={`absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10 ${

                              (form.fileJurnal && form.fileJurnal instanceof File) || (existingFileJurnal && !form.fileJurnal) 

                                ? 'pointer-events-none' 

                                : ''

                            }`}

                            id="file-upload-jurnal"

                          />

                          <div 

                            className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ease-in-out transform ${

                              isDragOver 

                                ? 'border-brand-500 dark:border-brand-400 bg-brand-50 dark:bg-brand-900/20 scale-105 shadow-lg' 

                                : 'border-gray-300 dark:border-gray-600 hover:border-brand-500 dark:hover:border-brand-400 hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-800 hover:scale-102'

                            }`}

                            onDragOver={(e) => {

                              e.preventDefault();

                              setIsDragOver(true);

                            }}

                            onDragLeave={(e) => {

                              e.preventDefault();

                              setIsDragOver(false);

                            }}

                            onDrop={(e) => {

                              e.preventDefault();

                              setIsDragOver(false);

                              const files = e.dataTransfer.files;

                              if (files.length > 0) {

                                const file = files[0];

                                // Validasi tipe file

                                const allowedTypes = ['.xlsx', '.xls', '.docx', '.doc', '.pdf'];

                                const fileExtension = '.' + file.name.split('.').pop()?.toLowerCase();

                                if (allowedTypes.includes(fileExtension)) {

                                  // Validasi ukuran file (10MB)

                                  if (file.size <= 10 * 1024 * 1024) {

                                    setForm(f => ({ ...f, fileJurnal: file }));

                                  } else {

                                    setErrorForm('Ukuran file terlalu besar. Maksimal 10MB.');

                                  }

                                } else {

                                  setErrorForm('Tipe file tidak didukung. Gunakan Excel, Word, atau PDF.');

                                }

                              }

                            }}

                          >

                            <div className="flex flex-col items-center space-y-2">

                              {form.fileJurnal && form.fileJurnal instanceof File ? (

                                <div className="w-full max-w-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">

                                  <div className="flex items-center justify-between">

                                    <div className="flex items-center space-x-3">

                                      <div className="flex-shrink-0">

                                        <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">

                                          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />

                                          </svg>

                                        </div>

                                      </div>

                                      <div className="flex-1 min-w-0">

                                        <p className="text-sm font-medium text-green-800 dark:text-green-200 truncate">

                                          {truncateFileName(form.fileJurnal.name, 28)}

                                        </p>

                                        <p className="text-xs text-green-600 dark:text-green-400 text-left w-full">

                                          {(form.fileJurnal.size / 1024 / 1024).toFixed(2)} MB

                                        </p>

                                      </div>

                                    </div>

                                    <button

                                      onClick={(e) => {

                                        e.preventDefault();

                                        e.stopPropagation();

                                        setForm(f => ({ ...f, fileJurnal: null }));

                                      }}

                                      className="flex-shrink-0 p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors duration-200"

                                    >

                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />

                                      </svg>

                                    </button>

                                  </div>

                                </div>

                              ) : existingFileJurnal && !form.fileJurnal ? (

                                <div className="w-full max-w-sm bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">

                                  <div className="flex items-center justify-between">

                                    <div className="flex items-center space-x-3">

                                      <div className="flex-shrink-0">

                                        <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">

                                          <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />

                                          </svg>

                                        </div>

                                      </div>

                                      <div className="flex-1 min-w-0">

                                        <p className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate">

                                          {truncateFileName(existingFileJurnal.name, 28)}

                                        </p>

                                        <p className="text-xs text-blue-600 dark:text-blue-400 text-left w-full">

                                          File tersimpan

                                        </p>

                                      </div>

                                    </div>

                                    <div className="flex items-center space-x-1">

                                      <button

                                        onClick={(e) => {

                                          e.preventDefault();

                                          e.stopPropagation();

                                          setExistingFileJurnal(null);

                                        }}

                                        className="flex-shrink-0 p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors duration-200"

                                        title="Hapus file"

                                      >

                                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />

                                        </svg>

                                      </button>

                                    </div>

                                  </div>

                                </div>

                              ) : (

                                <>

                                  <svg className={`w-8 h-8 transition-colors duration-200 ${

                                    isDragOver 

                                      ? 'text-brand-500 dark:text-brand-400' 

                                      : 'text-gray-400 dark:text-gray-500'

                                  }`} fill="none" stroke="currentColor" viewBox="0 0 24 24">

                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />

                                  </svg>

                                  <div className="text-sm transition-colors duration-200">

                                    {isDragOver ? (

                                      <span className="font-medium text-brand-600 dark:text-brand-400">

                                        Lepas file di sini

                                      </span>

                                    ) : (

                                      <>

                                        <span className="font-medium text-brand-600 dark:text-brand-400 hover:text-brand-500 dark:hover:text-brand-300">

                                          Klik untuk memilih file

                                        </span>

                                        <span className="text-gray-500 dark:text-gray-500"> atau drag and drop</span>

                                      </>

                                    )}

                                  </div>

                                  <p className="text-xs text-gray-500 dark:text-gray-500">

                                    Excel, Word, PDF (maks. 10MB)

                                  </p>

                                </>

                              )}

                            </div>

                          </div>

                        </div>

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

                            options={getRuanganOptionsLocal()}

                            value={getRuanganOptionsLocal().find(opt => opt.value === form.lokasi) || null}

                            onChange={opt => setForm(f => ({ ...f, lokasi: opt ? Number(opt.value) : null }))}

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



                    </>

                  )}

                </div>



                

                {/* Error Backend */}

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

                

                <div className="flex justify-end gap-2 pt-6">

                  <button onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition">Batal</button>

                  <button

  onClick={async () => {

    setIsSaving(true);



    try {

    // Validasi kelompok kecil hanya untuk jenis baris PBL

    if (form.jenisBaris === 'pbl') {

      // Cari objek kelompok kecil yang cocok

      const kelompokObj = kelompokKecilList.find(

        k =>

          `Kelompok ${k.nama_kelompok}` === form.kelompok ||

          k.nama_kelompok === form.kelompok ||

          String(k.id) === form.kelompok

      );

      if (!kelompokObj) {

        setErrorForm('Kelompok kecil tidak valid!');

        setIsSaving(false);

        return;

      }

    }



    // Format tanggal ke yyyy-mm-dd

    const tanggalFormatted = (() => {

      if (/^\d{4}-\d{2}-\d{2}$/.test(form.hariTanggal)) return form.hariTanggal;

      const tglStr = form.hariTanggal.split(', ')[1];

      if (tglStr && /^\d{4}-\d{2}-\d{2}$/.test(tglStr)) return tglStr;

      const [d, m, y] = form.hariTanggal.split('/');

      if (d && m && y) return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;

      return form.hariTanggal;

    })();



      if (editIndex !== null) {

      // EDIT MODE (PUT)

      if (form.jenisBaris === 'pbl' && jadwalPBL[editIndex] && jadwalPBL[editIndex].id) {

        const kelompokObj = kelompokKecilList.find(

          k =>

            `Kelompok ${k.nama_kelompok}` === form.kelompok ||

            k.nama_kelompok === form.kelompok ||

            String(k.id) === form.kelompok

        );

        if (!kelompokObj) {

          setErrorForm('Kelompok kecil tidak valid!');

          setIsSaving(false);

          return;

        }

        const payload = {

          tanggal: tanggalFormatted,

          jam_mulai: form.jamMulai,

          jam_selesai: form.jamSelesai,

          jumlah_sesi: form.pblTipe === 'PBL 2' ? 3 : 2,

          modul_pbl_id: Number(form.modul),

          kelompok_kecil_id: kelompokObj.id,

          dosen_id: Number(form.pengampu),

          ruangan_id: Number(form.lokasi),

          pbl_tipe: form.pblTipe,

        };

          await handleEditJadwalPBL(jadwalPBL[editIndex].id!, payload);

      } else if (form.jenisBaris === 'jurnal' && jadwalJurnalReading[editIndex] && jadwalJurnalReading[editIndex].id) {

        // Handle edit untuk jurnal reading

        await handleTambahJadwalJurnalReading();

      } else {

        // Handle edit untuk jenis baris lain

        await handleTambahJadwal();

      }

    } else {

      // TAMBAH MODE (POST)

      if (form.jenisBaris === 'jurnal') {

        await handleTambahJadwalJurnalReading();

      } else {

        await handleTambahJadwal();

      }

      }

      

      // Hanya tutup modal dan reset form jika berhasil (tidak ada error/bentrok)

      setShowModal(false);

      setExistingFileJurnal(null);

      setEditIndex(null);

    } catch (err: any) {

      // Jika ada error dari API, tampilkan pesan error tapi modal tetap terbuka

      setErrorBackend(err?.response?.data?.message || 'Terjadi kesalahan saat menyimpan data');

    }

    

    setIsSaving(false);

  }}

  className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed"

  disabled={

    isSaving ||

    !form.hariTanggal ||

    (form.jenisBaris === 'materi' && (!form.jamMulai || !form.jumlahKali || !form.pengampu || !form.materi || !form.topik || !form.lokasi)) ||

    (form.jenisBaris === 'agenda' && (!form.agenda || !form.jamMulai || !form.jumlahKali || !form.jamSelesai || (form.useRuangan && !form.lokasi))) ||

    (form.jenisBaris === 'praktikum' && (!form.kelasPraktikum || !form.topik)) ||

    // PERBAIKI BAGIAN INI:

    (form.jenisBaris === 'pbl' && (

      !form.pblTipe ||

      !form.jamMulai ||

      !form.jamSelesai ||

      form.modul == null ||

      !form.kelompok ||

      form.pengampu == null ||

      form.lokasi == null

    )) ||

    (form.jenisBaris === 'jurnal' && (!form.hariTanggal || !form.jamMulai || !form.jamSelesai || !form.kelompok || !form.topik || !form.pengampu || !form.lokasi))

  }

>

  {isSaving ? (

    <>

      <svg className="w-5 h-5 mr-2 animate-spin text-white inline-block align-middle" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">

        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>

        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>

      </svg>

      Menyimpan...

    </>

  ) : (

    editIndex !== null ? 'Simpan' : 'Tambah Jadwal'

  )}

</button>

                </div>

              </motion.div>

            </div>

          </>

        )}

      </AnimatePresence>



      {/* Section PBL */}

      <div className="mb-8">

        {/* Info Box untuk Template Support */}
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-5 h-5 mt-0.5">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                Dukungan Template Import Excel
              </h3>
              <p className="text-sm text-blue-700 dark:text-blue-300">
                Fitur Import Excel mendukung 2 jenis template: <strong>Template Aplikasi</strong> (dari download template atau export Excel) dan <strong>Template SIAKAD</strong> (format standar dari sistem SIAKAD). Pilih template yang sesuai dengan file Excel Anda.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between mb-2">

          <h2 className="text-lg font-bold text-gray-800 dark:text-white">PBL</h2>

          <div className="flex items-center gap-3">

            {/* Import Excel Button */}

            <button 
              onClick={() => setShowPBLTemplateSelectionModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform cursor-pointer"
            >
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-brand-700 dark:text-brand-200" />
              Import Excel
            </button>

            

            {/* Download Template Button */}

            <button

              onClick={downloadPBLTemplate}

              className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"

            >

              <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />

              Download Template Excel

            </button>

            {/* Export Excel Button */}
            <button
              onClick={exportPBLExcel}
              disabled={jadwalPBL.length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs transition flex items-center gap-2 ${
                jadwalPBL.length === 0
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                  : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800'
              }`}
              title={jadwalPBL.length === 0 
                ? 'Tidak ada data PBL. Silakan tambahkan data jadwal terlebih dahulu untuk melakukan export.' 
                : 'Export data PBL ke Excel'}
            >
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
              Export ke Excel
            </button>

            

            {/* Tambah Jadwal Button */}

          <button

            onClick={() => {

              setForm({

                hariTanggal: '',

                jamMulai: '',

                jumlahKali: 2,

                jamSelesai: '',

                pengampu: null,

                materi: '',

                topik: '',

                lokasi: null,

                jenisBaris: 'pbl',

                agenda: '',

                kelasPraktikum: '',

                pblTipe: '',

                modul: null,

                kelompok: '',

                kelompokBesar: null,

                useRuangan: true,

                fileJurnal: null,

              });

              setExistingFileJurnal(null);

              setEditIndex(null);

              setShowModal(true);

              resetErrorForm(); // Reset error form saat modal dibuka

              // Fetch semua ruangan

              fetchRuanganForModal();

            }}

            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"

          >

            Tambah Jadwal

          </button>

        </div>

        </div>

        <AnimatePresence>

          {pblImportedCount > 0 && (

            <motion.div

              initial={{ opacity: 0, y: -10 }}

              animate={{ opacity: 1, y: 0 }}

              exit={{ opacity: 0, y: -10 }}

              transition={{ duration: 0.2 }}

              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >

              {pblImportedCount} jadwal PBL berhasil diimpor ke database.

            </motion.div>

          )}

        </AnimatePresence>

        {/* Modal Import SIAKAD */}
        <AnimatePresence>
          {showSIAKADImportModal && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              {/* Overlay */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={handleSIAKADCloseImportModal}
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
                  onClick={handleSIAKADCloseImportModal}
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
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Import Jadwal Kuliah Besar</h2>
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
                            <li>Waktu Selesai → Jam selesai</li>
                            <li>Topik → Topik</li>
                            <li>Ruang → Ruangan</li>
                            <li>Kelompok → Kelompok besar</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Kolom yang <span className="text-red-600 dark:text-red-400">WAJIB diisi manual</span> (tidak ada di SIAKAD):</strong>
                          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                            <li>Materi → Klik kolom "Kosong (isi manual)" untuk mengisi</li>
                            <li>Dosen → Klik kolom "Kosong (isi manual)" untuk memilih dosen</li>
                            <li>Sesi → Klik kolom untuk mengisi jumlah sesi (default: 2)</li>
                          </ul>
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          💡 <strong>Tips:</strong> Klik pada kolom yang menampilkan "Kosong (isi manual)" untuk mengisi data yang diperlukan.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                    {!siakadImportFile ? (
                      /* Upload Section */
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
                                ref={fileInputRef}
                                type="file"
                                accept=".xlsx,.xls"
                                onChange={handleSIAKADImportExcel}
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
                        {siakadImportFile && (
                        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          <div className="flex items-center gap-3">
                            <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-blue-500" />
                            <div className="flex-1">
                              <p className="font-medium text-blue-800 dark:text-blue-200">{siakadImportFile.name}</p>
                              <p className="text-sm text-blue-600 dark:text-blue-300">
                                {(siakadImportFile.size / 1024).toFixed(1)} KB
                              </p>
                            </div>
                              <button
                                onClick={() => {
                                  setSiakadImportFile(null);
                                  setSiakadImportData([]);
                                  setSiakadImportErrors([]);
                                  setSiakadCellErrors([]);
                                  setSiakadEditingCell(null);
                                  setSiakadImportPage(1);
                                  if (fileInputRef.current) {
                                    fileInputRef.current.value = '';
                                  }
                                }}
                                className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
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
                        {(siakadImportErrors.length > 0 || siakadCellErrors.length > 0) && (
                          <div className="mb-6">
                            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                              <div className="flex items-center gap-2 mb-3">
                                <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5 text-red-500" />
                                <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                                  Error Validasi ({siakadImportErrors.length + siakadCellErrors.length} error)
                                </h3>
                              </div>
                              <div className="max-h-40 overflow-y-auto space-y-2">
                                {siakadImportErrors.map((error, index) => (
                                  <p key={index} className="text-sm text-red-600 dark:text-red-400">• {error}</p>
                                ))}
                                {siakadCellErrors.map((error, index) => (
                                  <p key={index} className="text-sm text-red-600 dark:text-red-400">
                                    • {error.message}
                                  </p>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Preview Table */}
                        {siakadImportData.length > 0 && (
                          <div className="mb-6">
                            <div className="flex items-center justify-between mb-4">
                              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                                Preview Data ({siakadImportData.length} jadwal)
                              </h3>
                              <div className="flex items-center gap-3">
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                File: {siakadImportFile?.name}
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
                                      <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Materi</th>
                                      <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>
                                      <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Dosen</th>
                                      <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                                      <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok Besar</th>
                                      <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Sesi</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {siakadImportPaginatedData.map((row, index) => {
                                      const actualIndex = (siakadImportPage - 1) * siakadImportPageSize + index;
                                      const ruangan = allRuanganList.find(r => r.id === row.ruangan_id);
                                      const kelompokBesar = kelompokBesarOptions.find(k => Number(k.id) === row.kelompok_besar_id);
                                      
                                      const renderEditableCell = (field: string, value: any, isNumeric = false) => {
                                        const isEditing = siakadEditingCell?.row === actualIndex && siakadEditingCell?.key === field;
                                        const cellError = siakadCellErrors.find(err => err.row === actualIndex && err.field === field);
                                        
                                        return (
                                          <td
                                            className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError || (field === 'materi' && (!value || value.trim() === '')) || (field === 'dosen_id' && (!value || value === 0 || value === null)) || (field === 'jam_mulai' && (!value || value.trim() === '')) || (field === 'jam_selesai' && (!value || value.trim() === '')) || (field === 'tanggal' && (!value || value.trim() === '')) || value === 'Wajib diisi' ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                            onClick={() => setSiakadEditingCell({ row: actualIndex, key: field })}
                                            title={cellError ? cellError.message : ''}
                                          >
                                            {isEditing ? (
                                              <input
                                                className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                                type={isNumeric ? "number" : "text"}
                                                value={(() => {
                                                  // Jika value adalah placeholder text, kosongkan input
                                                  if (value === 'Kosong (isi manual)' || value === 'Wajib diisi') {
                                                    return "";
                                                  }
                                                  // Jika field adalah dosen_id dan tidak ada value
                                                  if (field === 'dosen_id' && (!value || value === 0 || value === null)) {
                                                    return "";
                                                  }
                                                  // Jika field adalah jam/tanggal dan kosong
                                                  if ((field === 'jam_mulai' || field === 'jam_selesai' || field === 'tanggal') && (!value || value.trim() === '')) {
                                                    return "";
                                                  }
                                                  // Return value as is
                                                  return value || "";
                                                })()}
                                                onChange={e => handleSiakadCellEdit(actualIndex, field, isNumeric ? parseInt(e.target.value) || 0 : e.target.value)}
                                                onBlur={() => setSiakadEditingCell(null)}
                                                autoFocus
                                              />
                                            ) : (
                                              <span className={cellError || (field === 'materi' && (value === 'Kosong (isi manual)' || !value || value.trim() === '')) || (field === 'dosen_id' && (!value || value === 0 || value === null)) || (field === 'jam_mulai' && (!value || value.trim() === '')) || (field === 'jam_selesai' && (!value || value.trim() === '')) || (field === 'tanggal' && (!value || value.trim() === '')) || value === 'Wajib diisi' ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                                {field === 'materi' && (!value || value.trim() === '') ? 'Kosong (isi manual)' : 
                                                 field === 'dosen_id' && (!value || value === 0 || value === null) ? 'Kosong (isi manual)' :
                                                 field === 'jam_mulai' && (!value || value.trim() === '') ? 'Wajib diisi' :
                                                 field === 'jam_selesai' && (!value || value.trim() === '') ? 'Wajib diisi' :
                                                 field === 'tanggal' && (!value || value.trim() === '') ? 'Wajib diisi' :
                                                 value || '-'}
                                              </span>
                                            )}
                                          </td>
                                        );
                                      };
                                      
                                      return (
                                        <tr 
                                          key={index} 
                                          className={`${index % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}`}
                                        >
                                          <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{actualIndex + 1}</td>
                                          {renderEditableCell('tanggal', row.tanggal)}
                                          {renderEditableCell('jam_mulai', row.jam_mulai)}
                                          {renderEditableCell('materi', row.materi)}
                                          {renderEditableCell('topik', row.topik)}
                                          
                                          {/* Dosen - Special handling */}
                                          {(() => {
                                            const field = 'nama_dosen';
                                            const isEditing = siakadEditingCell?.row === actualIndex && siakadEditingCell?.key === field;
                                            const cellError = siakadCellErrors.find(err => err.row === actualIndex && err.field === 'dosen_id');
                                            
                                            return (
                                              <td
                                                className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError || (!row.nama_dosen || row.nama_dosen.trim() === '') ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                                onClick={() => setSiakadEditingCell({ row: actualIndex, key: field })}
                                                title={cellError ? cellError.message : ''}
                                              >
                                                {isEditing ? (
                                                  <input
                                                    className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                                    value={row.nama_dosen || ""}
                                                    onChange={e => handleSiakadDosenEdit(actualIndex, e.target.value)}
                                                    onBlur={() => setSiakadEditingCell(null)}
                                                    autoFocus
                                                  />
                                                ) : (
                                                  <span className={cellError || (!row.nama_dosen || row.nama_dosen.trim() === '') ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                                    {row.nama_dosen || 'Kosong (isi manual)'}
                                                  </span>
                                                )}
                                              </td>
                                            );
                                          })()}
                                          
                                          {/* Ruangan - Special handling */}
                                          {(() => {
                                            const field = 'nama_ruangan';
                                            const isEditing = siakadEditingCell?.row === actualIndex && siakadEditingCell?.key === field;
                                            const cellError = siakadCellErrors.find(err => err.row === actualIndex && err.field === 'ruangan_id');
                                            
                                            return (
                                              <td
                                                className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError || (!row.nama_ruangan || row.nama_ruangan.trim() === '') ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                                onClick={() => setSiakadEditingCell({ row: actualIndex, key: field })}
                                                title={cellError ? cellError.message : ''}
                                              >
                                                {isEditing ? (
                                                  <input
                                                    className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                                    value={row.nama_ruangan === 'Wajib diisi' ? "" : (row.nama_ruangan || "")}
                                                    onChange={e => handleSiakadRuanganEdit(actualIndex, e.target.value)}
                                                    onBlur={() => setSiakadEditingCell(null)}
                                                    autoFocus
                                                  />
                                                ) : (
                                                  <span className={cellError || (!row.nama_ruangan || row.nama_ruangan.trim() === '') ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                                    {row.nama_ruangan || 'Wajib diisi'}
                                                  </span>
                                                )}
                                              </td>
                                            );
                                          })()}
                                          
                                          {/* Kelompok Besar - Special handling */}
                                          {(() => {
                                            const field = 'kelompok_besar_id';
                                            const isEditing = siakadEditingCell?.row === actualIndex && siakadEditingCell?.key === field;
                                            const cellError = siakadCellErrors.find(err => err.row === actualIndex && err.field === field);
                                            
                                            
                                            return (
                                              <td
                                                className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                                onClick={() => setSiakadEditingCell({ row: actualIndex, key: field })}
                                                title={cellError ? cellError.message : ''}
                                              >
                                                {isEditing ? (
                                                  <input
                                                    className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                                    type="number"
                                                    value={row.kelompok_besar_id || ""}
                                                    onChange={e => handleSiakadCellEdit(actualIndex, field, parseInt(e.target.value) || 0)}
                                                    onBlur={() => setSiakadEditingCell(null)}
                                                    autoFocus
                                                  />
                                                ) : (
                                                  <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                                    {kelompokBesar?.label || row.kelompok_besar_id || '-'}
                                                  </span>
                                                )}
                                              </td>
                                            );
                                          })()}
                                          
                                          {renderEditableCell('jumlah_sesi', row.jumlah_sesi, true)}
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Pagination untuk SIAKAD Import Preview */}
                        {siakadImportData.length > siakadImportPageSize && (
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                            <div className="flex items-center gap-4">
                              <select
                                value={siakadImportPageSize}
                                onChange={e => { setSiakadImportPageSize(Number(e.target.value)); setSiakadImportPage(1); }}
                                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                              >
                                <option value={5}>5 per halaman</option>
                                <option value={10}>10 per halaman</option>
                                <option value={20}>20 per halaman</option>
                                <option value={50}>50 per halaman</option>
                              </select>
                              <span className="text-sm text-gray-500 dark:text-gray-400">
                                Menampilkan {((siakadImportPage - 1) * siakadImportPageSize) + 1}-{Math.min(siakadImportPage * siakadImportPageSize, siakadImportData.length)} dari {siakadImportData.length} jadwal
                              </span>
                            </div>
                            
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSiakadImportPage(p => Math.max(1, p - 1))}
                                disabled={siakadImportPage === 1}
                                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                              >
                                Prev
                              </button>
                              
                              {/* Smart Pagination with Scroll */}
                              <div className="flex items-center gap-1 max-w-[400px] overflow-x-auto pagination-scroll" style={{
                                scrollbarWidth: 'thin',
                                scrollbarColor: '#cbd5e1 #f1f5f9'
                              }}>
                                {/* Always show first page if it's not the last page */}
                                {siakadImportTotalPages > 1 && (
                                  <button
                                    onClick={() => setSiakadImportPage(1)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                                      siakadImportPage === 1
                                        ? 'bg-brand-500 text-white'
                                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                  >
                                    1
                                  </button>
                                )}
                                
                                {/* Show ellipsis if current page is far from start */}
                                {siakadImportPage > 4 && (
                                  <span className="px-2 text-gray-500 dark:text-gray-400">...</span>
                                )}
                                
                                {/* Show pages around current page */}
                                {Array.from({ length: siakadImportTotalPages }, (_, i) => {
                                  const pageNum = i + 1;
                                  // Show pages around current page (2 pages before and after)
                                  const shouldShow = pageNum > 1 && pageNum < siakadImportTotalPages && 
                                    (pageNum >= siakadImportPage - 2 && pageNum <= siakadImportPage + 2);
                                  
                                  if (!shouldShow) return null;
                                  
                                  return (
                                    <button
                                      key={pageNum}
                                      onClick={() => setSiakadImportPage(pageNum)}
                                      className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                                        siakadImportPage === pageNum
                                          ? 'bg-brand-500 text-white'
                                          : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                      }`}
                                    >
                                      {pageNum}
                                    </button>
                                  );
                                })}
                                
                                {/* Show ellipsis if current page is far from end */}
                                {siakadImportPage < siakadImportTotalPages - 3 && (
                                  <span className="px-2 text-gray-500 dark:text-gray-400">...</span>
                                )}
                                
                                {/* Always show last page if it's not the first page */}
                                {siakadImportTotalPages > 1 && (
                                  <button
                                    onClick={() => setSiakadImportPage(siakadImportTotalPages)}
                                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                                      siakadImportPage === siakadImportTotalPages
                                        ? 'bg-brand-500 text-white'
                                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                    }`}
                                  >
                                    {siakadImportTotalPages}
                                  </button>
                                )}
                              </div>
                              
                              <button
                                onClick={() => setSiakadImportPage(p => Math.min(siakadImportTotalPages, p + 1))}
                                disabled={siakadImportPage === siakadImportTotalPages}
                                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                              >
                                Next
                              </button>
                            </div>
                          </div>
                        )}
                      </>
                    )}

                    {/* Footer */}
                    {siakadImportFile && (
                      <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                        <button
                          onClick={handleSIAKADCloseImportModal}
                          className="px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                        >
                          Batal
                        </button>
                        {siakadImportData.length > 0 && siakadImportErrors.length === 0 && siakadCellErrors.length === 0 && (
                          <button
                            onClick={handleSIAKADSubmitImport}
                            disabled={isSiakadImporting}
                            className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                          >
                            {isSiakadImporting ? (
                              <>
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                Importing...
                              </>
                            ) : (
                              <>
                                <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                                Import Data ({siakadImportData.length} jadwal)
                              </>
                            )}
                          </button>
                        )}
                      </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Pesan Sukses Bulk Delete untuk PBL */}
        <AnimatePresence>
          {pblSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {pblSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">

          <div className="max-w-full overflow-x-auto hide-scroll" >

            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">

              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">

                <tr>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <button
                      type="button"
                      aria-checked={jadwalPBL.length > 0 && jadwalPBL.every(item => selectedPBLItems.includes(item.id!))}
                      role="checkbox"
                      onClick={() => handleSelectAll('pbl', jadwalPBL)}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${jadwalPBL.length > 0 && jadwalPBL.every(item => selectedPBLItems.includes(item.id!)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                    >
                      {jadwalPBL.length > 0 && jadwalPBL.every(item => selectedPBLItems.includes(item.id!)) && (
                        <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                          <polyline points="20 7 11 17 4 10" />
                        </svg>
                      )}
                    </button>
                  </th>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Hari/Tanggal</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Tipe PBL</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pukul</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Waktu</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Modul</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pengampu</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>

                </tr>

              </thead>

              <tbody>

                {loadingPBL ? (

                  // Skeleton loading untuk tabel PBL

                  Array.from({ length: 3 }).map((_, index) => (

                    <tr key={`skeleton-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>

                      <td className="px-4 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-8 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-32 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-12 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-28 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>

                      </td>

                      <td className="px-4 py-4">

                        <div className="flex gap-2 justify-center">

                          <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>

                          <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>

                          <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>

                        </div>

                      </td>

                    </tr>

                  ))

                ) : jadwalPBL.length === 0 ? (

                  <tr>

                    <td colSpan={11} className="text-center py-6 text-gray-400">Tidak ada data PBL</td>

                  </tr>

                ) : (

                  jadwalPBL

                  .slice()

                  .sort((a: JadwalPBLType, b: JadwalPBLType) => {

                    const dateA = new Date(a.tanggal);

                    const dateB = new Date(b.tanggal);

                    return dateA.getTime() - dateB.getTime();

                  })

                  .map((row: JadwalPBLType, i: number) => (

                    <tr key={row.id} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>

                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          aria-checked={selectedPBLItems.includes(row.id!)}
                          role="checkbox"
                          onClick={() => handleSelectItem('pbl', row.id!)}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedPBLItems.includes(row.id!) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                        >
                          {selectedPBLItems.includes(row.id!) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <polyline points="20 7 11 17 4 10" />
                            </svg>
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{i + 1}</td>

                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                        {row.tanggal ? formatTanggalKonsisten(row.tanggal) : ''}

                        </td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.pbl_tipe}</td>

                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatJamTanpaDetik(row.jam_mulai)}–{formatJamTanpaDetik(row.jam_selesai)}</td>

                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi || 1} x 50 menit</td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                          {modulPBLList.find(m => m.id === Number(row.modul_pbl_id))?.nama_modul || (loadingPBL ? 'Memuat...' : `Modul ${row.modul_pbl_id}`)}

                      </td>

                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                        {row.kelompok_kecil?.nama_kelompok || 'Memuat...'}

                      </td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                        {row.dosen_names || allDosenList.find(d => d.id === Number(row.dosen_id))?.name || (loadingDosenRuangan ? 'Memuat...' : `Dosen ${row.dosen_id}`)}

                      </td>

                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                          {allRuanganList.find(r => r.id === Number(row.ruangan_id))?.nama || (loadingDosenRuangan ? 'Memuat...' : `Ruangan ${row.ruangan_id}`)}

                        </td>

                        <td className="px-4 py-4 text-center whitespace-nowrap">

                          <button

                            onClick={() => navigate(`/penilaian-pbl/${kode}/${row.kelompok_kecil?.nama_kelompok || ''}/${row.pbl_tipe || ''}?rowIndex=${i}`)}

                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-400 transition mr-2"

                            title="Nilai"

                          >

                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                            </svg>

                            <span className="hidden sm:inline">Nilai</span>

                          </button>

                          <button onClick={() => handleEditJadwal(jadwalPBL.findIndex((j: JadwalPBLType) => j.id === row.id), 'pbl')} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition mr-2" title="Edit Jadwal">

                            <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />

                            <span className="hidden sm:inline">Edit</span>

                          </button>

                          <button onClick={() => { 

                            setSelectedDeleteIndex(i); 

                            setSelectedDeleteType('pbl');

                            setShowDeleteModal(true); 

                          }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" title="Hapus Jadwal">

                            <FontAwesomeIcon icon={faTrash} className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />

                            <span className="hidden sm:inline">Hapus</span>

                          </button>

                        </td>

                      </tr>

                    ))

                )}

              </tbody>

            </table>

          </div>

        </div>

        {/* Tombol Hapus Terpilih untuk PBL */}
        {selectedPBLItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              disabled={isBulkDeleting}
              onClick={() => handleBulkDelete('pbl')}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${isBulkDeleting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-theme-xs hover:bg-red-600'}`}
            >
              {isBulkDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedPBLItems.length})`}
            </button>
          </div>
        )}

      </div>

      {/* Section Jurnal Reading */}

      <div className="mb-8">

        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Jurnal Reading</h2>
          <div className="flex items-center gap-2">
            {/* Import Excel Button */}
            <button 
              onClick={() => setShowJurnalReadingImportModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform cursor-pointer">
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-brand-700 dark:text-brand-200" />
              Import Excel
            </button>
            {/* Download Template Button */}
            <button onClick={downloadJurnalReadingTemplate} className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2">
              <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
              Download Template Excel
            </button>
            {/* Export Excel Button */}
            <button
              onClick={exportJurnalReadingExcel}
              disabled={jadwalJurnalReading.length === 0}
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs transition flex items-center gap-2 ${
                jadwalJurnalReading.length === 0
                  ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed' 
                  : 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800'
              }`}
              title={jadwalJurnalReading.length === 0 
                ? 'Tidak ada data jurnal reading. Silakan tambahkan data jadwal terlebih dahulu untuk melakukan export.' 
                : 'Export data jurnal reading ke Excel'}
            >
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
              Export ke Excel
            </button>
            {/* Tambah Jadwal Button */}
            <button
              onClick={() => {
                setForm({
                  hariTanggal: '',
                  jamMulai: '',
                  jumlahKali: 1,
                  jamSelesai: '',
                  pengampu: null,
                  materi: '',
                  topik: '',
                  lokasi: null,
                  jenisBaris: 'jurnal',
                  agenda: '',
                  kelasPraktikum: '',
                  pblTipe: '',
                  modul: null,
                  kelompok: '',
                  kelompokBesar: null,
                  useRuangan: true,
                  fileJurnal: null,
                });
                setExistingFileJurnal(null);
                setEditIndex(null);
                setShowModal(true);
                setErrorForm('');
              }}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"
            >
              Tambah Jadwal
            </button>
          </div>
        </div>

        {/* Success Message untuk Jurnal Reading */}
        <AnimatePresence>
          {jurnalReadingImportedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
              onAnimationComplete={() => {
                setTimeout(() => {
                  setJurnalReadingImportedCount(0);
                }, 5000);
              }}
            >
              {jurnalReadingImportedCount} jadwal Jurnal Reading berhasil diimpor ke database.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Pesan Sukses Bulk Delete untuk Jurnal Reading */}
        <AnimatePresence>
          {jurnalReadingSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {jurnalReadingSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">

          <div className="max-w-full overflow-x-auto hide-scroll" >

            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">

              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">

                <tr>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    <button
                      type="button"
                      aria-checked={jadwalJurnalReading.length > 0 && jadwalJurnalReading.every(item => selectedJurnalReadingItems.includes(item.id!))}
                      role="checkbox"
                      onClick={() => handleSelectAll('jurnal-reading', jadwalJurnalReading)}
                      className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${jadwalJurnalReading.length > 0 && jadwalJurnalReading.every(item => selectedJurnalReadingItems.includes(item.id!)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                    >
                      {jadwalJurnalReading.length > 0 && jadwalJurnalReading.every(item => selectedJurnalReadingItems.includes(item.id!)) && (
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

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Pengampu</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">File Jurnal</th>

                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>

                  <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>

                </tr>

              </thead>

              <tbody>

                {loading ? (

                  // Skeleton loading untuk tabel Jurnal Reading

                  Array.from({ length: 3 }).map((_, index) => (

                    <tr key={`skeleton-jurnal-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>

                      <td className="px-4 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-8 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-12 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-24 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-28 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-16 animate-pulse"></div>

                      </td>

                      <td className="px-6 py-4">

                        <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded w-20 animate-pulse"></div>

                      </td>

                      <td className="px-4 py-4">

                        <div className="flex gap-2 justify-center">

                          <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>

                          <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>

                          <div className="h-6 w-6 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>

                        </div>

                      </td>

                    </tr>

                  ))

                ) : jadwalJurnalReading.length === 0 ? (

                  <tr>

                    <td colSpan={11} className="text-center py-6 text-gray-400">Tidak ada data Jurnal Reading</td>

                  </tr>

                ) : (

                  jadwalJurnalReading.map((row: any, i: number) => (

                    <tr key={row.id} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>

                      <td className="px-4 py-4 text-center">
                        <button
                          type="button"
                          aria-checked={selectedJurnalReadingItems.includes(row.id!)}
                          role="checkbox"
                          onClick={() => handleSelectItem('jurnal-reading', row.id!)}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedJurnalReadingItems.includes(row.id!) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                        >
                          {selectedJurnalReadingItems.includes(row.id!) && (
                            <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                              <polyline points="20 7 11 17 4 10" />
                            </svg>
                          )}
                        </button>
                      </td>

                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{i + 1}</td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                        {row.tanggal ? formatTanggalKonsisten(row.tanggal) : ''}

                      </td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatJamTanpaDetik(row.jam_mulai)}–{formatJamTanpaDetik(row.jam_selesai)}</td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi} x 50 menit</td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.kelompok_kecil?.nama_kelompok || 'Memuat...'}</td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.topik}</td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                        {row.dosen_names || allDosenList.find(d => d.id === Number(row.dosen_id))?.name || (loadingDosenRuangan ? 'Memuat...' : `Dosen ${row.dosen_id}`)}

                      </td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                        {row.file_jurnal ? (

                          <div className="flex items-center space-x-2">

                            <div className="flex-shrink-0">

                              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">

                                <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />

                                </svg>

                              </div>

                            </div>

                            <div className="flex-1 min-w-0">

                              <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">

                                {truncateFileName(row.file_jurnal.split('/').pop() || 'File Jurnal', 20)}

                              </p>

                              <p className="text-xs text-gray-500 dark:text-gray-400">

                                File Jurnal

                              </p>

                            </div>

                            <div className="flex-shrink-0">

                              <a 

                                href={`${API_BASE_URL}/jurnal-reading/download/${data!.kode}/${row.id}`} 

                                target="_blank" 

                                rel="noopener noreferrer" 

                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-md transition-colors duration-200"

                                title="Download File"

                              >

                                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">

                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />

                                </svg>

                                <span className="hidden sm:inline">Download</span>

                              </a>

                            </div>

                          </div>

                        ) : (

                          <span className="text-gray-400 dark:text-gray-500 text-sm">-</span>

                        )}

                      </td>

                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">

                        {allRuanganList.find(r => r.id === Number(row.ruangan_id))?.nama || (loadingDosenRuangan ? 'Memuat...' : `Ruangan ${row.ruangan_id}`)}

                      </td>

                      <td className="px-4 py-4 text-center whitespace-nowrap">

                        <button

                          onClick={() => {

                            // Validasi data sebelum navigasi

                            if (!(row as any).kelompok_kecil?.nama_kelompok) {

                              alert('Data kelompok tidak ditemukan');

                              return;

                            }

                            

                            // Simpan data jurnal ke localStorage untuk halaman penilaian

                            const jurnalData = {

                              dosen: (row as any).dosen_names || allDosenList.find(d => d.id === Number((row as any).dosen_id))?.name || '',

                              tanggal: (row as any).tanggal,

                              judulJurnal: (row as any).topik

                            };

                            

                            const storageKey = `jurnalInfo_${data!.kode}_${(row as any).kelompok_kecil.nama_kelompok}_${row.id}`;

                            localStorage.setItem(storageKey, JSON.stringify(jurnalData));

                            

                            // Navigasi ke halaman penilaian dengan jurnal_id

                            navigate(`/penilaian-jurnal/${data!.kode}/${(row as any).kelompok_kecil.nama_kelompok}/${row.id}`);

                          }}

                          className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-yellow-500 hover:text-yellow-600 dark:hover:text-yellow-400 transition mr-2"

                          title="Nilai"

                        >

                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                          </svg>

                          <span className="hidden sm:inline">Nilai</span>

                        </button>

                        <button onClick={() => handleEditJadwalJurnalReading(i)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition mr-2" title="Edit Jadwal">

                          <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />

                          <span className="hidden sm:inline">Edit</span>

                        </button>

                        <button onClick={() => handleDeleteJadwalJurnalReading(i)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" title="Hapus Jadwal">

                          <FontAwesomeIcon icon={faTrash} className="w-4 h-4 sm:w-5 sm:h-5 text-red-500" />

                          <span className="hidden sm:inline">Hapus</span>

                        </button>

                      </td>

                    </tr>

                  ))

                )}

              </tbody>

            </table>

          </div>

        </div>

        {/* Tombol Hapus Terpilih untuk Jurnal Reading */}
        {selectedJurnalReadingItems.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-4">
            <button
              disabled={isBulkDeleting}
              onClick={() => handleBulkDelete('jurnal-reading')}
              className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${isBulkDeleting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-theme-xs hover:bg-red-600'}`}
            >
              {isBulkDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedJurnalReadingItems.length})`}
            </button>
          </div>
        )}

      </div>

      <AnimatePresence>

        {showDeleteModal && (

          <div className="fixed inset-0 z-[100000] flex items-center justify-center">

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-sm" onClick={() => setShowDeleteModal(false)} />

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-50 hide-scroll">

              <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Konfirmasi Hapus</h2>

              <p className="mb-6 text-gray-500 dark:text-gray-300">Apakah Anda yakin ingin menghapus data ini? Data yang dihapus tidak dapat dikembalikan.</p>

              <div className="flex justify-end gap-2">

                <button onClick={() => setShowDeleteModal(false)} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition">Batal</button>

                <button onClick={() => { 

                  if (selectedDeleteIndex !== null) { 

                    // Cek apakah yang dihapus adalah kuliah besar, PBL, atau jadwal biasa

                    if (selectedDeleteType === 'materi') {

                      handleDeleteJadwalKuliahBesar(selectedDeleteIndex);

                    } else if (selectedDeleteType === 'pbl') {

                      handleDeleteJadwal(selectedDeleteIndex);

                    } else {

                      handleDeleteJadwal(selectedDeleteIndex);

                    }

                    setShowDeleteModal(false); 

                    setSelectedDeleteIndex(null); 

                    setSelectedDeleteType('other');

                  } 

                }} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition">Hapus</button>

              </div>

            </motion.div>

          </div>

        )}

      </AnimatePresence>

      <AnimatePresence>

        {showDeleteAgendaModal && (

          <div className="fixed inset-0 z-[100000] flex items-center justify-center">

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-sm" onClick={() => setShowDeleteAgendaModal(false)} />

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-50 hide-scroll">

              <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Konfirmasi Hapus</h2>

              <p className="mb-6 text-gray-500 dark:text-gray-300">Apakah Anda yakin ingin menghapus data ini? Data yang dihapus tidak dapat dikembalikan.</p>

              <div className="flex justify-end gap-2">

                <button onClick={() => setShowDeleteAgendaModal(false)} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition">Batal</button>

                <button onClick={handleConfirmDeleteAgendaKhusus} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition">Hapus</button>

              </div>

            </motion.div>

          </div>

        )}

      </AnimatePresence>

      <AnimatePresence>

        {showDeletePraktikumModal && (

          <div className="fixed inset-0 z-[100000] flex items-center justify-center">

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-sm" onClick={() => setShowDeletePraktikumModal(false)} />

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-50 hide-scroll">

              <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Konfirmasi Hapus</h2>

              <p className="mb-6 text-gray-500 dark:text-gray-300">Apakah Anda yakin ingin menghapus data ini? Data yang dihapus tidak dapat dikembalikan.</p>

              <div className="flex justify-end gap-2">

                <button onClick={() => setShowDeletePraktikumModal(false)} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition">Batal</button>

                <button onClick={handleConfirmDeletePraktikum} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition">Hapus</button>

              </div>

            </motion.div>

          </div>

        )}

      </AnimatePresence>

      <AnimatePresence>

        {showDeleteJurnalReadingModal && (

          <div className="fixed inset-0 z-[100000] flex items-center justify-center">

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-sm" onClick={() => setShowDeleteJurnalReadingModal(false)} />

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ duration: 0.2 }} className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-50 hide-scroll">

              <h2 className="text-lg font-bold mb-4 text-gray-800 dark:text-white">Konfirmasi Hapus</h2>

              <p className="mb-6 text-gray-500 dark:text-gray-300">Apakah Anda yakin ingin menghapus data ini? Data yang dihapus tidak dapat dikembalikan.</p>

              <div className="flex justify-end gap-2">

                <button onClick={() => setShowDeleteJurnalReadingModal(false)} className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition">Batal</button>

                <button onClick={handleConfirmDeleteJurnalReading} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition">Hapus</button>

              </div>

            </motion.div>

          </div>

        )}

      </AnimatePresence>

      

      {/* Modal Pilihan Template */}
      <AnimatePresence>
        {showTemplateSelectionModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowTemplateSelectionModal(false)}
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
                onClick={() => setShowTemplateSelectionModal(false)}
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
                      onClick={() => handleTemplateSelection('LAMA')}
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
                      onClick={() => handleTemplateSelection('SIAKAD')}
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
                
                <div className="flex justify-end gap-2 pt-2 relative z-20">
                  <button
                    onClick={() => setShowTemplateSelectionModal(false)}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Import Excel */}

      <AnimatePresence>

        {showImportModal && (

          <div className="fixed inset-0 z-[100000] flex items-center justify-center">

            {/* Overlay */}

            <motion.div 

              initial={{ opacity: 0 }}

              animate={{ opacity: 1 }}

              exit={{ opacity: 0 }}

              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"

              onClick={handleCloseImportModal}

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

                onClick={handleCloseImportModal}

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

                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Import Jadwal Kuliah Besar</h2>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedTemplate === 'LAMA' ? 'Template Aplikasi' : 'Template SIAKAD'} - Preview dan validasi data sebelum import
                </p>

              </div>

              {/* Info Box untuk Template SIAKAD Kuliah Besar */}
              {selectedTemplate === 'SIAKAD' && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                  </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                        Informasi Mapping Template SIAKAD Kuliah Besar
                      </h3>
                      <div className="text-sm text-green-700 dark:text-green-300 space-y-2">
                        <div>
                          <strong>Kolom yang tersedia di SIAKAD:</strong>
                          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                            <li>Tanggal → Tanggal</li>
                            <li>Waktu Mulai → Jam mulai</li>
                            <li>Topik → Topik</li>
                            <li>Ruang → Ruangan</li>
                            <li>Kelompok Besar → Kelompok besar</li>
                          </ul>
                </div>
                        <div>
                          <strong>Kolom yang <span className="text-red-600 dark:text-red-400">WAJIB diisi manual</span> (tidak ada di SIAKAD):</strong>
                          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                            <li>Materi → Klik kolom "Kosong (isi manual)" untuk mengisi</li>
                            <li>Dosen → Klik kolom "Kosong (isi manual)" untuk memilih dosen</li>
                            <li>Sesi → Klik kolom "Kosong (isi manual)" untuk mengisi</li>
                          </ul>
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          💡 <strong>Tips:</strong> Klik pada kolom yang menampilkan "Kosong (isi manual)" untuk mengisi data yang diperlukan. Jam selesai akan otomatis dihitung berdasarkan jam mulai dan sesi.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

                  {/* Upload Section */}
                  {!(selectedTemplate === 'LAMA' ? importFile : siakadImportFile) && (
                    <div className="mb-6">
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-brand-500 dark:hover:border-brand-400 transition-colors">
                        <div className="space-y-4">
                          <div className="w-16 h-16 mx-auto bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center">
                            <FontAwesomeIcon icon={faFileExcel} className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                          </div>
                          <div>
                            <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                              Upload File Excel {selectedTemplate === 'LAMA' ? '' : 'SIAKAD'}
                            </h3>
                            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                              Pilih file Excel dengan format {selectedTemplate === 'LAMA' ? 'template aplikasi' : 'SIAKAD'} (.xlsx, .xls)
                            </p>
                          </div>
                          <label className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors cursor-pointer">
                            <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                            Pilih File
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".xlsx,.xls"
                              onChange={handleImportExcel}
                              className="hidden"
                            />
                          </label>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* File Info */}

                  {(selectedTemplate === 'LAMA' ? importFile : siakadImportFile) && (

                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">

                      <div className="flex items-center gap-3">

                        <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-blue-500" />

                        <div className="flex-1">

                          <p className="font-medium text-blue-800 dark:text-blue-200">
                            {(selectedTemplate === 'LAMA' ? importFile : siakadImportFile)?.name}
                          </p>

                          <p className="text-sm text-blue-600 dark:text-blue-300">

                            {(((selectedTemplate === 'LAMA' ? importFile : siakadImportFile)?.size || 0) / 1024).toFixed(1)} KB

                          </p>

                        </div>

                        <button
                          onClick={() => {
                            if (selectedTemplate === 'LAMA') {
                              setImportFile(null);
                              setImportData([]);
                              setImportErrors([]);
                              setCellErrors([]);
                              setEditingCell(null);
                              setImportPage(1);
                            } else {
                              setSiakadImportFile(null);
                              setSiakadImportData([]);
                              setSiakadImportErrors([]);
                              setSiakadCellErrors([]);
                              setSiakadEditingCell(null);
                              setSiakadImportPage(1);
                            }
                            if (fileInputRef.current) {
                              fileInputRef.current.value = '';
                            }
                          }}
                          className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
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

                  {((selectedTemplate === 'LAMA' ? importErrors : siakadImportErrors).length > 0 || (selectedTemplate === 'LAMA' ? cellErrors : siakadCellErrors).length > 0) && (

                    <div className="mb-6">

                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">

                        <div className="flex items-center gap-2 mb-3">

                          <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5 text-red-500" />

                          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">

                            Error Validasi ({(selectedTemplate === 'LAMA' ? importErrors : siakadImportErrors).length + (selectedTemplate === 'LAMA' ? cellErrors : siakadCellErrors).length} error)

                          </h3>

                        </div>

                        <div className="max-h-40 overflow-y-auto">

                          {/* Error dari API response */}

                          {(selectedTemplate === 'LAMA' ? importErrors : siakadImportErrors).map((err, idx) => (

                            <p key={idx} className="text-sm text-red-600 dark:text-red-400 mb-1">• {err}</p>

                          ))}

                          {/* Error cell/detail */}

                          {(selectedTemplate === 'LAMA' ? cellErrors : siakadCellErrors).map((err, idx) => (

                            <p key={idx} className="text-sm text-red-600 dark:text-red-400 mb-1">

                              • {err.message} (Baris {err.row + 1}, Kolom {err.field.toUpperCase()})

                            </p>

                          ))}

                        </div>

                      </div>

                    </div>

                  )}



                  {/* Preview Data Table */}

                  {(selectedTemplate === 'LAMA' ? importData : siakadImportData).length > 0 && (

                    <div className="mb-6">

                      <div className="flex items-center justify-between mb-4">

                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">

                          Preview Data ({(selectedTemplate === 'LAMA' ? importData : siakadImportData).length} jadwal)

                        </h3>

                        <div className="flex items-center gap-3">

                        <div className="text-sm text-gray-500 dark:text-gray-400">

                          File: {importFile?.name}

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

                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Materi</th>

                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>

                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Dosen</th>

                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>

                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok Besar</th>

                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Sesi</th>

                              </tr>

                            </thead>

                            <tbody>

                              {(selectedTemplate === 'LAMA' ? importPaginatedData : siakadImportPaginatedData).map((row, index) => {

                                const actualIndex = ((selectedTemplate === 'LAMA' ? importPage : siakadImportPage) - 1) * importPageSize + index;

                                const dosen = dosenList.find(d => d.id === row.dosen_id);

                                const ruangan = ruanganList.find(r => r.id === row.ruangan_id);

                                const kelompokBesar = kelompokBesarOptions.find(k => Number(k.id) === row.kelompok_besar_id);

                                

                                const renderEditableCell = (field: string, value: any, isNumeric = false) => {

                                  const isEditing = (selectedTemplate === 'LAMA' ? editingCell : siakadEditingCell)?.row === actualIndex && (selectedTemplate === 'LAMA' ? editingCell : siakadEditingCell)?.key === field;

                                  const cellError = (selectedTemplate === 'LAMA' ? cellErrors : siakadCellErrors).find(err => err.row === actualIndex && err.field === field);

                                  

                                  return (

                                    <td

                                      className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}

                                      onClick={() => selectedTemplate === 'LAMA' ? setEditingCell({ row: actualIndex, key: field }) : setSiakadEditingCell({ row: actualIndex, key: field })}

                                      title={cellError ? cellError.message : ''}

                                    >

                                      {isEditing ? (

                                        <input

                                          className="w-full px-1 border-none outline-none text-xs md:text-sm"

                                          type={isNumeric ? "number" : "text"}

                                          value={(() => {
                                            // Jika value adalah placeholder text, kosongkan input
                                            if (value === 'Kosong (isi manual)' || value === 'Wajib diisi') {
                                              return "";
                                            }
                                            // Jika field adalah dosen_id dan tidak ada value
                                            if (field === 'dosen_id' && (!value || value === 0 || value === null)) {
                                              return "";
                                            }
                                            // Jika field adalah jam/tanggal dan kosong
                                            if ((field === 'jam_mulai' || field === 'jam_selesai' || field === 'tanggal') && (!value || value.trim() === '')) {
                                              return "";
                                            }
                                            // Return value as is
                                            return value || "";
                                          })()}

                                          onChange={e => selectedTemplate === 'LAMA' ? handleCellEdit(actualIndex, field, e.target.value) : handleSiakadCellEdit(actualIndex, field, e.target.value)}

                                          onBlur={() => selectedTemplate === 'LAMA' ? setEditingCell(null) : setSiakadEditingCell(null)}

                                          autoFocus

                                        />

                                      ) : (

                                        <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                          {value || '-'}
                                        </span>
                                      )}

                                    </td>

                                  );

                                };

                                

                                return (

                                  <tr 

                                    key={index} 

                                    className={`${index % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}`}

                                  >

                                    <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{index + 1}</td>

                                    {renderEditableCell('tanggal', row.tanggal)}

                                    {renderEditableCell('jam_mulai', row.jam_mulai)}

                                    {renderEditableCell('materi', row.materi)}

                                    {renderEditableCell('topik', row.topik)}

                                    

                                    {/* Dosen - Special handling */}

                                    {(() => {

                                      const field = 'nama_dosen';

                                      const isEditing = (selectedTemplate === 'LAMA' ? editingCell : siakadEditingCell)?.row === index && (selectedTemplate === 'LAMA' ? editingCell : siakadEditingCell)?.key === field;

                                      const cellError = (selectedTemplate === 'LAMA' ? cellErrors : siakadCellErrors).find(err => err.row === index && err.field === 'dosen_id');
                                      

                                      return (

                                        <td

                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}

                                          onClick={() => selectedTemplate === 'LAMA' ? setEditingCell({ row: index, key: field }) : setSiakadEditingCell({ row: index, key: field })}

                                          title={cellError ? cellError.message : ''}

                                        >

                                          {isEditing ? (

                                            <input

                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"

                                              value={row.nama_dosen || dosen?.name || ""}

                                              onChange={e => selectedTemplate === 'LAMA' ? handleDosenEdit(actualIndex, e.target.value) : handleSiakadDosenEdit(actualIndex, e.target.value)}

                                              onBlur={() => selectedTemplate === 'LAMA' ? setEditingCell(null) : setSiakadEditingCell(null)}

                                              autoFocus

                                            />

                                          ) : (

                                            <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                              {dosen?.name || (row as any).nama_dosen || 'Tidak ditemukan'}
                                            </span>

                                          )}

                                        </td>

                                      );

                                    })()}

                                    

                                    {/* Ruangan - Special handling */}

                                    {(() => {

                                      const field = 'nama_ruangan';

                                      const isEditing = (selectedTemplate === 'LAMA' ? editingCell : siakadEditingCell)?.row === index && (selectedTemplate === 'LAMA' ? editingCell : siakadEditingCell)?.key === field;

                                      const cellError = (selectedTemplate === 'LAMA' ? cellErrors : siakadCellErrors).find(err => err.row === index && err.field === 'ruangan_id');
                                      

                                      return (

                                        <td

                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}

                                          onClick={() => selectedTemplate === 'LAMA' ? setEditingCell({ row: index, key: field }) : setSiakadEditingCell({ row: index, key: field })}

                                          title={cellError ? cellError.message : ''}

                                        >

                                          {isEditing ? (

                                            <input

                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"

                                              value={row.nama_ruangan || ruangan?.nama || ""}

                                              onChange={e => selectedTemplate === 'LAMA' ? handleRuanganEdit(actualIndex, e.target.value) : handleSiakadRuanganEdit(actualIndex, e.target.value)}

                                              onBlur={() => selectedTemplate === 'LAMA' ? setEditingCell(null) : setSiakadEditingCell(null)}

                                              autoFocus

                                            />

                                          ) : (

                                            <span className={cellError ? 'text-red-500' : (ruangan ? 'text-gray-800 dark:text-white/90' : 'text-red-500')}>
                                              {ruangan?.nama || (row as any).nama_ruangan || 'Tidak ditemukan'}
                                            </span>

                                          )}

                                        </td>

                                      );

                                    })()}

                                    

                                    {(() => {

                                      const field = 'kelompok_besar_id';

                                      const isEditing = (selectedTemplate === 'LAMA' ? editingCell : siakadEditingCell)?.row === index && (selectedTemplate === 'LAMA' ? editingCell : siakadEditingCell)?.key === field;

                                      const cellError = (selectedTemplate === 'LAMA' ? cellErrors : siakadCellErrors).find(err => err.row === index && err.field === field);

                                      

                                      return (

                                        <td

                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}

                                          onClick={() => selectedTemplate === 'LAMA' ? setEditingCell({ row: index, key: field }) : setSiakadEditingCell({ row: index, key: field })}

                                          title={cellError ? cellError.message : ''}

                                        >

                                          {isEditing ? (

                                            <input

                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"

                                              type="number"

                                              value={row.kelompok_besar_id || ""}

                                              onChange={e => {
                                                if (selectedTemplate === 'LAMA') {
                                                  handleCellEdit(actualIndex, field, e.target.value);
                                                } else {
                                                  handleSiakadCellEdit(actualIndex, field, parseInt(e.target.value) || 0);
                                                }
                                              }}

                                              onBlur={() => {
                                                if (selectedTemplate === 'LAMA') {
                                                  setEditingCell(null);
                                                } else {
                                                  setSiakadEditingCell(null);
                                                }
                                              }}

                                              autoFocus

                                            />

                                          ) : (

                                            <span className={cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}>
                                              {kelompokBesar ? kelompokBesar.label : `ID ${row.kelompok_besar_id}`}

                                            </span>

                                          )}

                                        </td>

                                      );

                                    })()}

                                    {renderEditableCell('jumlah_sesi', row.jumlah_sesi, true)}

                                  </tr>

                                );

                              })}

                            </tbody>

                          </table>

                        </div>

                      </div>

                      

                      {/* Pagination untuk Import Preview */}

                      {(selectedTemplate === 'LAMA' ? importData : siakadImportData).length > importPageSize && (

                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700">

                          <div className="flex items-center gap-4">

                            <select

                              value={importPageSize}

                              onChange={e => { setImportPageSize(Number(e.target.value)); setImportPage(1); }}

                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"

                            >

                              <option value={5}>5 per halaman</option>

                              <option value={10}>10 per halaman</option>

                              <option value={20}>20 per halaman</option>

                              <option value={50}>50 per halaman</option>

                            </select>

                            <span className="text-sm text-gray-500 dark:text-gray-400">

                              Menampilkan {((selectedTemplate === 'LAMA' ? importPage : siakadImportPage) - 1) * importPageSize + 1}-{Math.min((selectedTemplate === 'LAMA' ? importPage : siakadImportPage) * importPageSize, (selectedTemplate === 'LAMA' ? importData : siakadImportData).length)} dari {(selectedTemplate === 'LAMA' ? importData : siakadImportData).length} jadwal

                            </span>

                          </div>

                          

                          <div className="flex items-center gap-2">

                            <button

                              onClick={() => setImportPage(p => Math.max(1, p - 1))}

                              disabled={importPage === 1}

                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"

                            >

                              Prev

                            </button>

                            

                            {/* Smart Pagination with Scroll */}

                            <div className="flex items-center gap-1 max-w-[400px] overflow-x-auto pagination-scroll" style={{

                              scrollbarWidth: 'thin',

                              scrollbarColor: '#cbd5e1 #f1f5f9'

                            }}>

                              <style dangerouslySetInnerHTML={{

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

                                `

                              }} />

                              

                              {/* Always show first page if it's not the last page */}

                              {importTotalPages > 1 && (

                                <button

                                  onClick={() => setImportPage(1)}

                                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${

                                    importPage === 1

                                      ? 'bg-brand-500 text-white'

                                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'

                                  }`}

                                >

                                  1

                                </button>

                              )}

                              

                              {/* Show ellipsis if current page is far from start */}

                              {importPage > 4 && (

                                <span className="px-2 text-gray-500 dark:text-gray-400">...</span>

                              )}

                              

                              {/* Show pages around current page */}

                              {Array.from({ length: importTotalPages }, (_, i) => {

                                const pageNum = i + 1;

                                // Show pages around current page (2 pages before and after)

                                const shouldShow = pageNum > 1 && pageNum < importTotalPages && 

                                  (pageNum >= importPage - 2 && pageNum <= importPage + 2);

                                

                                if (!shouldShow) return null;

                                

                                return (

                                  <button

                                    key={pageNum}

                                    onClick={() => setImportPage(pageNum)}

                                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${

                                      importPage === pageNum

                                        ? 'bg-brand-500 text-white'

                                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'

                                    }`}

                                  >

                                    {pageNum}

                                  </button>

                                );

                              })}

                              

                              {/* Show ellipsis if current page is far from end */}

                              {importPage < importTotalPages - 3 && (

                                <span className="px-2 text-gray-500 dark:text-gray-400">...</span>

                              )}

                              

                              {/* Always show last page if it's not the first page */}

                              {importTotalPages > 1 && (

                                <button

                                  onClick={() => setImportPage(importTotalPages)}

                                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${

                                    importPage === importTotalPages

                                      ? 'bg-brand-500 text-white'

                                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'

                                  }`}

                                >

                                  {importTotalPages}

                                </button>

                              )}

                            </div>

                            

                            <button

                              onClick={() => setImportPage(p => Math.min(importTotalPages, p + 1))}

                              disabled={importPage === importTotalPages}

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

                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">

                    <button

                      onClick={handleCloseImportModal}

                      className="px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"

                    >

                      Batal

                    </button>

                    {(selectedTemplate === 'LAMA' ? importData : siakadImportData).length > 0 && (selectedTemplate === 'LAMA' ? importErrors : siakadImportErrors).length === 0 && (selectedTemplate === 'LAMA' ? cellErrors : siakadCellErrors).length === 0 && (

                      <button

                        onClick={handleSubmitImport}

                        disabled={isImporting}

                        className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"

                      >

                        {isImporting ? (

                          <>

                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>

                            Importing...

                          </>

                        ) : (

                          <>

                            <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />

                            Import Data ({(selectedTemplate === 'LAMA' ? importData : siakadImportData).length} jadwal)

                          </>

                        )}

                      </button>

                    )}

                  </div>

            </motion.div>

          </div>

        )}

      </AnimatePresence>



      {/* Modal Import PBL Excel */}

      <AnimatePresence>
        {/* PBL Template Selection Modal */}
        {showPBLTemplateSelectionModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handlePBLCloseTemplateSelectionModal}
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
                onClick={handlePBLCloseTemplateSelectionModal}
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
                      onClick={() => handlePBLTemplateSelection('LAMA')}
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
                      onClick={() => handlePBLTemplateSelection('SIAKAD')}
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
                
                <div className="flex justify-end gap-2 pt-2 relative z-20">
                  <button
                    onClick={handlePBLCloseTemplateSelectionModal}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {showPBLImportModal && (

          <div className="fixed inset-0 z-[100000] flex items-center justify-center">

            {/* Overlay */}

            <motion.div 

              initial={{ opacity: 0 }}

              animate={{ opacity: 1 }}

              exit={{ opacity: 0 }}

              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"

              onClick={handlePBLCloseImportModal}

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

                onClick={handlePBLCloseImportModal}

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

                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Import Jadwal PBL</h2>

                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedPBLTemplate === 'LAMA' ? 'Template Aplikasi' : 'Template SIAKAD'} - Preview dan validasi data sebelum import
                </p>

              </div>

              {/* Info Box untuk Template SIAKAD PBL */}
              {selectedPBLTemplate === 'SIAKAD' && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                        Informasi Mapping Template SIAKAD PBL
                      </h3>
                      <div className="text-sm text-green-700 dark:text-green-300 space-y-2">
                        <div>
                          <strong>Kolom yang tersedia di SIAKAD:</strong>
                          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                            <li>Tanggal → Tanggal</li>
                            <li>Waktu Mulai → Jam mulai</li>
                            <li>Waktu Selesai → Jam selesai</li>
                            <li>Kelompok → Kelompok kecil</li>
                            <li>Ruang → Ruangan</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Kolom yang <span className="text-red-600 dark:text-red-400">WAJIB diisi manual</span> (tidak ada di SIAKAD):</strong>
                          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                            <li>Modul PBL → Klik kolom "Kosong (isi manual)" untuk memilih modul</li>
                            <li>Dosen → Klik kolom "Kosong (isi manual)" untuk memilih dosen</li>
                            <li>PBL Tipe → Klik kolom "Kosong (isi manual)" untuk memilih tipe (PBL 1/PBL 2)</li>
                            <li>Sesi → Klik kolom "Kosong (isi manual)" untuk mengisi</li>
                          </ul>
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          💡 <strong>Tips:</strong> Klik pada kolom yang menampilkan "Kosong (isi manual)" untuk mengisi data yang diperlukan. Jam selesai akan otomatis dihitung berdasarkan tipe PBL: PBL 1 = 2x50 menit, PBL 2 = 3x50 menit.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload File Section */}
              {!(selectedPBLTemplate === 'LAMA' ? pblImportFile : pblSiakadImportFile) && (
                <div className="mb-6">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-brand-500 dark:hover:border-brand-400 transition-colors">
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon icon={faFileExcel} className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Upload File Excel {selectedPBLTemplate === 'LAMA' ? '' : 'SIAKAD'}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Pilih file Excel dengan format {selectedPBLTemplate === 'LAMA' ? 'template aplikasi' : 'SIAKAD'} (.xlsx, .xls)
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors cursor-pointer">
                        <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                        Pilih File
                        <input
                          ref={pblFileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handlePBLFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

                  {/* File Info */}

                  {(selectedPBLTemplate === 'LAMA' ? pblImportFile : pblSiakadImportFile) && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-blue-500" />
                        <div className="flex-1">
                          <p className="font-medium text-blue-800 dark:text-blue-200">
                            {(selectedPBLTemplate === 'LAMA' ? pblImportFile : pblSiakadImportFile)?.name}
                          </p>
                          <p className="text-sm text-blue-600 dark:text-blue-300">
                            {(((selectedPBLTemplate === 'LAMA' ? pblImportFile : pblSiakadImportFile)?.size || 0) / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        <button
                          onClick={handlePBLRemoveFile}
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

                  {((selectedPBLTemplate === 'LAMA' ? pblImportErrors : pblSiakadImportErrors).length > 0 || (selectedPBLTemplate === 'LAMA' ? pblCellErrors : pblSiakadCellErrors).length > 0) && (

                    <div className="mb-6">

                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">

                        <div className="flex items-center gap-2 mb-3">

                          <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5 text-red-500" />

                          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">

                            Error Validasi ({(selectedPBLTemplate === 'LAMA' ? pblImportErrors : pblSiakadImportErrors).length + (selectedPBLTemplate === 'LAMA' ? pblCellErrors : pblSiakadCellErrors).length} error)

                          </h3>

                        </div>

                        <div className="max-h-40 overflow-y-auto space-y-2">
                          {(selectedPBLTemplate === 'LAMA' ? pblImportErrors : pblSiakadImportErrors).map((error, index) => (
                            <p key={index} className="text-sm text-red-600 dark:text-red-400">• {error}</p>
                          ))}

                          {(selectedPBLTemplate === 'LAMA' ? pblCellErrors : pblSiakadCellErrors).map((err, idx) => (

                            <p key={idx} className="text-sm text-red-600 dark:text-red-400 mb-1">

                              • {err.message} (Baris {err.row + 1}, Kolom {err.field.toUpperCase()})

                            </p>

                          ))}

                        </div>

                      </div>

                    </div>

                  )}



                  {/* Preview Data Table */}

                  {(selectedPBLTemplate === 'LAMA' ? pblImportData : pblSiakadImportData).length > 0 && (

                    <div className="mb-6">

                      <div className="flex items-center justify-between mb-4">

                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">

                          Preview Data ({(selectedPBLTemplate === 'LAMA' ? pblImportData : pblSiakadImportData).length} jadwal)

                        </h3>

                        <div className="text-sm text-gray-500 dark:text-gray-400">

                          File: {(selectedPBLTemplate === 'LAMA' ? pblImportFile : pblSiakadImportFile)?.name}

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

                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Modul PBL</th>

                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok Kecil</th>

                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Dosen</th>

                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>

                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">PBL Tipe</th>

                              </tr>

                            </thead>

                            <tbody>

                              {(selectedPBLTemplate === 'LAMA' ? pblImportPaginatedData : pblSiakadImportPaginatedData).map((row, index) => {

                                const actualIndex = ((selectedPBLTemplate === 'LAMA' ? pblImportPage : pblSiakadImportPage) - 1) * pblImportPageSize + index;

                                const modulPBL = modulPBLList?.find(m => m.id === row.modul_pbl_id);

                                const kelompokKecil = kelompokKecilList?.find(k => k.id === row.kelompok_kecil_id);
                                const namaKelompokAsli = (row as any).nama_kelompok;

                                const dosen = allDosenList?.find(d => d.id === row.dosen_id);

                                const ruangan = allRuanganList?.find(r => r.id === row.ruangan_id);

                                

                                const renderEditableCell = (field: string, value: any, isNumeric = false) => {

                                  const isEditing = (selectedPBLTemplate === 'LAMA' ? pblEditingCell : pblSiakadEditingCell)?.row === actualIndex && (selectedPBLTemplate === 'LAMA' ? pblEditingCell : pblSiakadEditingCell)?.key === field;

                                  const cellError = (selectedPBLTemplate === 'LAMA' ? pblCellErrors : pblSiakadCellErrors).find(err => err.row === actualIndex && err.field === field);

                                  

                                  return (

                                    <td

                                      className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}

                                      onClick={() => (selectedPBLTemplate === 'LAMA' ? setPBLEditingCell : setPBLSiakadEditingCell)({ row: actualIndex, key: field })}

                                      title={cellError ? cellError.message : ''}

                                    >

                                      {isEditing ? (

                                        <input

                                          className="w-full px-1 border-none outline-none text-xs md:text-sm"

                                          type={isNumeric ? "number" : "text"}

                                          value={value === 'Kosong (isi manual)' || value === 'Wajib diisi' ? "" : (value || "")}

                                          onChange={e => {
                                            if (selectedPBLTemplate === 'SIAKAD') {
                                              if (field === 'nama_modul') {
                                                handlePBLSIAKADCellEdit(actualIndex, field, e.target.value);
                                              } else if (field === 'dosen_id') {
                                                handlePBLSIAKADCellEdit(actualIndex, field, e.target.value);
                                              } else {
                                                handlePBLSIAKADCellEdit(actualIndex, field, e.target.value);
                                              }
                                            } else {
                                              handlePBLCellEdit(actualIndex, field, e.target.value);
                                            }
                                          }}

                                          onBlur={() => (selectedPBLTemplate === 'LAMA' ? setPBLEditingCell(null) : setPBLSiakadEditingCell(null))}

                                          autoFocus

                                        />

                                      ) : (

                                        <span className={cellError || (field === 'tanggal' && (!value || value.trim() === '')) || (field === 'jam_mulai' && (!value || value.trim() === '')) || (field === 'jam_selesai' && (!value || value.trim() === '')) || (field === 'nama_modul' && (!value || value.trim() === '')) || (field === 'dosen_id' && (!value || value === 0 || value === null)) || (field === 'pbl_tipe' && (!value || value.trim() === '')) ? 'text-red-500' : 'text-gray-800 dark:text-gray-100'}>
                                          {field === 'tanggal' && (!value || value.trim() === '') ? 'Wajib diisi' :
                                           field === 'jam_mulai' && (!value || value.trim() === '') ? 'Wajib diisi' :
                                           field === 'jam_selesai' && (!value || value.trim() === '') ? 'Wajib diisi' :
                                           field === 'nama_modul' && (!value || value.trim() === '') ? 'Wajib diisi' :
                                           field === 'dosen_id' && (!value || value === 0 || value === null) ? 'Wajib diisi' :
                                           field === 'pbl_tipe' && (!value || value.trim() === '') ? 'Wajib diisi' :
                                           value || '-'}
                                        </span>
                                      )}

                                    </td>

                                  );

                                };

                                

                                return (

                                  <tr 

                                    key={index} 

                                    className={`${index % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}`}

                                  >

                                    <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{index + 1}</td>

                                    {renderEditableCell('tanggal', row.tanggal)}

                                    {renderEditableCell('jam_mulai', row.jam_mulai)}

                                    

                                    {/* Modul PBL - Special handling with error highlighting */}
                                    {(() => {

                                      const field = 'nama_modul';
                                      const isEditing = (selectedPBLTemplate === 'LAMA' ? pblEditingCell : pblSiakadEditingCell)?.row === actualIndex && (selectedPBLTemplate === 'LAMA' ? pblEditingCell : pblSiakadEditingCell)?.key === field;

                                      const cellError = (selectedPBLTemplate === 'LAMA' ? pblCellErrors : pblSiakadCellErrors).find(err => err.row === actualIndex && err.field === 'modul_pbl_id');
                                      

                                      return (

                                        <td

                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}

                                          onClick={() => (selectedPBLTemplate === 'LAMA' ? setPBLEditingCell : setPBLSiakadEditingCell)({ row: actualIndex, key: field })}

                                          title={cellError ? cellError.message : ''}

                                        >

                                          {isEditing ? (

                                            <input

                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"

                                              value={(row as any).nama_modul === 'Kosong (isi manual)' ? "" : ((row as any).nama_modul || "")}
                                              onChange={e => (selectedPBLTemplate === 'LAMA' ? handlePBLCellEdit(actualIndex, field, e.target.value) : handlePBLSIAKADCellEdit(actualIndex, field, e.target.value))}
                                              onBlur={() => (selectedPBLTemplate === 'LAMA' ? setPBLEditingCell(null) : setPBLSiakadEditingCell(null))}

                                              autoFocus

                                            />

                                          ) : (

                                            <span className={cellError ? 'text-red-500' : (modulPBL ? 'text-gray-800 dark:text-white/90' : 'text-red-500')}>
                                              {(row as any).nama_modul || modulPBL?.nama_modul || 'Tidak ditemukan'}
                                            </span>

                                          )}

                                        </td>

                                      );

                                    })()}

                                    

                                    {/* Kelompok Kecil - Special handling */}

                                    {(() => {

                                      const field = 'kelompok_kecil_id';

                                      const isEditing = (selectedPBLTemplate === 'LAMA' ? pblEditingCell : pblSiakadEditingCell)?.row === actualIndex && (selectedPBLTemplate === 'LAMA' ? pblEditingCell : pblSiakadEditingCell)?.key === field;

                                      const cellError = (selectedPBLTemplate === 'LAMA' ? pblCellErrors : pblSiakadCellErrors).find(err => err.row === actualIndex && err.field === field);

                                      

                                      return (

                                        <td

                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}

                                          onClick={() => (selectedPBLTemplate === 'LAMA' ? setPBLEditingCell : setPBLSiakadEditingCell)({ row: actualIndex, key: field })}

                                          title={cellError ? cellError.message : ''}

                                        >

                                          {isEditing ? (

                                            <input

                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"

                                              value={namaKelompokAsli || ""}

                                              onChange={e => (selectedPBLTemplate === 'LAMA' ? handlePBLKelompokKecilEdit(actualIndex, e.target.value) : handlePBLSiakadKelompokKecilEdit(actualIndex, e.target.value))}

                                              onBlur={() => (selectedPBLTemplate === 'LAMA' ? setPBLEditingCell(null) : setPBLSiakadEditingCell(null))}

                                              autoFocus

                                            />

                                          ) : (

                                            <span className={cellError ? 'text-red-500' : (kelompokKecil ? 'text-gray-800 dark:text-white/90' : 'text-red-500')}>
                                              {namaKelompokAsli || '-'}

                                            </span>

                                          )}

                                        </td>

                                      );

                                    })()}

                                    

                                    {/* Dosen - Special handling */}

                                    {(() => {

                                      const field = 'dosen_id';

                                      const isEditing = (selectedPBLTemplate === 'LAMA' ? pblEditingCell : pblSiakadEditingCell)?.row === actualIndex && (selectedPBLTemplate === 'LAMA' ? pblEditingCell : pblSiakadEditingCell)?.key === field;

                                      const cellError = (selectedPBLTemplate === 'LAMA' ? pblCellErrors : pblSiakadCellErrors).find(err => err.row === actualIndex && err.field === field);

                                      

                                      return (

                                        <td

                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}

                                          onClick={() => {
                                            (selectedPBLTemplate === 'LAMA' ? setPBLEditingCell : setPBLSiakadEditingCell)({ row: actualIndex, key: field });
                                            const currentValue = dosen?.name || (row as any).nama_dosen || "";
                                            setPBLDosenInput(currentValue === 'Kosong (isi manual)' ? "" : currentValue);
                                          }}
                                          title={cellError ? cellError.message : ''}

                                        >

                                          {isEditing ? (

                                            <input

                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"

                                              value={pblDosenInput}
                                              onChange={e => {
                                                const inputValue = e.target.value;
                                                setPBLDosenInput(inputValue);
                                                (selectedPBLTemplate === 'LAMA' ? handlePBLDosenEdit : handlePBLSiakadDosenEdit)(actualIndex, inputValue);
                                              }}
                                              onBlur={() => {
                                                (selectedPBLTemplate === 'LAMA' ? setPBLEditingCell : setPBLSiakadEditingCell)(null);
                                                setPBLDosenInput('');
                                              }}
                                              autoFocus

                                            />

                                          ) : (

                                            <span className={cellError ? 'text-red-500' : (dosen ? 'text-gray-800 dark:text-white/90' : 'text-red-500')}>
                                              {dosen?.name || (row as any).nama_dosen || 'Tidak ditemukan'}
                                            </span>

                                          )}

                                        </td>

                                      );

                                    })()}

                                    

                                    {/* Ruangan - Special handling */}

                                    {(() => {

                                      const field = 'ruangan_id';

                                      const isEditing = (selectedPBLTemplate === 'LAMA' ? pblEditingCell : pblSiakadEditingCell)?.row === actualIndex && (selectedPBLTemplate === 'LAMA' ? pblEditingCell : pblSiakadEditingCell)?.key === field;

                                      const cellError = (selectedPBLTemplate === 'LAMA' ? pblCellErrors : pblSiakadCellErrors).find(err => err.row === actualIndex && err.field === field);

                                      

                                      return (

                                        <td

                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}

                                          onClick={() => {
                                            (selectedPBLTemplate === 'LAMA' ? setPBLEditingCell : setPBLSiakadEditingCell)({ row: actualIndex, key: field });
                                            setPBLRuanganInput(ruangan?.nama || (row as any).nama_ruangan || "");
                                          }}
                                          title={cellError ? cellError.message : ''}

                                        >

                                          {isEditing ? (

                                            <input

                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"

                                              value={pblRuanganInput}
                                              onChange={e => {
                                                const inputValue = e.target.value;
                                                setPBLRuanganInput(inputValue);
                                                (selectedPBLTemplate === 'LAMA' ? handlePBLRuanganEdit : handlePBLSiakadRuanganEdit)(actualIndex, inputValue);
                                              }}
                                              onBlur={() => {
                                                (selectedPBLTemplate === 'LAMA' ? setPBLEditingCell : setPBLSiakadEditingCell)(null);
                                                setPBLRuanganInput('');
                                              }}
                                              autoFocus

                                            />

                                          ) : (

                                            <span className={cellError ? 'text-red-500' : (ruangan ? 'text-gray-800 dark:text-white/90' : 'text-red-500')}>
                                              {ruangan?.nama || (row as any).nama_ruangan || 'Tidak ditemukan'}
                                            </span>

                                          )}

                                        </td>

                                      );

                                    })()}

                                    

                                    {renderEditableCell('pbl_tipe', row.pbl_tipe)}

                                  </tr>

                                );

                              })}

                            </tbody>

                          </table>

                        </div>

                      </div>

                    </div>

                  )}



                  {/* Action Buttons */}

                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">

                    <button

                      onClick={handlePBLCloseImportModal}

                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700 transition"

                    >

                      Batal

                    </button>

                    {(selectedPBLTemplate === 'LAMA' ? pblImportData : pblSiakadImportData).length > 0 && (selectedPBLTemplate === 'LAMA' ? pblCellErrors : pblSiakadCellErrors).length === 0 && (

                      <button

                        onClick={handlePBLSubmitImport}

                        disabled={isPBLImporting}

                        className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"

                      >

                        {isPBLImporting ? (

                          <>

                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>

                            Importing...

                          </>

                        ) : (

                          <>

                            <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />

                            Import Data ({(selectedPBLTemplate === 'LAMA' ? pblImportData : pblSiakadImportData).length} jadwal)

                          </>

                        )}

                      </button>

                    )}

                  </div>

            </motion.div>

          </div>

        )}

      </AnimatePresence>

      {/* MODAL TEMPLATE SELECTION PRAKTIKUM */}
      <AnimatePresence>
        {showPraktikumTemplateSelectionModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handlePraktikumCloseTemplateSelectionModal}
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
                onClick={handlePraktikumCloseTemplateSelectionModal}
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
                      onClick={() => handlePraktikumTemplateSelection('LAMA')}
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
                      onClick={() => handlePraktikumTemplateSelection('SIAKAD')}
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
                
                <div className="flex justify-end gap-2 pt-2 relative z-20">
                  <button
                    onClick={handlePraktikumCloseTemplateSelectionModal}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL IMPORT EXCEL PRAKTIKUM */}
      <AnimatePresence>
        {showPraktikumImportModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handlePraktikumCloseImportModal}
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
                onClick={handlePraktikumCloseImportModal}
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
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Import Jadwal Praktikum</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {selectedPraktikumTemplate === 'LAMA' ? 'Template Aplikasi' : 'Template SIAKAD'} - Preview dan validasi data sebelum import
                </p>
              </div>

              {/* Info Box untuk Template SIAKAD Praktikum */}
              {selectedPraktikumTemplate === 'SIAKAD' && (
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-5 h-5 mt-0.5">
                      <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <h3 className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                        Informasi Mapping Template SIAKAD Praktikum
                      </h3>
                      <div className="text-sm text-green-700 dark:text-green-300 space-y-2">
                        <div>
                          <strong>Kolom yang tersedia di SIAKAD:</strong>
                          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                            <li>Tanggal → Tanggal</li>
                            <li>Waktu Mulai → Jam mulai</li>
                            <li>Waktu Selesai → Jam selesai</li>
                            <li>Topik → Topik</li>
                            <li>Nama Kelas → Kelas praktikum</li>
                            <li>Kelompok → Kelompok besar</li>
                            <li>Ruang → Ruangan</li>
                          </ul>
                        </div>
                        <div>
                          <strong>Kolom yang <span className="text-red-600 dark:text-red-400">WAJIB diisi manual</span> (tidak ada di SIAKAD):</strong>
                          <ul className="list-disc list-inside ml-2 mt-1 space-y-1">
                            <li>Materi → Klik kolom "Kosong (isi manual)" untuk mengisi</li>
                            <li>Dosen → Klik kolom "Kosong (isi manual)" untuk memilih dosen</li>
                            <li>Sesi → Klik kolom "Kosong (isi manual)" untuk mengisi</li>
                          </ul>
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-400 mt-2">
                          💡 <strong>Tips:</strong> Klik pada kolom yang menampilkan "Kosong (isi manual)" untuk mengisi data yang diperlukan. Jam selesai akan otomatis dihitung berdasarkan jam mulai dan sesi.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Upload File Section */}
              {!(selectedPraktikumTemplate === 'LAMA' ? praktikumImportFile : praktikumSiakadImportFile) && (
                <div className="mb-6">
                  <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-brand-500 dark:hover:border-brand-400 transition-colors">
                    <div className="space-y-4">
                      <div className="w-16 h-16 mx-auto bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center">
                        <FontAwesomeIcon icon={faFileExcel} className="w-8 h-8 text-brand-600 dark:text-brand-400" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Upload File Excel {selectedPraktikumTemplate === 'LAMA' ? '' : 'SIAKAD'}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          Pilih file Excel dengan format {selectedPraktikumTemplate === 'LAMA' ? 'template aplikasi' : 'SIAKAD'} (.xlsx, .xls)
                        </p>
                      </div>
                      <label className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors cursor-pointer">
                        <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                        Pilih File
                        <input
                          ref={selectedPraktikumTemplate === 'LAMA' ? praktikumFileInputRef : praktikumSiakadFileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={selectedPraktikumTemplate === 'LAMA' ? handlePraktikumFileUpload : handlePraktikumSiakadFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}


              {/* File Info */}
              {(selectedPraktikumTemplate === 'LAMA' ? praktikumImportFile : praktikumSiakadImportFile) && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-800 dark:text-blue-200">
                        {(selectedPraktikumTemplate === 'LAMA' ? praktikumImportFile : praktikumSiakadImportFile)?.name}
                      </p>
                      <p className="text-sm text-blue-600 dark:text-blue-300">
                        {(((selectedPraktikumTemplate === 'LAMA' ? praktikumImportFile : praktikumSiakadImportFile)?.size || 0) / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={() => {
                        if (selectedPraktikumTemplate === 'LAMA') {
                          setPraktikumImportFile(null);
                          setPraktikumImportData([]);
                          setPraktikumImportErrors([]);
                          setPraktikumCellErrors([]);
                          setPraktikumEditingCell(null);
                          setPraktikumImportPage(1);
                        } else {
                          setPraktikumSiakadImportFile(null);
                          setPraktikumSiakadImportData([]);
                          setPraktikumSiakadImportErrors([]);
                          setPraktikumSiakadCellErrors([]);
                          setPraktikumSiakadEditingCell(null);
                          setPraktikumSiakadImportPage(1);
                        }
                        if (selectedPraktikumTemplate === 'LAMA') {
                          if (praktikumFileInputRef.current) {
                            praktikumFileInputRef.current.value = '';
                          }
                        } else {
                          if (praktikumSiakadFileInputRef.current) {
                            praktikumSiakadFileInputRef.current.value = '';
                          }
                        }
                      }}
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
              {((selectedPraktikumTemplate === 'LAMA' ? praktikumImportErrors : praktikumSiakadImportErrors).length > 0 || (selectedPraktikumTemplate === 'LAMA' ? praktikumCellErrors : praktikumSiakadCellErrors).length > 0) && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                        Error Validasi ({(selectedPraktikumTemplate === 'LAMA' ? praktikumImportErrors : praktikumSiakadImportErrors).length + (selectedPraktikumTemplate === 'LAMA' ? praktikumCellErrors : praktikumSiakadCellErrors).length} error)
                      </h3>
                      <div className="max-h-40 overflow-y-auto">
                        {/* Error dari API response */}
                        {(selectedPraktikumTemplate === 'LAMA' ? praktikumImportErrors : praktikumSiakadImportErrors).map((err, idx) => (
                          <p key={idx} className="text-sm text-red-600 dark:text-red-400 mb-1">• {err}</p>
                        ))}
                        {/* Error cell/detail */}
                        {(selectedPraktikumTemplate === 'LAMA' ? praktikumCellErrors : praktikumSiakadCellErrors).map((err, idx) => (
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
              {(selectedPraktikumTemplate === 'LAMA' ? praktikumImportData : praktikumSiakadImportData).length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      Preview Data ({(selectedPraktikumTemplate === 'LAMA' ? praktikumImportData : praktikumSiakadImportData).length} jadwal)
                    </h3>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      File: {(selectedPraktikumTemplate === 'LAMA' ? praktikumImportFile : praktikumSiakadImportFile)?.name}
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
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Materi</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelas Praktikum</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Dosen</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Sesi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(selectedPraktikumTemplate === 'LAMA' ? praktikumImportData : praktikumSiakadImportData)
                            .slice((praktikumImportPage - 1) * praktikumImportPageSize, praktikumImportPage * praktikumImportPageSize)
                            .map((row, index) => {
                              const actualIndex = (praktikumImportPage - 1) * praktikumImportPageSize + index;
                              
                              const renderEditableCell = (field: string, value: any, isNumeric = false) => {
                                const isEditing = (selectedPraktikumTemplate === 'LAMA' ? praktikumEditingCell : praktikumSiakadEditingCell)?.row === actualIndex && (selectedPraktikumTemplate === 'LAMA' ? praktikumEditingCell : praktikumSiakadEditingCell)?.key === field;
                                const cellError = (selectedPraktikumTemplate === 'LAMA' ? praktikumCellErrors : praktikumSiakadCellErrors).find(err => err.row === actualIndex + 1 && err.field === field);
                                
                                // Untuk template SIAKAD dan LAMA, semua kolom bisa diedit
                                const isEditable = true;
                                
                                return (
                                  <td
                                    className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap ${isEditable ? 'cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20' : ''} ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError || (field === 'tanggal' && (!value || value.trim() === '')) || (field === 'jam_mulai' && (!value || value.trim() === '')) || (field === 'jam_selesai' && (!value || value.trim() === '')) || (field === 'kelas_praktikum' && (!value || value.trim() === '')) || (field === 'ruangan_id' && (!value || value.trim() === '')) ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                    onClick={() => isEditable && (selectedPraktikumTemplate === 'LAMA' ? setPraktikumEditingCell : setPraktikumSiakadEditingCell)({ row: actualIndex, key: field })}
                                    title={cellError ? cellError.message : ''}
                                  >
                                    {isEditing ? (
                                      <input
                                        className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                        type={isNumeric ? "number" : "text"}
                                        value={value === 'Kosong (isi manual)' || value === 'Wajib diisi' || (field === 'tanggal' && (!value || value.trim() === '')) || (field === 'jam_mulai' && (!value || value.trim() === '')) || (field === 'jam_selesai' && (!value || value.trim() === '')) || (field === 'kelas_praktikum' && (!value || value.trim() === '')) || (field === 'ruangan_id' && (!value || value.trim() === '')) ? "" : (value || "")}
                                        onChange={e => {
                                          if (selectedPraktikumTemplate === 'SIAKAD') {
                                            if (field === 'materi') {
                                              handlePraktikumSiakadMateriEdit(actualIndex, e.target.value);
                                            } else if (field === 'dosen_id') {
                                              handlePraktikumSiakadDosenEdit(actualIndex, e.target.value);
                                            } else if (field === 'topik') {
                                              handlePraktikumSiakadTopikEdit(actualIndex, e.target.value);
                                            } else if (field === 'ruangan_id') {
                                              handlePraktikumSiakadRuanganEdit(actualIndex, e.target.value);
                                            } else {
                                              // Untuk field lain (tanggal, jam_mulai, jam_selesai, dll), gunakan handler SIAKAD
                                              handlePraktikumSiakadCellEdit(actualIndex, field, isNumeric ? parseInt(e.target.value) || 0 : e.target.value);
                                            }
                                          } else {
                                            handlePraktikumCellEdit(actualIndex, field, isNumeric ? parseInt(e.target.value) || 0 : e.target.value);
                                          }
                                        }}
                                        onBlur={() => {
                                          if (selectedPraktikumTemplate === 'SIAKAD') {
                                            setPraktikumSiakadEditingCell(null);
                                          } else {
                                            setPraktikumEditingCell(null);
                                          }
                                        }}
                                        onKeyDown={e => {
                                          if (e.key === 'Enter') {
                                            if (selectedPraktikumTemplate === 'SIAKAD') {
                                              setPraktikumSiakadEditingCell(null);
                                            } else {
                                              setPraktikumEditingCell(null);
                                            }
                                          }
                                          if (e.key === 'Escape') {
                                            if (selectedPraktikumTemplate === 'SIAKAD') {
                                              setPraktikumSiakadEditingCell(null);
                                            } else {
                                              setPraktikumEditingCell(null);
                                            }
                                          }
                                        }}
                                        autoFocus
                                      />
                                    ) : (
                                      <span className={`${cellError || (field === 'tanggal' && (!value || value.trim() === '')) || (field === 'jam_mulai' && (!value || value.trim() === '')) || (field === 'jam_selesai' && (!value || value.trim() === '')) || (field === 'kelas_praktikum' && (!value || value.trim() === '')) || (field === 'ruangan_id' && (!value || value.trim() === '')) ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}`}>
                                        {field === 'tanggal' && (!value || value.trim() === '') ? 'Wajib diisi' :
                                         field === 'jam_mulai' && (!value || value.trim() === '') ? 'Wajib diisi' :
                                         field === 'jam_selesai' && (!value || value.trim() === '') ? 'Wajib diisi' :
                                         field === 'kelas_praktikum' && (!value || value.trim() === '') ? 'Wajib diisi' :
                                         field === 'ruangan_id' && (!value || value.trim() === '') ? 'Wajib diisi' :
                                         value || '-'}
                                      </span>
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
                                {renderEditableCell('materi', row.materi)}
                                {renderEditableCell('topik', row.topik)}
                                {renderEditableCell('kelas_praktikum', row.kelas_praktikum)}
                                {renderEditableCell('dosen_id', row.nama_dosen)}
                                {renderEditableCell('ruangan_id', row.nama_ruangan)}
                                {renderEditableCell('jumlah_sesi', row.jumlah_sesi, true)}
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Pagination untuk Import Preview */}
              {(selectedPraktikumTemplate === 'LAMA' ? praktikumImportData : praktikumSiakadImportData).length > praktikumImportPageSize && (
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center gap-4">
                    <select
                      value={praktikumImportPageSize}
                      onChange={e => { setPraktikumImportPageSize(Number(e.target.value)); setPraktikumImportPage(1); }}
                      className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition"
                    >
                      <option value={5}>5 per halaman</option>
                      <option value={10}>10 per halaman</option>
                      <option value={20}>20 per halaman</option>
                      <option value={50}>50 per halaman</option>
                    </select>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Menampilkan {((praktikumImportPage - 1) * praktikumImportPageSize) + 1}-{Math.min(praktikumImportPage * praktikumImportPageSize, (selectedPraktikumTemplate === 'LAMA' ? praktikumImportData : praktikumSiakadImportData).length)} dari {(selectedPraktikumTemplate === 'LAMA' ? praktikumImportData : praktikumSiakadImportData).length} jadwal
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setPraktikumImportPage(p => Math.max(1, p - 1))}
                      disabled={praktikumImportPage === 1}
                      className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                    >
                      Prev
                    </button>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Halaman {praktikumImportPage} dari {Math.ceil((selectedPraktikumTemplate === 'LAMA' ? praktikumImportData : praktikumSiakadImportData).length / praktikumImportPageSize)}
                    </span>
                    <button
                      onClick={() => setPraktikumImportPage(p => Math.min(Math.ceil((selectedPraktikumTemplate === 'LAMA' ? praktikumImportData : praktikumSiakadImportData).length / praktikumImportPageSize), p + 1))}
                      disabled={praktikumImportPage >= Math.ceil((selectedPraktikumTemplate === 'LAMA' ? praktikumImportData : praktikumSiakadImportData).length / praktikumImportPageSize)}
                      className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                    >
                      Next
                    </button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-6">
                <button
                  onClick={handlePraktikumCloseImportModal}
                  className="px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Batal
                </button>
                {(selectedPraktikumTemplate === 'LAMA' ? praktikumImportData : praktikumSiakadImportData).length > 0 && (selectedPraktikumTemplate === 'LAMA' ? praktikumCellErrors : praktikumSiakadCellErrors).length === 0 && (
                  <button
                    onClick={handlePraktikumSubmitImport}
                    disabled={isPraktikumImporting}
                    className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isPraktikumImporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Importing...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                        Import Data ({(selectedPraktikumTemplate === 'LAMA' ? praktikumImportData : praktikumSiakadImportData).length} jadwal)
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL IMPORT EXCEL AGENDA KHUSUS */}
      <AnimatePresence>
        {showAgendaKhususImportModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handleAgendaKhususCloseImportModal}
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
                onClick={handleAgendaKhususCloseImportModal}
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
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Import Jadwal Agenda Khusus</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Preview dan validasi data sebelum import</p>
              </div>

              {/* Upload File Section */}
              {!agendaKhususImportFile && (
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
                          ref={agendaKhususFileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleAgendaKhususFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* File Info */}
              {agendaKhususImportFile && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-800 dark:text-blue-200">{agendaKhususImportFile.name}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-300">
                        {(agendaKhususImportFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={handleAgendaKhususRemoveFile}
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
              {(agendaKhususImportErrors.length > 0 || agendaKhususCellErrors.length > 0) && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                        Error Validasi ({agendaKhususImportErrors.length + agendaKhususCellErrors.length} error)
                      </h3>
                      <div className="max-h-40 overflow-y-auto">
                        {/* Error dari API response */}
                        {agendaKhususImportErrors.map((err, idx) => (
                          <p key={idx} className="text-sm text-red-600 dark:text-red-400 mb-1">• {err}</p>
                        ))}
                        {/* Error cell/detail */}
                        {agendaKhususCellErrors.map((err, idx) => (
                          <p key={idx} className="text-sm text-red-600 dark:text-red-400 mb-1">
                            • {err.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {agendaKhususImportData.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      Preview Data ({agendaKhususImportData.length} jadwal)
                    </h3>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      File: {agendaKhususImportFile?.name}
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
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Agenda</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok Besar</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Jumlah Sesi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {agendaKhususImportData.map((row, index) => {
                            const actualIndex = index;
                            
                            const renderEditableCell = (field: string, value: any, isNumeric = false) => {
                              const isEditing = agendaKhususEditingCell?.row === actualIndex && agendaKhususEditingCell?.key === field;
                              const cellError = agendaKhususCellErrors.find(err => err.row === actualIndex + 1 && err.field === field);
                              
                              return (
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                  onClick={() => setAgendaKhususEditingCell({ row: actualIndex, key: field })}
                                  title={cellError ? cellError.message : ''}
                                >
                                  {isEditing ? (
                                    <input
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                      type={isNumeric ? "number" : "text"}
                                      value={value || ""}
                                      onChange={e => handleAgendaKhususCellEdit(actualIndex, field, isNumeric ? parseInt(e.target.value) || 0 : e.target.value)}
                                      onBlur={handleAgendaKhususFinishEdit}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          handleAgendaKhususFinishEdit();
                                        }
                                        if (e.key === 'Escape') {
                                          handleAgendaKhususFinishEdit();
                                        }
                                      }}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={`${cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}`}>
                                      {value || '-'}
                                    </span>
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
                                {renderEditableCell('agenda', row.agenda)}
                                {renderEditableCell('ruangan_id', row.nama_ruangan)}
                                {renderEditableCell('kelompok_besar_id', 
                                  kelompokBesarOptions.find(k => Number(k.id) === row.kelompok_besar_id)?.label || row.kelompok_besar_id
                                )}
                                {renderEditableCell('jumlah_sesi', row.jumlah_sesi, true)}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-6">
                <button
                  onClick={handleAgendaKhususCloseImportModal}
                  className="px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Batal
                </button>
                {agendaKhususImportData.length > 0 && agendaKhususCellErrors.length === 0 && (
                  <button
                    onClick={handleAgendaKhususSubmitImport}
                    disabled={isAgendaKhususImporting}
                    className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isAgendaKhususImporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                        Importing...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                        Import Data ({agendaKhususImportData.length} jadwal)
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MODAL IMPORT EXCEL JURNAL READING */}
      <AnimatePresence>
        {showJurnalReadingImportModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handleJurnalReadingCloseImportModal}
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
                onClick={handleJurnalReadingCloseImportModal}
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
                <h2 className="text-xl font-semibold text-gray-800 dark:text-white">Import Jadwal Jurnal Reading</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">Preview dan validasi data sebelum import</p>
              </div>

              {/* Upload File Section */}
              {!jurnalReadingImportFile && (
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
                          ref={jurnalReadingFileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleJurnalReadingFileUpload}
                          className="hidden"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* File Info */}
              {jurnalReadingImportFile && (
                <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-blue-500" />
                    <div className="flex-1">
                      <p className="font-medium text-blue-800 dark:text-blue-200">{jurnalReadingImportFile.name}</p>
                      <p className="text-sm text-blue-600 dark:text-blue-300">
                        {(jurnalReadingImportFile.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                    <button
                      onClick={handleJurnalReadingRemoveFile}
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
              {(jurnalReadingImportErrors.length > 0 || jurnalReadingCellErrors.length > 0) && (
                <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0">
                      <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5 text-red-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                        Error Validasi ({jurnalReadingImportErrors.length + jurnalReadingCellErrors.length} error)
                      </h3>
                      <div className="max-h-40 overflow-y-auto">
                        {/* Error dari API response */}
                        {jurnalReadingImportErrors.map((err, idx) => (
                          <p key={idx} className="text-sm text-red-600 dark:text-red-400 mb-1">• {err}</p>
                        ))}
                        {/* Error cell/detail */}
                        {jurnalReadingCellErrors.map((err, idx) => (
                          <p key={idx} className="text-sm text-red-600 dark:text-red-400 mb-1">
                            • {err.message}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Preview Table */}
              {jurnalReadingImportData.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      Preview Data ({jurnalReadingImportData.length} jadwal)
                    </h3>
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      File: {jurnalReadingImportFile?.name}
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
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Dosen</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok Kecil</th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Jumlah Sesi</th>
                          </tr>
                        </thead>
                        <tbody>
                          {jurnalReadingImportData.map((row, index) => {
                            const actualIndex = index;
                            
                            const renderEditableCell = (field: string, value: any, isNumeric = false) => {
                              const isEditing = jurnalReadingEditingCell?.row === actualIndex && jurnalReadingEditingCell?.key === field;
                              const cellError = jurnalReadingCellErrors.find(err => err.row === actualIndex + 1 && err.field === field);
                              
                              return (
                                <td
                                  className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-50 dark:bg-red-900/20' : ''}`}
                                  onClick={() => setJurnalReadingEditingCell({ row: actualIndex, key: field })}
                                  title={cellError ? cellError.message : ''}
                                >
                                  {isEditing ? (
                                    <input
                                      className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                      type={isNumeric ? "number" : "text"}
                                      value={value || ""}
                                      onChange={e => handleJurnalReadingCellEdit(actualIndex, field, isNumeric ? parseInt(e.target.value) || 0 : e.target.value)}
                                      onBlur={handleJurnalReadingFinishEdit}
                                      onKeyDown={e => {
                                        if (e.key === 'Enter') {
                                          handleJurnalReadingFinishEdit();
                                        }
                                        if (e.key === 'Escape') {
                                          handleJurnalReadingFinishEdit();
                                        }
                                      }}
                                      autoFocus
                                    />
                                  ) : (
                                    <span className={`${cellError ? 'text-red-500' : 'text-gray-800 dark:text-white/90'}`}>
                                      {value || '-'}
                                    </span>
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
                                {renderEditableCell('topik', row.topik)}
                                {renderEditableCell('dosen_id', row.nama_dosen)}
                                {renderEditableCell('ruangan_id', row.nama_ruangan)}
                                {renderEditableCell('kelompok_kecil_id', row.nama_kelompok)}
                                {renderEditableCell('jumlah_sesi', row.jumlah_sesi, true)}
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end gap-2 pt-6">
                <button
                  onClick={handleJurnalReadingCloseImportModal}
                  className="px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Batal
                </button>
                {jurnalReadingImportData.length > 0 && jurnalReadingCellErrors.length === 0 && (
                  <button
                    onClick={handleJurnalReadingSubmitImport}
                    disabled={isJurnalReadingImporting}
                    className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {isJurnalReadingImporting ? (
                      <>
                        <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Mengimport...
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                        Import Data ({jurnalReadingImportData.length} jadwal)
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal Konfirmasi Bulk Delete */}
        <AnimatePresence>
          {showBulkDeleteModal && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              <div
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={() => setShowBulkDeleteModal(false)}
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
                      {bulkDeleteType === 'kuliah-besar' && selectedKuliahBesarItems.length}
                      {bulkDeleteType === 'praktikum' && selectedPraktikumItems.length}
                      {bulkDeleteType === 'agenda-khusus' && selectedAgendaKhususItems.length}
                      {bulkDeleteType === 'pbl' && selectedPBLItems.length}
                      {bulkDeleteType === 'jurnal-reading' && selectedJurnalReadingItems.length}
                    </span> jadwal {bulkDeleteType === 'kuliah-besar' && 'kuliah besar'}
                    {bulkDeleteType === 'praktikum' && 'praktikum'}
                    {bulkDeleteType === 'agenda-khusus' && 'agenda khusus'}
                    {bulkDeleteType === 'pbl' && 'PBL'}
                    {bulkDeleteType === 'jurnal-reading' && 'jurnal reading'} terpilih? Data yang dihapus tidak dapat dikembalikan.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => setShowBulkDeleteModal(false)}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={confirmBulkDelete}
                      className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center"
                      disabled={isBulkDeleting}
                    >
                      {isBulkDeleting ? (
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
      </AnimatePresence>

      {/* Hidden file input for praktikum import */}
      <input
        ref={praktikumFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handlePraktikumFileUpload}
        className="hidden"
      />

      {/* Hidden file input for praktikum SIAKAD import */}
      <input
        ref={praktikumSiakadFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handlePraktikumSiakadFileUpload}
        className="hidden"
      />

      {/* Hidden file input for PBL import */}
      <input
        ref={pblFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handlePBLFileUpload}
        className="hidden"
      />

      {/* Hidden file input for PBL SIAKAD import */}
      <input
        ref={pblSiakadFileInputRef}
        type="file"
        accept=".xlsx,.xls"
        onChange={handlePBLFileUpload}
        className="hidden"
      />
    </div>

  );

} 
