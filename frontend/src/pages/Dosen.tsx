import { useState, ChangeEvent, useEffect, useRef } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faFileExcel,
  faPenToSquare,
  faTrash,
  faDownload,
  faChevronDown,
  faChevronUp,
  faBookOpen,
  faInfoCircle,
  faEye,
  faImage,
  faPlus,
  faMinus,
} from "@fortawesome/free-solid-svg-icons";
import { AnimatePresence, motion } from "framer-motion";
import api, { handleApiError } from "../utils/api";
import { EyeIcon, EyeCloseIcon } from "../icons";
import * as XLSX from "xlsx";
import { Listbox, Transition } from "@headlessui/react";
import React from "react";
import { useNavigate } from "react-router-dom";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

type UserDosen = {
  id?: number;
  nid: string;
  nidn: string;
  nuptk?: string;
  name: string;
  username: string;
  email: string;
  telp: string;
  password?: string;
  role?: string;
  kompetensi?: string[] | string;
  peran_kurikulum?: string[] | string;
  keahlian?: string[] | string;
  signature_image?: string | null;
  // Tambahan untuk fitur peran utama
  peran_utama?: "koordinator" | "tim_blok" | "dosen_mengajar" | "standby";
  matkul_ketua_nama?: string;
  matkul_ketua_semester?: number;
  matkul_anggota_nama?: string;
  matkul_anggota_semester?: number;
  peran_kurikulum_mengajar?: string;
  dosen_peran?: {
    mata_kuliah_kode: string;
    blok: number;
    semester: number;
    peran_kurikulum: string;
    tipe_peran: "koordinator" | "tim_blok" | "mengajar";
    mata_kuliah_nama?: string;
  }[];
};

// Tambahkan interface untuk assignment data
// PERBAIKAN: Update interface untuk mencerminkan struktur data dari backend
// yang include pbl.mataKuliah dan dosen
interface AssignmentData {
  [pblId: number]: {
    id?: number; // dosen.id (legacy, untuk backward compatibility)
    nid?: string; // dosen.nid (legacy)
    name?: string; // dosen.name (legacy)
    pbl_role?: string; // role (legacy, untuk backward compatibility)
    pbl_assignment_count?: number;
    // Struktur data dari backend (dengan eager loading)
    dosen?: {
      id: number;
      nid: string;
      name: string;
      keahlian?: string[];
      dosen_peran?: any[];
      peran_utama?: string;
      peran_kurikulum_mengajar?: string;
    };
    pbl?: {
      id: number;
      mata_kuliah_kode: string;
      modul_ke: string;
      nama_modul: string;
      mataKuliah?: {
        kode: string;
        nama: string;
        semester: number;
        blok: number;
        periode?: string;
      };
    };
    role?: string; // "dosen_mengajar" | "koordinator" | "tim_blok"
  }[];
}

// Interface untuk peran kurikulum yang detail
interface PeranKurikulumOption {
  name: string; // e.g., "Penguji Skill Lab"
  mataKuliahKode: string;
  blok: string;
  semester: string;
  tipePeran: string; // "koordinator" or "tim_blok"
  originalName: string; // nama asli dari database
}

// Interface untuk section-based peran
interface PeranSection {
  id: string; // unique id untuk section
  mataKuliahKode: string; // kode mata kuliah yang dipilih
  peranKurikulumKey: string; // key format: "mataKuliahKode-originalName-blok-semester"
}

