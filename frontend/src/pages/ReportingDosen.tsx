import React, { useState, useEffect } from "react";
import api, { handleApiError } from "../utils/api";
import { DownloadIcon, DocsIcon } from "../icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";
import {
  faChevronDown,
  faChevronUp,
  faBookOpen,
  faUserTie,
} from "@fortawesome/free-solid-svg-icons";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import ExcelJS from "exceljs";

// Extend jsPDF type to include autoTable
declare module "jspdf" {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
  }
}

interface DosenCSRReport {
  dosen_id: number;
  dosen_name: string;
  nid: string;
  keahlian?: string[];
  total_csr: number;
  per_semester: Array<{
    semester: number;
    jumlah: number;
    blok_csr: string[];
    tanggal_mulai?: string;
    tanggal_akhir?: string;
  }>;
  tanggal_mulai?: string;
  tanggal_akhir?: string;
}

interface DosenPBLReport {
  dosen_id: number;
  dosen_name: string;
  nid: string;
  keahlian?: string[];
  total_pbl: number;
  total_sesi: number;
  total_waktu_menit: number;
  per_semester: Array<{
    semester: number;
    jumlah: number;
    total_sesi: number;
    total_waktu_menit: number;
    modul_pbl: Array<{
      blok: number;
      modul_ke: string;
      nama_modul: string;
      mata_kuliah_kode: string;
      mata_kuliah_nama: string;
      waktu_menit: number;
      jumlah_sesi: number;
    }>;
    tanggal_mulai?: string;
    tanggal_akhir?: string;
  }>;
  tanggal_mulai?: string;
  tanggal_akhir?: string;
  // Tambahan multi peran
  dosen_peran?: Array<{
    tipe_peran: string; // koordinator, tim_blok, mengajar
    mata_kuliah_nama?: string;
    semester?: number;
    blok?: number;
    peran_kurikulum?: string;
  }>;
  peran_utama?: string; // fallback lama
  matkul_ketua_nama?: string;
  matkul_anggota_nama?: string;
  peran_kurikulum_mengajar?: string;
}

const SKELETON_ROWS = 6;

