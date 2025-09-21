import React, { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
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
  const [pageSize, setPageSize] = useState(10);
  
  // Modal states
  const [showVeteranModal, setShowVeteranModal] = useState(false);
  const [selectedMahasiswa, setSelectedMahasiswa] = useState<Mahasiswa | null>(null);
  const [veteranNotes, setVeteranNotes] = useState("");
  const [isToggling, setIsToggling] = useState(false);
  
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
      } catch (err) {
        console.error("Error fetching mahasiswa veteran:", err);
        setError("Gagal memuat data mahasiswa");
      } finally {
        setLoading(false);
      }
    };

    fetchMahasiswaVeteran();
  }, [filterVeteran, filterAngkatan, search]);

  const formatIPK = (ipk: number) => {
    return ipk.toFixed(2);
  };

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
      <div className="space-y-6">
        <PageBreadcrumb pageTitle="Mahasiswa Veteran" />
        
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-6">
            <div className="animate-pulse">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4"></div>
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="h-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <PageBreadcrumb pageTitle="Mahasiswa Veteran" />
        
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-6">
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Error
              </h3>
              <p className="text-gray-600 dark:text-gray-400">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Mahasiswa Veteran" />
      
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="p-6 border-b border-gray-100 dark:border-white/[0.05]">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
                Data Mahasiswa Veteran
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Daftar mahasiswa dengan informasi NIM, angkatan, dan IPK
              </p>
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <UserIcon className="w-4 h-4" />
              <span>{filteredData.length} dari {mahasiswaList.length} Mahasiswa</span>
            </div>
          </div>
        </div>

        {/* Filter dan Search */}
        <div className="p-6 border-b border-gray-100 dark:border-white/[0.05]">
          <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
            <div className="w-full lg:w-72">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="fill-gray-500 dark:fill-gray-400" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path fillRule="evenodd" clipRule="evenodd" d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z" fill="" />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Cari berdasarkan nama, NIM, angkatan..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <select
                value={filterVeteran}
                onChange={(e) => { setFilterVeteran(e.target.value); setPage(1); }}
                className="w-full sm:w-48 h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">Semua Status</option>
                <option value="veteran">Veteran</option>
                <option value="non-veteran">Non-Veteran</option>
              </select>
              <select
                value={filterAngkatan}
                onChange={(e) => { setFilterAngkatan(e.target.value); setPage(1); }}
                className="w-full sm:w-48 h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="all">Semua Angkatan</option>
                {angkatanOptions.map((angkatan) => (
                  <option key={angkatan} value={angkatan}>
                    Angkatan {angkatan}
                  </option>
                ))}
              </select>
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="w-full sm:w-auto h-11 px-4 py-2 text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                >
                  Reset Filter
                </button>
              )}
            </div>
          </div>
          
          {/* Bulk Actions */}
          {selectedMahasiswaIds.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-blue-800 dark:text-blue-200">
                    {selectedMahasiswaIds.length} mahasiswa dipilih
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleBulkAction('set')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-green-500 rounded-lg hover:bg-green-600 transition-all duration-200"
                    style={{
                      boxShadow: '0 4px 14px 0 rgba(34, 197, 94, 0.3)',
                      transform: 'translateY(0)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(34, 197, 94, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(34, 197, 94, 0.3)';
                    }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Set Veteran
                  </button>
                  <button
                    onClick={() => handleBulkAction('remove')}
                    className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-red-500 rounded-lg hover:bg-red-600 transition-all duration-200"
                    style={{
                      boxShadow: '0 4px 14px 0 rgba(239, 68, 68, 0.3)',
                      transform: 'translateY(0)',
                      transition: 'all 0.2s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px 0 rgba(239, 68, 68, 0.4)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = '0 4px 14px 0 rgba(239, 68, 68, 0.3)';
                    }}
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
        </div>

        <div className="overflow-x-auto">
          {mahasiswaList.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <UserIcon className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Belum Ada Data Mahasiswa
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Data mahasiswa akan muncul di sini setelah ditambahkan.
              </p>
            </div>
          ) : filteredData.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-gray-400 mb-4">
                <UserIcon className="w-16 h-16 mx-auto" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Tidak Ada Data yang Cocok
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Coba ubah kata kunci pencarian atau filter yang digunakan.
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-800/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={
                          selectAllMode === 'page' 
                            ? selectedMahasiswaIds.length === paginatedData.length && paginatedData.length > 0
                            : selectedMahasiswaIds.length === mahasiswaList.length && mahasiswaList.length > 0
                        }
                        onChange={handleSelectAll}
                        className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
                      />
                      <button
                        onClick={handleSelectAllModeToggle}
                        className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
                        title={selectAllMode === 'page' ? 'Klik untuk pilih semua data' : 'Klik untuk pilih halaman ini saja'}
                      >
                        {selectAllMode === 'page' ? 'Halaman' : 'Semua'}
                      </button>
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    No
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Nama
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    NIM
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Angkatan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    IPK
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Semester
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Veteran
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-white/[0.02] divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedData.map((mahasiswa, index) => (
                  <tr key={mahasiswa.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedMahasiswaIds.includes(mahasiswa.id)}
                        onChange={() => handleSelectMahasiswa(mahasiswa.id)}
                        className="h-4 w-4 text-brand-600 focus:ring-brand-500 border-gray-300 rounded"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {(page - 1) * pageSize + index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <div className="h-8 w-8 rounded-full bg-brand-500 flex items-center justify-center">
                            <UserIcon className="h-4 w-4 text-white" />
                          </div>
                        </div>
                        <div className="ml-3">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                            {mahasiswa.name}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">
                            {mahasiswa.gender === 'L' ? 'Laki-laki' : 'Perempuan'}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-mono">
                      {mahasiswa.nim}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {mahasiswa.angkatan}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-mono">
                      {formatIPK(mahasiswa.ipk)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(mahasiswa.status)}`}>
                        {mahasiswa.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {mahasiswa.semester || '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-full transition-all duration-200 ${
                        mahasiswa.is_veteran 
                          ? 'bg-blue-500 text-white'
                          : 'bg-gray-400 text-white'
                      }`}
                      style={{
                        boxShadow: mahasiswa.is_veteran 
                          ? '0 2px 8px 0 rgba(59, 130, 246, 0.25)' 
                          : '0 2px 8px 0 rgba(156, 163, 175, 0.25)'
                      }}>
                        {mahasiswa.is_veteran ? (
                          <>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                            VETERAN
                          </>
                        ) : (
                          <>
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                            </svg>
                            NON-VETERAN
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <button
                        onClick={() => handleToggleVeteran(mahasiswa)}
                        className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-all duration-200 ${
                          mahasiswa.is_veteran
                            ? 'bg-red-500 text-white hover:bg-red-600'
                            : 'bg-green-500 text-white hover:bg-green-600'
                        }`}
                        style={{
                          boxShadow: mahasiswa.is_veteran 
                            ? '0 4px 14px 0 rgba(239, 68, 68, 0.3)' 
                            : '0 4px 14px 0 rgba(34, 197, 94, 0.3)',
                          transform: 'translateY(0)',
                          transition: 'all 0.2s ease'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = mahasiswa.is_veteran 
                            ? '0 6px 20px 0 rgba(239, 68, 68, 0.4)' 
                            : '0 6px 20px 0 rgba(34, 197, 94, 0.4)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.transform = 'translateY(0)';
                          e.currentTarget.style.boxShadow = mahasiswa.is_veteran 
                            ? '0 4px 14px 0 rgba(239, 68, 68, 0.3)' 
                            : '0 4px 14px 0 rgba(34, 197, 94, 0.3)';
                        }}
                        onMouseDown={(e) => {
                          e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
                        }}
                        onMouseUp={(e) => {
                          e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
                        }}
                      >
                        {mahasiswa.is_veteran ? (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                            Hapus Veteran
                          </>
                        ) : (
                          <>
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Set Veteran
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {filteredData.length > 0 && totalPages > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4 border-t border-gray-100 dark:border-white/[0.05]">
            <div className="flex items-center gap-4">
              <select
                value={pageSize}
                onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none"
              >
                {[5, 10, 20, 50].map(opt => (
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
      </div>

      {/* Veteran Toggle Modal */}
      <AnimatePresence>
        {showVeteranModal && selectedMahasiswa && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowVeteranModal(false)}
            ></motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl p-6 shadow-lg z-[100001]"
            >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {selectedMahasiswa.is_veteran ? 'Hapus Status Veteran' : 'Set sebagai Veteran'}
              </h3>
              <button
                onClick={() => setShowVeteranModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Mahasiswa: <span className="font-medium text-gray-900 dark:text-white">{selectedMahasiswa.name}</span>
              </p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                NIM: <span className="font-mono text-gray-900 dark:text-white">{selectedMahasiswa.nim}</span>
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Catatan (Opsional)
              </label>
              <textarea
                value={veteranNotes}
                onChange={(e) => setVeteranNotes(e.target.value)}
                placeholder="Masukkan catatan mengapa mahasiswa ditetapkan sebagai veteran..."
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowVeteranModal(false)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                style={{ 
                  boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(0)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px 0 rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px 0 rgba(0, 0, 0, 0.1)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Batal
              </button>
              <button
                onClick={confirmToggleVeteran}
                disabled={isToggling}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-lg transition-all duration-200 disabled:opacity-50 ${
                  selectedMahasiswa.is_veteran
                    ? 'bg-red-500 hover:bg-red-600'
                    : 'bg-green-500 hover:bg-green-600'
                }`}
                style={{
                  boxShadow: selectedMahasiswa.is_veteran 
                    ? '0 4px 14px 0 rgba(239, 68, 68, 0.3)' 
                    : '0 4px 14px 0 rgba(34, 197, 94, 0.3)',
                  transform: 'translateY(0)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isToggling) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = selectedMahasiswa.is_veteran 
                      ? '0 6px 20px 0 rgba(239, 68, 68, 0.4)' 
                      : '0 6px 20px 0 rgba(34, 197, 94, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isToggling) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = selectedMahasiswa.is_veteran 
                      ? '0 4px 14px 0 rgba(239, 68, 68, 0.3)' 
                      : '0 4px 14px 0 rgba(34, 197, 94, 0.3)';
                  }
                }}
                onMouseDown={(e) => {
                  if (!isToggling) {
                    e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
                  }
                }}
                onMouseUp={(e) => {
                  if (!isToggling) {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
                  }
                }}
              >
                {isToggling ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Memproses...
                  </>
                ) : selectedMahasiswa.is_veteran ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Hapus Veteran
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Set Veteran
                  </>
                )}
              </button>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Bulk Action Modal */}
      <AnimatePresence>
        {showBulkModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowBulkModal(false)}
            ></motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative bg-white dark:bg-gray-800 rounded-3xl shadow-xl max-w-md w-full mx-4 p-6 z-[100001]"
            >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {bulkAction === 'set' ? 'Set sebagai Veteran' : 'Hapus Status Veteran'}
              </h3>
              <button
                onClick={() => setShowBulkModal(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mb-4">
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {bulkAction === 'set' 
                  ? `Apakah Anda yakin ingin menetapkan ${selectedMahasiswaIds.length} mahasiswa sebagai veteran?`
                  : `Apakah Anda yakin ingin menghapus status veteran dari ${selectedMahasiswaIds.length} mahasiswa?`
                }
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Catatan (Opsional)
              </label>
              <textarea
                value={veteranNotes}
                onChange={(e) => setVeteranNotes(e.target.value)}
                placeholder={`Masukkan catatan mengapa ${selectedMahasiswaIds.length} mahasiswa ${bulkAction === 'set' ? 'ditetapkan sebagai veteran' : 'dihapus status veteran'}...`}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                rows={3}
              />
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowBulkModal(false)}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-200"
                style={{ 
                  boxShadow: '0 2px 8px 0 rgba(0, 0, 0, 0.1)',
                  transform: 'translateY(0)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 4px 12px 0 rgba(0, 0, 0, 0.15)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0)';
                  e.currentTarget.style.boxShadow = '0 2px 8px 0 rgba(0, 0, 0, 0.1)';
                }}
                onMouseDown={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
                }}
                onMouseUp={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
                }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Batal
              </button>
              <button
                onClick={confirmBulkAction}
                disabled={isBulkProcessing}
                className={`flex-1 inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white rounded-lg transition-all duration-200 disabled:opacity-50 ${
                  bulkAction === 'set'
                    ? 'bg-green-500 hover:bg-green-600'
                    : 'bg-red-500 hover:bg-red-600'
                }`}
                style={{
                  boxShadow: bulkAction === 'set' 
                    ? '0 4px 14px 0 rgba(34, 197, 94, 0.3)' 
                    : '0 4px 14px 0 rgba(239, 68, 68, 0.3)',
                  transform: 'translateY(0)',
                  transition: 'all 0.2s ease'
                }}
                onMouseEnter={(e) => {
                  if (!isBulkProcessing) {
                    e.currentTarget.style.transform = 'translateY(-2px)';
                    e.currentTarget.style.boxShadow = bulkAction === 'set' 
                      ? '0 6px 20px 0 rgba(34, 197, 94, 0.4)' 
                      : '0 6px 20px 0 rgba(239, 68, 68, 0.4)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isBulkProcessing) {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = bulkAction === 'set' 
                      ? '0 4px 14px 0 rgba(34, 197, 94, 0.3)' 
                      : '0 4px 14px 0 rgba(239, 68, 68, 0.3)';
                  }
                }}
                onMouseDown={(e) => {
                  if (!isBulkProcessing) {
                    e.currentTarget.style.transform = 'translateY(0) scale(0.98)';
                  }
                }}
                onMouseUp={(e) => {
                  if (!isBulkProcessing) {
                    e.currentTarget.style.transform = 'translateY(-2px) scale(1)';
                  }
                }}
              >
                {isBulkProcessing ? (
                  <>
                    <svg className="w-4 h-4 animate-spin" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Memproses...
                  </>
                ) : bulkAction === 'set' ? (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Set Veteran
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                    </svg>
                    Hapus Veteran
                  </>
                )}
              </button>
            </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MahasiswaVeteran;
