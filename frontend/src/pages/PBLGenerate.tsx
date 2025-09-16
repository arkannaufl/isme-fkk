import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { faChevronUp, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faBookOpen,
  faCog,
  faExclamationTriangle,
  faEye,
} from "@fortawesome/free-solid-svg-icons";
import { AnimatePresence, motion } from "framer-motion";
import api, { handleApiError } from "../utils/api";
import { useParams, useNavigate } from "react-router-dom";
import { ChevronLeftIcon } from "../icons";

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
  semester?: string | number;
}

// Tambahkan tipe untuk mahasiswa
interface Mahasiswa {
  nama: string;
  nim: string;
  angkatan: string;
  ipk: number;
}

interface Dosen {
  id: number;
  nid: string;
  name: string;
  keahlian: string[] | string;
  peran_utama?: string; // koordinator, tim_blok, dosen_mengajar
  peran_kurikulum?: string[] | string;
  matkul_ketua_nama?: string;
  matkul_ketua_semester?: number;
  matkul_anggota_nama?: string;
  matkul_anggota_semester?: number;
  matkul_ketua_id?: string;
  matkul_anggota_id?: string;
  peran_kurikulum_mengajar?: string;
  matchReason?: string;
  pbl_assignment_count?: number;
  dosen_peran?: any[];
}

interface AssignedDosen {
  [pblId: number]: Dosen[];
}

// Helper untuk mapping semester ke angka
function mapSemesterToNumber(semester: string | number | null): number | null {
  if (semester == null) return null;
  if (typeof semester === "number") return semester;
  if (!isNaN(Number(semester))) return Number(semester);
  // ❌ HAPUS LOGIC SALAH: tidak boleh mapping ganjil/genap ke angka
  // Struktur yang benar: semester 1,3,5,7 = Ganjil, semester 2,4,6 = Genap
  return null;
}

// Utility untuk menjalankan promise dalam batch
async function runInBatches<T>(
  tasks: (() => Promise<T>)[],
  batchSize: number = 10
): Promise<T[]> {
  const results: T[] = [];
  for (let i = 0; i < tasks.length; i += batchSize) {
    const batch = tasks.slice(i, i + batchSize).map((fn) => fn());
    const settled = await Promise.allSettled(batch);
    settled.forEach((res) => {
      if (res.status === "fulfilled") results.push(res.value);
      // Jika ingin handle error, bisa tambahkan di sini
    });
  }
  return results;
}

// Utility untuk membagi array ke N bagian hampir sama besar
function chunkArray<T>(arr: T[], chunkCount: number): T[][] {
  const result: T[][] = [];
  const chunkSize = Math.floor(arr.length / chunkCount);
  let remainder = arr.length % chunkCount;
  let start = 0;
  for (let i = 0; i < chunkCount; i++) {
    let end = start + chunkSize + (remainder > 0 ? 1 : 0);
    result.push(arr.slice(start, end));
    start = end;
    if (remainder > 0) remainder--;
  }
  return result;
}

