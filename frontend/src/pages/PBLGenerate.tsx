import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { faChevronUp, faChevronDown } from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUsers,
  faBookOpen,
  faCog,
  faExclamationTriangle,
  faEye,
  faTimes,
  faSpinner,
  faCheckCircle,
  faRefresh,
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
  pbl_role?: string; // koordinator, tim_blok, dosen_mengajar
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
  const [warnings, setWarnings] = useState<string[]>([]);
  const [unassignedPBLList, setUnassignedPBLList] = useState<
    { mk: MataKuliah; pbl: PBL; reasons: string[] }[]
  >([]);

  // New state for statistics
  const [kelompokKecilCount, setKelompokKecilCount] = useState<number>(0);
  const [totalKelompokKecilAllSemester, setTotalKelompokKecilAllSemester] =
    useState<number>(0);
  const [keahlianCount, setKeahlianCount] = useState<number>(0);
  const [peranKoordinatorCount, setPeranKoordinatorCount] = useState<number>(0);
  const [peranTimBlokCount, setPeranTimBlokCount] = useState<number>(0);
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

  // Warning tidak auto-clear, harus manual ditambah dosen
  // useEffect(() => {
  //   if (warning) {
  //     const timer = setTimeout(() => {
  //       setWarning(null);
  //     }, 8000); // Warning lebih lama karena informatif
  //     return () => clearTimeout(timer);
  //   }
  // }, [warning]);

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

        // Process PBL data

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
          const assignedData = assignedRes.data || {};

          // PERBAIKAN: Filter out dosen koordinator/tim blok dari assignment
          const filteredAssignedData: AssignedDosen = {};
          Object.keys(assignedData).forEach((pblId) => {
            const assignedDosenList = assignedData[pblId] || [];
            const filteredDosenList = assignedDosenList.filter(
              (dosen: Dosen) => {
                // PERBAIKAN: Cek apakah dosen ini adalah koordinator/tim blok untuk SEMESTER INI
                if (dosen.dosen_peran) {
                  // Cari semester dari PBL ID
                  let currentSemester = "";
                  Object.keys(pblMap).forEach((mkKode) => {
                    const pbls = pblMap[mkKode] || [];
                    if (pbls.some((pbl) => pbl.id === parseInt(pblId))) {
                      // Ambil semester dari mata kuliah
                      const mataKuliah = blokMataKuliah.find(
                        (mk) => mk.kode === mkKode
                      );
                      if (mataKuliah) {
                        currentSemester = String(mataKuliah.semester);
                      }
                    }
                  });

                  if (currentSemester) {
                    // Cek apakah dosen ini adalah koordinator/tim blok untuk semester ini (APAPUN mata kuliahnya)
                    const isKoordinatorOrTimBlokForSemester =
                      dosen.dosen_peran.some(
                        (peran: any) =>
                          (peran.tipe_peran === "koordinator" ||
                            peran.tipe_peran === "tim_blok") &&
                          peran.semester === currentSemester
                      );

                    if (isKoordinatorOrTimBlokForSemester) {
                      const peranInfo = dosen.dosen_peran.find(
                        (p: any) =>
                          (p.tipe_peran === "koordinator" ||
                            p.tipe_peran === "tim_blok") &&
                          p.semester === currentSemester
                      );
                      return false;
                    }
                  }
                }
                return true;
              }
            );

            if (filteredDosenList.length > 0) {
              filteredAssignedData[pblId] = filteredDosenList;
            }
          });

          setAssignedDosen(filteredAssignedData);
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
      mataKuliahForKeahlian = filteredMataKuliah.filter(
        (mk: MataKuliah) => mk.blok === blokNumber
      );
    }

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
    const peranKoordinatorCount = dosenList.filter((dosen) => {
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

    const peranTimBlokCount = dosenList.filter((dosen) => {
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
    const dosenMengajarCount = Math.max(
      0,
      totalDosen - peranKoordinatorCount - peranTimBlokCount
    );

    setPeranKoordinatorCount(peranKoordinatorCount);
    setPeranTimBlokCount(peranTimBlokCount);
    setDosenMengajarCount(dosenMengajarCount);
  };

  // Filter mata kuliah by active semester
  const filteredMataKuliah = useMemo(() => {
    // Return empty array jika data belum ready
    if (blokMataKuliah.length === 0) {
      return [];
    }

    const result = activeSemesterJenis
      ? blokMataKuliah.filter(
          (mk: MataKuliah) =>
            mk.periode &&
            mk.periode.trim().toLowerCase() ===
              activeSemesterJenis.trim().toLowerCase() &&
            String(mk.semester) !== "Antara" // Exclude semester "Antara"
        )
      : blokMataKuliah.filter(
          (mk: MataKuliah) => String(mk.semester) !== "Antara" // Always exclude semester "Antara"
        );


    return result;
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
      dosenList.forEach((dosen) => {
        dosenAssignmentCount[dosen.id] = 0;
      });

      // Hitung assignment dari data yang sudah ada
      Object.values(assignedDosen).forEach((assignedDosenList) => {
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
      const dosenWithPriority = dosenList.map((dosen) => ({
        ...dosen,
        assignmentCount: dosenAssignmentCount[dosen.id] || 0,
      }));

      // Urutkan berdasarkan assignment count (ascending)
      dosenWithPriority.sort((a, b) => a.assignmentCount - b.assignmentCount);

      return dosenWithPriority;
    } catch (error) {
      return dosenList.map((dosen) => ({ ...dosen, assignmentCount: 0 }));
    }
  }, [dosenList, assignedDosen]);

  // PENTING: Filter dan urutkan dosen berdasarkan keahlian dan prioritas
  const getPrioritizedDosenList = useCallback(
    async (keahlianRequired: string[], excludeIds: Set<number> = new Set()) => {
      // 1. Dapatkan dosen dengan prioritas
      const dosenWithPriority = await calculateDosenPriority();

      // 2. Filter berdasarkan keahlian (HANYA ambil yang keahliannya sesuai)
      const dosenWithKeahlian = dosenWithPriority.filter((dosen) => {
        if (
          !dosen.keahlian ||
          !keahlianRequired ||
          keahlianRequired.length === 0
        )
          return true;

        const keahlianDosen = parseKeahlian(dosen.keahlian);
        return keahlianRequired.some((req) =>
          keahlianDosen.some((k) => k.toLowerCase().includes(req.toLowerCase()))
        );
      });

      // 3. Exclude dosen yang sudah di-assign
      const availableDosen = dosenWithKeahlian.filter(
        (dosen) => !excludeIds.has(dosen.id)
      );

      // 4. Urutkan berdasarkan prioritas (assignment count rendah = prioritas tinggi)
      availableDosen.sort((a, b) => {
        // Prioritas utama: assignment count rendah = prioritas tinggi
        if (a.assignmentCount !== b.assignmentCount) {
          return a.assignmentCount - b.assignmentCount;
        }

        // Jika assignment count sama, urutkan berdasarkan keahlian yang lebih cocok
        const aKeahlian = parseKeahlian(a.keahlian);
        const bKeahlian = parseKeahlian(b.keahlian);

        // Hitung match score untuk keahlian
        const aMatchScore = keahlianRequired.reduce((score, req) => {
          return (
            score +
            aKeahlian.filter((k) => k.toLowerCase().includes(req.toLowerCase()))
              .length
          );
        }, 0);

        const bMatchScore = keahlianRequired.reduce((score, req) => {
          return (
            score +
            bKeahlian.filter((k) => k.toLowerCase().includes(req.toLowerCase()))
              .length
          );
        }, 0);

        // Jika match score sama, random selection
        if (aMatchScore === bMatchScore) {
          return Math.random() - 0.5; // Random selection
        }

        return bMatchScore - aMatchScore; // Match score tinggi = prioritas tinggi
      });

      return availableDosen;
    },
    [calculateDosenPriority, parseKeahlian]
  );

  // Generate dosen assignments per blok & semester
  const handleGenerateDosen = async () => {
    // Validasi data
    if (dosenList.length === 0 || Object.keys(pblData).length === 0) {
      setError("Data belum dimuat. Silakan tunggu sebentar.");
      return;
    }

    if (filteredMataKuliah.length === 0) {
      setError(
        "Tidak ada mata kuliah yang tersedia untuk generate. Pastikan filter semester sudah benar."
      );
      return;
    }

    setIsGenerating(true);
    setError("");

    try {
      const assignments: any[] = [];

      // PERBAIKAN: Tracking dosen yang sudah di-assign per semester/blok
      const assignedDosenPerSemester: Set<number> = new Set();
      const assignedDosenPerBlok: Set<number> = new Set();

      // Loop untuk setiap semester
      const semesters = [1, 3, 5, 7]; // Semester Ganjil

      for (const semester of semesters) {
        // Cari mata kuliah untuk semester ini
        const mkInSemester = filteredMataKuliah.filter(
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

        // Debug: Cek apakah ada modul PBL
        if (allPBLs.length === 0) {
          continue;
        }

        // RUMUS: Kelompok × Modul = Total Dosen Required
        const totalModul = allPBLs.length;
        const totalKelompok = (() => {
          const semesterKey = String(semester);
          const semesterData = kelompokKecilData[semesterKey];
          if (semesterData && semesterData.details) {
            const uniqueKelompok = new Set(
              semesterData.details.map((item: any) => item.nama_kelompok)
            );
            return uniqueKelompok.size;
          }
          return 0;
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

        // HITUNG SISA UNTUK DOSEN MENGAJAR
        const koordinatorCount = koordinatorForSemester.length;
        const timBlokCount = timBlokForSemester.length;
        const dosenMengajarNeeded =
          totalDosenRequired - koordinatorCount - timBlokCount;

        // ASSIGN KOORDINATOR ke semua modul
        for (const koordinator of koordinatorForSemester) {
          for (const { pbl } of allPBLs) {
            if (pbl.id) {
              assignments.push({
                pbl_id: pbl.id,
                dosen_id: koordinator.id,
                role: "koordinator",
              });
            }
          }
        }

        // ASSIGN TIM BLOK ke semua modul
        for (const timBlok of timBlokForSemester) {
          for (const { pbl } of allPBLs) {
            if (pbl.id) {
              assignments.push({
                pbl_id: pbl.id,
                dosen_id: timBlok.id,
                role: "tim_blok",
              });
            }
          }
        }

        // FOKUS: Cari Dosen Mengajar (sesuai keahlian)
        // Cari dosen yang punya keahlian sesuai
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

          // PERBAIKAN BARU: Kecualikan dosen yang sudah di-assign sebagai Dosen Mengajar di semester/blok lain
          if (assignedDosenPerSemester.has(dosen.id)) {
            return false;
          }

          // PERBAIKAN BARU: Kecualikan dosen yang sudah di-assign sebagai Dosen Mengajar di blok yang sama
          const currentBlok = mkInSemester[0]?.blok; // Ambil blok dari mata kuliah pertama
          if (currentBlok && assignedDosenPerBlok.has(dosen.id)) {
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
              const match = keahlianArray.includes(keahlian);
              return match;
            });

            return hasMatch;
          });

          return hasMatchingKeahlian;
        });

        // Assign Dosen Mengajar sesuai sisa kebutuhan
        if (dosenMengajar.length > 0 && dosenMengajarNeeded > 0) {
          // Ambil dosen sesuai sisa kebutuhan (tidak boleh kelebihan)
          const dosenToAssign = dosenMengajar.slice(0, dosenMengajarNeeded);

          // Assign setiap dosen ke SEMUA modul dalam semester ini
          for (const dosen of dosenToAssign) {
            for (const { pbl } of allPBLs) {
              if (pbl.id) {
                assignments.push({
                  pbl_id: pbl.id,
                  dosen_id: dosen.id,
                  role: "dosen_mengajar",
                });
              }
            }

            // PERBAIKAN BARU: Tandai dosen ini sudah di-assign
            assignedDosenPerSemester.add(dosen.id);
            const currentBlok = mkInSemester[0]?.blok;
            if (currentBlok) {
              assignedDosenPerBlok.add(dosen.id);
            }
          }

          // Cek kekurangan dosen dan simpan warning
          if (dosenMengajar.length < dosenMengajarNeeded) {
            const kekurangan = dosenMengajarNeeded - dosenMengajar.length;
            const keahlianRequired = mkInSemester
              .map((mk) => mk.keahlian_required)
              .flat()
              .filter(Boolean);

            // Simpan warning untuk ditampilkan di UI
            const warningMessage = `Semester ${semester} kekurangan ${kekurangan} dosen mengajar dengan keahlian: ${keahlianRequired.join(
              ", "
            )} (dibutuhkan ${dosenMengajarNeeded} dosen mengajar dari ${totalDosenRequired} total dosen)`;

            setWarnings((prev) => {
              // Hapus warning lama untuk semester ini jika ada
              const filtered = prev.filter(
                (w) => !w.includes(`Semester ${semester}`)
              );
              // Tambahkan warning baru
              return [...filtered, warningMessage];
            });
          }
        } else {
          // Warning jika masih dibutuhkan dosen mengajar tapi tidak ada
          if (dosenMengajarNeeded > 0) {
            const keahlianRequired = mkInSemester
              .map((mk) => mk.keahlian_required)
              .flat()
              .filter(Boolean);

            const warningMessage = `Semester ${semester} tidak memiliki dosen mengajar dengan keahlian: ${keahlianRequired.join(
              ", "
            )} (dibutuhkan ${dosenMengajarNeeded} dosen mengajar dari ${totalDosenRequired} total dosen)`;

            setWarnings((prev) => {
              // Hapus warning lama untuk semester ini jika ada
              const filtered = prev.filter(
                (w) => !w.includes(`Semester ${semester}`)
              );
              // Tambahkan warning baru
              return [...filtered, warningMessage];
            });
          }
        }
      }

      // Kirim ke backend
      if (assignments.length > 0) {
        const response = await api.post("/pbl-generate/assignments", {
          assignments: assignments,
        });

        if (response.data.success) {
          const summary = response.data.summary;
          setSuccess(
            `Berhasil generate ${summary.success} assignments!${
              summary.error > 0 ? ` (${summary.error} gagal)` : ""
            }`
          );

          // Refresh data
          const assignedDosenRes = await api.post(
            "/pbl-generate/get-assignments",
            {
              pbl_ids: assignments.map((a) => a.pbl_id),
            }
          );

          if (assignedDosenRes.data.success) {
            // Backend mengembalikan data dalam format: { pbl_id: [assignments] }
            const assignmentsData = assignedDosenRes.data.data;

            // Convert ke format yang diharapkan frontend
            const convertedData = {};
            Object.keys(assignmentsData).forEach((pblId) => {
              const assignments = assignmentsData[pblId];
              convertedData[parseInt(pblId)] = assignments.map(
                (assignment) => ({
                  id: assignment.dosen.id,
                  name: assignment.dosen.name,
                  pbl_role: assignment.role,
                  pbl_assignment_count: assignment.pbl_assignment_count || 0,
                  keahlian: assignment.dosen.keahlian || [],
                })
              );
            });

            setAssignedDosen(convertedData);
          }
        } else {
          setError(response.data.message || "Gagal generate dosen");
        }
      } else {
        setError("Tidak ada assignments yang dibuat");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Gagal generate dosen");
    } finally {
      setIsGenerating(false);
      
      // Simpan status generate ke localStorage
      if (blokId) {
        localStorage.setItem(`pbl_generated_${blokId}`, 'true');
        console.log(`✅ Saved generate status for blok ${blokId} to localStorage`);
      }
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
        const resetRes = await api.post("/pbl-generate/reset", {
          pbl_ids: pblIds,
        });
        if (resetRes.data.success) {
          setSuccess(resetRes.data.message);
        } else {
          setError(resetRes.data.message);
        }
      } else {
        setSuccess("Berhasil reset assignment dosen");
      }

      // Refresh assigned dosen data
      if (pblIds.length > 0) {
        const assignedDosenRes = await api.post(
          "/pbl-generate/get-assignments",
          {
            pbl_ids: pblIds,
          }
        );
        if (assignedDosenRes.data.success) {
          setAssignedDosen(assignedDosenRes.data.data);
        }
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Gagal reset assignment dosen");
    } finally {
      setResetLoading(false);
      
      // Hapus status generate dari localStorage
      if (blokId) {
        localStorage.removeItem(`pbl_generated_${blokId}`);
        console.log(`🗑️ Removed generate status for blok ${blokId} from localStorage`);
      }
    }
  };

  if (loading) {
    return (
      <div className="w-full mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          {/* Back Button Skeleton */}
          <div className="flex items-center gap-2 mb-4">
            <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          
          {/* Title Skeleton */}
          <div className="h-8 w-80 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
          <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
          
          {/* Info Box Skeleton */}
          <div className="p-4 bg-gray-100 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
              <div className="flex-1">
                <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                <div className="h-3 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
              </div>
            </div>
          </div>
        </div>

        {/* Statistics Cards Skeleton - Hidden for now */}
        {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                <div className="flex-1">
                  <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                </div>
              </div>
            </div>
          ))}
        </div> */}

        {/* Generate Dosen Section Skeleton */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-8">
          <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
          <div className="h-4 w-80 bg-gray-200 dark:bg-gray-700 rounded mb-6 animate-pulse" />
          <div className="flex flex-wrap gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
            ))}
          </div>
        </div>

        {/* Modul PBL Section Skeleton */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="h-6 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-6 animate-pulse" />
          
          {/* Semester Cards Skeleton */}
          <div className="space-y-8">
            {[1, 2, 3].map((semester) => (
              <div key={semester}>
                {/* Semester Header Skeleton */}
                <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                    <div className="flex-1">
                      <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse" />
                      <div className="flex gap-4">
                        <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                </div>

                {/* PBL Cards Skeleton */}
                <div className="grid gap-4">
                  {[1, 2].map((mk) => (
                    <div key={mk} className="p-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800/50">
                      <div className="flex items-center justify-between mb-3">
                        <div className="h-5 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                      <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse" />
                      
                      {/* PBL Modul Skeleton */}
                      <div className="space-y-3">
                        {[1, 2].map((pbl) => (
                          <div key={pbl} className="p-3 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800/50">
                            <div className="flex items-center justify-between mb-2">
                              <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                              <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
                            </div>
                            <div className="h-3 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
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
          Generate Penugasan Dosen PBL
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Sistem generate otomatis untuk assignment dosen berdasarkan peran kurikulum
        </p>
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                Sistem Generate Otomatis
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Generate penugasan dosen secara otomatis berdasarkan peran kurikulum (Koordinator, Tim Blok, Dosen Mengajar) 
                dengan mempertimbangkan keahlian dan distribusi yang adil.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Statistics Cards - Hidden for now */}
      {/* <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                {Object.values(pblData).flat().length}
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
                {Object.values(kelompokKecilData).reduce(
                  (total, data) => total + (data.details?.length || 0),
                  0
                )}
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
                {
                  Array.from(
                    new Set(
                      filteredMataKuliah.flatMap(
                        (mk) => mk.keahlian_required || []
                      )
                    )
                  ).length
                }
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
                {peranKoordinatorCount}
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
                {peranTimBlokCount}
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
      </div> */}

      {/* Success/Error Messages */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-500 dark:border-green-700 rounded-lg flex items-center gap-3">
          <FontAwesomeIcon
            icon={faCheckCircle}
            className="w-6 h-6 text-green-500"
          />
          <span className="text-green-700 dark:text-green-300">{success}</span>
        </div>
      )}

      {error && (
        <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-500 dark:border-red-700 rounded-lg flex items-center gap-3">
          <FontAwesomeIcon
            icon={faExclamationTriangle}
            className="w-6 h-6 text-red-500"
          />
          <span className="text-red-700 dark:text-red-300">{error}</span>
        </div>
      )}

      {warnings.length > 0 && (
        <div className="mb-6 space-y-3">
          {warnings.map((warning, index) => (
            <div
              key={index}
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

      {/* Generate Dosen Section */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
          Generate Dosen
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Klik tombol di bawah untuk menggenerate penugasan dosen secara otomatis
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={() => {
              handleGenerateDosen();
            }}
            disabled={isGenerating}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all duration-200 ${
              isGenerating
                ? "bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed"
                : "bg-green-600 hover:bg-green-700 text-white shadow-theme-xs hover:shadow-theme-sm"
            }`}
          >
            <FontAwesomeIcon
              icon={isGenerating ? faSpinner : faCog}
              className={`w-4 h-4 ${isGenerating ? "animate-spin" : ""}`}
            />
            {isGenerating ? "Generating..." : "Generate Dosen"}
          </button>

          <button
            onClick={async () => {
              setLoading(true);
              try {
                // Refresh data dosen
                const dosenRes = await api.get("/users?role=dosen");

                // Cek dosen rizqiirkhamm setelah refresh
                const dosenRizqi = dosenRes.data?.filter(
                  (dosen) =>
                    dosen.name &&
                    dosen.name.toLowerCase().includes("rizqiirkhamm")
                );

                setDosenList(dosenRes.data || []);
                setSuccess("Data dosen berhasil di-refresh!");
              } catch (error) {
                setError("Gagal refresh data dosen");
              } finally {
                setLoading(false);
              }
            }}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 shadow-theme-xs hover:shadow-theme-sm transition-all duration-200"
          >
            <FontAwesomeIcon icon={faRefresh} className="w-4 h-4" />
            Refresh Data Dosen
          </button>
          <button
            onClick={handleResetDosen}
            disabled={resetLoading}
            className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center gap-2 transition-all duration-200 ${
              resetLoading
                ? "bg-gray-400 dark:bg-gray-600 text-gray-200 cursor-not-allowed"
                : "bg-red-600 hover:bg-red-700 text-white shadow-theme-xs hover:shadow-theme-sm"
            }`}
          >
            <FontAwesomeIcon
              icon={resetLoading ? faSpinner : faCog}
              className={`w-4 h-4 ${resetLoading ? "animate-spin" : ""}`}
            />
            {resetLoading ? "Resetting..." : "Reset Dosen"}
          </button>
        </div>
      </div>

      {/* Modul PBL per Semester */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
          Modul PBL per Semester ({filteredMataKuliah.length} mata kuliah)
        </h2>

        {Object.entries(groupedBySemester).map(([semester, mataKuliahList]) => {
          // Cek apakah semester ini kekurangan dosen
          const semesterNumber = parseInt(semester);
          const semesterKey = String(semesterNumber);
          const semesterData = kelompokKecilData[semesterKey];

          let totalKelompok = 0;
          let totalModul = 0;
          let totalDosenRequired = 0;
          let keahlianRequired: string[] = [];

          if (semesterData && semesterData.details) {
            const uniqueKelompok = new Set(
              semesterData.details.map((item: any) => item.nama_kelompok)
            );
            totalKelompok = uniqueKelompok.size;
          }

          // Hitung total modul untuk semester ini
          totalModul = mataKuliahList.reduce(
            (acc, mk) => acc + (pblData[mk.kode] || []).length,
            0
          );
          totalDosenRequired = totalKelompok * totalModul;

          // Hitung keahlian yang dibutuhkan
          keahlianRequired = mataKuliahList
            .map((mk) => mk.keahlian_required)
            .flat()
            .filter(Boolean);

          // Cek dosen yang tersedia dengan keahlian yang sesuai
          const dosenMengajar = dosenList.filter((dosen) => {
            // PERBAIKAN: Kecualikan dosen yang sudah menjadi Koordinator atau Tim Blok
            const isKoordinatorOrTimBlok = dosen.dosen_peran?.some(
              (peran: any) =>
                (peran.tipe_peran === "koordinator" ||
                  peran.tipe_peran === "tim_blok") &&
                peran.semester === String(semesterNumber) &&
                mataKuliahList.some(
                  (mk: any) => mk.kode === peran.mata_kuliah_kode
                )
            );

            if (isKoordinatorOrTimBlok) {
              return false;
            }

            // PERBAIKAN BARU: Cek apakah dosen ini sudah di-assign sebagai Dosen Mengajar di semester/blok lain
            // Cek dari assignedDosen yang sudah ada
            let isAlreadyAssignedElsewhere = false;

            // Loop melalui semua PBL yang sudah di-assign
            Object.entries(assignedDosen).forEach(([pblId, assignedList]) => {
              assignedList.forEach((assignedDosen) => {
                if (
                  assignedDosen.id === dosen.id &&
                  assignedDosen.pbl_role === "dosen_mengajar"
                ) {
                  // Cari mata kuliah dari PBL ID ini
                  const pblMataKuliah = Object.keys(pblData).find((mkKode) =>
                    pblData[mkKode]?.some(
                      (pbl: any) => pbl.id === parseInt(pblId)
                    )
                  );

                  if (pblMataKuliah) {
                    const mk = blokMataKuliah.find(
                      (mk: any) => mk.kode === pblMataKuliah
                    );
                    if (mk && mk.semester !== semesterNumber) {
                      isAlreadyAssignedElsewhere = true;
                    }
                  }
                }
              });
            });

            if (isAlreadyAssignedElsewhere) {
              return false;
            }

            const dosenKeahlian = Array.isArray(dosen.keahlian)
              ? dosen.keahlian
              : (dosen.keahlian || "").split(",").map((k) => k.trim());

            return keahlianRequired.some((req) =>
              dosenKeahlian.some((dosenKeahlian) => {
                const reqLower = req.toLowerCase();
                const dosenKeahlianLower = dosenKeahlian.toLowerCase();
                const isMatch =
                  dosenKeahlianLower.includes(reqLower) ||
                  reqLower.includes(dosenKeahlianLower) ||
                  reqLower
                    .split(" ")
                    .some((word) => dosenKeahlianLower.includes(word)) ||
                  dosenKeahlianLower
                    .split(" ")
                    .some((word) => reqLower.includes(word));

                return isMatch;
              })
            );
          });

          // Hitung kekurangan dosen dengan mempertimbangkan Koordinator dan Tim Blok
          const koordinatorForSemester = dosenList.filter((dosen) => {
            return dosen.dosen_peran?.some(
              (peran: any) =>
                peran.tipe_peran === "koordinator" &&
                peran.semester === String(semesterNumber) &&
                mataKuliahList.some(
                  (mk: any) => mk.kode === peran.mata_kuliah_kode
                )
            );
          });

          const timBlokForSemester = dosenList.filter((dosen) => {
            return dosen.dosen_peran?.some(
              (peran: any) =>
                peran.tipe_peran === "tim_blok" &&
                peran.semester === String(semesterNumber) &&
                mataKuliahList.some(
                  (mk: any) => mk.kode === peran.mata_kuliah_kode
                )
            );
          });

          const koordinatorCount = koordinatorForSemester.length;
          const timBlokCount = timBlokForSemester.length;
          const totalDosenYangAda =
            koordinatorCount + timBlokCount + dosenMengajar.length;

          return (
            <div key={semester} className="mb-8">
              {/* Semester Header Card */}
              <div className="bg-gray-50 dark:bg-gray-800/30 rounded-xl p-6 border border-gray-200 dark:border-gray-700 mb-6">
                <div className="flex flex-wrap items-center gap-3 mb-4">
                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                    <span className="text-blue-600 dark:text-blue-400 font-bold text-sm">
                      {semester}
                    </span>
                  </div>
                  <div className="flex flex-col">
                    <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
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
                            mataKuliahList.forEach((mk) => {
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
                          {totalKelompok} kelompok
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* PBL Cards Grid */}
              <div className="grid gap-4">
                {mataKuliahList.map((mk) => (
                  <div
                    key={mk.kode}
                    className="p-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800/50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-semibold text-gray-800 dark:text-white">
                        {mk.kode} - {mk.nama}
                      </h4>
                      <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                        <FontAwesomeIcon
                          icon={faBookOpen}
                          className="w-3 h-3"
                        />
                        <span>{(pblData[mk.kode] || []).length} modul</span>
                      </div>
                    </div>
                    
                    <div className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                      <p>
                        Keahlian:{" "}
                        {Array.isArray(mk.keahlian_required)
                          ? mk.keahlian_required.join(", ")
                          : mk.keahlian_required || "Tidak ada"}
                      </p>
                  </div>

                  {/* Tampilkan dosen yang sudah di-assign untuk setiap modul PBL */}
                  {(pblData[mk.kode] || []).map((pbl, pblIdx) => {
                    const assigned = pbl.id ? assignedDosen[pbl.id] || [] : [];

                    return (
                      <div
                        key={pbl.id || pblIdx}
                          className="p-3 sm:p-5 rounded-xl border border-gray-200 dark:border-white/10 bg-white dark:bg-gray-800/50 hover:shadow-md transition-all duration-300"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="text-sm font-medium text-gray-800 dark:text-white">
                            Modul {pbl.modul_ke} - {pbl.nama_modul}
                          </h5>
                          <span
                              className={`text-xs px-3 py-1 rounded-full font-medium ${
                              assigned.length > 0
                                ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                : "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"
                            }`}
                          >
                            {assigned.length > 0
                              ? "Sudah Ditugaskan"
                              : "Belum Ditugaskan"}
                          </span>
                        </div>

                        {/* Tampilkan dosen yang sudah di-assign */}
                        {assigned.length > 0 ? (
                            <div className="mt-3">
                            <div className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
                              Dosen yang Ditugaskan:
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {assigned.map((dosen) => {
                                // PERBAIKAN: Tentukan peran berdasarkan dosen_peran atau pbl_role
                                let pblRole = dosen.pbl_role;

                                // Jika pbl_role tidak ada, cek dosen_peran untuk menentukan peran
                                if (!pblRole && dosen.dosen_peran) {
                                  const currentSemester = parseInt(semester);
                                  const currentMataKuliah = mataKuliahList.map(
                                    (mk) => mk.kode
                                  );

                                  const koordinatorPeran =
                                    dosen.dosen_peran.find(
                                      (peran: any) =>
                                        peran.tipe_peran === "koordinator" &&
                                        peran.semester ===
                                          String(currentSemester) &&
                                        currentMataKuliah.includes(
                                          peran.mata_kuliah_kode
                                        )
                                    );

                                  const timBlokPeran = dosen.dosen_peran.find(
                                    (peran: any) =>
                                      peran.tipe_peran === "tim_blok" &&
                                      peran.semester ===
                                        String(currentSemester) &&
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
                                let borderColor = "border-green-200";
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
                                  bgColor = "bg-blue-100 dark:bg-blue-900/40";
                                } else if (pblRole === "tim_blok") {
                                  dosenRole = "Tim Blok";
                                  avatarColor = "bg-purple-500";
                                  borderColor = "border-purple-200";
                                  textColor =
                                    "text-purple-700 dark:text-purple-200";
                                  bgColor =
                                    "bg-purple-100 dark:bg-purple-900/40";
                                }

                                // Cek apakah dosen standby
                                const isStandby = Array.isArray(dosen.keahlian)
                                  ? dosen.keahlian.some((k) =>
                                      k.toLowerCase().includes("standby")
                                    )
                                  : (dosen.keahlian || "")
                                      .toLowerCase()
                                      .includes("standby");

                                // Jika standby, override warna
                                if (isStandby) {
                                  avatarColor = "bg-yellow-400";
                                  borderColor = "border-yellow-200";
                                  textColor =
                                    "text-yellow-800 dark:text-yellow-200";
                                  bgColor =
                                    "bg-yellow-100 dark:bg-yellow-900/40";
                                }

                                return (
                                  <div
                                    key={dosen.id}
                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-full ${bgColor} ${borderColor}`}
                                  >
                                    <div
                                      className={`w-6 h-6 rounded-full flex items-center justify-center relative ${avatarColor}`}
                                    >
                                      <span className="text-white text-xs font-bold">
                                        {dosen.name?.charAt(0) || "?"}
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
                                      {dosen.name || "Dosen Tidak Diketahui"}
                                      <span className="ml-1 text-[10px] opacity-75">
                                        ({dosenRole})
                                      </span>
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : (
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            Belum ada dosen yang ditugaskan
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
