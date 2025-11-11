import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState, useCallback } from 'react';
import api, { API_BASE_URL, handleApiError } from '../utils/api';
import { ChevronLeftIcon } from '../icons';
import { AnimatePresence, motion } from 'framer-motion';
import Select from 'react-select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrash, faStar, faCheckCircle } from '@fortawesome/free-solid-svg-icons';
import { getRuanganOptions } from '../utils/ruanganHelper';

// Constants
const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

interface MataKuliah {
  kode: string;
  nama: string;
  semester: number | string;
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
  dosen_ids: number[];
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
  kelompok_besar_antara_id: number | null;
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
  dosen_ids: number[];
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
  kelompok_kecil_antara_id: number;
  dosen_id: number;
  ruangan_id: number;
  file_jurnal?: string;
  [key: string]: any;
};



type ModulPBLType = { id: number; modul_ke: string; nama_modul: string; };
// KelompokKecilType tidak digunakan di semester antara, menggunakan kelompokKecilAntaraList
type DosenType = { id: number; name: string; nid?: string; };
type RuanganType = { id: number; nama: string; kapasitas?: number; gedung?: string; };
type JadwalPBLType = {
  id?: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  modul_pbl_id: number;
  kelompok_kecil_id?: number | null;
  kelompok_kecil_antara_id?: number | null;
  dosen_id?: number | null;
  dosen_ids?: number[];
  ruangan_id: number;
  dosen_names?: string;
  [key: string]: any;
};

// Semua data sudah diambil dari backend melalui batch API


