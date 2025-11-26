import { useState, ChangeEvent, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPenToSquare, faTrash, faFileExcel, faDownload } from "@fortawesome/free-solid-svg-icons";
import { AnimatePresence, motion } from "framer-motion";
import api, { handleApiError } from "../utils/api";
import { EyeIcon, EyeCloseIcon } from "../icons";
import * as XLSX from 'xlsx';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

type UserTimAkademik = {
  id?: number;
  nip: string;
  name: string;
  username: string;
  email: string;
  telp: string;
  ket: string;
  password?: string;
  role?: string;
};

export default function TimAkademik() {
  const [data, setData] = useState<UserTimAkademik[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<UserTimAkademik>({ nip: "", name: "", username: "", email: "", telp: "", ket: "", password: "", role: "tim_akademik" });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteNip, setSelectedDeleteNip] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);
  const previewTotalPages = Math.ceil(previewData.length / previewPageSize);
  const paginatedPreviewData = previewData.slice((previewPage - 1) * previewPageSize, previewPage * previewPageSize);
  const [editingCell, setEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [cellErrors, setCellErrors] = useState<{row: number, field: string, message: string, nip?: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [showDeleteModalBulk, setShowDeleteModalBulk] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

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
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  useEffect(() => {
    if (importedCount > 0) {
      const timer = setTimeout(() => {
        setImportedCount(0);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [importedCount]);

  useEffect(() => {
    setLoading(true);
    api.get("/users?role=tim_akademik").then(res => {
      setData(res.data);
      setLoading(false);
    }).catch(() => {
      setError("Gagal memuat data");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    if (importedFile && previewData.length > 0) {
      const validationResult = validateExcelData(previewData, data);
      setValidationErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors);
    }
  }, [previewData, data]);

  // Filter & Search
  const filteredData = data.filter((t) => {
    const q = search.toLowerCase();
    // Gabungkan semua value dari objek menjadi satu string
    const allValues = Object.values(t).join(' ').toLowerCase();
    return allValues.includes(q);
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (["nip", "telp"].includes(name)) {
      setForm({ ...form, [name]: value.replace(/[^0-9]/g, "") });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  function handleNumberInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) return;
    if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) return;
    if (!/^[0-9]$/.test(e.key)) e.preventDefault();
  }

  const handleAdd = async () => {
    setIsSaving(true);
    setError("");
    try {
      let payload = { ...form };
      if (editMode) {
        if (!payload.password) delete payload.password;
        await api.put(`/users/${form.id}`, payload);
        setSuccess("Data tim akademik berhasil diupdate.");
      } else {
        if (!payload.password) {
          setError("Password wajib diisi.");
          setIsSaving(false);
          return;
        }
        payload.role = 'tim_akademik';
        await api.post("/users", payload);
        setSuccess("Data tim akademik berhasil ditambahkan.");
      }
      const res = await api.get("/users?role=tim_akademik");
      setData(res.data);
      setShowModal(false);
      setEditMode(false);
      setForm({ nip: "", name: "", username: "", email: "", telp: "", ket: "", password: "", role: "tim_akademik" });
      setShowPassword(false);
      // Reset error saat modal ditutup
      setError("");
    } catch (err: any) {
      setError(handleApiError(err, "Menyimpan data tim akademik"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (t: UserTimAkademik) => {
    // Reset error saat membuka modal edit
    setError("");
    setForm({ ...t, password: t.password || "" });
    setShowModal(true);
    setEditMode(true);
  };

  const handleDelete = async (id: string) => {
    setSelectedDeleteNip(id);
    setShowDeleteModal(true);
  };
  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (selectedDeleteNip) {
        await api.delete(`/users/${selectedDeleteNip}`);
        const res = await api.get("/users?role=tim_akademik");
        setData(res.data);
        setSuccess("Data tim akademik berhasil dihapus.");
      }
      setShowDeleteModal(false);
      setSelectedDeleteNip(null);
    } catch (err: any) {
      setError(handleApiError(err, "Menghapus data tim akademik"));
    } finally {
      setIsDeleting(false);
    }
  };
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setSelectedDeleteNip(null);
  };
  const handleCloseModal = () => {
    setShowModal(false);
    setForm({ nip: "", name: "", username: "", email: "", telp: "", ket: "", password: "", role: "tim_akademik" });
    setEditMode(false);
    // Reset error saat modal ditutup
    setError("");
  };

  const userToDelete = data.find((u) => String(u.id) === String(selectedDeleteNip));

  const isFormValid = form.nip && form.name && form.username && form.email && form.telp && form.ket && (editMode || form.password);

  // Fungsi untuk download template Excel
  const downloadTemplate = async () => {
    const templateData = [
      {
        nip: '1978123456',
        nama: 'Nama Tim Akademik Contoh',
        username: 'username_tim',
        email: 'tim.contoh@umj.ac.id',
        telepon: '081234567890',
        keterangan: 'Ketua Tim',
        password: 'password123',
      }
    ];
    const ws = XLSX.utils.json_to_sheet(templateData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TimAkademik");
    XLSX.writeFile(wb, "Template_Import_TimAkademik.xlsx");
  };

  // Export data ke Excel dengan format yang bisa diimport kembali
  const exportToExcel = async () => {
    try {
      // Ambil semua data (tidak difilter) dengan format yang sesuai untuk import
      const dataToExport = data.map((t: UserTimAkademik) => ({
        'nip': t.nip,
        'nama': t.name,
        'username': t.username,
        'email': t.email,
        'telepon': t.telp,
        'keterangan': t.ket || '',
        'password': 'password123' // Default password untuk import
      }));

      // Buat workbook baru
      const wb = XLSX.utils.book_new();

      // Buat worksheet untuk data utama
      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // Set lebar kolom
      const colWidths = [
        { wch: 15 }, // nip
        { wch: 30 }, // nama
        { wch: 20 }, // username
        { wch: 30 }, // email
        { wch: 15 }, // telepon
        { wch: 25 }, // keterangan
        { wch: 15 }  // password
      ];
      ws['!cols'] = colWidths;

      // Tambahkan header dengan styling
      const headerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let col = headerRange.s.c; col <= headerRange.e.c; col++) {
        const cellAddress = XLSX.utils.encode_cell({ r: 0, c: col });
        if (!ws[cellAddress]) continue;
        
        // Set header styling
        ws[cellAddress].s = {
          font: { bold: true, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "4472C4" } },
          alignment: { horizontal: "center", vertical: "center" },
          border: {
            top: { style: "thin", color: { rgb: "000000" } },
            bottom: { style: "thin", color: { rgb: "000000" } },
            left: { style: "thin", color: { rgb: "000000" } },
            right: { style: "thin", color: { rgb: "000000" } }
          }
        };
      }

      // Tambahkan border untuk semua data
      const dataRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      for (let row = dataRange.s.r; row <= dataRange.e.r; row++) {
        for (let col = dataRange.s.c; col <= dataRange.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!ws[cellAddress]) continue;
          
          if (!ws[cellAddress].s) ws[cellAddress].s = {};
          ws[cellAddress].s.border = {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } }
          };
          
          // Alternating row colors
          if (row > 0) {
            ws[cellAddress].s.fill = {
              fgColor: { rgb: row % 2 === 0 ? "F8F9FA" : "FFFFFF" }
            };
          }
        }
      }

      // Buat worksheet untuk ringkasan
      const summaryData = [
        ['RINGKASAN DATA TIM AKADEMIK'],
        [''],
        ['Total Data', dataToExport.length],
        ['Data dengan Keterangan', dataToExport.filter(d => d.keterangan && d.keterangan.trim() !== '').length],
        ['Data tanpa Keterangan', dataToExport.filter(d => !d.keterangan || d.keterangan.trim() === '').length],
        [''],
        ['Tanggal Export', new Date().toLocaleString('id-ID')],
        ['Dibuat oleh', 'Sistem ISME FKK']
      ];

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs['!cols'] = [{ wch: 20 }, { wch: 30 }];

      // Styling untuk summary
      summaryWs['A1'].s = {
        font: { bold: true, size: 16, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "2F5597" } },
        alignment: { horizontal: "center", vertical: "center" }
      };

      // Tambahkan border untuk summary
      const summaryRange = XLSX.utils.decode_range(summaryWs['!ref'] || 'A1');
      for (let row = summaryRange.s.r; row <= summaryRange.e.r; row++) {
        for (let col = summaryRange.s.c; col <= summaryRange.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!summaryWs[cellAddress]) continue;
          
          if (!summaryWs[cellAddress].s) summaryWs[cellAddress].s = {};
          summaryWs[cellAddress].s.border = {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } }
          };
        }
      }

      // Tambahkan worksheet ke workbook
      XLSX.utils.book_append_sheet(wb, ws, "Data Tim Akademik");
      XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

      // Generate filename dengan timestamp
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, '-');
      const filename = `Data_TimAkademik_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
      
    } catch (error) {
      console.error('Error exporting to Excel:', error);
    }
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setImportedFile(file);
    try {
      const excelParsedData = await readExcelFile(file);
      const validationResult = validateExcelData(excelParsedData, data);
      setPreviewData(excelParsedData);
      setValidationErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors);
      setError("");
    } catch (err: any) {
      setError(handleApiError(err, "Membaca file Excel"));
      setPreviewData([]);
      setValidationErrors([]);
      setCellErrors([]);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleSubmitImport = async () => {
    if (!previewData || previewData.length === 0) return;
    setIsSaving(true);
    setError("");
    setLoading(true);
    setImportedCount(0);
    setCellErrors([]);

    const validationResult = validateExcelData(previewData, data);
    if (validationResult.errors.length > 0) {
      setValidationErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors);
      setIsSaving(false);
      setLoading(false);
      return;
    } else {
      setValidationErrors([]);
      setCellErrors([]);
    }

    try {
      const ws = XLSX.utils.json_to_sheet(previewData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TimAkademik");
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const file = new File([excelBuffer], "Data_Import_TimAkademik_Edited.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/users/import-tim-akademik', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        validateStatus: () => true,
      });
      if (res.status === 200) {
        setImportedCount(res.data.imported_count || 0);
        if (res.data.imported_count > 0) {
          setError("");
        }
        if (res.data.errors && res.data.errors.length > 0) {
          setError("Sebagian data gagal diimpor karena tidak valid:");
          if (res.data.failed_rows && res.data.failed_rows.length > 0) {
            setPreviewData(res.data.failed_rows);
          }
          setValidationErrors(res.data.errors);
          setCellErrors(res.data.cell_errors || []);
        } else {
          setImportedFile(null);
          setPreviewData([]);
          setValidationErrors([]);
          setCellErrors([]);
        }
        const timRes = await api.get("/users?role=tim_akademik");
        setData(timRes.data);
      } else if (res.status === 422) {
        setImportedCount(0);
        setError(res.data.message || 'Gagal mengimpor data');
        if (res.data.failed_rows && res.data.failed_rows.length > 0) {
          setPreviewData(res.data.failed_rows);
        }
        setValidationErrors(res.data.errors || []);
        setCellErrors(res.data.cell_errors || []);
      } else {
        setImportedCount(0);
        setError('Gagal mengimpor data');
        setCellErrors([]);
      }
    } catch (err: any) {
      setImportedCount(0);
      setError(handleApiError(err, "Mengimpor data tim akademik"));
      setCellErrors([]);
    } finally {
      setIsSaving(false);
      setLoading(false);
    }
  };

  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, { type: 'array' });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];
          const jsonData = XLSX.utils.sheet_to_json(worksheet);
          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  const validateExcelData = (excelData: any[], existingDbData: UserTimAkademik[]) => {
    const errors: string[] = [];
    const newCellErrors: {row: number, field: string, message: string, nip?: string}[] = [];
    if (excelData.length === 0) {
      errors.push('File Excel kosong');
      return { valid: false, errors, cellErrors: newCellErrors };
    }
    const firstRow = excelData[0];
    const requiredHeaders = ['nip', 'nama', 'username', 'email', 'telepon', 'keterangan', 'password'];
    const headers = Object.keys(firstRow);
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h.toLowerCase()));
    if (missingHeaders.length > 0) {
      errors.push(`Kolom yang diperlukan tidak ditemukan: ${missingHeaders.join(', ')}`);
      return { valid: false, errors, cellErrors: newCellErrors };
    }
    const nipSetInFile = new Set();
    const usernameSetInFile = new Set();
    const emailSetInFile = new Set();
    excelData.forEach((row, index) => {
      const rowNum = index + 2;
      const rowNip = row.nip ? String(row.nip) : '';
      const rowUsername = row.username ? String(row.username).toLowerCase() : '';
      const rowEmail = row.email ? String(row.email).toLowerCase() : '';
      if (!row.nip || !/^[0-9]+$/.test(row.nip)) {
        errors.push(`NIP harus diisi dengan angka (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'nip', message: `NIP harus diisi dengan angka`, nip: rowNip });
      }
      if (!row.nama) {
        errors.push(`Nama harus diisi (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'nama', message: `Nama harus diisi`, nip: rowNip });
      }
      if (!row.username) {
        errors.push(`Username harus diisi (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'username', message: `Username harus diisi`, nip: rowNip });
      }
      if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push(`Email tidak valid (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'email', message: `Email tidak valid`, nip: rowNip });
      }
      if (!row.telepon || !/^[0-9]+$/.test(row.telepon)) {
        errors.push(`Nomor telepon harus diisi dengan angka (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'telepon', message: `Nomor telepon harus diisi dengan angka`, nip: rowNip });
      }
      if (!row.keterangan) {
        errors.push(`Keterangan harus diisi (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'keterangan', message: `Keterangan harus diisi`, nip: rowNip });
      }
      if (!row.password || String(row.password).length < 6) {
        errors.push(`Password harus diisi minimal 6 karakter (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'password', message: `Password harus diisi minimal 6 karakter`, nip: rowNip });
      }
      if (rowNip) {
        if (nipSetInFile.has(rowNip)) {
          errors.push(`NIP ${rowNip} sudah terdaftar dalam file Excel ini (Baris ${rowNum})`);
          newCellErrors.push({ row: index, field: 'nip', message: `NIP sudah terdaftar dalam file ini`, nip: rowNip });
        } else {
          nipSetInFile.add(rowNip);
        }
      }
      if (rowUsername) {
        if (usernameSetInFile.has(rowUsername)) {
          errors.push(`Username ${row.username} sudah terdaftar dalam file Excel ini (Baris ${rowNum})`);
          newCellErrors.push({ row: index, field: 'username', message: `Username sudah terdaftar dalam file ini`, nip: rowNip });
        } else {
          usernameSetInFile.add(rowUsername);
        }
      }
      if (rowEmail) {
        if (emailSetInFile.has(rowEmail)) {
          errors.push(`Email ${row.email} sudah terdaftar dalam file Excel ini (Baris ${rowNum})`);
          newCellErrors.push({ row: index, field: 'email', message: `Email sudah terdaftar dalam file ini`, nip: rowNip });
        } else {
          emailSetInFile.add(rowEmail);
        }
      }
      if (rowNip && existingDbData.some(d => d.nip === rowNip)) {
        errors.push(`NIP ${rowNip} sudah terdaftar di database (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'nip', message: `NIP sudah terdaftar di database`, nip: rowNip });
      }
      if (rowUsername && existingDbData.some(d => d.username === rowUsername)) {
        errors.push(`Username ${row.username} sudah terdaftar di database (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'username', message: `Username sudah terdaftar di database`, nip: rowNip });
      }
      if (rowEmail && existingDbData.some(d => d.email === rowEmail)) {
        errors.push(`Email ${row.email} sudah terdaftar di database (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'email', message: `Email sudah terdaftar di database`, nip: rowNip });
      }
    });
    const uniqueErrors = Array.from(new Set(errors));
    return { valid: uniqueErrors.length === 0, errors: uniqueErrors, cellErrors: newCellErrors };
  };

  const handleCellEdit = (rowIdx: number, key: string, value: string) => {
    setPreviewData(prev => {
      const newData = [...prev];
      newData[rowIdx] = { ...newData[rowIdx], [key]: value };
      const rowErrors = validateRow(newData[rowIdx], newData, rowIdx, data);
      setCellErrors(prevCellErrors => {
        let filtered = prevCellErrors.filter(err => err.row !== rowIdx);
        if (rowErrors.length > 0) {
          rowErrors.forEach(err => {
            filtered.push({ row: rowIdx, field: err.field, message: err.message, nip: newData[rowIdx].nip });
          });
        }
        return filtered;
      });
      return newData;
    });
  };

  function validateRow(row: any, allRows: any[], rowIdx: number, existingDbData: UserTimAkademik[]): { field: string, message: string }[] {
    const errors: { field: string, message: string }[] = [];
    const rowNip = row.nip ? String(row.nip) : '';
    const rowUsername = row.username ? String(row.username).toLowerCase() : '';
    const rowEmail = row.email ? String(row.email).toLowerCase() : '';
    if (!row.nip || !/^[0-9]+$/.test(row.nip)) {
      errors.push({ field: 'nip', message: 'NIP harus diisi dengan angka' });
    }
    if (!row.nama) {
      errors.push({ field: 'nama', message: 'Nama harus diisi' });
    }
    if (!row.username) {
      errors.push({ field: 'username', message: 'Username harus diisi' });
    }
    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push({ field: 'email', message: 'Email tidak valid' });
    }
    if (!row.telepon || !/^[0-9]+$/.test(row.telepon)) {
      errors.push({ field: 'telepon', message: 'Nomor telepon harus diisi dengan angka' });
    }
    if (!row.keterangan) {
      errors.push({ field: 'keterangan', message: 'Keterangan harus diisi' });
    }
    if (!row.password || String(row.password).length < 6) {
      errors.push({ field: 'password', message: 'Password harus diisi minimal 6 karakter' });
    }
    if (rowNip) {
      if (allRows.some((r, i) => i !== rowIdx && String(r.nip) === rowNip)) {
        errors.push({ field: 'nip', message: 'NIP sudah terdaftar dalam file ini' });
      }
    }
    if (rowUsername) {
      if (allRows.some((r, i) => i !== rowIdx && String(r.username).toLowerCase() === rowUsername)) {
        errors.push({ field: 'username', message: 'Username sudah terdaftar dalam file ini' });
      }
    }
    if (rowEmail) {
      if (allRows.some((r, i) => i !== rowIdx && String(r.email).toLowerCase() === rowEmail)) {
        errors.push({ field: 'email', message: 'Email sudah terdaftar dalam file ini' });
      }
    }
    if (rowNip && existingDbData.some(d => d.nip === rowNip && String(d.id) !== String(row.id))) {
      errors.push({ field: 'nip', message: 'NIP sudah terdaftar di database' });
    }
    if (rowUsername && existingDbData.some(d => d.username === rowUsername && String(d.id) !== String(row.id))) {
      errors.push({ field: 'username', message: 'Username sudah terdaftar di database' });
    }
    if (rowEmail && existingDbData.some(d => d.email === rowEmail && String(d.id) !== String(row.id))) {
      errors.push({ field: 'email', message: 'Email sudah terdaftar di database' });
    }
    return errors;
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Daftar Tim Akademik</h1>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => { 
              // Reset error saat membuka modal input baru
              setError("");
              setShowModal(true); 
              setEditMode(false); 
            }}
            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"
          >
            Input Data
          </button>
          <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 text-sm font-medium shadow-theme-xs hover:bg-green-200 dark:hover:bg-green-800 transition cursor-pointer">
            <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5 text-green-700 dark:text-green-200" />
            Import Excel
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleImport}
            />
          </label>
          <button
            onClick={downloadTemplate}
            className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
            Download Template Excel
          </button>
          <button
            onClick={exportToExcel}
            className="px-4 py-2 rounded-lg bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 text-sm font-medium shadow-theme-xs hover:bg-purple-200 dark:hover:bg-purple-800 transition flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
            Export ke Excel
          </button>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-0">
          <div className="relative w-full md:w-72">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg className="fill-gray-500 dark:fill-gray-400" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" clipRule="evenodd" d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z" fill="" />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Cari apa saja di semua kolom data..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>
        </div>
      </div>
      {/* Success Messages */}
      <AnimatePresence>
        {success && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
          >
            {success}
          </motion.div>
        )}
      </AnimatePresence>
      {importedFile && (
        <div className="w-full mt-4">
          <div className="mb-2 text-sm text-gray-700 dark:text-gray-200 font-semibold">
            Preview Data: <span className="font-normal text-gray-500 dark:text-gray-400">{importedFile.name}</span>
          </div>
          {(validationErrors.length > 0 || cellErrors.length > 0) && (
            <div className="mb-4">
              <div className="bg-red-100 rounded-md p-3">
                <div className="text-base font-semibold text-red-500 mb-1">
                  {importedCount > 0
                    ? 'Sebagian data gagal diimpor karena tidak valid:'
                    : 'Semua data gagal diimpor. Periksa kembali format dan isian data:'}
                </div>
                <ul className="list-disc pl-5 text-sm text-red-600">
                  {cellErrors.length > 0
                    ? cellErrors.map((err, _) => (
                        <li key={err.row}>
                          {err.message} (Baris {err.row + 2}, Kolom {err.field.toUpperCase()}): {previewData.find(r => r.nip === err.nip)?.[err.field] || ''}
                        </li>
                      ))
                    : validationErrors.map((err, _) => (
                        <li key={err}>{err}</li>
                      ))}
                </ul>
              </div>
            </div>
          )}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <div className="max-w-full overflow-x-auto hide-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <style>{`.max-w-full::-webkit-scrollbar { display: none; }`}</style>
              <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                  <tr>
                    {previewData[0] && Object.keys(previewData[0]).map((colKey, _) => (
                      <th key={colKey} className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">{colKey.toUpperCase()}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedPreviewData.map((row, i) => {
                    const globalRowIdx = (previewPage - 1) * previewPageSize + i;
                    return (
                      <tr key={i} className={i % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>
                        {previewData[0] && Object.keys(previewData[0]).map((colKey, _) => {
                          const isEditing = editingCell?.row === globalRowIdx && editingCell?.key === colKey;
                          const cellError = cellErrors.find(err => err.row === globalRowIdx && err.field === colKey);
                          return (
                            <td
                              key={colKey}
                              className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${isEditing ? 'border-2 border-brand-500' : ''} ${cellError ? 'bg-red-100 dark:bg-red-900/30' : ''}`}
                              onClick={() => setEditingCell({ row: globalRowIdx, key: colKey })}
                              title={cellError ? cellError.message : ''}
                            >
                              {isEditing ? (
                                <input
                                  className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                  value={previewData[editingCell.row][editingCell.key] || ""}
                                  onChange={e => {
                                    let val = e.target.value;
                                    if (["nip", "telepon"].includes(colKey)) {
                                      val = val.replace(/[^0-9]/g, "");
                                    }
                                    handleCellEdit(globalRowIdx, colKey, val);
                                  }}
                                  onBlur={() => setEditingCell(null)}
                                  autoFocus
                                />
                              ) : (
                                row[colKey]
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4">
              <div className="flex items-center gap-4">
                <select
                  value={previewPageSize}
                  onChange={e => { setPreviewPageSize(Number(e.target.value)); setPreviewPage(1); }}
                  className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none"
                >
                  {PAGE_SIZE_OPTIONS.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Menampilkan {paginatedPreviewData.length} dari {previewData.length} data
                </span>
              </div>
              <div className="flex gap-1">
                <button
                  onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                  disabled={previewPage === 1}
                  className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  Prev
                </button>
                {Array.from({ length: previewTotalPages }, (_, i) => (
                  <button
                    key={i}
                    onClick={() => setPreviewPage(i + 1)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 ${
                      previewPage === i + 1
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    } transition`}
                  >
                    {i + 1}
                  </button>
                ))}
                <button
                  onClick={() => setPreviewPage((p) => Math.min(previewTotalPages, p + 1))}
                  disabled={previewPage === previewTotalPages}
                  className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
          <div className="flex gap-2 mt-4 mb-6">
            <button
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm font-medium hover:bg-gray-200 transition"
              onClick={() => {
                setImportedFile(null);
                setPreviewData([]);
                setValidationErrors([]);
                setCellErrors([]);
              }}
              type="button"
            >
              Batal
            </button>
            <button
              className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs flex items-center justify-center min-w-[160px] transition
                ${isSaving || loading
                  ? 'bg-emerald-800 text-white opacity-60 cursor-not-allowed'
                  : 'bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600'}`}
              onClick={handleSubmitImport}
              disabled={isSaving || loading}
            >
              {isSaving ? (
                <>
                  <svg className="w-5 h-5 mr-2 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  Mengimpor...
                </>
              ) : (
                'Import ke Database'
              )}
            </button>
          </div>
        </div>
      )}
      <AnimatePresence>
        {importedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
          >
            {importedCount} data tim akademik berhasil diimpor ke database.
          </motion.div>
        )}
      </AnimatePresence>

      {/* Table utama Tim Akademik */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto hide-scroll"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{`
            .max-w-full::-webkit-scrollbar { display: none; }
            .hide-scroll { 
              -ms-overflow-style: none; /* IE and Edge */
              scrollbar-width: none; /* Firefox */
            }
            .hide-scroll::-webkit-scrollbar { /* Chrome, Safari, Opera */
              display: none;
            }
          `}</style>
          <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
            <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4 text-center align-middle">
                  <button
                    type="button"
                    aria-checked={filteredData.length > 0 && filteredData.every(t => selectedRows.includes(String(t.id || t.nip)))}
                    role="checkbox"
                    onClick={() => {
                      if (filteredData.length > 0 && filteredData.every(t => selectedRows.includes(String(t.id || t.nip)))) {
                        setSelectedRows([]);
                      } else {
                        setSelectedRows(filteredData.map(t => String(t.id || t.nip)));
                      }
                    }}
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${filteredData.length > 0 && filteredData.every(t => selectedRows.includes(String(t.id || t.nip))) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                  >
                    {filteredData.length > 0 && filteredData.every(t => selectedRows.includes(String(t.id || t.nip))) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <polyline points="20 7 11 17 4 10" />
                      </svg>
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">NIP</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">Nama</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">Username</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">Email</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">Nomor Telepon</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">Keterangan</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-4 text-center align-middle">
                      <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse opacity-80"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse opacity-80"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse opacity-80"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-28 bg-gray-200 dark:bg-gray-700 rounded animate-pulse opacity-80"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse opacity-80"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse opacity-80"></div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse opacity-80 mx-auto"></div>
                    </td>
                  </tr>
                ))
              ) : paginatedData.length > 0 ? (
                paginatedData.map((t, _) => (
                  <tr key={t.id || t.nip} className={_ % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>
                    <td className="px-4 py-4 text-center align-middle">
                      <button
                        type="button"
                        aria-checked={selectedRows.includes(String(t.id || t.nip))}
                        role="checkbox"
                        onClick={() => {
                          if (selectedRows.includes(String(t.id || t.nip))) {
                            setSelectedRows(selectedRows.filter(id => id !== String(t.id || t.nip)));
                          } else {
                            setSelectedRows([...selectedRows, String(t.id || t.nip)]);
                          }
                        }}
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedRows.includes(String(t.id || t.nip)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                      >
                        {selectedRows.includes(String(t.id || t.nip)) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <polyline points="20 7 11 17 4 10" />
                          </svg>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800 dark:text-white/90 align-middle">{t.nip}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">{t.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">{t.username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">{t.email}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">{t.telp}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">{t.ket}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(t)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 transition"
                          title="Edit"
                        >
                          <FontAwesomeIcon icon={faPenToSquare} className="w-5 h-5" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(t.id!.toString())}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition"
                          title="Delete"
                        >
                          <FontAwesomeIcon icon={faTrash} className="w-5 h-5" />
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} className="text-center py-8 text-gray-400 dark:text-gray-500">Belum ada data.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4">
          <div className="flex items-center gap-4">
            <select
              id="perPage"
              value={pageSize}
              onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
              className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Menampilkan {paginatedData.length} dari {filteredData.length} data
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
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
                onClick={() => setPage(1)}
                className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                  page === 1
                    ? 'bg-brand-500 text-white'
                    : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                1
              </button>
              
              {/* Show ellipsis if current page is far from start */}
              {page > 4 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">...</span>
              )}
              
              {/* Show pages around current page */}
              {Array.from({ length: totalPages }, (_, i) => {
                const pageNum = i + 1;
                // Show pages around current page (2 pages before and after)
                const shouldShow = pageNum > 1 && pageNum < totalPages && 
                  (pageNum >= page - 2 && pageNum <= page + 2);
                
                if (!shouldShow) return null;
                
                return (
                  <button
                    key={i}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                      page === pageNum
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
              
              {/* Show ellipsis if current page is far from end */}
              {page < totalPages - 3 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">...</span>
              )}
              
              {/* Always show last page if it's not the first page */}
              {totalPages > 1 && (
                <button
                  onClick={() => setPage(totalPages)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    page === totalPages
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  {totalPages}
                </button>
              )}
            </div>
            
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
            >
              Next
            </button>
          </div>
        </div>
      </div>
      <div className="flex gap-2 mt-8">
        <button
          disabled={selectedRows.length === 0 || isDeleting}
          onClick={() => setShowDeleteModalBulk(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${selectedRows.length === 0 || isDeleting ? 'bg-gray-200 text-gray-400 cursor-not-allowed' : 'bg-red-500 text-white shadow-theme-xs hover:bg-red-600'}`}
        >
          {isDeleting ? 'Menghapus...' : `Hapus Terpilih (${selectedRows.length})`}
        </button>
      </div>
      <AnimatePresence>
        {showDeleteModalBulk && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowDeleteModalBulk(false)}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              <div className="flex items-center justify-between pb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">Konfirmasi Hapus Data</h2>
              </div>
              <div>
                <p className="mb-6 text-gray-500 dark:text-gray-400">
                  Apakah Anda yakin ingin menghapus <span className="font-semibold text-gray-800 dark:text-white">{selectedRows.length}</span> data tim akademik terpilih? Data yang dihapus tidak dapat dikembalikan.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowDeleteModalBulk(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={async () => {
                      setShowDeleteModalBulk(false);
                      setLoading(true);
                      setIsDeleting(true);
                      try {
                        await Promise.all(selectedRows.map(id => api.delete(`/users/${id}`)));
                        const res = await api.get("/users?role=tim_akademik");
                        setData(res.data);
                        setSuccess(`${selectedRows.length} data tim akademik berhasil dihapus.`);
                      } catch {
                        setError("Gagal menghapus data terpilih");
                      } finally {
                        setIsDeleting(false);
                        setLoading(false);
                      }
                    }}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center"
                    disabled={isDeleting}
                  >
                    {isDeleting ? (<><svg className="w-5 h-5 mr-2 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>Menghapus...</>) : 'Hapus'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handleCloseModal}
            ></div>
            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={handleCloseModal}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <div>
                <div className="flex items-center justify-between pb-6">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    {editMode ? 'Edit Tim Akademik' : 'Tambah Tim Akademik'}
                  </h2>
                </div>
                <div>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">NIP</label>
                      <input
                        type="text"
                        name="nip"
                        value={form.nip}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                        disabled={editMode}
                        pattern="[0-9]*"
                        inputMode="numeric"
                        onKeyDown={handleNumberInput}
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nama</label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nomor Telepon</label>
                      <input
                        type="tel"
                        name="telp"
                        value={form.telp}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        onKeyDown={handleNumberInput}
                        autoComplete="off"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Keterangan</label>
                      <input
                        type="text"
                        name="ket"
                        value={form.ket}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Username</label>
                      <input
                        type="text"
                        name="username"
                        value={form.username}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Password</label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={form.password || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                          required={!editMode}
                          autoComplete="new-password"
                          placeholder={editMode ? "Kosongkan jika tidak ingin mengubah password" : ""}
                        />
                        <span
                          onClick={() => setShowPassword((v) => !v)}
                          className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                        >
                          {showPassword ? (
                            <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                          ) : (
                            <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2 pt-6">
                    <button
                      onClick={handleCloseModal}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleAdd}
                      className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${!isFormValid ? 'bg-emerald-800 text-white opacity-60 cursor-not-allowed' : 'bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600'}`}
                      disabled={!isFormValid || isSaving}
                    >
                      {isSaving ? (
                        <>
                          <svg
                            className="w-5 h-5 mr-2 animate-spin text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            ></path>
                          </svg>
                          Menyimpan...
                        </>
                      ) : (
                        'Simpan'
                      )}
                    </button>
                  </div>
                </div>
                {/* Error Message di dalam Modal */}
                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="mt-4 p-3 rounded-lg text-sm bg-red-100 text-red-700"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modal Delete Data */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={cancelDelete}
            ></div>
            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              {/* Close Button */}
              <button
                onClick={cancelDelete}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <div>
                <div className="flex items-center justify-between pb-6">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">Hapus Data</h2>
                </div>
                <div>
                  <p className="mb-6 text-gray-500 dark:text-gray-400">
                    Apakah Anda yakin ingin menghapus data tim akademik <span className="font-semibold text-gray-800 dark:text-white">{userToDelete?.name || selectedDeleteNip}</span>? Data yang dihapus tidak dapat dikembalikan.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={cancelDelete}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={confirmDelete}
                      className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center"
                      disabled={isDeleting}
                    >
                      {isDeleting ? (<><svg className="w-5 h-5 mr-2 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path></svg>Menghapus...</>) : 'Hapus'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
} 
