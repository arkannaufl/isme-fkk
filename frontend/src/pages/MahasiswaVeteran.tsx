import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { mahasiswaVeteranApi, Mahasiswa } from "../api/generateApi";
import { UserIcon } from "../icons";

const MahasiswaVeteran: React.FC = () => {
  const [mahasiswaList, setMahasiswaList] = useState<Mahasiswa[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filter dan search states
  const [search, setSearch] = useState("");
  const [filterAngkatan, setFilterAngkatan] = useState<string>("all");
  const [filterVeteran, setFilterVeteran] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);
  
  // Modal states
  const [showVeteranModal, setShowVeteranModal] = useState(false);
  const [selectedMahasiswa, setSelectedMahasiswa] = useState<Mahasiswa | null>(null);
  const [veteranNotes, setVeteranNotes] = useState("");
  const [isToggling, setIsToggling] = useState(false);
  
  // Multi-veteran states
  const [isTogglingMultiVeteran, setIsTogglingMultiVeteran] = useState(false);
  
  // Multi-select states
  const [selectedMahasiswaIds, setSelectedMahasiswaIds] = useState<number[]>([]);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState<'set' | 'remove'>('set');
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);
  const [selectAllMode, setSelectAllMode] = useState<'page' | 'all'>('page');

  useEffect(() => {
    const fetchMahasiswaVeteran = async () => {
      try {
        setLoading(true);
        setError(null);
        const params: any = {};
        
        if (filterVeteran === "veteran") {
          params.veteran_only = true;
        } else if (filterVeteran === "non-veteran") {
          // For non-veteran, we'll filter on frontend since backend doesn't have this option
          params.veteran_only = false;
        }
        
        if (filterAngkatan !== "all") {
          params.angkatan = filterAngkatan;
        }
        
        if (search) {
          params.search = search;
        }
        
        const response = await mahasiswaVeteranApi.getAll(params);
        setMahasiswaList(response.data);
      } catch (err: any) {
        console.error("Error fetching mahasiswa veteran:", err);
        const errorMessage = err.response?.data?.message || err.message || "Gagal memuat data mahasiswa";
        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchMahasiswaVeteran();
  }, [filterVeteran, filterAngkatan, search]);


  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'aktif':
        return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400';
      case 'tidak aktif':
        return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400';
      case 'cuti':
        return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400';
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  // Filter options
  const angkatanOptions = Array.from(new Set(mahasiswaList.map((m) => m.angkatan))).sort((a, b) => Number(b) - Number(a));

  // Filter non-veteran on frontend if needed
  const filteredData = mahasiswaList.filter((m) => {
    if (filterVeteran === "non-veteran") {
      return !m.is_veteran;
    }
    return true;
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

  // Check if any filters are active
  const hasActiveFilters = search || filterAngkatan !== "all" || filterVeteran !== "all";

  // Clear all filters
  const clearAllFilters = () => {
    setSearch("");
    setFilterAngkatan("all");
    setFilterVeteran("all");
    setPage(1);
  };

  // Toggle veteran status
  const handleToggleVeteran = (mahasiswa: Mahasiswa) => {
    setSelectedMahasiswa(mahasiswa);
    setVeteranNotes(mahasiswa.veteran_notes || "");
    setShowVeteranModal(true);
  };

  const confirmToggleVeteran = async () => {
    if (!selectedMahasiswa) return;

    try {
      setIsToggling(true);
      const newVeteranStatus = !selectedMahasiswa.is_veteran;
      
      await mahasiswaVeteranApi.toggleVeteran({
        user_id: selectedMahasiswa.id,
        is_veteran: newVeteranStatus,
        veteran_notes: veteranNotes.trim() || undefined
      });

      // Update local state
      setMahasiswaList(prev => 
        prev.map(m => 
          m.id === selectedMahasiswa.id 
            ? { 
                ...m, 
                is_veteran: newVeteranStatus,
                veteran_notes: veteranNotes.trim() || undefined,
                veteran_set_at: newVeteranStatus ? new Date().toISOString() : undefined
              }
            : m
        )
      );

      setShowVeteranModal(false);
      setSelectedMahasiswa(null);
      setVeteranNotes("");
    } catch (err) {
      console.error("Error toggling veteran status:", err);
      setError("Gagal mengupdate status veteran");
    } finally {
      setIsToggling(false);
    }
  };

  // Toggle multi-veteran status
  const handleToggleMultiVeteran = async (mahasiswa: Mahasiswa) => {
    if (!mahasiswa.is_veteran) {
      setError("Mahasiswa harus veteran terlebih dahulu");
      return;
    }

    try {
      setIsTogglingMultiVeteran(true);
      const newMultiVeteranStatus = !mahasiswa.is_multi_veteran;
      
      await mahasiswaVeteranApi.toggleMultiVeteran({
        user_id: mahasiswa.id,
        is_multi_veteran: newMultiVeteranStatus
      });

      // Update local state
      setMahasiswaList(prev => 
        prev.map(m => 
          m.id === mahasiswa.id 
            ? { 
                ...m, 
                is_multi_veteran: newMultiVeteranStatus,
                // Jika multi-veteran dihapus dan ada lebih dari 1 semester, hapus semua kecuali yang pertama kali didaftarkan
                veteran_semesters: !newMultiVeteranStatus && m.veteran_semesters && m.veteran_semesters.length > 1 
                  ? (() => {
                      // Cari semester pertama dari veteran_history
                      const history = m.veteran_history || [];
                      const firstEntry = history.find(entry => 
                        entry.action === 'set_veteran' && entry.active === true
                      );
                      return firstEntry && firstEntry.semester 
                        ? [firstEntry.semester] 
                        : [m.veteran_semesters[0]]; // Fallback ke semester pertama
                    })()
                  : m.veteran_semesters
              }
            : m
        )
      );
    } catch (err: any) {
      console.error("Error toggling multi-veteran status:", err);
      const errorMessage = err.response?.data?.message || err.message || "Gagal mengupdate status multi-veteran";
      setError(errorMessage);
    } finally {
      setIsTogglingMultiVeteran(false);
    }
  };

  // Multi-select functions
  const handleSelectMahasiswa = (mahasiswaId: number) => {
    setSelectedMahasiswaIds(prev => 
      prev.includes(mahasiswaId) 
        ? prev.filter(id => id !== mahasiswaId)
        : [...prev, mahasiswaId]
    );
  };

  const handleSelectAll = () => {
    if (selectAllMode === 'page') {
      // Mode: Select All di halaman saat ini
      const currentPageIds = paginatedData.map(m => m.id);
      const allCurrentPageSelected = currentPageIds.every(id => selectedMahasiswaIds.includes(id));
      
      if (allCurrentPageSelected) {
        // Jika semua data di halaman saat ini terpilih, hapus semua data di halaman ini dari selection
        setSelectedMahasiswaIds(prev => prev.filter(id => !currentPageIds.includes(id)));
      } else {
        // Jika belum semua terpilih, tambahkan semua data di halaman ini ke selection
        setSelectedMahasiswaIds(prev => {
          const newIds = currentPageIds.filter(id => !prev.includes(id));
          return [...prev, ...newIds];
        });
      }
    } else {
      // Mode: Select All di seluruh data
      const allDataIds = mahasiswaList.map(m => m.id);
      const allDataSelected = allDataIds.every(id => selectedMahasiswaIds.includes(id));
      
      if (allDataSelected) {
        // Jika semua data terpilih, hapus semua
        setSelectedMahasiswaIds([]);
      } else {
        // Jika belum semua terpilih, pilih semua
        setSelectedMahasiswaIds(allDataIds);
      }
    }
  };

  const handleSelectAllModeToggle = () => {
    setSelectAllMode(prev => prev === 'page' ? 'all' : 'page');
    setSelectedMahasiswaIds([]); // Reset selection saat ganti mode
  };

  const handleBulkAction = (action: 'set' | 'remove') => {
    if (selectedMahasiswaIds.length === 0) return;
    setBulkAction(action);
    setShowBulkModal(true);
  };

  const confirmBulkAction = async () => {
    if (selectedMahasiswaIds.length === 0) return;

    setIsBulkProcessing(true);
    try {
      await mahasiswaVeteranApi.bulkToggleVeteran({
        user_ids: selectedMahasiswaIds,
        is_veteran: bulkAction === 'set',
        veteran_notes: veteranNotes
      });

      // Refresh data
      setMahasiswaList([]);
      setLoading(true);
      try {
        const response = await mahasiswaVeteranApi.getAll({
          veteran_only: filterVeteran === 'veteran' ? true : filterVeteran === 'non-veteran' ? false : undefined,
          angkatan: filterAngkatan !== 'all' ? filterAngkatan : undefined,
          search: search || undefined
        });
        setMahasiswaList(response.data);
      } catch (error) {
        console.error('Error fetching mahasiswa veteran:', error);
        setError('Gagal mengambil data mahasiswa veteran');
      } finally {
        setLoading(false);
      }
      
      setShowBulkModal(false);
      setSelectedMahasiswaIds([]);
      setVeteranNotes("");
    } catch (error) {
      console.error('Error bulk toggling veteran status:', error);
    } finally {
      setIsBulkProcessing(false);
    }
  };

  if (loading) {
    return (
      <div className="w-full mx-auto">
        {/* Header Skeleton */}
        <div className="mt-5">
          <div className="mb-8">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-64 mb-2 animate-pulse"></div>
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-96 animate-pulse"></div>
          </div>
        </div>

        {/* Controls Skeleton */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
              <div className="flex items-center gap-2">
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse"></div>
              </div>
              <div className="flex items-start md:items-center flex-col md:flex-row gap-4">
                <div className="flex items-center gap-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12 animate-pulse"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
                  <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
            </div>
          </div>
        </div>

        {/* Main Content Skeleton */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
          </div>

          {/* Search Skeleton */}
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-64 animate-pulse"></div>
          </div>

          {/* Grid Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 animate-pulse">
                <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2"></div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-12"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-14"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                  </div>
                  <div className="mt-2">
                    <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                  </div>
                </div>
              </div>
                ))}
              </div>

          {/* Pagination Skeleton */}
          <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse"></div>
            </div>
            <div className="flex gap-1">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12 animate-pulse"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-8 animate-pulse"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-8 animate-pulse"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-8 animate-pulse"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-12 animate-pulse"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Error Loading Data</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto">
      {/* Header */}
      <div className="mt-5">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
                Mahasiswa Veteran
              </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Kelola data mahasiswa veteran dengan informasi NIM, angkatan, dan IPK
          </p>
        </div>
      </div>

      {/* Controls */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={
                    selectAllMode === 'page' 
                      ? selectedMahasiswaIds.length === paginatedData.length && paginatedData.length > 0
                      : selectedMahasiswaIds.length === mahasiswaList.length && mahasiswaList.length > 0
                  }
                  onChange={handleSelectAll}
                  className={`
                    w-5 h-5
                    appearance-none
                    rounded-md
                    border-2
                    ${(selectAllMode === 'page' 
                      ? selectedMahasiswaIds.length === paginatedData.length && paginatedData.length > 0
                      : selectedMahasiswaIds.length === mahasiswaList.length && mahasiswaList.length > 0
                    ) ? "border-green-500 bg-green-500" : "border-green-500 bg-transparent"}
                    transition-colors
                    duration-150
                    focus:ring-2 focus:ring-green-300
                    dark:focus:ring-green-600
                    relative
                  `}
                  style={{ outline: "none" }}
                />
                {(selectAllMode === 'page' 
                  ? selectedMahasiswaIds.length === paginatedData.length && paginatedData.length > 0
                  : selectedMahasiswaIds.length === mahasiswaList.length && mahasiswaList.length > 0
                ) && (
                  <svg
                    className="absolute left-0 top-0 w-5 h-5 pointer-events-none"
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="white"
                    strokeWidth="2.5"
                  >
                    <polyline points="5 11 9 15 15 7" />
                  </svg>
                )}
              </span>
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Pilih Semua (
                {selectAllMode === 'page' 
                  ? selectedMahasiswaIds.filter((id) => paginatedData.map(m => m.id).includes(id)).length
                  : selectedMahasiswaIds.length
                }/{selectAllMode === 'page' ? paginatedData.length : mahasiswaList.length} tersedia)
              </span>
            </label>

            <div className="flex items-start md:items-center flex-col md:flex-row gap-4">
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Status:
                </label>
                <select
                  value={filterVeteran}
                  onChange={(e) => { setFilterVeteran(e.target.value); setPage(1); }}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="all">Semua Status</option>
                  <option value="veteran">Veteran</option>
                  <option value="non-veteran">Non-Veteran</option>
                </select>
                </div>

              <div className="flex items-center gap-2">
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Angkatan:
                </label>
                <select
                  value={filterAngkatan}
                  onChange={(e) => { setFilterAngkatan(e.target.value); setPage(1); }}
                  className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                >
                  <option value="all">Semua Angkatan</option>
                  {angkatanOptions.map((angkatan) => (
                    <option key={angkatan} value={angkatan}>
                      {angkatan}
                    </option>
                  ))}
                </select>
                </div>
              </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleSelectAllModeToggle}
              className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors px-2 py-1 rounded"
            >
              {selectAllMode === 'page' ? 'Halaman' : 'Semua'}
            </button>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                className="px-3 py-1 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>
      </div>
          {/* Bulk Actions */}
          {selectedMahasiswaIds.length > 0 && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                      {selectedMahasiswaIds.length} mahasiswa dipilih
                    </span>
                  </div>
            <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkAction('set')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Set Veteran
                  </button>
                  <button
                    onClick={() => handleBulkAction('remove')}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Hapus Veteran
                  </button>
                  <button
                    onClick={() => setSelectedMahasiswaIds([])}
                className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Batal
                  </button>
                </div>
              </div>
            </div>
          )}

      {/* Daftar Mahasiswa */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
            Mahasiswa Veteran ({filteredData.length} tersedia dari {mahasiswaList.length} total)
          </h3>
        </div>

        {/* Input Search */}
        <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Cari nama atau NIM..."
            className="w-full sm:w-64 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-400"
          />
          {selectedMahasiswaIds.length > 0 && (
            <button
              type="button"
              onClick={() => setSelectedMahasiswaIds([])}
              className="sm:ml-2 w-full sm:w-auto px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all"
            >
              Uncheck Semua
            </button>
          )}
        </div>

          {mahasiswaList.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-orange-500" />
              </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Belum Ada Data Mahasiswa
              </h3>
            <p className="text-orange-600 dark:text-orange-300">
              Data mahasiswa akan muncul di sini setelah ditambahkan.
              </p>
            </div>
          ) : filteredData.length === 0 ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
              <UserIcon className="w-8 h-8 text-orange-500" />
              </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Tidak Ada Data yang Cocok
              </h3>
            <p className="text-orange-600 dark:text-orange-300">
              Coba ubah kata kunci pencarian atau filter yang digunakan.
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {paginatedData.map((mahasiswa) => (
              <div
                key={mahasiswa.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors duration-200 ${
                  selectedMahasiswaIds.includes(mahasiswa.id)
                    ? "bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-700 cursor-pointer hover:bg-green-50 hover:border-green-400"
                    : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-green-50 hover:border-green-400"
                }`}
                onClick={() => handleSelectMahasiswa(mahasiswa.id)}
              >
                <div
                  className="relative flex items-center"
                  onClick={(e) => e.stopPropagation()}
                >
                      <input
                        type="checkbox"
                        checked={selectedMahasiswaIds.includes(mahasiswa.id)}
                        onChange={() => handleSelectMahasiswa(mahasiswa.id)}
                    className={`
                      w-5 h-5
                      appearance-none
                      rounded-md
                      border-2
                      ${
                        selectedMahasiswaIds.includes(mahasiswa.id)
                          ? "border-green-500 bg-green-500"
                          : "border-green-500 bg-transparent"
                      }
                      transition-colors
                      duration-150
                      focus:ring-2 focus:ring-green-300
                      dark:focus:ring-green-600
                      relative
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                    style={{ outline: "none" }}
                  />
                  {selectedMahasiswaIds.includes(mahasiswa.id) && (
                    <svg
                      className="absolute left-0 top-0 w-5 h-5 pointer-events-none"
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="white"
                      strokeWidth="2.5"
                    >
                      <polyline points="5 11 9 15 15 7" />
                    </svg>
                  )}
                          </div>
                <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                  <UserIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                        </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800 dark:text-white/90 text-sm">
                            {mahasiswa.name}
                  </p>
                  <div className="mt-1 mb-2 flex items-center gap-3">
                    <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
                      Semester {mahasiswa.semester || '?'}
                    </span>
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      {mahasiswa.nim}
                    </p>
                  </div>
                  {mahasiswa.is_veteran && mahasiswa.veteran_semesters && mahasiswa.veteran_semesters.length > 0 && (
                    <div className="mt-1 mb-2">
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Veteran di: {mahasiswa.veteran_semesters.join(", ")}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                      {mahasiswa.angkatan}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        mahasiswa.ipk >= 3.5
                          ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                          : mahasiswa.ipk >= 3.0
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                          : mahasiswa.ipk >= 2.5
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                          : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                      }`}
                    >
                      IPK {mahasiswa.ipk.toFixed(2)}
                    </span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${getStatusColor(mahasiswa.status)}`}>
                        {mahasiswa.status}
                      </span>
                     <span className={`text-xs px-2 py-0.5 rounded-full ${
                        mahasiswa.is_veteran 
                         ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                         : 'bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300'
                     }`}>
                       {mahasiswa.is_veteran ? 'Veteran' : 'Non-Veteran'}
                      </span>
                     {mahasiswa.is_veteran && mahasiswa.is_multi_veteran && (
                       <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-sm">
                         Multi Veteran
                       </span>
                     )}
                  </div>
                  <div className="mt-2 flex gap-1 flex-wrap">
                      <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleToggleVeteran(mahasiswa);
                      }}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all duration-200 ${
                          mahasiswa.is_veteran
                          ? 'bg-red-500 text-white hover:bg-red-600 hover:shadow-md'
                          : 'bg-green-500 text-white hover:bg-green-600 hover:shadow-md'
                        }`}
                      >
                        {mahasiswa.is_veteran ? (
                          <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Hapus
                          </>
                        ) : (
                          <>
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Set
                          </>
                        )}
                      </button>
                      
                      {/* Multi Veteran Button - hanya muncul jika mahasiswa sudah veteran */}
                      {mahasiswa.is_veteran && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleToggleMultiVeteran(mahasiswa);
                          }}
                          disabled={isTogglingMultiVeteran}
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg shadow-sm transition-all duration-200 ${
                            mahasiswa.is_multi_veteran
                              ? 'bg-purple-500 text-white hover:bg-purple-600 hover:shadow-md'
                              : 'bg-purple-300 text-purple-800 hover:bg-purple-400 hover:shadow-md'
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          {isTogglingMultiVeteran ? (
                            <>
                              <svg className="w-3 h-3 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                              </svg>
                              Loading...
                            </>
                          ) : mahasiswa.is_multi_veteran ? (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                              Multi
                            </>
                          ) : (
                            <>
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                              Multi
                            </>
                          )}
                        </button>
                      )}
                  </div>
                </div>
              </div>
                ))}
          </div>
          )}
        </div>

        {/* Pagination */}
        {filteredData.length > 0 && totalPages > 1 && (
        <div className="mt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="flex items-center gap-4">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none"
              >
              {[12, 24, 36, 48, 60, 72, 84, 96].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Menampilkan {((page - 1) * pageSize) + 1} - {Math.min(page * pageSize, filteredData.length)} dari {filteredData.length} mahasiswa
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Prev
              </button>
              
              {/* Smart Pagination */}
              <div className="flex items-center gap-1 max-w-[400px] overflow-x-auto pagination-scroll" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 #f1f5f9'
              }}>
                <style dangerouslySetInnerHTML={{
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
                  `
                }} />
                
                {/* Always show first page */}
                <button
                  onClick={() => setPage(1)}
                className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    page === 1
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  1
                </button>
                
                {/* Show ellipsis if current page is far from start */}
                {page > 4 && (
                  <span className="px-2 text-gray-500 dark:text-gray-400">...</span>
                )}
                
                {/* Show pages around current page */}
                {Array.from({ length: totalPages }, (_, i) => {
                  const pageNum = i + 1;
                  // Show pages around current page (2 pages before and after)
                  const shouldShow = pageNum > 1 && pageNum < totalPages && 
                    (pageNum >= page - 2 && pageNum <= page + 2);
                  
                  if (!shouldShow) return null;
                  
                  return (
                    <button
                      key={i}
                      onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                        page === pageNum
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                {/* Show ellipsis if current page is far from end */}
                {page < totalPages - 3 && (
                  <span className="px-2 text-gray-500 dark:text-gray-400">...</span>
                )}
                
                {/* Always show last page if it's not the first page */}
                {totalPages > 1 && (
                  <button
                    onClick={() => setPage(totalPages)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                      page === totalPages
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
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
        )}

      {/* Veteran Toggle Modal */}
      <AnimatePresence>
        {showVeteranModal && selectedMahasiswa && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowVeteranModal(false)}
            ></motion.div>
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowVeteranModal(false)}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="w-6 h-6">
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
                    {selectedMahasiswa.is_veteran ? 'Hapus Status Veteran' : 'Set sebagai Veteran'}
                  </h2>
            </div>

            <div className="mb-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      selectedMahasiswa.is_veteran 
                        ? 'bg-red-100 dark:bg-red-900/20' 
                        : 'bg-green-100 dark:bg-green-900/20'
                    }`}>
                      {selectedMahasiswa.is_veteran ? (
                        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {selectedMahasiswa.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">NIM: {selectedMahasiswa.nim}</p>
                    </div>
                  </div>
                  
                  <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Catatan (Opsional)
              </label>
              <textarea
                value={veteranNotes}
                onChange={(e) => setVeteranNotes(e.target.value)}
                placeholder="Masukkan catatan mengapa mahasiswa ditetapkan sebagai veteran..."
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-800 dark:text-white transition-colors resize-none"
                rows={3}
              />
                  </div>
            </div>

                <div className="flex justify-end gap-2 pt-2 relative z-20">
              <button
                onClick={() => setShowVeteranModal(false)}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
              >
                Batal
              </button>
              <button
                    type="button"
                onClick={confirmToggleVeteran}
                disabled={isToggling}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-white text-xs sm:text-sm font-medium transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed relative z-10 ${
                  selectedMahasiswa.is_veteran
                    ? 'bg-red-600 hover:bg-red-700'
                    : 'bg-green-600 hover:bg-green-700'
                }`}
              >
                {isToggling ? (
                  <>
                        <svg className="w-5 h-5 mr-2 animate-spin text-white inline-block align-middle" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Memproses...
                  </>
                ) : selectedMahasiswa.is_veteran ? (
                      'Hapus Veteran'
                    ) : (
                      'Set Veteran'
                )}
              </button>
                </div>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Action Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowBulkModal(false)}
            ></motion.div>
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowBulkModal(false)}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="w-6 h-6">
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
                    {bulkAction === 'set' ? 'Set sebagai Veteran' : 'Hapus Status Veteran'}
                  </h2>
            </div>

                <div className="mb-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                      bulkAction === 'set' 
                        ? 'bg-green-100 dark:bg-green-900/20' 
                        : 'bg-red-100 dark:bg-red-900/20'
                    }`}>
                      {bulkAction === 'set' ? (
                        <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      ) : (
                        <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        {selectedMahasiswaIds.length} Mahasiswa Dipilih
                      </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {bulkAction === 'set' 
                          ? 'Akan ditetapkan sebagai veteran'
                          : 'Akan dihapus status veteran'
                }
              </p>
                    </div>
            </div>

                  <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Catatan (Opsional)
              </label>
              <textarea
                value={veteranNotes}
                onChange={(e) => setVeteranNotes(e.target.value)}
                placeholder={`Masukkan catatan mengapa ${selectedMahasiswaIds.length} mahasiswa ${bulkAction === 'set' ? 'ditetapkan sebagai veteran' : 'dihapus status veteran'}...`}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-800 dark:text-white transition-colors resize-none"
                rows={3}
              />
                  </div>
            </div>

                <div className="flex justify-end gap-2 pt-2 relative z-20">
              <button
                onClick={() => setShowBulkModal(false)}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
              >
                Batal
              </button>
              <button
                    type="button"
                onClick={confirmBulkAction}
                disabled={isBulkProcessing}
                    className={`px-3 sm:px-4 py-2 rounded-lg text-white text-xs sm:text-sm font-medium transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed relative z-10 ${
                  bulkAction === 'set'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                }`}
              >
                {isBulkProcessing ? (
                  <>
                        <svg className="w-5 h-5 mr-2 animate-spin text-white inline-block align-middle" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Memproses...
                  </>
                ) : bulkAction === 'set' ? (
                      'Set Veteran'
                    ) : (
                      'Hapus Veteran'
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
};

export default MahasiswaVeteran;
