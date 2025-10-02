import { useParams, useNavigate } from 'react-router-dom';
import { useRef } from 'react';
import { useEffect, useState, useCallback, ChangeEvent } from 'react';
import api, { API_BASE_URL, handleApiError } from '../utils/api';
import { ChevronLeftIcon } from '../icons';
import { AnimatePresence, motion } from 'framer-motion';
import Select from 'react-select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrash, faStar, faFileExcel, faDownload, faUpload, faExclamationTriangle } from '@fortawesome/free-solid-svg-icons';
import { getRuanganOptions } from '../utils/ruanganHelper';
import * as XLSX from 'xlsx';

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

// Semua data sudah diambil dari backend melalui batch API


export default function DetailBlok() {
  const { kode } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState<MataKuliah | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  
  const [errorJadwal, setErrorJadwal] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [modulPBLList, setModulPBLList] = useState<ModulPBLType[]>([]);
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
  const [showImportModal, setShowImportModal] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importData, setImportData] = useState<JadwalKuliahBesarType[]>([]);
  const [importErrors, setImportErrors] = useState<string[]>([]);
  const [cellErrors, setCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [editingCell, setEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importSuccess, setImportSuccess] = useState(false);
  const [detectedFormat, setDetectedFormat] = useState<'legacy' | 'client' | 'unknown' | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  
  // State untuk import PBL Excel
  const [showPBLImportModal, setShowPBLImportModal] = useState(false);
  const [pblImportFile, setPBLImportFile] = useState<File | null>(null);
  const [pblImportData, setPBLImportData] = useState<JadwalPBLType[]>([]);
  const [pblCellErrors, setPBLCellErrors] = useState<{ row: number, field: string, message: string }[]>([]);
  const [pblEditingCell, setPBLEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [isPBLImporting, setIsPBLImporting] = useState(false);
  const [pblImportSuccess, setPBLImportSuccess] = useState(false);
  const [pblSuccess, setPBLSuccess] = useState<string | null>(null);
  const [pblImportedCount, setPBLImportedCount] = useState(0);
  
  // State untuk pagination PBL import preview
  const [pblImportPage, setPBLImportPage] = useState(1);
  const [pblImportPageSize, setPBLImportPageSize] = useState(10);
  
  // State untuk pagination import preview
  const [importPage, setImportPage] = useState(1);
  const [importPageSize, setImportPageSize] = useState(10);
  
  // Ref untuk input file Excel
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pblFileInputRef = useRef<HTMLInputElement>(null);

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
    if (!data) return;
    try {
      const res = await api.get(`/kelas/semester/${data.semester}`);
      setKelasPraktikumOptions(Array.isArray(res.data) ? res.data.map((k: any) => k.nama_kelas) : []);
    } catch (error) {
      // Silent fail - kelas praktikum options are not critical
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
    const totalMenit = jam * 60 + menit + jumlahKali * 50;
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
      jumlahKali: 2,
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
  // const [showDeleteAgendaKhususModal, setShowDeleteAgendaKhususModal] = useState(false);
  // const [selectedDeleteAgendaKhususIndex, setSelectedDeleteAgendaKhususIndex] = useState<number | null>(null);
  const [showDeleteJurnalReadingModal, setShowDeleteJurnalReadingModal] = useState(false);
  const [selectedDeleteJurnalReadingIndex, setSelectedDeleteJurnalReadingIndex] = useState<number | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [existingFileJurnal, setExistingFileJurnal] = useState<{ name: string; url: string } | null>(null);

  // Fetch all data using optimized batch endpoint
  const fetchBatchData = useCallback(async () => {
    if (!kode) return;
    setLoadingPBL(true);
    setLoadingDosenRuangan(true);
    setErrorJadwal('');
    
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
      setKelompokKecilList(Array.isArray(batchData.kelompok_kecil) ? batchData.kelompok_kecil : []);
      setKelompokBesarOptions(Array.isArray(batchData.kelompok_besar) ? batchData.kelompok_besar : []);
      setAllRuanganList(Array.isArray(batchData.ruangan) ? batchData.ruangan : []);
      setRuanganList(Array.isArray(batchData.ruangan) ? batchData.ruangan : []);
      setKelasPraktikumOptions(Array.isArray(batchData.kelas_praktikum) ? batchData.kelas_praktikum.map((k: any) => k.nama || k) : []);
      setMateriPraktikumOptions(Array.isArray(batchData.materi_praktikum) ? batchData.materi_praktikum : []);
      setJamOptions(Array.isArray(batchData.jam_options) ? batchData.jam_options : []);
      
      // Set dosen data
      if (batchData.dosen) {
        setAllDosenList(Array.isArray(batchData.dosen.all) ? batchData.dosen.all : []);
        setDosenList(Array.isArray(batchData.dosen.matching) ? batchData.dosen.matching : []);
      }
      
    } catch (err) {
      setErrorJadwal('Gagal mengambil data batch');
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
    fetchBatchData();
  }, [fetchBatchData]);

  // Auto-hide success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Auto-hide imported count
  useEffect(() => {
    if (importedCount > 0) {
      const timer = setTimeout(() => {
        setImportedCount(0);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [importedCount]);

  // Auto-hide PBL success message
  useEffect(() => {
    if (pblSuccess) {
      const timer = setTimeout(() => {
        setPBLSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [pblSuccess]);

  // Auto-hide PBL imported count
  useEffect(() => {
    if (pblImportedCount > 0) {
      const timer = setTimeout(() => {
        setPBLImportedCount(0);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [pblImportedCount]);

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
      
      {/* Kuliah Besar skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
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

      {/* Praktikum skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
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
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
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

      {/* PBL skeleton */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <div className="h-6 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
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
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
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
    setErrorJadwal('');
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
    setErrorJadwal('');
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
      setErrorJadwal('Data jadwal tidak valid!');
      return;
    }
    setIsSaving(true);
    try {
      await api.delete(`/mata-kuliah/${kode}/jadwal-pbl/${jadwal.id}`);
      // Setelah sukses hapus di backend, refresh data dari backend
      await fetchBatchData();
    } catch (err) {
      setErrorJadwal('Gagal menghapus jadwal PBL');
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
      setForm({ hariTanggal: '', jamMulai: '', jumlahKali: 1, jamSelesai: '', pengampu: null, materi: '', topik: '', lokasi: null, jenisBaris: 'jurnal', agenda: '', kelasPraktikum: '', pblTipe: '', modul: null, kelompok: '', kelompokBesar: null, useRuangan: true, fileJurnal: null });
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
      const templateData = [
        {
          tanggal: generateContohTanggal(),
          jam_mulai: "08:00",
          jam_selesai: "10:00",
          modul_pbl: modulPBLOptions[0]?.nama_modul || "Modul 1: Anatomi",
          kelompok_kecil: kelompokKecilOptions[0]?.nama_kelompok || "Kelompok A1",
          dosen: dosenOptions[0]?.name || "Dr. John Doe",
          ruangan: ruanganOptions[0]?.nama || "R. Anatomi",
          pbl_tipe: "PBL 1",
          topik: "Sistem Kardiovaskular"
        },
        {
          tanggal: generateContohTanggal(),
          jam_mulai: "10:00",
          jam_selesai: "12:30",
          modul_pbl: modulPBLOptions[1]?.nama_modul || "Modul 2: Fisiologi",
          kelompok_kecil: kelompokKecilOptions[1]?.nama_kelompok || "Kelompok A2",
          dosen: dosenOptions[1]?.name || "Dr. Jane Smith",
          ruangan: ruanganOptions[1]?.nama || "R. Fisiologi",
          pbl_tipe: "PBL 2",
          topik: "Sistem Respirasi"
        }
      ];

      // Buat workbook
      const wb = XLSX.utils.book_new();

      // Sheet template
      const ws = XLSX.utils.json_to_sheet(templateData);
      
      // Set lebar kolom
      const colWidths = [
        { wch: 12 }, // tanggal
        { wch: 10 }, // jam_mulai
        { wch: 10 }, // jam_selesai
        { wch: 25 }, // modul_pbl
        { wch: 15 }, // kelompok_kecil
        { wch: 20 }, // dosen
        { wch: 15 }, // ruangan
        { wch: 10 }, // pbl_tipe
        { wch: 25 }  // topik
      ];
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, "Template");

      // Sheet info data
      const infoData = [
        { kategori: "MODUL PBL YANG TERSEDIA", data: "" },
        ...modulPBLOptions.map(modul => ({ kategori: `Modul ${modul.modul_ke}`, data: modul.nama_modul })),
        { kategori: "", data: "" },
        { kategori: "KELOMPOK KECIL YANG TERSEDIA", data: "" },
        ...kelompokKecilOptions.map(kelompok => ({ kategori: kelompok.nama_kelompok, data: `${kelompok.jumlah_anggota} mahasiswa` })),
        { kategori: "", data: "" },
        { kategori: "DOSEN YANG TERSEDIA", data: "" },
        ...dosenOptions.map(dosen => ({ kategori: dosen.name, data: dosen.nid || "NID tidak tersedia" })),
        { kategori: "", data: "" },
        { kategori: "RUANGAN YANG TERSEDIA", data: "" },
        ...ruanganOptions.map(ruangan => ({ kategori: ruangan.nama, data: `Kapasitas: ${ruangan.kapasitas || 0} orang` })),
        { kategori: "", data: "" },
        { kategori: "PBL TIPE", data: "" },
        { kategori: "PBL 1", data: "2 sesi (100 menit)" },
        { kategori: "PBL 2", data: "3 sesi (150 menit)" },
        { kategori: "", data: "" },
        { kategori: "CATATAN PENTING", data: "" },
        { kategori: "1. Tanggal harus dalam rentang mata kuliah", data: `${tanggalMulai.toLocaleDateString('id-ID')} - ${tanggalAkhir.toLocaleDateString('id-ID')}` },
        { kategori: "2. Jam selesai akan dihitung otomatis", data: "Berdasarkan jam mulai + (jumlah sesi × 50 menit)" },
        { kategori: "3. PBL Tipe menentukan jumlah sesi", data: "PBL 1 = 2 sesi, PBL 2 = 3 sesi" },
        { kategori: "4. Kelompok kecil harus sesuai semester", data: `Semester ${data?.semester || 'tidak diketahui'}` }
      ];

      const infoWs = XLSX.utils.json_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: 30 }, { wch: 50 }];
      XLSX.utils.book_append_sheet(wb, infoWs, "Info Data");

      // Download file
      const fileName = `Template_Import_PBL_${data?.nama || 'MataKuliah'}_${new Date().toISOString().split('T')[0]}.xlsx`;
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error('Error generating PBL template:', error);
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
      const templateData = [
        {
          tanggal: contohTanggal1,
          jam_mulai: "08:00",
          jam_selesai: hitungJamSelesai("08:00", 2),
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
          jam_selesai: hitungJamSelesai("10:00", 2),
          materi: materiTersedia[1] || materiTersedia[0] || "Materi 2",
          topik: "Topik 2",
          nama_dosen: dosenDenganKeahlian[1]?.name || dosenDenganKeahlian[0]?.name || dosenTersedia[1]?.name || "Dosen 2",
          nama_ruangan: ruanganTersedia[1]?.nama || "Ruangan 2",
          kelompok_besar_id: kelompokBesarTersedia[1]?.id || 3,
          jumlah_sesi: 2
        }
      ];

      // Buat worksheet dengan header yang eksplisit
      const ws = XLSX.utils.json_to_sheet(templateData, {
        header: ['tanggal', 'jam_mulai', 'jam_selesai', 'materi', 'topik', 'nama_dosen', 'nama_ruangan', 'kelompok_besar_id', 'jumlah_sesi']
      });
      
      // Set lebar kolom
      const colWidths = [
        { wch: 12 }, // tanggal
        { wch: 10 }, // jam_mulai
        { wch: 10 }, // jam_selesai
        { wch: 25 }, // materi
        { wch: 25 }, // topik
        { wch: 20 }, // nama_dosen
        { wch: 20 }, // nama_ruangan
        { wch: 15 }, // kelompok_besar_id
        { wch: 8 }   // jumlah_sesi
      ];
      ws['!cols'] = colWidths;
      
      // Buat worksheet untuk informasi dosen dan ruangan yang tersedia
                const infoData = [
                  ['INFORMASI DOSEN YANG TERSEDIA (dengan keahlian):'],
                  ...dosenList.slice(0, 10).map(dosen => {
                    const keahlian = Array.isArray(dosen.keahlian) 
                      ? dosen.keahlian 
                      : (dosen.keahlian || '').split(',').map((k: string) => k.trim());
                    return [`${dosen.name} - Keahlian: ${keahlian.join(', ')}`];
                  }),
                  [''],
                  ['INFORMASI RUANGAN YANG TERSEDIA:'],
                  ...ruanganList.slice(0, 10).map(ruangan => [ruangan.nama]),
                  [''],
                  ['INFORMASI KELOMPOK BESAR YANG TERSEDIA:'],
                  ...kelompokBesarOptions.slice(0, 10).map(kelompok => [`${kelompok.id} - ${kelompok.label}`]),
                  [''],
                  ['INFORMASI MATERI YANG TERSEDIA (dari keahlian_required mata kuliah):'],
                  ...(data?.keahlian_required || []).slice(0, 10).map(keahlian => [keahlian]),
                  [''],
                  ['CATATAN:'],
                  ['1. Gunakan nama dosen dan ruangan yang ada di list di atas'],
                  ['2. Gunakan ID kelompok besar yang ada di list di atas'],
                  ['3. MATERI HARUS SESUAI dengan keahlian dosen yang dipilih'],
                  ['4. Format tanggal: YYYY-MM-DD (contoh: 2024-01-15)'],
                  ['5. TANGGAL WAJIB dalam rentang mata kuliah:'],
                  [`   - Mulai: ${tanggalMulai ? new Date(tanggalMulai).toLocaleDateString('id-ID') : 'Tidak tersedia'}`],
                  [`   - Akhir: ${tanggalAkhir ? new Date(tanggalAkhir).toLocaleDateString('id-ID') : 'Tidak tersedia'}`],
                  ['6. Format jam: HH:MM (contoh: 08:00)'],
                  ['7. PERHITUNGAN JAM SELESAI:'],
                  ['   - Jam selesai = Jam mulai + (Jumlah sesi x 50 menit)'],
                  ['   - Contoh: 08:00 + (2 x 50 menit) = 09:40'],
                  ['   - Contoh: 10:00 + (3 x 50 menit) = 12:30'],
                  ['8. Jumlah sesi: 1-6'],
                  ['9. Materi wajib diisi, topik boleh dikosongkan'],
                  ['10. Kelompok besar ID harus berupa angka (1, 3, 5, 7, dst)'],
                  ['11. TIDAK PERLU mengisi jam selesai, sistem akan hitung otomatis'],
                  ['12. PENTING: Materi harus sesuai dengan keahlian dosen yang dipilih!']
                ];
      
      const infoWs = XLSX.utils.aoa_to_sheet(infoData);
      infoWs['!cols'] = [{ wch: 50 }];
      
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Template");
      XLSX.utils.book_append_sheet(wb, infoWs, "Info Dosen & Ruangan");
      XLSX.writeFile(wb, "Template_Import_JadwalKuliahBesar.xlsx");
    } catch (error) {
      // Error downloading template
    }
  };

  // Fungsi untuk membaca file Excel
  // Fungsi untuk membaca file Excel PBL
  const readPBLExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'binary' });
          const sheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[sheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Gagal membaca file Excel'));
      reader.readAsBinaryString(file);
    });
  };

  // Fungsi untuk mendeteksi format Excel
  const detectExcelFormat = (headers: string[]): 'legacy' | 'client' | 'unknown' => {
    const headerStr = headers.join(' ').toLowerCase();
    
    // Format lama: tanggal, jam_mulai, jam_selesai
    if (headerStr.includes('tanggal') && headerStr.includes('jam_mulai') && headerStr.includes('jam_selesai')) {
      return 'legacy';
    }
    
    // Format klien: Kurikulum, Kode MK, Nama Kelas, Topik, Tanggal, Waktu Mulai, Waktu Selesai
    if (headerStr.includes('kurikulum') && headerStr.includes('kode mk') && 
        headerStr.includes('nama kelas') && headerStr.includes('topik') && 
        headerStr.includes('tanggal') && headerStr.includes('waktu mulai') && 
        headerStr.includes('waktu selesai')) {
      return 'client';
    }
    
    return 'unknown';
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
      console.warn('Error calculating session count:', error);
      return 2; // fallback ke 2 sesi
    }
  };

  // Fungsi untuk mapping format klien ke format standar
  const mapClientFormatToStandard = (row: any[], headers: string[]): any => {
    const getColumnValue = (columnName: string): string => {
      const index = headers.findIndex(h => h.toLowerCase().includes(columnName.toLowerCase()));
      return index >= 0 ? (row[index]?.toString() || '') : '';
    };

    const tanggal = getColumnValue('tanggal');
    const waktuMulai = getColumnValue('waktu mulai');
    const waktuSelesai = getColumnValue('waktu selesai');
    const topik = getColumnValue('topik');
    const nipPengajar = getColumnValue('nip pengajar');
    const ruang = getColumnValue('ruang');
    const namaKelas = getColumnValue('nama kelas');
    
    // Hitung jumlah sesi otomatis jika waktu mulai dan selesai tersedia
    let jumlahSesi = 2; // default
    if (waktuMulai && waktuSelesai) {
      try {
        jumlahSesi = hitungJumlahSesi(waktuMulai, waktuSelesai);
      } catch (error) {
        console.warn('Error calculating session count:', error);
        jumlahSesi = 2; // fallback
      }
    }
    
    return {
      tanggal,
      jam_mulai: waktuMulai,
      jam_selesai: waktuSelesai,
      materi: topik,
      topik: topik,
      nama_dosen: nipPengajar, // Akan di-resolve ke dosen_id nanti
      nama_ruangan: ruang, // Akan di-resolve ke ruangan_id nanti
      kelompok_besar_id: namaKelas, // Akan di-resolve nanti
      jumlah_sesi: jumlahSesi
    };
  };

  const readExcelFile = (file: File): Promise<{ data: any[], format: 'legacy' | 'client' | 'unknown', headers: string[] }> => {
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
          
          // Deteksi format
          const format = detectExcelFormat(headers);
          
          // Skip header row dan filter baris kosong
          const dataRows = jsonData.slice(1).filter((row: any[]) => 
            row.some(cell => cell && cell.toString().trim() !== '')
          );
          
          resolve({ data: dataRows, format, headers });
        } catch (error) {
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsArrayBuffer(file);
    });
  };

  // Fungsi untuk validasi data Excel (menggunakan data yang sudah dikonversi)
  // Fungsi untuk validasi data Excel PBL
  const validatePBLExcelData = (convertedData: JadwalPBLType[]) => {
    const cellErrors: { row: number, field: string, message: string }[] = [];

    convertedData.forEach((row, index) => {
      // Validasi field wajib
      if (!row.tanggal) {
        cellErrors.push({ row: index, field: 'tanggal', message: 'Tanggal wajib diisi' });
      }
      if (!row.jam_mulai) {
        cellErrors.push({ row: index, field: 'jam_mulai', message: 'Jam mulai wajib diisi' });
      }
      if (!row.modul_pbl_id) {
        cellErrors.push({ row: index, field: 'modul_pbl_id', message: 'Modul PBL wajib diisi' });
      }
      if (!row.kelompok_kecil_id) {
        cellErrors.push({ row: index, field: 'kelompok_kecil_id', message: 'Kelompok kecil wajib diisi' });
      }
      if (!row.dosen_id) {
        cellErrors.push({ row: index, field: 'dosen_id', message: 'Dosen wajib diisi' });
      }
      if (!row.ruangan_id) {
        cellErrors.push({ row: index, field: 'ruangan_id', message: 'Ruangan wajib diisi' });
      }

      // Validasi format tanggal
      if (row.tanggal && !/^\d{4}-\d{2}-\d{2}$/.test(row.tanggal)) {
        cellErrors.push({ row: index, field: 'tanggal', message: 'Format tanggal tidak valid' });
      }

      // Validasi format jam
      if (row.jam_mulai && !/^\d{2}:\d{2}$/.test(row.jam_mulai)) {
        cellErrors.push({ row: index, field: 'jam_mulai', message: 'Format jam mulai tidak valid' });
      }

      // Validasi tanggal dalam rentang mata kuliah
      if (row.tanggal && data?.tanggal_mulai && data?.tanggal_akhir) {
        const jadwalTanggal = new Date(row.tanggal);
        const tanggalMulai = new Date(data.tanggal_mulai);
        const tanggalAkhir = new Date(data.tanggal_akhir);
        
        if (jadwalTanggal < tanggalMulai || jadwalTanggal > tanggalAkhir) {
          cellErrors.push({ row: index, field: 'tanggal', message: 'Tanggal di luar rentang mata kuliah' });
        }
      }

      // Validasi modul PBL
      if (row.modul_pbl_id) {
        const modulPBL = modulPBLList?.find(m => m.id === row.modul_pbl_id);
        if (!modulPBL) {
          cellErrors.push({ row: index, field: 'modul_pbl_id', message: 'Modul PBL tidak ditemukan' });
        }
      }

      // Validasi kelompok kecil
      if (row.kelompok_kecil_id) {
        const kelompokKecil = kelompokKecilList?.find(k => k.id === row.kelompok_kecil_id);
        if (!kelompokKecil) {
          cellErrors.push({ row: index, field: 'kelompok_kecil_id', message: 'Kelompok kecil tidak ditemukan' });
        }
      }

      // Validasi dosen
      if (row.dosen_id) {
        const dosen = allDosenList?.find(d => d.id === row.dosen_id);
        if (!dosen) {
          cellErrors.push({ row: index, field: 'dosen_id', message: 'Dosen tidak ditemukan' });
        }
      }

      // Validasi ruangan
      if (row.ruangan_id) {
        const ruangan = allRuanganList?.find(r => r.id === row.ruangan_id);
        if (!ruangan) {
          cellErrors.push({ row: index, field: 'ruangan_id', message: 'Ruangan tidak ditemukan' });
        }
      }

      // Validasi jam selesai jika ada
      if (row.jam_selesai && row.jam_mulai) {
        const jamMulai = new Date(`2000-01-01T${row.jam_mulai}`);
        const jamSelesai = new Date(`2000-01-01T${row.jam_selesai}`);
        
        if (jamSelesai <= jamMulai) {
          cellErrors.push({ row: index, field: 'jam_selesai', message: 'Jam selesai harus lebih besar dari jam mulai' });
        }
      }
    });

    return { cellErrors };
  };

  const validateExcelData = (convertedData: JadwalKuliahBesarType[], existingData?: JadwalKuliahBesarType[]) => {
    const errors: string[] = [];
    const cellErrors: { row: number, field: string, message: string }[] = [];
    
    convertedData.forEach((row, index) => {
      const rowNum = index + 2;
      
      // Validasi field wajib
      if (!row.tanggal || !row.jam_mulai || !row.materi || !row.kelompok_besar_id) {
        errors.push(`Baris ${rowNum}: Tanggal, jam mulai, materi, dan kelompok besar ID wajib diisi`);
        return;
      }
      
      // Validasi format tanggal
      const tanggal = row.tanggal.toString();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) {
        cellErrors.push({ row: index, field: 'tanggal', message: 'Format tanggal harus YYYY-MM-DD' });
      } else {
        // Validasi tanggal dalam rentang mata kuliah
        if (data) {
          const tanggalJadwal = new Date(tanggal);
          const tanggalMulai = new Date(data.tanggal_mulai || '');
          const tanggalAkhir = new Date(data.tanggal_akhir || '');
          
          if (tanggalJadwal < tanggalMulai) {
            cellErrors.push({ 
              row: index, 
              field: 'tanggal', 
              message: `Tanggal jadwal tidak boleh sebelum tanggal mulai mata kuliah (${tanggalMulai.toLocaleDateString('id-ID')})` 
            });
          } else if (tanggalJadwal > tanggalAkhir) {
            cellErrors.push({ 
              row: index, 
              field: 'tanggal', 
              message: `Tanggal jadwal tidak boleh setelah tanggal akhir mata kuliah (${tanggalAkhir.toLocaleDateString('id-ID')})` 
            });
          }
        }
      }
      
      // Validasi format jam
      const jamMulai = row.jam_mulai.toString();
      if (!/^\d{2}:\d{2}$/.test(jamMulai)) {
        cellErrors.push({ row: index, field: 'jam_mulai', message: 'Format jam mulai harus HH:MM' });
      }
      
      // Validasi jam selesai (jika ada, harus sesuai perhitungan sistem)
      if (row.jam_selesai) {
        let jamSelesai = row.jam_selesai.toString();
        
        // Konversi format titik (.) ke titik dua (:) jika perlu
        if (jamSelesai.includes('.')) {
          jamSelesai = jamSelesai.replace('.', ':');
        }
        
        if (!/^\d{2}:\d{2}$/.test(jamSelesai)) {
          cellErrors.push({ row: index, field: 'jam_selesai', message: 'Format jam selesai harus HH:MM' });
        } else {
          // Hitung jam selesai yang seharusnya berdasarkan sistem
          const jumlahSesi = row.jumlah_sesi || 1;
          const jamSelesaiSeharusnya = hitungJamSelesai(jamMulai, jumlahSesi);
          if (jamSelesai !== jamSelesaiSeharusnya) {
            cellErrors.push({ row: index, field: 'jam_selesai', message: `Jam selesai seharusnya ${jamSelesaiSeharusnya} (${jumlahSesi} x 50 menit dari ${jamMulai})` });
          }
        }
      }
      
      // Validasi kelompok besar ID
      const kelompokBesarId = parseInt(row.kelompok_besar_id.toString());
      if (isNaN(kelompokBesarId) || kelompokBesarId < 1) {
        cellErrors.push({ row: index, field: 'kelompok_besar_id', message: 'Kelompok besar ID harus berupa angka positif' });
      } else {
        // Validasi kelompok besar ID ada di database
        const kelompokBesar = kelompokBesarOptions.find(k => Number(k.id) === kelompokBesarId);
        if (!kelompokBesar) {
          cellErrors.push({ row: index, field: 'kelompok_besar_id', message: `Kelompok besar ID ${kelompokBesarId} tidak ditemukan` });
        } else {
          // Validasi semester kelompok besar sesuai dengan semester mata kuliah
          const mataKuliahSemester = data?.semester;
          if (mataKuliahSemester && kelompokBesarId != mataKuliahSemester) {
            cellErrors.push({ row: index, field: 'kelompok_besar_id', message: `Kelompok besar ID ${kelompokBesarId} tidak sesuai dengan semester mata kuliah (${mataKuliahSemester}). Hanya boleh menggunakan kelompok besar semester ${mataKuliahSemester}.` });
          }
        }
      }
      
      // Validasi jumlah sesi
      const jumlahSesi = row.jumlah_sesi || 1;
      if (jumlahSesi < 1 || jumlahSesi > 6) {
        cellErrors.push({ row: index, field: 'jumlah_sesi', message: 'Jumlah sesi harus antara 1-6' });
      }
      
      // Validasi dosen exist
      if (!row.dosen_id) {
        cellErrors.push({ row: index, field: 'nama_dosen', message: 'Dosen tidak ditemukan' });
      } else {
        // Validasi keahlian dosen dengan materi
        const dosen = dosenList.find(d => d.id === row.dosen_id);
        if (dosen && row.materi) {
          const keahlianDosen = Array.isArray(dosen.keahlian) 
            ? dosen.keahlian 
            : (dosen.keahlian || '').split(',').map((k: string) => k.trim());
          
          if (!keahlianDosen.includes(row.materi)) {
            cellErrors.push({ 
              row: index, 
              field: 'materi', 
              message: `Materi "${row.materi}" tidak sesuai dengan keahlian dosen "${dosen.name}". Keahlian dosen: ${keahlianDosen.join(', ')}` 
            });
          }
        }
      }
      
      // Validasi ruangan exist
      if (!row.ruangan_id) {
        cellErrors.push({ row: index, field: 'nama_ruangan', message: 'Ruangan tidak ditemukan' });
      }
    });
    
    return { errors, cellErrors };
  };

  // Handler untuk upload file Excel
  // Handler untuk upload file Excel PBL
  const handlePBLImportExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsPBLImporting(true);
      setPBLCellErrors([]);
      setPBLImportData([]);

      // Baca file Excel
      const rawData = await readPBLExcelFile(file);
      
      if (rawData.length === 0) {
        setPBLCellErrors([{ row: 0, field: 'file', message: 'File Excel kosong atau tidak valid' }]);
        return;
      }

      // Konversi data Excel ke format yang diharapkan
      const convertedData: JadwalPBLType[] = rawData.map((row: any, index: number) => {
        // Cari modul PBL berdasarkan nama
        const modulPBL = modulPBLList?.find(m => 
          m.nama_modul.toLowerCase().includes((row.modul_pbl || '').toLowerCase()) ||
          (row.modul_pbl || '').toLowerCase().includes(m.nama_modul.toLowerCase())
        );

        // Cari kelompok kecil berdasarkan nama
        const kelompokKecil = kelompokKecilList?.find(k => 
          k.nama_kelompok.toLowerCase() === (row.kelompok_kecil || '').toLowerCase()
        );

        // Cari dosen berdasarkan nama
        const dosen = allDosenList?.find(d => 
          d.name.toLowerCase() === (row.dosen || '').toLowerCase()
        );

        // Cari ruangan berdasarkan nama
        const ruangan = allRuanganList?.find(r => 
          r.nama.toLowerCase() === (row.ruangan || '').toLowerCase()
        );

        // Hitung jam selesai berdasarkan PBL tipe
        const pblTipe = row.pbl_tipe || 'PBL 1';
        const jumlahSesi = pblTipe === 'PBL 2' ? 3 : 2;
        const jamSelesai = hitungJamSelesai(row.jam_mulai || '08:00', jumlahSesi);

        return {
          tanggal: row.tanggal || '',
          jam_mulai: row.jam_mulai || '',
          jam_selesai: row.jam_selesai || jamSelesai,
          modul_pbl_id: modulPBL?.id || 0,
          kelompok_kecil_id: kelompokKecil?.id || 0,
          dosen_id: dosen?.id || 0,
          ruangan_id: ruangan?.id || 0,
          pbl_tipe: pblTipe,
          topik: row.topik || '',
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
      console.error('Error reading PBL Excel file:', error);
      setPBLCellErrors([{ row: 0, field: 'file', message: 'Gagal membaca file Excel. Pastikan format file benar.' }]);
    } finally {
      setIsPBLImporting(false);
      // Reset file input
      if (pblFileInputRef.current) {
        pblFileInputRef.current.value = '';
      }
    }
  };

  const handleImportExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Refresh data kelompok besar terlebih dahulu
    await fetchBatchData();
    
    if (!file.name.endsWith('.xlsx') && !file.name.endsWith('.xls')) {
      setImportErrors(['File harus berformat Excel (.xlsx atau .xls)']);
      setShowImportModal(true);
      return;
    }
    
    setImportFile(file);
    setImportErrors([]);
    
    try {
      const { data: excelData, format, headers } = await readExcelFile(file);
      
      if (excelData.length === 0) {
        setImportErrors(['File Excel kosong atau tidak memiliki data']);
        setShowImportModal(true);
        return;
      }

      // Cek format yang dideteksi
      if (format === 'unknown') {
        setImportErrors(['Format file Excel tidak dikenali. Pastikan menggunakan template yang benar.']);
        setShowImportModal(true);
        return;
      }

      // Konversi ke format JadwalKuliahBesarType berdasarkan format yang dideteksi
      const convertedData: JadwalKuliahBesarType[] = excelData.map(row => {
        let mappedData: any;

        if (format === 'legacy') {
          // Format lama (existing logic)
          const namaDosen = row[5].toString().trim();
          const namaRuangan = row[6].toString().trim();
          const kelompokBesarId = parseInt(row[7]);
          const jumlahSesi = parseInt(row[8]) || 2;
          const jamMulai = row[1].toString();
          
          const dosen = dosenList.find(d => d.name.toLowerCase() === namaDosen.toLowerCase());
          const ruangan = ruanganList.find(r => r.nama.toLowerCase() === namaRuangan.toLowerCase());
          
          // Hitung jam selesai otomatis berdasarkan sistem
          let jamSelesai = hitungJamSelesai(jamMulai, jumlahSesi);
          
          // Jika ada jam selesai di Excel, gunakan yang ada (dengan konversi format)
          if (row[2]) {
            jamSelesai = row[2].toString();
            // Konversi format titik (.) ke titik dua (:) jika perlu
            if (jamSelesai.includes('.')) {
              jamSelesai = jamSelesai.replace('.', ':');
            }
          }
          
          mappedData = {
            tanggal: row[0].toString(),
            jam_mulai: jamMulai,
            jam_selesai: jamSelesai,
            materi: row[3].toString(),
            topik: row[4] ? row[4].toString() : '',
            dosen_id: dosen?.id || 0,
            ruangan_id: ruangan?.id || 0,
            kelompok_besar_id: kelompokBesarId || 1,
            jumlah_sesi: jumlahSesi
          };
        } else if (format === 'client') {
          // Format klien - gunakan mapping function
          const clientData = mapClientFormatToStandard(row, headers);
          
          // Debug log untuk mapping
          console.log('Client data mapped:', clientData);
          
          // Resolve nama dosen ke dosen_id
          const dosen = dosenList.find(d => 
            d.name.toLowerCase().includes(clientData.nama_dosen.toLowerCase()) ||
            d.nid?.toLowerCase().includes(clientData.nama_dosen.toLowerCase())
          );
          
          // Resolve nama ruangan ke ruangan_id
          const ruangan = ruanganList.find(r => 
            r.nama.toLowerCase().includes(clientData.nama_ruangan.toLowerCase())
          );
          
          // Resolve kelompok besar (untuk sementara set ke 1, bisa dikembangkan lebih lanjut)
          const kelompokBesarId = 1;
          
          mappedData = {
            tanggal: clientData.tanggal,
            jam_mulai: clientData.jam_mulai,
            jam_selesai: clientData.jam_selesai,
            materi: clientData.materi,
            topik: clientData.topik,
            dosen_id: dosen?.id || 0,
            ruangan_id: ruangan?.id || 0,
            kelompok_besar_id: kelompokBesarId,
            jumlah_sesi: clientData.jumlah_sesi
          };
          
          // Debug log untuk resolved data
          console.log('Resolved data:', {
            dosen_found: !!dosen,
            ruangan_found: !!ruangan,
            dosen_name: dosen?.name,
            ruangan_name: ruangan?.nama
          });
        }

        return mappedData;
      });
      
      // Validasi data setelah konversi
      const validationResult = validateExcelData(convertedData, jadwalKuliahBesar);
      setImportErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors);
      
      // Tampilkan informasi format yang dideteksi
      const formatInfo = format === 'legacy' ? 'Format Template Lama' : 'Format Template Baru';
      console.log(`Format Excel terdeteksi: ${formatInfo}`);
      console.log(`Headers yang ditemukan:`, headers);
      console.log(`Jumlah baris data:`, excelData.length);
      
      setDetectedFormat(format);
      setImportData(convertedData);
      setShowImportModal(true);
    } catch (error) {
      setImportErrors(['Gagal membaca file Excel: ' + (error as Error).message]);
      setShowImportModal(true);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handler untuk submit import
  // Handler untuk submit import PBL
  const handlePBLSubmitImport = async () => {
    if (pblImportData.length === 0) return;

    try {
      setIsPBLImporting(true);
      
      const response = await api.post(`/mata-kuliah/${kode}/jadwal-pbl/import`, {
        data: pblImportData
      });

      if (response.status === 200) {
        setPBLImportedCount(response.data.success || pblImportData.length);
        await fetchBatchData(); // Refresh data
        setShowPBLImportModal(false);
        setPBLImportData([]);
        setPBLImportFile(null);
        setPBLCellErrors([]);
        setPBLEditingCell(null);
        setPBLImportSuccess(false);
        setPBLImportPage(1);
      }
    } catch (error: any) {
      console.error('Error importing PBL data:', error);
      
      if (error.response?.status === 422) {
        // Handle validation errors
        const errorData = error.response.data;
        if (errorData.errors && Array.isArray(errorData.errors)) {
          const cellErrors = errorData.errors.map((err: string, idx: number) => ({
            row: idx,
            field: 'api',
            message: err
          }));
          setPBLCellErrors(cellErrors);
        } else {
          setPBLCellErrors([{ row: 0, field: 'api', message: 'Terjadi kesalahan validasi data' }]);
        }
      } else {
        setPBLCellErrors([{ row: 0, field: 'api', message: 'Gagal mengimpor data. Silakan coba lagi.' }]);
      }
    } finally {
      setIsPBLImporting(false);
    }
  };

  const handleSubmitImport = async () => {
    if (importData.length === 0) return;
    
    setIsImporting(true);
    setImportErrors([]);
    
    try {
      // Kirim data ke backend untuk validasi dan import
      const response = await api.post(`/kuliah-besar/import/${data!.kode}`, {
        data: importData
      });
      
      // Tampilkan error jika ada
      if (response.data.errors && response.data.errors.length > 0) {
        setImportErrors(response.data.errors);
      }
      
      // Jika berhasil import sebagian atau semua
      if (response.data.success > 0) {
        setImportedCount(response.data.success);
        await fetchBatchData(); // Refresh data
        setShowImportModal(false);
        setImportData([]);
        setImportFile(null);
        setImportErrors([]);
        setCellErrors([]);
        setEditingCell(null);
        setImportSuccess(false);
        setImportPage(1);
      }
    } catch (error: any) {
      // Handle error response (termasuk status 422)
      if (error.response?.data?.errors && error.response.data.errors.length > 0) {
        setImportErrors(error.response.data.errors);
      } else {
        const errorMessage = error.response?.data?.message || 'Gagal mengimport data';
        setImportErrors([errorMessage]);
      }
    }
    
    setIsImporting(false);
  };

  // Handler untuk close modal import
  // Handler untuk close modal import PBL
  const handlePBLCloseImportModal = () => {
    setShowPBLImportModal(false);
    setPBLImportData([]);
    setPBLCellErrors([]);
    setPBLImportFile(null);
    setPBLImportSuccess(false);
    setPBLEditingCell(null);
    setPBLImportPage(1);
    
    // Reset file input
    if (pblFileInputRef.current) {
      pblFileInputRef.current.value = '';
    }
  };

  const handlePBLCellEdit = (rowIdx: number, key: string, value: string) => {
    const newData = [...pblImportData];
    newData[rowIdx] = { ...newData[rowIdx], [key]: value };
    setPBLImportData(newData);

    // Re-validate data
    const { cellErrors } = validatePBLExcelData(newData);
    setPBLCellErrors(cellErrors);
  };

  const handlePBLDosenEdit = (rowIdx: number, value: string) => {
    const newData = [...pblImportData];
    const dosen = allDosenList?.find(d => d.name.toLowerCase() === value.toLowerCase());
    newData[rowIdx] = { 
      ...newData[rowIdx], 
      dosen_id: dosen?.id || 0,
      nama_dosen: value 
    };
    setPBLImportData(newData);

    // Re-validate data
    const { cellErrors } = validatePBLExcelData(newData);
    setPBLCellErrors(cellErrors);
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

  const handleCloseImportModal = () => {
    setShowImportModal(false);
    setImportData([]);
    setImportFile(null);
    setImportErrors([]);
    setCellErrors([]);
    setEditingCell(null);
    setImportSuccess(false);
    setImportPage(1);
    setDetectedFormat(null);
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Logika pagination untuk import preview
  const importTotalPages = Math.ceil(importData.length / importPageSize);
  const importPaginatedData = importData.slice(
    (importPage - 1) * importPageSize,
    importPage * importPageSize
  );

  // Logika pagination untuk PBL import preview
  const pblImportTotalPages = Math.ceil(pblImportData.length / pblImportPageSize);
  const pblImportPaginatedData = pblImportData.slice(
    (pblImportPage - 1) * pblImportPageSize,
    pblImportPage * pblImportPageSize
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
      const selectedDosen = dosenList.find(d => d.name.toLowerCase() === value.toLowerCase());
      
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
          onClick={() => navigate(-1)}
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
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Kuliah Besar</h2>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform cursor-pointer">
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-brand-700 dark:text-brand-200" />
              Import Excel
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleImportExcel}
                className="hidden"
              />
            </label>
            <button
              onClick={downloadTemplate}
              className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
              Download Template Excel
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
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {success}
            </motion.div>
          )}
        </AnimatePresence>

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
                {jadwalKuliahBesar.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-6 text-gray-400">Tidak ada data Kuliah Besar</td>
                  </tr>
                ) : (
                    jadwalKuliahBesar.map((row, i) => {
                      const dosen = allDosenList.find(d => d.id === row.dosen_id);
                      const ruangan = allRuanganList.find(r => r.id === row.ruangan_id);
                    return (
                      <tr key={row.id} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>
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
      </div>
      {/* Section Praktikum */}
        <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Praktikum</h2>
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
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll" >
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
                {jadwalPraktikum.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-6 text-gray-400">Tidak ada data Praktikum</td>
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
      </div>
      {/* Section Agenda Khusus */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Agenda Khusus</h2>
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
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll" >
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
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
                    <td colSpan={8} className="text-center py-6 text-gray-400">Tidak ada data Agenda Khusus</td>
                  </tr>
                ) : (
                  jadwalAgendaKhusus.map((row: any, i: number) => (
                    <tr key={row.id} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>
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
                        <input type="text" name="topik" value={form.topik} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
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
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">PBL</h2>
          <div className="flex items-center gap-3">
            {/* Import Excel Button */}
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform cursor-pointer">
              <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-brand-700 dark:text-brand-200" />
              Import Excel
              <input
                ref={pblFileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handlePBLImportExcel}
                className="hidden"
              />
            </label>
            
            {/* Download Template Button */}
            <button
              onClick={downloadPBLTemplate}
              className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
              Download Template Excel
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

        {/* Success Messages untuk PBL */}
        <AnimatePresence>
          {pblSuccess && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 dark:bg-green-900/20 rounded-md p-3 mb-4 text-green-700 dark:text-green-300"
            >
              {pblSuccess}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {pblImportedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 dark:bg-green-900/20 rounded-md p-3 mb-4 text-green-700 dark:text-green-300"
            >
              {pblImportedCount} jadwal PBL berhasil diimpor ke database.
            </motion.div>
          )}
        </AnimatePresence>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll" >
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
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
                    <td colSpan={10} className="text-center py-6 text-gray-400">Tidak ada data PBL</td>
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
                            <FontAwesomeIcon icon={faStar} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
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
      </div>
      {/* Section Jurnal Reading */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Jurnal Reading</h2>
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
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition"
          >
            Tambah Jadwal
          </button>
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll" >
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                <tr>
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
                    <td colSpan={10} className="text-center py-6 text-gray-400">Tidak ada data Jurnal Reading</td>
                  </tr>
                ) : (
                  jadwalJurnalReading.map((row: any, i: number) => (
                    <tr key={row.id} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>
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
                          <FontAwesomeIcon icon={faStar} className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />
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
                <p className="text-sm text-gray-500 dark:text-gray-400">Preview dan validasi data sebelum import</p>
                {detectedFormat && (
                  <div className="mt-2">
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                      detectedFormat === 'legacy' 
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                        : detectedFormat === 'client'
                        ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
                        : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300'
                    }`}>
                      {detectedFormat === 'legacy' ? 'Format Template Lama' : 
                       detectedFormat === 'client' ? 'Format Template Baru' : 'Format Tidak Dikenali'}
                    </span>
                  </div>
                )}
              </div>

              {importSuccess ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FontAwesomeIcon icon={faStar} className="w-10 h-10 text-green-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Import Berhasil!</h3>
                  <p className="text-gray-500 dark:text-gray-400">Data jadwal kuliah besar berhasil diimport.</p>
                </div>
              ) : (
                <>
                  {/* File Info */}
                  {importFile && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-blue-500" />
                        <div className="flex-1">
                          <p className="font-medium text-blue-800 dark:text-blue-200">{importFile.name}</p>
                          <p className="text-sm text-blue-600 dark:text-blue-300">
                            {(importFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                        {detectedFormat && (
                          <div className="flex items-center gap-2">
                            <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                              detectedFormat === 'legacy' 
                                ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                : detectedFormat === 'client'
                                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300'
                                : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300'
                            }`}>
                              {detectedFormat === 'legacy' ? 'Template Lama' : 
                               detectedFormat === 'client' ? 'Template Baru' : 'Format Tidak Dikenali'}
                            </span>
                            {detectedFormat === 'client' && (
                              <span className="text-xs text-purple-600 dark:text-purple-400">
                                (Auto-mapping ke format standar - {importData.length} data)
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Error Messages */}
                  {(importErrors.length > 0 || cellErrors.length > 0) && (
                    <div className="mb-6">
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5 text-red-500" />
                          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                            Error Validasi ({importErrors.length + cellErrors.length} error)
                          </h3>
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {/* Error dari API response */}
                          {importErrors.map((err, idx) => (
                            <p key={idx} className="text-sm text-red-600 dark:text-red-400 mb-1">• {err}</p>
                          ))}
                          {/* Error cell/detail */}
                          {cellErrors.map((err, idx) => (
                            <p key={idx} className="text-sm text-red-600 dark:text-red-400 mb-1">
                              • {err.message} (Baris {err.row + 1}, Kolom {err.field.toUpperCase()})
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preview Data Table */}
                  {importData.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Preview Data ({importData.length} jadwal)
                        </h3>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          File: {importFile?.name}
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
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Jam Selesai</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Materi</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Dosen</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok Besar</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Sesi</th>
                              </tr>
                            </thead>
                            <tbody>
                              {importPaginatedData.map((row, index) => {
                                const actualIndex = (importPage - 1) * importPageSize + index;
                                const dosen = dosenList.find(d => d.id === row.dosen_id);
                                const ruangan = ruanganList.find(r => r.id === row.ruangan_id);
                                const kelompokBesar = kelompokBesarOptions.find(k => Number(k.id) === row.kelompok_besar_id);
                                
                                const renderEditableCell = (field: string, value: any, isNumeric = false) => {
                                  const isEditing = editingCell?.row === actualIndex && editingCell?.key === field;
                                  const cellError = cellErrors.find(err => err.row === actualIndex && err.field === field);
                                  
                                  return (
                                    <td
                                      className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                      onClick={() => setEditingCell({ row: actualIndex, key: field })}
                                      title={cellError ? cellError.message : ''}
                                    >
                                      {isEditing ? (
                                        <input
                                          className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                          type={isNumeric ? "number" : "text"}
                                          value={value || ""}
                                          onChange={e => handleCellEdit(actualIndex, field, e.target.value)}
                                          onBlur={() => setEditingCell(null)}
                                          autoFocus
                                        />
                                      ) : (
                                        value || '-'
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
                                    {renderEditableCell('jam_selesai', row.jam_selesai)}
                                    {renderEditableCell('materi', row.materi)}
                                    {renderEditableCell('topik', row.topik)}
                                    
                                    {/* Dosen - Special handling */}
                                    {(() => {
                                      const field = 'nama_dosen';
                                      const isEditing = editingCell?.row === index && editingCell?.key === field;
                                      const cellError = cellErrors.find(err => err.row === index && err.field === field);
                                      
                                      return (
                                        <td
                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                          onClick={() => setEditingCell({ row: index, key: field })}
                                          title={cellError ? cellError.message : ''}
                                        >
                                          {isEditing ? (
                                            <input
                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                              value={row.nama_dosen || dosen?.name || ""}
                                              onChange={e => handleDosenEdit(actualIndex, e.target.value)}
                                              onBlur={() => setEditingCell(null)}
                                              autoFocus
                                            />
                                          ) : (
                                            <span className={dosen ? 'text-gray-800 dark:text-white/90' : 'text-red-500'}>
                                              {dosen?.name || 'Tidak ditemukan'}
                                            </span>
                                          )}
                                        </td>
                                      );
                                    })()}
                                    
                                    {/* Ruangan - Special handling */}
                                    {(() => {
                                      const field = 'nama_ruangan';
                                      const isEditing = editingCell?.row === index && editingCell?.key === field;
                                      const cellError = cellErrors.find(err => err.row === index && err.field === field);
                                      
                                      return (
                                        <td
                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                          onClick={() => setEditingCell({ row: index, key: field })}
                                          title={cellError ? cellError.message : ''}
                                        >
                                          {isEditing ? (
                                            <input
                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                              value={row.nama_ruangan || ruangan?.nama || ""}
                                              onChange={e => handleRuanganEdit(actualIndex, e.target.value)}
                                              onBlur={() => setEditingCell(null)}
                                              autoFocus
                                            />
                                          ) : (
                                            <span className={ruangan ? 'text-gray-800 dark:text-white/90' : 'text-red-500'}>
                                              {ruangan?.nama || 'Tidak ditemukan'}
                                            </span>
                                          )}
                                        </td>
                                      );
                                    })()}
                                    
                                    {(() => {
                                      const field = 'kelompok_besar_id';
                                      const isEditing = editingCell?.row === index && editingCell?.key === field;
                                      const cellError = cellErrors.find(err => err.row === index && err.field === field);
                                      
                                      return (
                                        <td
                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                          onClick={() => setEditingCell({ row: index, key: field })}
                                          title={cellError ? cellError.message : ''}
                                        >
                                          {isEditing ? (
                                            <input
                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                              type="number"
                                              value={row.kelompok_besar_id || ""}
                                              onChange={e => handleCellEdit(actualIndex, field, e.target.value)}
                                              onBlur={() => setEditingCell(null)}
                                              autoFocus
                                            />
                                          ) : (
                                            <span className="text-gray-800 dark:text-white/90">
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
                      {importData.length > importPageSize && (
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
                              Menampilkan {((importPage - 1) * importPageSize) + 1}-{Math.min(importPage * importPageSize, importData.length)} dari {importData.length} jadwal
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

                  {/* Mapping Info untuk Format Klien */}
                  {detectedFormat === 'client' && (
                    <div className="mb-6 p-4 bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg">
                      <div className="flex items-start gap-3">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5 text-purple-500 mt-0.5" />
                        <div>
                          <h4 className="font-medium text-purple-800 dark:text-purple-200 mb-2">
                            Auto-Mapping Format Klien
                          </h4>
                          <div className="text-sm text-purple-700 dark:text-purple-300 space-y-1">
                            <p>• <strong>Tanggal</strong> → tanggal</p>
                            <p>• <strong>Waktu Mulai</strong> → jam_mulai</p>
                            <p>• <strong>Waktu Selesai</strong> → jam_selesai</p>
                            <p>• <strong>Topik</strong> → materi</p>
                            <p>• <strong>NIP Pengajar</strong> → nama_dosen (auto-resolve ke dosen_id)</p>
                            <p>• <strong>Ruang</strong> → nama_ruangan (auto-resolve ke ruangan_id)</p>
                            <p>• <strong>Jumlah Sesi</strong> → auto-calculated dari durasi (1 sesi = 50 menit)</p>
                          </div>
                          <div className="mt-3 p-2 bg-purple-100 dark:bg-purple-800/30 rounded text-xs">
                            <p className="text-purple-800 dark:text-purple-200">
                              <strong>Statistik Mapping:</strong> {importData.length} baris data berhasil di-mapping
                            </p>
                          </div>
                        </div>
                      </div>
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
                    {importData.length > 0 && importErrors.length === 0 && cellErrors.length === 0 && (
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
                            Import Data ({importData.length} jadwal)
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Import PBL Excel */}
      <AnimatePresence>
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
                <p className="text-sm text-gray-500 dark:text-gray-400">Preview dan validasi data sebelum import</p>
              </div>

              {pblImportSuccess ? (
                <div className="text-center py-12">
                  <div className="w-20 h-20 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <FontAwesomeIcon icon={faStar} className="w-10 h-10 text-green-500" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">Import Berhasil!</h3>
                  <p className="text-gray-500 dark:text-gray-400">Data jadwal PBL berhasil diimport.</p>
                </div>
              ) : (
                <>
                  {/* File Info */}
                  {pblImportFile && (
                    <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="flex items-center gap-3">
                        <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-blue-500" />
                        <div>
                          <p className="font-medium text-blue-800 dark:text-blue-200">{pblImportFile.name}</p>
                          <p className="text-sm text-blue-600 dark:text-blue-300">
                            {(pblImportFile.size / 1024).toFixed(1)} KB
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Error Messages */}
                  {pblCellErrors.length > 0 && (
                    <div className="mb-6">
                      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                        <div className="flex items-center gap-2 mb-3">
                          <FontAwesomeIcon icon={faExclamationTriangle} className="w-5 h-5 text-red-500" />
                          <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                            Error Validasi ({pblCellErrors.length} error)
                          </h3>
                        </div>
                        <div className="max-h-40 overflow-y-auto">
                          {pblCellErrors.map((err, idx) => (
                            <p key={idx} className="text-sm text-red-600 dark:text-red-400 mb-1">
                              • {err.message} (Baris {err.row + 1}, Kolom {err.field.toUpperCase()})
                            </p>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Preview Data Table */}
                  {pblImportData.length > 0 && (
                    <div className="mb-6">
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Preview Data ({pblImportData.length} jadwal)
                        </h3>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          File: {pblImportFile?.name}
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
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Jam Selesai</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Modul PBL</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok Kecil</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Dosen</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Ruangan</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">PBL Tipe</th>
                                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Topik</th>
                              </tr>
                            </thead>
                            <tbody>
                              {pblImportPaginatedData.map((row, index) => {
                                const actualIndex = (pblImportPage - 1) * pblImportPageSize + index;
                                const modulPBL = modulPBLList?.find(m => m.id === row.modul_pbl_id);
                                const kelompokKecil = kelompokKecilList?.find(k => k.id === row.kelompok_kecil_id);
                                const dosen = allDosenList?.find(d => d.id === row.dosen_id);
                                const ruangan = allRuanganList?.find(r => r.id === row.ruangan_id);
                                
                                const renderEditableCell = (field: string, value: any, isNumeric = false) => {
                                  const isEditing = pblEditingCell?.row === actualIndex && pblEditingCell?.key === field;
                                  const cellError = pblCellErrors.find(err => err.row === actualIndex && err.field === field);
                                  
                                  return (
                                    <td
                                      className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                      onClick={() => setPBLEditingCell({ row: actualIndex, key: field })}
                                      title={cellError ? cellError.message : ''}
                                    >
                                      {isEditing ? (
                                        <input
                                          className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                          type={isNumeric ? "number" : "text"}
                                          value={value || ""}
                                          onChange={e => handlePBLCellEdit(actualIndex, field, e.target.value)}
                                          onBlur={() => setPBLEditingCell(null)}
                                          autoFocus
                                        />
                                      ) : (
                                        value || '-'
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
                                    {renderEditableCell('jam_selesai', row.jam_selesai)}
                                    
                                    {/* Modul PBL - Special handling */}
                                    {(() => {
                                      const field = 'modul_pbl_id';
                                      const isEditing = pblEditingCell?.row === actualIndex && pblEditingCell?.key === field;
                                      const cellError = pblCellErrors.find(err => err.row === actualIndex && err.field === field);
                                      
                                      return (
                                        <td
                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                          onClick={() => setPBLEditingCell({ row: actualIndex, key: field })}
                                          title={cellError ? cellError.message : ''}
                                        >
                                          {isEditing ? (
                                            <input
                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                              value={modulPBL?.nama_modul || ""}
                                              onChange={e => {
                                                const modul = modulPBLList?.find(m => m.nama_modul.toLowerCase().includes(e.target.value.toLowerCase()));
                                                handlePBLCellEdit(actualIndex, field, modul?.id?.toString() || '0');
                                              }}
                                              onBlur={() => setPBLEditingCell(null)}
                                              autoFocus
                                            />
                                          ) : (
                                            <span className={modulPBL ? 'text-gray-800 dark:text-white/90' : 'text-red-500'}>
                                              {modulPBL?.nama_modul || 'Tidak ditemukan'}
                                            </span>
                                          )}
                                        </td>
                                      );
                                    })()}
                                    
                                    {/* Kelompok Kecil - Special handling */}
                                    {(() => {
                                      const field = 'kelompok_kecil_id';
                                      const isEditing = pblEditingCell?.row === actualIndex && pblEditingCell?.key === field;
                                      const cellError = pblCellErrors.find(err => err.row === actualIndex && err.field === field);
                                      
                                      return (
                                        <td
                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                          onClick={() => setPBLEditingCell({ row: actualIndex, key: field })}
                                          title={cellError ? cellError.message : ''}
                                        >
                                          {isEditing ? (
                                            <input
                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                              value={kelompokKecil?.nama_kelompok || ""}
                                              onChange={e => handlePBLKelompokKecilEdit(actualIndex, e.target.value)}
                                              onBlur={() => setPBLEditingCell(null)}
                                              autoFocus
                                            />
                                          ) : (
                                            <span className={kelompokKecil ? 'text-gray-800 dark:text-white/90' : 'text-red-500'}>
                                              {kelompokKecil?.nama_kelompok || 'Tidak ditemukan'}
                                            </span>
                                          )}
                                        </td>
                                      );
                                    })()}
                                    
                                    {/* Dosen - Special handling */}
                                    {(() => {
                                      const field = 'dosen_id';
                                      const isEditing = pblEditingCell?.row === actualIndex && pblEditingCell?.key === field;
                                      const cellError = pblCellErrors.find(err => err.row === actualIndex && err.field === field);
                                      
                                      return (
                                        <td
                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                          onClick={() => setPBLEditingCell({ row: actualIndex, key: field })}
                                          title={cellError ? cellError.message : ''}
                                        >
                                          {isEditing ? (
                                            <input
                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                              value={dosen?.name || ""}
                                              onChange={e => handlePBLDosenEdit(actualIndex, e.target.value)}
                                              onBlur={() => setPBLEditingCell(null)}
                                              autoFocus
                                            />
                                          ) : (
                                            <span className={dosen ? 'text-gray-800 dark:text-white/90' : 'text-red-500'}>
                                              {dosen?.name || 'Tidak ditemukan'}
                                            </span>
                                          )}
                                        </td>
                                      );
                                    })()}
                                    
                                    {/* Ruangan - Special handling */}
                                    {(() => {
                                      const field = 'ruangan_id';
                                      const isEditing = pblEditingCell?.row === actualIndex && pblEditingCell?.key === field;
                                      const cellError = pblCellErrors.find(err => err.row === actualIndex && err.field === field);
                                      
                                      return (
                                        <td
                                          className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                                          onClick={() => setPBLEditingCell({ row: actualIndex, key: field })}
                                          title={cellError ? cellError.message : ''}
                                        >
                                          {isEditing ? (
                                            <input
                                              className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                              value={ruangan?.nama || ""}
                                              onChange={e => handlePBLRuanganEdit(actualIndex, e.target.value)}
                                              onBlur={() => setPBLEditingCell(null)}
                                              autoFocus
                                            />
                                          ) : (
                                            <span className={ruangan ? 'text-gray-800 dark:text-white/90' : 'text-red-500'}>
                                              {ruangan?.nama || 'Tidak ditemukan'}
                                            </span>
                                          )}
                                        </td>
                                      );
                                    })()}
                                    
                                    {renderEditableCell('pbl_tipe', row.pbl_tipe)}
                                    {renderEditableCell('topik', row.topik)}
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
                    {pblImportData.length > 0 && pblCellErrors.length === 0 && (
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
                            Import Data ({pblImportData.length} jadwal)
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
} 