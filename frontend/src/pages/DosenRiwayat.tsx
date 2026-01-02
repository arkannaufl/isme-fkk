import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faCalendarAlt,
  faUser,
  faEnvelope,
  faPhone,
  faIdCard,
  faClock,
  faUsers,
  faChartBar,
  faDownload,
  faCheckCircle,
  faTimesCircle,
} from "@fortawesome/free-solid-svg-icons";
import { motion } from "framer-motion";
import api from "../utils/api";
import jsPDF from "jspdf";
import { addWatermarkToAllPages } from "../utils/watermarkHelper";

type UserDosen = {
  id?: number;
  nid: string;
  nidn: string;
  name: string;
  username: string;
  email: string;
  telp: string;
  password?: string;
  role?: string;
  kompetensi?: string[] | string;
  peran_kurikulum?: string[] | string;
  keahlian?: string[] | string;
  peran_utama?: "koordinator" | "tim_blok" | "dosen_mengajar";
  matkul_ketua_nama?: string;
  matkul_ketua_semester?: number;
  matkul_anggota_nama?: string;
  matkul_anggota_semester?: number;
  peran_kurikulum_mengajar?: string;
  dosen_peran?: {
    mata_kuliah_kode: string;
    blok: string;
    semester: string;
    peran_kurikulum: string;
    tipe_peran: "koordinator" | "tim_blok" | "mengajar";
    mata_kuliah_nama?: string;
  }[];
};

type JadwalMengajar = {
  id: number;
  mata_kuliah_kode: string;
  mata_kuliah_nama: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  jenis_jadwal:
    | "kuliah_besar"
    | "agenda_khusus"
    | "praktikum"
    | "jurnal_reading"
    | "pbl"
    | "csr"
    | "materi"
    | "agenda"
    | "non_blok_non_csr"
    | "seminar_pleno"
    | "persamaan_persepsi";
  topik?: string;
  materi?: string;
  agenda?: string;
  ruangan_nama: string;
  kelompok_kecil?: string;
  kelompok_besar_id?: number | null;
  kelompok_besar?: {
    id?: number;
    semester?: number;
    nama_kelompok?: string;
  } | null;
  modul_pbl?: string;
  pbl_tipe?: string;
  kategori_csr?: string;
  jenis_csr?: string;
  nomor_csr?: string;
  jumlah_sesi: number;
  semester: string;
  blok?: string;
  semester_type?: "reguler" | "antara";
  // Konfirmasi & Reschedule
  status_konfirmasi?:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  alasan_konfirmasi?: string | null;
  status_reschedule?: "waiting" | "approved" | "rejected" | null;
  reschedule_reason?: string | null;
  // Additional fields for penilaian
  penilaian_submitted?: boolean | number; // Bisa boolean atau integer (0/1) dari backend
  // Peran untuk Persamaan Persepsi dan Seminar Pleno
  peran?: "koordinator" | "pengampu";
  peran_display?: string;
  // Additional fields for persamaan persepsi
  dosen_ids?: number[];
  koordinator_ids?: number[];
  absensi_hadir?: boolean | number; // Untuk dosen pengampu: apakah dosen hadir (bisa boolean atau integer 0/1)
  absensi_catatan?: string | null; // Catatan absensi dosen
  role_type?: "koordinator" | "pengampu"; // Role dosen: koordinator atau pengampu
  absensi_status?: "menunggu" | "hadir" | "tidak_hadir"; // Status absensi: menunggu, hadir, atau tidak hadir
};

