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
  faRefresh,
  faInfoCircle,
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
  // Tambahan untuk fitur peran utama
  peran_utama?: "koordinator" | "tim_blok" | "dosen_mengajar";
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
interface AssignmentData {
  [pblId: number]: {
    id: number;
    nid: string;
    name: string;
    pbl_assignment_count?: number;
  }[];
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
  const [editingCell, setEditingCell] = useState<{ row: number; key: string } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [modalError, setModalError] = useState("");
  const [filterKompetensi, setFilterKompetensi] = useState<string[]>([]);
  const [availableKompetensi, setAvailableKompetensi] = useState<string[]>([]);
  const [newKompetensi, setNewKompetensi] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [availableKeahlian, setAvailableKeahlian] = useState<string[]>([]);
  const [newKeahlian, setNewKeahlian] = useState("");
  const [filterKeahlian, setFilterKeahlian] = useState<string[]>([]);
  // Tambahkan state untuk daftar peran kurikulum global
  const [peranKurikulumOptions, setPeranKurikulumOptions] = useState<string[]>(
    []
  );
  // Untuk fitur peran utama dosen
  const [peranUtama, setPeranUtama] = useState<string>("");
  const [matkulList, setMatkulList] = useState<
    {
      kode: string;
      nama: string;
      semester: number;
      blok?: number;
      jenis?: string;
    }[]
  >([]);
  const [matkulKetua, setMatkulKetua] = useState<string>("");
  const [matkulAnggota, setMatkulAnggota] = useState<string>("");
  const [peranKurikulumMengajar, setPeranKurikulumMengajar] =
    useState<string>("");
  // 1. Tambahkan state untuk multi-peran
  const [peranKetua, setPeranKetua] = useState([
    { mata_kuliah_kode: "", peran_kurikulum: "", blok: "", semester: "" },
  ]);
  const [peranAnggota, setPeranAnggota] = useState([
    { mata_kuliah_kode: "", peran_kurikulum: "", blok: "", semester: "" },
  ]);
  // HILANGKAN peranMengajar - Dosen Mengajar di-generate otomatis
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
    setPeranKetua([
      { mata_kuliah_kode: "", peran_kurikulum: "", blok: "", semester: "" },
    ]);
    setPeranAnggota([
      { mata_kuliah_kode: "", peran_kurikulum: "", blok: "", semester: "" },
    ]);
    // HILANGKAN peranMengajar
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
    (editMode || form.password);

