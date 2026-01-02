import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import api, { handleApiError } from "../utils/api";
import { AnimatePresence, motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faUsers,
  faGraduationCap,
  faEdit,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";

interface CSR {
  id: number;
  mata_kuliah_kode: string;
  nomor_csr: string;
  nama: string;
  keahlian_required: string[];
  tanggal_mulai?: string;
  tanggal_akhir?: string;
  status: string;
  dosen?: User[];
  semester?: number;
  blok?: number;
  created_at: string;
  updated_at: string;
  mata_kuliah?: {
    kode: string;
    nama: string;
    semester: number;
    periode: string;
    jenis: string;
    tanggal_mulai?: string;
    tanggal_akhir?: string;
    [key: string]: any;
  };
}

interface User {
  id: number;
  name: string;
  nid: string;
  nidn: string;
  email: string;
  keahlian: string[];
  role: string;
  csr_assignment_count: number; // Added for badge
}

const CSRDetail: React.FC = () => {
  const { csrId } = useParams<{ csrId: string }>();
  const navigate = useNavigate();
  const [csr, setCsr] = useState<CSR | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [keahlianList, setKeahlianList] = useState<string[]>([]);
  const [newKeahlian, setNewKeahlian] = useState("");
  const [csrKeahlianOptions, setCsrKeahlianOptions] = useState<string[]>([]);
  const [loadingKeahlianOptions, setLoadingKeahlianOptions] = useState(false);

  // Dosen states
  const [standbyDosen, setStandbyDosen] = useState<User[]>([]);
  const [regularDosen, setRegularDosen] = useState<User[]>([]);
  const [success, setSuccess] = useState<string | null>(null);

  // Search states
  const [searchDosen, setSearchDosen] = useState("");
  const [searchDosenPBL, setSearchDosenPBL] = useState("");

  // Mapping and drag states
  const [mapping, setMapping] = useState<{ [keahlian: string]: User[] }>({});
  const [draggedDosenId, setDraggedDosenId] = useState<number | null>(null);

  // Drag state - using HTML5 Drag API like KelompokKecil.tsx

  // Keahlian edit states
  const [editKeahlian, setEditKeahlian] = useState<string | null>(null);
  const [editKeahlianValue, setEditKeahlianValue] = useState("");

  // Delete modal states
  const [showDeleteKeahlianModal, setShowDeleteKeahlianModal] = useState(false);
  const [keahlianToDelete, setKeahlianToDelete] = useState<string | null>(null);
  const [isDeletingKeahlian, setIsDeletingKeahlian] = useState(false);

  // PBL states
  const [dosenPBLBySemester, setDosenPBLBySemester] = useState<{
    [semester: number]: User[];
  }>({});
  const [loadingDosenPBL, setLoadingDosenPBL] = useState(false);

  const fetchBatchData = async () => {
    setLoading(true);
    setLoadingDosenPBL(true);
    try {
      setError(null);

      const response = await api.get(`/csr-detail/${csrId}/batch-data`);
      const batchData = response.data;

      // Set all data from batch response
      setCsr(batchData.csr);
      // Set keahlianList dari data yang sudah ada di database
      setKeahlianList(batchData.csr?.keahlian_required || []);
      setRegularDosen(batchData.regular_dosen || []);
      setStandbyDosen(batchData.standby_dosen || []);
      setMapping(batchData.mapping || {});
      setDosenPBLBySemester(batchData.dosen_pbl_by_semester || {});
    } catch (err: any) {
      setError(err?.response?.data?.message || "Gagal memuat data");
      // Set empty data as fallback
      setCsr(null);
      setKeahlianList([]);
      setRegularDosen([]);
      setStandbyDosen([]);
      setMapping({});
      setDosenPBLBySemester({});
    } finally {
      setLoading(false);
      setLoadingDosenPBL(false);
    }
  };

  useEffect(() => {
    fetchBatchData();
  }, [csrId]);

  // Event listener untuk auto-refresh saat dosen dihapus dari PBL
  useEffect(() => {
    const handleCSRAssignmentUpdate = (event: CustomEvent) => {
      // Refresh data CSR Detail
      fetchBatchData();
    };

    window.addEventListener(
      "csr-assignment-updated",
      handleCSRAssignmentUpdate as EventListener
    );

    return () => {
      window.removeEventListener(
        "csr-assignment-updated",
        handleCSRAssignmentUpdate as EventListener
      );
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (csr) {
      fetchKeahlianCSROptions();
    }
  }, [csr]);

  // Mapping data sudah diambil dari batch API, tidak perlu fetch terpisah

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

  // Dosen data sudah diambil dari batch API, tidak perlu fetch terpisah

  // PBL dosen data sudah diambil dari batch API, tidak perlu fetch terpisah

  // CSR data sudah diambil dari batch API, tidak perlu fetch terpisah

  // Fetch keahlian CSR options dari database keahlian_csr
  const fetchKeahlianCSROptions = async () => {
    if (!csr) return;

    setLoadingKeahlianOptions(true);
    try {
      // Ambil keahlian dari database keahlian_csr berdasarkan CSR ID
      const response = await api.get(`/keahlian-csr/csr/${csr.id}`);
      const keahlianList = response.data.data || [];

      // Ambil semua keahlian dari database keahlian_csr (tidak perlu filter)
      const availableKeahlian = keahlianList.map((k: any) => k.keahlian);


      setCsrKeahlianOptions(availableKeahlian);
    } catch (err) {
      console.error("Error fetching keahlian CSR options:", err);
      setCsrKeahlianOptions([]);
    } finally {
      setLoadingKeahlianOptions(false);
    }
  };

  // Tambah keahlian dari dropdown
  const handleAddKeahlian = async () => {
    if (!newKeahlian.trim() || !csr) return;

    // Validasi duplikat (case-insensitive, trim) - cek di keahlianList state
    const newK = newKeahlian.trim().toLowerCase();
    const exists = keahlianList.some((k) => k.trim().toLowerCase() === newK);
    if (exists) {
      setError("Keahlian sudah ada, tidak boleh terduplikat.");
      return;
    }

    try {
      // Tambah keahlian ke state keahlianList (langsung masuk ke daftar)
      const updatedKeahlianList = [...keahlianList, newKeahlian.trim()];
      setKeahlianList(updatedKeahlianList);

      // Pastikan nama tidak null
      const nama = csr.nama || (csr.mata_kuliah && csr.mata_kuliah.nama) || "";
      if (!nama) {
        setError("Nama CSR belum diisi. Silakan isi nama CSR terlebih dahulu.");
        return;
      }

      // Save ke database agar persist
      await api.put(`/csr/${csr.id}`, {
        ...csr,
        nama,
        keahlian_required: updatedKeahlianList,
      });

      // Reset dropdown
      setNewKeahlian("");
      setSuccess("Keahlian berhasil ditambahkan dan disimpan");
    } catch (err) {
      setError("Gagal menyimpan keahlian");
      // Rollback state jika error
      setKeahlianList(keahlianList);
    }
  };

  // Hapus keahlian
  const handleRemoveKeahlian = async (k: string) => {
    if (!csr) return;

    try {
      // Hapus dari state keahlianList
      const updatedKeahlianList = keahlianList.filter((x) => x !== k);
      setKeahlianList(updatedKeahlianList);

      // Pastikan nama tidak null
      const nama = csr.nama || (csr.mata_kuliah && csr.mata_kuliah.nama) || "";
      if (!nama) {
        setError("Nama CSR belum diisi. Silakan isi nama CSR terlebih dahulu.");
        return;
      }

      // Save ke database agar persist
      await api.put(`/csr/${csr.id}`, {
        ...csr,
        nama,
        keahlian_required: updatedKeahlianList,
      });

      setSuccess("Keahlian berhasil dihapus dan disimpan");
    } catch (err) {
      setError("Gagal menghapus keahlian");
      // Rollback state jika error
      setKeahlianList(keahlianList);
    }
  };

  // HTML5 Drag API handlers - same as KelompokKecil.tsx
  const handleDragStart = (e: React.DragEvent, dosenId: number) => {
    setDraggedDosenId(dosenId);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dosenId.toString());

    // Tambahkan styling drag
    if (e.currentTarget) {
      (e.currentTarget as HTMLElement).style.opacity = "0.5";
    }

    // Create custom drag image with + icon
    const allMappedDosen = Object.values(mapping).flat();
    const allDosen = [...regularDosen, ...standbyDosen, ...allMappedDosen];
    const dosen = allDosen.find((d) => d.id === dosenId);
    if (dosen) {
      const dragElement = document.createElement("div");
      dragElement.className =
        "p-3 bg-brand-500 rounded-lg shadow-lg flex items-center gap-2";
      dragElement.innerHTML = `
        <div class="w-8 h-8 bg-white rounded-full flex items-center justify-center">
          <svg class="w-5 h-5 text-brand-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4"></path>
          </svg>
        </div>
        <span class="text-white font-medium">${dosen.name || "Dosen"}</span>
      `;
      dragElement.style.position = "absolute";
      dragElement.style.top = "-1000px";
      document.body.appendChild(dragElement);
      e.dataTransfer.setDragImage(dragElement, 0, 0);
      setTimeout(() => document.body.removeChild(dragElement), 0);
    }
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedDosenId(null);

    // Hapus styling drag
    if (e.currentTarget) {
      (e.currentTarget as HTMLElement).style.opacity = "1";
    }
  };

  // Assign dosen ke keahlian (mapping dosen ke CSR)
  const handleAssignDosen = async (dosenId: number, keahlian: string) => {
    if (!csr) return;
    try {
      await api.post(`/csr/${csr.id}/mappings`, {
        dosen_id: dosenId,
        keahlian,
      });
      setSuccess("Dosen berhasil ditugaskan");
      await fetchBatchData(); // Refresh all data
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Gagal menugaskan dosen";
      setError(msg);
      // Don't refresh data on error to keep error message visible
    }
  };

  // Unassign dosen dari CSR
  type HandleRemoveAssigned = (
    dosenId: number,
    keahlian: string
  ) => Promise<void>;
  const handleRemoveAssigned: HandleRemoveAssigned = async (
    dosenId,
    keahlian
  ) => {
    if (!csr) return;
    try {
      await api.delete(
        `/csr/${csr.id}/mappings/${dosenId}/${encodeURIComponent(keahlian)}`
      );
      setSuccess("Penugasan dosen dihapus");
      await fetchBatchData(); // Refresh all data
    } catch (err) {
      setError("Gagal menghapus penugasan dosen");
      // Don't refresh data on error to keep error message visible
    }
  };

  // Filtered dosen logic (mirroring CSR.tsx)
  const filteredRegularDosen = regularDosen.filter((d) => {
    const q = searchDosen.toLowerCase();
    const matchNama = d.name && d.name.toLowerCase().includes(q);
    const matchNid = d.nid && d.nid.toLowerCase().includes(q);
    const matchKeahlian = d.keahlian.some((k) => k.toLowerCase().includes(q));
    if (searchDosen && !(matchNama || matchNid || matchKeahlian)) return false;
    return true;
  });
  const filteredStandbyDosen = standbyDosen.filter((d) => {
    const q = searchDosen.toLowerCase();
    const matchNama = d.name && d.name.toLowerCase().includes(q);
    const matchNid = d.nid && d.nid.toLowerCase().includes(q);
    const matchKeahlian = d.keahlian.some((k) => k.toLowerCase().includes(q));
    if (searchDosen && !(matchNama || matchNid || matchKeahlian)) return false;
    return true;
  });

  // Calculate dosen assignment counts across all keahlian
  const dosenAssignmentCount: Record<number, number> = {};
  Object.values(mapping).forEach((arr) => {
    arr.forEach((d) => {
      dosenAssignmentCount[d.id] = (dosenAssignmentCount[d.id] || 0) + 1;
    });
  });

  // Filter dosen PBL by search
  const filteredDosenPBLBySemester: { [semester: number]: User[] } = {};
  Object.entries(dosenPBLBySemester).forEach(([semester, dosenList]) => {
    filteredDosenPBLBySemester[Number(semester)] = dosenList.filter((d) => {
      const q = searchDosenPBL.toLowerCase();
      return (
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.nid && d.nid.toLowerCase().includes(q)) ||
        (Array.isArray(d.keahlian)
          ? d.keahlian.some((k) => k.toLowerCase().includes(q))
          : false)
      );
    });
  });

  if (loading)
    return (
      <div className="mx-auto py-8 px-2 md:px-0">
        {/* Skeleton Header */}
        <div className="mb-6">
          <div className="h-8 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
          <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
        {/* Skeleton Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 animate-pulse"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700" />
                <div className="flex-1">
                  <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </div>
            </div>
          ))}
        </div>
        {/* Skeleton Main Content: 3 columns */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
          {/* Kiri: Keahlian yang Dibutuhkan */}
          <div className="md:col-span-6">
            <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-8 animate-pulse">
              <div className="h-7 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
              <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-6 mt-2" />
              <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch mb-6">
                <div className="h-[52px] bg-gray-200 dark:bg-gray-700 rounded-xl flex-1" />
                <div className="h-[52px] w-[130px] bg-gray-200 dark:bg-gray-700 rounded-lg" />
              </div>
              <ul className="space-y-5">
                {Array.from({ length: 2 }).map((_, i) => (
                  <li
                    key={i}
                    className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 bg-gray-100 dark:bg-gray-800/30 rounded-xl p-4"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                      <div className="h-4 w-10 bg-gray-200 dark:bg-gray-700 rounded ml-auto" />
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                    </div>
                    <div className="border-2 border-dashed rounded-lg p-3 min-h-[60px] bg-white dark:bg-gray-900 flex gap-2">
                      {Array.from({ length: 3 }).map((_, j) => (
                        <div
                          key={j}
                          className="flex items-center gap-2 px-3 py-1 rounded-full bg-gray-200 dark:bg-gray-700"
                        >
                          <div className="w-6 h-6 rounded-full bg-gray-300 dark:bg-gray-600" />
                          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                      ))}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          {/* Tengah: Dosen Sudah Dikelompokkan (PBL) */}
          <div className="md:col-span-3">
            <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-lg p-8 animate-pulse">
              <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
              <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded mb-6" />
              {/* Dosen Reguler/Standby Skeleton */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto hide-scroll">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-4 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="flex-1 min-w-0">
                          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                      </div>
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-3">
                        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                        <div className="flex gap-1">
                          {Array.from({ length: 2 }).map((_, j) => (
                            <div
                              key={j}
                              className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded-full"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Dosen Standby Skeleton */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto hide-scroll">
                  {Array.from({ length: 1 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-4 bg-gray-100 dark:bg-gray-800/20 border border-gray-200 dark:border-gray-700 rounded-xl"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="flex-1 min-w-0">
                          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
          {/* Kanan: Dosen Tersedia */}
          <div className="md:col-span-3">
            <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-lg p-8 animate-pulse">
              <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-4" />
              <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded mb-6" />
              {/* Dosen Reguler Skeleton */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto hide-scroll">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-4 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="flex-1 min-w-0">
                          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                      </div>
                      <div className="bg-gray-200 dark:bg-gray-700 rounded-lg p-3">
                        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                        <div className="flex gap-1">
                          {Array.from({ length: 2 }).map((_, j) => (
                            <div
                              key={j}
                              className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded-full"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {/* Dosen Standby Skeleton */}
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-3 h-3 rounded-full bg-gray-200 dark:bg-gray-700" />
                  <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
                <div className="space-y-3 max-h-[500px] overflow-y-auto hide-scroll">
                  {Array.from({ length: 1 }).map((_, i) => (
                    <div
                      key={i}
                      className="p-4 bg-gray-100 dark:bg-gray-800/20 border border-gray-200 dark:border-gray-700 rounded-xl"
                    >
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
                        <div className="flex-1 min-w-0">
                          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1" />
                          <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
                        </div>
                        <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  if (!csr) return <div className="p-8">CSR not found</div>;

  // --- SUMMARY CARD LOGIC ---
  // 1. Total kategori
  const totalKategori = keahlianList.length;
  // 2. Total dosen masuk kategori (unique across all categories)
  const dosenMasukKategoriSet = new Set<number>();
  Object.values(mapping).forEach((arr) =>
    arr.forEach((d) => dosenMasukKategoriSet.add(d.id))
  );
  const totalDosenMasukKategori = dosenMasukKategoriSet.size;
  // 3. Dosen tersedia (not assigned to any category)
  const assignedIds = Array.from(dosenMasukKategoriSet);
  const dosenTersedia = [...regularDosen, ...standbyDosen].filter(
    (d) => !assignedIds.includes(d.id)
  );
  const totalDosenTersedia = dosenTersedia.length;

  return (
    <div className="container mx-auto py-8 px-2 md:px-0">
      {/* Back Button at the very top */}
      <button
        onClick={() => navigate(-1)}
        className="flex items-center gap-2 text-brand-500 hover:text-brand-600 transition-all duration-300 ease-out hover:scale-105 transform mb-6"
      >
        <svg
          className="w-5 h-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15 19l-7-7 7-7"
          />
        </svg>
        Kembali
      </button>

      {/* Main Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white mb-1">
          Detail CSR:{" "}
          <span className="text-brand-600 dark:text-brand-400">{csr.nama}</span>
          <span className="fon-bold text-2xl text-gray-500 dark:text-gray-300 ml-2">
            ({csr.nomor_csr})
          </span>
        </h1>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faBookOpen}
                className="w-6 h-6 text-blue-500"
              />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {totalKategori}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Kategori
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faUsers}
                className="w-6 h-6 text-green-500"
              />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {totalDosenMasukKategori}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Dosen Masuk Kategori
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-100 dark:bg-yellow-900/20 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faGraduationCap}
                className="w-6 h-6 text-yellow-500"
              />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {totalDosenTersedia}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Dosen Tersedia
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Notification ala PBL-detail */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-brand-100 text-brand-700 p-3 rounded-lg mb-6"
          >
            {success}
          </motion.div>
        )}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-100 text-red-700 p-3 rounded-lg mb-6"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
      {/* Ganti layout utama menjadi grid 3 kolom */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-8">
        {/* Kiri: Keahlian yang Dibutuhkan */}
        <div className="md:col-span-6">
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-xl p-8 relative overflow-visible">
            {/* Section Title and Description */}
            <h2 className="text-xl font-semibold mb-1 text-gray-800 dark:text-white flex items-center gap-2">
              Keahlian yang dibutuhkan CSR
              {csr?.nama && (
                <span className="font-semibold text-brand-600 dark:text-brand-400">
                  {csr.nama}
                </span>
              )}
              {csr?.mata_kuliah_kode && (
                <span className="ml-2 text-xl font-semibold text-gray-800 dark:text-white">
                  ({csr.nomor_csr})
                </span>
              )}
            </h2>
            <p className="text-gray-500 dark:text-gray-300 text-sm mb-6">
              Tambahkan kategori keahlian yang diperlukan untuk penugasan dosen.
            </p>
            {csrKeahlianOptions.length === 0 && !loadingKeahlianOptions && (
              <div className="mb-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <p className="text-yellow-800 dark:text-yellow-200 text-sm">
                  ⚠️ Tidak ada keahlian tersedia untuk CSR {csr?.nomor_csr}.
                  Silakan tambahkan keahlian terlebih dahulu di halaman Mata
                  Kuliah.
                </p>
              </div>
            )}
            {/* Input + Buttons Row */}
            <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-stretch mb-6">
              <div className="relative flex-1">
                <select
                  value={newKeahlian}
                  onChange={(e) => setNewKeahlian(e.target.value)}
                  className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm font-medium px-4 py-2 shadow-md focus:ring-2 focus:ring-brand-500 focus:border-brand-500 w-full transition-all duration-150 h-[52px] align-middle text-gray-800 dark:text-white"
                  disabled={loadingKeahlianOptions}
                >
                  <option value="">Pilih keahlian dari CSR...</option>
                  {csrKeahlianOptions.map((keahlian) => (
                    <option key={keahlian} value={keahlian}>
                      {keahlian}
                    </option>
                  ))}
                </select>
                {loadingKeahlianOptions && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <svg
                      className="w-4 h-4 animate-spin text-gray-400"
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
                  </div>
                )}
              </div>
              <button
                onClick={handleAddKeahlian}
                disabled={!newKeahlian.trim()}
                className="flex items-center justify-center gap-2 bg-brand-500 text-white px-4 py-2 rounded-lg font-medium text-sm shadow-md hover:bg-brand-600 hover:scale-105 transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-brand-400 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                style={{ minWidth: "130px" }}
              >
                Tambah
              </button>
            </div>

            <ul className="space-y-5">
              {(keahlianList as string[]).map((k: string) => (
                <li
                  key={k}
                  className="flex flex-col gap-2 border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/30 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="flex-1 font-semibold text-brand-700 dark:text-brand-300 text-base">
                      {editKeahlian === k ? (
                        <input
                          type="text"
                          value={editKeahlianValue}
                          onChange={(e) => setEditKeahlianValue(e.target.value)}
                          className="px-2 py-1 rounded border border-gray-300 dark:border-gray-600 text-sm"
                          autoFocus
                        />
                      ) : (
                        k
                      )}
                    </span>
                    <span className="text-xs text-gray-500 dark:text-gray-300">
                      {mapping[k]?.length || 0} dosen
                    </span>
                    {editKeahlian === k ? (
                      <>
                        <button
                          onClick={async () => {
                            if (!csr) return;
                            if (
                              !editKeahlianValue.trim() ||
                              editKeahlianValue === k
                            ) {
                              setEditKeahlian(null);
                              setEditKeahlianValue("");
                              return;
                            }
                            // Validasi duplikat (case-insensitive, trim), kecuali dirinya sendiri
                            const newK = editKeahlianValue.trim().toLowerCase();
                            const exists = csr.keahlian_required.some(
                              (x) => x !== k && x.trim().toLowerCase() === newK
                            );
                            if (exists) {
                              setError(
                                "Keahlian sudah ada, tidak boleh duplikat."
                              );
                              return;
                            }
                            // Update array keahlian_required
                            const updated = csr.keahlian_required.map((x) =>
                              x === k ? editKeahlianValue.trim() : x
                            );
                            // Pastikan nama tidak null
                            const nama =
                              csr.nama ||
                              (csr.mata_kuliah && csr.mata_kuliah.nama) ||
                              "";
                            if (!nama) {
                              setError(
                                "Nama CSR belum diisi. Silakan isi nama CSR terlebih dahulu."
                              );
                              return;
                            }
                            try {
                              await api.put(`/csr/${csr.id}`, {
                                ...csr,
                                nama,
                                keahlian_required: updated,
                              });
                              setSuccess("Keahlian berhasil diubah");
                              setEditKeahlian(null);
                              setEditKeahlianValue("");
                              await fetchBatchData();
                            } catch {
                              setError("Gagal mengubah keahlian");
                            }
                          }}
                          className="ml-2 px-2 py-1 rounded bg-blue-500 text-white text-xs font-medium hover:bg-blue-600 transition"
                        >
                          Simpan
                        </button>
                        <button
                          onClick={() => {
                            setEditKeahlian(null);
                            setEditKeahlianValue("");
                          }}
                          className="ml-1 px-2 py-1 rounded bg-gray-200 text-gray-700 text-xs font-medium hover:bg-gray-300 transition"
                        >
                          Batal
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => {
                            setEditKeahlian(k);
                            setEditKeahlianValue(k);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 bg-transparent rounded-lg transition"
                          title="Edit Keahlian"
                        >
                          <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => {
                            setKeahlianToDelete(k);
                            setShowDeleteKeahlianModal(true);
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 bg-transparent rounded-lg transition"
                          title="Hapus Kategori"
                        >
                          <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                          <span className="hidden sm:inline">Hapus</span>
                        </button>
                      </>
                    )}
                  </div>
                  {/* Slot for assigned dosen with drop area */}
                  <div
                    className={`border-2 border-dashed rounded-lg p-3 min-h-[60px] flex flex-wrap items-center gap-2 transition-all duration-150 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 hover:border-brand-400`}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (draggedDosenId) {
                        handleAssignDosen(draggedDosenId, k);
                        setDraggedDosenId(null);
                      }
                    }}
                  >
                    {mapping[k] && mapping[k].length > 0 ? (
                      mapping[k].map((d) => {
                        // Normalisasi keahlian ke array
                        const keahlianArr = Array.isArray(d.keahlian)
                          ? d.keahlian
                          : typeof d.keahlian === "string"
                          ? (d.keahlian as string)
                              .split(",")
                              .map((k: string) => k.trim())
                          : [];
                        const isStandby = keahlianArr.some((k: string) =>
                          k.toLowerCase().includes("standby")
                        );
                        // Badge style
                        const badgeBg = isStandby
                          ? "bg-yellow-100 dark:bg-yellow-900/40"
                          : "bg-green-100 dark:bg-green-900/40";
                        const circleBg = isStandby
                          ? "bg-yellow-400"
                          : "bg-green-500";
                        const textColor = isStandby
                          ? "text-yellow-800 dark:text-yellow-200"
                          : "text-green-700 dark:text-green-200";
                        const initial = "D";
                        return (
                          <div
                            key={d.id}
                            className={`flex items-center gap-2 px-3 py-1 rounded-full ${badgeBg} mb-2 mr-2`}
                          >
                            <div
                              className={`w-6 h-6 rounded-full flex items-center justify-center relative ${circleBg}`}
                            >
                              <span className="text-white text-xs font-bold">
                                {initial}
                              </span>
                              <span
                                className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] font-semibold rounded-full flex justify-center items-center w-4 h-4 border border-white dark:border-green-800"
                                title="Jumlah penugasan"
                              >
                                {typeof d.csr_assignment_count === "number"
                                  ? d.csr_assignment_count
                                  : 0}
                                x
                              </span>
                            </div>
                            <span
                              className={`text-xs font-medium ${textColor}`}
                            >
                              {d.name}
                              {isStandby && (
                                <span className="ml-2 px-2 py-0.5 rounded bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-200 text-[10px] font-semibold">
                                  Dosen Standby
                                </span>
                              )}
                            </span>
                            <button
                              onClick={() => handleRemoveAssigned(d.id, k)}
                              className="ml-2 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition text-xs"
                              title="Hapus penugasan"
                            >
                              ×
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <span className="text-gray-400 dark:text-gray-500">
                        Seret dosen ke sini untuk menugaskan
                      </span>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
        {/* Tengah: Dosen Sudah Dikelompokkan (PBL) */}
        <div className="md:col-span-3">
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-lg p-8 mb-8">
            <h2 className="text-lg font-bold mb-4 text-brand-700 dark:text-brand-300">
              Dosen Sudah Dikelompokkan (PBL)
            </h2>
            <input
              type="text"
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-brand-500 focus:border-brand-500 mb-6 bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              placeholder="Cari dosen atau keahlian..."
              value={searchDosenPBL}
              onChange={(e) => setSearchDosenPBL(e.target.value)}
            />
            <div
              className="space-y-6 overflow-y-auto overflow-x-hidden hide-scroll"
              style={{ maxHeight: "862px" }}
            >
              {loadingDosenPBL ? (
                <p className="text-sm text-gray-500">
                  Memuat data dosen PBL...
                </p>
              ) : (
                Object.entries(filteredDosenPBLBySemester).map(
                  ([semester, dosenList]) => (
                    <div key={semester} className="mb-4">
                      {/* Label Semester, samakan dengan Dosen Reguler */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className="inline-block w-3 h-3 rounded-full bg-brand-500"></span>
                        <span className="text-gray-700 dark:text-gray-300 font-semibold text-sm">
                          Semester {semester}
                        </span>
                      </div>
                      <div className="space-y-3">
                        {dosenList.length === 0 ? (
                          <div className="flex flex-col items-center justify-center py-6">
                            <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gray-700 dark:bg-gray-800 flex items-center justify-center">
                              <FontAwesomeIcon
                                icon={faUsers}
                                className="w-6 h-6 text-gray-400"
                              />
                            </div>
                            <div className="text-sm text-gray-400">
                              Belum ada dosen dikelompokan
                            </div>
                          </div>
                        ) : (
                          dosenList.map((dosen) => {
                            const keahlianArr = Array.isArray(dosen.keahlian)
                              ? dosen.keahlian
                              : typeof dosen.keahlian === "string" &&
                                dosen.keahlian
                              ? [dosen.keahlian]
                              : [];
                            const isStandby = keahlianArr.some((k) =>
                              k.toLowerCase().includes("standby")
                            );
                            return (
                              <div
                                key={dosen.id}
                                className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all duration-200 cursor-move"
                                draggable
                                onDragStart={(e) =>
                                  handleDragStart(e, dosen.id)
                                }
                                onDragEnd={handleDragEnd}
                                style={{
                                  userSelect: "none",
                                  WebkitUserSelect: "none",
                                }}
                              >
                                <div className="flex items-start gap-3 mb-3">
                                  <div
                                    className={`w-10 h-10 rounded-full ${
                                      isStandby
                                        ? "bg-yellow-400"
                                        : "bg-brand-500"
                                    } flex items-center justify-center relative`}
                                  >
                                    <span className="text-white text-sm font-bold">
                                      {dosen.name.charAt(0)}
                                    </span>
                                    <span
                                      className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-semibold rounded-full flex justify-center items-center w-6 h-6 border-2 border-white dark:border-gray-800"
                                      title="Jumlah penugasan"
                                    >
                                      {typeof dosen.csr_assignment_count ===
                                      "number"
                                        ? dosen.csr_assignment_count
                                        : 0}
                                      x
                                    </span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="font-semibold text-gray-800 dark:text-white/90 text-sm mb-1">
                                      {dosen.name}
                                    </div>
                                    <div className="text-xs text-gray-500 dark:text-gray-400">
                                      NID: {dosen.nid}
                                    </div>
                                  </div>
                                  {isStandby && (
                                    <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-200 text-gray-700 text-xs">
                                      Standby
                                    </span>
                                  )}
                                </div>
                                {/* Keahlian Section */}
                                <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                                  <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                                    <div className="w-1 h-1 rounded-full bg-orange-500"></div>
                                    Keahlian
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {keahlianArr.map((k, idx) => (
                                      <span
                                        key={idx}
                                        className={`text-xs px-2 py-1 rounded-full font-medium ${
                                          k.toLowerCase() === "standby"
                                            ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 font-semibold"
                                            : "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300"
                                        }`}
                                      >
                                        {k}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )
                )
              )}
            </div>
          </div>
        </div>
        {/* Kanan: Dosen Tersedia */}
        <div className="md:col-span-3">
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl shadow-lg p-8">
            <h2 className="text-lg font-semibold mb-4 text-brand-700 dark:text-brand-300">
              Dosen Tersedia (
              {filteredRegularDosen.length + filteredStandbyDosen.length})
            </h2>
            {/* Search input for dosen/keahlian */}
            <input
              type="text"
              value={searchDosen}
              onChange={(e) => setSearchDosen(e.target.value)}
              placeholder="Cari dosen atau keahlian..."
              className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-brand-500 focus:border-brand-500 mb-6 bg-white dark:bg-gray-800 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
            />
            {/* Dosen Reguler */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-brand-500"></div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Dosen Reguler ({filteredRegularDosen.length})
                </h4>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto hide-scroll">
                {filteredRegularDosen.length > 0 ? (
                  filteredRegularDosen.map((dosen) => {
                    const keahlianArr = Array.isArray(dosen.keahlian)
                      ? dosen.keahlian
                      : typeof dosen.keahlian === "string" && dosen.keahlian
                      ? [dosen.keahlian]
                      : [];
                    const isStandby = keahlianArr.some((k) =>
                      k.toLowerCase().includes("standby")
                    );
                    return (
                      <div
                        key={dosen.id}
                        className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all duration-200 cursor-move"
                        draggable
                        onDragStart={(e) => handleDragStart(e, dosen.id)}
                        onDragEnd={handleDragEnd}
                        style={{ userSelect: "none", WebkitUserSelect: "none" }}
                      >
                        {/* Header dengan Avatar dan Info Dasar */}
                        <div className="flex items-start gap-3 mb-3">
                          <div
                            className={`w-10 h-10 rounded-full ${
                              isStandby ? "bg-yellow-400" : "bg-brand-500"
                            } flex items-center justify-center relative`}
                          >
                            <span className="text-white text-sm font-bold">
                              {dosen.name.charAt(0)}
                            </span>
                            <span
                              className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-semibold rounded-full flex justify-center items-center w-6 h-6 border-2 border-white dark:border-gray-800"
                              title="Jumlah penugasan"
                            >
                              {typeof dosen.csr_assignment_count === "number"
                                ? dosen.csr_assignment_count
                                : 0}
                              x
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800 dark:text-white/90 text-sm mb-1">
                              {dosen.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              NID: {dosen.nid}
                            </div>
                          </div>
                        </div>
                        {/* Only Keahlian Section */}
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-orange-500"></div>
                            Keahlian
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {keahlianArr.map((k, idx) => (
                              <span
                                key={idx}
                                className={`text-xs px-2 py-1 rounded-full font-medium ${
                                  k.toLowerCase() === "standby"
                                    ? "bg-yellow-100 dark:bg-yellow-900/40 text-yellow-800 dark:text-yellow-200 font-semibold"
                                    : "bg-orange-100 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300"
                                }`}
                              >
                                {k}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gray-700 dark:bg-gray-800 flex items-center justify-center">
                      <FontAwesomeIcon
                        icon={faUsers}
                        className="w-6 h-6 text-gray-400"
                      />
                    </div>
                    <div className="text-sm text-gray-400">
                      Tidak ada dosen reguler
                    </div>
                  </div>
                )}
              </div>
            </div>
            {/* Dosen Standby */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Dosen Standby ({filteredStandbyDosen.length})
                </h4>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto hide-scroll">
                {filteredStandbyDosen.length > 0 ? (
                  filteredStandbyDosen.map((dosen) => {
                    const keahlianArr = Array.isArray(dosen.keahlian)
                      ? dosen.keahlian
                      : typeof dosen.keahlian === "string" && dosen.keahlian
                      ? [dosen.keahlian]
                      : [];
                    const isStandby = keahlianArr.some((k) =>
                      k.toLowerCase().includes("standby")
                    );
                    return (
                      <div
                        key={dosen.id}
                        className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl hover:shadow-md transition-all duration-200 cursor-move"
                        draggable
                        onDragStart={(e) => handleDragStart(e, dosen.id)}
                        onDragEnd={handleDragEnd}
                        style={{ userSelect: "none", WebkitUserSelect: "none" }}
                      >
                        {/* Header dengan Avatar dan Info Dasar */}
                        <div className="flex items-start gap-3 mb-3">
                          <div
                            className={`w-10 h-10 rounded-full ${
                              isStandby ? "bg-yellow-400" : "bg-brand-500"
                            } flex items-center justify-center relative`}
                          >
                            <span className="text-white text-sm font-bold">
                              {dosen.name.charAt(0)}
                            </span>
                            <span
                              className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-semibold rounded-full flex justify-center items-center w-6 h-6 border-2 border-white dark:border-gray-800"
                              title="Jumlah penugasan"
                            >
                              {typeof dosen.csr_assignment_count === "number"
                                ? dosen.csr_assignment_count
                                : 0}
                              x
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800 dark:text-white/90 text-sm mb-1">
                              {dosen.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              NID: {dosen.nid}
                            </div>
                          </div>
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-200 text-gray-700 text-xs">
                            Standby
                          </span>
                        </div>
                        {/* Tidak ada info lain untuk dosen standby */}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gray-700 dark:bg-gray-800 flex items-center justify-center">
                      <FontAwesomeIcon
                        icon={faUsers}
                        className="w-6 h-6 text-gray-400"
                      />
                    </div>
                    <div className="text-sm">Tidak ada dosen standby</div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Modal Konfirmasi Hapus Keahlian */}
      <AnimatePresence>
        {showDeleteKeahlianModal && keahlianToDelete && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => {
                setShowDeleteKeahlianModal(false);
                setKeahlianToDelete(null);
              }}
            ></motion.div>
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowDeleteKeahlianModal(false);
                  setKeahlianToDelete(null);
                }}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <div>
                <div className="flex items-center justify-between pb-6">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    Hapus Kategori Keahlian
                  </h2>
                </div>
                <div>
                  <p className="mb-6 text-gray-500 dark:text-gray-400">
                    Apakah Anda yakin ingin menghapus kategori keahlian{" "}
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {keahlianToDelete}
                    </span>
                    ? Data yang dihapus tidak dapat dikembalikan.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setShowDeleteKeahlianModal(false);
                        setKeahlianToDelete(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={async () => {
                        if (!keahlianToDelete) return;
                        setIsDeletingKeahlian(true);
                        await handleRemoveKeahlian(keahlianToDelete);
                        setIsDeletingKeahlian(false);
                        setShowDeleteKeahlianModal(false);
                        setKeahlianToDelete(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center"
                      disabled={isDeletingKeahlian}
                    >
                      {isDeletingKeahlian ? (
                        <>
                          <svg
                            className="w-5 h-5 mr-2 animate-spin text-white"
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
                          Menghapus...
                        </>
                      ) : (
                        "Hapus"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CSRDetail;
