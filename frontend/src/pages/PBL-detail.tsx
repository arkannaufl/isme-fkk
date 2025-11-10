import React, {
  useState,
  useEffect,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBookOpen,
  faUsers,
  faTimes,
  faExclamationTriangle,
  faClock,
  faCog,
  faCheckCircle,
  faSearch,
  faEye,
  faChevronUp,
  faChevronDown,
  faFileExcel,
} from "@fortawesome/free-solid-svg-icons";
import { AnimatePresence, motion } from "framer-motion";
import api from "../utils/api";
import { useParams, useNavigate } from "react-router-dom";
import ExcelJS from "exceljs";
import { saveAs } from "file-saver";

type MataKuliah = {
  kode: string;
  nama: string;
  semester: number;
  periode: string;
  jenis: "Blok" | "Non Blok";
  kurikulum: number;
  tanggalMulai: string;
  tanggalAkhir: string;
  blok: number | null;
  durasiMinggu: number | null;
  keahlian_required?: string[];
};

type PBL = {
  id?: number;
  mata_kuliah_kode: string;
  modul_ke: string;
  nama_modul: string;
  created_at?: string;
  updated_at?: string;
};

// Tambahkan tipe untuk kelompok kecil
interface KelompokKecil {
  id: number;
  nama_kelompok: string;
  jumlah_anggota: number;
}

// Tambahkan tipe untuk mahasiswa
interface Mahasiswa {
  nama: string;
  nim: string;
  angkatan: string;
  ipk: number;
}

// Tambahkan tipe untuk dosen
interface Dosen {
  id: number;
  nid: string;
  name: string;
  keahlian: string[] | string;
  peran_utama?: string; // koordinator, tim_blok, dosen_mengajar
  peran_kurikulum_mengajar?: string;
  pbl_assignment_count?: number;
  pbl_role?: string; // koordinator, tim_blok, dosen_mengajar
  dosen_peran?: any[];
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

// Helper untuk mapping semester ke angka
function mapSemesterToNumber(semester: string | number | null): number | null {
  if (semester == null) return null;
  if (typeof semester === "number") return semester;
  if (!isNaN(Number(semester))) return Number(semester);
  return null;
}

// Helper untuk parsing keahlian agar selalu array string rapi
function parseKeahlian(val: string[] | string | undefined): string[] {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const arr = JSON.parse(val);
      if (Array.isArray(arr)) return arr;
    } catch (error) {
      // Silent fail - fallback to string parsing
    }
    return val
      .split(",")
      .map((k) => k.trim())
      .filter((k) => k !== "");
  }
  return [];
}

