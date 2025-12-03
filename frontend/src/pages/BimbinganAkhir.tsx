import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGraduationCap,
  faFileAlt,
  faSearch,
  faFilter,
  faChevronDown,
  faEye,
  faCheckCircle,
  faClock,
  faTimes,
  faCalendar,
  faTimesCircle,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";
import api, { getUser } from "../utils/api";
import PageMeta from "../components/common/PageMeta";

interface JadwalBimbinganAkhir {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  jenis_baris: "seminar_proposal" | "sidang_skripsi";
  pembimbing?: { id: number; name: string };
  pembimbing_id?: number;
  komentator_ids?: number[];
  komentator_list?: { id: number; name: string }[];
  penguji_ids?: number[];
  penguji_list?: { id: number; name: string }[];
  mahasiswa_nims?: string[];
  mahasiswa_list?: { id: number; nim: string; name: string }[];
  ruangan?: { id: number; nama: string };
  dosen_role?: string;
  jumlah_sesi?: number;
  status_konfirmasi?: string;
  is_pembimbing?: boolean;
  is_active_dosen?: boolean;
}

const BimbinganAkhir = () => {
  const navigate = useNavigate();
  const [jadwalSeminarProposal, setJadwalSeminarProposal] = useState<JadwalBimbinganAkhir[]>([]);
  const [jadwalSidangSkripsi, setJadwalSidangSkripsi] = useState<JadwalBimbinganAkhir[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"seminar_proposal" | "sidang_skripsi">("seminar_proposal");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPeran, setFilterPeran] = useState<string>("all");
  const [allDosenList, setAllDosenList] = useState<any[]>([]);
  
  // Modal mahasiswa
  const [showMahasiswaModal, setShowMahasiswaModal] = useState(false);
  const [selectedMahasiswaList, setSelectedMahasiswaList] = useState<any[]>([]);
  const [mahasiswaSearchQuery, setMahasiswaSearchQuery] = useState("");
  const [mahasiswaModalPage, setMahasiswaModalPage] = useState(1);
  const [mahasiswaModalPageSize] = useState(10);

  // Modal konfirmasi dan reschedule
  const [showKonfirmasiModal, setShowKonfirmasiModal] = useState(false);
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [selectedJadwal, setSelectedJadwal] = useState<JadwalBimbinganAkhir | null>(null);
  const [selectedStatus, setSelectedStatus] = useState<"bisa" | "tidak_bisa">("bisa");
  const [selectedAlasan, setSelectedAlasan] = useState<string>("");
  const [customAlasan, setCustomAlasan] = useState<string>("");
  const [rescheduleReason, setRescheduleReason] = useState<string>("");
  const [submittingKonfirmasi, setSubmittingKonfirmasi] = useState(false);
  const [submittingReschedule, setSubmittingReschedule] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const user = getUser();
      if (!user) return;

      const [jadwalResponse, dosenResponse] = await Promise.all([
        api.get(`/jadwal-non-blok-non-csr/dosen/${user.id}`),
        api.get("/users?role=dosen&per_page=1000"),
      ]);

      const allJadwal = jadwalResponse.data.data || [];
      
      setJadwalSeminarProposal(
        allJadwal.filter((j: JadwalBimbinganAkhir) => j.jenis_baris === "seminar_proposal")
      );
      setJadwalSidangSkripsi(
        allJadwal.filter((j: JadwalBimbinganAkhir) => j.jenis_baris === "sidang_skripsi")
      );
      setAllDosenList(dosenResponse.data.data || []);
    } catch (error) {
      // Error fetching data
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openKonfirmasiModal = (jadwal: JadwalBimbinganAkhir) => {
    setSelectedJadwal(jadwal);
    setSelectedStatus("bisa");
    setSelectedAlasan("");
    setCustomAlasan("");
    setShowKonfirmasiModal(true);
  };

  const openRescheduleModal = (jadwal: JadwalBimbinganAkhir) => {
    setSelectedJadwal(jadwal);
    setRescheduleReason("");
    setShowRescheduleModal(true);
  };

  const handleSubmitKonfirmasi = async () => {
    if (!selectedJadwal || !selectedStatus) return;

    try {
      setSubmittingKonfirmasi(true);
      const user = getUser();
      if (!user) return;

      const alasan =
        selectedStatus === "tidak_bisa"
          ? selectedAlasan === "custom"
            ? customAlasan
            : selectedAlasan
          : null;

      await api.put(`/jadwal-non-blok-non-csr/${selectedJadwal.id}/konfirmasi`, {
        status: selectedStatus,
        alasan: alasan,
        dosen_id: user.id,
      });

      setShowKonfirmasiModal(false);
      setSelectedStatus("bisa");
      setSelectedAlasan("");
      setCustomAlasan("");
      await fetchData();
    } catch (error) {
      alert("Gagal menyimpan konfirmasi");
    } finally {
      setSubmittingKonfirmasi(false);
    }
  };

  const handleSubmitReschedule = async () => {
    if (!selectedJadwal || !rescheduleReason.trim()) return;

    try {
      setSubmittingReschedule(true);
      const user = getUser();
      if (!user) return;

      await api.post(`/jadwal-non-blok-non-csr/${selectedJadwal.id}/reschedule`, {
        reschedule_reason: rescheduleReason.trim(),
        dosen_id: user.id,
      });

      setShowRescheduleModal(false);
      setRescheduleReason("");
      await fetchData();
    } catch (error) {
      alert("Gagal mengajukan reschedule");
    } finally {
      setSubmittingReschedule(false);
    }
  };

  // Helper untuk cek status jadwal
  const getJadwalStatus = (tanggal: string) => {
    // Parse tanggal format dd-mm-yyyy
    const parts = tanggal.split("-");
    const jadwalDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    jadwalDate.setHours(0, 0, 0, 0);
    
    const diffTime = jadwalDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "selesai";
    if (diffDays === 0) return "hari_ini";
    return "akan_datang";
  };

  const getFilteredJadwal = (jadwalList: JadwalBimbinganAkhir[]) => {
    const filtered = jadwalList.filter((jadwal) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const mahasiswaNames = jadwal.mahasiswa_list?.map(m => m.name.toLowerCase()).join(" ") || "";
        const ruanganNama = jadwal.ruangan?.nama?.toLowerCase() || "";
        if (!mahasiswaNames.includes(query) && !ruanganNama.includes(query)) {
          return false;
        }
      }
      
      if (filterPeran !== "all") {
        if (!jadwal.dosen_role?.toLowerCase().includes(filterPeran.toLowerCase())) {
          return false;
        }
      }
      
      return true;
    });

    // Sort: Hari ini > Akan datang > Selesai, lalu by tanggal
    return filtered.sort((a, b) => {
      const statusA = getJadwalStatus(a.tanggal);
      const statusB = getJadwalStatus(b.tanggal);
      
      const statusOrder = { hari_ini: 0, akan_datang: 1, selesai: 2 };
      const orderDiff = statusOrder[statusA] - statusOrder[statusB];
      
      if (orderDiff !== 0) return orderDiff;
      
      // Jika status sama, sort by tanggal
      const partsA = a.tanggal.split("-");
      const partsB = b.tanggal.split("-");
      const dateA = new Date(parseInt(partsA[2]), parseInt(partsA[1]) - 1, parseInt(partsA[0]));
      const dateB = new Date(parseInt(partsB[2]), parseInt(partsB[1]) - 1, parseInt(partsB[0]));
      
      // Akan datang: ascending (terdekat dulu), Selesai: descending (terbaru dulu)
      if (statusA === "selesai") {
        return dateB.getTime() - dateA.getTime();
      }
      return dateA.getTime() - dateB.getTime();
    });
  };

  const getDosenNamesFromList = (list: { id: number; name: string }[] | undefined, ids: number[] | undefined) => {
    // Prioritas: gunakan list jika ada, fallback ke ids + allDosenList
    if (list && list.length > 0) {
      const names = list.map(d => d.name);
      return names.length > 2
        ? `${names.slice(0, 2).join(", ")} +${names.length - 2}`
        : names.join(", ");
    }
    
    if (!ids || ids.length === 0) return "-";
    const names = ids
      .map((id) => {
        const dosen = allDosenList.find((d) => d.id === id);
        return dosen ? dosen.name : null;
      })
      .filter(Boolean);
    if (names.length === 0) return "-";
    return names.length > 2
      ? `${names.slice(0, 2).join(", ")} +${names.length - 2}`
      : names.join(", ");
  };

  const renderJadwalTable = (
    jadwalList: JadwalBimbinganAkhir[],
    type: "seminar_proposal" | "sidang_skripsi",
    emptyMessage: string
  ) => {
    const filteredJadwal = getFilteredJadwal(jadwalList);
    const icon = type === "seminar_proposal" ? faFileAlt : faGraduationCap;
    
    const headers = [
      "NO",
      "HARI/TANGGAL",
      "PUKUL",
      "WAKTU",
      "PEMBIMBING",
      type === "seminar_proposal" ? "KOMENTATOR" : "PENGUJI",
      "MAHASISWA",
      "RUANGAN",
      "PERAN",
      "STATUS",
      "AKSI",
    ];

    return (
      <div className="overflow-x-auto hide-scroll">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-700/50">
            <tr>
              {headers.map((header, index) => (
                <th
                  key={index}
                  className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {loading ? (
              <tr>
                <td colSpan={headers.length} className="px-6 py-8 text-center">
                  <div className="flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
                  </div>
                </td>
              </tr>
            ) : filteredJadwal.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-6 py-8 text-center">
                  <div className="flex flex-col items-center justify-center">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                      <FontAwesomeIcon icon={icon} className="w-8 h-8 text-gray-400" />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      {searchQuery || filterPeran !== "all" ? "Tidak ada jadwal yang sesuai dengan filter" : emptyMessage}
                    </p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredJadwal.map((jadwal, index) => {
                const status = getJadwalStatus(jadwal.tanggal);
                const isSelesai = status === "selesai";
                
                return (
                  <tr 
                    key={jadwal.id} 
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors ${
                      isSelesai ? "opacity-60" : ""
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {jadwal.tanggal}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {jadwal.jam_mulai} - {jadwal.jam_selesai}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {jadwal.jumlah_sesi || 1} x 50 menit
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {jadwal.pembimbing?.name || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {type === "seminar_proposal"
                        ? getDosenNamesFromList(jadwal.komentator_list, jadwal.komentator_ids)
                        : getDosenNamesFromList(jadwal.penguji_list, jadwal.penguji_ids)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {(() => {
                        const mahasiswaNims = jadwal.mahasiswa_nims || [];
                        if (mahasiswaNims.length === 0) return "-";
                        return (
                          <button
                            onClick={() => {
                              setSelectedMahasiswaList(jadwal.mahasiswa_list || mahasiswaNims.map((nim: string) => ({ nim, name: nim })));
                              setMahasiswaSearchQuery("");
                              setMahasiswaModalPage(1);
                              setShowMahasiswaModal(true);
                            }}
                            className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-700 hover:bg-green-200 dark:hover:bg-green-800 transition cursor-pointer"
                          >
                            {mahasiswaNims.length} mahasiswa
                          </button>
                        );
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {jadwal.ruangan?.nama || "N/A"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-700">
                        {jadwal.dosen_role || "-"}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {status === "hari_ini" && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/50 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-700">
                          Hari Ini
                        </span>
                      )}
                      {status === "akan_datang" && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 border border-green-200 dark:border-green-700">
                          Akan Datang
                        </span>
                      )}
                      {status === "selesai" && (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-400 border border-gray-200 dark:border-gray-600">
                          Selesai
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        {/* Cek apakah dosen adalah pembimbing */}
                        {(() => {
                          const user = getUser();
                          if (!user) return null;
                          
                          // Gunakan is_pembimbing dari API jika ada, fallback ke cek dosen_role atau pembimbing_id
                          const isPembimbing = jadwal.is_pembimbing !== undefined 
                            ? jadwal.is_pembimbing 
                            : (jadwal.dosen_role?.includes('Pembimbing') || jadwal.pembimbing_id === user.id);
                          
                          // Jika pembimbing dan belum konfirmasi, tampilkan tombol Konfirmasi dan Reschedule */}
                          if (isPembimbing && jadwal.status_konfirmasi === "belum_konfirmasi") {
                            return (
                              <>
                                <button
                                  onClick={() => openKonfirmasiModal(jadwal)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500 text-white hover:bg-blue-600 transition"
                                >
                                  <FontAwesomeIcon icon={faCheckCircle} />
                                  Konfirmasi
                                </button>
                                <button
                                  onClick={() => openRescheduleModal(jadwal)}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-orange-500 text-white hover:bg-orange-600 transition"
                                >
                                  <FontAwesomeIcon icon={faClock} />
                                  Reschedule
                                </button>
                              </>
                            );
                          }
                          
                          // Jika pembimbing sudah konfirmasi "tidak_bisa", tampilkan badge status */}
                          if (isPembimbing && jadwal.status_konfirmasi === "tidak_bisa") {
                            return (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700">
                                <FontAwesomeIcon icon={faTimesCircle} className="w-3 h-3 mr-1" />
                                Tidak Bisa Mengajar
                              </span>
                            );
                          }
                          
                          // Jika bukan pembimbing dan belum konfirmasi, tampilkan badge "Menunggu" */}
                          if (!isPembimbing && jadwal.is_active_dosen && jadwal.status_konfirmasi === "belum_konfirmasi") {
                            return (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700">
                                <FontAwesomeIcon icon={faClock} className="w-3 h-3 mr-1" />
                                Menunggu Konfirmasi Pembimbing
                              </span>
                            );
                          }
                          
                          // Jika bukan pembimbing dan pembimbing sudah konfirmasi "tidak_bisa", tampilkan badge */}
                          if (!isPembimbing && jadwal.is_active_dosen && jadwal.status_konfirmasi === "tidak_bisa") {
                            return (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700">
                                <FontAwesomeIcon icon={faTimesCircle} className="w-3 h-3 mr-1" />
                                Pembimbing Tidak Bisa
                              </span>
                            );
                          }
                          
                          // Jika sudah konfirmasi "bisa", tampilkan tombol Detail untuk semua dosen terlibat */}
                          if (jadwal.status_konfirmasi === "bisa") {
                            // Cek apakah dosen ini terlibat (pembimbing, komentator, atau penguji)
                            const isTerlibat = isPembimbing || 
                                              (jadwal.komentator_ids && Array.isArray(jadwal.komentator_ids) && jadwal.komentator_ids.includes(Number(user.id))) ||
                                              (jadwal.penguji_ids && Array.isArray(jadwal.penguji_ids) && jadwal.penguji_ids.includes(Number(user.id))) ||
                                              (jadwal.komentator_list && Array.isArray(jadwal.komentator_list) && jadwal.komentator_list.some((k: any) => k.id === Number(user.id))) ||
                                              (jadwal.penguji_list && Array.isArray(jadwal.penguji_list) && jadwal.penguji_list.some((p: any) => p.id === Number(user.id))) ||
                                              (jadwal.is_active_dosen === true);
                            
                            if (isTerlibat) {
                              return (
                                <button
                                  onClick={() => {
                                    if (type === "seminar_proposal") {
                                      navigate(`/bimbingan-akhir/seminar-proposal/${jadwal.id}`);
                                    } else {
                                      navigate(`/bimbingan-akhir/sidang-skripsi/${jadwal.id}`);
                                    }
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 dark:hover:bg-blue-900/50 transition"
                                >
                                  <FontAwesomeIcon icon={faEye} />
                                  Detail
                                </button>
                              );
                            }
                          }
                          
                          // Jika status "tidak_bisa" dan dosen terlibat, tampilkan badge "Dibatalkan" */}
                          if (jadwal.status_konfirmasi === "tidak_bisa") {
                            // Cek apakah dosen ini terlibat
                            const isTerlibat = isPembimbing || 
                                              (jadwal.komentator_ids && Array.isArray(jadwal.komentator_ids) && jadwal.komentator_ids.includes(Number(user.id))) ||
                                              (jadwal.penguji_ids && Array.isArray(jadwal.penguji_ids) && jadwal.penguji_ids.includes(Number(user.id))) ||
                                              (jadwal.komentator_list && Array.isArray(jadwal.komentator_list) && jadwal.komentator_list.some((k: any) => k.id === Number(user.id))) ||
                                              (jadwal.penguji_list && Array.isArray(jadwal.penguji_list) && jadwal.penguji_list.some((p: any) => p.id === Number(user.id))) ||
                                              (jadwal.is_active_dosen === true);
                            
                            if (isTerlibat) {
                              return (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700">
                                  <FontAwesomeIcon icon={faTimesCircle} className="w-3 h-3 mr-1" />
                                  Dibatalkan
                                </span>
                              );
                            }
                          }
                          
                          return null;
                        })()}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    );
  };

  const seminarCount = getFilteredJadwal(jadwalSeminarProposal).length;
  const sidangCount = getFilteredJadwal(jadwalSidangSkripsi).length;

  return (
    <>
      <PageMeta title="Bimbingan Akhir | ISME" description="Jadwal Seminar Proposal dan Sidang Skripsi" />
      
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Bimbingan Akhir
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Jadwal Seminar Proposal dan Sidang Skripsi
          </p>
        </motion.div>

        {/* Tab Switcher */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-gray-100 dark:bg-gray-800 p-1.5 rounded-xl flex w-full sm:w-auto sm:inline-flex gap-1"
        >
          <button
            onClick={() => setActiveTab("seminar_proposal")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "seminar_proposal"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <FontAwesomeIcon icon={faFileAlt} />
            <span className="hidden xs:inline">Seminar</span>
            <span className="hidden sm:inline"> Proposal</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === "seminar_proposal"
                ? "bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-400"
                : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            }`}>
              {jadwalSeminarProposal.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab("sidang_skripsi")}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 sm:px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              activeTab === "sidang_skripsi"
                ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-white shadow-sm"
                : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <FontAwesomeIcon icon={faGraduationCap} />
            <span className="hidden xs:inline">Sidang</span>
            <span className="hidden sm:inline"> Skripsi</span>
            <span className={`px-2 py-0.5 rounded-full text-xs ${
              activeTab === "sidang_skripsi"
                ? "bg-purple-100 text-purple-600 dark:bg-purple-900/50 dark:text-purple-400"
                : "bg-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-400"
            }`}>
              {jadwalSidangSkripsi.length}
            </span>
          </button>
        </motion.div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex flex-col sm:flex-row gap-3"
        >
          {/* Search */}
          <div className="flex-1 relative">
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              placeholder="Cari mahasiswa atau ruangan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 shadow-sm text-sm"
            />
          </div>
          
          {/* Filter Peran */}
          <div className="relative w-full sm:w-auto">
            <FontAwesomeIcon
              icon={faFilter}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <select
              value={filterPeran}
              onChange={(e) => setFilterPeran(e.target.value)}
              className="w-full sm:w-auto pl-11 pr-10 py-3 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-brand-500 focus:border-brand-500 appearance-none cursor-pointer shadow-sm sm:min-w-[160px] text-sm"
            >
              <option value="all">Semua Peran</option>
              <option value="pembimbing">Pembimbing</option>
              <option value="komentator">Komentator</option>
              <option value="penguji">Penguji</option>
            </select>
            <FontAwesomeIcon
              icon={faChevronDown}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none"
            />
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          {/* Table Header */}
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                activeTab === "seminar_proposal" ? "bg-blue-500" : "bg-purple-500"
              }`}>
                <FontAwesomeIcon 
                  icon={activeTab === "seminar_proposal" ? faFileAlt : faGraduationCap} 
                  className="text-white text-sm" 
                />
              </div>
              <div className="min-w-0">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white truncate">
                  {activeTab === "seminar_proposal" ? "Seminar Proposal" : "Sidang Skripsi"}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                  {activeTab === "seminar_proposal" ? seminarCount : sidangCount} jadwal
                </p>
              </div>
            </div>
          </div>

          {/* Table Content */}
          {activeTab === "seminar_proposal"
            ? renderJadwalTable(jadwalSeminarProposal, "seminar_proposal", "Tidak ada data Seminar Proposal")
            : renderJadwalTable(jadwalSidangSkripsi, "sidang_skripsi", "Tidak ada data Sidang Skripsi")}
        </motion.div>
      </div>

      {/* Modal Daftar Mahasiswa */}
      <AnimatePresence>
        {showMahasiswaModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowMahasiswaModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-xl z-[100001] max-h-[85vh] overflow-hidden"
            >
              {/* Modal Header */}
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Daftar Mahasiswa
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total {selectedMahasiswaList.length} mahasiswa
                  </p>
                </div>
                <button
                  onClick={() => setShowMahasiswaModal(false)}
                  className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center justify-center transition"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24">
                    <path stroke="currentColor" strokeLinecap="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <div className="px-6 py-3 border-b border-gray-200 dark:border-gray-700">
                <div className="relative">
                  <FontAwesomeIcon
                    icon={faSearch}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                  />
                  <input
                    type="text"
                    placeholder="Cari nama atau NIM..."
                    value={mahasiswaSearchQuery}
                    onChange={(e) => {
                      setMahasiswaSearchQuery(e.target.value);
                      setMahasiswaModalPage(1);
                    }}
                    className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                  />
                </div>
              </div>

              {/* Table */}
              <div className="overflow-y-auto max-h-[50vh]">
                {(() => {
                  const filteredMahasiswa = selectedMahasiswaList.filter((m) => {
                    if (!mahasiswaSearchQuery.trim()) return true;
                    const query = mahasiswaSearchQuery.toLowerCase().trim();
                    return (
                      (m.name || "").toLowerCase().includes(query) ||
                      (m.nim || "").toLowerCase().includes(query)
                    );
                  });
                  const totalPages = Math.ceil(filteredMahasiswa.length / mahasiswaModalPageSize);
                  const paginatedData = filteredMahasiswa.slice(
                    (mahasiswaModalPage - 1) * mahasiswaModalPageSize,
                    mahasiswaModalPage * mahasiswaModalPageSize
                  );

                  return (
                    <>
                      <table className="w-full text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-800 sticky top-0">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">No</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">NIM</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Nama</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {paginatedData.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                                {mahasiswaSearchQuery ? "Tidak ada mahasiswa yang sesuai" : "Tidak ada data"}
                              </td>
                            </tr>
                          ) : (
                            paginatedData.map((mahasiswa, idx) => {
                              const actualIndex = (mahasiswaModalPage - 1) * mahasiswaModalPageSize + idx;
                              return (
                                <tr key={mahasiswa.id || mahasiswa.nim || idx} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                                  <td className="px-6 py-3 text-gray-900 dark:text-white">{actualIndex + 1}</td>
                                  <td className="px-6 py-3 text-gray-900 dark:text-white font-mono">{mahasiswa.nim || "-"}</td>
                                  <td className="px-6 py-3 text-gray-900 dark:text-white">{mahasiswa.name || "-"}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>

                      {/* Pagination */}
                      {filteredMahasiswa.length > mahasiswaModalPageSize && (
                        <div className="px-6 py-3 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-800">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Hal {mahasiswaModalPage}/{totalPages}
                          </span>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setMahasiswaModalPage((p) => Math.max(1, p - 1))}
                              disabled={mahasiswaModalPage === 1}
                              className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 disabled:opacity-50"
                            >
                              Prev
                            </button>
                            <button
                              onClick={() => setMahasiswaModalPage((p) => Math.min(totalPages, p + 1))}
                              disabled={mahasiswaModalPage >= totalPages}
                              className="px-3 py-1.5 rounded-lg text-sm border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 disabled:opacity-50"
                            >
                              Next
                            </button>
                          </div>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Konfirmasi */}
      <AnimatePresence>
        {showKonfirmasiModal && selectedJadwal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowKonfirmasiModal(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-4 bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowKonfirmasiModal(false)}
                className="absolute top-6 right-6 w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 flex items-center justify-center transition"
              >
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
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
                {/* Header */}
                <div className="flex items-center justify-between pb-4 sm:pb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center shadow-lg">
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        className="w-6 h-6 text-blue-600 dark:text-blue-400"
                      />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                        Konfirmasi Ketersediaan
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Silakan konfirmasi ketersediaan Anda
                      </p>
                    </div>
                  </div>
                </div>

                {/* Jadwal Info Card */}
                <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                      <FontAwesomeIcon
                        icon={faCalendar}
                        className="w-5 h-5 text-white"
                      />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Detail Jadwal
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tanggal
                        </span>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {selectedJadwal.tanggal}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Waktu
                        </span>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {selectedJadwal.jam_mulai} - {selectedJadwal.jam_selesai}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Lokasi
                        </span>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {selectedJadwal.ruangan?.nama || "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Selection */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Status Ketersediaan
                    </label>
                    {selectedStatus && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
                        {selectedStatus === "bisa"
                          ? "Bisa Mengajar"
                          : "Tidak Bisa Mengajar"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label
                      className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        selectedStatus === "bisa"
                          ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 ${
                          selectedStatus === "bisa"
                            ? "bg-green-500 border-green-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {selectedStatus === "bisa" && (
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
                      <input
                        type="radio"
                        name="status"
                        value="bisa"
                        checked={selectedStatus === "bisa"}
                        onChange={(e) =>
                          setSelectedStatus(e.target.value as "bisa")
                        }
                        className="sr-only"
                      />
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon
                            icon={faCheckCircle}
                            className="w-5 h-5 text-green-600 dark:text-green-400"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Bisa Mengajar
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Saya siap mengajar pada jadwal ini
                          </p>
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        selectedStatus === "tidak_bisa"
                          ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 ${
                          selectedStatus === "tidak_bisa"
                            ? "bg-red-500 border-red-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {selectedStatus === "tidak_bisa" && (
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
                      <input
                        type="radio"
                        name="status"
                        value="tidak_bisa"
                        checked={selectedStatus === "tidak_bisa"}
                        onChange={(e) =>
                          setSelectedStatus(e.target.value as "tidak_bisa")
                        }
                        className="sr-only"
                      />
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon
                            icon={faTimesCircle}
                            className="w-5 h-5 text-red-600 dark:text-red-400"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Tidak Bisa Mengajar
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Saya tidak bisa mengajar pada jadwal ini
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Alasan Selection */}
                {selectedStatus === "tidak_bisa" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6"
                  >
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon
                          icon={faExclamationTriangle}
                          className="w-4 h-4 text-orange-600 dark:text-orange-400"
                        />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Alasan Tidak Bisa
                      </h4>
                    </div>

                    <div className="space-y-3">
                      {[
                        { value: "sakit", label: "A. Sakit", icon: "🏥" },
                        {
                          value: "acara_keluarga",
                          label: "B. Acara Keluarga",
                          icon: "👨‍👩‍👧‍👦",
                        },
                        {
                          value: "konflik_jadwal",
                          label: "C. Konflik Jadwal",
                          icon: "⏰",
                        },
                        { value: "custom", label: "D. Lainnya", icon: "📝" },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                            selectedAlasan === option.value
                              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600"
                              : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-3 ${
                              selectedAlasan === option.value
                                ? "bg-blue-500 border-blue-500"
                                : "border-gray-300 dark:border-gray-600"
                            }`}
                          >
                            {selectedAlasan === option.value && (
                              <svg
                                className="w-2.5 h-2.5 text-white"
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
                          <input
                            type="radio"
                            name="alasan"
                            value={option.value}
                            checked={selectedAlasan === option.value}
                            onChange={(e) => setSelectedAlasan(e.target.value)}
                            className="sr-only"
                          />
                          <span className="text-2xl mr-3">{option.icon}</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {option.label}
                          </span>
                        </label>
                      ))}

                      {selectedAlasan === "custom" && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                            Jelaskan alasan Anda
                          </label>
                          <textarea
                            value={customAlasan}
                            onChange={(e) => setCustomAlasan(e.target.value)}
                            placeholder="Tuliskan alasan tidak bisa mengajar secara detail..."
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent transition-colors resize-none"
                            rows={3}
                          />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-2 relative z-20">
                  <button
                    onClick={() => {
                      setShowKonfirmasiModal(false);
                      setSelectedStatus("bisa");
                      setSelectedAlasan("");
                      setCustomAlasan("");
                    }}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSubmitKonfirmasi}
                    disabled={
                      submittingKonfirmasi ||
                      !selectedStatus ||
                      (selectedStatus === "tidak_bisa" && !selectedAlasan)
                    }
                    className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium shadow-lg hover:bg-blue-600 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4" />
                    <span>Konfirmasi</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Reschedule */}
      <AnimatePresence>
        {showRescheduleModal && selectedJadwal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => setShowRescheduleModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Ajukan Reschedule
                </h3>
                <button
                  onClick={() => setShowRescheduleModal(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alasan Reschedule <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={rescheduleReason}
                  onChange={(e) => setRescheduleReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={4}
                  placeholder="Masukkan alasan reschedule..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowRescheduleModal(false);
                    setRescheduleReason("");
                  }}
                  className="flex-1 py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Batal
                </button>
                <button
                  onClick={handleSubmitReschedule}
                  disabled={submittingReschedule || !rescheduleReason.trim()}
                  className="flex-1 py-2 px-4 rounded-lg bg-orange-500 text-white font-medium hover:bg-orange-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingReschedule ? "Mengajukan..." : "Ajukan"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default BimbinganAkhir;
