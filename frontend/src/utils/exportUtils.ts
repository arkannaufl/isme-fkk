import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';

// Types for export data
export interface ExportData {
  title: string;
  headers: string[];
  data: any[][];
  summary?: {
    total: number;
    average?: number;
    percentage?: number;
  };
}

export interface ReportConfig {
  filename: string;
  sheetName?: string;
  orientation?: 'portrait' | 'landscape';
  includeCharts?: boolean;
  includeSummary?: boolean;
}

// Excel Export Functions
export const exportToExcel = async (
  exportData: ExportData,
  config: ReportConfig
): Promise<void> => {
  try {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet(config.sheetName || 'Report');

    // Add title
    const titleRow = worksheet.addRow([exportData.title]);
    titleRow.font = { bold: true, size: 16, color: { argb: 'FF2E75B6' } };
    titleRow.alignment = { horizontal: 'center' };
    worksheet.mergeCells(`A1:${String.fromCharCode(65 + exportData.headers.length - 1)}1`);

    // Add headers
    const headerRow = worksheet.addRow(exportData.headers);
    headerRow.font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4472C4' }
    };
    headerRow.alignment = { horizontal: 'center' };

    // Add data
    exportData.data.forEach(row => {
      worksheet.addRow(row);
    });

    // Auto-fit columns
    worksheet.columns.forEach(column => {
      if (column.values) {
        const maxLength = Math.max(
          ...column.values.map(cell => 
            cell ? cell.toString().length : 0
          )
        );
        column.width = Math.min(Math.max(maxLength + 2, 10), 50);
      }
    });

    // Add summary if provided
    if (exportData.summary && config.includeSummary) {
      worksheet.addRow([]); // Empty row
      const summaryRow = worksheet.addRow(['Summary']);
      summaryRow.font = { bold: true, size: 14, color: { argb: 'FF2E75B6' } };
      
      if (exportData.summary.total !== undefined) {
        worksheet.addRow(['Total Records:', exportData.summary.total]);
      }
      if (exportData.summary.average !== undefined) {
        worksheet.addRow(['Average:', exportData.summary.average.toFixed(2)]);
      }
      if (exportData.summary.percentage !== undefined) {
        worksheet.addRow(['Percentage:', `${exportData.summary.percentage.toFixed(2)}%`]);
      }
    }

     // Add borders
     worksheet.eachRow((row) => {
       row.eachCell((cell) => {
         cell.border = {
           top: { style: 'thin' },
           left: { style: 'thin' },
           bottom: { style: 'thin' },
           right: { style: 'thin' }
         };
       });
     });

    // Generate and download
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    saveAs(blob, `${config.filename}.xlsx`);

  } catch (error) {
    console.error('Error exporting to Excel:', error);
    throw new Error('Failed to export Excel file');
  }
};

// PDF Export Functions
export const exportToPDF = (
  exportData: ExportData,
  config: ReportConfig
): void => {
  try {
    const doc = new jsPDF(config.orientation || 'portrait');
    
    // Set document properties
    doc.setProperties({
      title: exportData.title,
      subject: 'Academic Report',
      author: 'UMJ Academic System',
      creator: 'UMJ Academic System'
    });

    // Add header
    doc.setFontSize(20);
    doc.setTextColor(44, 62, 80);
    doc.text('UNIVERSITAS MUHAMMADIYAH JAKARTA', 105, 20, { align: 'center' });
    
    doc.setFontSize(16);
    doc.setTextColor(52, 73, 94);
    doc.text(exportData.title, 105, 35, { align: 'center' });

    // Add timestamp
    doc.setFontSize(10);
    doc.setTextColor(127, 140, 141);
    doc.text(`Generated on: ${new Date().toLocaleString('id-ID')}`, 20, 50);

         // Add table
     autoTable(doc, {
       head: [exportData.headers],
       body: exportData.data,
       startY: 60,
       styles: {
         fontSize: 10,
         cellPadding: 3
       },
       headStyles: {
         fillColor: [68, 114, 196],
         textColor: [255, 255, 255],
         fontStyle: 'bold'
       },
       margin: { top: 60 }
     });

    // Add summary if provided
    if (exportData.summary && config.includeSummary) {
      const finalY = (doc as any).lastAutoTable.finalY || 60;
      doc.setFontSize(12);
      doc.setTextColor(52, 73, 94);
      doc.text('Summary', 20, finalY + 20);
      
      let yPos = finalY + 30;
      if (exportData.summary.total !== undefined) {
        doc.text(`Total Records: ${exportData.summary.total}`, 20, yPos);
        yPos += 10;
      }
      if (exportData.summary.average !== undefined) {
        doc.text(`Average: ${exportData.summary.average.toFixed(2)}`, 20, yPos);
        yPos += 10;
      }
      if (exportData.summary.percentage !== undefined) {
        doc.text(`Percentage: ${exportData.summary.percentage.toFixed(2)}%`, 20, yPos);
      }
    }

    // Add footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(127, 140, 141);
      doc.text(`Page ${i} of ${pageCount}`, 105, doc.internal.pageSize.height - 10, { align: 'center' });
    }

    // Save PDF
    doc.save(`${config.filename}.pdf`);

  } catch (error) {
    console.error('Error exporting to PDF:', error);
    throw new Error('Failed to export PDF file');
  }
};

