import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faCalendarAlt,
  faClock,
  faCheckCircle,
  faTimesCircle,
  faExclamationTriangle,
  faChartBar,
  faDownload,
  faFilter,
  faSearch,
  faSort,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";
import api, { handleApiError } from "../utils/api";
import jsPDF from "jspdf";
import { addWatermarkToAllPages } from "../utils/watermarkHelper";

interface MahasiswaKeabsenan {
  id: number;
  nama: string;
  nid: string;
  nidn?: string;
  email: string;
  telp: string;
  username: string;
  semester: number;
  status: string;
  kelompok_kecil?: string;
  kelompok_besar?: string;
  total_kehadiran: number;
  total_absensi: number;
  total_waiting: number;
  total_schedules: number;
  persentase_kehadiran: number;
  status_kehadiran: "baik" | "kurang" | "buruk";
  detail_kehadiran: {
    id: number;
    tanggal: string;
    mata_kuliah: string;
    jenis_jadwal: string;
    jenis_detail?: string;
    status: "hadir" | "tidak_hadir" | "waiting";
    alasan?: string;
    jam_mulai: string;
    jam_selesai: string;
    ruangan: string;
    dosen: string;
    topik?: string;
    pbl_tipe?: string;
  }[];
}

interface DetailMahasiswaKeabsenanProps {
  isEmbedded?: boolean;
}