export default function Dosen() {
  const [data, setData] = useState<UserDosen[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<UserDosen>({
    nid: "",
    nidn: "",
    nuptk: "",
    name: "",
    username: "",
    email: "",
    telp: "",
    password: "",
    kompetensi: [],
    peran_kurikulum: [],
    keahlian: [],
  });
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteNid, setSelectedDeleteNid] = useState<string | null>(
    null
  );
  const [editMode, setEditMode] = useState(false);
  const [showSignatureModal, setShowSignatureModal] = useState(false);
  const [selectedSignature, setSelectedSignature] = useState<string | null>(
    null
  );
  const [selectedDosenName, setSelectedDosenName] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [previewPage, setPreviewPage] = useState(1);
  const [previewPageSize, setPreviewPageSize] = useState(10);
  const previewTotalPages = Math.ceil(previewData.length / previewPageSize);
  const paginatedPreviewData = previewData.slice(
    (previewPage - 1) * previewPageSize,
    previewPage * previewPageSize
  );
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [showDeleteModalBulk, setShowDeleteModalBulk] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const [cellErrors, setCellErrors] = useState<
    { row: number; field: string; message: string; nid?: string }[]
  >([]);
  const [editingCell, setEditingCell] = useState<{
    row: number;
    key: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Hindari reset peran kurikulum saat inisialisasi edit mengubah mata kuliah secara programatik
  const skipNextPeranResetRef = useRef<boolean>(false);
  const [modalError, setModalError] = useState("");
  const [filterKompetensi, setFilterKompetensi] = useState<string[]>([]);
  const [availableKompetensi, setAvailableKompetensi] = useState<string[]>([]);
  const [newKompetensi, setNewKompetensi] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [availableKeahlian, setAvailableKeahlian] = useState<string[]>([]);
  const [newKeahlian, setNewKeahlian] = useState("");
  const [filterKeahlian, setFilterKeahlian] = useState<string[]>([]);
  // State untuk filter status dosen (all, standby, reguler)
  const [filterStatus, setFilterStatus] = useState<
    "all" | "standby" | "reguler"
  >("all");
  // Tambahkan state untuk daftar peran kurikulum global
  const [peranKurikulumOptions, setPeranKurikulumOptions] = useState<string[]>(
    []
  );
  // State untuk peran kurikulum yang difilter berdasarkan mata kuliah
  const [filteredPeranKurikulumOptions, setFilteredPeranKurikulumOptions] =
    useState<PeranKurikulumOption[]>([]);
  // Untuk fitur peran utama dosen
  const [peranUtama, setPeranUtama] = useState<string>("");
  const [matkulList, setMatkulList] = useState<
    {
      kode: string;
      nama: string;
      semester: number;
      blok?: number;
      jenis?: string;
      keahlian_required?: string[];
      peran_dalam_kurikulum?: string[];
    }[]
  >([]);
  // State untuk validasi keahlian
  const [keahlianValidationMessage, setKeahlianValidationMessage] =
    useState<string>("");
  // 1. State untuk peran selection
  const [selectedPeranType, setSelectedPeranType] = useState<string>("none"); // "none", "peran"
  const [selectedMataKuliah, setSelectedMataKuliah] = useState<string>("");
  // Section-based peran kurikulum (1 peran per section)
  const [peranSections, setPeranSections] = useState<PeranSection[]>([]);
  // State untuk menyimpan dosen_peran dari data yang sedang diedit (untuk fallback di dropdown)
  const [currentEditingDosenPeran, setCurrentEditingDosenPeran] = useState<
    any[]
  >([]);
  // Legacy state (untuk backward compatibility, akan dihapus nanti)
  const [selectedPeranKurikulumList, setSelectedPeranKurikulumList] = useState<
    string[]
  >([]);
  const [selectedMataKuliahList, setSelectedMataKuliahList] = useState<
    string[]
  >([]);
  // State untuk expand/collapse per grup peran dan show all peran
  const [expandedGroups, setExpandedGroups] = useState<{
    [key: string]: boolean;
  }>({});
  const [showAllPeran, setShowAllPeran] = useState<{ [key: string]: boolean }>(
    {}
  );
  const toggleGroup = (rowKey: string) => {
    setExpandedGroups((prev) => ({ ...prev, [rowKey]: !prev[rowKey] }));
  };

  const navigate = useNavigate();

  // Tambahkan state untuk assignment data
  const [assignmentData, setAssignmentData] = useState<AssignmentData>({});
  const [pblDataMap, setPblDataMap] = useState<
    Record<
      number,
      {
        mata_kuliah_kode: string;
        mataKuliah?: {
          kode: string;
          nama: string;
          semester: number;
          blok: number;
        };
      }
    >
  >({});
  const [pblData, setPblData] = useState<any>({});

  // Helper function untuk mendapatkan nama mata kuliah
  const getMataKuliahNama = (kode: string): string => {
    const matkul = matkulList.find((mk) => mk.kode === kode);
    return matkul ? matkul.nama : kode;
  };

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (modalError) {
      const timer = setTimeout(() => {
        setModalError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [modalError]);

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

  // Fungsi untuk download template Excel
  const downloadTemplate = async () => {
    // Data contoh untuk template dengan format gabungan NID/NIDN/NUPTK
    const templateData = [
      {
        "nid/nidn/nuptk": "1987654301/0123456701/7241754655230123",
        nama: "Nama Dosen Contoh",
        username: "username_dosen",
        email: "dosen.contoh@umj.ac.id",
        telepon: "081234567890",
        password: "password123",
        kompetensi: "Klinik, penelitian",
        keahlian: "Kardiologi, Pendidikan",
      },
      {
        "nid/nidn/nuptk": "-/-/-",
        nama: "Dosen Belum Ada Data",
        username: "dosen_belum_ada_data",
        email: "dosen.belum@umj.ac.id",
        telepon: "081234567891",
        password: "password123",
        kompetensi: "Klinik",
        keahlian: "Pendidikan",
      },
    ];

    // Buat worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Buat workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Dosen");

    // Generate file dan download
    XLSX.writeFile(wb, "Template_Import_Dosen.xlsx");
  };

  // Export data ke Excel dengan format yang bisa diimport kembali
  const exportToExcel = async () => {
    try {
      // Ambil semua data (tidak difilter) dengan format yang sesuai untuk import
      const dataToExport = data.map((d: UserDosen) => ({
        "nid/nidn/nuptk": `${d.nid || "-"}/${d.nidn || "-"}/${d.nuptk || "-"}`,
        nama: d.name,
        username: d.username,
        email: d.email,
        telepon: d.telp,
        password: "password123", // Default password untuk import
        kompetensi: Array.isArray(d.kompetensi)
          ? d.kompetensi.join(", ")
          : d.kompetensi || "",
        keahlian: Array.isArray(d.keahlian)
          ? d.keahlian.join(", ")
          : d.keahlian || "",
      }));

      // Buat workbook baru
      const wb = XLSX.utils.book_new();

      // Buat worksheet untuk data utama
      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // Set lebar kolom
      const colWidths = [
        { wch: 25 }, // nid/nidn/nuptk
        { wch: 30 }, // nama
        { wch: 20 }, // username
        { wch: 30 }, // email
        { wch: 15 }, // telepon
        { wch: 15 }, // password
        { wch: 25 }, // kompetensi
        { wch: 30 }, // keahlian
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
        ["RINGKASAN DATA DOSEN"],
        [""],
        ["Total Data", dataToExport.length],
        [
          "Data dengan Kompetensi",
          dataToExport.filter((d) => d.kompetensi && d.kompetensi.trim() !== "")
            .length,
        ],
        [
          "Data dengan Keahlian",
          dataToExport.filter((d) => d.keahlian && d.keahlian.trim() !== "")
            .length,
        ],
        [""],
        ["Tanggal Export", new Date().toLocaleString("id-ID")],
        ["Dibuat oleh", "Sistem ISME FKK"],
      ];

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs["!cols"] = [{ wch: 25 }, { wch: 30 }];

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
      XLSX.utils.book_append_sheet(wb, ws, "Data Dosen");
      XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

      // Generate filename dengan timestamp
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
      const filename = `Data_Dosen_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setForm({
      nid: "",
      nidn: "",
      nuptk: "",
      name: "",
      username: "",
      email: "",
      telp: "",
      password: "",
      kompetensi: [],
      peran_kurikulum: [],
      keahlian: [],
    });
    setEditMode(false);
    setModalError("");
    setNewKompetensi("");
    setSelectedPeranType("none");
    skipNextPeranResetRef.current = false; // Reset ref saat modal ditutup
    setSelectedMataKuliah("");
    setSelectedMataKuliahList([]);
    setSelectedPeranKurikulumList([]);
    setPeranSections([]); // Reset peran sections
    setCurrentEditingDosenPeran([]); // Reset current editing dosen peran
  };

  const userToDelete = data?.find(
    (u) => String(u.id) === String(selectedDeleteNid)
  );

  const isFormValid =
    form.nid &&
    form.nidn &&
    form.name &&
    form.username &&
    form.email &&
    form.telp &&
    (editMode || form.password) &&
    !keahlianValidationMessage; // Tambahkan validasi keahlian

  useEffect(() => {
    setLoading(true);
    api
      .get("/users?role=dosen&per_page=1000")
      .then((res) => {
        // Handle pagination response
        const usersData = Array.isArray(res.data) 
          ? res.data 
          : (res.data?.data || []);
        setData(usersData);
        setLoading(false);
      })
      .catch(() => {
        setError("Gagal memuat data");
        setLoading(false);
      });
  }, []);

  // PERBAIKAN: Pindahkan function ke level component agar bisa diakses
  const fetchSemesterAndMatkul = async () => {
    try {
      const [tahunRes, mkRes, pblRes] = await Promise.all([
        api.get("/tahun-ajaran"),
        api.get("/mata-kuliah"),
        api.get("/pbls/all"),
      ]);

      const tahunAktif = tahunRes.data.find((t: any) => t.aktif);
      let semesterAktif = null;
      if (tahunAktif && tahunAktif.semesters) {
        const semAktif = tahunAktif.semesters.find((s: any) => s.aktif);
        semesterAktif = semAktif ? semAktif.jenis : null;
      }

      // Set mata kuliah list
      const mkList = mkRes.data;
      setMatkulList(
        mkList.map((mk: any) => ({
          kode: mk.kode,
          nama: mk.nama,
          semester: mk.semester,
          blok: mk.blok,
          jenis: mk.jenis,
          keahlian_required: mk.keahlian_required || [],
          peran_dalam_kurikulum: mk.peran_dalam_kurikulum || [],
        }))
      );

      // PERBAIKAN: Transform data structure dari API /pbls/all
      // API mengembalikan: { "MKB101": { "mata_kuliah": {...}, "pbls": [...] } }
      // Kita butuh: { "MKB101": [...] }
      const transformedPblData: { [key: string]: any[] } = {};
      Object.entries(pblRes.data).forEach(([mkKode, item]: [string, any]) => {
        transformedPblData[mkKode] = item.pbls || [];
      });
      setPblData(transformedPblData);
    } catch (e) {
      setMatkulList([]);
      setPblData({});
    }
  };

  useEffect(() => {
    if (showModal) fetchSemesterAndMatkul();
  }, [showModal]);

  useEffect(() => {
    if (showModal) {
      // Hanya set peranUtama default untuk mode add (bukan edit)
      if (!editMode) {
        setPeranUtama("aktif");
      }
    } else {
      setPeranUtama("");
      setSelectedPeranType("none");
      setSelectedMataKuliah("");
      setSelectedPeranKurikulumList([]);
    }
  }, [showModal, editMode]);

  // Handle perubahan peranUtama untuk dosen standby
  useEffect(() => {
    if (peranUtama === "standby") {
      // Set keahlian menjadi "Standby" dan kompetensi kosong
      setForm((prev) => ({
        ...prev,
        keahlian: ["Standby"],
        kompetensi: [],
      }));
    } else if (peranUtama === "aktif") {
      // Hanya reset jika bukan edit mode atau jika kompetensi/keahlian masih kosong
      setForm((prev) => {
        if (
          !editMode ||
          (Array.isArray(prev.kompetensi) && prev.kompetensi.length === 0)
        ) {
          return {
            ...prev,
            keahlian: [],
            kompetensi: [],
          };
        }
        return prev;
      });
    }
  }, [peranUtama, editMode]);

  // Handle in-cell editing untuk preview data
  const handleCellEdit = (rowIndex: number, field: string, value: string) => {
    setPreviewData((prevData) =>
      prevData.map((row, idx) =>
        idx === rowIndex ? { ...row, [field]: value } : row
      )
    );
  };

  // Re-validate data setelah edit
  useEffect(() => {
    if (previewData.length > 0) {
      const validationResult = validateExcelData(previewData, data);
      setValidationErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors);
    }
  }, [previewData, data]);

  useEffect(() => {
    // Extract unique kompetensi dari data dosen, handle jika string JSON
    const kompetensiList = Array.from(
      new Set(
        data.flatMap((d) => {
          if (Array.isArray(d.kompetensi)) {
            return d.kompetensi
              .map((item) => String(item).trim())
              .filter((item) => item !== "");
          } else if (
            typeof d.kompetensi === "string" &&
            d.kompetensi.trim() !== ""
          ) {
            try {
              const parsed = JSON.parse(d.kompetensi);
              if (Array.isArray(parsed))
                return parsed
                  .map((item) => String(item).trim())
                  .filter((item) => item !== "");
            } catch {
              // Bukan JSON, split biasa
            }
            return d.kompetensi
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item !== "");
          }
          return [];
        })
      )
    ).sort();
    setAvailableKompetensi(kompetensiList);
  }, [data]);

  useEffect(() => {
    // Extract unique keahlian dari data dosen, handle jika string JSON
    // Filter out "standby" karena standby hanya dari status dosen, bukan dari field keahlian
    const keahlianList = Array.from(
      new Set(
        data.flatMap((d) => {
          if (Array.isArray(d.keahlian)) {
            return d.keahlian
              .map((item) => String(item).trim())
              .filter(
                (item) => item !== "" && !item.toLowerCase().includes("standby")
              );
          } else if (
            typeof d.keahlian === "string" &&
            d.keahlian.trim() !== ""
          ) {
            try {
              const parsed = JSON.parse(d.keahlian);
              if (Array.isArray(parsed))
                return parsed
                  .map((item) => String(item).trim())
                  .filter(
                    (item) =>
                      item !== "" && !item.toLowerCase().includes("standby")
                  );
            } catch {
              // Bukan JSON, split biasa
            }
            return d.keahlian
              .split(",")
              .map((item) => item.trim())
              .filter(
                (item) => item !== "" && !item.toLowerCase().includes("standby")
              );
          }
          return [];
        })
      )
    ).sort();
    setAvailableKeahlian(keahlianList);
  }, [data]);

  useEffect(() => {
    if (importedFile && previewData.length > 0) {
      // Meneruskan data yang sudah ada di DB (state 'data') untuk validasi duplikat
      const validationResult = validateExcelData(previewData, data);
      setValidationErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors); // Update cellErrors langsung dari validasi awal
    }
  }, [previewData, data]); // Tambahkan 'data' sebagai dependency

  // Filter & Search
  const filteredData = data.filter((d) => {
    const q = search.toLowerCase();
    // Gabungkan semua value dari objek menjadi satu string
    const allValues = Object.values(d).join(" ").toLowerCase();
    return allValues.includes(q);
  });

  // Helper function untuk menentukan apakah dosen adalah standby
  const isDosenStandby = (d: UserDosen): boolean => {
    // Cek dari peran_utama
    if (d.peran_utama === "standby") {
      return true;
    }

    // Cek dari keahlian yang mengandung "standby"
    const keahlianArray =
      typeof d.keahlian === "string"
        ? d.keahlian
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item !== "")
        : Array.isArray(d.keahlian)
        ? d.keahlian.map((item) => item.trim()).filter((item) => item !== "")
        : [];

    return keahlianArray.some((k) => k.toLowerCase().includes("standby"));
  };

  // Apply additional filters
  const filteredAndSearchedData = filteredData.filter((d) => {
    // Kompetensi
    const dosenKompetensiArray =
      typeof d.kompetensi === "string"
        ? d.kompetensi
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item !== "")
        : Array.isArray(d.kompetensi)
        ? d.kompetensi.map((item) => item.trim()).filter((item) => item !== "")
        : [];
    const matchKompetensi =
      filterKompetensi.length === 0 ||
      filterKompetensi.some((selectedComp) =>
        dosenKompetensiArray.includes(selectedComp)
      );
    // Keahlian
    const dosenKeahlianArray =
      typeof d.keahlian === "string"
        ? d.keahlian
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item !== "")
        : Array.isArray(d.keahlian)
        ? d.keahlian.map((item) => item.trim()).filter((item) => item !== "")
        : [];
    const matchKeahlian =
      filterKeahlian.length === 0 ||
      filterKeahlian.some((selectedK) =>
        dosenKeahlianArray.includes(selectedK)
      );
    // Status (Standby/Reguler)
    const matchStatus =
      filterStatus === "all" ||
      (filterStatus === "standby" && isDosenStandby(d)) ||
      (filterStatus === "reguler" && !isDosenStandby(d));

    return matchKompetensi && matchKeahlian && matchStatus;
  });

  // Generate unique kompetensi options for filter, sorted alphabetically
  const uniqueKompetensiOptions = Array.from(
    new Set(
      data.flatMap((d) =>
        typeof d.kompetensi === "string"
          ? d.kompetensi
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item !== "")
          : Array.isArray(d.kompetensi)
          ? d.kompetensi
              .map((item) => item.trim())
              .filter((item) => item !== "")
          : []
      )
    )
  ).sort();

  // Generate unique keahlian options for filter, sorted alphabetically
  // Filter out keahlian yang mengandung "standby" (case-insensitive)
  const uniqueKeahlianOptions = Array.from(
    new Set(
      data.flatMap((d) =>
        typeof d.keahlian === "string"
          ? d.keahlian
              .split(",")
              .map((item) => item.trim())
              .filter(
                (item) => item !== "" && !item.toLowerCase().includes("standby")
              )
          : Array.isArray(d.keahlian)
          ? d.keahlian
              .map((item) => item.trim())
              .filter(
                (item) => item !== "" && !item.toLowerCase().includes("standby")
              )
          : []
      )
    )
  ).sort();

  // Pagination
  const totalPages = Math.ceil(filteredAndSearchedData.length / pageSize);
  const paginatedData = filteredAndSearchedData.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (name === "telp") {
      // Hanya telepon yang harus angka saja
      setForm({ ...form, [name]: value.replace(/[^0-9]/g, "") });
    } else if (["nid", "nidn", "nuptk"].includes(name)) {
      // NID, NIDN, NUPTK bisa angka atau "-"
      setForm({ ...form, [name]: value.replace(/[^0-9-]/g, "") });
    } else if (name === "peran_kurikulum" || name === "kompetensi") {
      // Simpan nilai input sebagai string biasa (bukan array)
      setForm({ ...form, [name]: value });
    } else {
      setForm({ ...form, [name]: value });
    }
  };

  function handleNumberInput(e: React.KeyboardEvent<HTMLInputElement>) {
    if (
      [
        "Backspace",
        "Delete",
        "Tab",
        "Escape",
        "Enter",
        "ArrowLeft",
        "ArrowRight",
        "Home",
        "End",
      ].includes(e.key)
    )
      return;
    if (
      (e.ctrlKey || e.metaKey) &&
      ["a", "c", "v", "x"].includes(e.key.toLowerCase())
    )
      return;
    // Allow numbers and dash (-)
    if (!/^[0-9-]$/.test(e.key)) e.preventDefault();
  }

  // Perbaikan untuk handleAdd function
  const handleAdd = async () => {
    setIsSaving(true);
    setModalError("");
    try {
      // Validasi frontend peran (section-based)
      if (selectedPeranType !== "none" && peranSections.length === 0) {
        throw new Error(
          "Tambahkan minimal satu peran kurikulum jika memilih peran khusus."
        );
      }

      // Validasi setiap section harus memiliki mata kuliah dan peran kurikulum
      for (const section of peranSections) {
        if (!section.mataKuliahKode || !section.peranKurikulumKey) {
          throw new Error(
            "Setiap peran harus memiliki blok dan peran kurikulum yang dipilih."
          );
        }
      }

      // Validasi keahlian jika ada peran khusus
      if (
        selectedPeranType !== "none" &&
        peranSections.length > 0 &&
        form.keahlian
      ) {
        const keahlianArray = Array.isArray(form.keahlian)
          ? form.keahlian
          : typeof form.keahlian === "string"
          ? [form.keahlian]
          : [];

        // Validasi keahlian untuk setiap mata kuliah di sections
        for (const section of peranSections) {
          const isValidKeahlian = validateKeahlian(
            keahlianArray,
            section.mataKuliahKode
          );
          if (!isValidKeahlian) {
            const matkul = matkulList.find(
              (mk) => mk.kode === section.mataKuliahKode
            );
            throw new Error(
              `Keahlian dosen tidak sesuai dengan keahlian yang dibutuhkan di mata kuliah "${matkul?.nama}".`
            );
          }
        }
      }

      // Validasi: Koordinator maksimal 1 per blok + semester
      if (selectedPeranType !== "none" && peranSections.length > 0) {
        for (const section of peranSections) {
          // Parse peranKey untuk mendapatkan blok dan semester
          const parts = section.peranKurikulumKey.split("-");
          if (parts.length >= 4) {
            const [, , blok, semester] = parts;
            const selectedMatkul = matkulList.find(
              (mk) => mk.kode === section.mataKuliahKode
            );

            if (selectedMatkul) {
              // Cek apakah peran ini adalah koordinator
              const peranOption = filteredPeranKurikulumOptions.find(
                (opt) =>
                  `${opt.mataKuliahKode}-${opt.originalName}-${opt.blok}-${opt.semester}` ===
                  section.peranKurikulumKey
              );

              if (peranOption && peranOption.tipePeran === "koordinator") {
                // Cek apakah sudah ada koordinator lain di blok + semester yang sama
                const conflictDosen = data.find((dosen) => {
                  // Skip dosen yang sedang diedit
                  if (editMode && dosen.id === form.id) {
                    return false;
                  }

                  return dosen.dosen_peran?.some((peran: any) => {
                    const peranBlok =
                      typeof peran.blok === "string"
                        ? parseInt(peran.blok)
                        : peran.blok;
                    const peranSemester =
                      typeof peran.semester === "string"
                        ? parseInt(peran.semester)
                        : peran.semester;
                    const optionBlok = parseInt(blok);
                    const optionSemester = parseInt(semester);

                    return (
                      peran.tipe_peran === "koordinator" &&
                      peran.mata_kuliah_kode === section.mataKuliahKode &&
                      peranBlok === optionBlok &&
                      peranSemester === optionSemester
                    );
                  });
                });

                if (conflictDosen) {
                  throw new Error(
                    `Koordinator untuk Blok ${blok} Semester ${semester} sudah dipilih oleh ${conflictDosen.name}. Maksimal 1 koordinator per blok dan semester.`
                  );
                }
              }
            }
          }
        }
      }
      // Payload - konversi "-" menjadi null untuk field NID, NIDN, NUPTK
      let payload: any = {
        ...form,
        nid: form.nid === "-" || form.nid === "" ? null : form.nid,
        nidn: form.nidn === "-" || form.nidn === "" ? null : form.nidn,
        nuptk: form.nuptk === "-" || form.nuptk === "" ? null : form.nuptk,
        role: "dosen",
        peran_utama: peranUtama === "standby" ? "standby" : "dosen_mengajar",
      };
      // Hanya kirim dosen_peran jika peranUtama 'aktif' dan ada peran khusus
      if (
        peranUtama === "aktif" &&
        selectedPeranType !== "none" &&
        peranSections.length > 0
      ) {
        // Buat entri peran kurikulum dari sections
        payload.dosen_peran = peranSections
          .map((section) => {
            // Parse peranKey untuk mendapatkan data
            // Format: mataKuliahKode-originalName-blok-semester
            // Note: originalName mungkin mengandung '-', jadi kita perlu parsing yang lebih aman
            const parts = section.peranKurikulumKey.split("-");
            if (parts.length >= 4) {
              // Ambil 2 bagian terakhir untuk blok dan semester
              const semester = parts[parts.length - 1];
              const blok = parts[parts.length - 2];
              // Sisanya adalah mataKuliahKode dan originalName
              const mataKuliahKodeFromKey = parts[0];
              const originalName = parts.slice(1, -2).join("-"); // Gabungkan semua bagian di tengah

              // Cari tipe_peran dari filteredPeranKurikulumOptions atau dari sectionOptions
              const sectionOptions = getPeranKurikulumOptionsForSection(
                section.mataKuliahKode
              );
              const peranOption = sectionOptions.find(
                (opt) =>
                  `${opt.mataKuliahKode}-${opt.originalName}-${opt.blok}-${opt.semester}` ===
                  section.peranKurikulumKey
              );

              return {
                mata_kuliah_kode: section.mataKuliahKode,
                peran_kurikulum: originalName,
                blok: blok,
                semester: semester,
                tipe_peran: peranOption?.tipePeran || "tim_blok",
              };
            }
            return null;
          })
          .filter((item) => item !== null);
      } else {
        payload.dosen_peran = [];
      }
      delete payload.peran_kurikulum;
      if (editMode) {
        if (!payload.password) delete payload.password;
        await api.put(`/users/${form.id}`, payload);
        setSuccess("Data dosen berhasil diupdate.");
      } else {
        if (!payload.password) {
          setModalError("Password wajib diisi.");
          setIsSaving(false);
          return;
        }
        await api.post("/users", payload);
        setSuccess("Data dosen berhasil ditambahkan.");
      }
      // Refresh data dengan timestamp untuk memastikan data fresh dari database
      const res = await api.get("/users?role=dosen&per_page=1000", {
        params: { _ts: Date.now() },
      });
      // Handle pagination response
      const usersData = Array.isArray(res.data) 
        ? res.data 
        : (res.data?.data || []);
      setData(usersData);
      setShowModal(false);
      setEditMode(false);
      setForm({
        nid: "",
        nidn: "",
        name: "",
        username: "",
        email: "",
        telp: "",
        password: "",
        kompetensi: [],
        peran_kurikulum: [],
        keahlian: [],
      });
      setShowPassword(false);
      setNewKompetensi("");
      setNewKeahlian("");
      setPeranUtama("aktif");
      setSelectedPeranType("none");
      setSelectedMataKuliah("");
      setSelectedPeranKurikulumList([]);
      setPeranSections([]); // Reset peran sections
      setCurrentEditingDosenPeran([]); // Reset current editing dosen peran
      // Legacy note removed
    } catch (err: any) {
      setModalError(handleApiError(err, "Menyimpan data dosen"));
    } finally {
      setIsSaving(false);
    }
  };
  const handleEdit = (d: UserDosen) => {
    // Reset modalError saat membuka modal edit
    setModalError("");
    
    // Pastikan kompetensi dan keahlian selalu array
    let kompetensiArr: string[] = [];
    if (Array.isArray(d.kompetensi)) {
      kompetensiArr = d.kompetensi;
    } else if (typeof d.kompetensi === "string" && d.kompetensi.trim() !== "") {
      try {
        const parsed = JSON.parse(d.kompetensi);
        if (Array.isArray(parsed)) kompetensiArr = parsed;
        else
          kompetensiArr = d.kompetensi
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k !== "");
      } catch {
        kompetensiArr = d.kompetensi
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k !== "");
      }
    }

    let keahlianArr: string[] = [];
    if (Array.isArray(d.keahlian)) {
      keahlianArr = d.keahlian;
    } else if (typeof d.keahlian === "string" && d.keahlian.trim() !== "") {
      try {
        const parsed = JSON.parse(d.keahlian);
        if (Array.isArray(parsed)) keahlianArr = parsed;
        else
          keahlianArr = d.keahlian
            .split(",")
            .map((k) => k.trim())
            .filter((k) => k !== "");
      } catch {
        keahlianArr = d.keahlian
          .split(",")
          .map((k) => k.trim())
          .filter((k) => k !== "");
      }
    }

    setForm({
      ...d,
      nid: d.nid || "-",
      nidn: d.nidn || "-",
      nuptk: d.nuptk || "-",
      password: "",
      kompetensi: kompetensiArr,
      keahlian: keahlianArr,
    });

    // Tentukan status berdasarkan keahlian
    const isStandby = keahlianArr.some((k) => k.toLowerCase() === "standby");
    setPeranUtama(isStandby ? "standby" : "aktif");

    // Hapus legacy state terkait peran mengajar/ketua/anggota

    // Set peran dari backend - dukung multiple peran_kurikulum (prefill multi-select saat edit)
    // Simpan dosen_peran untuk digunakan di getPeranKurikulumOptionsForSection
    setCurrentEditingDosenPeran(
      Array.isArray(d.dosen_peran) ? d.dosen_peran : []
    );

    if (Array.isArray(d.dosen_peran) && d.dosen_peran.length > 0) {
      // Ambil hanya peran non-mengajar untuk UI ini
      // Filter: koordinator dan tim_blok saja (bukan mengajar atau dosen_mengajar)
      const nonMengajar = d.dosen_peran.filter((p) => {
        const tipePeran = String(p.tipe_peran || "");
        return (
          tipePeran &&
          tipePeran !== "mengajar" &&
          tipePeran !== "dosen_mengajar" &&
          (tipePeran === "koordinator" || tipePeran === "tim_blok")
        );
      });

      if (nonMengajar.length > 0) {
        // Load data ke peranSections (section-based)
        // HILANGKAN DUPLIKASI: Unique berdasarkan kombinasi mata_kuliah_kode + blok + semester + peran_kurikulum
        setTimeout(() => {
          const sections: PeranSection[] = [];
          const seenKeys = new Set<string>();

          nonMengajar.forEach((peranData, index) => {
            const mataKuliahKode = peranData.mata_kuliah_kode || "";
            const matkul = matkulList.find((mk) => mk.kode === mataKuliahKode);
            if (matkul && peranData.peran_kurikulum) {
              const peranName =
                typeof peranData.peran_kurikulum === "string"
                  ? peranData.peran_kurikulum
                  : String(peranData.peran_kurikulum);
              const blok = String(peranData.blok || matkul.blok || "");
              const semester = String(
                peranData.semester || matkul.semester || ""
              );

              // Buat unique key untuk deduplication
              const uniqueKey = `${mataKuliahKode}-${peranName}-${blok}-${semester}`;

              // Skip jika sudah ada (duplikat)
              if (seenKeys.has(uniqueKey)) {
                return;
              }
              seenKeys.add(uniqueKey);

              const peranKey = uniqueKey;

              sections.push({
                id: `section-${Date.now()}-${index}`,
                mataKuliahKode: mataKuliahKode,
                peranKurikulumKey: peranKey,
              });
            }
          });
          setPeranSections(sections);
        }, 200); // Delay untuk memastikan matkulList sudah ter-load

        // Hindari efek reset membersihkan pilihan saat set MK secara programatik
        skipNextPeranResetRef.current = true;
        setSelectedPeranType("peran"); // Set peran khusus ke "peran"
      } else {
        setSelectedPeranType("none");
        setPeranSections([]);
      }
    } else {
      setSelectedPeranType("none");
      setSelectedMataKuliahList([]); // Set sebagai array kosong untuk multi-select
      setSelectedPeranKurikulumList([]);
    }
    // Legacy note removed
    setShowModal(true);
    setEditMode(true);
  };

  const handleDelete = async (id: string) => {
    setSelectedDeleteNid(id);
    setShowDeleteModal(true);
  };
  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (selectedDeleteNid) {
        await api.delete(`/users/${selectedDeleteNid}`);
        const res = await api.get("/users?role=dosen&per_page=1000");
        // Handle pagination response
        const usersData = Array.isArray(res.data) 
          ? res.data 
          : (res.data?.data || []);
        setData(usersData);
        setSuccess("Data dosen berhasil dihapus.");
      }
      setShowDeleteModal(false);
      setSelectedDeleteNid(null);
    } catch (err: any) {
      setError(handleApiError(err, "Menghapus data dosen"));
    } finally {
      setIsDeleting(false);
    }
  };
  const cancelDelete = () => {
    setShowDeleteModal(false);
    setSelectedDeleteNid(null);
  };
  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setImportedFile(file);
    try {
      const excelParsedData = await readExcelFile(file);

      // Transform data tanpa mengubah nama kolom
      const transformedData = excelParsedData.map((row) => {
        const newRow: any = { ...row };

        // Hapus field peran_dalam_kurikulum jika ada (field sudah tidak digunakan)
        delete newRow.peran_dalam_kurikulum;

        // Hapus field signature_image jika ada (field tidak diproses via import Excel)
        // Signature image hanya bisa diupload manual oleh dosen melalui halaman Profile
        delete newRow.signature_image;
        delete newRow.signature_image_ttd;
        delete newRow.ttd;
        delete newRow.tanda_tangan;

        // Cek apakah ada kolom gabungan NID/NIDN/NUPTK
        const headers = Object.keys(row);
        let combinedIdKey = headers.find(
          (h) =>
            h.toLowerCase().includes("nid") && h.toLowerCase().includes("/")
        );

        // Cek juga untuk format yang lebih spesifik
        if (!combinedIdKey) {
          combinedIdKey = headers.find(
            (h) =>
              h.toLowerCase() === "nid/nidn/nuptk" ||
              h.toLowerCase().includes("nid/nidn") ||
              h.toLowerCase().includes("nid/nidn/nuptk")
          );
        }

        // Jika tidak ada header yang jelas, cari berdasarkan data
        if (!combinedIdKey) {
          combinedIdKey = headers.find((h) => {
            const value = row[h];
            if (typeof value === "string" && value.includes("/")) {
              const parts = value.split("/");
              return (
                parts.length >= 2 &&
                parts.every((part) => /^[0-9]+$/.test(part.trim()))
              );
            }
            return false;
          });
        }

        if (combinedIdKey && row[combinedIdKey]) {
          // Parse data gabungan menjadi field terpisah
          const parsedData = parseCombinedIdData(String(row[combinedIdKey]));
          newRow.nid = parsedData.nid;
          newRow.nidn = parsedData.nidn;
          newRow.nuptk = parsedData.nuptk;

          // Hapus kolom gabungan dari data
          delete newRow[combinedIdKey];
        }

        // Handle kompetensi - simpan sebagai string
        if (typeof newRow.kompetensi === "string") {
          newRow.kompetensi = newRow.kompetensi;
        } else if (Array.isArray(newRow.kompetensi)) {
          newRow.kompetensi = newRow.kompetensi.join(", ");
        } else {
          newRow.kompetensi = "";
        }

        // Handle keahlian - simpan sebagai string
        if (typeof newRow.keahlian === "string") {
          newRow.keahlian = newRow.keahlian;
        } else if (Array.isArray(newRow.keahlian)) {
          newRow.keahlian = newRow.keahlian.join(", ");
        } else {
          newRow.keahlian = "";
        }

        return newRow;
      });

      // Gabungkan kolom NID/NIDN/NUPTK untuk preview
      const previewDataWithCombinedColumns = transformedData.map((row) => {
        const newRow = { ...row };

        // Gabungkan NID/NIDN/NUPTK menjadi satu kolom
        if (newRow.nid || newRow.nidn || newRow.nuptk) {
          const nid = newRow.nid || "";
          const nidn = newRow.nidn || "";
          const nuptk = newRow.nuptk || "";

          if (nid && nidn) {
            newRow["NID / NIDN / NUPTK"] = `${nid} / ${nidn}${
              nuptk ? ` / ${nuptk}` : ""
            }`;
          } else {
            newRow["NID / NIDN / NUPTK"] = nid || nidn || nuptk || "-";
          }
        } else {
          newRow["NID / NIDN / NUPTK"] = "-";
        }

        // Hapus kolom terpisah
        delete newRow.nid;
        delete newRow.nidn;
        delete newRow.nuptk;

        return newRow;
      });

      const validationResult = validateExcelData(transformedData, data);
      setPreviewData(transformedData); // Gunakan data asli untuk preview
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
    }

    try {
      // Transform data untuk dikirim ke backend
      const dataToExport = previewData.map((row) => {
        // Konversi string ke array untuk kompetensi dan keahlian
        const kompetensiArray =
          typeof row.kompetensi === "string"
            ? row.kompetensi
                .split(",")
                .map((item: string) => item.trim())
                .filter((item: string) => item !== "")
            : Array.isArray(row.kompetensi)
            ? row.kompetensi
                .map((item: string) => item.trim())
                .filter((item: string) => item !== "")
            : [];

        const keahlianArray =
          typeof row.keahlian === "string"
            ? row.keahlian
                .split(",")
                .map((item: string) => item.trim())
                .filter((item: string) => item !== "")
            : Array.isArray(row.keahlian)
            ? row.keahlian
                .map((item: string) => item.trim())
                .filter((item: string) => item !== "")
            : [];

        // Construct the object with exact column names as expected by the backend's Excel import
        // Note: role is not a column in the Excel template, so don't include it here for Excel export.
        // NOTE: signature_image tidak dikirim ke backend - field ini hanya bisa diupload manual oleh dosen melalui halaman Profile
        return {
          nid: row.nid,
          nidn: row.nidn,
          nuptk: row.nuptk, // Include NUPTK field
          nama: row.nama, // Use original 'nama' column name
          username: row.username,
          email: row.email,
          telepon: row.telepon, // Use original 'telepon' column name
          password: row.password,
          kompetensi: kompetensiArray.join(", "), // Convert back to string for Excel export
          keahlian: keahlianArray.join(", "),
          // signature_image tidak disertakan - hanya bisa diupload manual oleh dosen
        };
      });

      const ws = XLSX.utils.json_to_sheet(dataToExport);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Dosen");
      const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
      const file = new File([excelBuffer], "Data_Import_Dosen.xlsx", {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });

      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/users/import-dosen", formData, {
        headers: { "Content-Type": "multipart/form-data" },
        validateStatus: () => true,
        timeout: 120000, // 2 menit timeout untuk import data banyak
      });

      // After successful import, re-fetch the entire list of users
      const updatedDataRes = await api.get("/users?role=dosen&per_page=1000");
      // Handle pagination response
      const usersData = Array.isArray(updatedDataRes.data) 
        ? updatedDataRes.data 
        : (updatedDataRes.data?.data || []);
      setData(usersData);
      if (res.status === 200) {
        setImportedCount(
          res.data.imported_count || res.data.importedCount || 0
        );
        setImportedFile(null); // Hide the preview table
        setPreviewData([]);
        setValidationErrors([]);
        setCellErrors([]);
      } else if (res.status === 422) {
        setImportedCount(0);
        setError(res.data.message || "Gagal mengimpor data");
        if (res.data.failed_rows && res.data.failed_rows.length > 0) {
          setPreviewData(res.data.failed_rows);
        }
        setValidationErrors(res.data.errors || []);
        setCellErrors(res.data.cell_errors || []);
      } else {
        setImportedCount(0);
        setError("Gagal mengimpor data");
        setCellErrors([]);
      }
    } catch (err: any) {
      setImportedCount(0);

      // Handle timeout specifically
      if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        setError(
          "Import memakan waktu terlalu lama. Data mungkin terlalu banyak. Silakan coba dengan file yang lebih kecil atau hubungi administrator."
        );
      } else {
        setError(handleApiError(err, "Mengimpor data dosen"));
      }
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
          const workbook = XLSX.read(data, { type: "array" });
          const firstSheetName = workbook.SheetNames[0];
          const worksheet = workbook.Sheets[firstSheetName];

          // Get data as array of arrays
          const aoa = XLSX.utils.sheet_to_json(worksheet, {
            header: 1,
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
              rowData[header] = currentRow[index];
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

  // Fungsi untuk memisahkan data NID/NIDN/NUPTK dari format gabungan
  const parseCombinedIdData = (combinedData: string) => {
    if (!combinedData || typeof combinedData !== "string") {
      return { nid: "", nidn: "", nuptk: "" };
    }

    const parts = combinedData.split("/");
    return {
      nid: parts[0]?.trim() || "",
      nidn: parts[1]?.trim() || "",
      nuptk: parts[2]?.trim() || "",
    };
  };

  // Fungsi validasi data Excel saat diunggah
  const validateExcelData = (excelData: any[], existingDbData: UserDosen[]) => {
    const errors: string[] = [];
    const newCellErrors: {
      row: number;
      field: string;
      message: string;
      nid?: string;
    }[] = [];

    if (excelData.length === 0) {
      errors.push("File Excel kosong");
      return { valid: false, errors, cellErrors: newCellErrors };
    }

    // Cek header kolom
    const firstRow = excelData[0];
    const headers = Object.keys(firstRow);

    // Cek apakah ada kolom gabungan NID/NIDN/NUPTK atau kolom terpisah
    const hasCombinedId = headers.some(
      (h) => h.toLowerCase().includes("nid") && h.toLowerCase().includes("/")
    );

    // Cek juga untuk format "nid/nidn/nuptk" yang lebih spesifik
    const hasSpecificCombinedId = headers.some(
      (h) =>
        h.toLowerCase() === "nid/nidn/nuptk" ||
        h.toLowerCase().includes("nid/nidn") ||
        h.toLowerCase().includes("nid/nidn/nuptk")
    );

    // Cek apakah ada kolom yang berisi data gabungan (berdasarkan data, bukan header)
    const hasCombinedData = excelData.some((row) => {
      return Object.values(row).some((value) => {
        if (typeof value === "string" && value.includes("/")) {
          const parts = value.split("/");
          // Cek apakah format seperti NID/NIDN/NUPTK (angka/angka/angka)
          return (
            parts.length >= 2 &&
            parts.every((part) => /^[0-9]+$/.test(part.trim()))
          );
        }
        return false;
      });
    });

    const hasSeparateNid = headers.includes("nid");
    const hasSeparateNidn = headers.includes("nidn");

    let requiredHeaders: string[];

    // NOTE: signature_image tidak termasuk dalam requiredHeaders
    // Signature image hanya bisa diupload manual oleh dosen melalui halaman Profile
    // Jika ada kolom signature_image di Excel, akan diabaikan (tidak diproses)

    if (hasCombinedId || hasSpecificCombinedId || hasCombinedData) {
      // Jika ada kolom gabungan atau data gabungan, tidak perlu kolom nid dan nidn terpisah
      requiredHeaders = [
        "nama",
        "username",
        "email",
        "telepon",
        "password",
        "kompetensi",
        "keahlian",
      ];
    } else {
      // Jika tidak ada kolom gabungan, perlu kolom nid, nidn, dan nuptk terpisah
      requiredHeaders = [
        "nid",
        "nidn",
        "nuptk",
        "nama",
        "username",
        "email",
        "telepon",
        "password",
        "kompetensi",
        "keahlian",
      ];
    }

    const missingHeaders = requiredHeaders.filter(
      (h) => !headers.includes(h.toLowerCase())
    );
    if (missingHeaders.length > 0) {
      errors.push(
        `Kolom yang diperlukan tidak ditemukan: ${missingHeaders.join(", ")}`
      );
      return { valid: false, errors, cellErrors: newCellErrors };
    }

    // Validasi setiap baris data
    const nidSetInFile = new Set();
    const nidnSetInFile = new Set();
    const usernameSetInFile = new Set();
    const emailSetInFile = new Set();

    excelData.forEach((row, index) => {
      const rowNum = index + 2; // +2 karena header di row 1 dan index mulai dari 0

      let rowNid = "";
      let rowNidn = "";
      let rowNuptk = "";

      // Cek apakah data dalam format gabungan atau terpisah
      if (hasCombinedId || hasSpecificCombinedId || hasCombinedData) {
        // Cari kolom yang berisi data gabungan
        let combinedIdKey = headers.find(
          (h) =>
            h.toLowerCase().includes("nid") && h.toLowerCase().includes("/")
        );

        // Jika tidak ada header yang jelas, cari berdasarkan data
        if (!combinedIdKey) {
          combinedIdKey = headers.find((h) => {
            const value = row[h];
            if (typeof value === "string" && value.includes("/")) {
              const parts = value.split("/");
              return (
                parts.length >= 2 &&
                parts.every((part) => /^[0-9]+$/.test(part.trim()))
              );
            }
            return false;
          });
        }

        if (combinedIdKey && row[combinedIdKey]) {
          const parsedData = parseCombinedIdData(String(row[combinedIdKey]));
          rowNid = parsedData.nid;
          rowNidn = parsedData.nidn;
          rowNuptk = parsedData.nuptk;
        }
      } else {
        // Data terpisah
        rowNid = row.nid ? String(row.nid).trim() : "";
        rowNidn = row.nidn ? String(row.nidn).trim() : "";
        rowNuptk = row.nuptk ? String(row.nuptk).trim() : "";
      }

      const rowUsername = row.username
        ? String(row.username).toLowerCase()
        : "";
      const rowEmail = row.email ? String(row.email).toLowerCase() : "";

      // Basic required and format validations
      // NID dan NIDN wajib diisi dengan angka atau "-"
      if (!rowNid || (!/^[0-9]+$/.test(rowNid) && rowNid !== "-")) {
        errors.push(
          `NID harus diisi dengan angka atau "-" (Baris ${rowNum}, Kolom NID): ${rowNid}`
        );
        newCellErrors.push({
          row: index,
          field: "nid",
          message: `NID harus diisi dengan angka atau "-"`,
          nid: rowNid,
        });
      }
      if (!rowNidn || (!/^[0-9]+$/.test(rowNidn) && rowNidn !== "-")) {
        errors.push(
          `NIDN harus diisi dengan angka atau "-" (Baris ${rowNum}, Kolom NIDN): ${rowNidn}`
        );
        newCellErrors.push({
          row: index,
          field: "nidn",
          message: `NIDN harus diisi dengan angka atau "-"`,
          nid: rowNidn,
        });
      }
      // NUPTK wajib diisi dengan angka atau "-"
      if (!rowNuptk || (!/^[0-9]+$/.test(rowNuptk) && rowNuptk !== "-")) {
        errors.push(
          `NUPTK harus diisi dengan angka atau "-" (Baris ${rowNum}, Kolom NUPTK): ${rowNuptk}`
        );
        newCellErrors.push({
          row: index,
          field: "nuptk",
          message: `NUPTK harus diisi dengan angka atau "-"`,
          nid: rowNuptk,
        });
      }
      if (!row.nama) {
        errors.push(`Nama harus diisi (Baris ${rowNum})`);
        newCellErrors.push({
          row: index,
          field: "nama",
          message: `Nama harus diisi`,
          nid: rowNid,
        });
      }
      if (!row.username) {
        errors.push(`Username harus diisi (Baris ${rowNum})`);
        newCellErrors.push({
          row: index,
          field: "username",
          message: `Username harus diisi`,
          nid: rowNid,
        });
      }
      if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push(`Email tidak valid (Baris ${rowNum})`);
        newCellErrors.push({
          row: index,
          field: "email",
          message: `Email tidak valid`,
          nid: rowNid,
        });
      }
      if (!row.telepon || !/^[0-9]+$/.test(row.telepon)) {
        errors.push(`Nomor telepon harus diisi dengan angka (Baris ${rowNum})`);
        newCellErrors.push({
          row: index,
          field: "telepon",
          message: `Nomor telepon harus diisi dengan angka`,
          nid: rowNid,
        });
      }
      if (!row.password || String(row.password).length < 6) {
        errors.push(
          `Password harus diisi minimal 6 karakter (Baris ${rowNum})`
        );
        newCellErrors.push({
          row: index,
          field: "password",
          message: `Password harus diisi minimal 6 karakter`,
          nid: rowNid,
        });
      }
      // Validasi keahlian dan kompetensi berdasarkan standby logic
      const keahlianValue = String(row.keahlian || "").trim();
      const kompetensiValue = String(row.kompetensi || "").trim();

      // Cek apakah keahlian mengandung "standby"
      const isStandby = keahlianValue.toLowerCase().includes("standby");

      if (isStandby) {
        // Jika standby, keahlian harus HANYA "standby"
        const keahlianArray = keahlianValue
          .split(",")
          .map((k) => k.trim().toLowerCase());
        if (keahlianArray.length !== 1 || keahlianArray[0] !== "standby") {
          errors.push(
            `Jika keahlian mengandung "standby", maka harus HANYA "standby" saja (Baris ${rowNum})`
          );
          newCellErrors.push({
            row: index,
            field: "keahlian",
            message: `Jika keahlian mengandung "standby", maka harus HANYA "standby" saja`,
            nid: rowNid,
          });
        }

        // Jika standby, kompetensi harus kosong
        if (kompetensiValue !== "") {
          errors.push(
            `Jika keahlian "standby", kompetensi harus kosong (Baris ${rowNum})`
          );
          newCellErrors.push({
            row: index,
            field: "kompetensi",
            message: `Jika keahlian "standby", kompetensi harus kosong`,
            nid: rowNid,
          });
        }
      } else {
        // Jika tidak standby, kompetensi harus diisi
        if (!kompetensiValue) {
          errors.push(`Kompetensi harus diisi (Baris ${rowNum})`);
          newCellErrors.push({
            row: index,
            field: "kompetensi",
            message: `Kompetensi harus diisi`,
            nid: rowNid,
          });
        }
      }

      // Duplikat dalam file Excel - skip untuk nilai "-"
      if (rowNid && rowNid !== "-") {
        if (nidSetInFile.has(rowNid)) {
          errors.push(
            `NID ${rowNid} sudah terdaftar dalam file Excel ini (Baris ${rowNum})`
          );
          newCellErrors.push({
            row: index,
            field: "nid",
            message: `NID sudah terdaftar dalam file Excel ini`,
            nid: rowNid,
          });
        } else {
          nidSetInFile.add(rowNid);
        }
      }
      if (rowNidn && rowNidn !== "-") {
        if (nidnSetInFile.has(rowNidn)) {
          errors.push(
            `NIDN ${rowNidn} sudah terdaftar dalam file Excel ini (Baris ${rowNum})`
          );
          newCellErrors.push({
            row: index,
            field: "nidn",
            message: `NIDN sudah terdaftar dalam file Excel ini`,
            nid: rowNidn,
          });
        } else {
          nidnSetInFile.add(rowNidn);
        }
      }
      if (rowUsername) {
        if (usernameSetInFile.has(rowUsername)) {
          errors.push(
            `Username ${rowUsername} sudah terdaftar dalam file Excel ini (Baris ${rowNum})`
          );
          newCellErrors.push({
            row: index,
            field: "username",
            message: `Username sudah terdaftar dalam file Excel ini`,
            nid: rowNid,
          });
        } else {
          usernameSetInFile.add(rowUsername);
        }
      }
      if (rowEmail) {
        if (emailSetInFile.has(rowEmail)) {
          errors.push(
            `Email ${rowEmail} sudah terdaftar dalam file Excel ini (Baris ${rowNum})`
          );
          newCellErrors.push({
            row: index,
            field: "email",
            message: `Email sudah terdaftar dalam file Excel ini`,
            nid: rowNid,
          });
        } else {
          emailSetInFile.add(rowEmail);
        }
      }

      // Duplikat dengan data di database
      const existingNid = existingDbData.find((d) => String(d.nid) === rowNid);
      if (existingNid) {
        errors.push(
          `NID ${rowNid} sudah terdaftar di database (Baris ${rowNum})`
        );
        newCellErrors.push({
          row: index,
          field: "nid",
          message: `NID sudah terdaftar di database`,
          nid: rowNid,
        });
      }
      const existingNidn = existingDbData.find(
        (d) => String(d.nidn) === rowNidn
      );
      if (existingNidn) {
        errors.push(
          `NIDN ${rowNidn} sudah terdaftar di database (Baris ${rowNum})`
        );
        newCellErrors.push({
          row: index,
          field: "nidn",
          message: `NIDN sudah terdaftar di database`,
          nid: rowNidn,
        });
      }
      const existingUsername = existingDbData.find(
        (d) => String(d.username).toLowerCase() === rowUsername
      );
      if (existingUsername) {
        errors.push(
          `Username ${rowUsername} sudah terdaftar di database (Baris ${rowNum})`
        );
        newCellErrors.push({
          row: index,
          field: "username",
          message: `Username sudah terdaftar di database`,
          nid: rowNid,
        });
      }
      const existingEmail = existingDbData.find(
        (d) => String(d.email).toLowerCase() === rowEmail
      );
      if (existingEmail) {
        errors.push(
          `Email ${rowEmail} sudah terdaftar di database (Baris ${rowNum})`
        );
        newCellErrors.push({
          row: index,
          field: "email",
          message: `Email sudah terdaftar di database`,
          nid: rowNid,
        });
      }
    });

    return { valid: errors.length === 0, errors, cellErrors: newCellErrors };
  };

  const handleDeleteSelected = async () => {
    setIsDeleting(true);
    try {
      await Promise.all(selectedRows.map((id) => api.delete(`/users/${id}`)));
      const res = await api.get("/users?role=dosen&per_page=1000");
      // Handle pagination response
      const usersData = Array.isArray(res.data) 
        ? res.data 
        : (res.data?.data || []);
      setData(usersData);
      setSuccess(`${selectedRows.length} data dosen berhasil dihapus.`);
      setSelectedRows([]);
    } catch {
      setError("Gagal menghapus data terpilih");
    } finally {
      setIsDeleting(false);
    }
  };

  // New handler for Listbox onChange to manage 'all_kompetensi' logic
  const handleFilterKompetensiChange = (newSelection: string[]) => {
    // If 'all_kompetensi' was just selected
    if (newSelection.includes("all_kompetensi")) {
      setFilterKompetensi([]); // Clear all other selections, effectively 'select all'
      setPage(1); // RESET PAGE!
    } else if (newSelection.length === 0 && filterKompetensi.length > 0) {
      // If newSelection is empty AND previous filterKompetensi was not empty, it means all individual items were deselected.
      // In this case, we want to reset to 'all' state (empty array).
      setFilterKompetensi([]);
      setPage(1); // RESET PAGE!
    } else {
      // Filter out 'all_kompetensi' if it was present and actual competencies are being selected
      const filtered = newSelection.filter((item) => item !== "all_kompetensi");
      setFilterKompetensi(filtered);
      setPage(1); // RESET PAGE!
    }
  };

  // New handler for Listbox onChange to manage 'all_keahlian' logic
  const handleFilterKeahlianChange = (newSelection: string[]) => {
    // If 'all_keahlian' was just selected
    if (newSelection.includes("all_keahlian")) {
      setFilterKeahlian([]); // Clear all other selections, effectively 'select all'
      setPage(1); // RESET PAGE!
    } else if (newSelection.length === 0 && filterKeahlian.length > 0) {
      // If newSelection is empty AND previous filterKeahlian was not empty, it means all individual items were deselected.
      // In this case, we want to reset to 'all' state (empty array).
      setFilterKeahlian([]);
      setPage(1); // RESET PAGE!
    } else {
      // Filter out 'all_keahlian' if it was present and actual keahlian are being selected
      const filtered = newSelection.filter((item) => item !== "all_keahlian");
      setFilterKeahlian(filtered);
      setPage(1); // RESET PAGE!
    }
  };

  // Fetch daftar peran kurikulum global dari backend
  useEffect(() => {
    api.get("/mata-kuliah/peran-kurikulum-options").then((res) => {
      if (Array.isArray(res.data)) {
        setPeranKurikulumOptions(res.data);
        setFilteredPeranKurikulumOptions(res.data); // Set default filtered options
      }
    });
  }, []);

  // Fungsi untuk memfilter peran kurikulum berdasarkan mata kuliah yang dipilih
  const filterPeranKurikulumByMataKuliah = (mataKuliahKodeList: string[]) => {
    if (!mataKuliahKodeList || mataKuliahKodeList.length === 0) {
      setFilteredPeranKurikulumOptions([]);
      return;
    }

    // Cari semua mata kuliah yang dipilih
    const selectedMatkulList = mataKuliahKodeList
      .map((kode) => matkulList.find((mk) => mk.kode === kode))
      .filter(Boolean);

    if (selectedMatkulList.length === 0) {
      setFilteredPeranKurikulumOptions([]);
      return;
    }

    // Ambil peran kurikulum yang spesifik untuk semua mata kuliah yang dipilih
    const allPeranKurikulum: PeranKurikulumOption[] = [];

    selectedMatkulList.forEach((selectedMatkul, index) => {
      const mataKuliahPeranKurikulum =
        selectedMatkul.peran_dalam_kurikulum || [];

      if (Array.isArray(mataKuliahPeranKurikulum)) {
        mataKuliahPeranKurikulum.forEach((peran) => {
          // Tentukan tipe peran berdasarkan nama dengan mapping yang lebih konsisten
          let tipePeran = "tim_blok"; // default
          const peranLower = peran.toLowerCase();

          // Mapping yang lebih spesifik untuk konsistensi
          if (peranLower.includes("koordinator")) {
            tipePeran = "koordinator";
          } else if (
            peranLower.includes("tim blok") ||
            peranLower.includes("tim_blok") ||
            peranLower.includes("penguji") ||
            peranLower.includes("asisten") ||
            peranLower.includes("tutor")
          ) {
            tipePeran = "tim_blok";
          }

          // Tidak ada filterisasi tipe peran - tampilkan semua
          if (true) {
            const peranOption: PeranKurikulumOption = {
              name: `${peran} (Blok ${selectedMatkul.blok} Semester ${selectedMatkul.semester})`,
              mataKuliahKode: selectedMatkul.kode,
              blok: String(selectedMatkul.blok),
              semester: String(selectedMatkul.semester),
              tipePeran: tipePeran,
              originalName: peran,
            };

            allPeranKurikulum.push(peranOption);
          }
        });
      }
    });

    // Jika ada peran kurikulum spesifik untuk mata kuliah yang dipilih, gunakan itu
    if (allPeranKurikulum.length > 0) {
      setFilteredPeranKurikulumOptions(allPeranKurikulum);
      return;
    }

    // Fallback: Filter berdasarkan semester dan blok jika tidak ada data spesifik

    const filteredPeranOptions: PeranKurikulumOption[] = [];

    selectedMatkulList.forEach((selectedMatkul) => {
      peranKurikulumOptions.forEach((peran) => {
        const peranLower = peran.toLowerCase();

        // Tidak ada filterisasi tipe peran - tampilkan semua
        if (true) {
          const semester = selectedMatkul.semester;
          const blok = selectedMatkul.blok;

          // Cek semester
          const semesterPatterns = [
            `semester ${semester}`,
            `sem ${semester}`,
            `smt ${semester}`,
          ];

          const hasCorrectSemester = semesterPatterns.some((pattern) =>
            peranLower.includes(pattern)
          );

          if (hasCorrectSemester) {
            // Cek blok jika ada
            let hasCorrectBlok = true;
            if (blok) {
              const blokPatterns = [`blok ${blok}`, `blok ke-${blok}`];

              hasCorrectBlok = blokPatterns.some((pattern) =>
                peranLower.includes(pattern)
              );
            }

            if (hasCorrectBlok) {
              // Tentukan tipe peran berdasarkan nama dengan mapping yang lebih konsisten
              let tipePeran = "tim_blok"; // default

              // Mapping yang lebih spesifik untuk konsistensi
              if (peranLower.includes("koordinator")) {
                tipePeran = "koordinator";
              } else if (
                peranLower.includes("tim blok") ||
                peranLower.includes("tim_blok") ||
                peranLower.includes("penguji") ||
                peranLower.includes("asisten") ||
                peranLower.includes("tutor")
              ) {
                tipePeran = "tim_blok";
              }

              const peranOption: PeranKurikulumOption = {
                name: `${peran} (Blok ${blok} Semester ${semester})`,
                mataKuliahKode: selectedMatkul.kode,
                blok: String(blok),
                semester: String(semester),
                tipePeran: tipePeran,
                originalName: peran,
              };

              filteredPeranOptions.push(peranOption);
            }
          }
        }
      });
    });

    setFilteredPeranKurikulumOptions(
      filteredPeranOptions.length > 0 ? filteredPeranOptions : []
    );
  };

  // Effect untuk memfilter peran kurikulum ketika data terkait berubah
  useEffect(() => {
    filterPeranKurikulumByMataKuliah(selectedMataKuliahList);
  }, [selectedMataKuliahList, peranKurikulumOptions, matkulList]);

  // Effect terpisah untuk reset pilihan hanya saat selectedMataKuliahList benar-benar berubah
  useEffect(() => {
    if (selectedMataKuliahList.length > 0) {
      if (skipNextPeranResetRef.current) {
        skipNextPeranResetRef.current = false;
      } else if (!editMode) {
        // Jangan reset saat edit mode untuk mencegah checklist hilang
        setSelectedPeranKurikulumList([]);
      }
    }
  }, [selectedMataKuliahList, editMode]);

  // Effect untuk sinkronisasi peran kurikulum dengan mata kuliah yang dipilih
  useEffect(() => {
    if (
      selectedMataKuliahList.length > 0 &&
      selectedPeranKurikulumList.length > 0
    ) {
      // Filter peran kurikulum yang masih relevan dengan mata kuliah yang dipilih
      const relevantPeranKurikulum = selectedPeranKurikulumList.filter(
        (peranKey) => {
          // Extract mataKuliahKode from key (format: "MKB101-Penguji Skill Lab-1-1")
          const mataKuliahKode = peranKey.split("-")[0];
          return selectedMataKuliahList.includes(mataKuliahKode);
        }
      );

      // Jika ada peran kurikulum yang tidak relevan lagi, hapus
      if (relevantPeranKurikulum.length !== selectedPeranKurikulumList.length) {
        const removedPeran = selectedPeranKurikulumList.filter((peranKey) => {
          const mataKuliahKode = peranKey.split("-")[0];
          return !selectedMataKuliahList.includes(mataKuliahKode);
        });
        setSelectedPeranKurikulumList(relevantPeranKurikulum);
      }
    } else if (selectedMataKuliahList.length === 0) {
      // Jika tidak ada mata kuliah yang dipilih, hapus semua peran kurikulum
      setSelectedPeranKurikulumList([]);
    }
  }, [selectedMataKuliahList]);

  // Auto-add section saat memilih "peran" untuk pertama kali
  useEffect(() => {
    if (selectedPeranType === "peran" && peranSections.length === 0) {
      const newSection: PeranSection = {
        id: `section-${Date.now()}-${Math.random()}`,
        mataKuliahKode: "",
        peranKurikulumKey: "",
      };
      setPeranSections([newSection]);
    } else if (selectedPeranType === "none") {
      setPeranSections([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPeranType]);

  // Validasi keahlian ketika ada perubahan pada keahlian dosen atau mata kuliah yang dipilih
  useEffect(() => {
    if (
      form.keahlian &&
      peranSections.length > 0 &&
      selectedPeranType !== "none"
    ) {
      const keahlianArray = Array.isArray(form.keahlian)
        ? form.keahlian
        : typeof form.keahlian === "string"
        ? [form.keahlian]
        : [];
      // Validasi untuk mata kuliah pertama di sections (untuk display)
      const firstSection = peranSections.find((s) => s.mataKuliahKode);
      if (firstSection) {
        validateKeahlian(keahlianArray, firstSection.mataKuliahKode);
      }
    } else {
      setKeahlianValidationMessage("");
    }
  }, [form.keahlian, peranSections, selectedPeranType, matkulList]);

  // Catatan legacy dihapus

  // Function untuk mengecek apakah peran kurikulum option disabled
  const isPeranKurikulumDisabled = (option: PeranKurikulumOption): boolean => {
    if (true) {
      // Tidak ada filterisasi tipe peran
      return false; // Tidak ada conflict jika bukan "keduanya"
    }

    // Cek apakah sudah ada peran yang conflict di blok dan semester yang sama
    const hasConflict = selectedPeranKurikulumList.some((selectedPeranKey) => {
      // Parse key to get properties
      const [mataKuliahKode, originalName, blok, semester] =
        selectedPeranKey.split("-");
      // Conflict jika berbeda tipe peran tapi sama blok dan semester
      return (
        blok === option.blok &&
        semester === option.semester &&
        "tim_blok" !== option.tipePeran // Simplified conflict detection
      );
    });

    return hasConflict;
  };

  // Function untuk mengecek konflik koordinator dan mendapatkan nama dosen yang sudah memilih
  const getKoordinatorConflict = (
    option: PeranKurikulumOption
  ): { isDisabled: boolean; conflictDosenName?: string } => {
    // Hanya berlaku untuk koordinator
    if (option.tipePeran !== "koordinator") {
      return { isDisabled: false };
    }

    // Cek apakah sudah ada koordinator lain di blok + semester yang sama di sections lain
    const conflictInSections = peranSections.some((section) => {
      if (!section.peranKurikulumKey) return false;

      const parts = section.peranKurikulumKey.split("-");
      if (parts.length >= 4) {
        // Ambil 2 bagian terakhir untuk blok dan semester
        const semester = parts[parts.length - 1];
        const blok = parts[parts.length - 2];
        const mataKuliahKodeFromKey = parts[0];

        const optionBlok = parseInt(option.blok);
        const optionSemester = parseInt(option.semester);
        const sectionBlok = parseInt(blok);
        const sectionSemester = parseInt(semester);

        // Cek apakah section ini adalah koordinator di blok + semester yang sama
        const sectionOptions = getPeranKurikulumOptionsForSection(
          section.mataKuliahKode
        );
        const sectionOption = sectionOptions.find(
          (opt) =>
            `${opt.mataKuliahKode}-${opt.originalName}-${opt.blok}-${opt.semester}` ===
            section.peranKurikulumKey
        );

        return (
          sectionOption?.tipePeran === "koordinator" &&
          mataKuliahKodeFromKey === option.mataKuliahKode &&
          sectionBlok === optionBlok &&
          sectionSemester === optionSemester
        );
      }
      return false;
    });

    if (conflictInSections) {
      return {
        isDisabled: true,
        conflictDosenName: "Peran lain di form ini",
      };
    }

    // Cek apakah sudah ada dosen lain yang memilih koordinator untuk mata kuliah, blok, dan semester yang sama
    const conflictDosen = data.find((dosen) => {
      // Skip dosen yang sedang diedit
      if (editMode && dosen.id === form.id) {
        return false;
      }

      // Cek apakah dosen ini punya peran koordinator untuk mata kuliah yang sama
      const hasConflict = dosen.dosen_peran?.some((peran) => {
        // Pastikan tipe data sama
        const peranBlok =
          typeof peran.blok === "string" ? parseInt(peran.blok) : peran.blok;
        const peranSemester =
          typeof peran.semester === "string"
            ? parseInt(peran.semester)
            : peran.semester;
        const optionBlok = parseInt(option.blok);
        const optionSemester = parseInt(option.semester);

        const isMatch =
          peran.tipe_peran === "koordinator" &&
          peran.mata_kuliah_kode === option.mataKuliahKode &&
          peranBlok === optionBlok &&
          peranSemester === optionSemester;
        return isMatch;
      });

      return hasConflict;
    });

    if (conflictDosen) {
      return {
        isDisabled: true,
        conflictDosenName: conflictDosen.name,
      };
    }

    return { isDisabled: false };
  };

  // Helper functions untuk section-based peran
  const addPeranSection = () => {
    const newSection: PeranSection = {
      id: `section-${Date.now()}-${Math.random()}`,
      mataKuliahKode: "",
      peranKurikulumKey: "",
    };
    setPeranSections([...peranSections, newSection]);
  };

  const removePeranSection = (sectionId: string) => {
    setPeranSections(peranSections.filter((s) => s.id !== sectionId));
  };

  const updatePeranSection = (
    sectionId: string,
    updates: Partial<PeranSection>
  ) => {
    setPeranSections(
      peranSections.map((s) => (s.id === sectionId ? { ...s, ...updates } : s))
    );
  };

  // Fungsi untuk mendapatkan peran kurikulum options berdasarkan mata kuliah yang dipilih di section
  const getPeranKurikulumOptionsForSection = (
    mataKuliahKode: string
  ): PeranKurikulumOption[] => {
    if (!mataKuliahKode) return [];

    const matkul = matkulList.find((mk) => mk.kode === mataKuliahKode);
    if (!matkul) return [];

    const mataKuliahPeranKurikulum = matkul.peran_dalam_kurikulum || [];
    const options: PeranKurikulumOption[] = [];
    const addedPeranNames = new Set<string>(); // Untuk tracking peran yang sudah ditambahkan

    // 1. Tambahkan peran dari mata kuliah spesifik
    if (Array.isArray(mataKuliahPeranKurikulum)) {
      mataKuliahPeranKurikulum.forEach((peran) => {
        let tipePeran = "tim_blok";
        const peranLower = peran.toLowerCase();

        if (peranLower.includes("koordinator")) {
          tipePeran = "koordinator";
        } else if (
          peranLower.includes("tim blok") ||
          peranLower.includes("tim_blok") ||
          peranLower.includes("penguji") ||
          peranLower.includes("asisten") ||
          peranLower.includes("tutor")
        ) {
          tipePeran = "tim_blok";
        }

        options.push({
          name: `${peran} (Blok ${matkul.blok} Semester ${matkul.semester})`,
          mataKuliahKode: mataKuliahKode,
          blok: String(matkul.blok || ""),
          semester: String(matkul.semester || ""),
          tipePeran: tipePeran,
          originalName: peran,
        });
        addedPeranNames.add(peran.toLowerCase());
      });
    }

    // 2. PENTING: Tambahkan peran yang sudah ada di database untuk dosen ini (jika sedang edit)
    // Ini memastikan peran yang sudah disimpan di database selalu muncul di dropdown
    // bahkan jika tidak ada di peran_dalam_kurikulum mata kuliah
    if (
      editMode &&
      Array.isArray(currentEditingDosenPeran) &&
      currentEditingDosenPeran.length > 0
    ) {
      currentEditingDosenPeran.forEach((peranData: any) => {
        // Hanya tambahkan jika:
        // - Mata kuliah sama
        // - Blok dan semester sama (atau sesuai dengan matkul)
        // - Belum ada di options
        // - Peran kurikulum ada
        if (
          peranData.mata_kuliah_kode === mataKuliahKode &&
          peranData.peran_kurikulum
        ) {
          // Cek apakah blok dan semester match (atau tidak ada di peranData, gunakan dari matkul)
          const peranBlok = String(peranData.blok || matkul.blok || "");
          const peranSemester = String(
            peranData.semester || matkul.semester || ""
          );
          const matkulBlok = String(matkul.blok || "");
          const matkulSemester = String(matkul.semester || "");

          // Match jika blok dan semester sama, atau jika peranData tidak punya blok/semester
          const blokMatch = !peranData.blok || peranBlok === matkulBlok;
          const semesterMatch =
            !peranData.semester || peranSemester === matkulSemester;

          if (blokMatch && semesterMatch) {
            const peranName = String(peranData.peran_kurikulum);
            const peranKey = peranName.toLowerCase();

            // Skip jika sudah ada
            if (!addedPeranNames.has(peranKey)) {
              let tipePeran = peranData.tipe_peran || "tim_blok";
              const peranLower = peranName.toLowerCase();

              // Tentukan tipe peran jika belum ada atau dosen_mengajar
              if (
                !tipePeran ||
                tipePeran === "dosen_mengajar" ||
                tipePeran === "mengajar"
              ) {
                if (peranLower.includes("koordinator")) {
                  tipePeran = "koordinator";
                } else {
                  tipePeran = "tim_blok";
                }
              }

              // Hanya tambahkan jika koordinator atau tim_blok (bukan dosen_mengajar)
              if (tipePeran === "koordinator" || tipePeran === "tim_blok") {
                options.push({
                  name: `${peranName} (Blok ${matkul.blok} Semester ${matkul.semester})`,
                  mataKuliahKode: mataKuliahKode,
                  blok: peranBlok,
                  semester: peranSemester,
                  tipePeran: tipePeran,
                  originalName: peranName,
                });
                addedPeranNames.add(peranKey);
              }
            }
          }
        }
      });
    }

    // 3. Fallback ke peranKurikulumOptions jika masih belum ada
    if (options.length === 0) {
      peranKurikulumOptions.forEach((peran) => {
        const peranLower = peran.toLowerCase();
        const semester = matkul.semester;
        const blok = matkul.blok;

        // Skip jika sudah ditambahkan
        if (addedPeranNames.has(peranLower)) {
          return;
        }

        const semesterPatterns = [
          `semester ${semester}`,
          `sem ${semester}`,
          `smt ${semester}`,
        ];

        const hasCorrectSemester = semesterPatterns.some((pattern) =>
          peranLower.includes(pattern)
        );

        if (hasCorrectSemester) {
          let hasCorrectBlok = true;
          if (blok) {
            const blokPatterns = [`blok ${blok}`, `blok ke-${blok}`];
            hasCorrectBlok = blokPatterns.some((pattern) =>
              peranLower.includes(pattern)
            );
          }

          if (hasCorrectBlok) {
            let tipePeran = "tim_blok";
            if (peranLower.includes("koordinator")) {
              tipePeran = "koordinator";
            }

            options.push({
              name: `${peran} (Blok ${blok} Semester ${semester})`,
              mataKuliahKode: mataKuliahKode,
              blok: String(blok || ""),
              semester: String(semester || ""),
              tipePeran: tipePeran,
              originalName: peran,
            });
            addedPeranNames.add(peranLower);
          }
        }
      });
    }

    return options;
  };

  // Function untuk validasi keahlian dosen dengan mata kuliah
  const validateKeahlian = (
    dosenKeahlian: string[],
    mataKuliahKode: string
  ) => {
    if (!mataKuliahKode || selectedPeranType === "none") {
      setKeahlianValidationMessage("");
      return true;
    }

    const mataKuliah = matkulList.find((mk) => mk.kode === mataKuliahKode);
    if (
      !mataKuliah ||
      !mataKuliah.keahlian_required ||
      mataKuliah.keahlian_required.length === 0
    ) {
      setKeahlianValidationMessage("");
      return true;
    }

    // Cek apakah ada keahlian dosen yang sesuai dengan keahlian yang dibutuhkan
    const hasMatchingKeahlian = dosenKeahlian.some((keahlian) =>
      mataKuliah.keahlian_required!.some(
        (required) =>
          keahlian.toLowerCase().includes(required.toLowerCase()) ||
          required.toLowerCase().includes(keahlian.toLowerCase())
      )
    );

    if (!hasMatchingKeahlian) {
      setKeahlianValidationMessage(
        `Keahlian tidak sesuai yang dibutuhkan. Mata kuliah "${
          mataKuliah.nama
        }" membutuhkan: ${mataKuliah.keahlian_required.join(", ")}`
      );
      return false;
    } else {
      setKeahlianValidationMessage("");
      return true;
    }
  };

  // Function untuk fetch assignment data
  const fetchAssignmentData = async () => {
    try {
      // Ambil semua PBL IDs secara dinamis dari API
      const pblRes = await api.get("/pbls/all");
      const pblData = pblRes.data || {};

      // PERBAIKAN: Simpan mapping PBL ID ke data PBL (termasuk mata kuliah)
      const pblMap: Record<
        number,
        {
          mata_kuliah_kode: string;
          mataKuliah?: {
            kode: string;
            nama: string;
            semester: number;
            blok: number;
          };
        }
      > = {};

      // Extract semua PBL IDs dari data dan simpan mapping
      const allPblIds: number[] = [];
      Object.values(pblData).forEach((item: any) => {
        if (item.pbls && Array.isArray(item.pbls)) {
          item.pbls.forEach((pbl: any) => {
            if (pbl.id) {
              allPblIds.push(pbl.id);
              // Simpan mapping PBL ID ke data PBL
              pblMap[pbl.id] = {
                mata_kuliah_kode:
                  pbl.mata_kuliah_kode || item.mata_kuliah?.kode || "",
                mataKuliah: item.mata_kuliah
                  ? {
                      kode: item.mata_kuliah.kode || "",
                      nama: item.mata_kuliah.nama || "",
                      semester: item.mata_kuliah.semester || 0,
                      blok: item.mata_kuliah.blok || 0,
                    }
                  : undefined,
              };
            }
          });
        }
      });

      // Simpan PBL map ke state
      setPblDataMap(pblMap);

      if (allPblIds.length > 0) {
        // Gunakan endpoint yang sama dengan PBL-detail.tsx untuk konsistensi
        const assignedRes = await api.post("/pbl-generate/get-assignments", {
          pbl_ids: allPblIds,
        });

        // PERBAIKAN: Simpan data lengkap dari backend (termasuk pbl.mataKuliah)
        // Format: { [pblId]: [assignments] } dimana setiap assignment punya:
        // - dosen: { id, name, nid, ... }
        // - pbl: { id, mataKuliah: { kode, nama, semester, blok, ... }, ... }
        // - role: "dosen_mengajar" | "koordinator" | "tim_blok"
        const assignmentData = assignedRes.data.data || {};

        // PERBAIKAN: Enrich assignment data dengan mata kuliah dari pblDataMap jika tidak ada
        // Gunakan pblMap (local variable) karena pblDataMap state mungkin belum ter-update
        const enrichedAssignmentData: any = {};
        Object.entries(assignmentData).forEach(
          ([pblIdStr, assignments]: [string, any]) => {
            const pblId = parseInt(pblIdStr);
            if (Array.isArray(assignments)) {
              enrichedAssignmentData[pblId] = assignments.map(
                (assignment: any) => {
                  // Jika assignment.pbl tidak ada atau tidak ada mataKuliah, tambahkan dari pblMap
                  if (!assignment.pbl || !assignment.pbl.mataKuliah) {
                    const pblData = pblMap[pblId]; // Gunakan pblMap (local) bukan pblDataMap (state)
                    if (pblData && pblData.mataKuliah) {
                      return {
                        ...assignment,
                        pbl: {
                          ...(assignment.pbl || {}),
                          id: assignment.pbl_id || assignment.pbl?.id || pblId,
                          mataKuliah: pblData.mataKuliah,
                        },
                      };
                    }
                  }
                  return assignment;
                }
              );
            } else {
              enrichedAssignmentData[pblId] = assignments;
            }
          }
        );

        setAssignmentData(enrichedAssignmentData);
      } else {
        setAssignmentData({});
      }
    } catch (error: any) {
      console.error("Error fetching assignment data:", error);
      setAssignmentData({});
    }
  };

  // Function untuk menghitung assignment count per dosen (HANYA dosen_mengajar)
  const getAssignmentCount = (dosenId: number): number => {
    // Hitung dari assignmentData yang real-time
    // PERBAIKAN: Hanya hitung yang role === "dosen_mengajar"
    let count = 0;
    Object.values(assignmentData).forEach((assignments: any[]) => {
      if (Array.isArray(assignments)) {
        assignments.forEach((assignment: any) => {
          // PERBAIKAN: Cek dosen_id dari assignment.dosen atau assignment.id
          const assignmentDosenId = assignment.dosen?.id || assignment.id;
          const assignmentRole = assignment.role || assignment.pbl_role;

          if (
            assignmentDosenId === dosenId &&
            assignmentRole === "dosen_mengajar"
          ) {
            count++;
          }
        });
      }
    });

    return count;
  };

  // Function untuk mendapatkan detail assignment per dosen (HANYA dosen_mengajar)
  const getAssignmentDetails = (dosenId: number) => {
    const details: string[] = [];
    const uniqueMataKuliah = new Set<string>(); // Untuk deduplikasi

    // PERBAIKAN: Ambil data langsung dari assignmentData yang sudah include pbl.mataKuliah
    Object.entries(assignmentData).forEach(
      ([pblId, assignments]: [string, any[]]) => {
        if (Array.isArray(assignments)) {
          assignments.forEach((assignment: any) => {
            // PERBAIKAN: Cek dosen_id dari assignment.dosen atau assignment.id
            const assignmentDosenId = assignment.dosen?.id || assignment.id;
            const assignmentRole = assignment.role || assignment.pbl_role;

            // PERBAIKAN: Hanya ambil yang role === "dosen_mengajar"
            if (
              assignmentDosenId === dosenId &&
              assignmentRole === "dosen_mengajar"
            ) {
              // PERBAIKAN: Ambil mata kuliah langsung dari assignment.pbl.mataKuliah
              const mataKuliah = assignment.pbl?.mataKuliah;

              if (mataKuliah) {
                const mataKuliahKey = `${mataKuliah.kode}_${mataKuliah.semester}_${mataKuliah.blok}`;

                // Deduplikasi: hanya tambahkan jika belum ada
                if (!uniqueMataKuliah.has(mataKuliahKey)) {
                  uniqueMataKuliah.add(mataKuliahKey);

                  // Format: "Nama Mata Kuliah | Semester X | Blok Y"
                  let detailText =
                    mataKuliah.nama || "Mata Kuliah Tidak Diketahui";

                  if (mataKuliah.semester) {
                    detailText += ` | Semester ${mataKuliah.semester}`;
                  }

                  if (mataKuliah.blok) {
                    detailText += ` | Blok ${mataKuliah.blok}`;
                  }

                  details.push(detailText);
                }
              } else {
                // Fallback jika mataKuliah tidak ada (seharusnya tidak terjadi)
                const fallbackKey = `pbl_${pblId}`;
                if (!uniqueMataKuliah.has(fallbackKey)) {
                  uniqueMataKuliah.add(fallbackKey);
                  details.push("Dosen Mengajar PBL");
                }
              }
            }
          });
        }
      }
    );

    return details;
  };

  // Function untuk mendapatkan detail assignment per dosen (OLD - DEPRECATED)
  const getAssignmentDetailsOLD = (dosenId: number) => {
    const details: string[] = [];
    const uniqueMataKuliah = new Set<string>();

    // Dapatkan mata kuliah yang sudah di-assign sebagai Tim Blok atau Koordinator
    const excludedMataKuliah = new Set<string>();
    const dosen = data.find((d) => d.id === dosenId);
    if (dosen?.dosen_peran) {
      dosen.dosen_peran.forEach((peran) => {
        if (
          peran.tipe_peran === "tim_blok" ||
          peran.tipe_peran === "koordinator"
        ) {
          excludedMataKuliah.add(peran.mata_kuliah_kode);
        }
      });
    }

    // GUNAKAN PBL MAPPING - Dosen Mengajar di-generate dari PBL assignment
    // PERBAIKAN: Gunakan data yang sama dengan PBL-detail.tsx untuk konsistensi
    Object.entries(assignmentData).forEach(([pblId, dosenList]) => {
      dosenList.forEach((dosen: { id: number }) => {
        if (dosen.id === dosenId) {
          // PERBAIKAN: Gunakan data yang sama dengan PBL-detail.tsx
          const pblIdNum = parseInt(pblId);
          let mataKuliahKode = "";
          let semester = 1;
          let blok = 1;

          // Cari di data PBL yang sudah di-fetch (sama seperti PBL-detail.tsx)
          if (pblData && Object.keys(pblData).length > 0) {
            // Loop melalui semua mata kuliah untuk mencari PBL yang sesuai
            Object.entries(pblData).forEach(([mkKode, pblList]) => {
              // PERBAIKAN: Tambah null check dan type safety
              if (!pblList || !Array.isArray(pblList)) {
                return; // Skip jika bukan array
              }

              const pbls = pblList as any[];
              const foundPBL = pbls.find((pbl) => pbl && pbl.id === pblIdNum);

              if (foundPBL) {
                // PERBAIKAN: Gunakan data yang sama dengan PBL-detail.tsx
                // Ambil data mata kuliah dari matkulList (filter hanya yang Blok)
                const mataKuliah = matkulList
                  .filter((mk) => mk.jenis === "Blok")
                  .find((mk) => mk.kode === mkKode);

                if (mataKuliah) {
                  mataKuliahKode = mataKuliah.kode;
                  semester = mataKuliah.semester;
                  blok = mataKuliah.blok || 1;
                }
              }
            });
          }

          // PERBAIKAN: Jika tidak ditemukan, gunakan data dari backend yang sudah benar
          if (!mataKuliahKode) {
            // Coba ambil dari data yang sudah ada di backend
            // Ini akan menggunakan data yang sama dengan PBL-detail.tsx
            const backendMataKuliah = matkulList
              .filter((mk) => mk.jenis === "Blok")
              .find((mk) => {
                // PERBAIKAN: Tambah null check dan type safety
                const pbls = pblData[mk.kode];
                if (!pbls || !Array.isArray(pbls)) {
                  return false; // Skip jika bukan array
                }
                return pbls.some((pbl: any) => pbl && pbl.id === pblIdNum);
              });

            if (backendMataKuliah) {
              mataKuliahKode = backendMataKuliah.kode;
              semester = backendMataKuliah.semester;
              blok = backendMataKuliah.blok || 1;
            } else {
              // PERBAIKAN: Fallback mapping yang benar sesuai dengan data yang di-generate
              // PBL ID = Blok number, semester = dari data yang sebenarnya
              if (pblIdNum >= 1 && pblIdNum <= 4) {
                // Jika PBL ID 1-4, berarti blok 1-4, tapi semester harus dari data yang sebenarnya
                // JANGAN hardcode semester, gunakan data yang ada
                mataKuliahKode = `MKB10${pblIdNum}`; // Format kode mata kuliah
                blok = pblIdNum; // Blok = PBL ID
                // Semester harus dari data yang sebenarnya, bukan hardcode
              }
            }
          }

          // Hanya tambahkan jika mata kuliah belum ada dan tidak di-exclude
          if (
            mataKuliahKode &&
            !uniqueMataKuliah.has(mataKuliahKode) &&
            !excludedMataKuliah.has(mataKuliahKode)
          ) {
            uniqueMataKuliah.add(mataKuliahKode);
            const matkulNama = getMataKuliahNama(mataKuliahKode);

            // PERBAIKAN: Tambahkan informasi keahlian ke detail assignment
            const dosen = data.find((d) => d.id === dosenId);
            const mataKuliah = matkulList.find(
              (mk) => mk.kode === mataKuliahKode
            );
            let keahlianInfo = "";

            if (dosen && mataKuliah) {
              const dosenKeahlian = Array.isArray(dosen.keahlian)
                ? dosen.keahlian
                : (dosen.keahlian || "").split(",").map((k) => k.trim());
              const requiredKeahlian = mataKuliah.keahlian_required || [];

              // Check if dosen is standby
              const isStandby = dosenKeahlian.some((k) =>
                k.toLowerCase().includes("standby")
              );

              if (isStandby) {
                keahlianInfo = " (Standby)";
              } else {
                // Check if keahlian matches
                const isKeahlianMatch = requiredKeahlian.some((req) =>
                  dosenKeahlian.some((dosenKeahlian) => {
                    const reqLower = req.toLowerCase();
                    const dosenKeahlianLower = dosenKeahlian.toLowerCase();
                    return (
                      dosenKeahlianLower.includes(reqLower) ||
                      reqLower.includes(dosenKeahlianLower) ||
                      reqLower
                        .split(" ")
                        .some((word) => dosenKeahlianLower.includes(word)) ||
                      dosenKeahlianLower
                        .split(" ")
                        .some((word) => reqLower.includes(word))
                    );
                  })
                );

                if (!isKeahlianMatch) {
                  keahlianInfo = " (Keahlian tidak sesuai)";
                }
              }
            }

            const detail = `${mataKuliahKode} - ${matkulNama} Semester ${semester} | Blok ${blok}${keahlianInfo}`;
            details.push(detail);
          } else {
          }
        }
      });
    });

    return details;
  };

  // Fetch assignment data saat component mount
  useEffect(() => {
    fetchAssignmentData();

    // PERBAIKAN: Pastikan pblData dan matkulList ter-fetch

    fetchSemesterAndMatkul();
  }, []);

  // Fetch data dosen saat component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        // Request dengan per_page besar untuk mendapatkan semua data
        const res = await api.get("/users?role=dosen&per_page=1000");
        
        // Handle pagination response: res.data bisa berupa array atau pagination object
        const usersData = Array.isArray(res.data) 
          ? res.data 
          : (res.data?.data || []);
        
        setData(usersData);

        // Fetch assignment data juga saat load pertama
        await fetchAssignmentData();
      } catch (error) {
        setError("Gagal memuat data dosen");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Event listener untuk update real-time saat assignment berubah
  useEffect(() => {
    const handleAssignmentUpdate = () => {
      fetchAssignmentData();
    };

    // Listen untuk event dari PBL-detail.tsx
    window.addEventListener("pbl-assignment-updated", handleAssignmentUpdate);

    // Listen untuk event dari PBLGenerate.tsx
    window.addEventListener("pbl-generate-completed", handleAssignmentUpdate);

    return () => {
      window.removeEventListener(
        "pbl-assignment-updated",
        handleAssignmentUpdate
      );
      window.removeEventListener(
        "pbl-generate-completed",
        handleAssignmentUpdate
      );
    };
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4">
        Daftar Dosen
      </h1>
      {/* Baris 1: Action Buttons */}
      <div className="flex flex-wrap gap-2 mb-6">
        <button
          onClick={() => {
            // Reset modalError saat membuka modal input baru
            setModalError("");
            setShowModal(true);
            setEditMode(false);
          }}
          className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"
        >
          Input Data
        </button>
        <label className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-200 text-sm font-medium shadow-theme-xs hover:bg-green-200 dark:hover:bg-green-800 transition cursor-pointer">
          <FontAwesomeIcon
            icon={faFileExcel}
            className="w-5 h-5 text-green-700 dark:text-green-200"
          />
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
      {/* Preview Data Section (above search bar and filters) */}
      {importedFile && (
        <div className="w-full mb-6">
          <div className="mb-2 text-sm text-gray-700 dark:text-gray-200 font-semibold">
            Preview Data:{" "}
            <span className="font-normal text-gray-500 dark:text-gray-400">
              {importedFile.name}
            </span>
          </div>
          {/* Error di atas tabel preview, hanya tampil jika ada validationErrors atau cellErrors */}
          {(validationErrors.length > 0 || cellErrors.length > 0) && (
            <div className="mb-4">
              <div className="bg-red-100 rounded-md p-3">
                <div className="text-base font-semibold text-red-500 mb-1">
                  {importedCount > 0
                    ? "Sebagian data gagal diimpor karena tidak valid:"
                    : "Semua data gagal diimpor. Periksa kembali format dan isian data:"}
                </div>
                {/* Tampilkan error cell detail jika ada cellErrors, jika tidak fallback ke validationErrors */}
                <ul className="list-disc pl-5 text-sm text-red-600">
                  {cellErrors.length > 0
                    ? cellErrors.map((err, idx) => (
                        <li key={idx}>
                          {err.message} (Baris {err.row + 2}, Kolom{" "}
                          {err.field.toUpperCase()}):{" "}
                          {previewData.find((r) => r.nid === err.nid)?.[
                            err.field
                          ] || ""}
                        </li>
                      ))
                    : validationErrors.map((err, idx) => (
                        <li key={idx}>{err}</li>
                      ))}
                </ul>
              </div>
            </div>
          )}
          {/* Table Preview dengan style dan pagination sama seperti table dosen utama */}
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03] mb-4">
            <div
              className="max-w-full overflow-x-auto"
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
                    {previewData[0] &&
                      Object.keys(previewData[0]).map((colKey) => (
                        <th
                          key={colKey}
                          className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400"
                        >
                          {colKey
                            .replace(/_/g, " ")
                            .replace(/\b\w/g, (l) => l.toUpperCase())}
                        </th>
                      ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedPreviewData.map((row, i) => {
                    const globalRowIdx =
                      (previewPage - 1) * previewPageSize + i;
                    return (
                      <tr
                        key={i}
                        className={
                          i % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""
                        }
                      >
                        {previewData[0] &&
                          Object.keys(previewData[0]).map((colKey, _) => {
                            const isEditing =
                              editingCell?.row === globalRowIdx &&
                              editingCell?.key === colKey;
                            return (
                              <td
                                key={colKey}
                                className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 cursor-pointer ${
                                  cellErrors.some(
                                    (error) =>
                                      error.row === globalRowIdx &&
                                      error.field === colKey
                                  )
                                    ? "bg-red-100 dark:bg-red-900/30"
                                    : ""
                                }`}
                                title={
                                  cellErrors.find(
                                    (error) =>
                                      error.row === globalRowIdx &&
                                      error.field === colKey
                                  )?.message || ""
                                }
                                onClick={() =>
                                  setEditingCell({
                                    row: globalRowIdx,
                                    key: colKey,
                                  })
                                }
                              >
                                {isEditing ? (
                                  <input
                                    className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                    value={
                                      previewData[editingCell.row][
                                        editingCell.key
                                      ] || ""
                                    }
                                    onChange={(e) => {
                                      let val = e.target.value;
                                      if (
                                        [
                                          "nid",
                                          "nidn",
                                          "nuptk",
                                          "telepon",
                                        ].includes(colKey)
                                      ) {
                                        val = val.replace(/[^0-9-]/g, ""); // Allow dash for NID fields
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
            {/* Pagination Preview Table */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4">
              <div className="flex items-center gap-4">
                <select
                  id="previewPerPage"
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
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                  disabled={previewPage === 1}
                  className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  Prev
                </button>

                {/* Smart Pagination with Scroll for Preview */}
                <div
                  className="flex items-center gap-1 max-w-[400px] overflow-x-auto pagination-scroll"
                  style={{
                    scrollbarWidth: "thin",
                    scrollbarColor: "#cbd5e1 #f1f5f9",
                  }}
                >
                  {/* Always show first page */}
                  <button
                    onClick={() => setPreviewPage(1)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                      previewPage === 1
                        ? "bg-brand-500 text-white"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    1
                  </button>

                  {/* Show ellipsis if current page is far from start */}
                  {previewPage > 4 && (
                    <span className="px-2 text-gray-500 dark:text-gray-400">
                      ...
                    </span>
                  )}

                  {/* Show pages around current page */}
                  {Array.from({ length: previewTotalPages }, (_, i) => {
                    const pageNum = i + 1;
                    // Show pages around current page (2 pages before and after)
                    const shouldShow =
                      pageNum > 1 &&
                      pageNum < previewTotalPages &&
                      pageNum >= previewPage - 2 &&
                      pageNum <= previewPage + 2;

                    if (!shouldShow) return null;

                    return (
                      <button
                        key={i}
                        onClick={() => setPreviewPage(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                          previewPage === pageNum
                            ? "bg-brand-500 text-white"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {/* Show ellipsis if current page is far from end */}
                  {previewPage < previewTotalPages - 3 && (
                    <span className="px-2 text-gray-500 dark:text-gray-400">
                      ...
                    </span>
                  )}

                  {/* Always show last page if it's not the first page */}
                  {previewTotalPages > 1 && (
                    <button
                      onClick={() => setPreviewPage(previewTotalPages)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                        previewPage === previewTotalPages
                          ? "bg-brand-500 text-white"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {previewTotalPages}
                    </button>
                  )}
                </div>

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
          <div className="flex gap-2">
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
      {error && (
        <div className="bg-red-100 rounded-md p-3 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {/* Baris 2: Search Bar dan Filter Dropdowns */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 mb-6">
        {/* Search Bar */}
        <div className="relative w-full lg:w-auto lg:flex-1 lg:max-w-md">
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
        {/* Filter Dropdowns */}
        <div className="flex flex-wrap gap-2">
          <Listbox
            value={filterKompetensi}
            onChange={handleFilterKompetensiChange}
            multiple
          >
            {({ open }) => (
              <div className="relative w-full sm:w-[180px] md:w-[200px]">
                <Listbox.Button className="relative h-11 w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-theme-xs focus:outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-300 sm:text-sm">
                  <span className="block truncate">
                    {filterKompetensi.length === 0
                      ? "Semua Kompetensi"
                      : filterKompetensi.join(", ")}
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
                  className="absolute z-50 mt-1 w-full overflow-auto rounded-md bg-gray-50 dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm max-h-60 hide-scroll"
                >
                  <Listbox.Option
                    className={({ active }) =>
                      `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                        active
                          ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                          : "text-gray-900 dark:text-gray-100"
                      }`
                    }
                    value="all_kompetensi" // Changed value to a string
                  >
                    {({ selected: _selected }) => (
                      <div className="flex items-center justify-between">
                        <span
                          className={`block truncate ${
                            filterKompetensi.length === 0
                              ? "font-medium"
                              : "font-normal" // Check if filterKompetensi is empty for 'selected' state
                          }`}
                        >
                          Semua Kompetensi
                        </span>
                        <button
                          type="button"
                          aria-checked={filterKompetensi.length === 0} // Check if filterKompetensi is empty for aria-checked
                          role="checkbox"
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500
                            ${
                              filterKompetensi.length === 0
                                ? "bg-brand-500 border-brand-500"
                                : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"
                            }
                            cursor-pointer`}
                        >
                          {filterKompetensi.length === 0 && (
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
                      </div>
                    )}
                  </Listbox.Option>
                  {uniqueKompetensiOptions.map((kompetensi, kompetensiIdx) => (
                    <Listbox.Option
                      key={kompetensiIdx}
                      className={({ active }) =>
                        `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                          active
                            ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                            : "text-gray-900 dark:text-gray-100"
                        }`
                      }
                      value={kompetensi}
                    >
                      {({ selected: _selected }) => (
                        <div className="flex items-center justify-between">
                          <span
                            className={`block truncate ${
                              _selected ? "font-medium" : "font-normal"
                            }`}
                          >
                            {kompetensi}
                          </span>
                          {/* Render checkbox only if this option is selected AND 'all_kompetensi' is NOT selected */}
                          {_selected && filterKompetensi.length > 0 && (
                            <button
                              type="button"
                              aria-checked={_selected}
                              role="checkbox"
                              className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500
                                ${
                                  _selected
                                    ? "bg-brand-500 border-brand-500"
                                    : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"
                                }
                                cursor-pointer`}
                            >
                              {_selected && (
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
                          )}
                        </div>
                      )}
                    </Listbox.Option>
                  ))}
                </Transition>
              </div>
            )}
          </Listbox>
          <Listbox
            value={filterKeahlian}
            onChange={handleFilterKeahlianChange}
            multiple
          >
            {({ open }) => (
              <div className="relative w-full sm:w-[180px] md:w-[200px]">
                <Listbox.Button className="relative h-11 w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-theme-xs focus:outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-300 sm:text-sm">
                  <span className="block truncate">
                    {filterKeahlian.length === 0
                      ? "Semua Keahlian"
                      : filterKeahlian
                          .map((k) =>
                            typeof k === "string"
                              ? k.replace(/^\[|\]$/g, "")
                              : String(k)
                          )
                          .join(", ")}
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
                  className="absolute z-50 mt-1 w-full overflow-auto rounded-md bg-gray-50 dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm max-h-60 hide-scroll"
                >
                  <Listbox.Options static>
                    <Listbox.Option
                      className={({ active }) =>
                        `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                          active
                            ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                            : "text-gray-900 dark:text-gray-100"
                        }`
                      }
                      value="all_keahlian"
                    >
                      {({ selected: _selected }) => (
                        <div className="flex items-center justify-between">
                          <span
                            className={`block truncate ${
                              filterKeahlian.length === 0
                                ? "font-medium"
                                : "font-normal"
                            }`}
                          >
                            Semua Keahlian
                          </span>
                          <button
                            type="button"
                            aria-checked={filterKeahlian.length === 0}
                            role="checkbox"
                            className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                              filterKeahlian.length === 0
                                ? "bg-brand-500 border-brand-500"
                                : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"
                            } cursor-pointer`}
                          >
                            {filterKeahlian.length === 0 && (
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
                        </div>
                      )}
                    </Listbox.Option>
                    {uniqueKeahlianOptions.map((keahlian, idx) => (
                      <Listbox.Option
                        key={idx}
                        className={({ active }) =>
                          `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                            active
                              ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                              : "text-gray-900 dark:text-gray-100"
                          }`
                        }
                        value={keahlian}
                      >
                        {({ selected: _selected }) => (
                          <div className="flex items-center justify-between">
                            <span
                              className={`block truncate ${
                                _selected ? "font-medium" : "font-normal"
                              }`}
                            >
                              {keahlian}
                            </span>
                            {_selected && filterKeahlian.length > 0 && (
                              <button
                                type="button"
                                aria-checked={_selected}
                                role="checkbox"
                                className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                                  _selected
                                    ? "bg-brand-500 border-brand-500"
                                    : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"
                                } cursor-pointer`}
                              >
                                {_selected && (
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
                            )}
                          </div>
                        )}
                      </Listbox.Option>
                    ))}
                  </Listbox.Options>
                </Transition>
              </div>
            )}
          </Listbox>
          <Listbox
            value={filterStatus}
            onChange={(value) => {
              setFilterStatus(value as "all" | "standby" | "reguler");
              setPage(1); // Reset page saat filter berubah
            }}
          >
            {({ open }) => (
              <div className="relative w-full sm:w-[180px] md:w-[200px]">
                <Listbox.Button className="relative h-11 w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-theme-xs focus:outline-none focus-visible:border-brand-500 focus-visible:ring-2 focus-visible:ring-white/75 focus-visible:ring-offset-2 focus-visible:ring-offset-brand-300 sm:text-sm">
                  <span className="block truncate">
                    {filterStatus === "all"
                      ? "Semua Kategori"
                      : filterStatus === "standby"
                      ? "Standby"
                      : "Reguler"}
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
                  className="absolute z-50 mt-1 w-full overflow-auto rounded-md bg-gray-50 dark:bg-gray-800 py-1 text-base shadow-lg ring-1 ring-black/5 focus:outline-none sm:text-sm max-h-60 hide-scroll"
                >
                  <Listbox.Options static>
                    <Listbox.Option
                      className={({ active }) =>
                        `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                          active
                            ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                            : "text-gray-900 dark:text-gray-100"
                        }`
                      }
                      value="all"
                    >
                      {({ selected }) => (
                        <div className="flex items-center justify-between">
                          <span
                            className={`block truncate ${
                              selected ? "font-medium" : "font-normal"
                            }`}
                          >
                            Semua Kategori
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
                    <Listbox.Option
                      className={({ active }) =>
                        `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                          active
                            ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                            : "text-gray-900 dark:text-gray-100"
                        }`
                      }
                      value="standby"
                    >
                      {({ selected }) => (
                        <div className="flex items-center justify-between">
                          <span
                            className={`block truncate ${
                              selected ? "font-medium" : "font-normal"
                            }`}
                          >
                            Standby
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
                    <Listbox.Option
                      className={({ active }) =>
                        `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                          active
                            ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                            : "text-gray-900 dark:text-gray-100"
                        }`
                      }
                      value="reguler"
                    >
                      {({ selected }) => (
                        <div className="flex items-center justify-between">
                          <span
                            className={`block truncate ${
                              selected ? "font-medium" : "font-normal"
                            }`}
                          >
                            Reguler
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
                  </Listbox.Options>
                </Transition>
              </div>
            )}
          </Listbox>
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
            {importedCount} data dosen berhasil diimpor ke database.
          </motion.div>
        )}
      </AnimatePresence>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div
          className="max-w-full overflow-x-auto"
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
                      filteredAndSearchedData.length > 0 &&
                      filteredAndSearchedData.every((d) =>
                        selectedRows.includes(String(d.id || d.nid))
                      )
                    }
                    role="checkbox"
                    onClick={() => {
                      if (
                        filteredAndSearchedData.length > 0 &&
                        filteredAndSearchedData.every((d) =>
                          selectedRows.includes(String(d.id || d.nid))
                        )
                      ) {
                        setSelectedRows([]);
                      } else {
                        setSelectedRows(
                          filteredAndSearchedData.map((d) =>
                            String(d.id || d.nid)
                          )
                        );
                      }
                    }}
                    className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                      filteredAndSearchedData.length > 0 &&
                      filteredAndSearchedData.every((d) =>
                        selectedRows.includes(String(d.id || d.nid))
                      )
                        ? "bg-brand-500 border-brand-500"
                        : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"
                    } cursor-pointer`}
                  >
                    {filteredAndSearchedData.length > 0 &&
                      filteredAndSearchedData.every((d) =>
                        selectedRows.includes(String(d.id || d.nid))
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
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">
                  NID / NIDN / NUPTK
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">
                  Nama
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">
                  Username
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">
                  Email
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">
                  No. Telepon
                </th>
                <th className="px-3 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 w-32">
                  Tanda Tangan
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">
                  Kompetensi
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">
                  Keahlian
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">
                  Mata Kuliah/Peran Kurikulum
                </th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                // Skeleton loading: tampilkan 5 baris skeleton
                Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    {/* Checkbox */}
                    <td className="px-4 py-4">
                      <div className="w-5 h-5 rounded-md bg-gray-200 dark:bg-gray-700" />
                    </td>
                    {/* NID / NIDN / NUPTK */}
                    <td className="px-6 py-4">
                      <div className="h-4 w-48 rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                    {/* Nama */}
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                    {/* Username */}
                    <td className="px-6 py-4">
                      <div className="h-4 w-24 rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                    {/* Email */}
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                    {/* Telp */}
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                    {/* Tanda Tangan */}
                    <td className="px-3 py-4">
                      <div className="h-6 w-12 rounded bg-gray-200 dark:bg-gray-700 mx-auto" />
                    </td>
                    {/* Kompetensi */}
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                    {/* Keahlian */}
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                    {/* Peran Kurikulum */}
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                    {/* Peran Utama */}
                    <td className="px-6 py-4">
                      <div className="h-4 w-20 rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                    {/* Matkul/Peran Kurikulum */}
                    <td className="px-6 py-4">
                      <div className="h-4 w-32 rounded bg-gray-200 dark:bg-gray-700" />
                    </td>
                    {/* Aksi */}
                    <td className="px-6 py-4 text-center">
                      <div className="h-8 w-16 rounded bg-gray-200 dark:bg-gray-700 mx-auto" />
                    </td>
                  </tr>
                ))
              ) : paginatedData.length > 0 ? (
                paginatedData.map((d, idx) => (
                  <tr
                    key={d.nid}
                    className={
                      idx % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""
                    }
                  >
                    <td className="px-4 py-4">
                      <button
                        type="button"
                        aria-checked={selectedRows.includes(
                          String(d.id || d.nid)
                        )}
                        role="checkbox"
                        onClick={() => {
                          if (selectedRows.includes(String(d.id || d.nid))) {
                            setSelectedRows(
                              selectedRows.filter(
                                (id) => id !== String(d.id || d.nid)
                              )
                            );
                          } else {
                            setSelectedRows([
                              ...selectedRows,
                              String(d.id || d.nid),
                            ]);
                          }
                        }}
                        className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-brand-500 ${
                          selectedRows.includes(String(d.id || d.nid))
                            ? "bg-brand-500 border-brand-500"
                            : "bg-white border-gray-300 dark:bg-gray-900 dark:border-gray-700"
                        } cursor-pointer`}
                      >
                        {selectedRows.includes(String(d.id || d.nid)) && (
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
                      {(() => {
                        // NID, NIDN, dan NUPTK wajib ada (dengan "-" jika kosong di database)
                        const nid = d.nid || "-";
                        const nidn = d.nidn || "-";
                        const nuptk = d.nuptk || "-";

                        return `${nid} / ${nidn} / ${nuptk}`;
                      })()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">
                      {d.name || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">
                      {d.username || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle">
                      {d.email || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300 align-middle min-w-[120px]">
                      {d.telp || "-"}
                    </td>
                    {/* Kolom Tanda Tangan */}
                    <td className="px-3 py-4 text-center align-middle w-32">
                      {d.signature_image ? (
                        <button
                          onClick={() => {
                            setSelectedSignature(d.signature_image);
                            setSelectedDosenName(d.name || "-");
                            setShowSignatureModal(true);
                          }}
                          className="inline-flex items-center justify-center px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 border border-blue-200 dark:border-blue-700 rounded hover:bg-blue-50 dark:hover:bg-blue-900/20 transition whitespace-nowrap"
                          title="Klik untuk melihat tanda tangan"
                        >
                          <FontAwesomeIcon
                            icon={faEye}
                            className="w-3 h-3 mr-1"
                          />
                          TTD
                        </button>
                      ) : (
                        <span className="text-xs text-gray-400 dark:text-gray-500 italic">
                          -
                        </span>
                      )}
                    </td>
                    {/* Kolom Kompetensi */}
                    <td className="px-6 py-4 whitespace-pre-line text-gray-700 dark:text-gray-300 align-middle min-w-[200px]">
                      {(() => {
                        let val = d.kompetensi;
                        if (!val) return "-";
                        if (Array.isArray(val)) return val.join(", ");
                        try {
                          const arr = JSON.parse(val);
                          return Array.isArray(arr)
                            ? arr.join(", ")
                            : String(val);
                        } catch {
                          return String(val);
                        }
                      })()}
                    </td>
                    {/* Kolom Keahlian */}
                    <td className="px-6 py-4 whitespace-pre-line text-gray-700 dark:text-gray-300 align-middle min-w-[200px]">
                      {(() => {
                        let val = d.keahlian;
                        if (!val) return "-";
                        if (Array.isArray(val)) return val.join(", ");
                        try {
                          const arr = JSON.parse(val);
                          return Array.isArray(arr)
                            ? arr.join(", ")
                            : String(val);
                        } catch {
                          return String(val);
                        }
                      })()}
                    </td>
                    {/* Kolom Mata Kuliah/Peran Kurikulum */}
                    <td className="px-6 py-4 align-top min-w-[300px]">
                      {/* Koordinator Badge */}
                      {(() => {
                        const koordinatorPeran = Array.isArray(d.dosen_peran)
                          ? d.dosen_peran
                              .filter((p) => p.tipe_peran === "koordinator")
                              .filter(
                                (p, index, self) =>
                                  // HILANGKAN DUPLIKASI: Unique berdasarkan kombinasi mata_kuliah_kode + blok + semester
                                  index ===
                                  self.findIndex(
                                    (peran) =>
                                      peran.mata_kuliah_kode ===
                                        p.mata_kuliah_kode &&
                                      String(peran.blok || "") ===
                                        String(p.blok || "") &&
                                      String(peran.semester || "") ===
                                        String(p.semester || "")
                                  )
                              )
                          : [];

                        if (koordinatorPeran.length > 0) {
                          const rowKey = `${d.id || d.nid}_koordinator`;
                          const isExpanded = !!expandedGroups[rowKey];
                          const isShowAll = !!showAllPeran[rowKey];
                          const peranToShow = isShowAll
                            ? koordinatorPeran
                            : koordinatorPeran.slice(0, 2);
                          const hasMore = koordinatorPeran.length > 2;

                          return (
                            <div className="mb-3">
                              <button
                                type="button"
                                className="px-2 py-1 rounded text-xs font-semibold bg-blue-100 text-blue-700 focus:outline-none cursor-pointer flex items-center gap-1"
                                onClick={() => toggleGroup(rowKey)}
                                title="Klik untuk buka/tutup detail"
                              >
                                Koordinator ({koordinatorPeran.length})
                                <FontAwesomeIcon
                                  icon={
                                    isExpanded ? faChevronUp : faChevronDown
                                  }
                                  className="ml-1 w-3 h-3"
                                />
                              </button>
                              {isExpanded && (
                                <ul className="ml-0 mt-2 flex flex-col gap-2">
                                  {peranToShow.map((p, idx) => (
                                    <li
                                      key={idx}
                                      className="flex items-start gap-2 bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 transition"
                                    >
                                      <FontAwesomeIcon
                                        icon={faBookOpen}
                                        className="text-blue-400 mt-1 w-3 h-3"
                                      />
                                      <div>
                                        <div className="font-medium text-brand-400">
                                          {getMataKuliahNama(
                                            p.mata_kuliah_kode
                                          )}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          Semester {p.semester} | Blok {p.blok}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {p.peran_kurikulum ||
                                            (p.tipe_peran === "koordinator"
                                              ? "Koordinator"
                                              : p.tipe_peran === "tim_blok"
                                              ? "Tim Blok"
                                              : "-")}
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                  {hasMore && !isShowAll && (
                                    <li className="mt-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setShowAllPeran((prev) => ({
                                            ...prev,
                                            [rowKey]: true,
                                          }))
                                        }
                                        className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                                      >
                                        Tampilkan {koordinatorPeran.length - 2}{" "}
                                        lagi...
                                      </button>
                                    </li>
                                  )}
                                  {hasMore && isShowAll && (
                                    <li className="mt-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setShowAllPeran((prev) => ({
                                            ...prev,
                                            [rowKey]: false,
                                          }))
                                        }
                                        className="text-xs text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 font-medium"
                                      >
                                        Sembunyikan
                                      </button>
                                    </li>
                                  )}
                                </ul>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Tim Blok Badge */}
                      {(() => {
                        const timBlokPeran = Array.isArray(d.dosen_peran)
                          ? d.dosen_peran
                              .filter((p) => p.tipe_peran === "tim_blok")
                              .filter(
                                (p, index, self) =>
                                  // HILANGKAN DUPLIKASI: Unique berdasarkan kombinasi mata_kuliah_kode + blok + semester
                                  index ===
                                  self.findIndex(
                                    (peran) =>
                                      peran.mata_kuliah_kode ===
                                        p.mata_kuliah_kode &&
                                      String(peran.blok || "") ===
                                        String(p.blok || "") &&
                                      String(peran.semester || "") ===
                                        String(p.semester || "")
                                  )
                              )
                          : [];

                        if (timBlokPeran.length > 0) {
                          const rowKey = `${d.id || d.nid}_tim_blok`;
                          const isExpanded = !!expandedGroups[rowKey];
                          const isShowAll = !!showAllPeran[rowKey];
                          const peranToShow = isShowAll
                            ? timBlokPeran
                            : timBlokPeran.slice(0, 2);
                          const hasMore = timBlokPeran.length > 2;

                          return (
                            <div className="mb-3">
                              <button
                                type="button"
                                className="px-2 py-1 rounded text-xs font-semibold bg-green-100 text-green-700 focus:outline-none cursor-pointer flex items-center gap-1"
                                onClick={() => toggleGroup(rowKey)}
                                title="Klik untuk buka/tutup detail"
                              >
                                Tim Blok ({timBlokPeran.length})
                                <FontAwesomeIcon
                                  icon={
                                    isExpanded ? faChevronUp : faChevronDown
                                  }
                                  className="ml-1 w-3 h-3"
                                />
                              </button>
                              {isExpanded && (
                                <ul className="ml-0 mt-2 flex flex-col gap-2">
                                  {peranToShow.map((p, idx) => (
                                    <li
                                      key={idx}
                                      className="flex items-start gap-2 bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 transition"
                                    >
                                      <FontAwesomeIcon
                                        icon={faBookOpen}
                                        className="text-green-400 mt-1 w-3 h-3"
                                      />
                                      <div>
                                        <div className="font-medium text-brand-400">
                                          {getMataKuliahNama(
                                            p.mata_kuliah_kode
                                          )}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          Semester {p.semester} | Blok {p.blok}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                          {p.peran_kurikulum ||
                                            (p.tipe_peran === "koordinator"
                                              ? "Koordinator"
                                              : p.tipe_peran === "tim_blok"
                                              ? "Tim Blok"
                                              : "-")}
                                        </div>
                                      </div>
                                    </li>
                                  ))}
                                  {hasMore && !isShowAll && (
                                    <li className="mt-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setShowAllPeran((prev) => ({
                                            ...prev,
                                            [rowKey]: true,
                                          }))
                                        }
                                        className="text-xs text-green-500 hover:text-green-700 dark:hover:text-green-300 font-medium"
                                      >
                                        Tampilkan {timBlokPeran.length - 2}{" "}
                                        lagi...
                                      </button>
                                    </li>
                                  )}
                                  {hasMore && isShowAll && (
                                    <li className="mt-2">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setShowAllPeran((prev) => ({
                                            ...prev,
                                            [rowKey]: false,
                                          }))
                                        }
                                        className="text-xs text-green-500 hover:text-green-700 dark:hover:text-green-300 font-medium"
                                      >
                                        Sembunyikan
                                      </button>
                                    </li>
                                  )}
                                </ul>
                              )}
                            </div>
                          );
                        }
                        return null;
                      })()}

                      {/* Dosen Mengajar Badge - Ambil dari assignmentData seperti PBL-detail.tsx */}
                      {(() => {
                        // Ambil dari assignmentData seperti di PBL-detail.tsx
                        const dosenMengajarAssignments: Array<{
                          mata_kuliah_kode: string;
                          mata_kuliah_nama: string;
                          semester: number;
                          blok: number;
                        }> = [];
                        const uniqueAssignments = new Map(); // Deduplikasi berdasarkan mata_kuliah_kode + semester + blok

                        Object.entries(assignmentData).forEach(
                          ([pblIdStr, assignments]: [string, any]) => {
                            const pblId = parseInt(pblIdStr);
                            if (pblId && Array.isArray(assignments)) {
                              assignments.forEach((assignment: any) => {
                                const assignmentDosenId =
                                  assignment.dosen?.id || assignment.id;
                                const assignmentRole =
                                  assignment.role || assignment.pbl_role;

                                if (
                                  assignmentDosenId === d.id &&
                                  assignmentRole === "dosen_mengajar"
                                ) {
                                  // Ambil mata kuliah dari assignment.pbl.mataKuliah atau pblDataMap
                                  let mataKuliah = assignment.pbl?.mataKuliah;

                                  // Jika tidak ada di assignment.pbl, coba ambil dari pblDataMap
                                  if (!mataKuliah && pblId) {
                                    const pblData = pblDataMap[pblId];
                                    if (pblData && pblData.mataKuliah) {
                                      mataKuliah = pblData.mataKuliah;
                                    }
                                  }

                                  if (mataKuliah) {
                                    // Deduplikasi berdasarkan mata_kuliah_kode + semester + blok (salah satu saja)
                                    const key = `${mataKuliah.kode}-${mataKuliah.semester}-${mataKuliah.blok}`;
                                    if (!uniqueAssignments.has(key)) {
                                      uniqueAssignments.set(key, {
                                        mata_kuliah_kode: mataKuliah.kode,
                                        mata_kuliah_nama:
                                          mataKuliah.nama ||
                                          getMataKuliahNama(mataKuliah.kode),
                                        semester: mataKuliah.semester,
                                        blok: mataKuliah.blok,
                                      });
                                    }
                                  }
                                }
                              });
                            }
                          }
                        );

                        // Convert Map to Array
                        dosenMengajarAssignments.push(
                          ...Array.from(uniqueAssignments.values())
                        );

                        // Tampilkan badge meskipun 0 (seperti Koordinator dan Tim Blok)
                        const rowKey = `${d.id || d.nid}_mengajar`;
                        const isExpanded = !!expandedGroups[rowKey];
                        const isShowAll = !!showAllPeran[rowKey];
                        const peranToShow = isShowAll
                          ? dosenMengajarAssignments
                          : dosenMengajarAssignments.slice(0, 2);
                        const hasMore = dosenMengajarAssignments.length > 2;

                        return (
                          <div className="mb-3">
                            <button
                              type="button"
                              className="px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-700 focus:outline-none cursor-pointer flex items-center gap-1"
                              onClick={() => toggleGroup(rowKey)}
                              title="Klik untuk buka/tutup detail"
                            >
                              Dosen Mengajar ({dosenMengajarAssignments.length})
                              <FontAwesomeIcon
                                icon={isExpanded ? faChevronUp : faChevronDown}
                                className="ml-1 w-3 h-3"
                              />
                            </button>
                            {isExpanded && (
                              <ul className="ml-0 mt-2 flex flex-col gap-2">
                                {dosenMengajarAssignments.length > 0 ? (
                                  <>
                                    {peranToShow.map(
                                      (assignment, idx: number) => (
                                        <li
                                          key={idx}
                                          className="flex items-start gap-2 bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 transition"
                                        >
                                          <FontAwesomeIcon
                                            icon={faBookOpen}
                                            className="text-yellow-400 mt-1 w-3 h-3"
                                          />
                                          <div>
                                            <div className="font-medium text-brand-400">
                                              {assignment.mata_kuliah_nama}
                                            </div>
                                            <div className="text-xs text-gray-400">
                                              Semester {assignment.semester} |
                                              Blok {assignment.blok}
                                            </div>
                                            <div className="text-xs text-gray-500">
                                              Dosen Mengajar
                                            </div>
                                          </div>
                                        </li>
                                      )
                                    )}
                                    {hasMore && !isShowAll && (
                                      <li className="mt-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setShowAllPeran((prev) => ({
                                              ...prev,
                                              [rowKey]: true,
                                            }))
                                          }
                                          className="text-xs text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-300 font-medium"
                                        >
                                          Tampilkan{" "}
                                          {dosenMengajarAssignments.length - 2}{" "}
                                          lagi...
                                        </button>
                                      </li>
                                    )}
                                    {hasMore && isShowAll && (
                                      <li className="mt-2">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setShowAllPeran((prev) => ({
                                              ...prev,
                                              [rowKey]: false,
                                            }))
                                          }
                                          className="text-xs text-yellow-500 hover:text-yellow-700 dark:hover:text-yellow-300 font-medium"
                                        >
                                          Sembunyikan
                                        </button>
                                      </li>
                                    )}
                                  </>
                                ) : (
                                  <li className="flex items-start gap-2 bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 transition">
                                    <FontAwesomeIcon
                                      icon={faBookOpen}
                                      className="text-yellow-400 mt-1 w-3 h-3"
                                    />
                                    <div>
                                      <div className="font-medium text-green-600 dark:text-green-400">
                                        Belum ada assignment
                                      </div>
                                      <div className="text-xs text-gray-500">
                                        Dosen belum di-assign ke modul PBL
                                      </div>
                                    </div>
                                  </li>
                                )}
                              </ul>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                    {/* Kolom Aksi */}
                    <td className="px-6 py-4 whitespace-nowrap text-center align-middle">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleEdit(d)}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-brand-500 hover:text-brand-700 dark:hover:text-brand-300 transition"
                          title="Edit"
                        >
                          <FontAwesomeIcon
                            icon={faPenToSquare}
                            className="w-5 h-5"
                          />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(d.id!.toString())}
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition"
                          title="Delete"
                        >
                          <FontAwesomeIcon icon={faTrash} className="w-5 h-5" />
                          Delete
                        </button>
                        <button
                          onClick={() =>
                            navigate(`/dosen/${d.id || d.nid}/riwayat`)
                          }
                          className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 rounded transition focus:outline-none focus:ring-0"
                          title="Detail Riwayat"
                        >
                          <FontAwesomeIcon
                            icon={faBookOpen}
                            className="w-5 h-5"
                          />
                          Detail Riwayat
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={13}
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4">
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
              Menampilkan {paginatedData.length} dari{" "}
              {filteredAndSearchedData.length} data
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
      <div className="flex gap-2 mt-8">
        <button
          disabled={selectedRows.length === 0 || isDeleting}
          onClick={() => setShowDeleteModalBulk(true)}
          className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center justify-center transition ${
            selectedRows.length === 0 || isDeleting
              ? "bg-gray-200 text-gray-400 cursor-not-allowed"
              : "bg-red-500 text-white shadow-theme-xs hover:bg-red-600"
          }`}
        >
          {isDeleting
            ? "Menghapus..."
            : `Hapus Terpilih (${selectedRows.length})`}
        </button>
      </div>
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
              className="relative w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-3xl p-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
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
              <div className="flex items-center justify-between pb-6">
                <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                  {editMode ? "Edit Dosen" : "Tambah Dosen"}
                </h2>
              </div>
              <div>
                <form>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Nama */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Nama
                      </label>
                      <input
                        type="text"
                        name="name"
                        value={form.name}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    {/* Password */}
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Password
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? "text" : "password"}
                          name="password"
                          value={form.password || ""}
                          onChange={handleInputChange}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                          required={!editMode}
                          autoComplete="new-password"
                          placeholder={
                            editMode
                              ? "Kosongkan jika tidak ingin mengubah password"
                              : ""
                          }
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
                  {/* Username full width */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={form.username}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                    />
                  </div>
                  {/* NID, NIDN & NUPTK */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        NID
                      </label>
                      <input
                        type="text"
                        name="nid"
                        value={form.nid || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="Masukkan NID atau - jika belum ada"
                        autoComplete="off"
                        disabled={false}
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        NIDN
                      </label>
                      <input
                        type="text"
                        name="nidn"
                        value={form.nidn || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="Masukkan NIDN atau - jika belum ada"
                        autoComplete="off"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        NUPTK
                      </label>
                      <input
                        type="text"
                        name="nuptk"
                        value={form.nuptk || ""}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                        placeholder="Masukkan NUPTK atau - jika belum ada"
                        autoComplete="off"
                      />
                    </div>
                  </div>
                  {/* Email & Telepon */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Email
                      </label>
                      <input
                        type="email"
                        name="email"
                        value={form.email}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                        Nomor Telepon
                      </label>
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
                  </div>
                  <div className="mb-4">
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                        Status Dosen
                      </label>
                      <div className="flex items-center border border-gray-300 dark:border-gray-600 rounded-2xl w-fit px-1 py-1 bg-gray-100 dark:bg-[#181F2A]">
                        <button
                          type="button"
                          onClick={() => setPeranUtama("standby")}
                          className={`px-5 py-2 rounded-xl font-semibold text-sm transition focus:outline-none
        ${
          peranUtama === "standby"
            ? "bg-green-500 text-white dark:bg-green-500"
            : "bg-transparent text-gray-700 dark:text-white opacity-70"
        }`}
                          style={{ minWidth: 60 }}
                        >
                          Standby
                        </button>
                        <button
                          type="button"
                          onClick={() => setPeranUtama("aktif")}
                          className={`
        px-5 py-2 rounded-xl text-sm transition focus:outline-none
        font-semibold
        ${
          peranUtama === "aktif"
            ? "bg-green-500 text-white dark:bg-green-500"
            : "bg-transparent text-gray-700 dark:text-white opacity-70"
        }`}
                          style={{ minWidth: 60 }}
                        >
                          Aktif
                        </button>
                      </div>
                    </div>
                  </div>
                  {peranUtama === "aktif" && (
                    <>
                      <div className="mb-4">
                        <div className="space-y-6">
                          {/* Peran Selection */}
                          <div>
                            <div className="mb-2">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-2">
                                Peran Khusus
                              </label>
                              <Listbox
                                value={selectedPeranType}
                                onChange={setSelectedPeranType}
                              >
                                {({ open }) => (
                                  <div className="relative">
                                    <Listbox.Button className="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm">
                                      <span className="block truncate">
                                        {selectedPeranType === "none" &&
                                          "None (Dosen Mengajar)"}
                                        {selectedPeranType === "peran" &&
                                          "Peran"}
                                      </span>
                                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                        <FontAwesomeIcon
                                          icon={faChevronDown}
                                          className="h-5 w-5 text-gray-400"
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
                                        <Listbox.Option
                                          className={({ active }) =>
                                            `relative cursor-default select-none py-2 pl-4 pr-4 ${
                                              active
                                                ? "bg-brand-100 text-brand-900"
                                                : "text-gray-900 dark:text-gray-100"
                                            }`
                                          }
                                          value="none"
                                        >
                                          None (Dosen Mengajar)
                                        </Listbox.Option>
                                        <Listbox.Option
                                          className={({ active }) =>
                                            `relative cursor-default select-none py-2 pl-4 pr-4 ${
                                              active
                                                ? "bg-brand-100 text-brand-900"
                                                : "text-gray-900 dark:text-gray-100"
                                            }`
                                          }
                                          value="peran"
                                        >
                                          Peran
                                        </Listbox.Option>
                                      </Listbox.Options>
                                    </Transition>
                                  </div>
                                )}
                              </Listbox>
                            </div>
                            {/* Section-based Peran - hanya muncul jika peran bukan none */}
                            {selectedPeranType !== "none" && (
                              <div className="mb-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg w-full">
                                <div className="mb-3 flex items-center justify-between">
                                  <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
                                    Peran Kurikulum ({peranSections.length})
                                  </span>
                                  <button
                                    type="button"
                                    onClick={addPeranSection}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-brand-500 hover:bg-brand-600 rounded-lg transition"
                                  >
                                    <FontAwesomeIcon
                                      icon={faPlus}
                                      className="w-3 h-3"
                                    />
                                    Tambah Peran
                                  </button>
                                </div>

                                {/* List Sections */}
                                {peranSections.length === 0 ? (
                                  <div className="text-center py-6 text-sm text-gray-400 dark:text-gray-500">
                                    Belum ada peran. Klik "Tambah Peran" untuk
                                    menambahkan.
                                  </div>
                                ) : (
                                  <div className="space-y-3">
                                    {peranSections.map((section, index) => {
                                      const sectionOptions =
                                        getPeranKurikulumOptionsForSection(
                                          section.mataKuliahKode
                                        );
                                      const selectedPeranOption =
                                        sectionOptions.find(
                                          (opt) =>
                                            `${opt.mataKuliahKode}-${opt.originalName}-${opt.blok}-${opt.semester}` ===
                                            section.peranKurikulumKey
                                        );

                                      return (
                                        <div
                                          key={section.id}
                                          className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
                                        >
                                          <div className="flex items-start justify-between mb-2">
                                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                                              Peran {index + 1}
                                            </span>
                                            {peranSections.length > 1 && (
                                              <button
                                                type="button"
                                                onClick={() =>
                                                  removePeranSection(section.id)
                                                }
                                                className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition"
                                                title="Hapus peran ini"
                                              >
                                                <FontAwesomeIcon
                                                  icon={faTrash}
                                                  className="w-4 h-4"
                                                />
                                              </button>
                                            )}
                                          </div>

                                          {/* Pilih Blok (Mata Kuliah) */}
                                          <div className="mb-3">
                                            <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                                              Pilih Blok
                                            </label>
                                            <Listbox
                                              value={section.mataKuliahKode}
                                              onChange={(value) => {
                                                updatePeranSection(section.id, {
                                                  mataKuliahKode: value,
                                                  peranKurikulumKey: "", // Reset peran saat ganti blok
                                                });
                                              }}
                                            >
                                              {({ open }) => (
                                                <div className="relative">
                                                  <Listbox.Button className="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm">
                                                    <span className="block truncate">
                                                      {section.mataKuliahKode
                                                        ? (() => {
                                                            const matkul =
                                                              matkulList.find(
                                                                (mk) =>
                                                                  mk.kode ===
                                                                  section.mataKuliahKode
                                                              );
                                                            return matkul
                                                              ? `Blok ${matkul.blok}: ${matkul.nama}`
                                                              : section.mataKuliahKode;
                                                          })()
                                                        : "Pilih Blok"}
                                                    </span>
                                                    <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                                      <FontAwesomeIcon
                                                        icon={faChevronDown}
                                                        className="h-5 w-5 text-gray-400"
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
                                                      {(() => {
                                                        const blokMataKuliah =
                                                          matkulList
                                                            .filter(
                                                              (mk) =>
                                                                mk.jenis ===
                                                                "Blok"
                                                            )
                                                            .sort((a, b) => {
                                                              if (
                                                                a.semester !==
                                                                b.semester
                                                              )
                                                                return (
                                                                  a.semester -
                                                                  b.semester
                                                                );
                                                              return (
                                                                (a.blok || 0) -
                                                                (b.blok || 0)
                                                              );
                                                            });

                                                        const groupedBySemester =
                                                          blokMataKuliah.reduce(
                                                            (acc, mk) => {
                                                              if (
                                                                !acc[
                                                                  mk.semester
                                                                ]
                                                              )
                                                                acc[
                                                                  mk.semester
                                                                ] = [];
                                                              acc[
                                                                mk.semester
                                                              ].push(mk);
                                                              return acc;
                                                            },
                                                            {} as Record<
                                                              number,
                                                              typeof blokMataKuliah
                                                            >
                                                          );

                                                        return Object.entries(
                                                          groupedBySemester
                                                        ).map(
                                                          ([
                                                            semester,
                                                            mataKuliah,
                                                          ]) => (
                                                            <div key={semester}>
                                                              <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700">
                                                                Semester{" "}
                                                                {semester}
                                                              </div>
                                                              {mataKuliah.map(
                                                                (mk) => (
                                                                  <Listbox.Option
                                                                    key={
                                                                      mk.kode
                                                                    }
                                                                    className={({
                                                                      active,
                                                                    }) =>
                                                                      `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                                                                        active
                                                                          ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                                                                          : "text-gray-900 dark:text-gray-100"
                                                                      }`
                                                                    }
                                                                    value={
                                                                      mk.kode
                                                                    }
                                                                  >
                                                                    {({
                                                                      selected,
                                                                    }) => (
                                                                      <div className="flex items-center justify-between">
                                                                        <span
                                                                          className={`block truncate ${
                                                                            selected
                                                                              ? "font-medium"
                                                                              : "font-normal"
                                                                          }`}
                                                                        >
                                                                          Blok{" "}
                                                                          {
                                                                            mk.blok
                                                                          }
                                                                          :{" "}
                                                                          {
                                                                            mk.nama
                                                                          }
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
                                                                                strokeWidth={
                                                                                  2
                                                                                }
                                                                                d="M5 13l4 4L19 7"
                                                                              />
                                                                            </svg>
                                                                          </span>
                                                                        )}
                                                                      </div>
                                                                    )}
                                                                  </Listbox.Option>
                                                                )
                                                              )}
                                                            </div>
                                                          )
                                                        );
                                                      })()}
                                                    </Listbox.Options>
                                                  </Transition>
                                                </div>
                                              )}
                                            </Listbox>
                                          </div>

                                          {/* Pilih Peran Kurikulum */}
                                          {section.mataKuliahKode && (
                                            <div>
                                              <label className="block text-xs font-medium text-gray-700 dark:text-gray-200 mb-1">
                                                Pilih Peran Kurikulum
                                              </label>
                                              <Listbox
                                                value={
                                                  section.peranKurikulumKey
                                                }
                                                onChange={(value) => {
                                                  updatePeranSection(
                                                    section.id,
                                                    {
                                                      peranKurikulumKey: value,
                                                    }
                                                  );
                                                }}
                                              >
                                                {({ open }) => (
                                                  <div className="relative">
                                                    <Listbox.Button className="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm">
                                                      <span className="block truncate">
                                                        {selectedPeranOption
                                                          ? selectedPeranOption.originalName
                                                          : "Pilih Peran Kurikulum"}
                                                      </span>
                                                      <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
                                                        <FontAwesomeIcon
                                                          icon={faChevronDown}
                                                          className="h-5 w-5 text-gray-400"
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
                                                        {sectionOptions.length ===
                                                        0 ? (
                                                          <Listbox.Option
                                                            className="relative cursor-default select-none py-2.5 pl-4 pr-4 text-gray-400 dark:text-gray-500"
                                                            value=""
                                                            disabled
                                                          >
                                                            Tidak ada peran
                                                            kurikulum untuk blok
                                                            ini
                                                          </Listbox.Option>
                                                        ) : (
                                                          sectionOptions.map(
                                                            (peran) => {
                                                              // Cek konflik koordinator
                                                              const koordinatorConflict =
                                                                getKoordinatorConflict(
                                                                  peran
                                                                );
                                                              const peranKey = `${peran.mataKuliahKode}-${peran.originalName}-${peran.blok}-${peran.semester}`;
                                                              const isDisabled =
                                                                koordinatorConflict.isDisabled;

                                                              return (
                                                                <Listbox.Option
                                                                  key={peranKey}
                                                                  className={({
                                                                    active,
                                                                  }) =>
                                                                    `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                                                                      isDisabled
                                                                        ? "opacity-50 cursor-not-allowed text-gray-400 dark:text-gray-500"
                                                                        : active
                                                                        ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                                                                        : "text-gray-900 dark:text-gray-100"
                                                                    }`
                                                                  }
                                                                  value={
                                                                    peranKey
                                                                  }
                                                                  disabled={
                                                                    isDisabled
                                                                  }
                                                                >
                                                                  {({
                                                                    selected,
                                                                  }) => (
                                                                    <div className="flex items-center justify-between">
                                                                      <div className="flex flex-col">
                                                                        <span
                                                                          className={`block truncate ${
                                                                            selected
                                                                              ? "font-medium"
                                                                              : "font-normal"
                                                                          }`}
                                                                        >
                                                                          {
                                                                            peran.originalName
                                                                          }
                                                                        </span>
                                                                        {isDisabled &&
                                                                          koordinatorConflict.conflictDosenName && (
                                                                            <span className="text-xs text-orange-500 mt-1">
                                                                              (Sudah
                                                                              dipilih
                                                                              oleh:{" "}
                                                                              {
                                                                                koordinatorConflict.conflictDosenName
                                                                              }
                                                                              )
                                                                            </span>
                                                                          )}
                                                                      </div>
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
                                                                              strokeWidth={
                                                                                2
                                                                              }
                                                                              d="M5 13l4 4L19 7"
                                                                            />
                                                                          </svg>
                                                                        </span>
                                                                      )}
                                                                    </div>
                                                                  )}
                                                                </Listbox.Option>
                                                              );
                                                            }
                                                          )
                                                        )}
                                                      </Listbox.Options>
                                                    </Transition>
                                                  </div>
                                                )}
                                              </Listbox>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      {/* HILANGKAN Peran Mengajar - Dosen Mengajar di-generate otomatis */}
                    </>
                  )}
                  {peranUtama === "dosen_mengajar" && (
                    <div className="mb-4">
                      <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon
                            icon={faInfoCircle}
                            className="text-blue-500 w-4 h-4"
                          />
                          <span className="text-sm text-blue-700 dark:text-blue-300">
                            Peran kurikulum akan diisi otomatis saat dosen
                            di-assign ke modul PBL
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Info khusus untuk dosen standby */}
                  {peranUtama === "standby" && (
                    <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <svg
                          className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mt-0.5"
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
                        <div>
                          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                            📋 Dosen Standby
                          </h3>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            Dosen ini akan otomatis memiliki keahlian "Standby"
                            dan kompetensi kosong. Dosen standby siap untuk
                            di-assign ke modul PBL kapan saja.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Field kompetensi & keahlian hanya muncul jika bukan standby */}
                  {peranUtama !== "standby" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Kompetensi */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          Kompetensi
                        </label>
                        <Listbox
                          value={
                            Array.isArray(form.kompetensi)
                              ? form.kompetensi
                              : typeof form.kompetensi === "string"
                              ? (form.kompetensi || "")
                                  .split(",")
                                  .map((k) => k.trim())
                                  .filter((k) => k !== "")
                              : []
                          }
                          onChange={(newSelection) => {
                            // Cek apakah keahlian mengandung standby
                            const hasStandby = Array.isArray(form.keahlian)
                              ? form.keahlian.some(
                                  (k) => k.toLowerCase() === "standby"
                                )
                              : (form.keahlian || "")
                                  .toLowerCase()
                                  .includes("standby");

                            // Jika standby, kompetensi harus kosong
                            if (hasStandby) {
                              setForm((prev) => ({
                                ...prev,
                                kompetensi: [],
                              }));
                            } else {
                              setForm((prev) => ({
                                ...prev,
                                kompetensi: newSelection,
                              }));
                            }
                          }}
                          multiple
                          disabled={
                            Array.isArray(form.keahlian)
                              ? form.keahlian.some(
                                  (k) => k.toLowerCase() === "standby"
                                )
                              : typeof form.keahlian === "string"
                              ? (form.keahlian || "")
                                  .toLowerCase()
                                  .includes("standby")
                              : false
                          }
                        >
                          {({ open }) => (
                            <div className="relative">
                              <Listbox.Button className="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm">
                                <span className="block truncate">
                                  {Array.isArray(form.kompetensi) &&
                                  form.kompetensi.length === 0
                                    ? "Pilih Kompetensi"
                                    : Array.isArray(form.kompetensi)
                                    ? form.kompetensi.join(", ")
                                    : ""}
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
                                  {availableKompetensi.length === 0 ? (
                                    <Listbox.Option
                                      className="relative cursor-default select-none py-2.5 pl-4 pr-4 text-gray-400 dark:text-gray-500"
                                      value=""
                                      disabled
                                    >
                                      Belum ada kompetensi
                                    </Listbox.Option>
                                  ) : (
                                    availableKompetensi.map((kompetensi) => (
                                      <Listbox.Option
                                        key={kompetensi}
                                        className={({ active }) =>
                                          `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                                            active
                                              ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                                              : "text-gray-900 dark:text-gray-100"
                                          }`
                                        }
                                        value={kompetensi}
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
                                              {kompetensi}
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
                            value={newKompetensi}
                            onChange={(e) => setNewKompetensi(e.target.value)}
                            placeholder="Tambah kompetensi baru"
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                newKompetensi.trim() &&
                                !availableKompetensi.includes(
                                  newKompetensi.trim()
                                )
                              ) {
                                setAvailableKompetensi((prev) =>
                                  [...prev, newKompetensi.trim()].sort()
                                );
                                setForm((prev) => ({
                                  ...prev,
                                  kompetensi: Array.isArray(prev.kompetensi)
                                    ? [...prev.kompetensi, newKompetensi.trim()]
                                    : prev.kompetensi
                                    ? [
                                        ...prev.kompetensi
                                          .split(",")
                                          .map((k) => k.trim())
                                          .filter((k) => k !== ""),
                                        newKompetensi.trim(),
                                      ]
                                    : [newKompetensi.trim()],
                                }));
                                setNewKompetensi("");
                              }
                            }}
                            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition flex items-center justify-center"
                            disabled={
                              !newKompetensi.trim() ||
                              availableKompetensi.includes(newKompetensi.trim())
                            }
                          >
                            Tambah
                          </button>
                        </div>
                      </div>
                      {/* Keahlian */}
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-200 mb-1">
                          Keahlian
                        </label>
                        <Listbox
                          value={
                            Array.isArray(form.keahlian)
                              ? form.keahlian
                              : typeof form.keahlian === "string"
                              ? (form.keahlian || "")
                                  .split(",")
                                  .map((k) => k.trim())
                                  .filter((k) => k !== "")
                              : []
                          }
                          onChange={(newSelection) => {
                            // Validasi standby: jika ada "standby", harus HANYA "standby"
                            const hasStandby = newSelection.some(
                              (k) => k.toLowerCase() === "standby"
                            );
                            if (hasStandby && newSelection.length > 1) {
                              // Jika ada standby dan ada keahlian lain, hanya ambil standby
                              setForm((prev) => ({
                                ...prev,
                                keahlian: ["Standby"],
                                kompetensi: [], // Reset kompetensi jika standby
                              }));
                            } else {
                              setForm((prev) => ({
                                ...prev,
                                keahlian: newSelection,
                                // Jika standby, reset kompetensi
                                kompetensi: hasStandby ? [] : prev.kompetensi,
                              }));
                            }
                          }}
                          multiple
                        >
                          {({ open }) => (
                            <div className="relative">
                              <Listbox.Button className="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm">
                                <span className="block truncate">
                                  {Array.isArray(form.keahlian) &&
                                  form.keahlian.length === 0
                                    ? "Pilih Keahlian"
                                    : Array.isArray(form.keahlian)
                                    ? form.keahlian.join(", ")
                                    : ""}
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
                                  {availableKeahlian.length === 0 ? (
                                    <Listbox.Option
                                      className="relative cursor-default select-none py-2.5 pl-4 pr-4 text-gray-400 dark:text-gray-500"
                                      value=""
                                      disabled
                                    >
                                      Belum ada keahlian
                                    </Listbox.Option>
                                  ) : (
                                    availableKeahlian.map((keahlian) => (
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
                            value={newKeahlian}
                            onChange={(e) => setNewKeahlian(e.target.value)}
                            placeholder="Tambah keahlian baru"
                            className="flex-1 px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal text-base focus:outline-none focus:ring-2 focus:ring-brand-500"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              if (
                                newKeahlian.trim() &&
                                !availableKeahlian.includes(
                                  newKeahlian.trim()
                                ) &&
                                newKeahlian.trim().toLowerCase() !==
                                  "standby" &&
                                newKeahlian.trim() !== "Standby"
                              ) {
                                setAvailableKeahlian((prev) =>
                                  [...prev, newKeahlian.trim()].sort()
                                );
                                setForm((prev) => ({
                                  ...prev,
                                  keahlian: Array.isArray(prev.keahlian)
                                    ? [...prev.keahlian, newKeahlian.trim()]
                                    : prev.keahlian
                                    ? [
                                        ...prev.keahlian
                                          .split(",")
                                          .map((k) => k.trim())
                                          .filter((k) => k !== ""),
                                        newKeahlian.trim(),
                                      ]
                                    : [newKeahlian.trim()],
                                }));
                                setNewKeahlian("");
                              }
                            }}
                            className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition flex items-center justify-center"
                            disabled={
                              !newKeahlian.trim() ||
                              availableKeahlian.includes(newKeahlian.trim())
                            }
                          >
                            Tambah
                          </button>
                        </div>
                      </div>
                      {/* Pesan validasi keahlian dipindah ke luar grid agar full width */}
                    </div>
                  )}
                  {/* Pesan validasi keahlian - full width */}
                  {keahlianValidationMessage && (
                    <div className="mt-2 w-full p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                      <div className="flex items-start">
                        <svg
                          className="w-5 h-5 text-yellow-600 mr-2 mt-0.5"
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
                        <span className="text-sm text-yellow-800 dark:text-yellow-200">
                          {keahlianValidationMessage}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Form Actions */}
                  <div className="flex justify-end gap-4 pt-4">
                    <button
                      type="button"
                      onClick={handleCloseModal}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={handleAdd}
                      className={`px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition flex items-center justify-center ${
                        !isFormValid ? "opacity-60 cursor-not-allowed" : ""
                      }`}
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
                        "Simpan"
                      )}
                    </button>
                  </div>
                </form>
              </div>
              {/* Error Message di dalam Modal */}
              <AnimatePresence>
                {modalError && (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    transition={{ duration: 0.2 }}
                    className="mt-4 p-3 rounded-lg text-sm bg-red-100 text-red-700"
                  >
                    {modalError}
                  </motion.div>
                )}
              </AnimatePresence>
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
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    Hapus Data
                  </h2>
                </div>
                <div>
                  <p className="mb-6 text-gray-500 dark:text-gray-400">
                    Apakah Anda yakin ingin menghapus data dosen{" "}
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {userToDelete?.name || selectedDeleteNid}
                    </span>
                    ? Data yang dihapus tidak dapat dikembalikan.
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
      {/* Modal konfirmasi hapus massal */}
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
                  data dosen terpilih? Data yang dihapus tidak dapat
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
                    onClick={async () => {
                      setShowDeleteModalBulk(false);
                      await handleDeleteSelected();
                    }}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center"
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Menghapus..." : "Hapus"}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modal View Tanda Tangan */}
      <AnimatePresence>
        {showSignatureModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => {
                setShowSignatureModal(false);
                setSelectedSignature(null);
                setSelectedDosenName("");
              }}
            ></div>
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowSignatureModal(false);
                  setSelectedSignature(null);
                  setSelectedDosenName("");
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
                    Tanda Tangan Digital
                  </h2>
                </div>
                <div className="mb-4">
                  <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    Dosen:{" "}
                    <span className="font-semibold text-gray-800 dark:text-white">
                      {selectedDosenName}
                    </span>
                  </p>
                </div>
                <div className="flex items-center justify-center bg-gray-50 dark:bg-gray-800 rounded-lg p-8 border border-gray-200 dark:border-gray-700 min-h-[300px]">
                  {selectedSignature ? (
                    <img
                      src={selectedSignature}
                      alt="Tanda Tangan Digital"
                      className="max-w-full max-h-96 object-contain bg-white dark:bg-gray-900 p-4 rounded"
                    />
                  ) : (
                    <div className="text-center text-gray-400 dark:text-gray-500">
                      <FontAwesomeIcon
                        icon={faImage}
                        className="w-16 h-16 mb-4 opacity-50"
                      />
                      <p>Tanda tangan tidak ditemukan</p>
                    </div>
                  )}
                </div>
                <div className="flex justify-end gap-2 pt-6">
                  <button
                    onClick={() => {
                      setShowSignatureModal(false);
                      setSelectedSignature(null);
                      setSelectedDosenName("");
                    }}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
