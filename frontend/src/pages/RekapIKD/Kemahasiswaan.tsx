import React, { useState, useEffect, useCallback, useRef } from "react";
import RekapIKDBase from "./RekapIKDBase";
import api from "../../utils/api";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUpload,
  faDownload,
  faTrash,
  faSpinner,
  faTimes,
  faInfoCircle,
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
  pedoman?: IKDPedoman;
}

// Helper function to download file using API endpoint
const handleDownloadFile = async (fileId: number, fileName: string) => {
  try {
    const response = await api.get(`/rekap-ikd/bukti-fisik/${fileId}/download`, {
      responseType: 'blob',
    });
    
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

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

const Kemahasiswaan: React.FC = () => {
  const [dosenList, setDosenList] = useState<DosenData[]>([]);
  const [filteredDosen, setFilteredDosen] = useState<DosenData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  // State untuk pedoman poin IKD
  const [pedomanList, setPedomanList] = useState<IKDPedoman[]>([]);
  const [loadingPedoman, setLoadingPedoman] = useState(true);

  // Unit kerja untuk filter
  const unitKerja = "Kemahasiswaan";

  // State untuk bukti fisik (realtime)
  const [buktiFisikMap, setBuktiFisikMap] = useState<{
    [key: string]: IKDBuktiFisik;
  }>({}); // Key: `${user_id}_${ikd_pedoman_id}`

  // State untuk upload file
  const [uploadingFiles, setUploadingFiles] = useState<{
    [key: string]: boolean;
  }>({}); // Key: `${user_id}_${ikd_pedoman_id}`

  // State untuk popup info kegiatan
  const [showKegiatanModal, setShowKegiatanModal] = useState(false);
  const [selectedKegiatan, setSelectedKegiatan] = useState<IKDPedoman | null>(null);

  // State untuk delete confirmation modal

  // State untuk skor values (untuk input fields)
  const [skorValues, setSkorValues] = useState<{
    [key: string]: string;
  }>({}); // Key: `${user_id}_${ikd_pedoman_id}`

  // Refs untuk debounce timers
  const skorDebounceTimers = useRef<{ [key: string]: NodeJS.Timeout }>({});

  // Refs untuk deleted file IDs (untuk mencegah file yang sudah dihapus muncul lagi)
  const deletedFileIdsRef = useRef<Set<number>>(new Set());
  const deletedKeysRef = useRef<Set<string>>(new Set()); // Key: `${user_id}_${ikd_pedoman_id}`

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

  // State untuk menyimpan parent items (level 0) untuk indicators
  const [parentItemsMap, setParentItemsMap] = useState<Map<number, IKDPedoman>>(
    new Map()
  );

  // Fetch pedoman poin IKD berdasarkan unit kerja
  const fetchPedomanPoin = useCallback(async () => {
    try {
      setLoadingPedoman(true);
      const res = await api.get(`/rekap-ikd/pedoman-poin/unit/${unitKerja}`);
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
            const fetchParentsRecursive = async (ids: number[]): Promise<Map<number, IKDPedoman>> => {
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
                    if (item.parent_id && !map.has(item.parent_id) && !allParentIds.has(item.parent_id)) {
                      allParentIds.add(item.parent_id);
                    }
                  }
                });
              }
              
              // Check if we need to fetch more parents
              const newParentIds = Array.from(allParentIds).filter(id => !map.has(id));
              if (newParentIds.length > 0) {
                const nestedMap = await fetchParentsRecursive(newParentIds);
                nestedMap.forEach((value, key) => map.set(key, value));
              }
              
              return map;
            };

            const parentMap = await fetchParentsRecursive(Array.from(allParentIds));
            setParentItemsMap(parentMap);
          } catch (err) {
            console.error("Error fetching parent items:", err);
          }
        }
      }
    } catch (error) {
      console.error("Error fetching pedoman poin:", error);
      setPedomanList([]);
    } finally {
      setLoadingPedoman(false);
    }
  }, [unitKerja]);

  // Fetch bukti fisik (realtime)
  const fetchBuktiFisik = useCallback(async () => {
    try {
      const res = await api.get(`/rekap-ikd/bukti-fisik?unit=${unitKerja}`);
      if (res.data?.success && res.data?.data) {
        const buktiFisikArray: IKDBuktiFisik[] = res.data.data;
        const newMap: { [key: string]: IKDBuktiFisik } = {};
        buktiFisikArray.forEach((bf) => {
          const key = `${bf.user_id}_${bf.ikd_pedoman_id}`;
          newMap[key] = bf;
        });

        const currentDeletedKeys = deletedKeysRef.current;
        const filteredMap: { [key: string]: IKDBuktiFisik } = {};

        Object.keys(newMap).forEach((key) => {
          const bf = newMap[key];
          if (!currentDeletedKeys.has(key)) {
            filteredMap[key] = bf;
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
            
            const bf = filteredMap[key];
            const currentSkor = bf.skor?.toString() || "0";
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
    } catch {
      // Silent fail untuk realtime update
    }
  }, [unitKerja]);

  // Fetch data dosen
  useEffect(() => {
    const fetchDosen = async () => {
      try {
        setLoading(true);
        const res = await api.get("/users?role=dosen");
        let data: DosenData[] = [];
        if (Array.isArray(res.data)) {
          data = res.data;
        } else if (res.data?.data && Array.isArray(res.data.data)) {
          data = res.data.data;
        }
        setDosenList(data);
        setFilteredDosen(data);
      } catch (error) {
        console.error("Error fetching dosen:", error);
        setDosenList([]);
        setFilteredDosen([]);
      } finally {
        setLoading(false);
      }
    };

    fetchDosen();
    fetchPedomanPoin();
    loadDeletedKeys();
  }, [fetchPedomanPoin, loadDeletedKeys]);

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
      setPage(1);
      return;
    }
    const query = searchQuery.toLowerCase().trim();
    const filtered = dosenList.filter((dosen) => {
      return dosen.name?.toLowerCase().includes(query);
    });
    setFilteredDosen(filtered);
    setPage(1);
  }, [searchQuery, dosenList]);

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
          setBuktiFisikMap((prev) => {
            const updated = { ...prev };
            if (updated[key]) {
              updated[key] = {
                ...updated[key],
                skor: skorValue,
              };
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
          const currentBuktiFisik = buktiFisikMap[key];
          if (currentBuktiFisik) {
            setSkorValues((prev) => ({
              ...prev,
              [key]: currentBuktiFisik.skor?.toString() || "",
            }));
          }
        }
      }, 500);
    },
    [buktiFisikMap, unitKerja]
  );

  // Handle file upload
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
          setBuktiFisikMap((prev) => ({
            ...prev,
            [key]: {
              id: uploadedBuktiFisik.id,
              user_id: uploadedBuktiFisik.user_id,
              ikd_pedoman_id: uploadedBuktiFisik.ikd_pedoman_id,
              file_path: uploadedBuktiFisik.file_path,
              file_name: uploadedBuktiFisik.file_name,
              file_type: uploadedBuktiFisik.file_type,
              file_size: uploadedBuktiFisik.file_size,
              file_url: uploadedBuktiFisik.file_url,
              skor: uploadedBuktiFisik.skor || 0,
              pedoman: uploadedBuktiFisik.pedoman,
            },
          }));

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
  const handleDeleteClick = async (buktiFisikId: number, fileName: string) => {
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin menghapus file "${fileName}"?`
    );
    if (!confirmed) return;

    await handleDeleteFile(buktiFisikId, fileName);
  };

  // Handle delete file
  const handleDeleteFile = async (buktiFisikId: number, fileName: string) => {
    try {
      const deletedBuktiFisik = Object.values(buktiFisikMap).find(
        (bf) => bf.id === buktiFisikId
      );

      if (!deletedBuktiFisik) {
        console.error("BuktiFisik not found for deletion");
        return;
      }

      const key = `${deletedBuktiFisik.user_id}_${deletedBuktiFisik.ikd_pedoman_id}`;

      // Tandai KEY sebagai dihapus untuk mencegah file baru muncul untuk key yang sama
      const newDeletedKeysSet = new Set(deletedKeysRef.current);
      newDeletedKeysSet.add(key);
      deletedKeysRef.current = newDeletedKeysSet;
      await saveDeletedKey(key);

      // Reset skor ke 0 di backend dulu
      try {
        await api.post("/rekap-ikd/bukti-fisik/update-skor", {
          user_id: deletedBuktiFisik.user_id,
          ikd_pedoman_id: deletedBuktiFisik.ikd_pedoman_id,
          unit: unitKerja,
          skor: 0,
        });
      } catch (skorError) {
        console.error("Error resetting skor:", skorError);
      }

      // Hapus file dari backend
      const res = await api.delete(
        `/rekap-ikd/bukti-fisik/${buktiFisikId}`
      );
      if (res.data?.success) {
        // Langsung update local state: hapus dari buktiFisikMap dan reset skor
        setBuktiFisikMap((prev) => {
          const newMap = { ...prev };
          delete newMap[key];
          return newMap;
        });

        // Reset skor ke 0 di local state
        setSkorValues((prev) => ({
          ...prev,
          [key]: "0",
        }));

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
      const isMainNumber = !currentNumber.includes(".") && !/[a-z]$/i.test(currentNumber);
      if (isMainNumber) {
        // Jika item utama punya isi, indicators = "-"
        return "-";
      }
    }

    // Jika item punya isi, cari parent yang tidak punya isi (ambil yang PALING DEKAT)
    if (hasContent(pedoman)) {
      // Helper function untuk mencari parent yang tidak punya content (recursive)
      const findParentWithoutContent = (currentPedoman: IKDPedoman): IKDPedoman | null => {
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
          const parentInList = pedomanList.find((item) => item.id === currentPedoman.parent_id);
          if (parentInList) {
            if (!hasContent(parentInList)) {
              return parentInList;
            } else {
              return findParentWithoutContent(parentInList);
            }
          }
        }
        
        // Fallback: cari berdasarkan nomor (untuk backward compatibility)
        const match = currentPedoman.kegiatan.match(/^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/);
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
            const itemMatch = item.kegiatan.match(/^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/);
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
      const findParentWithContent = (currentPedoman: IKDPedoman): IKDPedoman | null => {
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
          const parentInList = pedomanList.find((item) => item.id === currentPedoman.parent_id);
          if (parentInList) {
            if (hasContent(parentInList)) {
              return parentInList;
            } else {
              return findParentWithContent(parentInList);
            }
          }
        }
        
        // Fallback: cari berdasarkan nomor (untuk backward compatibility)
        const match = currentPedoman.kegiatan.match(/^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/);
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
            const itemMatch = item.kegiatan.match(/^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/);
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
  const totalPages = Math.ceil(filteredDosen.length / pageSize);
  const paginatedDosen = filteredDosen.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  return (
    <RekapIKDBase
      title="Rekap IKD - Kemahasiswaan"
      description="Rekap Indikator Kinerja Dosen untuk Kemahasiswaan"
    >
      <div className="w-full mx-auto space-y-6">
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

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white/90 mb-1">
              Tabel Rekap IKD - Kemahasiswaan
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Kelola rekap IKD untuk unit kerja Kemahasiswaan
            </p>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="w-full lg:w-96">
              <div className="relative">
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
                  placeholder="Cari dosen (nama)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                />
              </div>
            </div>
            <div className="text-sm text-gray-600 dark:text-gray-400">
              {filteredDosen.length} dosen ditemukan
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-white/[0.03] rounded-b-xl shadow-md border border-gray-200 dark:border-gray-800">
          <div className="p-6">
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
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                <div
                  className="max-w-full overflow-x-auto hide-scroll"
                  style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                >
                  <style>{`
                    .max-w-full::-webkit-scrollbar { display: none; }
                    .hide-scroll { 
                      -ms-overflow-style: none; /* IE and Edge */
                      scrollbar-width: none; /* Firefox */
                    }
                    .hide-scroll::-webkit-scrollbar { /* Chrome, Safari, Opera */
                      display: none;
                    }
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
                          <th className="px-2 pr-4 py-4 text-center text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider w-20">
                            Skor
                          </th>
                        </React.Fragment>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedDosen.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2 + pedomanList.length * 2}
                          className="text-center py-8 text-gray-400 dark:text-gray-500"
                        >
                          Belum ada data.
                        </td>
                      </tr>
                    ) : (
                      paginatedDosen.map((dosen, idx) => (
                        <tr
                          key={dosen.id}
                          className={
                            idx % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""
                          }
                        >
                          <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                            {(page - 1) * pageSize + idx + 1}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                            {dosen.name || "-"}
                          </td>
                          {pedomanList.map((pedoman, index) => {
                            const key = `${dosen.id}_${pedoman.id}`;
                            const buktiFisik = buktiFisikMap[key];
                            const isUploading = uploadingFiles[key] || false;
                            const fileInputKey = `file_${key}`;
                            const skorValue = buktiFisik
                              ? skorValues[key] ??
                                buktiFisik.skor?.toString() ??
                                "0"
                              : "0";

                            return (
                              <React.Fragment key={pedoman.id}>
                                <td
                                  className={`px-6 ${
                                    index > 0 ? "pl-8" : ""
                                  } pr-2 py-4 text-gray-800 dark:text-white/90 align-middle`}
                                >
                                  <div className="flex flex-col gap-2">
                                    {buktiFisik ? (
                                      <div className="flex items-center gap-2">
                                        <button
                                          onClick={() => handleDownloadFile(buktiFisik.id, buktiFisik.file_name)}
                                          className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:underline"
                                          title={buktiFisik.file_name}
                                        >
                                          <FontAwesomeIcon icon={faDownload} />
                                          <span className="text-xs truncate max-w-[150px]">
                                            {buktiFisik.file_name}
                                          </span>
                                        </button>
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
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-2">
                                        <input
                                          ref={(el) => {
                                            fileInputRefs.current[
                                              fileInputKey
                                            ] = el;
                                          }}
                                          type="file"
                                          accept=".pdf,.xlsx,.xls,.docx,.doc,.ppt,.pptx,.jpg,.jpeg,.png,.gif,.zip,.rar"
                                          className="hidden"
                                          onChange={(e) => {
                                            const file = e.target.files?.[0];
                                            if (file) {
                                              handleFileUpload(
                                                dosen.id,
                                                pedoman.id,
                                                file
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
                                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                          {isUploading ? (
                                            <>
                                              <FontAwesomeIcon
                                                icon={faSpinner}
                                                className="w-4 h-4 animate-spin"
                                              />
                                              <span className="hidden sm:inline">Uploading...</span>
                                            </>
                                          ) : (
                                            <>
                                              <FontAwesomeIcon
                                                icon={faUpload}
                                                className="w-4 h-4 sm:w-5 sm:h-5"
                                              />
                                              <span className="hidden sm:inline">Upload</span>
                                            </>
                                          )}
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 pr-4 py-4 text-center align-middle">
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
                                    disabled={!buktiFisik}
                                    className={`w-16 px-1.5 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${
                                      !buktiFisik
                                        ? "opacity-50 cursor-not-allowed bg-gray-100 dark:bg-gray-700"
                                        : ""
                                    }`}
                                    placeholder="0"
                                    title={
                                      !buktiFisik
                                        ? "Upload file terlebih dahulu untuk mengisi skor"
                                        : ""
                                    }
                                  />
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

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-4">
                  <div className="flex items-center gap-4">
                    <select
                      id="perPage"
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setPage(1);
                      }}
                      className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none"
                    >
                      {PAGE_SIZE_OPTIONS.map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Menampilkan {paginatedDosen.length} dari {filteredDosen.length} data
                    </span>
                  </div>
                  {totalPages > 1 && (
                    <div className="flex items-center gap-2 justify-center sm:justify-end">
                      <button
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                      >
                        Prev
                      </button>

                      {/* Smart Pagination with Scroll */}
                      <div
                        className="flex items-center gap-1 max-w-[400px] overflow-x-auto pagination-scroll"
                        style={{
                          scrollbarWidth: "thin",
                          scrollbarColor: "#cbd5e1 #f1f5f9",
                        }}
                      >
                        <style
                          dangerouslySetInnerHTML={{
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
                          `,
                          }}
                        />

                        {/* Always show first page */}
                        <button
                          onClick={() => setPage(1)}
                          className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                            page === 1
                              ? "bg-brand-500 text-white"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                          }`}
                        >
                          1
                        </button>

                        {/* Show ellipsis if current page is far from start */}
                        {page > 4 && (
                          <span className="px-2 text-gray-500 dark:text-gray-400">
                            ...
                          </span>
                        )}

                        {/* Show pages around current page */}
                        {Array.from({ length: totalPages }, (_, i) => {
                          const pageNum = i + 1;
                          // Show pages around current page (2 pages before and after)
                          const shouldShow =
                            pageNum > 1 &&
                            pageNum < totalPages &&
                            pageNum >= page - 2 &&
                            pageNum <= page + 2;

                          if (!shouldShow) return null;

                          return (
                            <button
                              key={i}
                              onClick={() => setPage(pageNum)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                                page === pageNum
                                  ? "bg-brand-500 text-white"
                                  : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              }`}
                            >
                              {pageNum}
                            </button>
                          );
                        })}

                        {/* Show ellipsis if current page is far from end */}
                        {page < totalPages - 3 && (
                          <span className="px-2 text-gray-500 dark:text-gray-400">
                            ...
                          </span>
                        )}

                        {/* Always show last page if it's not the first page */}
                        {totalPages > 1 && (
                          <button
                            onClick={() => setPage(totalPages)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                              page === totalPages
                                ? "bg-brand-500 text-white"
                                : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
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
                  )}
                </div>
              </div>
            </>
          )}
            </div>
          </div>
        </div>

        {/* Modal Info Kegiatan */}
        <AnimatePresence>
          {showKegiatanModal && selectedKegiatan && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={() => {
                  setShowKegiatanModal(false);
                  setSelectedKegiatan(null);
                }}
              />
              {/* Modal Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
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
                      {selectedKegiatan.kegiatan}
                    </h2>
                  </div>

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
            </div>
          )}
        </AnimatePresence>

      </div>
    </RekapIKDBase>
  );
};

export default Kemahasiswaan;
