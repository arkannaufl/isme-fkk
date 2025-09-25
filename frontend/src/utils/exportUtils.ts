import ExcelJS from "exceljs";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { saveAs } from "file-saver";

// Types for export data
export interface ExportData {
  title: string;
  headers: string[];
  data: any[][];
  summary?: {
    total: number;
    average?: number;
    percentage?: number;
    // Additional statistics for attendance report
    statusBaik?: number;
    statusCukup?: number;
    statusKurang?: number;
    // Additional statistics for assessment report
    gradeDistribution?: {
      A: number;
      A_: number;
      B_: number;
      B: number;
      B_minus: number;
      C_: number;
      C: number;
      D: number;
      E: number;
    };
    lulus?: number;
    tidakLulus?: number;
    maxIPK?: number;
    minIPK?: number;
  };
}

export interface ReportConfig {
  filename: string;
  sheetName?: string;
  orientation?: "portrait" | "landscape";
  includeCharts?: boolean;
  includeSummary?: boolean;
  includeMetadata?: boolean;
}

// Helper function to add metadata sheet
const addMetadataSheet = (worksheet: any, exportData: ExportData, config: ReportConfig) => {
  // University header
  const universityRow = worksheet.addRow(["UNIVERSITAS MUHAMMADIYAH JAKARTA"]);
  universityRow.font = { bold: true, size: 16, color: { argb: "FF1F4E79" } };
  universityRow.alignment = { horizontal: "center" };
  worksheet.mergeCells("A1:D1");

  const facultyRow = worksheet.addRow(["FAKULTAS KEDOKTERAN"]);
  facultyRow.font = { bold: true, size: 14, color: { argb: "FF2E75B6" } };
  facultyRow.alignment = { horizontal: "center" };
  worksheet.mergeCells("A2:D2");

  // Empty row
  worksheet.addRow([]);

  // Report information
  const infoTitleRow = worksheet.addRow(["INFORMASI LAPORAN"]);
  infoTitleRow.font = { bold: true, size: 12, color: { argb: "FF1F4E79" } };
  infoTitleRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7F3FF" },
  };
  worksheet.mergeCells("A4:D4");

  // Report details
  const details = [
    ["Judul Laporan:", exportData.title],
    ["Tanggal Dibuat:", new Date().toLocaleDateString('id-ID', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    })],
    ["Waktu Dibuat:", new Date().toLocaleTimeString('id-ID')],
    ["Jumlah Data:", exportData.data.length],
    ["Format File:", "Microsoft Excel (.xlsx)"],
    ["Dibuat Oleh:", "Sistem Akademik UMJ"],
    ["Versi Sistem:", "1.0.0"],
    ["Status:", "Resmi"]
  ];

  details.forEach(([label, value], index) => {
    const row = worksheet.addRow([label, value]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { horizontal: "left" };
  });

  // Empty row
  worksheet.addRow([]);

  // Column information
  const columnTitleRow = worksheet.addRow(["INFORMASI KOLOM"]);
  columnTitleRow.font = { bold: true, size: 12, color: { argb: "FF1F4E79" } };
  columnTitleRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7F3FF" },
  };
  worksheet.mergeCells(`A${details.length + 6}:D${details.length + 6}`);

  // Column descriptions
  const columnDescriptions = [
    ["No", "Nomor urut data"],
    ["NIM", "Nomor Induk Mahasiswa"],
    ["Nama Lengkap", "Nama lengkap mahasiswa"],
    ["Angkatan", "Tahun masuk mahasiswa"],
    ["Semester", "Semester saat ini"],
    ["Total Hadir", "Jumlah kehadiran (untuk laporan absensi)"],
    ["Total Pertemuan", "Total pertemuan yang dijadwalkan"],
    ["Persentase Kehadiran", "Persentase kehadiran mahasiswa"],
    ["Status", "Status berdasarkan kriteria yang ditetapkan"],
    ["Keterangan", "Penjelasan tambahan"],
    ["IPK", "Indeks Prestasi Kumulatif"],
    ["Nilai Jurnal", "Nilai untuk komponen jurnal"],
    ["Nilai PBL", "Nilai untuk komponen Problem Based Learning"],
    ["Nilai Akhir", "Nilai akhir yang dihitung"],
    ["Grade", "Huruf mutu berdasarkan nilai akhir"],
    ["Status IPK", "Kategori IPK mahasiswa"]
  ];

  columnDescriptions.forEach(([column, description], index) => {
    const row = worksheet.addRow([column, description]);
    row.getCell(1).font = { bold: true };
    row.getCell(2).alignment = { horizontal: "left" };
  });

  // Auto-fit columns
  worksheet.columns = [
    { width: 20 },
    { width: 40 },
    { width: 20 },
    { width: 20 }
  ];

  // Add borders
  const dataRange = `A1:D${details.length + columnDescriptions.length + 6}`;
  worksheet.getCell(dataRange).border = {
    top: { style: "thin" },
    left: { style: "thin" },
    bottom: { style: "thin" },
    right: { style: "thin" },
  };
};

