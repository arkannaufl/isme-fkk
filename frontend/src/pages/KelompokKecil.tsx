import React, { useState, useEffect, useRef, ChangeEvent } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { UserIcon, ChevronLeftIcon } from "../icons";
import { motion, AnimatePresence } from "framer-motion";
import {
  kelompokKecilApi,
  kelompokBesarApi,
  mahasiswaVeteranApi,
  Mahasiswa as ApiMahasiswa,
} from "../api/generateApi";
import type { KelompokKecil } from "../api/generateApi";
import { handleApiError } from "../utils/api";
import * as XLSX from "xlsx";

interface Mahasiswa extends Omit<ApiMahasiswa, 'id'> {
  id: string; // Override id to be string for local use
  nama: string; // Override name to be nama for local use
  kelompok?: string; // Additional property for local grouping
}

function mapSemesterToNumber(semester: string | number): number {
  if (typeof semester === "number") return semester;
  if (!isNaN(Number(semester))) return Number(semester);
  if (typeof semester === "string") {
    if (semester.toLowerCase() === "ganjil") return 1;
    if (semester.toLowerCase() === "genap") return 2;
  }
  return 0;
}

const KelompokKecil: React.FC = () => {
  const { semester } = useParams<{ semester: string }>();
  const navigate = useNavigate();
  const [mahasiswa, setMahasiswa] = useState<Mahasiswa[]>([]);
  const [selectedMahasiswa, setSelectedMahasiswa] = useState<string[]>([]);
  const [jumlahKelompok, setJumlahKelompok] = useState(3);
  const [jumlahKelompokTambah, setJumlahKelompokTambah] = useState(1);
  const [loading, setLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showKelompok, setShowKelompok] = useState(false);
  const [isAddingKelompok, setIsAddingKelompok] = useState(false);
  const [filterAngkatan, setFilterAngkatan] = useState<string>("semua"); // Filter angkatan
  const [filterIPK, setFilterIPK] = useState<string>("semua"); // Filter IPK
  const [filterVeteran, setFilterVeteran] = useState<string>("semua"); // Filter veteran

  // State untuk drag and drop
  const [draggedMahasiswa, setDraggedMahasiswa] = useState<Mahasiswa | null>(
    null
  );
  const [dragOverKelompok, setDragOverKelompok] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [dragOverMahasiswaId, setDragOverMahasiswaId] = useState<string | null>(
    null
  );
  const [newlyMovedMahasiswa, setNewlyMovedMahasiswa] = useState<string | null>(
    null
  );
  const [showResetModal, setShowResetModal] = useState(false);

  // State untuk notifikasi
  const [showSaveNotification, setShowSaveNotification] = useState(false);
  const [showLoadNotification, setShowLoadNotification] = useState(false);
  const [hasSavedData, setHasSavedData] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  // Tambahkan state untuk search
  const [searchQuery, setSearchQuery] = useState("");

  // State untuk Mahasiswa Veteran
  const [veteranStudents, setVeteranStudents] = useState<Mahasiswa[]>([]);
  const [veteranSemester, setVeteranSemester] = useState<string>("");
  const [showVeteranSection, setShowVeteranSection] = useState(false);
  const [selectedVeterans, setSelectedVeterans] = useState<string[]>([]);

  // Tambahkan state untuk modal konfirmasi keluarkan
  const [showKeluarkanModal, setShowKeluarkanModal] = useState<null | {
    id: string;
    nama: string;
    semester: string;
  }>(null);

  // Tambahkan state untuk modal konfirmasi hapus
  const [showDeleteModal, setShowDeleteModal] = useState<null | {
    semester: string;
  }>(null);

  // Tambahkan state untuk modal konfirmasi keluar
  const [showLeaveModal, setShowLeaveModal] = useState<null | (() => void)>(
    null
  );

  // Tambahkan state untuk proses menyimpan
  const [isSaving, setIsSaving] = useState(false);

  // New state for API data
  const [kelompokKecilData, setKelompokKecilData] = useState<KelompokKecil[]>(
    []
  );

  // State untuk data semua semester
  const [allSemesterData, setAllSemesterData] = useState<KelompokKecil[]>([]);

  // Tambahkan state untuk pesan error
  const [errorMsg, setErrorMsg] = useState<string>("");

  // State untuk import/export Excel
  const [showImportModal, setShowImportModal] = useState(false);
  const [importedFile, setImportedFile] = useState<File | null>(null);
  const [previewData, setPreviewData] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<
    Array<{ row: number; field: string; message: string }>
  >([]);
  const [cellErrors, setCellErrors] = useState<{ [key: string]: string }>({});
  const [isImporting, setIsImporting] = useState(false);
  const [importedCount, setImportedCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fungsi untuk mengambil data dari semua semester
  const loadAllSemesterData = async () => {
    try {
      // Ambil data dari semester 1-14 (cakupan semester yang mungkin ada)
      const allSemesters = Array.from({ length: 14 }, (_, i) => String(i + 1));
      const promises = allSemesters.map(sem => 
        kelompokKecilApi.getBySemester(sem).catch(() => ({ data: [] }))
      );
      
      const responses = await Promise.all(promises);
      const allData = responses.flatMap(response => response.data || []);
      setAllSemesterData(allData);
    } catch (error: any) {
      console.error("Error loading all semester data:", error);
      console.error("Error details:", handleApiError(error, "Memuat data semua semester"));
      setAllSemesterData([]);
    }
  };

  // Refactor: Buat loadData di luar useEffect agar bisa dipanggil ulang
  const loadData = async () => {
    if (!semester) return;
    try {
      setLoading(true);
      // Ambil mahasiswa dari kelompok besar menggunakan batchBySemester seperti di Kelompok Besar
      const kelompokBesarResponse = await kelompokBesarApi.batchBySemester({ 
        semesters: [String(mapSemesterToNumber(semester))] 
      });
      
      // Ambil data mahasiswa dari response batchBySemester
      const kelompokBesarData = kelompokBesarResponse.data[String(mapSemesterToNumber(semester))] || [];
      
      // BERSIHKAN VETERAN YANG SALAH SEMESTER di awal load (kecuali multi-veteran)
      const allVeteransInKelompokBesar = kelompokBesarData.filter((kb: any) => kb.mahasiswa.is_veteran);
      for (const kb of allVeteransInKelompokBesar) {
        const veteran = kb.mahasiswa;
        // Jika veteran_semesters tidak sesuai dengan semester ini DAN bukan multi-veteran, hapus
        if (veteran.veteran_semesters && veteran.veteran_semesters.length > 0 && !veteran.veteran_semesters.includes(semester) && !veteran.is_multi_veteran) {
          try {
            await kelompokBesarApi.deleteByMahasiswaId(veteran.id, String(mapSemesterToNumber(semester)));
          } catch (error) {
            console.error(`Error cleaning up veteran ${veteran.id} from KelompokBesar:`, error);
          }
        } else if (veteran.is_multi_veteran) {
          // Multi-veteran bisa di multiple semester, jadi tidak perlu dihapus
        }
      }
      
      const mahasiswaKelompokBesar = kelompokBesarData.map((kb) => ({
        id: kb.mahasiswa.id.toString(),
        nama: kb.mahasiswa.name,
        nim: kb.mahasiswa.nim,
        kelompok: undefined, // akan diisi jika sudah dikelompokkan
        status: kb.mahasiswa.status,
        angkatan: kb.mahasiswa.angkatan,
        ipk: kb.mahasiswa.ipk,
        gender: kb.mahasiswa.gender,
        is_veteran: kb.mahasiswa.is_veteran || false, // Tambahkan field is_veteran
        is_multi_veteran: kb.mahasiswa.is_multi_veteran || false, // Tambahkan field is_multi_veteran
        veteran_semesters: kb.mahasiswa.veteran_semesters || [], // Tambahkan veteran_semesters
        veteran_history: kb.mahasiswa.veteran_history || [], // Tambahkan veteran_history
        semester_asli: kb.mahasiswa.semester, // Tambahkan semester asli
      }));
      
      // Ambil kelompok kecil
      let kelompokKecilData: any[] = [];
      try {
        const kelompokResponse = await kelompokKecilApi.getBySemester(
          String(mapSemesterToNumber(semester))
        );
        kelompokKecilData = kelompokResponse.data;
        // Tandai mahasiswa yang sudah dikelompokkan
        const updatedMahasiswa = mahasiswaKelompokBesar.map((m) => {
          // Debug log: show both IDs being compared
          const kelompokData = kelompokKecilData.find((kk) => {
            const kkId = String(kk.mahasiswa_id);
            const mId = String(m.id);
            return kkId === mId;
          });
          return kelompokData
            ? { ...m, kelompok: kelompokData.nama_kelompok }
            : { ...m, kelompok: undefined };
        });
        setMahasiswa(updatedMahasiswa);
        
        // Auto-select all non-veteran students that are in Kelompok Besar
        const nonVeteranStudents = updatedMahasiswa.filter(m => !m.is_veteran);
        const nonVeteranIds = nonVeteranStudents.map(m => m.id);
        setSelectedMahasiswa(nonVeteranIds);
        
        
        setTimeout(() => {

        }, 100);
        setJumlahKelompok(
          kelompokKecilData.length > 0
            ? kelompokKecilData[0].jumlah_kelompok
            : 3
        );
        setShowKelompok(kelompokKecilData.length > 0);
        setHasSavedData(kelompokKecilData.length > 0);
        setKelompokKecilData(kelompokKecilData);
        setHasUnsavedChanges(false); // Pastikan tidak ada perubahan yang belum disimpan
      } catch (err: any) {
        console.error("Error loading kelompok kecil data:", err);
        console.error("Error details:", handleApiError(err, "Memuat data kelompok kecil"));
        setKelompokKecilData([]);
        setMahasiswa(mahasiswaKelompokBesar);
        setHasUnsavedChanges(false); // Pastikan tidak ada perubahan yang belum disimpan
      }
    } catch (err: any) {
      console.error("Error loading data:", err);
      console.error("Error details:", handleApiError(err, "Memuat data mahasiswa"));
    } finally {
      setLoading(false);
      // Pastikan state konsisten setelah load data
      setHasUnsavedChanges(false);
    }
  };

  // Fungsi untuk mengambil semua data veteran (tidak terbatas semester)
  const loadVeteranStudents = async (semester: string) => {
    try {
      const response = await mahasiswaVeteranApi.getAll({
        veteran_only: true,
        angkatan: undefined,
        search: undefined
      });
      
      // PENTING: Pastikan response.data adalah array, jika null/undefined gunakan array kosong
      const allVeterans = Array.isArray(response?.data) ? response.data : [];
      
      // TAMPILKAN SEMUA VETERAN (tidak filter berdasarkan semester)
      // Veteran yang sudah dipilih di semester lain akan ditampilkan dengan deskripsi
      const availableVeterans = allVeterans;
      
      // Convert ke format Mahasiswa
      const veteranFormatted = availableVeterans.map((veteran: any) => ({
        id: veteran.id.toString(),
        nama: veteran.name,
        name: veteran.name, // Tambahkan property name untuk kompatibilitas dengan ApiMahasiswa
        nim: veteran.nim,
        kelompok: undefined,
        status: veteran.status,
        angkatan: veteran.angkatan,
        ipk: veteran.ipk,
        gender: veteran.gender,
        role: veteran.role || 'mahasiswa', // Tambahkan property role
        semester_asli: veteran.semester, // Simpan semester asli untuk referensi
        veteran_semesters: Array.isArray(veteran.veteran_semesters) ? veteran.veteran_semesters : [], // Store veteran semesters array (sudah dijamin array)
        veteran_history: Array.isArray(veteran.veteran_history) ? veteran.veteran_history : [], // Store veteran history (sudah dijamin array)
        is_veteran: true,
        is_multi_veteran: veteran.is_multi_veteran || false, // Store multi-veteran status
        is_locked: false, // Veteran tidak pernah di-lock, bisa dipindahkan antar semester
        is_available: true // Veteran selalu available untuk dipilih
      }));
      
      setVeteranStudents(veteranFormatted);
      setVeteranSemester(semester);
      setShowVeteranSection(veteranFormatted.length > 0);
      
      // HAPUS AUTO-SELECT VETERAN
      // Veteran tidak boleh otomatis ter-select ketika masuk ke halaman
      setSelectedVeterans([]);
      
    } catch (error) {
      console.error('Error loading veteran students:', error);
      setVeteranStudents([]);
      setShowVeteranSection(false);
    }
  };

  useEffect(() => {
    loadData();
    loadAllSemesterData(); // Load data semua semester
    if (semester) {
      loadVeteranStudents(semester);
    }
  }, [semester]);

  // Fungsi untuk menyimpan data pengelompokan ke API
  const saveKelompokData = async () => {
    if (!semester || isSaving) return;
    setIsSaving(true);
    setErrorMsg("");
    try {
      const updates: { id: number; nama_kelompok: string }[] = [];
      const inserts: {
        semester: string;
        nama_kelompok: string;
        mahasiswa_id: number;
        jumlah_kelompok: number;
      }[] = [];
      const deletes: number[] = [];

      mahasiswa.forEach((m) => {
        const kelompokData = kelompokKecilData.find(
          (kk) => kk.mahasiswa_id.toString() === m.id
        );
        if (kelompokData) {
          if (!m.kelompok) {
            // Mahasiswa dikeluarkan dari kelompok
            deletes.push(kelompokData.id);
          } else if (kelompokData.nama_kelompok !== m.kelompok) {
            // Mahasiswa pindah kelompok
            updates.push({ id: kelompokData.id, nama_kelompok: m.kelompok });
          }
        } else if (m.kelompok) {
          // Mahasiswa baru masuk kelompok
          // Gunakan jumlahKelompok state yang terbaru (bisa sudah ditambah kelompok baru)
          inserts.push({
            semester,
            nama_kelompok: m.kelompok,
            mahasiswa_id: parseInt(m.id),
            jumlah_kelompok: jumlahKelompok,
          });
        }
      });

      // Lakukan batch update jika ada
      if (updates.length > 0) {
        await kelompokKecilApi.batchUpdate(updates);
      }
      // Lakukan insert satu per satu jika ada
      if (inserts.length > 0) {
        for (const insertData of inserts) {
          await kelompokKecilApi.create(insertData);
        }
      }
      // Lakukan delete satu per satu jika ada
      if (deletes.length > 0) {
        for (const id of deletes) {
          await kelompokKecilApi.delete(id);
        }
      }

      if (
        updates.length === 0 &&
        inserts.length === 0 &&
        deletes.length === 0
      ) {
      }

      setShowSaveNotification(true);
      setHasSavedData(true);
      setHasUnsavedChanges(false);
      setSuccess("Data kelompok kecil berhasil disimpan.");

      // Sembunyikan notifikasi save setelah 3 detik
      setTimeout(() => {
        setShowSaveNotification(false);
      }, 5000);

      await loadData();
    } catch (error: any) {
      console.error("Error saving kelompok data:", error);
      console.error("Error details:", handleApiError(error, "Menyimpan data kelompok"));
      setErrorMsg(handleApiError(error, "Menyimpan data kelompok"));
    } finally {
      setIsSaving(false);
    }
  };

  // Fungsi untuk memuat data pengelompokan dari API
  const loadKelompokData = async () => {
    if (!semester) return;

    try {
      const response = await kelompokKecilApi.getBySemester(
        String(mapSemesterToNumber(semester))
      );
      setKelompokKecilData(response.data);

      // Update mahasiswa with kelompok data
      setMahasiswa((prev) => {
        const updatedMahasiswa = [...prev];
        response.data.forEach((kk) => {
          const index = updatedMahasiswa.findIndex(
            (m) => m.id === kk.mahasiswa_id.toString()
          );
          if (index !== -1) {
            updatedMahasiswa[index] = {
              ...updatedMahasiswa[index],
              kelompok: kk.nama_kelompok,
            };
          }
        });
        return updatedMahasiswa;
      });

      setJumlahKelompok(
        response.data.length > 0 ? response.data[0].jumlah_kelompok : 3
      );
      setShowKelompok(true);
      setShowLoadNotification(true);
      setHasUnsavedChanges(false); // Pastikan tidak ada perubahan yang belum disimpan

      // Sembunyikan notifikasi setelah 3 detik
      setTimeout(() => {
        setShowLoadNotification(false);
      }, 3000);
    } catch (error: any) {
      console.error("Error loading kelompok data:", error);
      console.error("Error details:", handleApiError(error, "Memuat data kelompok tersimpan"));
      alert(handleApiError(error, "Memuat data kelompok tersimpan"));
    }
  };

  // Fungsi untuk mengecek apakah ada data tersimpan
  const checkSavedData = () => {
    return kelompokKecilData.length > 0;
  };

  // Otomatis load data kelompok jika ada data tersimpan saat halaman dibuka
  useEffect(() => {
    if (semester && checkSavedData()) {
      loadKelompokData();
    }
    // eslint-disable-next-line
  }, [semester]);

  // Mengunci scroll ketika modal terbuka
  useEffect(() => {
    if (showResetModal) {
      // Kunci scroll
      document.body.style.overflow = "hidden";
      document.body.style.paddingRight = "0px"; // Mencegah layout shift
    } else {
      // Kembalikan scroll
      document.body.style.overflow = "unset";
      document.body.style.paddingRight = "0px";
    }

    // Cleanup ketika component unmount
    return () => {
      document.body.style.overflow = "unset";
      document.body.style.paddingRight = "0px";
    };
  }, [showResetModal]);

  // Handle escape key untuk menutup modal
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && showResetModal) {
        setShowResetModal(false);
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [showResetModal]);

  // Peringatan sebelum meninggalkan halaman
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue =
          "Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin ingin meninggalkan halaman ini?";
        return e.returnValue;
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const handleBack = () => {
    if (hasUnsavedChanges) {
      setShowLeaveModal(() => () => navigate("/generate/kelompok"));
      return;
    }
    navigate("/generate/kelompok");
  };

  const handleSelectMahasiswa = (mahasiswaId: string) => {
    setSelectedMahasiswa((prev) => {
      if (prev.includes(mahasiswaId)) {
        return prev.filter((id) => id !== mahasiswaId);
      } else {
        return [...prev, mahasiswaId];
      }
    });
  };

  // Filter mahasiswa berdasarkan angkatan, IPK, dan search
  const filteredMahasiswa = mahasiswa.filter((m) => {
    // EXCLUDE veteran dari mahasiswa terdaftar untuk mencegah duplikasi
    // Veteran hanya muncul di section "Mahasiswa Veteran"
    if (m.is_veteran) {
      return false;
    }
    
    // Filter angkatan
    if (filterAngkatan !== "semua" && m.angkatan !== filterAngkatan) {
      return false;
    }
    // Filter IPK
    if (filterIPK !== "semua") {
      const ipkValue = parseFloat(filterIPK);
      if (m.ipk < ipkValue) {
        return false;
      }
    }
    // Filter veteran (untuk mahasiswa biasa saja)
    if (filterVeteran !== "semua") {
      if (filterVeteran === "veteran") {
        return false; // Veteran sudah di-exclude di atas
      }
      if (filterVeteran === "biasa" && m.is_veteran) {
        return false;
      }
    }
    // Filter search
    if (searchQuery.trim() !== "") {
      const q = searchQuery.trim().toLowerCase();
      if (
        !m.nama.toLowerCase().includes(q) &&
        !m.nim.toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  // Fungsi untuk handle selection veteran
  const handleSelectVeteran = (veteranId: string) => {
    setSelectedVeterans((prev) => {
      const newSelection = prev.includes(veteranId) 
        ? prev.filter((id) => id !== veteranId)
        : [...prev, veteranId];
      
      
      return newSelection;
    });
  };

  // Fungsi untuk select all veterans
  const handleSelectAllVeterans = () => {
    const availableVeteranIds = veteranStudents.filter(v => v.is_available).map(v => v.id);
    const allSelected = availableVeteranIds.every(id => selectedVeterans.includes(id));
    
    
    if (allSelected) {
      setSelectedVeterans([]);
    } else {
      setSelectedVeterans(availableVeteranIds);
    }
  };

  const generateKelompok = async () => {
    setErrorMsg("");
    if (!semester) {
      setErrorMsg("Semester tidak ditemukan!");
      return;
    }
    if (selectedMahasiswa.length === 0 && selectedVeterans.length === 0) {
      setErrorMsg("Pilih minimal satu mahasiswa untuk dikelompokkan");
      return;
    }
    if (jumlahKelompok < 1) {
      setErrorMsg("Jumlah kelompok minimal 1");
      return;
    }
    setIsGenerating(true);
    try {
      
      // Siapkan data mahasiswa untuk pengelompokan
      let mahasiswaIds = selectedMahasiswa.map((id) => parseInt(id));
      
      // Jika ada veteran yang dipilih, tambahkan veteran yang dipilih ke pengelompokan
      if (showVeteranSection && selectedVeterans.length > 0) {
        const veteranIds = selectedVeterans.map(v => parseInt(v));
        
        // TAMBAHKAN VETERAN KE KELOMPOK BESAR TERLEBIH DAHULU
        try {
          await kelompokBesarApi.create({
            semester: String(mapSemesterToNumber(semester)),
            mahasiswa_ids: veteranIds,
            is_veteran_addition: true // Flag untuk menandai ini adalah penambahan veteran
          });
        } catch (error) {
          console.error('Error adding veterans to kelompok besar:', error);
          // Jika error, coba tambahkan satu per satu
          for (const veteranId of veteranIds) {
            try {
              await kelompokBesarApi.create({
                semester: String(mapSemesterToNumber(semester)),
                mahasiswa_ids: [veteranId],
                is_veteran_addition: true // Flag untuk menandai ini adalah penambahan veteran
              });
            } catch (singleError) {
              console.error(`Error adding veteran ${veteranId} to kelompok besar:`, singleError);
              // Lanjutkan meskipun ada error
            }
          }
        }

        // UPDATE VETERAN SEMESTER untuk veteran yang dipilih (kecuali multi-veteran)
        try {
          for (const veteranId of veteranIds) {
            try {
              // Cek apakah veteran ini adalah multi-veteran
              const veteran = veteranStudents.find(v => v.id.toString() === veteranId.toString());
              const isMultiVeteran = veteran?.is_multi_veteran;
              
              if (!isMultiVeteran) {
                // Hanya update veteran_semesters untuk veteran biasa
                await mahasiswaVeteranApi.toggleVeteran({
                  user_id: veteranId,
                  is_veteran: true,
                  veteran_semester: semester
                });
              } else {
                // Untuk multi-veteran, tambahkan ke veteran_semesters
                await mahasiswaVeteranApi.addToSemester({
                  user_id: veteranId,
                  semester: semester
                });
              }
            } catch (singleError) {
              console.error(`Error updating veteran ${veteranId} semester:`, singleError);
              // Lanjutkan meskipun ada error
            }
          }
        } catch (error) {
          console.error('Error updating veteran semester:', error);
        }

        // TAMBAHKAN VETERAN KE MAHASISWA IDS
        mahasiswaIds = [...mahasiswaIds, ...veteranIds];
      }

      const res = await kelompokKecilApi.generate({
        semester: String(mapSemesterToNumber(semester)),
        mahasiswa_ids: mahasiswaIds,
        jumlah_kelompok: jumlahKelompok,
      });

      await loadData();
      setShowKelompok(true);
      setHasUnsavedChanges(false);
      setHasSavedData(true);
      setSuccess("Kelompok kecil berhasil digenerate.");
      setSelectedMahasiswa([]);
      setSelectedVeterans([]);
    } catch (error: any) {
      console.error("Error generating kelompok:", error);
      console.error("Error details:", handleApiError(error, "Mengenerate kelompok"));
      setErrorMsg(handleApiError(error, "Mengenerate kelompok"));
    } finally {
      setIsGenerating(false);
    }
  };

  const [isResetting, setIsResetting] = useState(false);

  // Fungsi untuk menambahkan kelompok baru
  const tambahKelompok = async () => {
    if (!semester || jumlahKelompokTambah < 1) {
      setErrorMsg("Jumlah kelompok tambahan minimal 1");
      return;
    }
    
    setIsAddingKelompok(true);
    setErrorMsg("");
    
    try {
      const jumlahBaru = jumlahKelompok + jumlahKelompokTambah;
      
      // Update jumlah_kelompok di semua data kelompok kecil yang ada
      // Karena API batchUpdate tidak mendukung jumlah_kelompok, kita perlu update satu per satu
      // Tapi sebenarnya, jumlah_kelompok disimpan per record, jadi kita perlu update semua record
      // Pendekatan: Update state lokal dulu, kemudian ketika save, semua record baru akan memiliki jumlah_kelompok yang benar
      // Untuk record yang sudah ada, jumlah_kelompok akan tetap sama sampai user save ulang
      
      // Update state lokal
      setJumlahKelompok(jumlahBaru);
      
      // Update jumlah_kelompok di semua record yang ada dengan cara:
      // 1. Hapus semua record lama
      // 2. Buat ulang dengan jumlah_kelompok baru
      // Tapi ini terlalu kompleks. Pendekatan lebih baik:
      // Update semua record yang ada dengan jumlah_kelompok baru menggunakan update individual
      // Tapi karena API update tidak mendukung jumlah_kelompok, kita perlu pendekatan lain
      
      // Solusi: Update state lokal saja, dan ketika user save data baru atau update data,
      // jumlah_kelompok akan otomatis terupdate melalui insert/update
      
      // Untuk sekarang, kita hanya update state lokal
      // Record yang sudah ada akan tetap memiliki jumlah_kelompok lama sampai di-update
      // Record baru yang dibuat akan memiliki jumlah_kelompok baru
      
      setHasUnsavedChanges(false); // Tidak ada perubahan struktur data yang perlu disimpan
      setSuccess(`${jumlahKelompokTambah} kelompok baru berhasil ditambahkan. Total sekarang: ${jumlahBaru} kelompok.`);
      
      // Reset input
      setJumlahKelompokTambah(1);
    } catch (error: any) {
      console.error("Error adding kelompok:", error);
      console.error("Error details:", handleApiError(error, "Menambahkan kelompok"));
      setErrorMsg(handleApiError(error, "Menambahkan kelompok"));
    } finally {
      setIsAddingKelompok(false);
    }
  };

  // Download template Excel untuk import
  const downloadTemplate = async () => {
    // Data contoh untuk template
    const templateData = [
      {
        NIM: "24070100001",
        NAMA: "Contoh Mahasiswa 1",
        KELOMPOK: "1",
      },
      {
        NIM: "24070100002",
        NAMA: "Contoh Mahasiswa 2",
        KELOMPOK: "1",
      },
      {
        NIM: "24070100003",
        NAMA: "Contoh Mahasiswa 3",
        KELOMPOK: "2",
      },
      {
        NIM: "24070100004",
        NAMA: "Contoh Mahasiswa 4",
        KELOMPOK: "2",
      },
    ];

    // Buat worksheet
    const ws = XLSX.utils.json_to_sheet(templateData);

    // Set lebar kolom
    const colWidths = [
      { wch: 15 }, // NIM
      { wch: 40 }, // NAMA
      { wch: 12 }, // KELOMPOK
    ];
    ws["!cols"] = colWidths;

    // Buat workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kelompok Kecil");

    // Generate file dan download
    XLSX.writeFile(wb, "Template_Import_Kelompok_Kecil.xlsx");
  };

  // Export data ke Excel
  const exportToExcel = async () => {
    try {
      if (!semester) {
        setErrorMsg("Semester tidak ditemukan!");
        return;
      }

      // Siapkan data untuk export
      const dataToExport: any[] = [];

      // Group mahasiswa by kelompok
      const groupedByKelompok: { [key: string]: Mahasiswa[] } = {};
      mahasiswa
        .filter((m) => m.kelompok)
        .forEach((m) => {
          if (!groupedByKelompok[m.kelompok!]) {
            groupedByKelompok[m.kelompok!] = [];
          }
          groupedByKelompok[m.kelompok!].push(m);
        });

      // Sort kelompok
      const sortedKelompok = Object.keys(groupedByKelompok).sort((a, b) => {
        const aNum = parseInt(a);
        const bNum = parseInt(b);
        if (!isNaN(aNum) && !isNaN(bNum)) {
          return aNum - bNum;
        }
        return a.localeCompare(b);
      });

      // Export per kelompok
      sortedKelompok.forEach((kelompok) => {
        const mahasiswaInKelompok = groupedByKelompok[kelompok].sort((a, b) =>
          a.nama.localeCompare(b.nama)
        );
        mahasiswaInKelompok.forEach((m, index) => {
          dataToExport.push({
            NO: index + 1,
            NIM: m.nim,
            NAMA: m.nama,
            KELOMPOK: kelompok,
          });
        });
      });

      // Buat workbook baru
      const wb = XLSX.utils.book_new();

      // Buat worksheet untuk data utama
      const ws = XLSX.utils.json_to_sheet(dataToExport);

      // Set lebar kolom
      const colWidths = [
        { wch: 8 }, // NO
        { wch: 15 }, // NIM
        { wch: 40 }, // NAMA
        { wch: 12 }, // KELOMPOK
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
        ["RINGKASAN DATA KELOMPOK KECIL"],
        [""],
        ["Semester", semester],
        ["Total Mahasiswa Dikelompokkan", dataToExport.length],
        ["Jumlah Kelompok", sortedKelompok.length],
        [""],
        ["Data per Kelompok:"],
        ...sortedKelompok.map((kelompok) => [
          `Kelompok ${kelompok}`,
          groupedByKelompok[kelompok].length,
        ]),
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
      XLSX.utils.book_append_sheet(wb, ws, "Data Kelompok Kecil");
      XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

      // Generate filename dengan timestamp
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
      const filename = `Data_Kelompok_Kecil_Semester_${semester}_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, filename);
      setSuccess("Data berhasil diekspor ke Excel.");
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      setErrorMsg("Gagal mengekspor data ke Excel. Silakan coba lagi.");
    }
  };

  // Read Excel file
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
          // Normalize headers: uppercase, trim spaces
          const normalizedHeaders = rawHeaders.map((h: string) =>
            String(h).toUpperCase().trim()
          );

          const jsonData: any[] = [];
          for (let i = 1; i < aoa.length; i++) {
            const rowData: any = {};
            const currentRow = aoa[i];
            normalizedHeaders.forEach((header, index) => {
              rowData[header] = currentRow[index];
            });
            
            // Skip baris yang benar-benar kosong (semua kolom kosong)
            const isEmptyRow = Object.values(rowData).every(
              (value) => !value || String(value).trim() === ""
            );
            
            if (!isEmptyRow) {
              jsonData.push(rowData);
            }
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

  // Validate Excel data
  const validateExcelData = (
    excelData: any[],
    existingMahasiswa: Mahasiswa[]
  ): {
    errors: Array<{ row: number; field: string; message: string }>;
    cellErrors: { [key: string]: string };
  } => {
    const errors: Array<{ row: number; field: string; message: string }> = [];
    const cellErrors: { [key: string]: string } = {};

    excelData.forEach((row, index) => {
      const rowNum = index + 2; // +2 karena row 1 adalah header, dan index dimulai dari 0

      // Skip baris yang benar-benar kosong (semua kolom kosong)
      const nim = String(row.NIM || row.nim || "").trim();
      const nama = String(row.NAMA || row.nama || "").trim();
      const kelompok = String(row.KELOMPOK || row.kelompok || "").trim();
      
      const isEmptyRow = !nim && !nama && !kelompok;
      if (isEmptyRow) {
        return; // Skip baris kosong, tidak perlu divalidasi
      }

      // Validasi NIM
      if (!nim || nim === "") {
        errors.push({
          row: rowNum,
          field: "NIM",
          message: "NIM harus diisi",
        });
        cellErrors[`${rowNum}-NIM`] = "NIM harus diisi";
      } else {
        // Cek apakah NIM ada di mahasiswa yang tersedia
        const mahasiswaExists = existingMahasiswa.find(
          (m) => m.nim === nim
        );
        if (!mahasiswaExists) {
          errors.push({
            row: rowNum,
            field: "NIM",
            message: `NIM ${nim} tidak ditemukan di Kelompok Besar semester ini`,
          });
          cellErrors[`${rowNum}-NIM`] = "NIM tidak ditemukan";
        }
      }

      // Validasi NAMA (optional, tapi jika ada harus sesuai dengan NIM)
      if (nim && nama) {
        const mahasiswaExists = existingMahasiswa.find((m) => m.nim === nim);
        if (mahasiswaExists && mahasiswaExists.nama !== nama) {
          errors.push({
            row: rowNum,
            field: "NAMA",
            message: `Nama tidak sesuai dengan NIM ${nim}. Nama yang benar: ${mahasiswaExists.nama}`,
          });
          cellErrors[`${rowNum}-NAMA`] = "Nama tidak sesuai";
        }
      }

      // Validasi KELOMPOK
      if (!kelompok || kelompok === "") {
        errors.push({
          row: rowNum,
          field: "KELOMPOK",
          message: "KELOMPOK harus diisi",
        });
        cellErrors[`${rowNum}-KELOMPOK`] = "KELOMPOK harus diisi";
      } else {
        // Validasi format kelompok (harus angka atau string valid)
        const kelompokNum = parseInt(kelompok);
        if (isNaN(kelompokNum) || kelompokNum < 1) {
          errors.push({
            row: rowNum,
            field: "KELOMPOK",
            message: "KELOMPOK harus berupa angka >= 1",
          });
          cellErrors[`${rowNum}-KELOMPOK`] = "KELOMPOK harus angka >= 1";
        }
        // Tidak perlu validasi batas maksimal karena kelompok baru bisa ditambahkan melalui import
      }

      // Validasi duplikasi NIM dalam file import
      const duplicateRows = excelData.filter((otherRow, otherIdx) => {
        if (otherIdx === index) return false;
        const otherNim = String(otherRow.NIM || otherRow.nim || "").trim();
        return otherNim === nim && nim !== "";
      });

      if (duplicateRows.length > 0) {
        errors.push({
          row: rowNum,
          field: "NIM",
          message: "NIM duplikat ditemukan dalam file import",
        });
        if (!cellErrors[`${rowNum}-NIM`]) {
          cellErrors[`${rowNum}-NIM`] = "NIM duplikat";
        }
      }
    });

    return { errors, cellErrors };
  };

  // Handle import file
  const handleImport = async (e: ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    setImportedFile(file);
    try {
      const excelParsedData = await readExcelFile(file);

      // Transform data - handle various header formats
      const transformedData = excelParsedData
        .map((row) => {
          const nim = String(row.NIM || row.nim || "").trim();
          const nama = String(row.NAMA || row.nama || "").trim();
          const kelompok = String(row.KELOMPOK || row.kelompok || "").trim();

          return {
            NIM: nim,
            NAMA: nama,
            KELOMPOK: kelompok,
          };
        })
        .filter((row) => {
          // Filter baris kosong (semua kolom kosong)
          return row.NIM || row.NAMA || row.KELOMPOK;
        });

      const validationResult = validateExcelData(transformedData, mahasiswa);
      setPreviewData(transformedData);
      setValidationErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors);
      setErrorMsg("");
    } catch (err: any) {
      setErrorMsg(err.message || "Gagal membaca file Excel");
      setPreviewData([]);
      setValidationErrors([]);
      setCellErrors({});
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Handle cell edit in preview
  const handleCellEdit = (
    rowIdx: number,
    key: string,
    value: string | number
  ) => {
    setPreviewData((prev) => {
      const newData = [...prev];
      if (newData[rowIdx]) {
        newData[rowIdx][key] = value;
        // Re-validate after edit (baris kosong akan di-skip di validateExcelData)
        const validationResult = validateExcelData(newData, mahasiswa);
        setValidationErrors(validationResult.errors);
        setCellErrors(validationResult.cellErrors);
      }
      return newData;
    });
  };

  // Handle auto-fix: perbaiki data yang bisa diperbaiki secara otomatis
  const handleAutoFix = () => {
    setPreviewData((prev) => {
      const newData = [...prev];
      let fixedCount = 0;

      newData.forEach((row, index) => {
        const nim = String(row.NIM || "").trim();
        const nama = String(row.NAMA || "").trim();

        // Jika NIM ada tapi NAMA tidak sesuai, replace dengan NAMA yang benar
        if (nim) {
          const mahasiswaExists = mahasiswa.find((m) => m.nim === nim);
          if (mahasiswaExists) {
            // Jika NAMA tidak sesuai atau kosong, replace dengan NAMA yang benar
            if (!nama || mahasiswaExists.nama !== nama) {
              newData[index].NAMA = mahasiswaExists.nama;
              fixedCount++;
            }
          }
        }
      });

      // Re-validate setelah auto-fix
      const validationResult = validateExcelData(newData, mahasiswa);
      setValidationErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors);

      if (fixedCount > 0) {
        setSuccess(`${fixedCount} data berhasil diperbaiki secara otomatis.`);
        setTimeout(() => setSuccess(null), 5000);
      }

      return newData;
    });
  };

  // Handle submit import
  const handleSubmitImport = async () => {
    if (!previewData || previewData.length === 0 || !semester) return;
    setIsImporting(true);
    setErrorMsg("");
    setImportedCount(0);
    setCellErrors({});

    const validationResult = validateExcelData(previewData, mahasiswa);
    if (validationResult.errors.length > 0) {
      setValidationErrors(validationResult.errors);
      setCellErrors(validationResult.cellErrors);
      setIsImporting(false);
      return;
    }

    try {
      // Filter baris kosong sebelum memproses
      const filteredData = previewData.filter((row) => {
        const nim = String(row.NIM || "").trim();
        const nama = String(row.NAMA || "").trim();
        const kelompok = String(row.KELOMPOK || "").trim();
        return nim || nama || kelompok; // Skip baris yang benar-benar kosong
      });

      // Group data by kelompok untuk batch processing
      const dataByKelompok: { [key: string]: any[] } = {};
      filteredData.forEach((row) => {
        const kelompok = String(row.KELOMPOK || "").trim();
        if (!dataByKelompok[kelompok]) {
          dataByKelompok[kelompok] = [];
        }
        dataByKelompok[kelompok].push(row);
      });

      let totalImported = 0;
      let totalErrors = 0;

      // Cari kelompok terbesar untuk update jumlahKelompok jika perlu
      let maxKelompok = jumlahKelompok;
      Object.keys(dataByKelompok).forEach((kelompok) => {
        const kelompokNum = parseInt(kelompok);
        if (!isNaN(kelompokNum) && kelompokNum > maxKelompok) {
          maxKelompok = kelompokNum;
        }
      });

      // Update jumlahKelompok jika ada kelompok baru yang lebih besar
      if (maxKelompok > jumlahKelompok) {
        setJumlahKelompok(maxKelompok);
      }

      // Process each kelompok
      for (const [kelompok, items] of Object.entries(dataByKelompok)) {
        for (const item of items) {
          try {
            const nim = String(item.NIM || "").trim();
            const mahasiswaData = mahasiswa.find((m) => m.nim === nim);

            if (!mahasiswaData) {
              totalErrors++;
              continue;
            }

            // Cek apakah mahasiswa sudah ada di kelompok kecil
            const existingKelompokData = kelompokKecilData.find(
              (kk) => kk.mahasiswa_id.toString() === mahasiswaData.id
            );

            if (existingKelompokData) {
              // Update kelompok jika berbeda
              if (existingKelompokData.nama_kelompok !== kelompok) {
                await kelompokKecilApi.update(existingKelompokData.id, {
                  nama_kelompok: kelompok,
                });
              }
            } else {
              // Create new kelompok kecil
              await kelompokKecilApi.create({
                semester: String(mapSemesterToNumber(semester)),
                nama_kelompok: kelompok,
                mahasiswa_id: parseInt(mahasiswaData.id),
                jumlah_kelompok: maxKelompok, // Gunakan maxKelompok yang sudah dihitung
              });
            }

            totalImported++;
          } catch (err: any) {
            console.error("Error importing item:", err);
            totalErrors++;
          }
        }
      }

      // Reload data after import
      await loadData();

      setImportedCount(totalImported);
      if (totalErrors > 0) {
        setErrorMsg(
          `${totalImported} data berhasil diimpor, ${totalErrors} data gagal diimpor.`
        );
      } else {
        setSuccess(`${totalImported} data berhasil diimpor.`);
      }
      setImportedFile(null);
      setPreviewData([]);
      setValidationErrors([]);
      setCellErrors({});
      setShowImportModal(false);
    } catch (err: any) {
      setImportedCount(0);
      setErrorMsg(err.message || "Gagal mengimpor data");
      setCellErrors({});
    } finally {
      setIsImporting(false);
    }
  };

  const resetKelompok = async () => {
    setIsResetting(true);
    try {
      // Delete all kelompok kecil for this semester
      for (const kk of kelompokKecilData) {
        await kelompokKecilApi.delete(kk.id);
      }
      
      // Reset SEMUA veteran dari KelompokBesar (tidak peduli di semester mana mereka terdaftar)
      // Hapus SEMUA veteran dari KelompokBesar di semester ini
      const allVeterans = veteranStudents.filter(v => v.is_veteran);
      
      if (allVeterans.length > 0) {
        console.log('Debug: Removing all veterans from KelompokBesar:', allVeterans.map(v => ({ id: v.id, nama: v.nama, veteran_semesters: v.veteran_semesters })));
        
        for (const veteran of allVeterans) {
          try {
            // Hapus veteran dari Kelompok Besar di semester ini (tidak peduli di semester mana mereka terdaftar)
            await kelompokBesarApi.deleteByMahasiswaId(parseInt(veteran.id), String(mapSemesterToNumber(semester)));
            console.log(`Successfully removed veteran ${veteran.id} (${veteran.nama}) from KelompokBesar`);
            
            // KOSONGKAN veteran_semesters untuk veteran biasa (bukan multi-veteran)
            if (!veteran.is_multi_veteran) {
              try {
                await mahasiswaVeteranApi.toggleVeteran({
                  user_id: parseInt(veteran.id),
                  is_veteran: true,
                  veteran_semester: null // Kosongkan veteran_semesters
                });
                console.log(`Successfully cleared veteran_semesters for ${veteran.id} (${veteran.nama})`);
              } catch (veteranError) {
                console.error(`Error clearing veteran_semesters for ${veteran.id}:`, veteranError);
                // Lanjutkan meskipun ada error
              }
            }
          } catch (kelompokBesarError) {
            console.error(`Error removing veteran ${veteran.id} from Kelompok Besar:`, kelompokBesarError);
            // Lanjutkan meskipun ada error
          }
        }
      }
      
      await loadData();
      
      setSelectedMahasiswa([]);
      setSelectedVeterans([]); // Reset veteran selection juga
      setShowKelompok(false);
      setHasSavedData(false);
      setHasUnsavedChanges(false);
      setSuccess("Kelompok kecil berhasil direset.");
    } catch (error: any) {
      console.error("Error resetting kelompok:", error);
      console.error("Error details:", handleApiError(error, "Mereset kelompok"));
      setErrorMsg(handleApiError(error, "Mereset kelompok"));
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetConfirmation = () => {
    setShowResetModal(true);
  };

  const handleConfirmReset = () => {
    resetKelompok();
    setShowResetModal(false);
  };

  const handleCancelReset = () => {
    setShowResetModal(false);
  };

  // Dapatkan daftar angkatan yang tersedia
  const angkatanList = [...new Set(mahasiswa.map((m) => m.angkatan))].sort(
    (a, b) => parseInt(b) - parseInt(a)
  );

  // Dapatkan daftar kelompok yang sudah dibuat
  // Tampilkan semua kelompok dari 1 sampai jumlahKelompok, termasuk yang kosong
  const kelompokTerisi = [
    ...new Set(
      mahasiswa
        .filter((m) => m.kelompok && m.kelompok !== "unassigned")
        .map((m) => m.kelompok!)
    ),
  ].sort();
  
  // Buat array semua kelompok dari 1 sampai jumlahKelompok
  const kelompokList = Array.from({ length: jumlahKelompok }, (_, i) => {
    const kelompokNumber = String(i + 1);
    return kelompokNumber;
  });

  // Fungsi untuk handle drag start
  const handleDragStart = (e: React.DragEvent, mahasiswa: Mahasiswa) => {
    setDraggedMahasiswa(mahasiswa);
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData("text/plain", mahasiswa.id);

    // Tambahkan class untuk styling drag
    if (e.currentTarget) {
      (e.currentTarget as HTMLElement).style.opacity = "0.5";
    }
  };

  // Fungsi untuk handle drag over pada area kelompok
  const handleDragOver = (e: React.DragEvent, kelompok: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverKelompok(kelompok);
    setDropIndex(null);
    setDragOverMahasiswaId(null);
  };

  // Fungsi untuk handle drag over pada kartu mahasiswa
  const handleDragOverMahasiswa = (
    e: React.DragEvent,
    mahasiswa: Mahasiswa,
    index: number
  ) => {
    e.preventDefault();
    e.stopPropagation();

    if (!draggedMahasiswa || draggedMahasiswa.id === mahasiswa.id) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const mouseY = e.clientY;
    const elementCenterY = rect.top + rect.height / 2;

    // Tentukan apakah drop di atas atau di bawah mahasiswa ini
    if (mouseY < elementCenterY) {
      setDropIndex(index);
      setDragOverMahasiswaId(mahasiswa.id);
    } else {
      setDropIndex(index + 1);
      setDragOverMahasiswaId(mahasiswa.id);
    }
  };

  // Fungsi untuk handle drag leave
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    // Hanya reset jika benar-benar meninggalkan area drop
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDragOverKelompok(null);
      setDropIndex(null);
      setDragOverMahasiswaId(null);
    }
  };

  // Fungsi untuk handle drop
  const handleDrop = (e: React.DragEvent, targetKelompok: string) => {
    e.preventDefault();

    if (!draggedMahasiswa) return;

    // Jika mahasiswa sudah ada di kelompok yang sama, tidak perlu dipindahkan
    if (
      draggedMahasiswa.kelompok === targetKelompok ||
      (draggedMahasiswa.kelompok === undefined &&
        targetKelompok === "unassigned")
    ) {
      setDragOverKelompok(null);
      setDraggedMahasiswa(null);
      setDropIndex(null);
      setDragOverMahasiswaId(null);
      return;
    }

    // Update mahasiswa kelompok in local state only
    setMahasiswa((prev) => {
      const updated = prev.map((m) =>
        m.id === draggedMahasiswa.id
          ? {
              ...m,
              kelompok:
                targetKelompok === "unassigned" ? undefined : targetKelompok,
            }
          : m
      );

          return updated;
      });



    // Set flag bahwa ada perubahan yang belum disimpan
    setHasUnsavedChanges(true);

    setNewlyMovedMahasiswa(draggedMahasiswa.id);
    setTimeout(() => setNewlyMovedMahasiswa(null), 2000);

    setDragOverKelompok(null);
    setDraggedMahasiswa(null);
    setDropIndex(null);
    setDragOverMahasiswaId(null);
  };

  const handleDragEnd = (e: React.DragEvent) => {
    e.preventDefault();
    setDraggedMahasiswa(null);
    setDragOverKelompok(null);
    setDropIndex(null);
    setDragOverMahasiswaId(null);

    // Hapus styling drag
    if (e.currentTarget) {
      (e.currentTarget as HTMLElement).style.opacity = "1";
    }
  };

  const getKelompokStats = () => {
    const kelompokStats: {
      [key: string]: {
        total: number;
        laki: number;
        cewe: number;
        avgIPK: number;
      };
    } = {};

    mahasiswa
      .filter((m) => m.kelompok)
      .forEach((m) => {
        if (!kelompokStats[m.kelompok!]) {
          kelompokStats[m.kelompok!] = {
            total: 0,
            laki: 0,
            cewe: 0,
            avgIPK: 0,
          };
        }

        kelompokStats[m.kelompok!].total++;
        if (m.gender === "Laki-laki") {
          kelompokStats[m.kelompok!].laki++;
        } else {
          kelompokStats[m.kelompok!].cewe++;
        }
        kelompokStats[m.kelompok!].avgIPK += m.ipk;
      });

    // Calculate average IPK
    Object.keys(kelompokStats).forEach((kelompok) => {
      kelompokStats[kelompok].avgIPK =
        kelompokStats[kelompok].avgIPK / kelompokStats[kelompok].total;
    });

    return kelompokStats;
  };





  // Group kelompokKecilData by semester
  const semesterGroups: { [semester: string]: typeof kelompokKecilData } = {};
  kelompokKecilData.forEach((item) => {
    if (!semesterGroups[item.semester]) semesterGroups[item.semester] = [];
    semesterGroups[item.semester].push(item);
  });
  const semesterList = Object.entries(semesterGroups);

  // Hilangkan errorMsg setelah 5 detik
  useEffect(() => {
    if (errorMsg) {
      const timer = setTimeout(() => setErrorMsg(""), 5000);
      return () => clearTimeout(timer);
    }
  }, [errorMsg]);

  // Auto-hide success notification setelah 5 detik
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Auto-refresh data setiap 30 detik untuk mendeteksi veteran baru yang ditambahkan ke kelompok besar
  useEffect(() => {
    if (!semester) return;
    
    const interval = setInterval(async () => {
      try {
        await loadData();
      } catch (error) {
        console.error('Error auto-refreshing data:', error);
      }
    }, 30000); // Refresh setiap 30 detik

    return () => clearInterval(interval);
  }, [semester]);

  if (loading) {
    return (
      <div className="w-full mx-auto mt-5">
        {/* Skeleton Header */}
        <div className="mb-8">
          <div className="h-8 w-80 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
          <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded mb-6 animate-pulse"></div>
        </div>
        {/* Skeleton Info Box 📊 */}
        <div className="mb-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse">
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
          <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        <div className="mb-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse">
          <div className="h-4 w-64 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
          <div className="h-3 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
        </div>
        {/* Skeleton Statistik Pengelompokan */}
        <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
          <div className="flex flex-wrap justify-center gap-4 text-center">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-32">
                <div className="h-8 w-16 mx-auto bg-gray-200 dark:bg-gray-700 rounded mb-1 animate-pulse"></div>
                <div className="h-4 w-20 mx-auto bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>
        {/* Skeleton Hasil Pengelompokan */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6">
          <div className="h-6 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-4 animate-pulse"></div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700 animate-pulse"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                  <div>
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                    <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                </div>
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto">
      {/* Header */}
      <div className="mt-5">
        {/* Tombol Kembali di atas judul */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={handleBack}
            className="flex items-center gap-2 text-brand-500 hover:text-brand-600 transition-all duration-300 ease-out hover:scale-105 transform"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            <span>Kembali</span>
          </button>
          
          <div className="flex items-center gap-2">
            {showKelompok && (
              <>
                <button
                  onClick={downloadTemplate}
                  className="flex items-center gap-2 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 transition-all duration-300 ease-out hover:scale-105 transform px-3 py-2 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30"
                  title="Download Template Excel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium">Template</span>
                </button>
                <button
                  onClick={() => setShowImportModal(true)}
                  className="flex items-center gap-2 text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300 transition-all duration-300 ease-out hover:scale-105 transform px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-900/30"
                  title="Import Excel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                  <span className="text-sm font-medium">Import</span>
                </button>
                <button
                  onClick={exportToExcel}
                  className="flex items-center gap-2 text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300 transition-all duration-300 ease-out hover:scale-105 transform px-3 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-900/30"
                  title="Export Excel"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-sm font-medium">Export</span>
                </button>
              </>
            )}
            <button
              onClick={loadData}
              className="flex items-center gap-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-all duration-300 ease-out hover:scale-105 transform px-3 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700"
              title="Refresh data untuk melihat veteran baru"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              <span className="text-sm font-medium">Refresh</span>
            </button>
          </div>
        </div>
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90">
            Kelompok Semester {semester}
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            Pilih mahasiswa untuk dikelompokkan
          </p>

          {/* Informasi Data Tersimpan */}
          {allSemesterData.length > 0 && (
            <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
              <div className="flex items-center gap-2 text-gray-700 dark:text-gray-300">
                <div className="w-5 h-5 rounded-full bg-gray-500 flex items-center justify-center">
                  <span className="text-white text-xs">📊</span>
                </div>
                <span className="text-sm font-medium">
                  Total {new Set(allSemesterData.map(item => item.semester)).size} semester memiliki data
                  pengelompokan tersimpan
                </span>
              </div>
              <div className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                Semester:{" "}
                {Array.from(new Set(allSemesterData.map(item => item.semester))).sort().join(", ")}
              </div>
            </div>
          )}

          {/* Notifikasi data tersimpan */}
          {hasSavedData && (
            <div className="mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex md:flex-row flex-col items-start justify-between">
                <div className="flex flex-col md:flex-row items-start md:items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                    <span className="text-white text-xs">💾</span>
                  </div>
                  <div>
                    <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
                      Data pengelompokan tersimpan untuk semester ini
                    </span>
                    <div className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {kelompokKecilData.length} mahasiswa dalam{" "}
                      {jumlahKelompok} kelompok • Disimpan:{" "}
                      {new Date().toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Notifikasi perubahan belum disimpan */}
          {hasUnsavedChanges && (
            <div className="mt-3 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-5 h-5 rounded-full bg-yellow-500 flex items-center justify-center">
                    <span className="text-white text-xs">⚠️</span>
                  </div>
                  <span className="text-sm font-medium text-yellow-700 dark:text-yellow-300">
                    Ada perubahan yang belum disimpan
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Notifikasi Error */}
      {errorMsg && (
        <div className="mb-3 p-3 bg-red-100 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-lg">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
              <span className="text-white text-xs">!</span>
            </div>
            <span className="text-xs font-medium text-red-700 dark:text-red-300">
              {errorMsg}
            </span>
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

      {/* Ringkasan Data */}
      {showKelompok && (
        <div className="mb-6 p-4 bg-gradient-to-r from-brand-50 to-blue-50 dark:from-brand-900/20 dark:to-blue-900/20 border border-brand-200 dark:border-brand-700 rounded-lg">
          <div className="flex flex-wrap justify-center gap-4 text-center">
            <div>
              <div className="text-2xl md:text-4xl font-bold mb-1 text-brand-600 dark:text-brand-400">
                {mahasiswa.filter((m) => m.kelompok).length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Mahasiswa Dikelompokkan
              </div>
            </div>
            <div>
              <div className="text-2xl md:text-4xl font-bold mb-1 text-blue-600 dark:text-blue-400">
                {kelompokList.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Jumlah Kelompok
              </div>
            </div>
            <div>
              <div className="text-2xl md:text-4xl font-bold mb-1 text-green-600 dark:text-green-400">
                {
                  mahasiswa.filter(
                    (m) => {
                      // Filter mahasiswa yang belum dikelompokkan
                      if (m.kelompok) return false;
                      
                      // Filter veteran yang sudah dipakai di semester lain (kecuali multi-veteran)
                      if (m.is_veteran && m.veteran_semesters && m.veteran_semesters.length > 0 && !m.veteran_semesters.includes(semester) && !m.is_multi_veteran) {
                        return false;
                      }
                      
                      // Untuk veteran: jika sudah ada di kelompok besar (ada di mahasiswa array), biarkan muncul di "belum dikelompokkan"
                      // Veteran yang baru ditambahkan ke kelompok besar akan otomatis muncul di sini
                      
                      // Untuk non-veteran: semua yang belum dikelompokkan tetap muncul (tidak perlu dipilih dulu)
                      
                      return true;
                    }
                  ).length
                }
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Belum Dikelompokkan
              </div>
            </div>
            <div>
              <div className="text-2xl md:text-4xl font-bold mb-1 text-purple-600 dark:text-purple-400">
                {mahasiswa.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Total Mahasiswa
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Notifikasi Save/Load */}
      {showSaveNotification && (
        <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-6 py-3 rounded-lg shadow-lg animate-in slide-in-from-right-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-xs">✓</span>
            </div>
            <span>Data berhasil disimpan!</span>
          </div>
        </div>
      )}

      {showLoadNotification && (
        <div className="fixed top-4 right-4 z-50 bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg animate-in slide-in-from-right-4">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white text-xs">↻</span>
            </div>
            <span>Data berhasil dimuat!</span>
          </div>
        </div>
      )}

      {!showKelompok ? (
        <>
          {/* Controls */}
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6">
            <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={(() => {
                        const availableMahasiswaIds = filteredMahasiswa
                          .map((m) => m.id);
                        return (
                          availableMahasiswaIds.every((id) =>
                            selectedMahasiswa.includes(id)
                          ) && availableMahasiswaIds.length > 0
                        );
                      })()}
                      onChange={() => {
                        const availableMahasiswaIds = filteredMahasiswa
                          .map((m) => m.id);
                        const allSelected =
                          availableMahasiswaIds.every((id) =>
                            selectedMahasiswa.includes(id)
                          ) && availableMahasiswaIds.length > 0;
                        if (allSelected) {
                          setSelectedMahasiswa(
                            selectedMahasiswa.filter(
                              (id) => !availableMahasiswaIds.includes(id)
                            )
                          );
                        } else {
                          setSelectedMahasiswa(
                            Array.from(
                              new Set([
                                ...selectedMahasiswa,
                                ...availableMahasiswaIds,
                              ])
                            )
                          );
                        }
                      }}
                      className={`
                        w-5 h-5
                        appearance-none
                        rounded-md
                        border-2
                        ${(() => {
                          const availableMahasiswaIds = filteredMahasiswa
                            .map((m) => m.id);
                          return availableMahasiswaIds.every((id) =>
                            selectedMahasiswa.includes(id)
                          ) && availableMahasiswaIds.length > 0
                            ? "border-green-500 bg-green-500"
                            : "border-green-500 bg-transparent";
                        })()}
                        transition-colors
                        duration-150
                        focus:ring-2 focus:ring-green-300
                        dark:focus:ring-green-600
                        relative
                      `}
                      style={{ outline: "none" }}
                    />
                    {(function () {
                      const availableMahasiswaIds = filteredMahasiswa
                        .map((m) => m.id);
                      return (
                        availableMahasiswaIds.every((id) =>
                          selectedMahasiswa.includes(id)
                        ) && availableMahasiswaIds.length > 0
                      );
                    })() && (
                      <svg
                        className="absolute left-0 top-0 w-5 h-5 pointer-events-none"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="white"
                        strokeWidth="2.5"
                      >
                        <polyline points="5 11 9 15 15 7" />
                      </svg>
                    )}
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pilih Semua (
                    {
                      selectedMahasiswa.filter((id) =>
                        filteredMahasiswa.map((m) => m.id).includes(id)
                      ).length
                    }
                    /
                    {filteredMahasiswa.length} tersedia)
                  </span>
                </label>

                <div className="flex items-start md:items-center flex-col md:flex-row gap-4">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Angkatan:
                    </label>
                    <select
                      value={filterAngkatan}
                      onChange={(e) => setFilterAngkatan(e.target.value)}
                      className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="semua">Semua Angkatan</option>
                      {angkatanList.map((angkatan) => (
                        <option key={angkatan} value={angkatan}>
                          {angkatan}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      IPK:
                    </label>
                    <select
                      value={filterIPK}
                      onChange={(e) => setFilterIPK(e.target.value)}
                      className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="semua">Semua IPK</option>
                      <option value="3.5">IPK 3.50 ke atas</option>
                      <option value="3.0">IPK 3.00 ke atas</option>
                      <option value="2.5">IPK 2.50 ke atas</option>
                      <option value="2.0">IPK 2.00 ke atas</option>
                      <option value="1.5">IPK 1.50 ke atas</option>
                      <option value="1.0">IPK 1.00 ke atas</option>
                    </select>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                      Veteran:
                    </label>
                    <select
                      value={filterVeteran}
                      onChange={(e) => setFilterVeteran(e.target.value)}
                      className="px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                      <option value="semua">Semua</option>
                      <option value="biasa">Mahasiswa Biasa</option>
                      <option value="veteran">Veteran</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                <div className="flex items-center gap-2">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Jumlah Kelompok:
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={jumlahKelompok}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setJumlahKelompok(isNaN(val) || val < 1 ? 1 : val);
                    }}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 rounded-md focus:ring-brand-500 focus:border-brand-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  />
                </div>

                <button
                  onClick={generateKelompok}
                  disabled={selectedMahasiswa.length === 0 || isGenerating}
                  className="px-4 py-2 h-11 bg-brand-500 text-white text-sm font-medium shadow-theme-xs rounded-lg hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 ease-in-out"
                >
                  {isGenerating ? (
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
                      Memproses...
                    </>
                  ) : (
                    "Generate Kelompok"
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Daftar Mahasiswa */}
          <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Mahasiswa Terdaftar ({filteredMahasiswa.length} tersedia dari {filteredMahasiswa.length} total)
              </h3>
            </div>

            {/* Input Search */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama atau NIM..."
                className="w-full sm:w-64 px-3 py-2 rounded-md border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-800 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-green-400"
              />
              {(function () {
                const availableMahasiswaIds = filteredMahasiswa
                  .map((m) => m.id);
                const anySelected = availableMahasiswaIds.some((id) =>
                  selectedMahasiswa.includes(id)
                );
                return anySelected;
              })() && (
                <button
                  type="button"
                  onClick={() => {
                    const availableMahasiswaIds = filteredMahasiswa
                      .map((m) => m.id);
                    setSelectedMahasiswa(
                      selectedMahasiswa.filter(
                        (id) => !availableMahasiswaIds.includes(id)
                      )
                    );
                  }}
                  className="sm:ml-2 w-full sm:w-auto px-3 py-2 text-sm rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400 transition-all"
                >
                  Uncheck Semua
                </button>
              )}
            </div>

            {filteredMahasiswa.length === 0 ? (
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                  <UserIcon className="w-8 h-8 text-orange-500" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                  Belum ada mahasiswa dari Kelompok Besar
                </h3>
                <p className="text-orange-600 dark:text-orange-300">
                  Silakan pilih mahasiswa di Kelompok Besar semester ini
                  terlebih dahulu.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredMahasiswa.map((mhs) => {
                  return (
                    <div
                      key={mhs.id}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors duration-200 ${
                        selectedMahasiswa.includes(mhs.id)
                          ? "bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-700 cursor-pointer hover:bg-green-50 hover:border-green-400"
                          : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-green-50 hover:border-green-400"
                      }`}
                      onClick={() => {
                        handleSelectMahasiswa(mhs.id);
                      }}
                    >
                      <div
                        className="relative flex items-center"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={selectedMahasiswa.includes(mhs.id)}
                          onChange={() => handleSelectMahasiswa(mhs.id)}
                          className={`
                            w-5 h-5
                            appearance-none
                            rounded-md
                            border-2
                            ${
                              selectedMahasiswa.includes(mhs.id)
                                ? "border-green-500 bg-green-500"
                                : "border-green-500 bg-transparent"
                            }
                            transition-colors
                            duration-150
                            focus:ring-2 focus:ring-green-300
                            dark:focus:ring-green-600
                            relative
                            disabled:opacity-50 disabled:cursor-not-allowed
                          `}
                          style={{ outline: "none" }}
                        />
                        {selectedMahasiswa.includes(mhs.id) && (
                          <svg
                            className="absolute left-0 top-0 w-5 h-5 pointer-events-none"
                            viewBox="0 0 20 20"
                            fill="none"
                            stroke="white"
                            strokeWidth="2.5"
                          >
                            <polyline points="5 11 9 15 15 7" />
                          </svg>
                        )}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center">
                        <UserIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-800 dark:text-white/90 text-sm">
                          {mhs.nama}
                        </p>
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-xs text-gray-600 dark:text-gray-400">
                            {mhs.nim}
                          </p>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                            {mhs.angkatan}
                          </span>
                          <span
                            className={`text-xs px-2 py-0.5 rounded-full ${
                              mhs.ipk >= 3.5
                                ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                : mhs.ipk >= 3.0
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                : mhs.ipk >= 2.5
                                ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                                : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                            }`}
                          >
                            IPK {mhs.ipk.toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Mahasiswa Veteran Section */}
          {showVeteranSection && (
            <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mt-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                  Mahasiswa Veteran ({veteranStudents.filter(v => v.is_available).length} tersedia dari {veteranStudents.length} total)
                </h3>
              </div>

              {/* Select All Veterans */}
              <div className="mb-4">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <span className="relative flex items-center">
                    <input
                      type="checkbox"
                      checked={(() => {
                        const availableVeteranIds = veteranStudents.filter(v => v.is_available).map(v => v.id);
                        return (
                          availableVeteranIds.every((id) => selectedVeterans.includes(id)) && 
                          availableVeteranIds.length > 0
                        );
                      })()}
                      onChange={handleSelectAllVeterans}
                      className={`
                        w-5 h-5
                        appearance-none
                        rounded-md
                        border-2
                        ${(() => {
                          const availableVeteranIds = veteranStudents.filter(v => v.is_available).map(v => v.id);
                          return availableVeteranIds.every((id) => selectedVeterans.includes(id)) && 
                                 availableVeteranIds.length > 0
                            ? "border-green-500 bg-green-500"
                            : "border-green-500 bg-transparent";
                        })()}
                        transition-colors
                        duration-150
                        focus:ring-2 focus:ring-green-300
                        relative
                      `}
                      style={{ outline: "none" }}
                    />
                    {(() => {
                      const availableVeteranIds = veteranStudents.filter(v => v.is_available).map(v => v.id);
                      return (
                        availableVeteranIds.every((id) => selectedVeterans.includes(id)) && 
                        availableVeteranIds.length > 0
                      );
                    })() && (
                      <svg
                        className="absolute left-0 top-0 w-5 h-5 pointer-events-none"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="white"
                        strokeWidth="2.5"
                      >
                        <polyline points="5 11 9 15 15 7" />
                      </svg>
                    )}
                  </span>
                  <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                    Pilih Semua Veteran (
                    {selectedVeterans.filter((id) =>
                      veteranStudents.filter(v => v.is_available).map(v => v.id).includes(id)
                    ).length}
                    /{veteranStudents.filter(v => v.is_available).length} tersedia)
                  </span>
                </label>
              </div>

              {veteranStudents.length === 0 ? (
                <div className="text-center py-8">
                  <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
                    <UserIcon className="w-8 h-8 text-orange-500" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    Belum ada mahasiswa veteran
                  </h3>
                  <p className="text-orange-600 dark:text-orange-300">
                    Silakan tambahkan mahasiswa veteran terlebih dahulu.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {veteranStudents.map((veteran) => {
                    const isLocked = veteran.veteran_semesters && veteran.veteran_semesters.length > 0 && !veteran.veteran_semesters.includes(semester) && !veteran.is_multi_veteran;
                    const isSelected = selectedVeterans.includes(veteran.id);
                    const isAvailable = veteran.is_available;
                    
                    return (
                      <div
                        key={veteran.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-colors duration-200 ${
                          isSelected
                            ? "bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border-purple-300 dark:border-purple-600 shadow-md"
                            : isLocked
                            ? "bg-gray-100 dark:bg-gray-800/50 border-gray-300 dark:border-gray-600 opacity-60"
                            : "bg-gradient-to-r from-purple-50/50 to-purple-100/50 dark:from-purple-900/20 dark:to-purple-800/20 border-purple-200 dark:border-purple-700 hover:from-purple-100 hover:to-purple-200 hover:border-purple-400 dark:hover:from-purple-900/40 dark:hover:to-purple-800/40"
                        } ${isAvailable && !isLocked ? 'cursor-pointer' : 'cursor-not-allowed'}`}
                        onClick={() => {
                          if (isAvailable && !isLocked) {
                            handleSelectVeteran(veteran.id);
                          }
                        }}
                      >
                        <div
                          className="relative flex items-center"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isAvailable && !isLocked) {
                                handleSelectVeteran(veteran.id);
                              }
                            }}
                            disabled={!isAvailable || isLocked}
                            className={`
                              w-5 h-5
                              appearance-none
                              rounded-md
                              border-2
                              ${
                                isSelected
                                  ? "border-green-500 bg-green-500"
                                  : "border-green-500 bg-transparent"
                              }
                              transition-colors
                              duration-150
                              focus:ring-2 focus:ring-green-300
                              dark:focus:ring-green-600
                              relative
                              disabled:opacity-50 disabled:cursor-not-allowed
                            `}
                            style={{ outline: "none" }}
                          />
                          {isSelected && (
                            <svg
                              className="absolute left-0 top-0 w-5 h-5 pointer-events-none"
                              viewBox="0 0 20 20"
                              fill="none"
                              stroke="white"
                              strokeWidth="2.5"
                            >
                              <polyline points="5 11 9 15 15 7" />
                            </svg>
                          )}
                        </div>
                        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-200 to-purple-300 dark:from-purple-700 dark:to-purple-800 flex items-center justify-center relative">
                          <UserIcon className="w-4 h-4 text-purple-700 dark:text-purple-200" />
                          {/* Veteran Crown Icon */}
                          <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center">
                            <span className="text-xs font-bold text-yellow-800">👑</span>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="font-medium text-gray-800 dark:text-white/90 text-sm">
                              {veteran.nama}
                            </p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-sm">
                              Veteran
                            </span>
                          </div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {veteran.nim}
                            </p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                              {veteran.angkatan}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                              Sem {veteran.semester_asli || '?'}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full ${
                                veteran.ipk >= 3.5
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                  : veteran.ipk >= 3.0
                                  ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                  : veteran.ipk >= 2.5
                                  ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                                  : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                              }`}
                            >
                              IPK {veteran.ipk.toFixed(2)}
                            </span>
                            {isLocked && !veteran.is_multi_veteran && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300">
                                Terdaftar di {veteran.veteran_semesters.join(", ")}
                              </span>
                            )}
                            {veteran.is_multi_veteran && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-sm">
                                Multi Veteran
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <>
          {/* Hasil Kelompok */}
          <div
            className={`bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mb-6
            ${
              hasUnsavedChanges
                ? "bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800"
                : ""
            }
          `}
          >
            <div className="flex flex-col md:flex-row items-start   md:items-center  md:justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
                Hasil Pengelompokan
              </h3>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 mt-2 md:mt-0">
                {showKelompok && hasUnsavedChanges && (
                  <div className="px-4 py-2 text-xs text-red-500 rounded-lg">
                    *Belum disimpan, silahkan update*
                  </div>
                )}
                
                {/* Tambah Kelompok Section */}
                <div className="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                    Tambah:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max="10"
                    value={jumlahKelompokTambah}
                    onChange={(e) => {
                      const val = parseInt(e.target.value, 10);
                      setJumlahKelompokTambah(isNaN(val) || val < 1 ? 1 : val > 10 ? 10 : val);
                    }}
                    className="w-16 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-white"
                  />
                  <button
                    onClick={tambahKelompok}
                    disabled={isAddingKelompok || jumlahKelompokTambah < 1}
                    className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md font-medium hover:bg-blue-600 transition-all duration-300 ease-out flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isAddingKelompok ? (
                      <>
                        <svg
                          className="w-4 h-4 animate-spin text-white"
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
                        Menambah...
                      </>
                    ) : (
                      "Buat Kelompok"
                    )}
                  </button>
                </div>
                
                <button
                  onClick={saveKelompokData}
                  disabled={isSaving || !hasUnsavedChanges}
                  className="px-4 py-2 text-sm bg-brand-500 text-white rounded-lg font-medium shadow-theme-xs hover:bg-brand-600 transition-all duration-300 ease-out flex items-center gap-2 disabled:opacity-50 disabled:cursor-wait"
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
                <button
                  onClick={handleResetConfirmation}
                  className="px-4 py-2 text-sm bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-out"
                  disabled={isResetting}
                >
                  {isResetting ? (
                    <>
                      <svg
                        className="w-5 h-5 mr-2 animate-spin text-gray-700 dark:text-gray-200 inline-block align-middle"
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
                      Mereset...
                    </>
                  ) : (
                    "Reset"
                  )}
                </button>
              </div>
            </div>

            {/* Petunjuk drag and drop */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-center gap-2 text-blue-700 dark:text-blue-300">
                <div className="w-5 h-5 rounded-full bg-blue-500 flex items-center justify-center">
                  <span className="text-white text-xs">i</span>
                </div>
                <p className="text-sm font-medium">Petunjuk Drag & Drop</p>
              </div>
              <p className="text-sm text-blue-600 dark:text-blue-400 mt-1">
                Anda dapat menyeret mahasiswa dari satu kelompok ke kelompok
                lainnya untuk mengatur ulang pengelompokan. Klik dan tahan kartu
                mahasiswa, lalu seret ke posisi yang diinginkan dalam kelompok
                tujuan. Garis biru akan menunjukkan posisi drop yang tepat.
              </p>
            </div>

            {/* Statistik Pengelompokan */}
            {getKelompokStats() && (
              <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold text-gray-800 dark:text-white/90">
                    Statistik Pengelompokan
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Object.entries(getKelompokStats()).map(
                    ([kelompok, stat]) => (
                      <div
                        key={kelompok}
                        className="p-3 bg-white dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h5 className="font-medium text-gray-800 dark:text-white/90">
                            Kelompok {kelompok}
                          </h5>
                          <span className="text-xs px-2 py-1 bg-brand-500 text-white rounded-full">
                            {stat.total} mahasiswa
                          </span>
                        </div>
                        <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                          <p>👨 Laki-laki: {stat.laki}</p>
                          <p>👩 Perempuan: {stat.cewe}</p>
                          <p>📊 Rata-rata IPK: {stat.avgIPK.toFixed(2)}</p>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {kelompokList.map((kelompok) => {
                const mahasiswaKelompok = mahasiswa.filter(
                  (m) => m.kelompok === kelompok
                );
                return (
                  <div
                    key={kelompok}
                    className={`bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-all duration-500 ease-out transform ${
                      dragOverKelompok === kelompok
                        ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-lg scale-[1.02]"
                        : "hover:shadow-md"
                    }`}
                    onDragOver={(e) => handleDragOver(e, kelompok)}
                    onDragLeave={handleDragLeave}
                    onDrop={(e) => handleDrop(e, kelompok)}
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-brand-500 flex items-center justify-center">
                        <span className="text-white font-bold">{kelompok}</span>
                      </div>
                      <div>
                        <h4 className="font-semibold text-gray-800 dark:text-white/90">
                          Kelompok {kelompok}
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          {mahasiswaKelompok.length} mahasiswa
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2">
                      {mahasiswaKelompok.map((mhs, index) => (
                        <React.Fragment key={mhs.id}>
                          {/* Drop indicator di atas mahasiswa */}
                          {dragOverMahasiswaId === mhs.id &&
                            dropIndex === index && (
                              <div className="h-1 bg-brand-500 rounded-full my-1 animate-pulse transition-all duration-200 ease-out transform scale-x-100"></div>
                            )}

                          <div
                            draggable
                            onDragStart={(e) => handleDragStart(e, mhs)}
                            onDragEnd={handleDragEnd}
                            onDragOver={(e) =>
                              handleDragOverMahasiswa(e, mhs, index)
                            }
                            className={`flex items-center gap-2 p-2 rounded-lg cursor-move transition-all duration-300 ease-out hover:shadow-md transform ${
                              mhs.is_veteran
                                ? "bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-200 dark:border-purple-700"
                                : "bg-white dark:bg-gray-700"
                            } ${
                              draggedMahasiswa?.id === mhs.id
                                ? "opacity-50 scale-95 rotate-1"
                                : newlyMovedMahasiswa === mhs.id
                                ? mhs.is_veteran
                                  ? "bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900/40 dark:to-green-800/40 border-2 border-green-300 dark:border-green-600 scale-105 shadow-lg animate-pulse"
                                  : "bg-green-100 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-600 scale-105 shadow-lg animate-pulse"
                                : mhs.is_veteran
                                  ? "hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-900/50 dark:hover:to-purple-800/50 hover:scale-[1.02] hover:-translate-y-0.5"
                                  : "hover:bg-gray-50 dark:hover:bg-gray-600 hover:scale-[1.02] hover:-translate-y-0.5"
                            }`}
                          >
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center relative ${
                              mhs.is_veteran 
                                ? "bg-gradient-to-br from-purple-200 to-purple-300 dark:from-purple-700 dark:to-purple-800" 
                                : "bg-gray-200 dark:bg-gray-600"
                            }`}>
                              <UserIcon className={`w-3 h-3 ${
                                mhs.is_veteran 
                                  ? "text-purple-700 dark:text-purple-200" 
                                  : "text-gray-600 dark:text-gray-400"
                              }`} />
                              {/* Veteran Crown Icon */}
                              {mhs.is_veteran && (
                                <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center">
                                  <span className="text-xs font-bold text-yellow-800">👑</span>
                                </div>
                              )}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <p className="font-medium text-gray-800 dark:text-white/90 text-sm">
                                  {mhs.nama}
                                </p>
                                {mhs.is_veteran && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-sm">
                                    Veteran
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2">
                                <p className="text-xs text-gray-600 dark:text-gray-400">
                                  {mhs.nim}
                                </p>
                                <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                                  {mhs.angkatan}
                                </span>
                                {mhs.is_veteran && mhs.semester_asli && (
                                  <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                                    Sem {mhs.semester_asli}
                                  </span>
                                )}
                                <span
                                  className={`text-xs px-2 py-0.5 rounded-full ${
                                    mhs.ipk >= 3.5
                                      ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                      : mhs.ipk >= 3.0
                                      ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                      : mhs.ipk >= 2.5
                                      ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                                      : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                                  }`}
                                >
                                  IPK {mhs.ipk.toFixed(2)}
                                </span>
                              </div>
                            </div>
                            <div className="text-gray-400 dark:text-gray-500 text-xs">
                              ⋮⋮
                            </div>
                          </div>

                          {/* Drop indicator di bawah mahasiswa */}
                          {dragOverMahasiswaId === mhs.id &&
                            dropIndex === index + 1 && (
                              <div className="h-1 bg-brand-500 rounded-full my-1 animate-pulse transition-all duration-200 ease-out transform scale-x-100"></div>
                            )}
                        </React.Fragment>
                      ))}

                      {/* Area drop kosong jika tidak ada mahasiswa */}
                      {mahasiswaKelompok.length === 0 && (
                        <div className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 text-sm transition-all duration-300 ease-out hover:border-brand-400 hover:text-brand-600 dark:hover:border-brand-500 dark:hover:text-brand-400 hover:bg-brand-50 dark:hover:bg-brand-900/10">
                          <div className="flex items-center gap-2">
                            <div className="w-4 h-4 border-2 border-current border-dashed rounded-full animate-spin"></div>
                            Seret mahasiswa ke sini
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Area untuk mahasiswa yang belum dikelompokkan */}
              <div
                className={`bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-all duration-500 ease-out transform ${
                  dragOverKelompok === "unassigned"
                    ? "border-orange-500 bg-orange-50 dark:bg-orange-900/20 shadow-lg scale-[1.02]"
                    : "hover:shadow-md"
                }`}
                onDragOver={(e) => handleDragOver(e, "unassigned")}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, "unassigned")}
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-full bg-orange-500 flex items-center justify-center">
                    <span className="text-white font-bold">?</span>
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-800 dark:text-white/90">
                      Belum Dikelompokkan
                    </h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {
                        mahasiswa.filter(
                          (m) => {
                            // Filter mahasiswa yang belum dikelompokkan
                            if (m.kelompok) return false;
                            
                            // Filter veteran yang sudah dipakai di semester lain (kecuali multi-veteran)
                            if (m.is_veteran && m.veteran_semesters && m.veteran_semesters.length > 0 && !m.veteran_semesters.includes(semester) && !m.is_multi_veteran) {
                              return false;
                            }
                            
                            // Untuk veteran: jika sudah ada di kelompok besar (ada di mahasiswa array), biarkan muncul di "belum dikelompokkan"
                            // Veteran yang baru ditambahkan ke kelompok besar akan otomatis muncul di sini
                            
                            // Untuk non-veteran: semua yang belum dikelompokkan tetap muncul (tidak perlu dipilih dulu)
                            
                            return true;
                          }
                        ).length
                      }{" "}
                      mahasiswa
                    </p>
                  </div>
                </div>

                <div className="space-y-2">
                  {mahasiswa
                    .filter(
                      (m) => {
                        // Filter mahasiswa yang belum dikelompokkan
                        if (m.kelompok) return false;
                        
                        // Filter veteran yang sudah dipakai di semester lain (kecuali multi-veteran)
                        if (m.is_veteran && m.veteran_semesters && m.veteran_semesters.length > 0 && !m.veteran_semesters.includes(semester) && !m.is_multi_veteran) {
                          return false;
                        }
                        
                        // Untuk veteran: jika sudah ada di kelompok besar (ada di mahasiswa array), biarkan muncul di "belum dikelompokkan"
                        // Veteran yang baru ditambahkan ke kelompok besar akan otomatis muncul di sini
                        
                        // Untuk non-veteran: semua yang belum dikelompokkan tetap muncul (tidak perlu dipilih dulu)
                        
                        return true;
                      }
                    )
                    .map((mhs, index) => (
                      <React.Fragment key={mhs.id}>
                        {/* Drop indicator di atas mahasiswa */}
                        {dragOverMahasiswaId === mhs.id &&
                          dropIndex === index && (
                            <div className="h-1 bg-orange-500 rounded-full my-1 animate-pulse transition-all duration-200 ease-out transform scale-x-100"></div>
                          )}

                        <div
                          draggable
                          onDragStart={(e) => handleDragStart(e, mhs)}
                          onDragEnd={handleDragEnd}
                          onDragOver={(e) =>
                            handleDragOverMahasiswa(e, mhs, index)
                          }
                          className={`flex items-center gap-2 p-2 rounded-lg cursor-move transition-all duration-300 ease-out hover:shadow-md transform ${
                            mhs.is_veteran
                              ? "bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30 border border-purple-200 dark:border-purple-700"
                              : "bg-white dark:bg-gray-700"
                          } ${
                            draggedMahasiswa?.id === mhs.id
                              ? "opacity-50 scale-95 rotate-1"
                              : newlyMovedMahasiswa === mhs.id
                              ? mhs.is_veteran
                                ? "bg-gradient-to-r from-green-100 to-green-200 dark:from-green-900/40 dark:to-green-800/40 border-2 border-green-300 dark:border-green-600 scale-105 shadow-lg animate-pulse"
                                : "bg-green-100 dark:bg-green-900/20 border-2 border-green-300 dark:border-green-600 scale-105 shadow-lg animate-pulse"
                              : mhs.is_veteran
                                ? "hover:from-purple-100 hover:to-purple-200 dark:hover:from-purple-900/50 dark:hover:to-purple-800/50 hover:scale-[1.02] hover:-translate-y-0.5"
                                : "hover:bg-gray-50 dark:hover:bg-gray-600 hover:scale-[1.02] hover:-translate-y-0.5"
                          }`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center relative ${
                            mhs.is_veteran 
                              ? "bg-gradient-to-br from-purple-200 to-purple-300 dark:from-purple-700 dark:to-purple-800" 
                              : "bg-gray-200 dark:bg-gray-600"
                          }`}>
                            <UserIcon className={`w-3 h-3 ${
                              mhs.is_veteran 
                                ? "text-purple-700 dark:text-purple-200" 
                                : "text-gray-600 dark:text-gray-400"
                            }`} />
                            {/* Veteran Crown Icon */}
                            {mhs.is_veteran && (
                              <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full flex items-center justify-center">
                                <span className="text-xs font-bold text-yellow-800">👑</span>
                              </div>
                            )}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className="font-medium text-gray-800 dark:text-white/90 text-sm">
                                {mhs.nama}
                              </p>
                              {mhs.is_veteran && (
                                <span className="text-xs px-1.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-purple-600 text-white font-bold shadow-sm">
                                  V
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {mhs.nim}
                              </p>
                              <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                                {mhs.angkatan}
                              </span>
                              {mhs.is_veteran && mhs.semester_asli && (
                                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                                  Sem {mhs.semester_asli}
                                </span>
                              )}
                              <span
                                className={`text-xs px-2 py-0.5 rounded-full ${
                                  mhs.ipk >= 3.5
                                    ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                    : mhs.ipk >= 3.0
                                    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                                    : mhs.ipk >= 2.5
                                    ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300"
                                    : "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300"
                                }`}
                              >
                                IPK {mhs.ipk.toFixed(2)}
                              </span>
                            </div>
                          </div>
                          <div className="text-gray-400 dark:text-gray-500 text-xs">
                            ⋮⋮
                          </div>
                        </div>

                        {/* Drop indicator di bawah mahasiswa */}
                        {dragOverMahasiswaId === mhs.id &&
                          dropIndex === index + 1 && (
                            <div className="h-1 bg-orange-500 rounded-full my-1 animate-pulse transition-all duration-200 ease-out transform scale-x-100"></div>
                          )}
                      </React.Fragment>
                    ))}

                  {/* Area drop kosong jika tidak ada mahasiswa */}
                  {mahasiswa.filter(
                    (m) => !m.kelompok
                  ).length === 0 && (
                    <div className="flex items-center justify-center p-4 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg text-gray-500 dark:text-gray-400 text-sm transition-all duration-300 ease-out hover:border-orange-400 hover:text-orange-600 dark:hover:border-orange-500 dark:hover:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/10">
                      <div className="flex items-center gap-2">
                        <div className="w-4 h-4 border-2 border-current border-dashed rounded-full animate-spin"></div>
                        Seret mahasiswa ke sini untuk menghapus dari kelompok
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Alert Konfirmasi Reset */}
      <AnimatePresence>
        {showResetModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handleCancelReset}
            ></motion.div>
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg z-[100001]"
            >
              {/* Header: Icon dan judul */}
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mr-4">
                  <svg
                    className="w-8 h-8 text-red-500"
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
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white leading-tight">
                    Konfirmasi Reset
                  </h3>
                  <p className="text-base text-gray-500 dark:text-gray-400 mt-1">
                    Reset pengelompokan
                  </p>
                </div>
              </div>
              {/* Pesan utama */}
              <p className="text-lg text-gray-800 dark:text-white text-center font-medium mb-6">
                Apakah Anda yakin ingin mereset pengelompokan?
              </p>
              {/* Box warning merah */}
              <div className="flex items-start gap-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 mb-8">
                <svg
                  className="w-6 h-6 text-red-500 dark:text-red-300 mt-1 flex-shrink-0"
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
                  <p className="font-bold text-red-500 dark:text-red-300 mb-1">
                    Tindakan ini tidak dapat dibatalkan!
                  </p>
                  <p className="text-red-500 dark:text-red-300 leading-snug">
                    Semua data pengelompokan akan dihapus dan Anda harus membuat
                    ulang dari awal.
                  </p>
                </div>
              </div>
              {/* Tombol aksi */}
              <div className="flex gap-4 w-full mt-2">
                <button
                  onClick={handleCancelReset}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-out"
                  disabled={isResetting}
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmReset}
                  className="flex-1 px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-all duration-300 ease-out"
                  disabled={isResetting}
                >
                  {isResetting ? (
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
                      Mereset...
                    </>
                  ) : (
                    "Reset"
                  )}
                </button>
              </div>
              {/* Tombol close di kanan atas */}
              <button
                onClick={handleCancelReset}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent rounded-full p-1 transition-colors duration-200"
                aria-label="Tutup"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modal Konfirmasi Keluarkan Mahasiswa dari Semester Lain */}
      <AnimatePresence>
        {showKeluarkanModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowKeluarkanModal(null)}
            ></motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg z-[100001]"
            >
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mr-4">
                  <svg
                    className="w-8 h-8 text-red-500"
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
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white leading-tight">
                    Konfirmasi Keluarkan
                  </h3>
                  <p className="text-base text-gray-500 dark:text-gray-400 mt-1">
                    Keluarkan mahasiswa dari semester lain
                  </p>
                </div>
              </div>
              <p className="text-lg text-gray-800 dark:text-white text-center font-medium mb-6">
                Apakah Anda yakin ingin mengeluarkan{" "}
                <span className="font-bold text-red-500">
                  {showKeluarkanModal.nama}
                </span>{" "}
                dari semester{" "}
                <span className="font-bold text-red-500">
                  {showKeluarkanModal.semester}
                </span>
                ?
              </p>
              <div className="flex gap-4 w-full mt-2">
                <button
                  onClick={() => setShowKeluarkanModal(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-out"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    // Proses keluarkan
                    const key = `kelompok_${showKeluarkanModal.semester}`;
                    const savedData = localStorage.getItem(key);
                    if (savedData) {
                      try {
                        const parsedData = JSON.parse(savedData);
                        parsedData.mahasiswa = parsedData.mahasiswa.filter(
                          (m: any) => m.id !== showKeluarkanModal.id
                        );
                        localStorage.setItem(key, JSON.stringify(parsedData));
                        setShowKeluarkanModal(null);
                        window.location.reload();
                      } catch {
                        alert(
                          "Gagal mengeluarkan mahasiswa dari semester sebelumnya!"
                        );
                      }
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-all duration-300 ease-out"
                >
                  Keluarkan
                </button>
              </div>
              <button
                onClick={() => setShowKeluarkanModal(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent rounded-full p-1 transition-colors duration-200"
                aria-label="Tutup"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modal Konfirmasi Hapus Data Pengelompokan */}
      <AnimatePresence>
        {showDeleteModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowDeleteModal(null)}
            ></motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg z-[100001]"
            >
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mr-4">
                  <svg
                    className="w-8 h-8 text-red-500"
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
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white leading-tight">
                    Konfirmasi Hapus
                  </h3>
                  <p className="text-base text-gray-500 dark:text-gray-400 mt-1">
                    Hapus data pengelompokan semester
                  </p>
                </div>
              </div>
              <p className="text-lg text-gray-800 dark:text-white text-center font-medium mb-6">
                Apakah Anda yakin ingin menghapus data pengelompokan untuk{" "}
                <span className="font-bold text-red-500">
                  Semester {showDeleteModal.semester}
                </span>
                ?
              </p>
              <div className="flex gap-4 w-full mt-2">
                <button
                  onClick={() => setShowDeleteModal(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-out"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    const key = `kelompok_${showDeleteModal.semester}`;
                    localStorage.removeItem(key);
                    setShowDeleteModal(null);
                    // Cek apakah masih ada data kelompok lain setelah hapus
                    setTimeout(() => {
                      const sisaData = [];
                      for (let i = 0; i < localStorage.length; i++) {
                        const key = localStorage.key(i);
                        if (key && key.startsWith("kelompok_")) {
                          const semesterKey = key.replace("kelompok_", "");
                          sisaData.push(semesterKey);
                        }
                      }
                      if (sisaData.length > 0) {
                        navigate(`/generate/kelompok/${sisaData[0]}`);
                      } else {
                        navigate("/generate/kelompok");
                      }
                    }, 100);
                  }}
                  className="flex-1 px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-all duration-300 ease-out"
                >
                  Hapus
                </button>
              </div>
              <button
                onClick={() => setShowDeleteModal(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-gray-800 dark:hover:text-white bg-transparent rounded-full p-1 transition-colors duration-200"
                aria-label="Tutup"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Modal Konfirmasi Keluar Jika Ada Perubahan Belum Disimpan */}
      <AnimatePresence>
        {showLeaveModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowLeaveModal(null)}
            ></motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-2xl p-8 shadow-lg z-[100001]"
            >
              <div className="flex items-center mb-6">
                <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mr-4">
                  <svg
                    className="w-8 h-8 text-red-500"
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
                <div>
                  <h3 className="text-2xl font-bold text-gray-800 dark:text-white leading-tight">
                    Konfirmasi Keluar
                  </h3>
                  <p className="text-base text-red-500 dark:text-red-400 mt-1">
                    Perubahan Belum Disimpan
                  </p>
                </div>
              </div>
              <p className="text-lg text-gray-800 dark:text-white text-center font-medium mb-6">
                Anda memiliki perubahan yang belum disimpan. Apakah Anda yakin
                ingin meninggalkan halaman ini?
              </p>
              <div className="flex gap-4 w-full mt-2">
                <button
                  onClick={() => setShowLeaveModal(null)}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-out"
                >
                  Batal
                </button>
                <button
                  onClick={() => {
                    if (showLeaveModal) showLeaveModal();
                    setShowLeaveModal(null);
                  }}
                  className="flex-1 px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 transition-all duration-300 ease-out"
                >
                  Lanjutkan
                </button>
              </div>
              <button
                onClick={() => setShowLeaveModal(null)}
                className="absolute top-4 right-4 text-gray-400 hover:text-red-500 dark:hover:text-white bg-transparent rounded-full p-1 transition-colors duration-200"
                aria-label="Tutup"
              >
                <svg
                  className="w-6 h-6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {semesterList.length > 0 && (
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {semesterList.map(([sem, items]) => (
              <div
                key={sem}
                className={`p-4 rounded-lg border transition-all duration-200 ${
                  sem === semester
                    ? "bg-brand-50 dark:bg-brand-900/20 border-brand-200 dark:border-brand-700"
                    : "bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700"
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <h4 className="font-semibold text-gray-800 dark:text-white/90">
                    Semester {sem}
                  </h4>
                  {sem === semester && (
                    <span className="text-xs px-2 py-1 bg-brand-500 text-white rounded-full">
                      Aktif
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <p>{items.length} mahasiswa dikelompokkan</p>
                  <p>{items[0]?.jumlah_kelompok || 0} kelompok dibuat</p>
                </div>
                <div className="flex items-center gap-2 mt-3">
                  {sem !== semester && (
                    <button
                      onClick={() => {
                        if (hasUnsavedChanges) {
                          setShowLeaveModal(
                            () => () => navigate(`/generate/kelompok/${sem}`)
                          );
                          return;
                        }
                        navigate(`/generate/kelompok/${sem}`);
                      }}
                      className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                        />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth="2"
                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                        />
                      </svg>
                      Lihat
                    </button>
                  )}
                  <button
                    onClick={() => setShowDeleteModal({ semester: sem })}
                    className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                    Hapus
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Import Excel */}
      <AnimatePresence>
        {showImportModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed top-0 left-0 right-0 bottom-0 z-[100000] bg-black/40 dark:bg-black/60 backdrop-blur-sm"
              style={{ width: "100vw", height: "100vh", minHeight: "100vh" }}
              onClick={() => {
                if (!isImporting) {
                  setShowImportModal(false);
                  setPreviewData([]);
                  setValidationErrors([]);
                  setCellErrors({});
                  setImportedFile(null);
                }
              }}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="fixed inset-0 z-[100001] flex items-center justify-center p-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Import Data dari Excel
                  </h3>
                  <button
                    onClick={() => {
                      if (!isImporting) {
                        setShowImportModal(false);
                        setPreviewData([]);
                        setValidationErrors([]);
                        setCellErrors({});
                        setImportedFile(null);
                      }
                    }}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    disabled={isImporting}
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
                <div className="flex-1 overflow-y-auto p-6">
                  {!importedFile ? (
                    <div className="space-y-4">
                      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-8 text-center">
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept=".xlsx,.xls"
                          onChange={handleImport}
                          className="hidden"
                          id="import-file-input"
                        />
                        <label
                          htmlFor="import-file-input"
                          className="cursor-pointer flex flex-col items-center gap-4"
                        >
                          <svg
                            className="w-16 h-16 text-gray-400"
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
                          <div>
                            <p className="text-lg font-medium text-gray-700 dark:text-gray-300">
                              Klik untuk memilih file Excel
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                              Format: .xlsx atau .xls
                            </p>
                          </div>
                        </label>
                      </div>
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                        <p className="text-sm text-blue-800 dark:text-blue-300">
                          <strong>Catatan:</strong> Pastikan file Excel mengikuti
                          format template. Download template terlebih dahulu jika
                          belum punya. Kolom yang diperlukan: NIM, NAMA, KELOMPOK.
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {/* File Info */}
                      <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <svg
                            className="w-8 h-8 text-green-500"
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
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {importedFile.name}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400">
                              {(importedFile.size / 1024).toFixed(2)} KB
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => {
                            setImportedFile(null);
                            setPreviewData([]);
                            setValidationErrors([]);
                            setCellErrors({});
                            if (fileInputRef.current)
                              fileInputRef.current.value = "";
                          }}
                          className="text-red-500 hover:text-red-700 dark:hover:text-red-400 transition-colors"
                          disabled={isImporting}
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
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>

                      {/* Validation Errors */}
                      {validationErrors.length > 0 && (
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
                          <div className="flex items-start gap-2 mb-3">
                            <svg
                              className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0"
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
                            <div className="flex-1">
                              <div className="flex items-center justify-between mb-2">
                                <p className="font-medium text-red-800 dark:text-red-300">
                                  Terdapat {validationErrors.length} error validasi:
                                </p>
                                <button
                                  onClick={handleAutoFix}
                                  className="px-3 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                                  title="Perbaiki data yang bisa diperbaiki secara otomatis (misalnya nama yang tidak sesuai dengan NIM)"
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
                                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                                    />
                                  </svg>
                                  Auto-Fix
                                </button>
                              </div>
                              <ul className="space-y-1 max-h-40 overflow-y-auto">
                                {validationErrors
                                  .slice(0, 10)
                                  .map((err, idx) => (
                                    <li
                                      key={idx}
                                      className="text-sm text-red-700 dark:text-red-400"
                                    >
                                      Baris {err.row}: {err.field} - {err.message}
                                    </li>
                                  ))}
                                {validationErrors.length > 10 && (
                                  <li className="text-sm text-red-700 dark:text-red-400 font-medium">
                                    ... dan {validationErrors.length - 10} error
                                    lainnya
                                  </li>
                                )}
                              </ul>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Success Message */}
                      {importedCount > 0 && (
                        <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                          <p className="text-green-800 dark:text-green-300">
                            <strong>Berhasil!</strong> {importedCount} data
                            berhasil diimpor.
                          </p>
                        </div>
                      )}

                      {/* Preview Table */}
                      {previewData.length > 0 && (
                        <div className="overflow-x-auto">
                          <table className="w-full border-collapse border border-gray-300 dark:border-gray-700 text-sm">
                            <thead className="sticky top-0 bg-gray-100 dark:bg-gray-700 z-10">
                              <tr className="bg-gray-100 dark:bg-gray-700">
                                <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left">
                                  NIM
                                </th>
                                <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left">
                                  NAMA
                                </th>
                                <th className="border border-gray-300 dark:border-gray-700 px-3 py-2 text-left">
                                  KELOMPOK
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {previewData.map((row, idx) => {
                                const rowNum = idx + 2;
                                const hasError = validationErrors.some(
                                  (err) => err.row === rowNum
                                );
                                return (
                                  <tr
                                    key={idx}
                                    className={
                                      hasError
                                        ? "bg-red-50 dark:bg-red-900/10"
                                        : idx % 2 === 0
                                        ? "bg-white dark:bg-gray-800"
                                        : "bg-gray-50 dark:bg-gray-700/50"
                                    }
                                  >
                                    <td
                                      className={`border border-gray-300 dark:border-gray-700 px-3 py-2 ${
                                        cellErrors[`${rowNum}-NIM`]
                                          ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700"
                                          : ""
                                      }`}
                                    >
                                      <input
                                        type="text"
                                        value={row.NIM}
                                        onChange={(e) =>
                                          handleCellEdit(
                                            idx,
                                            "NIM",
                                            e.target.value
                                          )
                                        }
                                        className={`w-full px-2 py-1 border rounded text-sm bg-transparent ${
                                          cellErrors[`${rowNum}-NIM`]
                                            ? "border-red-500 dark:border-red-600 text-red-900 dark:text-red-200"
                                            : "border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                        }`}
                                        title={cellErrors[`${rowNum}-NIM`] || ""}
                                      />
                                    </td>
                                    <td
                                      className={`border border-gray-300 dark:border-gray-700 px-3 py-2 ${
                                        cellErrors[`${rowNum}-NAMA`]
                                          ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700"
                                          : ""
                                      }`}
                                    >
                                      <input
                                        type="text"
                                        value={row.NAMA}
                                        onChange={(e) =>
                                          handleCellEdit(
                                            idx,
                                            "NAMA",
                                            e.target.value
                                          )
                                        }
                                        className={`w-full px-2 py-1 border rounded text-sm bg-transparent ${
                                          cellErrors[`${rowNum}-NAMA`]
                                            ? "border-red-500 dark:border-red-600 text-red-900 dark:text-red-200"
                                            : "border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                        }`}
                                        title={
                                          cellErrors[`${rowNum}-NAMA`] || ""
                                        }
                                      />
                                    </td>
                                    <td
                                      className={`border border-gray-300 dark:border-gray-700 px-3 py-2 ${
                                        cellErrors[`${rowNum}-KELOMPOK`]
                                          ? "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700"
                                          : ""
                                      }`}
                                    >
                                      <input
                                        type="text"
                                        value={row.KELOMPOK}
                                        onChange={(e) =>
                                          handleCellEdit(
                                            idx,
                                            "KELOMPOK",
                                            e.target.value
                                          )
                                        }
                                        className={`w-full px-2 py-1 border rounded text-sm bg-transparent ${
                                          cellErrors[`${rowNum}-KELOMPOK`]
                                            ? "border-red-500 dark:border-red-600 text-red-900 dark:text-red-200"
                                            : "border-gray-300 dark:border-gray-600 text-gray-900 dark:text-white"
                                        }`}
                                        title={
                                          cellErrors[`${rowNum}-KELOMPOK`] || ""
                                        }
                                      />
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 text-center sticky bottom-0 bg-gray-50 dark:bg-gray-800 py-2">
                            Menampilkan semua {previewData.length} baris
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-end gap-3">
                  <button
                    onClick={() => {
                      if (!isImporting) {
                        setShowImportModal(false);
                        setPreviewData([]);
                        setValidationErrors([]);
                        setCellErrors({});
                        setImportedFile(null);
                      }
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                    disabled={isImporting}
                  >
                    {importedCount > 0 ? "Tutup" : "Batal"}
                  </button>
                  {previewData.length > 0 &&
                    validationErrors.length > 0 &&
                    importedCount === 0 && (
                      <button
                        onClick={handleAutoFix}
                        className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors flex items-center gap-2"
                        title="Perbaiki data yang bisa diperbaiki secara otomatis (misalnya nama yang tidak sesuai dengan NIM)"
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
                            d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        Auto-Fix
                      </button>
                    )}
                  {previewData.length > 0 &&
                    validationErrors.length === 0 &&
                    importedCount === 0 && (
                      <button
                        onClick={handleSubmitImport}
                        disabled={isImporting}
                        className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                      >
                        {isImporting ? (
                          <>
                            <svg
                              className="animate-spin h-5 w-5"
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
                              />
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              />
                            </svg>
                            Mengimpor...
                          </>
                        ) : (
                          <>
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
                            Import Data
                          </>
                        )}
                      </button>
                    )}
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default KelompokKecil;