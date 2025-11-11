import { useParams, useNavigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import api, { handleApiError, getUser } from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCheckCircle, faTimesCircle, faSpinner, faCalendar, faClock, faBookOpen, faUser, faLightbulb, faClipboardCheck, faRedo } from '@fortawesome/free-solid-svg-icons';
import { AnimatePresence, motion } from 'framer-motion';

interface JadwalDetail {
  id: number;
  mata_kuliah_kode: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  topik?: string;
  materi?: string;
  mata_kuliah?: {
    kode: string;
    nama: string;
  };
}

export default function DetailAbSenMahasiswaPraktikum() {
  const { kode, jadwalId } = useParams<{ kode: string; jadwalId: string }>();
  const navigate = useNavigate();
  const user = getUser();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jadwalDetail, setJadwalDetail] = useState<JadwalDetail | null>(null);
  const [success, setSuccess] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [autoSubmitted, setAutoSubmitted] = useState(false);
  const [isRegistered, setIsRegistered] = useState<boolean | null>(null);
  const [qrEnabled, setQrEnabled] = useState<boolean>(false);
  const [qrToken, setQrToken] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role !== 'mahasiswa') {
      setError('Akses ditolak. Hanya mahasiswa yang dapat mengakses halaman ini.');
      return;
    }
    
    fetchData();
  }, [kode, jadwalId]);

  // Auto submit absensi saat page load (hanya jika URL mengandung query parameter)
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const fromQR = urlParams.get('from_qr') === 'true';
    const token = urlParams.get('token');
    
    // Simpan token dari URL
    if (token) {
      setQrToken(token);
    }
    
    // Hanya auto-submit jika:
    // 1. QR code sudah diaktifkan oleh dosen (qrEnabled === true)
    // 2. Mahasiswa terdaftar (isRegistered === true)
    // 3. Belum pernah submit (alreadySubmitted === false)
    // 4. Belum sukses (success === false)
    // 5. Belum auto-submit sebelumnya (autoSubmitted === false)
    // 6. Tidak sedang submit (submitting === false)
    // 7. Token ada (token !== null)
    if (fromQR && jadwalDetail && user?.nim && qrEnabled && isRegistered === true && !alreadySubmitted && !success && !autoSubmitted && !submitting && token) {
      // Auto submit setelah data jadwal berhasil dimuat dan validasi terdaftar sudah selesai
      setAutoSubmitted(true);
      const timer = setTimeout(() => {
        handleSubmitAbsensi();
      }, 1500); // Delay 1.5 detik agar user bisa lihat informasi jadwal dulu
      
      return () => clearTimeout(timer);
    }
  }, [jadwalDetail, isRegistered, alreadySubmitted, autoSubmitted, submitting, qrEnabled, qrToken]);

  const fetchData = async () => {
    if (!kode || !jadwalId || !user?.nim) return;
    setLoading(true);

    try {
      // Fetch jadwal detail
      const jadwalResponse = await api.get(`/praktikum/jadwal/${kode}`);
      const allJadwal = jadwalResponse.data;
      const foundJadwal = allJadwal.find((j: any) => j.id === parseInt(jadwalId));

      if (!foundJadwal) {
        throw new Error('Jadwal tidak ditemukan');
      }

      setJadwalDetail(foundJadwal);

      // Debug: Log nilai qr_enabled untuk debugging
      console.log('QR Enabled dari backend:', foundJadwal.qr_enabled, typeof foundJadwal.qr_enabled);
      
      // Pastikan qr_enabled di-parse dengan benar (handle boolean/string/number)
      const qrEnabledValue = foundJadwal.qr_enabled === true || 
                            foundJadwal.qr_enabled === 1 || 
                            foundJadwal.qr_enabled === '1' ||
                            foundJadwal.qr_enabled === 'true';
      setQrEnabled(qrEnabledValue);
      
      console.log('QR Enabled setelah parse:', qrEnabledValue);

      // VALIDASI: Cek apakah mahasiswa terdaftar di jadwal ini (praktikum menggunakan kelas praktikum)
      let mahasiswaTerdaftar: any[] = [];
      
      // Fetch mahasiswa dari kelas praktikum
      try {
        const mahasiswaResponse = await api.get(`/praktikum/${kode}/jadwal/${jadwalId}/mahasiswa`);
        const mahasiswaList = mahasiswaResponse.data?.mahasiswa || [];
        
        mahasiswaTerdaftar = mahasiswaList
          .map((m: any) => ({
            id: m.id,
            nim: String(m.nim || '').trim()
          }))
          .filter((m: any) => m.id && m.nim && m.nim !== 'N/A' && m.nim !== '');
      } catch (err) {
        console.error('Error fetching mahasiswa dari kelas praktikum:', err);
      }

      // Normalisasi NIM untuk perbandingan yang lebih robust
      const userNim = String(user.nim || '').trim();
      
      // Cek apakah NIM mahasiswa ada di daftar mahasiswa terdaftar
      if (mahasiswaTerdaftar.length > 0) {
        // Ada daftar mahasiswa, cek apakah user terdaftar
        const isMahasiswaTerdaftar = mahasiswaTerdaftar.some(m => {
          const registeredNim = String(m.nim || '').trim();
          return registeredNim === userNim;
        });
        
        setIsRegistered(isMahasiswaTerdaftar);
        
        if (!isMahasiswaTerdaftar) {
          // Mahasiswa tidak terdaftar, set error dan stop
          setError('Anda tidak terdaftar di jadwal ini');
          return;
        }
      } else {
        // Daftar kosong - mungkin ada masalah fetch atau data belum diatur
        // Biarkan isRegistered tetap null, validasi akan dilakukan di backend saat submit
        console.warn('Daftar mahasiswa terdaftar kosong, validasi akan dilakukan di backend saat submit');
        // Jangan set isRegistered, biarkan tetap null
      }

      // Cek apakah sudah absen (hanya jika terdaftar)
      // Pastikan mengecek status hadir = true, bukan hanya keberadaan data
      try {
        const absensiResponse = await api.get(`/praktikum/${kode}/jadwal/${jadwalId}/absensi`);
        if (absensiResponse.data.absensi && absensiResponse.data.absensi[user.nim]) {
          const absenData = absensiResponse.data.absensi[user.nim];
          // Hanya anggap sudah submitted jika hadir = true
          // Pastikan menggunakan strict equality check
          if (absenData.hadir === true || absenData.hadir === 1 || absenData.hadir === '1') {
          setAlreadySubmitted(true);
          } else {
            // Jika ada record tapi hadir = false/null, reset state
            setAlreadySubmitted(false);
          }
        } else {
          // Tidak ada record absensi, pastikan alreadySubmitted = false
          setAlreadySubmitted(false);
        }
      } catch (err) {
        // Belum ada absensi, pastikan state sudah benar
        setAlreadySubmitted(false);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(handleApiError(err, 'Memuat data jadwal'));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitAbsensi = async () => {
    if (!kode || !jadwalId || !user?.nim) return;

    // Debug: Log state sebelum submit
    console.log('handleSubmitAbsensi called:', {
      qrEnabled,
      kode,
      jadwalId,
      userNim: user?.nim
    });

    // Validasi: Pastikan QR code sudah diaktifkan oleh dosen
    if (!qrEnabled) {
      console.warn('Absensi ditolak: QR code belum diaktifkan');
      setError('QR code belum diaktifkan oleh dosen. Silakan tunggu hingga dosen mengaktifkan QR code untuk absensi ini.');
      return;
    }

    // Validasi: Pastikan token QR ada (jika submit via QR)
    const urlParams = new URLSearchParams(window.location.search);
    const fromQR = urlParams.get('from_qr') === 'true';
    const token = qrToken || urlParams.get('token');
    
    if (fromQR && !token) {
      setError('Token QR code tidak ditemukan. Silakan scan QR code yang baru.');
      return;
    }

    // Validasi: Pastikan mahasiswa terdaftar sebelum submit
    // Jika isRegistered === false, berarti sudah pasti tidak terdaftar
    // Jika isRegistered === null/undefined, berarti belum pasti (daftar kosong), biarkan backend yang validasi
    if (isRegistered === false) {
      setError('Anda tidak terdaftar di jadwal ini. Tidak dapat mengisi absensi.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      // Normalisasi NIM user untuk konsistensi
      const userNim = String(user.nim || '').trim();

      // Untuk mahasiswa yang submit via QR code, hanya kirim absensi mereka sendiri
      // Jangan include semua absensi existing karena mungkin ada NIM yang tidak valid
      const payload: any = {
        absensi: [{
          mahasiswa_nim: userNim,
          hadir: true,
          catatan: ''
        }]
      };

      // Tambahkan token QR jika ada (untuk validasi security)
      if (token) {
        payload.qr_token = token;
      }

      // Debug log (akan dihapus setelah fix)
      console.log('Mengirim absensi:', {
        userNim,
        payload,
        kode,
        jadwalId
      });

      await api.post(`/praktikum/${kode}/jadwal/${jadwalId}/absensi`, payload);
      
      // Refresh data absensi untuk memastikan sinkronisasi dengan backend
      try {
        const absensiResponse = await api.get(`/praktikum/${kode}/jadwal/${jadwalId}/absensi`);
        const normalizedUserNim = String(user.nim || '').trim();
        if (absensiResponse.data.absensi && absensiResponse.data.absensi[normalizedUserNim]) {
          const absenData = absensiResponse.data.absensi[normalizedUserNim];
          // Pastikan hadir = true sebelum set alreadySubmitted
          if (absenData.hadir === true) {
            setAlreadySubmitted(true);
            setSuccess(true);
          } else {
            // Jika backend masih mengembalikan hadir: false, ada masalah
            setError('Absensi gagal tersimpan. Silakan coba lagi.');
          }
        } else {
          // Data tidak ada di response, kemungkinan error
          setError('Absensi gagal tersimpan. Silakan coba lagi.');
        }
      } catch (refreshError) {
        // Jika refresh gagal, tetap set success asalkan API submit berhasil
        // Tapi kita tetap perlu refresh sekali lagi untuk memastikan
        console.warn('Refresh absensi gagal, akan retry:', refreshError);
      setSuccess(true);
      setAlreadySubmitted(true);
      }
    } catch (err: any) {
      console.error('Error submitting absensi:', err);
      console.error('Error response:', err?.response?.data);
      
      const errorMessage = err?.response?.data?.message || '';
      const errorCode = err?.response?.data?.code || '';
      const invalidNims = err?.response?.data?.invalid_nims || [];
      
      // Handle error khusus untuk token expired
      if (errorCode === 'QR_TOKEN_EXPIRED' || errorCode === 'QR_TOKEN_INVALID' || errorMessage.includes('Token QR code')) {
        setError('Token QR code tidak valid atau sudah expired. Silakan scan QR code yang baru dari dosen.');
        setQrToken(null); // Reset token
        return;
      }
      
      // Tampilkan pesan error yang lebih detail
      if (errorMessage.includes('terdaftar') || errorMessage.includes('tidak terdaftar')) {
        let errorMsg = 'Anda tidak terdaftar di jadwal ini.';
        if (invalidNims.length > 0) {
          errorMsg += ` NIM yang tidak terdaftar: ${invalidNims.join(', ')}`;
        }
        setError(errorMsg);
        setIsRegistered(false);
      } else if (errorMessage) {
        // Gunakan pesan error dari backend jika ada
        setError(errorMessage);
      } else {
      setError('Gagal mengisi absensi. Silakan coba lagi.');
      }
      // Reset success state jika error
      setSuccess(false);
      setAlreadySubmitted(false);
    } finally {
      setSubmitting(false);
    }
  };


  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-3 sm:px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center"
        >
          <div className="inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-blue-500/20 mb-3 sm:mb-4">
            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-3xl sm:text-4xl text-blue-600" />
          </div>
          <p className="text-gray-600 dark:text-gray-400 font-medium text-sm sm:text-base">Memuat data...</p>
        </motion.div>
      </div>
    );
  }

  // Tampilan khusus untuk mahasiswa tidak terdaftar
  if (isRegistered === false || (error && error.includes('tidak terdaftar'))) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-3 sm:px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center bg-white dark:bg-gray-800 p-6 sm:p-12 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 max-w-2xl w-full"
        >
          {/* Error Icon */}
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-4 sm:mb-6"
          >
            <div className="inline-flex items-center justify-center w-20 h-20 sm:w-24 sm:h-24 bg-red-100 dark:bg-red-900/20 rounded-full mb-3 sm:mb-4">
              <FontAwesomeIcon icon={faTimesCircle} className="text-red-500 text-4xl sm:text-5xl" />
            </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl sm:text-4xl font-bold text-gray-900 dark:text-white mb-3 sm:mb-4"
          >
            Anda Tidak Terdaftar
          </motion.h1>

          {/* Message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-lg sm:text-xl text-gray-600 dark:text-gray-400 mb-6 sm:mb-10"
          >
            Nama Anda tidak terdaftar di jadwal kuliah ini.
          </motion.p>

          {/* Jadwal Info (if available) */}
          {jadwalDetail && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-10 text-left border border-gray-200 dark:border-gray-700"
            >
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">Informasi Jadwal:</h3>
              <div className="space-y-2 text-xs sm:text-sm text-gray-600 dark:text-gray-400">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span>Mata Kuliah:</span>
                  <span className="font-semibold text-gray-900 dark:text-white sm:text-right">
                    {jadwalDetail.mata_kuliah?.nama || jadwalDetail.mata_kuliah_kode}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span>Tanggal:</span>
                  <span className="font-semibold text-gray-900 dark:text-white sm:text-right">
                    {new Date(jadwalDetail.tanggal).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span>Waktu:</span>
                  <span className="font-semibold text-gray-900 dark:text-white sm:text-right">
                    {jadwalDetail.jam_mulai} - {jadwalDetail.jam_selesai}
                  </span>
                </div>
              </div>
            </motion.div>
          )}

          {/* Reasons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="bg-yellow-50 dark:bg-yellow-900/20 rounded-2xl p-4 sm:p-6 mb-6 sm:mb-10 text-left border border-yellow-200 dark:border-yellow-800"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white mb-2 sm:mb-3 flex items-center gap-2 text-sm sm:text-base">
              <FontAwesomeIcon icon={faTimesCircle} className="text-yellow-600 text-base sm:text-lg" />
              Kemungkinan penyebab:
            </h3>
            <ul className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <span>Anda tidak terdaftar di mata kuliah ini untuk semester/jadwal ini</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <span>QR Code yang di-scan salah (bukan untuk kelas Anda)</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-yellow-600 mt-1">•</span>
                <span>Data kelompok besar belum diatur dengan benar</span>
              </li>
            </ul>
          </motion.div>

          {/* Action Button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
            onClick={() => navigate('/dashboard')}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 sm:py-4 px-6 sm:px-10 rounded-xl shadow-md transition-colors flex items-center gap-2 mx-auto text-sm sm:text-base"
          >
            <FontAwesomeIcon icon={faTimesCircle} />
            Kembali ke Dashboard
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (error && !jadwalDetail) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-3 sm:px-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center bg-white dark:bg-gray-800 p-6 sm:p-8 rounded-2xl shadow-xl border border-gray-200 dark:border-gray-700 max-w-md w-full"
        >
          <div className="inline-flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-red-100 dark:bg-red-900/30 mb-3 sm:mb-4">
            <FontAwesomeIcon icon={faTimesCircle} className="text-red-500 text-3xl sm:text-4xl" />
          </div>
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Terjadi Kesalahan
          </h2>
          <p className="text-red-600 dark:text-red-400 mb-4 sm:mb-6 text-sm sm:text-base break-words">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-5 sm:px-6 py-2.5 sm:py-3 bg-gradient-to-r from-blue-500 to-green-500 hover:from-blue-600 hover:to-green-600 text-white font-semibold rounded-xl transition-all transform hover:scale-105 shadow-lg text-sm sm:text-base"
          >
            Kembali
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-2xl mx-auto px-3 sm:px-4 py-4 sm:py-8">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6"
        >
          {/* Header */}
          <div className="text-center mb-4 sm:mb-6">
            {/* Status Badge - Tampilkan jika sudah submitted */}
            {(alreadySubmitted || success) && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-3 sm:mb-4"
              >
                <div className="inline-flex items-center gap-1.5 sm:gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-green-100 dark:bg-green-900/30 border-2 border-green-500 rounded-full">
                  <FontAwesomeIcon icon={faClipboardCheck} className="text-green-600 dark:text-green-400 text-base sm:text-lg" />
                  <span className="text-green-700 dark:text-green-400 font-bold text-xs sm:text-sm">
                    ✓ KEHADIRAN SUDAH DIKONFIRMASI
                  </span>
                </div>
              </motion.div>
            )}
            
            <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 ${alreadySubmitted || success ? 'bg-green-500' : 'bg-blue-500'} rounded-2xl mb-3 sm:mb-4`}>
              <FontAwesomeIcon icon={faClipboardCheck} className="text-white text-lg sm:text-xl" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2">
              Absensi Praktikum
            </h1>
            <p className="text-gray-600 dark:text-gray-400 text-xs sm:text-sm">
              {alreadySubmitted || success 
                ? 'Kehadiran Anda sudah tercatat untuk jadwal ini' 
                : 'Silakan isi absensi untuk jadwal ini'}
            </p>
          </div>

          {/* Jadwal Info */}
          {jadwalDetail && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-xl p-4 sm:p-6 mb-4 sm:mb-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4 text-sm sm:text-base">
                Informasi Jadwal
              </h3>
              <div className="space-y-2 text-xs sm:text-sm">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-gray-600 dark:text-gray-400">Mata Kuliah:</span>
                  <span className="font-semibold text-gray-900 dark:text-white sm:text-right">
                    {jadwalDetail.mata_kuliah?.nama || jadwalDetail.mata_kuliah_kode}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-gray-600 dark:text-gray-400">Tanggal:</span>
                  <span className="font-semibold text-gray-900 dark:text-white sm:text-right">
                    {new Date(jadwalDetail.tanggal).toLocaleDateString('id-ID', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                  <span className="text-gray-600 dark:text-gray-400">Waktu:</span>
                  <span className="font-semibold text-gray-900 dark:text-white sm:text-right">
                    {jadwalDetail.jam_mulai} - {jadwalDetail.jam_selesai}
                  </span>
                </div>
                {jadwalDetail.materi && (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                    <span className="text-gray-600 dark:text-gray-400">Materi:</span>
                    <span className="font-semibold text-gray-900 dark:text-white text-right">
                      {jadwalDetail.materi}
                    </span>
                  </div>
                )}
                {jadwalDetail.topik && (
                  <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                    <span className="text-gray-600 dark:text-gray-400">Topik:</span>
                    <span className="font-semibold text-gray-900 dark:text-white text-right">
                      {jadwalDetail.topik}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Mahasiswa Info */}
          <div className={`rounded-xl p-4 sm:p-6 mb-4 sm:mb-6 border-2 ${
            alreadySubmitted || success 
              ? 'bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700' 
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          }`}>
            <div className="flex items-center justify-between mb-3 sm:mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white text-sm sm:text-base">
              Data Mahasiswa
            </h3>
              {(alreadySubmitted || success) && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="flex items-center gap-1.5 sm:gap-2 px-2 py-0.5 sm:px-3 sm:py-1 bg-green-500 rounded-full"
                >
                  <FontAwesomeIcon icon={faCheckCircle} className="text-white text-xs sm:text-sm" />
                  <span className="text-white text-xs font-bold">HADIR</span>
                </motion.div>
              )}
            </div>
            <div className="space-y-2 text-xs sm:text-sm">
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-gray-600 dark:text-gray-400">NIM:</span>
                <span className="font-semibold text-gray-900 dark:text-white sm:text-right">
                  {user?.nim || '-'}
                </span>
              </div>
              <div className="flex flex-col sm:flex-row sm:justify-between gap-1 sm:gap-0">
                <span className="text-gray-600 dark:text-gray-400">Nama:</span>
                <span className="font-semibold text-gray-900 dark:text-white sm:text-right">
                  {user?.name || '-'}
                </span>
              </div>
            </div>
          </div>

          {/* Auto Submitting Notification */}
          {autoSubmitted && submitting && !success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 sm:mb-6 p-3 sm:p-4 bg-blue-100 dark:bg-blue-900/20 rounded-lg"
            >
              <div className="flex items-center justify-center gap-2 sm:gap-3 text-blue-700 dark:text-blue-400">
                <FontAwesomeIcon icon={faSpinner} className="animate-spin text-lg sm:text-xl" />
                <p className="font-semibold text-sm sm:text-base">Mencatat kehadiran Anda...</p>
              </div>
            </motion.div>
          )}

          {/* Error Message */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4 sm:mb-6 p-3 sm:p-4 bg-red-50 dark:bg-red-900/20 rounded-xl border border-red-200 dark:border-red-800"
              >
                <div className="flex items-start gap-2 sm:gap-3 text-red-700 dark:text-red-400">
                  <FontAwesomeIcon icon={faTimesCircle} className="mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold mb-1 text-sm sm:text-base">Terjadi Kesalahan</p>
                    <p className="text-xs sm:text-sm break-words">{error}</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Success Message - Tampilkan setelah submit berhasil */}
          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mb-4 sm:mb-6 p-4 sm:p-5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl border-2 border-green-400 dark:border-green-600 shadow-lg"
            >
              <div className="flex items-center gap-3 sm:gap-4 text-green-700 dark:text-green-400">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon icon={faCheckCircle} className="text-white text-xl sm:text-2xl" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base sm:text-lg mb-1">Absensi Berhasil Dikonfirmasi!</p>
                  <p className="text-xs sm:text-sm">Kehadiran Anda sudah tercatat di sistem untuk jadwal ini.</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Already Submitted Message - Tampilkan jika sudah pernah submit sebelumnya */}
          {alreadySubmitted && !success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 sm:mb-6 p-4 sm:p-5 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 rounded-xl border-2 border-green-400 dark:border-green-600 shadow-lg"
            >
              <div className="flex items-center gap-3 sm:gap-4 text-green-700 dark:text-green-400">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-green-500 rounded-full flex items-center justify-center">
                    <FontAwesomeIcon icon={faClipboardCheck} className="text-white text-xl sm:text-2xl" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base sm:text-lg mb-1">Anda Sudah Mengkonfirmasi Kehadiran</p>
                  <p className="text-xs sm:text-sm">Kehadiran Anda untuk jadwal ini sudah tercatat sebelumnya. Tidak perlu konfirmasi ulang.</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* QR Not Enabled Warning */}
          {!qrEnabled && !alreadySubmitted && !success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-4 sm:mb-6 p-4 sm:p-5 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-2 border-yellow-400 dark:border-yellow-600"
            >
              <div className="flex items-start gap-3 sm:gap-4 text-yellow-700 dark:text-yellow-400">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-yellow-500 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 sm:w-6 sm:h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base sm:text-lg mb-1">QR Code Belum Diaktifkan</p>
                  <p className="text-xs sm:text-sm">Dosen belum mengaktifkan QR code untuk absensi ini. Silakan tunggu hingga dosen mengaktifkan QR code terlebih dahulu.</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Action Buttons */}
          {!alreadySubmitted && !success && (
            <div className="space-y-2 sm:space-y-3">
              {/* Manual Submit Button */}
              <button
                onClick={handleSubmitAbsensi}
                disabled={submitting || !qrEnabled}
                className="w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base sm:text-lg shadow-sm"
              >
                {submitting ? (
                  <>
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faCheckCircle} />
                    <span>Konfirmasi Kehadiran Manual</span>
                  </>
                )}
              </button>

              {/* Jika QR belum aktif, tampilkan tombol Refresh Status */}
              {!qrEnabled ? (
                <button
                  onClick={fetchData}
                  disabled={loading}
                  className="w-full bg-gray-500 hover:bg-gray-600 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-base sm:text-lg shadow-sm"
                >
                  {loading ? (
                    <>
                      <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                      <span>Mengecek Status...</span>
                    </>
                  ) : (
                    <>
                      <FontAwesomeIcon icon={faRedo} />
                      <span>Cek Status QR Code</span>
                    </>
                  )}
                </button>
              ) : (
                <>
                  {/* Divider - hanya tampil jika QR aktif */}
                  <div className="relative py-2 sm:py-3">
                    <div className="absolute inset-0 flex items-center">
                      <div className="w-full border-t border-gray-300 dark:border-gray-600"></div>
                    </div>
                    <div className="relative flex justify-center text-xs sm:text-sm">
                      <span className="px-3 sm:px-4 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        Atau
                      </span>
                    </div>
                  </div>

                  {/* Scan Ulang Button - hanya tampil jika QR aktif */}
                  <button
                    onClick={() => navigate('/mahasiswa/absensi-kuliah-besar')}
                    className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-base sm:text-lg shadow-sm"
                  >
                    <FontAwesomeIcon icon={faCheckCircle} />
                    <span>Scan QR Code</span>
                  </button>
                </>
              )}
            </div>
          )}

          {/* Tombol Kembali - Tampilkan jika sudah submitted */}
          {(alreadySubmitted || success) && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-4 sm:mt-6"
            >
              <button
                onClick={() => navigate('/dashboard')}
                className="w-full bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 sm:py-4 px-4 sm:px-6 rounded-xl transition-colors flex items-center justify-center gap-2 text-base sm:text-lg shadow-sm"
              >
                <FontAwesomeIcon icon={faCheckCircle} />
                <span>Kembali ke Dashboard</span>
              </button>
            </motion.div>
          )}

        </motion.div>
      </div>
    </div>
  );
}

