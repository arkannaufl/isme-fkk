import { useState, ChangeEvent, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileExcel,
  faPenToSquare,
  faTrash,
  faDownload,
  faChevronDown,
  faEye,
  faUpload,
} from "@fortawesome/free-solid-svg-icons";
import { AnimatePresence, motion } from "framer-motion";
import api, { handleApiError } from "../utils/api";
import * as XLSX from "xlsx";
import { Listbox, Transition } from "@headlessui/react";
import { useNavigate } from "react-router-dom";

// Komponen input kustom untuk DatePickerz
type MataKuliah = {
  kode: string;
  nama: string;
  semester: number | string;
  periode: string;
  jenis: "Blok" | "Non Blok";
  kurikulum: number;
  tanggalMulai: string;
  tanggalAkhir: string;
  blok: number | null;
  durasiMinggu: number | null;
  tipe_non_block?: "CSR" | "Non-CSR";
  tanggal_mulai?: string;
  tanggal_akhir?: string;
  durasi_minggu?: number | null;
  peran_dalam_kurikulum?: string[];
  keahlian_required?: string[];
  rps_file?: string;
  materi?: MateriFromAPI[];
};

// Fungsi untuk menghitung durasi dalam minggu
const calculateWeeks = (startDate: string, endDate: string): number | null => {
  if (!startDate || !endDate) return null;
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diffTime = Math.abs(end.getTime() - start.getTime());
  const diffWeeks = Math.ceil(diffTime / (1000 * 60 * 60 * 24 * 7));
  return diffWeeks;
};

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];
const JENIS_OPTIONS = ["Blok", "Non Blok"];
const SEMESTER_OPTIONS = ["Antara", 1, 2, 3, 4, 5, 6, 7];

// Fungsi untuk mendapatkan nomor blok berikutnya yang tersedia
const getNextAvailableBlok = (
  semester: number | string,
  data: MataKuliah[],
  currentBlok: number | null = null
) => {
  // Dapatkan semua mata kuliah blok di semester yang sama (kecuali yang sedang diedit)
  // Normalisasi semester untuk perbandingan (string vs number)
  const normalizedSemester = String(semester);
  const blokInSemester = data
    .filter(
      (mk: MataKuliah) =>
        String(mk.semester) === normalizedSemester &&
        mk.jenis === "Blok" &&
        mk.blok !== null &&
        mk.blok !== currentBlok
    )
    .map((mk: MataKuliah) => mk.blok as number)
    .sort((a, b) => a - b);

  // Jika tidak ada blok di semester tersebut, mulai dari 1
  if (blokInSemester.length === 0) {
    return 1;
  }

  // Cari nomor blok terkecil yang belum digunakan
  let nextBlok = 1;
  for (const blok of blokInSemester) {
    if (nextBlok === blok) {
      nextBlok++;
    } else {
      break;
    }
  }

  return nextBlok;
};

// Fungsi untuk mengkonversi tanggal dari Excel ke format YYYY-MM-DD
const convertExcelDate = (value: any): string => {
  if (!value || value === "") return "";

  // Jika sudah dalam format YYYY-MM-DD, return as is
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }

  // Jika berupa number (Excel date serial number)
  if (typeof value === "number") {
    // Excel date serial number: days since 1900-01-01
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(
      excelEpoch.getTime() + (value - 2) * 24 * 60 * 60 * 1000
    );
    return date.toISOString().split("T")[0];
  }

  // Jika berupa string yang bisa di-parse sebagai tanggal
  if (typeof value === "string") {
    const date = new Date(value);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split("T")[0];
    }
  }

  // Jika berupa Date object
  if (value instanceof Date) {
    return value.toISOString().split("T")[0];
  }

  // Jika tidak bisa dikonversi, return string kosong
  return "";
};

// Fungsi untuk mengurutkan data berdasarkan blok
const sortDataByBlok = (data: MataKuliah[]) => {
  return [...data].sort((a, b) => {
    // Jika kedua item adalah blok, urutkan berdasarkan nomor blok
    if (a.jenis === "Blok" && b.jenis === "Blok") {
      return (a.blok || 0) - (b.blok || 0);
    }
    // Jika hanya satu yang blok, letakkan yang non-blok di awal
    if (a.jenis === "Non Blok") return -1;
    if (b.jenis === "Non Blok") return 1;
    return 0;
  });
};

// Helper untuk menentukan periode dari semester
const getPeriodeBySemester = (semester: number | string) => {
  if (!semester) return "";
  if (semester === "Antara") return "Antara";
  return Number(semester) % 2 === 1 ? "Ganjil" : "Genap";
};

// Helper untuk membandingkan semester dengan fleksibilitas tipe data
const isSemesterMatch = (
  dataSemester: string | number,
  filterSemester: string | number
) => {
  if (filterSemester === "all") return true;
  if (filterSemester === "Antara") return dataSemester === "Antara";
  return (
    dataSemester === filterSemester ||
    dataSemester === String(filterSemester) ||
    dataSemester === Number(filterSemester)
  );
};

// Helper untuk mendapatkan semester yang sesuai dengan semester aktif
const getSemesterOptionsForActivePeriod = (
  activeSemesterJenis: string | null,
  allData: MataKuliah[]
) => {
  // Ambil semua semester unik dari data
  const allSemesters = Array.from(new Set(allData.map((d) => d.semester)));

  // Jika tidak ada semester aktif, tampilkan semua semester
  if (!activeSemesterJenis) {
    return allSemesters.sort((a, b) => {
      if (a === "Antara") return -1;
      if (b === "Antara") return 1;
      return Number(a) - Number(b);
    });
  }

  // Filter semester berdasarkan periode aktif
  const filteredSemesters = allSemesters.filter((semester) => {
    // Selalu include Semester Antara
    if (semester === "Antara") return true;

    // Cari mata kuliah dengan semester ini
    const mataKuliah = allData.find((mk) => mk.semester === semester);
    if (!mataKuliah) return false;

    // Include jika periode sama dengan semester aktif
    return mataKuliah.periode === activeSemesterJenis;
  });

  return filteredSemesters.sort((a, b) => {
    if (a === "Antara") return -1;
    if (b === "Antara") return 1;
    return Number(a) - Number(b);
  });
};

// Helper untuk cek overlap tanggal
function isDateOverlap(
  start1: string,
  end1: string,
  start2: string,
  end2: string
) {
  if (!start1 || !end1 || !start2 || !end2) return false;
  const s1 = new Date(start1);
  const e1 = new Date(end1);
  const s2 = new Date(start2);
  const e2 = new Date(end2);
  return s1 <= e2 && s2 <= e1;
}

