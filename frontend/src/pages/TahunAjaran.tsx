import { useState, ChangeEvent, useEffect, useCallback, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenToSquare,
  faTrash,
  faChevronDown,
} from "@fortawesome/free-solid-svg-icons";
import { motion, AnimatePresence } from "framer-motion";
import React from "react";
import api, { handleApiError } from "../utils/api"; // Import the api instance

// Define interfaces for our data structures
interface Semester {
  id: number;
  jenis: "Ganjil" | "Genap";
  aktif: boolean;
  tahun_ajaran_id: number;
}

interface TahunAjaran {
  id: number;
  tahun: string;
  aktif: boolean;
  semesters: Semester[];
}

// Debounce hook
function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

export default function TahunAjaran() {
  const [data, setData] = useState<TahunAjaran[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ tahun: "" });
  const [search, setSearch] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteId, setSelectedDeleteId] = useState<number | null>(null);
  const [expandedRows, setExpandedRows] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [loadingTahunAjaranId, setLoadingTahunAjaranId] = useState<
    number | null
  >(null);
  const [loadingSemesterId, setLoadingSemesterId] = useState<number | null>(
    null
  );
  const [isSaving, setIsSaving] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);

  // Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [pendingActivation, setPendingActivation] = useState<{
    type: 'tahun_ajaran' | 'semester';
    id: number;
    name: string;
  } | null>(null);
  const [updateStudentSemester, setUpdateStudentSemester] = useState(true); // Default Yes
  
  // Typing Confirmation Modal State
  const [showTypingConfirmModal, setShowTypingConfirmModal] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  const debouncedSearch = useDebounce(search, 300);

  useEffect(() => {
    if (success || error) {
      const timer = setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success, error]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<TahunAjaran[]>("/tahun-ajaran");
      setData(response.data);
      // Automatically expand the active year
      const activeYear = response.data.find((t) => t.aktif);
      if (activeYear) {
        setExpandedRows([activeYear.id]);
      }
    } catch (error) {
      console.error("Failed to fetch data", error);
      console.error("Error details:", handleApiError(error, "Memuat data tahun ajaran"));
      setError(handleApiError(error, "Memuat data tahun ajaran"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Memoize handler
  const handleInputChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    if (name === 'tahun') {
      // Hanya izinkan angka dan slash
      const numericValue = value.replace(/[^\d/]/g, "");

      // Auto-complete tahun ajaran format
      if (numericValue.length === 4 && /^\d{4}$/.test(numericValue)) {
        const currentYear = parseInt(numericValue);
        const nextYear = currentYear + 1;
        setForm((prev) => ({ ...prev, [name]: `${numericValue}/${nextYear}` }));
      } else {
        setForm((prev) => ({ ...prev, [name]: numericValue }));
      }
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }
  }, []);

  const handleAdd = useCallback(async () => {
    setIsSaving(true);
    setModalError(null);
    const regex = /^\d{4}\/\d{4}$/;
    if (!regex.test(form.tahun)) {
      setModalError(
        "Format tahun ajaran tidak valid. Gunakan format YYYY/YYYY, contoh: 2023/2024."
      );
      setIsSaving(false);
      return;
    }
    try {
      await api.post("/tahun-ajaran", form);
      setSuccess("Tahun ajaran berhasil ditambahkan.");
      fetchData();
      handleCloseModal();
    } catch (error: any) {
      if (error.response?.data?.errors?.tahun) {
        setModalError(error.response.data.errors.tahun[0]);
      } else {
        setModalError("Gagal menambahkan tahun ajaran.");
      }
    } finally {
      setIsSaving(false);
    }
  }, [form, fetchData]);

  const handleDelete = useCallback((id: number) => {
    // Check if the academic year is active
    const tahunAjaran = data.find(t => t.id === id);
    if (tahunAjaran?.aktif) {
      setError("Tahun ajaran yang sedang aktif tidak dapat dihapus. Silakan aktifkan tahun ajaran lain terlebih dahulu.");
      return;
    }

    setSelectedDeleteId(id);
    setShowDeleteModal(true);
  }, [data]);

  const confirmDelete = useCallback(async () => {
    setIsDeleting(true);
    if (selectedDeleteId !== null) {
      setSuccess(null);
      setError(null);
      try {
        await api.delete(`/tahun-ajaran/${selectedDeleteId}`);
        setSuccess("Tahun ajaran berhasil dihapus.");
        fetchData();
      } catch (error: any) {
        if (error.response?.data?.message) {
          setError(error.response.data.message);
        } else {
          setError("Gagal menghapus tahun ajaran.");
        }
      }
    }
    setShowDeleteModal(false);
    setSelectedDeleteId(null);
    setIsDeleting(false);
  }, [selectedDeleteId, fetchData]);

  const cancelDelete = useCallback(() => {
    setShowDeleteModal(false);
    setSelectedDeleteId(null);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setForm({ tahun: "" });
    setModalError(null);
  }, []);



  const handleActivateClick = (type: 'tahun_ajaran' | 'semester', id: number, name: string) => {
    setPendingActivation({ type, id, name });
    setUpdateStudentSemester(true); // Default check "Update Semester"
    setShowConfirmModal(true);
  };

  const processActivation = async () => {
    if (!pendingActivation) return;

    const { type, id } = pendingActivation;
    const updateSemester = updateStudentSemester;

    // Close first modal
    setShowConfirmModal(false);

    if (updateSemester) {
      // Show typing confirmation modal for student semester update
      setShowTypingConfirmModal(true);
    } else {
      // Direct activation without student update
      setPendingActivation(null);
      if (type === 'tahun_ajaran') {
        await handleActivate(id, false);
      } else {
        await handleSemesterActivate(id, false);
      }
    }
  };

  const cancelActivation = () => {
    setShowConfirmModal(false);
    setPendingActivation(null);
  };

  const processTypingConfirmation = async () => {
    if (!pendingActivation || confirmationText.trim() !== 'KONFIRMASI') return;
    
    setIsProcessing(true);
    const { type, id } = pendingActivation;
    
    try {
      if (type === 'tahun_ajaran') {
        await handleActivate(id, true);
      } else {
        await handleSemesterActivate(id, true);
      }
    } finally {
      setIsProcessing(false);
      setShowTypingConfirmModal(false);
      setConfirmationText('');
      setPendingActivation(null);
    }
  };

  const cancelTypingConfirmation = () => {
    setShowTypingConfirmModal(false);
    setConfirmationText('');
    setPendingActivation(null);
  };

  const handleActivate = useCallback(
    async (id: number, updateSemester: boolean) => {
      setSuccess(null);
      setError(null);
      setLoadingTahunAjaranId(id);

      // Optimistic update omitted for complexity with API response sync
      // We rely on loading state

      try {
        const response = await api.post(`/tahun-ajaran/${id}/activate`, {
          update_student_semester: updateSemester
        });
        
        // Kirim notifikasi ke semua akun
        try {
          await api.post('/notifications/broadcast', {
            title: '🔄 Perubahan Tahun Ajaran Aktif',
            message: `Tahun ajaran aktif telah diperbarui. Silakan refresh halaman untuk melihat data terbaru.`,
            type: 'info',
            send_to_all: true // Kirim ke semua akun
          });
        } catch (notifError) {
          console.error('Gagal mengirim notifikasi:', notifError);
        }
        
        setSuccess("Status tahun ajaran berhasil diubah.");

        // Refresh full data to get updated semester statuses
        fetchData();

      } catch (error: any) {
        console.error("Error activating academic year:", error);
        if (error.response?.status === 500) {
          setError("Gagal mengaktifkan tahun ajaran. Terjadi konflik data. Jika Anda memindahkan periode ke semester yang sudah pernah aktif sebelumnya, pastikan untuk memilih 'No' pada opsi 'Update Semester Mahasiswa'.");
        } else {
          setError(handleApiError(error, "Mengaktifkan tahun ajaran"));
        }
        fetchData();
      } finally {
        setLoadingTahunAjaranId(null);
      }
    },
    [fetchData]
  );

  const handleSemesterActivate = useCallback(
    async (semesterId: number, updateSemester: boolean) => {
      setSuccess(null);
      setError(null);
      setLoadingSemesterId(semesterId);

      try {
        const response = await api.post(`/semesters/${semesterId}/activate`, {
          update_student_semester: updateSemester
        });
        
        // Kirim notifikasi ke semua akun
        try {
          await api.post('/notifications/broadcast', {
            title: '🔄 Perubahan Semester Aktif',
            message: `Semester aktif telah diperbarui. Silakan refresh halaman untuk melihat data terbaru.`,
            type: 'info',
            send_to_all: true // Kirim ke semua akun
          });
        } catch (notifError) {
          console.error('Gagal mengirim notifikasi:', notifError);
        }
        
        setSuccess("Status semester berhasil diubah.");

        // Refresh full data
        fetchData();

      } catch (error: any) {
        console.error('Error activating semester:', error);
        if (error.response?.status === 500) {
          setError("Gagal mengaktifkan semester. Terjadi konflik data. Jika Anda memindahkan periode ke semester yang sudah pernah aktif sebelumnya, pastikan untuk memilih 'No' pada opsi 'Update Semester Mahasiswa' agar tidak terjadi tabrakan data.");
        } else {
          setError(handleApiError(error, 'Mengaktifkan semester'));
        }
        fetchData();
      } finally {
        setLoadingSemesterId(null);
      }
    },
    [fetchData]
  );

  const toggleRowExpansion = useCallback((id: number) => {
    setExpandedRows((prev) =>
      prev.includes(id) ? prev.filter((rowId) => rowId !== id) : [...prev, id]
    );
  }, []);

  // Debounced search
  const filteredData = useMemo(
    () =>
      data.filter((t) =>
        t.tahun.toLowerCase().includes(debouncedSearch.toLowerCase())
      ),
    [data, debouncedSearch]
  );

  // Memoized TahunAjaranRow
  const TahunAjaranRow = useMemo(
    () =>
      React.memo(function TahunAjaranRow({
        t,
        idx,
        toggleRowExpansion,
        expandedRows,
        handleActivateClick,
        loadingTahunAjaranId,
        handleDelete,
        handleSemesterActivateClick
      }: {
        t: TahunAjaran;
        idx: number;
        toggleRowExpansion: (id: number) => void;
        expandedRows: number[];
        handleActivateClick: (type: 'tahun_ajaran' | 'semester', id: number, name: string) => void;
        loadingTahunAjaranId: number | null;
        handleDelete: (id: number) => void;
        handleSemesterActivateClick: (type: 'tahun_ajaran' | 'semester', id: number, name: string) => void;
      }) {
        return (
          <React.Fragment key={t.id}>
            <tr
              className={idx % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""}
            >
              <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800 dark:text-white/90 align-middle">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => toggleRowExpansion(t.id)}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <motion.div
                      animate={{
                        rotate: expandedRows.includes(t.id) ? 0 : -90,
                      }}
                      transition={{ duration: 0.2 }}
                    >
                      <FontAwesomeIcon
                        icon={faChevronDown}
                        className="w-4 h-4"
                      />
                    </motion.div>
                  </button>
                  {t.tahun}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                {t.aktif ? (
                  <span className="inline-flex items-center px-2.5 py-0.5 justify-center gap-1 rounded-full font-medium text-sm bg-success-50 text-success-600 dark:bg-success-500/15 dark:text-success-500">
                    Aktif
                  </span>
                ) : (
                  <span className="inline-flex items-center px-2.5 py-0.5 justify-center gap-1 rounded-full font-medium text-sm bg-gray-100 text-gray-700 dark:bg-white/5 dark:text-white/80">
                    Nonaktif
                  </span>
                )}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                <div className="flex items-center justify-center gap-3">
                  <button
                    type="button"
                    aria-pressed={t.aktif}
                    onClick={() => {
                      if (t.aktif) {
                        setError(
                          "Tahun ajaran sudah aktif. Silakan aktifkan tahun ajaran lain jika ingin berpindah."
                        );
                        return;
                      }
                      handleActivateClick('tahun_ajaran', t.id, t.tahun);
                    }}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 outline-none ${t.aktif ? "bg-brand-500" : "bg-gray-200 dark:bg-gray-700"
                      } ${loadingTahunAjaranId === t.id
                        ? "opacity-60 cursor-wait"
                        : ""
                      } ${t.aktif ? "cursor-not-allowed" : ""}`}
                    disabled={loadingTahunAjaranId === t.id}
                  >
                    {loadingTahunAjaranId === t.id ? (
                      <span className="absolute left-1/2 -translate-x-1/2">
                        <svg
                          className="w-4 h-4 animate-spin text-brand-700"
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
                      </span>
                    ) : null}
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white shadow-lg transition duration-200 ${t.aktif ? "translate-x-6" : "translate-x-1"
                        }`}
                    />
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    disabled={t.aktif}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-sm font-medium transition ${t.aktif
                      ? 'text-gray-400 cursor-not-allowed'
                      : 'text-red-500 hover:text-red-700 dark:hover:text-red-300'
                      }`}
                    title={t.aktif ? "Tahun ajaran aktif tidak dapat dihapus" : "Delete"}
                  >
                    <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                    Delete
                  </button>
                </div>
              </td>
            </tr>
            <AnimatePresence>
              {expandedRows.includes(t.id) && (
                <motion.tr
                  key={`expanded-${t.id}`}
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3, ease: "easeInOut" }}
                  className="overflow-hidden"
                >
                  <td colSpan={3} className="p-0">
                    <div className="pl-16 pr-6 pb-4">
                      <motion.div
                        initial={{ y: -10, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{ delay: 0.1, duration: 0.2 }}
                        className="mb-2 text-sm font-medium text-gray-500 dark:text-gray-400"
                      >
                        Daftar Semester
                      </motion.div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {t.semesters.map((semester) => (
                          <div
                            key={`${t.id}-${semester.id}`}
                            className={`p-4 rounded-xl border transition-all ${semester.aktif
                              ? "border-brand-300 bg-brand-50/50 dark:bg-brand-900/10 shadow-xs"
                              : "border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600"
                              } bg-white dark:bg-gray-800`}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="hidden" />
                                <div>
                                  <h4 className="font-medium text-gray-800 dark:text-white/90">
                                    Semester {semester.jenis}
                                  </h4>
                                  <p
                                    className={`text-xs ${semester.aktif
                                      ? "text-brand-600 dark:text-brand-400"
                                      : "text-gray-500 dark:text-gray-400"
                                      }`}
                                  >
                                    {semester.aktif ? "Aktif" : "Nonaktif"}
                                  </p>
                                </div>
                              </div>
                              <button
                                type="button"
                                aria-pressed={semester.aktif}
                                onClick={() => {
                                  if (semester.aktif) {
                                    setError(
                                      "Semester sudah aktif. Silakan aktifkan semester lain jika ingin berpindah."
                                    );
                                    return;
                                  }
                                  handleSemesterActivateClick('semester', semester.id, `Semester ${semester.jenis}`);
                                }}
                                disabled={
                                  !t.aktif || loadingSemesterId === semester.id
                                }
                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors duration-200 outline-none ${semester.aktif
                                  ? "bg-brand-500"
                                  : "bg-gray-200 dark:bg-gray-700"
                                  } ${!t.aktif
                                    ? "opacity-50 cursor-not-allowed"
                                    : ""
                                  } ${loadingSemesterId === semester.id
                                    ? "opacity-60 cursor-wait"
                                    : ""
                                  } ${semester.aktif ? "cursor-not-allowed" : ""
                                  }`}
                              >
                                {loadingSemesterId === semester.id ? (
                                  <span className="absolute left-1/2 -translate-x-1/2">
                                    <svg
                                      className="w-3 h-3 animate-spin text-brand-700"
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
                                  </span>
                                ) : null}
                                <span
                                  className={`inline-block h-3 w-3 transform rounded-full bg-white shadow-lg transition duration-200 ${semester.aktif
                                    ? "translate-x-5"
                                    : "translate-x-1"
                                    }`}
                                />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                </motion.tr>
              )}
            </AnimatePresence>
          </React.Fragment>
        );
      }),
    []
  );

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
        Daftar Tahun Ajaran
      </h1>


      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => {
              setShowModal(true);
            }}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"
          >
            Input Data
          </button>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-0">
          <div className="relative w-full md:w-72">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg
                className="fill-gray-500 dark:fill-gray-400"
                width="20"
                height="20"
                viewBox="0 0 20 20"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
                  fill=""
                />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Cari tahun ajaran..."
              value={search}
              onChange={(e) => {
                const val = e.target.value.replace(/[^\d/]/g, "");
                setSearch(val);
              }}
              className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              inputMode="numeric"
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="mb-4 p-3 rounded-lg bg-green-100 text-green-700"
          >
            {success}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="mb-4 p-3 rounded-lg bg-red-100 text-red-700"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
            <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">
                  Tahun Ajaran
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400">
                  Status
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr
                    key={idx}
                    className={
                      idx % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""
                    }
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="h-5 w-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="h-6 w-20 mx-auto bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <div className="flex items-center justify-center gap-3">
                        <div className="h-6 w-11 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                        <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                        <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : filteredData.length > 0 ? (
                filteredData.map((t, idx) => (
                  <TahunAjaranRow
                    t={t}
                    idx={idx}
                    key={t.id}
                    toggleRowExpansion={toggleRowExpansion}
                    expandedRows={expandedRows}
                    handleActivateClick={handleActivateClick}
                    loadingTahunAjaranId={loadingTahunAjaranId}
                    handleDelete={handleDelete}
                    handleSemesterActivateClick={handleActivateClick}
                  />
                ))
              ) : (
                <tr>
                  <td
                    colSpan={3}
                    className="text-center py-8 text-gray-400 dark:text-gray-500"
                  >
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Input/Edit Tahun Ajaran */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handleCloseModal}
            ></div>
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              {/* Close Button */}
              <button
                onClick={handleCloseModal}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <div>
                <div className="flex items-center justify-between pb-6">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    Tambah Tahun Ajaran
                  </h2>
                </div>
                <div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Tahun Ajaran
                      </label>
                      <input
                        type="text"
                        name="tahun"
                        value={form.tahun}
                        onChange={handleInputChange}
                        placeholder="Format: YYYY/YYYY"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                        pattern="\d{4}/\d{4}"
                        inputMode="numeric"
                        maxLength={9}
                        onInput={(e) => {
                          let value = e.currentTarget.value.replace(/[^\d/]/g, '');

                          if (value.length === 4 && !value.includes('/')) {
                            const year = parseInt(value);
                            value = `${year}/${year + 1}`;
                          }
                          
                          e.currentTarget.value = value;
                        }}
                      />
                    </div>
                    {modalError && (
                      <div className="mb-4 p-2 text-sm rounded-lg bg-red-100 text-red-700">
                        {modalError}
                      </div>
                    )}
                    <div className="flex justify-end gap-2 pt-2">
                      <button
                        onClick={handleCloseModal}
                        className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleAdd}
                        disabled={!form.tahun.trim() || isSaving}
                        className={`px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition flex items-center justify-center min-w-[160px] ${isSaving ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                      >
                        {isSaving ? (
                          <>
                            <svg
                              className="w-5 h-5 mr-2 animate-spin text-white"
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
                          "Tambah Tahun Ajaran"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Delete Data */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={cancelDelete}
            ></div>
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              {/* Close Button */}
              <button
                onClick={cancelDelete}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <div>
                <div className="flex items-center justify-between pb-6">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    Hapus Data
                  </h2>
                </div>
                <div>
                  <p className="mb-6 text-gray-500 dark:text-gray-400">
                    Apakah Anda yakin ingin menghapus data tahun ajaran{" "}
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {selectedDeleteId &&
                        data.find((d) => d.id === selectedDeleteId)?.tahun}
                    </span>
                    ? Data yang dihapus tidak dapat dikembalikan.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={cancelDelete}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={confirmDelete}
                      className={`px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center${isDeleting ? "opacity-60 cursor-not-allowed" : ""
                        }`}
                      disabled={isDeleting}
                    >
                      {isDeleting ? (
                        <>
                          <svg
                            className="w-5 h-5 mr-2 animate-spin text-white"
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
                        "Delete"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Confirmation Activation Modal */}
      <AnimatePresence>
        {showConfirmModal && pendingActivation && (
          <div className="fixed inset-0 z-[100002] flex items-center justify-center">
            <div
              className="fixed inset-0 z-[100002] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={cancelActivation}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100003] max-h-[90vh] overflow-y-auto hide-scroll border border-gray-100 dark:border-gray-800"
            >
              <div className="flex items-center justify-between pb-4 sm:pb-6">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                    Konfirmasi Aktivasi
                  </h2>
                </div>
                <p className="text-gray-600 dark:text-gray-300 mb-6">
                  Anda akan mengaktifkan <span className="font-semibold text-brand-600 dark:text-brand-400">{pendingActivation.name}</span>.
                  Apakah Anda ingin memperbarui semester mahasiswa secara otomatis?
                </p>

              <div className="mb-6 space-y-3">
                <div
                  className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 ${updateStudentSemester
                      ? "bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-600"
                      : ""
                    }`}
                  onClick={() => setUpdateStudentSemester(true)}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${updateStudentSemester
                          ? "bg-brand-500 border-brand-500"
                          : "border-gray-300 dark:border-gray-600"
                        }`}
                    >
                      {updateStudentSemester && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          Ya, Perbarui Semester Mahasiswa
                        </span>
                        <span className="text-xs px-2 py-1 rounded-full bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-400">
                          Rekomendasi
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Semester mahasiswa akan <b>disesuaikan (Naik/Turun)</b> mengikut tahun ajaran ini. <br />
                        - Jika maju tahun: Mahasiswa naik semester/lulus.<br />
                        - Jika mundur tahun: Mahasiswa akan turun semester.
                      </p>
                    </div>
                  </div>
                </div>

                <div
                  className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 ${!updateStudentSemester
                      ? "bg-brand-50 dark:bg-brand-900/20 border-brand-300 dark:border-brand-600"
                      : ""
                    }`}
                  onClick={() => setUpdateStudentSemester(false)}
                >
                  <div className="flex items-center space-x-3">
                    <div
                      className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${!updateStudentSemester
                          ? "bg-brand-500 border-brand-500"
                          : "border-gray-300 dark:border-gray-600"
                        }`}
                    >
                      {!updateStudentSemester && (
                        <div className="w-2 h-2 bg-white rounded-full"></div>
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center space-x-2">
                        <span className="font-medium text-gray-900 dark:text-white">
                          Tidak, Hanya Aktifkan Saja
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Semester mahasiswa tidak akan berubah. Pilih ini jika hanya ingin mengganti periode aktif tanpa mempengaruhi data mahasiswa.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 relative z-20">
                <button
                  onClick={cancelActivation}
                  className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                >
                  Batal
                </button>
                <button
                  onClick={processActivation}
                  className="px-3 sm:px-4 py-2 rounded-lg bg-brand-500 text-white text-xs sm:text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition-all duration-300 ease-in-out"
                >
                  Simpan & Aktifkan
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Typing Confirmation Modal */}
      <AnimatePresence>
        {showTypingConfirmModal && pendingActivation && (
          <div className="fixed inset-0 z-[100004] flex items-center justify-center">
            <div
              className="fixed inset-0 z-[100004] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={cancelTypingConfirmation}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100005] max-h-[90vh] overflow-y-auto hide-scroll border border-gray-100 dark:border-gray-800"
            >
              {/* Close Button */}
              <button
                onClick={cancelTypingConfirmation}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>

              <div className="text-left">
                <div className="mb-6">
                  <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-4">
                    <svg className="h-8 w-8 text-red-600 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 15.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div className="flex items-center justify-between pb-2 sm:pb-4">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white text-center flex-1">
                      Konfirmasi Perubahan Semester
                    </h2>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-4 text-center">
                    Anda akan <span className="font-semibold text-red-600 dark:text-red-400">memperbarui semester mahasiswa</span> untuk <span className="font-semibold text-brand-600 dark:text-brand-400">{pendingActivation.name}</span>.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mb-6 text-center">
                    Tindakan ini akan mempengaruhi data semester semua mahasiswa. Untuk melanjutkan, ketik <span className="font-mono font-bold bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded">KONFIRMASI</span> di bawah:
                  </p>
                </div>

                <div className="mb-6">
                  <input
                    type="text"
                    value={confirmationText}
                    onChange={(e) => setConfirmationText(e.target.value)}
                    placeholder="Ketik 'KONFIRMASI'"
                    className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white font-mono text-center focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    autoFocus
                  />
                </div>

                <div className="flex justify-end gap-2 pt-2 relative z-20">
                  <button
                    onClick={cancelTypingConfirmation}
                    disabled={isProcessing}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Batal
                  </button>
                  <button
                    onClick={processTypingConfirmation}
                    disabled={confirmationText.trim() !== 'KONFIRMASI' || isProcessing}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-white text-xs sm:text-sm font-medium shadow-theme-xs transition-all duration-300 ease-in-out flex items-center justify-center min-w-[140px] ${
                      confirmationText.trim() === 'KONFIRMASI' && !isProcessing
                        ? 'bg-red-600 hover:bg-red-700'
                        : 'bg-emerald-800 text-white opacity-60 cursor-not-allowed'
                    }`}
                  >
                    {isProcessing ? (
                      <>
                        <svg
                          className="w-5 h-5 mr-2 animate-spin text-white"
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
                        Memproses...
                      </>
                    ) : (
                      'Konfirmasi & Aktifkan'
                    )}
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