export default function DosenRiwayat() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [dosenData, setDosenData] = useState<UserDosen | null>(null);
  const [jadwalMengajar, setJadwalMengajar] = useState<JadwalMengajar[]>([]);
  const [mataKuliahData, setMataKuliahData] = useState<
    Record<string, { blok: number | null; nama: string }>
  >({});
  const [pblData, setPblData] = useState<
    Record<
      string,
      {
        mata_kuliah: {
          kode: string;
          blok: number;
          semester: string;
          nama: string;
        };
        pbls: { id: string; nama: string }[];
      }
    >
  >({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterSemester, setFilterSemester] = useState<string>("");
  const [filterJenis, setFilterJenis] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Ambil data dosen dari state, localStorage, atau fetch dari API
        let dosenDataToUse = null;

        if (location.state?.dosenData) {
          dosenDataToUse = location.state.dosenData;
        } else if (id) {
          // Fetch data dosen dari API jika tidak ada di state
          const response = await api.get(`/users/${id}`);
          dosenDataToUse = response.data;
        } else {
          // Jika tidak ada id dan state, ambil dari localStorage (untuk dosen yang melihat riwayat sendiri)
          const userData = JSON.parse(localStorage.getItem("user") || "{}");
          if (userData.role === "dosen") {
            dosenDataToUse = userData;
          }
        }

        setDosenData(dosenDataToUse);

        // Tentukan ID dosen yang akan di-fetch jadwalnya
        let dosenId = id;
        if (dosenDataToUse) {
          dosenId = dosenDataToUse.id;
        }

        // Fetch jadwal mengajar dosen untuk semua semester (tanpa filter)
        if (dosenId) {
          try {
            // Fetch semua jadwal dengan semester_type=all untuk mendapatkan semua jadwal
            const jadwalAllResponse = await api.get(
              `/users/${dosenId}/jadwal-mengajar?semester_type=all`
            );
            const jadwalAll = jadwalAllResponse.data || [];

            // Tambahkan informasi semester type berdasarkan data
            const allJadwal = jadwalAll.map((jadwal: JadwalMengajar) => ({
              ...jadwal,
              semester_type: jadwal.semester_type || "reguler", // Default ke reguler jika tidak ada
            }));

            setJadwalMengajar(allJadwal);

            // Fetch data mata kuliah untuk mendapatkan informasi blok
            const uniqueMataKuliahKodes = [
              ...new Set(allJadwal.map((j) => j.mata_kuliah_kode)),
            ];

            const mataKuliahPromises = uniqueMataKuliahKodes.map(
              async (kode) => {
                try {
                  const response = await api.get(`/mata-kuliah/${kode}`);
                  return { kode, data: response.data };
                } catch (error) {
                  console.error(`Error fetching mata kuliah ${kode}:`, error);
                  return { kode, data: null };
                }
              }
            );

            const mataKuliahResults = await Promise.all(mataKuliahPromises);
            const mataKuliahMap: Record<
              string,
              { blok: number | null; nama: string }
            > = {};

            mataKuliahResults.forEach(({ kode, data }) => {
              if (data && kode && typeof kode === "string") {
                mataKuliahMap[kode] = {
                  blok: data.blok,
                  nama: data.nama,
                };
              }
            });

            setMataKuliahData(mataKuliahMap);

            // Fetch PBL data untuk perencanaan
            try {
              const pblResponse = await api.get("/pbls/all");
              setPblData(pblResponse.data || {});
            } catch (pblError) {
              console.error("Error fetching PBL data:", pblError);
              setPblData({});
            }
          } catch (jadwalError) {
            console.error("Error fetching jadwal mengajar:", jadwalError);
            setJadwalMengajar([]);
          }
        }
      } catch (err) {
        setError("Gagal memuat data jadwal mengajar");
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, location.state]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  // Fungsi untuk mengkonversi jam desimal ke format jam:menit
  const formatJamMenit = (jamDesimal: number): string => {
    const jam = Math.floor(jamDesimal);
    const menit = Math.round((jamDesimal - jam) * 60);

    if (jam === 0) {
      return `${menit} menit`;
    } else if (menit === 0) {
      return `${jam} jam`;
    } else {
      return `${jam} jam ${menit} menit`;
    }
  };

  // Fungsi untuk mendapatkan blok dari mata kuliah berdasarkan kode
  const getBlokFromMataKuliah = (mataKuliahKode: string): string | null => {
    const mataKuliah = mataKuliahData[mataKuliahKode];
    if (
      mataKuliah &&
      mataKuliah.blok !== null &&
      mataKuliah.blok !== undefined
    ) {
      return mataKuliah.blok.toString();
    }
    return null;
  };

  // Function to calculate PBL sesi per blok
  const getPblSesiPerBlok = (blokNumber: number): number => {
    let totalSesi = 0;

    // 1. Ambil jadwal mengajar dosen yang jenis_jadwal = "pbl" untuk blok tertentu
    // Catatan: Perencanaan tidak boleh bergantung pada submit, jadi gunakan SEMUA jadwal PBL
    const jadwalPbl = jadwalMengajar.filter((j) => j.jenis_jadwal === "pbl");

    // 2. Filter jadwal berdasarkan blok yang diminta
    const jadwalBlok = jadwalPbl.filter((jadwal) => {
      const mataKuliah = mataKuliahData[jadwal.mata_kuliah_kode];
      return mataKuliah && mataKuliah.blok === blokNumber;
    });

    // 3. Ambil semester yang diajarkan dosen di blok tersebut
    const dosenSemesterDiBlok: string[] = [];
    jadwalBlok.forEach((jadwal) => {
      // Coba ambil semester dari semester atau semester_type
      let semesterValue = jadwal.semester || jadwal.semester_type;

      // Mapping semester_type ke semester yang sesuai
      if (jadwal.semester_type === "reguler" && !jadwal.semester) {
        // Untuk reguler, ambil semester dari jadwal lain yang ada semester
        const jadwalDenganSemester = jadwalMengajar.find(
          (j) => j.mata_kuliah_kode === jadwal.mata_kuliah_kode && j.semester
        );
        if (jadwalDenganSemester) {
          semesterValue = jadwalDenganSemester.semester;
        } else {
          // Jika tidak ada jadwal dengan semester, coba ambil dari mataKuliahData
          const mataKuliah = mataKuliahData[jadwal.mata_kuliah_kode];
          if (mataKuliah) {
            // Ambil semester dari PBL data berdasarkan blok
            const pblItem = Object.values(pblData).find(
              (item) =>
                item.mata_kuliah?.kode === jadwal.mata_kuliah_kode &&
                item.mata_kuliah?.blok === mataKuliah.blok
            );
            if (pblItem && pblItem.mata_kuliah?.semester) {
              semesterValue = pblItem.mata_kuliah.semester;
            }
          }
        }
      }

      if (semesterValue && !dosenSemesterDiBlok.includes(semesterValue)) {
        dosenSemesterDiBlok.push(semesterValue);
      }
    });

    // 4. Ambil data PBL dari pblData untuk blok yang diminta
    Object.values(pblData).forEach((item) => {
      if (item.mata_kuliah && item.mata_kuliah.blok === blokNumber) {
        const mataKuliahSemester = item.mata_kuliah.semester;

        // 5. Validasi: hanya hitung jika semester mata kuliah sama dengan semester yang diajarkan dosen
        if (dosenSemesterDiBlok.includes(mataKuliahSemester) && item.pbls) {
          const modulCount = item.pbls.length;
          const sesiPerItem = modulCount * 5;
          totalSesi += sesiPerItem;
        }
      }
    });

    return totalSesi;
  };

  // Function to calculate Jurnal Reading perencanaan per blok
  const getJurnalReadingPerencanaanPerBlok = (blokNumber: number): number => {
    // Filter jadwal jurnal reading untuk blok tertentu
    const jurnalJadwalBlok = filteredJadwal.filter((j) => {
      const blokMataKuliah = getBlokFromMataKuliah(j.mata_kuliah_kode);
      return (
        j.jenis_jadwal === "jurnal_reading" &&
        blokMataKuliah === blokNumber.toString()
      );
    });

    // Hitung jumlah file jurnal (setiap jadwal = 1 file jurnal)
    const jumlahFileJurnal = jurnalJadwalBlok.length;

    // Perencanaan = jumlah file jurnal × 2
    const perencanaan = jumlahFileJurnal * 2;

    return perencanaan;
  };

  // Function to calculate total Jurnal Reading perencanaan for all blocks
  const getTotalJurnalReadingPerencanaan = (): number => {
    // Filter jadwal jurnal reading untuk semua blok
    const jurnalJadwal = filteredJadwal.filter(
      (j) => j.jenis_jadwal === "jurnal_reading"
    );

    // Hitung jumlah file jurnal (setiap jadwal = 1 file jurnal)
    const jumlahFileJurnal = jurnalJadwal.length;

    // Perencanaan = jumlah file jurnal × 2
    const perencanaan = jumlahFileJurnal * 2;

    return perencanaan;
  };

  // Function to calculate CSR perencanaan per blok
  const getCSRPerencanaanPerBlok = (blokNumber: number): number => {
    // CSR perencanaan hanya untuk dosen yang ditugaskan untuk CSR
    if (!dosenData?.keahlian) return 0;

    // Cek apakah dosen ditugaskan untuk CSR di blok ini
    const csrMappings = jadwalMengajar.filter(
      (j) =>
        j.jenis_jadwal === "csr" &&
        j.nomor_csr &&
        j.nomor_csr.startsWith(`${blokNumber}.`)
    );

    // Jika tidak ada assignment CSR untuk blok ini, return 0
    if (csrMappings.length === 0) return 0;

    // Hitung jumlah keahlian dosen yang ditugaskan untuk CSR
    const jumlahKeahlian = Array.isArray(dosenData.keahlian)
      ? dosenData.keahlian.length
      : 1; // Jika bukan array, anggap 1 keahlian

    // Perencanaan = jumlah keahlian × 5
    const perencanaan = jumlahKeahlian * 5;

    return perencanaan;
  };

  // Function to calculate total CSR perencanaan for all blocks
  const getTotalCSRPerencanaan = (): number => {
    // CSR perencanaan hanya untuk dosen yang ditugaskan untuk CSR
    if (!dosenData?.keahlian) return 0;

    // Cek apakah dosen ditugaskan untuk CSR di semua blok
    const csrMappings = jadwalMengajar.filter(
      (j) => j.jenis_jadwal === "csr" && j.nomor_csr
    );

    // Jika tidak ada assignment CSR sama sekali, return 0
    if (csrMappings.length === 0) return 0;

    // Hitung jumlah keahlian dosen yang ditugaskan untuk CSR
    const jumlahKeahlian = Array.isArray(dosenData.keahlian)
      ? dosenData.keahlian.length
      : 1; // Jika bukan array, anggap 1 keahlian

    // Perencanaan = jumlah keahlian × 5
    const perencanaan = jumlahKeahlian * 5;

    return perencanaan;
  };

  // Function to calculate Persamaan Persepsi perencanaan per blok
  const getPersamaanPersepsiPerencanaanPerBlok = (
    blokNumber: number
  ): number => {
    // Filter jadwal persamaan persepsi untuk blok tertentu
    const persepsiJadwalBlok = jadwalMengajar.filter((j) => {
      const blokMataKuliah = getBlokFromMataKuliah(j.mata_kuliah_kode);
      return (
        j.jenis_jadwal === "persamaan_persepsi" &&
        blokMataKuliah === blokNumber.toString()
      );
    });

    // Perencanaan = jumlah sesi dari jadwal (1 sesi = 1 perencanaan, 2 sesi = 2 perencanaan)
    const perencanaan = persepsiJadwalBlok.reduce((total, jadwal) => {
      return total + (jadwal.jumlah_sesi || 0);
    }, 0);

    return perencanaan;
  };

  // Function to calculate total Persamaan Persepsi perencanaan for all blocks
  const getTotalPersamaanPersepsiPerencanaan = (): number => {
    // Filter jadwal persamaan persepsi untuk semua blok
    const persepsiJadwal = jadwalMengajar.filter(
      (j) => j.jenis_jadwal === "persamaan_persepsi"
    );

    // Perencanaan = jumlah sesi dari jadwal (1 sesi = 1 perencanaan, 2 sesi = 2 perencanaan)
    const perencanaan = persepsiJadwal.reduce((total, jadwal) => {
      return total + (jadwal.jumlah_sesi || 0);
    }, 0);

    return perencanaan;
  };

  // Function to calculate Seminar Pleno perencanaan per blok
  const getSeminarPlenoPerencanaanPerBlok = (blokNumber: number): number => {
    // Filter jadwal seminar pleno untuk blok tertentu
    const seminarPlenoJadwalBlok = jadwalMengajar.filter((j) => {
      const blokMataKuliah = getBlokFromMataKuliah(j.mata_kuliah_kode);
      return (
        j.jenis_jadwal === "seminar_pleno" &&
        blokMataKuliah === blokNumber.toString()
      );
    });

    // Perencanaan = jumlah sesi dari jadwal (1 sesi = 1 perencanaan, 2 sesi = 2 perencanaan)
    const perencanaan = seminarPlenoJadwalBlok.reduce((total, jadwal) => {
      return total + (jadwal.jumlah_sesi || 0);
    }, 0);

    return perencanaan;
  };

  // Function to calculate total Seminar Pleno perencanaan for all blocks
  const getTotalSeminarPlenoPerencanaan = (): number => {
    // Filter jadwal seminar pleno untuk semua blok
    const seminarPlenoJadwal = jadwalMengajar.filter(
      (j) => j.jenis_jadwal === "seminar_pleno"
    );

    // Perencanaan = jumlah sesi dari jadwal (1 sesi = 1 perencanaan, 2 sesi = 2 perencanaan)
    const perencanaan = seminarPlenoJadwal.reduce((total, jadwal) => {
      return total + (jadwal.jumlah_sesi || 0);
    }, 0);

    return perencanaan;
  };

  // Function to calculate Kuliah Besar perencanaan per blok
  const getKuliahBesarPerencanaanPerBlok = (blokNumber: number): number => {
    // Filter jadwal kuliah besar untuk blok tertentu
    const kuliahBesarJadwalBlok = jadwalMengajar.filter((j) => {
      const blokMataKuliah = getBlokFromMataKuliah(j.mata_kuliah_kode);
      return (
        j.jenis_jadwal === "kuliah_besar" &&
        blokMataKuliah === blokNumber.toString()
      );
    });

    // Perencanaan = jumlah sesi dari jadwal (1 sesi = 1 perencanaan, 2 sesi = 2 perencanaan)
    const perencanaan = kuliahBesarJadwalBlok.reduce((total, jadwal) => {
      return total + (jadwal.jumlah_sesi || 0);
    }, 0);

    return perencanaan;
  };

  // Function to calculate total Kuliah Besar perencanaan for all blocks
  const getTotalKuliahBesarPerencanaan = (): number => {
    // Filter jadwal kuliah besar untuk semua blok
    const kuliahBesarJadwal = jadwalMengajar.filter(
      (j) => j.jenis_jadwal === "kuliah_besar"
    );

    // Perencanaan = jumlah sesi dari jadwal (1 sesi = 1 perencanaan, 2 sesi = 2 perencanaan)
    const perencanaan = kuliahBesarJadwal.reduce((total, jadwal) => {
      return total + (jadwal.jumlah_sesi || 0);
    }, 0);

    return perencanaan;
  };

  // Function to calculate Praktikum perencanaan per blok
  const getPraktikumPerencanaanPerBlok = (blokNumber: number): number => {
    // Filter jadwal praktikum untuk blok tertentu
    const praktikumJadwalBlok = jadwalMengajar.filter((j) => {
      const blokMataKuliah = getBlokFromMataKuliah(j.mata_kuliah_kode);
      return (
        j.jenis_jadwal === "praktikum" &&
        blokMataKuliah === blokNumber.toString()
      );
    });

    // Perencanaan = jumlah sesi dari jadwal (1 sesi = 1 perencanaan, 2 sesi = 2 perencanaan)
    const perencanaan = praktikumJadwalBlok.reduce((total, jadwal) => {
      return total + (jadwal.jumlah_sesi || 0);
    }, 0);

    return perencanaan;
  };

  // Function to calculate total Praktikum perencanaan for all blocks
  const getTotalPraktikumPerencanaan = (): number => {
    // Filter jadwal praktikum untuk semua blok
    const praktikumJadwal = jadwalMengajar.filter(
      (j) => j.jenis_jadwal === "praktikum"
    );

    // Perencanaan = jumlah sesi dari jadwal (1 sesi = 1 perencanaan, 2 sesi = 2 perencanaan)
    const perencanaan = praktikumJadwal.reduce((total, jadwal) => {
      return total + (jadwal.jumlah_sesi || 0);
    }, 0);

    return perencanaan;
  };

  // Function to calculate total PBL sesi for all blocks
  const getTotalPblSesi = (): number => {
    let totalSesi = 0;

    // 1. Ambil jadwal mengajar dosen yang jenis_jadwal = "pbl"
    // Catatan: Perencanaan keseluruhan juga tidak bergantung pada submit
    const jadwalPbl = jadwalMengajar.filter((j) => j.jenis_jadwal === "pbl");

    // 2. Buat mapping semester dosen per blok
    const dosenSemesterPerBlok: Record<number, string[]> = {};
    jadwalPbl.forEach((jadwal) => {
      const mataKuliah = mataKuliahData[jadwal.mata_kuliah_kode];

      if (mataKuliah && mataKuliah.blok) {
        // Coba ambil semester dari semester atau semester_type
        let semesterValue = jadwal.semester || jadwal.semester_type;

        // Mapping semester_type ke semester yang sesuai
        if (jadwal.semester_type === "reguler" && !jadwal.semester) {
          // Untuk reguler, ambil semester dari jadwal lain yang ada semester
          const jadwalDenganSemester = jadwalMengajar.find(
            (j) => j.mata_kuliah_kode === jadwal.mata_kuliah_kode && j.semester
          );
          if (jadwalDenganSemester) {
            semesterValue = jadwalDenganSemester.semester;
          } else {
            // Jika tidak ada jadwal dengan semester, coba ambil dari mataKuliahData
            const mataKuliah = mataKuliahData[jadwal.mata_kuliah_kode];
            if (mataKuliah) {
              // Ambil semester dari PBL data berdasarkan blok
              const pblItem = Object.values(pblData).find(
                (item) =>
                  item.mata_kuliah?.kode === jadwal.mata_kuliah_kode &&
                  item.mata_kuliah?.blok === mataKuliah.blok
              );
              if (pblItem && pblItem.mata_kuliah?.semester) {
                semesterValue = pblItem.mata_kuliah.semester;
              }
            }
          }
        }

        if (semesterValue) {
          if (!dosenSemesterPerBlok[mataKuliah.blok]) {
            dosenSemesterPerBlok[mataKuliah.blok] = [];
          }
          if (!dosenSemesterPerBlok[mataKuliah.blok].includes(semesterValue)) {
            dosenSemesterPerBlok[mataKuliah.blok].push(semesterValue);
          }
        }
      }
    });

    // 3. Hitung PBL dari pblData dengan validasi semester per blok
    Object.values(pblData).forEach((item) => {
      if (item.mata_kuliah && item.mata_kuliah.blok) {
        const mataKuliahBlok = item.mata_kuliah.blok;
        const mataKuliahSemester = item.mata_kuliah.semester;
        const dosenSemesterDiBlok = dosenSemesterPerBlok[mataKuliahBlok] || [];

        // 4. Validasi: hanya hitung jika semester mata kuliah sama dengan semester yang diajarkan dosen di blok tersebut
        if (dosenSemesterDiBlok.includes(mataKuliahSemester) && item.pbls) {
          const modulCount = item.pbls.length;
          const sesiPerItem = modulCount * 5;
          totalSesi += sesiPerItem;
        }
      }
    });

    return totalSesi;
  };

  // Helper function untuk convert boolean atau integer ke boolean
  const toBoolean = (value: boolean | number | null | undefined): boolean => {
    if (value === true || value === 1) return true;
    if (value === false || value === 0) return false;
    return false;
  };

  // Fungsi untuk menghitung data per blok
  const getBlokData = (blokNumber: number) => {
    const jadwalBlok = filteredJadwal.filter((j) => {
      // Untuk CSR, gunakan nomor_csr untuk menentukan blok DAN cek penilaian_submitted
      if (j.jenis_jadwal === "csr") {
        if (j.nomor_csr) {
          const parts = j.nomor_csr.split(".");
          if (parts.length === 2) {
            const csrBlok = parseInt(parts[1]);
            if (csrBlok === blokNumber) {
              // Cek apakah penilaian sudah disubmit
              const submitted = j.penilaian_submitted === true;
              return submitted;
            }
          }
        }
        return false;
      }

      // Untuk jenis jadwal lainnya, gunakan getBlokFromMataKuliah
      const blokMataKuliah = getBlokFromMataKuliah(j.mata_kuliah_kode);
      if (blokMataKuliah !== blokNumber.toString()) return false;

      // Filter realisasi PBL: hanya hitung jika penilaian_submitted = true
      if (j.jenis_jadwal === "pbl") {
        const submitted = j.penilaian_submitted === true;
        return submitted;
      }
      // Filter realisasi Jurnal Reading: hanya hitung jika penilaian_submitted = true
      if (j.jenis_jadwal === "jurnal_reading") {
        const submitted = j.penilaian_submitted === true;
        return submitted;
      }

      // Filter realisasi Praktikum: hanya hitung jika absensi_hadir = true dan penilaian_submitted = true
      // (Dosen harus hadir dan absensi dosen sudah disubmit)
      if (j.jenis_jadwal === "praktikum") {
        // Handle boolean dan integer (0/1) dari backend
        const submitted = toBoolean(j.penilaian_submitted);
        const hadir = toBoolean(j.absensi_hadir);
        return submitted && hadir;
      }

      // Filter realisasi Kuliah Besar: hanya hitung jika penilaian_submitted = true
      if (j.jenis_jadwal === "kuliah_besar") {
        const submitted = j.penilaian_submitted === true;
        return submitted;
      }

      // Filter realisasi Non Blok Non CSR: hanya hitung jika status_konfirmasi = "bisa"
      if (j.jenis_jadwal === "non_blok_non_csr") {
        return j.status_konfirmasi === "bisa";
      }

      // Filter realisasi Materi/Agenda (Non Blok Non CSR baris): hanya hitung jika status_konfirmasi = "bisa"
      // Catatan: sebagian sumber data jadwal mengajar memetakan baris Non Blok Non CSR sebagai jenis_jadwal "materi"/"agenda"
      if (j.jenis_jadwal === "materi" || j.jenis_jadwal === "agenda") {
        return j.status_konfirmasi === "bisa";
      }

      // Filter realisasi Seminar Pleno:
      // - Harus sudah disubmit (penilaian_submitted = true)
      // - Untuk dosen pengampu: harus hadir (absensi_hadir = true)
      // - Untuk koordinator: cukup sudah disubmit
      if (j.jenis_jadwal === "seminar_pleno") {
        const submitted = j.penilaian_submitted === true;
        if (!submitted) return false;

        // Cek apakah dosen adalah koordinator
        const dosenId = dosenData?.id;
        const isKoordinator =
          dosenId && j.koordinator_ids && j.koordinator_ids.includes(dosenId);

        // Jika koordinator, cukup sudah disubmit
        if (isKoordinator) {
          return submitted;
        }

        // Jika pengampu, harus hadir juga
        const hadir = j.absensi_hadir === true;
        return submitted && hadir;
      }

      // Filter realisasi Persamaan Persepsi:
      // - Harus sudah disubmit (penilaian_submitted = true)
      // - Untuk dosen pengampu: harus hadir (absensi_hadir = true)
      // - Untuk koordinator: cukup sudah disubmit
      if (j.jenis_jadwal === "persamaan_persepsi") {
        const submitted = j.penilaian_submitted === true;
        if (!submitted) return false;

        // Cek apakah dosen adalah koordinator
        const dosenId = dosenData?.id;
        const isKoordinator =
          dosenId && j.koordinator_ids && j.koordinator_ids.includes(dosenId);

        // Jika koordinator, cukup sudah disubmit
        if (isKoordinator) {
          return submitted;
        }

        // Jika pengampu, harus hadir juga
        const hadir = j.absensi_hadir === true;
        return submitted && hadir;
      }

      return true;
    });

    // Statistik breakdown per jenis jadwal untuk blok ini
    const statistikPerJenis = jadwalBlok.reduce((acc, jadwal) => {
      const jenis = jadwal.jenis_jadwal;
      if (!acc[jenis]) {
        acc[jenis] = { jumlah: 0, sesi: 0, jam: 0 };
      }
      acc[jenis].jumlah += 1;
      acc[jenis].sesi += jadwal.jumlah_sesi;

      // Hitung jam berdasarkan jumlah sesi (1 sesi = 50 menit = 0.833 jam)
      const jamPerSesi = 50 / 60;
      acc[jenis].jam += jadwal.jumlah_sesi * jamPerSesi;

      return acc;
    }, {} as Record<string, { jumlah: number; sesi: number; jam: number }>);

    return { jadwalBlok, statistikPerJenis };
  };

  const exportPDF = async () => {
    try {
      if (!dosenData) {
        console.error("Data dosen tidak tersedia");
        return;
      }

      const doc = new jsPDF();
      const margin = 20; // Mengurangi margin dari 20 ke 15
      let yPos = margin;
      const maxPageHeight = doc.internal.pageSize.height - margin;

      const addNewPage = () => {
        doc.addPage();
        yPos = margin;
      };

      const addText = (
        text: string,
        x: number,
        y: number,
        options?: { align?: "center" | "left" | "right" | "justify" }
      ) => {
        if (y > maxPageHeight) {
          addNewPage();
          y = margin;
        }
        doc.text(text, x, y, options);
        return y;
      };

      // LOAD LOGO
      const loadLogo = async (): Promise<string> => {
        try {
          const response = await fetch("/images/logo/logo-isme-icon.svg");
          if (!response.ok) {
            throw new Error("Logo tidak ditemukan");
          }
          const svgText = await response.text();

          // Convert SVG to canvas then to data URL
          return new Promise((resolve) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = 100;
            canvas.height = 100;

            const img = new Image();
            img.onload = () => {
              if (ctx) {
                ctx.drawImage(img, 0, 0, 100, 100);
                resolve(canvas.toDataURL("image/png"));
              } else {
                resolve("");
              }
            };
            img.onerror = () => resolve("");
            img.src = "data:image/svg+xml;base64," + btoa(svgText);
          });
        } catch (error) {
          console.error("Error loading logo:", error);
          return "";
        }
      };

      const logoDataUrl = await loadLogo();

      // HEADER UNIVERSITAS DENGAN LOGO
      if (logoDataUrl) {
        try {
          // Tambahkan logo di tengah atas dengan ukuran yang lebih besar
          const logoWidth = 25;
          const logoHeight = 25;
          const logoX = (doc.internal.pageSize.width - logoWidth) / 2; // Tengah horizontal
          const logoY = yPos;

          doc.addImage(
            logoDataUrl,
            "PNG",
            logoX,
            logoY,
            logoWidth,
            logoHeight,
            undefined,
            "FAST",
            0
          );
        } catch (logoError) {
          console.error("Error adding logo to PDF:", logoError);
          // Fallback: tambahkan simbol atau text sebagai logo
          doc.setFontSize(24);
          doc.setFont("times", "bold");
          doc.text("UMJ", 105, yPos + 20, { align: "center" });
        }
      } else {
        // Fallback jika logo tidak berhasil load
        doc.setFontSize(24);
        doc.setFont("times", "bold");
        doc.text("UMJ", 105, yPos + 20, { align: "center" });
      }

      yPos += 35; // Mengurangi jarak antara logo dan teks

      doc.setFontSize(18);
      doc.setFont("times", "bold");
      yPos = addText("UNIVERSITAS MUHAMMADIYAH JAKARTA", 105, yPos, {
        align: "center",
      });
      yPos += 10;

      doc.setFontSize(14);
      doc.setFont("times", "normal");
      yPos = addText("Fakultas Kedokteran", 105, yPos, { align: "center" });
      yPos = addText("Program Studi Kedokteran", 105, yPos + 7, {
        align: "center",
      });
      yPos += 5;

      doc.setFontSize(11);
      yPos = addText(
        "Jl. KH. Ahmad Dahlan, Cirendeu, Ciputat, Tangerang Selatan",
        105,
        yPos + 5,
        { align: "center" }
      );
      yPos = addText(
        "Telp. (021) 742-3740 - Fax. (021) 742-3740",
        105,
        yPos + 5,
        { align: "center" }
      );
      yPos += 15;

      doc.line(margin, yPos, doc.internal.pageSize.width - margin, yPos);
      yPos += 10;

      // JUDUL DOKUMEN
      doc.setFontSize(16);
      doc.setFont("times", "bold");
      yPos = addText("LAPORAN KINERJA DOSEN", 105, yPos, { align: "center" });
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont("times", "normal");
      yPos = addText(`No: 5/UMJ-FK/8/2025`, 105, yPos, { align: "center" });
      yPos += 15;

      // INFORMASI PENERBIT
      yPos = addText("Saya yang bertanda tangan di bawah ini:", margin, yPos);
      yPos += 8;
      yPos = addText("Nama    : Kepala Program Studi Kedokteran", margin, yPos);
      yPos += 8;
      yPos = addText("Jabatan : Kepala Program Studi", margin, yPos);
      yPos += 8;
      yPos = addText(
        "Alamat  : Jl. KH. Ahmad Dahlan, Cirendeu, Ciputat, Tangerang Selatan",
        margin,
        yPos
      );
      yPos += 15;

      // INFORMASI DOSEN
      yPos = addText("Dengan ini menerangkan bahwa :", margin, yPos);
      yPos += 10;
      yPos = addText(`Nama         : ${dosenData.name}`, margin, yPos);
      yPos += 8;
      yPos = addText(`NIDN         : ${dosenData.nidn}`, margin, yPos);
      yPos += 8;
      yPos = addText("Jabatan      : Dosen", margin, yPos);
      yPos += 8;

      // TANGGAL DINAMIS
      const jadwalDates = filteredJadwal
        .map((j) => new Date(j.tanggal))
        .sort((a, b) => a.getTime() - b.getTime());
      const tanggalMulai = jadwalDates.length > 0 ? jadwalDates[0] : new Date();
      const tanggalAkhir =
        jadwalDates.length > 0
          ? jadwalDates[jadwalDates.length - 1]
          : new Date();

      yPos = addText(
        `Tanggal Mulai: ${tanggalMulai.toLocaleDateString("id-ID")}`,
        margin,
        yPos
      );
      yPos += 8;
      yPos = addText(
        `Tanggal Akhir : ${tanggalAkhir.toLocaleDateString("id-ID")}`,
        margin,
        yPos
      );
      yPos += 15;

      // PERNYATAAN
      const pernyataan = [
        "Bahwa yang bersangkutan adalah Dosen di Universitas Muhammadiyah Jakarta,",
        "Fakultas Kedokteran, Program Studi Kedokteran dengan masa kerja dari",
        `${tanggalMulai.toLocaleDateString(
          "id-ID"
        )} sampai dengan ${tanggalAkhir.toLocaleDateString("id-ID")}.`,
        "",
        "Bahwa selama masa kerjanya, yang bersangkutan telah menunjukkan kinerja yang baik",
        "dan bertanggung jawab serta selalu menjaga nama baik Universitas Muhammadiyah Jakarta.",
        "",
      ];

      pernyataan.forEach((line) => {
        if (line) yPos = addText(line, margin, yPos);
        yPos += 5;
      });

      // RINGKASAN
      const totalSesi = filteredJadwal.reduce(
        (sum, j) => sum + j.jumlah_sesi,
        0
      );
      const jumlahMataKuliah = new Set(
        filteredJadwal.map((j) => j.mata_kuliah_kode)
      ).size;
      const jenisKegiatan = Object.keys(statistikPerJenis).length;

      // Hitung breakdown semester type
      const jadwalReguler = filteredJadwal.filter(
        (j) => j.semester_type === "reguler"
      );
      const jadwalAntara = filteredJadwal.filter(
        (j) => j.semester_type === "antara"
      );
      const sesiReguler = jadwalReguler.reduce(
        (sum, j) => sum + j.jumlah_sesi,
        0
      );
      const sesiAntara = jadwalAntara.reduce(
        (sum, j) => sum + j.jumlah_sesi,
        0
      );

      const ringkasan = [
        `Bahwa dalam periode pelaporan, yang bersangkutan telah melaksanakan ${filteredJadwal.length} pertemuan`,
        `dengan total ${totalSesi} sesi mengajar dan ${formatJamMenit(
          totalJamMengajar
        )}, mengajar ${jumlahMataKuliah} mata kuliah`,
        `dalam ${jenisKegiatan} jenis kegiatan akademik yang berbeda.`,
        "",
        `Rincian: ${jadwalReguler.length} pertemuan (${sesiReguler} sesi) pada Semester Reguler dan ${jadwalAntara.length} pertemuan (${sesiAntara} sesi) pada Semester Antara.`,
        "",
        "Bahwa Surat Keterangan ini dibuat untuk keperluan referensi atau untuk dipergunakan",
        "sebagaimana mestinya.",
      ];

      ringkasan.forEach((line) => {
        if (line) yPos = addText(line, margin, yPos);
        yPos += 5;
      });

      // --- HALAMAN 2: STATISTIK ---

      yPos += 20;
      doc.setFontSize(14);
      doc.setFont("times", "bold");
      yPos = addText("STATISTIK KINERJA MENGAJAR", 105, yPos, {
        align: "center",
      });
      yPos += 15;

      doc.setFontSize(12);
      doc.setFont("times", "normal");
      const statX = margin; // Gunakan margin standar untuk konsistensi
      yPos = addText(
        `Total Jadwal Mengajar : ${filteredJadwal.length} pertemuan`,
        statX,
        yPos
      );
      yPos += 8;
      yPos = addText(`Total Sesi Mengajar   : ${totalSesi} sesi`, statX, yPos);
      yPos += 8;
      yPos = addText(
        `Total Jam Mengajar    : ${formatJamMenit(totalJamMengajar)}`,
        statX,
        yPos
      );
      yPos += 8;
      yPos = addText(
        `Jumlah Mata Kuliah    : ${jumlahMataKuliah} mata kuliah`,
        statX,
        yPos
      );
      yPos += 15;

      // TABEL RINCIAN
      doc.setFont("times", "bold");
      yPos = addText("RINCIAN KESELURUHAN PER JENIS KEGIATAN:", statX, yPos);
      yPos += 15;

      // Header tabel - Perbaiki layout dengan lebar kolom yang lebih proporsional
      const pageWidth = doc.internal.pageSize.width;
      const availableWidth = pageWidth - margin * 2;

      // Hitung lebar kolom secara proporsional dengan jarak yang lebih baik
      const colJenis = margin;
      const colPerencanaan = colJenis + availableWidth * 0.25; // 25% untuk Jenis Kegiatan
      const colPertemuan = colPerencanaan + availableWidth * 0.18; // 18% untuk Perencanaan (lebih lebar)
      const colSesi = colPertemuan + availableWidth * 0.18; // 18% untuk Pertemuan(Realisasi) (lebih lebar)
      const colJam = colSesi + availableWidth * 0.15; // 15% untuk Sesi
      const colSemesterType = colJam + availableWidth * 0.2; // 20% untuk Jam (lebih lebar untuk jarak)
      // Akhir tabel sampai pojok kanan

      // Header dengan alignment yang tepat
      doc.text("Jenis Kegiatan", colJenis, yPos);
      doc.text("Perencanaan", colPerencanaan, yPos);

      // Header Pertemuan (tanpa realisasi)
      doc.text("Pertemuan", colPertemuan, yPos);

      // Header Realisasi
      doc.text("Realisasi", colSesi, yPos);
      doc.text("Jam", colJam, yPos);
      doc.text("Semester", colSemesterType, yPos);
      yPos += 6;

      // Garis bawah header - diperpanjang sampai kolom Semester
      doc.line(colJenis, yPos, colSemesterType + 20, yPos);
      yPos += 6;

      // Tabel dimulai

      doc.setFont("times", "normal");

      // Data tabel
      const semuaJenisKegiatan = [
        { jenis: "pbl", label: "PBL" },
        { jenis: "kuliah_besar", label: "Kuliah Besar" },
        { jenis: "praktikum", label: "Praktikum" },
        { jenis: "jurnal_reading", label: "Jurnal Reading" },
        { jenis: "csr", label: "CSR" },
        { jenis: "persamaan_persepsi", label: "Persamaan Persepsi" },
        { jenis: "seminar_pleno", label: "Seminar Pleno" },
        { jenis: "materi", label: "Materi" },
      ];

      semuaJenisKegiatan.forEach((jenisKegiatan) => {
        const dataJenis = statistikPerJenis[jenisKegiatan.jenis] || {
          jumlah: 0,
          sesi: 0,
          jam: 0,
        };

        // Hitung breakdown per semester type untuk jenis ini
        const jadwalJenis = filteredJadwal.filter(
          (j) => j.jenis_jadwal === jenisKegiatan.jenis
        );
        const regulerCount = jadwalJenis.filter(
          (j) => j.semester_type === "reguler"
        ).length;
        const antaraCount = jadwalJenis.filter(
          (j) => j.semester_type === "antara"
        ).length;

        // Data dengan alignment yang tepat
        if (jenisKegiatan.jenis === "pbl") {
          // PBL dengan format khusus: "PBL (keseluruhan)"
          doc.setFont("times", "bold");
          doc.text("PBL", colJenis, yPos);
          doc.setFontSize(11); // sedikit lebih besar dari sebelumnya
          doc.setFont("times", "normal");
          doc.text("(keseluruhan)", colJenis + 10, yPos); // geser 1px dari posisi pepet
          doc.setFontSize(12);
          doc.setFont("times", "bold");
        } else {
          doc.text(jenisKegiatan.label, colJenis, yPos);
        }
        // Kolom Perencanaan: "-" untuk materi; sesi untuk PBL; jumlah_sesi untuk yang lain
        let perencanaanValue = "0";
        if (jenisKegiatan.jenis === "materi") {
          perencanaanValue = "-";
        } else if (jenisKegiatan.jenis === "pbl") {
          perencanaanValue = getTotalPblSesi().toString();
        } else if (jenisKegiatan.jenis === "kuliah_besar") {
          perencanaanValue = getTotalKuliahBesarPerencanaan().toString();
        } else if (jenisKegiatan.jenis === "praktikum") {
          perencanaanValue = getTotalPraktikumPerencanaan().toString();
        } else if (jenisKegiatan.jenis === "jurnal_reading") {
          perencanaanValue = getTotalJurnalReadingPerencanaan().toString();
        } else if (jenisKegiatan.jenis === "csr") {
          perencanaanValue = getTotalCSRPerencanaan().toString();
        } else if (jenisKegiatan.jenis === "persamaan_persepsi") {
          perencanaanValue = getTotalPersamaanPersepsiPerencanaan().toString();
        } else if (jenisKegiatan.jenis === "seminar_pleno") {
          perencanaanValue = getTotalSeminarPlenoPerencanaan().toString();
        }
        doc.text(perencanaanValue, colPerencanaan, yPos);
        doc.text(`${dataJenis.jumlah}`, colPertemuan, yPos);
        doc.text(`${dataJenis.sesi}`, colSesi, yPos);
        doc.text(`${formatJamMenit(dataJenis.jam)}`, colJam, yPos);
        doc.text(`R:${regulerCount} A:${antaraCount}`, colSemesterType, yPos);

        yPos += 8;

        // Tambahkan breakdown detail untuk CSR saja (PBL breakdown dihapus)
        // CSR breakdown dihapus - hanya tampilkan satu baris CSR saja
      });

      // Tabel selesai tanpa garis vertikal

      // --- HALAMAN 3: TABEL BLOK 1-4 ---
      addNewPage();

      doc.setFontSize(14);
      doc.setFont("times", "bold");
      yPos = addText("RINCIAN PER BLOK", 105, yPos, {
        align: "center",
      });
      yPos += 15;

      // Loop untuk blok 1-2 saja di halaman 3
      for (let blokNumber = 1; blokNumber <= 2; blokNumber++) {
        const { jadwalBlok, statistikPerJenis } = getBlokData(blokNumber);

        // Judul blok
        doc.setFontSize(12);
        doc.setFont("times", "bold");
        yPos = addText(`BLOK ${blokNumber}`, margin, yPos);
        yPos += 10;

        // Header tabel
        doc.setFont("times", "bold");
        yPos = addText("RINCIAN PER JENIS KEGIATAN:", margin, yPos);
        yPos += 10;

        // Header tabel - Perbaiki layout dengan lebar kolom yang lebih proporsional
        const pageWidth = doc.internal.pageSize.width;
        const availableWidth = pageWidth - margin * 2;

        // Hitung lebar kolom secara proporsional dengan jarak yang lebih baik
        const colJenis = margin;
        const colPerencanaan = colJenis + availableWidth * 0.25; // 25% untuk Jenis Kegiatan
        const colPertemuan = colPerencanaan + availableWidth * 0.18; // 18% untuk Perencanaan (lebih lebar)
        const colSesi = colPertemuan + availableWidth * 0.18; // 18% untuk Pertemuan(Realisasi) (lebih lebar)
        const colJam = colSesi + availableWidth * 0.15; // 15% untuk Sesi
        const colSemesterType = colJam + availableWidth * 0.2; // 20% untuk Jam (lebih lebar untuk jarak)

        // Header dengan alignment yang tepat
        doc.text("Jenis Kegiatan", colJenis, yPos);
        doc.text("Perencanaan", colPerencanaan, yPos);

        // Header Pertemuan (tanpa realisasi untuk per blok)
        doc.text("Pertemuan", colPertemuan, yPos);

        // Header Realisasi
        doc.text("Realisasi", colSesi, yPos);
        doc.text("Jam", colJam, yPos);
        doc.text("Semester", colSemesterType, yPos);
        yPos += 6;

        // Garis bawah header - diperpanjang sampai kolom Semester
        doc.line(colJenis, yPos, colSemesterType + 20, yPos);
        yPos += 6;

        // Tabel dimulai
        doc.setFont("times", "normal");

        // Data tabel
        const semuaJenisKegiatan = [
          { jenis: "pbl", label: "PBL" },
          { jenis: "kuliah_besar", label: "Kuliah Besar" },
          { jenis: "praktikum", label: "Praktikum" },
          { jenis: "jurnal_reading", label: "Jurnal Reading" },
          { jenis: "csr", label: "CSR" },
          { jenis: "persamaan_persepsi", label: "Persamaan Persepsi" },
          { jenis: "seminar_pleno", label: "Seminar Pleno" },
          { jenis: "materi", label: "Materi" },
        ];

        semuaJenisKegiatan.forEach((jenisKegiatan) => {
          const dataJenis = statistikPerJenis[jenisKegiatan.jenis] || {
            jumlah: 0,
            sesi: 0,
            jam: 0,
          };

          // Hitung breakdown per semester type untuk jenis ini
          const jadwalJenis = jadwalBlok.filter(
            (j) => j.jenis_jadwal === jenisKegiatan.jenis
          );
          const regulerCount = jadwalJenis.filter(
            (j) => j.semester_type === "reguler"
          ).length;
          const antaraCount = jadwalJenis.filter(
            (j) => j.semester_type === "antara"
          ).length;

          // Data dengan alignment yang tepat
          if (jenisKegiatan.jenis === "pbl") {
            // PBL dengan format khusus: "PBL (keseluruhan)"
            doc.setFont("times", "bold"); // PBL tetap bold
            doc.text("PBL", colJenis, yPos);
            doc.setFontSize(10); // Font sama dengan Realisasi
            doc.setFont("times", "normal"); // Tidak bold untuk (keseluruhan)
            doc.text("(keseluruhan)", colJenis + 10, yPos); // Di samping PBL
            doc.setFontSize(12); // Kembalikan font size
            doc.setFont("times", "bold"); // Kembalikan bold
          } else {
            doc.text(jenisKegiatan.label, colJenis, yPos);
          }
          // Kolom Perencanaan: "-" untuk materi; sesi untuk PBL; jumlah_sesi untuk yang lain
          let perencanaanValue = "0";
          if (jenisKegiatan.jenis === "materi") {
            perencanaanValue = "-";
          } else if (jenisKegiatan.jenis === "pbl") {
            const sesiBlok = getPblSesiPerBlok(blokNumber);
            perencanaanValue = sesiBlok.toString();
          } else if (jenisKegiatan.jenis === "kuliah_besar") {
            const perencanaanKuliahBesar =
              getKuliahBesarPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanKuliahBesar.toString();
          } else if (jenisKegiatan.jenis === "praktikum") {
            const perencanaanPraktikum =
              getPraktikumPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanPraktikum.toString();
          } else if (jenisKegiatan.jenis === "jurnal_reading") {
            const perencanaanJurnal =
              getJurnalReadingPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanJurnal.toString();
          } else if (jenisKegiatan.jenis === "csr") {
            const perencanaanCSR = getCSRPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanCSR.toString();
          } else if (jenisKegiatan.jenis === "persamaan_persepsi") {
            const perencanaanPersepsi =
              getPersamaanPersepsiPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanPersepsi.toString();
          } else if (jenisKegiatan.jenis === "seminar_pleno") {
            const perencanaanSeminarPleno =
              getSeminarPlenoPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanSeminarPleno.toString();
          }
          doc.text(perencanaanValue, colPerencanaan, yPos);
          doc.text(`${dataJenis.jumlah}`, colPertemuan, yPos);
          doc.text(`${dataJenis.sesi}`, colSesi, yPos);
          doc.text(`${formatJamMenit(dataJenis.jam)}`, colJam, yPos);
          doc.text(`R:${regulerCount} A:${antaraCount}`, colSemesterType, yPos);

          yPos += 8;

          // Tambahkan breakdown detail untuk CSR saja (PBL breakdown dihapus)

          // CSR breakdown dihapus - hanya tampilkan satu baris CSR saja
        });

        // Tabel selesai tanpa garis vertikal
        yPos += 15; // Jarak antar tabel blok
      }

      // --- HALAMAN 4: BLOK 3-4 ---
      addNewPage();

      doc.setFontSize(14);
      doc.setFont("times", "bold");
      yPos = addText("RINCIAN PER BLOK", 105, yPos, {
        align: "center",
      });
      yPos += 15;

      // Loop untuk blok 3-4 di halaman 4
      for (let blokNumber = 3; blokNumber <= 4; blokNumber++) {
        const { jadwalBlok, statistikPerJenis } = getBlokData(blokNumber);

        // Judul blok
        doc.setFontSize(12);
        doc.setFont("times", "bold");
        yPos = addText(`BLOK ${blokNumber}`, margin, yPos);
        yPos += 10;

        // Header tabel
        doc.setFont("times", "bold");
        yPos = addText("RINCIAN PER JENIS KEGIATAN:", margin, yPos);
        yPos += 10;

        // Header tabel - Perbaiki layout dengan lebar kolom yang lebih proporsional
        const pageWidth = doc.internal.pageSize.width;
        const availableWidth = pageWidth - margin * 2;

        // Hitung lebar kolom secara proporsional dengan jarak yang lebih baik
        const colJenis = margin;
        const colPerencanaan = colJenis + availableWidth * 0.25; // 25% untuk Jenis Kegiatan
        const colPertemuan = colPerencanaan + availableWidth * 0.18; // 18% untuk Perencanaan (lebih lebar)
        const colSesi = colPertemuan + availableWidth * 0.18; // 18% untuk Pertemuan(Realisasi) (lebih lebar)
        const colJam = colSesi + availableWidth * 0.15; // 15% untuk Sesi
        const colSemesterType = colJam + availableWidth * 0.2; // 20% untuk Jam (lebih lebar untuk jarak)

        // Header dengan alignment yang tepat
        doc.text("Jenis Kegiatan", colJenis, yPos);
        doc.text("Perencanaan", colPerencanaan, yPos);

        // Header Pertemuan (tanpa realisasi untuk per blok)
        doc.text("Pertemuan", colPertemuan, yPos);

        // Header Realisasi
        doc.text("Realisasi", colSesi, yPos);
        doc.text("Jam", colJam, yPos);
        doc.text("Semester", colSemesterType, yPos);
        yPos += 6;

        // Garis bawah header - diperpanjang sampai kolom Semester
        doc.line(colJenis, yPos, colSemesterType + 20, yPos);
        yPos += 6;

        // Tabel dimulai
        doc.setFont("times", "normal");

        // Data tabel
        const semuaJenisKegiatan = [
          { jenis: "pbl", label: "PBL" },
          { jenis: "kuliah_besar", label: "Kuliah Besar" },
          { jenis: "praktikum", label: "Praktikum" },
          { jenis: "jurnal_reading", label: "Jurnal Reading" },
          { jenis: "csr", label: "CSR" },
          { jenis: "persamaan_persepsi", label: "Persamaan Persepsi" },
          { jenis: "seminar_pleno", label: "Seminar Pleno" },
          { jenis: "materi", label: "Materi" },
        ];

        semuaJenisKegiatan.forEach((jenisKegiatan) => {
          const dataJenis = statistikPerJenis[jenisKegiatan.jenis] || {
            jumlah: 0,
            sesi: 0,
            jam: 0,
          };

          // Hitung breakdown per semester type untuk jenis ini
          const jadwalJenis = jadwalBlok.filter(
            (j) => j.jenis_jadwal === jenisKegiatan.jenis
          );
          const regulerCount = jadwalJenis.filter(
            (j) => j.semester_type === "reguler"
          ).length;
          const antaraCount = jadwalJenis.filter(
            (j) => j.semester_type === "antara"
          ).length;

          // Data dengan alignment yang tepat
          if (jenisKegiatan.jenis === "pbl") {
            // PBL dengan format khusus: "PBL (keseluruhan)"
            doc.setFont("times", "bold"); // PBL tetap bold
            doc.text("PBL", colJenis, yPos);
            doc.setFontSize(10); // Font sama dengan Realisasi
            doc.setFont("times", "normal"); // Tidak bold untuk (keseluruhan)
            doc.text("(keseluruhan)", colJenis + 10, yPos); // Di samping PBL
            doc.setFontSize(12); // Kembalikan font size
            doc.setFont("times", "bold"); // Kembalikan bold
          } else {
            doc.text(jenisKegiatan.label, colJenis, yPos);
          }
          // Kolom Perencanaan: "-" untuk materi; sesi untuk PBL; jumlah_sesi untuk yang lain
          let perencanaanValue = "0";
          if (jenisKegiatan.jenis === "materi") {
            perencanaanValue = "-";
          } else if (jenisKegiatan.jenis === "pbl") {
            const sesiBlok = getPblSesiPerBlok(blokNumber);
            perencanaanValue = sesiBlok.toString();
          } else if (jenisKegiatan.jenis === "kuliah_besar") {
            const perencanaanKuliahBesar =
              getKuliahBesarPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanKuliahBesar.toString();
          } else if (jenisKegiatan.jenis === "praktikum") {
            const perencanaanPraktikum =
              getPraktikumPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanPraktikum.toString();
          } else if (jenisKegiatan.jenis === "jurnal_reading") {
            const perencanaanJurnal =
              getJurnalReadingPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanJurnal.toString();
          } else if (jenisKegiatan.jenis === "csr") {
            const perencanaanCSR = getCSRPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanCSR.toString();
          } else if (jenisKegiatan.jenis === "persamaan_persepsi") {
            const perencanaanPersepsi =
              getPersamaanPersepsiPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanPersepsi.toString();
          } else if (jenisKegiatan.jenis === "seminar_pleno") {
            const perencanaanSeminarPleno =
              getSeminarPlenoPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanSeminarPleno.toString();
          }
          doc.text(perencanaanValue, colPerencanaan, yPos);
          doc.text(`${dataJenis.jumlah}`, colPertemuan, yPos);
          doc.text(`${dataJenis.sesi}`, colSesi, yPos);
          doc.text(`${formatJamMenit(dataJenis.jam)}`, colJam, yPos);
          doc.text(`R:${regulerCount} A:${antaraCount}`, colSemesterType, yPos);

          yPos += 8;

          // Tambahkan breakdown detail untuk CSR saja (PBL breakdown dihapus)

          // CSR breakdown dihapus - hanya tampilkan satu baris CSR saja
        });
      }

      // Add watermark using centralized helper
      addWatermarkToAllPages(doc);

      // Footer halaman
      const totalPages = doc.internal.pages.length;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);

        doc.setFontSize(8);
        doc.setFont("times", "normal");
        doc.text(
          `Halaman ${i} dari ${totalPages}`,
          105,
          doc.internal.pageSize.height - 15,
          { align: "center" }
        );
        doc.text(
          `Dicetak pada: ${new Date().toLocaleDateString(
            "id-ID"
          )} ${new Date().toLocaleTimeString("id-ID")}`,
          105,
          doc.internal.pageSize.height - 10,
          { align: "center" }
        );
      }

      // Bagian tanda tangan kosong - dipindah ke halaman terakhir
      // Tambah jarak sebelum tanda tangan
      yPos += 25;

      // Posisi tanda tangan
      const signYStart = yPos;

      // Tanggal di kanan - naik dan pepetkan dengan jabatan
      doc.setFontSize(11);
      doc.setFont("times", "normal");
      doc.text(
        `Jakarta, ${new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`,
        doc.internal.pageSize.width - margin, // posisi kanan
        signYStart - 10,
        { align: "right" }
      );

      // Jabatan pepetkan dengan tanggal di atas
      doc.setFontSize(11);
      doc.setFont("times", "bold");

      doc.text(
        "Ketua Program Studi",
        doc.internal.pageSize.width - margin,
        signYStart - 5,
        { align: "right" }
      );

      // Garis tanda tangan naik dan sejajar dengan huruf K dan i, geser ke kanan
      doc.setFont("times", "normal");
      doc.text(
        "(_________________________)",
        doc.internal.pageSize.width - margin + 7,
        signYStart + 25,
        { align: "right" }
      );

      // Simpan PDF
      const fileName = `Laporan_Kinerja_Dosen_${dosenData.name.replace(
        /\s+/g,
        "_"
      )}_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error saat export PDF:", error);
      alert("Gagal export PDF. Silakan coba lagi.");
    }
  };

  const getJenisJadwalColor = (jenis: string) => {
    switch (jenis) {
      case "kuliah_besar":
        return "bg-blue-100 text-blue-800";
      case "praktikum":
        return "bg-green-100 text-green-800";
      case "jurnal_reading":
        return "bg-purple-100 text-purple-800";
      case "pbl":
        return "bg-orange-100 text-orange-800";
      case "csr":
        return "bg-red-100 text-red-800";
      case "persamaan_persepsi":
        return "bg-pink-100 text-pink-800";
      case "materi":
        return "bg-indigo-100 text-indigo-800";
      case "agenda":
      case "agenda_khusus":
        return "bg-yellow-100 text-yellow-800";
      case "seminar_pleno":
        return "bg-cyan-100 text-cyan-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getJenisJadwalLabel = (jenis: string) => {
    switch (jenis) {
      case "kuliah_besar":
        return "Kuliah Besar";
      case "praktikum":
        return "Praktikum";
      case "jurnal_reading":
        return "Jurnal Reading";
      case "pbl":
        return "PBL";
      case "csr":
        return "CSR";
      case "persamaan_persepsi":
        return "Persamaan Persepsi";
      case "materi":
        return "Materi";
      case "agenda":
        return "Agenda";
      case "agenda_khusus":
        return "Agenda Khusus";
      case "seminar_pleno":
        return "Seminar Pleno";
      default:
        return jenis;
    }
  };

  const filteredJadwal = jadwalMengajar.filter((jadwal) => {
    // Filter semester type (reguler/antara)
    const matchSemesterType =
      !filterSemester ||
      (filterSemester === "reguler" && jadwal.semester_type === "reguler") ||
      (filterSemester === "antara" && jadwal.semester_type === "antara") ||
      filterSemester === "";

    // Filter jenis jadwal
    const matchJenis = !filterJenis || jadwal.jenis_jadwal === filterJenis;

    return matchSemesterType && matchJenis;
  });

  const totalJamMengajar = filteredJadwal.reduce((total, jadwal) => {
    // Untuk PBL & Jurnal Reading, realisasi hanya dihitung bila penilaian telah disubmit
    if (
      (jadwal.jenis_jadwal === "pbl" ||
        jadwal.jenis_jadwal === "jurnal_reading") &&
      !jadwal.penilaian_submitted
    ) {
      return total;
    }

    // Untuk Praktikum, realisasi hanya dihitung bila absensi_hadir = true dan penilaian_submitted = true
    // (Dosen harus hadir dan absensi dosen sudah disubmit)
    if (jadwal.jenis_jadwal === "praktikum") {
      // Handle boolean dan integer (0/1) dari backend
      const submitted = toBoolean(jadwal.penilaian_submitted);
      const hadir = toBoolean(jadwal.absensi_hadir);
      if (!submitted || !hadir) {
      return total;
      }
    }

    // Untuk CSR, realisasi hanya dihitung bila penilaian_submitted = true (mengikuti pola PBL/Jurnal)
    if (jadwal.jenis_jadwal === "csr") {
      const submitted = jadwal.penilaian_submitted === true;
      if (!submitted) {
        return total;
      }
    }

    // Untuk Kuliah Besar, realisasi hanya dihitung bila penilaian_submitted = true
    if (jadwal.jenis_jadwal === "kuliah_besar") {
      const submitted = jadwal.penilaian_submitted === true;
      if (!submitted) {
        return total;
      }
    }

    // Untuk Non Blok Non CSR, realisasi hanya dihitung bila status_konfirmasi = "bisa"
    if (
      jadwal.jenis_jadwal === "non_blok_non_csr" &&
      jadwal.status_konfirmasi !== "bisa"
    ) {
      return total;
    }

    // Untuk Materi/Agenda (baris Non Blok Non CSR), realisasi hanya dihitung bila status_konfirmasi = "bisa"
    if (
      (jadwal.jenis_jadwal === "materi" || jadwal.jenis_jadwal === "agenda") &&
      jadwal.status_konfirmasi !== "bisa"
    ) {
      return total;
    }

    // Untuk Seminar Pleno, realisasi hanya dihitung bila:
    // - penilaian_submitted = true DAN
    // - Untuk pengampu: absensi_hadir = true
    // - Untuk koordinator: cukup penilaian_submitted = true
    if (jadwal.jenis_jadwal === "seminar_pleno") {
      const submitted = jadwal.penilaian_submitted === true;
      if (!submitted) {
        return total;
      }

      // Cek apakah dosen adalah koordinator
      const dosenId = dosenData?.id;
      const isKoordinator =
        dosenId &&
        jadwal.koordinator_ids &&
        jadwal.koordinator_ids.includes(dosenId);

      // Jika koordinator, cukup sudah disubmit
      if (isKoordinator) {
        // Hitung jam berdasarkan jumlah sesi (1 sesi = 50 menit = 0.833 jam)
        const jamPerSesi = 50 / 60;
        return total + jadwal.jumlah_sesi * jamPerSesi;
      }

      // Jika pengampu, harus hadir juga
      const hadir = jadwal.absensi_hadir === true;
      if (!hadir) {
        return total;
      }
    }

    // Untuk Persamaan Persepsi, realisasi hanya dihitung bila:
    // - penilaian_submitted = true DAN
    // - Untuk pengampu: absensi_hadir = true
    // - Untuk koordinator: cukup penilaian_submitted = true
    if (jadwal.jenis_jadwal === "persamaan_persepsi") {
      const submitted = jadwal.penilaian_submitted === true;
      if (!submitted) {
        return total;
      }

      // Cek apakah dosen adalah koordinator
      const dosenId = dosenData?.id;
      const isKoordinator =
        dosenId &&
        jadwal.koordinator_ids &&
        jadwal.koordinator_ids.includes(dosenId);

      // Jika koordinator, cukup sudah disubmit
      if (isKoordinator) {
        // Hitung jam berdasarkan jumlah sesi (1 sesi = 50 menit = 0.833 jam)
        const jamPerSesi = 50 / 60;
        return total + jadwal.jumlah_sesi * jamPerSesi;
      }

      // Jika pengampu, harus hadir juga
      const hadir = jadwal.absensi_hadir === true;
      if (!hadir) {
        return total;
      }
    }

    // Hitung jam berdasarkan jumlah sesi (1 sesi = 50 menit = 0.833 jam)
    const jamPerSesi = 50 / 60; // 50 menit dalam jam
    return total + jadwal.jumlah_sesi * jamPerSesi;
  }, 0);

  // Statistik breakdown per jenis jadwal
  const statistikPerJenis = filteredJadwal.reduce((acc, jadwal) => {
    const jenis = jadwal.jenis_jadwal;

    // Untuk PBL & Jurnal Reading, realisasi hanya dihitung bila penilaian telah disubmit
    if (
      (jenis === "pbl" || jenis === "jurnal_reading") &&
      !jadwal.penilaian_submitted
    ) {
      return acc;
    }

    // Untuk Praktikum, realisasi hanya dihitung bila absensi_hadir = true dan penilaian_submitted = true
    // (Dosen harus hadir dan absensi dosen sudah disubmit)
    if (jenis === "praktikum") {
      // Handle boolean dan integer (0/1) dari backend
      const submitted = toBoolean(jadwal.penilaian_submitted);
      const hadir = toBoolean(jadwal.absensi_hadir);
      if (!submitted || !hadir) {
      return acc;
      }
    }

    // Untuk CSR, realisasi hanya dihitung bila penilaian_submitted = true (mengikuti pola PBL/Jurnal)
    if (jenis === "csr") {
      const submitted = jadwal.penilaian_submitted === true;
      if (!submitted) {
        return acc;
      }
    }

    // Untuk Kuliah Besar, realisasi hanya dihitung bila penilaian_submitted = true
    if (jenis === "kuliah_besar") {
      const submitted = jadwal.penilaian_submitted === true;
      if (!submitted) {
        return acc;
      }
    }

    // Untuk Non Blok Non CSR, realisasi hanya dihitung bila status_konfirmasi = "bisa"
    if (jenis === "non_blok_non_csr" && jadwal.status_konfirmasi !== "bisa") {
      return acc;
    }

    // Untuk Materi/Agenda (baris Non Blok Non CSR), realisasi hanya dihitung bila status_konfirmasi = "bisa"
    if (
      (jenis === "materi" || jenis === "agenda") &&
      jadwal.status_konfirmasi !== "bisa"
    ) {
      return acc;
    }

    // Untuk Seminar Pleno, realisasi hanya dihitung bila:
    // - penilaian_submitted = true DAN
    // - Untuk pengampu: absensi_hadir = true
    // - Untuk koordinator: cukup penilaian_submitted = true
    if (jenis === "seminar_pleno") {
      const submitted = jadwal.penilaian_submitted === true;
      if (!submitted) {
        return acc;
      }

      // Cek apakah dosen adalah koordinator
      const dosenId = dosenData?.id;
      const isKoordinator =
        dosenId &&
        jadwal.koordinator_ids &&
        jadwal.koordinator_ids.includes(dosenId);

      // Jika pengampu, harus hadir juga
      if (!isKoordinator) {
        const hadir = jadwal.absensi_hadir === true;
        if (!hadir) {
          return acc;
        }
      }
    }

    // Untuk Persamaan Persepsi, realisasi hanya dihitung bila:
    // - penilaian_submitted = true DAN
    // - Untuk pengampu: absensi_hadir = true
    // - Untuk koordinator: cukup penilaian_submitted = true
    if (jenis === "persamaan_persepsi") {
      const submitted = jadwal.penilaian_submitted === true;
      if (!submitted) {
        return acc;
      }

      // Cek apakah dosen adalah koordinator
      const dosenId = dosenData?.id;
      const isKoordinator =
        dosenId &&
        jadwal.koordinator_ids &&
        jadwal.koordinator_ids.includes(dosenId);

      // Jika pengampu, harus hadir juga
      if (!isKoordinator) {
        const hadir = jadwal.absensi_hadir === true;
        if (!hadir) {
          return acc;
        }
      }
    }

    if (!acc[jenis]) {
      acc[jenis] = { jumlah: 0, sesi: 0, jam: 0 };
    }
    acc[jenis].jumlah += 1; // Jumlah jadwal (penjadwalan)
    acc[jenis].sesi += jadwal.jumlah_sesi; // Jumlah sesi (x50 menit)

    // Hitung jam berdasarkan jumlah sesi (1 sesi = 50 menit = 0.833 jam)
    const jamPerSesi = 50 / 60; // 50 menit dalam jam
    acc[jenis].jam += jadwal.jumlah_sesi * jamPerSesi;

    return acc;
  }, {} as Record<string, { jumlah: number; sesi: number; jam: number }>);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-64 mb-4 animate-pulse"></div>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-80 animate-pulse"></div>
              <div className="ml-auto h-10 bg-gray-200 dark:bg-gray-700 rounded-lg w-32 animate-pulse"></div>
            </div>
          </div>

          {/* Informasi Dosen Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-48 mb-4 animate-pulse"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx}>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-24 mb-2 animate-pulse"></div>
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-lg w-48 animate-pulse"></div>
                  </div>
                ))}
              </div>
              <div className="space-y-4">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div key={idx}>
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-20 mb-2 animate-pulse"></div>
                    <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-lg w-56 animate-pulse"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Filter dan Statistik Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <div className="flex flex-col md:flex-row gap-4 mb-6">
              {Array.from({ length: 2 }).map((_, idx) => (
                <div key={idx} className="flex-1">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-32 mb-2 animate-pulse"></div>
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {Array.from({ length: 3 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-5 h-5 bg-gray-200 dark:bg-gray-600 rounded-full animate-pulse"></div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded-lg w-20 animate-pulse"></div>
                  </div>
                  <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded-lg w-16 animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Breakdown per Jenis Kegiatan Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 mb-8">
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-64 mb-4 animate-pulse"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div
                  key={idx}
                  className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="h-5 bg-gray-200 dark:bg-gray-600 rounded-full w-16 animate-pulse"></div>
                  </div>
                  <div className="space-y-1">
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-lg w-20 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-lg w-16 animate-pulse"></div>
                    <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded-lg w-24 animate-pulse"></div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Daftar Jadwal Mengajar Skeleton */}
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, sectionIdx) => (
              <div
                key={sectionIdx}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden"
              >
                {/* Header Section Skeleton */}
                <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 border-b border-gray-200 dark:border-gray-600">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded-full w-20 animate-pulse"></div>
                      <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded-lg w-16 animate-pulse"></div>
                    </div>
                    <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded-lg w-24 animate-pulse"></div>
                  </div>
                </div>

                {/* Table Skeleton */}
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                    <thead className="bg-gray-50 dark:bg-gray-700">
                      <tr>
                        {Array.from({ length: 9 }).map((_, idx) => (
                          <th key={idx} className="px-6 py-3">
                            <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded-lg w-20 animate-pulse"></div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {Array.from({ length: 3 }).map((_, rowIdx) => (
                        <tr key={rowIdx}>
                          {Array.from({ length: 9 }).map((_, colIdx) => (
                            <td key={colIdx} className="px-6 py-4">
                              <div className="h-4 bg-gray-200 dark:bg-gray-600 rounded-lg w-24 animate-pulse"></div>
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <button
            onClick={() => {
              // Jika dosen melihat riwayat mereka sendiri (tidak ada id di URL dan role adalah dosen)
              if (!id && dosenData?.role === "dosen") {
                navigate("/dashboard");
              } else {
                navigate(-1);
              }
            }}
            className="inline-flex items-center gap-2 text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 transition mb-4"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
            {!id && dosenData?.role === "dosen"
              ? "Kembali ke Dashboard Dosen"
              : "Kembali ke Daftar Dosen"}
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            {!id && dosenData?.role === "dosen"
              ? "Detail Riwayat Mengajar Saya"
              : "Laporan Jadwal Mengajar Dosen"}
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Riwayat mengajar dan kinerja dosen dalam kegiatan akademik
          </p>
        </div>
        <button
          onClick={exportPDF}
          className="w-fit flex items-center gap-2 px-5 text-sm py-2 bg-brand-500 text-white rounded-lg shadow hover:bg-brand-600 transition-colors font-semibold"
          title="Export ke PDF"
        >
          <FontAwesomeIcon icon={faDownload} className="w-4 h-4" />
          Export PDF
        </button>
      </div>

      {/* Informasi Dosen */}
      {dosenData && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6"
        >
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
              <FontAwesomeIcon
                icon={faUser}
                className="w-4 h-4 text-brand-500"
              />
            </div>
            Informasi Dosen
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nama Lengkap
                </label>
                <p className="text-gray-900 dark:text-white font-medium">
                  {dosenData.name}
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  NID
                </label>
                <p className="text-gray-900 dark:text-white">{dosenData.nid}</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  NIDN
                </label>
                <p className="text-gray-900 dark:text-white">
                  {dosenData.nidn}
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <FontAwesomeIcon icon={faEnvelope} className="w-4 h-4" />
                  Email
                </label>
                <p className="text-gray-900 dark:text-white">
                  {dosenData.email}
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <FontAwesomeIcon icon={faPhone} className="w-4 h-4" />
                  Telepon
                </label>
                <p className="text-gray-900 dark:text-white">
                  {dosenData.telp}
                </p>
              </div>

              <div>
                <label className="flex items-center gap-2 text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  <FontAwesomeIcon icon={faIdCard} className="w-4 h-4" />
                  Username
                </label>
                <p className="text-gray-900 dark:text-white">
                  {dosenData.username}
                </p>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
            <FontAwesomeIcon
              icon={faCalendarAlt}
              className="w-6 h-6 text-blue-500"
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Total Jadwal
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {filteredJadwal.length}
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
            <FontAwesomeIcon
              icon={faClock}
              className="w-6 h-6 text-green-500"
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Total Jam
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {formatJamMenit(totalJamMengajar)}
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
          <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center">
            <FontAwesomeIcon
              icon={faUsers}
              className="w-6 h-6 text-purple-500"
            />
          </div>
          <div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Mata Kuliah
            </div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">
              {new Set(filteredJadwal.map((j) => j.mata_kuliah_kode)).size}
            </div>
          </div>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] px-6 py-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto justify-end">
            <select
              value={filterSemester}
              onChange={(e) => setFilterSemester(e.target.value)}
              className="w-full md:w-44 h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Semua Semester</option>
              <option value="reguler">Semester Reguler</option>
              <option value="antara">Semester Antara</option>
            </select>
            <select
              value={filterJenis}
              onChange={(e) => setFilterJenis(e.target.value)}
              className="w-full md:w-44 h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Semua Jenis</option>
              <option value="kuliah_besar">Kuliah Besar</option>
              <option value="praktikum">Praktikum</option>
              <option value="jurnal_reading">Jurnal Reading</option>
              <option value="pbl">PBL</option>
              <option value="csr">CSR</option>
              <option value="persamaan_persepsi">Persamaan Persepsi</option>
              <option value="materi">Materi</option>
              <option value="agenda">Agenda</option>
              <option value="seminar_pleno">Seminar Pleno</option>
            </select>
          </div>
        </div>
      </div>

      {/* Breakdown per Jenis Kegiatan */}
      <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
          <div className="w-8 h-8 bg-brand-100 rounded-full flex items-center justify-center">
            <FontAwesomeIcon
              icon={faChartBar}
              className="w-4 h-4 text-brand-500"
            />
          </div>
          Breakdown per Jenis Kegiatan
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[
            {
              jenis: "pbl",
              label: "PBL",
              color:
                "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
            },
            {
              jenis: "kuliah_besar",
              label: "Kuliah Besar",
              color:
                "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
            },
            {
              jenis: "praktikum",
              label: "Praktikum",
              color:
                "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
            },
            {
              jenis: "jurnal_reading",
              label: "Jurnal Reading",
              color:
                "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
            },
            {
              jenis: "csr",
              label: "CSR",
              color:
                "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
            },
            {
              jenis: "persamaan_persepsi",
              label: "Persamaan Persepsi",
              color:
                "bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200",
            },
            {
              jenis: "materi",
              label: "Materi",
              color:
                "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
            },
            {
              jenis: "seminar_pleno",
              label: "Seminar Pleno",
              color:
                "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200",
            },
          ].map((jenisKegiatan) => {
            const dataJenis = statistikPerJenis[jenisKegiatan.jenis] || {
              jumlah: 0,
              sesi: 0,
              jam: 0,
            };

            return (
              <div
                key={jenisKegiatan.jenis}
                className="bg-white dark:bg-gray-700 rounded-lg p-4 border border-gray-200 dark:border-gray-600 hover:shadow-md transition"
              >
                <div className="flex items-center justify-between mb-2">
                  <span
                    className={`px-2 py-1 text-xs font-medium rounded-full ${jenisKegiatan.color}`}
                  >
                    {jenisKegiatan.label}
                  </span>
                </div>
                <div className="text-xs text-gray-600 dark:text-gray-400">
                  <div>{dataJenis.jumlah} pertemuan</div>
                  <div>{dataJenis.sesi} sesi</div>
                  <div>{formatJamMenit(dataJenis.jam)}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Table Section - Organized by Activity Type */}
      <div className="space-y-6">
        {(() => {
          // Kelompokkan jadwal berdasarkan jenis
          const jadwalByJenis = filteredJadwal.reduce((acc, jadwal) => {
            const jenis = jadwal.jenis_jadwal;
            if (!acc[jenis]) {
              acc[jenis] = [];
            }
            acc[jenis].push(jadwal);
            return acc;
          }, {} as Record<string, JadwalMengajar[]>);

          // Urutkan jenis berdasarkan prioritas
          const jenisOrder = [
            "pbl",
            "kuliah_besar",
            "praktikum",
            "jurnal_reading",
            "csr",
            "persamaan_persepsi",
            "materi",
            "agenda_khusus",
            "seminar_pleno",
          ];

          return (
            <>
              {jenisOrder.map((jenis) => {
                const jadwalList = jadwalByJenis[jenis];
                if (!jadwalList || jadwalList.length === 0) return null;

                return (
                  <div
                    key={jenis}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]"
                  >
                    {/* Header Section */}
                    <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b border-gray-100 dark:border-white/[0.05]">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`inline-flex px-3 py-1 text-sm font-semibold rounded-full ${getJenisJadwalColor(
                              jenis
                            )}`}
                          >
                            {getJenisJadwalLabel(jenis)}
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {jadwalList.length} jadwal
                          </span>
                        </div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">
                          Total:{" "}
                          {jadwalList.reduce(
                            (sum, j) => sum + j.jumlah_sesi,
                            0
                          )}{" "}
                          sesi
                        </div>
                      </div>
                    </div>

                    {/* Table untuk Section */}
                    <div
                      className="max-w-full overflow-x-auto hide-scroll"
                      style={{
                        scrollbarWidth: "none",
                        msOverflowStyle: "none",
                      }}
                    >
                      <style>{`
                        .max-w-full::-webkit-scrollbar { display: none; }
                        .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
                        .hide-scroll::-webkit-scrollbar { display: none; }
                      `}</style>
                      <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                        <thead className="bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                          <tr>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                              Tanggal
                            </th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                              Mata Kuliah
                            </th>
                            {jenis === "pbl" && (
                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Tipe PBL
                              </th>
                            )}
                            {jenis === "csr" && (
                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Jenis CSR
                              </th>
                            )}
                            {jenis === "csr" && (
                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Nomor CSR
                              </th>
                            )}
                            {jenis === "seminar_pleno" && (
                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Type
                              </th>
                            )}
                            {jenis === "seminar_pleno" && (
                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Status Absensi
                              </th>
                            )}
                            {jenis === "persamaan_persepsi" && (
                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Type
                              </th>
                            )}
                            {jenis === "persamaan_persepsi" && (
                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Status Absensi
                              </th>
                            )}
                            {jenis === "praktikum" && (
                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Hadir
                              </th>
                            )}
                            {(jenis === "praktikum" ||
                              jenis === "seminar_pleno" ||
                              jenis === "persamaan_persepsi") && (
                              <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                                Catatan
                              </th>
                            )}
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                              Detail
                            </th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                              Pukul
                            </th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                              Waktu
                            </th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                              Ruangan
                            </th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                              {jenis === "praktikum" ? "Kelas" : "Kelompok"}
                            </th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                              Sesi
                            </th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                              Semester Type
                            </th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                              Semester/Blok
                            </th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                              Aksi
                            </th>
                            <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                              Alasan
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {jadwalList.map((jadwal, idx) => (
                            <tr
                              key={jadwal.id}
                              className={
                                idx % 2 === 1
                                  ? "bg-gray-50 dark:bg-white/[0.02]"
                                  : "" +
                                    " hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors"
                              }
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">
                                {formatDate(jadwal.tanggal)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90 font-medium">
                                {jadwal.mata_kuliah_nama}
                              </td>
                              {jenis === "pbl" && (
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                  <span className="font-medium">
                                    {jadwal.pbl_tipe}
                                  </span>
                                </td>
                              )}
                              {jenis === "csr" && (
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                  <span className="font-medium">
                                    {jadwal.jenis_csr}
                                  </span>
                                </td>
                              )}
                              {jenis === "csr" && (
                                <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                  <span className="font-medium">
                                    {jadwal.nomor_csr || "-"}
                                  </span>
                                </td>
                              )}
                              {jenis === "seminar_pleno" && (
                                <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      jadwal.role_type === "koordinator"
                                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-700"
                                        : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700"
                                    }`}
                                  >
                                    {jadwal.role_type === "koordinator"
                                      ? "Koordinator"
                                      : "Pengampu"}
                                  </span>
                                </td>
                              )}
                              {jenis === "seminar_pleno" && (
                                <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      jadwal.absensi_status === "hadir"
                                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-700"
                                        : jadwal.absensi_status ===
                                          "tidak_hadir"
                                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700"
                                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700"
                                    }`}
                                  >
                                    {jadwal.absensi_status === "hadir"
                                      ? "Hadir"
                                      : jadwal.absensi_status === "tidak_hadir"
                                      ? "Tidak Hadir"
                                      : "Menunggu"}
                                  </span>
                                </td>
                              )}
                              {jenis === "persamaan_persepsi" && (
                                <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      jadwal.role_type === "koordinator"
                                        ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-700"
                                        : "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700"
                                    }`}
                                  >
                                    {jadwal.role_type === "koordinator"
                                      ? "Koordinator"
                                      : "Pengampu"}
                                  </span>
                                </td>
                              )}
                              {jenis === "persamaan_persepsi" && (
                                <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      jadwal.absensi_status === "hadir"
                                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-700"
                                        : jadwal.absensi_status ===
                                          "tidak_hadir"
                                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700"
                                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700"
                                    }`}
                                  >
                                    {jadwal.absensi_status === "hadir"
                                      ? "Hadir"
                                      : jadwal.absensi_status === "tidak_hadir"
                                      ? "Tidak Hadir"
                                      : "Menunggu"}
                                  </span>
                                </td>
                              )}
                              {jenis === "praktikum" && (
                                <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">
                                  <span
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                      jadwal.absensi_status === "hadir"
                                        ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-700"
                                        : jadwal.absensi_status === "tidak_hadir"
                                        ? "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700"
                                        : "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700"
                                    }`}
                                  >
                                    {jadwal.absensi_status === "hadir"
                                      ? "Hadir"
                                      : jadwal.absensi_status === "tidak_hadir"
                                      ? "Tidak Hadir"
                                      : "Menunggu"}
                                  </span>
                                </td>
                              )}
                              {(jenis === "praktikum" ||
                                jenis === "seminar_pleno" ||
                                jenis === "persamaan_persepsi") && (
                                <td className="px-6 py-4 text-gray-900 dark:text-white/90">
                                  {jadwal.absensi_catatan ? (
                                    <div
                                      className="text-xs max-w-xs truncate"
                                      title={jadwal.absensi_catatan}
                                    >
                                      {jadwal.absensi_catatan}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-400">
                                      -
                                    </div>
                                  )}
                                </td>
                              )}
                              <td className="px-6 py-4 min-w-[300px] text-gray-900 dark:text-white/90">
                                <div className="space-y-1">
                                  {jadwal.topik && (
                                    <div>
                                      <span className="font-medium">
                                        Topik:
                                      </span>{" "}
                                      {jadwal.topik}
                                    </div>
                                  )}
                                  {jadwal.materi && (
                                    <div>
                                      <span className="font-medium">
                                        Materi:
                                      </span>{" "}
                                      {jadwal.materi}
                                    </div>
                                  )}
                                  {jadwal.agenda && (
                                    <div>
                                      <span className="font-medium">
                                        Agenda:
                                      </span>{" "}
                                      {jadwal.agenda}
                                    </div>
                                  )}
                                  {jadwal.modul_pbl && (
                                    <div>
                                      <span className="font-medium">
                                        Modul PBL:
                                      </span>{" "}
                                      {jadwal.modul_pbl}
                                    </div>
                                  )}
                                  {jadwal.kategori_csr && (
                                    <div>
                                      <span className="font-medium">
                                        Kategori CSR:
                                      </span>{" "}
                                      {jadwal.kategori_csr}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                {jadwal.jam_mulai} - {jadwal.jam_selesai}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                {jadwal.jumlah_sesi} x 50 menit
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                {jadwal.ruangan_nama}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                {jenis === "kuliah_besar"
                                  ? jadwal.kelompok_besar?.semester
                                    ? `Kelompok Besar Semester ${jadwal.kelompok_besar.semester}`
                                    : jadwal.kelompok_besar?.nama_kelompok
                                    ? jadwal.kelompok_besar.nama_kelompok
                                    : jadwal.kelompok_kecil
                                    ? jadwal.kelompok_kecil
                                    : "-"
                                  : jadwal.kelompok_kecil || "-"}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                {jadwal.jumlah_sesi}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                <span
                                  className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                                    jadwal.semester_type === "reguler"
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200"
                                      : "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  }`}
                                >
                                  {jadwal.semester_type === "reguler"
                                    ? "Reguler"
                                    : "Antara"}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">
                                <div>Semester {jadwal.semester}</div>
                                {(() => {
                                  const blokMataKuliah = getBlokFromMataKuliah(
                                    jadwal.mata_kuliah_kode
                                  );
                                  return blokMataKuliah &&
                                    blokMataKuliah !== "null" &&
                                    blokMataKuliah !== "" ? (
                                    <div className="text-xs">
                                      Blok {blokMataKuliah}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-400">
                                      -
                                    </div>
                                  );
                                })()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">
                                {(() => {
                                  const status =
                                    jadwal.status_konfirmasi ||
                                    "belum_konfirmasi";
                                  const reschedule =
                                    jadwal.status_reschedule || null;

                                  // Gunakan logika yang sama dengan DashboardDosen.tsx
                                  // Prioritas: status_reschedule terlebih dahulu, kemudian status_konfirmasi

                                  // Jika ada status_reschedule = "approved", prioritaskan itu
                                  if (reschedule === "approved") {
                                    if (status === "bisa") {
                                      return (
                                        <div className="min-w-[180px]">
                                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-700">
                                            <FontAwesomeIcon
                                              icon={faCheckCircle}
                                              className="w-3 h-3 mr-1"
                                            />
                                            Bisa (Reschedule Disetujui)
                                          </div>
                                        </div>
                                      );
                                    } else if (status === "tidak_bisa") {
                                      return (
                                        <div className="min-w-[180px]">
                                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700">
                                            <FontAwesomeIcon
                                              icon={faTimesCircle}
                                              className="w-3 h-3 mr-1"
                                            />
                                            Tidak Bisa (Reschedule Disetujui)
                                          </div>
                                        </div>
                                      );
                                    } else {
                                      return (
                                        <div className="min-w-[180px]">
                                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
                                            <FontAwesomeIcon
                                              icon={faCheckCircle}
                                              className="w-3 h-3 mr-1"
                                            />
                                            Reschedule Disetujui - Konfirmasi
                                            Ulang
                                          </div>
                                        </div>
                                      );
                                    }
                                  }

                                  // Jika tidak ada status_reschedule = "approved", gunakan logika normal
                                  switch (status) {
                                    case "bisa":
                                      return (
                                        <div className="min-w-[180px]">
                                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-700">
                                            <FontAwesomeIcon
                                              icon={faCheckCircle}
                                              className="w-3 h-3 mr-1"
                                            />
                                            Bisa
                                          </div>
                                        </div>
                                      );
                                    case "tidak_bisa":
                                      return (
                                        <div className="min-w-[180px]">
                                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700">
                                            <FontAwesomeIcon
                                              icon={faTimesCircle}
                                              className="w-3 h-3 mr-1"
                                            />
                                            Tidak Bisa (Diganti Dosen Lain)
                                          </div>
                                        </div>
                                      );
                                    case "waiting_reschedule":
                                      if (reschedule === "rejected") {
                                        return (
                                          <div className="min-w-[180px]">
                                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700">
                                              <FontAwesomeIcon
                                                icon={faTimesCircle}
                                                className="w-3 h-3 mr-1"
                                              />
                                              Reschedule Ditolak
                                            </div>
                                          </div>
                                        );
                                      } else {
                                        return (
                                          <div className="min-w-[180px]">
                                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700">
                                              <FontAwesomeIcon
                                                icon={faClock}
                                                className="w-3 h-3 mr-1"
                                              />
                                              Menunggu Reschedule
                                            </div>
                                          </div>
                                        );
                                      }
                                    case "belum_konfirmasi":
                                      if (reschedule === "rejected") {
                                        return (
                                          <div className="min-w-[180px]">
                                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700">
                                              <FontAwesomeIcon
                                                icon={faTimesCircle}
                                                className="w-3 h-3 mr-1"
                                              />
                                              Reschedule Ditolak
                                            </div>
                                          </div>
                                        );
                                      } else {
                                        return (
                                          <div className="min-w-[180px]">
                                            <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                                              <FontAwesomeIcon
                                                icon={faClock}
                                                className="w-3 h-3 mr-1"
                                              />
                                              Menunggu Konfirmasi
                                            </div>
                                          </div>
                                        );
                                      }
                                    default:
                                      return (
                                        <div className="min-w-[180px]">
                                          <div className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700">
                                            <FontAwesomeIcon
                                              icon={faClock}
                                              className="w-3 h-3 mr-1"
                                            />
                                            Menunggu Konfirmasi
                                          </div>
                                        </div>
                                      );
                                  }
                                })()}
                              </td>
                              <td className="px-6 py-4 text-gray-900 dark:text-white/90">
                                {(() => {
                                  const alasan =
                                    jadwal.alasan_konfirmasi ||
                                    jadwal.reschedule_reason ||
                                    null;

                                  return alasan ? (
                                    <div
                                      className="text-xs max-w-xs truncate"
                                      title={alasan}
                                    >
                                      {alasan}
                                    </div>
                                  ) : (
                                    <div className="text-xs text-gray-400">
                                      -
                                    </div>
                                  );
                                })()}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                );
              })}

              {/* Jika tidak ada jadwal sama sekali */}
              {Object.keys(jadwalByJenis).length === 0 && (
                <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] p-8 text-center">
                  <FontAwesomeIcon
                    icon={faCalendarAlt}
                    className="w-12 h-12 text-gray-400 mx-auto mb-4"
                  />
                  <p className="text-gray-500 dark:text-gray-400">
                    Tidak ada jadwal mengajar
                  </p>
                </div>
              )}
            </>
          );
        })()}
      </div>
    </div>
  );
}
