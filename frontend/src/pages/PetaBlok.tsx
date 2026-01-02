import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import api from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";

const sesiHarian = [
  { jam: "07.20-08.10" },
  { jam: "08.10-09.00" },
  { jam: "09.00-09.50" },
  { jam: "09.50-10.40" },
  { jam: "10.40-11.30" },
  { jam: "11.30-12.35", isIstirahat: true },
  { jam: "12.35-13.25" },
  { jam: "13.25-14.15" },
  { jam: "14.15-15.05" },
  { jam: "15.05-15.35", isIstirahat: true },
  { jam: "15.35-16.25" },
  { jam: "16.25-17.15" },
];

// Helper hari & waktu
const hariNames = [
  "MINGGU",
  "SENIN",
  "SELASA",
  "RABU",
  "KAMIS",
  "JUMAT",
  "SABTU",
];

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseTimeToMinutes(hhmm: string) {
  if (!hhmm) return null;

  // Bersihkan string
  let timeStr = hhmm.toString().trim();

  // Ganti titik dengan colon
  timeStr = timeStr.replace(".", ":");

  // Jika format HHMM (tanpa separator), tambahkan colon
  if (/^\d{4}$/.test(timeStr)) {
    timeStr = timeStr.slice(0, 2) + ":" + timeStr.slice(2);
  }

  // Parse jam dan menit
  const [h, m] = timeStr.split(":").map(Number);
  if (isNaN(h) || isNaN(m)) return null;

  return h * 60 + m;
}

// Fungsi sederhana untuk parse tanggal
function parseDate(dateStr: string): Date | null {
  if (!dateStr) return null;

  try {
    // Coba parse langsung
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) return date;

    // Jika gagal, coba format DD/MM/YYYY
    if (/^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{4}$/.test(dateStr)) {
      const parts = dateStr.split(/[\/\-]/);
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // Month is 0-indexed
      const year = parseInt(parts[2]);
      return new Date(year, month, day);
    }

    return null;
  } catch (e) {
    return null;
  }
}