// Helper function to add charts to worksheet
const addChartsToWorksheet = (worksheet: any, exportData: ExportData, config: ReportConfig) => {
  try {
    // Add chart for attendance status distribution
    if (exportData.summary?.statusBaik !== undefined) {
      const chartRow = worksheet.rowCount + 2;
      
      // Add chart title
      const chartTitleRow = worksheet.addRow(["GRAFIK DISTRIBUSI STATUS KEHADIRAN"]);
      chartTitleRow.font = { bold: true, size: 12, color: { argb: "FF1F4E79" } };
      chartTitleRow.alignment = { horizontal: "center" };
      worksheet.mergeCells(`A${chartRow}:D${chartRow}`);
      
      // Add pie chart
      worksheet.addChart({
        type: 'pie',
        name: 'Status Kehadiran',
        title: 'Distribusi Status Kehadiran Mahasiswa',
        position: {
          type: 'absolute',
          x: 20,
          y: (chartRow + 1) * 20,
        },
        size: {
          width: 400,
          height: 300,
        },
        series: [
          {
            name: 'Status Kehadiran',
            categories: ['Baik (≥80%)', 'Cukup (60-79%)', 'Kurang (<60%)'],
            values: [
              exportData.summary.statusBaik || 0,
              exportData.summary.statusCukup || 0,
              exportData.summary.statusKurang || 0
            ],
          },
        ],
      });
    }

    // Add chart for grade distribution
    if (exportData.summary?.gradeDistribution) {
      const chartRow = worksheet.rowCount + 2;
      
      // Add chart title
      const chartTitleRow = worksheet.addRow(["GRAFIK DISTRIBUSI GRADE"]);
      chartTitleRow.font = { bold: true, size: 12, color: { argb: "FF1F4E79" } };
      chartTitleRow.alignment = { horizontal: "center" };
      worksheet.mergeCells(`A${chartRow}:D${chartRow}`);
      
      const gradeDist = exportData.summary.gradeDistribution;
      const gradeLabels = ['A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'D', 'E'];
      const gradeValues = [
        gradeDist.A, gradeDist.A_, gradeDist.B_, gradeDist.B, 
        gradeDist.B_minus, gradeDist.C_, gradeDist.C, gradeDist.D, gradeDist.E
      ];
      
      // Add bar chart
      worksheet.addChart({
        type: 'bar',
        name: 'Distribusi Grade',
        title: 'Distribusi Grade Mahasiswa',
        position: {
          type: 'absolute',
          x: 450,
          y: (chartRow + 1) * 20,
        },
        size: {
          width: 400,
          height: 300,
        },
        series: [
          {
            name: 'Jumlah Mahasiswa',
            categories: gradeLabels,
            values: gradeValues,
          },
        ],
      });
    }
  } catch (error) {
    console.warn("Error adding charts:", error);
    // Continue without charts if there's an error
  }
};

// Excel Export Functions
export const exportToExcel = async (
  exportData: ExportData,
  config: ReportConfig
): Promise<void> => {
  try {
    const workbook = new ExcelJS.Workbook();
    
    // Set workbook properties
    workbook.creator = "UMJ Academic System";
    workbook.lastModifiedBy = "UMJ Academic System";
    workbook.created = new Date();
    workbook.modified = new Date();
    workbook.lastPrinted = new Date();
    workbook.properties.date1904 = false;

    // Create metadata sheet first if requested
    if (config.includeMetadata) {
      const metadataSheet = workbook.addWorksheet("Metadata");
      addMetadataSheet(metadataSheet, exportData, config);
    }

    // Create main report sheet
    const worksheet = workbook.addWorksheet(config.sheetName || "Report");

    // Add university header
    const universityRow1 = worksheet.addRow(["UNIVERSITAS MUHAMMADIYAH JAKARTA"]);
    universityRow1.font = { bold: true, size: 18, color: { argb: "FF1F4E79" } };
    universityRow1.alignment = { horizontal: "center" };
    worksheet.mergeCells(`A1:${String.fromCharCode(65 + exportData.headers.length - 1)}1`);

    const facultyRow = worksheet.addRow(["FAKULTAS KEDOKTERAN"]);
    facultyRow.font = { bold: true, size: 16, color: { argb: "FF2E75B6" } };
    facultyRow.alignment = { horizontal: "center" };
    worksheet.mergeCells(`A2:${String.fromCharCode(65 + exportData.headers.length - 1)}2`);

    // Add report title
    const titleRow = worksheet.addRow([exportData.title]);
    titleRow.font = { bold: true, size: 14, color: { argb: "FF2E75B6" } };
    titleRow.alignment = { horizontal: "center" };
    worksheet.mergeCells(`A3:${String.fromCharCode(65 + exportData.headers.length - 1)}3`);

    // Add report metadata
    const metadataRow1 = worksheet.addRow([
      `Tanggal Laporan: ${new Date().toLocaleDateString('id-ID', { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })}`
    ]);
    metadataRow1.font = { size: 10, color: { argb: "FF666666" } };
    metadataRow1.alignment = { horizontal: "center" };
    worksheet.mergeCells(`A4:${String.fromCharCode(65 + exportData.headers.length - 1)}4`);

    const metadataRow2 = worksheet.addRow([
      `Dibuat oleh: Sistem Akademik UMJ | Waktu: ${new Date().toLocaleTimeString('id-ID')}`
    ]);
    metadataRow2.font = { size: 9, color: { argb: "FF999999" } };
    metadataRow2.alignment = { horizontal: "center" };
    worksheet.mergeCells(`A5:${String.fromCharCode(65 + exportData.headers.length - 1)}5`);

    // Empty row for spacing
    worksheet.addRow([]);

    // Add headers with professional styling
    const headerRow = worksheet.addRow(exportData.headers);
    headerRow.font = { bold: true, size: 11, color: { argb: "FFFFFFFF" } };
    headerRow.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F4E79" }, // Dark blue header
    };
    headerRow.alignment = { 
      horizontal: "center", 
      vertical: "middle",
      wrapText: true 
    };
    headerRow.height = 25;

    // Add data with alternating row colors and conditional formatting
    exportData.data.forEach((row, index) => {
      const dataRow = worksheet.addRow(row);
      
      // Alternating row colors
      if (index % 2 === 0) {
        dataRow.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FFF8F9FA" }, // Light gray
        };
      }
      
      // Center align numeric columns
      dataRow.eachCell((cell, colNumber) => {
        if (colNumber > 2) { // Skip NIM and Nama columns
          cell.alignment = { horizontal: "center", vertical: "middle" };
        } else {
          cell.alignment = { vertical: "middle" };
        }
      });
      
      // Conditional formatting for status columns
      const statusColumnIndex = exportData.headers.findIndex(header => 
        header.toLowerCase().includes('status') || header.toLowerCase().includes('grade')
      );
      
      if (statusColumnIndex !== -1) {
        const statusCell = dataRow.getCell(statusColumnIndex + 1);
        const statusValue = statusCell.value?.toString().toLowerCase();
        
        if (statusValue?.includes('kurang') || statusValue?.includes('tidak lulus') || statusValue === 'e') {
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFE6E6" }, // Light red
          };
        } else if (statusValue?.includes('cukup') || statusValue?.includes('d')) {
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFFFF2CC" }, // Light yellow
          };
        } else if (statusValue?.includes('baik') || statusValue?.includes('a') || statusValue?.includes('b')) {
          statusCell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "FFE6F7E6" }, // Light green
          };
        }
      }
      
      dataRow.height = 20;
    });

    // Auto-fit columns with better sizing
    worksheet.columns.forEach((column, index) => {
      if (column.values) {
        const maxLength = Math.max(
          ...column.values.map((cell) => (cell ? cell.toString().length : 0))
        );
        
        // Set specific widths for different column types
        if (index === 0) { // NIM column
          column.width = 15;
        } else if (index === 1) { // Nama column
          column.width = 25;
        } else if (index === 2) { // Angkatan column
          column.width = 10;
        } else if (index === 3) { // Semester column
          column.width = 10;
        } else {
          // Other columns
          column.width = Math.min(Math.max(maxLength + 2, 12), 20);
        }
      }
    });

    // Add professional borders
    const dataRange = `A6:${String.fromCharCode(65 + exportData.headers.length - 1)}${6 + exportData.data.length}`;
    worksheet.getCell(dataRange).border = {
      top: { style: "medium" },
      left: { style: "medium" },
      bottom: { style: "medium" },
      right: { style: "medium" },
    };

    // Add borders to all cells
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 6) { // Data rows
        row.eachCell((cell) => {
          cell.border = {
            top: { style: "thin", color: { argb: "FFCCCCCC" } },
            left: { style: "thin", color: { argb: "FFCCCCCC" } },
            bottom: { style: "thin", color: { argb: "FFCCCCCC" } },
            right: { style: "thin", color: { argb: "FFCCCCCC" } },
          };
        });
      }
    });

    // Add summary section if provided
    if (exportData.summary && config.includeSummary) {
      const summaryStartRow = 7 + exportData.data.length;
      
      // Empty row
      worksheet.addRow([]);
      
      // Summary title
      const summaryTitleRow = worksheet.addRow(["RINGKASAN LAPORAN"]);
      summaryTitleRow.font = { bold: true, size: 12, color: { argb: "FF1F4E79" } };
      summaryTitleRow.alignment = { horizontal: "center" };
      summaryTitleRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FFE7F3FF" },
      };
      worksheet.mergeCells(`A${summaryStartRow + 1}:${String.fromCharCode(65 + exportData.headers.length - 1)}${summaryStartRow + 1}`);

      // Summary data
      let summaryRowIndex = summaryStartRow + 2;

      if (exportData.summary.total !== undefined) {
        const totalRow = worksheet.addRow(["Jumlah Mahasiswa:", exportData.summary.total]);
        totalRow.getCell(1).font = { bold: true };
        totalRow.getCell(2).alignment = { horizontal: "center" };
        summaryRowIndex++;
      }
      
      if (exportData.summary.average !== undefined) {
        const avgRow = worksheet.addRow(["Rata-rata:", exportData.summary.average.toFixed(2)]);
        avgRow.getCell(1).font = { bold: true };
        avgRow.getCell(2).alignment = { horizontal: "center" };
        summaryRowIndex++;
      }
      
      if (exportData.summary.percentage !== undefined) {
        const percentageRow = worksheet.addRow(["Persentase:", `${exportData.summary.percentage.toFixed(2)}%`]);
        percentageRow.getCell(1).font = { bold: true };
        percentageRow.getCell(2).alignment = { horizontal: "center" };
        summaryRowIndex++;
      }

      // Additional statistics for attendance report
      if (exportData.summary.statusBaik !== undefined) {
        const statusBaikRow = worksheet.addRow(["Status Baik (≥80%):", exportData.summary.statusBaik]);
        statusBaikRow.getCell(1).font = { bold: true };
        statusBaikRow.getCell(2).alignment = { horizontal: "center" };
        summaryRowIndex++;
      }

      if (exportData.summary.statusCukup !== undefined) {
        const statusCukupRow = worksheet.addRow(["Status Cukup (60-79%):", exportData.summary.statusCukup]);
        statusCukupRow.getCell(1).font = { bold: true };
        statusCukupRow.getCell(2).alignment = { horizontal: "center" };
        summaryRowIndex++;
      }

      if (exportData.summary.statusKurang !== undefined) {
        const statusKurangRow = worksheet.addRow(["Status Kurang (<60%):", exportData.summary.statusKurang]);
        statusKurangRow.getCell(1).font = { bold: true };
        statusKurangRow.getCell(2).alignment = { horizontal: "center" };
        summaryRowIndex++;
      }

      // Additional statistics for assessment report
      if (exportData.summary.lulus !== undefined) {
        const lulusRow = worksheet.addRow(["Jumlah Lulus:", exportData.summary.lulus]);
        lulusRow.getCell(1).font = { bold: true };
        lulusRow.getCell(2).alignment = { horizontal: "center" };
        summaryRowIndex++;
      }

      if (exportData.summary.tidakLulus !== undefined) {
        const tidakLulusRow = worksheet.addRow(["Jumlah Tidak Lulus:", exportData.summary.tidakLulus]);
        tidakLulusRow.getCell(1).font = { bold: true };
        tidakLulusRow.getCell(2).alignment = { horizontal: "center" };
        summaryRowIndex++;
      }

      if (exportData.summary.maxIPK !== undefined) {
        const maxIPKRow = worksheet.addRow(["IPK Tertinggi:", exportData.summary.maxIPK.toFixed(2)]);
        maxIPKRow.getCell(1).font = { bold: true };
        maxIPKRow.getCell(2).alignment = { horizontal: "center" };
        summaryRowIndex++;
      }

      if (exportData.summary.minIPK !== undefined) {
        const minIPKRow = worksheet.addRow(["IPK Terendah:", exportData.summary.minIPK.toFixed(2)]);
        minIPKRow.getCell(1).font = { bold: true };
        minIPKRow.getCell(2).alignment = { horizontal: "center" };
        summaryRowIndex++;
      }

      // Grade distribution for assessment report
      if (exportData.summary.gradeDistribution) {
        const gradeDist = exportData.summary.gradeDistribution;
        worksheet.addRow([]); // Empty row
        const gradeTitleRow = worksheet.addRow(["Distribusi Grade:"]);
        gradeTitleRow.getCell(1).font = { bold: true, size: 11 };
        summaryRowIndex += 2;

        const gradeRows = [
          ["A (≥85):", gradeDist.A],
          ["A- (80-84):", gradeDist.A_],
          ["B+ (75-79):", gradeDist.B_],
          ["B (70-74):", gradeDist.B],
          ["B- (65-69):", gradeDist.B_minus],
          ["C+ (60-64):", gradeDist.C_],
          ["C (55-59):", gradeDist.C],
          ["D (50-54):", gradeDist.D],
          ["E (<50):", gradeDist.E]
        ];

        gradeRows.forEach(([grade, count]) => {
          const gradeRow = worksheet.addRow([grade, count]);
          gradeRow.getCell(1).font = { bold: true };
          gradeRow.getCell(2).alignment = { horizontal: "center" };
          summaryRowIndex++;
        });
      }

      // Add borders to summary section
      const summaryRange = `A${summaryStartRow + 1}:${String.fromCharCode(65 + exportData.headers.length - 1)}${summaryRowIndex - 1}`;
      worksheet.getCell(summaryRange).border = {
        top: { style: "medium" },
        left: { style: "medium" },
        bottom: { style: "medium" },
        right: { style: "medium" },
      };
    }

    // Add footer with university info
    const footerRow = worksheet.addRow([
      "Laporan ini dibuat secara otomatis oleh Sistem Akademik Universitas Muhammadiyah Jakarta"
    ]);
    footerRow.font = { size: 8, color: { argb: "FF999999" }, italic: true };
    footerRow.alignment = { horizontal: "center" };
    worksheet.mergeCells(`A${worksheet.rowCount}:${String.fromCharCode(65 + exportData.headers.length - 1)}${worksheet.rowCount}`);

    // Add filters to header row
    worksheet.autoFilter = {
      from: 'A6',
      to: `${String.fromCharCode(65 + exportData.headers.length - 1)}${6 + exportData.data.length}`,
    };

    // Freeze panes at header row
    worksheet.views = [
      {
        state: 'frozen',
        xSplit: 0,
        ySplit: 6, // Freeze at row 6 (header row)
        topLeftCell: 'A7'
      }
    ];

    // Set page setup for printing
    worksheet.pageSetup = {
      orientation: config.orientation || "landscape",
      paperSize: 9, // A4
      margins: {
        left: 0.7,
        right: 0.7,
        top: 0.75,
        bottom: 0.75,
        header: 0.3,
        footer: 0.3,
      },
      printTitlesRow: "6:6", // Repeat header row
      printArea: `A1:${String.fromCharCode(65 + exportData.headers.length - 1)}${6 + exportData.data.length + 20}`, // Include summary
    };

    // Add charts if requested
    if (config.includeCharts && exportData.summary) {
      addChartsToWorksheet(worksheet, exportData, config);
    }

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    });
    saveAs(blob, `${config.filename}.xlsx`);
  } catch (error) {
    console.error("Error exporting to Excel:", error);
    throw new Error("Failed to export Excel file");
  }
};