  useEffect(() => {
    setLoading(true);
    api
      .get("/users?role=dosen")
      .then((res) => {
        if (Array.isArray(res.data)) {
          setData(res.data);
        } else {
          console.error(
            "API response for /users?role=dosen is not an array:",
            res.data
          );
          setData([]); // Ensure data is always an array
        }
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
      console.error("Failed to fetch semester and matkul data:", e);
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
      setMatkulKetua("");
      setMatkulAnggota("");
      setPeranKurikulumMengajar("");
      setPeranKetua([
        { mata_kuliah_kode: "", peran_kurikulum: "", blok: "", semester: "" },
      ]);
      setPeranAnggota([
        { mata_kuliah_kode: "", peran_kurikulum: "", blok: "", semester: "" },
      ]);
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
        if (!editMode || (Array.isArray(prev.kompetensi) && prev.kompetensi.length === 0)) {
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
    const keahlianList = Array.from(
      new Set(
        data.flatMap((d) => {
          if (Array.isArray(d.keahlian)) {
            return d.keahlian
              .map((item) => String(item).trim())
              .filter((item) => item !== "");
          } else if (
            typeof d.keahlian === "string" &&
            d.keahlian.trim() !== ""
          ) {
            try {
              const parsed = JSON.parse(d.keahlian);
              if (Array.isArray(parsed))
                return parsed
                  .map((item) => String(item).trim())
                  .filter((item) => item !== "");
            } catch {
              // Bukan JSON, split biasa
            }
            return d.keahlian
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item !== "");
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
    return matchKompetensi && matchKeahlian;
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
  const uniqueKeahlianOptions = Array.from(
    new Set(
      data.flatMap((d) =>
        typeof d.keahlian === "string"
          ? d.keahlian
              .split(",")
              .map((item) => item.trim())
              .filter((item) => item !== "")
          : Array.isArray(d.keahlian)
          ? d.keahlian.map((item) => item.trim()).filter((item) => item !== "")
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
      // Validasi frontend multi-peran
      // 1. Hitung total peran per blok (hanya untuk ketua & anggota)
      const blokCount: { [kode: string]: number } = {};
      [...peranKetua, ...peranAnggota].forEach((p) => {
        if (p.mata_kuliah_kode) {
          blokCount[p.mata_kuliah_kode] =
            (blokCount[p.mata_kuliah_kode] || 0) + 1;
        }
      });
      // 2. Validasi total peran (max 4) - HILANGKAN peranMengajar
      const totalPeran = peranKetua.length + peranAnggota.length;
      if (totalPeran > 4) throw new Error("Maksimal 4 peran untuk satu dosen.");
      // Payload - konversi "-" menjadi null untuk field NID, NIDN, NUPTK
      let payload: any = {
        ...form,
        nid: form.nid === "-" || form.nid === "" ? null : form.nid,
        nidn: form.nidn === "-" || form.nidn === "" ? null : form.nidn,
        nuptk: form.nuptk === "-" || form.nuptk === "" ? null : form.nuptk,
        role: "dosen",
        peran_utama: peranUtama === "standby" ? "standby" : "dosen_mengajar",
      };
      // Hanya kirim dosen_peran jika peranUtama 'aktif'
      if (peranUtama === "aktif") {
        payload.dosen_peran = [
          ...peranKetua.map((p) => ({ ...p, tipe_peran: "koordinator" })),
          ...peranAnggota.map((p) => ({ ...p, tipe_peran: "tim_blok" })),
          // HILANGKAN peranMengajar - Dosen Mengajar di-generate otomatis
        ];
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
      const res = await api.get("/users?role=dosen");
      setData(res.data);
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
      setPeranKetua([
        { mata_kuliah_kode: "", peran_kurikulum: "", blok: "", semester: "" },
      ]);
      setPeranAnggota([
        { mata_kuliah_kode: "", peran_kurikulum: "", blok: "", semester: "" },
      ]);
      // HILANGKAN peranMengajar
    } catch (err: any) {
      // Cek error dari backend (axios)
      const backendMsg = err?.response?.data?.message;
      if (backendMsg) {
        setModalError(backendMsg);
      } else if (err?.message) {
        setModalError(err.message);
      } else {
        setModalError("Gagal simpan data");
      }
    } finally {
      setIsSaving(false);
    }
  };
  const handleEdit = (d: UserDosen) => {
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
    console.log("Debug handleEdit - Data dosen:", d);
    console.log("Debug handleEdit - Keahlian raw:", d.keahlian);
    console.log("Debug handleEdit - Keahlian array:", keahlianArr);
    const isStandby = keahlianArr.some(k => k.toLowerCase() === "standby");
    console.log("Debug handleEdit - Is standby:", isStandby);
    setPeranUtama(isStandby ? "standby" : "aktif");
    setMatkulKetua(
      d.matkul_ketua_nama
        ? matkulList.find((mk) => mk.nama === d.matkul_ketua_nama)?.kode || ""
        : ""
    );
    setMatkulAnggota(
      d.matkul_anggota_nama
        ? matkulList.find((mk) => mk.nama === d.matkul_anggota_nama)?.kode || ""
        : ""
    );
    setPeranKurikulumMengajar(d.peran_kurikulum_mengajar || "");
    // Set peran dari backend
    setPeranKetua(
      Array.isArray(d.dosen_peran)
        ? d.dosen_peran
            .filter((p) => p.tipe_peran === "koordinator")
            .map((p) => ({
              mata_kuliah_kode: p.mata_kuliah_kode,
              peran_kurikulum: p.peran_kurikulum,
              blok: String(p.blok || ""),
              semester: String(p.semester || ""),
            }))
        : [
            {
              mata_kuliah_kode: "",
              peran_kurikulum: "",
              blok: "",
              semester: "",
            },
          ]
    );
    setPeranAnggota(
      Array.isArray(d.dosen_peran)
        ? d.dosen_peran
            .filter((p) => p.tipe_peran === "tim_blok")
            .map((p) => ({
              mata_kuliah_kode: p.mata_kuliah_kode,
              peran_kurikulum: p.peran_kurikulum,
              blok: String(p.blok || ""),
              semester: String(p.semester || ""),
            }))
        : [
            {
              mata_kuliah_kode: "",
              peran_kurikulum: "",
              blok: "",
              semester: "",
            },
          ]
    );
    // HILANGKAN peranMengajar
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
        const res = await api.get("/users?role=dosen");
        setData(res.data);
        setSuccess("Data dosen berhasil dihapus.");
      }
      setShowDeleteModal(false);
      setSelectedDeleteNid(null);
    } catch {
      setError("Gagal menghapus data");
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

        // Cek apakah ada kolom gabungan NID/NIDN/NUPTK
        const headers = Object.keys(row);
        let combinedIdKey = headers.find(h => 
          h.toLowerCase().includes('nid') && h.toLowerCase().includes('/')
        );
        
        // Cek juga untuk format yang lebih spesifik
        if (!combinedIdKey) {
          combinedIdKey = headers.find(h => 
            h.toLowerCase() === 'nid/nidn/nuptk' || 
            h.toLowerCase().includes('nid/nidn') ||
            h.toLowerCase().includes('nid/nidn/nuptk')
          );
        }
        
        // Jika tidak ada header yang jelas, cari berdasarkan data
        if (!combinedIdKey) {
          combinedIdKey = headers.find(h => {
            const value = row[h];
            if (typeof value === 'string' && value.includes('/')) {
              const parts = value.split('/');
              return parts.length >= 2 && parts.every(part => /^[0-9]+$/.test(part.trim()));
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
          const nid = newRow.nid || '';
          const nidn = newRow.nidn || '';
          const nuptk = newRow.nuptk || '';
          
          if (nid && nidn) {
            newRow['NID / NIDN / NUPTK'] = `${nid} / ${nidn}${nuptk ? ` / ${nuptk}` : ''}`;
          } else {
            newRow['NID / NIDN / NUPTK'] = nid || nidn || nuptk || '-';
          }
        } else {
          newRow['NID / NIDN / NUPTK'] = '-';
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
    
    // Show progress message for large datasets
    if (previewData.length > 50) {
      setSuccess("Sedang memproses data... Mohon tunggu, ini mungkin memakan waktu beberapa menit untuk data yang banyak.");
    }

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
      const updatedDataRes = await api.get("/users?role=dosen");
      if (Array.isArray(updatedDataRes.data)) {
        setData(updatedDataRes.data);
      } else {
        console.error(
          "API response for /users?role=dosen after import is not an array:",
          updatedDataRes.data
        );
        setData([]); // Ensure data is always an array to prevent TypeError
      }
      if (res.status === 200) {
        setImportedCount(
          res.data.imported_count || res.data.importedCount || 0
        );
        if ((res.data.imported_count || res.data.importedCount) > 0) {
          setSuccess(
            `${
              res.data.imported_count || res.data.importedCount
            } data dosen berhasil diimpor ke database.`
          );
        }
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
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        setError("Import memakan waktu terlalu lama. Data mungkin terlalu banyak. Silakan coba dengan file yang lebih kecil atau hubungi administrator.");
      } else {
        setError(err.message || "Gagal mengimpor data");
      }
      setCellErrors([]);
    } finally {
      setIsSaving(false);
      setLoading(false);
      setSuccess(null); // Clear progress message
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
    if (!combinedData || typeof combinedData !== 'string') {
      return { nid: '', nidn: '', nuptk: '' };
    }
    
    const parts = combinedData.split('/');
    return {
      nid: parts[0]?.trim() || '',
      nidn: parts[1]?.trim() || '',
      nuptk: parts[2]?.trim() || ''
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
    const hasCombinedId = headers.some(h => 
      h.toLowerCase().includes('nid') && h.toLowerCase().includes('/')
    );
    
    // Cek juga untuk format "nid/nidn/nuptk" yang lebih spesifik
    const hasSpecificCombinedId = headers.some(h => 
      h.toLowerCase() === 'nid/nidn/nuptk' || 
      h.toLowerCase().includes('nid/nidn') ||
      h.toLowerCase().includes('nid/nidn/nuptk')
    );
    
    // Cek apakah ada kolom yang berisi data gabungan (berdasarkan data, bukan header)
    const hasCombinedData = excelData.some(row => {
      return Object.values(row).some(value => {
        if (typeof value === 'string' && value.includes('/')) {
          const parts = value.split('/');
          // Cek apakah format seperti NID/NIDN/NUPTK (angka/angka/angka)
          return parts.length >= 2 && parts.every(part => /^[0-9]+$/.test(part.trim()));
        }
        return false;
      });
    });
    
    const hasSeparateNid = headers.includes('nid');
    const hasSeparateNidn = headers.includes('nidn');
    
    let requiredHeaders: string[];
    
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
        let combinedIdKey = headers.find(h => 
          h.toLowerCase().includes('nid') && h.toLowerCase().includes('/')
        );
        
        // Jika tidak ada header yang jelas, cari berdasarkan data
        if (!combinedIdKey) {
          combinedIdKey = headers.find(h => {
            const value = row[h];
            if (typeof value === 'string' && value.includes('/')) {
              const parts = value.split('/');
              return parts.length >= 2 && parts.every(part => /^[0-9]+$/.test(part.trim()));
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
      if (!rowNid || (!/^[0-9]+$/.test(rowNid) && rowNid !== '-')) {
        errors.push(`NID harus diisi dengan angka atau "-" (Baris ${rowNum}, Kolom NID): ${rowNid}`);
        newCellErrors.push({
          row: index,
          field: "nid",
          message: `NID harus diisi dengan angka atau "-"`,
          nid: rowNid,
        });
      }
      if (!rowNidn || (!/^[0-9]+$/.test(rowNidn) && rowNidn !== '-')) {
        errors.push(`NIDN harus diisi dengan angka atau "-" (Baris ${rowNum}, Kolom NIDN): ${rowNidn}`);
        newCellErrors.push({
          row: index,
          field: "nidn",
          message: `NIDN harus diisi dengan angka atau "-"`,
          nid: rowNidn,
        });
      }
      // NUPTK wajib diisi dengan angka atau "-"
      if (!rowNuptk || (!/^[0-9]+$/.test(rowNuptk) && rowNuptk !== '-')) {
        errors.push(`NUPTK harus diisi dengan angka atau "-" (Baris ${rowNum}, Kolom NUPTK): ${rowNuptk}`);
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
        const keahlianArray = keahlianValue.split(",").map(k => k.trim().toLowerCase());
        if (keahlianArray.length !== 1 || keahlianArray[0] !== "standby") {
          errors.push(`Jika keahlian mengandung "standby", maka harus HANYA "standby" saja (Baris ${rowNum})`);
          newCellErrors.push({
            row: index,
            field: "keahlian",
            message: `Jika keahlian mengandung "standby", maka harus HANYA "standby" saja`,
            nid: rowNid,
          });
        }
        
        // Jika standby, kompetensi harus kosong
        if (kompetensiValue !== "") {
          errors.push(`Jika keahlian "standby", kompetensi harus kosong (Baris ${rowNum})`);
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
      if (rowNid && rowNid !== '-') {
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
      if (rowNidn && rowNidn !== '-') {
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
      const res = await api.get("/users?role=dosen");
      setData(res.data);
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
      if (Array.isArray(res.data)) setPeranKurikulumOptions(res.data);
    });
  }, []);

  // Tambahkan sebelum return/modal render - HILANGKAN peranMengajar
  const totalPeran = peranKetua.length + peranAnggota.length;

  // Function untuk fetch assignment data
  const fetchAssignmentData = async () => {

    try {
      

      // Langsung ambil data assignment dari /pbls/assigned-dosen-batch
      // tanpa perlu fetch /pbls/all yang bermasalah
      const assignedRes = await api.post("/pbls/assigned-dosen-batch", {
        pbl_ids: [
          1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
          21, 22, 23, 24, 25, 26, 27, 28,
        ], // Hardcode PBL IDs yang ada
      });






      


      setAssignmentData(assignedRes.data || {});


    } catch (error: any) {
      console.error("Failed to fetch assignment data:", error);
      console.error("Error details:", error.response?.data);
      setAssignmentData({});
    }
  };

  // Function untuk menghitung assignment count per dosen
  const getAssignmentCount = (dosenId: number): number => {




    
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
    Object.entries(assignmentData).forEach(([pblId, dosenList]) => {

      dosenList.forEach((dosen: { id: number }) => {
        if (dosen.id === dosenId) {

          
          // Ambil data PBL untuk mendapatkan mata kuliah
          const pblIdNum = parseInt(pblId);
          let mataKuliahKode = "";

                  // Cari di data PBL yang sudah di-fetch (sama seperti PBL-detail.tsx)
        if (pblData && Object.keys(pblData).length > 0) {



          
          // Loop melalui semua mata kuliah untuk mencari PBL yang sesuai
          Object.entries(pblData).forEach(([mkKode, pblList]) => {
            // PERBAIKAN: Tambah null check dan type safety
            if (!pblList || !Array.isArray(pblList)) {

              return; // Skip jika bukan array
            }
            
            const pbls = pblList as any[];

            const foundPBL = pbls.find(pbl => pbl && pbl.id === pblIdNum);
            
            if (foundPBL) {
              mataKuliahKode = mkKode;

            }
          });
        } else {



        }
          
          // Jika tidak ditemukan di pblData, gunakan fallback yang sudah diperbaiki
          if (!mataKuliahKode) {

          }

          // Hanya tambahkan jika mata kuliah tidak di-exclude (bukan Tim Blok/Koordinator)
          if (mataKuliahKode && !excludedMataKuliah.has(mataKuliahKode)) {
            uniqueMataKuliah.add(mataKuliahKode);

          } else {

          }
        }
      });
    });



    return uniqueMataKuliah.size;
  };

  // Function untuk mendapatkan detail assignment per dosen
  const getAssignmentDetails = (dosenId: number) => {
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
            const foundPBL = pbls.find(pbl => pbl && pbl.id === pblIdNum);
            
            if (foundPBL) {
              // PERBAIKAN: Gunakan data yang sama dengan PBL-detail.tsx
              // Ambil data mata kuliah dari matkulList (filter hanya yang Blok)
              const mataKuliah = matkulList
                .filter(mk => mk.jenis === "Blok")
                .find(mk => mk.kode === mkKode);
              
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
             .filter(mk => mk.jenis === "Blok")
             .find(mk => {
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
          if (mataKuliahKode && !uniqueMataKuliah.has(mataKuliahKode) && !excludedMataKuliah.has(mataKuliahKode)) {
            uniqueMataKuliah.add(mataKuliahKode);
            const matkulNama = getMataKuliahNama(mataKuliahKode);
            const detail = `${mataKuliahKode} - ${matkulNama} Semester ${semester} | Blok ${blok}`;
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
        const res = await api.get("/users?role=dosen");
        setData(res.data);
      } catch (error) {
        console.error("Failed to fetch dosen data:", error);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6 gap-4">
        <div className="flex gap-2">
          <button
            onClick={() => {
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
            onClick={() => {

              fetchAssignmentData();
            }}
            className="px-4 py-2 rounded-lg bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 text-sm font-medium shadow-theme-xs hover:bg-purple-200 dark:hover:bg-purple-800 transition flex items-center gap-2"
          >
            <FontAwesomeIcon icon={faRefresh} className="w-4 h-4" />
            Refresh Assignment
          </button>
        </div>
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-0">
          <div className="relative w-full md:w-80">
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
          <Listbox
            value={filterKompetensi}
            onChange={handleFilterKompetensiChange}
            multiple
          >
            {({ open }) => (
              <div className="relative w-full md:w-60">
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
              <div className="relative w-full md:w-60 mt-2 md:mt-0">
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
        </div>
      </div>
      {error && (
        <div className="bg-red-100 rounded-md p-3 mb-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      {/* Preview Data Section (now below search bar) */}
      {importedFile && (
        <div className="w-full mt-4">
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
                    {previewData[0] && Object.keys(previewData[0]).map((colKey) => (
                      <th key={colKey} className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400">
                        {colKey.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {paginatedPreviewData.map((row, i) => {
                    const globalRowIdx = (previewPage - 1) * previewPageSize + i;
                              return (
                      <tr key={i} className={i % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""}>
                        {previewData[0] && Object.keys(previewData[0]).map((colKey, _) => {
                          const isEditing = editingCell?.row === globalRowIdx && editingCell?.key === colKey;
                          return (
                            <td
                              key={colKey}
                              className={`px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100 cursor-pointer ${
                                cellErrors.some(error => error.row === globalRowIdx && error.field === colKey) ? 'bg-red-100 dark:bg-red-900/30' : ''
                              }`}
                              title={cellErrors.find(error => error.row === globalRowIdx && error.field === colKey)?.message || ''}
                              onClick={() => setEditingCell({ row: globalRowIdx, key: colKey })}
                            >
                              {isEditing ? (
                                <input
                                  className="w-full px-1 border-none outline-none text-xs md:text-sm"
                                  value={previewData[editingCell.row][editingCell.key] || ""}
                                  onChange={e => {
                                    let val = e.target.value;
                                    if (["nid", "nidn", "nuptk", "telepon"].includes(colKey)) {
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
            className="bg-green-100 rounded-md p-3 mb-4 text-green-700"
          >
            {success}
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
                          filteredAndSearchedData.map((d) => String(d.id || d.nid))
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
                          ? d.dosen_peran.filter(
                              (p) => p.tipe_peran === "koordinator"
                            ).filter((p, index, self) => 
                              // HILANGKAN DUPLIKASI: Unique berdasarkan mata_kuliah_kode
                              index === self.findIndex(peran => 
                                peran.mata_kuliah_kode === p.mata_kuliah_kode
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
                                          {p.peran_kurikulum}
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
                          ? d.dosen_peran.filter(
                              (p) => p.tipe_peran === "tim_blok"
                            ).filter((p, index, self) => 
                              // HILANGKAN DUPLIKASI: Unique berdasarkan mata_kuliah_kode
                              index === self.findIndex(peran => 
                                peran.mata_kuliah_kode === p.mata_kuliah_kode
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
                                          {p.peran_kurikulum}
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

                      {/* Dosen Mengajar Badge - Selalu muncul */}
                      {(() => {
                        const assignmentCount = getAssignmentCount(d.id || 0);
                        const assignmentDetails = getAssignmentDetails(
                          d.id || 0
                        );
                        const rowKey = `${d.id || d.nid}_mengajar`;
                        const isExpanded = !!expandedGroups[rowKey];

                        return (
                          <div className="mb-3">
                            <button
                              type="button"
                              className="px-2 py-1 rounded text-xs font-semibold bg-yellow-100 text-yellow-700 focus:outline-none cursor-pointer flex items-center gap-1"
                              onClick={() => toggleGroup(rowKey)}
                              title="Klik untuk buka/tutup detail"
                            >
                              Dosen Mengajar ({assignmentCount})
                              <FontAwesomeIcon
                                icon={
                                  isExpanded ? faChevronUp : faChevronDown
                                }
                                className="ml-1 w-3 h-3"
                              />
                            </button>
                            {isExpanded && (
                              <ul className="ml-0 mt-2 flex flex-col gap-2">
                                {assignmentCount > 0 ? (
                                  assignmentDetails.map((detail, idx) => (
                                    <li
                                      key={idx}
                                      className="flex items-start gap-2 bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 transition"
                                    >
                                      <FontAwesomeIcon
                                        icon={faBookOpen}
                                        className="text-yellow-400 mt-1 w-3 h-3"
                                      />
                                      <div>
                                        <div className="font-medium text-brand-400 text-sm">
                                          {detail.split(" - ")[0]}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          {detail.split(" - ")[1]}
                                        </div>
                                        <div className="text-xs text-gray-400">
                                          Dosen Mengajar PBL
                                        </div>
                                      </div>
                                    </li>
                                  ))
                                ) : (
                                  <li className="flex items-start gap-2 bg-gray-100 dark:bg-white/5 rounded-lg px-3 py-2 transition">
                                    <FontAwesomeIcon
                                      icon={faBookOpen}
                                      className="text-yellow-400 mt-1 w-3 h-3"
                                    />
                                    <div>
                                      <div className="font-medium text-brand-400 text-sm">
                                        Belum ada assignment
                                      </div>
                                      <div className="text-xs text-gray-400">
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
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Peran Ketua */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Koordinator
                              </label>
                              <button
                                type="button"
                                className={`text-xs font-medium px-2 py-1 rounded transition ${
                                  totalPeran >= 4
                                    ? "text-gray-200 dark:text-gray-500 cursor-not-allowed opacity-60"
                                    : "text-brand-500 hover:text-brand-600"
                                }`}
                                disabled={totalPeran >= 4}
                                onClick={() =>
                                  setPeranKetua([
                                    ...peranKetua,
                                    {
                                      mata_kuliah_kode: "",
                                      peran_kurikulum: "",
                                      blok: "",
                                      semester: "",
                                    },
                                  ])
                                }
                              >
                                + Tambah
                              </button>
                            </div>
                            {peranKetua.map((item, idx) => (
                              <div
                                key={idx}
                                className="mb-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-500">
                                    Ketua {idx + 1}
                                  </span>
                                  {peranKetua.length > 0 && (
                                    <button
                                      type="button"
                                      className="text-xs text-red-500 hover:text-red-600"
                                      onClick={() =>
                                        setPeranKetua(
                                          peranKetua.filter((_, i) => i !== idx)
                                        )
                                      }
                                    >
                                      Hapus
                                    </button>
                                  )}
                                </div>
                                {/* Listbox Matkul */}
                                <Listbox
                                  value={item.mata_kuliah_kode}
                                  onChange={(value) => {
                                    const selectedMatkul = matkulList.find(
                                      (mk) => mk.kode === value
                                    );
                                    setPeranKetua(
                                      peranKetua.map((p, i) =>
                                        i === idx
                                          ? {
                                              ...p,
                                              mata_kuliah_kode: value,
                                              blok: String(
                                                selectedMatkul?.blok || ""
                                              ),
                                              semester: String(
                                                selectedMatkul?.semester || ""
                                              ),
                                            }
                                          : p
                                      )
                                    );
                                  }}
                                >
                                  {({ open }) => (
                                    <div className="relative mb-2">
                                      <Listbox.Button className="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm">
                                        <span className="block truncate">
                                          {(() => {
                                            const selectedMatkul =
                                              matkulList.find(
                                                (mk) =>
                                                  mk.kode ===
                                                  item.mata_kuliah_kode
                                              );
                                            return selectedMatkul
                                              ? `Blok ${selectedMatkul.blok}: ${selectedMatkul.nama}`
                                              : "Pilih Mata Kuliah";
                                          })()}
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
                                            const blokMataKuliah = matkulList
                                              .filter(
                                                (mk) => mk.jenis === "Blok"
                                              )
                                              .sort((a, b) => {
                                                if (a.semester !== b.semester)
                                                  return (
                                                    a.semester - b.semester
                                                  );
                                                return (
                                                  (a.blok || 0) - (b.blok || 0)
                                                );
                                              });

                                            const groupedBySemester =
                                              blokMataKuliah.reduce(
                                                (acc, mk) => {
                                                  if (!acc[mk.semester])
                                                    acc[mk.semester] = [];
                                                  acc[mk.semester].push(mk);
                                                  return acc;
                                                },
                                                {} as Record<
                                                  number,
                                                  typeof blokMataKuliah
                                                >
                                              );

                                            return Object.entries(
                                              groupedBySemester
                                            ).map(([semester, mataKuliah]) => (
                                              <div key={semester}>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700">
                                                  Semester {semester}
                                                </div>
                                                {mataKuliah.map((mk) => (
                                                  <Listbox.Option
                                                    key={mk.kode}
                                                    className={({ active }) =>
                                                      `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                                                        active
                                                          ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                                                          : "text-gray-900 dark:text-gray-100"
                                                      }`
                                                    }
                                                    value={mk.kode}
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
                                                          Blok {mk.blok}:{" "}
                                                          {mk.nama}
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
                                                ))}
                                              </div>
                                            ));
                                          })()}
                                        </Listbox.Options>
                                      </Transition>
                                    </div>
                                  )}
                                </Listbox>
                                {/* Listbox Peran Kurikulum */}
                                <Listbox
                                  value={item.peran_kurikulum}
                                  onChange={(value) =>
                                    !editMode &&
                                    setPeranKetua(
                                      peranKetua.map((p, i) =>
                                        i === idx
                                          ? { ...p, peran_kurikulum: value }
                                          : p
                                      )
                                    )
                                  }
                                  disabled={editMode}
                                >
                                  {({ open }) => (
                                    <div className="relative">
                                      <Listbox.Button className="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm">
                                        <span className="block truncate">
                                          {item.peran_kurikulum ||
                                            "Pilih Peran Kurikulum"}
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
                                          {peranKurikulumOptions.length ===
                                          0 ? (
                                            <Listbox.Option
                                              className="relative cursor-default select-none py-2.5 pl-4 pr-4 text-gray-400 dark:text-gray-500"
                                              value=""
                                              disabled
                                            >
                                              Belum ada peran kurikulum
                                            </Listbox.Option>
                                          ) : (
                                            peranKurikulumOptions.map(
                                              (peran) => (
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
                                              )
                                            )
                                          )}
                                        </Listbox.Options>
                                      </Transition>
                                    </div>
                                  )}
                                </Listbox>
                              </div>
                            ))}
                          </div>

                          {/* Peran Anggota */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="block text-sm font-medium text-gray-700 dark:text-gray-200">
                                Tim Blok
                              </label>
                              <button
                                type="button"
                                className={`text-xs font-medium px-2 py-1 rounded transition ${
                                  totalPeran >= 4
                                    ? "text-gray-200 dark:text-gray-500 cursor-not-allowed opacity-60"
                                    : "text-brand-500 hover:text-brand-600"
                                }`}
                                disabled={totalPeran >= 4}
                                onClick={() =>
                                  setPeranAnggota([
                                    ...peranAnggota,
                                    {
                                      mata_kuliah_kode: "",
                                      peran_kurikulum: "",
                                      blok: "",
                                      semester: "",
                                    },
                                  ])
                                }
                              >
                                + Tambah
                              </button>
                            </div>
                            {peranAnggota.map((item, idx) => (
                              <div
                                key={idx}
                                className="mb-3 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
                              >
                                <div className="flex items-center justify-between mb-2">
                                  <span className="text-xs text-gray-500">
                                    Anggota {idx + 1}
                                  </span>
                                  {peranAnggota.length > 0 && (
                                    <button
                                      type="button"
                                      className={`text-xs text-red-500 hover:text-red-600 ${
                                        editMode
                                          ? "opacity-60 cursor-not-allowed pointer-events-none"
                                          : ""
                                      }`}
                                      onClick={() =>
                                        !editMode &&
                                        setPeranAnggota(
                                          peranAnggota.filter(
                                            (_, i) => i !== idx
                                          )
                                        )
                                      }
                                      disabled={editMode}
                                    >
                                      Hapus
                                    </button>
                                  )}
                                </div>
                                {/* Listbox Matkul */}
                                <Listbox
                                  value={item.mata_kuliah_kode}
                                  onChange={(value) => {
                                    const selectedMatkul = matkulList.find(
                                      (mk) => mk.kode === value
                                    );
                                    setPeranAnggota(
                                      peranAnggota.map((p, i) =>
                                        i === idx
                                          ? {
                                              ...p,
                                              mata_kuliah_kode: value,
                                              blok: String(
                                                selectedMatkul?.blok || ""
                                              ),
                                              semester: String(
                                                selectedMatkul?.semester || ""
                                              ),
                                            }
                                          : p
                                      )
                                    );
                                  }}
                                >
                                  {({ open }) => (
                                    <div className="relative mb-2">
                                      <Listbox.Button className="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm">
                                        <span className="block truncate">
                                          {(() => {
                                            const selectedMatkul =
                                              matkulList.find(
                                                (mk) =>
                                                  mk.kode ===
                                                  item.mata_kuliah_kode
                                              );
                                            return selectedMatkul
                                              ? `Blok ${selectedMatkul.blok}: ${selectedMatkul.nama}`
                                              : "Pilih Mata Kuliah";
                                          })()}
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
                                            const blokMataKuliah = matkulList
                                              .filter(
                                                (mk) => mk.jenis === "Blok"
                                              )
                                              .sort((a, b) => {
                                                if (a.semester !== b.semester)
                                                  return (
                                                    a.semester - b.semester
                                                  );
                                                return (
                                                  (a.blok || 0) - (b.blok || 0)
                                                );
                                              });

                                            const groupedBySemester =
                                              blokMataKuliah.reduce(
                                                (acc, mk) => {
                                                  if (!acc[mk.semester])
                                                    acc[mk.semester] = [];
                                                  acc[mk.semester].push(mk);
                                                  return acc;
                                                },
                                                {} as Record<
                                                  number,
                                                  typeof blokMataKuliah
                                                >
                                              );

                                            return Object.entries(
                                              groupedBySemester
                                            ).map(([semester, mataKuliah]) => (
                                              <div key={semester}>
                                                <div className="px-4 py-2 text-xs font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-gray-700">
                                                  Semester {semester}
                                                </div>
                                                {mataKuliah.map((mk) => (
                                                  <Listbox.Option
                                                    key={mk.kode}
                                                    className={({ active }) =>
                                                      `relative cursor-default select-none py-2.5 pl-4 pr-4 ${
                                                        active
                                                          ? "bg-brand-100 text-brand-900 dark:bg-brand-700/20 dark:text-white"
                                                          : "text-gray-900 dark:text-gray-100"
                                                      }`
                                                    }
                                                    value={mk.kode}
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
                                                          Blok {mk.blok}:{" "}
                                                          {mk.nama}
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
                                                ))}
                                              </div>
                                            ));
                                          })()}
                                        </Listbox.Options>
                                      </Transition>
                                    </div>
                                  )}
                                </Listbox>
                                {/* Listbox Peran Kurikulum */}
                                <Listbox
                                  value={item.peran_kurikulum}
                                  onChange={(value) =>
                                    !editMode &&
                                    setPeranAnggota(
                                      peranAnggota.map((p, i) =>
                                        i === idx
                                          ? { ...p, peran_kurikulum: value }
                                          : p
                                      )
                                    )
                                  }
                                  disabled={editMode}
                                >
                                  {({ open }) => (
                                    <div className="relative">
                                      <Listbox.Button className="relative w-full cursor-default rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 py-2 pl-3 pr-10 text-left text-gray-800 dark:text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-brand-500 sm:text-sm">
                                        <span className="block truncate">
                                          {item.peran_kurikulum ||
                                            "Pilih Peran Kurikulum"}
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
                                          {peranKurikulumOptions.length ===
                                          0 ? (
                                            <Listbox.Option
                                              className="relative cursor-default select-none py-2.5 pl-4 pr-4 text-gray-400 dark:text-gray-500"
                                              value=""
                                              disabled
                                            >
                                              Belum ada peran kurikulum
                                            </Listbox.Option>
                                          ) : (
                                            peranKurikulumOptions.map(
                                              (peran) => (
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
                                              )
                                            )
                                          )}
                                        </Listbox.Options>
                                      </Transition>
                                    </div>
                                  )}
                                </Listbox>
                              </div>
                            ))}
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
                        <svg className="w-6 h-6 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                        </svg>
                        <div>
                          <h3 className="text-sm font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                            📋 Dosen Standby
                          </h3>
                          <p className="text-sm text-yellow-700 dark:text-yellow-300">
                            Dosen ini akan otomatis memiliki keahlian "Standby" dan kompetensi kosong. 
                            Dosen standby siap untuk di-assign ke modul PBL kapan saja.
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
                              : (form.kompetensi || "")
                                  .split(",")
                                  .map((k) => k.trim())
                                  .filter((k) => k !== "")
                          }
                          onChange={(newSelection) => {
                            // Cek apakah keahlian mengandung standby
                            const hasStandby = Array.isArray(form.keahlian) 
                              ? form.keahlian.some(k => k.toLowerCase() === "standby")
                              : (form.keahlian || "").toLowerCase().includes("standby");
                            
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
                          disabled={Array.isArray(form.keahlian) 
                            ? form.keahlian.some(k => k.toLowerCase() === "standby")
                            : (form.keahlian || "").toLowerCase().includes("standby")}
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
                              : (form.keahlian || "")
                                  .split(",")
                                  .map((k) => k.trim())
                                  .filter((k) => k !== "")
                          }
                          onChange={(newSelection) => {
                            // Validasi standby: jika ada "standby", harus HANYA "standby"
                            const hasStandby = newSelection.some(k => k.toLowerCase() === "standby");
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
                                !availableKeahlian.includes(newKeahlian.trim())
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
              {modalError && (
                <div className="text-sm text-red-500 bg-red-100 rounded p-2 mt-6">
                  {modalError}
                </div>
              )}
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
    </div>
  );
}

