import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api, { handleApiError } from '../utils/api';
import { ChevronLeftIcon } from '../icons';
import { AnimatePresence, motion } from 'framer-motion';
import Select from 'react-select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import { getRuanganOptions } from '../utils/ruanganHelper';

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
  ruangan_id: number | null;
  kelompok_besar_id?: number | null;
  use_ruangan?: boolean;
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
  
  // State untuk dropdown options
  const [dosenList, setDosenList] = useState<DosenOption[]>([]);
  const [ruanganList, setRuanganList] = useState<RuanganOption[]>([]);
  const [jamOptions, setJamOptions] = useState<string[]>([]);
  const [kelompokBesarAgendaOptions, setKelompokBesarAgendaOptions] = useState<{id: string | number, label: string, jumlah_mahasiswa: number}[]>([]);
  const [kelompokBesarMateriOptions, setKelompokBesarMateriOptions] = useState<{id: string | number, label: string, jumlah_mahasiswa: number}[]>([]);

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

  // Fetch kelompok besar options untuk agenda khusus
  const fetchKelompokBesarAgendaOptions = async () => {
    if (!data) return;
    try {
      const res = await api.get(`/non-blok-non-csr/kelompok-besar?semester=${data.semester}`);
      
      setKelompokBesarAgendaOptions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching kelompok besar agenda:', err);
    }
  };

  // Fetch kelompok besar options untuk materi
  const fetchKelompokBesarMateriOptions = async () => {
    if (!data) return;
    try {
      const res = await api.get(`/non-blok-non-csr/kelompok-besar?semester=${data.semester}`);
      
      setKelompokBesarMateriOptions(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('Error fetching kelompok besar materi:', err);
    }
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
      console.error('Error fetching batch data:', error);
      console.error('Error details:', handleApiError(error, 'Memuat data batch'));
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
      console.error('Error deleting jadwal:', error);
      console.error('Error details:', handleApiError(error, 'Menghapus jadwal'));
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
      console.error('Error saving jadwal:', error);
      console.error('Error details:', handleApiError(error, 'Menyimpan jadwal'));
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

  // Fetch kelompok besar options saat modal materi dibuka
  useEffect(() => {
    if (showModal && form.jenisBaris === 'materi') {
      fetchKelompokBesarMateriOptions();
    }
  }, [showModal, form.jenisBaris]);

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
          onClick={() => navigate(-1)}
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

      {/* Tabel Jadwal Materi */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] mt-8">
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
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Kelompok</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Lokasi</th>
                <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {jadwalMateri.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-6 text-gray-400">Tidak ada data jadwal</td>
                </tr>
              ) : (
                jadwalMateri
                  .slice()
                .sort((a, b) => {
                    const dateA = new Date(a.tanggal);
                    const dateB = new Date(b.tanggal);
                  return dateA.getTime() - dateB.getTime();
                })
                .map((row, idx) => (
                    <tr key={row.id} className={row.jenis_baris === 'agenda' ? 'bg-yellow-50 dark:bg-yellow-900/20' : (idx % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : '')}>
                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{idx + 1}</td>
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

      {/* Placeholder untuk tabel/komponen lain */}
      {/* <div className="mt-8">Tabel/komponen lain di sini</div> */}
    </div>
  );
} 
