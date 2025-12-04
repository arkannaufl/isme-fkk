import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ChevronLeftIcon, UserIcon } from "../icons";
import { motion, AnimatePresence } from "framer-motion";
import { kelompokBesarApi, mahasiswaApi, mahasiswaVeteranApi, Mahasiswa } from "../api/generateApi";
import type { KelompokBesar } from "../api/generateApi";
import { handleApiError } from "../utils/api";

function mapSemesterToNumber(semester: string | number): number {
  if (typeof semester === 'number') return semester;
  if (!isNaN(Number(semester))) return Number(semester);
  if (typeof semester === 'string') {
    if (semester.toLowerCase() === 'ganjil') return 1;
    if (semester.toLowerCase() === 'genap') return 2;
  }
  return 0;
}

const KelompokBesar: React.FC = () => {
  const navigate = useNavigate();
  const { semester } = useParams<{ semester: string }>();
  const [selectedMahasiswa, setSelectedMahasiswa] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterAngkatan, setFilterAngkatan] = useState<string>("semua");
  const [filterIPK, setFilterIPK] = useState<string>("semua");
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [unselectingId, setUnselectingId] = useState<string | null>(null);
  const [pendingSelectedId, setPendingSelectedId] = useState<string | null>(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  
  // New state for API data
  const [mahasiswaList, setMahasiswaList] = useState<Mahasiswa[]>([]);
  const [kelompokBesarData, setKelompokBesarData] = useState<KelompokBesar[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isResetting, setIsResetting] = useState(false);

  // State untuk Mahasiswa Veteran
  const [veteranStudents, setVeteranStudents] = useState<Mahasiswa[]>([]);
  const [veteranSemester, setVeteranSemester] = useState<string>("");
  const [showVeteranSection, setShowVeteranSection] = useState(false);
  const [selectedVeterans, setSelectedVeterans] = useState<string[]>([]);

  // Load data from API
  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch data mahasiswa dan kelompok besar secara paralel
      if (semester) {
        const [mahasiswaResponse, kelompokResponse] = await Promise.all([
          mahasiswaApi.getAll(), // Ambil semua mahasiswa, bukan hanya semester tertentu
          kelompokBesarApi.batchBySemester({ semesters: [String(mapSemesterToNumber(semester))] })
        ]);
        // Handle pagination response
        const mahasiswaData = Array.isArray(mahasiswaResponse.data) 
          ? mahasiswaResponse.data 
          : (Array.isArray((mahasiswaResponse.data as any)?.data) ? (mahasiswaResponse.data as any).data : []);
        setMahasiswaList(mahasiswaData);
        setKelompokBesarData(kelompokResponse.data[String(mapSemesterToNumber(semester))]);
        
        // Pisahkan mahasiswa biasa dan veteran dari data yang dimuat
        const kelompokData = kelompokResponse.data[String(mapSemesterToNumber(semester))] || [];
        const selectedIds = kelompokData
          .filter((kb: any) => {
            const mahasiswa = mahasiswaData.find((m: any) => m.id === kb.mahasiswa_id);
            return mahasiswa && !mahasiswa.is_veteran; // Hanya mahasiswa non-veteran
          })
          .map((kb: any) => kb.mahasiswa_id.toString());
        
        const veteranIds = kelompokData
          .filter((kb: any) => {
            const mahasiswa = mahasiswaData.find((m: any) => m.id === kb.mahasiswa_id);
            return mahasiswa && mahasiswa.is_veteran; // Hanya mahasiswa veteran
          })
          .map((kb: any) => kb.mahasiswa_id.toString());
        
        setSelectedMahasiswa(selectedIds);
        setSelectedVeterans(veteranIds);
        setHasSaved(kelompokData.length > 0);
        
      }
    } catch (err: any) {
      console.error("Error loading data:", err);
      console.error("Error details:", handleApiError(err, "Memuat data kelompok besar"));
      setError(handleApiError(err, "Memuat data kelompok besar"));
    } finally {
      setLoading(false);
    }
  };

  // Fungsi untuk mengambil semua data veteran (tidak terbatas semester)
  const loadVeteranStudents = async (semester: string) => {
    try {
      const response = await mahasiswaVeteranApi.getAll({
        veteran_only: true,
        angkatan: undefined,
        search: undefined
      });
      
      const allVeterans = response.data;
      
      // TAMPILKAN SEMUA VETERAN (tidak filter berdasarkan semester)
      // Veteran yang sudah dipilih di semester lain akan ditampilkan dengan deskripsi
      const availableVeterans = allVeterans;
      
      // Convert ke format Mahasiswa
      const veteranFormatted = availableVeterans.map((veteran: any) => {
        // Check if veteran is already selected in kelompok besar for this semester
        const isAlreadySelected = kelompokBesarData.some(kb => kb.mahasiswa_id === veteran.id);
        
        
        return {
          id: veteran.id.toString(),
          name: veteran.name,
          nim: veteran.nim,
          angkatan: veteran.angkatan,
          ipk: veteran.ipk,
          gender: veteran.gender,
          status: veteran.status || 'active',
          role: veteran.role || 'mahasiswa',
          semester: veteran.semester, // Simpan semester asli untuk referensi
          veteran_semesters: veteran.veteran_semesters || [], // Store veteran semesters array
          veteran_history: veteran.veteran_history || [], // Store veteran history
          is_veteran: true,
          is_multi_veteran: veteran.is_multi_veteran || false, // Store multi-veteran status
          is_locked: !veteran.is_multi_veteran && veteran.veteran_semesters && veteran.veteran_semesters.length > 0 && !veteran.veteran_semesters.includes(semester), // Lock veteran biasa jika sudah terdaftar di semester lain
          is_available: veteran.is_multi_veteran || (veteran.veteran_semesters.length === 0 || veteran.veteran_semesters.includes(semester)) && !isAlreadySelected // Multi-veteran selalu available, veteran biasa hanya jika belum terdaftar atau di semester yang sama
        };
      });
      
      setVeteranStudents(veteranFormatted);
      setVeteranSemester(semester);
      setShowVeteranSection(veteranFormatted.length > 0);
    } catch (error) {
      console.error('Error loading veteran students:', error);
      setVeteranStudents([]);
      setShowVeteranSection(false);
    }
  };

  useEffect(() => {
    const loadAllData = async () => {
      await loadData();
      if (semester) {
        await loadVeteranStudents(semester);
      }
    };
    loadAllData();
  }, [semester]);

  // Removed auto-refresh on tab/app switch to prevent unwanted data reloading

  // Filter mahasiswa berdasarkan semester yang dipilih
  const semesterNumber = semester ? Number(semester) : null;
  const mahasiswaBySemester = semesterNumber
    ? mahasiswaList.filter(m => {
        // Untuk mahasiswa biasa: hanya yang semester sama
        if (!m.is_veteran) {
          return m.semester === semesterNumber;
        }
        // Untuk veteran: jangan tampilkan di mahasiswa tersedia (veteran ada di section terpisah)
        if (m.is_veteran) {
          return false;
        }
        return false;
      })
    : mahasiswaList;

  // Dapatkan daftar angkatan unik
  const angkatanList = [...new Set(mahasiswaBySemester.map(m => m.angkatan))].sort((a, b) => parseInt(b) - parseInt(a));

  // Filter mahasiswa berdasarkan angkatan, IPK, search, dan exclude yang sudah dipilih
  const filteredMahasiswa = mahasiswaBySemester.filter(m => {
    // Exclude veteran (veteran ada di section terpisah)
    if (m.is_veteran) return false;
    // Exclude yang sudah dipilih
    if (selectedMahasiswa.includes(m.id.toString())) return false;
    // Filter angkatan
    if (filterAngkatan !== "semua" && m.angkatan !== filterAngkatan) {
      return false;
    }
    // Filter IPK
    if (filterIPK !== "semua") {
      const ipkValue = parseFloat(filterIPK);
      if (m.ipk < ipkValue) {
        return false;
      }
    }
    // Filter search
    if (searchQuery.trim() !== "") {
      const q = searchQuery.trim().toLowerCase();
      if (!m.name.toLowerCase().includes(q) && !m.nim.toLowerCase().includes(q)) {
        return false;
      }
    }
    return true;
  });

  // Filter selectedMahasiswa agar hanya mahasiswa semester ini yang bisa dipilih/ditampilkan
  // Exclude veteran dari selectedMahasiswaFiltered (veteran ada di section terpisah)
  const selectedMahasiswaFiltered = selectedMahasiswa.filter(id => {
    const m = mahasiswaBySemester.find(m => m.id.toString() === id);
    return !!m && !m.is_veteran;
  });

  const handleSelectAll = () => {
    // Hanya pilih mahasiswa yang tidak terkunci
    const allIds = filteredMahasiswa.map(m => m.id.toString());
    const allSelected = allIds.every(id => selectedMahasiswa.includes(id)) && allIds.length > 0;
    if (allSelected) {
      setSelectedMahasiswa(selectedMahasiswa.filter(id => !allIds.includes(id)));
    } else {
      setSelectedMahasiswa(Array.from(new Set([...selectedMahasiswa, ...allIds])));
    }
  };

  // Pilih satu
  const handleSelect = (id: string) => {
    setSelectedMahasiswa(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  // Uncheck semua
  const handleUncheckAll = () => {
    const allIds = filteredMahasiswa.map(m => m.id.toString());
    setSelectedMahasiswa(selectedMahasiswa.filter(id => !allIds.includes(id)));
  };

  // Fungsi untuk handle selection veteran
  const handleSelectVeteran = (veteranId: string) => {
    setSelectedVeterans((prev) => {
      const newSelection = prev.includes(veteranId) 
        ? prev.filter((id) => id !== veteranId)
        : [...prev, veteranId];
      
      
      return newSelection;
    });
  };

  // Fungsi untuk select all veterans
  const handleSelectAllVeterans = () => {
    // Hanya ambil veteran yang available dan belum dipilih
    const availableVeteranIds = veteranStudents.filter(v => v.is_available && !selectedVeterans.includes(v.id.toString())).map(v => v.id.toString());
    const allSelected = availableVeteranIds.every((id) => selectedVeterans.includes(id)) && availableVeteranIds.length > 0;
    
    if (allSelected) {
      setSelectedVeterans(prev => prev.filter(id => !availableVeteranIds.includes(id)));
    } else {
      setSelectedVeterans(prev => Array.from(new Set([...prev, ...availableVeteranIds])));
    }
  };

  // Simpan ke API
  const handleSave = async () => {
    setIsSaving(true);
    setErrorMsg("");
    try {
      if (semester) {
        // Siapkan data mahasiswa untuk pengelompokan
        let mahasiswaIds = selectedMahasiswa.map(id => parseInt(id));
        
        // Hanya gunakan veteran yang benar-benar dipilih saat ini
        const allVeteranIds = selectedVeterans;
        
        console.log('Debug: Veteran yang akan diproses:', {
          selectedVeterans,
          allVeteranIds,
          kelompokBesarData,
          showVeteranSection
        });
        
        // Ambil veteran yang sudah ada di kelompok besar sebelumnya
        const existingVeteranIds = kelompokBesarData
          .filter((kb: any) => {
            const mahasiswa = mahasiswaList.find((m: any) => m.id === kb.mahasiswa_id);
            return mahasiswa && mahasiswa.is_veteran;
          })
          .map((kb: any) => kb.mahasiswa_id.toString());

        // Tentukan veteran yang dihapus (ada di existing tapi tidak di selected)
        const removedVeteranIds = existingVeteranIds.filter(id => !selectedVeterans.includes(id));

        // HAPUS VETERAN SEMESTER untuk veteran yang dihapus dari selection
        if (removedVeteranIds.length > 0) {
          console.log('Debug: Veteran yang akan dihapus:', removedVeteranIds);
          for (const veteranId of removedVeteranIds) {
            try {
              const veteran = veteranStudents.find(v => v.id.toString() === veteranId.toString());
              const isMultiVeteran = veteran?.is_multi_veteran;
              
              if (!isMultiVeteran) {
                // Hapus veteran_semester untuk veteran biasa
                await mahasiswaVeteranApi.toggleVeteran({
                  user_id: parseInt(veteranId),
                  is_veteran: true,
                  veteran_semester: null
                });
                console.log(`Successfully removed veteran ${veteranId} from semester ${semester}`);
              } else {
                // Untuk multi-veteran, hapus dari veteran_semesters
                await mahasiswaVeteranApi.removeFromSemester({
                  user_id: parseInt(veteranId),
                  semester: semester
                });
                console.log(`Successfully removed multi-veteran ${veteranId} from semester ${semester}`);
              }
            } catch (error) {
              console.error(`Error removing veteran ${veteranId} from semester:`, error);
            }
          }
        }

        // Jika ada veteran yang dipilih, tambahkan ke pengelompokan
        if (showVeteranSection && allVeteranIds.length > 0) {
          const veteranIds = allVeteranIds.map(v => parseInt(v));
          
          // UPDATE VETERAN SEMESTER untuk veteran yang dipilih (kecuali multi-veteran)
          try {
            for (const veteranId of veteranIds) {
              try {
                // Cek apakah veteran ini adalah multi-veteran
                const veteran = veteranStudents.find(v => v.id.toString() === veteranId.toString());
                const isMultiVeteran = veteran?.is_multi_veteran;
                
                if (!isMultiVeteran) {
                  // Hanya update veteran_semester untuk veteran biasa
                  await mahasiswaVeteranApi.toggleVeteran({
                    user_id: veteranId,
                    is_veteran: true,
                    veteran_semester: semester
                  });
                } else {
                  // Untuk multi-veteran, tambahkan ke veteran_semesters
                  await mahasiswaVeteranApi.addToSemester({
                    user_id: veteranId,
                    semester: semester
                  });
                }
              } catch (singleError) {
                console.error(`Error updating veteran ${veteranId} semester:`, singleError);
                // Lanjutkan meskipun ada error
              }
            }
          } catch (error) {
            console.error('Error updating veteran semester:', error);
          }

          // TAMBAHKAN VETERAN KE MAHASISWA IDS
          mahasiswaIds = [...mahasiswaIds, ...veteranIds];
        }

        const apiData = {
          semester: String(mapSemesterToNumber(semester)),
          mahasiswa_ids: mahasiswaIds,
          is_veteran_addition: false // Selalu false untuk replace semua data, bukan append
        };
        
        console.log('Debug: Data yang dikirim ke API:', apiData);
        
        await kelompokBesarApi.create(apiData);
        
        setShowSaveNotification(true);
        setTimeout(() => setShowSaveNotification(false), 3000);
        setSuccess("Data kelompok besar berhasil disimpan.");
        setHasSaved(true);
        setHasUnsavedChanges(false);
        
        // Reload data to get updated state
        const kelompokResponse = await kelompokBesarApi.batchBySemester({ semesters: [String(mapSemesterToNumber(semester))] });
        const updatedKelompokData = kelompokResponse.data[String(mapSemesterToNumber(semester))];
        setKelompokBesarData(updatedKelompokData);
        
        // Update selected students based on reloaded data
        const updatedSelectedIds = (updatedKelompokData || [])
          .filter((kb: any) => {
            const mahasiswa = mahasiswaList.find((m: any) => m.id === kb.mahasiswa_id);
            return mahasiswa && !mahasiswa.is_veteran; // Hanya mahasiswa non-veteran
          })
          .map((kb: any) => kb.mahasiswa_id.toString());
        
        const updatedVeteranIds = (updatedKelompokData || [])
          .filter((kb: any) => {
            const mahasiswa = mahasiswaList.find((m: any) => m.id === kb.mahasiswa_id);
            return mahasiswa && mahasiswa.is_veteran; // Hanya mahasiswa veteran
          })
          .map((kb: any) => kb.mahasiswa_id.toString());
        
        setSelectedMahasiswa(updatedSelectedIds);
        setSelectedVeterans(updatedVeteranIds);
        
        
        // Reload veteran data
        if (semester) {
          await loadVeteranStudents(semester);
        }
        
        // Force update hasUnsavedChanges after all operations complete
        setTimeout(() => {
          setHasUnsavedChanges(false);
          // Also ensure isSaving is false
          setIsSaving(false);
        }, 100);
      }
    } catch (error: any) {
      console.error("Error saving data:", error);
      console.error("Error details:", handleApiError(error, "Menyimpan data kelompok besar"));
      setErrorMsg(handleApiError(error, "Menyimpan data kelompok besar"));
    } finally {
      setIsSaving(false);
    }
  };

  // Reset pilihan
  const handleReset = () => {
    setShowResetModal(true);
  };

  // Fungsi konfirmasi reset
  const handleConfirmReset = async () => {
    setShowResetModal(false);
    setErrorMsg("");
    setIsResetting(true);
    try {
      // Delete all kelompok besar for this semester
      for (const kb of kelompokBesarData) {
        await kelompokBesarApi.delete(kb.id);
      }
      
      // Reset SEMUA veteran dari KelompokBesar (tidak peduli di semester mana mereka terdaftar)
      // KOSONGKAN veteran_semesters untuk veteran biasa (bukan multi-veteran)
      const allVeterans = veteranStudents.filter(v => v.is_veteran);
      
      if (allVeterans.length > 0) {
        console.log('Debug: Clearing veteran_semesters for all veterans:', allVeterans.map(v => ({ id: v.id, name: v.name, veteran_semesters: v.veteran_semesters })));
        
        for (const veteran of allVeterans) {
          try {
            // KOSONGKAN veteran_semesters untuk veteran biasa (bukan multi-veteran)
            if (!veteran.is_multi_veteran) {
              await mahasiswaVeteranApi.toggleVeteran({
                user_id: veteran.id,
                is_veteran: true,
                veteran_semester: null // Kosongkan veteran_semesters
              });
              console.log(`Successfully cleared veteran_semesters for ${veteran.id} (${veteran.name})`);
            }
          } catch (veteranError) {
            console.error(`Error clearing veteran_semesters for ${veteran.id}:`, veteranError);
            // Lanjutkan meskipun ada error
          }
        }
      }
      
      setSelectedMahasiswa([]);
      setSelectedVeterans([]); // Reset veteran selection juga
      setKelompokBesarData([]);
      setHasSaved(false);
      setHasUnsavedChanges(false);
      setSuccess("Data kelompok besar berhasil direset.");
      
      // Reload veteran data
      if (semester) {
        await loadVeteranStudents(semester);
      }
    } catch (error: any) {
      console.error("Error resetting data:", error);
      console.error("Error details:", handleApiError(error, "Mereset data kelompok besar"));
      setErrorMsg(handleApiError(error, "Mereset data kelompok besar"));
    } finally {
      setIsResetting(false);
    }
  };

  // Deteksi perubahan pilihan mahasiswa
  useEffect(() => {
    // Skip if still loading
    if (loading) return;
    
    const savedIds = kelompokBesarData.map(kb => kb.mahasiswa_id.toString());
    const currentSelected = [...selectedMahasiswa, ...selectedVeterans];
    
    // Remove duplicates and sort both arrays for comparison
    const uniqueSavedIds = [...new Set(savedIds)].sort();
    const uniqueCurrentSelected = [...new Set(currentSelected)].sort();
    
    const hasChanges = JSON.stringify(uniqueSavedIds) !== JSON.stringify(uniqueCurrentSelected);
    
    
    // Only update hasUnsavedChanges if we're not currently saving
    if (!isSaving) {
      setHasUnsavedChanges(hasChanges);
    }
  }, [selectedMahasiswa, selectedVeterans, kelompokBesarData, isSaving, loading]);

  const handleBack = () => {
    if (hasUnsavedChanges) {
      setShowLeaveModal(true);
    } else {
      navigate(-1);
    }
  };

  const allIds = filteredMahasiswa.map(m => m.id.toString());
  const allSelected = allIds.every(id => selectedMahasiswa.includes(id)) && allIds.length > 0;

  // Hilangkan errorMsg setelah 5 detik
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg("") , 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Auto-hide success notification setelah 5 detik
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  if (loading) {
    return (
      <div className="w-full mt-5">
        {/* Skeleton Header */}
        <div className="mb-6">
          <div className="h-8 w-80 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
          <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded mb-6 animate-pulse"></div>
        </div>
        {/* Skeleton Filter Bar */}
        <div className="mb-6 w-full bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-theme-xs">
          <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4 md:mb-0 animate-pulse"></div>
          <div className="flex gap-2 w-full md:w-auto">
            <div className="h-11 w-64 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            <div className="h-11 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            <div className="h-11 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            <div className="h-11 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
          </div>
        </div>
        {/* Skeleton List Mahasiswa */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 animate-pulse">
              <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              <div className="flex-1">
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="flex items-center gap-2">
                  <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="h-4 w-10 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                </div>
              </div>
              <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full mt-5">
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
            <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Terjadi Kesalahan</h3>
          <p className="text-gray-500 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mt-5">
      {/* Notifikasi Error */}
      {errorMsg && (
        <div className="mb-3 p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-white text-xs">!</span>
            </div>
            <span className="text-xs font-medium text-red-700 dark:text-red-300">
              {errorMsg}
            </span>
          </div>
        </div>
      )}

      {/* Success Messages */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
          >
            {success}
          </motion.div>
        )}
      </AnimatePresence>
      <button
        onClick={handleBack}
        className="flex items-center gap-2 text-brand-500 hover:text-brand-600 transition-all duration-300 ease-out hover:scale-105 transform mb-4"
      >
        <ChevronLeftIcon className="w-5 h-5" />
        <span>Kembali</span>
      </button>
      <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-4">
        Kelompok Besar Semester {semester}
      </h1>
      {hasUnsavedChanges && (
        <div className="my-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg flex items-center gap-2">
          <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
            <span className="text-white text-xs">⚠️</span>
          </div>
          <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
            Ada perubahan yang belum disimpan. Klik Simpan untuk update.
          </span>
        </div>
      )}
      {/* Section Mahasiswa Terpilih */}
      {(selectedMahasiswaFiltered.length > 0 || selectedVeterans.length > 0) && (
        <div className="mb-6 relative">
          <div className="flex flex-col sm:flex-row items-start justify-between mb-2">
            <h2 className="text-lg font-semibold text-brand-700 dark:text-brand-300 flex items-center gap-2 mb-5">
              Mahasiswa Terpilih
              <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-brand-600 text-white">{selectedMahasiswaFiltered.length + selectedVeterans.length}</span>
              {selectedVeterans.length > 0 && (
                <span className="inline-block px-2 py-0.5 text-xs rounded-full bg-purple-600 text-white">
                  +{selectedVeterans.length} Veteran
                </span>
              )}
            </h2>
            <div className="flex gap-2 my-5 sm:my-0">
              <button
                onClick={handleSave}
                className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg font-medium shadow-theme-xs hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all duration-300 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ cursor: isSaving ? 'not-allowed' : 'pointer' }}
                disabled={isSaving || (!hasUnsavedChanges && !isSaving)}
                title={hasSaved ? 'Update data mahasiswa terpilih' : 'Simpan data mahasiswa terpilih'}
              >
                {isSaving ? (
                  <>
                    <svg className="w-5 h-5 mr-2 animate-spin text-white inline-block align-middle" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Menyimpan...
                  </>
                ) : (
                  hasSaved ? 'Update' : 'Simpan'
                )}
              </button>
              <button
                onClick={handleReset}
                className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 rounded-lg font-medium shadow-theme-xs hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-gray-400 transition-all duration-300"
                style={{}}
                disabled={isSaving || isResetting}
                title="Reset semua pilihan mahasiswa"
              >
                {isResetting ? (
                  <>
                    <svg
                      className="w-5 h-5 mr-2 animate-spin text-gray-700 dark:text-gray-200 inline-block align-middle"
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
                    Mereset...
                  </>
                ) : (
                  'Reset'
                )}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {selectedMahasiswaFiltered.map(id => {
              const mhs = mahasiswaBySemester.find(m => m.id.toString() === id);
              if (!mhs) return null;
              return (
                <div
                  key={id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 ${unselectingId === id ? 'opacity-0 scale-95' : 'opacity-100'} group ${
                    mhs.is_veteran
                      ? "bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-300 dark:border-purple-600 shadow-md"
                      : "border-brand-300 bg-brand-50 dark:bg-brand-900/20"
                  }`}
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center relative ${
                    mhs.is_veteran
                      ? "bg-gradient-to-br from-purple-200 to-purple-300 dark:from-purple-700 dark:to-purple-800"
                      : "bg-brand-200 dark:bg-brand-700"
                  }`}>
                    <UserIcon className={`w-4 h-4 ${
                      mhs.is_veteran
                        ? "text-purple-700 dark:text-purple-200"
                        : "text-brand-700 dark:text-brand-200"
                    }`} />
                    {/* Veteran Crown Icon */}
                    {mhs.is_veteran && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-yellow-800">👑</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-brand-900 dark:text-brand-100 text-sm">{mhs.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-brand-800 dark:text-brand-200">{mhs.nim}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">{mhs.angkatan}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        mhs.ipk >= 3.5 ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300' :
                        mhs.ipk >= 3.0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' :
                        mhs.ipk >= 2.5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                      }`}>
                        IPK {mhs.ipk.toFixed(2)}
                      </span>
                      {/* Veteran Badge */}
                      {mhs.is_veteran && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-sm">
                          Veteran
                        </span>
                      )}
                      {/* Original Semester Badge for Veterans */}
                      {mhs.is_veteran && mhs.semester_asli && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                          Sem {mhs.semester_asli}
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      // Hapus mahasiswa dari local state saja (tidak langsung ke database)
                      setSelectedMahasiswa(selectedMahasiswa.filter(x => x !== id));
                      console.log('Student removed from local state. Click Update to save changes.');
                    }}
                    className={`ml-2 px-2 py-1 text-xs rounded-lg flex items-center gap-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40 transition border border-transparent hover:border-red-400`}
                    title="Hapus mahasiswa ini dari pilihan"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m2 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" />
                    </svg>
                    Hapus
                  </button>
                </div>
              );
            })}
            
            {/* Veteran yang dipilih */}
            {selectedVeterans.map(veteranId => {
              const veteran = veteranStudents.find(v => v.id.toString() === veteranId);
              if (!veteran) return null;
              return (
                <div
                  key={`veteran-${veteranId}`}
                  className="flex items-center gap-3 p-3 rounded-lg border transition-all duration-300 group bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-300 dark:border-purple-600 shadow-md"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-200 to-purple-300 dark:from-purple-700 dark:to-purple-800 flex items-center justify-center relative">
                    <UserIcon className="w-4 h-4 text-purple-700 dark:text-purple-200" />
                    {/* Veteran Crown Icon */}
                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                      <span className="text-xs font-bold text-yellow-800">👑</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-purple-900 dark:text-purple-100 text-sm">{veteran.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-purple-800 dark:text-purple-200">{veteran.nim}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">{veteran.angkatan}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                        Sem {veteran.semester || '?'}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        veteran.ipk >= 3.5 ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300' :
                        veteran.ipk >= 3.0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' :
                        veteran.ipk >= 2.5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                      }`}>
                        IPK {veteran.ipk.toFixed(2)}
                      </span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-sm">
                        Veteran
                      </span>
                      {veteran.is_multi_veteran && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-sm">
                          Multi Veteran
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => {
                      // Hapus veteran dari local state saja (tidak langsung ke database)
                      setSelectedVeterans(prev => prev.filter(id => id !== veteranId));
                      console.log('Veteran removed from local state. Click Update to save changes.');
                    }}
                    className="ml-2 px-2 py-1 text-xs rounded-lg flex items-center gap-1 bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/20 dark:text-red-300 dark:hover:bg-red-900/40 transition border border-transparent hover:border-red-400"
                    title="Hapus veteran ini dari pilihan"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6 7h12M9 7V5a2 2 0 012-2h2a2 2 0 012 2v2m2 0v12a2 2 0 01-2 2H8a2 2 0 01-2-2V7h12z" />
                    </svg>
                    Hapus
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {/* Filterisasi, Check All, Search Bar */}
      <div className="mb-6 w-full bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-4 flex flex-col md:flex-row md:items-center md:justify-between gap-4 shadow-theme-xs">
        <div className="flex items-center gap-2 select-none mb-4 md:mb-0">
          <span className="relative flex items-center">
  <button
    type="button"
    aria-checked={allSelected}
    role="checkbox"
    onClick={() => {
      if (allSelected) {
        setSelectedMahasiswa(selectedMahasiswa.filter(id => !allIds.includes(id)));
      } else {
        setSelectedMahasiswa(Array.from(new Set([...selectedMahasiswa, ...allIds])));
      }
    }}
    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
      allSelected
        ? "bg-brand-500 border-brand-500"
        : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"
    } cursor-pointer`}
  >
    {allSelected && (
      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
        <polyline points="20 7 11 17 4 10" />
              </svg>
            )}
  </button>
  <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
    Pilih Semua ({selectedMahasiswaFiltered.length}/{filteredMahasiswa.length})
          </span>
          </span>
        </div>
        <div className="w-full md:w-auto flex flex-col md:flex-row md:justify-end gap-2 items-stretch md:items-center">
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Cari nama atau NIM..."
            className="h-11 w-full md:w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-transparent py-2.5 pl-4 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
          />
          <select
            value={filterAngkatan}
            onChange={e => setFilterAngkatan(e.target.value)}
            className="h-11 w-full md:w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="semua">Semua Angkatan</option>
            {angkatanList.map(angkatan => (
              <option key={angkatan} value={angkatan}>{angkatan}</option>
            ))}
          </select>
          <select
            value={filterIPK}
            onChange={e => setFilterIPK(e.target.value)}
            className="h-11 w-full md:w-48 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="semua">Semua IPK</option>
            <option value="3.5">IPK 3.50 ke atas</option>
            <option value="3.0">IPK 3.00 ke atas</option>
            <option value="2.5">IPK 2.50 ke atas</option>
            <option value="2.0">IPK 2.00 ke atas</option>
            <option value="1.5">IPK 1.50 ke atas</option>
            <option value="1.0">IPK 1.00 ke atas</option>
          </select>
          {(function() {
            const allIds = filteredMahasiswa.map(m => m.id.toString());
            const anySelected = allIds.some(id => selectedMahasiswa.includes(id));
            return anySelected;
          })() && (
            <button
              type="button"
              onClick={handleUncheckAll}
              className="w-full md:w-auto px-3 py-2 text-sm rounded-lg border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all"
            >
              Uncheck Semua
            </button>
          )}
        </div>
      </div>
      <div className="mb-4 text-sm text-gray-600 dark:text-gray-300">
        Mahasiswa tersedia: <span className="font-bold">{filteredMahasiswa.length}</span> | Mahasiswa terpilih: <span className="font-bold">{selectedMahasiswaFiltered.length}</span>
        {selectedVeterans.length > 0 && (
          <span className="ml-2 text-purple-600 dark:text-purple-400">
            | Veteran terpilih: <span className="font-bold">{selectedVeterans.length}</span>
          </span>
        )}
      </div>
      
      {filteredMahasiswa.length === 0 ? (
        <div className="text-center py-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
            <UserIcon className="w-8 h-8 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
            Belum ada data mahasiswa
          </h3>
          <p className="text-gray-500 dark:text-gray-400">
            Tidak ada mahasiswa aktif yang tersedia.
          </p>
        </div>
      ) : (
        <AnimatePresence>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredMahasiswa.map(mhs => (
                <motion.div
                  key={mhs.id}
                  initial={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.97, transition: { duration: 0.35 } }}
                  transition={{ duration: 0.2 }}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors duration-200
                  ${selectedMahasiswa.includes(mhs.id.toString()) || pendingSelectedId === mhs.id.toString()
                        ? mhs.is_veteran
                          ? 'bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-300 dark:border-purple-600 shadow-md cursor-pointer hover:from-purple-100 hover:to-purple-200 hover:border-purple-400 dark:hover:from-purple-900/40 dark:hover:to-purple-800/40'
                          : 'bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-700 cursor-pointer hover:bg-brand-50 hover:border-brand-400'
                        : mhs.is_veteran
                          ? 'bg-gradient-to-r from-purple-50/50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700 cursor-pointer hover:from-purple-100 hover:to-purple-200 hover:border-purple-400 dark:hover:from-purple-900/40 dark:hover:to-purple-800/40'
                          : 'bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-brand-50 hover:border-brand-400'}
                  `}
                  onClick={() => {
                  if (!selectedMahasiswa.includes(mhs.id.toString())) {
                      setPendingSelectedId(mhs.id.toString());
                      setTimeout(() => {
                        handleSelect(mhs.id.toString());
                        setPendingSelectedId(null);
                      }, 350);
                    }
                  }}
                >
                  <div className="relative flex items-center" onClick={e => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      checked={selectedMahasiswa.includes(mhs.id.toString()) || pendingSelectedId === mhs.id.toString()}
                      onChange={e => {
                        e.stopPropagation();
                      if (!selectedMahasiswa.includes(mhs.id.toString())) handleSelect(mhs.id.toString());
                      }}
                    disabled={selectedMahasiswa.includes(mhs.id.toString())}
                      className={`w-5 h-5 appearance-none rounded-md border-2 ${selectedMahasiswa.includes(mhs.id.toString()) || pendingSelectedId === mhs.id.toString() ? 'border-brand-500 bg-brand-500' : 'border-brand-500 bg-transparent'} transition-colors duration-150 focus:ring-2 focus:ring-brand-300 dark:focus:ring-brand-600 relative disabled:opacity-50 disabled:cursor-not-allowed`}
                      style={{ outline: 'none' }}
                    />
                    {(selectedMahasiswa.includes(mhs.id.toString()) || pendingSelectedId === mhs.id.toString()) && (
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
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center relative ${
                    mhs.is_veteran
                      ? "bg-gradient-to-br from-purple-200 to-purple-300 dark:from-purple-700 dark:to-purple-800"
                      : "bg-gray-200 dark:bg-gray-700"
                  }`}>
                    <UserIcon className={`w-4 h-4 ${
                      mhs.is_veteran
                        ? "text-purple-700 dark:text-purple-200"
                        : "text-gray-600 dark:text-gray-400"
                    }`} />
                    {/* Veteran Crown Icon */}
                    {mhs.is_veteran && (
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-yellow-800">👑</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-gray-800 dark:text-white/90 text-sm">{mhs.name}</p>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs text-gray-600 dark:text-gray-400">{mhs.nim}</p>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">{mhs.angkatan}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        mhs.ipk >= 3.5 ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/20 dark:text-brand-300' :
                        mhs.ipk >= 3.0 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300' :
                        mhs.ipk >= 2.5 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300' :
                        'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                      }`}>
                        IPK {mhs.ipk.toFixed(2)}
                      </span>
                      {/* Veteran Badge */}
                      {mhs.is_veteran && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-sm">
                          Veteran
                        </span>
                      )}
                      {/* Original Semester Badge for Veterans */}
                      {mhs.is_veteran && mhs.semester_asli && (
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                          Sem {mhs.semester_asli}
                        </span>
                      )}
                    </div>
                  </div>
                </motion.div>
            ))}
          </div>
          </AnimatePresence>
      )}

      {/* Mahasiswa Veteran Section */}
      {showVeteranSection && (
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
              Mahasiswa Veteran ({veteranStudents.filter(v => v.is_available).length} tersedia dari {veteranStudents.length} total)
            </h3>
          </div>

          {/* Select All Veterans */}
          <div className="mb-4">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <span className="relative flex items-center">
                <input
                  type="checkbox"
                  checked={(() => {
                    const availableVeteranIds = veteranStudents.filter(v => v.is_available && !selectedVeterans.includes(v.id.toString())).map(v => v.id.toString());
                    return (
                      availableVeteranIds.every((id) => selectedVeterans.includes(id)) && 
                      availableVeteranIds.length > 0
                    );
                  })()}
                  onChange={handleSelectAllVeterans}
                  className={`
                    w-5 h-5
                    appearance-none
                    rounded-md
                    border-2
                    ${(() => {
                      const availableVeteranIds = veteranStudents.filter(v => v.is_available && !selectedVeterans.includes(v.id.toString())).map(v => v.id.toString());
                      return availableVeteranIds.every((id) => selectedVeterans.includes(id)) && 
                             availableVeteranIds.length > 0
                        ? "border-green-500 bg-green-500"
                        : "border-green-500 bg-transparent";
                    })()}
                    transition-colors
                    duration-150
                    focus:ring-2 focus:ring-green-300
                    relative
                  `}
                  style={{ outline: "none" }}
                />
                {(() => {
                  const availableVeteranIds = veteranStudents.filter(v => v.is_available && !selectedVeterans.includes(v.id.toString())).map(v => v.id.toString());
                  return (
                    availableVeteranIds.every((id) => selectedVeterans.includes(id)) && 
                    availableVeteranIds.length > 0
                  );
                })() && (
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
                Pilih Semua Veteran (
                {veteranStudents.filter(v => v.is_available && !selectedVeterans.includes(v.id.toString())).length > 0 ? 
                  veteranStudents.filter(v => v.is_available && !selectedVeterans.includes(v.id.toString())).length : 0}
                /{veteranStudents.filter(v => v.is_available && !selectedVeterans.includes(v.id.toString())).length} tersedia)
              </span>
            </label>
          </div>

          {veteranStudents.filter(v => !selectedVeterans.includes(v.id.toString())).length === 0 ? (
            <div className="text-center py-8">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                <UserIcon className="w-8 h-8 text-orange-500" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                {veteranStudents.length === 0 ? 'Belum ada mahasiswa veteran' : 'Semua veteran sudah dipilih'}
              </h3>
              <p className="text-orange-600 dark:text-orange-300">
                {veteranStudents.length === 0 ? 'Silakan tambahkan mahasiswa veteran terlebih dahulu.' : 'Semua mahasiswa veteran telah dipilih untuk semester ini.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {veteranStudents.filter(veteran => !selectedVeterans.includes(veteran.id.toString())).map((veteran) => {
                const isLocked = veteran.veteran_semesters && veteran.veteran_semesters.length > 0 && !veteran.veteran_semesters.includes(semester) && !veteran.is_multi_veteran;
                const isSelected = selectedVeterans.includes(veteran.id.toString());
                const isAvailable = veteran.is_available;
                
                return (
                  <div
                    key={veteran.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border transition-colors duration-200 ${
                      isSelected
                        ? "bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-300 dark:border-purple-600 shadow-md"
                        : isLocked
                        ? "bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 opacity-60"
                        : "bg-gradient-to-r from-purple-50/50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700 hover:from-purple-100 hover:to-purple-200 hover:border-purple-400 dark:hover:from-purple-900/40 dark:hover:to-purple-800/40"
                    } ${isAvailable && !isLocked ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                    onClick={() => {
                      if (isAvailable && !isLocked) {
                        handleSelectVeteran(veteran.id.toString());
                      }
                    }}
                  >
                    <div
                      className="relative flex items-center"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => {
                          if (isAvailable && !isLocked) {
                            handleSelectVeteran(veteran.id.toString());
                          }
                        }}
                        disabled={!isAvailable || isLocked}
                        className={`
                          w-5 h-5
                          appearance-none
                          rounded-md
                          border-2
                          ${
                            isSelected
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
                      {isSelected && (
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
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-200 to-purple-300 dark:from-purple-700 dark:to-purple-800 flex items-center justify-center relative">
                      <UserIcon className="w-4 h-4 text-purple-700 dark:text-purple-200" />
                      {/* Veteran Crown Icon */}
                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                        <span className="text-xs font-bold text-yellow-800">👑</span>
                      </div>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-800 dark:text-white/90 text-sm">
                          {veteran.name}
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-sm">
                          Veteran
                        </span>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-xs text-gray-600 dark:text-gray-400">
                          {veteran.nim}
                        </p>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                          {veteran.angkatan}
                        </span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                          Sem {veteran.semester || '?'}
                        </span>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            veteran.ipk >= 3.5
                              ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                              : veteran.ipk >= 3.0
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                              : veteran.ipk >= 2.5
                              ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                              : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                          }`}
                        >
                          IPK {veteran.ipk.toFixed(2)}
                        </span>
                        {isLocked && !veteran.is_multi_veteran && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300">
                            Terdaftar di {veteran.veteran_semesters && veteran.veteran_semesters.length > 0 ? veteran.veteran_semesters.join(", ") : '?'}
                          </span>
                        )}
                        {veteran.is_multi_veteran && (
                          <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-sm">
                            Multi Veteran
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
      
      {/* Modal Konfirmasi Reset */}
      {showResetModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
            onClick={() => setShowResetModal(false)}
          ></motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg z-[100001]"
          >
            <div className="flex items-center mb-6">
              <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mr-4">
                <svg className="w-8 h-8 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-800 dark:text-white leading-tight">Konfirmasi Reset</h3>
                <p className="text-base text-gray-500 dark:text-gray-400 mt-1">Reset pilihan mahasiswa</p>
              </div>
            </div>
            <p className="text-lg text-gray-800 dark:text-white text-center font-medium mb-6">Apakah Anda yakin ingin mereset pilihan mahasiswa?</p>
            <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 mb-8">
              <svg className="w-6 h-6 text-red-500 dark:text-red-300 mt-1 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
              <div>
                <p className="font-bold text-red-500 dark:text-red-300 mb-1">Tindakan ini tidak dapat dibatalkan!</p>
                <p className="text-red-500 dark:text-red-300 leading-snug">Semua pilihan mahasiswa akan dihapus dan Anda harus memilih ulang dari awal.</p>
              </div>
            </div>
            <div className="flex gap-4 w-full mt-2">
              <button
                onClick={() => setShowResetModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-out"
                disabled={isResetting}
              >
                Batal
              </button>
              <button
                onClick={handleConfirmReset}
                className="flex-1 px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-all duration-300 ease-out"
                disabled={isResetting}
              >
                {isResetting ? (
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
                    Mereset...
                  </>
                ) : (
                  'Reset'
                )}
              </button>
            </div>
            <button
              onClick={() => setShowResetModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent rounded-full p-1 transition-colors duration-200"
              aria-label="Tutup"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </motion.div>
        </div>
      )}

      {/* Notifikasi Simpan */}
      {showSaveNotification && (
        <div className="fixed top-4 right-4 z-50 bg-brand-500 text-white px-6 py-3 rounded-lg shadow-lg animate-in slide-in-from-right-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
            <span>{selectedMahasiswa.length} mahasiswa berhasil disimpan!</span>
          </div>
        </div>
      )}

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
            <div className="flex items-center mb-6">
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
            <p className="text-lg text-gray-800 dark:text-white text-center font-medium mb-6">
              Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?
            </p>
            <div className="flex gap-4 w-full mt-2">
              <button
                onClick={() => setShowLeaveModal(false)}
                className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-out"
              >
                Batal
              </button>
              <button
                onClick={() => {
                    navigate(-1);
                  setShowLeaveModal(false);
                }}
                className="flex-1 px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-all duration-300 ease-out"
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
    </div>
  );
};

export default KelompokBesar; 
