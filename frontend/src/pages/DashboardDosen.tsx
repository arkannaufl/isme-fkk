import {
  useState,
  useEffect,
  useMemo,
  useCallback,
  lazy,
  Suspense,
} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCalendar,
  faClock,
  faTimes,
  faBookOpen,
  faBell,
  faGraduationCap,
  faFlask,
  faCheckCircle,
  faTimesCircle,
  faInfoCircle,
  faChevronDown,
  faChevronUp,
  faChevronRight,
  faEye,
  faExclamationTriangle,
  faComments,
  faComment,
  faReply,
  faFolderPlus,
  faCalendarAlt,
  faNewspaper,
  faUsers,
  faFileAlt,
} from "@fortawesome/free-solid-svg-icons";
import { useNavigate } from "react-router-dom";
import api, { handleApiError, getUser } from "../utils/api";
import { motion, AnimatePresence } from "framer-motion";

interface JadwalItem {
  id: number;
  tanggal: string;
  waktu_mulai: string;
  durasi: number;
  pengampu: string;
  ruangan: string;
  mata_kuliah_kode: string;
  mata_kuliah_nama: string;
  lokasi: string;
  created_at: string;
}

interface JadwalPBL extends JadwalItem {
  modul: string;
  blok: number;
  pertemuan_ke: number;
  topik: string;
  status_konfirmasi:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  tipe_pbl: string;
  kelompok: string;
  x50: number;
  semester_type?: "reguler" | "antara";
  is_active_dosen?: boolean; // Flag: apakah dosen ini adalah dosen aktif
  is_in_history?: boolean; // Flag: apakah dosen ini hanya ada di history
}

interface JadwalKuliahBesar {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string;
  topik?: string;
  status_konfirmasi:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  mata_kuliah_kode: string;
  mata_kuliah_nama: string;
  dosen_id: number | null;
  dosen_ids: number[];
  dosen: {
    id: number;
    name: string;
  } | null;
  ruangan: {
    id: number;
    nama: string;
  };
  jumlah_sesi: number;
  semester_type?: "reguler" | "antara";
  created_at: string;
  kelompok_besar?: {
    id: number;
    semester: number;
    nama_kelompok: string;
  } | null;
  is_active_dosen?: boolean; // Flag: apakah dosen ini adalah dosen aktif
  is_in_history?: boolean; // Flag: apakah dosen ini hanya ada di history
}

interface JadwalPraktikum {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  materi: string;
  topik?: string;
  status_konfirmasi:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  mata_kuliah_kode: string;
  mata_kuliah_nama: string;
  kelas_praktikum: string;
  dosen: Array<{
    id: number;
    name: string;
    status_konfirmasi?:
      | "belum_konfirmasi"
      | "bisa"
      | "tidak_bisa"
      | "waiting_reschedule";
    alasan_konfirmasi?: string;
  }>;
  ruangan: {
    id: number;
    nama: string;
  };
  jumlah_sesi: number;
  semester_type?: "reguler" | "antara";
  created_at: string;
  is_active_dosen?: boolean; // Flag: apakah dosen ini adalah dosen aktif
  is_in_history?: boolean; // Flag: apakah dosen ini hanya ada di history
}

interface JadwalJurnalReading {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  topik: string;
  status_konfirmasi:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  mata_kuliah_kode: string;
  mata_kuliah_nama: string;
  dosen_id: number | null;
  dosen_ids: number[];
  dosen: {
    id: number;
    name: string;
  } | null;
  ruangan: {
    id: number;
    nama: string;
  };
  jumlah_sesi: number;
  kelompok_kecil_id?: number;
  kelompok_kecil_antara_id?: number;
  file_jurnal?: string;
  semester_type?: "reguler" | "antara";
  created_at: string;
  is_active_dosen?: boolean; // Flag: apakah dosen ini adalah dosen aktif
  is_in_history?: boolean; // Flag: apakah dosen ini hanya ada di history
}

interface JadwalPersamaanPersepsi {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  topik?: string;
  status_konfirmasi:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  mata_kuliah_kode: string;
  mata_kuliah_nama: string;
  mata_kuliah?: {
    kode: string;
    nama: string;
    semester: number | string;
    blok: number | null;
  } | null;
  dosen_ids: number[];
  koordinator_ids?: number[];
  koordinator_names?: string;
  pengampu_names?: string;
  ruangan: {
    id: number;
    nama: string;
  } | null;
  use_ruangan?: boolean;
  jumlah_sesi: number;
  semester_type?: "reguler" | "antara";
  created_at: string;
  is_active_dosen?: boolean; // Flag: apakah dosen ini adalah dosen aktif
  is_in_history?: boolean; // Flag: apakah dosen ini hanya ada di history
}

interface JadwalSeminarPleno {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  topik?: string;
  status_konfirmasi:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  mata_kuliah_kode: string;
  mata_kuliah_nama: string;
  dosen_ids: number[];
  koordinator_ids?: number[];
  koordinator_names?: string;
  pengampu_names?: string;
  ruangan: {
    id: number;
    nama: string;
  };
  jumlah_sesi: number;
  kelompok_besar_id?: number;
  kelompok_besar?: {
    id: number;
    semester: number;
    nama_kelompok: string;
  } | null;
  semester_type?: "reguler" | "antara";
  created_at: string;
  is_active_dosen?: boolean; // Flag: apakah dosen ini adalah dosen aktif
  is_in_history?: boolean; // Flag: apakah dosen ini hanya ada di history
}

interface TodayScheduleItem {
  id: number;
  type: string;
  mata_kuliah: string;
  dosen: string;
  ruangan: string;
  waktu: string;
  topik: string;
  status_konfirmasi:
    | "belum_konfirmasi"
    | "bisa"
    | "tidak_bisa"
    | "waiting_reschedule";
  status_reschedule?: "waiting" | "approved" | "rejected";
  semester_type?: "reguler" | "antara";
}

interface Notification {
  id: number;
  title: string;
  message: string;
  type: "info" | "success" | "warning" | "error";
  is_read: boolean;
  created_at: string;
  data?: {
    forum_id?: number;
    forum_title?: string;
    forum_slug?: string;
    category_id?: number;
    category_name?: string;
    author_id?: number;
    author_name?: string;
    author_role?: string;
    access_type?: string;
    notification_type?: string;
    reply_id?: number;
    commenter_id?: number;
    commenter_name?: string;
    commenter_role?: string;
    parent_reply_id?: number;
    replier_id?: number;
    replier_name?: string;
    replier_role?: string;
    category_slug?: string;
    creator_id?: number;
    creator_name?: string;
    creator_role?: string;
    // Jadwal notification fields
    jadwal_type?: string;
    jadwal_id?: number;
    dosen_id?: number;
    dosen_name?: string;
    dosen_role?: string;
    created_by?: string;
    created_by_role?: string;
    sender_name?: string;
    sender_role?: string;
    [key: string]: any;
  };
}

interface PBLAssignment {
  pbl_id: number;
  mata_kuliah_kode: string;
  modul: string;
  nama_mata_kuliah: string;
  mata_kuliah_semester: string;
  mata_kuliah_periode: string;
  blok: number;
  pertemuan_ke: number;
  durasi: string;
  jadwal?: JadwalPBL;
  // Additional properties from backend
  modul_ke?: number;
  nama_modul?: string;
  durasi_modul?: string;
  peran_display?: string;
  tipe_peran?: string;
}

interface BlokAssignment {
  blok: number;
  semester_type: string;
  pbl_assignments: PBLAssignment[];
  total_pbl: number;
  // Additional properties from backend
  semester?: number;
  mata_kuliah?: {
    kode: string;
    nama: string;
    periode: string;
  };
}

