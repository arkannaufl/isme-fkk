import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import api, { handleApiError } from "../utils/api";
import { ChevronLeftIcon } from "../icons";
import { motion, AnimatePresence } from "framer-motion";

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
        <div className="h-8 w-80 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
        <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-8" />

        {/* Content skeleton */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-8">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
              />
            ))}
          </div>
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
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -50 }}
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
                  Data absensi telah tersimpan dan akan dimasukkan ke dalam
                  laporan.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="pt-6 pb-2">
        <button
          onClick={() => navigate(`/mata-kuliah/non-blok-csr/${kode}`)}
          className="flex items-center gap-2 text-brand-500 font-medium hover:text-brand-600 transition px-0 py-0 bg-transparent shadow-none"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          Kembali ke Detail CSR
        </button>
      </div>
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
        Absensi CSR -{" "}
        {jadwalCSR.jenis_csr === "reguler" ? "CSR Reguler" : "CSR Responsi"}
      </h1>
      <p className="text-gray-500 dark:text-gray-400 text-base mb-8">
        {new Date(jadwalCSR.tanggal).toLocaleDateString("id-ID", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })}{" "}
        • {jadwalCSR.jam_mulai?.replace(".", ":")}–
        {jadwalCSR.jam_selesai?.replace(".", ":")}
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Panel - Session Info */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
                <svg
                  className="w-4 h-4 text-white"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Informasi Sesi
              </h3>
            </div>

            <div className="space-y-4">
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Pengampu
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {jadwalCSR.dosen?.name || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Ruangan
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {jadwalCSR.ruangan?.nama || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Kelompok
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {jadwalCSR.kelompok_kecil?.nama_kelompok
                    ? `Kelompok ${jadwalCSR.kelompok_kecil.nama_kelompok}`
                    : "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Topik
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {jadwalCSR.topik || "-"}
                </p>
              </div>

              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-1">
                  Durasi
                </p>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">
                  {jadwalCSR.jumlah_sesi}x50 menit
                </p>
              </div>

              {/* Masuk Laporan Checkbox */}
              <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                <label
                  className={`flex items-center space-x-3 ${
                    isReportSubmitted ? "cursor-not-allowed" : "cursor-pointer"
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
                          : "border-red-300 dark:border-red-600 hover:border-red-400"
                      }`}
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
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      Masuk Laporan{" "}
                      {!isReportSubmitted && (
                        <span className="text-red-500">*</span>
                      )}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {isReportSubmitted
                        ? "✅ Laporan sudah disubmit dan tersimpan"
                        : "⚠️ Wajib dicentang untuk menyimpan absensi"}
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Panel - Student List */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <svg
                    className="w-4 h-4 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  Daftar Mahasiswa ({mahasiswaList.length} orang)
                </h3>
              </div>

              {/* Summary Stats */}
              <div className="flex items-center gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {Object.values(absensi).filter((a) => a.hadir).length}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Hadir
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-600 dark:text-red-400">
                    {Object.values(absensi).filter((a) => !a.hadir).length}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Tidak Hadir
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-3">
              {mahasiswaList.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg
                      className="w-8 h-8 text-gray-400 dark:text-gray-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                      />
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
                  <motion.div
                    key={mahasiswa.npm}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={`bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer border-2 ${
                      absensi[mahasiswa.npm]?.hadir
                        ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20"
                        : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                    }`}
                    onClick={() =>
                      handleAbsensiChange(
                        mahasiswa.npm,
                        !absensi[mahasiswa.npm]?.hadir
                      )
                    }
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4">
                        <div className="w-8 h-8 bg-brand-100 dark:bg-brand-900/20 rounded-lg flex items-center justify-center">
                          <span className="text-sm font-semibold text-brand-600 dark:text-brand-400">
                            {index + 1}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center space-x-2 mb-1">
                            <h4 className="font-semibold text-gray-800 dark:text-white">
                              {mahasiswa.nama}
                            </h4>
                            <span
                              className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                mahasiswa.gender === "L"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
                                  : "bg-pink-100 text-pink-800 dark:bg-pink-900/30 dark:text-pink-300"
                              }`}
                            >
                              {mahasiswa.gender === "L" ? "👨" : "👩"}
                            </span>
                          </div>
                          <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                            <span className="font-mono">{mahasiswa.nim}</span>
                            <span className="font-medium">
                              IPK: {mahasiswa.ipk.toFixed(2)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Status Badge */}
                      <div className="flex items-center space-x-3">
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            absensi[mahasiswa.npm]?.hadir
                              ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
                              : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300"
                          }`}
                        >
                          {absensi[mahasiswa.npm]?.hadir
                            ? "Hadir"
                            : "Tidak Hadir"}
                        </span>

                        {/* Checkbox */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                            absensi[mahasiswa.npm]?.hadir
                              ? "bg-green-500 border-green-500"
                              : "border-gray-300 dark:border-gray-600"
                          }`}
                        >
                          {absensi[mahasiswa.npm]?.hadir && (
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
                    </div>

                    {/* Catatan Field */}
                    <div className="mt-3">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Catatan (Opsional)
                      </label>
                      <textarea
                        value={absensi[mahasiswa.npm]?.catatan || ""}
                        onChange={(e) =>
                          handleCatatanChange(mahasiswa.npm, e.target.value)
                        }
                        placeholder="Masukkan catatan jika ada..."
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm resize-none"
                        rows={2}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex justify-end gap-3 pt-6">
        <button
          onClick={() => navigate(`/detail-non-blok-csr/${kode}`)}
          className="px-6 py-3 rounded-xl bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
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
          className={`px-6 py-3 rounded-xl text-white text-sm font-medium shadow-lg hover:shadow-xl transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
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
    </div>
  );
}