// PDF Export Functions
export const exportToPDF = (
  exportData: ExportData,
  config: ReportConfig
): void => {
  try {
    const doc = new jsPDF(config.orientation || "landscape", "mm", "a4");

    // Set document properties
    doc.setProperties({
      title: exportData.title,
      subject: "Laporan Akademik - Fakultas Kedokteran UMJ",
      author: "Sistem Akademik UMJ",
      creator: "Sistem Akademik UMJ",
      keywords: "laporan, akademik, kedokteran, umj, mahasiswa",
      producer: "Sistem Akademik UMJ v1.0.0"
    });

    // Add professional header with university branding
    addPDFHeader(doc, exportData);
    
    // Add report content
    addPDFContent(doc, exportData, config);
    
    // Add professional footer
    addPDFFooter(doc);

    // Save PDF
    doc.save(`${config.filename}.pdf`);
  } catch (error) {
    console.error("Error exporting to PDF:", error);
    throw new Error("Failed to export PDF file");
  }
};

// Helper function to add professional PDF header
const addPDFHeader = (doc: any, exportData: ExportData) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // University header background
  doc.setFillColor(31, 78, 121); // Dark blue
  doc.rect(0, 0, pageWidth, 25, 'F');
  
  // University name
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("UNIVERSITAS MUHAMMADIYAH JAKARTA", pageWidth / 2, 12, { align: "center" });
  
  // Faculty name
  doc.setFontSize(14);
  doc.setTextColor(46, 117, 182); // Light blue
  doc.setFont("helvetica", "bold");
  doc.text("FAKULTAS KEDOKTERAN", pageWidth / 2, 18, { align: "center" });
  
  // Report title
  doc.setFillColor(231, 243, 255); // Light blue background
  doc.rect(0, 25, pageWidth, 15, 'F');

    doc.setFontSize(16);
  doc.setTextColor(31, 78, 121);
  doc.setFont("helvetica", "bold");
  doc.text(exportData.title, pageWidth / 2, 35, { align: "center" });

  // Report metadata
    doc.setFontSize(10);
  doc.setTextColor(102, 102, 102);
  doc.setFont("helvetica", "normal");
  
  const currentDate = new Date();
  const dateStr = currentDate.toLocaleDateString('id-ID', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const timeStr = currentDate.toLocaleTimeString('id-ID');
  
  doc.text(`Tanggal Laporan: ${dateStr}`, 20, 45);
  doc.text(`Waktu: ${timeStr}`, 20, 50);
  doc.text(`Dibuat oleh: Sistem Akademik UMJ`, pageWidth - 20, 45, { align: "right" });
  doc.text(`Jumlah Data: ${exportData.data.length}`, pageWidth - 20, 50, { align: "right" });
  
  // Separator line
  doc.setDrawColor(31, 78, 121);
  doc.setLineWidth(0.5);
  doc.line(20, 55, pageWidth - 20, 55);
};

