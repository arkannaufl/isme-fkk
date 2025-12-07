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

const TimAkademik: React.FC = () => {
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
  const unitKerja = "Akademik";

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
  const [selectedKegiatan, setSelectedKegiatan] = useState<IKDPedoman | null>(
    null
  );

  // State untuk delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [fileToDelete, setFileToDelete] = useState<{
    id: number;
    fileName: string;
  } | null>(null);

  // Ref untuk menyimpan deletedKeys (user_id + pedoman_id) yang sudah dihapus
  // Ini untuk mencegah file baru muncul untuk key yang sama setelah delete
  // Load dari backend untuk persist setelah refresh
  const deletedKeysRef = useRef<Set<string>>(new Set());

  // State untuk trigger re-render jika diperlukan (tidak digunakan langsung, hanya untuk trigger)
  const [, setDeletedFileIds] = useState<Set<number>>(new Set());

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

  // State untuk skor yang sedang di-edit (untuk debounce)
  const [skorValues, setSkorValues] = useState<{
    [key: string]: string;
  }>({}); // Key: `${user_id}_${ikd_pedoman_id}`
  const skorDebounceTimers = useRef<{
    [key: string]: NodeJS.Timeout;
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

        // Fetch parent items untuk indicators
        // Ambil semua parent_id yang unik dari sub-items
        const parentIds = [
          ...new Set(
            res.data.data
              .filter((item: IKDPedoman) => item.parent_id)
              .map((item: IKDPedoman) => item.parent_id)
          ),
        ] as number[];

        if (parentIds.length > 0) {
          // Fetch parent items berdasarkan parent_id
          try {
            const parentRes = await api.post(
              "/rekap-ikd/pedoman-poin/parents",
              {
                ids: parentIds,
              }
            );
            if (parentRes.data?.success && parentRes.data?.data) {
              const map = new Map<number, IKDPedoman>();
              parentRes.data.data.forEach((item: IKDPedoman) => {
                if (item.id) {
                  map.set(item.id, item);
                }
              });
              setParentItemsMap(map);
            }
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
        // Update buktiFisikMap: filter out file yang sedang dihapus
        // Gunakan ref untuk membaca deletedKeys terbaru
        // PENTING: Baca dari ref.current untuk mendapatkan nilai terbaru
        const currentDeletedKeys = deletedKeysRef.current;

        const filteredMap: { [key: string]: IKDBuktiFisik } = {};

        Object.keys(newMap).forEach((key) => {
          const bf = newMap[key];
          // Filter berdasarkan KEY yang sudah dihapus
          // Ini untuk mencegah file baru muncul untuk key yang sama setelah delete
          if (!currentDeletedKeys.has(key)) {
            filteredMap[key] = bf;
          }
        });
        setBuktiFisikMap(filteredMap);

        // Update skor values: reset ke 0 jika tidak ada file, atau update jika ada file
        // JANGAN update jika user sedang mengedit (ada di skorDebounceTimers)
        setSkorValues((prev) => {
          const updated: { [key: string]: string } = { ...prev };

          // Reset skor untuk semua kombinasi user_id dan pedoman_id yang tidak ada file lagi
          // (termasuk yang difilter karena ada di deletedFileIdsRef)
          Object.keys(prev).forEach((key) => {
            if (!(key in filteredMap)) {
              // Jangan reset jika user sedang mengedit
              if (!skorDebounceTimers.current[key]) {
                updated[key] = "0";
              }
            }
          });

          // Update skor untuk yang ada file (hanya jika user TIDAK sedang mengedit)
          Object.keys(filteredMap).forEach((key) => {
            // Skip update jika user sedang mengedit (ada timer aktif)
            if (skorDebounceTimers.current[key]) {
              return;
            }

            const bf = filteredMap[key];
            const currentSkor = bf.skor?.toString() || "0";
            // Update jika belum ada di prev, atau jika nilainya berbeda (untuk sinkronisasi)
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
        // Handle pagination response
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
    loadDeletedKeys(); // Load deleted keys dari backend
  }, [fetchPedomanPoin, loadDeletedKeys]);

  // Realtime update bukti fisik setiap 2 detik
  useEffect(() => {
    if (loading || loadingPedoman) return;

    // Fetch sekali dulu
    fetchBuktiFisik();

    const intervalId = setInterval(() => {
      fetchBuktiFisik();
    }, 2000); // Refresh setiap 2 detik

    return () => {
      clearInterval(intervalId);
    };
  }, [loading, loadingPedoman, fetchBuktiFisik]);

  // Realtime search filter
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

  // Pagination
  const totalPages = Math.ceil(filteredDosen.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedDosen = filteredDosen.slice(startIndex, endIndex);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  // Handle klik header kegiatan → popup info
  const handleKegiatanHeaderClick = (kegiatan: IKDPedoman) => {
    setSelectedKegiatan(kegiatan);
    setShowKegiatanModal(true);
  };

  // Fungsi untuk mendapatkan indicator (judul) dari kegiatan
  const getIndicator = (kegiatan: IKDPedoman): string | null => {
    // Ambil nomor dari kegiatan (parse angka di awal, bisa dengan titik atau huruf)
    // Support format: "1.1.a", "2.1", "2.a", "1", dll
    const match = kegiatan.kegiatan.match(
      /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
    );
    if (!match) return null;

    let currentNumber = match[1]; // Misal: "1.1.a" atau "2.1" atau "2.a" atau "1"

    // Fungsi helper untuk cek apakah item punya isi
    const hasContent = (item: IKDPedoman): boolean => {
      // Cek indeks_poin: harus ada dan > 0 (bukan 0, null, atau undefined)
      const hasIndeksPoin =
        item.indeks_poin !== undefined &&
        item.indeks_poin !== null &&
        item.indeks_poin > 0;

      // Cek unit_kerja: harus string non-empty (bukan null, undefined, atau string kosong)
      const hasUnitKerja =
        item.unit_kerja &&
        typeof item.unit_kerja === "string" &&
        item.unit_kerja.trim().length > 0;

      // Cek bukti_fisik: harus string non-empty
      const hasBuktiFisik =
        item.bukti_fisik &&
        typeof item.bukti_fisik === "string" &&
        item.bukti_fisik.trim().length > 0;

      // Cek prosedur: harus string non-empty
      const hasProsedur =
        item.prosedur &&
        typeof item.prosedur === "string" &&
        item.prosedur.trim().length > 0;

      return hasIndeksPoin || hasUnitKerja || hasBuktiFisik || hasProsedur;
    };

    // Cek apakah item saat ini punya isi
    const itemHasContent = hasContent(kegiatan);

    // Jika item PUNYA isi → cari parent yang TIDAK punya isi (hanya punya kegiatan)
    // Jika item TIDAK punya isi → cari parent yang punya isi
    if (itemHasContent) {
      // Cek dulu: jika item ini adalah nomor utama (tidak ada titik, tidak ada huruf)
      // Misal: "5", "4", "1" (bukan "1.1", "1.1.a", "2.a")
      const isMainNumber =
        !currentNumber.includes(".") && !/[a-z]$/i.test(currentNumber);
      if (isMainNumber) {
        // Jika item utama punya isi, indicators = "-"
        return "-";
      }

      // Ambil parent number dulu (hapus bagian terakhir)
      let parentNumber = currentNumber;

      // Ambil parent number (hapus bagian terakhir)
      if (parentNumber.includes(".")) {
        const parts = parentNumber.split(".");
        if (parts.length > 1) {
          parts.pop();
          parentNumber = parts.join(".");
        } else {
          // Jika tidak ada parent, return "-"
          return "-";
        }
      } else if (/[a-z]$/i.test(parentNumber)) {
        // Jika berakhir dengan huruf (misal "2a"), hapus hurufnya jadi "2"
        parentNumber = parentNumber.replace(/[a-z]+$/i, "");
      } else {
        // Jika hanya angka (nomor utama), return "-"
        return "-";
      }

      // Cari parent yang TIDAK punya isi
      // Loop ke atas mencari parent yang tidak punya isi
      // Mulai dari parent langsung (jika ada parent_id), lalu loop ke parent berikutnya
      let currentParentId: number | null | undefined = kegiatan.parent_id;
      const checkedParentIds = new Set<number>();

      // Loop menggunakan parent_id (jika ada)
      while (currentParentId && !checkedParentIds.has(currentParentId)) {
        checkedParentIds.add(currentParentId);
        const parent = parentItemsMap.get(currentParentId);

        if (parent) {
          if (!hasContent(parent)) {
            // Parent tidak punya isi → return kegiatan parent ini
            return parent.kegiatan;
          } else {
            // Parent punya isi → lanjut ke parent berikutnya
            currentParentId = parent.parent_id;
          }
        } else {
          break;
        }
      }

      // Jika tidak ketemu dari parentItemsMap via parent_id, cari berdasarkan parsing nomor
      // Loop dari parentNumber ke atas sampai ketemu yang tidak punya isi
      let searchParentNumber = parentNumber;

      while (searchParentNumber) {
        // Cari dari parentItemsMap berdasarkan nomor
        const parentFromMap = Array.from(parentItemsMap.values()).find(
          (item) => {
            const itemMatch = item.kegiatan.match(
              /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
            );
            if (!itemMatch) return false;
            const itemNumber = itemMatch[1];
            // Match exact: "1.1" harus match dengan "1.1" saja, bukan "1.1.a" atau "1.1.b"
            if (searchParentNumber.includes(".")) {
              return (
                itemNumber === searchParentNumber && !itemNumber.match(/\.\w+$/)
              );
            } else {
              return (
                itemNumber === searchParentNumber && !itemNumber.includes(".")
              );
            }
          }
        );

        if (parentFromMap && !hasContent(parentFromMap)) {
          return parentFromMap.kegiatan;
        }

        // Cari dari pedomanList juga (fallback)
        const parentFromList = pedomanList.find((item) => {
          const itemMatch = item.kegiatan.match(
            /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
          );
          if (!itemMatch) return false;
          const itemNumber = itemMatch[1];
          if (searchParentNumber.includes(".")) {
            return (
              itemNumber === searchParentNumber && !itemNumber.match(/\.\w+$/)
            );
          } else {
            return (
              itemNumber === searchParentNumber && !itemNumber.includes(".")
            );
          }
        });

        if (parentFromList && !hasContent(parentFromList)) {
          return parentFromList.kegiatan;
        }

        // Ambil parent number berikutnya (hapus bagian terakhir)
        if (searchParentNumber.includes(".")) {
          const parts = searchParentNumber.split(".");
          if (parts.length > 1) {
            parts.pop();
            searchParentNumber = parts.join(".");
          } else {
            break;
          }
        } else if (/[a-z]$/i.test(searchParentNumber)) {
          searchParentNumber = searchParentNumber.replace(/[a-z]+$/i, "");
        } else {
          // Jika sampai nomor utama, cek apakah tidak punya isi
          const mainParent =
            parentItemsMap.size > 0
              ? Array.from(parentItemsMap.values()).find((item) => {
                  const itemMatch = item.kegiatan.match(
                    /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
                  );
                  if (!itemMatch) return false;
                  const itemNumber = itemMatch[1];
                  return (
                    itemNumber === searchParentNumber &&
                    !itemNumber.includes(".")
                  );
                })
              : null;

          if (mainParent && !hasContent(mainParent)) {
            return mainParent.kegiatan;
          }

          // Fallback ke pedomanList
          const mainParentFromList = pedomanList.find((item) => {
            const itemMatch = item.kegiatan.match(
              /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
            );
            if (!itemMatch) return false;
            const itemNumber = itemMatch[1];
            return (
              itemNumber === searchParentNumber && !itemNumber.includes(".")
            );
          });

          if (mainParentFromList && !hasContent(mainParentFromList)) {
            return mainParentFromList.kegiatan;
          }

          break;
        }
      }

      return "-";
    } else {
      // Jika item TIDAK punya isi, cari parent yang punya isi
      while (currentNumber) {
        // Cari parent di pedomanList
        const parent = pedomanList.find((item) => {
          // Parse nomor dari kegiatan item
          const itemMatch = item.kegiatan.match(
            /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
          );
          if (!itemMatch) return false;

          const itemNumber = itemMatch[1];
          return itemNumber === currentNumber;
        });

        if (parent && hasContent(parent)) {
          // Return KEGIATAN dari parent yang punya isi (bukan nomornya)
          return parent.kegiatan;
        }

        // Ambil parent number (hapus bagian terakhir)
        if (currentNumber.includes(".")) {
          // Hapus bagian setelah titik terakhir
          const parts = currentNumber.split(".");
          if (parts.length > 1) {
            // Hapus bagian terakhir
            parts.pop();
            currentNumber = parts.join(".");
          } else {
            break;
          }
        } else if (/[a-z]$/i.test(currentNumber)) {
          // Jika berakhir dengan huruf (misal "2a"), hapus hurufnya jadi "2"
          currentNumber = currentNumber.replace(/[a-z]+$/i, "");
        } else {
          // Jika hanya angka (nomor utama seperti 2, 3, 5), cek apakah ada isinya
          const mainParent = pedomanList.find((item) => {
            const itemMatch = item.kegiatan.match(
              /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
            );
            if (!itemMatch) return false;

            const itemNumber = itemMatch[1];
            // Cek apakah nomor utama sama (misal "2" harus match dengan "2" saja, bukan "2.1" atau "2.a")
            return itemNumber === currentNumber && !itemNumber.includes(".");
          });

          if (mainParent && hasContent(mainParent)) {
            // Return KEGIATAN dari parent yang punya isi
            return mainParent.kegiatan;
          } else {
            // Jika nomor utama juga tidak ada isinya, return "-"
            return "-";
          }
        }
      }

      // Jika tidak ketemu sama sekali, return "-"
      return "-";
    }
  };

  // Handle upload file
  // Handle update skor dengan debounce
  const handleSkorChange = useCallback(
    async (userId: number, pedomanId: number, value: string) => {
      const key = `${userId}_${pedomanId}`;

      // Cek apakah ada file terlebih dahulu
      const buktiFisik = buktiFisikMap[key];
      if (!buktiFisik) {
        // Jika tidak ada file, jangan izinkan perubahan skor
        return;
      }

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
    [buktiFisikMap]
  );

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
          // Remove dari backend
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
        // Show success message
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
      // Cari buktiFisik yang dihapus untuk mendapatkan user_id dan pedoman_id SEBELUM file dihapus
      const deletedBuktiFisik = Object.values(buktiFisikMap).find(
        (bf) => bf.id === fileToDelete.id
      );

      if (!deletedBuktiFisik) {
        console.error("BuktiFisik not found for deletion");
        return;
      }

      const key = `${deletedBuktiFisik.user_id}_${deletedBuktiFisik.ikd_pedoman_id}`;

      // Hapus file dari backend
      const res = await api.delete(`/rekap-ikd/bukti-fisik/${fileToDelete.id}`);
      if (res.data?.success) {
        // Tandai KEY sebagai dihapus untuk mencegah file baru muncul untuk key yang sama
        const newDeletedKeysSet = new Set(deletedKeysRef.current);
        newDeletedKeysSet.add(key);
        deletedKeysRef.current = newDeletedKeysSet;
        // Save ke backend
        await saveDeletedKey(key);

        // Reset skor ke 0 di backend dulu
        try {
          await api.post("/rekap-ikd/bukti-fisik/update-skor", {
            user_id: deletedBuktiFisik.user_id,
            ikd_pedoman_id: deletedBuktiFisik.ikd_pedoman_id,
            skor: 0,
          });
        } catch (skorError) {
          console.error("Error resetting skor:", skorError);
        }

        // Langsung update local state: hapus dari buktiFisikMap dan reset skor
        // Ini akan langsung update UI tanpa menunggu refresh dari server
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

        // Update state untuk trigger re-render (tidak digunakan langsung, hanya untuk trigger)
        setDeletedFileIds(new Set());

        // Tutup modal
        setShowDeleteModal(false);
        setFileToDelete(null);

        // Show success message
        setSuccessMessage("File berhasil dihapus! Skor telah direset ke 0.");
        setTimeout(() => setSuccessMessage(null), 3000);

        // Tidak perlu manual refresh, biarkan realtime update yang menangani
        // Realtime update akan otomatis memfilter file yang ada di deletedFileIdsRef
      }
    } catch (error: unknown) {
      console.error("Error deleting file:", error);
      const errorMessage = (
        error as { response?: { data?: { message?: string } } }
      )?.response?.data?.message;
      alert(errorMessage || "Gagal menghapus file. Silakan coba lagi.");
    }
  };

  return (
    <RekapIKDBase
      title="Rekap IKD - Akademik"
      description="Rekap Indikator Kinerja Dosen untuk Akademik"
    >
      <div className="space-y-6">
        {/* Success Message */}
        <AnimatePresence>
          {successMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
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

        {/* Search Bar */}
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
                            title="Klik untuk melihat detail"
                          >
                            <div className="flex items-center gap-2">
                              <span>{pedoman.kegiatan}</span>
                              <FontAwesomeIcon
                                icon={faInfoCircle}
                                className="w-3 h-3 text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity"
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
                  <tbody className="bg-white dark:bg-white/[0.03] divide-y divide-gray-100 dark:divide-white/[0.05]">
                    {paginatedDosen.length === 0 ? (
                      <tr>
                        <td
                          colSpan={2 + pedomanList.length * 2}
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
                            const buktiFisik = buktiFisikMap[key];
                            const isUploading = uploadingFiles[key] || false;
                            const fileInputKey = `file_${key}`;
                            // Jika tidak ada file, skor harus "0" dan disabled
                            // Jika ada file, gunakan skor dari state atau dari buktiFisik
                            const skorValue = buktiFisik
                              ? skorValues[key] ??
                                buktiFisik.skor?.toString() ??
                                "0"
                              : "0";

                            return (
                              <React.Fragment key={pedoman.id}>
                                <td
                                  className={`px-4 ${
                                    index > 0 ? "pl-8" : ""
                                  } pr-2 py-4 text-sm text-gray-900 dark:text-gray-100`}
                                >
                                  <div className="flex flex-col gap-2">
                                    {buktiFisik ? (
                                      <div className="flex items-center gap-2">
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
                                            // Reset input
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
                                    )}
                                  </div>
                                </td>
                                <td className="px-2 pr-4 py-4 text-center">
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
              {totalPages > 1 && (
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
    </RekapIKDBase>
  );
};

export default TimAkademik;
