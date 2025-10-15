import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { motion, AnimatePresence } from "framer-motion";
import {
  faArrowLeft,
  faDownload,
  faCalendar,
  faClock,
  faUser,
  faMapMarkerAlt,
  faBookOpen,
  faFileAlt,
  faGraduationCap,
  faFlask,
  faNewspaper,
  faUsers,
  faPlus,
  faEdit,
  faTrash,
  faSearch,
  faTimes,
  faUpload,
  faFileUpload,
} from "@fortawesome/free-solid-svg-icons";
import api, { handleApiError } from "../utils/api";

interface MataKuliah {
  kode: string;
  nama: string;
  semester: string;
  periode: string;
  jenis: "Blok" | "Non Blok";
  tipe_non_block?: "CSR" | "Non-CSR";
  kurikulum: number;
  tanggal_mulai: string;
  tanggal_akhir: string;
  blok?: number;
  durasi_minggu: number;
  keahlian_required: string[];
  peran_dalam_kurikulum: string[];
  rps_file?: string;
}

interface DosenPermissions {
  permissions: Array<{
    tipe_peran: string;
    peran_kurikulum: string;
    blok?: number;
    semester?: string;
  }>;
  can_upload_rps: boolean;
  can_upload_materi: boolean;
  roles: string[];
}

interface JadwalKuliahBesar {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string;
  topik: string;
  dosen_name: string;
  kelompok_name: string;
  ruangan_name: string;
  status_konfirmasi: string;
  jumlah_sesi?: number;
}

interface JadwalPBL {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string;
  topik: string;
  dosen_name: string;
  kelompok_name: string;
  ruangan_name: string;
  status_konfirmasi: string;
  x50?: number;
  tipe_pbl?: string;
  kelompok?: string;
  modul?: string;
  pengampu?: string;
  ruangan?: string;
}

interface JadwalPraktikum {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string;
  topik: string;
  dosen_name: string;
  kelompok_name: string;
  ruangan_name: string;
  status_konfirmasi: string;
  kelas_praktikum?: string;
  jumlah_sesi?: number;
  dosen?: Array<{
    id: number;
    name: string;
  }>;
  ruangan?: {
    id: number;
    nama: string;
  };
}

interface JadwalJurnalReading {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  topik: string;
  dosen_name: string;
  kelompok_name: string;
  ruangan_name: string;
  status_konfirmasi: string;
  jumlah_sesi?: number;
  dosen?: {
    id: number;
    name: string;
  };
  kelompok_kecil?: {
    nama: string;
  };
  kelompok_kecil_antara?: {
    nama_kelompok: string;
  };
  ruangan?: {
    id: number;
    nama: string;
  };
}

interface JadwalCSR {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string;
  topik: string;
  dosen_name: string;
  kelompok_name: string;
  ruangan_name: string;
  status_konfirmasi: string;
  jumlah_sesi?: number;
  kategori?: {
    nama: string;
  };
  jenis_csr?: string;
  pengampu?: string;
  dosen?: {
    id: number;
    name: string;
  };
  kelompok_kecil?: {
    nama: string;
  };
  ruangan?: {
    id: number;
    nama: string;
  };
}

interface JadwalNonBlokNonCSR {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string;
  topik: string;
  dosen_name: string;
  kelompok_name: string;
  ruangan_name: string;
  status_konfirmasi: string;
  jumlah_sesi?: number;
}

interface Materi {
  id: number;
  filename: string;
  judul: string;
  file_type: string;
  file_size: number;
  upload_date: string;
}