// Skeleton Components
const SkeletonLine = ({ width = "w-full", height = "h-4" }) => (
  <div
    className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${width} ${height}`}
  ></div>
);

const SkeletonCircle = ({ size = "w-8 h-8" }) => (
  <div
    className={`bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse ${size}`}
  ></div>
);

const SkeletonCard = () => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <SkeletonCircle size="w-12 h-12" />
        <div className="space-y-2">
          <SkeletonLine width="w-24" height="h-5" />
          <SkeletonLine width="w-32" height="h-4" />
        </div>
      </div>
      <SkeletonCircle size="w-6 h-6" />
    </div>
    <div className="space-y-3">
      <SkeletonLine width="w-full" height="h-4" />
      <SkeletonLine width="w-3/4" height="h-4" />
      <div className="flex justify-between">
        <SkeletonLine width="w-16" height="h-8" />
        <SkeletonLine width="w-20" height="h-8" />
      </div>
    </div>
  </div>
);

const SkeletonHeader = () => (
  <div className="flex items-center gap-4 mb-4">
    <SkeletonCircle size="w-12 h-12" />
    <div className="space-y-2">
      <SkeletonLine width="w-48" height="h-8" />
      <SkeletonLine width="w-64" height="h-4" />
    </div>
  </div>
);

const SkeletonTable = () => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl overflow-hidden shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
    <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
      <SkeletonLine width="w-32" height="h-6" />
    </div>
    <div className="p-6 space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="grid grid-cols-9 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((j) => (
            <SkeletonLine key={j} width="w-full" height="h-4" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

const SkeletonTodaySchedule = () => (
  <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse"></div>
        <div>
          <div className="h-6 w-40 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-2"></div>
          <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
        </div>
      </div>
    </div>
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div
          key={i}
          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 animate-pulse"
        >
          <div className="flex items-start space-x-4">
            <div className="w-11 h-11 bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse"></div>
            <div className="flex-1 space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-5 w-3/4 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                <div className="h-6 w-20 bg-gray-200 dark:bg-gray-600 rounded-full animate-pulse"></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                <div className="h-4 w-32 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                <div className="h-4 w-28 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
                <div className="h-4 w-20 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
              </div>
            </div>
            <div className="w-16 h-8 bg-gray-200 dark:bg-gray-600 rounded animate-pulse"></div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

export default function DashboardDosen() {
  const navigate = useNavigate();

  // Handle notification click
  const handleNotificationClick = (notification: Notification) => {
    if (
      notification.data?.notification_type === "forum_created" ||
      notification.data?.notification_type === "forum_comment" ||
      notification.data?.notification_type === "forum_reply"
    ) {
      // Navigate to forum detail
      if (notification.data?.forum_slug) {
        navigate(`/forum-detail/${notification.data.forum_slug}`);
      }
    } else if (notification.data?.notification_type === "category_created") {
      // Navigate to forum category
      if (notification.data?.category_slug) {
        navigate(`/forum-category/${notification.data.category_slug}`);
      }
    } else if (notification.data?.jadwal_type) {
      // Handle jadwal notifications - scroll to Jadwal & Konfirmasi section
      const jadwalSection = document.getElementById(
        "jadwal-konfirmasi-section"
      );
      if (jadwalSection) {
        jadwalSection.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });

        // Optional: Add a subtle highlight effect
        jadwalSection.style.transition = "all 0.3s ease";
        jadwalSection.style.backgroundColor = "rgba(59, 130, 246, 0.1)";
        setTimeout(() => {
          jadwalSection.style.backgroundColor = "";
        }, 2000);
      }
    }
  };

  // Get notification icon based on type
  const getNotificationIcon = (notification: Notification) => {
    if (notification.data?.notification_type === "forum_created") {
      return faComments;
    } else if (notification.data?.notification_type === "forum_comment") {
      return faComment;
    } else if (notification.data?.notification_type === "forum_reply") {
      return faReply;
    } else if (notification.data?.notification_type === "category_created") {
      return faFolderPlus;
    } else if (notification.data?.jadwal_type) {
      // Jadwal notification icons
      const jadwalType = notification.data.jadwal_type;
      switch (jadwalType) {
        case "pbl":
          return faBookOpen;
        case "kuliah_besar":
          return faGraduationCap;
        case "praktikum":
          return faFlask;
        case "jurnal":
          return faNewspaper;
        case "persamaan_persepsi":
          return faUsers;
        case "seminar_pleno":
          return faUsers;
        case "csr":
          return faUsers;
        case "non_blok_non_csr":
          return faFileAlt;
        default:
          return faCalendar;
      }
    }

    // Default icons for other notification types
    return notification.type === "success"
      ? faCheckCircle
      : notification.type === "warning"
      ? faExclamationTriangle
      : notification.type === "error"
      ? faTimesCircle
      : faInfoCircle;
  };
  const [jadwalPBL, setJadwalPBL] = useState<JadwalPBL[]>([]);
  const [jadwalKuliahBesar, setJadwalKuliahBesar] = useState<
    JadwalKuliahBesar[]
  >([]);
  const [jadwalPraktikum, setJadwalPraktikum] = useState<JadwalPraktikum[]>([]);
  const [jadwalJurnalReading, setJadwalJurnalReading] = useState<
    JadwalJurnalReading[]
  >([]);
  const [jadwalPersamaanPersepsi, setJadwalPersamaanPersepsi] = useState<
    JadwalPersamaanPersepsi[]
  >([]);
  const [jadwalSeminarPleno, setJadwalSeminarPleno] = useState<
    JadwalSeminarPleno[]
  >([]);
  const [jadwalCSR, setJadwalCSR] = useState<any[]>([]);
  const [jadwalNonBlokNonCSR, setJadwalNonBlokNonCSR] = useState<any[]>([]);
  const [jadwalBimbinganAkhir, setJadwalBimbinganAkhir] = useState<any[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<TodayScheduleItem[]>([]);
  const [praktikumKoordinator, setPraktikumKoordinator] = useState<
    Array<{
      id: number;
      mata_kuliah_kode: string;
      mata_kuliah_nama: string;
      tanggal: string;
      jam_mulai: string;
      jam_selesai: string;
      ruangan: string;
      kelas_praktikum: string;
      materi: string;
      topik?: string;
      koordinator_signature: string | null;
      action_url: string;
    }>
  >([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  // Ensure notifications is always an array
  const safeNotifications = Array.isArray(notifications) ? notifications : [];
  const [loading, setLoading] = useState(true);
  const [activeSemester, setActiveSemester] = useState<
    "ganjil" | "genap" | "all"
  >("ganjil");
  const [activeSemesterType, setActiveSemesterType] = useState<
    "reguler" | "antara" | "all"
  >("reguler");
  const [expandedBlok, setExpandedBlok] = useState<number | null>(null);
  const [showKonfirmasiModal, setShowKonfirmasiModal] = useState(false);
  const [selectedJadwal, setSelectedJadwal] = useState<any>(null);
  const [selectedStatus, setSelectedStatus] = useState<
    "bisa" | "tidak_bisa" | null
  >(null);
  const [selectedAlasan, setSelectedAlasan] = useState<string>("");
  const [customAlasan, setCustomAlasan] = useState<string>("");
  const [blokAssignments, setBlokAssignments] = useState<BlokAssignment[]>([]);
  const [loadingBlok, setLoadingBlok] = useState(true);
  const [isBlokMinimized] = useState(false);
  const [allDosenList, setAllDosenList] = useState<any[]>([]);
  const [expandedPraktikumRows, setExpandedPraktikumRows] = useState<
    Set<number>
  >(new Set());

  // Reschedule states
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleReason, setRescheduleReason] = useState<string>("");

  // Real-time clock state
  const [currentTime, setCurrentTime] = useState(new Date());

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

  // Check if user is dosen
  useEffect(() => {
    const user = getUser();
    if (!user || user.role !== "dosen") {
      navigate("/");
    }
  }, [navigate]);

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

          // Check WhatsApp contact status setelah email status ter-load
          // Check WhatsApp contact status
          const checkWhatsAppStatus = () => {
            const userData = getUser();
            if (!userData) return;

            // Hanya phone dan name yang required (sesuai API Wablas)
            // name sudah pasti ada di user, jadi hanya cek phone
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
            // atau dari email user jika belum verified
            const wablasEmail =
              newEmailStatus.email || // Prioritas 1: Email verification yang sudah verified
              userData.whatsapp_email || // Prioritas 2: WhatsApp email yang sudah ada
              userData.email || // Prioritas 3: Email user
              "";

            setWhatsAppData({
              name: userData.name || "", // Pre-fill dari data yang ada
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
        // Hanya phone yang required (sesuai API Wablas)
        const needsWhatsApp =
          !userData.whatsapp_phone || !userData.whatsapp_phone.match(/^62\d+$/);
        setShowWhatsAppWarning(needsWhatsApp);
        // Update WhatsApp data dengan email dari emailStatus jika ada, dan pre-fill nomor dari data sebelumnya
        const prefillPhone =
          userData.whatsapp_phone ||
          (userData.telp
            ? userData.telp.startsWith("62")
              ? userData.telp
              : userData.telp.replace(/^0/, "62")
            : "");

        // Pastikan email untuk Wablas selalu ambil dari email verification yang sudah ada (jika sudah verified)
        const wablasEmail =
          emailStatus?.email || // Prioritas 1: Email verification yang sudah verified
          userData.whatsapp_email || // Prioritas 2: WhatsApp email yang sudah ada
          userData.email || // Prioritas 3: Email user
          "";

        setWhatsAppData({
          name: userData.name || "", // Pre-fill dari data yang ada
          whatsapp_phone: prefillPhone,
          whatsapp_email: wablasEmail,
          whatsapp_address: userData.whatsapp_address || "",
          whatsapp_birth_day: userData.whatsapp_birth_day || "",
        });
      }
    };

    window.addEventListener("user-updated", handleUserUpdated);
    return () => window.removeEventListener("user-updated", handleUserUpdated);
  }, []);

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Memoized semester params to prevent unnecessary re-renders
  const semesterParams = useMemo(
    () =>
      activeSemesterType !== "all"
        ? `?semester_type=${activeSemesterType}`
        : "",
    [activeSemesterType]
  );

  // Optimized fetch with caching and error handling
  const fetchDashboardData = useCallback(async () => {
    try {
      const userData = getUser();
      if (!userData) return;

      setLoading(true);

      // Batch API calls with timeout
      const apiCalls = [
        api.get(`/jadwal-pbl/dosen/${userData.id}${semesterParams}`),
        api.get(`/jadwal-kuliah-besar/dosen/${userData.id}${semesterParams}`),
        api.get(`/jadwal-praktikum/dosen/${userData.id}${semesterParams}`),
        api.get(`/jadwal-jurnal-reading/dosen/${userData.id}${semesterParams}`),
        api.get(
          `/jadwal-persamaan-persepsi/dosen/${userData.id}${semesterParams}`
        ),
        api.get(`/jadwal-seminar-pleno/dosen/${userData.id}${semesterParams}`),
        api.get(`/notifications/dosen/${userData.id}`),
        api.get(`/dosen/${userData.id}/today-schedule`),
      ];

      // Only fetch CSR and Non Blok Non CSR for regular semester
      if (activeSemesterType !== "antara") {
        apiCalls.push(
          api.get(`/jadwal-csr/dosen/${userData.id}${semesterParams}`)
        );
      }

      // Always fetch Non Blok Non CSR
      apiCalls.push(
        api.get(
          `/jadwal-non-blok-non-csr/dosen/${userData.id}${semesterParams}`
        )
      );

      const responses = await Promise.allSettled(apiCalls);

      // Process responses with error handling
      const [
        jadwalPBLResult,
        jadwalKuliahBesarResult,
        jadwalPraktikumResult,
        jadwalJurnalReadingResult,
        jadwalPersamaanPersepsiResult,
        jadwalSeminarPlenoResult,
        notifResult,
        todayScheduleResult,
        ...otherResults
      ] = responses;

      // Set data with fallback for failed requests
      setJadwalPBL(
        jadwalPBLResult.status === "fulfilled"
          ? jadwalPBLResult.value.data.data || []
          : []
      );
      setJadwalKuliahBesar(
        jadwalKuliahBesarResult.status === "fulfilled"
          ? jadwalKuliahBesarResult.value.data.data || []
          : []
      );
      setJadwalPraktikum(
        jadwalPraktikumResult.status === "fulfilled"
          ? jadwalPraktikumResult.value.data.data || []
          : []
      );
      setJadwalJurnalReading(
        jadwalJurnalReadingResult.status === "fulfilled"
          ? jadwalJurnalReadingResult.value.data.data || []
          : []
      );
      setJadwalPersamaanPersepsi(
        jadwalPersamaanPersepsiResult.status === "fulfilled"
          ? jadwalPersamaanPersepsiResult.value.data.data || []
          : []
      );
      setJadwalSeminarPleno(
        jadwalSeminarPlenoResult.status === "fulfilled"
          ? jadwalSeminarPlenoResult.value.data.data || []
          : []
      );
      setNotifications(
        notifResult.status === "fulfilled"
          ? Array.isArray(notifResult.value.data)
            ? notifResult.value.data
            : Array.isArray(notifResult.value.data?.data)
            ? notifResult.value.data.data
            : []
          : []
      );
      setTodaySchedule(
        todayScheduleResult.status === "fulfilled"
          ? todayScheduleResult.value.data.data || []
          : []
      );

      // Handle CSR and Non Blok Non CSR based on semester type
      if (activeSemesterType !== "antara") {
        const jadwalCSRResult = otherResults[0];
        setJadwalCSR(
          jadwalCSRResult?.status === "fulfilled"
            ? jadwalCSRResult.value.data.data || []
            : []
        );
        const jadwalNonBlokNonCSRResult = otherResults[1];
        // Pastikan semua data non blok non csr termasuk seminar proposal dan sidang skripsi
        const nonBlokNonCSRData = jadwalNonBlokNonCSRResult?.status === "fulfilled"
            ? jadwalNonBlokNonCSRResult.value.data.data || []
          : [];
        
        // Filter jadwal bimbingan akhir (seminar proposal dan sidang skripsi)
        const bimbinganAkhirData = nonBlokNonCSRData.filter(
          (item: any) =>
            item.jenis_baris === "seminar_proposal" ||
            item.jenis_baris === "sidang_skripsi"
        );
        setJadwalBimbinganAkhir(bimbinganAkhirData);
        
        // Filter jadwal non blok non csr lainnya (bukan bimbingan akhir)
        const nonBimbinganAkhirData = nonBlokNonCSRData.filter(
          (item: any) =>
            item.jenis_baris !== "seminar_proposal" &&
            item.jenis_baris !== "sidang_skripsi"
        );
        setJadwalNonBlokNonCSR(nonBimbinganAkhirData);
      } else {
        setJadwalCSR([]);
        const jadwalNonBlokNonCSRResult = otherResults[0];
        // Pastikan semua data non blok non csr termasuk seminar proposal dan sidang skripsi
        const nonBlokNonCSRData = jadwalNonBlokNonCSRResult?.status === "fulfilled"
            ? jadwalNonBlokNonCSRResult.value.data.data || []
          : [];
        
        // Filter jadwal bimbingan akhir (seminar proposal dan sidang skripsi)
        const bimbinganAkhirData = nonBlokNonCSRData.filter(
          (item: any) =>
            item.jenis_baris === "seminar_proposal" ||
            item.jenis_baris === "sidang_skripsi"
        );
        setJadwalBimbinganAkhir(bimbinganAkhirData);
        
        // Filter jadwal non blok non csr lainnya (bukan bimbingan akhir)
        const nonBimbinganAkhirData = nonBlokNonCSRData.filter(
          (item: any) =>
            item.jenis_baris !== "seminar_proposal" &&
            item.jenis_baris !== "sidang_skripsi"
        );
        setJadwalNonBlokNonCSR(nonBimbinganAkhirData);
      }

      // Fetch blok assignments separately (less critical)
      try {
        const blokResponse = await api.get(
          `/dosen/${userData.id}/pbl-assignments`
        );
        setBlokAssignments(blokResponse.data.data || []);
      } catch (error) {
        console.warn("Failed to fetch blok assignments:", error);
        setBlokAssignments([]);
      }

      // Fetch all dosen list for resolving dosen_ids
      try {
        const dosenResponse = await api.get("/users?role=dosen");
        // Handle pagination response
        let dosenData: any[] = [];
        if (Array.isArray(dosenResponse.data)) {
          dosenData = dosenResponse.data;
        } else if (dosenResponse.data?.data && Array.isArray(dosenResponse.data.data)) {
          dosenData = dosenResponse.data.data;
        } else if (dosenResponse.data?.data?.data && Array.isArray(dosenResponse.data.data.data)) {
          dosenData = dosenResponse.data.data.data;
        }
        setAllDosenList(dosenData);
      } catch (error) {
        console.warn("Failed to fetch dosen list:", error);
        setAllDosenList([]);
      }

      // Fetch praktikum yang memerlukan tanda tangan koordinator
      try {
        const semesterParamsForKoordinator =
          activeSemester !== "all"
            ? `?semester=${activeSemester}&semester_type=${activeSemesterType}`
            : `?semester_type=${activeSemesterType}`;
        const praktikumKoordinatorRes = await api.get(
          `/praktikum/koordinator-pending-signature/${userData.id}${semesterParamsForKoordinator}`
        );
        if (praktikumKoordinatorRes.data?.data) {
          setPraktikumKoordinator(praktikumKoordinatorRes.data.data);
        } else {
          setPraktikumKoordinator([]);
        }
      } catch (err) {
        // Jika endpoint belum ada atau error, set empty array
        console.error("Error fetching koordinator praktikum:", err);
        setPraktikumKoordinator([]);
      }
    } catch (error: any) {
      console.error("Gagal memuat data dashboard:", error);
    } finally {
      setLoading(false);
      setLoadingBlok(false);
    }
  }, [activeSemester, activeSemesterType]);

  // Listen to koordinator signature updates
  useEffect(() => {
    const handleKoordinatorSignatureUpdate = async () => {
      const userData = getUser();
      if (!userData) return;

      const semesterParams =
        activeSemester !== "all"
          ? `?semester=${activeSemester}&semester_type=${activeSemesterType}`
          : `?semester_type=${activeSemesterType}`;

      try {
        const praktikumKoordinatorRes = await api.get(
          `/praktikum/koordinator-pending-signature/${userData.id}${semesterParams}`
        );
        if (praktikumKoordinatorRes.data?.data) {
          setPraktikumKoordinator(praktikumKoordinatorRes.data.data);
        }
      } catch (err) {
        console.error("Error refreshing koordinator praktikum:", err);
      }
    };

    window.addEventListener(
      "koordinator-signature-updated",
      handleKoordinatorSignatureUpdate
    );

    return () => {
      window.removeEventListener(
        "koordinator-signature-updated",
        handleKoordinatorSignatureUpdate
      );
    };
  }, [activeSemester, activeSemesterType]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const openKonfirmasiModal = (jadwal: any) => {
    setSelectedJadwal(jadwal);
    setShowKonfirmasiModal(true);
    setSelectedStatus(null);
    setSelectedAlasan("");
    setCustomAlasan("");
  };

  const openRescheduleModal = (jadwal: any) => {
    setSelectedJadwal(jadwal);
    setShowRescheduleModal(true);
    setRescheduleReason("");
  };

  const handlePenilaianClick = (jadwal: any, jadwalType: string) => {
    const user = getUser();
    if (!user) return;

    // Determine navigation path based on jadwal type
    if (jadwalType === "pbl") {
      // For PBL, we need to determine if it's semester antara or reguler
      const isAntara = jadwal.semester_type === "antara";
      // Use the correct field names from the API response
      const kelompok = jadwal.kelompok; // Direct field, not nested
      const pblTipe = jadwal.tipe_pbl; // Correct field name

      if (isAntara) {
        navigate(
          `/penilaian-pbl-antara/${jadwal.mata_kuliah_kode}/${kelompok}/${pblTipe}?rowIndex=0`
        );
      } else {
        navigate(
          `/penilaian-pbl/${jadwal.mata_kuliah_kode}/${kelompok}/${pblTipe}?rowIndex=0`
        );
      }
    } else if (jadwalType === "jurnal") {
      // For Jurnal Reading
      const kelompok =
        jadwal.kelompok_kecil?.nama ||
        jadwal.kelompok_kecil_antara?.nama_kelompok;
      const isAntara = jadwal.semester_type === "antara";

      if (isAntara) {
        navigate(
          `/penilaian-jurnal-antara/${jadwal.mata_kuliah_kode}/${kelompok}/${jadwal.id}`
        );
      } else {
        navigate(
          `/penilaian-jurnal/${jadwal.mata_kuliah_kode}/${kelompok}/${jadwal.id}`
        );
      }
    }
    // Add other jadwal types as needed
  };

  const handleSubmitKonfirmasi = async () => {
    if (!selectedJadwal || !selectedStatus) return;

    try {
      const alasan =
        selectedStatus === "tidak_bisa"
          ? selectedAlasan === "custom"
            ? customAlasan
            : selectedAlasan
          : null;

      let endpoint;
      let payload: any = {
        status: selectedStatus,
        alasan: alasan,
      };

      // Determine endpoint based on jadwal type
      if (selectedJadwal.modul) {
        endpoint = `/jadwal-pbl/${selectedJadwal.id}/konfirmasi`;
        payload.dosen_id = getUser()?.id;
      } else if (selectedJadwal.kelas_praktikum !== undefined) {
        endpoint = `/jadwal-praktikum/${selectedJadwal.id}/konfirmasi`;
        payload.dosen_id = getUser()?.id;
      } else if (selectedJadwal.file_jurnal !== undefined) {
        endpoint = `/jadwal-jurnal-reading/${selectedJadwal.id}/konfirmasi`;
        payload.dosen_id = getUser()?.id;
      } else if (
        selectedJadwal.koordinator_ids !== undefined &&
        (selectedJadwal.kelompok_besar_id !== undefined ||
          selectedJadwal.kelompok_besar)
      ) {
        // Seminar Pleno memiliki koordinator_ids DAN kelompok_besar_id/kelompok_besar
        endpoint = `/jadwal-seminar-pleno/${selectedJadwal.id}/konfirmasi`;
        payload.dosen_id = getUser()?.id;
      } else if (
        selectedJadwal.koordinator_ids !== undefined &&
        !selectedJadwal.modul &&
        !selectedJadwal.kelas_praktikum &&
        !selectedJadwal.file_jurnal &&
        !selectedJadwal.jenis_csr &&
        !selectedJadwal.jenis_baris
      ) {
        // Persamaan Persepsi memiliki koordinator_ids tapi tidak memiliki kelompok_besar_id
        endpoint = `/jadwal-persamaan-persepsi/${selectedJadwal.id}/konfirmasi`;
        payload.dosen_id = getUser()?.id;
      } else if (selectedJadwal.jenis_csr !== undefined) {
        endpoint = `/jadwal-csr/${selectedJadwal.id}/konfirmasi`;
        payload.dosen_id = getUser()?.id;
      } else if (selectedJadwal.jenis_baris !== undefined) {
        endpoint = `/jadwal-non-blok-non-csr/${selectedJadwal.id}/konfirmasi`;
        payload.dosen_id = getUser()?.id;
      } else if (
        selectedJadwal.kelompok_besar_id !== undefined ||
        selectedJadwal.kelompok_besar
      ) {
        // Jadwal Kuliah Besar memiliki kelompok_besar_id/kelompok_besar tapi tidak memiliki koordinator_ids
        endpoint = `/jadwal-kuliah-besar/${selectedJadwal.id}/konfirmasi`;
        payload.dosen_id = getUser()?.id;
      } else {
        // Default: Jadwal Kuliah Besar
        endpoint = `/jadwal-kuliah-besar/${selectedJadwal.id}/konfirmasi`;
        payload.dosen_id = getUser()?.id;
      }

      await api.put(endpoint, payload);

      setShowKonfirmasiModal(false);
      await fetchDashboardData();
    } catch (error: any) {
      console.error("Error konfirmasi:", error);
    }
  };

  const handleSubmitReschedule = async () => {
    if (!selectedJadwal || !rescheduleReason.trim()) return;

    try {
      let endpoint;
      let payload: any = {
        reschedule_reason: rescheduleReason.trim(),
        dosen_id: getUser()?.id,
      };

      // Determine endpoint based on jadwal type
      // Praktikum tidak memiliki reschedule
      if (selectedJadwal.modul) {
        endpoint = `/jadwal-pbl/${selectedJadwal.id}/reschedule`;
      } else if (selectedJadwal.file_jurnal !== undefined) {
        endpoint = `/jadwal-jurnal-reading/${selectedJadwal.id}/reschedule`;
      } else if (
        selectedJadwal.koordinator_ids !== undefined &&
        (selectedJadwal.kelompok_besar_id !== undefined ||
          selectedJadwal.kelompok_besar)
      ) {
        // Seminar Pleno memiliki koordinator_ids DAN kelompok_besar_id/kelompok_besar
        endpoint = `/jadwal-seminar-pleno/${selectedJadwal.id}/reschedule`;
      } else if (
        selectedJadwal.koordinator_ids !== undefined &&
        !selectedJadwal.modul &&
        !selectedJadwal.kelas_praktikum &&
        !selectedJadwal.file_jurnal &&
        !selectedJadwal.jenis_csr &&
        !selectedJadwal.jenis_baris
      ) {
        // Persamaan Persepsi memiliki koordinator_ids tapi tidak memiliki kelompok_besar_id
        endpoint = `/jadwal-persamaan-persepsi/${selectedJadwal.id}/reschedule`;
      } else if (selectedJadwal.jenis_csr !== undefined) {
        endpoint = `/jadwal-csr/${selectedJadwal.id}/reschedule`;
      } else if (selectedJadwal.jenis_baris !== undefined) {
        endpoint = `/jadwal-non-blok-non-csr/${selectedJadwal.id}/reschedule`;
      } else if (
        selectedJadwal.kelompok_besar_id !== undefined ||
        selectedJadwal.kelompok_besar
      ) {
        // Jadwal Kuliah Besar memiliki kelompok_besar_id/kelompok_besar tapi tidak memiliki koordinator_ids
        endpoint = `/jadwal-kuliah-besar/${selectedJadwal.id}/reschedule`;
      } else {
        // Default: Jadwal Kuliah Besar
        endpoint = `/jadwal-kuliah-besar/${selectedJadwal.id}/reschedule`;
      }

      await api.post(endpoint, payload);

      setShowRescheduleModal(false);
      setRescheduleReason("");
      await fetchDashboardData();
    } catch (error: any) {
      console.error("Error reschedule:", error);
    }
  };

  // Handle email verification
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
      // Pastikan whatsapp_email SELALU sama dengan finalEmail (Email Verification)
      // Jika email sudah verified, gunakan email dari emailStatus
      // Jika email belum verified, gunakan finalEmail dari step 1
      const wablasEmail = showEmailWarning
        ? finalEmail
        : emailStatus?.email || finalEmail;

      const response = await api.put("/profile", {
        name: whatsAppData.name || userData.name, // Required untuk Wablas, ambil dari form
        username: userData.username,
        email: finalEmail, // Email Verification
        whatsapp_phone: whatsAppData.whatsapp_phone, // Required
        whatsapp_email: wablasEmail, // SELALU sama dengan Email Verification (tidak boleh berbeda)
        whatsapp_address: whatsAppData.whatsapp_address, // Required
        whatsapp_birth_day: whatsAppData.whatsapp_birth_day, // Required
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
          // Jika wablas_synced false, berarti sync gagal dan data tidak tersimpan
          // Tampilkan error message
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

      // Parse error message lebih spesifik
      let errorMsg = "Terjadi kesalahan saat menyimpan data.";

      if (error.response?.data?.errors) {
        // Jika ada validation errors dari Laravel
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
        if (errors.name) {
          errorMessages.push(
            `Nama: ${Array.isArray(errors.name) ? errors.name[0] : errors.name}`
          );
        }

        if (errorMessages.length > 0) {
          errorMsg = errorMessages.join(" | ");
        } else {
          errorMsg =
            error.response?.data?.message ||
            "Validasi gagal. Silakan periksa kembali data yang diisi.";
        }
      } else if (error.response?.data?.message) {
        // Prioritas: ambil message dari backend (termasuk error Wablas sync)
        errorMsg = error.response.data.message;
      } else if (error.response?.data?.error) {
        // Jika ada field error terpisah
        errorMsg = error.response.data.error;
      } else if (error.message) {
        errorMsg = error.message;
      }

      setErrorMessage(errorMsg);
      setShowErrorModal(true);
      
      // Jika sync gagal, refresh data untuk mendapatkan data terbaru (karena rollback)
      if (error.response?.status === 422 || error.response?.status === 500) {
        window.dispatchEvent(new Event("user-updated"));
      }
    } finally {
      setUpdatingEmail(false);
      setUpdatingWhatsApp(false);
    }
  };

  const getStatusBadge = (
    status: string,
    statusReschedule?: string,
    jadwalType?: string
  ) => {
    switch (status) {
      case "bisa":
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-700 whitespace-nowrap">
            <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3 mr-1" />
            Bisa
          </span>
        );
      case "tidak_bisa":
        // Untuk praktikum, tidak ada "Diganti Dosen" karena praktikum tidak ada reschedule
        const label =
          jadwalType === "praktikum"
            ? "Tidak Bisa Mengajar"
            : "Tidak Bisa (Diganti Dosen)";
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700 whitespace-nowrap">
            <FontAwesomeIcon icon={faTimesCircle} className="w-3 h-3 mr-1" />
            {label}
          </span>
        );
      case "waiting_reschedule":
        if (statusReschedule === "approved") {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700 whitespace-nowrap">
              <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3 mr-1" />
              Reschedule Disetujui
            </span>
          );
        } else if (statusReschedule === "rejected") {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700 whitespace-nowrap">
              <FontAwesomeIcon icon={faTimesCircle} className="w-3 h-3 mr-1" />
              Reschedule Ditolak
            </span>
          );
        } else {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700 whitespace-nowrap">
              <FontAwesomeIcon icon={faClock} className="w-3 h-3 mr-1" />
              Menunggu Reschedule
            </span>
          );
        }
      case "belum_konfirmasi":
        if (statusReschedule === "approved") {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700 whitespace-nowrap">
              <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3 mr-1" />
              Reschedule Disetujui - Konfirmasi Ulang
            </span>
          );
        } else if (statusReschedule === "rejected") {
          return (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700 whitespace-nowrap">
              <FontAwesomeIcon icon={faTimesCircle} className="w-3 h-3 mr-1" />
              Reschedule Ditolak
            </span>
          );
        } else {
          // Untuk praktikum, tampilkan badge "Menunggu Dosen" untuk belum_konfirmasi
          if (jadwalType === "praktikum") {
            return (
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700 whitespace-nowrap">
                <FontAwesomeIcon icon={faClock} className="w-3 h-3 mr-1" />
                Menunggu Dosen
              </span>
            );
          }
          return null; // Tidak menampilkan badge untuk "belum_konfirmasi" biasa (selain praktikum)
        }
      default:
        return null; // Tidak menampilkan badge untuk status lain
    }
  };

  const getSemesterTypeBadge = (semesterType?: "reguler" | "antara") => {
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
  };

  // Helper function untuk mendapatkan nama dosen pengampu
  // - Untuk dosen baru (is_active_dosen = true): tampilkan dosen baru itu sendiri
  // - Untuk dosen lama (is_in_history = true): tampilkan dosen_ids[0] (dosen awal)
  // Helper function untuk mendapatkan array nama dosen pengampu (untuk praktikum)
  const getPengampuNamesArray = (item: any): string[] => {
    try {
      // Pastikan allDosenList adalah array
      if (!Array.isArray(allDosenList)) {
        return [];
      }

      // Untuk praktikum, gunakan array dosen langsung seperti di DashboardMahasiswa.tsx
      if (item.dosen && Array.isArray(item.dosen) && item.dosen.length > 0) {
        // Filter out dosen with roles 'super_admin', 'tim_akademik', 'admin'
        const filteredDosen = item.dosen.filter((d: any) => {
          const dosen = allDosenList.find((dl) => dl.id === d.id);
          return (
            dosen &&
            dosen.role !== "super_admin" &&
            dosen.role !== "tim_akademik" &&
            dosen.role !== "admin"
          );
        });
        return filteredDosen
          .map((d) => d.name)
          .filter((name) => name && name.trim() !== "");
      }
    } catch (error) {
      console.error("Error getting pengampu names array:", error);
    }
    return [];
  };

  // Helper function untuk mendapatkan array dosen dengan status konfirmasi (untuk praktikum)
  const getPengampuWithStatus = (
    item: any
  ): Array<{ id: number; name: string; status_konfirmasi?: string }> => {
    try {
      // Pastikan allDosenList adalah array
      if (!Array.isArray(allDosenList)) {
        return [];
      }

      if (item.dosen && Array.isArray(item.dosen) && item.dosen.length > 0) {
        // Filter out dosen with roles 'super_admin', 'tim_akademik', 'admin'
        const filteredDosen = item.dosen.filter((d: any) => {
          const dosen = allDosenList.find((dl) => dl.id === d.id);
          return (
            dosen &&
            dosen.role !== "super_admin" &&
            dosen.role !== "tim_akademik" &&
            dosen.role !== "admin"
          );
        });
        return filteredDosen
          .map((d: any) => ({
            id: d.id,
            name: d.name,
            status_konfirmasi: d.status_konfirmasi || "belum_konfirmasi",
          }))
          .filter((d) => d.name && d.name.trim() !== "");
      }
    } catch (error) {
      console.error("Error getting pengampu with status:", error);
    }
    return [];
  };

  const getPengampuName = (item: any, jadwalType: string): string => {
    try {
      const user = getUser();
      if (!user) return "N/A";

      // Pastikan allDosenList adalah array
      if (!Array.isArray(allDosenList)) {
        return "N/A";
      }

      // Jika dosen ini adalah dosen aktif (dosen baru), tampilkan dosen baru itu sendiri
      if (item.is_active_dosen && item.dosen_id) {
        const activeDosen = allDosenList.find(
          (d) => d.id === Number(item.dosen_id)
        );
        if (
          activeDosen &&
          activeDosen.role !== "super_admin" &&
          activeDosen.role !== "tim_akademik" &&
          activeDosen.role !== "admin"
        ) {
          return activeDosen.name;
        }
      }

      // Jika dosen ini hanya ada di history (dosen lama), tampilkan dosen_ids[0] (dosen awal)
      if (item.is_in_history || !item.is_active_dosen) {
        // Parse dosen_ids jika ada
        let dosenIds: number[] = [];
        if (item.dosen_ids) {
          dosenIds = Array.isArray(item.dosen_ids)
            ? item.dosen_ids
            : typeof item.dosen_ids === "string"
            ? JSON.parse(item.dosen_ids || "[]")
            : [];
        }

        // Ambil dosen pengampu awal (elemen pertama)
        if (dosenIds.length > 0) {
          const originalDosenId = dosenIds[0];
          const originalDosen = allDosenList.find(
            (d) => d.id === Number(originalDosenId)
          );

          // Filter super admin dan tim akademik
          if (
            originalDosen &&
            originalDosen.role !== "super_admin" &&
            originalDosen.role !== "tim_akademik" &&
            originalDosen.role !== "admin"
          ) {
            return originalDosen.name;
          }
        }
      }

      // Fallback: gunakan dosen_id atau dosen object yang ada
      if (jadwalType === "kuliah_besar" || jadwalType === "jurnal") {
        if (item.dosen?.name) {
          const dosen = allDosenList.find((d) => d.id === item.dosen.id);
          if (
            dosen &&
            dosen.role !== "super_admin" &&
            dosen.role !== "tim_akademik" &&
            dosen.role !== "admin"
          ) {
            return item.dosen.name;
          }
        }
      } else if (jadwalType === "praktikum") {
        // Untuk praktikum, cek apakah dosen aktif atau history
        if (item.is_active_dosen && item.dosen_id) {
          const activeDosen = allDosenList.find(
            (d) => d.id === Number(item.dosen_id)
          );
          if (
            activeDosen &&
            activeDosen.role !== "super_admin" &&
            activeDosen.role !== "tim_akademik" &&
            activeDosen.role !== "admin"
          ) {
            return activeDosen.name;
          }
        }

        // Jika dosen history atau tidak ada dosen_id, gunakan dosen_ids[0]
        if (item.is_in_history || !item.is_active_dosen) {
          let dosenIds: number[] = [];
          if (item.dosen_ids) {
            dosenIds = Array.isArray(item.dosen_ids)
              ? item.dosen_ids
              : typeof item.dosen_ids === "string"
              ? JSON.parse(item.dosen_ids || "[]")
              : [];
          }

          if (dosenIds.length > 0) {
            const originalDosenId = dosenIds[0];
            const originalDosen = allDosenList.find(
              (d) => d.id === Number(originalDosenId)
            );
            if (
              originalDosen &&
              originalDosen.role !== "super_admin" &&
              originalDosen.role !== "tim_akademik" &&
              originalDosen.role !== "admin"
            ) {
              return originalDosen.name;
            }
          }
        }

        // Fallback: gunakan array dosen jika ada (prioritas pertama)
        if (item.dosen && Array.isArray(item.dosen) && item.dosen.length > 0) {
          // Jika allDosenList sudah ter-load, filter dosen yang bukan admin/tim akademik
          if (Array.isArray(allDosenList) && allDosenList.length > 0) {
            const validDosen = item.dosen.find((d: any) => {
              const dosen = allDosenList.find((dl) => dl.id === d.id);
              return (
            dosen &&
            dosen.role !== "super_admin" &&
            dosen.role !== "tim_akademik" &&
            dosen.role !== "admin"
              );
            });
            if (validDosen) {
              return validDosen.name;
            }
          } else {
            // Jika allDosenList belum ter-load, gunakan dosen pertama dari array
            const firstDosen = item.dosen[0];
            if (firstDosen && firstDosen.name) {
            return firstDosen.name;
            }
          }
        }
      } else if (item.pengampu) {
        return item.pengampu;
      }

      return "N/A";
    } catch (error) {
      console.error("Error getting pengampu name:", error);
      return "N/A";
    }
  };

  // Helper function untuk mendapatkan nama dosen pengganti
  // - Untuk dosen baru (is_active_dosen = true): tampilkan "-" (kosong)
  // - Untuk dosen lama (is_in_history = true): tampilkan dosen yang menggantikan dia secara langsung (bukan lompat)
  //   Contoh: Cemeti diganti Ganda, maka Cemeti melihat DOSEN PENGGANTI = Ganda
  //           Ganda diganti Dosen C, maka Ganda melihat DOSEN PENGGANTI = Dosen C
  //           Tapi Cemeti tetap melihat DOSEN PENGGANTI = Ganda (karena Ganda yang menggantikan Cemeti secara langsung)
  const getDosenPenggantiName = (item: any, jadwalType: string): string => {
    try {
      const user = getUser();
      if (!user) return "-";

      // Jika dosen ini adalah dosen aktif (dosen baru), tidak ada dosen pengganti
      if (item.is_active_dosen) {
        return "-";
      }

      // Jika dosen ini hanya ada di history (dosen lama), cari dosen yang menggantikan dia secara langsung
      if (item.is_in_history || !item.is_active_dosen) {
        // Parse dosen_ids jika ada
        let dosenIds: number[] = [];
        if (item.dosen_ids) {
          dosenIds = Array.isArray(item.dosen_ids)
            ? item.dosen_ids
            : typeof item.dosen_ids === "string"
            ? JSON.parse(item.dosen_ids || "[]")
            : [];
        }

        // Cari index dosen ini di dosen_ids
        const currentDosenIndex = dosenIds.findIndex(
          (id) => Number(id) === Number(user.id)
        );

        // Jika dosen ini ditemukan di dosen_ids dan bukan elemen terakhir
        if (currentDosenIndex >= 0 && currentDosenIndex < dosenIds.length - 1) {
          // Ambil dosen yang menggantikan dia secara langsung (elemen setelahnya)
          const nextDosenId = dosenIds[currentDosenIndex + 1];
          const dosenPengganti = allDosenList.find(
            (d) => d.id === Number(nextDosenId)
          );
          if (
            dosenPengganti &&
            dosenPengganti.role !== "super_admin" &&
            dosenPengganti.role !== "tim_akademik" &&
            dosenPengganti.role !== "admin"
          ) {
            return dosenPengganti.name;
          }
        }
      }

      // Fallback: jika tidak ditemukan di dosen_ids, gunakan dosen_id saat ini
      if (item.dosen_id) {
        const dosenPengganti = allDosenList.find(
          (d) => d.id === Number(item.dosen_id)
        );
        if (
          dosenPengganti &&
          dosenPengganti.role !== "super_admin" &&
          dosenPengganti.role !== "tim_akademik" &&
          dosenPengganti.role !== "admin"
        ) {
          return dosenPengganti.name;
        }
      }

      return "-";
    } catch (error) {
      console.error("Error getting dosen pengganti name:", error);
      return "-";
    }
  };

  const renderJadwalTable = useCallback(
    (
      title: string,
      icon: any,
      jadwalData: any[],
      headers: string[],
      jadwalType:
        | "pbl"
        | "kuliah_besar"
        | "praktikum"
        | "agenda_khusus"
        | "jurnal"
        | "persamaan_persepsi"
        | "seminar_pleno"
        | "csr"
        | "non_blok_non_csr"
        | "bimbingan_akhir_sempro"
        | "bimbingan_akhir_sidang",
      emptyMessage: string
    ) => {
      // Tentukan warna berdasarkan jenis jadwal
      const getIconColor = (type: string) => {
        switch (type) {
          case "kuliah_besar":
            return "bg-blue-500";
          case "pbl":
            return "bg-green-500";
          case "praktikum":
            return "bg-purple-500";
          case "jurnal":
            return "bg-indigo-500";
          case "persamaan_persepsi":
            return "bg-cyan-500";
          case "seminar_pleno":
            return "bg-teal-500";
          case "csr":
            return "bg-orange-500";
          case "non_blok_non_csr":
            return "bg-pink-500";
          default:
            return "bg-gray-500";
        }
      };

      return (
        <div className="overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center gap-3">
              <div
                className={`w-8 h-8 rounded-2xl ${getIconColor(
                  jadwalType
                )} flex items-center justify-center shadow-lg`}
              >
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
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider whitespace-nowrap"
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
                  jadwalData.map((item, index) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white font-medium align-top">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white align-top">
                        {item.tanggal}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white align-top">
                        {jadwalType === "kuliah_besar" ||
                        jadwalType === "praktikum" ||
                        jadwalType === "agenda_khusus" ||
                        jadwalType === "pbl" ||
                        jadwalType === "jurnal" ||
                        jadwalType === "persamaan_persepsi" ||
                        jadwalType === "seminar_pleno" ||
                        jadwalType === "csr" ||
                        jadwalType === "non_blok_non_csr" ||
                        jadwalType === "bimbingan_akhir_sempro" ||
                        jadwalType === "bimbingan_akhir_sidang"
                          ? `${item.jam_mulai} - ${item.jam_selesai}`
                          : item.waktu_mulai}
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
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white align-top">
                          {item.kelas_praktikum}
                        </td>
                      )}
                      {jadwalType !== "pbl" && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white align-top">
                          {jadwalType === "kuliah_besar" ||
                        jadwalType === "praktikum" ||
                        jadwalType === "agenda_khusus" ||
                        jadwalType === "jurnal" ||
                        jadwalType === "persamaan_persepsi" ||
                        jadwalType === "seminar_pleno" ||
                        jadwalType === "csr" ||
                        jadwalType === "non_blok_non_csr" ||
                        jadwalType === "bimbingan_akhir_sempro" ||
                        jadwalType === "bimbingan_akhir_sidang"
                            ? `${item.jumlah_sesi || 1} x 50 menit`
                            : `${item.durasi} menit`}
                        </td>
                      )}
                      {jadwalType === "praktikum" ? (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white align-top">
                            {item.materi || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white align-top">
                            {item.topik || "N/A"}
                          </td>
                        </>
                      ) : jadwalType === "jurnal" ? (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.topik || "N/A"}
                        </td>
                      ) : jadwalType === "persamaan_persepsi" ? (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {item.topik || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {(() => {
                              // Cek apakah ada mata_kuliah object dengan semester dan blok
                              const mataKuliah = item.mata_kuliah;
                              const semester = mataKuliah?.semester || "";
                              const blok =
                                mataKuliah?.blok !== null &&
                                mataKuliah?.blok !== undefined
                                ? `Blok ${mataKuliah.blok}` 
                                : "";
                              
                              // Gabungkan semester dan blok
                              const parts = [];
                              if (semester) {
                                parts.push(`Semester ${semester}`);
                              }
                              if (blok) {
                                parts.push(blok);
                              }
                              
                              return parts.length > 0
                                ? parts.join(" / ")
                                : "N/A";
                            })()}
                          </td>
                        </>
                      ) : jadwalType === "seminar_pleno" ? (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.topik || "N/A"}
                        </td>
                      ) : jadwalType === "csr" ? (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.topik || "N/A"}
                        </td>
                      ) : jadwalType === "non_blok_non_csr" ? (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.agenda || item.materi || "N/A"}
                        </td>
                      ) : jadwalType === "bimbingan_akhir_sempro" || jadwalType === "bimbingan_akhir_sidang" ? (
                        null
                      ) : (
                        jadwalType !== "pbl" && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {item.materi || item.topik || "N/A"}
                          </td>
                        )
                      )}
                      {jadwalType === "csr" && (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {item.kategori?.nama || "N/A"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                item.jenis_csr === "reguler"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 border border-blue-200 dark:border-blue-700"
                                  : "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200 border border-purple-200 dark:border-purple-700"
                              }`}
                            >
                              {item.jenis_csr === "reguler"
                                ? "CSR Reguler"
                                : "CSR Responsi"}
                            </span>
                          </td>
                        </>
                      )}
                      {/* Kolom JENIS BARIS (Materi/Agenda) badge - hanya untuk non_blok_non_csr yang bukan bimbingan akhir */}
                      {jadwalType === "non_blok_non_csr" && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          <span
                            className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              item.jenis_baris === "materi"
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-700"
                                : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200 border border-orange-200 dark:border-orange-700"
                            }`}
                          >
                            {item.jenis_baris === "materi"
                              ? "Materi"
                              : "Agenda"}
                          </span>
                        </td>
                      )}
                      {jadwalType === "persamaan_persepsi" ||
                      jadwalType === "seminar_pleno" ? (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {item.koordinator_names || "-"}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {item.pengampu_names || "-"}
                          </td>
                        </>
                      ) : jadwalType === "praktikum" ? (
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white align-top">
                          {(() => {
                            const dosenNames = getPengampuNamesArray(item);
                            const isExpanded = expandedPraktikumRows.has(
                              item.id
                            );
                            const maxVisible = 3;

                            if (dosenNames.length === 0) {
                              return "N/A";
                            }

                            if (dosenNames.length <= maxVisible || isExpanded) {
                              return (
                                <span
                                  className={
                                    isExpanded ? "" : "whitespace-nowrap"
                                  }
                                >
                                  {dosenNames.join(", ")}
                                  {isExpanded &&
                                    dosenNames.length > maxVisible && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          const newSet = new Set(
                                            expandedPraktikumRows
                                          );
                                          newSet.delete(item.id);
                                          setExpandedPraktikumRows(newSet);
                                        }}
                                        className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs underline"
                                      >
                                        (sembunyikan)
                                      </button>
                                    )}
                                </span>
                              );
                            }

                            // Tampilkan 3 pertama + link "tampilkan semuanya"
                            const visibleNames = dosenNames.slice(
                              0,
                              maxVisible
                            );
                            const remainingCount =
                              dosenNames.length - maxVisible;

                            return (
                              <span className="whitespace-nowrap">
                                {visibleNames.join(", ")}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const newSet = new Set(
                                      expandedPraktikumRows
                                    );
                                    newSet.add(item.id);
                                    setExpandedPraktikumRows(newSet);
                                  }}
                                  className="ml-2 text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 text-xs underline"
                                >
                                  +{remainingCount} lainnya
                                </button>
                              </span>
                            );
                          })()}
                        </td>
                      ) : jadwalType === "bimbingan_akhir_sempro" ? (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {(() => {
                              // Prioritas 1: Cek dari pembimbing object langsung
                              if (item.pembimbing) {
                                if (item.pembimbing.name) return item.pembimbing.name;
                                if (item.pembimbing.nama) return item.pembimbing.nama;
                              }
                              // Prioritas 2: Cari dari allDosenList menggunakan pembimbing_id
                              if (item.pembimbing_id) {
                                if (Array.isArray(allDosenList) && allDosenList.length > 0) {
                                  const pembimbing = allDosenList.find((d: any) => {
                                    if (!d || !d.id) return false;
                                    return Number(d.id) === Number(item.pembimbing_id) || String(d.id) === String(item.pembimbing_id);
                                  });
                                  if (pembimbing) {
                                    return pembimbing.name || pembimbing.nama || "-";
                                  }
                                }
                              }
                              return "-";
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {(() => {
                              if (item.komentator_list && Array.isArray(item.komentator_list) && item.komentator_list.length > 0) {
                                return item.komentator_list.map((k: any) => k?.name || k?.nama || "-").filter((name: any) => name && name !== "-").join(", ") || "-";
                              }
                              if (item.komentator_ids && Array.isArray(item.komentator_ids) && item.komentator_ids.length > 0) {
                                if (Array.isArray(allDosenList) && allDosenList.length > 0) {
                                  const komentatorNames = allDosenList
                                    .filter((d: any) => d && item.komentator_ids.includes(Number(d.id)))
                                    .map((d: any) => d?.name)
                                    .filter((name: any) => name);
                                  return komentatorNames.length > 0 ? komentatorNames.join(", ") : "-";
                                }
                              }
                              return "-";
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {item.ruangan?.nama || "-"}
                          </td>
                        </>
                      ) : jadwalType === "bimbingan_akhir_sidang" ? (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {(() => {
                              // Prioritas 1: Cek dari pembimbing object langsung
                              if (item.pembimbing) {
                                if (item.pembimbing.name) return item.pembimbing.name;
                                if (item.pembimbing.nama) return item.pembimbing.nama;
                              }
                              // Prioritas 2: Cari dari allDosenList menggunakan pembimbing_id
                              if (item.pembimbing_id) {
                                if (Array.isArray(allDosenList) && allDosenList.length > 0) {
                                  const pembimbing = allDosenList.find((d: any) => {
                                    if (!d || !d.id) return false;
                                    return Number(d.id) === Number(item.pembimbing_id) || String(d.id) === String(item.pembimbing_id);
                                  });
                                  if (pembimbing) {
                                    return pembimbing.name || pembimbing.nama || "-";
                                  }
                                }
                              }
                              return "-";
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {(() => {
                              if (item.penguji_list && Array.isArray(item.penguji_list) && item.penguji_list.length > 0) {
                                return item.penguji_list.map((p: any) => p?.name || p?.nama || "-").filter((name: any) => name && name !== "-").join(", ") || "-";
                              }
                              if (item.penguji_ids && Array.isArray(item.penguji_ids) && item.penguji_ids.length > 0) {
                                if (Array.isArray(allDosenList) && allDosenList.length > 0) {
                                  const pengujiNames = allDosenList
                                    .filter((d: any) => d && (item.penguji_ids.includes(Number(d.id)) || item.penguji_ids.includes(d.id)))
                                    .map((d: any) => d?.name)
                                    .filter((name: any) => name);
                                  return pengujiNames.length > 0 ? pengujiNames.join(", ") : "-";
                                }
                              }
                              return "-";
                            })()}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {item.ruangan?.nama || "-"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {getPengampuName(item, jadwalType)}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {getDosenPenggantiName(item, jadwalType)}
                          </td>
                        </>
                      )}
                      {jadwalType === "kuliah_besar" && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.topik || "N/A"}
                        </td>
                      )}
                      {jadwalType !== "pbl" &&
                        jadwalType !== "jurnal" &&
                        jadwalType !== "persamaan_persepsi" &&
                        jadwalType !== "seminar_pleno" &&
                        jadwalType !== "csr" &&
                        jadwalType !== "non_blok_non_csr" &&
                        jadwalType !== "kuliah_besar" &&
                        jadwalType !== "praktikum" &&
                        jadwalType !== "bimbingan_akhir_sempro" &&
                        jadwalType !== "bimbingan_akhir_sidang" && (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                            {item.topik}
                          </td>
                        )}
                      {(jadwalType === "kuliah_besar" ||
                        jadwalType === "jurnal" ||
                        jadwalType === "seminar_pleno" ||
                        jadwalType === "non_blok_non_csr") && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {jadwalType === "kuliah_besar"
                            ? item.kelompok_besar?.semester
                              ? `Semester ${item.kelompok_besar.semester}`
                              : item.kelompok_besar_antara?.nama_kelompok ||
                                "N/A"
                            : jadwalType === "jurnal"
                            ? item.kelompok_kecil?.nama ||
                              item.kelompok_kecil_antara?.nama_kelompok ||
                              "N/A"
                            : jadwalType === "seminar_pleno"
                            ? item.kelompok_besar_antara?.nama_kelompok ||
                              item.kelompok_besar?.nama_kelompok ||
                              (item.kelompok_besar?.semester
                                ? `Semester ${item.kelompok_besar.semester}`
                                : "N/A")
                            : jadwalType === "non_blok_non_csr"
                            ? item.kelompok_besar?.semester ||
                              item.kelompok_besar_antara?.nama_kelompok ||
                              "N/A"
                            : "N/A"}
                        </td>
                      )}
                      {jadwalType === "csr" && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.kelompok_kecil?.nama || "N/A"}
                        </td>
                      )}
                      {/* Kolom RUANGAN - untuk bimbingan akhir sudah ditangani di kondisi khusus di atas, jadi skip di sini */}
                      {jadwalType !== "bimbingan_akhir_sempro" && jadwalType !== "bimbingan_akhir_sidang" && (
                        jadwalType === "praktikum" ? (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white align-top">
                            {item.ruangan?.nama || "N/A"}
                          </td>
                        ) : (
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white align-top">
                        {jadwalType === "persamaan_persepsi"
                              ? item.use_ruangan && item.ruangan?.nama
                            ? item.ruangan.nama 
                            : "Online"
                          : jadwalType === "seminar_pleno"
                              ? item.use_ruangan && item.ruangan?.nama
                            ? item.ruangan.nama
                            : "Online"
                          : jadwalType === "kuliah_besar" ||
                            jadwalType === "jurnal"
                          ? item.ruangan?.nama || "N/A"
                          : jadwalType === "pbl"
                            ? (typeof item.ruangan === "string" ? item.ruangan : item.ruangan?.nama) || "N/A"
                          : jadwalType === "csr" ||
                            jadwalType === "non_blok_non_csr"
                          ? item.ruangan?.nama || "N/A"
                            : item.lokasi || (typeof item.ruangan === "string" ? item.ruangan : item.ruangan?.nama) || "N/A"}
                      </td>
                        )
                      )}
                      {/* Kolom FILE JURNAL - hanya untuk jurnal */}
                      {jadwalType === "jurnal" && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {item.file_jurnal ? (
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
                                    const fileName =
                                      item.file_jurnal.split("/").pop() ||
                                      "File Jurnal";
                                    return fileName.length > 20
                                      ? fileName.substring(0, 20) + "..."
                                      : fileName;
                                  })()}
                                </p>

                                <p className="text-xs text-gray-500 dark:text-gray-400">
                                  File Jurnal
                                </p>
                              </div>

                              <div className="flex-shrink-0">
                                <a
                                  href={`/api/jurnal-reading/download/${item.mata_kuliah_kode}/${item.id}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:hover:bg-blue-900/30 rounded-md transition-colors duration-200"
                                  title="Download File"
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

                                  <span className="hidden sm:inline">
                                    Download
                                  </span>
                                </a>
                              </div>
                            </div>
                          ) : (
                            <span className="text-gray-400 dark:text-gray-500 text-sm">
                              -
                            </span>
                          )}
                        </td>
                      )}
                      {/* Kolom JENIS SEMESTER - untuk jadwal type tertentu, skip untuk bimbingan akhir */}
                      {!(jadwalType === "bimbingan_akhir_sempro" || jadwalType === "bimbingan_akhir_sidang") && (
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white align-top">
                        {getSemesterTypeBadge(item.semester_type)}
                      </td>
                      )}
                      {/* Kolom AKSI */}
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white align-top">
                        <div className="flex items-center gap-2">
                          {/* Untuk Seminar Proposal dan Sidang Skripsi, jangan tampilkan getStatusBadge karena sudah ada logika khusus */}
                          {!(jadwalType === "bimbingan_akhir_sempro" || jadwalType === "bimbingan_akhir_sidang") && (
                            getStatusBadge(
                            item.status_konfirmasi,
                              item.status_reschedule,
                              jadwalType
                            )
                          )}
                          {/* Untuk Seminar Proposal dan Sidang Skripsi, tampilkan konfirmasi/reschedule jika belum konfirmasi - HANYA untuk pembimbing */}
                          {(jadwalType === "bimbingan_akhir_sempro" || jadwalType === "bimbingan_akhir_sidang") && (
                            <>
                              {/* Tampilkan button konfirmasi/reschedule HANYA jika pembimbing dan belum konfirmasi */}
                              {item.is_pembimbing && item.status_konfirmasi === "belum_konfirmasi" && (
                                <>
                                  <button
                                    onClick={() => openKonfirmasiModal(item)}
                                    className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors mr-1"
                                    title="Konfirmasi Ketersediaan"
                                  >
                                    Konfirmasi
                                  </button>
                                  <button
                                    onClick={() => openRescheduleModal(item)}
                                    className="px-3 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 transition-colors mr-1"
                                    title="Reschedule Jadwal"
                                  >
                                    Reschedule
                                  </button>
                                </>
                              )}
                              {/* Tampilkan status "Menunggu" untuk komentator/penguji HANYA jika pembimbing belum konfirmasi (belum_konfirmasi) */}
                              {(() => {
                                const user = getUser();
                                if (!user) return null;
                                
                                // Cek apakah dosen ini terlibat (komentator atau penguji) tapi bukan pembimbing
                                const isKomentator = (item.komentator_ids && Array.isArray(item.komentator_ids) && item.komentator_ids.includes(Number(user.id))) ||
                                                     (item.komentator_list && Array.isArray(item.komentator_list) && item.komentator_list.some((k: any) => k.id === Number(user.id)));
                                const isPenguji = (item.penguji_ids && Array.isArray(item.penguji_ids) && item.penguji_ids.includes(Number(user.id))) ||
                                                  (item.penguji_list && Array.isArray(item.penguji_list) && item.penguji_list.some((p: any) => p.id === Number(user.id)));
                                
                                const isTerlibatBukanPembimbing = !item.is_pembimbing && (item.is_active_dosen || isKomentator || isPenguji);
                                
                                if (isTerlibatBukanPembimbing && item.status_konfirmasi === "belum_konfirmasi") {
                                  return (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700">
                                      <FontAwesomeIcon icon={faClock} className="w-3 h-3 mr-1" />
                                      Menunggu Konfirmasi Pembimbing
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              {/* Tampilkan badge "Dibatalkan" jika pembimbing sudah konfirmasi "tidak_bisa" */}
                              {item.is_pembimbing && item.status_konfirmasi === "tidak_bisa" && (
                                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700">
                                  <FontAwesomeIcon icon={faTimesCircle} className="w-3 h-3 mr-1" />
                                  Tidak Bisa Mengajar
                                </span>
                              )}
                              {/* Tampilkan badge "Pembimbing Tidak Bisa" untuk komentator/penguji jika pembimbing sudah konfirmasi "tidak_bisa" */}
                              {(() => {
                                const user = getUser();
                                if (!user) return null;
                                
                                // Cek apakah dosen ini terlibat (komentator atau penguji) tapi bukan pembimbing
                                const isKomentator = (item.komentator_ids && Array.isArray(item.komentator_ids) && item.komentator_ids.includes(Number(user.id))) ||
                                                     (item.komentator_list && Array.isArray(item.komentator_list) && item.komentator_list.some((k: any) => k.id === Number(user.id)));
                                const isPenguji = (item.penguji_ids && Array.isArray(item.penguji_ids) && item.penguji_ids.includes(Number(user.id))) ||
                                                  (item.penguji_list && Array.isArray(item.penguji_list) && item.penguji_list.some((p: any) => p.id === Number(user.id)));
                                
                                const isTerlibatBukanPembimbing = !item.is_pembimbing && (item.is_active_dosen || isKomentator || isPenguji);
                                
                                if (isTerlibatBukanPembimbing && item.status_konfirmasi === "tidak_bisa") {
                                  return (
                                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200 border border-red-200 dark:border-red-700">
                                      <FontAwesomeIcon icon={faTimesCircle} className="w-3 h-3 mr-1" />
                                      Pembimbing Tidak Bisa
                                    </span>
                                  );
                                }
                                return null;
                              })()}
                              {/* Tampilkan button Detail jika sudah konfirmasi 'bisa' - untuk semua dosen terlibat */}
                              {item.is_active_dosen && item.status_konfirmasi === "bisa" && (
                                <button
                                  onClick={() => {
                                    if (item.jenis_baris === "seminar_proposal" || item.jenis_baris === "Seminar Proposal") {
                                      navigate(`/bimbingan-akhir/seminar-proposal/${item.id}`);
                                    } else {
                                      navigate(`/bimbingan-akhir/sidang-skripsi/${item.id}`);
                                    }
                                  }}
                                  className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                                  title={item.jenis_baris === "seminar_proposal" || item.jenis_baris === "Seminar Proposal" ? "Detail Seminar Proposal" : "Detail Sidang Skripsi"}
                                >
                                  Detail
                                </button>
                              )}
                            </>
                          )}
                          {/* Persamaan Persepsi dan Seminar Pleno tidak ada button konfirmasi (langsung bisa) */}
                          {jadwalType === "persamaan_persepsi" ||
                          jadwalType === "seminar_pleno" ? (
                            <>
                              {/* Button Absensi hanya muncul jika dosen adalah koordinator */}
                              {(() => {
                                const user = getUser();
                                if (!user) return null;
                                
                                // Cek apakah dosen ini ada di koordinator_ids
                                const koordinatorIds =
                                  item.koordinator_ids || [];
                                const isKoordinator = Array.isArray(
                                  koordinatorIds
                                )
                                  ? koordinatorIds.includes(Number(user.id))
                                  : false;
                                
                                if (isKoordinator) {
                                  // Cek apakah antara berdasarkan semester_type
                                  const isAntara =
                                    item.semester_type === "antara";
                                  
                                  let routePath = "";
                                  if (jadwalType === "persamaan_persepsi") {
                                    routePath = isAntara 
                                      ? `/absensi-persamaan-persepsi-antara/${item.mata_kuliah_kode}/${item.id}`
                                      : `/absensi-persamaan-persepsi/${item.mata_kuliah_kode}/${item.id}`;
                                  } else if (jadwalType === "seminar_pleno") {
                                    routePath = isAntara 
                                      ? `/absensi-seminar-pleno-antara/${item.mata_kuliah_kode}/${item.id}`
                                      : `/absensi-seminar-pleno/${item.mata_kuliah_kode}/${item.id}`;
                                  }
                                  
                                  return (
                                    <button
                                      onClick={() => navigate(routePath)}
                                      className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 rounded transition-colors shrink-0"
                                      title="Buka Absensi"
                                    >
                                      <FontAwesomeIcon
                                        icon={faCheckCircle}
                                        className="w-3.5 h-3.5 shrink-0"
                                      />
                                      <span className="hidden xl:inline whitespace-nowrap">
                                        Absensi
                                      </span>
                                    </button>
                                  );
                                }
                                return null;
                              })()}
                            </>
                          ) : (
                            <>
                              {/* Untuk jadwal lain (bukan bimbingan akhir), tampilkan button konfirmasi jika belum konfirmasi */}
                              {!(jadwalType === "bimbingan_akhir_sempro" || jadwalType === "bimbingan_akhir_sidang") &&
                                item.is_active_dosen &&
                                item.status_konfirmasi ===
                                  "belum_konfirmasi" && (
                                <button
                                  onClick={() => openKonfirmasiModal(item)}
                                  className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                                  title="Konfirmasi Ketersediaan"
                                >
                                  Konfirmasi
                                </button>
                              )}
                              {/* Tampilkan button aksi jika status sudah "bisa" */}
                              {item.is_active_dosen &&
                                item.status_konfirmasi === "bisa" && (
                                <>
                                  {jadwalType === "csr" ? (
                                    <button
                                      onClick={() =>
                                        navigate(
                                          `/absensi-csr/${item.mata_kuliah_kode}/${item.id}`
                                        )
                                      }
                                      className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
                                      title="Absensi CSR"
                                    >
                                      Absensi
                                    </button>
                                  ) : jadwalType === "kuliah_besar" ? (
                                <>
                                  {/* Cek apakah kuliah besar antara berdasarkan semester_type atau semester */}
                                  {(() => {
                                          const isAntara =
                                            item.semester_type === "antara" ||
                                            (item.mata_kuliah &&
                                              item.mata_kuliah.semester ===
                                                "Antara");
                                    if (isAntara) {
                                      return (
                                        <button
                                          onClick={() =>
                                            navigate(
                                              `/absensi-kuliah-besar-antara/${item.mata_kuliah_kode}/${item.id}`
                                            )
                                          }
                                          className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors mr-1"
                                          title="Absensi Kuliah Besar Antara"
                                        >
                                          Absensi
                                        </button>
                                      );
                                    } else {
                                      // Untuk kuliah besar reguler, langsung ke halaman absensi
                                      return (
                                        <button
                                          onClick={() =>
                                            navigate(
                                              `/absensi-kuliah-besar/${item.mata_kuliah_kode}/${item.id}`
                                            )
                                          }
                                          className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors mr-1"
                                          title="Absensi Kuliah Besar"
                                        >
                                          Absensi
                                        </button>
                                      );
                                    }
                                  })()}
                                </>
                              ) : jadwalType === "non_blok_non_csr" ? (
                                <>
                                  <button
                                    onClick={() => {
                                      // Cek apakah non-blok non-CSR antara berdasarkan semester_type atau semester
                                            const isAntara =
                                              item.semester_type === "antara" ||
                                              (item.mata_kuliah &&
                                                item.mata_kuliah.semester ===
                                                  "Antara");
                                      const routePath = isAntara 
                                        ? `/absensi-non-blok-non-csr-antara/${item.mata_kuliah_kode}/${item.id}`
                                        : `/absensi-non-blok-non-csr/${item.mata_kuliah_kode}/${item.id}`;
                                      navigate(routePath);
                                    }}
                                    className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors mr-1"
                                    title="Absensi Non-Blok Non-CSR"
                                  >
                                    Absensi
                                  </button>
                                  <button
                                    onClick={() =>
                                            handlePenilaianClick(
                                              item,
                                              jadwalType
                                            )
                                    }
                                    className={`px-3 py-1 rounded text-xs transition-colors ${
                                      item.penilaian_submitted
                                        ? "bg-gray-500 text-white hover:bg-gray-600"
                                        : "bg-green-500 text-white hover:bg-green-600"
                                    }`}
                                    title={
                                      item.penilaian_submitted
                                        ? "Lihat Penilaian"
                                        : "Penilaian"
                                    }
                                  >
                                    {item.penilaian_submitted
                                      ? "Lihat Penilaian"
                                      : "Penilaian"}
                                  </button>
                                </>
                              ) : jadwalType === "praktikum" ? (
                                  <button
                                    onClick={() => {
                                          navigate(
                                            `/absensi-praktikum/${item.mata_kuliah_kode}/${item.id}`
                                          );
                                    }}
                                        className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
                                    title="Absensi Praktikum"
                                  >
                                    Absensi
                                  </button>
                              ) : jadwalType === "jurnal" ? (
                                <button
                                  onClick={() =>
                                    handlePenilaianClick(item, jadwalType)
                                  }
                                  className={`px-3 py-1 rounded text-xs transition-colors ${
                                    item.penilaian_submitted
                                      ? "bg-gray-500 text-white hover:bg-gray-600"
                                      : "bg-green-500 text-white hover:bg-green-600"
                                  }`}
                                  title={
                                    item.penilaian_submitted
                                      ? "Lihat Penilaian"
                                      : "Penilaian"
                                  }
                                >
                                  {item.penilaian_submitted
                                    ? "Lihat Penilaian"
                                    : "Penilaian"}
                                </button>
                              ) : jadwalType === "pbl" ? (
                                <button
                                  onClick={() =>
                                    handlePenilaianClick(item, jadwalType)
                                  }
                                  className={`px-3 py-1 rounded text-xs transition-colors ${
                                    item.penilaian_submitted
                                      ? "bg-gray-500 text-white hover:bg-gray-600"
                                      : "bg-green-500 text-white hover:bg-green-600"
                                  }`}
                                  title={
                                    item.penilaian_submitted
                                      ? "Lihat Penilaian"
                                      : "Penilaian"
                                  }
                                >
                                  {item.penilaian_submitted
                                    ? "Lihat Penilaian"
                                    : "Penilaian"}
                                </button>
                              ) : null}
                                </>
                              )}
                              {/* Persamaan Persepsi dan Seminar Pleno tidak ada button reschedule (langsung bisa) */}
                              {/* Praktikum tidak ada button reschedule */}
                              {/* Bimbingan Akhir (seminar proposal dan sidang skripsi) sudah ditangani di atas, jangan tampilkan lagi di sini */}
                              {(jadwalType === "pbl" ||
                                jadwalType === "kuliah_besar" ||
                                jadwalType === "agenda_khusus" ||
                                jadwalType === "jurnal" ||
                                jadwalType === "csr" ||
                                (jadwalType === "non_blok_non_csr" && 
                                 item.jenis_baris !== "seminar_proposal" && 
                                 item.jenis_baris !== "sidang_skripsi")) &&
                                item.is_active_dosen &&
                                item.status_konfirmasi ===
                                  "belum_konfirmasi" && (
                                <button
                                  onClick={() => openRescheduleModal(item)}
                                  className="px-3 py-1 bg-orange-500 text-white rounded text-xs hover:bg-orange-600 transition-colors"
                                  title="Ajukan Reschedule"
                                >
                                  Reschedule
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      );
    },
    [
      getSemesterTypeBadge,
      getStatusBadge,
      openKonfirmasiModal,
      handlePenilaianClick,
      openRescheduleModal,
    ]
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="grid grid-cols-12 gap-4 md:gap-6 p-4 md:p-6">
          {/* Header Skeleton */}
          <div className="col-span-12 mb-6">
            <SkeletonHeader />
          </div>

          {/* Today's Schedule Skeleton */}
          <div className="col-span-12 mb-6">
            <SkeletonTodaySchedule />
          </div>

          {/* Notifications Skeleton */}
          <div className="col-span-12 mb-6">
            <SkeletonCard />
          </div>

          {/* Blok Saya Skeleton */}
          <div className="col-span-12 mb-6">
            <SkeletonCard />
          </div>

          {/* Jadwal Tables Skeleton */}
          <div className="col-span-12 mb-6">
            <div className="space-y-6">
              {[1, 2, 3, 4, 5].map((i) => (
                <SkeletonTable key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Filter blok assignments berdasarkan semester yang aktif dan deduplikasi berdasarkan blok
  const filteredBlokAssignments = blokAssignments.filter((blok) => {
    if (activeSemester === "all") return true;
    const matches = blok.semester_type === activeSemester;
    return matches;
  });

  // Tidak perlu deduplikasi karena blok yang sama bisa ada di semester yang berbeda
  const uniqueBlokAssignments = filteredBlokAssignments;

  // Group blok assignments by semester type and semester number
  const groupedBlokAssignments = uniqueBlokAssignments.reduce((acc, blok) => {
    const semesterKey = blok.semester_type;
    if (!acc[semesterKey]) {
      acc[semesterKey] = [];
    }

    // Check if blok with same number already exists in this semester type
    const existingBlokIndex = acc[semesterKey].findIndex(
      (existing) => existing.blok === blok.blok
    );

    if (existingBlokIndex === -1) {
      // If no existing blok with same number, add it
      acc[semesterKey].push({
        ...blok,
        pbl_assignments: [...blok.pbl_assignments],
      });
    } else {
      // If blok with same number exists, merge the pbl_assignments
      acc[semesterKey][existingBlokIndex].pbl_assignments = [
        ...acc[semesterKey][existingBlokIndex].pbl_assignments,
        ...blok.pbl_assignments,
      ];

      // Update total PBL count
      acc[semesterKey][existingBlokIndex].total_pbl =
        acc[semesterKey][existingBlokIndex].pbl_assignments.length;
    }

    return acc;
  }, {} as { [key: string]: BlokAssignment[] });

  // Deduplikasi PBL assignments berdasarkan pbl_id setelah penggabungan blok
  Object.values(groupedBlokAssignments).forEach((semesterBloks) => {
    semesterBloks.forEach((blok) => {
      const uniqueAssignments = blok.pbl_assignments.reduce(
        (acc, assignment) => {
          if (!acc.find((a) => a.pbl_id === assignment.pbl_id)) {
            acc.push(assignment);
          }
          return acc;
        },
        [] as PBLAssignment[]
      );
      blok.pbl_assignments = uniqueAssignments;
      blok.total_pbl = uniqueAssignments.length;
    });
  });

  // Sort blok assignments by blok number for each semester
  Object.keys(groupedBlokAssignments).forEach((semesterKey) => {
    groupedBlokAssignments[semesterKey].sort((a, b) => a.blok - b.blok);
  });

  // Get blok color based on blok number
  const getBlokColor = (blokNumber: number) => {
    switch (blokNumber) {
      case 1:
        return "bg-blue-500";
      case 2:
        return "bg-green-500";
      case 3:
        return "bg-purple-500";
      case 4:
        return "bg-red-500";
      case 5:
        return "bg-yellow-500";
      case 6:
        return "bg-pink-500";
      case 7:
        return "bg-indigo-500";
      case 8:
        return "bg-teal-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="grid grid-cols-12 gap-4 md:gap-6 p-4 md:p-6">
        {/* Page Header */}
        <div className="col-span-12 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <FontAwesomeIcon
                    icon={faGraduationCap}
                    className="text-white text-xl"
                  />
                </div>
                <div>
                  <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                    Dashboard Dosen
                  </h1>
                  <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                    Selamat datang,{" "}
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                      {getUser()?.name}
                    </span>
                    ! Kelola jadwal dan notifikasi Anda di sini.
                  </p>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
                {/* Left side - Status */}
                <div className="flex items-center gap-3">
                  <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-medium bg-green-50 text-green-700 border border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800">
                    <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                    <div className="flex flex-col">
                      <span className="font-semibold">Live Status</span>
                      <span className="text-xs opacity-90">
                        All Services Running
                      </span>
                    </div>
                  </span>
                </div>

                {/* Right side - Time */}
                <div className="flex items-center gap-3 flex-wrap">
                  {/* Real-time Clock with Date */}
                  <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                    <svg
                      className="w-3 h-3 mr-2"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                    </svg>
                    <div className="flex flex-col">
                      <span className="font-semibold">
                        {currentTime.toLocaleTimeString("id-ID", {
                          hour: "2-digit",
                          minute: "2-digit",
                          second: "2-digit",
                          hour12: false,
                        })}
                      </span>
                      <span className="text-xs opacity-90">
                        {currentTime.toLocaleDateString("id-ID", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                          year: "numeric",
                        })}
                      </span>
                    </div>
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Form Gabungan Email Verification + WhatsApp Contact (dibawah header) */}
        {(showEmailWarning || showWhatsAppWarning) && (
          <div className="col-span-12 mb-4">
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4"
            >
              <div className="flex items-start space-x-3">
                <div className="flex-shrink-0">
                  <FontAwesomeIcon
                    icon={faExclamationTriangle}
                    className="w-5 h-5 text-blue-500"
                  />
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-2">
                    Lengkapi Data untuk Notifikasi
                  </h3>
                  <p className="mt-1 text-sm text-blue-700 dark:text-blue-300 mb-4">
                    Silakan lengkapi email dan data WhatsApp untuk menerima
                    notifikasi jadwal melalui email dan WhatsApp. Form ini wajib
                    diisi.
                  </p>

                  {/* Form Gabungan */}
                  <div className="space-y-3">
                    {/* Name (Required, paling atas) */}
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
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        Nama akan digunakan untuk kontak Wablas
                      </p>
                    </div>

                    {/* WhatsApp Phone (Required, di bawah name) */}
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
                            // Realtime sync ke Email untuk Wablas
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
                          Email ini akan digunakan untuk verifikasi dan
                          notifikasi. Email untuk Wablas akan otomatis mengikuti
                          email ini.
                        </p>
                      </div>
                    )}

                    {/* Email untuk Wablas (SELALU read-only, SELALU sync dengan Email Verification) */}
                    <div>
                      <label className="block text-xs font-medium text-blue-800 dark:text-blue-200 mb-1">
                        Email untuk Wablas
                      </label>
                      <input
                        type="email"
                        value={
                          // SELALU sync dengan Email Verification
                          // Jika showEmailWarning, ambil dari newEmail (realtime saat user mengetik)
                          // Jika tidak showEmailWarning, ambil dari emailStatus (email yang sudah verified)
                          showEmailWarning
                            ? newEmail || emailStatus?.email || "" // Ikut ketikan realtime dari Email Verification
                            : emailStatus?.email || "" // Ambil dari email verified yang sudah ada
                        }
                        readOnly={true} // SELALU read-only, tidak bisa diedit manual
                        placeholder="Otomatis sama dengan Email Verification"
                        className="w-full px-3 py-2 text-sm border border-blue-300 dark:border-blue-600 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed placeholder-gray-500 dark:placeholder-gray-400"
                      />
                      <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                        {showEmailWarning
                          ? "Otomatis sync dengan Email Verification di atas (tidak bisa diedit)"
                          : "Menggunakan email verification yang sudah terverifikasi (tidak bisa diedit)"}
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
                          (!showEmailWarning && !emailStatus?.email) // Jika email sudah verified, pastikan ada emailStatus
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
              </div>
            </motion.div>
          </div>
        )}

        {/* Today's Schedule Section moved below Notifications */}

        {/* Notifications Section */}
        <div className="col-span-12 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-red-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <FontAwesomeIcon
                    icon={faBell}
                    className="text-white text-lg"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Notifikasi Terbaru
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {safeNotifications.filter((n) => !n.is_read).length +
                      (praktikumKoordinator.filter(
                        (p) => !p.koordinator_signature
                      ).length > 0
                        ? 1
                        : 0)}{" "}
                    notifikasi belum dibaca
                  </p>
                </div>
              </div>
            </div>

            {/* Notifikasi Koordinator Blok yang belum tanda tangan */}
            {praktikumKoordinator.filter((p) => !p.koordinator_signature)
              .length > 0 && (
              <div
                onClick={() => {
                  // Scroll ke section koordinator blok
                  const koordinatorSection = document.getElementById(
                    "koordinator-blok-section"
                  );
                  if (koordinatorSection) {
                    koordinatorSection.scrollIntoView({
                      behavior: "smooth",
                      block: "start",
                    });
                  }
                }}
                className="mb-4 p-4 rounded-xl border border-orange-200 dark:border-orange-700 bg-orange-50 dark:bg-orange-900/20 cursor-pointer hover:bg-orange-100 dark:hover:bg-orange-900/30 transition-all duration-300 hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 bg-orange-100 dark:bg-orange-900/30">
                    <FontAwesomeIcon
                      icon={faFlask}
                      className="w-5 h-5 text-orange-600 dark:text-orange-400"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Tanda Tangan Koordinator Blok Diperlukan
                      </h4>
                      <span className="w-2 h-2 bg-orange-500 rounded-full flex-shrink-0"></span>
                    </div>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Anda memiliki{" "}
                      {
                        praktikumKoordinator.filter(
                          (p) => !p.koordinator_signature
                        ).length
                      }{" "}
                      praktikum yang memerlukan tanda tangan koordinator blok.
                      Silakan lengkapi tanda tangan Anda.
                    </p>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                        <FontAwesomeIcon
                          icon={faFlask}
                          className="w-3 h-3 mr-1"
                        />
                        Koordinator Blok
                      </span>
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                        <FontAwesomeIcon
                          icon={faCalendar}
                          className="w-3 h-3 mr-1"
                        />
                        Klik untuk lihat detail
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {safeNotifications.length > 0 ? (
              <div className="space-y-4">
                {safeNotifications.slice(0, 5).map((notification) => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 rounded-xl border transition-all duration-300 hover:shadow-md cursor-pointer ${
                      notification.is_read
                        ? "bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-600"
                        : "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700"
                    } ${
                      notification.data?.jadwal_type
                        ? "hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-600"
                        : ""
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          notification.type === "success"
                            ? "bg-green-100 dark:bg-green-900/30"
                            : notification.type === "warning"
                            ? "bg-yellow-100 dark:bg-yellow-900/30"
                            : notification.type === "error"
                            ? "bg-red-100 dark:bg-red-900/30"
                            : "bg-blue-100 dark:bg-blue-900/30"
                        }`}
                      >
                        <FontAwesomeIcon
                          icon={getNotificationIcon(notification)}
                          className={`w-5 h-5 ${
                            notification.type === "success"
                              ? "text-green-600 dark:text-green-400"
                              : notification.type === "warning"
                              ? "text-yellow-600 dark:text-yellow-400"
                              : notification.type === "error"
                              ? "text-red-600 dark:text-red-400"
                              : "text-blue-600 dark:text-blue-400"
                          }`}
                        />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            {notification.title}
                          </h4>
                          {!notification.is_read && (
                            <span className="w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                          {notification.message}
                        </p>
                        {notification.data?.jadwal_type && (
                          <div className="flex items-center gap-2 mb-2">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                              <FontAwesomeIcon
                                icon={faCalendar}
                                className="w-3 h-3 mr-1"
                              />
                              Klik untuk lihat jadwal
                            </span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300">
                              {notification.data?.created_by ||
                                notification.data?.sender_name ||
                                "Sistem"}
                            </span>
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/20 dark:text-gray-300">
                              {notification.data?.created_by_role ||
                                notification.data?.sender_role ||
                                "Admin"}
                            </span>
                          </div>
                        )}
                        {/* Additional info for forum notifications */}
                        {notification.data?.notification_type && (
                          <div className="flex items-center gap-2 mb-2">
                            {notification.data?.category_name && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300">
                                {notification.data.category_name}
                              </span>
                            )}
                            {notification.data?.access_type === "private" && (
                              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300">
                                Private
                              </span>
                            )}
                          </div>
                        )}
                        <span className="text-xs text-gray-500 dark:text-gray-500">
                          {new Date(notification.created_at).toLocaleDateString(
                            "id-ID",
                            {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            }
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FontAwesomeIcon
                    icon={faBell}
                    className="w-8 h-8 text-gray-400"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Tidak Ada Notifikasi
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Anda tidak memiliki notifikasi baru saat ini
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Today's Schedule Section */}
        <div className="col-span-12 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg">
                  <FontAwesomeIcon
                    icon={faCalendar}
                    className="text-white text-lg"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Jadwal Hari Ini
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {currentTime.toLocaleDateString("id-ID", {
                      weekday: "long",
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
            </div>

            {todaySchedule.length > 0 ? (
              <div className="space-y-3">
                {todaySchedule.map((schedule, index) => (
                  <motion.div
                    key={schedule.id || index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-300"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start space-x-4 flex-1">
                        <div className="flex-shrink-0">
                          <div
                            className={`w-11 h-11 rounded-lg flex items-center justify-center shadow-sm ${
                              schedule.type === "kuliah_besar"
                                ? "bg-gradient-to-br from-blue-500 to-blue-600"
                                : schedule.type === "pbl"
                                ? "bg-gradient-to-br from-emerald-500 to-emerald-600"
                                : schedule.type === "praktikum"
                                ? "bg-gradient-to-br from-violet-500 to-violet-600"
                                : schedule.type === "jurnal"
                                ? "bg-gradient-to-br from-indigo-500 to-indigo-600"
                                : schedule.type === "csr"
                                ? "bg-gradient-to-br from-amber-500 to-amber-600"
                                : schedule.type === "non_blok_non_csr"
                                ? "bg-gradient-to-br from-rose-500 to-rose-600"
                                : "bg-gradient-to-br from-gray-500 to-gray-600"
                            }`}
                          >
                            <FontAwesomeIcon
                              icon={
                                schedule.type === "kuliah_besar"
                                  ? faGraduationCap
                                  : schedule.type === "pbl"
                                  ? faBookOpen
                                  : schedule.type === "praktikum"
                                  ? faFlask
                                  : schedule.type === "jurnal"
                                  ? faNewspaper
                                  : schedule.type === "csr"
                                  ? faUsers
                                  : schedule.type === "non_blok_non_csr"
                                  ? faCalendar
                                  : faCalendar
                              }
                              className="text-white text-sm"
                            />
                          </div>
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <h3 className="text-base font-semibold text-gray-900 dark:text-white truncate">
                              {schedule.mata_kuliah}
                            </h3>
                            <span
                              className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${
                                schedule.type === "kuliah_besar"
                                  ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200"
                                  : schedule.type === "pbl"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200"
                                  : schedule.type === "praktikum"
                                  ? "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-200"
                                  : schedule.type === "jurnal"
                                  ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-200"
                                  : schedule.type === "csr"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200"
                                  : schedule.type === "non_blok_non_csr"
                                  ? "bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
                                  : "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-200"
                              }`}
                            >
                              {schedule.type === "kuliah_besar"
                                ? "Kuliah Besar"
                                : schedule.type === "pbl"
                                ? "PBL"
                                : schedule.type === "praktikum"
                                ? "Praktikum"
                                : schedule.type === "jurnal"
                                ? "Jurnal Reading"
                                : schedule.type === "csr"
                                ? "CSR"
                                : schedule.type === "non_blok_non_csr"
                                ? "Non Blok"
                                : schedule.type}
                            </span>
                            {getStatusBadge(
                              schedule.status_konfirmasi,
                              schedule.status_reschedule
                            )}
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-gray-600 dark:text-gray-400">
                            <div className="flex items-center gap-2">
                              <FontAwesomeIcon
                                icon={faClock}
                                className="w-3.5 h-3.5 text-gray-400"
                              />
                              <span className="font-medium">
                                {schedule.waktu.replace(".", ":")}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FontAwesomeIcon
                                icon={faGraduationCap}
                                className="w-3.5 h-3.5 text-gray-400"
                              />
                              <span className="truncate">{schedule.dosen}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              <FontAwesomeIcon
                                icon={faBookOpen}
                                className="w-3.5 h-3.5 text-gray-400"
                              />
                              <span className="truncate">
                                {(() => {
                                  const ruangan = schedule.ruangan;
                                  if (typeof ruangan === "string") return ruangan;
                                  if (ruangan && typeof ruangan === "object" && "nama" in ruangan) {
                                    return (ruangan as { nama: string }).nama;
                                  }
                                  return "N/A";
                                })()}
                              </span>
                            </div>
                            {schedule.topik && (
                              <div className="flex items-center gap-2">
                                <FontAwesomeIcon
                                  icon={faFileAlt}
                                  className="w-3.5 h-3.5 text-gray-400"
                                />
                                <span className="truncate">
                                  {schedule.topik}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <div className="text-right">
                          <div className="text-lg font-semibold text-gray-900 dark:text-white">
                            {schedule.waktu.split(" - ")[0].replace(".", ":")}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {schedule.waktu.split(" - ")[1].replace(".", ":")}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FontAwesomeIcon
                    icon={faCalendar}
                    className="w-8 h-8 text-gray-400"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Tidak Ada Jadwal Hari Ini
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Anda tidak memiliki jadwal mengajar untuk hari ini
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Praktikum Koordinator Signature Section */}
        <div id="koordinator-blok-section" className="col-span-12 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center shadow-lg">
                  <FontAwesomeIcon
                    icon={faFlask}
                    className="text-white text-lg"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                    Tanda Tangan Koordinator Blok
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Praktikum yang memerlukan tanda tangan koordinator
                  </p>
                </div>
              </div>
            </div>

            {praktikumKoordinator.length > 0 ? (
              <div className="space-y-3">
                {praktikumKoordinator.map((praktikum, index) => (
                  <motion.div
                    key={praktikum.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      navigate(`${praktikum.action_url}?tab=dosen`);
                    }}
                    className={`p-4 rounded-lg border cursor-pointer transition-all duration-300 hover:shadow-md ${
                      praktikum.koordinator_signature
                        ? "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800"
                        : "bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800 hover:bg-orange-100 dark:hover:bg-orange-900/30"
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">
                            {praktikum.mata_kuliah_nama}
                          </p>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              praktikum.koordinator_signature
                                ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                            }`}
                          >
                            {praktikum.koordinator_signature
                              ? "✓ Sudah Ditandatangani"
                              : "⏳ Belum Ditandatangani"}
                          </span>
                        </div>
                        <div className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
                          <p>
                            <span className="font-medium">Tanggal:</span>{" "}
                            {new Date(praktikum.tanggal).toLocaleDateString(
                              "id-ID",
                              {
                                weekday: "long",
                                day: "numeric",
                                month: "long",
                                year: "numeric",
                              }
                            )}
                          </p>
                          <p>
                            <span className="font-medium">Waktu:</span>{" "}
                            {praktikum.jam_mulai} - {praktikum.jam_selesai}
                          </p>
                          <p>
                            <span className="font-medium">Ruangan:</span>{" "}
                            {(() => {
                              const ruangan = praktikum.ruangan;
                              if (typeof ruangan === "string") return ruangan;
                              if (ruangan && typeof ruangan === "object" && "nama" in ruangan) {
                                return (ruangan as { nama: string }).nama;
                              }
                              return "N/A";
                            })()}
                          </p>
                          <p>
                            <span className="font-medium">Kelas:</span>{" "}
                            {praktikum.kelas_praktikum}
                          </p>
                          {praktikum.materi && (
                            <p>
                              <span className="font-medium">Materi:</span>{" "}
                              {praktikum.materi}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0 ml-4">
                        <FontAwesomeIcon
                          icon={faChevronRight}
                          className="w-5 h-5 text-gray-400"
                        />
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FontAwesomeIcon
                    icon={faFlask}
                    className="w-8 h-8 text-gray-400"
                  />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Tidak Ada Praktikum yang Memerlukan Tanda Tangan
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  Semua praktikum sudah memiliki tanda tangan koordinator blok
                </p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Blok Saya Section */}
        <div className="col-span-12 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <FontAwesomeIcon
                    icon={faBookOpen}
                    className="text-white text-lg"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Blok Saya
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Kelola assignment modul PBL Anda
                  </p>
                </div>
              </div>
            </div>

            {isBlokMinimized ? (
              <div className="p-8 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border border-yellow-200 dark:border-yellow-800/50">
                <div className="flex items-center justify-center">
                  <div className="text-center">
                    <div className="w-16 h-16 bg-yellow-100 dark:bg-yellow-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FontAwesomeIcon
                        icon={faExclamationTriangle}
                        className="w-8 h-8 text-yellow-600 dark:text-yellow-400"
                      />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                      Blok Saya Sedang Diperbaiki
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Fitur ini sedang dalam tahap pengembangan dan akan segera
                      hadir
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* Filter Semester */}
                <div className="flex items-center gap-4 mb-8 p-6 bg-gray-50 dark:bg-gray-700/50 rounded-xl border border-gray-200 dark:border-gray-600">
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                    Filter Semester:
                  </span>
                  <div className="flex gap-3">
                    <button
                      onClick={() => setActiveSemester("ganjil")}
                      className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                        activeSemester === "ganjil"
                          ? "bg-blue-500 text-white shadow-lg"
                          : "bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-500"
                      }`}
                    >
                      <FontAwesomeIcon
                        icon={faGraduationCap}
                        className="mr-2"
                      />
                      Semester Ganjil
                    </button>
                    <button
                      onClick={() => setActiveSemester("genap")}
                      className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                        activeSemester === "genap"
                          ? "bg-green-500 text-white shadow-lg"
                          : "bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/20 border border-gray-200 dark:border-gray-500"
                      }`}
                    >
                      <FontAwesomeIcon
                        icon={faGraduationCap}
                        className="mr-2"
                      />
                      Semester Genap
                    </button>
                    <button
                      onClick={() => setActiveSemester("all")}
                      className={`px-6 py-3 rounded-xl text-sm font-medium transition-all duration-300 ${
                        activeSemester === "all"
                          ? "bg-purple-500 text-white shadow-lg"
                          : "bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-gray-200 dark:border-gray-500"
                      }`}
                    >
                      <FontAwesomeIcon icon={faEye} className="mr-2" />
                      Semua Semester
                    </button>
                  </div>
                </div>

                {/* Loading State for Blok */}
                {loadingBlok ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {[1, 2, 3, 4].map((i) => (
                      <SkeletonCard key={i} />
                    ))}
                  </div>
                ) : (
                  <>
                    {/* Render Blok Assignments */}
                    {Object.entries(groupedBlokAssignments).map(
                      ([semesterType, bloks]) => (
                        <div key={semesterType} className="mb-6">
                          <div className="flex items-center gap-3 mb-4">
                            <div
                              className={`w-6 h-6 rounded-lg ${
                                semesterType === "ganjil"
                                  ? "bg-blue-500"
                                  : "bg-green-500"
                              } flex items-center justify-center`}
                            >
                              <FontAwesomeIcon
                                icon={faGraduationCap}
                                className="text-white text-xs"
                              />
                            </div>
                            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                              Semester{" "}
                              {semesterType.charAt(0).toUpperCase() +
                                semesterType.slice(1)}
                            </h3>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {bloks.map((blok) => (
                              <div
                                key={`${semesterType}-${blok.blok}`}
                                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden hover:shadow-md transition-all duration-300"
                              >
                                <div
                                  className={`h-2 ${getBlokColor(blok.blok)}`}
                                ></div>

                                <div className="p-6">
                                  <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-3">
                                      <div
                                        className={`w-12 h-12 rounded-2xl ${getBlokColor(
                                          blok.blok
                                        )} flex items-center justify-center text-white font-bold text-lg shadow-lg`}
                                      >
                                        {blok.blok}
                                      </div>
                                      <div>
                                        <h4 className="font-semibold text-gray-900 dark:text-white">
                                          Blok {blok.blok}
                                        </h4>
                                        <p className="text-sm text-gray-600 dark:text-gray-400">
                                          {blok.total_pbl} Modul PBL
                                        </p>
                                      </div>
                                    </div>
                                    <button
                                      onClick={() =>
                                        setExpandedBlok(
                                          expandedBlok === blok.blok
                                            ? null
                                            : blok.blok
                                        )
                                      }
                                      className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
                                    >
                                      <FontAwesomeIcon
                                        icon={
                                          expandedBlok === blok.blok
                                            ? faChevronUp
                                            : faChevronDown
                                        }
                                        className="w-4 h-4 text-gray-600 dark:text-gray-400"
                                      />
                                    </button>
                                  </div>

                                  <div className="space-y-3">
                                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                      <div className="flex justify-between items-center mb-2">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                          Peran Dosen
                                        </span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                          {(() => {
                                            const peranCounts: {
                                              [key: string]: number;
                                            } = {};
                                            blok.pbl_assignments.forEach(
                                              (assignment) => {
                                                const peran =
                                                  assignment.peran_display ||
                                                  assignment.tipe_peran ||
                                                  "Dosen Mengajar";
                                                peranCounts[peran] =
                                                  (peranCounts[peran] || 0) + 1;
                                              }
                                            );
                                            return Object.entries(peranCounts)
                                              .map(
                                                ([peran, count]) =>
                                                  `${peran} (${count})`
                                              )
                                              .join(", ");
                                          })()}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-3">
                                      <div className="flex justify-between items-center">
                                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                          Durasi Total
                                        </span>
                                        <span className="text-sm font-semibold text-gray-900 dark:text-white">
                                          {(() => {
                                            // Hitung durasi total dari semua modul
                                            const totalDurasi =
                                              blok.pbl_assignments.reduce(
                                                (total, assignment) => {
                                                  const durasi =
                                                    assignment.durasi_modul ||
                                                    assignment.durasi ||
                                                    "2 Minggu";
                                                  const durasiNumber =
                                                    parseInt(
                                                      durasi.replace(/\D/g, "")
                                                    ) || 2;
                                                  return total + durasiNumber;
                                                },
                                                0
                                              );
                                            return `${totalDurasi} Minggu`;
                                          })()}
                                        </span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )
                    )}

                    {/* Empty State */}
                    {Object.keys(groupedBlokAssignments).length === 0 && (
                      <div className="text-center py-12">
                        <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                          <FontAwesomeIcon
                            icon={faBookOpen}
                            className="text-4xl text-gray-400"
                          />
                        </div>
                        <h4 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                          Belum Ada Assignment Modul PBL
                        </h4>
                        <p className="text-gray-600 dark:text-gray-400 mb-4">
                          Anda belum memiliki assignment Modul PBL untuk
                          semester yang dipilih. Assignment akan muncul setelah
                          admin melakukan generate PBL.
                        </p>
                        <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900/40 text-blue-800 dark:text-blue-200 rounded-lg">
                          <FontAwesomeIcon
                            icon={faInfoCircle}
                            className="text-blue-500"
                          />
                          <span className="text-sm font-medium">
                            Menunggu Assignment
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </motion.div>
        </div>

        {/* Expandable PBL Detail Section */}

        <div className="col-span-12 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="mt-6 bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
          >
            <div className="p-6 border-b border-gray-200 dark:border-gray-700 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center ${getBlokColor(
                      expandedBlok
                    )} text-white font-bold`}
                  >
                    {expandedBlok}
                  </div>
                  Detail Blok {expandedBlok}
                </h3>
                <button
                  onClick={() => setExpandedBlok(null)}
                  className="p-2 hover:bg-white/50 dark:hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <FontAwesomeIcon
                    icon={faTimes}
                    className="w-4 h-4 text-gray-600 dark:text-gray-400"
                  />
                </button>
              </div>
            </div>

            {/* PBL Detail Content */}
            <div className="p-6">
              {(() => {
                // Find the blok assignment data for the expanded blok from grouped data

                // Cari dari groupedBlokAssignments terlebih dahulu
                let blokData = Object.values(groupedBlokAssignments)
                  .flat()
                  .find((blok) => blok.blok === expandedBlok);

                // Fallback: cari dari blokAssignments asli jika tidak ditemukan
                if (!blokData) {
                  blokData = blokAssignments.find(
                    (blok) => blok.blok === expandedBlok
                  );
                }

                // Jika masih tidak ditemukan, coba cari dengan struktur data yang berbeda
                if (!blokData) {
                  blokData = blokAssignments.find(
                    (blok) =>
                      blok.blok === expandedBlok ||
                      (typeof blok.blok === "string" &&
                        parseInt(blok.blok) === expandedBlok)
                  );
                }

                if (blokData) {
                  return (
                    <div className="space-y-6">
                      {/* Mata Kuliah Info */}
                      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-blue-500 flex items-center justify-center">
                            <FontAwesomeIcon
                              icon={faBookOpen}
                              className="text-white text-lg"
                            />
                          </div>
                          Modul PBL yang Ditugaskan
                        </h4>

                        <div className="grid gap-4">
                          {blokData.pbl_assignments &&
                          blokData.pbl_assignments.length > 0 ? (
                            blokData.pbl_assignments.map(
                              (assignment, index) => (
                                <div
                                  key={assignment.pbl_id || index}
                                  className="bg-white dark:bg-gray-800 rounded-lg p-4 shadow-sm border border-blue-100 dark:border-blue-800"
                                >
                                  <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                      <div className="flex items-center gap-2 mb-2">
                                        <span className="text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/50 px-2 py-1 rounded">
                                          Modul{" "}
                                          {assignment.modul_ke ||
                                            assignment.pertemuan_ke ||
                                            index + 1}
                                        </span>
                                        <span className="text-sm text-gray-600 dark:text-gray-400">
                                          {assignment.mata_kuliah_kode ||
                                            blokData.mata_kuliah?.kode ||
                                            "N/A"}
                                        </span>
                                      </div>
                                      <h5 className="font-medium text-gray-900 dark:text-white mb-1">
                                        {assignment.nama_modul ||
                                          assignment.modul ||
                                          "N/A"}
                                      </h5>
                                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                                        {assignment.nama_mata_kuliah ||
                                          blokData.mata_kuliah?.nama ||
                                          "N/A"}
                                      </p>
                                      <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                                        <span>
                                          Durasi:{" "}
                                          {assignment.durasi_modul ||
                                            assignment.durasi ||
                                            "N/A"}
                                        </span>
                                        <span>
                                          Semester: {blokData.semester || "N/A"}
                                        </span>
                                        <span>
                                          Periode:{" "}
                                          {blokData.mata_kuliah?.periode ||
                                            "N/A"}
                                        </span>
                                        <span>
                                          Peran:{" "}
                                          {assignment.peran_display ||
                                            assignment.tipe_peran ||
                                            "Dosen Mengajar"}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="flex items-center gap-2">
                                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                                        <FontAwesomeIcon
                                          icon={faBookOpen}
                                          className="w-3 h-3 mr-1"
                                        />
                                        {assignment.peran_display ||
                                          assignment.tipe_peran ||
                                          "Dosen Mengajar"}
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              )
                            )
                          ) : (
                            <div className="text-center py-8">
                              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                                <FontAwesomeIcon
                                  icon={faBookOpen}
                                  className="w-8 h-8 text-gray-400"
                                />
                              </div>
                              <p className="text-gray-500 dark:text-gray-400">
                                Tidak ada assignment untuk blok ini
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                } else {
                  return (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FontAwesomeIcon
                          icon={faInfoCircle}
                          className="w-8 h-8 text-gray-400"
                        />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400">
                        <FontAwesomeIcon icon={faInfoCircle} className="mr-2" />
                        <span className="text-sm font-medium">
                          Tidak Ada Assignment Modul PBL
                        </span>
                      </p>
                    </div>
                  );
                }
              })()}
            </div>
          </motion.div>
        </div>

        {/* Jadwal Tables */}
        <div id="jadwal-konfirmasi-section" className="col-span-12 mb-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <FontAwesomeIcon
                    icon={faCalendar}
                    className="text-white text-lg"
                  />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                    Jadwal & Konfirmasi
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Kelola jadwal dan konfirmasi ketersediaan Anda
                  </p>
                </div>
              </div>

              {/* Semester Type Filter */}
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                  Filter Semester:
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveSemesterType("reguler")}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      activeSemesterType === "reguler"
                        ? "bg-blue-500 text-white shadow-lg"
                        : "bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 border border-gray-200 dark:border-gray-500"
                    }`}
                  >
                    <FontAwesomeIcon icon={faGraduationCap} className="mr-2" />
                    Reguler
                  </button>
                  <button
                    onClick={() => setActiveSemesterType("antara")}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      activeSemesterType === "antara"
                        ? "bg-green-500 text-white shadow-lg"
                        : "bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-400 hover:bg-green-50 dark:hover:bg-green-900/20 border border-gray-200 dark:border-gray-500"
                    }`}
                  >
                    <FontAwesomeIcon icon={faGraduationCap} className="mr-2" />
                    Antara
                  </button>
                  <button
                    onClick={() => setActiveSemesterType("all")}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all duration-300 ${
                      activeSemesterType === "all"
                        ? "bg-purple-500 text-white shadow-lg"
                        : "bg-white dark:bg-gray-600 text-gray-600 dark:text-gray-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 border border-gray-200 dark:border-gray-500"
                    }`}
                  >
                    <FontAwesomeIcon icon={faEye} className="mr-2" />
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
                transition={{ delay: 0.4 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {renderJadwalTable(
                  "PBL (Problem Based Learning)",
                  faBookOpen,
                  jadwalPBL,
                  [
                    "NO",
                    "HARI/TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "TIPE PBL",
                    "KELOMPOK",
                    "MODUL",
                    "PENGAMPU",
                    "DOSEN PENGGANTI",
                    "RUANGAN",
                    "JENIS SEMESTER",
                    "AKSI",
                  ],
                  "pbl",
                  "Tidak ada data PBL"
                )}
              </motion.div>

              {/* Kuliah Besar */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {renderJadwalTable(
                  "Kuliah Besar",
                  faGraduationCap,
                  jadwalKuliahBesar,
                  [
                    "NO",
                    "HARI/TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "MATERI",
                    "PENGAMPU",
                    "DOSEN PENGGANTI",
                    "TOPIK",
                    "KELOMPOK",
                    "LOKASI",
                    "JENIS SEMESTER",
                    "AKSI",
                  ],
                  "kuliah_besar",
                  "Tidak ada data Kuliah Besar"
                )}
              </motion.div>

              {/* Seminar Pleno */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.55 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {renderJadwalTable(
                  "Seminar Pleno",
                  faUsers,
                  jadwalSeminarPleno,
                  [
                    "NO",
                    "HARI/TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "TOPIK",
                    "KOORDINATOR DOSEN",
                    "PENGAMPU",
                    "KELOMPOK BESAR",
                    "LOKASI",
                    "JENIS SEMESTER",
                    "AKSI",
                  ],
                  "seminar_pleno",
                  "Tidak ada data Seminar Pleno"
                )}
              </motion.div>

              {/* Praktikum - Hanya tampil untuk semester reguler */}
              {activeSemesterType !== "antara" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {renderJadwalTable(
                    "Praktikum",
                    faFlask,
                    jadwalPraktikum,
                    [
                      "NO",
                      "HARI/TANGGAL",
                      "PUKUL",
                      "KELAS",
                      "WAKTU",
                      "MATERI",
                      "TOPIK",
                      "PENGAMPU",
                      "RUANGAN",
                      "JENIS SEMESTER",
                      "AKSI",
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
                transition={{ delay: 0.7 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {renderJadwalTable(
                  "Jurnal Reading",
                  faNewspaper,
                  jadwalJurnalReading,
                  [
                    "NO",
                    "HARI/TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "TOPIK",
                    "PENGAMPU",
                    "DOSEN PENGGANTI",
                    "KELOMPOK",
                    "LOKASI",
                    "FILE JURNAL",
                    "JENIS SEMESTER",
                    "AKSI",
                  ],
                  "jurnal",
                  "Tidak ada data Jurnal Reading"
                )}
              </motion.div>

              {/* Persamaan Persepsi */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.75 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {renderJadwalTable(
                  "Persamaan Persepsi",
                  faUsers,
                  jadwalPersamaanPersepsi,
                  [
                    "NO",
                    "HARI/TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "TOPIK",
                    "SEMESTER/BLOK",
                    "KOORDINATOR DOSEN",
                    "PENGAMPU",
                    "LOKASI",
                    "JENIS SEMESTER",
                    "AKSI",
                  ],
                  "persamaan_persepsi",
                  "Tidak ada data Persamaan Persepsi"
                )}
              </motion.div>

              {/* Jadwal CSR - Hanya tampil di semester reguler */}
              {activeSemesterType !== "antara" && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.85 }}
                  className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
                >
                  {renderJadwalTable(
                    "CSR (Community Service Learning)",
                    faUsers,
                    jadwalCSR,
                    [
                      "NO",
                      "HARI/TANGGAL",
                      "PUKUL",
                      "WAKTU",
                      "TOPIK",
                      "KATEGORI",
                      "JENIS CSR",
                      "PENGAMPU",
                      "DOSEN PENGGANTI",
                      "KELOMPOK",
                      "LOKASI",
                      "JENIS SEMESTER",
                      "AKSI",
                    ],
                    "csr",
                    "Tidak ada data CSR"
                  )}
                </motion.div>
              )}

              {/* Bimbingan Akhir Section - Hanya tampilkan jika ada data */}
              {Array.isArray(jadwalBimbinganAkhir) && jadwalBimbinganAkhir.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.9 }}
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
                        Array.isArray(jadwalBimbinganAkhir) 
                          ? jadwalBimbinganAkhir.filter(
                              (item: any) => item?.jenis_baris === "seminar_proposal"
                            )
                          : [],
                        [
                          "NO",
                          "HARI/TANGGAL",
                          "PUKUL",
                          "WAKTU",
                          "PEMBIMBING",
                          "KOMENTATOR",
                          "RUANGAN",
                          "AKSI",
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
                        Array.isArray(jadwalBimbinganAkhir)
                          ? jadwalBimbinganAkhir.filter(
                              (item: any) => item?.jenis_baris === "sidang_skripsi"
                            )
                          : [],
                        [
                          "NO",
                          "HARI/TANGGAL",
                          "PUKUL",
                          "WAKTU",
                          "PEMBIMBING",
                          "PENGUJI",
                          "RUANGAN",
                          "AKSI",
                        ],
                        "bimbingan_akhir_sidang",
                        "Tidak ada data Sidang Skripsi"
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Jadwal Non Blok Non CSR */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {renderJadwalTable(
                  "Non Blok Non CSR",
                  faFileAlt,
                  jadwalNonBlokNonCSR,
                  [
                    "NO",
                    "HARI/TANGGAL",
                    "PUKUL",
                    "WAKTU",
                    "MATERI/AGENDA",
                    "JENIS",
                    "PENGAMPU",
                    "DOSEN PENGGANTI",
                    "KELOMPOK",
                    "LOKASI",
                    "JENIS SEMESTER",
                    "AKSI",
                  ],
                  "non_blok_non_csr",
                  "Tidak ada data Non Blok Non CSR"
                )}
              </motion.div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Modal Konfirmasi */}
      <AnimatePresence>
        {showKonfirmasiModal && selectedJadwal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowKonfirmasiModal(false)}
            />

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
                onClick={() => setShowKonfirmasiModal(false)}
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
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center shadow-lg">
                      <FontAwesomeIcon
                        icon={faCheckCircle}
                        className="w-6 h-6 text-blue-600 dark:text-blue-400"
                      />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                        Konfirmasi Ketersediaan
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Silakan konfirmasi ketersediaan Anda
                      </p>
                    </div>
                  </div>
                </div>

                {/* Jadwal Info Card */}
                <div className="mb-6 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border border-blue-200 dark:border-blue-700 rounded-2xl">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-blue-500 rounded-xl flex items-center justify-center">
                      <FontAwesomeIcon
                        icon={faCalendar}
                        className="w-5 h-5 text-white"
                      />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Detail Jadwal
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Materi
                        </span>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {selectedJadwal.materi ||
                            selectedJadwal.topik ||
                            selectedJadwal.agenda ||
                            "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tanggal
                        </span>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {selectedJadwal.tanggal}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Waktu
                        </span>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {selectedJadwal.jam_mulai} -{" "}
                          {selectedJadwal.jam_selesai}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Lokasi
                        </span>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {selectedJadwal.ruangan?.nama ||
                            selectedJadwal.lokasi ||
                            "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Selection */}
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                      Status Ketersediaan
                    </label>
                    {selectedStatus && (
                      <span className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded-full">
                        {selectedStatus === "bisa"
                          ? "Bisa Mengajar"
                          : "Tidak Bisa Mengajar"}
                      </span>
                    )}
                  </div>

                  <div className="space-y-3">
                    <label
                      className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        selectedStatus === "bisa"
                          ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                      onClick={() => setSelectedStatus("bisa")}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 ${
                          selectedStatus === "bisa"
                            ? "bg-green-500 border-green-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {selectedStatus === "bisa" && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <input
                        type="radio"
                        name="status"
                        value="bisa"
                        checked={selectedStatus === "bisa"}
                        onChange={(e) =>
                          setSelectedStatus(e.target.value as "bisa")
                        }
                        className="sr-only"
                      />
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon
                            icon={faCheckCircle}
                            className="w-5 h-5 text-green-600 dark:text-green-400"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Bisa Mengajar
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Saya siap mengajar pada jadwal ini
                          </p>
                        </div>
                      </div>
                    </label>

                    <label
                      className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        selectedStatus === "tidak_bisa"
                          ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                      onClick={() => setSelectedStatus("tidak_bisa")}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 ${
                          selectedStatus === "tidak_bisa"
                            ? "bg-red-500 border-red-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {selectedStatus === "tidak_bisa" && (
                          <svg
                            className="w-3 h-3 text-white"
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        )}
                      </div>
                      <input
                        type="radio"
                        name="status"
                        value="tidak_bisa"
                        checked={selectedStatus === "tidak_bisa"}
                        onChange={(e) =>
                          setSelectedStatus(e.target.value as "tidak_bisa")
                        }
                        className="sr-only"
                      />
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon
                            icon={faTimesCircle}
                            className="w-5 h-5 text-red-600 dark:text-red-400"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Tidak Bisa Mengajar
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Saya tidak bisa mengajar pada jadwal ini
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Alasan Selection */}
                {selectedStatus === "tidak_bisa" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="mb-6"
                  >
                    <div className="flex items-center space-x-2 mb-4">
                      <div className="w-8 h-8 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon
                          icon={faExclamationTriangle}
                          className="w-4 h-4 text-orange-600 dark:text-orange-400"
                        />
                      </div>
                      <h4 className="text-sm font-semibold text-gray-700 dark:text-gray-300">
                        Alasan Tidak Bisa
                      </h4>
                    </div>

                    <div className="space-y-3">
                      {[
                        { value: "sakit", label: "A. Sakit", icon: "🏥" },
                        {
                          value: "acara_keluarga",
                          label: "B. Acara Keluarga",
                          icon: "👨‍👩‍👧‍👦",
                        },
                        {
                          value: "konflik_jadwal",
                          label: "C. Konflik Jadwal",
                          icon: "⏰",
                        },
                        { value: "custom", label: "D. Lainnya", icon: "📝" },
                      ].map((option) => (
                        <label
                          key={option.value}
                          className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                            selectedAlasan === option.value
                              ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600"
                              : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                          }`}
                        >
                          <div
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-3 ${
                              selectedAlasan === option.value
                                ? "bg-blue-500 border-blue-500"
                                : "border-gray-300 dark:border-gray-600"
                            }`}
                          >
                            {selectedAlasan === option.value && (
                              <svg
                                className="w-2.5 h-2.5 text-white"
                                fill="currentColor"
                                viewBox="0 0 20 20"
                              >
                                <path
                                  fillRule="evenodd"
                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                  clipRule="evenodd"
                                />
                              </svg>
                            )}
                          </div>
                          <input
                            type="radio"
                            name="alasan"
                            value={option.value}
                            checked={selectedAlasan === option.value}
                            onChange={(e) => setSelectedAlasan(e.target.value)}
                            className="sr-only"
                          />
                          <span className="text-2xl mr-3">{option.icon}</span>
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            {option.label}
                          </span>
                        </label>
                      ))}

                      {selectedAlasan === "custom" && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700"
                        >
                          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-2">
                            Jelaskan alasan Anda
                          </label>
                          <textarea
                            value={customAlasan}
                            onChange={(e) => setCustomAlasan(e.target.value)}
                            placeholder="Tuliskan alasan tidak bisa mengajar secara detail..."
                            className="w-full p-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-600 focus:border-transparent transition-colors resize-none"
                            rows={3}
                          />
                        </motion.div>
                      )}
                    </div>
                  </motion.div>
                )}

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-2 relative z-20">
                  <button
                    onClick={() => setShowKonfirmasiModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSubmitKonfirmasi}
                    disabled={
                      !selectedStatus ||
                      (selectedStatus === "tidak_bisa" && !selectedAlasan)
                    }
                    className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium shadow-lg hover:bg-blue-600 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <FontAwesomeIcon icon={faCheckCircle} className="w-4 h-4" />
                    <span>Konfirmasi</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Reschedule */}
      <AnimatePresence>
        {showRescheduleModal && selectedJadwal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowRescheduleModal(false)}
            />

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
                onClick={() => setShowRescheduleModal(false)}
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
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/30 rounded-2xl flex items-center justify-center shadow-lg">
                      <FontAwesomeIcon
                        icon={faCalendarAlt}
                        className="w-6 h-6 text-orange-600 dark:text-orange-400"
                      />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                        Ajukan Reschedule
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Berikan alasan untuk mengubah jadwal
                      </p>
                    </div>
                  </div>
                </div>

                {/* Jadwal Info Card */}
                <div className="mb-6 p-6 bg-gradient-to-r from-orange-50 to-yellow-50 dark:from-orange-900/20 dark:to-yellow-900/20 border border-orange-200 dark:border-orange-700 rounded-2xl">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-10 h-10 bg-orange-500 rounded-xl flex items-center justify-center">
                      <FontAwesomeIcon
                        icon={faCalendar}
                        className="w-5 h-5 text-white"
                      />
                    </div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Detail Jadwal
                    </h4>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Materi
                        </span>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {selectedJadwal.materi ||
                            selectedJadwal.topik ||
                            selectedJadwal.agenda ||
                            "N/A"}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Tanggal
                        </span>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {selectedJadwal.tanggal}
                        </p>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Waktu
                        </span>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {selectedJadwal.jam_mulai} -{" "}
                          {selectedJadwal.jam_selesai}
                        </p>
                      </div>
                      <div>
                        <span className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Lokasi
                        </span>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white mt-1">
                          {selectedJadwal.ruangan?.nama ||
                            selectedJadwal.lokasi ||
                            "N/A"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Reschedule Reason */}
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Alasan Reschedule
                  </label>
                  <textarea
                    value={rescheduleReason}
                    onChange={(e) => setRescheduleReason(e.target.value)}
                    placeholder="Jelaskan alasan mengapa jadwal ini perlu diubah..."
                    className="w-full p-4 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-600 focus:border-transparent transition-colors resize-none"
                    rows={4}
                  />
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-2 relative z-20">
                  <button
                    onClick={() => setShowRescheduleModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSubmitReschedule}
                    disabled={!rescheduleReason.trim()}
                    className="px-4 py-2 rounded-lg bg-orange-500 text-white text-sm font-medium shadow-lg hover:bg-orange-600 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <FontAwesomeIcon icon={faCalendarAlt} className="w-4 h-4" />
                    <span>Ajukan Reschedule</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => {
                localStorage.removeItem("last_success_action");
                setShowSuccessModal(false);
              }}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  localStorage.removeItem("last_success_action");
                  setShowSuccessModal(false);
                }}
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

              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    className="w-8 h-8 text-green-600 dark:text-green-400"
                  />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  {localStorage.getItem("last_success_action") ===
                  "whatsapp_sync"
                    ? "Data WhatsApp Berhasil Disinkronkan!"
                    : "Email Berhasil Diaktifkan!"}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {localStorage.getItem("last_success_action") ===
                  "whatsapp_sync"
                    ? "Data WhatsApp Anda telah berhasil disinkronkan ke Wablas. Anda akan menerima notifikasi jadwal melalui WhatsApp dan melalui Email."
                    : "Email Anda telah berhasil diaktifkan. Anda akan menerima notifikasi pengingat jadwal melalui Email."}
                </p>
                <button
                  onClick={() => {
                    localStorage.removeItem("last_success_action");
                    setShowSuccessModal(false);
                  }}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Error Modal */}
      <AnimatePresence>
        {showErrorModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowErrorModal(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowErrorModal(false)}
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

              <div className="text-center">
                <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FontAwesomeIcon
                    icon={faTimesCircle}
                    className="w-8 h-8 text-red-600 dark:text-red-400"
                  />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Gagal Menyimpan Data
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  {errorMessage}
                </p>
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
