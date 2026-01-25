import React, {
  useState,
  useEffect,
  useRef,
  ChangeEvent,
  useMemo,
} from "react";
import RekapIKDBase from "./RekapIKDBase";
import { motion, AnimatePresence } from "framer-motion";
import api, { getUser } from "../../utils/api";
import * as XLSX from "xlsx";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileExcel,
  faDownload,
  faUpload,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";

interface IKDPedomanItem {
  id?: number;
  no: string;
  kegiatan: string;
  indeks_poin: number;
  unit_kerja: string;
  bukti_fisik: string;
  prosedur: string;
  bidang: string; // "A", "D", or custom
  bidang_nama?: string; // "Pengajaran", "Penunjang", or custom name
  parent_id?: number | null; // For sub items
  level?: number; // 0 = main item, 1 = sub item
}

interface IKDBidang {
  id?: number;
  kode: string; // "A", "D", or custom
  nama: string; // "Pengajaran", "Penunjang", or custom
  is_auto: boolean; // true for A and D
}

// Unit Kerja options from Rekap IKD menu
const UNIT_KERJA_OPTIONS = [
  "Akademik",
  "Dosen",
  "AIK",
  "MEU",
  "Profesi",
  "Kemahasiswaan",
  "SDM",
  "UPT Jurnal",
  "UPT PPM",
];

