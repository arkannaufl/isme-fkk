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
  status_verifikasi?: "salah" | "benar" | "perbaiki" | null;
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

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

const DosenIKD: React.FC = () => {
  const [dosenList, setDosenList] = useState<DosenData[]>([]);
  const [filteredDosen, setFilteredDosen] = useState<DosenData[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [loading, setLoading] = useState(true);

  // State untuk pembagian beban kerja
  const [unitAccounts, setUnitAccounts] = useState<any[]>([]);

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
    name: string;
  } | null>(null);

  // State untuk aksi confirmation modal
  const [showAksiModal, setShowAksiModal] = useState(false);
  const [aksiToConfirm, setAksiToConfirm] = useState<{
    id: number;
    status: "salah" | "benar" | "perbaiki";
    fileName: string;
    description: string;
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
      const url = `/rekap-ikd/bukti-fisik?unit=${unitKerja}${userId ? `&user_id=${userId}` : ""
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
              const benarFile = files.find(
                (f) => f.status_verifikasi === "benar"
              );
              if (
                benarFile &&
                benarFile.skor !== null &&
                benarFile.skor !== undefined
              ) {
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
        const cacheKey = `dosen_ikd_${user?.id || "all"}_${isDosen ? "dosen" : isVerifikator ? "verifikator" : "admin"
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
          const res = await api.get("/users", { params: { role: "dosen", per_page: 2000 } });
          // Handle pagination response
          let rawDosen: DosenData[] = [];
          if (Array.isArray(res.data)) {
            rawDosen = res.data;
          } else if (res.data?.data && Array.isArray(res.data.data)) {
            rawDosen = res.data.data;
          } else if (
            res.data?.data?.data &&
            Array.isArray(res.data.data.data)
          ) {
            rawDosen = res.data.data.data;
          }

          // Distribusi untuk Verifikator
          if (isVerifikator && user?.id) {
            let sameRoleAccounts: any[] = [];
            const resAcc = await api.get("/users", { params: { role: "verifikator", per_page: 100 } });
            if (Array.isArray(resAcc.data)) {
              sameRoleAccounts = resAcc.data;
            } else if (resAcc.data?.data && Array.isArray(resAcc.data.data)) {
              sameRoleAccounts = resAcc.data.data;
            }
            sameRoleAccounts.sort((a, b) => a.id - b.id);
            setUnitAccounts(sameRoleAccounts);

            const myIndex = sameRoleAccounts.findIndex((acc: any) => acc.id === user.id);
            if (myIndex !== -1) {
              const distributed = rawDosen.filter((_, index) => index % sameRoleAccounts.length === myIndex);
              setDosenList(distributed);
              setFilteredDosen(distributed);
              sessionStorage.setItem(cacheKey, JSON.stringify(distributed));
            } else {
              setDosenList(rawDosen);
              setFilteredDosen(rawDosen);
              sessionStorage.setItem(cacheKey, JSON.stringify(rawDosen));
            }
          } else {
            // Super Admin & Ketua IKD melihat semua
            setDosenList(rawDosen);
            setFilteredDosen(rawDosen);
            sessionStorage.setItem(cacheKey, JSON.stringify(rawDosen));
          }
        }
        else {
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

  // Handle klik tombol aksi (tampilkan modal konfirmasi)
  const handleAksiClick = (
    buktiFisikId: number,
    status: "salah" | "benar" | "perbaiki",
    fileName: string
  ) => {
    // Find file untuk mendapatkan nama file
    let foundFileName = fileName;
    for (const files of Object.values(buktiFisikMap)) {
      const file = files.find((f) => f.id === buktiFisikId);
      if (file) {
        foundFileName = file.file_name;
        break;
      }
    }

    // Buat pesan konfirmasi berdasarkan status
    let description = "";

    if (status === "salah") {
      description =
        "Semua file akan ditandai sebagai salah. Skor akan otomatis menjadi 0 dan tidak dapat diubah. Dosen tidak dapat upload file lagi untuk kegiatan ini.";
    } else if (status === "benar") {
      description =
        "Semua file akan ditandai sebagai benar. Anda dapat memberikan skor untuk file-file ini. Dosen tidak dapat upload file lagi untuk kegiatan ini.";
    } else {
      description =
        "Semua file akan dihapus dan dosen harus upload ulang. Dosen akan mendapat notifikasi untuk memperbaiki file.";
    }

    // Tampilkan modal konfirmasi
    setAksiToConfirm({
      id: buktiFisikId,
      status,
      fileName: foundFileName,
      description,
    });
    setShowAksiModal(true);
  };

  // Confirm aksi verifikasi
  const confirmAksi = async () => {
    if (!aksiToConfirm) return;

    await handleUpdateStatusVerifikasi(aksiToConfirm.id, aksiToConfirm.status);
    setShowAksiModal(false);
    setAksiToConfirm(null);
  };

  // Handle update status verifikasi
  const handleUpdateStatusVerifikasi = useCallback(
    async (buktiFisikId: number, status: "salah" | "benar" | "perbaiki") => {
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

        const res = await api.post(
          "/rekap-ikd/bukti-fisik/update-status-verifikasi",
          {
            bukti_fisik_id: buktiFisikId,
            status_verifikasi: status,
          }
        );

        if (res.data?.success) {
          // Jika status = 'perbaiki', hapus semua file dari state
          if (status === "perbaiki") {
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

            setSuccessMessage(
              "Semua file telah dihapus. Dosen harus upload ulang."
            );
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
                    skor: status === "salah" ? 0 : file.skor,
                  }));
                }
                return newMap;
              });

              // Jika status = 'salah', update skor ke 0
              if (status === "salah") {
                setSkorValues((prev) => ({
                  ...prev,
                  [fileKey]: "0",
                }));
              }
            }

            setSuccessMessage(
              `Status verifikasi berhasil diupdate menjadi "${status}" untuk semua file`
            );
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
              const benarFileIndex = files.findIndex(
                (f) => f.status_verifikasi === "benar"
              );
              if (benarFileIndex !== -1) {
                files[benarFileIndex] = {
                  ...files[benarFileIndex],
                  skor: skorValue,
                };
              } else {
                // Jika tidak ada yang 'benar', update file terbaru (id terbesar)
                const latestIndex = files.reduce(
                  (maxIdx, file, idx) =>
                    file.id > files[maxIdx].id ? idx : maxIdx,
                  0
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
            const benarFile = currentFiles.find(
              (f) => f.status_verifikasi === "benar"
            );
            const fileToUse =
              benarFile || currentFiles.sort((a, b) => b.id - a.id)[0];
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
                  status_verifikasi:
                    uploadedBuktiFisik.status_verifikasi || null,
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
    // Tampilkan modal konfirmasi (karena delete dari table, bukan dari modal)
    setFileToDelete({ id: buktiFisikId, name: fileName });
    setShowDeleteModal(true);
  };

  const confirmDeleteFile = async () => {
    if (!fileToDelete) return;

    await handleDeleteFile(fileToDelete.id, fileToDelete.name);
    setShowDeleteModal(false);
    setFileToDelete(null);
  };

  // Handle delete file
  const handleDeleteFile = async (buktiFisikId: number, fileName: string) => {
    try {
      // Find the file in buktiFisikMap
      let deletedBuktiFisik: IKDBuktiFisik | null = null;
      let fileKey = "";

      for (const [key, files] of Object.entries(buktiFisikMap)) {
        const file = files.find((bf) => bf.id === buktiFisikId);
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
      const res = await api.delete(`/rekap-ikd/bukti-fisik/${buktiFisikId}`);
      if (res.data?.success) {
        // Langsung update local state: hapus file spesifik dari array
        setBuktiFisikMap((prev) => {
          const newMap = { ...prev };
          if (newMap[fileKey]) {
            const filteredFiles = newMap[fileKey].filter(
              (bf) => bf.id !== buktiFisikId
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
            return (
              itemNumber === currentNumber &&
              item.bidang === currentPedoman.bidang &&
              (item.level === 0 || item.level === undefined) &&
              (!item.parent_id || item.parent_id === null)
            );
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
            return (
              itemNumber === currentNumber &&
              item.bidang === currentPedoman.bidang &&
              (item.level === 0 || item.level === undefined) &&
              (!item.parent_id || item.parent_id === null)
            );
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
      title="Rekap IKD - Dosen"
      description="Rekap Indikator Kinerja Dosen untuk Dosen"
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
              Tabel Rekap IKD - Dosen
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Kelola rekap IKD untuk unit kerja Dosen
            </p>
          </div>
        </div>

        {/* Search Bar - hanya tampilkan jika verifikator atau super_admin */}
        {(isVerifikator || isSuperAdmin || isKetuaIKD) && (
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
        )}

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
                      style={{
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                      }}
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
                                  className={`px-4 ${index > 0 ? "pl-8" : ""
                                    } pr-2 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative group`}
                                  onClick={() =>
                                    handleKegiatanHeaderClick(pedoman)
                                  }
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
                                  idx % 2 === 1
                                    ? "bg-gray-50 dark:bg-white/[0.02]"
                                    : ""
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
                                  const buktiFisikFiles =
                                    buktiFisikMap[key] || [];
                                  const isUploading =
                                    uploadingFiles[key] || false;
                                  const fileInputKey = `file_${key}`;

                                  // Get skor value (prioritize file with status_verifikasi = 'benar')
                                  let skorValue = "0";
                                  if (buktiFisikFiles.length > 0) {
                                    const benarFile = buktiFisikFiles.find(
                                      (f) => f.status_verifikasi === "benar"
                                    );
                                    if (
                                      benarFile &&
                                      benarFile.skor !== null &&
                                      benarFile.skor !== undefined
                                    ) {
                                      skorValue = benarFile.skor.toString();
                                    } else {
                                      const latestFile = buktiFisikFiles.sort(
                                        (a, b) => b.id - a.id
                                      )[0];
                                      skorValue =
                                        skorValues[key] ??
                                        latestFile.skor?.toString() ??
                                        "0";
                                    }
                                  }

                                  // Check status untuk menentukan apakah bisa upload
                                  const hasSalahStatus = buktiFisikFiles.some(
                                    (f) => f.status_verifikasi === "salah"
                                  );
                                  const hasBenarStatus = buktiFisikFiles.some(
                                    (f) => f.status_verifikasi === "benar"
                                  );
                                  const hasPerbaikiStatus =
                                    buktiFisikFiles.some(
                                      (f) => f.status_verifikasi === "perbaiki"
                                    );
                                  // Dosen tidak bisa upload jika ada status 'salah' atau 'benar'
                                  const canUpload =
                                    isDosen &&
                                    dosen.id === user?.id &&
                                    !hasSalahStatus &&
                                    !hasBenarStatus;

                                  // Check apakah ada file dengan status verifikasi
                                  const hasStatusVerifikasi =
                                    buktiFisikFiles.some(
                                      (f) =>
                                        f.status_verifikasi !== null &&
                                        f.status_verifikasi !== undefined
                                    );
                                  // Check apakah ada file dengan status 'benar' (bisa isi skor)
                                  const hasBenarFile = buktiFisikFiles.some(
                                    (f) => f.status_verifikasi === "benar"
                                  );

                                  // Limit files untuk display (max 3, sisanya bisa expand)
                                  const maxVisibleFiles = 3;
                                  const isExpanded =
                                    expandedFiles[key] || false;
                                  const visibleFiles = isExpanded
                                    ? buktiFisikFiles
                                    : buktiFisikFiles.slice(0, maxVisibleFiles);
                                  const hasMoreFiles =
                                    buktiFisikFiles.length > maxVisibleFiles;

                                  return (
                                    <React.Fragment key={pedoman.id}>
                                      <td
                                        className={`px-6 ${index > 0 ? "pl-8" : ""
                                          } pr-2 py-4 text-gray-800 dark:text-white/90 align-middle`}
                                      >
                                        <div className="flex flex-col gap-2">
                                          {buktiFisikFiles.length > 0 ? (
                                            <>
                                              {/* Multiple files display */}
                                              {visibleFiles.map(
                                                (buktiFisik) => (
                                                  <div
                                                    key={buktiFisik.id}
                                                    className="flex flex-col gap-1"
                                                  >
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
                                                        title={
                                                          buktiFisik.file_name
                                                        }
                                                      >
                                                        <FontAwesomeIcon
                                                          icon={faDownload}
                                                        />
                                                        <span className="text-xs truncate max-w-[150px]">
                                                          {buktiFisik.file_name}
                                                        </span>
                                                      </button>
                                                      {/* Delete button - hanya dosen yang bisa hapus file sendiri */}
                                                      {isDosen &&
                                                        dosen.id ===
                                                        user?.id && (
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
                                                            <FontAwesomeIcon
                                                              icon={faTrash}
                                                            />
                                                          </button>
                                                        )}
                                                    </div>

                                                    {/* Status badge */}
                                                    {buktiFisik.status_verifikasi && (
                                                      <span
                                                        className={`text-xs px-2 py-0.5 rounded ${buktiFisik.status_verifikasi ===
                                                          "benar"
                                                          ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                                                          : buktiFisik.status_verifikasi ===
                                                            "salah"
                                                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                                                            : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400"
                                                          }`}
                                                      >
                                                        {buktiFisik.status_verifikasi ===
                                                          "benar"
                                                          ? "✓ Benar"
                                                          : buktiFisik.status_verifikasi ===
                                                            "salah"
                                                            ? "✗ Salah"
                                                            : "⚠ Perbaiki"}
                                                      </span>
                                                    )}
                                                  </div>
                                                )
                                              )}

                                              {/* Show more/less button jika file lebih dari 3 */}
                                              {hasMoreFiles && (
                                                <button
                                                  onClick={() =>
                                                    setExpandedFiles(
                                                      (prev) => ({
                                                        ...prev,
                                                        [key]: !prev[key],
                                                      })
                                                    )
                                                  }
                                                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline mt-1"
                                                >
                                                  {isExpanded
                                                    ? "Lihat lebih sedikit"
                                                    : `Lihat ${buktiFisikFiles.length -
                                                    maxVisibleFiles
                                                    } file lagi`}
                                                </button>
                                              )}
                                            </>
                                          ) : null}

                                          {/* Upload button - hanya dosen yang bisa upload untuk dirinya sendiri */}
                                          {/* Bisa upload jika: belum ada file, atau semua file status-nya null */}
                                          {canUpload ? (
                                            <div className="flex flex-col gap-1 items-start">
                                              <div className="flex items-center gap-2">
                                                <input
                                                  ref={(el) => {
                                                    fileInputRefs.current[
                                                      fileInputKey
                                                    ] = el;
                                                  }}
                                                  type="file"
                                                  accept=".pdf,.xlsx,.xls,.xlsm,.docx,.doc,.docm,.ppt,.pptx,.pptm,.jpg,.jpeg,.png,.gif,.zip,.rar"
                                                  multiple
                                                  className="hidden"
                                                  onChange={(e) => {
                                                    const files = e.target.files;
                                                    if (
                                                      files &&
                                                      files.length > 0
                                                    ) {
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
                                                  className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                >
                                                  {isUploading ? (
                                                    <>
                                                      <FontAwesomeIcon
                                                        icon={faSpinner}
                                                        className="w-4 h-4 animate-spin"
                                                      />
                                                      <span className="hidden sm:inline">
                                                        Uploading...
                                                      </span>
                                                    </>
                                                  ) : (
                                                    <>
                                                      <FontAwesomeIcon
                                                        icon={faUpload}
                                                        className="w-4 h-4 sm:w-5 sm:h-5"
                                                      />
                                                      <span className="hidden sm:inline">
                                                        Upload
                                                      </span>
                                                    </>
                                                  )}
                                                </button>
                                              </div>
                                              <span className="text-xs font-bold text-gray-700 dark:text-gray-300">Upload Bukti Fisik</span>
                                              <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">(PDF, Word, Excel, Gambar)</span>
                                            </div>
                                          ) : (
                                            /* Tampilkan pesan sesuai kondisi */
                                            <>
                                              {isDosen &&
                                                dosen.id === user?.id ? (
                                                /* Untuk dosen: tampilkan informasi mengapa tidak bisa upload */
                                                hasSalahStatus ||
                                                  hasBenarStatus ? (
                                                  <div className="p-2 bg-gray-50 dark:bg-gray-800/60 border border-gray-200 dark:border-gray-700 rounded text-xs text-gray-600 dark:text-gray-400">
                                                    {hasSalahStatus
                                                      ? "✗ File telah ditandai sebagai salah. Tidak dapat upload lagi."
                                                      : hasBenarStatus
                                                        ? "✓ File telah ditandai sebagai benar. Tidak dapat upload lagi."
                                                        : ""}
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
                                        {(isVerifikator ||
                                          isSuperAdmin ||
                                          isKetuaIKD) &&
                                          buktiFisikFiles.length > 0 ? (
                                          <div className="flex flex-col gap-1 items-center justify-center w-full">
                                            {/* Cek apakah semua file sudah memiliki status_verifikasi */}
                                            {!hasStatusVerifikasi ? (
                                              /* Ambil file pertama untuk mendapatkan info (aksi akan diterapkan ke semua file) */
                                              (() => {
                                                const firstFile =
                                                  buktiFisikFiles[0];
                                                return (
                                                  <div className="flex items-center justify-center gap-1">
                                                    <button
                                                      onClick={() =>
                                                        handleAksiClick(
                                                          firstFile.id,
                                                          "salah",
                                                          `Semua file (${buktiFisikFiles.length} file)`
                                                        )
                                                      }
                                                      className="px-2 py-0.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 rounded transition-colors"
                                                      title="Tandai semua file sebagai salah (skor = 0)"
                                                    >
                                                      Salah
                                                    </button>
                                                    <button
                                                      onClick={() =>
                                                        handleAksiClick(
                                                          firstFile.id,
                                                          "benar",
                                                          `Semua file (${buktiFisikFiles.length} file)`
                                                        )
                                                      }
                                                      className="px-2 py-0.5 text-xs font-medium text-white bg-green-600 hover:bg-green-700 rounded transition-colors"
                                                      title="Tandai semua file sebagai benar (bisa dinilai)"
                                                    >
                                                      Benar
                                                    </button>
                                                    <button
                                                      onClick={() =>
                                                        handleAksiClick(
                                                          firstFile.id,
                                                          "perbaiki",
                                                          `Semua file (${buktiFisikFiles.length} file)`
                                                        )
                                                      }
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
                                      <td className="px-2 pr-4 py-4 text-center align-middle">
                                        {/* Skor input - hanya verifikator/superadmin yang bisa isi skor */}
                                        {isVerifikator ||
                                          isSuperAdmin ||
                                          isKetuaIKD ? (
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
                                            disabled={
                                              !hasStatusVerifikasi ||
                                              hasSalahStatus ||
                                              !hasBenarFile
                                            }
                                            className={`w-16 px-1.5 py-1 text-sm text-center border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent ${!hasStatusVerifikasi ||
                                              hasSalahStatus ||
                                              !hasBenarFile
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

                    {/* Pagination - tampilkan jika ada data */}
                    {filteredDosen.length > 0 && (
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
                            Menampilkan {paginatedDosen.length} dari{" "}
                            {filteredDosen.length} data
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
                                className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${page === 1
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
                                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${page === pageNum
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
                                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${page === totalPages
                                    ? "bg-brand-500 text-white"
                                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    }`}
                                >
                                  {totalPages}
                                </button>
                              )}
                            </div>

                            <button
                              onClick={() =>
                                setPage((p) => Math.min(totalPages, p + 1))
                              }
                              disabled={page === totalPages}
                              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                            >
                              Next
                            </button>
                          </div>
                        )}
                      </div>
                    )}
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

        {/* Modal Konfirmasi Delete File */}
        <AnimatePresence>
          {showDeleteModal && fileToDelete && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              <div
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={() => {
                  setShowDeleteModal(false);
                  setFileToDelete(null);
                }}
              ></div>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
              >
                <div className="flex items-center justify-between pb-6">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    Konfirmasi Hapus Data
                  </h2>
                </div>
                <div>
                  <p className="mb-6 text-gray-500 dark:text-gray-400">
                    Apakah Anda yakin ingin menghapus file{" "}
                    <span className="font-semibold text-gray-800 dark:text-white">
                      "{fileToDelete.name}"
                    </span>
                    ?
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setShowDeleteModal(false);
                        setFileToDelete(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={confirmDeleteFile}
                      className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition"
                    >
                      Hapus
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Konfirmasi Aksi Verifikasi */}
        <AnimatePresence>
          {showAksiModal && aksiToConfirm && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              <div
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={() => {
                  setShowAksiModal(false);
                  setAksiToConfirm(null);
                }}
              ></div>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
              >
                <div className="flex items-center justify-between pb-6">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    {aksiToConfirm.status === "salah"
                      ? "Konfirmasi Tandai sebagai Salah"
                      : aksiToConfirm.status === "benar"
                        ? "Konfirmasi Tandai sebagai Benar"
                        : "Konfirmasi Minta Perbaiki"}
                  </h2>
                </div>
                <div>
                  <p className="mb-4 text-gray-500 dark:text-gray-400">
                    Apakah Anda yakin ingin{" "}
                    {aksiToConfirm.status === "salah"
                      ? "menandai file"
                      : aksiToConfirm.status === "benar"
                        ? "menandai file"
                        : "meminta dosen untuk memperbaiki file"}{" "}
                    <span className="font-semibold text-gray-800 dark:text-white">
                      "{aksiToConfirm.fileName}"
                    </span>{" "}
                    {aksiToConfirm.status === "salah"
                      ? "sebagai salah"
                      : aksiToConfirm.status === "benar"
                        ? "sebagai benar"
                        : "?"}
                  </p>
                  <p className="mb-6 text-sm text-gray-600 dark:text-gray-500 whitespace-pre-line">
                    {aksiToConfirm.description}
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setShowAksiModal(false);
                        setAksiToConfirm(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={confirmAksi}
                      className={`px-4 py-2 rounded-lg text-white text-sm font-medium shadow-theme-xs transition ${aksiToConfirm.status === "salah"
                        ? "bg-red-500 hover:bg-red-600"
                        : aksiToConfirm.status === "benar"
                          ? "bg-green-500 hover:bg-green-600"
                          : "bg-yellow-500 hover:bg-yellow-600"
                        }`}
                    >
                      {aksiToConfirm.status === "salah"
                        ? "Tandai Salah"
                        : aksiToConfirm.status === "benar"
                          ? "Tandai Benar"
                          : "Perbaiki"}
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
