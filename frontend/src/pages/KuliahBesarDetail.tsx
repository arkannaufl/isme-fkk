import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api, { handleApiError } from '../utils/api';
import { ChevronLeftIcon } from '../icons';
import { motion } from 'framer-motion';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGraduationCap, faCheckCircle, faTimesCircle, faClock } from '@fortawesome/free-solid-svg-icons';

interface JadwalKuliahBesar {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string;
  topik?: string;
  dosen_id: number;
  ruangan_id: number;
  jumlah_sesi: number;
  status_konfirmasi: string;
  status_reschedule?: string;
  mata_kuliah_kode: string;
  kelompok_besar_id?: number;
  kelompok_besar_antara_id?: number;
  dosen?: {
    id: number;
    name: string;
  };
  ruangan?: {
    id: number;
    nama: string;
    kapasitas?: number;
  };
  mataKuliah?: {
    kode: string;
    nama: string;
  };
}

export default function KuliahBesarDetail() {
  const { kode, jadwalId } = useParams<{ kode: string; jadwalId: string }>();
  const navigate = useNavigate();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jadwalDetail, setJadwalDetail] = useState<JadwalKuliahBesar | null>(null);
  const [mataKuliah, setMataKuliah] = useState<{ kode: string; nama: string } | null>(null);
  const [jumlahMahasiswa, setJumlahMahasiswa] = useState<number>(0);

  useEffect(() => {
    fetchData();
  }, [kode, jadwalId]);

  const fetchData = async () => {
    if (!kode || !jadwalId) return;

    setLoading(true);
    try {
      // Fetch semua jadwal kuliah besar untuk mata kuliah ini
      const response = await api.get(`/kuliah-besar/jadwal/${kode}`);
      const allJadwal = response.data;
      
      // Cari jadwal yang sesuai dengan jadwalId
      const foundJadwal = allJadwal.find((j: any) => j.id === parseInt(jadwalId));
      
      if (!foundJadwal) {
        throw new Error('Jadwal tidak ditemukan');
      }
      
      setJadwalDetail(foundJadwal);

      // Fetch mata kuliah info
      const matkulResponse = await api.get(`/mata-kuliah/${kode}`);
      setMataKuliah(matkulResponse.data);

      // Fetch jumlah mahasiswa berdasarkan kelompok besar
      if (foundJadwal.kelompok_besar_id) {
        try {
          // Fetch semua mahasiswa di kelompok besar berdasarkan semester
          const mahasiswaResponse = await api.get(`/kelompok-besar?semester=${foundJadwal.kelompok_besar_id}`);
          setJumlahMahasiswa(mahasiswaResponse.data.length || 0);
        } catch (err) {
          console.error('Error fetching mahasiswa:', err);
          setJumlahMahasiswa(0);
        }
      } else if (foundJadwal.kelompok_besar_antara_id) {
        try {
          // Fetch kelompok besar antara
          const kelompokResponse = await api.get(`/kelompok-besar-antara/${foundJadwal.kelompok_besar_antara_id}`);
          const mahasiswaIds = kelompokResponse.data.mahasiswa_ids || [];
          setJumlahMahasiswa(mahasiswaIds.length);
        } catch (err) {
          console.error('Error fetching kelompok antara:', err);
          setJumlahMahasiswa(0);
        }
      }

      setError(null);
    } catch (err: any) {
      setError(handleApiError(err, 'Memuat data jadwal'));
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('id-ID', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'bisa':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
            <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3 mr-1" />
            Bisa Mengajar
          </span>
        );
      case 'tidak_bisa':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
            <FontAwesomeIcon icon={faTimesCircle} className="w-3 h-3 mr-1" />
            Tidak Bisa
          </span>
        );
      case 'waiting_reschedule':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
            <FontAwesomeIcon icon={faClock} className="w-3 h-3 mr-1" />
            Menunggu Reschedule
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
            Menunggu Konfirmasi
          </span>
        );
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (!jadwalDetail) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
          >
            <ChevronLeftIcon className="w-5 h-5 mr-1" />
            Kembali
          </button>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center">
                <FontAwesomeIcon icon={faGraduationCap} className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Detail Jadwal Kuliah Besar
                </h1>
                {mataKuliah && (
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {mataKuliah.kode} - {mataKuliah.nama}
                  </p>
                )}
              </div>
            </div>
          </div>
        </motion.div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg"
          >
            {error}
          </motion.div>
        )}

        {/* Detail Information Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Informasi Jadwal
            </h2>
          </div>

          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tanggal & Waktu */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tanggal & Waktu
                </label>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="text-lg font-semibold text-gray-900 dark:text-white">
                    {formatDate(jadwalDetail.tanggal)}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {jadwalDetail.jam_mulai} - {jadwalDetail.jam_selesai}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {jadwalDetail.jumlah_sesi} x 50 menit
                  </div>
                </div>
              </div>

              {/* Materi */}
              {jadwalDetail.materi && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Materi
                  </label>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-900 dark:text-white font-medium">
                      {jadwalDetail.materi}
                    </div>
                  </div>
                </div>
              )}

              {/* Topik */}
              {jadwalDetail.topik && (
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                    Topik
                  </label>
                  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                    <div className="text-gray-900 dark:text-white">
                      {jadwalDetail.topik}
                    </div>
                  </div>
                </div>
              )}

              {/* Dosen Pengampu */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Dosen Pengampu
                </label>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="text-gray-900 dark:text-white">
                    {jadwalDetail.dosen?.name || '-'}
                  </div>
                </div>
              </div>

              {/* Ruangan */}
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                  Ruangan
                </label>
                <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4">
                  <div className="text-gray-900 dark:text-white">
                    {jadwalDetail.ruangan?.nama || '-'}
                  </div>
                  {jumlahMahasiswa > 0 && (
                    <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Jumlah Mahasiswa: {jumlahMahasiswa} orang
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Action Button */}
            {jadwalDetail.status_konfirmasi === 'bisa' && (
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    navigate(`/absensi-kuliah-besar/${kode}/${jadwalId}`);
                  }}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors duration-200 flex items-center justify-center gap-2"
                >
                  <FontAwesomeIcon icon={faCheckCircle} />
                  Buka Absensi
                </button>
              </div>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