export default function DetailBlokAntara() {
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

  const [ruanganList, setRuanganList] = useState<RuanganType[]>([]);
  const [allDosenList, setAllDosenList] = useState<DosenType[]>([]);
  const [allRuanganList, setAllRuanganList] = useState<RuanganType[]>([]);
  const [jadwalPBL, setJadwalPBL] = useState<JadwalPBLType[]>([]);

  

  const [isSaving, setIsSaving] = useState(false);
  const [modulPBLList, setModulPBLList] = useState<ModulPBLType[]>([]);
  // Gunakan kelompokKecilAntaraList untuk semester antara (sudah ada di bawah)
  const [loadingPBL, setLoadingPBL] = useState(true);
  const [loadingDosenRuangan, setLoadingDosenRuangan] = useState(true);

  // Tambahkan state untuk materi dan pengampu dinamis
  const [materiOptions, setMateriOptions] = useState<string[]>([]);
  const [pengampuOptions, setPengampuOptions] = useState<DosenType[]>([]);
  // Kelompok semester reguler tidak digunakan di semester antara
  const [jadwalKuliahBesar, setJadwalKuliahBesar] = useState<JadwalKuliahBesarType[]>([]);
  const [jadwalAgendaKhusus, setJadwalAgendaKhusus] = useState<JadwalAgendaKhususType[]>([]);
  const [jadwalPraktikum, setJadwalPraktikum] = useState<JadwalPraktikumType[]>([]);
  const [materiPraktikumOptions, setMateriPraktikumOptions] = useState<string[]>([]);
  const [kelasPraktikumOptions, setKelasPraktikumOptions] = useState<string[]>([]);
  const [pengampuPraktikumOptions, setPengampuPraktikumOptions] = useState<DosenType[]>([]);
  const [jadwalJurnalReading, setJadwalJurnalReading] = useState<JadwalJurnalReadingType[]>([]);
  const [jamOptions, setJamOptions] = useState<string[]>([]);
  
  // Pagination state for all schedule types
  const [kuliahBesarPage, setKuliahBesarPage] = useState(1);
  const [kuliahBesarPageSize, setKuliahBesarPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  
  const [praktikumPage, setPraktikumPage] = useState(1);
  const [praktikumPageSize, setPraktikumPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  
  const [agendaKhususPage, setAgendaKhususPage] = useState(1);
  const [agendaKhususPageSize, setAgendaKhususPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  
  const [pblPage, setPblPage] = useState(1);
  const [pblPageSize, setPblPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  
  const [jurnalReadingPage, setJurnalReadingPage] = useState(1);
  const [jurnalReadingPageSize, setJurnalReadingPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  
  // Pagination logic functions
  const getPaginatedData = (data: any[], page: number, pageSize: number): any[] => {
    const startIndex = (page - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return data.slice(startIndex, endIndex);
  };

  const getTotalPages = (dataLength: number, pageSize: number): number => {
    return Math.ceil(dataLength / pageSize);
  };

  const resetPagination = (scheduleType: 'kuliahBesar' | 'praktikum' | 'agendaKhusus' | 'pbl' | 'jurnalReading') => {
    switch (scheduleType) {
      case 'kuliahBesar':
        setKuliahBesarPage(1);
        break;
      case 'praktikum':
        setPraktikumPage(1);
        break;
      case 'agendaKhusus':
        setAgendaKhususPage(1);
        break;
      case 'pbl':
        setPblPage(1);
        break;
      case 'jurnalReading':
        setJurnalReadingPage(1);
        break;
    }
  };
  
  // State untuk loading assigned PBL - untuk semester antara menggunakan allDosenOptions
  const [loadingAssignedPBL, setLoadingAssignedPBL] = useState(false);

  // Untuk DetailBlokAntara, semester antara adalah default behavior (tidak perlu state)gim
  const [allDosenOptions, setAllDosenOptions] = useState<DosenType[]>([]);
  const [kelompokBesarAntaraOptions, setKelompokBesarAntaraOptions] = useState<{id: number, label: string, jumlah_mahasiswa: number, mahasiswa: any[]}[]>([]);
  const [showKelompokBesarAntaraModal, setShowKelompokBesarAntaraModal] = useState(false);
  const [selectedMahasiswa, setSelectedMahasiswa] = useState<{id: number, name: string, email: string, ipk?: number}[]>([]);
  const [allMahasiswaOptions, setAllMahasiswaOptions] = useState<{id: number, name: string, email: string, ipk?: number}[]>([]);
  const [isLoadingMahasiswa, setIsLoadingMahasiswa] = useState(false);
  const [isLoadingKelompok, setIsLoadingKelompok] = useState(false);
  const [isCreatingKelompok, setIsCreatingKelompok] = useState(false);
  const [searchMahasiswa, setSearchMahasiswa] = useState('');
  const [filterIPK, setFilterIPK] = useState('semua');
  const [kelompokBesarAntaraForm, setKelompokBesarAntaraForm] = useState({
    nama_kelompok: '',
    mahasiswa_ids: [] as number[]
  });

  // State untuk modal kelompok kecil semester antara
  // const [showKelompokKecilAntaraModal, setShowKelompokKecilAntaraModal] = useState(false);
  const [kelompokKecilAntaraList, setKelompokKecilAntaraList] = useState<{id: number, nama_kelompok: string, jumlah_anggota: number, mahasiswa_ids: number[]}[]>([]);
  const [kelompokKecilAntaraForm, setKelompokKecilAntaraForm] = useState({
    nama_kelompok: '',
    mahasiswa_ids: [] as number[]
  });
  const [isLoadingKelompokKecilAntara, setIsLoadingKelompokKecilAntara] = useState(false);
  const [isCreatingKelompokKecilAntara, setIsCreatingKelompokKecilAntara] = useState(false);
  
  // State untuk search di tab Kelompok Kecil
  const [searchMahasiswaKelompokKecil, setSearchMahasiswaKelompokKecil] = useState('');
  const [filterIPKKelompokKecil, setFilterIPKKelompokKecil] = useState('semua');
  
  // State untuk tab modal kelompok
  const [activeTab, setActiveTab] = useState<'besar' | 'kecil'>('besar');

  // State untuk bulk delete
  const [selectedKuliahBesarItems, setSelectedKuliahBesarItems] = useState<number[]>([]);
  const [selectedPraktikumItems, setSelectedPraktikumItems] = useState<number[]>([]);
  const [selectedAgendaKhususItems, setSelectedAgendaKhususItems] = useState<number[]>([]);
  const [selectedPBLItems, setSelectedPBLItems] = useState<number[]>([]);
  const [selectedJurnalReadingItems, setSelectedJurnalReadingItems] = useState<number[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [bulkDeleteType, setBulkDeleteType] = useState<'kuliah-besar' | 'praktikum' | 'agenda-khusus' | 'pbl' | 'jurnal-reading'>('kuliah-besar');
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // Hooks untuk PBL dosen options


  // Effect untuk fetch data berdasarkan tab yang aktif
  useEffect(() => {
    if (showKelompokBesarAntaraModal) {
      if (activeTab === 'besar') {
        fetchKelompokBesarAntaraOptions();
      } else if (activeTab === 'kecil') {
        fetchKelompokKecilAntara();
        // Juga fetch kelompok besar untuk ditampilkan di form pembuatan kelompok kecil
        fetchKelompokBesarAntaraOptions();
      }
    }
  }, [showKelompokBesarAntaraModal, activeTab]);

  // Fetch data for Semester Antara
  useEffect(() => {
    if (data) {
      // DetailBlokAntara always handles semester antara
      fetchAllDosenOptions();
      fetchKelompokBesarAntaraOptions();
      fetchAllMahasiswaOptions();
      fetchKelompokKecilAntara();
    }
  }, [data]);

  // Fetch all dosen for Semester Antara
  const fetchAllDosenOptions = async () => {
    try {
      const res = await api.get('/kuliah-besar/all-dosen');
      setAllDosenOptions(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      // Error handling is done by handleApiError
    }
  };

  // Fetch kelompok besar antara for Semester Antara
  const fetchKelompokBesarAntaraOptions = async () => {
    if (!data) return;
    setIsLoadingKelompok(true);
    try {
      const res = await api.get(`/kelompok-besar-antara`);
      setKelompokBesarAntaraOptions(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      // Error handling is done by handleApiError
    } finally {
      setIsLoadingKelompok(false);
    }
  };

  // Fetch all mahasiswa for selection
  const fetchAllMahasiswaOptions = async () => {
    setIsLoadingMahasiswa(true);
    try {
      const res = await api.get('/kelompok-besar-antara/mahasiswa');
      setAllMahasiswaOptions(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      // Error handling is done by handleApiError
    } finally {
      setIsLoadingMahasiswa(false);
    }
  };

  // Create kelompok besar antara
  const createKelompokBesarAntara = async () => {
    if (!data || !kelompokBesarAntaraForm.nama_kelompok || kelompokBesarAntaraForm.mahasiswa_ids.length === 0) {
      return;
    }

    setIsCreatingKelompok(true);
    try {
      await api.post(`/kelompok-besar-antara`, kelompokBesarAntaraForm);
      // Reset form but don't close modal
      setKelompokBesarAntaraForm({ nama_kelompok: '', mahasiswa_ids: [] });
      setSelectedMahasiswa([]);
      fetchKelompokBesarAntaraOptions();
      // Show success message
      alert('Kelompok besar berhasil dibuat!');
    } catch (error: any) {
      alert(handleApiError(error, 'Membuat kelompok besar'));
    } finally {
      setIsCreatingKelompok(false);
    }
  };

  // Calculate total students already grouped
  const getTotalGroupedStudents = () => {
    return kelompokBesarAntaraOptions.reduce((total, group) => total + group.mahasiswa.length, 0);
  };

  // Filter mahasiswa based on search and IPK filter
  const getFilteredMahasiswa = () => {
    let filtered = allMahasiswaOptions;

    // Filter by search term
    if (searchMahasiswa) {
      filtered = filtered.filter(mahasiswa => 
        mahasiswa.name.toLowerCase().includes(searchMahasiswa.toLowerCase()) ||
        mahasiswa.email.toLowerCase().includes(searchMahasiswa.toLowerCase())
      );
    }

    // Filter by IPK
    if (filterIPK !== 'semua') {
      // const ipkValue = parseFloat(filterIPK);
      filtered = filtered.filter(mahasiswa => {
        const mahasiswaIPK = mahasiswa.ipk || 0;
        switch (filterIPK) {
          case '3.5+':
            return mahasiswaIPK >= 3.5;
          case '3.0-3.49':
            return mahasiswaIPK >= 3.0 && mahasiswaIPK < 3.5;
          case '2.5-2.99':
            return mahasiswaIPK >= 2.5 && mahasiswaIPK < 3.0;
          case '<2.5':
            return mahasiswaIPK < 2.5;
          default:
            return true;
        }
      });
    }

    return filtered;
  };



  // Delete kelompok besar antara
  const deleteKelompokBesarAntara = async (id: number) => {
    if (!data) return;

    if (confirm('Apakah Anda yakin ingin menghapus kelompok besar ini?')) {
      try {
        await api.delete(`/kelompok-besar-antara/${id}`);
        fetchKelompokBesarAntaraOptions();
      } catch (error: any) {
        alert(handleApiError(error, 'Menghapus kelompok besar'));
      }
    }
  };

  // Fetch kelompok kecil semester antara
  const fetchKelompokKecilAntara = async () => {
    if (!data) return;
    setIsLoadingKelompokKecilAntara(true);
    try {
      const res = await api.get(`/kelompok-kecil-antara`);
      setKelompokKecilAntaraList(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      // Error handling is done by handleApiError
    } finally {
      setIsLoadingKelompokKecilAntara(false);
    }
  };

  // Create kelompok kecil semester antara
  const createKelompokKecilAntara = async () => {
    if (!data || !kelompokKecilAntaraForm.nama_kelompok || kelompokKecilAntaraForm.mahasiswa_ids.length === 0) {
      return;
    }

    setIsCreatingKelompokKecilAntara(true);
    try {
      await api.post(`/kelompok-kecil-antara`, kelompokKecilAntaraForm);
      // Reset form but don't close modal
      setKelompokKecilAntaraForm({ nama_kelompok: '', mahasiswa_ids: [] });
      setSelectedMahasiswa([]);
      fetchKelompokKecilAntara();
      // Show success message
      alert('Kelompok kecil berhasil dibuat!');
    } catch (error: any) {
      alert(handleApiError(error, 'Membuat kelompok kecil'));
    } finally {
      setIsCreatingKelompokKecilAntara(false);
    }
  };

  // Delete kelompok kecil semester antara
  const deleteKelompokKecilAntara = async (id: number) => {
    if (!data) return;

    if (confirm('Apakah Anda yakin ingin menghapus kelompok kecil ini?')) {
      try {
        await api.delete(`/kelompok-kecil-antara/${id}`);
        fetchKelompokKecilAntara();
      } catch (error: any) {
        alert(handleApiError(error, 'Menghapus kelompok kecil'));
      }
    }
  };

  // Fetch materi (keahlian) dinamis saat modal kuliah besar dibuka
  const fetchMateriOptions = async () => {
    if (!data) return;
    try {
      const res = await api.get(`/kuliah-besar/materi?blok=${data.blok}&semester=${data.semester}`);
      setMateriOptions(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      // Silent fail - materi options are not critical
    }
  };

  // Fetch pengampu dinamis setelah materi dipilih
  const fetchPengampuOptions = async (materi: string) => {
    if (!data || !materi) return;
    try {
      const res = await api.get(`/kuliah-besar/pengampu?keahlian=${encodeURIComponent(materi)}&blok=${data.blok}&semester=${data.semester}`);
      setPengampuOptions(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      // Silent fail - pengampu options are not critical
    }
  };

  // Semester antara tidak menggunakan kelompok semester reguler



  // Fetch materi praktikum dinamis
  const fetchMateriPraktikum = async () => {
    if (!data) return;
    try {
      const res = await api.get(`/praktikum/materi/${data.blok}/${data.semester}`);
      setMateriPraktikumOptions(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      // Silent fail - materi praktikum options are not critical
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

  // Fetch pengampu praktikum berdasarkan materi
  const fetchPengampuPraktikum = async (materi: string) => {
    if (!data || !materi) return;
    try {
      const res = await api.get(`/praktikum/pengampu/${encodeURIComponent(materi)}/${data.blok}/${data.semester}`);
      setPengampuPraktikumOptions(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      // Silent fail - pengampu praktikum options are not critical
    }
  };

  // Saat modal dibuka, fetch materi sesuai jenis baris
  useEffect(() => {
    if (showModal) {
      if (form.jenisBaris === 'materi') {
        fetchMateriOptions();
        // fetchKelompokBesarOptions(); // Not used in semester antara
        // Reset pengampu options jika materi belum dipilih
        if (!form.materi) {
          setPengampuOptions([]);
        }
      } else if (form.jenisBaris === 'praktikum') {
        fetchMateriPraktikum();
        fetchKelasPraktikum();
        // Reset pengampu options jika materi belum dipilih
        if (!form.materi) {
          setPengampuPraktikumOptions([]);
        }
      } else if (form.jenisBaris === 'agenda') {
        // fetchKelompokBesarAgendaOptions(); // Not used in semester antara
      }
    }
  }, [showModal, form.jenisBaris]);

  // Saat materi dipilih, fetch pengampu
  useEffect(() => {
    if (form.jenisBaris === 'materi' && form.materi) {
      fetchPengampuOptions(form.materi);
    } else {
      setPengampuOptions([]);
    }
  }, [form.jenisBaris, form.materi]);



  // Saat materi praktikum dipilih, fetch pengampu
  useEffect(() => {
    if (form.jenisBaris === 'praktikum' && form.materi) {
      fetchPengampuPraktikum(form.materi);
    } else {
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
    // Reset materi ketika jenis baris berubah
    if (form.materi) {
      setForm(f => ({ ...f, materi: '', pengampu: form.jenisBaris === 'praktikum' ? [] : null }));
    }
  }, [form.jenisBaris]);


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
    return `${jamAkhir}.${menitAkhir}`;
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
          const sameGroup = j.nama_kelompok === form.kelompok || j.kelompok_kecil_antara?.nama_kelompok === form.kelompok;
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
        pengampu: row.dosen_ids && row.dosen_ids.length > 0 ? row.dosen_ids : (row.dosen_id ? [row.dosen_id] : []),
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
        pengampu: row.dosen_ids && row.dosen_ids.length > 0 ? row.dosen_ids : (row.dosen_id ? [row.dosen_id] : []),
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
      // Cari nama kelompok dari transform backend atau relasi
              const namaKelompok = row.nama_kelompok || row.kelompok_kecil_antara?.nama_kelompok || '';
      
      setForm({
        hariTanggal: row.tanggal, // Gunakan tanggal langsung dari backend
        jamMulai: String(row.jam_mulai || ''),
        jumlahKali: Number(row.jumlah_sesi || 2),
        jamSelesai: String(row.jam_selesai || ''),
        pengampu: row.dosen_ids && row.dosen_ids.length > 0 ? row.dosen_ids : (row.dosen_id ? [row.dosen_id] : []),
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
        pengampu: row.dosen_ids && row.dosen_ids.length > 0 ? row.dosen_ids : (row.dosen_id ? [row.dosen_id] : []),
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
        pengampu: [],
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
        !form.pengampu ||
        (Array.isArray(form.pengampu) && form.pengampu.length === 0) ||
        form.lokasi == null
      ) {
        setErrorForm('Semua field wajib diisi!');
        throw new Error('Semua field wajib diisi!');
      }
      // Ambil id kelompok kecil dari list semester antara
      const kelompokObj = kelompokKecilAntaraList.find(k => k.nama_kelompok === form.kelompok);
      const kelompok_kecil_antara_id = kelompokObj ? kelompokObj.id : null;
      if (!kelompok_kecil_antara_id) {
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
        kelompok_kecil_id: null, // Set null untuk semester antara
        kelompok_kecil_antara_id, // Gunakan kelompok_kecil_antara_id untuk semester antara
        dosen_id: null, // Set null untuk multiple dosen
        dosen_ids: Array.isArray(form.pengampu) ? form.pengampu : (form.pengampu ? [form.pengampu] : []),
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
        form.lokasi == null
      ) {
        setErrorForm('Semua field wajib diisi!');
        throw new Error('Semua field wajib diisi!');
      }

      // Validasi khusus untuk Semester Antara
      // Untuk Semester Antara, hanya pengampu yang wajib (materi dan topik tidak wajib)
      if (!form.pengampu || (Array.isArray(form.pengampu) && form.pengampu.length === 0)) {
        setErrorForm('Pengampu wajib dipilih!');
        throw new Error('Pengampu wajib dipilih!');
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
    setErrorBackend('');
    
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
      // setKelompokKecilList(Array.isArray(batchData.kelompok_kecil) ? batchData.kelompok_kecil : []); // Use kelompokKecilAntaraList instead
      setAllRuanganList(Array.isArray(batchData.ruangan) ? batchData.ruangan : []);
      setRuanganList(Array.isArray(batchData.ruangan) ? batchData.ruangan : []);
      setKelasPraktikumOptions(Array.isArray(batchData.kelas_praktikum) ? batchData.kelas_praktikum.map((k: any) => k.nama || k) : []);
      setMateriPraktikumOptions(Array.isArray(batchData.materi_praktikum) ? batchData.materi_praktikum : []);
      setJamOptions(Array.isArray(batchData.jam_options) ? batchData.jam_options : []);
      
      // Set dosen data
      if (batchData.dosen) {
        setAllDosenList(Array.isArray(batchData.dosen.all) ? batchData.dosen.all : []);
        // dosenList removed for semester antara
      }
      
    } catch (err) {
      setErrorBackend('Gagal mengambil data batch');
      setError('Gagal mengambil data batch'); // Set main error state
      // Error handling is done by handleApiError
      setLoading(false); // Reset loading state on error
    } finally {
      setLoadingPBL(false);
      setLoadingDosenRuangan(false);
      setLoading(false); // Reset main loading state
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
      // No assigned dosen setup needed for semester antara
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
        
        // For semester antara, no need to track assigned dosen separately
        // Use allDosenOptions instead
      }
    } catch (err) {
      // No assigned dosen setup needed for semester antara
    } finally {
      setLoadingAssignedPBL(false);
    }
  }, [kode, modulPBLList]);

  // Fetch semua dosen untuk PBL
  const fetchAllDosenPBL = useCallback(async () => {
    if (!kode) return;
    
    // For semester antara, use allDosenOptions instead of separate PBL dosen options
    // No additional loading needed
  }, [kode]);

  // Fetch semua dosen ketika modal PBL dibuka
  useEffect(() => {
    if (showModal && form.jenisBaris === 'pbl') {
      fetchAllDosenPBL();
    }
  }, [showModal, form.jenisBaris, fetchAllDosenPBL]);

  useEffect(() => {
    fetchBatchData();
  }, [fetchBatchData]);

  useEffect(() => {
    fetchAssignedDosenPBL();
  }, [fetchAssignedDosenPBL]);

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
    setErrorBackend('');
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
    setErrorBackend('');
          // Reset error state

    
    // Tambahkan jumlah_sesi berdasarkan pbl_tipe
    const updatedFormPBL = {
      ...formPBL,
      jumlah_sesi: formPBL.pbl_tipe === 'PBL 2' ? 3 : 2
    };
    
    try {
      await api.put(`/mata-kuliah/${kode}/jadwal-pbl/${id}`, updatedFormPBL);
      await fetchBatchData();
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
      setErrorBackend('Data jadwal tidak valid!');
      return;
    }
    setIsSaving(true);
    try {
      await api.delete(`/mata-kuliah/${kode}/jadwal-pbl/${jadwal.id}`);
      // Setelah sukses hapus di backend, refresh data dari backend
      await fetchBatchData();
    } catch (err) {
      setErrorBackend('Gagal menghapus jadwal PBL');
    }
    setIsSaving(false);
  }

  // Untuk semester antara, gunakan kelompok kecil antara
  const uniqueKelompok = kelompokKecilAntaraList.map(k => ({
    value: k.nama_kelompok,
    label: `${k.nama_kelompok} (${k.jumlah_anggota} mahasiswa)`,
  }));

  // Validasi bentrok frontend untuk kuliah besar

  // Handler tambah jadwal kuliah besar
  async function handleTambahJadwalKuliahBesar() {
    setErrorForm('');
    setErrorBackend('');
    
    // Validasi field wajib
    if (!form.hariTanggal || !form.jamMulai || !form.jamSelesai || !form.lokasi) {
      setErrorForm('Semua field wajib diisi!');
      return;
    }

    // Validasi untuk Semester Antara - hanya pengampu yang wajib
    if (!form.pengampu || (Array.isArray(form.pengampu) && form.pengampu.length === 0)) {
      setErrorForm('Pengampu wajib dipilih!');
      return;
    }

    // Siapkan payload berdasarkan semester
    let payload: any = {
      tanggal: form.hariTanggal,
      jam_mulai: form.jamMulai,
      jam_selesai: form.jamSelesai,
      ruangan_id: Number(form.lokasi),
      jumlah_sesi: form.jumlahKali,
    };

    // Payload untuk Semester Antara
    payload = {
      ...payload,
      topik: form.topik || '',
      dosen_ids: Array.isArray(form.pengampu) ? form.pengampu : (form.pengampu ? [form.pengampu] : []),
      kelompok_besar_antara_id: form.kelompokBesar,
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
    
    // Set form untuk semester antara
    setForm({
      hariTanggal: row.tanggal,
      jamMulai: row.jam_mulai,
      jumlahKali: row.jumlah_sesi || 2,
      jamSelesai: row.jam_selesai,
      pengampu: row.dosen_ids, // Semester antara selalu gunakan dosen_ids
      materi: row.materi,
      topik: row.topik || '',
      lokasi: row.ruangan_id,
      jenisBaris: 'materi',
      agenda: '',
      kelasPraktikum: '',
      pblTipe: '',
      modul: null,
      kelompok: '',
      kelompokBesar: row.kelompok_besar_antara_id, // Semester antara selalu gunakan kelompok_besar_antara_id
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
    let payload: any = {
      tanggal: form.hariTanggal,
      jam_mulai: form.jamMulai,
      jam_selesai: form.jamSelesai,
      agenda: form.agenda,
      ruangan_id: form.useRuangan ? Number(form.lokasi) : null,
      use_ruangan: form.useRuangan,
      jumlah_sesi: form.jumlahKali,
    };

    // Tambahkan kelompok besar antara untuk semester antara
    payload.kelompok_besar_antara_id = form.kelompokBesar;

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
    
    // Set form untuk semester antara
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
      kelompokBesar: row.kelompok_besar_antara_id, // Semester antara selalu gunakan kelompok_besar_antara_id
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
      dosen_ids: Array.isArray(form.pengampu) ? form.pengampu : (form.pengampu ? [form.pengampu] : []),
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
    if (!form.hariTanggal || !form.jamMulai || !form.jamSelesai || !form.topik || !form.kelompok || !form.pengampu || (Array.isArray(form.pengampu) && form.pengampu.length === 0) || !form.lokasi) {
      setErrorForm('Semua field wajib diisi!');
      throw new Error('Semua field wajib diisi!');
    }
    
    // Validasi kelompok_kecil_antara_id dari semester antara
    const kelompokKecilAntaraId = kelompokKecilAntaraList.find(k => k.nama_kelompok === form.kelompok)?.id;
    if (!kelompokKecilAntaraId) {
      setErrorForm('Kelompok tidak ditemukan!');
      throw new Error('Kelompok tidak ditemukan!');
    }
    
    // Validasi bentrok frontend
    const payload = {
      tanggal: form.hariTanggal,
      jam_mulai: form.jamMulai,
      jam_selesai: form.jamSelesai,
      jumlah_sesi: form.jumlahKali,
      kelompok_kecil_id: null, // Set null untuk semester antara
      kelompok_kecil_antara_id: kelompokKecilAntaraId, // Gunakan kelompok_kecil_antara_id untuk semester antara
      dosen_id: null, // Set null untuk multiple dosen
      dosen_ids: Array.isArray(form.pengampu) ? form.pengampu : (form.pengampu ? [form.pengampu] : []),
      ruangan_id: Number(form.lokasi),
      topik: form.topik,
    };
    

    
    try {
      const formData = new FormData();
      formData.append('tanggal', payload.tanggal);
      formData.append('jam_mulai', payload.jam_mulai);
      formData.append('jam_selesai', payload.jam_selesai);
      formData.append('jumlah_sesi', payload.jumlah_sesi.toString());
      formData.append('kelompok_kecil_id', '');
      formData.append('kelompok_kecil_antara_id', payload.kelompok_kecil_antara_id.toString());
      formData.append('dosen_id', '');
      formData.append('dosen_ids', JSON.stringify(payload.dosen_ids));
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
          editFormData.append('kelompok_kecil_id', '');
          editFormData.append('kelompok_kecil_antara_id', payload.kelompok_kecil_antara_id.toString());
          editFormData.append('dosen_id', '');
          editFormData.append('dosen_ids', JSON.stringify(payload.dosen_ids));
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
            kelompok_kecil_id: null,
            kelompok_kecil_antara_id: payload.kelompok_kecil_antara_id,
            dosen_id: null,
            dosen_ids: payload.dosen_ids,
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
      pengampu: row.dosen_ids && row.dosen_ids.length > 0 ? row.dosen_ids : (row.dosen_id ? row.dosen_id : null),
      materi: '',
      topik: row.topik || '',
      lokasi: row.ruangan_id || null,
      jenisBaris: 'jurnal',
      agenda: '',
      kelasPraktikum: '',
      pblTipe: '',
      modul: null,
                kelompok: row.kelompok_kecil_antara?.nama_kelompok || '',
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
    if (!data?.kode) return;
    
    setIsBulkDeleting(true);
    
    try {
      let selectedItems: number[] = [];
      let endpoint = '';
      let successMessage = '';
      
      switch (bulkDeleteType) {
        case 'kuliah-besar':
          selectedItems = selectedKuliahBesarItems;
          endpoint = `/kuliah-besar/jadwal/${data.kode}`;
          successMessage = `${selectedItems.length} jadwal kuliah besar berhasil dihapus.`;
          break;
        case 'praktikum':
          selectedItems = selectedPraktikumItems;
          endpoint = `/praktikum/jadwal/${data.kode}`;
          successMessage = `${selectedItems.length} jadwal praktikum berhasil dihapus.`;
          break;
        case 'agenda-khusus':
          selectedItems = selectedAgendaKhususItems;
          endpoint = `/agenda-khusus/jadwal/${data.kode}`;
          successMessage = `${selectedItems.length} jadwal agenda khusus berhasil dihapus.`;
          break;
        case 'pbl':
          selectedItems = selectedPBLItems;
          endpoint = `/mata-kuliah/${data.kode}/jadwal-pbl`;
          successMessage = `${selectedItems.length} jadwal PBL berhasil dihapus.`;
          break;
        case 'jurnal-reading':
          selectedItems = selectedJurnalReadingItems;
          endpoint = `/jurnal-reading/jadwal/${data.kode}`;
          successMessage = `${selectedItems.length} jadwal jurnal reading berhasil dihapus.`;
          break;
      }
      
      // Delete all selected items
      await Promise.all(selectedItems.map(id => api.delete(`${endpoint}/${id}`)));
      
      // Show success message first
      setSuccessMessage(successMessage);
      setTimeout(() => setSuccessMessage(''), 3000);
      
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
      
      // Refresh data after setting success message
      await fetchBatchData();
      
    } catch (error) {
      setErrorBackend('Gagal menghapus jadwal yang dipilih');
    } finally {
      setIsBulkDeleting(false);
    }
  };

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

      {/* Section Jadwal Materi dipisah menjadi 3 bagian berdasarkan jenisBaris */}
      {/* Section Kuliah Besar */}
      <div className="mb-8">
        {/* Peringatan dan tombol Kelola Kelompok untuk Semester Antara */}
        {true && (
          <div className="mb-4 p-5 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                    Kelompokkan Mahasiswa Terlebih Dahulu
                  </h3>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    Untuk semester antara, silakan kelompokkan mahasiswa terlebih dahulu sebelum menambah jadwal
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowKelompokBesarAntaraModal(true)}
                className="px-4 py-2 rounded-lg bg-purple-500 text-white text-sm font-medium hover:bg-purple-600 transition flex items-center space-x-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                </svg>
                <span>Kelola Kelompok</span>
              </button>
            </div>
          </div>
        )}
        
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Kuliah Besar</h2>
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

        {/* Success Message untuk Kuliah Besar */}
        <AnimatePresence>
          {successMessage && bulkDeleteType === 'kuliah-besar' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {successMessage}
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
                    getPaginatedData(jadwalKuliahBesar, kuliahBesarPage, kuliahBesarPageSize).map((row, i) => {
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
                        <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{(kuliahBesarPage - 1) * kuliahBesarPageSize + i + 1}</td>
                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                          {row.tanggal ? formatTanggalKonsisten(row.tanggal) : ''}
                        </td>
                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatJamTanpaDetik(row.jam_mulai)}–{formatJamTanpaDetik(row.jam_selesai)}</td>
                          <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi || 1} x 50 menit</td>
                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                          {row.topik || '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                          {row.dosen_ids ? (
                            // Tampilkan multiple dosen untuk Semester Antara
                            allDosenOptions
                              .filter(d => row.dosen_ids.includes(d.id))
                              .map(d => d.name)
                              .join(', ')
                          ) : (
                            // Fallback
                            dosen?.name || `Dosen ${row.dosen_id}`
                          )}
                        </td>
                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                          {row.kelompok_besar_antara_id ? 
                            kelompokBesarAntaraOptions.find(k => k.id === row.kelompok_besar_antara_id)?.label || 
                            `Kelompok Besar Antara ${row.kelompok_besar_antara_id}` : '-'}
                        </td>
                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.topik || row.materi}</td>
                          <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{ruangan?.nama || `Ruangan ${row.ruangan_id}`}</td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <div className="flex items-center justify-center gap-1 flex-wrap">
                            {/* Tombol Absensi - tampilkan jika ada dosen yang terdaftar */}
                            {row.dosen_ids && row.dosen_ids.length > 0 && (
                              <button
                                onClick={() => navigate(`/absensi-kuliah-besar-antara/${kode}/${row.id}`)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-500 hover:text-green-700 dark:hover:text-green-300 transition mr-1"
                                title="Buka Absensi"
                              >
                                <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                                <span className="hidden sm:inline">Absensi</span>
                              </button>
                            )}
                            <button onClick={() => handleEditJadwalKuliahBesar(i)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition mr-1" title="Edit Jadwal">
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
                          </div>
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

        {/* Pagination for Kuliah Besar */}
        {true && (
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan {((kuliahBesarPage - 1) * kuliahBesarPageSize) + 1} - {Math.min(kuliahBesarPage * kuliahBesarPageSize, jadwalKuliahBesar.length)} dari {jadwalKuliahBesar.length} data
              </span>
              
              <select
                value={kuliahBesarPageSize}
                onChange={(e) => {
                  setKuliahBesarPageSize(Number(e.target.value));
                  setKuliahBesarPage(1);
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
                onClick={() => setKuliahBesarPage((p) => Math.max(1, p - 1))}
                disabled={kuliahBesarPage === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Previous
              </button>

              {/* Always show first page if it's not the current page */}
              {getTotalPages(jadwalKuliahBesar.length, kuliahBesarPageSize) > 1 && (
                <button
                  onClick={() => setKuliahBesarPage(1)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    kuliahBesarPage === 1
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  1
                </button>
              )}

              {/* Show pages around current page */}
              {Array.from({ length: getTotalPages(jadwalKuliahBesar.length, kuliahBesarPageSize) }, (_, i) => {
                const pageNum = i + 1;
                // Show pages around current page (2 pages before and after)
                const shouldShow =
                  pageNum > 1 &&
                  pageNum < getTotalPages(jadwalKuliahBesar.length, kuliahBesarPageSize) &&
                  pageNum >= kuliahBesarPage - 2 &&
                  pageNum <= kuliahBesarPage + 2;

                if (!shouldShow) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setKuliahBesarPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                      kuliahBesarPage === pageNum
                        ? "bg-brand-500 text-white"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Show ellipsis if current page is far from end */}
              {kuliahBesarPage < getTotalPages(jadwalKuliahBesar.length, kuliahBesarPageSize) - 3 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">
                  ...
                </span>
              )}

              {/* Always show last page if it's not the first page */}
              {getTotalPages(jadwalKuliahBesar.length, kuliahBesarPageSize) > 1 && (
                <button
                  onClick={() => setKuliahBesarPage(getTotalPages(jadwalKuliahBesar.length, kuliahBesarPageSize))}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    kuliahBesarPage === getTotalPages(jadwalKuliahBesar.length, kuliahBesarPageSize)
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {getTotalPages(jadwalKuliahBesar.length, kuliahBesarPageSize)}
                </button>
              )}

              <button
                onClick={() => setKuliahBesarPage((p) => Math.min(getTotalPages(jadwalKuliahBesar.length, kuliahBesarPageSize), p + 1))}
                disabled={kuliahBesarPage === getTotalPages(jadwalKuliahBesar.length, kuliahBesarPageSize)}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
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
                      <div className="flex items-center justify-center gap-1 flex-wrap">
                        {/* Tombol Absensi - tampilkan jika ada dosen yang terdaftar */}
                        {row.dosen && row.dosen.length > 0 && (
                          <button
                            onClick={() => navigate(`/absensi-praktikum-antara/${kode}/${row.id}`)}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-500 hover:text-green-700 dark:hover:text-green-300 transition mr-1"
                            title="Buka Absensi"
                          >
                            <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" />
                            <span className="hidden sm:inline">Absensi</span>
                          </button>
                        )}
                        <button onClick={() => handleEditJadwalPraktikum(i)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition mr-1" title="Edit Jadwal">
                          <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button onClick={() => handleDeleteJadwalPraktikum(i)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" title="Hapus Jadwal">
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
              // fetchKelompokBesarAgendaOptions(); // Not used in semester antara
            }}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"
          >
            Tambah Jadwal
          </button>
        </div>

        {/* Success Message untuk Agenda Khusus */}
        <AnimatePresence>
          {successMessage && bulkDeleteType === 'agenda-khusus' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {successMessage}
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
                  getPaginatedData(jadwalAgendaKhusus, agendaKhususPage, agendaKhususPageSize).map((row: any, i: number) => (
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
                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{(agendaKhususPage - 1) * agendaKhususPageSize + i + 1}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {formatTanggalKonsisten(row.tanggal)}
                      </td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatJamTanpaDetik(row.jam_mulai)}–{formatJamTanpaDetik(row.jam_selesai)}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi || 1} x 50 menit</td>
                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.agenda}</td>
                    <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                      {row.kelompok_besar_antara_id ? 
                        kelompokBesarAntaraOptions.find(k => k.id === row.kelompok_besar_antara_id)?.label || 
                        `Kelompok Besar Antara ${row.kelompok_besar_antara_id}` : '-'}
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

        {/* Pagination for Agenda Khusus */}
        {true && (
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan {((agendaKhususPage - 1) * agendaKhususPageSize) + 1} - {Math.min(agendaKhususPage * agendaKhususPageSize, jadwalAgendaKhusus.length)} dari {jadwalAgendaKhusus.length} data
              </span>
              
              <select
                value={agendaKhususPageSize}
                onChange={(e) => {
                  setAgendaKhususPageSize(Number(e.target.value));
                  setAgendaKhususPage(1);
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
                onClick={() => setAgendaKhususPage((p) => Math.max(1, p - 1))}
                disabled={agendaKhususPage === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Previous
              </button>

              {/* Always show first page if it's not the current page */}
              {getTotalPages(jadwalAgendaKhusus.length, agendaKhususPageSize) > 1 && (
                <button
                  onClick={() => setAgendaKhususPage(1)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    agendaKhususPage === 1
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  1
                </button>
              )}

              {/* Show pages around current page */}
              {Array.from({ length: getTotalPages(jadwalAgendaKhusus.length, agendaKhususPageSize) }, (_, i) => {
                const pageNum = i + 1;
                // Show pages around current page (2 pages before and after)
                const shouldShow =
                  pageNum > 1 &&
                  pageNum < getTotalPages(jadwalAgendaKhusus.length, agendaKhususPageSize) &&
                  pageNum >= agendaKhususPage - 2 &&
                  pageNum <= agendaKhususPage + 2;

                if (!shouldShow) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setAgendaKhususPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                      agendaKhususPage === pageNum
                        ? "bg-brand-500 text-white"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Show ellipsis if current page is far from end */}
              {agendaKhususPage < getTotalPages(jadwalAgendaKhusus.length, agendaKhususPageSize) - 3 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">
                  ...
                </span>
              )}

              {/* Always show last page if it's not the first page */}
              {getTotalPages(jadwalAgendaKhusus.length, agendaKhususPageSize) > 1 && (
                <button
                  onClick={() => setAgendaKhususPage(getTotalPages(jadwalAgendaKhusus.length, agendaKhususPageSize))}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    agendaKhususPage === getTotalPages(jadwalAgendaKhusus.length, agendaKhususPageSize)
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {getTotalPages(jadwalAgendaKhusus.length, agendaKhususPageSize)}
                </button>
              )}

              <button
                onClick={() => setAgendaKhususPage((p) => Math.min(getTotalPages(jadwalAgendaKhusus.length, agendaKhususPageSize), p + 1))}
                disabled={agendaKhususPage === getTotalPages(jadwalAgendaKhusus.length, agendaKhususPageSize)}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
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
                      {false && (
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
                      )}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Pengampu ({allDosenOptions.length} dosen tersedia)
                        </label>
                        {true ? (
                          <>
                          {/* Multiple select untuk Semester Antara */}
                          <Select
                            isMulti
                            options={allDosenOptions.map(d => ({ value: d.id, label: d.name }))}
                            isSearchable={true}
                            filterOption={(option, inputValue) => {
                              const label = option.label.toLowerCase();
                              const input = inputValue.toLowerCase();
                              return label.includes(input);
                            }}
                            noOptionsMessage={() => "Tidak ada dosen yang ditemukan"}
                            loadingMessage={() => "Mencari dosen..."}
                            value={Array.isArray(form.pengampu) 
                              ? form.pengampu.map(id => allDosenOptions.find(d => d.id === id)).filter(Boolean).map(d => ({ value: d!.id, label: d!.name }))
                              : form.pengampu 
                                ? [{ value: form.pengampu, label: allDosenOptions.find(d => d.id === form.pengampu)?.name || `Dosen ${form.pengampu}` }]
                                : []
                            }
                            onChange={opts => {
                              const values = opts ? opts.map(opt => opt.value) : [];
                              setForm(f => ({ ...f, pengampu: values.length > 0 ? values : null }));
                              resetErrorForm();
                            }}
                            onMenuOpen={() => {
                              // Optional: bisa ditambahkan logika tambahan saat menu dibuka
                            }}
                            placeholder="Cari dan pilih dosen (bisa lebih dari 1)"
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
                              multiValue: base => ({
                                ...base,
                                backgroundColor: '#3b82f6',
                                color: '#fff',
                              }),
                              multiValueLabel: base => ({
                                ...base,
                                color: '#fff',
                              }),
                              multiValueRemove: base => ({
                                ...base,
                                color: '#fff',
                                '&:hover': {
                                  backgroundColor: '#2563eb',
                                  color: '#fff',
                                },
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
                          {/* Info jumlah dosen yang dipilih */}
                          {Array.isArray(form.pengampu) && form.pengampu.length > 0 && (
                            <div className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                              <span className="font-medium">{form.pengampu.length}</span> dosen dipilih
                            </div>
                          )}
                          </>
                        ) : (
                          // This shouldn't happen in semester antara
                          form.materi && pengampuOptions.length === 0 ? (
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
                          )
                        )}
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topik</label>
                        <input type="text" name="topik" value={form.topik} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelompok Besar</label>
                        {true ? (
                          // Kelompok besar antara untuk Semester Antara
                          kelompokBesarAntaraOptions.length === 0 ? (
                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                              <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                                  Belum ada kelompok besar yang dibuat untuk Semester Antara
                                </span>
                              </div>
                              <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                                Silakan buat kelompok besar terlebih dahulu dengan menekan tombol "Kelola Kelompok"
                              </p>
                            </div>
                          ) : (
                            <Select
                              options={kelompokBesarAntaraOptions.map(k => ({ value: k.id, label: k.label }))}
                              value={kelompokBesarAntaraOptions.find(k => k.id === form.kelompokBesar) ? { value: form.kelompokBesar, label: kelompokBesarAntaraOptions.find(k => k.id === form.kelompokBesar)?.label } : null}
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
                        )
                        ) : (
                          // Kelompok besar semester reguler tidak digunakan di semester antara
                          false ? (
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
                            <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                              <span className="text-gray-700 dark:text-gray-300 text-sm">
                                Kelompok semester reguler tidak digunakan di semester antara
                              </span>
                            </div>
                          )
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
                          ) : (['pbl', 'jurnal'].includes(form.jenisBaris)) && (allDosenOptions.length === 0) ? (
                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                              <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                                  Belum ada dosen yang tersedia untuk PBL mata kuliah ini
                                </span>
                              </div>
                              <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                                Untuk semester antara, semua dosen tersedia sebagai pengampu PBL
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
                                  return allDosenOptions.map(d => ({ value: d.id, label: d.name }));
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
                                  return allDosenOptions.map(d => ({ value: d.id, label: d.name })).find(opt => opt.value === form.pengampu) || null;
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
                        {true ? (
                          // Kelompok besar antara untuk Semester Antara
                          kelompokBesarAntaraOptions.length === 0 ? (
                            <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                              <div className="flex items-center gap-2">
                                <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                                </svg>
                                <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                                  Belum ada kelompok besar yang dibuat untuk Semester Antara
                                </span>
                              </div>
                              <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                                Silakan buat kelompok besar terlebih dahulu dengan menekan tombol "Kelola Kelompok"
                              </p>
                            </div>
                          ) : (
                            <Select
                              options={kelompokBesarAntaraOptions.map(k => ({ value: Number(k.id), label: k.label }))}
                              value={kelompokBesarAntaraOptions.map(k => ({ value: Number(k.id), label: k.label })).find(opt => opt.value === form.kelompokBesar) || null}
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
                          )
                        ) : (
                          // Kelompok besar agenda semester reguler tidak digunakan di semester antara
                          false ? (
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
                            <div className="bg-gray-50 dark:bg-gray-900/20 border border-gray-200 dark:border-gray-800 rounded-xl p-4">
                              <span className="text-gray-700 dark:text-gray-300 text-sm">
                                Kelompok semester reguler tidak digunakan di semester antara
                              </span>
                            </div>
                          )
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
                                Belum ada kelompok kecil antara yang dibuat untuk semester ini
                              </span>
                            </div>
                            <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                              Silakan buat kelompok kecil antara terlebih dahulu di tab "Kelompok Kecil Antara"
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pengampu ({allDosenOptions.length} dosen tersedia)</label>
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
                        ) : (allDosenOptions.length === 0) ? (
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
                            isMulti
                            options={allDosenOptions.map(d => ({ value: d.id, label: d.name }))}
                            isSearchable={true}
                            filterOption={(option, inputValue) => {
                              const label = option.label.toLowerCase();
                              const input = inputValue.toLowerCase();
                              return label.includes(input);
                            }}
                            noOptionsMessage={() => "Tidak ada dosen yang ditemukan"}
                            loadingMessage={() => "Mencari dosen..."}
                            value={Array.isArray(form.pengampu) 
                              ? form.pengampu.map(id => allDosenOptions.find(d => d.id === id)).filter(Boolean).map(d => ({ value: d!.id, label: d!.name }))
                              : form.pengampu 
                                ? [{ value: form.pengampu, label: allDosenOptions.find(d => d.id === form.pengampu)?.name || `Dosen ${form.pengampu}` }]
                                : []
                            }
                            onChange={opts => {
                              const values = opts ? opts.map(opt => opt.value) : [];
                              setForm(f => ({ ...f, pengampu: values.length > 0 ? values : null }));
                              resetErrorForm();
                            }}
                            onMenuOpen={() => {
                              // Optional: bisa ditambahkan logika tambahan saat menu dibuka
                            }}
                            placeholder="Cari dan pilih dosen (bisa lebih dari 1)"
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
                              multiValue: base => ({
                                ...base,
                                backgroundColor: '#3b82f6',
                                color: '#fff',
                              }),
                              multiValueLabel: base => ({
                                ...base,
                                color: '#fff',
                              }),
                              multiValueRemove: base => ({
                                ...base,
                                color: '#fff',
                                '&:hover': {
                                  backgroundColor: '#2563eb',
                                  color: '#fff',
                                },
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
                                Belum ada kelompok kecil antara yang dibuat untuk semester ini
                              </span>
                            </div>
                            <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                              Silakan buat kelompok kecil antara terlebih dahulu di tab "Kelompok Kecil Antara"
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
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Pengampu ({allDosenOptions.length} dosen tersedia)</label>
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
                        ) : (allDosenOptions.length === 0) ? (
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
                            isMulti
                            options={allDosenOptions.map(d => ({ value: d.id, label: d.name }))}
                            isSearchable={true}
                            filterOption={(option, inputValue) => {
                              const label = option.label.toLowerCase();
                              const input = inputValue.toLowerCase();
                              return label.includes(input);
                            }}
                            noOptionsMessage={() => "Tidak ada dosen yang ditemukan"}
                            loadingMessage={() => "Mencari dosen..."}
                            value={Array.isArray(form.pengampu) 
                              ? form.pengampu.map(id => allDosenOptions.find(d => d.id === id)).filter(Boolean).map(d => ({ value: d!.id, label: d!.name }))
                              : form.pengampu 
                                ? [{ value: form.pengampu, label: allDosenOptions.find(d => d.id === form.pengampu)?.name || `Dosen ${form.pengampu}` }]
                                : []
                            }
                            onChange={opts => {
                              const values = opts ? opts.map(opt => opt.value) : [];
                              setForm(f => ({ ...f, pengampu: values.length > 0 ? values : null }));
                              resetErrorForm();
                            }}
                            onMenuOpen={() => {
                              // Optional: bisa ditambahkan logika tambahan saat menu dibuka
                            }}
                            placeholder="Cari dan pilih dosen (bisa lebih dari 1)"
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
                            multiValue: base => ({
                              ...base,
                              backgroundColor: '#3b82f6',
                              color: '#fff',
                            }),
                            multiValueLabel: base => ({
                              ...base,
                              color: '#fff',
                            }),
                            multiValueRemove: base => ({
                              ...base,
                              color: '#fff',
                              '&:hover': {
                                backgroundColor: '#2563eb',
                                color: '#fff',
                              },
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
      // Cari objek kelompok kecil antara yang cocok
      // Pencarian kelompok harus berdasarkan nama_kelompok, bukan ID
      // karena dropdown menggunakan nama_kelompok sebagai value
      const kelompokObj = kelompokKecilAntaraList.find(
        k => k.nama_kelompok === form.kelompok
      ) || kelompokKecilAntaraList.find(
        k => `Kelompok ${k.nama_kelompok}` === form.kelompok
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
        // Pencarian kelompok harus berdasarkan nama_kelompok, bukan ID
        // karena dropdown menggunakan nama_kelompok sebagai value
        const kelompokObj = kelompokKecilAntaraList.find(
          k => k.nama_kelompok === form.kelompok
        ) || kelompokKecilAntaraList.find(
          k => `Kelompok ${k.nama_kelompok}` === form.kelompok
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
          kelompok_kecil_id: null, // Set null untuk semester antara
          kelompok_kecil_antara_id: kelompokObj.id, // Gunakan kelompok_kecil_antara_id untuk semester antara
          dosen_id: null, // Set null untuk multiple dosen
          dosen_ids: Array.isArray(form.pengampu) ? form.pengampu : (form.pengampu ? [form.pengampu] : []),
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
    (form.jenisBaris === 'materi' && (!form.jamMulai || !form.jumlahKali || !form.pengampu || !form.topik || !form.lokasi)) ||
    (form.jenisBaris === 'agenda' && (!form.agenda || !form.jamMulai || !form.jumlahKali || !form.jamSelesai || (form.useRuangan && !form.lokasi))) ||
    (form.jenisBaris === 'praktikum' && (!form.kelasPraktikum || !form.topik)) ||
    // PERBAIKI BAGIAN INI:
    (form.jenisBaris === 'pbl' && (
      !form.pblTipe ||
      !form.jamMulai ||
      !form.jamSelesai ||
      form.modul == null ||
      !form.kelompok ||
      !form.pengampu ||
      (Array.isArray(form.pengampu) && form.pengampu.length === 0) ||
      form.lokasi == null
    )) ||
    (form.jenisBaris === 'jurnal' && (!form.hariTanggal || !form.jamMulai || !form.jamSelesai || !form.kelompok || !form.topik || !form.pengampu || (Array.isArray(form.pengampu) && form.pengampu.length === 0) || !form.lokasi))
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

        {/* Success Message untuk PBL */}
        <AnimatePresence>
          {successMessage && bulkDeleteType === 'pbl' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {successMessage}
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
                  getPaginatedData(
                  jadwalPBL
                  .slice()
                  .sort((a: JadwalPBLType, b: JadwalPBLType) => {
                    const dateA = new Date(a.tanggal);
                    const dateB = new Date(b.tanggal);
                    return dateA.getTime() - dateB.getTime();
                      }),
                    pblPage,
                    pblPageSize
                  ).map((row: JadwalPBLType, i: number) => (
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
                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{(pblPage - 1) * pblPageSize + i + 1}</td>
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
                        {row.nama_kelompok || row.kelompok_kecil_antara?.nama_kelompok || 'Memuat...'}
                      </td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {row.dosen_names || allDosenList.find(d => d.id === Number(row.dosen_id))?.name || (loadingDosenRuangan ? 'Memuat...' : `Dosen ${row.dosen_id}`)}
                      </td>
                        <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                          {allRuanganList.find(r => r.id === Number(row.ruangan_id))?.nama || (loadingDosenRuangan ? 'Memuat...' : `Ruangan ${row.ruangan_id}`)}
                        </td>
                        <td className="px-4 py-4 text-center whitespace-nowrap">
                          <button
                            onClick={() => navigate(`/penilaian-pbl-antara/${kode}/${row.kelompok_kecil_antara?.nama_kelompok || ''}/${row.pbl_tipe || ''}?rowIndex=${i}&jadwal_id=${row.id || ''}`)}
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

        {/* Pagination for PBL */}
        {true && (
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan {((pblPage - 1) * pblPageSize) + 1} - {Math.min(pblPage * pblPageSize, jadwalPBL.length)} dari {jadwalPBL.length} data
              </span>
              
              <select
                value={pblPageSize}
                onChange={(e) => {
                  setPblPageSize(Number(e.target.value));
                  setPblPage(1);
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
                onClick={() => setPblPage((p) => Math.max(1, p - 1))}
                disabled={pblPage === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Previous
              </button>

              {/* Always show first page if it's not the current page */}
              {getTotalPages(jadwalPBL.length, pblPageSize) > 1 && (
                <button
                  onClick={() => setPblPage(1)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    pblPage === 1
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  1
                </button>
              )}

              {/* Show pages around current page */}
              {Array.from({ length: getTotalPages(jadwalPBL.length, pblPageSize) }, (_, i) => {
                const pageNum = i + 1;
                // Show pages around current page (2 pages before and after)
                const shouldShow =
                  pageNum > 1 &&
                  pageNum < getTotalPages(jadwalPBL.length, pblPageSize) &&
                  pageNum >= pblPage - 2 &&
                  pageNum <= pblPage + 2;

                if (!shouldShow) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setPblPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                      pblPage === pageNum
                        ? "bg-brand-500 text-white"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Show ellipsis if current page is far from end */}
              {pblPage < getTotalPages(jadwalPBL.length, pblPageSize) - 3 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">
                  ...
                </span>
              )}

              {/* Always show last page if it's not the first page */}
              {getTotalPages(jadwalPBL.length, pblPageSize) > 1 && (
                <button
                  onClick={() => setPblPage(getTotalPages(jadwalPBL.length, pblPageSize))}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    pblPage === getTotalPages(jadwalPBL.length, pblPageSize)
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {getTotalPages(jadwalPBL.length, pblPageSize)}
                </button>
              )}

              <button
                onClick={() => setPblPage((p) => Math.min(getTotalPages(jadwalPBL.length, pblPageSize), p + 1))}
                disabled={pblPage === getTotalPages(jadwalPBL.length, pblPageSize)}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
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

        {/* Success Message untuk Jurnal Reading */}
        <AnimatePresence>
          {successMessage && bulkDeleteType === 'jurnal-reading' && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {successMessage}
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
                  getPaginatedData(jadwalJurnalReading, jurnalReadingPage, jurnalReadingPageSize).map((row: any, i: number) => (
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
                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{(jurnalReadingPage - 1) * jurnalReadingPageSize + i + 1}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {row.tanggal ? formatTanggalKonsisten(row.tanggal) : ''}
                      </td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{formatJamTanpaDetik(row.jam_mulai)}–{formatJamTanpaDetik(row.jam_selesai)}</td>
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.jumlah_sesi} x 50 menit</td>
                                              <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.nama_kelompok || row.kelompok_kecil_antara?.nama_kelompok || 'Memuat...'}</td>
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
                            if (!(row as any).kelompok_kecil_antara?.nama_kelompok) {
                              alert('Data kelompok tidak ditemukan');
                              return;
                            }
                            
                            // Simpan data jurnal ke localStorage untuk halaman penilaian
                            const jurnalData = {
                              dosen: (row as any).dosen_names || allDosenList.find(d => d.id === Number((row as any).dosen_id))?.name || '',
                              tanggal: (row as any).tanggal,
                              judulJurnal: (row as any).topik
                            };
                            
                            const storageKey = `jurnalInfo_${data!.kode}_${(row as any).kelompok_kecil_antara.nama_kelompok}_${row.id}`;
                            localStorage.setItem(storageKey, JSON.stringify(jurnalData));
                            
                            // Navigasi ke halaman penilaian dengan jurnal_id
                            navigate(`/penilaian-jurnal-antara/${data!.kode}/${(row as any).kelompok_kecil_antara.nama_kelompok}/${row.id}`);
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

        {/* Pagination for Jurnal Reading */}
        {true && (
          <div className="flex items-center justify-between mt-6">
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan {((jurnalReadingPage - 1) * jurnalReadingPageSize) + 1} - {Math.min(jurnalReadingPage * jurnalReadingPageSize, jadwalJurnalReading.length)} dari {jadwalJurnalReading.length} data
              </span>
              
              <select
                value={jurnalReadingPageSize}
                onChange={(e) => {
                  setJurnalReadingPageSize(Number(e.target.value));
                  setJurnalReadingPage(1);
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
                onClick={() => setJurnalReadingPage((p) => Math.max(1, p - 1))}
                disabled={jurnalReadingPage === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Previous
              </button>

              {/* Always show first page if it's not the current page */}
              {getTotalPages(jadwalJurnalReading.length, jurnalReadingPageSize) > 1 && (
                <button
                  onClick={() => setJurnalReadingPage(1)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    jurnalReadingPage === 1
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  1
                </button>
              )}

              {/* Show pages around current page */}
              {Array.from({ length: getTotalPages(jadwalJurnalReading.length, jurnalReadingPageSize) }, (_, i) => {
                const pageNum = i + 1;
                // Show pages around current page (2 pages before and after)
                const shouldShow =
                  pageNum > 1 &&
                  pageNum < getTotalPages(jadwalJurnalReading.length, jurnalReadingPageSize) &&
                  pageNum >= jurnalReadingPage - 2 &&
                  pageNum <= jurnalReadingPage + 2;

                if (!shouldShow) return null;

                return (
                  <button
                    key={pageNum}
                    onClick={() => setJurnalReadingPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                      jurnalReadingPage === pageNum
                        ? "bg-brand-500 text-white"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Show ellipsis if current page is far from end */}
              {jurnalReadingPage < getTotalPages(jadwalJurnalReading.length, jurnalReadingPageSize) - 3 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">
                  ...
                </span>
              )}

              {/* Always show last page if it's not the first page */}
              {getTotalPages(jadwalJurnalReading.length, jurnalReadingPageSize) > 1 && (
                <button
                  onClick={() => setJurnalReadingPage(getTotalPages(jadwalJurnalReading.length, jurnalReadingPageSize))}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    jurnalReadingPage === getTotalPages(jadwalJurnalReading.length, jurnalReadingPageSize)
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  {getTotalPages(jadwalJurnalReading.length, jurnalReadingPageSize)}
                </button>
              )}

              <button
                onClick={() => setJurnalReadingPage((p) => Math.min(getTotalPages(jadwalJurnalReading.length, jurnalReadingPageSize), p + 1))}
                disabled={jurnalReadingPage === getTotalPages(jadwalJurnalReading.length, jurnalReadingPageSize)}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
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

      {/* Modal Kelola Kelompok Antara */}
      <AnimatePresence>
        {showKelompokBesarAntaraModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowKelompokBesarAntaraModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
                              className="relative w-full max-w-7xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-50 max-h-[90vh] overflow-hidden"
            >
              {/* Enhanced Header */}
              <div className="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/20 rounded-xl flex items-center justify-center">
                    <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">Kelola Kelompok Antara</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                      Buat dan kelola kelompok besar dan kecil untuk semester antara
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowKelompokBesarAntaraModal(false)}
                  className="p-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-105"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="mt-8 mb-8">
                <div className="flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1.5 shadow-sm border border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setActiveTab('besar')}
                    className={`flex-1 px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                      activeTab === 'besar'
                        ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    Kelompok Besar
                  </button>
                  <button
                    onClick={() => setActiveTab('kecil')}
                    className={`flex-1 px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                      activeTab === 'kecil'
                        ? 'bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 shadow-md'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'
                    }`}
                  >
                    Kelompok Kecil
                  </button>
                </div>
              </div>

              {/* Content */}
              <div className="flex h-[calc(90vh-200px)]">
                {activeTab === 'besar' ? (
                  <>
                    {/* Left Panel - Create New Group */}
                <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 pr-4 overflow-y-auto hide-scroll">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center space-x-2 mb-6">
                      <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Buat Kelompok Baru</h3>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Nama Kelompok */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Nama Kelompok
                        </label>
                        <input
                          type="text"
                          value={kelompokBesarAntaraForm.nama_kelompok}
                          onChange={(e) => setKelompokBesarAntaraForm(prev => ({ ...prev, nama_kelompok: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 shadow-sm"
                          placeholder="Contoh: Kelompok Besar 1"
                        />
                      </div>
                      
                      {/* Selected Count */}
                      {selectedMahasiswa.length > 0 && (
                        <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700 rounded-xl p-4 shadow-sm">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">
                              {selectedMahasiswa.length} mahasiswa dipilih
                            </p>
                          </div>
                        </div>
                      )}
                      
                      {/* Mahasiswa List */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Pilih Mahasiswa ({allMahasiswaOptions.length} tersedia, {getTotalGroupedStudents()} sudah dikelompokkan)
                        </label>
                        
                        {/* Search and Filter */}
                        <div className="flex gap-3 mb-3">
                          {/* Search Input */}
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={searchMahasiswa}
                              onChange={(e) => setSearchMahasiswa(e.target.value)}
                              placeholder="Cari nama atau email mahasiswa..."
                              className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </div>
                          </div>
                          
                          {/* IPK Filter */}
                          <div className="w-40">
                            <select
                              value={filterIPK}
                              onChange={(e) => setFilterIPK(e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                            >
                              <option value="semua">Semua IPK</option>
                              <option value="3.5+">IPK 3.5+ (Hijau)</option>
                              <option value="3.0-3.49">IPK 3.0-3.49 (Biru)</option>
                              <option value="2.5-2.99">IPK 2.5-2.99 (Kuning)</option>
                              <option value="<2.5">IPK &lt;2.5 (Merah)</option>
                            </select>
                          </div>
                        </div>
                        
                        <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 hide-scroll shadow-sm">
                          {/* Search Results Info */}
                          {(searchMahasiswa || filterIPK !== 'semua') && (
                            <div className="p-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                              <p className="text-sm text-gray-600 dark:text-gray-400">
                                Menampilkan {getFilteredMahasiswa().length} dari {allMahasiswaOptions.length} mahasiswa
                                {searchMahasiswa && ` untuk pencarian "${searchMahasiswa}"`}
                                {filterIPK !== 'semua' && ` dengan filter IPK ${filterIPK}`}
                              </p>
                            </div>
                          )}
                          {isLoadingMahasiswa ? (
                            // Skeleton loading untuk mahasiswa
                            <div className="p-4 space-y-3">
                              {[...Array(6)].map((_, index) => (
                                <div key={index} className="flex items-center space-x-3 animate-pulse">
                                  <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                  <div className="flex-1">
                                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                                    <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                                  </div>
                                  <div className="w-16 h-6 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <>
                            {getFilteredMahasiswa().map((mahasiswa) => {
                            const isSelected = selectedMahasiswa.some(m => m.id === mahasiswa.id);
                            const isInOtherGroup = kelompokBesarAntaraOptions.some(group => 
                              group.mahasiswa.some(m => m.id === mahasiswa.id)
                            );
                            
                            return (
                              <div
                                key={mahasiswa.id}
                                className={`p-4 border-b border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 ${
                                  isSelected ? 'bg-brand-50 dark:bg-brand-900/20' : ''
                                } ${isInOtherGroup && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                                onClick={() => {
                                  if (isInOtherGroup && !isSelected) return;
                                  
                                  if (isSelected) {
                                    setSelectedMahasiswa(prev => prev.filter(m => m.id !== mahasiswa.id));
                                    setKelompokBesarAntaraForm(prev => ({
                                      ...prev,
                                      mahasiswa_ids: prev.mahasiswa_ids.filter(id => id !== mahasiswa.id)
                                    }));
                                  } else {
                                    setSelectedMahasiswa(prev => [...prev, mahasiswa]);
                                    setKelompokBesarAntaraForm(prev => ({
                                      ...prev,
                                      mahasiswa_ids: [...prev.mahasiswa_ids, mahasiswa.id]
                                    }));
                                  }
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                      isSelected 
                                        ? 'bg-brand-500 border-brand-500' 
                                        : 'border-gray-300 dark:border-gray-600'
                                    }`}>
                                      {isSelected && (
                                        <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                        </svg>
                                      )}
                                    </div>
                                    <div>
                                      <div className="flex items-center space-x-2">
                                        <p className="font-medium text-gray-800 dark:text-white text-sm">{mahasiswa.name}</p>
                                        <span
                                          className={`text-xs px-2 py-0.5 rounded-full ${
                                            (mahasiswa.ipk || 0) >= 3.5
                                              ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                              : (mahasiswa.ipk || 0) >= 3.0
                                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                              : (mahasiswa.ipk || 0) >= 2.5
                                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                                              : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                                          }`}
                                        >
                                          IPK {mahasiswa.ipk ? mahasiswa.ipk.toFixed(2) : "N/A"}
                                        </span>
                                      </div>
                                      <p className="text-xs text-gray-500 dark:text-gray-400">{mahasiswa.email}</p>
                                    </div>
                                  </div>
                                  {isInOtherGroup && !isSelected && (
                                    <span className="text-xs text-gray-400">Sudah di kelompok lain</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                            </>
                          )}
                        </div>
                      </div>

                      {/* Create Button */}
                      <button
                        onClick={createKelompokBesarAntara}
                        disabled={!kelompokBesarAntaraForm.nama_kelompok || kelompokBesarAntaraForm.mahasiswa_ids.length === 0 || isCreatingKelompok}
                        className="w-full px-6 py-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          {isCreatingKelompok ? (
                            <>
                              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Membuat Kelompok...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              <span>Buat Kelompok ({selectedMahasiswa.length} mahasiswa)</span>
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Panel - Existing Groups */}
                <div className="w-1/2 pl-4 overflow-y-auto hide-scroll">
                  <div className="flex items-center space-x-2 mb-6">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      Kelompok yang Sudah Ada ({kelompokBesarAntaraOptions.length})
                    </h3>
                  </div>
                  
                  <div className="space-y-3">
                    {isLoadingKelompok ? (
                      // Skeleton loading untuk kelompok yang sudah ada
                      <div className="space-y-3">
                        {[...Array(2)].map((_, index) => (
                          <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm animate-pulse">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-48"></div>
                              </div>
                              <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {[...Array(6)].map((_, studentIndex) => (
                                <div key={studentIndex} className="flex items-center space-x-2">
                                  <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
                                  <div className="w-16 h-5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <>
                        {kelompokBesarAntaraOptions.map((kelompok: any) => (
                          <div key={kelompok.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                                  <svg className="w-4 h-4 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                </div>
                                <h4 className="font-semibold text-gray-800 dark:text-white">{kelompok.label}</h4>
                              </div>
                              <button
                                onClick={() => deleteKelompokBesarAntara(kelompok.id)}
                                className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                                title="Hapus kelompok"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {kelompok.mahasiswa.map((mahasiswa: any) => (
                                <div key={mahasiswa.id} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                                  <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                                  <span>{mahasiswa.name}</span>
                                  <span
                                    className={`text-xs px-2 py-0.5 rounded-full ${
                                      (mahasiswa.ipk || 0) >= 3.5
                                        ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                        : (mahasiswa.ipk || 0) >= 3.0
                                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                        : (mahasiswa.ipk || 0) >= 2.5
                                        ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                                        : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                                    }`}
                                  >
                                    IPK {mahasiswa.ipk ? mahasiswa.ipk.toFixed(2) : "N/A"}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    
                    {!isLoadingKelompok && kelompokBesarAntaraOptions.length === 0 && (
                      <div className="text-center py-12">
                        <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                          <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <p className="text-gray-500 dark:text-gray-400 font-medium">
                          Belum ada kelompok besar yang dibuat
                        </p>
                        <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                          Buat kelompok pertama di panel sebelah kiri
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </>
            ) : (
              <>
                {/* Left Panel - Create New Kelompok Kecil */}
                <div className="w-1/2 border-r border-gray-200 dark:border-gray-700 pr-4 overflow-y-auto hide-scroll">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center space-x-2 mb-6">
                      <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Buat Kelompok Kecil Baru</h3>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Nama Kelompok */}
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                          Nama Kelompok Kecil
                        </label>
                        <input
                          type="text"
                          value={kelompokKecilAntaraForm.nama_kelompok}
                          onChange={(e) => setKelompokKecilAntaraForm(prev => ({ ...prev, nama_kelompok: e.target.value }))}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 shadow-sm"
                          placeholder="Contoh: Kelompok Kecil 1"
                        />
                      </div>

                      {/* Pilih Mahasiswa dari Kelompok Besar */}
                      {/* Selected Count */}
                      {kelompokKecilAntaraForm.mahasiswa_ids.length > 0 && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 shadow-sm mb-4">
                          <div className="flex items-center space-x-2">
                            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </div>
                            <p className="text-sm font-semibold text-green-800 dark:text-green-200">
                              {kelompokKecilAntaraForm.mahasiswa_ids.length} mahasiswa dipilih
                            </p>
                          </div>
                        </div>
                      )}
                      
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Pilih Mahasiswa dari Kelompok Besar Antara
                        </label>
                        
                        {/* Search and Filter */}
                        <div className="flex space-x-3 mb-3">
                          {/* Search Input */}
                          <div className="relative flex-1">
                            <input
                              type="text"
                              value={searchMahasiswaKelompokKecil}
                              onChange={(e) => setSearchMahasiswaKelompokKecil(e.target.value)}
                              placeholder="Cari nama atau email mahasiswa..."
                              className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                            />
                            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                              <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                              </svg>
                            </div>
                          </div>
                          
                          {/* IPK Filter */}
                          <div className="w-48">
                            <select
                              value={filterIPKKelompokKecil}
                              onChange={(e) => setFilterIPKKelompokKecil(e.target.value)}
                              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                            >
                              <option value="semua">Semua IPK</option>
                              <option value=">=3.5">IPK ≥3.5 (Hijau)</option>
                              <option value="3.0-3.49">IPK 3.0-3.49 (Biru)</option>
                              <option value="2.5-2.99">IPK 2.5-2.99 (Kuning)</option>
                              <option value="<2.5">IPK &lt;2.5 (Merah)</option>
                            </select>
                          </div>
                        </div>
                        {isLoadingKelompok ? (
                          <div className="space-y-2">
                            {[...Array(3)].map((_, index) => (
                              <div key={index} className="h-10 bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse"></div>
                            ))}
                          </div>
                        ) : kelompokBesarAntaraOptions.length === 0 ? (
                          <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada kelompok besar yang dibuat</p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Buat kelompok besar terlebih dahulu</p>

                          </div>
                        ) : (
                          <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 hide-scroll shadow-sm">
                            {/* Search Results Info */}
                            {(searchMahasiswaKelompokKecil || filterIPKKelompokKecil !== 'semua') && (
                              <div className="p-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  {searchMahasiswaKelompokKecil && `Mencari: "${searchMahasiswaKelompokKecil}"`}
                                  {searchMahasiswaKelompokKecil && filterIPKKelompokKecil !== 'semua' && ' | '}
                                  {filterIPKKelompokKecil !== 'semua' && `Filter IPK: ${filterIPKKelompokKecil}`}
                                </p>
                              </div>
                            )}
                            {kelompokBesarAntaraOptions.map((kelompok: any) => {
                              // Filter mahasiswa berdasarkan search dan IPK
                              const filteredMahasiswa = kelompok.mahasiswa?.filter((mahasiswa: any) => {
                                // Filter berdasarkan search
                                const matchesSearch = !searchMahasiswaKelompokKecil || 
                                  mahasiswa.name.toLowerCase().includes(searchMahasiswaKelompokKecil.toLowerCase()) ||
                                  mahasiswa.email.toLowerCase().includes(searchMahasiswaKelompokKecil.toLowerCase());
                                
                                // Filter berdasarkan IPK
                                const matchesIPK = filterIPKKelompokKecil === 'semua' || 
                                  (filterIPKKelompokKecil === '>=3.5' && (mahasiswa.ipk || 0) >= 3.5) ||
                                  (filterIPKKelompokKecil === '3.0-3.49' && (mahasiswa.ipk || 0) >= 3.0 && (mahasiswa.ipk || 0) < 3.5) ||
                                  (filterIPKKelompokKecil === '2.5-2.99' && (mahasiswa.ipk || 0) >= 2.5 && (mahasiswa.ipk || 0) < 3.0) ||
                                  (filterIPKKelompokKecil === '<2.5' && (mahasiswa.ipk || 0) < 2.5);
                                
                                return matchesSearch && matchesIPK;
                              }) || [];
                              
                              // Skip kelompok jika tidak ada mahasiswa yang cocok dengan filter
                              if ((searchMahasiswaKelompokKecil || filterIPKKelompokKecil !== 'semua') && filteredMahasiswa.length === 0) {
                                return null;
                              }
                              
                              return (
                              <div key={kelompok.id} className="p-4 border-b border-gray-200 dark:border-gray-600">
                                                                                                    <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center space-x-3">
                                      <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                                        <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                        </svg>
                                      </div>
                                      <div>
                                        <span className="text-xs text-gray-500 dark:text-gray-400">{kelompok.mahasiswa?.length || 0} mahasiswa</span>
                                        <span className="text-xs text-blue-600 dark:text-blue-400 block">{kelompok.label.split(' (')[0]}</span>
                                      </div>
                                    </div>
                                  </div>
                                <div className="space-y-1">
                                  {filteredMahasiswa.map((mahasiswa: any) => {
                                    const isSelected = kelompokKecilAntaraForm.mahasiswa_ids.includes(mahasiswa.id);
                                    const isInOtherKelompokKecil = kelompokKecilAntaraList.some(kelompok => 
                                      kelompok.mahasiswa_ids.includes(mahasiswa.id)
                                    );
                                    
                                    return (
                                      <div
                                        key={mahasiswa.id}
                                        className={`p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 ${
                                          isSelected ? 'bg-green-50 dark:bg-green-900/20' : ''
                                        } ${isInOtherKelompokKecil && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                                        onClick={() => {
                                          if (isInOtherKelompokKecil && !isSelected) return;
                                          
                                          if (isSelected) {
                                            setKelompokKecilAntaraForm(prev => ({
                                              ...prev,
                                              mahasiswa_ids: prev.mahasiswa_ids.filter(id => id !== mahasiswa.id)
                                            }));
                                          } else {
                                            setKelompokKecilAntaraForm(prev => ({
                                              ...prev,
                                              mahasiswa_ids: [...prev.mahasiswa_ids, mahasiswa.id]
                                            }));
                                          }
                                        }}
                                      >
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center space-x-3">
                                            <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                              isSelected 
                                                ? 'bg-green-500 border-green-500' 
                                                : 'border-gray-300 dark:border-gray-600'
                                            }`}>
                                              {isSelected && (
                                                <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                </svg>
                                              )}
                                            </div>
                                            <div>
                                              <div className="flex items-center space-x-2">
                                                <p className="font-medium text-gray-800 dark:text-white text-sm">{mahasiswa.name}</p>
                                                <span
                                                  className={`text-xs px-2 py-0.5 rounded-full ${
                                                    (mahasiswa.ipk || 0) >= 3.5
                                                      ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                                      : (mahasiswa.ipk || 0) >= 3.0
                                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                                      : (mahasiswa.ipk || 0) >= 2.5
                                                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                                                      : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                                                  }`}
                                                >
                                                  IPK {mahasiswa.ipk ? mahasiswa.ipk.toFixed(2) : "N/A"}
                                                </span>
                                              </div>
                                              <p className="text-xs text-gray-500 dark:text-gray-400">{mahasiswa.email}</p>
                                            </div>
                                          </div>
                                          {isInOtherKelompokKecil && !isSelected && (
                                            <span className="text-xs text-gray-400">Sudah di kelompok lain</span>
                                          )}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      
                      {/* Create Button */}
                      <button
                        onClick={createKelompokKecilAntara}
                        disabled={!kelompokKecilAntaraForm.nama_kelompok || kelompokKecilAntaraForm.mahasiswa_ids.length === 0 || isCreatingKelompokKecilAntara}
                        className="w-full px-6 py-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                      >
                        <div className="flex items-center justify-center space-x-2">
                          {isCreatingKelompokKecilAntara ? (
                            <>
                              <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                              </svg>
                              <span>Membuat Kelompok...</span>
                            </>
                          ) : (
                            <>
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              <span>Buat Kelompok Kecil ({kelompokKecilAntaraForm.mahasiswa_ids.length} mahasiswa)</span>
                            </>
                          )}
                        </div>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right Panel - Existing Kelompok Kecil */}
                <div className="w-1/2 pl-4 overflow-y-auto hide-scroll">
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                    <div className="flex items-center space-x-2 mb-6">
                      <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Kelompok Kecil yang Sudah Dibuat</h3>
                    </div>
                    
                    <div className="space-y-3">
                      {isLoadingKelompokKecilAntara ? (
                        // Skeleton loading untuk kelompok kecil yang sudah ada
                        <div className="space-y-3">
                          {[...Array(2)].map((_, index) => (
                            <div key={index} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm animate-pulse">
                              <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center space-x-3">
                                  <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                                  <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-48"></div>
                                </div>
                                <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[...Array(6)].map((_, studentIndex) => (
                                  <div key={studentIndex} className="flex items-center space-x-2">
                                    <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
                                    <div className="w-16 h-5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : kelompokKecilAntaraList.length === 0 ? (
                        <div className="text-center py-12">
                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                          </div>
                          <p className="text-gray-500 dark:text-gray-400 font-medium">
                            Belum ada kelompok kecil yang dibuat
                          </p>
                          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                            Buat kelompok pertama di panel sebelah kiri
                          </p>
                        </div>
                      ) : (
                        kelompokKecilAntaraList.map((kelompok) => (
                          <div key={kelompok.id} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 shadow-sm hover:shadow-md transition-all duration-200">
                            <div className="flex items-center justify-between mb-4">
                              <div className="flex items-center space-x-3">
                                <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                                  <svg className="w-4 h-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                                  </svg>
                                </div>
                                <h4 className="font-semibold text-gray-800 dark:text-white">{kelompok.nama_kelompok}</h4>
                              </div>
                              <button
                                onClick={() => deleteKelompokKecilAntara(kelompok.id)}
                                className="p-2 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                                title="Hapus kelompok"
                              >
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                </svg>
                              </button>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {kelompok.mahasiswa_ids.map((mahasiswaId) => {
                                const mahasiswa = allMahasiswaOptions.find(m => m.id === mahasiswaId);
                                return mahasiswa ? (
                                  <div key={mahasiswaId} className="flex items-center space-x-2 text-sm text-gray-600 dark:text-gray-400">
                                    <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                                    <span>{mahasiswa.name}</span>
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded-full ${
                                        (mahasiswa.ipk || 0) >= 3.5
                                          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                          : (mahasiswa.ipk || 0) >= 3.0
                                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                          : (mahasiswa.ipk || 0) >= 2.5
                                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                                          : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                                      }`}
                                    >
                                      IPK {mahasiswa.ipk ? mahasiswa.ipk.toFixed(2) : "N/A"}
                                    </span>
                                  </div>
                                ) : null;
                              })}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </>
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
    </div>
  );
}