import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faEdit,
  faUsers,
  faBookOpen,
  faCalendar,
} from "@fortawesome/free-solid-svg-icons";
import api, { handleApiError } from "../utils/api";
import { useNavigate } from "react-router-dom";

interface CSR {
  id: number;
  mata_kuliah_kode: string;
  nomor_csr: string;
  nama: string;
  keahlian_required: string[];
  tanggal_mulai?: string;
  tanggal_akhir?: string;
  status: "available" | "assigned" | "completed";
  mata_kuliah?: {
    kode: string;
    nama: string;
  };
  semester?: number;
  blok?: number;
  created_at: string;
  updated_at: string;
}

function toDateInputValue(dateString: string) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

const CSR: React.FC = () => {
  // Loading state
  const [loading, setLoading] = useState(true);

  // Filter states
  const [filterSemester, setFilterSemester] = useState("semua");
  const [filterStatus, setFilterStatus] = useState("semua");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedCSR, setSelectedCSR] = useState<CSR | null>(null);

  // Data states
  const [csrs, setCsrs] = useState<CSR[]>([]);
  const [mataKuliah, setMataKuliah] = useState<
    Array<{ kode: string; nama: string }>
  >([]);
  const [selectedNomorCSR, setSelectedNomorCSR] = useState<string>("");
  const [showDeleteModalCSR, setShowDeleteModalCSR] = useState(false);
  const [csrToDelete, setCsrToDelete] = useState<CSR | null>(null);

  // Form states
  const [form, setForm] = useState({
    mata_kuliah_kode: "",
    nomor_csr: "",
    nama: "",
    keahlian_required: [] as string[],
    tanggal_mulai: "",
    tanggal_akhir: "",
  });

  // Notification states
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Modal states
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Semester and mapping states
  const [activeSemesterJenis, setActiveSemesterJenis] = useState<string | null>(null);
  const [csrMappings, setCsrMappings] = useState<Record<number, Record<string, number>>>({});

  const navigate = useNavigate();

  // Fetch all data using optimized batch endpoint
  useEffect(() => {
    fetchBatchData();
  }, []);

  const fetchBatchData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await api.get("/csr-batch-data");
      const batchData = response.data;

      // Set all data from batch response
      setCsrs(batchData.csrs || []);
      setMataKuliah(batchData.mata_kuliah || []);
      setActiveSemesterJenis(batchData.active_semester_jenis);
      setCsrMappings(batchData.csr_mappings || {});

    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Gagal mengambil data");
      }
      // Set empty arrays as fallback
      setCsrs([]);
      setMataKuliah([]);
      setActiveSemesterJenis(null);
      setCsrMappings({});
    } finally {
      setLoading(false);
    }
  };

  // Mapping data sudah diambil dari batch API, tidak perlu fetch terpisah

  // Auto-hide notifications
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => setSuccess(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => setError(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  // Active semester data sudah diambil dari batch API, tidak perlu fetch terpisah

  // Filter mata kuliah CSR berdasarkan semester aktif (periode)
  const filteredCSR = csrs.filter((csr) => {
    // Cek periode dari nomor_csr atau field lain jika ada
    let periode = null;
    if (csr.semester) {
      periode = csr.semester % 2 === 1 ? "Ganjil" : "Genap";
    } else if (csr.nomor_csr) {
      const sem = parseInt(csr.nomor_csr.split(".")[0]);
      if (!isNaN(sem)) periode = sem % 2 === 1 ? "Ganjil" : "Genap";
    }
    if (activeSemesterJenis && periode !== activeSemesterJenis) return false;
    const semester = csr.semester || parseInt(csr.nomor_csr.split(".")[0]);
    if (filterSemester !== "semua" && semester !== parseInt(filterSemester))
      return false;
    if (filterStatus !== "semua" && csr.status !== filterStatus) return false;
    if (
      searchQuery &&
      !csr.nama.toLowerCase().includes(searchQuery.toLowerCase()) &&
      !csr.mata_kuliah_kode.toLowerCase().includes(searchQuery.toLowerCase())
    )
      return false;
    return true;
  });

  // Handle form submission
  const handleSubmit = async () => {

    setIsSaving(true);
    try {
      if (selectedCSR && selectedCSR.id) {
        // UPDATE (PUT) saja, tidak ada POST
        await api.put(`/csr/${selectedCSR.id}`, {
          mata_kuliah_kode: form.mata_kuliah_kode,
          nomor_csr: form.nomor_csr,
          nama: form.nama || "",
          keahlian_required: form.keahlian_required,
          tanggal_mulai: form.tanggal_mulai || "",
          tanggal_akhir: form.tanggal_akhir || "",
        });
        setSuccess("Mata kuliah CSR berhasil diupdate");
        setError(null);
        setShowModal(false);
        setEditMode(false);
        setSelectedCSR(null);
        setForm({
          mata_kuliah_kode: "",
          nomor_csr: "",
          nama: "",
          keahlian_required: [],
          tanggal_mulai: "",
          tanggal_akhir: "",
        });
        fetchBatchData();
      } else {
        setError("Pilih CSR yang valid untuk diedit.");
      }
    } catch (err: unknown) {
      console.error("handleSubmit error:", err);
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Gagal menyimpan data");
      }
    } finally {
      setIsSaving(false);

    }
  };

  // Handle delete CSR
  const handleDeleteCSR = async (csrId: number) => {
    setIsDeleting(true);
    try {
      await api.delete(`/csr/${csrId}`);
      setSuccess("Data CSR berhasil dihapus");
      fetchBatchData();
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError("Gagal menghapus data");
      }
    } finally {
      setIsDeleting(false);
      setShowDeleteModalCSR(false);
      setCsrToDelete(null);
    }
  };

  // Get semester options
  const semesterOptions = Array.from(
    new Set(
      csrs.map((csr) => {
        const semester = csr.semester || parseInt(csr.nomor_csr.split(".")[0]);
        return semester;
      })
    )
  ).sort();

  // CSR functions
  const handleEdit = (csr: CSR) => {
    setSelectedCSR(csr);
    setForm({
      mata_kuliah_kode: csr.mata_kuliah_kode,
      nomor_csr: csr.nomor_csr,
      nama: csr.nama,
      keahlian_required: csr.keahlian_required,
      tanggal_mulai: csr.tanggal_mulai || "",
      tanggal_akhir: csr.tanggal_akhir || "",
    });
    setEditMode(true);
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setForm({
      mata_kuliah_kode: "",
      nomor_csr: "",
      nama: "",
      keahlian_required: [],
      tanggal_mulai: "",
      tanggal_akhir: "",
    });
    setEditMode(false);
    setSelectedCSR(null);
  };

  // Handle mata kuliah selection
  const handleMataKuliahChange = async (kode: string) => {
    setForm({ ...form, mata_kuliah_kode: kode });
    setSelectedNomorCSR("");
    // CSR data sudah diambil dari batch API, tidak perlu fetch terpisah
  };

  // Handler saat pilih nomor CSR
  const handleNomorCSRChange = (nomor: string) => {
    setSelectedNomorCSR(nomor);
    const csr = csrs.find((c: CSR) => c.nomor_csr === nomor);
    if (csr) {
      setForm({
        mata_kuliah_kode: csr.mata_kuliah_kode,
        nomor_csr: csr.nomor_csr,
        nama: csr.nama,
        keahlian_required: csr.keahlian_required,
        tanggal_mulai: toDateInputValue(csr.tanggal_mulai || ""),
        tanggal_akhir: toDateInputValue(csr.tanggal_akhir || ""),
      });
      setSelectedCSR(csr);
    } else {
      setForm({ ...form, nomor_csr: nomor });
      setSelectedCSR(null);
    }
  };

  // Pada filter mataKuliahNonBlokCSR, gunakan any agar tidak error property
  const mataKuliahNonBlokCSR = (
    mataKuliah as unknown as {
      kode: string;
      nama: string;
      jenis: string;
      tipe_non_block: string;
    }[]
  ).filter((mk) => mk.jenis === "Non Blok" && mk.tipe_non_block === "CSR");

  // Group CSR by semester
  const groupedCSR = filteredCSR.reduce((acc, csr) => {
    const semester = csr.semester || parseInt(csr.nomor_csr.split(".")[0]);
    if (!acc[semester]) acc[semester] = [];
    acc[semester].push(csr);
    return acc;
  }, {} as Record<number, typeof filteredCSR>);
  const sortedSemesters = Object.keys(groupedCSR)
    .map(Number)
    .sort((a, b) => a - b);

  // Center the summary cards (real)
  <div className="flex justify-center mb-8">
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-fit">
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
            <FontAwesomeIcon
              icon={faBookOpen}
              className="w-6 h-6 text-blue-500"
            />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800 dark:text-white">
              {csrs.length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Total Mata Kuliah CSR
            </div>
          </div>
        </div>
      </div>
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
            <FontAwesomeIcon
              icon={faUsers}
              className="w-6 h-6 text-purple-500"
            />
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-800 dark:text-white">
              {csrs.filter((csr) => csr.status === "available").length}
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              Belum Ditugaskan
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>;

  if (loading) {
    return (
      <div className="mx-auto py-8 px-2 md:px-0">
        {/* Skeleton Summary Cards */}
        <div className="mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 animate-pulse"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div>
                    <div className="h-7 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Skeleton Controls */}
        <div className="flex flex-col md:flex-row gap-4 mb-8 items-stretch md:items-center justify-between w-full">
          <div className="h-12 w-80 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
            <div className="h-12 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-12 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-12 w-56 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          </div>
        </div>
        {/* Skeleton Mata Kuliah CSR Section */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-6 animate-pulse" />
          {/* Semester Card Skeleton */}
          <div className="space-y-8">
            {Array.from({ length: 1 }).map((_, i) => (
              <div
                key={i}
                className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-6 border border-gray-200 dark:border-gray-700 animate-pulse"
              >
                <div className="flex items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-brand-500/30 dark:bg-brand-900/20" />
                  <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded ml-4" />
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded ml-auto" />
                </div>
                {/* CSR Cards Skeleton */}
                <div className="grid gap-4">
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div
                      key={j}
                      className="p-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800/50 hover:shadow-md animate-pulse"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                        <div className="flex-1">
                          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                          <div className="flex gap-2 mb-2">
                            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                            <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded-full" />
                          </div>
                        </div>
                        <div className="flex flex-row items-center gap-2 sm:ml-4">
                          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded-full" />
                          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                          <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                        </div>
                      </div>
                      <div className="h-10 w-48 bg-brand-100 dark:bg-brand-900/20 rounded-lg mt-4" />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto py-8 px-4 md:px-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
          Community Service Responsibility (CSR)
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Pengelolaan mata kuliah CSR dan penugasan dosen berdasarkan keahlian
        </p>
      </div>

      {/* Petunjuk input CSR jika ada CSR yang belum diisi nama */}
      {csrs.some(csr => !csr.nama || csr.nama.trim() === "") && (
        <div className="mb-6 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-300">
            <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
              <span className="text-white text-xs">!</span>
            </div>
            <p className="text-sm font-medium">Perhatian</p>
          </div>
          <p className="text-sm text-yellow-700 dark:text-yellow-200 mt-1">
            Ada mata kuliah CSR yang belum diinput nama dan keahliannya. Silakan lengkapi data CSR agar bisa lanjut ke penugasan dosen.
          </p>
        </div>
      )}

      {/* Summary Cards */}
      <div className="mb-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full">
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faBookOpen}
                  className="w-6 h-6 text-blue-500"
                />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800 dark:text-white">
                  {csrs.length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Total Mata Kuliah CSR
                </div>
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faUsers}
                  className="w-6 h-6 text-purple-500"
                />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-800 dark:text-white">
                  {csrs.filter((csr) => csr.status === "available").length}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Belum Ditugaskan
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-8 flex flex-col md:flex-row gap-4 items-stretch md:items-center justify-between w-full">
        <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari mata kuliah CSR..."
            className="w-full md:w-64 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-theme-xs"
          />
          <div className="flex flex-col md:flex-row gap-4 w-full md:w-auto md:ml-auto">
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="w-full md:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-theme-xs"
            >
              <option value="semua">Semua Semester</option>
              {semesterOptions.map((semester) => (
                <option key={semester} value={semester}>
                  Semester {semester}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full md:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-theme-xs"
            >
              <option value="semua">Semua Status</option>
              <option value="available">Belum Ditugaskan</option>
              <option value="assigned">Sudah Ditugaskan</option>
              <option value="completed">Selesai</option>
            </select>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
          Mata Kuliah CSR ({filteredCSR.length})
        </h3>

        {sortedSemesters.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faBookOpen}
                className="w-8 h-8 text-gray-400"
              />
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Belum ada mata kuliah CSR
            </h3>
            <p className="text-gray-600 dark:text-gray-400">
              Tambahkan mata kuliah CSR untuk memulai penugasan dosen.
            </p>
          </div>
        ) : (
          <div className="space-y-8">
            {sortedSemesters.map((semester) => {
              const semesterCSRs = groupedCSR[semester];
              const availableCount = semesterCSRs.filter(
                (csr) => csr.status === "available"
              ).length;
              const assignedCount = semesterCSRs.filter(
                (csr) => csr.status === "assigned"
              ).length;
              const completedCount = semesterCSRs.filter(
                (csr) => csr.status === "completed"
              ).length;

              return (
                <div
                  key={semester}
                  className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
                >
                  {/* Semester Header */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center">
                        <span className="text-white font-bold text-lg">
                          {semester}
                        </span>
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                          Semester {semester}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {semesterCSRs.length} mata kuliah CSR
                        </p>
                      </div>
                    </div>

                    {/* Status Summary */}
                    <div className="flex items-center gap-4">
                      {availableCount > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {availableCount} belum ditugaskan
                          </span>
                        </div>
                      )}
                      {assignedCount > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-blue-400"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {assignedCount} sudah ditugaskan
                          </span>
                        </div>
                      )}
                      {completedCount > 0 && (
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full bg-brand-400"></div>
                          <span className="text-sm text-gray-600 dark:text-gray-400">
                            {completedCount} selesai
                          </span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* CSR Cards Grid */}
                  <div className="grid gap-4">
                    {semesterCSRs.map((csr) => {
                      return (
                        <div
                          key={csr.id}
                          className={`p-3 sm:p-5 rounded-xl border transition-all duration-300 ${
                            csr.status === "available"
                              ? "border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800/50 hover:shadow-md"
                              : csr.status === "assigned"
                              ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-lg scale-[1.02]"
                              : "border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800/50 hover:shadow-md"
                          }`}
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="flex-1">
                                  <h4 className="font-semibold text-gray-800 dark:text-white/90 text-lg">
                                    {csr.mata_kuliah_kode}
                                    {csr.mata_kuliah?.nama
                                      ? ` - ${csr.mata_kuliah.nama}`
                                      : ""}
                                  </h4>
                                </div>
                              </div>
                              <div className="flex items-center gap-4 text-sm text-gray-600 dark:text-gray-400">
                                <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-400">
                                  <FontAwesomeIcon icon={faBookOpen} className="w-3 h-3" />
                                  {csr.nomor_csr} - {csr.nama}
                                </span>
                                {csr.tanggal_mulai && csr.tanggal_akhir && (
                                  <span className="flex items-center text-sm gap-1">
                                    <FontAwesomeIcon
                                      icon={faCalendar}
                                      className="w-3 h-3"
                                    />
                                    {new Date(
                                      csr.tanggal_mulai
                                    ).toLocaleDateString("id-ID")}{" "}
                                    -{" "}
                                    {new Date(
                                      csr.tanggal_akhir
                                    ).toLocaleDateString("id-ID")}
                                  </span>
                                )}
                              </div>

                              <div className="flex flex-wrap gap-2 mt-2">
                                {csr.keahlian_required.map((k) => (
                                  <span
                                    key={k}
                                    className="bg-brand-100 rounded-lg px-3 py-1 flex items-center gap-2 text-xs font-medium text-brand-700"
                                  >
                                    {k}
                                    {csrMappings[csr.id]?.[k] !== undefined ? (
                                      <span className="text-xs text-gray-500">({csrMappings[csr.id][k]}) Dosen</span>
                                    ) : null}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div className="flex flex-row items-center gap-2 sm:ml-4">
                              <span
                                className={`text-xs px-3 py-1 rounded-full font-medium ${
                                  csr.status === "available"
                                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                                    : csr.status === "assigned"
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                    : "bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300"
                                }`}
                              >
                                {csr.status === "available"
                                  ? "Belum Ditugaskan"
                                  : csr.status === "assigned"
                                  ? "Sudah Ditugaskan"
                                  : "Selesai"}
                              </span>
                              <button
                                onClick={() => handleEdit(csr)}
                                className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 bg-transparent rounded-lg transition"
                                title="Edit CSR"
                              >
                                <FontAwesomeIcon
                                  icon={faEdit}
                                  className="w-4 h-4"
                                />
                                <span className="hidden sm:inline">Edit</span>
                              </button>
                              <button
                                onClick={() => {
                                  setCsrToDelete(csr);
                                  setShowDeleteModalCSR(true);
                                }}
                                className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 bg-transparent rounded-lg transition"
                                title="Hapus CSR"
                              >
                                <FontAwesomeIcon
                                  icon={faTrash}
                                  className="w-4 h-4"
                                />
                                <span className="hidden sm:inline">Hapus</span>
                              </button>
                            </div>
                          </div>

                          {/* Assigned Dosen Section */}
                          <div className="flex justify-start mt-2">
                            <button
                              onClick={() => navigate(`/csr/${csr.id}`)}
                              className="flex items-center gap-2 px-5 py-2 bg-brand-500 text-white rounded-lg font-medium text-sm shadow hover:bg-brand-600 transition"
                            >
                              <FontAwesomeIcon icon={faUsers} className="w-4 h-4" />
                              Lihat & Tugaskan Dosen
                            </button>
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

      {/* Modal for CSR Form */}
      <AnimatePresence>
        {showModal && editMode && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handleCloseModal}
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
                onClick={handleCloseModal}
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
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                    {editMode
                      ? "Edit Mata Kuliah CSR"
                      : "Tambah Nama Mata Kuliah CSR & Keahlian"}
                  </h2>
                </div>
                {error && (
                  <div className="mb-4 p-2 bg-red-100 rounded-lg text-red-700 text-sm">
                    {error}
                  </div>
                )}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleSubmit();
                  }}
                >
                  <div className="space-y-4">
                    {/* Dropdown Mata Kuliah Non Blok CSR */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Pilih Mata Kuliah Non Blok CSR
                      </label>
                      <select
                        value={form.mata_kuliah_kode}
                        onChange={(e) => handleMataKuliahChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        required
                        disabled={editMode}
                      >
                        <option value="">Pilih mata kuliah...</option>
                        {mataKuliahNonBlokCSR.map((mk) => (
                          <option key={mk.kode} value={mk.kode}>
                            {mk.kode} - {mk.nama}
                          </option>
                        ))}
                      </select>
                    </div>
                    {/* Dropdown Nomor CSR */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Pilih CSR (Nomor)
                      </label>
                      <select
                        value={selectedNomorCSR}
                        onChange={(e) => handleNomorCSRChange(e.target.value)}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        required
                        disabled={!form.mata_kuliah_kode || editMode}
                      >
                                                    {editMode ? (
                              <option value={form.nomor_csr}>
                                {form.nomor_csr}
                              </option>
                            ) : (
                              <>
                                <option value="">Pilih CSR...</option>
                                {csrs
                                  .filter(
                                    (csr: CSR) =>
                                      !csr.nama ||
                                      !csr.keahlian_required ||
                                      csr.keahlian_required.length === 0
                                  )
                                  .map((csr: CSR) => (
                                    <option key={csr.id} value={csr.nomor_csr}>
                                      {csr.nomor_csr}
                                    </option>
                                  ))}
                              </>
                            )}
                      </select>
                    </div>
                    {/* Input tanggal mulai & akhir (readonly) */}
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          Tanggal Mulai
                        </label>
                        <input
                          type="date"
                          value={toDateInputValue(form.tanggal_mulai || "")}
                          readOnly
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-not-allowed"
                        />
                      </div>
                      <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          Tanggal Akhir
                        </label>
                        <input
                          type="date"
                          value={toDateInputValue(form.tanggal_akhir || "")}
                          readOnly
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 cursor-not-allowed"
                        />
                      </div>
                    </div>
                    {/* Input Nama Mata Kuliah CSR */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Nama Mata Kuliah CSR
                      </label>
                      <input
                        type="text"
                        value={form.nama || ""}
                        onChange={(e) =>
                          setForm({ ...form, nama: e.target.value })
                        }
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        required
                      />
                    </div>
                  </div>
                  <div className="flex gap-2 justify-end pt-6">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="px-3 sm:px-4 py-2 rounded-lg bg-brand-500 text-white text-xs sm:text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                    >
                      {isSaving ? (
                        <>
                          <svg
                            className="w-5 h-5 mr-2 animate-spin text-white inline-block align-middle"
                            xmlns="http://www.w3.org/2000/svg"
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
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            ></path>
                          </svg>
                          Menyimpan...
                        </>
                      ) : (
                        "Simpan"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Konfirmasi Hapus CSR */}
      {showDeleteModalCSR && csrToDelete && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center">
          {/* Overlay dengan animasi */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
            onClick={() => {
              setShowDeleteModalCSR(false);
              setCsrToDelete(null);
            }}
          ></motion.div>
          {/* Modal Content dengan animasi */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
          >
            {/* Tombol close bulat kanan atas */}
            <button
              onClick={() => {
                setShowDeleteModalCSR(false);
                setCsrToDelete(null);
              }}
              className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              aria-label="Tutup"
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
            <h2 className="text-xl font-bold text-gray-800 dark:text-white mb-4">
              Hapus Data
            </h2>
            <p className="mb-6 text-gray-700 dark:text-gray-300">
              Apakah Anda yakin ingin menghapus data mata kuliah{" "}
              <b>{csrToDelete.nama}</b>? Data yang dihapus tidak dapat
              dikembalikan.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => {
                  setShowDeleteModalCSR(false);
                  setCsrToDelete(null);
                }}
                className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              >
                Batal
              </button>
              <button
                onClick={() => handleDeleteCSR(csrToDelete.id)}
                className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <svg
                      className="w-5 h-5 mr-2 animate-spin text-white inline-block align-middle"
                      xmlns="http://www.w3.org/2000/svg"
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
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      ></path>
                    </svg>
                    Menghapus...
                  </>
                ) : (
                  "Hapus"
                )}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

export default CSR;