const DetailMahasiswaKeabsenan: React.FC<DetailMahasiswaKeabsenanProps> = ({ isEmbedded = false }) => {
  const [mahasiswaData, setMahasiswaData] = useState<MahasiswaKeabsenan | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterJenis, setFilterJenis] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("tanggal");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetchMahasiswaData();
  }, []);

  const fetchMahasiswaData = async () => {
    try {
      setLoading(true);

      // Get current user ID from localStorage or context
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const mahasiswaId = user.id;

      if (!mahasiswaId) {
        setError("ID mahasiswa tidak ditemukan");
        return;
      }

      // Fetch data from API
      const response = await api.get(`/keabsenan-mahasiswa/${mahasiswaId}`);
      const data = response.data;

      // Transform API response to match our interface
      const transformedData: MahasiswaKeabsenan = {
        id: data.mahasiswa.id,
        nama: data.mahasiswa.nama,
        nid: data.mahasiswa.nid,
        email: data.mahasiswa.email,
        telp: data.mahasiswa.telp,
        username: data.mahasiswa.username,
        semester: data.mahasiswa.semester,
        status: data.mahasiswa.status,
        kelompok_kecil: data.mahasiswa.kelompok_kecil,
        kelompok_besar: data.mahasiswa.kelompok_besar,
        total_kehadiran: data.statistik.total_kehadiran,
        total_absensi: data.statistik.total_absensi,
        total_waiting: data.statistik.total_waiting,
        total_schedules: data.statistik.total_schedules,
        persentase_kehadiran: data.statistik.persentase_kehadiran,
        status_kehadiran: data.statistik.status_kehadiran,
        detail_kehadiran: data.detail_kehadiran,
      };

      setMahasiswaData(transformedData);
    } catch (err) {
      setError("Gagal memuat data keabsenan mahasiswa");
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "hadir":
        return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border border-green-200 dark:border-green-800";
      case "tidak_hadir":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-800";
      case "waiting":
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border border-gray-200 dark:border-gray-800";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border border-gray-200 dark:border-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "hadir":
        return faCheckCircle;
      case "tidak_hadir":
        return faTimesCircle;
      case "waiting":
        return faClock;
      default:
        return faClock;
    }
  };

  const getJenisJadwalColor = (jenis: string) => {
    switch (jenis) {
      case "kuliah_besar":
        return "bg-blue-500 text-white";
      case "praktikum":
        return "bg-green-500 text-white";
      case "jurnal_reading":
        return "bg-purple-500 text-white";
      case "pbl":
        return "bg-orange-500 text-white";
      case "csr":
        return "bg-red-500 text-white";
      case "seminar_pleno":
        return "bg-indigo-500 text-white";
      case "non_blok_non_csr":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300 border border-gray-200 dark:border-gray-700";
      default:
        return "bg-gray-500 text-white";
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
      case "seminar_pleno":
        return "Seminar Pleno";
      case "non_blok_non_csr":
        return "Non Blok Non CSR";
      default:
        return jenis;
    }
  };

  const getStatusKehadiranColor = (status: string) => {
    switch (status) {
      case "baik":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200";
      case "kurang":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-200";
      case "buruk":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-200";
    }
  };

  const getStatusKehadiranLabel = (status: string) => {
    switch (status) {
      case "baik":
        return "Baik";
      case "kurang":
        return "Kurang";
      case "buruk":
        return "Buruk";
      default:
        return status;
    }
  };

  const filteredKehadiran =
    mahasiswaData?.detail_kehadiran
      .filter((item) => {
        const matchesSearch =
          item.mata_kuliah.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.dosen.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.ruangan.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus =
          filterStatus === "all" || item.status === filterStatus;
        const matchesJenis =
          filterJenis === "all" || item.jenis_jadwal === filterJenis;

        return matchesSearch && matchesStatus && matchesJenis;
      })
      .sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case "tanggal":
            comparison =
              new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
            break;
          case "mata_kuliah":
            comparison = a.mata_kuliah.localeCompare(b.mata_kuliah);
            break;
          case "status":
            comparison = a.status.localeCompare(b.status);
            break;
          case "jenis_jadwal":
            comparison = a.jenis_jadwal.localeCompare(b.jenis_jadwal);
            break;
          default:
            comparison = 0;
        }

        return sortOrder === "asc" ? comparison : -comparison;
      }) || [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const exportPDF = async () => {
    try {
      if (!mahasiswaData) {
        console.error("Data mahasiswa tidak tersedia");
        return;
      }

      const doc = new jsPDF();
      const margin = 20;
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
      yPos = addText("LAPORAN KEHADIRAN MAHASISWA", 105, yPos, { align: "center" });
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont("times", "normal");
      yPos = addText(`No: 6/UMJ-FK/8/2025`, 105, yPos, { align: "center" });
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

      // INFORMASI MAHASISWA
      yPos = addText("Dengan ini menerangkan bahwa :", margin, yPos);
      yPos += 10;
      yPos = addText(`Nama         : ${mahasiswaData.nama}`, margin, yPos);
      yPos += 8;
      yPos = addText(`NID          : ${mahasiswaData.nid}`, margin, yPos);
      yPos += 8;
      yPos = addText(`Semester     : ${mahasiswaData.status === 'lulus' ? 'Lulus' : mahasiswaData.semester}`, margin, yPos);
      yPos += 8;
      yPos = addText(`Kelompok     : ${mahasiswaData.kelompok_kecil}`, margin, yPos);
      yPos += 8;
      yPos = addText(`Email        : ${mahasiswaData.email}`, margin, yPos);
      yPos += 8;
      yPos = addText(`Telepon      : ${mahasiswaData.telp}`, margin, yPos);
      yPos += 15;

      // TANGGAL DINAMIS
      const jadwalDates = filteredKehadiran
        .map((j) => new Date(j.tanggal))
        .sort((a, b) => a.getTime() - b.getTime());
      const tanggalMulai = jadwalDates.length > 0 ? jadwalDates[0] : new Date();
      const tanggalAkhir =
        jadwalDates.length > 0
          ? jadwalDates[jadwalDates.length - 1]
          : new Date();

      yPos = addText(
        `Periode Laporan: ${tanggalMulai.toLocaleDateString("id-ID")} - ${tanggalAkhir.toLocaleDateString("id-ID")}`,
        margin,
        yPos
      );
      yPos += 15;

      // STATISTIK KEHADIRAN
      doc.setFontSize(14);
      doc.setFont("times", "bold");
      yPos = addText("STATISTIK KEHADIRAN", margin, yPos);
      yPos += 10;

      doc.setFontSize(12);
      doc.setFont("times", "normal");
      yPos = addText(`Total Kehadiran     : ${mahasiswaData.total_kehadiran} kali`, margin, yPos);
      yPos += 8;
      yPos = addText(`Total Tidak Hadir   : ${mahasiswaData.total_absensi} kali`, margin, yPos);
      yPos += 8;
      yPos = addText(`Total Menunggu      : ${mahasiswaData.total_waiting} kali`, margin, yPos);
      yPos += 8;
      yPos = addText(`Persentase Kehadiran: ${mahasiswaData.persentase_kehadiran.toFixed(1)}%`, margin, yPos);
      yPos += 8;
      yPos = addText(`Status Kehadiran    : ${mahasiswaData.status_kehadiran}`, margin, yPos);
      yPos += 15;

      // PERNYATAAN
      const pernyataan = [
        "Bahwa mahasiswa tersebut adalah mahasiswa aktif di Universitas Muhammadiyah Jakarta,",
        "Fakultas Kedokteran, Program Studi Kedokteran.",
        "",
        "Bahwa berdasarkan data kehadiran yang tercatat dalam sistem akademik,",
        `mahasiswa tersebut memiliki tingkat kehadiran sebesar ${mahasiswaData.persentase_kehadiran.toFixed(1)}%`,
        `dengan status kehadiran "${mahasiswaData.status_kehadiran}".`,
        "",
        "Bahwa Surat Keterangan ini dibuat untuk keperluan referensi akademik atau",
        "untuk dipergunakan sebagaimana mestinya.",
      ];

      pernyataan.forEach((line) => {
        if (line) yPos = addText(line, margin, yPos);
        yPos += 5;
      });

      // --- HALAMAN 2: DETAIL KEHADIRAN ---
      addNewPage();

      doc.setFontSize(14);
      doc.setFont("times", "bold");
      yPos = addText("DETAIL KEHADIRAN", 105, yPos, {
        align: "center",
      });
      yPos += 15;

      // Tabel detail kehadiran
      doc.setFontSize(10);
      doc.setFont("times", "bold");

      // Header tabel
      const pageWidth = doc.internal.pageSize.width;
      const availableWidth = pageWidth - margin * 2;

      // Sesuaikan posisi kolom dengan distribusi yang lebih proporsional
      const colTanggal = margin;
      const colMataKuliah = margin + availableWidth * 0.15;
      const colJenis = margin + availableWidth * 0.3;
      const colStatus = margin + availableWidth * 0.45;
      const colWaktu = margin + availableWidth * 0.6;
      const colRuangan = margin + availableWidth * 0.75;
      const colDosen = margin + availableWidth * 0.9;

      // Header
      doc.text("Tanggal", colTanggal, yPos);
      doc.text("Mata Kuliah", colMataKuliah, yPos);
      doc.text("Jenis", colJenis, yPos);
      doc.text("Status", colStatus, yPos);
      doc.text("Waktu", colWaktu, yPos);
      doc.text("Ruangan", colRuangan, yPos);
      doc.text("Dosen", colDosen, yPos);
      yPos += 6;

      // Garis bawah header - menggunakan margin yang sama dengan section lain
      doc.line(margin, yPos, pageWidth - margin, yPos);
      yPos += 6;

      // Data tabel
      doc.setFont("times", "normal");
      filteredKehadiran.forEach((kehadiran) => {
        if (yPos > maxPageHeight - 20) {
          addNewPage();
          yPos = margin + 20;
        }

        const tanggal = new Date(kehadiran.tanggal).toLocaleDateString("id-ID");
        const mataKuliah = kehadiran.mata_kuliah.length > 15
          ? kehadiran.mata_kuliah.substring(0, 15) + "..."
          : kehadiran.mata_kuliah;
        const labelJenis = getJenisJadwalLabel(kehadiran.jenis_jadwal);
        const jenis = labelJenis.length > 12
          ? labelJenis.substring(0, 12) + "..."
          : labelJenis;
        const status = kehadiran.status;
        const waktu = `${kehadiran.jam_mulai} - ${kehadiran.jam_selesai}`;
        const ruangan = kehadiran.ruangan.length > 10
          ? kehadiran.ruangan.substring(0, 10) + "..."
          : kehadiran.ruangan;
        const dosen = kehadiran.dosen.length > 12
          ? kehadiran.dosen.substring(0, 12) + "..."
          : kehadiran.dosen;

        doc.text(tanggal, colTanggal, yPos);
        doc.text(mataKuliah, colMataKuliah, yPos);
        doc.text(jenis, colJenis, yPos);
        doc.text(status, colStatus, yPos);
        doc.text(waktu, colWaktu, yPos);
        doc.text(ruangan, colRuangan, yPos);
        doc.text(dosen, colDosen, yPos);

        yPos += 6;
      });

      // Footer halaman
      const totalPages = (doc as any).internal.pages.length;
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

      // Bagian tanda tangan
      yPos += 25;

      // Posisi tanda tangan
      const signYStart = yPos;

      // Tanggal di kanan
      doc.setFontSize(11);
      doc.setFont("times", "normal");
      doc.text(
        `Jakarta, ${new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`,
        doc.internal.pageSize.width - margin,
        signYStart - 10,
        { align: "right" }
      );

      // Jabatan
      doc.setFontSize(11);
      doc.setFont("times", "bold");
      doc.text(
        "Ketua Program Studi",
        doc.internal.pageSize.width - margin,
        signYStart - 5,
        { align: "right" }
      );

      // Garis tanda tangan
      doc.setFont("times", "normal");
      doc.text(
        "(_________________________)",
        doc.internal.pageSize.width - margin + 7,
        signYStart + 25,
        { align: "right" }
      );

      // Add watermark using centralized helper
      addWatermarkToAllPages(doc);

      // Simpan PDF
      const fileName = `Laporan_Kehadiran_${mahasiswaData.nama.replace(
        /\s+/g,
        "_"
      )}_${new Date().toISOString().split("T")[0]}.pdf`;
      doc.save(fileName);
    } catch (error) {
      console.error("Error saat export PDF:", error);
      // Tidak menampilkan alert, hanya log error
    }
  };

  if (loading) {
    return (
      <div className={isEmbedded ? "" : "min-h-screen bg-gray-50 dark:bg-gray-900"}>
        <div className={isEmbedded ? "" : "mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
          {/* Header Skeleton - Only match layout structure if needed */}
          {!isEmbedded && (
            <div className="mb-8">
              <div className="h-6 w-32 bg-gray-300 dark:bg-gray-600 rounded mb-4 animate-pulse"></div>
              <div className="h-10 w-80 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
              <div className="h-4 w-96 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
            </div>
          )}

          {/* Informasi Mahasiswa Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-2xl animate-pulse"></div>
              <div>
                <div className="h-8 w-64 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
                <div className="h-4 w-48 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="space-y-2">
                  <div className="h-4 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                  <div className="h-5 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Statistik Kehadiran Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse"></div>
                  <div>
                    <div className="h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
                    <div className="h-8 w-12 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Status Kehadiran Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <div className="h-6 w-40 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
                <div className="h-4 w-64 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
              </div>
              <div className="h-8 w-20 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
            </div>
          </div>

          {/* Filter dan Search Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="h-12 w-full bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse"></div>
              </div>
              <div className="flex gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="h-12 w-32 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse"></div>
                ))}
              </div>
            </div>
          </div>

          {/* Detail Kehadiran Table Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <div className="h-6 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                <div className="h-10 w-24 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"></div>
              </div>
            </div>
            <div className="overflow-x-auto hide-scrollbar" style={{
              scrollbarWidth: 'none', /* Firefox */
              msOverflowStyle: 'none', /* Internet Explorer 10+ */
            }}>
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    {Array.from({ length: 9 }).map((_, i) => (
                      <th key={i} className="px-6 py-3">
                        <div className="h-3 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 9 }).map((_, i) => (
                        <td key={i} className="px-6 py-4">
                          <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={isEmbedded ? "p-8" : "min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"}>
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          {!isEmbedded && (
            <button
              onClick={() => window.history.back()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
            >
              Kembali
            </button>
          )}
        </div>
      </div>
    );
  }

  if (!mahasiswaData) {
    return (
      <div className={isEmbedded ? "p-8" : "min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center"}>
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Data mahasiswa tidak ditemukan
          </p>
        </div>
      </div>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{
        __html: `
          .hide-scrollbar::-webkit-scrollbar {
            display: none;
          }
        `
      }} />
      <div className={isEmbedded ? "" : "min-h-screen bg-gray-50 dark:bg-gray-900"}>
        <div className={isEmbedded ? "" : "mx-auto px-4 sm:px-6 lg:px-8 py-8"}>
          {/* Header - Only render if not embedded */}
          {!isEmbedded && (
            <div className="mb-8">
              <button
                onClick={() => window.history.back()}
                className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition mb-4"
              >
                <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
                Kembali
              </button>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                Detail Keabsenan Mahasiswa
              </h1>
              <p className="text-gray-600 dark:text-gray-400">
                Rekapitulasi dan detail kehadiran mahasiswa dalam kegiatan akademik
              </p>
            </div>
          )}



          {/* Informasi Mahasiswa */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                <FontAwesomeIcon icon={faUser} className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-white">
                  {mahasiswaData.nama}
                </h2>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {mahasiswaData.nid} • {mahasiswaData.status === 'lulus' ? 'Lulus' : `Semester ${mahasiswaData.semester}`}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="space-y-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
                <p className="text-sm text-gray-900 dark:text-white font-medium">
                  {mahasiswaData.email}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Telepon
                </p>
                <p className="text-sm text-gray-900 dark:text-white font-medium">
                  {mahasiswaData.telp}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Kelompok Kecil
                </p>
                <p className="text-sm text-gray-900 dark:text-white font-medium">
                  {mahasiswaData.kelompok_kecil || "-"}
                </p>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Kelompok Besar
                </p>
                <p className="text-sm text-gray-900 dark:text-white font-medium">
                  {mahasiswaData.status === 'lulus' ? 'Lulus' : `Semester ${mahasiswaData.semester}`}
                </p>
              </div>
            </div>
          </div>

          {/* Statistik Kehadiran */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    className="w-6 h-6 text-white"
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Hadir
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {mahasiswaData.total_kehadiran}
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faTimesCircle}
                    className="w-6 h-6 text-white"
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Tidak Hadir
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {mahasiswaData.total_absensi}
                  </p>
                </div>
              </div>
            </div>



            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faChartBar}
                    className="w-6 h-6 text-white"
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Persentase
                  </p>
                  <p className="text-xl font-bold text-gray-900 dark:text-white">
                    {mahasiswaData.persentase_kehadiran.toFixed(1)}%
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Status Kehadiran */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Status Kehadiran
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Evaluasi keseluruhan kehadiran mahasiswa
                </p>
              </div>
              <span
                className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${getStatusKehadiranColor(
                  mahasiswaData.status_kehadiran
                )}`}
              >
                {getStatusKehadiranLabel(mahasiswaData.status_kehadiran)}
              </span>
            </div>
          </div>

          {/* Filter dan Search */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="flex flex-col lg:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FontAwesomeIcon
                      icon={faSearch}
                      className="h-5 w-5 text-gray-400"
                    />
                  </div>
                  <input
                    type="text"
                    placeholder="Cari mata kuliah, dosen, atau ruangan..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  />
                </div>
              </div>
              <div className="flex gap-4">
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="all">Semua Status</option>
                  <option value="hadir">Hadir</option>
                  <option value="tidak_hadir">Tidak Hadir</option>
                  <option value="waiting">Menunggu</option>
                </select>
                <select
                  value={filterJenis}
                  onChange={(e) => setFilterJenis(e.target.value)}
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="all">Semua Jenis</option>
                  <option value="kuliah_besar">Kuliah Besar</option>
                  <option value="praktikum">Praktikum</option>
                  <option value="jurnal_reading">Jurnal Reading</option>
                  <option value="pbl">PBL</option>
                  <option value="csr">CSR</option>
                </select>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value)}
                  className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                >
                  <option value="tanggal">Urutkan berdasarkan Tanggal</option>
                  <option value="mata_kuliah">
                    Urutkan berdasarkan Mata Kuliah
                  </option>
                  <option value="status">Urutkan berdasarkan Status</option>
                  <option value="jenis_jadwal">Urutkan berdasarkan Jenis</option>
                </select>
                <button
                  onClick={() =>
                    setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                  }
                  className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  <FontAwesomeIcon icon={faSort} className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>

          {/* Detail Kehadiran */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Detail Kehadiran
                </h3>
                <button
                  onClick={exportPDF}
                  className="inline-flex text-sm items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors shadow-sm"
                >
                  <FontAwesomeIcon icon={faDownload} className="w-3 h-3" />
                  Export PDF
                </button>
              </div>
            </div>

            <div
              className="overflow-x-auto hide-scrollbar"
              style={{
                scrollbarWidth: 'none', /* Firefox */
                msOverflowStyle: 'none', /* Internet Explorer 10+ */
              }}
            >
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tanggal
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Mata Kuliah
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Tipe
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Jenis
                    </th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Waktu
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Ruangan
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Dosen
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                      Alasan/Catatan
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredKehadiran.map((item, index) => (
                    <tr
                      key={`${item.jenis_jadwal}-${item.id}`}
                      className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${index % 2 === 0
                        ? "bg-white dark:bg-gray-800"
                        : "bg-gray-50 dark:bg-gray-700"
                        }`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {formatDate(item.tanggal)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {item.mata_kuliah}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                        {item.jenis_detail || "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getJenisJadwalColor(
                            item.jenis_jadwal
                          )}`}
                        >
                          {getJenisJadwalLabel(item.jenis_jadwal)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-center">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            item.status
                          )}`}
                        >
                          <FontAwesomeIcon
                            icon={getStatusIcon(item.status)}
                            className="w-3 h-3"
                          />
                          {item.status === "tidak_hadir"
                            ? "Tidak Hadir"
                            : item.status === "hadir"
                              ? "Hadir"
                              : item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.jam_mulai} - {item.jam_selesai}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.ruangan}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.dosen}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {item.alasan || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {filteredKehadiran.length === 0 && (
              <div className="text-center py-12">
                <FontAwesomeIcon
                  icon={faCalendarAlt}
                  className="w-12 h-12 text-gray-400 mx-auto mb-4"
                />
                <p className="text-gray-500 dark:text-gray-400">
                  Tidak ada data kehadiran yang sesuai dengan filter
                </p>
              </div>
            )}
          </div>

          {/* Summary */}
          <div className="mt-8 text-center">
            <p className="text-gray-600 dark:text-gray-400">
              Menampilkan{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {filteredKehadiran.length}
              </span>{" "}
              dari{" "}
              <span className="font-semibold text-gray-900 dark:text-white">
                {mahasiswaData.detail_kehadiran.length}
              </span>{" "}
              data kehadiran
            </p>
          </div>
        </div>
      </div >
    </>
  );
};

export default DetailMahasiswaKeabsenan;
