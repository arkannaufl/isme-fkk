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
} from "@fortawesome/free-solid-svg-icons";
import { motion } from "framer-motion";
import api, { handleApiError } from "../utils/api";
import jsPDF from "jspdf";

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
    | "agenda";
  topik?: string;
  materi?: string;
  agenda?: string;
  ruangan_nama: string;
  kelompok_kecil?: string;
  kelompok_besar_id?: number | null;
  modul_pbl?: string;
  pbl_tipe?: string;
  kategori_csr?: string;
  jenis_csr?: string;
  nomor_csr?: string;
  jumlah_sesi: number;
  semester: string;
  blok?: string;
  semester_type?: "reguler" | "antara";
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
    Record<string, { mata_kuliah: any; pbls: any[] }>
  >({});
  const [activeSemester, setActiveSemester] = useState<string | null>(null);
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
            // Fetch semua jadwal tanpa filter semester_type
            const jadwalAllResponse = await api.get(
              `/users/${dosenId}/jadwal-mengajar`
            );
            const jadwalAll = jadwalAllResponse.data || [];

            // Tambahkan informasi semester type berdasarkan data
            const allJadwal = jadwalAll.map((jadwal: any) => ({
              ...jadwal,
              semester_type: jadwal.semester_type || "reguler", // Default ke reguler jika tidak ada
            }));

            setJadwalMengajar(allJadwal);

            // Debug jadwalMengajar untuk melihat semester
            console.log("=== DEBUG jadwalMengajar ===");
            console.log("allJadwal:", allJadwal);
            allJadwal.forEach((jadwal, index) => {
              console.log(`Jadwal ${index}:`, {
                jenis_jadwal: jadwal.jenis_jadwal,
                mata_kuliah_kode: jadwal.mata_kuliah_kode,
                semester: jadwal.semester,
                semester_type: jadwal.semester_type,
              });
            });
            console.log("=== END DEBUG jadwalMengajar ===");

            // Fetch data mata kuliah untuk mendapatkan informasi blok
            const uniqueMataKuliahKodes = [
              ...new Set(allJadwal.map((j) => j.mata_kuliah_kode)),
            ];

            console.log("=== DEBUG mataKuliahData fetching ===");
            console.log("uniqueMataKuliahKodes:", uniqueMataKuliahKodes);
            const mataKuliahPromises = uniqueMataKuliahKodes.map(
              async (kode: string) => {
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

            mataKuliahResults.forEach(({ kode, data }: { kode: string; data: any }) => {
              if (data && kode) {
                mataKuliahMap[kode] = {
                  blok: data.blok,
                  nama: data.nama,
                };
              }
            });

            console.log("mataKuliahResults:", mataKuliahResults);
            console.log("mataKuliahMap:", mataKuliahMap);
            console.log("=== END DEBUG mataKuliahData fetching ===");

            // Debug tambahan untuk melihat semua mata kuliah yang diajarkan dosen
            console.log("=== DEBUG All Mata Kuliah Dosen ===");
            console.log(
              "All jadwal mata_kuliah_kode:",
              allJadwal.map((j) => j.mata_kuliah_kode)
            );
            console.log("Unique mata_kuliah_kode:", uniqueMataKuliahKodes);
            console.log(
              "Mata kuliah yang berhasil di-fetch:",
              Object.keys(mataKuliahMap)
            );
            console.log("=== END DEBUG All Mata Kuliah Dosen ===");

            setMataKuliahData(mataKuliahMap);

            // Fetch active semester data
            try {
              const activeSemesterResponse = await api.get(
                "/tahun-ajaran/active"
              );
              console.log("=== DEBUG Active Semester ===");
              console.log(
                "activeSemesterResponse.data:",
                activeSemesterResponse.data
              );
              if (activeSemesterResponse.data?.semesters?.[0]) {
                const currentSemester =
                  activeSemesterResponse.data.semesters[0];
                setActiveSemester(currentSemester.jenis);
                console.log("Active semester jenis:", currentSemester.jenis);
              }
              console.log("=== END DEBUG Active Semester ===");
            } catch (semesterError) {
              console.error("Error fetching active semester:", semesterError);
              setActiveSemester(null);
            }

            // Fetch PBL data untuk perencanaan
            try {
              const pblResponse = await api.get("/pbls/all");
              console.log("=== DEBUG PBL API Response ===");
              console.log("pblResponse.data:", pblResponse.data);
              console.log(
                "Keys in pblResponse.data:",
                Object.keys(pblResponse.data || {})
              );
              console.log("=== END DEBUG PBL API ===");
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

    console.log("=== DEBUG getPblSesiPerBlok ===");
    console.log("blokNumber:", blokNumber);
    console.log("jadwalMengajar:", jadwalMengajar);
    console.log("mataKuliahData:", mataKuliahData);
    console.log("pblData:", pblData);

    // 1. Ambil jadwal mengajar dosen yang jenis_jadwal = "pbl" untuk blok tertentu
    const jadwalPbl = jadwalMengajar.filter((j) => j.jenis_jadwal === "pbl");
    console.log("jadwalPbl:", jadwalPbl);

    // 2. Filter jadwal berdasarkan blok yang diminta
    console.log(`=== DEBUG Filtering Jadwal untuk Blok ${blokNumber} ===`);
    console.log("Available mataKuliahData keys:", Object.keys(mataKuliahData));
    console.log(
      "jadwalPbl mata_kuliah_kode:",
      jadwalPbl.map((j) => j.mata_kuliah_kode)
    );

    const jadwalBlok = jadwalPbl.filter((jadwal) => {
      const mataKuliah = mataKuliahData[jadwal.mata_kuliah_kode];
      console.log(`Checking ${jadwal.mata_kuliah_kode}:`, {
        mataKuliah,
        hasMataKuliah: !!mataKuliah,
        blok: mataKuliah?.blok,
        targetBlok: blokNumber,
        matches: mataKuliah && mataKuliah.blok === blokNumber,
      });
      return mataKuliah && mataKuliah.blok === blokNumber;
    });
    console.log(`jadwalBlok untuk blok ${blokNumber}:`, jadwalBlok);
    console.log(`=== END DEBUG Filtering Jadwal untuk Blok ${blokNumber} ===`);

    // 3. Ambil semester yang diajarkan dosen di blok tersebut
    const dosenSemesterDiBlok: string[] = [];
    jadwalBlok.forEach((jadwal) => {
      console.log(`--- Debug jadwal untuk blok ${blokNumber} ---`);
      console.log("jadwal:", jadwal);
      console.log("jadwal.semester:", jadwal.semester);
      console.log("jadwal.semester_type:", jadwal.semester_type);

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
          console.log(
            `✓ Found semester for ${jadwal.mata_kuliah_kode}: ${semesterValue}`
          );
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
              console.log(
                `✓ Found semester from PBL data for ${jadwal.mata_kuliah_kode}: ${semesterValue}`
              );
            }
          }
        }
      }

      console.log("semesterValue:", semesterValue);

      if (semesterValue && !dosenSemesterDiBlok.includes(semesterValue)) {
        dosenSemesterDiBlok.push(semesterValue);
        console.log(`✓ Added ${semesterValue} to dosenSemesterDiBlok`);
      } else {
        console.log(`✗ Skipped ${semesterValue} (already exists or empty)`);
      }
    });
    console.log(`dosenSemesterDiBlok ${blokNumber}:`, dosenSemesterDiBlok);

    // 4. Ambil data PBL dari pblData untuk blok yang diminta
    console.log(`=== DEBUG PBL Data untuk Blok ${blokNumber} ===`);
    console.log("Available PBL data keys:", Object.keys(pblData));

    Object.values(pblData).forEach((item) => {
      if (item.mata_kuliah && item.mata_kuliah.blok === blokNumber) {
        const mataKuliahKode = item.mata_kuliah.kode;
        const mataKuliahSemester = item.mata_kuliah.semester;

        console.log(`--- Processing ${mataKuliahKode} ---`);
        console.log("item.mata_kuliah:", item.mata_kuliah);
        console.log("mataKuliahSemester:", mataKuliahSemester);
        console.log("dosenSemesterDiBlok:", dosenSemesterDiBlok);
        console.log("item.pbls:", item.pbls);

        // 5. Validasi: hanya hitung jika semester mata kuliah sama dengan semester yang diajarkan dosen
        if (dosenSemesterDiBlok.includes(mataKuliahSemester) && item.pbls) {
          const modulCount = item.pbls.length;
          const sesiPerItem = modulCount * 5;
          console.log(
            `✓ ${mataKuliahKode} (Blok ${blokNumber}, Semester ${mataKuliahSemester}): ${modulCount} modul × 5 = ${sesiPerItem} sesi`
          );
          totalSesi += sesiPerItem;
        } else {
          console.log(
            `✗ Semester ${mataKuliahSemester} tidak diajarkan dosen atau tidak ada PBL data`
          );
        }
      } else if (item.mata_kuliah) {
        console.log(
          `--- Skipping ${item.mata_kuliah.kode} (Blok ${item.mata_kuliah.blok}, not target blok ${blokNumber}) ---`
        );
      }
    });

    console.log(`=== END DEBUG PBL Data untuk Blok ${blokNumber} ===`);

    console.log(
      `Total sesi untuk blok ${blokNumber} (filtered by dosen's semester in block): ${totalSesi}`
    );
    console.log("=== END DEBUG ===");
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

    console.log(`=== DEBUG Jurnal Reading Blok ${blokNumber} ===`);
    console.log("jurnalJadwalBlok:", jurnalJadwalBlok);
    console.log("jumlahFileJurnal:", jumlahFileJurnal);
    console.log("perencanaan:", perencanaan);
    console.log("=== END DEBUG Jurnal Reading Blok ===");

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

    console.log("=== DEBUG Total Jurnal Reading ===");
    console.log("jurnalJadwal:", jurnalJadwal);
    console.log("jumlahFileJurnal:", jumlahFileJurnal);
    console.log("perencanaan:", perencanaan);
    console.log("=== END DEBUG Total Jurnal Reading ===");

    return perencanaan;
  };

  // Function to calculate total PBL sesi for all blocks
  const getTotalPblSesi = (): number => {
    let totalSesi = 0;

    console.log("=== DEBUG getTotalPblSesi ===");
    console.log("jadwalMengajar:", jadwalMengajar);
    console.log("mataKuliahData:", mataKuliahData);
    console.log("pblData:", pblData);

    // 1. Ambil jadwal mengajar dosen yang jenis_jadwal = "pbl"
    const jadwalPbl = jadwalMengajar.filter((j) => j.jenis_jadwal === "pbl");
    console.log("jadwalPbl:", jadwalPbl);

    // 2. Buat mapping semester dosen per blok
    const dosenSemesterPerBlok: Record<number, string[]> = {};
    jadwalPbl.forEach((jadwal) => {
      const mataKuliah = mataKuliahData[jadwal.mata_kuliah_kode];
      console.log(`--- Debug jadwalPbl ---`);
      console.log("jadwal:", jadwal);
      console.log("mataKuliah:", mataKuliah);
      console.log("jadwal.semester:", jadwal.semester);
      console.log("jadwal.semester_type:", jadwal.semester_type);

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
            console.log(
              `✓ Found semester for ${jadwal.mata_kuliah_kode}: ${semesterValue}`
            );
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
                console.log(
                  `✓ Found semester from PBL data for ${jadwal.mata_kuliah_kode}: ${semesterValue}`
                );
              }
            }
          }
        }

        console.log("semesterValue:", semesterValue);

        if (semesterValue) {
          if (!dosenSemesterPerBlok[mataKuliah.blok]) {
            dosenSemesterPerBlok[mataKuliah.blok] = [];
          }
          if (!dosenSemesterPerBlok[mataKuliah.blok].includes(semesterValue)) {
            dosenSemesterPerBlok[mataKuliah.blok].push(semesterValue);
            console.log(`✓ Added ${semesterValue} to blok ${mataKuliah.blok}`);
          }
        } else {
          console.log(`✗ No semester value for ${jadwal.mata_kuliah_kode}`);
        }
      }
    });
    console.log("dosenSemesterPerBlok:", dosenSemesterPerBlok);

    // 3. Hitung PBL dari pblData dengan validasi semester per blok
    Object.values(pblData).forEach((item) => {
      if (item.mata_kuliah && item.mata_kuliah.blok) {
        const mataKuliahKode = item.mata_kuliah.kode;
        const mataKuliahBlok = item.mata_kuliah.blok;
        const mataKuliahSemester = item.mata_kuliah.semester;
        const dosenSemesterDiBlok = dosenSemesterPerBlok[mataKuliahBlok] || [];

        console.log(`--- Processing ${mataKuliahKode} ---`);
        console.log("item.mata_kuliah:", item.mata_kuliah);
        console.log("dosenSemesterDiBlok:", dosenSemesterDiBlok);
        console.log("item.pbls:", item.pbls);

        // 4. Validasi: hanya hitung jika semester mata kuliah sama dengan semester yang diajarkan dosen di blok tersebut
        if (dosenSemesterDiBlok.includes(mataKuliahSemester) && item.pbls) {
          const modulCount = item.pbls.length;
          const sesiPerItem = modulCount * 5;
          console.log(
            `✓ ${mataKuliahKode} (Blok ${mataKuliahBlok}, Semester ${mataKuliahSemester}): ${modulCount} modul × 5 = ${sesiPerItem} sesi`
          );
          totalSesi += sesiPerItem;
        } else {
          console.log(
            `✗ Semester ${mataKuliahSemester} tidak diajarkan dosen di blok ${mataKuliahBlok} atau tidak ada PBL data`
          );
        }
      }
    });

    console.log(
      `Total sesi semua blok (filtered by dosen's semester per block): ${totalSesi}`
    );
    console.log("=== END DEBUG getTotalPblSesi ===");
    return totalSesi;
  };

  // Fungsi untuk menghitung breakdown PBL per tipe
  const getPBLBreakdown = () => {
    const pblJadwal = filteredJadwal.filter((j) => j.jenis_jadwal === "pbl");
    const breakdown: {
      nama: string;
      jumlah: number;
      sesi: number;
      jam: number;
    }[] = [];

    // Kelompokkan berdasarkan tipe PBL (field pbl_tipe)
    const tipeGroups = pblJadwal.reduce((acc, jadwal) => {
      const tipeKey = jadwal.pbl_tipe || "PBL";
      if (!acc[tipeKey]) {
        acc[tipeKey] = { jumlah: 0, sesi: 0, jam: 0 };
      }

      // Set jumlah pertemuan = 1 untuk setiap tipe PBL (bukan akumulasi jadwal)
      acc[tipeKey].jumlah = 1;

      // Set sesi = jumlah_sesi dari jadwal pertama untuk setiap tipe PBL (bukan akumulasi)
      if (acc[tipeKey].sesi === 0) {
        acc[tipeKey].sesi = jadwal.jumlah_sesi;
      }

      // Hitung jam berdasarkan jumlah sesi (1 sesi = 50 menit = 0.833 jam)
      const jamPerSesi = 50 / 60; // 50 menit dalam jam
      if (acc[tipeKey].jam === 0) {
        acc[tipeKey].jam = jadwal.jumlah_sesi * jamPerSesi;
      }

      return acc;
    }, {} as Record<string, { jumlah: number; sesi: number; jam: number }>);

    // Validasi dan tampilkan PBL 1 dan PBL 2 berdasarkan data yang ada
    const pblTypes = ["PBL 1", "PBL 2"];

    pblTypes.forEach((pblType) => {
      if (tipeGroups[pblType]) {
        // Jika ada data untuk tipe PBL ini, tambahkan ke breakdown
        breakdown.push({
          nama: pblType,
          jumlah: tipeGroups[pblType].jumlah,
          sesi: tipeGroups[pblType].sesi,
          jam: tipeGroups[pblType].jam,
        });
      } else {
        // Jika tidak ada data, tampilkan 0
        breakdown.push({
          nama: pblType,
          jumlah: 0,
          sesi: 0,
          jam: 0,
        });
      }
    });

    return breakdown;
  };

  // Fungsi untuk menghitung breakdown PBL per tipe per blok
  const getPBLBreakdownPerBlok = (blokNumber: number) => {
    // Filter jadwal PBL untuk blok tertentu
    const pblJadwalBlok = filteredJadwal.filter((j) => {
      const blokMataKuliah = getBlokFromMataKuliah(j.mata_kuliah_kode);
      return (
        j.jenis_jadwal === "pbl" && blokMataKuliah === blokNumber.toString()
      );
    });

    const breakdown: {
      nama: string;
      jumlah: number;
      sesi: number;
      jam: number;
    }[] = [];

    // Kelompokkan berdasarkan tipe PBL (field pbl_tipe)
    const tipeGroups = pblJadwalBlok.reduce((acc, jadwal) => {
      const tipeKey = jadwal.pbl_tipe || "PBL";
      if (!acc[tipeKey]) {
        acc[tipeKey] = { jumlah: 0, sesi: 0, jam: 0 };
      }

      // Set jumlah pertemuan = 1 untuk setiap tipe PBL (bukan akumulasi jadwal)
      acc[tipeKey].jumlah = 1;

      // Set sesi = jumlah_sesi dari jadwal pertama untuk setiap tipe PBL (bukan akumulasi)
      if (acc[tipeKey].sesi === 0) {
        acc[tipeKey].sesi = jadwal.jumlah_sesi;
      }

      // Hitung jam berdasarkan jumlah sesi (1 sesi = 50 menit = 0.833 jam)
      const jamPerSesi = 50 / 60; // 50 menit dalam jam
      if (acc[tipeKey].jam === 0) {
        acc[tipeKey].jam = jadwal.jumlah_sesi * jamPerSesi;
      }

      return acc;
    }, {} as Record<string, { jumlah: number; sesi: number; jam: number }>);

    // Hanya tampilkan PBL types yang ada di blok ini
    Object.entries(tipeGroups).forEach(([nama, data]) => {
      // Hanya tampilkan PBL 1 dan PBL 2 yang ada datanya
      if (nama === "PBL 1" || nama === "PBL 2") {
        breakdown.push({
          nama: nama,
          jumlah: data.jumlah,
          sesi: data.sesi,
          jam: data.jam,
        });
      }
    });

    return breakdown;
  };

  // Fungsi untuk menghitung data per blok
  const getBlokData = (blokNumber: number) => {
    const jadwalBlok = filteredJadwal.filter((j) => {
      // Untuk CSR, gunakan nomor_csr untuk menentukan blok
      if (j.jenis_jadwal === "csr") {
        if (j.nomor_csr) {
          const parts = j.nomor_csr.split(".");
          if (parts.length === 2) {
            const csrBlok = parseInt(parts[1]);
            return csrBlok === blokNumber;
          }
        }
        return false;
      }

      // Untuk jenis jadwal lainnya, gunakan getBlokFromMataKuliah
      const blokMataKuliah = getBlokFromMataKuliah(j.mata_kuliah_kode);
      return blokMataKuliah === blokNumber.toString();
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

  // Fungsi untuk menghitung breakdown CSR per jenis
  const getCSRBreakdown = () => {
    const csrJadwal = filteredJadwal.filter((j) => j.jenis_jadwal === "csr");
    const breakdown: {
      nama: string;
      jumlah: number;
      sesi: number;
      jam: number;
    }[] = [];

    // Kelompokkan berdasarkan jenis CSR (field jenis_csr)
    const jenisGroups = csrJadwal.reduce((acc, jadwal) => {
      const jenisKey = jadwal.jenis_csr || "CSR";
      if (!acc[jenisKey]) {
        acc[jenisKey] = { jumlah: 0, sesi: 0, jam: 0 };
      }

      acc[jenisKey].jumlah += 1;
      acc[jenisKey].sesi += jadwal.jumlah_sesi;

      // Hitung jam berdasarkan jumlah sesi (1 sesi = 50 menit = 0.833 jam)
      const jamPerSesi = 50 / 60; // 50 menit dalam jam
      acc[jenisKey].jam += jadwal.jumlah_sesi * jamPerSesi;

      return acc;
    }, {} as Record<string, { jumlah: number; sesi: number; jam: number }>);

    // Convert ke array dan urutkan
    Object.entries(jenisGroups).forEach(([nama, data]) => {
      breakdown.push({
        nama: nama === "reguler" ? "CSR Reguler" : "CSR Responsi",
        jumlah: data.jumlah,
        sesi: data.sesi,
        jam: data.jam,
      });
    });

    // Urutkan: Reguler dulu, lalu Responsi
    breakdown.sort((a, b) => {
      if (a.nama.includes("Reguler")) return -1;
      if (b.nama.includes("Reguler")) return 1;
      return 0;
    });

    return breakdown;
  };

  // Fungsi untuk menghitung breakdown CSR per jenis per blok
  const getCSRBreakdownPerBlok = (blokNumber: number) => {
    // Filter jadwal CSR untuk blok tertentu berdasarkan nomor_csr
    const csrJadwalBlok = filteredJadwal.filter((j) => {
      if (j.jenis_jadwal !== "csr") return false;

      // Filter berdasarkan nomor_csr (format: X.Y dimana Y = blok)
      if (j.nomor_csr) {
        const parts = j.nomor_csr.split(".");
        if (parts.length === 2) {
          const csrBlok = parseInt(parts[1]);
          return csrBlok === blokNumber;
        }
      }

      return false;
    });

    const breakdown: {
      nama: string;
      jumlah: number;
      sesi: number;
      jam: number;
    }[] = [];

    // Gabungkan semua CSR (reguler + responsi) menjadi satu
    if (csrJadwalBlok.length > 0) {
      const totalJumlah = csrJadwalBlok.length;
      const totalSesi = csrJadwalBlok.reduce(
        (sum, jadwal) => sum + jadwal.jumlah_sesi,
        0
      );

      // Hitung jam berdasarkan jumlah sesi (1 sesi = 50 menit = 0.833 jam)
      const jamPerSesi = 50 / 60; // 50 menit dalam jam
      const totalJam = totalSesi * jamPerSesi;

      breakdown.push({
        nama: "CSR",
        jumlah: totalJumlah,
        sesi: totalSesi,
        jam: totalJam,
      });
    }

    return breakdown;
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
      let page = 1;
      const maxPageHeight = doc.internal.pageSize.height - margin;

      const addNewPage = () => {
        doc.addPage();
        yPos = margin;
        page++;
      };

      const addText = (text: string, x: number, y: number, options?: any) => {
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
          const response = await fetch("/images/logo/logo.svg");
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

      // Header Sesi(Realisasi) with special formatting
      doc.text("Sesi", colSesi, yPos);
      doc.setFontSize(10); // Font sama dengan Realisasi
      doc.setFont("times", "normal"); // Tidak bold
      doc.text("(Realisasi)", colSesi, yPos + 4); // Below Sesi
      doc.setFontSize(12); // Restore font size
      doc.setFont("times", "bold"); // Restore bold
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
        // Kolom Perencanaan: "-" untuk kuliah_besar, praktikum, materi; sesi untuk PBL; "0" untuk yang lain
        let perencanaanValue = "0";
        if (
          jenisKegiatan.jenis === "kuliah_besar" ||
          jenisKegiatan.jenis === "praktikum" ||
          jenisKegiatan.jenis === "materi"
        ) {
          perencanaanValue = "-";
        } else if (jenisKegiatan.jenis === "pbl") {
          perencanaanValue = getTotalPblSesi().toString();
        } else if (jenisKegiatan.jenis === "jurnal_reading") {
          perencanaanValue = getTotalJurnalReadingPerencanaan().toString();
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

        // Header Sesi(Realisasi) with special formatting
        doc.text("Sesi", colSesi, yPos);
        doc.setFontSize(10); // Font sama dengan Realisasi
        doc.setFont("times", "normal"); // Tidak bold
        doc.text("(Realisasi)", colSesi, yPos + 4); // Below Sesi
        doc.setFontSize(12); // Restore font size
        doc.setFont("times", "bold"); // Restore bold
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
          // Kolom Perencanaan: "-" untuk kuliah_besar, praktikum, materi; sesi untuk PBL; "0" untuk yang lain
          let perencanaanValue = "0";
          if (
            jenisKegiatan.jenis === "kuliah_besar" ||
            jenisKegiatan.jenis === "praktikum" ||
            jenisKegiatan.jenis === "materi"
          ) {
            perencanaanValue = "-";
          } else if (jenisKegiatan.jenis === "pbl") {
            console.log(
              `=== DEBUG PDF Perencanaan Blok ${blokNumber} (Halaman 3) ===`
            );
            const sesiBlok = getPblSesiPerBlok(blokNumber);
            perencanaanValue = sesiBlok.toString();
            console.log(
              `Perencanaan value untuk blok ${blokNumber}: ${perencanaanValue}`
            );
            console.log("=== END DEBUG PDF Perencanaan ===");
          } else if (jenisKegiatan.jenis === "jurnal_reading") {
            const perencanaanJurnal =
              getJurnalReadingPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanJurnal.toString();
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

        // Header Sesi(Realisasi) with special formatting
        doc.text("Sesi", colSesi, yPos);
        doc.setFontSize(10); // Font sama dengan Realisasi
        doc.setFont("times", "normal"); // Tidak bold
        doc.text("(Realisasi)", colSesi, yPos + 4); // Below Sesi
        doc.setFontSize(12); // Restore font size
        doc.setFont("times", "bold"); // Restore bold
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
          // Kolom Perencanaan: "-" untuk kuliah_besar, praktikum, materi; sesi untuk PBL; "0" untuk yang lain
          let perencanaanValue = "0";
          if (
            jenisKegiatan.jenis === "kuliah_besar" ||
            jenisKegiatan.jenis === "praktikum" ||
            jenisKegiatan.jenis === "materi"
          ) {
            perencanaanValue = "-";
          } else if (jenisKegiatan.jenis === "pbl") {
            console.log(
              `=== DEBUG PDF Perencanaan Blok ${blokNumber} (Halaman 4) ===`
            );
            const sesiBlok = getPblSesiPerBlok(blokNumber);
            perencanaanValue = sesiBlok.toString();
            console.log(
              `Perencanaan value untuk blok ${blokNumber}: ${perencanaanValue}`
            );
            console.log("=== END DEBUG PDF Perencanaan ===");
          } else if (jenisKegiatan.jenis === "jurnal_reading") {
            const perencanaanJurnal =
              getJurnalReadingPerencanaanPerBlok(blokNumber);
            perencanaanValue = perencanaanJurnal.toString();
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

      // Footer halaman
      const totalPages = (doc as any).internal.getNumberOfPages();
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
      case "materi":
        return "bg-indigo-100 text-indigo-800";
      case "agenda":
      case "agenda_khusus":
        return "bg-yellow-100 text-yellow-800";
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
      case "materi":
        return "Materi";
      case "agenda":
        return "Agenda";
      case "agenda_khusus":
        return "Agenda Khusus";
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
    // Hitung jam berdasarkan jumlah sesi (1 sesi = 50 menit = 0.833 jam)
    const jamPerSesi = 50 / 60; // 50 menit dalam jam
    return total + jadwal.jumlah_sesi * jamPerSesi;
  }, 0);

  // Statistik breakdown per jenis jadwal
  const statistikPerJenis = filteredJadwal.reduce((acc, jadwal) => {
    const jenis = jadwal.jenis_jadwal;
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
              <option value="materi">Materi</option>
              <option value="agenda">Agenda</option>
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
              jenis: "materi",
              label: "Materi",
              color:
                "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
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
            "materi",
            "agenda_khusus",
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
                                  ? jadwal.kelompok_besar_id
                                    ? `Kelompok Besar Semester ${jadwal.kelompok_besar_id}`
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
