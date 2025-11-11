import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api, { handleApiError } from '../utils/api';
import { ChevronLeftIcon } from '../icons';
import { AnimatePresence, motion } from 'framer-motion';
import Select from 'react-select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
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
  tipe_non_block?: string;
  tanggal_mulai?: string;
  tanggal_akhir?: string;
  tanggalMulai?: string;
  tanggalAkhir?: string;
  durasi_minggu?: number | null;
  durasiMinggu?: number | null;
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
  dosen_ids?: number[];
  ruangan_id: number | null;
  kelompok_besar_id?: number | null;
  kelompok_besar_antara_id?: number | null;
  use_ruangan?: boolean;
  dosen_names?: string;
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
    pengampu: [] as number[],
    materi: '',
    lokasi: null as number | null,
    jenisBaris: 'materi' as 'materi' | 'agenda',
    agenda: '', // hanya untuk agenda khusus
    kelompokBesarAntara: null as number | null,
    useRuangan: true,
  });
  const [errorForm, setErrorForm] = useState(''); // Error frontend (validasi form)
  const [errorBackend, setErrorBackend] = useState(''); // Error backend (response API)
  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteIndex, setSelectedDeleteIndex] = useState<number | null>(null);
  
  // State untuk bulk delete
  const [selectedItems, setSelectedItems] = useState<number[]>([]);
  const [showBulkDeleteModal, setShowBulkDeleteModal] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  
  // State untuk dropdown options
  const [dosenList, setDosenList] = useState<DosenOption[]>([]);
  const [ruanganList, setRuanganList] = useState<RuanganOption[]>([]);
  const [jamOptions, setJamOptions] = useState<string[]>([]);
  const [kelompokBesarAgendaOptions, setKelompokBesarAgendaOptions] = useState<{id: string | number, label: string, jumlah_mahasiswa: number}[]>([]);
  const [kelompokBesarAntaraOptions, setKelompokBesarAntaraOptions] = useState<{id: number, label: string, jumlah_mahasiswa: number, mahasiswa_ids?: number[], mahasiswa?: {id: number, name: string, email: string, ipk?: number}[]}[]>([]);
  const [showKelompokBesarAntaraModal, setShowKelompokBesarAntaraModal] = useState(false);

  // Pagination state for Non-CSR schedule
  const [nonCsrPage, setNonCsrPage] = useState(1);
  const [nonCsrPageSize, setNonCsrPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  
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
  
  // State untuk modal kelola kelompok
  const [activeTab, setActiveTab] = useState<'besar' | 'kecil'>('besar');
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
  const [kelompokKecilAntaraForm, setKelompokKecilAntaraForm] = useState({
    nama_kelompok: '',
    mahasiswa_ids: [] as number[]
  });
  const [kelompokKecilAntaraList, setKelompokKecilAntaraList] = useState<{id: number, nama_kelompok: string, mahasiswa_ids: number[]}[]>([]);
  const [isLoadingKelompokKecil, setIsLoadingKelompokKecil] = useState(false);
  const [searchMahasiswaKelompokKecil, setSearchMahasiswaKelompokKecil] = useState('');
  const [filterIPKKelompokKecil, setFilterIPKKelompokKecil] = useState('semua');
  const [isCreatingKelompokKecilAntara, setIsCreatingKelompokKecilAntara] = useState(false);
  const [isLoadingKelompokKecilAntara, setIsLoadingKelompokKecilAntara] = useState(false);

  // Reset form function
  const resetForm = () => {
    setForm({
      hariTanggal: '',
      jamMulai: '',
      jumlahKali: 2,
      jamSelesai: '',
      pengampu: [],
      materi: '',
      lokasi: null,
      jenisBaris: 'materi' as 'materi' | 'agenda',
      agenda: '',
      kelompokBesarAntara: null,
      useRuangan: true,
    });
    setEditIndex(null);
    setErrorForm('');
    setErrorBackend('');
  };

  // Fetch kelompok besar options untuk agenda khusus
  const fetchKelompokBesarAgendaOptions = async () => {
    if (!data) return;
    try {
      // Halaman ini khusus untuk semester Antara, selalu gunakan kelompok besar antara
      const res = await api.get(`/kelompok-besar-antara`);
      setKelompokBesarAgendaOptions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      // Error handling is done by handleApiError
    }
  };



  // Fetch kelompok besar antara options
  const fetchKelompokBesarAntaraOptions = async () => {
    if (!data) return;
    try {
      const res = await api.get(`/kelompok-besar-antara`);
      
      setKelompokBesarAntaraOptions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      // Error handling is done by handleApiError
    }
  };

  // Functions untuk modal kelola kelompok
  const fetchAllMahasiswaOptions = async () => {
    setIsLoadingMahasiswa(true);
    try {
      const res = await api.get('/kelompok-besar-antara/mahasiswa');
      setAllMahasiswaOptions(res.data || []);
    } catch (err) {
      // Error handling is done by handleApiError
    } finally {
      setIsLoadingMahasiswa(false);
    }
  };

  const createKelompokBesarAntara = async () => {
    if (!data || !kelompokBesarAntaraForm.nama_kelompok || kelompokBesarAntaraForm.mahasiswa_ids.length === 0) {
      alert('Nama kelompok dan mahasiswa harus diisi!');
      return;
    }

    setIsCreatingKelompok(true);
    try {
      await api.post(`/kelompok-besar-antara`, kelompokBesarAntaraForm);
      setKelompokBesarAntaraForm({ nama_kelompok: '', mahasiswa_ids: [] });
      setSelectedMahasiswa([]);
      await fetchKelompokBesarAntaraOptions();
      alert('Kelompok besar berhasil dibuat!');
    } catch (err) {
      alert('Gagal membuat kelompok besar antara');
    } finally {
      setIsCreatingKelompok(false);
    }
  };

  const deleteKelompokBesarAntara = async (id: number) => {
    if (!data) return;
    
    if (!confirm('Apakah Anda yakin ingin menghapus kelompok ini?')) return;
    
    try {
      await api.delete(`/kelompok-besar-antara/${id}`);
      await fetchKelompokBesarAntaraOptions();
    } catch (err) {
      alert('Gagal menghapus kelompok besar antara');
    }
  };

  const fetchKelompokKecilAntara = async () => {
    if (!data) return;
    setIsLoadingKelompokKecil(true);
    try {
      const res = await api.get(`/kelompok-kecil-antara`);
      setKelompokKecilAntaraList(res.data || []);
    } catch (err) {
      // Error handling is done by handleApiError
    } finally {
      setIsLoadingKelompokKecil(false);
    }
  };

  const createKelompokKecilAntara = async () => {
    if (!data || !kelompokKecilAntaraForm.nama_kelompok || kelompokKecilAntaraForm.mahasiswa_ids.length === 0) {
      alert('Nama kelompok dan mahasiswa harus diisi!');
      return;
    }

    setIsCreatingKelompokKecilAntara(true);
    try {
      await api.post(`/kelompok-kecil-antara`, kelompokKecilAntaraForm);
      setKelompokKecilAntaraForm({ nama_kelompok: '', mahasiswa_ids: [] });
      setSelectedMahasiswa([]);
      await fetchKelompokKecilAntara();
      alert('Kelompok kecil berhasil dibuat!');
    } catch (err) {
      alert('Gagal membuat kelompok kecil antara');
    } finally {
      setIsCreatingKelompokKecilAntara(false);
    }
  };

  const deleteKelompokKecilAntara = async (id: number) => {
    if (!data) return;
    
    if (!confirm('Apakah Anda yakin ingin menghapus kelompok ini?')) return;
    
    try {
      await api.delete(`/kelompok-kecil-antara/${id}`);
      await fetchKelompokKecilAntara();
    } catch (err) {
      alert('Gagal menghapus kelompok kecil antara');
    }
  };

  const getTotalGroupedStudents = () => {
    const allGroupedStudents = new Set([
      ...kelompokBesarAntaraOptions.flatMap(k => k.mahasiswa?.map(m => m.id) || []),
      ...kelompokKecilAntaraList.flatMap(k => k.mahasiswa_ids)
    ]);
    return allGroupedStudents.size;
  };

  const getFilteredMahasiswa = () => {
    let filtered = allMahasiswaOptions;

    // Filter berdasarkan pencarian
    if (searchMahasiswa) {
      filtered = filtered.filter(m => 
        m.name.toLowerCase().includes(searchMahasiswa.toLowerCase()) ||
        m.email.toLowerCase().includes(searchMahasiswa.toLowerCase())
      );
    }

    // Filter berdasarkan IPK
    if (filterIPK !== 'semua') {
      filtered = filtered.filter(m => {
        const ipk = m.ipk || 0;
        switch (filterIPK) {
          case 'tinggi': return ipk >= 3.5;
          case 'sedang': return ipk >= 3.0 && ipk < 3.5;
          case 'rendah': return ipk < 3.0;
          default: return true;
        }
      });
    }

    return filtered;
  };

  // Fetch batch data untuk optimasi performa
  const fetchBatchData = async () => {
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
      
    } catch (error: any) {
      setError(handleApiError(error, 'Memuat data batch'));
    } finally {
      setLoading(false);
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
    const totalMenit = jam * 60 + menit + jumlahKali * 50;
    const jamAkhir = Math.floor(totalMenit / 60).toString().padStart(2, '0');
    const menitAkhir = (totalMenit % 60).toString().padStart(2, '0');
    return `${jamAkhir}.${menitAkhir}`;
  }

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
      const tglMulai = new Date(data.tanggal_mulai || data.tanggalMulai || '');
      const tglAkhir = new Date(data.tanggal_akhir || data.tanggalAkhir || '');
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
      pengampu: row.dosen_ids || (row.dosen_id ? [row.dosen_id] : []),
      materi: row.materi || '',
      lokasi: row.use_ruangan ? (row.ruangan_id || null) : null,
      jenisBaris: row.jenis_baris,
      agenda: row.agenda || '',
      kelompokBesarAntara: row.kelompok_besar_antara_id || null,
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

  // Fungsi untuk handle bulk delete
  const handleBulkDelete = () => {
    setShowBulkDeleteModal(true);
  };

  const confirmBulkDelete = async () => {
    if (!kode) return;
    
    setIsBulkDeleting(true);
    
    try {
      // Delete all selected items
      await Promise.all(selectedItems.map(id => api.delete(`/non-blok-non-csr/jadwal/${kode}/${id}`)));
      
      // Show success message
      setSuccessMessage(`${selectedItems.length} jadwal berhasil dihapus.`);
      setTimeout(() => setSuccessMessage(''), 3000);
      
      // Clear selected items
      setSelectedItems([]);
      
      // Close modal after successful delete
      setShowBulkDeleteModal(false);
      
      // Refresh data
      await fetchBatchData();
      
    } catch (error) {
      setErrorBackend('Gagal menghapus jadwal yang dipilih');
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleSelectAll = (allItems: any[]) => {
    const allIds = allItems.map(item => item.id).filter(id => id !== undefined);
    
    if (selectedItems.length === allIds.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(allIds);
    }
  };

  const handleSelectItem = (itemId: number) => {
    if (selectedItems.includes(itemId)) {
      setSelectedItems(selectedItems.filter(id => id !== itemId));
    } else {
      setSelectedItems([...selectedItems, itemId]);
    }
  };

  async function handleTambahJadwal() {
    setErrorForm('');
    setErrorBackend('');
    if (!form.hariTanggal || (form.jenisBaris === 'materi' && (!form.jamMulai || !form.jumlahKali || form.pengampu.length === 0 || !form.materi || !form.lokasi)) || (form.jenisBaris === 'agenda' && (!form.agenda || (form.useRuangan && !form.lokasi)))) {
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
        dosen_ids: form.pengampu,
        ruangan_id: form.useRuangan ? form.lokasi : null,
        kelompok_besar_antara_id: form.kelompokBesarAntara,
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

  // Fetch batch data on component mount
  useEffect(() => {
    fetchBatchData();
  }, [kode]);

  // Fetch kelompok besar options saat modal agenda khusus dibuka
  useEffect(() => {
    if (showModal && form.jenisBaris === 'agenda') {
      fetchKelompokBesarAgendaOptions();
    }
  }, [showModal, form.jenisBaris]);



  // Fetch kelompok besar antara options saat komponen mount
  useEffect(() => {
    if (data) {
      fetchKelompokBesarAntaraOptions();
    }
  }, [data]);

  // Fetch data saat modal kelola kelompok dibuka
  useEffect(() => {
    if (showKelompokBesarAntaraModal) {
      fetchAllMahasiswaOptions();
      fetchKelompokBesarAntaraOptions();
      fetchKelompokKecilAntara();
    }
  }, [showKelompokBesarAntaraModal]);

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
        </div>
      </div>

      {/* Section Info Tambahan */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Tanggal Mulai</div>
          <div className="text-base text-gray-800 dark:text-white">{(data.tanggal_mulai ? new Date(data.tanggal_mulai).toLocaleDateString('id-ID') : data.tanggalMulai ? new Date(data.tanggalMulai).toLocaleDateString('id-ID') : '-' )}</div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Tanggal Akhir</div>
          <div className="text-base text-gray-800 dark:text-white">{(data.tanggal_akhir ? new Date(data.tanggal_akhir).toLocaleDateString('id-ID') : data.tanggalAkhir ? new Date(data.tanggalAkhir).toLocaleDateString('id-ID') : '-' )}</div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6">
          <div className="mb-2 text-gray-500 text-xs font-semibold uppercase">Durasi Minggu</div>
          <div className="text-base text-gray-800 dark:text-white">{data.durasi_minggu || data.durasiMinggu || '-'}</div>
        </div>
      </div>

      {/* Peringatan dan tombol Kelola Kelompok untuk Semester Antara */}
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

      {/* TOMBOL TAMBAH JADWAL MATERI */}
      <div className="flex justify-end mb-4">
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
            setErrorForm('');
            setErrorBackend('');
          }}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition-all duration-300"
        >
          Tambah Jadwal Kuliah
        </button>
      </div>

      {/* Success Message */}
      <AnimatePresence>
        {successMessage && (
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

      {/* Tabel Jadwal Materi */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] mt-8">
        <div className="max-w-full overflow-x-auto hide-scroll">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
            <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  <button
                    type="button"
                    aria-checked={jadwalMateri.length > 0 && jadwalMateri.every(item => selectedItems.includes(item.id!))}
                    role="checkbox"
                    onClick={() => handleSelectAll(jadwalMateri)}
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${jadwalMateri.length > 0 && jadwalMateri.every(item => selectedItems.includes(item.id!)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                  >
                    {jadwalMateri.length > 0 && jadwalMateri.every(item => selectedItems.includes(item.id!)) && (
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
                          aria-checked={selectedItems.includes(row.id!)}
                          role="checkbox"
                          onClick={() => handleSelectItem(row.id!)}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedItems.includes(row.id!) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                        >
                          {selectedItems.includes(row.id!) && (
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
                            {row.kelompok_besar_antara_id ? `Kelompok Besar Antara ${row.kelompok_besar_antara_id}` : '-'}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                            {row.dosen_names || row.dosen?.name || ''}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90`}>{row.materi}</td>
                          <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                            {row.kelompok_besar_antara_id ? `Kelompok Besar Antara ${row.kelompok_besar_antara_id}` : '-'}
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                        {row.jenis_baris === 'agenda' && !row.use_ruangan ? '-' : (row.ruangan?.nama || '')}
                      </td>
                    <td className="px-4 py-4 text-center whitespace-nowrap">
                      <button onClick={() => handleEditJadwal(idx)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition mr-2" title="Edit Jadwal">
                        <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                        <span className="hidden sm:inline">Edit</span>
                      </button>
                      <button onClick={() => { setSelectedDeleteIndex(idx); setShowDeleteModal(true); }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" title="Hapus Jadwal">
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

      {/* Bulk Delete Button */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-4">
          <button
            disabled={isBulkDeleting}
            onClick={handleBulkDelete}
            className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${isBulkDeleting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-theme-xs hover:bg-red-600'}`}
          >
            {isBulkDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedItems.length})`}
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
                     <select name="agenda" value={form.agenda} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500">
                       <option value="">Pilih Keterangan Agenda</option>
                       <option value="Persamaan Persepsi">Persamaan Persepsi</option>
                       <option value="Pleno">Pleno</option>
                     </select>
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
                        value={kelompokBesarAgendaOptions.map(k => ({ value: Number(k.id), label: k.label })).find(opt => opt.value === form.kelompokBesarAntara) || null}
                        onChange={opt => setForm(f => ({ ...f, kelompokBesarAntara: opt ? Number(opt.value) : null }))}
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
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Pengampu ({dosenList.length} dosen tersedia)
                  </label>
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
                      isMulti
                      options={dosenList.map(d => ({ value: d.id, label: `${d.name} (${d.nid})` }))}
                      isSearchable={true}
                      filterOption={(option, inputValue) => {
                        const label = option.label.toLowerCase();
                        const input = inputValue.toLowerCase();
                        return label.includes(input);
                      }}
                      noOptionsMessage={() => "Tidak ada dosen yang ditemukan"}
                      loadingMessage={() => "Mencari dosen..."}
                      value={form.pengampu.map(id => dosenList.find(d => d.id === id)).filter(Boolean).map(d => ({ value: d!.id, label: `${d!.name} (${d!.nid})` }))}
                      onChange={opts => {
                        const values = opts ? opts.map(opt => opt.value) : [];
                        setForm(f => ({ ...f, pengampu: values }));
                        setErrorForm(''); // Reset error when selection changes
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
                )}
                {form.jenisBaris === 'materi' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Materi</label>
                    <input type="text" name="materi" value={form.materi} onChange={handleFormChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                )}
                {form.jenisBaris === 'materi' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Kelompok Besar Antara</label>
                    {kelompokBesarAntaraOptions.length === 0 ? (
                      <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4">
                        <div className="flex items-center gap-2">
                          <svg className="w-5 h-5 text-orange-500" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                          </svg>
                          <span className="text-orange-700 dark:text-orange-300 text-sm font-medium">
                            Belum ada kelompok besar antara yang ditambahkan
                          </span>
                        </div>
                        <p className="text-orange-600 dark:text-orange-400 text-xs mt-2">
                          Silakan buat kelompok besar terlebih dahulu dengan menekan tombol "Kelola Kelompok"
                        </p>
                      </div>
                    ) : (
                      <Select
                        options={kelompokBesarAntaraOptions.map(k => ({ value: k.id, label: k.label }))}
                        value={kelompokBesarAntaraOptions.map(k => ({ value: k.id, label: k.label })).find(opt => opt.value === form.kelompokBesarAntara) || null}
                        onChange={opt => setForm(f => ({ ...f, kelompokBesarAntara: opt ? opt.value : null }))}
                        placeholder="Pilih Kelompok Besar Antara"
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

      {/* Placeholder untuk tabel/komponen lain */}
      {/* <div className="mt-8">Tabel/komponen lain di sini</div> */}

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
                              group.mahasiswa?.some(m => m.id === mahasiswa.id)
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
      </AnimatePresence>

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
                    {selectedItems.length}
                  </span> jadwal terpilih? Data yang dihapus tidak dapat dikembalikan.
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
    </div>
  );
} 