export default function PBL() {
  const { blokId } = useParams();
  const navigate = useNavigate();
  const [pblData, setPblData] = useState<{ [kode: string]: PBL[] }>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // PERBAIKAN BARU: State untuk tracking apakah sudah ada data yang di-generate
  const [hasGeneratedData, setHasGeneratedData] = useState<boolean>(false);

  // State untuk validasi generate status
  const [isGenerateValidated, setIsGenerateValidated] =
    useState<boolean>(false);
  const [generateValidationError, setGenerateValidationError] = useState<
    string | null
  >(null);

  // State untuk Clear Cache Modal
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);

  // Comprehensive statistics state
  const [pblDetailStatistics, setPblDetailStatistics] = useState<{
    // Blok Overview Statistics
    blokCompletionRate: number;
    dosenPerBlok: number;
    modulPerBlok: number;
    keahlianCoverage: number;

    // Performance Statistics
    assignmentSuccessRate: number;
    dosenEfficiency: number;
    keahlianUtilization: number;
    timBlokVsDosenMengajarRatio: number;

    // Real-time Statistics
    lastGenerateTime: string | null;
    dataFreshness: "fresh" | "stale" | "outdated";
    warningCount: number;
    cacheStatus: "clean" | "dirty" | "needs_refresh";

    // Quality Metrics
    keahlianMatchRate: number;
    dosenOverloadCount: number;
    unassignedPBLCount: number;
    standbyDosenUsage: number;

    // Additional statistics (same as PBLGenerate)
    totalAssignments: number;
    assignmentRate: number;
    dosenUtilizationRate: number;
    assignmentDistribution: {
      koordinator: number;
      timBlok: number;
      dosenMengajar: number;
    };
  }>({
    blokCompletionRate: 0,
    dosenPerBlok: 0,
    modulPerBlok: 0,
    keahlianCoverage: 0,
    assignmentSuccessRate: 0,
    dosenEfficiency: 0,
    keahlianUtilization: 0,
    timBlokVsDosenMengajarRatio: 0,
    lastGenerateTime: null,
    dataFreshness: "fresh",
    warningCount: 0,
    cacheStatus: "clean",
    keahlianMatchRate: 0,
    dosenOverloadCount: 0,
    unassignedPBLCount: 0,
    standbyDosenUsage: 0,
    totalAssignments: 0,
    assignmentRate: 0,
    dosenUtilizationRate: 0,
    assignmentDistribution: {
      koordinator: 0,
      timBlok: 0,
      dosenMengajar: 0,
    },
  });

  // Ref untuk menyimpan snapshot terakhir statistik, mencegah setState berulang
  const pblStatsRef = useRef(pblDetailStatistics);
  useEffect(() => {
    pblStatsRef.current = pblDetailStatistics;
  }, [pblDetailStatistics]);

  // PERBAIKAN BARU: Fungsi untuk mengecek apakah sudah ada data yang di-generate
  const checkHasGeneratedData = () => {
    const totalAssignedDosen = Object.values(assignedDosen).flat().length;
    const hasData = totalAssignedDosen > 0;
    setHasGeneratedData(hasData);
    return hasData;
  };

  // Fungsi untuk validasi generate status
  const validateGenerateStatus = async () => {
    if (!blokId) {
      setGenerateValidationError("Blok ID tidak ditemukan");
      return false;
    }

    try {
      const response = await api.get(
        `/pbl-generate/check-status?blok=${blokId}`
      );

      // Hanya gunakan data dari API (database)
      const isGenerated =
        response.data.success && response.data.data?.is_generated === true;

      if (!isGenerated) {
        setGenerateValidationError(
          "Blok ini belum di-generate. Silakan generate dosen terlebih dahulu."
        );
        setIsGenerateValidated(false);
        return false;
      }

      setIsGenerateValidated(true);
      setGenerateValidationError(null);
      return true;
    } catch (error) {
      // Jika API gagal, return false
      setGenerateValidationError("Error mengecek status generate");
      setIsGenerateValidated(false);
      return false;
    }
  };

  // PERBAIKAN BARU: Fungsi khusus untuk refresh assignment data setelah assignment manual
  const refreshAssignmentData = async (pblIds: number[]) => {
    try {
      const assignedRes = await api.post("/pbl-generate/get-assignments", {
        pbl_ids: pblIds,
      });

      if (assignedRes.data.success) {
        const assignmentsData = assignedRes.data.data || {};
        setAssignedDosen((prev) => {
          const updated = { ...prev };
          pblIds.forEach((pblId) => {
            if (pblId !== undefined) {
              const assignments = assignmentsData[pblId] || [];
              updated[pblId] = assignments.map((assignment) => ({
                id: assignment.dosen.id,
                name: assignment.dosen.name,
                nid: assignment.dosen.nid,
                pbl_role: assignment.role,
                pbl_assignment_count: assignment.pbl_assignment_count || 0,
                keahlian: assignment.dosen.keahlian || [],
                dosen_peran: assignment.dosen.dosen_peran || [],
                peran_utama: assignment.dosen.peran_utama,
                peran_kurikulum_mengajar:
                  assignment.dosen.peran_kurikulum_mengajar,
              }));
            }
          });
          return updated;
        });
      } else {
      }
    } catch (error) {}
  };
  const [blokMataKuliah, setBlokMataKuliah] = useState<MataKuliah[]>([]);
  const [filterSemester, setFilterSemester] = useState("semua");
  const [filterBlok, setFilterBlok] = useState("semua");
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [selectedPBL, setSelectedPBL] = useState<{
    kode: string;
    index?: number;
    pbl?: PBL;
  } | null>(null);
  const [form, setForm] = useState({ modul_ke: "", nama_modul: "" });
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [pblToDelete, setPblToDelete] = useState<{
    kode: string;
    index: number;
    pbl: PBL;
  } | null>(null);
  const [kelompokKecilList, setKelompokKecilList] = useState<KelompokKecil[]>(
    []
  );
  const [blokKelompokBySemester, setBlokKelompokBySemester] = useState<{
    [semester: string]: { [kode: string]: string[] };
  }>({});
  const [showKelompokModal, setShowKelompokModal] = useState<string | null>(
    null
  );
  const [selectedKelompok, setSelectedKelompok] = useState<string[]>([]);
  const [searchKelompok, setSearchKelompok] = useState("");
  const [showToast, setShowToast] = useState(false);
  const [showMahasiswaModal, setShowMahasiswaModal] = useState<{
    kelompok: KelompokKecil;
    mahasiswa: Mahasiswa[];
  } | null>(null);
  const [activeSemesterJenis, setActiveSemesterJenis] = useState<string | null>(
    null
  );
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [pblTablePage, setPblTablePage] = useState<{ [kode: string]: number }>(
    {}
  );
  // State untuk detail kelompok kecil yang sudah dipilih
  const [kelompokKecilDetailList, setKelompokKecilDetailList] = useState<
    KelompokKecil[]
  >([]);
  // Tambahkan state untuk loading simpan kelompok
  const [isSavingKelompok, setIsSavingKelompok] = useState(false);
  // State untuk mapping kelompok kecil PBL per mata kuliah
  const [pblKelompokMapping] = useState<{
    [kode: string]: string[];
  }>({});
  const [kelompokKecilCache, setKelompokKecilCache] = useState<
    Record<string, KelompokKecil[]>
  >({});
  // Ganti state kelompokKecilList menjadi per semester
  const [kelompokKecilListBySemester, setKelompokKecilListBySemester] =
    useState<{ [semester: string]: KelompokKecil[] }>({});
  const [dosenList, setDosenList] = useState<Dosen[]>([]);
  const [draggedDosen, setDraggedDosen] = useState<Dosen | null>(null);
  const [draggedFromPBLId, setDraggedFromPBLId] = useState<number | null>(null);
  const [dragOverPBLId, setDragOverPBLId] = useState<number | null>(null);
  const [isMovingDosen, setIsMovingDosen] = useState(false);

  // Drag state - using HTML5 Drag API like KelompokKecil.tsx
  // Tambahkan state untuk assigned dosen per PBL
  const [assignedDosen, setAssignedDosen] = useState<{
    [pblId: number]: Dosen[];
  }>({});

  // (Removed) Konflik per semester untuk pewarnaan badge dan warning
  // Track role assignments per PBL for UI coloring
  const [roleAssignments, setRoleAssignments] = useState<{
    [pblId: number]: { koordinator?: number[]; timBlok?: number[] };
  }>({});

  // Tambahkan state untuk real-time sync dengan reporting
  const [reportingData, setReportingData] = useState<any>(null);
  const [isUpdatingReporting, setIsUpdatingReporting] = useState(false);

  const [searchDosen, setSearchDosen] = useState("");
  // Tambahkan state untuk pagination modal mahasiswa
  const [pageMahasiswaModal, setPageMahasiswaModal] = useState(1);
  // Tambahkan state untuk filter status dan statistik
  const [filterStatus, setFilterStatus] = useState("semua");

  // State untuk popup konfirmasi keahlian tidak sesuai
  const [showKeahlianConfirmModal, setShowKeahlianConfirmModal] =
    useState(false);
  const [pendingAssignment, setPendingAssignment] = useState<{
    dosen: Dosen;
    pbl: PBL;
    mk: MataKuliah;
  } | null>(null);

  // New state for statistics
  const [kelompokKecilCount, setKelompokKecilCount] = useState<number>(0);
  const [totalKelompokKecilAllSemester, setTotalKelompokKecilAllSemester] =
    useState<number>(0);
  const [keahlianCount, setKeahlianCount] = useState<number>(0);
  const [peranKetuaCount, setPeranKetuaCount] = useState<number>(0);
  const [peranAnggotaCount, setPeranAnggotaCount] = useState<number>(0);
  const [dosenMengajarCount, setDosenMengajarCount] = useState<number>(0);

  // HTML5 Drag API handlers - same as KelompokKecil.tsx
  const handleDragStart = (e: React.DragEvent, dosen: Dosen) => {
    setDraggedDosen(dosen);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", dosen.id.toString());

    // Tambahkan styling drag
    if (e.currentTarget) {
      (e.currentTarget as HTMLElement).style.opacity = "0.5";
    }

    // Create custom drag image with + icon
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
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedDosen(null);

    // Hapus styling drag
    if (e.currentTarget) {
      (e.currentTarget as HTMLElement).style.opacity = "1";
    }
  };

  // Handle dosen drop for touch events
  const handleDosenDrop = async (dosen: Dosen, pbl: PBL, mk: MataKuliah) => {
    if (!dosen || dosen.id == null) return;

    // Jika dosen sudah ada di PBL target, tolak
    if (
      pbl.id &&
      (assignedDosen[pbl.id] || []).some((d) => d.id === dosen.id)
    ) {
      setError("Dosen sudah ada di PBL ini.");
      return;
    }

    // Cek apakah keahlian dosen sesuai dengan mata kuliah
    const isKeahlianMatch = checkKeahlianMatch(dosen, mk);

    // Check if dosen is standby
    const dosenKeahlian = Array.isArray(dosen.keahlian)
      ? dosen.keahlian
      : (dosen.keahlian || "").split(",").map((k) => k.trim());
    const isStandby = dosenKeahlian.some((k) =>
      k.toLowerCase().includes("standby")
    );

    // Validasi keahlian untuk dosen non-standby
    if (!isStandby && !isKeahlianMatch) {
      setError(
        `Keahlian dosen ${dosen.name} tidak sesuai dengan mata kuliah ${
          mk.nama
        }. Keahlian dosen: ${dosenKeahlian.join(
          ", "
        )}, Keahlian yang dibutuhkan: ${(mk.keahlian_required || []).join(
          ", "
        )}`
      );
      return;
    }

    try {
      setIsMovingDosen(true);
      setError("");

      // Check dosen_peran for semester and mata kuliah matching
      if (dosen.dosen_peran && Array.isArray(dosen.dosen_peran)) {
        const matchingPeran = dosen.dosen_peran.find((peran: any) => {
          if (peran.semester === String(mk.semester)) {
            const peranMkName = peran.mata_kuliah_nama?.toLowerCase() || "";
            const mkName = mk.nama.toLowerCase();
            return peranMkName.includes(mkName) || mkName.includes(peranMkName);
          }
          return false;
        });

        if (matchingPeran) {
          // Dosen memiliki peran yang sesuai
          const peranUtama = matchingPeran.peran_utama;
          if (peranUtama === "koordinator" || peranUtama === "tim_blok") {
            // Dosen koordinator atau tim blok - tidak perlu warning
          } else if (peranUtama === "dosen_mengajar") {
            // Dosen mengajar - tidak perlu warning
          } else {
            // Peran tidak jelas - warning
            const warningMsg = `Dosen ${
              dosen.name
            } memiliki peran yang tidak jelas untuk ${mk.nama} (${
              mk.kode
            }). Peran: ${peranUtama || "Tidak ditentukan"}`;
            setWarnings([warningMsg]);
          }
        } else {
          // Dosen tidak memiliki peran yang sesuai - tidak perlu warning karena hanya keahlian yang penting
        }
      }

      // Assign dosen to PBL
      await handleAssignDosen(dosen, pbl, mk);
    } catch (error: any) {
      // Tangani error dari backend (termasuk 422)
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "Gagal menugaskan dosen";
      setError(errorMessage);

      // Clear error setelah 5 detik
      setTimeout(() => {
        setError(null);
      }, 5000);
    } finally {
      setIsMovingDosen(false);
      setDraggedDosen(null);
      setDraggedFromPBLId(null);
    }
  };

  const checkKeahlianMatch = (dosen: Dosen, mk: MataKuliah): boolean => {
    const dosenKeahlian = Array.isArray(dosen.keahlian)
      ? dosen.keahlian
      : (dosen.keahlian || "").split(",").map((k) => k.trim());
    const requiredKeahlian = mk.keahlian_required || [];

    // Check if dosen is standby
    const isStandby = dosenKeahlian.some((k) =>
      k.toLowerCase().includes("standby")
    );

    // If dosen is standby, skip keahlian validation
    if (isStandby) return true;

    // More flexible keahlian matching
    return requiredKeahlian.some((req) =>
      dosenKeahlian.some((dosenKeahlian) => {
        const reqLower = req.toLowerCase();
        const dosenKeahlianLower = dosenKeahlian.toLowerCase();
        return (
          dosenKeahlianLower.includes(reqLower) ||
          reqLower.includes(dosenKeahlianLower) ||
          reqLower
            .split(" ")
            .some((word) => dosenKeahlianLower.includes(word)) ||
          dosenKeahlianLower.split(" ").some((word) => reqLower.includes(word))
        );
      })
    );
  };

  // Fungsi untuk menangani assignment dosen
  const handleAssignDosen = async (dosen: Dosen, pbl: PBL, mk: MataKuliah) => {
    // PERBAIKAN BARU: Validasi yang lebih fleksibel - cek apakah ada data PBL
    const hasPblData = Object.keys(pblData).length > 0;
    if (!hasPblData) {
      setError(
        "Tidak dapat melakukan assignment manual. Silakan generate dosen terlebih dahulu di halaman PBL Generate."
      );
      return;
    }

    try {
      // Cari PBL dalam semester yang sama TAPI HANYA di blok yang sedang dilihat
      const currentSemester = mk.semester;
      const currentBlok = mk.blok; // Ambil blok dari mata kuliah yang sedang di-assign

      const semesterPBLs = Object.values(pblData || {})
        .flat()
        .filter((p) => {
          const mk = (blokMataKuliah || []).find(
            (m) => m.kode === p.mata_kuliah_kode
          );
          // PERBAIKAN: Konversi kedua semester menjadi number untuk perbandingan yang benar
          const mkSemesterNum = mk ? parseInt(mk.semester.toString()) : null;
          const currentSemesterNum = parseInt(currentSemester.toString());
          const mkBlok = mk ? mk.blok : null;

          // Pastikan semester sama DAN blok sama
          const matches =
            mk &&
            mkSemesterNum === currentSemesterNum &&
            mkBlok === currentBlok;

          return matches;
        });

      // Assign dosen ke PBL dalam semester dan blok yang sama
      const assignPromises = (semesterPBLs || []).map(async (semesterPbl) => {
        try {
          // PERBAIKAN: Tentukan role berdasarkan dosen_peran untuk semester dan blok yang sama
          let role = "dosen_mengajar"; // default
          const dosenPeran = dosen.dosen_peran?.find(
            (peran: any) => {
              // Cek semester (konversi ke string untuk perbandingan)
              const peranSemester = String(peran.semester);
              const currentSemesterStr = String(currentSemester);
              
              // Cek apakah dosen punya peran koordinator/tim_blok di semester yang sama
              const hasRole = peran.tipe_peran === "koordinator" || 
                             peran.tipe_peran === "tim_blok";
              
              return peranSemester === currentSemesterStr && hasRole;
            }
          );
          if (dosenPeran) {
            role = dosenPeran.tipe_peran;
           }

          const response = await api.post(
            `/pbls/${semesterPbl.id}/assign-dosen`,
            {
              dosen_id: dosen.id,
              role: role,
            }
          );

          return { pblId: semesterPbl.id, success: true, response };
        } catch (error: any) {
          return {
            pblId: semesterPbl.id,
            success: false,
            error: error?.response?.data?.message,
          };
        }
      });

      const results = await Promise.all(assignPromises);
      const successfulAssignments = results.filter((r) => r.success);
      const failedAssignments = results.filter((r) => !r.success);

      // PERBAIKAN BARU: Refresh assigned dosen data untuk semua PBL yang berhasil

      if (successfulAssignments.length > 0) {
        // Emit custom event untuk notify PBLGenerate.tsx
        window.dispatchEvent(new CustomEvent("pbl-assignment-updated"));

        // PERBAIKAN BARU: Langsung tambahkan dosen ke state assignedDosen untuk immediate UI update
        setAssignedDosen((prev) => {
          const updated = { ...prev };
          successfulAssignments
            .map((r) => r.pblId)
            .forEach((pblId) => {
              if (pblId !== undefined) {
                const existingAssignments = updated[pblId] || [];

                // Cek apakah dosen sudah ada di PBL ini
                const isAlreadyAssigned = existingAssignments.some(
                  (d) => d.id === dosen.id
                );

                if (!isAlreadyAssigned) {
                  // Tambahkan dosen dengan data lengkap
                  const newDosenData = {
                    id: dosen.id,
                    name: dosen.name,
                    nid: dosen.nid,
                    pbl_role: "dosen_mengajar", // Default untuk manual assignment
                    pbl_assignment_count: dosen.pbl_assignment_count || 0,
                    keahlian: dosen.keahlian || [],
                    dosen_peran: dosen.dosen_peran || [],
                    peran_utama: dosen.peran_utama,
                    peran_kurikulum_mengajar: dosen.peran_kurikulum_mengajar,
                  };

                  updated[pblId] = [...existingAssignments, newDosenData];
                } else {
                }
              }
            });
          return updated;
        });

        // PERBAIKAN BARU: Gunakan fungsi khusus untuk refresh assignment data
        await refreshAssignmentData(successfulAssignments.map((r) => r.pblId));

        // PERBAIKAN: Update role assignments untuk UI coloring
        const newRoleAssignments: {
          [pblId: number]: { koordinator?: number[]; timBlok?: number[] };
        } = { ...roleAssignments };

        // Tentukan peran dosen berdasarkan dosen_peran dari database
        // Untuk manual assignment, kita perlu menentukan peran berdasarkan dosen_peran
        // karena pbl_role belum tersedia saat assignment baru
        const dosenPeran = dosen.dosen_peran?.find(
          (peran: any) =>
            peran.semester === currentSemester &&
            (peran.tipe_peran === "koordinator" ||
              peran.tipe_peran === "tim_blok")
        );

        if (dosenPeran) {
          successfulAssignments
            .map((r) => r.pblId)
            .forEach((pblId) => {
              if (pblId !== undefined) {
                if (!newRoleAssignments[pblId]) {
                  newRoleAssignments[pblId] = {};
                }

                if (dosenPeran.tipe_peran === "koordinator") {
                  if (!newRoleAssignments[pblId].koordinator) {
                    newRoleAssignments[pblId].koordinator = [];
                  }
                  if (
                    !newRoleAssignments[pblId].koordinator!.includes(dosen.id)
                  ) {
                    newRoleAssignments[pblId].koordinator!.push(dosen.id);
                  }
                } else if (dosenPeran.tipe_peran === "tim_blok") {
                  if (!newRoleAssignments[pblId].timBlok) {
                    newRoleAssignments[pblId].timBlok = [];
                  }
                  if (!newRoleAssignments[pblId].timBlok!.includes(dosen.id)) {
                    newRoleAssignments[pblId].timBlok!.push(dosen.id);
                  }
                }
              }
            });
        }

        setRoleAssignments(newRoleAssignments);
      }

      // Show success notification
      const isKeahlianMatch = checkKeahlianMatch(dosen, mk);
      if (successfulAssignments.length === (semesterPBLs || []).length) {
        // Semua berhasil
        if (isKeahlianMatch) {
          setSuccess(
            `${dosen.name} berhasil di-assign ke semua modul Blok ${currentBlok} semester ${currentSemester}`
          );
        } else {
          setSuccess(
            `${dosen.name} berhasil di-assign ke semua modul Blok ${currentBlok} semester ${currentSemester} (Keahlian tidak sesuai)`
          );
        }

        // Dispatch event untuk update real-time di Dosen.tsx
        window.dispatchEvent(
          new CustomEvent("pbl-assignment-updated", {
            detail: {
              timestamp: Date.now(),
              dosenId: dosen.id,
              dosenName: dosen.name,
              pblIds: successfulAssignments.map((r) => r.pblId),
              isKeahlianMatch: isKeahlianMatch,
            },
          })
        );
      } else if (successfulAssignments.length > 0) {
        // Sebagian berhasil
        if (isKeahlianMatch) {
          setSuccess(
            `${dosen.name} berhasil di-assign ke ${
              successfulAssignments.length
            }/${
              (semesterPBLs || []).length
            } modul Blok ${currentBlok} semester ${currentSemester}`
          );
        } else {
          setSuccess(
            `${dosen.name} berhasil di-assign ke ${
              successfulAssignments.length
            }/${
              (semesterPBLs || []).length
            } modul Blok ${currentBlok} semester ${currentSemester} (Keahlian tidak sesuai)`
          );
        }

        // Dispatch event untuk update real-time di Dosen.tsx
        window.dispatchEvent(
          new CustomEvent("pbl-assignment-updated", {
            detail: {
              timestamp: Date.now(),
              dosenId: dosen.id,
              dosenName: dosen.name,
              pblIds: successfulAssignments.map((r) => r.pblId),
              isKeahlianMatch: isKeahlianMatch,
            },
          })
        );
      } else {
        // Semua gagal
        setError(
          `Gagal assign ${dosen.name} ke semua modul Blok ${currentBlok} semester ${currentSemester}`
        );
      }

      // Clear notification after 3 seconds (PERBAIKAN: Jangan hapus warnings)
      setTimeout(() => {
        setSuccess(null);
        setError(null);
      }, 3000);

      // PERBAIKAN BARU: Tunggu sebentar agar data ter-update sebelum fetchAll
      setTimeout(async () => {
        await fetchAll();

        // PERBAIKAN BARU: Hitung ulang warning setelah data ter-refresh
        setTimeout(() => {
          recalculateWarnings();
        }, 100);
      }, 200);

      // PERBAIKAN BARU: Cek status generated data setelah assignment
      checkHasGeneratedData();
    } catch (error: any) {
      // Tangani error 422 atau error lainnya dengan pesan yang jelas
      const errorMessage =
        error?.response?.data?.message || "Gagal assign dosen";
      setError(errorMessage);

      // Clear error setelah 5 detik
      setTimeout(() => {
        setError(null);
      }, 5000);
    }
  };

  // Helper untuk mendapatkan dosen yang di-assign per semester
  const getDosenBySemester = (semester: number) => {
    const semesterMataKuliah = blokMataKuliahFiltered.filter(
      (mk) => mk.semester === semester
    );
    const semesterPblIds = semesterMataKuliah.flatMap((mk) =>
      (pblData[mk.kode] || []).map((pbl) => pbl.id).filter(Boolean)
    );

    const semesterDosen = new Set<Dosen>();
    semesterPblIds.forEach((pblId) => {
      if (pblId && assignedDosen[pblId]) {
        assignedDosen[pblId].forEach((dosen: Dosen) => {
          // Pastikan keahlian selalu dalam format array
          if (!Array.isArray(dosen.keahlian)) {
            dosen.keahlian = (dosen.keahlian || "")
              .split(",")
              .map((k) => k.trim());
          }
          semesterDosen.add(dosen);
        });
      }
    });
    return Array.from(semesterDosen);
  };

  // Function to get all assigned dosen (including Koordinator & Tim Block from UserSeeder)
  const getAllAssignedDosen = (pblId: number, mk: MataKuliah): Dosen[] => {
    // Hanya ambil dosen dari pbl_mappings (hasil generate)
    // Tidak menampilkan Koordinator & Tim Blok dari UserSeeder sampai di-generate
    const assignedFromMappings = assignedDosen[pblId] || [];

    // Jika belum ada assignment (belum di-generate), return array kosong
    if (assignedFromMappings.length === 0) {
      return [];
    }

    // Jika sudah ada assignment, hanya tampilkan dosen dari pbl_mappings
    return assignedFromMappings;
  };

  // (Removed) Deteksi konflik per semester

  // Helper untuk mendapatkan dosen yang tersedia (tidak di-assign ke semester manapun)
  const assignedDosenIds = Object.values(assignedDosen)
    .flat()
    .map((d) => d.id);
  const parseKeahlian = (keahlian: string[] | string): string[] => {
    if (Array.isArray(keahlian)) return keahlian;
    return (keahlian || "").split(",").map((k) => k.trim());
  };

  // Dosen standby: memiliki keahlian "standby"
  const standbyDosenList = dosenList.filter((d) => {
    const keahlian = parseKeahlian(d.keahlian);
    return (
      keahlian.some((k) => k.toLowerCase().includes("standby")) &&
      (!searchDosen ||
        (d.name && d.name.toLowerCase().includes(searchDosen.toLowerCase())) ||
        (d.nid && d.nid.toLowerCase().includes(searchDosen.toLowerCase())) ||
        keahlian.some((k) =>
          k.toLowerCase().includes(searchDosen.toLowerCase())
        ))
    );
  });

  // Dosen regular: tidak memiliki keahlian "standby"
  // PERBAIKAN: Tambahkan assignedDosen sebagai dependency untuk real-time updates
  const availableDosenList = useMemo(() => {
    return dosenList.filter((d) => {
      const keahlian = parseKeahlian(d.keahlian);
      return (
        !keahlian.some((k) => k.toLowerCase().includes("standby")) &&
        (!searchDosen ||
          (d.name &&
            d.name.toLowerCase().includes(searchDosen.toLowerCase())) ||
          (d.nid && d.nid.toLowerCase().includes(searchDosen.toLowerCase())) ||
          keahlian.some((k) =>
            k.toLowerCase().includes(searchDosen.toLowerCase())
          ))
      );
    });
  }, [dosenList, searchDosen, assignedDosen]); // Tambahkan assignedDosen sebagai dependency

  // Untuk expand/collapse per grup peran
  const [expandedGroups, setExpandedGroups] = useState<{
    [key: string]: boolean;
  }>({});
  const [showAllPeran, setShowAllPeran] = useState<{ [key: string]: boolean }>(
    {}
  );
  const toggleGroup = (rowKey: string) => {
    setExpandedGroups((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };
  const toggleShowAll = (rowKey: string) => {
    setShowAllPeran((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

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

  // Warning tidak auto-clear, harus manual ditambah dosen

  async function fetchAll() {
    setLoading(true);
    setError(null);
    try {
      // Fetch PBLs and dosen in parallel
      const [pblRes, dosenRes, kelompokKecilRes] = await Promise.all([
        api.get("/pbls/all"),
        api.get("/users?role=dosen"),
        api.get("/kelompok-kecil"),
      ]);

      const data = pblRes.data || {};
      const blokListMapped: MataKuliah[] = Array.from(
        Object.values(data) as { mata_kuliah: MataKuliah }[]
      ).map((item) => item.mata_kuliah);
      const pblMap: Record<string, PBL[]> = {};
      Array.from(Object.entries(data) as [string, { pbls: PBL[] }][]).forEach(
        ([kode, item]) => {
          pblMap[kode] = item.pbls || [];
        }
      );
      setBlokMataKuliah(blokListMapped);
      setPblData(pblMap);
      setDosenList(dosenRes.data || []);

      const dosenWithPeran = dosenRes.data?.filter(
        (d: any) => d.dosen_peran && d.dosen_peran.length > 0
      );

      // Calculate statistics (gunakan data yang sama dengan PBLGenerate.tsx)
      // Gunakan blokListMapped yang sudah difilter berdasarkan blokId (sama seperti PBLGenerate.tsx)
      let filteredBlokMataKuliah = blokListMapped;
      if (blokId) {
        filteredBlokMataKuliah = blokListMapped.filter(
          (mk: MataKuliah) => String(mk.blok) === String(blokId)
        );
      }

      calculateStatistics(
        filteredBlokMataKuliah,
        dosenRes.data || [],
        kelompokKecilRes.data || [],
        activeSemesterJenis,
        blokId || "semua"
      );

      // PERBAIKAN: Hitung kekurangan dosen dan warning seperti PBLGenerate.tsx
      calculateWarnings(
        filteredBlokMataKuliah,
        dosenRes.data || [],
        kelompokKecilRes.data || []
      );

      // Fetch assigned dosen batch (all pblId)
      const allPbls = Object.values(pblMap).flat();
      const allPblIds = allPbls.map((pbl) => pbl.id).filter(Boolean);

      if (allPblIds.length > 0) {
        try {
          // PERBAIKAN: Hapus retry mechanism yang menyebabkan masalah
          const assignedRes = await api.post("/pbl-generate/get-assignments", {
            pbl_ids: allPblIds,
          });

          // PERBAIKAN: Convert data seperti di PBLGenerate.tsx untuk memastikan pbl_assignment_count benar
          if (assignedRes.data.success) {
            const assignmentsData = assignedRes.data.data || {};
            const convertedData = {};
            Object.keys(assignmentsData).forEach((pblId) => {
              const assignments = assignmentsData[pblId];
              convertedData[parseInt(pblId)] = assignments.map(
                (assignment) => ({
                  id: assignment.dosen.id,
                  name: assignment.dosen.name,
                  nid: assignment.dosen.nid,
                  pbl_role: assignment.role,
                  pbl_assignment_count: assignment.pbl_assignment_count || 0,
                  keahlian: assignment.dosen.keahlian || [],
                  dosen_peran: assignment.dosen.dosen_peran || [],
                  peran_utama: assignment.dosen.peran_utama,
                  peran_kurikulum_mengajar:
                    assignment.dosen.peran_kurikulum_mengajar,
                })
              );
            });

            setAssignedDosen(convertedData);

            // PERBAIKAN BARU: Cek apakah sudah ada data yang di-generate setelah setAssignedDosen
            setTimeout(() => {
              checkHasGeneratedData();
            }, 100);
          } else {
            setAssignedDosen({});
          }

          // PERBAIKAN: Update role assignments untuk UI coloring saat data di-load
          const newRoleAssignments: {
            [pblId: number]: { koordinator?: number[]; timBlok?: number[] };
          } = {};

          // Iterate through assigned dosen data to determine roles
          Object.entries(assignedRes.data.data || {}).forEach(
            ([pblIdStr, assignedDosenList]: [string, any]) => {
              const pblId = parseInt(pblIdStr);
              if (
                pblId &&
                assignedDosenList &&
                Array.isArray(assignedDosenList)
              ) {
                assignedDosenList.forEach((dosen: any) => {
                  // Gunakan role dari backend alih-alih pbl_role
                  const pblRole = dosen.role || "dosen_mengajar";

                  if (pblRole === "koordinator" || pblRole === "tim_blok") {
                    if (!newRoleAssignments[pblId]) {
                      newRoleAssignments[pblId] = {};
                    }

                    if (pblRole === "koordinator") {
                      if (!newRoleAssignments[pblId].koordinator) {
                        newRoleAssignments[pblId].koordinator = [];
                      }
                      if (
                        !newRoleAssignments[pblId].koordinator!.includes(
                          dosen.dosen.id
                        )
                      ) {
                        newRoleAssignments[pblId].koordinator!.push(
                          dosen.dosen.id
                        );
                      }
                    } else if (pblRole === "tim_blok") {
                      if (!newRoleAssignments[pblId].timBlok) {
                        newRoleAssignments[pblId].timBlok = [];
                      }
                      if (
                        !newRoleAssignments[pblId].timBlok!.includes(
                          dosen.dosen.id
                        )
                      ) {
                        newRoleAssignments[pblId].timBlok!.push(dosen.dosen.id);
                      }
                    }
                  }
                });
              }
            }
          );

          setRoleAssignments(newRoleAssignments);
        } catch (error) {
          setAssignedDosen({});
        }
      } else {
        setAssignedDosen({});
      }
    } catch (err) {
      setError("Gagal memuat data PBL/dosen");
      setBlokMataKuliah([]);
      setPblData({});
      setDosenList([]);
      setAssignedDosen({});
    } finally {
      setLoading(false);
    }
  }

  // PERBAIKAN: Fungsi untuk menghitung warning seperti PBLGenerate.tsx
  const calculateWarnings = (
    mataKuliahList: MataKuliah[],
    dosenList: Dosen[],
    kelompokKecilList: any[]
  ) => {
    const newWarnings: string[] = [];

    // Loop untuk setiap semester
    const semesters = [1, 3, 5, 7]; // Semester Ganjil

    for (const semester of semesters) {
      // Cari mata kuliah untuk semester ini
      const mkInSemester = mataKuliahList.filter(
        (mk) => String(mk.semester) === String(semester)
      );

      if (mkInSemester.length === 0) {
        continue;
      }

      // Cari semua PBL untuk semester ini
      const allPBLs: any[] = [];
      for (const mk of mkInSemester) {
        const pbls = pblData[mk.kode] || [];
        for (const pbl of pbls) {
          allPBLs.push({ mk, pbl });
        }
      }

      if (allPBLs.length === 0) {
        continue;
      }

      // RUMUS: Kelompok × Modul = Total Dosen Required
      const totalModul = allPBLs.length;
      const totalKelompok = (() => {
        const semesterKey = String(semester);
        // PERBAIKAN: Gunakan kelompokKecilListBySemester seperti di PBLGenerate.tsx
        const semesterData = kelompokKecilListBySemester[semesterKey] || [];
        const uniqueKelompok = new Set(
          semesterData.map((item: any) => item.nama_kelompok)
        );
        return uniqueKelompok.size;
      })();

      const totalDosenRequired = totalKelompok * totalModul;

      // CARI KOORDINATOR (dari dosen_peran dengan tipe_peran = koordinator)
      const koordinatorForSemester = dosenList.filter((dosen) => {
        return dosen.dosen_peran?.some(
          (peran: any) =>
            peran.tipe_peran === "koordinator" &&
            peran.semester === String(semester) &&
            mkInSemester.some((mk) => mk.kode === peran.mata_kuliah_kode)
        );
      });

      // CARI TIM BLOK (dari dosen_peran dengan tipe_peran = tim_blok)
      const timBlokForSemester = dosenList.filter((dosen) => {
        return dosen.dosen_peran?.some(
          (peran: any) =>
            peran.tipe_peran === "tim_blok" &&
            peran.semester === String(semester) &&
            mkInSemester.some((mk) => mk.kode === peran.mata_kuliah_kode)
        );
      });

      // PERBAIKAN BARU: Semua dosen dihitung sama, tidak ada pengurangan Koordinator/Tim Blok
      const koordinatorCount = koordinatorForSemester.length;
      const timBlokCount = timBlokForSemester.length;
      const dosenMengajarNeeded = totalDosenRequired; // Tidak ada pengurangan

      // PERBAIKAN: Hitung dosen yang sudah di-assign sebagai Dosen Mengajar di semester ini
      const assignedDosenMengajarIds = new Set();
      for (const mk of mkInSemester) {
        const pbls = pblData[mk.kode] || [];
        for (const pbl of pbls) {
          const assignedDosenForPbl = assignedDosen[pbl.id] || [];
          for (const assignedD of assignedDosenForPbl) {
            // Cek apakah dosen ini adalah Dosen Mengajar (bukan Koordinator/Tim Blok)
            const isKoordinatorOrTimBlok = assignedD.dosen_peran?.some(
              (peran: any) =>
                (peran.tipe_peran === "koordinator" ||
                  peran.tipe_peran === "tim_blok") &&
                peran.semester === String(semester) &&
                mkInSemester.some((mk) => mk.kode === peran.mata_kuliah_kode)
            );

            if (!isKoordinatorOrTimBlok) {
              assignedDosenMengajarIds.add(assignedD.id);
            }
          }
        }
      }

      // Cari dosen yang punya keahlian sesuai (termasuk yang sudah di-assign)
      const dosenMengajar = dosenList.filter((dosen) => {
        // PERBAIKAN: Kecualikan dosen yang sudah menjadi Koordinator atau Tim Blok
        const isKoordinatorOrTimBlok = dosen.dosen_peran?.some(
          (peran: any) =>
            (peran.tipe_peran === "koordinator" ||
              peran.tipe_peran === "tim_blok") &&
            peran.semester === String(semester) &&
            mkInSemester.some((mk) => mk.kode === peran.mata_kuliah_kode)
        );

        if (isKoordinatorOrTimBlok) {
          return false;
        }

        // Pastikan punya keahlian
        if (!dosen.keahlian) {
          return false;
        }

        // Handle jika keahlian bukan array
        let keahlianArray = [];
        if (Array.isArray(dosen.keahlian)) {
          keahlianArray = dosen.keahlian;
        } else if (typeof dosen.keahlian === "string") {
          keahlianArray = [dosen.keahlian];
        } else {
          return false;
        }

        if (keahlianArray.length === 0) {
          return false;
        }

        // Cek apakah keahlian dosen cocok dengan yang dibutuhkan
        const hasMatchingKeahlian = mkInSemester.some((mk) => {
          // Handle jika keahlian_required bukan array
          let keahlianRequiredArray = [];
          if (Array.isArray(mk.keahlian_required)) {
            keahlianRequiredArray = mk.keahlian_required;
          } else if (typeof mk.keahlian_required === "string") {
            keahlianRequiredArray = [mk.keahlian_required];
          } else {
            return false;
          }

          if (keahlianRequiredArray.length === 0) {
            return false;
          }

          const hasMatch = keahlianRequiredArray.some((keahlian) => {
            return keahlianArray.includes(keahlian);
          });

          return hasMatch;
        });

        return hasMatchingKeahlian;
      });

      // PERBAIKAN BARU: Hitung dosen mengajar yang sudah di-assign
      const assignedDosenMengajarCount = assignedDosenMengajarIds.size;

      // PERBAIKAN BARU: Cek kekurangan dosen berdasarkan totalDosenRequired
      if (assignedDosenMengajarCount < totalDosenRequired) {
        const kekurangan = totalDosenRequired - assignedDosenMengajarCount;
        const keahlianRequired = mkInSemester
          .map((mk) => mk.keahlian_required)
          .flat()
          .filter(Boolean);

        const warningMessage = `Semester ${semester} kekurangan ${kekurangan} dosen dengan keahlian: ${keahlianRequired.join(
          ", "
        )} (dibutuhkan ${totalDosenRequired} dosen dari ${totalDosenRequired} total dosen)`;

        newWarnings.push(warningMessage);
      } else if (totalDosenRequired > 0 && assignedDosenMengajarCount === 0) {
        const keahlianRequired = mkInSemester
          .map((mk) => mk.keahlian_required)
          .flat()
          .filter(Boolean);

        const warningMessage = `Semester ${semester} tidak memiliki dosen dengan keahlian: ${keahlianRequired.join(
          ", "
        )} (dibutuhkan ${totalDosenRequired} dosen dari ${totalDosenRequired} total dosen)`;

        newWarnings.push(warningMessage);
      }
    }

    // PERBAIKAN: Gunakan setWarnings dengan filter seperti PBLGenerate.tsx
    setWarnings((prev) => {
      // Hapus semua warning lama
      const filtered = prev.filter((w) => !w.includes("Semester"));

      // Hapus semua warning terkait peran tidak cocok karena validasi peran sudah dihapus
      const filteredPeranWarnings = filtered.filter((w) => {
        return !(
          w.includes("peran tidak cocok") || w.includes("peran yang sesuai")
        );
      });

      // Tambahkan warning baru
      return [...filteredPeranWarnings, ...newWarnings];
    });
  };

  // PERBAIKAN BARU: Fungsi untuk menghitung ulang warning secara real-time
  const recalculateWarnings = useCallback(() => {
    if (blokMataKuliah.length === 0 || dosenList.length === 0) {
      return;
    }

    // Filter mata kuliah berdasarkan activeSemesterJenis dan blokId
    let filteredBlokMataKuliah = blokMataKuliah;
    if (blokId) {
      filteredBlokMataKuliah = blokMataKuliah.filter(
        (mk: MataKuliah) => String(mk.blok) === String(blokId)
      );
    }

    if (activeSemesterJenis) {
      filteredBlokMataKuliah = filteredBlokMataKuliah.filter(
        (mk: MataKuliah) =>
          mk.periode &&
          mk.periode.trim().toLowerCase() ===
            activeSemesterJenis.trim().toLowerCase()
      );
    }

    // PERBAIKAN: Gunakan kelompokKecilListBySemester untuk perhitungan yang akurat
    const allKelompokKecil = Object.values(kelompokKecilListBySemester).flat();

    // Hitung warning dengan data terbaru
    calculateWarnings(filteredBlokMataKuliah, dosenList, allKelompokKecil);
  }, [
    blokMataKuliah,
    dosenList,
    kelompokKecilListBySemester,
    activeSemesterJenis,
    blokId,
  ]);

  // Function to calculate statistics
  const calculateStatistics = (
    mataKuliahList: MataKuliah[],
    dosenList: Dosen[],
    kelompokKecilList: any[],
    activeSemester: string | null = null,
    filterBlok: string = "semua"
  ) => {
    // Use provided activeSemester or fall back to activeSemesterJenis
    const currentActiveSemester = activeSemester || activeSemesterJenis;

    // Filter mata kuliah berdasarkan data yang ditampilkan di halaman ini
    // Gunakan blokMataKuliahFiltered yang sudah difilter berdasarkan blokId dan activeSemester
    let filteredMataKuliah = mataKuliahList;

    // Filter berdasarkan active semester
    if (currentActiveSemester) {
      filteredMataKuliah = filteredMataKuliah.filter(
        (mk: MataKuliah) =>
          mk.periode &&
          mk.periode.trim().toLowerCase() ===
            currentActiveSemester.trim().toLowerCase()
      );
    }

    // Filter berdasarkan blokId jika ada
    if (blokId) {
      filteredMataKuliah = filteredMataKuliah.filter(
        (mk: MataKuliah) => String(mk.blok) === String(blokId)
      );
    }

    // Calculate kelompok kecil count (unique nama_kelompok for active semester)
    const kelompokKecilForSemester = kelompokKecilList.filter(
      (kk: any) =>
        mapSemesterToNumber(kk.semester) ===
        mapSemesterToNumber(currentActiveSemester)
    );
    const uniqueKelompok = new Set(
      kelompokKecilForSemester.map((kk: any) => kk.nama_kelompok)
    );
    setKelompokKecilCount(uniqueKelompok.size);

    // Calculate keahlian count (total keahlian required from mata kuliah, including duplicates)
    let totalKeahlianCount = 0;

    // Pastikan menggunakan mata kuliah yang sudah difilter dengan benar
    const mataKuliahForKeahlian = filteredMataKuliah;

    mataKuliahForKeahlian.forEach((mk: MataKuliah) => {
      if (mk.keahlian_required) {
        // Handle both array and JSON string
        let keahlianArray: string[] = [];
        if (Array.isArray(mk.keahlian_required)) {
          keahlianArray = mk.keahlian_required;
        } else if (typeof mk.keahlian_required === "string") {
          try {
            keahlianArray = JSON.parse(mk.keahlian_required);
          } catch (e) {
            // If parsing fails, treat as single string
            keahlianArray = [mk.keahlian_required];
          }
        }

        // Count total keahlian (including duplicates)
        totalKeahlianCount += keahlianArray.length;
      }
    });
    setKeahlianCount(totalKeahlianCount);

    // Calculate total kelompok kecil from all active semesters (hanya untuk mata kuliah yang ditampilkan)
    const allKelompokKecil = kelompokKecilList || [];
    const uniqueAllKelompok = new Set();

    // Hanya hitung kelompok kecil untuk mata kuliah yang ditampilkan
    filteredMataKuliah.forEach((mk) => {
      // Gunakan semester dari mata kuliah untuk mencari kelompok kecil
      const kelompokForMk = allKelompokKecil.filter(
        (kk: any) => mapSemesterToNumber(kk.semester) === mk.semester
      );
      kelompokForMk.forEach((kk: any) => {
        uniqueAllKelompok.add(`${kk.semester}__${kk.nama_kelompok}`);
      });
    });

    // Jika tidak ada kelompok kecil yang ditemukan, coba hitung berdasarkan semester aktif
    if (uniqueAllKelompok.size === 0 && currentActiveSemester) {
      const semesterNumber = mapSemesterToNumber(currentActiveSemester);
      if (semesterNumber) {
        const kelompokForSemester = allKelompokKecil.filter(
          (kk: any) => mapSemesterToNumber(kk.semester) === semesterNumber
        );
        kelompokForSemester.forEach((kk: any) => {
          uniqueAllKelompok.add(`${kk.semester}__${kk.nama_kelompok}`);
        });
      }
    }

    setTotalKelompokKecilAllSemester(uniqueAllKelompok.size);

    // Calculate dosen counts from generated assignments (pbl_mappings) per mata kuliah
    let peranKetuaCount = 0;
    let peranAnggotaCount = 0;
    let dosenMengajarCount = 0;

    // Track unique dosen per mata kuliah to avoid duplicates
    const dosenPerMataKuliah = new Map<string, Set<number>>();

    // Loop through all PBLs for the filtered mata kuliah
    filteredMataKuliah.forEach((mk) => {
      const pblsForMk = pblData[mk.kode] || [];
      const uniqueDosenForMk = new Set<number>();

      pblsForMk.forEach((pbl) => {
        if (pbl.id) {
          const assignedDosenForPbl = assignedDosen[pbl.id] || [];

          assignedDosenForPbl.forEach((dosen) => {
            // Only count each dosen once per mata kuliah
            if (!uniqueDosenForMk.has(dosen.id)) {
              uniqueDosenForMk.add(dosen.id);

              // Check if this dosen has a role in dosen_peran
              if (dosen.dosen_peran && Array.isArray(dosen.dosen_peran)) {
                const relevantPeran = dosen.dosen_peran.find((peran: any) => {
                  const match =
                    (peran.mata_kuliah_kode === mk.kode ||
                      peran.mata_kuliah_nama === mk.nama) &&
                    mapSemesterToNumber(peran.semester) === mk.semester;

                  return match;
                });

                if (relevantPeran) {
                  if (relevantPeran.tipe_peran === "koordinator") {
                    peranKetuaCount++;
                  } else if (relevantPeran.tipe_peran === "tim_blok") {
                    peranAnggotaCount++;
                  } else {
                    // If role is not koordinator or tim_blok, count as Dosen Mengajar
                    dosenMengajarCount++;
                  }
                } else {
                  // If no specific role found, count as Dosen Mengajar
                  dosenMengajarCount++;
                }
              } else {
                // If no dosen_peran, count as Dosen Mengajar
                dosenMengajarCount++;
              }
            }
          });
        }
      });

      // Store unique dosen for this mata kuliah
      dosenPerMataKuliah.set(mk.kode, uniqueDosenForMk);
    });

    // Debug: Log the counts to see what's happening

    // Debug: Log sample data
    if (filteredMataKuliah.length > 0) {
      const sampleMk = filteredMataKuliah[0];

      if (pblData[sampleMk.kode] && pblData[sampleMk.kode].length > 0) {
        const samplePbl = pblData[sampleMk.kode][0];

        if (samplePbl.id) {
        }
      }
    }

    setPeranKetuaCount(peranKetuaCount);
    setPeranAnggotaCount(peranAnggotaCount);
    setDosenMengajarCount(dosenMengajarCount);
  };
  // Validasi generate status saat component mount
  useEffect(() => {
    const validateAndFetch = async () => {
      const isValid = await validateGenerateStatus();
      if (isValid) {
        fetchAll();
      }
    };

    validateAndFetch();
  }, [blokId]);

  useEffect(() => {
    if (!isGenerateValidated) return;

    fetchAll();

    // Listen for PBL generation completion
    const handlePblGenerateCompleted = () => {
      fetchAll();
    };

    // Listen for PBL assignment updates
    const handlePblAssignmentUpdated = () => {
      fetchAll();
    };

    window.addEventListener(
      "pbl-generate-completed",
      handlePblGenerateCompleted
    );
    window.addEventListener(
      "pbl-assignment-updated",
      handlePblAssignmentUpdated
    );

    return () => {
      window.removeEventListener(
        "pbl-generate-completed",
        handlePblGenerateCompleted
      );
      window.removeEventListener(
        "pbl-assignment-updated",
        handlePblAssignmentUpdated
      );
    };
  }, [isGenerateValidated]);

  // Recalculate statistics when active semester changes or assignedDosen changes
  useEffect(() => {
    if (blokMataKuliah.length > 0 && dosenList.length > 0) {
      // We need to fetch kelompok kecil data again since it depends on active semester
      api
        .get("/kelompok-kecil")
        .then((kelompokKecilRes) => {
          // Gunakan data yang sama dengan PBLGenerate.tsx
          let filteredBlokMataKuliah = blokMataKuliah;
          if (blokId) {
            filteredBlokMataKuliah = blokMataKuliah.filter(
              (mk: MataKuliah) => String(mk.blok) === String(blokId)
            );
          }

          calculateStatistics(
            filteredBlokMataKuliah,
            dosenList,
            kelompokKecilRes.data || [],
            activeSemesterJenis,
            blokId || "semua"
          );

          // PERBAIKAN: Hitung kekurangan dosen dan warning seperti PBLGenerate.tsx
          calculateWarnings(
            filteredBlokMataKuliah,
            dosenList,
            kelompokKecilRes.data || []
          );
        })
        .catch(() => {
          let filteredBlokMataKuliah = blokMataKuliah;
          if (blokId) {
            filteredBlokMataKuliah = blokMataKuliah.filter(
              (mk: MataKuliah) => String(mk.blok) === String(blokId)
            );
          }

          // Fetch kelompok kecil data untuk perhitungan statistik
          api.get("/kelompok-kecil").then((kelompokKecilRes) => {
            calculateStatistics(
              filteredBlokMataKuliah,
              dosenList,
              kelompokKecilRes.data || [],
              activeSemesterJenis,
              blokId || "semua"
            );

            // PERBAIKAN: Hitung kekurangan dosen dan warning seperti PBLGenerate.tsx
            calculateWarnings(
              filteredBlokMataKuliah,
              dosenList,
              kelompokKecilRes.data || []
            );
          });
        });
    }
  }, [
    activeSemesterJenis,
    blokMataKuliah,
    dosenList,
    filterBlok,
    filterSemester,
    blokId,
    assignedDosen,
  ]);

  useEffect(() => {
    async function fetchKelompokKecil() {
      try {
        // Fetch kelompok kecil yang tersedia untuk PBL (tidak digunakan oleh mata kuliah lain)
        const kelompokRes = await api.get("/pbl-kelompok-kecil/available");
        setKelompokKecilList(kelompokRes.data || []);
      } catch (error) {
        setKelompokKecilList([]);
      }
    }
    fetchKelompokKecil();
  }, []);

  // Refactor fetchBatchMapping dan fetchBatchKelompokDetail ke fungsi terpisah agar bisa dipanggil ulang
  const fetchBatchMapping = async (semester: number | null) => {
    if (!blokMataKuliah.length || !semester) return;
    const semesterKey = String(semester); // ensure string key
    try {
      const kodeList = blokMataKuliah.map((mk) => mk.kode);
      const res = await api.post("/mata-kuliah/pbl-kelompok-kecil/batch", {
        mata_kuliah_kode: kodeList,
        semester: semesterKey,
      });
      setBlokKelompokBySemester((prev) => ({
        ...prev,
        [semesterKey]: res.data,
      }));
    } catch {
      // do not clear previous state
    }
  };
  const fetchBatchKelompokDetail = async (semester: number | null) => {
    if (!semester) {
      setKelompokKecilDetailList([]);
      return;
    }
    const semesterKey = String(semester);
    const allNamaKelompok = blokKelompokBySemester[semesterKey]
      ? Object.values(blokKelompokBySemester[semesterKey]).flat()
      : [];
    if (!allNamaKelompok.length) {
      setKelompokKecilDetailList([]);
      return;
    }
    try {
      const res = await api.post("/kelompok-kecil/batch-detail", {
        nama_kelompok: allNamaKelompok,
        semester: semesterKey,
      });
      setKelompokKecilDetailList(res.data || []);
    } catch {
      setKelompokKecilDetailList([]);
    }
  };

  // Ganti useEffect lama agar pakai fungsi baru
  useEffect(() => {
    const semesterRaw =
      filterSemester === "semua" ? activeSemesterJenis || null : filterSemester;
    const semester = mapSemesterToNumber(semesterRaw);
    fetchBatchMapping(semester);
  }, [blokMataKuliah, filterSemester, activeSemesterJenis]);
  useEffect(() => {
    const semesterRaw =
      filterSemester === "semua" ? activeSemesterJenis || null : filterSemester;
    const semester = mapSemesterToNumber(semesterRaw);
    fetchBatchKelompokDetail(semester);
  }, [blokKelompokBySemester, filterSemester, activeSemesterJenis]);

  useEffect(() => {
    // Fetch semester aktif
    const fetchActiveSemester = async () => {
      try {
        const res = await api.get("/tahun-ajaran/active");
        const semester = res.data?.semesters?.[0];
        if (semester && semester.jenis) {
          setActiveSemesterJenis(semester.jenis);
        } else {
          setActiveSemesterJenis(null);
        }
      } catch {
        setActiveSemesterJenis(null);
      }
    };
    fetchActiveSemester();
  }, []);

  useEffect(() => {
    // Loop semua semester yang sudah ada batch mapping-nya
    Object.keys(blokKelompokBySemester).forEach((semesterKey) => {
      if (
        blokKelompokBySemester[semesterKey] &&
        Object.keys(blokKelompokBySemester[semesterKey]).length > 0 &&
        !kelompokKecilListBySemester[semesterKey]
      ) {
        // Fetch detail kelompok kecil untuk semester ini jika belum ada
        fetchKelompokKecilWithStatus(semesterKey);
      }
    });
  }, [blokKelompokBySemester]);

  // Fetch kelompok kecil untuk semua semester yang ditampilkan
  useEffect(() => {
    // Dapatkan semua semester yang ada di blokMataKuliah
    const allSemesters = Array.from(
      new Set(blokMataKuliah.map((mk) => mk.semester))
    ).sort((a, b) => a - b);

    // Fetch kelompok kecil untuk setiap semester yang belum ada datanya
    allSemesters.forEach((semester) => {
      const semesterKey = String(semester);
      if (!kelompokKecilListBySemester[semesterKey]) {
        fetchKelompokKecilWithStatus(semester);
      }
    });
  }, [blokMataKuliah, kelompokKecilListBySemester]);

  // Fetch kelompok kecil untuk semester tertentu (bukan hanya semester aktif)
  const fetchKelompokKecilWithStatus = async (semester: string | number) => {
    const semesterStr = mapSemesterToNumber(semester);
    if (!semesterStr) return;
    setKelompokKecilListBySemester((prev) => ({ ...prev, [semesterStr]: [] })); // Reset sebelum fetch baru
    if (kelompokKecilCache[semesterStr]) {
      setKelompokKecilListBySemester((prev) => ({
        ...prev,
        [semesterStr]: kelompokKecilCache[semesterStr],
      }));
      return;
    }
    try {
      const res = await api.get(
        `/pbl-kelompok-kecil/list?semester=${semesterStr}`
      );
      setKelompokKecilListBySemester((prev) => ({
        ...prev,
        [semesterStr]: res.data || [],
      }));
      setKelompokKecilCache((prev) => ({
        ...prev,
        [semesterStr]: res.data || [],
      }));
    } catch {
      setKelompokKecilListBySemester((prev) => ({
        ...prev,
        [semesterStr]: [],
      }));
    }
  };

  // Saat klik tombol Pilih Kelompok
  const handleOpenKelompokModal = (blokKode: string) => {
    setShowKelompokModal(blokKode);
    // Cari semester dari blokMataKuliah
    const mk = blokMataKuliah.find((mk) => mk.kode === blokKode);
    const semesterKey = mk ? String(mk.semester) : "";
    setSelectedKelompok(blokKelompokBySemester[semesterKey]?.[blokKode] || []);
    if (mk) {
      fetchKelompokKecilWithStatus(mk.semester);
    }
  };

  // Saat simpan di modal, update database dan state
  const handleSimpanKelompok = async () => {
    if (showKelompokModal) {
      setIsSavingKelompok(true);
      try {
        const mk = blokMataKuliah.find((mk) => mk.kode === showKelompokModal);

        // Mapping sudah otomatis dibuat saat kelompok kecil dibuat
        // Tidak perlu manual mapping lagi

        setShowKelompokModal(null);
        setShowToast(true);
        setTimeout(() => setShowToast(false), 2500);

        // Refresh data mapping
        const semesterKey = mk ? String(mk.semester) : "";
        await fetchBatchMapping(mk?.semester || null);
        await fetchBatchKelompokDetail(mk?.semester || null);
      } catch (error: unknown) {
        alert("Gagal menyimpan mapping kelompok");
      } finally {
        setIsSavingKelompok(false);
      }
    }
  };

  // Saat batal di modal
  const handleBatalKelompok = () => {
    setShowKelompokModal(null);
  };

  const handleClearCache = () => {
    setShowClearCacheModal(true);
  };

  const handleConfirmClearCache = () => {
    // Refresh dari API (tidak ada localStorage lagi)
    if (blokId) {
      validateGenerateStatus();
    }
    setShowClearCacheModal(false);
  };

  const handleCancelClearCache = () => {
    setShowClearCacheModal(false);
  };

  const handleLihatMahasiswa = async (kelompok: KelompokKecil) => {
    try {
      // Fetch mahasiswa dari kelompok kecil berdasarkan semester aktif
      const semesterRes = await api.get("/tahun-ajaran/active");
      const semester = semesterRes.data?.semesters?.[0]?.jenis;

      if (!semester) {
        alert("Tidak ada semester aktif");
        return;
      }

      // Fetch mahasiswa dari kelompok kecil
      const mahasiswaRes = await api.get(
        `/kelompok-kecil/${kelompok.id}/mahasiswa`
      );
      const mahasiswa = mahasiswaRes.data || [];

      setShowMahasiswaModal({ kelompok, mahasiswa });
    } catch (error) {
      alert("Gagal memuat data mahasiswa");
    }
  };

  // Filter for single blok if blokId param exists or filterBlok is set
  let blokMataKuliahFilteredByBlok = blokMataKuliah || [];
  if (blokId) {
    blokMataKuliahFilteredByBlok = (blokMataKuliah || []).filter(
      (mk: MataKuliah) => String(mk.blok) === String(blokId)
    );
  } else if (filterBlok !== "semua") {
    blokMataKuliahFilteredByBlok = (blokMataKuliah || []).filter(
      (mk: MataKuliah) => String(mk.blok) === String(filterBlok)
    );
  }

  // Group blokMataKuliah by semester, filter by activeSemesterJenis
  const blokMataKuliahFiltered = activeSemesterJenis
    ? (blokMataKuliahFilteredByBlok || []).filter(
        (mk: MataKuliah) =>
          mk.periode &&
          mk.periode.trim().toLowerCase() ===
            activeSemesterJenis.trim().toLowerCase()
      )
    : blokMataKuliahFilteredByBlok || [];
  const groupedBySemester = (blokMataKuliahFiltered || []).reduce(
    (acc: Record<number, MataKuliah[]>, mk: MataKuliah) => {
      if (!acc[mk.semester]) acc[mk.semester] = [];
      acc[mk.semester].push(mk);
      return acc;
    },
    {}
  );

  // Function to calculate comprehensive detail statistics
  const calculateDetailStatistics = useCallback(() => {
    if (blokMataKuliahFilteredByBlok.length === 0 || dosenList.length === 0) {
      return;
    }

    // Calculate total PBLs in this blok
    const totalPBLs = blokMataKuliahFilteredByBlok.reduce(
      (acc, mk) => acc + (pblData[mk.kode]?.length || 0),
      0
    );

    // Calculate assignments
    const totalAssignments = Object.values(assignedDosen).flat().length;
    const blokCompletionRate =
      totalPBLs > 0 ? (totalAssignments / totalPBLs) * 100 : 0;
    const unassignedPBLCount = totalPBLs - totalAssignments;

    // Calculate dosen per blok
    const assignedDosenSet = new Set(
      Object.values(assignedDosen)
        .flat()
        .map((d) => d.id)
    );
    const dosenPerBlok = assignedDosenSet.size;

    // Calculate modul per blok
    const modulPerBlok = totalPBLs;

    // Calculate keahlian coverage
    const allRequiredKeahlian = new Set<string>();
    blokMataKuliahFilteredByBlok.forEach((mk) => {
      const keahlian = parseKeahlian(mk.keahlian_required);
      keahlian.forEach((k) => allRequiredKeahlian.add(k.toLowerCase()));
    });

    const coveredKeahlian = new Set<string>();
    Object.values(assignedDosen)
      .flat()
      .forEach((dosen) => {
        const dosenKeahlian = parseKeahlian(dosen.keahlian);
        dosenKeahlian.forEach((k) => {
          allRequiredKeahlian.forEach((req) => {
            if (
              k.toLowerCase().includes(req) ||
              req.includes(k.toLowerCase())
            ) {
              coveredKeahlian.add(req);
            }
          });
        });
      });

    const keahlianCoverage =
      allRequiredKeahlian.size > 0
        ? (coveredKeahlian.size / allRequiredKeahlian.size) * 100
        : 0;

    // Calculate assignment success rate
    const assignmentSuccessRate =
      totalPBLs > 0 ? (totalAssignments / totalPBLs) * 100 : 0;

    // Calculate dosen efficiency (average assignments per dosen)
    const dosenEfficiency =
      dosenPerBlok > 0 ? totalAssignments / dosenPerBlok : 0;

    // Calculate keahlian utilization per modul (mata kuliah)
    let keahlianMatches = 0;
    let totalModulChecks = 0;

    blokMataKuliahFilteredByBlok.forEach((mk) => {
      const pbls = pblData[mk.kode] || [];
      if (pbls.length > 0) {
        totalModulChecks++;

        // Cek apakah modul ini memiliki dosen dengan keahlian yang sesuai
        const hasMatch = pbls.some((pbl) => {
          const assigned = assignedDosen[pbl.id!] || [];
          return assigned.some((dosen) => {
            const dosenKeahlian = parseKeahlian(dosen.keahlian);
            const requiredKeahlian = parseKeahlian(mk.keahlian_required);
            return requiredKeahlian.some((req) =>
              dosenKeahlian.some(
                (dk) =>
                  dk.toLowerCase().includes(req.toLowerCase()) ||
                  req.toLowerCase().includes(dk.toLowerCase())
              )
            );
          });
        });

        if (hasMatch) keahlianMatches++;
      }
    });
    const keahlianUtilization =
      totalModulChecks > 0 ? (keahlianMatches / totalModulChecks) * 100 : 0;

    // Calculate assignment distribution from assignedDosen data (real generated assignments)
    const assignmentDistribution = {
      koordinator: 0,
      timBlok: 0,
      dosenMengajar: 0,
    };

    // Hitung per semester untuk menghindari duplikasi dosen
    const processedDosen = new Set<number>();

    // Group by semester
    const groupedBySemester = blokMataKuliahFilteredByBlok.reduce((acc, mk) => {
      if (!acc[mk.semester]) {
        acc[mk.semester] = [];
      }
      acc[mk.semester].push(mk);
      return acc;
    }, {} as { [key: number]: typeof blokMataKuliahFilteredByBlok });

    Object.entries(groupedBySemester).forEach(([semester, mataKuliahList]) => {
      const semesterNumber = parseInt(semester);

      // Hitung dosen yang sudah di-assign untuk semester ini (unik per dosen)
      const assignedDosenSet = new Set<number>();
      mataKuliahList.forEach((mk) => {
        const pbls = pblData[mk.kode] || [];
        pbls.forEach((pbl) => {
          if (pbl.id && assignedDosen[pbl.id]?.length > 0) {
            assignedDosen[pbl.id].forEach((d) => assignedDosenSet.add(d.id));
          }
        });
      });

      // Hitung distribution untuk semester ini (unik per dosen)
      assignedDosenSet.forEach((dosenId) => {
        if (!processedDosen.has(dosenId)) {
          processedDosen.add(dosenId);

          // Cari dosen dari assignedDosen data
          let dosenRole = "dosen_mengajar"; // default

          // Cari peran dosen dari assignedDosen data
          Object.values(assignedDosen).forEach((assignedDosenList) => {
            assignedDosenList.forEach((dosen) => {
              if (dosen.id === dosenId) {
                dosenRole = dosen.pbl_role || "dosen_mengajar";
              }
            });
          });

          // Hitung berdasarkan peran yang benar (unik per dosen per semester)
          if (dosenRole === "koordinator") {
            assignmentDistribution.koordinator++;
          } else if (dosenRole === "tim_blok") {
            assignmentDistribution.timBlok++;
          } else {
            assignmentDistribution.dosenMengajar++;
          }
        }
      });
    });

    // Calculate tim blok vs dosen mengajar ratio
    const timBlokVsDosenMengajarRatio =
      assignmentDistribution.dosenMengajar > 0
        ? assignmentDistribution.timBlok / assignmentDistribution.dosenMengajar
        : 0;

    // Calculate dosen utilization rate (per semester)
    const totalDosen = dosenList.length;
    const dosenUtilizationRate =
      totalDosen > 0 ? (assignedDosenSet.size / totalDosen) * 100 : 0;

    // Calculate data freshness
    const now = new Date();
    const lastGenerate = pblDetailStatistics.lastGenerateTime
      ? new Date(pblDetailStatistics.lastGenerateTime)
      : null;
    let dataFreshness: "fresh" | "stale" | "outdated" = "fresh";

    if (lastGenerate) {
      const diffHours =
        (now.getTime() - lastGenerate.getTime()) / (1000 * 60 * 60);
      if (diffHours > 24) dataFreshness = "outdated";
      else if (diffHours > 6) dataFreshness = "stale";
    }

    // Calculate cache status
    let cacheStatus: "clean" | "dirty" | "needs_refresh" = "clean";
    if (hasGeneratedData && !isGenerateValidated) {
      cacheStatus = "needs_refresh";
    } else if (warnings.length > 0) {
      cacheStatus = "dirty";
    }

    // Calculate dosen overload count
    const dosenAssignmentCount: Record<number, number> = {};
    Object.values(assignedDosen)
      .flat()
      .forEach((dosen) => {
        dosenAssignmentCount[dosen.id] =
          (dosenAssignmentCount[dosen.id] || 0) + 1;
      });
    const dosenOverloadCount = Object.values(dosenAssignmentCount).filter(
      (count) => count > 3
    ).length;

    // Calculate standby dosen usage
    const standbyDosenUsage = Object.values(assignedDosen)
      .flat()
      .filter((dosen) => {
        const keahlian = parseKeahlian(dosen.keahlian);
        return keahlian.some((k) => k.toLowerCase().includes("standby"));
      }).length;

    const nextStats = {
      blokCompletionRate,
      dosenPerBlok,
      modulPerBlok,
      keahlianCoverage,
      assignmentSuccessRate,
      dosenEfficiency,
      keahlianUtilization,
      timBlokVsDosenMengajarRatio,
      lastGenerateTime: pblDetailStatistics.lastGenerateTime,
      dataFreshness,
      warningCount: warnings.length,
      cacheStatus,
      keahlianMatchRate: keahlianUtilization,
      dosenOverloadCount,
      unassignedPBLCount,
      standbyDosenUsage,
      // Add new statistics
      totalAssignments: assignedDosenSet.size,
      assignmentRate: blokCompletionRate,
      dosenUtilizationRate,
      assignmentDistribution,
    } as typeof pblDetailStatistics;

    try {
      const isEqual =
        JSON.stringify(pblStatsRef.current) === JSON.stringify(nextStats);
      if (!isEqual) {
        setPblDetailStatistics(nextStats);
      }
    } catch {
      setPblDetailStatistics(nextStats);
    }
  }, [
    blokMataKuliahFilteredByBlok,
    dosenList,
    pblData,
    assignedDosen,
    hasGeneratedData,
    isGenerateValidated,
    warnings.length,
    pblDetailStatistics.lastGenerateTime,
  ]);

  // Calculate detail statistics when data changes
  useEffect(() => {
    if (blokMataKuliahFilteredByBlok.length > 0 && dosenList.length > 0) {
      calculateDetailStatistics();
    }
  }, [
    blokMataKuliahFilteredByBlok,
    dosenList,
    assignedDosen,
    hasGeneratedData,
    isGenerateValidated,
    warnings.length,
    pblDetailStatistics.lastGenerateTime,
  ]);
  const sortedSemesters = Object.keys(groupedBySemester || {})
    .map(Number)
    .sort((a, b) => a - b);

  // Semester options
  const semesterOptions = sortedSemesters;

  // Blok options - get unique blok numbers from mata kuliah
  const blokOptions = Array.from(
    new Set(
      (blokMataKuliah || [])
        .map((mk) => mk.blok)
        .filter((blok) => blok !== null)
        .sort((a, b) => (a || 0) - (b || 0))
    )
  );

  // Filtered semester list
  const filteredSemesters =
    filterSemester === "semua"
      ? sortedSemesters || []
      : (sortedSemesters || []).filter(
          (s: number) => String(s) === String(filterSemester)
        );

  // Filtered mata kuliah by search & status
  const filterMataKuliah = (mkList: MataKuliah[]) => {
    if (!mkList || !Array.isArray(mkList)) {
      return [];
    }
    return mkList.filter((mk: MataKuliah) => {
      const matchSearch =
        mk.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
        mk.kode.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;
      if (filterStatus === "semua") return true;
      // Cek status penugasan seluruh PBL pada mk ini
      const pblList = pblData[mk.kode] || [];
      if (filterStatus === "belum") {
        return pblList.some(
          (pbl) => pbl.id && (assignedDosen[pbl.id] || []).length === 0
        );
      }
      if (filterStatus === "sudah") {
        return pblList.some(
          (pbl) => pbl.id && (assignedDosen[pbl.id] || []).length > 0
        );
      }
      return true;
    });
  };

  // Filter mata kuliah by active semester (sama seperti PBLGenerate.tsx)
  const filteredMataKuliah = activeSemesterJenis
    ? (blokMataKuliahFiltered || []).filter(
        (mk: MataKuliah) =>
          mk.periode &&
          mk.periode.trim().toLowerCase() ===
            activeSemesterJenis.trim().toLowerCase()
      )
    : blokMataKuliahFiltered || [];

  // After filtering and grouping, flatten all mkList from all semesters into a single array:
  const allFilteredMataKuliah = filteredSemesters.flatMap(
    (semester: number) => {
      const semesterMataKuliah = groupedBySemester[semester];
      if (!semesterMataKuliah) {
        return [];
      }
      return filterMataKuliah(semesterMataKuliah).map((mk: MataKuliah) => ({
        ...mk,
        semester,
      }));
    }
  );

  // Calculate statistics for filtered blok only (sama seperti PBLGenerate.tsx)
  const totalPBL = (filteredMataKuliah || []).reduce(
    (acc: number, mk: MataKuliah) => acc + (pblData[mk.kode]?.length || 0),
    0
  );
  const pblStats = (() => {
    let belum = 0,
      sudah = 0;
    (allFilteredMataKuliah || []).forEach((mk) => {
      (pblData[mk.kode] || []).forEach((pbl) => {
        const assigned = pbl.id ? assignedDosen[pbl.id] || [] : [];
        if (assigned.length > 0) sudah++;
        else belum++;
      });
    });
    return { belum, sudah };
  })();

  // Jalankan deteksi konflik saat groupedBySemester atau assignedDosen berubah
  // (Removed) Effect deteksi konflik per semester

  // --- Pagination logic (MUST be before any return) ---
  const totalPages = Math.ceil((allFilteredMataKuliah || []).length / pageSize);
  const paginatedMataKuliah = (allFilteredMataKuliah || []).slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  // Open modal for add
  const handleOpenAddModal = (kode: string | undefined) => {
    if (!kode) return;
    const usedModulKe = pblData[kode]
      ? pblData[kode].map((p) => Number(p.modul_ke)).filter((n) => !isNaN(n))
      : [];
    const nextModulKeVal =
      usedModulKe.length > 0 ? Math.max(...usedModulKe) + 1 : 1;
    setEditMode(false);
    setSelectedPBL({ kode });
    setForm({ modul_ke: String(nextModulKeVal), nama_modul: "" });
    setShowModal(true);
  };

  // Tambahkan fungsi handleEditPbl dan handleAddPbl untuk linter fix
  async function handleEditPbl() {
    if (!selectedPBL?.kode || !selectedPBL.pbl) return;
    setIsSaving(true);
    try {
      await api.put(`/pbls/${selectedPBL.pbl.id}`, {
        mata_kuliah_kode: selectedPBL.kode,
        modul_ke: form.modul_ke,
        nama_modul: form.nama_modul,
      });
      setSuccess("PBL berhasil diperbarui.");
      setShowModal(false);
      // Refresh data
      const pblRes = await api.get("/pbls/all");
      const data = pblRes.data || {};
      const blokListMapped: MataKuliah[] = Array.from(
        Object.values(data) as { mata_kuliah: MataKuliah }[]
      ).map((item) => item.mata_kuliah);
      const pblMap: Record<string, PBL[]> = {};
      Array.from(Object.entries(data) as [string, { pbls: PBL[] }][]).forEach(
        ([kode, item]) => {
          pblMap[kode] = item.pbls || [];
        }
      );
      setBlokMataKuliah(blokListMapped);
      setPblData(pblMap);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Gagal memperbarui PBL");
    } finally {
      setIsSaving(false);
    }
  }
  async function handleAddPbl() {
    if (!selectedPBL?.kode) return;
    setIsSaving(true);
    try {
      await api.post(`/mata-kuliah/${selectedPBL.kode}/pbls`, {
        modul_ke: form.modul_ke,
        nama_modul: form.nama_modul,
      });
      setSuccess("PBL berhasil ditambahkan.");
      setShowModal(false);
      // Refresh data
      const pblRes = await api.get("/pbls/all");
      const data = pblRes.data || {};
      const blokListMapped: MataKuliah[] = Array.from(
        Object.values(data) as { mata_kuliah: MataKuliah }[]
      ).map((item) => item.mata_kuliah);
      const pblMap: Record<string, PBL[]> = {};
      Array.from(Object.entries(data) as [string, { pbls: PBL[] }][]).forEach(
        ([kode, item]) => {
          pblMap[kode] = item.pbls || [];
        }
      );
      setBlokMataKuliah(blokListMapped);
      setPblData(pblMap);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Gagal menambah PBL");
    } finally {
      setIsSaving(false);
    }
  }

  // Function untuk update reporting data secara real-time
  const updateReportingData = async () => {
    if (isUpdatingReporting) return; // Prevent multiple simultaneous updates

    setIsUpdatingReporting(true);
    try {
      // Update reporting data untuk PBL
      const reportingRes = await api.get("/reporting/dosen-pbl");
      setReportingData(reportingRes.data?.data || []);

      // Optional: Trigger event untuk update di halaman lain
      window.dispatchEvent(
        new CustomEvent("pbl-assignment-updated", {
          detail: { timestamp: Date.now() },
        })
      );
    } catch (error) {
      // Error handling for reporting data update
    } finally {
      setIsUpdatingReporting(false);
    }
  };

  // Function untuk export mapping dosen ke Excel sesuai template
  const exportMappingDosenExcel = async () => {
    try {
      if (blokMataKuliahFilteredByBlok.length === 0) {
        setError("Tidak ada data untuk diekspor");
        return;
      }

      // Ambil data tahun ajaran aktif untuk header
      const tahunAjaranRes = await api.get("/tahun-ajaran/active");
      const tahunAjaran = tahunAjaranRes.data?.tahun || "2024-2025";
      const semesterAktif = activeSemesterJenis || "Ganjil";

      // Ambil data jurnal reading untuk info modul
      let jurnalReadingData: { [kode: string]: any[] } = {};
      try {
        const jurnalRes = await api.get("/jurnal-readings/all");
        const jurnalData = jurnalRes.data || {};
        Object.entries(jurnalData).forEach(
          ([kode, item]: [string, any]) => {
            jurnalReadingData[kode] = item?.jurnal_readings || [];
          }
        );
      } catch (error) {
        // Jika gagal, lanjutkan tanpa jurnal reading
      }

      // Buat workbook baru
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Mapping Dosen Blok");

      // Group mata kuliah by semester, kemudian by mata kuliah (bukan by blok)
      const semesterGroups: { [semester: number]: MataKuliah[] } = {};
      blokMataKuliahFiltered.forEach((mk) => {
        const semesterNumber = mapSemesterToNumber(mk.semester);
        if (semesterNumber === null) return;
        if (!semesterGroups[semesterNumber]) {
          semesterGroups[semesterNumber] = [];
        }
        semesterGroups[semesterNumber].push(mk);
      });

      // Urutkan semester
      const sortedSemesters = Object.keys(semesterGroups)
        .map(Number)
        .sort((a, b) => a - b);

      // Warna header untuk setiap kolom (sesuai template)
      const headerColors = [
        { bg: "FFE8E8E8", text: "FF000000" }, // Kolom 1 - Light gray/pink
        { bg: "FFD9E1F2", text: "FF000000" }, // Kolom 2 - Light blue
        { bg: "FFE2EFDA", text: "FF000000" }, // Kolom 3 - Light green
        { bg: "FFF2E2D9", text: "FF000000" }, // Kolom 4 - Light brown/orange
      ];

      const colWidth = 45;
      let currentRow = 1;
      let currentColumn = 1;
      const columnSpacing = 0;
      let maxColumnUsed = 0;
      let maxBlockBottomRow = currentRow;

      const sortedFilteredSemesters = sortedSemesters.filter(
        (semester) => (semesterGroups[semester]?.length || 0) > 0
      );
      const totalColumns = sortedFilteredSemesters.reduce((acc, semester) => {
        return acc + (semesterGroups[semester]?.length || 0);
      }, 0);
      if (totalColumns === 0) {
        setError("Tidak ada data untuk diekspor");
        return;
      }
      const overallBlok = blokMataKuliahFiltered[0]?.blok || "";
      // Ubah nama sheet utama supaya mencantumkan nomor blok
      worksheet.name = `Mapping Dosen Blok ${overallBlok}`;
      // Sedikit perbaikan tampilan umum worksheet
      worksheet.pageSetup = {
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        orientation: "landscape",
        margins: { left: 0.2, right: 0.2, top: 0.4, bottom: 0.4, header: 0.2, footer: 0.2 },
      };
      if (totalColumns > 0) {
        const mainHeaderRow = worksheet.getRow(currentRow);
        mainHeaderRow.getCell(1).value = `MAPPING DOSEN BLOK ${overallBlok} SEMESTER ${semesterAktif?.toUpperCase() || ""} T.A. ${tahunAjaran}`;
        mainHeaderRow.font = { bold: true, size: 16, color: { argb: "FF1F4E79" } };
        mainHeaderRow.alignment = { horizontal: "center" };
        worksheet.mergeCells(currentRow, 1, currentRow, totalColumns);
        mainHeaderRow.height = 28;
        currentRow += 2;
      }

      // Ringkasan untuk sheet Info
      const koordinatorSet = new Set<number>();
      const timBlokSet = new Set<number>();
      const dosenMengajarSet = new Set<number>();
      let totalPblModulExported = 0;
      const exportedSemesters: number[] = [];

      // Loop untuk setiap semester
      sortedFilteredSemesters.forEach((semester) => {
        const mataKuliahList = semesterGroups[semester] || [];
        const mataKuliahToExport = [...mataKuliahList];
        const maxCols = mataKuliahToExport.length;

        if (maxCols === 0) return;
        exportedSemesters.push(semester);

        const startCol = currentColumn;
        const titleRowIndex = currentRow;
        const headerRowIndex = currentRow + 2;
        const subHeaderRowIndex = currentRow + 3;
        const subHeaderRow2Index = currentRow + 4;
        const firstDataRowIndex = currentRow + 5;

        // Ambil blok dari mata kuliah pertama (semua dalam blok yang sama)
        const currentBlok = mataKuliahList[0]?.blok;

        // Header utama untuk semester ini
        const titleRow = worksheet.getRow(titleRowIndex);
        titleRow.getCell(startCol).value = `SEMESTER ${semester} (${semesterAktif.toUpperCase()})`;
        titleRow.font = { bold: true, size: 14 };
        titleRow.alignment = { horizontal: "center" };
        worksheet.mergeCells(
          titleRowIndex,
          startCol,
          titleRowIndex,
          startCol + maxCols - 1
        );
        titleRow.height = 25;

        // Kosongkan satu baris (untuk jarak visual)
        worksheet.getRow(titleRowIndex + 1);

        // Header kolom untuk setiap mata kuliah
        const headerRow = worksheet.getRow(headerRowIndex);
        const subHeaderRow = worksheet.getRow(subHeaderRowIndex);
        const subHeaderRow2 = worksheet.getRow(subHeaderRow2Index);
        headerRow.height = 20;
        subHeaderRow.height = 18;
        subHeaderRow2.height = 18;

        // Data untuk setiap mata kuliah
        const mataKuliahData: { [kode: string]: Dosen[] } = {};

        mataKuliahToExport.forEach((mk, idx) => {
          // Hitung jumlah kelompok kecil untuk semester ini
          const semesterKey = String(semester);
          const semesterData = kelompokKecilListBySemester[semesterKey] || [];
          const uniqueKelompok = new Set(
            semesterData.map((kk: any) => kk.nama_kelompok)
          );
          const jumlahKelompok = uniqueKelompok.size;

          // Hitung jumlah modul PBL untuk mata kuliah ini
          const pbls = pblData[mk.kode] || [];
          const totalPblModul = pbls.length;
          totalPblModulExported += totalPblModul;

          // Cek apakah ada Journal Reading
          const jurnalReadings = jurnalReadingData[mk.kode] || [];
          const hasJournalReading = jurnalReadings.length > 0;

          // Ambil semua dosen yang di-assign ke mata kuliah ini (unik per dosen)
          const dosenSet = new Set<number>();
          const dosenListMk: Dosen[] = [];

          pbls.forEach((pbl) => {
            if (pbl.id && assignedDosen[pbl.id]) {
              assignedDosen[pbl.id].forEach((dosen) => {
                if (!dosenSet.has(dosen.id)) {
                  dosenSet.add(dosen.id);
                  // Tentukan role dosen
                  let role = dosen.pbl_role || "dosen_mengajar";

                  // Cek dari dosen_peran jika pbl_role tidak ada
                  if (!role || role === "dosen_mengajar") {
                    const dosenPeran = dosen.dosen_peran?.find(
                      (peran: any) =>
                        peran.semester === String(mk.semester) &&
                        (peran.tipe_peran === "koordinator" ||
                          peran.tipe_peran === "tim_blok")
                    );
                    if (dosenPeran) {
                      role = dosenPeran.tipe_peran;
                    }
                  }

                  dosenListMk.push({
                    ...dosen,
                    pbl_role: role,
                  });
                  if (role === "koordinator") {
                    koordinatorSet.add(dosen.id);
                  } else if (role === "tim_blok") {
                    timBlokSet.add(dosen.id);
                  } else {
                    dosenMengajarSet.add(dosen.id);
                  }
                }
              });
            }
          });

          // Urutkan dosen: koordinator/tim_blok dulu, kemudian dosen mengajar
          dosenListMk.sort((a, b) => {
            const roleA = a.pbl_role || "dosen_mengajar";
            const roleB = b.pbl_role || "dosen_mengajar";
            const priority: { [key: string]: number } = {
              koordinator: 1,
              tim_blok: 2,
              dosen_mengajar: 3,
            };
            return (priority[roleA] || 99) - (priority[roleB] || 99);
          });

          mataKuliahData[mk.kode] = dosenListMk;

          const colorIndex = idx % headerColors.length;

          // Header mata kuliah
          const headerCell = headerRow.getCell(startCol + idx);
          headerCell.value = mk.nama.toUpperCase();
          headerCell.font = { bold: true, size: 12, color: { argb: "FF000000" } };
          headerCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: headerColors[colorIndex]?.bg || "FFE8E8E8" },
          };
          headerCell.alignment = { horizontal: "center", vertical: "middle" };
          headerCell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };

          // Sub-header 1: Jumlah kelompok
          const subHeaderCell1 = subHeaderRow.getCell(startCol + idx);
          subHeaderCell1.value = `(${jumlahKelompok} Kel)`;
          subHeaderCell1.font = { size: 10, color: { argb: "FF444444" } };
          subHeaderCell1.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: headerColors[colorIndex]?.bg || "FFE8E8E8" },
          };
          subHeaderCell1.alignment = { horizontal: "center", vertical: "middle" };
          subHeaderCell1.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };

          // Sub-header 2: Info modul
          let modulInfo = `PBL ${totalPblModul} modul`;
          if (hasJournalReading) {
            // Format: "PBL X modul, Journal Reading 1-Y"
            const jurnalCount = jurnalReadings.length;
            if (jurnalCount === 1) {
              modulInfo += ", Journal Reading 1";
            } else if (jurnalCount === 2) {
              modulInfo += ", Journal Reading 1-2";
            } else {
              modulInfo += `, Journal Reading 1-${jurnalCount}`;
            }
          }

          const subHeaderCell2 = subHeaderRow2.getCell(startCol + idx);
          subHeaderCell2.value = modulInfo;
          subHeaderCell2.font = { size: 10, color: { argb: "FF444444" } };
          subHeaderCell2.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: headerColors[colorIndex]?.bg || "FFE8E8E8" },
          };
          subHeaderCell2.alignment = { horizontal: "center", vertical: "middle" };
          subHeaderCell2.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };

          // Set lebar kolom
          worksheet.getColumn(startCol + idx).width = colWidth;
        });

        // Tambahkan data dosen untuk setiap mata kuliah
        const maxDosenRows = mataKuliahToExport.reduce((acc, mk) => {
          return Math.max(acc, mataKuliahData[mk.kode]?.length || 0);
        }, 0);

        for (let rowIdx = 0; rowIdx < maxDosenRows; rowIdx++) {
          const dataRow = worksheet.getRow(firstDataRowIndex + rowIdx);
          dataRow.height = 16;

          mataKuliahToExport.forEach((mk, colIdx) => {
            const dosenList = mataKuliahData[mk.kode] || [];
            const dosen = dosenList[rowIdx];

            const cell = dataRow.getCell(startCol + colIdx);

            if (dosen) {
              // Format nama dosen dengan gelar
              const namaDosen = dosen.name || "Dosen Tidak Diketahui";
              cell.value = namaDosen;
              cell.font = { size: 10 };

              // Tentukan role
              const role = dosen.pbl_role || "dosen_mengajar";

              // Warna biru untuk koordinator dan tim_blok
              if (role === "koordinator" || role === "tim_blok") {
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFD9E1F2" }, // Light blue
                };
                // Bold hanya untuk Koordinator
                if (role === "koordinator") {
                  cell.font = { bold: true };
                }
              } else {
                // Putih untuk dosen mengajar
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "FFFFFFFF" },
                };
              }

              cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
              };
              cell.alignment = { vertical: "middle", wrapText: true };
            } else {
              // Cell kosong
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFFFFFFF" },
              };
              cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
              };
            }
          });
        }

        const blockBottomRow =
          maxDosenRows > 0
            ? firstDataRowIndex + maxDosenRows - 1
            : subHeaderRow2Index;

        maxBlockBottomRow = Math.max(maxBlockBottomRow, blockBottomRow);
        maxColumnUsed = Math.max(maxColumnUsed, startCol + maxCols - 1);
        currentColumn = startCol + maxCols + columnSpacing;
      });

      currentRow = maxBlockBottomRow + 3;

      // Tambahkan section Standby Tutor / Instruktur Cirendeu di bagian bawah jika ada
      const standbyDosen = dosenList.filter((d) => {
        const keahlian = parseKeahlian(d.keahlian);
        return keahlian.some((k) => k.toLowerCase().includes("standby"));
      });

      if (standbyDosen.length > 0) {
        const standbyHeaderRowIndex = currentRow;
        const standbyStartCol = 1;
        const standbyEndCol = Math.max(maxColumnUsed, 2);

        const standbyHeaderRow = worksheet.getRow(standbyHeaderRowIndex);
        standbyHeaderRow.getCell(standbyStartCol).value = "Standby Tutor";
        standbyHeaderRow.font = { bold: true, size: 14, color: { argb: "FF1F4E79" } };
        standbyHeaderRow.alignment = { horizontal: "center" };
        worksheet.mergeCells(
          standbyHeaderRowIndex,
          standbyStartCol,
          standbyHeaderRowIndex,
          standbyEndCol
        );
        standbyHeaderRow.height = 25;

        // Tambahkan 1 baris kosong di bawah header sebagai jarak
        worksheet.getRow(standbyHeaderRowIndex + 1);

        const standbyPerKolom = Math.ceil(standbyDosen.length / 2);
        const standbyDataStartRow = standbyHeaderRowIndex + 2;

        for (let rowIdx = 0; rowIdx < standbyPerKolom; rowIdx++) {
          const standbyRow = worksheet.getRow(standbyDataStartRow + rowIdx);

          for (let colIdx = 0; colIdx < 2; colIdx++) {
            const dosenIdx = rowIdx + colIdx * standbyPerKolom;
            const dosen = standbyDosen[dosenIdx];

            const cell = standbyRow.getCell(standbyStartCol + colIdx);
            cell.border = {
              top: { style: "thin" },
              left: { style: "thin" },
              bottom: { style: "thin" },
              right: { style: "thin" },
            };
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFFFFFF" },
            };
            cell.alignment = { vertical: "middle", wrapText: true };

            if (dosen) {
              cell.value = dosen.name || "Dosen Tidak Diketahui";
            }
          }
        }

        currentRow = standbyDataStartRow + standbyPerKolom + 1;
      }

      // Biarkan header ikut scroll (non-frozen)
      worksheet.views = [];

      // Tambahkan Sheet 2: Info
      try {
        const infoSheet = workbook.addWorksheet("Info");
        infoSheet.pageSetup = {
          orientation: "portrait",
          fitToPage: true,
          fitToWidth: 1,
          fitToHeight: 0,
          margins: { left: 0.3, right: 0.3, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 },
        };
        // Lebarkan kolom agar judul benar-benar center dan tidak terpotong
        infoSheet.columns = [
          { header: "", key: "label", width: 40 },
          { header: "", key: "value", width: 80 },
        ];

        // Judul (merge numeric untuk menghindari anomali)
        const infoTitleRowIndex = 1;
        infoSheet.mergeCells(infoTitleRowIndex, 1, infoTitleRowIndex, 2);
        const infoTitleCell = infoSheet.getCell(infoTitleRowIndex, 1);
        infoTitleCell.value = `Informasi Export - Mapping Dosen Blok ${overallBlok}`;
        infoTitleCell.font = { bold: true, size: 16, color: { argb: "FF1F4E79" } };
        infoTitleCell.alignment = { horizontal: "center", vertical: "middle" };
        infoSheet.getRow(infoTitleRowIndex).height = 28;
        // Baris kosong setelah judul
        infoSheet.addRow([]);

        const now = new Date();
        const rows: Array<[string, string]> = [
          ["Tanggal Export", now.toLocaleString("id-ID")],
          ["Blok", String(overallBlok)],
          ["Semester Aktif", String(semesterAktif || "")],
          ["Tahun Ajaran", String(tahunAjaran)],
          ["Jumlah Semester Terekspor", String(sortedFilteredSemesters.length)],
          ["Jumlah Mata Kuliah Terekspor", String(totalColumns)],
          ["Total Modul PBL Terekspor", String(totalPblModulExported)],
          ["Total Koordinator (unik)", String(koordinatorSet.size)],
          ["Total Tim Blok (unik)", String(timBlokSet.size)],
          ["Total Dosen Mengajar (unik)", String(dosenMengajarSet.size)],
          ["Total Standby Tutor", String(standbyDosen.length)],
          ["Daftar Semester", exportedSemesters.sort((a,b)=>a-b).join(", ")],
          [
            "Cakupan Data",
            "File ini hanya memuat semester sesuai filter aktif (Ganjil/Genap) pada saat export. Semester atau mata kuliah yang tidak tampil di halaman, tidak akan diekspor.",
          ],
          [
            "Catatan",
            "Tata letak per semester disusun horisontal (menyamping). Setiap kolom mewakili satu mata kuliah: baris 1 judul mata kuliah, baris 2 total kelompok, baris 3 ringkasan modul/Journal Reading, lalu diikuti daftar dosen.",
          ],
          [
            "Saran Penggunaan",
            "Koordinator ditandai latar biru dengan teks tebal. Tim Blok dilatar biru tanpa tebal. Dosen Mengajar berwarna putih. Manfaatkan filter/pencarian Excel bila diperlukan. Mohon verifikasi data sebelum distribusi.",
          ],
          [
            "Kontak",
            "Support Center Isme - Sistem ISME FKK",
          ],
        ];

        rows.forEach(([label, value]) => {
          const r = infoSheet.addRow([label, value]);
          r.getCell(1).font = { bold: true };
          r.getCell(1).alignment = { vertical: "middle" };
          r.getCell(2).alignment = { vertical: "middle", wrapText: true };
          // Border tipis agar rapi
          r.eachCell({ includeEmpty: true }, (cell, colNumber) => {
            cell.border = {
              top: { style: "thin", color: { argb: "FFDDDDDD" } },
              left: { style: "thin", color: { argb: "FFDDDDDD" } },
              bottom: { style: "thin", color: { argb: "FFDDDDDD" } },
              right: { style: "thin", color: { argb: "FFDDDDDD" } },
            };
            if (colNumber === 1) {
              cell.fill = {
                type: "pattern",
                pattern: "solid",
                fgColor: { argb: "FFF7F7F7" },
              };
            }
          });
        });

        infoSheet.addRow([]);
        const footer = infoSheet.addRow(["Dokumen ini dihasilkan otomatis oleh Sistem ISME FKK."]);
        footer.font = { italic: true, color: { argb: "FF666666" } };
        infoSheet.mergeCells(`A${footer.number}:B${footer.number}`);
      } catch {}

      // Generate file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      // Download file
      const currentBlok = blokMataKuliahFilteredByBlok[0]?.blok || "";
      const fileName = `Mapping_Dosen_Blok_${currentBlok}_Semester_${semesterAktif}_TA_${tahunAjaran}.xlsx`;
      saveAs(blob, fileName);

      setSuccess("Data berhasil diekspor ke Excel");
      setTimeout(() => setSuccess(null), 3000);
    } catch (error: any) {
      console.error("Error exporting Excel:", error);
      setError("Gagal mengekspor data ke Excel: " + (error.message || "Unknown error"));
      setTimeout(() => setError(null), 5000);
    }
  };

  // Tampilkan error jika belum generate
  if (generateValidationError) {
    return (
      <div className="w-full mx-auto">
        <div className="flex flex-col items-center justify-center py-16">
          <div className="w-20 h-20 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center mb-6">
            <FontAwesomeIcon
              icon={faExclamationTriangle}
              className="w-10 h-10 text-orange-500 dark:text-orange-400"
            />
          </div>
          <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
            Blok Belum Di-generate
          </h2>
          <p className="text-gray-600 dark:text-gray-400 text-center mb-8 max-w-md">
            {generateValidationError}
          </p>
          <div className="flex gap-4">
            <button
              onClick={() => navigate("/pbl")}
              className="px-6 py-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition"
            >
              Kembali ke PBL
            </button>
            <button
              onClick={() => navigate(`/pbl/generate/${blokId}`)}
              className="px-6 py-3 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faCog} className="w-4 h-4" />
              Generate Dosen
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="w-full mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-8 w-80 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
          <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>

        {/* Blok Overview Statistics Skeleton */}
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
              <div>
                <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                  <div className="text-right">
                    <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                      <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                    <div className="h-3 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Metrics Skeleton */}
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
              <div>
                <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                <div className="h-4 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between h-full">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                  <div className="text-right">
                    <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Assignment Distribution Skeleton */}
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
              <div>
                <div className="h-6 w-44 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                <div className="h-4 w-60 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between h-full">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                  <div className="text-right">
                    <div className="h-6 w-8 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter & Pencarian Skeleton */}
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-6 shadow-sm">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse" />
              <div>
                <div className="h-6 w-36 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                <div className="h-4 w-72 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            <div className="h-10 w-48 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Main Content Grid Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* PBL Section Skeleton (2 kolom) */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>

              {/* Semester Card Skeleton */}
              <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
                {/* Semester Header Skeleton */}
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                  <div className="flex flex-col gap-2">
                    <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                  </div>
                  <div className="flex gap-2 ml-auto"></div>
                </div>

                {/* PBL Cards Skeleton */}
                <div className="space-y-4">
                  {Array.from({ length: 3 }).map((_, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800/50"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-3">
                            <div className="flex-1">
                              <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                              <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2 mb-4">
                            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                            <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                            <div className="h-6 w-18 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                          <div className="h-8 w-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                        </div>
                      </div>
                      <div className="bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                        <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                        <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Dosen Section Skeleton (1 kolom) */}
          <div className="lg:col-span-1">
            <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
              <div className="h-10 w-full bg-gray-200 dark:bg-gray-700 rounded-lg mb-4 animate-pulse" />
              <div className="space-y-3">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                      <div className="flex-1">
                        <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1 animate-pulse" />
                        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                      <div className="h-5 w-20 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                      <div className="h-5 w-14 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (blokId && blokMataKuliahFilteredByBlok.length === 0) {
    return (
      <div className="flex flex-col items-center py-16">
        <svg
          width="64"
          height="64"
          fill="none"
          viewBox="0 0 24 24"
          className="mb-4 text-gray-300 dark:text-gray-600"
        >
          <path
            fill="currentColor"
            d="M12 2a10 10 0 100 20 10 10 0 000-20zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"
          />
        </svg>
        <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
          Blok dengan ID {blokId} tidak ditemukan.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <button
              onClick={() => navigate("/pbl", { replace: true })}
              className="flex items-center gap-2 text-brand-500 hover:text-brand-600 transition-all duration-300 ease-out hover:scale-105 transform mb-4"
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
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
              Problem Based Learning (PBL)
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Pengelolaan modul PBL dan penugasan dosen berdasarkan keahlian
            </p>
          </div>
        </div>
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                Sistem Penugasan Dosen
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Dosen reguler hanya bisa di-drag & drop antar modul dalam
                semester yang sama dan sesuai keahlian. <br />
                <span className="font-semibold">Dosen standby</span> dapat
                di-assign ke modul manapun tanpa batasan keahlian atau semester.
              </p>
            </div>
          </div>
        </div>
        
        {/* Section Aksi Utama */}
        <div className="mt-4 p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800/50 dark:to-gray-900/50 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h4 className="text-sm font-semibold text-gray-800 dark:text-gray-200 mb-2">
                Aksi Utama
              </h4>
              <div className="space-y-2 text-xs text-gray-600 dark:text-gray-400">
                <div className="flex items-start gap-2">
                  <FontAwesomeIcon icon={faFileExcel} className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5" />
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Export Excel:</span> Ekspor data mapping dosen ke file Excel dengan format terstruktur per semester dan mata kuliah.
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                  <div>
                    <span className="font-medium text-gray-700 dark:text-gray-300">Clear Cache:</span> Reset cache status generate PBL untuk memaksa sistem mengambil data fresh dari database.
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-2 flex-shrink-0">
              <button
                onClick={exportMappingDosenExcel}
                className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg transition-colors duration-200 flex items-center gap-2 shadow-theme-xs"
                title="Export Mapping Dosen ke Excel"
              >
                <FontAwesomeIcon icon={faFileExcel} className="w-4 h-4" />
                Export Excel
              </button>
              <button
                onClick={handleClearCache}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors duration-200 flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Cache
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Blok Overview Statistics */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
              <FontAwesomeIcon
                icon={faCheckCircle}
                className="w-6 h-6 text-slate-600 dark:text-slate-300"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                Blok Overview Statistics
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Overview performa sistem PBL detail
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Blok Completion Rate */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    className="w-4 h-4 text-white"
                  />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Blok Completion
                </h4>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {pblDetailStatistics.blokCompletionRate.toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-blue-400 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Unassigned
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {pblDetailStatistics.unassignedPBLCount}
                </span>
              </div>
            </div>
          </div>

          {/* Dosen per Blok */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faUsers}
                    className="w-4 h-4 text-white"
                  />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Dosen per Blok
                </h4>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {pblDetailStatistics.dosenPerBlok}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Avg Assignments
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {pblDetailStatistics.dosenEfficiency.toFixed(1)}
                </span>
              </div>
            </div>
          </div>

          {/* Modul per Blok */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faBookOpen}
                    className="w-4 h-4 text-white"
                  />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Modul per Blok
                </h4>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {pblDetailStatistics.modulPerBlok}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-purple-400 rounded-full"></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Keahlian Covered
                  </span>
                </div>
                <span className="text-sm font-semibold text-gray-900 dark:text-white">
                  {pblDetailStatistics.keahlianCoverage.toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* System Health */}
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    pblDetailStatistics.cacheStatus === "clean"
                      ? "bg-green-500"
                      : pblDetailStatistics.cacheStatus === "dirty"
                      ? "bg-yellow-500"
                      : "bg-red-500"
                  }`}
                >
                  <FontAwesomeIcon
                    icon={faCog}
                    className="w-4 h-4 text-white"
                  />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Active Warnings
                </h4>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-gray-900 dark:text-white">
                  {pblDetailStatistics.warningCount}
                </div>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-white dark:bg-gray-700/50 rounded-lg">
                <div className="flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      pblDetailStatistics.cacheStatus === "clean"
                        ? "bg-green-400"
                        : pblDetailStatistics.cacheStatus === "dirty"
                        ? "bg-yellow-400"
                        : "bg-red-400"
                    }`}
                  ></div>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Cache Status
                  </span>
                </div>
                <span
                  className={`text-sm font-semibold ${
                    pblDetailStatistics.cacheStatus === "clean"
                      ? "text-green-600 dark:text-green-400"
                      : pblDetailStatistics.cacheStatus === "dirty"
                      ? "text-yellow-600 dark:text-yellow-400"
                      : "text-red-600 dark:text-red-400"
                  }`}
                >
                  {pblDetailStatistics.cacheStatus}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Performance Metrics */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
              <FontAwesomeIcon
                icon={faCog}
                className="w-6 h-6 text-slate-600 dark:text-slate-300"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                Performance Metrics
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Metrik performa sistem PBL detail
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between h-full">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    className="w-4 h-4 text-white"
                  />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Assignment Success Rate
                </h4>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {pblDetailStatistics.assignmentSuccessRate.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between h-full">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faUsers}
                    className="w-4 h-4 text-white"
                  />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Keahlian Utilization
                </h4>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {pblDetailStatistics.keahlianUtilization.toFixed(1)}%
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between h-full">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faBookOpen}
                    className="w-4 h-4 text-white"
                  />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Tim Blok : Dosen Mengajar
                </h4>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {pblDetailStatistics.timBlokVsDosenMengajarRatio.toFixed(2)}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between h-full">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-orange-500 rounded-lg flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faExclamationTriangle}
                    className="w-4 h-4 text-white"
                  />
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Dosen Overload
                </h4>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-orange-600 dark:text-orange-400">
                  {pblDetailStatistics.dosenOverloadCount}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Assignment Distribution */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
              <FontAwesomeIcon
                icon={faUsers}
                className="w-6 h-6 text-slate-600 dark:text-slate-300"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                Assignment Distribution
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Distribusi peran dosen dalam sistem
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between h-full">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">K</span>
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Koordinator
                </h4>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-blue-600 dark:text-blue-400">
                  {pblDetailStatistics.assignmentDistribution.koordinator}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between h-full">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-purple-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">T</span>
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Tim Blok
                </h4>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                  {pblDetailStatistics.assignmentDistribution.timBlok}
                </div>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-5 border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all duration-200">
            <div className="flex items-center justify-between h-full">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                  <span className="text-white text-sm font-bold">D</span>
                </div>
                <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Dosen Mengajar
                </h4>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600 dark:text-green-400">
                  {pblDetailStatistics.assignmentDistribution.dosenMengajar}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Filterisasi dalam card ala CSR */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-6 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
              <FontAwesomeIcon
                icon={faSearch}
                className="w-6 h-6 text-slate-600 dark:text-slate-300"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                Filter & Pencarian
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Filter dan cari modul PBL berdasarkan kriteria
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
          <select
            value={filterSemester}
            onChange={(e) => setFilterSemester(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-theme-xs"
          >
            <option value="semua">Semua Semester</option>
            {semesterOptions.map((semester) => (
              <option key={semester} value={semester}>
                Semester {semester}
              </option>
            ))}
          </select>
          <select
            value={filterBlok}
            onChange={(e) => setFilterBlok(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-theme-xs"
          >
            <option value="semua">Semua Blok</option>
            {blokOptions.map((blok) => (
              <option key={blok} value={blok}>
                Blok {blok}
              </option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-theme-xs"
          >
            <option value="semua">Semua Status</option>
            <option value="belum">Belum Ditugaskan</option>
            <option value="sudah">Sudah Ditugaskan</option>
          </select>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Cari modul PBL..."
            className="w-full sm:w-auto px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white shadow-theme-xs"
          />
        </div>
      </div>
      {/* Notifications */}
      <AnimatePresence>
        {success && (
          <motion.div
            key="success-message"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-brand-100 border text-brand-700 p-3 rounded-lg mb-6"
          >
            {success}
          </motion.div>
        )}
        {error && (
          <motion.div
            key="error-message"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-100 border text-red-700 p-3 rounded-lg mb-6"
          >
            {error}
          </motion.div>
        )}
        {warnings.length > 0 && (
          <div className="mb-6 space-y-3">
            {warnings.map((warning, index) => (
              <div
                key={`warning-${index}-${warning.substring(0, 20)}`}
                className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-500 dark:border-yellow-700 rounded-lg flex items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3">
                  <FontAwesomeIcon
                    icon={faExclamationTriangle}
                    className="w-6 h-6 text-yellow-500"
                  />
                  <span className="text-yellow-700 dark:text-yellow-300">
                    {warning}
                  </span>
                </div>
                <button
                  onClick={() =>
                    setWarnings((prev) => prev.filter((_, i) => i !== index))
                  }
                  className="text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-200 transition-colors duration-200"
                  title="Tutup warning"
                >
                  <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </AnimatePresence>
      {/* Main Content: Grid 2 kolom */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PBL Section (2 kolom) */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
              Modul PBL ({allFilteredMataKuliah.length})
            </h3>
            {sortedSemesters.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faBookOpen}
                    className="w-8 h-8 text-gray-400"
                  />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Belum ada mata kuliah blok
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Tambahkan mata kuliah blok untuk memulai penugasan dosen.
                </p>
              </div>
            ) : (
              <div className="space-y-8 max-h-[1500px] overflow-y-auto hide-scroll">
                {(sortedSemesters || []).map((semester) => {
                  const semesterPBLs = (allFilteredMataKuliah || []).filter(
                    (mk: MataKuliah) => mk.semester === semester
                  );
                  // Calculate total modul in this semester (sum all modules, not just mata kuliah)
                  // Each PBL is 5x50 menit, so total = jumlah seluruh modul * 5
                  const totalModul = semesterPBLs.reduce(
                    (acc, mk) => acc + (pblData[mk.kode]?.length || 0),
                    0
                  );
                  const totalSesi = totalModul * 5;
                  return (
                    <div
                      key={semester}
                      className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-6 border border-gray-200 dark:border-gray-700"
                    >
                      {/* Semester Header */}
                      <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center">
                          <span className="text-white font-bold text-lg">
                            {semester}
                          </span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-xl font-bold text-gray-800 dark:text-white">
                            Semester {semester}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {totalModul} modul PBL
                          </p>
                          {/* Info Dosen dan Kelompok */}
                          <div className="flex gap-4 mt-2">
                            <div className="flex items-center gap-1">
                              <FontAwesomeIcon
                                icon={faUsers}
                                className="w-3 h-3 text-blue-500"
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {(() => {
                                  // Ambil semua dosen yang ditugaskan ke PBL di semester ini
                                  const assignedDosenSet = new Set<number>();
                                  (semesterPBLs || []).forEach((mk) => {
                                    (pblData[mk.kode] || []).forEach((pbl) => {
                                      if (pbl.id) {
                                        (assignedDosen[pbl.id] || []).forEach(
                                          (dosen) => {
                                            assignedDosenSet.add(dosen.id);
                                          }
                                        );
                                      }
                                    });
                                  });
                                  return `${assignedDosenSet.size} dosen`;
                                })()}
                              </span>
                            </div>
                            <div className="flex items-center gap-1">
                              <FontAwesomeIcon
                                icon={faUsers}
                                className="w-3 h-3 text-green-500"
                              />
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                {(() => {
                                  const semesterKey = String(semester);
                                  const semesterData =
                                    kelompokKecilListBySemester[semesterKey];
                                  if (!semesterData) return "0 kelompok";
                                  // Hitung kelompok unik untuk semester ini
                                  const uniqueKelompok = new Set(
                                    semesterData.map((kk) => kk.nama_kelompok)
                                  );
                                  return `${uniqueKelompok.size} kelompok`;
                                })()}
                              </span>
                            </div>
                          </div>
                        </div>
                        {/* Warning badge untuk semester tanpa kelompok kecil */}
                        {(() => {
                          const semesterKey = String(semester);
                          const semesterData =
                            kelompokKecilListBySemester[semesterKey];
                          if (!semesterData || semesterData.length === 0) {
                            return (
                              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
                                <FontAwesomeIcon
                                  icon={faExclamationTriangle}
                                  className="w-3 h-3 text-red-500"
                                />
                                <span className="text-xs font-medium text-red-700 dark:text-red-300">
                                  Belum ada kelompok kecil
                                </span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                        {/* Kelompok Kecil Badges */}
                        <div className="flex flex-wrap gap-2 items-center">
                          {(() => {
                            const semesterKey = String(semester);
                            const semesterData =
                              kelompokKecilListBySemester[semesterKey];
                            if (!semesterData || semesterData.length === 0) {
                              return (
                                <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-700">
                                  <FontAwesomeIcon
                                    icon={faExclamationTriangle}
                                    className="w-3 h-3 text-red-500"
                                  />
                                  <span className="text-xs font-medium text-red-700 dark:text-red-300">
                                    Belum ada kelompok kecil
                                  </span>
                                </div>
                              );
                            }

                            // Ambil kelompok unik
                            const uniqueKelompok = Array.from(
                              new Set(
                                semesterData.map((kk) => kk.nama_kelompok)
                              )
                            );

                            return uniqueKelompok.map((namaKelompok) => {
                              const kelompok = semesterData.find(
                                (kk) => kk.nama_kelompok === namaKelompok
                              );
                              if (!kelompok) return null;

                              return (
                                <div
                                  key={kelompok.id}
                                  className="flex items-center gap-2"
                                >
                                  <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                                    Kelompok {kelompok.nama_kelompok}
                                  </span>
                                  <button
                                    onClick={() =>
                                      handleLihatMahasiswa(kelompok)
                                    }
                                    className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                    title={`Lihat mahasiswa Kelompok ${kelompok.nama_kelompok}`}
                                  >
                                    <FontAwesomeIcon
                                      icon={faEye}
                                      className="w-3 h-3"
                                    />
                                  </button>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      </div>
                      {/* Warning konflik per semester */}
                      {/* Konflik peran dihapus: tidak ada banner per semester */}

                      {/* PBL Cards Grid */}
                      <div className="grid gap-4">
                        {(semesterPBLs || []).map((mk: MataKuliah) => {
                          const pblList = pblData[mk.kode] || [];
                          return pblList.length === 0
                            ? null
                            : pblList.map((pbl, pblIdx) => {
                                const assigned = pbl.id
                                  ? assignedDosen[pbl.id] || []
                                  : [];
                                // Dosen yang cocok berdasarkan keahlian mata kuliah
                                const availableDosen = dosenList.filter((d) => {
                                  const keahlianArr = Array.isArray(d.keahlian)
                                    ? d.keahlian
                                    : (d.keahlian || "")
                                        .split(",")
                                        .map((k) => k.trim());
                                  return (mk.keahlian_required || []).some(
                                    (k) => keahlianArr.includes(k)
                                  );
                                });
                                // Status badge ala CSR
                                const statusBadge =
                                  assigned.length > 0 ? (
                                    <span className="text-xs px-3 py-1 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300 ml-auto">
                                      Sudah Ditugaskan
                                    </span>
                                  ) : (
                                    <span className="text-xs px-3 py-1 rounded-full font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300 ml-auto">
                                      Belum Ditugaskan
                                    </span>
                                  );
                                return (
                                  <div
                                    key={pbl.id}
                                    className={`p-3 sm:p-5 rounded-xl border transition-all duration-300 ${
                                      dragOverPBLId === pbl.id
                                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-lg scale-[1.02]"
                                        : "border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800/50 hover:shadow-md"
                                    }`}
                                    onDragOver={(e) => {
                                      e.preventDefault();
                                      if (
                                        draggedDosen &&
                                        draggedFromPBLId !== null &&
                                        draggedFromPBLId !== pbl.id
                                      ) {
                                        setDragOverPBLId(pbl.id!);
                                      }
                                    }}
                                    onDragLeave={(e) => {
                                      e.preventDefault();
                                      setDragOverPBLId(null);
                                    }}
                                    onDrop={async (e) => {
                                      e.preventDefault();
                                      setDragOverPBLId(null);
                                      if (
                                        !draggedDosen ||
                                        draggedDosen.id == null
                                      )
                                        return;
                                      // Jika dosen sudah ada di PBL target, tolak
                                      if (
                                        pbl.id &&
                                        (assignedDosen[pbl.id] || []).some(
                                          (d) => d.id === draggedDosen.id
                                        )
                                      ) {
                                        setError("Dosen sudah ada di PBL ini.");
                                        return;
                                      }

                                      // VALIDASI BARU: Cek apakah dosen sudah ada di blok yang sama di semester lain
                                      const isAlreadyInSameBlok =
                                        Object.entries(assignedDosen).some(
                                          ([pblIdStr, assignedDosenList]) => {
                                            const pblId = parseInt(pblIdStr);
                                            if (pblId && assignedDosenList) {
                                              // Cari semester dari PBL ID ini
                                              let targetSemester = null;
                                              Object.entries(pblData).forEach(
                                                ([mkKode, pbls]) => {
                                                  const pbl = pbls.find(
                                                    (p) => p.id === pblId
                                                  );
                                                  if (pbl) {
                                                    // Cari mata kuliah untuk mendapatkan semester
                                                    const mk =
                                                      blokMataKuliah.find(
                                                        (m) => m.kode === mkKode
                                                      );
                                                    if (mk) {
                                                      targetSemester =
                                                        mk.semester;
                                                    }
                                                  }
                                                }
                                              );

                                              // Cek apakah dosen sudah ada di blok yang sama
                                              return assignedDosenList.some(
                                                (assignedDosen) =>
                                                  assignedDosen.id ===
                                                    draggedDosen.id &&
                                                  targetSemester === mk.semester
                                              );
                                            }
                                            return false;
                                          }
                                        );

                                      if (isAlreadyInSameBlok) {
                                        setError(
                                          `Dosen ${draggedDosen.name} sudah ada di Blok ${mk.blok} Semester ${mk.semester}. Tidak bisa di-assign ke blok yang sama di semester yang berbeda.`
                                        );
                                        return;
                                      }

                                      // Cek apakah keahlian dosen sesuai dengan mata kuliah
                                      const isKeahlianMatch =
                                        checkKeahlianMatch(draggedDosen, mk);

                                      // Check if dosen is standby
                                      const dosenKeahlian = Array.isArray(
                                        draggedDosen.keahlian
                                      )
                                        ? draggedDosen.keahlian
                                        : (draggedDosen.keahlian || "")
                                            .split(",")
                                            .map((k) => k.trim());
                                      const isStandby = dosenKeahlian.some(
                                        (k) =>
                                          k.toLowerCase().includes("standby")
                                      );

                                      // Jika keahlian tidak sesuai, tampilkan popup konfirmasi
                                      if (!isKeahlianMatch) {
                                        setPendingAssignment({
                                          dosen: draggedDosen,
                                          pbl: pbl,
                                          mk: mk,
                                        });
                                        setShowKeahlianConfirmModal(true);
                                        return;
                                      }

                                      // Jika keahlian sesuai, langsung assign
                                      await handleAssignDosen(
                                        draggedDosen,
                                        pbl,
                                        mk
                                      );

                                      // VALIDASI PRIORITAS: Cek assignment count dosen
                                      const assignmentCount =
                                        draggedDosen.pbl_assignment_count || 0;
                                      if (assignmentCount > 3 && !isStandby) {
                                        setWarnings([
                                          `Dosen ${draggedDosen.name} sudah memiliki ${assignmentCount} assignment. Pertimbangkan untuk menggunakan dosen dengan beban kerja yang lebih rendah untuk distribusi yang adil.`,
                                        ]);
                                      }

                                      // Validasi peran_utama - sama seperti PBLGenerate.tsx
                                      let isPerfectMatch = false;
                                      let matchReason = "";

                                      // Check dosen_peran for semester and mata kuliah matching
                                      if (
                                        draggedDosen.dosen_peran &&
                                        Array.isArray(draggedDosen.dosen_peran)
                                      ) {
                                        const matchingPeran =
                                          draggedDosen.dosen_peran.find(
                                            (peran: any) => {
                                              if (
                                                peran.semester ===
                                                String(mk.semester)
                                              ) {
                                                const peranMkName =
                                                  peran.mata_kuliah_nama?.toLowerCase() ||
                                                  "";
                                                const mkName =
                                                  mk.nama.toLowerCase();
                                                const mkKode =
                                                  mk.kode.toLowerCase();

                                                return (
                                                  peranMkName.includes(
                                                    mkName
                                                  ) ||
                                                  mkName.includes(
                                                    peranMkName
                                                  ) ||
                                                  peranMkName.includes(
                                                    mkKode
                                                  ) ||
                                                  mkKode.includes(
                                                    peranMkName
                                                  ) ||
                                                  peranMkName
                                                    .split(" ")
                                                    .some((word) =>
                                                      mkName.includes(word)
                                                    )
                                                );
                                              }
                                              return false;
                                            }
                                          );

                                        if (matchingPeran) {
                                          isPerfectMatch = true;
                                          matchReason = `${matchingPeran.tipe_peran} untuk ${mk.nama} Semester ${mk.semester}`;
                                        }
                                      } else if (
                                        draggedDosen.peran_utama ===
                                        "dosen_mengajar"
                                      ) {
                                        if (
                                          draggedDosen.peran_kurikulum_mengajar
                                        ) {
                                          // More flexible matching for dosen mengajar
                                          const peranKurikulum =
                                            draggedDosen.peran_kurikulum_mengajar.toLowerCase();
                                          const mkName = mk.nama.toLowerCase();
                                          const mkKode = mk.kode.toLowerCase();

                                          // Check if this dosen's peran_kurikulum_mengajar matches the mata kuliah
                                          if (
                                            peranKurikulum.includes(mkName) ||
                                            mkName.includes(peranKurikulum) ||
                                            peranKurikulum.includes(mkKode) ||
                                            mkKode.includes(peranKurikulum) ||
                                            mkName
                                              .split(" ")
                                              .some((word) =>
                                                peranKurikulum.includes(word)
                                              ) ||
                                            peranKurikulum
                                              .split(" ")
                                              .some((word) =>
                                                mkName.includes(word)
                                              )
                                          ) {
                                            isPerfectMatch = true;
                                            matchReason = `Dosen Mengajar untuk ${mk.nama}`;
                                          }
                                        }
                                      }

                                      // VALIDASI SESI: Cek apakah dosen mengajar sudah mendapat sesi penuh
                                      if (
                                        draggedDosen.peran_utama ===
                                        "dosen_mengajar"
                                      ) {
                                        // Hitung sesi yang sudah didapat dosen ini di semester aktif
                                        const existingAssignments =
                                          Object.entries(assignedDosen).filter(
                                            ([pblId, dosenList]) => {
                                              // Cari PBL yang ada di semester yang sama
                                              const pblInSemester =
                                                Object.values(pblData)
                                                  .flat()
                                                  .find(
                                                    (p) =>
                                                      p.id === Number(pblId) &&
                                                      p.mata_kuliah_kode ===
                                                        mk.kode
                                                  );
                                              return (
                                                pblInSemester &&
                                                dosenList.some(
                                                  (d) =>
                                                    d.id === draggedDosen.id
                                                )
                                              );
                                            }
                                          );

                                        const sesiYangSudahDidapat =
                                          existingAssignments.length * 5; // Setiap assignment = 5 sesi

                                        // Jika dosen mengajar sudah mendapat sesi 5x50 menit atau lebih, tolak assignment
                                        if (sesiYangSudahDidapat >= 5) {
                                          setError(
                                            `Dosen ${draggedDosen.name} sudah mendapat sesi mengajar ${sesiYangSudahDidapat}×50 menit. Dosen mengajar maksimal hanya boleh mendapat 1 assignment (5×50 menit) untuk distribusi yang adil.`
                                          );
                                          return;
                                        }
                                      }

                                      // VALIDASI BLOK: Cek apakah dosen sudah di-assign ke blok yang sama
                                      const currentBlok = mk.blok;
                                      if (currentBlok) {
                                        let isDosenAlreadyAssignedToSameBlok =
                                          false;

                                        // Cek di semua semester
                                        for (const semester of Object.keys(
                                          kelompokKecilListBySemester
                                        )) {
                                          const semesterData =
                                            kelompokKecilListBySemester[
                                              semester
                                            ];
                                          if (!semesterData) continue;

                                          const semesterMk =
                                            blokMataKuliah.filter(
                                              (mk) =>
                                                mk.semester === Number(semester)
                                            );

                                          // Cek apakah ada mata kuliah dengan blok yang sama
                                          const sameBlokMk = semesterMk.find(
                                            (mk) => mk.blok === currentBlok
                                          );
                                          if (sameBlokMk) {
                                            // Cek apakah dosen ini sudah di-assign ke blok yang sama
                                            const semesterPbls =
                                              pblData[sameBlokMk.kode] || [];
                                            for (const pbl of semesterPbls) {
                                              if (
                                                pbl.id &&
                                                assignedDosen[pbl.id]
                                              ) {
                                                const isDosenAssigned =
                                                  assignedDosen[pbl.id].some(
                                                    (assignedDosen: any) =>
                                                      assignedDosen.id ===
                                                      draggedDosen.id
                                                  );
                                                if (isDosenAssigned) {
                                                  isDosenAlreadyAssignedToSameBlok =
                                                    true;
                                                  break;
                                                }
                                              }
                                            }
                                            if (
                                              isDosenAlreadyAssignedToSameBlok
                                            )
                                              break;
                                          }
                                        }

                                        if (isDosenAlreadyAssignedToSameBlok) {
                                          setError(
                                            `Dosen ${draggedDosen.name} sudah di-assign ke Blok ${currentBlok}. Satu dosen tidak boleh di-assign ke blok yang sama untuk distribusi yang adil.`
                                          );
                                          return;
                                        }
                                      }

                                      // Jika tidak ada perfect match dan bukan standby, berikan warning tapi tetap izinkan
                                      // Validasi peran sudah dihapus, hanya keahlian yang penting
                                      if (!isPerfectMatch && !isStandby) {
                                        const isKeahlianMatch =
                                          checkKeahlianMatch(draggedDosen, mk);
                                        const isDosenMengajar =
                                          draggedDosen.peran_utama ===
                                          "dosen_mengajar";

                                        // Validasi peran sudah dihapus, hanya keahlian yang penting
                                      }
                                      setIsMovingDosen(true);
                                      try {
                                        // Jika draggedFromPBLId ada, unassign dulu dari PBL asal
                                        if (draggedFromPBLId) {
                                          await api.delete(
                                            `/pbls/${draggedFromPBLId}/unassign-dosen/${draggedDosen.id}`
                                          );

                                          // PERBAIKAN: Update role assignments untuk UI coloring
                                          const newRoleAssignments: {
                                            [pblId: number]: {
                                              koordinator?: number[];
                                              timBlok?: number[];
                                            };
                                          } = { ...roleAssignments };

                                          // Hapus dosen dari role assignments di PBL asal
                                          if (
                                            newRoleAssignments[draggedFromPBLId]
                                          ) {
                                            if (
                                              newRoleAssignments[
                                                draggedFromPBLId
                                              ].koordinator
                                            ) {
                                              newRoleAssignments[
                                                draggedFromPBLId
                                              ].koordinator =
                                                newRoleAssignments[
                                                  draggedFromPBLId
                                                ].koordinator!.filter(
                                                  (id) => id !== draggedDosen.id
                                                );
                                            }
                                            if (
                                              newRoleAssignments[
                                                draggedFromPBLId
                                              ].timBlok
                                            ) {
                                              newRoleAssignments[
                                                draggedFromPBLId
                                              ].timBlok = newRoleAssignments[
                                                draggedFromPBLId
                                              ].timBlok!.filter(
                                                (id) => id !== draggedDosen.id
                                              );
                                            }
                                          }

                                          setRoleAssignments(
                                            newRoleAssignments
                                          );

                                          // PERBAIKAN BARU: Refresh data setelah unassign dari PBL asal
                                          try {
                                            // Refresh assignedDosen untuk PBL asal
                                            const assignedRes = await api.post(
                                              "/pbl-generate/get-assignments",
                                              {
                                                pbl_ids: [draggedFromPBLId],
                                              }
                                            );
                                            // PERBAIKAN: Convert data seperti di PBLGenerate.tsx
                                            if (assignedRes.data.success) {
                                              const assignmentsData =
                                                assignedRes.data.data || {};
                                              const assignments =
                                                assignmentsData[
                                                  draggedFromPBLId
                                                ] || [];
                                              const convertedAssignments =
                                                assignments.map(
                                                  (assignment) => ({
                                                    id: assignment.dosen.id,
                                                    name: assignment.dosen.name,
                                                    pbl_role: assignment.role,
                                                    pbl_assignment_count:
                                                      assignment.pbl_assignment_count ||
                                                      0,
                                                    keahlian:
                                                      assignment.dosen
                                                        .keahlian || [],
                                                    dosen_peran:
                                                      assignment.dosen
                                                        .dosen_peran || [],
                                                  })
                                                );
                                              setAssignedDosen((prev) => ({
                                                ...prev,
                                                [draggedFromPBLId]:
                                                  convertedAssignments,
                                              }));
                                            } else {
                                            }

                                            // Refresh dosenList untuk update assignment count
                                            const dosenRes = await api.get(
                                              "/users?role=dosen"
                                            );
                                            setDosenList(dosenRes.data || []);
                                          } catch (error) {}

                                          // PERBAIKAN BARU: Hitung ulang warning setelah unassign dari PBL asal
                                          setTimeout(() => {
                                            recalculateWarnings();
                                          }, 50);

                                          // PERBAIKAN BARU: Cek status generated data setelah drag unassign
                                          checkHasGeneratedData();

                                          // PERBAIKAN BARU: Dispatch event untuk update real-time di Dosen.tsx setelah unassign
                                          window.dispatchEvent(
                                            new CustomEvent(
                                              "pbl-assignment-updated",
                                              {
                                                detail: {
                                                  timestamp: Date.now(),
                                                  dosenId: draggedDosen.id,
                                                  dosenName: draggedDosen.name,
                                                  action: "unassign",
                                                  fromPblId: draggedFromPBLId,
                                                  semester: mk.semester,
                                                  blok: mk.blok,
                                                  mataKuliah: mk.nama,
                                                  mataKuliahKode: mk.kode,
                                                },
                                              }
                                            )
                                          );
                                        }

                                        // Assign ke SEMUA PBL dalam mata kuliah yang sama
                                        const allPBLsInMataKuliah =
                                          Object.values(pblData)
                                            .flat()
                                            .filter(
                                              (p) =>
                                                p.mata_kuliah_kode === mk.kode
                                            );

                                        const assignPromises =
                                          allPBLsInMataKuliah.map(
                                            async (targetPbl) => {
                                              // Skip jika dosen sudah ada di PBL ini
                                              const existingAssigned =
                                                assignedDosen[targetPbl.id!] ||
                                                [];
                                              if (
                                                existingAssigned.some(
                                                  (d) =>
                                                    d.id === draggedDosen.id
                                                )
                                              ) {
                                                return Promise.resolve();
                                              }

                                              // Tentukan role berdasarkan dosen_peran
                                              let role = "dosen_mengajar"; // default
                                              const dosenPeran =
                                                draggedDosen.dosen_peran?.find(
                                                  (peran: any) =>
                                                    peran.semester ===
                                                      mk.semester &&
                                                    (peran.tipe_peran ===
                                                      "koordinator" ||
                                                      peran.tipe_peran ===
                                                        "tim_blok")
                                                );
                                              if (dosenPeran) {
                                                role = dosenPeran.tipe_peran;
                                              }

                                              return api.post(
                                                `/pbls/${targetPbl.id}/assign-dosen`,
                                                {
                                                  dosen_id: draggedDosen.id,
                                                  role: role,
                                                }
                                              );
                                            }
                                          );

                                        await Promise.all(assignPromises);

                                        // PERBAIKAN: Update role assignments untuk UI coloring
                                        const newRoleAssignments: {
                                          [pblId: number]: {
                                            koordinator?: number[];
                                            timBlok?: number[];
                                          };
                                        } = { ...roleAssignments };

                                        // Tentukan peran dosen berdasarkan dosen_peran dari database
                                        const dosenPeran =
                                          draggedDosen.dosen_peran?.find(
                                            (peran: any) =>
                                              peran.semester === mk.semester &&
                                              (peran.tipe_peran ===
                                                "koordinator" ||
                                                peran.tipe_peran === "tim_blok")
                                          );

                                        if (dosenPeran) {
                                          allPBLsInMataKuliah.forEach(
                                            (targetPbl) => {
                                              if (targetPbl.id) {
                                                if (
                                                  !newRoleAssignments[
                                                    targetPbl.id
                                                  ]
                                                ) {
                                                  newRoleAssignments[
                                                    targetPbl.id
                                                  ] = {};
                                                }

                                                if (
                                                  dosenPeran.tipe_peran ===
                                                  "koordinator"
                                                ) {
                                                  if (
                                                    !newRoleAssignments[
                                                      targetPbl.id
                                                    ].koordinator
                                                  ) {
                                                    newRoleAssignments[
                                                      targetPbl.id
                                                    ].koordinator = [];
                                                  }
                                                  if (
                                                    !newRoleAssignments[
                                                      targetPbl.id
                                                    ].koordinator!.includes(
                                                      draggedDosen.id
                                                    )
                                                  ) {
                                                    newRoleAssignments[
                                                      targetPbl.id
                                                    ].koordinator!.push(
                                                      draggedDosen.id
                                                    );
                                                  }
                                                } else if (
                                                  dosenPeran.tipe_peran ===
                                                  "tim_blok"
                                                ) {
                                                  if (
                                                    !newRoleAssignments[
                                                      targetPbl.id
                                                    ].timBlok
                                                  ) {
                                                    newRoleAssignments[
                                                      targetPbl.id
                                                    ].timBlok = [];
                                                  }
                                                  if (
                                                    !newRoleAssignments[
                                                      targetPbl.id
                                                    ].timBlok!.includes(
                                                      draggedDosen.id
                                                    )
                                                  ) {
                                                    newRoleAssignments[
                                                      targetPbl.id
                                                    ].timBlok!.push(
                                                      draggedDosen.id
                                                    );
                                                  }
                                                }
                                              }
                                            }
                                          );
                                        }

                                        setRoleAssignments(newRoleAssignments);

                                        // Refresh all data to ensure real-time updates
                                        await fetchAll();
                                        setSuccess(
                                          isStandby
                                            ? `Dosen ${draggedDosen.name} (Standby) berhasil di-assign ke semua modul ${mk.nama} (${mk.kode}).`
                                            : isPerfectMatch
                                            ? `Dosen ${draggedDosen.name} berhasil di-assign ke semua modul ${mk.nama} (${mk.kode}). ${matchReason}`
                                            : `Dosen ${draggedDosen.name} berhasil di-assign ke semua modul ${mk.nama} (${mk.kode}) (keahlian sesuai).`
                                        );
                                        // Update reporting data secara real-time
                                        await updateReportingData();

                                        // PERBAIKAN BARU: Tunggu sebentar agar data ter-update sebelum fetchAll
                                        setTimeout(async () => {
                                          await fetchAll();

                                          // PERBAIKAN BARU: Hitung ulang warning setelah data ter-refresh
                                          setTimeout(() => {
                                            recalculateWarnings();
                                          }, 100);
                                        }, 200);

                                        // PERBAIKAN BARU: Cek status generated data setelah drag assignment
                                        checkHasGeneratedData();

                                        // Emit custom event untuk notify PBLGenerate.tsx setelah drag-drop berhasil
                                        window.dispatchEvent(
                                          new CustomEvent(
                                            "pbl-assignment-updated"
                                          )
                                        );
                                      } catch (err) {
                                        setError("Gagal assign dosen");
                                        // If assignment fails, refresh data to revert UI changes
                                        await fetchAll();
                                      } finally {
                                        setIsMovingDosen(false);
                                        setDraggedDosen(null);
                                        setDraggedFromPBLId(null);
                                      }
                                    }}
                                  >
                                    <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-4">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                          <div className="flex-1">
                                            <h4 className="font-semibold text-gray-800 dark:text-white/90 text-lg">
                                              {mk.kode} - {mk.nama}
                                            </h4>
                                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                              Modul {pbl.modul_ke} -{" "}
                                              {pbl.nama_modul}
                                              <span className="inline-flex items-center gap-1 bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full text-xs font-semibold ml-2">
                                                <FontAwesomeIcon
                                                  icon={faClock}
                                                  className="w-3 h-3"
                                                />
                                                5x50 menit
                                              </span>
                                            </p>
                                          </div>
                                        </div>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                          {(mk.keahlian_required || []).map(
                                            (keahlian: string, idx: number) => (
                                              <span
                                                key={idx}
                                                className="text-xs px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full font-medium"
                                              >
                                                {keahlian}
                                              </span>
                                            )
                                          )}
                                        </div>
                                      </div>
                                      {/* Status badge ala CSR */}
                                      <div className="flex flex-row items-center gap-2 sm:ml-4">
                                        {statusBadge}
                                      </div>
                                    </div>
                                    {/* Assigned Dosen Section - NEW STYLE */}
                                    {(() => {
                                      const allAssigned = getAllAssignedDosen(
                                        pbl.id!,
                                        mk
                                      );
                                      return allAssigned.length > 0 ? (
                                        <div className="mt-4 p-3 bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-700 rounded-lg">
                                          <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                                            Dosen yang Ditugaskan:
                                          </div>
                                          <div className="flex flex-wrap gap-2">
                                            {allAssigned.map((dosen) => {
                                              const isStandby = Array.isArray(
                                                dosen.keahlian
                                              )
                                                ? dosen.keahlian.some((k) =>
                                                    k
                                                      .toLowerCase()
                                                      .includes("standby")
                                                  )
                                                : (dosen.keahlian || "")
                                                    .toLowerCase()
                                                    .includes("standby");

                                              // PERBAIKAN: Tentukan peran berdasarkan dosen_peran atau pbl_role seperti PBLGenerate.tsx
                                              let pblRole = (dosen as any)
                                                .pbl_role;

                                              // Jika pbl_role tidak ada, cek dosen_peran untuk menentukan peran
                                              if (
                                                !pblRole &&
                                                dosen.dosen_peran
                                              ) {
                                                const currentSemester =
                                                  parseInt(semester.toString());
                                                const currentMataKuliah =
                                                  blokMataKuliahFiltered.map(
                                                    (mk) => mk.kode
                                                  );

                                                const koordinatorPeran =
                                                  dosen.dosen_peran.find(
                                                    (peran: any) =>
                                                      peran.tipe_peran ===
                                                        "koordinator" &&
                                                      peran.semester ===
                                                        String(
                                                          currentSemester
                                                        ) &&
                                                      currentMataKuliah.includes(
                                                        peran.mata_kuliah_kode
                                                      )
                                                  );

                                                const timBlokPeran =
                                                  dosen.dosen_peran.find(
                                                    (peran: any) =>
                                                      peran.tipe_peran ===
                                                        "tim_blok" &&
                                                      peran.semester ===
                                                        String(
                                                          currentSemester
                                                        ) &&
                                                      currentMataKuliah.includes(
                                                        peran.mata_kuliah_kode
                                                      )
                                                  );

                                                if (koordinatorPeran) {
                                                  pblRole = "koordinator";
                                                } else if (timBlokPeran) {
                                                  pblRole = "tim_blok";
                                                } else {
                                                  pblRole = "dosen_mengajar";
                                                }
                                              }

                                              // Fallback jika masih tidak ada peran
                                              if (!pblRole) {
                                                pblRole = "dosen_mengajar";
                                              }

                                              let dosenRole = "Dosen Mengajar";
                                              let avatarColor = "bg-green-500";
                                              let borderColor =
                                                "border-green-200";
                                              let textColor =
                                                "text-green-700 dark:text-green-200";
                                              let bgColor =
                                                "bg-green-100 dark:bg-green-900/40";

                                              if (pblRole === "koordinator") {
                                                dosenRole = "Koordinator";
                                                avatarColor = "bg-blue-500";
                                                borderColor = "border-blue-200";
                                                textColor =
                                                  "text-blue-700 dark:text-blue-200";
                                                bgColor =
                                                  "bg-blue-100 dark:bg-blue-900/20";
                                              } else if (
                                                pblRole === "tim_blok"
                                              ) {
                                                dosenRole = "Tim Blok";
                                                avatarColor = "bg-purple-500";
                                                borderColor =
                                                  "border-purple-200";
                                                textColor =
                                                  "text-purple-700 dark:text-purple-200";
                                                bgColor =
                                                  "bg-purple-100 dark:bg-purple-900/20";
                                              }

                                              // Cek apakah keahlian dosen sesuai dengan mata kuliah
                                              const isKeahlianMatch =
                                                checkKeahlianMatch(dosen, mk);

                                              // PERBAIKAN: Definisikan isKoordinator dan isTimBlok untuk badge logic
                                              const isKoordinator =
                                                pblRole === "koordinator";
                                              const isTimBlok =
                                                pblRole === "tim_blok";

                                              // Prioritas warna: Standby > Default (hijau untuk dosen mengajar)
                                              if (isStandby) {
                                                avatarColor = "bg-yellow-400";
                                                borderColor =
                                                  "border-yellow-200";
                                                textColor =
                                                  "text-yellow-800 dark:text-yellow-200";
                                                bgColor =
                                                  "bg-yellow-100 dark:bg-yellow-900/40";
                                              }
                                              // Hapus logika merah untuk dosen mengajar - semua dosen mengajar tetap hijau

                                              return (
                                                <div
                                                  key={dosen.id}
                                                  className={`flex items-center gap-2 px-3 py-1 rounded-full ${bgColor} ${borderColor}`}
                                                >
                                                  <div
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center relative ${avatarColor}`}
                                                  >
                                                    <span className="text-white text-xs font-bold">
                                                      {dosen.name?.charAt(0) ||
                                                        "?"}
                                                    </span>
                                                    {!isStandby && (
                                                      <span
                                                        className="absolute -top-1 -right-1 bg-blue-500 text-white text-[8px] font-semibold rounded-full flex justify-center items-center w-4 h-4 border border-white dark:border-green-800"
                                                        title="Jumlah penugasan"
                                                      >
                                                        {typeof dosen.pbl_assignment_count ===
                                                        "number"
                                                          ? dosen.pbl_assignment_count
                                                          : 0}
                                                        x
                                                      </span>
                                                    )}
                                                  </div>
                                                  <span
                                                    className={`text-xs font-medium ${textColor}`}
                                                  >
                                                    {dosen.name ||
                                                      "Dosen Tidak Diketahui"}
                                                    <span className="ml-1 text-[10px] opacity-75">
                                                      ({dosenRole})
                                                    </span>
                                                  </span>
                                                  {/* Tombol unassign untuk semua dosen, termasuk standby */}
                                                  <button
                                                    className={`ml-2 p-1 rounded-full transition text-xs ${
                                                      pblRole ===
                                                        "koordinator" ||
                                                      pblRole === "tim_blok"
                                                        ? "text-gray-400 cursor-not-allowed opacity-50"
                                                        : "text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 cursor-pointer"
                                                    }`}
                                                    title={
                                                      pblRole === "koordinator"
                                                        ? "Koordinator tidak dapat dihapus (setting admin)"
                                                        : pblRole === "tim_blok"
                                                        ? "Tim Blok tidak dapat dihapus (setting admin)"
                                                        : "Hapus penugasan"
                                                    }
                                                    onClick={async (e) => {
                                                      e.stopPropagation();

                                                      // VALIDASI: Tidak bisa hapus Koordinator atau Tim Blok
                                                      if (
                                                        pblRole ===
                                                        "koordinator"
                                                      ) {
                                                        setError(
                                                          `Tidak dapat menghapus ${dosen.name} karena merupakan Koordinator yang sudah di-setting oleh admin. Silakan hubungi admin untuk mengubah pengaturan.`
                                                        );
                                                        setTimeout(() => {
                                                          setError(null);
                                                        }, 5000);
                                                        return;
                                                      }

                                                      if (
                                                        pblRole === "tim_blok"
                                                      ) {
                                                        setError(
                                                          `Tidak dapat menghapus ${dosen.name} karena merupakan Tim Blok yang sudah di-setting oleh admin. Silakan hubungi admin untuk mengubah pengaturan.`
                                                        );
                                                        setTimeout(() => {
                                                          setError(null);
                                                        }, 5000);
                                                        return;
                                                      }

                                                      // PERBAIKAN BARU: Validasi yang lebih fleksibel - cek apakah ada data PBL
                                                      const hasPblData =
                                                        Object.keys(pblData)
                                                          .length > 0;
                                                      if (!hasPblData) {
                                                        setError(
                                                          "Tidak dapat melakukan unassign. Silakan generate dosen terlebih dahulu di halaman PBL Generate."
                                                        );
                                                        return;
                                                      }

                                                      try {
                                                        // PERBAIKAN: Cari PBL dalam semester DAN blok yang sama (bukan semua blok dalam semester)
                                                        const currentSemester =
                                                          mk.semester;
                                                        const currentBlok = mk.blok;

                                                        const blokPBLs =
                                                          Object.values(
                                                            pblData || {}
                                                          )
                                                            .flat()
                                                            .filter((p) => {
                                                              const mk = (
                                                                blokMataKuliah ||
                                                                []
                                                              ).find(
                                                                (m) =>
                                                                  m.kode ===
                                                                  p.mata_kuliah_kode
                                                              );
                                                              // PERBAIKAN: Filter berdasarkan semester DAN blok
                                                              const isMatch =
                                                                mk &&
                                                                mk.semester ==
                                                                  currentSemester &&
                                                                mk.blok === currentBlok;
                                                              return isMatch;
                                                            });

                                                        const removePromises = (
                                                          blokPBLs || []
                                                        ).map(
                                                          async (
                                                            blokPbl
                                                          ) => {
                                                            const blokAssigned =
                                                              assignedDosen[
                                                                blokPbl.id!
                                                              ] || [];
                                                            if (
                                                              blokAssigned.some(
                                                                (d) =>
                                                                  d.id ===
                                                                  dosen.id
                                                              )
                                                            ) {
                                                              return api.delete(
                                                                `/pbls/${blokPbl.id}/unassign-dosen/${dosen.id}`
                                                              );
                                                            }
                                                            return Promise.resolve();
                                                          }
                                                        );

                                                        const unassignResults =
                                                          await Promise.all(
                                                            removePromises
                                                          );

                                                        // Auto-delete dari CSR jika dosen ada di CSR assignment
                                                        let csrRemoved = false;
                                                        try {
                                                          // Cek dan hapus assignment CSR untuk dosen ini
                                                          // Endpoint backend akan mengecek apakah dosen ada di CSR mapping
                                                          // dan menghapusnya jika ada berdasarkan semester dan blok yang sama
                                                          const currentBlok =
                                                            mk.blok;
                                                          const csrResponse =
                                                            await api.delete(
                                                              `/dosen/${dosen.id}/csr-assignments?semester=${currentSemester}&blok=${currentBlok}`
                                                            );
                                                          if (
                                                            csrResponse.data
                                                              ?.removed_count >
                                                            0
                                                          ) {
                                                            csrRemoved = true;
                                                          }
                                                        } catch (csrError: any) {
                                                          // Abaikan error jika dosen tidak ada di CSR
                                                          // Error ini normal jika dosen tidak di-assign ke CSR
                                                        }

                                                        // PERBAIKAN: Cek apakah ada yang gagal
                                                        const failedUnassigns =
                                                          unassignResults.filter(
                                                            (result) =>
                                                              result &&
                                                              typeof result ===
                                                                "object" &&
                                                              result.status !==
                                                                200
                                                          );
                                                        if (
                                                          failedUnassigns.length >
                                                          0
                                                        ) {
                                                        }

                                                        // PERBAIKAN: Update role assignments untuk UI coloring
                                                        const newRoleAssignments: {
                                                          [pblId: number]: {
                                                            koordinator?: number[];
                                                            timBlok?: number[];
                                                          };
                                                        } = {
                                                          ...roleAssignments,
                                                        };

                                                        // Hapus dosen dari role assignments
                                                        (
                                                          blokPBLs || []
                                                        ).forEach(
                                                          (blokPbl) => {
                                                            if (
                                                              blokPbl.id
                                                            ) {
                                                              if (
                                                                newRoleAssignments[
                                                                  blokPbl.id
                                                                ]
                                                              ) {
                                                                if (
                                                                  newRoleAssignments[
                                                                    blokPbl
                                                                      .id
                                                                  ].koordinator
                                                                ) {
                                                                  newRoleAssignments[
                                                                    blokPbl.id
                                                                  ].koordinator =
                                                                    newRoleAssignments[
                                                                      blokPbl
                                                                        .id
                                                                    ].koordinator!.filter(
                                                                      (id) =>
                                                                        id !==
                                                                        dosen.id
                                                                    );
                                                                }
                                                                if (
                                                                  newRoleAssignments[
                                                                    blokPbl
                                                                      .id
                                                                  ].timBlok
                                                                ) {
                                                                  newRoleAssignments[
                                                                    blokPbl.id
                                                                  ].timBlok =
                                                                    newRoleAssignments[
                                                                      blokPbl
                                                                        .id
                                                                    ].timBlok!.filter(
                                                                      (id) =>
                                                                        id !==
                                                                        dosen.id
                                                                    );
                                                                }
                                                              }
                                                            }
                                                          }
                                                        );

                                                        setRoleAssignments(
                                                          newRoleAssignments
                                                        );

                                                        // Refresh all data to ensure real-time updates
                                                        await fetchAll();

                                                        // Set success message dengan info CSR jika dihapus
                                                        const successMessage =
                                                          csrRemoved
                                                            ? `Dosen ${dosen.name} berhasil di-unassign dari semua modul PBL Blok ${mk.blok} Semester ${mk.semester} dan juga dihapus dari assignment CSR terkait.`
                                                            : `Dosen ${dosen.name} berhasil di-unassign dari semua modul PBL Blok ${mk.blok} Semester ${mk.semester}.`;
                                                        setSuccess(
                                                          successMessage
                                                        );

                                                        // Update reporting data secara real-time
                                                        await updateReportingData();

                                                        // PERBAIKAN BARU: Refresh dosenList untuk update assignment count
                                                        try {
                                                          const dosenRes =
                                                            await api.get(
                                                              "/users?role=dosen"
                                                            );
                                                          setDosenList(
                                                            dosenRes.data || []
                                                          );
                                                        } catch (error) {}

                                                        // PERBAIKAN BARU: Refresh data setelah unassign berhasil
                                                        await fetchAll();

                                                        // PERBAIKAN BARU: Hitung ulang warning setelah data ter-refresh
                                                        setTimeout(() => {
                                                          recalculateWarnings();
                                                        }, 100);

                                                        // PERBAIKAN BARU: Cek status generated data setelah unassign
                                                        checkHasGeneratedData();

                                                        // PERBAIKAN BARU: Dispatch event untuk update real-time di Dosen.tsx
                                                        window.dispatchEvent(
                                                          new CustomEvent(
                                                            "pbl-assignment-updated",
                                                            {
                                                              detail: {
                                                                timestamp:
                                                                  Date.now(),
                                                                dosenId:
                                                                  dosen.id,
                                                                dosenName:
                                                                  dosen.name,
                                                                action:
                                                                  "unassign",
                                                                semester:
                                                                  mk.semester,
                                                                blok: mk.blok,
                                                                pblIds: (
                                                                  blokPBLs ||
                                                                  []
                                                                )
                                                                  .map(
                                                                    (p) => p.id
                                                                  )
                                                                  .filter(
                                                                    Boolean
                                                                  ),
                                                                csrRemoved:
                                                                  csrRemoved,
                                                              },
                                                            }
                                                          )
                                                        );

                                                        // Dispatch event untuk update CSRDetail.tsx jika dosen juga dihapus dari CSR
                                                        if (csrRemoved) {
                                                          window.dispatchEvent(
                                                            new CustomEvent(
                                                              "csr-assignment-updated",
                                                              {
                                                                detail: {
                                                                  timestamp:
                                                                    Date.now(),
                                                                  dosenId:
                                                                    dosen.id,
                                                                  dosenName:
                                                                    dosen.name,
                                                                  action:
                                                                    "removed-from-pbl",
                                                                  semester:
                                                                    currentSemester,
                                                                  blok: mk.blok,
                                                                },
                                                              }
                                                            )
                                                          );
                                                        }
                                                      } catch (err) {
                                                        const errorMsg =
                                                          err &&
                                                          typeof err ===
                                                            "object" &&
                                                          "response" in err &&
                                                          err.response &&
                                                          typeof err.response ===
                                                            "object" &&
                                                          "data" in
                                                            err.response &&
                                                          err.response.data &&
                                                          typeof err.response
                                                            .data ===
                                                            "object" &&
                                                          "message" in
                                                            err.response.data &&
                                                          typeof err.response
                                                            .data.message ===
                                                            "string"
                                                            ? err.response.data
                                                                .message
                                                            : "Gagal unassign dosen";
                                                        setError(
                                                          String(errorMsg)
                                                        );
                                                        // If unassignment fails, refresh data to revert UI changes
                                                        await fetchAll();
                                                      }
                                                    }}
                                                  >
                                                    <FontAwesomeIcon
                                                      icon={faTimes}
                                                      className="w-3 h-3"
                                                    />
                                                  </button>
                                                </div>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="bg-gray-50 dark:bg-gray-800/50 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center mt-2">
                                          {Object.keys(pblData).length === 0 ? (
                                            <div className="text-center">
                                              <div className="text-sm text-red-500 dark:text-red-400 mb-2 font-medium">
                                                ⚠️ Assignment Manual Tidak
                                                Tersedia
                                              </div>
                                              <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                                Silakan generate dosen terlebih
                                                dahulu di halaman PBL Generate
                                              </div>
                                              <div className="text-xs text-blue-500 dark:text-blue-400">
                                                Setelah generate, Anda dapat
                                                melakukan assignment manual di
                                                sini
                                              </div>
                                            </div>
                                          ) : (
                                            <>
                                              <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                                Seret dosen dari semester{" "}
                                                {mk.semester} ke sini
                                              </div>
                                              <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                                                Hanya dosen dari semester yang
                                                sama yang dapat di-assign
                                              </div>
                                              <div className="text-xs text-yellow-600 dark:text-yellow-400 mb-2">
                                                Dosen standby dapat di-assign ke
                                                modul manapun
                                              </div>
                                              {availableDosen.length > 0 ? (
                                                <div className="text-xs text-gray-400 dark:text-gray-500">
                                                  {availableDosen.length} dosen
                                                  tersedia dengan keahlian yang
                                                  sesuai
                                                </div>
                                              ) : (
                                                <div className="text-xs text-red-400 dark:text-red-300">
                                                  Tidak ada dosen dengan
                                                  keahlian yang sesuai
                                                </div>
                                              )}
                                            </>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              });
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        {/* Dosen Section (1 kolom) */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
              Dosen Tersedia (
              {availableDosenList.length + standbyDosenList.length})
            </h3>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FontAwesomeIcon
                    icon={faSearch}
                    className="h-4 w-4 text-gray-400"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Cari dosen berdasarkan nama atau NID..."
                  value={searchDosen}
                  onChange={(e) => setSearchDosen(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                />
                {searchDosen && (
                  <button
                    onClick={() => setSearchDosen("")}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                  >
                    <FontAwesomeIcon icon={faTimes} className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>

            {/* Dosen Reguler */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-brand-500"></div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Dosen Reguler ({availableDosenList.length})
                </h4>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto hide-scroll">
                {availableDosenList.length > 0 ? (
                  availableDosenList.map((dosen) => {
                    // Calculate peran_counts based on dosen_peran AND PBL assignments
                    const peran_counts = {
                      koordinator: 0,
                      tim_blok: 0,
                      dosen_mengajar: 0,
                    };

                    // PERBAIKAN: Hitung per semester, bukan per modul
                    const semesterCounts = {
                      koordinator: new Set(),
                      tim_blok: new Set(),
                      dosen_mengajar: new Set(),
                    };

                    // Count from dosen_peran (curriculum roles) - PERBAIKAN: Hitung per semester juga
                    if (dosen.dosen_peran && Array.isArray(dosen.dosen_peran)) {
                      dosen.dosen_peran.forEach((peran: any) => {
                        const semester = peran.semester;
                        const key = `${dosen.id}-${semester}`;
                        if (peran.tipe_peran === "koordinator") {
                          semesterCounts.koordinator.add(key);
                        } else if (peran.tipe_peran === "tim_blok") {
                          semesterCounts.tim_blok.add(key);
                        }
                        // PERBAIKAN: Dosen Mengajar dari dosen_peran TIDAK dihitung untuk badge
                        // Hanya dari PBL assignments (real-time)
                      });
                    }

                    // Count from PBL assignments (current assignments) - REAL-TIME
                    Object.entries(assignedDosen).forEach(
                      ([pblIdStr, assignedDosenList]) => {
                        const pblId = parseInt(pblIdStr);
                        if (pblId && assignedDosenList) {
                          // Cari semester dari PBL ID ini
                          let semester = null;
                          Object.entries(pblData).forEach(([mkKode, pbls]) => {
                            const pbl = pbls.find((p) => p.id === pblId);
                            if (pbl) {
                              // Cari mata kuliah untuk mendapatkan semester
                              const mk = blokMataKuliah.find(
                                (m) => m.kode === mkKode
                              );
                              if (mk) {
                                semester = mk.semester;
                              }
                            }
                          });

                          if (semester) {
                            assignedDosenList.forEach((assignedDosen) => {
                              if (assignedDosen.id === dosen.id) {
                                const key = `${assignedDosen.id}-${semester}`;
                                if (assignedDosen.pbl_role === "koordinator") {
                                  semesterCounts.koordinator.add(key);
                                } else if (
                                  assignedDosen.pbl_role === "tim_blok"
                                ) {
                                  semesterCounts.tim_blok.add(key);
                                } else if (
                                  assignedDosen.pbl_role === "dosen_mengajar"
                                ) {
                                  semesterCounts.dosen_mengajar.add(key);
                                }
                              }
                            });
                          }
                        }
                      }
                    );

                    // Set counts berdasarkan unique semester assignments
                    peran_counts.koordinator = semesterCounts.koordinator.size;
                    peran_counts.tim_blok = semesterCounts.tim_blok.size;
                    peran_counts.dosen_mengajar =
                      semesterCounts.dosen_mengajar.size;

                    // Add peran_counts to dosen object
                    const dosenWithCounts = { ...dosen, peran_counts };

                    return (
                      <div
                        key={dosenWithCounts.id}
                        className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all duration-200 cursor-move"
                        draggable
                        onDragStart={(e) => handleDragStart(e, dosenWithCounts)}
                        onDragEnd={handleDragEnd}
                        style={{ userSelect: "none", WebkitUserSelect: "none" }}
                      >
                        {/* Header dengan Avatar dan Info Dasar */}
                        <div className="flex items-start gap-3 mb-3">
                          <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center relative">
                            <span className="text-white text-sm font-bold">
                              {dosenWithCounts.name?.charAt(0) || "?"}
                            </span>
                            <span
                              className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-semibold rounded-full flex justify-center items-center w-6 h-6 border-2 border-white dark:border-gray-800"
                              title="Jumlah penugasan"
                            >
                              {typeof dosenWithCounts.pbl_assignment_count ===
                              "number"
                                ? dosenWithCounts.pbl_assignment_count
                                : 0}
                              x
                            </span>
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold text-gray-800 dark:text-white/90 text-sm mb-1">
                              {dosenWithCounts.name}
                            </div>
                            <div className="text-xs text-gray-500 dark:text-gray-400">
                              NID: {dosenWithCounts.nid}
                            </div>
                          </div>
                        </div>
                        {/* Peran Counts Badge */}
                        <div className="mb-3 flex flex-wrap gap-2">
                          {dosenWithCounts.peran_counts.koordinator > 0 && (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs">
                              Koordinator (
                              {dosenWithCounts.peran_counts.koordinator})
                            </span>
                          )}
                          {dosenWithCounts.peran_counts.tim_blok > 0 && (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs">
                              Tim Blok ({dosenWithCounts.peran_counts.tim_blok})
                            </span>
                          )}
                          {dosenWithCounts.peran_counts.dosen_mengajar > 0 && (
                            <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 text-xs">
                              Dosen Mengajar (
                              {dosenWithCounts.peran_counts.dosen_mengajar})
                            </span>
                          )}
                          {dosenWithCounts.peran_counts.koordinator === 0 &&
                            dosenWithCounts.peran_counts.tim_blok === 0 &&
                            dosenWithCounts.peran_counts.dosen_mengajar ===
                              0 && (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-200 text-gray-700 text-xs">
                                Standby
                              </span>
                            )}
                        </div>
                        {/* Info Section dengan Layout yang Lebih Jelas */}
                        <div className="space-y-3">
                          {/* Mata Kuliah/Peran Kurikulum */}
                          {/* Mata Kuliah/Peran Kurikulum */}
                          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                              <div className="w-1 h-1 rounded-full bg-purple-500"></div>
                              Mata Kuliah / Peran Kurikulum
                            </div>
                            {["koordinator", "tim_blok", "dosen_mengajar"].map(
                              (tipe) => {
                                // PERBAIKAN: Pisahkan logika untuk PBL assignments (real-time) dan curriculum roles (static)
                                const peranKurikulumList = [];
                                const semesterKurikulum = new Map(); // Untuk menghindari duplikasi per semester

                                // 1. Ambil data dari dosen_peran (curriculum roles) - STATIC
                                if (
                                  Array.isArray(dosenWithCounts.dosen_peran)
                                ) {
                                  dosenWithCounts.dosen_peran.forEach(
                                    (peran) => {
                                      if (peran.tipe_peran === tipe) {
                                        const semester = peran.semester;
                                        const key = `${dosenWithCounts.id}-${semester}`;

                                        // Hanya tampilkan jika bukan dosen_mengajar (karena dosen_mengajar harus real-time)
                                        if (tipe !== "dosen_mengajar") {
                                          if (!semesterKurikulum.has(key)) {
                                            semesterKurikulum.set(key, peran);
                                          }
                                        }
                                      }
                                    }
                                  );
                                }

                                // Convert Map to Array
                                peranKurikulumList.push(
                                  ...Array.from(semesterKurikulum.values())
                                );

                                // 2. Ambil data dari PBL assignments yang real-time - REAL-TIME
                                const pblAssignmentList = [];
                                const semesterAssignments = new Map(); // Untuk menghindari duplikasi per semester

                                Object.entries(assignedDosen).forEach(
                                  ([pblIdStr, assignedDosenList]) => {
                                    const pblId = parseInt(pblIdStr);
                                    if (pblId && assignedDosenList) {
                                      // Cari semester dari PBL ID ini
                                      let semester = null;
                                      let mataKuliahKode = null;
                                      let mataKuliahNama = null;
                                      let blok = null;

                                      // Cari dari pblData yang sedang aktif
                                      Object.entries(pblData).forEach(
                                        ([mkKode, pbls]) => {
                                          const pbl = pbls.find(
                                            (p) => p.id === pblId
                                          );
                                          if (pbl) {
                                            // Cari mata kuliah untuk mendapatkan semester
                                            const mk = blokMataKuliah.find(
                                              (m) => m.kode === mkKode
                                            );
                                            if (mk) {
                                              semester = mk.semester;
                                              mataKuliahKode = mkKode;
                                              mataKuliahNama = mk.nama;
                                              blok = mk.blok;
                                            }
                                          }
                                        }
                                      );

                                      if (semester && mataKuliahKode) {
                                        assignedDosenList.forEach(
                                          (assignedDosen) => {
                                            if (
                                              assignedDosen.id ===
                                                dosenWithCounts.id &&
                                              assignedDosen.pbl_role === tipe
                                            ) {
                                              const key = `${assignedDosen.id}-${semester}`;

                                              if (
                                                !semesterAssignments.has(key)
                                              ) {
                                                semesterAssignments.set(key, {
                                                  mata_kuliah_kode:
                                                    mataKuliahKode,
                                                  mata_kuliah_nama:
                                                    mataKuliahNama,
                                                  semester: semester,
                                                  blok: blok,
                                                  tipe_peran: tipe,
                                                  source: "pbl_assignment",
                                                });
                                              }
                                            }
                                          }
                                        );
                                      }
                                    }
                                  }
                                );

                                // Convert Map to Array
                                pblAssignmentList.push(
                                  ...Array.from(semesterAssignments.values())
                                );

                                // PERBAIKAN: Gunakan perhitungan yang sama dengan badge untuk konsistensi
                                const expectedCount =
                                  dosenWithCounts.peran_counts[tipe];

                                // Gabungkan kedua list dengan deduplication per semester
                                const combinedPeranList = new Map();

                                // Tambahkan dari peranKurikulumList
                                peranKurikulumList.forEach((peran) => {
                                  const key = `${peran.mata_kuliah_kode}-${peran.semester}`;
                                  if (!combinedPeranList.has(key)) {
                                    combinedPeranList.set(key, peran);
                                  }
                                });

                                // Tambahkan dari pblAssignmentList
                                pblAssignmentList.forEach((peran) => {
                                  const key = `${peran.mata_kuliah_kode}-${peran.semester}`;
                                  if (!combinedPeranList.has(key)) {
                                    combinedPeranList.set(key, peran);
                                  }
                                });

                                const peranList = Array.from(
                                  combinedPeranList.values()
                                );
                                const actualCount = peranList.length;

                                if (peranList.length === 0) return null;
                                let label = "";
                                let badgeClass = "";
                                if (tipe === "koordinator") {
                                  label = "Koordinator";
                                  badgeClass = "bg-blue-100 text-blue-700";
                                }
                                if (tipe === "tim_blok") {
                                  label = "Tim Blok";
                                  badgeClass = "bg-green-100 text-green-700";
                                }
                                if (tipe === "dosen_mengajar") {
                                  label = "Dosen Mengajar";
                                  badgeClass = "bg-yellow-100 text-yellow-700";
                                }
                                const rowKey = `${
                                  dosen.id || dosen.nid
                                }_${tipe}`;
                                const isExpanded = !!expandedGroups[rowKey];
                                const isShowAll = !!showAllPeran[rowKey];
                                const peranToShow = isShowAll
                                  ? peranList
                                  : peranList.slice(0, 2);
                                return (
                                  <div key={tipe} className="mb-3">
                                    <button
                                      type="button"
                                      className={`px-2 py-1 rounded text-xs font-semibold ${badgeClass} focus:outline-none cursor-pointer flex items-center gap-1`}
                                      onClick={() => toggleGroup(rowKey)}
                                      title="Klik untuk buka/tutup detail"
                                    >
                                      {label} ({peranList.length})
                                      <FontAwesomeIcon
                                        icon={
                                          isExpanded
                                            ? faChevronUp
                                            : faChevronDown
                                        }
                                        className="ml-1 w-3 h-3"
                                      />
                                    </button>
                                    {isExpanded && (
                                      <ul className="ml-0 mt-2 flex flex-col gap-2">
                                        {peranToShow.map((p, idx) => (
                                          <li
                                            key={idx}
                                            className="flex items-start gap-2 bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 transition"
                                          >
                                            <FontAwesomeIcon
                                              icon={faBookOpen}
                                              className="text-blue-400 mt-1 w-3 h-3"
                                            />
                                            <div>
                                              <div className="font-medium text-brand-400 text-sm">
                                                {p.mata_kuliah_nama ??
                                                  (p as any)?.nama_mk ??
                                                  ""}
                                              </div>
                                              <div className="text-xs text-gray-400">
                                                Semester {p.semester} | Blok{" "}
                                                {p.blok}
                                              </div>
                                            </div>
                                          </li>
                                        ))}
                                      </ul>
                                    )}
                                  </div>
                                );
                              }
                            )}
                            {(!Array.isArray(dosenWithCounts.dosen_peran) ||
                              dosenWithCounts.dosen_peran.length === 0) && (
                              <span>-</span>
                            )}
                          </div>
                          {/* Keahlian Section */}
                          <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                            <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                              <div className="w-1 h-1 rounded-full bg-orange-500"></div>
                              Keahlian
                            </div>
                            <div className="flex flex-wrap gap-1">
                              {parseKeahlian(dosenWithCounts.keahlian).map(
                                (k, idx) => (
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
                                )
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                      <FontAwesomeIcon
                        icon={faUsers}
                        className="w-6 h-6 text-gray-400"
                      />
                    </div>
                    <div className="text-sm">Tidak ada dosen reguler</div>
                  </div>
                )}
              </div>
            </div>
            {/* Dosen Standby */}
            <div className="mb-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Dosen Standby ({standbyDosenList.length})
                </h4>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto hide-scroll">
                {standbyDosenList.length > 0 ? (
                  standbyDosenList.map((dosen) => (
                    <div
                      key={dosen.id}
                      className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl hover:shadow-md transition-all duration-200 cursor-move"
                      draggable
                      onDragStart={(e) => handleDragStart(e, dosen)}
                      onDragEnd={handleDragEnd}
                      style={{ userSelect: "none", WebkitUserSelect: "none" }}
                    >
                      {/* Header dengan Avatar dan Info Dasar */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center relative">
                          <span className="text-white text-sm font-bold">
                            {dosen.name?.charAt(0) || "?"}
                          </span>
                          <span
                            className="absolute -top-1 -right-1 bg-blue-500 text-white text-[10px] font-semibold rounded-full flex justify-center items-center w-6 h-6 border-2 border-white dark:border-gray-800"
                            title="Jumlah penugasan"
                          >
                            {typeof dosen.pbl_assignment_count === "number"
                              ? dosen.pbl_assignment_count
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
                  ))
                ) : (
                  <div className="text-center py-6 text-gray-400 dark:text-gray-500">
                    <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
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

      {/* Modal Lihat Mahasiswa */}
      <AnimatePresence>
        {showMahasiswaModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <motion.div
              key="modal-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowMahasiswaModal(null)}
            ></motion.div>
            <motion.div
              key="modal-content"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setShowMahasiswaModal(null)}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              {/* Modal Content Here */}
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Mahasiswa Kelompok {showMahasiswaModal.kelompok.nama_kelompok}
              </h3>
              {/* Table Mahasiswa dengan pagination dan zebra row ala MataKuliah.tsx */}
              <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-white/[0.05] bg-white dark:bg-white/[0.03]">
                <div className="max-w-full overflow-x-auto hide-scroll">
                  <table className="min-w-full text-sm">
                    <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                      <tr>
                        <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                          Nama Mahasiswa
                        </th>
                        <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                          NIM
                        </th>
                        <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                          Angkatan
                        </th>
                        <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                          IPK
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        const pageSize = 5;
                        const total = showMahasiswaModal.mahasiswa.length;
                        const totalPages = Math.ceil(total / pageSize);
                        const paginated = showMahasiswaModal.mahasiswa.slice(
                          (pageMahasiswaModal - 1) * pageSize,
                          pageMahasiswaModal * pageSize
                        );
                        return paginated.length > 0 ? (
                          paginated.map((mhs, idx) => (
                            <tr
                              key={mhs.nim}
                              className={
                                idx % 2 === 1
                                  ? "bg-gray-50 dark:bg-white/[0.02]"
                                  : ""
                              }
                            >
                              <td className="px-6 py-4 text-gray-800 dark:text-white/90">
                                {mhs.nama}
                              </td>
                              <td className="px-6 py-4 text-gray-800 dark:text-white/90">
                                {mhs.nim}
                              </td>
                              <td className="px-6 py-4 text-gray-800 dark:text-white/90">
                                {mhs.angkatan}
                              </td>
                              <td className="px-6 py-4 text-gray-800 dark:text-white/90">
                                {mhs.ipk}
                              </td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td
                              colSpan={4}
                              className="text-center py-8 text-gray-400 dark:text-gray-300"
                            >
                              Tidak ada mahasiswa.
                            </td>
                          </tr>
                        );
                      })()}
                    </tbody>
                  </table>
                </div>
                {/* Pagination */}
                {showMahasiswaModal.mahasiswa.length > 5 && (
                  <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 dark:border-white/[0.05]">
                    <div className="text-sm text-gray-500 dark:text-gray-400">
                      Menampilkan{" "}
                      {Math.min(5, showMahasiswaModal.mahasiswa.length)} dari{" "}
                      {showMahasiswaModal.mahasiswa.length} mahasiswa
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() =>
                          setPageMahasiswaModal(
                            Math.max(1, pageMahasiswaModal - 1)
                          )
                        }
                        disabled={pageMahasiswaModal === 1}
                        className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 disabled:text-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:disabled:text-gray-600"
                      >
                        Sebelumnya
                      </button>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {pageMahasiswaModal} dari{" "}
                        {Math.ceil(showMahasiswaModal.mahasiswa.length / 5)}
                      </span>
                      <button
                        onClick={() =>
                          setPageMahasiswaModal(
                            Math.min(
                              Math.ceil(
                                showMahasiswaModal.mahasiswa.length / 5
                              ),
                              pageMahasiswaModal + 1
                            )
                          )
                        }
                        disabled={
                          pageMahasiswaModal >=
                          Math.ceil(showMahasiswaModal.mahasiswa.length / 5)
                        }
                        className="px-3 py-1 text-sm text-gray-500 hover:text-gray-700 disabled:text-gray-300 dark:text-gray-400 dark:hover:text-gray-200 dark:disabled:text-gray-600"
                      >
                        Selanjutnya
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}

        {/* Modal Konfirmasi Keahlian Tidak Sesuai */}
        {showKeahlianConfirmModal && pendingAssignment && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => {
                setShowKeahlianConfirmModal(false);
                setPendingAssignment(null);
              }}
            ></div>
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowKeahlianConfirmModal(false);
                  setPendingAssignment(null);
                }}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>

              <div className="flex items-center justify-between pb-6">
                <div className="flex items-center">
                  <FontAwesomeIcon
                    icon={faExclamationTriangle}
                    className="text-orange-500 mr-3 text-2xl"
                  />
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    Konfirmasi Assignment
                  </h2>
                </div>
              </div>

              <div className="mb-6">
                <p className="text-gray-700 dark:text-gray-300 mb-4 text-base">
                  Yakin ingin assign{" "}
                  <strong className="text-gray-900 dark:text-white">
                    {pendingAssignment.dosen.name}
                  </strong>
                  ?
                </p>

                <div className="bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl p-4 shadow-sm">
                  <div className="flex items-center mb-3">
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      className="text-orange-500 mr-2 text-sm"
                    />
                    <p className="text-sm font-semibold text-orange-800 dark:text-orange-200">
                      Keahlian tidak sesuai
                    </p>
                  </div>

                  <div className="space-y-2">
                    <div>
                      <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">
                        Keahlian dosen:
                      </p>
                      <p className="text-sm text-orange-800 dark:text-orange-200 bg-orange-100 dark:bg-orange-900/30 rounded-lg px-3 py-2">
                        {Array.isArray(pendingAssignment.dosen.keahlian)
                          ? pendingAssignment.dosen.keahlian.join(", ")
                          : pendingAssignment.dosen.keahlian}
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">
                        Keahlian dibutuhkan:
                      </p>
                      <p className="text-sm text-orange-800 dark:text-orange-200 bg-orange-100 dark:bg-orange-900/30 rounded-lg px-3 py-2">
                        {pendingAssignment.mk.keahlian_required?.join(", ") ||
                          "Tidak ada"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => {
                    setShowKeahlianConfirmModal(false);
                    setPendingAssignment(null);
                  }}
                  className="px-6 py-3 text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 rounded-xl transition-colors duration-200"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await handleAssignDosen(
                      pendingAssignment.dosen,
                      pendingAssignment.pbl,
                      pendingAssignment.mk
                    );
                    setShowKeahlianConfirmModal(false);
                    setPendingAssignment(null);
                  }}
                  className="px-6 py-3 text-sm font-medium text-white bg-orange-500 hover:bg-orange-600 rounded-xl transition-colors duration-200 shadow-sm"
                >
                  Yes, Assign
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Clear Cache Modal */}
      {showClearCacheModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center">
          {/* Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
            onClick={() => setShowClearCacheModal(false)}
          ></motion.div>
          {/* Modal Content */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
          >
            {/* Close Button */}
            <button
              onClick={() => setShowClearCacheModal(false)}
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
                  Clear Cache
                </h2>
              </div>

              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                    <svg
                      className="w-6 h-6 text-red-600 dark:text-red-400"
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
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">
                      Konfirmasi Clear Cache
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Tindakan Darurat
                    </p>
                  </div>
                </div>

                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <svg
                      className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                      />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">
                        Peringatan Kritis!
                      </p>
                      <p className="text-sm text-red-700 dark:text-red-300">
                        Tindakan ini akan menghapus cache status generate PBL
                        untuk blok ini.
                        <strong>
                          {" "}
                          Sebelum melanjutkan, hubungi developer atau
                          administrator sistem.
                        </strong>
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Tindakan ini akan:
                    </p>
                    <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1 ml-4 list-disc">
                      <li>
                        Menghapus cache status generate PBL untuk blok {blokId}
                      </li>
                      <li>
                        Memaksa sistem untuk mengambil data fresh dari database
                      </li>
                      <li>Mengembalikan blok ke status "Belum di-generate"</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 relative z-20">
                <button
                  onClick={() => setShowClearCacheModal(false)}
                  className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmClearCache}
                  className="px-3 sm:px-4 py-2 rounded-lg bg-red-600 text-white text-xs sm:text-sm font-medium shadow-theme-xs hover:bg-red-700 transition-all duration-300 ease-in-out relative z-10"
                >
                  Ya, Clear Cache
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}

// Fungsi untuk fetch detail kelompok kecil berdasarkan ID
async function fetchKelompokKecilDetails(
  namaKelompok: string[],
  semester?: string | number
): Promise<KelompokKecil[]> {
  if (!namaKelompok.length || !semester) return [];
  const details: KelompokKecil[] = [];
  for (const nama of namaKelompok) {
    try {
      const res = await api.get(
        `/kelompok-kecil/by-nama?nama_kelompok=${encodeURIComponent(
          nama
        )}&semester=${encodeURIComponent(semester)}`
      );
      if (res.data && Array.isArray(res.data))
        details.push(...(res.data as KelompokKecil[]));
    } catch {
      // ignore error
    }
  }
  return details;
}

// Tambahkan helper uniqueKelompokKecilListFromList
function uniqueKelompokKecilListFromList(list: KelompokKecil[]) {
  return Object.values(
    (list || []).reduce((acc: Record<string, KelompokKecil>, k) => {
      if (!acc[k.nama_kelompok]) {
        acc[k.nama_kelompok] = { ...k, jumlah_anggota: 1 };
      } else {
        acc[k.nama_kelompok].jumlah_anggota += 1;
      }
      return acc;
    }, {})
  );
}

// Helper untuk ambil semua keahlian unik dari dosenList
function getAllKeahlian(dosenList: Dosen[]): string[] {
  const allKeahlian = new Set<string>();
  dosenList.forEach((d: Dosen) => {
    const keahlian = Array.isArray(d.keahlian)
      ? d.keahlian
      : (d.keahlian || "").split(",").map((k: string) => k.trim());
    keahlian.forEach((k: string) => allKeahlian.add(k));
  });
  return Array.from(allKeahlian).sort();
}