import { useState, useEffect, useRef } from "react";
import { faChevronUp, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTrash,
  faBookOpen,
  faEdit,
  faUsers,
  faTimes,
  faExclamationTriangle,
  faClock,
  faEye,
} from "@fortawesome/free-solid-svg-icons";
import { AnimatePresence, motion } from "framer-motion";
import api, { handleApiError } from "../utils/api";
import { useParams, useNavigate } from "react-router-dom";

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
  tanggal_mulai?: string;
  tanggal_akhir?: string;
  durasi_minggu?: number | null;
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
  keahlianArr?: string[];
  peran_utama?: string; // koordinator, tim_blok, dosen_mengajar
  peran_kurikulum?: string[] | string;
  matkul_ketua_nama?: string;
  matkul_ketua_semester?: number;
  matkul_anggota_nama?: string;
  matkul_anggota_semester?: number;
  peran_kurikulum_mengajar?: string;
  pbl_assignment_count?: number;
  dosen_peran?: any[];
}

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50];

// Helper untuk mapping semester ke angka
function mapSemesterToNumber(semester: string | number | null): number | null {
  if (semester == null) return null;
  if (typeof semester === "number") return semester;
  if (!isNaN(Number(semester))) return Number(semester);
  // ❌ HAPUS LOGIC SALAH: tidak boleh mapping ganjil/genap ke angka
  // Struktur yang benar: semester 1,3,5,7 = Ganjil, semester 2,4,6 = Genap
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
  const [warning, setWarning] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
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
  // Tambahkan state untuk assigned dosen per PBL
  const [assignedDosen, setAssignedDosen] = useState<{
    [pblId: number]: Dosen[];
  }>({});
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

  const fetchAllRef = useRef(fetchAll);

  // Fungsi untuk mengecek apakah keahlian dosen sesuai dengan mata kuliah
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
    try {
      // Cari semua PBL dalam semester yang sama
      const currentSemester = mk.semester;
      const semesterPBLs = Object.values(pblData)
        .flat()
        .filter((p) => {
          const mk = blokMataKuliah.find((m) => m.kode === p.mata_kuliah_kode);
          return mk && mk.semester === currentSemester;
        });

      // Assign dosen ke semua PBL dalam semester yang sama
      const assignPromises = semesterPBLs.map(async (semesterPbl) => {
        try {
          // Tentukan role berdasarkan dosen_peran
          let role = "dosen_mengajar"; // default
          const dosenPeran = dosen.dosen_peran?.find(
            (peran: any) =>
              peran.semester === currentSemester &&
              (peran.tipe_peran === "koordinator" ||
                peran.tipe_peran === "tim_blok")
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

      // Refresh assigned dosen data untuk semua PBL yang berhasil
      if (successfulAssignments.length > 0) {
        const pblIds = successfulAssignments.map((r) => r.pblId);
        const assignedRes = await api.post("/pbls/assigned-dosen-batch", {
          pbl_ids: pblIds,
        });

        setAssignedDosen((prev) => {
          const updated = { ...prev };
          pblIds.forEach((pblId) => {
            if (pblId !== undefined) {
              updated[pblId] = assignedRes.data[pblId] || [];
            }
          });
          return updated;
        });

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
          pblIds.forEach((pblId) => {
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
      if (successfulAssignments.length === semesterPBLs.length) {
        // Semua berhasil
        if (isKeahlianMatch) {
          setSuccess(
            `${dosen.name} berhasil di-assign ke semua modul semester ${currentSemester}`
          );
        } else {
          setWarning(
            `${dosen.name} berhasil di-assign ke semua modul semester ${currentSemester} (Keahlian tidak sesuai)`
          );
        }
      } else if (successfulAssignments.length > 0) {
        // Sebagian berhasil
        if (isKeahlianMatch) {
          setSuccess(
            `${dosen.name} berhasil di-assign ke ${successfulAssignments.length}/${semesterPBLs.length} modul semester ${currentSemester}`
          );
        } else {
          setWarning(
            `${dosen.name} berhasil di-assign ke ${successfulAssignments.length}/${semesterPBLs.length} modul semester ${currentSemester} (Keahlian tidak sesuai)`
          );
        }
      } else {
        // Semua gagal
        setError(
          `Gagal assign ${dosen.name} ke semua modul semester ${currentSemester}`
        );
      }

      // Clear notification after 3 seconds
      setTimeout(() => {
        setSuccess(null);
        setWarning(null);
        setError(null);
      }, 3000);
    } catch (error: any) {
      setError(error?.response?.data?.message || "Gagal assign dosen");
    }
  };

  useEffect(() => {
    fetchAllRef.current = fetchAll;
  }, [fetchAll]);

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
          // Pastikan keahlianArr selalu ada
          if (!dosen.keahlianArr) {
            dosen.keahlianArr = Array.isArray(dosen.keahlian)
              ? dosen.keahlian
              : (dosen.keahlian || "").split(",").map((k) => k.trim());
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

  // Helper untuk mendapatkan dosen yang tersedia (tidak di-assign ke semester manapun)
  const assignedDosenIds = Object.values(assignedDosen)
    .flat()
    .map((d) => d.id);
  const dosenWithKeahlian = dosenList.map((d) => ({
    ...d,
    keahlianArr: Array.isArray(d.keahlian)
      ? d.keahlian
      : (d.keahlian || "").split(",").map((k) => k.trim()),
  }));

  // Dosen standby: memiliki keahlian "standby"
  const standbyDosenList = dosenWithKeahlian.filter(
    (d) =>
      d.keahlianArr.some((k) => k.toLowerCase().includes("standby")) &&
      (!searchDosen ||
        d.name.toLowerCase().includes(searchDosen.toLowerCase()) ||
        d.nid.toLowerCase().includes(searchDosen.toLowerCase()) ||
        d.keahlianArr.some((k) =>
          k.toLowerCase().includes(searchDosen.toLowerCase())
        ))
  );

  // Dosen regular: tidak memiliki keahlian "standby"
  const availableDosenList = dosenWithKeahlian.filter(
    (d) =>
      !d.keahlianArr.some((k) => k.toLowerCase().includes("standby")) &&
      (!searchDosen ||
        d.name.toLowerCase().includes(searchDosen.toLowerCase()) ||
        d.nid.toLowerCase().includes(searchDosen.toLowerCase()) ||
        d.keahlianArr.some((k) =>
          k.toLowerCase().includes(searchDosen.toLowerCase())
        ))
  );

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

  useEffect(() => {
    if (warning) {
      const timer = setTimeout(() => {
        setWarning(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [warning]);

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

      // Fetch assigned dosen batch (all pblId)
      const allPbls = Object.values(pblMap).flat();
      const pblIds = allPbls.map((pbl) => pbl.id).filter(Boolean);

      if (pblIds.length > 0) {
        try {
          // Retry mechanism for API call
          let retryCount = 0;
          const maxRetries = 3;
          let assignedRes = null;

          while (retryCount < maxRetries && !assignedRes) {
            try {
              assignedRes = await api.post("/pbls/assigned-dosen-batch", {
                pbl_ids: pblIds,
              });

              setAssignedDosen(assignedRes.data || {});

              // PERBAIKAN: Update role assignments untuk UI coloring saat data di-load
              const newRoleAssignments: {
                [pblId: number]: { koordinator?: number[]; timBlok?: number[] };
              } = {};

              // Iterate through assigned dosen data to determine roles
              Object.entries(assignedRes.data || {}).forEach(
                ([pblIdStr, assignedDosenList]: [string, any]) => {
                  const pblId = parseInt(pblIdStr);
                  if (
                    pblId &&
                    assignedDosenList &&
                    Array.isArray(assignedDosenList)
                  ) {
                    assignedDosenList.forEach((dosen: any) => {
                      // Gunakan pbl_role dari backend alih-alih dosen_peran
                      const pblRole = dosen.pbl_role || "dosen_mengajar";

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
                              dosen.id
                            )
                          ) {
                            newRoleAssignments[pblId].koordinator!.push(
                              dosen.id
                            );
                          }
                        } else if (pblRole === "tim_blok") {
                          if (!newRoleAssignments[pblId].timBlok) {
                            newRoleAssignments[pblId].timBlok = [];
                          }
                          if (
                            !newRoleAssignments[pblId].timBlok!.includes(
                              dosen.id
                            )
                          ) {
                            newRoleAssignments[pblId].timBlok!.push(dosen.id);
                          }
                        }
                      }
                    });
                  }
                }
              );

              setRoleAssignments(newRoleAssignments);

              // Trigger statistics calculation after data is set
              setTimeout(() => {
                if (blokMataKuliah.length > 0) {
                  api.get("/kelompok-kecil").then((kelompokKecilRes) => {
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
                  });
                }
              }, 100);

              break;
            } catch (error) {
              retryCount++;
              console.error(
                `Debug - Error fetching assigned dosen (attempt ${retryCount}):`,
                error
              );
              if (retryCount >= maxRetries) {
                setAssignedDosen({});
              } else {
                // Wait before retry
                await new Promise((resolve) => setTimeout(resolve, 1000));
              }
            }
          }
        } catch (error) {
          console.error("Debug - Final error fetching assigned dosen:", error);
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
  useEffect(() => {
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
  }, []);

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
        console.error('Error saving mapping kelompok:', error);
        console.error('Error details:', handleApiError(error, 'Menyimpan mapping kelompok'));
        alert(handleApiError(error, 'Menyimpan mapping kelompok'));
      } finally {
        setIsSavingKelompok(false);
      }
    }
  };

  // Saat batal di modal
  const handleBatalKelompok = () => {
    setShowKelompokModal(null);
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
  let blokMataKuliahFilteredByBlok = blokMataKuliah;
  if (blokId) {
    blokMataKuliahFilteredByBlok = blokMataKuliah.filter(
      (mk: MataKuliah) => String(mk.blok) === String(blokId)
    );
  } else if (filterBlok !== "semua") {
    blokMataKuliahFilteredByBlok = blokMataKuliah.filter(
      (mk: MataKuliah) => String(mk.blok) === String(filterBlok)
    );
  }

  // Group blokMataKuliah by semester, filter by activeSemesterJenis
  const blokMataKuliahFiltered = activeSemesterJenis
    ? blokMataKuliahFilteredByBlok.filter(
        (mk: MataKuliah) =>
          mk.periode &&
          mk.periode.trim().toLowerCase() ===
            activeSemesterJenis.trim().toLowerCase()
      )
    : blokMataKuliahFilteredByBlok;
  const groupedBySemester = blokMataKuliahFiltered.reduce(
    (acc: Record<number, MataKuliah[]>, mk: MataKuliah) => {
      if (!acc[mk.semester]) acc[mk.semester] = [];
      acc[mk.semester].push(mk);
      return acc;
    },
    {}
  );
  const sortedSemesters = Object.keys(groupedBySemester)
    .map(Number)
    .sort((a, b) => a - b);

  // Semester options
  const semesterOptions = sortedSemesters;

  // Blok options - get unique blok numbers from mata kuliah
  const blokOptions = Array.from(
    new Set(
      blokMataKuliah
        .map((mk) => mk.blok)
        .filter((blok) => blok !== null)
        .sort((a, b) => (a || 0) - (b || 0))
    )
  );

  // Filtered semester list
  const filteredSemesters =
    filterSemester === "semua"
      ? sortedSemesters
      : sortedSemesters.filter(
          (s: number) => String(s) === String(filterSemester)
        );

  // Filtered mata kuliah by search & status
  const filterMataKuliah = (mkList: MataKuliah[]) =>
    mkList.filter((mk: MataKuliah) => {
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

  // Filter mata kuliah by active semester (sama seperti PBLGenerate.tsx)
  const filteredMataKuliah = activeSemesterJenis
    ? blokMataKuliahFiltered.filter(
        (mk: MataKuliah) =>
          mk.periode &&
          mk.periode.trim().toLowerCase() ===
            activeSemesterJenis.trim().toLowerCase()
      )
    : blokMataKuliahFiltered;

  // After filtering and grouping, flatten all mkList from all semesters into a single array:
  const allFilteredMataKuliah = filteredSemesters.flatMap((semester: number) =>
    filterMataKuliah(groupedBySemester[semester]).map((mk: MataKuliah) => ({
      ...mk,
      semester,
    }))
  );

  // Calculate statistics for filtered blok only (sama seperti PBLGenerate.tsx)
  const totalPBL = filteredMataKuliah.reduce(
    (acc: number, mk: MataKuliah) => acc + (pblData[mk.kode]?.length || 0),
    0
  );
  const pblStats = (() => {
    let belum = 0,
      sudah = 0;
    allFilteredMataKuliah.forEach((mk) => {
      (pblData[mk.kode] || []).forEach((pbl) => {
        const assigned = pbl.id ? assignedDosen[pbl.id] || [] : [];
        if (assigned.length > 0) sudah++;
        else belum++;
      });
    });
    return { belum, sudah };
  })();

  // --- Pagination logic (MUST be before any return) ---
  const totalPages = Math.ceil(allFilteredMataKuliah.length / pageSize);
  const paginatedMataKuliah = allFilteredMataKuliah.slice(
    (page - 1) * pageSize,
    page * pageSize
  );
  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [page, totalPages]);

  // Open modal for edit
  const handleOpenEditModal = (kode: string, index: number, pbl: PBL) => {
    setEditMode(true);
    setSelectedPBL({ kode, index, pbl });
    setForm({ modul_ke: pbl.modul_ke, nama_modul: pbl.nama_modul });
    setShowModal(true);
  };

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

  // Hapus PBL
  const handleDeletePbl = (kode: string, index: number) => {
    const pbl = pblData[kode][index];
    setPblToDelete({ kode, index, pbl });
    setShowDeleteModal(true);
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

  if (loading) {
    return (
      <div className="w-full mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-8 w-80 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
          <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>

        {/* Statistics Cards Skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6"
            >
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 animate-pulse" />
                <div className="flex-1">
                  <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Card Skeleton */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 w-full">
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
                  <div className="flex gap-2 ml-auto">
                    {/* REMOVE these skeleton loaders, or replace with real data if needed */}
                    {/* <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" /> */}
                    {/* <div className="h-10 w-40 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" /> */}
                  </div>
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
        <button
          onClick={() => navigate("/pbl")}
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
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <div>
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
      </div>
      {/* Statistik Summary Card */}
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
                {totalPBL}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Modul PBL
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
                {totalKelompokKecilAllSemester}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Kelompok
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faExclamationTriangle}
                className="w-6 h-6 text-orange-500"
              />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {keahlianCount}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Jumlah Keahlian
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faUsers}
                className="w-6 h-6 text-purple-500"
              />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {peranKetuaCount}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Peran Koordinator
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-yellow-200 dark:bg-yellow-900/40 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faUsers}
                className="w-6 h-6 text-yellow-600"
              />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {peranAnggotaCount}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Peran Tim Blok
              </div>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faUsers}
                className="w-6 h-6 text-indigo-500"
              />
            </div>
            <div>
              <div className="text-2xl font-bold text-gray-800 dark:text-white">
                {dosenMengajarCount}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Peran Dosen Mengajar
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Filterisasi dalam card ala CSR */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6">
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
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-red-100 border text-red-700 p-3 rounded-lg mb-6"
          >
            {error}
          </motion.div>
        )}
        {warning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-yellow-100 border text-yellow-700 p-3 rounded-lg mb-6"
          >
            <div className="font-semibold mb-2">Warning:</div>
            <div>{warning}</div>
          </motion.div>
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
              <div className="space-y-8">
                {sortedSemesters.map((semester) => {
                  const semesterPBLs = allFilteredMataKuliah.filter(
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
                                  semesterPBLs.forEach((mk) => {
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
                      {/* PBL Cards Grid */}
                      <div className="grid gap-4">
                        {semesterPBLs.map((mk: MataKuliah) => {
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
                                        setWarning(
                                          `Dosen ${draggedDosen.name} sudah memiliki ${assignmentCount} assignment. Pertimbangkan untuk menggunakan dosen dengan beban kerja yang lebih rendah untuk distribusi yang adil.`
                                        );
                                        // Clear warning after 5 seconds
                                        setTimeout(
                                          () => setWarning(null),
                                          5000
                                        );
                                      }

                                      // Validasi peran_utama - sama seperti PBLGenerate.tsx
                                      let isPerfectMatch = false;
                                      let matchReason = "";

                                      if (
                                        draggedDosen.peran_utama === "ketua"
                                      ) {
                                        if (
                                          draggedDosen.matkul_ketua_nama &&
                                          draggedDosen.matkul_ketua_semester
                                        ) {
                                          // More flexible matching for ketua
                                          const matkulName =
                                            draggedDosen.matkul_ketua_nama.toLowerCase();
                                          const mkName = mk.nama.toLowerCase();
                                          const mkKode = mk.kode.toLowerCase();

                                          // Check if this dosen is ketua for this specific mata kuliah and semester
                                          if (
                                            (matkulName.includes(mkName) ||
                                              mkName.includes(matkulName) ||
                                              matkulName.includes(mkKode) ||
                                              mkKode.includes(matkulName) ||
                                              mkName
                                                .split(" ")
                                                .some((word) =>
                                                  matkulName.includes(word)
                                                ) ||
                                              matkulName
                                                .split(" ")
                                                .some((word) =>
                                                  mkName.includes(word)
                                                )) &&
                                            draggedDosen.matkul_ketua_semester ===
                                              mk.semester
                                          ) {
                                            isPerfectMatch = true;
                                            matchReason = `Ketua untuk ${mk.nama} Semester ${mk.semester}`;
                                          }
                                        }
                                      } else if (
                                        draggedDosen.peran_utama === "anggota"
                                      ) {
                                        if (
                                          draggedDosen.matkul_anggota_nama &&
                                          draggedDosen.matkul_anggota_semester
                                        ) {
                                          // More flexible matching for anggota
                                          const matkulName =
                                            draggedDosen.matkul_anggota_nama.toLowerCase();
                                          const mkName = mk.nama.toLowerCase();
                                          const mkKode = mk.kode.toLowerCase();

                                          // Check if this dosen is anggota for this specific mata kuliah and semester
                                          if (
                                            (matkulName.includes(mkName) ||
                                              mkName.includes(matkulName) ||
                                              matkulName.includes(mkKode) ||
                                              mkKode.includes(matkulName) ||
                                              mkName
                                                .split(" ")
                                                .some((word) =>
                                                  matkulName.includes(word)
                                                ) ||
                                              matkulName
                                                .split(" ")
                                                .some((word) =>
                                                  mkName.includes(word)
                                                )) &&
                                            draggedDosen.matkul_anggota_semester ===
                                              mk.semester
                                          ) {
                                            isPerfectMatch = true;
                                            matchReason = `Anggota untuk ${mk.nama} Semester ${mk.semester}`;
                                          }
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
                                      if (!isPerfectMatch && !isStandby) {
                                        const warningMsg = `Dosen ${draggedDosen.name} tidak memiliki peran yang sesuai untuk ${mk.nama} (${mk.kode}). Keahlian sesuai tetapi peran tidak cocok.`;
                                        setWarning(warningMsg);
                                        // Clear warning after 5 seconds
                                        setTimeout(
                                          () => setWarning(null),
                                          5000
                                        );
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
                                        await fetchAllRef.current();
                                        setSuccess(
                                          isStandby
                                            ? `Dosen ${draggedDosen.name} (Standby) berhasil di-assign ke semua modul ${mk.nama} (${mk.kode}).`
                                            : isPerfectMatch
                                            ? `Dosen ${draggedDosen.name} berhasil di-assign ke semua modul ${mk.nama} (${mk.kode}). ${matchReason}`
                                            : `Dosen ${draggedDosen.name} berhasil di-assign ke semua modul ${mk.nama} (${mk.kode}) (keahlian sesuai, peran tidak cocok).`
                                        );
                                        // Update reporting data secara real-time
                                        await updateReportingData();
                                      } catch (err) {
                                        setError("Gagal assign dosen");
                                        // If assignment fails, refresh data to revert UI changes
                                        await fetchAllRef.current();
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
                                        <button
                                          onClick={() =>
                                            handleOpenEditModal(
                                              mk.kode,
                                              pblIdx,
                                              pbl
                                            )
                                          }
                                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 bg-transparent rounded-lg transition"
                                          title="Edit PBL"
                                        >
                                          <FontAwesomeIcon
                                            icon={faEdit}
                                            className="w-4 h-4"
                                          />
                                          <span className="hidden sm:inline">
                                            Edit
                                          </span>
                                        </button>
                                        <button
                                          onClick={() =>
                                            handleDeletePbl(mk.kode, pblIdx)
                                          }
                                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 bg-transparent rounded-lg transition"
                                          title="Hapus PBL"
                                        >
                                          <FontAwesomeIcon
                                            icon={faTrash}
                                            className="w-4 h-4"
                                          />
                                          <span className="hidden sm:inline">
                                            Hapus
                                          </span>
                                        </button>
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

                                              // Tentukan peran dan warna berdasarkan data yang ada (sama seperti PBLGenerate.tsx)
                                              let dosenRole = "Dosen Mengajar";
                                              let avatarColor = "bg-green-500";
                                              let borderColor =
                                                "border-green-200";
                                              let textColor =
                                                "text-green-700 dark:text-green-200";
                                              let bgColor =
                                                "bg-green-100 dark:bg-green-900/40";

                                              // PERBAIKAN FINAL: Cek peran berdasarkan role assignments yang baru dibuat
                                              const pblRoles =
                                                roleAssignments?.[pbl.id!];
                                              const isKoordinator =
                                                pblRoles?.koordinator?.includes(
                                                  dosen.id
                                                ) || false;
                                              const isTimBlok =
                                                pblRoles?.timBlok?.includes(
                                                  dosen.id
                                                ) || false;

                                              if (isKoordinator) {
                                                dosenRole = "Koordinator";
                                                avatarColor = "bg-blue-500";
                                                borderColor = "border-blue-200";
                                                textColor =
                                                  "text-blue-700 dark:text-blue-200";
                                                bgColor =
                                                  "bg-blue-100 dark:bg-blue-900/40";
                                              } else if (isTimBlok) {
                                                dosenRole = "Tim Blok";
                                                avatarColor = "bg-purple-500";
                                                borderColor =
                                                  "border-purple-200";
                                                textColor =
                                                  "text-purple-700 dark:text-purple-200";
                                                bgColor =
                                                  "bg-purple-100 dark:bg-purple-900/40";
                                              }

                                              // Cek apakah keahlian dosen sesuai dengan mata kuliah
                                              const isKeahlianMatch =
                                                checkKeahlianMatch(dosen, mk);

                                              // Jika standby, override warna
                                              if (isStandby) {
                                                avatarColor = "bg-yellow-400";
                                                borderColor =
                                                  "border-yellow-200";
                                                textColor =
                                                  "text-yellow-800 dark:text-yellow-200";
                                                bgColor =
                                                  "bg-yellow-100 dark:bg-yellow-900/40";
                                              }
                                              // Jika keahlian tidak sesuai dan bukan koordinator/tim blok, ubah warna menjadi merah
                                              else if (
                                                !isKeahlianMatch &&
                                                !isKoordinator &&
                                                !isTimBlok
                                              ) {
                                                avatarColor = "bg-red-500";
                                                borderColor = "border-red-200";
                                                textColor =
                                                  "text-red-700 dark:text-red-200";
                                                bgColor =
                                                  "bg-red-100 dark:bg-red-900/40";
                                              }

                                              return (
                                                <div
                                                  key={dosen.id}
                                                  className={`flex items-center gap-2 px-3 py-1 rounded-full ${bgColor} ${borderColor}`}
                                                >
                                                  <div
                                                    className={`w-6 h-6 rounded-full flex items-center justify-center relative ${avatarColor}`}
                                                  >
                                                    <span className="text-white text-xs font-bold">
                                                      {dosen.name.charAt(0)}
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
                                                    {dosen.name}
                                                    <span className="ml-1 text-[10px] opacity-75">
                                                      ({dosenRole})
                                                    </span>
                                                  </span>
                                                  {/* Tombol unassign untuk semua dosen, termasuk standby */}
                                                  <button
                                                    className="ml-2 p-1 text-red-500 hover:bg-red-100 dark:hover:bg-red-900/20 rounded-full transition text-xs"
                                                    title="Hapus penugasan"
                                                    onClick={async (e) => {
                                                      e.stopPropagation();
                                                      try {
                                                        // Cari semua PBL dalam semester yang sama yang memiliki dosen ini
                                                        const currentSemester =
                                                          mk.semester;
                                                        const semesterPBLs =
                                                          Object.values(pblData)
                                                            .flat()
                                                            .filter((p) => {
                                                              const mk =
                                                                blokMataKuliah.find(
                                                                  (m) =>
                                                                    m.kode ===
                                                                    p.mata_kuliah_kode
                                                                );
                                                              return (
                                                                mk &&
                                                                mk.semester ===
                                                                  currentSemester
                                                              );
                                                            });
                                                        const removePromises =
                                                          semesterPBLs.map(
                                                            async (
                                                              semesterPbl
                                                            ) => {
                                                              const semesterAssigned =
                                                                assignedDosen[
                                                                  semesterPbl.id!
                                                                ] || [];
                                                              if (
                                                                semesterAssigned.some(
                                                                  (d) =>
                                                                    d.id ===
                                                                    dosen.id
                                                                )
                                                              ) {
                                                                return api.delete(
                                                                  `/pbls/${semesterPbl.id}/unassign-dosen/${dosen.id}`
                                                                );
                                                              }
                                                              return Promise.resolve();
                                                            }
                                                          );

                                                        await Promise.all(
                                                          removePromises
                                                        );

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
                                                        semesterPBLs.forEach(
                                                          (semesterPbl) => {
                                                            if (
                                                              semesterPbl.id
                                                            ) {
                                                              if (
                                                                newRoleAssignments[
                                                                  semesterPbl.id
                                                                ]
                                                              ) {
                                                                if (
                                                                  newRoleAssignments[
                                                                    semesterPbl
                                                                      .id
                                                                  ].koordinator
                                                                ) {
                                                                  newRoleAssignments[
                                                                    semesterPbl.id
                                                                  ].koordinator =
                                                                    newRoleAssignments[
                                                                      semesterPbl
                                                                        .id
                                                                    ].koordinator!.filter(
                                                                      (id) =>
                                                                        id !==
                                                                        dosen.id
                                                                    );
                                                                }
                                                                if (
                                                                  newRoleAssignments[
                                                                    semesterPbl
                                                                      .id
                                                                  ].timBlok
                                                                ) {
                                                                  newRoleAssignments[
                                                                    semesterPbl.id
                                                                  ].timBlok =
                                                                    newRoleAssignments[
                                                                      semesterPbl
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
                                                        await fetchAllRef.current();
                                                        setSuccess(
                                                          `Dosen ${dosen.name} berhasil di-unassign dari semua modul PBL Semester ${mk.semester}.`
                                                        );
                                                        // Update reporting data secara real-time
                                                        await updateReportingData();
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
                                                        await fetchAllRef.current();
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
                                          <div className="text-sm text-gray-500 dark:text-gray-400 mb-2">
                                            Seret dosen dari semester{" "}
                                            {mk.semester} ke sini
                                          </div>
                                          <div className="text-xs text-gray-400 dark:text-gray-500 mb-2">
                                            Hanya dosen dari semester yang sama
                                            yang dapat di-assign
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
                                              Tidak ada dosen dengan keahlian
                                              yang sesuai
                                            </div>
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
                  availableDosenList.map((dosen) => (
                    <div
                      key={dosen.id}
                      className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl hover:shadow-md transition-all duration-200 cursor-move"
                      draggable
                      onDragStart={() => setDraggedDosen(dosen)}
                      onDragEnd={() => setDraggedDosen(null)}
                    >
                      {/* Header dengan Avatar dan Info Dasar */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center relative">
                          <span className="text-white text-sm font-bold">
                            {dosen.name.charAt(0)}
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
                      </div>
                      {/* Peran Counts Badge */}
                      <div className="mb-3 flex flex-wrap gap-2">
                        {(dosen as any).peran_counts?.koordinator > 0 && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs">
                            Koordinator (
                            {(dosen as any).peran_counts.koordinator})
                          </span>
                        )}
                        {(dosen as any).peran_counts?.tim_blok > 0 && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs">
                            Tim Blok ({(dosen as any).peran_counts.tim_blok})
                          </span>
                        )}
                        {(dosen as any).peran_counts?.dosen_mengajar > 0 && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 text-xs">
                            Dosen Mengajar (
                            {(dosen as any).peran_counts.dosen_mengajar})
                          </span>
                        )}
                        {(!(dosen as any).peran_counts ||
                          ((dosen as any).peran_counts.koordinator === 0 &&
                            (dosen as any).peran_counts.tim_blok === 0 &&
                            (dosen as any).peran_counts.dosen_mengajar ===
                              0)) && (
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
                              const peranList = Array.isArray(dosen.dosen_peran)
                                ? dosen.dosen_peran.filter(
                                    (p) => p.tipe_peran === tipe
                                  )
                                : [];
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
                              const rowKey = `${dosen.id || dosen.nid}_${tipe}`;
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
                                        isExpanded ? faChevronUp : faChevronDown
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
                                            {tipe === "mengajar" ? (
                                              <div className="font-medium text-brand-400 text-sm">
                                                {p.peran_kurikulum}
                                              </div>
                                            ) : (
                                              <>
                                                <div className="font-medium text-brand-400 text-sm">
                                                  {p.mata_kuliah_nama ??
                                                    (p as any)?.nama_mk ??
                                                    ""}
                                                </div>
                                                <div className="text-xs text-gray-400">
                                                  Semester {p.semester} | Blok{" "}
                                                  {p.blok}
                                                </div>
                                                <div className="text-xs text-gray-500">
                                                  {p.peran_kurikulum}
                                                </div>
                                              </>
                                            )}
                                          </div>
                                        </li>
                                      ))}
                                    </ul>
                                  )}
                                </div>
                              );
                            }
                          )}
                          {(!Array.isArray(dosen.dosen_peran) ||
                            dosen.dosen_peran.length === 0) && <span>-</span>}
                        </div>
                        {/* Keahlian Section */}
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-orange-500"></div>
                            Keahlian
                          </div>
                          <div className="flex flex-wrap gap-1">
                            {parseKeahlian(dosen.keahlian).map((k, idx) => (
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
                      className={`p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl hover:shadow-md transition-all duration-200 cursor-move ${
                        draggedDosen?.id === dosen.id
                          ? "ring-2 ring-yellow-500 scale-105"
                          : ""
                      }`}
                      draggable
                      onDragStart={() => setDraggedDosen(dosen)}
                      onDragEnd={() => setDraggedDosen(null)}
                    >
                      {/* Header dengan Avatar dan Info Dasar */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center relative">
                          <span className="text-white text-sm font-bold">
                            {dosen.name.charAt(0)}
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
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowMahasiswaModal(null)}
            ></motion.div>
            <motion.div
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
    const keahlianArr = Array.isArray(d.keahlian)
      ? d.keahlian
      : (d.keahlian || "").split(",").map((k: string) => k.trim());
    keahlianArr.forEach((k: string) => allKeahlian.add(k));
  });
  return Array.from(allKeahlian).sort();
}