// Helper function to add PDF content
const addPDFContent = (doc: any, exportData: ExportData, config: ReportConfig) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
    // Add professional table
    autoTable(doc, {
      head: [exportData.headers],
      body: exportData.data,
      startY: 65,
      styles: {
        fontSize: 9,
        cellPadding: 2,
        lineColor: [200, 200, 200],
        lineWidth: 0.1,
        textColor: [51, 51, 51],
        font: "helvetica",
        overflow: "linebreak",
        cellWidth: "wrap"
      },
      headStyles: {
        fillColor: [31, 78, 121],
        textColor: [255, 255, 255],
        fontStyle: "bold",
        fontSize: 10,
        halign: "center"
      },
      alternateRowStyles: {
        fillColor: [248, 249, 250]
      },
      columnStyles: {
        0: { halign: "center", cellWidth: 15 }, // No
        1: { halign: "center", cellWidth: 20 }, // NIM
        2: { halign: "left", cellWidth: 35 },   // Nama
        3: { halign: "center", cellWidth: 15 }, // Angkatan
        4: { halign: "center", cellWidth: 15 }, // Semester
      },
      margin: { left: 20, right: 20 },
      tableWidth: "auto",
      showHead: "everyPage",
      pageBreak: "auto",
      rowPageBreak: "avoid",
      didDrawPage: (data: any) => {
        // Add header on each page
        addPDFHeader(doc, exportData);
      },
      didParseCell: (data: any) => {
        // Handle long text in cells
        if (data.cell.text && data.cell.text.length > 30) {
          data.cell.text = data.cell.text.substring(0, 27) + "...";
        }
      }
    });

  // Add summary section
    if (exportData.summary && config.includeSummary) {
    addPDFSummary(doc, exportData, config);
  }
  
  // Add charts if requested
  if (config.includeCharts && exportData.summary) {
    addPDFCharts(doc, exportData, config);
  }
};

