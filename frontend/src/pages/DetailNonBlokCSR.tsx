import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import api, { handleApiError } from '../utils/api';
import { ChevronLeftIcon } from '../icons';
import Select from 'react-select';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPenToSquare, faTrash } from '@fortawesome/free-solid-svg-icons';
import { AnimatePresence, motion } from 'framer-motion';
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
}

interface AbsensiCSR {
  [npm: string]: {
    hadir: boolean;
  };
}

interface Mahasiswa {
  npm: string;
  nama: string;
  nim: string;
  gender: 'L' | 'P';
  ipk: number;
}

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
  
  // State untuk absensi
  const [showAbsensiModal, setShowAbsensiModal] = useState(false);
  const [selectedJadwalForAbsensi, setSelectedJadwalForAbsensi] = useState<JadwalCSR | null>(null);
  const [mahasiswaList, setMahasiswaList] = useState<Mahasiswa[]>([]);
  const [absensi, setAbsensi] = useState<AbsensiCSR>({});
  const [savingAbsensi, setSavingAbsensi] = useState(false);

  function hitungJamSelesai(jamMulai: string, jumlahSesi: number) {
    if (!jamMulai) return '';
    const [jamStr, menitStr] = jamMulai.split(/[.:]/);
    const jam = Number(jamStr);
    const menit = Number(menitStr);
    if (isNaN(jam) || isNaN(menit)) return '';
    const totalMenit = jam * 60 + menit + jumlahSesi * 50;
    const jamAkhir = Math.floor(totalMenit / 60).toString().padStart(2, '0');
    const menitAkhir = (totalMenit % 60).toString().padStart(2, '0');
    return `${jamAkhir}.${menitAkhir}`;
  }

  function handleFormChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = e.target;
    let newForm = { ...form, [name]: value };
    if (name === 'jenis_csr') {
      newForm.jumlah_sesi = value === 'reguler' ? 3 : value === 'responsi' ? 2 : 3;
      newForm.jam_selesai = hitungJamSelesai(newForm.jam_mulai, newForm.jumlah_sesi);
    }
    if (name === 'jam_mulai') {
      newForm.jam_selesai = hitungJamSelesai(value, newForm.jumlah_sesi);
    }
    // Validasi tanggal seperti di DetailBlok.tsx
    if (name === 'tanggal' && data && value) {
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
        jumlah_sesi: 3,
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
      console.error('Error saving jadwal:', error);
      console.error('Error details:', handleApiError(error, 'Menyimpan jadwal CSR'));
      setErrorBackend(handleApiError(error, 'Menyimpan jadwal CSR'));
    } finally {
      setIsSaving(false);
    }
  }

  function handleEditJadwal(idx: number) {
    const row = jadwalCSR[idx];
    
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
    
    const jamMulai = formatJamUntukDropdown(row.jam_mulai || '');
    const jamSelesai = formatJamUntukDropdown(row.jam_selesai || '');
    
    setForm({
      jenis_csr: row.jenis_csr,
      tanggal: formattedTanggal,
      jam_mulai: jamMulai,
      jumlah_sesi: row.jumlah_sesi,
      jam_selesai: jamSelesai,
      dosen_id: row.dosen_id,
      ruangan_id: row.ruangan_id,
      kelompok_kecil_id: row.kelompok_kecil_id,
      kategori_id: row.kategori_id,
      topik: row.topik,
    });
    
    // Set selectedKategoriValue untuk dropdown
    setSelectedKategoriValue(row.kategori_id ? `${row.kategori_id}_0` : null);
    
    // Set selectedKeahlian berdasarkan data yang ada
    if (row.kategori_id) {
      const kategoriData = kategoriList.find(k => k.id === row.kategori_id);
      if (kategoriData?.keahlian_required && kategoriData.keahlian_required.length > 0) {
        // Cari keahlian yang sesuai dengan dosen yang dipilih
        const selectedDosen = dosenList.find(d => d.id === row.dosen_id);
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
    
    setEditIndex(idx);
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
      console.error('Error deleting jadwal:', error);
      console.error('Error details:', handleApiError(error, 'Menghapus jadwal CSR'));
      setErrorBackend(handleApiError(error, 'Menghapus jadwal CSR'));
    }
  }
  
  // Fetch batch data untuk optimasi performa
  const fetchBatchData = async () => {
    if (!kode) return;
    
    setLoading(true);
    
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
      console.error('Error fetching batch data:', error);
      console.error('Error details:', handleApiError(error, 'Memuat data batch'));
      setError(handleApiError(error, 'Memuat data batch'));
    } finally {
      setLoading(false);
    }
  };

  // Fetch batch data on component mount
  useEffect(() => {
    fetchBatchData();
  }, [kode]);

  // Effect untuk memastikan selectedKeahlian diset dengan benar saat edit modal
  useEffect(() => {
    if (showModal && editIndex !== null && form.dosen_id && dosenList.length > 0) {
      const selectedDosen = dosenList.find(d => d.id === form.dosen_id);
      if (selectedDosen && selectedDosen.keahlian && !selectedKeahlian) {
        setSelectedKeahlian(selectedDosen.keahlian);
      }
    }
  }, [showModal, editIndex, form.dosen_id, dosenList, selectedKeahlian]);

  // Fungsi untuk membuka modal absensi
  const handleOpenAbsensi = async (jadwal: JadwalCSR) => {
    setSelectedJadwalForAbsensi(jadwal);
    setShowAbsensiModal(true);
    setAbsensi({});
    
    try {
      // Fetch mahasiswa berdasarkan kelompok kecil
      if (jadwal.kelompok_kecil_id) {
        const response = await api.get(`/kelompok-kecil/${jadwal.kelompok_kecil_id}/mahasiswa`);
        const mahasiswa = response.data.map((m: any) => ({
          npm: m.nim,
          nama: m.name || m.nama || '',
          nim: m.nim || '',
          gender: m.gender || 'L',
          ipk: m.ipk || 0.0
        }));
        setMahasiswaList(mahasiswa);
        
        // Fetch data absensi yang sudah ada
        const absensiResponse = await api.get(`/csr/${kode}/jadwal/${jadwal.id}/absensi`);
        const existingAbsensi: AbsensiCSR = {};
        
        // Handle response yang berbentuk object (keyBy) atau array
        if (absensiResponse.data.absensi) {
          if (Array.isArray(absensiResponse.data.absensi)) {
            // Jika response berupa array
            absensiResponse.data.absensi.forEach((absen: any) => {
              existingAbsensi[absen.mahasiswa_npm] = {
                hadir: absen.hadir || false
              };
            });
          } else {
            // Jika response berupa object (keyBy)
            Object.keys(absensiResponse.data.absensi).forEach((npm) => {
              const absen = absensiResponse.data.absensi[npm];
              existingAbsensi[npm] = {
                hadir: absen.hadir || false
              };
            });
          }
        }
        setAbsensi(existingAbsensi);
      }
    } catch (error: any) {
      console.error('Error fetching mahasiswa/absensi:', error);
      console.error('Error details:', handleApiError(error, 'Memuat data mahasiswa/absensi'));
      setError(handleApiError(error, 'Memuat data mahasiswa/absensi'));
    }
  };

  // Fungsi untuk handle perubahan absensi
  const handleAbsensiChange = (npm: string, hadir: boolean) => {
    setAbsensi((prev) => ({
      ...prev,
      [npm]: {
        hadir: hadir,
      },
    }));
  };

  // Fungsi untuk menyimpan absensi
  const handleSaveAbsensi = async () => {
    if (!selectedJadwalForAbsensi) return;
    
    setSavingAbsensi(true);
    try {
      const payload = {
        absensi: mahasiswaList.map(m => ({
          mahasiswa_npm: m.npm,
          hadir: absensi[m.npm]?.hadir || false,
        })),
      };
      
      await api.post(`/csr/${kode}/jadwal/${selectedJadwalForAbsensi.id}/absensi`, payload);
      setShowAbsensiModal(false);
      setSelectedJadwalForAbsensi(null);
      setMahasiswaList([]);
      setAbsensi({});
    } catch (error: any) {
      console.error('Error saving absensi:', error);
      console.error('Error details:', handleApiError(error, 'Menyimpan absensi'));
      setError(handleApiError(error, 'Menyimpan absensi'));
    } finally {
      setSavingAbsensi(false);
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
          <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll">
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
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
                  <tr key={`skeleton-csr-${index}`} className={index % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>
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
          onClick={() => navigate(-1)}
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

      {/* Placeholder untuk tabel/komponen lain */}
      {/* <div className="mt-8">Tabel/komponen lain di sini</div> */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-bold text-gray-800 dark:text-white">Jadwal CSR</h2>
          <button
            onClick={() => {
              setForm({
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
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div className="max-w-full overflow-x-auto hide-scroll" >
            <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
              <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
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
                {jadwalCSR.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-6 text-gray-400">Tidak ada data CSR</td>
                  </tr>
                ) : (
                  jadwalCSR.map((row, i) => (
                    <tr key={row.id || i} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>
                      <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{i + 1}</td>
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
                      <td className="px-6 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">{row.kategori?.nama || '-'}</td>
                      <td className="px-4 py-4 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-2">
                          <button onClick={() => handleOpenAbsensi(row)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-500 hover:text-green-700 dark:hover:text-green-300 transition" title="Absensi">
                            <svg className="w-4 h-4 sm:w-5 sm:h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            <span className="hidden sm:inline">Absensi</span>
                          </button>
                          <button onClick={() => handleEditJadwal(i)} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition" title="Edit Jadwal">
                            <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500" />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button onClick={() => { setSelectedDeleteIndex(i); setShowDeleteModal(true); }} className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition" title="Hapus Jadwal">
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Topik/Mata Kuliah</label>
                <input 
                  type="text" 
                  name="topik" 
                  value={form.topik} 
                  onChange={handleFormChange}
                  placeholder="Masukkan topik atau mata kuliah"
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
                />
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
                        label: `${d.name} (${d.nid}) - ${d.keahlian}` 
                      }))}
                      value={filteredDosen.map(d => ({ 
                        value: d.id, 
                        label: `${d.name} (${d.nid}) - ${d.keahlian}` 
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
                    options={getRuanganOptions(ruanganList)}
                    value={getRuanganOptions(ruanganList).find(opt => opt.value === form.ruangan_id) || null}
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
                  className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed" 
                  disabled={!form.jenis_csr || !form.tanggal || !form.jam_mulai || !form.jam_selesai || !form.dosen_id || !form.ruangan_id || !form.kelompok_kecil_id || !form.kategori_id || !form.topik || isSaving}
                >
                  {isSaving ? 'Menyimpan...' : (editIndex !== null ? 'Simpan' : 'Tambah Jadwal')}
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

      {/* Modal Absensi */}
      {showAbsensiModal && selectedJadwalForAbsensi && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
            onClick={() => setShowAbsensiModal(false)}
          />
                      <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-50 max-h-[85vh] overflow-hidden"
            >
            {/* Enhanced Header */}
            <div className="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/20 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">Absensi CSR - {selectedJadwalForAbsensi.jenis_csr === 'reguler' ? 'CSR Reguler' : 'CSR Responsi'}</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    {new Date(selectedJadwalForAbsensi.tanggal).toLocaleDateString('id-ID', { 
                      weekday: 'long', 
                      year: 'numeric', 
                      month: 'long', 
                      day: 'numeric' 
                    })} • {selectedJadwalForAbsensi.jam_mulai?.replace('.', ':')}–{selectedJadwalForAbsensi.jam_selesai?.replace('.', ':')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowAbsensiModal(false)}
                className="p-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

                          {/* Content */}
              <div className="flex h-[calc(85vh-280px)]">
                {/* Left Panel - Session Info */}
                <div className="w-1/3 pr-4 overflow-y-auto hide-scroll">
                                      <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 shadow-sm mt-8">
                    <div className="flex items-center space-x-2 mb-6">
                      <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                        <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      </div>
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Informasi Sesi</h3>
                    </div>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Pengampu</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedJadwalForAbsensi.dosen?.name || '-'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Ruangan</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedJadwalForAbsensi.ruangan?.nama || '-'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Kelompok</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedJadwalForAbsensi.kelompok_kecil?.nama_kelompok ? `Kelompok ${selectedJadwalForAbsensi.kelompok_kecil.nama_kelompok}` : '-'}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">Topik</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">
                        {selectedJadwalForAbsensi.topik || '-'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

                              {/* Right Panel - Student List */}
                <div className="w-2/3 pl-4 overflow-y-auto hide-scroll">
                  <div className="flex items-center space-x-2 mb-6 mt-8">
                    <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                      Daftar Mahasiswa ({mahasiswaList.length} orang)
                    </h3>
                  </div>
                
                <div className="space-y-3">
                  {mahasiswaList.length === 0 ? (
                    <div className="text-center py-12">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 font-medium">
                        Tidak ada mahasiswa dalam kelompok ini
                      </p>
                      <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">
                        Silakan tambahkan mahasiswa ke kelompok terlebih dahulu
                      </p>
                    </div>
                  ) : (
                                         mahasiswaList.map((mahasiswa, index) => (
                       <div
                         key={mahasiswa.npm}
                         className={`bg-white dark:bg-gray-800 rounded-lg p-3 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${
                           absensi[mahasiswa.npm]?.hadir ? 'bg-brand-50 dark:bg-brand-900/20' : ''
                         }`}
                         onClick={() => handleAbsensiChange(mahasiswa.npm, !absensi[mahasiswa.npm]?.hadir)}
                       >
                         <div className="flex items-center justify-between">
                           <div className="flex items-center space-x-3">
                             <div className="w-6 h-6 bg-brand-100 dark:bg-brand-900/20 rounded-md flex items-center justify-center">
                               <span className="text-xs font-semibold text-brand-600 dark:text-brand-400">
                                 {index + 1}
                               </span>
                             </div>
                             <div>
                               <div className="flex items-center space-x-2 mb-0.5">
                                 <h4 className="font-semibold text-gray-800 dark:text-white text-sm">{mahasiswa.nama}</h4>
                                 <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${
                                   mahasiswa.gender === 'L' 
                                     ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300' 
                                     : 'bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300'
                                 }`}>
                                   {mahasiswa.gender === 'L' ? '👨 Laki-laki' : '👩 Perempuan'}
                                 </span>
                               </div>
                               <div className="flex items-center space-x-3 text-xs text-gray-500 dark:text-gray-400">
                                 <span className="font-mono">{mahasiswa.nim}</span>
                                 <span className="font-medium">IPK: {mahasiswa.ipk.toFixed(2)}</span>
                               </div>
                             </div>
                           </div>
                           
                           {/* Checkbox */}
                           <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                             absensi[mahasiswa.npm]?.hadir 
                               ? 'bg-brand-500 border-brand-500' 
                               : 'border-gray-300 dark:border-gray-600'
                           }`}>
                             {absensi[mahasiswa.npm]?.hadir && (
                               <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                 <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                               </svg>
                             )}
                           </div>
                         </div>
                       </div>
                     ))
                  )}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
              <div className="flex justify-end gap-3 pt-4 mt-4">
                <button 
                  onClick={() => setShowAbsensiModal(false)} 
                  className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                >
                  Batal
                </button>
                <button 
                  onClick={handleSaveAbsensi} 
                  disabled={savingAbsensi || mahasiswaList.length === 0}
                  className="px-6 py-3 rounded-xl bg-brand-500 text-white text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2" 
                >
                  {savingAbsensi && (
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                  )}
                  {savingAbsensi ? 'Menyimpan...' : 'Simpan Absensi'}
                </button>
              </div>
          </motion.div>
        </div>
      )}
    </div>
  );
} 