const PedomanPoinIKD: React.FC = () => {
  const [pedomanData, setPedomanData] = useState<IKDPedomanItem[]>([]);
  const [bidangList, setBidangList] = useState<IKDBidang[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedBidang, setSelectedBidang] = useState<string>("");
  const [form, setForm] = useState<IKDPedomanItem>({
    no: "",
    kegiatan: "",
    indeks_poin: 0,
    unit_kerja: "",
    bukti_fisik: "",
    prosedur: "",
    bidang: "",
  });
  const [editingItem, setEditingItem] = useState<IKDPedomanItem | null>(null);
  const [showBidangModal, setShowBidangModal] = useState(false);
  const [newBidang, setNewBidang] = useState({ kode: "", nama: "" });
  const [editingBidang, setEditingBidang] = useState<IKDBidang | null>(null);
  const [bidangToDelete, setBidangToDelete] = useState<IKDBidang | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bidangModalError, setBidangModalError] = useState<string | null>(null);
  const [useSubItem, setUseSubItem] = useState(false);
  const [parentItemId, setParentItemId] = useState<number | null>(null);
  const [subItems, setSubItems] = useState<
    Array<{
      id?: string;
      kegiatan: string;
      indeks_poin: number;
      unit_kerja: string;
      bukti_fisik: string;
      prosedur: string;
    }>
  >([]);
  const [showSubItemTypeModal, setShowSubItemTypeModal] = useState(false);
  const [showUnitKerjaDropdown, setShowUnitKerjaDropdown] = useState(false);
  const [showSubItemUnitKerjaDropdown, setShowSubItemUnitKerjaDropdown] =
    useState<string | null>(null);
  const unitKerjaDropdownRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<
    Array<{
      id?: number;
      no: string;
      kegiatan: string;
      indeks_poin: number;
      unit_kerja: string;
      bukti_fisik: string;
      prosedur: string;
      useSubItem: boolean;
      subItems: Array<{
        id?: string;
        kegiatan: string;
        indeks_poin: number;
        unit_kerja: string;
        bukti_fisik: string;
        prosedur: string;
      }>;
    }>
  >([]);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [deletedItems, setDeletedItems] = useState<number[]>([]); // Track items yang dihapus untuk dihapus dari database saat save
  const [deletedSubItems, setDeletedSubItems] = useState<number[]>([]); // Track sub items yang dihapus untuk dihapus dari database saat save
  const [deletedMainForm, setDeletedMainForm] = useState<number | null>(null); // Track form utama yang dihapus

  // State untuk import/export Excel
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<
    Array<{ row: number; field: string; message: string }>
  >([]);
  const [cellErrors, setCellErrors] = useState<
    Array<{ row: number; field: string; message: string }>
  >([]);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    key: string;
  } | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // State untuk zoom tabel
  const [tableZoom, setTableZoom] = useState(1); // 1 = 100%, default

  // State untuk modal konfirmasi delete (untuk delete dari table)
  const [showDeleteItemModal, setShowDeleteItemModal] = useState(false);
  const [showDeleteSubItemModal, setShowDeleteSubItemModal] = useState(false);
  const [itemToDeleteIndex, setItemToDeleteIndex] = useState<number | null>(
    null
  );
  const [subItemToDeleteIndex, setSubItemToDeleteIndex] = useState<{
    itemIndex: number;
    subItemIndex: number;
  } | null>(null);

  // Get current user role untuk menentukan apakah bisa edit/hapus
  const currentUser = useMemo(() => getUser(), []);
  const currentUserRole = currentUser?.role || "";
  const canEdit =
    currentUserRole === "ketua_ikd" || currentUserRole === "super_admin";

  // Fetch data
  useEffect(() => {
    fetchPedomanData();
    fetchBidangList();
  }, []);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;

      // Check main dropdown
      if (
        unitKerjaDropdownRef.current &&
        !unitKerjaDropdownRef.current.contains(target)
      ) {
        setShowUnitKerjaDropdown(false);
      }

      // Check sub item dropdowns - close if click is outside any dropdown
      const allDropdowns = document.querySelectorAll(
        "[data-sub-item-dropdown]"
      );
      let clickedInsideSubItemDropdown = false;
      allDropdowns.forEach((dropdown) => {
        if (dropdown.contains(target)) {
          clickedInsideSubItemDropdown = true;
        }
      });

      if (!clickedInsideSubItemDropdown) {
        setShowSubItemUnitKerjaDropdown(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Auto-dismiss success message
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Auto-dismiss error message
  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError(null);
      }, 7000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchPedomanData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/rekap-ikd/pedoman-poin");
      let data: IKDPedomanItem[] = [];
      if (res.data?.success && Array.isArray(res.data.data)) {
        data = res.data.data;
      } else if (Array.isArray(res.data)) {
        data = res.data;
      }
      setPedomanData(data);

      // Extract unique bidang from pedomanData and populate bidangList
      const uniqueBidang = new Map<
        string,
        { kode: string; nama: string; is_auto: boolean }
      >();
      data.forEach((item) => {
        if (item.bidang && !uniqueBidang.has(item.bidang)) {
          uniqueBidang.set(item.bidang, {
            kode: item.bidang,
            nama: item.bidang_nama || item.bidang, // Use bidang_nama if available, otherwise use kode
            is_auto: false,
          });
        }
      });

      // Update bidangList with unique bidang from database
      if (uniqueBidang.size > 0) {
        setBidangList(Array.from(uniqueBidang.values()));
      }
    } catch (error) {
      console.error("Error fetching pedoman data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchBidangList = async () => {
    // Initialize with empty bidang list (no default fields)
    setBidangList([]);
  };

  const handleOpenModal = (bidang?: string) => {
    if (bidang) {
      setSelectedBidang(bidang);

      // Load semua main items (level 0) dari bidang tersebut
      const allMainItems = pedomanData
        .filter((item) => {
          // Filter: bidang sama, level 0 atau undefined, tidak ada parent_id
          return (
            item.bidang === bidang &&
            (item.level === 0 || item.level === undefined) &&
            (!item.parent_id || item.parent_id === null)
          );
        })
        .sort((a, b) => {
          // Sort by no (handle "1", "2", "3", etc.)
          const aNum = parseInt(a.no);
          const bNum = parseInt(b.no);
          if (!isNaN(aNum) && !isNaN(bNum)) {
            return aNum - bNum;
          }
          return a.no.localeCompare(b.no);
        })
        .map((item) => {
          // Cek apakah ada item lain dengan NO yang sama (untuk menentukan sub items)
          const itemsWithSameNo = pedomanData.filter((otherItem) => {
            return (
              otherItem.bidang === bidang &&
              otherItem.no === item.no &&
              otherItem.id !== item.id // Exclude item itu sendiri
            );
          });

          // Sub items hanya muncul jika ada multiple items dengan NO yang sama
          // Jika hanya ada 1 item dengan NO tersebut, itu adalah main item (tidak ada sub items)
          let itemSubItems: Array<{
            id?: string;
            kegiatan: string;
            indeks_poin: number;
            unit_kerja: string;
            bukti_fisik: string;
            prosedur: string;
          }> = [];

          if (itemsWithSameNo.length > 0) {
            // Ada multiple items dengan NO yang sama
            // Item ini adalah main item, sisanya adalah sub items
            itemSubItems = itemsWithSameNo
              .filter((subItem) => {
                if (!subItem.kegiatan || subItem.id === item.id) return false;

                // Sub items adalah yang memiliki parent_id sama dengan item.id
                if (subItem.parent_id === item.id) return true;

                // Atau yang memiliki NO sama dan kegiatan dengan format sub item:
                // - 1.1, 1.2 (angka.angka)
                // - 1.1.a, 1.1.b (angka.angka.huruf)
                // - 1.1a, 1.1b (angka.angkahuruf)
                // - 2.a, 1.a (angka.huruf)
                const kegiatanTrimmed = subItem.kegiatan.trim();
                const mainNo = item.no;

                // Pattern untuk deteksi sub items: kegiatan harus dimulai dengan mainNo + "."
                // atau mainNo + "." + sesuatu (angka atau huruf)
                const pattern1 = new RegExp(
                  `^${mainNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\d+`
                ); // 1.1, 1.2
                const pattern2 = new RegExp(
                  `^${mainNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.\\d+\\.`
                ); // 1.1., 1.2.
                const pattern3 = new RegExp(
                  `^${mainNo.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                  )}\\.\\d+[a-z]`,
                  "i"
                ); // 1.1a, 1.1b
                const pattern4 = new RegExp(
                  `^${mainNo.replace(
                    /[.*+?^${}()|[\]\\]/g,
                    "\\$&"
                  )}\\.\\d+\\.([a-z])`,
                  "i"
                ); // 1.1.a, 1.1.b
                const pattern5 = new RegExp(
                  `^${mainNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.([a-z])`,
                  "i"
                ); // 2.a, 1.a

                return (
                  subItem.bidang === bidang &&
                  subItem.no === item.no &&
                  (pattern1.test(kegiatanTrimmed) ||
                    pattern2.test(kegiatanTrimmed) ||
                    pattern3.test(kegiatanTrimmed) ||
                    pattern4.test(kegiatanTrimmed) ||
                    pattern5.test(kegiatanTrimmed))
                );
              })
              .map((subItem) => ({
                id: subItem.id?.toString(),
                kegiatan: subItem.kegiatan,
                indeks_poin: subItem.indeks_poin || 0,
                unit_kerja: subItem.unit_kerja || "",
                bukti_fisik: subItem.bukti_fisik || "",
                prosedur: subItem.prosedur || "",
              }));
          }

          // Check if item uses sub items (hanya jika ada sub items)
          const hasSubs = itemSubItems.length > 0;

          return {
            id: item.id, // Include id untuk cek apakah sudah ada di database
            no: item.no,
            kegiatan: item.kegiatan,
            indeks_poin: item.indeks_poin || 0,
            unit_kerja: item.unit_kerja || "",
            bukti_fisik: item.bukti_fisik || "",
            prosedur: item.prosedur || "",
            useSubItem: hasSubs,
            subItems: itemSubItems,
          };
        });

      if (allMainItems.length > 0) {
        // Item pertama → form utama
        const firstItem = allMainItems[0];
        setForm({
          no: firstItem.no,
          kegiatan: firstItem.kegiatan,
          indeks_poin: firstItem.indeks_poin,
          unit_kerja: firstItem.unit_kerja,
          bukti_fisik: firstItem.bukti_fisik,
          prosedur: firstItem.prosedur,
          bidang: bidang,
        });
        setUseSubItem(firstItem.useSubItem);
        setSubItems(firstItem.subItems);

        // Item kedua, ketiga, dst → list items
        const remainingItems = allMainItems.slice(1);
        setItems(remainingItems);
      } else {
        // Jika tidak ada items, set form kosong untuk item baru
        const bidangItems = pedomanData.filter(
          (item) => item.bidang === bidang
        );
        const nextNo = bidangItems.length + 1;
        setForm({
          no: String(nextNo),
          kegiatan: "",
          indeks_poin: 0,
          unit_kerja: "",
          bukti_fisik: "",
          prosedur: "",
          bidang: bidang,
        });
        setUseSubItem(false);
        setSubItems([]);
        setItems([]);
      }
    }

    setEditMode(false);
    setEditingItem(null);
    setCurrentItemIndex(null);
    setShowModal(true);
  };

  const handleEditTableClick = () => {
    // Hanya bisa edit jika role ketua_ikd atau super_admin
    if (!canEdit) {
      return;
    }
    // Selalu kembali ke modal pilih bidang (halaman awal)
    setShowBidangModal(true);
  };

  const handleAddNewItem = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (!selectedBidang) {
      setError("Pilih Bidang terlebih dahulu");
      return;
    }

    // IMPORTANT: Create a completely new array with deep copies to avoid any mutation
    // This ensures existing items are NEVER modified - they remain exactly as they were
    const currentItems = items.map((item) => ({
      no: item.no,
      kegiatan: item.kegiatan,
      indeks_poin: item.indeks_poin,
      unit_kerja: item.unit_kerja,
      bukti_fisik: item.bukti_fisik,
      prosedur: item.prosedur,
      useSubItem: item.useSubItem, // Preserve existing useSubItem state - DO NOT CHANGE
      subItems: item.subItems.map((sub) => ({
        id: sub.id,
        kegiatan: sub.kegiatan,
        indeks_poin: sub.indeks_poin,
        unit_kerja: sub.unit_kerja,
        bukti_fisik: sub.bukti_fisik,
        prosedur: sub.prosedur,
      })), // Deep copy each subItem
    }));

    // DON'T take data from the form that's being filled
    // Instead, create a NEW item with default/empty data
    // The form that's being filled remains intact and unchanged

    // Auto-generate NO based on:
    // 1. If form has NO, use that NO (follow the form above)
    // 2. If no form NO or items exist, follow the items sequence
    let nextNo: string;
    if (form.no && currentItems.length === 0) {
      // First item: use NO from form (follow the form above)
      nextNo = form.no;
    } else if (currentItems.length > 0) {
      // Subsequent items: follow the items sequence (second, third, etc.)
      // Get the last item's NO and increment
      const lastItemNo = currentItems[currentItems.length - 1].no;
      const lastNoNum = parseInt(lastItemNo);
      if (!isNaN(lastNoNum)) {
        nextNo = String(lastNoNum + 1);
      } else {
        // If last NO is not a number, use items length + 1
        nextNo = String(currentItems.length + 1);
      }
    } else {
      // Fallback: if no form NO and no items, start from 1
      nextNo = "1";
    }

    // Create new item with default/empty data (NOT from the form)
    const newItem = {
      no: nextNo, // Use calculated NO
      kegiatan: "",
      indeks_poin: 0,
      unit_kerja: "",
      bukti_fisik: "",
      prosedur: "",
      useSubItem: false, // Default: checkbox unchecked
      subItems: [], // Default: no sub items
    };

    // Add new item to items list
    currentItems.push(newItem);
    setItems(currentItems);

    // IMPORTANT: Don't reset or change the form that's being filled
    // The form remains intact with all its data
    // User can continue filling the form or save it later
    setCurrentItemIndex(null);
    setError(null);
  };

  const handleToggleSubItemForItem = (itemIndex: number) => {
    // Create deep copy to avoid mutating existing items
    const updated = items.map((item, idx) => {
      if (idx === itemIndex) {
        return {
          ...item,
          useSubItem: !item.useSubItem,
          subItems: !item.useSubItem ? item.subItems : [], // Clear sub items if disabling
        };
      }
      return { ...item, subItems: [...item.subItems] }; // Deep copy subItems for other items
    });
    setItems(updated);
  };

  const handleAddSubItemForItem = (itemIndex: number) => {
    // Set current item index untuk edit
    setCurrentItemIndex(itemIndex);
    // Open sub item type modal
    setShowSubItemTypeModal(true);
  };

  const handleAddSubItemToItem = (
    itemIndex: number,
    subItemType: "number" | "letter"
  ) => {
    const item = items[itemIndex];
    const currentNo = item.no;
    const lastSub = item.subItems[item.subItems.length - 1];
    let baseNo = "";

    if (subItemType === "number") {
      // Generate next number format (1.2, 1.3, etc.)
      if (lastSub && lastSub.kegiatan) {
        const numberMatch = lastSub.kegiatan.match(/^(\d+\.\d+)/);
        if (numberMatch) {
          const parts = numberMatch[1].split(".");
          const nextNo = parseInt(parts[1]) + 1;
          baseNo = `${parts[0]}.${nextNo}`;
        } else {
          const mainMatch = item.kegiatan.match(/^(\d+\.\d+)/);
          if (mainMatch) {
            const parts = mainMatch[1].split(".");
            const nextNo = parseInt(parts[1]) + 1;
            baseNo = `${parts[0]}.${nextNo}`;
          } else {
            baseNo = `${currentNo}.1`;
          }
        }
      } else {
        const mainMatch = item.kegiatan.match(/^(\d+\.\d+)/);
        if (mainMatch) {
          const parts = mainMatch[1].split(".");
          const nextNo = parseInt(parts[1]) + 1;
          baseNo = `${parts[0]}.${nextNo}`;
        } else {
          baseNo = `${currentNo}.1`;
        }
      }
    } else {
      // Generate next letter format (1.1.a, 1.1.b, 2.a, 2.b, etc.)
      if (lastSub && lastSub.kegiatan) {
        // Check for format like "2.a", "2.b" (number.letter directly)
        const directLetterMatch = lastSub.kegiatan.match(/^(\d+)\.([a-z])\./i);
        if (directLetterMatch) {
          const base = directLetterMatch[1];
          const lastLetter = directLetterMatch[2];
          const nextLetter = String.fromCharCode(lastLetter.charCodeAt(0) + 1);
          baseNo = `${base}.${nextLetter}`;
        } else {
          // Check for format like "1.1.a", "1.1.b" (number.number.letter)
          const letterMatch = lastSub.kegiatan.match(/^(\d+\.\d+)\.([a-z])\./i);
          if (letterMatch) {
            const base = letterMatch[1];
            const lastLetter = letterMatch[2];
            const nextLetter = String.fromCharCode(
              lastLetter.charCodeAt(0) + 1
            );
            baseNo = `${base}.${nextLetter}`;
          } else {
            const numberMatch = lastSub.kegiatan.match(/^(\d+\.\d+)/);
            if (numberMatch) {
              baseNo = `${numberMatch[1]}.a`;
            } else {
              const mainMatch = item.kegiatan.match(/^(\d+\.\d+)/);
              if (mainMatch) {
                baseNo = `${mainMatch[1]}.a`;
              } else {
                // Direct format: 2.a, 3.a, etc.
                baseNo = `${currentNo}.a`;
              }
            }
          }
        }
      } else {
        const mainMatch = item.kegiatan.match(/^(\d+\.\d+)/);
        if (mainMatch) {
          baseNo = `${mainMatch[1]}.a`;
        } else {
          // Direct format: 2.a, 3.a, etc.
          baseNo = `${currentNo}.a`;
        }
      }
    }

    const newSubItem = {
      id: `sub-${Date.now()}`,
      kegiatan: subItemType === "number" ? `${baseNo} ` : `${baseNo}. `,
      indeks_poin: 0,
      unit_kerja: "",
      bukti_fisik: "",
      prosedur: "",
    };

    const updated = [...items];
    updated[itemIndex].subItems = [...item.subItems, newSubItem];
    setItems(updated);
    setShowSubItemTypeModal(false);
    setCurrentItemIndex(null);
  };

  const handleEditItem = (index: number) => {
    const item = items[index];
    setForm({
      no: item.no,
      kegiatan: item.kegiatan,
      indeks_poin: item.indeks_poin,
      unit_kerja: item.unit_kerja,
      bukti_fisik: item.bukti_fisik,
      prosedur: item.prosedur,
      bidang: selectedBidang,
    });
    setUseSubItem(item.useSubItem);
    setSubItems([...item.subItems]);
    setCurrentItemIndex(index);
  };

  const handleDeleteItem = (index: number) => {
    // Tampilkan modal konfirmasi (karena delete dari table, bukan dari modal)
    setItemToDeleteIndex(index);
    setShowDeleteItemModal(true);
  };

  const confirmDeleteItem = () => {
    if (itemToDeleteIndex === null) return;

    const itemToDelete = items[itemToDeleteIndex];

    // Jika item punya id, berarti sudah ada di database, track untuk dihapus saat save
    if (itemToDelete?.id) {
      setDeletedItems((prev) => [...prev, itemToDelete.id!]);
    }

    // Hapus sub items dari item ini juga (jika ada id)
    if (itemToDelete?.subItems) {
      itemToDelete.subItems.forEach((subItem) => {
        if (subItem.id) {
          const subItemId =
            typeof subItem.id === "string" ? parseInt(subItem.id) : subItem.id;
          if (!isNaN(subItemId)) {
            setDeletedSubItems((prev) => [...prev, subItemId]);
          }
        }
      });
    }

    // Hapus dari state
    const newItems = items.filter((_, i) => i !== itemToDeleteIndex);
    setItems(newItems);

    // Tutup modal
    setShowDeleteItemModal(false);
    setItemToDeleteIndex(null);
  };

  const handleDeleteSubItem = (itemIndex: number, subItemIndex: number) => {
    // Tampilkan modal konfirmasi (karena delete dari table, bukan dari modal)
    setSubItemToDeleteIndex({ itemIndex, subItemIndex });
    setShowDeleteSubItemModal(true);
  };

  const confirmDeleteSubItem = () => {
    if (subItemToDeleteIndex === null) return;

    const { itemIndex, subItemIndex } = subItemToDeleteIndex;
    const item = items[itemIndex];
    const subItemToDelete = item.subItems[subItemIndex];

    // Jika sub item punya id, berarti sudah ada di database, track untuk dihapus saat save
    if (subItemToDelete?.id) {
      const subItemId =
        typeof subItemToDelete.id === "string"
          ? parseInt(subItemToDelete.id)
          : subItemToDelete.id;
      if (!isNaN(subItemId)) {
        setDeletedSubItems((prev) => [...prev, subItemId]);
      }
    }

    // Hapus dari state
    const updatedItems = [...items];
    updatedItems[itemIndex].subItems = updatedItems[itemIndex].subItems.filter(
      (_, i) => i !== subItemIndex
    );
    setItems(updatedItems);

    // Tutup modal
    setShowDeleteSubItemModal(false);
    setSubItemToDeleteIndex(null);
  };

  const handleDeleteMainFormSubItem = (subItemIndex: number) => {
    const subItemToDelete = subItems[subItemIndex];
    const confirmMessage = `Apakah Anda yakin ingin menghapus sub item ini?\n\nSub Item dengan kegiatan "${subItemToDelete.kegiatan || "(kosong)"
      }" dari Form Utama\n\n⚠️ Peringatan: Data yang dihapus tidak dapat dikembalikan. Semua data terkait seperti file yang sudah diupload oleh dosen, skor, dan data lainnya akan ikut hilang.`;

    if (window.confirm(confirmMessage)) {
      // Jika sub item punya id, berarti sudah ada di database, track untuk dihapus saat save
      if (subItemToDelete?.id) {
        const subItemId =
          typeof subItemToDelete.id === "string"
            ? parseInt(subItemToDelete.id)
            : subItemToDelete.id;
        if (!isNaN(subItemId)) {
          setDeletedSubItems((prev) => [...prev, subItemId]);
        }
      }

      // Hapus dari state
      const newSubItems = subItems.filter((_, i) => i !== subItemIndex);
      setSubItems(newSubItems);
    }
  };

  const handleDeleteMainForm = () => {
    const confirmMessage = `Apakah Anda yakin ingin menghapus form utama ini?\n\nForm Utama dengan NO "${form.no
      }" dan kegiatan "${form.kegiatan || "(kosong)"
      }"\n\n⚠️ Peringatan: Data yang dihapus tidak dapat dikembalikan. Semua data terkait seperti file yang sudah diupload oleh dosen, skor, dan data lainnya akan ikut hilang.`;

    if (window.confirm(confirmMessage)) {
      // Jika form utama punya id (dari editingItem), track untuk dihapus saat save
      if (editingItem?.id) {
        setDeletedMainForm(editingItem.id);
      }

      // Reset form
      setForm({
        no: "",
        kegiatan: "",
        indeks_poin: 0,
        unit_kerja: "",
        bukti_fisik: "",
        prosedur: "",
        bidang: selectedBidang || "",
      });
      setUseSubItem(false);
      setSubItems([]);
      setEditingItem(null);
      setEditMode(false);
    }
  };

  const handleEdit = (item: IKDPedomanItem) => {
    setEditingItem(item);
    setForm(item);
    setSelectedBidang(item.bidang);
    setEditMode(true);

    // Check if this item has sub items
    const hasSubs = hasSubItems(item);
    setUseSubItem(hasSubs);

    // Load sub items if this item has sub items
    if (hasSubs && item.id) {
      const mainNo = item.no;
      const loadedSubs = pedomanData
        .filter((subItem) => {
          if (!subItem.kegiatan || subItem.id === item.id) return false;

          // Filter berdasarkan parent_id jika ada
          if (subItem.parent_id === item.id) return true;

          // Atau filter berdasarkan format kegiatan yang dimulai dengan mainNo + "."
          const kegiatanTrimmed = subItem.kegiatan.trim();
          const pattern = new RegExp(
            `^${mainNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`
          );
          return (
            pattern.test(kegiatanTrimmed) && subItem.bidang === item.bidang
          );
        })
        .map((subItem) => ({
          id: subItem.id?.toString(),
          kegiatan: subItem.kegiatan,
          indeks_poin: subItem.indeks_poin || 0,
          unit_kerja: subItem.unit_kerja || "",
          bukti_fisik: subItem.bukti_fisik || "",
          prosedur: subItem.prosedur || "",
        }));
      setSubItems(loadedSubs);
    } else {
      setSubItems([]);
    }

    // Check if this item is a sub item (kegiatan starts with number.number)
    const isSub = /^\d+\.\d+/.test(item.kegiatan);
    if (isSub) {
      // Find parent item
      const parentNo = item.no;
      const parent = pedomanData.find(
        (p) => p.id && p.no === parentNo && !/^\d+\.\d+/.test(p.kegiatan)
      );
      if (parent) {
        setParentItemId(parent.id);
      }
    }

    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditMode(false);
    setEditingItem(null);
    setSuccess(null);
    setError(null);
    setUseSubItem(false);
    setParentItemId(null);
    setSubItems([]);
    setForm({
      no: "",
      kegiatan: "",
      indeks_poin: 0,
      unit_kerja: "",
      bukti_fisik: "",
      prosedur: "",
      bidang: "",
    });
  };

  // Check if kegiatan is sub item with number format only (1.1, 1.2) vs letter format (1.1.a, 1.1.b)
  const isSubItemNumberOnly = (kegiatan: string): boolean => {
    if (!kegiatan) return false;
    // Pattern: starts with number.number (like 1.1, 1.2) but NOT number.number.letter (like 1.1.a, 1.1.b)
    // Check if kegiatan starts with pattern like "1.1", "1.2", etc. (number.number)
    const numberOnlyMatch = kegiatan.match(/^(\d+\.\d+)(\.|$|\s)/);
    if (!numberOnlyMatch) return false;

    // Check if there's a letter pattern after (like "1.1.a", "1.1.b")
    // Look for pattern: number.number.letter
    const letterPatternMatch = kegiatan.match(/^\d+\.\d+\.([a-z])/i);

    // If there's a letter pattern, it's NOT number-only format
    // If no letter pattern, it IS number-only format
    return !letterPatternMatch;
  };

  // Check if sub item kegiatan is number format only (for sub items in list)
  const isSubItemNumberOnlyInList = (kegiatan: string): boolean => {
    if (!kegiatan) return false;
    // Remove leading/trailing spaces and check pattern
    const trimmed = kegiatan.trim();
    // Pattern: starts with number.number (like 1.1, 1.2) but NOT number.number.letter (like 1.1.a, 1.1.b)
    const match = trimmed.match(/^(\d+\.\d+)(\s|$|\.)/);
    if (!match) return false;
    // Check if there's a letter after the number (like 1.1.a)
    const afterMatch = trimmed.match(/^\d+\.\d+\.([a-z])/i);
    return !afterMatch; // Return true if NO letter after number.number
  };

  // Check if kegiatan has any numbered format (1.1, 2.a, 1.1.a, etc.)
  // If kegiatan doesn't have numbered format, fields are optional
  const hasNumberedFormat = (kegiatan: string): boolean => {
    if (!kegiatan) return false;
    const trimmed = kegiatan.trim();
    // Check for format: number.number (like 1.1, 2.2)
    const numberNumberMatch = trimmed.match(/^\d+\.\d+/);
    // Check for format: number.letter (like 2.a, 3.b)
    const numberLetterMatch = trimmed.match(/^\d+\.([a-z])/i);
    // Check for format: number.number.letter (like 1.1.a, 1.1.b)
    const numberNumberLetterMatch = trimmed.match(/^\d+\.\d+\.([a-z])/i);

    return !!(
      numberNumberMatch ||
      numberLetterMatch ||
      numberNumberLetterMatch
    );
  };

  // Check if kegiatan has numbered format WITH letter (1.1.a, 2.a, etc.)
  // Only these formats require Unit Kerja to be filled
  const hasNumberedFormatWithLetter = (kegiatan: string): boolean => {
    if (!kegiatan) return false;
    const trimmed = kegiatan.trim();
    // Check for format: number.letter (like 2.a, 3.b)
    const numberLetterMatch = trimmed.match(/^\d+\.([a-z])/i);
    // Check for format: number.number.letter (like 1.1.a, 1.1.b)
    const numberNumberLetterMatch = trimmed.match(/^\d+\.\d+\.([a-z])/i);

    return !!(numberLetterMatch || numberNumberLetterMatch);
  };

  // Check if item has sub items (check if there are items with kegiatan starting with this item's no + ".")
  const hasSubItems = (item: IKDPedomanItem): boolean => {
    if (!item.id) return false;
    const subItems = pedomanData.filter((subItem) => {
      if (!subItem.kegiatan || subItem.id === item.id) return false;

      // Check berdasarkan parent_id
      if (subItem.parent_id === item.id) return true;

      // Check if kegiatan starts with item.no + "." (like "1.1", "1.2", "1.1.a", "2.a", etc.)
      const kegiatanTrimmed = subItem.kegiatan.trim();
      const pattern = new RegExp(
        `^${item.no.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`
      );
      return pattern.test(kegiatanTrimmed) && subItem.bidang === item.bidang;
    });
    return subItems.length > 0;
  };

  // Helper function untuk validasi format kegiatan (harus ada spasi setelah nomor)
  const validateKegiatanFormat = (
    kegiatan: string
  ): { isValid: boolean; errorMessage?: string } => {
    if (!kegiatan || String(kegiatan).trim() === "") {
      return { isValid: true }; // Kosong tidak perlu divalidasi di sini
    }

    const kegiatanTrimmed = String(kegiatan).trim();

    // Cek jika kegiatan dimulai dengan nomor (tanpa menangkap titik di akhir)
    const numberPattern = /^(\d+(?:\.\d+)*(?:\.[a-zA-Z])?)/;
    const numberMatch = kegiatanTrimmed.match(numberPattern);

    if (numberMatch) {
      const numberPart = numberMatch[1]; // e.g., "1.4", "1.1.a", "1.4.a" (tanpa titik di akhir)
      const afterNumber = kegiatanTrimmed.substring(numberPart.length);

      // Jika ada bagian setelah nomor
      if (afterNumber.length > 0) {
        const firstChar = afterNumber[0];

        // Jika karakter pertama adalah huruf (tanpa spasi), error
        // Contoh error: "1.4contoh", "1.1Memberi", "1.1.aCSL"
        if (/[a-zA-Z]/.test(firstChar)) {
          return {
            isValid: false,
            errorMessage:
              "Kegiatan yang dimulai dengan nomor harus memiliki spasi setelah nomor (contoh: '1.4 contoh', bukan '1.4contoh')",
          };
        }
        // Jika karakter pertama adalah titik, cek karakter kedua
        // Contoh valid: "1.1.a. CSL" (titik lalu spasi)
        // Contoh error: "1.4.acontoh" (titik lalu langsung huruf)
        else if (firstChar === ".") {
          if (afterNumber.length > 1) {
            const secondChar = afterNumber[1];
            // Jika setelah titik langsung huruf tanpa spasi, error
            if (/[a-zA-Z]/.test(secondChar)) {
              return {
                isValid: false,
                errorMessage:
                  "Kegiatan yang dimulai dengan nomor harus memiliki spasi setelah nomor (contoh: '1.4.a contoh', bukan '1.4.acontoh')",
              };
            }
          }
        }
        // Jika karakter pertama adalah spasi, valid (tidak perlu cek lebih lanjut)
      }
    }

    return { isValid: true };
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (!selectedBidang) {
        setError("Pilih Bidang terlebih dahulu");
        setIsSaving(false);
        return;
      }

      // Validate: harus ada minimal 1 item (dari items atau form)
      if (items.length === 0 && !form.no) {
        setError("Minimal harus ada 1 item yang akan disimpan");
        return;
      }

      // Hapus items yang sudah dihapus dari database
      // Hapus duplikasi ID
      const uniqueDeletedItems = [...new Set(deletedItems)];
      for (const deletedId of uniqueDeletedItems) {
        try {
          // Pastikan ID valid (number)
          if (deletedId && !isNaN(deletedId) && deletedId > 0) {
            await api.delete(`/rekap-ikd/pedoman-poin/${deletedId}`);
          }
        } catch (err: any) {
          // Jika 404, berarti item sudah dihapus atau tidak ada, skip saja (tidak perlu error)
          if (err?.response?.status !== 404) {
            console.error("Error deleting item:", err);
          }
        }
      }

      // Hapus sub items yang sudah dihapus dari database
      // Hapus duplikasi ID
      const uniqueDeletedSubItems = [...new Set(deletedSubItems)];
      for (const deletedSubId of uniqueDeletedSubItems) {
        try {
          // Pastikan ID valid (number)
          if (deletedSubId && !isNaN(deletedSubId) && deletedSubId > 0) {
            await api.delete(`/rekap-ikd/pedoman-poin/${deletedSubId}`);
          }
        } catch (err: any) {
          // Jika 404, berarti item sudah dihapus atau tidak ada, skip saja (tidak perlu error)
          if (err?.response?.status !== 404) {
            console.error("Error deleting sub item:", err);
          }
        }
      }

      // Hapus form utama yang sudah dihapus dari database
      if (deletedMainForm && !isNaN(deletedMainForm)) {
        try {
          await api.delete(`/rekap-ikd/pedoman-poin/${deletedMainForm}`);
        } catch (err: any) {
          // Jika 404, berarti item sudah dihapus atau tidak ada, skip saja
          if (err?.response?.status !== 404) {
            console.error("Error deleting main form:", err);
          }
        }
      }

      // Save all items from state 'items' first (items yang sudah ditambahkan)
      const savedItemIds: number[] = [];

      for (const item of items) {
        if (!item.no) {
          continue; // Skip if no NO
        }

        // Validate kegiatan format (harus ada spasi setelah nomor)
        if (item.kegiatan) {
          const kegiatanValidation = validateKegiatanFormat(item.kegiatan);
          if (!kegiatanValidation.isValid) {
            setError(`Item ${item.no}: ${kegiatanValidation.errorMessage}`);
            return;
          }
        }

        // Validate unit kerja: only required if kegiatan has numbered format WITH letter (1.1.a, 2.a, etc.)
        // Format angka saja (1.1, 2.2) is optional
        const hasFormatWithLetter = hasNumberedFormatWithLetter(item.kegiatan);
        if (hasFormatWithLetter && !item.unit_kerja) {
          setError(`Unit Kerja harus diisi untuk Item ${item.no}`);
          return;
        }

        // Save main item
        // Format angka saja (1.1, 2.2) is optional, so keep user input
        const isItemNumberOnly =
          item.useSubItem && isSubItemNumberOnlyInList(item.kegiatan);
        // Get bidang nama from bidangList
        const bidangInfo = bidangList.find((b) => b.kode === selectedBidang);
        const mainPayload = {
          no: item.no,
          kegiatan: item.kegiatan || "",
          indeks_poin: item.indeks_poin || 0,
          unit_kerja: item.unit_kerja || "",
          bukti_fisik: item.bukti_fisik || "",
          prosedur: item.prosedur || "",
          bidang: selectedBidang,
          bidang_nama: bidangInfo?.nama || null,
        };

        try {
          let mainItemId: number;

          // Cek apakah item sudah ada di database (berdasarkan id atau kombinasi no + bidang)
          if (item.id) {
            // Item sudah ada, update saja (termasuk jika kegiatan berubah menjadi kosong/judul)
            await api.put(`/rekap-ikd/pedoman-poin/${item.id}`, mainPayload);
            mainItemId = item.id;
          } else {
            // Cek apakah ada item dengan no + bidang yang sama (level 0, tanpa parent_id)
            // Tidak perlu cek kegiatan karena kegiatan bisa berubah (misalnya dari data lengkap jadi judul kosong)
            const existingItem = pedomanData.find(
              (existing) =>
                existing.no === item.no &&
                existing.bidang === selectedBidang &&
                (existing.level === 0 || existing.level === undefined) &&
                (!existing.parent_id || existing.parent_id === null)
            );

            if (existingItem?.id) {
              // Item sudah ada, update saja (termasuk jika kegiatan berubah)
              await api.put(
                `/rekap-ikd/pedoman-poin/${existingItem.id}`,
                mainPayload
              );
              mainItemId = existingItem.id;
            } else {
              // Item belum ada, create baru
              const res = await api.post(
                "/rekap-ikd/pedoman-poin",
                mainPayload
              );
              mainItemId = res.data?.data?.id || res.data?.id;
            }
          }

          savedItemIds.push(mainItemId);

          // Save sub items for this item if useSubItem is enabled
          if (item.useSubItem && item.subItems.length > 0 && mainItemId) {
            const mainNo = item.no;

            for (const subItem of item.subItems) {
              if (subItem.kegiatan.trim()) {
                // Validate kegiatan format (harus ada spasi setelah nomor)
                const kegiatanValidation = validateKegiatanFormat(
                  subItem.kegiatan
                );
                if (!kegiatanValidation.isValid) {
                  setError(
                    `Sub Item untuk Item ${item.no}: ${kegiatanValidation.errorMessage}`
                  );
                  return;
                }

                // All fields are optional, so keep user input regardless of format
                // Get bidang nama from bidangList
                const bidangInfo = bidangList.find(
                  (b) => b.kode === selectedBidang
                );
                const subPayload = {
                  no: mainNo, // Same NO as parent
                  kegiatan: subItem.kegiatan,
                  indeks_poin: subItem.indeks_poin || 0,
                  unit_kerja: subItem.unit_kerja || "",
                  bukti_fisik: subItem.bukti_fisik || "",
                  prosedur: subItem.prosedur || "",
                  bidang: selectedBidang,
                  bidang_nama: bidangInfo?.nama || null,
                };

                try {
                  // Cek apakah sub item sudah ada di database
                  // ID temporary (dimulai dengan "sub-") berarti item baru, gunakan POST
                  const isTemporaryId =
                    typeof subItem.id === "string" &&
                    subItem.id.startsWith("sub-");

                  if (subItem.id && !isTemporaryId) {
                    // Sub item sudah ada di database (punya ID number), update saja
                    const subItemId =
                      typeof subItem.id === "string"
                        ? parseInt(subItem.id)
                        : subItem.id;
                    if (!isNaN(subItemId) && subItemId > 0) {
                      await api.put(
                        `/rekap-ikd/pedoman-poin/${subItemId}`,
                        subPayload
                      );
                    }
                  } else {
                    // Cek apakah ada sub item dengan no + bidang + kegiatan yang sama
                    const existingSubItem = pedomanData.find(
                      (existing) =>
                        existing.no === mainNo &&
                        existing.bidang === selectedBidang &&
                        existing.kegiatan === subItem.kegiatan &&
                        (existing.parent_id === mainItemId ||
                          existing.level === 1)
                    );

                    if (existingSubItem?.id) {
                      // Sub item sudah ada, update saja
                      await api.put(
                        `/rekap-ikd/pedoman-poin/${existingSubItem.id}`,
                        subPayload
                      );
                    } else {
                      // Sub item belum ada, create baru
                      await api.post("/rekap-ikd/pedoman-poin", {
                        ...subPayload,
                        parent_id: mainItemId,
                        level: 1,
                      });
                    }
                  }
                } catch (err) {
                  console.error("Error saving sub item:", err);
                }
              }
            }
          }
        } catch (err: any) {
          console.error("Error saving item:", err);
          setError(
            err?.response?.data?.message ||
            `Gagal menyimpan Item ${item.no}. Silakan coba lagi.`
          );
          return;
        }
      }

      // Save form utama (if there's data in form)
      // Form utama tidak wajib jika sudah ada items yang disimpan
      if (form.no && form.kegiatan) {
        // Validate kegiatan format (harus ada spasi setelah nomor)
        const kegiatanValidation = validateKegiatanFormat(form.kegiatan);
        if (!kegiatanValidation.isValid) {
          setError(`Form Utama: ${kegiatanValidation.errorMessage}`);
          return;
        }

        // Unit Kerja hanya wajib jika kegiatan memiliki format angka DENGAN huruf (1.1.a, 2.a, etc.)
        // Format angka saja (1.1, 2.2) is optional
        const hasFormatWithLetter = hasNumberedFormatWithLetter(form.kegiatan);
        if (hasFormatWithLetter && !form.unit_kerja) {
          setError("Unit Kerja harus diisi untuk form utama");
          return;
        }

        // Save main item
        let mainItemId: number | undefined;

        // Get bidang nama from bidangList
        const bidangInfo = bidangList.find((b) => b.kode === selectedBidang);
        // Save form data - all fields are optional for format angka saja (1.1, 2.2)
        const mainPayload = {
          ...form,
          bidang: selectedBidang,
          bidang_nama: bidangInfo?.nama || null,
          // Keep user input (all fields optional)
          indeks_poin: form.indeks_poin || 0,
          unit_kerja: form.unit_kerja || "",
          bukti_fisik: form.bukti_fisik || "",
          prosedur: form.prosedur || "",
        };

        if (editMode && editingItem?.id) {
          // Edit mode: update existing item
          await api.put(
            `/rekap-ikd/pedoman-poin/${editingItem.id}`,
            mainPayload
          );
          mainItemId = editingItem.id;
        } else {
          // Cek apakah form utama sudah ada di database
          // Cek apakah ada item dengan no + bidang yang sama (level 0, tanpa parent_id)
          // Tidak perlu cek kegiatan karena kegiatan bisa berubah (misalnya dari data lengkap jadi judul kosong)
          const existingFormItem = pedomanData.find(
            (existing) =>
              existing.no === form.no &&
              existing.bidang === selectedBidang &&
              (existing.level === 0 || existing.level === undefined) &&
              (!existing.parent_id || existing.parent_id === null)
          );

          if (existingFormItem?.id) {
            // Form utama sudah ada, update saja (termasuk jika kegiatan berubah menjadi kosong/judul)
            await api.put(
              `/rekap-ikd/pedoman-poin/${existingFormItem.id}`,
              mainPayload
            );
            mainItemId = existingFormItem.id;
          } else {
            // Form utama belum ada, create baru
            const res = await api.post("/rekap-ikd/pedoman-poin", mainPayload);
            mainItemId = res.data?.data?.id || res.data?.id;
          }
        }

        // Save sub items if useSubItem is enabled
        if (useSubItem && subItems.length > 0 && mainItemId) {
          // Get main item no for sub items
          const mainNo = form.no;

          // Delete existing sub items if editing
          if (editMode && editingItem?.id) {
            const existingSubs = pedomanData.filter((item) => {
              if (!item.kegiatan) return false;
              const pattern = new RegExp(
                `^${mainNo.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`
              );
              return pattern.test(item.kegiatan) && item.id !== mainItemId;
            });

            for (const sub of existingSubs) {
              if (sub.id) {
                try {
                  await api.delete(`/rekap-ikd/pedoman-poin/${sub.id}`);
                } catch (err) {
                  console.error("Error deleting sub item:", err);
                }
              }
            }
          }

          // Save new sub items
          // Get bidang nama from bidangList
          const bidangInfo = bidangList.find((b) => b.kode === selectedBidang);
          for (const subItem of subItems) {
            if (subItem.kegiatan.trim()) {
              // Validate kegiatan format (harus ada spasi setelah nomor)
              const kegiatanValidation = validateKegiatanFormat(
                subItem.kegiatan
              );
              if (!kegiatanValidation.isValid) {
                setError(`Sub Item: ${kegiatanValidation.errorMessage}`);
                return;
              }

              // All fields are optional, so keep user input regardless of format
              const subPayload = {
                no: mainNo, // Same NO as parent
                kegiatan: subItem.kegiatan,
                indeks_poin: subItem.indeks_poin || 0,
                unit_kerja: subItem.unit_kerja || "",
                bukti_fisik: subItem.bukti_fisik || "",
                prosedur: subItem.prosedur || "",
                bidang: selectedBidang,
                bidang_nama: bidangInfo?.nama || null,
              };

              try {
                // Cek apakah sub item sudah ada di database
                // ID temporary (dimulai dengan "sub-") berarti item baru, gunakan POST
                const isTemporaryId =
                  typeof subItem.id === "string" &&
                  subItem.id.startsWith("sub-");

                if (subItem.id && !isTemporaryId) {
                  // Sub item sudah ada di database (punya ID number), update saja
                  const subItemId =
                    typeof subItem.id === "string"
                      ? parseInt(subItem.id)
                      : subItem.id;
                  if (!isNaN(subItemId) && subItemId > 0) {
                    await api.put(
                      `/rekap-ikd/pedoman-poin/${subItemId}`,
                      subPayload
                    );
                  }
                } else {
                  // Cek apakah ada sub item dengan no + bidang + kegiatan yang sama
                  const existingSubItem = pedomanData.find(
                    (existing) =>
                      existing.no === mainNo &&
                      existing.bidang === selectedBidang &&
                      existing.kegiatan === subItem.kegiatan &&
                      (existing.parent_id === mainItemId ||
                        existing.level === 1)
                  );

                  if (existingSubItem?.id) {
                    // Sub item sudah ada, update saja
                    await api.put(
                      `/rekap-ikd/pedoman-poin/${existingSubItem.id}`,
                      subPayload
                    );
                  } else {
                    // Sub item belum ada, create baru
                    await api.post("/rekap-ikd/pedoman-poin", {
                      ...subPayload,
                      parent_id: mainItemId,
                      level: 1,
                    });
                  }
                }
              } catch (err) {
                console.error("Error saving sub item:", err);
              }
            }
          }
        }
      }

      // Reset deleted items tracking
      setDeletedItems([]);
      setDeletedSubItems([]);
      setDeletedMainForm(null);

      const totalItemsSaved = savedItemIds.length + (form.no ? 1 : 0);
      setSuccess(`${totalItemsSaved} item Pedoman IKD berhasil disimpan`);
      await fetchPedomanData();
      handleCloseModal();
    } catch (error: any) {
      console.error("Error saving pedoman:", error);
      setError(
        error?.response?.data?.message ||
        "Gagal menyimpan data. Silakan coba lagi."
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddBidang = async () => {
    setBidangModalError(null);

    if (!newBidang.kode.trim()) {
      setBidangModalError("Kode Bidang harus diisi");
      return;
    }

    if (!newBidang.nama.trim()) {
      setBidangModalError("Nama Bidang harus diisi");
      return;
    }

    // Jika sedang edit, cek apakah kode berubah
    if (editingBidang) {
      // Jika kode berubah, cek apakah kode baru sudah ada
      if (
        editingBidang.kode.toUpperCase() !== newBidang.kode.toUpperCase().trim()
      ) {
        const bidangExists = bidangList.find(
          (b) => b.kode.toUpperCase() === newBidang.kode.toUpperCase().trim()
        );
        if (bidangExists) {
          setBidangModalError(
            `Kode Bidang "${newBidang.kode
              .toUpperCase()
              .trim()}" sudah ada. Gunakan kode yang berbeda.`
          );
          return;
        }
      }

      // Update bidang yang sedang di-edit
      const updatedBidangList = bidangList.map((b) =>
        b.kode === editingBidang.kode
          ? {
            ...b,
            kode: newBidang.kode.toUpperCase().trim(),
            nama: newBidang.nama.trim(),
          }
          : b
      );
      setBidangList(updatedBidangList);

      // Update bidang dan bidang_nama di semua pedoman dengan bidang ini
      const pedomanWithBidang = pedomanData.filter(
        (item) => item.bidang === editingBidang.kode
      );
      for (const item of pedomanWithBidang) {
        if (item.id) {
          try {
            await api.put(`/rekap-ikd/pedoman-poin/${item.id}`, {
              ...item,
              bidang: newBidang.kode.toUpperCase().trim(),
              bidang_nama: newBidang.nama.trim(),
            });
          } catch (err) {
            console.error("Error updating pedoman bidang:", err);
          }
        }
      }

      setNewBidang({ kode: "", nama: "" });
      setEditingBidang(null);
      setBidangModalError(null);
      setSuccess(
        `Bidang berhasil diupdate menjadi ${newBidang.kode
          .toUpperCase()
          .trim()} - ${newBidang.nama.trim()}`
      );
      await fetchPedomanData();
      setShowBidangModal(false);
      return;
    }

    // Tambah bidang baru
    const bidangExists = bidangList.find(
      (b) => b.kode.toUpperCase() === newBidang.kode.toUpperCase().trim()
    );
    if (bidangExists) {
      setBidangModalError(
        `Kode Bidang "${newBidang.kode
          .toUpperCase()
          .trim()}" sudah ada. Gunakan kode yang berbeda.`
      );
      return;
    }

    const newBidangItem: IKDBidang = {
      kode: newBidang.kode.toUpperCase().trim(),
      nama: newBidang.nama.trim(),
      is_auto: false,
    };

    setBidangList([...bidangList, newBidangItem]);
    setNewBidang({ kode: "", nama: "" });
    setBidangModalError(null);
    setSuccess(
      `Bidang ${newBidangItem.kode} - ${newBidangItem.nama} berhasil ditambahkan`
    );
    setShowBidangModal(false);
  };

  const handleEditBidang = (bidang: IKDBidang) => {
    setEditingBidang(bidang);
    setNewBidang({ kode: bidang.kode, nama: bidang.nama });
    setBidangModalError(null);
  };

  const handleDeleteBidang = async () => {
    if (!bidangToDelete) return;

    try {
      setLoading(true);

      // Hapus semua pedoman dengan bidang ini
      const pedomanWithBidang = pedomanData.filter(
        (item) => item.bidang === bidangToDelete.kode
      );
      for (const item of pedomanWithBidang) {
        if (item.id) {
          try {
            await api.delete(`/rekap-ikd/pedoman-poin/${item.id}`);
          } catch (err: any) {
            // Jika error 404, berarti item sudah tidak ada di database (mungkin sudah dihapus)
            // Ini tidak perlu di-log sebagai error karena tidak masalah
            if (err?.response?.status !== 404) {
              console.error("Error deleting pedoman:", err);
            }
            // Untuk error 404, kita skip saja karena item sudah tidak ada
          }
        }
      }

      // Simpan info bidang yang dihapus sebelum set null
      const deletedBidangKode = bidangToDelete.kode;
      const deletedBidangNama = bidangToDelete.nama;

      // Reset bidangToDelete
      setBidangToDelete(null);

      // Reload data setelah penghapusan - ini akan update pedomanData dan bidangList
      await fetchPedomanData();

      // Pastikan bidangList juga di-update (hapus bidang yang sudah dihapus)
      setBidangList((prevList) =>
        prevList.filter((b) => b.kode !== deletedBidangKode)
      );

      // Set success message
      setSuccess(
        `Bidang ${deletedBidangKode} - ${deletedBidangNama} dan semua item-nya berhasil dihapus`
      );

      // Auto-dismiss success message setelah 3 detik
      setTimeout(() => {
        setSuccess(null);
      }, 3000);
    } catch (error: any) {
      console.error("Error deleting bidang:", error);
      setError("Gagal menghapus bidang. Silakan coba lagi.");
    } finally {
      setLoading(false);
    }
  };

  // Download template Excel untuk import
  const downloadTemplate = async () => {
    // Data contoh untuk template
    const templateData = [
      {
        bidang: "A",
        no: "1",
        kegiatan: "Memberi kuliah jenjang D3/S1",
        indeks_poin: 2.0,
        unit_kerja: "Akademik, Dosen",
        bukti_fisik:
          "Surat Tugas, Absensi Dosen dan Mahasiswa serta Daftar Nilai Mahasiswa",
        prosedur: "Mengisi absen dan penilaian formatif (bila ada)",
        is_sub_item: "N",
        parent_no: "",
      },
      {
        bidang: "A",
        no: "1",
        kegiatan: "1.1 Memberi kuliah jenjang D3/S1",
        indeks_poin: 2.0,
        unit_kerja: "Akademik",
        bukti_fisik: "Surat Tugas, Absensi",
        prosedur: "Mengisi absen",
        is_sub_item: "Y",
        parent_no: "1",
      },
      {
        bidang: "A",
        no: "1",
        kegiatan: "1.2 Memberi kuliah jenjang S2",
        indeks_poin: 2.5,
        unit_kerja: "Akademik",
        bukti_fisik: "Surat Tugas, Absensi",
        prosedur: "Mengisi absen",
        is_sub_item: "Y",
        parent_no: "1",
      },
      {
        bidang: "D",
        no: "2",
        kegiatan: "Menjadi Instruktur laboratorium/praktikum",
        indeks_poin: 1.5,
        unit_kerja: "Akademik, Profesi",
        bukti_fisik: "Surat Tugas, Absensi",
        prosedur: "Mengisi absen saat kegiatan",
        is_sub_item: "N",
        parent_no: "",
      },
    ];

    // Buat worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set lebar kolom
    const colWidths = [
      { wch: 10 }, // bidang
      { wch: 8 }, // no
      { wch: 50 }, // kegiatan
      { wch: 12 }, // indeks_poin
      { wch: 30 }, // unit_kerja
      { wch: 50 }, // bukti_fisik
      { wch: 50 }, // prosedur
      { wch: 12 }, // is_sub_item
      { wch: 12 }, // parent_no
    ];
    ws["!cols"] = colWidths;

    // Buat workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pedoman IKD");

    // Generate file dan download
    XLSX.writeFile(wb, "Template_Import_Pedoman_IKD.xlsx");
  };

  // Export data ke Excel
  const exportToExcel = async () => {
    try {
      // Flatten data: main items dan sub-items menjadi satu array
      const dataToExport: any[] = [];

      // Group by bidang untuk export
      const exportGroupedData = pedomanData.reduce((acc, item) => {
        if (!acc[item.bidang]) {
          acc[item.bidang] = [];
        }
        acc[item.bidang].push(item);
        return acc;
      }, {} as Record<string, IKDPedomanItem[]>);

      Object.keys(exportGroupedData).forEach((bidang) => {
        exportGroupedData[bidang].forEach((item) => {
          const isSubItem =
            item.level === 1 ||
            (item.parent_id !== null && item.parent_id !== undefined);

          dataToExport.push({
            bidang: item.bidang || "",
            no: item.no || "",
            kegiatan: item.kegiatan || "",
            indeks_poin: item.indeks_poin || 0,
            unit_kerja: item.unit_kerja || "",
            bukti_fisik: item.bukti_fisik || "",
            prosedur: item.prosedur || "",
            is_sub_item: isSubItem ? "Y" : "N",
            parent_no: isSubItem ? item.no : "",
          });
        });
      });

      // Buat workbook baru
      const wb = XLSX.utils.book_new();

      // Buat worksheet untuk data utama
      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // Set lebar kolom
      const colWidths = [
        { wch: 10 }, // bidang
        { wch: 8 }, // no
        { wch: 50 }, // kegiatan
        { wch: 12 }, // indeks_poin
        { wch: 30 }, // unit_kerja
        { wch: 50 }, // bukti_fisik
        { wch: 50 }, // prosedur
        { wch: 12 }, // is_sub_item
        { wch: 12 }, // parent_no
      ];
      ws["!cols"] = colWidths;

      // Tambahkan header dengan styling
      const headerRange = XLSX.utils.decode_range(ws["!ref"] || "A1");
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) continue;

        // Set header styling
        ws[cellAddress].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4472C4" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }

      // Tambahkan border untuk semua data
      const dataRange = XLSX.utils.decode_range(ws["!ref"] || "A1");
      for (let row = dataRange.s.r; row <= dataRange.e.r; row++) {
        for (let col = dataRange.s.c; col <= dataRange.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!ws[cellAddress]) continue;

          if (!ws[cellAddress].s) ws[cellAddress].s = {};
          ws[cellAddress].s.border = {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } },
          };

          // Alternating row colors
          if (row > 0) {
            ws[cellAddress].s.fill = {
              fgColor: { rgb: row % 2 === 0 ? "F8F9FA" : "FFFFFF" },
            };
          }
        }
      }

      // Buat worksheet untuk ringkasan
      const summaryData = [
        ["RINGKASAN DATA PEDOMAN IKD"],
        [""],
        ["Total Data", dataToExport.length],
        [
          "Main Items",
          dataToExport.filter((d) => d.is_sub_item === "N").length,
        ],
        ["Sub Items", dataToExport.filter((d) => d.is_sub_item === "Y").length],
        [""],
        ["Data per Bidang:"],
        ...Object.keys(exportGroupedData).map((bidang) => [
          `Bidang ${bidang}`,
          exportGroupedData[bidang].length,
        ]),
        [""],
        ["Tanggal Export", new Date().toLocaleString("id-ID")],
        ["Dibuat oleh", "Sistem ISME FKK"],
      ];

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs["!cols"] = [{ wch: 25 }, { wch: 30 }];

      // Styling untuk summary
      summaryWs["A1"].s = {
        font: { bold: true, size: 16, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "2F5597" } },
        alignment: { horizontal: "center", vertical: "center" },
      };

      // Tambahkan border untuk summary
      const summaryRange = XLSX.utils.decode_range(summaryWs["!ref"] || "A1");
      for (let row = summaryRange.s.r; row <= summaryRange.e.r; row++) {
        for (let col = summaryRange.s.c; col <= summaryRange.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!summaryWs[cellAddress]) continue;

          if (!summaryWs[cellAddress].s) summaryWs[cellAddress].s = {};
          summaryWs[cellAddress].s.border = {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } },
          };
        }
      }

      // Tambahkan worksheet ke workbook
      XLSX.utils.book_append_sheet(wb, ws, "Data Pedoman IKD");
      XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

      // Generate filename dengan timestamp
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
      const filename = `Data_Pedoman_IKD_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      setError("Gagal mengekspor data ke Excel. Silakan coba lagi.");
    }
  };

  // Read Excel file
  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Get data as array of arrays
          const aoa = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
          }) as any[][];

          if (aoa.length === 0) {
            resolve([]);
            return;
          }

          const rawHeaders = aoa[0];
          // Normalize headers: lowercase, trim spaces, replace spaces with underscores
          const normalizedHeaders = rawHeaders.map((h: string) =>
            String(h).toLowerCase().trim().replace(/\s+/g, "_")
          );

          const jsonData: any[] = [];
          for (let i = 1; i < aoa.length; i++) {
            const rowData: any = {};
            const currentRow = aoa[i];
            normalizedHeaders.forEach((header, index) => {
              rowData[header] = currentRow[index];
            });
            jsonData.push(rowData);
          }

          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  // Validate Excel data
  const validateExcelData = (
    excelData: any[],
    existingData: IKDPedomanItem[]
  ): {
    errors: Array<{ row: number; field: string; message: string }>;
    cellErrors: Array<{ row: number; field: string; message: string }>;
  } => {
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const cellErrors: Array<{ row: number; field: string; message: string }> =
      [];

    excelData.forEach((row, index) => {
      const rowNum = index + 2; // +2 karena row 1 adalah header, dan index dimulai dari 0

      // Validasi bidang
      if (!row.bidang || String(row.bidang).trim() === "") {
        const error = {
          row: rowNum,
          field: "bidang",
          message: "Bidang harus diisi",
        };
        errors.push(error);
        cellErrors.push(error);
      }

      // Validasi no
      if (!row.no || String(row.no).trim() === "") {
        const error = { row: rowNum, field: "no", message: "NO harus diisi" };
        errors.push(error);
        cellErrors.push(error);
      }

      // Validasi kegiatan
      if (!row.kegiatan || String(row.kegiatan).trim() === "") {
        const error = {
          row: rowNum,
          field: "kegiatan",
          message: "Kegiatan harus diisi",
        };
        errors.push(error);
        cellErrors.push(error);
      } else {
        const kegiatan = String(row.kegiatan).trim();
        // Validasi format menggunakan helper function
        const kegiatanValidation = validateKegiatanFormat(kegiatan);
        if (!kegiatanValidation.isValid) {
          const error = {
            row: rowNum,
            field: "kegiatan",
            message:
              kegiatanValidation.errorMessage || "Format kegiatan tidak valid",
          };
          errors.push(error);
          cellErrors.push(error);
        }
      }

      // Validasi indeks_poin (harus angka)
      const indeksPoin = row.indeks_poin;
      if (
        indeksPoin !== undefined &&
        indeksPoin !== null &&
        indeksPoin !== ""
      ) {
        const numPoin = Number(indeksPoin);
        if (isNaN(numPoin) || numPoin < 0) {
          const error = {
            row: rowNum,
            field: "indeks_poin",
            message: "Indeks Poin harus berupa angka >= 0",
          };
          errors.push(error);
          cellErrors.push(error);
        }
      }

      // Validasi is_sub_item
      const isSubItem =
        typeof row.is_sub_item === "boolean"
          ? row.is_sub_item
            ? "Y"
            : "N"
          : String(row.is_sub_item || "")
            .toUpperCase()
            .trim();
      if (
        isSubItem &&
        isSubItem !== "Y" &&
        isSubItem !== "N" &&
        isSubItem !== "YES" &&
        isSubItem !== "NO" &&
        isSubItem !== "TRUE" &&
        isSubItem !== "FALSE" &&
        isSubItem !== "1" &&
        isSubItem !== "0"
      ) {
        const error = {
          row: rowNum,
          field: "is_sub_item",
          message: "Is Sub Item harus Y/N, Yes/No, True/False, atau 1/0",
        };
        errors.push(error);
        cellErrors.push(error);
      }

      // Validasi parent_no jika is_sub_item = Y
      const isSubItemBool =
        isSubItem === "Y" ||
        isSubItem === "YES" ||
        isSubItem === "TRUE" ||
        isSubItem === "1" ||
        row.is_sub_item === true;
      if (
        isSubItemBool &&
        (!row.parent_no || String(row.parent_no).trim() === "")
      ) {
        const error = {
          row: rowNum,
          field: "parent_no",
          message: "Parent NO harus diisi jika Is Sub Item = Y",
        };
        errors.push(error);
        cellErrors.push(error);
      }

      // Validasi duplikasi/konflik dalam data yang di-import
      const duplicateRows = excelData.filter((otherRow, otherIdx) => {
        if (otherIdx === index) return false;
        const otherIsSubItem =
          typeof otherRow.is_sub_item === "boolean"
            ? otherRow.is_sub_item
            : String(otherRow.is_sub_item || "")
              .toUpperCase()
              .trim() === "Y" ||
            String(otherRow.is_sub_item || "")
              .toUpperCase()
              .trim() === "YES" ||
            String(otherRow.is_sub_item || "")
              .toUpperCase()
              .trim() === "TRUE" ||
            String(otherRow.is_sub_item || "")
              .toUpperCase()
              .trim() === "1";
        return (
          String(otherRow.bidang || "").trim() ===
          String(row.bidang || "").trim() &&
          String(otherRow.no || "").trim() === String(row.no || "").trim() &&
          String(otherRow.kegiatan || "").trim() ===
          String(row.kegiatan || "").trim() &&
          otherIsSubItem === isSubItemBool
        );
      });

      if (duplicateRows.length > 0) {
        const errorKegiatan = {
          row: rowNum,
          field: "kegiatan",
          message: "Data duplikat ditemukan dalam file import",
        };
        errors.push(errorKegiatan);
        if (
          !cellErrors.find((e) => e.row === rowNum && e.field === "kegiatan")
        ) {
          cellErrors.push(errorKegiatan);
        }
        // Also mark bidang and no as duplicate
        const errorBidang = {
          row: rowNum,
          field: "bidang",
          message: "Data duplikat",
        };
        if (!cellErrors.find((e) => e.row === rowNum && e.field === "bidang")) {
          cellErrors.push(errorBidang);
        }
        const errorNo = {
          row: rowNum,
          field: "no",
          message: "Data duplikat",
        };
        if (!cellErrors.find((e) => e.row === rowNum && e.field === "no")) {
          cellErrors.push(errorNo);
        }
      }

      // Tidak perlu validasi konflik dengan data existing
      // Karena NO dan Bidang yang sama diperbolehkan (bisa ada beberapa item dengan NO dan Bidang yang sama)
      // Sistem akan update data yang sudah ada atau membuat baru jika berbeda
    });

    return { errors, cellErrors };
  };

  // Handle import file
  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setImportedFile(file);
    try {
      const excelParsedData = await readExcelFile(file);

      // Transform data - handle various header formats
      const transformedData = excelParsedData.map((row) => {
        // Handle different header formats (bidang, bidang_, etc.)
        const bidang = String(row.bidang || row.bidang_ || "").trim();
        const no = String(row.no || row.no_ || "").trim();
        const kegiatan = String(row.kegiatan || row.kegiatan_ || "").trim();
        const indeksPoin =
          row.indeks_poin ||
          row.indeks_poin_ ||
          row["indeks poin"] ||
          row["indeks poin_"] ||
          0;
        const unitKerja = String(
          row.unit_kerja ||
          row.unit_kerja_ ||
          row["unit kerja"] ||
          row["unit kerja_"] ||
          ""
        ).trim();
        const buktiFisik = String(
          row.bukti_fisik ||
          row.bukti_fisik_ ||
          row["bukti fisik"] ||
          row["bukti fisik_"] ||
          ""
        ).trim();
        const prosedur = String(row.prosedur || row.prosedur_ || "").trim();
        const isSubItemRaw = String(
          row.is_sub_item ||
          row.is_sub_item_ ||
          row["is sub item"] ||
          row["is sub item_"] ||
          ""
        )
          .toUpperCase()
          .trim();
        const isSubItemBool =
          isSubItemRaw === "Y" ||
          isSubItemRaw === "YES" ||
          isSubItemRaw === "TRUE" ||
          isSubItemRaw === "1";
        const parentNo = String(
          row.parent_no ||
          row.parent_no_ ||
          row["parent no"] ||
          row["parent no_"] ||
          ""
        ).trim();

        return {
          bidang,
          no,
          kegiatan,
          indeks_poin: indeksPoin ? Number(indeksPoin) : 0,
          unit_kerja: unitKerja,
          bukti_fisik: buktiFisik,
          prosedur,
          is_sub_item: isSubItemBool,
          parent_no: parentNo,
        };
      });

      const validationResult = validateExcelData(transformedData, pedomanData);
      setPreviewData(transformedData);
      setValidationErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors);
      setError("");
    } catch (err: any) {
      setError(err.message || "Gagal membaca file Excel");
      setPreviewData([]);
      setValidationErrors([]);
      setCellErrors([]);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle close import modal
  const handleCloseImportModal = () => {
    if (!isSaving) {
      setShowImportModal(false);
      setPreviewData([]);
      setValidationErrors([]);
      setCellErrors([]);
      setEditingCell(null);
      setImportedFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  // Handle cell edit in preview
  const handleCellEdit = (
    rowIdx: number,
    key: string,
    value: string | number | boolean
  ) => {
    setPreviewData((prev) => {
      const newData = [...prev];
      if (newData[rowIdx]) {
        // Handle special cases
        if (key === "indeks_poin") {
          newData[rowIdx][key] = value === "" ? 0 : Number(value) || 0;
        } else if (key === "is_sub_item") {
          // Convert string to boolean
          const strValue = String(value).toUpperCase().trim();
          newData[rowIdx][key] =
            strValue === "Y" ||
            strValue === "YES" ||
            strValue === "TRUE" ||
            strValue === "1";
        } else {
          newData[rowIdx][key] = value;
        }

        // Re-validate after edit
        const validationResult = validateExcelData(newData, pedomanData);
        setValidationErrors(validationResult.errors);
        setCellErrors(validationResult.cellErrors);
      }
      return newData;
    });
  };

  // Helper function to delay execution
  const delay = (ms: number) =>
    new Promise((resolve) => setTimeout(resolve, ms));

  // Helper function to retry API calls with exponential backoff
  const retryApiCall = async <T,>(
    apiCall: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> => {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await apiCall();
      } catch (error: any) {
        // If it's a 429 error and we have retries left, wait and retry
        if (error.response?.status === 429 && attempt < maxRetries - 1) {
          const waitTime = baseDelay * Math.pow(2, attempt); // Exponential backoff: 1s, 2s, 4s
          console.log(
            `Rate limited. Retrying in ${waitTime}ms... (Attempt ${attempt + 1
            }/${maxRetries})`
          );
          await delay(waitTime);
          continue;
        }
        // If not a 429 or no retries left, throw the error
        throw error;
      }
    }
    throw new Error("Max retries exceeded");
  };

  // Handle submit import
  const handleSubmitImport = async () => {
    if (!previewData || previewData.length === 0) return;
    setIsSaving(true);
    setError("");
    setLoading(true);
    setImportedCount(0);
    setCellErrors([]);

    const validationResult = validateExcelData(previewData, pedomanData);
    if (validationResult.errors.length > 0) {
      setValidationErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors);
      setIsSaving(false);
      setLoading(false);
      return;
    }

    try {
      // Group data by bidang
      const dataByBidang: { [key: string]: any[] } = {};
      previewData.forEach((row) => {
        if (!dataByBidang[row.bidang]) {
          dataByBidang[row.bidang] = [];
        }
        dataByBidang[row.bidang].push(row);
      });

      let totalImported = 0;
      let totalErrors = 0;

      // Process each bidang
      for (const [bidang, items] of Object.entries(dataByBidang)) {
        // Separate main items and sub-items
        const mainItems = items.filter((item) => !item.is_sub_item);
        const subItems = items.filter((item) => item.is_sub_item);

        // Map to store created/updated main items with their IDs
        // Key: `${bidang}-${no}`, Value: { id, no, bidang }
        const createdMainItemsMap: {
          [key: string]: { id: number; no: string; bidang: string };
        } = {};

        // Process main items first
        for (const item of mainItems) {
          try {
            // Get bidang nama from bidangList or use bidang as nama
            const bidangInfo = bidangList.find((b) => b.kode === bidang);
            const payload = {
              no: item.no,
              kegiatan: item.kegiatan,
              indeks_poin: item.indeks_poin || 0,
              unit_kerja: item.unit_kerja || "",
              bukti_fisik: item.bukti_fisik || "",
              prosedur: item.prosedur || "",
              bidang: bidang,
              bidang_nama: bidangInfo?.nama || bidang,
            };

            // Check if item already exists
            const existingItem = pedomanData.find(
              (existing) =>
                existing.no === item.no &&
                existing.bidang === bidang &&
                (existing.level === 0 || existing.level === undefined) &&
                (!existing.parent_id || existing.parent_id === null)
            );

            let mainItemId: number | null = null;

            if (existingItem?.id) {
              // Update existing item with retry logic
              await retryApiCall(() =>
                api.put(`/rekap-ikd/pedoman-poin/${existingItem.id}`, payload)
              );
              mainItemId = existingItem.id;
            } else {
              // Create new item and get the ID from response with retry logic
              const response = await retryApiCall(() =>
                api.post("/rekap-ikd/pedoman-poin", payload)
              );
              // Try to get ID from response
              mainItemId = response.data?.data?.id || response.data?.id || null;
              if (
                !mainItemId &&
                response.data?.success &&
                response.data?.data?.id
              ) {
                mainItemId = response.data.data.id;
              }
            }

            // Add small delay between requests to avoid rate limiting (50ms)
            await delay(50);

            // Store the created/updated item with its ID for later use by sub-items
            if (mainItemId) {
              const mapKey = `${bidang}-${item.no}`;
              createdMainItemsMap[mapKey] = {
                id: mainItemId,
                no: item.no,
                bidang: bidang,
              };
            }

            totalImported++;
          } catch (err: any) {
            console.error("Error importing item:", err);
            totalErrors++;
          }
        }

        // Fetch all pedoman data once after creating all main items (only if needed)
        // Initialize with existing pedomanData, will be updated if fetch is needed
        let allPedomanData: any[] = [...pedomanData];
        let needsFetch = false;
        for (const subItem of subItems) {
          const mapKey = `${bidang}-${subItem.parent_no}`;
          if (!createdMainItemsMap[mapKey]) {
            // Check if parent exists in existing pedomanData
            const parentInExisting = pedomanData.find(
              (p) =>
                p.no === subItem.parent_no &&
                p.bidang === bidang &&
                (p.level === 0 || p.level === undefined) &&
                (!p.parent_id || p.parent_id === null)
            );
            if (!parentInExisting) {
              needsFetch = true;
              break;
            }
          }
        }

        // Only fetch once if needed
        if (needsFetch) {
          try {
            // Add delay before fetch to let previous requests complete
            await delay(200);
            const pedomanRes = await retryApiCall(() =>
              api.get(`/rekap-ikd/pedoman-poin`)
            );
            const fetchedData =
              pedomanRes.data?.success && pedomanRes.data?.data
                ? pedomanRes.data.data
                : Array.isArray(pedomanRes.data)
                  ? pedomanRes.data
                  : [];
            // Merge with existing data, replacing with fetched data
            allPedomanData = [...fetchedData];

            // Update createdMainItemsMap with IDs from fetched data
            for (const item of mainItems) {
              const mapKey = `${bidang}-${item.no}`;
              if (!createdMainItemsMap[mapKey]) {
                const foundParent = allPedomanData.find(
                  (p: any) =>
                    String(p.no || "").trim() ===
                    String(item.no || "").trim() &&
                    String(p.bidang || "").trim() ===
                    String(bidang || "").trim() &&
                    (p.level === 0 || p.level === undefined) &&
                    (!p.parent_id || p.parent_id === null)
                );
                if (foundParent?.id) {
                  createdMainItemsMap[mapKey] = {
                    id: foundParent.id,
                    no: item.no,
                    bidang: bidang,
                  };
                }
              }
            }
          } catch (err) {
            console.error("Error fetching pedoman data:", err);
          }
        }

        // Process sub-items after main items
        for (const subItem of subItems) {
          try {
            let parentId: number | null = null;
            const mapKey = `${bidang}-${subItem.parent_no}`;

            // First, try to get parent ID from created main items map
            if (createdMainItemsMap[mapKey]) {
              parentId = createdMainItemsMap[mapKey].id;
            } else {
              // If not found, try in existing/fetched pedoman data
              const parentItem = allPedomanData.find(
                (p) =>
                  p.no === subItem.parent_no &&
                  p.bidang === bidang &&
                  (p.level === 0 || p.level === undefined) &&
                  (!p.parent_id || p.parent_id === null)
              );

              if (parentItem?.id) {
                parentId = parentItem.id;
              }
            }

            if (!parentId) {
              console.error(
                `Parent not found for sub-item: ${subItem.kegiatan}, parent_no: ${subItem.parent_no}, bidang: ${bidang}`
              );
              totalErrors++;
              continue;
            }

            // Get bidang nama from bidangList
            const bidangInfo = bidangList.find((b) => b.kode === bidang);
            const payload = {
              no: subItem.no,
              kegiatan: subItem.kegiatan,
              indeks_poin: subItem.indeks_poin || 0,
              unit_kerja: subItem.unit_kerja || "",
              bukti_fisik: subItem.bukti_fisik || "",
              prosedur: subItem.prosedur || "",
              bidang: bidang,
              bidang_nama: bidangInfo?.nama || bidang,
              parent_id: parentId,
              level: 1,
            };

            // Check if sub-item already exists (use allPedomanData which includes newly fetched data)
            const existingSubItem = allPedomanData.find(
              (existing) =>
                existing.no === subItem.no &&
                existing.bidang === bidang &&
                existing.kegiatan === subItem.kegiatan &&
                (existing.parent_id === parentId || existing.level === 1)
            );

            if (existingSubItem?.id) {
              // Update existing sub-item with retry logic
              await retryApiCall(() =>
                api.put(
                  `/rekap-ikd/pedoman-poin/${existingSubItem.id}`,
                  payload
                )
              );
            } else {
              // Create new sub-item with retry logic
              await retryApiCall(() =>
                api.post("/rekap-ikd/pedoman-poin", payload)
              );
            }
            totalImported++;

            // Add small delay between sub-item requests to avoid rate limiting (100ms for sub-items)
            await delay(100);
          } catch (err: any) {
            console.error("Error importing sub-item:", err);
            totalErrors++;
          }
        }
      }

      // Reload data after import with delay to let all requests complete
      await delay(500);
      try {
        // Fetch with retry logic
        const res = await retryApiCall(() =>
          api.get("/rekap-ikd/pedoman-poin")
        );
        let data: IKDPedomanItem[] = [];
        if (res.data?.success && Array.isArray(res.data.data)) {
          data = res.data.data;
        } else if (Array.isArray(res.data)) {
          data = res.data;
        }
        setPedomanData(data);

        // Extract unique bidang from pedomanData and populate bidangList
        const uniqueBidang = new Map<
          string,
          { kode: string; nama: string; is_auto: boolean }
        >();
        data.forEach((item) => {
          if (item.bidang && !uniqueBidang.has(item.bidang)) {
            uniqueBidang.set(item.bidang, {
              kode: item.bidang,
              nama: item.bidang_nama || item.bidang,
              is_auto: false,
            });
          }
        });
        setBidangList(Array.from(uniqueBidang.values()));
      } catch (err) {
        console.error("Error reloading data after import:", err);
        // Don't fail the entire import if reload fails, just try to fetch normally
        try {
          await fetchPedomanData();
        } catch (fetchErr) {
          console.error("Error in fallback fetch:", fetchErr);
        }
      }

      setImportedCount(totalImported);
      if (totalErrors > 0) {
        setError(
          `${totalImported} data berhasil diimpor, ${totalErrors} data gagal diimpor.`
        );
      } else {
        setSuccess(`${totalImported} data berhasil diimpor.`);
      }
      setImportedFile(null);
      setPreviewData([]);
      setValidationErrors([]);
      setCellErrors([]);
      setShowImportModal(false);
    } catch (err: any) {
      setImportedCount(0);
      setError(err.message || "Gagal mengimpor data");
      setCellErrors([]);
    } finally {
      setIsSaving(false);
      setLoading(false);
    }
  };

  // Group data by bidang
  const groupedData = pedomanData.reduce((acc, item) => {
    if (!acc[item.bidang]) {
      acc[item.bidang] = [];
    }
    acc[item.bidang].push(item);
    return acc;
  }, {} as Record<string, IKDPedomanItem[]>);

  // Sort items within each bidang and ensure sub items are correctly identified
  Object.keys(groupedData).forEach((bidang) => {
    groupedData[bidang].sort((a, b) => {
      // Helper function to check if item has content (indeks_poin, unit_kerja, bukti_fisik, or prosedur)
      const hasContent = (item: any): boolean => {
        const hasIndeksPoin =
          item.indeks_poin !== undefined &&
          item.indeks_poin !== null &&
          item.indeks_poin > 0;
        const hasUnitKerja =
          item.unit_kerja &&
          typeof item.unit_kerja === "string" &&
          item.unit_kerja.trim().length > 0;
        const hasBuktiFisik =
          item.bukti_fisik &&
          typeof item.bukti_fisik === "string" &&
          item.bukti_fisik.trim().length > 0;
        const hasProsedur =
          item.prosedur &&
          typeof item.prosedur === "string" &&
          item.prosedur.trim().length > 0;
        return hasIndeksPoin || hasUnitKerja || hasBuktiFisik || hasProsedur;
      };

      // Main item is the one WITHOUT content (no indeks_poin, unit_kerja, bukti_fisik, or prosedur)
      // Sub-item is the one WITH content OR has parent_id OR level === 1
      const aHasContent = hasContent(a);
      const bHasContent = hasContent(b);
      const aIsSubItem =
        a.level === 1 ||
        (a.parent_id !== null && a.parent_id !== undefined) ||
        aHasContent;
      const bIsSubItem =
        b.level === 1 ||
        (b.parent_id !== null && b.parent_id !== undefined) ||
        bHasContent;
      const aIsMainItem =
        !aHasContent &&
        (a.level === 0 || (a.level === undefined && !a.parent_id));
      const bIsMainItem =
        !bHasContent &&
        (b.level === 0 || (b.level === undefined && !b.parent_id));

      // Helper function to extract parent NO from kegiatan
      // Examples: "2.a. Jumlah Mahasiswa" -> "2", "3.1. Seminar" -> "3", "1.4.a. CSL" -> "1"
      const getParentNoFromKegiatan = (kegiatan: string): string | null => {
        if (!kegiatan) return null;
        const trimmed = kegiatan.trim();
        // Match: digit at the start (this is the parent NO)
        const match = trimmed.match(/^(\d+)/);
        return match ? match[1] : null;
      };

      // Helper function to extract full pattern from kegiatan for comparison
      // Examples: "2.a. Jumlah" -> "2.a", "3.1. Seminar" -> "3.1", "1.4.a. CSL" -> "1.4.a"
      const getKegiatanPattern = (kegiatan: string): string | null => {
        if (!kegiatan) return null;
        const trimmed = kegiatan.trim();
        // Match: digit(s).digit(s) or digit(s).letter(s) (capture the full pattern before space or end)
        const match = trimmed.match(/^(\d+(?:\.\d+)*(?:\.[a-zA-Z])?)/);
        return match ? match[1] : null;
      };

      // Helper function to compare NO values numerically
      const compareNo = (noA: string, noB: string): number => {
        const aNum = parseInt(noA) || 0;
        const bNum = parseInt(noB) || 0;
        return aNum - bNum;
      };

      // Get NO values for comparison
      const aNo = a.no || "";
      const bNo = b.no || "";

      // First, compare by NO (main sorting key)
      const noCompare = compareNo(aNo, bNo);
      if (noCompare !== 0) {
        // Different NO values - but we need to check if one is a sub-item of the other
        // If a is main item with NO "2" and b is sub-item with kegiatan starting with "2.",
        // they should be grouped together
        if (aIsMainItem && bIsSubItem) {
          const bParentNo = getParentNoFromKegiatan(b.kegiatan || "");
          if (bParentNo === aNo) {
            // b is sub-item of a, so a comes first
            return -1;
          }
        }
        if (aIsSubItem && bIsMainItem) {
          const aParentNo = getParentNoFromKegiatan(a.kegiatan || "");
          if (aParentNo === bNo) {
            // a is sub-item of b, so b comes first
            return 1;
          }
        }
        // Different NO values and not parent-child relationship, sort by NO
        return noCompare;
      }

      // Same NO - now determine order based on main item vs sub-item
      if (aIsMainItem && bIsSubItem) {
        // Main item comes before its sub-items
        return -1;
      }
      if (aIsSubItem && bIsMainItem) {
        // Main item comes before its sub-items
        return 1;
      }

      // Both are main items with same NO (shouldn't happen, but sort by kegiatan)
      if (aIsMainItem && bIsMainItem) {
        return (a.kegiatan || "").localeCompare(b.kegiatan || "");
      }

      // Both are sub-items with same NO - sort by kegiatan pattern
      if (aIsSubItem && bIsSubItem) {
        const aPattern = getKegiatanPattern(a.kegiatan || "");
        const bPattern = getKegiatanPattern(b.kegiatan || "");

        // If both have patterns, compare them
        if (aPattern && bPattern) {
          // Extract parts for comparison
          const aParts = aPattern.split(".").map((p) => {
            const num = parseInt(p);
            return isNaN(num) ? p : num;
          });
          const bParts = bPattern.split(".").map((p) => {
            const num = parseInt(p);
            return isNaN(num) ? p : num;
          });

          for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
            const aVal = aParts[i];
            const bVal = bParts[i];

            if (aVal === undefined) return -1;
            if (bVal === undefined) return 1;

            // If both are numbers, compare numerically
            if (typeof aVal === "number" && typeof bVal === "number") {
              if (aVal !== bVal) return aVal - bVal;
            }
            // If both are strings (letters), compare alphabetically
            else if (typeof aVal === "string" && typeof bVal === "string") {
              const comp = aVal.localeCompare(bVal);
              if (comp !== 0) return comp;
            }
            // Mixed: number comes before letter
            else if (typeof aVal === "number" && typeof bVal === "string") {
              return -1;
            } else if (typeof aVal === "string" && typeof bVal === "number") {
              return 1;
            }
          }
        }

        // Fallback: sort alphabetically by kegiatan
        return (a.kegiatan || "").localeCompare(b.kegiatan || "");
      }

      return 0;
    });

    // Ensure sub items are correctly marked with level = 1
    // Check for items that should be sub items based on kegiatan format
    groupedData[bidang].forEach((item) => {
      // Jika item sudah punya level = 1 atau parent_id, skip
      if (item.level === 1 || item.parent_id) return;

      // Cek apakah kegiatan item ini adalah format sub item (dimulai dengan no + ".")
      const kegiatanTrimmed = item.kegiatan?.trim() || "";
      if (!kegiatanTrimmed) return;

      // Cek apakah ada main item dengan no yang sama
      const mainItem = groupedData[bidang].find((otherItem) => {
        if (otherItem.id === item.id) return false;
        if (otherItem.level === 1 || otherItem.parent_id) return false;
        return otherItem.no === item.no;
      });

      if (mainItem) {
        // Cek apakah kegiatan item ini adalah format sub item dari main item
        const pattern = new RegExp(
          `^${item.no.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\.`
        );
        if (pattern.test(kegiatanTrimmed)) {
          // Item ini adalah sub item, tapi mungkin belum punya level = 1 di database
          // Set level = 1 untuk display purposes
          item.level = 1;
          if (!item.parent_id && mainItem.id) {
            item.parent_id = mainItem.id;
          }
        }
      }
    });
  });

  const getBidangNama = (kode: string) => {
    const bidang = bidangList.find((b) => b.kode === kode);
    return bidang?.nama || kode;
  };

  const hasData = pedomanData.length > 0;

  return (
    <RekapIKDBase
      title="Pedoman Poin IKD"
      description="Panduan dan aturan poin Indikator Kinerja Dosen (IKD)"
    >
      <div className="w-full mx-auto space-y-6">
        {/* Header with Button */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white/90 mb-1">
              Tabel Pedoman Poin IKD
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Kelola pedoman poin IKD untuk semua bidang
            </p>
          </div>
          <div className="flex items-center gap-2">
            {canEdit && (
              <>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform"
                >
                  <FontAwesomeIcon
                    icon={faFileExcel}
                    className="w-5 h-5 text-brand-700 dark:text-brand-200"
                  />
                  Import Excel
                </button>
                <button
                  onClick={downloadTemplate}
                  className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"
                >
                  <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
                  Download Template Excel
                </button>
                {hasData && (
                  <button
                    onClick={exportToExcel}
                    className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs transition flex items-center gap-2 ${hasData
                      ? "bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 hover:bg-purple-200 dark:hover:bg-purple-800"
                      : "bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600 cursor-not-allowed"
                      }`}
                  >
                    <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
                    Export ke Excel
                  </button>
                )}
                <button
                  onClick={handleEditTableClick}
                  className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"
                >
                  {hasData ? "Edit Table IKD" : "Buat Table IKD"}
                </button>
              </>
            )}
            {!canEdit && (
              <div className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium">
                View Only Mode
              </div>
            )}
          </div>
        </div>

        {/* Bidang Selection Modal */}
        <AnimatePresence>
          {showBidangModal && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={() => {
                  setShowBidangModal(false);
                  setBidangModalError(null);
                  setNewBidang({ kode: "", nama: "" });
                  setEditingBidang(null);
                }}
              />
              {/* Modal Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={() => {
                    setShowBidangModal(false);
                    setBidangModalError(null);
                    setNewBidang({ kode: "", nama: "" });
                    setEditingBidang(null);
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
                  <div className="flex items-center justify-between pb-0 sm:pb-2">
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                        {hasData
                          ? "Pilih Bidang untuk Menambah Item"
                          : "Pilih Bidang untuk Memulai"}
                      </h2>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Pilih bidang yang ingin Anda gunakan atau tambahkan
                        bidang baru
                      </p>
                    </div>
                  </div>
                  <div>
                    <div className="mb-3 sm:mb-4">
                      <div className="space-y-3 mb-6">
                        {bidangList.map((bidang) => {
                          const bidangItems = pedomanData.filter(
                            (item) => item.bidang === bidang.kode
                          );
                          return (
                            <div
                              key={bidang.kode}
                              className="w-full px-4 py-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors border border-gray-200 dark:border-gray-700"
                            >
                              <div className="flex justify-between items-center">
                                <button
                                  onClick={() => {
                                    setSelectedBidang(bidang.kode);
                                    setShowBidangModal(false);
                                    handleOpenModal(bidang.kode);
                                  }}
                                  className="flex-1 text-left"
                                >
                                  <div>
                                    <div className="font-medium text-gray-900 dark:text-white">
                                      Bidang {bidang.kode} - {bidang.nama}
                                    </div>
                                    {hasData && (
                                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                        {bidangItems.length} item
                                      </div>
                                    )}
                                  </div>
                                </button>
                                <div className="flex items-center gap-2 ml-4">
                                  {canEdit && (
                                    <>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleEditBidang(bidang);
                                        }}
                                        className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                        title="Edit Bidang"
                                      >
                                        <svg
                                          className="w-5 h-5"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                          />
                                        </svg>
                                      </button>
                                      <button
                                        onClick={async (e) => {
                                          e.stopPropagation();
                                          const confirmMessage = `Apakah Anda yakin ingin menghapus bidang ini?\n\nBidang ${bidang.kode} - ${bidang.nama}\n\n⚠️ Peringatan: Semua item pedoman poin dengan bidang ini akan ikut terhapus, termasuk file dan skor yang terkait.`;
                                          if (window.confirm(confirmMessage)) {
                                            setBidangToDelete(bidang);
                                            await handleDeleteBidang();
                                          }
                                        }}
                                        className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                        title="Hapus Bidang"
                                      >
                                        <svg
                                          className="w-5 h-5"
                                          fill="none"
                                          stroke="currentColor"
                                          viewBox="0 0 24 24"
                                        >
                                          <path
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            strokeWidth={2}
                                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                          />
                                        </svg>
                                      </button>
                                    </>
                                  )}
                                  <svg
                                    className="w-5 h-5 text-gray-400"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 5l7 7-7 7"
                                    />
                                  </svg>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {canEdit && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                      <div className="flex items-center space-x-3 mb-4">
                        <div className="w-12 h-12 bg-brand-100 dark:bg-brand-900/20 rounded-lg flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-brand-600 dark:text-brand-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                            />
                          </svg>
                        </div>
                        <div>
                          <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                            {editingBidang ? "Edit Bidang" : "Tambah Bidang Baru"}
                          </h3>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            {editingBidang
                              ? "Ubah informasi bidang yang dipilih"
                              : "Isi form di bawah ini untuk menambahkan bidang baru"}
                          </p>
                        </div>
                      </div>

                      {/* Error Message */}
                      {bidangModalError && (
                        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                          <div className="flex items-start space-x-3">
                            <svg
                              className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              />
                            </svg>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-red-800 dark:text-red-200">
                                Error
                              </p>
                              <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                                {bidangModalError}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Kode Bidang <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: B, C, E"
                            value={newBidang.kode}
                            onChange={(e) => {
                              setNewBidang({
                                ...newBidang,
                                kode: e.target.value,
                              });
                              setBidangModalError(null);
                            }}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Masukkan kode bidang (huruf tunggal atau kombinasi)
                          </p>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Nama Bidang <span className="text-red-500">*</span>
                          </label>
                          <input
                            type="text"
                            placeholder="Contoh: Penelitian, Pengabdian Masyarakat"
                            value={newBidang.nama}
                            onChange={(e) => {
                              setNewBidang({
                                ...newBidang,
                                nama: e.target.value,
                              });
                              setBidangModalError(null);
                            }}
                            className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                          />
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Masukkan nama lengkap bidang
                          </p>
                        </div>
                        <div className="flex justify-end gap-2 pt-2">
                          {editingBidang && (
                            <button
                              onClick={() => {
                                setEditingBidang(null);
                                setNewBidang({ kode: "", nama: "" });
                                setBidangModalError(null);
                              }}
                              className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                            >
                              Batal Edit
                            </button>
                          )}
                          <button
                            onClick={handleAddBidang}
                            className="px-3 sm:px-4 py-2 rounded-lg bg-brand-500 text-white text-xs sm:text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition-all duration-300 ease-in-out"
                          >
                            {editingBidang ? "Update Bidang" : "Tambah Bidang"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Info Box */}
        {hasData && (
          <div className="bg-white dark:bg-white/[0.05] border border-gray-300 dark:border-gray-700 rounded-2xl p-6 mb-6 shadow-lg">
            <div className="flex items-center gap-2 mb-3">
              <svg
                className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <div className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                Informasi
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                  Cara Menambah Item:
                </h4>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-disc list-inside">
                  <li>
                    <strong>Menambah Item:</strong> Klik tombol "Edit Table IKD"
                    di kanan atas, pilih Bidang, lalu isi form. Nomor akan
                    otomatis ter-generate (1, 2, 3, dst).
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Zoom Controls - hanya tampil jika ada data */}
        {hasData && !loading && (
          <div className="bg-white dark:bg-white/[0.05] border border-gray-300 dark:border-gray-700 rounded-xl p-5 mb-6 shadow-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-gray-600 dark:text-gray-400"
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
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Zoom: {Math.round(tableZoom * 100)}%
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() =>
                    setTableZoom((prev) => Math.max(0.5, prev - 0.1))
                  }
                  className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium shadow-theme-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center gap-2"
                  title="Zoom Out"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM13 10H7"
                    />
                  </svg>
                  Zoom Out
                </button>
                <button
                  onClick={() => setTableZoom(1)}
                  className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium shadow-theme-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center gap-2"
                  title="Reset Zoom"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Reset
                </button>
                <button
                  onClick={() =>
                    setTableZoom((prev) => Math.min(2, prev + 0.1))
                  }
                  className="px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium shadow-theme-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center gap-2"
                  title="Zoom In"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v6m3-3H7"
                    />
                  </svg>
                  Zoom In
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="bg-white dark:bg-white/[0.03] rounded-b-xl shadow-md border border-gray-200 dark:border-gray-800">
            <div className="p-6">
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                <div className="max-w-full overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                    <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900">
                      <tr>
                        {Array.from({ length: 6 }).map((_, i) => (
                          <th key={i} className="px-6 py-4">
                            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: 5 }).map((_, i) => (
                        <tr
                          key={i}
                          className={
                            i % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""
                          }
                        >
                          {Array.from({ length: 6 }).map((_, j) => (
                            <td key={j} className="px-6 py-4">
                              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        ) : hasData ? (
          <div className="bg-white dark:bg-white/[0.03] rounded-b-xl shadow-md border border-gray-200 dark:border-gray-800">
            <div className="p-6">
              <div
                className="overflow-auto w-full"
                style={{ maxHeight: "80vh" }}
              >
                <div
                  style={{
                    transform: `scale(${tableZoom})`,
                    transformOrigin: "top left",
                    transition: "transform 0.2s ease-in-out",
                    width: `${100 / tableZoom}%`,
                  }}
                >
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <div className="max-w-full overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                        <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900">
                          <tr>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                              NO
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                              Kegiatan
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                              Indeks poin
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                              Unit Kerja
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                              Bukti fisik
                            </th>
                            <th className="px-6 py-4 text-left text-xs font-semibold text-gray-900 dark:text-white uppercase tracking-wider">
                              Prosedur yang dilakukan oleh dosen
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(groupedData).map((bidang) => (
                            <React.Fragment key={bidang}>
                              {/* Row header untuk nama bidang - bold dan besar */}
                              <tr className="bg-white dark:bg-gray-900">
                                <td
                                  colSpan={6}
                                  className="border-b-2 border-gray-400 dark:border-gray-600 px-6 py-4 text-base font-bold text-gray-900 dark:text-white"
                                >
                                  {getBidangNama(bidang)}
                                </td>
                              </tr>
                              {groupedData[bidang].map((item, idx) => {
                                const isSubItem = item.level === 1;
                                return (
                                  <tr
                                    key={item.id || idx}
                                    className={`${isSubItem
                                      ? "bg-gray-50 dark:bg-white/[0.02]"
                                      : idx % 2 === 1
                                        ? "bg-gray-50 dark:bg-white/[0.02]"
                                        : "bg-white dark:bg-gray-900"
                                      }`}
                                  >
                                    {!isSubItem && (
                                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                        <span className="font-medium">
                                          {item.no}
                                        </span>
                                      </td>
                                    )}
                                    {isSubItem && (
                                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                        {/* Empty cell untuk sub items, tidak ada NO */}
                                      </td>
                                    )}
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                      {item.kegiatan}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                      {item.indeks_poin !== null &&
                                        item.indeks_poin !== undefined &&
                                        Number(item.indeks_poin) !== 0 &&
                                        Number(item.indeks_poin) > 0
                                        ? Number(item.indeks_poin).toFixed(2)
                                        : ""}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                      {item.unit_kerja || ""}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                      {item.bukti_fisik || ""}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                                      {item.prosedur || ""}
                                    </td>
                                  </tr>
                                );
                              })}
                            </React.Fragment>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-12 shadow-sm">
            <div className="text-center">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Belum ada data. Klik "Buat Table IKD" untuk mulai.
              </p>
              <div className="text-left bg-gray-50 dark:bg-gray-800/50 p-6 rounded-xl mt-4 max-w-2xl mx-auto">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Cara menggunakan:
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>
                    Klik "Buat Table IKD" dan pilih Bidang (A = Pengajaran, D =
                    Penunjang)
                  </li>
                  <li>
                    Isi form untuk menambah item nomor utama (1, 2, 3, dst)
                  </li>
                  <li>
                    Nomor akan otomatis ter-generate, tapi bisa diubah manual
                    jika perlu
                  </li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={handleCloseModal}
              />
              {/* Modal Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-6xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
              >
                {/* Close Button */}
                <button
                  onClick={handleCloseModal}
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

                {/* Header */}
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                    {editMode ? "Edit" : "Tambah"} Item Pedoman IKD
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Bidang {selectedBidang} - {getBidangNama(selectedBidang)}
                  </p>
                </div>

                {/* Alert Success/Error di dalam modal */}
                <AnimatePresence>
                  {success && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="mb-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-green-600 dark:text-green-400"
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
                          <h3 className="text-sm font-semibold text-green-800 dark:text-green-300">
                            Berhasil
                          </h3>
                          <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                            {success}
                          </p>
                        </div>
                        <button
                          onClick={() => setSuccess(null)}
                          className="flex-shrink-0 text-green-600 dark:text-green-400 hover:text-green-800 dark:hover:text-green-200"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  )}
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <svg
                            className="w-5 h-5 text-red-600 dark:text-red-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                            />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-semibold text-red-800 dark:text-red-300">
                            Error
                          </h3>
                          <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                            {error}
                          </p>
                        </div>
                        <button
                          onClick={() => setError(null)}
                          className="flex-shrink-0 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4 relative">
                  {/* Header dengan tombol Hapus untuk form utama - pojok kanan atas */}
                  {canEdit && editMode && editingItem?.id && (
                    <div className="absolute top-0 right-0">
                      <button
                        type="button"
                        onClick={handleDeleteMainForm}
                        className="text-red-500 hover:text-red-700 text-sm font-medium"
                      >
                        Hapus
                      </button>
                    </div>
                  )}

                  {/* Checkbox untuk menggunakan sub item */}
                  {canEdit && (
                    <div className="flex items-center gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <input
                        type="checkbox"
                        id="useSubItem"
                        checked={useSubItem}
                        onChange={(e) => {
                          setUseSubItem(e.target.checked);
                          if (!e.target.checked) {
                            // Jika uncheck, reset form kegiatan jika itu sub item
                            if (/^\d+\.\d+/.test(form.kegiatan)) {
                              setForm({
                                ...form,
                                kegiatan: form.kegiatan.replace(
                                  /^\d+\.\d+\.?\s*/,
                                  ""
                                ),
                              });
                            }
                            setParentItemId(null);
                          }
                        }}
                        className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                      />
                      <label
                        htmlFor="useSubItem"
                        className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer"
                      >
                        Gunakan Sub Item (NO tetap sama, nomor sub masuk ke
                        Kegiatan seperti 1.1, 1.2, 1.1.a, 1.1.b)
                      </label>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      NO{" "}
                      <span className="text-gray-500 text-xs">
                        (Otomatis terisi, bisa diubah manual)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={form.no}
                      onChange={(e) => setForm({ ...form, no: e.target.value })}
                      placeholder="Contoh: 1, 2, 3"
                      disabled={!canEdit}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Kegiatan
                    </label>
                    <textarea
                      value={form.kegiatan}
                      onChange={(e) =>
                        setForm({ ...form, kegiatan: e.target.value })
                      }
                      rows={2}
                      placeholder={
                        useSubItem
                          ? "Contoh: 1.1 Memberi kuliah..."
                          : "Masukkan kegiatan"
                      }
                      disabled={!canEdit}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                    {useSubItem && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        💡 Format: "1.1 Judul" untuk sub item angka, atau
                        "1.1.a. Judul" untuk sub item dengan huruf.
                      </p>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Indeks poin
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={form.indeks_poin === 0 ? "" : form.indeks_poin}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || val === "-") {
                            setForm({ ...form, indeks_poin: 0 });
                          } else {
                            const num = parseFloat(val);
                            if (!isNaN(num)) {
                              setForm({ ...form, indeks_poin: num });
                            }
                          }
                        }}
                        placeholder="Masukkan indeks poin (contoh: 1.5, 2.75)"
                        disabled={!canEdit}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Unit Kerja
                      </label>
                      <div className="relative" ref={unitKerjaDropdownRef}>
                        <button
                          type="button"
                          onClick={() =>
                            setShowUnitKerjaDropdown(!showUnitKerjaDropdown)
                          }
                          className={`w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-left text-gray-900 dark:text-white flex items-center justify-between bg-white dark:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-colors ${form.unit_kerja
                            ? "border-blue-500 dark:border-blue-400"
                            : ""
                            }`}
                        >
                          <span
                            className={
                              form.unit_kerja
                                ? "text-gray-900 dark:text-white"
                                : "text-gray-500 dark:text-gray-400"
                            }
                          >
                            {form.unit_kerja ||
                              "Pilih Unit Kerja (bisa lebih dari satu)"}
                          </span>
                          <svg
                            className={`w-5 h-5 transition-transform ${showUnitKerjaDropdown
                              ? "transform rotate-180"
                              : ""
                              }`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M19 9l-7 7-7-7"
                            />
                          </svg>
                        </button>

                        {showUnitKerjaDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                            {UNIT_KERJA_OPTIONS.map((unit) => {
                              const selectedUnits = form.unit_kerja
                                ? form.unit_kerja.split(", ").filter(Boolean)
                                : [];
                              const isSelected = selectedUnits.includes(unit);
                              return (
                                <label
                                  key={unit}
                                  className="flex items-center px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={(e) => {
                                      const currentUnits = form.unit_kerja
                                        ? form.unit_kerja
                                          .split(", ")
                                          .filter(Boolean)
                                        : [];
                                      let newUnits;
                                      if (e.target.checked) {
                                        newUnits = [...currentUnits, unit];
                                      } else {
                                        newUnits = currentUnits.filter(
                                          (u) => u !== unit
                                        );
                                      }
                                      setForm({
                                        ...form,
                                        unit_kerja: newUnits.join(", "),
                                      });
                                    }}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-400 dark:ring-offset-gray-800 focus:ring-2"
                                  />
                                  <span className="ml-3 text-sm text-gray-900 dark:text-white">
                                    {unit}
                                  </span>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Bukti fisik
                    </label>
                    <input
                      type="text"
                      value={form.bukti_fisik}
                      onChange={(e) =>
                        setForm({ ...form, bukti_fisik: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Prosedur yang dilakukan oleh dosen
                    </label>
                    <textarea
                      value={form.prosedur}
                      onChange={(e) =>
                        setForm({ ...form, prosedur: e.target.value })
                      }
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>

                {/* List Sub Items dari form utama - Dipindah ke atas sebelum list items */}
                {useSubItem && subItems.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {subItems.map((subItem, idx) => (
                      <div
                        key={subItem.id || idx}
                        className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        <div className="flex justify-between items-start mb-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            Kegiatan Sub Item
                          </label>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleDeleteMainFormSubItem(idx)}
                              className="text-red-500 hover:text-red-700 text-xs"
                            >
                              Hapus
                            </button>
                          )}
                        </div>
                        <textarea
                          value={subItem.kegiatan}
                          onChange={(e) => {
                            const updated = [...subItems];
                            updated[idx].kegiatan = e.target.value;
                            setSubItems(updated);

                            // If editing item in list, update items array
                            if (currentItemIndex !== null) {
                              const updatedItems = [...items];
                              updatedItems[currentItemIndex].subItems = updated;
                              setItems(updatedItems);
                            }
                          }}
                          rows={1}
                          placeholder="Contoh: 1.1.a. CSL..., atau 1.2 Tutorial..."
                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-2"
                        />
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <input
                              type="number"
                              step="0.01"
                              min="0"
                              value={
                                subItem.indeks_poin === 0
                                  ? ""
                                  : subItem.indeks_poin
                              }
                              onChange={(e) => {
                                const val = e.target.value;
                                const updated = [...subItems];
                                if (val === "" || val === "-") {
                                  updated[idx].indeks_poin = 0;
                                } else {
                                  const num = parseFloat(val);
                                  if (!isNaN(num)) {
                                    updated[idx].indeks_poin = num;
                                  }
                                }
                                setSubItems(updated);

                                // If editing item in list, update items array
                                if (currentItemIndex !== null) {
                                  const updatedItems = [...items];
                                  updatedItems[currentItemIndex].subItems =
                                    updated;
                                  setItems(updatedItems);
                                }
                              }}
                              placeholder="Indeks poin (contoh: 1.5)"
                              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm bg-white dark:bg-gray-700"
                            />
                          </div>
                          <div className="relative" data-sub-item-dropdown>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setShowSubItemUnitKerjaDropdown(
                                  showSubItemUnitKerjaDropdown === `main-${idx}`
                                    ? null
                                    : `main-${idx}`
                                );
                              }}
                              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-left text-gray-900 dark:text-white text-sm flex items-center justify-between bg-white dark:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-colors"
                            >
                              <span
                                className={
                                  subItem.unit_kerja
                                    ? "text-gray-900 dark:text-white text-xs"
                                    : "text-gray-500 dark:text-gray-400 text-xs"
                                }
                              >
                                {subItem.unit_kerja || "Pilih Unit Kerja"}
                              </span>
                              <svg
                                className={`w-4 h-4 transition-transform ${showSubItemUnitKerjaDropdown === `main-${idx}`
                                  ? "transform rotate-180"
                                  : ""
                                  }`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M19 9l-7 7-7-7"
                                />
                              </svg>
                            </button>

                            {showSubItemUnitKerjaDropdown === `main-${idx}` && (
                              <div
                                className="absolute z-[100010] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto"
                                onClick={(e) => e.stopPropagation()}
                                data-sub-item-dropdown
                              >
                                {UNIT_KERJA_OPTIONS.map((unit) => {
                                  const selectedUnits = subItem.unit_kerja
                                    ? subItem.unit_kerja
                                      .split(", ")
                                      .filter(Boolean)
                                    : [];
                                  const isSelected =
                                    selectedUnits.includes(unit);
                                  return (
                                    <label
                                      key={unit}
                                      className="flex items-center px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          const updated = [...subItems];
                                          const currentUnits =
                                            subItem.unit_kerja
                                              ? subItem.unit_kerja
                                                .split(", ")
                                                .filter(Boolean)
                                              : [];
                                          let newUnits;
                                          if (e.target.checked) {
                                            newUnits = [...currentUnits, unit];
                                          } else {
                                            newUnits = currentUnits.filter(
                                              (u) => u !== unit
                                            );
                                          }
                                          updated[idx].unit_kerja =
                                            newUnits.join(", ");
                                          setSubItems(updated);

                                          // If editing item in list, update items array
                                          if (currentItemIndex !== null) {
                                            const updatedItems = [...items];
                                            updatedItems[
                                              currentItemIndex
                                            ].subItems = updated;
                                            setItems(updatedItems);
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-400 dark:ring-offset-gray-800 focus:ring-2 cursor-pointer"
                                      />
                                      <span className="ml-2.5 text-xs text-gray-900 dark:text-white">
                                        {unit}
                                      </span>
                                    </label>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="mt-2">
                          <input
                            type="text"
                            value={subItem.bukti_fisik}
                            onChange={(e) => {
                              const updated = [...subItems];
                              updated[idx].bukti_fisik = e.target.value;
                              setSubItems(updated);

                              // If editing item in list, update items array
                              if (currentItemIndex !== null) {
                                const updatedItems = [...items];
                                updatedItems[currentItemIndex].subItems =
                                  updated;
                                setItems(updatedItems);
                              }
                            }}
                            placeholder="Bukti fisik"
                            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm bg-white dark:bg-gray-700"
                          />
                        </div>
                        <div className="mt-2">
                          <textarea
                            value={subItem.prosedur}
                            onChange={(e) => {
                              const updated = [...subItems];
                              updated[idx].prosedur = e.target.value;
                              setSubItems(updated);

                              // If editing item in list, update items array
                              if (currentItemIndex !== null) {
                                const updatedItems = [...items];
                                updatedItems[currentItemIndex].subItems =
                                  updated;
                                setItems(updatedItems);
                              }
                            }}
                            rows={1}
                            placeholder="Prosedur yang dilakukan oleh dosen"
                            className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm bg-white dark:bg-gray-700"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tombol Tambah Sub Item untuk form utama - di bawah list sub items */}
                {canEdit && useSubItem && (
                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        // Set currentItemIndex to null untuk menandakan ini form utama
                        setCurrentItemIndex(null);
                        // Open sub item type modal
                        setShowSubItemTypeModal(true);
                      }}
                      className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"
                    >
                      Tambah Sub Item
                    </button>
                  </div>
                )}

                {/* List Items yang sudah ditambahkan */}
                {items.length > 0 && (
                  <div className="mt-4 space-y-4">
                    {items.map((item, idx) => (
                      <div
                        key={idx}
                        className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
                      >
                        {/* Header dengan Checkbox dan Tombol Hapus */}
                        <div className="flex justify-between items-center mb-4">
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            {canEdit ? (
                              <>
                                <input
                                  type="checkbox"
                                  checked={item.useSubItem}
                                  onChange={() => handleToggleSubItemForItem(idx)}
                                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-400 dark:ring-offset-gray-800 focus:ring-2 cursor-pointer"
                                />
                                <span className="text-sm text-gray-700 dark:text-gray-300">
                                  Gunakan Sub Item (NO tetap sama, nomor sub masuk
                                  ke Kegiatan seperti 1.1, 1.2, 1.1.a, 1.1.b)
                                </span>
                              </>
                            ) : (
                              <span className="text-sm text-gray-700 dark:text-gray-300">
                                {item.useSubItem ? "✓ Menggunakan Sub Item" : "Tidak menggunakan Sub Item"}
                              </span>
                            )}
                          </label>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(idx)}
                              className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium transition-colors ml-4"
                            >
                              Hapus
                            </button>
                          )}
                        </div>

                        {/* Form fields sama seperti form utama */}
                        <div className="space-y-4">
                          {/* NO Field */}
                          <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                              NO (Otomatis terisi, bisa diubah manual)
                            </label>
                            <input
                              type="text"
                              value={item.no}
                              onChange={(e) => {
                                const updated = [...items];
                                updated[idx].no = e.target.value;
                                setItems(updated);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>

                          {/* Kegiatan Field */}
                          <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                              Kegiatan
                            </label>
                            <textarea
                              value={item.kegiatan || ""}
                              onChange={(e) => {
                                const updated = [...items];
                                updated[idx].kegiatan = e.target.value;
                                setItems(updated);
                              }}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                            {item.useSubItem && (
                              <p className="text-xs text-blue-600 dark:text-blue-400 mt-1 flex items-center gap-1">
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                                  />
                                </svg>
                                Format: "1.1 Judul" untuk sub item angka, atau
                                "1.1.a. Judul" untuk sub item dengan huruf.
                              </p>
                            )}
                          </div>

                          {/* Indeks poin dan Unit Kerja - Grid 2 columns */}
                          <div className="grid grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                                Indeks poin
                              </label>
                              <input
                                type="number"
                                step="0.01"
                                min="0"
                                value={
                                  item.indeks_poin > 0 ? item.indeks_poin : ""
                                }
                                onChange={(e) => {
                                  const val = e.target.value;
                                  const updated = [...items];
                                  if (val === "" || val === "-") {
                                    updated[idx].indeks_poin = 0;
                                  } else {
                                    const num = parseFloat(val);
                                    if (!isNaN(num)) {
                                      updated[idx].indeks_poin = num;
                                    }
                                  }
                                  setItems(updated);
                                }}
                                placeholder="Masukkan indeks poin (contoh: 1.5, 2.75)"
                                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                                Unit Kerja
                              </label>
                              <div className="relative" data-sub-item-dropdown>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setShowSubItemUnitKerjaDropdown(
                                      showSubItemUnitKerjaDropdown ===
                                        `item-${idx}`
                                        ? null
                                        : `item-${idx}`
                                    )
                                  }
                                  className={`w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-left text-gray-900 dark:text-white flex items-center justify-between bg-white dark:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-colors ${item.unit_kerja
                                    ? "border-blue-500 dark:border-blue-400"
                                    : ""
                                    }`}
                                >
                                  <span
                                    className={
                                      item.unit_kerja
                                        ? "text-gray-900 dark:text-white"
                                        : "text-gray-500 dark:text-gray-400"
                                    }
                                  >
                                    {item.unit_kerja ||
                                      "Pilih Unit Kerja (bisa lebih dari satu)"}
                                  </span>
                                  <svg
                                    className={`w-5 h-5 transition-transform ${showSubItemUnitKerjaDropdown ===
                                      `item-${idx}`
                                      ? "transform rotate-180"
                                      : ""
                                      }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 9l-7 7-7-7"
                                    />
                                  </svg>
                                </button>

                                {showSubItemUnitKerjaDropdown ===
                                  `item-${idx}` && (
                                    <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                                      {UNIT_KERJA_OPTIONS.map((unit) => {
                                        const selectedUnits = item.unit_kerja
                                          ? item.unit_kerja
                                            .split(", ")
                                            .filter(Boolean)
                                          : [];
                                        const isSelected =
                                          selectedUnits.includes(unit);
                                        return (
                                          <label
                                            key={unit}
                                            className="flex items-center px-4 py-2.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                                          >
                                            <input
                                              type="checkbox"
                                              checked={isSelected}
                                              onChange={(e) => {
                                                const currentUnits =
                                                  item.unit_kerja
                                                    ? item.unit_kerja
                                                      .split(", ")
                                                      .filter(Boolean)
                                                    : [];
                                                let newUnits;
                                                if (e.target.checked) {
                                                  newUnits = [
                                                    ...currentUnits,
                                                    unit,
                                                  ];
                                                } else {
                                                  newUnits = currentUnits.filter(
                                                    (u) => u !== unit
                                                  );
                                                }
                                                const updated = [...items];
                                                updated[idx].unit_kerja =
                                                  newUnits.join(", ");
                                                setItems(updated);
                                              }}
                                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-400 dark:ring-offset-gray-800 focus:ring-2"
                                            />
                                            <span className="ml-3 text-sm text-gray-900 dark:text-white">
                                              {unit}
                                            </span>
                                          </label>
                                        );
                                      })}
                                    </div>
                                  )}
                              </div>
                            </div>
                          </div>

                          {/* Bukti fisik */}
                          <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                              Bukti fisik
                            </label>
                            <input
                              type="text"
                              value={item.bukti_fisik || ""}
                              onChange={(e) => {
                                const updated = [...items];
                                updated[idx].bukti_fisik = e.target.value;
                                setItems(updated);
                              }}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                            />
                          </div>

                          {/* Prosedur yang dilakukan oleh dosen */}
                          <div>
                            <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                              Prosedur yang dilakukan oleh dosen
                            </label>
                            <textarea
                              value={item.prosedur || ""}
                              onChange={(e) => {
                                const updated = [...items];
                                updated[idx].prosedur = e.target.value;
                                setItems(updated);
                              }}
                              rows={2}
                              className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                            />
                          </div>

                          {/* Display sub items dari item ini */}
                          {item.useSubItem && item.subItems.length > 0 && (
                            <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                              <div className="space-y-3">
                                {item.subItems.map((subItem, subIdx) => (
                                  <div
                                    key={subIdx}
                                    className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg"
                                  >
                                    <div className="flex justify-between items-start mb-2">
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                        Kegiatan Sub Item
                                      </label>
                                      {canEdit && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleDeleteSubItem(idx, subIdx)
                                          }
                                          className="text-red-500 hover:text-red-700 text-xs"
                                        >
                                          Hapus
                                        </button>
                                      )}
                                    </div>
                                    <textarea
                                      value={subItem.kegiatan}
                                      onChange={(e) => {
                                        const updated = [...items];
                                        updated[idx].subItems[subIdx].kegiatan =
                                          e.target.value;
                                        setItems(updated);
                                      }}
                                      rows={1}
                                      placeholder="Contoh: 1.1.a. CSL..., atau 1.2 Tutorial..."
                                      className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm mb-2"
                                    />
                                    <div className="grid grid-cols-2 gap-2">
                                      <div>
                                        <input
                                          type="number"
                                          step="0.01"
                                          min="0"
                                          value={
                                            subItem.indeks_poin === 0
                                              ? ""
                                              : subItem.indeks_poin
                                          }
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const updated = [...items];
                                            if (val === "" || val === "-") {
                                              updated[idx].subItems[
                                                subIdx
                                              ].indeks_poin = 0;
                                            } else {
                                              const num = parseFloat(val);
                                              if (!isNaN(num)) {
                                                updated[idx].subItems[
                                                  subIdx
                                                ].indeks_poin = num;
                                              }
                                            }
                                            setItems(updated);
                                          }}
                                          placeholder="Indeks poin (contoh: 1.5)"
                                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm bg-white dark:bg-gray-700"
                                        />
                                      </div>
                                      <div
                                        className="relative"
                                        data-sub-item-dropdown
                                      >
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setShowSubItemUnitKerjaDropdown(
                                              showSubItemUnitKerjaDropdown ===
                                                `${idx}-${subIdx}`
                                                ? null
                                                : `${idx}-${subIdx}`
                                            );
                                          }}
                                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-left text-gray-900 dark:text-white text-sm flex items-center justify-between bg-white dark:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-colors"
                                        >
                                          <span
                                            className={
                                              subItem.unit_kerja
                                                ? "text-gray-900 dark:text-white text-xs"
                                                : "text-gray-500 dark:text-gray-400 text-xs"
                                            }
                                          >
                                            {subItem.unit_kerja ||
                                              "Pilih Unit Kerja"}
                                          </span>
                                          <svg
                                            className={`w-4 h-4 transition-transform ${showSubItemUnitKerjaDropdown ===
                                              `${idx}-${subIdx}`
                                              ? "transform rotate-180"
                                              : ""
                                              }`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M19 9l-7 7-7-7"
                                            />
                                          </svg>
                                        </button>

                                        {showSubItemUnitKerjaDropdown ===
                                          `${idx}-${subIdx}` && (
                                            <div
                                              className="absolute z-[100010] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto"
                                              onClick={(e) => e.stopPropagation()}
                                              data-sub-item-dropdown
                                            >
                                              {UNIT_KERJA_OPTIONS.map((unit) => {
                                                const selectedUnits =
                                                  subItem.unit_kerja
                                                    ? subItem.unit_kerja
                                                      .split(", ")
                                                      .filter(Boolean)
                                                    : [];
                                                const isSelected =
                                                  selectedUnits.includes(unit);
                                                return (
                                                  <label
                                                    key={unit}
                                                    className="flex items-center px-3 py-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                                                    onClick={(e) =>
                                                      e.stopPropagation()
                                                    }
                                                  >
                                                    <input
                                                      type="checkbox"
                                                      checked={isSelected}
                                                      onChange={(e) => {
                                                        e.stopPropagation();
                                                        const updated = [
                                                          ...items,
                                                        ];
                                                        const currentUnits =
                                                          subItem.unit_kerja
                                                            ? subItem.unit_kerja
                                                              .split(", ")
                                                              .filter(Boolean)
                                                            : [];
                                                        let newUnits;
                                                        if (e.target.checked) {
                                                          newUnits = [
                                                            ...currentUnits,
                                                            unit,
                                                          ];
                                                        } else {
                                                          newUnits =
                                                            currentUnits.filter(
                                                              (u) => u !== unit
                                                            );
                                                        }
                                                        updated[idx].subItems[
                                                          subIdx
                                                        ].unit_kerja =
                                                          newUnits.join(", ");
                                                        setItems(updated);
                                                      }}
                                                      onClick={(e) =>
                                                        e.stopPropagation()
                                                      }
                                                      className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-400 dark:ring-offset-gray-800 focus:ring-2 cursor-pointer"
                                                    />
                                                    <span className="ml-2.5 text-xs text-gray-900 dark:text-white">
                                                      {unit}
                                                    </span>
                                                  </label>
                                                );
                                              })}
                                            </div>
                                          )}
                                      </div>
                                    </div>
                                    <div className="mt-2">
                                      <input
                                        type="text"
                                        value={subItem.bukti_fisik}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx].subItems[
                                            subIdx
                                          ].bukti_fisik = e.target.value;
                                          setItems(updated);
                                        }}
                                        placeholder="Bukti fisik"
                                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm bg-white dark:bg-gray-700"
                                      />
                                    </div>
                                    <div className="mt-2">
                                      <textarea
                                        value={subItem.prosedur}
                                        onChange={(e) => {
                                          const updated = [...items];
                                          updated[idx].subItems[
                                            subIdx
                                          ].prosedur = e.target.value;
                                          setItems(updated);
                                        }}
                                        rows={1}
                                        placeholder="Prosedur yang dilakukan oleh dosen"
                                        className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm bg-white dark:bg-gray-700"
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Tombol Tambah Sub Item untuk item ini - di bawah sub items */}
                          {canEdit && item.useSubItem && (
                            <div className="mt-4 flex justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => handleAddSubItemForItem(idx)}
                                className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"
                              >
                                Tambah Sub Item
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Tombol Tambah Item - di dalam modal, setelah list items */}
                {canEdit && hasData && (
                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleAddNewItem}
                      className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition flex items-center gap-2"
                    >
                      <svg
                        className="w-5 h-5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 4v16m8-8H4"
                        />
                      </svg>
                      <span>+ Tambah Item</span>
                    </button>
                  </div>
                )}

                {/* Modal Pilih Tipe Sub Item */}
                {/* Modal muncul jika showSubItemTypeModal true, baik dari form utama (useSubItem) atau dari item di list (currentItemIndex !== null) */}
                <AnimatePresence>
                  {showSubItemTypeModal && (
                    <div className="fixed inset-0 z-[100002] flex items-center justify-center">
                      {/* Overlay */}
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100002] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                        onClick={() => {
                          setShowSubItemTypeModal(false);
                          setCurrentItemIndex(null);
                        }}
                      />
                      {/* Modal Content */}
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="relative bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100003] max-w-md w-full mx-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {/* Close Button */}
                        <button
                          onClick={() => {
                            setShowSubItemTypeModal(false);
                            setCurrentItemIndex(null);
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

                        {/* Header */}
                        <div className="mb-6">
                          <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                            Pilih Format Sub Item
                          </h2>
                          <p className="text-sm text-gray-500 dark:text-gray-400">
                            Pilih format untuk sub item yang akan ditambahkan
                          </p>
                        </div>
                        <div className="space-y-3">
                          <button
                            onClick={() => {
                              if (currentItemIndex !== null) {
                                // Add to item in list
                                handleAddSubItemToItem(
                                  currentItemIndex,
                                  "number"
                                );
                              } else {
                                // Add to form utama
                                const currentNo = form.no;
                                const lastSub = subItems[subItems.length - 1];
                                let baseNo = currentNo;

                                if (lastSub && lastSub.kegiatan) {
                                  const numberMatch =
                                    lastSub.kegiatan.match(/^(\d+\.\d+)/);
                                  if (numberMatch) {
                                    const parts = numberMatch[1].split(".");
                                    const nextNo = parseInt(parts[1]) + 1;
                                    baseNo = `${parts[0]}.${nextNo}`;
                                  } else {
                                    const mainMatch =
                                      form.kegiatan.match(/^(\d+\.\d+)/);
                                    if (mainMatch) {
                                      const parts = mainMatch[1].split(".");
                                      const nextNo = parseInt(parts[1]) + 1;
                                      baseNo = `${parts[0]}.${nextNo}`;
                                    } else {
                                      baseNo = `${currentNo}.1`;
                                    }
                                  }
                                } else {
                                  const mainMatch =
                                    form.kegiatan.match(/^(\d+\.\d+)/);
                                  if (mainMatch) {
                                    const parts = mainMatch[1].split(".");
                                    const nextNo = parseInt(parts[1]) + 1;
                                    baseNo = `${parts[0]}.${nextNo}`;
                                  } else {
                                    baseNo = `${currentNo}.1`;
                                  }
                                }

                                const newSubItems = [
                                  ...subItems,
                                  {
                                    id: `sub-${Date.now()}`,
                                    kegiatan: `${baseNo} `,
                                    indeks_poin: 0,
                                    unit_kerja: "",
                                    bukti_fisik: "",
                                    prosedur: "",
                                  },
                                ];

                                setSubItems(newSubItems);
                                setShowSubItemTypeModal(false);
                              }
                            }}
                            className="w-full px-4 py-3 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition text-left"
                          >
                            <div className="font-medium">
                              Format Angka (1.2, 1.3, dst)
                            </div>
                            <div className="text-sm opacity-90">
                              Untuk sub item dengan format angka
                            </div>
                          </button>
                          <button
                            onClick={() => {
                              if (currentItemIndex !== null) {
                                // Add to item in list
                                handleAddSubItemToItem(
                                  currentItemIndex,
                                  "letter"
                                );
                              } else {
                                // Add to form utama
                                const currentNo = form.no;
                                const lastSub = subItems[subItems.length - 1];
                                let baseNo = "";

                                if (lastSub && lastSub.kegiatan) {
                                  // Check for format like "2.a", "2.b" (number.letter directly)
                                  const directLetterMatch =
                                    lastSub.kegiatan.match(
                                      /^(\d+)\.([a-z])\./i
                                    );
                                  if (directLetterMatch) {
                                    const base = directLetterMatch[1];
                                    const lastLetter = directLetterMatch[2];
                                    const nextLetter = String.fromCharCode(
                                      lastLetter.charCodeAt(0) + 1
                                    );
                                    baseNo = `${base}.${nextLetter}`;
                                  } else {
                                    // Check for format like "1.1.a", "1.1.b" (number.number.letter)
                                    const letterMatch = lastSub.kegiatan.match(
                                      /^(\d+\.\d+)\.([a-z])\./i
                                    );
                                    if (letterMatch) {
                                      const base = letterMatch[1];
                                      const lastLetter = letterMatch[2];
                                      const nextLetter = String.fromCharCode(
                                        lastLetter.charCodeAt(0) + 1
                                      );
                                      baseNo = `${base}.${nextLetter}`;
                                    } else {
                                      const numberMatch =
                                        lastSub.kegiatan.match(/^(\d+\.\d+)/);
                                      if (numberMatch) {
                                        baseNo = `${numberMatch[1]}.a`;
                                      } else {
                                        const mainMatch =
                                          form.kegiatan.match(/^(\d+\.\d+)/);
                                        if (mainMatch) {
                                          baseNo = `${mainMatch[1]}.a`;
                                        } else {
                                          // Direct format: 2.a, 3.a, etc.
                                          baseNo = `${currentNo}.a`;
                                        }
                                      }
                                    }
                                  }
                                } else {
                                  const mainMatch =
                                    form.kegiatan.match(/^(\d+\.\d+)/);
                                  if (mainMatch) {
                                    baseNo = `${mainMatch[1]}.a`;
                                  } else {
                                    // Direct format: 2.a, 3.a, etc.
                                    baseNo = `${currentNo}.a`;
                                  }
                                }

                                const newSubItems = [
                                  ...subItems,
                                  {
                                    id: `sub-${Date.now()}`,
                                    kegiatan: `${baseNo}. `,
                                    indeks_poin: 0,
                                    unit_kerja: "",
                                    bukti_fisik: "",
                                    prosedur: "",
                                  },
                                ];

                                setSubItems(newSubItems);
                                setShowSubItemTypeModal(false);
                              }
                            }}
                            className="w-full px-4 py-3 rounded-lg bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 text-sm font-medium shadow-theme-xs hover:bg-green-200 dark:hover:bg-green-800 transition text-left"
                          >
                            <div className="font-medium">
                              Format Huruf (1.1.a, 1.1.b, dst)
                            </div>
                            <div className="text-sm opacity-90">
                              Untuk sub item dengan format huruf
                            </div>
                          </button>
                        </div>
                      </motion.div>
                    </div>
                  )}
                </AnimatePresence>

                <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => {
                      handleCloseModal();
                      setShowBidangModal(true);
                    }}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium shadow-theme-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition flex items-center gap-2"
                  >
                    <svg
                      className="w-5 h-5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 19l-7-7m0 0l7-7m-7 7h18"
                      />
                    </svg>
                    <span>Kembali</span>
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCloseModal}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium shadow-theme-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      {canEdit ? "Batal" : "Tutup"}
                    </button>
                    {canEdit && (
                      <button
                        onClick={handleSave}
                        disabled={isSaving}
                        className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSaving && (
                          <svg
                            className="animate-spin h-4 w-4 text-white"
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
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                            ></path>
                          </svg>
                        )}
                        {isSaving ? "Menyimpan..." : "Simpan"}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Import Excel */}
        <AnimatePresence>
          {showImportModal && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={handleCloseImportModal}
              />

              {/* Modal Content */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-6xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
              >
                {/* Close Button */}
                <button
                  onClick={handleCloseImportModal}
                  className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
                  disabled={isSaving}
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

                {/* Header */}
                <div className="mb-6">
                  <h2 className="text-xl font-semibold text-gray-800 dark:text-white">
                    Import Data Pedoman Poin IKD
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Preview dan validasi data sebelum import
                  </p>
                </div>

                {/* Upload Section */}
                {!importedFile && (
                  <div className="mb-6">
                    <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-8 text-center hover:border-brand-500 dark:hover:border-brand-400 transition-colors">
                      <div className="space-y-4">
                        <div className="w-16 h-16 mx-auto bg-brand-100 dark:bg-brand-900 rounded-full flex items-center justify-center">
                          <FontAwesomeIcon
                            icon={faFileExcel}
                            className="w-8 h-8 text-brand-600 dark:text-brand-400"
                          />
                        </div>
                        <div>
                          <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                            Upload File Excel
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                            Pilih file Excel dengan format template (.xlsx,
                            .xls)
                          </p>
                        </div>
                        <label className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 transition-colors cursor-pointer">
                          <FontAwesomeIcon
                            icon={faUpload}
                            className="w-4 h-4"
                          />
                          Pilih File
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls"
                            onChange={handleImport}
                            className="hidden"
                          />
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* File Info */}
                {importedFile && (
                  <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-center gap-3">
                      <FontAwesomeIcon
                        icon={faFileExcel}
                        className="w-5 h-5 text-blue-500"
                      />

                      <div className="flex-1">
                        <p className="font-medium text-blue-800 dark:text-blue-200">
                          {importedFile.name}
                        </p>

                        <p className="text-sm text-blue-600 dark:text-blue-300">
                          {(importedFile.size / 1024).toFixed(1)} KB
                        </p>
                      </div>

                      <button
                        onClick={() => {
                          setImportedFile(null);
                          setPreviewData([]);
                          setValidationErrors([]);
                          setCellErrors([]);
                          if (fileInputRef.current) {
                            fileInputRef.current.value = "";
                          }
                        }}
                        className="flex items-center justify-center w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-200 dark:hover:bg-red-900/40 transition-colors"
                        title="Hapus file"
                        disabled={isSaving}
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                )}

                {/* Error Messages */}
                {cellErrors.length > 0 && (
                  <div className="mb-6">
                    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <FontAwesomeIcon
                          icon={faExclamationTriangle}
                          className="w-5 h-5 text-red-500"
                        />

                        <h3 className="text-lg font-semibold text-red-600 dark:text-red-400">
                          Error Validasi ({cellErrors.length} error)
                        </h3>
                      </div>

                      <div className="max-h-40 overflow-y-auto">
                        {/* Error cell/detail */}
                        {cellErrors.map((err, idx) => (
                          <p
                            key={idx}
                            className="text-sm text-red-600 dark:text-red-400 mb-1"
                          >
                            • {err.message} {err.field.toUpperCase()}
                          </p>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* Preview Data Table */}
                {previewData.length > 0 && (
                  <div className="mb-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                        Preview Data ({previewData.length} data)
                      </h3>

                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        File: {importedFile?.name}
                      </div>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                      <div className="max-w-full overflow-x-auto hide-scroll">
                        <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                          <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                            <tr>
                              <th className="px-4 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                No
                              </th>

                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Bidang
                              </th>

                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                NO
                              </th>

                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Kegiatan
                              </th>

                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Indeks Poin
                              </th>

                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Unit Kerja
                              </th>

                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Bukti Fisik
                              </th>

                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Prosedur
                              </th>

                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Is Sub Item
                              </th>

                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Parent NO
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {previewData.map((row, index) => {
                              const actualIndex = index;

                              const renderEditableCell = (
                                field: string,
                                value: any,
                                isNumeric = false,
                                isSelect = false,
                                selectOptions?: {
                                  value: string;
                                  label: string;
                                }[],
                                disabled = false
                              ) => {
                                const isEditing =
                                  editingCell?.row === actualIndex &&
                                  editingCell?.key === field;

                                const cellError = cellErrors.find(
                                  (err) =>
                                    err.row === actualIndex + 2 &&
                                    err.field === field
                                );

                                return (
                                  <td
                                    className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing
                                      ? "border-2 border-brand-500"
                                      : ""
                                      } ${cellError
                                        ? "bg-red-100 dark:bg-red-900/30"
                                        : ""
                                      }`}
                                    onClick={() => {
                                      if (!disabled && !isSelect) {
                                        setEditingCell({
                                          row: actualIndex,
                                          key: field,
                                        });
                                      }
                                    }}
                                    title={cellError ? cellError.message : ""}
                                  >
                                    {isEditing && !isSelect ? (
                                      <input
                                        className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                        type={isNumeric ? "number" : "text"}
                                        value={value || ""}
                                        onChange={(e) => {
                                          handleCellEdit(
                                            actualIndex,
                                            field,
                                            isNumeric
                                              ? Number(e.target.value) || 0
                                              : e.target.value
                                          );
                                        }}
                                        onBlur={() => setEditingCell(null)}
                                        autoFocus
                                      />
                                    ) : isSelect ? (
                                      <select
                                        value={
                                          field === "is_sub_item"
                                            ? value
                                              ? "Y"
                                              : "N"
                                            : value || ""
                                        }
                                        onChange={(e) => {
                                          handleCellEdit(
                                            actualIndex,
                                            field,
                                            field === "is_sub_item"
                                              ? e.target.value === "Y"
                                              : e.target.value
                                          );
                                        }}
                                        className="w-full px-1 border-none outline-none text-xs md:text-sm bg-transparent"
                                        disabled={disabled}
                                      >
                                        {selectOptions?.map((opt) => (
                                          <option
                                            key={opt.value}
                                            value={opt.value}
                                          >
                                            {opt.label}
                                          </option>
                                        ))}
                                      </select>
                                    ) : (
                                      <span
                                        className={
                                          cellError
                                            ? "text-red-500"
                                            : "text-gray-800 dark:text-gray-100"
                                        }
                                      >
                                        {value || "-"}
                                      </span>
                                    )}
                                  </td>
                                );
                              };

                              return (
                                <tr
                                  key={index}
                                  className={`${index % 2 === 1
                                    ? "bg-gray-50 dark:bg-white/[0.02]"
                                    : ""
                                    }`}
                                >
                                  <td className="px-4 py-4 text-gray-800 dark:text-white/90 whitespace-nowrap">
                                    {index + 1}
                                  </td>

                                  {renderEditableCell("bidang", row.bidang)}
                                  {renderEditableCell("no", row.no)}
                                  {renderEditableCell("kegiatan", row.kegiatan)}
                                  {renderEditableCell(
                                    "indeks_poin",
                                    row.indeks_poin,
                                    true
                                  )}
                                  {renderEditableCell(
                                    "unit_kerja",
                                    row.unit_kerja
                                  )}
                                  {renderEditableCell(
                                    "bukti_fisik",
                                    row.bukti_fisik
                                  )}
                                  {renderEditableCell("prosedur", row.prosedur)}
                                  {renderEditableCell(
                                    "is_sub_item",
                                    row.is_sub_item,
                                    false,
                                    true,
                                    [
                                      { value: "N", label: "N" },
                                      { value: "Y", label: "Y" },
                                    ]
                                  )}
                                  {renderEditableCell(
                                    "parent_no",
                                    row.parent_no,
                                    false,
                                    false,
                                    undefined,
                                    !row.is_sub_item
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={handleCloseImportModal}
                    className="px-6 py-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    disabled={isSaving}
                  >
                    {importedCount > 0 ? "Tutup" : "Batal"}
                  </button>

                  {previewData.length > 0 &&
                    validationErrors.length === 0 &&
                    cellErrors.length === 0 &&
                    importedCount === 0 && (
                      <button
                        onClick={handleSubmitImport}
                        disabled={isSaving}
                        className="px-6 py-3 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isSaving ? (
                          <>
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            Mengimpor...
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon
                              icon={faUpload}
                              className="w-4 h-4"
                            />
                            Import Data ({previewData.length} data)
                          </>
                        )}
                      </button>
                    )}
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Konfirmasi Delete Item */}
        <AnimatePresence>
          {showDeleteItemModal && itemToDeleteIndex !== null && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              <div
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={() => {
                  setShowDeleteItemModal(false);
                  setItemToDeleteIndex(null);
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
                    Apakah Anda yakin ingin menghapus item ini?
                  </p>
                  {itemToDeleteIndex !== null && items[itemToDeleteIndex] && (
                    <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                      <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                        <span className="font-semibold">NO:</span>{" "}
                        {items[itemToDeleteIndex].no}
                      </p>
                      <p className="text-sm text-gray-700 dark:text-gray-300">
                        <span className="font-semibold">Kegiatan:</span>{" "}
                        {items[itemToDeleteIndex].kegiatan || "(kosong)"}
                      </p>
                    </div>
                  )}
                  <p className="mb-6 text-sm text-red-600 dark:text-red-400">
                    ⚠️ Peringatan: Data yang dihapus tidak dapat dikembalikan.
                    Semua data terkait seperti file yang sudah diupload oleh
                    dosen, skor, dan data lainnya akan ikut hilang.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setShowDeleteItemModal(false);
                        setItemToDeleteIndex(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={confirmDeleteItem}
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

        {/* Modal Konfirmasi Delete Sub Item */}
        <AnimatePresence>
          {showDeleteSubItemModal && subItemToDeleteIndex !== null && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              <div
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={() => {
                  setShowDeleteSubItemModal(false);
                  setSubItemToDeleteIndex(null);
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
                    Apakah Anda yakin ingin menghapus sub item ini?
                  </p>
                  {subItemToDeleteIndex !== null &&
                    items[subItemToDeleteIndex.itemIndex] &&
                    items[subItemToDeleteIndex.itemIndex].subItems[
                    subItemToDeleteIndex.subItemIndex
                    ] && (
                      <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
                        <p className="text-sm text-gray-700 dark:text-gray-300 mb-2">
                          <span className="font-semibold">Item NO:</span>{" "}
                          {items[subItemToDeleteIndex.itemIndex].no}
                        </p>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          <span className="font-semibold">
                            Kegiatan Sub Item:
                          </span>{" "}
                          {items[subItemToDeleteIndex.itemIndex].subItems[
                            subItemToDeleteIndex.subItemIndex
                          ].kegiatan || "(kosong)"}
                        </p>
                      </div>
                    )}
                  <p className="mb-6 text-sm text-red-600 dark:text-red-400">
                    ⚠️ Peringatan: Data yang dihapus tidak dapat dikembalikan.
                    Semua data terkait seperti file yang sudah diupload oleh
                    dosen, skor, dan data lainnya akan ikut hilang.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setShowDeleteSubItemModal(false);
                        setSubItemToDeleteIndex(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={confirmDeleteSubItem}
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
      </div>
    </RekapIKDBase>
  );
};

export default PedomanPoinIKD;