// Helper untuk konversi tanggal ISO ke yyyy-MM-dd
function toDateInputValue(dateString: string) {
  if (!dateString) return "";
  const d = new Date(dateString);
  if (isNaN(d.getTime())) return "";
  const month = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}`;
}

// Helper untuk konversi tanggal ke yyyy-MM-dd (untuk backend MySQL)
function toDateYMD(dateString: string) {
  if (!dateString) return null;
  return dateString.slice(0, 10);
}

// Tipe untuk CSR
interface CSRItem {
  id?: number;
  nomor_csr: string;
  tanggal_mulai: string;
  tanggal_akhir: string;
  keahlian_required?: string[];
}

// Tipe untuk PBL
type PBLItem = {
  id?: number;
  modul_ke: string;
  nama_modul: string;
};

// Tipe untuk Jurnal Reading
type JurnalReadingItem = {
  id?: number;
  topik_ke: string;
  nama_topik: string;
};

// Tipe untuk materi terpisah
interface MateriItem {
  id: number;
  kode_mata_kuliah: string;
  filename: string;
  judul: string;
  file_type: string;
  file_size: number;
  file_path: string;
  upload_date: string;
}

// Tipe untuk materi dari API (bisa berbeda dengan MateriItem)
interface MateriFromAPI {
  id: number;
  kode_mata_kuliah: string;
  filename: string;
  judul: string;
  file_type: string;
  file_size: number;
  file_path: string;
  upload_date: string;
}

export default function MataKuliah() {
  const navigate = useNavigate();
  const [data, setData] = useState<MataKuliah[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteKode, setSelectedDeleteKode] = useState<string | null>(
    null
  );
  const [form, setForm] = useState<MataKuliah>({
    kode: "",
    nama: "",
    semester: 1 as number | string,
    periode: "Ganjil",
    jenis: "Non Blok",
    kurikulum: new Date().getFullYear(),
    tanggalMulai: "",
    tanggalAkhir: "",
    blok: null,
    durasiMinggu: null,
    tipe_non_block: "Non-CSR",
    peran_dalam_kurikulum: [],
    keahlian_required: [],
  });
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [cellErrors, setCellErrors] = useState<
    { row: number; field: string; message: string; kode?: string }[]
  >([]);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);
  const previewTotalPages = Math.ceil(previewData.length / previewPageSize);
  const paginatedPreviewData = previewData.slice(
    (previewPage - 1) * previewPageSize,
    previewPage * previewPageSize
  );
  const [editingCell, setEditingCell] = useState<{
    row: number;
    key: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState("");
  const [filterSemester, setFilterSemester] = useState<string>("all");
  const [filterPeriode, setFilterPeriode] = useState<string>("all");
  const [filterJenis, setFilterJenis] = useState<string>("all");
  const [filterKurikulum, setFilterKurikulum] = useState<string>("all");
  const [filterBlok, setFilterBlok] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [editMode, setEditMode] = useState(false);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [success, setSuccess] = useState<string | null>(null);
  const [importedCount, setImportedCount] = useState(0);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [showDeleteModalBulk, setShowDeleteModalBulk] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  // Tambahan state untuk evaluasi dinamis
  const [csrList, setCsrList] = useState<CSRItem[]>([]);
  const [jumlahPBL, setJumlahPBL] = useState(1);
  const [pblList, setPblList] = useState<PBLItem[]>([]);
  // State untuk Jurnal Reading
  const [jurnalReadingList, setJurnalReadingList] = useState<
    JurnalReadingItem[]
  >([]);
  // State untuk menyimpan jurnal reading asli dari backend saat edit
  const [oldJurnalReadingList, setOldJurnalReadingList] = useState<
    JurnalReadingItem[]
  >([]);
  // Tambahan state untuk CSR yang dihapus
  const [deletedCsrIds, setDeletedCsrIds] = useState<number[]>([]);
  // State untuk keahlian CSR
  const [csrKeahlian, setCsrKeahlian] = useState<{ [csrId: string]: string[] }>(
    {}
  );
  const [newKeahlianCSR, setNewKeahlianCSR] = useState<{
    [csrId: string]: string;
  }>({});
  // State untuk menyimpan CSR asli dari backend saat edit
  const [oldCsrList, setOldCsrList] = useState<CSRItem[]>([]);
  // Tambahkan state untuk semester aktif
  const [activeSemesterJenis, setActiveSemesterJenis] = useState<string | null>(
    null
  );
  // Tambahkan state untuk daftar peran kurikulum global
  const [peranKurikulumInput, setPeranKurikulumInput] = useState("");
  const [peranKurikulumList, setPeranKurikulumList] = useState<string[]>([]);
  // Tambahkan state untuk input dan list keahlian
  const [keahlianInput, setKeahlianInput] = useState("");
  const [keahlianList, setKeahlianList] = useState<string[]>([]);
  // State untuk menyimpan PBL asli dari backend saat edit
  const [oldPblList, setOldPblList] = useState<PBLItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  // State untuk error di modal (ditampilkan di dalam modal, bukan di atas table)
  const [modalError, setModalError] = useState<string | null>(null);
  // State untuk menyimpan kode original saat edit (untuk handle perubahan kode)
  const [originalKode, setOriginalKode] = useState<string | null>(null);

  // State untuk menangani file RPS
  const [rpsFile, setRpsFile] = useState<File | null>(null);
  const [existingRpsFile, setExistingRpsFile] = useState<string | null>(null);
  const rpsFileInputRef = useRef<HTMLInputElement>(null);

  // State untuk menangani file materi
  const [materiFiles, setMateriFiles] = useState<File[]>([]);
  const [materiItems, setMateriItems] = useState<MateriItem[]>([]);
  const [existingMateriItems, setExistingMateriItems] = useState<MateriItem[]>(
    []
  );
  const materiFileInputRef = useRef<HTMLInputElement>(null);
  // Tambahkan state untuk materi yang ditandai untuk dihapus
  const [materiToDelete, setMateriToDelete] = useState<number[]>([]);

  const [showUploadMateriModal, setShowUploadMateriModal] = useState(false);
  const [selectedMataKuliah, setSelectedMataKuliah] =
    useState<MataKuliah | null>(null);
  const [showViewMateriModal, setShowViewMateriModal] = useState(false);
  const [selectedMateriMataKuliah, setSelectedMateriMataKuliah] =
    useState<MataKuliah | null>(null);

  // State untuk tracking download progress
  const [downloadProgress, setDownloadProgress] = useState<{
    [key: number]: boolean;
  }>({});
  // State khusus untuk ZIP download
  const [isZipDownloading, setIsZipDownloading] = useState(false);

  // State error khusus untuk modal upload materi
  const [uploadMateriError, setUploadMateriError] = useState<string | null>(
    null
  );

  // State success khusus untuk modal upload materi
  const [uploadMateriSuccess, setUploadMateriSuccess] = useState<string | null>(
    null
  );

  // Fungsi untuk reset download state per file

  // Auto cleanup untuk memastikan state tidak stuck
  useEffect(() => {
    const interval = setInterval(() => {
      // Auto reset jika state stuck lebih dari 30 detik
      if (Object.keys(downloadProgress).length > 0) {
        const now = Date.now();
        const lastActivity = localStorage.getItem("lastDownloadActivity");
        if (lastActivity && now - parseInt(lastActivity) > 30000) {
          // Auto resetting stuck download state
          setDownloadProgress({});
          localStorage.removeItem("lastDownloadActivity");
        }
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [downloadProgress]);

  // Set activity timestamp ketika download dimulai
  useEffect(() => {
    if (Object.keys(downloadProgress).length > 0) {
      localStorage.setItem("lastDownloadActivity", Date.now().toString());
    } else {
      localStorage.removeItem("lastDownloadActivity");
    }
  }, [downloadProgress]);

  // Auto-clear upload materi messages
  useEffect(() => {
    if (uploadMateriError || uploadMateriSuccess) {
      const timer = setTimeout(() => {
        setUploadMateriError(null);
        setUploadMateriSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [uploadMateriError, uploadMateriSuccess]);

  const mataKuliahToDelete = data.find((mk) => mk.kode === selectedDeleteKode);

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (importedCount > 0) {
      const timer = setTimeout(() => {
        setImportedCount(0);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [importedCount]);

  // Fetch semester aktif
  const fetchActiveSemester = async () => {
    try {
      const res = await api.get("/tahun-ajaran/active");
      // Ambil semester aktif (jika ada)
      const semester = res.data?.semesters?.[0];
      if (semester && semester.jenis) {
        setActiveSemesterJenis(semester.jenis);
      } else {
        setActiveSemesterJenis(null);
      }
    } catch (e) {
      setActiveSemesterJenis(null);
    }
  };

  /**
   * Fetch data from API dengan optimasi batch request
   *
   * Optimasi yang dilakukan:
   * 1. Menggunakan endpoint batch '/mata-kuliah-with-materi' untuk mengambil semua data dalam satu request
   * 2. Menerapkan pagination untuk data besar (100 item per request)
   * 3. Fallback ke endpoint tanpa pagination jika pagination gagal
   * 4. Query optimization di backend dengan select kolom yang diperlukan saja
   * 5. Grouping materi berdasarkan kode mata kuliah untuk mengurangi jumlah query
   *
   * Performa: Dari N+1 queries menjadi 2 queries (1 untuk mata kuliah, 1 untuk materi)
   */
  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null); // Reset error state

      // Coba ambil data dengan pagination terlebih dahulu untuk performa optimal
      let response;
      try {
        response = await api.get("/mata-kuliah-with-materi", {
          params: {
            per_page: 100, // Ambil 100 item per request untuk performa optimal
            page: 1,
          },
        });

        // Handle response pagination
        if (response.data && response.data.data) {
          setData(response.data.data);
        } else {
          setData([]);
        }
      } catch (paginationError) {
        // Jika pagination gagal, gunakan endpoint tanpa pagination

        response = await api.get("/mata-kuliah-with-materi-all");
        const mataKuliahData = Array.isArray(response.data)
          ? response.data
          : [];
        setData(mataKuliahData);
      }
    } catch (error: any) {
      setError(handleApiError(error, "Memuat data mata kuliah"));
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActiveSemester();
    fetchData();
  }, []);

  // Fetch daftar peran kurikulum global (untuk referensi, bisa diambil dari semua mata kuliah atau manual)
  useEffect(() => {
    api.get("/mata-kuliah/peran-kurikulum-options").then((res) => {
      if (Array.isArray(res.data)) setPeranKurikulumList(res.data);
    });
  }, []);

  // Fetch daftar keahlian global (bisa dari API atau hardcode dulu)
  useEffect(() => {
    api
      .get("/mata-kuliah/keahlian-options")
      .then((res) => {
        if (Array.isArray(res.data)) setKeahlianList(res.data);
      })
      .catch(() => {
        // fallback jika API belum ada
        setKeahlianList([
          "Anatomi",
          "Fisiologi",
          "Biokimia Dasar",
          "Patologi",
          "Farmakologi",
          "Kardiologi",
          "Pulmonologi",
          "Gastroenterologi",
          "Neurologi",
          "Radiologi",
          "Pediatri",
          "Ginekologi",
          "Psikiatri",
          "Dermatologi",
          "Oftalmologi",
          "Imunologi",
          "Bedah",
          "Nutrisi",
          "Epidemiologi",
          "Kesehatan Masyarakat",
        ]);
      });
  }, []);

  const handleSaveData = async () => {
    setIsSaving(true);
    setModalError(null); // Reset modal error saat mulai save
    try {
      setSuccess(null);
      // Validasi custom sebelum submit
      // 1. Validasi kode mata kuliah
      if (!form.kode || form.kode.trim().length === 0) {
        setError("Kode mata kuliah harus diisi.");
        setIsSaving(false);
        return;
      }
      if (form.kode.length > 255) {
        setError("Kode mata kuliah maksimal 255 karakter.");
        setIsSaving(false);
        return;
      }
      // 2. Validasi blok untuk mata kuliah jenis Blok
      if (
        form.jenis === "Blok" &&
        (!form.blok || form.blok < 1 || !Number.isInteger(form.blok))
      ) {
        setError(
          "Nomor blok harus berupa bilangan bulat positif (1, 2, 3, dst.)."
        );
        setIsSaving(false);
        return;
      }
      // Deteksi apakah kode berubah (hanya untuk edit mode)
      const isKodeChanged = editMode && originalKode && form.kode !== originalKode;
      
      // 2. Tanggal blok tidak boleh overlap (diabaikan jika hanya kode yang berubah)
      if (form.jenis === "Blok" && !isKodeChanged) {
        const overlap = data.some(
          (mk) =>
            mk.semester === form.semester &&
            mk.jenis === "Blok" &&
            mk.kode !== (originalKode || form.kode) &&
            isDateOverlap(
              form.tanggalMulai || form.tanggal_mulai || "",
              form.tanggalAkhir || form.tanggal_akhir || "",
              mk.tanggalMulai || mk.tanggal_mulai || "",
              mk.tanggalAkhir || mk.tanggal_akhir || ""
            )
        );
        if (overlap) {
          setError(
            "Tanggal Blok tidak boleh bentrok dengan Blok lain di semester yang sama."
          );
          setIsSaving(false);
          return;
        }
      }
      // 3. Tanggal akhir harus setelah tanggal mulai
      if (
        form.tanggalMulai &&
        form.tanggalAkhir &&
        new Date(form.tanggalAkhir) < new Date(form.tanggalMulai)
      ) {
        setError("Tanggal Akhir harus setelah Tanggal Mulai.");
        setIsSaving(false);
        return;
      }
      const formData = {
        ...form,
        tipe_non_block: form.tipe_non_block,
        tanggal_mulai: form.tanggalMulai,
        tanggal_akhir: form.tanggalAkhir,
        durasi_minggu: form.durasiMinggu,
        peran_dalam_kurikulum: form.peran_dalam_kurikulum,
        keahlian_required: form.keahlian_required,
      };

      // Handle RPS file upload (hanya untuk edit mode)
      let rpsFileName = form.rps_file;
      if (rpsFile && editMode) {
        const rpsFormData = new FormData();
        rpsFormData.append("rps_file", rpsFile);
        rpsFormData.append("kode", form.kode);

        try {
          const rpsResponse = await api.post(
            "/mata-kuliah/upload-rps",
            rpsFormData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            }
          );
          rpsFileName = rpsResponse.data.filename;
        } catch (error: any) {
          // Ambil error message dari backend
          const errorMessage = error.response?.data?.error || 
                               error.response?.data?.message || 
                               error.message || 
                               "Gagal mengupload file RPS";
          setModalError(errorMessage); // Tampilkan error di modal, bukan di atas table
          setIsSaving(false);
          return;
        }
      }

      // Handle materi files upload (hanya untuk edit mode)
      if (materiFiles.length > 0 && editMode) {
        try {
          const uploadPromises = materiItems.map(async (item) => {
            const file = materiFiles.find((f) => f.name === item.filename);
            if (!file) return;

            const materiFormData = new FormData();
            materiFormData.append("materi_file", file);
            materiFormData.append("kode", form.kode);
            materiFormData.append("judul", item.judul);

            const materiResponse = await api.post(
              "/mata-kuliah/upload-materi",
              materiFormData,
              {
                headers: {
                  "Content-Type": "multipart/form-data",
                },
              }
            );
            return materiResponse.data.data.filename;
          });

          await Promise.all(uploadPromises);
        } catch (error: any) {
          // Ambil error message dari backend
          const errorMessage = error.response?.data?.error || 
                               error.response?.data?.message || 
                               error.message || 
                               "Gagal mengupload file materi";
          setModalError(errorMessage); // Tampilkan error di modal, bukan di atas table
          setIsSaving(false);
          return;
        }
      }

      // Update judul existing materi jika ada perubahan
      if (editMode && existingMateriItems.length > 0) {
        try {
          await Promise.all(
            existingMateriItems.map(async (item) => {
              // Update judul materi di database
              await api.put(`/mata-kuliah/${form.kode}/update-materi-judul`, {
                filename: item.filename,
                judul: item.judul,
              });
            })
          );
        } catch (error) {
          setError("Gagal mengupdate judul materi");
          setIsSaving(false);
          return;
        }
      }

      if (editMode) {
        // Jika kode berubah, gunakan endpoint khusus untuk update kode dengan swap logic
        if (isKodeChanged && originalKode) {
          const response = await api.put(`/mata-kuliah/${originalKode}/update-kode`, {
            new_kode: form.kode,
            ...formData,
            rps_file: rpsFileName,
          });
          setSuccess("Kode mata kuliah berhasil diubah dan semua data terkait telah diupdate");
          // Jika kode berubah, backend sudah handle semua update termasuk PBL/CSR/Jurnal
          // Jadi kita skip sinkronisasi di frontend
        } else {
          // Update normal jika kode tidak berubah
          const kodeToUse = originalKode || form.kode;
          await api.put(`/mata-kuliah/${kodeToUse}`, {
            ...formData,
            rps_file: rpsFileName,
          });
          setSuccess("Data mata kuliah berhasil diperbarui");
          
          // --- Sinkronisasi PBL ---
        if (form.jenis === "Blok") {
          // 1. Hapus modul yang dihapus
          const oldIds = oldPblList.map((p) => p.id);
          const newIds = pblList.map((p) => p.id).filter(Boolean);
          const deletedIds = oldIds.filter((id) => !newIds.includes(id));
          await Promise.all(deletedIds.map((id) => api.delete(`/pbls/${id}`)));
          // 2. Update modul yang sudah ada
          await Promise.all(
            pblList
              .filter((p) => p.id)
              .map((p, idx) =>
                api.put(`/pbls/${p.id}`, {
                  modul_ke: String(idx + 1),
                  nama_modul: p.nama_modul,
                })
              )
          );
          // 3. Tambah modul baru
          await Promise.all(
            pblList
              .filter((p) => !p.id)
              .map((p, idx) =>
                api.post(`/mata-kuliah/${form.kode}/pbls`, {
                  modul_ke: String(idx + 1),
                  nama_modul: p.nama_modul,
                })
              )
          );

          // --- Sinkronisasi Jurnal Reading ---
          // 1. Hapus topik yang dihapus
          const oldJurnalIds = oldJurnalReadingList.map((j) => j.id);
          const newJurnalIds = jurnalReadingList
            .map((j) => j.id)
            .filter(Boolean);
          const deletedJurnalIds = oldJurnalIds.filter(
            (id) => !newJurnalIds.includes(id)
          );
          await Promise.all(
            deletedJurnalIds.map((id) => api.delete(`/jurnal-readings/${id}`))
          );
          // 2. Update topik yang sudah ada
          await Promise.all(
            jurnalReadingList
              .filter((j) => j.id)
              .map((j, idx) =>
                api.put(`/jurnal-readings/${j.id}`, {
                  topik_ke: String(idx + 1),
                  nama_topik: j.nama_topik,
                })
              )
          );
          // 3. Tambah topik baru
          await Promise.all(
            jurnalReadingList
              .filter((j) => !j.id)
              .map((j, idx) =>
                api.post(`/mata-kuliah/${form.kode}/jurnal-readings`, {
                  topik_ke: String(idx + 1),
                  nama_topik: j.nama_topik,
                })
              )
          );
        }

        // Sinkronisasi CSR (hanya jika bukan semester Antara)
        if (form.semester !== "Antara") {

          try {
            // 1. Update/POST CSR dengan keahlian
            await Promise.all(
              csrList.map(async (csr, index) => {
                const csrId = csr.id ? csr.id.toString() : `temp_${index}`;
                const keahlianList = csrKeahlian[csrId] || [];

                if (csr.id) {
                  // PUT - Update CSR yang sudah ada
                  await api.put(`/csrs/${csr.id}`, {
                    nomor_csr: csr.nomor_csr,
                    tanggal_mulai: toDateYMD(csr.tanggal_mulai),
                    tanggal_akhir: toDateYMD(csr.tanggal_akhir),
                    keahlian_required: keahlianList,
                  });
                } else {
                  // POST - Create new CSR
                  await api.post(`/mata-kuliah/${form.kode}/csrs`, {
                    nomor_csr: csr.nomor_csr,
                    tanggal_mulai: toDateYMD(csr.tanggal_mulai),
                    tanggal_akhir: toDateYMD(csr.tanggal_akhir),
                    keahlian_required: keahlianList,
                  });
                }
              })
            );

            // 2. DELETE CSR yang dihapus
            await Promise.all(
              deletedCsrIds.map(async (id) => {
                try {
                  await api.delete(`/csrs/${id}`);
                } catch (err) {
                }
              })
            );

          } catch (err) {
            // Don't throw error, just log it
          }
        }
        } // End else untuk update normal (kode tidak berubah)
      } else {
        await api.post("/mata-kuliah", {
          ...formData,
          rps_file: rpsFileName,
        });
        setSuccess("Data mata kuliah berhasil ditambahkan");

        // Upload RPS dan materi setelah mata kuliah berhasil disimpan (untuk mode tambah baru)
        if (rpsFile) {
          try {
            const rpsFormData = new FormData();
            rpsFormData.append("rps_file", rpsFile);
            rpsFormData.append("kode", form.kode);

            await api.post("/mata-kuliah/upload-rps", rpsFormData, {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            });
          } catch (error: any) {
            // Ambil error message dari backend
            const errorMessage = error.response?.data?.error || 
                                 error.response?.data?.message || 
                                 error.message || 
                                 "Gagal mengupload file RPS";
            setModalError(errorMessage); // Tampilkan error di modal
            console.error("Error uploading RPS:", error);
          }
        }

        if (materiFiles.length > 0) {
          try {
            const uploadPromises = materiItems.map(async (item) => {
              const file = materiFiles.find((f) => f.name === item.filename);
              if (!file) return;

              const materiFormData = new FormData();
              materiFormData.append("materi_file", file);
              materiFormData.append("kode", form.kode);
              materiFormData.append("judul", item.judul);

              await api.post("/mata-kuliah/upload-materi", materiFormData, {
                headers: {
                  "Content-Type": "multipart/form-data",
                },
              });
            });

            await Promise.all(uploadPromises);
          } catch (error: any) {
            // Ambil error message dari backend
            const errorMessage = error.response?.data?.error || 
                                 error.response?.data?.message || 
                                 error.message || 
                                 "Gagal mengupload file materi";
            setModalError(errorMessage); // Tampilkan error di modal
            console.error("Error uploading materi:", error);
          }
        }
      }

      handleCloseModal();
      fetchData();

      // Setelah berhasil tambah mata kuliah, submit CSR/PBL jika perlu
      if (!editMode) {
        if (
          form.jenis === "Non Blok" &&
          form.tipe_non_block === "CSR" &&
          form.semester !== "Antara" &&
          csrList.length > 0
        ) {
          await Promise.all(
            csrList.map((csr, index) => {
              // Ambil keahlian dari state csrKeahlian, bukan dari csr.keahlian_required
              const csrId = csr.id ? csr.id.toString() : `temp_${index}`;
              const keahlianList = csrKeahlian[csrId] || [];

              return api.post(`/mata-kuliah/${form.kode}/csrs`, {
                nomor_csr: csr.nomor_csr,
                tanggal_mulai: toDateYMD(csr.tanggal_mulai),
                tanggal_akhir: toDateYMD(csr.tanggal_akhir),
                keahlian_required: keahlianList, // Ambil dari state csrKeahlian
              });
            })
          );
        }
        if (form.jenis === "Blok" && pblList.length > 0) {
          await Promise.all(
            pblList.map((pbl, idx) =>
              api.post(`/mata-kuliah/${form.kode}/pbls`, {
                modul_ke: String(idx + 1),
                nama_modul: pbl.nama_modul,
              })
            )
          );
        }
      }
    } catch (error: any) {
      // Tampilkan error di modal, bukan di atas table
      if (error.response?.data?.errors) {
        const errorMessages = Object.values(error.response.data.errors).flat();
        setModalError(errorMessages.join(", "));
      } else if (error.response?.data?.error) {
        // Prioritas untuk error dari backend
        setModalError(error.response.data.error);
      } else if (error.response?.data?.message) {
        setModalError(error.response.data.message);
      } else if (error.message) {
        setModalError(error.message);
      } else {
        setModalError("Gagal menyimpan data mata kuliah");
      }
    } finally {
      // handleSaveData finished, isSaving set to false
      setIsSaving(false);
    }
  };

  const handleDelete = (kode: string) => {
    setSelectedDeleteKode(kode);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (selectedDeleteKode) {
      setIsDeleting(true);
      try {
        setSuccess(null);
        await api.delete(`/mata-kuliah/${selectedDeleteKode}`);
        setSuccess("Data mata kuliah berhasil dihapus");
        fetchData();
      } catch (error) {
        setError("Gagal menghapus data mata kuliah");
      } finally {
        setIsDeleting(false);
        setShowDeleteModal(false);
        setSelectedDeleteKode(null);
      }
    } else {
      setShowDeleteModal(false);
      setSelectedDeleteKode(null);
    }
  };

  const handleEdit = async (mk: MataKuliah) => {
    setForm({
      ...mk,
      tanggalMulai: mk.tanggal_mulai ? mk.tanggal_mulai.slice(0, 10) : "",
      tanggalAkhir: mk.tanggal_akhir ? mk.tanggal_akhir.slice(0, 10) : "",
      durasiMinggu: mk.durasi_minggu || null,
      tipe_non_block:
        mk.semester === "Antara" ? "Non-CSR" : mk.tipe_non_block || "Non-CSR",
      // Reset peran dan keahlian jika semester Antara
      peran_dalam_kurikulum:
        mk.semester === "Antara"
          ? []
          : Array.isArray(mk.peran_dalam_kurikulum)
          ? mk.peran_dalam_kurikulum
          : [],
      keahlian_required:
        mk.semester === "Antara"
          ? []
          : Array.isArray(mk.keahlian_required)
          ? mk.keahlian_required
          : [],
    });
    // Simpan kode original untuk handle perubahan kode
    setOriginalKode(mk.kode);
    setShowModal(true);
    setEditMode(true);

    // Reset keahlian CSR states
    setCsrKeahlian({});
    setNewKeahlianCSR({});

    // Fetch CSR dari backend (hanya jika bukan semester Antara)
    if (mk.semester !== "Antara") {
      try {
        const res = await api.get(`/mata-kuliah/${mk.kode}/csrs`);
        const csrData = Array.isArray(res.data) ? res.data : [];
        setCsrList(csrData);
        setOldCsrList(csrData);
        setDeletedCsrIds([]);

        // Load existing keahlian CSR
        const keahlianMap: { [csrId: string]: string[] } = {};
        for (const csr of csrData) {
          if (csr.id) {
            try {
              const keahlianRes = await api.get(`/keahlian-csr/csr/${csr.id}`);
              keahlianMap[csr.id.toString()] =
                keahlianRes.data.data?.map((k: any) => k.keahlian) || [];
            } catch (err) {
              keahlianMap[csr.id.toString()] = [];
            }
          }
        }
        setCsrKeahlian(keahlianMap);
      } catch (e) {
        setCsrList([]);
        setOldCsrList([]);
        setDeletedCsrIds([]);
        setCsrKeahlian({});
      }
    } else {
      // Semester Antara tidak memiliki CSR
      setCsrList([]);
      setOldCsrList([]);
      setDeletedCsrIds([]);
      setCsrKeahlian({});
    }
    // Fetch PBL dari backend jika jenis Blok
    if (mk.jenis === "Blok") {
      try {
        const pblRes = await api.get(`/mata-kuliah/${mk.kode}/pbls`);
        setPblList(Array.isArray(pblRes.data) ? pblRes.data : []);
        setOldPblList(Array.isArray(pblRes.data) ? pblRes.data : []);
      } catch (e) {
        setPblList([]);
        setOldPblList([]);
      }
      // Fetch Jurnal Reading dari backend
      try {
        const jurnalRes = await api.get(
          `/mata-kuliah/${mk.kode}/jurnal-readings`
        );
        setJurnalReadingList(
          Array.isArray(jurnalRes.data) ? jurnalRes.data : []
        );
        setOldJurnalReadingList(
          Array.isArray(jurnalRes.data) ? jurnalRes.data : []
        );
      } catch (e) {
        setJurnalReadingList([]);
        setOldJurnalReadingList([]);
      }
    } else {
      setPblList([]);
      setOldPblList([]);
      setJurnalReadingList([]);
      setOldJurnalReadingList([]);
    }

    // Handle existing RPS file
    if (mk.rps_file) {
      setExistingRpsFile(mk.rps_file);
    } else {
      setExistingRpsFile(null);
    }
    setRpsFile(null);

    // Handle existing materi files dari tabel terpisah
    try {
      const materiRes = await api.get(`/mata-kuliah/${mk.kode}/materi`);
      setExistingMateriItems(
        Array.isArray(materiRes.data.data) ? materiRes.data.data : []
      );
    } catch (e) {
      setExistingMateriItems([]);
    }
    setMateriFiles([]);
    setMateriItems([]);
    if (materiFileInputRef.current) materiFileInputRef.current.value = "";
  };

  const handleImportExcel = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
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

    setLoading(true);
    setSuccess(null);
    setCellErrors([]);
    setValidationErrors([]);

    try {
      // Validasi ulang dengan data terbaru
      const currentDbResponse = await api.get("/mata-kuliah");
      const currentDbData = currentDbResponse.data;

      const validationResult = validateExcelData(previewData, currentDbData);

      if (!validationResult.valid) {
        setValidationErrors(validationResult.errors);
        setCellErrors(validationResult.cellErrors);
        setLoading(false);
        return;
      }

      // Transform data untuk dikirim ke backend (seperti Dosen.tsx)
      const dataToExport = previewData.map((row) => {
        // Konversi kode ke string (penting untuk backend validation)
        const kode = String(row.kode);

        // Konversi string ke array untuk peran_dalam_kurikulum dan keahlian_required
        const peran_dalam_kurikulum =
          typeof row.peran_dalam_kurikulum === "string"
            ? row.peran_dalam_kurikulum
                .split(",")
                .map((item: string) => item.trim())
                .filter((item: string) => item !== "")
            : Array.isArray(row.peran_dalam_kurikulum)
            ? row.peran_dalam_kurikulum
                .map((item: string) => item.trim())
                .filter((item: string) => item !== "")
            : [];

        const keahlian_required =
          typeof row.keahlian_required === "string"
            ? row.keahlian_required
                .split(",")
                .map((item: string) => item.trim())
                .filter((item: string) => item !== "")
            : Array.isArray(row.keahlian_required)
            ? row.keahlian_required
                .map((item: string) => item.trim())
                .filter((item: string) => item !== "")
            : [];

        return {
          ...row,
          kode,
          peran_dalam_kurikulum,
          keahlian_required,
          // Pastikan tipe_non_block null untuk Blok
          tipe_non_block: row.jenis === "Blok" ? null : row.tipe_non_block,
        };
      });

      // Kirim data langsung ke backend (seperti Dosen.tsx)
      const importResponse = await api.post(
        "/mata-kuliah/bulk-import",
        dataToExport,
        {
          headers: { "Content-Type": "application/json" },
          validateStatus: () => true,
          timeout: 120000, // 2 menit timeout untuk import data banyak
        }
      );

      if (importResponse.status === 200) {
        setImportedCount(importResponse.data.imported_count || 0);
        // Reset state
        setPreviewData([]);
        setValidationErrors([]);
        setCellErrors([]);
        setImportedFile(null);
        // Refresh data
        fetchData();
      } else if (importResponse.status === 422) {
        setError(importResponse.data.message || "Gagal mengimpor data");
        if (
          importResponse.data.failed_rows &&
          importResponse.data.failed_rows.length > 0
        ) {
          setPreviewData(importResponse.data.failed_rows);
        }
        if (
          importResponse.data.cell_errors &&
          importResponse.data.cell_errors.length > 0
        ) {
          setCellErrors(importResponse.data.cell_errors);
        }
        if (
          importResponse.data.errors &&
          importResponse.data.errors.length > 0
        ) {
          setValidationErrors(importResponse.data.errors);
        }
      } else {
        setError(importResponse.data.message || "Gagal mengimport data");
      }
    } catch (error: any) {
      setError(handleApiError(error, "Import data"));
    } finally {
      setLoading(false);
    }
  };

  // Fungsi untuk generate kode mata kuliah otomatis
  const generateKodeMataKuliah = (
    semester: number | string,
    jenis: "Blok" | "Non Blok",
    blok: number | null = null
  ): string => {
    if (semester === "Antara") {
      // Semester Antara
      if (jenis === "Blok" && blok) {
        // MKA001, MKA002, MKA003, MKA004
        return `MKA${blok.toString().padStart(3, '0')}`;
      } else if (jenis === "Non Blok") {
        return "MKA005";
      }
    } else {
      // Semester Reguler (1-7)
      const semesterNum = Number(semester);
      if (jenis === "Blok" && blok) {
        // MKB101, MKB102, MKB201, MKB202, dll
        // Format: MKB + semester (1 digit) + blok (2 digit)
        return `MKB${semesterNum}${blok.toString().padStart(2, '0')}`;
      } else if (jenis === "Non Blok") {
        // MKU001, MKU002, MKU003, dll
        return `MKU${semesterNum.toString().padStart(3, '0')}`;
      }
    }
    return "";
  };

  // Reset modal state
  const handleCloseModal = () => {
    setShowModal(false);
    setOriginalKode(null); // Reset original kode
    setModalError(null); // Reset modal error
    setForm({
      kode: "",
      nama: "",
      semester: 1 as number | string,
      periode: "Ganjil",
      jenis: "Blok",
      kurikulum: new Date().getFullYear(),
      tanggalMulai: "",
      tanggalAkhir: "",
      blok: null,
      durasiMinggu: null,
      tipe_non_block: "Non-CSR",
      peran_dalam_kurikulum: [],
      keahlian_required: [],
      rps_file: undefined,
    });
    setEditMode(false);
    setCsrList([]);
    setJumlahPBL(1);
    setPblList([]);
    setJurnalReadingList([]);
    setOldJurnalReadingList([]);
    // Reset keahlian CSR states
    setCsrKeahlian({});
    setNewKeahlianCSR({});
    // Reset RPS state
    setRpsFile(null);
    setExistingRpsFile(null);

    if (rpsFileInputRef.current) rpsFileInputRef.current.value = "";

    // Reset materi state
    setMateriFiles([]);
    setMateriItems([]);
    setExistingMateriItems([]);
    if (materiFileInputRef.current) materiFileInputRef.current.value = "";
  };

  // Handle buka modal untuk input data baru
  const handleOpenModal = () => {
    setShowModal(true);
    setEditMode(false);

    // Auto-generate kode awal berdasarkan form default
    const defaultForm = {
      kode: "",
      nama: "",
      semester: 1 as number | string,
      periode: getPeriodeBySemester(1),
      jenis: "Blok" as "Blok" | "Non Blok",
      kurikulum: new Date().getFullYear(),
      tanggalMulai: "",
      tanggalAkhir: "",
      blok: null,
      durasiMinggu: null,
      tipe_non_block: "Non-CSR" as "CSR" | "Non-CSR",
      peran_dalam_kurikulum: [],
      keahlian_required: [],
      rps_file: undefined,
    };

    // Generate kode awal
    defaultForm.kode = generateKodeMataKuliah(
      defaultForm.semester,
      defaultForm.jenis,
      defaultForm.blok
    );

    setForm(defaultForm);
  };

  // Semester options berdasarkan semester aktif
  const semesterOptions = getSemesterOptionsForActivePeriod(
    activeSemesterJenis,
    Array.isArray(data) ? data : []
  );
  const kurikulumOptions = Array.from(
    new Set(Array.isArray(data) ? data.map((d) => d.kurikulum) : [])
  ).sort((a, b) => b - a);
  const periodeOptions = Array.from(
    new Set(Array.isArray(data) ? data.map((d) => d.periode) : [])
  );
  const jenisOptions = Array.from(
    new Set(Array.isArray(data) ? data.map((d) => d.jenis) : [])
  );
  const blokOptions = Array.from(
    new Set(
      Array.isArray(data)
        ? data
            .filter((d) => d.jenis === "Blok" && d.blok !== null)
            .map((d) => d.blok)
        : []
    )
  )
    .filter((b): b is number => b !== null)
    .sort((a, b) => a - b);

  // Filter & Search
  const filteredData = sortDataByBlok(
    (Array.isArray(data) ? data : []).filter((mk) => {
      // Filter berdasarkan semester aktif (periode) - kecuali untuk Semester Antara
      if (
        activeSemesterJenis &&
        mk.periode !== activeSemesterJenis &&
        mk.semester !== "Antara"
      )
        return false;
      const q = search.toLowerCase();
      const matchSearch =
        mk.kode?.toLowerCase().includes(q) ||
        mk.nama?.toLowerCase().includes(q) ||
        mk.jenis?.toLowerCase().includes(q) ||
        (mk.blok !== null &&
          mk.blok !== undefined &&
          `blok ke-${mk.blok}`.toLowerCase().includes(q)) ||
        `semester ${mk.semester}`.toLowerCase().includes(q) ||
        mk.periode?.toLowerCase().includes(q) ||
        (mk.kurikulum && mk.kurikulum.toString().includes(q)) ||
        ((mk.tanggalMulai || mk.tanggal_mulai) &&
          new Date(mk.tanggalMulai || mk.tanggal_mulai || "")
            .toLocaleDateString("id-ID")
            .includes(q)) ||
        ((mk.tanggalAkhir || mk.tanggal_akhir) &&
          new Date(mk.tanggalAkhir || mk.tanggal_akhir || "")
            .toLocaleDateString("id-ID")
            .includes(q)) ||
        ((mk.durasiMinggu ?? mk.durasi_minggu) !== null &&
          (mk.durasiMinggu ?? mk.durasi_minggu) !== undefined &&
          `${mk.durasiMinggu ?? mk.durasi_minggu} minggu`
            .toLowerCase()
            .includes(q));

      const matchSemester = isSemesterMatch(mk.semester, filterSemester);
      const matchPeriode =
        filterPeriode === "all" ? true : mk.periode === filterPeriode;
      const matchJenis =
        filterJenis === "all" ? true : mk.jenis === filterJenis;
      const matchKurikulum =
        filterKurikulum === "all"
          ? true
          : mk.kurikulum === Number(filterKurikulum);
      const matchBlok =
        filterBlok === "all" ? true : mk.blok === Number(filterBlok);
      return (
        matchSearch &&
        matchSemester &&
        matchPeriode &&
        matchJenis &&
        matchKurikulum &&
        matchBlok
      );
    })
  );

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const paginatedData = filteredData.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleBulkDelete = async () => {
    if (selectedRows.length === 0) return;
    setShowDeleteModalBulk(true);
  };

  const confirmBulkDelete = async () => {
    setShowDeleteModalBulk(false);
    try {
      setLoading(true);
      await Promise.all(
        selectedRows.map((kode) => api.delete(`/mata-kuliah/${kode}`))
      );
      setSuccess(`${selectedRows.length} data berhasil dihapus.`);
      setSelectedRows([]);
      fetchData();
    } catch (err) {
      setError("Gagal menghapus data terpilih");
    } finally {
      setLoading(false);
    }
  };

  // Download template Excel
  const downloadTemplate = async () => {
    const templateData = [
      // ===== CONTOH SEMESTER REGULER =====
      // 1. Non Blok Non-CSR (Semester Reguler)
      {
        kode: "TEMPLATE001",
        nama: "Contoh Non Blok Non-CSR - Semester Reguler",
        semester: 1,
        periode: "Ganjil",
        jenis: "Non Blok",
        kurikulum: 2024,
        tanggal_mulai: "2024-08-01",
        tanggal_akhir: "2024-12-01",
        blok: null,
        durasi_minggu: 16,
        tipe_non_block: "Non-CSR",
        peran_dalam_kurikulum: "Dasar Klinis, Praktik Klinis",
        keahlian_required: "Anamnesis, Pemeriksaan Fisik, Diagnosis Banding",
      },
      // 2. Non Blok CSR (Semester Reguler)
      {
        kode: "TEMPLATE002",
        nama: "Contoh Non Blok CSR - Semester Reguler",
        semester: 2,
        periode: "Genap",
        jenis: "Non Blok",
        kurikulum: 2024,
        tanggal_mulai: "2024-02-01",
        tanggal_akhir: "2024-06-01",
        blok: null,
        durasi_minggu: 16,
        tipe_non_block: "CSR",
        peran_dalam_kurikulum: "Dasar Klinis, Praktik Klinis",
        keahlian_required: "Anamnesis, Pemeriksaan Fisik, Diagnosis Banding",
      },
      // 3-6. 4 Blok (Semester Reguler) - tanggal tidak overlap
      {
        kode: "TEMPLATE003",
        nama: "Blok 1 - Semester Reguler",
        semester: 1,
        periode: "Ganjil",
        jenis: "Blok",
        kurikulum: 2024,
        tanggal_mulai: "2024-08-01",
        tanggal_akhir: "2024-08-28",
        blok: 1,
        durasi_minggu: 4,
        tipe_non_block: null,
        peran_dalam_kurikulum: "Dasar Klinis",
        keahlian_required: "Anamnesis, Pemeriksaan Fisik",
      },
      {
        kode: "TEMPLATE004",
        nama: "Blok 2 - Semester Reguler",
        semester: 1,
        periode: "Ganjil",
        jenis: "Blok",
        kurikulum: 2024,
        tanggal_mulai: "2024-09-01",
        tanggal_akhir: "2024-09-28",
        blok: 2,
        durasi_minggu: 4,
        tipe_non_block: null,
        peran_dalam_kurikulum: "Dasar Klinis",
        keahlian_required: "Anamnesis, Pemeriksaan Fisik",
      },
      {
        kode: "TEMPLATE005",
        nama: "Blok 3 - Semester Reguler",
        semester: 1,
        periode: "Ganjil",
        jenis: "Blok",
        kurikulum: 2024,
        tanggal_mulai: "2024-10-01",
        tanggal_akhir: "2024-10-28",
        blok: 3,
        durasi_minggu: 4,
        tipe_non_block: null,
        peran_dalam_kurikulum: "Dasar Klinis",
        keahlian_required: "Anamnesis, Pemeriksaan Fisik",
      },
      {
        kode: "TEMPLATE006",
        nama: "Blok 4 - Semester Reguler",
        semester: 1,
        periode: "Ganjil",
        jenis: "Blok",
        kurikulum: 2024,
        tanggal_mulai: "2024-11-01",
        tanggal_akhir: "2024-11-28",
        blok: 4,
        durasi_minggu: 4,
        tipe_non_block: null,
        peran_dalam_kurikulum: "Dasar Klinis",
        keahlian_required: "Anamnesis, Pemeriksaan Fisik",
      },

      // ===== CONTOH SEMESTER ANTARA =====

      {
        kode: "TEMPLATE007",
        nama: "Contoh Non Blok Non-CSR - Semester Antara",
        semester: "Antara",
        periode: "Antara",
        jenis: "Non Blok",
        kurikulum: 2024,
        tanggal_mulai: "2024-06-01",
        tanggal_akhir: "2024-07-31",
        blok: null,
        durasi_minggu: 8,
        tipe_non_block: "Non-CSR",
        peran_dalam_kurikulum: "",
        keahlian_required: "",
      },
      {
        kode: "TEMPLATE008",
        nama: "Contoh Blok - Semester Antara",
        semester: "Antara",
        periode: "Antara",
        jenis: "Blok",
        kurikulum: 2024,
        tanggal_mulai: "2024-06-15",
        tanggal_akhir: "2024-07-15",
        blok: 1,
        durasi_minggu: 4,
        tipe_non_block: null,
        peran_dalam_kurikulum: "",
        keahlian_required: "",
      },
    ];
    // Buat worksheet dengan header yang eksplisit
    const ws = XLSX.utils.json_to_sheet(templateData, {
      header: [
        "kode",
        "nama",
        "semester",
        "periode",
        "jenis",
        "kurikulum",
        "tanggal_mulai",
        "tanggal_akhir",
        "blok",
        "durasi_minggu",
        "tipe_non_block",
        "peran_dalam_kurikulum",
        "keahlian_required",
      ],
    });

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "MataKuliah");
    XLSX.writeFile(wb, "Template_Import_MataKuliah.xlsx");
  };

  // Fungsi untuk memformat tanggal ke format Indonesia
  const formatDateToIndonesian = (
    dateString: string | null | undefined
  ): string => {
    if (!dateString) return "";

    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString; // Return original if invalid date

      return date.toLocaleDateString("id-ID", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
    } catch (error) {
      return dateString; // Return original if error
    }
  };

  // Export data ke Excel dengan format yang bisa diimport kembali
  const exportToExcel = async () => {
    try {
      // Ambil semua data (tidak difilter) dengan format yang sesuai untuk import
      const dataToExport = data.map((mk: MataKuliah) => ({
        kode: mk.kode,
        nama: mk.nama,
        semester: mk.semester,
        periode: mk.periode,
        jenis: mk.jenis,
        kurikulum: mk.kurikulum,
        tanggal_mulai: mk.tanggalMulai || mk.tanggal_mulai || "",
        tanggal_akhir: mk.tanggalAkhir || mk.tanggal_akhir || "",
        blok: mk.blok || "",
        durasi_minggu: mk.durasiMinggu || mk.durasi_minggu || "",
        tipe_non_block: mk.tipe_non_block || "",
        peran_dalam_kurikulum: Array.isArray(mk.peran_dalam_kurikulum)
          ? mk.peran_dalam_kurikulum.join(", ")
          : mk.peran_dalam_kurikulum || "",
        keahlian_required: Array.isArray(mk.keahlian_required)
          ? mk.keahlian_required.join(", ")
          : mk.keahlian_required || "",
        rps_file: mk.rps_file || "",
      }));

      // Buat workbook baru
      const wb = XLSX.utils.book_new();

      // Buat worksheet untuk data utama
      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // Set lebar kolom
      const colWidths = [
        { wch: 15 }, // kode
        { wch: 40 }, // nama
        { wch: 10 }, // semester
        { wch: 12 }, // periode
        { wch: 12 }, // jenis
        { wch: 10 }, // kurikulum
        { wch: 15 }, // tanggal_mulai
        { wch: 15 }, // tanggal_akhir
        { wch: 8 }, // blok
        { wch: 12 }, // durasi_minggu
        { wch: 15 }, // tipe_non_block
        { wch: 30 }, // peran_dalam_kurikulum
        { wch: 30 }, // keahlian_required
        { wch: 20 }, // rps_file
      ];
      ws["!cols"] = colWidths;

      // Tambahkan header dengan styling
      const headerRange = XLSX.utils.decode_range(ws["!ref"] || "A1");
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
            right: { style: "thin", color: { rgb: "000000" } },
          },
        };
      }

      // Tambahkan border untuk semua data
      const dataRange = XLSX.utils.decode_range(ws["!ref"] || "A1");
      for (let row = dataRange.s.r; row <= dataRange.e.r; row++) {
        for (let col = dataRange.s.c; col <= dataRange.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!ws[cellAddress]) continue;

          if (!ws[cellAddress].s) ws[cellAddress].s = {};
          ws[cellAddress].s.border = {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } },
          };

          // Alternating row colors
          if (row > 0) {
            ws[cellAddress].s.fill = {
              fgColor: { rgb: row % 2 === 0 ? "F8F9FA" : "FFFFFF" },
            };
          }
        }
      }

      // Buat worksheet untuk ringkasan
      const summaryData = [
        ["RINGKASAN DATA MATA KULIAH"],
        [""],
        ["Total Data", dataToExport.length],
        ["Data Blok", dataToExport.filter((d) => d.jenis === "Blok").length],
        [
          "Data Non Blok",
          dataToExport.filter((d) => d.jenis === "Non Blok").length,
        ],
        [
          "Data CSR",
          dataToExport.filter((d) => d.tipe_non_block === "CSR").length,
        ],
        [
          "Data Non-CSR",
          dataToExport.filter((d) => d.tipe_non_block === "Non-CSR").length,
        ],
        [""],
        ["Data per Semester:"],
        ["Semester 1", dataToExport.filter((d) => d.semester === 1).length],
        ["Semester 2", dataToExport.filter((d) => d.semester === 2).length],
        ["Semester 3", dataToExport.filter((d) => d.semester === 3).length],
        ["Semester 4", dataToExport.filter((d) => d.semester === 4).length],
        ["Semester 5", dataToExport.filter((d) => d.semester === 5).length],
        ["Semester 6", dataToExport.filter((d) => d.semester === 6).length],
        ["Semester 7", dataToExport.filter((d) => d.semester === 7).length],
        [
          "Semester Antara",
          dataToExport.filter((d) => d.semester === "Antara").length,
        ],
        [""],
        ["Data per Periode:"],
        ["Ganjil", dataToExport.filter((d) => d.periode === "Ganjil").length],
        ["Genap", dataToExport.filter((d) => d.periode === "Genap").length],
        ["Antara", dataToExport.filter((d) => d.periode === "Antara").length],
        [""],
        ["Tanggal Export", new Date().toLocaleString("id-ID")],
        ["Dibuat oleh", "Sistem ISME"],
      ];

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs["!cols"] = [{ wch: 20 }, { wch: 30 }];

      // Styling untuk summary
      summaryWs["A1"].s = {
        font: { bold: true, size: 16, color: { rgb: "FFFFFF" } },
        fill: { fgColor: { rgb: "2F5597" } },
        alignment: { horizontal: "center", vertical: "center" },
      };

      // Tambahkan border untuk summary
      const summaryRange = XLSX.utils.decode_range(summaryWs["!ref"] || "A1");
      for (let row = summaryRange.s.r; row <= summaryRange.e.r; row++) {
        for (let col = summaryRange.s.c; col <= summaryRange.e.c; col++) {
          const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
          if (!summaryWs[cellAddress]) continue;

          if (!summaryWs[cellAddress].s) summaryWs[cellAddress].s = {};
          summaryWs[cellAddress].s.border = {
            top: { style: "thin", color: { rgb: "CCCCCC" } },
            bottom: { style: "thin", color: { rgb: "CCCCCC" } },
            left: { style: "thin", color: { rgb: "CCCCCC" } },
            right: { style: "thin", color: { rgb: "CCCCCC" } },
          };
        }
      }

      // Tambahkan worksheet ke workbook
      XLSX.utils.book_append_sheet(wb, ws, "Data Mata Kuliah");
      XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

      // Generate filename dengan timestamp
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
      const filename = `Data_MataKuliah_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
    } catch (error) {
    }
  };

  // Baca file Excel
  const readExcelFile = (file: File): Promise<any[]> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = e.target?.result;
          const workbook = XLSX.read(data, {
            type: "array",
            cellFormula: true, // Enable formula evaluation
            cellDates: true, // Enable date parsing
            cellNF: false, // Disable number format
            cellStyles: false, // Disable cell styles for better performance
          });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Get data as array of arrays with formula evaluation
          const aoa = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
            raw: false, // Convert all values to strings
            defval: "", // Default value for empty cells
          }) as any[][];

          if (aoa.length === 0) {
            resolve([]);
            return;
          }

          const rawHeaders = aoa[0];
          // Normalize headers: lowercase, trim spaces, replace spaces with underscores
          const normalizedHeaders = rawHeaders.map((h: string) =>
            String(h).toLowerCase().trim().replace(/\s+/g, "_")
          );

          const jsonData: any[] = [];
          for (let i = 1; i < aoa.length; i++) {
            const rowData: any = {};
            const currentRow = aoa[i];
            normalizedHeaders.forEach((header, index) => {
              let value = currentRow[index];

              // Handle date fields specifically
              if (header === "tanggal_mulai" || header === "tanggal_akhir") {
                value = convertExcelDate(value);
              }

              rowData[header] = value;
            });
            jsonData.push(rowData);
          }

          resolve(jsonData);
        } catch (error) {
          reject(error);
        }
      };

      reader.onerror = (error) => reject(error);
      reader.readAsArrayBuffer(file);
    });
  };

  // Validasi data Excel
  const validateExcelData = (
    excelData: any[],
    existingDbData: MataKuliah[]
  ) => {
    const errors: string[] = [];
    const newCellErrors: {
      row: number;
      field: string;
      message: string;
      kode?: string;
    }[] = [];

    if (excelData.length === 0) {
      errors.push("File Excel kosong");
      return { valid: false, errors, cellErrors: newCellErrors };
    }

    // Validasi header
    const firstRow = excelData[0];
    const requiredHeaders = [
      "kode",
      "nama",
      "semester",
      "periode",
      "jenis",
      "kurikulum",
      "tanggal_mulai",
      "tanggal_akhir",
      "blok",
      "durasi_minggu",
      "tipe_non_block",
      "peran_dalam_kurikulum",
      "keahlian_required",
    ];
    const headers = Object.keys(firstRow).map((h) => h.toLowerCase());
    const missingHeaders = requiredHeaders.filter((h) => !headers.includes(h));
    if (missingHeaders.length > 0) {
      errors.push(
        `Kolom yang diperlukan tidak ditemukan: ${missingHeaders.join(", ")}`
      );
      return { valid: false, errors, cellErrors: newCellErrors };
    }

    // Hitung total Blok per semester (dari file Excel)
    const blokPerSemester: Record<string, number> = {};
    const nonBlokPerSemester: Record<string, number> = {};

    // Hitung dari data Excel
    excelData.forEach((row) => {
      const semester =
        row.semester === "Antara" ? "Antara" : Number(row.semester);
      const semesterKey = String(semester);
      if (row.jenis === "Blok") {
        blokPerSemester[semesterKey] = (blokPerSemester[semesterKey] || 0) + 1;
      } else if (row.jenis === "Non Blok") {
        nonBlokPerSemester[semesterKey] =
          (nonBlokPerSemester[semesterKey] || 0) + 1;
      }
    });

    // Tambahkan dari data existing di database
    existingDbData.forEach((row) => {
      const semester = row.semester;
      const semesterKey = String(semester);
      if (row.jenis === "Blok") {
        blokPerSemester[semesterKey] = (blokPerSemester[semesterKey] || 0) + 1;
      } else if (row.jenis === "Non Blok") {
        nonBlokPerSemester[semesterKey] =
          (nonBlokPerSemester[semesterKey] || 0) + 1;
      }
    });

    // Validasi per baris
    excelData.forEach((row, index) => {
      const rowKode = row.kode ? String(row.kode) : "";

      // Validasi blok untuk mata kuliah jenis Blok
      if (row.jenis === "Blok" && row.blok !== null && row.blok !== undefined) {
        const blokValue = Number(row.blok);
        if (!Number.isInteger(blokValue) || blokValue < 1) {
          errors.push(
            `Baris ${
              index + 2
            }: Nomor blok harus berupa bilangan bulat positif (1, 2, 3, dst.).`
          );
        }
      }

      const rowErrors = validateRow(row, excelData, index, existingDbData);

      rowErrors.forEach((error) => {
        newCellErrors.push({
          row: index,
          field: error.field,
          message: error.message,
          kode: rowKode,
        });
      });
    });

    return {
      valid: errors.length === 0 && newCellErrors.length === 0,
      errors,
      cellErrors: newCellErrors,
    };
  };

  // Edit cell preview
  const handleCellEdit = (
    rowIdx: number,
    key: string,
    value: string | string[]
  ) => {
    setPreviewData((prev) => {
      const newData = [...prev];

      // Handle array fields (peran_dalam_kurikulum, keahlian_required)
      if (key === "peran_dalam_kurikulum" || key === "keahlian_required") {
        const arrayValue =
          typeof value === "string"
            ? value
                .split(",")
                .map((item) => item.trim())
                .filter((item) => item !== "")
            : value;
        newData[rowIdx] = { ...newData[rowIdx], [key]: arrayValue };
      } else {
        newData[rowIdx] = { ...newData[rowIdx], [key]: value };
      }

      // Validasi ulang seluruh data preview
      const validationResult = validateExcelData(newData, data);
      setCellErrors(validationResult.cellErrors);
      setValidationErrors(validationResult.errors);
      return newData;
    });
  };

  function validateRow(
    row: any,
    allRows: any[],
    rowIdx: number,
    existingDbData: MataKuliah[]
  ): { field: string; message: string }[] {
    const errors: { field: string; message: string }[] = [];
    const rowKode = row.kode ? String(row.kode) : "";
    if (!row.kode) {
      errors.push({ field: "kode", message: "Kode harus diisi" });
    } else if (row.kode.length > 255) {
      errors.push({ field: "kode", message: "Kode maksimal 255 karakter" });
    }
    if (!row.nama) errors.push({ field: "nama", message: "Nama harus diisi" });
    if (
      !row.semester ||
      (row.semester !== "Antara" && isNaN(Number(row.semester)))
    )
      errors.push({
        field: "semester",
        message: 'Semester harus diisi dengan angka atau "Antara"',
      });
    if (!row.periode)
      errors.push({ field: "periode", message: "Periode harus diisi" });
    if (!row.jenis || !["Blok", "Non Blok"].includes(row.jenis))
      errors.push({
        field: "jenis",
        message: `Jenis harus diisi dengan 'Blok' atau 'Non Blok'`,
      });
    if (!row.kurikulum || isNaN(Number(row.kurikulum)))
      errors.push({
        field: "kurikulum",
        message: "Kurikulum harus diisi dengan angka tahun",
      });
    if (!row.tanggal_mulai)
      errors.push({
        field: "tanggal_mulai",
        message: "Tanggal Mulai harus diisi",
      });
    if (!row.tanggal_akhir)
      errors.push({
        field: "tanggal_akhir",
        message: "Tanggal Akhir harus diisi",
      });
    if (row.jenis === "Blok" && (!row.blok || isNaN(Number(row.blok))))
      errors.push({
        field: "blok",
        message: `Blok harus diisi dengan angka jika jenis 'Blok'`,
      });
    if (!row.durasi_minggu || isNaN(Number(row.durasi_minggu)))
      errors.push({
        field: "durasi_minggu",
        message: "Durasi Minggu harus diisi dengan angka",
      });

    // Validasi tipe_non_block
    if (row.jenis === "Non Blok") {
      if (
        !row.tipe_non_block ||
        !["CSR", "Non-CSR"].includes(row.tipe_non_block)
      ) {
        errors.push({
          field: "tipe_non_block",
          message: 'Tipe Non-Block harus diisi dengan "CSR" atau "Non-CSR"',
        });
      }
    } else if (row.jenis === "Blok") {
      if (
        row.tipe_non_block &&
        row.tipe_non_block !== null &&
        row.tipe_non_block !== ""
      ) {
        errors.push({
          field: "tipe_non_block",
          message: "Tipe Non-Block tidak boleh diisi untuk jenis Blok",
        });
      }
    }

    // Validasi khusus untuk semester Antara
    if (
      row.semester === "Antara" &&
      row.jenis === "Non Blok" &&
      row.tipe_non_block === "CSR"
    ) {
      errors.push({
        field: "tipe_non_block",
        message:
          "Semester Antara tidak dapat memiliki tipe CSR, hanya Non-CSR yang diperbolehkan",
      });
    }

    // Validasi peran_dalam_kurikulum (hanya untuk semester bukan Antara)
    if (row.semester !== "Antara") {
      const peranValue = Array.isArray(row.peran_dalam_kurikulum)
        ? row.peran_dalam_kurikulum
        : typeof row.peran_dalam_kurikulum === "string"
        ? row.peran_dalam_kurikulum
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p !== "")
        : [];

      if (!peranValue || peranValue.length === 0) {
        errors.push({
          field: "peran_dalam_kurikulum",
          message: "Peran dalam Kurikulum harus diisi untuk semester reguler",
        });
      }
    } else {
      // Untuk semester Antara, peran_dalam_kurikulum harus kosong
      const peranValue = Array.isArray(row.peran_dalam_kurikulum)
        ? row.peran_dalam_kurikulum
        : typeof row.peran_dalam_kurikulum === "string"
        ? row.peran_dalam_kurikulum
            .split(",")
            .map((p) => p.trim())
            .filter((p) => p !== "")
        : [];

      if (peranValue && peranValue.length > 0) {
        errors.push({
          field: "peran_dalam_kurikulum",
          message:
            "Peran dalam Kurikulum tidak boleh diisi untuk semester Antara",
        });
      }
    }

    // Validasi keahlian_required (hanya untuk semester bukan Antara)
    if (row.semester !== "Antara") {
      const keahlianValue = Array.isArray(row.keahlian_required)
        ? row.keahlian_required
        : typeof row.keahlian_required === "string"
        ? row.keahlian_required
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k !== "")
        : [];

      if (!keahlianValue || keahlianValue.length === 0) {
        errors.push({
          field: "keahlian_required",
          message: "Keahlian Dibutuhkan harus diisi untuk semester reguler",
        });
      }
    } else {
      // Untuk semester Antara, keahlian_required harus kosong
      const keahlianValue = Array.isArray(row.keahlian_required)
        ? row.keahlian_required
        : typeof row.keahlian_required === "string"
        ? row.keahlian_required
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k !== "")
        : [];

      if (keahlianValue && keahlianValue.length > 0) {
        errors.push({
          field: "keahlian_required",
          message:
            "Keahlian Dibutuhkan tidak boleh diisi untuk semester Antara",
        });
      }
    }

    // Duplikat kode di file
    if (rowKode) {
      if (allRows.some((r, i) => i !== rowIdx && String(r.kode) === rowKode)) {
        errors.push({
          field: "kode",
          message: "Kode sudah terdaftar dalam file ini",
        });
      }
    }
    // Duplikat dengan database
    if (rowKode && existingDbData.some((d) => d.kode === rowKode)) {
      errors.push({
        field: "kode",
        message: "Kode sudah terdaftar di database",
      });
    }
    return errors;
  }

  // Generate input CSR saat jumlah berubah
  useEffect(() => {
    if (
      form.jenis === "Non Blok" &&
      form.tipe_non_block === "CSR" &&
      form.semester !== "Antara"
    ) {
      const blokDiSemester = data.filter(
        (mk) =>
          mk.jenis === "Blok" && isSemesterMatch(mk.semester, form.semester)
      );
      const jumlahBlok = blokDiSemester.length || 4;
      // Jangan overwrite csrList jika jumlah baris sama dan tipe_non_block tidak berubah
      if (csrList.length === jumlahBlok && oldCsrList.length > 0) return;
      setCsrList(
        Array.from({ length: jumlahBlok }, (_, i) => {
          const blokKe = i + 1;
          const nomor_csr = `${form.semester}.${blokKe}`;
          const existing = oldCsrList.find((c) => c.nomor_csr === nomor_csr);
          if (oldCsrList.length > 0 && existing) {
            return {
              id: existing.id,
              nomor_csr: existing.nomor_csr,
              tanggal_mulai: existing.tanggal_mulai,
              tanggal_akhir: existing.tanggal_akhir,
              keahlian_required: existing.keahlian_required,
            };
          }
          const blok = blokDiSemester.find((b) => b.blok === blokKe);
          return {
            nomor_csr,
            tanggal_mulai: blok?.tanggalMulai || blok?.tanggal_mulai || "",
            tanggal_akhir: blok?.tanggalAkhir || blok?.tanggal_akhir || "",
            keahlian_required: [],
          };
        })
      );
    }
    if (
      form.jenis !== "Non Blok" ||
      form.tipe_non_block !== "CSR" ||
      form.semester === "Antara"
    ) {
      setCsrList([]);
    }
    // eslint-disable-next-line
  }, [form.semester, form.jenis, form.tipe_non_block, data]);

  // Generate input PBL saat jumlah berubah
  useEffect(() => {
    if (form.jenis === "Blok") {
      setPblList(
        Array.from(
          { length: jumlahPBL },
          (_, i) => pblList[i] || { modul_ke: "", nama_modul: "" }
        )
      );
    }
    // Reset jika bukan Blok
    if (form.jenis !== "Blok") {
      setPblList([]);
      setJurnalReadingList([]);
      setOldJurnalReadingList([]);
    }
  }, [jumlahPBL, form.jenis]);

  // Auto-fill blok saat modal dibuka atau semester berubah (hanya untuk data baru)
  useEffect(() => {
    if (
      showModal &&
      !editMode &&
      form.jenis === "Blok" &&
      form.semester &&
      Array.isArray(data) &&
      data.length > 0
    ) {
      const nextBlok = getNextAvailableBlok(form.semester, data, null);
      setForm((prev) => ({ ...prev, blok: nextBlok }));
    }
  }, [showModal, editMode, form.jenis, form.semester, data]);

  // Fungsi hapus CSR di form
  const handleDeleteCsr = (idx: number) => {
    setCsrList((list) => {
      const csr = list[idx];
      if (typeof csr.id === "number")
        setDeletedCsrIds((ids) => [...ids, csr.id as number]);
      return list.filter((_, i) => i !== idx);
    });
  };

  // Fungsi untuk menambah keahlian CSR
  const handleAddKeahlianCSR = (csrId: string) => {
    const keahlian = newKeahlianCSR[csrId]?.trim();
    if (!keahlian) return;

    setCsrKeahlian((prev) => ({
      ...prev,
      [csrId]: [...(prev[csrId] || []), keahlian],
    }));

    setNewKeahlianCSR((prev) => ({
      ...prev,
      [csrId]: "",
    }));
  };

  // Fungsi untuk menghapus keahlian CSR
  const handleRemoveKeahlianCSR = (csrId: string, keahlian: string) => {
    setCsrKeahlian((prev) => ({
      ...prev,
      [csrId]: (prev[csrId] || []).filter((k) => k !== keahlian),
    }));
  };

  // Fungsi untuk download RPS file
  const handleDownloadRps = async (kode: string, filename: string) => {
    try {
      const response = await api.get(`/mata-kuliah/${kode}/download-rps`, {
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      setError("Gagal mengunduh file RPS");
    }
  };

  // Fungsi untuk download materi file
  const handleDownloadMateri = async (kode: string, materiId: number) => {
    // Cek apakah file ini sudah sedang di-download
    if (downloadProgress[materiId]) {
      return;
    }

    // Set status download untuk file ini
    setDownloadProgress((prev) => ({ ...prev, [materiId]: true }));

    try {
      // Get materi info dari selectedMateriMataKuliah.materi
      const materi = selectedMateriMataKuliah?.materi?.find(
        (m) => m.id === materiId
      );
      if (!materi) {
        throw new Error("Materi tidak ditemukan");
      }

      // Tambahkan cache busting untuk mencegah reuse request
      const timestamp = Date.now();
      const randomId = Math.random().toString(36).substr(2, 9);
      const response = await api.get(`/mata-kuliah/${kode}/download-materi`, {
        responseType: "blob",
        params: {
          filename: materi.filename,
          _t: timestamp,
          _r: randomId,
        },
      });

      // Validasi response
      if (!response.data || response.data.size === 0) {
        throw new Error("File kosong atau tidak ditemukan");
      }

      // Cek apakah response adalah file yang valid (bukan HTML error page)
      const contentType = response.headers["content-type"] || "";
      if (
        contentType.includes("text/html") ||
        contentType.includes("application/json")
      ) {
        throw new Error("Response bukan file yang valid");
      }

      // Pastikan response.data adalah Blob yang valid
      let fileBlob = response.data;
      if (!(fileBlob instanceof Blob)) {
        fileBlob = new Blob([response.data], { type: contentType });
      }

      // Buat nama file dengan extension yang benar
      let fileName = materi.judul || materi.filename;

      // Pastikan extension file tetap ada
      if (materi.file_type && !fileName.includes("." + materi.file_type)) {
        fileName = `${fileName}.${materi.file_type}`;
      }

      // Jika masih tidak ada extension, ambil dari filename asli
      if (!fileName.includes(".")) {
        const originalExt = materi.filename.split(".").pop();
        if (originalExt) {
          fileName = `${fileName}.${originalExt}`;
        }
      }

      // Buat Blob URL baru setiap kali download dengan timestamp
      const uniqueBlob = new Blob([fileBlob], { type: fileBlob.type });
      const url = window.URL.createObjectURL(uniqueBlob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute("download", fileName);
      link.style.display = "none";

      // Tambahkan ke DOM, klik, dan hapus
      document.body.appendChild(link);
      link.click();

      // Immediate cleanup
      try {
        document.body.removeChild(link);
      } catch (e) {
        // Link already removed
      }

      // Multiple cleanup dengan interval berbeda
      const cleanupUrl = () => {
        try {
          window.URL.revokeObjectURL(url);
        } catch (e) {
          // URL already revoked
        }
      };

      // Cleanup dengan beberapa timeout untuk memastikan
      setTimeout(cleanupUrl, 100);
      setTimeout(cleanupUrl, 500);
      setTimeout(cleanupUrl, 1000);

      setSuccess(`File ${fileName} berhasil diunduh!`);
    } catch (error) {
      setError(
        `Gagal mengunduh file: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      // Reset status download untuk file ini
      setDownloadProgress((prev) => ({ ...prev, [materiId]: false }));
    }
  };

  // Fungsi untuk download semua materi dalam ZIP
  const handleDownloadAllMateri = async (
    kode: string,
    materiList: MateriFromAPI[]
  ) => {
    // Prevent multiple ZIP downloads
    if (isZipDownloading) {
      setError("Download ZIP sedang berlangsung, tunggu sebentar...");
      return;
    }

    setIsZipDownloading(true);
    setLoading(true);

    try {
      // Import JSZip secara dinamis
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();

      // Download semua materi dan tambahkan ke ZIP
      for (const materi of materiList) {
        try {
          const timestamp = Date.now();
          const randomId = Math.random().toString(36).substr(2, 9);
          const response = await api.get(
            `/mata-kuliah/${kode}/download-materi`,
            {
              responseType: "blob",
              params: {
                filename: materi.filename,
                _t: timestamp,
                _r: randomId,
              },
              headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
              },
            }
          );

          // Validasi response
          if (!response.data || response.data.size === 0) {
            continue;
          }

          const contentType = response.headers["content-type"] || "";
          if (
            contentType.includes("text/html") ||
            contentType.includes("application/json")
          ) {
            continue;
          }

          // Pastikan response.data adalah Blob yang valid
          let fileBlob = response.data;
          if (!(fileBlob instanceof Blob)) {
            fileBlob = new Blob([response.data], { type: contentType });
          }

          // Tambahkan file ke ZIP dengan nama yang sesuai dan extension yang benar
          let fileName = materi.judul || materi.filename;

          // Pastikan extension file tetap ada
          if (materi.file_type && !fileName.includes("." + materi.file_type)) {
            fileName = `${fileName}.${materi.file_type}`;
          }

          // Jika masih tidak ada extension, ambil dari filename asli
          if (!fileName.includes(".")) {
            const originalExt = materi.filename.split(".").pop();
            if (originalExt) {
              fileName = `${fileName}.${originalExt}`;
            }
          }

          // Tambahkan file ke ZIP
          zip.file(fileName, fileBlob);
        } catch (error) {}
      }

      // Cek apakah ada file yang berhasil di-download
      const zipFiles = Object.keys(zip.files);
      if (zipFiles.length === 0) {
        throw new Error("Tidak ada file yang berhasil di-download untuk ZIP");
      }

      // Generate ZIP file dengan compression
      const zipBlob = await zip.generateAsync({
        type: "blob",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      // Buat Blob unik untuk menghindari cache
      const uniqueZipBlob = new Blob([zipBlob], { type: "application/zip" });
      const url = window.URL.createObjectURL(uniqueZipBlob);
      const link = document.createElement("a");
      link.href = url;
      link.setAttribute(
        "download",
        `Materi_${kode}_${
          new Date().toISOString().split("T")[0]
        }_${Date.now()}.zip`
      );
      link.style.display = "none";

      // Tambahkan ke DOM, klik, dan hapus
      document.body.appendChild(link);
      link.click();

      // Immediate cleanup
      try {
        document.body.removeChild(link);
      } catch (e) {
        // Link already removed
      }

      // Multiple cleanup dengan interval berbeda
      const cleanupUrl = () => {
        try {
          window.URL.revokeObjectURL(url);
        } catch (e) {
          // URL already revoked
        }
      };

      // Cleanup dengan beberapa timeout untuk memastikan
      setTimeout(cleanupUrl, 100);
      setTimeout(cleanupUrl, 500);
      setTimeout(cleanupUrl, 1000);
      setTimeout(cleanupUrl, 2000);

      setSuccess(`${zipFiles.length} materi berhasil diunduh dalam file ZIP!`);
    } catch (error) {
      setError(
        `Gagal mengunduh ZIP: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setIsZipDownloading(false);
      setLoading(false);
    }
  };

  // Helper functions untuk materi
  const handleFilesSelected = (files: File[]) => {
    // Update materiFiles state
    setMateriFiles((prev) => [...prev, ...files]);

    // Update materiItems state dengan data yang sesuai
    const newMateriItems: MateriItem[] = files.map((file) => {
      return {
        filename: file.name,
        judul: file.name.replace(/\.[^/.]+$/, ""), // Default judul = nama file tanpa ekstensi
        file_type: file.name.split(".").pop() || "unknown",
        file_size: file.size,
        file_path: "",
        kode_mata_kuliah: "",
        id: 0,
        upload_date: new Date().toISOString(),
      };
    });

    setMateriItems((prev) => [...prev, ...newMateriItems]);
  };

  const handleMateriItemChange = (
    index: number,
    field: keyof MateriItem,
    value: any
  ) => {
    setMateriItems((prev) =>
      prev.map((item, i) => (i === index ? { ...item, [field]: value } : item))
    );
  };

  // Fungsi untuk delete materi file

  const handleUploadMateri = async (mk: MataKuliah) => {
    setSelectedMataKuliah(mk);
    setShowUploadMateriModal(true);
    // Reset materi state
    setMateriFiles([]);
    setMateriItems([]);
    setMateriToDelete([]); // Reset list materi yang ditandai untuk dihapus

    // Fetch existing materi untuk mata kuliah ini
    try {
      const materiRes = await api.get(`/mata-kuliah/${mk.kode}/materi`);
      setExistingMateriItems(
        Array.isArray(materiRes.data.data) ? materiRes.data.data : []
      );
    } catch (e) {
      setExistingMateriItems([]);
    }
  };

  // Helper function untuk truncate nama file
  const truncateFileName = (fileName: string, maxLength: number = 20) => {
    if (!fileName) return "";
    if (fileName.length <= maxLength) return fileName;

    const dotIdx = fileName.lastIndexOf(".");
    if (dotIdx === -1) return fileName.slice(0, maxLength - 3) + "...";

    const ext = fileName.slice(dotIdx);
    const base = fileName.slice(0, maxLength - 3 - ext.length);
    return base + "..." + ext;
  };

  const handleViewMateri = async (mk: MataKuliah) => {
    try {
      // Fetch materi terbaru untuk mata kuliah ini
      const materiRes = await api.get(`/mata-kuliah/${mk.kode}/materi`);
      const materiData = Array.isArray(materiRes.data.data)
        ? materiRes.data.data
        : [];

      // Update mata kuliah dengan materi terbaru
      const updatedMk = {
        ...mk,
        materi: materiData,
      };

      setSelectedMateriMataKuliah(updatedMk);
      setShowViewMateriModal(true);
      // Reset download state saat modal dibuka
      setDownloadProgress({});
      setIsZipDownloading(false);
    } catch (error) {
      setError("Gagal mengambil data materi");
      // Fallback ke data yang ada
      setSelectedMateriMataKuliah(mk);
      setShowViewMateriModal(true);
      // Reset download state juga di fallback
      setDownloadProgress({});
      setIsZipDownloading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
        Daftar Mata Kuliah
      </h1>

      {/* Info Semester Aktif */}
      {activeSemesterJenis && (
        <div className="mb-4 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
              Semester Aktif: {activeSemesterJenis}
            </span>
            <span className="text-xs text-blue-600 dark:text-blue-400">
              (Filter semester menampilkan mata kuliah periode{" "}
              {activeSemesterJenis})
            </span>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-4 mb-6">
        {/* Header dengan tombol aksi */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 transition-all duration-300 ease-in-out">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleOpenModal}
              className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition-all duration-300 ease-in-out transform"
            >
              Input Data
            </button>
            <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-100 dark:bg-brand-900 text-brand-700 dark:text-brand-200 text-sm font-medium shadow-theme-xs hover:bg-brand-200 dark:hover:bg-brand-800 transition-all duration-300 ease-in-out transform cursor-pointer">
              <FontAwesomeIcon
                icon={faFileExcel}
                className="w-5 h-5 text-brand-700 dark:text-brand-200"
              />
              Import Excel
              <input
                type="file"
                accept=".xlsx,.xls"
                className="hidden"
                onChange={handleImportExcel}
                ref={fileInputRef}
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
        </div>

        {/* Search dan Filter */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="w-full lg:w-72">
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                <svg
                  className="fill-gray-500 dark:fill-gray-400"
                  width="20"
                  height="20"
                  viewBox="0 0 20 20"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
                    fill=""
                  />
                </svg>
              </span>
              <input
                type="text"
                placeholder="Cari apa saja di semua kolom data..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2 w-full lg:w-auto">
            <select
              value={filterSemester}
              onChange={(e) => {
                setFilterSemester(e.target.value);
                setPage(1);
              }}
              className="w-full h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Semua Semester</option>
              {semesterOptions.map((semester) => {
                // Cek apakah semester ini sesuai dengan periode aktif
                const isActivePeriod =
                  semester === "Antara" ||
                  (Array.isArray(data) &&
                    data.find((mk) => mk.semester === semester)?.periode ===
                      activeSemesterJenis);

                return (
                  <option key={semester} value={semester}>
                    {semester === "Antara"
                      ? "Semester Antara"
                      : `Semester ${semester}`}
                    {isActivePeriod &&
                    activeSemesterJenis &&
                    semester !== "Antara"
                      ? ` (${activeSemesterJenis})`
                      : ""}
                  </option>
                );
              })}
            </select>
            <select
              value={filterJenis}
              onChange={(e) => {
                setFilterJenis(e.target.value);
                setPage(1);
              }}
              className="w-full h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Semua Jenis</option>
              {jenisOptions.map((jenis) => (
                <option key={jenis} value={jenis}>
                  {jenis}
                </option>
              ))}
            </select>
            <select
              value={filterBlok}
              onChange={(e) => {
                setFilterBlok(e.target.value);
                setPage(1);
              }}
              className="w-full h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Semua Blok</option>
              {blokOptions.map((blok) => (
                <option
                  key={blok}
                  value={blok?.toString()}
                >{`Blok ke-${blok}`}</option>
              ))}
            </select>
            <select
              value={filterPeriode}
              onChange={(e) => {
                setFilterPeriode(e.target.value);
                setPage(1);
              }}
              className="w-full h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Semua Periode</option>
              {periodeOptions.map((periode) => (
                <option key={periode} value={periode}>
                  {periode === "Antara" ? "Semester Antara" : periode}
                </option>
              ))}
            </select>
            <select
              value={filterKurikulum}
              onChange={(e) => {
                setFilterKurikulum(e.target.value);
                setPage(1);
              }}
              className="w-full h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Semua Kurikulum</option>
              {kurikulumOptions.map((kurikulum) => (
                <option key={kurikulum} value={kurikulum}>
                  {kurikulum}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Preview Data Section */}
        {importedFile && previewData.length > 0 && (
          <div className="w-full mt-4">
            <div className="mb-2 text-sm text-gray-700 dark:text-gray-200 font-semibold">
              Preview Data:{" "}
              <span className="font-normal text-gray-500 dark:text-gray-400">
                {importedFile.name}
              </span>
            </div>
            {/* Error di atas tabel preview */}
            {(validationErrors.length > 0 || cellErrors.length > 0) && (
              <div className="mb-4">
                <div className="bg-red-100 rounded-md p-3">
                  <div className="text-base font-semibold text-red-500 mb-1">
                    {validationErrors.length > 0
                      ? "Semua data gagal diimpor. Periksa kembali format dan isian data:"
                      : "Sebagian data gagal diimpor karena tidak valid:"}
                  </div>
                  <ul className="list-disc pl-5 text-sm text-red-600">
                    {/* Error header/field tidak sesuai */}
                    {validationErrors
                      .filter(
                        (e) =>
                          typeof e === "string" &&
                          e.includes("Kolom yang diperlukan")
                      )
                      .map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                    {/* Error cell/detail */}
                    {cellErrors.map((err, idx) => (
                      <li key={idx}>
                        {err.message} (Baris {err.row + 2}, Kolom{" "}
                        {err.field.toUpperCase()}):{" "}
                        {previewData[err.row]?.[err.field] || ""}
                      </li>
                    ))}
                    {/* Error lain yang tidak duplikat dengan cellErrors */}
                    {validationErrors
                      .filter(
                        (err) =>
                          !cellErrors.some((cell) => err.includes(cell.message))
                      )
                      .filter((e) => !e.includes("Kolom yang diperlukan"))
                      .map((err, idx) => (
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
                style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
              >
                <style>{`
                .max-w-full::-webkit-scrollbar { display: none; }
              `}</style>
                <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                  <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                    <tr>
                      {previewData[0] ? (
                        Object.keys(previewData[0]).map((colKey) => (
                          <th
                            key={colKey}
                            className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400"
                          >
                            {colKey.toUpperCase()}
                          </th>
                        ))
                      ) : (
                        <th className="px-6 py-4 text-gray-400">
                          (Tidak ada header)
                        </th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedPreviewData.length > 0 ? (
                      paginatedPreviewData.map((row, i) => {
                        const globalRowIdx =
                          (previewPage - 1) * previewPageSize + i;
                        return (
                          <tr
                            key={i}
                            className={
                              i % 2 === 1
                                ? "bg-gray-50 dark:bg-white/[0.02]"
                                : ""
                            }
                          >
                            {previewData[0] &&
                              Object.keys(previewData[0]).map((colKey, _) => {
                                const isEditing =
                                  editingCell?.row === globalRowIdx &&
                                  editingCell?.key === colKey;
                                const cellError = cellErrors.find(
                                  (err) =>
                                    err.row === globalRowIdx &&
                                    err.field === colKey
                                );
                                return (
                                  <td
                                    key={colKey}
                                    className={`px-6 py-4 border-b border-gray-100 dark:border-gray-800 text-gray-800 dark:text-gray-100 whitespace-nowrap cursor-pointer hover:bg-brand-50 dark:hover:bg-brand-700/20 ${
                                      isEditing
                                        ? "border-2 border-brand-500"
                                        : ""
                                    } ${
                                      cellError
                                        ? "bg-red-100 dark:bg-red-900/30"
                                        : ""
                                    }`}
                                    onClick={() =>
                                      setEditingCell({
                                        row: globalRowIdx,
                                        key: colKey,
                                      })
                                    }
                                    title={cellError ? cellError.message : ""}
                                  >
                                    {isEditing ? (
                                      <input
                                        className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                        value={
                                          Array.isArray(
                                            previewData[editingCell.row][
                                              editingCell.key
                                            ]
                                          )
                                            ? previewData[editingCell.row][
                                                editingCell.key
                                              ].join(", ")
                                            : previewData[editingCell.row][
                                                editingCell.key
                                              ] || ""
                                        }
                                        onChange={(e) => {
                                          let val = e.target.value;
                                          handleCellEdit(
                                            globalRowIdx,
                                            colKey,
                                            val
                                          );
                                        }}
                                        onBlur={() => setEditingCell(null)}
                                        autoFocus
                                      />
                                    ) : Array.isArray(row[colKey]) ? (
                                      row[colKey].join(", ")
                                    ) : (
                                      row[colKey]
                                    )}
                                  </td>
                                );
                              })}
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td
                          colSpan={14}
                          className="text-center py-8 text-gray-400 dark:text-gray-500"
                        >
                          Belum ada data.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {/* Pagination Preview */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4">
                <div className="flex items-center gap-4">
                  <select
                    value={previewPageSize}
                    onChange={(e) => {
                      setPreviewPageSize(Number(e.target.value));
                      setPreviewPage(1);
                    }}
                    className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none"
                  >
                    {PAGE_SIZE_OPTIONS.map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    Menampilkan {paginatedPreviewData.length} dari{" "}
                    {previewData.length} data
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
                          ? "bg-brand-500 text-white"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      } transition`}
                    >
                      {i + 1}
                    </button>
                  ))}
                  <button
                    onClick={() =>
                      setPreviewPage((p) => Math.min(previewTotalPages, p + 1))
                    }
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
                }}
                type="button"
              >
                Batal
              </button>
              <button
                className={`px-4 py-2 rounded-lg text-sm font-medium shadow-theme-xs flex items-center justify-center min-w-[160px] transition
                ${
                  isSaving || loading
                    ? "bg-emerald-800 text-white opacity-60 cursor-not-allowed"
                    : "bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600"
                }`}
                onClick={handleSubmitImport}
                disabled={isSaving || loading}
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
                    Mengimpor...
                  </>
                ) : (
                  "Import ke Database"
                )}
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

        <AnimatePresence>
          {importedCount > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
            >
              {importedCount} data mata kuliah berhasil diimpor ke database.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error Messages */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="mt-4 p-3 rounded-lg bg-red-100 text-red-700"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Tabel dengan scroll horizontal */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div
          className="max-w-full overflow-x-auto hide-scroll"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
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
                <th className="px-4 py-4">
                  <button
                    type="button"
                    aria-checked={
                      filteredData.length > 0 &&
                      filteredData.every((mk) => selectedRows.includes(mk.kode))
                    }
                    role="checkbox"
                    onClick={() => {
                      if (
                        filteredData.length > 0 &&
                        filteredData.every((mk) =>
                          selectedRows.includes(mk.kode)
                        )
                      ) {
                        setSelectedRows([]);
                      } else {
                        setSelectedRows(filteredData.map((mk) => mk.kode));
                      }
                    }}
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      filteredData.length > 0 &&
                      filteredData.every((mk) => selectedRows.includes(mk.kode))
                        ? "bg-brand-500 border-brand-500"
                        : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"
                    } cursor-pointer`}
                  >
                    {filteredData.length > 0 &&
                      filteredData.every((mk) =>
                        selectedRows.includes(mk.kode)
                      ) && (
                        <svg
                          className="w-3 h-3 text-white"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={3}
                          viewBox="0 0 24 24"
                        >
                          <polyline points="20 7 11 17 4 10" />
                        </svg>
                      )}
                  </button>
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Kode
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Mata Kuliah
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Jenis
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Blok ke-
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Semester
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Periode
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Kurikulum
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Tanggal Mulai
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Tanggal Akhir
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Durasi Minggu
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Tipe Non-Blok
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Peran dalam Kurikulum
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Keahlian Dibutuhkan
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  RPS
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Materi
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: 8 }).map((_, idx) => (
                  <tr
                    key={idx}
                    className={
                      idx % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""
                    }
                  >
                    <td className="px-4 py-4">
                      <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="h-8 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </div>
                    </td>
                  </tr>
                ))
              ) : paginatedData.length > 0 ? (
                paginatedData.map((mk, idx) => (
                  <tr
                    key={mk.kode}
                    className={
                      idx % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""
                    }
                  >
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        aria-checked={selectedRows.includes(mk.kode)}
                        role="checkbox"
                        onClick={() => {
                          if (selectedRows.includes(mk.kode)) {
                            setSelectedRows(
                              selectedRows.filter((id) => id !== mk.kode)
                            );
                          } else {
                            setSelectedRows([...selectedRows, mk.kode]);
                          }
                        }}
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                          selectedRows.includes(mk.kode)
                            ? "bg-brand-500 border-brand-500"
                            : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"
                        } cursor-pointer`}
                      >
                        {selectedRows.includes(mk.kode) && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth={3}
                            viewBox="0 0 24 24"
                          >
                            <polyline points="20 7 11 17 4 10" />
                          </svg>
                        )}
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-800 dark:text-white/90 align-middle">
                      {mk.kode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                      {mk.nama}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                      {mk.jenis}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                      {mk.jenis === "Blok" ? `Blok ke-${mk.blok}` : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                      {mk.semester === "Antara"
                        ? "Semester Antara"
                        : `Semester ${mk.semester}`}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                      {mk.periode === "Antara" ? "Semester Antara" : mk.periode}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                      {mk.kurikulum}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                      {mk.tanggalMulai || mk.tanggal_mulai
                        ? new Date(
                            mk.tanggalMulai || mk.tanggal_mulai || ""
                          ).toLocaleDateString("id-ID")
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                      {mk.tanggalAkhir || mk.tanggal_akhir
                        ? new Date(
                            mk.tanggalAkhir || mk.tanggal_akhir || ""
                          ).toLocaleDateString("id-ID")
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                      {(mk.durasiMinggu ?? mk.durasi_minggu) !== null &&
                      (mk.durasiMinggu ?? mk.durasi_minggu) !== undefined
                        ? `${mk.durasiMinggu ?? mk.durasi_minggu} Minggu`
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                      {mk.jenis === "Non Blok"
                        ? mk.semester === "Antara"
                          ? "Non-CSR"
                          : mk.tipe_non_block || "-"
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-pre-line text-gray-800 dark:text-white/90 align-middle min-w-[300px]">
                      {Array.isArray(mk.peran_dalam_kurikulum) &&
                      mk.peran_dalam_kurikulum.length > 0
                        ? mk.peran_dalam_kurikulum.join(", ")
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-pre-line text-gray-800 dark:text-white/90 align-middle min-w-[200px]">
                      {Array.isArray(mk.keahlian_required) &&
                      mk.keahlian_required.length > 0
                        ? mk.keahlian_required.join(", ")
                        : "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                      {mk.rps_file ? (
                        <div className="flex items-center space-x-2">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                              <svg
                                className="w-4 h-4 text-blue-600 dark:text-blue-400"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                              {(() => {
                                const fileName = mk.rps_file;
                                if (fileName.length <= 25) return fileName;
                                const dotIdx = fileName.lastIndexOf(".");
                                if (dotIdx === -1)
                                  return fileName.slice(0, 22) + "...";
                                const ext = fileName.slice(dotIdx);
                                const base = fileName.slice(0, 22 - ext.length);
                                return base + "..." + ext;
                              })()}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400 text-left w-full">
                              File RPS
                            </p>
                          </div>
                          <div className="flex-shrink-0">
                            <button
                              onClick={() =>
                                handleDownloadRps(mk.kode, mk.rps_file!)
                              }
                              className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-md transition-colors duration-200"
                              title="Download File RPS"
                            >
                              <svg
                                className="w-3 h-3"
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                />
                              </svg>
                              <span className="hidden sm:inline">Download</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                      {mk.materi && mk.materi.length > 0 ? (
                        <button
                          onClick={() => handleViewMateri(mk)}
                          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors duration-200"
                          title="Lihat semua materi"
                        >
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                            />
                          </svg>
                          Lihat Materi ({mk.materi.length})
                        </button>
                      ) : (
                        <span className="text-gray-400 dark:text-gray-500 text-sm">
                          -
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => {
                            if (mk.jenis === "Blok") {
                              // Cek apakah semester antara
                              if (mk.semester === "Antara") {
                                navigate(`/mata-kuliah/blok-antara/${mk.kode}`);
                              } else {
                                navigate(`/mata-kuliah/blok/${mk.kode}`);
                              }
                            } else if (
                              mk.jenis === "Non Blok" &&
                              mk.tipe_non_block === "CSR"
                            ) {
                              navigate(`/mata-kuliah/non-blok-csr/${mk.kode}`);
                            } else if (
                              mk.jenis === "Non Blok" &&
                              mk.tipe_non_block === "Non-CSR"
                            ) {
                              // Cek apakah semester antara
                              if (mk.semester === "Antara") {
                                navigate(
                                  `/mata-kuliah/non-blok-non-csr-antara/${mk.kode}`
                                );
                              } else {
                                navigate(
                                  `/mata-kuliah/non-blok-non-csr/${mk.kode}`
                                );
                              }
                            }
                          }}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-blue-600 hover:text-blue-800 dark:hover:text-blue-400 transition"
                          title="Penjadwalan"
                        >
                          <FontAwesomeIcon
                            icon={faEye}
                            className="w-4 h-4 sm:w-5 sm:h-5"
                          />
                          <span className="hidden sm:inline">Penjadwalan</span>
                        </button>
                        <button
                          onClick={() => handleEdit(mk)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 transition"
                          title="Edit"
                        >
                          <FontAwesomeIcon
                            icon={faPenToSquare}
                            className="w-4 h-4 sm:w-5 sm:h-5"
                          />
                          <span className="hidden sm:inline">Edit</span>
                        </button>
                        <button
                          onClick={() => handleUploadMateri(mk)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-purple-500 hover:text-purple-700 dark:hover:text-purple-300 transition"
                          title="Upload Materi"
                        >
                          <FontAwesomeIcon
                            icon={faUpload}
                            className="w-4 h-4 sm:w-5 sm:h-5"
                          />
                          <span className="hidden sm:inline">
                            Upload Materi
                          </span>
                        </button>
                        <button
                          onClick={() => handleDelete(mk.kode)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition"
                          title="Delete"
                        >
                          <FontAwesomeIcon
                            icon={faTrash}
                            className="w-4 h-4 sm:w-5 sm:h-5"
                          />
                          <span className="hidden sm:inline">Delete</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={14}
                    className="text-center py-8 text-gray-400 dark:text-gray-500"
                  >
                    Belum ada data.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-4">
          <div className="flex items-center gap-4">
            <select
              id="perPage"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none"
            >
              {PAGE_SIZE_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Menampilkan {paginatedData.length} dari {filteredData.length} data
            </span>
          </div>
          <div className="flex items-center gap-2 justify-center sm:justify-end">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
            >
              Prev
            </button>

            {/* Smart Pagination with Scroll */}
            <div
              className="flex items-center gap-1 max-w-[400px] overflow-x-auto pagination-scroll"
              style={{
                scrollbarWidth: "thin",
                scrollbarColor: "#cbd5e1 #f1f5f9",
              }}
            >
              <style
                dangerouslySetInnerHTML={{
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
                `,
                }}
              />

              {/* Always show first page */}
              <button
                onClick={() => setPage(1)}
                className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                  page === 1
                    ? "bg-brand-500 text-white"
                    : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                1
              </button>

              {/* Show ellipsis if current page is far from start */}
              {page > 4 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">
                  ...
                </span>
              )}

              {/* Show pages around current page */}
              {Array.from({ length: totalPages }, (_, i) => {
                const pageNum = i + 1;
                // Show pages around current page (2 pages before and after)
                const shouldShow =
                  pageNum > 1 &&
                  pageNum < totalPages &&
                  pageNum >= page - 2 &&
                  pageNum <= page + 2;

                if (!shouldShow) return null;

                return (
                  <button
                    key={i}
                    onClick={() => setPage(pageNum)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                      page === pageNum
                        ? "bg-brand-500 text-white"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}

              {/* Show ellipsis if current page is far from end */}
              {page < totalPages - 3 && (
                <span className="px-2 text-gray-500 dark:text-gray-400">
                  ...
                </span>
              )}

              {/* Always show last page if it's not the first page */}
              {totalPages > 1 && (
                <button
                  onClick={() => setPage(totalPages)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                    page === totalPages
                      ? "bg-brand-500 text-white"
                      : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
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

      {/* Modal Input/Edit Data */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
            ></motion.div>
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={handleCloseModal}
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
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                    {editMode ? "Edit Mata Kuliah" : "Tambah Mata Kuliah"}
                  </h2>
                </div>
                
                {/* Error Message di Modal */}
                {modalError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start gap-2">
                      <svg
                        className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <p className="text-sm text-red-600 dark:text-red-400">
                        {modalError}
                      </p>
                    </div>
                  </div>
                )}
                
                <div>
                  <div className="mb-3 sm:mb-4">
                    <label
                      htmlFor="kode"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Kode Mata Kuliah
                      {!editMode && (
                        <span className="text-xs text-gray-500 dark:text-gray-400 ml-1">
                          (Auto-generated)
                        </span>
                      )}
                    </label>
                    <input
                      type="text"
                      id="kode"
                      name="kode"
                      value={form.kode}
                      readOnly={!editMode}
                      onChange={
                        editMode
                          ? (e) => setForm({ ...form, kode: e.target.value })
                          : undefined
                      }
                      className={`w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 font-normal text-sm sm:text-base ${
                        editMode
                          ? "bg-white dark:bg-gray-800 text-gray-800 dark:text-white"
                          : "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                      }`}
                      placeholder={
                        editMode
                          ? "Masukkan kode mata kuliah"
                          : "Kode akan otomatis terisi berdasarkan semester, jenis, dan blok"
                      }
                    />
                    {editMode && (
                      <button
                        type="button"
                        onClick={() => {
                          const generatedKode = generateKodeMataKuliah(
                            form.semester,
                            form.jenis,
                            form.blok
                          );
                          if (generatedKode) {
                            setForm({ ...form, kode: generatedKode });
                          }
                        }}
                        className="mt-2 px-3 py-1.5 text-xs sm:text-sm bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors duration-200"
                      >
                        Generate Kode
                      </button>
                    )}
                    {!editMode && (
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Kode otomatis berdasarkan:{" "}
                        {form.semester === "Antara"
                          ? "Semester Antara"
                          : `Semester ${form.semester}`}{" "}
                        - {form.jenis}{" "}
                        {form.jenis === "Blok" && form.blok
                          ? `Blok ${form.blok}`
                          : ""}
                      </div>
                    )}
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <label
                      htmlFor="nama"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Nama Mata Kuliah
                    </label>
                    <input
                      type="text"
                      id="nama"
                      name="nama"
                      value={form.nama}
                      onChange={(e) => {
                        const updatedForm = { ...form, nama: e.target.value };
                        setForm(updatedForm);
                      }}
                      className={`w-full px-3 py-2 rounded-lg border ${"border-gray-300 dark:border-gray-700"} bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-brand-500 dark:focus:bg-gray-800`}
                      placeholder="Masukkan nama mata kuliah"
                    />
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <label
                      htmlFor="semester"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Semester
                    </label>
                    <select
                      id="semester"
                      name="semester"
                      value={form.semester}
                      onChange={(e) => {
                        const semester =
                          e.target.value === "Antara"
                            ? "Antara"
                            : Number(e.target.value);
                        const updatedForm = {
                          ...form,
                          semester,
                          periode: getPeriodeBySemester(semester),
                          // Reset peran dan keahlian jika semester Antara
                          peran_dalam_kurikulum:
                            semester === "Antara"
                              ? []
                              : form.peran_dalam_kurikulum,
                          keahlian_required:
                            semester === "Antara" ? [] : form.keahlian_required,
                          // Otomatis set tipe_non_block menjadi Non-CSR jika semester Antara
                          tipe_non_block:
                            semester === "Antara"
                              ? "Non-CSR"
                              : form.tipe_non_block,
                        };

                        // Auto-generate kode berdasarkan semester, jenis, dan blok
                        if (!editMode) {
                          updatedForm.kode = generateKodeMataKuliah(
                            semester,
                            updatedForm.jenis,
                            updatedForm.blok
                          );
                        }

                        setForm(updatedForm);
                      }}
                      className={`w-full px-3 py-2 rounded-lg border ${"border-gray-300 dark:border-gray-700"} bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-brand-500`}
                    >
                      {SEMESTER_OPTIONS.map((semester) => (
                        <option key={semester} value={semester}>
                          {semester === "Antara"
                            ? "Semester Antara"
                            : `Semester ${semester}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <label
                      htmlFor="jenis"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Jenis Mata Kuliah
                    </label>
                    <select
                      id="jenis"
                      name="jenis"
                      value={form.jenis}
                      onChange={(e) => {
                        const jenis = e.target.value as "Blok" | "Non Blok";
                        const updatedForm = { ...form, jenis };

                        // Auto-generate kode berdasarkan semester, jenis, dan blok
                        if (!editMode) {
                          updatedForm.kode = generateKodeMataKuliah(
                            updatedForm.semester,
                            jenis,
                            updatedForm.blok
                          );
                        }

                        setForm(updatedForm);
                      }}
                      className={`w-full px-3 py-2 rounded-lg border ${"border-gray-300 dark:border-gray-700"} bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-brand-500`}
                    >
                      {JENIS_OPTIONS.map((jenis) => (
                        <option key={jenis} value={jenis}>
                          {jenis}
                        </option>
                      ))}
                    </select>
                  </div>
                  {form.jenis === "Non Blok" && form.semester !== "Antara" && (
                    <div className="mb-3 sm:mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tipe Non-Block
                      </label>
                      {!editMode ? (
                        <div className="flex gap-2 mt-1">
                          {["Non-CSR", "CSR"].map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                const tipe_non_block = opt as "CSR" | "Non-CSR";
                                const updatedForm = { ...form, tipe_non_block };

                                // Auto-generate kode berdasarkan semester, jenis, dan blok
                                if (!editMode) {
                                  updatedForm.kode = generateKodeMataKuliah(
                                    updatedForm.semester,
                                    updatedForm.jenis,
                                    updatedForm.blok
                                  );
                                }

                                setForm(updatedForm);
                              }}
                              className={
                                `px-5 py-2 rounded-lg border text-sm font-semibold transition ` +
                                (form.tipe_non_block === opt
                                  ? "bg-brand-500 text-white border-brand-500 shadow"
                                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 border-gray-300 dark:border-gray-700 hover:bg-brand-100 dark:hover:bg-brand-900")
                              }
                              style={{
                                boxShadow:
                                  form.tipe_non_block === opt
                                    ? "0 2px 8px 0 rgba(16,185,129,0.15)"
                                    : undefined,
                                letterSpacing: "0.02em",
                              }}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="inline-block px-4 py-2 rounded bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-white font-semibold">
                          {form.tipe_non_block}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Input CSR jika Non Blok & CSR & bukan semester Antara */}
                  {form.jenis === "Non Blok" &&
                    form.tipe_non_block === "CSR" &&
                    form.semester !== "Antara" && (
                      <div className="mb-3 sm:mb-4">
                        <div className="flex items-center justify-between mb-2">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                            Daftar CSR
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              const newCsrNumber = csrList.length + 1;
                              // Cari blok ke-n di semester yang sama
                              const blok = data.find(
                                (mk) =>
                                  mk.jenis === "Blok" &&
                                  isSemesterMatch(mk.semester, form.semester) &&
                                  mk.blok === newCsrNumber
                              );
                              const newCsr = {
                                nomor_csr: `${form.semester}.${newCsrNumber}`,
                                tanggal_mulai: blok
                                  ? blok.tanggalMulai ||
                                    blok.tanggal_mulai ||
                                    ""
                                  : "",
                                tanggal_akhir: blok
                                  ? blok.tanggalAkhir ||
                                    blok.tanggal_akhir ||
                                    ""
                                  : "",
                                keahlian_required: [],
                              };
                              setCsrList([...csrList, newCsr]);
                            }}
                            className="px-4 py-2 text-xs bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
                          >
                            Tambah CSR
                          </button>
                        </div>
                        <div className="mt-2">
                          {/* Label untuk kolom nomor CSR, tanggal mulai, tanggal akhir */}
                          <div className="flex gap-2 items-center mb-1 pl-0">
                            <span
                              className="w-20 block text-xs font-medium text-gray-500 dark:text-gray-400 text-left"
                              style={{ marginLeft: "2px" }}
                            >
                              CSR Ke
                            </span>
                            <span className="w-36 block text-xs font-medium text-gray-500 dark:text-gray-400 text-left ml-0">
                              Tanggal Mulai
                            </span>
                            <span className="w-36 block text-xs font-medium text-gray-500 dark:text-gray-400 text-left ml-0">
                              Tanggal Akhir
                            </span>
                            <span className="w-20 block text-xs font-medium text-gray-500 dark:text-gray-400 text-left">
                              Aksi
                            </span>
                          </div>
                          {csrList.map((csr, idx) => {
                            const csrId = csr.id
                              ? csr.id.toString()
                              : `temp_${idx}`;
                            const keahlianList = csrKeahlian[csrId] || [];
                            const newKeahlian = newKeahlianCSR[csrId] || "";

                            return (
                              <div key={csr.id || idx} className="mb-4">
                                {/* CSR Info Row */}
                                <div className="flex gap-2 my-2 items-center">
                                  <input
                                    type="text"
                                    value={csr.nomor_csr}
                                    onChange={(
                                      e: ChangeEvent<HTMLInputElement>
                                    ) =>
                                      setCsrList((list) =>
                                        list.map((c, i) =>
                                          i === idx
                                            ? {
                                                ...c,
                                                nomor_csr: e.target.value,
                                              }
                                            : c
                                        )
                                      )
                                    }
                                    className="w-20 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100 text-center"
                                  />
                                  <input
                                    type="date"
                                    value={toDateInputValue(csr.tanggal_mulai)}
                                    onChange={(e) =>
                                      setCsrList((list) =>
                                        list.map((c, i) =>
                                          i === idx
                                            ? {
                                                ...c,
                                                tanggal_mulai: e.target.value,
                                              }
                                            : c
                                        )
                                      )
                                    }
                                    className="w-36 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                                  />
                                  <input
                                    type="date"
                                    value={toDateInputValue(csr.tanggal_akhir)}
                                    onChange={(e) =>
                                      setCsrList((list) =>
                                        list.map((c, i) =>
                                          i === idx
                                            ? {
                                                ...c,
                                                tanggal_akhir: e.target.value,
                                              }
                                            : c
                                        )
                                      )
                                    }
                                    className="w-36 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteCsr(idx)}
                                    className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                                  >
                                    Hapus
                                  </button>
                                </div>

                                {/* Keahlian CSR Section */}
                                <div className="ml-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                      Keahlian CSR {csr.nomor_csr}
                                    </label>
                                  </div>

                                  {/* Input Keahlian */}
                                  <div className="flex gap-2 mb-3">
                                    <input
                                      type="text"
                                      value={newKeahlian}
                                      onChange={(e) =>
                                        setNewKeahlianCSR((prev) => ({
                                          ...prev,
                                          [csrId]: e.target.value,
                                        }))
                                      }
                                      placeholder="Tambah keahlian..."
                                      className="flex-1 px-3 py-2 text-sm border border-gray-300 dark:border-gray-700 rounded-lg focus:ring-brand-500 focus:border-brand-500 bg-white dark:bg-gray-900 text-gray-800 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                                    />
                                    <button
                                      type="button"
                                      onClick={() =>
                                        handleAddKeahlianCSR(csrId)
                                      }
                                      disabled={!newKeahlian.trim()}
                                      className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                      Tambah
                                    </button>
                                  </div>

                                  {/* List Keahlian */}
                                  {keahlianList.length > 0 && (
                                    <div className="flex flex-wrap gap-2">
                                      {keahlianList.map(
                                        (keahlian, keahlianIdx) => (
                                          <div
                                            key={keahlianIdx}
                                            className="flex items-center gap-2 px-3 py-1 bg-brand-100 dark:bg-brand-900/40 text-brand-800 dark:text-brand-200 rounded-full text-sm"
                                          >
                                            <span>{keahlian}</span>
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleRemoveKeahlianCSR(
                                                  csrId,
                                                  keahlian
                                                )
                                              }
                                              className="text-brand-600 dark:text-brand-400 hover:text-brand-800 dark:hover:text-brand-200 transition-colors"
                                            >
                                              ×
                                            </button>
                                          </div>
                                        )
                                      )}
                                    </div>
                                  )}

                                  {keahlianList.length === 0 && (
                                    <div className="text-sm text-gray-500 dark:text-gray-400">
                                      Belum ada keahlian. Tambahkan keahlian
                                      untuk CSR ini.
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                          {csrList.length === 0 && (
                            <div className="text-center py-4 text-gray-500 dark:text-gray-400 text-sm">
                              Belum ada CSR. Klik "Tambah CSR" untuk
                              menambahkan.
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                  {/* Input PBL jika Blok */}
                  {form.jenis === "Blok" && (
                    <div className="mb-3 sm:mb-4">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                        Daftar Modul PBL
                      </label>
                      <div className="mt-2 flex flex-col gap-3">
                        {pblList.length === 0 ? (
                          <div className="text-gray-500 dark:text-gray-400 text-sm">
                            Belum ada modul PBL.
                          </div>
                        ) : (
                          pblList.map((pbl, idx) => (
                            <div
                              key={idx}
                              className="flex gap-2 items-center bg-gray-50 dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"
                            >
                              <span className="w-24 text-xs font-medium text-gray-700 dark:text-gray-300 text-center">
                                Modul Ke-{idx + 1}
                              </span>
                              <input
                                type="text"
                                value={String(idx + 1)}
                                readOnly
                                className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 text-center cursor-not-allowed"
                              />
                              <input
                                type="text"
                                placeholder="Nama Modul"
                                value={pbl.nama_modul}
                                onChange={(e) =>
                                  setPblList((list) =>
                                    list.map((c, i) =>
                                      i === idx
                                        ? { ...c, nama_modul: e.target.value }
                                        : c
                                    )
                                  )
                                }
                                className="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setPblList((list) =>
                                    list.filter((_, i) => i !== idx)
                                  )
                                }
                                className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                              >
                                Hapus
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setPblList((list) => [
                            ...list,
                            {
                              modul_ke: String(list.length + 1),
                              nama_modul: "",
                            },
                          ])
                        }
                        className="mt-3 px-4 py-2 text-xs bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
                      >
                        Tambah Modul PBL
                      </button>
                    </div>
                  )}

                  {/* Input Jurnal Reading jika Blok */}
                  {form.jenis === "Blok" && (
                    <div className="mb-3 sm:mb-4">
                      <label className="block text-sm font-semibold text-gray-700 dark:text-gray-200 mb-1">
                        Daftar Jurnal Reading
                      </label>
                      <div className="mt-2 flex flex-col gap-3">
                        {jurnalReadingList.length === 0 ? (
                          <div className="text-gray-500 dark:text-gray-400 text-sm">
                            Belum ada jurnal reading.
                          </div>
                        ) : (
                          jurnalReadingList.map((jurnal, idx) => (
                            <div
                              key={idx}
                              className="flex gap-2 items-center bg-gray-50 dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700"
                            >
                              <span className="w-24 text-xs font-medium text-gray-700 dark:text-gray-300 text-center">
                                Jurnal Reading Ke-{idx + 1}
                              </span>
                              <input
                                type="text"
                                value={String(idx + 1)}
                                readOnly
                                className="w-16 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-100 text-center cursor-not-allowed"
                              />
                              <input
                                type="text"
                                placeholder="Nama Jurnal Reading"
                                value={jurnal.nama_topik}
                                onChange={(e) =>
                                  setJurnalReadingList((list) =>
                                    list.map((c, i) =>
                                      i === idx
                                        ? { ...c, nama_topik: e.target.value }
                                        : c
                                    )
                                  )
                                }
                                className="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100"
                              />
                              <button
                                type="button"
                                onClick={() =>
                                  setJurnalReadingList((list) =>
                                    list.filter((_, i) => i !== idx)
                                  )
                                }
                                className="px-3 py-1 text-xs bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                              >
                                Hapus
                              </button>
                            </div>
                          ))
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setJurnalReadingList((list) => [
                            ...list,
                            {
                              topik_ke: String(list.length + 1),
                              nama_topik: "",
                            },
                          ])
                        }
                        className="mt-3 px-4 py-2 text-xs bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors"
                      >
                        Tambah Topik Jurnal Reading
                      </button>
                    </div>
                  )}
                  {form.jenis === "Blok" && (
                    <div className="mb-3 sm:mb-4">
                      <label
                        htmlFor="blok"
                        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                      >
                        Blok ke-
                      </label>
                      <select
                        id="blok"
                        name="blok"
                        value={form.blok || ""}
                        onChange={(e) => {
                          const value = e.target.value
                            ? parseInt(e.target.value, 10)
                            : null;
                          const updatedForm = { ...form, blok: value };

                          // Auto-generate kode berdasarkan semester, jenis, dan blok
                          if (!editMode) {
                            updatedForm.kode = generateKodeMataKuliah(
                              updatedForm.semester,
                              updatedForm.jenis,
                              value
                            );
                          }

                          setForm(updatedForm);
                        }}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                      >
                        <option value="">Pilih Blok</option>
                        <option value="1">Blok 1</option>
                        <option value="2">Blok 2</option>
                        <option value="3">Blok 3</option>
                        <option value="4">Blok 4</option>
                      </select>
                    </div>
                  )}
                  <div className="mb-3 sm:mb-4">
                    <label
                      htmlFor="periode"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Periode
                    </label>
                    <input
                      type="text"
                      id="periode"
                      name="periode"
                      value={form.periode}
                      readOnly
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm sm:text-base cursor-not-allowed"
                    />
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <label
                      htmlFor="kurikulum"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Kurikulum
                    </label>
                    <input
                      type="number"
                      id="kurikulum"
                      name="kurikulum"
                      value={form.kurikulum || ""}
                      min={2000}
                      max={2100}
                      step={1}
                      onChange={(e) => {
                        const year = e.target.value
                          ? parseInt(e.target.value, 10)
                          : 0;
                        setForm({ ...form, kurikulum: year });
                      }}
                      className={`w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-brand-500`}
                      placeholder="Masukkan tahun kurikulum (misal: 2024)"
                    />
                  </div>
                  {form.semester !== "Antara" && (
                    <div className="mb-3 sm:mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Peran dalam Kurikulum
                      </label>
                      <Listbox
                        value={
                          Array.isArray(form.peran_dalam_kurikulum)
                            ? form.peran_dalam_kurikulum
                            : []
                        }
                        onChange={(val) =>
                          setForm((f) => ({ ...f, peran_dalam_kurikulum: val }))
                        }
                        multiple
                      >
                        {({ open }) => (
                          <div className="relative">
                            <Listbox.Button className="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm">
                              <span className="block truncate">
                                {Array.isArray(form.peran_dalam_kurikulum) &&
                                form.peran_dalam_kurikulum.length > 0
                                  ? form.peran_dalam_kurikulum.join(", ")
                                  : "Pilih Peran"}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <FontAwesomeIcon
                                  icon={faChevronDown}
                                  className="h-5 w-5 text-gray-400"
                                  aria-hidden="true"
                                />
                              </span>
                            </Listbox.Button>
                            <Transition
                              show={open}
                              as={"div"}
                              leave="transition ease-in duration-100"
                              leaveFrom="opacity-100"
                              leaveTo="opacity-0"
                              className="absolute z-50 mt-1 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm max-h-60 hide-scroll"
                            >
                              <Listbox.Options static>
                                {peranKurikulumList.length === 0 ? (
                                  <Listbox.Option
                                    className="relative cursor-default select-none py-2.5 pl-4 pr-4 text-gray-400 dark:text-gray-500"
                                    value=""
                                    disabled
                                  >
                                    Belum ada peran
                                  </Listbox.Option>
                                ) : (
                                  peranKurikulumList.map((peran) => (
                                    <Listbox.Option
                                      key={peran}
                                      className={({ active }) =>
                                        `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                                          active
                                            ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                                            : "text-gray-900 dark:text-gray-100"
                                        }`
                                      }
                                      value={peran}
                                    >
                                      {({ selected }) => (
                                        <div className="flex items-center justify-between">
                                          <span
                                            className={`block truncate ${
                                              selected
                                                ? "font-medium"
                                                : "font-normal"
                                            }`}
                                          >
                                            {peran}
                                          </span>
                                          {selected && (
                                            <span className="text-brand-500">
                                              <svg
                                                className="w-5 h-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M5 13l4 4L19 7"
                                                />
                                              </svg>
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </Listbox.Option>
                                  ))
                                )}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        )}
                      </Listbox>
                      <div className="flex gap-2 mt-3">
                        <input
                          type="text"
                          value={peranKurikulumInput}
                          onChange={(e) =>
                            setPeranKurikulumInput(e.target.value)
                          }
                          placeholder="Tambah peran baru"
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              peranKurikulumInput.trim() &&
                              !peranKurikulumList.includes(
                                peranKurikulumInput.trim()
                              )
                            ) {
                              setPeranKurikulumList((prev) =>
                                [...prev, peranKurikulumInput.trim()].sort()
                              );
                              setForm((prev) => ({
                                ...prev,
                                peran_dalam_kurikulum: Array.isArray(
                                  prev.peran_dalam_kurikulum
                                )
                                  ? [
                                      ...prev.peran_dalam_kurikulum,
                                      peranKurikulumInput.trim(),
                                    ]
                                  : typeof prev.peran_dalam_kurikulum ===
                                      "string" &&
                                    String(
                                      prev.peran_dalam_kurikulum || ""
                                    ).trim() !== ""
                                  ? [
                                      ...String(
                                        prev.peran_dalam_kurikulum || ""
                                      )
                                        .split(",")
                                        .map((k: any) => String(k).trim())
                                        .filter((k: string) => k !== ""),
                                      peranKurikulumInput.trim(),
                                    ]
                                  : [peranKurikulumInput.trim()],
                              }));
                              setPeranKurikulumInput("");
                            }
                          }}
                          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition flex items-center justify-center"
                          disabled={
                            !peranKurikulumInput.trim() ||
                            peranKurikulumList.includes(
                              peranKurikulumInput.trim()
                            )
                          }
                        >
                          Tambah
                        </button>
                      </div>
                    </div>
                  )}
                  {form.semester !== "Antara" && (
                    <div className="mb-3 sm:mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Keahlian Dibutuhkan
                      </label>
                      <Listbox
                        value={
                          Array.isArray(form.keahlian_required)
                            ? form.keahlian_required
                            : []
                        }
                        onChange={(val) =>
                          setForm((f) => ({ ...f, keahlian_required: val }))
                        }
                        multiple
                      >
                        {({ open }) => (
                          <div className="relative">
                            <Listbox.Button className="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm">
                              <span className="block truncate">
                                {Array.isArray(form.keahlian_required) &&
                                form.keahlian_required.length > 0
                                  ? form.keahlian_required.join(", ")
                                  : "Pilih Keahlian"}
                              </span>
                              <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                <FontAwesomeIcon
                                  icon={faChevronDown}
                                  className="h-5 w-5 text-gray-400"
                                  aria-hidden="true"
                                />
                              </span>
                            </Listbox.Button>
                            <Transition
                              show={open}
                              as={"div"}
                              leave="transition ease-in duration-100"
                              leaveFrom="opacity-100"
                              leaveTo="opacity-0"
                              className="absolute z-50 mt-1 w-full overflow-auto rounded-md bg-white dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm max-h-60 hide-scroll"
                            >
                              <Listbox.Options static>
                                {keahlianList.length === 0 ? (
                                  <Listbox.Option
                                    className="relative cursor-default select-none py-2.5 pl-4 pr-4 text-gray-400 dark:text-gray-500"
                                    value=""
                                    disabled
                                  >
                                    Belum ada keahlian
                                  </Listbox.Option>
                                ) : (
                                  keahlianList.map((keahlian) => (
                                    <Listbox.Option
                                      key={keahlian}
                                      className={({ active }) =>
                                        `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                                          active
                                            ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                                            : "text-gray-900 dark:text-gray-100"
                                        }`
                                      }
                                      value={keahlian}
                                    >
                                      {({ selected }) => (
                                        <div className="flex items-center justify-between">
                                          <span
                                            className={`block truncate ${
                                              selected
                                                ? "font-medium"
                                                : "font-normal"
                                            }`}
                                          >
                                            {keahlian}
                                          </span>
                                          {selected && (
                                            <span className="text-brand-500">
                                              <svg
                                                className="w-5 h-5"
                                                fill="none"
                                                stroke="currentColor"
                                                viewBox="0 0 24 24"
                                              >
                                                <path
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                  strokeWidth={2}
                                                  d="M5 13l4 4L19 7"
                                                />
                                              </svg>
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </Listbox.Option>
                                  ))
                                )}
                              </Listbox.Options>
                            </Transition>
                          </div>
                        )}
                      </Listbox>
                      <div className="flex gap-2 mt-3">
                        <input
                          type="text"
                          value={keahlianInput}
                          onChange={(e) => setKeahlianInput(e.target.value)}
                          placeholder="Tambah keahlian baru"
                          className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            if (
                              keahlianInput.trim() &&
                              !keahlianList.includes(keahlianInput.trim())
                            ) {
                              setKeahlianList((prev) =>
                                [...prev, keahlianInput.trim()].sort()
                              );
                              setForm((prev) => ({
                                ...prev,
                                keahlian_required: Array.isArray(
                                  prev.keahlian_required
                                )
                                  ? [
                                      ...prev.keahlian_required,
                                      keahlianInput.trim(),
                                    ]
                                  : typeof prev.keahlian_required ===
                                      "string" &&
                                    String(
                                      prev.keahlian_required || ""
                                    ).trim() !== ""
                                  ? [
                                      ...String(prev.keahlian_required || "")
                                        .split(",")
                                        .map((k: any) => String(k).trim())
                                        .filter((k: string) => k !== ""),
                                      keahlianInput.trim(),
                                    ]
                                  : [keahlianInput.trim()],
                              }));
                              setKeahlianInput("");
                            }
                          }}
                          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition flex items-center justify-center"
                          disabled={
                            !keahlianInput.trim() ||
                            keahlianList.includes(keahlianInput.trim())
                          }
                        >
                          Tambah
                        </button>
                      </div>
                    </div>
                  )}
                  <div className="mb-3 sm:mb-4">
                    <label
                      htmlFor="tanggalMulai"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Tanggal Mulai
                    </label>
                    <input
                      type="date"
                      id="tanggalMulai"
                      name="tanggalMulai"
                      value={form.tanggalMulai || ""}
                      onChange={(e) => {
                        const newTanggalMulai = e.target.value;
                        let newTanggalAkhir = form.tanggalAkhir;

                        // Kita tidak lagi mereset tanggal akhir secara otomatis
                        // agar pengguna bisa melihat errornya
                        const updatedForm = {
                          ...form,
                          tanggalMulai: newTanggalMulai,
                          tanggalAkhir: newTanggalAkhir,
                        };

                        setForm({
                          ...updatedForm,
                          durasiMinggu: calculateWeeks(
                            updatedForm.tanggalMulai,
                            updatedForm.tanggalAkhir
                          ),
                        });
                      }}
                      className={`w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-brand-500`}
                    />
                    {/* ALERT: Tanggal Blok tidak boleh bentrok, tampilkan di bawah tanggal mulai */}
                    {form.jenis === "Blok" &&
                      form.tanggalMulai &&
                      form.tanggalAkhir &&
                      !editMode &&
                      data.some(
                        (mk) =>
                          mk.semester === form.semester &&
                          mk.jenis === "Blok" &&
                          isDateOverlap(
                            form.tanggalMulai || "",
                            form.tanggalAkhir || "",
                            mk.tanggalMulai || mk.tanggal_mulai || "",
                            mk.tanggalAkhir || mk.tanggal_akhir || ""
                          )
                      ) && (
                        <div className="text-sm text-red-500 bg-red-100 rounded p-2 mt-4">
                          Tanggal Blok tidak boleh bentrok dengan Blok lain di
                          semester yang sama.
                        </div>
                      )}
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <label
                      htmlFor="tanggalAkhir"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Tanggal Akhir
                    </label>
                    <input
                      type="date"
                      id="tanggalAkhir"
                      name="tanggalAkhir"
                      value={form.tanggalAkhir || ""}
                      onChange={(e) => {
                        const newTanggalAkhir = e.target.value;
                        const updatedForm = {
                          ...form,
                          tanggalAkhir: newTanggalAkhir,
                        };
                        setForm({
                          ...updatedForm,
                          durasiMinggu: calculateWeeks(
                            updatedForm.tanggalMulai,
                            updatedForm.tanggalAkhir
                          ),
                        });
                      }}
                      min={form.tanggalMulai || undefined}
                      className={`w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-brand-500`}
                    />
                    {/* ALERT: Tanggal akhir harus setelah tanggal mulai */}
                    {form.tanggalMulai &&
                      form.tanggalAkhir &&
                      new Date(form.tanggalAkhir) <
                        new Date(form.tanggalMulai) && (
                        <div className="text-sm text-red-500 bg-red-100 rounded p-2 mt-4">
                          Tanggal Akhir harus setelah Tanggal Mulai.
                        </div>
                      )}
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <label
                      htmlFor="durasiMinggu"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Durasi Minggu
                    </label>
                    <input
                      type="text"
                      id="durasiMinggu"
                      name="durasiMinggu"
                      value={
                        form.durasiMinggu !== null
                          ? `${form.durasiMinggu} Minggu`
                          : ""
                      }
                      readOnly
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-sm sm:text-base cursor-not-allowed"
                    />
                  </div>

                  {/* Upload RPS */}
                  <div className="mb-3 sm:mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Upload RPS
                    </label>
                    <div className="relative">
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xlsx,.xls"
                        onChange={(e) => {
                          const file = e.target.files && e.target.files[0];
                          if (file) {
                            if (file.size <= 10 * 1024 * 1024) {
                              setRpsFile(file);
                              setExistingRpsFile(null);
                            } else {
                              setError(
                                "Ukuran file terlalu besar. Maksimal 10MB."
                              );
                              setRpsFile(null);
                            }
                          } else {
                            setRpsFile(null);
                          }
                        }}
                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                        ref={rpsFileInputRef}
                      />
                      <div className="relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ease-in-out transform border-gray-300 dark:border-gray-600 hover:border-brand-500 dark:hover:border-brand-400 hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-800">
                        <div className="flex flex-col items-center space-y-2">
                          {rpsFile && rpsFile instanceof File ? (
                            <div className="w-full max-w-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="flex-shrink-0">
                                    <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                                      <svg
                                        className="w-5 h-5 text-green-600 dark:text-green-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className="text-sm font-medium text-green-800 dark:text-green-200 truncate"
                                      title={rpsFile.name}
                                    >
                                      {(() => {
                                        const name = rpsFile.name;
                                        if (name.length <= 30) return name;
                                        const dotIdx = name.lastIndexOf(".");
                                        if (dotIdx === -1)
                                          return name.slice(0, 27) + "...";
                                        const ext = name.slice(dotIdx);
                                        const base = name.slice(
                                          0,
                                          27 - ext.length
                                        );
                                        return base + "..." + ext;
                                      })()}
                                    </p>
                                    <p className="text-xs text-green-600 dark:text-green-400 text-left w-full">
                                      {(rpsFile.size / 1024 / 1024).toFixed(2)}{" "}
                                      MB
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setRpsFile(null);
                                  }}
                                  className="flex-shrink-0 p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200 relative z-30 border border-red-200 dark:border-red-700 hover:border-red-300 dark:hover:border-red-600"
                                  title="Hapus file RPS"
                                >
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ) : existingRpsFile ? (
                            <div className="w-full max-w-sm bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center space-x-3">
                                  <div className="flex-shrink-0">
                                    <div className="w-10 h-10 bg-blue-100 dark:bg-blue-800 rounded-full flex items-center justify-center">
                                      <svg
                                        className="w-5 h-5 text-blue-600 dark:text-blue-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p
                                      className="text-sm font-medium text-blue-800 dark:text-blue-200 truncate"
                                      title={existingRpsFile}
                                    >
                                      {(() => {
                                        const name = existingRpsFile;
                                        if (name.length <= 30) return name;
                                        const dotIdx = name.lastIndexOf(".");
                                        if (dotIdx === -1)
                                          return name.slice(0, 27) + "...";
                                        const ext = name.slice(dotIdx);
                                        const base = name.slice(
                                          0,
                                          27 - ext.length
                                        );
                                        return base + "..." + ext;
                                      })()}
                                    </p>
                                    <p className="text-xs text-blue-600 dark:text-blue-400 text-left w-full">
                                      File RPS yang sudah ada
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    setExistingRpsFile(null);
                                  }}
                                  className="flex-shrink-0 p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200 relative z-30 border border-red-200 dark:border-red-700 hover:border-red-300 dark:hover:border-red-600"
                                  title="Hapus file RPS"
                                >
                                  <svg
                                    className="w-5 h-5"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                    />
                                  </svg>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="flex-shrink-0">
                                <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                  <svg
                                    className="w-6 h-6 text-gray-400 dark:text-gray-500"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                    />
                                  </svg>
                                </div>
                              </div>
                              <div className="text-center">
                                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                  Upload file RPS
                                </p>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  PDF, Word, atau Excel (maks. 10MB)
                                </p>
                              </div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end gap-2 pt-2 relative z-20">
                    <button
                      onClick={handleCloseModal}
                      className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                    >
                      Batal
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleSaveData();
                      }}
                      disabled={
                        !form.kode.trim() || !form.nama.trim() || isSaving
                      }
                      className="px-3 sm:px-4 py-2 rounded-lg bg-brand-500 text-white text-xs sm:text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                      title={`Kode: ${form.kode.trim() ? "✓" : "✗"}, Nama: ${
                        form.nama.trim() ? "✓" : "✗"
                      }`}
                    >
                      {isSaving ? (
                        <>
                          <svg
                            className="w-5 h-5 mr-2 animate-spin text-white inline-block align-middle"
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
                        "Simpan"
                      )}
                    </button>
                  </div>
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
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => {
                setShowDeleteModal(false);
                setSelectedDeleteKode(null);
              }}
            ></motion.div>
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
                onClick={() => {
                  setShowDeleteModal(false);
                  setSelectedDeleteKode(null);
                }}
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
                    Hapus Data
                  </h2>
                </div>
                <div>
                  <p className="mb-6 text-gray-500 dark:text-gray-400">
                    Apakah Anda yakin ingin menghapus data mata kuliah{" "}
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {mataKuliahToDelete?.nama}
                    </span>
                    ? Data yang dihapus tidak dapat dikembalikan.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setShowDeleteModal(false);
                        setSelectedDeleteKode(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={confirmDelete}
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
                        "Hapus"
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Di atas tabel, setelah search dan filter: */}
      <div className="flex flex-wrap gap-2 mt-8">
        <button
          disabled={selectedRows.length === 0 || loading}
          onClick={handleBulkDelete}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${
            selectedRows.length === 0 || loading
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-red-500 text-white shadow-theme-xs hover:bg-red-600"
          }`}
        >
          {loading ? "Menghapus..." : `Hapus Terpilih (${selectedRows.length})`}
        </button>
      </div>

      {/* Modal Bulk Delete */}
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
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  Konfirmasi Hapus Data
                </h2>
              </div>
              <div>
                <p className="mb-6 text-gray-500 dark:text-gray-400">
                  Apakah Anda yakin ingin menghapus{" "}
                  <span className="font-semibold text-gray-800 dark:text-white">
                    {selectedRows.length}
                  </span>{" "}
                  data mata kuliah terpilih? Data yang dihapus tidak dapat
                  dikembalikan.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setShowDeleteModalBulk(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmBulkDelete}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center"
                    disabled={loading}
                  >
                    {loading ? "Menghapus..." : "Hapus"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Upload Materi */}
      <AnimatePresence>
        {showUploadMateriModal && selectedMataKuliah && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowUploadMateriModal(false)}
            ></motion.div>

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                    Upload Materi Pembelajaran
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {selectedMataKuliah.nama} ({selectedMataKuliah.kode})
                  </p>
                </div>
                <button
                  onClick={() => setShowUploadMateriModal(false)}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="py-6">
                {/* Upload Area */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                      Upload Materi Baru
                    </label>
                    {/* Tombol Tambah File hanya muncul setelah ada file */}
                    {materiFiles.length > 0 && (
                      <button
                        onClick={() => {
                          const newFileInput = document.createElement("input");
                          newFileInput.type = "file";
                          newFileInput.accept =
                            ".pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx";
                          newFileInput.style.display = "none";
                          newFileInput.onchange = (e) => {
                            const target = e.target as HTMLInputElement;
                            if (target.files && target.files[0]) {
                              const file = target.files[0];
                              if (file.size <= 25 * 1024 * 1024) {
                                handleFilesSelected([file]);
                              } else {
                                setUploadMateriError(
                                  `File ${file.name} terlalu besar. Maksimal 25MB.`
                                );
                              }
                            }
                          };
                          document.body.appendChild(newFileInput);
                          newFileInput.click();
                          document.body.removeChild(newFileInput);
                        }}
                        className="px-3 py-1.5 text-xs bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors flex items-center gap-1"
                      >
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                          />
                        </svg>
                        Tambah File
                      </button>
                    )}
                  </div>

                  {/* File Input Utama */}
                  <div className="relative mb-4">
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx,.xlsx,.xls,.ppt,.pptx"
                      onChange={(e) => {
                        const files = e.target.files;
                        if (files) {
                          const validFiles = Array.from(files).filter(
                            (file) => {
                              if (file.size <= 25 * 1024 * 1024) {
                                return true;
                              } else {
                                setUploadMateriError(
                                  `File ${file.name} terlalu besar. Maksimal 25MB.`
                                );
                                return false;
                              }
                            }
                          );
                          handleFilesSelected(validFiles);
                        }
                      }}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                      ref={materiFileInputRef}
                    />
                    <div className="relative border-2 border-dashed rounded-lg p-8 text-center transition-all duration-300 ease-in-out transform border-gray-300 dark:border-gray-600 hover:border-brand-500 dark:hover:border-brand-400 hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-800">
                      <div className="flex flex-col items-center space-y-4">
                        {materiFiles.length > 0 ? (
                          <div className="w-full space-y-3">
                            {materiFiles.map((file, idx) => {
                              const materiItem = materiItems.find(
                                (item) => item.filename === file.name
                              );
                              return (
                                <div
                                  key={idx}
                                  className={`w-full border rounded-lg p-4 ${(() => {
                                    // Cek apakah file ini duplikat
                                    const newFilenames = materiItems.map(
                                      (item) => item.filename
                                    );
                                    const duplicateFilenames =
                                      newFilenames.filter(
                                        (filename, index) =>
                                          newFilenames.indexOf(filename) !==
                                          index
                                      );

                                    const existingFilenames =
                                      existingMateriItems
                                        .filter(
                                          (item) =>
                                            !materiToDelete.includes(item.id)
                                        )
                                        .map((item) => item.filename);
                                    const crossDuplicateFilenames =
                                      newFilenames.filter((filename) =>
                                        existingFilenames.includes(filename)
                                      );

                                    const isDuplicate =
                                      duplicateFilenames.includes(file.name) ||
                                      crossDuplicateFilenames.includes(
                                        file.name
                                      );

                                    if (isDuplicate) {
                                      return "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800";
                                    } else {
                                      return "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800";
                                    }
                                  })()}`}
                                >
                                  <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center space-x-3">
                                      <div className="flex-shrink-0">
                                        <div
                                          className={`w-10 h-10 rounded-full flex items-center justify-center ${(() => {
                                            // Cek apakah file ini duplikat
                                            const newFilenames =
                                              materiItems.map(
                                                (item) => item.filename
                                              );
                                            const duplicateFilenames =
                                              newFilenames.filter(
                                                (filename, index) =>
                                                  newFilenames.indexOf(
                                                    filename
                                                  ) !== index
                                              );

                                            const existingFilenames =
                                              existingMateriItems
                                                .filter(
                                                  (item) =>
                                                    !materiToDelete.includes(
                                                      item.id
                                                    )
                                                )
                                                .map((item) => item.filename);
                                            const crossDuplicateFilenames =
                                              newFilenames.filter((filename) =>
                                                existingFilenames.includes(
                                                  filename
                                                )
                                              );

                                            const isDuplicate =
                                              duplicateFilenames.includes(
                                                file.name
                                              ) ||
                                              crossDuplicateFilenames.includes(
                                                file.name
                                              );

                                            if (isDuplicate) {
                                              return "bg-red-100 dark:bg-red-800";
                                            } else {
                                              return "bg-green-100 dark:bg-green-800";
                                            }
                                          })()}`}
                                        >
                                          <svg
                                            className={`w-5 h-5 ${(() => {
                                              // Cek apakah file ini duplikat
                                              const newFilenames =
                                                materiItems.map(
                                                  (item) => item.filename
                                                );
                                              const duplicateFilenames =
                                                newFilenames.filter(
                                                  (filename, index) =>
                                                    newFilenames.indexOf(
                                                      filename
                                                    ) !== index
                                                );

                                              const existingFilenames =
                                                existingMateriItems
                                                  .filter(
                                                    (item) =>
                                                      !materiToDelete.includes(
                                                        item.id
                                                      )
                                                  )
                                                  .map((item) => item.filename);
                                              const crossDuplicateFilenames =
                                                newFilenames.filter(
                                                  (filename) =>
                                                    existingFilenames.includes(
                                                      filename
                                                    )
                                                );

                                              const isDuplicate =
                                                duplicateFilenames.includes(
                                                  file.name
                                                ) ||
                                                crossDuplicateFilenames.includes(
                                                  file.name
                                                );

                                              if (isDuplicate) {
                                                return "text-red-600 dark:text-red-400";
                                              } else {
                                                return "text-green-600 dark:text-green-400";
                                              }
                                            })()}`}
                                            fill="none"
                                            stroke="currentColor"
                                            viewBox="0 0 24 24"
                                          >
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                            />
                                          </svg>
                                        </div>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                        <p
                                          className={`text-sm font-medium truncate ${(() => {
                                            // Cek apakah file ini duplikat
                                            const newFilenames =
                                              materiItems.map(
                                                (item) => item.filename
                                              );
                                            const duplicateFilenames =
                                              newFilenames.filter(
                                                (filename, index) =>
                                                  newFilenames.indexOf(
                                                    filename
                                                  ) !== index
                                              );

                                            const existingFilenames =
                                              existingMateriItems
                                                .filter(
                                                  (item) =>
                                                    !materiToDelete.includes(
                                                      item.id
                                                    )
                                                )
                                                .map((item) => item.filename);
                                            const crossDuplicateFilenames =
                                              newFilenames.filter((filename) =>
                                                existingFilenames.includes(
                                                  filename
                                                )
                                              );

                                            const isDuplicate =
                                              duplicateFilenames.includes(
                                                file.name
                                              ) ||
                                              crossDuplicateFilenames.includes(
                                                file.name
                                              );

                                            if (isDuplicate) {
                                              return "text-red-800 dark:text-red-200";
                                            } else {
                                              return "text-green-800 dark:text-green-200";
                                            }
                                          })()}`}
                                          title={file.name}
                                        >
                                          {file.name.length <= 30
                                            ? file.name
                                            : file.name.slice(0, 27) + "..."}
                                        </p>
                                        <p
                                          className={`text-xs text-left w-full ${(() => {
                                            // Cek apakah file ini duplikat
                                            const newFilenames =
                                              materiItems.map(
                                                (item) => item.filename
                                              );
                                            const duplicateFilenames =
                                              newFilenames.filter(
                                                (filename, index) =>
                                                  newFilenames.indexOf(
                                                    filename
                                                  ) !== index
                                              );

                                            const existingFilenames =
                                              existingMateriItems
                                                .filter(
                                                  (item) =>
                                                    !materiToDelete.includes(
                                                      item.id
                                                    )
                                                )
                                                .map((item) => item.filename);
                                            const crossDuplicateFilenames =
                                              newFilenames.filter((filename) =>
                                                existingFilenames.includes(
                                                  filename
                                                )
                                              );

                                            const isDuplicate =
                                              duplicateFilenames.includes(
                                                file.name
                                              ) ||
                                              crossDuplicateFilenames.includes(
                                                file.name
                                              );

                                            if (isDuplicate) {
                                              return "text-red-600 dark:text-red-400";
                                            } else {
                                              return "text-green-600 dark:text-green-400";
                                            }
                                          })()}`}
                                        >
                                          {(file.size / 1024 / 1024).toFixed(2)}{" "}
                                          MB
                                        </p>
                                        {(() => {
                                          // Cek apakah file ini duplikat
                                          const newFilenames = materiItems.map(
                                            (item) => item.filename
                                          );
                                          const duplicateFilenames =
                                            newFilenames.filter(
                                              (filename, index) =>
                                                newFilenames.indexOf(
                                                  filename
                                                ) !== index
                                            );

                                          const existingFilenames =
                                            existingMateriItems
                                              .filter(
                                                (item) =>
                                                  !materiToDelete.includes(
                                                    item.id
                                                  )
                                              )
                                              .map((item) => item.filename);
                                          const crossDuplicateFilenames =
                                            newFilenames.filter((filename) =>
                                              existingFilenames.includes(
                                                filename
                                              )
                                            );

                                          const isDuplicate =
                                            duplicateFilenames.includes(
                                              file.name
                                            ) ||
                                            crossDuplicateFilenames.includes(
                                              file.name
                                            );

                                          if (isDuplicate) {
                                            return (
                                              <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                                                ⚠️ File ini sama dengan file
                                                lain
                                              </p>
                                            );
                                          }
                                          return null;
                                        })()}
                                      </div>
                                    </div>
                                    <button
                                      onClick={(e) => {
                                        e.preventDefault();
                                        e.stopPropagation();
                                        setMateriFiles((prev) =>
                                          prev.filter((_, i) => i !== idx)
                                        );
                                        setMateriItems((prev) =>
                                          prev.filter(
                                            (item) =>
                                              item.filename !== file.name
                                          )
                                        );
                                      }}
                                      className="flex-shrink-0 p-2 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-all duration-200 relative z-30 border border-red-200 dark:border-red-700 hover:border-red-300 dark:hover:border-red-600"
                                      title="Hapus file ini"
                                    >
                                      <svg
                                        className="w-5 h-5"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                    </button>
                                  </div>

                                  {/* Input Judul untuk file ini */}
                                  <div className="mt-3 relative z-30">
                                    <label className="block text-xs font-medium text-green-700 dark:text-green-300 mb-1 text-left">
                                      Edit Judul:{" "}
                                      <span className="text-red-500 dark:text-red-400">
                                        *
                                      </span>
                                    </label>
                                    <input
                                      type="text"
                                      value={
                                        materiItem?.judul !== undefined
                                          ? materiItem.judul
                                          : file.name.length <= 30
                                          ? file.name
                                          : file.name.slice(0, 27) + "..."
                                      }
                                      onChange={(e) => {
                                        const itemIndex = materiItems.findIndex(
                                          (item) => item.filename === file.name
                                        );
                                        if (itemIndex !== -1) {
                                          handleMateriItemChange(
                                            itemIndex,
                                            "judul",
                                            e.target.value
                                          );
                                        }
                                      }}
                                      placeholder="Edit judul materi..."
                                      className={`w-full px-3 py-2 text-xs border rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:border-transparent relative z-30 pointer-events-auto text-left ${
                                        materiItem?.judul === ""
                                          ? "border-red-300 dark:border-red-600 focus:ring-red-500"
                                          : (() => {
                                              // Cek apakah judul ini duplikat
                                              const allJuduls = [
                                                ...materiItems
                                                  .map((item) => item.judul)
                                                  .filter(
                                                    (judul) => judul !== ""
                                                  ),
                                                ...existingMateriItems
                                                  .filter(
                                                    (item) =>
                                                      !materiToDelete.includes(
                                                        item.id
                                                      )
                                                  )
                                                  .map((item) => item.judul)
                                                  .filter(
                                                    (judul) => judul !== ""
                                                  ),
                                              ];
                                              const isDuplicate =
                                                allJuduls.filter(
                                                  (judul) =>
                                                    judul === materiItem?.judul
                                                ).length > 1;
                                              return isDuplicate
                                                ? "border-orange-300 dark:border-orange-600 focus:ring-orange-500"
                                                : "border-green-200 dark:border-green-700 focus:ring-green-500";
                                            })()
                                      }`}
                                    />
                                    {materiItem?.judul === "" && (
                                      <p className="text-xs text-red-600 dark:text-red-400 mt-1 text-left">
                                        ⚠️ Judul tidak boleh kosong
                                      </p>
                                    )}
                                    {materiItem?.judul !== "" &&
                                      (() => {
                                        // Cek apakah judul ini duplikat
                                        const allJuduls = [
                                          ...materiItems
                                            .map((item) => item.judul)
                                            .filter((judul) => judul !== ""),
                                          ...existingMateriItems
                                            .filter(
                                              (item) =>
                                                !materiToDelete.includes(
                                                  item.id
                                                )
                                            )
                                            .map((item) => item.judul)
                                            .filter((judul) => judul !== ""),
                                        ];
                                        const isDuplicate =
                                          allJuduls.filter(
                                            (judul) =>
                                              judul === materiItem?.judul
                                          ).length > 1;
                                        return isDuplicate ? (
                                          <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 text-left">
                                            ⚠️ Judul ini sama dengan materi lain
                                          </p>
                                        ) : null;
                                      })()}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <>
                            <div className="flex-shrink-0">
                              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                                <svg
                                  className="w-8 h-8 text-gray-400 dark:text-gray-500"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                                  />
                                </svg>
                              </div>
                            </div>
                            <div className="text-center">
                              <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                                Upload file materi
                              </p>
                              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                                PDF, Word, Excel, PowerPoint (maks. 25MB per
                                file)
                              </p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                                Drag & drop file atau klik untuk memilih
                              </p>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Existing Materi */}
                {existingMateriItems.length > 0 && (
                  <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                      Materi yang Sudah Ada
                    </label>
                    <div className="space-y-3">
                      {existingMateriItems.map((item, idx) => (
                        <div
                          key={idx}
                          className={`w-full border rounded-lg p-4 ${
                            materiToDelete.includes(item.id)
                              ? "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800"
                              : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800"
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center space-x-3">
                              <div className="flex-shrink-0">
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center ${
                                    materiToDelete.includes(item.id)
                                      ? "bg-red-100 dark:bg-red-800"
                                      : "bg-blue-100 dark:bg-blue-800"
                                  }`}
                                >
                                  <svg
                                    className={`w-5 h-5 ${
                                      materiToDelete.includes(item.id)
                                        ? "text-red-600 dark:text-red-400"
                                        : "text-blue-600 dark:text-blue-400"
                                    }`}
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                    />
                                  </svg>
                                </div>
                              </div>
                              <div className="flex-1 min-w-0">
                                <p
                                  className={`text-sm font-medium truncate ${
                                    materiToDelete.includes(item.id)
                                      ? "text-red-800 dark:text-red-200"
                                      : "text-blue-800 dark:text-blue-200"
                                  }`}
                                  title={item.judul}
                                >
                                  {item.judul.length <= 30
                                    ? item.judul
                                    : item.judul.slice(0, 27) + "..."}
                                </p>
                                <p
                                  className={`text-xs text-left w-full ${
                                    materiToDelete.includes(item.id)
                                      ? "text-red-600 dark:text-red-400"
                                      : "text-blue-600 dark:text-blue-400"
                                  }`}
                                  title={item.filename}
                                >
                                  {item.filename.length <= 30
                                    ? item.filename
                                    : item.filename.slice(0, 27) + "..."}{" "}
                                  • {(item.file_size / 1024 / 1024).toFixed(2)}{" "}
                                  MB
                                </p>
                                {materiToDelete.includes(item.id) && (
                                  <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">
                                    ⚠️ Akan dihapus saat disimpan
                                  </p>
                                )}
                              </div>
                            </div>
                            <button
                              onClick={async (e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (materiToDelete.includes(item.id)) {
                                  // Jika sudah ditandai untuk dihapus, kembalikan ke list
                                  setMateriToDelete((prev) =>
                                    prev.filter((id) => id !== item.id)
                                  );
                                  setUploadMateriSuccess(
                                    `Materi "${item.judul}" tidak akan dihapus`
                                  );
                                } else {
                                  // Tandai untuk dihapus
                                  setMateriToDelete((prev) => [
                                    ...prev,
                                    item.id,
                                  ]);
                                  setUploadMateriSuccess(
                                    `Materi "${item.judul}" ditandai untuk dihapus`
                                  );
                                }
                              }}
                              className={`flex-shrink-0 p-2 rounded-lg transition-all duration-200 relative z-30 border ${
                                materiToDelete.includes(item.id)
                                  ? "text-green-500 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30 border-green-200 dark:border-green-700 hover:border-green-300 dark:hover:border-green-600"
                                  : "text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-100 dark:hover:bg-red-900/30 border-red-200 dark:border-red-700 hover:border-red-300 dark:hover:border-red-600"
                              }`}
                              title={
                                materiToDelete.includes(item.id)
                                  ? "Batal hapus"
                                  : "Hapus materi ini"
                              }
                            >
                              {materiToDelete.includes(item.id) ? (
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M5 13l4 4L19 7"
                                  />
                                </svg>
                              ) : (
                                <svg
                                  className="w-5 h-5"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                  />
                                </svg>
                              )}
                            </button>
                          </div>

                          {/* Input Judul untuk existing materi */}
                          <div className="mt-3 relative z-30">
                            <label
                              className={`block text-xs font-medium mb-1 ${
                                materiToDelete.includes(item.id)
                                  ? "text-red-700 dark:text-red-300"
                                  : "text-blue-700 dark:text-blue-300"
                              }`}
                            >
                              {materiToDelete.includes(item.id)
                                ? "Judul (akan dihapus):"
                                : "Edit Judul:"}{" "}
                              <span className="text-red-500 dark:text-red-400">
                                *
                              </span>
                            </label>
                            <input
                              type="text"
                              value={item.judul}
                              onChange={(e) => {
                                setExistingMateriItems((prev) =>
                                  prev.map((m) =>
                                    m.id === item.id
                                      ? { ...m, judul: e.target.value }
                                      : m
                                  )
                                );
                              }}
                              placeholder="Edit judul materi..."
                              className={`w-full px-3 py-2 text-xs border rounded-md bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:border-transparent relative z-30 pointer-events-auto ${
                                materiToDelete.includes(item.id)
                                  ? "border-red-200 dark:border-red-700 text-red-800 dark:text-red-200 focus:ring-red-500"
                                  : item.judul === ""
                                  ? "border-red-300 dark:border-red-600 text-red-800 dark:text-red-200 focus:ring-red-500"
                                  : (() => {
                                      // Cek apakah judul ini duplikat
                                      const allJuduls = [
                                        ...materiItems
                                          .map((item) => item.judul)
                                          .filter((judul) => judul !== ""),
                                        ...existingMateriItems
                                          .filter(
                                            (item) =>
                                              !materiToDelete.includes(item.id)
                                          )
                                          .map((item) => item.judul)
                                          .filter((judul) => judul !== ""),
                                      ];
                                      const isDuplicate =
                                        allJuduls.filter(
                                          (judul) => judul === item.judul
                                        ).length > 1;
                                      return isDuplicate
                                        ? "border-orange-300 dark:border-orange-600 focus:ring-orange-500"
                                        : "border-blue-200 dark:border-blue-700 text-blue-800 dark:text-blue-200 focus:ring-blue-500";
                                    })()
                              }`}
                            />
                            {item.judul === "" &&
                              !materiToDelete.includes(item.id) && (
                                <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                                  ⚠️ Judul tidak boleh kosong
                                </p>
                              )}
                            {item.judul !== "" &&
                              !materiToDelete.includes(item.id) &&
                              (() => {
                                // Cek apakah judul ini duplikat
                                const allJuduls = [
                                  ...materiItems
                                    .map((item) => item.judul)
                                    .filter((judul) => judul !== ""),
                                  ...existingMateriItems
                                    .filter(
                                      (item) =>
                                        !materiToDelete.includes(item.id)
                                    )
                                    .map((item) => item.judul)
                                    .filter((judul) => judul !== ""),
                                ];
                                const isDuplicate =
                                  allJuduls.filter(
                                    (judul) => judul === item.judul
                                  ).length > 1;
                                return isDuplicate ? (
                                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1 text-left">
                                    ⚠️ Judul ini sama dengan materi lain
                                  </p>
                                ) : null;
                              })()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Warning Section */}
                {(materiItems.some((item) => item.judul === "") ||
                  existingMateriItems.some(
                    (item) =>
                      item.judul === "" && !materiToDelete.includes(item.id)
                  )) && (
                  <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg
                          className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                          Perhatian: Ada judul materi yang kosong
                        </h3>
                        <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                          Semua materi harus memiliki judul sebelum dapat
                          disimpan. Silakan isi judul untuk materi yang ditandai
                          dengan tanda bintang (*).
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Warning Section untuk Judul Duplikat */}
                {(() => {
                  // Cek duplikat judul di materi baru
                  const newMateriJuduls = materiItems
                    .map((item) => item.judul)
                    .filter((judul) => judul !== "");
                  const duplicateNewJuduls = newMateriJuduls.filter(
                    (judul, index) => newMateriJuduls.indexOf(judul) !== index
                  );

                  // Cek duplikat judul di existing materi (yang tidak ditandai hapus)
                  const existingJuduls = existingMateriItems
                    .filter((item) => !materiToDelete.includes(item.id))
                    .map((item) => item.judul)
                    .filter((judul) => judul !== "");
                  const duplicateExistingJuduls = existingJuduls.filter(
                    (judul, index) => existingJuduls.indexOf(judul) !== index
                  );

                  // Cek duplikat antara materi baru dan existing
                  const allJuduls = [...newMateriJuduls, ...existingJuduls];
                  const crossDuplicateJuduls = allJuduls.filter(
                    (judul, index) => allJuduls.indexOf(judul) !== index
                  );

                  const hasDuplicates =
                    duplicateNewJuduls.length > 0 ||
                    duplicateExistingJuduls.length > 0 ||
                    crossDuplicateJuduls.length > 0;

                  if (hasDuplicates) {
                    return (
                      <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <svg
                              className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                              />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-orange-800 dark:text-orange-200">
                              Perhatian: Ada judul materi yang sama/duplikat
                            </h3>
                            <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                              Setiap materi harus memiliki judul yang unik.
                              Silakan ubah judul yang duplikat sebelum dapat
                              disimpan.
                            </p>
                            {duplicateNewJuduls.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">
                                  Judul duplikat di materi baru:
                                </p>
                                <ul className="text-xs text-orange-600 dark:text-orange-400 list-disc list-inside space-y-1">
                                  {[...new Set(duplicateNewJuduls)].map(
                                    (judul, idx) => (
                                      <li key={idx}>"{judul}"</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                            {duplicateExistingJuduls.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">
                                  Judul duplikat di materi yang sudah ada:
                                </p>
                                <ul className="text-xs text-orange-600 dark:text-orange-400 list-disc list-inside space-y-1">
                                  {[...new Set(duplicateExistingJuduls)].map(
                                    (judul, idx) => (
                                      <li key={idx}>"{judul}"</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                            {crossDuplicateJuduls.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-orange-700 dark:text-orange-300 mb-1">
                                  Judul duplikat antara materi baru dan yang
                                  sudah ada:
                                </p>
                                <ul className="text-xs text-orange-600 dark:text-orange-400 list-disc list-inside space-y-1">
                                  {[...new Set(crossDuplicateJuduls)].map(
                                    (judul, idx) => (
                                      <li key={idx}>"{judul}"</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}

                {/* Warning Section untuk File Duplikat */}
                {(() => {
                  // Cek duplikat filename di materi baru
                  const newFilenames = materiItems.map((item) => item.filename);
                  const duplicateFilenames = newFilenames.filter(
                    (filename, index) =>
                      newFilenames.indexOf(filename) !== index
                  );

                  // Cek duplikat filename antara materi baru dan existing
                  const existingFilenames = existingMateriItems
                    .filter((item) => !materiToDelete.includes(item.id))
                    .map((item) => item.filename);
                  const crossDuplicateFilenames = newFilenames.filter(
                    (filename) => existingFilenames.includes(filename)
                  );

                  const hasDuplicateFiles =
                    duplicateFilenames.length > 0 ||
                    crossDuplicateFilenames.length > 0;

                  if (hasDuplicateFiles) {
                    return (
                      <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                        <div className="flex items-start space-x-3">
                          <div className="flex-shrink-0">
                            <svg
                              className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                              />
                            </svg>
                          </div>
                          <div className="flex-1">
                            <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                              Error: Ada file yang sama/duplikat
                            </h3>
                            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
                              File dengan nama yang sama tidak dapat diupload.
                              Silakan hapus file duplikat atau ubah nama file
                              sebelum dapat disimpan.
                            </p>
                            {duplicateFilenames.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                                  File duplikat di materi baru:
                                </p>
                                <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
                                  {[...new Set(duplicateFilenames)].map(
                                    (filename, idx) => (
                                      <li key={idx}>"{filename}"</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                            {crossDuplicateFilenames.length > 0 && (
                              <div className="mt-2">
                                <p className="text-xs font-medium text-red-700 dark:text-red-300 mb-1">
                                  File yang sama dengan materi yang sudah ada:
                                </p>
                                <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside space-y-1">
                                  {[...new Set(crossDuplicateFilenames)].map(
                                    (filename, idx) => (
                                      <li key={idx}>"{filename}"</li>
                                    )
                                  )}
                                </ul>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              {/* Error Display */}
              <AnimatePresence>
                {uploadMateriError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg
                          className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-red-800 dark:text-red-200">
                          Error
                        </h3>
                        <p className="text-sm text-red-600 dark:text-red-400 mt-1">
                          {uploadMateriError}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Success Display */}
              <AnimatePresence>
                {uploadMateriSuccess && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="mb-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800"
                  >
                    <div className="flex items-start space-x-3">
                      <div className="flex-shrink-0">
                        <svg
                          className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                      </div>
                      <div className="flex-1">
                        <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                          Berhasil
                        </h3>
                        <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                          {uploadMateriSuccess}
                        </p>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Footer */}
              <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowUploadMateriModal(false)}
                  className="px-6 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Tutup
                </button>
                <button
                  onClick={async () => {
                    try {
                      // Validasi judul tidak boleh kosong
                      const hasEmptyJudul =
                        materiItems.some((item) => item.judul === "") ||
                        existingMateriItems.some(
                          (item) =>
                            item.judul === "" &&
                            !materiToDelete.includes(item.id)
                        );

                      if (hasEmptyJudul) {
                        setUploadMateriError(
                          "Tidak dapat menyimpan: Ada judul materi yang kosong. Silakan isi semua judul terlebih dahulu."
                        );
                        return;
                      }

                      // Validasi judul tidak boleh duplikat
                      const newMateriJuduls = materiItems
                        .map((item) => item.judul)
                        .filter((judul) => judul !== "");
                      const duplicateNewJuduls = newMateriJuduls.filter(
                        (judul, index) =>
                          newMateriJuduls.indexOf(judul) !== index
                      );

                      const existingJuduls = existingMateriItems
                        .filter((item) => !materiToDelete.includes(item.id))
                        .map((item) => item.judul)
                        .filter((judul) => judul !== "");
                      const duplicateExistingJuduls = existingJuduls.filter(
                        (judul, index) =>
                          existingJuduls.indexOf(judul) !== index
                      );

                      const allJuduls = [...newMateriJuduls, ...existingJuduls];
                      const crossDuplicateJuduls = allJuduls.filter(
                        (judul, index) => allJuduls.indexOf(judul) !== index
                      );

                      const hasDuplicates =
                        duplicateNewJuduls.length > 0 ||
                        duplicateExistingJuduls.length > 0 ||
                        crossDuplicateJuduls.length > 0;

                      if (hasDuplicates) {
                        setUploadMateriError(
                          "Tidak dapat menyimpan: Ada judul materi yang sama/duplikat. Silakan ubah judul yang duplikat terlebih dahulu."
                        );
                        return;
                      }

                      // Validasi file tidak boleh duplikat
                      const newFilenames = materiItems.map(
                        (item) => item.filename
                      );
                      const duplicateFilenames = newFilenames.filter(
                        (filename, index) =>
                          newFilenames.indexOf(filename) !== index
                      );

                      const existingFilenames = existingMateriItems
                        .filter((item) => !materiToDelete.includes(item.id))
                        .map((item) => item.filename);
                      const crossDuplicateFilenames = newFilenames.filter(
                        (filename) => existingFilenames.includes(filename)
                      );

                      const hasDuplicateFiles =
                        duplicateFilenames.length > 0 ||
                        crossDuplicateFilenames.length > 0;

                      if (hasDuplicateFiles) {
                        setUploadMateriError(
                          "Tidak dapat menyimpan: Ada file yang sama/duplikat. Silakan hapus file duplikat atau ubah nama file sebelum dapat disimpan."
                        );
                        return;
                      }

                      // Hapus materi yang ditandai untuk dihapus
                      if (materiToDelete.length > 0) {
                        await Promise.all(
                          materiToDelete.map(async (materiId) => {
                            const materi = existingMateriItems.find(
                              (m) => m.id === materiId
                            );
                            if (materi) {
                              await api.delete(
                                `/mata-kuliah/${selectedMataKuliah.kode}/delete-materi`,
                                {
                                  data: { filename: materi.filename },
                                }
                              );
                            }
                          })
                        );
                        setUploadMateriSuccess(
                          `${materiToDelete.length} materi berhasil dihapus dari database!`
                        );
                        setMateriToDelete([]); // Reset list materi yang ditandai untuk dihapus
                      }

                      if (materiFiles.length > 0) {
                        const uploadPromises = materiItems.map(async (item) => {
                          const file = materiFiles.find(
                            (f) => f.name === item.filename
                          );
                          if (!file) return;

                          const materiFormData = new FormData();
                          materiFormData.append("materi_file", file);
                          materiFormData.append(
                            "kode",
                            selectedMataKuliah.kode
                          );
                          materiFormData.append("judul", item.judul);

                          const materiResponse = await api.post(
                            "/mata-kuliah/upload-materi",
                            materiFormData,
                            {
                              headers: {
                                "Content-Type": "multipart/form-data",
                              },
                            }
                          );
                          return materiResponse.data.data.filename;
                        });

                        await Promise.all(uploadPromises);
                        setUploadMateriSuccess(
                          "Materi baru berhasil diupload!"
                        );
                      }

                      if (existingMateriItems.length > 0) {
                        await Promise.all(
                          existingMateriItems.map(async (item) => {
                            await api.put(
                              `/mata-kuliah/${selectedMataKuliah.kode}/update-materi-judul`,
                              {
                                filename: item.filename,
                                judul: item.judul,
                              }
                            );
                          })
                        );
                        setUploadMateriSuccess(
                          "Judul materi berhasil diupdate!"
                        );
                      }

                      setShowUploadMateriModal(false);
                      fetchData();
                    } catch (error: any) {
                      setUploadMateriError(
                        error.response?.data?.error || "Gagal menyimpan materi"
                      );
                    }
                  }}
                  disabled={
                    (materiFiles.length === 0 &&
                      existingMateriItems.length === 0 &&
                      materiToDelete.length === 0) ||
                    materiItems.some((item) => item.judul === "") ||
                    existingMateriItems.some(
                      (item) =>
                        item.judul === "" && !materiToDelete.includes(item.id)
                    ) ||
                    (() => {
                      // Cek duplikat judul
                      const newMateriJuduls = materiItems
                        .map((item) => item.judul)
                        .filter((judul) => judul !== "");
                      const duplicateNewJuduls = newMateriJuduls.filter(
                        (judul, index) =>
                          newMateriJuduls.indexOf(judul) !== index
                      );

                      const existingJuduls = existingMateriItems
                        .filter((item) => !materiToDelete.includes(item.id))
                        .map((item) => item.judul)
                        .filter((judul) => judul !== "");
                      const duplicateExistingJuduls = existingJuduls.filter(
                        (judul, index) =>
                          existingJuduls.indexOf(judul) !== index
                      );

                      const allJuduls = [...newMateriJuduls, ...existingJuduls];
                      const crossDuplicateJuduls = allJuduls.filter(
                        (judul, index) => allJuduls.indexOf(judul) !== index
                      );

                      return (
                        duplicateNewJuduls.length > 0 ||
                        duplicateExistingJuduls.length > 0 ||
                        crossDuplicateJuduls.length > 0
                      );
                    })() ||
                    (() => {
                      // Cek duplikat filename
                      const newFilenames = materiItems.map(
                        (item) => item.filename
                      );
                      const duplicateFilenames = newFilenames.filter(
                        (filename, index) =>
                          newFilenames.indexOf(filename) !== index
                      );

                      const existingFilenames = existingMateriItems
                        .filter((item) => !materiToDelete.includes(item.id))
                        .map((item) => item.filename);
                      const crossDuplicateFilenames = newFilenames.filter(
                        (filename) => existingFilenames.includes(filename)
                      );

                      return (
                        duplicateFilenames.length > 0 ||
                        crossDuplicateFilenames.length > 0
                      );
                    })()
                  }
                  className={`px-6 py-2 rounded-lg text-sm font-medium transition ${
                    (materiFiles.length === 0 &&
                      existingMateriItems.length === 0 &&
                      materiToDelete.length === 0) ||
                    materiItems.some((item) => item.judul === "") ||
                    existingMateriItems.some(
                      (item) =>
                        item.judul === "" && !materiToDelete.includes(item.id)
                    ) ||
                    (() => {
                      // Cek duplikat judul
                      const newMateriJuduls = materiItems
                        .map((item) => item.judul)
                        .filter((judul) => judul !== "");
                      const duplicateNewJuduls = newMateriJuduls.filter(
                        (judul, index) =>
                          newMateriJuduls.indexOf(judul) !== index
                      );

                      const existingJuduls = existingMateriItems
                        .filter((item) => !materiToDelete.includes(item.id))
                        .map((item) => item.judul)
                        .filter((judul) => judul !== "");
                      const duplicateExistingJuduls = existingJuduls.filter(
                        (judul, index) =>
                          existingJuduls.indexOf(judul) !== index
                      );

                      const allJuduls = [...newMateriJuduls, ...existingJuduls];
                      const crossDuplicateJuduls = allJuduls.filter(
                        (judul, index) => allJuduls.indexOf(judul) !== index
                      );

                      return (
                        duplicateNewJuduls.length > 0 ||
                        duplicateExistingJuduls.length > 0 ||
                        crossDuplicateJuduls.length > 0
                      );
                    })() ||
                    (() => {
                      // Cek duplikat filename
                      const newFilenames = materiItems.map(
                        (item) => item.filename
                      );
                      const duplicateFilenames = newFilenames.filter(
                        (filename, index) =>
                          newFilenames.indexOf(filename) !== index
                      );

                      const existingFilenames = existingMateriItems
                        .filter((item) => !materiToDelete.includes(item.id))
                        .map((item) => item.filename);
                      const crossDuplicateFilenames = newFilenames.filter(
                        (filename) => existingFilenames.includes(filename)
                      );

                      return (
                        duplicateFilenames.length > 0 ||
                        crossDuplicateFilenames.length > 0
                      );
                    })()
                      ? "bg-gray-200 text-gray-400 cursor-not-allowed"
                      : "bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600"
                  }`}
                >
                  {(() => {
                    const hasEmptyJudul =
                      materiItems.some((item) => item.judul === "") ||
                      existingMateriItems.some(
                        (item) =>
                          item.judul === "" && !materiToDelete.includes(item.id)
                      );

                    // Cek duplikat judul
                    const newMateriJuduls = materiItems
                      .map((item) => item.judul)
                      .filter((judul) => judul !== "");
                    const duplicateNewJuduls = newMateriJuduls.filter(
                      (judul, index) => newMateriJuduls.indexOf(judul) !== index
                    );

                    const existingJuduls = existingMateriItems
                      .filter((item) => !materiToDelete.includes(item.id))
                      .map((item) => item.judul)
                      .filter((judul) => judul !== "");
                    const duplicateExistingJuduls = existingJuduls.filter(
                      (judul, index) => existingJuduls.indexOf(judul) !== index
                    );

                    const allJuduls = [...newMateriJuduls, ...existingJuduls];
                    const crossDuplicateJuduls = allJuduls.filter(
                      (judul, index) => allJuduls.indexOf(judul) !== index
                    );

                    const hasDuplicates =
                      duplicateNewJuduls.length > 0 ||
                      duplicateExistingJuduls.length > 0 ||
                      crossDuplicateJuduls.length > 0;

                    // Cek duplikat filename
                    const newFilenames = materiItems.map(
                      (item) => item.filename
                    );
                    const duplicateFilenames = newFilenames.filter(
                      (filename, index) =>
                        newFilenames.indexOf(filename) !== index
                    );

                    const existingFilenames = existingMateriItems
                      .filter((item) => !materiToDelete.includes(item.id))
                      .map((item) => item.filename);
                    const crossDuplicateFilenames = newFilenames.filter(
                      (filename) => existingFilenames.includes(filename)
                    );

                    const hasDuplicateFiles =
                      duplicateFilenames.length > 0 ||
                      crossDuplicateFilenames.length > 0;

                    if (hasEmptyJudul) {
                      return "Simpan Materi (Ada judul kosong)";
                    } else if (hasDuplicates) {
                      return "Simpan Materi (Ada judul duplikat)";
                    } else if (hasDuplicateFiles) {
                      return "Simpan Materi (Ada file duplikat)";
                    } else if (materiToDelete.length > 0) {
                      return `Simpan Materi (${materiToDelete.length} akan dihapus)`;
                    } else {
                      return "Simpan Materi";
                    }
                  })()}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Lihat Materi */}
      <AnimatePresence>
        {showViewMateriModal && selectedMateriMataKuliah && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => {
                setShowViewMateriModal(false);
                // Reset download state saat modal ditutup
                setDownloadProgress({});
                setIsZipDownloading(false);
              }}
            ></motion.div>

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto"
            >
              {/* Header */}
              <div className="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-gray-700">
                <div>
                  <h2 className="text-2xl font-bold text-gray-800 dark:text-white">
                    Materi Pembelajaran
                  </h2>
                  <p className="text-gray-600 dark:text-gray-400 mt-1">
                    {selectedMateriMataKuliah.nama} (
                    {selectedMateriMataKuliah.kode})
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowViewMateriModal(false);
                    // Reset download state saat modal ditutup
                    setDownloadProgress({});
                    setIsZipDownloading(false);
                  }}
                  className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {/* Content */}
              <div className="py-6">
                {selectedMateriMataKuliah.materi &&
                selectedMateriMataKuliah.materi.length > 0 ? (
                  <div className="space-y-4">
                    {/* Download All Button */}
                    <div className="flex justify-start gap-2">
                      <button
                        onClick={() =>
                          selectedMateriMataKuliah.materi &&
                          handleDownloadAllMateri(
                            selectedMateriMataKuliah.kode,
                            selectedMateriMataKuliah.materi
                          )
                        }
                        disabled={
                          loading ||
                          isZipDownloading ||
                          !selectedMateriMataKuliah.materi
                        }
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 dark:bg-blue-500 dark:hover:bg-blue-600 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {loading || isZipDownloading ? (
                          <>
                            <svg
                              className="w-4 h-4 animate-spin"
                              fill="none"
                              stroke="currentColor"
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
                            {isZipDownloading
                              ? "Mengunduh ZIP..."
                              : "Mengunduh..."}
                          </>
                        ) : (
                          <>
                            <svg
                              className="w-4 h-4"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            Download Semua Materi
                          </>
                        )}
                      </button>
                    </div>

                    {/* Materi List */}
                    <div className="space-y-3">
                      {selectedMateriMataKuliah.materi.map((materi, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          <div className="flex items-center space-x-3">
                            <div className="flex-shrink-0">
                              <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-lg flex items-center justify-center">
                                <svg
                                  className="w-5 h-5 text-green-600 dark:text-green-400"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate"
                                title={materi.judul || materi.filename}
                              >
                                {truncateFileName(
                                  materi.judul || materi.filename,
                                  35
                                )}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {truncateFileName(materi.filename, 25)} •{" "}
                                {(materi.file_size / 1024 / 1024).toFixed(2)} MB
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() =>
                              handleDownloadMateri(
                                selectedMateriMataKuliah.kode,
                                materi.id
                              )
                            }
                            disabled={downloadProgress[materi.id]}
                            className="inline-flex items-center gap-1 px-3 py-2 text-sm font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title={
                              downloadProgress[materi.id]
                                ? "Download sedang berlangsung..."
                                : "Download materi ini"
                            }
                          >
                            {downloadProgress[materi.id] ? (
                              <>
                                <svg
                                  className="w-4 h-4 animate-spin"
                                  fill="none"
                                  stroke="currentColor"
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
                                Downloading...
                              </>
                            ) : (
                              <>
                                <svg
                                  className="w-4 h-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                                  />
                                </svg>
                                Download
                              </>
                            )}
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <svg
                        className="w-8 h-8 text-gray-400 dark:text-gray-500"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-lg">
                      Belum ada materi
                    </p>
                    <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
                      Materi pembelajaran belum diupload untuk mata kuliah ini
                    </p>
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowViewMateriModal(false);
                    // Reset download state saat modal ditutup
                    setDownloadProgress({});
                    setIsZipDownloading(false);
                  }}
                  className="px-6 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}