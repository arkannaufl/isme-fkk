import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api, { handleApiError } from "../utils/api";
import { ChevronLeftIcon } from "../icons";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faUsers } from "@fortawesome/free-solid-svg-icons";

interface JadwalCSR {
  id: number;
  mata_kuliah_kode: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  jumlah_sesi: number;
  jenis_csr: "reguler" | "responsi";
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

interface AbsensiCSR {
  [npm: string]: {
    hadir: boolean;
    catatan: string;
  };
}

// Removed JadwalCSRData interface as it's not used

interface Mahasiswa {
  npm: string;
  nama: string;
  nim: string;
  gender: "L" | "P";
  ipk: number;
}

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

export default function AbsensiCSRPage() {
  const { kode, jadwalId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [jadwalCSR, setJadwalCSR] = useState<JadwalCSR | null>(null);
  const [mahasiswaList, setMahasiswaList] = useState<Mahasiswa[]>([]);
  const [absensi, setAbsensi] = useState<AbsensiCSR>({});
  const [savingAbsensi, setSavingAbsensi] = useState(false);
  const [includeInReport, setIncludeInReport] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [isReportSubmitted, setIsReportSubmitted] = useState(false);
  const [showCatatanModal, setShowCatatanModal] = useState(false);
  const [selectedMahasiswa, setSelectedMahasiswa] = useState<Mahasiswa | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);

  // Fetch jadwal CSR dan data mahasiswa
  useEffect(() => {
    const fetchData = async () => {
      if (!kode || !jadwalId) return;

      setLoading(true);
      try {
        // Fetch jadwal CSR detail - perlu menggunakan endpoint yang benar
        // Karena tidak ada endpoint GET untuk single jadwal CSR, kita akan ambil dari list
        const jadwalResponse = await api.get(`/csr/jadwal/${kode}`);
        const jadwalData = jadwalResponse.data.find(
          (j: JadwalCSR) => j.id === parseInt(jadwalId)
        );
        if (jadwalData) {
          setJadwalCSR(jadwalData);
        } else {
          throw new Error("Jadwal CSR tidak ditemukan");
        }

        // Fetch mahasiswa berdasarkan kelompok kecil
        if (jadwalData.kelompok_kecil_id) {
          const mahasiswaResponse = await api.get(
            `/kelompok-kecil/${jadwalData.kelompok_kecil_id}/mahasiswa`
          );
          const mahasiswa = mahasiswaResponse.data.map((m: Mahasiswa) => ({
            npm: m.nim,
            nama: m.nama || "",
            nim: m.nim || "",
            gender: m.gender || "L",
            ipk: m.ipk || 0.0,
          }));
          setMahasiswaList(mahasiswa);

          // Fetch data absensi yang sudah ada
          const absensiResponse = await api.get(
            `/csr/${kode}/jadwal/${jadwalId}/absensi`
          );
          const existingAbsensi: AbsensiCSR = {};

          // Handle response yang berbentuk object (keyBy) atau array
          if (absensiResponse.data.absensi) {
            if (Array.isArray(absensiResponse.data.absensi)) {
              // Jika response berupa array
              absensiResponse.data.absensi.forEach(
                (absen: {
                  mahasiswa_npm: string;
                  hadir: boolean;
                  catatan?: string;
                }) => {
                  existingAbsensi[absen.mahasiswa_npm] = {
                    hadir: absen.hadir || false,
                    catatan: absen.catatan || "",
                  };
                }
              );
            } else {
              // Jika response berupa object (keyBy)
              Object.keys(absensiResponse.data.absensi).forEach((npm) => {
                const absen = absensiResponse.data.absensi[npm];
                existingAbsensi[npm] = {
                  hadir: absen.hadir || false,
                  catatan: absen.catatan || "",
                };
              });
            }
          }
          setAbsensi(existingAbsensi);

          // Cek apakah laporan sudah pernah disubmit
          // Debug: log response untuk melihat struktur data
          console.log("Absensi response:", absensiResponse.data);

          let isSubmitted =
            absensiResponse.data.penilaian_submitted ||
            absensiResponse.data.report_submitted ||
            absensiResponse.data.submitted ||
            false;

          // Fallback: jika tidak ada flag submitted, cek apakah ada data absensi
          // yang menunjukkan bahwa laporan sudah pernah disubmit
          if (!isSubmitted && Object.keys(existingAbsensi).length > 0) {
            // Cek apakah ada mahasiswa yang sudah di-mark hadir
            const hasAttendanceData = Object.values(existingAbsensi).some(
              (absen) => absen.hadir === true || absen.catatan !== ""
            );

            if (hasAttendanceData) {
              // Jika ada data absensi, anggap sudah disubmit
              isSubmitted = true;
              console.log(
                "Fallback: Detected attendance data, marking as submitted"
              );
            }
          }

          console.log("Final is submitted:", isSubmitted);

          // Backup: simpan ke localStorage juga
          const storageKey = `csr_absensi_submitted_${kode}_${jadwalId}`;
          const storedSubmitted = localStorage.getItem(storageKey) === "true";

          // Gunakan data dari server atau dari localStorage
          const finalSubmitted = isSubmitted || storedSubmitted;

          console.log("Stored submitted:", storedSubmitted);
          console.log("Final submitted (with localStorage):", finalSubmitted);

          setIsReportSubmitted(finalSubmitted);
          setIncludeInReport(finalSubmitted);
        }
      } catch (error: unknown) {
        console.error("Error fetching data:", error);
        setError(handleApiError(error, "Memuat data absensi CSR"));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [kode, jadwalId]);

  // Fungsi untuk handle perubahan absensi
  const handleAbsensiChange = (npm: string, hadir: boolean) => {
    setAbsensi((prev) => ({
      ...prev,
      [npm]: {
        hadir: hadir,
        catatan: prev[npm]?.catatan || "",
      },
    }));
  };

  // Fungsi untuk handle perubahan catatan
  const handleCatatanChange = (npm: string, catatan: string) => {
    setAbsensi((prev) => ({
      ...prev,
      [npm]: {
        hadir: prev[npm]?.hadir || false,
        catatan: catatan,
      },
    }));
  };

  // Fungsi untuk membuka modal catatan
  const handleOpenCatatanModal = (mahasiswa: Mahasiswa) => {
    setSelectedMahasiswa(mahasiswa);
    setShowCatatanModal(true);
  };

  // Fungsi untuk menutup modal catatan
  const handleCloseCatatanModal = () => {
    setShowCatatanModal(false);
    setSelectedMahasiswa(null);
  };

  // Fungsi untuk menyimpan catatan dari modal
  const handleSaveCatatan = (catatan: string) => {
    if (selectedMahasiswa) {
      handleCatatanChange(selectedMahasiswa.npm, catatan);
    }
    handleCloseCatatanModal();
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

    setSavingAbsensi(true);
    try {
      const payload = {
        absensi: mahasiswaList.map((m) => ({
          mahasiswa_npm: m.npm,
          hadir: absensi[m.npm]?.hadir || false,
          catatan: absensi[m.npm]?.catatan || "",
        })),
        // Flag agar backend bisa menandai jadwal terhitung ke laporan
        penilaian_submitted: true,
      };

      await api.post(`/csr/${kode}/jadwal/${jadwalId}/absensi`, payload);

      // Refresh data absensi dari server setelah berhasil disimpan
      const absensiResponse = await api.get(
        `/csr/${kode}/jadwal/${jadwalId}/absensi`
      );
      const existingAbsensi: AbsensiCSR = {};

      // Handle response yang berbentuk object (keyBy) atau array
      if (absensiResponse.data.absensi) {
        if (Array.isArray(absensiResponse.data.absensi)) {
          // Jika response berupa array
          absensiResponse.data.absensi.forEach(
            (absen: {
              mahasiswa_npm: string;
              hadir: boolean;
              catatan?: string;
            }) => {
              existingAbsensi[absen.mahasiswa_npm] = {
                hadir: absen.hadir || false,
                catatan: absen.catatan || "",
              };
            }
          );
        } else {
          // Jika response berupa object (keyBy)
          Object.keys(absensiResponse.data.absensi).forEach((npm) => {
            const absen = absensiResponse.data.absensi[npm];
            existingAbsensi[npm] = {
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
      const storageKey = `csr_absensi_submitted_${kode}_${jadwalId}`;
      localStorage.setItem(storageKey, "true");

      // Tampilkan pesan sukses dan stay di halaman ini
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

  if (!jadwalCSR) {
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
          onClick={() => navigate(`/mata-kuliah/non-blok-csr/${kode}`)}
          className="flex items-center gap-2 text-brand-500 hover:text-brand-600 transition-all duration-300 ease-out hover:scale-105 transform mb-4"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Kembali
        </button>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
          Absensi CSR - {jadwalCSR.jenis_csr === "reguler" ? "CSR Reguler" : "CSR Responsi"}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Kelola absensi mahasiswa untuk CSR
        </p>
      </div>

      {/* Info Card */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 mb-8 shadow-sm">
        <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">Informasi Kelas</div>
        <div className="grid gap-4 grid-cols-1 md:grid-cols-6">
          {/* Row 1 */}
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Mata Kuliah</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {jadwalCSR.mata_kuliah_kode || "-"}
            </div>
          </div>
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Topik</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {jadwalCSR.topik || "-"}
            </div>
          </div>
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Kategori</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {jadwalCSR.kategori?.nama || "-"}
            </div>
          </div>

          {/* Row 2 */}
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Tanggal</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {new Date(jadwalCSR.tanggal).toLocaleDateString("id-ID", {
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
              {jadwalCSR.jam_mulai?.replace(".", ":")} - {jadwalCSR.jam_selesai?.replace(".", ":")}
            </div>
          </div>
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Ruangan</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {jadwalCSR.ruangan?.nama || "-"}
            </div>
          </div>

          {/* Row 3 */}
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Pengampu</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {jadwalCSR.dosen?.name || "-"}
            </div>
          </div>
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Kelompok</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {jadwalCSR.kelompok_kecil?.nama_kelompok
                ? `Kelompok ${jadwalCSR.kelompok_kecil.nama_kelompok}`
                : "-"}
            </div>
          </div>
          <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
            <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Durasi</div>
            <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
              {jadwalCSR.jumlah_sesi}x50 menit
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl shadow-sm p-4">
          <div className="text-sm text-gray-600 dark:text-gray-400 mb-1">Total Mahasiswa</div>
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{mahasiswaList.length}</div>
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
            {mahasiswaList.length > 0
              ? Math.round(
                  (Object.values(absensi).filter((a) => a.hadir).length /
                    mahasiswaList.length) *
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

      {/* Student List Table */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 overflow-hidden">
        <div className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                <FontAwesomeIcon icon={faUsers} className="w-5 h-5 text-white" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Daftar Mahasiswa ({mahasiswaList.length} orang)
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
                placeholder="Cari nama atau NIM ..."
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
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">NIM</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Nama</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">IPK</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    // Filter data berdasarkan search query
                    const filteredData = mahasiswaList.filter((m) => {
                      const q = searchQuery.trim().toLowerCase();
                      return q === "" || m.nama.toLowerCase().includes(q) || m.nim.toLowerCase().includes(q);
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
                                {searchQuery ? "Tidak ada data yang cocok dengan pencarian" : "Tidak ada mahasiswa dalam kelompok ini"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    }

                    return paginatedData.map((m, i) => {
                      const hadir = absensi[m.npm]?.hadir || false;
                      const globalIndex = (page - 1) * pageSize + i + 1;
                      return (
                        <tr
                          key={m.npm}
                          className={i % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""}
                        >
                          <td className="px-6 py-4 text-center text-gray-500 dark:text-gray-400">{globalIndex}</td>
                          <td className="px-6 py-4 font-mono tracking-wide text-gray-700 dark:text-gray-200">{m.nim}</td>
                          <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                            <div className="flex items-center gap-2">
                              <span>{m.nama}</span>
                              <span
                                className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                  m.gender === "L"
                                    ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                    : "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300"
                                }`}
                              >
                                {m.gender === "L" ? "👨" : "👩"}
                              </span>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-gray-900 dark:text-white font-medium">
                            {m.ipk.toFixed(2)}
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
                                    handleAbsensiChange(m.npm, e.target.checked)
                                  }
                                  disabled={savingAbsensi}
                                  className={`w-6 h-6 appearance-none rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 relative
                                    ${hadir ? "border-brand-500 bg-brand-500" : "border-gray-300 bg-white dark:bg-gray-900 dark:border-gray-700"} disabled:opacity-50 disabled:cursor-not-allowed`}
                                  style={{ outline: "none" }}
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
                                onClick={() => handleOpenCatatanModal(m)}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/20 rounded-lg transition-all duration-200"
                                title="Tambah/Edit Catatan"
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
            const filteredData = mahasiswaList.filter((m) => {
              const q = searchQuery.trim().toLowerCase();
              return q === "" || m.nama.toLowerCase().includes(q) || m.nim.toLowerCase().includes(q);
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
          onClick={() => navigate(`/mata-kuliah/non-blok-csr/${kode}`)}
          className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 shadow-sm"
        >
          Batal
        </button>
        <button
          onClick={handleSaveAbsensi}
          disabled={
            savingAbsensi ||
            mahasiswaList.length === 0 ||
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

      {/* Modal Catatan */}
      <AnimatePresence>
        {showCatatanModal && selectedMahasiswa && (
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
                      Catatan Mahasiswa
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      {selectedMahasiswa.nama} ({selectedMahasiswa.nim})
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Catatan untuk {selectedMahasiswa.nama}
                    </label>
                    <textarea
                      value={absensi[selectedMahasiswa.npm]?.catatan || ""}
                      onChange={(e) => {
                        const newCatatan = e.target.value;
                        setAbsensi((prev) => ({
                          ...prev,
                          [selectedMahasiswa.npm]: {
                            hadir: prev[selectedMahasiswa.npm]?.hadir || false,
                            catatan: newCatatan,
                          },
                        }));
                      }}
                      placeholder="Masukkan catatan untuk mahasiswa ini..."
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl dark:bg-gray-700 dark:text-white resize-none"
                      rows={4}
                      autoFocus
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
                    onClick={() => handleSaveCatatan(absensi[selectedMahasiswa.npm]?.catatan || "")}
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
