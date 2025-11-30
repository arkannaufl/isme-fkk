import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faSave,
  faCheckCircle,
  faExclamationCircle,
  faExclamationTriangle,
  faUser,
  faClipboardCheck,
  faChevronDown,
  faChevronUp,
  faChevronLeft,
  faChevronRight,
  faUsers,
  faLock,
  faUnlock,
} from "@fortawesome/free-solid-svg-icons";
import api, { getUser } from "../utils/api";
import PageMeta from "../components/common/PageMeta";
import jsPDF from "jspdf";

interface JadwalDetail {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  jenis_baris: string;
  pembimbing?: { id: number; name: string; nid?: string };
  penguji_list?: { id: number; name: string; nid?: string }[];
  mahasiswa_list?: { id: number; nim: string; name: string }[];
  ruangan?: { id: number; nama: string; gedung?: string };
  dosen_role?: string;
}

interface NilaiForm {
  nilai_penyajian_lisan: string;
  nilai_sistematika_penulisan: string;
  nilai_isi_tulisan: string;
  nilai_originalitas: string;
  nilai_tanya_jawab: string;
  catatan: string;
}

interface PenilaianPenguji {
  id: number;
  penguji_id: number;
  penguji_name: string;
  peran_penguji: string;
  nilai_penyajian_lisan: number | null;
  nilai_sistematika_penulisan: number | null;
  nilai_isi_tulisan: number | null;
  nilai_originalitas: number | null;
  nilai_tanya_jawab: number | null;
  nilai_akhir: number | null;
  catatan: string | null;
}

interface PenilaianMahasiswa {
  mahasiswa_id: number;
  mahasiswa_name: string;
  mahasiswa_nim: string;
  nilai_per_penguji: PenilaianPenguji[];
  nilai_akhir: number | null;
  nilai_huruf: string | null;
}

interface HasilSidangSkripsi {
  id?: number;
  jadwal_id: number;
  mahasiswa_id: number;
  judul_skripsi: string;
  keputusan: "tidak_lulus" | "lulus_tanpa_perbaikan" | "lulus_dengan_perbaikan";
  catatan_perbaikan?: string;
  is_finalized?: boolean;
  finalized_at?: string;
  finalized_by?: number;
  finalized_by_user?: {
    id: number;
    name: string;
  };
}

// Bobot penilaian
const BOBOT = {
  penyajian_lisan: 2,
  sistematika_penulisan: 1,
  isi_tulisan: 3,
  originalitas: 1,
  tanya_jawab: 3,
};
const TOTAL_BOBOT = 10;

// Aspek penilaian dengan deskripsi detail
const ASPEK_PENILAIAN = [
  {
    key: "nilai_penyajian_lisan",
    label: "Penyajian Lisan",
    bobot: 2,
    subKriteria: [
      "Penggunaan Waktu",
      "Kejelasan Penyajian",
      "Efektifitas, Pemakaian AVA",
    ],
  },
  {
    key: "nilai_sistematika_penulisan",
    label: "Sistematika Penulisan",
    bobot: 1,
    subKriteria: [
      "Sesuai Kaidah Ilmiah",
      "Ketepatan Penggunaan Bahasa",
      "Susunan Bahasa",
    ],
  },
  {
    key: "nilai_isi_tulisan",
    label: "Isi Tulisan",
    bobot: 3,
    subKriteria: [
      "Latar Belakang",
      "Tujuan",
      "Kerangka Teori",
      "Kerangka Konsep",
      "Definisi Operasional (DO)",
      "Desain Penelitian",
      "Metode Pengambilan Data",
      "Analisis Data",
      "Pembahasan",
      "Kesimpulan",
      "Saran",
    ],
  },
  {
    key: "nilai_originalitas",
    label: "Originalitas",
    bobot: 1,
    subKriteria: [
      "Relevansi",
      "Keterkinian",
    ],
  },
  {
    key: "nilai_tanya_jawab",
    label: "Tanya Jawab & atau unjuk kerja",
    bobot: 3,
    subKriteria: [
      "Kejelasan mengemukakan isi skripsi",
      "Penguasaan materi",
      "Ketepatan menjawab pertanyaan",
    ],
  },
];

// Konversi nilai ke huruf
const konversiNilaiHuruf = (nilai: number): string => {
  if (nilai >= 85) return "A";
  if (nilai >= 80) return "A-";
  if (nilai >= 75) return "B+";
  if (nilai >= 70) return "B";
  if (nilai >= 65) return "B-";
  if (nilai >= 60) return "C+";
  if (nilai >= 55) return "C";
  if (nilai >= 50) return "C-";
  if (nilai >= 45) return "D";
  return "E";
};

// Hitung nilai akhir dari form
const hitungNilaiAkhir = (form: NilaiForm): number | null => {
  const penyajian = parseFloat(form.nilai_penyajian_lisan);
  const sistematika = parseFloat(form.nilai_sistematika_penulisan);
  const isi = parseFloat(form.nilai_isi_tulisan);
  const originalitas = parseFloat(form.nilai_originalitas);
  const tanyaJawab = parseFloat(form.nilai_tanya_jawab);

  if (isNaN(penyajian) || isNaN(sistematika) || isNaN(isi) || isNaN(originalitas) || isNaN(tanyaJawab)) {
    return null;
  }

  const total =
    penyajian * BOBOT.penyajian_lisan +
    sistematika * BOBOT.sistematika_penulisan +
    isi * BOBOT.isi_tulisan +
    originalitas * BOBOT.originalitas +
    tanyaJawab * BOBOT.tanya_jawab;

  return Math.round((total / TOTAL_BOBOT) * 100) / 100;
};

