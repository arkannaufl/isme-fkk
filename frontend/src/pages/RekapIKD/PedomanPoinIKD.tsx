import React, { useState, useEffect, useRef } from "react";
import RekapIKDBase from "./RekapIKDBase";
import { motion, AnimatePresence } from "framer-motion";
import api from "../../utils/api";

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
  const [showDeleteBidangModal, setShowDeleteBidangModal] = useState(false);
  const [bidangToDelete, setBidangToDelete] = useState<IKDBidang | null>(null);
  const [showAddItemModal, setShowAddItemModal] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bidangModalError, setBidangModalError] = useState<string | null>(null);
  const [useSubItem, setUseSubItem] = useState(false);
  const [parentItemId, setParentItemId] = useState<number | null>(null);
  const [subItems, setSubItems] = useState<Array<{ id?: string; kegiatan: string; indeks_poin: number; unit_kerja: string; bukti_fisik: string; prosedur: string }>>([]);
  const [showSubItemTypeModal, setShowSubItemTypeModal] = useState(false);
  const [showUnitKerjaDropdown, setShowUnitKerjaDropdown] = useState(false);
  const [showSubItemUnitKerjaDropdown, setShowSubItemUnitKerjaDropdown] = useState<string | null>(null);
  const unitKerjaDropdownRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<Array<{ id?: number; no: string; kegiatan: string; indeks_poin: number; unit_kerja: string; bukti_fisik: string; prosedur: string; useSubItem: boolean; subItems: Array<{ id?: string; kegiatan: string; indeks_poin: number; unit_kerja: string; bukti_fisik: string; prosedur: string }> }>>([]);
  const [currentItemIndex, setCurrentItemIndex] = useState<number | null>(null);
  const [deletedItems, setDeletedItems] = useState<number[]>([]); // Track items yang dihapus untuk dihapus dari database saat save
  const [deletedSubItems, setDeletedSubItems] = useState<number[]>([]); // Track sub items yang dihapus untuk dihapus dari database saat save
  const [deletedMainForm, setDeletedMainForm] = useState<number | null>(null); // Track form utama yang dihapus
  
  // State untuk modal konfirmasi hapus
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteType, setDeleteType] = useState<'item' | 'subItem' | 'mainFormSubItem' | 'mainForm' | null>(null);
  const [deleteItemIndex, setDeleteItemIndex] = useState<number | null>(null);
  const [deleteSubItemIndex, setDeleteSubItemIndex] = useState<number | null>(null);

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
      if (unitKerjaDropdownRef.current && !unitKerjaDropdownRef.current.contains(target)) {
        setShowUnitKerjaDropdown(false);
      }
      
      // Check sub item dropdowns - close if click is outside any dropdown
      const allDropdowns = document.querySelectorAll('[data-sub-item-dropdown]');
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
      const uniqueBidang = new Map<string, { kode: string; nama: string; is_auto: boolean }>();
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
          let itemSubItems: Array<{ id?: string; kegiatan: string; indeks_poin: number; unit_kerja: string; bukti_fisik: string; prosedur: string }> = [];
          
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
                const pattern1 = new RegExp(`^${mainNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d+`); // 1.1, 1.2
                const pattern2 = new RegExp(`^${mainNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d+\\.`); // 1.1., 1.2.
                const pattern3 = new RegExp(`^${mainNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d+[a-z]`, 'i'); // 1.1a, 1.1b
                const pattern4 = new RegExp(`^${mainNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.\\d+\\.([a-z])`, 'i'); // 1.1.a, 1.1.b
                const pattern5 = new RegExp(`^${mainNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.([a-z])`, 'i'); // 2.a, 1.a
                
                return subItem.bidang === bidang && 
                       subItem.no === item.no &&
                       (pattern1.test(kegiatanTrimmed) || 
                        pattern2.test(kegiatanTrimmed) || 
                        pattern3.test(kegiatanTrimmed) || 
                        pattern4.test(kegiatanTrimmed) || 
                        pattern5.test(kegiatanTrimmed));
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
        const bidangItems = pedomanData.filter((item) => item.bidang === bidang);
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
    const currentItems = items.map(item => ({
      no: item.no,
      kegiatan: item.kegiatan,
      indeks_poin: item.indeks_poin,
      unit_kerja: item.unit_kerja,
      bukti_fisik: item.bukti_fisik,
      prosedur: item.prosedur,
      useSubItem: item.useSubItem, // Preserve existing useSubItem state - DO NOT CHANGE
      subItems: item.subItems.map(sub => ({
        id: sub.id,
        kegiatan: sub.kegiatan,
        indeks_poin: sub.indeks_poin,
        unit_kerja: sub.unit_kerja,
        bukti_fisik: sub.bukti_fisik,
        prosedur: sub.prosedur,
      })) // Deep copy each subItem
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
  
  const handleAddSubItemToItem = (itemIndex: number, subItemType: 'number' | 'letter') => {
    const item = items[itemIndex];
    const currentNo = item.no;
    const lastSub = item.subItems[item.subItems.length - 1];
    let baseNo = "";
    
    if (subItemType === 'number') {
      // Generate next number format (1.2, 1.3, etc.)
      if (lastSub && lastSub.kegiatan) {
        const numberMatch = lastSub.kegiatan.match(/^(\d+\.\d+)/);
        if (numberMatch) {
          const parts = numberMatch[1].split('.');
          const nextNo = parseInt(parts[1]) + 1;
          baseNo = `${parts[0]}.${nextNo}`;
        } else {
          const mainMatch = item.kegiatan.match(/^(\d+\.\d+)/);
          if (mainMatch) {
            const parts = mainMatch[1].split('.');
            const nextNo = parseInt(parts[1]) + 1;
            baseNo = `${parts[0]}.${nextNo}`;
          } else {
            baseNo = `${currentNo}.1`;
          }
        }
      } else {
        const mainMatch = item.kegiatan.match(/^(\d+\.\d+)/);
        if (mainMatch) {
          const parts = mainMatch[1].split('.');
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
            const nextLetter = String.fromCharCode(lastLetter.charCodeAt(0) + 1);
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
      kegiatan: subItemType === 'number' ? `${baseNo} ` : `${baseNo}. `,
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
    // Buka modal konfirmasi hapus
    setDeleteType('item');
    setDeleteItemIndex(index);
    setShowDeleteModal(true);
  };
  
  const confirmDeleteItem = () => {
    if (deleteItemIndex === null) return;
    
    const itemToDelete = items[deleteItemIndex];
    
    // Jika item punya id, berarti sudah ada di database, track untuk dihapus saat save
    if (itemToDelete?.id) {
      setDeletedItems(prev => [...prev, itemToDelete.id!]);
    }
    
    // Hapus sub items dari item ini juga (jika ada id)
    if (itemToDelete?.subItems) {
      itemToDelete.subItems.forEach(subItem => {
        if (subItem.id) {
          const subItemId = typeof subItem.id === 'string' ? parseInt(subItem.id) : subItem.id;
          if (!isNaN(subItemId)) {
            setDeletedSubItems(prev => [...prev, subItemId]);
          }
        }
      });
    }
    
    // Hapus dari state
    const newItems = items.filter((_, i) => i !== deleteItemIndex);
    setItems(newItems);
    
    // Tutup modal
    setShowDeleteModal(false);
    setDeleteType(null);
    setDeleteItemIndex(null);
  };
  
  const handleDeleteSubItem = (itemIndex: number, subItemIndex: number) => {
    // Buka modal konfirmasi hapus
    setDeleteType('subItem');
    setDeleteItemIndex(itemIndex);
    setDeleteSubItemIndex(subItemIndex);
    setShowDeleteModal(true);
  };
  
  const confirmDeleteSubItem = () => {
    if (deleteItemIndex === null || deleteSubItemIndex === null) return;
    
    const item = items[deleteItemIndex];
    const subItemToDelete = item.subItems[deleteSubItemIndex];
    
    // Jika sub item punya id, berarti sudah ada di database, track untuk dihapus saat save
    if (subItemToDelete?.id) {
      const subItemId = typeof subItemToDelete.id === 'string' ? parseInt(subItemToDelete.id) : subItemToDelete.id;
      if (!isNaN(subItemId)) {
        setDeletedSubItems(prev => [...prev, subItemId]);
      }
    }
    
    // Hapus dari state
    const updatedItems = [...items];
    updatedItems[deleteItemIndex].subItems = updatedItems[deleteItemIndex].subItems.filter((_, i) => i !== deleteSubItemIndex);
    setItems(updatedItems);
    
    // Tutup modal
    setShowDeleteModal(false);
    setDeleteType(null);
    setDeleteItemIndex(null);
    setDeleteSubItemIndex(null);
  };
  
  const handleDeleteMainFormSubItem = (subItemIndex: number) => {
    // Buka modal konfirmasi hapus
    setDeleteType('mainFormSubItem');
    setDeleteSubItemIndex(subItemIndex);
    setShowDeleteModal(true);
  };
  
  const confirmDeleteMainFormSubItem = () => {
    if (deleteSubItemIndex === null) return;
    
    const subItemToDelete = subItems[deleteSubItemIndex];
    
    // Jika sub item punya id, berarti sudah ada di database, track untuk dihapus saat save
    if (subItemToDelete?.id) {
      const subItemId = typeof subItemToDelete.id === 'string' ? parseInt(subItemToDelete.id) : subItemToDelete.id;
      if (!isNaN(subItemId)) {
        setDeletedSubItems(prev => [...prev, subItemId]);
      }
    }
    
    // Hapus dari state
    const newSubItems = subItems.filter((_, i) => i !== deleteSubItemIndex);
    setSubItems(newSubItems);
    
    // Tutup modal
    setShowDeleteModal(false);
    setDeleteType(null);
    setDeleteSubItemIndex(null);
  };
  
  const handleDeleteMainForm = () => {
    // Buka modal konfirmasi hapus
    setDeleteType('mainForm');
    setShowDeleteModal(true);
  };
  
  const confirmDeleteMainForm = () => {
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
    
    // Tutup modal
    setShowDeleteModal(false);
    setDeleteType(null);
  };
  
  const handleCancelDelete = () => {
    setShowDeleteModal(false);
    setDeleteType(null);
    setDeleteItemIndex(null);
    setDeleteSubItemIndex(null);
  };
  
  const handleConfirmDelete = () => {
    if (deleteType === 'item') {
      confirmDeleteItem();
    } else if (deleteType === 'subItem') {
      confirmDeleteSubItem();
    } else if (deleteType === 'mainFormSubItem') {
      confirmDeleteMainFormSubItem();
    } else if (deleteType === 'mainForm') {
      confirmDeleteMainForm();
    }
  };
  
  const getDeleteMessage = () => {
    if (deleteType === 'item' && deleteItemIndex !== null) {
      const item = items[deleteItemIndex];
      return `Item dengan NO "${item.no}" dan kegiatan "${item.kegiatan || '(kosong)'}"`;
    } else if (deleteType === 'subItem' && deleteItemIndex !== null && deleteSubItemIndex !== null) {
      const item = items[deleteItemIndex];
      const subItem = item.subItems[deleteSubItemIndex];
      return `Sub Item dengan kegiatan "${subItem.kegiatan || '(kosong)'}" dari Item "${item.no}"`;
    } else if (deleteType === 'mainFormSubItem' && deleteSubItemIndex !== null) {
      const subItem = subItems[deleteSubItemIndex];
      return `Sub Item dengan kegiatan "${subItem.kegiatan || '(kosong)'}" dari Form Utama`;
    } else if (deleteType === 'mainForm') {
      return `Form Utama dengan NO "${form.no}" dan kegiatan "${form.kegiatan || '(kosong)'}"`;
    }
    return 'item ini';
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
          const pattern = new RegExp(`^${mainNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`);
          return pattern.test(kegiatanTrimmed) && subItem.bidang === item.bidang;
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
      const parent = pedomanData.find(p => p.id && p.no === parentNo && !/^\d+\.\d+/.test(p.kegiatan));
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
    
    return !!(numberNumberMatch || numberLetterMatch || numberNumberLetterMatch);
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
      const pattern = new RegExp(`^${item.no.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`);
      return pattern.test(kegiatanTrimmed) && subItem.bidang === item.bidang;
    });
    return subItems.length > 0;
  };

  const handleSave = async () => {
    try {
      if (!selectedBidang) {
        setError("Pilih Bidang terlebih dahulu");
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

        // Validate unit kerja: only required if kegiatan has numbered format WITH letter (1.1.a, 2.a, etc.)
        // Format angka saja (1.1, 2.2) is optional
        const hasFormatWithLetter = hasNumberedFormatWithLetter(item.kegiatan);
        if (hasFormatWithLetter && !item.unit_kerja) {
          setError(`Unit Kerja harus diisi untuk Item ${item.no}`);
          return;
        }

        // Save main item
        // Format angka saja (1.1, 2.2) is optional, so keep user input
        const isItemNumberOnly = item.useSubItem && isSubItemNumberOnlyInList(item.kegiatan);
        // Get bidang nama from bidangList
        const bidangInfo = bidangList.find(b => b.kode === selectedBidang);
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
              await api.put(`/rekap-ikd/pedoman-poin/${existingItem.id}`, mainPayload);
              mainItemId = existingItem.id;
            } else {
              // Item belum ada, create baru
              const res = await api.post("/rekap-ikd/pedoman-poin", mainPayload);
              mainItemId = res.data?.data?.id || res.data?.id;
            }
          }
          
          savedItemIds.push(mainItemId);

          // Save sub items for this item if useSubItem is enabled
          if (item.useSubItem && item.subItems.length > 0 && mainItemId) {
            const mainNo = item.no;
            
            for (const subItem of item.subItems) {
              if (subItem.kegiatan.trim()) {
                // All fields are optional, so keep user input regardless of format
                // Get bidang nama from bidangList
                const bidangInfo = bidangList.find(b => b.kode === selectedBidang);
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
                  const isTemporaryId = typeof subItem.id === 'string' && subItem.id.startsWith('sub-');
                  
                  if (subItem.id && !isTemporaryId) {
                    // Sub item sudah ada di database (punya ID number), update saja
                    const subItemId = typeof subItem.id === 'string' ? parseInt(subItem.id) : subItem.id;
                    if (!isNaN(subItemId) && subItemId > 0) {
                      await api.put(`/rekap-ikd/pedoman-poin/${subItemId}`, subPayload);
                    }
                  } else {
                    // Cek apakah ada sub item dengan no + bidang + kegiatan yang sama
                    const existingSubItem = pedomanData.find(
                      (existing) =>
                        existing.no === mainNo &&
                        existing.bidang === selectedBidang &&
                        existing.kegiatan === subItem.kegiatan &&
                        (existing.parent_id === mainItemId || existing.level === 1)
                    );
                    
                    if (existingSubItem?.id) {
                      // Sub item sudah ada, update saja
                      await api.put(`/rekap-ikd/pedoman-poin/${existingSubItem.id}`, subPayload);
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
          setError(err?.response?.data?.message || `Gagal menyimpan Item ${item.no}. Silakan coba lagi.`);
          return;
        }
      }

      // Save form utama (if there's data in form)
      // Form utama tidak wajib jika sudah ada items yang disimpan
      if (form.no && form.kegiatan) {
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
        const bidangInfo = bidangList.find(b => b.kode === selectedBidang);
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
          await api.put(`/rekap-ikd/pedoman-poin/${editingItem.id}`, mainPayload);
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
            await api.put(`/rekap-ikd/pedoman-poin/${existingFormItem.id}`, mainPayload);
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
              const pattern = new RegExp(`^${mainNo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`);
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
          const bidangInfo = bidangList.find(b => b.kode === selectedBidang);
          for (const subItem of subItems) {
            if (subItem.kegiatan.trim()) {
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
                const isTemporaryId = typeof subItem.id === 'string' && subItem.id.startsWith('sub-');
                
                if (subItem.id && !isTemporaryId) {
                  // Sub item sudah ada di database (punya ID number), update saja
                  const subItemId = typeof subItem.id === 'string' ? parseInt(subItem.id) : subItem.id;
                  if (!isNaN(subItemId) && subItemId > 0) {
                    await api.put(`/rekap-ikd/pedoman-poin/${subItemId}`, subPayload);
                  }
                } else {
                  // Cek apakah ada sub item dengan no + bidang + kegiatan yang sama
                  const existingSubItem = pedomanData.find(
                    (existing) =>
                      existing.no === mainNo &&
                      existing.bidang === selectedBidang &&
                      existing.kegiatan === subItem.kegiatan &&
                      (existing.parent_id === mainItemId || existing.level === 1)
                  );
                  
                  if (existingSubItem?.id) {
                    // Sub item sudah ada, update saja
                    await api.put(`/rekap-ikd/pedoman-poin/${existingSubItem.id}`, subPayload);
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
      setError(error?.response?.data?.message || "Gagal menyimpan data. Silakan coba lagi.");
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
      if (editingBidang.kode.toUpperCase() !== newBidang.kode.toUpperCase().trim()) {
        const bidangExists = bidangList.find(
          (b) => b.kode.toUpperCase() === newBidang.kode.toUpperCase().trim()
        );
        if (bidangExists) {
          setBidangModalError(`Kode Bidang "${newBidang.kode.toUpperCase().trim()}" sudah ada. Gunakan kode yang berbeda.`);
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
      const pedomanWithBidang = pedomanData.filter((item) => item.bidang === editingBidang.kode);
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
      setSuccess(`Bidang berhasil diupdate menjadi ${newBidang.kode.toUpperCase().trim()} - ${newBidang.nama.trim()}`);
      await fetchPedomanData();
      setShowBidangModal(false);
      return;
    }

    // Tambah bidang baru
    const bidangExists = bidangList.find(
      (b) => b.kode.toUpperCase() === newBidang.kode.toUpperCase().trim()
    );
    if (bidangExists) {
      setBidangModalError(`Kode Bidang "${newBidang.kode.toUpperCase().trim()}" sudah ada. Gunakan kode yang berbeda.`);
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
    setSuccess(`Bidang ${newBidangItem.kode} - ${newBidangItem.nama} berhasil ditambahkan`);
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
      // Hapus semua pedoman dengan bidang ini
      const pedomanWithBidang = pedomanData.filter((item) => item.bidang === bidangToDelete.kode);
      for (const item of pedomanWithBidang) {
        if (item.id) {
          try {
            await api.delete(`/rekap-ikd/pedoman-poin/${item.id}`);
          } catch (err) {
            console.error("Error deleting pedoman:", err);
          }
        }
      }
      
      // Hapus dari bidangList
      setBidangList(bidangList.filter((b) => b.kode !== bidangToDelete.kode));
      setSuccess(`Bidang ${bidangToDelete.kode} - ${bidangToDelete.nama} dan semua item-nya berhasil dihapus`);
      setShowDeleteBidangModal(false);
      setBidangToDelete(null);
      await fetchPedomanData();
    } catch (error: any) {
      console.error("Error deleting bidang:", error);
      setError("Gagal menghapus bidang. Silakan coba lagi.");
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
      // Sort by no (handle "1", "1.1", "1.2", "2", etc.)
      const aParts = a.no.split(".").map(Number);
      const bParts = b.no.split(".").map(Number);
      for (let i = 0; i < Math.max(aParts.length, bParts.length); i++) {
        const aVal = aParts[i] || 0;
        const bVal = bParts[i] || 0;
        if (aVal !== bVal) return aVal - bVal;
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
        const pattern = new RegExp(`^${item.no.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.`);
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
      <div className="space-y-6">

        {/* Header with Button */}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Tabel Pedoman Poin IKD
          </h2>
          <div className="flex gap-2">
            <button
              onClick={handleEditTableClick}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              {hasData ? "Edit Table IKD" : "Buat Table IKD"}
            </button>
          </div>
        </div>

        {/* Bidang Selection Modal */}
        <AnimatePresence>
          {showBidangModal && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-sm"
                onClick={() => setShowBidangModal(false)}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-3xl mx-auto bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg z-[100001]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    {hasData ? "Pilih Bidang untuk Menambah Item" : "Pilih Bidang untuk Memulai"}
                  </h3>
                  <button
                    onClick={() => {
                      setShowBidangModal(false);
                      setBidangModalError(null);
                      setNewBidang({ kode: "", nama: "" });
                      setEditingBidang(null);
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="space-y-3 mb-4">
                  {bidangList.map((bidang) => {
                    const bidangItems = pedomanData.filter((item) => item.bidang === bidang.kode);
                    return (
                      <div
                        key={bidang.kode}
                        className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
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
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleEditBidang(bidang);
                              }}
                              className="p-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                              title="Edit Bidang"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setBidangToDelete(bidang);
                                setShowDeleteBidangModal(true);
                              }}
                              className="p-2 text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                              title="Hapus Bidang"
                            >
                              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                              </svg>
                            </button>
                            <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium mb-3 text-gray-900 dark:text-white">
                    {editingBidang ? "Edit Bidang" : "Tambah Bidang Baru"}
                  </h4>
                  
                  {/* Error Message */}
                  {bidangModalError && (
                    <div className="mb-3 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <p className="text-sm text-red-600 dark:text-red-400">
                          {bidangModalError}
                        </p>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Kode Bidang <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: B, C, E"
                        value={newBidang.kode}
                        onChange={(e) => {
                          setNewBidang({ ...newBidang, kode: e.target.value });
                          setBidangModalError(null);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Masukkan kode bidang (huruf tunggal atau kombinasi)
                      </p>
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Nama Bidang <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Penelitian, Pengabdian Masyarakat"
                        value={newBidang.nama}
                        onChange={(e) => {
                          setNewBidang({ ...newBidang, nama: e.target.value });
                          setBidangModalError(null);
                        }}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Masukkan nama lengkap bidang
                      </p>
                    </div>
                    <button
                      onClick={handleAddBidang}
                      className="w-full px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors font-medium shadow-md hover:shadow-lg"
                    >
                      {editingBidang ? "Update Bidang" : "Tambah Bidang"}
                    </button>
                    {editingBidang && (
                      <button
                        onClick={() => {
                          setEditingBidang(null);
                          setNewBidang({ kode: "", nama: "" });
                          setBidangModalError(null);
                        }}
                        className="w-full px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors mt-2"
                      >
                        Batal Edit
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Konfirmasi Hapus Bidang */}
        <AnimatePresence>
          {showDeleteBidangModal && bidangToDelete && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-black/40 dark:bg-black/60 backdrop-blur-sm"
                onClick={() => {
                  setShowDeleteBidangModal(false);
                  setBidangToDelete(null);
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
                      setShowDeleteBidangModal(false);
                      setBidangToDelete(null);
                    }}
                    className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-4 top-4 h-9 w-9"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <div className="pr-8">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                      Konfirmasi Hapus Bidang
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      Apakah Anda yakin ingin menghapus bidang ini?
                    </p>
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 mb-4">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Bidang {bidangToDelete.kode} - {bidangToDelete.nama}
                      </p>
                      <p className="text-xs text-red-600 dark:text-red-400 mt-2">
                        ⚠️ Peringatan: Semua item pedoman poin dengan bidang ini akan ikut terhapus, termasuk file dan skor yang terkait.
                      </p>
                    </div>
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={() => {
                          setShowDeleteBidangModal(false);
                          setBidangToDelete(null);
                        }}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleDeleteBidang}
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

        {/* Info Box */}
        {hasData && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <svg className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <div className="flex-1">
                <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">
                  Cara Menambah Item:
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-2 list-disc list-inside">
                  <li>
                    <strong>Menambah Item:</strong> Klik tombol "Edit Table IKD" di kanan atas, pilih Bidang, lalu isi form. Nomor akan otomatis ter-generate (1, 2, 3, dst).
                  </li>
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
              <thead>
                <tr className="bg-gray-100 dark:bg-gray-800">
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left text-sm font-semibold">
                    <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </th>
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left text-sm font-semibold">
                    <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </th>
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left text-sm font-semibold">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </th>
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left text-sm font-semibold">
                    <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </th>
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left text-sm font-semibold">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </th>
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left text-sm font-semibold">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </th>
                  <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left text-sm font-semibold">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-700 px-4 py-2">
                      <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : hasData ? (
          <div className="overflow-x-auto w-full">
            <table className="w-full border-collapse border border-gray-300 dark:border-gray-700">
                <thead>
                  <tr className="bg-gray-100 dark:bg-gray-800">
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      NO
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Kegiatan
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Indeks poin
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Unit Kerja
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
                      Bukti fisik
                    </th>
                    <th className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-left text-sm font-semibold text-gray-900 dark:text-white">
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
                          className="border-b-2 border-gray-400 dark:border-gray-600 px-4 py-3 text-base font-bold text-gray-900 dark:text-white"
                        >
                          {getBidangNama(bidang)}
                        </td>
                      </tr>
                      {groupedData[bidang].map((item, idx) => {
                        const isSubItem = item.level === 1;
                        return (
                          <tr key={item.id || idx} className={`${isSubItem ? 'bg-gray-50 dark:bg-gray-800/50' : 'bg-white dark:bg-gray-900'}`}>
                            {!isSubItem && (
                              <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white">
                                <span className="font-medium">{item.no}</span>
                              </td>
                            )}
                            {isSubItem && (
                              <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white">
                                {/* Empty cell untuk sub items, tidak ada NO */}
                              </td>
                            )}
                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white">
                              {item.kegiatan}
                            </td>
                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white">
                              {(item.indeks_poin !== null && item.indeks_poin !== undefined && Number(item.indeks_poin) !== 0 && Number(item.indeks_poin) > 0) ? Number(item.indeks_poin).toFixed(2) : ''}
                            </td>
                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white">
                              {item.unit_kerja || ''}
                            </td>
                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white">
                              {item.bukti_fisik || ''}
                            </td>
                            <td className="border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm text-gray-900 dark:text-white">
                              {item.prosedur || ''}
                            </td>
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
          </div>
        ) : (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div className="max-w-2xl mx-auto">
              <p className="text-gray-600 dark:text-gray-400 mb-4">
                Belum ada data. Klik "Buat Table IKD" untuk mulai.
              </p>
              <div className="text-left bg-white dark:bg-gray-900 p-4 rounded-lg mt-4">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Cara menggunakan:
                </h4>
                <ol className="list-decimal list-inside space-y-2 text-sm text-gray-600 dark:text-gray-400">
                  <li>Klik "Buat Table IKD" dan pilih Bidang (A = Pengajaran, D = Penunjang)</li>
                  <li>Isi form untuk menambah item nomor utama (1, 2, 3, dst)</li>
                  <li>Nomor akan otomatis ter-generate, tapi bisa diubah manual jika perlu</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-sm"
                onClick={handleCloseModal}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-6xl mx-auto bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto"
              >
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      {editMode ? "Edit" : "Tambah"} Item Pedoman IKD
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                      Bidang {selectedBidang} - {getBidangNama(selectedBidang)}
                    </p>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
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
                          <svg className="w-5 h-5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
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
                          <svg className="w-5 h-5 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
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
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4 relative">
                  {/* Header dengan tombol Hapus untuk form utama - pojok kanan atas */}
                  {editMode && editingItem?.id && (
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
                            setForm({ ...form, kegiatan: form.kegiatan.replace(/^\d+\.\d+\.?\s*/, "") });
                          }
                          setParentItemId(null);
                        }
                      }}
                      className="w-5 h-5 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <label htmlFor="useSubItem" className="text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                      Gunakan Sub Item (NO tetap sama, nomor sub masuk ke Kegiatan seperti 1.1, 1.2, 1.1.a, 1.1.b)
                    </label>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      NO <span className="text-gray-500 text-xs">(Otomatis terisi, bisa diubah manual)</span>
                    </label>
                    <input
                      type="text"
                      value={form.no}
                      onChange={(e) => setForm({ ...form, no: e.target.value })}
                      placeholder="Contoh: 1, 2, 3"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Kegiatan
                    </label>
                    <textarea
                      value={form.kegiatan}
                      onChange={(e) => setForm({ ...form, kegiatan: e.target.value })}
                      rows={2}
                      placeholder={useSubItem ? "Contoh: 1.1 Memberi kuliah..." : "Masukkan kegiatan"}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                    />
                    {useSubItem && (
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        💡 Format: "1.1 Judul" untuk sub item angka, atau "1.1.a. Judul" untuk sub item dengan huruf.
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
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                        Unit Kerja
                      </label>
                      <div className="relative" ref={unitKerjaDropdownRef}>
                        <button
                          type="button"
                          onClick={() => setShowUnitKerjaDropdown(!showUnitKerjaDropdown)}
                          className={`w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-left text-gray-900 dark:text-white flex items-center justify-between bg-white dark:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-colors ${form.unit_kerja ? "border-blue-500 dark:border-blue-400" : ""}`}
                        >
                          <span className={form.unit_kerja ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}>
                            {form.unit_kerja || "Pilih Unit Kerja (bisa lebih dari satu)"}
                          </span>
                          <svg
                            className={`w-5 h-5 transition-transform ${showUnitKerjaDropdown ? "transform rotate-180" : ""}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                          </svg>
                        </button>
                        
                        {showUnitKerjaDropdown && (
                          <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                            {UNIT_KERJA_OPTIONS.map((unit) => {
                              const selectedUnits = form.unit_kerja ? form.unit_kerja.split(", ").filter(Boolean) : [];
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
                                      const currentUnits = form.unit_kerja ? form.unit_kerja.split(", ").filter(Boolean) : [];
                                      let newUnits;
                                      if (e.target.checked) {
                                        newUnits = [...currentUnits, unit];
                                      } else {
                                        newUnits = currentUnits.filter((u) => u !== unit);
                                      }
                                      setForm({ ...form, unit_kerja: newUnits.join(", ") });
                                    }}
                                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-400 dark:ring-offset-gray-800 focus:ring-2"
                                  />
                                  <span className="ml-3 text-sm text-gray-900 dark:text-white">{unit}</span>
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
                      onChange={(e) => setForm({ ...form, bukti_fisik: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Prosedur yang dilakukan oleh dosen
                    </label>
                    <textarea
                      value={form.prosedur}
                      onChange={(e) => setForm({ ...form, prosedur: e.target.value })}
                      rows={2}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-900 dark:text-white text-sm bg-white dark:bg-gray-700"
                    />
                  </div>
                </div>
                
                {/* List Sub Items dari form utama - Dipindah ke atas sebelum list items */}
                {useSubItem && subItems.length > 0 && (
                  <div className="mt-4 space-y-3">
                    {subItems.map((subItem, idx) => (
                      <div key={subItem.id || idx} className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                        <div className="flex justify-between items-start mb-2">
                          <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                            Kegiatan Sub Item
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDeleteMainFormSubItem(idx)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            Hapus
                          </button>
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
                              value={subItem.indeks_poin === 0 ? "" : subItem.indeks_poin}
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
                                  updatedItems[currentItemIndex].subItems = updated;
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
                                setShowSubItemUnitKerjaDropdown(showSubItemUnitKerjaDropdown === `main-${idx}` ? null : `main-${idx}`);
                              }}
                              className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-left text-gray-900 dark:text-white text-sm flex items-center justify-between bg-white dark:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-colors"
                            >
                              <span className={subItem.unit_kerja ? "text-gray-900 dark:text-white text-xs" : "text-gray-500 dark:text-gray-400 text-xs"}>
                                {subItem.unit_kerja || "Pilih Unit Kerja"}
                              </span>
                              <svg
                                className={`w-4 h-4 transition-transform ${showSubItemUnitKerjaDropdown === `main-${idx}` ? "transform rotate-180" : ""}`}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                              </svg>
                            </button>
                            
                            {showSubItemUnitKerjaDropdown === `main-${idx}` && (
                              <div 
                                className="absolute z-[100010] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto"
                                onClick={(e) => e.stopPropagation()}
                                data-sub-item-dropdown
                              >
                                {UNIT_KERJA_OPTIONS.map((unit) => {
                                  const selectedUnits = subItem.unit_kerja ? subItem.unit_kerja.split(", ").filter(Boolean) : [];
                                  const isSelected = selectedUnits.includes(unit);
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
                                          const currentUnits = subItem.unit_kerja ? subItem.unit_kerja.split(", ").filter(Boolean) : [];
                                          let newUnits;
                                          if (e.target.checked) {
                                            newUnits = [...currentUnits, unit];
                                          } else {
                                            newUnits = currentUnits.filter((u) => u !== unit);
                                          }
                                          updated[idx].unit_kerja = newUnits.join(", ");
                                          setSubItems(updated);
                                          
                                          // If editing item in list, update items array
                                          if (currentItemIndex !== null) {
                                            const updatedItems = [...items];
                                            updatedItems[currentItemIndex].subItems = updated;
                                            setItems(updatedItems);
                                          }
                                        }}
                                        onClick={(e) => e.stopPropagation()}
                                        className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-400 dark:ring-offset-gray-800 focus:ring-2 cursor-pointer"
                                      />
                                      <span className="ml-2.5 text-xs text-gray-900 dark:text-white">{unit}</span>
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
                                updatedItems[currentItemIndex].subItems = updated;
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
                                updatedItems[currentItemIndex].subItems = updated;
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
                {useSubItem && (
                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        // Set currentItemIndex to null untuk menandakan ini form utama
                        setCurrentItemIndex(null);
                        // Open sub item type modal
                        setShowSubItemTypeModal(true);
                      }}
                      className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium shadow-sm transition-colors"
                    >
                      Tambah Sub Item
                    </button>
                  </div>
                )}
                
                {/* List Items yang sudah ditambahkan */}
                {items.length > 0 && (
                  <div className="mt-4 space-y-4">
                    {items.map((item, idx) => (
                      <div key={idx} className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                        {/* Header dengan Checkbox dan Tombol Hapus */}
                        <div className="flex justify-between items-center mb-4">
                          <label className="flex items-center gap-2 cursor-pointer flex-1">
                            <input
                              type="checkbox"
                              checked={item.useSubItem}
                              onChange={() => handleToggleSubItemForItem(idx)}
                              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-400 dark:ring-offset-gray-800 focus:ring-2 cursor-pointer"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300">
                              Gunakan Sub Item (NO tetap sama, nomor sub masuk ke Kegiatan seperti 1.1, 1.2, 1.1.a, 1.1.b)
                            </span>
                          </label>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(idx)}
                            className="px-3 py-1.5 bg-red-500 text-white rounded-lg hover:bg-red-600 text-sm font-medium transition-colors ml-4"
                          >
                            Hapus
                          </button>
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
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                </svg>
                                Format: "1.1 Judul" untuk sub item angka, atau "1.1.a. Judul" untuk sub item dengan huruf.
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
                                value={item.indeks_poin > 0 ? item.indeks_poin : ""}
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
                                  onClick={() => setShowSubItemUnitKerjaDropdown(showSubItemUnitKerjaDropdown === `item-${idx}` ? null : `item-${idx}`)}
                                  className={`w-full px-3 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg text-left text-gray-900 dark:text-white flex items-center justify-between bg-white dark:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-colors ${item.unit_kerja ? "border-blue-500 dark:border-blue-400" : ""}`}
                                >
                                  <span className={item.unit_kerja ? "text-gray-900 dark:text-white" : "text-gray-500 dark:text-gray-400"}>
                                    {item.unit_kerja || "Pilih Unit Kerja (bisa lebih dari satu)"}
                                  </span>
                                  <svg
                                    className={`w-5 h-5 transition-transform ${showSubItemUnitKerjaDropdown === `item-${idx}` ? "transform rotate-180" : ""}`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                  </svg>
                                </button>
                                
                                {showSubItemUnitKerjaDropdown === `item-${idx}` && (
                                  <div className="absolute z-50 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto">
                                    {UNIT_KERJA_OPTIONS.map((unit) => {
                                      const selectedUnits = item.unit_kerja ? item.unit_kerja.split(", ").filter(Boolean) : [];
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
                                              const currentUnits = item.unit_kerja ? item.unit_kerja.split(", ").filter(Boolean) : [];
                                              let newUnits;
                                              if (e.target.checked) {
                                                newUnits = [...currentUnits, unit];
                                              } else {
                                                newUnits = currentUnits.filter((u) => u !== unit);
                                              }
                                              const updated = [...items];
                                              updated[idx].unit_kerja = newUnits.join(", ");
                                              setItems(updated);
                                            }}
                                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-400 dark:ring-offset-gray-800 focus:ring-2"
                                          />
                                          <span className="ml-3 text-sm text-gray-900 dark:text-white">{unit}</span>
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
                                  <div key={subIdx} className="p-3 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg">
                                    <div className="flex justify-between items-start mb-2">
                                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">
                                        Kegiatan Sub Item
                                      </label>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteSubItem(idx, subIdx)}
                                        className="text-red-500 hover:text-red-700 text-xs"
                                      >
                                        Hapus
                                      </button>
                                    </div>
                                    <textarea
                                      value={subItem.kegiatan}
                                      onChange={(e) => {
                                        const updated = [...items];
                                        updated[idx].subItems[subIdx].kegiatan = e.target.value;
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
                                          value={subItem.indeks_poin === 0 ? "" : subItem.indeks_poin}
                                          onChange={(e) => {
                                            const val = e.target.value;
                                            const updated = [...items];
                                            if (val === "" || val === "-") {
                                              updated[idx].subItems[subIdx].indeks_poin = 0;
                                            } else {
                                              const num = parseFloat(val);
                                              if (!isNaN(num)) {
                                                updated[idx].subItems[subIdx].indeks_poin = num;
                                              }
                                            }
                                            setItems(updated);
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
                                            setShowSubItemUnitKerjaDropdown(showSubItemUnitKerjaDropdown === `${idx}-${subIdx}` ? null : `${idx}-${subIdx}`);
                                          }}
                                          className="w-full px-2 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-left text-gray-900 dark:text-white text-sm flex items-center justify-between bg-white dark:bg-gray-700 hover:border-blue-500 dark:hover:border-blue-400 cursor-pointer transition-colors"
                                        >
                                          <span className={subItem.unit_kerja ? "text-gray-900 dark:text-white text-xs" : "text-gray-500 dark:text-gray-400 text-xs"}>
                                            {subItem.unit_kerja || "Pilih Unit Kerja"}
                                          </span>
                                          <svg
                                            className={`w-4 h-4 transition-transform ${showSubItemUnitKerjaDropdown === `${idx}-${subIdx}` ? "transform rotate-180" : ""}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                          </svg>
                                        </button>
                                        
                                        {showSubItemUnitKerjaDropdown === `${idx}-${subIdx}` && (
                                          <div 
                                            className="absolute z-[100010] w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-auto"
                                            onClick={(e) => e.stopPropagation()}
                                            data-sub-item-dropdown
                                          >
                                            {UNIT_KERJA_OPTIONS.map((unit) => {
                                              const selectedUnits = subItem.unit_kerja ? subItem.unit_kerja.split(", ").filter(Boolean) : [];
                                              const isSelected = selectedUnits.includes(unit);
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
                                                      const updated = [...items];
                                                      const currentUnits = subItem.unit_kerja ? subItem.unit_kerja.split(", ").filter(Boolean) : [];
                                                      let newUnits;
                                                      if (e.target.checked) {
                                                        newUnits = [...currentUnits, unit];
                                                      } else {
                                                        newUnits = currentUnits.filter((u) => u !== unit);
                                                      }
                                                      updated[idx].subItems[subIdx].unit_kerja = newUnits.join(", ");
                                                      setItems(updated);
                                                    }}
                                                    onClick={(e) => e.stopPropagation()}
                                                    className="w-3.5 h-3.5 text-blue-600 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-400 dark:ring-offset-gray-800 focus:ring-2 cursor-pointer"
                                                  />
                                                  <span className="ml-2.5 text-xs text-gray-900 dark:text-white">{unit}</span>
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
                                          updated[idx].subItems[subIdx].bukti_fisik = e.target.value;
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
                                          updated[idx].subItems[subIdx].prosedur = e.target.value;
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
                          {item.useSubItem && (
                            <div className="mt-4 flex justify-end gap-3">
                              <button
                                type="button"
                                onClick={() => handleAddSubItemForItem(idx)}
                                className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 text-sm font-medium shadow-sm transition-colors"
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
                {hasData && (
                  <div className="mt-4 flex justify-end gap-3">
                    <button
                      type="button"
                      onClick={handleAddNewItem}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 text-sm font-medium flex items-center gap-2 shadow-sm transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
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
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-sm"
                            onClick={() => {
                              setShowSubItemTypeModal(false);
                              setCurrentItemIndex(null);
                            }}
                          />
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative bg-white dark:bg-gray-800 rounded-lg p-6 shadow-lg z-[100003] max-w-md w-full mx-4"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <h4 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">
                              Pilih Format Sub Item
                            </h4>
                            <div className="space-y-3">
                              <button
                                onClick={() => {
                                  if (currentItemIndex !== null) {
                                    // Add to item in list
                                    handleAddSubItemToItem(currentItemIndex, 'number');
                                  } else {
                                    // Add to form utama
                                    const currentNo = form.no;
                                    const lastSub = subItems[subItems.length - 1];
                                    let baseNo = currentNo;
                                    
                                    if (lastSub && lastSub.kegiatan) {
                                      const numberMatch = lastSub.kegiatan.match(/^(\d+\.\d+)/);
                                      if (numberMatch) {
                                        const parts = numberMatch[1].split('.');
                                        const nextNo = parseInt(parts[1]) + 1;
                                        baseNo = `${parts[0]}.${nextNo}`;
                                      } else {
                                        const mainMatch = form.kegiatan.match(/^(\d+\.\d+)/);
                                        if (mainMatch) {
                                          const parts = mainMatch[1].split('.');
                                          const nextNo = parseInt(parts[1]) + 1;
                                          baseNo = `${parts[0]}.${nextNo}`;
                                        } else {
                                          baseNo = `${currentNo}.1`;
                                        }
                                      }
                                    } else {
                                      const mainMatch = form.kegiatan.match(/^(\d+\.\d+)/);
                                      if (mainMatch) {
                                        const parts = mainMatch[1].split('.');
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
                                className="w-full px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors text-left"
                              >
                                <div className="font-medium">Format Angka (1.2, 1.3, dst)</div>
                                <div className="text-sm opacity-90">Untuk sub item dengan format angka</div>
                              </button>
                              <button
                                onClick={() => {
                                  if (currentItemIndex !== null) {
                                    // Add to item in list
                                    handleAddSubItemToItem(currentItemIndex, 'letter');
                                  } else {
                                    // Add to form utama
                                    const currentNo = form.no;
                                    const lastSub = subItems[subItems.length - 1];
                                    let baseNo = "";
                                    
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
                                          const nextLetter = String.fromCharCode(lastLetter.charCodeAt(0) + 1);
                                          baseNo = `${base}.${nextLetter}`;
                                        } else {
                                          const numberMatch = lastSub.kegiatan.match(/^(\d+\.\d+)/);
                                          if (numberMatch) {
                                            baseNo = `${numberMatch[1]}.a`;
                                          } else {
                                            const mainMatch = form.kegiatan.match(/^(\d+\.\d+)/);
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
                                      const mainMatch = form.kegiatan.match(/^(\d+\.\d+)/);
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
                                className="w-full px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-left"
                              >
                                <div className="font-medium">Format Huruf (1.1.a, 1.1.b, dst)</div>
                                <div className="text-sm opacity-90">Untuk sub item dengan format huruf</div>
                              </button>
                            </div>
                            <button
                              onClick={() => {
                                setShowSubItemTypeModal(false);
                                setCurrentItemIndex(null);
                              }}
                              className="mt-4 w-full px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                              Batal
                            </button>
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
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                    </svg>
                    <span>Kembali</span>
                  </button>
                  <div className="flex gap-3">
                    <button
                      onClick={handleCloseModal}
                      className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleSave}
                      className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                    >
                      Simpan
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Konfirmasi Hapus */}
        <AnimatePresence>
          {showDeleteModal && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-black/40 dark:bg-black/60 backdrop-blur-sm"
                onClick={handleCancelDelete}
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
                    onClick={handleCancelDelete}
                    className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-4 top-4 h-9 w-9"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>

                  <div className="pr-8">
                    <div className="flex items-center mb-4">
                      <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mr-4">
                        <svg className="w-6 h-6 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                      </div>
                      <div>
                        <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                          Konfirmasi Hapus
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                          Hapus {deleteType === 'item' ? 'Item' : deleteType === 'subItem' || deleteType === 'mainFormSubItem' ? 'Sub Item' : 'Form Utama'}
                        </p>
                      </div>
                    </div>
                    
                    <p className="text-base text-gray-800 dark:text-white mb-3">
                      Apakah Anda yakin ingin menghapus <span className="font-bold text-red-500">{getDeleteMessage()}</span>?
                    </p>
                    
                    <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                      <div className="flex items-start gap-2">
                        <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <p className="text-sm font-medium text-yellow-800 dark:text-yellow-300 mb-1">
                            Peringatan
                          </p>
                          <p className="text-sm text-yellow-700 dark:text-yellow-400">
                            Data yang dihapus tidak dapat dikembalikan. Semua data terkait seperti file yang sudah diupload oleh dosen, skor, dan data lainnya akan ikut hilang.
                          </p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-3 justify-end">
                      <button
                        onClick={handleCancelDelete}
                        className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors"
                      >
                        Batal
                      </button>
                      <button
                        onClick={handleConfirmDelete}
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
      </div>
    </RekapIKDBase>
  );
};

export default PedomanPoinIKD;