export default function PBLGenerate() {
  const { blokId } = useParams();
  const navigate = useNavigate();
  const [pblData, setPblData] = useState<{ [kode: string]: PBL[] }>({});
  const [blokMataKuliah, setBlokMataKuliah] = useState<MataKuliah[]>([]);
  const [dosenList, setDosenList] = useState<Dosen[]>([]);
  const [assignedDosen, setAssignedDosen] = useState<AssignedDosen>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeSemesterJenis, setActiveSemesterJenis] = useState<string | null>(
    null
  );
  const [resetLoading, setResetLoading] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [unassignedPBLList, setUnassignedPBLList] = useState<
    { mk: MataKuliah; pbl: PBL; reasons: string[] }[]
  >([]);

  // New state for statistics
  const [kelompokKecilCount, setKelompokKecilCount] = useState<number>(0);
  const [totalKelompokKecilAllSemester, setTotalKelompokKecilAllSemester] =
    useState<number>(0);
  const [keahlianCount, setKeahlianCount] = useState<number>(0);
  const [peranKetuaCount, setPeranKetuaCount] = useState<number>(0);
  const [peranAnggotaCount, setPeranAnggotaCount] = useState<number>(0);
  const [dosenMengajarCount, setDosenMengajarCount] = useState<number>(0);

  // State untuk kelompok kecil - optimasi
  const [kelompokKecilData, setKelompokKecilData] = useState<{
    [semester: string]: {
      mapping: { [kode: string]: string[] };
      details: KelompokKecil[];
    };
  }>({});

  // OPTIMIZATION: Add caching for kelompok kecil data
  const [kelompokKecilCache, setKelompokKecilCache] = useState<{
    [semester: string]: {
      mapping: { [kode: string]: string[] };
      details: KelompokKecil[];
    };
  }>({});

  // OPTIMIZATION: Add debouncing for fetch operations
  const fetchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [isFetching, setIsFetching] = useState(false);

  // Debounced fetch function to prevent multiple rapid API calls
  const debouncedFetch = useCallback(
    (fetchFunction: () => Promise<void>, delay: number = 300) => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }

      fetchTimeoutRef.current = setTimeout(async () => {
        if (!isFetching) {
          setIsFetching(true);
          try {
            await fetchFunction();
          } finally {
            setIsFetching(false);
          }
        }
      }, delay);
    },
    [isFetching]
  );

  const [showMahasiswaModal, setShowMahasiswaModal] = useState<{
    kelompok: KelompokKecil;
    mahasiswa: Mahasiswa[];
  } | null>(null);
  const [pageMahasiswaModal, setPageMahasiswaModal] = useState(1);

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

  // OPTIMIZATION: Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch data in parallel
        const [pblRes, dosenRes, activeSemesterRes, kelompokKecilRes] =
          await Promise.all([
            api.get("/pbls/all"),
            api.get("/users?role=dosen"),
            api.get("/tahun-ajaran/active"),
            api.get("/kelompok-kecil"),
          ]);



        // Process PBL data
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

        // Filter by blok if blokId is provided
        let filteredBlokMataKuliah = blokListMapped;
        if (blokId) {
          filteredBlokMataKuliah = blokListMapped.filter(
            (mk: MataKuliah) => String(mk.blok) === String(blokId)
          );
        }

        setBlokMataKuliah(filteredBlokMataKuliah);
        setPblData(pblMap);
        setDosenList(dosenRes.data || []);

        const dosenWithPeran = dosenRes.data?.filter(
          (d: any) => d.dosen_peran && d.dosen_peran.length > 0
        );

        // Set active semester
        const semester = activeSemesterRes.data?.semesters?.[0];
        if (semester && semester.jenis) {
          setActiveSemesterJenis(semester.jenis);
        }

        // Fetch assigned dosen for filtered PBLs
        const allPbls = Object.values(pblMap).flat();
        const pblIds = allPbls.map((pbl) => pbl.id).filter(Boolean);
        if (pblIds.length > 0) {
          const assignedRes = await api.post("/pbls/assigned-dosen-batch", {
            pbl_ids: pblIds,
          });
          setAssignedDosen(assignedRes.data || {});
        }

        // Calculate statistics
        calculateStatistics(
          filteredBlokMataKuliah,
          dosenRes.data || [],
          kelompokKecilRes.data || [],
          semester?.jenis,
          blokId || "semua"
        );

        // Calculate total kelompok kecil from all active semesters
        const allKelompokKecil = kelompokKecilRes.data || [];
        const uniqueAllKelompok = new Set(
          allKelompokKecil.map(
            (kk: any) => `${kk.semester}__${kk.nama_kelompok}`
          )
        );
        setTotalKelompokKecilAllSemester(uniqueAllKelompok.size);

        // Fetch kelompok kecil data for all semesters in one go
        await fetchKelompokKecilData(filteredBlokMataKuliah, semester?.jenis);
      } catch (err) {
        setError("Gagal memuat data PBL/dosen");
        setBlokMataKuliah([]);
        setPblData({});
        setDosenList([]);
        setAssignedDosen({});
      } finally {
        setLoading(false);
      }
    };

    fetchAllData();
  }, [blokId]);

  // Optimized function to fetch kelompok kecil data for all semesters
  const fetchKelompokKecilData = useCallback(
    async (mataKuliahList: MataKuliah[], activeSemester: string | null) => {
      if (!mataKuliahList.length) return;

      try {
        // Get unique semesters
        const semesters = Array.from(
          new Set(mataKuliahList.map((mk) => mk.semester))
        );
        // Build semester_map: { semester: [kode, kode, ...] }
        const semesterMap: Record<string, string[]> = {};
        semesters.forEach((semester) => {
          const kodeList = mataKuliahList
            .filter((mk) => mk.semester === semester)
            .map((mk) => mk.kode);
          if (kodeList.length > 0) semesterMap[String(semester)] = kodeList;
        });
        if (Object.keys(semesterMap).length === 0) return;

        // Fetch all mapping in one request
        const mappingRes = await api.post(
          "/mata-kuliah/pbl-kelompok-kecil/batch-multi-semester",
          { semester_map: semesterMap }
        );
        // Fetch all kelompok kecil details in one batch call
        const kelompokKecilBatchRes = await api.post(
          "/kelompok-kecil/batch-by-semester",
          { semesters: Object.keys(semesterMap) }
        );

        // Build newKelompokKecilData
        const newKelompokKecilData: {
          [semester: string]: {
            mapping: { [kode: string]: string[] };
            details: KelompokKecil[];
          };
        } = {};
        Object.keys(semesterMap).forEach((semesterKey) => {
          newKelompokKecilData[semesterKey] = {
            mapping: mappingRes.data[semesterKey] || {},
            details: kelompokKecilBatchRes.data[semesterKey] || [],
          };
        });
        setKelompokKecilData(newKelompokKecilData);
        setKelompokKecilCache(newKelompokKecilData); // Update cache
      } catch (error) {
        console.error("Failed to fetch kelompok kecil data:", error);
      }
    },
    []
  );

  // Recalculate statistics when active semester changes
  useEffect(() => {
    if (
      blokMataKuliah.length > 0 &&
      dosenList.length > 0 &&
      activeSemesterJenis
    ) {
      // OPTIMIZATION: Use cached data if available, otherwise fetch
      const hasCachedData = Object.keys(kelompokKecilCache).length > 0;

      if (hasCachedData) {
        // Use cached data for statistics calculation
        const allKelompokKecil = Object.values(kelompokKecilCache).flatMap(
          (semesterData) => semesterData.details
        );
        calculateStatistics(
          blokMataKuliah,
          dosenList,
          allKelompokKecil,
          activeSemesterJenis,
          blokId || "semua"
        );
      } else {
        // OPTIMIZATION: Use debounced fetch to prevent multiple rapid calls
        debouncedFetch(async () => {
          try {
            const kelompokKecilRes = await api.get("/kelompok-kecil");
            calculateStatistics(
              blokMataKuliah,
              dosenList,
              kelompokKecilRes.data || [],
              activeSemesterJenis,
              blokId || "semua"
            );
          } catch {
            calculateStatistics(
              blokMataKuliah,
              dosenList,
              [],
              activeSemesterJenis,
              blokId || "semua"
            );
          }
        }, 200);
      }

      // Re-fetch kelompok kecil data when active semester changes (only if not cached)
      if (!hasCachedData) {
        debouncedFetch(
          () => fetchKelompokKecilData(blokMataKuliah, activeSemesterJenis),
          300
        );
      }
    }
  }, [
    activeSemesterJenis,
    blokMataKuliah,
    dosenList,
    kelompokKecilCache,
    debouncedFetch,
    fetchKelompokKecilData,
    blokId,
  ]);

  // Function to handle lihat mahasiswa
  const handleLihatMahasiswa = async (kelompok: KelompokKecil) => {
    try {
      // OPTIMIZATION: Check if we have cached data first
      const semesterRes = await api.get("/tahun-ajaran/active");
      const semester = semesterRes.data?.semesters?.[0]?.jenis;

      if (!semester) {
        alert("Tidak ada semester aktif");
        return;
      }

      // OPTIMIZATION: Try to get mahasiswa from cache first
      const semesterKey = String(kelompok.semester);
      const cachedData = kelompokKecilCache[semesterKey];

      if (cachedData) {
        // Find mahasiswa in cached data
        const mahasiswaInKelompok = cachedData.details.filter(
          (detail: any) => detail.nama_kelompok === kelompok.nama_kelompok
        );

        if (mahasiswaInKelompok.length > 0) {
          // Convert to mahasiswa format
          const mahasiswa = mahasiswaInKelompok.map((detail: any) => ({
            nama: detail.mahasiswa?.name || "",
            nim: detail.mahasiswa?.nim || "",
            angkatan: detail.mahasiswa?.angkatan || "",
            ipk: detail.mahasiswa?.ipk || 0,
          }));

          setShowMahasiswaModal({ kelompok, mahasiswa });
          setPageMahasiswaModal(1);
          return;
        }
      }

      // Fallback: Fetch mahasiswa dari kelompok kecil jika tidak ada di cache
      const mahasiswaRes = await api.get(
        `/kelompok-kecil/${kelompok.id}/mahasiswa`
      );
      const mahasiswa = mahasiswaRes.data || [];

      setShowMahasiswaModal({ kelompok, mahasiswa });
      setPageMahasiswaModal(1); // Reset pagination
    } catch (error) {
      alert("Gagal memuat data mahasiswa");
    }
  };

  // Function to calculate statistics
  const calculateStatistics = (
    mataKuliahList: MataKuliah[],
    dosenList: Dosen[],
    kelompokKecilList: any[],
    activeSemester: string | null,
    filterBlok: string
  ) => {
    // Filter mata kuliah by active semester
    const filteredMataKuliah = activeSemester
      ? mataKuliahList.filter(
          (mk: MataKuliah) =>
            mk.periode &&
            mk.periode.trim().toLowerCase() ===
              activeSemester.trim().toLowerCase()
        )
      : mataKuliahList;

    // Calculate kelompok kecil count (unique nama_kelompok for active semester)
    const kelompokKecilForSemester = kelompokKecilList.filter(
      (kk: any) => kk.semester === activeSemester
    );
    const uniqueKelompok = new Set(
      kelompokKecilForSemester.map((kk: any) => kk.nama_kelompok)
    );
    setKelompokKecilCount(uniqueKelompok.size);

    // Calculate keahlian count (total keahlian required from mata kuliah, including duplicates)
    let totalKeahlianCount = 0;
    
    // Filter mata kuliah berdasarkan blok jika ada filter
    let mataKuliahForKeahlian = filteredMataKuliah;
    if (filterBlok !== "semua") {
      const blokNumber = parseInt(filterBlok);
      mataKuliahForKeahlian = filteredMataKuliah.filter((mk: MataKuliah) => 
        mk.blok === blokNumber
      );
    }
    
    mataKuliahForKeahlian.forEach((mk: MataKuliah) => {
      if (mk.keahlian_required) {
        // Handle both array and JSON string
        let keahlianArray: string[] = [];
        if (Array.isArray(mk.keahlian_required)) {
          keahlianArray = mk.keahlian_required;
        } else if (typeof mk.keahlian_required === 'string') {
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

    // Calculate total kelompok kecil from all active semesters
    const allKelompokKecil = kelompokKecilList || [];
    const uniqueAllKelompok = new Set(
      allKelompokKecil.map((kk: any) => `${kk.semester}__${kk.nama_kelompok}`)
    );
    setTotalKelompokKecilAllSemester(uniqueAllKelompok.size);

    // Calculate total dosen yang ditugaskan per semester (termasuk Koordinator & Tim Block)
    const totalDosenPerSemester = new Set<number>();

    // Hitung dosen dari pbl_mappings (Dosen Mengajar yang di-generate)
    Object.values(assignedDosen)
      .flat()
      .forEach((dosen) => {
        totalDosenPerSemester.add(dosen.id);
      });

    // Hitung dosen dari dosen_peran (Koordinator & Tim Block dari UserSeeder)
    dosenList.forEach((dosen) => {
      if (dosen.dosen_peran && Array.isArray(dosen.dosen_peran)) {
        const hasPeranInActiveSemester = dosen.dosen_peran.some((peran) => {
          if (
            peran.tipe_peran === "koordinator" ||
            peran.tipe_peran === "tim_blok"
          ) {
            // Cek apakah mata kuliah ini ada di semester aktif
            const mkInSemester = filteredMataKuliah.find(
              (mk) =>
                mk.nama === peran.mata_kuliah_nama &&
                mk.semester === peran.semester
            );
            return mkInSemester !== undefined;
          }
          return false;
        });

        if (hasPeranInActiveSemester) {
          totalDosenPerSemester.add(dosen.id);
        }
      }
    });

    setTotalKelompokKecilAllSemester(uniqueAllKelompok.size);

    // Calculate dosen counts by peran_utama - PERBAIKAN: Hitung keseluruhan, bukan per semester
    const peranKetuaCount = dosenList.filter((dosen) => {
      // Filter berdasarkan blok yang aktif
      if (filterBlok !== "semua") {
        const blokNumber = parseInt(filterBlok);
        return dosen.dosen_peran?.some(
          (peran: any) =>
            peran.tipe_peran === "koordinator" && peran.blok === blokNumber
        );
      }
      // Jika filter "semua", ambil semua koordinator (keseluruhan)
      return dosen.dosen_peran?.some(
        (peran: any) => peran.tipe_peran === "koordinator"
      );
    }).length;

    const peranAnggotaCount = dosenList.filter((dosen) => {
      // Filter berdasarkan blok yang aktif
      if (filterBlok !== "semua") {
        const blokNumber = parseInt(filterBlok);
        return dosen.dosen_peran?.some(
          (peran: any) =>
            peran.tipe_peran === "tim_blok" && peran.blok === blokNumber
        );
      }
      // Jika filter "semua", ambil semua tim blok (keseluruhan)
      return dosen.dosen_peran?.some(
        (peran: any) => peran.tipe_peran === "tim_blok"
      );
    }).length;

    // PERBAIKAN: Dosen Mengajar = Total dosen - Koordinator - Tim Blok
    const totalDosen = dosenList.length;
    const dosenMengajarCount = Math.max(0, totalDosen - peranKetuaCount - peranAnggotaCount);

    setPeranKetuaCount(peranKetuaCount);
    setPeranAnggotaCount(peranAnggotaCount);
    setDosenMengajarCount(dosenMengajarCount);
  };

  // Filter mata kuliah by active semester
  const filteredMataKuliah = useMemo(() => {
    return activeSemesterJenis
      ? blokMataKuliah.filter(
          (mk: MataKuliah) =>
            mk.periode &&
            mk.periode.trim().toLowerCase() ===
              activeSemesterJenis.trim().toLowerCase()
        )
      : blokMataKuliah;
  }, [blokMataKuliah, activeSemesterJenis]);

  // Group by semester
  const groupedBySemester = useMemo(() => {
    return filteredMataKuliah.reduce(
      (acc: Record<number, MataKuliah[]>, mk: MataKuliah) => {
        if (!acc[mk.semester]) acc[mk.semester] = [];
        acc[mk.semester].push(mk);
        return acc;
      },
      {}
    );
  }, [filteredMataKuliah]);

  const sortedSemesters = Object.keys(groupedBySemester)
    .map(Number)
    .sort((a, b) => a - b);

  // Calculate statistics
  const totalPBL = useMemo(() => {
    return filteredMataKuliah.reduce(
      (acc, mk) => acc + (pblData[mk.kode]?.length || 0),
      0
    );
  }, [filteredMataKuliah, pblData]);

  const pblStats = useMemo(() => {
    let belum = 0,
      sudah = 0;
    filteredMataKuliah.forEach((mk) => {
      (pblData[mk.kode] || []).forEach((pbl) => {
        const assigned = assignedDosen[pbl.id!] || [];
        if (assigned.length > 0) sudah++;
        else belum++;
      });
    });
    return { belum, sudah };
  }, [filteredMataKuliah, pblData, assignedDosen]);

  // Filter dosen (exclude standby)
  const dosenWithKeahlian = useMemo(() => {
    return dosenList; // Tidak perlu mapping lagi karena parseKeahlian sudah menangani
  }, [dosenList]);

  // Dosen regular: tidak memiliki keahlian "standby"
  const regularDosenList = useMemo(() => {
    return dosenWithKeahlian.filter(
      (d) =>
        !parseKeahlian(d.keahlian).some((k) =>
          k.toLowerCase().includes("standby")
        )
    );
  }, [dosenWithKeahlian]);

  // Dosen standby: memiliki keahlian "standby"
  const standbyDosenList = useMemo(() => {
    return dosenWithKeahlian.filter((d) =>
      parseKeahlian(d.keahlian).some((k) => k.toLowerCase().includes("standby"))
    );
  }, [dosenWithKeahlian]);

  // Helper untuk parsing keahlian agar selalu array string rapi
  function parseKeahlian(val: string[] | string | undefined): string[] {
    if (!val) return [];
    if (Array.isArray(val)) return val;
    if (typeof val === "string") {
      try {
        const arr = JSON.parse(val);
        if (Array.isArray(arr)) return arr;
      } catch {
        // Bukan JSON, split biasa
      }
      return val
        .split(",")
        .map((k) => k.trim())
        .filter((k) => k !== "");
    }
    return [];
  }

  // PENTING: Sistem prioritas untuk distribusi adil
  const calculateDosenPriority = useCallback(async () => {
    try {
      // 1. Hitung total assignment global dari assignedDosen
      const dosenAssignmentCount: Record<number, number> = {};
      
      // Inisialisasi semua dosen dengan 0 assignment
      dosenList.forEach(dosen => {
        dosenAssignmentCount[dosen.id] = 0;
      });
      
      // Hitung assignment dari data yang sudah ada
      Object.values(assignedDosen).forEach(assignedDosenList => {
        assignedDosenList.forEach((dosen: Dosen) => {
          if (dosenAssignmentCount[dosen.id] !== undefined) {
            dosenAssignmentCount[dosen.id]++;
          }
        });
      });
      

      
      // 2. Ambil data PBL dari DosenRiwayat untuk mendapatkan total assignment yang lebih akurat
      try {
        const pblReportRes = await api.get("/reporting/dosen-pbl");
        const pblReportData = pblReportRes.data?.data || [];
        
        // Update assignment count berdasarkan data PBL
        pblReportData.forEach((dosenReport: any) => {
          const dosenId = dosenReport.dosen_id;
          if (dosenAssignmentCount[dosenId] !== undefined) {
            // Tambahkan total PBL assignment
            const totalPblAssignment = dosenReport.total_pbl || 0;
            dosenAssignmentCount[dosenId] += totalPblAssignment;
          }
        });
        

              } catch (error) {
          // Error handling for PBL report data
        }
      
      // 3. Urutkan dosen berdasarkan prioritas (0 assignment = prioritas tertinggi)
      const dosenWithPriority = dosenList.map(dosen => ({
        ...dosen,
        assignmentCount: dosenAssignmentCount[dosen.id] || 0
      }));
      
      // Urutkan berdasarkan assignment count (ascending)
      dosenWithPriority.sort((a, b) => a.assignmentCount - b.assignmentCount);
      

      
      return dosenWithPriority;
    } catch (error) {
      console.error("Error menghitung prioritas dosen:", error);
      return dosenList.map(dosen => ({ ...dosen, assignmentCount: 0 }));
    }
  }, [dosenList, assignedDosen]);

  // PENTING: Filter dan urutkan dosen berdasarkan keahlian dan prioritas
  const getPrioritizedDosenList = useCallback(async (
    keahlianRequired: string[],
    excludeIds: Set<number> = new Set()
  ) => {

    
    // 1. Dapatkan dosen dengan prioritas
    const dosenWithPriority = await calculateDosenPriority();
    
    // 2. Filter berdasarkan keahlian
    const dosenWithKeahlian = dosenWithPriority.filter(dosen => {
      if (!dosen.keahlian || !keahlianRequired || keahlianRequired.length === 0) return true;
      
      const keahlianDosen = parseKeahlian(dosen.keahlian);
      return keahlianRequired.some(req => 
        keahlianDosen.some(k => k.toLowerCase().includes(req.toLowerCase()))
      );
    });
    

    
    // 3. Exclude dosen yang sudah di-assign
    const availableDosen = dosenWithKeahlian.filter(dosen => !excludeIds.has(dosen.id));
    
    // 4. Urutkan berdasarkan prioritas (assignment count rendah = prioritas tinggi)
    availableDosen.sort((a, b) => {
      // Jika assignment count sama, urutkan berdasarkan keahlian yang lebih cocok
      if (a.assignmentCount === b.assignmentCount) {
        const aKeahlian = parseKeahlian(a.keahlian);
        const bKeahlian = parseKeahlian(b.keahlian);
        
        // Hitung match score untuk keahlian
        const aMatchScore = keahlianRequired.reduce((score, req) => {
          return score + aKeahlian.filter(k => 
            k.toLowerCase().includes(req.toLowerCase())
          ).length;
        }, 0);
        
        const bMatchScore = keahlianRequired.reduce((score, req) => {
          return score + bKeahlian.filter(k => 
            k.toLowerCase().includes(req.toLowerCase())
          ).length;
        }, 0);
        
        // Jika match score sama, random selection
        if (aMatchScore === bMatchScore) {
          return Math.random() - 0.5; // Random selection
        }
        
        return bMatchScore - aMatchScore; // Match score tinggi = prioritas tinggi
      }
      
      return a.assignmentCount - b.assignmentCount; // Assignment count rendah = prioritas tinggi
    });
    

    
    return availableDosen;
  }, [calculateDosenPriority, parseKeahlian]);

  // Generate dosen assignments per blok & semester
  const handleGenerateDosen = async () => {
    setIsGenerating(true);
    setError(null);
    setSuccess(null);
    setWarning(null);

    // Validasi berurutan sekarang ditangani di backend

    // === CONSTRAINTS YANG DITERAPKAN ===
    // 1. Koordinator: 1 per mata kuliah, assign ke SEMUA modul
    // 2. Tim Blok: 4 per mata kuliah, assign ke SEMUA modul
    // 3. Dosen Mengajar: (modul × kelompok) - 5 + kompensasi kekurangan
    // 
    // === CONSTRAINT BARU: DOSEN MENGAJAR ===
    // Jika dosen sudah jadi Dosen Mengajar di blok tertentu,
    // TIDAK BOLEH jadi Dosen Mengajar lagi di blok yang sama dengan semester berbeda
    // 
    // Contoh:
    // - Dosen A jadi Dosen Mengajar di Blok 2 Semester 3 ✅
    // - Dosen A TIDAK BOLEH jadi Dosen Mengajar di Blok 2 Semester 1 ❌ (blok sama, semester berbeda)
    // - Dosen A BOLEH jadi Dosen Mengajar di Blok 3 Semester 1 ✅ (blok berbeda)
    // - Dosen A TIDAK BOLEH jadi Dosen Mengajar di Blok 2 Semester 5 ❌ (blok sama, semester berbeda)
    //
    // Tujuan: Mencegah dosen "monopoli" satu blok dan memastikan distribusi yang merata

    // === RESET GLOBAL TRACKING UNTUK CONSTRAINT ===
    // Reset global tracking untuk memulai proses generate yang bersih
    if ((window as any).globalDosenMengajarConstraint) {
      (window as any).globalDosenMengajarConstraint.clear();

    }

    // Validasi: Pastikan semua semester memiliki kelompok kecil
    const semesterTanpaKelompokKecil: number[] = [];
    for (const semester of sortedSemesters) {
      const semesterKey = String(semester);
      const semesterData = kelompokKecilData[semesterKey];
      if (!semesterData || !semesterData.details || semesterData.details.length === 0) {
        semesterTanpaKelompokKecil.push(semester);
      }
    }

    if (semesterTanpaKelompokKecil.length > 0) {
      setError(
        `Tidak dapat generate dosen karena ada semester yang belum memiliki kelompok kecil: Semester ${semesterTanpaKelompokKecil.join(
          ", "
        )}. Silakan buat kelompok kecil terlebih dahulu sebelum generate dosen.`
      );
      setIsGenerating(false);
      return;
    }

    try {
      // --- Generate untuk setiap semester di blok ---
      const assignments: { pbl_id: number; dosen_id: number }[] = [];
      const assignedPBLs: {
        mk: MataKuliah;
        pbl: PBL;
        kelompok: string;
        dosen: Dosen;
      }[] = [];
      const unassignedPBLs: {
        mk: MataKuliah;
        pbl: PBL;
        kelompok: string;
        reasons: string[];
      }[] = [];

      // Ambil data dosen yang sudah di-assign (Koordinator & Tim Blok dari UserSeeder)
      const pblIds = Object.values(pblData)
        .flat()
        .map((pbl) => pbl.id)
        .filter(Boolean);

      const existingAssignments = await api.post("/pbls/assigned-dosen-batch", {
        pbl_ids: pblIds,
      });
      const existingAssignedDosen = existingAssignments.data || {};

      for (const semester of sortedSemesters) {
        const semesterKey = String(semester);
        const semesterData = kelompokKecilData[semesterKey];
        

        
        if (!semesterData) {
          continue;
        }

        const kelompokList = Array.from(
          new Set((semesterData.details || []).map((kk) => kk.nama_kelompok))
        );
        const mkInSemester = filteredMataKuliah.filter(
          (mk) => mk.semester === semester
        );
        const allPBLs: { mk: MataKuliah; pbl: PBL }[] = [];
        mkInSemester.forEach((mk) => {
          (pblData[mk.kode] || []).forEach((pbl) => {
            allPBLs.push({ mk, pbl });
          });
        });

        // Hitung kompleksitas berdasarkan modul × kelompok
        const totalModul = allPBLs.length;
        const totalKelompok = kelompokList.length;
        const totalKompleksitas = totalModul * totalKelompok;
        
        // Validasi: Pastikan ada minimal 1 Koordinator dan 4 Tim Blok per mata kuliah
        const requiredKoordinator = 1; // 1 Koordinator per mata kuliah
        const requiredTimBlok = 4; // 4 Tim Blok per mata kuliah
        const totalRequired = requiredKoordinator + requiredTimBlok; // 5 total
        
        // Dosen mengajar = Total kompleksitas - 5 (1 Koordinator + 4 Tim Blok)
        const dosenMengajar = Math.max(0, totalKompleksitas - totalRequired);
        


        


        // Hitung Koordinator & Tim Blok yang sudah ada (dihormati)
        const existingKoordinatorTimBlok = new Set<number>();
        allPBLs.forEach(({ pbl }) => {
          const assigned = existingAssignedDosen[pbl.id!] || [];
          assigned.forEach((dosen: Dosen) => {
            // Cek apakah dosen ini Koordinator atau Tim Blok dari UserSeeder
            if (dosen.dosen_peran && Array.isArray(dosen.dosen_peran)) {
              const isKoordinatorOrTimBlok = dosen.dosen_peran.some(
                (peran) =>
                  peran.tipe_peran === "koordinator" ||
                  peran.tipe_peran === "tim_blok"
              );
              if (isKoordinatorOrTimBlok) {
                existingKoordinatorTimBlok.add(dosen.id);
              }
            }
          });
        });


        
        // Kelompokkan PBL berdasarkan mata kuliah
        const pblByMataKuliah: Record<string, { mk: MataKuliah; pbl: PBL }[]> = {};
        for (const { mk, pbl } of allPBLs) {
          if (!pblByMataKuliah[mk.kode]) {
            pblByMataKuliah[mk.kode] = [];
          }
          pblByMataKuliah[mk.kode].push({ mk, pbl });
        }
        

        
        // Assign Koordinator & Tim Blok ke SEMUA modul dari setiap mata kuliah
        for (const [kodeMk, pblList] of Object.entries(pblByMataKuliah)) {

          // Urutkan PBL berdasarkan modul_ke
          pblList.sort((a, b) => Number(a.pbl.modul_ke) - Number(b.pbl.modul_ke));
          
          // Cari Koordinator untuk mata kuliah ini (WAJIB 1 Koordinator per mata kuliah)
          // VALIDASI INI BERLAKU UNTUK SEMUA BLOK: Blok 1, 2, 3, 4
          const allKoordinatorForMk = dosenList.filter((dosen) =>
            dosen.dosen_peran?.some(
              (peran: any) =>
                peran.tipe_peran === "koordinator" &&
                peran.mata_kuliah_kode === kodeMk &&
                peran.semester === pblList[0].mk.semester
            )
          );
          
          // PENTING: Ambil hanya 1 Koordinator (jika ada duplikat, ambil yang pertama)
          // INI BERLAKU UNTUK SEMUA BLOK: Blok 1, 2, 3, 4
          const koordinatorList = allKoordinatorForMk.slice(0, 1); // WAJIB 1 KOORDINATOR
          
          // Validasi: Pastikan ada Koordinator
          if (koordinatorList.length === 0) {
            console.warn(`⚠️ Mata kuliah ${kodeMk} (Blok ${pblList[0].mk.blok}) tidak memiliki Koordinator!`);
          } else if (allKoordinatorForMk.length > 1) {
            console.warn(`⚠️ Mata kuliah ${kodeMk} (Blok ${pblList[0].mk.blok}) memiliki ${allKoordinatorForMk.length} Koordinator (duplikat)! Menggunakan yang pertama.`);
          }
          

          


          // Cari Tim Blok untuk mata kuliah ini (WAJIB 4 Tim Blok per mata kuliah)
          // VALIDASI INI BERLAKU UNTUK SEMUA BLOK: Blok 1, 2, 3, 4
          const allTimBlokForMk = dosenList.filter((dosen) =>
            dosen.dosen_peran?.some(
              (peran: any) =>
                peran.tipe_peran === "tim_blok" &&
                peran.mata_kuliah_kode === kodeMk &&
                peran.semester === pblList[0].mk.semester
            )
          );
          
          // PENTING: Ambil hanya 4 Tim Blok (jika ada duplikat, ambil yang pertama)
          // INI BERLAKU UNTUK SEMUA BLOK: Blok 1, 2, 3, 4
          const timBlokList = allTimBlokForMk.slice(0, 4); // WAJIB 4 TIM BLOK
          
          // Validasi: Pastikan ada 4 Tim Blok
          const timBlokKurang = 4 - timBlokList.length;
          if (timBlokKurang > 0) {
            console.warn(`⚠️ Mata kuliah ${kodeMk} (Blok ${pblList[0].mk.blok}) hanya memiliki ${timBlokList.length} Tim Blok, kurang ${timBlokKurang}!`);
          } else if (allTimBlokForMk.length > 4) {
            console.warn(`⚠️ Mata kuliah ${kodeMk} (Blok ${pblList[0].mk.blok}) memiliki ${allTimBlokForMk.length} Tim Blok (duplikat)! Menggunakan 4 yang pertama.`);
          }

          // Assign Koordinator & Tim Blok ke SEMUA modul
          for (const { mk, pbl } of pblList) {
          // Cek existing assignments
          const existingAssigned = existingAssignedDosen[pbl.id!] || [];

            // LOGIKA ASSIGNMENT (BERLAKU UNTUK SEMUA BLOK: Blok 1, 2, 3, 4):
            // 1. Koordinator: 1 per mata kuliah, assign ke SEMUA modul
            // 2. Tim Blok: 4 per mata kuliah, assign ke SEMUA modul  
            // 3. Dosen Mengajar: (modul × kelompok) - 5, assign berdasarkan keahlian
            // 
            // CATATAN: Jika ada duplikat Koordinator/Tim Blok di database, 
            // sistem akan mengambil yang pertama dan memberikan warning
            // 
            // VALIDASI PER BLOK:
            // - Blok 1: 1 Koordinator + 4 Tim Blok per mata kuliah
            // - Blok 2: 1 Koordinator + 4 Tim Blok per mata kuliah  
            // - Blok 3: 1 Koordinator + 4 Tim Blok per mata kuliah
            // - Blok 4: 1 Koordinator + 4 Tim Blok per mata kuliah
            
            // PENTING: Assign Koordinator & Tim Blok ke SEMUA modul dari mata kuliah ini
            if (koordinatorList.length > 0) {
              const koordinator = koordinatorList[0]; // Ambil hanya 1 Koordinator

              // Assign Koordinator ke SEMUA modul dari mata kuliah ini
              for (const { mk: mkForAssignment, pbl: pblForAssignment } of pblList) {
                assignments.push({ pbl_id: pblForAssignment.id!, dosen_id: koordinator.id });
              existingKoordinatorTimBlok.add(koordinator.id);
              assignedPBLs.push({
                  mk: mkForAssignment,
                  pbl: pblForAssignment,
                kelompok: "Koordinator",
                dosen: koordinator,
          });
              }
            }

            // Assign Tim Blok ke SEMUA modul dari mata kuliah ini
          timBlokList.forEach((timBlok) => {
              for (const { mk: mkForAssignment, pbl: pblForAssignment } of pblList) {
                assignments.push({ pbl_id: pblForAssignment.id!, dosen_id: timBlok.id });
              existingKoordinatorTimBlok.add(timBlok.id);
              assignedPBLs.push({
                  mk: mkForAssignment,
                  pbl: pblForAssignment,
                kelompok: "Tim Blok",
                dosen: timBlok,
              });
              }
          });
        }

        // LOGIKA YANG BENAR: Setelah Koordinator & Tim Blok, assign Dosen Mengajar berdasarkan keahlian
        // PENTING: Jika Tim Blok kurang dari 4, otomatis diganti dengan Dosen Mengajar
        // Buat list semua kombinasi kelompok × modul yang belum terisi
        const assignmentTargets: {
          mk: MataKuliah;
          pbl: PBL;
          kelompok: string;
        }[] = [];
        
        // PENTING: Hitung Koordinator dan Tim Blok yang kurang dari semua mata kuliah
        let totalKoordinatorKurang = 0;
        let totalTimBlokKurang = 0;
        
        for (const [kodeMk, pblList] of Object.entries(pblByMataKuliah)) {
          // Hitung Koordinator yang kurang
          const koordinatorList = dosenList.filter((dosen) =>
            dosen.dosen_peran?.some(
              (peran: any) =>
                peran.tipe_peran === "koordinator" &&
                peran.mata_kuliah_kode === kodeMk &&
                peran.semester === pblList[0].mk.semester
            )
          ).slice(0, 1);
          totalKoordinatorKurang += (1 - koordinatorList.length); // Kurang per mata kuliah
          
          // Hitung Tim Blok yang kurang
          const timBlokList = dosenList.filter((dosen) =>
            dosen.dosen_peran?.some(
              (peran: any) =>
                peran.tipe_peran === "tim_blok" &&
                peran.mata_kuliah_kode === kodeMk &&
                peran.semester === pblList[0].mk.semester
            )
          ).slice(0, 4);
          totalTimBlokKurang += (4 - timBlokList.length); // Kurang per mata kuliah, BUKAN per modul
        }
        
        // PENTING: Dosen Mengajar = (modul × kelompok) - 5 + kompensasi Koordinator dan Tim Blok yang kurang
        const totalKekurangan = totalKoordinatorKurang + totalTimBlokKurang;
        const dosenMengajarDenganKompensasi = dosenMengajar + totalKekurangan;
        






        
        for (const { mk, pbl } of allPBLs) {
          // Setiap modul mendapatkan dosen mengajar yang sama (termasuk kompensasi Tim Blok)
          for (let i = 0; i < dosenMengajarDenganKompensasi; i++) {
            assignmentTargets.push({ mk, pbl, kelompok: `Kelompok ${i + 1}` });
            }
          }
        
        const expectedTargets = dosenMengajarDenganKompensasi * totalModul;
        if (assignmentTargets.length !== expectedTargets) {
          console.warn(`⚠️ Assignment targets tidak sesuai: ${assignmentTargets.length} vs ${expectedTargets}`);
        }

        // URUTKAN: Kelompok dulu, lalu modul (untuk konsistensi)
        assignmentTargets.sort((a, b) => {
          if (a.kelompok !== b.kelompok) {
            return a.kelompok.localeCompare(b.kelompok);
          }
          return Number(a.pbl.modul_ke) - Number(b.pbl.modul_ke);
        });

        // Map modul -> dosen yang sudah ditugaskan
        const modulDosenMap: Record<string, number[]> = {};


        
        // PENTING: Track dosen yang sudah di-assign per blok untuk mencegah duplikasi
        const dosenAssignedPerBlok: Record<number, Set<number>> = {};
        
        // PENTING: Track dosen yang sudah di-assign dalam semester saat ini (RESET setiap semester)
        // Reset tracking untuk semester baru
        const dosenAssignedInThisProcess: Record<number, Set<number>> = {};

        // PENTING: Gunakan sistem prioritas untuk memilih dosen mengajar
        const keahlianRequired = mkInSemester[0]?.keahlian_required || [];
        
        // Dapatkan dosen dengan prioritas (exclude Koordinator & Tim Blok)
        const prioritizedDosenList = await getPrioritizedDosenList(keahlianRequired, existingKoordinatorTimBlok);
        
        // Pilih dosen mengajar berdasarkan prioritas (termasuk kompensasi Tim Blok)
        const selectedDosenMengajar = prioritizedDosenList.slice(0, dosenMengajarDenganKompensasi);
      
        
        // PENTING: Validasi dan filter dosen yang tidak boleh di-assign ke blok yang sama
        const finalSelectedDosenMengajar: Dosen[] = [];
        
        // === IMPLEMENTASI CONSTRAINT DOSEN MENGAJAR ===
        // Constraint: Jika dosen sudah jadi Dosen Mengajar di blok tertentu,
        // tidak boleh jadi Dosen Mengajar lagi di blok yang sama dengan semester berbeda
        // 
        // PENJELASAN DETAIL CONSTRAINT:
        // 1. Database Check: Cek apakah dosen sudah di-assign sebagai Dosen Mengajar
        //    di blok yang sama tapi semester berbeda dalam data yang sudah ada
        // 2. Process Check: Cek apakah dosen sudah di-assign dalam proses generate saat ini
        // 3. Cross-Semester Check: Cek apakah dosen sudah di-assign ke blok yang sama
        //    di semester yang berbeda dalam proses yang sama
        // 4. Blok-based: Constraint berlaku per blok, bukan per mata kuliah
        // 
        // ALUR VALIDASI:
        // 1. Dosen A apply untuk Blok 2 Semester 3 ✅ (diterima)
        // 2. Dosen A apply untuk Blok 2 Semester 1 ❌ (ditolak - constraint violated)
        // 3. Dosen A apply untuk Blok 3 Semester 1 ✅ (diterima - blok berbeda)
        // 4. Dosen A apply untuk Blok 2 Semester 5 ❌ (ditolak - blok sama, semester berbeda)
        //
        // TUJUAN:
        // - Mencegah dosen "monopoli" satu blok
        // - Memastikan distribusi pengajar yang merata
        // - Meningkatkan variasi pengajar per semester
        // - Mempertahankan kualitas pengajaran dengan rotasi dosen
        
        // === GLOBAL TRACKING UNTUK CONSTRAINT DOSEN MENGAJAR ===
        // Track dosen yang sudah di-assign sebagai Dosen Mengajar per blok
        if (!(window as any).globalDosenMengajarConstraint) {
          (window as any).globalDosenMengajarConstraint = new Map(); // blok -> Set<dosen_id>
        }
        const globalDosenMengajarConstraint = (window as any).globalDosenMengajarConstraint;
        
        const checkDosenMengajarConstraint = (dosen: Dosen, currentBlok: number | null, currentSemester: number): boolean => {
          if (!currentBlok) return true; // Skip jika tidak ada blok
          

          
          // === VALIDASI 1: Database Check ===
          // Cek apakah dosen sudah di-assign sebagai Dosen Mengajar di blok yang sama
          // tapi semester berbeda dalam data yang sudah ada di database

          
          for (const [pblId, assignedDosenList] of Object.entries(assignedDosen)) {
            let foundPbl: any = null;
            for (const [mkKode, pblList] of Object.entries(pblData)) {
              const pbl = pblList.find((p: any) => p.id === Number(pblId));
              if (pbl) {
                const mk = filteredMataKuliah.find((m: any) => m.kode === mkKode);
                if (mk) {
                  foundPbl = { pbl, mk };
                  break;
                }
              }
            }
            
            // Jika dosen sudah di-assign ke blok yang sama tapi semester berbeda
            if (foundPbl && foundPbl.mk.blok === currentBlok && foundPbl.mk.semester !== currentSemester) {

              
              // PENTING: Cek apakah dosen ini di-assign sebagai Dosen Mengajar (bukan Koordinator/Tim Blok)
              const isDosenMengajarAssigned = assignedDosenList.some(
                (assignedDosen: any) => {
                  // Cek apakah dosen ini adalah dosen yang sedang divalidasi
                  if (assignedDosen.id !== dosen.id) return false;
                  


                  
                  // Cek apakah dosen ini di-assign sebagai Dosen Mengajar (bukan Koordinator/Tim Blok)
                  if (assignedDosen.dosen_peran && Array.isArray(assignedDosen.dosen_peran)) {
                    // Jika ada dosen_peran, cek apakah ada peran "dosen_mengajar"
                    const hasDosenMengajarRole = assignedDosen.dosen_peran.some(
                      (peran: any) => peran.tipe_peran === "dosen_mengajar"
                    );

                    return hasDosenMengajarRole;
                  } else {
                    // Jika tidak ada dosen_peran, berarti ini adalah assignment baru dari generate
                    // yang berarti Dosen Mengajar (bukan dari UserSeeder)

                    return true;
                  }
                }
              );
              
              if (isDosenMengajarAssigned) {

                return false; // Constraint violated
              }
            }
          }
          
          // === VALIDASI 2: Global Process Check ===
          // Cek apakah dosen sudah di-assign sebagai Dosen Mengajar ke blok yang sama
          // dalam proses generate yang sama (cross-semester)
          if (globalDosenMengajarConstraint.has(currentBlok)) {
            const dosenInBlok = globalDosenMengajarConstraint.get(currentBlok);

            if (dosenInBlok.has(dosen.id)) {

              return false; // Constraint violated
            }
          } else {

          }
          
          // === VALIDASI 3: Current Semester Process Check ===
          // Cek apakah dosen sudah di-assign dalam semester saat ini
          // PENTING: Ini hanya untuk mencegah duplikasi dalam semester yang sama
          if (!dosenAssignedInThisProcess[currentBlok]) {
            dosenAssignedInThisProcess[currentBlok] = new Set();
          }
          

          
          if (dosenAssignedInThisProcess[currentBlok].has(dosen.id)) {

            return false; // Constraint violated
          }
          


          return true; // Constraint satisfied
        };
        
        // === FUNGSI UNTUK UPDATE GLOBAL TRACKING ===
        const updateGlobalDosenMengajarConstraint = (dosen: Dosen, blok: number) => {
          if (!globalDosenMengajarConstraint.has(blok)) {
            globalDosenMengajarConstraint.set(blok, new Set());
          }
          globalDosenMengajarConstraint.get(blok).add(dosen.id);


        };
        
        for (const dosen of selectedDosenMengajar) {
          // PENTING: Validasi dosen yang tidak boleh di-assign ke blok yang sama
          const currentBlok = mkInSemester[0]?.blok;
          let isDosenAlreadyAssignedToSameBlok = false;

          if (currentBlok) {
            // Cek di semua semester yang sudah diproses sebelumnya
            for (const processedSemester of sortedSemesters) {
              if (processedSemester === semester) continue; // Skip semester saat ini
              
              const processedSemesterKey = String(processedSemester);
              const processedSemesterData = kelompokKecilData[processedSemesterKey];
              if (!processedSemesterData) continue;
              
              const processedMkInSemester = filteredMataKuliah.filter(
                (mk) => mk.semester === processedSemester
              );
              
              // Cek apakah ada mata kuliah dengan blok yang sama
              const sameBlokMk = processedMkInSemester.find(mk => mk.blok === currentBlok);
              if (sameBlokMk) {
                // Cek apakah dosen ini sudah di-assign ke blok yang sama
                const processedPbls = pblData[sameBlokMk.kode] || [];
                for (const pbl of processedPbls) {
                  if (pbl.id && assignedDosen[pbl.id]) {
                    // PENTING: Cek apakah dosen ini di-assign sebagai Dosen Mengajar (bukan Koordinator/Tim Blok)
                    const isDosenMengajarAssigned = assignedDosen[pbl.id].some(
                      (assignedDosen: any) => {
                        // Cek apakah dosen ini adalah dosen yang sedang divalidasi
                        if (assignedDosen.id !== dosen.id) return false;
                        
                        // Cek apakah dosen ini di-assign sebagai Dosen Mengajar (bukan Koordinator/Tim Blok)
                        if (assignedDosen.dosen_peran && Array.isArray(assignedDosen.dosen_peran)) {
                          // Jika ada dosen_peran, cek apakah ada peran "dosen_mengajar"
                          const hasDosenMengajarRole = assignedDosen.dosen_peran.some(
                            (peran: any) => peran.tipe_peran === "dosen_mengajar"
                          );
                          return hasDosenMengajarRole;
                        } else {
                          // Jika tidak ada dosen_peran, berarti ini adalah assignment baru dari generate
                          // yang berarti Dosen Mengajar (bukan dari UserSeeder)
                          return true;
                        }
                      }
                    );
                    if (isDosenMengajarAssigned) {
                      isDosenAlreadyAssignedToSameBlok = true;
                      break;
                    }
                  }
                }
                if (isDosenAlreadyAssignedToSameBlok) break;
              }
            }
            
            // Cek di data yang sudah ada di database
            if (!isDosenAlreadyAssignedToSameBlok) {
              for (const [pblId, assignedDosenList] of Object.entries(assignedDosen)) {
                let foundPbl: any = null;
                for (const [mkKode, pblList] of Object.entries(pblData)) {
                  const pbl = pblList.find((p: any) => p.id === Number(pblId));
                  if (pbl) {
                    const mk = filteredMataKuliah.find((m: any) => m.kode === mkKode);
                    if (mk) {
                      foundPbl = { pbl, mk };
                      break;
                    }
                  }
                }
                
                if (foundPbl && foundPbl.mk.semester !== semester && foundPbl.mk.blok === currentBlok) {
                  // PENTING: Cek apakah dosen ini di-assign sebagai Dosen Mengajar (bukan Koordinator/Tim Blok)
                  const isDosenMengajarAssigned = assignedDosenList.some(
                    (assignedDosen: any) => {
                      // Cek apakah dosen ini adalah dosen yang sedang divalidasi
                      if (assignedDosen.id !== dosen.id) return false;
                      
                      // Cek apakah dosen ini di-assign sebagai Dosen Mengajar (bukan Koordinator/Tim Blok)
                      if (assignedDosen.dosen_peran && Array.isArray(assignedDosen.dosen_peran)) {
                        // Jika ada dosen_peran, cek apakah ada peran "dosen_mengajar"
                        const hasDosenMengajarRole = assignedDosen.dosen_peran.some(
                          (peran: any) => peran.tipe_peran === "dosen_mengajar"
                        );
                        return hasDosenMengajarRole;
                      } else {
                        // Jika tidak ada dosen_peran, berarti ini adalah assignment baru dari generate
                        // yang berarti Dosen Mengajar (bukan dari UserSeeder)
                        return true;
                      }
                    }
                  );
                  if (isDosenMengajarAssigned) {
                    isDosenAlreadyAssignedToSameBlok = true;
                    break;
                  }
                }
              }
            }
            
            // Cek di data yang sudah di-assign dalam proses ini
            if (!isDosenAlreadyAssignedToSameBlok) {
              if (!dosenAssignedInThisProcess[currentBlok]) {
                dosenAssignedInThisProcess[currentBlok] = new Set();
              }
              
              if (dosenAssignedInThisProcess[currentBlok].has(dosen.id)) {
                isDosenAlreadyAssignedToSameBlok = true;
              }
            }
          }
          
          // === VALIDASI CONSTRAINT DOSEN MENGAJAR ===
          // Tambahan validasi untuk constraint Dosen Mengajar
          const isDosenMengajarConstraintSatisfied = checkDosenMengajarConstraint(dosen, currentBlok, semester);
          
          // Jika dosen tidak sudah di-assign ke blok yang sama DAN constraint Dosen Mengajar terpenuhi
          if (!isDosenAlreadyAssignedToSameBlok && isDosenMengajarConstraintSatisfied) {
            finalSelectedDosenMengajar.push(dosen);
            
            // === UPDATE GLOBAL TRACKING UNTUK CONSTRAINT ===
            if (currentBlok) {
              updateGlobalDosenMengajarConstraint(dosen, currentBlok);
              
              // Catat dosen yang sudah di-assign dalam semester saat ini
              if (!dosenAssignedInThisProcess[currentBlok]) {
                dosenAssignedInThisProcess[currentBlok] = new Set();
              }
              dosenAssignedInThisProcess[currentBlok].add(dosen.id);
            }
            

          } else {
            // Log alasan dosen tidak bisa di-assign
            if (!isDosenMengajarConstraintSatisfied) {

            } else if (isDosenAlreadyAssignedToSameBlok) {

            }
          }
        }
        
        // PENTING: Jika dosen yang dipilih tidak cukup, tambahkan dosen standby atau dosen dengan assignment count tinggi
        if (finalSelectedDosenMengajar.length < dosenMengajarDenganKompensasi) {



          // Cari dosen standby terlebih dahulu
          const standbyDosen = prioritizedDosenList.filter(dosen => {
            const keahlianDosen = parseKeahlian(dosen.keahlian);
            return keahlianDosen.some(k => k.toLowerCase().includes("standby"));
          });
          
          // Jika masih kurang, cari dosen dengan assignment count tinggi (yang sudah banyak tugas)
          const highAssignmentDosen = prioritizedDosenList
            .filter(dosen => !finalSelectedDosenMengajar.some(d => d.id === dosen.id))
            .sort((a, b) => (b.assignmentCount || 0) - (a.assignmentCount || 0));
          
          // Gabungkan dosen standby dan high assignment
          const fallbackDosen = [...standbyDosen, ...highAssignmentDosen];
          

          
          // Tambahkan dosen fallback sampai cukup
          for (const dosen of fallbackDosen) {
            if (finalSelectedDosenMengajar.length >= dosenMengajarDenganKompensasi) break;
            
            // Skip jika dosen sudah ada di final list
            if (finalSelectedDosenMengajar.some(d => d.id === dosen.id)) continue;
            
            // === VALIDASI CONSTRAINT DOSEN MENGAJAR UNTUK FALLBACK ===
            const currentBlok = mkInSemester[0]?.blok;
            const isDosenMengajarConstraintSatisfied = checkDosenMengajarConstraint(dosen, currentBlok, semester);
            
            if (isDosenMengajarConstraintSatisfied) {
              finalSelectedDosenMengajar.push(dosen);

              
              // === UPDATE GLOBAL TRACKING UNTUK CONSTRAINT ===
              if (currentBlok) {
                updateGlobalDosenMengajarConstraint(dosen, currentBlok);
                
                // Catat dosen yang sudah di-assign dalam semester saat ini
                if (!dosenAssignedInThisProcess[currentBlok]) {
                  dosenAssignedInThisProcess[currentBlok] = new Set();
                }
                dosenAssignedInThisProcess[currentBlok].add(dosen.id);
              }
            } else {

            }
          }
        }
        
        // PENTING: Validasi akhir - pastikan jumlah dosen sesuai
        if (finalSelectedDosenMengajar.length < dosenMengajarDenganKompensasi) {
          console.warn(`⚠️ Dosen mengajar tidak cukup: ${finalSelectedDosenMengajar.length} dari ${dosenMengajarDenganKompensasi} yang dibutuhkan`);
          console.warn(`⚠️ Constraint Dosen Mengajar mungkin terlalu ketat, pertimbangkan untuk mengurangi constraint`);
        } else {

        }

        // Assign dosen mengajar yang SAMA ke SEMUA modul
        for (const { mk, pbl } of allPBLs) {
          finalSelectedDosenMengajar.forEach((dosen: Dosen, index: number) => {
            if (pbl.id) {
              assignments.push({
                pbl_id: pbl.id,
                dosen_id: dosen.id
              });
              
            }
              });
            }
          }

      // VALIDASI AKHIR: Pastikan total assignment sesuai dengan kompleksitas
      let totalAssignmentPerSemester: Record<number, number> = {};
      
      for (const semester of sortedSemesters) {
        const semesterKey = String(semester);
        const semesterData = kelompokKecilData[semesterKey];
        if (!semesterData) continue;

        const kelompokList = Array.from(
          new Set((semesterData.details || []).map((kk) => kk.nama_kelompok))
        );
        const mkInSemester = filteredMataKuliah.filter(
          (mk) => mk.semester === semester
        );
        const allPBLs: { mk: MataKuliah; pbl: PBL }[] = [];
        mkInSemester.forEach((mk) => {
          (pblData[mk.kode] || []).forEach((pbl) => {
            allPBLs.push({ mk, pbl });
          });
        });

        const totalModul = allPBLs.length;
        const totalKelompok = kelompokList.length;
        const kompleksitas = totalModul * totalKelompok;
        
        // Hitung assignment untuk semester ini
        const semesterAssignments = assignments.filter((assignment: any) => {
          const pbl = allPBLs.find(({ pbl }) => pbl.id === assignment.pbl_id);
          return pbl && pbl.mk.semester === semester;
        });
        
        totalAssignmentPerSemester[semester] = semesterAssignments.length;
      
        
        // Validasi: Pastikan tidak melebihi kompleksitas per modul
        const expectedPerModul = kompleksitas;
        const actualPerModul = Math.ceil(semesterAssignments.length / totalModul);
        
        if (actualPerModul !== expectedPerModul) {
          // Warning: assignment per module validation
        }
      }

      // Send batch assignments
      if (assignments.length > 0) {

        await api.post("/pbls/assign-dosen-batch", { assignments });
      }

      // Refresh assigned dosen data
      const allPbls = Object.values(pblData).flat();
      const allPblIds = allPbls.map((pbl) => pbl.id).filter(Boolean);
      if (allPblIds.length > 0) {
        const assignedRes = await api.post("/pbls/assigned-dosen-batch", {
          pbl_ids: allPblIds,
        });
        setAssignedDosen(assignedRes.data || {});
      }

      // Set success and warning messages
      if (assignedPBLs.length > 0) {
        const totalAssigned = assignedPBLs.length;
        const totalDosen = new Set(assignedPBLs.map((item) => item.dosen.id))
          .size;
        
        // === SUMMARY CONSTRAINT DOSEN MENGAJAR ===



        
        // Hitung distribusi peran
        const koordinatorCount = assignedPBLs.filter(item => item.kelompok === "Koordinator").length;
        const timBlokCount = assignedPBLs.filter(item => item.kelompok === "Tim Blok").length;
        const dosenMengajarCount = assignedPBLs.filter(item => item.kelompok === "Kelompok 1" || item.kelompok === "Kelompok 2" || item.kelompok === "Kelompok 3" || item.kelompok === "Kelompok 4").length;
        






        setSuccess(
          `Berhasil generate ${totalAssigned} assignment untuk ${totalDosen} dosen dengan constraint Dosen Mengajar yang ketat.`
        );
        
        // Dispatch events untuk update UI
        window.dispatchEvent(
          new CustomEvent("pbl-assignment-updated", {
            detail: { timestamp: Date.now() },
          })
        );
        
        // Trigger event khusus untuk Dosen.tsx
        window.dispatchEvent(
          new CustomEvent("pbl-generate-completed", {
            detail: { timestamp: Date.now() },
          })
        );
      } else {
        setSuccess(
          "Generate dosen selesai. Semua slot sudah terisi oleh Koordinator & Tim Blok, tidak ada penugasan Dosen Mengajar yang diperlukan."
        );
      }

      // Gabungkan warning per modul/kelompok agar tidak duplikat
      const warningByTarget: Record<
        string,
        { mk: MataKuliah; pbl: PBL; kelompok: string; reasons: string[] }
      > = {};
      unassignedPBLs.forEach(({ mk, pbl, kelompok, reasons }) => {
        const key = `${mk.kode}-${pbl.id}-${kelompok}`;
        if (!warningByTarget[key]) {
          warningByTarget[key] = { mk, pbl, kelompok, reasons: [] };
        }
        warningByTarget[key].reasons.push(...reasons);
      });
      setUnassignedPBLList(Object.values(warningByTarget));
      setWarning(
        Object.values(warningByTarget).length > 0
          ? `Ada ${
              Object.values(warningByTarget).length
            } penugasan (modul × kelompok) yang tidak dapat di-assign karena tidak ada dosen yang cocok.`
          : null
      );
    } // End of main for loop
    } // End of try block
    catch (err: any) {
      // Handle backend validation errors
      if (err?.response?.data?.error && err?.response?.data?.message) {
        setError(err.response.data.message);
      } else {
      setError(err?.response?.data?.message || "Gagal generate dosen");
      }
      setIsGenerating(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetDosen = async () => {
    setResetLoading(true);
    setError(null);
    setSuccess(null);
    try {
      // Reset assignment untuk semua PBL di semester aktif
      const pblIds: number[] = filteredMataKuliah.flatMap((mk) =>
        (pblData[mk.kode] || []).map((pbl) => pbl.id!).filter(Boolean)
      );
      if (pblIds.length > 0) {
        await api.post("/pbls/reset-dosen-batch", { pbl_ids: pblIds });
      }
      // Refresh assigned dosen data
      const allPbls = Object.values(pblData).flat();
      const allPblIds = allPbls.map((pbl) => pbl.id).filter(Boolean);
      if (allPblIds.length > 0) {
        const assignedRes = await api.post("/pbls/assigned-dosen-batch", {
          pbl_ids: allPblIds,
        });
        setAssignedDosen(assignedRes.data || {});
      }
      setSuccess(
        "Reset assignment dosen berhasil! Semua dosen pada PBL di semester aktif telah direset."
      );

      // Trigger event untuk update reporting data secara real-time
      window.dispatchEvent(
        new CustomEvent("pbl-assignment-updated", {
          detail: { timestamp: Date.now() },
        })
      );
    } catch (err: any) {
      setError(err?.response?.data?.message || "Gagal reset assignment dosen");
    } finally {
      setResetLoading(false);
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

        {/* Content Skeleton */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                key={idx}
                className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg"
              >
                <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (blokId && filteredMataKuliah.length === 0) {
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
          Tidak ada mata kuliah blok {blokId} untuk semester aktif.
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
          <ChevronLeftIcon className="w-5 h-5" />
          Kembali
        </button>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
          Generate Dosen PBL - Blok {blokId}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Generate penugasan dosen (Koordinator + Tim Blok + Dosen Mengajar) untuk modul PBL
        </p>
      </div>

      {/* Statistics Cards */}
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
                Total Kelompok (Semua Semester)
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

      {/* Notifications */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-green-100 border text-green-700 p-3 rounded-lg mb-6"
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
            <div className="font-semibold mb-2 text-lg">⚠️ Warning:</div>
            <div className="mb-4">{warning}</div>
            <div className="space-y-4">
              {unassignedPBLList.map(({ mk, pbl, reasons }) => (
                <div
                  key={pbl.id}
                  className="p-3 rounded-lg bg-white/60 border border-yellow-300"
                >
                  <div className="font-bold text-base text-yellow-900 mb-1">
                    {mk.kode} - Modul {pbl.modul_ke}:{" "}
                    <span className="font-semibold">{pbl.nama_modul}</span>
                  </div>
                  <ul className="ml-4 mt-1 text-sm text-yellow-800 list-disc space-y-1">
                    {reasons.map((r, idx) => (
                      <li key={idx} className="flex items-center gap-2">
                        <span className="text-yellow-600">⚠️</span>
                        <span>{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate & Reset Button */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-2">
              Generate Dosen
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Klik tombol di bawah untuk menggenerate penugasan dosen secara otomatis
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={handleGenerateDosen}
              disabled={isGenerating || pblStats.belum === 0}
              className={`px-6 py-3 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition flex items-center gap-2 shadow-theme-xs ${
                isGenerating || pblStats.belum === 0
                  ? "opacity-60 cursor-not-allowed"
                  : ""
              }`}
            >
              {isGenerating ? (
                <>
                  <svg
                    className="w-5 h-5 animate-spin"
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
                  Menggenerate...
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faCog} className="w-4 h-4" />
                  Generate Dosen
                </>
              )}
            </button>
            <button
              onClick={handleResetDosen}
              disabled={resetLoading}
              className={`px-6 py-3 bg-red-500 text-white text-sm font-medium rounded-lg hover:bg-red-600 transition flex items-center gap-2 shadow-theme-xs ${
                resetLoading ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              {resetLoading ? (
                <>
                  <svg
                    className="w-5 h-5 animate-spin"
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
                <>
                  <FontAwesomeIcon icon={faCog} className="w-4 h-4" />
                  Reset Dosen
                </>
              )}
            </button>
          </div>
        </div>
        {/* Warning untuk semester tanpa kelompok kecil - pindah ke bawah tombol dan full width */}
        {(() => {
          const semesterTanpaKelompokKecil: number[] = [];
          sortedSemesters.forEach((semester) => {
            const semesterKey = String(semester);
            const semesterData = kelompokKecilData[semesterKey];
            if (
              !semesterData ||
              !semesterData.details ||
              semesterData.details.length === 0
            ) {
              semesterTanpaKelompokKecil.push(semester);
            }
          });

          if (semesterTanpaKelompokKecil.length > 0) {
            return (
              <div className="w-full mt-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-500 dark:border-red-700 rounded-lg flex items-center gap-3">
                <FontAwesomeIcon
                  icon={faExclamationTriangle}
                  className="w-6 h-6 text-red-500"
                />
                <div>
                  <div className="font-semibold text-red-700 dark:text-red-300 mb-1">
                    Semester yang belum memiliki kelompok kecil:
                  </div>
                  <div className="text-red-600 dark:text-red-400">
                    Semester {semesterTanpaKelompokKecil.join(", ")}
                  </div>
                  <div className="text-xs text-red-500 dark:text-red-400 mt-1">
                    Silakan buat kelompok kecil terlebih dahulu sebelum generate
                    dosen.
                  </div>
                </div>
              </div>
            );
          }
          return null;
        })()}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* PBL Modules by Semester (2 kolom) */}
        <div className="lg:col-span-2">
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
              Modul PBL per Semester ({filteredMataKuliah.length} mata kuliah)
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
                  Tidak ada mata kuliah blok untuk semester aktif.
                </p>
              </div>
            ) : (
              <div className="space-y-6">
                {sortedSemesters.map((semester) => {
                  const semesterPBLs = filteredMataKuliah.filter(
                    (mk) => mk.semester === semester
                  );
                  // Hitung total modul PBL di semester ini
                  const totalModulPBL = semesterPBLs.reduce(
                    (acc, mk) => acc + (pblData[mk.kode]?.length || 0),
                    0
                  );
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
                            {totalModulPBL} modul PBL
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
                                      (assignedDosen[pbl.id!] || []).forEach(
                                        (dosen) => {
                                          assignedDosenSet.add(dosen.id);
                                        }
                                      );
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
                                    kelompokKecilData[semesterKey];
                                  if (!semesterData) return "0 kelompok";
                                  // Hitung kelompok unik untuk semester ini berdasarkan details
                                  const uniqueKelompok = new Set(
                                    (semesterData.details || []).map(
                                      (kk) => kk.nama_kelompok
                                    )
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
                          const semesterData = kelompokKecilData[semesterKey];
                          if (
                            !semesterData ||
                            !semesterData.details ||
                            semesterData.details.length === 0
                          ) {
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
                            const semesterData = kelompokKecilData[semesterKey];
                            if (!semesterData) return null;

                            // Gabungkan semua nama kelompok unik dari mapping
                            const allKelompok = Array.from(
                              new Set(
                                Object.values(semesterData.mapping).flat()
                              )
                            );

                            // Ambil detail kelompok unik dari details
                            const kelompokDetails = allKelompok
                              .map((nama) =>
                                semesterData.details.find(
                                  (kk) => kk.nama_kelompok === nama
                                )
                              )
                              .filter((kelompok): kelompok is KelompokKecil =>
                                Boolean(kelompok)
                              );

                            return kelompokDetails.map((kelompok) => (
                              <div
                                key={kelompok.id}
                                className="flex items-center gap-2"
                              >
                                <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 text-xs font-medium">
                                  Kelompok {kelompok.nama_kelompok}
                                </span>
                                <button
                                  onClick={() => handleLihatMahasiswa(kelompok)}
                                  className="p-1.5 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                  title={`Lihat mahasiswa Kelompok ${kelompok.nama_kelompok}`}
                                >
                                  <FontAwesomeIcon
                                    icon={faEye}
                                    className="w-3 h-3"
                                  />
                                </button>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                      {/* PBL Cards */}
                      <div className="space-y-4">
                        {semesterPBLs.map((mk) => {
                          const pblList = pblData[mk.kode] || [];
                          return pblList.length === 0
                            ? null
                            : pblList.map((pbl, pblIdx) => {
                                const assigned = assignedDosen[pbl.id!] || [];
                                const statusBadge =
                                  assigned.length > 0 ? (
                                    <span className="text-xs px-3 py-1 rounded-full font-medium bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                                      Sudah Ditugaskan
                                    </span>
                                  ) : (
                                    <span className="text-xs px-3 py-1 rounded-full font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                                      Belum Ditugaskan
                                    </span>
                                  );
                                return (
                                  <div
                                    key={pbl.id}
                                    className="p-3 sm:p-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800/50 hover:shadow-md transition-all duration-300"
                                  >
                                    <div className="flex items-start justify-between gap-4 mb-2">
                                      <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-3">
                                          <div className="flex-1">
                                            <h4 className="font-semibold text-gray-800 dark:text-white/90 text-lg">
                                              {mk.kode} - {mk.nama}
                                            </h4>
                                            <p className="text-gray-600 dark:text-gray-400 text-sm">
                                              Modul {pbl.modul_ke} -{" "}
                                              {pbl.nama_modul}
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
                                      <div className="flex items-center gap-2">
                                        {statusBadge}
                                      </div>
                                    </div>
                                    {/* Assigned Dosen */}
                                    {assigned.length > 0 && (
                                      <div className="mt-4 p-3 bg-green-50 border border-green-200 dark:bg-green-900/20 dark:border-green-700 rounded-lg">
                                        <div className="text-sm font-medium text-green-800 dark:text-green-200 mb-2">
                                          Dosen yang Ditugaskan:
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                          {assigned.map((dosen) => {
                                            // Cek apakah dosen ini Koordinator atau Tim Blok untuk mata kuliah ini
                                            const dosenPeran =
                                              dosen.dosen_peran?.find(
                                                (peran: any) =>
                                                  peran.mata_kuliah_kode ===
                                                    mk.kode &&
                                                  peran.semester ===
                                                    mk.semester &&
                                                  (peran.tipe_peran ===
                                                    "koordinator" ||
                                                    peran.tipe_peran ===
                                                      "tim_blok")
                                              );

                                            const isKoordinator =
                                              dosenPeran?.tipe_peran ===
                                              "koordinator";
                                            const isTimBlok =
                                              dosenPeran?.tipe_peran ===
                                              "tim_blok";

                                            // Tentukan styling berdasarkan peran
                                            let bgColor =
                                              "bg-green-100 dark:bg-green-900/40";
                                            let textColor =
                                              "text-green-700 dark:text-green-200";
                                            let borderColor =
                                              "border-green-300";
                                            let roleLabel = "";
                                            let avatarColor = "bg-green-500";

                                            if (isKoordinator) {
                                              bgColor =
                                                "bg-blue-100 dark:bg-blue-900/40";
                                              textColor =
                                                "text-blue-700 dark:text-blue-200";
                                              borderColor = "border-blue-300";
                                              roleLabel = "Koordinator";
                                              avatarColor = "bg-blue-500";
                                            } else if (isTimBlok) {
                                              bgColor =
                                                "bg-purple-100 dark:bg-purple-900/40";
                                              textColor =
                                                "text-purple-700 dark:text-purple-200";
                                              borderColor = "border-purple-300";
                                              roleLabel = "Tim Blok";
                                              avatarColor = "bg-purple-500";
                                            }

                                            return (
                                              <div
                                                key={dosen.id}
                                                className={`flex items-center gap-2 px-3 py-1 rounded-full ${bgColor}`}
                                              >
                                                <div
                                                  className={`w-6 h-6 rounded-full flex items-center justify-center ${avatarColor}`}
                                                >
                                                  <span className="text-white text-xs font-bold">
                                                    {dosen.name.charAt(0)}
                                                  </span>
                                                </div>
                                                  <span
                                                    className={`text-xs font-medium ${textColor}`}
                                                  >
                                                    {dosen.name}
                                                  {roleLabel && (
                                                    <span className="ml-1 text-[10px] opacity-75">
                                                      ({roleLabel})
                                                    </span>
                                                  )}
                                                </span>
                                              </div>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    )}
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
            {/* Dosen Information */}
            <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90 mb-4">
              Dosen Tersedia (
              {regularDosenList.length + standbyDosenList.length})
            </h3>

            {/* Dosen Reguler */}
            <div className="mb-6">
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full bg-brand-500"></div>
                <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Dosen Reguler ({regularDosenList.length})
                </h4>
              </div>
              <div className="space-y-3 max-h-[500px] overflow-y-auto hide-scroll">
                {regularDosenList.length > 0 ? (
                  regularDosenList.map((dosen) => (
                    <div
                      key={dosen.id}
                      className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl  hover:shadow-md transition-all duration-200"
                    >
                      {/* Header dengan Avatar dan Info Dasar */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center ">
                          <span className="text-white text-sm font-bold">
                            {dosen.name.charAt(0)}
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

                      {/* Peran Utama Badge - Lebih Menonjol */}
                      <div className="mb-3">
                        {dosen.peran_utama === "koordinator" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs">
                            Koordinator
                          </span>
                        )}
                        {dosen.peran_utama === "tim blok" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-green-100 text-green-700 text-xs">
                            Tim Blok
                          </span>
                        )}
                        {dosen.peran_utama === "dosen_mengajar" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-yellow-100 text-yellow-700 text-xs">
                            Dosen Mengajar
                          </span>
                        )}
                        {dosen.peran_utama === "standby" && (
                          <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-gray-200 text-gray-700 text-xs">
                            Standby
                          </span>
                        )}
                      </div>

                      {/* Info Section dengan Layout yang Lebih Jelas */}
                      <div className="space-y-3">
                        {/* Mata Kuliah/Peran Kurikulum */}
                        <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3">
                          <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-2 flex items-center gap-1">
                            <div className="w-1 h-1 rounded-full bg-purple-500"></div>
                            Mata Kuliah / Peran Kurikulum
                          </div>
                          {["koordinator", "tim_blok", "mengajar"].map(
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
                              if (tipe === "mengajar") {
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
              <div className="space-y-3 max-h-80 overflow-y-auto hide-scroll">
                {standbyDosenList.length > 0 ? (
                  standbyDosenList.map((dosen) => (
                    <div
                      key={dosen.id}
                      className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-xl  hover:shadow-md transition-all duration-200"
                    >
                      {/* Header dengan Avatar dan Info Dasar */}
                      <div className="flex items-start gap-3 mb-3">
                        <div className="w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center ">
                          <span className="text-white text-sm font-bold">
                            {dosen.name.charAt(0)}
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
                {/* Pagination bawah ala MataKuliah.tsx */}
                {showMahasiswaModal.mahasiswa.length > 5 && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4">
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      Menampilkan{" "}
                      {Math.min(5, showMahasiswaModal.mahasiswa.length)} dari{" "}
                      {showMahasiswaModal.mahasiswa.length} mahasiswa
                    </span>
                    <div className="flex gap-1">
                      <button
                        onClick={() =>
                          setPageMahasiswaModal((p) => Math.max(1, p - 1))
                        }
                        disabled={pageMahasiswaModal === 1}
                        className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                      >
                        Prev
                      </button>
                      {Array.from(
                        {
                          length: Math.ceil(
                            showMahasiswaModal.mahasiswa.length / 5
                          ),
                        },
                        (_, i) => (
                          <button
                            key={i}
                            onClick={() => setPageMahasiswaModal(i + 1)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 ${
                              pageMahasiswaModal === i + 1
                                ? "bg-brand-500 text-white"
                                : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                            } transition`}
                          >
                            {i + 1}
                          </button>
                        )
                      )}
                      <button
                        onClick={() =>
                          setPageMahasiswaModal((p) =>
                            Math.min(
                              Math.ceil(
                                showMahasiswaModal.mahasiswa.length / 5
                              ),
                              p + 1
                            )
                          )
                        }
                        disabled={
                          pageMahasiswaModal ===
                          Math.ceil(showMahasiswaModal.mahasiswa.length / 5)
                        }
                        className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setShowMahasiswaModal(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