// Helper function to add PDF summary
const addPDFSummary = (doc: any, exportData: ExportData, config: ReportConfig) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const finalY = (doc as any).lastAutoTable.finalY || 65;
  
  // Check if we need a new page for summary
  const summaryHeight = 150; // Estimated height needed for summary
  if (finalY + summaryHeight > pageHeight - 40) {
    doc.addPage();
  }
  
  const startY = finalY + summaryHeight > pageHeight - 40 ? 20 : finalY + 20;
  
  // Summary title
  doc.setFontSize(14);
  doc.setTextColor(31, 78, 121);
  doc.setFont("helvetica", "bold");
  doc.text("RINGKASAN LAPORAN", 20, startY);
  
  // Summary background
  doc.setFillColor(231, 243, 255);
  doc.rect(20, startY + 5, pageWidth - 40, 8, 'F');
  
  let yPos = startY + 15;
  
  // Basic statistics
      if (exportData.summary.total !== undefined) {
    doc.setFontSize(11);
    doc.setTextColor(51, 51, 51);
    doc.setFont("helvetica", "bold");
    doc.text("Jumlah Mahasiswa:", 25, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(exportData.summary.total.toString(), 80, yPos);
    yPos += 8;
  }
  
      if (exportData.summary.average !== undefined) {
    doc.setFont("helvetica", "bold");
    doc.text("Rata-rata:", 25, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(exportData.summary.average.toFixed(2), 80, yPos);
    yPos += 8;
  }
  
      if (exportData.summary.percentage !== undefined) {
    doc.setFont("helvetica", "bold");
    doc.text("Persentase:", 25, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(`${exportData.summary.percentage.toFixed(2)}%`, 80, yPos);
    yPos += 8;
  }
  
  // Additional statistics for attendance report
  if (exportData.summary.statusBaik !== undefined) {
    yPos += 5;
    doc.setFontSize(10);
    doc.setTextColor(31, 78, 121);
    doc.setFont("helvetica", "bold");
    doc.text("Distribusi Status Kehadiran:", 25, yPos);
    yPos += 8;
    
    const statusData = [
      ["Status Baik (≥80%)", exportData.summary.statusBaik],
      ["Status Cukup (60-79%)", exportData.summary.statusCukup || 0],
      ["Status Kurang (<60%)", exportData.summary.statusKurang || 0]
    ];
    
    statusData.forEach(([status, count]) => {
      doc.setFont("helvetica", "normal");
      doc.text(`${status}:`, 30, yPos);
      doc.text(count.toString(), 100, yPos);
      yPos += 6;
    });
  }
  
  // Additional statistics for assessment report
  if (exportData.summary.gradeDistribution) {
    yPos += 5;
    doc.setFontSize(10);
    doc.setTextColor(31, 78, 121);
    doc.setFont("helvetica", "bold");
    doc.text("Distribusi Grade:", 25, yPos);
    yPos += 8;
    
    const gradeDist = exportData.summary.gradeDistribution;
    const gradeData = [
      ["A (≥85)", gradeDist.A],
      ["A- (80-84)", gradeDist.A_],
      ["B+ (75-79)", gradeDist.B_],
      ["B (70-74)", gradeDist.B],
      ["B- (65-69)", gradeDist.B_minus],
      ["C+ (60-64)", gradeDist.C_],
      ["C (55-59)", gradeDist.C],
      ["D (50-54)", gradeDist.D],
      ["E (<50)", gradeDist.E]
    ];
    
    gradeData.forEach(([grade, count]) => {
      doc.setFont("helvetica", "normal");
      doc.text(`${grade}:`, 30, yPos);
      doc.text(count.toString(), 100, yPos);
      yPos += 6;
    });
  }
  
  if (exportData.summary.lulus !== undefined) {
    yPos += 5;
    doc.setFont("helvetica", "bold");
    doc.text("Jumlah Lulus:", 25, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(exportData.summary.lulus.toString(), 80, yPos);
    yPos += 8;
    
    doc.setFont("helvetica", "bold");
    doc.text("Jumlah Tidak Lulus:", 25, yPos);
    doc.setFont("helvetica", "normal");
    doc.text(exportData.summary.tidakLulus?.toString() || "0", 80, yPos);
  }
};

// Helper function to add professional PDF footer
const addPDFFooter = (doc: any) => {
    const pageCount = (doc as any).internal.getNumberOfPages();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
    
    // Footer background
    doc.setFillColor(248, 249, 250);
    doc.rect(0, pageHeight - 20, pageWidth, 20, 'F');
    
    // Footer line
    doc.setDrawColor(31, 78, 121);
    doc.setLineWidth(0.5);
    doc.line(20, pageHeight - 20, pageWidth - 20, pageHeight - 20);
    
    // Page number
    doc.setFontSize(10);
    doc.setTextColor(102, 102, 102);
    doc.setFont("helvetica", "normal");
    doc.text(`Halaman ${i} dari ${pageCount}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    
    // Footer text
      doc.setFontSize(8);
    doc.setTextColor(153, 153, 153);
    doc.text("Laporan ini dibuat secara otomatis oleh Sistem Akademik Universitas Muhammadiyah Jakarta", 20, pageHeight - 5);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, pageWidth - 20, pageHeight - 5, { align: "right" });
  }
};

// Helper function to add PDF charts
const addPDFCharts = (doc: any, exportData: ExportData, config: ReportConfig) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  
  // Check if we need a new page for charts
  const currentY = (doc as any).lastAutoTable?.finalY || 65;
  const chartHeight = 120; // Estimated height needed for charts
  
  if (currentY + chartHeight > pageHeight - 40) {
    doc.addPage();
  }
  
  const startY = currentY + chartHeight > pageHeight - 40 ? 20 : currentY + 20;
  
  // Add chart for attendance status distribution
  if (exportData.summary?.statusBaik !== undefined) {
    addPDFStatusChart(doc, exportData, startY);
  }
  
  // Add chart for grade distribution
  if (exportData.summary?.gradeDistribution) {
    // Check if we need a new page for second chart
    const secondChartY = startY + 60;
    if (secondChartY + 60 > pageHeight - 40) {
      doc.addPage();
      addPDFGradeChart(doc, exportData, 20);
    } else {
      addPDFGradeChart(doc, exportData, secondChartY);
    }
  }
};

// Helper function to add status chart
const addPDFStatusChart = (doc: any, exportData: ExportData, startY: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Chart title
  doc.setFontSize(12);
  doc.setTextColor(31, 78, 121);
  doc.setFont("helvetica", "bold");
  doc.text("GRAFIK DISTRIBUSI STATUS KEHADIRAN", 20, startY);
  
  // Chart background
  doc.setFillColor(248, 249, 250);
  doc.rect(20, startY + 5, pageWidth - 40, 50, 'F');
  
  // Chart border
  doc.setDrawColor(31, 78, 121);
  doc.setLineWidth(0.5);
  doc.rect(20, startY + 5, pageWidth - 40, 50);
  
  // Simple bar chart representation
  const statusData = [
    { label: "Baik", count: exportData.summary.statusBaik || 0, color: [76, 175, 80] },
    { label: "Cukup", count: exportData.summary.statusCukup || 0, color: [255, 193, 7] },
    { label: "Kurang", count: exportData.summary.statusKurang || 0, color: [244, 67, 54] }
  ];
  
  const maxCount = Math.max(...statusData.map(d => d.count));
  const barWidth = (pageWidth - 80) / 3;
  const maxBarHeight = 30;
  
  statusData.forEach((status, index) => {
    const x = 30 + (index * barWidth);
    const barHeight = maxCount > 0 ? (status.count / maxCount) * maxBarHeight : 0;
    const y = startY + 35 + (maxBarHeight - barHeight);
    
    // Draw bar
    doc.setFillColor(status.color[0], status.color[1], status.color[2]);
    doc.rect(x, y, barWidth - 10, barHeight, 'F');
    
    // Draw bar border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.1);
    doc.rect(x, y, barWidth - 10, barHeight);
    
    // Add count label
    doc.setFontSize(8);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(status.count.toString(), x + (barWidth - 10) / 2, y - 2, { align: "center" });
    
    // Add status label
    doc.setFont("helvetica", "normal");
    doc.text(status.label, x + (barWidth - 10) / 2, startY + 50, { align: "center" });
  });
};

// Helper function to add grade chart
const addPDFGradeChart = (doc: any, exportData: ExportData, startY: number) => {
  const pageWidth = doc.internal.pageSize.getWidth();
  
  // Chart title
  doc.setFontSize(12);
  doc.setTextColor(31, 78, 121);
  doc.setFont("helvetica", "bold");
  doc.text("GRAFIK DISTRIBUSI GRADE", 20, startY);
  
  // Chart background
  doc.setFillColor(248, 249, 250);
  doc.rect(20, startY + 5, pageWidth - 40, 50, 'F');
  
  // Chart border
  doc.setDrawColor(31, 78, 121);
  doc.setLineWidth(0.5);
  doc.rect(20, startY + 5, pageWidth - 40, 50);
  
  // Simple bar chart representation
  const gradeDist = exportData.summary.gradeDistribution!;
  const gradeData = [
    { label: "A", count: gradeDist.A, color: [76, 175, 80] },
    { label: "A-", count: gradeDist.A_, color: [139, 195, 74] },
    { label: "B+", count: gradeDist.B_, color: [205, 220, 57] },
    { label: "B", count: gradeDist.B, color: [255, 193, 7] },
    { label: "B-", count: gradeDist.B_minus, color: [255, 152, 0] },
    { label: "C+", count: gradeDist.C_, color: [255, 87, 34] },
    { label: "C", count: gradeDist.C, color: [244, 67, 54] },
    { label: "D", count: gradeDist.D, color: [233, 30, 99] },
    { label: "E", count: gradeDist.E, color: [156, 39, 176] }
  ];
  
  const maxCount = Math.max(...gradeData.map(d => d.count));
  const barWidth = (pageWidth - 80) / gradeData.length;
  const maxBarHeight = 30;
  
  gradeData.forEach((grade, index) => {
    const x = 30 + (index * barWidth);
    const barHeight = maxCount > 0 ? (grade.count / maxCount) * maxBarHeight : 0;
    const y = startY + 35 + (maxBarHeight - barHeight);
    
    // Draw bar
    doc.setFillColor(grade.color[0], grade.color[1], grade.color[2]);
    doc.rect(x, y, barWidth - 2, barHeight, 'F');
    
    // Draw bar border
    doc.setDrawColor(0, 0, 0);
    doc.setLineWidth(0.1);
    doc.rect(x, y, barWidth - 2, barHeight);
    
    // Add count label
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 0);
    doc.setFont("helvetica", "bold");
    doc.text(grade.count.toString(), x + (barWidth - 2) / 2, y - 1, { align: "center" });
    
    // Add grade label
    doc.setFont("helvetica", "normal");
    doc.text(grade.label, x + (barWidth - 2) / 2, startY + 50, { align: "center" });
  });
};

// Specific Report Generators
export const generateAttendanceReport = (
  data: any[],
  mataKuliahKode?: string
): ExportData => {
  const headers = [
    "No",
    "NIM",
    "Nama Lengkap",
    "Angkatan",
    "Semester",
    "Total Hadir",
    "Total Pertemuan",
    "Persentase Kehadiran",
    "Status",
    "Keterangan"
  ];

  const reportData = data.map((item, index) => {
    const persentase = ((item.total_hadir / (item.total_pertemuan || 1)) * 100);
    let status = "";
    let keterangan = "";
    
    if (persentase >= 80) {
      status = "Baik";
      keterangan = "Memenuhi syarat kehadiran";
    } else if (persentase >= 60) {
      status = "Cukup";
      keterangan = "Perlu perhatian";
    } else {
      status = "Kurang";
      keterangan = "Tidak memenuhi syarat kehadiran";
    }

    return [
      index + 1,
    item.nim || "",
    item.nama || "",
    item.angkatan || "",
    item.semester || "",
    item.total_hadir || 0,
    item.total_pertemuan || 0,
      `${persentase.toFixed(1)}%`,
      status,
      keterangan
    ];
  });

  const totalHadir = data.reduce(
    (sum, item) => sum + (item.total_hadir || 0),
    0
  );
  const totalPertemuan = data.reduce(
    (sum, item) => sum + (item.total_pertemuan || 0),
    0
  );
  const rataRataKehadiran = totalPertemuan > 0 ? (totalHadir / totalPertemuan) * 100 : 0;
  
  // Hitung statistik status
  const statusBaik = data.filter(item => {
    const persentase = ((item.total_hadir / (item.total_pertemuan || 1)) * 100);
    return persentase >= 80;
  }).length;
  
  const statusCukup = data.filter(item => {
    const persentase = ((item.total_hadir / (item.total_pertemuan || 1)) * 100);
    return persentase >= 60 && persentase < 80;
  }).length;
  
  const statusKurang = data.filter(item => {
    const persentase = ((item.total_hadir / (item.total_pertemuan || 1)) * 100);
    return persentase < 60;
  }).length;

  return {
    title: mataKuliahKode
      ? `LAPORAN KEHADIRAN MAHASISWA - ${mataKuliahKode}`
      : "LAPORAN KEHADIRAN MAHASISWA",
    headers,
    data: reportData,
    summary: {
      total: data.length,
      average: rataRataKehadiran,
      percentage: rataRataKehadiran,
      // Tambahan statistik untuk laporan kehadiran
      statusBaik: statusBaik,
      statusCukup: statusCukup,
      statusKurang: statusKurang,
    },
  };
};

export const generateAssessmentReport = (
  data: any[],
  mataKuliahKode?: string
): ExportData => {
  // Jika ada filter mata kuliah, tampilkan data penilaian detail
  if (mataKuliahKode) {
    const headers = [
      "No",
      "NIM",
      "Nama Lengkap",
      "Angkatan",
      "Semester",
      "IPK",
      "Nilai Jurnal Keaktifan",
      "Nilai Jurnal Laporan",
      "Rata-rata Jurnal",
      "Nilai PBL A",
      "Nilai PBL B",
      "Nilai PBL C",
      "Nilai PBL D",
      "Nilai PBL E",
      "Nilai PBL F",
      "Nilai PBL G",
      "Rata-rata PBL",
      "Nilai Akhir",
      "Grade",
      "Status"
    ];

    const reportData = data.map((item, index) => {
      const nilaiJurnalKeaktifan = item.nilai_jurnal_keaktifan || 0;
      const nilaiJurnalLaporan = item.nilai_jurnal_laporan || 0;
      const rataJurnal = (nilaiJurnalKeaktifan + nilaiJurnalLaporan) / 2;
      
      const nilaiPBL = [
        item.nilai_pbl_a || 0,
        item.nilai_pbl_b || 0,
        item.nilai_pbl_c || 0,
        item.nilai_pbl_d || 0,
        item.nilai_pbl_e || 0,
        item.nilai_pbl_f || 0,
        item.nilai_pbl_g || 0
      ];
      const rataPBL = nilaiPBL.reduce((sum, nilai) => sum + nilai, 0) / nilaiPBL.length;
      
      const nilaiAkhir = (rataJurnal * 0.3) + (rataPBL * 0.7);
      
      let grade = "";
      let status = "";
      
      if (nilaiAkhir >= 85) {
        grade = "A";
        status = "Sangat Baik";
      } else if (nilaiAkhir >= 80) {
        grade = "A-";
        status = "Baik Sekali";
      } else if (nilaiAkhir >= 75) {
        grade = "B+";
        status = "Baik";
      } else if (nilaiAkhir >= 70) {
        grade = "B";
        status = "Cukup Baik";
      } else if (nilaiAkhir >= 65) {
        grade = "B-";
        status = "Cukup";
      } else if (nilaiAkhir >= 60) {
        grade = "C+";
        status = "Kurang Baik";
      } else if (nilaiAkhir >= 55) {
        grade = "C";
        status = "Kurang";
      } else if (nilaiAkhir >= 50) {
        grade = "D";
        status = "Sangat Kurang";
      } else {
        grade = "E";
        status = "Tidak Lulus";
      }

      return [
        index + 1,
      item.nim || "",
      item.nama || "",
      item.angkatan || "",
      item.semester || "",
        (item.ipk || 0).toFixed(2),
        nilaiJurnalKeaktifan,
        nilaiJurnalLaporan,
        rataJurnal.toFixed(2),
      item.nilai_pbl_a || 0,
      item.nilai_pbl_b || 0,
      item.nilai_pbl_c || 0,
      item.nilai_pbl_d || 0,
      item.nilai_pbl_e || 0,
      item.nilai_pbl_f || 0,
      item.nilai_pbl_g || 0,
        rataPBL.toFixed(2),
        nilaiAkhir.toFixed(2),
        grade,
        status
      ];
    });

    const totalIPK = data.reduce((sum, item) => sum + (item.ipk || 0), 0);
    const rataIPK = totalIPK / data.length;
    
    // Hitung distribusi grade
    const gradeDistribution = {
      A: 0, A_: 0, B_: 0, B: 0, B_minus: 0, C_: 0, C: 0, D: 0, E: 0
    };
    
    data.forEach(item => {
      const nilaiJurnalKeaktifan = item.nilai_jurnal_keaktifan || 0;
      const nilaiJurnalLaporan = item.nilai_jurnal_laporan || 0;
      const rataJurnal = (nilaiJurnalKeaktifan + nilaiJurnalLaporan) / 2;
      
      const nilaiPBL = [
        item.nilai_pbl_a || 0,
        item.nilai_pbl_b || 0,
        item.nilai_pbl_c || 0,
        item.nilai_pbl_d || 0,
        item.nilai_pbl_e || 0,
        item.nilai_pbl_f || 0,
        item.nilai_pbl_g || 0
      ];
      const rataPBL = nilaiPBL.reduce((sum, nilai) => sum + nilai, 0) / nilaiPBL.length;
      
      const nilaiAkhir = (rataJurnal * 0.3) + (rataPBL * 0.7);
      
      if (nilaiAkhir >= 85) gradeDistribution.A++;
      else if (nilaiAkhir >= 80) gradeDistribution.A_++;
      else if (nilaiAkhir >= 75) gradeDistribution.B_++;
      else if (nilaiAkhir >= 70) gradeDistribution.B++;
      else if (nilaiAkhir >= 65) gradeDistribution.B_minus++;
      else if (nilaiAkhir >= 60) gradeDistribution.C_++;
      else if (nilaiAkhir >= 55) gradeDistribution.C++;
      else if (nilaiAkhir >= 50) gradeDistribution.D++;
      else gradeDistribution.E++;
    });

    return {
      title: `LAPORAN PENILAIAN MAHASISWA - ${mataKuliahKode}`,
      headers,
      data: reportData,
      summary: {
        total: data.length,
        average: rataIPK,
        gradeDistribution: gradeDistribution,
        lulus: data.length - gradeDistribution.E,
        tidakLulus: gradeDistribution.E
      },
    };
  } else {
    // Jika tidak ada filter mata kuliah, tampilkan data umum
    const headers = [
      "No",
      "NIM", 
      "Nama Lengkap", 
      "Angkatan", 
      "Semester", 
      "IPK",
      "Status IPK"
    ];

    const reportData = data.map((item, index) => {
      const ipk = item.ipk || 0;
      let statusIPK = "";
      
      if (ipk >= 3.5) {
        statusIPK = "Cum Laude";
      } else if (ipk >= 3.0) {
        statusIPK = "Sangat Memuaskan";
      } else if (ipk >= 2.5) {
        statusIPK = "Memuaskan";
      } else if (ipk >= 2.0) {
        statusIPK = "Cukup";
      } else {
        statusIPK = "Kurang";
      }

      return [
        index + 1,
      item.nim || "",
      item.nama || "",
      item.angkatan || "",
      item.semester || "",
        ipk.toFixed(2),
        statusIPK
      ];
    });

    const totalIPK = data.reduce((sum, item) => sum + (item.ipk || 0), 0);
    const rataIPK = totalIPK / data.length;

    return {
      title: "LAPORAN PENILAIAN MAHASISWA",
      headers,
      data: reportData,
      summary: {
        total: data.length,
        average: rataIPK,
        maxIPK: Math.max(...data.map(item => item.ipk || 0)),
        minIPK: Math.min(...data.map(item => item.ipk || 0))
      },
    };
  }
};

// Export multiple formats
export const exportMultipleFormats = async (
  exportData: ExportData,
  config: ReportConfig,
  formats: ("excel" | "pdf")[]
): Promise<void> => {
  try {
    for (const format of formats) {
      if (format === "excel") {
        await exportToExcel(exportData, config);
      } else if (format === "pdf") {
        exportToPDF(exportData, config);
      }
    }
  } catch (error) {
    console.error("Error exporting multiple formats:", error);
    throw new Error("Failed to export files");
  }
};