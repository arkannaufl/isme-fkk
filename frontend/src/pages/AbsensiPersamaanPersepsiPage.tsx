import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api, { handleApiError, getUser } from "../utils/api";
import { ChevronLeftIcon } from "../icons";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers } from "@fortawesome/free-solid-svg-icons";

interface JadwalPersamaanPersepsi {
  id: number;
  mata_kuliah_kode: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  jumlah_sesi: number;
  topik?: string;
  dosen_ids: number[];
  koordinator_ids?: number[];
  koordinator_names?: string;
  pengampu_names?: string;
  dosen_with_roles?: Array<{
    id: number;
    name: string;
    peran: string;
    peran_display: string;
    is_koordinator: boolean;
  }>;
  ruangan?: {
    id: number;
    nama: string;
    kapasitas?: number;
    gedung?: string;
  };
}

interface AbsensiPersamaanPersepsi {
  [dosenId: string]: {
    hadir: boolean;
    catatan: string;
  };
}

interface Dosen {
  id: number;
  name: string;
  nid?: string;
  peran: string;
  peran_display: string;
  is_koordinator: boolean;
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

export default function AbsensiPersamaanPersepsiPage() {
  const { kode, jadwalId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jadwal, setJadwal] = useState<JadwalPersamaanPersepsi | null>(null);
  const [dosenList, setDosenList] = useState<Dosen[]>([]);
  const [absensi, setAbsensi] = useState<AbsensiPersamaanPersepsi>({});
  const [savingAbsensi, setSavingAbsensi] = useState(false);
  const [includeInReport, setIncludeInReport] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isReportSubmitted, setIsReportSubmitted] = useState(false);
  const [showCatatanModal, setShowCatatanModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [selectedDosen, setSelectedDosen] = useState<Dosen | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  // Fetch jadwal Persamaan Persepsi dan data dosen
  useEffect(() => {
    const fetchData = async () => {
      if (!kode || !jadwalId) return;

      setLoading(true);
      try {
        // Fetch jadwal Persamaan Persepsi detail
        const jadwalResponse = await api.get(`/persamaan-persepsi/jadwal/${kode}`);
        const jadwalData = jadwalResponse.data.find(
          (j: JadwalPersamaanPersepsi) => j.id === parseInt(jadwalId)
        );
        if (jadwalData) {
          setJadwal(jadwalData);

          // Buat list dosen dari dosen_with_roles jika ada, atau dari koordinator_ids + dosen_ids
          let allDosen: Dosen[] = [];
          let allDosenData: any[] = []; // Untuk menyimpan hasil fetch agar bisa digunakan ulang
          
          // Jika ada dosen_with_roles dari response, gunakan itu
          if (jadwalData.dosen_with_roles && jadwalData.dosen_with_roles.length > 0) {
            // Ambil detail dosen untuk mendapatkan nid
            const allDosenIds = jadwalData.dosen_with_roles.map((d: any) => d.id);
            const dosenResponse = await api.get(`/users?role=dosen`);
            allDosenData = Array.isArray(dosenResponse.data) 
              ? dosenResponse.data 
              : dosenResponse.data.data || dosenResponse.data || [];
            
            allDosen = jadwalData.dosen_with_roles.map((d: any) => {
              const dosenDetail = allDosenData.find((dd: any) => dd.id === d.id);
              return {
                id: d.id,
                name: d.name,
                nid: dosenDetail?.nid || dosenDetail?.username || "",
                peran: d.peran || (d.is_koordinator ? "koordinator" : "dosen_mengajar"),
                peran_display: d.peran_display || (d.is_koordinator ? "Koordinator" : "Dosen Mengajar"),
                is_koordinator: d.is_koordinator || false,
              };
            });
          } else {
            // Fallback: buat dari koordinator_ids + dosen_ids
            const allDosenIds = [
              ...(jadwalData.koordinator_ids || []),
              ...(jadwalData.dosen_ids || [])
            ].filter((id, index, self) => self.indexOf(id) === index); // Remove duplicates
            
            if (allDosenIds.length > 0) {
              const dosenResponse = await api.get(`/users?role=dosen`);
              allDosenData = Array.isArray(dosenResponse.data) 
                ? dosenResponse.data 
                : dosenResponse.data.data || dosenResponse.data || [];
              
              const koordinatorIds = jadwalData.koordinator_ids || [];
              
              allDosen = allDosenIds.map((id: number) => {
                const dosenDetail = allDosenData.find((d: any) => d.id === id);
                const isKoordinator = koordinatorIds.includes(id);
                
                return {
                  id: id,
                  name: dosenDetail?.name || "",
                  nid: dosenDetail?.nid || dosenDetail?.username || "",
                  peran: isKoordinator ? "koordinator" : "dosen_mengajar",
                  peran_display: isKoordinator ? "Koordinator" : "Dosen Mengajar",
                  is_koordinator: isKoordinator,
                };
              });
            }
          }

          // Pastikan dosen yang sedang login (koordinator) selalu ada di daftar
          const currentUser = getUser();
          if (currentUser && currentUser.id) {
            const currentUserId = Number(currentUser.id);
            const isCurrentUserInList = allDosen.some(d => d.id === currentUserId);
            
            if (!isCurrentUserInList) {
              // Jika user yang sedang login belum ada di daftar, tambahkan
              // Gunakan data yang sudah di-fetch sebelumnya, atau fetch baru jika belum ada
              if (allDosenData.length === 0) {
                const dosenResponse = await api.get(`/users?role=dosen`);
                allDosenData = Array.isArray(dosenResponse.data) 
                  ? dosenResponse.data 
                  : dosenResponse.data.data || dosenResponse.data || [];
              }
              
              const currentUserDetail = allDosenData.find((d: any) => d.id === currentUserId);
              const koordinatorIds = jadwalData.koordinator_ids || [];
              const isKoordinator = koordinatorIds.includes(currentUserId);
              
              if (currentUserDetail) {
                allDosen.push({
                  id: currentUserId,
                  name: currentUserDetail.name || "",
                  nid: currentUserDetail.nid || currentUserDetail.username || "",
                  peran: isKoordinator ? "koordinator" : "dosen_mengajar",
                  peran_display: isKoordinator ? "Koordinator" : "Dosen Mengajar",
                  is_koordinator: isKoordinator,
                });
              }
            }
          }

          setDosenList(allDosen);

          // Fetch data absensi yang sudah ada
          const absensiResponse = await api.get(
            `/persamaan-persepsi/${kode}/jadwal/${jadwalId}/absensi`
          );
          const existingAbsensi: AbsensiPersamaanPersepsi = {};

          // Handle response yang berbentuk object (keyBy) atau array
          if (absensiResponse.data.absensi) {
            if (Array.isArray(absensiResponse.data.absensi)) {
              // Jika response berupa array
              absensiResponse.data.absensi.forEach(
                (absen: {
                  dosen_id: number;
                  hadir: boolean;
                  catatan?: string;
                }) => {
                  existingAbsensi[absen.dosen_id.toString()] = {
                    hadir: absen.hadir || false,
                    catatan: absen.catatan || "",
                  };
                }
              );
            } else {
              // Jika response berupa object (keyBy) - key adalah dosen_id
              Object.keys(absensiResponse.data.absensi).forEach((dosenId) => {
                const absen = absensiResponse.data.absensi[dosenId];
                existingAbsensi[dosenId] = {
                  hadir: absen.hadir || false,
                  catatan: absen.catatan || "",
                };
              });
            }
          }
          
          // Jika response langsung berupa Collection (Laravel Collection), convert ke array dulu
          if (!absensiResponse.data.absensi && absensiResponse.data) {
            const absensiData = absensiResponse.data;
            if (Array.isArray(absensiData)) {
              absensiData.forEach(
                (absen: {
                  dosen_id: number;
                  hadir: boolean;
                  catatan?: string;
                }) => {
                  existingAbsensi[absen.dosen_id.toString()] = {
                    hadir: absen.hadir || false,
                    catatan: absen.catatan || "",
                  };
                }
              );
            }
          }
          // Auto-check koordinator sebagai hadir
          const updatedAbsensi: AbsensiPersamaanPersepsi = { ...existingAbsensi };
          allDosen.forEach((dosen) => {
            if (dosen.is_koordinator) {
              // Jika koordinator belum ada di absensi atau belum di-set sebagai hadir, set otomatis hadir
              if (!updatedAbsensi[dosen.id.toString()] || !updatedAbsensi[dosen.id.toString()].hadir) {
                updatedAbsensi[dosen.id.toString()] = {
                  hadir: true,
                  catatan: updatedAbsensi[dosen.id.toString()]?.catatan || "",
                };
              }
            }
          });

          setAbsensi(updatedAbsensi);

          // Cek apakah laporan sudah pernah disubmit
          // Hanya percaya pada flag dari backend, jangan gunakan fallback berdasarkan data absensi
          // karena auto-check koordinator bisa membuat false positive
          // Backend selalu memberikan flag (true/false), jadi hanya percaya pada backend
          const penilaianSubmitted = absensiResponse.data.penilaian_submitted === true;
          const reportSubmitted = absensiResponse.data.report_submitted === true;
          const submitted = absensiResponse.data.submitted === true;
          
          // Hanya set submitted jika backend secara eksplisit mengembalikan true
          // Jika false/null/undefined, berarti belum submitted
          const isSubmitted = penilaianSubmitted || reportSubmitted || submitted;

          setIsReportSubmitted(isSubmitted);
          setIncludeInReport(isSubmitted);
        } else {
          throw new Error("Jadwal Persamaan Persepsi tidak ditemukan");
        }
      } catch (error: unknown) {
        console.error("Error fetching data:", error);
        setError(handleApiError(error, "Memuat data absensi Persamaan Persepsi"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [kode, jadwalId]);

  // Fungsi untuk handle perubahan absensi
  const handleAbsensiChange = (dosenId: number, hadir: boolean) => {
    // Cek apakah dosen adalah koordinator
    const dosen = dosenList.find((d) => d.id === dosenId);
    const isKoordinator = dosen?.is_koordinator || false;

    // Jika koordinator dan user mencoba uncheck, jangan izinkan
    if (isKoordinator && !hadir) {
      // Koordinator selalu hadir, tidak bisa di-uncheck
      return;
    }

    setAbsensi((prev) => ({
      ...prev,
      [dosenId.toString()]: {
        hadir: hadir,
        catatan: prev[dosenId.toString()]?.catatan || "",
      },
    }));
  };

  // Fungsi untuk handle perubahan catatan
  const handleCatatanChange = (dosenId: number, catatan: string) => {
    setAbsensi((prev) => ({
      ...prev,
      [dosenId.toString()]: {
        hadir: prev[dosenId.toString()]?.hadir || false,
        catatan: catatan,
      },
    }));
  };

  // Fungsi untuk membuka modal catatan
  const handleOpenCatatanModal = (dosen: Dosen) => {
    setSelectedDosen(dosen);
    setShowCatatanModal(true);
  };

  // Fungsi untuk menutup modal catatan
  const handleCloseCatatanModal = () => {
    setShowCatatanModal(false);
    setSelectedDosen(null);
  };

  // Fungsi untuk menyimpan catatan dari modal
  const handleSaveCatatan = (catatan: string) => {
    if (selectedDosen) {
      handleCatatanChange(selectedDosen.id, catatan);
    }
    handleCloseCatatanModal();
  };

  // Fungsi untuk membuka modal konfirmasi
  const handleOpenConfirmModal = () => {
    if (!kode || !jadwalId) return;

    if (!includeInReport) {
      alert(
        'Centang "Masukkan ke Laporan" untuk menyimpan dan memasukkan realisasi ke PDF.'
      );
      return;
    }

    setShowConfirmModal(true);
  };

  // Fungsi untuk menutup modal konfirmasi
  const handleCloseConfirmModal = () => {
    setShowConfirmModal(false);
  };

  // Fungsi untuk menyimpan absensi
  const handleSaveAbsensi = async () => {
    if (!kode || !jadwalId) return;

    if (!includeInReport) {
      alert(
        'Centang "Masukkan ke Laporan" untuk menyimpan dan memasukkan realisasi ke PDF.'
      );
      return;
    }

    // Tutup modal konfirmasi
    setShowConfirmModal(false);

    setSavingAbsensi(true);
    try {
      const payload = {
        absensi: dosenList.map((d) => ({
          dosen_id: d.id,
          hadir: absensi[d.id.toString()]?.hadir || false,
          catatan: absensi[d.id.toString()]?.catatan || "",
        })),
        penilaian_submitted: true,
      };

      await api.post(`/persamaan-persepsi/${kode}/jadwal/${jadwalId}/absensi`, payload);

      // Refresh data absensi dari server setelah berhasil disimpan
      const absensiResponse = await api.get(
        `/persamaan-persepsi/${kode}/jadwal/${jadwalId}/absensi`
      );
      const existingAbsensi: AbsensiPersamaanPersepsi = {};

      // Handle response yang berbentuk object (keyBy) atau array
      if (absensiResponse.data.absensi) {
        if (Array.isArray(absensiResponse.data.absensi)) {
          absensiResponse.data.absensi.forEach(
            (absen: {
              dosen_id: number;
              hadir: boolean;
              catatan?: string;
            }) => {
              existingAbsensi[absen.dosen_id.toString()] = {
                hadir: absen.hadir || false,
                catatan: absen.catatan || "",
              };
            }
          );
        } else {
          Object.keys(absensiResponse.data.absensi).forEach((dosenId) => {
            const absen = absensiResponse.data.absensi[dosenId];
            existingAbsensi[dosenId] = {
              hadir: absen.hadir || false,
              catatan: absen.catatan || "",
            };
          });
        }
      }
      setAbsensi(existingAbsensi);

      // Update status laporan sudah disubmit
      setIsReportSubmitted(true);
      setIncludeInReport(true);

      // Simpan ke localStorage sebagai backup
      const storageKey = `persamaan_persepsi_absensi_submitted_${kode}_${jadwalId}`;
      localStorage.setItem(storageKey, "true");

      // Tampilkan pesan sukses
      setShowSuccessMessage(true);

      // Auto-hide pesan sukses setelah 3 detik
      setTimeout(() => {
        setShowSuccessMessage(false);
      }, 3000);
    } catch (error: unknown) {
      console.error("Error saving absensi:", error);
      setError(handleApiError(error, "Menyimpan absensi"));
    } finally {
      setSavingAbsensi(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full mx-auto">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-8 w-80 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse" />
          <div className="h-4 w-96 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
        </div>

        {/* Info Card skeleton */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-8">
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
          <div className="grid gap-4 grid-cols-1 md:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
                <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>

        {/* Stats Cards skeleton */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-4">
              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
              <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
          <div className="p-6">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-3">
              <div className="h-6 w-0" />
              <div className="h-10 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            </div>
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              <div className="max-w-full overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                  <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900">
                    <tr>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <th key={i} className="px-6 py-4">
                          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <tr key={i} className={i % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""}>
                        {Array.from({ length: 6 }).map((_, j) => (
                          <td key={j} className="px-6 py-4">
                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        {/* Action buttons skeleton */}
        <div className="flex justify-end gap-4 pt-8">
          <div className="h-10 w-16 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse" />
          <div className="h-10 w-32 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mx-auto">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl p-8">
          <div className="flex items-center gap-3">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <div>
              <h3 className="text-lg font-semibold text-red-800 dark:text-red-200">
                Error
              </h3>
              <p className="text-red-600 dark:text-red-300">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!jadwal) {
    return (
      <div className="w-full mx-auto">
        <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Data jadwal tidak ditemukan
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto">
      {/* Success Message */}
      <AnimatePresence>
        {showSuccessMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                <svg
                  className="w-5 h-5 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-green-800 dark:text-green-200">
                  Absensi Berhasil Disimpan!
                </h3>
                <p className="text-green-600 dark:text-green-300 text-sm">
                  Data absensi telah tersimpan dan akan dimasukkan ke dalam laporan.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate(`/dashboard-dosen`)}
          className="flex items-center gap-2 text-brand-500 hover:text-brand-600 transition-all duration-300 ease-out hover:scale-105 transform mb-4"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Kembali
        </button>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
          Absensi Persamaan Persepsi
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Kelola absensi dosen untuk Persamaan Persepsi
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-8 shadow-sm">
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">Informasi Jadwal</div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-6">
          {/* Row 1 */}
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Mata Kuliah</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {jadwal.mata_kuliah_kode || "-"}
            </div>
          </div>
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Topik</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {jadwal.topik || "-"}
            </div>
          </div>
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Ruangan</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {(jadwal as any).use_ruangan && jadwal.ruangan?.nama
                ? jadwal.ruangan.nama
                : "Online"}
            </div>
          </div>

          {/* Row 2 */}
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Tanggal</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {new Date(jadwal.tanggal).toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Waktu</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {jadwal.jam_mulai?.replace(".", ":")} - {jadwal.jam_selesai?.replace(".", ":")}
            </div>
          </div>
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Durasi</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {jadwal.jumlah_sesi}x50 menit
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Dosen</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{dosenList.length}</div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Hadir</div>
          <div className="text-2xl font-bold text-green-600">
            {Object.values(absensi).filter((a) => a.hadir).length}
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Persentase</div>
          <div className="text-2xl font-bold text-purple-600">
            {dosenList.length > 0
              ? Math.round(
                  (Object.values(absensi).filter((a) => a.hadir).length /
                    dosenList.length) *
                    100
                )
              : 0}
            %
          </div>
        </div>
      </div>

      {/* Masuk Laporan Section */}
      <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
              Masuk Laporan
            </h4>
            <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <span className="text-base leading-none">
                  {isReportSubmitted ? "✅" : "⚠️"}
                </span>
                <div>
                  <span className="font-medium text-gray-700 dark:text-gray-300">
                    {isReportSubmitted
                      ? "Laporan sudah disubmit dan tersimpan"
                      : "Wajib dicentang untuk menyimpan absensi"}
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex-shrink-0">
            <label
              className={`flex items-center gap-3 cursor-pointer ${
                isReportSubmitted ? "cursor-not-allowed" : ""
              }`}
            >
              <div className="relative">
                <input
                  type="checkbox"
                  checked={includeInReport}
                  onChange={(e) =>
                    !isReportSubmitted &&
                    setIncludeInReport(e.target.checked)
                  }
                  disabled={isReportSubmitted}
                  className="sr-only"
                />
                <div
                  className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-all duration-200 ${
                    includeInReport
                      ? isReportSubmitted
                        ? "bg-green-500 border-green-500"
                        : "bg-brand-500 border-brand-500"
                      : "border-gray-300 dark:border-gray-600 hover:border-brand-400"
                  } ${isReportSubmitted ? "cursor-not-allowed" : ""}`}
                >
                  {includeInReport && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  )}
                </div>
              </div>
              <span className="text-sm font-medium text-gray-900 dark:text-white">
                Masuk Laporan {!isReportSubmitted && <span className="text-red-500">*</span>}
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* Warning untuk mengingatkan user mengabsen diri sendiri */}
      {(() => {
        const currentUser = getUser();
        const currentUserId = currentUser ? Number(currentUser.id) : null;
        const currentUserAbsensi = currentUserId ? absensi[currentUserId.toString()] : null;
        const currentUserHadir = currentUserAbsensi?.hadir || false;
        const showWarning = currentUserId && !isReportSubmitted && !currentUserHadir && dosenList.some(d => d.id === currentUserId);
        
        if (showWarning) {
          return (
            <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <div className="flex items-start gap-3">
                <span className="text-xl leading-none">⚠️</span>
                <div className="flex-1">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
                    Jangan lupa untuk mengabsen diri Anda sendiri!
                  </p>
                  <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                    Pastikan Anda telah mencentang checkbox hadir untuk nama Anda sendiri sebelum menyimpan laporan. Absensi Anda diperlukan agar masuk ke dalam laporan.
                  </p>
                </div>
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Dosen List Table */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                <FontAwesomeIcon icon={faUsers} className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Daftar Dosen ({dosenList.length} orang)
              </h3>
            </div>
            <div className="relative w-full max-w-xs ml-auto">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                  <circle cx="11" cy="11" r="8" />
                  <line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
              </span>
              <input
                type="text"
                className="pl-10 pr-4 py-2 w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-brand-400 focus:border-brand-500 text-gray-700 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-gray-300 outline-none"
                placeholder="Cari nama atau NID ..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <div
              className="max-w-full overflow-x-auto hide-scroll"
              style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
            >
              <style>{`
                .max-w-full::-webkit-scrollbar { display: none; }
                .hide-scroll { 
                  -ms-overflow-style: none;
                  scrollbar-width: none;
                }
                .hide-scroll::-webkit-scrollbar {
                  display: none;
                }
              `}</style>
              <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">#</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">NID/NIP</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Nama</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Peran</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Filter data berdasarkan search query
                    const filteredData = dosenList.filter((d) => {
                      const q = searchQuery.trim().toLowerCase();
                      return q === "" || d.name.toLowerCase().includes(q) || (d.nid && d.nid.toLowerCase().includes(q));
                    });

                    // Pagination
                    const totalPages = Math.ceil(filteredData.length / pageSize);
                    const paginatedData = filteredData.slice(
                      (page - 1) * pageSize,
                      page * pageSize
                    );

                    if (filteredData.length === 0) {
                      return (
                        <tr>
                          <td colSpan={6} className="px-6 py-16 text-center">
                            <div className="flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500">
                              <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1 4h.01M12 9h.01" />
                                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                              </svg>
                              <span className="bg-gray-100 dark:bg-gray-800/60 rounded-full px-5 py-2 mt-1 font-medium">
                                {searchQuery ? "Tidak ada data yang cocok dengan pencarian" : "Tidak ada dosen dalam jadwal ini"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return paginatedData.map((d, i) => {
                      const hadir = absensi[d.id.toString()]?.hadir || false;
                      const globalIndex = (page - 1) * pageSize + i + 1;
                      return (
                        <tr
                          key={d.id}
                          className={i % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""}
                        >
                          <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">{globalIndex}</td>
                          <td className="px-6 py-4 font-mono tracking-wide text-gray-700 dark:text-gray-200">{d.nid || "-"}</td>
                          <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                            {d.name}
                          </td>
                          <td className="px-6 py-4">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                d.is_koordinator
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300"
                                  : "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                              }`}
                            >
                              {d.peran_display}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                                hadir
                                  ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                                  : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                              }`}
                            >
                              {hadir ? "Hadir" : "Tidak Hadir"}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="flex items-center justify-center gap-2">
                              <div className="relative flex items-center justify-center select-none mx-auto" style={{ width: 24, height: 24 }}>
                                <input
                                  type="checkbox"
                                  checked={hadir}
                                  onChange={(e) =>
                                    handleAbsensiChange(d.id, e.target.checked)
                                  }
                                  disabled={savingAbsensi || isReportSubmitted || d.is_koordinator}
                                  className={`w-6 h-6 appearance-none rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 relative
                                    ${hadir ? "border-brand-500 bg-brand-500" : "border-gray-300 bg-white dark:bg-gray-900 dark:border-gray-700"} disabled:opacity-50 disabled:cursor-not-allowed`}
                                  style={{ outline: "none" }}
                                  title={d.is_koordinator ? "Koordinator otomatis hadir" : ""}
                                />
                                {hadir && (
                                  <span style={{ position: "absolute", left: 0, top: 0, width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
                                    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2.5" style={{ display: "block" }}>
                                      <polyline points="5 11 9 15 15 7" fill="none" stroke="white" strokeWidth="2.5" />
                                    </svg>
                                  </span>
                                )}
                              </div>
                              <button
                                onClick={() => handleOpenCatatanModal(d)}
                                disabled={isReportSubmitted}
                                className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all duration-200 ${
                                  isReportSubmitted ? "opacity-50 cursor-not-allowed" : ""
                                }`}
                                title={isReportSubmitted ? "Tidak bisa diubah setelah submit" : "Tambah/Edit Catatan"}
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                </svg>
                                Catatan
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    });
                  })()}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {(() => {
            const filteredData = dosenList.filter((d) => {
              const q = searchQuery.trim().toLowerCase();
              return q === "" || d.name.toLowerCase().includes(q) || (d.nid && d.nid.toLowerCase().includes(q));
            });
            const totalPages = Math.ceil(filteredData.length / pageSize);
            const paginatedData = filteredData.slice(
              (page - 1) * pageSize,
              page * pageSize
            );

            if (filteredData.length === 0) return null;

            return (
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-4 mt-4">
                <div className="flex items-center gap-4">
                  <select
                    id="perPage"
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none"
                  >
                    {PAGE_SIZE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Menampilkan {paginatedData.length} dari {filteredData.length} data
                  </span>
                </div>
                <div className="flex items-center gap-2 justify-center sm:justify-end">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    Prev
                  </button>

                  {/* Smart Pagination with Scroll */}
                  <div
                    className="flex items-center gap-1 max-w-[400px] overflow-x-auto pagination-scroll"
                    style={{
                      scrollbarWidth: "thin",
                      scrollbarColor: "#cbd5e1 #f1f5f9",
                    }}
                  >
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

                    {/* Always show first page */}
                    <button
                      onClick={() => setPage(1)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                        page === 1
                          ? "bg-brand-500 text-white"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      1
                    </button>

                    {/* Show ellipsis if current page is far from start */}
                    {page > 4 && (
                      <span className="px-2 text-gray-500 dark:text-gray-400">
                        ...
                      </span>
                    )}

                    {/* Show pages around current page */}
                    {Array.from({ length: totalPages }, (_, i) => {
                      const pageNum = i + 1;
                      const shouldShow =
                        pageNum > 1 &&
                        pageNum < totalPages &&
                        pageNum >= page - 2 &&
                        pageNum <= page + 2;

                      if (!shouldShow) return null;

                      return (
                        <button
                          key={i}
                          onClick={() => setPage(pageNum)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                            page === pageNum
                              ? "bg-brand-500 text-white"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}

                    {/* Show ellipsis if current page is far from end */}
                    {page < totalPages - 3 && (
                      <span className="px-2 text-gray-500 dark:text-gray-400">
                        ...
                      </span>
                    )}

                    {/* Always show last page if more than 1 page */}
                    {totalPages > 1 && (
                      <button
                        onClick={() => setPage(totalPages)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                          page === totalPages
                            ? "bg-brand-500 text-white"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        {totalPages}
                      </button>
                    )}
                  </div>

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                  >
                    Next
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-4 pt-8">
        <button
          onClick={() => navigate(`/dashboard-dosen`)}
          className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm"
        >
          Batal
        </button>
        <button
          onClick={handleOpenConfirmModal}
          disabled={
            savingAbsensi ||
            dosenList.length === 0 ||
            !includeInReport ||
            isReportSubmitted
          }
          className={`px-6 py-3 rounded-xl text-white text-sm font-medium shadow-sm hover:shadow-md transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
            isReportSubmitted
              ? "bg-green-500 hover:bg-green-600"
              : "bg-brand-500 hover:bg-brand-600"
          }`}
        >
          {savingAbsensi && (
            <svg
              className="w-4 h-4 animate-spin"
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
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              ></path>
            </svg>
          )}
          {savingAbsensi
            ? "Menyimpan..."
            : isReportSubmitted
            ? "Laporan Sudah Disubmit ✓"
            : !includeInReport
            ? "Centang 'Masuk Laporan' terlebih dahulu"
            : "Simpan Absensi"}
        </button>
      </div>

      {/* Modal Konfirmasi Submit */}
      <AnimatePresence>
        {showConfirmModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => handleCloseConfirmModal()}
            ></motion.div>
            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              {/* Close Button */}
              <button
                onClick={() => handleCloseConfirmModal()}
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
              
              <div className="text-center">
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-amber-100 dark:bg-amber-900/20 mb-4">
                  <svg
                    className="h-8 w-8 text-amber-600 dark:text-amber-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-2">
                  Konfirmasi Submit Absensi
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Apakah Anda yakin ingin menyimpan absensi ini?
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-500 mb-6">
                  Setelah disubmit, data absensi tidak dapat diubah lagi. Pastikan semua data sudah benar.
                </p>

                <div className="flex justify-center gap-3">
                  <button
                    onClick={() => handleCloseConfirmModal()}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSaveAbsensi}
                    disabled={savingAbsensi}
                    className="px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                  >
                    {savingAbsensi && (
                      <svg
                        className="w-4 h-4 animate-spin"
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
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                    Ya, Simpan
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Catatan */}
      <AnimatePresence>
        {showCatatanModal && selectedDosen && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => handleCloseCatatanModal()}
            ></motion.div>
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
                onClick={() => handleCloseCatatanModal()}
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
                      Catatan Dosen
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {selectedDosen.name} {selectedDosen.nid && `(${selectedDosen.nid})`}
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Catatan untuk {selectedDosen.name}
                    </label>
                    <textarea
                      value={absensi[selectedDosen.id.toString()]?.catatan || ""}
                      onChange={(e) => {
                        const newCatatan = e.target.value;
                        setAbsensi((prev) => ({
                          ...prev,
                          [selectedDosen.id.toString()]: {
                            hadir: prev[selectedDosen.id.toString()]?.hadir || false,
                            catatan: newCatatan,
                          },
                        }));
                      }}
                      disabled={isReportSubmitted}
                      placeholder="Masukkan catatan untuk dosen ini..."
                      className={`w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white resize-none ${
                        isReportSubmitted ? "opacity-50 cursor-not-allowed" : ""
                      }`}
                      rows={4}
                      autoFocus={!isReportSubmitted}
                    />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                      Catatan ini akan tersimpan bersama data absensi
                    </p>
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 relative z-20">
                  <button
                    onClick={() => handleCloseCatatanModal()}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => handleSaveCatatan(absensi[selectedDosen.id.toString()]?.catatan || "")}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-brand-500 hover:bg-brand-600 text-white text-xs sm:text-sm font-medium transition-all duration-300 ease-in-out"
                  >
                    Simpan Catatan
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

