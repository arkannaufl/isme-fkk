import { useState, ChangeEvent, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faFileExcel, faPenToSquare, faTrash, faDownload } from "@fortawesome/free-solid-svg-icons";
import { AnimatePresence, motion } from "framer-motion";
import api, { handleApiError } from "../utils/api";
import { EyeIcon, EyeCloseIcon } from "../icons";
import * as XLSX from 'xlsx';

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const STATUS_OPTIONS = ["aktif", "cuti", "lulus", "keluar"];

type UserMahasiswa = {
  id?: number;
  nim: string;
  name: string;
  username: string;
  telp: string;
  email: string;
  gender: string;
  ipk: number;
  status: string;
  angkatan: string;
  semester?: number; 
  password?: string;
  role?: string;
};

function handleNumberInput(e: React.KeyboardEvent<HTMLInputElement>) {
  // Allow: backspace, delete, tab, escape, enter, arrows
  if (["Backspace", "Delete", "Tab", "Escape", "Enter", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
    return;
  }
  // Allow: Ctrl+A, Ctrl+C, Ctrl+V, Ctrl+X
  if ((e.ctrlKey || e.metaKey) && ["a", "c", "v", "x"].includes(e.key.toLowerCase())) {
    return;
  }
  // Block if not a number
  if (!/^[0-9]$/.test(e.key)) {
    e.preventDefault();
  }
}

// Function to convert gender display
const formatGenderDisplay = (gender: string): string => {
  if (!gender) return '-';
  
  const genderMap: { [key: string]: string } = {
    'L': 'Laki-laki',
    'P': 'Perempuan',
    'Laki-laki': 'Laki-laki',
    'Perempuan': 'Perempuan'
  };
  
  return genderMap[gender] || gender;
};

// Function to get unique gender options for filter
const getGenderOptions = (data: UserMahasiswa[]): string[] => {
  const uniqueGenders = Array.from(new Set(data.map(d => d.gender).filter(Boolean)));
  return uniqueGenders.map(gender => formatGenderDisplay(gender)).sort();
};

// Function to convert display gender back to backend format for filtering
const convertDisplayToBackendGender = (displayGender: string): string => {
  const reverseMap: { [key: string]: string } = {
    'Laki-laki': 'L',
    'Perempuan': 'P'
  };
  return reverseMap[displayGender] || displayGender;
};

export default function Mahasiswa() {
  const [data, setData] = useState<UserMahasiswa[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<UserMahasiswa>({ nim: "", name: "", username: "", telp: "", email: "", gender: "Laki-laki", ipk: 0, status: "aktif", angkatan: "", password: "" });
  const [activeSemester, setActiveSemester] = useState<{jenis: string, tahun: string} | null>(null);
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteNim, setSelectedDeleteNim] = useState<string | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);
  const previewTotalPages = Math.ceil(previewData.length / previewPageSize);
  const paginatedPreviewData = previewData.slice((previewPage - 1) * previewPageSize, previewPage * previewPageSize);
  const [editingCell, setEditingCell] = useState<{ row: number; key: string } | null>(null);
  const [cellErrors, setCellErrors] = useState<{row: number, field: string, message: string, nim?: string}[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [showDeleteModalBulk, setShowDeleteModalBulk] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  // Filter states - similar to MataKuliah
  const [filterSemester, setFilterSemester] = useState<string>("all");
  const [filterPeriode, setFilterPeriode] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterGender, setFilterGender] = useState<string>("all");
  const [filterAngkatan, setFilterAngkatan] = useState<string>("all");

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    setLoading(true);
    Promise.all([
      api.get("/users?role=mahasiswa"),
      api.get("/tahun-ajaran/active")
    ]).then(([mahasiswaRes, semesterRes]) => {
      setData(mahasiswaRes.data);
      if (semesterRes.data && semesterRes.data.semesters && semesterRes.data.semesters.length > 0) {
        const activeSem = semesterRes.data.semesters[0];
        setActiveSemester({
          jenis: activeSem.jenis,
          tahun: semesterRes.data.tahun
        });
      }
      setLoading(false);
    }).catch(() => {
      setError("Gagal memuat data");
      setLoading(false);
    });
  }, []);

  useEffect(() => {
    // Only validate if we have preview data and no success message (import not completed)
    if (importedFile && previewData.length > 0 && !success) {
      const validationResult = validateExcelData(previewData, data);
      setValidationErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors);
    }
  }, [previewData, data, success]);

  useEffect(() => {
    if (importedCount > 0) {
      const timer = setTimeout(() => {
        setImportedCount(0);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [importedCount]);

  // Filter options - similar to MataKuliah
  const semesterOptions = Array.from(new Set(Array.isArray(data) ? data.map((d) => d.semester).filter(s => s !== undefined) : [])).sort((a, b) => a - b);
  const periodeOptions = Array.from(new Set(Array.isArray(data) ? data.map((d) => d.semester ? (Number(d.semester) % 2 === 1 ? "Ganjil" : "Genap") : null).filter(p => p !== null) : []));
  const statusOptions = Array.from(new Set(Array.isArray(data) ? data.map((d) => d.status) : []));
  const genderOptions = getGenderOptions(data);
  const angkatanOptions = Array.from(new Set(Array.isArray(data) ? data.map((d) => d.angkatan) : [])).sort((a, b) => Number(b) - Number(a));

  // Filter & Search - similar to MataKuliah
  const filteredData = data.filter((m) => {
    const q = search.toLowerCase();
    // Gabungkan semua value dari objek menjadi satu string
    const allValues = Object.values(m).join(' ').toLowerCase();
    const searchMatch = allValues.includes(q);
    
    // Filter otomatis berdasarkan semester aktif dihapus
    // Sekarang semua mahasiswa akan ditampilkan tanpa filter otomatis
    
    const matchSemester = filterSemester === "all" ? true : m.semester === Number(filterSemester);
    const matchPeriode = filterPeriode === "all" ? true : (m.semester ? (Number(m.semester) % 2 === 1 ? "Ganjil" : "Genap") : null) === filterPeriode;
    const matchStatus = filterStatus === "all" ? true : m.status === filterStatus;
    const matchGender = filterGender === "all" ? true : m.gender === convertDisplayToBackendGender(filterGender);
    const matchAngkatan = filterAngkatan === "all" ? true : m.angkatan === filterAngkatan;
    
    return searchMatch && matchSemester && matchPeriode && matchStatus && matchGender && matchAngkatan;
  });

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice((page - 1) * pageSize, page * pageSize);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    // Filter hanya angka untuk field tertentu
    if (["nim", "telp", "angkatan"].includes(name)) {
      setForm({ ...form, [name]: value.replace(/[^0-9]/g, "") });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  const handleAdd = async () => {
    setIsSaving(true);
    setError("");
    try {
      let payload = { ...form };
      if (editMode) {
        if (!payload.password) delete payload.password;
        await api.put(`/users/${form.id}`, payload);
        setSuccess("Data mahasiswa berhasil diupdate.");
      } else {
        if (!payload.password) {
          setError("Password wajib diisi.");
          setIsSaving(false);
          return;
        }
        payload.role = 'mahasiswa';
        await api.post("/users", payload);
        setSuccess("Data mahasiswa berhasil ditambahkan.");
      }
      const res = await api.get("/users?role=mahasiswa");
      setData(res.data);
      setShowModal(false);
      setEditMode(false);
      setForm({ nim: "", name: "", username: "", telp: "", email: "", gender: "Laki-laki", ipk: 0, status: "aktif", angkatan: "", password: "" });
      setShowPassword(false);
    } catch (err: any) {
      if (err?.response?.data?.errors) {
        const errorMessages = Object.values(err.response.data.errors).flat().join(', ');
        setError(errorMessages);
      } else {
        setError(err?.response?.data?.message || "Gagal simpan data");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (m: UserMahasiswa) => {
    setForm({ ...m, password: "" });
    setShowModal(true);
    setEditMode(true);
  };

  const handleDelete = async (id: string) => {
    setSelectedDeleteNim(id);
    setShowDeleteModal(true);
  };
  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (selectedDeleteNim) {
        await api.delete(`/users/${selectedDeleteNim}`);
        const res = await api.get("/users?role=mahasiswa");
        setData(res.data);
        setSuccess("Data mahasiswa berhasil dihapus.");
      }
      setShowDeleteModal(false);
      setSelectedDeleteNim(null);
    } catch {
      setError("Gagal menghapus data");
    } finally {
      setIsDeleting(false);
    }
  };
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setSelectedDeleteNim(null);
  };

  const userToDelete = data.find((u) => String(u.id) === String(selectedDeleteNim));

  const isFormValid = form.nim && form.name && form.username && form.telp && form.email && form.gender && form.ipk !== undefined && form.status && form.angkatan && (editMode || form.password);

  // Check if any filters are active
  const hasActiveFilters = search || filterSemester !== "all" || filterPeriode !== "all" || filterStatus !== "all" || filterGender !== "all" || filterAngkatan !== "all";

  // Clear all filters
  const clearAllFilters = () => {
    setSearch("");
    setFilterSemester("all");
    setFilterPeriode("all");
    setFilterStatus("all");
    setFilterGender("all");
    setFilterAngkatan("all");
    setPage(1);
  };

  // Fungsi untuk download template Excel
  const downloadTemplate = async () => {
    // Data contoh untuk template
    const templateData = [
      {
        nim: '2021000001',
        nama: 'Nama Mahasiswa Contoh',
        username: 'username_mahasiswa',
        email: 'mahasiswa.contoh@umj.ac.id',
        telepon: '081234567890',
        password: 'password123',
        gender: 'Laki-laki',
        ipk: 3.5,
        status: 'aktif',
        angkatan: '2021',
        semester: 1
      }
    ];

    // Buat worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);
    
    // Buat workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Mahasiswa");
    
    // Generate file dan download
    XLSX.writeFile(wb, "Template_Import_Mahasiswa.xlsx");
  };

  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    // Clear all previous states when new file is selected
    setError("");
    setSuccess("");
    setValidationErrors([]);
    setCellErrors([]);
    setPreviewData([]);
    setPreviewPage(1);
    
    setImportedFile(file);
    try {
      const excelParsedData = await readExcelFile(file);
      const validationResult = validateExcelData(excelParsedData, data);
      setPreviewData(excelParsedData);
      setValidationErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors);
    } catch (err: any) {
      setError(err.message || "Gagal membaca file Excel");
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

    setIsImporting(true);
    try {
      const ws = XLSX.utils.json_to_sheet(previewData);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Mahasiswa");
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const file = new File([excelBuffer], "Data_Import_Mahasiswa_Edited.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/users/import-mahasiswa', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        validateStatus: () => true,
        timeout: 1200000, // 20 menit timeout untuk import data besar
      });
      
      if (res.status === 200) {
        setImportedCount(res.data.imported_count || 0);
        
        // Always show success message if any data was imported
        if (res.data.imported_count > 0) {
          setSuccess(res.data.message || `Berhasil mengimpor ${res.data.imported_count} data mahasiswa`);
          setError(""); // Clear error message
          
          // Clear all preview and validation states since import was successful
          setImportedFile(null);
          setPreviewData([]);
          setValidationErrors([]);
          setCellErrors([]);
          setPreviewPage(1); // Reset preview pagination
        } else {
          // No data imported, show error
          setError(res.data.message || 'Tidak ada data yang berhasil diimpor');
          setSuccess("");
          if (res.data.failed_rows && res.data.failed_rows.length > 0) {
            setPreviewData(res.data.failed_rows);
          }
          setValidationErrors(res.data.errors || []);
          setCellErrors(res.data.cell_errors || []);
        }
        
        // Refresh data
        const mahasiswaRes = await api.get("/users?role=mahasiswa");
        setData(mahasiswaRes.data);
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
      setError(err.message || 'Gagal mengimpor data');
      setCellErrors([]);
    } finally {
      setIsSaving(false);
      setIsImporting(false);
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

  const validateExcelData = (excelData: any[], existingDbData: UserMahasiswa[]) => {
    const errors: string[] = [];
    const newCellErrors: {row: number, field: string, message: string, nim?: string}[] = [];

    if (excelData.length === 0) {
      errors.push('File Excel kosong');
      return { valid: false, errors, cellErrors: newCellErrors };
    }

    // Cek header kolom
    const firstRow = excelData[0];
    const requiredHeaders = ['nim', 'nama', 'username', 'email', 'telepon', 'password', 'gender', 'ipk', 'status', 'angkatan', 'semester'];
    const headers = Object.keys(firstRow);

    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h.toLowerCase()));
    if (missingHeaders.length > 0) {
      errors.push(`Kolom yang diperlukan tidak ditemukan: ${missingHeaders.join(', ')}`);
      return { valid: false, errors, cellErrors: newCellErrors };
    }

    // Validasi setiap baris data
    const nimSetInFile = new Set();
    const usernameSetInFile = new Set();
    const emailSetInFile = new Set();

    excelData.forEach((row, index) => {
      const rowNum = index + 2; // +2 karena header di row 1 dan index mulai dari 0
      const rowNim = row.nim ? String(row.nim) : '';
      const rowUsername = row.username ? String(row.username).toLowerCase() : '';
      const rowEmail = row.email ? String(row.email).toLowerCase() : '';

      // Basic required and format validations
      if (!row.nim || !/^[0-9]+$/.test(row.nim)) {
        errors.push(`NIM harus diisi dengan angka (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'nim', message: `NIM harus diisi dengan angka`, nim: rowNim });
      }
      if (!row.nama) {
        errors.push(`Nama harus diisi (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'nama', message: `Nama harus diisi`, nim: rowNim });
      }
      if (!row.username) {
        errors.push(`Username harus diisi (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'username', message: `Username harus diisi`, nim: rowNim });
      }
      if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push(`Email tidak valid (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'email', message: `Email tidak valid`, nim: rowNim });
      }
      if (!row.telepon || !/^[0-9]+$/.test(row.telepon)) {
        errors.push(`Nomor telepon harus diisi dengan angka (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'telepon', message: `Nomor telepon harus diisi dengan angka`, nim: rowNim });
      }
      if (!row.password || String(row.password).length < 6) {
        errors.push(`Password harus diisi minimal 6 karakter (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'password', message: `Password harus diisi minimal 6 karakter`, nim: rowNim });
      }
      if (!row.gender || !['Laki-laki', 'Perempuan'].includes(row.gender)) {
        errors.push(`Gender harus diisi dengan 'Laki-laki' atau 'Perempuan' (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'gender', message: `Gender harus diisi dengan 'Laki-laki' atau 'Perempuan'`, nim: rowNim });
      }
      if (!row.ipk || isNaN(Number(row.ipk)) || Number(row.ipk) < 0 || Number(row.ipk) > 4) {
        errors.push(`IPK harus diisi dengan angka antara 0-4 (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'ipk', message: `IPK harus diisi dengan angka antara 0-4`, nim: rowNim });
      }
      if (!row.status || !['aktif', 'cuti', 'lulus', 'keluar'].includes(row.status)) {
        errors.push(`Status harus diisi dengan 'aktif', 'cuti', 'lulus', atau 'keluar' (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'status', message: `Status harus diisi dengan 'aktif', 'cuti', 'lulus', atau 'keluar'`, nim: rowNim });
      }
      if (!row.angkatan || !/^[0-9]+$/.test(row.angkatan)) {
        errors.push(`Angkatan harus diisi dengan angka (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'angkatan', message: `Angkatan harus diisi dengan angka`, nim: rowNim });
      }
      if (!row.semester || isNaN(Number(row.semester)) || Number(row.semester) < 1) {
        errors.push(`Semester harus diisi dengan angka minimal 1 (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'semester', message: `Semester harus diisi dengan angka minimal 1`, nim: rowNim });
      }

      // Duplikat dalam file Excel
      if (rowNim) {
        if (nimSetInFile.has(rowNim)) {
          errors.push(`NIM ${rowNim} sudah terdaftar dalam file Excel ini (Baris ${rowNum})`);
          newCellErrors.push({ row: index, field: 'nim', message: `NIM sudah terdaftar dalam file ini`, nim: rowNim });
        } else {
          nimSetInFile.add(rowNim);
        }
      }
      if (rowUsername) {
        if (usernameSetInFile.has(rowUsername)) {
          errors.push(`Username ${row.username} sudah terdaftar dalam file Excel ini (Baris ${rowNum})`);
          newCellErrors.push({ row: index, field: 'username', message: `Username sudah terdaftar dalam file ini`, nim: rowNim });
        } else {
          usernameSetInFile.add(rowUsername);
        }
      }
      if (rowEmail) {
        if (emailSetInFile.has(rowEmail)) {
          errors.push(`Email ${row.email} sudah terdaftar dalam file Excel ini (Baris ${rowNum})`);
          newCellErrors.push({ row: index, field: 'email', message: `Email sudah terdaftar dalam file ini`, nim: rowNim });
        } else {
          emailSetInFile.add(rowEmail);
        }
      }

      // Duplikat dengan database
      if (rowNim && existingDbData.some(d => d.nim === rowNim)) {
        errors.push(`NIM ${rowNim} sudah terdaftar di database (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'nim', message: `NIM sudah terdaftar di database`, nim: rowNim });
      }
      if (rowUsername && existingDbData.some(d => d.username === rowUsername)) {
        errors.push(`Username ${row.username} sudah terdaftar di database (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'username', message: `Username sudah terdaftar di database`, nim: rowNim });
      }
      if (rowEmail && existingDbData.some(d => d.email === rowEmail)) {
        errors.push(`Email ${row.email} sudah terdaftar di database (Baris ${rowNum})`);
        newCellErrors.push({ row: index, field: 'email', message: `Email sudah terdaftar di database`, nim: rowNim });
      }
    });

    const uniqueErrors = Array.from(new Set(errors));
    return { valid: uniqueErrors.length === 0, errors: uniqueErrors, cellErrors: newCellErrors };
  };

  const handleCellEdit = (rowIdx: number, key: string, value: string | string[]) => {
    // Mapping kolom model ke kolom excel
    const fieldMap: Record<string, string> = {
      name: 'nama',
      telp: 'telepon',
    };
    // Jika key adalah field model, ubah ke field excel
    const excelKey = fieldMap[key] || key;
    setPreviewData(prev => {
      const newData = [...prev];
      newData[rowIdx] = { ...newData[rowIdx], [excelKey]: value };
      
      // Validasi baris yang diedit
      const rowErrors = validateRow(newData[rowIdx], newData, rowIdx, data);
      setCellErrors(prevCellErrors => {
        let filtered = prevCellErrors.filter(err => err.row !== rowIdx);
        if (rowErrors.length > 0) {
          rowErrors.forEach(err => {
            filtered.push({ row: rowIdx, field: err.field, message: err.message, nim: newData[rowIdx].nim });
          });
        }
        return filtered;
      });
      return newData;
    });
  };

  function validateRow(row: any, allRows: any[], rowIdx: number, existingDbData: UserMahasiswa[]): { field: string, message: string }[] {
    const errors: { field: string, message: string }[] = [];
    const rowNim = row.nim ? String(row.nim) : '';
    const rowUsername = row.username ? String(row.username).toLowerCase() : '';
    const rowEmail = row.email ? String(row.email).toLowerCase() : '';

    // Basic required and format validations
    if (!row.nim || !/^[0-9]+$/.test(row.nim)) {
      errors.push({ field: 'nim', message: 'NIM harus diisi dengan angka' });
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
    if (!row.password || String(row.password).length < 6) {
      errors.push({ field: 'password', message: 'Password harus diisi minimal 6 karakter' });
    }
    if (!row.gender || !['Laki-laki', 'Perempuan'].includes(row.gender)) {
      errors.push({ field: 'gender', message: `Gender harus diisi dengan 'Laki-laki' atau 'Perempuan'` });
    }
    if (!row.ipk || isNaN(Number(row.ipk)) || Number(row.ipk) < 0 || Number(row.ipk) > 4) {
      errors.push({ field: 'ipk', message: 'IPK harus diisi dengan angka antara 0-4' });
    }
    if (!row.status || !['aktif', 'cuti', 'lulus', 'keluar'].includes(row.status)) {
      errors.push({ field: 'status', message: `Status harus diisi dengan 'aktif', 'cuti', 'lulus', atau 'keluar'` });
    }
    if (!row.angkatan || !/^[0-9]+$/.test(row.angkatan)) {
      errors.push({ field: 'angkatan', message: 'Angkatan harus diisi dengan angka' });
    }

    // Duplikat dalam file Excel
    if (rowNim) {
      if (allRows.some((r, i) => i !== rowIdx && String(r.nim) === rowNim)) {
        errors.push({ field: 'nim', message: 'NIM sudah terdaftar dalam file ini' });
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

    // Duplikat dengan database
    if (rowNim && existingDbData.some(d => d.nim === rowNim && String(d.id) !== String(row.id))) {
      errors.push({ field: 'nim', message: 'NIM sudah terdaftar di database' });
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
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">Daftar Mahasiswa</h1>
      {activeSemester && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <svg className="w-5 h-5 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Semester Aktif: {activeSemester.jenis} ({activeSemester.tahun})
            </span>
          </div>
          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
            Mahasiswa baru akan otomatis masuk semester {activeSemester.jenis === 'Ganjil' ? '1' : '2'}. Semua mahasiswa ditampilkan tanpa filter otomatis.
          </p>
        </div>
      )}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => { setShowModal(true); setEditMode(false); }}
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
              disabled={isSaving}
            />
          </label>
          <button
            onClick={downloadTemplate}
            className="px-4 py-2 rounded-lg bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-200 text-sm font-medium shadow-theme-xs hover:bg-blue-200 dark:hover:bg-blue-800 transition flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faDownload} className="w-5 h-5" />
            Download Template Excel
          </button>
        </div>
      </div>
      {/* Search dan Filter */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 mb-6">
        <div className="w-full lg:w-72">
            <div className="relative">
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 w-full lg:w-auto">
          <select
            value={filterSemester}
            onChange={(e) => { setFilterSemester(e.target.value); setPage(1); }}
            className="w-full h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">Semua Semester</option>
            {semesterOptions.map((semester) => (
              <option key={semester} value={semester}>Semester {semester}</option>
            ))}
          </select>
          <select
            value={filterPeriode}
            onChange={(e) => { setFilterPeriode(e.target.value); setPage(1); }}
            className="w-full h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">Semua Periode</option>
            {periodeOptions.map((periode) => (
              <option key={periode} value={periode}>{periode}</option>
            ))}
          </select>
          <select
            value={filterStatus}
            onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
            className="w-full h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">Semua Status</option>
            {statusOptions.map((status) => (
              <option key={status} value={status}>{status}</option>
            ))}
          </select>
          <select
            value={filterGender}
            onChange={(e) => { setFilterGender(e.target.value); setPage(1); }}
            className="w-full h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">Semua Gender</option>
            {genderOptions.map((gender) => (
              <option key={gender} value={gender}>{gender}</option>
            ))}
          </select>
          <select
            value={filterAngkatan}
            onChange={(e) => { setFilterAngkatan(e.target.value); setPage(1); }}
            className="w-full h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">Semua Angkatan</option>
            {angkatanOptions.map((angkatan) => (
              <option key={angkatan} value={angkatan}>{angkatan}</option>
            ))}
          </select>
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
      <AnimatePresence>
        {importedCount > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
          >
            {importedCount} data mahasiswa berhasil diimpor ke database.
          </motion.div>
        )}
      </AnimatePresence>
      {/* Preview Data Section */}
      {importedFile && (
        <div className="w-full mt-4">
          <div className="mb-2 text-sm text-gray-700 dark:text-gray-200 font-semibold">
            Preview Data: <span className="font-normal text-gray-500 dark:text-gray-400">{importedFile.name}</span>
          </div>
          {/* Error di atas tabel preview */}
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
                    ? cellErrors.map((err, idx) => (
                        <li key={idx}>
                          {err.message} (Baris {err.row + 2}, Kolom {err.field.toUpperCase()}): {previewData.find(r => r.nim === err.nim)?.[err.field] || ''}
                        </li>
                      ))
                    : validationErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                </ul>
              </div>
            </div>
          )}
          {/* Table Preview */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <div
              className="max-w-full overflow-x-auto"
              style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
              <style>{`
                .max-w-full::-webkit-scrollbar { display: none; }
              `}</style>
          <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
            <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <tr>
                    {previewData[0] && Object.keys(previewData[0]).map((colKey) => (
                      <th
                        key={colKey}
                        className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400"
                      >
                        {colKey.toUpperCase()}
                      </th>
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
                                    if (["nim", "telepon", "angkatan"].includes(colKey)) {
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
            {/* Pagination Preview */}
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                  disabled={previewPage === 1}
                  className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  Prev
                </button>
                
                {/* Smart Pagination with Scroll for Preview */}
                <div className="flex items-center gap-1 max-w-[400px] overflow-x-auto pagination-scroll" style={{
                  scrollbarWidth: 'thin',
                  scrollbarColor: '#cbd5e1 #f1f5f9'
                }}>
                  {/* Always show first page */}
                  <button
                    onClick={() => setPreviewPage(1)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                      previewPage === 1
                        ? 'bg-brand-500 text-white'
                        : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    1
                  </button>
                  
                  {/* Show ellipsis if current page is far from start */}
                  {previewPage > 4 && (
                    <span className="px-2 text-gray-500 dark:text-gray-400">...</span>
                  )}
                  
                  {/* Show pages around current page */}
                  {Array.from({ length: previewTotalPages }, (_, i) => {
                    const pageNum = i + 1;
                    // Show pages around current page (2 pages before and after)
                    const shouldShow = pageNum > 1 && pageNum < previewTotalPages && 
                      (pageNum >= previewPage - 2 && pageNum <= previewPage + 2);
                    
                    if (!shouldShow) return null;
                    
                    return (
                      <button
                        key={i}
                        onClick={() => setPreviewPage(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                          previewPage === pageNum
                            ? 'bg-brand-500 text-white'
                            : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}
                  
                  {/* Show ellipsis if current page is far from end */}
                  {previewPage < previewTotalPages - 3 && (
                    <span className="px-2 text-gray-500 dark:text-gray-400">...</span>
                  )}
                  
                  {/* Always show last page if it's not the first page */}
                  {previewTotalPages > 1 && (
                    <button
                      onClick={() => setPreviewPage(previewTotalPages)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                        previewPage === previewTotalPages
                          ? 'bg-brand-500 text-white'
                          : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                      }`}
                    >
                      {previewTotalPages}
                    </button>
                  )}
                </div>
                
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
              className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
              onClick={() => {
                setImportedFile(null);
                setPreviewData([]);
                setValidationErrors([]);
                setCellErrors([]);
                setError("");
                setSuccess("");
                setPreviewPage(1);
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
              disabled={isSaving || isImporting || loading}
            >
              {(isSaving || isImporting) ? (
                <>
                  <svg className="w-5 h-5 mr-2 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                  </svg>
                  {isImporting ? 'Mengimpor data...' : 'Mengimpor...'}
                </>
              ) : (
                'Import ke Database'
              )}
            </button>
          </div>
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div
          className="max-w-full overflow-x-auto"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          <style>{`
            .max-w-full::-webkit-scrollbar { display: none; }
          `}</style>
          <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
            <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <tr>
                <th className="px-4 py-4">
                  <button
                    type="button"
                    aria-checked={filteredData.length > 0 && filteredData.every(m => selectedRows.includes(String(m.id || m.nim)))}
                    role="checkbox"
                    onClick={() => {
                      if (filteredData.length > 0 && filteredData.every(m => selectedRows.includes(String(m.id || m.nim)))) {
                        setSelectedRows([]);
                      } else {
                        setSelectedRows(filteredData.map(m => String(m.id || m.nim)));
                      }
                    }}
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${filteredData.length > 0 && filteredData.every(m => selectedRows.includes(String(m.id || m.nim))) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                  >
                    {filteredData.length > 0 && filteredData.every(m => selectedRows.includes(String(m.id || m.nim))) && (
                      <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <polyline points="20 7 11 17 4 10" />
                      </svg>
                    )}
                  </button>
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">NIM</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">Nama</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">Username</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">Nomor Telepon</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">Email</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">Gender</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">IPK</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">Status</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">Angkatan</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">Semester</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400">Aksi</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: pageSize }).map((_, idx) => (
                  <tr key={idx}>
                    <td className="px-4 py-4">
                      <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    {Array.from({ length: 10 }).map((_, colIdx) => (
                      <td key={colIdx} className="px-6 py-4">
                        <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse opacity-80"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : paginatedData.length > 0 ? (
                paginatedData.map((m, _) => (
                  <tr key={m.id || m.nim} className={_ % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''}>
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        aria-checked={selectedRows.includes(String(m.id || m.nim))}
                        role="checkbox"
                        onClick={() => {
                          if (selectedRows.includes(String(m.id || m.nim))) {
                            setSelectedRows(selectedRows.filter(id => id !== String(m.id || m.nim)));
                          } else {
                            setSelectedRows([...selectedRows, String(m.id || m.nim)]);
                          }
                        }}
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${selectedRows.includes(String(m.id || m.nim)) ? "bg-brand-500 border-brand-500" : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"} cursor-pointer`}
                      >
                        {selectedRows.includes(String(m.id || m.nim)) && (
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                            <polyline points="20 7 11 17 4 10" />
                          </svg>
                        )}
                      </button>
                    </td>
                  <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800 dark:text-white/90 align-middle">{m.nim}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">{m.name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">{m.username}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">{m.telp}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">{m.email}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">{formatGenderDisplay(m.gender)}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">{m.ipk}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle capitalize">{m.status}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">{m.angkatan}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">{m.semester ?? '-'}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => handleEdit(m)}
                        className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 transition"
                        title="Edit"
                      >
                        <FontAwesomeIcon icon={faPenToSquare} className="w-5 h-5" />
                        Edit
                      </button>
                      <button
                          onClick={() => handleDelete(m.id!.toString())}
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
                  <td colSpan={11} className="text-center py-8 text-gray-400 dark:text-gray-500">Belum ada data.</td>
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
            className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
          >
            <div className="flex items-center justify-between pb-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-white">Konfirmasi Hapus Data</h2>
            </div>
            <div>
              <p className="mb-6 text-gray-500 dark:text-gray-400">
                Apakah Anda yakin ingin menghapus <span className="font-semibold text-gray-800 dark:text-white">{selectedRows.length}</span> data mahasiswa terpilih? Data yang dihapus tidak dapat dikembalikan.
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
                      // Delete each user individually and handle errors gracefully
                      const deletePromises = selectedRows.map(async (id) => {
                        try {
                          await api.delete(`/users/${id}`);
                          return { id, success: true };
                        } catch (error) {
                          console.error(`Failed to delete user ${id}:`, error);
                          return { id, success: false, error };
                        }
                      });
                      
                      const results = await Promise.all(deletePromises);
                      const successfulDeletes = results.filter(r => r.success);
                      const failedDeletes = results.filter(r => !r.success);
                      
                      // Refresh data
                      const res = await api.get("/users?role=mahasiswa");
                      setData(res.data);
                      
                      if (failedDeletes.length > 0) {
                        setError(`${failedDeletes.length} data gagal dihapus (mungkin sudah tidak ada). ${successfulDeletes.length} data berhasil dihapus.`);
                      } else {
                        setSuccess(`${successfulDeletes.length} data mahasiswa berhasil dihapus.`);
                      }
                      
                      setSelectedRows([]);
                    } catch (error) {
                      console.error('Bulk delete error:', error);
                      setError("Gagal menghapus data terpilih");
                    } finally {
                      setIsDeleting(false);
                      setLoading(false);
                    }
                  }}
                  className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
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
                      Menghapus...
                    </>
                  ) : (
                    "Delete"
                  )}
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
            onClick={() => { setShowModal(false); setForm({ nim: "", name: "", username: "", telp: "", email: "", gender: "Laki-laki", ipk: 0, status: "aktif", angkatan: "", password: "" }); }}
          ></div>
          {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-xl xl:max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
            {/* Close Button */}
            <button
              onClick={() => { setShowModal(false); setForm({ nim: "", name: "", username: "", telp: "", email: "", gender: "Laki-laki", ipk: 0, status: "aktif", angkatan: "", password: "" }); }}
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
                  {editMode ? 'Edit Mahasiswa' : 'Tambah Mahasiswa'}
                </h2>
              </div>
              <div>
                <form>
                  <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-4 gap-y-5">
                    {/* Kiri */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">NIM</label>
                      <input 
                        type="text" 
                        name="nim" 
                        value={form.nim} 
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Gender</label>
                      <select name="gender" value={form.gender} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500">
                        <option value="Laki-laki">Laki-laki</option>
                        <option value="Perempuan">Perempuan</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Nama</label>
                      <input type="text" name="name" value={form.name} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">IPK</label>
                      <input 
                        type="number" 
                        name="ipk" 
                        value={form.ipk} 
                        min={0} 
                        max={4} 
                        step={0.01} 
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
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Status</label>
                      <select name="status" value={form.status} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500">
                        {STATUS_OPTIONS.map(opt => (
                          <option key={opt} value={opt}>{opt.charAt(0).toUpperCase() + opt.slice(1)}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Email</label>
                      <input type="email" name="email" value={form.email} onChange={handleInputChange} className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">Angkatan</label>
                      <input 
                        type="text" 
                        name="angkatan" 
                        value={form.angkatan} 
                        onChange={handleInputChange} 
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                        pattern="[0-9]*"
                        inputMode="numeric"
                        onKeyDown={handleNumberInput}
                        autoComplete="off"
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
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Semester
                        {activeSemester && (
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            (Otomatis: {activeSemester.jenis === 'Ganjil' ? '1' : '2'} - {activeSemester.jenis} {activeSemester.tahun})
                          </span>
                        )}
                      </label>
                      <input
                        type="number"
                        name="semester"
                        value={form.semester ?? ''}
                        min={1}
                        max={8}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder={activeSemester ? `Otomatis: ${activeSemester.jenis === 'Ganjil' ? '1' : '2'}` : 'Masukkan semester'}
                        disabled={true}
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Semester akan otomatis disesuaikan dengan semester aktif ({activeSemester ? `${activeSemester.jenis} ${activeSemester.tahun}` : 'Tidak ada semester aktif'})
                      </p>
                    </div>
                  </div>
                  {error && (
                    <div className="text-sm text-red-500 bg-red-100 rounded p-2 mt-6">{error}</div>
                  )}
                  <div className="flex justify-end gap-2 pt-6">
                    <button
                      type="button"
                      onClick={() => { setShowModal(false); setForm({ nim: "", name: "", username: "", telp: "", email: "", gender: "Laki-laki", ipk: 0, status: "aktif", angkatan: "", password: "" }); }}
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
                </form>
              </div>
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
                  Apakah Anda yakin ingin menghapus data mahasiswa <span className="font-semibold text-gray-800 dark:text-white">{userToDelete?.name || selectedDeleteNim}</span>? Data yang dihapus tidak dapat dikembalikan.
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