// Specific Report Generators
export const generateAttendanceReport = (data: any[]): ExportData => {
  const headers = ['NIM', 'Nama', 'Angkatan', 'Semester', 'Total Hadir', 'Total Pertemuan', 'Persentase'];
  
  const reportData = data.map(item => [
    item.nim || '',
    item.nama || '',
    item.angkatan || '',
    item.semester || '',
    item.total_hadir || 0,
    item.total_pertemuan || 0,
    `${((item.total_hadir / (item.total_pertemuan || 1)) * 100).toFixed(1)}%`
  ]);

  const totalHadir = data.reduce((sum, item) => sum + (item.total_hadir || 0), 0);
  const totalPertemuan = data.reduce((sum, item) => sum + (item.total_pertemuan || 0), 0);

  return {
    title: 'Laporan Kehadiran Mahasiswa',
    headers,
    data: reportData,
    summary: {
      total: data.length,
      average: totalHadir / data.length,
      percentage: (totalPertemuan > 0 ? (totalHadir / totalPertemuan) * 100 : 0)
    }
  };
};

export const generateAssessmentReport = (data: any[]): ExportData => {
  const headers = ['NIM', 'Nama', 'Angkatan', 'Semester', 'IPK'];
  
  const reportData = data.map(item => [
    item.nim || '',
    item.nama || '',
    item.angkatan || '',
    item.semester || '',
    item.ipk || 0
  ]);

  const totalIPK = data.reduce((sum, item) => sum + (item.ipk || 0), 0);

  return {
    title: 'Laporan Penilaian Mahasiswa',
    headers,
    data: reportData,
    summary: {
      total: data.length,
      average: totalIPK / data.length
    }
  };
};

export const generateAcademicReport = (data: any[]): ExportData => {
  const headers = ['NIM', 'Nama', 'Angkatan', 'Semester', 'IPK', 'Status', 'Semester Masuk', 'Tahun Ajaran Masuk ID'];
  
  const reportData = data.map(item => [
    item.nim || '',
    item.nama || '',
    item.angkatan || '',
    item.semester || '',
    item.ipk || 0,
    item.status || 'Aktif',
    item.semester_masuk || '',
    item.tahun_ajaran_masuk_id || ''
  ]);

  const totalIPK = data.reduce((sum, item) => sum + (item.ipk || 0), 0);

  return {
    title: 'Laporan Akademik Lengkap',
    headers,
    data: reportData,
    summary: {
      total: data.length,
      average: totalIPK / data.length
    }
  };
};

// Helper functions
const getGrade = (nilai: number): string => {
  if (nilai >= 85) return 'A';
  if (nilai >= 75) return 'B';
  if (nilai >= 65) return 'C';
  if (nilai >= 50) return 'D';
  return 'E';
};

const getStatus = (nilai: number): string => {
  if (nilai >= 65) return 'Lulus';
  return 'Tidak Lulus';
};

// Export multiple formats
export const exportMultipleFormats = async (
  exportData: ExportData,
  config: ReportConfig,
  formats: ('excel' | 'pdf')[]
): Promise<void> => {
  try {
    for (const format of formats) {
      if (format === 'excel') {
        await exportToExcel(exportData, config);
      } else if (format === 'pdf') {
        exportToPDF(exportData, config);
      }
    }
  } catch (error) {
    console.error('Error exporting multiple formats:', error);
    throw new Error('Failed to export files');
  }
};