const PenilaianSidangSkripsi = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [jadwal, setJadwal] = useState<JadwalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [penilaianData, setPenilaianData] = useState<PenilaianMahasiswa[]>([]);
  const [selectedMahasiswa, setSelectedMahasiswa] = useState<number | null>(null);
  const [nilaiForm, setNilaiForm] = useState<NilaiForm>({
    nilai_penyajian_lisan: "",
    nilai_sistematika_penulisan: "",
    nilai_isi_tulisan: "",
    nilai_originalitas: "",
    nilai_tanya_jawab: "",
    catatan: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [loadingForm, setLoadingForm] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [savedNilaiForm, setSavedNilaiForm] = useState<NilaiForm | null>(null);
  const [showMahasiswaList, setShowMahasiswaList] = useState(true);
  const [searchMahasiswa, setSearchMahasiswa] = useState("");
  
  // State untuk Hasil Sidang (Keputusan Pembimbing)
  const [hasilForm, setHasilForm] = useState<{
    judul_skripsi: string;
    keputusan: "tidak_lulus" | "lulus_tanpa_perbaikan" | "lulus_dengan_perbaikan" | "";
    catatan_perbaikan: string;
  }>({
    judul_skripsi: "",
    keputusan: "",
    catatan_perbaikan: "",
  });
  const [savingHasil, setSavingHasil] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [showUnfinalizeModal, setShowUnfinalizeModal] = useState(false);
  const [hasilMessage, setHasilMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const [hasilData, setHasilData] = useState<Record<number, HasilSidangSkripsi>>({});
  const [hasUnsavedHasil, setHasUnsavedHasil] = useState(false);
  const [savedHasilForm, setSavedHasilForm] = useState<typeof hasilForm | null>(null);
  
  // Ref untuk track mahasiswa yang sedang di-load, mencegah race condition
  const loadingMahasiswaRef = useRef<number | null>(null);
  // Ref untuk track apakah initial load sudah selesai
  const initialLoadDone = useRef(false);

  const user = getUser();
  const currentUserId = user?.id;

  // Check if current user is involved dosen (pembimbing or penguji)
  const isDosenTerlibat = (): boolean => {
    if (!jadwal?.dosen_role) {
      return false;
    }
    // Jika dosen_role ada (tidak kosong/null), berarti user adalah dosen terlibat
    return true;
  };

  // Check if current user is Pembimbing
  const isPembimbing = (): boolean => {
    if (!jadwal?.dosen_role) {
      return false;
    }
    const role = jadwal.dosen_role.toLowerCase();
    return role.includes("pembimbing");
  };

  // Determine peran penguji based on dosen_role
  const getPeranPenguji = (): string => {
    if (!jadwal?.dosen_role) return "pembimbing";
    const role = jadwal.dosen_role.toLowerCase();
    if (role.includes("pembimbing")) return "pembimbing";
    if (role.includes("penguji 1") || role.includes("penguji_1")) return "penguji_1";
    if (role.includes("penguji 2") || role.includes("penguji_2")) return "penguji_2";
    return "pembimbing";
  };

  const fetchJadwalDetail = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/jadwal-non-blok-non-csr/${id}`);
      setJadwal(response.data.data);
    } catch (error) {
      // Error fetching jadwal detail
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchPenilaian = useCallback(async () => {
    try {
      const response = await api.get(`/penilaian-sidang-skripsi/jadwal/${id}`);
      setPenilaianData(response.data.data || []);
    } catch (error) {
      // Error fetching penilaian
    }
  }, [id]);

  const fetchHasilSidang = useCallback(async () => {
    try {
      const response = await api.get(`/hasil-sidang-skripsi/jadwal/${id}`);
      const hasilArray = response.data.data || [];
      const hasilMap: Record<number, HasilSidangSkripsi> = {};
      hasilArray.forEach((h: HasilSidangSkripsi) => {
        hasilMap[h.mahasiswa_id] = h;
      });
      setHasilData(hasilMap);
    } catch (error) {
      // Error fetching hasil sidang
    }
  }, [id]);

  useEffect(() => {
    if (id && !initialLoadDone.current) {
      initialLoadDone.current = true;
      fetchJadwalDetail();
      fetchPenilaian();
      fetchHasilSidang();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Auto-refresh penilaian & hasil setiap 10 detik (untuk sync dengan dosen lain)
  useEffect(() => {
    if (!id) return;
    
    const intervalId = setInterval(() => {
      // Hanya refresh jika tidak ada unsaved changes (biar gak ganggu user yang lagi input)
      if (!hasUnsavedChanges && !hasUnsavedHasil) {
        fetchPenilaian();
        fetchHasilSidang();
      }
    }, 10000); // 10 detik

    return () => clearInterval(intervalId);
  }, [id, hasUnsavedChanges, hasUnsavedHasil, fetchPenilaian, fetchHasilSidang]);

  // Detect unsaved changes
  useEffect(() => {
    if (!savedNilaiForm) return;
    const hasChanges = JSON.stringify(nilaiForm) !== JSON.stringify(savedNilaiForm);
    setHasUnsavedChanges(hasChanges);
    if (hasChanges) {
      setSaveMessage(null);
    }
  }, [nilaiForm, savedNilaiForm]);

  // Load existing penilaian when selecting mahasiswa
  const handleSelectMahasiswa = async (mahasiswaId: number) => {
    // Jangan load ulang jika mahasiswa yang sama
    if (selectedMahasiswa === mahasiswaId) return;
    
    // Set loading ref untuk mencegah race condition
    loadingMahasiswaRef.current = mahasiswaId;
    
    setSelectedMahasiswa(mahasiswaId);
    setSaveMessage(null);
    setLoadingForm(true);
    setHasUnsavedChanges(false);

    try {
      const response = await api.get(`/penilaian-sidang-skripsi/jadwal/${id}/mahasiswa/${mahasiswaId}/my`);
      
      // Cek apakah masih mahasiswa yang sama (user mungkin sudah pindah)
      if (loadingMahasiswaRef.current !== mahasiswaId) {
        return; // User sudah pindah ke mahasiswa lain, abaikan response ini
      }
      
      const myPenilaian = response.data.data;
      const formData: NilaiForm = myPenilaian ? {
        nilai_penyajian_lisan: myPenilaian.nilai_penyajian_lisan != null ? Number(myPenilaian.nilai_penyajian_lisan).toFixed(2) : "",
        nilai_sistematika_penulisan: myPenilaian.nilai_sistematika_penulisan != null ? Number(myPenilaian.nilai_sistematika_penulisan).toFixed(2) : "",
        nilai_isi_tulisan: myPenilaian.nilai_isi_tulisan != null ? Number(myPenilaian.nilai_isi_tulisan).toFixed(2) : "",
        nilai_originalitas: myPenilaian.nilai_originalitas != null ? Number(myPenilaian.nilai_originalitas).toFixed(2) : "",
        nilai_tanya_jawab: myPenilaian.nilai_tanya_jawab != null ? Number(myPenilaian.nilai_tanya_jawab).toFixed(2) : "",
        catatan: myPenilaian.catatan || "",
      } : {
        nilai_penyajian_lisan: "",
        nilai_sistematika_penulisan: "",
        nilai_isi_tulisan: "",
        nilai_originalitas: "",
        nilai_tanya_jawab: "",
        catatan: "",
      };
      
      setNilaiForm(formData);
      setSavedNilaiForm(formData);
      } catch (error) {
        // Hanya reset form jika masih mahasiswa yang sama
        if (loadingMahasiswaRef.current === mahasiswaId) {
        const emptyForm: NilaiForm = {
          nilai_penyajian_lisan: "",
          nilai_sistematika_penulisan: "",
          nilai_isi_tulisan: "",
          nilai_originalitas: "",
          nilai_tanya_jawab: "",
          catatan: "",
        };
        setNilaiForm(emptyForm);
        setSavedNilaiForm(emptyForm);
      }
    } finally {
      if (loadingMahasiswaRef.current === mahasiswaId) {
        setLoadingForm(false);
        // Load hasil form untuk moderator
        loadHasilForm(mahasiswaId);
      }
    }
  };

  const handleSavePenilaian = async () => {
    if (!selectedMahasiswa) return;

    setSaving(true);
    setSaveMessage(null);

    try {
      await api.post("/penilaian-sidang-skripsi", {
        jadwal_id: parseInt(id!),
        mahasiswa_id: selectedMahasiswa,
        peran_penguji: getPeranPenguji(),
        nilai_penyajian_lisan: nilaiForm.nilai_penyajian_lisan ? parseFloat(nilaiForm.nilai_penyajian_lisan) : null,
        nilai_sistematika_penulisan: nilaiForm.nilai_sistematika_penulisan ? parseFloat(nilaiForm.nilai_sistematika_penulisan) : null,
        nilai_isi_tulisan: nilaiForm.nilai_isi_tulisan ? parseFloat(nilaiForm.nilai_isi_tulisan) : null,
        nilai_originalitas: nilaiForm.nilai_originalitas ? parseFloat(nilaiForm.nilai_originalitas) : null,
        nilai_tanya_jawab: nilaiForm.nilai_tanya_jawab ? parseFloat(nilaiForm.nilai_tanya_jawab) : null,
        catatan: nilaiForm.catatan || null,
      });

      // Format nilai ke desimal setelah save
      const formattedForm: NilaiForm = {
        nilai_penyajian_lisan: nilaiForm.nilai_penyajian_lisan ? parseFloat(nilaiForm.nilai_penyajian_lisan).toFixed(2) : "",
        nilai_sistematika_penulisan: nilaiForm.nilai_sistematika_penulisan ? parseFloat(nilaiForm.nilai_sistematika_penulisan).toFixed(2) : "",
        nilai_isi_tulisan: nilaiForm.nilai_isi_tulisan ? parseFloat(nilaiForm.nilai_isi_tulisan).toFixed(2) : "",
        nilai_originalitas: nilaiForm.nilai_originalitas ? parseFloat(nilaiForm.nilai_originalitas).toFixed(2) : "",
        nilai_tanya_jawab: nilaiForm.nilai_tanya_jawab ? parseFloat(nilaiForm.nilai_tanya_jawab).toFixed(2) : "",
        catatan: nilaiForm.catatan || "",
      };
      setNilaiForm(formattedForm);
      setSavedNilaiForm(formattedForm);
      setHasUnsavedChanges(false);

      setSaveMessage({ type: "success", text: "Penilaian berhasil disimpan!" });
      fetchPenilaian();
    } catch (error) {
      setSaveMessage({ type: "error", text: "Gagal menyimpan penilaian" });
    } finally {
      setSaving(false);
    }
  };

  // Handle save hasil seminar (keputusan moderator)
  const handleSaveHasil = async () => {
    if (!selectedMahasiswa || !hasilForm.keputusan) return;

    setSavingHasil(true);
    setHasilMessage(null);

    try {
      await api.post("/hasil-sidang-skripsi", {
        jadwal_id: parseInt(id!),
        mahasiswa_id: selectedMahasiswa,
        judul_skripsi: hasilForm.judul_skripsi,
        keputusan: hasilForm.keputusan,
        catatan_perbaikan: hasilForm.keputusan === "lulus_dengan_perbaikan" ? hasilForm.catatan_perbaikan : null,
      });

      setHasilMessage({ type: "success", text: "Keputusan berhasil disimpan!" });
      setSavedHasilForm({ ...hasilForm });
      setHasUnsavedHasil(false);
      fetchHasilSidang();
    } catch (error) {
      setHasilMessage({ type: "error", text: "Gagal menyimpan keputusan" });
    } finally {
      setSavingHasil(false);
    }
  };

  // Handle finalize hasil seminar
  const handleFinalize = async () => {
    if (!selectedMahasiswa) return;

    setFinalizing(true);
    setHasilMessage(null);
    setShowFinalizeModal(false);

    try {
      await api.post("/hasil-sidang-skripsi/finalize", {
        jadwal_id: parseInt(id!),
        mahasiswa_id: selectedMahasiswa,
      });

      setHasilMessage({ type: "success", text: "Keputusan berhasil di-finalize!" });
      fetchHasilSidang();
    } catch (error: any) {
      setHasilMessage({ 
        type: "error", 
        text: error.response?.data?.message || "Gagal mem-finalize keputusan" 
      });
    } finally {
      setFinalizing(false);
    }
  };

  // Handle unfinalize hasil seminar (hanya untuk admin)
  const handleUnfinalize = async () => {
    if (!selectedMahasiswa) return;

    setFinalizing(true);
    setHasilMessage(null);
    setShowUnfinalizeModal(false);

    try {
      await api.post("/hasil-sidang-skripsi/unfinalize", {
        jadwal_id: parseInt(id!),
        mahasiswa_id: selectedMahasiswa,
      });

      setHasilMessage({ type: "success", text: "Finalize berhasil dibatalkan!" });
      fetchHasilSidang();
    } catch (error: any) {
      setHasilMessage({ 
        type: "error", 
        text: error.response?.data?.message || "Gagal membatalkan finalize" 
      });
    } finally {
      setFinalizing(false);
    }
  };

  // Check if user is admin
  const isAdmin = (): boolean => {
    const user = getUser();
    return user?.role === "super_admin" || user?.role === "tim_akademik";
  };

  // Check if hasil is finalized for selected mahasiswa
  const isHasilFinalized = (): boolean => {
    if (!selectedMahasiswa) return false;
    return hasilData[selectedMahasiswa]?.is_finalized === true;
  };

  // Check if penilaian can be edited (not finalized or user is admin)
  const canEditPenilaian = (): boolean => {
    // Jika bukan dosen terlibat, tidak bisa edit
    if (!isDosenTerlibat()) {
      return false;
    }
    return !isHasilFinalized() || isAdmin();
  };

  // Check if all penguji have submitted their penilaian
  const allPengujiHaveSubmitted = (): boolean => {
    if (!selectedMahasiswa || !jadwal) return false;
    
    const penilaian = getPenilaianMahasiswa(selectedMahasiswa);
    if (!penilaian || !penilaian.nilai_per_penguji || penilaian.nilai_per_penguji.length === 0) {
      return false;
    }

    // Get expected penguji IDs
    const expectedPengujiIds: number[] = [];
    
    // Add pembimbing
    if (jadwal.pembimbing?.id) {
      expectedPengujiIds.push(jadwal.pembimbing.id);
    }
    
    // Add penguji
    if (jadwal.penguji_list) {
      jadwal.penguji_list.forEach((p) => {
        if (p.id) {
          expectedPengujiIds.push(p.id);
        }
      });
    }

    // Check if all expected penguji have submitted (have nilai_akhir)
    const submittedPengujiIds = penilaian.nilai_per_penguji
      .filter((p) => p.nilai_akhir != null)
      .map((p) => p.penguji_id);

    // Check if all expected penguji are in submitted list
    return expectedPengujiIds.length > 0 && 
           expectedPengujiIds.every((id) => submittedPengujiIds.includes(id));
  };

  // Fungsi untuk fetch tanda tangan penguji
  const fetchPengujiSignature = async (pengujiId: number): Promise<string | null> => {
    try {
      const response = await api.get(`/users/${pengujiId}`);
      return response.data.signature_image || null;
    } catch (error) {
      return null;
    }
  };

  // Load watermark logo
  const loadWatermarkLogo = async (): Promise<{
    dataUrl: string;
    aspectRatio: number;
  }> => {
    try {
      const response = await fetch("/images/logo/logo-icon.svg");
      if (!response.ok) {
        throw new Error("Watermark logo tidak ditemukan");
      }
      const svgText = await response.text();

      // Convert SVG to canvas then to data URL
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Hitung aspect ratio dari gambar asli
          const aspectRatio = img.width / img.height;

          // Tentukan ukuran maksimum untuk watermark (diperbesar untuk HD)
          const maxSize = 600; // Diperbesar dari 200 ke 600 untuk kualitas lebih tinggi
          let canvasWidth: number;
          let canvasHeight: number;

          // Pertahankan aspect ratio
          if (img.width > img.height) {
            canvasWidth = maxSize;
            canvasHeight = maxSize / aspectRatio;
          } else {
            canvasHeight = maxSize;
            canvasWidth = maxSize * aspectRatio;
          }

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          // Set canvas size dengan scale factor untuk HD
          const scaleFactor = 2; // 2x untuk retina/HD quality
          canvas.width = canvasWidth * scaleFactor;
          canvas.height = canvasHeight * scaleFactor;

          if (ctx) {
            // Scale context untuk HD rendering
            ctx.scale(scaleFactor, scaleFactor);
            // Set opacity untuk watermark
            ctx.globalAlpha = 0.1;
            ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
            resolve({
              dataUrl: canvas.toDataURL("image/png"),
              aspectRatio: aspectRatio,
            });
          } else {
            resolve({ dataUrl: "", aspectRatio: 1 });
          }
        };
        img.onerror = () => resolve({ dataUrl: "", aspectRatio: 1 });
        img.src = "data:image/svg+xml;base64," + btoa(svgText);
      });
    } catch (error) {
      return { dataUrl: "", aspectRatio: 1 };
    }
  };

  // Generate Berita Acara PDF menggunakan jsPDF (3 halaman)
  const generateBeritaAcaraPDF = async () => {
    try {
      if (!selectedMahasiswa || !jadwal || !hasilData[selectedMahasiswa]) {
        return;
      }

      const hasil = hasilData[selectedMahasiswa];
      const mahasiswa = jadwal.mahasiswa_list?.find((m) => m.id === selectedMahasiswa);
      const penilaian = getPenilaianMahasiswa(selectedMahasiswa);

      if (!mahasiswa) {
        return;
      }

      // Fetch tanda tangan untuk setiap penguji
      const pengujiSignatures: Record<number, string | null> = {};
      if (penilaian?.nilai_per_penguji) {
        const signaturePromises = penilaian.nilai_per_penguji.map(async (np) => {
          const signature = await fetchPengujiSignature(np.penguji_id);
          return { pengujiId: np.penguji_id, signature };
        });
        const results = await Promise.all(signaturePromises);
        results.forEach(({ pengujiId, signature }) => {
          pengujiSignatures[pengujiId] = signature;
        });
      }

      // Fetch tanda tangan untuk pembimbing juga
      if (jadwal.pembimbing?.id) {
        const pembimbingSignature = await fetchPengujiSignature(jadwal.pembimbing.id);
        if (pembimbingSignature) {
          pengujiSignatures[jadwal.pembimbing.id] = pembimbingSignature;
        }
      }

      // Fetch tanda tangan untuk penguji_list
      if (jadwal.penguji_list) {
        const pengujiPromises = jadwal.penguji_list.map(async (p) => {
          const signature = await fetchPengujiSignature(p.id);
          return { pengujiId: p.id, signature };
        });
        const pengujiResults = await Promise.all(pengujiPromises);
        pengujiResults.forEach(({ pengujiId, signature }) => {
          if (signature) {
            pengujiSignatures[pengujiId] = signature;
          }
        });
      }


      // Load watermark logo
      const watermarkLogo = await loadWatermarkLogo();
      const watermarkLogoDataUrl = watermarkLogo.dataUrl;
      const watermarkAspectRatio = watermarkLogo.aspectRatio;

      const doc = new jsPDF();
      const margin = 20;
      let yPos = margin;
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      const bulanList = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

      // Helper function untuk menambahkan watermark di setiap halaman
      const addWatermarkToPage = () => {
        if (watermarkLogoDataUrl) {
          try {
            // Hitung ukuran watermark (diperbesar untuk HD)
            const maxWatermarkSize = 150; // Diperbesar dari 90 ke 150 untuk HD
            let watermarkWidth: number;
            let watermarkHeight: number;

            if (watermarkAspectRatio > 1) {
              watermarkWidth = maxWatermarkSize;
              watermarkHeight = maxWatermarkSize / watermarkAspectRatio;
            } else {
              watermarkHeight = maxWatermarkSize;
              watermarkWidth = maxWatermarkSize * watermarkAspectRatio;
            }

            // Posisi di tengah halaman
            const xPos = (pageWidth - watermarkWidth) / 2;
            const yPos = (pageHeight - watermarkHeight) / 2;

            // Tambahkan 3 watermark (satu di tengah, dua di samping untuk efek yang lebih baik)
            doc.addImage(
              watermarkLogoDataUrl,
              "PNG",
              xPos,
              yPos,
              watermarkWidth,
              watermarkHeight,
              undefined,
              "SLOW" // Mode SLOW untuk kualitas lebih tinggi
            );
          } catch (error) {
            // Error adding watermark - silent fail
          }
        }
      };

      // Tambahkan watermark di halaman pertama
      addWatermarkToPage();

      // Helper functions
      const addText = (text: string, x: number, y: number, options?: { align?: "center" | "left" | "right" }) => {
        doc.text(text, x, y, options);
        return y;
      };

      const formatTanggal = (tanggal: string) => {
        if (!tanggal) return "Tanggal tidak tersedia";
        try {
          const date = new Date(tanggal.split("-").reverse().join("-"));
          const hariList = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
          return `${hariList[date.getDay()]}, ${date.getDate()} ${bulanList[date.getMonth()]} ${date.getFullYear()}`;
        } catch {
          return tanggal;
        }
      };

      // Get all penguji names
      const allPenguji: { name: string; role: string }[] = [];
      if (jadwal.pembimbing) {
        allPenguji.push({ name: jadwal.pembimbing.name, role: "Pembimbing" });
      }
      jadwal.penguji_list?.forEach((p, idx) => {
        allPenguji.push({ name: p.name, role: `Penguji ${idx + 1}` });
      });

    // ========== HALAMAN 1: BERITA ACARA ==========
    doc.setFontSize(14);
    doc.setFont("times", "bold");
    yPos = addText("BERITA ACARA", pageWidth / 2, yPos + 10, { align: "center" });
    yPos += 15;

    doc.setFontSize(11);
    doc.setFont("times", "normal");

    const tanggalFormatted = formatTanggal(jadwal.tanggal);
    const paragraph1 = `Pada hari ini ${tanggalFormatted}, telah diselenggarakan Sidang Skripsi terhadap Peserta didik Program Studi Kedokteran Fakultas Kedokteran dan Kesehatan Universitas Muhammadiyah Jakarta, atas nama :`;
    const p1Lines = doc.splitTextToSize(paragraph1, pageWidth - margin * 2);
    p1Lines.forEach((line: string) => {
      yPos = addText(line, margin, yPos);
      yPos += 5;
    });
    yPos += 5;

    // Info Mahasiswa
    doc.text("Nama", margin, yPos);
    doc.text(`: ${mahasiswa.name}`, margin + 35, yPos);
    yPos += 6;
    doc.text("No. Pokok", margin, yPos);
    doc.text(`: ${mahasiswa.nim}`, margin + 35, yPos);
    yPos += 6;
    doc.text("Judul Skripsi", margin, yPos);
    const judulLines = doc.splitTextToSize(`: ${hasil.judul_skripsi}`, pageWidth - margin - 40);
    judulLines.forEach((line: string, idx: number) => {
      if (idx === 0) {
        doc.text(line, margin + 35, yPos);
      } else {
        yPos += 5;
        doc.text(line, margin + 37, yPos);
      }
    });
    yPos += 12;

    // Tim Penguji
    doc.text("Berdasarkan keputusan Pembimbing dan penguji yang terdiri dari :", margin, yPos);
    yPos += 6;
    doc.text("Pembimbing", margin, yPos);
    doc.text(`: ${jadwal.pembimbing?.name || "-"}`, margin + 35, yPos);
    yPos += 6;
    doc.text("Anggota", margin, yPos);
    jadwal.penguji_list?.forEach((p, idx) => {
      const prefix = idx === 0 ? ": " : "  ";
      doc.text(`${prefix}Penguji ${idx + 1} ${p.name}`, margin + 35, yPos);
      yPos += 5;
    });
    yPos += 10;

    // Keputusan
    doc.text("Peserta di atas dinyatakan : (pilih salah satu pernyataan di bawah ini)", margin, yPos);
    yPos += 6;

    const keputusanOptions = [
      { key: "tidak_lulus", label: "tidak lulus" },
      { key: "lulus_tanpa_perbaikan", label: "lulus tanpa perbaikan" },
      { key: "lulus_dengan_perbaikan", label: "lulus dengan perbaikan sebagai berikut :" },
    ];

    keputusanOptions.forEach((opt, idx) => {
      const isSelected = hasil.keputusan === opt.key;
      doc.setFont("times", isSelected ? "bold" : "normal");
      doc.text(`${idx + 1}.`, margin + 5, yPos);
      doc.text(opt.label, margin + 15, yPos);
      
      // Coret tengah jika tidak dipilih
      if (!isSelected) {
        const textWidth = doc.getTextWidth(opt.label);
        const lineY = yPos - 1.5; // Posisi garis di tengah teks
        doc.setLineWidth(0.3);
        doc.line(margin + 15, lineY, margin + 15 + textWidth, lineY);
      }
      yPos += 6;
    });
    doc.setFont("times", "normal");
    yPos += 5;

    // Catatan perbaikan dengan pagination yang baik
    if (hasil.catatan_perbaikan) {
      const catatanText = `...sesuai masukan dan saran dari penguji: ${hasil.catatan_perbaikan}`;
      const catatanLines = doc.splitTextToSize(catatanText, pageWidth - margin * 2);
      
      // Ruang minimum yang dibutuhkan untuk tanda tangan semua penguji dan moderator
      // Estimasi: jumlah penguji * 12 + tanggal (6) + moderator (10) + tanda tangan (15) + nama (10) + spacing (10) = sekitar 50-70
      // Dikurangi agar lebih fleksibel dan memanfaatkan ruang dengan lebih baik
      const estimatedPengujiCount = allPenguji.length;
      const minSpaceForSignatures = 40 + (estimatedPengujiCount * 10); // Dikurangi untuk fleksibilitas
      const lineHeight = 5;
      const bottomMargin = 5;
      const maxYPos = pageHeight - bottomMargin - minSpaceForSignatures;
      
      // Tampilkan catatan baris per baris dengan pagination
      catatanLines.forEach((line: string) => {
        // Cek dulu apakah baris ini masih muat di halaman saat ini
        if (yPos + lineHeight > maxYPos) {
          // Tidak muat, pindah ke halaman baru
          doc.addPage();
          addWatermarkToPage();
          yPos = margin;
        }
        
        doc.text(line, margin, yPos);
        yPos += lineHeight;
      });
    } else {
      doc.text("……………….…… ...sesuai masukan dan saran dari penguji ……………….………………", margin, yPos);
      yPos += 5;
      doc.text("…………………….……………………….…………………………………….………………", margin, yPos);
    }
    
    // Pastikan ada ruang yang cukup untuk tanda tangan sebelum menampilkannya
    // Dikurangi agar lebih fleksibel dan memanfaatkan ruang dengan lebih baik
    const spaceNeededForSignatures = 35 + (allPenguji.length * 10); // Dikurangi untuk fleksibilitas
    const availableSpace = pageHeight - yPos - 10; // margin bawah 10
    
      // Hanya pindah jika ruang yang tersedia kurang dari yang dibutuhkan
      if (availableSpace < spaceNeededForSignatures) {
        doc.addPage();
        addWatermarkToPage();
        yPos = margin;
      }
    
    yPos += 10;

    // Tanda tangan semua penguji
    allPenguji.forEach((p, idx) => {
      doc.text(`${idx + 1}. ${p.name}`, margin + 5, yPos);
      // Cari penguji_id dari jadwal untuk mendapatkan tanda tangan
      let pengujiId: number | null = null;
      if (p.role === "Pembimbing" && jadwal.pembimbing?.id) {
        pengujiId = jadwal.pembimbing.id;
      } else if (p.role.startsWith("Penguji")) {
        // Cari penguji berdasarkan nama
        const pengujiIdx = jadwal.penguji_list?.findIndex(peng => peng.name === p.name);
        if (pengujiIdx !== undefined && pengujiIdx >= 0 && jadwal.penguji_list) {
          pengujiId = jadwal.penguji_list[pengujiIdx].id;
        }
      }
      
      // Selalu tampilkan garis terlebih dahulu
      doc.text("____________________", pageWidth - margin - 50, yPos);
      
      // Tambahkan gambar tanda tangan di atas garis jika ada (sedikit lebih tinggi agar garis tetap terlihat)
      if (pengujiId && pengujiSignatures[pengujiId]) {
        try {
          const signatureImg = pengujiSignatures[pengujiId];
          if (signatureImg) {
            // Posisi tanda tangan sedikit lebih tinggi agar garis tetap terlihat di bawahnya
            doc.addImage(signatureImg, "PNG", pageWidth - margin - 50, yPos - 10, 40, 15);
          }
          } catch (error) {
            // Error adding signature image - silent fail
          }
      }
      yPos += 12;
    });
    yPos += 10;

    // Tanggal dan tanda tangan pembimbing (pakai tanggal jadwal)
    const jadwalDate = new Date(jadwal.tanggal.split("-").reverse().join("-"));
    doc.text(`Jakarta, ${jadwalDate.getDate()} ${bulanList[jadwalDate.getMonth()]} ${jadwalDate.getFullYear()}`, pageWidth - margin - 60, yPos);
    yPos += 6;
    doc.text("Pembimbing,", pageWidth - margin - 60, yPos);
    yPos += 10;
    
    // Tambahkan gambar tanda tangan moderator jika ada (tanpa garis jika ada tanda tangan)
    if (jadwal.pembimbing?.id && pengujiSignatures[jadwal.pembimbing.id]) {
      try {
        const signatureImg = pengujiSignatures[jadwal.pembimbing.id];
        if (signatureImg) {
          doc.addImage(signatureImg, "PNG", pageWidth - margin - 60, yPos, 40, 15);
        }
        } catch (error) {
          // Jika error, tampilkan garis sebagai fallback
          doc.text("____________________", pageWidth - margin - 60, yPos);
        }
    } else {
      // Tampilkan garis hanya jika tidak ada tanda tangan
      doc.text("____________________", pageWidth - margin - 60, yPos);
    }
    yPos += 20;
    doc.text(`${jadwal.pembimbing?.name || "____________________"}`, pageWidth - margin - 60, yPos);

    // ========== HALAMAN 2+: FORMULIR PENILAIAN (per dosen) ==========
    // Data aspek penilaian dengan key untuk mapping nilai
    const aspekData = [
      {
        no: "1.",
        title: "Penyajian Lisan.",
        sub: ["Penggunaan Waktu", "Kejelasan Penyajian", "Efektifitas, Pemakaian AVA"],
        bobot: 2,
        key: "nilai_penyajian_lisan",
      },
      {
        no: "2.",
        title: "Sistematika Penulisan",
        sub: ["Sesuai Kaidah Ilmiah", "Ketepatan Penggunaan Bahasa", "Susunan Bahasa"],
        bobot: 1,
        key: "nilai_sistematika_penulisan",
      },
      {
        no: "3.",
        title: "Isi Tulisan",
        sub: ["Latar Belakang", "Tujuan", "Kerangka Teori", "Kerangka Konsep", "Definisi Operasional (DO)", "Desain Penelitian", "Metode Pengambilan Data", "Analisis Data", "Pembahasan", "Kesimpulan", "Saran"],
        bobot: 3,
        key: "nilai_isi_tulisan",
      },
      {
        no: "4.",
        title: "Originalitas",
        sub: ["Relevansi", "Keterkinian"],
        bobot: 1,
        key: "nilai_originalitas",
      },
      {
        no: "5.",
        title: "Tanya Jawab & atau unjuk kerja :",
        sub: ["Kejelasan mengemukakan isi skripsi", "Penguasaan materi", "Ketepatan menjawab pertanyaan"],
        bobot: 3,
        key: "nilai_tanya_jawab",
      },
    ];

    // Loop untuk setiap penguji - buat halaman formulir masing-masing
    const pengujiList = penilaian?.nilai_per_penguji || [];
    if (pengujiList.length === 0) {
      // Jika tidak ada penguji, buat satu halaman kosong
      doc.addPage();
      addWatermarkToPage();
      yPos = margin;
      doc.setFontSize(14);
      doc.setFont("times", "bold");
      doc.text("FORMULIR PENILAIAN SIDANG SKRIPSI", pageWidth / 2, yPos + 5, { align: "center" });
      yPos += 20;
      doc.setFont("times", "normal");
      doc.text("Belum ada penilaian dari penguji.", pageWidth / 2, yPos, { align: "center" });
    }
    pengujiList.forEach((pengujiNilai) => {
      doc.addPage();
      addWatermarkToPage();
      yPos = margin;

      doc.setFontSize(14);
      doc.setFont("times", "bold");
      yPos = addText("FORMULIR PENILAIAN SIDANG SKRIPSI", pageWidth / 2, yPos + 5, { align: "center" });
      yPos += 15;

      doc.setFontSize(11);
      doc.setFont("times", "normal");
      doc.text("Nama", margin, yPos);
      doc.text(`: ${mahasiswa.name}`, margin + 35, yPos);
      yPos += 6;
      doc.text("No. Pokok", margin, yPos);
      doc.text(`: ${mahasiswa.nim}`, margin + 35, yPos);
      yPos += 6;
      doc.text("Judul Skripsi", margin, yPos);
      const judulLines2 = doc.splitTextToSize(`: ${hasil.judul_skripsi}`, pageWidth - margin - 40);
      judulLines2.forEach((line: string, idx: number) => {
        if (idx === 0) {
          doc.text(line, margin + 35, yPos);
        } else {
          yPos += 5;
          doc.text(line, margin + 37, yPos);
        }
      });
      yPos += 12;

      // Tabel penilaian
      const colWidths = [90, 25, 20, 30];
      const tableWidth = colWidths.reduce((a, b) => a + b, 0);
      const tableStartX = (pageWidth - tableWidth) / 2;

      // Header tabel
      doc.setFont("times", "bold");
      doc.rect(tableStartX, yPos, colWidths[0], 8);
      doc.rect(tableStartX + colWidths[0], yPos, colWidths[1], 8);
      doc.rect(tableStartX + colWidths[0] + colWidths[1], yPos, colWidths[2], 8);
      doc.rect(tableStartX + colWidths[0] + colWidths[1] + colWidths[2], yPos, colWidths[3], 8);
      doc.text("Aspek yang dinilai", tableStartX + 2, yPos + 5);
      doc.text("Nilai*", tableStartX + colWidths[0] + 5, yPos + 5);
      doc.text("Bobot", tableStartX + colWidths[0] + colWidths[1] + 3, yPos + 5);
      doc.text("Nilai x Bobot", tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + 2, yPos + 5);
      yPos += 8;

      let totalNilaiBobot = 0;
      let totalBobot = 0;

      doc.setFont("times", "normal");
      aspekData.forEach((aspek) => {
        const rowHeight = 6 + aspek.sub.length * 4;
        doc.rect(tableStartX, yPos, colWidths[0], rowHeight);
        doc.rect(tableStartX + colWidths[0], yPos, colWidths[1], rowHeight);
        doc.rect(tableStartX + colWidths[0] + colWidths[1], yPos, colWidths[2], rowHeight);
        doc.rect(tableStartX + colWidths[0] + colWidths[1] + colWidths[2], yPos, colWidths[3], rowHeight);

        doc.setFont("times", "bold");
        doc.text(`${aspek.no}`, tableStartX + 2, yPos + 5);
        doc.text(`${aspek.title}`, tableStartX + 8, yPos + 5);
        doc.setFont("times", "normal");

        let subY = yPos + 9;
        aspek.sub.forEach((s) => {
          doc.setFontSize(9);
          doc.text(`–   ${s}`, tableStartX + 8, subY);
          subY += 4;
        });
        doc.setFontSize(11);

        // Nilai dari penguji ini - akses langsung property dan convert ke number
        let rawNilai: string | number | null = null;
        if (aspek.key === "nilai_penyajian_lisan") rawNilai = pengujiNilai.nilai_penyajian_lisan;
        else if (aspek.key === "nilai_sistematika_penulisan") rawNilai = pengujiNilai.nilai_sistematika_penulisan;
        else if (aspek.key === "nilai_isi_tulisan") rawNilai = pengujiNilai.nilai_isi_tulisan;
        else if (aspek.key === "nilai_originalitas") rawNilai = pengujiNilai.nilai_originalitas;
        else if (aspek.key === "nilai_tanya_jawab") rawNilai = pengujiNilai.nilai_tanya_jawab;

        // Convert string ke number jika perlu
        const nilaiPenguji = rawNilai != null ? parseFloat(String(rawNilai)) : null;

        if (nilaiPenguji != null && !isNaN(nilaiPenguji)) {
          doc.text(nilaiPenguji.toFixed(2), tableStartX + colWidths[0] + 8, yPos + rowHeight / 2 + 2);
        }

        // Bobot di tengah
        doc.text(aspek.bobot.toString(), tableStartX + colWidths[0] + colWidths[1] + 10, yPos + rowHeight / 2 + 2);

        // Nilai x Bobot
        if (nilaiPenguji != null && !isNaN(nilaiPenguji)) {
          const nilaiXBobot = nilaiPenguji * aspek.bobot;
          doc.text(nilaiXBobot.toFixed(2), tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + 8, yPos + rowHeight / 2 + 2);
          totalNilaiBobot += nilaiXBobot;
        }
        totalBobot += aspek.bobot;

        yPos += rowHeight;
      });

      // Total row
      doc.setFont("times", "bold");
      doc.rect(tableStartX, yPos, colWidths[0] + colWidths[1], 8);
      doc.rect(tableStartX + colWidths[0] + colWidths[1], yPos, colWidths[2] + colWidths[3], 8);
      doc.text("TOTAL", tableStartX + 2, yPos + 5);
      doc.text(totalBobot.toString(), tableStartX + colWidths[0] + colWidths[1] + 10, yPos + 5);
      if (totalNilaiBobot > 0) {
        doc.text(totalNilaiBobot.toFixed(2), tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + 8, yPos + 5);
      }
      yPos += 12;

      doc.setFont("times", "normal");
      doc.text("Catatan : Rentang  nilai 0-100", margin, yPos);
      yPos += 8;

      // Catatan/Saran dari penguji dengan pagination
      if (pengujiNilai?.catatan && pengujiNilai.catatan.trim() !== "") {
        // Tampilkan "Saran dan Komentar:" di halaman yang sama dengan tabel
        doc.setFont("times", "bold");
        doc.setFontSize(11);
        doc.text("Saran dan Komentar:", margin, yPos);
        yPos += 6;
        
        // Split catatan menjadi baris-baris
        doc.setFont("times", "normal");
        doc.setFontSize(10);
        const catatanLines = doc.splitTextToSize(pengujiNilai.catatan, pageWidth - margin * 2 - 10);
        
        // Ruang minimum yang dibutuhkan untuk tanda tangan (sekitar 25 points)
        // Dikurangi agar lebih fleksibel dan memanfaatkan ruang yang tersedia dengan lebih baik
        const minSpaceForSignature = 25;
        const lineHeight = 5;
        // Gunakan margin bawah yang lebih kecil untuk memanfaatkan ruang dengan lebih baik
        const bottomMargin = 5; // Margin yang sangat kecil untuk memaksimalkan penggunaan ruang
        const maxYPos = pageHeight - bottomMargin - minSpaceForSignature;
        
        // Tampilkan catatan baris per baris, pindah halaman jika tidak muat
        catatanLines.forEach((line: string) => {
          // Cek dulu apakah baris ini masih muat di halaman saat ini
          // Hanya pindah jika benar-benar tidak muat
          if (yPos + lineHeight > maxYPos) {
            // Tidak muat, pindah ke halaman baru
            doc.addPage();
            addWatermarkToPage();
            yPos = margin;
          }
          
          // Tulis baris di halaman saat ini
          doc.text(line, margin + 5, yPos);
          yPos += lineHeight;
        });
        // Kurangi spacing setelah komentar agar lebih fleksibel
        yPos += 3;
      }

      // Pastikan ada ruang yang cukup untuk tanda tangan sebelum menampilkannya
      // Hanya pindah ke halaman baru jika benar-benar tidak muat
      // Ruang yang dibutuhkan: peran (10) + tanda tangan (15) + nama (10) = sekitar 35
      // Tapi kita kurangi menjadi 30 agar lebih fleksibel dan tanda tangan tetap di halaman yang sama jika komentar pendek
      const spaceNeededForSignature = 30;
      
      // Cek apakah masih ada ruang yang cukup untuk tanda tangan
      // Gunakan perhitungan yang lebih fleksibel - hanya pindah jika benar-benar tidak muat
      // Margin bawah dikurangi untuk memberikan lebih banyak ruang
      const bottomMargin = 10; // Margin bawah yang lebih kecil untuk perhitungan
      const availableSpace = pageHeight - yPos - bottomMargin;
      
      // Hanya pindah jika ruang yang tersedia kurang dari yang dibutuhkan
      // Ini memastikan tanda tangan tetap di halaman yang sama jika masih ada ruang yang cukup
      if (availableSpace < spaceNeededForSignature) {
        // Tidak muat, buat halaman baru
        doc.addPage();
        addWatermarkToPage();
        yPos = margin;
      }

      // Nama peran penguji
      doc.setFontSize(11);
      const peran = pengujiNilai?.peran_penguji || "";
      const peranText = peran === "pembimbing"
        ? "Pembimbing"
        : peran === "penguji_1"
        ? "Penguji 1"
        : peran === "penguji_2"
        ? "Penguji 2"
        : "Penguji";

      // Tanda tangan penguji
      doc.text(peranText, pageWidth / 2, yPos, { align: "center" });
      yPos += 10;
      
      // Tambahkan gambar tanda tangan penguji jika ada (tanpa garis jika tidak ada tanda tangan)
      if (pengujiNilai?.penguji_id && pengujiSignatures[pengujiNilai.penguji_id]) {
        try {
          const signatureImg = pengujiSignatures[pengujiNilai.penguji_id];
          if (signatureImg) {
            doc.addImage(signatureImg, "PNG", pageWidth / 2 - 20, yPos, 40, 15);
          }
            } catch (error) {
              // Error adding penguji signature - silent fail
            }
      }
      yPos += 20;
      doc.text(`(${pengujiNilai?.penguji_name || "____________________"})`, pageWidth / 2, yPos, { align: "center" });
    });

    // ========== HALAMAN 3: NILAI SIDANG SKRIPSI ==========
    doc.addPage();
    addWatermarkToPage();
    yPos = margin;

    doc.setFontSize(14);
    doc.setFont("times", "bold");
    yPos = addText("NILAI SIDANG SKRIPSI", pageWidth / 2, yPos + 5, { align: "center" });
    yPos += 15;

    doc.setFontSize(11);
    doc.setFont("times", "normal");
    doc.text("Nama", margin, yPos);
    doc.text(`: ${mahasiswa.name}`, margin + 35, yPos);
    yPos += 6;
    doc.text("No. Pokok", margin, yPos);
    doc.text(`: ${mahasiswa.nim}`, margin + 35, yPos);
    yPos += 6;
    doc.text("Judul Skripsi", margin, yPos);
    const judulLines3 = doc.splitTextToSize(`: ${hasil.judul_skripsi}`, pageWidth - margin - 40);
    judulLines3.forEach((line: string, idx: number) => {
      if (idx === 0) {
        doc.text(line, margin + 35, yPos);
      } else {
        yPos += 5;
        doc.text(line, margin + 37, yPos);
      }
    });
    yPos += 12;

    // Tabel nilai penguji
    const nilaiTableX = margin + 20;
    const nilaiColWidths = [100, 40];
    const nilaiTableWidth = nilaiColWidths.reduce((a, b) => a + b, 0);

    doc.setFont("times", "bold");
    doc.rect(nilaiTableX, yPos, nilaiColWidths[0], 8);
    doc.rect(nilaiTableX + nilaiColWidths[0], yPos, nilaiColWidths[1], 8);
      doc.text("Pembimbing /Penguji", nilaiTableX + 30, yPos + 5);
    doc.text("Nilai", nilaiTableX + nilaiColWidths[0] + 15, yPos + 5);
    yPos += 8;

    doc.setFont("times", "normal");
    allPenguji.forEach((p, idx) => {
      doc.rect(nilaiTableX, yPos, nilaiColWidths[0], 12);
      doc.rect(nilaiTableX + nilaiColWidths[0], yPos, nilaiColWidths[1], 12);
      doc.text(`${idx + 1}. ${p.name}`, nilaiTableX + 5, yPos + 8);

      // Get nilai from penilaian data
      const pengujiNilai = penilaian?.nilai_per_penguji?.find(
        (np) => np.penguji_name === p.name
      );
      if (pengujiNilai?.nilai_akhir != null && typeof pengujiNilai.nilai_akhir === "number") {
        doc.text(pengujiNilai.nilai_akhir.toFixed(2), nilaiTableX + nilaiColWidths[0] + 15, yPos + 8);
      } else if (pengujiNilai?.nilai_akhir != null) {
        doc.text(String(pengujiNilai.nilai_akhir), nilaiTableX + nilaiColWidths[0] + 15, yPos + 8);
      } else {
        doc.text("__________", nilaiTableX + nilaiColWidths[0] + 10, yPos + 8);
      }
      yPos += 12;
    });

    // Total row
    doc.rect(nilaiTableX, yPos, nilaiTableWidth, 8);
    doc.text("TOTAL", nilaiTableX + nilaiColWidths[0] / 2 - 10, yPos + 5);
    yPos += 25; // Tambah jarak sebelum rumus

    // Rumus nilai akhir - posisi lebih rapi
    const rumusX = margin + 30;
    doc.text("Nilai Akhir =", rumusX, yPos);
    doc.text("Total", rumusX + 50, yPos - 4);
    doc.line(rumusX + 42, yPos - 1, rumusX + 68, yPos - 1); // Garis pecahan
    doc.text("∑ Penguji", rumusX + 43, yPos + 6);
    doc.text("=", rumusX + 80, yPos);

    // Kotak nilai akhir - lebih besar dan rapi
    const kotakX = rumusX + 95;
    const kotakW = 35;
    const kotakH = 18;
    doc.rect(kotakX, yPos - 10, kotakW, kotakH);
    if (penilaian?.nilai_akhir != null) {
      doc.setFontSize(14);
      doc.setFont("times", "bold");
      const nilaiAkhirStr = typeof penilaian.nilai_akhir === "number" 
        ? penilaian.nilai_akhir.toFixed(2) 
        : String(penilaian.nilai_akhir);
      // Posisi teks di tengah kotak
      const textWidth = doc.getTextWidth(nilaiAkhirStr);
      doc.text(nilaiAkhirStr, kotakX + (kotakW - textWidth) / 2, yPos + 1);
      doc.setFontSize(11);
      doc.setFont("times", "normal");
    }
    yPos += 20;

    // Tanda tangan
    doc.text("Pembimbing", pageWidth - margin - 50, yPos);
    yPos += 10;
    
    // Tambahkan gambar tanda tangan moderator jika ada (tanpa garis jika ada tanda tangan)
    if (jadwal.pembimbing?.id && pengujiSignatures[jadwal.pembimbing.id]) {
      try {
        const signatureImg = pengujiSignatures[jadwal.pembimbing.id];
        if (signatureImg) {
          doc.addImage(signatureImg, "PNG", pageWidth - margin - 50, yPos, 40, 15);
        }
      } catch (error) {
        // Error adding moderator signature - silent fail
        // Jika error, tampilkan garis sebagai fallback
        doc.text("____________________", pageWidth - margin - 50, yPos);
      }
    } else {
      // Tampilkan garis hanya jika tidak ada tanda tangan
      doc.text("____________________", pageWidth - margin - 50, yPos);
    }
    yPos += 20;
    doc.text(`${jadwal.pembimbing?.name || "____________________"}`, pageWidth - margin - 50, yPos);
    yPos += 15;

    // Catatan
    doc.setFont("times", "bold");
    doc.text("Catatan :", margin, yPos);
    doc.setFont("times", "normal");
    doc.text("*  ditulis dengan angka", margin + 25, yPos);
    yPos += 5;
    doc.text("** ditulis dengan huruf", margin + 25, yPos);
    yPos += 12;

    // Tabel rentang nilai
    const rentangX = margin;
    const rentangColWidth = 35;
    const rentangData = [
      ["85,00 – 100", "A", "60,00 – 64,99", "C+"],
      ["80,00 – 84,99", "A–", "55,00 – 59,99", "C"],
      ["75,00 – 79,99", "B+", "50,00 – 54,99", "C–"],
      ["70,00 – 74,99", "B", "45,00 – 49,99", "D"],
      ["65,00 – 69,99", "B–", "0 – 44,99", "E"],
    ];

    // Header
    doc.rect(rentangX, yPos, rentangColWidth, 8);
    doc.rect(rentangX + rentangColWidth, yPos, 15, 8);
    doc.rect(rentangX + rentangColWidth + 15, yPos, rentangColWidth, 8);
    doc.rect(rentangX + rentangColWidth * 2 + 15, yPos, 15, 8);
    doc.setFontSize(9);
    doc.text("Rentang Nilai", rentangX + 5, yPos + 5);
    doc.text("Rentang Nilai", rentangX + rentangColWidth + 20, yPos + 5);
    yPos += 8;

    rentangData.forEach((row) => {
      doc.rect(rentangX, yPos, rentangColWidth, 7);
      doc.rect(rentangX + rentangColWidth, yPos, 15, 7);
      doc.rect(rentangX + rentangColWidth + 15, yPos, rentangColWidth, 7);
      doc.rect(rentangX + rentangColWidth * 2 + 15, yPos, 15, 7);
      doc.text(row[0], rentangX + 3, yPos + 5);
      doc.text(row[1], rentangX + rentangColWidth + 5, yPos + 5);
      doc.text(row[2], rentangX + rentangColWidth + 18, yPos + 5);
      doc.text(row[3], rentangX + rentangColWidth * 2 + 20, yPos + 5);
      yPos += 7;
    });

    // Footer halaman
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont("times", "normal");
      doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
    }

    // Save PDF
    const fileName = `Berita_Acara_Sidang_${mahasiswa.nim}_${jadwal.tanggal.split("-").reverse().join("-")}.pdf`;
    doc.save(fileName);
    } catch (error) {
      alert("Gagal membuat PDF. Silakan coba lagi.");
    }
  };

  // Load hasil form when selecting mahasiswa
  // Load hasil form when selecting mahasiswa
  const loadHasilForm = (mahasiswaId: number) => {
    const existing = hasilData[mahasiswaId];
    const formData: typeof hasilForm = existing
      ? {
          judul_skripsi: existing.judul_skripsi || "",
          keputusan: (existing.keputusan || "") as typeof hasilForm.keputusan,
          catatan_perbaikan: existing.catatan_perbaikan || "",
        }
      : {
          judul_skripsi: "",
          keputusan: "",
          catatan_perbaikan: "",
        };
    setHasilForm(formData);
    setSavedHasilForm(formData);
    setHasUnsavedHasil(false);
    setHasilMessage(null);
  };

  // Detect unsaved changes in hasil form
  useEffect(() => {
    if (!savedHasilForm) return;
    const hasChanges =
      hasilForm.judul_skripsi !== savedHasilForm.judul_skripsi ||
      hasilForm.keputusan !== savedHasilForm.keputusan ||
      hasilForm.catatan_perbaikan !== savedHasilForm.catatan_perbaikan;
    setHasUnsavedHasil(hasChanges);
    if (hasChanges) setHasilMessage(null);
  }, [hasilForm, savedHasilForm]);

  // Get penilaian for a specific mahasiswa
  const getPenilaianMahasiswa = (mahasiswaId: number): PenilaianMahasiswa | undefined => {
    return penilaianData.find((p) => p.mahasiswa_id === mahasiswaId);
  };

  // Check if current user has submitted penilaian for mahasiswa
  const hasMyPenilaian = (mahasiswaId: number): boolean => {
    const penilaian = getPenilaianMahasiswa(mahasiswaId);
    if (!penilaian) return false;
    return penilaian.nilai_per_penguji.some((p) => p.penguji_id === currentUserId && p.nilai_akhir !== null);
  };

  const getSelectedMahasiswaData = () => {
    if (!selectedMahasiswa || !jadwal?.mahasiswa_list) return null;
    return jadwal.mahasiswa_list.find((m) => m.id === selectedMahasiswa);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!jadwal) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Jadwal tidak ditemukan</p>
          <button
            onClick={() => navigate("/bimbingan-akhir")}
            className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const calculatedNilai = hitungNilaiAkhir(nilaiForm);
  const selectedMahasiswaData = getSelectedMahasiswaData();
  const selectedPenilaian = selectedMahasiswa ? getPenilaianMahasiswa(selectedMahasiswa) : null;

  return (
    <>
      <PageMeta title="Penilaian Sidang Skripsi | ISME" description="Form Penilaian Sidang Skripsi" />

      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 sticky top-0 z-10">
          <div className="max-w-7xl mx-auto px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => navigate(`/bimbingan-akhir/sidang-skripsi/${id}`)}
                  className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600 transition"
                >
                  <FontAwesomeIcon icon={faArrowLeft} />
                </button>
                <div>
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">Penilaian Sidang Skripsi</h1>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {jadwal.tanggal} • {jadwal.ruangan?.nama || "Ruangan belum ditentukan"}
                  </p>
                </div>
              </div>
              {jadwal.dosen_role && (
                <span className="hidden sm:inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300">
                  {jadwal.dosen_role}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row gap-6">
            {/* Sidebar - Daftar Mahasiswa */}
            <motion.div
              initial={false}
              animate={{ width: showMahasiswaList ? 320 : 72 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="flex-shrink-0 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 lg:sticky lg:top-24 self-start hidden lg:block overflow-hidden"
            >
              <button
                onClick={() => setShowMahasiswaList(!showMahasiswaList)}
                className="w-full flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-white"
              >
                <span className="flex items-center gap-2 whitespace-nowrap ">
                  <FontAwesomeIcon icon={faUsers} className="text-gray-400 flex-shrink-0" />
                  <motion.span
                    initial={false}
                    animate={{ opacity: showMahasiswaList ? 1 : 0, width: showMahasiswaList ? "auto" : 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    Pilih Mahasiswa
                    <span className="text-xs font-normal text-gray-500 ml-1">
                      ({jadwal.mahasiswa_list?.length || 0})
                    </span>
                  </motion.span>
                </span>
                <FontAwesomeIcon
                  icon={showMahasiswaList ? faChevronLeft : faChevronRight}
                  className="text-gray-400 text-xs flex-shrink-0"
                />
              </button>

              <motion.div
                initial={false}
                animate={{ opacity: showMahasiswaList ? 1 : 0, height: showMahasiswaList ? "auto" : 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
              {/* Search Input */}
              <div className="mt-3 mb-2 px-0.5">
                <input
                  type="text"
                  placeholder="Cari mahasiswa..."
                  value={searchMahasiswa}
                  onChange={(e) => setSearchMahasiswa(e.target.value)}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-brand-500 transition"
                />
              </div>
              <div className="space-y-2 max-h-[50vh] overflow-y-auto">
                {jadwal.mahasiswa_list
                  ?.filter((m) => 
                    m.name.toLowerCase().includes(searchMahasiswa.toLowerCase()) ||
                    m.nim.includes(searchMahasiswa)
                  )
                  .map((mahasiswa, idx) => {
                  const hasSubmitted = hasMyPenilaian(mahasiswa.id);
                  const penilaian = getPenilaianMahasiswa(mahasiswa.id);
                  const isSelected = selectedMahasiswa === mahasiswa.id;

                  return (
                    <button
                      key={mahasiswa.id}
                      onClick={() => handleSelectMahasiswa(mahasiswa.id)}
                      className={`w-full text-left p-3 rounded-xl transition ${
                        isSelected
                          ? "bg-brand-50 dark:bg-brand-900/20 border-2 border-brand-500"
                          : "bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                              isSelected
                                ? "bg-brand-500 text-white"
                                : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                            }`}
                          >
                            {idx + 1}
                          </span>
                          <div>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{mahasiswa.name}</p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">{mahasiswa.nim}</p>
                          </div>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          {isDosenTerlibat() && (
                            hasSubmitted ? (
                              <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 w-4 h-4" />
                            ) : (
                              <FontAwesomeIcon icon={faExclamationCircle} className="text-yellow-500 w-4 h-4" />
                            )
                          )}
                          {penilaian?.nilai_akhir && (
                            <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                              {Number(penilaian.nilai_akhir).toFixed(2)} ({penilaian.nilai_huruf})
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
              </motion.div>
            </motion.div>

            {/* Mobile - Daftar Mahasiswa (sebagai bagian dari layout, bukan fixed) */}
            <div className="lg:hidden w-full mb-6">
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
                <button
                  onClick={() => setShowMahasiswaList(!showMahasiswaList)}
                  className="w-full flex items-center justify-between text-sm font-semibold text-gray-900 dark:text-white"
                >
                  <span className="flex items-center gap-2">
                    <FontAwesomeIcon icon={faUsers} className="text-gray-400" />
                    Pilih Mahasiswa
                    <span className="text-xs font-normal text-gray-500">
                      ({jadwal.mahasiswa_list?.length || 0})
                    </span>
                  </span>
                  <FontAwesomeIcon
                    icon={showMahasiswaList ? faChevronUp : faChevronDown}
                    className="text-gray-400 text-xs"
                  />
                </button>

                {showMahasiswaList && (
                <>
                {/* Search Input Mobile */}
                <div className="mt-3 mb-2">
                  <input
                    type="text"
                    placeholder="Cari mahasiswa..."
                    value={searchMahasiswa}
                    onChange={(e) => setSearchMahasiswa(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:border-brand-500 transition"
                  />
                </div>
                <div className="space-y-2 max-h-[40vh] overflow-y-auto">
                  {jadwal.mahasiswa_list
                    ?.filter((m) => 
                      m.name.toLowerCase().includes(searchMahasiswa.toLowerCase()) ||
                      m.nim.includes(searchMahasiswa)
                    )
                    .map((mahasiswa, idx) => {
                    const hasSubmitted = hasMyPenilaian(mahasiswa.id);
                    const penilaian = getPenilaianMahasiswa(mahasiswa.id);
                    const isSelected = selectedMahasiswa === mahasiswa.id;

                    return (
                      <button
                        key={mahasiswa.id}
                        onClick={() => {
                          handleSelectMahasiswa(mahasiswa.id);
                          setShowMahasiswaList(false); // Tutup setelah pilih
                        }}
                        className={`w-full text-left p-3 rounded-xl transition ${
                          isSelected
                            ? "bg-brand-50 dark:bg-brand-900/20 border-2 border-brand-500"
                            : "bg-gray-50 dark:bg-gray-700/50 border-2 border-transparent hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <span
                              className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                                isSelected
                                  ? "bg-brand-500 text-white"
                                  : "bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300"
                              }`}
                            >
                              {idx + 1}
                            </span>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">{mahasiswa.name}</p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">{mahasiswa.nim}</p>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {isDosenTerlibat() && (
                              hasSubmitted ? (
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-500 w-4 h-4" />
                              ) : (
                                <FontAwesomeIcon icon={faExclamationCircle} className="text-yellow-500 w-4 h-4" />
                              )
                            )}
                            {penilaian?.nilai_akhir && (
                              <span className="text-xs font-bold text-brand-600 dark:text-brand-400">
                                {Number(penilaian.nilai_akhir).toFixed(2)} ({penilaian.nilai_huruf})
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
                </>
                )}
              </div>
            </div>

            {/* Main Content - Form Penilaian */}
            <div className="flex-1 min-w-0">
              {selectedMahasiswa && selectedMahasiswaData ? (
                <div className="space-y-6">
                  {/* Info Mahasiswa */}
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-full bg-brand-100 dark:bg-brand-900/30 flex items-center justify-center flex-shrink-0">
                        <span className="text-base sm:text-xl font-bold text-brand-600 dark:text-brand-400">
                          {selectedMahasiswaData.name.charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <h2 className="text-sm sm:text-lg font-bold text-gray-900 dark:text-white truncate">{selectedMahasiswaData.name}</h2>
                        <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">
                          {selectedMahasiswaData.nim} • Angkatan {selectedMahasiswaData.nim?.substring(0, 4)}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Form Penilaian - Hanya tampil untuk dosen terlibat */}
                  {isDosenTerlibat() && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                    <div className="flex items-center gap-3 mb-4 sm:mb-6">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-orange-500 flex items-center justify-center flex-shrink-0">
                        <FontAwesomeIcon icon={faClipboardCheck} className="text-white text-sm sm:text-base" />
                      </div>
                      <div>
                        <h3 className="text-sm sm:text-lg font-semibold text-gray-900 dark:text-white">Form Penilaian</h3>
                        <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Masukkan nilai 0-100 untuk setiap aspek</p>
                      </div>
                    </div>

                    {/* Warning jika hasil sudah finalized */}
                    {isHasilFinalized() && !isAdmin() && (
                      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 sm:p-4 mb-4">
                        <div className="flex items-start gap-2 sm:gap-3">
                          <FontAwesomeIcon icon={faExclamationTriangle} className="text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                          <div className="flex-1">
                            <p className="text-xs sm:text-sm font-semibold text-amber-800 dark:text-amber-300 mb-1">
                              Keputusan Sudah Di-Finalize
                            </p>
                            <p className="text-[10px] sm:text-xs text-amber-700 dark:text-amber-400">
                              Penilaian tidak dapat diubah karena keputusan sudah di-finalize.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-4">
                      {ASPEK_PENILAIAN.map((aspek, aspekIdx) => (
                        <div key={aspek.key} className="p-3 sm:p-4 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/30">
                          {/* Header Aspek */}
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 mb-3">
                            <div className="flex items-start gap-2 sm:gap-3">
                              <span className="w-6 h-6 sm:w-7 sm:h-7 rounded-lg bg-brand-500 text-white text-xs sm:text-sm font-bold flex items-center justify-center flex-shrink-0">
                                {aspekIdx + 1}
                              </span>
                              <div className="flex-1">
                                <label className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white block">
                                  {aspek.label}
                                </label>
                                <span className="inline-block mt-1 px-2 py-0.5 rounded-full text-[10px] sm:text-xs font-medium bg-brand-100 text-brand-700 dark:bg-brand-900/30 dark:text-brand-400">
                                  Bobot: {aspek.bobot}
                                </span>
                              </div>
                            </div>
                          </div>
                          
                          {/* Sub Kriteria */}
                          <div className="ml-8 sm:ml-10 mb-3">
                            <ul className="text-[11px] sm:text-xs text-gray-600 dark:text-gray-400 space-y-0.5 sm:space-y-1">
                              {aspek.subKriteria.map((sub, subIdx) => (
                                <li key={subIdx} className="flex items-start gap-1.5 sm:gap-2">
                                  <span className="text-gray-400 dark:text-gray-500">–</span>
                                  <span>{sub}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                          
                          {/* Input Nilai */}
                          <div className="ml-8 sm:ml-10">
                            <div className="flex items-center gap-2">
                              <input
                                type="number"
                                min="0"
                                max="100"
                                step="0.01"
                                value={nilaiForm[aspek.key as keyof NilaiForm]}
                                onChange={(e) => {
                                  let value = e.target.value;
                                  const key = aspek.key;
                                  
                                  // Validasi: nilai harus 0-100
                                  if (value !== "") {
                                    const numValue = parseFloat(value);
                                    if (numValue > 100) value = "100";
                                    if (numValue < 0) value = "0";
                                  }
                                  
                                  setNilaiForm(prev => ({ ...prev, [key]: value }));
                                }}
                                onWheel={(e) => (e.target as HTMLInputElement).blur()}
                                disabled={!canEditPenilaian()}
                                className={`w-28 sm:w-36 px-3 py-2 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-base sm:text-lg font-medium focus:ring-2 focus:ring-brand-500 focus:border-transparent transition ${
                                  !canEditPenilaian() ? "opacity-60 cursor-not-allowed" : ""
                                }`}
                                placeholder="0.00"
                              />
                              <span className="text-xs text-gray-400 dark:text-gray-500">/ 100</span>
                            </div>
                          </div>
                        </div>
                      ))}

                      {/* Catatan */}
                      <div className="space-y-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                        <label className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white">Catatan / Masukan</label>
                        <textarea
                          value={nilaiForm.catatan}
                          onChange={(e) => {
                            const value = e.target.value;
                            setNilaiForm(prev => ({ ...prev, catatan: value }));
                          }}
                          rows={3}
                          disabled={!canEditPenilaian()}
                          className={`w-full px-3 py-2 sm:px-4 sm:py-3 rounded-lg sm:rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-brand-500 focus:border-transparent transition ${
                            !canEditPenilaian() ? "opacity-60 cursor-not-allowed" : ""
                          }`}
                          placeholder="Masukan atau saran untuk mahasiswa..."
                        />
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Preview Nilai & Save - Hanya tampil untuk dosen terlibat */}
                  {isDosenTerlibat() && (
                  <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                    <div className="flex flex-col gap-4">
                        {/* Nilai Preview */}
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-xs sm:text-sm text-gray-500 dark:text-gray-400">Nilai Akhir Anda</p>
                            <div className="flex items-baseline gap-1 sm:gap-2">
                              <span className="text-2xl sm:text-4xl font-bold text-brand-600 dark:text-brand-400">
                                {calculatedNilai !== null ? calculatedNilai.toFixed(2) : "-"}
                              </span>
                              {calculatedNilai !== null && (
                                <span className="text-base sm:text-xl font-semibold text-gray-600 dark:text-gray-400">
                                  ({konversiNilaiHuruf(calculatedNilai)})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                      {/* Save Button & Message */}
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-3">
                        <button
                          onClick={handleSavePenilaian}
                          disabled={saving || calculatedNilai === null || !hasUnsavedChanges || !canEditPenilaian()}
                          className={`w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 sm:px-6 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-semibold text-sm sm:text-base transition ${
                            hasUnsavedChanges
                              ? "bg-amber-500 text-white hover:bg-amber-600"
                              : "bg-brand-500 text-white hover:bg-brand-600"
                          } disabled:opacity-50 disabled:cursor-not-allowed`}
                        >
                          <FontAwesomeIcon icon={faSave} className={saving ? "animate-pulse" : ""} />
                          {saving ? "Menyimpan..." : hasUnsavedChanges ? "Simpan Perubahan" : "Tersimpan"}
                        </button>
                        {saveMessage && (
                          <span
                            className={`text-xs sm:text-sm text-center sm:text-left ${
                              saveMessage.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                            }`}
                          >
                            {saveMessage.text}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Nilai dari Semua Penguji - Tampil untuk semua user */}
                  {selectedPenilaian && selectedPenilaian.nilai_per_penguji.length > 0 && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4 sm:p-6">
                      <h3 className="text-base sm:text-lg font-semibold text-gray-900 dark:text-white mb-3 sm:mb-4">Nilai dari Semua Penguji</h3>
                      
                      {/* Cards untuk setiap penguji */}
                      <div className="space-y-3 mb-4">
                        {selectedPenilaian.nilai_per_penguji.map((np, npIdx) => (
                          <div
                            key={npIdx}
                            className={`rounded-xl border p-3 sm:p-4 ${
                              np.penguji_id === currentUserId
                                ? "border-brand-300 bg-brand-50 dark:border-brand-600 dark:bg-brand-900/20"
                                : "border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-700/30"
                            }`}
                          >
                            {/* Header - nama & nilai akhir */}
                            <div className="flex items-start sm:items-center justify-between gap-2 mb-3">
                              <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                                  np.penguji_id === currentUserId
                                    ? "bg-brand-100 dark:bg-brand-900/50"
                                    : "bg-gray-200 dark:bg-gray-600"
                                }`}>
                                  <span className={`text-xs sm:text-sm font-bold ${
                                    np.penguji_id === currentUserId
                                      ? "text-brand-600 dark:text-brand-400"
                                      : "text-gray-600 dark:text-gray-300"
                                  }`}>
                                    {np.penguji_name?.charAt(0).toUpperCase() || "?"}
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="font-medium text-sm sm:text-base text-gray-900 dark:text-white truncate">{np.penguji_name}</p>
                                  <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">
                                    {np.peran_penguji === "moderator"
                                      ? "Pembimbing"
                                      : np.peran_penguji === "penguji_1"
                                      ? "Kom. 1 (Materi)"
                                      : "Kom. 2 (Metlit)"}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <p className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white">
                                  {np.nilai_akhir != null ? Number(np.nilai_akhir).toFixed(2) : "-"}
                                </p>
                                <p className="text-[10px] sm:text-xs text-gray-500 dark:text-gray-400">Nilai Akhir</p>
                              </div>
                            </div>
                            {/* Grid nilai aspek - 5 kolom di mobile juga */}
                            <div className="grid grid-cols-5 gap-1 sm:gap-2">
                              {[
                                { label: "Peny.", fullLabel: "Penyajian", value: np.nilai_penyajian_lisan },
                                { label: "Sist.", fullLabel: "Sistematika", value: np.nilai_sistematika_penulisan },
                                { label: "Isi", fullLabel: "Isi", value: np.nilai_isi_tulisan },
                                { label: "Orig.", fullLabel: "Originalitas", value: np.nilai_originalitas },
                                { label: "T.J.", fullLabel: "Tanya Jawab", value: np.nilai_tanya_jawab },
                              ].map((item, idx) => (
                                <div key={idx} className="text-center p-1.5 sm:p-2 rounded-lg bg-white/50 dark:bg-gray-800/50">
                                  <p className="text-[9px] sm:text-xs text-gray-500 dark:text-gray-400 mb-0.5 sm:mb-1">
                                    <span className="sm:hidden">{item.label}</span>
                                    <span className="hidden sm:inline">{item.fullLabel}</span>
                                  </p>
                                  <p className="text-xs sm:text-sm font-semibold text-gray-700 dark:text-gray-300">
                                    {item.value != null ? Number(item.value).toFixed(0) : "-"}
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>

                      {/* Nilai Akhir Mahasiswa */}
                      <div className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-600 p-4 text-white">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-sm opacity-90">Nilai Akhir Mahasiswa</p>
                            <p className="text-xs opacity-75 mt-0.5">Rata-rata dari semua penguji</p>
                          </div>
                          <div className="text-right">
                            <span className="text-3xl font-bold">
                              {selectedPenilaian.nilai_akhir != null ? Number(selectedPenilaian.nilai_akhir).toFixed(2) : "-"}
                            </span>
                            {selectedPenilaian.nilai_huruf && (
                              <span className="ml-2 px-3 py-1 rounded-full bg-white/20 text-lg font-bold">
                                {selectedPenilaian.nilai_huruf}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Form Keputusan Pembimbing - Hanya tampil jika user adalah Pembimbing */}
                  {isPembimbing() && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                      {/* Header */}
                      <div className="bg-gradient-to-r from-brand-500 to-brand-600 px-6 py-4">
                        <h3 className="text-lg font-semibold text-white flex items-center gap-3">
                          <FontAwesomeIcon icon={faClipboardCheck} />
                          Keputusan Sidang Skripsi
                        </h3>
                        <p className="text-sm text-white/80 mt-1">
                          Tentukan keputusan akhir sebagai Pembimbing
                        </p>
                      </div>

                      <div className="p-6 space-y-5">
                        {/* Status jika sudah finalized */}
                        {hasilData[selectedMahasiswa] && hasilData[selectedMahasiswa].is_finalized && (
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <FontAwesomeIcon icon={faCheckCircle} className="text-green-600 dark:text-green-400" />
                                <div>
                                  <p className="text-sm font-semibold text-green-800 dark:text-green-300">
                                    Keputusan Sudah Di-Finalize
                                  </p>
                                  {hasilData[selectedMahasiswa].finalized_at && (
                                    <p className="text-xs text-green-700 dark:text-green-400 mt-0.5">
                                      Di-finalize pada: {new Date(hasilData[selectedMahasiswa].finalized_at!).toLocaleString('id-ID')}
                                      {hasilData[selectedMahasiswa].finalized_by_user && 
                                        ` oleh ${hasilData[selectedMahasiswa].finalized_by_user.name}`
                                      }
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Judul Skripsi */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Judul Skripsi <span className="text-red-500">*</span>
                          </label>
                          <textarea
                            value={hasilForm.judul_skripsi}
                            onChange={(e) => setHasilForm({ ...hasilForm, judul_skripsi: e.target.value })}
                            rows={3}
                            disabled={!isDosenTerlibat() || (hasilData[selectedMahasiswa]?.is_finalized && !isAdmin()) || !allPengujiHaveSubmitted()}
                            className={`w-full px-4 py-3 rounded-xl border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition resize-none ${
                              !isDosenTerlibat() || (hasilData[selectedMahasiswa]?.is_finalized && !isAdmin()) || !allPengujiHaveSubmitted()
                                ? "opacity-60 cursor-not-allowed" 
                                : ""
                            }`}
                            placeholder="Masukkan judul skripsi mahasiswa..."
                          />
                        </div>

                        {/* Keputusan */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                            Keputusan <span className="text-red-500">*</span>
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            {[
                              { value: "tidak_lulus", label: "Tidak Lulus", icon: "✗", desc: "Mahasiswa harus mengulang" },
                              { value: "lulus_tanpa_perbaikan", label: "Lulus", icon: "✓", desc: "Tanpa perbaikan" },
                              { value: "lulus_dengan_perbaikan", label: "Lulus Revisi", icon: "!", desc: "Dengan perbaikan" },
                            ].map((option) => (
                              <label
                                key={option.value}
                                className={`relative flex flex-col items-center p-4 rounded-xl border-2 transition-all ${
                                  !isDosenTerlibat() || (hasilData[selectedMahasiswa]?.is_finalized && !isAdmin()) || !allPengujiHaveSubmitted()
                                    ? "opacity-60 cursor-not-allowed"
                                    : "cursor-pointer"
                                } ${
                                  hasilForm.keputusan === option.value
                                    ? "border-brand-500 bg-brand-50 dark:bg-brand-900/20 shadow-md"
                                    : "border-gray-200 dark:border-gray-600 hover:border-brand-300 dark:hover:border-brand-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                                }`}
                              >
                                <input
                                  type="radio"
                                  name="keputusan"
                                  value={option.value}
                                  checked={hasilForm.keputusan === option.value}
                                  onChange={(e) => setHasilForm({ ...hasilForm, keputusan: e.target.value as typeof hasilForm.keputusan })}
                                  disabled={!isDosenTerlibat() || (hasilData[selectedMahasiswa]?.is_finalized && !isAdmin()) || !allPengujiHaveSubmitted()}
                                  className="sr-only"
                                />
                                <div
                                  className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold mb-2 ${
                                    hasilForm.keputusan === option.value
                                      ? "bg-brand-500 text-white"
                                      : "bg-gray-100 dark:bg-gray-600 text-gray-500 dark:text-gray-400"
                                  }`}
                                >
                                  {option.icon}
                                </div>
                                <span className={`text-sm font-semibold text-center ${
                                  hasilForm.keputusan === option.value
                                    ? "text-brand-700 dark:text-brand-300"
                                    : "text-gray-700 dark:text-gray-300"
                                }`}>
                                  {option.label}
                                </span>
                                <span className="text-xs text-gray-500 dark:text-gray-400 text-center mt-1">
                                  {option.desc}
                                </span>
                                {hasilForm.keputusan === option.value && (
                                  <div className="absolute top-2 right-2 w-5 h-5 rounded-full bg-brand-500 flex items-center justify-center">
                                    <FontAwesomeIcon icon={faCheckCircle} className="text-white text-xs" />
                                  </div>
                                )}
                              </label>
                            ))}
                          </div>
                        </div>

                        {/* Catatan Perbaikan - Hanya muncul jika pilih "Lulus Dengan Perbaikan" */}
                        {hasilForm.keputusan === "lulus_dengan_perbaikan" && (
                          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
                            <label className="block text-sm font-medium text-amber-800 dark:text-amber-300 mb-2">
                              Catatan Perbaikan
                            </label>
                            <textarea
                              value={hasilForm.catatan_perbaikan}
                              onChange={(e) => setHasilForm({ ...hasilForm, catatan_perbaikan: e.target.value })}
                              rows={4}
                              disabled={!isDosenTerlibat() || (hasilData[selectedMahasiswa]?.is_finalized && !isAdmin()) || !allPengujiHaveSubmitted()}
                              className={`w-full px-4 py-3 rounded-lg border border-amber-200 dark:border-amber-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent transition resize-none ${
                                !isDosenTerlibat() || (hasilData[selectedMahasiswa]?.is_finalized && !isAdmin()) || !allPengujiHaveSubmitted()
                                  ? "opacity-60 cursor-not-allowed" 
                                  : ""
                              }`}
                              placeholder="Masukkan catatan/masukan perbaikan dari penguji..."
                            />
                          </div>
                        )}

                        {/* Tombol Simpan Keputusan, Finalize & Cetak */}
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700 space-y-3">
                          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
                            <button
                              onClick={handleSaveHasil}
                              disabled={!isDosenTerlibat() || savingHasil || !hasilForm.judul_skripsi || !hasilForm.keputusan || !hasUnsavedHasil || (hasilData[selectedMahasiswa]?.is_finalized && !isAdmin()) || !allPengujiHaveSubmitted()}
                              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-semibold transition shadow-sm ${
                                hasUnsavedHasil
                                  ? "bg-amber-500 text-white hover:bg-amber-600"
                                  : "bg-brand-500 text-white hover:bg-brand-600"
                              } disabled:opacity-50 disabled:cursor-not-allowed`}
                              title={!allPengujiHaveSubmitted() ? "Semua penguji harus memberikan nilai terlebih dahulu" : ""}
                            >
                              <FontAwesomeIcon icon={faSave} className={savingHasil ? "animate-pulse" : ""} />
                              {savingHasil ? "Menyimpan..." : hasUnsavedHasil ? "Simpan Perubahan" : "Tersimpan"}
                            </button>
                            
                            {/* Tombol Finalize/Unfinalize */}
                            {hasilData[selectedMahasiswa] && !hasUnsavedHasil && (
                              <>
                                {!hasilData[selectedMahasiswa].is_finalized ? (
                                  <button
                                    onClick={() => setShowFinalizeModal(true)}
                                    disabled={!isDosenTerlibat() || finalizing || !hasilForm.judul_skripsi || !hasilForm.keputusan || !allPengujiHaveSubmitted()}
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white font-semibold hover:bg-green-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                    title={!allPengujiHaveSubmitted() ? "Semua penguji harus memberikan nilai terlebih dahulu" : ""}
                                  >
                                    <FontAwesomeIcon icon={faLock} className={finalizing ? "animate-pulse" : ""} />
                                    {finalizing ? "Mem-finalize..." : "Finalize Keputusan"}
                                  </button>
                                ) : isAdmin() ? (
                                  <button
                                    onClick={() => setShowUnfinalizeModal(true)}
                                    disabled={finalizing}
                                    className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-red-600 text-white font-semibold hover:bg-red-700 transition shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                                  >
                                    <FontAwesomeIcon icon={faUnlock} className={finalizing ? "animate-pulse" : ""} />
                                    {finalizing ? "Membatalkan..." : "Batalkan Finalize"}
                                  </button>
                                ) : null}
                              </>
                            )}
                            
                            {hasilData[selectedMahasiswa] && !hasUnsavedHasil && (
                              <button
                                onClick={() => generateBeritaAcaraPDF()}
                                className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-brand-500 text-brand-600 dark:text-brand-400 font-semibold hover:bg-brand-50 dark:hover:bg-brand-900/20 transition"
                              >
                                <FontAwesomeIcon icon={faClipboardCheck} />
                                Cetak Berita Acara
                              </button>
                            )}
                          </div>
                          
                          {/* Pesan hasil di bawah tombol */}
                          {hasilMessage && (
                            <div className="flex items-center justify-start">
                              <span
                                className={`text-sm font-medium ${
                                  hasilMessage.type === "success" ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {hasilMessage.text}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Info Keputusan - Untuk non-moderator */}
                  {!isPembimbing() && hasilData[selectedMahasiswa] && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <FontAwesomeIcon icon={faClipboardCheck} className="text-gray-600 dark:text-gray-400" />
                        </span>
                        Keputusan Sidang Skripsi
                      </h3>
                      
                      <div className="space-y-4">
                        {/* Status Badge & Nilai Akhir */}
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <span className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold ${
                            hasilData[selectedMahasiswa].keputusan === "tidak_lulus"
                              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                              : hasilData[selectedMahasiswa].keputusan === "lulus_tanpa_perbaikan"
                              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                              : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                          }`}>
                            {hasilData[selectedMahasiswa].keputusan === "tidak_lulus"
                              ? "Tidak Lulus"
                              : hasilData[selectedMahasiswa].keputusan === "lulus_tanpa_perbaikan"
                              ? "Lulus"
                              : "Lulus dengan Revisi"}
                          </span>
                          
                          {/* Nilai Akhir */}
                          {(() => {
                            const penilaian = getPenilaianMahasiswa(selectedMahasiswa);
                            if (penilaian?.nilai_akhir !== null && penilaian?.nilai_akhir !== undefined) {
                              return (
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-gray-500 dark:text-gray-400">Nilai Akhir:</span>
                                  <span className="text-lg font-bold text-brand-600 dark:text-brand-400">
                                    {penilaian.nilai_akhir.toFixed(2)}
                                  </span>
                                  <span className="px-2 py-0.5 rounded bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-300 text-sm font-semibold">
                                    {penilaian.nilai_huruf}
                                  </span>
                                </div>
                              );
                            }
                            return null;
                          })()}
                        </div>

                        {/* Judul Skripsi */}
                        {hasilData[selectedMahasiswa].judul_skripsi && (
                          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                            <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">Judul Skripsi</p>
                            <p className="text-sm font-medium text-gray-900 dark:text-white">{hasilData[selectedMahasiswa].judul_skripsi}</p>
                          </div>
                        )}

                        {/* Catatan Perbaikan */}
                        {hasilData[selectedMahasiswa].keputusan === "lulus_dengan_perbaikan" && hasilData[selectedMahasiswa].catatan_perbaikan && (
                          <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 uppercase tracking-wider mb-1">Catatan Perbaikan</p>
                            <p className="text-sm text-gray-900 dark:text-white">{hasilData[selectedMahasiswa].catatan_perbaikan}</p>
                          </div>
                        )}

                        {/* Tombol Cetak Berita Acara untuk non-moderator */}
                        <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                          <button
                            onClick={() => generateBeritaAcaraPDF()}
                            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl border-2 border-brand-500 text-brand-600 dark:text-brand-400 font-semibold hover:bg-brand-50 dark:hover:bg-brand-900/20 transition"
                          >
                            <FontAwesomeIcon icon={faClipboardCheck} />
                            Cetak Berita Acara
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Info belum ada keputusan - Untuk non-pembimbing */}
                  {!isPembimbing() && !hasilData[selectedMahasiswa] && (
                    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
                      <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3 flex items-center gap-2">
                        <span className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <FontAwesomeIcon icon={faClipboardCheck} className="text-gray-600 dark:text-gray-400" />
                        </span>
                        Keputusan Sidang Skripsi
                      </h3>
                      <p className="text-sm text-gray-500 dark:text-gray-400">Menunggu keputusan dari Pembimbing</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-12 text-center">
                  <div className="w-20 h-20 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-4">
                    <FontAwesomeIcon icon={faUser} className="text-3xl text-gray-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Pilih Mahasiswa</h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    Pilih mahasiswa dari daftar di sebelah kiri untuk mulai memberikan penilaian
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Modal Finalize */}
      {showFinalizeModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <FontAwesomeIcon icon={faLock} className="text-green-600 dark:text-green-400 text-xl" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Finalize Keputusan
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Konfirmasi finalisasi keputusan
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Apakah Anda yakin ingin mem-finalize keputusan ini? Setelah di-finalize, keputusan tidak dapat diubah kecuali oleh admin.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowFinalizeModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition"
              >
                Batal
              </button>
              <button
                onClick={handleFinalize}
                disabled={finalizing}
                className="flex-1 px-4 py-2.5 rounded-xl bg-green-600 text-white font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {finalizing ? "Mem-finalize..." : "Ya, Finalize"}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Unfinalize */}
      {showUnfinalizeModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full p-6"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <FontAwesomeIcon icon={faUnlock} className="text-red-600 dark:text-red-400 text-xl" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Batalkan Finalize
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Konfirmasi pembatalan finalisasi
                </p>
              </div>
            </div>

            <div className="mb-6">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Apakah Anda yakin ingin membatalkan finalize? Keputusan akan dapat diubah kembali.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowUnfinalizeModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-50 dark:hover:bg-gray-600 transition"
              >
                Batal
              </button>
              <button
                onClick={handleUnfinalize}
                disabled={finalizing}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {finalizing ? "Membatalkan..." : "Ya, Batalkan"}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default PenilaianSidangSkripsi;

