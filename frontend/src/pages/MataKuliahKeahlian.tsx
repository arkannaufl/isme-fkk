import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faEdit,
  faSave,
  faTimes,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { AnimatePresence, motion } from "framer-motion";
import api, { handleApiError } from "../utils/api";
import { useNavigate } from "react-router-dom";

type MataKuliah = {
  kode: string;
  nama: string;
  semester: number;
  periode: string;
  jenis: "Blok" | "Non Blok";
  kurikulum: number;
  tanggalMulai: string;
  tanggalAkhir: string;
  blok: number | null;
  durasiMinggu: number | null;
  tanggal_mulai?: string;
  tanggal_akhir?: string;
  durasi_minggu?: number | null;
  keahlian_required?: string[];
};

interface Dosen {
  id: number;
  nid: string;
  name: string;
  keahlian: string[] | string;
}

export default function MataKuliahKeahlian() {
  const navigate = useNavigate();
  const [mataKuliahList, setMataKuliahList] = useState<MataKuliah[]>([]);
  const [dosenList, setDosenList] = useState<Dosen[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingKeahlian, setEditingKeahlian] = useState<string | null>(null);
  const [inputKeahlian, setInputKeahlian] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSemester, setFilterSemester] = useState("semua");
  const [activeSemesterJenis, setActiveSemesterJenis] = useState<string | null>(null);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);
      try {
        const [pblRes, dosenRes, activeSemesterRes] = await Promise.all([
          api.get("/pbls/all"),
          api.get("/users?role=dosen&per_page=1000"),
          api.get("/tahun-ajaran/active"),
        ]);

        // Process PBL data to get mata kuliah
        const data = pblRes.data || {};
        const blokListMapped: MataKuliah[] = Array.from(
          Object.values(data) as { mata_kuliah: MataKuliah }[]
        ).map((item) => item.mata_kuliah);

        setMataKuliahList(blokListMapped);
        // Handle pagination response
        const dosenData = Array.isArray(dosenRes.data) 
          ? dosenRes.data 
          : (dosenRes.data?.data || []);
        setDosenList(dosenData);

        // Set active semester
        const semester = activeSemesterRes.data?.semesters?.[0];
        if (semester && semester.jenis) {
          setActiveSemesterJenis(semester.jenis);
        }
      } catch (err) {
        setError("Gagal memuat data mata kuliah/dosen");
        setMataKuliahList([]);
        setDosenList([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Filter mata kuliah by active semester
  const filteredMataKuliah = activeSemesterJenis
    ? mataKuliahList.filter(
        (mk: MataKuliah) =>
          mk.periode &&
          mk.periode.trim().toLowerCase() === activeSemesterJenis.trim().toLowerCase()
      )
    : mataKuliahList;

  // Filter by search
  const searchFilteredMataKuliah = filteredMataKuliah.filter((mk) =>
    mk.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
    mk.kode.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Group by semester
  const groupedBySemester = searchFilteredMataKuliah.reduce(
    (acc: Record<number, MataKuliah[]>, mk: MataKuliah) => {
      if (!acc[mk.semester]) acc[mk.semester] = [];
      acc[mk.semester].push(mk);
      return acc;
    },
    {}
  );

  const sortedSemesters = Object.keys(groupedBySemester)
    .map(Number)
    .sort((a, b) => a - b);

  // Helper untuk ambil semua keahlian unik dari dosenList
  const getAllKeahlian = (dosenList: Dosen[]): string[] => {
    const allKeahlian = new Set<string>();
    dosenList.forEach((d: Dosen) => {
      const keahlianArr = Array.isArray(d.keahlian)
        ? d.keahlian
        : (d.keahlian || "").split(",").map((k: string) => k.trim());
      keahlianArr.forEach((k: string) => allKeahlian.add(k));
    });
    return Array.from(allKeahlian).sort();
  };

  const handleEditKeahlian = (kode: string) => {
    setEditingKeahlian(kode);
    const mk = mataKuliahList.find(m => m.kode === kode);
    setInputKeahlian("");
  };

  const handleSaveKeahlian = async (kode: string, keahlianBaru?: string) => {
    try {
      const mk = mataKuliahList.find(m => m.kode === kode);
      if (!mk) return;

      const currentKeahlian = mk.keahlian_required || [];
      let newKeahlian = [...currentKeahlian];

      // Jika ada keahlianBaru dari klik suggestion, pakai itu
      if (keahlianBaru && !newKeahlian.includes(keahlianBaru)) {
        newKeahlian.push(keahlianBaru);
      } else if (inputKeahlian.trim() && !newKeahlian.includes(inputKeahlian.trim())) {
        newKeahlian.push(inputKeahlian.trim());
      }

      await api.put(`/mata-kuliah/${kode}/keahlian`, {
        keahlian_required: newKeahlian
      });

      setMataKuliahList(prev => 
        prev.map(m => 
          m.kode === kode 
            ? { ...m, keahlian_required: newKeahlian }
            : m
        )
      );

      setSuccess('Keahlian berhasil diperbarui');
      setEditingKeahlian(null);
      setInputKeahlian("");
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Gagal memperbarui keahlian');
    }
  };

  const handleRemoveKeahlian = async (kode: string, keahlianToRemove: string) => {
    try {
      const mk = mataKuliahList.find(m => m.kode === kode);
      if (!mk) return;

      const currentKeahlian = mk.keahlian_required || [];
      const newKeahlian = currentKeahlian.filter(k => k !== keahlianToRemove);

      await api.put(`/mata-kuliah/${kode}/keahlian`, {
        keahlian_required: newKeahlian
      });

      // Update local state
      setMataKuliahList(prev => 
        prev.map(m => 
          m.kode === kode 
            ? { ...m, keahlian_required: newKeahlian }
            : m
        )
      );

      setSuccess('Keahlian berhasil dihapus');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Gagal menghapus keahlian');
    }
  };

  if (loading) {
    return (
      <div className="w-full mx-auto">
        <div className="mb-8">
          <div className="h-8 w-80 bg-gray-700 dark:bg-gray-800 rounded mb-2 animate-pulse" />
          <div className="h-4 w-96 bg-gray-700 dark:bg-gray-800 rounded animate-pulse" />
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-700 dark:bg-gray-800 animate-pulse" />
                <div className="flex-1">
                  <div className="h-6 w-16 bg-gray-700 dark:bg-gray-800 rounded mb-2 animate-pulse" />
                  <div className="h-4 w-24 bg-gray-700 dark:bg-gray-800 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Skeleton search input */}
        <div className="bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-800 rounded-xl p-6 mb-6">
          <div className="h-10 w-full bg-gray-700 dark:bg-gray-800 rounded animate-pulse" />
        </div>
        {/* Skeleton list mata kuliah */}
        <div className="space-y-6">
          {Array.from({ length: 2 }).map((_, sIdx) => (
            <div key={sIdx} className="bg-gray-800 dark:bg-gray-900 border border-gray-700 dark:border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center" />
                <div>
                  <div className="h-6 w-32 bg-gray-700 dark:bg-gray-800 rounded mb-2 animate-pulse" />
                  <div className="h-4 w-24 bg-gray-700 dark:bg-gray-800 rounded animate-pulse" />
                </div>
              </div>
              <div className="space-y-4">
                {Array.from({ length: 2 }).map((_, mkIdx) => (
                  <div key={mkIdx} className="p-4 bg-gray-700 dark:bg-gray-800/30 border border-gray-700 dark:border-gray-800 rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="h-5 w-48 bg-gray-800 dark:bg-gray-900 rounded mb-2 animate-pulse" />
                        <div className="h-4 w-32 bg-gray-800 dark:bg-gray-900 rounded mb-2 animate-pulse" />
                        {/* Keahlian Section Skeleton */}
                        <div className="mt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="h-4 w-32 bg-gray-800 dark:bg-gray-900 rounded animate-pulse" />
                            <div className="h-6 w-16 bg-gray-700 dark:bg-gray-800 rounded animate-pulse" />
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {Array.from({ length: 3 }).map((_, kIdx) => (
                              <span key={kIdx} className="h-6 w-20 bg-gray-800 dark:bg-gray-900 rounded-full animate-pulse" />
                            ))}
                          </div>
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
    );
  }

  return (
    <div className="w-full mx-auto">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => navigate('/pbl')}
          className="flex items-center gap-2 text-brand-500 hover:text-brand-600 transition-all duration-300 ease-out hover:scale-105 transform mb-4"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Kembali
        </button>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
          Kelola Keahlian Mata Kuliah
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Atur keahlian yang diperlukan untuk setiap mata kuliah PBL
        </p>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <FontAwesomeIcon icon={faEdit} className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {filteredMataKuliah.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Mata Kuliah
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <FontAwesomeIcon icon={faSave} className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {filteredMataKuliah.filter(mk => mk.keahlian_required && mk.keahlian_required.length > 0).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Sudah Ada Keahlian
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <FontAwesomeIcon icon={faTimes} className="w-6 h-6 text-orange-500" />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {filteredMataKuliah.filter(mk => !mk.keahlian_required || mk.keahlian_required.length === 0).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Belum Ada Keahlian
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notifications */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-green-100 border text-green-700 p-3 rounded-lg mb-6"
          >
            {success}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-100 border text-red-700 p-3 rounded-lg mb-6"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari mata kuliah..."
            className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-theme-xs"
          />
        </div>
      </div>

      {/* Mata Kuliah List */}
      <div className="space-y-6">
        {sortedSemesters.map(semester => {
          const semesterMataKuliah = groupedBySemester[semester];
          return (
            <div key={semester} className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center">
                  <span className="text-white font-bold text-lg">{semester}</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                    Semester {semester}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {semesterMataKuliah.length} mata kuliah
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                {semesterMataKuliah.map((mk) => (
                  <div key={mk.kode} className="p-4 bg-gray-50 dark:bg-gray-800/30 border border-gray-200 dark:border-gray-700 rounded-lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <h4 className="font-semibold text-gray-800 dark:text-white/90 text-lg">
                          {mk.kode} - {mk.nama}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Blok {mk.blok} • Periode {mk.periode}
                        </p>
                        
                        {/* Keahlian Section */}
                        <div className="mt-4">
                          <div className="flex items-center gap-2 mb-2">
                            <h5 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                              Keahlian yang Diperlukan:
                            </h5>
                            {editingKeahlian === mk.kode ? (
                              <button
                                onClick={() => handleSaveKeahlian(mk.kode)}
                                className="text-xs px-2 py-1 bg-green-500 text-white rounded hover:bg-green-600 transition"
                              >
                                <FontAwesomeIcon icon={faSave} className="w-3 h-3 mr-1" />
                                Simpan
                              </button>
                            ) : (
                              <button
                                onClick={() => handleEditKeahlian(mk.kode)}
                                className="text-xs px-2 py-1 bg-brand-500 text-white rounded hover:bg-brand-600 transition"
                              >
                                <FontAwesomeIcon icon={faEdit} className="w-3 h-3 mr-1" />
                                Edit
                              </button>
                            )}
                          </div>
                          
                          {editingKeahlian === mk.kode ? (
                            <div className="space-y-2">
                              <div className="relative">
                                <input
                                  type="text"
                                  value={inputKeahlian}
                                  onChange={e => setInputKeahlian(e.target.value)}
                                  onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (inputKeahlian.trim()) {
                                        handleSaveKeahlian(mk.kode);
                                      }
                                    }
                                  }}
                                  placeholder="Tambah keahlian..."
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                                {/* Dropdown suggestion */}
                                {inputKeahlian && (
                                  <div className="absolute left-0 top-full w-full z-50 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg mt-1 max-h-40 overflow-y-auto shadow-lg hide-scroll">
                                    {getAllKeahlian(dosenList)
                                      .filter(k => !(mk.keahlian_required || []).includes(k) && k.toLowerCase().includes(inputKeahlian.toLowerCase()))
                                      .slice(0, 8)
                                      .map((k) => (
                                        <button
                                          key={k}
                                          type="button"
                                          onClick={() => handleSaveKeahlian(mk.kode, k)}
                                          className="block w-full text-left px-4 py-2 text-sm hover:bg-brand-100 dark:hover:bg-brand-900/30 text-gray-700 dark:text-gray-200"
                                        >
                                          {k}
                                        </button>
                                      ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : null}
                          
                          <div className="flex flex-wrap gap-2">
                            {(mk.keahlian_required || []).map((keahlian, idx) => (
                              <span key={idx} className="flex items-center bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-200 px-3 py-1 rounded-full text-xs font-medium">
                                {keahlian}
                                <button
                                  type="button"
                                  onClick={() => handleRemoveKeahlian(mk.kode, keahlian)}
                                  className="ml-2 text-xs text-red-500 hover:text-red-700 focus:outline-none"
                                >
                                  ×
                                </button>
                              </span>
                            ))}
                            {(mk.keahlian_required || []).length === 0 && (
                              <span className="text-xs text-gray-400">Belum ada keahlian dipilih</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
} 
