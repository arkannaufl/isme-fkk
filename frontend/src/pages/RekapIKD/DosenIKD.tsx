import React, { useState, useEffect, useCallback, useRef } from "react";
import RekapIKDBase from "./RekapIKDBase";
import api, { getUser } from "../../utils/api";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUpload,
  faDownload,
  faTrash,
  faSpinner,
  faTimes,
  faInfoCircle,
  faCheckCircle,
  faExclamationTriangle,
  faFile,
} from "@fortawesome/free-solid-svg-icons";

interface DosenData {
  id: number;
  name: string;
  nid?: string;
  nidn?: string;
  email?: string;
}

interface IKDPedoman {
  id: number;
  no: string;
  kegiatan: string;
  indeks_poin?: number;
  unit_kerja?: string;
  bukti_fisik?: string;
  prosedur?: string;
  bidang: string;
  bidang_nama?: string;
  parent_id?: number;
  level: number;
  is_active: boolean;
}

interface IKDBuktiFisik {
  id: number;
  user_id: number;
  ikd_pedoman_id: number;
  file_path: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  file_url?: string;
  skor?: number | null;
  status_verifikasi?: 'salah' | 'benar' | 'perbaiki' | null;
  pedoman?: IKDPedoman;
}

// Helper function to download file using API endpoint
const handleDownloadFile = async (fileId: number, fileName: string) => {
  try {
    const response = await api.get(
      `/rekap-ikd/bukti-fisik/${fileId}/download`,
      {
        responseType: "blob",
      }
    );

    // Create blob from response
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading file:", error);
    alert("Gagal mengunduh file. Silakan coba lagi.");
  }
};

