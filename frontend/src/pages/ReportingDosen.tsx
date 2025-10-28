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
        
        // Debug: log response dan data
        console.log('=== API RESPONSE DEBUG ===');
        console.log('API Response:', response.data);
        console.log('Data length:', data.length);
        console.log('Sample data:', data[0]);
        console.log('=== END API DEBUG ===');
        
        data = data.map((d: DosenPBLReport) => {
          // Debug: log setiap dosen
          console.log('Processing dosen:', d.dosen_name, 'per_semester:', d.per_semester?.length);
          
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
      console.error('=== API ERROR ===');
      console.error('Error fetching data:', error);
      console.error('Error response:', error.response?.data);
      console.error('=== END API ERROR ===');
      
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
        console.warn('Logo tidak bisa dimuat, menggunakan teks alternatif');
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
      console.error('Error generating PDF:', error);
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

      // Style header row - hijau gelap dengan teks putih
      worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      worksheet.getRow(1).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF2D5016' } // Hijau gelap
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
      console.error('Error generating Excel:', error);
      // Bisa ditambahkan toast notification di sini
    }
  };

  const handleExportExcelAll = async () => {
    try {
        // Debug logging untuk melihat data yang tersedia
        console.log('=== DEBUG EXCEL EXPORT - BLOK DATA BASED ===');
        console.log('Total dosen PBL:', dosenPblReport.length);
        
        // Ambil data blok dari API yang sudah kita buat
        const blokResponse = await api.get('/reporting/blok-data-excel');
        const blokData = blokResponse.data.data || [];
        console.log('=== API RESPONSE DEBUG ===');
        console.log('API Response Status:', blokResponse.status);
        console.log('API Response Data:', blokResponse.data);
        console.log('Total blok data:', blokData.length);
        console.log('Sample blok data:', blokData[0]);
        console.log('=== END API RESPONSE DEBUG ===');
        
        // Ambil data dosen untuk mapping
        const dosenResponse = await api.get('/users');
        const dosenData = dosenResponse.data.data || [];
        console.log('Total dosen:', dosenData.length);
        
        // Buat mapping dosen
        const dosenMap = {};
        dosenData.forEach(dosen => {
          dosenMap[dosen.id] = dosen.name;
        });
        
        console.log('=== END DEBUG ===');
      
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Reporting Dosen PBL');

      // Set column headers with wider widths to prevent text truncation
      // Only define columns for Blok data (6 columns: NAMA DOSEN, PBL 1, PBL 2, PRAKTIKUM, KULIAH BESAR, JURNAL READING)
      worksheet.columns = [
        { header: 'NAMA DOSEN', key: 'nama', width: 35 }, // Increased for longer names
        { header: 'PBL 1', key: 'pbl1', width: 15 }, // Increased for better visibility
        { header: 'PBL 2', key: 'pbl2', width: 15 }, // Increased for better visibility
        { header: 'PRAKTIKUM', key: 'praktikum', width: 18 }, // Increased for full text
        { header: 'KULIAH BESAR', key: 'kuliah_besar', width: 25 }, // Increased for full text
        { header: 'JURNAL READING', key: 'jurnal_reading', width: 25 } // Increased for full text
      ];

      let currentRow = 1;

      // Add main title
      worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
      worksheet.getCell(`A${currentRow}`).value = 'Reporting Dosen PBL';
      worksheet.getCell(`A${currentRow}`).font = { size: 16, bold: true };
      worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
      
      // Make columns G onwards white and empty
      for (let i = 7; i <= 20; i++) { // Columns G to T
        const cell = worksheet.getCell(`${String.fromCharCode(64 + i)}${currentRow}`);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' } // Background putih
        };
        cell.value = ''; // Empty value
      }
      
      currentRow += 2;

      // Add subtitle
      worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
      worksheet.getCell(`A${currentRow}`).value = `Blok: 1-4 | Export: ${new Date().toLocaleDateString('id-ID')}`;
      worksheet.getCell(`A${currentRow}`).font = { size: 12 };
      worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'center' };
      
      // Make columns G onwards white and empty
      for (let i = 7; i <= 20; i++) { // Columns G to T
        const cell = worksheet.getCell(`${String.fromCharCode(64 + i)}${currentRow}`);
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFFFFF' } // Background putih
        };
        cell.value = ''; // Empty value
      }
      
      currentRow += 2;

      // Group data blok by dosen, blok, dan semester
      const jadwalByDosenBlokSemester: { [key: string]: any } = {};
      
      console.log('=== PROCESSING BLOK DATA ===');
      console.log('Total blok data:', blokData.length);
      
      // Debug: Cek struktur data blok
      if (blokData.length === 0) {
        console.error('❌ ERROR: Blok data kosong!');
        console.error('API Response:', blokResponse.data);
        return;
      }
      
      console.log('Sample blok data structure:', {
        blok: blokData[0].blok,
        semester: blokData[0].semester,
        mata_kuliah_nama: blokData[0].mata_kuliah_nama,
        kuliah_besar: blokData[0].kuliah_besar,
        praktikum: blokData[0].praktikum
      });
      
      // Process data blok dari API
      blokData.forEach((blokDataItem: any) => {
        const blok = blokDataItem.blok;
        const semester = blokDataItem.semester;
        
        console.log(`Processing Blok ${blok}, Semester ${semester}: ${blokDataItem.mata_kuliah_nama}`);
        
        // Skip processing if this is non blok data (we'll handle it separately)
        if (blok === null || blok === undefined) {
          console.log(`  Skipping non blok data for semester ${semester}`);
          return;
        }
        
        // Process PBL 1
        if (blokDataItem.pbl1 && blokDataItem.pbl1.length > 0) {
          console.log(`  PBL 1: ${blokDataItem.pbl1.length} jadwal`);
          blokDataItem.pbl1.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_blok${blok}_semester${semester}`;
            if (!jadwalByDosenBlokSemester[key]) {
              jadwalByDosenBlokSemester[key] = {
                dosen_name: jadwal.dosen_name,
                blok: blok,
                semester: semester,
                pbl1: 0,
                pbl2: 0,
                csrReguler: 0,
                csrResponsi: 0,
                praktikum: 0,
                kuliahBesar: 0,
                jurnalReading: 0,
                materi: 0
              };
            }
            jadwalByDosenBlokSemester[key].pbl1 += jadwal.jumlah_sesi;
            console.log(`    ${jadwal.dosen_name}: ${jadwal.jumlah_sesi} sesi`);
          });
        }
        
        // Process PBL 2
        if (blokDataItem.pbl2 && blokDataItem.pbl2.length > 0) {
          console.log(`  PBL 2: ${blokDataItem.pbl2.length} jadwal`);
          blokDataItem.pbl2.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_blok${blok}_semester${semester}`;
            if (!jadwalByDosenBlokSemester[key]) {
              jadwalByDosenBlokSemester[key] = {
                dosen_name: jadwal.dosen_name,
                blok: blok,
                semester: semester,
                pbl1: 0,
                pbl2: 0,
                csrReguler: 0,
                csrResponsi: 0,
                praktikum: 0,
                kuliahBesar: 0,
                jurnalReading: 0,
                materi: 0
              };
            }
            jadwalByDosenBlokSemester[key].pbl2 += jadwal.jumlah_sesi;
            console.log(`    ${jadwal.dosen_name}: ${jadwal.jumlah_sesi} sesi`);
          });
        }
        
        // Skip CSR Reguler and CSR Responsi for blok data (only for non blok)
        console.log(`  CSR Reguler: SKIPPED (only for non blok)`);
        console.log(`  CSR Responsi: SKIPPED (only for non blok)`);
        
        // Process Praktikum
        if (blokDataItem.praktikum && blokDataItem.praktikum.length > 0) {
          console.log(`  Praktikum: ${blokDataItem.praktikum.length} jadwal`);
          blokDataItem.praktikum.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_blok${blok}_semester${semester}`;
            if (!jadwalByDosenBlokSemester[key]) {
              jadwalByDosenBlokSemester[key] = {
                dosen_name: jadwal.dosen_name,
                blok: blok,
                semester: semester,
                pbl1: 0,
                pbl2: 0,
                csrReguler: 0,
                csrResponsi: 0,
                praktikum: 0,
                kuliahBesar: 0,
                jurnalReading: 0,
                materi: 0
              };
            }
            jadwalByDosenBlokSemester[key].praktikum += jadwal.jumlah_sesi;
            console.log(`    ${jadwal.dosen_name}: ${jadwal.jumlah_sesi} sesi`);
          });
        }
        
        // Process Kuliah Besar
        if (blokDataItem.kuliah_besar && blokDataItem.kuliah_besar.length > 0) {
          console.log(`  Kuliah Besar: ${blokDataItem.kuliah_besar.length} jadwal`);
          blokDataItem.kuliah_besar.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_blok${blok}_semester${semester}`;
            if (!jadwalByDosenBlokSemester[key]) {
              jadwalByDosenBlokSemester[key] = {
                dosen_name: jadwal.dosen_name,
                blok: blok,
                semester: semester,
                pbl1: 0,
                pbl2: 0,
                csrReguler: 0,
                csrResponsi: 0,
                praktikum: 0,
                kuliahBesar: 0,
                jurnalReading: 0,
                materi: 0
              };
            }
            jadwalByDosenBlokSemester[key].kuliahBesar += jadwal.jumlah_sesi;
            console.log(`    ${jadwal.dosen_name}: ${jadwal.jumlah_sesi} sesi`);
            console.log(`    Key: ${key}`);
            console.log(`    Data after:`, jadwalByDosenBlokSemester[key]);
          });
        } else {
          console.log(`  Kuliah Besar: 0 jadwal`);
        }
        
        // Process Jurnal Reading
        if (blokDataItem.jurnal_reading && blokDataItem.jurnal_reading.length > 0) {
          console.log(`  Jurnal Reading: ${blokDataItem.jurnal_reading.length} jadwal`);
          blokDataItem.jurnal_reading.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_blok${blok}_semester${semester}`;
            if (!jadwalByDosenBlokSemester[key]) {
              jadwalByDosenBlokSemester[key] = {
                dosen_name: jadwal.dosen_name,
                blok: blok,
                semester: semester,
                pbl1: 0,
                pbl2: 0,
                csrReguler: 0,
                csrResponsi: 0,
                praktikum: 0,
                kuliahBesar: 0,
                jurnalReading: 0,
                materi: 0
              };
            }
            jadwalByDosenBlokSemester[key].jurnalReading += jadwal.jumlah_sesi;
            console.log(`    ${jadwal.dosen_name}: ${jadwal.jumlah_sesi} sesi`);
          });
        }
        
        // Skip Materi for blok data (only for non blok)
        console.log(`  Materi: SKIPPED (only for non blok)`);
      });

      // Process non blok data separately
      console.log('=== PROCESSING NON BLOK DATA ===');
      blokData.forEach((blokDataItem: any) => {
        const blok = blokDataItem.blok;
        const semester = blokDataItem.semester;
        
        // Only process non blok data
        if (blok !== null && blok !== undefined) {
          return;
        }
        
        console.log(`Processing Non Blok Semester ${semester}: ${blokDataItem.mata_kuliah_nama}`);
        
        // Process CSR Reguler for non blok
        if (blokDataItem.csr_reguler && blokDataItem.csr_reguler.length > 0) {
          console.log(`  CSR Reguler: ${blokDataItem.csr_reguler.length} jadwal`);
          blokDataItem.csr_reguler.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_nonblok_semester${semester}`;
            if (!jadwalByDosenBlokSemester[key]) {
              jadwalByDosenBlokSemester[key] = {
                dosen_name: jadwal.dosen_name,
                blok: null, // Non blok
                semester: semester,
                pbl1: 0,
                pbl2: 0,
                csrReguler: 0,
                csrResponsi: 0,
                praktikum: 0,
                kuliahBesar: 0,
                jurnalReading: 0,
                materi: 0
              };
            }
            jadwalByDosenBlokSemester[key].csrReguler += jadwal.jumlah_sesi;
            console.log(`    ${jadwal.dosen_name}: ${jadwal.jumlah_sesi} sesi`);
          });
        }
        
        // Process CSR Responsi for non blok
        if (blokDataItem.csr_responsi && blokDataItem.csr_responsi.length > 0) {
          console.log(`  CSR Responsi: ${blokDataItem.csr_responsi.length} jadwal`);
          blokDataItem.csr_responsi.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_nonblok_semester${semester}`;
            if (!jadwalByDosenBlokSemester[key]) {
              jadwalByDosenBlokSemester[key] = {
                dosen_name: jadwal.dosen_name,
                blok: null, // Non blok
                semester: semester,
                pbl1: 0,
                pbl2: 0,
                csrReguler: 0,
                csrResponsi: 0,
                praktikum: 0,
                kuliahBesar: 0,
                jurnalReading: 0,
                materi: 0
              };
            }
            jadwalByDosenBlokSemester[key].csrResponsi += jadwal.jumlah_sesi;
            console.log(`    ${jadwal.dosen_name}: ${jadwal.jumlah_sesi} sesi`);
          });
        }
        
        // Process Materi for non blok
        if (blokDataItem.materi && blokDataItem.materi.length > 0) {
          console.log(`  Materi: ${blokDataItem.materi.length} jadwal`);
          blokDataItem.materi.forEach((jadwal: any) => {
            const key = `${jadwal.dosen_name}_nonblok_semester${semester}`;
            if (!jadwalByDosenBlokSemester[key]) {
              jadwalByDosenBlokSemester[key] = {
                dosen_name: jadwal.dosen_name,
                blok: null, // Non blok
                semester: semester,
                pbl1: 0,
                pbl2: 0,
                csrReguler: 0,
                csrResponsi: 0,
                praktikum: 0,
                kuliahBesar: 0,
                jurnalReading: 0,
                materi: 0
              };
            }
            jadwalByDosenBlokSemester[key].materi += jadwal.jumlah_sesi;
            console.log(`    ${jadwal.dosen_name}: ${jadwal.jumlah_sesi} sesi`);
          });
        }
      });

      console.log('=== END PROCESSING ===');
      console.log('Total jadwal grouped:', Object.keys(jadwalByDosenBlokSemester).length);
      console.log('Sample grouped data:', Object.values(jadwalByDosenBlokSemester)[0]);
      
      // Debug: Cek apakah ada data yang akan ditampilkan
      if (Object.keys(jadwalByDosenBlokSemester).length === 0) {
        console.error('❌ ERROR: Tidak ada data yang diproses!');
        console.error('Blok data length:', blokData.length);
        console.error('Sample blok data:', blokData[0]);
        return;
      }
      
      // Debug: Tampilkan semua data yang akan ditampilkan di Excel
      console.log('=== EXCEL DATA PREVIEW ===');
      console.log('Total data to display:', Object.keys(jadwalByDosenBlokSemester).length);
      Object.values(jadwalByDosenBlokSemester).forEach((data: any, index) => {
        if (index < 10) { // Tampilkan 10 data pertama
          console.log(`Data ${index + 1}:`, {
            dosen_name: data.dosen_name,
            blok: data.blok,
            semester: data.semester,
            pbl1: data.pbl1,
            pbl2: data.pbl2,
            csrReguler: data.csrReguler,
            csrResponsi: data.csrResponsi,
            praktikum: data.praktikum,
            kuliahBesar: data.kuliahBesar,
            jurnalReading: data.jurnalReading,
            materi: data.materi
          });
        }
      });
      console.log('=== END EXCEL DATA PREVIEW ===');

      // Process each blok (1-4)
      for (let blokNumber = 1; blokNumber <= 4; blokNumber++) {
        // Add blok title
        worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = `blok ${blokNumber}`;
        worksheet.getCell(`A${currentRow}`).font = { size: 14, bold: true };
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'left' };
        // Clear background color for merged cells
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'none' };
        
        // Make columns G onwards white and empty
        for (let i = 7; i <= 20; i++) { // Columns G to T
          const cell = worksheet.getCell(`${String.fromCharCode(64 + i)}${currentRow}`);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' } // Background putih
          };
          cell.value = ''; // Empty value
        }
        
        currentRow += 1;

        // Process each semester (1-7) for this blok
        for (let semesterNumber = 1; semesterNumber <= 7; semesterNumber++) {
          // Get data for this specific blok and semester first
          const dosenData = Object.values(jadwalByDosenBlokSemester).filter((data: any) => 
            data.blok === blokNumber && String(data.semester) === String(semesterNumber)
          );
          
          console.log(`🔍 Checking Blok ${blokNumber}, Semester ${semesterNumber}: ${dosenData.length} dosen`);

          // Only add semester if there is data (skip completely empty sections)
          if (dosenData.length > 0) {
            console.log(`✅ FOUND DATA for Blok ${blokNumber}, Semester ${semesterNumber}: ${dosenData.length} dosen`);
            
          // Add semester title
          worksheet.mergeCells(`A${currentRow}:F${currentRow}`);
          worksheet.getCell(`A${currentRow}`).value = `Semester ${semesterNumber}`;
          worksheet.getCell(`A${currentRow}`).font = { size: 12, bold: true };
          worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'left' };
          // Clear background color for merged cells
          worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'none' };
          
          // Make columns G onwards white and empty
          for (let i = 7; i <= 20; i++) { // Columns G to T
            const cell = worksheet.getCell(`${String.fromCharCode(64 + i)}${currentRow}`);
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFFFF' } // Background putih
            };
            cell.value = ''; // Empty value
          }
          
          currentRow += 1;

          // Add header row for this semester (blok data - no CSR and Materi)
          const headerRow = worksheet.getRow(currentRow);
          headerRow.values = [
            'NAMA DOSEN', 'PBL 1', 'PBL 2', 'PRAKTIKUM', 'KULIAH BESAR', 'JURNAL READING'
          ];
            
        // Style header row - only for columns A-F
        for (let i = 1; i <= 6; i++) {
          const cell = headerRow.getCell(i);
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2D5016' } // Hijau gelap
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        
        // Make columns G onwards white and empty
        for (let i = 7; i <= 20; i++) { // Columns G to T
          const cell = headerRow.getCell(i);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' } // Background putih
          };
          cell.value = ''; // Empty value
        }
            
            currentRow += 1;
            
            // Add data rows for this specific semester and blok
            dosenData.forEach((data: any) => {
              console.log(`📝 Adding row for ${data.dosen_name} - Blok ${blokNumber}, Semester ${semesterNumber}:`, {
                pbl1: data.pbl1,
                pbl2: data.pbl2,
                praktikum: data.praktikum,
                kuliahBesar: data.kuliahBesar,
                jurnalReading: data.jurnalReading
              });

              // Add data row (blok data - no CSR and Materi)
              const dataRow = worksheet.getRow(currentRow);
              const rowValues = [
                data.dosen_name,
                data.pbl1 || 0,
                data.pbl2 || 0,
                data.praktikum || 0,
                data.kuliahBesar || 0,
                data.jurnalReading || 0
              ];
              
              dataRow.values = rowValues;

              console.log(`📊 Excel row ${currentRow} values:`, rowValues);

              // Style data row - only columns A-F
              for (let i = 1; i <= 6; i++) {
                const cell = dataRow.getCell(i);
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFFFFF' } // Background putih
                };
                cell.font = { color: { argb: 'FF000000' } }; // Teks hitam
                
                // Set alignment for numeric columns (all except NAMA DOSEN)
                if (i >= 2) {
                  cell.alignment = { horizontal: 'center' };
                }
              }
              
              // Make columns G onwards white and empty
              for (let i = 7; i <= 20; i++) { // Columns G to T
                const cell = dataRow.getCell(i);
                cell.fill = {
                  type: 'pattern',
                  pattern: 'solid',
                  fgColor: { argb: 'FFFFFFFF' } // Background putih
                };
                cell.value = ''; // Empty value
              }

              currentRow += 1;
            });
            
            currentRow += 1; // Add space between semesters
          } else {
            console.log(`❌ NO DATA for Blok ${blokNumber}, Semester ${semesterNumber} - SKIPPING COMPLETELY`);
            // Skip this semester completely if no data (don't add any title or header)
          }
        }

        currentRow += 1; // Add space between bloks
      }

      // Add Non Blok section after all bloks
        // Add non blok title
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = `Non Blok`;
        worksheet.getCell(`A${currentRow}`).font = { size: 14, bold: true };
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'left' };
        // Clear background color for merged cells
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'none' };
        
        // Make columns E onwards white and empty
        for (let i = 5; i <= 20; i++) { // Columns E to T
          const cell = worksheet.getCell(`${String.fromCharCode(64 + i)}${currentRow}`);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' } // Background putih
          };
          cell.value = ''; // Empty value
        }
        
        currentRow += 1;

      // Process each semester (1-7) for non blok
      for (let semesterNumber = 1; semesterNumber <= 7; semesterNumber++) {
        // Add semester title
        worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
        worksheet.getCell(`A${currentRow}`).value = `Semester ${semesterNumber}`;
        worksheet.getCell(`A${currentRow}`).font = { size: 12, bold: true };
        worksheet.getCell(`A${currentRow}`).alignment = { horizontal: 'left' };
        // Clear background color for merged cells
        worksheet.getCell(`A${currentRow}`).fill = { type: 'pattern', pattern: 'none' };
        
        // Make columns E onwards white and empty
        for (let i = 5; i <= 20; i++) { // Columns E to T
          const cell = worksheet.getCell(`${String.fromCharCode(64 + i)}${currentRow}`);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' } // Background putih
          };
          cell.value = ''; // Empty value
        }
        
        currentRow += 1;

        // Add header row for this semester (only CSR Reguler, CSR Responsi, Materi)
        const headerRow = worksheet.getRow(currentRow);
        headerRow.values = [
          'NAMA DOSEN', 'CSR REGULER', 'CSR RESPONSI', 'MATERI'
        ];
        
        // Style header row - only for columns A-D
        for (let i = 1; i <= 4; i++) {
          const cell = headerRow.getCell(i);
          cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF2D5016' } // Hijau gelap
          };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        
        // Make columns E onwards white and empty
        for (let i = 5; i <= 20; i++) { // Columns E to T
          const cell = headerRow.getCell(i);
          cell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFFFFF' } // Background putih
          };
          cell.value = ''; // Empty value
        }
        
        currentRow += 1;

        // Get data for non blok semester
        const nonBlokData = Object.values(jadwalByDosenBlokSemester).filter((data: any) => 
          data.blok === null && String(data.semester) === String(semesterNumber)
        );

        console.log(`=== NON BLOK SEMESTER ${semesterNumber} ===`);
        console.log(`Non Blok Semester ${semesterNumber}:`, {
          totalDosen: nonBlokData.length,
          dosenNames: nonBlokData.map((d: any) => d.dosen_name)
        });

        if (nonBlokData.length > 0) {
          console.log(`✅ FOUND NON BLOK DATA for Semester ${semesterNumber}: ${nonBlokData.length} dosen`);
          console.log('Dosen names:', nonBlokData.map((d: any) => d.dosen_name));
          console.log('Dosen data details:', nonBlokData);
          
          // Add data rows for non blok semester
          nonBlokData.forEach((data: any) => {
            console.log(`📝 Adding non blok row for ${data.dosen_name} - Semester ${semesterNumber}:`, {
              csrReguler: data.csrReguler,
              csrResponsi: data.csrResponsi,
              materi: data.materi
            });

          // Add data row
          const dataRow = worksheet.getRow(currentRow);
          const rowValues = [
            data.dosen_name,
            data.csrReguler || 0,
            data.csrResponsi || 0,
            data.materi || 0
          ];
            
            dataRow.values = rowValues;

            console.log(`📊 Non blok Excel row ${currentRow} values:`, rowValues);

            // Style data row - only columns A-D for non-blok
            for (let i = 1; i <= 4; i++) {
              const cell = dataRow.getCell(i);
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFFFF' } // Background putih
              };
              cell.font = { color: { argb: 'FF000000' } }; // Teks hitam
              
              // Set alignment for numeric columns (all except NAMA DOSEN)
              if (i >= 2) {
                cell.alignment = { horizontal: 'center' };
              }
            }
            
            // Make columns E onwards white and empty
            for (let i = 5; i <= 20; i++) { // Columns E to T
              const cell = dataRow.getCell(i);
              cell.fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFFFFFFF' } // Background putih
              };
              cell.value = ''; // Empty value
            }

            currentRow += 1;
          });
        } else {
          console.log(`❌ NO NON BLOK DATA for Semester ${semesterNumber}`);
          
          // Add empty row if no data for this semester
          worksheet.mergeCells(`A${currentRow}:D${currentRow}`);
          const emptyRow = worksheet.getRow(currentRow);
          emptyRow.getCell(1).value = 'Tidak ada data untuk semester ini';
          emptyRow.font = { italic: true };
          
          // Style empty row - only columns A-D
          for (let i = 1; i <= 4; i++) {
            const cell = emptyRow.getCell(i);
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFFFF' } // Background putih
            };
            cell.font = { italic: true, color: { argb: 'FF000000' } }; // Teks hitam italic
          }
          
          // Make columns E onwards white and empty
          for (let i = 5; i <= 20; i++) { // Columns E to T
            const cell = emptyRow.getCell(i);
            cell.fill = {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFFFFF' } // Background putih
            };
            cell.value = ''; // Empty value
          }
          currentRow += 1;
        }

        currentRow += 1; // Add space between semesters
      }

      // Add borders to all cells (only for the 6 relevant columns: A-F)
      worksheet.eachRow((row, rowNumber) => {
        row.eachCell((cell, colNumber) => {
          if (rowNumber > 2 && colNumber <= 6) { // Skip title rows and only apply to columns A-F
            cell.border = {
              top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
              left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
              bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
              right: { style: 'thin', color: { argb: 'FFCCCCCC' } }
            };
          }
        });
      });

      // Generate Excel file
      console.log('=== GENERATING EXCEL FILE ===');
      console.log('Total rows in worksheet:', worksheet.rowCount);
      console.log('Current row:', currentRow);
      console.log('Total data processed:', Object.keys(jadwalByDosenBlokSemester).length);
      
      // Debug: Cek apakah worksheet memiliki data
      if (worksheet.rowCount <= 3) {
        console.error('❌ ERROR: Worksheet tidak memiliki data!');
        console.error('Row count:', worksheet.rowCount);
        console.error('Current row:', currentRow);
        return;
      }
      
      // Debug: Tampilkan beberapa baris Excel untuk memastikan data ada
      console.log('=== EXCEL CONTENT PREVIEW ===');
      for (let i = 1; i <= Math.min(10, worksheet.rowCount); i++) {
        const row = worksheet.getRow(i);
        const rowValues = [];
        for (let j = 1; j <= 6; j++) { // Only show 6 columns (A-F)
          rowValues.push(row.getCell(j).value || '');
        }
        console.log(`Row ${i}:`, rowValues);
      }
      console.log('=== END EXCEL CONTENT PREVIEW ===');
      
      const buffer = await workbook.xlsx.writeBuffer();
      console.log('Excel buffer size:', buffer.byteLength);
      
      const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      console.log('Excel blob size:', blob.size);
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `laporan-dosen-pbl-semua-blok-${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      console.log('✅ Excel file generated and downloaded successfully!');

    } catch (error) {
      console.error('Error generating Excel All:', error);
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
            <button
              onClick={handleExportExcelAll}
              className="w-fit flex items-center gap-2 px-5 text-sm py-2 bg-indigo-500 text-white rounded-lg shadow hover:bg-indigo-600 transition-colors font-semibold"
            >
              <DownloadIcon className="w-5 h-5" />
              Export Excel
            </button>
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
