import { useState, useEffect, useMemo, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendar,
  faCalendarAlt,
  faClock,
  faBookOpen,
  faBell,
  faGraduationCap,
  faFlask,
  faMapMarkedAlt,
  faCalendarWeek,
  faExternalLinkAlt,
  faCheckCircle,
  faTimesCircle,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import api, { getUser } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";
import PetaAkademikPage from "./PetaAkademikPage";
import PetaBlok from "./PetaBlok";

interface JadwalPBL {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  modul: string;
  topik: string;
  tipe_pbl: string;
  kelompok: string;
  x50: number;
  pengampu: string;
  ruangan: string;
  status_konfirmasi?:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  semester_type?: "reguler" | "antara";
}

interface JadwalKuliahBesar {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string;
  topik?: string;
  mata_kuliah_kode: string;
  mata_kuliah_nama: string;
  dosen: {
    id: number;
    name: string;
  } | null;
  ruangan: {
    id: number;
    nama: string;
  };
  jumlah_sesi: number;
  status_konfirmasi?:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  semester_type?: "reguler" | "antara";
  kelompok_besar?: {
    id: number;
    semester: number;
    nama_kelompok: string;
  } | null;
}

interface JadwalPraktikum {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string;
  topik?: string;
  kelompok_kecil?: { id: number; nama_kelompok: string } | null;
  dosen: Array<{
    id: number;
    name: string;
  }>;
  ruangan: {
    id: number;
    nama: string;
  };
  jumlah_sesi: number;
  status_konfirmasi?:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  semester_type?: "reguler" | "antara";
}

interface JadwalJurnalReading {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  topik: string;
  mata_kuliah_nama: string;
  dosen: {
    id: number;
    name: string;
  } | null;
  ruangan: {
    id: number;
    nama: string;
  } | null;
  jumlah_sesi: number;
  status_konfirmasi?:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  semester_type?: "reguler" | "antara";
}

interface JadwalCSR {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  topik: string;
  tipe: string;
  pengampu: string;
  ruangan: string;
  status_konfirmasi?:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  semester_type?: "reguler" | "antara";
}

interface JadwalNonBlokNonCSR {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  agenda: string;
  materi: string;
  pengampu: string;
  ruangan: string;
  tipe: string; // Added for jenis_baris
  jenis_baris: "materi" | "agenda" | "seminar_proposal" | "sidang_skripsi"; // Added for backend data
  use_ruangan?: boolean; // Added for ruangan check
  pembimbing_id?: number;
  komentator_list?: string[];
  penguji_list?: string[];
  status_konfirmasi?:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  semester_type?: "reguler" | "antara";
}

interface JadwalAgendaBesar {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  agenda: string;
  dosen: any[];
  ruangan: { id: number; nama: string } | null;
  jumlah_sesi: number;
  status_konfirmasi: string;
  status_reschedule?: "waiting" | "approved" | "rejected";
  semester_type?: "reguler" | "antara";
}

interface JadwalSeminarPleno {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  topik: string | null;
  mata_kuliah_kode: string;
  mata_kuliah_nama: string;
  koordinator_names?: string;
  pengampu_names?: string;
  ruangan: {
    id: number;
    nama: string;
  } | null;
  jumlah_sesi: number;
  use_ruangan: boolean;
  status_konfirmasi?:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  semester_type?: "reguler" | "antara";
  kelompok_besar?: {
    id: number;
    semester: number;
    nama_kelompok: string;
  } | null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type JadwalItem = any & {
  status_konfirmasi?:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
};

interface Notification {
  id: number;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  created_at: string;
}

export default function DashboardMahasiswa() {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [activeSemesterType, setActiveSemesterType] = useState<
    "reguler" | "antara" | "all"
  >("reguler");

  // Info mahasiswa
  const [kelompokDisplay, setKelompokDisplay] = useState<string>("-");
  const [semesterDisplay, setSemesterDisplay] = useState<string>("-");
  const [semesterNumber, setSemesterNumber] = useState<number>(1); // Actual semester number (1-8)

  // Jadwal data
  const [jadwalPBL, setJadwalPBL] = useState<JadwalPBL[]>([]);
  const [jadwalKuliahBesar, setJadwalKuliahBesar] = useState<
    JadwalKuliahBesar[]
  >([]);
  const [jadwalPraktikum, setJadwalPraktikum] = useState<JadwalPraktikum[]>([]);
  const [jadwalJurnalReading, setJadwalJurnalReading] = useState<
    JadwalJurnalReading[]
  >([]);
  const [jadwalCSR, setJadwalCSR] = useState<JadwalCSR[]>([]);
  const [jadwalNonBlokNonCSR, setJadwalNonBlokNonCSR] = useState<
    JadwalNonBlokNonCSR[]
  >([]);
  const [jadwalAgendaBesar, setJadwalAgendaBesar] = useState<
    JadwalAgendaBesar[]
  >([]);
  const [jadwalSeminarPleno, setJadwalSeminarPleno] = useState<
    JadwalSeminarPleno[]
  >([]);
  const [jadwalBimbinganAkhir, setJadwalBimbinganAkhir] = useState<
    JadwalNonBlokNonCSR[]
  >([]);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentSemester, setCurrentSemester] = useState<string>("ganjil"); // ganjil/genap
  const [expandedPraktikumRows, setExpandedPraktikumRows] = useState<Set<number>>(new Set());
  const [showPraktikumPengampuModal, setShowPraktikumPengampuModal] = useState(false);
  const [selectedPraktikumPengampu, setSelectedPraktikumPengampu] = useState<any>(null);

  // Email verification states
  const [emailStatus, setEmailStatus] = useState<{
    isEmailValid: boolean;
    needsEmailUpdate: boolean;
    email: string;
  } | null>(null);
  const [showEmailWarning, setShowEmailWarning] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [updatingEmail, setUpdatingEmail] = useState(false);

  // WhatsApp contact states
  const [showWhatsAppWarning, setShowWhatsAppWarning] = useState(false);
  const [whatsAppData, setWhatsAppData] = useState({
    name: "",
    whatsapp_phone: "",
    whatsapp_email: "",
    whatsapp_address: "",
    whatsapp_birth_day: "",
  });
  const [updatingWhatsApp, setUpdatingWhatsApp] = useState(false);

  // Success/Error modal states
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  // Guard role mahasiswa
  useEffect(() => {
    const user = getUser();
    if (!user || user.role !== "mahasiswa") {
      navigate("/");
    }
  }, [navigate]);

  // Real-time clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Check email status on component mount
  useEffect(() => {
    const checkEmailStatus = async () => {
      try {
        const userData = getUser();
        if (!userData) return;

        const response = await api.get(`/users/${userData.id}/email-status`);
        if (response.data.success) {
          const { is_email_valid, needs_email_update, email, email_verified } =
            response.data.data;
          const newEmailStatus = {
            isEmailValid: is_email_valid,
            needsEmailUpdate: needs_email_update || !email_verified,
            email: email || "",
          };
          setEmailStatus(newEmailStatus);
          setShowEmailWarning(needs_email_update || !email_verified);
          setNewEmail(email || "");

          // Check WhatsApp contact status
          const checkWhatsAppStatus = () => {
            const userData = getUser();
            if (!userData) return;

            // Hanya phone dan name yang required (sesuai API Wablas)
            const needsWhatsApp =
              !userData.whatsapp_phone ||
              !userData.whatsapp_phone.match(/^62\d+$/);

            setShowWhatsAppWarning(needsWhatsApp);
            // Update WhatsApp data dengan email dari emailStatus jika ada, dan pre-fill nomor dari telp jika ada
            const prefillPhone =
              userData.whatsapp_phone ||
              (userData.telp
                ? userData.telp.startsWith("62")
                  ? userData.telp
                  : userData.telp.replace(/^0/, "62")
                : "");

            // Pastikan email untuk Wablas selalu ambil dari email verification yang sudah ada (jika sudah verified)
            const wablasEmail =
              newEmailStatus.email || // Prioritas 1: Email verification yang sudah verified
              userData.whatsapp_email || // Prioritas 2: WhatsApp email yang sudah ada
              userData.email || // Prioritas 3: Email user
              "";

            setWhatsAppData({
              name: userData.name || "",
              whatsapp_phone: prefillPhone,
              whatsapp_email: wablasEmail,
              whatsapp_address: userData.whatsapp_address || "",
              whatsapp_birth_day: userData.whatsapp_birth_day || "",
            });
          };

          checkWhatsAppStatus();
        }
      } catch (error) {
        console.error("Error checking email status:", error);
        // Jika error, tetap check WhatsApp status
        const userData = getUser();
        if (userData) {
          const needsWhatsApp =
            !userData.whatsapp_phone ||
            !userData.whatsapp_phone.match(/^62\d+$/);
          setShowWhatsAppWarning(needsWhatsApp);
          const prefillPhone =
            userData.whatsapp_phone ||
            (userData.telp
              ? userData.telp.startsWith("62")
                ? userData.telp
                : userData.telp.replace(/^0/, "62")
              : "");
          setWhatsAppData({
            name: userData.name || "",
            whatsapp_phone: prefillPhone,
            whatsapp_email: userData.whatsapp_email || userData.email || "",
            whatsapp_address: userData.whatsapp_address || "",
            whatsapp_birth_day: userData.whatsapp_birth_day || "",
          });
        }
      }
    };

    checkEmailStatus();
  }, []);

  // Listen for user-updated event to refresh email status
  useEffect(() => {
    const handleUserUpdated = () => {
      const checkEmailStatus = async () => {
        try {
          const userData = getUser();
          if (!userData) return;

          const response = await api.get(`/users/${userData.id}/email-status`);
          if (response.data.success) {
            const {
              is_email_valid,
              needs_email_update,
              email,
              email_verified,
            } = response.data.data;
            setEmailStatus({
              isEmailValid: is_email_valid,
              needsEmailUpdate: needs_email_update || !email_verified,
              email: email || "",
            });
            setShowEmailWarning(needs_email_update || !email_verified);
            setNewEmail(email || "");
          }
        } catch (error) {
          console.error("Error checking email status:", error);
        }
      };

      checkEmailStatus();

      // Refresh WhatsApp status
      const userData = getUser();
      if (userData) {
        const needsWhatsApp =
          !userData.whatsapp_phone || !userData.whatsapp_phone.match(/^62\d+$/);
        setShowWhatsAppWarning(needsWhatsApp);
        const prefillPhone =
          userData.whatsapp_phone ||
          (userData.telp
            ? userData.telp.startsWith("62")
              ? userData.telp
              : userData.telp.replace(/^0/, "62")
            : "");

        const wablasEmail =
          emailStatus?.email ||
          userData.whatsapp_email ||
          userData.email ||
          "";

        setWhatsAppData({
          name: userData.name || "",
          whatsapp_phone: prefillPhone,
          whatsapp_email: wablasEmail,
          whatsapp_address: userData.whatsapp_address || "",
          whatsapp_birth_day: userData.whatsapp_birth_day || "",
        });
      }
    };

    window.addEventListener("user-updated", handleUserUpdated);
    return () => {
      window.removeEventListener("user-updated", handleUserUpdated);
    };
  }, [emailStatus]);

  const semesterParams = useMemo(
    () =>
      activeSemesterType !== "all"
        ? `?semester_type=${activeSemesterType}`
        : "",
    [activeSemesterType]
  );

  useEffect(() => {
    const fetchData = async () => {
    try {
      setLoading(true);
      const user = getUser();
        if (!user) {
          return;
        }

      // Fetch profil akademik
      try {
        const p = await api.get(`/mahasiswa/${user.id}/profil-akademik`);
        const data = p.data?.data || p.data || {};
        setKelompokDisplay(
          data.kelompok_kecil?.nama || data.kelompok_besar?.semester || "-"
        );
        setSemesterDisplay(data.semester || data.semester_aktif || "-");

        // Determine current semester type (ganjil/genap) based on semester number
        const semesterNum = parseInt(
          data.semester || data.semester_aktif || "1"
        );
        setSemesterNumber(semesterNum); // Save actual semester number
        setCurrentSemester(semesterNum % 2 === 1 ? "ganjil" : "genap");
      } catch {
        setKelompokDisplay("-");
        setSemesterDisplay("-");
        setSemesterNumber(1);
        setCurrentSemester("ganjil");
      }

      // Fetch all jadwal
      const apiCalls = [
        api.get(`/jadwal-pbl/mahasiswa/${user.id}${semesterParams}`),
        api.get(`/jadwal-kuliah-besar/mahasiswa/${user.id}${semesterParams}`),
        api.get(`/jadwal-praktikum/mahasiswa/${user.id}${semesterParams}`),
          api.get(
            `/jadwal-jurnal-reading/mahasiswa/${user.id}${semesterParams}`
          ),
          api.get(`/jadwal-agenda-besar/mahasiswa/${user.id}${semesterParams}`),
        api.get(`/jadwal-seminar-pleno/mahasiswa/${user.id}${semesterParams}`),
        api.get(`/notifications/dosen/${user.id}`),
      ];

      if (activeSemesterType !== "antara") {
        apiCalls.push(
          api.get(`/jadwal-csr/mahasiswa/${user.id}${semesterParams}`)
        );
      }

      apiCalls.push(
        api.get(
          `/jadwal-non-blok-non-csr/mahasiswa/${user.id}${semesterParams}`
        )
      );

      const responses = await Promise.allSettled(apiCalls);

      const [
        jadwalPBLResult,
        jadwalKuliahBesarResult,
        jadwalPraktikumResult,
        jadwalJurnalReadingResult,
          jadwalAgendaBesarResult,
        jadwalSeminarPlenoResult,
        notifResult,
        ...otherResults
      ] = responses;

        const pblData =
        jadwalPBLResult.status === "fulfilled"
          ? jadwalPBLResult.value.data.data || []
            : [];

        // Filter out replaced lecturers (status_konfirmasi = "tidak_bisa")
        // Tapi jangan filter jadwal bimbingan akhir (seminar_proposal dan sidang_skripsi)
        const filterActiveLecturers = (data: JadwalItem[]) => {
          return data.filter((item) => {
            // Untuk jadwal bimbingan akhir, jangan filter berdasarkan status_konfirmasi
            if (item.jenis_baris === "seminar_proposal" || item.jenis_baris === "sidang_skripsi") {
              return true;
            }
            return item.status_konfirmasi !== "tidak_bisa";
          });
        };

        setJadwalPBL(filterActiveLecturers(pblData));
      setJadwalKuliahBesar(
          filterActiveLecturers(
        jadwalKuliahBesarResult.status === "fulfilled"
          ? jadwalKuliahBesarResult.value.data.data || []
          : []
          )
      );
      setJadwalPraktikum(
          filterActiveLecturers(
        jadwalPraktikumResult.status === "fulfilled"
          ? jadwalPraktikumResult.value.data.data || []
          : []
          )
      );
      setJadwalJurnalReading(
          filterActiveLecturers(
        jadwalJurnalReadingResult.status === "fulfilled"
          ? jadwalJurnalReadingResult.value.data.data || []
              : []
          )
        );
        setJadwalAgendaBesar(
          jadwalAgendaBesarResult.status === "fulfilled"
            ? jadwalAgendaBesarResult.value.data.data || []
          : []
      );
      setJadwalSeminarPleno(
        filterActiveLecturers(
          jadwalSeminarPlenoResult.status === "fulfilled"
            ? jadwalSeminarPlenoResult.value.data.data || []
            : []
        )
      );
      setNotifications(
        notifResult.status === "fulfilled" 
          ? (Array.isArray(notifResult.value.data) 
              ? notifResult.value.data 
              : (notifResult.value.data?.data || []))
          : []
      );

        // Handle CSR and Non Blok Non CSR based on semester type
      if (activeSemesterType !== "antara") {
        const jadwalCSRResult = otherResults[0];
        setJadwalCSR(
            filterActiveLecturers(
          jadwalCSRResult?.status === "fulfilled"
            ? jadwalCSRResult.value.data.data || []
            : []
            )
        );
        const jadwalNonBlokNonCSRResult = otherResults[1];
        const nonBlokNonCSRData = jadwalNonBlokNonCSRResult?.status === "fulfilled"
            ? jadwalNonBlokNonCSRResult.value.data.data || []
          : [];
        
        // Filter jadwal bimbingan akhir (seminar proposal dan sidang skripsi) SEBELUM filterActiveLecturers
        const bimbinganAkhirData = nonBlokNonCSRData.filter(
          (item: JadwalNonBlokNonCSR) =>
            item.jenis_baris === "seminar_proposal" ||
            item.jenis_baris === "sidang_skripsi"
        );
        setJadwalBimbinganAkhir(bimbinganAkhirData);
        
        // Filter jadwal non blok non csr lainnya (bukan bimbingan akhir)
        const nonBimbinganAkhirData = nonBlokNonCSRData.filter(
          (item: JadwalNonBlokNonCSR) =>
            item.jenis_baris !== "seminar_proposal" &&
            item.jenis_baris !== "sidang_skripsi"
        );
        setJadwalNonBlokNonCSR(
          filterActiveLecturers(nonBimbinganAkhirData)
        );
      } else {
        setJadwalCSR([]);
        const jadwalNonBlokNonCSRResult = otherResults[0];
        const nonBlokNonCSRData = jadwalNonBlokNonCSRResult?.status === "fulfilled"
            ? jadwalNonBlokNonCSRResult.value.data.data || []
          : [];
        
        // Filter jadwal bimbingan akhir (seminar proposal dan sidang skripsi) SEBELUM filterActiveLecturers
        const bimbinganAkhirData = nonBlokNonCSRData.filter(
          (item: JadwalNonBlokNonCSR) =>
            item.jenis_baris === "seminar_proposal" ||
            item.jenis_baris === "sidang_skripsi"
        );
        setJadwalBimbinganAkhir(bimbinganAkhirData);
        
        // Filter jadwal non blok non csr lainnya (bukan bimbingan akhir)
        const nonBimbinganAkhirData = nonBlokNonCSRData.filter(
          (item: JadwalNonBlokNonCSR) =>
            item.jenis_baris !== "seminar_proposal" &&
            item.jenis_baris !== "sidang_skripsi"
        );
        setJadwalNonBlokNonCSR(
          filterActiveLecturers(nonBimbinganAkhirData)
          );
        }
      } catch {
        // Error handling - could be logged to monitoring service
    } finally {
      setLoading(false);
    }
    };

    fetchData();
  }, [semesterParams, activeSemesterType]);

  const getSemesterTypeBadge = useCallback(
    (semesterType?: "reguler" | "antara") => {
    if (!semesterType) return null;

    return (
      <span
        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
          semesterType === "reguler"
            ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200"
            : "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200"
        }`}
      >
        {semesterType === "reguler" ? "Reguler" : "Antara"}
      </span>
    );
    },
    []
  );

  // Helper function untuk mendapatkan array nama dosen pengampu (untuk praktikum)
  const getPengampuNamesArray = useCallback((item: JadwalPraktikum): string[] => {
    try {
      if (item.dosen && Array.isArray(item.dosen) && item.dosen.length > 0) {
        return item.dosen.map((d) => d.name).filter((name) => name && name.trim() !== "");
      }
    } catch (error) {
      console.error("Error getting pengampu names array:", error);
    }
    return [];
  }, []);

  // Helper function untuk mendapatkan array dosen dengan status konfirmasi (untuk praktikum)
  const getPengampuWithStatus = useCallback((item: JadwalPraktikum): Array<{id: number; name: string; status_konfirmasi?: string}> => {
    try {
      if (item.dosen && Array.isArray(item.dosen) && item.dosen.length > 0) {
        return item.dosen.map((d: any) => ({
          id: d.id,
          name: d.name,
          status_konfirmasi: d.status_konfirmasi || 'belum_konfirmasi',
        })).filter((d) => d.name && d.name.trim() !== "");
      }
    } catch (error) {
      console.error("Error getting pengampu with status:", error);
    }
    return [];
  }, []);

  const handleVerifyEmail = async () => {
    if (!newEmail.trim() || !emailStatus) return;

    try {
      setUpdatingEmail(true);
      const userData = getUser();
      if (!userData) return;

      const response = await api.put(`/users/${userData.id}/verify-email`, {
        email: newEmail.trim(),
      });

      if (response.data.success) {
        setEmailStatus((prev) =>
          prev
            ? {
                ...prev,
                isEmailValid: true,
                needsEmailUpdate: false,
                email: newEmail.trim(),
              }
            : null
        );
        setShowEmailWarning(false);
        localStorage.setItem("last_success_action", "email_verify");
        setShowSuccessModal(true);

        // Update localStorage dengan data user terbaru
        const updatedUserData = {
          ...userData,
          email: newEmail.trim(),
          email_verified: true,
        };
        localStorage.setItem("user", JSON.stringify(updatedUserData));

        // Dispatch event untuk update Profile.tsx
        window.dispatchEvent(new Event("user-updated"));
      }
    } catch (error: any) {
      console.error("Error verifying email:", error);
      setErrorMessage(
        error.response?.data?.message || error.message || "Terjadi kesalahan"
      );
      setShowErrorModal(true);
    } finally {
      setUpdatingEmail(false);
    }
  };

  // Handle gabungan: Email Verification + WhatsApp Contact (ADD contact pertama kali)
  const handleSaveEmailAndWhatsApp = async () => {
    const userData = getUser();
    if (!userData) return;

    // Validasi email jika diperlukan
    if (showEmailWarning && !newEmail.trim()) {
      setErrorMessage("Email verification wajib diisi.");
      setShowErrorModal(true);
      return;
    }

    // Validasi Name (required)
    if (!whatsAppData.name || !whatsAppData.name.trim()) {
      setErrorMessage("Nama wajib diisi.");
      setShowErrorModal(true);
      return;
    }

    // Validasi WhatsApp phone (required)
    if (
      !whatsAppData.whatsapp_phone ||
      !whatsAppData.whatsapp_phone.match(/^62\d+$/)
    ) {
      setErrorMessage(
        "Nomor WhatsApp wajib diisi dan harus dimulai dengan 62 (contoh: 6281234567890)."
      );
      setShowErrorModal(true);
      return;
    }

    // Validasi Alamat (required)
    if (
      !whatsAppData.whatsapp_address ||
      !whatsAppData.whatsapp_address.trim()
    ) {
      setErrorMessage("Alamat wajib diisi.");
      setShowErrorModal(true);
      return;
    }

    // Validasi Tanggal Lahir (required)
    if (
      !whatsAppData.whatsapp_birth_day ||
      !whatsAppData.whatsapp_birth_day.trim()
    ) {
      setErrorMessage("Tanggal Lahir wajib diisi.");
      setShowErrorModal(true);
      return;
    }

    try {
      setUpdatingEmail(true);
      setUpdatingWhatsApp(true);

      // Step 1: Update email verification jika diperlukan
      let finalEmail = emailStatus?.email || userData.email;
      if (showEmailWarning && newEmail.trim()) {
        const emailResponse = await api.put(
          `/users/${userData.id}/verify-email`,
          {
            email: newEmail.trim(),
          }
        );

        if (emailResponse.data.success) {
          finalEmail = newEmail.trim();
          setEmailStatus((prev) =>
            prev
              ? {
                  ...prev,
                  isEmailValid: true,
                  needsEmailUpdate: false,
                  email: finalEmail,
                }
              : null
          );
          setShowEmailWarning(false);
        }
      }

      // Step 2: Update profile dengan WhatsApp data (akan trigger addContact di backend)
      const wablasEmail = showEmailWarning
        ? finalEmail
        : emailStatus?.email || finalEmail;

      const response = await api.put("/profile", {
        name: whatsAppData.name || userData.name,
        username: userData.username,
        email: finalEmail,
        whatsapp_phone: whatsAppData.whatsapp_phone,
        whatsapp_email: wablasEmail,
        whatsapp_address: whatsAppData.whatsapp_address,
        whatsapp_birth_day: whatsAppData.whatsapp_birth_day,
      });

      if (response.data) {
        const updatedUser = response.data.user;
        localStorage.setItem("user", JSON.stringify(updatedUser));

        // Update state
        setShowEmailWarning(false);
        setShowWhatsAppWarning(false);

        // Show success modal
        if (response.data.wablas_synced) {
          localStorage.setItem("last_success_action", "whatsapp_sync");
          setShowSuccessModal(true);
        } else {
          setErrorMessage(
            response.data.message ||
              "Gagal menyinkronkan data ke Wablas. Data tidak tersimpan. Silakan coba lagi."
          );
          setShowErrorModal(true);
        }

        // Dispatch event untuk refresh data
        window.dispatchEvent(new Event("user-updated"));
      }
    } catch (error: any) {
      console.error("Error saving email and WhatsApp:", error);

      let errorMsg = "Terjadi kesalahan saat menyimpan data.";

      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorMessages: string[] = [];

        if (errors.whatsapp_phone) {
          const phoneError = Array.isArray(errors.whatsapp_phone)
            ? errors.whatsapp_phone[0]
            : errors.whatsapp_phone;
          if (phoneError.includes("already") || phoneError.includes("sudah")) {
            errorMessages.push(
              "Nomor WhatsApp ini sudah digunakan oleh user lain."
            );
          } else {
            errorMessages.push(`Nomor WhatsApp: ${phoneError}`);
          }
        }
        if (errors.email) {
          errorMessages.push(
            `Email: ${
              Array.isArray(errors.email) ? errors.email[0] : errors.email
            }`
          );
        }
        if (errors.whatsapp_address) {
          errorMessages.push(
            `Alamat: ${
              Array.isArray(errors.whatsapp_address)
                ? errors.whatsapp_address[0]
                : errors.whatsapp_address
            }`
          );
        }
        if (errors.whatsapp_birth_day) {
          errorMessages.push(
            `Tanggal Lahir: ${
              Array.isArray(errors.whatsapp_birth_day)
                ? errors.whatsapp_birth_day[0]
                : errors.whatsapp_birth_day
            }`
          );
        }

        if (errorMessages.length > 0) {
          errorMsg = errorMessages.join("\n");
        }
      } else if (error.response?.data?.message) {
        errorMsg = error.response.data.message;
      }

      setErrorMessage(errorMsg);
      setShowErrorModal(true);
    } finally {
      setUpdatingEmail(false);
      setUpdatingWhatsApp(false);
    }
  };

  const getStatusBadge = useCallback(
    (
      statusKonfirmasi?:
        | "belum_konfirmasi"
        | "bisa"
        | "tidak_bisa"
        | "waiting_reschedule",
      statusReschedule?: "waiting" | "approved" | "rejected"
    ) => {
      if (!statusKonfirmasi) return null;

      switch (statusKonfirmasi) {
        case "bisa":
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-700">
              <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3 mr-1" />
              Dosen Bisa Mengajar
            </span>
          );
        case "tidak_bisa":
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700">
              <FontAwesomeIcon icon={faTimesCircle} className="w-3 h-3 mr-1" />
              Dosen Tidak Bisa (Diganti)
            </span>
          );
        case "waiting_reschedule":
          if (statusReschedule === "approved") {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className="w-3 h-3 mr-1"
                />
                Reschedule Disetujui
              </span>
            );
          } else if (statusReschedule === "rejected") {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700">
                <FontAwesomeIcon
                  icon={faTimesCircle}
                  className="w-3 h-3 mr-1"
                />
                Reschedule Ditolak
              </span>
            );
          } else {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700">
                <FontAwesomeIcon icon={faClock} className="w-3 h-3 mr-1" />
                Dosen Ajukan Reschedule
              </span>
            );
          }
        case "belum_konfirmasi":
          if (statusReschedule === "approved") {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700">
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className="w-3 h-3 mr-1"
                />
                Reschedule Disetujui - Menunggu Dosen
              </span>
            );
          } else if (statusReschedule === "rejected") {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700">
                <FontAwesomeIcon
                  icon={faTimesCircle}
                  className="w-3 h-3 mr-1"
                />
                Reschedule Ditolak
              </span>
            );
          } else {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700">
                <FontAwesomeIcon icon={faClock} className="w-3 h-3 mr-1" />
                Menunggu Dosen
              </span>
            );
          }
        default:
          return null;
      }
    },
    []
  );

  const renderJadwalTable = useCallback(
    (
      title: string,
      icon: React.ComponentProps<typeof FontAwesomeIcon>["icon"],
      jadwalData: JadwalItem[],
      headers: string[],
      jadwalType: string,
      emptyMessage: string
    ) => (
      <div className="overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-2xl bg-blue-500 flex items-center justify-center">
              <FontAwesomeIcon icon={icon} className="text-white text-sm" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {title}
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto hide-scroll">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-gray-700/50">
              <tr>
                {headers.map((header, index) => (
                  <th
                    key={index}
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider"
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {jadwalData.length === 0 ? (
                <tr>
                  <td
                    colSpan={headers.length}
                    className="px-6 py-8 text-center"
                  >
                    <div className="flex flex-col items-center justify-center">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mb-4">
                        <FontAwesomeIcon
                          icon={icon}
                          className="w-8 h-8 text-gray-400"
                        />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400 text-sm">
                        {emptyMessage}
                      </p>
                    </div>
                  </td>
                </tr>
              ) : (
                jadwalData.map((item: JadwalItem, index) => (
                  <tr
                    key={index}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium">
                      {index + 1}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {item.tanggal}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {`${item.jam_mulai} - ${item.jam_selesai}`}
                    </td>
                    {jadwalType === "pbl" && (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.x50 ? `${item.x50} x 50 menit` : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.tipe_pbl || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.kelompok}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.modul || item.topik || "N/A"}
                        </td>
                      </>
                    )}
                    {jadwalType === "praktikum" && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.kelompok_kecil?.nama_kelompok || "-"}
                      </td>
                    )}
                    {jadwalType !== "pbl" && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {`${item.jumlah_sesi || 1} x 50 menit`}
                      </td>
                    )}
                    {jadwalType === "agenda_besar" ? (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.agenda || "N/A"}
                      </td>
                    ) : jadwalType === "jurnal" ? (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.topik || "N/A"}
                      </td>
                    ) : jadwalType === "seminar_pleno" ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.topik || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.koordinator_names || "N/A"}
                        </td>
                      </>
                    ) : jadwalType === "csr" ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.tipe || "N/A"}
                        </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.topik || "N/A"}
                      </td>
                      </>
                    ) : jadwalType === "bimbingan_akhir_sempro" || jadwalType === "bimbingan_akhir_sidang" ? (
                      <>
                        {/* Kolom ini akan diisi di bagian bawah */}
                      </>
                    ) : jadwalType === "non_blok_non_csr" ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.tipe || "N/A"}
                        </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.agenda || item.materi || "N/A"}
                      </td>
                      </>
                    ) : jadwalType === "praktikum" ? (
                      <>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white align-top">
                          {item.materi || "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white align-top">
                          {item.topik || "N/A"}
                      </td>
                      </>
                    ) : (
                      jadwalType !== "pbl" && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.materi || item.topik || "N/A"}
                        </td>
                      )
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {jadwalType === "bimbingan_akhir_sempro" || jadwalType === "bimbingan_akhir_sidang"
                        ? item.pengampu || "N/A"
                        : jadwalType === "agenda_besar"
                        ? "-"
                        : jadwalType === "kuliah_besar"
                        ? item.dosen?.name || "N/A"
                        : jadwalType === "praktikum"
                        ? item.dosen
                            ?.map((d: { id: number; name: string }) => d.name)
                            .join(", ") || "N/A"
                        : jadwalType === "jurnal"
                        ? item.dosen?.name || "N/A"
                        : jadwalType === "seminar_pleno"
                        ? item.pengampu_names || "N/A"
                        : jadwalType === "pbl"
                        ? item.pengampu || "N/A"
                        : item.pengampu || item.dosen?.name || "N/A"}
                    </td>
                    {/* Kolom Komentator untuk Seminar Proposal */}
                    {jadwalType === "bimbingan_akhir_sempro" && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.komentator_list && item.komentator_list.length > 0
                          ? item.komentator_list.join(", ")
                          : "N/A"}
                      </td>
                    )}
                    {/* Kolom Penguji untuk Sidang Skripsi */}
                    {jadwalType === "bimbingan_akhir_sidang" && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.penguji_list && item.penguji_list.length > 0
                          ? item.penguji_list.join(", ")
                          : "N/A"}
                      </td>
                    )}
                    {jadwalType === "kuliah_besar" && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.topik || "N/A"}
                      </td>
                    )}
                    {jadwalType === "kuliah_besar" && (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {item.kelompok_besar?.semester
                          ? `Semester ${item.kelompok_besar.semester}`
                          : "N/A"}
                      </td>
                    )}
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {jadwalType === "bimbingan_akhir_sempro" || jadwalType === "bimbingan_akhir_sidang"
                        ? item.ruangan?.nama || (item.use_ruangan === false ? "-" : "N/A")
                        : jadwalType === "kuliah_besar" ||
                      jadwalType === "praktikum" ||
                      jadwalType === "jurnal" ||
                      jadwalType === "seminar_pleno"
                        ? item.ruangan?.nama || (item.use_ruangan === false ? "-" : "N/A")
                        : jadwalType === "pbl"
                        ? item.ruangan || "N/A"
                        : jadwalType === "non_blok_non_csr"
                        ? item.ruangan?.nama ||
                          (item.use_ruangan === false ? "-" : "N/A")
                        : item.ruangan?.nama || "N/A"}
                    </td>
                    {/* Kolom Lihat Pengampu - hanya untuk praktikum */}
                    {jadwalType === "praktikum" ? (
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPraktikumPengampu(item);
                            setShowPraktikumPengampuModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-sm font-medium underline"
                        >
                          Lihat Pengampu
                        </button>
                      </td>
                    ) : jadwalType !== "bimbingan_akhir_sempro" && jadwalType !== "bimbingan_akhir_sidang" ? (
                      <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                        {jadwalType === "agenda_besar"
                          ? "-"
                          : jadwalType === "kuliah_besar"
                          ? item.dosen?.name || "N/A"
                          : jadwalType === "jurnal"
                          ? item.dosen?.name || "N/A"
                          : jadwalType === "seminar_pleno"
                          ? item.pengampu_names || "N/A"
                          : jadwalType === "pbl"
                          ? item.pengampu || "N/A"
                          : item.pengampu || item.dosen?.name || "N/A"}
                      </td>
                    ) : null}
                    {/* Kolom STATUS - untuk semua jadwal type kecuali praktikum */}
                    {jadwalType === "praktikum" ? null : (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {jadwalType === "agenda_besar"
                        ? "-"
                        : jadwalType === "non_blok_non_csr" &&
                          item.status_konfirmasi === "-"
                        ? "-"
                        : getStatusBadge(
                            item.status_konfirmasi,
                            item.status_reschedule
                          )}
                    </td>
                    )}
                    {/* Hanya tampilkan badge semester type jika bukan jadwal bimbingan akhir */}
                    {jadwalType !== "bimbingan_akhir_sempro" && jadwalType !== "bimbingan_akhir_sidang" && (
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {getSemesterTypeBadge(item.semester_type)}
                    </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    ),
    [getSemesterTypeBadge, getStatusBadge, getPengampuNamesArray, getPengampuWithStatus, expandedPraktikumRows]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="grid grid-cols-12 gap-4 md:gap-6 p-4 md:p-6">
          {/* Header Skeleton */}
          <div className="col-span-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-2xl animate-pulse" />
                  <div className="flex-1">
                    <div className="h-8 w-64 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse" />
                    <div className="h-4 w-96 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse" />
                    <div className="h-4 w-48 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-32 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse" />
                  <div className="h-12 w-28 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Semester & Kelompok Cards Skeleton */}
          <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Semester Card Skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse" />
                  <div className="h-10 w-16 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse" />
                  <div className="h-3 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                </div>
              </div>
            </div>

            {/* Kelompok Card Skeleton */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse" />
                <div className="flex-1">
                  <div className="h-4 w-28 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse" />
                  <div className="h-10 w-12 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse" />
                  <div className="h-3 w-36 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>

          {/* Peta Akademik Skeleton */}
          <div className="col-span-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-2xl animate-pulse" />
                  <div>
                    <div className="h-6 w-32 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse" />
                    <div className="h-4 w-48 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-10 w-24 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse" />
              </div>
              <div className="h-96 bg-gray-300 dark:bg-gray-600 animate-pulse" />
            </div>
          </div>

          {/* Peta Blok Skeleton */}
          <div className="col-span-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-2xl animate-pulse" />
                  <div>
                    <div className="h-6 w-24 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse" />
                    <div className="h-4 w-40 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-10 w-24 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse" />
              </div>
              <div className="h-96 bg-gray-300 dark:bg-gray-600 animate-pulse" />
            </div>
          </div>

          {/* Notifications Skeleton */}
          <div className="col-span-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-2xl animate-pulse" />
                <div className="flex-1">
                  <div className="h-6 w-40 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse" />
                  <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="p-4 rounded-xl border border-gray-200 dark:border-gray-600"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full mt-2 animate-pulse" />
                      <div className="flex-1">
                        <div className="h-4 w-48 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse" />
                        <div className="h-3 w-64 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse" />
                        <div className="h-3 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Jadwal Tables Skeleton */}
          <div className="col-span-12">
            <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-2xl animate-pulse" />
                  <div>
                    <div className="h-6 w-40 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse" />
                    <div className="h-4 w-48 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-4 w-12 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                  <div className="flex gap-2">
                    <div className="h-10 w-20 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse" />
                    <div className="h-10 w-20 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse" />
                    <div className="h-10 w-20 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse" />
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                  >
                    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-2xl animate-pulse" />
                        <div className="h-6 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse" />
                      </div>
                    </div>
                    <div className="h-64 bg-gray-300 dark:bg-gray-600 animate-pulse" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="grid grid-cols-12 gap-4 md:gap-6 p-4 md:p-6">
        {/* Professional Header */}
        <div className="col-span-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faGraduationCap}
                    className="text-white text-xl"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Dashboard Mahasiswa
                  </h1>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Isme - Integrated System Medical Education Fakultas
                    Kedokteran dan Kesehatan Universitas Muhammadiyah Jakarta
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    Logged in as:{" "}
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {getUser()?.name}
                    </span>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-medium bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                  <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  <div className="text-left">
                    <div className="font-semibold">System Online</div>
                    <div className="text-xs opacity-80">
                      All Services Running
                    </div>
                  </div>
                </div>
                <div className="inline-flex items-center px-4 py-2 rounded-xl text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                  <FontAwesomeIcon icon={faClock} className="mr-2 text-sm" />
                  <div className="text-left">
                    <div className="font-semibold">
                      {currentTime.toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit",
                        hour12: false,
                      })}
                    </div>
                    <div className="text-xs opacity-80">
                      {currentTime.toLocaleDateString("id-ID", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Semester & Kelompok Cards */}
        <div className="col-span-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Semester Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faBookOpen}
                  className="text-white text-xl"
                />
              </div>
              <div className="flex-1">
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                  Semester Aktif
                </p>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {semesterDisplay}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  Tahun Akademik 2024/2025
                </p>
              </div>
            </div>
          </motion.div>

          {/* Kelompok Card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faGraduationCap}
                  className="text-white text-xl"
                />
              </div>
              <div className="flex-1">
                <p className="text-gray-500 dark:text-gray-400 text-sm font-medium mb-1">
                  Kelompok Kecil
                </p>
                <h2 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {kelompokDisplay}
                </h2>
                <p className="text-gray-500 dark:text-gray-400 text-xs mt-1">
                  Kelompok Pembelajaran
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Peta Akademik Preview - Full Embedded */}
        <div className="col-span-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500 rounded-2xl flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faMapMarkedAlt}
                    className="text-white text-lg"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Peta Akademik
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Timeline semester dan mata kuliah
                  </p>
                </div>
              </div>
              <button
                onClick={() => navigate("/peta-akademik")}
                className="inline-flex items-center px-4 py-2 bg-purple-500 text-white rounded-xl text-sm font-medium hover:bg-purple-600 transition-colors shadow-sm"
              >
                <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-2" />
                Lihat Full
              </button>
            </div>
            {/* Embedded Peta Akademik dengan scroll di dalam card */}
            <div className="max-h-[600px] overflow-y-auto">
              <PetaAkademikPage />
            </div>
          </motion.div>
        </div>

        {/* Peta Blok Preview - Full Embedded */}
        <div className="col-span-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-500 rounded-2xl flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faCalendarWeek}
                    className="text-white text-lg"
                  />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Peta Blok
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Jadwal per hari (Semester{" "}
                    {currentSemester.charAt(0).toUpperCase() +
                      currentSemester.slice(1)}
                    )
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/peta-blok")}
                  className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-xl text-sm font-medium hover:bg-green-600 transition-colors shadow-sm"
                >
                  <FontAwesomeIcon icon={faExternalLinkAlt} className="mr-2" />
                  Lihat Full
                </button>
              </div>
            </div>
            {/* Embedded Peta Blok dengan scroll di dalam card */}
            <div className="max-h-[600px] overflow-y-auto">
              <PetaBlok key={semesterNumber} />
            </div>
          </motion.div>
        </div>

        {/* Notifications Section */}
        <div className="col-span-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500 rounded-2xl flex items-center justify-center">
                <FontAwesomeIcon icon={faBell} className="text-white text-lg" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Notifikasi Terbaru
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {Array.isArray(notifications) ? notifications.filter((n) => !n.is_read).length : 0} belum dibaca
                </p>
              </div>
            </div>
            {!Array.isArray(notifications) || notifications.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-gray-500 dark:text-gray-400 text-sm">
                  Belum ada notifikasi
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {notifications.slice(0, 5).map((notif) => (
                  <div
                    key={notif.id}
                    className={`p-4 rounded-xl border transition-all ${
                      notif.is_read
                        ? "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                        : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-2 h-2 rounded-full mt-2 ${
                          !notif.is_read ? "bg-blue-500" : "bg-gray-400"
                        }`}
                      ></div>
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 dark:text-white">
                          {notif.title}
                        </p>
                        <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                          {notif.message}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                          {new Date(notif.created_at).toLocaleDateString(
                            "id-ID",
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        </div>

        {/* Bimbingan Akhir Section */}
        <div className="col-span-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.45 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-purple-500 rounded-2xl flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faGraduationCap}
                  className="text-white text-lg"
                />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Bimbingan Akhir
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Jadwal Seminar Proposal dan Sidang Skripsi
                </p>
              </div>
            </div>

            <div className="space-y-4">
              {/* Seminar Proposal */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {renderJadwalTable(
                  "Seminar Proposal",
                  faGraduationCap,
                  jadwalBimbinganAkhir.filter(
                    (item) => item.jenis_baris === "seminar_proposal"
                  ),
                  [
                    "NO",
                    "TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "PEMBIMBING",
                    "KOMENTATOR",
                    "RUANGAN",
                    "STATUS",
                  ],
                  "bimbingan_akhir_sempro",
                  "Tidak ada data Seminar Proposal"
                )}
              </div>

              {/* Sidang Skripsi */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                {renderJadwalTable(
                  "Sidang Skripsi",
                  faGraduationCap,
                  jadwalBimbinganAkhir.filter(
                    (item) => item.jenis_baris === "sidang_skripsi"
                  ),
                  [
                    "NO",
                    "TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "PEMBIMBING",
                    "PENGUJI",
                    "RUANGAN",
                    "STATUS",
                  ],
                  "bimbingan_akhir_sidang",
                  "Tidak ada data Sidang Skripsi"
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Jadwal Tables Section */}
        <div className="col-span-12 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faCalendar}
                    className="text-white text-lg"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Jadwal Kuliah Saya
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Lihat semua jadwal kuliah Anda
                  </p>
                </div>
              </div>

              {/* Semester Type Filter */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Filter:
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveSemesterType("reguler")}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      activeSemesterType === "reguler"
                        ? "bg-blue-500 text-white shadow-sm"
                        : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    Reguler
                  </button>
                  <button
                    onClick={() => setActiveSemesterType("antara")}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      activeSemesterType === "antara"
                        ? "bg-green-500 text-white shadow-sm"
                        : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-green-50 dark:hover:bg-green-900/20 border border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    Antara
                  </button>
                  <button
                    onClick={() => setActiveSemesterType("all")}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      activeSemesterType === "all"
                        ? "bg-purple-500 text-white shadow-sm"
                        : "bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-gray-200 dark:border-gray-600"
                    }`}
                  >
                    Semua
                  </button>
                </div>
              </div>
            </div>

            <div className="space-y-6">
              {/* PBL Table */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {renderJadwalTable(
                  "PBL",
                  faBookOpen,
                  jadwalPBL,
                  [
                    "NO",
                    "TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "TIPE",
                    "KELOMPOK",
                    "MODUL",
                    "PENGAMPU",
                    "RUANGAN",
                    "STATUS",
                    "JENIS",
                  ],
                  "pbl",
                  "Tidak ada data PBL"
                )}
              </motion.div>

              {/* Kuliah Besar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {renderJadwalTable(
                  "Kuliah Besar",
                  faGraduationCap,
                  jadwalKuliahBesar,
                  [
                    "NO",
                    "TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "MATERI",
                    "PENGAMPU",
                    "TOPIK",
                    "KELOMPOK",
                    "RUANGAN",
                    "STATUS",
                    "JENIS",
                  ],
                  "kuliah_besar",
                  "Tidak ada data Kuliah Besar"
                )}
              </motion.div>

              {/* Praktikum */}
              {activeSemesterType !== "antara" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.8 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {renderJadwalTable(
                    "Praktikum",
                    faFlask,
                    jadwalPraktikum,
                    [
                      "NO",
                      "TANGGAL",
                      "PUKUL",
                      "KELAS",
                      "WAKTU",
                      "MATERI",
                      "TOPIK",
                      "RUANGAN",
                      "JENIS",
                      "PENGAMPU",
                    ],
                    "praktikum",
                    "Tidak ada data Praktikum"
                  )}
                </motion.div>
              )}

              {/* Jurnal Reading */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {renderJadwalTable(
                  "Jurnal Reading",
                  faBookOpen,
                  jadwalJurnalReading,
                  [
                    "NO",
                    "TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "TOPIK",
                    "PENGAMPU",
                    "RUANGAN",
                    "STATUS",
                    "JENIS",
                  ],
                  "jurnal",
                  "Tidak ada data Jurnal Reading"
                )}
              </motion.div>

              {/* Agenda Besar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {renderJadwalTable(
                  "Agenda Besar",
                  faCalendarAlt,
                  jadwalAgendaBesar,
                  [
                    "NO",
                    "TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "AGENDA",
                    "PENGAMPU",
                    "RUANGAN",
                    "STATUS",
                    "JENIS",
                  ],
                  "agenda_besar",
                  "Tidak ada data Agenda Besar"
                )}
              </motion.div>

              {/* Seminar Pleno */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {renderJadwalTable(
                  "Seminar Pleno",
                  faGraduationCap,
                  jadwalSeminarPleno,
                  [
                    "NO",
                    "TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "TOPIK",
                    "KOORDINATOR",
                    "PENGAMPU",
                    "RUANGAN",
                    "STATUS",
                    "JENIS",
                  ],
                  "seminar_pleno",
                  "Tidak ada data Seminar Pleno"
                )}
              </motion.div>

              {/* CSR */}
              {activeSemesterType !== "antara" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.0 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {renderJadwalTable(
                    "CSR",
                    faBookOpen,
                    jadwalCSR,
                    [
                      "NO",
                      "TANGGAL",
                      "PUKUL",
                      "WAKTU",
                      "TIPE",
                      "TOPIK",
                      "PENGAMPU",
                      "RUANGAN",
                      "STATUS",
                      "JENIS",
                    ],
                    "csr",
                    "Tidak ada data CSR"
                  )}
                </motion.div>
              )}

              {/* Non Blok Non CSR */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.1 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {renderJadwalTable(
                  "Non Blok Non CSR",
                  faBookOpen,
                  jadwalNonBlokNonCSR,
                  [
                    "NO",
                    "TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "TIPE",
                    "MATERI/AGENDA",
                    "PENGAMPU",
                    "RUANGAN",
                    "STATUS",
                    "JENIS",
                  ],
                  "non_blok_non_csr",
                  "Tidak ada data Non Blok Non CSR"
                )}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Modal Lihat Pengampu Praktikum */}
      <AnimatePresence>
        {showPraktikumPengampuModal && selectedPraktikumPengampu && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowPraktikumPengampuModal(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowPraktikumPengampuModal(false)}
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
                {/* Header */}
                <div className="flex items-center justify-between pb-4 sm:pb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/30 rounded-2xl flex items-center justify-center shadow-lg">
                      <FontAwesomeIcon
                        icon={faUsers}
                        className="w-6 h-6 text-purple-600 dark:text-purple-400"
                      />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                        Dosen Pengampu Praktikum
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {selectedPraktikumPengampu.materi || selectedPraktikumPengampu.topik || "N/A"} - {selectedPraktikumPengampu.tanggal}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Dosen List */}
                <div className="space-y-3">
                  {(() => {
                    const dosenWithStatus = getPengampuWithStatus(selectedPraktikumPengampu);
                    if (dosenWithStatus.length === 0) {
                      return (
                        <div className="text-center py-8">
                          <p className="text-gray-500 dark:text-gray-400">
                            Tidak ada dosen pengampu
                          </p>
                        </div>
                      );
                    }
                    return dosenWithStatus.map((d) => (
                      <div
                        key={d.id}
                        className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                            <FontAwesomeIcon
                              icon={faGraduationCap}
                              className="w-5 h-5 text-purple-600 dark:text-purple-400"
                            />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900 dark:text-white">
                              {d.name}
                            </p>
                          </div>
                        </div>
                        <div>
                          {getStatusBadge(
                            (d.status_konfirmasi || 'belum_konfirmasi') as "belum_konfirmasi" | "bisa" | "tidak_bisa" | "waiting_reschedule",
                            undefined
                          )}
                        </div>
                      </div>
                    ));
                  })()}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowPraktikumPengampuModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Tutup
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Email & WhatsApp Warning Modal */}
      <AnimatePresence>
        {(showEmailWarning || showWhatsAppWarning) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] flex items-center justify-center"
          >
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => {
                // Don't allow closing by clicking overlay
              }}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl mx-4 bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  // Don't allow closing
                }}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11 opacity-50 cursor-not-allowed"
                disabled
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
                {/* Header */}
                <div className="flex items-center justify-between pb-4 sm:pb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-yellow-100 dark:bg-yellow-900/30 rounded-2xl flex items-center justify-center shadow-lg">
                      <FontAwesomeIcon
                        icon={faBell}
                        className="w-6 h-6 text-yellow-600 dark:text-yellow-400"
                      />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                        Verifikasi Email & WhatsApp
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Lengkapi data untuk menerima notifikasi reminder
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Name (Required) */}
                  <div>
                    <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Nama <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={whatsAppData.name}
                      onChange={(e) =>
                        setWhatsAppData({
                          ...whatsAppData,
                          name: e.target.value,
                        })
                      }
                      placeholder="Masukkan nama lengkap"
                      className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                  </div>

                  {/* WhatsApp Phone (Required) */}
                  <div>
                    <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Nomor WhatsApp <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={whatsAppData.whatsapp_phone}
                      onChange={(e) =>
                        setWhatsAppData({
                          ...whatsAppData,
                          whatsapp_phone: e.target.value,
                        })
                      }
                      placeholder="6281234567890"
                      className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Format: 6281234567890 (tanpa +, mulai dengan 62)
                    </p>
                  </div>

                  {/* Email Verification - Hanya tampil jika email belum verified */}
                  {showEmailWarning && (
                    <div>
                      <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                        Email (Verification){" "}
                        <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="email"
                        value={newEmail || emailStatus?.email || ""}
                        onChange={(e) => {
                          const emailValue = e.target.value;
                          setNewEmail(emailValue);
                          setWhatsAppData({
                            ...whatsAppData,
                            whatsapp_email: emailValue,
                          });
                        }}
                        placeholder="Masukkan email yang valid"
                        className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        required
                      />
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Email ini akan digunakan untuk verifikasi dan notifikasi.
                      </p>
                    </div>
                  )}

                  {/* Email untuk Wablas (Read-only) */}
                  <div>
                    <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Email untuk Wablas
                    </label>
                    <input
                      type="email"
                      value={
                        showEmailWarning
                          ? newEmail || emailStatus?.email || ""
                          : emailStatus?.email || ""
                      }
                      readOnly={true}
                      placeholder="Otomatis sama dengan Email Verification"
                      className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed placeholder-gray-500 dark:placeholder-gray-400"
                    />
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      {showEmailWarning
                        ? "Otomatis sync dengan Email Verification di atas"
                        : "Menggunakan email verification yang sudah terverifikasi"}
                    </p>
                  </div>

                  {/* Address */}
                  <div>
                    <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Alamat <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={whatsAppData.whatsapp_address}
                      onChange={(e) =>
                        setWhatsAppData({
                          ...whatsAppData,
                          whatsapp_address: e.target.value,
                        })
                      }
                      rows={2}
                      placeholder="Masukkan alamat lengkap"
                      className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                      required
                    />
                  </div>

                  {/* Birth Day */}
                  <div>
                    <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                      Tanggal Lahir <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={whatsAppData.whatsapp_birth_day}
                      onChange={(e) =>
                        setWhatsAppData({
                          ...whatsAppData,
                          whatsapp_birth_day: e.target.value,
                        })
                      }
                      max={new Date().toISOString().split("T")[0]}
                      className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      Format: dd-mm-yyyy (contoh: 15-01-1990)
                    </p>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      onClick={handleSaveEmailAndWhatsApp}
                      disabled={
                        updatingEmail ||
                        updatingWhatsApp ||
                        (showEmailWarning && !newEmail.trim()) ||
                        !whatsAppData.name ||
                        !whatsAppData.whatsapp_phone ||
                        !whatsAppData.whatsapp_phone.match(/^62\d+$/) ||
                        !whatsAppData.whatsapp_address ||
                        !whatsAppData.whatsapp_address.trim() ||
                        !whatsAppData.whatsapp_birth_day ||
                        !whatsAppData.whatsapp_birth_day.trim() ||
                        (!showEmailWarning && !emailStatus?.email)
                      }
                      className="px-4 py-2 text-sm font-medium text-white bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                    >
                      {updatingEmail || updatingWhatsApp
                        ? "Menyimpan..."
                        : "Simpan & Sync ke Wablas"}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100002] flex items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowSuccessModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg z-[100003] max-w-md w-full mx-4"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    className="w-8 h-8 text-green-600 dark:text-green-400"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Berhasil!
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  {localStorage.getItem("last_success_action") === "email_verify"
                    ? "Email berhasil diverifikasi."
                    : "Data berhasil disimpan dan disinkronkan ke Wablas."}
                </p>
                <button
                  onClick={() => setShowSuccessModal(false)}
                  className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error Modal */}
      <AnimatePresence>
        {showErrorModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100002] flex items-center justify-center"
          >
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowErrorModal(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg z-[100003] max-w-md w-full mx-4"
            >
              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FontAwesomeIcon
                    icon={faTimesCircle}
                    className="w-8 h-8 text-red-600 dark:text-red-400"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Terjadi Kesalahan
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4 whitespace-pre-line">
                  {errorMessage}
                </p>
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                >
                  Tutup
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