const DosenIKD: React.FC = () => {
  const [dosenList, setDosenList] = useState<DosenData[]>([]);
  const [filteredDosen, setFilteredDosen] = useState<DosenData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const itemsPerPage = 10;

  // State untuk pedoman poin IKD
  const [pedomanList, setPedomanList] = useState<IKDPedoman[]>([]);
  const [loadingPedoman, setLoadingPedoman] = useState(true);

  // Unit kerja untuk filter
  const unitKerja = "Dosen";

  // Get user role untuk filter
  const user = getUser();
  const userRole = user?.role || "";
  const isVerifikator = userRole === "verifikator";
  const isSuperAdmin = userRole === "super_admin";
  const isKetuaIKD = userRole === "ketua_ikd";
  const isDosen = userRole === "dosen";

  // State untuk bukti fisik (realtime) - sekarang support multiple files
  const [buktiFisikMap, setBuktiFisikMap] = useState<{
    [key: string]: IKDBuktiFisik[];
  }>({}); // Key: `${user_id}_${ikd_pedoman_id}`, Value: array of files

  // State untuk upload file
  const [uploadingFiles, setUploadingFiles] = useState<{
    [key: string]: boolean;
  }>({}); // Key: `${user_id}_${ikd_pedoman_id}`

  // State untuk popup info kegiatan
  const [showKegiatanModal, setShowKegiatanModal] = useState(false);
  const [selectedKegiatan, setSelectedKegiatan] = useState<IKDPedoman | null>(
    null
  );

  // State untuk delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{
    id: number;
    fileName: string;
  } | null>(null);

  // State untuk aksi confirmation modal
  const [showAksiModal, setShowAksiModal] = useState(false);
  const [aksiToConfirm, setAksiToConfirm] = useState<{
    buktiFisikId: number;
    status: 'salah' | 'benar' | 'perbaiki';
    fileName: string;
  } | null>(null);

  // State untuk skor values (untuk input fields)
  const [skorValues, setSkorValues] = useState<{
    [key: string]: string;
  }>({}); // Key: `${user_id}_${ikd_pedoman_id}`

  // Refs untuk debounce timers
  const skorDebounceTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Refs untuk deleted file IDs (untuk mencegah file yang sudah dihapus muncul lagi)
  // const deletedFileIdsRef = useRef<Set<number>>(new Set()); // Not used anymore, using deletedKeysRef instead
  const deletedKeysRef = useRef<Set<string>>(new Set()); // Key: `${user_id}_${ikd_pedoman_id}`

  // Ref untuk track initial load
  const isInitialLoadRef = useRef(true);

  // Load deleted keys dari backend saat mount
  const loadDeletedKeys = useCallback(async () => {
    try {
      const res = await api.get(
        `/rekap-ikd/bukti-fisik/deleted-keys?unit=${unitKerja}`
      );
      if (res.data?.success && res.data?.data) {
        deletedKeysRef.current = new Set(res.data.data);
      }
    } catch (error) {
      console.error("Error loading deleted keys from backend:", error);
    }
  }, [unitKerja]);

  // Save deleted key ke backend
  const saveDeletedKey = useCallback(
    async (key: string) => {
      try {
        await api.post("/rekap-ikd/bukti-fisik/mark-key-deleted", {
          unit: unitKerja,
          key: key,
        });
      } catch (error) {
        console.error("Error saving deleted key to backend:", error);
      }
    },
    [unitKerja]
  );

  // Remove deleted key dari backend (saat upload file baru)
  const removeDeletedKey = useCallback(
    async (key: string) => {
      try {
        await api.post("/rekap-ikd/bukti-fisik/remove-deleted-key", {
          unit: unitKerja,
          key: key,
        });
      } catch (error) {
        console.error("Error removing deleted key from backend:", error);
      }
    },
    [unitKerja]
  );

  // State untuk success message
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // State untuk file input (hidden)
  const fileInputRefs = useRef<{
    [key: string]: HTMLInputElement | null;
  }>({});

  // State untuk show more files (expand/collapse)
  const [expandedFiles, setExpandedFiles] = useState<{
    [key: string]: boolean;
  }>({}); // Key: `${user_id}_${ikd_pedoman_id}`

  // State untuk menyimpan parent items (level 0) untuk indicators
  const [parentItemsMap, setParentItemsMap] = useState<Map<number, IKDPedoman>>(
    new Map()
  );

  // Fetch pedoman poin IKD berdasarkan unit kerja
  const fetchPedomanPoin = useCallback(async () => {
    try {
      setLoadingPedoman(true);
      const encodedUnit = encodeURIComponent(unitKerja);
      const res = await api.get(`/rekap-ikd/pedoman-poin/unit/${encodedUnit}`);
      if (res.data?.success && res.data?.data) {
        setPedomanList(res.data.data);

        // Fetch parent items untuk indicators (recursive untuk nested structure)
        // Untuk nested structure seperti 33.1.a, kita perlu parent 33.1 dan 33
        const allParentIds = new Set<number>();

        // Collect all parent_ids from level 1 and level 2 items
        res.data.data.forEach((item: IKDPedoman) => {
          if (item.parent_id) {
            allParentIds.add(item.parent_id);
          }
        });

        // Recursively fetch parent items until we have all parents
        if (allParentIds.size > 0) {
          try {
            const fetchParentsRecursive = async (
              ids: number[]
            ): Promise<Map<number, IKDPedoman>> => {
              const parentRes = await api.post(
                "/rekap-ikd/pedoman-poin/parents",
                {
                  ids: ids,
                }
              );

              const map = new Map<number, IKDPedoman>();
              if (parentRes.data?.success && parentRes.data?.data) {
                parentRes.data.data.forEach((item: IKDPedoman) => {
                  if (item.id) {
                    map.set(item.id, item);
                    // If this parent also has a parent_id, fetch it too
                    if (
                      item.parent_id &&
                      !map.has(item.parent_id) &&
                      !allParentIds.has(item.parent_id)
                    ) {
                      allParentIds.add(item.parent_id);
                    }
                  }
                });
              }

              // Check if we need to fetch more parents
              const newParentIds = Array.from(allParentIds).filter(
                (id) => !map.has(id)
              );
              if (newParentIds.length > 0) {
                const nestedMap = await fetchParentsRecursive(newParentIds);
                nestedMap.forEach((value, key) => map.set(key, value));
              }

              return map;
            };

            const parentMap = await fetchParentsRecursive(
              Array.from(allParentIds)
            );
            setParentItemsMap(parentMap);
          } catch (err) {
            console.error("Error fetching parent items:", err);
          }
        }
      }
    } catch (error: any) {
      console.error("Error fetching pedoman poin:", error);
      // Log detailed error for debugging
      if (error?.response) {
        console.error("Error response:", error.response.data);
        console.error("Error status:", error.response.status);
      }
      setPedomanList([]);
    } finally {
      setLoadingPedoman(false);
    }
  }, [unitKerja]);

  // Fetch bukti fisik (realtime)
  const fetchBuktiFisik = useCallback(async () => {
    try {
      // Jika dosen, hanya fetch untuk dirinya sendiri
      // Jika verifikator, super_admin, atau ketua_ikd, fetch semua (tanpa user_id filter)
      const userId = isDosen && user?.id ? user.id : undefined;
      const url = `/rekap-ikd/bukti-fisik?unit=${unitKerja}${
        userId ? `&user_id=${userId}` : ""
      }`;
      const res = await api.get(url);
      if (res.data?.success && res.data?.data) {
        const buktiFisikArray: IKDBuktiFisik[] = res.data.data;
        const newMap: { [key: string]: IKDBuktiFisik[] } = {};
        
        // Group by user_id and ikd_pedoman_id (support multiple files)
        buktiFisikArray.forEach((bf) => {
          const key = `${bf.user_id}_${bf.ikd_pedoman_id}`;
          if (!newMap[key]) {
            newMap[key] = [];
          }
          newMap[key].push(bf);
        });

        const currentDeletedKeys = deletedKeysRef.current;
        const filteredMap: { [key: string]: IKDBuktiFisik[] } = {};

        Object.keys(newMap).forEach((key) => {
          if (!currentDeletedKeys.has(key)) {
            filteredMap[key] = newMap[key];
          }
        });
        setBuktiFisikMap(filteredMap);

        // Update skor values
        // JANGAN update jika user sedang mengedit (ada di skorDebounceTimers)
        setSkorValues((prev) => {
          const updated: { [key: string]: string } = { ...prev };

          Object.keys(prev).forEach((key) => {
            if (!(key in filteredMap)) {
              // Jangan reset jika user sedang mengedit
              if (!skorDebounceTimers.current[key]) {
                updated[key] = "0";
              }
            }
          });

          Object.keys(filteredMap).forEach((key) => {
            // Skip update jika user sedang mengedit (ada timer aktif)
            if (skorDebounceTimers.current[key]) {
              return;
            }

            // Untuk multiple files, ambil skor dari file terbaru atau yang status_verifikasi = 'benar'
            const files = filteredMap[key];
            let currentSkor = "0";
            if (files && files.length > 0) {
              // Prioritaskan file dengan status_verifikasi = 'benar'
              const benarFile = files.find(f => f.status_verifikasi === 'benar');
              if (benarFile && benarFile.skor !== null && benarFile.skor !== undefined) {
                currentSkor = benarFile.skor.toString();
              } else {
                // Jika tidak ada yang 'benar', ambil dari file terbaru (id terbesar)
                const latestFile = files.sort((a, b) => b.id - a.id)[0];
                currentSkor = latestFile.skor?.toString() || "0";
              }
            }
            
            if (
              !(key in prev) ||
              prev[key] === undefined ||
              prev[key] !== currentSkor
            ) {
              updated[key] = currentSkor;
            }
          });

          return updated;
        });
      }
    } catch (error: any) {
      // Log error untuk debugging, tapi tidak throw agar tidak mengganggu UI
      if (error?.response?.status !== 403) {
        console.error("Error fetching bukti fisik:", error);
        if (error?.response) {
          console.error("Error response:", error.response.data);
          console.error("Error status:", error.response.status);
        }
      }
      // Silent fail untuk realtime update
    }
  }, [unitKerja, isDosen, user?.id]);

  // Fetch data dosen
  useEffect(() => {
    const fetchDosen = async () => {
      try {
        // Cek apakah ada cached data di sessionStorage
        const cacheKey = `dosen_ikd_${user?.id || "all"}_${
          isDosen ? "dosen" : isVerifikator ? "verifikator" : "admin"
        }`;
        const cachedData = sessionStorage.getItem(cacheKey);

        // Jika ada cached data, gunakan itu terlebih dahulu untuk menghindari flash of loading
        if (cachedData && !isInitialLoadRef.current) {
          try {
            const parsed = JSON.parse(cachedData);
            if (parsed && Array.isArray(parsed) && parsed.length > 0) {
              setDosenList(parsed);
              setFilteredDosen(parsed);
              setLoading(false);
              // Fetch di background untuk update data
            }
          } catch {
            // Ignore parse error
          }
        }

        // Hanya set loading ke true jika ini initial load atau data belum ada
        if (isInitialLoadRef.current || dosenList.length === 0) {
          setLoading(true);
        }

        // Jika dosen, hanya tampilkan dirinya sendiri
        // Jika verifikator, super_admin, atau ketua_ikd, tampilkan semua dosen
        if (isDosen && user?.id) {
          const res = await api.get(`/users/${user.id}`);
          if (res.data) {
            const data = [res.data];
            setDosenList(data);
            setFilteredDosen(data);
            // Cache data ke sessionStorage
            sessionStorage.setItem(cacheKey, JSON.stringify(data));
          }
        } else if (isVerifikator || isSuperAdmin || isKetuaIKD) {
          const res = await api.get("/users?role=dosen&per_page=1000");
          // Handle pagination response
          let data: DosenData[] = [];
          if (Array.isArray(res.data)) {
            data = res.data;
          } else if (res.data?.data && Array.isArray(res.data.data)) {
            data = res.data.data;
          } else if (res.data?.data?.data && Array.isArray(res.data.data.data)) {
            data = res.data.data.data;
          }
          setDosenList(data);
          setFilteredDosen(data);
          // Cache data ke sessionStorage
          sessionStorage.setItem(cacheKey, JSON.stringify(data));
        } else {
          // Fallback: jika bukan dosen, verifikator, super_admin, atau ketua_ikd, tidak ada data
          setDosenList([]);
          setFilteredDosen([]);
        }
      } catch (error: any) {
        console.error("Error fetching dosen:", error);
        // Log detailed error for debugging
        if (error?.response) {
          console.error("Error response:", error.response.data);
          console.error("Error status:", error.response.status);
        }
        setDosenList([]);
        setFilteredDosen([]);
      } finally {
        setLoading(false);
        isInitialLoadRef.current = false;
      }
    };

    fetchDosen();
    fetchPedomanPoin();
    loadDeletedKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    fetchPedomanPoin,
    loadDeletedKeys,
    isDosen,
    isVerifikator,
    isSuperAdmin,
    isKetuaIKD,
    user?.id,
  ]);

  // Initial fetch bukti fisik
  useEffect(() => {
    fetchBuktiFisik();
  }, [fetchBuktiFisik]);

  // Realtime update bukti fisik setiap 5 detik
  useEffect(() => {
    const interval = setInterval(() => {
      fetchBuktiFisik();
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchBuktiFisik]);

  // Filter dosen berdasarkan search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredDosen(dosenList);
      setCurrentPage(1);
      return;
    }
    const query = searchQuery.toLowerCase().trim();
    const filtered = dosenList.filter((dosen) => {
      return dosen.name?.toLowerCase().includes(query);
    });
    setFilteredDosen(filtered);
    setCurrentPage(1);
  }, [searchQuery, dosenList]);

  // Handle klik tombol aksi (buka modal konfirmasi)
  const handleAksiClick = (buktiFisikId: number, status: 'salah' | 'benar' | 'perbaiki', fileName: string) => {
    // Find file untuk mendapatkan nama file
    let foundFileName = fileName;
    for (const files of Object.values(buktiFisikMap)) {
      const file = files.find((f) => f.id === buktiFisikId);
      if (file) {
        foundFileName = file.file_name;
        break;
      }
    }
    
    setAksiToConfirm({
      buktiFisikId,
      status,
      fileName: foundFileName,
    });
    setShowAksiModal(true);
  };

  // Handle update status verifikasi
  const handleUpdateStatusVerifikasi = useCallback(
    async (buktiFisikId: number, status: 'salah' | 'benar' | 'perbaiki') => {
      try {
        // Find the file to get user_id and ikd_pedoman_id before deletion
        let fileKey = "";
        let fileToDelete: IKDBuktiFisik | null = null;
        for (const [key, files] of Object.entries(buktiFisikMap)) {
          const file = files.find((f) => f.id === buktiFisikId);
          if (file) {
            fileToDelete = file;
            fileKey = key;
            break;
          }
        }

        const res = await api.post("/rekap-ikd/bukti-fisik/update-status-verifikasi", {
          bukti_fisik_id: buktiFisikId,
          status_verifikasi: status,
        });

        if (res.data?.success) {
          // Jika status = 'perbaiki', hapus semua file dari state
          if (status === 'perbaiki') {
            if (fileKey) {
              setBuktiFisikMap((prev) => {
                const newMap = { ...prev };
                delete newMap[fileKey];
                return newMap;
              });
              
              // Reset skor
              setSkorValues((prev) => ({
                ...prev,
                [fileKey]: "0",
              }));
            }
            
            setSuccessMessage("Semua file telah dihapus. Dosen harus upload ulang.");
            setTimeout(() => setSuccessMessage(null), 5000);
          } else {
            // Update local state untuk SEMUA file dengan key yang sama (status 'salah' atau 'benar')
            if (fileKey) {
              setBuktiFisikMap((prev) => {
                const newMap = { ...prev };
                if (newMap[fileKey]) {
                  // Update semua file di key ini dengan status yang sama
                  newMap[fileKey] = newMap[fileKey].map((file) => ({
                    ...file,
                    status_verifikasi: status,
                    skor: status === 'salah' ? 0 : file.skor,
                  }));
                }
                return newMap;
              });

              // Jika status = 'salah', update skor ke 0
              if (status === 'salah') {
                setSkorValues((prev) => ({
                  ...prev,
                  [fileKey]: "0",
                }));
              }
            }

            setSuccessMessage(`Status verifikasi berhasil diupdate menjadi "${status}" untuk semua file`);
            setTimeout(() => setSuccessMessage(null), 3000);
          }
          
          // Refresh data
          await fetchBuktiFisik();
        }
      } catch (error) {
        console.error("Error updating status verifikasi:", error);
        alert("Gagal mengupdate status verifikasi. Silakan coba lagi.");
      }
    },
    [buktiFisikMap, fetchBuktiFisik]
  );

  // Handle konfirmasi aksi (setelah user konfirmasi di modal)
  const handleConfirmAksi = async () => {
    if (!aksiToConfirm) return;

    const { buktiFisikId, status } = aksiToConfirm;
    setShowAksiModal(false);
    const currentAksi = aksiToConfirm;
    setAksiToConfirm(null);
    
    // Panggil handleUpdateStatusVerifikasi yang sudah ada
    await handleUpdateStatusVerifikasi(currentAksi.buktiFisikId, currentAksi.status);
  };

  // Handle skor change dengan debounce
  const handleSkorChange = useCallback(
    (userId: number, pedomanId: number, value: string) => {
      const key = `${userId}_${pedomanId}`;

      // Update local state immediately
      setSkorValues((prev) => ({
        ...prev,
        [key]: value,
      }));

      // Clear existing timer
      if (skorDebounceTimers.current[key]) {
        clearTimeout(skorDebounceTimers.current[key]);
      }

      // Set new timer untuk debounce (500ms)
      skorDebounceTimers.current[key] = setTimeout(async () => {
        try {
          const skorValue = value.trim() === "" ? null : parseFloat(value);

          await api.post("/rekap-ikd/bukti-fisik/update-skor", {
            user_id: userId,
            ikd_pedoman_id: pedomanId,
            unit: unitKerja,
            skor: skorValue,
          });

          // Update local state dengan nilai yang baru saja di-save
          setSkorValues((prev) => ({
            ...prev,
            [key]: value.trim() === "" ? "0" : value,
          }));

          // Update buktiFisikMap dengan nilai skor yang baru
          // Update file yang status_verifikasi = 'benar' atau file terbaru jika tidak ada yang 'benar'
          setBuktiFisikMap((prev) => {
            const updated = { ...prev };
            if (updated[key] && updated[key].length > 0) {
              const files = [...updated[key]];
              // Cari file dengan status_verifikasi = 'benar'
              const benarFileIndex = files.findIndex(f => f.status_verifikasi === 'benar');
              if (benarFileIndex !== -1) {
                files[benarFileIndex] = {
                  ...files[benarFileIndex],
                  skor: skorValue,
                };
              } else {
                // Jika tidak ada yang 'benar', update file terbaru (id terbesar)
                const latestIndex = files.reduce((maxIdx, file, idx) => 
                  file.id > files[maxIdx].id ? idx : maxIdx, 0
                );
                files[latestIndex] = {
                  ...files[latestIndex],
                skor: skorValue,
              };
              }
              updated[key] = files;
            }
            return updated;
          });

          // Clear timer setelah berhasil
          delete skorDebounceTimers.current[key];

          // Jangan panggil fetchBuktiFisik() di sini karena akan trigger interval
          // Biarkan interval yang handle refresh
        } catch (error) {
          console.error("Error updating skor:", error);
          // Revert to original value on error
          const currentFiles = buktiFisikMap[key];
          if (currentFiles && currentFiles.length > 0) {
            const benarFile = currentFiles.find(f => f.status_verifikasi === 'benar');
            const fileToUse = benarFile || currentFiles.sort((a, b) => b.id - a.id)[0];
            setSkorValues((prev) => ({
              ...prev,
              [key]: fileToUse.skor?.toString() || "",
            }));
          }
        }
      }, 500);
    },
    [buktiFisikMap, unitKerja]
  );

  // Handle multiple files upload
  const handleMultipleFileUpload = async (
    userId: number,
    pedomanId: number,
    files: FileList | File[]
  ) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const key = `${userId}_${pedomanId}`;
    setUploadingFiles((prev) => ({ ...prev, [key]: true }));

    try {
      // Upload semua file secara sequential untuk menghindari overload
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const file of fileArray) {
        try {
          await handleFileUploadInternal(userId, pedomanId, file);
          successCount++;
        } catch (error) {
          console.error(`Error uploading file ${file.name}:`, error);
          errorCount++;
          const errorMessage = (
            error as { response?: { data?: { message?: string } } }
          )?.response?.data?.message;
          errors.push(`${file.name}: ${errorMessage || "Gagal upload"}`);
        }
      }

      // Refresh bukti fisik setelah semua upload selesai
      await fetchBuktiFisik();

      if (successCount > 0) {
        if (errorCount > 0) {
          setSuccessMessage(
            `${successCount} file berhasil diupload, ${errorCount} file gagal.`
          );
          if (errors.length > 0) {
            console.error("Upload errors:", errors);
          }
        } else {
          setSuccessMessage(
            `${successCount} file berhasil diupload sekaligus!`
          );
        }
        setTimeout(() => setSuccessMessage(null), 5000);
      } else {
        alert("Semua file gagal diupload. Silakan coba lagi.");
      }
    } catch (error) {
      console.error("Error in multiple file upload:", error);
      alert("Terjadi kesalahan saat mengupload file. Silakan coba lagi.");
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Internal function untuk upload single file (tanpa feedback, untuk digunakan oleh handleMultipleFileUpload)
  const handleFileUploadInternal = async (
    userId: number,
    pedomanId: number,
    file: File
  ) => {
    const key = `${userId}_${pedomanId}`;

    const formData = new FormData();
    formData.append("user_id", userId.toString());
    formData.append("ikd_pedoman_id", pedomanId.toString());
    formData.append("unit", unitKerja);
    formData.append("file", file);

    const res = await api.post("/rekap-ikd/bukti-fisik/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
    });

    if (res.data?.success) {
      // Hapus key dari deletedKeysRef karena ada file baru
      if (deletedKeysRef.current.has(key)) {
        const newDeletedKeysSet = new Set(deletedKeysRef.current);
        newDeletedKeysSet.delete(key);
        deletedKeysRef.current = newDeletedKeysSet;
        await removeDeletedKey(key);
      }

      // Update state langsung dari response untuk immediate UI update
      const uploadedBuktiFisik = res.data?.data;
      if (uploadedBuktiFisik) {
        setBuktiFisikMap((prev) => {
          const existingFiles = prev[key] || [];
          return {
            ...prev,
            [key]: [
              ...existingFiles,
              {
                id: uploadedBuktiFisik.id,
                user_id: uploadedBuktiFisik.user_id,
                ikd_pedoman_id: uploadedBuktiFisik.ikd_pedoman_id,
                file_path: uploadedBuktiFisik.file_path,
                file_name: uploadedBuktiFisik.file_name,
                file_type: uploadedBuktiFisik.file_type,
                file_size: uploadedBuktiFisik.file_size,
                file_url: uploadedBuktiFisik.file_url,
                skor: uploadedBuktiFisik.skor || 0,
                status_verifikasi: uploadedBuktiFisik.status_verifikasi || null,
                pedoman: uploadedBuktiFisik.pedoman,
              },
            ],
          };
        });

        // Update skor value jika ada
        if (
          uploadedBuktiFisik.skor !== null &&
          uploadedBuktiFisik.skor !== undefined
        ) {
          setSkorValues((prev) => ({
            ...prev,
            [key]: uploadedBuktiFisik.skor.toString(),
          }));
        } else {
          // Set ke 0 jika skor null/undefined
          setSkorValues((prev) => ({
            ...prev,
            [key]: "0",
          }));
        }
      }
    } else {
      throw new Error("Upload failed");
    }
  };

  // Handle file upload (single file)
  const handleFileUpload = async (
    userId: number,
    pedomanId: number,
    file: File
  ) => {
    const key = `${userId}_${pedomanId}`;
    setUploadingFiles((prev) => ({ ...prev, [key]: true }));

    try {
      const formData = new FormData();
      formData.append("user_id", userId.toString());
      formData.append("ikd_pedoman_id", pedomanId.toString());
      formData.append("unit", unitKerja);
      formData.append("file", file);

      const res = await api.post("/rekap-ikd/bukti-fisik/upload", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (res.data?.success) {
        // Hapus key dari deletedKeysRef karena ada file baru
        if (deletedKeysRef.current.has(key)) {
          const newDeletedKeysSet = new Set(deletedKeysRef.current);
          newDeletedKeysSet.delete(key);
          deletedKeysRef.current = newDeletedKeysSet;
          await removeDeletedKey(key);
        }

        // Update state langsung dari response untuk immediate UI update
        const uploadedBuktiFisik = res.data?.data;
        if (uploadedBuktiFisik) {
          setBuktiFisikMap((prev) => {
            const existingFiles = prev[key] || [];
            return {
            ...prev,
              [key]: [
                ...existingFiles,
                {
              id: uploadedBuktiFisik.id,
              user_id: uploadedBuktiFisik.user_id,
              ikd_pedoman_id: uploadedBuktiFisik.ikd_pedoman_id,
              file_path: uploadedBuktiFisik.file_path,
              file_name: uploadedBuktiFisik.file_name,
              file_type: uploadedBuktiFisik.file_type,
              file_size: uploadedBuktiFisik.file_size,
              file_url: uploadedBuktiFisik.file_url,
              skor: uploadedBuktiFisik.skor || 0,
                  status_verifikasi: uploadedBuktiFisik.status_verifikasi || null,
              pedoman: uploadedBuktiFisik.pedoman,
            },
              ],
            };
          });

          // Update skor value jika ada
          if (
            uploadedBuktiFisik.skor !== null &&
            uploadedBuktiFisik.skor !== undefined
          ) {
            setSkorValues((prev) => ({
              ...prev,
              [key]: uploadedBuktiFisik.skor.toString(),
            }));
          } else {
            // Set ke 0 jika skor null/undefined
            setSkorValues((prev) => ({
              ...prev,
              [key]: "0",
            }));
          }
        }

        // Refresh bukti fisik setelah upload untuk memastikan sinkronisasi
        await fetchBuktiFisik();
        setSuccessMessage("File berhasil diupload!");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (error: unknown) {
      console.error("Error uploading file:", error);
      const errorMessage = (
        error as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      alert(errorMessage || "Gagal mengupload file. Silakan coba lagi.");
    } finally {
      setUploadingFiles((prev) => ({ ...prev, [key]: false }));
    }
  };

  // Handle delete file confirmation
  const handleDeleteClick = (buktiFisikId: number, fileName: string) => {
    setFileToDelete({ id: buktiFisikId, fileName });
    setShowDeleteModal(true);
  };

  // Handle delete file
  const handleDeleteFile = async () => {
    if (!fileToDelete) return;

    try {
      // Find the file in buktiFisikMap
      let deletedBuktiFisik: IKDBuktiFisik | null = null;
      let fileKey = "";
      
      for (const [key, files] of Object.entries(buktiFisikMap)) {
        const file = files.find((bf) => bf.id === fileToDelete.id);
        if (file) {
          deletedBuktiFisik = file;
          fileKey = key;
          break;
        }
      }

      if (!deletedBuktiFisik) {
        console.error("BuktiFisik not found for deletion");
        return;
      }

      // Hapus file dari backend
      const res = await api.delete(`/rekap-ikd/bukti-fisik/${fileToDelete.id}`);
      if (res.data?.success) {
        // Langsung update local state: hapus file spesifik dari array
        setBuktiFisikMap((prev) => {
          const newMap = { ...prev };
          if (newMap[fileKey]) {
            const filteredFiles = newMap[fileKey].filter(
              (bf) => bf.id !== fileToDelete.id
            );
            if (filteredFiles.length === 0) {
              // Jika tidak ada file lagi, hapus key dan tandai sebagai deleted
              delete newMap[fileKey];
              const newDeletedKeysSet = new Set(deletedKeysRef.current);
              newDeletedKeysSet.add(fileKey);
              deletedKeysRef.current = newDeletedKeysSet;
              saveDeletedKey(fileKey);

        // Reset skor ke 0 di local state
        setSkorValues((prev) => ({
          ...prev,
                [fileKey]: "0",
        }));
            } else {
              newMap[fileKey] = filteredFiles;
            }
          }
          return newMap;
        });

        // Tutup modal
        setShowDeleteModal(false);
        setFileToDelete(null);

        // Show success message
        setSuccessMessage("File berhasil dihapus! Skor telah direset ke 0.");
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (error: unknown) {
      console.error("Error deleting file:", error);
      const errorMessage = (
        error as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      alert(errorMessage || "Gagal menghapus file. Silakan coba lagi.");
    }
  };

  // Helper function untuk check apakah item punya content
  const hasContent = (item: IKDPedoman): boolean => {
    return !!(
      (item.indeks_poin && item.indeks_poin > 0) ||
      (item.unit_kerja && item.unit_kerja.trim().length > 0) ||
      (item.bukti_fisik && item.bukti_fisik.trim().length > 0) ||
      (item.prosedur && item.prosedur.trim().length > 0)
    );
  };

  // Handle klik header kegiatan untuk show modal
  const handleKegiatanHeaderClick = (pedoman: IKDPedoman) => {
    setSelectedKegiatan(pedoman);
    setShowKegiatanModal(true);
  };

  // Get indicator untuk modal (dengan logic untuk mengambil parent PALING DEKAT)
  const getIndicator = (pedoman: IKDPedoman): string => {
    // Ambil nomor dari kegiatan (parse angka di awal, bisa dengan titik atau huruf)
    const match = pedoman.kegiatan.match(/^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/);
    if (!match) return "-";

    const currentNumber = match[1]; // Misal: "1.1.a" atau "2.1" atau "2.a" atau "1"

    // Cek apakah item punya isi
    const itemHasContent = hasContent(pedoman);

    // Jika item PUNYA isi → cek apakah ini nomor utama
    if (itemHasContent) {
      // Cek dulu: jika item ini adalah nomor utama (tidak ada titik, tidak ada huruf)
      // Misal: "5", "4", "1" (bukan "1.1", "1.1.a", "2.a")
      const isMainNumber =
        !currentNumber.includes(".") && !/[a-z]$/i.test(currentNumber);
      if (isMainNumber) {
        // Jika item utama punya isi, indicators = "-"
        return "-";
      }
    }

    // Jika item punya isi, cari parent yang tidak punya isi (ambil yang PALING DEKAT)
    if (hasContent(pedoman)) {
      // Helper function untuk mencari parent yang tidak punya content (recursive)
      const findParentWithoutContent = (
        currentPedoman: IKDPedoman
      ): IKDPedoman | null => {
        // Cek parent langsung dulu (via parent_id) - ini parent PALING DEKAT
        if (currentPedoman.parent_id) {
          // Cek di parentItemsMap dulu
          if (parentItemsMap.has(currentPedoman.parent_id)) {
            const parent = parentItemsMap.get(currentPedoman.parent_id);
            if (parent) {
              if (!hasContent(parent)) {
                // Parent langsung tidak punya content, return parent ini
                return parent;
              } else {
                // Parent langsung punya content, cari parent dari parent ini (recursive)
                return findParentWithoutContent(parent);
              }
            }
          }

          // Jika tidak ada di parentItemsMap, cari di pedomanList
          const parentInList = pedomanList.find(
            (item) => item.id === currentPedoman.parent_id
          );
          if (parentInList) {
            if (!hasContent(parentInList)) {
              return parentInList;
            } else {
              return findParentWithoutContent(parentInList);
            }
          }
        }

        // Fallback: cari berdasarkan nomor (untuk backward compatibility)
        const match = currentPedoman.kegiatan.match(
          /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
        );
        if (!match) return null;

        let currentNumber = match[1];
        while (currentNumber) {
          // Ambil parent number (hapus bagian terakhir)
          if (currentNumber.includes(".")) {
            const parts = currentNumber.split(".");
            if (parts.length > 1) {
              parts.pop();
              currentNumber = parts.join(".");
            } else {
              break;
            }
          } else if (/[a-z]$/i.test(currentNumber)) {
            currentNumber = currentNumber.replace(/[a-z]+$/i, "");
          } else {
            break;
          }

          // Cari di pedomanList dengan nomor yang sesuai
          // Pastikan parent yang ditemukan adalah yang paling tepat (terdekat dengan nomor sub-item)
          const parent = pedomanList.find((item) => {
            const itemMatch = item.kegiatan.match(
              /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
            );
            if (!itemMatch) return false;
            const itemNumber = itemMatch[1];
            // Pastikan nomor cocok DAN juga cocok dengan bidang
            return itemNumber === currentNumber && 
                   item.bidang === currentPedoman.bidang &&
                   (item.level === 0 || item.level === undefined) &&
                   (!item.parent_id || item.parent_id === null);
          });

          if (parent && !hasContent(parent)) {
            return parent;
          }
        }

        return null;
      };

      const parentWithoutContent = findParentWithoutContent(pedoman);
      if (parentWithoutContent) {
        return parentWithoutContent.kegiatan;
      }
    }

    // Jika item tidak punya isi, cari parent yang punya isi (ambil yang PALING DEKAT)
    if (!hasContent(pedoman)) {
      // Helper function untuk mencari parent yang punya content (recursive)
      const findParentWithContent = (
        currentPedoman: IKDPedoman
      ): IKDPedoman | null => {
        // Cek parent langsung dulu (via parent_id) - ini parent PALING DEKAT
        if (currentPedoman.parent_id) {
          // Cek di parentItemsMap dulu
          if (parentItemsMap.has(currentPedoman.parent_id)) {
            const parent = parentItemsMap.get(currentPedoman.parent_id);
            if (parent) {
              if (hasContent(parent)) {
                // Parent langsung punya content, return parent ini
                return parent;
              } else {
                // Parent langsung tidak punya content, cari parent dari parent ini (recursive)
                return findParentWithContent(parent);
              }
            }
          }

          // Jika tidak ada di parentItemsMap, cari di pedomanList
          const parentInList = pedomanList.find(
            (item) => item.id === currentPedoman.parent_id
          );
          if (parentInList) {
            if (hasContent(parentInList)) {
              return parentInList;
            } else {
              return findParentWithContent(parentInList);
            }
          }
        }

        // Fallback: cari berdasarkan nomor (untuk backward compatibility)
        const match = currentPedoman.kegiatan.match(
          /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
        );
        if (!match) return null;

        let currentNumber = match[1];
        while (currentNumber) {
          // Ambil parent number (hapus bagian terakhir)
          if (currentNumber.includes(".")) {
            const parts = currentNumber.split(".");
            if (parts.length > 1) {
              parts.pop();
              currentNumber = parts.join(".");
            } else {
              break;
            }
          } else if (/[a-z]$/i.test(currentNumber)) {
            currentNumber = currentNumber.replace(/[a-z]+$/i, "");
          } else {
            break;
          }

          // Cari di pedomanList dengan nomor yang sesuai
          // Pastikan parent yang ditemukan adalah yang paling tepat (terdekat dengan nomor sub-item)
          const parent = pedomanList.find((item) => {
            const itemMatch = item.kegiatan.match(
              /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
            );
            if (!itemMatch) return false;
            const itemNumber = itemMatch[1];
            // Pastikan nomor cocok DAN juga cocok dengan bidang
            return itemNumber === currentNumber && 
                   item.bidang === currentPedoman.bidang &&
                   (item.level === 0 || item.level === undefined) &&
                   (!item.parent_id || item.parent_id === null);
          });

          if (parent && hasContent(parent)) {
            return parent;
          }
        }

        return null;
      };

      const parentWithContent = findParentWithContent(pedoman);
      if (parentWithContent) {
        return parentWithContent.kegiatan;
      }
    }

    return "-";
  };

  // Pagination helpers
  const totalPages = Math.ceil(filteredDosen.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDosen = filteredDosen.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <RekapIKDBase
      title="Rekap IKD - Dosen"
      description="Rekap Indikator Kinerja Dosen untuk Dosen"
    >
      <div className="space-y-6">
        {/* Success Message */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
            >
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0">
                    <svg
                      className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                      Berhasil
                    </h3>
                    <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                      {successMessage}
                    </p>
                  </div>
                  <button
                    onClick={() => setSuccessMessage(null)}
                    className="flex-shrink-0 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                  >
                    <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search Bar - hanya tampilkan jika verifikator atau super_admin */}
        {(isVerifikator || isSuperAdmin || isKetuaIKD) && (
          <div className="flex items-center gap-4">
            <div className="relative flex-1 max-w-md">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg
                  className="h-5 w-5 text-gray-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                placeholder="Cari dosen (nama)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {filteredDosen.length} dosen ditemukan
            </div>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          {loading || loadingPedoman ? (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      No
                    </th>
                    <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Nama Dosen
                    </th>
                    {Array.from({ length: 3 }).map((_, idx) => (
                      <React.Fragment key={idx}>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </th>
                        <th className="px-2 pr-4 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                          <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto"></div>
                        </th>
                      </React.Fragment>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-white/[0.03] divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {Array.from({ length: 5 }).map((_, rowIdx) => (
                    <tr key={rowIdx} className="animate-pulse">
                      <td className="px-4 py-4">
                        <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </td>
                      {Array.from({ length: 3 }).map((_, colIdx) => (
                        <React.Fragment key={colIdx}>
                          <td className="px-4 py-4">
                            <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          </td>
                          <td className="px-2 pr-4 py-4 text-center">
                            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                          </td>
                        </React.Fragment>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <>
              <div
                className="max-w-full overflow-x-auto"
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                <style>{`
                  .max-w-full::-webkit-scrollbar { display: none; }
                `}</style>
                <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                  <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                    <tr>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        No
                      </th>
                      <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Nama Dosen
                      </th>
                      {pedomanList.map((pedoman, index) => (
                        <React.Fragment key={pedoman.id}>
                          <th
                            className={`px-4 ${
                              index > 0 ? "pl-8" : ""
                            } pr-2 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative group`}
                            onClick={() => handleKegiatanHeaderClick(pedoman)}
                            title={pedoman.kegiatan}
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span 
                                className="truncate block max-w-[200px]" 
                                title={pedoman.kegiatan}
                              >
                                {pedoman.kegiatan}
                              </span>
                              <FontAwesomeIcon
                                icon={faInfoCircle}
                                className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                              />
                            </div>
                          </th>
                          <th className="px-2 pr-4 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-24">
                            Aksi
                          </th>
                          <th className="px-2 pr-4 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                            Skor
                          </th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-white/[0.03] divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {paginatedDosen.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2 + pedomanList.length * 3}
                          className="px-6 py-16 text-center"
                        >
                          <div className="flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500">
                            <svg
                              className="w-10 h-10"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M13 16h-1v-4h-1m1 4h.01M12 9h.01"
                              />
                              <circle
                                cx="12"
                                cy="12"
                                r="9"
                                stroke="currentColor"
                                strokeWidth="2"
                              />
                            </svg>
                            <span className="bg-gray-100 dark:bg-gray-800/60 rounded-full px-5 py-2 mt-1 font-medium">
                              {searchQuery
                                ? "Tidak ada data yang cocok dengan pencarian"
                                : "Tidak ada data dosen"}
                            </span>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      paginatedDosen.map((dosen, index) => (
                        <tr
                          key={dosen.id}
                          className="hover:bg-gray-50 dark:hover:bg-white/[0.05] transition-colors"
                        >
                          <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                            {startIndex + index + 1}
                          </td>
                          <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">
                            {dosen.name || "-"}
                          </td>
                          {pedomanList.map((pedoman, index) => {
                            const key = `${dosen.id}_${pedoman.id}`;
                            const buktiFisikFiles = buktiFisikMap[key] || [];
                            const isUploading = uploadingFiles[key] || false;
                            const fileInputKey = `file_${key}`;
                            
                            // Get skor value (prioritize file with status_verifikasi = 'benar')
                            let skorValue = "0";
                            if (buktiFisikFiles.length > 0) {
                              const benarFile = buktiFisikFiles.find(f => f.status_verifikasi === 'benar');
                              if (benarFile && benarFile.skor !== null && benarFile.skor !== undefined) {
                                skorValue = benarFile.skor.toString();
                              } else {
                                const latestFile = buktiFisikFiles.sort((a, b) => b.id - a.id)[0];
                                skorValue = skorValues[key] ?? latestFile.skor?.toString() ?? "0";
                              }
                            }

                            // Check status untuk menentukan apakah bisa upload
                            const hasSalahStatus = buktiFisikFiles.some(f => f.status_verifikasi === 'salah');
                            const hasBenarStatus = buktiFisikFiles.some(f => f.status_verifikasi === 'benar');
                            const hasPerbaikiStatus = buktiFisikFiles.some(f => f.status_verifikasi === 'perbaiki');
                            // Dosen tidak bisa upload jika ada status 'salah' atau 'benar'
                            const canUpload = isDosen && dosen.id === user?.id && !hasSalahStatus && !hasBenarStatus;

                            // Check apakah ada file dengan status verifikasi
                            const hasStatusVerifikasi = buktiFisikFiles.some(f => f.status_verifikasi !== null && f.status_verifikasi !== undefined);
                            // Check apakah ada file dengan status 'benar' (bisa isi skor)
                            const hasBenarFile = buktiFisikFiles.some(f => f.status_verifikasi === 'benar');
                            
                            // Limit files untuk display (max 3, sisanya bisa expand)
                            const maxVisibleFiles = 3;
                            const isExpanded = expandedFiles[key] || false;
                            const visibleFiles = isExpanded ? buktiFisikFiles : buktiFisikFiles.slice(0, maxVisibleFiles);
                            const hasMoreFiles = buktiFisikFiles.length > maxVisibleFiles;

                            return (
                              <React.Fragment key={pedoman.id}>
                                <td
                                  className={`px-4 ${
                                    index > 0 ? "pl-8" : ""
                                  } pr-2 py-4 text-sm text-gray-900 dark:text-gray-100`}
                                >
                                  <div className="flex flex-col gap-2">
                                    {buktiFisikFiles.length > 0 ? (
                                      <>
                                        {/* Multiple files display */}
                                        {visibleFiles.map((buktiFisik) => (
                                          <div key={buktiFisik.id} className="flex flex-col gap-1">
                                      <div className="flex items-center gap-2">
                                        {/* Download button - semua role bisa download */}
                                        <button
                                          onClick={() =>
                                            handleDownloadFile(
                                              buktiFisik.id,
                                              buktiFisik.file_name
                                            )
                                          }
                                          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                                          title={buktiFisik.file_name}
                                        >
                                          <FontAwesomeIcon icon={faDownload} />
                                          <span className="text-xs truncate max-w-[150px]">
                                            {buktiFisik.file_name}
                                          </span>
                                        </button>
                                        {/* Delete button - hanya dosen yang bisa hapus file sendiri */}
                                        {isDosen && dosen.id === user?.id && (
                                          <button
                                            onClick={() =>
                                              handleDeleteClick(
                                                buktiFisik.id,
                                                buktiFisik.file_name
                                              )
                                            }
                                            className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 transition-colors"
                                            title="Hapus file"
                                          >
                                            <FontAwesomeIcon icon={faTrash} />
                                          </button>
                                        )}
                                      </div>
                                            
                                            {/* Status badge */}
                                            {buktiFisik.status_verifikasi && (
                                              <span className={`text-xs px-2 py-0.5 rounded ${
                                                buktiFisik.status_verifikasi === 'benar' 
                                                  ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                                  : buktiFisik.status_verifikasi === 'salah'
                                                  ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                                  : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                                              }`}>
                                                {buktiFisik.status_verifikasi === 'benar' ? '✓ Benar' :
                                                 buktiFisik.status_verifikasi === 'salah' ? '✗ Salah' :
                                                 '⚠ Perbaiki'}
                                              </span>
                                            )}
                                          </div>
                                        ))}
                                        
                                        {/* Show more/less button jika file lebih dari 3 */}
                                        {hasMoreFiles && (
                                          <button
                                            onClick={() => setExpandedFiles(prev => ({
                                              ...prev,
                                              [key]: !prev[key]
                                            }))}
                                            className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                                          >
                                            {isExpanded ? 'Lihat lebih sedikit' : `Lihat ${buktiFisikFiles.length - maxVisibleFiles} file lagi`}
                                          </button>
                                        )}
                                        
                                      </>
                                    ) : null}
                                    
                                    {/* Upload button - hanya dosen yang bisa upload untuk dirinya sendiri */}
                                    {/* Bisa upload jika: belum ada file, atau semua file status-nya null */}
                                    {canUpload ? (
                                      <div className="flex items-center gap-2">
                                        <input
                                          ref={(el) => {
                                            fileInputRefs.current[
                                              fileInputKey
                                            ] = el;
                                          }}
                                          type="file"
                                          accept=".pdf,.xlsx,.xls,.docx,.doc,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.zip,.rar"
                                          multiple
                                          className="hidden"
                                          onChange={(e) => {
                                            const files = e.target.files;
                                            if (files && files.length > 0) {
                                              handleMultipleFileUpload(
                                                dosen.id,
                                                pedoman.id,
                                                files
                                              );
                                            }
                                            if (
                                              fileInputRefs.current[
                                                fileInputKey
                                              ]
                                            ) {
                                              fileInputRefs.current[
                                                fileInputKey
                                              ].value = "";
                                            }
                                          }}
                                        />
                                        <button
                                          onClick={() => {
                                            fileInputRefs.current[
                                              fileInputKey
                                            ]?.click();
                                          }}
                                          disabled={isUploading}
                                          className="flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          {isUploading ? (
                                            <>
                                              <FontAwesomeIcon
                                                icon={faSpinner}
                                                className="animate-spin"
                                              />
                                              <span>Uploading...</span>
                                            </>
                                          ) : (
                                            <>
                                              <FontAwesomeIcon
                                                icon={faUpload}
                                              />
                                              <span>Upload</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    ) : (
                                      /* Tampilkan pesan sesuai kondisi */
                                      <>
                                        {isDosen && dosen.id === user?.id ? (
                                          /* Untuk dosen: tampilkan informasi mengapa tidak bisa upload */
                                          hasSalahStatus || hasBenarStatus ? (
                                            <div className="p-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                                              {hasSalahStatus ? '✗ File telah ditandai sebagai salah. Tidak dapat upload lagi.' : 
                                               hasBenarStatus ? '✓ File telah ditandai sebagai benar. Tidak dapat upload lagi.' : ''}
                                            </div>
                                          ) : (
                                            <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                                              Belum ada file
                                            </span>
                                          )
                                    ) : (
                                      /* Untuk verifikator/superadmin, tampilkan pesan jika belum ada file */
                                      <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                                        Belum ada file
                                      </span>
                                        )}
                                      </>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 pr-4 py-4 text-center align-middle">
                                  {/* Aksi buttons untuk verifikator/superadmin - hanya muncul sekali per pedoman (aksi diterapkan ke semua file) */}
                                  {(isVerifikator || isSuperAdmin || isKetuaIKD) && buktiFisikFiles.length > 0 ? (
                                    <div className="flex flex-col gap-1 items-center justify-center w-full">
                                      {/* Cek apakah semua file sudah memiliki status_verifikasi */}
                                      {!hasStatusVerifikasi ? (
                                        /* Ambil file pertama untuk mendapatkan info (aksi akan diterapkan ke semua file) */
                                        (() => {
                                          const firstFile = buktiFisikFiles[0];
                                          return (
                                            <div className="flex items-center justify-center gap-1">
                                              <button
                                                onClick={() => handleAksiClick(firstFile.id, 'salah', `Semua file (${buktiFisikFiles.length} file)`)}
                                                className="px-2 py-0.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                                                title="Tandai semua file sebagai salah (skor = 0)"
                                              >
                                                Salah
                                              </button>
                                              <button
                                                onClick={() => handleAksiClick(firstFile.id, 'benar', `Semua file (${buktiFisikFiles.length} file)`)}
                                                className="px-2 py-0.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                                                title="Tandai semua file sebagai benar (bisa dinilai)"
                                              >
                                                Benar
                                              </button>
                                              <button
                                                onClick={() => handleAksiClick(firstFile.id, 'perbaiki', `Semua file (${buktiFisikFiles.length} file)`)}
                                                className="px-2 py-0.5 text-xs font-medium text-white bg-yellow-600 hover:bg-yellow-700 rounded transition-colors"
                                                title="Minta dosen untuk memperbaiki semua file"
                                              >
                                                Perbaiki
                                              </button>
                                            </div>
                                          );
                                        })()
                                      ) : (
                                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                                          Sudah dipilih
                                        </span>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                                      -
                                    </span>
                                  )}
                                </td>
                                <td className="px-2 pr-4 py-4 text-center">
                                  {/* Skor input - hanya verifikator/superadmin yang bisa isi skor */}
                                  {isVerifikator || isSuperAdmin || isKetuaIKD ? (
                                    <input
                                      type="number"
                                      step="0.01"
                                      min="0"
                                      value={skorValue}
                                      onChange={(e) =>
                                        handleSkorChange(
                                          dosen.id,
                                          pedoman.id,
                                          e.target.value
                                        )
                                      }
                                      disabled={!hasStatusVerifikasi || hasSalahStatus || !hasBenarFile}
                                      className={`w-16 px-1.5 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                        !hasStatusVerifikasi || hasSalahStatus || !hasBenarFile
                                          ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-700"
                                          : ""
                                      }`}
                                      placeholder="0"
                                      title={
                                        !hasStatusVerifikasi
                                          ? "Pilih aksi terlebih dahulu (Salah/Benar/Perbaiki)"
                                          : hasSalahStatus
                                          ? "Status salah, skor otomatis 0 dan tidak bisa diubah"
                                          : !hasBenarFile
                                          ? "Pilih aksi 'Benar' terlebih dahulu untuk bisa mengisi skor"
                                          : "Isi skor untuk dosen ini"
                                      }
                                    />
                                  ) : (
                                    /* Untuk dosen, tampilkan skor sebagai read-only */
                                    <span className="text-sm text-gray-600 dark:text-gray-400">
                                      {skorValue}
                                    </span>
                                  )}
                                </td>
                              </React.Fragment>
                            );
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Pagination - hanya tampilkan jika verifikator atau super_admin dan lebih dari 1 halaman */}
              {(isVerifikator || isSuperAdmin) && totalPages > 1 && (
                <div className="bg-gray-50 dark:bg-gray-700 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-600 sm:px-6">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <button
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Sebelumnya
                    </button>
                    <button
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Selanjutnya
                    </button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        Menampilkan{" "}
                        <span className="font-medium">{startIndex + 1}</span>{" "}
                        sampai{" "}
                        <span className="font-medium">
                          {Math.min(endIndex, filteredDosen.length)}
                        </span>{" "}
                        dari{" "}
                        <span className="font-medium">
                          {filteredDosen.length}
                        </span>{" "}
                        hasil
                      </p>
                    </div>
                    <div>
                      <nav
                        className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px"
                        aria-label="Pagination"
                      >
                        <button
                          onClick={() => handlePageChange(currentPage - 1)}
                          disabled={currentPage === 1}
                          className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Sebelumnya</span>
                          <svg
                            className="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                        {Array.from(
                          { length: totalPages },
                          (_, i) => i + 1
                        ).map((page) => {
                          if (
                            page === 1 ||
                            page === totalPages ||
                            (page >= currentPage - 1 && page <= currentPage + 1)
                          ) {
                            return (
                              <button
                                key={page}
                                onClick={() => handlePageChange(page)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  currentPage === page
                                    ? "z-10 bg-blue-50 dark:bg-blue-900/30 border-blue-500 dark:border-blue-500 text-blue-600 dark:text-blue-400"
                                    : "bg-white dark:bg-gray-800 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                                }`}
                              >
                                {page}
                              </button>
                            );
                          } else if (
                            page === currentPage - 2 ||
                            page === currentPage + 2
                          ) {
                            return (
                              <span
                                key={page}
                                className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-300"
                              >
                                ...
                              </span>
                            );
                          }
                          return null;
                        })}
                        <button
                          onClick={() => handlePageChange(currentPage + 1)}
                          disabled={currentPage === totalPages}
                          className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          <span className="sr-only">Selanjutnya</span>
                          <svg
                            className="h-5 w-5"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Modal Info Kegiatan */}
        <AnimatePresence>
          {showKegiatanModal && selectedKegiatan && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-black/40 dark:bg-black/60 backdrop-blur-sm"
                onClick={() => {
                  setShowKegiatanModal(false);
                  setSelectedKegiatan(null);
                }}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="fixed inset-0 z-[100001] flex items-center justify-center pointer-events-none"
              >
                <div
                  className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 px-8 py-8 shadow-xl z-[100001] pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Close Button */}
                  <button
                    onClick={() => {
                      setShowKegiatanModal(false);
                      setSelectedKegiatan(null);
                    }}
                    className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
                  >
                    <FontAwesomeIcon icon={faTimes} />
                  </button>

                  <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
                    {selectedKegiatan.kegiatan}
                  </h2>

                  <div className="space-y-4">
                    {/* Indicators */}
                    {getIndicator(selectedKegiatan) && (
                      <div>
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Indicators:
                        </label>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                          {getIndicator(selectedKegiatan)}
                        </p>
                      </div>
                    )}

                    {/* Indeks Poin */}
                    {selectedKegiatan.indeks_poin !== undefined &&
                      selectedKegiatan.indeks_poin !== null && (
                        <div>
                          <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                            Indeks Poin:
                          </label>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            {selectedKegiatan.indeks_poin}
                          </p>
                        </div>
                      )}

                    {/* Bukti Fisik */}
                    {selectedKegiatan.bukti_fisik && (
                      <div>
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Bukti Fisik:
                        </label>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">
                          {selectedKegiatan.bukti_fisik}
                        </p>
                      </div>
                    )}

                    {/* Prosedur */}
                    {selectedKegiatan.prosedur && (
                      <div>
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                          Prosedur yang dilakukan oleh dosen:
                        </label>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 whitespace-pre-wrap">
                          {selectedKegiatan.prosedur}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Modal Konfirmasi Hapus */}
        <AnimatePresence>
          {showDeleteModal && fileToDelete && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-black/40 dark:bg-black/60 backdrop-blur-sm"
                onClick={() => {
                  setShowDeleteModal(false);
                  setFileToDelete(null);
                }}
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="fixed inset-0 z-[100001] flex items-center justify-center pointer-events-none"
              >
                <div
                  className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-700 px-6 py-6 shadow-xl z-[100001] pointer-events-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Close Button */}
                  <button
                    onClick={() => {
                      setShowDeleteModal(false);
                      setFileToDelete(null);
                    }}
                    className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-4 top-4 h-9 w-9"
                  >
                    <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                  </button>

                  <div className="pr-8">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      Konfirmasi Hapus
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Apakah Anda yakin ingin menghapus file ini?
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                        {fileToDelete.fileName}
                      </p>
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => {
                          setShowDeleteModal(false);
                          setFileToDelete(null);
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleDeleteFile}
                        className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Modal Konfirmasi Aksi */}
        <AnimatePresence>
          {showAksiModal && aksiToConfirm && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={() => {
                  setShowAksiModal(false);
                  setAksiToConfirm(null);
                }}
              />
              {/* Modal Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => {
                    setShowAksiModal(false);
                    setAksiToConfirm(null);
                  }}
                  className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
                >
                  <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
                </button>

                <div>
                  {/* Header */}
                  <div className="flex items-center justify-between pb-4 sm:pb-6">
                    <div className="flex items-center space-x-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg ${
                        aksiToConfirm.status === 'salah' 
                          ? 'bg-red-100 dark:bg-red-900/30'
                          : aksiToConfirm.status === 'benar'
                          ? 'bg-green-100 dark:bg-green-900/30'
                          : 'bg-yellow-100 dark:bg-yellow-900/30'
                      }`}>
                        <FontAwesomeIcon
                          icon={aksiToConfirm.status === 'salah' ? faTimes : aksiToConfirm.status === 'benar' ? faCheckCircle : faExclamationTriangle}
                          className={`w-6 h-6 ${
                            aksiToConfirm.status === 'salah' 
                              ? 'text-red-600 dark:text-red-400'
                              : aksiToConfirm.status === 'benar'
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-yellow-600 dark:text-yellow-400'
                          }`}
                        />
                      </div>
                      <div>
                        <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                          Konfirmasi Aksi
                        </h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {aksiToConfirm.status === 'salah' 
                            ? 'Tandai file sebagai salah'
                            : aksiToConfirm.status === 'benar'
                            ? 'Tandai file sebagai benar'
                            : 'Minta dosen untuk memperbaiki file'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* File Info Card */}
                  <div className={`mb-6 p-6 border rounded-2xl ${
                    aksiToConfirm.status === 'salah' 
                      ? 'bg-gradient-to-r from-red-50 to-pink-50 dark:from-red-900/20 dark:to-pink-900/20 border-red-200 dark:border-red-700'
                      : aksiToConfirm.status === 'benar'
                      ? 'bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border-green-200 dark:border-green-700'
                      : 'bg-gradient-to-r from-yellow-50 to-amber-50 dark:from-yellow-900/20 dark:to-amber-900/20 border-yellow-200 dark:border-yellow-700'
                  }`}>
                    <div className="flex items-center space-x-3 mb-4">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        aksiToConfirm.status === 'salah' 
                          ? 'bg-red-500'
                          : aksiToConfirm.status === 'benar'
                          ? 'bg-green-500'
                          : 'bg-yellow-500'
                      }`}>
                        <FontAwesomeIcon
                          icon={faFile}
                          className="w-5 h-5 text-white"
                        />
                      </div>
                      <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                        File
                      </h4>
                    </div>
                    <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white break-words">
                        {aksiToConfirm.fileName}
                      </p>
                    </div>
                  </div>

                  {/* Keterangan */}
                  <div className="mb-6">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {aksiToConfirm.status === 'salah' 
                        ? 'Semua file akan ditandai sebagai salah. Skor akan otomatis menjadi 0 dan tidak dapat diubah. Dosen tidak dapat upload file lagi untuk kegiatan ini.'
                        : aksiToConfirm.status === 'benar'
                        ? 'Semua file akan ditandai sebagai benar. Anda dapat memberikan skor untuk file-file ini. Dosen tidak dapat upload file lagi untuk kegiatan ini.'
                        : 'Semua file akan dihapus dan dosen harus upload ulang. Dosen akan mendapat notifikasi untuk memperbaiki file.'}
                    </p>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex gap-3 justify-end">
                    <button
                      onClick={() => {
                        setShowAksiModal(false);
                        setAksiToConfirm(null);
                      }}
                      className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleConfirmAksi}
                      className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${
                        aksiToConfirm.status === 'salah' 
                          ? 'bg-red-600 hover:bg-red-700'
                          : aksiToConfirm.status === 'benar'
                          ? 'bg-green-600 hover:bg-green-700'
                          : 'bg-yellow-600 hover:bg-yellow-700'
                      }`}
                    >
                      {aksiToConfirm.status === 'salah' 
                        ? 'Tandai sebagai Salah'
                        : aksiToConfirm.status === 'benar'
                        ? 'Tandai sebagai Benar'
                        : 'Minta Perbaiki'}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </RekapIKDBase>
  );
};

export default DosenIKD;