const ReportingDosen: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"csr" | "pbl">("csr");
  const [allDosenCsrReport, setAllDosenCsrReport] = useState<DosenCSRReport[]>(
    []
  );
  const [dosenCsrReport, setDosenCsrReport] = useState<DosenCSRReport[]>([]);
  const [allDosenPblReport, setAllDosenPblReport] = useState<DosenPBLReport[]>(
    []
  );
  const [dosenPblReport, setDosenPblReport] = useState<DosenPBLReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    search: "",
    semester: "",
    start_date: "",
    end_date: "",
  });
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 10,
    total: 0,
  });
  const [expandedRows, setExpandedRows] = useState<{ [key: number]: boolean }>(
    {}
  );
  const [expandedPeran, setExpandedPeran] = useState<{
    [key: string]: boolean;
  }>({});
  const toggleExpandedPeran = (rowKey: string) => {
    setExpandedPeran((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };
  const [showExcelDropdown, setShowExcelDropdown] = useState(false);

  // Pindahkan ke luar agar bisa dipanggil event listener
  const fetchDosenReport = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pagination.current_page.toString(),
        per_page: pagination.per_page.toString(),
      });
      let response;
      if (activeTab === "csr") {
        response = await api.get(`/reporting/dosen-csr?${params}`);
        let data = Array.isArray(response.data.data) ? response.data.data : [];
        data = data.map((d: DosenCSRReport) => {
          let allTanggalMulai: string[] = [];
          let allTanggalAkhir: string[] = [];
          d.per_semester.forEach((sem) => {
            if (Array.isArray(sem.tanggal_mulai))
              allTanggalMulai.push(...sem.tanggal_mulai);
            else if (sem.tanggal_mulai) allTanggalMulai.push(sem.tanggal_mulai);
            if (Array.isArray(sem.tanggal_akhir))
              allTanggalAkhir.push(...sem.tanggal_akhir);
            else if (sem.tanggal_akhir) allTanggalAkhir.push(sem.tanggal_akhir);
          });
          d.tanggal_mulai =
            allTanggalMulai.length > 0 ? allTanggalMulai.sort()[0] : undefined;
          d.tanggal_akhir =
            allTanggalAkhir.length > 0
              ? allTanggalAkhir.sort().reverse()[0]
              : undefined;
          return d;
        });
        setAllDosenCsrReport(data);
        setDosenCsrReport(data);
      } else {
        response = await api.get(`/reporting/dosen-pbl?${params}`);
        let data = Array.isArray(response.data.data) ? response.data.data : [];
        
        data = data.map((d: DosenPBLReport) => {
          // Debug: log setiap dosen
          
          // HAPUS: proses JSON.parse/overwrite keahlian di sini
          let allTanggalMulai: string[] = [];
          let allTanggalAkhir: string[] = [];
          d.per_semester.forEach((sem) => {
            if (Array.isArray(sem.tanggal_mulai))
              allTanggalMulai.push(...sem.tanggal_mulai);
            else if (sem.tanggal_mulai) allTanggalMulai.push(sem.tanggal_mulai);
            if (Array.isArray(sem.tanggal_akhir))
              allTanggalAkhir.push(...sem.tanggal_akhir);
            else if (sem.tanggal_akhir) allTanggalAkhir.push(sem.tanggal_akhir);
          });
          d.tanggal_mulai =
            allTanggalMulai.length > 0 ? allTanggalMulai.sort()[0] : undefined;
          d.tanggal_akhir =
            allTanggalAkhir.length > 0
              ? allTanggalAkhir.sort().reverse()[0]
              : undefined;
          return d;
        });
        setAllDosenPblReport(data);
        setDosenPblReport(data);
      }
      setPagination({
        current_page: response.data.current_page || 1,
        last_page: response.data.last_page || 1,
        per_page: response.data.per_page || 15,
        total: response.data.total || 0,
      });
    } catch (error) {
      if (activeTab === "csr") {
        setAllDosenCsrReport([]);
        setDosenCsrReport([]);
      } else {
        setAllDosenPblReport([]);
        setDosenPblReport([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDosenReport();
    // eslint-disable-next-line
  }, [activeTab, pagination.current_page, pagination.per_page]);

  // Tambahkan event listener untuk real-time sync dengan PBL-detail.tsx dan PBLGenerate.tsx
  useEffect(() => {
    const handlePblAssignmentUpdate = () => {
      if (activeTab === "pbl") {

        fetchDosenReport();
      }
    };
    
    const handlePblGenerateCompleted = () => {
      if (activeTab === "pbl") {

        fetchDosenReport();
      }
    };
    
    window.addEventListener("pbl-assignment-updated", handlePblAssignmentUpdate);
    window.addEventListener("pbl-generate-completed", handlePblGenerateCompleted);
    
    return () => {
      window.removeEventListener("pbl-assignment-updated", handlePblAssignmentUpdate);
      window.removeEventListener("pbl-generate-completed", handlePblGenerateCompleted);
    };
  }, [activeTab, fetchDosenReport]);

  // Search & filter
  useEffect(() => {
    const q = filters.search.toLowerCase();
    if (activeTab === "csr") {
      let filtered = allDosenCsrReport;
      if (filters.semester) {
        filtered = filtered.filter((d) =>
          d.per_semester.some(
            (sem) => String(sem.semester) === filters.semester
          )
        );
      }
      if (filters.start_date) {
        filtered = filtered.filter(
          (d) => d.tanggal_mulai && d.tanggal_mulai >= filters.start_date
        );
      }
      if (filters.end_date) {
        filtered = filtered.filter(
          (d) => d.tanggal_akhir && d.tanggal_akhir <= filters.end_date
        );
      }
      if (q) {
        filtered = filtered.filter((d) => {
          const nama = d.dosen_name.toLowerCase();
          const nid = d.nid.toLowerCase();
          const keahlianArr = Array.isArray(d.keahlian)
            ? d.keahlian
            : typeof d.keahlian === "string"
            ? String(d.keahlian)
                .split(",")
                .map((k: string) => k.trim())
            : [];
          const keahlianStr = keahlianArr.join(",").toLowerCase();
          return nama.includes(q) || nid.includes(q) || keahlianStr.includes(q);
        });
      }
      setDosenCsrReport(filtered);
    } else {
      let filtered = allDosenPblReport;
      if (filters.semester) {
        filtered = filtered.filter((d) =>
          d.per_semester.some(
            (sem) => String(sem.semester) === filters.semester
          )
        );
      }
      if (filters.start_date) {
        filtered = filtered.filter(
          (d) => d.tanggal_mulai && d.tanggal_mulai >= filters.start_date
        );
      }
      if (filters.end_date) {
        filtered = filtered.filter(
          (d) => d.tanggal_akhir && d.tanggal_akhir <= filters.end_date
        );
      }
      if (q) {
        filtered = filtered.filter((d) => {
          const nama = d.dosen_name.toLowerCase();
          const nid = d.nid.toLowerCase();
          const keahlianArr = Array.isArray(d.keahlian)
            ? d.keahlian
            : typeof d.keahlian === "string"
            ? String(d.keahlian)
                .split(",")
                .map((k: string) => k.trim())
            : [];
          const keahlianStr = keahlianArr.join(",").toLowerCase();
          return nama.includes(q) || nid.includes(q) || keahlianStr.includes(q);
        });
      }
      setDosenPblReport(filtered);
    }
  }, [filters, allDosenCsrReport, allDosenPblReport, activeTab]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPagination((prev) => ({ ...prev, current_page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination((prev) => ({ ...prev, current_page: page }));
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams(filters);
      const endpoint = activeTab === "csr" ? "dosen-csr" : "dosen-pbl";
      const response = await api.get(
        `/reporting/${endpoint}/export?${params}`
      );
      const blob = new Blob([JSON.stringify(response.data.data, null, 2)], {
        type: "application/json",
      });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = response.data.filename || `dosen-${activeTab}-report.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      const errorMessage = handleApiError(error, 'Export Reporting Dosen');
      // Bisa ditambahkan toast notification di sini
    }
  };

  const handleExportPDF = async () => {
    try {
      const doc = new jsPDF();
      
      // Set font
      doc.setFont("helvetica");
      
      // Load dan add logo asli dari file PNG
      try {
        // Fetch logo dari public folder
        const logoResponse = await fetch('/images/logo/logo-umj.png');
        const logoBlob = await logoResponse.blob();
        const logoUrl = URL.createObjectURL(logoBlob);
        
        // Add logo ke PDF (ukuran kecil)
        const logoSize = 30;
        const logoX = 105 - logoSize/2;
        const logoY = 5;
        
        doc.addImage(logoUrl, 'PNG', logoX, logoY, logoSize, logoSize);
        
        // Cleanup URL
        URL.revokeObjectURL(logoUrl);
      } catch (logoError) {
        // Fallback jika logo tidak bisa dimuat
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("LOGO UMJ", 105, 25, { align: "center" });
      }
      
      // Header Universitas
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("UNIVERSITAS MUHAMMADIYAH JAKARTA", 105, 50, { align: "center" });
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("Fakultas Kedokteran", 105, 58, { align: "center" });
      doc.text("Program Studi Kedokteran", 105, 64, { align: "center" });
      
      doc.setFontSize(10);
      doc.text("Jl. KH. Ahmad Dahlan, Cirendeu, Ciputat, Tangerang Selatan", 105, 70, { align: "center" });
      doc.text("Telp. (021) 742-3740 - Fax. (021) 742-3740", 105, 76, { align: "center" });
      
      // Garis pemisah
      doc.setLineWidth(0.5);
      doc.line(20, 82, 190, 82);
      
      // Judul Laporan
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text("LAPORAN KINERJA DOSEN", 105, 92, { align: "center" });
      
      // Nomor laporan
      const reportNumber = `${Math.floor(Math.random() * 10) + 1}/UMJ-FK/8/2025`;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`No: ${reportNumber}`, 105, 100, { align: "center" });
      
      let currentY = 115;
      
      // Informasi penandatangan
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("Saya yang bertanda tangan di bawah ini:", 20, currentY);
      currentY += 8;
      
      doc.text("Nama : Kepala Program Studi Kedokteran", 20, currentY);
      currentY += 6;
      doc.text("Jabatan : Kepala Program Studi", 20, currentY);
      currentY += 6;
      doc.text("Alamat : Jl. KH. Ahmad Dahlan, Cirendeu, Ciputat, Tangerang Selatan", 20, currentY);
      
      // Halaman Kedua - Tabel Data Dosen PBL Blok 1
      doc.addPage();
      
      // Judul Halaman Kedua
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("REPORTING DOSEN", 20, 20);
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "normal");
      doc.text("BLOK 1 :", 20, 30);
      
      // Filter data dosen PBL untuk Blok 1
      const dosenBlok1 = dosenPblReport.filter((dosen) => {
        // Cek apakah dosen mengajar di Blok 1
        return dosen.per_semester.some((sem) => 
          sem.modul_pbl && sem.modul_pbl.some((modul) => modul.blok === 1)
        );
      });
      
      if (dosenBlok1.length > 0) {
        // Prepare table data
        const tableColumns = [
          "NAMA\nDOSEN",
          "PERAN", 
          "KEAHLIAN",
          "TOTAL\nMODUL\nPBL",
          "TOTAL\nPBL",
          "TOTAL\nWAKTU",
          "PER\nSEMESTER",
          "TANGGAL\nMULAI",
          "TANGGAL\nAKHIR"
        ];
        
        const tableData = dosenBlok1.map((dosen) => {
          // Get role information
          let peranText = "-";
          if (Array.isArray((dosen as any).dosen_peran) && (dosen as any).dosen_peran.length > 0) {
            const peranList = (dosen as any).dosen_peran.map((p: any) => {
              const tipeLabel: Record<string, string> = {
                koordinator: "Koordinator",
                tim_blok: "Tim Blok", 
                dosen_mengajar: "Dosen Mengajar",
                mengajar: "Dosen Mengajar"
              };
              return tipeLabel[p.tipe_peran] || p.tipe_peran;
            });
            peranText = peranList.join(", ");
          } else if ((dosen as any).peran_utama) {
            const peranLabel: Record<string, string> = {
              koordinator: "Koordinator",
              tim_blok: "Tim Blok",
              dosen_mengajar: "Dosen Mengajar", 
              mengajar: "Dosen Mengajar",
              standby: "Standby"
            };
            peranText = peranLabel[(dosen as any).peran_utama] || (dosen as any).peran_utama;
          }
          
          // Get expertise
          let keahlianText = "-";
          if (Array.isArray(dosen.keahlian) && dosen.keahlian.length > 0) {
            keahlianText = dosen.keahlian.join(", ");
          } else if (typeof dosen.keahlian === "string") {
            const keahlianStr = String(dosen.keahlian);
            if (keahlianStr.trim()) {
              keahlianText = keahlianStr;
            }
          }
          
          // Calculate totals for Blok 1 only
          let totalModulBlok1 = 0;
          let totalPblBlok1 = 0;
          let totalWaktuBlok1 = 0;
          let perSemesterText = "";
          
          // Filter data per semester untuk Blok 1
          const semesterBlok1 = dosen.per_semester.filter((sem) => 
            sem.modul_pbl && sem.modul_pbl.some((modul) => modul.blok === 1)
          );
          
          totalModulBlok1 = semesterBlok1.reduce((acc, sem) => 
            acc + (sem.modul_pbl ? sem.modul_pbl.filter(modul => modul.blok === 1).length : 0), 0
          );
          
          const mkSet = new Set<string>();
          semesterBlok1.forEach((sem) => {
            sem.modul_pbl.filter(modul => modul.blok === 1).forEach((modul) => {
              mkSet.add(modul.mata_kuliah_kode);
            });
          });
          totalPblBlok1 = mkSet.size;
          
          totalWaktuBlok1 = semesterBlok1.reduce((acc, sem) => 
            acc + (sem.modul_pbl ? sem.modul_pbl.filter(modul => modul.blok === 1).reduce((sum, modul) => sum + modul.waktu_menit, 0) : 0), 0
          );
          
          perSemesterText = semesterBlok1.map(sem => 
            `Semester ${sem.semester}: ${sem.modul_pbl.filter(modul => modul.blok === 1).length} PBL / ${sem.modul_pbl.filter(modul => modul.blok === 1).reduce((sum, modul) => sum + modul.jumlah_sesi, 0)} sesi`
          ).join(", ");
          
          const totalJam = Math.floor(totalWaktuBlok1 / 60);
          const totalMenit = totalWaktuBlok1 % 60;
          const waktuText = totalJam > 0 ? `${totalJam}j ${totalMenit}m` : `${totalMenit}m`;
          
          // Format tanggal
          const tanggalMulai = dosen.tanggal_mulai ? 
            new Date(dosen.tanggal_mulai).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 
            "-";
          const tanggalAkhir = dosen.tanggal_akhir ? 
            new Date(dosen.tanggal_akhir).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 
            "-";
          
          return [
            dosen.dosen_name,
            peranText,
            keahlianText,
            totalModulBlok1.toString(),
            totalPblBlok1.toString(),
            waktuText,
            perSemesterText,
            tanggalMulai,
            tanggalAkhir
          ];
        });
        
        // Add table
        autoTable(doc, {
          head: [tableColumns],
          body: tableData,
          startY: 40,
          tableWidth: 'auto',
          styles: {
            fontSize: 8,
            cellPadding: 3,
            overflow: 'linebreak',
            cellWidth: 'wrap',
            halign: 'center',
            valign: 'middle',
            fillColor: [255, 255, 255], // Background putih
            textColor: [0, 0, 0], // Teks hitam
            lineColor: [255, 255, 255], // Border transparan
            lineWidth: 0
          },
          headStyles: {
            fillColor: [255, 255, 255], // Background putih
            textColor: [0, 0, 0], // Teks hitam
            fontStyle: 'bold',
            overflow: 'linebreak',
            cellWidth: 'wrap',
            halign: 'center',
            valign: 'middle',
            lineColor: [0, 0, 0], // Border hitam hanya di bottom
            lineWidth: { bottom: 0.5 } // Hanya bottom border
          },
          alternateRowStyles: {
            fillColor: [255, 255, 255], // Background putih
            overflow: 'linebreak',
            cellWidth: 'wrap',
            halign: 'center',
            valign: 'middle',
            textColor: [0, 0, 0], // Teks hitam
            lineColor: [255, 255, 255], // Border transparan
            lineWidth: 0
          },
          columnStyles: {
            0: { cellWidth: 'auto', overflow: 'linebreak', halign: 'left', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [255, 255, 255], lineWidth: 0 }, // NAMA DOSEN
            1: { cellWidth: 'auto', overflow: 'linebreak', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [255, 255, 255], lineWidth: 0 }, // PERAN
            2: { cellWidth: 'auto', overflow: 'linebreak', halign: 'left', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [255, 255, 255], lineWidth: 0 }, // KEAHLIAN
            3: { cellWidth: 'auto', overflow: 'linebreak', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [255, 255, 255], lineWidth: 0 }, // TOTAL MODUL PBL
            4: { cellWidth: 'auto', overflow: 'linebreak', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [255, 255, 255], lineWidth: 0 }, // TOTAL PBL
            5: { cellWidth: 'auto', overflow: 'linebreak', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [255, 255, 255], lineWidth: 0 }, // TOTAL WAKTU
            6: { cellWidth: 'auto', overflow: 'linebreak', halign: 'left', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [255, 255, 255], lineWidth: 0 }, // PER SEMESTER
            7: { cellWidth: 'auto', overflow: 'linebreak', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [255, 255, 255], lineWidth: 0 }, // TANGGAL MULAI
            8: { cellWidth: 'auto', overflow: 'linebreak', halign: 'center', fillColor: [255, 255, 255], textColor: [0, 0, 0], lineColor: [255, 255, 255], lineWidth: 0 }  // TANGGAL AKHIR
          },
          margin: { left: 15, right: 15 }
        });
      } else {
        // Jika tidak ada data Blok 1
        doc.setFontSize(12);
        doc.setFont("helvetica", "normal");
        doc.text("Tidak ada data dosen untuk Blok 1", 20, 50);
      }
      
      // Save the PDF
      const filename = `laporan-kinerja-dosen-${new Date().toISOString().split('T')[0]}.pdf`;
      doc.save(filename);
      
    } catch (error) {
      // Bisa ditambahkan toast notification di sini
    }
  };

  const handleExportExcel = async (blokNumber: number = 1) => {
    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet(`Dosen PBL Blok ${blokNumber}`);

      // Set column headers
      worksheet.columns = [
        { header: 'NAMA DOSEN', key: 'nama', width: 30 },
        { header: 'PERAN', key: 'peran', width: 18 },
        { header: 'KEAHLIAN', key: 'keahlian', width: 25 },
        { header: 'TOTAL MODUL PBL', key: 'total_modul', width: 18 },
        { header: 'TOTAL PBL', key: 'total_pbl', width: 15 },
        { header: 'TOTAL WAKTU', key: 'total_waktu', width: 18 },
        { header: 'PER SEMESTER', key: 'per_semester', width: 40 },
        { header: 'TANGGAL MULAI', key: 'tanggal_mulai', width: 18 },
        { header: 'TANGGAL AKHIR', key: 'tanggal_akhir', width: 18 }
      ];

      // Style header row - abu-abu gelap dengan teks putih sesuai template
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF808080' } // Abu-abu gelap sesuai template
      };
      worksheet.getRow(1).alignment = { horizontal: 'center', vertical: 'middle' };

      // Style data rows - background putih dengan teks hitam
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber > 1) { // Skip header row
          row.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' } // Background putih
          };
          row.font = { color: { argb: 'FF000000' } }; // Teks hitam
        }
      });

      // Add borders to all cells
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
            right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
          };
        });
      });

      // Filter data dosen PBL untuk Blok yang dipilih
      const dosenBlok = dosenPblReport.filter((dosen) => {
        return dosen.per_semester.some((sem) => 
          sem.modul_pbl && sem.modul_pbl.some((modul) => modul.blok === blokNumber)
        );
      });

      // Add data rows
      dosenBlok.forEach((dosen) => {
        // Get role information
        let peranText = "-";
        if (Array.isArray((dosen as any).dosen_peran) && (dosen as any).dosen_peran.length > 0) {
          const peranList = (dosen as any).dosen_peran.map((p: any) => {
            const tipeLabel: Record<string, string> = {
              koordinator: "Koordinator",
              tim_blok: "Tim Blok", 
              dosen_mengajar: "Dosen Mengajar",
              mengajar: "Dosen Mengajar"
            };
            return tipeLabel[p.tipe_peran] || p.tipe_peran;
          });
          peranText = peranList.join(", ");
        } else if ((dosen as any).peran_utama) {
          const peranLabel: Record<string, string> = {
            koordinator: "Koordinator",
            tim_blok: "Tim Blok",
            dosen_mengajar: "Dosen Mengajar", 
            mengajar: "Dosen Mengajar",
            standby: "Standby"
          };
          peranText = peranLabel[(dosen as any).peran_utama] || (dosen as any).peran_utama;
        }

        // Get expertise
        let keahlianText = "-";
        if (Array.isArray(dosen.keahlian) && dosen.keahlian.length > 0) {
          keahlianText = dosen.keahlian.join(", ");
        } else if (typeof dosen.keahlian === "string") {
          const keahlianStr = String(dosen.keahlian);
          if (keahlianStr.trim()) {
            keahlianText = keahlianStr;
          }
        }

        // Calculate totals for Blok 1 only
        let totalModulBlok1 = 0;
        let totalPblBlok1 = 0;
        let totalWaktuBlok1 = 0;
        let perSemesterText = "";

        // Filter data per semester untuk Blok yang dipilih
        const semesterBlok = dosen.per_semester.filter((sem) => 
          sem.modul_pbl && sem.modul_pbl.some((modul) => modul.blok === blokNumber)
        );

        totalModulBlok1 = semesterBlok.reduce((acc, sem) => 
          acc + (sem.modul_pbl ? sem.modul_pbl.filter(modul => modul.blok === blokNumber).length : 0), 0
        );

        const mkSet = new Set<string>();
        semesterBlok.forEach((sem) => {
          sem.modul_pbl.filter(modul => modul.blok === blokNumber).forEach((modul) => {
            mkSet.add(modul.mata_kuliah_kode);
          });
        });
        totalPblBlok1 = mkSet.size;

        totalWaktuBlok1 = semesterBlok.reduce((acc, sem) => 
          acc + (sem.modul_pbl ? sem.modul_pbl.filter(modul => modul.blok === blokNumber).reduce((sum, modul) => sum + modul.waktu_menit, 0) : 0), 0
        );

        perSemesterText = semesterBlok.map(sem => 
          `Semester ${sem.semester}: ${sem.modul_pbl.filter(modul => modul.blok === blokNumber).length} PBL / ${sem.modul_pbl.filter(modul => modul.blok === blokNumber).reduce((sum, modul) => sum + modul.jumlah_sesi, 0)} sesi`
        ).join(", ");

        const totalJam = Math.floor(totalWaktuBlok1 / 60);
        const totalMenit = totalWaktuBlok1 % 60;
        const waktuText = totalJam > 0 ? `${totalJam}j ${totalMenit}m` : `${totalMenit}m`;

        // Format tanggal
        const tanggalMulai = dosen.tanggal_mulai ? 
          new Date(dosen.tanggal_mulai).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 
          "-";
        const tanggalAkhir = dosen.tanggal_akhir ? 
          new Date(dosen.tanggal_akhir).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 
          "-";

        worksheet.addRow({
          nama: dosen.dosen_name,
          peran: peranText,
          keahlian: keahlianText,
          total_modul: totalModulBlok1,
          total_pbl: totalPblBlok1,
          total_waktu: waktuText,
          per_semester: perSemesterText,
          tanggal_mulai: tanggalMulai,
          tanggal_akhir: tanggalAkhir
        });
      });

      // Auto-fit columns
      worksheet.columns.forEach(column => {
        column.width = Math.max(column.width || 10, 15);
      });

      // Generate Excel file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-dosen-pbl-blok${blokNumber}-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      // Bisa ditambahkan toast notification di sini
    }
  };

  const handleExportExcelByBlok = async (selectedBlok: number | null) => {
    try {
        // Debug logging untuk melihat data yang tersedia
        
        // Ambil data blok dari API yang sudah kita buat
        const blokResponse = await api.get('/reporting/blok-data-excel');
        const blokData = blokResponse.data.data || [];
        if (blokData.length > 0) {
        }
        
        // Ambil data dosen untuk mapping
        const dosenResponse = await api.get('/users');
        const dosenData = dosenResponse.data.data || [];
        
        // Buat mapping dosen
        const dosenMap: { [key: number]: string } = {};
        dosenData.forEach((dosen: any) => {
          dosenMap[dosen.id] = dosen.name;
        });
        
        // Ambil data mata kuliah untuk menghitung perencanaan PBL dan Jurnal Reading
        // Perencanaan PBL = jumlah daftar modul PBL × 5
        // Perencanaan Jurnal Reading = jumlah daftar jurnal reading × 2
        const mataKuliahResponse = await api.get('/mata-kuliah');
        const allMataKuliah = mataKuliahResponse.data || [];
        
        // Buat mapping perencanaan PBL dan Jurnal Reading berdasarkan blok, semester, dan dosen
        // PERBAIKAN: 
        // - Perencanaan PBL dihitung per blok (karena daftar modul PBL biasanya sama untuk semua semester dengan blok yang sama)
        // - Perencanaan Jurnal Reading dihitung per semester (karena bisa berbeda per semester)
        // Key PBL: `${dosen_name}_blok${blok}`
        // Key Jurnal: `${dosen_name}_blok${blok}_semester${semester}`
        const perencanaanPblMap: { [key: string]: number } = {}; // Key: `${dosen_name}_blok${blok}`
        const perencanaanJurnalMap: { [key: string]: number } = {}; // Key: `${dosen_name}_blok${blok}_semester${semester}`
        
        // Map untuk tracking mata kuliah yang sudah dihitung per dosen (untuk menghindari duplikasi)
        const processedMkPerDosenPbl: { [key: string]: Set<string> } = {}; // Key: `${dosen_name}_blok${blok}`
        const processedMkPerDosenJurnal: { [key: string]: Set<string> } = {}; // Key: `${dosen_name}_blok${blok}_semester${semester}`
        
        // Filter mata kuliah berdasarkan selectedBlok
        const filteredMataKuliah = selectedBlok !== null
          ? allMataKuliah.filter((mk: any) => mk.jenis === 'Blok' && mk.blok === selectedBlok)
          : allMataKuliah.filter((mk: any) => mk.jenis === 'Non Blok');
        
        
        // Ambil data daftar modul PBL dan jurnal reading untuk setiap mata kuliah
        for (const mk of filteredMataKuliah) {
          try {
            // Ambil daftar modul PBL
            const pblListResponse = await api.get(`/mata-kuliah/${mk.kode}/pbls`);
            const pblList = Array.isArray(pblListResponse.data) ? pblListResponse.data : [];
            const jumlahModulPbl = pblList.length;
            
            // Ambil daftar jurnal reading
            const jurnalListResponse = await api.get(`/mata-kuliah/${mk.kode}/jurnal-readings`);
            const jurnalList = Array.isArray(jurnalListResponse.data) ? jurnalListResponse.data : [];
            const jumlahJurnalReading = jurnalList.length;
            
            // Ambil semua dosen yang mengajar di mata kuliah ini dari blokData
            const dosenDiMataKuliah = new Set<string>();
            blokData.forEach((item: any) => {
              if (item.mata_kuliah_kode === mk.kode) {
                // Ambil dosen dari semua jenis jadwal
                if (item.pbl1) {
                  item.pbl1.forEach((j: any) => {
                    if (j.dosen_name) dosenDiMataKuliah.add(j.dosen_name);
                  });
                }
                if (item.pbl2) {
                  item.pbl2.forEach((j: any) => {
                    if (j.dosen_name) dosenDiMataKuliah.add(j.dosen_name);
                  });
                }
                if (item.jurnal_reading) {
                  item.jurnal_reading.forEach((j: any) => {
                    if (j.dosen_name) dosenDiMataKuliah.add(j.dosen_name);
                  });
                }
                if (item.kuliah_besar) {
                  item.kuliah_besar.forEach((j: any) => {
                    if (j.dosen_name) dosenDiMataKuliah.add(j.dosen_name);
                  });
                }
                if (item.praktikum) {
                  item.praktikum.forEach((j: any) => {
                    if (j.dosen_name) dosenDiMataKuliah.add(j.dosen_name);
                  });
                }
                if (item.seminar_pleno) {
                  item.seminar_pleno.forEach((j: any) => {
                    if (j.dosen_name) dosenDiMataKuliah.add(j.dosen_name);
                  });
                }
                if (item.pp_pbl) {
                  item.pp_pbl.forEach((j: any) => {
                    if (j.dosen_name) dosenDiMataKuliah.add(j.dosen_name);
                  });
                }
              }
            });
            
            // Hitung perencanaan untuk setiap dosen
            // PERBAIKAN: 
            // - Perencanaan PBL dihitung per blok (karena daftar modul PBL biasanya sama untuk semua semester dengan blok yang sama)
            // - Perencanaan Jurnal Reading dihitung per semester (karena bisa berbeda per semester)
            dosenDiMataKuliah.forEach((dosenName) => {
              // Key perencanaan PBL: per blok saja (tanpa semester)
              const keyPerencanaanPbl = `${dosenName}_blok${mk.blok || 'null'}`;
              // Key perencanaan Jurnal: per blok dan semester
              const keyPerencanaanJurnal = `${dosenName}_blok${mk.blok || 'null'}_semester${mk.semester}`;
              
              // Initialize maps jika belum ada
              if (!perencanaanPblMap[keyPerencanaanPbl]) {
                perencanaanPblMap[keyPerencanaanPbl] = 0;
              }
              if (!perencanaanJurnalMap[keyPerencanaanJurnal]) {
                perencanaanJurnalMap[keyPerencanaanJurnal] = 0;
              }
              if (!processedMkPerDosenPbl[keyPerencanaanPbl]) {
                processedMkPerDosenPbl[keyPerencanaanPbl] = new Set<string>();
              }
              if (!processedMkPerDosenJurnal[keyPerencanaanJurnal]) {
                processedMkPerDosenJurnal[keyPerencanaanJurnal] = new Set<string>();
              }
              
              // Hitung perencanaan PBL (per blok)
              // Cek apakah mata kuliah ini sudah dihitung untuk dosen ini
              if (!processedMkPerDosenPbl[keyPerencanaanPbl].has(mk.kode)) {
                const pblPerencanaan = jumlahModulPbl * 5;
                
                if (pblPerencanaan > 0) {
                  // Hanya update jika nilai yang sudah ada adalah 0 atau nilai baru lebih besar
                  if (perencanaanPblMap[keyPerencanaanPbl] === 0) {
                    perencanaanPblMap[keyPerencanaanPbl] = pblPerencanaan;
                  } else if (pblPerencanaan > perencanaanPblMap[keyPerencanaanPbl]) {
                    // Jika nilai baru lebih besar, update (mungkin ada mata kuliah lain dengan lebih banyak daftar PBL)
                    perencanaanPblMap[keyPerencanaanPbl] = pblPerencanaan;
                  }
                }
                
                // Tandai mata kuliah ini sudah diproses untuk PBL
                processedMkPerDosenPbl[keyPerencanaanPbl].add(mk.kode);
              }
              
              // Hitung perencanaan Jurnal Reading (per semester)
              // PERBAIKAN: Perencanaan jurnal reading dihitung per mata kuliah
              // Jika mata kuliah tidak memiliki daftar jurnal reading, nilainya 0
              // Cek apakah mata kuliah ini sudah dihitung untuk dosen ini di semester ini
              if (!processedMkPerDosenJurnal[keyPerencanaanJurnal].has(mk.kode)) {
                const jurnalPerencanaan = jumlahJurnalReading * 2;
                
                // PERBAIKAN: Jika tidak ada daftar jurnal reading, set nilai ke 0
                // Ini untuk memastikan bahwa jika mata kuliah tidak memiliki daftar jurnal reading,
                // perencanaan jurnal reading untuk dosen yang mengajar di mata kuliah tersebut adalah 0
                if (jumlahJurnalReading === 0) {
                  // Jika tidak ada daftar jurnal reading, set nilai ke 0 (jika belum ada nilai sebelumnya)
                  if (perencanaanJurnalMap[keyPerencanaanJurnal] === undefined) {
                    perencanaanJurnalMap[keyPerencanaanJurnal] = 0;
                  }
                } else if (jurnalPerencanaan > 0) {
                  // Hanya update jika nilai yang sudah ada adalah 0 atau nilai baru lebih besar
                  if (perencanaanJurnalMap[keyPerencanaanJurnal] === 0 || perencanaanJurnalMap[keyPerencanaanJurnal] === undefined) {
                    perencanaanJurnalMap[keyPerencanaanJurnal] = jurnalPerencanaan;
                  } else if (jurnalPerencanaan > perencanaanJurnalMap[keyPerencanaanJurnal]) {
                    // Jika nilai baru lebih besar, update
                    perencanaanJurnalMap[keyPerencanaanJurnal] = jurnalPerencanaan;
                  }
                }
                
                // Tandai mata kuliah ini sudah diproses untuk Jurnal Reading
                processedMkPerDosenJurnal[keyPerencanaanJurnal].add(mk.kode);
              }
            });
          } catch (error) {
          }
        }
      
      const workbook = new ExcelJS.Workbook();
      const worksheetName = selectedBlok === null ? 'Non Blok' : `Blok ${selectedBlok}`;
      const worksheet = workbook.addWorksheet(`DAFTAR REKAPITULASI SKS ${worksheetName}`);

      // Set column widths sesuai template baru
      if (selectedBlok === null) {
        // Non-blok: Kolom sesuai template dengan lebar yang cukup untuk header tidak terpotong
        worksheet.columns = [
          { width: 10 },  // A: NO (ditingkatkan dari 8)
          { width: 40 },  // B: NAMA DOSEN (ditingkatkan dari 35)
          { width: 18 },  // C: CSR REGULER (PERENCANAAN) (ditingkatkan dari 15)
          { width: 18 },  // D: CSR RESPONSI (PERENCANAAN) (ditingkatkan dari 15)
          { width: 18 },  // E: MATERI (PERENCANAAN) (ditingkatkan dari 15)
          { width: 15 },  // F: TOTAL JAM (PERENCANAAN) (ditingkatkan dari 12)
          { width: 18 },  // G: CSR REGULER (REALISASI) (ditingkatkan dari 15)
          { width: 18 },  // H: CSR RESPONSI (REALISASI) (ditingkatkan dari 15)
          { width: 18 },  // I: MATERI (REALISASI) (ditingkatkan dari 15)
          { width: 15 }   // J: Total Jam (REALISASI) (ditingkatkan dari 12)
        ];
      } else {
        // Blok data: Kolom sesuai template dengan lebar yang cukup untuk header tidak terpotong
        // PBL 1 dan PBL 2 di perencanaan digabung jadi satu kolom "PBL"
        worksheet.columns = [
          { width: 10 },  // A: NO (ditingkatkan dari 8)
          { width: 40 },  // B: NAMA DOSEN (ditingkatkan dari 35)
          { width: 18 },  // C: PBL (PER 50') - PERENCANAAN (gabungan PBL 1 + PBL 2)
          { width: 18 },  // D: JURDING (PER 50') - PERENCANAAN
          { width: 18 },  // E: KULIAH (PER 50') - PERENCANAAN
          { width: 18 },  // F: PRAKTIKUM (PER 50') - PERENCANAAN
          { width: 18 },  // G: PP PBL (PER 50') - PERENCANAAN
          { width: 18 },  // H: SEMINAR PLENO (PER 50') - PERENCANAAN
          { width: 15 },  // I: TOTAL JAM - PERENCANAAN
          { width: 18 },  // J: PBL 1 (PER 50') - REALISASI
          { width: 18 },  // K: PBL 2 (PER 50') - REALISASI
          { width: 18 },  // L: JURDING (PER 50') - REALISASI
          { width: 18 },  // M: KULIAH (PER 50') - REALISASI
          { width: 18 },  // N: PRAKTIKUM (PER 50') - REALISASI
          { width: 18 },  // O: PP PBL (PER 50') - REALISASI
          { width: 18 },  // P: SEMINAR PLENO (PER 50') - REALISASI
          { width: 15 }   // Q: Total Jam - REALISASI
        ];
      }

      let currentRow = 1;

      // Helper function to safely merge cells
      // This function handles cases where cells might already be merged
      const safeMergeCells = (range: string) => {
        try {
          // Check if start cell is already part of a merge
          const [startCellRef] = range.split(':');
          const startCell = worksheet.getCell(startCellRef);
          
          // If cell is merged, try to unmerge it first
          if (startCell.isMerged) {
            try {
              // Try to unmerge using the range - this might fail if the range doesn't match exactly
              worksheet.unMergeCells(range);
            } catch (unmergeError) {
              // If unmerge fails, the range might be different
              // Try to find the actual merged range by checking adjacent cells
              // For now, we'll just skip this merge to avoid errors
              return;
            }
          }
          
          // Now try to merge
          worksheet.mergeCells(range);
        } catch (error: any) {
          // If merge fails, check the error message
          const errorMsg = error.message || String(error);
          
          if (errorMsg.includes('already merged') || errorMsg.includes('Cannot merge')) {
            // Cells are already merged - this is okay, just skip
          } else {
            // Some other error - log it but don't throw
          }
          // Don't throw - just continue without merging
        }
      };

      // Get blok name and semester info from data
      let blokName = '';
      let semesterInfo = '';
      const currentYear = new Date().getFullYear();
      const nextYear = currentYear + 1;
      const tahunAjaran = `${currentYear}_${nextYear}`;
      
      if (blokData.length > 0 && selectedBlok !== null) {
        // Find first blok data untuk mendapatkan nama blok
        const firstBlokData = blokData.find((item: any) => item.blok === selectedBlok);
        if (firstBlokData) {
          blokName = firstBlokData.mata_kuliah_nama || `BLOK ${selectedBlok}`;
          // Get semester info - convert semester number to GANJIL/GENAP
          // Semester 1,3,5,7 = GANJIL, Semester 2,4,6 = GENAP
          const semester = firstBlokData.semester ? parseInt(firstBlokData.semester) : 1;
          const isGenap = semester % 2 === 0;
          semesterInfo = `SEMESTER ${isGenap ? 'GENAP' : 'GANJIL'}: ${tahunAjaran}`;
        } else {
          // Fallback jika tidak ada data
          blokName = `BLOK ${selectedBlok}`;
          semesterInfo = `SEMESTER GANJIL: ${tahunAjaran}`;
        }
      } else if (selectedBlok === null) {
        // For non-blok, get semester from first non-blok data
        const firstNonBlokData = blokData.find((item: any) => item.blok === null || item.blok === undefined);
        if (firstNonBlokData) {
          const semester = firstNonBlokData.semester ? parseInt(firstNonBlokData.semester) : 1;
          const isGenap = semester % 2 === 0;
          semesterInfo = `SEMESTER ${isGenap ? 'GENAP' : 'GANJIL'}: ${tahunAjaran}`;
        } else {
          semesterInfo = `SEMESTER GANJIL: ${tahunAjaran}`;
        }
      } else {
        // Fallback
        semesterInfo = `SEMESTER GANJIL: ${tahunAjaran}`;
      }

      // Header Row 1: Main Title - merge cell dari A sampai kolom terakhir, teks memanjang tidak terpotong
      const titleCols = selectedBlok === null ? 'A:J' : 'A:Q';
      safeMergeCells(`${titleCols}${currentRow}`);
      const titleRow = worksheet.getRow(currentRow);
      titleRow.height = 20; // Row height normal
      const titleCell = worksheet.getCell(`A${currentRow}`);
      titleCell.value = 'DAFTAR REKAPITULASI PERHITUNGAN SKS DOSEN';
      titleCell.font = { size: 16, bold: true, color: { argb: 'FF000000' } }; // Teks hitam
      titleCell.alignment = { 
        horizontal: 'center', 
        vertical: 'middle', 
        wrapText: false, // Tidak wrap, teks memanjang
        shrinkToFit: false // Teks tidak mengecil
      };
      titleRow.alignment = { horizontal: 'center', vertical: 'middle' }; // Pastikan row juga di tengah
      titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Background putih
      currentRow += 1;

      // Header Row 2: Blok/Non Blok Info - merge cell dari A sampai kolom terakhir, teks memanjang tidak terpotong
      safeMergeCells(`${titleCols}${currentRow}`);
      const blokInfoRow = worksheet.getRow(currentRow);
      blokInfoRow.height = 20; // Row height normal
      const blokInfoCell = worksheet.getCell(`A${currentRow}`);
      if (selectedBlok !== null) {
        blokInfoCell.value = `PSKD FKK UMJ: BLOK ${selectedBlok}: ${blokName}`;
      } else {
        blokInfoCell.value = `PSKD FKK UMJ: NON BLOK`;
      }
      blokInfoCell.font = { size: 14, bold: true, color: { argb: 'FF000000' } }; // Teks hitam
      blokInfoCell.alignment = { 
        horizontal: 'center', 
        vertical: 'middle', 
        wrapText: false, // Tidak wrap, teks memanjang
        shrinkToFit: false // Teks tidak mengecil
      };
      blokInfoRow.alignment = { horizontal: 'center', vertical: 'middle' }; // Pastikan row juga di tengah
      blokInfoCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Background putih
      currentRow += 1;

      // Header Row 3: Semester Info - merge cell dari A sampai kolom terakhir, teks memanjang tidak terpotong
      safeMergeCells(`${titleCols}${currentRow}`);
      const semesterRow = worksheet.getRow(currentRow);
      semesterRow.height = 20; // Row height normal
      const semesterCell = worksheet.getCell(`A${currentRow}`);
      semesterCell.value = semesterInfo;
      semesterCell.font = { size: 14, bold: true, color: { argb: 'FF000000' } }; // Teks hitam
      semesterCell.alignment = { 
        horizontal: 'center', 
        vertical: 'middle', 
        wrapText: false, // Tidak wrap, teks memanjang
        shrinkToFit: false // Teks tidak mengecil
      };
      semesterRow.alignment = { horizontal: 'center', vertical: 'middle' }; // Pastikan row juga di tengah
      semesterCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFFFF' } }; // Background putih
      currentRow += 2; // Skip one row before table

      // Group data blok by dosen, blok, dan semester
      // Struktur baru: memisahkan perencanaan dan realisasi
      const jadwalByDosenBlokSemester: { [key: string]: any } = {};
      
      
      // Debug: Cek struktur data blok
      if (blokData.length === 0) {
        // Don't return - continue to generate empty template
      }
      
      
      // Helper function untuk memisahkan perencanaan dan realisasi
      const processJadwal = (jadwal: any, jenis: string, key: string, isPerencanaan: boolean) => {
        if (!jadwalByDosenBlokSemester[key]) {
          jadwalByDosenBlokSemester[key] = {
            dosen_name: jadwal.dosen_name,
            blok: jadwal.blok || null,
            semester: jadwal.semester,
            // Perencanaan
            pbl1_perencanaan: 0,
            pbl2_perencanaan: 0,
            jurnalReading_perencanaan: 0,
            csrReguler_perencanaan: 0,
            csrResponsi_perencanaan: 0,
            materi_perencanaan: 0,
            seminarPleno_perencanaan: 0,
            ppPbl_perencanaan: 0,
            praktikum_perencanaan: 0,
            kuliahBesar_perencanaan: 0,
            // Realisasi
            pbl1_realisasi: 0,
            pbl2_realisasi: 0,
            praktikum_realisasi: 0,
            kuliahBesar_realisasi: 0,
            jurnalReading_realisasi: 0,
            csrReguler_realisasi: 0,
            csrResponsi_realisasi: 0,
            materi_realisasi: 0,
            seminarPleno_realisasi: 0,
            ppPbl_realisasi: 0,
          };
        }
        
        // Cek apakah jadwal sudah dinilai/absensi
        let isSudahDinilaiAbsensi = false;
        
        if (jenis === 'pbl1' || jenis === 'pbl2' || jenis === 'jurnal_reading') {
          // Nilai: PBL 1, PBL 2, Jurnal Reading - cek penilaian_submitted
          isSudahDinilaiAbsensi = jadwal.penilaian_submitted === true;
        } else if (jenis === 'kuliah_besar' || jenis === 'praktikum' || jenis === 'seminar_pleno') {
          // Absensi: Kuliah Besar, Praktikum, Seminar Pleno - cek has_absensi
          isSudahDinilaiAbsensi = jadwal.has_absensi === true;
        } else if (jenis === 'pp_pbl') {
          // Absensi + Masuk Laporan: PP PBL - harus sudah di-absensi DAN centang masuk laporan
          isSudahDinilaiAbsensi = jadwal.has_absensi === true && jadwal.penilaian_submitted === true;
        } else if (jenis === 'csr_reguler' || jenis === 'csr_responsi') {
          // CSR: cek penilaian_submitted
          isSudahDinilaiAbsensi = jadwal.penilaian_submitted === true;
        } else if (jenis === 'materi') {
          // Materi: cek status_konfirmasi
          isSudahDinilaiAbsensi = jadwal.status_konfirmasi === "bisa";
        }
        
        if (isPerencanaan) {
          // Perencanaan PBL dan Jurnal Reading diambil dari daftar modul PBL dan jurnal reading mata kuliah
          // Bukan dari jadwal, jadi skip perhitungan dari jadwal untuk PBL dan Jurnal Reading
          if (jenis === 'pbl1' || jenis === 'pbl2' || jenis === 'jurnal_reading') {
            // Perencanaan PBL dan Jurnal Reading akan dihitung dari perencanaanPblJurnalMap
            // Skip perhitungan dari jadwal
            return;
          }
          
          // Perencanaan: hanya jadwal yang BELUM dinilai/absensi (untuk jenis lain selain PBL dan Jurnal Reading)
          if (!isSudahDinilaiAbsensi) {
            if (jenis === 'csr_reguler') {
              // Perencanaan CSR akan dihitung nanti berdasarkan keahlian dosen (jumlah keahlian × 5)
              // Untuk saat ini, hanya tandai bahwa dosen memiliki assignment CSR
              // Nilai sebenarnya akan dihitung di bagian agregasi berdasarkan keahlian dosen
              jadwalByDosenBlokSemester[key].csrReguler_perencanaan = 1; // Flag bahwa ada assignment
            } else if (jenis === 'csr_responsi') {
              // Perencanaan CSR akan dihitung nanti berdasarkan keahlian dosen (jumlah keahlian × 5)
              jadwalByDosenBlokSemester[key].csrResponsi_perencanaan = 1; // Flag bahwa ada assignment
            } else if (jenis === 'materi') {
              jadwalByDosenBlokSemester[key].materi_perencanaan += jadwal.jumlah_sesi || 0;
            } else if (jenis === 'seminar_pleno') {
              jadwalByDosenBlokSemester[key].seminarPleno_perencanaan += jadwal.jumlah_sesi || 0;
            } else if (jenis === 'pp_pbl') {
              jadwalByDosenBlokSemester[key].ppPbl_perencanaan += jadwal.jumlah_sesi || 0;
            } else if (jenis === 'praktikum') {
              // Perencanaan Praktikum: hitung dari semua jadwal
              jadwalByDosenBlokSemester[key].praktikum_perencanaan += jadwal.jumlah_sesi || 0;
            } else if (jenis === 'kuliah_besar') {
              // Perencanaan Kuliah Besar: hitung dari semua jadwal
              jadwalByDosenBlokSemester[key].kuliahBesar_perencanaan += jadwal.jumlah_sesi || 0;
            }
          }
        } else {
          // Realisasi: hanya jadwal yang SUDAH dinilai/absensi
          if (isSudahDinilaiAbsensi) {
            if (jenis === 'pbl1') {
              // PBL 1 memiliki nilai tetap 2 per jadwal
              jadwalByDosenBlokSemester[key].pbl1_realisasi += 2;
            } else if (jenis === 'pbl2') {
              // PBL 2 memiliki nilai tetap 3 per jadwal
              jadwalByDosenBlokSemester[key].pbl2_realisasi += 3;
            } else if (jenis === 'jurnal_reading') {
              jadwalByDosenBlokSemester[key].jurnalReading_realisasi += jadwal.jumlah_sesi || 0;
            } else if (jenis === 'praktikum') {
              jadwalByDosenBlokSemester[key].praktikum_realisasi += jadwal.jumlah_sesi || 0;
            } else if (jenis === 'kuliah_besar') {
              jadwalByDosenBlokSemester[key].kuliahBesar_realisasi += jadwal.jumlah_sesi || 0;
            } else if (jenis === 'csr_reguler') {
              jadwalByDosenBlokSemester[key].csrReguler_realisasi += jadwal.jumlah_sesi || 0;
            } else if (jenis === 'csr_responsi') {
              jadwalByDosenBlokSemester[key].csrResponsi_realisasi += jadwal.jumlah_sesi || 0;
            } else if (jenis === 'materi') {
              jadwalByDosenBlokSemester[key].materi_realisasi += jadwal.jumlah_sesi || 0;
            } else if (jenis === 'seminar_pleno') {
              jadwalByDosenBlokSemester[key].seminarPleno_realisasi += jadwal.jumlah_sesi || 0;
            } else if (jenis === 'pp_pbl') {
              jadwalByDosenBlokSemester[key].ppPbl_realisasi += jadwal.jumlah_sesi || 0;
            }
          }
        }
      };
      
      // Process data blok dari API (only if selectedBlok is not null)
      if (selectedBlok !== null) {
        blokData.forEach((blokDataItem: any) => {
          const blok = blokDataItem.blok;
          const semester = blokDataItem.semester;
          
          // Only process selected blok data
          if (blok === null || blok === undefined || blok !== selectedBlok) {
            return;
          }
          
          
          // Process PBL 1 - Perencanaan dan Realisasi
          if (blokDataItem.pbl1 && blokDataItem.pbl1.length > 0) {
          blokDataItem.pbl1.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_blok${blok}_semester${semester}`;
            // Tambahkan blok dan semester ke jadwal untuk helper function
            jadwal.blok = blok;
            jadwal.semester = semester;
            // Process perencanaan (semua jadwal masuk ke perencanaan)
            processJadwal(jadwal, 'pbl1', key, true);
            // Process realisasi (hanya yang sudah dinilai dan masuk laporan)
            processJadwal(jadwal, 'pbl1', key, false);
          });
        }
        
        // Process PBL 2 - Perencanaan dan Realisasi
        if (blokDataItem.pbl2 && blokDataItem.pbl2.length > 0) {
          blokDataItem.pbl2.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_blok${blok}_semester${semester}`;
            jadwal.blok = blok;
            jadwal.semester = semester;
            // Process perencanaan (semua jadwal masuk ke perencanaan)
            processJadwal(jadwal, 'pbl2', key, true);
            // Process realisasi (hanya yang sudah dinilai dan masuk laporan)
            processJadwal(jadwal, 'pbl2', key, false);
          });
        }
        
        // Skip CSR Reguler and CSR Responsi for blok data (only for non blok)
        
        // Process Praktikum - Perencanaan dan Realisasi
        if (blokDataItem.praktikum && blokDataItem.praktikum.length > 0) {
          blokDataItem.praktikum.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_blok${blok}_semester${semester}`;
            jadwal.blok = blok;
            jadwal.semester = semester;
            // Process perencanaan (semua jadwal masuk ke perencanaan)
            processJadwal(jadwal, 'praktikum', key, true);
            // Process realisasi (hanya yang sudah di-absensi)
            processJadwal(jadwal, 'praktikum', key, false);
          });
        }
        
        // Process Kuliah Besar - Perencanaan dan Realisasi
        if (blokDataItem.kuliah_besar && blokDataItem.kuliah_besar.length > 0) {
          blokDataItem.kuliah_besar.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_blok${blok}_semester${semester}`;
            jadwal.blok = blok;
            jadwal.semester = semester;
            // Process perencanaan (semua jadwal masuk ke perencanaan)
            processJadwal(jadwal, 'kuliah_besar', key, true);
            // Process realisasi (hanya yang sudah di-absensi)
            processJadwal(jadwal, 'kuliah_besar', key, false);
          });
        }
        
        // Process Jurnal Reading - Perencanaan dan Realisasi
        if (blokDataItem.jurnal_reading && blokDataItem.jurnal_reading.length > 0) {
          blokDataItem.jurnal_reading.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_blok${blok}_semester${semester}`;
            jadwal.blok = blok;
            jadwal.semester = semester;
            // Process perencanaan (semua jadwal masuk ke perencanaan)
            processJadwal(jadwal, 'jurnal_reading', key, true);
            // Process realisasi (hanya yang sudah dinilai dan masuk laporan)
            processJadwal(jadwal, 'jurnal_reading', key, false);
          });
        }
        
        // Process Seminar Pleno - Perencanaan dan Realisasi
        if (blokDataItem.seminar_pleno && blokDataItem.seminar_pleno.length > 0) {
          blokDataItem.seminar_pleno.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_blok${blok}_semester${semester}`;
            jadwal.blok = blok;
            jadwal.semester = semester;
            // Process perencanaan (semua jadwal masuk ke perencanaan)
            processJadwal(jadwal, 'seminar_pleno', key, true);
            // Process realisasi (hanya yang sudah di-absensi)
            processJadwal(jadwal, 'seminar_pleno', key, false);
          });
        }
        
        // Process PP PBL - Perencanaan dan Realisasi
        if (blokDataItem.pp_pbl && blokDataItem.pp_pbl.length > 0) {
          blokDataItem.pp_pbl.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_blok${blok}_semester${semester}`;
            jadwal.blok = blok;
            jadwal.semester = semester;
            // Process perencanaan (semua jadwal masuk ke perencanaan)
            processJadwal(jadwal, 'pp_pbl', key, true);
            // Process realisasi (hanya yang sudah di-absensi DAN centang masuk laporan)
            processJadwal(jadwal, 'pp_pbl', key, false);
          });
        }
        
        // Skip Materi for blok data (only for non blok)
        });
      }

      // Process non blok data separately (only if selectedBlok is null)
      if (selectedBlok === null) {
        blokData.forEach((blokDataItem: any) => {
          const blok = blokDataItem.blok;
          const semester = blokDataItem.semester;
          
          // Only process non blok data
          if (blok !== null && blok !== undefined) {
            return;
          }
          
        
        // Process CSR Reguler for non blok - Perencanaan dan Realisasi
        if (blokDataItem.csr_reguler && blokDataItem.csr_reguler.length > 0) {
          blokDataItem.csr_reguler.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_nonblok_semester${semester}`;
            jadwal.blok = null;
            jadwal.semester = semester;
            // Process perencanaan (akan dihitung berdasarkan keahlian dosen nanti)
            processJadwal(jadwal, 'csr_reguler', key, true);
            // Process realisasi (hanya yang sudah dinilai dan masuk laporan)
            processJadwal(jadwal, 'csr_reguler', key, false);
          });
        }
        
        // Process CSR Responsi for non blok - Perencanaan dan Realisasi
        if (blokDataItem.csr_responsi && blokDataItem.csr_responsi.length > 0) {
          blokDataItem.csr_responsi.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_nonblok_semester${semester}`;
            jadwal.blok = null;
            jadwal.semester = semester;
            // Process perencanaan (akan dihitung berdasarkan keahlian dosen nanti)
            processJadwal(jadwal, 'csr_responsi', key, true);
            // Process realisasi (hanya yang sudah dinilai dan masuk laporan)
            processJadwal(jadwal, 'csr_responsi', key, false);
          });
        }
        
        // Process Materi for non blok - Perencanaan dan Realisasi
        if (blokDataItem.materi && blokDataItem.materi.length > 0) {
          blokDataItem.materi.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_nonblok_semester${semester}`;
            jadwal.blok = null;
            jadwal.semester = semester;
            // Process perencanaan (semua jadwal masuk ke perencanaan)
            processJadwal(jadwal, 'materi', key, true);
            // Process realisasi (hanya jika status_konfirmasi === "bisa")
            processJadwal(jadwal, 'materi', key, false);
          });
        }
        });
      }

      // Isi perencanaan PBL dan Jurnal Reading dari perencanaanPblMap dan perencanaanJurnalMap
      // PERBAIKAN: 
      // - Perencanaan PBL dihitung per blok (tanpa semester)
      // - Perencanaan Jurnal Reading dihitung per semester
      // Perencanaan PBL = jumlah daftar modul PBL × 5
      // Perencanaan Jurnal Reading = jumlah daftar jurnal reading × 2
      
      // Isi perencanaan PBL (per blok, berlaku untuk semua semester dengan blok yang sama)
      Object.entries(perencanaanPblMap).forEach(([keyPerencanaanPbl, pblValue]) => {
        // Parse key perencanaan PBL: `${dosenName}_blok${blok}`
        const [dosenName, blokPart] = keyPerencanaanPbl.split('_');
          const blokMatch = blokPart.match(/blok(\d+|null)/);
          const blok = blokMatch && blokMatch[1] !== 'null' ? parseInt(blokMatch[1]) : null;
        
        // Isi perencanaan PBL untuk semua semester dengan blok yang sama
        Object.keys(jadwalByDosenBlokSemester).forEach((keyJadwal) => {
          const jadwalData = jadwalByDosenBlokSemester[keyJadwal];
          // Cek apakah jadwal ini untuk dosen dan blok yang sama
          if (jadwalData.dosen_name === dosenName && jadwalData.blok === blok) {
        // Isi perencanaan PBL (gabungan PBL 1 + PBL 2)
        // Karena PBL 1 dan PBL 2 digabung di perencanaan, kita bagi rata atau bisa juga langsung isi ke pbl1_perencanaan
            // Berdasarkan penjelasan: PBL per 1 daftar = 5, jadi total perencanaan PBL = pblValue
        // Kita bagi ke pbl1_perencanaan dan pbl2_perencanaan dengan proporsi yang sama, atau langsung isi ke pbl1_perencanaan
        // Untuk sementara, kita isi ke pbl1_perencanaan saja karena nanti akan digabung
            jadwalData.pbl1_perencanaan = pblValue;
            jadwalData.pbl2_perencanaan = 0; // PBL 2 perencanaan juga 0 karena sudah digabung
            
          }
        });
      });
      
      // Isi perencanaan Jurnal Reading (per semester)
      // PERBAIKAN: Pastikan semua jadwal diinisialisasi dengan 0 terlebih dahulu
      // Kemudian isi nilai dari map jika ada
      Object.keys(jadwalByDosenBlokSemester).forEach((keyJadwal) => {
        const jadwalData = jadwalByDosenBlokSemester[keyJadwal];
        // Inisialisasi perencanaan jurnal reading dengan 0
        if (jadwalData.jurnalReading_perencanaan === undefined) {
          jadwalData.jurnalReading_perencanaan = 0;
        }
      });
      
      // Isi perencanaan Jurnal Reading dari map (hanya jika ada nilai)
      Object.entries(perencanaanJurnalMap).forEach(([keyPerencanaanJurnal, jurnalValue]) => {
        // Parse key perencanaan Jurnal: `${dosenName}_blok${blok}_semester${semester}`
        const [dosenName, blokPart, semesterPart] = keyPerencanaanJurnal.split('_');
        const blokMatch = blokPart.match(/blok(\d+|null)/);
        const semesterMatch = semesterPart.match(/semester(\d+)/);
        const blok = blokMatch && blokMatch[1] !== 'null' ? parseInt(blokMatch[1]) : null;
        const semester = semesterMatch ? parseInt(semesterMatch[1]) : 1;
        
        // Cari jadwal yang sesuai dengan dosen, blok, dan semester
        const keyJadwal = `${dosenName}_blok${blok || 'null'}_semester${semester}`;
        if (jadwalByDosenBlokSemester[keyJadwal]) {
          // Isi perencanaan Jurnal Reading (hanya jika ada nilai > 0)
          if (jurnalValue > 0) {
            jadwalByDosenBlokSemester[keyJadwal].jurnalReading_perencanaan = jurnalValue;
          } else {
            // Pastikan nilainya 0 jika tidak ada daftar jurnal reading
            jadwalByDosenBlokSemester[keyJadwal].jurnalReading_perencanaan = 0;
          }
        }
      });
      // Debug: Cek apakah ada data yang akan ditampilkan
      if (Object.keys(jadwalByDosenBlokSemester).length === 0) {
        // Don't return - continue to generate empty template
      }
      

      // Aggregate data by dosen (combine all semesters for selected blok/non-blok)
      // Struktur baru: memisahkan perencanaan dan realisasi
      const dosenAggregated: { [key: string]: any } = {};
      
      Object.values(jadwalByDosenBlokSemester).forEach((data: any) => {
        const isBlokMatch = selectedBlok !== null && data.blok === selectedBlok;
        const isNonBlokMatch = selectedBlok === null && data.blok === null;
        
        if (isBlokMatch || isNonBlokMatch) {
          const key = data.dosen_name;
          if (!dosenAggregated[key]) {
            dosenAggregated[key] = {
              dosen_name: data.dosen_name,
              dosen_id: null, // Akan diisi dari dosenData
              // Perencanaan
              pbl1_perencanaan: 0,
              pbl2_perencanaan: 0,
              jurnalReading_perencanaan: 0,
              csrReguler_perencanaan: 0,
              csrResponsi_perencanaan: 0,
              materi_perencanaan: 0,
              seminarPleno_perencanaan: 0,
              ppPbl_perencanaan: 0,
              praktikum_perencanaan: 0,
              kuliahBesar_perencanaan: 0,
              // Realisasi
              pbl1_realisasi: 0,
              pbl2_realisasi: 0,
              praktikum_realisasi: 0,
              kuliahBesar_realisasi: 0,
              jurnalReading_realisasi: 0,
              csrReguler_realisasi: 0,
              csrResponsi_realisasi: 0,
              materi_realisasi: 0,
              seminarPleno_realisasi: 0,
              ppPbl_realisasi: 0,
            };
          }
          // Aggregate perencanaan
          // PERBAIKAN: 
          // - Perencanaan PBL tidak diakumulasi per semester (ambil nilai maksimum)
          //   karena perencanaan dihitung berdasarkan daftar modul PBL di mata kuliah,
          //   yang sama untuk semua semester dengan blok yang sama
          // - Perencanaan Jurnal Reading: hanya diambil dari semester yang memiliki daftar jurnal reading
          //   Jika semester tertentu tidak memiliki daftar jurnal reading, nilainya 0 untuk semester tersebut
          //   Jadi jika semester 1 memiliki daftar jurnal reading dan semester 3 tidak, 
          //   perencanaan Jurnal Reading hanya dari semester 1, bukan dari semester 3
          //   Kita akumulasi hanya nilai yang > 0 (yang memiliki daftar jurnal reading)
          if ((data.pbl1_perencanaan || 0) > dosenAggregated[key].pbl1_perencanaan) {
            dosenAggregated[key].pbl1_perencanaan = data.pbl1_perencanaan || 0;
          }
          if ((data.pbl2_perencanaan || 0) > dosenAggregated[key].pbl2_perencanaan) {
            dosenAggregated[key].pbl2_perencanaan = data.pbl2_perencanaan || 0;
          }
          // Perencanaan Jurnal Reading: hanya akumulasi nilai yang > 0 (yang memiliki daftar jurnal reading)
          // Jika semester tertentu tidak memiliki daftar jurnal reading (nilai = 0), tidak diakumulasi
          // Ini untuk memastikan bahwa perencanaan Jurnal Reading hanya dari semester yang memiliki daftar jurnal reading
          if ((data.jurnalReading_perencanaan || 0) > 0) {
            dosenAggregated[key].jurnalReading_perencanaan += data.jurnalReading_perencanaan || 0;
          }
          dosenAggregated[key].csrReguler_perencanaan += data.csrReguler_perencanaan || 0;
          dosenAggregated[key].csrResponsi_perencanaan += data.csrResponsi_perencanaan || 0;
          dosenAggregated[key].materi_perencanaan += data.materi_perencanaan || 0;
          dosenAggregated[key].seminarPleno_perencanaan += data.seminarPleno_perencanaan || 0;
          dosenAggregated[key].ppPbl_perencanaan += data.ppPbl_perencanaan || 0;
          dosenAggregated[key].praktikum_perencanaan += data.praktikum_perencanaan || 0;
          dosenAggregated[key].kuliahBesar_perencanaan += data.kuliahBesar_perencanaan || 0;
          // Aggregate realisasi
          dosenAggregated[key].pbl1_realisasi += data.pbl1_realisasi || 0;
          dosenAggregated[key].pbl2_realisasi += data.pbl2_realisasi || 0;
          dosenAggregated[key].praktikum_realisasi += data.praktikum_realisasi || 0;
          dosenAggregated[key].kuliahBesar_realisasi += data.kuliahBesar_realisasi || 0;
          dosenAggregated[key].jurnalReading_realisasi += data.jurnalReading_realisasi || 0;
          dosenAggregated[key].csrReguler_realisasi += data.csrReguler_realisasi || 0;
          dosenAggregated[key].csrResponsi_realisasi += data.csrResponsi_realisasi || 0;
          dosenAggregated[key].materi_realisasi += data.materi_realisasi || 0;
          dosenAggregated[key].seminarPleno_realisasi += data.seminarPleno_realisasi || 0;
          dosenAggregated[key].ppPbl_realisasi += data.ppPbl_realisasi || 0;
        }
      });
      
      // Hitung perencanaan CSR berdasarkan keahlian dosen (jumlah keahlian × 5)
      // dan update dosen_id dari dosenData
      Object.keys(dosenAggregated).forEach((dosenName) => {
        const dosen = dosenData.find((d: any) => d.name === dosenName);
        if (dosen) {
          dosenAggregated[dosenName].dosen_id = dosen.id;
          
          // Hitung perencanaan CSR berdasarkan keahlian
          // Perencanaan CSR = jumlah keahlian × 5 (hanya jika dosen memiliki assignment CSR)
          if (dosen.keahlian) {
            const jumlahKeahlian = Array.isArray(dosen.keahlian)
              ? dosen.keahlian.length
              : typeof dosen.keahlian === "string"
              ? dosen.keahlian.split(",").filter((k: string) => k.trim()).length
              : 1;
            
            // Perencanaan CSR = jumlah keahlian × 5
            // Hanya jika dosen memiliki assignment CSR (ada realisasi atau flag perencanaan > 0)
            if (dosenAggregated[dosenName].csrReguler_perencanaan > 0 || 
                dosenAggregated[dosenName].csrReguler_realisasi > 0) {
              dosenAggregated[dosenName].csrReguler_perencanaan = jumlahKeahlian * 5;
            } else {
              dosenAggregated[dosenName].csrReguler_perencanaan = 0;
            }
            
            if (dosenAggregated[dosenName].csrResponsi_perencanaan > 0 || 
                dosenAggregated[dosenName].csrResponsi_realisasi > 0) {
              dosenAggregated[dosenName].csrResponsi_perencanaan = jumlahKeahlian * 5;
            } else {
              dosenAggregated[dosenName].csrResponsi_perencanaan = 0;
            }
          } else {
            // Jika tidak ada keahlian, set perencanaan CSR = 0
            dosenAggregated[dosenName].csrReguler_perencanaan = 0;
            dosenAggregated[dosenName].csrResponsi_perencanaan = 0;
          }
        }
      });

      // Convert to array and sort by dosen name
      const dosenList = Object.values(dosenAggregated).sort((a: any, b: any) => 
        a.dosen_name.localeCompare(b.dosen_name)
      );


      if (selectedBlok !== null) {
        // Create table header for Blok (Row 5)
        const headerRow5 = worksheet.getRow(currentRow);
        headerRow5.getCell(1).value = 'NO'; // A5
        headerRow5.getCell(2).value = 'NAMA DOSEN'; // B5
        
        // Set nilai PERENCANAAN dan REALISASI di row 5 dulu sebelum merge
        // Nilai ini akan tetap muncul setelah merge karena merge dilakukan dari row 5 ke row 6
        const cellPerencanaan = headerRow5.getCell(3);
        const cellRealisasi = headerRow5.getCell(10);
        cellPerencanaan.value = 'PERENCANAAN';
        cellRealisasi.value = 'REALISASI';
        
        // Merge horizontal untuk PERENCANAAN dan REALISASI di row 5
        // PERENCANAAN: C5:I5 (7 kolom: PBL, JURDING, KULIAH, PRAKTIKUM, PP PBL, SEMINAR PLENO, TOTAL JAM)
        // REALISASI: J5:Q5 (8 kolom: PBL 1, PBL 2, JURDING, KULIAH, PRAKTIKUM, PP PBL, SEMINAR PLENO, Total Jam)
        safeMergeCells(`C${currentRow}:I${currentRow}`); // C5:I5 - PERENCANAAN (7 kolom)
        safeMergeCells(`J${currentRow}:Q${currentRow}`); // J5:Q5 - REALISASI (8 kolom)
        
        // Style header row 5 - terbagi 3 warna: NO/NAMA (abu-abu sedang), PERENCANAAN (biru muda), REALISASI (oranye pastel)
        for (let i = 1; i <= 17; i++) {
          const cell = headerRow5.getCell(i);
          
          // Tentukan warna background dan teks berdasarkan kolom
          let bgColor = 'FF9F9E9D'; // Default: abu-abu sedang
          let textColor = 'FF000000'; // Default: teks hitam
          
          if (i === 1 || i === 2) {
            // Kolom A-B (NO, NAMA DOSEN) - abu-abu sedang
            bgColor = 'FF9F9E9D'; // Abu-abu sedang #9f9e9d
            textColor = 'FF000000'; // Teks hitam
          } else if (i >= 3 && i <= 9) {
            // Kolom C-I (PERENCANAAN) - biru muda (7 kolom: PBL, JURDING, KULIAH, PRAKTIKUM, PP PBL, SEMINAR PLENO, TOTAL JAM)
            bgColor = 'FFBAD2E9'; // Biru muda #bad2e9
            textColor = 'FF000000'; // Teks hitam
          } else if (i >= 10 && i <= 17) {
            // Kolom J-Q (REALISASI) - oranye pastel / peach muda (8 kolom: PBL 1, PBL 2, JURDING, KULIAH, PRAKTIKUM, PP PBL, SEMINAR PLENO, Total Jam)
            bgColor = 'FFF1C6A9'; // Oranye pastel / peach muda #f1c6a9
            textColor = 'FF000000'; // Teks hitam
          }
          
          cell.font = { bold: true, color: { argb: textColor } };
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
            fgColor: { argb: bgColor }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        }
        
        // Pastikan styling untuk PERENCANAAN dan REALISASI tetap terlihat setelah merge
        // (styling ini penting untuk memastikan teks "PERENCANAAN" dan "REALISASI" terlihat dengan benar)
        cellPerencanaan.alignment = { horizontal: 'center', vertical: 'middle' };
        cellRealisasi.alignment = { horizontal: 'center', vertical: 'middle' };
        cellPerencanaan.font = { bold: true, color: { argb: 'FF000000' } };
        cellRealisasi.font = { bold: true, color: { argb: 'FF000000' } };
        cellPerencanaan.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFBAD2E9' } // Biru muda #bad2e9
        };
        cellRealisasi.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF1C6A9' } // Oranye pastel / peach muda #f1c6a9
        };
        
          currentRow += 1;

        // Merge A5 with A6 and B5 with B6 first (before setting row 6 values)
        // Kolom 1: A dan B (NO dan NAMA DOSEN)
        safeMergeCells(`A${currentRow - 1}:A${currentRow}`);
        safeMergeCells(`B${currentRow - 1}:B${currentRow}`);
        
        // Set border and fill color for merged cells A5:A6 and B5:B6
        const cellA5 = worksheet.getCell(`A${currentRow - 1}`);
        const cellB5 = worksheet.getCell(`B${currentRow - 1}`);
        // Border hitam
        cellA5.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        cellB5.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        // Fill color abu-abu sedang untuk NO dan NAMA DOSEN (bagian 1 dari 3 warna)
        cellA5.fill = {
            type: 'pattern',
            pattern: 'solid',
          fgColor: { argb: 'FF9F9E9D' } // Abu-abu sedang #9f9e9d
        };
        cellB5.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF9F9E9D' } // Abu-abu sedang #9f9e9d
        };
        // Font hitam dan bold
        cellA5.font = { bold: true, color: { argb: 'FF000000' } };
        cellB5.font = { bold: true, color: { argb: 'FF000000' } };
        // Alignment center
        cellA5.alignment = { horizontal: 'center', vertical: 'middle' };
        cellB5.alignment = { horizontal: 'center', vertical: 'middle' };
        
        // Tidak perlu merge vertikal untuk kolom C-J dan K-R karena:
        // 1. Row 5 sudah di-merge horizontal untuk "PERENCANAAN" (C5:J5) dan "REALISASI" (K5:R5)
        // 2. Row 6 akan berisi sub-header untuk setiap kolom (C6, D6, ..., J6, K6, L6, ..., R6)
        // 3. Merge vertikal akan mengganggu merge horizontal dan menghilangkan sub-header di row 6

        // Create table header for Blok (Row 6) - Sub headers
        const headerRow6 = worksheet.getRow(currentRow);
        // Don't set A6 and B6 values as they're merged with A5 and B5
        
        // Set nilai untuk row 6 (sub headers) - nilai akan muncul di cell yang sudah di-merge
        // PERENCANAAN: PBL 1 dan PBL 2 digabung jadi satu kolom "PBL"
        headerRow6.getCell(3).value = 'PBL\n(PER 50\')'; // C6 - PERENCANAAN (gabungan PBL 1 + PBL 2)
        headerRow6.getCell(4).value = 'JURDING\n(PER 50\')'; // D6 - PERENCANAAN
        headerRow6.getCell(5).value = 'KULIAH\n(PER 50\')'; // E6 - PERENCANAAN
        headerRow6.getCell(6).value = 'PRAKTIKUM\n(PER 50\')'; // F6 - PERENCANAAN
        headerRow6.getCell(7).value = 'PP PBL\n(PER 50\')'; // G6 - PERENCANAAN
        headerRow6.getCell(8).value = 'SEMINAR\nPLENO\n(PER 50\')'; // H6 - PERENCANAAN
        headerRow6.getCell(9).value = 'TOTAL JAM'; // I6 - PERENCANAAN
        // REALISASI: Tetap terpisah PBL 1 dan PBL 2
        headerRow6.getCell(10).value = 'PBL 1\n(PER 50\')'; // J6 - REALISASI
        headerRow6.getCell(11).value = 'PBL 2\n(PER 50\')'; // K6 - REALISASI
        headerRow6.getCell(12).value = 'JURDING\n(PER 50\')'; // L6 - REALISASI
        headerRow6.getCell(13).value = 'KULIAH\n(PER 50\')'; // M6 - REALISASI
        headerRow6.getCell(14).value = 'PRAKTIKUM\n(PER 50\')'; // N6 - REALISASI
        headerRow6.getCell(15).value = 'PP PBL\n(PER 50\')'; // O6 - REALISASI
        headerRow6.getCell(16).value = 'SEMINAR\nPLENO\n(PER 50\')'; // P6 - REALISASI
        headerRow6.getCell(17).value = 'Total Jam'; // Q6 - REALISASI
        
        // Style header row 6 - terbagi 3 warna: NO/NAMA (abu-abu sedang), PERENCANAAN (biru muda), REALISASI (oranye pastel)
        for (let i = 1; i <= 17; i++) {
          const cell = headerRow6.getCell(i);
          if (i > 2) { // Skip A and B as they're merged with row 5
            // Tentukan warna background dan teks berdasarkan kolom (sama dengan row 5)
            let bgColor = 'FF9F9E9D'; // Default: abu-abu sedang
            let textColor = 'FF000000'; // Default: teks hitam
            
            if (i >= 3 && i <= 9) {
              // Kolom C-I (PERENCANAAN) - biru muda (7 kolom: PBL, JURDING, KULIAH, PRAKTIKUM, PP PBL, SEMINAR PLENO, TOTAL JAM)
              bgColor = 'FFBAD2E9'; // Biru muda #bad2e9
              textColor = 'FF000000'; // Teks hitam
            } else if (i >= 10 && i <= 17) {
              // Kolom J-Q (REALISASI) - oranye pastel / peach muda (8 kolom: PBL 1, PBL 2, JURDING, KULIAH, PRAKTIKUM, PP PBL, SEMINAR PLENO, Total Jam)
              bgColor = 'FFF1C6A9'; // Oranye pastel / peach muda #f1c6a9
              textColor = 'FF000000'; // Teks hitam
            }
            
            cell.font = { bold: true, color: { argb: textColor } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
              fgColor: { argb: bgColor }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              left: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'thin', color: { argb: 'FF000000' } },
              right: { style: 'thin', color: { argb: 'FF000000' } }
            };
          }
          // A and B are already styled from row 5 merged cells
        }
            currentRow += 1;
            
        // Add data rows
        if (dosenList.length > 0) {
          dosenList.forEach((dosen: any, index: number) => {
              const dataRow = worksheet.getRow(currentRow);
            
            // Calculate totals perencanaan
            // Semua data dari DetailBlok masuk ke perencanaan
            const totalPerencanaan = (dosen.pbl1_perencanaan || 0) + 
                                     (dosen.pbl2_perencanaan || 0) + 
                                     (dosen.jurnalReading_perencanaan || 0) +
                                     (dosen.ppPbl_perencanaan || 0) +
                                     (dosen.seminarPleno_perencanaan || 0) +
                                     (dosen.kuliahBesar_perencanaan || 0) +
                                     (dosen.praktikum_perencanaan || 0);
            
            // Calculate totals realisasi
            const totalRealisasi = (dosen.pbl1_realisasi || 0) + 
                                   (dosen.pbl2_realisasi || 0) + 
                                   (dosen.jurnalReading_realisasi || 0) + 
                                   (dosen.kuliahBesar_realisasi || 0) + 
                                   (dosen.praktikum_realisasi || 0) +
                                   (dosen.ppPbl_realisasi || 0) +
                                   (dosen.seminarPleno_realisasi || 0);

            dataRow.getCell(1).value = index + 1; // NO
            dataRow.getCell(2).value = dosen.dosen_name; // NAMA DOSEN
            // PERENCANAAN: PBL 1 dan PBL 2 digabung jadi satu kolom
            dataRow.getCell(3).value = (dosen.pbl1_perencanaan || 0) + (dosen.pbl2_perencanaan || 0); // PBL (PER 50') - PERENCANAAN (gabungan PBL 1 + PBL 2)
            dataRow.getCell(4).value = dosen.jurnalReading_perencanaan || 0; // JURDING (PER 50') - PERENCANAAN
            dataRow.getCell(5).value = dosen.kuliahBesar_perencanaan || 0; // KULIAH (PER 50') - PERENCANAAN
            dataRow.getCell(6).value = dosen.praktikum_perencanaan || 0; // PRAKTIKUM (PER 50') - PERENCANAAN
            dataRow.getCell(7).value = dosen.ppPbl_perencanaan || 0; // PP PBL (PER 50') - PERENCANAAN
            dataRow.getCell(8).value = dosen.seminarPleno_perencanaan || 0; // SEMINAR PLENO (PER 50') - PERENCANAAN
            dataRow.getCell(9).value = totalPerencanaan; // TOTAL JAM - PERENCANAAN
            // REALISASI: Tetap terpisah PBL 1 dan PBL 2
            dataRow.getCell(10).value = dosen.pbl1_realisasi || 0; // PBL 1 (PER 50') - REALISASI
            dataRow.getCell(11).value = dosen.pbl2_realisasi || 0; // PBL 2 (PER 50') - REALISASI
            dataRow.getCell(12).value = dosen.jurnalReading_realisasi || 0; // JURDING (PER 50') - REALISASI
            dataRow.getCell(13).value = dosen.kuliahBesar_realisasi || 0; // KULIAH (PER 50') - REALISASI
            dataRow.getCell(14).value = dosen.praktikum_realisasi || 0; // PRAKTIKUM (PER 50') - REALISASI
            dataRow.getCell(15).value = dosen.ppPbl_realisasi || 0; // PP PBL (PER 50') - REALISASI
            dataRow.getCell(16).value = dosen.seminarPleno_realisasi || 0; // SEMINAR PLENO (PER 50') - REALISASI
            dataRow.getCell(17).value = totalRealisasi; // Total Jam - REALISASI

            // Style data row - sesuai template: background putih, teks hitam, border hitam
            for (let i = 1; i <= 17; i++) {
                const cell = dataRow.getCell(i);
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFFFFF' } // Background putih
                };
                cell.font = { color: { argb: 'FF000000' } }; // Teks hitam
              cell.alignment = { 
                horizontal: i === 2 ? 'left' : 'center', 
                vertical: 'middle' 
              };
              // Border hitam tipis sesuai template
              cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
              };
            }
              currentRow += 1;
            });
          } else {
          // Add empty row message - sesuai template: background putih, teks hitam
          safeMergeCells(`A${currentRow}:Q${currentRow}`);
          const emptyRow = worksheet.getRow(currentRow);
          const emptyCell = emptyRow.getCell(1);
          emptyCell.value = 'Tidak ada data';
          emptyCell.font = { italic: true, color: { argb: 'FF000000' } }; // Teks hitam
          emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
          emptyCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' } // Background putih
          };
          // Border hitam untuk empty row
          emptyCell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
          currentRow += 1;
        }
      } else {
        // Create table header for Non Blok (Row 5)
        const headerRow5 = worksheet.getRow(currentRow);
        headerRow5.getCell(1).value = 'NO'; // A5
        headerRow5.getCell(2).value = 'NAMA DOSEN'; // B5
        safeMergeCells(`C${currentRow}:F${currentRow}`); // C5:F5 - PERENCANAAN
        headerRow5.getCell(3).value = 'PERENCANAAN';
        safeMergeCells(`G${currentRow}:J${currentRow}`); // G5:J5 - REALISASI
        headerRow5.getCell(7).value = 'REALISASI';
        
        // Style header row 5 - terbagi 3 warna: NO/NAMA (abu-abu sedang), PERENCANAAN (biru muda), REALISASI (oranye pastel)
        for (let i = 1; i <= 10; i++) {
          const cell = headerRow5.getCell(i);
          
          // Tentukan warna background dan teks berdasarkan kolom
          let bgColor = 'FF9F9E9D'; // Default: abu-abu sedang
          let textColor = 'FF000000'; // Default: teks hitam
          
          if (i === 1 || i === 2) {
            // Kolom A-B (NO, NAMA DOSEN) - abu-abu sedang
            bgColor = 'FF9F9E9D'; // Abu-abu sedang #9f9e9d
            textColor = 'FF000000'; // Teks hitam
          } else if (i >= 3 && i <= 6) {
            // Kolom C-F (PERENCANAAN) - biru muda
            bgColor = 'FFBAD2E9'; // Biru muda #bad2e9
            textColor = 'FF000000'; // Teks hitam
          } else if (i >= 7 && i <= 10) {
            // Kolom G-J (REALISASI) - oranye pastel / peach muda
            bgColor = 'FFF1C6A9'; // Oranye pastel / peach muda #f1c6a9
            textColor = 'FF000000'; // Teks hitam
          }
          
          cell.font = { bold: true, color: { argb: textColor } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: bgColor }
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
        }
        currentRow += 1;

        // Merge A5 with A6 and B5 with B6 first (before setting row 6 values)
        safeMergeCells(`A${currentRow - 1}:A${currentRow}`);
        safeMergeCells(`B${currentRow - 1}:B${currentRow}`);
        
        // Set border and fill color for merged cells A5:A6 and B5:B6
        const cellA5NonBlok = worksheet.getCell(`A${currentRow - 1}`);
        const cellB5NonBlok = worksheet.getCell(`B${currentRow - 1}`);
        // Border hitam
        cellA5NonBlok.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        cellB5NonBlok.border = {
          top: { style: 'thin', color: { argb: 'FF000000' } },
          left: { style: 'thin', color: { argb: 'FF000000' } },
          bottom: { style: 'thin', color: { argb: 'FF000000' } },
          right: { style: 'thin', color: { argb: 'FF000000' } }
        };
        // Fill color abu-abu sedang untuk NO dan NAMA DOSEN (bagian 1 dari 3 warna)
        cellA5NonBlok.fill = {
            type: 'pattern',
            pattern: 'solid',
          fgColor: { argb: 'FF9F9E9D' } // Abu-abu sedang #9f9e9d
        };
        cellB5NonBlok.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF9F9E9D' } // Abu-abu sedang #9f9e9d
        };
        // Font hitam dan bold
        cellA5NonBlok.font = { bold: true, color: { argb: 'FF000000' } };
        cellB5NonBlok.font = { bold: true, color: { argb: 'FF000000' } };
        // Alignment center
        cellA5NonBlok.alignment = { horizontal: 'center', vertical: 'middle' };
        cellB5NonBlok.alignment = { horizontal: 'center', vertical: 'middle' };

        // Create table header for Non Blok (Row 6) - Sub headers
        const headerRow6 = worksheet.getRow(currentRow);
        // Don't set A6 and B6 values as they're merged with A5 and B5
        headerRow6.getCell(3).value = 'CSR REGULER\n(PER 50\')'; // C6
        headerRow6.getCell(4).value = 'CSR RESPONSI\n(PER 50\')'; // D6
        headerRow6.getCell(5).value = 'MATERI\n(PER 50\')'; // E6
        headerRow6.getCell(6).value = 'TOTAL JAM'; // F6
        headerRow6.getCell(7).value = 'CSR REGULER\n(PER 50\')'; // G6
        headerRow6.getCell(8).value = 'CSR RESPONSI\n(PER 50\')'; // H6
        headerRow6.getCell(9).value = 'MATERI\n(PER 50\')'; // I6
        headerRow6.getCell(10).value = 'Total Jam'; // J6
        
        // Style header row 6 - terbagi 3 warna: NO/NAMA (abu-abu sedang), PERENCANAAN (biru muda), REALISASI (oranye pastel)
        for (let i = 1; i <= 10; i++) {
          const cell = headerRow6.getCell(i);
          if (i > 2) { // Skip A and B as they're merged with row 5
            // Tentukan warna background dan teks berdasarkan kolom (sama dengan row 5)
            let bgColor = 'FF9F9E9D'; // Default: abu-abu sedang
            let textColor = 'FF000000'; // Default: teks hitam
            
            if (i >= 3 && i <= 6) {
              // Kolom C-F (PERENCANAAN) - biru muda
              bgColor = 'FFBAD2E9'; // Biru muda #bad2e9
              textColor = 'FF000000'; // Teks hitam
            } else if (i >= 7 && i <= 10) {
              // Kolom G-J (REALISASI) - oranye pastel / peach muda
              bgColor = 'FFF1C6A9'; // Oranye pastel / peach muda #f1c6a9
              textColor = 'FF000000'; // Teks hitam
            }
            
            cell.font = { bold: true, color: { argb: textColor } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
              fgColor: { argb: bgColor }
            };
            cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
            cell.border = {
              top: { style: 'thin', color: { argb: 'FF000000' } },
              left: { style: 'thin', color: { argb: 'FF000000' } },
              bottom: { style: 'thin', color: { argb: 'FF000000' } },
              right: { style: 'thin', color: { argb: 'FF000000' } }
            };
          }
          // A and B are already styled from row 5 merged cells
        }
        currentRow += 1;

        // Add data rows for Non Blok
        if (dosenList.length > 0) {
          dosenList.forEach((dosen: any, index: number) => {
          const dataRow = worksheet.getRow(currentRow);
            
            // Calculate totals perencanaan
            // Semua data dari DetailBlok masuk ke perencanaan
            const totalPerencanaan = (dosen.csrReguler_perencanaan || 0) + 
                                     (dosen.csrResponsi_perencanaan || 0) +
                                     (dosen.materi_perencanaan || 0);
            
            // Calculate totals realisasi
            const totalRealisasi = (dosen.csrReguler_realisasi || 0) + 
                                   (dosen.csrResponsi_realisasi || 0) + 
                                   (dosen.materi_realisasi || 0);

            dataRow.getCell(1).value = index + 1; // NO
            dataRow.getCell(2).value = dosen.dosen_name; // NAMA DOSEN
            dataRow.getCell(3).value = dosen.csrReguler_perencanaan || 0; // CSR REGULER (PER 50') - PERENCANAAN
            dataRow.getCell(4).value = dosen.csrResponsi_perencanaan || 0; // CSR RESPONSI (PER 50') - PERENCANAAN
            dataRow.getCell(5).value = dosen.materi_perencanaan || 0; // MATERI (PER 50') - PERENCANAAN
            dataRow.getCell(6).value = totalPerencanaan; // TOTAL JAM - PERENCANAAN
            dataRow.getCell(7).value = dosen.csrReguler_realisasi || 0; // CSR REGULER (PER 50') - REALISASI
            dataRow.getCell(8).value = dosen.csrResponsi_realisasi || 0; // CSR RESPONSI (PER 50') - REALISASI
            dataRow.getCell(9).value = dosen.materi_realisasi || 0; // MATERI (PER 50') - REALISASI
            dataRow.getCell(10).value = totalRealisasi; // Total Jam - REALISASI

            // Style data row - sesuai template: background putih, teks hitam, border hitam
            for (let i = 1; i <= 10; i++) {
              const cell = dataRow.getCell(i);
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFFFF' } // Background putih
              };
              cell.font = { color: { argb: 'FF000000' } }; // Teks hitam
              cell.alignment = { 
                horizontal: i === 2 ? 'left' : 'center', 
                vertical: 'middle' 
              };
              // Border hitam tipis sesuai template
              cell.border = {
                top: { style: 'thin', color: { argb: 'FF000000' } },
                left: { style: 'thin', color: { argb: 'FF000000' } },
                bottom: { style: 'thin', color: { argb: 'FF000000' } },
                right: { style: 'thin', color: { argb: 'FF000000' } }
              };
            }
            currentRow += 1;
          });
        } else {
          // Add empty row message - sesuai template: background putih, teks hitam
          safeMergeCells(`A${currentRow}:J${currentRow}`);
          const emptyRow = worksheet.getRow(currentRow);
          const emptyCell = emptyRow.getCell(1);
          emptyCell.value = 'Tidak ada data';
          emptyCell.font = { italic: true, color: { argb: 'FF000000' } }; // Teks hitam
          emptyCell.alignment = { horizontal: 'center', vertical: 'middle' };
          emptyCell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFFFF' } // Background putih
            };
          // Border hitam untuk empty row
          emptyCell.border = {
            top: { style: 'thin', color: { argb: 'FF000000' } },
            left: { style: 'thin', color: { argb: 'FF000000' } },
            bottom: { style: 'thin', color: { argb: 'FF000000' } },
            right: { style: 'thin', color: { argb: 'FF000000' } }
          };
          currentRow += 1;
        }
      }

      // Borders sudah di-set di setiap cell saat membuat header dan data rows

      // Generate Excel file
      
      // Debug: Cek apakah worksheet memiliki data
      if (worksheet.rowCount <= 6) {
        // Don't return - continue to generate Excel file
      }
      
      // Debug: Tampilkan beberapa baris Excel untuk memastikan data ada
      const maxPreviewCol = selectedBlok === null ? 10 : 17;
      for (let i = 1; i <= Math.min(10, worksheet.rowCount); i++) {
        const row = worksheet.getRow(i);
        const rowValues = [];
        for (let j = 1; j <= maxPreviewCol; j++) {
          rowValues.push(row.getCell(j).value || '');
        }
      }
      const buffer = await workbook.xlsx.writeBuffer();
      
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const fileName = selectedBlok === null 
        ? `DAFTAR-REKAPITULASI-SKS-NON-BLOK-${new Date().toISOString().split('T')[0]}.xlsx`
        : `DAFTAR-REKAPITULASI-SKS-BLOK${selectedBlok}-${new Date().toISOString().split('T')[0]}.xlsx`;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      setShowExcelDropdown(false);

    } catch (error) {
      // Bisa ditambahkan toast notification di sini
    }
  };

  const getCurrentReportData = () => {
    return activeTab === "csr" ? dosenCsrReport : dosenPblReport;
  };

  const getCurrentAllReportData = () => {
    return activeTab === "csr" ? allDosenCsrReport : allDosenPblReport;
  };

  const getTotalField = () => {
    return activeTab === "csr" ? "total_csr" : "total_pbl";
  };

  const getTitle = () => {
    return activeTab === "csr" ? "CSR" : "PBL";
  };

  const getDescription = () => {
    return activeTab === "csr"
      ? "Laporan dosen mengajar CSR per semester"
      : "Laporan dosen mengajar PBL per semester";
  };

  const toggleExpand = (dosenId: number) => {
    setExpandedRows((prev) => ({ ...prev, [dosenId]: !prev[dosenId] }));
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Reporting Dosen
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            {getDescription()}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          {activeTab === "pbl" && (
            <div className="relative">
              <button
                onClick={() => setShowExcelDropdown(!showExcelDropdown)}
                className="w-fit flex items-center gap-2 px-5 text-sm py-2 bg-indigo-500 text-white rounded-lg shadow hover:bg-indigo-600 transition-colors font-semibold"
              >
                <DownloadIcon className="w-5 h-5" />
                Export Excel
                <FontAwesomeIcon 
                  icon={showExcelDropdown ? faChevronUp : faChevronDown} 
                  className="w-3 h-3 ml-1"
                />
              </button>
              {showExcelDropdown && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowExcelDropdown(false)}
                  ></div>
                  <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-20">
                    <div className="py-1">
                      {[1, 2, 3, 4].map((blok) => (
                        <button
                          key={blok}
                          onClick={() => {
                            handleExportExcelByBlok(blok);
                            setShowExcelDropdown(false);
                          }}
                          className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          Blok {blok}
                        </button>
                      ))}
                      <button
                        onClick={() => {
                          handleExportExcelByBlok(null);
                          setShowExcelDropdown(false);
                        }}
                        className="w-full text-left px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      >
                        Non Blok
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex justify-center mb-6">
        <div className="flex space-x-2 bg-white dark:bg-gray-800 rounded-full shadow-lg p-1 w-fit mx-auto border border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab("csr")}
            className={`flex-1 px-6 py-2 text-base font-semibold rounded-full transition-colors ${
              activeTab === "csr"
                ? "bg-brand-500 text-white shadow"
                : "text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400"
            }`}
            style={{ minWidth: 100 }}
          >
            CSR
          </button>
          <button
            onClick={() => setActiveTab("pbl")}
            className={`flex-1 px-6 py-2 text-base font-semibold rounded-full transition-colors ${
              activeTab === "pbl"
                ? "bg-brand-500 text-white shadow"
                : "text-gray-600 dark:text-gray-400 hover:text-brand-600 dark:hover:text-brand-400"
            }`}
            style={{ minWidth: 100 }}
          >
            PBL
          </button>
        </div>
      </div>

      {/* Filter Section */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] px-6 py-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
          {/* Search Bar */}
          <div className="w-full md:w-72 relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <DocsIcon className="w-5 h-5 text-gray-400" />
            </span>
            <input
              type="text"
              placeholder="Cari dosen, NID, atau keahlian..."
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-12 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="8"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="21"
                  y1="21"
                  x2="16.65"
                  y2="16.65"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>
          {/* Filter Group */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto justify-end">
            <select
              value={filters.semester}
              onChange={(e) => handleFilterChange("semester", e.target.value)}
              className="w-full md:w-44 h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Semua Semester</option>
              {Array.from(
                new Set(
                  getCurrentAllReportData().flatMap((d) =>
                    d.per_semester.map((sem) => sem.semester)
                  )
                )
              )
                .sort((a, b) => a - b)
                .map((sem) => (
                  <option key={sem} value={sem}>
                    Semester {sem}
                  </option>
                ))}
            </select>
            <input
              type="date"
              value={filters.start_date}
              onChange={(e) => handleFilterChange("start_date", e.target.value)}
              className="h-11 w-full md:w-32 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Dari tanggal"
            />
            <span className="self-center text-gray-400 text-sm">sampai</span>
            <input
              type="date"
              value={filters.end_date}
              onChange={(e) => handleFilterChange("end_date", e.target.value)}
              className="h-11 w-full md:w-32 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Sampai tanggal"
            />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
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
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Nama Dosen
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Peran
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Keahlian
                </th>
                {activeTab === "pbl" && (
                  <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                    Total Modul PBL
                  </th>
                )}
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  {activeTab === "csr" ? "Total CSR" : "Total PBL"}
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Total Waktu
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Per Semester
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Tanggal Mulai
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Tanggal Akhir
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: SKELETON_ROWS }).map((_, idx) => (
                  <tr key={idx}>
                    {Array.from({ length: 9 }).map((_, colIdx) => (
                      <td key={colIdx} className="px-6 py-4">
                        <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse opacity-60 mb-2"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : getCurrentReportData().length === 0 ? (
                <tr>
                  <td
                    colSpan={10}
                    className="px-6 py-8 text-center text-gray-400 dark:text-gray-500"
                  >
                    Tidak ada data dosen mengajar {getTitle()}.
                  </td>
                </tr>
              ) : (
                getCurrentReportData().map((dosen, idx) => {
                  // Gunakan type narrowing
                  let totalWaktuMenit = 0;
                  let totalModulPbl = 0;
                  let totalPbl = 0;
                  let totalSesi = 0;
                  if (activeTab === "pbl") {
                    const d = dosen as DosenPBLReport;
                    totalWaktuMenit = d.total_waktu_menit;
                    // total modul PBL = jumlah seluruh modul_pbl di semua semester
                    totalModulPbl = d.per_semester.reduce(
                      (acc, sem) =>
                        acc + (sem.modul_pbl ? sem.modul_pbl.length : 0),
                      0
                    );
                    // total PBL = jumlah unique mata_kuliah_kode di seluruh modul_pbl
                    const mkSet = new Set<string>();
                    d.per_semester.forEach((sem) => {
                      sem.modul_pbl.forEach((modul) => {
                        mkSet.add(modul.mata_kuliah_kode);
                      });
                    });
                    totalPbl = mkSet.size;
                    totalSesi = d.total_sesi;
                  } else {
                    // CSR pakai struktur baru
                    const d = dosen as any;
                    totalWaktuMenit =
                      d.total_waktu_menit || d.total_csr * 5 * 50;
                    totalModulPbl = d.total_csr; // CSR tidak relevan, tetap isi agar tidak error
                    totalPbl = d.total_csr;
                    totalSesi = d.total_sesi || d.total_csr * 5;
                  }
                  const totalJam = Math.floor(totalWaktuMenit / 60);
                  const totalMenit = totalWaktuMenit % 60;
                  return (
                    <React.Fragment key={dosen.dosen_id}>
                      <tr
                        className={
                          "group border-b-4 border-gray-200 dark:border-gray-800 " +
                          (idx % 2 === 1
                            ? "bg-gray-50 dark:bg-white/[0.02]"
                            : "") +
                          " hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors"
                        }
                      >
                        {/* Nama dosen besar dan bold */}
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-base font-semibold text-gray-900 dark:text-white mb-1">
                            {dosen.dosen_name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            NID: {dosen.nid}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {/* UI multi-peran profesional ala PBLGenerate dengan badge toggle (chevron) dan icon buku */}
                          {(() => {
                            const peranArr = (dosen as any).dosen_peran;
                            
                            // Debug: log untuk melihat struktur data








                            
                            if (
                              Array.isArray(peranArr) &&
                              peranArr.length > 0
                            ) {
                              // Debug: log isi dari dosen_peran

                              peranArr.forEach((peran: any, idx: number) => {





                              });
                              
                              const tipeList = [
                                "koordinator",
                                "tim_blok",
                                "dosen_mengajar",
                                "mengajar", // Tambahkan "mengajar" sebagai alternatif
                              ];
                              const tipeLabel: Record<string, string> = {
                                koordinator: "Koordinator",
                                tim_blok: "Tim Blok",
                                dosen_mengajar: "Dosen Mengajar",
                                mengajar: "Dosen Mengajar", // Map "mengajar" ke "Dosen Mengajar"
                              };
                                                             const tipeBadge: Record<string, string> = {
                                 koordinator: "bg-blue-100 text-blue-700",
                                 tim_blok: "bg-green-100 text-green-700",
                                dosen_mengajar: "bg-yellow-100 text-yellow-700",
                                mengajar: "bg-yellow-100 text-yellow-700", // Badge kuning untuk "mengajar"
                               };
                              return (
                                <div className="flex flex-wrap gap-2">
                                  {tipeList.map((tipe) => {
                                    const peranList = peranArr.filter(
                                      (p: any) => p.tipe_peran === tipe
                                    );
                                    if (peranList.length === 0) return null;
                                    
                                    // Tampilkan semua peran, tidak perlu filter data yang relevan
                                    // karena dosen mengajar mungkin tidak punya mata_kuliah_nama tapi tetap valid
                                    
                                    const badgeKey = `${dosen.dosen_id}-${tipe}`;
                                    const isExpanded = expandedPeran[badgeKey];
                                    
                                    return (
                                      <div
                                        key={tipe}
                                        className="flex flex-col gap-1"
                                      >
                                        <button
                                          onClick={() => toggleExpandedPeran(badgeKey)}
                                          className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold ${tipeBadge[tipe]} hover:opacity-80 transition-opacity cursor-pointer`}
                                        >
                                          {tipeLabel[tipe]}{" "}
                                          <span className="ml-1">
                                            ({peranList.length})
                                          </span>
                                          <FontAwesomeIcon
                                            icon={isExpanded ? faChevronUp : faChevronDown}
                                            className="w-3 h-3 ml-1"
                                          />
                                        </button>
                                        
                                                                                {/* Expandable detail peran */}
                                        {isExpanded && (
                                          <div className="ml-4 mt-2 space-y-2">
                                            {peranList.map((peran: any, idx: number) => (
                                              <div key={idx} className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex items-start gap-3">
                                                  {/* Icon berdasarkan tipe peran */}
                                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                                                    tipe === "koordinator" ? "bg-blue-100 dark:bg-blue-900/30" :
                                                    tipe === "tim_blok" ? "bg-green-100 dark:bg-green-900/30" :
                                                    "bg-yellow-100 dark:bg-yellow-900/30"
                                                  }`}>
                                                    <FontAwesomeIcon 
                                                      icon={faBookOpen} 
                                                      className={`w-4 h-4 ${
                                                        tipe === "koordinator" ? "text-blue-600 dark:text-blue-400" :
                                                        tipe === "tim_blok" ? "text-green-600 dark:text-green-400" :
                                                        "text-yellow-600 dark:text-yellow-400"
                                                      }`}
                                                    />
                                                  </div>
                                                  
                                                  {/* Content */}
                                                  <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
                                                      {peran.mata_kuliah_nama || peran.nama_mk || (tipe === 'dosen_mengajar' ? 'Dosen Mengajar' : 'Mata Kuliah tidak spesifik')}
                                                    </div>
                                                    <div className="space-y-1.5">
                                                      {peran.semester && (
                                                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                          <span className="w-16 text-gray-500 dark:text-gray-500">Semester:</span>
                                                          <span className="font-medium text-gray-700 dark:text-gray-300">{peran.semester}</span>
                                                        </div>
                                                      )}
                                                      {peran.blok && (
                                                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                          <span className="w-16 text-gray-500 dark:text-gray-500">Blok:</span>
                                                          <span className="font-medium text-gray-700 dark:text-gray-300">{peran.blok}</span>
                                                        </div>
                                                      )}
                                                      {peran.peran_kurikulum && (
                                                        <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                          <span className="w-16 text-gray-500 dark:text-gray-500 flex-shrink-0">Kurikulum:</span>
                                                          <span className="font-medium leading-relaxed text-gray-700 dark:text-gray-300">{peran.peran_kurikulum}</span>
                                                        </div>
                                                      )}
                                                      {/* Tambahan info untuk dosen mengajar */}
                                                      {tipe === 'dosen_mengajar' && !peran.mata_kuliah_nama && !peran.peran_kurikulum && (
                                                        <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                          <span className="w-16 text-gray-500 dark:text-gray-500">Status:</span>
                                                          <span className="font-medium text-gray-700 dark:text-gray-300">Aktif mengajar</span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            ))}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                  
                                  {/* Tambahkan badge "Dosen Mengajar" jika ada PBL activity tapi tidak ada peran dosen mengajar */}
                                  {(() => {
                                    const hasDosenMengajar = peranArr.some((p: any) => 
                                      p.tipe_peran === 'dosen_mengajar' || p.tipe_peran === 'mengajar'
                                    );
                                    
                                    // Cek apakah ada peran koordinator atau tim_blok
                                    const hasKoordinator = peranArr.some((p: any) => 
                                      p.tipe_peran === 'koordinator'
                                    );
                                    const hasTimBlok = peranArr.some((p: any) => 
                                      p.tipe_peran === 'tim_blok'
                                    );
                                    
                                    // Jika ada peran koordinator atau tim_blok, jangan tampilkan dosen mengajar
                                    const shouldAddDosenMengajar = !hasDosenMengajar && 
                                      !hasKoordinator && 
                                      !hasTimBlok &&
                                      activeTab === "pbl" && 
                                      ((dosen as any).total_pbl > 0 || (dosen as any).total_sesi > 0);
                                    


                                    
                                    if (shouldAddDosenMengajar) {
                                      const badgeKey = `${dosen.dosen_id}-dosen_mengajar_fallback`;
                                      const isExpanded = expandedPeran[badgeKey];
                                      
                                      return (
                                        <div className="flex flex-col gap-1">
                                          <button
                                            onClick={() => toggleExpandedPeran(badgeKey)}
                                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700 hover:opacity-80 transition-opacity cursor-pointer"
                                          >
                                            Dosen Mengajar
                                            <span className="ml-1">(1)</span>
                                            <FontAwesomeIcon
                                              icon={isExpanded ? faChevronUp : faChevronDown}
                                              className="w-3 h-3 ml-1"
                                            />
                                          </button>
                                          
                                          {/* Expandable detail untuk Dosen Mengajar */}
                                          {isExpanded && (
                                            <div className="ml-4 mt-2 space-y-2">
                                              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex items-start gap-3">
                                                  {/* Icon */}ang
                                                  <div className="w-8 h-8 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center flex-shrink-0">
                                                    <FontAwesomeIcon 
                                                      icon={faBookOpen} 
                                                      className="w-4 h-4 text-yellow-600 dark:text-yellow-400"
                                                    />
                                                  </div>
                                                  
                                                  {/* Content */}
                                                  <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
                                                      Dosen Mengajar PBL
                                                    </div>
                                                    <div className="space-y-1.5">
                                                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                        <span className="w-16 text-gray-500 dark:text-gray-500">Total PBL:</span>
                                                        <span className="font-medium text-gray-700 dark:text-gray-300">{(dosen as any).total_pbl}</span>
                                                      </div>
                                                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                        <span className="w-16 text-gray-500 dark:text-gray-500">Total Sesi:</span>
                                                        <span className="font-medium text-gray-700 dark:text-gray-300">{(dosen as any).total_sesi}</span>
                                                      </div>
                                                      <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                        <span className="w-16 text-gray-500 dark:text-gray-500">Total Waktu:</span>
                                                        <span className="font-medium text-gray-700 dark:text-gray-300">
                                                          {Math.floor((dosen as any).total_waktu_menit / 60)}j {(dosen as any).total_waktu_menit % 60}m
                                                        </span>
                                                      </div>
                                                      {/* Info semester */}
                                                      {(dosen as any).per_semester && (dosen as any).per_semester.length > 0 && (
                                                        <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                          <span className="w-16 text-gray-500 dark:text-gray-500 flex-shrink-0">Semester:</span>
                                                          <span className="font-medium leading-relaxed text-gray-700 dark:text-gray-300">
                                                            {(dosen as any).per_semester.map((sem: any, idx: number) => 
                                                              `Semester ${sem.semester} (${sem.jumlah} modul, ${sem.total_sesi} sesi)`
                                                            ).join(', ')}
                                                          </span>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                </div>
                                              </div>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    }
                                    return null;
                                  })()}
                                </div>
                              );
                            }
                            // Fallback lama jika tidak ada dosen_peran
                            let label = "";
                            let badgeClass = "bg-gray-200 text-gray-700";
                            const keahlianArr = Array.isArray(dosen.keahlian)
                              ? dosen.keahlian
                              : typeof dosen.keahlian === "string"
                              ? String(dosen.keahlian)
                                  .split(",")
                                  .map((k: string) => k.trim())
                              : [];
                            
                            // Check peran_utama first, then keahlian for standby
                            if ((dosen as any).peran_utama === "koordinator") {
                              label = "Koordinator";
                              badgeClass = "bg-blue-100 text-blue-700";
                              // Jika koordinator, jangan tampilkan sebagai dosen mengajar
                            } else if ((dosen as any).peran_utama === "tim_blok") {
                              label = "Tim Blok";
                              badgeClass = "bg-green-100 text-yellow-700";
                              // Jika tim blok, jangan tampilkan sebagai dosen mengajar
                            } else if ((dosen as any).peran_utama === "dosen_mengajar" || (dosen as any).peran_utama === "mengajar") {
                              label = "Dosen Mengajar";
                              badgeClass = "bg-yellow-100 text-yellow-700";
                            } else if (
                              (dosen as any).peran_utama &&
                              (dosen as any).peran_utama.toLowerCase() === "standby"
                            ) {
                              // Jika standby, cek apakah ada data PBL yang menunjukkan dosen mengajar
                              if (activeTab === "pbl") {
                                const pblDosen = dosen as DosenPBLReport;
                                const hasModulPbl = pblDosen.per_semester.some(sem => 
                                  sem.modul_pbl && sem.modul_pbl.length > 0
                                );
                                
                                if (pblDosen.total_pbl > 0 || pblDosen.total_sesi > 0 || hasModulPbl) {
                                  label = "Dosen Mengajar";
                                  badgeClass = "bg-yellow-100 text-yellow-700";
                                } else {
                              label = "Standby";
                              badgeClass = "bg-gray-200 text-gray-700";
                                }
                              } else {
                                label = "Standby";
                                badgeClass = "bg-gray-200 text-gray-700";
                              }
                            } else if (
                              keahlianArr
                                .map((k) => k.toLowerCase())
                                .includes("standby")
                            ) {
                              label = "Standby";
                              badgeClass = "bg-gray-200 text-gray-700";
                            }
                            
                            // Jika tidak ada peran_utama sama sekali, cek apakah ada data mengajar di per_semester
                            // Tapi hanya jika tidak ada peran koordinator atau tim blok
                            if (!label && activeTab === "pbl") {
                              const pblDosen = dosen as DosenPBLReport;
                              // Cek apakah ada modul PBL yang menunjukkan dosen mengajar
                              const hasModulPbl = pblDosen.per_semester.some(sem => 
                                sem.modul_pbl && sem.modul_pbl.length > 0
                              );
                              
                              // Cek apakah ada peran koordinator atau tim blok di dosen_peran
                              const hasKoordinatorInPeran = Array.isArray((dosen as any).dosen_peran) && 
                                (dosen as any).dosen_peran.some((p: any) => p.tipe_peran === 'koordinator');
                              const hasTimBlokInPeran = Array.isArray((dosen as any).dosen_peran) && 
                                (dosen as any).dosen_peran.some((p: any) => p.tipe_peran === 'tim_blok');
                              
                              // Hanya tampilkan dosen mengajar jika tidak ada peran koordinator atau tim blok
                              if (!hasKoordinatorInPeran && !hasTimBlokInPeran && 
                                  (pblDosen.total_pbl > 0 || pblDosen.total_sesi > 0 || hasModulPbl)) {
                                label = "Dosen Mengajar";
                                badgeClass = "bg-yellow-100 text-yellow-700";
                              }
                            }
                            
                            // Hanya tampilkan badge jika ada peran yang relevan
                            if (!label) {
                              return <span>-</span>;
                            }
                            
                            // Jika ada dosen_peran yang valid, tampilkan multiple peran
                            if (Array.isArray(peranArr) && peranArr.length > 0) {

                              return null; // Biarkan logic multi-peran yang di atas yang handle
                            }
                            
                            const fallbackKey = `${dosen.dosen_id}-fallback`;
                            const isFallbackExpanded = expandedPeran[fallbackKey];
                            
                            return (
                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => toggleExpandedPeran(fallbackKey)}
                                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold ${badgeClass} hover:opacity-80 transition-opacity cursor-pointer`}
                                >
                                  {label}
                                  <FontAwesomeIcon
                                    icon={isFallbackExpanded ? faChevronUp : faChevronDown}
                                    className="w-3 h-3 ml-1"
                                  />
                                </button>
                                
                                {/* Expandable detail untuk fallback */}
                                {isFallbackExpanded && (
                                  <div className="ml-4 mt-2 space-y-2">
                                    <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-3 shadow-sm hover:shadow-md transition-shadow">
                                      <div className="flex items-start gap-3">
                                        {/* Icon */}
                                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                          <FontAwesomeIcon 
                                            icon={faUserTie} 
                                            className="w-4 h-4 text-gray-600 dark:text-gray-400"
                                          />
                                        </div>
                                        
                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                          <div className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-2">
                                            Detail Peran
                                          </div>
                                          <div className="space-y-1.5">
                                            {(dosen as any).matkul_ketua_nama && (
                                              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                <span className="w-16 text-gray-500 dark:text-gray-500">Ketua:</span>
                                                <span className="font-medium text-gray-700 dark:text-gray-300">{(dosen as any).matkul_ketua_nama}</span>
                                              </div>
                                            )}
                                            {(dosen as any).matkul_anggota_nama && (
                                              <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                <span className="w-16 text-gray-500 dark:text-gray-500">Anggota:</span>
                                                <span className="font-medium text-gray-700 dark:text-gray-300">{(dosen as any).matkul_anggota_nama}</span>
                                              </div>
                                            )}
                                            {(dosen as any).peran_kurikulum_mengajar && (
                                              <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                <span className="w-16 text-gray-500 dark:text-gray-500 flex-shrink-0">Mengajar:</span>
                                                <span className="font-medium leading-relaxed text-gray-700 dark:text-gray-300">{(dosen as any).peran_kurikulum_mengajar}</span>
                                              </div>
                                            )}
                                            {/* Info tambahan untuk dosen mengajar */}
                                            {label === "Dosen Mengajar" && activeTab === "pbl" && (
                                              <>
                                                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                  <span className="w-16 text-gray-500 dark:text-gray-500">Total PBL:</span>
                                                  <span className="font-medium text-gray-700 dark:text-gray-300">{(dosen as DosenPBLReport).total_pbl}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                  <span className="w-16 text-gray-500 dark:text-gray-500">Total Sesi:</span>
                                                  <span className="font-medium text-gray-700 dark:text-gray-300">{(dosen as DosenPBLReport).total_sesi}</span>
                                                </div>
                                                <div className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                  <span className="w-16 text-gray-500 dark:text-gray-500">Total Waktu:</span>
                                                  <span className="font-medium text-gray-700 dark:text-gray-300">
                                                    {Math.floor((dosen as DosenPBLReport).total_waktu_menit / 60)}j {(dosen as DosenPBLReport).total_waktu_menit % 60}m
                                                  </span>
                                                </div>
                                              </>
                                            )}
                                            {keahlianArr.length > 0 && (
                                              <div className="flex items-start gap-2 text-xs text-gray-600 dark:text-gray-400">
                                                <span className="w-16 text-gray-500 dark:text-gray-500 flex-shrink-0">Keahlian:</span>
                                                <span className="font-medium leading-relaxed text-gray-700 dark:text-gray-300">{keahlianArr.join(', ')}</span>
                                              </div>
                                            )}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {/* Badge keahlian seragam seperti di PBLGenerate.tsx */}
                          {(() => {
                            let keahlianArr: string[] = [];
                            if (Array.isArray(dosen.keahlian)) {
                              keahlianArr = dosen.keahlian;
                            } else if (typeof dosen.keahlian === "string") {
                              const val = String(dosen.keahlian).trim();
                              if (val === "" || val === "[]") {
                                keahlianArr = [];
                              } else if (val.startsWith("[")) {
                                // Coba parse JSON array string
                                try {
                                  keahlianArr = JSON.parse(val);
                                } catch {
                                  keahlianArr = val
                                    .replace(/[\[\]"]/g, "")
                                    .split(",")
                                    .map((k: string) => k.trim())
                                    .filter(Boolean);
                                }
                              } else {
                                keahlianArr = val
                                  .split(",")
                                  .map((k: string) => k.trim())
                                  .filter(Boolean);
                              }
                            } else {
                              keahlianArr = [];
                            }
                            return keahlianArr.length > 0 ? (
                              <div className="flex flex-wrap gap-2">
                                {keahlianArr.map((k, i) => (
                                  <span
                                    key={i}
                                    className="bg-gray-700 text-white px-3 py-1 rounded-full text-xs font-medium"
                                  >
                                    {k}
                                  </span>
                                ))}
                              </div>
                            ) : (
                              <span>-</span>
                            );
                          })()}
                        </td>
                        {/* Total Modul PBL */}
                        {activeTab === "pbl" && (
                          <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90 text-center font-semibold text-base">
                            {totalModulPbl}
                          </td>
                        )}
                        {/* Total PBL / CSR */}
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90 text-center font-semibold text-base">
                          {activeTab === "csr"
                            ? (dosen as any).total_csr
                            : totalPbl}
                        </td>
                        {/* Total Waktu */}
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                              <FontAwesomeIcon
                                icon={faClock}
                                className="w-4 h-4 text-blue-500"
                              />
                              <span className="font-medium text-base">
                                {totalJam > 0
                                  ? `${totalJam}j ${totalMenit}m`
                                  : `${totalMenit}m`}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500 dark:text-gray-400">
                              ({totalSesi} sesi,{" "}
                              {activeTab === "pbl"
                                ? `${totalModulPbl} modul`
                                : `${totalPbl} × 5×50 menit`}
                              )
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">
                          <div className="flex flex-col gap-1">
                            {dosen.per_semester.map((sem, i) => {
                              let waktuPerSemester = 0;
                              let countPerSemester = 0;
                              let sesiPerSemester = 0;
                              if (activeTab === "pbl") {
                                const s =
                                  sem as DosenPBLReport["per_semester"][0];
                                waktuPerSemester = s.total_waktu_menit;
                                countPerSemester = s.jumlah;
                                sesiPerSemester = s.total_sesi;
                              } else {
                                // CSR pakai struktur baru
                                const s = sem as any;
                                waktuPerSemester = s.total_waktu_menit;
                                countPerSemester = s.jumlah;
                                sesiPerSemester = s.total_sesi;
                              }
                              const jamPerSemester = Math.floor(
                                waktuPerSemester / 60
                              );
                              const menitPerSemester = waktuPerSemester % 60;
                              return (
                                <div key={sem.semester} className="mb-1">
                                  <button
                                    className="flex items-center gap-2 font-semibold text-brand-600 dark:text-brand-400 focus:outline-none"
                                    onClick={() =>
                                      toggleExpand(
                                        dosen.dosen_id * 100 + sem.semester
                                      )
                                    }
                                    aria-expanded={
                                      !!expandedRows[
                                        dosen.dosen_id * 100 + sem.semester
                                      ]
                                    }
                                  >
                                    <FontAwesomeIcon
                                      icon={
                                        expandedRows[
                                          dosen.dosen_id * 100 + sem.semester
                                        ]
                                          ? faChevronUp
                                          : faChevronDown
                                      }
                                      className="w-3 h-3"
                                    />
                                    Semester {sem.semester}: {countPerSemester}{" "}
                                    {getTitle()} / {sesiPerSemester} sesi
                                    <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                                      {jamPerSemester > 0
                                        ? `${jamPerSemester}j ${menitPerSemester}m`
                                        : `${menitPerSemester}m`}
                                    </span>
                                  </button>
                                  {/* Collapsible detail modul/blok */}
                                  {activeTab === "csr" &&
                                    Array.isArray((sem as any).blok_csr) &&
                                    (sem as any).blok_csr.length > 0 &&
                                    expandedRows[
                                      dosen.dosen_id * 100 + sem.semester
                                    ] && (
                                      <div className="ml-6 text-xs text-gray-700 dark:text-gray-300 space-y-2">
                                        {/* Group by blok, tampilkan info blok dan waktu */}
                                        {((sem as any).blok_csr as any[]).map(
                                          (blok, idx) => {
                                            const jam = Math.floor(
                                              (blok.waktu_menit || 0) / 60
                                            );
                                            const menit =
                                              (blok.waktu_menit || 0) % 60;
                                            return (
                                              <div key={idx}>
                                                <div className="flex items-center gap-2">
                                                  <span>
                                                    • CSR {blok.blok}:{" "}
                                                    {blok.kode} — {blok.nama},{" "}
                                                    {blok.jumlah_sesi} sesi,{" "}
                                                    {jam > 0 ? `${jam}j` : ""}{" "}
                                                    {menit > 0
                                                      ? `${menit}m`
                                                      : ""}
                                                  </span>
                                                </div>
                                              </div>
                                            );
                                          }
                                        )}
                                      </div>
                                    )}
                                  {activeTab === "pbl" &&
                                    (sem as DosenPBLReport["per_semester"][0])
                                      .modul_pbl &&
                                    (sem as DosenPBLReport["per_semester"][0])
                                      .modul_pbl.length > 0 &&
                                    expandedRows[
                                      dosen.dosen_id * 100 + sem.semester
                                    ] && (
                                      <div className="ml-6 text-xs text-gray-700 dark:text-gray-300 space-y-2">
                                        {/* Group by blok + kode MK, lalu tampilkan modul di bawahnya */}
                                        {(() => {
                                          const modulPbl = (
                                            sem as DosenPBLReport["per_semester"][0]
                                          ).modul_pbl;
                                          // Group by blok + kode MK
                                          const blokMap: Record<
                                            string,
                                            {
                                              blok: number;
                                              kode: string;
                                              nama: string;
                                              sesi: number;
                                              waktu: number;
                                              modul: number;
                                              modulList: {
                                                modul_ke: string;
                                                nama_modul: string;
                                              }[];
                                            }
                                          > = {};
                                          modulPbl.forEach((modul) => {
                                            const key = `${modul.blok}__${modul.mata_kuliah_kode}`;
                                            if (!blokMap[key]) {
                                              blokMap[key] = {
                                                blok: modul.blok,
                                                kode: modul.mata_kuliah_kode,
                                                nama: modul.mata_kuliah_nama,
                                                sesi: 0,
                                                waktu: 0,
                                                modul: 0,
                                                modulList: [],
                                              };
                                            }
                                            blokMap[key].sesi +=
                                              modul.jumlah_sesi;
                                            blokMap[key].waktu +=
                                              modul.waktu_menit;
                                            blokMap[key].modul += 1;
                                            blokMap[key].modulList.push({
                                              modul_ke: modul.modul_ke,
                                              nama_modul: modul.nama_modul,
                                            });
                                          });
                                          return Object.values(blokMap)
                                            .sort((a, b) => a.blok - b.blok)
                                            .map((blok, idx) => {
                                              const jam = Math.floor(
                                                blok.waktu / 60
                                              );
                                              const menit = blok.waktu % 60;
                                              return (
                                                <div key={idx}>
                                                  <div className="flex items-center gap-2">
                                                    <span>
                                                      • Blok {blok.blok}:{" "}
                                                      {blok.kode} — {blok.modul}{" "}
                                                      modul, {blok.sesi} sesi,{" "}
                                                      {jam > 0 ? `${jam}j` : ""}{" "}
                                                      {menit > 0
                                                        ? `${menit}m`
                                                        : ""}
                                                    </span>
                                                  </div>
                                                  <div className="ml-6 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                                                    {blok.modulList
                                                      .sort(
                                                        (a, b) =>
                                                          Number(a.modul_ke) -
                                                          Number(b.modul_ke)
                                                      )
                                                      .map((modul, mIdx) => (
                                                        <div key={mIdx}>
                                                          - Modul{" "}
                                                          {modul.modul_ke} (
                                                          {modul.nama_modul})
                                                        </div>
                                                      ))}
                                                  </div>
                                                </div>
                                              );
                                            });
                                        })()}
                                      </div>
                                    )}
                                </div>
                              );
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">
                          {dosen.tanggal_mulai
                            ? new Date(dosen.tanggal_mulai).toLocaleDateString(
                                "id-ID",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )
                            : "-"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">
                          {dosen.tanggal_akhir
                            ? new Date(dosen.tanggal_akhir).toLocaleDateString(
                                "id-ID",
                                {
                                  day: "2-digit",
                                  month: "short",
                                  year: "numeric",
                                }
                              )
                            : "-"}
                        </td>
                      </tr>
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {pagination.last_page > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4">
            <div className="flex items-center gap-4">
              <select
                value={pagination.per_page}
                onChange={(e) =>
                  setPagination((prev) => ({
                    ...prev,
                    per_page: Number(e.target.value),
                    current_page: 1,
                  }))
                }
                className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none"
              >
                {[10, 15, 20, 50].map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Menampilkan{" "}
                {(pagination.current_page - 1) * pagination.per_page + 1} -{" "}
                {Math.min(
                  pagination.current_page * pagination.per_page,
                  pagination.total
                )}{" "}
                dari {pagination.total} dosen
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    current_page: prev.current_page - 1,
                  }))
                }
                disabled={pagination.current_page === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Prev
              </button>
              
              {/* Smart Pagination with Scroll */}
              <div className="flex items-center gap-1 max-w-[400px] overflow-x-auto pagination-scroll" style={{
                scrollbarWidth: 'thin',
                scrollbarColor: '#cbd5e1 #f1f5f9'
              }}>
                <style dangerouslySetInnerHTML={{
                  __html: `
                    .pagination-scroll::-webkit-scrollbar {
                      height: 6px;
                    }
                    .pagination-scroll::-webkit-scrollbar-track {
                      background: #f1f5f9;
                      border-radius: 3px;
                    }
                    .pagination-scroll::-webkit-scrollbar-thumb {
                      background: #cbd5e1;
                      border-radius: 3px;
                    }
                    .pagination-scroll::-webkit-scrollbar-thumb:hover {
                      background: #94a3b8;
                    }
                    .dark .pagination-scroll::-webkit-scrollbar-track {
                      background: #1e293b;
                    }
                    .dark .pagination-scroll::-webkit-scrollbar-thumb {
                      background: #475569;
                    }
                    .dark .pagination-scroll::-webkit-scrollbar-thumb:hover {
                      background: #64748b;
                    }
                  `
                }} />
                
                {/* Always show first page */}
                <button
                  onClick={() =>
                    setPagination((prev) => ({ ...prev, current_page: 1 }))
                  }
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    pagination.current_page === 1
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                  }`}
                >
                  1
                </button>
                
                {/* Show ellipsis if current page is far from start */}
                {pagination.current_page > 4 && (
                  <span className="px-2 text-gray-500 dark:text-gray-400">...</span>
                )}
                
                {/* Show pages around current page */}
                {Array.from({ length: pagination.last_page }, (_, i) => {
                  const pageNum = i + 1;
                  // Show pages around current page (2 pages before and after)
                  const shouldShow = pageNum > 1 && pageNum < pagination.last_page && 
                    (pageNum >= pagination.current_page - 2 && pageNum <= pagination.current_page + 2);
                  
                  if (!shouldShow) return null;
                  
                  return (
                    <button
                      key={i}
                      onClick={() =>
                        setPagination((prev) => ({ ...prev, current_page: pageNum }))
                      }
                      className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                        pagination.current_page === pageNum
                          ? "bg-brand-500 text-white"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
                
                {/* Show ellipsis if current page is far from end */}
                {pagination.current_page < pagination.last_page - 3 && (
                  <span className="px-2 text-gray-500 dark:text-gray-400">...</span>
                )}
                
                {/* Always show last page if it's not the first page */}
                {pagination.last_page > 1 && (
                  <button
                    onClick={() =>
                      setPagination((prev) => ({ ...prev, current_page: pagination.last_page }))
                    }
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                      pagination.current_page === pagination.last_page
                        ? "bg-brand-500 text-white"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {pagination.last_page}
                  </button>
                )}
              </div>
              
              <button
                onClick={() =>
                  setPagination((prev) => ({
                    ...prev,
                    current_page: prev.current_page + 1,
                  }))
                }
                disabled={pagination.current_page === pagination.last_page}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReportingDosen;