// Fungsi untuk format tanggal Indonesia
function formatTanggalIndonesia(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;

    return date.toLocaleDateString("id-ID", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch (e) {
    return dateStr;
  }
}

// Fungsi format tanggal yang konsisten seperti di DetailBlok.tsx
function formatTanggalKonsisten(dateStr: string) {
  if (!dateStr) return "";

  const date = new Date(dateStr);
  const hari = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
  const hariIndo = hari[date.getDay()];

  // Format tanggal DD/MM/YYYY
  const day = date.getDate().toString().padStart(2, "0");
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const year = date.getFullYear();

  return `${hariIndo}, ${day}/${month}/${year}`;
}

function hitungJamSelesai(jamMulai: string, jumlahKali: number) {
  if (!jamMulai) return "";
  const [jamStr, menitStr] = jamMulai.split(/[.:]/);
  const jam = Number(jamStr);
  const menit = Number(menitStr);
  if (isNaN(jam) || isNaN(menit)) return "";
  const totalMenit = jam * 60 + menit + jumlahKali * 50;
  const jamAkhir = Math.floor(totalMenit / 60)
    .toString()
    .padStart(2, "0");
  const menitAkhir = (totalMenit % 60).toString().padStart(2, "0");
  return `${jamAkhir}.${menitAkhir}`;
}

function formatJamTanpaDetik(jam: string) {
  if (!jam) return "";
  // Jika format sudah HH:MM, return as is
  if (/^\d{2}:\d{2}$/.test(jam)) return jam;
  // Jika format HH:MM:SS, hapus detik
  if (/^\d{2}:\d{2}:\d{2}$/.test(jam)) {
    return jam.substring(0, 5);
  }
  // Jika format HH.MM, konversi ke HH:MM
  if (/^\d{2}\.\d{2}$/.test(jam)) {
    return jam.replace(".", ":");
  }
  return jam;
}

// semesterKolom tetap
const semesterGanjil = [
  { nama: "SEMESTER I", mataKuliah: "REPRODUKSI 1 : CIRENDEU" },
  { nama: "SEMESTER III", mataKuliah: "KARDIOVASKULER : CIRENDEU" },
  { nama: "SEMESTER V", mataKuliah: "PSIKIATRI : CIRENDEU" },
  { nama: "SEMESTER VII", mataKuliah: "ANESTESI : CIRENDEU" },
];
const semesterGenap = [
  { nama: "SEMESTER II", mataKuliah: "REPRODUKSI 2 : CIRENDEU" },
  { nama: "SEMESTER IV", mataKuliah: "KARDIOVASKULER 2 : CIRENDEU" },
  { nama: "SEMESTER VI", mataKuliah: "PSIKIATRI 2 : CIRENDEU" },
];

// Jika ingin benar-benar tidak ada pelajaran di Semester VII, hapus pengisian Matematika Sabtu
export default function PetaBlok() {
  // Route didefinisikan sebagai /peta-blok/:semester/:blok → baca param 'semester' sebagai tipe
  const { semester: tipe, blok } = useParams();
  const navigate = useNavigate();

  // Tentukan semester dasar dari tipe parameter
  const getSemesterFromTipe = (tipe: string | undefined) => {
    if (!tipe) return "1";
    const lower = String(tipe).toLowerCase();
    if (lower === "ganjil") return "1";
    if (lower === "genap") return "2";
    if (!isNaN(parseInt(lower))) return lower;
    const match = lower.match(/\d+/);
    if (match) return match[0];
    return "1";
  };

  const semester = getSemesterFromTipe(tipe);

  // Tentukan ganjil/genap: prioritaskan tipe eksplisit
  const isGanjil =
    String(tipe).toLowerCase() === "ganjil"
      ? true
      : String(tipe).toLowerCase() === "genap"
      ? false
      : (semester && parseInt(semester) % 2 === 1) || false;
  const isGenap =
    String(tipe).toLowerCase() === "genap"
      ? true
      : String(tipe).toLowerCase() === "ganjil"
      ? false
      : (semester && parseInt(semester) % 2 === 0) || false;
  const isAntara = String(tipe).toLowerCase() === "antara";
  const baseSemesterKolom = isGanjil ? semesterGanjil : semesterGenap;
  const semesterKolom = isAntara
    ? [{ ...baseSemesterKolom[0], nama: "SEMESTER ANTARA" }]
    : baseSemesterKolom;

  // Mapping semester ke kode mata kuliah yang benar
  const getDefaultKodeForSemester = (sem: string) => {
    const semesterNum = parseInt(sem);
    switch (semesterNum) {
      case 1:
        return "MKB101"; // Dasar-dasar Kedokteran
      case 3:
        return "MKB301"; // Sistem Pencernaan
      case 5:
        return "MKB501"; // Infeksi dan Imunologi
      case 7:
        return "MKB701"; // Psikiatri Dasar
      default:
        return null;
    }
  };

  // Redirect otomatis untuk menyederhanakan URL
  useEffect(() => {
    // Redirect dari format spesifik ke format umum
    if (blok && blok !== "all" && blok !== "NONBLOK") {
      // Cek apakah blok adalah kode mata kuliah spesifik yang perlu di-redirect
      if (blok === "MKB101" || blok === "MKB201" || blok === "MKA001") {
        navigate(`/peta-blok/${tipe}`, { replace: true });
        return; // Stop execution setelah redirect
      }
    }

    // Redirect otomatis jika blok adalah angka (format lama)
    if (blok && !isNaN(parseInt(blok)) && blok !== "all") {
      const defaultKode = getDefaultKodeForSemester(semester || "1");
      if (defaultKode) {
        navigate(`/peta-blok/${tipe}/${defaultKode}`, { replace: true });
        return; // Stop execution setelah redirect
      }
    }
  }, [blok, semester, navigate, tipe]);

  // Data dari API batch-data
  const [mataKuliah, setMataKuliah] = useState<any | null>(null);
  const [mataKuliahList, setMataKuliahList] = useState<any[]>([]);
  const [jadwalPBL, setJadwalPBL] = useState<any[]>([]);
  const [jadwalJurnal, setJadwalJurnal] = useState<any[]>([]);
  const [jadwalKuliahBesar, setJadwalKuliahBesar] = useState<any[]>([]);
  const [jadwalAgendaKhusus, setJadwalAgendaKhusus] = useState<any[]>([]);
  const [jadwalPraktikum, setJadwalPraktikum] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // State untuk popup detail jadwal
  const [showPopup, setShowPopup] = useState(false);
  const [popupData, setPopupData] = useState<{
    jenis: string;
    details: any[];
  } | null>(null);
  // State untuk redirect sudah tidak digunakan, dihapus

  // Fungsi untuk mengubah format nama jadwal
  const formatJenisJadwal = (jenis: string): string => {
    return jenis
      .toLowerCase()
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const fetchData = useCallback(async () => {
    // Jika tidak ada blok atau blok adalah kode spesifik yang sudah di-redirect, gunakan mode gabungan
    const shouldUseCombinedMode =
      !blok || blok === "MKB101" || blok === "MKB201" || blok === "MKA001";

    if (shouldUseCombinedMode) {
    } else {
    }

    setLoading(true);
    setError(null);

    try {
      // Mode SEMESTER ANTARA: gabungkan semua blok antara (MKA001-MKA004) + non blok antara (MKA005)
      if (isAntara) {
        // 1. Ambil semua blok antara (MKA001-MKA004)
        const allBlokAntaraCodes = ["MKA001", "MKA002", "MKA003", "MKA004"];

        // 2. Ambil non blok antara (MKA005)
        const nonBlokAntaraCode = "MKA005";

        // 3. Fetch semua data secara paralel
        const allBatchData = await Promise.all([
          // Fetch blok antara data
          ...allBlokAntaraCodes.map(async (blokCode) => {
            try {
              const res = await api.get(`/mata-kuliah/${blokCode}/batch-data`);
              return {
                type: "blok-antara",
                blokCode,
                data: res.data,
                success: true,
              };
            } catch (error) {
              return {
                type: "blok-antara",
                blokCode,
                data: null,
                success: false,
                error,
              };
            }
          }),
          // Fetch non blok antara data
          {
            type: "nonblok-antara",
            kode: nonBlokAntaraCode,
            data: null,
            success: false,
          },
        ]);

        // Fetch non blok antara data secara terpisah
        try {
          const nonBlokRes = await api.get(
            `/non-blok-non-csr-antara/${nonBlokAntaraCode}/batch-data`
          );
          allBatchData[allBatchData.length - 1] = {
            type: "nonblok-antara",
            kode: nonBlokAntaraCode,
            data: nonBlokRes.data,
            success: true,
          };
        } catch (error) {
        }

        // 4. Tentukan rentang tanggal dari semua data
        const allDates: { mulai?: string; akhir?: string }[] = [];
        allBatchData.forEach((b) => {
          if (b.success && b.data?.mata_kuliah) {
            allDates.push({
              mulai: b.data.mata_kuliah.tanggal_mulai,
              akhir: b.data.mata_kuliah.tanggal_akhir,
            });
          }
        });

        let mulaiTimes = allDates
          .map((d) => new Date(d.mulai || "").getTime())
          .filter((t) => !isNaN(t));
        let akhirTimes = allDates
          .map((d) => new Date(d.akhir || "").getTime())
          .filter((t) => !isNaN(t));

        // Jika metadata tidak cukup, gunakan tanggal dari item jadwal
        if (!mulaiTimes.length || !akhirTimes.length) {
          const itemDates: number[] = [];
          allBatchData.forEach((b) => {
            if (!b.success || !b.data) return;

            // Ambil tanggal dari berbagai jenis jadwal
            const jadwalTypes = [
              "jadwal_pbl",
              "jadwal_jurnal_reading",
              "jadwal_kuliah_besar",
              "jadwal_agenda_khusus",
              "jadwal_praktikum",
              "jadwal_non_blok_non_csr",
            ];
            jadwalTypes.forEach((type) => {
              const list = Array.isArray(b.data[type]) ? b.data[type] : [];
              list.forEach((item: any) => {
                const t = new Date(item.tanggal || "").getTime();
                if (!isNaN(t)) itemDates.push(t);
              });
            });
          });

          if (itemDates.length) {
            const minT = Math.min(...itemDates);
            const maxT = Math.max(...itemDates);
            mulaiTimes = [minT];
            akhirTimes = [maxT];
          }
        }

        // Set mata kuliah dengan rentang tanggal gabungan
        if (mulaiTimes.length && akhirTimes.length) {
          const mulai = new Date(Math.min(...mulaiTimes));
          const akhir = new Date(Math.max(...akhirTimes));
          setMataKuliah({
            nama: "Jadwal Semester Antara (Blok + Non Blok)",
            semester: "Antara" as any,
            tanggal_mulai: mulai.toISOString(),
            tanggal_akhir: akhir.toISOString(),
          });
        } else {
          const today = new Date();
          const nextWeek = new Date();
          nextWeek.setDate(today.getDate() + 7);
          setMataKuliah({
            nama: "Jadwal Semester Antara (Blok + Non Blok)",
            semester: "Antara" as any,
            tanggal_mulai: today.toISOString(),
            tanggal_akhir: nextWeek.toISOString(),
          });
        }

        // 5. Gabungkan semua jadwal dengan metadata semester
        const allJadwalPBL: any[] = [];
        const allJadwalJurnal: any[] = [];
        const allJadwalKuliahBesar: any[] = [];
        const allJadwalAgendaKhusus: any[] = [];
        const allJadwalPraktikum: any[] = [];

        allBatchData.forEach((batch) => {
          if (!batch.success || !batch.data) return;

          // Tentukan semester berdasarkan kode dan tipe
          let semesterNumber = 1; // Semester Antara dipetakan ke kolom tunggal
          let blokNumber = 1;

          if (batch.type === "blok-antara") {
            const blokCode = (batch as any).blokCode || "";
            blokNumber = Number(blokCode.slice(-1)) || 1;
          } else if (batch.type === "nonblok-antara") {
            blokNumber = 0; // Non blok
          }

          // Tambahkan metadata ke setiap jadwal
          const addMetadata = (item: any, jenis: string) => ({
            ...item,
            __semester: semesterNumber,
            __blok: blokNumber,
            __kode: (batch as any).blokCode || (batch as any).kode,
            __nama:
              batch.data?.mata_kuliah?.nama ||
              (batch as any).blokCode ||
              (batch as any).kode,
            __jenis: jenis,
          });

          // Gabungkan jadwal dari setiap batch
          if (batch.type === "blok-antara") {
            const pblArr = Array.isArray(batch.data.jadwal_pbl)
              ? batch.data.jadwal_pbl
              : [];
            const jrArr = Array.isArray(batch.data.jadwal_jurnal_reading)
              ? batch.data.jadwal_jurnal_reading
              : [];
            const kbArr = Array.isArray(batch.data.jadwal_kuliah_besar)
              ? batch.data.jadwal_kuliah_besar
              : [];
            const akArr = Array.isArray(batch.data.jadwal_agenda_khusus)
              ? batch.data.jadwal_agenda_khusus
              : [];
            const prArr = Array.isArray(batch.data.jadwal_praktikum)
              ? batch.data.jadwal_praktikum
              : [];

            pblArr.forEach((x: any) =>
              allJadwalPBL.push(addMetadata(x, "PBL"))
            );
            jrArr.forEach((x: any) =>
              allJadwalJurnal.push(addMetadata(x, "JURNAL"))
            );
            kbArr.forEach((x: any) =>
              allJadwalKuliahBesar.push(addMetadata(x, "KULIAH_BESAR"))
            );
            akArr.forEach((x: any) =>
              allJadwalAgendaKhusus.push(addMetadata(x, "AGENDA_KHUSUS"))
            );
            prArr.forEach((x: any) =>
              allJadwalPraktikum.push(addMetadata(x, "PRAKTIKUM"))
            );
          } else if (batch.type === "nonblok-antara") {
            const list = Array.isArray(batch.data.jadwal_non_blok_non_csr)
              ? batch.data.jadwal_non_blok_non_csr
              : [];
            list.forEach((item: any) => {
              allJadwalKuliahBesar.push({
                ...addMetadata(item, "NON_BLOK_ANTARA"),
                materi: item.materi || item.agenda || "Non Blok Antara",
                dosen_nama: item.dosen_names,
                ruangan_nama: item.ruangan?.nama,
              });
            });
          }
        });

        setJadwalPBL(allJadwalPBL);
        setJadwalJurnal(allJadwalJurnal);
        setJadwalKuliahBesar(allJadwalKuliahBesar);
        setJadwalAgendaKhusus(allJadwalAgendaKhusus);
        setJadwalPraktikum(allJadwalPraktikum);
        setMataKuliahList([]);

        return; // Stop execution untuk mode gabungan antara
      }

      // Mode GABUNGAN GANJIL/GENAP: untuk URL yang sudah disederhanakan
      if (shouldUseCombinedMode && (isGanjil || isGenap)) {
        // 1. Ambil semua blok (1-4) untuk semester ganjil/genap
        const getAllBlokCodes = (ganjil: boolean): string[] => {
          // Ganjil: 10x/30x/50x/70x, Genap: 20x/40x/60x
          return ganjil
            ? [`MKB101`, `MKB301`, `MKB501`, `MKB701`]
            : [`MKB201`, `MKB401`, `MKB601`];
        };
        const allBlokCodes = getAllBlokCodes(isGanjil);

        // 2. Ambil non blok codes untuk semester ganjil/genap
        const kodePerSemesterGanjil: Record<number, string> = {
          1: "MKU001",
          3: "MKU003",
          5: "MKU005",
          7: "MKU007",
        };
        const kodePerSemesterGenap: Record<number, string> = {
          2: "MKU002",
          4: "MKU004",
          6: "MKU006",
        };
        const targetSemesters = isGanjil ? [1, 3, 5, 7] : [2, 4, 6];
        const nonBlokCodes = targetSemesters
          .map((s) =>
            isGanjil ? kodePerSemesterGanjil[s] : kodePerSemesterGenap[s]
          )
          .filter(Boolean) as string[];


        // 3. Fetch semua data secara paralel
        const allBatchData = await Promise.all([
          // Fetch blok data
          ...allBlokCodes.map(async (blokCode) => {
            try {
              const res = await api.get(`/mata-kuliah/${blokCode}/batch-data`);
              return { type: "blok", blokCode, data: res.data, success: true };
            } catch (error) {
              return {
                type: "blok",
                blokCode,
                data: null,
                success: false,
                error,
              };
            }
          }),
          // Fetch non blok non-csr data
          ...nonBlokCodes.map(async (kode) => {
            try {
              const res = await api.get(`/non-blok-non-csr/${kode}/batch-data`);
              return {
                type: "nonblok-noncsr",
                kode,
                data: res.data,
                success: true,
              };
            } catch (error) {
              return {
                type: "nonblok-noncsr",
                kode,
                data: null,
                success: false,
                error,
              };
            }
          }),
          // Fetch non blok csr data
          ...nonBlokCodes.map(async (kode) => {
            try {
              const res = await api.get(`/csr/${kode}/batch-data`);
              return {
                type: "nonblok-csr",
                kode,
                data: res.data,
                success: true,
              };
            } catch (error) {
              return {
                type: "nonblok-csr",
                kode,
                data: null,
                success: false,
                error,
              };
            }
          }),
        ]);


        // 4. Tentukan rentang tanggal dari semua data
        const allDates: { mulai?: string; akhir?: string }[] = [];
        allBatchData.forEach((b) => {
          if (b.success && b.data?.mata_kuliah) {
            allDates.push({
              mulai: b.data.mata_kuliah.tanggal_mulai,
              akhir: b.data.mata_kuliah.tanggal_akhir,
            });
          }
        });

        let mulaiTimes = allDates
          .map((d) => new Date(d.mulai || "").getTime())
          .filter((t) => !isNaN(t));
        let akhirTimes = allDates
          .map((d) => new Date(d.akhir || "").getTime())
          .filter((t) => !isNaN(t));

        // Jika metadata tidak cukup, gunakan tanggal dari item jadwal
        if (!mulaiTimes.length || !akhirTimes.length) {
          const itemDates: number[] = [];
          allBatchData.forEach((b) => {
            if (!b.success || !b.data) return;

            // Ambil tanggal dari berbagai jenis jadwal
            const jadwalTypes = [
              "jadwal_pbl",
              "jadwal_jurnal_reading",
              "jadwal_kuliah_besar",
              "jadwal_agenda_khusus",
              "jadwal_praktikum",
              "jadwal_non_blok_non_csr",
              "jadwal_csr",
            ];
            jadwalTypes.forEach((type) => {
              const list = Array.isArray(b.data[type]) ? b.data[type] : [];
              list.forEach((item: any) => {
                const t = new Date(item.tanggal || "").getTime();
                if (!isNaN(t)) itemDates.push(t);
              });
            });
          });

          if (itemDates.length) {
            const minT = Math.min(...itemDates);
            const maxT = Math.max(...itemDates);
            mulaiTimes = [minT];
            akhirTimes = [maxT];
          }
        }

        // Set mata kuliah dengan rentang tanggal gabungan
        if (mulaiTimes.length && akhirTimes.length) {
          const mulai = new Date(Math.min(...mulaiTimes));
          const akhir = new Date(Math.max(...akhirTimes));
          setMataKuliah({
            nama: `Jadwal ${isGanjil ? "Ganjil" : "Genap"} (Blok + Non Blok)`,
            semester: isGanjil ? 1 : 2,
            tanggal_mulai: mulai.toISOString(),
            tanggal_akhir: akhir.toISOString(),
          });
        } else {
          const today = new Date();
          const nextWeek = new Date();
          nextWeek.setDate(today.getDate() + 7);
          setMataKuliah({
            nama: `Jadwal ${isGanjil ? "Ganjil" : "Genap"} (Blok + Non Blok)`,
            semester: isGanjil ? 1 : 2,
            tanggal_mulai: today.toISOString(),
            tanggal_akhir: nextWeek.toISOString(),
          });
        }

        // 5. Gabungkan semua jadwal dengan metadata semester
        const allJadwalPBL: any[] = [];
        const allJadwalJurnal: any[] = [];
        const allJadwalKuliahBesar: any[] = [];
        const allJadwalAgendaKhusus: any[] = [];
        const allJadwalPraktikum: any[] = [];

        allBatchData.forEach((batch) => {
          if (!batch.success || !batch.data) return;

          // Tentukan semester berdasarkan kode dan tipe
          let semesterNumber = 1;
          if (batch.type === "blok") {
            const blokCode = (batch as any).blokCode || "";
            if (isGanjil) {
              if (blokCode.startsWith("MKB30")) semesterNumber = 3;
              else if (blokCode.startsWith("MKB50")) semesterNumber = 5;
              else if (blokCode.startsWith("MKB70")) semesterNumber = 7;
              else semesterNumber = 1; // MKB10x
            } else {
              if (blokCode.startsWith("MKB40")) semesterNumber = 4;
              else if (blokCode.startsWith("MKB60")) semesterNumber = 6;
              else semesterNumber = 2; // MKB20x
            }
          } else if (
            batch.type === "nonblok-noncsr" ||
            batch.type === "nonblok-csr"
          ) {
            const kode = (batch as any).kode || "";
            const mapReverseGanjil: Record<string, number> = {
              MKU001: 1,
              MKU003: 3,
              MKU005: 5,
              MKU007: 7,
            };
            const mapReverseGenap: Record<string, number> = {
              MKU002: 2,
              MKU004: 4,
              MKU006: 6,
            };
            semesterNumber =
              (isGanjil ? mapReverseGanjil[kode] : mapReverseGenap[kode]) || 1;
          }

          // Tambahkan metadata ke setiap jadwal
          const addMetadata = (item: any, jenis: string) => ({
            ...item,
            __semester: semesterNumber,
            __blok:
              batch.type === "blok"
                ? Number((batch as any).blokCode?.slice(-1)) || 1
                : 0,
            __kode: (batch as any).blokCode || (batch as any).kode,
            __nama:
              batch.data?.mata_kuliah?.nama ||
              (batch as any).blokCode ||
              (batch as any).kode,
            __jenis: jenis,
          });

          // Gabungkan jadwal dari setiap batch
          if (batch.type === "blok") {
            const pblArr = Array.isArray(batch.data.jadwal_pbl)
              ? batch.data.jadwal_pbl
              : [];
            const jrArr = Array.isArray(batch.data.jadwal_jurnal_reading)
              ? batch.data.jadwal_jurnal_reading
              : [];
            const kbArr = Array.isArray(batch.data.jadwal_kuliah_besar)
              ? batch.data.jadwal_kuliah_besar
              : [];
            const akArr = Array.isArray(batch.data.jadwal_agenda_khusus)
              ? batch.data.jadwal_agenda_khusus
              : [];
            const prArr = Array.isArray(batch.data.jadwal_praktikum)
              ? batch.data.jadwal_praktikum
              : [];

            pblArr.forEach((x: any) =>
              allJadwalPBL.push(addMetadata(x, "PBL"))
            );
            jrArr.forEach((x: any) =>
              allJadwalJurnal.push(addMetadata(x, "JURNAL"))
            );
            kbArr.forEach((x: any) =>
              allJadwalKuliahBesar.push(addMetadata(x, "KULIAH_BESAR"))
            );
            akArr.forEach((x: any) =>
              allJadwalAgendaKhusus.push(addMetadata(x, "AGENDA_KHUSUS"))
            );
            prArr.forEach((x: any) =>
              allJadwalPraktikum.push(addMetadata(x, "PRAKTIKUM"))
            );
          } else if (batch.type === "nonblok-noncsr") {
            const list = Array.isArray(batch.data.jadwal_non_blok_non_csr)
              ? batch.data.jadwal_non_blok_non_csr
              : [];
            list.forEach((item: any) => {
              allJadwalKuliahBesar.push({
                ...addMetadata(item, "NON_BLOK_NON_CSR"),
                materi: item.materi || item.agenda || "Non Blok Non-CSR",
                dosen_nama: item.dosen_names,
                ruangan_nama: item.ruangan?.nama,
              });
            });
          } else if (batch.type === "nonblok-csr") {
            const list = Array.isArray(batch.data.jadwal_csr)
              ? batch.data.jadwal_csr
              : [];
            list.forEach((item: any) => {
              allJadwalKuliahBesar.push({
                ...addMetadata(item, "NON_BLOK_CSR"),
                materi: item.kategori?.nama || item.materi || "Non Blok CSR",
                dosen_nama: item.dosen?.name,
                ruangan_nama: item.ruangan?.nama,
              });
            });
          }
        });

        setJadwalPBL(allJadwalPBL);
        setJadwalJurnal(allJadwalJurnal);
        setJadwalKuliahBesar(allJadwalKuliahBesar);
        setJadwalAgendaKhusus(allJadwalAgendaKhusus);
        setJadwalPraktikum(allJadwalPraktikum);
        setMataKuliahList([]);

        return; // Stop execution untuk mode gabungan
      }

      if (blok === "all") {
        // Ambil semua mata kuliah untuk semester, filter jenis Blok (exclude Non Blok)
        const listRes = await api.get(`/mata-kuliah/semester/${semester}`);
        const list = Array.isArray(listRes.data) ? listRes.data : [];
        const blokCourses = list.filter(
          (mk: any) => (mk.jenis || "").toLowerCase() === "blok"
        );

        if (blokCourses.length === 0) {
          setError(
            `Tidak ada mata kuliah bertipe "Blok" untuk semester ${semester}`
          );
          return;
        }

        setMataKuliahList(blokCourses);
        // Ambil batch-data untuk setiap blok
        const batches = await Promise.all(
          blokCourses.map((mk: any) =>
            api
              .get(`/mata-kuliah/${mk.kode}/batch-data`)
              .then((r) => ({ mk, data: r.data }))
              .catch((err) => ({ mk, data: null, error: err }))
          )
        );
        // Gabungkan jadwal dengan metadata semester/blok untuk mapping
        const allPbl: any[] = [];
        const allJurnal: any[] = [];
        const allKuliahBesar: any[] = [];
        const allAgendaKhusus: any[] = [];
        const allPraktikum: any[] = [];

        batches.forEach(({ mk, data, error }: any) => {
          if (error) {
            return;
          }

          // Tambahkan metadata ke setiap jadwal
          const addMetadata = (item: any) => ({
            ...item,
            __semester: mk.semester,
            __blok: mk.blok,
            __kode: mk.kode,
            __nama: mk.nama,
          });

          const pblArr = Array.isArray(data?.jadwal_pbl) ? data.jadwal_pbl : [];
          const jrArr = Array.isArray(data?.jadwal_jurnal_reading)
            ? data.jadwal_jurnal_reading
            : [];
          const kbArr = Array.isArray(data?.jadwal_kuliah_besar)
            ? data.jadwal_kuliah_besar
            : [];
          const akArr = Array.isArray(data?.jadwal_agenda_khusus)
            ? data.jadwal_agenda_khusus
            : [];
          const prArr = Array.isArray(data?.jadwal_praktikum)
            ? data.jadwal_praktikum
            : [];

          pblArr.forEach((x: any) => allPbl.push(addMetadata(x)));
          jrArr.forEach((x: any) => allJurnal.push(addMetadata(x)));
          kbArr.forEach((x: any) => allKuliahBesar.push(addMetadata(x)));
          akArr.forEach((x: any) => allAgendaKhusus.push(addMetadata(x)));
          prArr.forEach((x: any) => allPraktikum.push(addMetadata(x)));
        });

        setJadwalPBL(allPbl);
        setJadwalJurnal(allJurnal);
        setJadwalKuliahBesar(allKuliahBesar);
        setJadwalAgendaKhusus(allAgendaKhusus);
        setJadwalPraktikum(allPraktikum);
        setMataKuliah(null);
      } else {
        // Mode khusus NONBLOK: gabungkan Non-CSR (MKUxxx) dan CSR per semester ganjil/genap
        if (blok === "NONBLOK") {
          try {
            const kodePerSemesterGanjil: Record<number, string> = {
              1: "MKU001",
              3: "MKU003",
              5: "MKU005",
              7: "MKU007",
            };
            const kodePerSemesterGenap: Record<number, string> = {
              2: "MKU002",
              4: "MKU004",
              6: "MKU006",
            };
            const targetSemesters = isGanjil ? [1, 3, 5, 7] : [2, 4, 6];

            const nonCsrCodes = targetSemesters
              .map((s) =>
                isGanjil ? kodePerSemesterGanjil[s] : kodePerSemesterGenap[s]
              )
              .filter(Boolean) as string[];

            // Fetch Non-CSR
            const batchNonCSR = await Promise.all(
              nonCsrCodes.map(async (kode) => {
                try {
                  const res = await api.get(
                    `/non-blok-non-csr/${kode}/batch-data`
                  );
                  return { ok: true, kode, data: res.data };
                } catch (e) {
                  return { ok: false, kode, data: null };
                }
              })
            );

            // Ambil daftar MK CSR per semester lalu fetch batch CSR (discovery)
            const csrListArrays = await Promise.all(
              targetSemesters.map(async (s) => {
                try {
                  const listRes = await api.get(`/mata-kuliah/semester/${s}`);
                  const list = Array.isArray(listRes.data) ? listRes.data : [];
                  return list
                    .filter(
                      (mk: any) =>
                        (mk.jenis || "").toLowerCase() === "non blok" &&
                        (mk.tipe_non_block || "").toLowerCase() === "csr"
                    )
                    .map((mk: any) => ({
                      kode: mk.kode,
                      semester: Number(mk.semester),
                    }));
                } catch (e) {
                  return [] as Array<{ kode: string; semester: number }>;
                }
              })
            );
            const csrList = csrListArrays.flat();

            // Tambahkan fetch CSR eksplisit untuk kode-kode MKU001-007 sesuai semester aktif
            const explicitCsrList = nonCsrCodes.map((kode) => ({
              kode,
              semester: isGanjil
                ? kode === "MKU001"
                  ? 1
                  : kode === "MKU003"
                  ? 3
                  : kode === "MKU005"
                  ? 5
                  : 7
                : kode === "MKU002"
                ? 2
                : kode === "MKU004"
                ? 4
                : 6,
            }));

            const combinedCsrList = [...csrList, ...explicitCsrList];

            const batchCSR = await Promise.all(
              combinedCsrList.map(async (mk) => {
                try {
                  const res = await api.get(`/csr/${mk.kode}/batch-data`);
                  return {
                    ok: true,
                    kode: mk.kode,
                    semester: mk.semester,
                    data: res.data,
                  };
                } catch (e) {
                  return {
                    ok: false,
                    kode: mk.kode,
                    semester: mk.semester,
                    data: null,
                  };
                }
              })
            );

            // Tentukan rentang tanggal supaya hariList terbentuk
            // Ambil dari metadata MK jika ada, lalu fallback dari tanggal jadwal riil
            const mkDates: { mulai?: string; akhir?: string }[] = [];
            batchNonCSR.forEach((b) => {
              if (b.ok && b.data?.mata_kuliah)
                mkDates.push({
                  mulai: b.data.mata_kuliah.tanggal_mulai,
                  akhir: b.data.mata_kuliah.tanggal_akhir,
                });
            });
            batchCSR.forEach((b) => {
              if (b.ok && b.data?.mata_kuliah)
                mkDates.push({
                  mulai: b.data.mata_kuliah.tanggal_mulai,
                  akhir: b.data.mata_kuliah.tanggal_akhir,
                });
            });
            let mulaiTimes = mkDates
              .map((d) => new Date(d.mulai || "").getTime())
              .filter((t) => !isNaN(t));
            let akhirTimes = mkDates
              .map((d) => new Date(d.akhir || "").getTime())
              .filter((t) => !isNaN(t));

            // Jika metadata tidak cukup, gunakan tanggal dari item jadwal (Non-CSR + CSR)
            if (!mulaiTimes.length || !akhirTimes.length) {
              const itemDates: number[] = [];
              batchNonCSR.forEach((b) => {
                const list = Array.isArray(b.data?.jadwal_non_blok_non_csr)
                  ? b.data.jadwal_non_blok_non_csr
                  : [];
                list.forEach((it: any) => {
                  const t = new Date(it.tanggal || "").getTime();
                  if (!isNaN(t)) itemDates.push(t);
                });
              });
              batchCSR.forEach((b) => {
                const list = Array.isArray(b.data?.jadwal_csr)
                  ? b.data.jadwal_csr
                  : [];
                list.forEach((it: any) => {
                  const t = new Date(it.tanggal || "").getTime();
                  if (!isNaN(t)) itemDates.push(t);
                });
              });
              if (itemDates.length) {
                const minT = Math.min(...itemDates);
                const maxT = Math.max(...itemDates);
                mulaiTimes = [minT];
                akhirTimes = [maxT];
              }
            }

            if (mulaiTimes.length && akhirTimes.length) {
              const mulai = new Date(Math.min(...mulaiTimes));
              const akhir = new Date(Math.max(...akhirTimes));
              setMataKuliah({
                nama: "NON BLOK",
                semester: isGanjil ? 1 : 2,
                tanggal_mulai: mulai.toISOString(),
                tanggal_akhir: akhir.toISOString(),
              });
            } else {
              const today = new Date();
              const nextWeek = new Date();
              nextWeek.setDate(today.getDate() + 7);
              setMataKuliah({
                nama: "NON BLOK",
                semester: isGanjil ? 1 : 2,
                tanggal_mulai: today.toISOString(),
                tanggal_akhir: nextWeek.toISOString(),
              });
            }

            // Gabungkan ke jalur Kuliah Besar untuk rendering tabel utama
            const mergedKB: any[] = [];
            const mapReverseGanjil: Record<string, number> = {
              MKU001: 1,
              MKU003: 3,
              MKU005: 5,
              MKU007: 7,
            };
            const mapReverseGenap: Record<string, number> = {
              MKU002: 2,
              MKU004: 4,
              MKU006: 6,
            };
            batchNonCSR.forEach(({ ok, data, kode }) => {
              if (!ok || !data) return;
              const semesterNumber =
                (isGanjil ? mapReverseGanjil[kode] : mapReverseGenap[kode]) ||
                null;
              const list = Array.isArray(data.jadwal_non_blok_non_csr)
                ? data.jadwal_non_blok_non_csr
                : [];
              list.forEach((item: any) => {
                mergedKB.push({
                  tanggal: item.tanggal,
                  jam_mulai: item.jam_mulai,
                  jam_selesai: item.jam_selesai,
                  jumlah_sesi: item.jumlah_sesi,
                  materi: item.materi || item.agenda || "Non Blok",
                  dosen: item.dosen,
                  dosen_nama: item.dosen_names,
                  ruangan: item.ruangan,
                  ruangan_nama: item.ruangan?.nama,
                  __semester: semesterNumber,
                  __blok: 0,
                  __kode: kode,
                  __nama: data.mata_kuliah?.nama || kode,
                });
              });
            });
            batchCSR.forEach(({ ok, data, kode, semester }) => {
              if (!ok || !data) return;
              const semesterNumber = Number(semester) || null;
              const list = Array.isArray(data.jadwal_csr)
                ? data.jadwal_csr
                : [];
              list.forEach((item: any) => {
                mergedKB.push({
                  tanggal: item.tanggal,
                  jam_mulai: item.jam_mulai,
                  jam_selesai: item.jam_selesai,
                  jumlah_sesi: item.jumlah_sesi,
                  materi: item.kategori?.nama || item.materi || "CSR",
                  dosen: item.dosen,
                  dosen_nama: item.dosen?.name,
                  ruangan: item.ruangan,
                  ruangan_nama: item.ruangan?.nama,
                  __semester: semesterNumber,
                  __blok: 0,
                  __kode: kode,
                  __nama: data.mata_kuliah?.nama || kode,
                });
              });
            });

            setJadwalKuliahBesar(mergedKB);
            setJadwalPBL([]);
            setJadwalJurnal([]);
            setJadwalAgendaKhusus([]);
            setJadwalPraktikum([]);
            setMataKuliahList([]);
            return; // stop agar tidak jatuh ke logika blok reguler
          } catch (e) {
          }
        }

        // Mode GABUNGAN: Ambil semua blok (1-4) + non blok untuk ganjil/genap
        // 1. Ambil semua blok (1-4) untuk semester ganjil/genap
        const getAllBlokCodes = (ganjil: boolean): string[] => {
          // Ganjil: 10x/30x/50x/70x, Genap: 20x/40x/60x
          return ganjil
            ? [`MKB101`, `MKB301`, `MKB501`, `MKB701`]
            : [`MKB201`, `MKB401`, `MKB601`];
        };
        const allBlokCodes = getAllBlokCodes(isGanjil);

        // 2. Ambil non blok codes untuk semester ganjil/genap
        const kodePerSemesterGanjil: Record<number, string> = {
          1: "MKU001",
          3: "MKU003",
          5: "MKU005",
          7: "MKU007",
        };
        const kodePerSemesterGenap: Record<number, string> = {
          2: "MKU002",
          4: "MKU004",
          6: "MKU006",
        };
        const targetSemesters = isGanjil ? [1, 3, 5, 7] : [2, 4, 6];
        const nonBlokCodes = targetSemesters
          .map((s) =>
            isGanjil ? kodePerSemesterGanjil[s] : kodePerSemesterGenap[s]
          )
          .filter(Boolean) as string[];


        // 3. Fetch semua data secara paralel
        const allBatchData = await Promise.all([
          // Fetch blok data
          ...allBlokCodes.map(async (blokCode) => {
            try {
              const res = await api.get(`/mata-kuliah/${blokCode}/batch-data`);
              return { type: "blok", blokCode, data: res.data, success: true };
            } catch (error) {
              return {
                type: "blok",
                blokCode,
                data: null,
                success: false,
                error,
              };
            }
          }),
          // Fetch non blok non-csr data
          ...nonBlokCodes.map(async (kode) => {
            try {
              const res = await api.get(`/non-blok-non-csr/${kode}/batch-data`);
              return {
                type: "nonblok-noncsr",
                kode,
                data: res.data,
                success: true,
              };
            } catch (error) {
              return {
                type: "nonblok-noncsr",
                kode,
                data: null,
                success: false,
                error,
              };
            }
          }),
          // Fetch non blok csr data
          ...nonBlokCodes.map(async (kode) => {
            try {
              const res = await api.get(`/csr/${kode}/batch-data`);
              return {
                type: "nonblok-csr",
                kode,
                data: res.data,
                success: true,
              };
            } catch (error) {
              return {
                type: "nonblok-csr",
                kode,
                data: null,
                success: false,
                error,
              };
            }
          }),
        ]);


        // 4. Tentukan rentang tanggal dari semua data
        const allDates: { mulai?: string; akhir?: string }[] = [];
        allBatchData.forEach((b) => {
          if (b.success && b.data?.mata_kuliah) {
            allDates.push({
              mulai: b.data.mata_kuliah.tanggal_mulai,
              akhir: b.data.mata_kuliah.tanggal_akhir,
            });
          }
        });

        let mulaiTimes = allDates
          .map((d) => new Date(d.mulai || "").getTime())
          .filter((t) => !isNaN(t));
        let akhirTimes = allDates
          .map((d) => new Date(d.akhir || "").getTime())
          .filter((t) => !isNaN(t));

        // Jika metadata tidak cukup, gunakan tanggal dari item jadwal
        if (!mulaiTimes.length || !akhirTimes.length) {
          const itemDates: number[] = [];
          allBatchData.forEach((b) => {
            if (!b.success || !b.data) return;

            // Ambil tanggal dari berbagai jenis jadwal
            const jadwalTypes = [
              "jadwal_pbl",
              "jadwal_jurnal_reading",
              "jadwal_kuliah_besar",
              "jadwal_agenda_khusus",
              "jadwal_praktikum",
              "jadwal_non_blok_non_csr",
              "jadwal_csr",
            ];
            jadwalTypes.forEach((type) => {
              const list = Array.isArray(b.data[type]) ? b.data[type] : [];
              list.forEach((item: any) => {
                const t = new Date(item.tanggal || "").getTime();
                if (!isNaN(t)) itemDates.push(t);
              });
            });
          });

          if (itemDates.length) {
            const minT = Math.min(...itemDates);
            const maxT = Math.max(...itemDates);
            mulaiTimes = [minT];
            akhirTimes = [maxT];
          }
        }

        // Set mata kuliah dengan rentang tanggal gabungan
        if (mulaiTimes.length && akhirTimes.length) {
          const mulai = new Date(Math.min(...mulaiTimes));
          const akhir = new Date(Math.max(...akhirTimes));
          setMataKuliah({
            nama: `Jadwal ${isGanjil ? "Ganjil" : "Genap"} (Blok + Non Blok)`,
            semester: isGanjil ? 1 : 2,
            tanggal_mulai: mulai.toISOString(),
            tanggal_akhir: akhir.toISOString(),
          });
        } else {
          const today = new Date();
          const nextWeek = new Date();
          nextWeek.setDate(today.getDate() + 7);
          setMataKuliah({
            nama: `Jadwal ${isGanjil ? "Ganjil" : "Genap"} (Blok + Non Blok)`,
            semester: isGanjil ? 1 : 2,
            tanggal_mulai: today.toISOString(),
            tanggal_akhir: nextWeek.toISOString(),
          });
        }

        // 5. Gabungkan semua jadwal dengan metadata semester
        const allJadwalPBL: any[] = [];
        const allJadwalJurnal: any[] = [];
        const allJadwalKuliahBesar: any[] = [];
        const allJadwalAgendaKhusus: any[] = [];
        const allJadwalPraktikum: any[] = [];

        allBatchData.forEach((batch) => {
          if (!batch.success || !batch.data) return;

          // Tentukan semester berdasarkan kode dan tipe
          let semesterNumber = 1;
          if (batch.type === "blok") {
            const blokCode = (batch as any).blokCode || "";
            if (isGanjil) {
              if (blokCode.startsWith("MKB30")) semesterNumber = 3;
              else if (blokCode.startsWith("MKB50")) semesterNumber = 5;
              else if (blokCode.startsWith("MKB70")) semesterNumber = 7;
              else semesterNumber = 1; // MKB10x
            } else {
              if (blokCode.startsWith("MKB40")) semesterNumber = 4;
              else if (blokCode.startsWith("MKB60")) semesterNumber = 6;
              else semesterNumber = 2; // MKB20x
            }
          } else if (
            batch.type === "nonblok-noncsr" ||
            batch.type === "nonblok-csr"
          ) {
            const kode = (batch as any).kode || "";
            const mapReverseGanjil: Record<string, number> = {
              MKU001: 1,
              MKU003: 3,
              MKU005: 5,
              MKU007: 7,
            };
            const mapReverseGenap: Record<string, number> = {
              MKU002: 2,
              MKU004: 4,
              MKU006: 6,
            };
            semesterNumber =
              (isGanjil ? mapReverseGanjil[kode] : mapReverseGenap[kode]) || 1;
          }

          // Tambahkan metadata ke setiap jadwal
          const addMetadata = (item: any, jenis: string) => ({
            ...item,
            __semester: semesterNumber,
            __blok:
              batch.type === "blok"
                ? Number((batch as any).blokCode?.slice(-1)) || 1
                : 0,
            __kode: (batch as any).blokCode || (batch as any).kode,
            __nama:
              batch.data?.mata_kuliah?.nama ||
              (batch as any).blokCode ||
              (batch as any).kode,
            __jenis: jenis,
          });

          // Gabungkan jadwal dari setiap batch
          if (batch.type === "blok") {
            const pblArr = Array.isArray(batch.data.jadwal_pbl)
              ? batch.data.jadwal_pbl
              : [];
            const jrArr = Array.isArray(batch.data.jadwal_jurnal_reading)
              ? batch.data.jadwal_jurnal_reading
              : [];
            const kbArr = Array.isArray(batch.data.jadwal_kuliah_besar)
              ? batch.data.jadwal_kuliah_besar
              : [];
            const akArr = Array.isArray(batch.data.jadwal_agenda_khusus)
              ? batch.data.jadwal_agenda_khusus
              : [];
            const prArr = Array.isArray(batch.data.jadwal_praktikum)
              ? batch.data.jadwal_praktikum
              : [];

            pblArr.forEach((x: any) =>
              allJadwalPBL.push(addMetadata(x, "PBL"))
            );
            jrArr.forEach((x: any) =>
              allJadwalJurnal.push(addMetadata(x, "JURNAL"))
            );
            kbArr.forEach((x: any) =>
              allJadwalKuliahBesar.push(addMetadata(x, "KULIAH_BESAR"))
            );
            akArr.forEach((x: any) =>
              allJadwalAgendaKhusus.push(addMetadata(x, "AGENDA_KHUSUS"))
            );
            prArr.forEach((x: any) =>
              allJadwalPraktikum.push(addMetadata(x, "PRAKTIKUM"))
            );
          } else if (batch.type === "nonblok-noncsr") {
            const list = Array.isArray(batch.data.jadwal_non_blok_non_csr)
              ? batch.data.jadwal_non_blok_non_csr
              : [];
            list.forEach((item: any) => {
              allJadwalKuliahBesar.push({
                ...addMetadata(item, "NON_BLOK_NON_CSR"),
                materi: item.materi || item.agenda || "Non Blok Non-CSR",
                dosen_nama: item.dosen_names,
                ruangan_nama: item.ruangan?.nama,
              });
            });
          } else if (batch.type === "nonblok-csr") {
            const list = Array.isArray(batch.data.jadwal_csr)
              ? batch.data.jadwal_csr
              : [];
            list.forEach((item: any) => {
              allJadwalKuliahBesar.push({
                ...addMetadata(item, "NON_BLOK_CSR"),
                materi: item.kategori?.nama || item.materi || "Non Blok CSR",
                dosen_nama: item.dosen?.name,
                ruangan_nama: item.ruangan?.nama,
              });
            });
          }
        });

        setJadwalPBL(allJadwalPBL);
        setJadwalJurnal(allJadwalJurnal);
        setJadwalKuliahBesar(allJadwalKuliahBesar);
        setJadwalAgendaKhusus(allJadwalAgendaKhusus);
        setJadwalPraktikum(allJadwalPraktikum);
        setMataKuliahList([]);

        return; // Stop execution untuk mode gabungan
      }
    } catch (error: any) {
      setError(
        error.response?.data?.message ||
          error.message ||
          "Terjadi kesalahan saat mengambil data"
      );
    } finally {
      setLoading(false);
    }
  }, [blok, semester, tipe]);

  // Fetch data setelah redirect selesai
  useEffect(() => {

    // Tunggu sebentar untuk memastikan redirect selesai
    const timer = setTimeout(() => {
      fetchData();
    }, 100);

    return () => clearTimeout(timer);
  }, [blok, semester, tipe, fetchData]);

  // State untuk menyimpan tanggal tambahan yang dipilih user (di luar rentang jadwal)
  // Harus dideklarasikan sebelum hariList useMemo karena digunakan di dependency array
  const [additionalDates, setAdditionalDates] = useState<Set<string>>(new Set());
  // State untuk menyimpan tanggal target yang ingin dinavigasi (setelah ditambahkan ke additionalDates)
  const [pendingDateNavigation, setPendingDateNavigation] = useState<string | null>(null);

  // Bangun hariList dari tanggal mulai-akhir blok
  const hariList = useMemo(() => {
    const baseArr: { hari: string; tanggal: string; iso: string }[] = [];

    // Mode all: gunakan min(tanggal_mulai) dan max(tanggal_akhir)
    if (blok === "all") {
      if (!mataKuliahList.length) {
        // Tetap proses additionalDates meskipun tidak ada base dates
      } else {
        // Ambil semua tanggal yang valid
        const validDates = mataKuliahList
          .map((mk: any) => ({
            mulai: new Date(mk.tanggal_mulai),
            akhir: new Date(mk.tanggal_akhir),
          }))
          .filter((x) => !isNaN(x.mulai.getTime()) && !isNaN(x.akhir.getTime()));

        if (validDates.length) {
          // Cari tanggal terendah dan tertinggi
          const start = new Date(
            Math.min(...validDates.map((d) => d.mulai.getTime()))
          );
          const end = new Date(
            Math.max(...validDates.map((d) => d.akhir.getTime()))
          );

          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const hari = hariNames[d.getDay()].toUpperCase();
            const day = d.getDate();
            const month = d.getMonth() + 1;
            const year = d.getFullYear();
            const tanggal = `${day}/${month}/${year}`;
            baseArr.push({ hari, tanggal, iso: toIsoDate(d) });
          }
        }
      }
    } else {
      if (mataKuliah?.tanggal_mulai && mataKuliah?.tanggal_akhir) {
        const start = new Date(mataKuliah.tanggal_mulai);
        const end = new Date(mataKuliah.tanggal_akhir);

        if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
          for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const hari = hariNames[d.getDay()].toUpperCase();
            const day = d.getDate();
            const month = d.getMonth() + 1;
            const year = d.getFullYear();
            const tanggal = `${day}/${month}/${year}`;
            baseArr.push({ hari, tanggal, iso: toIsoDate(d) });
          }
        }
      }
    }

    // Tambahkan tanggal tambahan yang dipilih user
    const additionalArr: { hari: string; tanggal: string; iso: string }[] = [];
    additionalDates.forEach((isoDate) => {
      // Cek apakah tanggal sudah ada di baseArr
      const exists = baseArr.some((item) => item.iso === isoDate);
      if (!exists) {
        // Parse ISO date (YYYY-MM-DD) secara manual untuk menghindari timezone issues
        const parts = isoDate.split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
          const day = parseInt(parts[2], 10);
          const date = new Date(year, month, day);
          if (!isNaN(date.getTime())) {
            const hari = hariNames[date.getDay()].toUpperCase();
            const dayStr = date.getDate().toString().padStart(2, '0');
            const monthStr = (date.getMonth() + 1).toString().padStart(2, '0');
            const yearStr = date.getFullYear();
            const tanggal = `${dayStr}/${monthStr}/${yearStr}`;
            additionalArr.push({ hari, tanggal, iso: isoDate });
          }
        }
      }
    });

    // Gabungkan dan urutkan berdasarkan tanggal
    const combined = [...baseArr, ...additionalArr];
    combined.sort((a, b) => {
      // Parse ISO date secara manual untuk menghindari timezone issues
      const parseIsoDate = (iso: string): number => {
        const parts = iso.split('-');
        if (parts.length === 3) {
          const year = parseInt(parts[0], 10);
          const month = parseInt(parts[1], 10) - 1;
          const day = parseInt(parts[2], 10);
          return new Date(year, month, day).getTime();
        }
        return 0;
      };
      return parseIsoDate(a.iso) - parseIsoDate(b.iso);
    });

    return combined;
  }, [
    blok,
    mataKuliah?.tanggal_mulai,
    mataKuliah?.tanggal_akhir,
    mataKuliahList,
    additionalDates,
  ]);

  // Hitung menit mulai tiap sesi
  const sesiStartMinutes = useMemo(
    () => sesiHarian.map((s) => parseTimeToMinutes(s.jam.split("-")[0]) ?? 0),
    []
  );

  type CellItem = {
    jenis:
      | "PBL"
      | "JURNAL"
      | "KULIAH_BESAR"
      | "AGENDA_KHUSUS"
      | "PRAKTIKUM"
      | "NON_BLOK_NON_CSR"
      | "NON_BLOK_CSR"
      | "NON_BLOK_ANTARA";
    label: string;
    durasi: number;
    count?: number;
    details?: any[];
  };
  const gridItems: CellItem[][][][] = useMemo(() => {
    const days = hariList.length;

    // Grid untuk 4 kolom blok: [blok][hari][sesi][items]
    const grid: CellItem[][][][] = Array.from({ length: 4 }, () =>
      Array.from({ length: days }, () =>
        Array.from({ length: sesiHarian.length }, () => [] as CellItem[])
      )
    );

    if (!days) {
      return grid;
    }

    const targetSem = isAntara ? [1] : isGanjil ? [1, 3, 5, 7] : [2, 4, 6];

    const dayIndex: Record<string, number> = {};
    hariList.forEach((h, i) => {
      dayIndex[h.iso] = i;
    });

    const add = (
      iso: string,
      jamMulai: string,
      jumlah: number,
      label: string,
      jenis:
        | "PBL"
        | "JURNAL"
        | "KULIAH_BESAR"
        | "AGENDA_KHUSUS"
        | "PRAKTIKUM"
        | "NON_BLOK_NON_CSR"
        | "NON_BLOK_CSR"
        | "NON_BLOK_ANTARA",
      semesterEntry: number | null,
      detail?: any
    ) => {
      const hIdx = dayIndex[iso];
      if (hIdx === undefined) return;

      const startMin = parseTimeToMinutes(formatJamTanpaDetik(jamMulai));
      if (startMin == null) return;

      const sIdx = sesiStartMinutes.findIndex((m) => m === startMin);
      if (sIdx === -1) return;

      const dur = Math.max(1, Number(jumlah) || 1);
      const idx =
        semesterEntry != null ? targetSem.indexOf(Number(semesterEntry)) : -1;
      if (idx === -1) return;

      // Untuk Kuliah Besar, selalu buat item terpisah (tidak digabung)
      if (jenis === "KULIAH_BESAR") {
        const newItem: CellItem = {
          jenis,
          label: label,
          durasi: dur,
          count: 1,
          details: detail
            ? [{ label, durasi: dur, detail }]
            : [{ label, durasi: dur, detail: {} }],
        };
        grid[idx][hIdx][sIdx].push(newItem);
      } else {
        // Untuk jenis lainnya, gunakan logika pengelompokan
        const existingItem = grid[idx][hIdx][sIdx].find(
          (item) => item.jenis === jenis
        );

        if (existingItem) {
          // Jika sudah ada, tambahkan ke details dan update count
          if (!existingItem.details) {
            existingItem.details = [];
          }
          existingItem.details.push({ label, durasi: dur, detail });
          existingItem.count = (existingItem.count || 1) + 1;
          // Hanya tampilkan count jika ada 2 atau lebih
          existingItem.label =
            existingItem.count >= 2
              ? `${jenis} (${existingItem.count})`
              : label;
        } else {
          // Jika belum ada, buat item baru
          const newItem: CellItem = {
            jenis,
            label: label, // Tampilkan format normal untuk single item
            durasi: dur,
            count: 1,
            details: detail
              ? [{ label, durasi: dur, detail }]
              : [{ label, durasi: dur, detail: {} }],
          };
          grid[idx][hIdx][sIdx].push(newItem);
        }
      }
    };

    // PBL
    for (const p of jadwalPBL) {
      const date = new Date(p.tanggal || "");
      if (isNaN(date.getTime())) {
        continue;
      }

      const iso = toIsoDate(date);
      const jam = formatJamTanpaDetik(p.jam_mulai || "");
      const jumlah = Number(p.jumlah_sesi || 2);

      const modul =
        p.modul_pbl?.nama_modul ||
        p.modul?.nama_modul ||
        `Modul ${p.modul_pbl_id || ""}`;
      const kelompok = p.kelompok_kecil?.nama_kelompok || p.kelompok || "";
      const dosen = p.dosen?.name || p.dosen_nama || "";
      const ruang = p.ruangan?.nama || p.ruangan_nama || "";
      const label = ["PBL", modul || "Modul tidak tersedia"].join(" - ");
      const semEntry =
        p.__semester != null
          ? Number(p.__semester)
          : mataKuliah?.semester
          ? Number(mataKuliah.semester)
          : null;

      // Detail untuk popup
      const detail = {
        modul,
        kelompok,
        dosen,
        ruang,
        kode: p.__kode,
        blok: p.__blok,
      };

      add(iso, jam, jumlah, label, "PBL", semEntry, detail);
    }

    // Jurnal Reading
    for (const j of jadwalJurnal) {
      const date = new Date(j.tanggal || "");
      if (isNaN(date.getTime())) {
        continue;
      }

      const iso = toIsoDate(date);
      const jam = formatJamTanpaDetik(j.jam_mulai || "");
      let jumlah = Number(j.jumlah_sesi || 0);
      if (!jumlah) {
        const s = parseTimeToMinutes(formatJamTanpaDetik(j.jam_mulai || ""));
        const e = parseTimeToMinutes(formatJamTanpaDetik(j.jam_selesai || ""));
        if (s != null && e != null && e > s)
          jumlah = Math.max(1, Math.round((e - s) / 50));
        else jumlah = 1;
      }

      const topik = j.topik || "";
      const kelompok = j.kelompok_kecil?.nama_kelompok || "";
      const dosen = j.dosen?.name || "";
      const ruang = j.ruangan?.nama || "";
      const label = ["Jurnal Reading", topik || "Topik tidak tersedia"].join(
        " - "
      );
      const semEntry =
        j.__semester != null
          ? Number(j.__semester)
          : mataKuliah?.semester
          ? Number(mataKuliah.semester)
          : null;

      // Detail untuk popup
      const detail = {
        topik,
        kelompok,
        dosen,
        ruang,
        kode: j.__kode,
        blok: j.__blok,
      };

      add(iso, jam, jumlah, label, "JURNAL", semEntry, detail);
    }

    // Kuliah Besar
    for (const kb of jadwalKuliahBesar) {
      const date = new Date(kb.tanggal || "");
      if (isNaN(date.getTime())) {
        continue;
      }

      const iso = toIsoDate(date);
      const jam = formatJamTanpaDetik(kb.jam_mulai || "");
      const jumlah = Number(kb.jumlah_sesi || 2);

      const materi = kb.materi || "";
      const topik = kb.topik || "";
      // Untuk semester antara (semester 8), prioritaskan dosen_names dari backend
      const dosen =
        kb.__semester === 8 && kb.dosen_names
          ? kb.dosen_names
          : kb.dosen?.name || kb.dosen_nama || "";
      const ruang = kb.ruangan?.nama || kb.ruangan_nama || "";

      // Tentukan jenis berdasarkan metadata
      let jenis:
        | "KULIAH_BESAR"
        | "NON_BLOK_NON_CSR"
        | "NON_BLOK_CSR"
        | "NON_BLOK_ANTARA" = "KULIAH_BESAR";
      if (kb.__jenis === "NON_BLOK_NON_CSR") {
        jenis = "NON_BLOK_NON_CSR";
      } else if (kb.__jenis === "NON_BLOK_CSR") {
        jenis = "NON_BLOK_CSR";
      } else if (kb.__jenis === "NON_BLOK_ANTARA") {
        jenis = "NON_BLOK_ANTARA";
      }

      const tipe =
        jenis === "NON_BLOK_NON_CSR"
          ? "Non Blok Non-CSR"
          : jenis === "NON_BLOK_CSR"
          ? "Non Blok CSR"
          : jenis === "NON_BLOK_ANTARA"
          ? "Non Blok Antara"
          : "Kuliah Besar";

      // Hanya untuk Kuliah Besar yang menampilkan detail lengkap
      let label;
      if (jenis === "KULIAH_BESAR") {
        // Untuk Kuliah Besar, tampilkan dalam format vertikal dengan dosen
        const labelParts = [tipe];

        if (topik) labelParts.push(`Topik: ${topik}`);
        if (ruang) labelParts.push(`Ruang: ${ruang}`);
        if (kb.kelompok_kecil?.nama_kelompok) labelParts.push(`Kelompok: ${kb.kelompok_kecil.nama_kelompok}`);
        if (dosen) labelParts.push(`Dosen: ${dosen}`);
        if (kb.__blok && kb.__blok > 0) labelParts.push(`Blok: ${kb.__blok}`);

        label = labelParts.join("\n");
      } else {
        // Untuk Non Blok, tampilkan format sederhana
        label = [tipe, materi || "Materi tidak tersedia"].join(" - ");
      }
      const semEntry =
        kb.__semester != null
          ? Number(kb.__semester)
          : mataKuliah?.semester
          ? Number(mataKuliah.semester)
          : null;

      // Detail untuk popup
      const detail = {
        materi,
        topik,
        dosen,
        dosen_names: kb.dosen_names, // Tambahkan dosen_names untuk semester antara
        ruang,
        kode: kb.__kode,
        blok: kb.__blok,
        tipe,
      };

      // Untuk Kuliah Besar, gunakan durasi yang lebih panjang (3 sesi)
      // Untuk jadwal lainnya, tetap 1 sesi
      const durasi = jenis === "KULIAH_BESAR" ? 3 : 1;

      add(iso, jam, durasi, label, jenis, semEntry, detail);
    }
    // Agenda Khusus
    for (const ak of jadwalAgendaKhusus) {
      const date = new Date(ak.tanggal || "");
      if (isNaN(date.getTime())) {
        continue;
      }

      const iso = toIsoDate(date);
      const jam = formatJamTanpaDetik(ak.jam_mulai || "");
      const jumlah = Number(ak.jumlah_sesi || 2);

      const agenda = ak.agenda || "";
      const kelompok = ak.kelompok_besar?.nama_kelompok || "";
      const dosen = ak.dosen?.name || ak.dosen_nama || "";
      const ruang = ak.ruangan?.nama || ak.ruangan_nama || "";
      const label = ["Agenda Khusus", agenda || "Agenda tidak tersedia"].join(
        " - "
      );
      const semEntry =
        ak.__semester != null
          ? Number(ak.__semester)
          : mataKuliah?.semester
          ? Number(mataKuliah.semester)
          : null;

      // Detail untuk popup
      const detail = {
        agenda,
        kelompok,
        dosen,
        ruang,
        kode: ak.__kode,
        blok: ak.__blok,
      };

      add(iso, jam, jumlah, label, "AGENDA_KHUSUS", semEntry, detail);
    }

    // Praktikum
    for (const pr of jadwalPraktikum) {
      const date = new Date(pr.tanggal || "");
      if (isNaN(date.getTime())) {
        continue;
      }

      const iso = toIsoDate(date);
      const jam = formatJamTanpaDetik(pr.jam_mulai || "");
      const jumlah = Number(pr.jumlah_sesi || 2);

      const topik = pr.topik || "";
      const kelompok = pr.kelompok_kecil?.nama_kelompok || "";

      // Parse dosen dari array objects - extract 'name' field
      let dosen = "";
      if (pr.dosen && Array.isArray(pr.dosen) && pr.dosen.length > 0) {
        // Array of dosen objects - extract names
        const dosenNames = pr.dosen.map((d: any) => d.name).filter(Boolean);
        dosen = dosenNames.join(", ");
      } else if (pr.dosen?.name) {
        // Single dosen object
        dosen = pr.dosen.name;
      } else if (pr.dosen_nama) {
        // Fallback to dosen_nama
        dosen = pr.dosen_nama;
      }

      const ruang = pr.ruangan?.nama || pr.ruangan_nama || "";
      const label = ["Praktikum", topik || "Topik tidak tersedia"].join(" - ");
      const semEntry =
        pr.__semester != null
          ? Number(pr.__semester)
          : mataKuliah?.semester
          ? Number(mataKuliah.semester)
          : null;

      // Detail untuk popup
      const detail = {
        topik,
        kelompok,
        dosen,
        ruang,
        kode: pr.__kode,
        blok: pr.__blok,
      };

      add(iso, jam, jumlah, label, "PRAKTIKUM", semEntry, detail);
    }

    return grid;
  }, [
    hariList,
    isGanjil,
    mataKuliah?.semester,
    jadwalPBL,
    jadwalJurnal,
    jadwalKuliahBesar,
    jadwalAgendaKhusus,
    jadwalPraktikum,
    sesiStartMinutes,
  ]);

  // State untuk search dan pagination
  const PAGE_SIZE_OPTIONS = [5, 7, 10, 15, 30];
  const [pageSize, setPageSize] = useState(7);
  const [page, setPage] = useState(0);
  const [showCalendar, setShowCalendar] = useState(false);
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<Date | null>(null);
  // State lokal untuk input date value (memungkinkan user mengetik tanpa gangguan)
  const [dateInputValue, setDateInputValue] = useState<string>('');
  const totalPages = Math.ceil(hariList.length / pageSize || 1);

  // Filter hariList berdasarkan search, pagination, dan jadwal yang ada
  const filteredHariListForSearch = useMemo(() => {
    // Fungsi untuk cek apakah hari memiliki jadwal
    const hasSchedule = (hariIndex: number): boolean => {
      // Cek semua semester dan semua sesi untuk hari ini
      for (let semIdx = 0; semIdx < gridItems.length; semIdx++) {
        for (let sesiIdx = 0; sesiIdx < sesiHarian.length; sesiIdx++) {
          const items = gridItems[semIdx]?.[hariIndex]?.[sesiIdx] || [];
          if (items.length > 0) {
            return true; // Ada jadwal di hari ini
          }
        }
      }
      return false; // Tidak ada jadwal
    };

    // Filter berdasarkan search
    let filtered = search.trim()
      ? hariList.filter(
          (h) =>
            h.hari.toLowerCase().includes(search.toLowerCase()) ||
            h.tanggal.toLowerCase().includes(search.toLowerCase())
        )
      : hariList;

    // Filter hari yang memiliki jadwal ATAU yang ada di additionalDates (tanggal yang dipilih user)
    filtered = filtered.filter((h, index) => {
      const originalIndex = hariList.findIndex((h2) => h2.iso === h.iso);
      // Jika tanggal ada di additionalDates, selalu tampilkan (meskipun kosong)
      if (additionalDates.has(h.iso)) {
        return true;
      }
      // Jika tidak ada di additionalDates, hanya tampilkan jika punya jadwal
      return originalIndex !== -1 && hasSchedule(originalIndex);
    });

    // Reset page jika hasil search berubah
    if (page >= Math.ceil(filtered.length / pageSize)) {
      setPage(0);
    }

    return filtered;
  }, [hariList, search, pageSize, page, gridItems, sesiHarian.length, additionalDates]);

  const prevPage = () => {
    setPage((p) => Math.max(0, p - 1));
  };

  const nextPage = () => {
    setPage((p) => Math.min(totalPages - 1, p + 1));
  };

  const goToPage = (idx: number) => {
    setPage(Math.max(0, Math.min(idx, totalPages - 1)));
  };

  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newPageSize = Number(e.target.value);
    setPageSize(newPageSize);
    setPage(0); // Reset ke halaman pertama
  };

  // Fungsi untuk konversi format tanggal DD/MM/YYYY ke ISO date
  const parseDateFromFormat = (dateStr: string): Date | null => {
    if (!dateStr) return null;
    try {
      // Format: DD/MM/YYYY
      const parts = dateStr.split('/');
      if (parts.length === 3) {
        const day = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1; // Month is 0-indexed
        const year = parseInt(parts[2], 10);
        return new Date(year, month, day);
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  // Fungsi untuk konversi Date ke format DD/MM/YYYY
  const formatDateToDisplay = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  // Fungsi untuk konversi Date ke format YYYY-MM-DD untuk input date
  const formatDateToInput = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Fungsi untuk navigasi ke tanggal tertentu (menampilkan seminggu penuh)
  const handleDateJump = (selectedDate: string | Date) => {
    if (!selectedDate) return;
    
    let targetDate: Date;
    if (selectedDate instanceof Date) {
      // Normalisasi tanggal ke local date tanpa time component
      targetDate = new Date(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate());
    } else {
      // Coba parse dari berbagai format
      const parsed = parseDateFromFormat(selectedDate);
      if (!parsed) {
        // Coba parse sebagai ISO date (YYYY-MM-DD)
        if (/^\d{4}-\d{2}-\d{2}/.test(selectedDate)) {
          const [year, month, day] = selectedDate.split('-').map(Number);
          targetDate = new Date(year, month - 1, day);
        } else {
          const isoDate = new Date(selectedDate);
          if (isNaN(isoDate.getTime())) {
            alert("Format tanggal tidak valid");
            return;
          }
          // Normalisasi ke local date
          targetDate = new Date(isoDate.getFullYear(), isoDate.getMonth(), isoDate.getDate());
        }
      } else {
        targetDate = parsed;
      }
    }
    
    // Pastikan tanggal valid
    if (isNaN(targetDate.getTime())) {
      alert("Tanggal tidak valid");
      return;
    }
    
    // Cari hari Senin dari minggu yang mencakup tanggal yang dipilih
    // getDay() mengembalikan 0 (Minggu) sampai 6 (Sabtu)
    const dayOfWeek = targetDate.getDay();
    // Hitung offset ke Senin (1 = Senin)
    // Jika Minggu (0), offset = -6 untuk ke Senin sebelumnya
    // Jika Senin (1), offset = 0
    // Jika Selasa (2), offset = -1, dst
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mondayDate = new Date(targetDate);
    mondayDate.setDate(targetDate.getDate() + mondayOffset);
    
    // Generate semua tanggal dari Senin sampai Minggu (7 hari)
    const weekDates: string[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(mondayDate);
      date.setDate(mondayDate.getDate() + i);
      const isoDate = toIsoDate(date);
      weekDates.push(isoDate);
    }
    
    // Tambahkan semua tanggal minggu tersebut ke additionalDates
    setAdditionalDates((prev) => {
      const newSet = new Set(prev);
      weekDates.forEach(isoDate => {
        newSet.add(isoDate);
      });
      return newSet;
    });
    
    // Set pending navigation ke tanggal yang dipilih (bukan Senin)
    const targetIso = toIsoDate(targetDate);
    setPendingDateNavigation(targetIso);
    setShowCalendar(false);
  };

  // Fungsi untuk handle date picker change (update state lokal, tidak langsung jump)
  const handleDatePickerChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateValue = e.target.value;
    // Update state lokal langsung - biarkan user mengetik tanpa gangguan
    setDateInputValue(dateValue);
    
    // Jika format lengkap dan valid, update selectedCalendarDate
    if (dateValue && dateValue.length === 10) {
      try {
        const [year, month, day] = dateValue.split('-').map(Number);
        if (year && month && day && year >= 1900 && year <= 2100 && month >= 1 && month <= 12 && day >= 1 && day <= 31) {
          const selectedDate = new Date(year, month - 1, day);
          if (!isNaN(selectedDate.getTime()) && 
              selectedDate.getFullYear() === year && 
              selectedDate.getMonth() === month - 1 && 
              selectedDate.getDate() === day) {
            setSelectedCalendarDate(selectedDate);
          }
        }
      } catch (error) {
        // Jika parsing gagal, biarkan user terus mengetik
      }
    } else if (!dateValue) {
      setSelectedCalendarDate(null);
    }
  };

  // Fungsi untuk handle date picker blur (saat user selesai memilih)
  const handleDatePickerBlur = () => {
    // Sync dateInputValue dengan selectedCalendarDate jika ada
    if (selectedCalendarDate) {
      setDateInputValue(formatDateToInput(selectedCalendarDate));
      // Baru panggil handleDateJump saat user selesai memilih
      handleDateJump(selectedCalendarDate);
    } else if (!dateInputValue) {
      // Jika kosong, reset
      setDateInputValue('');
    }
  };

  // Get min dan max date dari hariList (dengan rentang yang lebih luas untuk memudahkan pemilihan tahun)
  const getDateRange = () => {
    if (hariList.length === 0) {
      // Jika tidak ada hariList, berikan rentang default yang luas (10 tahun ke belakang dan 10 tahun ke depan)
      const today = new Date();
      const minDate = new Date(today.getFullYear() - 10, 0, 1);
      const maxDate = new Date(today.getFullYear() + 10, 11, 31);
      return {
        min: formatDateToInput(minDate),
        max: formatDateToInput(maxDate)
      };
    }
    
    const dates = hariList.map(day => {
      // Gunakan iso field jika ada, lebih reliable
      if (day.iso) {
        const [year, month, dayNum] = day.iso.split('-').map(Number);
        return new Date(year, month - 1, dayNum);
      }
      // Fallback ke parsing dari tanggal string
      const parts = day.tanggal.split('/');
      if (parts.length === 3) {
        const dayNum = parseInt(parts[0], 10);
        const month = parseInt(parts[1], 10) - 1;
        const year = parseInt(parts[2], 10);
        return new Date(year, month, dayNum);
      }
      return null;
    }).filter(d => d !== null && !isNaN(d.getTime())) as Date[];
    
    if (dates.length === 0) {
      // Jika tidak ada tanggal valid, berikan rentang default yang luas
      const today = new Date();
      const minDate = new Date(today.getFullYear() - 10, 0, 1);
      const maxDate = new Date(today.getFullYear() + 10, 11, 31);
      return {
        min: formatDateToInput(minDate),
        max: formatDateToInput(maxDate)
      };
    }
    
    const minDate = new Date(Math.min(...dates.map(d => d.getTime())));
    const maxDate = new Date(Math.max(...dates.map(d => d.getTime())));
    
    // Perluas rentang: 10 tahun sebelum tanggal minimum dan 10 tahun setelah tanggal maksimum
    // Ini memungkinkan user memilih tahun dengan lebih mudah
    const expandedMinDate = new Date(minDate.getFullYear() - 10, 0, 1);
    const expandedMaxDate = new Date(maxDate.getFullYear() + 10, 11, 31);
    
    // Normalisasi ke local date tanpa time component
    const minLocal = new Date(expandedMinDate.getFullYear(), expandedMinDate.getMonth(), expandedMinDate.getDate());
    const maxLocal = new Date(expandedMaxDate.getFullYear(), expandedMaxDate.getMonth(), expandedMaxDate.getDate());
    
    return {
      min: formatDateToInput(minLocal),
      max: formatDateToInput(maxLocal)
    };
  };

  const dateRange = getDateRange();


  // Sync dateInputValue dengan selectedCalendarDate
  useEffect(() => {
    if (selectedCalendarDate) {
      setDateInputValue(formatDateToInput(selectedCalendarDate));
    } else {
      setDateInputValue('');
    }
  }, [selectedCalendarDate]);

  // Reset search dan page saat blok atau semester berubah
  useEffect(() => {
    setSearch("");
    setPage(0);
    setShowCalendar(false);
    setSelectedCalendarDate(null);
    setDateInputValue('');
  }, [blok, semester, tipe]);

  // Reset calendar saat page berubah
  useEffect(() => {
    setShowCalendar(false);
  }, [page]);

  // Handle navigasi ke tanggal yang baru ditambahkan ke additionalDates
  useEffect(() => {
    if (pendingDateNavigation && filteredHariListForSearch.length > 0) {
      const targetIndex = filteredHariListForSearch.findIndex(
        (day) => day.iso === pendingDateNavigation
      );
      if (targetIndex !== -1) {
        const targetPage = Math.floor(targetIndex / pageSize);
        setPage(targetPage);
        setPendingDateNavigation(null); // Clear pending navigation
      }
    }
  }, [pendingDateNavigation, filteredHariListForSearch, pageSize]);

  // Tidak lagi gunakan rowSpan; setiap sel berisi list item bertumpuk

  // Fungsi untuk mengkonversi blok ke format semester (hanya untuk export Excel)
  const convertBlokToSemester = (blokInfo: string, semesterNumber?: number) => {
    // Jika ada semester number dari metadata, gunakan itu
    if (semesterNumber) {
      const semesterNames = [
        "",
        "SEMESTER I",
        "SEMESTER II",
        "SEMESTER III",
        "SEMESTER IV",
        "SEMESTER V",
        "SEMESTER VI",
        "SEMESTER VII",
        "SEMESTER VIII",
      ];
      return semesterNames[semesterNumber] || `SEMESTER ${semesterNumber}`;
    }

    // Jika blokInfo sudah dalam format semester, return as is
    if (blokInfo.includes("SEMESTER")) {
      return blokInfo;
    }

    // Konversi dari nama blok ke semester
    if (blokInfo.includes("I") || blokInfo.includes("1")) return "SEMESTER I";
    if (blokInfo.includes("II") || blokInfo.includes("2")) return "SEMESTER II";
    if (blokInfo.includes("III") || blokInfo.includes("3"))
      return "SEMESTER III";
    if (blokInfo.includes("IV") || blokInfo.includes("4")) return "SEMESTER IV";
    if (blokInfo.includes("V") || blokInfo.includes("5")) return "SEMESTER V";
    if (blokInfo.includes("VI") || blokInfo.includes("6")) return "SEMESTER VI";
    if (blokInfo.includes("VII") || blokInfo.includes("7"))
      return "SEMESTER VII";
    if (blokInfo.includes("VIII") || blokInfo.includes("8"))
      return "SEMESTER VIII";

    // Default fallback
    return blokInfo || "SEMESTER I";
  };

  // Export ke Excel dengan data langsung dari state variables
  const exportJadwalToExcel = async () => {
    try {
      const ExcelJS = (await import("exceljs")).default;
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Jadwal Blok");

      // Set properties
      workbook.creator = "ISME Web System";
      workbook.lastModifiedBy = "ISME Web System";
      workbook.created = new Date();
      workbook.modified = new Date();

      // Judul utama
      const titleRow = worksheet.addRow(["JADWAL BLOK PERKULIAHAN"]);
      worksheet.mergeCells("A1:J1");
      titleRow.getCell(1).font = {
        bold: true,
        size: 18,
        color: { argb: "FF1F2937" },
      };
      titleRow.getCell(1).alignment = {
        vertical: "middle",
        horizontal: "center",
      };
      titleRow.getCell(1).fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFF3F4F6" },
      };

      // Info semester
      let subtitle = "";

      if (isAntara) {
        subtitle = `Semester: Antara | Blok: 1-4 | Export: ${new Date().toLocaleDateString(
          "id-ID"
        )}`;
      } else if (isGanjil) {
        subtitle = `Semester: Ganjil | Blok: 1-4 | Export: ${new Date().toLocaleDateString(
          "id-ID"
        )}`;
      } else if (isGenap) {
        subtitle = `Semester: Genap | Blok: 1-4 | Export: ${new Date().toLocaleDateString(
          "id-ID"
        )}`;
      }

      const infoRow = worksheet.addRow([subtitle]);
      worksheet.mergeCells("A2:J2");
      infoRow.getCell(1).font = {
        bold: true,
        size: 12,
        color: { argb: "FF6B7280" },
      };
      infoRow.getCell(1).alignment = {
        vertical: "middle",
        horizontal: "center",
      };

      // Spasi
      worksheet.addRow([]);

      // Header tabel dengan 10 kolom terpisah
      const headerRow1 = worksheet.addRow([
        "TANGGAL",
        "HARI",
        "JAM",
        "JENIS KEGIATAN",
        "TIPE",
        "TOPIK",
        "MATERI",
        "DOSEN",
        "RUANG",
        "SEMESTER",
      ]);

      // Styling header
      headerRow1.eachCell((cell, colNumber) => {
        cell.font = {
          bold: true,
          size: 12,
          color: { argb: "FFFFFFFF" },
        };
        cell.alignment = {
          vertical: "middle",
          horizontal: "center",
        };
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF3B82F6" },
        };
        cell.border = {
          top: { style: "medium", color: { argb: "FF1E40AF" } },
          left: { style: "medium", color: { argb: "FF1E40AF" } },
          bottom: { style: "medium", color: { argb: "FF1E40AF" } },
          right: { style: "medium", color: { argb: "FF1E40AF" } },
        };
      });

      // Set lebar kolom
      worksheet.getColumn(1).width = 15; // TANGGAL
      worksheet.getColumn(2).width = 12; // HARI
      worksheet.getColumn(3).width = 12; // JAM
      worksheet.getColumn(4).width = 20; // JENIS KEGIATAN
      worksheet.getColumn(5).width = 20; // TIPE
      worksheet.getColumn(6).width = 25; // TOPIK
      worksheet.getColumn(7).width = 25; // MATERI
      worksheet.getColumn(8).width = 25; // DOSEN
      worksheet.getColumn(9).width = 15; // RUANG
      worksheet.getColumn(10).width = 12; // SEMESTER

      // Tentukan semester yang akan difilter
      let targetSemesters: number[] = [];
      if (isGanjil) {
        targetSemesters = [1, 3, 5, 7];
      } else if (isGenap) {
        targetSemesters = [2, 4, 6];
      } else if (isAntara) {
        targetSemesters = [8]; // Semester antara
      }

      // Kumpulkan semua data jadwal dari state variables
      const allSchedules: any[] = [];

      // Helper function untuk menambahkan jadwal ke array
      const addSchedule = (item: any, jenis: string) => {
        // Filter berdasarkan semester
        if (!targetSemesters.includes(item.__semester)) {
          return; // Skip jika tidak sesuai semester
        }

        // Debug khusus untuk PRAKTIKUM
        if (jenis === "PRAKTIKUM") {
          if (typeof item.dosen === "string") {
            try {
              const parsed = JSON.parse(item.dosen);
            } catch (e) {
            }
          }
        }

        let tanggal = item.tanggal || "";

        // Fix tanggal format - remove T00:00:00.000000Z part
        if (tanggal.includes("T")) {
          tanggal = tanggal.split("T")[0];
        }
        const jamMulai = item.jam_mulai || "";
        const jamSelesai = item.jam_selesai || "";
        const jam =
          jamMulai && jamSelesai
            ? `${jamMulai}-${jamSelesai}`
            : jamMulai || jamSelesai || "";

        // Format tanggal ke hari
        let hari = "";
        if (tanggal) {
          const date = new Date(tanggal);
          const hariNames = [
            "Minggu",
            "Senin",
            "Selasa",
            "Rabu",
            "Kamis",
            "Jumat",
            "Sabtu",
          ];
          hari = hariNames[date.getDay()] || "";
        }

        // Tentukan tipe berdasarkan jenis dan data
        let tipe = "";
        if (
          jenis === "PBL" ||
          jenis === "JURNAL" ||
          jenis === "KULIAH_BESAR" ||
          jenis === "AGENDA_KHUSUS" ||
          jenis === "PRAKTIKUM"
        ) {
          // Untuk kegiatan blok, tentukan blok ke berapa
          const semester = item.__semester;
          if (semester === 1 || semester === 2) {
            tipe = "Blok 1";
          } else if (semester === 3 || semester === 4) {
            tipe = "Blok 2";
          } else if (semester === 5 || semester === 6) {
            tipe = "Blok 3";
          } else if (semester === 7) {
            tipe = "Blok 4";
          } else if (semester === 8) {
            tipe = "Blok Antara";
          } else {
            tipe = `Blok ${Math.ceil(semester / 2)}`;
          }
        } else {
          // Untuk non blok, gunakan data real dari jenis yang sudah ditentukan saat fetch
          if (jenis === "NON_BLOK_CSR") {
            tipe = "Non Blok CSR";
          } else if (jenis === "NON_BLOK_NON_CSR") {
            tipe = "Non Blok Non-CSR";
          } else if (jenis === "NON_BLOK_ANTARA") {
            tipe = "Non Blok Antara";
          } else {
            // Fallback: cek dari kode mata kuliah
            const kode = item.__kode || "";
            if (kode.includes("MKA")) {
              tipe = "Non Blok Antara";
            } else if (item.kategori?.nama) {
              // Jika ada kategori, berarti CSR
              tipe = "Non Blok CSR";
            } else {
              // Default untuk MKU tanpa kategori
              tipe = "Non Blok Non-CSR";
            }
          }
        }

        // Parse topik dan materi
        let topik = "";
        let materi = "";

        if (jenis === "PBL") {
          topik = item.skenario || item.judul || "";
          materi = item.modul || item.materi || "";
        } else if (jenis === "JURNAL") {
          topik = item.judul || item.topik || "";
          materi = item.materi || "";
        } else if (jenis === "KULIAH_BESAR") {
          topik = item.topik || "";
          materi = item.materi || "";
        } else if (jenis === "AGENDA_KHUSUS") {
          topik = item.agenda || item.topik || "";
          materi = item.materi || "";
        } else if (jenis === "PRAKTIKUM") {
          topik = item.topik || "";
          materi = item.materi || "";
        } else {
          // Non Blok
          topik = item.topik || "";
          materi = item.materi || item.kategori?.nama || "";
        }

        // Parse dosen - DIFFERENT LOGIC FOR DIFFERENT TYPES
        let dosen = "";

        if (jenis === "PRAKTIKUM") {
          // PRAKTIKUM - HAPUS DOSEN (kosongkan)
          dosen = "";
        } else if (jenis === "KULIAH_BESAR") {
          // KULIAH_BESAR (Semester Antara) - Different format

          if (item.__semester === 8 && item.dosen_names) {
            // Semester Antara - use dosen_names from backend
            dosen = item.dosen_names;
          } else if (item.dosen && Array.isArray(item.dosen)) {
            // Array format for other semesters
            const names = item.dosen.map((d) => d.name).filter(Boolean);
            dosen = names.join(", ");
          } else if (typeof item.dosen === "string") {
            // String format
            const match = item.dosen.match(/"name":"([^"]+)"/);
            if (match) {
              dosen = match[1];
            }
          } else if (item.dosen?.name) {
            // Single object
            dosen = item.dosen.name;
          }
        } else {
          // Other types (PBL, Jurnal, etc.)
          dosen = item.dosen_nama || item.dosen_names || item.dosen?.name || "";
        }


        // Final fallback for empty dosen
        if (!dosen) {
          // Coba semua kemungkinan parsing dosen
          let dosenFound = false;

          // Method 1: Array of dosen objects
          if (Array.isArray(item.dosen) && !dosenFound) {

            const dosenNames = item.dosen
              .map((dosenObj, index) => {
                const name = dosenObj.name || dosenObj.nama || "";
                return name;
              })
              .filter((name) => name.length > 0);

            if (dosenNames.length > 0) {
              dosen = dosenNames.join(", ");
              dosenFound = true;
            }
          }

          // Method 2: Single dosen object
          if (
            item.dosen &&
            typeof item.dosen === "object" &&
            !Array.isArray(item.dosen) &&
            !dosenFound
          ) {
            dosen = item.dosen.name || item.dosen.nama || "";
            if (dosen) {
              dosenFound = true;
            }
          }

          // Method 3: String fields (prioritas untuk semester antara)
          if (!dosenFound) {

            const stringFields = [
              "dosen_names", // Laravel attribute method - PRIORITAS UTAMA
              "dosen_nama",
              "nama_dosen",
              "pengampu.nama",
              "pengampu.name",
              "instructor",
              "teacher",
              "lecturer",
            ];

            for (const field of stringFields) {
              let value = "";
              if (field.includes(".")) {
                const [obj, prop] = field.split(".");
                value = item[obj]?.[prop] || "";
              } else {
                value = item[field] || "";
              }

              if (value && typeof value === "string") {
                dosen = value;
                dosenFound = true;
                break;
              }
            }
          }

          // Method 4: Resolve dosen_ids ke nama dosen
          if (!dosenFound && item.dosen_ids && Array.isArray(item.dosen_ids)) {
            // Coba ambil nama dosen dari relasi atau field lain yang mungkin ada
            if (item.dosen && Array.isArray(item.dosen)) {
              // Jika ada array dosen tapi nama kosong, coba field lain dari object dosen
              const dosenNames = item.dosen
                .map((dosenObj) => {
                  return (
                    dosenObj.name ||
                    dosenObj.nama ||
                    dosenObj.full_name ||
                    dosenObj.display_name ||
                    ""
                  );
                })
                .filter((name) => name.length > 0);

              if (dosenNames.length > 0) {
                dosen = dosenNames.join(", ");
                dosenFound = true;
              }
            }

            // Jika masih belum dapat nama, coba dari method getDosenNamesAttribute Laravel
            if (!dosenFound && item.dosen_names) {
              dosen = item.dosen_names;
              dosenFound = true;
            }

            // Jika masih belum dapat, tampilkan "Agenda Khusus" sebagai fallback untuk semester antara
            if (!dosenFound) {
              if (isAntara) {
                dosen = "Agenda Khusus";
              } else {
                dosen = `IDs: ${item.dosen_ids.join(", ")}`;
              }
              dosenFound = true;
            }
          }

          // Method 5: Final fallback
          if (!dosenFound && item.dosen) {
            dosen =
              typeof item.dosen === "string"
                ? item.dosen
                : JSON.stringify(item.dosen);
            dosenFound = true;
          }

          // Extra debug untuk semester antara yang kosong
          if (jenis === "KULIAH_BESAR" && item.__semester === 8 && !dosen) {
          }
        } else {
          // Untuk jenis lain, gunakan parsing biasa
          dosen =
            item.dosen_nama ||
            item.dosen_names ||
            item.dosen?.name ||
            item.dosen?.nama ||
            item.dosen ||
            "";
        }

        // Parse ruang
        const ruang =
          item.ruangan_nama || item.ruangan?.nama || item.ruang || "";

        // Convert semester number ke format
        // Untuk Semester Antara, semua jadwal harus menampilkan "Semester Antara"
        let semesterFormat = "";
        if (isAntara) {
          semesterFormat = "Semester Antara";
        } else {
          semesterFormat = convertBlokToSemester("", item.__semester);
        }

        allSchedules.push({
          tanggal: tanggal,
          hari: hari,
          jam: jam,
          jenis: jenis,
          tipe: tipe,
          topik: topik,
          materi: materi,
          dosen: dosen,
          ruang: ruang,
          semester: semesterFormat,
        });
      };

      // Process semua jenis jadwal
      jadwalPBL.forEach((item) => addSchedule(item, "PBL"));
      jadwalJurnal.forEach((item) => addSchedule(item, "JURNAL"));
      jadwalKuliahBesar.forEach((item) => {
        // Untuk jadwal kuliah besar, cek apakah ini non-blok berdasarkan metadata
        if (item.__jenis === "NON_BLOK_NON_CSR") {
          addSchedule(item, "NON_BLOK_NON_CSR");
        } else if (item.__jenis === "NON_BLOK_CSR") {
          addSchedule(item, "NON_BLOK_CSR");
        } else if (item.__jenis === "NON_BLOK_ANTARA") {
          addSchedule(item, "NON_BLOK_ANTARA");
        } else {
          addSchedule(item, "KULIAH_BESAR");
        }
      });
      jadwalAgendaKhusus.forEach((item) => addSchedule(item, "AGENDA_KHUSUS"));

      jadwalPraktikum.forEach((item, index) => {
        addSchedule(item, "PRAKTIKUM");
      });

      // Sort by tanggal, then jam
      allSchedules.sort((a, b) => {
        const dateA = new Date(a.tanggal);
        const dateB = new Date(b.tanggal);
        if (dateA.getTime() !== dateB.getTime()) {
          return dateA.getTime() - dateB.getTime();
        }
        return a.jam.localeCompare(b.jam);
      });

      // Add data rows
      allSchedules.forEach((schedule, index) => {
        const row = worksheet.addRow([
          schedule.tanggal,
          schedule.hari,
          schedule.jam,
          schedule.jenis,
          schedule.tipe,
          schedule.topik,
          schedule.materi,
          schedule.dosen,
          schedule.ruang,
          schedule.semester,
        ]);

        // Styling data rows
        row.eachCell((cell, colNumber) => {
          cell.alignment = {
            vertical: "middle",
            horizontal: colNumber <= 3 ? "center" : "left",
            wrapText: true,
          };
          cell.font = { size: 10 };
          cell.border = {
            top: { style: "thin", color: { argb: "FFE5E7EB" } },
            left: { style: "thin", color: { argb: "FFE5E7EB" } },
            bottom: { style: "thin", color: { argb: "FFE5E7EB" } },
            right: { style: "thin", color: { argb: "FFE5E7EB" } },
          };

          // Alternating row colors
          if (index % 2 === 0) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF9FAFB" },
            };
          }
        });
      });

      // Footer dengan informasi tambahan
      worksheet.addRow([]);
      const footerRow = worksheet.addRow([
        "Keterangan Jenis Kegiatan: PBL = Problem Based Learning, JURNAL = Jurnal Reading, KULIAH_BESAR = Kuliah Besar, AGENDA_KHUSUS = Agenda Khusus, PRAKTIKUM = Praktikum",
      ]);
      worksheet.mergeCells(`A${worksheet.rowCount}:J${worksheet.rowCount}`);
      footerRow.getCell(1).font = {
        italic: true,
        size: 9,
        color: { argb: "FF6B7280" },
      };
      footerRow.getCell(1).alignment = {
        vertical: "middle",
        horizontal: "left",
      };

      // Set row height untuk header
      worksheet.getRow(4).height = 25;

      // Download file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `JadwalBlok_${
        isGanjil
          ? "Ganjil"
          : isGenap
          ? "Genap"
          : isAntara
          ? "Antara"
          : "Unknown"
      }_${new Date().toISOString().split("T")[0]}.xlsx`;
      link.click();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      alert("Gagal export ke Excel. Silakan coba lagi.");
    }
  };

  const exportJadwalToHTML = () => {
    const css = `
      <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        table { border-collapse: collapse; width: 100%; margin-bottom: 20px; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
        th { background-color: #f2f2f2; font-weight: bold; }
        .istirahat { background-color: #f9f9f9; text-align: center; font-style: italic; }
        .pbl { border-left: 3px solid #3B82F6; background-color: #EFF6FF; }
        .jurnal { border-left: 3px solid #10B981; background-color: #ECFDF5; }
        .kuliah-besar { border-left: 3px solid #8B5CF6; background-color: #F3E8FF; }
        .agenda-khusus { border-left: 3px solid #F59E0B; background-color: #FFFBEB; }
        .praktikum { border-left: 3px solid #EF4444; background-color: #FEF2F2; }
        .non-blok-non-csr { border-left: 3px solid #EAB308; background-color: #FEFCE8; }
        .non-blok-csr { border-left: 3px solid #EC4899; background-color: #FDF2F8; }
        .non-blok-antara { border-left: 3px solid #06B6D4; background-color: #ECFEFF; }
        .schedule-item { margin-bottom: 4px; padding: 3px; font-size: 10px; line-height: 1.3; }
      </style>
    `;

    let html = "<table>";
    html += "<thead><tr>";
    html += '<th rowspan="3">HARI / TANGGAL</th>';
    html += '<th rowspan="3">JAM</th>';
    semesterKolom.forEach((sem) => {
      html += `<th>${sem.nama}</th>`;
    });
    html += "</tr><tr>";
    semesterKolom.forEach((sem) => {
      html += `<th>${sem.mataKuliah}</th>`;
    });
    html += "</tr><tr>";
    semesterKolom.forEach(() => {
      html += "<th>KEGIATAN</th>";
    });
    html += "</tr></thead><tbody>";

    for (let h = 0; h < hariList.length; h++) {
      const hari = hariList[h];
      for (let s = 0; s < sesiHarian.length; s++) {
        const isIstirahat = !!sesiHarian[s].isIstirahat;
        const rowClass = isIstirahat
          ? "istirahat"
          : s % 2 === 0
          ? "even"
          : "odd";
        html += `<tr class="${rowClass}">`;
        if (s === 0) {
          html += `<td rowspan="${
            sesiHarian.length
          }"><div class="hari">${hariList[
            h
          ].hari.toUpperCase()}</div><div class="tanggal">${
            hariList[h].tanggal
          }</div></td>`;
        }
        html += `<td>${sesiHarian[s].jam}</td>`;
        if (isIstirahat) {
          html += `<td class="istirahat" colspan="${semesterKolom.length}">Istirahat</td>`;
        } else {
          semesterKolom.forEach((_, semIdx) => {
            const items = gridItems[semIdx]?.[h]?.[s] || [];
            const content = items
              .map((it: CellItem) => {
                const jenisClass =
                  {
                    PBL: "pbl",
                    JURNAL: "jurnal",
                    KULIAH_BESAR: "kuliah-besar",
                    AGENDA_KHUSUS: "agenda-khusus",
                    PRAKTIKUM: "praktikum",
                    NON_BLOK_NON_CSR: "non-blok-non-csr",
                    NON_BLOK_CSR: "non-blok-csr",
                    NON_BLOK_ANTARA: "non-blok-antara",
                  }[it.jenis] || "";
                return `<div class="schedule-item ${jenisClass}" style="white-space:pre-line; text-align:left;">${it.label}</div>`;
              })
              .join("");
            html += `<td>${content}</td>`;
          });
        }
        html += "</tr>\n";
      }
      // Tambahkan baris pemisah antar hari
      html += `<tr><td colspan="${
        2 + semesterKolom.length
      }" style="background: #F3F4F6; height: 16px; border: none;"></td></tr>\n`;
    }
    html += "</tbody></table>";

    // Download file
    const blob = new Blob(
      [`<html><head>${css}</head><body>${html}</body></html>`],
      { type: "text/html" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `JadwalBlok_${
      blok === "all" ? "SemuaBlok" : blok
    }_Semester${semester}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Tambahkan fungsi utilitas pewarnaan baris
  function getRowClass(isIstirahat: boolean, sesiIdx: number) {
    if (isIstirahat) return "bg-gray-100 dark:bg-gray-700";
    return sesiIdx % 2 === 1
      ? "bg-gray-50 dark:bg-gray-800"
      : "bg-white dark:bg-gray-900";
  }

  // Cari index hari ini di hariList
  const today = new Date();
  const todayIso = toIsoDate(today);
  const todayIdx = hariList.findIndex((h) => h.iso === todayIso);
  const jadwalHariIni = todayIdx !== -1 ? hariList[todayIdx] : null;

  // Skeleton Loading Component
  if (loading) {
    return (
      <div>
        {/* Header Skeleton */}
        <div className="flex flex-col gap-2 pt-1">
          {/* Back Button Skeleton */}
          <div className="mb-4 flex items-center gap-2">
            <div className="w-5 h-5 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
            <div className="h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
          </div>

          {/* Title Skeleton */}
          <div className="h-8 w-80 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse" />

          {/* Info Skeleton */}
          <div className="flex flex-wrap gap-4 items-center">
            <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
            <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
          </div>
        </div>

        {/* Search and Export Section Skeleton */}
        <div className="flex justify-between items-center mb-6 mt-8">
          <div className="h-10 w-80 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse" />
          <div className="flex gap-3">
            <div className="h-10 w-32 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse" />
            <div className="h-10 w-40 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse" />
          </div>
        </div>

        {/* Table Skeleton */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          {/* Table Header Skeleton */}
          <div className="bg-gray-50 dark:bg-gray-700/50 px-4 py-3 border-b border-gray-200 dark:border-gray-700">
            <div className="grid grid-cols-13 gap-2">
              <div className="h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
              {Array.from({ length: 12 }).map((_, i) => (
                <div
                  key={i}
                  className="h-4 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"
                />
              ))}
            </div>
          </div>

          {/* Table Body Skeleton */}
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {Array.from({ length: 7 }).map((_, rowIndex) => (
              <div key={rowIndex} className="grid grid-cols-13 gap-2 p-4">
                {rowIndex === 0 ? (
                  // First column (day) skeleton
                  <div className="row-span-12 flex flex-col items-center justify-center">
                    <div className="h-6 w-16 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse" />
                    <div className="h-3 w-12 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                  </div>
                ) : null}

                {/* Time column skeleton */}
                <div className="h-8 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />

                {/* Schedule cells skeleton */}
                {Array.from({ length: 11 }).map((_, cellIndex) => (
                  <div
                    key={cellIndex}
                    className="h-8 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse"
                  />
                ))}
              </div>
            ))}
          </div>
        </div>

        {/* Pagination Skeleton */}
        <div className="flex justify-between items-center mt-6">
          <div className="flex items-center gap-3">
            <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
            <div className="h-8 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
            <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
          </div>

          <div className="flex items-center gap-2">
            <div className="h-8 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
            <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
            <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
            <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
            <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
            <div className="h-8 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
          </div>

          <div className="flex items-center gap-2">
            <div className="h-4 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
            <div className="h-8 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col gap-2 pt-1 ">
        <button
          onClick={() =>
            navigate("/peta-blok", {
              state: { semester: isGanjil ? "ganjil" : "genap" },
            })
          }
          className="mb-4 flex items-center gap-2 text-brand-500 hover:text-brand-600 text-sm font-medium bg-transparent border-none focus:outline-none"
        >
          <svg
            className="w-5 h-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Kembali
        </button>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">
          {blok === "NONBLOK"
            ? "Peta Jadwal Non Blok"
            : blok === "all"
            ? "Peta Jadwal Semua Blok"
            : "Peta Jadwal Blok + Non Blok"}
        </h1>
        <div className="flex flex-wrap gap-4 items-center text-sm text-gray-500 dark:text-gray-300">
          <span>
            Mode:{" "}
            <b>
              {blok === "NONBLOK"
                ? "Non Blok"
                : blok === "all"
                ? "Semua Blok"
                : "Gabungan Blok + Non Blok"}
            </b>
          </span>
          <span>
            Semester:{" "}
            <b>{isAntara ? "Antara" : isGanjil ? "Ganjil" : "Genap"}</b>
          </span>
        </div>
      </div>
      {/* Search and Export Section */}
      <div className="flex justify-between items-center mb-6 mt-8">
        <div className="flex-1 max-w-md">
          <input
            type="text"
            placeholder="Cari hari atau tanggal..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportJadwalToExcel}
            className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            Export ke Excel
          </button>
          <button
            onClick={exportJadwalToHTML}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Export ke HTML (Excel Style)
          </button>
        </div>
      </div>
      {/* Pagination Controls */}
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Tampil per halaman:
          </span>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="px-2 py-1 border border-gray-300 rounded text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Menampilkan {Math.min(pageSize, filteredHariListForSearch.length)}{" "}
            dari {filteredHariListForSearch.length} hari
          </span>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 relative">
            <span className="text-sm text-gray-600 dark:text-gray-300">
              Lompat ke tanggal:
            </span>
            <div className="relative">
              <input
                type="date"
                min={dateRange.min || undefined}
                max={dateRange.max || undefined}
                value={dateInputValue}
                onChange={handleDatePickerChange}
                onBlur={handleDatePickerBlur}
                onClick={() => setShowCalendar(true)}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg dark:bg-gray-800 dark:border-gray-600 dark:text-white bg-white hover:border-gray-400 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent cursor-pointer min-w-[160px]"
                placeholder="Pilih tanggal"
                title="Klik untuk memilih tanggal. Gunakan dropdown tahun untuk memilih tahun yang berbeda."
              />
              <svg
                className="absolute right-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
            {selectedCalendarDate && (
              <button
                onClick={() => {
                  setSelectedCalendarDate(null);
                  setShowCalendar(false);
                }}
                className="px-2 py-1 text-xs text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                title="Hapus pilihan tanggal"
              >
                ✕
              </button>
            )}
          </div>
          <button
            onClick={prevPage}
            disabled={page === 0}
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800"
          >
            Prev
          </button>
          {Array.from(
            {
              length: Math.min(
                5,
                Math.ceil(filteredHariListForSearch.length / pageSize)
              ),
            },
            (_, i) => {
              const pageNum =
                Math.max(
                  0,
                  Math.min(
                    Math.ceil(filteredHariListForSearch.length / pageSize) - 5,
                    page - 2
                  )
                ) + i;
              return (
                <button
                  key={pageNum}
                  onClick={() => goToPage(pageNum)}
                  className={`px-3 py-1 text-sm border rounded ${
                    page === pageNum
                      ? "bg-green-500 text-white border-green-500"
                      : "border-gray-300 hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800"
                  }`}
                >
                  {pageNum + 1}
                </button>
              );
            }
          )}
          <button
            onClick={nextPage}
            disabled={
              page >= Math.ceil(filteredHariListForSearch.length / pageSize) - 1
            }
            className="px-3 py-1 text-sm border border-gray-300 rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-700 disabled:opacity-50 text-gray-600 dark:text-gray-300 bg-gray-100 dark:bg-gray-800"
          >
            Next
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-300">
            Lompat ke hari:
          </span>
          <select
            value={page}
            onChange={(e) => goToPage(Number(e.target.value))}
            className="px-2 py-1 border border-gray-300 rounded text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-white bg-gray-100"
          >
            {Array.from(
              {
                length: Math.ceil(filteredHariListForSearch.length / pageSize),
              },
              (_, idx) => (
                <option key={idx} value={idx}>
                  Hari {idx + 1}
                </option>
              )
            )}
          </select>
        </div>
      </div>
      {/* Main Schedule Table */}
      {!loading && !error && (
        <div
          className="max-w-full overflow-x-auto hide-scroll"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          <style>{`
            .max-w-full::-webkit-scrollbar { display: none; }
            .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
            .hide-scroll::-webkit-scrollbar { display: none; }
          `}</style>
          <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
            <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <tr>
                <th
                  rowSpan={3}
                  className="w-24 px-4 py-2 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle text-sm font-medium dark:text-white"
                >
                  HARI
                </th>
                <th
                  rowSpan={3}
                  className="w-32 px-4 py-2 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle text-sm font-medium dark:text-white"
                >
                  JAM
                </th>
                {semesterKolom.map((sem) => (
                  <th
                    key={sem.nama}
                    className="px-4 py-2 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle text-brand-700 dark:text-brand-300 text-base font-medium border-r last:border-r-0"
                  >
                    {sem.nama}
                  </th>
                ))}
              </tr>
              <tr>
                {semesterKolom.map((sem) => (
                  <th
                    key={sem.nama + "-matkul"}
                    className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle border-r last:border-r-0 text-xs font-normal dark:text-gray-200"
                  >
                    {sem.mataKuliah}
                  </th>
                ))}
              </tr>
              <tr>
                {semesterKolom.map((sem) => (
                  <th
                    key={sem.nama + "-kegiatan"}
                    className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle border-r last:border-r-0 text-xs font-normal dark:text-gray-200"
                  >
                    KEGIATAN
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredHariListForSearch
                .slice(page * pageSize, (page + 1) * pageSize)
                .map((hari, h) => {
                  const originalIndex = hariList.findIndex(
                    (h2) => h2.iso === hari.iso
                  );
                  return sesiHarian.map((sesi, sesiIdx) => {
                    const isIstirahat = sesi.isIstirahat;
                    return (
                      <tr
                        key={`${h}-${sesiIdx}`}
                        className={getRowClass(!!isIstirahat, sesiIdx)}
                      >
                        {sesiIdx === 0 && (
                          <td
                            rowSpan={sesiHarian.length}
                            className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-center align-middle bg-gray-50 dark:bg-gray-900 text-xs font-medium dark:text-gray-200"
                          >
                            <span className="font-bold text-base text-gray-800 dark:text-white">
                              {hari.hari}
                            </span>
                            <br />
                            <span className="text-xs text-gray-400">
                              {hari.tanggal}
                            </span>
                          </td>
                        )}
                        <td className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-center align-middle bg-gray-50 dark:bg-gray-900 text-xs font-normal dark:text-gray-200 min-w-[8rem] whitespace-pre-line">
                          {sesi.jam}
                        </td>
                        {isIstirahat ? (
                          <td
                            colSpan={semesterKolom.length}
                            className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-center italic text-gray-400 bg-gray-100 dark:bg-gray-700 font-normal"
                          >
                            Istirahat
                          </td>
                        ) : (
                          semesterKolom.map((sem, semIdx) => (
                            <td
                              key={sem.nama + "-" + hari.hari + "-" + sesiIdx}
                              className={`px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-left align-top border-r last:border-r-0 min-w-[16rem] dark:text-gray-200 bg-inherit`}
                            >
                              {(
                                originalIndex >= 0 && originalIndex < hariList.length
                                  ? gridItems[semIdx]?.[originalIndex]?.[sesiIdx] || []
                                  : []
                              ).map((it: CellItem, i: number) => (
                                <div
                                  key={i}
                                  className={`mb-1.5 p-1.5 rounded-sm border-l-2 text-[10px] leading-3.5 font-medium ${
                                    it.jenis === "PBL"
                                      ? "border-blue-500 bg-blue-50/30 dark:bg-blue-900/20 dark:border-blue-400 text-blue-700 dark:text-blue-200"
                                      : it.jenis === "JURNAL"
                                      ? "border-green-500 bg-green-50/30 dark:bg-green-900/20 dark:border-green-400 text-green-700 dark:text-green-200"
                                      : it.jenis === "KULIAH_BESAR"
                                      ? "border-purple-500 bg-purple-50/30 dark:bg-purple-900/20 dark:border-purple-400 text-purple-700 dark:text-purple-200"
                                      : it.jenis === "AGENDA_KHUSUS"
                                      ? "border-orange-500 bg-orange-50/30 dark:bg-orange-900/20 dark:border-orange-400 text-orange-700 dark:text-orange-200"
                                      : it.jenis === "PRAKTIKUM"
                                      ? "border-red-500 bg-red-50/30 dark:bg-red-900/20 dark:border-red-400 text-red-700 dark:text-red-200"
                                      : it.jenis === "NON_BLOK_NON_CSR"
                                      ? "border-yellow-500 bg-yellow-50/30 dark:bg-yellow-900/20 dark:border-yellow-400 text-yellow-700 dark:text-yellow-200"
                                      : it.jenis === "NON_BLOK_CSR"
                                      ? "border-pink-500 bg-pink-50/30 dark:bg-pink-900/20 dark:border-pink-400 text-pink-700 dark:text-pink-200"
                                      : it.jenis === "NON_BLOK_ANTARA"
                                      ? "border-cyan-500 bg-cyan-50/30 dark:bg-cyan-900/20 dark:border-cyan-400 text-cyan-700 dark:text-cyan-200"
                                      : "border-brand-200 bg-brand-50/30 dark:bg-brand-900/20 dark:border-brand-700 text-gray-700 dark:text-gray-200"
                                  } cursor-pointer hover:opacity-80`}
                                  onClick={() => {
                                    if (it.details && it.details.length > 0) {
                                      setPopupData({
                                        jenis: it.jenis,
                                        details: it.details,
                                      });
                                      setShowPopup(true);
                                    }
                                  }}
                                >
                                  <div className="whitespace-pre-line">
                                    {it.label}
                                  </div>
                                </div>
                              ))}
                            </td>
                          ))
                        )}
                      </tr>
                    );
                  });
                })}
            </tbody>
          </table>
        </div>
      )}

      {/* Popup Detail Jadwal */}
      <AnimatePresence>
        {showPopup && popupData && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowPopup(false)}
            ></motion.div>

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowPopup(false)}
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
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                      Detail {formatJenisJadwal(popupData.jenis)} (
                      {popupData.details.length} jadwal)
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Informasi lengkap jadwal{" "}
                      {formatJenisJadwal(popupData.jenis).toLowerCase()}
                    </p>
                  </div>
                </div>

                <div className="space-y-6">
                  {popupData.details.map((detail, index) => (
                    <div
                      key={index}
                      className="bg-gray-50/50 dark:bg-gray-800/30 rounded-2xl p-6 border border-gray-200/50 dark:border-gray-700/50"
                    >
                      <div className="flex items-center gap-3 mb-5">
                        <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center shadow-sm">
                          <span className="text-white text-sm font-bold">
                            {index + 1}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Jadwal {index + 1}
                        </h3>
                      </div>

                      <div className="space-y-3">
                        {detail.detail && (
                          <>
                            {detail.detail.modul && (
                              <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-700/40 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                                <div className="flex-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    Modul
                                  </span>
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">
                                    {detail.detail.modul}
                                  </p>
                                </div>
                              </div>
                            )}
                            {detail.detail.topik && (
                              <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-700/40 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                                <div className="flex-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    Topik
                                  </span>
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">
                                    {detail.detail.topik}
                                  </p>
                                </div>
                              </div>
                            )}
                            {detail.detail.materi && (
                              <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-700/40 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                                <div className="flex-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    Materi
                                  </span>
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">
                                    {detail.detail.materi}
                                  </p>
                                </div>
                              </div>
                            )}
                            {detail.detail.agenda && (
                              <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-700/40 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                                <div className="flex-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    Agenda
                                  </span>
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">
                                    {detail.detail.agenda}
                                  </p>
                                </div>
                              </div>
                            )}
                            {(detail.detail.dosen ||
                              detail.detail.dosen_names) && (
                              <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-700/40 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                                <div className="flex-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    Dosen
                                  </span>
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">
                                    {detail.detail.dosen ||
                                      detail.detail.dosen_names}
                                  </p>
                                </div>
                              </div>
                            )}
                            {detail.detail.ruang && (
                              <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-700/40 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                                <div className="flex-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    Ruang
                                  </span>
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">
                                    {detail.detail.ruang}
                                  </p>
                                </div>
                              </div>
                            )}
                            {detail.detail.kelompok && (
                              <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-700/40 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                                <div className="flex-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    Kelompok
                                  </span>
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">
                                    {detail.detail.kelompok}
                                  </p>
                                </div>
                              </div>
                            )}
                            {detail.detail.kelompok && (
                              <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-700/40 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                                <div className="flex-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    Kelompok Kecil
                                  </span>
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">
                                    {detail.detail.kelompok}
                                  </p>
                                </div>
                              </div>
                            )}
                            {detail.detail.kode && (
                              <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-700/40 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                                <div className="flex-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    Kode
                                  </span>
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">
                                    {detail.detail.kode}
                                  </p>
                                </div>
                              </div>
                            )}
                            {detail.detail.blok && detail.detail.blok > 0 && (
                              <div className="flex items-start gap-3 p-3 bg-white/60 dark:bg-gray-700/40 rounded-xl border border-gray-200/50 dark:border-gray-600/50">
                                <div className="flex-1">
                                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide">
                                    Blok
                                  </span>
                                  <p className="text-sm font-medium text-gray-800 dark:text-gray-200 mt-1">
                                    {detail.detail.blok}
                                  </p>
                                </div>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-end gap-2 pt-2 relative z-20">
                  <button
                    onClick={() => setShowPopup(false)}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Legenda warna dummy ... */}
    </div>
  );
}
