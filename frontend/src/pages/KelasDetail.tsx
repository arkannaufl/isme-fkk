import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { UserIcon, ChevronLeftIcon } from "../icons";
import { motion, AnimatePresence } from "framer-motion";
import { kelasApi, kelompokKecilApi, mahasiswaApi } from "../api/generateApi";
import { handleApiError } from "../utils/api";

interface Kelompok {
  id: number;
  nama: string;
  count: number;
}

interface Kelas {
  id: number;
  nama: string;
  kelompokIds: number[];
}

const KelasDetail: React.FC = () => {
  const navigate = useNavigate();
  const { semester } = useParams<{ semester: string }>();
  const [kelasList, setKelasList] = useState<Kelas[]>([]);
  const [initialKelasList, setInitialKelasList] = useState<Kelas[]>([]);
  const [kelompokList, setKelompokList] = useState<Kelompok[]>([]);
  const [namaKelasBaru, setNamaKelasBaru] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editNama, setEditNama] = useState("");
  const [successMsg, setSuccessMsg] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showKelompok, setShowKelompok] = useState(false);
  const [filterAngkatan, setFilterAngkatan] = useState<string>("semua"); // Filter angkatan
  const [filterIPK, setFilterIPK] = useState<string>("semua"); // Filter IPK
  const [mahasiswaList, setMahasiswaList] = useState<any[]>([]);

  // Drag and Drop State
  const [draggedKelompokId, setDraggedKelompokId] = useState<number | null>(null);
  const [dragOverKelasId, setDragOverKelasId] = useState<number | 'available' | null>(null);

  // Konfirmasi sebelum keluar jika ada perubahan
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  const [pendingLeaveAction, setPendingLeaveAction] = useState<null | (() => void)>(null);

  // State untuk modal konfirmasi hapus
  const [showDeleteModal, setShowDeleteModal] = useState<{id: number, nama: string} | null>(null);
  // State untuk loading button hapus
  const [isDeletingClass, setIsDeletingClass] = useState(false);

  // Tambahkan state untuk menyimpan kelompok yang sedang diexpand
  const [expandedKelompokKelas, setExpandedKelompokKelas] = useState<{[kelasId: number]: number | null}>({});

  // State untuk loading button Tambah Kelas
  const [isAddingKelas, setIsAddingKelas] = useState(false);

  // Tambahkan state untuk pesan error
  const [errorMsg, setErrorMsg] = useState<string>("");

  // Tambahkan state untuk animasi loading di button Simpan Data
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  // State untuk loading button Simpan Edit Kelas
  const [isSavingEditId, setIsSavingEditId] = useState<number | null>(null);

  // Ambil data kelompok dari hasil pengelompokan
  useEffect(() => {
    if (!semester) return;
    setLoading(true);
    Promise.all([
      kelasApi.getBySemester(semester),
      kelompokKecilApi.getBySemester(semester),
      mahasiswaApi.getAll()
    ]).then(([kelasRes, kelompokRes, mhsRes]) => {
      // Kelas: map backend to local type
      const kelasMapped = kelasRes.data.map((k: any) => ({
        id: k.id,
        nama: k.nama_kelas,
        kelompokIds: k.kelompok_kecil ? k.kelompok_kecil.map((kk: any) => parseInt(kk)) : [],
      }));
      setKelasList(kelasMapped);
      setInitialKelasList(kelasMapped); // simpan snapshot awal
      // Kelompok
      const kelompokMap: { [nama: string]: Kelompok } = {};
      kelompokRes.data.forEach((kk: any) => {
        const kelompokId = parseInt(kk.nama_kelompok);
        if (!kelompokMap[kk.nama_kelompok]) {
          kelompokMap[kk.nama_kelompok] = { id: kelompokId, nama: `Kelompok ${kk.nama_kelompok}`, count: 0 };
        }
        kelompokMap[kk.nama_kelompok].count++;
      });
      setKelompokList(Object.values(kelompokMap));
      // Mapping manual mahasiswa ke kelompok
      const kelompokMahasiswaMap: { [mahasiswaId: string]: string } = {};
      kelompokRes.data.forEach((kk: any) => {
        kelompokMahasiswaMap[kk.mahasiswa_id] = kk.nama_kelompok;
      });
      const mahasiswaWithKelompok = mhsRes.data.map((m: any) => ({
        ...m,
        kelompok: kelompokMahasiswaMap[m.id] ? Number(kelompokMahasiswaMap[m.id]) : undefined,
      }));
      setMahasiswaList(mahasiswaWithKelompok);
    }).catch((error) => {
      console.error("Error loading data:", error);
      console.error("Error details:", handleApiError(error, "Memuat data kelas"));
      setKelasList([]);
      setInitialKelasList([]);
      setKelompokList([]);
      setMahasiswaList([]);
    }).finally(() => setLoading(false));
  }, [semester]);

  // Notifikasi sukses
  useEffect(() => {
    if (successMsg) {
      const timer = setTimeout(() => setSuccessMsg(""), 3000);
      return () => clearTimeout(timer);
    }
  }, [successMsg]);

  // Konfirmasi sebelum keluar jika ada perubahan
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (JSON.stringify(kelasList) !== JSON.stringify(initialKelasList)) {
        e.preventDefault();
        e.returnValue = '';
        return '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [kelasList, initialKelasList]);

  // Hilangkan errorMsg setelah 5 detik
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg("") , 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Handlers
  const handleTambahKelas = async () => {
    if (!namaKelasBaru.trim() || kelompokList.length === 0 || !semester) return;
    setIsAddingKelas(true);
    try {
      await kelasApi.create({
        semester: semester,
        nama_kelas: namaKelasBaru.trim(),
        kelompok_ids: [],
      });
      setNamaKelasBaru("");
      setSuccessMsg("Kelas berhasil ditambahkan!");
      setErrorMsg(""); // clear error
      // Refresh data
      const kelasRes = await kelasApi.getBySemester(semester);
      setKelasList(kelasRes.data.map((k: any) => ({
        id: k.id,
        nama: k.nama_kelas,
        kelompokIds: k.kelompok_kecil ? k.kelompok_kecil.map((kk: any) => parseInt(kk)) : [],
      })));
      setInitialKelasList(kelasRes.data.map((k: any) => ({
        id: k.id,
        nama: k.nama_kelas,
        kelompokIds: k.kelompok_kecil ? k.kelompok_kecil.map((kk: any) => parseInt(kk)) : [],
      })));
    } catch (err: any) {
      console.error("Error adding class:", err);
      console.error("Error details:", handleApiError(err, "Menambah kelas"));
      setErrorMsg(handleApiError(err, "Menambah kelas"));
      setSuccessMsg(""); // clear success
    } finally {
      setIsAddingKelas(false);
    }
  };

  const handleHapusKelas = (id: number) => {
    const kelas = kelasList.find(k => k.id === id);
    if (kelas) {
      setShowDeleteModal({id, nama: kelas.nama});
    }
  };

  const confirmHapusKelas = async () => {
    if (showDeleteModal && showDeleteModal.id && semester) {
      setIsDeletingClass(true);
      try {
        await kelasApi.delete(showDeleteModal.id);
        setShowDeleteModal(null);
        setSuccessMsg("Kelas berhasil dihapus!");
        setErrorMsg(""); // clear error
        // Refresh data
        const kelasRes = await kelasApi.getBySemester(semester);
        setKelasList(kelasRes.data.map((k: any) => ({
          id: k.id,
          nama: k.nama_kelas,
          kelompokIds: k.kelompok_kecil ? k.kelompok_kecil.map((kk: any) => parseInt(kk)) : [],
        })));
      } catch (error: any) {
        console.error("Error deleting class:", error);
        console.error("Error details:", handleApiError(error, "Menghapus kelas"));
        setErrorMsg(handleApiError(error, "Menghapus kelas"));
        setSuccessMsg(""); // clear success
      } finally {
        setIsDeletingClass(false);
      }
    }
  };

  const handleSimpanEdit = async (id: number) => {
    if (!semester) return;
    setIsSavingEditId(id);
    try {
      await kelasApi.update(id, {
        nama_kelas: editNama,
        kelompok_ids: [],
      });
      setEditId(null);
      setEditNama("");
      setSuccessMsg("Kelas berhasil diupdate!");
      // Refresh data
      const kelasRes = await kelasApi.getBySemester(semester);
      const kelasMapped = kelasRes.data.map((k: any) => ({
        id: k.id,
        nama: k.nama_kelas,
        kelompokIds: k.kelompok_kecil ? k.kelompok_kecil.map((kk: any) => parseInt(kk)) : [],
      }));
      setKelasList(kelasMapped);
      setInitialKelasList(kelasMapped);
    } catch (error: any) {
      console.error("Error updating class:", error);
      console.error("Error details:", handleApiError(error, "Mengupdate kelas"));
      setErrorMsg(handleApiError(error, "Mengupdate kelas"));
      setSuccessMsg(""); // clear success
    } finally {
      setIsSavingEditId(null);
    }
  };

  // Drag and Drop Handlers
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, kelompokId: number) => {
    setDraggedKelompokId(kelompokId);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, kelasId: number | 'available') => {
    e.preventDefault();
    setDragOverKelasId(kelasId);
  };

  const handleDragLeave = () => setDragOverKelasId(null);

  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetKelasId: number | 'available') => {
    e.preventDefault();
    if (draggedKelompokId === null) return;

    setKelasList(prevList => {
      // Remove from all classes first
      const cleanedList = prevList.map(k => ({
        ...k,
        kelompokIds: k.kelompokIds.filter(id => id !== draggedKelompokId),
      }));

      // Add to the target class if it's not 'available'
      if (targetKelasId !== 'available') {
        return cleanedList.map(k =>
          k.id === targetKelasId
            ? { ...k, kelompokIds: [...k.kelompokIds, draggedKelompokId].sort((a,b) => a-b) }
            : k
        );
      }
      return cleanedList;
    });

    handleDragEnd();
  };

  const handleDragEnd = () => {
    setDraggedKelompokId(null);
    setDragOverKelasId(null);
  };

  const assignedKelompokIds = new Set(kelasList.flatMap(k => k.kelompokIds));
  const availableKelompok = kelompokList.filter(k => !assignedKelompokIds.has(k.id));

  // Tombol Simpan Draft
  const handleSimpanDraft = async () => {
    if (!semester) return;
    setIsSavingDraft(true);
    setErrorMsg("");
    try {
      // Simpan assign kelompok ke kelas ke backend
      for (const kelas of kelasList) {
        await kelasApi.update(kelas.id, {
          nama_kelas: kelas.nama,
          kelompok_ids: kelas.kelompokIds.map(String),
        });
      }
      setSuccessMsg("Perubahan kelas dan pengelompokan berhasil disimpan!");
      // Refresh data
      const kelasRes = await kelasApi.getBySemester(semester);
      const kelasMapped = kelasRes.data.map((k: any) => ({
        id: k.id,
        nama: k.nama_kelas,
        kelompokIds: k.kelompok_kecil ? k.kelompok_kecil.map((kk: any) => parseInt(kk)) : [],
      }));
      setKelasList(kelasMapped);
      setInitialKelasList(kelasMapped); // update snapshot setelah simpan
    } catch (err: any) {
      console.error("Error saving draft:", err);
      console.error("Error details:", handleApiError(err, "Menyimpan perubahan kelas"));
      setErrorMsg(handleApiError(err, "Menyimpan perubahan kelas"));
      setSuccessMsg("");
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Tombol Batal Draft
  const handleBatalDraft = () => {
    setKelasList(initialKelasList);
    setSuccessMsg("Perubahan dibatalkan.");
  };

  // Helper: cek perubahan pengelompokan kelompok saja
  const isKelompokAssignmentChanged = () => {
    // Ambil hanya kelas yang ada di kedua snapshot (abaikan kelas yang baru ditambah/dihapus)
    const initialIds = new Set(initialKelasList.map(k => k.id));
    const currentIds = new Set(kelasList.map(k => k.id));
    // Ambil kelas yang id-nya ada di kedua list
    const sharedIds = [...initialIds].filter(id => currentIds.has(id));
    // Buat mapping kelompokIds hanya untuk kelas yang sama
    const getKelompokMap = (list: Kelas[], ids: number[]) =>
      ids.reduce((acc, id) => {
        const k = list.find(x => x.id === id);
        acc[id] = k ? (k.kelompokIds || []).slice().sort((a, b) => a - b) : [];
        return acc;
      }, {} as Record<number, number[]>);
    const initialMap = getKelompokMap(initialKelasList, sharedIds);
    const currentMap = getKelompokMap(kelasList, sharedIds);
    // Cek apakah ada perubahan assignment kelompok
    return JSON.stringify(initialMap) !== JSON.stringify(currentMap);
  };

  if (loading) {
    return (
      <div className="w-full">
        {/* Tombol Kembali skeleton */}
        <div className="mb-2">
          <div className="w-20 h-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
        {/* Header skeleton */}
        <div className="mt-20 mb-8 flex flex-col items-center">
          <div className="h-8 w-80 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
          <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded mb-6 animate-pulse"></div>
          <div className="flex flex-row gap-4 mt-6 items-center justify-center w-full">
            <div className="h-11 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            <div className="h-11 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          </div>
        </div>
        {/* Buttons skeleton */}
        <div className="flex gap-2 justify-end mt-10">
          <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
        </div>
        {/* Main content skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-5">
          {/* Left Column: Available Groups skeleton */}
          <div className="col-span-1 p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700">
            <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse"></div>
            <div className="space-y-2 min-h-[100px]">
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="p-2 rounded-lg bg-white dark:bg-gray-700 animate-pulse">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600"></div>
                    <div className="flex-1">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded mb-1"></div>
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
          {/* Right Column: Classes skeleton */}
          <div className="col-span-1 lg:col-span-2 space-y-8">
            {Array.from({ length: 2 }).map((_, i) => (
              <div key={i} className="rounded-2xl bg-white dark:bg-white/[0.03] shadow-sm border border-gray-200 dark:border-gray-700 flex flex-col gap-4 p-4">
                {/* Class Header skeleton */}
                <div className="flex items-start flex-col sm:flex-row justify-between">
                  <div className="flex flex-col sm:flex-row items-start gap-4">
                    <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-600 animate-pulse"></div>
                    <div>
                      <div className="h-6 w-32 bg-gray-200 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
                      <div className="h-4 w-48 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-5 sm:mt-0">
                    <div className="h-8 w-16 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                    <div className="h-8 w-16 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                  </div>
                </div>
                {/* Drop Zone skeleton */}
                <div className="min-h-[80px] bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 space-y-2">
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div key={j} className="p-2 rounded-lg bg-white dark:bg-gray-700 animate-pulse">
                      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600"></div>
                          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded"></div>
                        </div>
                        <div className="flex gap-2 items-center w-full sm:w-auto justify-between mt-2 sm:mt-0 sm:pl-0">
                          <div className="flex items-center gap-2 pl-10 sm:pl-0">
                            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded-full"></div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div className="h-4 w-12 bg-gray-200 dark:bg-gray-600 rounded"></div>
                            <div className="h-4 w-4 bg-gray-200 dark:bg-gray-600 rounded"></div>
                          </div>
                        </div>
                      </div>
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
    <div className="w-full">
      {/* Tombol Kembali tetap di pojok kiri atas */}
      <div className="mb-2">
        <button
          onClick={() => {
            // Tidak perlu cek snapshot, langsung navigate
            navigate('/generate/kelas');
          }}
          className="self-start flex items-center gap-2 text-brand-500 hover:text-brand-600 transition-all duration-300 ease-out hover:scale-105 transform"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          <span>Kembali</span>
        </button>
      </div>

      {/* Konten utama turun ke bawah dengan mt-20 */}
      <div className="mt-20 mb-8 flex flex-col items-center">
        <h1 className="text-3xl font-bold text-gray-800 dark:text-white/90 text-center">
          Manajemen Kelas Semester {semester}
        </h1>
        <p className="text-gray-600 dark:text-gray-400 text-center mt-2">
          Seret kelompok dari "Kelompok Tersedia" ke dalam kelas yang diinginkan.
        </p>
        <div className="flex flex-row gap-4 mt-6 items-center justify-center w-full">
          <input
            type="text"
            placeholder="Nama Kelas Baru (misal: A)"
            value={namaKelasBaru}
            onChange={(e) => setNamaKelasBaru(e.target.value)}
            disabled={kelompokList.length === 0}
            className="h-11 flex-1 max-w-xs rounded-lg border border-gray-200 bg-transparent py-2.5 px-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800 disabled:opacity-50"
          />
          <button
            onClick={handleTambahKelas}
            disabled={kelompokList.length === 0 || !namaKelasBaru.trim() || isAddingKelas}
            className="px-4 py-2 h-11 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition-all duration-300 ease-in-out transform disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAddingKelas ? (
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
              'Tambah Kelas'
            )}
          </button>
        </div>
      </div>

      {/* Notifikasi Error (merah) */}
      {errorMsg && (
        <div className="mb-3 p-3 mt-5 bg-red-100 dark:bg-red-900/30 border border-red-400 dark:border-red-600 rounded-lg text-red-800 dark:text-red-200 text-xs">
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Notifikasi Sukses (hijau) */}
      {successMsg && (
        <div className="mb-3 p-3 mt-5 bg-green-100 dark:bg-green-900/30 border border-green-400 dark:border-green-600 rounded-lg text-green-800 dark:text-green-200 text-xs">
          <div>{successMsg}</div>
        </div>
      )}

      {/* Banner perubahan belum disimpan (khusus drag & drop kelompok) */}
      {isKelompokAssignmentChanged() && (
        <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
              <span className="text-white text-xs">⚠️</span>
            </div>
            <span className="text-xs font-medium text-yellow-700 dark:text-yellow-300">
              Ada perubahan pengelompokan yang belum disimpan. Klik Simpan Data untuk menyimpan.
            </span>
          </div>
        </div>
      )}
      <div className="flex gap-2 justify-end mt-10">
        {/* Tombol Batal hanya aktif jika ada perubahan pengelompokan kelompok */}
        <button
          onClick={handleBatalDraft}
          className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!isKelompokAssignmentChanged()}
        >
          Batal
        </button>
        <button
          onClick={handleSimpanDraft}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs transition flex items-center gap-2 hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed"
          disabled={!isKelompokAssignmentChanged() || isSavingDraft}
        >
          {isSavingDraft ? (
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
            'Simpan Data'
          )}
        </button>
      </div>

      {kelompokList.length === 0 && (
         <div className="mb-3 p-3 mt-5 bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-400 dark:border-yellow-600 rounded-lg text-yellow-800 dark:text-yellow-200 text-xs">
           Belum ada kelompok di semester ini. Silakan lakukan pengelompokan di menu Kelompok terlebih dahulu.
         </div>
       )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mt-5">
        {/* Left Column: Available Groups */}
        <div
          className={`col-span-1 p-4 border rounded-2xl bg-gray-50 dark:bg-gray-800/50 transition-all duration-300 ${dragOverKelasId === 'available' ? 'border-brand-500 ring-2 ring-brand-400 shadow-lg' : 'border-gray-200 dark:border-gray-700'}`}
          onDragOver={(e) => handleDragOver(e, 'available')}
          onDrop={(e) => handleDrop(e, 'available')}
          onDragLeave={handleDragLeave}
        >
          <h3 className="font-semibold text-lg mb-4 text-gray-800 dark:text-white/90">Kelompok Tersedia ({availableKelompok.length})</h3>
          <div className="space-y-2 min-h-[100px]">
            <AnimatePresence>
              {availableKelompok.map(kelompok => {
                const mhsInKelompokAvailable = mahasiswaList.filter(m => Number(m.kelompok) === kelompok.id);
                const avgIpk = mhsInKelompokAvailable.length > 0 ? (mhsInKelompokAvailable.reduce((acc, m) => acc + parseFloat(m.ipk), 0) / mhsInKelompokAvailable.length).toFixed(2) : '-';
                return (
                  <motion.div
                    key={kelompok.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -20 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    onPointerDown={() => setDraggedKelompokId(kelompok.id)}
                    onPointerUp={handleDragEnd}
                    className=""
                  >
                    <div
                      draggable
                      onDragStart={(e) => handleDragStart(e, kelompok.id)}
                      onDragEnd={handleDragEnd}
                      className={`flex items-center gap-2 p-2 rounded-lg cursor-move transition-all duration-300 ease-out hover:shadow-md transform ${
                        draggedKelompokId === kelompok.id
                          ? 'opacity-50'
                          : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 hover:scale-[1.02] hover:-translate-y-0.5'
                      }`}
                    >
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                          <UserIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div className="flex-1">
                          <p className="font-medium text-gray-800 dark:text-white/90 text-sm">
                              {kelompok.nama}
                          </p>
                          <div className="flex items-center gap-2">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                                  {kelompok.count} mhs
                              </span>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                                  IPK {avgIpk}
                              </span>
                          </div>
                      </div>
                      <div className="text-gray-400 dark:text-gray-500 text-xs">
                          ⋮⋮
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
            {availableKelompok.length === 0 && kelompokList.length > 0 && (
              <div className="text-center text-sm text-gray-400 py-4">Semua kelompok sudah masuk kelas.</div>
            )}
          </div>
        </div>

        {/* Right Column: Classes */}
        <div className="col-span-1 lg:col-span-2 space-y-8">
          {kelasList.map(kelas => {
            const kelompokDiKelas = kelompokList.filter(k => kelas.kelompokIds.includes(k.id));
            const totalMahasiswa = kelompokDiKelas.reduce((acc, k) => acc + k.count, 0);

            const totalIpk = mahasiswaList
              .filter(m => kelas.kelompokIds.includes(Number(m.kelompok)))
              .reduce((acc, m) => acc + parseFloat(m.ipk), 0);
            
            const rataRataIpk = totalMahasiswa > 0 ? (totalIpk / totalMahasiswa).toFixed(2) : '0.00';

            return (
              <div
                key={kelas.id}
                className={`rounded-2xl bg-white dark:bg-white/[0.03] shadow-sm transition-all duration-300 flex flex-col gap-4 p-4
                  ${dragOverKelasId === kelas.id ? 'border-brand-500 ring-2 ring-brand-400 shadow-xl' : 'border border-gray-200 dark:border-gray-700'}`}
                onDragOver={(e) => handleDragOver(e, kelas.id)}
                onDrop={(e) => handleDrop(e, kelas.id)}
                onDragLeave={handleDragLeave}
              >
                {/* Class Header */}
                <div className="flex items-start flex-col sm:flex-row justify-between">
                    <div className="flex flex-col sm:flex-row items-start gap-4">
                        <div className="w-14 h-14 rounded-full bg-brand-500 flex-shrink-0 flex items-center justify-center text-white font-bold text-3xl shadow-md">{kelas.nama[0]?.toUpperCase() || "?"}</div>
                        <div>
                            {editId === kelas.id ? (
                                <input
                                    type="text"
                                    value={editNama}
                                    onChange={e => setEditNama(e.target.value)}
                                    className="font-bold text-2xl text-gray-800 dark:text-white/90 bg-transparent border-b-2 border-brand-500 focus:outline-none"
                                    autoFocus
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleSimpanEdit(kelas.id);
                                        if (e.key === 'Escape') setEditId(null);
                                    }}
                                />
                            ) : (
                                <h3 className="font-semibold text-2xl text-gray-800 dark:text-white/90">Kelas {kelas.nama}</h3>
                            )}
                            <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1 flex-wrap">
                                <span>{kelas.kelompokIds.length} Kelompok</span> • <span>{totalMahasiswa} Mahasiswa</span> • <span>Rata-rata IPK: <span className="font-semibold text-gray-700 dark:text-gray-200">{rataRataIpk}</span></span>
                            </div>
                        </div>
                    </div>
                    <div className="flex gap-2 mt-5 sm:mt-0">
                        {editId === kelas.id ? (
                            <>
                                <button onClick={() => handleSimpanEdit(kelas.id)} className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 text-sm transition">
                                    {isSavingEditId === kelas.id ? (
                                        <>
                                            <svg className="w-5 h-5 mr-2 animate-spin text-white inline-block align-middle" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                                            </svg>
                                            Menyimpan...
                                        </>
                                    ) : (
                                        'Simpan'
                                    )}
                                </button>
                                <button onClick={() => setEditId(null)} className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 text-sm transition">Batal</button>
                            </>
                        ) : (
                            <div className="flex items-center justify-center gap-2">
                                <button
                                  onClick={() => { setEditId(kelas.id); setEditNama(kelas.nama); }}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition"
                                  title="Edit"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.5L16.732 3.732z" /></svg>
                                  <span className="hidden sm:inline">Edit</span>
                                </button>
                                <button
                                  onClick={() => handleHapusKelas(kelas.id)}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition"
                                  title="Hapus"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                                  <span className="hidden sm:inline">Hapus</span>
                                </button>
                              </div>
                        )}
                    </div>
                </div>

                {/* Drop Zone */}
                <div className="min-h-[80px] bg-gray-50 dark:bg-gray-800/50 p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 space-y-2">
                  {kelas.kelompokIds.map(kelompokId => {
                    const kelompok = kelompokList.find(k => k.id === kelompokId);
                    if (!kelompok) return null;
                    const mhsInKelompok = mahasiswaList.filter(m => Number(m.kelompok) === kelompok.id);
                    const avgIpk = mhsInKelompok.length > 0 ? (mhsInKelompok.reduce((acc, m) => acc + parseFloat(m.ipk), 0) / mhsInKelompok.length).toFixed(2) : '-';
                    return (
                      <AnimatePresence key={kelompok.id}>
                        <motion.div
                          layout
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                          onPointerDown={() => setDraggedKelompokId(kelompok.id)}
                          onPointerUp={handleDragEnd}
                          className=""
                        >
                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, kelompok.id)}
                            onDragEnd={handleDragEnd}
                            className={`flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 p-2 rounded-lg cursor-move transition-all duration-300 ease-out hover:shadow-md transform relative ${
                              draggedKelompokId === kelompok.id
                                ? 'opacity-50'
                                : 'bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 hover:scale-[1.02] hover:-translate-y-0.5'
                            }`}
                          >
                            <div className="flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-600 flex items-center justify-center flex-shrink-0">
                                    <UserIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                                </div>
                                <div className="flex-1">
                                    <p className="font-medium text-gray-800 dark:text-white/90 text-sm">
                                        {kelompok.nama}
                                    </p>
                                </div>
                            </div>

                            <div className="flex gap-2 items-center w-full sm:w-auto justify-between mt-2 sm:mt-0 sm:pl-0">
                                <div className="flex items-center gap-2 pl-10 sm:pl-0">
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                                        {kelompok.count} mhs
                                    </span>
                                    <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                                        IPK {avgIpk}
                                    </span>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        type="button"
                                        onClick={e => { e.stopPropagation(); setExpandedKelompokKelas(prev => ({ ...prev, [kelas.id]: prev[kelas.id] === kelompok.id ? null : kelompok.id })); }}
                                        className={`text-xs font-semibold focus:outline-none transition-colors duration-200 underline hover:text-brand-500 ${expandedKelompokKelas[kelas.id] === kelompok.id ? 'text-brand-500' : 'text-gray-500 dark:text-gray-300'}`}
                                        style={{ background: 'none', border: 'none', padding: 0 }}
                                    >
                                        {expandedKelompokKelas[kelas.id] === kelompok.id ? 'Tutup' : 'Lihat'}
                                    </button>
                                    <div className="text-gray-400 dark:text-gray-500 text-xs">
                                        ⋮⋮
                                    </div>
                                </div>
                            </div>
                          </div>
                          {expandedKelompokKelas[kelas.id] === kelompok.id && (
                            <div className="w-full mt-2 ml-8">
                              {mhsInKelompok.length === 0 ? (
                                <div className="text-gray-400 text-sm">Tidak ada mahasiswa.</div>
                              ) : (
                                <ul className="space-y-1">
                                  {mhsInKelompok.map((m: any) => {
                                    // Debug log untuk cek field nama
                                    if (!m.nama && !m.name) {

                                    }
                                    return (
                                      <li key={m.id} className="flex flex-col sm:flex-row justify-start items-start gap-2 text-gray-700 dark:text-gray-200 text-sm">
                                        <div className="flex items-center">
                                          <UserIcon className="w-4 h-4" />
                                          <span className="ml-2 ">{m.nama || m.name || '-'}</span>
                                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">({m.nim})</span>
                                        </div>
                                        <div className="flex">
                                          <span className={`ml-2 text-xs px-2 py-0.5 rounded-full
                                            ${m.ipk >= 3.5 ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' :
                                              m.ipk >= 3.0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' :
                                              m.ipk >= 2.5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' :
                                              'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                            }`}>
                                            IPK {m.ipk}
                                          </span>
                                        </div>
                                      </li>
                                    );
                                  })}
                                </ul>
                              )}
                            </div>
                          )}
                        </motion.div>
                      </AnimatePresence>
                    );
                  })}
                  {kelas.kelompokIds.length === 0 && (
                    <div className="text-center text-sm text-gray-400 py-4">Seret kelompok ke sini.</div>
                  )}
                </div>
              </div>
            );
          })}
          {kelasList.length === 0 && kelompokList.length > 0 && (
            <div className="text-center text-gray-400 mt-10">Belum ada kelas yang dibuat. Silakan tambah kelas baru.</div>
          )}
        </div>
      </div>

      {/* Modal Konfirmasi Keluar */}
      <AnimatePresence>
        {showLeaveModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowLeaveModal(false)}
            ></motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg z-[100001]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center mb-3">
                <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mr-4">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white leading-tight">Konfirmasi Keluar</h3>
                  <p className="text-base text-red-500 dark:text-red-400 mt-1">Perubahan Belum Disimpan</p>
                </div>
              </div>
              <p className="text-lg text-gray-800 dark:text-white text-center font-medium mb-3">Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?</p>
              <div className="flex gap-4 w-full mt-2">
                <button
                  onClick={() => setShowLeaveModal(false)}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold rounded-xl text-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 ease-out"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    setShowLeaveModal(false);
                    if (pendingLeaveAction) pendingLeaveAction();
                  }}
                  className="flex-1 px-4 py-3 bg-red-500 text-white font-semibold rounded-xl text-lg hover:bg-red-600 transition-all duration-200 ease-out"
                >
                  Lanjutkan
                </button>
              </div>
              <button
                onClick={() => setShowLeaveModal(false)}
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 dark:hover:text-white bg-transparent rounded-full p-1 transition-colors duration-200"
                aria-label="Tutup"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Konfirmasi Hapus */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowDeleteModal(null)}
            ></motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg z-[100001]"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center mb-3">
                <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mr-4">
                  <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white leading-tight">Konfirmasi Hapus</h3>
                  <p className="text-base text-gray-500 dark:text-gray-400 mt-1">Hapus Kelas</p>
                </div>
              </div>
              <p className="text-lg text-gray-800 dark:text-white text-center font-medium mb-3">
                Apakah Anda yakin ingin menghapus <span className="font-bold text-red-500">Kelas {showDeleteModal.nama}</span>?
              </p>
               <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 mb-8">
                <svg className="w-6 h-6 text-red-500 dark:text-red-300 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
                <div>
                  <p className="font-bold text-red-500 dark:text-red-300 mb-1">Tindakan ini tidak dapat dibatalkan!</p>
                  <p className="text-red-500 dark:text-red-300 leading-snug">Semua kelompok di dalam kelas ini akan dikembalikan ke daftar "Kelompok Tersedia".</p>
                </div>
              </div>
              <div className="flex gap-4 w-full mt-2">
                <button
                  onClick={() => setShowDeleteModal(null)}
                  className="flex-1 px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-semibold rounded-xl text-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200 ease-out"
                >
                  Batal
                </button>
                <button
                  onClick={confirmHapusKelas}
                  className="flex-1 px-4 py-3 bg-red-500 text-white font-semibold rounded-xl text-lg hover:bg-red-600 transition-all duration-200 ease-out"
                  disabled={isDeletingClass}
                >
                  {isDeletingClass ? (
                    <>
                      <svg className="w-5 h-5 mr-2 animate-spin text-white inline-block align-middle" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      Menghapus...
                    </>
                  ) : (
                    'Hapus'
                  )}
                </button>
              </div>
              <button
                onClick={() => setShowDeleteModal(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 dark:hover:text-white bg-transparent rounded-full p-1 transition-colors duration-200"
                aria-label="Tutup"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default KelasDetail; 
