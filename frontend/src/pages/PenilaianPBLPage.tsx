import { useParams, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { ChevronLeftIcon } from "../icons";
import api, { handleApiError, getUser } from "../utils/api";
import SignaturePad from "react-signature-canvas";
import React, { useRef } from "react";
import { AnimatePresence } from "framer-motion";
import { motion } from "framer-motion";
import ExcelJS from "exceljs";

interface Penilaian {
  [npm: string]: {
    A: number;
    B: number;
    C: number;
    D: number;
    E: number;
    F: number;
    G: number;
    petaKonsep: number;
  };
}

interface AbsensiPBL {
  [npm: string]: {
    hadir: boolean;
  };
}

const KRITERIA = {
  A: "Salam dan berdoa",
  B: "Partisipasi aktif dan tanggung jawab dalam proses PBL",
  C: "Informasi ilmiah (originalitas, validitas, keterkinian informasi)",
  D: "Keterampilan komunikasi (dalam mensosialisasikan pendapat)",
  E: "Kemampuan analisis (menyangkut materi yg didiskusikan)",
  F: "Keterbukaan dalam diskusi (dalam menerima pendapat & kritikan)",
  G: "Etika (berbicara, berdiskusi, berpakaian, dll.)",
};

export default function PenilaianPBLPage() {
  const { kode_blok, kelompok, pertemuan } = useParams();
  const navigate = useNavigate();

  const [mahasiswa, setMahasiswa] = useState<{ npm: string; nama: string }[]>(
    []
  );
  const [penilaian, setPenilaian] = useState<Penilaian>({});
  const [absensi, setAbsensi] = useState<AbsensiPBL>({});
  const [namaBlok, setNamaBlok] = useState("");
  const [kodeBlok, setKodeBlok] = useState("");
  const [tanggalParaf, setTanggalParaf] = useState("");
  const [signatureTutor, setSignatureTutor] = useState<string | null>(null);
  const [signatureParaf, setSignatureParaf] = useState<string | null>(null);
  const [namaTutor, setNamaTutor] = useState<string>("");
  const sigPadParaf = useRef<any>(null);
  // Tambahkan state loading/error
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [semester, setSemester] = useState<number | null>(null);
  const [modulPBLList, setModulPBLList] = useState<any[]>([]);
  const [namaModul, setNamaModul] = useState('');
  const [modulPBLId, setModulPBLId] = useState<number | null>(null);
  const [isPBL2, setIsPBL2] = useState(false);
  
  // Permission and status states
  const [userRole, setUserRole] = useState<string>('');
  const [penilaianSubmitted, setPenilaianSubmitted] = useState<boolean>(false);
  const [canEdit, setCanEdit] = useState<boolean>(true);

  const [isDark, setIsDark] = useState(document.documentElement.classList.contains('dark'));
  useEffect(() => {
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  // Check user permission and penilaian status
  useEffect(() => {
    const user = getUser();
    if (!user) {
      navigate('/');
      return;
    }
    
    // Only allow dosen, super_admin, and tim_akademik to access this page
    if (!['dosen', 'super_admin', 'tim_akademik'].includes(user.role)) {
      setError('Anda tidak memiliki akses untuk mengakses halaman ini.');
      setLoading(false);
      return;
    }
    
    setUserRole(user.role || '');
  }, [navigate]);

  // Check penilaian status from URL params or API
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const submitted = urlParams.get('penilaian_submitted') === 'true';
    
    // Hanya set dari URL jika belum ada data dari API
    if (submitted) {
      setPenilaianSubmitted(true);
    }
  }, []);

  // Fetch data blok untuk dapatkan semester
  useEffect(() => {
    if (!kode_blok) return;
    api.get(`/mata-kuliah/${kode_blok}`).then(res => {
      setSemester(res.data.semester);
        setNamaBlok(res.data.nama || "");
        setKodeBlok(res.data.kode || kode_blok);
    });
  }, [kode_blok]);

  // Fetch mahasiswa kelompok kecil dari backend (pakai semester dari data blok)
  useEffect(() => {
    if (!kelompok || !semester) return;
    console.log('Fetching mahasiswa for kelompok:', kelompok, 'semester:', semester);
    api.get(`/kelompok-kecil/by-nama?nama_kelompok=${encodeURIComponent(kelompok)}&semester=${semester}`)
      .then(res => {
        console.log('Mahasiswa response:', res.data);
        const mhs = (res.data || [])
          .map((item: any) => item.mahasiswa)
          .filter((m: any) => m)
          .map((m: any) => ({ npm: m.nim, nama: m.name ?? m.nama ?? '' }));
        console.log('Processed mahasiswa:', mhs);
        setMahasiswa(mhs);
      })
      .catch((error: any) => {
        console.error('Error fetching mahasiswa:', error);
        console.error('Error response:', error.response);
        // Jangan set error global, hanya log saja karena ini tidak critical
        console.warn('Mahasiswa fetch failed, but continuing...');
      });
  }, [kelompok, semester]);

  // Fetch penilaian dari backend
  useEffect(() => {
    if (!kode_blok || !kelompok || !pertemuan) return;
    setLoading(true);
    setError(null);
    
    // Fetch penilaian dan absensi secara bersamaan
    Promise.all([
      api.get(`/mata-kuliah/${kode_blok}/kelompok/${kelompok}/pertemuan/${pertemuan}/penilaian-pbl`),
      api.get(`/mata-kuliah/${kode_blok}/kelompok/${kelompok}/pertemuan/${pertemuan}/absensi-pbl`).catch(err => {
        // Jika absensi gagal, return empty data
        console.warn('Absensi fetch failed, using empty data:', err);
        return { data: { absensi: [] } };
      })
    ])
    .then(([penilaianRes, absensiRes]) => {
      // Process penilaian data
      const data = penilaianRes.data.penilaian || [];
      const pen: Penilaian = {};
      data.forEach((row: any) => {
        pen[row.mahasiswa_npm] = {
          A: row.nilai_a,
          B: row.nilai_b,
          C: row.nilai_c,
          D: row.nilai_d,
          E: row.nilai_e,
          F: row.nilai_f,
          G: row.nilai_g,
          petaKonsep: row.peta_konsep || 0,
        };
        if (row.tanggal_paraf) setTanggalParaf(row.tanggal_paraf);
        if (row.signature_paraf) setSignatureParaf(row.signature_paraf);
        if (row.nama_tutor) setNamaTutor(row.nama_tutor);
      });
      setPenilaian(pen);
      setNamaModul(penilaianRes.data.nama_modul || ''); // Ambil nama modul dari response API
      setIsPBL2(penilaianRes.data.is_pbl_2 || false); // Set status PBL 2 dari backend
      
      // Cek status penilaian_submitted dari backend
      // Selalu update berdasarkan response dari backend
      setPenilaianSubmitted(penilaianRes.data.penilaian_submitted || false);
      
      // Update canEdit berdasarkan role dan status
      const user = getUser();
      if (user) {
        const isAdmin = user.role === 'super_admin' || user.role === 'tim_akademik';
        setCanEdit(isAdmin || !(penilaianRes.data.penilaian_submitted || false));
      }
      
      // Jika PBL type berubah, reset petaKonsep untuk semua mahasiswa
      if (penilaianRes.data.is_pbl_2 && !isPBL2) {
        // PBL 1 → PBL 2: tambah petaKonsep dengan nilai 0
        const updatedPenilaian = { ...penilaian };
        Object.keys(updatedPenilaian).forEach(npm => {
          if (updatedPenilaian[npm].petaKonsep === undefined) {
            updatedPenilaian[npm].petaKonsep = 0;
          }
        });
        setPenilaian(updatedPenilaian);
      } else if (!penilaianRes.data.is_pbl_2 && isPBL2) {
        // PBL 2 → PBL 1: hapus petaKonsep
        const updatedPenilaian = { ...penilaian };
        Object.keys(updatedPenilaian).forEach(npm => {
          delete updatedPenilaian[npm].petaKonsep;
        });
        setPenilaian(updatedPenilaian);
      }

      // Process absensi data
      const absensiData = absensiRes.data.absensi || [];
      console.log('Absensi response:', absensiRes.data);
      console.log('Absensi data:', absensiData);
      console.log('Is array?', Array.isArray(absensiData));
      
      const abs: AbsensiPBL = {};
      if (Array.isArray(absensiData)) {
        absensiData.forEach((row: any) => {
          abs[row.mahasiswa_npm] = {
            hadir: row.hadir || false,
          };
        });
      } else {
        console.warn('Absensi data is not an array:', absensiData);
      }
      setAbsensi(abs);
    })
    .catch((error: any) => {
      console.error('Error fetching data:', error);
      console.error('Error response:', error.response);
      console.error('Error status:', error.response?.status);
      console.error('Error data:', error.response?.data);
      
      if (error.response?.status === 403) {
        setError('Anda tidak memiliki akses untuk menilai jadwal ini. Hanya dosen yang ditugaskan dan telah mengkonfirmasi ketersediaan yang dapat mengakses halaman ini.');
      } else if (error.response?.status === 404) {
        setError('Jadwal tidak ditemukan. Pastikan jadwal yang Anda akses sudah benar.');
      } else {
        setError('Gagal memuat data penilaian. Silakan coba lagi.');
      }
    })
    .finally(() => setLoading(false));
  }, [kode_blok, kelompok, pertemuan]);

  // Fetch modul PBL list
  useEffect(() => {
    if (!kode_blok) return;
    api.get(`/mata-kuliah/${kode_blok}/pbls`).then(res => setModulPBLList(res.data || []));
  }, [kode_blok]);

  // Fungsi simpan ke backend
  const handleSaveAll = async () => {
    if (!kode_blok || !kelompok || !pertemuan) return;
    
    // Peta Konsep tidak wajib diisi - optional untuk PBL 2
    
    setSaving(true);
    setError(null);
    try {
      // Simpan absensi terlebih dahulu
      const absensiSuccess = await handleSaveAbsensi();
      if (!absensiSuccess) {
        setSaving(false);
        return;
      }
      
      // Kemudian simpan penilaian
      const payload = {
        penilaian: mahasiswa.map(m => ({
          mahasiswa_npm: m.npm,
          nilai_a: penilaian[m.npm]?.A || 0,
          nilai_b: penilaian[m.npm]?.B || 0,
          nilai_c: penilaian[m.npm]?.C || 0,
          nilai_d: penilaian[m.npm]?.D || 0,
          nilai_e: penilaian[m.npm]?.E || 0,
          nilai_f: penilaian[m.npm]?.F || 0,
          nilai_g: penilaian[m.npm]?.G || 0,
          peta_konsep: isPBL2 ? (penilaian[m.npm]?.petaKonsep || 0) : null,
        })),
        tanggal_paraf: tanggalParaf,
        signature_paraf: signatureParaf,
        nama_tutor: namaTutor,
      };
      await api.post(`/mata-kuliah/${kode_blok}/kelompok/${kelompok}/pertemuan/${pertemuan}/penilaian-pbl`, payload);
      
      // Update penilaian submitted status for dosen
      const user = getUser();
      if (user && user.role === 'dosen') {
        setPenilaianSubmitted(true);
        setCanEdit(false);
      }
      
      setSuccess(`Absensi dan penilaian ${isPBL2 ? 'PBL 2' : 'PBL 1'} berhasil disimpan!`);
    } catch (error: any) {
      console.error('Error saving penilaian:', error);
      console.error('Error details:', handleApiError(error, 'Menyimpan penilaian'));
      setError(handleApiError(error, 'Menyimpan penilaian'));
    } finally {
      setSaving(false);
      setTimeout(() => setSuccess(null), 3000);
    }
  };

  const handleInputChange = (
    npm: string,
    kriteria: keyof Penilaian[string],
    value: string
  ) => {
    const score = parseInt(value, 10);
    if (
      isNaN(score) ||
      score < 0 ||
      score > (kriteria === "petaKonsep" ? 100 : 5)
    )
      return;

    setPenilaian((prev) => ({
      ...prev,
      [npm]: {
        ...prev[npm],
        [kriteria]: score,
      },
    }));
  };

  const hitungJumlah = (npm: string) => {
    const nilai = penilaian[npm];
    if (!nilai) return 0;
    
    const A = nilai.A || 0;
    const B = nilai.B || 0;
    const C = nilai.C || 0;
    const D = nilai.D || 0;
    const E = nilai.E || 0;
    const F = nilai.F || 0;
    const G = nilai.G || 0;
    
    return A + B + C + D + E + F + G;
  };

  const hitungTotalNilai = (npm: string) => {
    const nilai = penilaian[npm];
    if (!nilai) return 0;

    const A = nilai.A || 0;
    const B = nilai.B || 0;
    const C = nilai.C || 0;
    const D = nilai.D || 0;
    const E = nilai.E || 0;
    const F = nilai.F || 0;
    const G = nilai.G || 0;

    // Hitung jumlah nilai A-G (maksimal 5 per kriteria)
    const jumlahKriteria = A + B + C + D + E + F + G;
    const nilaiMaksimalKriteria = 7 * 5; // 7 kriteria × 5 (nilai maksimal)

    // Rumus: Total = (Jumlah Kriteria / Nilai Maksimal Kriteria) × 100
    // Peta Konsep tidak mempengaruhi Total Nilai, ditampilkan terpisah
    const persentaseKriteria = (jumlahKriteria / nilaiMaksimalKriteria) * 100;
    return Math.round(persentaseKriteria);
  };

  const handleAbsensiChange = (npm: string, hadir: boolean) => {
    setAbsensi((prev) => ({
      ...prev,
      [npm]: {
        hadir: hadir,
      },
    }));
  };

  const handleSaveAbsensi = async () => {
    if (!kode_blok || !kelompok || !pertemuan) return;
    
    try {
      const payload = {
        absensi: mahasiswa.map(m => ({
          mahasiswa_npm: m.npm,
          hadir: absensi[m.npm]?.hadir || false,
        })),
      };
      await api.post(`/mata-kuliah/${kode_blok}/kelompok/${kelompok}/pertemuan/${pertemuan}/absensi-pbl`, payload);
      return true;
    } catch (error: any) {
      console.error('Error saving absensi:', error);
      console.error('Error details:', handleApiError(error, 'Menyimpan absensi'));
      setError(handleApiError(error, 'Menyimpan absensi'));
      return false;
    }
  };

  const handleClearTutor = () => {
    setNamaTutor("");
  };
  const handleSaveTutor = () => {
    // Fungsi ini tidak diperlukan lagi karena nama tutor langsung tersimpan di state
  };
  const handleClearParaf = () => {
    sigPadParaf.current?.clear();
    setSignatureParaf(null);
  };
  const handleSaveParaf = () => {
    if (sigPadParaf.current && !sigPadParaf.current.isEmpty()) {
      const data = sigPadParaf.current.getCanvas().toDataURL("image/png");
      setSignatureParaf(data);
    }
  };

  // Fungsi untuk handle upload file gambar tanda tangan (hanya untuk paraf)
  const handleUploadSignature = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function (event) {
      const base64 = event.target?.result as string;
      setSignatureParaf(base64);
    };
    reader.readAsDataURL(file);
  };

  // Fungsi export Excel baru dengan exceljs
  const exportExcel = async () => {
    try {
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet("Penilaian PBL");

      // Judul
      sheet.mergeCells("A1:K1");
      sheet.getCell("A1").value = "LEMBAR PENILAIAN MAHASISWA OLEH TUTOR";
      sheet.getCell("A1").font = { bold: true, size: 16 };
      sheet.getCell("A1").alignment = { vertical: "middle", horizontal: "center" };

      // Baris kosong (spasi)
      sheet.addRow([]);

      // Header info mulai dari baris 3
      sheet.getCell("A3").value = `KODE MATA KULIAH BLOK: ${kodeBlok || ""}`;
      sheet.getCell("A3").font = { bold: true };
      sheet.getCell("A3").alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell("K3").value = `KELOMPOK: ${kelompok || ""}`;
      sheet.getCell("K3").font = { bold: true };
      sheet.getCell("K3").alignment = { vertical: "middle", horizontal: "right" };

      sheet.getCell("A4").value = `NAMA MATA KULIAH BLOK: ${namaBlok || ""}`;
      sheet.getCell("A4").font = { bold: true };
      sheet.getCell("A4").alignment = { vertical: "middle", horizontal: "left" };
      sheet.getCell("K4").value = `PERTEMUAN KE: ${pertemuan || ""}`;
      sheet.getCell("K4").font = { bold: true };
      sheet.getCell("K4").alignment = { vertical: "middle", horizontal: "right" };

      sheet.getCell("A5").value = `MODUL: ${namaModul || '-'}`;
      sheet.getCell("A5").font = { bold: true };
      sheet.getCell("A5").alignment = { vertical: "middle", horizontal: "left" };

      // Spasi
      sheet.addRow([]);

    // Table header
    const tableHeader = [
        "NO", "NPM", "NAMA", "A", "B", "C", "D", "E", "F", "G", "Jumlah",
        "Total Nilai",
        ...(isPBL2 ? ["Peta Konsep (0-100)"] : []), // Peta Konsep di paling kanan
      ];
      const headerRow = sheet.addRow(tableHeader);
      headerRow.font = { bold: true };
      headerRow.alignment = { horizontal: "center", vertical: "middle" };
      headerRow.eachCell(cell => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFDCFCE7" },
        };
        cell.border = {
          top: { style: "thin" },
          left: { style: "thin" },
          bottom: { style: "thin" },
          right: { style: "thin" },
        };
      });

    // Table body
      mahasiswa.forEach((m, idx) => {
      const nilai = penilaian[m.npm] || {} as Penilaian[string];
      const row = [
        idx + 1,
        m.npm,
        m.nama,
          nilai.A ?? "",
          nilai.B ?? "",
          nilai.C ?? "",
          nilai.D ?? "",
          nilai.E ?? "",
          nilai.F ?? "",
          nilai.G ?? "",
        hitungJumlah(m.npm),
        hitungTotalNilai(m.npm),
      ];
      if (isPBL2) row.push(nilai.petaKonsep ?? "");
        const dataRow = sheet.addRow(row);
        dataRow.alignment = { vertical: "middle", horizontal: "center" };
        dataRow.getCell(3).alignment = { vertical: "middle", horizontal: "left" }; // NAMA kiri
        dataRow.eachCell(cell => {
          cell.border = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };
        });
      });

      // Spasi
      sheet.addRow([]);

      // Keterangan & Skoring (dua kolom, merge cell)
      const startRow = (sheet.lastRow?.number ?? 1) + 1;
      // Keterangan kiri (A - F)
      sheet.mergeCells(`A${startRow}:F${startRow + 7}`);
      const keteranganCell = sheet.getCell(`A${startRow}`);
      keteranganCell.value =
        `KETERANGAN:\n` +
        Object.entries(KRITERIA).map(([k, v]) => `${k}: ${v}`).join("\n");
      keteranganCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      keteranganCell.font = { size: 11 };
      // Skoring kanan (G - K)
      sheet.mergeCells(`G${startRow}:K${startRow + 7}`);
      const skoringCell = sheet.getCell(`G${startRow}`);
      skoringCell.value =
        `SKORING:\n1 = SANGAT KURANG\n2 = KURANG\n3 = CUKUP\n4 = BAIK\n5 = SANGAT BAIK`;
      skoringCell.alignment = { vertical: "top", horizontal: "left", wrapText: true };
      skoringCell.font = { size: 11 };

      // Spasi
      sheet.addRow([]);
      sheet.addRow([]);

      // Paraf section (dua kolom, merge cell)
      const parafRow = (sheet.lastRow?.number ?? 1) + 1;
      sheet.mergeCells(`A${parafRow}:F${parafRow}`);
      sheet.mergeCells(`G${parafRow}:K${parafRow}`);
      sheet.getCell(`A${parafRow}`).value = "TUTOR";
      sheet.getCell(`A${parafRow}`).alignment = { horizontal: "center" };
      sheet.getCell(`A${parafRow}`).font = { bold: true };
      sheet.getCell(`G${parafRow}`).value = "PARAF";
      sheet.getCell(`G${parafRow}`).alignment = { horizontal: "center" };
      sheet.getCell(`G${parafRow}`).font = { bold: true };

      // Kotak untuk image tanda tangan (merge, tanpa border, tinggi baris)
      const ttdBoxRow = parafRow + 1;
      sheet.mergeCells(`A${ttdBoxRow}:F${ttdBoxRow}`);
      sheet.mergeCells(`G${ttdBoxRow}:K${ttdBoxRow}`);
      // Tinggikan baris agar gambar muat
      sheet.getRow(ttdBoxRow).height = 60;

      // Insert signature images di tengah kotak
      function base64ToBuffer(dataUrl: string) {
        const base64 = dataUrl.split(',')[1];
        const binary = atob(base64);
        const len = binary.length;
        const buffer = new Uint8Array(len);
        for (let i = 0; i < len; i++) buffer[i] = binary.charCodeAt(i);
        return buffer;
      }
      // Nama Tutor
      if (namaTutor) {
        sheet.getCell(`A${ttdBoxRow}`).value = namaTutor;
        sheet.getCell(`A${ttdBoxRow}`).alignment = { vertical: "middle", horizontal: "center" };
        sheet.getCell(`A${ttdBoxRow}`).font = { bold: true, size: 12 };
      }
      // Tanda tangan Paraf
      if (signatureParaf) {
        const imageId = workbook.addImage({
          buffer: base64ToBuffer(signatureParaf) as any,
          extension: 'png',
        });
        // Center di kotak G-K ttdBoxRow
        sheet.addImage(imageId, {
          tl: { col: 7, row: ttdBoxRow - 1 + 0.2 }, // center di area G-K
          ext: { width: 160, height: 50 },
        });
      }

      // Tanggal paraf di bawah kiri
      const tglRow = ttdBoxRow + 2;
      sheet.getCell(`A${tglRow}`).value = `Jakarta, ${tanggalParaf || "...................."}`;
      sheet.getCell(`A${tglRow}`).alignment = { horizontal: "left" };
      sheet.getCell(`A${tglRow}`).font = { italic: true };

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Penilaian_PBL_${kodeBlok || ""}_${kelompok || ""}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting Excel:", error);
      alert("Gagal export Excel: " + error);
    }
  };

  // Fungsi export HTML
  const exportHtml = () => {
    // Detect dark mode from document
    const isDark = document.documentElement.classList.contains("dark");
    // Inline CSS for print-like layout, with dark mode support
    const style = `
      <style>
        body { font-family: Arial, sans-serif; margin: 40px; background: #fff; color: #222; }
        .header-row { display: flex; justify-content: flex-start; margin-bottom: 8px; }
        .header-col { font-size: 14px; line-height: 1.5; }
        .title { text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 16px; color: #222; }
        table.penilaian { border-collapse: collapse; width: 100%; margin-bottom: 24px; background: #fff; }
        table.penilaian th, table.penilaian td { border: 1px solid #222; padding: 6px 8px; font-size: 13px; }
        table.penilaian th { background: #f5f5f5; font-weight: bold; text-align: center; color: #222; }
        table.penilaian td { text-align: center; color: #222; background: #fff; }
        .info-section { display: flex; gap: 48px; margin-top: 24px; }
        .info-col { font-size: 12px; color: #222; }
        .info-col h3 { font-size: 13px; font-weight: bold; margin-bottom: 6px; color: #222; }
      </style>
    `;
    
    // Header dengan layout yang mirip UI
    const htmlHeader = `
      <div class="header-row">
        <div class="header-col left">
          <div><strong>KODE MATA KULIAH BLOK:</strong> ${kodeBlok || ""}</div>
          <div><strong>NAMA MATA KULIAH BLOK:</strong> ${namaBlok || ""}</div>
          <div><strong>MODUL:</strong> ${namaModul || '-'}</div>
        </div>
        <div class="header-col right">
          <div><strong>KELOMPOK:</strong> ${kelompok || ""}</div>
          <div><strong>PERTEMUAN KE:</strong> ${pertemuan || ""}</div>
        </div>
      </div>
    `;
    
    // Table header
    const htmlTableHeader = `
      <tr>
        <th>NO</th>
        <th>NPM</th>
        <th>NAMA</th>
        ${Object.keys(KRITERIA)
          .map((k) => `<th>${k}</th>`)
          .join("")}
        <th>JUMLAH</th>
        <th>TOTAL NILAI</th>
        ${isPBL2 ? "<th>Peta Konsep (0-100)</th>" : ""}
      </tr>
    `;
    
    // Table body
    const htmlTableBody = mahasiswa
      .map((m, idx) => {
        const nilai = penilaian[m.npm] || {};
        return `<tr>
        <td>${idx + 1}</td>
        <td>${m.npm}</td>
        <td style="text-align:left;">${m.nama}</td>
        ${Object.keys(KRITERIA)
          .map((k) => `<td>${(nilai as Record<string, number>)[k] ?? ""}</td>`)
          .join("")}
        <td>${hitungJumlah(m.npm)}</td>
        <td><strong>${hitungTotalNilai(m.npm)}</strong></td>
        ${isPBL2 ? `<td>${(nilai as Record<string, number>)?.petaKonsep ?? ""}</td>` : ""}
      </tr>`;
      })
      .join("");
    
    // Keterangan & Skoring dengan layout yang mirip UI
    const htmlKeterangan = `
      <div class="info-section">
        <div class="info-col">
          <h3>KETERANGAN</h3>
          <ul>
            ${Object.entries(KRITERIA)
              .map(([k, v]) => `<li><strong>${k}:</strong> ${v}</li>`)
              .join("")}
          </ul>
        </div>
        <div class="info-col">
          <h3>SKORING</h3>
          <div>1 = SANGAT KURANG</div>
          <div>2 = KURANG</div>
          <div>3 = CUKUP</div>
          <div>4 = BAIK</div>
          <div>5 = SANGAT BAIK</div>
        </div>
      </div>
    `;
    
    // Paraf section dengan layout yang mirip UI
    const htmlParaf = `
      <div style="width:420px; margin:48px 0 0 auto; display:flex; justify-content:flex-end; align-items:flex-start; gap:32px;">
        <div style="width:200px;">
          <div style="margin-bottom:8px;">Jakarta, ${tanggalParaf || "...................."}</div>
          <div style="font-weight:normal; margin-top:5px; margin-bottom:20px;">TUTOR</div>
          <div style="width:100%; text-align:center; font-size:14px; font-weight:normal; min-height:24px; margin-top:8px;">${namaTutor || ""}</div>
          <div style="width:100%; border-bottom:2px dotted #ccc; margin:0 0 8px 0;"></div>
        </div>
        <div style="width:160px;">
          <div style="font-weight:normal; margin-bottom:9px; text-align:center;">PARAF</div>
          <div style="width:100%; height:60px; margin-bottom:0; ">
            ${
              signatureParaf
                ? `<img src='${signatureParaf}' style='width:100%; height:60px; object-fit:contain; ' alt='TTD Paraf' />`
                : ""
            }
          </div>
          <div style="width:100%; border-bottom:2px dotted #ccc; margin-top:5;"></div>
          
        </div>
      </div>
    `;
    
    // Gabungkan semua
    const html = `
      <html><head><meta charset="UTF-8">${style}</head><body>
        <div class="title">LEMBAR PENILAIAN MAHASISWA OLEH TUTOR</div>
        ${htmlHeader}
        <table class="penilaian">
          ${htmlTableHeader}
          ${htmlTableBody}
        </table>
        ${htmlKeterangan}
        ${htmlParaf}
      </body></html>
    `;
    
    // Download file
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Penilaian_PBL_${kodeBlok || ""}_${kelompok || ""}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container mx-auto dark:bg-gray-900 min-h-screen">
      {/* Only show header if no error */}
      {!error && (
      <div className="pb-2 flex justify-between items-center">
        <button                                                                                                                                             
          onClick={() => {
            const user = getUser();
            if (user?.role === 'dosen') {
              navigate('/dashboard-dosen');
            } else {
              navigate(-1);
            }
          }} 
          className="flex items-center gap-2 text-brand-500 font-medium hover:text-brand-600 transition px-0 py-0 bg-transparent shadow-none dark:text-green-400 dark:hover:text-green-300"
        >
          <ChevronLeftIcon className="w-5 h-5" />
          {getUser()?.role === 'dosen' ? 'Kembali ke Dashboard' : 'Kembali ke Detail Blok'}
        </button>
        <div className="flex items-center">
          <button
            onClick={exportExcel}
            className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium shadow-theme-xs hover:bg-green-600 transition dark:bg-green-600 dark:hover:bg-green-500"
          >
            Export Excel
          </button>
          <button
            onClick={exportHtml}
            className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium shadow-theme-xs hover:bg-blue-600 transition ml-2 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            Export HTML
          </button>
        </div>
      </div>
      )}
              {/* Success Messages */}
              <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mt-4 p-3 rounded-lg bg-green-100 text-green-700"
            >
              {success}
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Error Messages - Centered */}
        {error && (
          <div className="flex items-center justify-center min-h-[60vh]">
            <div className="max-w-md w-full p-6 rounded-lg bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 border border-red-200 dark:border-red-700 text-center">
              <div className="flex justify-center mb-4">
                <svg className="h-12 w-12 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-3">
                Akses Ditolak
              </h3>
              <div className="text-sm text-red-700 dark:text-red-300 mb-6">
                {error}
              </div>
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center px-4 py-2 border border-red-300 dark:border-red-600 text-sm leading-4 font-medium rounded-md text-red-700 dark:text-red-300 bg-white dark:bg-gray-800 hover:bg-red-50 dark:hover:bg-red-900 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-colors"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                </svg>
                Kembali
              </button>
            </div>
          </div>
        )}
      
      {/* Only show form if no error */}
      {!error && (
      <div className="bg-white dark:bg-gray-800 mt-6 shadow-md rounded-lg p-6">
        <h1 className="text-xl font-bold text-center text-gray-900 dark:text-white mb-2">
          LEMBAR PENILAIAN MAHASISWA OLEH TUTOR
        </h1>
        <div className="text-center mb-4">
          <div className="flex justify-center gap-2 mb-2">
            <span className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
              isPBL2 
                ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' 
                : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
            }`}>
              {isPBL2 ? 'PBL 2 (Dengan Peta Konsep)' : 'PBL 1 (Tanpa Peta Konsep)'}
            </span>
            {penilaianSubmitted && (
              <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200">
                Penilaian Sudah Disubmit
              </span>
            )}
            {!canEdit && userRole === 'dosen' && (
              <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200">
                View Only Mode
              </span>
            )}
          </div>
        </div>
        <div className="flex justify-between items-center mb-4 text-sm text-gray-700 dark:text-gray-300">
          <div>
            <p>
              <strong>KODE MATA KULIAH BLOK:</strong> {kodeBlok}
            </p>
            <p>
              <strong>NAMA MATA KULIAH BLOK:</strong> {namaBlok}
            </p>
            <p>
              <strong>MODUL:</strong> {namaModul || '-'}
            </p>
          </div>
          <div>
            <p>
              <strong>KELOMPOK:</strong> {kelompok}
            </p>
            <p>
              <strong>PERTEMUAN KE:</strong> {pertemuan}
            </p>
          </div>
        </div>

        {loading && (
          <div className="animate-pulse">
            {/* Skeleton untuk tabel */}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-2 py-3 text-left">
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-4"></div>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-8"></div>
                    </th>
                    <th className="px-4 py-3 text-left">
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-12"></div>
                    </th>
                    {Object.keys(KRITERIA).map((key) => (
                      <th key={key} className="px-2 py-3 text-center">
                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-4 mx-auto"></div>
                      </th>
                    ))}
                    <th className="px-2 py-3 text-center">
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16 mx-auto"></div>
                    </th>
                    {isPBL2 && (
                      <th className="px-2 py-3 text-center">
                        <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-20 mx-auto"></div>
                      </th>
                    )}
                    <th className="px-2 py-3 text-center">
                      <div className="h-3 bg-gray-200 dark:bg-gray-600 rounded w-16 mx-auto"></div>
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {[...Array(5)].map((_, index) => (
                    <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                      <td className="px-2 py-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4"></div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16"></div>
                      </td>
                      <td className="px-4 py-2">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                      </td>
                      {Object.keys(KRITERIA).map((key) => (
                        <td key={key} className="px-2 py-2 text-center">
                          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-12 mx-auto"></div>
                        </td>
                      ))}
                      <td className="px-2 py-2 text-center">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-8 mx-auto"></div>
                      </td>
                      {isPBL2 && (
                        <td className="px-2 py-2 text-center">
                          <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-16 mx-auto"></div>
                        </td>
                      )}
                      <td className="px-2 py-2 text-center">
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-12 mx-auto"></div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {!loading && (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-xs">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-2 py-3 text-left font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  NO
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  NPM
                </th>
                <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  NAMA
                </th>
                <th className="px-2 py-3 text-center font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  ABSENSI
                </th>
                {Object.keys(KRITERIA).map((key) => (
                  <th
                    key={key}
                    className="px-2 py-3 text-center font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    title={KRITERIA[key as keyof typeof KRITERIA]}
                  >
                    {key}
                  </th>
                ))}
                <th className="px-2 py-3 text-center font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Jumlah
                </th>
                <th className="px-2 py-3 text-center font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total Nilai
                </th>
                {isPBL2 && (
                  <th className="px-2 py-3 text-center font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Peta Konsep (0-100) - Optional
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
              {mahasiswa.map((m, index) => (
                <tr key={m.npm} className="hover:bg-gray-50 dark:hover:bg-gray-800">
                  <td className="px-2 py-2 whitespace-nowrap dark:text-gray-200">{index + 1}</td>
                  <td className="px-4 py-2 whitespace-nowrap dark:text-gray-200">{m.npm}</td>
                  <td className="px-4 py-2 whitespace-nowrap dark:text-gray-200">{m.nama}</td>
                  <td className="px-2 py-2 text-center whitespace-nowrap dark:text-gray-200">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={absensi[m.npm]?.hadir || false}
                        onChange={(e) => handleAbsensiChange(m.npm, e.target.checked)}
                        className={`w-5 h-5 appearance-none rounded-md border-2 ${
                          absensi[m.npm]?.hadir 
                            ? 'border-brand-500 bg-brand-500' 
                            : 'border-brand-500 bg-transparent'
                        } transition-colors duration-150 focus:ring-2 focus:ring-brand-300 dark:focus:ring-brand-600 relative`}
                        style={{ outline: 'none' }}
                      />
                      {absensi[m.npm]?.hadir && (
                        <svg
                          className="absolute left-1/2 top-1/2 transform -translate-x-1/2 -translate-y-1/2 w-5 h-5 pointer-events-none"
                          viewBox="0 0 20 20"
                          fill="none"
                          stroke="white"
                          strokeWidth="2.5"
                        >
                          <polyline points="5 11 9 15 15 7" />
                        </svg>
                      )}
                    </div>
                  </td>
                  {Object.keys(KRITERIA).map((key) => (
                    <td
                      key={key}
                      className="px-2 py-2 text-center whitespace-nowrap dark:text-gray-200"
                    >
                      <input
                        type="number"
                        min="0"
                        max="5"
                        value={
                          penilaian[m.npm]?.[key as keyof typeof KRITERIA] || ""
                        }
                        onChange={(e) =>
                          handleInputChange(
                            m.npm,
                            key as keyof typeof KRITERIA,
                            e.target.value
                          )
                        }
                        disabled={!canEdit}
                        className={`w-12 text-center border rounded-md p-1 dark:text-gray-100 dark:placeholder-gray-400 ${
                          canEdit 
                            ? 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600' 
                            : 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 cursor-not-allowed'
                        }`}
                      />
                    </td>
                  ))}
                  <td className="px-2 py-2 text-center whitespace-nowrap dark:text-gray-200">
                    {hitungJumlah(m.npm)}
                  </td>
                  <td className="px-2 py-2 text-center whitespace-nowrap dark:text-gray-200 font-medium">
                    <span className={`px-2 py-1 rounded text-xs ${
                      hitungTotalNilai(m.npm) > 0 
                        ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200' 
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}>
                      {hitungTotalNilai(m.npm)}
                    </span>
                  </td>
                  {isPBL2 && (
                    <td className="px-2 py-2 text-center whitespace-nowrap dark:text-gray-200">
                      <input
                        type="number"
                        min="0"
                        max="100"
                        value={penilaian[m.npm]?.petaKonsep || ""}
                        onChange={(e) =>
                          handleInputChange(m.npm, "petaKonsep", e.target.value)
                        }
                        disabled={!canEdit}
                        className={`w-20 text-center border rounded-md p-1 dark:text-gray-100 dark:placeholder-gray-400 ${
                          !canEdit
                            ? 'bg-gray-100 dark:bg-gray-700 border-gray-200 dark:border-gray-600 cursor-not-allowed'
                            : 'bg-gray-50 dark:bg-gray-800 border-gray-300 dark:border-gray-600'
                        }`}
                        placeholder="0-100 (Optional)"
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        )}

        <div className="flex flex-row gap-16 mt-6">
          <div className="text-xs dark:text-gray-200">
            <h3 className="font-bold mb-2">KETERANGAN</h3>
            <ul className="list-disc list-inside">
              {Object.entries(KRITERIA).map(([key, value]) => (
                <li key={key}>
                  <strong>{key}:</strong> {value}
                </li>
              ))}
            </ul>
            {isPBL2 && (
              <div className="mt-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded border-l-4 border-blue-400">
                <p className="font-medium text-blue-800 dark:text-blue-200">PBL 2:</p>
                <p className="text-blue-700 dark:text-blue-300">Nilai Peta Konsep (0-100) wajib diisi untuk semua mahasiswa</p>
              </div>
            )}
          </div>
          <div className="text-xs dark:text-gray-200">
            <h3 className="font-bold mb-2">SKORING</h3>
            <p>1 = SANGAT KURANG</p>
            <p>2 = KURANG</p>
            <p>3 = CUKUP</p>
            <p>4 = BAIK</p>
            <p>5 = SANGAT BAIK</p>
            {isPBL2 && (
              <div className="mt-3">
                <p className="font-medium">Peta Konsep:</p>
                <p>0-100 (Nilai persentase)</p>
              </div>
            )}
            <div className="mt-3 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded border-l-4 border-yellow-400">
              <p className="font-medium text-yellow-800 dark:text-yellow-200">Maksimal Nilai:</p>
              <p className="text-yellow-700 dark:text-yellow-300">
                {isPBL2 ? '35 (Kriteria A-G) + 100 (Peta Konsep) = 135' : '35 (Kriteria A-G)'}
              </p>
            </div>
          </div>
        </div>
        {/* Paraf section below Skoring, horizontal row, both on the right */}
        <div className="flex justify-end items-end gap-16 mt-12">
          <div className="flex flex-col items-start">
            <span className="text-xs mb-1 dark:text-gray-200">
              Jakarta,{" "}
              <input
                type="date"
                value={tanggalParaf}
                onChange={(e) => setTanggalParaf(e.target.value)}
                className="border rounded px-2 py-1 text-xs dark:bg-gray-800 dark:text-gray-100 dark:border-gray-600"
              />
            </span>
            <span className="text-xs mb-5 dark:text-gray-200">TUTOR</span>
            <div className="w-48 h-[100px] bg-white dark:bg-gray-900 border rounded mb-6 flex flex-col justify-center dark:border-gray-600">
              <input
                type="text"
                value={namaTutor}
                onChange={e => setNamaTutor(e.target.value)}
                placeholder="Masukkan nama tutor"
                className="w-full h-full px-3 py-2 text-center bg-transparent border-none outline-none dark:text-gray-100 placeholder-gray-400"
              />
            </div>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setNamaTutor("")}
                className="text-xs px-2 py-1 border rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 dark:border-gray-600"
              >
                Clear
              </button>
            </div>
          </div>
          <div className="flex flex-col items-start">
            <span className="text-xs mb-5 dark:text-gray-200">PARAF</span>
            {signatureParaf ? (
              <div className="relative w-48 h-[100px] bg-white dark:bg-gray-900 border rounded mb-6 flex flex-col justify-end dark:border-gray-600">
                <img
                  src={signatureParaf}
                  alt="Tanda Tangan Paraf"
                  className="w-full h-[80px] object-contain"
                />
                <div className="border-b-2 border-dotted w-full absolute bottom-2 left-0 dark:border-gray-600" />
              </div>
            ) : (
              <div className="relative w-48 h-[100px] bg-white dark:bg-gray-900 border rounded mb-6 flex flex-col justify-end dark:border-gray-600">
                <SignaturePad
                  ref={sigPadParaf}
                  penColor={isDark ? '#000' : 'black'}
                  canvasProps={{
                    width: 192,
                    height: 100,
                    className:
                      isDark
                        ? "absolute top-0 left-0 w-full h-full bg-gray-900 rounded"
                        : "absolute top-0 left-0 w-full h-full bg-white rounded",
                  }}
                />
                <div className="border-b-2 border-dotted w-full absolute bottom-2 left-0 dark:border-gray-600" />
              </div>
            )}
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={handleClearParaf}
                className="text-xs px-2 py-1 border rounded bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-gray-100 dark:border-gray-600"
              >
                Clear
              </button>
              <button
                type="button"
                onClick={handleSaveParaf}
                className="text-xs px-2 py-1 border rounded bg-blue-100 hover:bg-blue-200 dark:bg-blue-700 dark:hover:bg-blue-600 dark:text-gray-100 dark:border-gray-600"
              >
                Simpan
              </button>
              <label className="text-xs px-2 py-1 border rounded bg-green-100 hover:bg-green-200 dark:bg-green-700 dark:hover:bg-green-600 dark:text-gray-100 dark:border-gray-600 cursor-pointer">
                Upload TTD
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => handleUploadSignature(e)}
                  className="hidden"
                />
              </label>
            </div>
          </div>
        </div>
        {/* Tambahkan tombol simpan di bawah tabel */}
        <div className="mt-6 flex gap-4">
          <button 
            onClick={handleSaveAll} 
            disabled={saving || loading || !canEdit} 
            className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium shadow-theme-xs hover:bg-blue-600 transition dark:bg-blue-600 dark:hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Menyimpan...' : canEdit ? 'Simpan Absensi & Penilaian' : 'Penilaian Sudah Disubmit'}
        </button>
        </div>
        
      </div>
      )}
    </div>
  );
}