export default function MataKuliahDosenDetail() {
  const { kode } = useParams<{ kode: string }>();
  const navigate = useNavigate();
  
  const [mataKuliah, setMataKuliah] = useState<MataKuliah | null>(null);
  const [materi, setMateri] = useState<Materi[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dosenPermissions, setDosenPermissions] = useState<DosenPermissions | null>(null);
  
  // State untuk materi
  const [materiSearch, setMateriSearch] = useState("");
  const [materiLimit, setMateriLimit] = useState(5);
  const [showAllMateri, setShowAllMateri] = useState(false);
  const [showMateriModal, setShowMateriModal] = useState(false);
  const [modalMateriSearch, setModalMateriSearch] = useState("");
  
  // State untuk upload
  const [showUploadRpsModal, setShowUploadRpsModal] = useState(false);
  const [showUploadMateriModal, setShowUploadMateriModal] = useState(false);
  const [uploadingRps, setUploadingRps] = useState(false);
  const [uploadingMateri, setUploadingMateri] = useState(false);
  const [rpsFile, setRpsFile] = useState<File | null>(null);
  const [materiFile, setMateriFile] = useState<File | null>(null);
  const [materiJudul, setMateriJudul] = useState("");
  const [uploadMessage, setUploadMessage] = useState<{type: 'success' | 'error', message: string} | null>(null);
  
  // Jadwal states
  const [jadwalKuliahBesar, setJadwalKuliahBesar] = useState<JadwalKuliahBesar[]>([]);
  const [jadwalPBL, setJadwalPBL] = useState<JadwalPBL[]>([]);
  const [jadwalPraktikum, setJadwalPraktikum] = useState<JadwalPraktikum[]>([]);
  const [jadwalJurnalReading, setJadwalJurnalReading] = useState<JadwalJurnalReading[]>([]);
  const [jadwalCSR, setJadwalCSR] = useState<JadwalCSR[]>([]);
  const [jadwalNonBlokNonCSR, setJadwalNonBlokNonCSR] = useState<JadwalNonBlokNonCSR[]>([]);

  useEffect(() => {
    if (kode) {
      fetchMataKuliahDetail();
      fetchMateri();
      fetchDosenPermissions();
    }
  }, [kode]);

  useEffect(() => {
    if (mataKuliah && kode) {
      fetchJadwal();
    }
  }, [mataKuliah, kode]);

  const fetchMataKuliahDetail = async () => {
    try {
      const response = await api.get(`/mata-kuliah/${kode}`);
      setMataKuliah(response.data);
    } catch (error: any) {
      setError("Gagal memuat detail mata kuliah");
      console.error("Error fetching mata kuliah detail:", error);
    }
  };

  const fetchMateri = async () => {
    try {
      const response = await api.get(`/mata-kuliah/${kode}/materi`);
      setMateri(response.data.data || []);
    } catch (error: any) {
      console.error("Error fetching materi:", error);
    }
  };

  const fetchDosenPermissions = async () => {
    try {
      const response = await api.get(`/mata-kuliah/${kode}/dosen-permissions`);
      setDosenPermissions(response.data);
    } catch (error: any) {
      console.error("Error fetching dosen permissions:", error);
    }
  };

  const fetchJadwal = async () => {
    try {
      const response = await api.get(`/mata-kuliah-dosen/${kode}/jadwal`);
      const jadwalData = response.data;
      
      // Set jadwal berdasarkan response
      setJadwalKuliahBesar(jadwalData.kuliah_besar || []);
      
      if (mataKuliah?.jenis === "Blok") {
        setJadwalPBL(jadwalData.pbl || []);
        setJadwalPraktikum(jadwalData.praktikum || []);
        setJadwalJurnalReading(jadwalData.jurnal_reading || []);
      } else if (mataKuliah?.tipe_non_block === "CSR") {
        setJadwalCSR(jadwalData.csr || []);
      } else if (mataKuliah?.tipe_non_block === "Non-CSR") {
        setJadwalNonBlokNonCSR(jadwalData.non_blok_non_csr || []);
      }
    } catch (error: any) {
      console.error("Error fetching jadwal:", error);
    } finally {
      setLoading(false);
    }
  };

  const getCurrentUserId = () => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    return user.id;
  };

  const downloadRPS = async () => {
    try {
      const response = await api.get(`/mata-kuliah/${kode}/download-rps`, {
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${kode}_RPS.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading RPS:", error);
      alert("Gagal mengunduh RPS");
    }
  };

  const downloadMateri = async (filename: string, judul: string) => {
    try {
      const response = await api.get(`/mata-kuliah/${kode}/download-materi`, {
        params: { filename },
        responseType: 'blob'
      });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${judul}.${filename.split('.').pop()}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error: any) {
      console.error("Error downloading materi:", error);
      alert("Gagal mengunduh materi");
    }
  };

  const uploadRps = async () => {
    if (!rpsFile || !kode) return;

    setUploadingRps(true);
    try {
      const formData = new FormData();
      formData.append('rps_file', rpsFile);
      formData.append('kode', kode);

      const response = await api.post('/mata-kuliah/upload-rps', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      const successMessage = mataKuliah?.rps_file 
        ? 'RPS berhasil diganti' 
        : 'RPS berhasil diupload';
      
      setUploadMessage({type: 'success', message: successMessage});
      setShowUploadRpsModal(false);
      setRpsFile(null);
      // Refresh data
      fetchMataKuliahDetail();
      
      // Auto hide message after 3 seconds
      setTimeout(() => setUploadMessage(null), 3000);
    } catch (error: any) {
      console.error("Error uploading RPS:", error);
      const errorMessage = error.response?.data?.error || 'Gagal mengupload RPS';
      setUploadMessage({type: 'error', message: errorMessage});
      setTimeout(() => setUploadMessage(null), 5000);
    } finally {
      setUploadingRps(false);
    }
  };

  const uploadMateri = async () => {
    if (!materiFile || !materiJudul || !kode) return;

    setUploadingMateri(true);
    try {
      const formData = new FormData();
      formData.append('materi_file', materiFile);
      formData.append('kode', kode);
      formData.append('judul', materiJudul);

      const response = await api.post('/mata-kuliah/upload-materi', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setUploadMessage({type: 'success', message: response.data.message || 'Materi berhasil diupload'});
      setShowUploadMateriModal(false);
      setMateriFile(null);
      setMateriJudul("");
      // Refresh data
      fetchMateri();
      
      // Auto hide message after 3 seconds
      setTimeout(() => setUploadMessage(null), 3000);
    } catch (error: any) {
      console.error("Error uploading materi:", error);
      const errorMessage = error.response?.data?.error || 'Gagal mengupload materi';
      setUploadMessage({type: 'error', message: errorMessage});
      setTimeout(() => setUploadMessage(null), 5000);
    } finally {
      setUploadingMateri(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  // Filter dan limit materi
  const filteredMateri = materi.filter(m => 
    m.judul.toLowerCase().includes(materiSearch.toLowerCase())
  );

  const displayedMateri = showAllMateri ? filteredMateri : filteredMateri.slice(0, materiLimit);

  // Filter untuk modal
  const modalFilteredMateri = materi.filter(m => 
    m.judul.toLowerCase().includes(modalMateriSearch.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-6 w-20 bg-gray-300 dark:bg-gray-600 rounded mb-4 animate-pulse"></div>
            <div className="h-8 w-32 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
            <div className="h-4 w-64 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
          </div>

          {/* Main Info Card Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <div className="h-3 w-24 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
                  <div className="h-6 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Additional Info Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="h-3 w-20 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
                <div className="h-5 w-28 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
              </div>
            ))}
          </div>

          {/* Content Cards Skeleton */}
          <div className="space-y-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                  <div className="h-6 w-40 bg-gray-300 dark:bg-gray-600 rounded mb-4 animate-pulse"></div>
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, j) => (
                      <div key={j} className="h-4 w-full bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            {/* Materi Section Skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 w-48 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                <div className="h-10 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
              </div>
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex-1">
                      <div className="h-4 w-48 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse"></div>
                      <div className="h-3 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                    </div>
                    <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>

            {/* Jadwal Section Skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse"></div>
                  <div className="h-6 w-40 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                </div>
              </div>
              <div className="p-6">
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="grid grid-cols-8 gap-4">
                      {Array.from({ length: 8 }).map((_, j) => (
                        <div key={j} className="h-4 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error || !mataKuliah) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error || "Mata kuliah tidak ditemukan"}</p>
          <button
            onClick={() => navigate("/mata-kuliah-dosen")}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Toast Notification */}
      <AnimatePresence>
        {uploadMessage && (
          <motion.div
            initial={{ opacity: 0, y: -50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -50, scale: 0.95 }}
            transition={{ duration: 0.3 }}
            className={`fixed top-4 right-4 z-[100000] max-w-sm w-full mx-4 ${
              uploadMessage.type === 'success' 
                ? 'bg-green-500 text-white' 
                : 'bg-red-500 text-white'
            } rounded-lg shadow-lg p-4 flex items-center gap-3`}
          >
            <div className="flex-shrink-0">
              {uploadMessage.type === 'success' ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">{uploadMessage.message}</p>
            </div>
            <button
              onClick={() => setUploadMessage(null)}
              className="flex-shrink-0 p-1 hover:bg-white/20 rounded transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/mata-kuliah-dosen")}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition mb-4"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
            Kembali ke Daftar Mata Kuliah
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            {mataKuliah.nama}
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Informasi lengkap mata kuliah untuk dosen
          </p>
        </div>

        {/* Card Info Utama */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <div className="mb-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase">Kode Mata Kuliah</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{mataKuliah.kode}</div>
            </div>
            <div>
              <div className="mb-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase">Nama Mata Kuliah</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">{mataKuliah.nama}</div>
            </div>
            <div>
              <div className="mb-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase">Semester</div>
              <div className="text-base text-gray-900 dark:text-white">Semester {mataKuliah.semester}</div>
            </div>
            <div>
              <div className="mb-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase">Periode</div>
              <div className="text-base text-gray-900 dark:text-white">{mataKuliah.periode}</div>
            </div>
            <div>
              <div className="mb-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase">Jenis</div>
              <div className="text-base text-gray-900 dark:text-white">{mataKuliah.jenis}</div>
            </div>
            {mataKuliah.blok && (
              <div>
                <div className="mb-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase">Blok ke-</div>
                <div className="text-base text-gray-900 dark:text-white">{mataKuliah.blok}</div>
              </div>
            )}
          </div>
        </div>

        {/* Section Info Tambahan */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase">Tanggal Mulai</div>
            <div className="text-base text-gray-900 dark:text-white">{formatDate(mataKuliah.tanggal_mulai)}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase">Tanggal Akhir</div>
            <div className="text-base text-gray-900 dark:text-white">{formatDate(mataKuliah.tanggal_akhir)}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="mb-2 text-gray-500 dark:text-gray-400 text-xs font-semibold uppercase">Durasi Minggu</div>
            <div className="text-base text-gray-900 dark:text-white">{mataKuliah.durasi_minggu} minggu</div>
          </div>
        </div>

        <div className="space-y-8">
          {/* Informasi Tambahan */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Keahlian Required */}
            {mataKuliah.keahlian_required && mataKuliah.keahlian_required.length > 0 && (
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                  Keahlian yang Dibutuhkan
                </h2>
                <div className="flex flex-wrap gap-2">
                  {mataKuliah.keahlian_required.map((keahlian, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300"
                    >
                      {keahlian}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Download RPS */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">
                RPS (Rencana Pembelajaran Semester)
              </h2>
            
              {mataKuliah.rps_file ? (
                <>
                  <button
                    onClick={downloadRPS}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors mb-3 shadow-sm"
                  >
                    <FontAwesomeIcon icon={faDownload} className="w-4 h-4" />
                    Download RPS
                  </button>
                  
                  {/* Upload/Replace RPS Button - Only for Koordinator */}
                  {dosenPermissions?.can_upload_rps && (
                    <button
                      onClick={() => setShowUploadRpsModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-xl hover:bg-orange-600 transition-colors shadow-sm"
                    >
                      <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                      Ganti RPS
                    </button>
                  )}
                </>
              ) : (
                <>
                  <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                    RPS belum tersedia
                  </p>
                  
                  {/* Upload RPS Button - Only for Koordinator */}
                  {dosenPermissions?.can_upload_rps && (
                    <button
                      onClick={() => setShowUploadRpsModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors shadow-sm"
                    >
                      <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                      Upload RPS
                    </button>
                  )}
                </>
              )}
          </div>
        </div>

          {/* Download Materi - Full Width */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                Materi Pembelajaran
                {materi.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({materi.length} file)
                  </span>
                )}
              </h2>
              
              {/* Upload Materi Button - Only for Koordinator or Tim Blok */}
              {dosenPermissions?.can_upload_materi && (
                <button
                  onClick={() => setShowUploadMateriModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-green-500 text-white rounded-xl hover:bg-green-600 transition-colors shadow-sm"
                >
                  <FontAwesomeIcon icon={faFileUpload} className="w-4 h-4" />
                  Upload Materi
                </button>
              )}
            </div>
          
            {materi.length > 0 ? (
              <div>
                {/* Search Bar */}
                <div className="mb-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari materi..."
                      value={materiSearch}
                      onChange={(e) => setMateriSearch(e.target.value)}
                      className="w-full px-4 py-3 pl-10 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                    />
                    <FontAwesomeIcon 
                      icon={faSearch} 
                      className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" 
                    />
                  </div>
                </div>

                {/* Materi List */}
                <div className="space-y-3">
                  {displayedMateri.map((m) => (
                    <div
                      key={m.id}
                      className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 dark:text-white">{m.judul}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {m.file_type.toUpperCase()} • {formatFileSize(m.file_size)}
                        </p>
                      </div>
                      <button
                        onClick={() => downloadMateri(m.filename, m.judul)}
                        className="ml-3 p-2 text-blue-500 hover:text-blue-600 transition-colors"
                        title="Download materi"
                      >
                        <FontAwesomeIcon icon={faDownload} className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>

                {/* Show More/Less Button */}
                {filteredMateri.length > materiLimit && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={() => setShowMateriModal(true)}
                      className="px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors shadow-sm"
                    >
                      Lihat Semua Materi ({filteredMateri.length} file)
                    </button>
                  </div>
                )}

                {/* No Results */}
                {filteredMateri.length === 0 && materiSearch && (
                  <div className="text-center py-8">
                    <p className="text-gray-500 dark:text-gray-400">
                      Tidak ada materi yang cocok dengan pencarian "{materiSearch}"
                    </p>
                    <button
                      onClick={() => setMateriSearch("")}
                      className="mt-2 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                    >
                      Hapus filter
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-500 dark:text-gray-400 text-center py-4">
                Materi belum tersedia
              </p>
            )}
          </div>

        {/* Jadwal */}
        <div className="space-y-6">
        {/* Jadwal Kuliah Besar */}
        <div className="mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-2xl bg-blue-500 flex items-center justify-center shadow-lg">
                  <FontAwesomeIcon icon={faGraduationCap} className="text-white text-sm" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {mataKuliah.jenis === "Non Blok" && mataKuliah.tipe_non_block === "Non-CSR" 
                    ? "Jadwal Kuliah" 
                    : "Jadwal Kuliah Besar"}
                </h3>
              </div>
            </div>

            <div className="overflow-x-auto hide-scroll">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">HARI/TANGGAL</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PUKUL</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">WAKTU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">MATERI</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PENGAMPU</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TOPIK</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">KELOMPOK</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">LOKASI</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {(() => {
                    // Tentukan data yang akan ditampilkan berdasarkan tipe mata kuliah
                    const currentData = mataKuliah.jenis === "Non Blok" && mataKuliah.tipe_non_block === "Non-CSR" 
                      ? jadwalNonBlokNonCSR 
                      : jadwalKuliahBesar;
                    
                    return currentData.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="px-6 py-8 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                              <FontAwesomeIcon icon={faGraduationCap} className="w-8 h-8 text-gray-400" />
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 text-sm">
                              {mataKuliah.jenis === "Non Blok" && mataKuliah.tipe_non_block === "Non-CSR" 
                                ? "Tidak ada jadwal kuliah" 
                                : "Tidak ada jadwal kuliah besar"}
                            </p>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      currentData.map((jadwal, index) => (
                        <tr key={jadwal.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatDate(jadwal.tanggal)}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.jam_mulai} - {jadwal.jam_selesai}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {mataKuliah.jenis === "Non Blok" && mataKuliah.tipe_non_block === "Non-CSR" 
                              ? "2 x 50 menit" 
                              : `${jadwal.jumlah_sesi || 1} x 50 menit`}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{jadwal.materi}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{jadwal.dosen_name}</td>
                          <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{jadwal.topik}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.kelompok_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.ruangan_name}</td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`px-2 py-1 rounded-full text-xs ${
                              jadwal.status_konfirmasi === 'confirmed' 
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                            }`}>
                              {jadwal.status_konfirmasi === 'confirmed' ? 'Dikonfirmasi' : 'Menunggu'}
                            </span>
                          </td>
                        </tr>
                      ))
                    );
                  })()}
                </tbody>
              </table>
            </div>
          </div>
        </div>

          {/* Jadwal PBL - Hanya untuk mata kuliah Blok */}
          {mataKuliah.jenis === "Blok" && (
            <div className="mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-2xl bg-green-500 flex items-center justify-center shadow-lg">
                      <FontAwesomeIcon icon={faBookOpen} className="text-white text-sm" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Jadwal PBL (Problem Based Learning)</h3>
                  </div>
                </div>

                <div className="overflow-x-auto hide-scroll">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">HARI/TANGGAL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PUKUL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">WAKTU</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TIPE PBL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">KELOMPOK</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">MODUL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PENGAMPU</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">RUANGAN</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {jadwalPBL.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-8 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                <FontAwesomeIcon icon={faBookOpen} className="w-8 h-8 text-gray-400" />
                              </div>
                              <p className="text-gray-500 dark:text-gray-400 text-sm">Tidak ada jadwal PBL</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        jadwalPBL.map((jadwal) => (
                          <tr key={jadwal.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatDate(jadwal.tanggal)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.jam_mulai} - {jadwal.jam_selesai}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.x50 ? `${jadwal.x50} x 50 menit` : 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.tipe_pbl || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.kelompok}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.modul || jadwal.topik || 'N/A'}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{jadwal.pengampu || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.ruangan || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                jadwal.status_konfirmasi === 'confirmed' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                              }`}>
                                {jadwal.status_konfirmasi === 'confirmed' ? 'Dikonfirmasi' : 'Menunggu'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Jadwal Praktikum - Hanya untuk mata kuliah Blok */}
          {mataKuliah.jenis === "Blok" && (
            <div className="mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-2xl bg-purple-500 flex items-center justify-center shadow-lg">
                      <FontAwesomeIcon icon={faFlask} className="text-white text-sm" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Jadwal Praktikum</h3>
                  </div>
                </div>

                <div className="overflow-x-auto hide-scroll">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">HARI/TANGGAL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PUKUL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">KELAS</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">WAKTU</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">MATERI</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TOPIK</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PENGAMPU</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">LOKASI</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {jadwalPraktikum.length === 0 ? (
                        <tr>
                          <td colSpan={9} className="px-6 py-8 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                <FontAwesomeIcon icon={faFlask} className="w-8 h-8 text-gray-400" />
                              </div>
                              <p className="text-gray-500 dark:text-gray-400 text-sm">Tidak ada jadwal praktikum</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        jadwalPraktikum.map((jadwal) => (
                          <tr key={jadwal.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatDate(jadwal.tanggal)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.jam_mulai} - {jadwal.jam_selesai}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.kelas_praktikum}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{`${jadwal.jumlah_sesi || 1} x 50 menit`}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{jadwal.materi}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{jadwal.topik}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{jadwal.dosen?.map((d: any) => d.name).join(', ') || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.ruangan?.nama || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                jadwal.status_konfirmasi === 'confirmed' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                              }`}>
                                {jadwal.status_konfirmasi === 'confirmed' ? 'Dikonfirmasi' : 'Menunggu'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Jadwal Jurnal Reading - Hanya untuk mata kuliah Blok */}
          {mataKuliah.jenis === "Blok" && (
            <div className="mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-lg">
                      <FontAwesomeIcon icon={faBookOpen} className="text-white text-sm" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Jadwal Jurnal Reading</h3>
                  </div>
                </div>

                <div className="overflow-x-auto hide-scroll">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">HARI/TANGGAL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PUKUL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">WAKTU</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TOPIK</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PENGAMPU</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">KELOMPOK</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">LOKASI</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {jadwalJurnalReading.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="px-6 py-8 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                <FontAwesomeIcon icon={faBookOpen} className="w-8 h-8 text-gray-400" />
                              </div>
                              <p className="text-gray-500 dark:text-gray-400 text-sm">Tidak ada jadwal jurnal reading</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        jadwalJurnalReading.map((jadwal) => (
                          <tr key={jadwal.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatDate(jadwal.tanggal)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.jam_mulai} - {jadwal.jam_selesai}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{`${jadwal.jumlah_sesi || 1} x 50 menit`}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{jadwal.topik}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{jadwal.dosen?.name || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.kelompok_kecil?.nama || jadwal.kelompok_kecil_antara?.nama_kelompok || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.ruangan?.nama || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                jadwal.status_konfirmasi === 'confirmed' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                              }`}>
                                {jadwal.status_konfirmasi === 'confirmed' ? 'Dikonfirmasi' : 'Menunggu'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Jadwal CSR - Hanya untuk mata kuliah Non Blok CSR */}
          {mataKuliah.jenis === "Non Blok" && mataKuliah.tipe_non_block === "CSR" && (
            <div className="mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg">
                      <FontAwesomeIcon icon={faBookOpen} className="text-white text-sm" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Jadwal CSR (Community Service Learning)</h3>
                  </div>
                </div>

                <div className="overflow-x-auto hide-scroll">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-700/50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">HARI/TANGGAL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PUKUL</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">WAKTU</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">TOPIK</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">KATEGORI</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">JENIS CSR</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">PENGAMPU</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">KELOMPOK</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">LOKASI</th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">STATUS</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                      {jadwalCSR.length === 0 ? (
                        <tr>
                          <td colSpan={10} className="px-6 py-8 text-center">
                            <div className="flex flex-col items-center justify-center">
                              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                                <FontAwesomeIcon icon={faBookOpen} className="w-8 h-8 text-gray-400" />
                              </div>
                              <p className="text-gray-500 dark:text-gray-400 text-sm">Tidak ada jadwal CSR</p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        jadwalCSR.map((jadwal) => (
                          <tr key={jadwal.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{formatDate(jadwal.tanggal)}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.jam_mulai} - {jadwal.jam_selesai}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{`${jadwal.jumlah_sesi || 1} x 50 menit`}</td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{jadwal.topik}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.kategori?.nama || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                jadwal.jenis_csr === 'reguler' 
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700' 
                                  : 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-700'
                              }`}>
                                {jadwal.jenis_csr === 'reguler' ? 'CSR Reguler' : 'CSR Responsi'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">{jadwal.pengampu || jadwal.dosen?.name || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.kelompok_kecil?.nama || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">{jadwal.ruangan?.nama || 'N/A'}</td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className={`px-2 py-1 rounded-full text-xs ${
                                jadwal.status_konfirmasi === 'confirmed' 
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300'
                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300'
                              }`}>
                                {jadwal.status_konfirmasi === 'confirmed' ? 'Dikonfirmasi' : 'Menunggu'}
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          </div>
        </div>
      </div>

      {/* Modal Semua Materi */}
      <AnimatePresence>
        {showMateriModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-md"
              onClick={() => {
                setShowMateriModal(false);
                setModalMateriSearch("");
              }}
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-5xl mx-4 sm:mx-auto bg-white dark:bg-gray-900 rounded-2xl sm:rounded-3xl shadow-lg z-[100001] max-h-[90vh] sm:max-h-[85vh] overflow-hidden flex flex-col"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-4 sm:p-6 lg:p-8 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-gray-800 dark:to-gray-700">
                <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center flex-shrink-0">
                    <FontAwesomeIcon icon={faFileAlt} className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 dark:text-white truncate">
                      Semua Materi Pembelajaran
                    </h2>
                    <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                      {materi.length} file tersedia
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setShowMateriModal(false);
                    setModalMateriSearch("");
                  }}
                  className="flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white h-9 w-9 sm:h-11 sm:w-11 transition-all duration-200 flex-shrink-0 ml-2"
                >
                  <FontAwesomeIcon icon={faTimes} className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto min-h-0">
                {/* Search Bar */}
                <div className="mb-6 sm:mb-8">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Cari materi pembelajaran..."
                      value={modalMateriSearch}
                      onChange={(e) => setModalMateriSearch(e.target.value)}
                      className="w-full px-4 sm:px-5 py-3 sm:py-4 pl-12 sm:pl-14 border border-gray-300 dark:border-gray-600 rounded-xl sm:rounded-2xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200 text-base sm:text-lg shadow-sm"
                    />
                    <FontAwesomeIcon 
                      icon={faSearch} 
                      className="absolute left-4 sm:left-5 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" 
                    />
                  </div>
                </div>

                {/* Materi List */}
                {modalFilteredMateri.length > 0 ? (
                  <div className="space-y-4">
                    {modalFilteredMateri.map((m) => (
                      <motion.div
                        key={m.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        className="group flex items-center justify-between p-3 sm:p-4 lg:p-5 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-700 dark:to-gray-600 rounded-xl sm:rounded-2xl hover:from-blue-50 hover:to-blue-100 dark:hover:from-blue-900/20 dark:hover:to-blue-800/20 transition-all duration-200 border border-gray-200 dark:border-gray-600 hover:border-blue-300 dark:hover:border-blue-600 shadow-sm hover:shadow-md"
                      >
                        <div className="flex items-center gap-3 sm:gap-4 lg:gap-5 flex-1 min-w-0">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-white dark:bg-gray-600 rounded-lg sm:rounded-xl flex items-center justify-center shadow-sm flex-shrink-0">
                            <FontAwesomeIcon 
                              icon={faFileAlt} 
                              className="w-5 h-5 sm:w-6 sm:h-6 text-gray-600 dark:text-gray-300" 
                            />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-semibold text-gray-900 dark:text-white group-hover:text-blue-700 dark:group-hover:text-blue-300 transition-colors text-base sm:text-lg truncate">
                              {m.judul}
                            </p>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400 mt-1">
                              {m.file_type.toUpperCase()} • {formatFileSize(m.file_size)}
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => downloadMateri(m.filename, m.judul)}
                          className="p-2 sm:p-3 lg:p-4 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-white dark:bg-gray-600 rounded-lg sm:rounded-xl shadow-sm hover:shadow-lg transition-all duration-200 group-hover:bg-blue-50 dark:group-hover:bg-blue-900/20 transform hover:scale-105 flex-shrink-0 ml-2"
                          title="Download materi"
                        >
                          <FontAwesomeIcon icon={faDownload} className="w-4 h-4 sm:w-5 sm:h-5" />
                        </button>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12 lg:py-16">
                    <div className="w-16 h-16 sm:w-20 sm:h-20 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4 sm:mb-6">
                      <FontAwesomeIcon icon={modalMateriSearch ? faSearch : faFileAlt} className="w-6 h-6 sm:w-8 sm:h-8 text-gray-400" />
                    </div>
                    <h3 className="text-base sm:text-lg font-semibold text-gray-500 dark:text-gray-400 mb-2">
                      {modalMateriSearch ? "Tidak ada materi yang cocok" : "Tidak ada materi tersedia"}
                    </h3>
                    {modalMateriSearch && (
                      <>
                        <p className="text-gray-400 dark:text-gray-500 text-sm mb-4 sm:mb-6 px-4">
                          dengan pencarian "{modalMateriSearch}"
                        </p>
                        <button
                          onClick={() => setModalMateriSearch("")}
                          className="px-4 sm:px-6 py-2 sm:py-3 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/20 rounded-lg sm:rounded-xl transition-colors font-medium"
                        >
                          Hapus filter
                        </button>
                      </>
                    )}
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex-shrink-0 flex flex-col sm:flex-row items-center justify-between gap-4 p-4 sm:p-6 lg:p-8 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                    {modalFilteredMateri.length} dari {materi.length} materi
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowMateriModal(false);
                    setModalMateriSearch("");
                  }}
                  className="w-full sm:w-auto px-6 py-3 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-gray-400 dark:hover:border-gray-500 transition-all duration-200 font-medium shadow-sm hover:shadow-md"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload RPS Modal */}
      <AnimatePresence>
        {showUploadRpsModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-md"
              onClick={() => {
                setShowUploadRpsModal(false);
                setRpsFile(null);
              }}
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-lg z-[100001] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {mataKuliah?.rps_file ? 'Ganti RPS' : 'Upload RPS'}
                </h2>
                <button
                  onClick={() => {
                    setShowUploadRpsModal(false);
                    setRpsFile(null);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                {mataKuliah?.rps_file && (
                  <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>⚠️ Perhatian:</strong> File RPS yang baru akan mengganti file RPS yang sudah ada sebelumnya.
                    </p>
                  </div>
                )}
                
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pilih File RPS
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xlsx,.xls"
                    onChange={(e) => setRpsFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Format yang didukung: PDF, DOC, DOCX, XLSX, XLS
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                    ⚠️ Ukuran file maksimal: 20MB
                  </p>
                </div>

                {rpsFile && (
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>File dipilih:</strong> {rpsFile.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Ukuran: {(rpsFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowUploadRpsModal(false);
                    setRpsFile(null);
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={uploadRps}
                  disabled={!rpsFile || uploadingRps}
                  className={`px-4 py-2 text-white rounded-lg disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2 ${
                    mataKuliah?.rps_file 
                      ? 'bg-orange-500 hover:bg-orange-600' 
                      : 'bg-green-500 hover:bg-green-600'
                  }`}
                >
                  {uploadingRps ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      {mataKuliah?.rps_file ? 'Mengganti...' : 'Uploading...'}
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faUpload} className="w-4 h-4" />
                      {mataKuliah?.rps_file ? 'Ganti RPS' : 'Upload RPS'}
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Upload Materi Modal */}
      <AnimatePresence>
        {showUploadMateriModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-md"
              onClick={() => {
                setShowUploadMateriModal(false);
                setMateriFile(null);
                setMateriJudul("");
              }}
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-lg z-[100001] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Upload Materi
                </h2>
                <button
                  onClick={() => {
                    setShowUploadMateriModal(false);
                    setMateriFile(null);
                    setMateriJudul("");
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                >
                  <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-6">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Judul Materi
                  </label>
                  <input
                    type="text"
                    value={materiJudul}
                    onChange={(e) => setMateriJudul(e.target.value)}
                    placeholder="Masukkan judul materi"
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pilih File Materi
                  </label>
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx,.txt,.jpg,.jpeg,.png,.gif,.mp4,.mp3,.wav,.zip,.rar"
                    onChange={(e) => setMateriFile(e.target.files?.[0] || null)}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    Format yang didukung: PDF, DOC, DOCX, XLSX, XLS, PPT, PPTX, TXT, JPG, PNG, MP4, MP3, ZIP, RAR
                  </p>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 font-medium">
                    ⚠️ Ukuran file maksimal: 30MB
                  </p>
                </div>

                {materiFile && (
                  <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      <strong>File dipilih:</strong> {materiFile.name}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Ukuran: {(materiFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                )}
              </div>

              {/* Modal Footer */}
              <div className="flex items-center justify-end gap-3 p-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowUploadMateriModal(false);
                    setMateriFile(null);
                    setMateriJudul("");
                  }}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={uploadMateri}
                  disabled={!materiFile || !materiJudul || uploadingMateri}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
                >
                  {uploadingMateri ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      Uploading...
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faFileUpload} className="w-4 h-4" />
                      Upload
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}