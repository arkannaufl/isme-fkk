import React, { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  faCheck,
  faBell,
  faInfoCircle,
  faExclamationTriangle,
  faCheckCircle,
  faTimesCircle,
  faClock,
  faUser,
  faCog,
  faUserPlus,
  faRedo,
  faComments,
  faComment,
  faReply,
  faFolderPlus,
  faTrash,
  faSearch,
  faTimes,
  faEye,
  faUsers,
} from "@fortawesome/free-solid-svg-icons";
import api from "../utils/api";

interface Notification {
  id: number;
  user_name: string;
  user_id: number;
  user_role: string;
  user_type: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  read_status: string;
  read_time: string;
  time_since_read: string;
  created_time: string;
  created_time_ago: string;
  data?: {
    sender_name?: string;
    sender_role?: string;
    dosen_name?: string;
    dosen_role?: string;
    jadwal_id?: number;
    jadwal_type?: string;
    mata_kuliah?: string;
    tanggal?: string;
    waktu?: string;
    ruangan?: string;
    status_konfirmasi?: string;
    alasan?: string;
    // Forum notification data
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
    [key: string]: any;
  };
}

interface NotificationStats {
  total_notifications: number;
  read_notifications: number;
  unread_notifications: number;
  read_rate_percentage: number;
  recent_notifications: number;
  recent_reads: number;
  user_type_breakdown: {
    dosen: number;
    mahasiswa: number;
  };
  confirmation_breakdown: {
    bisa_mengajar: number;
    tidak_bisa_mengajar: number;
    total_confirmations: number;
  };
  last_7_days: {
    notifications_sent: number;
    notifications_read: number;
  };
}

const AdminNotifications: React.FC = () => {
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
    }
  };

  // Add hide-scroll CSS
  React.useEffect(() => {
    const style = document.createElement("style");
    style.textContent = `
      .hide-scroll {
        scrollbar-width: none;
        -ms-overflow-style: none;
      }
      .hide-scroll::-webkit-scrollbar {
        display: none;
      }
    `;
    document.head.appendChild(style);
    return () => {
      if (document.head.contains(style)) {
        document.head.removeChild(style);
      }
    };
  }, []);

  // Get user role from localStorage
  const [userRole, setUserRole] = useState<string>("");

  React.useEffect(() => {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setUserRole(user.role || "");
  }, []);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotificationStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "read" | "unread">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [userTypeFilter, setUserTypeFilter] = useState<
    "my_notifications" | "dosen" | "mahasiswa"
  >("my_notifications");
  const [notificationTypeFilter, setNotificationTypeFilter] = useState<
    "all" | "confirmation" | "assignment" | "other"
  >("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Cache status_konfirmasi terbaru per jadwal (fallback setelah reschedule)
  const [jadwalStatusMap, setJadwalStatusMap] = useState<
    Record<string, string>
  >({});
  // Note: jadwalDetailMap dihapus karena prefetchJadwalStatuses sudah di-disable
  // Logika "Kelola" button sekarang tidak bergantung pada jadwalDetailMap

  // Reminder notification state
  const [isSendingReminder, setIsSendingReminder] = useState(false);
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [pendingDosenList, setPendingDosenList] = useState<any[]>([]);
  const [loadingPendingDosen, setLoadingPendingDosen] = useState(false);
  const [pendingDosenPage, setPendingDosenPage] = useState(1);
  const [pendingDosenPageSize] = useState(10);
  const [pendingDosenTotal, setPendingDosenTotal] = useState(0);
  const [pendingDosenSemester, setPendingDosenSemester] = useState<string>("");
  const [pendingDosenBlok, setPendingDosenBlok] = useState<string>("");
  const [pendingDosenReminderType, setPendingDosenReminderType] =
    useState<string>("all");
  // PERBAIKAN: Tambahkan state untuk filter jadwal type dan search
  const [pendingDosenJadwalType, setPendingDosenJadwalType] = useState<string>("");
  const [pendingDosenSearchQuery, setPendingDosenSearchQuery] = useState<string>("");
  // Selected dosen for reminder (Set of dosen keys: `${jadwal_id}_${dosen_id}`)
  const [selectedReminderDosen, setSelectedReminderDosen] = useState<
    Set<string>
  >(new Set());

  // Success modal state for reminder
  const [showReminderSuccessModal, setShowReminderSuccessModal] =
    useState(false);
  const [reminderSuccessMessage, setReminderSuccessMessage] = useState("");

  // Reset notification modal state
  const [showResetModal, setShowResetModal] = useState(false);
  const [showResetConfirmModal, setShowResetConfirmModal] = useState(false);
  const [resetScope, setResetScope] = useState<"all" | "dosen" | "mahasiswa">(
    "all"
  );
  const [isResetting, setIsResetting] = useState(false);

  // Mahasiswa list modal state
  const [showMahasiswaModal, setShowMahasiswaModal] = useState(false);
  const [mahasiswaList, setMahasiswaList] = useState<any[]>([]);
  const [loadingMahasiswa, setLoadingMahasiswa] = useState(false);
  const [selectedJadwalForMahasiswa, setSelectedJadwalForMahasiswa] = useState<{
    jadwal_id: number;
    jadwal_type: string;
    mata_kuliah_kode: string;
    mata_kuliah: string;
    dosen_name: string;
    tanggal: string;
    waktu: string;
  } | null>(null);

  // Change confirmation status modal state
  const [showChangeStatusModal, setShowChangeStatusModal] = useState(false);
  const [selectedDosenList, setSelectedDosenList] = useState<
    Map<string, { dosen: any; status: "bisa" | "tidak_bisa" }>
  >(new Map());
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  // Pagination state
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

  // Dosen replacement modal state
  const [showReplacementModal, setShowReplacementModal] = useState(false);
  const [selectedNotification, setSelectedNotification] =
    useState<Notification | null>(null);
  const [dosenList, setDosenList] = useState<any[]>([]);
  const [selectedDosen, setSelectedDosen] = useState<any>(null);
  const [replacementAction, setReplacementAction] = useState<
    "ask_again" | "replace"
  >("ask_again");
  const [loadingDosen, setLoadingDosen] = useState(false);
  const [replacementLoading, setReplacementLoading] = useState(false);
  const [dosenSearchQuery, setDosenSearchQuery] = useState("");

  // Reschedule modal state
  const [showRescheduleModal, setShowRescheduleModal] = useState(false);
  const [rescheduleNewDate, setRescheduleNewDate] = useState("");
  const [rescheduleNewStartTime, setRescheduleNewStartTime] = useState("");
  const [rescheduleNewEndTime, setRescheduleNewEndTime] = useState("");
  const [rescheduleNewRuangan, setRescheduleNewRuangan] = useState("");
  const [ruanganList, setRuanganList] = useState<any[]>([]);
  // Range tanggal MK untuk validasi (mengikuti Tambah Jadwal)
  const [rescheduleMinDate, setRescheduleMinDate] = useState<string>("");
  const [rescheduleMaxDate, setRescheduleMaxDate] = useState<string>("");
  // Inline validation messages (realtime) seperti di DetailBlok
  const [dateError, setDateError] = useState<string>("");
  const [timeError, setTimeError] = useState<string>("");
  const [roomError, setRoomError] = useState<string>("");
  const [showRoomMenu, setShowRoomMenu] = useState<boolean>(false);
  // Custom time selector like DetailBlok
  const [showStartTimeMenu, setShowStartTimeMenu] = useState<boolean>(false);
  const [sessionCount, setSessionCount] = useState<number>(2); // x 50 menit
  const [jadwalType, setJadwalType] = useState<string>("");
  const [originalJadwalData, setOriginalJadwalData] = useState<any>(null);
  const [jamOptions, setJamOptions] = useState<string[]>([]);

  // Derived statistics for reschedule (client-side from notifications)
  const rescheduleStats = React.useMemo(() => {
    const lower = (s?: string) => (s ? String(s).toLowerCase() : "");
    const isReq = (n: Notification) =>
      lower(n.data?.notification_type) === "reschedule_request";
    const isApproved = (n: Notification) =>
      lower(n.data?.notification_type) === "reschedule_approved" ||
      lower(n.title).includes("reschedule disetujui") ||
      lower(n.message).includes("reschedule disetujui") ||
      lower(n.title).includes("reschedule approved") ||
      lower(n.message).includes("reschedule approved");
    const isRejected = (n: Notification) =>
      lower(n.data?.notification_type) === "reschedule_rejected" ||
      lower(n.title).includes("reschedule ditolak") ||
      lower(n.message).includes("reschedule ditolak") ||
      lower(n.title).includes("reschedule rejected") ||
      lower(n.message).includes("reschedule rejected");

    const waiting = notifications.filter(isReq).length;
    const approved = notifications.filter(isApproved).length;
    const rejected = notifications.filter(isRejected).length;
    return { waiting, approved, rejected };
  }, [notifications]);

  // Badge for jadwal type
  const getJadwalTypeBadge = (type?: string, notification?: Notification) => {
    const t = String(type || "").toLowerCase();
    const map: Record<string, { label: string; cls: string }> = {
      pbl: {
        label: "PBL",
        cls: "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-200 border-blue-200 dark:border-blue-700",
      },
      kuliah_besar: {
        label: "Kuliah Besar",
        cls: "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-200 border-indigo-200 dark:border-indigo-700",
      },
      praktikum: {
        label: "Praktikum",
        cls: "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-200 border-green-200 dark:border-green-700",
      },
      jurnal: {
        label: "Jurnal Reading",
        cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200 border-purple-200 dark:border-purple-700",
      },
      jurnal_reading: {
        label: "Jurnal Reading",
        cls: "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-200 border-purple-200 dark:border-purple-700",
      },
      csr: {
        label: (() => {
          const jenis = String(
            notification?.data?.jenis_csr || ""
          ).toLowerCase();
          if (jenis === "responsi") return "CSR Responsi";
          if (jenis === "reguler") return "CSR Reguler";
          return "CSR";
        })(),
        cls: "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-200 border-orange-200 dark:border-orange-700",
      },
      non_blok_non_csr: {
        label: "Non Blok Non CSR",
        cls: "bg-teal-100 text-teal-800 dark:bg-teal-900/20 dark:text-teal-200 border-teal-200 dark:border-teal-700",
      },
      persamaan_persepsi: {
        label: "Persamaan Persepsi",
        cls: "bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-200 border-pink-200 dark:border-pink-700",
      },
      seminar_pleno: {
        label: "Seminar Pleno",
        cls: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-200 border-cyan-200 dark:border-cyan-700",
      },
    };
    const info = map[t];
    if (!info) return null;
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${info.cls}`}
      >
        {info.label}
      </span>
    );
  };

  // Default fallback jam list jika API jam_options tidak tersedia
  const fallbackJamOptions: string[] = [
    "07:00",
    "07:30",
    "08:00",
    "08:30",
    "09:00",
    "09:30",
    "10:00",
    "10:30",
    "11:00",
    "11:30",
    "12:00",
    "12:30",
    "13:00",
    "13:30",
    "14:00",
    "14:30",
    "15:00",
    "15:30",
    "16:00",
    "16:30",
  ];

  const addMinutes = (hhmm: string, minutesToAdd: number): string => {
    try {
      // Handle different time formats (07.20, 07:20, etc.)
      const normalizedTime = hhmm.replace(".", ":");
      const [h, m] = normalizedTime.split(":").map((x) => parseInt(x, 10));

      if (isNaN(h) || isNaN(m)) {
        console.warn("Invalid time format:", hhmm);
        return hhmm;
      }

      const base = new Date(2000, 0, 1, h, m, 0);
      const end = new Date(base.getTime() + minutesToAdd * 60 * 1000);
      const hh = String(end.getHours()).padStart(2, "0");
      const mm = String(end.getMinutes()).padStart(2, "0");
      return `${hh}:${mm}`;
    } catch (error) {
      console.warn("Error calculating end time:", error);
      return hhmm;
    }
  };

  const recomputeEndTime = (start: string, sesi: number) => {
    if (!start) return;
    const minutes = sesi * 50;
    const end = addMinutes(start, minutes);
    setRescheduleNewEndTime(end);
    setTimeError("");
  };

  // Get session options based on jadwal type
  const getSessionOptions = () => {
    switch (jadwalType.toLowerCase()) {
      case "pbl":
        // PBL: fixed sessions based on original jadwal
        if (originalJadwalData?.tipe_pbl === "PBL 1") return [2];
        if (originalJadwalData?.tipe_pbl === "PBL 2") return [3];
        return [2, 3]; // fallback
      case "kuliah_besar":
        return [1, 2, 3, 4, 5, 6]; // Kuliah Besar: 1-6 sessions
      case "praktikum":
        return [1, 2, 3, 4, 5, 6]; // Praktikum: editable dropdown 1-6 sessions
      case "jurnal_reading":
        return [2]; // Jurnal Reading: fixed 2x50'
      case "csr": {
        // CSR: Reguler fixed 3x50', Responsi fixed 2x50'
        const jenis = String(originalJadwalData?.jenis_csr || "").toLowerCase();
        return jenis === "responsi" ? [2] : [3];
      }
      case "non_blok_non_csr":
        return [1, 2, 3, 4];
      default:
        return [1, 2, 3, 4, 5, 6]; // default
    }
  };

  // Check if room field should be shown
  const shouldShowRoomField = () => {
    switch (jadwalType.toLowerCase()) {
      case "csr":
      case "non_blok_non_csr":
        // CSR: only show room if use_ruangan is true
        return originalJadwalData?.use_ruangan !== false;
      default:
        return true; // PBL, Kuliah Besar, Praktikum, Jurnal Reading always need room
    }
  };

  // Check if session selector should be editable
  const isSessionEditable = () => {
    switch (jadwalType.toLowerCase()) {
      case "pbl":
        return false; // PBL sessions are fixed based on type
      case "praktikum":
        return true; // Praktikum sessions are editable dropdown
      case "jurnal_reading":
        return false; // Jurnal Reading fixed 2x50'
      case "csr":
        return false; // CSR Reguler/Responsi fixed
      case "non_blok_non_csr":
        return true; // Non Blok Non CSR sessions are editable dropdown
      default:
        return true; // Other types can change sessions
    }
  };

  // Format tanggal ke dd/mm/yyyy untuk tampilan kartu
  const formatDateID = (iso: string | undefined) => {
    if (!iso) return "-";
    // Expecting YYYY-MM-DD
    const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return iso;
    const [, y, mm, dd] = m;
    return `${parseInt(dd, 10)}/${parseInt(mm, 10)}/${y}`;
  };

  // Helper: ambil mata_kuliah_kode dari detail jadwal jika tidak tersedia di payload notifikasi
  const fetchMataKuliahKodeFromJadwal = async (
    jadwalType?: string,
    jadwalId?: number,
    dosenId?: number
  ): Promise<{ kode?: string; nama?: string } | null> => {
    if (!jadwalType || !jadwalId) return null;
    try {
      const normType = String(jadwalType).toLowerCase();
      let url = "";
      switch (normType) {
        case "pbl":
          url = `/jadwal-pbl/${jadwalId}`;
          break;
        case "kuliah_besar":
          url = `/jadwal-kuliah-besar/${jadwalId}`;
          break;
        case "praktikum":
          url = `/jadwal-praktikum/${jadwalId}`;
          break;
        case "jurnal_reading":
        case "jurnal":
          url = `/jadwal-jurnal-reading/${jadwalId}`;
          break;
        case "csr":
          url = `/jadwal-csr/${jadwalId}`;
          break;
        case "non_blok_non_csr":
          url = `/jadwal-non-blok-non-csr/${jadwalId}`;
          break;
        case "persamaan_persepsi":
          url = `/jadwal-persamaan-persepsi/${jadwalId}`;
          break;
        case "seminar_pleno":
          url = `/seminar-pleno/jadwal/${jadwalId}`;
          break;
        default:
          return null;
      }
      let data: any = {};
      try {
        const resp = await api.get(url);
        // Handle different response structures
        data = resp.data?.data || resp.data || {};
      } catch (e: any) {
        // Fallback: jika endpoint detail tidak tersedia, ambil dari jadwal mengajar dosen
        if (dosenId) {
          try {
            const listResp = await api.get(`/users/${dosenId}/jadwal-mengajar`);
            const items: any[] = Array.isArray(listResp.data)
              ? listResp.data
              : listResp.data?.data || [];
            const jenisKeyMap: Record<string, string> = {
              pbl: "pbl",
              kuliah_besar: "kuliah_besar",
              praktikum: "praktikum",
              jurnal_reading: "jurnal_reading",
              jurnal: "jurnal_reading",
              csr: "csr",
              non_blok_non_csr: "non_blok_non_csr",
              persamaan_persepsi: "persamaan_persepsi",
              seminar_pleno: "seminar_pleno",
            };
            const targetJenis = jenisKeyMap[normType] || normType;
            const found = items.find(
              (it: any) =>
                it?.jenis_jadwal === targetJenis && it?.id === jadwalId
            );
            if (found) {
              return {
                kode: found.mata_kuliah_kode,
                nama: found.mata_kuliah_nama,
              };
            }
          } catch (_) {}
        }
        return null;
      }
      // Coba berbagai struktur yang mungkin
      const kode =
        data.mata_kuliah_kode ||
        data.mataKuliah?.kode ||
        data.mata_kuliah?.kode ||
        data.mata_kuliah_kode_id ||
        undefined;
      const nama =
        data.mata_kuliah_nama ||
        data.mataKuliah?.nama ||
        data.mata_kuliah?.nama ||
        undefined;
      return { kode, nama };
    } catch (e) {
      return null;
    }
  };

  // Initial load
  useEffect(() => {
    loadNotifications();
    loadStats();
  }, []);

  // Load notifications when filters change
  useEffect(() => {
    // Always reload when filter changes, including back to 'my_notifications'
    loadNotifications(true);
    loadStats();
  }, [userTypeFilter, notificationTypeFilter, filter]);

  const loadNotifications = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (userTypeFilter !== "my_notifications")
        params.append("user_type", userTypeFilter);
      if (notificationTypeFilter !== "all")
        params.append("notification_type", notificationTypeFilter);

      const response = await api.get(
        `/notifications/admin/all?${params.toString()}`
      );

      // Handle pagination response
      const notificationsData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.data || []);

      // Process notifications to parse JSON data field
      const processedNotifications = notificationsData.map((notification: any) => ({
        ...notification,
        data:
          typeof notification.data === "string"
            ? JSON.parse(notification.data)
            : notification.data,
      }));

      // Sort notifications by created_at descending (newest first)
      processedNotifications.sort((a: Notification, b: Notification) => {
        const dateA = new Date(a.created_at).getTime();
        const dateB = new Date(b.created_at).getTime();
        return dateB - dateA; // Descending order (newest first)
      });

      setNotifications(processedNotifications);
      // Prefetch status_konfirmasi terbaru untuk setiap notifikasi yang punya jadwal
      // DISABLED: Menyebabkan banyak API calls dan error 404 jika jadwal sudah dihapus
      // prefetchJadwalStatuses(processedNotifications);
      setError(null);
    } catch (err) {
      console.error("Failed to load notifications:", err);
      setError("Gagal memuat notifikasi");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  // Prefetch latest status_konfirmasi for notifications that reference a jadwal
  const prefetchJadwalStatuses = async (list: Notification[]) => {
    try {
      const fetches = list
        .filter((n) => n?.data?.jadwal_id && n?.data?.jadwal_type)
        .map(async (n) => {
          const type = String(n.data!.jadwal_type).toLowerCase();
          const id = Number(n.data!.jadwal_id);
          const key = `${type}:${id}`;
          if (jadwalStatusMap[key]) return; // already cached
          let url = "";
          switch (type) {
            case "pbl":
              url = `/jadwal-pbl/${id}`;
              break;
            case "kuliah_besar":
              url = `/jadwal-kuliah-besar/${id}`;
              break;
            case "praktikum":
              url = `/jadwal-praktikum/${id}`;
              break;
            case "jurnal_reading":
            case "jurnal":
              url = `/jadwal-jurnal-reading/${id}`;
              break;
            case "csr":
              url = `/jadwal-csr/${id}`;
              break;
            case "non_blok_non_csr":
              url = `/jadwal-non-blok-non-csr/${id}`;
              break;
            case "persamaan_persepsi":
              url = `/jadwal-persamaan-persepsi/${id}`;
              break;
            case "seminar_pleno":
              url = `/seminar-pleno/jadwal/${id}`;
              break;
            default:
              return;
          }
          try {
            const resp = await api.get(url);
            // Handle different response structures
            const data = resp.data?.data || resp.data || {};
            const status =
              data.status_konfirmasi ||
              data?.pivot?.status_konfirmasi ||
              data?.jadwal?.status_konfirmasi;
            if (status) {
              setJadwalStatusMap((prev) => ({
                ...prev,
                [key]: String(status),
              }));
            }

            // Note: jadwalDetailMap dihapus karena prefetchJadwalStatuses sudah di-disable
            // Logika "Kelola" button sekarang tidak bergantung pada jadwalDetailMap

            // Enrich notification data for CSR with jenis_csr so badge can show Reguler/Responsi
            if (type === "csr" && data?.jenis_csr && !n.data?.jenis_csr) {
              setNotifications((prev) =>
                prev.map((item) =>
                  item.id === n.id
                    ? {
                        ...item,
                        data: {
                          ...(item.data || {}),
                          jenis_csr: data.jenis_csr,
                        },
                      }
                    : item
                )
              );
            }
          } catch (_) {
            /* ignore */
          }

          // Secondary fallback: query jadwal-mengajar for the dosen to resolve status
          try {
            const dosenId = n?.data?.dosen_id || n.user_id;
            if (dosenId) {
              const jm = await api.get(`/users/${dosenId}/jadwal-mengajar`);
              const items: any[] = Array.isArray(jm.data)
                ? jm.data
                : jm.data?.data || [];
              const normTypeMap: Record<string, string> = {
                pbl: "pbl",
                kuliah_besar: "kuliah_besar",
                praktikum: "praktikum",
                jurnal: "jurnal_reading",
                jurnal_reading: "jurnal_reading",
                csr: "csr",
                non_blok_non_csr: "non_blok_non_csr",
                persamaan_persepsi: "persamaan_persepsi",
                seminar_pleno: "seminar_pleno",
              };
              const normType = normTypeMap[type] || type;
              const found = items.find(
                (it: any) =>
                  String(it?.jenis_jadwal).toLowerCase() === normType &&
                  Number(it?.id) === id
              );
              const status2 =
                found?.status_konfirmasi || found?.pivot?.status_konfirmasi;
              if (status2) {
                setJadwalStatusMap((prev) => ({
                  ...prev,
                  [key]: String(status2),
                }));
              }
            }
          } catch (_) {
            /* ignore */
          }
        });
      await Promise.all(fetches);
    } catch (_) {
      /* ignore */
    }
  };

  const loadStats = async () => {
    try {
      const params = new URLSearchParams();
      if (userTypeFilter !== "my_notifications")
        params.append("user_type", userTypeFilter);
      if (notificationTypeFilter !== "all")
        params.append("notification_type", notificationTypeFilter);

      const response = await api.get(
        `/notifications/admin/stats?${params.toString()}`
      );
      setStats(response.data);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  };

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([loadNotifications(false), loadStats()]);
    setIsRefreshing(false);
  };

  // Load pending dosen (those with belum_konfirmasi status and email verified)
  const loadPendingDosen = async (
    page = 1,
    pageSize = 5,
    semester = "",
    blok = "",
    reminderType = "all",
    jadwalType = "" // PERBAIKAN: Tambahkan parameter jadwal type
  ) => {
    setLoadingPendingDosen(true);
    try {
      const params = new URLSearchParams();
      if (page) params.append("page", page.toString());
      if (pageSize) params.append("page_size", pageSize.toString());
      if (semester) params.append("semester", semester);
      if (blok) params.append("blok", blok);
      if (reminderType) params.append("reminder_type", reminderType);
      // PERBAIKAN: Tambahkan parameter jadwal type jika ada
      if (jadwalType) params.append("jadwal_type", jadwalType);

      const response = await api.get(
        `/notifications/pending-dosen?${params.toString()}`
      );
      // Backend sudah melakukan deduplication berdasarkan dosen_id + jadwal_type + jadwal_id
      // Jadi semua jadwal akan muncul terpisah meskipun dosennya sama
      const pendingDosenList = response.data.pending_dosen || [];

      setPendingDosenList(pendingDosenList);
      setPendingDosenTotal(response.data.total || 0);
    } catch (error: any) {
      console.error("Error loading pending dosen:", error);
      setPendingDosenList([]);
      setPendingDosenTotal(0);
    } finally {
      setLoadingPendingDosen(false);
    }
  };

  // Handle toggle dosen selection for reminder
  const handleToggleReminderDosen = (dosen: any) => {
    // Create unique key: `${jadwal_type}_${jadwal_id}_${dosen_id}`
    // Tambahkan jadwal_type untuk memastikan setiap jadwal unik meskipun dosen sama
    const cleanJadwalId =
      typeof dosen.jadwal_id === "string" && dosen.jadwal_id.includes(":")
        ? dosen.jadwal_id.split(":")[0]
        : String(dosen.jadwal_id || "");
    const jadwalType = String(dosen.jadwal_type || "")
      .toLowerCase()
      .replace(/\s+/g, "_");
    const dosenId = String(dosen.dosen_id || "");
    // Key harus unik: jadwal_type + jadwal_id + dosen_id
    const key = `${jadwalType}_${cleanJadwalId}_${dosenId}`;
    const newSet = new Set(selectedReminderDosen);

    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }

    setSelectedReminderDosen(newSet);
  };

  // Handle select all dosen for reminder
  const handleSelectAllReminderDosen = () => {
    // PERBAIKAN: Filter berdasarkan search query jika ada
    const listToUse = pendingDosenSearchQuery.trim()
      ? pendingDosenList.filter((dosen) => {
          const searchLower = pendingDosenSearchQuery.toLowerCase().trim();
          const dosenName = (dosen.name || "").toLowerCase();
          const mataKuliah = (dosen.mata_kuliah || "").toLowerCase();
          const jadwalType = (dosen.jadwal_type || "").toLowerCase();
          const email = (dosen.email || "").toLowerCase();
          const nid = (dosen.nid || "").toLowerCase();
          
          return (
            dosenName.includes(searchLower) ||
            mataKuliah.includes(searchLower) ||
            jadwalType.includes(searchLower) ||
            email.includes(searchLower) ||
            nid.includes(searchLower)
          );
        })
      : pendingDosenList;
    
    const allKeys = listToUse.map((dosen) => {
      const cleanJadwalId =
        typeof dosen.jadwal_id === "string" && dosen.jadwal_id.includes(":")
          ? dosen.jadwal_id.split(":")[0]
          : String(dosen.jadwal_id || "");
      const jadwalType = String(dosen.jadwal_type || "")
        .toLowerCase()
        .replace(/\s+/g, "_");
      const dosenId = String(dosen.dosen_id || "");
      // Key harus unik: jadwal_type + jadwal_id + dosen_id
      return `${jadwalType}_${cleanJadwalId}_${dosenId}`;
    });

    // If all are selected, deselect all. Otherwise, select all.
    const allSelected = allKeys.every((key) => selectedReminderDosen.has(key));
    if (allSelected) {
      setSelectedReminderDosen(new Set());
    } else {
      setSelectedReminderDosen(new Set(allKeys));
    }
  };

  // Handle send reminder notifications
  // Fetch mahasiswa list for a specific jadwal
  const fetchMahasiswa = async (
    jadwalType: string,
    jadwalId: number,
    mataKuliahKode: string
  ) => {
    setLoadingMahasiswa(true);
    try {
      let endpoint = "";
      const normalizedType = jadwalType.toLowerCase().replace(/\s+/g, "_");

      // Map jadwal type to API endpoint
      // Format: /{type}/{kode}/jadwal/{jadwalId}/mahasiswa
      switch (normalizedType) {
        case "kuliah_besar":
          endpoint = `/kuliah-besar/${mataKuliahKode}/jadwal/${jadwalId}/mahasiswa`;
          break;
        case "praktikum":
          endpoint = `/jadwal-praktikum/${mataKuliahKode}/jadwal/${jadwalId}/mahasiswa`;
          break;
        case "seminar_pleno":
          endpoint = `/jadwal-seminar-pleno/${mataKuliahKode}/jadwal/${jadwalId}/mahasiswa`;
          break;
        // Untuk jadwal lain, coba endpoint alternatif atau return empty
        case "pbl":
        case "jurnal_reading":
        case "csr":
        case "persamaan_persepsi":
        case "non_blok_non_csr":
        case "agenda_besar":
          // Untuk jadwal yang belum punya endpoint khusus, return empty array
          // Atau bisa ditambahkan endpoint-nya nanti
          setMahasiswaList([]);
          setLoadingMahasiswa(false);
          return;
        default:
          setMahasiswaList([]);
          setLoadingMahasiswa(false);
          return;
      }

      const response = await api.get(endpoint);
      const mahasiswaData = response.data.mahasiswa || response.data.data || [];
      
      // Fetch full user data including email and whatsapp for each mahasiswa
      const mahasiswaWithDetails = await Promise.all(
        mahasiswaData.map(async (m: any) => {
          try {
            // Get full user data
            const userResponse = await api.get(`/users/${m.id || m.mahasiswa_id}`);
            const user = userResponse.data.user || userResponse.data.data || userResponse.data;
            
            return {
              id: m.id || m.mahasiswa_id || user.id,
              nim: m.nim || user.nim || "-",
              name: m.nama || m.name || user.name || "-",
              email: user.email || "-",
              email_verified: user.email_verified || false,
              whatsapp_phone: user.whatsapp_phone || "-",
              whatsapp_email: user.whatsapp_email || "-",
            };
          } catch (error) {
            console.error(`Error fetching user ${m.id || m.mahasiswa_id}:`, error);
            return {
              id: m.id || m.mahasiswa_id || 0,
              nim: m.nim || "-",
              name: m.nama || m.name || "-",
              email: "-",
              email_verified: false,
              whatsapp_phone: "-",
              whatsapp_email: "-",
            };
          }
        })
      );

      setMahasiswaList(mahasiswaWithDetails);
    } catch (error: any) {
      console.error("Error fetching mahasiswa:", error);
      setMahasiswaList([]);
      // Show error but don't block the modal
    } finally {
      setLoadingMahasiswa(false);
    }
  };

  // Handle open mahasiswa modal
  const handleOpenMahasiswaModal = async (dosen: any) => {
    const cleanJadwalId =
      typeof dosen.jadwal_id === "string" && dosen.jadwal_id.includes(":")
        ? dosen.jadwal_id.split(":")[0]
        : Number(dosen.jadwal_id || 0);
    
    const mataKuliahKode = dosen.mata_kuliah_kode || dosen.mata_kuliah_kode_id || "";
    
    if (!mataKuliahKode || !cleanJadwalId) {
      console.error("Missing mata_kuliah_kode or jadwal_id", {
        dosen,
        mata_kuliah_kode: dosen.mata_kuliah_kode,
        mata_kuliah_kode_id: dosen.mata_kuliah_kode_id,
        jadwal_id: dosen.jadwal_id,
        cleanJadwalId
      });
      alert(`Tidak dapat membuka daftar mahasiswa: Data jadwal tidak lengkap.\n\nJadwal ID: ${cleanJadwalId || 'Tidak ada'}\nMata Kuliah Kode: ${mataKuliahKode || 'Tidak ada'}\nJadwal Type: ${dosen.jadwal_type || 'Tidak ada'}`);
      return;
    }

    setSelectedJadwalForMahasiswa({
      jadwal_id: cleanJadwalId,
      jadwal_type: dosen.jadwal_type || "",
      mata_kuliah_kode: mataKuliahKode,
      mata_kuliah: dosen.mata_kuliah || "",
      dosen_name: dosen.name || "",
      tanggal: dosen.tanggal || "",
      waktu: dosen.waktu || "",
    });

    setShowMahasiswaModal(true);
    await fetchMahasiswa(
      dosen.jadwal_type || "",
      cleanJadwalId,
      mataKuliahKode
    );
  };

  const handleSendReminder = async () => {
    try {
      setIsSendingReminder(true);

      const params = new URLSearchParams();

      // KONSEP:
      // 1. Jika ada selected dosen → kirim HANYA ke selected dosen (TIDAK pakai filter)
      // 2. Jika TIDAK ada selected dosen → kirim berdasarkan filter
      if (selectedReminderDosen.size > 0) {
        // MODE: Selected Jadwal (prioritas) - setiap jadwal dihitung terpisah
        // Find the actual dosen data from pendingDosenList
        const jadwalToSend = pendingDosenList.filter((dosen) => {
          const cleanJadwalId =
            typeof dosen.jadwal_id === "string" && dosen.jadwal_id.includes(":")
              ? dosen.jadwal_id.split(":")[0]
              : String(dosen.jadwal_id || "");
          const jadwalType = String(dosen.jadwal_type || "")
            .toLowerCase()
            .replace(/\s+/g, "_");
          const dosenId = String(dosen.dosen_id || "");
          const key = `${jadwalType}_${cleanJadwalId}_${dosenId}`;
          return selectedReminderDosen.has(key);
        });

        if (jadwalToSend.length === 0) {
          throw new Error(
            "Tidak ada jadwal yang dipilih untuk dikirim pengingat"
          );
        }

        // Extract unique dosen_ids (untuk backward compatibility dengan backend)
        // Tapi juga kirim jadwal_dosen_pairs untuk membedakan jadwal yang berbeda
        const uniqueDosenIds = [
          ...new Set(jadwalToSend.map((d) => d.dosen_id)),
        ];

        // Kirim dengan dosen_ids dan jadwal_dosen_pairs (jika backend support)
        // Format: jadwal_dosen_pairs dalam format "jadwal_type:jadwal_id:dosen_id,jadwal_type:jadwal_id:dosen_id"
        const jadwalDosenPairs = jadwalToSend.map((d) => {
          const cleanJadwalId =
            typeof d.jadwal_id === "string" && d.jadwal_id.includes(":")
              ? d.jadwal_id.split(":")[0]
              : d.jadwal_id;
          const jadwalType = String(d.jadwal_type || "")
            .toLowerCase()
            .replace(/\s+/g, "_");
          return `${jadwalType}:${cleanJadwalId}:${d.dosen_id}`;
        });

        // Kirim HANYA dengan dosen_ids (TIDAK pakai filter semester/blok/reminder_type)
        params.append("dosen_ids", uniqueDosenIds.join(","));
        // Tambahkan jadwal_dosen_pairs untuk membedakan jadwal yang berbeda
        params.append("jadwal_dosen_pairs", jadwalDosenPairs.join(","));

        await api.post(`/notifications/send-reminder?${params.toString()}`);

        setReminderSuccessMessage(
          `Notifikasi pengingat berhasil dikirim untuk ${jadwalToSend.length} jadwal yang dipilih`
        );
      } else {
        // MODE: Filter-based (jika tidak ada selected)
        // Validasi: minimal harus ada 1 filter atau reminder_type
        if (
          !pendingDosenSemester &&
          !pendingDosenBlok &&
          !pendingDosenReminderType
        ) {
          throw new Error(
            "Silakan pilih filter (Semester/Blok/Tipe Pengingat) atau pilih dosen yang akan dikirim pengingat"
          );
        }

        // Gunakan filter-based approach
        if (pendingDosenSemester)
          params.append("semester", pendingDosenSemester);
      if (pendingDosenBlok) params.append("blok", pendingDosenBlok);
      if (pendingDosenReminderType)
        params.append("reminder_type", pendingDosenReminderType);

      const response = await api.post(
        `/notifications/send-reminder?${params.toString()}`
      );

      setReminderSuccessMessage(
          `Notifikasi pengingat berhasil dikirim ke ${
            response.data.reminder_count || 0
          } dosen berdasarkan filter`
      );
      }
      
      // Close reminder modal and show success modal
      setShowReminderModal(false);
      setSelectedReminderDosen(new Set()); // Reset selection
      setShowReminderSuccessModal(true);

      // Refresh notifications to show new reminder notifications
      await loadNotifications(false);
      await loadStats();
    } catch (error: any) {
      console.error("Failed to send reminder notifications:", error);
      // Set error message and show success modal (for error case)
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Gagal mengirim notifikasi pengingat";
      setReminderSuccessMessage(errorMessage);
      setShowReminderModal(false);
      setSelectedReminderDosen(new Set()); // Reset selection
      setShowReminderSuccessModal(true);
    } finally {
      setIsSendingReminder(false);
    }
  };

  // Handle reset notifications
  const handleResetNotifications = async () => {
    try {
      setIsResetting(true);

      const params = new URLSearchParams();
      params.append("scope", resetScope);

      const response = await api.delete(
        `/notifications/admin/reset?${params.toString()}`
      );

      // Close modals
      setShowResetConfirmModal(false);
      setShowResetModal(false);
      setResetScope("all");

      // Show success message
      setReminderSuccessMessage(
        `Berhasil mereset ${response.data.deleted_count || 0} notifikasi (${
          resetScope === "all"
            ? "Semua"
            : resetScope === "dosen"
            ? "Dosen"
            : "Mahasiswa"
        })`
      );
      setShowReminderSuccessModal(true);

      // Refresh notifications and stats
      await loadNotifications(false);
      await loadStats();
    } catch (error: any) {
      console.error("Failed to reset notifications:", error);
      const errorMessage =
        error.response?.data?.message ||
        error.message ||
        "Gagal mereset notifikasi";
      setReminderSuccessMessage(errorMessage);
      setShowResetConfirmModal(false);
      setShowResetModal(false);
      setShowReminderSuccessModal(true);
    } finally {
      setIsResetting(false);
    }
  };

  // Handle dosen replacement actions
  const handleOpenReplacementModal = async (notification: Notification) => {
    setSelectedNotification(notification);
    setShowReplacementModal(true);
    setReplacementAction("ask_again");
    setSelectedDosen(null);

    // Load dosen list
    await loadDosenList();
  };

  // Handle reschedule actions
  const handleOpenRescheduleModal = async (notification: Notification) => {
    setSelectedNotification(notification);
    setShowRescheduleModal(true);

    // Set jadwal type and original data
    const type = notification.data?.jadwal_type || "";
    setJadwalType(type);
    setOriginalJadwalData(notification.data || {});

    // If CSR and jenis_csr missing, fetch detail to enrich so badge and session lock work
    try {
      const t = String(type || "").toLowerCase();
      if (
        t === "csr" &&
        !(notification.data as any)?.jenis_csr &&
        notification.data?.jadwal_id
      ) {
        const resp = await api.get(
          `/jadwal-csr/${notification.data.jadwal_id}`
        );
        const jenis = resp?.data?.jenis_csr || resp?.data?.jadwal?.jenis_csr;
        if (jenis) {
          setOriginalJadwalData((prev: any) => ({
            ...(prev || {}),
            jenis_csr: jenis,
          }));
          setSelectedNotification((prev) =>
            prev && prev.id === notification.id
              ? { ...prev, data: { ...(prev.data || {}), jenis_csr: jenis } }
              : prev
          );
        }
      }
      // Enrich PBL tipe if missing so sessions lock to PBL1=2x50, PBL2=3x50
      if (
        t === "pbl" &&
        !(notification.data as any)?.tipe_pbl &&
        notification.data?.jadwal_id
      ) {
        const resp = await api.get(
          `/jadwal-pbl/${notification.data.jadwal_id}`
        );
        const tipe =
          resp?.data?.pbl_tipe ||
          resp?.data?.tipe_pbl ||
          resp?.data?.jadwal?.pbl_tipe;
        if (tipe) {
          setOriginalJadwalData((prev: any) => ({
            ...(prev || {}),
            tipe_pbl: tipe,
          }));
          setSelectedNotification((prev) =>
            prev && prev.id === notification.id
              ? { ...prev, data: { ...(prev.data || {}), tipe_pbl: tipe } }
              : prev
          );
        }
      }
    } catch (_) {}

    // Load ruangan list
    await loadRuanganList();

    // Pre-fill current jadwal data
    if (notification.data) {
      setRescheduleNewDate(notification.data.tanggal || "");
      setRescheduleNewStartTime(notification.data.jam_mulai || "");
      setRescheduleNewEndTime(notification.data.jam_selesai || "");
      setDateError("");
      setTimeError("");

      // Set initial session count based on jadwal type
      const sessionOptions = getSessionOptions();
      if (jadwalType.toLowerCase() === "csr") {
        // Force fixed sessions for CSR Reguler/Responsi
        setSessionCount(sessionOptions[0]);
      } else if (sessionOptions.length === 1) {
        setSessionCount(sessionOptions[0]);
      } else {
        // Try to calculate from original jam_mulai and jam_selesai
        const start = notification.data.jam_mulai;
        const end = notification.data.jam_selesai;
        if (start && end) {
          const startTime = new Date(`2000-01-01 ${start}`);
          const endTime = new Date(`2000-01-01 ${end}`);
          const diffMinutes =
            (endTime.getTime() - startTime.getTime()) / (1000 * 60);
          const calculatedSessions = Math.round(diffMinutes / 50);
          if (
            calculatedSessions > 0 &&
            sessionOptions.includes(calculatedSessions)
          ) {
            setSessionCount(calculatedSessions);
          } else {
            setSessionCount(sessionOptions[0]);
          }
        } else {
          setSessionCount(sessionOptions[0]);
        }
      }

      // Recalculate end time after setting session count
      if (notification.data.jam_mulai) {
        recomputeEndTime(notification.data.jam_mulai, sessionCount);
      }
    }

    // Set batas tanggal berdasarkan Mata Kuliah terkait (mengikuti DetailBlok / DetailNonBlokCSR)
    try {
      // 1) Coba langsung dari payload notifikasi
      let mkKode =
        (notification.data as any)?.mata_kuliah_kode ||
        (notification.data as any)?.kode_mk ||
        "";
      let mk: any = (notification.data as any)?.mata_kuliah || {};

      // 2) Jika tidak ada, ambil dari detail jadwal berdasarkan jadwal_type + jadwal_id
      if (!mkKode) {
        const res = await fetchMataKuliahKodeFromJadwal(
          (notification.data as any)?.jadwal_type,
          (notification.data as any)?.jadwal_id,
          (notification.data as any)?.dosen_id || selectedNotification?.user_id
        );
        if (res?.kode) {
          mkKode = res.kode;
          mk = { ...(mk || {}), nama: res.nama };
        }
      }

      // 2.5) Jika masih belum ada, coba ambil dari data jadwal yang sudah di-fetch sebelumnya
      if (!mkKode && originalJadwalData?.mata_kuliah) {
        mkKode = originalJadwalData.mata_kuliah.kode;
        mk = {
          ...mk,
          nama: originalJadwalData.mata_kuliah.nama,
          tanggal_mulai: originalJadwalData.mata_kuliah.tanggal_mulai,
          tanggal_akhir: originalJadwalData.mata_kuliah.tanggal_akhir,
        };
      }

      // 3) Jika masih belum ada detail MK lengkap, fetch detail MK
      if (!mk.tanggal_mulai && mkKode) {
        try {
          const res = await api.get(`/mata-kuliah/${mkKode}`);
          mk = { ...res.data, ...mk };
        } catch (_) {}
      }

      const startRaw =
        mk.tanggal_mulai ||
        mk.tanggalMulai ||
        notification.data?.tanggal_mulai_mk ||
        null;
      const endRaw =
        mk.tanggal_akhir ||
        mk.tanggalAkhir ||
        notification.data?.tanggal_akhir_mk ||
        null;

      // Utility untuk normalisasi ke format input type=date (YYYY-MM-DD)
      const toInputDate = (d?: string | null) => {
        if (!d) return "";
        // Jika sudah YYYY-MM-DD, kembalikan apa adanya
        if (/^\d{4}-\d{2}-\d{2}$/.test(d)) return d;
        // Coba parse format umum dd/mm/yyyy atau dd-mm-yyyy
        const m = d.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
        if (m) {
          const [_, dd, mm, yyyy] = m;
          const pad = (s: string) => (s.length === 1 ? `0${s}` : s);
          return `${yyyy}-${pad(mm)}-${pad(dd)}`;
        }
        // Fallback ke Date parsing
        const dt = new Date(d);
        if (!isNaN(dt.getTime())) {
          const yyyy = dt.getFullYear();
          const mm = String(dt.getMonth() + 1).padStart(2, "0");
          const dd = String(dt.getDate()).padStart(2, "0");
          return `${yyyy}-${mm}-${dd}`;
        }
        return "";
      };

      setRescheduleMinDate(toInputDate(startRaw));
      setRescheduleMaxDate(toInputDate(endRaw));

      // Ambil jam options seperti di DetailBlok (batch-data)
      try {
        if (mkKode) {
          const batch = await api.get(`/mata-kuliah/${mkKode}/batch-data`);
          const list = Array.isArray(batch.data?.jam_options)
            ? batch.data.jam_options
            : [];
          setJamOptions(list.length ? list : fallbackJamOptions);
        } else {
          setJamOptions(fallbackJamOptions);
        }
      } catch (_) {
        setJamOptions(fallbackJamOptions);
      }
    } catch (e) {
      setRescheduleMinDate("");
      setRescheduleMaxDate("");
    }
  };

  const loadRuanganList = async () => {
    try {
      const response = await api.get("/ruangan");
      setRuanganList(response.data || []);
    } catch (error) {
      console.error("Failed to load ruangan list:", error);
      setRuanganList([]);
    }
  };

  const loadDosenList = async () => {
    try {
      setLoadingDosen(true);
      const response = await api.get("/users?role=dosen&per_page=1000");
      // Handle pagination response
      const dosenData = Array.isArray(response.data) 
        ? response.data 
        : (response.data?.data || []);
      setDosenList(dosenData);
    } catch (error) {
      console.error("Failed to load dosen list:", error);
      setDosenList([]);
    } finally {
      setLoadingDosen(false);
    }
  };

  // Filter dosen based on search query
  const filteredDosenList = dosenList.filter(
    (dosen) =>
      dosen.name.toLowerCase().includes(dosenSearchQuery.toLowerCase()) ||
      dosen.email.toLowerCase().includes(dosenSearchQuery.toLowerCase())
  );

  // Generate avatar from name - similar to PBL-detail.tsx
  const getAvatarFromName = (name: string, isStandby: boolean = false) => {
    const initial = name.charAt(0).toUpperCase();

    // Use colors similar to PBL-detail.tsx
    const color = isStandby ? "bg-yellow-400" : "bg-brand-500";

    return { initial, color };
  };

  const handleReplacementSubmit = async () => {
    if (!selectedNotification) return;

    try {
      setReplacementLoading(true);

      if (replacementAction === "ask_again") {
        // Minta dosen yang sama mengajar lagi
        await api.post("/notifications/ask-again", {
          notification_id: selectedNotification.id,
          jadwal_id: selectedNotification.data?.jadwal_id,
          jadwal_type: selectedNotification.data?.jadwal_type,
        });
      } else if (replacementAction === "replace" && selectedDosen) {
        // Ganti dengan dosen pengganti
        await api.post("/notifications/replace-dosen", {
          notification_id: selectedNotification.id,
          jadwal_id: selectedNotification.data?.jadwal_id,
          jadwal_type: selectedNotification.data?.jadwal_type,
          new_dosen_id: selectedDosen.id,
        });
      }

      // Refresh notifications
      await loadNotifications(false);
      await loadStats();

      // Close modal
      setShowReplacementModal(false);
      setSelectedNotification(null);
      setSelectedDosen(null);
    } catch (error) {
      console.error("Failed to process replacement:", error);
    } finally {
      setReplacementLoading(false);
    }
  };

  // Handle toggle dosen selection
  const handleToggleDosenSelection = (dosen: any) => {
    // Ensure jadwal_id is clean (remove colon if present)
    const cleanJadwalId =
      typeof dosen.jadwal_id === "string" && dosen.jadwal_id.includes(":")
        ? dosen.jadwal_id.split(":")[0]
        : dosen.jadwal_id;

    const key = `${cleanJadwalId}_${dosen.dosen_id}`;
    const newMap = new Map(selectedDosenList);

    if (newMap.has(key)) {
      // Unselect if already selected
      newMap.delete(key);
    } else {
      // Select with default status "tidak_bisa"
      // Create a clean dosen object with normalized jadwal_id
      const cleanDosen = {
        ...dosen,
        jadwal_id: cleanJadwalId,
      };
      newMap.set(key, { dosen: cleanDosen, status: "tidak_bisa" });
    }

    setSelectedDosenList(newMap);
  };

  // Handle change status for selected dosen
  const handleChangeStatusForDosen = (
    dosen: any,
    status: "bisa" | "tidak_bisa"
  ) => {
    // Ensure jadwal_id is clean (remove colon if present)
    const cleanJadwalId =
      typeof dosen.jadwal_id === "string" && dosen.jadwal_id.includes(":")
        ? dosen.jadwal_id.split(":")[0]
        : dosen.jadwal_id;

    const key = `${cleanJadwalId}_${dosen.dosen_id}`;
    const newMap = new Map(selectedDosenList);

    if (newMap.has(key)) {
      // Update the dosen object with clean jadwal_id
      const cleanDosen = {
        ...dosen,
        jadwal_id: cleanJadwalId,
      };
      newMap.set(key, { dosen: cleanDosen, status });
      setSelectedDosenList(newMap);
    }
  };

  // Handle change confirmation status (multiple dosen)
  const handleChangeStatus = async () => {
    if (selectedDosenList.size === 0) return;

    try {
      setIsChangingStatus(true);

      const promises = Array.from(selectedDosenList.values()).map(
        async ({ dosen, status }) => {
          const { jadwal_id, jadwal_type, dosen_id } = dosen;

          // Normalize jadwal_type: backend returns "PBL", "Kuliah Besar", "Jurnal Reading", etc.
          // Convert to lowercase and replace spaces with underscores
          const normalizedType = String(jadwal_type || "")
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "_")
            .replace(/_+/g, "_");

          // Ensure jadwal_id is a number (not string with colon)
          // Handle cases like "1:1" or "2:1" by taking the first part
          let cleanJadwalId = jadwal_id;
          if (typeof jadwal_id === "string") {
            if (jadwal_id.includes(":")) {
              cleanJadwalId = parseInt(jadwal_id.split(":")[0], 10);
            } else {
              cleanJadwalId = parseInt(jadwal_id, 10);
            }
          }

          // Validate cleanJadwalId
          if (isNaN(cleanJadwalId) || cleanJadwalId <= 0) {
            console.error(
              "Invalid jadwal_id:",
              jadwal_id,
              "cleaned:",
              cleanJadwalId,
              "dosen:",
              dosen
            );
            throw new Error(`Jadwal ID tidak valid: ${jadwal_id}`);
          }

          // Determine endpoint based on jadwal type
          // Backend returns: "PBL", "Kuliah Besar", "Praktikum", "Jurnal Reading", "CSR", "Non Blok Non CSR"
          let endpoint = "";
          if (normalizedType === "pbl") {
            endpoint = `/jadwal-pbl/${cleanJadwalId}/konfirmasi`;
          } else if (normalizedType === "kuliah_besar") {
            endpoint = `/jadwal-kuliah-besar/${cleanJadwalId}/konfirmasi`;
          } else if (normalizedType === "praktikum") {
            endpoint = `/jadwal-praktikum/${cleanJadwalId}/konfirmasi`;
          } else if (
            normalizedType === "jurnal_reading" ||
            normalizedType === "jurnal"
          ) {
            endpoint = `/jadwal-jurnal-reading/${cleanJadwalId}/konfirmasi`;
          } else if (normalizedType === "csr") {
            endpoint = `/jadwal-csr/${cleanJadwalId}/konfirmasi`;
          } else if (normalizedType === "non_blok_non_csr") {
            endpoint = `/jadwal-non-blok-non-csr/${cleanJadwalId}/konfirmasi`;
          } else if (normalizedType === "persamaan_persepsi") {
            endpoint = `/jadwal-persamaan-persepsi/${cleanJadwalId}/konfirmasi`;
          } else if (normalizedType === "seminar_pleno") {
            endpoint = `/jadwal-seminar-pleno/${cleanJadwalId}/konfirmasi`;
          } else {
            console.error(
              "Invalid jadwal_type:",
              jadwal_type,
              "normalized:",
              normalizedType,
              "dosen:",
              dosen
            );
            throw new Error(
              `Jenis jadwal tidak valid: ${jadwal_type} (normalized: ${normalizedType})`
            );
          }

          console.log("Updating status for:", {
            jadwal_type,
            normalizedType,
            cleanJadwalId,
            endpoint,
            dosen_id,
          });

          // Prepare payload
          const payload: any = {
            status: status,
            dosen_id: dosen_id,
            alasan: status === "tidak_bisa" ? "Status diubah oleh admin" : null,
          };

          // Call API
          return api.put(endpoint, payload);
        }
      );

      // Execute all API calls
      await Promise.all(promises);

      // Send notifications for each updated dosen
      const notificationPromises = Array.from(selectedDosenList.values()).map(
        async ({ dosen, status }) => {
          const { jadwal_id, jadwal_type, dosen_id } = dosen;

          // Normalize jadwal_type
          const normalizedType = String(jadwal_type || "")
            .toLowerCase()
            .trim()
            .replace(/\s+/g, "_")
            .replace(/_+/g, "_");

          // Ensure jadwal_id is a number
          let cleanJadwalId = jadwal_id;
          if (typeof jadwal_id === "string") {
            if (jadwal_id.includes(":")) {
              cleanJadwalId = parseInt(jadwal_id.split(":")[0], 10);
            } else {
              cleanJadwalId = parseInt(jadwal_id, 10);
            }
          }

          // Map normalized type to backend type
          let backendType = normalizedType;
          if (normalizedType === "pbl") {
            backendType = "pbl";
          } else if (normalizedType === "kuliah_besar") {
            backendType = "kuliah_besar";
          } else if (normalizedType === "praktikum") {
            backendType = "praktikum";
          } else if (
            normalizedType === "jurnal_reading" ||
            normalizedType === "jurnal"
          ) {
            backendType = "jurnal_reading";
          } else if (normalizedType === "csr") {
            backendType = "csr";
          } else if (normalizedType === "non_blok_non_csr") {
            backendType = "non_blok_non_csr";
          } else if (normalizedType === "persamaan_persepsi") {
            backendType = "persamaan_persepsi";
          } else if (normalizedType === "seminar_pleno") {
            backendType = "seminar_pleno";
          }

          // Send notification
          return api.post("/notifications/send-status-change", {
            jadwal_id: cleanJadwalId,
            jadwal_type: backendType,
            dosen_id: dosen_id,
            status: status,
          });
        }
      );

      // Send notifications (don't wait for them to complete)
      Promise.all(notificationPromises).catch((error) => {
        console.error("Failed to send some notifications:", error);
        // Don't show error to user, just log it
      });

      // Refresh notifications and stats
      await loadNotifications(false);
      await loadStats();
      await loadPendingDosen(
        pendingDosenPage,
        pendingDosenPageSize,
        pendingDosenSemester,
        pendingDosenBlok,
        "unconfirmed",
        pendingDosenJadwalType // PERBAIKAN: Include jadwal type filter
      );

      // Close modal and reset
      setShowChangeStatusModal(false);
      setSelectedDosenList(new Map());

      // Show success message
      const bisaCount = Array.from(selectedDosenList.values()).filter(
        (s) => s.status === "bisa"
      ).length;
      const tidakBisaCount = Array.from(selectedDosenList.values()).filter(
        (s) => s.status === "tidak_bisa"
      ).length;
      let message = `Status konfirmasi berhasil diubah untuk ${selectedDosenList.size} dosen`;
      if (bisaCount > 0 && tidakBisaCount > 0) {
        message += ` (${bisaCount} Bisa Mengajar, ${tidakBisaCount} Tidak Bisa Mengajar)`;
      } else if (bisaCount > 0) {
        message += ` (${bisaCount} Bisa Mengajar)`;
      } else if (tidakBisaCount > 0) {
        message += ` (${tidakBisaCount} Tidak Bisa Mengajar)`;
      }
      setReminderSuccessMessage(message);
      setShowReminderSuccessModal(true);
    } catch (error: any) {
      console.error("Failed to change status:", error);
      setReminderSuccessMessage(
        error.response?.data?.message || "Gagal mengubah status konfirmasi"
      );
      setShowReminderSuccessModal(true);
    } finally {
      setIsChangingStatus(false);
    }
  };

  const handleRescheduleSubmit = async (action: "approve" | "reject") => {
    if (!selectedNotification) return;

    try {
      setReplacementLoading(true);

      if (action === "approve") {
        // Client-side validation mengikuti Tambah Jadwal
        if (rescheduleMinDate || rescheduleMaxDate) {
          const valTime = new Date(rescheduleNewDate).getTime();
          const minV = rescheduleMinDate
            ? new Date(rescheduleMinDate).getTime()
            : undefined;
          const maxV = rescheduleMaxDate
            ? new Date(rescheduleMaxDate).getTime()
            : undefined;
          if (minV !== undefined && valTime < minV) {
            setDateError("Tanggal tidak boleh sebelum tanggal mulai!");
            setReplacementLoading(false);
            return;
          }
          if (maxV !== undefined && valTime > maxV) {
            setDateError("Tanggal tidak boleh setelah tanggal akhir!");
            setReplacementLoading(false);
            return;
          }
          setDateError("");
        }

        // 2) Jam mulai < jam selesai
        if (rescheduleNewStartTime && rescheduleNewEndTime) {
          if (rescheduleNewEndTime <= rescheduleNewStartTime) {
            setTimeError("Jam selesai harus lebih besar dari jam mulai.");
            setReplacementLoading(false);
            return;
          }
          setTimeError("");
        }

        // Approve reschedule - admin akan mengedit jadwal
        await api.post("/notifications/approve-reschedule", {
          notification_id: selectedNotification.id,
          jadwal_id: selectedNotification.data?.jadwal_id,
          jadwal_type: selectedNotification.data?.jadwal_type,
          new_tanggal: rescheduleNewDate,
          new_jam_mulai: rescheduleNewStartTime,
          new_jam_selesai: rescheduleNewEndTime,
          new_ruangan_id: rescheduleNewRuangan,
          new_jumlah_sesi: sessionCount,
        });
      } else if (action === "reject") {
        // Reject reschedule - kembali ke status bisa/tidak_bisa
        await api.post("/notifications/reject-reschedule", {
          notification_id: selectedNotification.id,
          jadwal_id: selectedNotification.data?.jadwal_id,
          jadwal_type: selectedNotification.data?.jadwal_type,
        });
      }

      // Refresh notifications
      await loadNotifications(false);
      await loadStats();

      // Close modal
      setShowRescheduleModal(false);
      setSelectedNotification(null);
      setRescheduleNewDate("");
      setRescheduleNewStartTime("");
      setRescheduleNewEndTime("");
      setRescheduleNewRuangan("");
    } catch (error) {
      console.error("Failed to process reschedule:", error);
    } finally {
      setReplacementLoading(false);
    }
  };

  // Client-side filtering for search and read status
  const getFilteredNotifications = () => {
    // Robust de-duplication: keep only the newest notification per (jadwal_type, jadwal_id, normalized kind)
    // For student notifications (PBL, Kuliah Besar, etc.), include user_id to avoid deduplication between different students
    const normalizeKind = (n: Notification) => {
      // Check notification_type first
      const notificationType = String(
        n.data?.notification_type || ""
      ).toLowerCase();
      if (notificationType.startsWith("reschedule")) return "reschedule";
      if (
        notificationType.includes("konfirmasi") ||
        notificationType.includes("confirm")
      )
        return "confirmation";
      if (
        notificationType.includes("assignment") ||
        notificationType.includes("jadwal")
      )
        return "assignment";

      // If no notification_type, check title and message for patterns
      const title = String(n.title || "").toLowerCase();
      const message = String(n.message || "").toLowerCase();

      // Check for service center notifications
      if (
        title.includes("tiket baru") ||
        title.includes("update status tiket") ||
        message.includes("tiket baru") ||
        message.includes("ticket") ||
        message.includes("bug") ||
        message.includes("feature") ||
        message.includes("contact")
      )
        return "service_center";

      if (title.includes("reschedule") || message.includes("reschedule"))
        return "reschedule";
      if (
        title.includes("konfirmasi") ||
        title.includes("bisa") ||
        title.includes("tidak bisa") ||
        message.includes("konfirmasi") ||
        message.includes("bisa") ||
        message.includes("tidak bisa")
      )
        return "confirmation";
      if (
        title.includes("jadwal") ||
        title.includes("assignment") ||
        message.includes("jadwal") ||
        message.includes("assignment")
      )
        return "assignment";

      return notificationType || "other";
    };

    const byKey: Record<string, Notification> = {};
    const jadwalNotifications: Record<string, Notification[]> = {}; // Track notifications per jadwal

    for (const n of notifications) {
      const type = String(n.data?.jadwal_type || "-").toLowerCase();
      const id = String(n.data?.jadwal_id || "-");
      const kind = normalizeKind(n);

      // For service center notifications, use unique key based on ticket data
      if (kind === "service_center") {
        const ticketId = n.data?.ticket_id || n.id;
        const ticketNumber = n.data?.ticket_number || "";
        const key = `service_center:${ticketId}:${ticketNumber}:${n.id}`;
        
        // Service center notifications should not be deduplicated
        const prev = byKey[key];
        if (!prev || new Date(n.created_at) > new Date(prev.created_at)) {
          byKey[key] = n;
        }
        continue;
      }

      // For student notifications (PBL, Kuliah Besar, Praktikum, etc.), include user_id to avoid deduplication between different students
      // For lecturer notifications, include user_id to allow different dosen to have their own notifications
      const isStudentNotification =
        n.user_type === "Mahasiswa" ||
        n.user_role === "mahasiswa" ||
        n.user_type === "mahasiswa";

      // For dosen notifications: use key with user_id (type:id:user_id) to allow different dosen to have separate notifications
      // This allows assignment notifications for new dosen (Dosen C) to appear separately from old dosen (Dosen B)
      // For student notifications: use kind-based key (type:id:kind:user_id) to allow multiple kinds per jadwal per student
      const key = isStudentNotification
        ? `${type}:${id}:${kind}:${n.user_id}`
        : `${type}:${id}:${n.user_id}`;

      // Track notifications per jadwal for replacement logic
      const jadwalKey = `${type}:${id}`;
      if (!jadwalNotifications[jadwalKey]) {
        jadwalNotifications[jadwalKey] = [];
      }
      jadwalNotifications[jadwalKey].push(n);

      const prev = byKey[key];
      if (!prev) {
        byKey[key] = n;
      } else {
        // Normal deduplication: keep the newest by created_at/created_time
        const prevTime = new Date(
          (prev as any).created_at || prev.created_time || 0
        ).getTime();
        const curTime = new Date(
          (n as any).created_at || n.created_time || 0
        ).getTime();
        if (curTime >= prevTime) byKey[key] = n;
      }
    }

    // Post-process: handle replacement notifications
    // PENTING: Prioritaskan notifikasi "tidak_bisa" yang lebih baru, bahkan jika ada "replacement_success"
    // Ini memungkinkan siklus penggantian: Dosen A tidak bisa → ganti Dosen B → Dosen B tidak bisa → ganti Dosen C → dst
    // PENTING: Logic ini hanya untuk notifikasi admin ("Punya Saya"), bukan untuk notifikasi dosen
    // Untuk notifikasi dosen, setiap dosen punya notifikasinya sendiri (tidak perlu deduplication per jadwal)
    Object.keys(jadwalNotifications).forEach((jadwalKey) => {
      const notifications = jadwalNotifications[jadwalKey];

      // Group notifications by user_id untuk membandingkan per dosen
      const notificationsByUser: Record<number, Notification[]> = {};
      notifications.forEach((n) => {
        const userId = n.user_id;
        if (userId) {
          if (!notificationsByUser[userId]) {
            notificationsByUser[userId] = [];
          }
          notificationsByUser[userId].push(n);
        }
      });

      // Process each user's notifications separately
      Object.keys(notificationsByUser).forEach((userIdStr) => {
        const userId = Number(userIdStr);
        const userNotifications = notificationsByUser[userId];

        // Cari semua notifikasi "tidak_bisa" (status change) untuk dosen ini
        const statusChangeNotifications = userNotifications.filter((n) => {
          const title = String(n.title || "").toLowerCase();
          const message = String(n.message || "").toLowerCase();
          const statusField = (n.data as any)?.status_konfirmasi;
          const isStatusChange =
            title.includes("status konfirmasi diubah") ||
            title.includes("konfirmasi diubah") ||
            title.includes("tidak bisa") ||
            title.includes("tidak dapat") ||
            message.includes("status konfirmasi") ||
            message.includes("diubah menjadi") ||
            message.includes("tidak bisa") ||
            message.includes("tidak dapat") ||
            statusField === "tidak_bisa";

          return isStatusChange;
        });

        // Cari notifikasi "replacement_success" untuk admin (user_id adalah admin)
        // PENTING: "replacement_success" hanya untuk admin, bukan untuk dosen
        const replacementNotifications = userNotifications.filter(
          (n) =>
            (n.data?.admin_action === "replacement_success" ||
              n.title?.toLowerCase().includes("penggantian dosen berhasil")) &&
            // Hanya untuk admin notifications (check user role)
            (n.user_type === "Admin" ||
              n.user_role === "admin" ||
              n.user_role === "super_admin" ||
              n.user_role === "tim_akademik")
        );

        // PENTING: Bandingkan waktu antara "tidak_bisa" TERBARU dan "replacement_success" TERBARU
        // Pilih yang lebih baru, bukan selalu memprioritaskan "tidak_bisa"
        const newestStatusChange =
          statusChangeNotifications.length > 0
            ? statusChangeNotifications.sort((a, b) => {
                const timeA = new Date(
                  a.created_at || a.created_time || 0
                ).getTime();
                const timeB = new Date(
                  b.created_at || b.created_time || 0
                ).getTime();
                return timeB - timeA; // Descending order (newest first)
              })[0]
            : null;

        const newestReplacement =
          replacementNotifications.length > 0
            ? replacementNotifications.sort((a, b) => {
                const timeA = new Date(
                  a.created_at || a.created_time || 0
                ).getTime();
                const timeB = new Date(
                  b.created_at || b.created_time || 0
                ).getTime();
                return timeB - timeA; // Descending order (newest first)
              })[0]
            : null;

        // Bandingkan waktu dan pilih yang lebih baru
        if (newestStatusChange && newestReplacement) {
          const statusChangeTime = new Date(
            newestStatusChange.created_at ||
              newestStatusChange.created_time ||
              0
          ).getTime();
          const replacementTime = new Date(
            newestReplacement.created_at || newestReplacement.created_time || 0
          ).getTime();

          // Hapus hanya notifikasi "tidak_bisa" dan "replacement_success" untuk user ini dan jadwal ini
          // JANGAN hapus notifikasi assignment untuk dosen yang berbeda
          Object.keys(byKey).forEach((key) => {
            // Check if key matches this jadwal and this user
            // Key format:
            // - Dosen: `${type}:${id}:${user_id}`
            // - Student: `${type}:${id}:${kind}:${user_id}`
            // Check if key contains this user_id (after jadwalKey)
            if (key.startsWith(jadwalKey)) {
              const notif = byKey[key];
              // Check if this notification belongs to the current user
              if (notif.user_id === userId) {
                // Hanya hapus jika ini adalah notifikasi "tidak_bisa" atau "replacement_success" untuk user ini
                const isStatusChange = statusChangeNotifications.some(
                  (n) => n.id === notif.id
                );
                const isReplacement = replacementNotifications.some(
                  (n) => n.id === notif.id
                );
                if (isStatusChange || isReplacement) {
              delete byKey[key];
                }
              }
            }
          });

          // Pilih yang lebih baru
          if (replacementTime > statusChangeTime) {
            // "replacement_success" lebih baru, tampilkan ini
          const type = String(
              newestReplacement.data?.jadwal_type || "-"
          ).toLowerCase();
            const id = String(newestReplacement.data?.jadwal_id || "-");
          const isStudentNotification =
              newestReplacement.user_type === "Mahasiswa" ||
              newestReplacement.user_role === "mahasiswa" ||
              newestReplacement.user_type === "mahasiswa";

            const kind = normalizeKind(newestReplacement);
          const replacementKey = isStudentNotification
              ? `${type}:${id}:${kind}:${newestReplacement.user_id}`
              : `${type}:${id}:${newestReplacement.user_id}`;

            byKey[replacementKey] = newestReplacement;
          } else {
            // "tidak_bisa" lebih baru atau sama, tampilkan ini
            const type = String(
              newestStatusChange.data?.jadwal_type || "-"
            ).toLowerCase();
            const id = String(newestStatusChange.data?.jadwal_id || "-");
            const isStudentNotification =
              newestStatusChange.user_type === "Mahasiswa" ||
              newestStatusChange.user_role === "mahasiswa" ||
              newestStatusChange.user_type === "mahasiswa";

            const statusChangeKind = normalizeKind(newestStatusChange);
            const statusChangeKey = isStudentNotification
              ? `${type}:${id}:${statusChangeKind}:${newestStatusChange.user_id}`
              : `${type}:${id}:${newestStatusChange.user_id}`;

            byKey[statusChangeKey] = newestStatusChange;
          }
        } else if (newestStatusChange) {
          // Hanya ada "tidak_bisa", hapus hanya notifikasi "tidak_bisa" dan "replacement_success" yang lama untuk user ini
          Object.keys(byKey).forEach((key) => {
            // Check if key matches this jadwal and this user
            if (key.startsWith(jadwalKey)) {
              const notif = byKey[key];
              // Check if this notification belongs to the current user
              if (notif.user_id === userId) {
                const isStatusChange = statusChangeNotifications.some(
                  (n) => n.id === notif.id
                );
                const isReplacement = replacementNotifications.some(
                  (n) => n.id === notif.id
                );
                if (isStatusChange || isReplacement) {
                  delete byKey[key];
                }
        }
      }
    });

          const type = String(
            newestStatusChange.data?.jadwal_type || "-"
          ).toLowerCase();
          const id = String(newestStatusChange.data?.jadwal_id || "-");
          const isStudentNotification =
            newestStatusChange.user_type === "Mahasiswa" ||
            newestStatusChange.user_role === "mahasiswa" ||
            newestStatusChange.user_type === "mahasiswa";

          const statusChangeKind = normalizeKind(newestStatusChange);
          const statusChangeKey = isStudentNotification
            ? `${type}:${id}:${statusChangeKind}:${newestStatusChange.user_id}`
            : `${type}:${id}:${newestStatusChange.user_id}`;

          byKey[statusChangeKey] = newestStatusChange;
        } else if (newestReplacement) {
          // Hanya ada "replacement_success", hapus hanya notifikasi "tidak_bisa" dan "replacement_success" yang lama untuk user ini
          Object.keys(byKey).forEach((key) => {
            // Check if key matches this jadwal and this user
            if (key.startsWith(jadwalKey)) {
              const notif = byKey[key];
              // Check if this notification belongs to the current user
              if (notif.user_id === userId) {
                const isStatusChange = statusChangeNotifications.some(
                  (n) => n.id === notif.id
                );
                const isReplacement = replacementNotifications.some(
                  (n) => n.id === notif.id
                );
                if (isStatusChange || isReplacement) {
                  delete byKey[key];
                }
              }
            }
          });

          const type = String(
            newestReplacement.data?.jadwal_type || "-"
          ).toLowerCase();
          const id = String(newestReplacement.data?.jadwal_id || "-");
          const isStudentNotification =
            newestReplacement.user_type === "Mahasiswa" ||
            newestReplacement.user_role === "mahasiswa" ||
            newestReplacement.user_type === "mahasiswa";

          const kind = normalizeKind(newestReplacement);
          const replacementKey = isStudentNotification
            ? `${type}:${id}:${kind}:${newestReplacement.user_id}`
            : `${type}:${id}:${newestReplacement.user_id}`;

          byKey[replacementKey] = newestReplacement;
        }
      }); // End of forEach userNotifications
    }); // End of forEach jadwalNotifications

    let filtered = Object.values(byKey);

    // For student notifications, show all notifications as they are already filtered by backend
    // The backend already ensures notifications are sent only to students in the assigned group
    // No additional client-side filtering needed for student notifications

    // Apply search filter first
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (notification) =>
          notification.user_name.toLowerCase().includes(query) ||
          notification.title.toLowerCase().includes(query) ||
          notification.message.toLowerCase().includes(query) ||
          notification.user_type.toLowerCase().includes(query)
      );
    }

    // Apply notification type filter
    if (notificationTypeFilter !== "all") {
      filtered = filtered.filter((notification) => {
        const title = notification.title.toLowerCase();
        const message = notification.message.toLowerCase();

        switch (notificationTypeFilter) {
          case "confirmation":
            return (
              title.includes("konfirmasi") ||
              title.includes("bisa") ||
              title.includes("tidak bisa") ||
              message.includes("konfirmasi") ||
              message.includes("bisa") ||
              message.includes("tidak bisa") ||
              title.includes("ketersediaan") ||
              message.includes("ketersediaan") ||
              title.includes("mengajar") ||
              message.includes("mengajar")
            );
          case "assignment":
            return (
              (title.includes("assignment") ||
                title.includes("tugas") ||
                title.includes("jadwal") ||
                message.includes("assignment") ||
                message.includes("tugas") ||
                message.includes("jadwal")) &&
              !title.includes("konfirmasi") &&
              !message.includes("konfirmasi")
            );
          case "other":
            return (
              !title.includes("konfirmasi") &&
              !title.includes("bisa") &&
              !title.includes("tidak bisa") &&
              !title.includes("assignment") &&
              !title.includes("tugas") &&
              !title.includes("jadwal") &&
              !title.includes("ketersediaan") &&
              !title.includes("mengajar")
            );
          default:
            return true;
        }
      });
    }

    // Apply read status filter
    switch (filter) {
      case "read":
        return filtered.filter((n) => n.is_read);
      case "unread":
        return filtered.filter((n) => !n.is_read);
      default:
        return filtered;
    }
  };

  // Pagination logic
  const filteredNotifications = getFilteredNotifications();
  const totalPages = Math.ceil(filteredNotifications.length / pageSize);
  const paginatedNotifications = filteredNotifications.slice(
    (page - 1) * pageSize,
    page * pageSize
  );

  // Reset page when filters change
  useEffect(() => {
    setPage(1);
  }, [searchQuery, filter, userTypeFilter, notificationTypeFilter]);

  const getStatusBadge = (notification: Notification) => {
    if (notification.is_read) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 border border-green-200 dark:border-green-700">
          <FontAwesomeIcon icon={faCheck} className="w-3 h-3 mr-1" />
          Sudah Dibaca
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700">
          <FontAwesomeIcon icon={faBell} className="w-3 h-3 mr-1" />
          Belum Dibaca
        </span>
      );
    }
  };

  const getTypeIcon = (notification: Notification) => {
    // Check for forum notification types first
    if (notification.data?.notification_type === "forum_created") {
      return faComments;
    } else if (notification.data?.notification_type === "forum_comment") {
      return faComment;
    } else if (notification.data?.notification_type === "forum_reply") {
      return faReply;
    } else if (notification.data?.notification_type === "category_created") {
      return faFolderPlus;
    }

    // Fallback to regular type
    switch (notification.type) {
      case "info":
        return faInfoCircle;
      case "success":
        return faCheckCircle;
      case "warning":
        return faExclamationTriangle;
      case "error":
        return faTimesCircle;
      default:
        return faBell;
    }
  };

  const getTypeColor = (notification: Notification) => {
    // Check for forum notification types first
    if (notification.data?.notification_type === "forum_created") {
      return "text-purple-500";
    } else if (notification.data?.notification_type === "forum_comment") {
      return "text-indigo-500";
    } else if (notification.data?.notification_type === "forum_reply") {
      return "text-cyan-500";
    } else if (notification.data?.notification_type === "category_created") {
      return "text-orange-500";
    }

    // Fallback to regular type
    switch (notification.type) {
      case "info":
        return "text-blue-500";
      case "success":
        return "text-green-500";
      case "warning":
        return "text-yellow-500";
      case "error":
        return "text-red-500";
      default:
        return "text-purple-500";
    }
  };

  const getConfirmationStatus = (notification: Notification) => {
    // Highest priority: explicit status in payload or fetched map
    // Check status_konfirmasi FIRST before checking replacement_success
    const type = String(notification.data?.jadwal_type || "").toLowerCase();
    const id = notification.data?.jadwal_id
      ? Number(notification.data!.jadwal_id)
      : null;
    const key = id ? `${type}:${id}` : "";
    const statusField =
      (notification.data as any)?.status_konfirmasi ||
      (key ? jadwalStatusMap[key] : undefined);

    // If status is "tidak_bisa", prioritize it over replacement_success
    if (statusField) {
      const s = String(statusField).toLowerCase();
      if (s.includes("tidak")) {
        return {
          status: "tidak_bisa",
          color: "text-red-500",
          bgColor: "bg-red-100 dark:bg-red-900/20",
          textColor: "text-red-800 dark:text-red-200",
          icon: faTimesCircle,
          adminInfo: null,
        };
      }
    }

    // PENTING: Persamaan Persepsi dan Seminar Pleno langsung "Bisa Mengajar" tanpa menunggu konfirmasi
    // Jika ini adalah assignment notification atau reminder untuk persamaan persepsi/seminar pleno dan tidak ada status "tidak_bisa",
    // langsung tampilkan status "bisa"
    if ((type === "persamaan_persepsi" || type === "seminar_pleno") && !statusField) {
      const title = String(notification.title || "").toLowerCase();
      const message = String(notification.message || "").toLowerCase();

      // Cek apakah ini assignment notification atau reminder (bukan status change atau replacement)
      const isAssignmentOrReminderNotification =
        (title.includes("jadwal persamaan persepsi") ||
          title.includes("persamaan persepsi baru") ||
          title.includes("pengingat persamaan persepsi") ||
          title.includes("reminder persamaan persepsi") ||
          message.includes("persamaan persepsi") ||
          title.includes("jadwal seminar pleno") ||
          title.includes("seminar pleno baru") ||
          title.includes("pengingat seminar pleno") ||
          title.includes("reminder seminar pleno") ||
          message.includes("seminar pleno")) &&
        !title.includes("status konfirmasi diubah") &&
        !title.includes("tidak bisa") &&
        !message.includes("status konfirmasi diubah") &&
        !message.includes("tidak bisa") &&
        notification.data?.admin_action !== "replacement_success";

      if (isAssignmentOrReminderNotification) {
        return {
          status: "bisa",
          color: "text-green-500",
          bgColor: "bg-green-100 dark:bg-green-900/20",
          textColor: "text-green-800 dark:text-green-200",
          icon: faCheckCircle,
          adminInfo: null,
        };
      }
    }
    
    // PENTING: Untuk Persamaan Persepsi dan Seminar Pleno, jika status_konfirmasi adalah "belum_konfirmasi" atau null,
    // tetap tampilkan sebagai "bisa" karena mereka tidak perlu konfirmasi
    if ((type === "persamaan_persepsi" || type === "seminar_pleno")) {
      const title = String(notification.title || "").toLowerCase();
      const message = String(notification.message || "").toLowerCase();
      
      // Skip jika ini adalah notifikasi "tidak bisa" atau replacement
      const isNotValidNotification =
        title.includes("tidak bisa") ||
        message.includes("tidak bisa") ||
        title.includes("status konfirmasi diubah") ||
        message.includes("status konfirmasi diubah") ||
        notification.data?.admin_action === "replacement_success";
      
      if (!isNotValidNotification) {
        // Jika status adalah "belum_konfirmasi" atau null, tetap tampilkan sebagai "bisa"
        const s = statusField ? String(statusField).toLowerCase() : "";
        if (s.includes("belum_konfirmasi") || s === "pending" || !statusField) {
          return {
            status: "bisa",
            color: "text-green-500",
            bgColor: "bg-green-100 dark:bg-green-900/20",
            textColor: "text-green-800 dark:text-green-200",
            icon: faCheckCircle,
            adminInfo: null,
          };
        }
      }
    }

    // Check if this is a replacement success notification (only if status is not "tidak_bisa")
    if (notification.data?.admin_action === "replacement_success") {
      return {
        status: "replacement_success",
        color: "text-green-500",
        bgColor: "bg-green-100 dark:bg-green-900/20",
        textColor: "text-green-800 dark:text-green-200",
        icon: faCheckCircle,
        adminInfo: null,
      };
    }

    // Get admin info
    const approvedBy = notification.data?.approved_by;
    const rejectedBy = notification.data?.rejected_by;

    if (statusField) {
      const s = String(statusField).toLowerCase();

      // waiting_reschedule precedence
      if (
        s.includes("waiting_reschedule") ||
        s.includes("menunggu_reschedule") ||
        s === "waiting"
      ) {
        return {
          status: "waiting_reschedule",
          color: "text-orange-500",
          bgColor: "bg-orange-100 dark:bg-orange-900/20",
          textColor: "text-orange-800 dark:text-orange-200",
          icon: faClock,
          adminInfo: null,
        };
      }
      // PENTING: Prioritaskan status "tidak_bisa" sebelum replacement_success
      if (s.includes("tidak")) {
        return {
          status: "tidak_bisa",
          color: "text-red-500",
          bgColor: "bg-red-100 dark:bg-red-900/20",
          textColor: "text-red-800 dark:text-red-200",
          icon: faTimesCircle,
          adminInfo: null,
        };
      }
      if (s.includes("bisa")) {
        return {
          status: "bisa",
          color: "text-green-500",
          bgColor: "bg-green-100 dark:bg-green-900/20",
          textColor: "text-green-800 dark:text-green-200",
          icon: faCheckCircle,
          adminInfo: null,
        };
      }
      if (s.includes("belum_konfirmasi") || s === "pending") {
        return {
          status: "pending",
          color: "text-yellow-500",
          bgColor: "bg-yellow-100 dark:bg-yellow-900/20",
          textColor: "text-yellow-800 dark:text-yellow-200",
          icon: faExclamationTriangle,
          adminInfo: null,
        };
      }
    }
    const title = notification.title.toLowerCase();
    const message = notification.message.toLowerCase();

    // Check for "tidak bisa" status FIRST (more specific)
    if (
      title.includes("tidak bisa") ||
      message.includes("tidak bisa") ||
      title.includes("dosen tidak bisa") ||
      message.includes("dosen tidak bisa") ||
      title.includes("konfirmasi tidak bisa") ||
      message.includes("konfirmasi tidak bisa") ||
      title.includes("tidak dapat") ||
      message.includes("tidak dapat") ||
      title.includes("dosen tidak dapat") ||
      message.includes("dosen tidak dapat") ||
      title.includes("tidak dapat mengajar") ||
      message.includes("tidak dapat mengajar") ||
      // Check if this is a notification for a replaced lecturer
      notification.data?.alasan_konfirmasi === "Diganti dosen lain" ||
      notification.data?.alasan_konfirmasi === "diganti dosen lain" ||
      message.includes("diganti dosen lain") ||
      title.includes("diganti dosen lain")
    ) {
      return {
        status: "tidak_bisa",
        color: "text-red-500",
        bgColor: "bg-red-100 dark:bg-red-900/20",
        textColor: "text-red-800 dark:text-red-200",
        icon: faTimesCircle,
        adminInfo: null,
      };
    }
    // Check for "bisa" status SECOND (less specific)
    else if (
      title.includes("bisa") ||
      message.includes("bisa") ||
      title.includes("dosen bisa") ||
      message.includes("dosen bisa") ||
      title.includes("konfirmasi bisa") ||
      message.includes("konfirmasi bisa")
    ) {
      return {
        status: "bisa",
        color: "text-green-500",
        bgColor: "bg-green-100 dark:bg-green-900/20",
        textColor: "text-green-800 dark:text-green-200",
        icon: faCheckCircle,
        adminInfo: null,
      };
    }
    // Check if it's a confirmation request (not yet confirmed)
    // BUT only if we don't have explicit status from statusField
    else if (
      !statusField &&
      (title.includes("konfirmasi") ||
        message.includes("konfirmasi") ||
        title.includes("ketersediaan") ||
        message.includes("ketersediaan"))
    ) {
      return {
        status: "pending",
        color: "text-yellow-500",
        bgColor: "bg-yellow-100 dark:bg-yellow-900/20",
        textColor: "text-yellow-800 dark:text-yellow-200",
        icon: faExclamationTriangle,
        adminInfo: null,
      };
    }

    // Check for reschedule status and admin info
    const rescheduleStatus = notification.data?.status_reschedule;
    if (rescheduleStatus === "approved" && approvedBy) {
      return {
        status: "reschedule_approved",
        color: "text-blue-500",
        bgColor: "bg-blue-100 dark:bg-blue-900/20",
        textColor: "text-blue-800 dark:text-blue-200",
        icon: faCheckCircle,
        adminInfo: `Disetujui oleh ${approvedBy}`,
      };
    } else if (rescheduleStatus === "rejected" && rejectedBy) {
      return {
        status: "reschedule_rejected",
        color: "text-red-500",
        bgColor: "bg-red-100 dark:bg-red-900/20",
        textColor: "text-red-800 dark:text-red-200",
        icon: faTimesCircle,
        adminInfo: `Ditolak oleh ${rejectedBy}`,
      };
    }

    return null;
  };

  if (loading) {
    return (
      <div className="w-full mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-64 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-96 animate-pulse"></div>
        </div>

        {/* Statistics Cards Skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 5 }).map((_, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4 animate-pulse"
            >
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700"></div>
              <div className="flex-1">
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
              </div>
            </div>
          ))}
        </div>

        {/* Filter Section Skeleton */}
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] px-6 py-5 mb-8">
          {/* Row 1: Search Bar Skeleton */}
          <div className="mb-4">
            <div className="relative max-w-md">
              <div className="h-11 bg-gray-200 dark:bg-gray-700 rounded-lg border border-gray-300 dark:border-gray-600 animate-pulse"></div>
            </div>
            </div>

          {/* Row 2: Filter Dropdowns and Action Buttons Skeleton */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
            {/* Filter Dropdowns Group Skeleton - 3 dropdowns */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
              {/* Dropdown 1: Punya Saya / Notifikasi ke Dosen / Notifikasi ke Mahasiswa */}
              <div className="h-11 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 animate-pulse w-full sm:w-48"></div>
              {/* Dropdown 2: Semua Jenis / Konfirmasi Jadwal / Assignment / Lainnya */}
              <div className="h-11 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 animate-pulse w-full sm:w-48"></div>
              {/* Dropdown 3: Semua Status / Belum Dibaca / Sudah Dibaca */}
              <div className="h-11 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-300 dark:border-gray-700 animate-pulse w-full sm:w-48"></div>
            </div>

            {/* Action Buttons Group Skeleton */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
              {/* Refresh Button */}
              <div className="h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-full sm:w-24"></div>
              {/* Conditional buttons (only show when userTypeFilter === "dosen") */}
              <div className="h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-full sm:w-40"></div>
              <div className="h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-full sm:w-36"></div>
              {/* Reset Button */}
              <div className="h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-full sm:w-32"></div>
            </div>
          </div>
        </div>

        {/* Notifications List Skeleton */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-48 mb-2 animate-pulse"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-32 animate-pulse"></div>
            </div>
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-full w-24 animate-pulse"></div>
          </div>

          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar Skeleton */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700"></div>
                  </div>

                  {/* Content Skeleton */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-32 mb-2"></div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-16"></div>
                          <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded-full w-20"></div>
                        </div>
                      </div>
                      <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>

                    <div className="mb-3">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-48 mb-2"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-lg w-full mb-1"></div>
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-lg w-3/4"></div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-lg w-20"></div>
                        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-lg w-16"></div>
                      </div>
                      <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded-lg w-20"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Pagination Skeleton */}
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-32"></div>
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded-lg w-48"></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-20"></div>
              <div className="flex gap-1">
                {Array.from({ length: 3 }).map((_, idx) => (
                  <div
                    key={idx}
                    className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-lg"
                  ></div>
                ))}
              </div>
              <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded-lg w-20"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <FontAwesomeIcon
            icon={faTimesCircle}
            className="text-red-500 text-6xl mb-4"
          />
          <h2 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
            Error
          </h2>
          <p className="text-gray-600 dark:text-gray-300 mb-4">{error}</p>
          <button
            onClick={() => loadNotifications(true)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
          {userRole === "tim_akademik"
            ? "Notifikasi Tim Akademik"
            : "Notifikasi Admin"}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {userRole === "tim_akademik"
            ? "Kelola notifikasi dan pantau status pembacaan dosen"
            : "Kelola notifikasi dan pantau status pembacaan dosen"}
        </p>
      </div>

      {/* Statistics Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faBell}
                className="w-5 h-5 text-blue-500"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Total Notifikasi
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.total_notifications}
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faCheck}
                className="w-5 h-5 text-green-500"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Sudah Dibaca
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {stats.read_notifications}
              </div>
            </div>
          </div>
          {/* Only show confirmation stats for dosen notifications */}
          {userTypeFilter === "dosen" && (
            <>
              <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    className="w-5 h-5 text-green-500"
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Bisa Mengajar
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.confirmation_breakdown?.bisa_mengajar || 0}
                  </div>
                </div>
              </div>
              <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faTimesCircle}
                    className="w-5 h-5 text-red-500"
                  />
                </div>
                <div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">
                    Tidak Bisa Mengajar
                  </div>
                  <div className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.confirmation_breakdown?.tidak_bisa_mengajar || 0}
                  </div>
                </div>
              </div>
            </>
          )}
          {/* Reschedule Stats (client-side) */}
          <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faClock}
                className="w-5 h-5 text-yellow-600"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Menunggu Reschedule
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {rescheduleStats.waiting}
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faCheckCircle}
                className="w-5 h-5 text-green-600"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Reschedule Disetujui
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {rescheduleStats.approved}
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faTimesCircle}
                className="w-5 h-5 text-red-600"
              />
            </div>
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                Reschedule Ditolak
              </div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {rescheduleStats.rejected}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Filter Section */}
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] px-6 py-5 mb-8">
        {/* Row 1: Search Bar */}
        <div className="mb-4">
          <div className="relative max-w-md">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
              <svg
                className="w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </span>
            <input
              type="text"
              placeholder="Cari notifikasi..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
          </div>
        </div>

        {/* Row 2: Filter Dropdowns and Action Buttons */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          {/* Filter Dropdowns Group */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 flex-1">
            <select
              value={userTypeFilter}
              onChange={(e) =>
                setUserTypeFilter(
                  e.target.value as "my_notifications" | "dosen" | "mahasiswa"
                )
              }
              className="h-11 text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
            >
              <option value="my_notifications">Punya Saya</option>
              <option value="dosen">Notifikasi ke Dosen</option>
              <option value="mahasiswa">Notifikasi ke Mahasiswa</option>
            </select>
            <select
              value={notificationTypeFilter}
              onChange={(e) =>
                setNotificationTypeFilter(
                  e.target.value as
                    | "all"
                    | "confirmation"
                    | "assignment"
                    | "other"
                )
              }
              className="h-11 text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
            >
              <option value="all">Semua Jenis</option>
              <option value="confirmation">Konfirmasi Jadwal</option>
              <option value="assignment">Assignment</option>
              <option value="other">Lainnya</option>
            </select>
            <select
              value={filter}
              onChange={(e) =>
                setFilter(e.target.value as "all" | "read" | "unread")
              }
              className="h-11 text-sm px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500 transition-colors"
            >
              <option value="all">Semua Status</option>
              <option value="unread">Belum Dibaca</option>
              <option value="read">Sudah Dibaca</option>
            </select>
          </div>

          {/* Action Buttons Group */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 flex-shrink-0">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="h-11 flex items-center justify-center gap-2 px-4 text-sm bg-brand-500 text-white rounded-lg shadow hover:bg-brand-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isRefreshing ? (
                <svg
                  className="animate-spin h-4 w-4"
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
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  ></path>
                </svg>
              ) : (
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                  />
                </svg>
              )}
              <span>Refresh</span>
            </button>
            
            {/* Dosen-specific Action Buttons */}
            {userTypeFilter === "dosen" && (
              <>
              <button
                onClick={async () => {
                  // Reset jadwal type filter saat membuka modal agar semua jadwal muncul
                  setPendingDosenJadwalType("");
                  await loadPendingDosen(
                    pendingDosenPage,
                    pendingDosenPageSize,
                    pendingDosenSemester,
                    pendingDosenBlok,
                    pendingDosenReminderType,
                    "" // Reset to empty to show all jadwal types
                  );
                    setSelectedReminderDosen(new Set());
                  setShowReminderModal(true);
                }}
                  className="h-11 flex items-center justify-center gap-2 px-4 text-sm bg-orange-500 text-white rounded-lg shadow hover:bg-orange-600 transition-colors font-semibold whitespace-nowrap"
              >
                <FontAwesomeIcon icon={faRedo} className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    Kirim Ulang Notifikasi
                  </span>
                  <span className="sm:hidden">Kirim Ulang</span>
              </button>
                <button
                  onClick={async () => {
                    await loadPendingDosen(
                      pendingDosenPage,
                      pendingDosenPageSize,
                      pendingDosenSemester,
                      pendingDosenBlok,
                      "unconfirmed",
                      pendingDosenJadwalType // PERBAIKAN: Include jadwal type filter
                    );
                    setShowChangeStatusModal(true);
                  }}
                  className="h-11 flex items-center justify-center gap-2 px-4 text-sm bg-blue-500 text-white rounded-lg shadow hover:bg-blue-600 transition-colors font-semibold whitespace-nowrap"
                >
                  <FontAwesomeIcon icon={faCog} className="w-4 h-4" />
                  <span className="hidden sm:inline">
                    Ubah Status Konfirmasi
                  </span>
                  <span className="sm:hidden">Ubah Status</span>
                </button>
              </>
            )}
            
            {/* Reset Button */}
            <button
              onClick={() => {
                setResetScope("all");
                setShowResetModal(true);
              }}
              className="h-11 flex items-center justify-center gap-2 px-4 text-sm bg-red-500 text-white rounded-lg shadow hover:bg-red-600 transition-colors font-semibold whitespace-nowrap"
            >
              <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
              <span className="hidden sm:inline">Reset Notification</span>
              <span className="sm:hidden">Reset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Daftar Notifikasi */}
      <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-800 dark:text-white/90 mb-1">
              Daftar Notifikasi
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {filteredNotifications.length} notifikasi tersedia
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 text-xs font-medium rounded-full">
              Halaman {page} dari {totalPages}
            </span>
          </div>
        </div>

        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12">
            <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-orange-100 dark:bg-orange-900/20 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faBell}
                className="w-10 h-10 text-orange-500"
              />
            </div>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
              Tidak ada notifikasi
            </h3>
            <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto">
              {userTypeFilter === "my_notifications"
                ? "Belum ada notifikasi untuk Anda"
                : userTypeFilter === "dosen"
                ? "Belum ada notifikasi yang diterima dosen"
                : userTypeFilter === "mahasiswa"
                ? "Belum ada notifikasi yang diterima mahasiswa"
                : filter === "all"
                ? "Belum ada notifikasi yang dikirim ke sistem"
                : filter === "read"
                ? "Belum ada notifikasi yang telah dibaca oleh pengguna"
                : "Semua notifikasi telah dibaca dengan baik"}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {paginatedNotifications.map((notification) => (
              <div
                key={notification.id}
                onClick={() => handleNotificationClick(notification)}
                className="group relative bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-700 rounded-xl p-4 transition-all duration-200 cursor-pointer hover:shadow-md"
              >
                <div className="flex items-start gap-4">
                  {/* Avatar */}
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center">
                      <FontAwesomeIcon
                        icon={faUser}
                        className="w-6 h-6 text-white"
                      />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <h4 className="font-semibold text-gray-900 dark:text-white text-sm mb-1">
                          {notification.data?.admin_action ===
                            "replacement_success" &&
                          notification.data?.new_dosen
                            ? notification.data.new_dosen // Tampilkan nama dosen pengganti untuk replacement_success
                            : (notification.title?.includes(
                                "Status Konfirmasi Diubah"
                              ) ||
                                notification.title?.includes(
                                  "Dosen Tidak Bisa Mengajar"
                                )) &&
                              notification.data?.dosen_name
                            ? notification.data.dosen_name // Tampilkan nama dosen untuk status change atau tidak bisa mengajar
                            : notification.user_name !== "Unknown User"
                            ? notification.user_name
                            : "Sistem"}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full">
                            {notification.data?.admin_action ===
                              "replacement_success" &&
                            notification.data?.new_dosen
                              ? "Dosen" // Tampilkan "Dosen" untuk replacement_success karena ini tentang dosen pengganti
                              : (notification.title?.includes(
                                  "Status Konfirmasi Diubah"
                                ) ||
                                  notification.title?.includes(
                                    "Dosen Tidak Bisa Mengajar"
                                  )) &&
                                notification.data?.dosen_name
                              ? "Dosen" // Tampilkan "Dosen" untuk status change atau tidak bisa mengajar karena ini tentang dosen
                              : notification.user_type}
                          </span>
                          {getConfirmationStatus(notification)?.adminInfo && (
                            <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-600 dark:text-blue-300 text-xs font-medium rounded-full">
                              {getConfirmationStatus(notification)?.adminInfo}
                            </span>
                          )}
                          {getJadwalTypeBadge(
                            notification.data?.jadwal_type,
                            notification
                          )}
                          {getStatusBadge(notification)}
                          {getConfirmationStatus(notification) && (
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                notification.data?.admin_action ===
                                "replacement_success"
                                  ? "bg-green-100 dark:bg-green-800 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-700"
                                  : getConfirmationStatus(notification)?.bgColor
                              } ${
                                notification.data?.admin_action ===
                                "replacement_success"
                                  ? ""
                                  : getConfirmationStatus(notification)
                                      ?.textColor
                              } ${
                                notification.data?.admin_action ===
                                "replacement_success"
                                  ? ""
                                  : "border " +
                                    (getConfirmationStatus(notification)
                                      ?.status === "bisa"
                                      ? "border-green-200 dark:border-green-700"
                                      : getConfirmationStatus(notification)
                                          ?.status === "tidak_bisa"
                                      ? "border-red-200 dark:border-red-700"
                                      : "border-yellow-200 dark:border-yellow-700")
                              }`}
                            >
                              <FontAwesomeIcon
                                icon={
                                  notification.data?.admin_action ===
                                  "replacement_success"
                                    ? faCheckCircle
                                    : getConfirmationStatus(notification)
                                        ?.icon || faBell
                                }
                                className="w-3 h-3 mr-1"
                              />
                              {notification.data?.admin_action ===
                              "replacement_success"
                                ? "Berhasil Diganti"
                                : getConfirmationStatus(notification)
                                    ?.status === "bisa"
                                ? "Bisa Mengajar"
                                : getConfirmationStatus(notification)
                                    ?.status === "tidak_bisa"
                                ? "Tidak Bisa Mengajar"
                                : getConfirmationStatus(notification)
                                    ?.status === "waiting_reschedule"
                                ? "Menunggu Reschedule"
                                : "Menunggu Konfirmasi"}
                            </span>
                          )}
                          {/* Action button for "Tidak Bisa Mengajar" notifications */}
                          {/* PENTING: Tombol "Kelola" muncul di "Punya Saya" (my_notifications) untuk SEMUA jenis jadwal jika:
                              1. Status tidak_bisa, DAN
                              2. Bukan replacement_success, DAN
                              3. Di filter "Punya Saya"
                              Ini memungkinkan siklus penggantian bolak-balik untuk semua jenis jadwal (PBL, Kuliah Besar, Praktikum, Jurnal Reading, CSR, Non Blok Non CSR) */}
                          {(() => {
                            const status =
                              getConfirmationStatus(notification)?.status;
                            // Hanya tampilkan jika status tidak_bisa, bukan replacement_success, dan di "Punya Saya"
                            // PENTING: Logika ini berlaku untuk SEMUA jenis jadwal, bukan hanya PBL
                            if (
                              status !== "tidak_bisa" ||
                              notification.data?.admin_action ===
                                "replacement_success" ||
                              userTypeFilter !== "my_notifications"
                            ) {
                              return null;
                            }

                            // PENTING: Tombol "Kelola" muncul untuk semua jenis jadwal yang statusnya "tidak_bisa"
                            // Tidak perlu cek jadwalDetailMap karena:
                            // 1. prefetchJadwalStatuses sudah di-disable (menyebabkan 404 errors)
                            // 2. Status "tidak_bisa" sudah cukup untuk menampilkan tombol "Kelola"
                            // 3. Backend replaceDosen sudah handle semua jenis jadwal (pbl, kuliah_besar, praktikum, jurnal_reading, csr, non_blok_non_csr)

                            // Tampilkan tombol "Kelola" untuk semua jenis jadwal yang statusnya "tidak_bisa"
                            return (
                              <button
                                onClick={() =>
                                  handleOpenReplacementModal(notification)
                                }
                                className="inline-flex items-center px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white text-xs font-medium rounded-lg transition-colors duration-200"
                                title="Kelola Penggantian Dosen"
                              >
                                <FontAwesomeIcon
                                  icon={faCog}
                                  className="w-3 h-3 mr-1"
                                />
                                Kelola
                              </button>
                            );
                          })()}
                          {/* Action button for "Reschedule" notifications */}
                          {notification.data?.notification_type ===
                            "reschedule_request" && (
                            <button
                              onClick={() =>
                                handleOpenRescheduleModal(notification)
                              }
                              className="inline-flex items-center px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white text-xs font-medium rounded-lg transition-colors duration-200"
                              title="Kelola Permintaan Reschedule"
                            >
                              <FontAwesomeIcon
                                icon={faClock}
                                className="w-3 h-3 mr-1"
                              />
                              Reschedule
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="flex-shrink-0">
                        <FontAwesomeIcon
                          icon={getTypeIcon(notification)}
                          className={`w-5 h-5 ${getTypeColor(notification)}`}
                        />
                      </div>
                    </div>

                    <div className="mb-3">
                      <h5 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                        {notification.title}
                      </h5>
                      <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                        {notification.message}
                      </p>
                      {/* Additional info for forum notifications */}
                      {notification.data?.notification_type && (
                        <div className="flex items-center gap-2 mt-2">
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
                          {notification.data?.notification_type && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                              {notification.data.notification_type
                                .replace("_", " ")
                                .toUpperCase()}
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                      <div className="flex items-center gap-4">
                        <span className="flex items-center gap-1">
                          <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
                          {notification.created_time}
                        </span>
                        <span className="text-gray-400 dark:text-gray-500">
                          {notification.created_time_ago}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pagination */}
        {filteredNotifications.length > 0 && (
          <div className="mt-8 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setPage(1);
                }}
                className="px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {PAGE_SIZE_OPTIONS.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt} per halaman
                  </option>
                ))}
              </select>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Menampilkan {(page - 1) * pageSize + 1} -{" "}
                {Math.min(page * pageSize, filteredNotifications.length)} dari{" "}
                {filteredNotifications.length} notifikasi
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sebelumnya
              </button>

              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  if (totalPages <= 5) {
                    return (
                      <button
                        key={pageNum}
                        onClick={() => setPage(pageNum)}
                        className={`px-3 py-2 rounded-lg text-sm font-medium border transition-colors ${
                          page === pageNum
                            ? "bg-blue-500 text-white border-blue-500"
                            : "border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  }
                  return null;
                })}
                {totalPages > 5 && (
                  <span className="px-3 py-2 text-sm text-gray-500 dark:text-gray-400">
                    ...
                  </span>
                )}
              </div>

              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="px-4 py-2 rounded-lg text-sm font-medium border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Selanjutnya
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Dosen Replacement Modal */}
      <AnimatePresence mode="wait">
        {showReplacementModal && selectedNotification && (
          <motion.div
            key="replacement-modal"
            className="fixed inset-0 z-[100000] flex items-center justify-center"
          >
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowReplacementModal(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] flex flex-col"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowReplacementModal(false)}
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

              <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto hide-scroll pr-2 -mr-2">
                {/* Header */}
                <div className="flex items-center space-x-4 mb-6 flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={faCog}
                      className="w-6 h-6 text-blue-600 dark:text-blue-400"
                    />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                      Kelola Penggantian Dosen
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Penerima: {selectedNotification.user_name}
                    </p>
                  </div>
                </div>

                {/* Jadwal Info */}
                <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 flex-shrink-0">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                    Detail Jadwal
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">
                        Mata Kuliah:
                      </span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedNotification.data?.mata_kuliah || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">
                        Tanggal:
                      </span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedNotification.data?.tanggal || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">
                        Waktu:
                      </span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedNotification.data?.waktu || "N/A"}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">
                        Ruangan:
                      </span>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {selectedNotification.data?.ruangan || "N/A"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Action Selection */}
                <div className="mb-4 flex-shrink-0">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Pilih Aksi:
                  </h4>
                  <div className="space-y-3">
                    {/* Ask Again Option */}
                    <label
                      className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        replacementAction === "ask_again"
                          ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 ${
                          replacementAction === "ask_again"
                            ? "bg-blue-500 border-blue-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {replacementAction === "ask_again" && (
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
                        name="replacementAction"
                        value="ask_again"
                        checked={replacementAction === "ask_again"}
                        onChange={(e) =>
                          setReplacementAction(e.target.value as "ask_again")
                        }
                        className="sr-only"
                      />
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon
                            icon={faRedo}
                            className="w-5 h-5 text-yellow-600 dark:text-yellow-400"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Minta Dosen yang Sama Mengajar Lagi
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Dosen akan diminta untuk konfirmasi ulang
                          </p>
                        </div>
                      </div>
                    </label>

                    {/* Replace Option */}
                    <label
                      className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                        replacementAction === "replace"
                          ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-600"
                          : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 ${
                          replacementAction === "replace"
                            ? "bg-green-500 border-green-500"
                            : "border-gray-300 dark:border-gray-600"
                        }`}
                      >
                        {replacementAction === "replace" && (
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
                        name="replacementAction"
                        value="replace"
                        checked={replacementAction === "replace"}
                        onChange={(e) =>
                          setReplacementAction(e.target.value as "replace")
                        }
                        className="sr-only"
                      />
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                          <FontAwesomeIcon
                            icon={faUserPlus}
                            className="w-5 h-5 text-green-600 dark:text-green-400"
                          />
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            Pilih Dosen Pengganti
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            Ganti dengan dosen lain yang tersedia
                          </p>
                        </div>
                      </div>
                    </label>
                  </div>
                </div>

                {/* Dosen Selection (only if replace is selected) */}
                {replacementAction === "replace" && (
                    <div className="mb-4 flex-shrink-0">
                    <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                      Pilih Dosen Pengganti:
                    </h4>

                    {/* Search Bar */}
                    <div className="mb-3">
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg
                            className="h-5 w-5 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                        </div>
                        <input
                          type="text"
                          placeholder="Cari nama dosen..."
                          value={dosenSearchQuery}
                            onChange={(e) =>
                              setDosenSearchQuery(e.target.value)
                            }
                          className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                      </div>
                    </div>

                    {loadingDosen ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          Memuat daftar dosen...
                        </p>
                      </div>
                    ) : (
                      <div className="max-h-40 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-xl hide-scroll">
                        {filteredDosenList.length === 0 ? (
                          <div className="text-center py-8">
                            <p className="text-gray-500 dark:text-gray-400">
                              {dosenSearchQuery
                                ? "Tidak ada dosen yang cocok dengan pencarian"
                                : "Tidak ada dosen tersedia"}
                            </p>
                          </div>
                        ) : (
                          <div className="space-y-2 p-2">
                            {filteredDosenList.map((dosen) => {
                              // Check if dosen is standby based on keahlian
                              const isStandby = Array.isArray(dosen.keahlian)
                                ? dosen.keahlian.some((k: string) =>
                                    k.toLowerCase().includes("standby")
                                  )
                                : (dosen.keahlian || "")
                                    .toLowerCase()
                                    .includes("standby");

                              const avatar = getAvatarFromName(
                                dosen.name,
                                isStandby
                              );
                              return (
                                <label
                                  key={dosen.id}
                                  className={`flex items-center p-3 border rounded-lg cursor-pointer transition-all duration-200 ${
                                    selectedDosen?.id === dosen.id
                                      ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600"
                                      : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                                  }`}
                                >
                                  <div
                                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center mr-3 ${
                                      selectedDosen?.id === dosen.id
                                        ? "bg-blue-500 border-blue-500"
                                        : "border-gray-300 dark:border-gray-600"
                                    }`}
                                  >
                                    {selectedDosen?.id === dosen.id && (
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
                                    name="selectedDosen"
                                    value={dosen.id}
                                    checked={selectedDosen?.id === dosen.id}
                                    onChange={() => setSelectedDosen(dosen)}
                                    className="sr-only"
                                  />
                                  {/* Avatar */}
                                  <div
                                    className={`w-10 h-10 ${avatar.color} rounded-full flex items-center justify-center text-white font-semibold text-sm mr-3`}
                                  >
                                    {avatar.initial}
                                  </div>
                                  {/* Dosen Info */}
                                  <div className="flex-1">
                                    <div className="flex items-center gap-2">
                                      <p className="font-medium text-gray-900 dark:text-white">
                                        {dosen.name}
                                      </p>
                                      {isStandby && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300 text-xs font-medium">
                                          Standby
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {dosen.email}
                                    </p>
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-4 flex-shrink-0 border-t border-gray-200 dark:border-gray-700 mt-auto">
                  <button
                    onClick={() => setShowReplacementModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleReplacementSubmit}
                    disabled={
                      replacementLoading ||
                      (replacementAction === "replace" && !selectedDosen)
                    }
                    className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium shadow-lg hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {replacementLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faCheck} className="w-4 h-4" />
                        <span>Proses</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Reschedule Modal */}
      <AnimatePresence mode="wait">
        {showRescheduleModal && selectedNotification && (
          <motion.div
            key="reschedule-modal"
            className="fixed inset-0 z-[100000] flex items-center justify-center"
          >
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowRescheduleModal(false)}
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
                        icon={faClock}
                        className="w-6 h-6 text-orange-600 dark:text-orange-400"
                      />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                        Kelola Permintaan Reschedule
                      </h2>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Penerima: {selectedNotification.user_name}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Alasan Reschedule */}
                <div className="mb-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-700 rounded-xl">
                  <h4 className="text-sm font-semibold text-orange-800 dark:text-orange-200 mb-2">
                    Alasan Reschedule:
                  </h4>
                  <p className="text-sm text-orange-700 dark:text-orange-300">
                    {selectedNotification.data?.reschedule_reason}
                  </p>
                </div>

                {/* Informasi Tanggal Mulai & Akhir (dua card) */}
                <div className="mb-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Tanggal Mulai
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {rescheduleMinDate
                        ? formatDateID(rescheduleMinDate)
                        : "-"}
                    </div>
                  </div>
                  <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-xl">
                    <div className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-1">
                      Tanggal Akhir
                    </div>
                    <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {rescheduleMaxDate
                        ? formatDateID(rescheduleMaxDate)
                        : "-"}
                    </div>
                  </div>
                </div>

                {/* Form Edit Jadwal */}
                <div className="space-y-6">
                  <h4 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Edit Jadwal Baru
                  </h4>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Tanggal Baru
                        </label>
                        <input
                          type="date"
                          value={rescheduleNewDate}
                          onChange={(e) => {
                            setRescheduleNewDate(e.target.value);
                            // realtime validate like DetailBlok
                            if (rescheduleMinDate || rescheduleMaxDate) {
                              const valTime = new Date(
                                e.target.value
                              ).getTime();
                              const minV = rescheduleMinDate
                                ? new Date(rescheduleMinDate).getTime()
                                : undefined;
                              const maxV = rescheduleMaxDate
                                ? new Date(rescheduleMaxDate).getTime()
                                : undefined;
                              if (minV !== undefined && valTime < minV) {
                                setDateError(
                                  "Tanggal tidak boleh sebelum tanggal mulai!"
                                );
                              } else if (maxV !== undefined && valTime > maxV) {
                                setDateError(
                                  "Tanggal tidak boleh setelah tanggal akhir!"
                                );
                              } else {
                                setDateError("");
                              }
                            }
                          }}
                          min={rescheduleMinDate || undefined}
                          max={rescheduleMaxDate || undefined}
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-orange-500 dark:focus:ring-orange-600 focus:border-transparent transition-colors"
                        />
                        {dateError ? (
                          <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                            {dateError}
                          </p>
                        ) : (
                          (rescheduleMinDate || rescheduleMaxDate) && (
                            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                              Periode MK: {rescheduleMinDate || "?"} –{" "}
                              {rescheduleMaxDate || "?"}
                            </p>
                          )
                        )}
                      </div>

                      {shouldShowRoomField() && (
                        <div className="relative">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Ruangan Baru
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowRoomMenu((v) => !v)}
                            className={`w-full text-left px-4 py-3 border ${
                              roomError
                                ? "border-red-500"
                                : "border-gray-300 dark:border-gray-600"
                            } rounded-2xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-brand-500/30 dark:focus:ring-brand-500/30 focus:border-brand-300 dark:focus:border-brand-700 transition-colors`}
                          >
                            {(() => {
                              const sel = ruanganList.find(
                                (r: any) =>
                                  String(r.id) === String(rescheduleNewRuangan)
                              );
                              if (!sel) return "Pilih Ruangan";
                              const cap = sel.kapasitas
                                ? ` (Kapasitas: ${sel.kapasitas} orang)`
                                : "";
                              const gdg = sel.gedung
                                ? ` - Gedung ${sel.gedung}`
                                : "";
                              return `${sel.nama}${cap}${gdg}`;
                            })()}
                            <span className="float-right opacity-60">▾</span>
                          </button>
                          {showRoomMenu && (
                            <div className="absolute z-[100002] mt-2 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg max-h-56 overflow-y-auto">
                              <div
                                className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 rounded-t-2xl"
                                onClick={() => {
                                  setRescheduleNewRuangan("");
                                  setRoomError("Silakan pilih ruangan.");
                                  setShowRoomMenu(false);
                                }}
                              >
                                Pilih Ruangan
                              </div>
                              {ruanganList.map((ruangan: any, idx: number) => (
                                <div
                                  key={ruangan.id}
                                  className={`px-4 py-2 text-sm cursor-pointer ${
                                    String(rescheduleNewRuangan) ===
                                    String(ruangan.id)
                                      ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                                      : "text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                                  } ${
                                    idx === ruanganList.length - 1
                                      ? "rounded-b-2xl"
                                      : ""
                                  }`}
                                  onClick={() => {
                                    setRescheduleNewRuangan(String(ruangan.id));
                                    setRoomError("");
                                    setShowRoomMenu(false);
                                  }}
                                >
                                  <div className="font-medium">
                                    {ruangan.nama}
                                  </div>
                                  <div className="text-xs opacity-70">
                                    {ruangan.kapasitas
                                      ? `Kapasitas: ${ruangan.kapasitas} orang`
                                      : ""}
                                    {ruangan.kapasitas && ruangan.gedung
                                      ? " • "
                                      : ""}
                                    {ruangan.gedung
                                      ? `Gedung ${ruangan.gedung}`
                                      : ""}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                          {roomError && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                              {roomError}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div>
                      <div className="grid grid-cols-12 gap-3">
                        <div className="col-span-7">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Jam Mulai Baru
                          </label>
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => setShowStartTimeMenu((v) => !v)}
                              className="w-full text-left px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm focus:ring-2 focus:ring-brand-500/30 dark:focus:ring-brand-500/30 focus:border-brand-300 dark:focus:border-brand-700 transition-colors"
                            >
                              {rescheduleNewStartTime || "Pilih Jam Mulai"}
                              <span className="float-right opacity-60">▾</span>
                            </button>
                            {showStartTimeMenu && (
                              <div className="absolute z-[100002] mt-2 w-full bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-lg max-h-56 overflow-y-auto">
                                {jamOptions.map((opt, idx) => (
                                  <div
                                    key={opt}
                                    className={`px-4 py-2 text-sm cursor-pointer ${
                                      rescheduleNewStartTime === opt
                                        ? "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300"
                                        : "text-gray-800 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800"
                                    } ${
                                      idx === jamOptions.length - 1
                                        ? "rounded-b-2xl"
                                        : ""
                                    }`}
                                    onClick={() => {
                                      setRescheduleNewStartTime(opt);
                                      setShowStartTimeMenu(false);
                                      recomputeEndTime(opt, sessionCount);
                                    }}
                                  >
                                    {opt}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="col-span-5">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            x 50 menit
                          </label>
                          <select
                            value={sessionCount}
                            onChange={(e) => {
                              const v = parseInt(e.target.value, 10) || 1;
                              setSessionCount(v);
                              if (rescheduleNewStartTime)
                                recomputeEndTime(rescheduleNewStartTime, v);
                            }}
                            disabled={!isSessionEditable()}
                            className={`w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white ${
                              !isSessionEditable()
                                ? "opacity-50 cursor-not-allowed"
                                : ""
                            }`}
                          >
                            {getSessionOptions().map((s) => (
                              <option key={s} value={s}>{`${s} x 50'`}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Jam Selesai Baru
                      </label>
                      <input
                        type="text"
                        value={rescheduleNewEndTime || ""}
                        disabled
                        className="w-full px-4 py-3 border border-gray-200 dark:border-gray-700 rounded-2xl bg-gray-50 dark:bg-gray-800 text-gray-500 dark:text-gray-400"
                      />
                      {timeError && (
                        <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                          {timeError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowRescheduleModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>

                  <button
                    onClick={() => handleRescheduleSubmit("reject")}
                    disabled={replacementLoading}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-lg hover:bg-red-600 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    <FontAwesomeIcon icon={faTimesCircle} className="w-4 h-4" />
                    <span>Tolak</span>
                  </button>

                  <button
                    onClick={() => handleRescheduleSubmit("approve")}
                    disabled={
                      replacementLoading ||
                      !rescheduleNewDate ||
                      !rescheduleNewStartTime ||
                      !rescheduleNewEndTime ||
                      (shouldShowRoomField() && !rescheduleNewRuangan) ||
                      !!dateError ||
                      !!timeError ||
                      !!roomError
                    }
                    className="px-4 py-2 rounded-lg bg-green-500 text-white text-sm font-medium shadow-lg hover:bg-green-600 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {replacementLoading ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon
                          icon={faCheckCircle}
                          className="w-4 h-4"
                        />
                        <span>Setujui</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

        {/* Reminder Notification Modal */}
      <AnimatePresence mode="wait">
        {showReminderModal && (
          <motion.div
            key="reminder-modal"
            className="fixed inset-0 z-[100000] flex items-center justify-center"
          >
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => {
                setShowReminderModal(false);
                setSelectedReminderDosen(new Set()); // Reset selection when closing modal
              }}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-5xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[95vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowReminderModal(false);
                  setSelectedReminderDosen(new Set()); // Reset selection when closing modal
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

              <div>
                <div className="flex items-center justify-between pb-4 sm:pb-6">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                      Kirim Ulang Notifikasi
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Kirim pengingat ke dosen yang belum konfirmasi
                    </p>
                  </div>
                </div>

                <div>
                  <div className="mb-3 sm:mb-4">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={faRedo}
                      className="w-6 h-6 text-orange-600 dark:text-orange-400"
                    />
                  </div>
                  <div>
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                          Dosen yang Akan Dikirim Pengingat
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Pilih filter untuk mengirim pengingat
                    </p>
                  </div>
                </div>

                    {/* Filter Semester dan Blok */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Semester
                        </label>
                        <select
                          value={pendingDosenSemester}
                          onChange={(e) => {
                            setPendingDosenSemester(e.target.value);
                            setPendingDosenPage(1);
                            setSelectedReminderDosen(new Set()); // Reset selection when filter changes
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">Semua Semester</option>
                          <option value="1">Semester 1</option>
                          <option value="2">Semester 2</option>
                          <option value="3">Semester 3</option>
                          <option value="4">Semester 4</option>
                          <option value="5">Semester 5</option>
                          <option value="6">Semester 6</option>
                          <option value="7">Semester 7</option>
                          <option value="8">Semester 8</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Blok
                        </label>
                        <select
                          value={pendingDosenBlok}
                          onChange={(e) => {
                            setPendingDosenBlok(e.target.value);
                            setPendingDosenPage(1);
                            setSelectedReminderDosen(new Set()); // Reset selection when filter changes
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">Semua Blok</option>
                          <option value="1">Blok 1</option>
                          <option value="2">Blok 2</option>
                          <option value="3">Blok 3</option>
                          <option value="4">Blok 4</option>
                        </select>
                      </div>
                    </div>

                    {/* PERBAIKAN: Filter Jadwal Type */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Tipe Jadwal
                      </label>
                      <select
                        value={pendingDosenJadwalType}
                        onChange={(e) => {
                          setPendingDosenJadwalType(e.target.value);
                          setPendingDosenPage(1);
                          setSelectedReminderDosen(new Set()); // Reset selection when filter changes
                        }}
                        className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      >
                        <option value="">Semua Tipe Jadwal</option>
                        <option value="pbl">PBL</option>
                        <option value="kuliah_besar">Kuliah Besar</option>
                        <option value="praktikum">Praktikum</option>
                        <option value="jurnal_reading">Jurnal Reading</option>
                        <option value="csr">CSR</option>
                        <option value="non_blok_non_csr">Non Blok Non CSR</option>
                        <option value="persamaan_persepsi">Persamaan Persepsi</option>
                        <option value="seminar_pleno">Seminar Pleno</option>
                      </select>
                    </div>

                    {/* Filter Tipe Pengingat */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tipe Pengingat
                        </label>
                      <div className="space-y-3">
                        <div
                          className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 ${
                            pendingDosenReminderType === "all"
                              ? "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-600"
                              : ""
                          }`}
                          onClick={() => {
                            setPendingDosenReminderType("all");
                            setSelectedReminderDosen(new Set()); // Reset selection when filter changes
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                pendingDosenReminderType === "all"
                                  ? "bg-orange-500 border-orange-500"
                                  : "border-gray-300 dark:border-gray-600"
                              }`}
                            >
                              {pendingDosenReminderType === "all" && (
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
                            <div className="w-10 h-10 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                              <FontAwesomeIcon
                                icon={faRedo}
                                className="w-5 h-5 text-orange-600 dark:text-orange-400"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Semua
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Kirim pengingat ke semua dosen
                              </p>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 ${
                            pendingDosenReminderType === "unconfirmed"
                              ? "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-600"
                              : ""
                          }`}
                          onClick={() => {
                            setPendingDosenReminderType("unconfirmed");
                            setSelectedReminderDosen(new Set()); // Reset selection when filter changes
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                pendingDosenReminderType === "unconfirmed"
                                  ? "bg-orange-500 border-orange-500"
                                  : "border-gray-300 dark:border-gray-600"
                              }`}
                            >
                              {pendingDosenReminderType === "unconfirmed" && (
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
                            <div className="w-10 h-10 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg flex items-center justify-center">
                              <FontAwesomeIcon
                                icon={faClock}
                                className="w-5 h-5 text-yellow-600 dark:text-yellow-400"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Belum Konfirmasi
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Kirim pengingat ke dosen yang belum konfirmasi
                              </p>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 ${
                            pendingDosenReminderType === "upcoming"
                              ? "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-600"
                              : ""
                          }`}
                          onClick={() => {
                            setPendingDosenReminderType("upcoming");
                            setSelectedReminderDosen(new Set()); // Reset selection when filter changes
                          }}
                        >
                          <div className="flex items-center space-x-3">
                            <div
                              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                pendingDosenReminderType === "upcoming"
                                  ? "bg-orange-500 border-orange-500"
                                  : "border-gray-300 dark:border-gray-600"
                              }`}
                            >
                              {pendingDosenReminderType === "upcoming" && (
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
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                              <FontAwesomeIcon
                                icon={faClock}
                                className="w-5 h-5 text-blue-600 dark:text-blue-400"
                              />
                            </div>
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                Persiapan Mengajar
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                Kirim pengingat persiapan mengajar
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-end mb-4">
                        <button
                        onClick={() => {
                          setPendingDosenPage(1); // Reset to first page
                          setSelectedReminderDosen(new Set()); // Reset selection when filtering
                            loadPendingDosen(
                              1,
                              pendingDosenPageSize,
                              pendingDosenSemester,
                              pendingDosenBlok,
                              pendingDosenReminderType,
                              pendingDosenJadwalType // PERBAIKAN: Include jadwal type filter
                          );
                        }}
                        className="px-3 sm:px-4 py-2 rounded-lg bg-orange-500 text-white text-xs sm:text-sm font-medium hover:bg-orange-600 transition-all duration-300 ease-in-out"
                        >
                          Filter
                        </button>
                    </div>

                    {/* PERBAIKAN: Search Box untuk pencarian real-time */}
                    <div className="mb-4">
                      <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                        Cari Dosen / Mata Kuliah
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={pendingDosenSearchQuery}
                          onChange={(e) => {
                            setPendingDosenSearchQuery(e.target.value);
                            // Real-time search: tidak perlu klik filter, langsung filter di frontend
                          }}
                          placeholder="Cari berdasarkan nama dosen, mata kuliah, atau jadwal..."
                          className="w-full px-3 py-2 pl-10 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        />
                        <FontAwesomeIcon
                          icon={faSearch}
                          className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4"
                        />
                        {pendingDosenSearchQuery && (
                          <button
                            onClick={() => setPendingDosenSearchQuery("")}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                          >
                            <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {loadingPendingDosen ? (
                      <div className="flex items-center justify-center py-4">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-orange-500"></div>
                        <span className="ml-2 text-sm text-orange-700 dark:text-orange-300">
                          Memuat daftar dosen...
                        </span>
                      </div>
                    ) : (() => {
                      // PERBAIKAN: Filter real-time berdasarkan search query
                      const filteredDosenList = pendingDosenList.filter((dosen) => {
                        if (!pendingDosenSearchQuery.trim()) return true;
                        
                        const searchLower = pendingDosenSearchQuery.toLowerCase().trim();
                        const dosenName = (dosen.name || "").toLowerCase();
                        const mataKuliah = (dosen.mata_kuliah || "").toLowerCase();
                        const jadwalType = (dosen.jadwal_type || "").toLowerCase();
                        const email = (dosen.email || "").toLowerCase();
                        const nid = (dosen.nid || "").toLowerCase();
                        
                        return (
                          dosenName.includes(searchLower) ||
                          mataKuliah.includes(searchLower) ||
                          jadwalType.includes(searchLower) ||
                          email.includes(searchLower) ||
                          nid.includes(searchLower)
                        );
                      });
                      
                      return filteredDosenList.length > 0 ? (
                      <div className="space-y-3 max-h-96 overflow-y-auto">
                        {/* Select All Checkbox */}
                        <div className="sticky top-0 bg-white dark:bg-gray-900 z-10 pb-2 border-b border-gray-200 dark:border-gray-700 mb-3">
                          <label className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-all">
                            <div
                              className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                filteredDosenList.length > 0 &&
                                filteredDosenList.every((dosen) => {
                                  const cleanJadwalId =
                                    typeof dosen.jadwal_id === "string" &&
                                    dosen.jadwal_id.includes(":")
                                      ? dosen.jadwal_id.split(":")[0]
                                      : String(dosen.jadwal_id || "");
                                  const jadwalType = String(
                                    dosen.jadwal_type || ""
                                  )
                                    .toLowerCase()
                                    .replace(/\s+/g, "_");
                                  const dosenId = String(dosen.dosen_id || "");
                                  const key = `${jadwalType}_${cleanJadwalId}_${dosenId}`;
                                  return selectedReminderDosen.has(key);
                                })
                                  ? "bg-orange-500 border-orange-500"
                                  : "border-gray-300 dark:border-gray-600"
                              }`}
                            >
                              {filteredDosenList.length > 0 &&
                                filteredDosenList.every((dosen) => {
                                  const cleanJadwalId =
                                    typeof dosen.jadwal_id === "string" &&
                                    dosen.jadwal_id.includes(":")
                                      ? dosen.jadwal_id.split(":")[0]
                                      : String(dosen.jadwal_id || "");
                                  const jadwalType = String(
                                    dosen.jadwal_type || ""
                                  )
                                    .toLowerCase()
                                    .replace(/\s+/g, "_");
                                  const dosenId = String(dosen.dosen_id || "");
                                  const key = `${jadwalType}_${cleanJadwalId}_${dosenId}`;
                                  return selectedReminderDosen.has(key);
                                }) && (
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
                              type="checkbox"
                              checked={
                                pendingDosenList.length > 0 &&
                                pendingDosenList.every((dosen) => {
                                  const cleanJadwalId =
                                    typeof dosen.jadwal_id === "string" &&
                                    dosen.jadwal_id.includes(":")
                                      ? dosen.jadwal_id.split(":")[0]
                                      : String(dosen.jadwal_id || "");
                                  const jadwalType = String(
                                    dosen.jadwal_type || ""
                                  )
                                    .toLowerCase()
                                    .replace(/\s+/g, "_");
                                  const dosenId = String(dosen.dosen_id || "");
                                  const key = `${jadwalType}_${cleanJadwalId}_${dosenId}`;
                                  return selectedReminderDosen.has(key);
                                })
                              }
                              onChange={handleSelectAllReminderDosen}
                              className="sr-only"
                            />
                            <span className="text-sm font-semibold text-gray-900 dark:text-white">
                              Pilih Semua ({selectedReminderDosen.size} dari{" "}
                              {filteredDosenList.length} dipilih)
                              {pendingDosenSearchQuery && (
                                <span className="text-xs text-gray-500 dark:text-gray-400 ml-2">
                                  (dari {pendingDosenList.length} total)
                                </span>
                              )}
                            </span>
                          </label>
                        </div>
                        {filteredDosenList.map((dosen) => {
                          const isEmailValid =
                            dosen.email &&
                            dosen.email.trim() !== "" &&
                            dosen.email.includes("@");
                          const isEmailVerified = dosen.email_verified == true;

                          // Check WhatsApp verification (mirip dengan email verification)
                          const isWhatsAppValid =
                            dosen.whatsapp_phone &&
                            dosen.whatsapp_phone.trim() !== "" &&
                            /^62\d+$/.test(dosen.whatsapp_phone);

                          // Dosen akan menerima reminder jika email valid & verified ATAU WhatsApp valid
                          const willReceiveReminder =
                            (isEmailValid && isEmailVerified) ||
                            isWhatsAppValid;

                          // Check if this dosen is selected
                          // Key harus unik: jadwal_type + jadwal_id + dosen_id
                          const cleanJadwalId =
                            typeof dosen.jadwal_id === "string" &&
                            dosen.jadwal_id.includes(":")
                              ? dosen.jadwal_id.split(":")[0]
                              : String(dosen.jadwal_id || "");
                          const jadwalTypeForKey = String(
                            dosen.jadwal_type || ""
                          )
                            .toLowerCase()
                            .replace(/\s+/g, "_");
                          const dosenId = String(dosen.dosen_id || "");
                          const dosenKey = `${jadwalTypeForKey}_${cleanJadwalId}_${dosenId}`;
                          const isSelected =
                            selectedReminderDosen.has(dosenKey);

                          // PENTING: Persamaan Persepsi dan Seminar Pleno langsung "Bisa Mengajar" tanpa menunggu konfirmasi
                          const jadwalType = String(
                            dosen.jadwal_type || ""
                          ).toLowerCase();
                          const isPersamaanPersepsi =
                            jadwalType === "persamaan_persepsi" ||
                            jadwalType === "persamaan persepsi" ||
                            String(dosen.mata_kuliah || "")
                              .toLowerCase()
                              .includes("persamaan persepsi");
                          const isSeminarPleno =
                            jadwalType === "seminar_pleno" ||
                            jadwalType === "seminar pleno" ||
                            String(dosen.mata_kuliah || "")
                              .toLowerCase()
                              .includes("seminar pleno");
                          const isAutoBisa = isPersamaanPersepsi || isSeminarPleno;

                          return (
                            <div
                              key={dosenKey}
                              className={`flex items-start justify-between p-4 rounded-lg border cursor-pointer transition-all ${
                                isSelected
                                  ? "bg-orange-50 dark:bg-orange-900/20 border-orange-400 dark:border-orange-600"
                                  : willReceiveReminder
                                  ? "bg-white dark:bg-gray-800 border-orange-200 dark:border-orange-700 hover:border-orange-300 dark:hover:border-orange-600"
                                  : "bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700"
                              }`}
                              onClick={() => handleToggleReminderDosen(dosen)}
                            >
                              <div className="flex items-start space-x-4 flex-1">
                                {/* Checkbox */}
                                <div
                                  className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                                    isSelected
                                      ? "bg-orange-500 border-orange-500"
                                      : "border-gray-300 dark:border-gray-600"
                                  }`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleReminderDosen(dosen);
                                  }}
                                >
                                  {isSelected && (
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
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() =>
                                    handleToggleReminderDosen(dosen)
                                  }
                                  className="sr-only"
                                />
                                <div
                                  className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                    willReceiveReminder
                                      ? "bg-orange-100 dark:bg-orange-900/30"
                                      : "bg-red-100 dark:bg-red-900/30"
                                  }`}
                                >
                                  <span
                                    className={`text-xs font-semibold ${
                                      willReceiveReminder
                                        ? "text-orange-600 dark:text-orange-400"
                                        : "text-red-600 dark:text-red-400"
                                    }`}
                                  >
                                    {dosen.name?.charAt(0) || "D"}
                                  </span>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-2">
                                    <p
                                      className={`text-base font-semibold ${
                                        willReceiveReminder
                                          ? "text-gray-900 dark:text-white"
                                          : "text-red-800 dark:text-red-200 line-through"
                                      }`}
                                    >
                                      {dosen.name || "Dosen"}
                                    </p>
                                    <div className="flex items-center gap-2">
                                      {/* Reminder Type Badge */}
                                      {/* PENTING: Untuk Seminar Pleno dan Persamaan Persepsi, selalu tampilkan "Persiapan Mengajar" meskipun reminder_type "unconfirmed" */}
                                      {(dosen.reminder_type || isAutoBisa) && (
                                        <span
                                          className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                                            isAutoBisa
                                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                                              : dosen.reminder_type ===
                                            "unconfirmed"
                                              ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
                                              : "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                                          }`}
                                        >
                                          {isAutoBisa
                                            ? "Persiapan Mengajar"
                                            : dosen.reminder_type ===
                                              "unconfirmed"
                                            ? "Belum Konfirmasi"
                                            : "Persiapan Mengajar"}
                                        </span>
                                      )}
                                      {!willReceiveReminder && (
                                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                                          {!isEmailValid && !isWhatsAppValid
                                            ? "Email & WhatsApp Invalid"
                                            : !isEmailValid && isWhatsAppValid
                                            ? "Email Invalid"
                                            : isEmailValid &&
                                              !isEmailVerified &&
                                              !isWhatsAppValid
                                            ? "Email Belum Aktif & WhatsApp Invalid"
                                            : !isEmailVerified &&
                                              !isWhatsAppValid
                                            ? "Tidak Akan Dikirim"
                                            : "Tidak Akan Dikirim"}
                                        </span>
                                      )}
                                      {isWhatsAppValid && (
                                        <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                                          ✓ WhatsApp Aktif
                                        </span>
                                      )}
                                      {!isWhatsAppValid &&
                                        willReceiveReminder && (
                                          <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                                            ⚠ WhatsApp Belum Aktif
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    <p className="text-sm font-medium text-gray-700 dark:text-gray-300">
                                      {dosen.jadwal_type} - {dosen.mata_kuliah}
                                    </p>
                                    <div className="space-y-1">
                                    {dosen.email && (
                                      <div className="flex items-center gap-2">
                                        <p
                                          className={`text-xs ${
                                              isEmailValid && isEmailVerified
                                              ? "text-gray-500 dark:text-gray-400"
                                              : "text-red-600 dark:text-red-400"
                                          }`}
                                        >
                                          Email: {dosen.email}
                                        </p>
                                        {isEmailVerified && (
                                          <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                                            ✓ Aktif
                                          </span>
                                        )}
                                      </div>
                                      )}
                                      <div className="flex items-center gap-2">
                                        <p
                                          className={`text-xs ${
                                            isWhatsAppValid
                                              ? "text-gray-500 dark:text-gray-400"
                                              : "text-red-600 dark:text-red-400"
                                          }`}
                                        >
                                          WhatsApp: {dosen.whatsapp_phone || "Tidak ada"}
                                        </p>
                                        {isWhatsAppValid && (
                                          <span className="inline-flex items-center px-1 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                                            ✓ Aktif
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex flex-col items-end gap-2">
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenMahasiswaModal(dosen);
                                  }}
                                  className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                  title="Lihat daftar mahasiswa"
                                >
                                  <FontAwesomeIcon icon={faEye} className="w-3 h-3" />
                                  <span>Lihat Mahasiswa</span>
                                </button>
                                <span
                                  className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                    // Sinkronkan dengan badge reminder_type di kiri
                                    // Persamaan Persepsi dan Seminar Pleno = "Persiapan Mengajar" (biru), sama seperti jadwal lain
                                    // PENTING: Untuk Seminar Pleno dan Persamaan Persepsi, selalu tampilkan "Persiapan Mengajar" meskipun reminder_type "unconfirmed"
                                    isAutoBisa
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                                      : dosen.reminder_type === "upcoming" &&
                                        willReceiveReminder
                                      ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300"
                                      : dosen.reminder_type === "unconfirmed" &&
                                    willReceiveReminder
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
                                      : willReceiveReminder
                                      ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
                                      : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                                  }`}
                                >
                                  {isAutoBisa
                                    ? "Persiapan Mengajar"
                                    : dosen.reminder_type === "upcoming" &&
                                      willReceiveReminder
                                    ? "Persiapan Mengajar"
                                    : dosen.reminder_type === "unconfirmed" &&
                                      willReceiveReminder
                                    ? "Belum Konfirmasi"
                                    : willReceiveReminder
                                    ? "Belum Konfirmasi"
                                    : "Tidak Akan Dikirim"}
                                </span>
                                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                                  {dosen.tanggal} {dosen.waktu}
                                </p>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      pendingDosenList.length === 0 ? (
                        <div className="text-center py-4">
                          <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                            <FontAwesomeIcon
                              icon={faBell}
                              className="w-6 h-6 text-gray-500 dark:text-gray-400"
                            />
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                            Tidak ada dosen yang perlu dikirim pengingat
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Semua dosen sudah konfirmasi atau tidak ada jadwal
                            yang menunggu konfirmasi
                          </p>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center justify-center py-8 text-center">
                          <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mb-4">
                            <FontAwesomeIcon
                              icon={faSearch}
                              className="w-8 h-8 text-gray-400 dark:text-gray-500"
                            />
                          </div>
                          <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                            Tidak ada hasil pencarian
                          </p>
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Coba gunakan kata kunci lain atau hapus filter pencarian
                          </p>
                        </div>
                      )
                    );
                    })()}

                    {(pendingDosenList.length > 0 || pendingDosenSearchQuery) && (
                      <div className="mt-3 pt-3 border-t border-orange-200 dark:border-orange-700">
                        <p className="text-xs text-orange-600 dark:text-orange-400 mb-4">
                          {selectedReminderDosen.size > 0 ? (
                            <>
                              <span className="font-semibold">
                                {selectedReminderDosen.size} jadwal dipilih
                              </span>{" "}
                              dari {pendingDosenTotal} jadwal akan menerima
                              pengingat
                            </>
                          ) : (
                            <>
                              Total: {pendingDosenTotal} jadwal akan menerima
                          pengingat
                            </>
                          )}
                        </p>

                        {/* Pagination */}
                        {pendingDosenTotal > pendingDosenPageSize && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                Menampilkan{" "}
                                {(pendingDosenPage - 1) * pendingDosenPageSize +
                                  1}{" "}
                                -{" "}
                                {Math.min(
                                  pendingDosenPage * pendingDosenPageSize,
                                  pendingDosenTotal
                                )}{" "}
                                dari {pendingDosenTotal} dosen
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const newPage = pendingDosenPage - 1;
                                  setPendingDosenPage(newPage);
                                  loadPendingDosen(
                                    newPage,
                                    pendingDosenPageSize,
                                    pendingDosenSemester,
                                    pendingDosenBlok,
                                    pendingDosenReminderType,
                                    pendingDosenJadwalType // PERBAIKAN: Include jadwal type filter
                                  );
                                }}
                                disabled={pendingDosenPage <= 1}
                                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                ←
                              </button>
                              <span className="px-2 py-1 text-xs bg-blue-500 text-white rounded">
                                {pendingDosenPage}
                              </span>
                              <button
                                onClick={() => {
                                  const newPage = pendingDosenPage + 1;
                                  setPendingDosenPage(newPage);
                                  loadPendingDosen(
                                    newPage,
                                    pendingDosenPageSize,
                                    pendingDosenSemester,
                                    pendingDosenBlok,
                                    pendingDosenReminderType,
                                    pendingDosenJadwalType // PERBAIKAN: Include jadwal type filter
                                  );
                                }}
                                disabled={
                                  pendingDosenPage * pendingDosenPageSize >=
                                  pendingDosenTotal
                                }
                                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                →
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 relative z-20">
                  <button
                    onClick={() => {
                      setShowReminderModal(false);
                      setSelectedReminderDosen(new Set()); // Reset selection when closing modal
                    }}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleSendReminder}
                    disabled={
                      isSendingReminder ||
                      // Disabled jika:
                      // 1. Tidak ada selected dosen DAN
                      // 2. Tidak ada filter (semester/blok/reminder_type) DAN
                      // 3. Ada pendingDosenList (ada data yang bisa dipilih)
                      (selectedReminderDosen.size === 0 &&
                        !pendingDosenSemester &&
                        !pendingDosenBlok &&
                        !pendingDosenReminderType &&
                        pendingDosenList.length > 0) ||
                      // ATAU tidak ada data sama sekali
                      pendingDosenList.length === 0
                    }
                    className="px-3 sm:px-4 py-2 rounded-lg bg-orange-500 text-white text-xs sm:text-sm font-medium hover:bg-orange-600 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isSendingReminder ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Mengirim...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faRedo} className="w-4 h-4" />
                        <span>
                          {selectedReminderDosen.size > 0
                            ? `Kirim Pengingat (${selectedReminderDosen.size} jadwal)`
                            : "Kirim Pengingat"}
                        </span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Change Status Modal */}
      <AnimatePresence mode="wait">
        {showChangeStatusModal && (
          <motion.div
            key="change-status-modal"
            className="fixed inset-0 z-[100000] flex items-center justify-center"
          >
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => {
                setShowChangeStatusModal(false);
                setSelectedDosenList(new Map());
              }}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-5xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[95vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowChangeStatusModal(false);
                  setSelectedDosenList(new Map());
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

              <div>
                <div className="flex items-center justify-between pb-4 sm:pb-6">
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                      Ubah Status Konfirmasi
                    </h2>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Pilih dosen dan ubah status konfirmasinya
                    </p>
          </div>
                </div>

                <div>
                  <div className="mb-3 sm:mb-4">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon
                          icon={faCog}
                          className="w-6 h-6 text-blue-600 dark:text-blue-400"
                        />
                      </div>
                      <div>
                        <h3 className="text-sm font-semibold text-gray-800 dark:text-white">
                          Dosen yang Belum Konfirmasi
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Pilih dosen dan ubah status konfirmasinya
                        </p>
                      </div>
                    </div>

                    {/* Filter Semester dan Blok */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Semester
                        </label>
                        <select
                          value={pendingDosenSemester}
                          onChange={(e) => {
                            setPendingDosenSemester(e.target.value);
                            setPendingDosenPage(1);
                            loadPendingDosen(
                              1,
                              pendingDosenPageSize,
                              e.target.value,
                              pendingDosenBlok,
                              "unconfirmed",
                              pendingDosenJadwalType // PERBAIKAN: Include jadwal type filter
                            );
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">Semua Semester</option>
                          <option value="1">Semester 1</option>
                          <option value="2">Semester 2</option>
                          <option value="3">Semester 3</option>
                          <option value="4">Semester 4</option>
                          <option value="5">Semester 5</option>
                          <option value="6">Semester 6</option>
                          <option value="7">Semester 7</option>
                          <option value="8">Semester 8</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">
                          Blok
                        </label>
                        <select
                          value={pendingDosenBlok}
                          onChange={(e) => {
                            setPendingDosenBlok(e.target.value);
                            setPendingDosenPage(1);
                            loadPendingDosen(
                              1,
                              pendingDosenPageSize,
                              pendingDosenSemester,
                              e.target.value,
                              "unconfirmed",
                              pendingDosenJadwalType // PERBAIKAN: Include jadwal type filter
                            );
                          }}
                          className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                        >
                          <option value="">Semua Blok</option>
                          <option value="1">Blok 1</option>
                          <option value="2">Blok 2</option>
                          <option value="3">Blok 3</option>
                          <option value="4">Blok 4</option>
                        </select>
                      </div>
                    </div>

                    {/* List Dosen */}
                    {loadingPendingDosen ? (
                      <div className="text-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                          Memuat data...
                        </p>
                      </div>
                    ) : pendingDosenList.length > 0 ? (
                      <div className="space-y-3 max-h-[400px] overflow-y-auto">
                        {pendingDosenList.map((dosen: any) => {
                          // Ensure jadwal_id is clean (remove colon if present)
                          const cleanJadwalId =
                            typeof dosen.jadwal_id === "string" &&
                            dosen.jadwal_id.includes(":")
                              ? dosen.jadwal_id.split(":")[0]
                              : dosen.jadwal_id;

                          const key = `${cleanJadwalId}_${dosen.dosen_id}`;
                          const isSelected = selectedDosenList.has(key);
                          const selectedData = selectedDosenList.get(key);
                          const currentStatus = selectedData?.status || null;

                          // PENTING: Persamaan Persepsi dan Seminar Pleno langsung "Bisa Mengajar" tanpa menunggu konfirmasi
                          const jadwalType = String(
                            dosen.jadwal_type || ""
                          ).toLowerCase();
                          const isPersamaanPersepsi =
                            jadwalType === "persamaan_persepsi" ||
                            jadwalType === "persamaan persepsi" ||
                            String(dosen.mata_kuliah || "")
                              .toLowerCase()
                              .includes("persamaan persepsi");
                          const isSeminarPleno =
                            jadwalType === "seminar_pleno" ||
                            jadwalType === "seminar pleno" ||
                            String(dosen.mata_kuliah || "")
                              .toLowerCase()
                              .includes("seminar pleno");
                          const isAutoBisa = isPersamaanPersepsi || isSeminarPleno;

                          // Untuk persamaan persepsi dan seminar pleno, jika belum dipilih status, default ke "bisa"
                          const displayStatus =
                            isAutoBisa && !currentStatus
                              ? "bisa"
                              : currentStatus;

                          return (
                            <div
                              key={key}
                              className={`p-4 border rounded-lg cursor-pointer transition-all ${
                                isSelected
                                  ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                                  : "border-gray-200 dark:border-gray-700 hover:border-blue-300 dark:hover:border-blue-600"
                              }`}
                              onClick={() => handleToggleDosenSelection(dosen)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1">
                                  {/* Checkbox */}
                                  <div
                                    className={`w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 ${
                                      isSelected
                                        ? "bg-blue-500 border-blue-500"
                                        : "border-gray-300 dark:border-gray-600"
                                    }`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleToggleDosenSelection(dosen);
                                    }}
                                  >
                                    {isSelected && (
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
                                  <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                                    <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                      {dosen.name?.charAt(0) || "D"}
                                    </span>
                                  </div>
                                  <div className="flex-1">
                                    <p className="text-sm font-semibold text-gray-900 dark:text-white">
                                      {dosen.name || "Dosen"}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {dosen.jadwal_type} - {dosen.mata_kuliah}
                                    </p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                      {dosen.tanggal} {dosen.waktu}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  {isSelected && displayStatus ? (
                                    <span
                                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                        displayStatus === "bisa"
                                          ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                                          : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300"
                                      }`}
                                    >
                                      {displayStatus === "bisa"
                                        ? "Bisa Mengajar"
                                        : "Tidak Bisa Mengajar"}
                                    </span>
                                  ) : isAutoBisa ? (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                                      Bisa Mengajar
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                                      Belum Konfirmasi
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Status Selection - Only show when this dosen is selected */}
                              {isSelected && (
                                <div
                                  className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">
                                    Pilih Status Konfirmasi
                                  </label>
                                  <div className="grid grid-cols-2 gap-3">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleChangeStatusForDosen(
                                          dosen,
                                          "bisa"
                                        );
                                      }}
                                      className={`p-3 border-2 rounded-lg transition-all ${
                                        displayStatus === "bisa"
                                          ? "border-green-500 bg-green-50 dark:bg-green-900/20"
                                          : "border-gray-200 dark:border-gray-700 hover:border-green-300 dark:hover:border-green-600"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            displayStatus === "bisa"
                                              ? "bg-green-500 border-green-500"
                                              : "border-gray-300 dark:border-gray-600"
                                          }`}
                                        >
                                          {displayStatus === "bisa" && (
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
                                        <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                                          <FontAwesomeIcon
                                            icon={faCheckCircle}
                                            className="w-4 h-4 text-green-600 dark:text-green-400"
                                          />
                                        </div>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                          Bisa Mengajar
                                        </span>
                                      </div>
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleChangeStatusForDosen(
                                          dosen,
                                          "tidak_bisa"
                                        );
                                      }}
                                      className={`p-3 border-2 rounded-lg transition-all ${
                                        displayStatus === "tidak_bisa"
                                          ? "border-red-500 bg-red-50 dark:bg-red-900/20"
                                          : "border-gray-200 dark:border-gray-700 hover:border-red-300 dark:hover:border-red-600"
                                      }`}
                                    >
                                      <div className="flex items-center gap-2">
                                        <div
                                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                            displayStatus === "tidak_bisa"
                                              ? "bg-red-500 border-red-500"
                                              : "border-gray-300 dark:border-gray-600"
                                          }`}
                                        >
                                          {displayStatus === "tidak_bisa" && (
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
                                        <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                                          <FontAwesomeIcon
                                            icon={faTimesCircle}
                                            className="w-4 h-4 text-red-600 dark:text-red-400"
                                          />
                                        </div>
                                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                                          Tidak Bisa Mengajar
                                        </span>
                                      </div>
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="text-center py-4">
                        <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-2">
                          <FontAwesomeIcon
                            icon={faBell}
                            className="w-6 h-6 text-gray-500 dark:text-gray-400"
                          />
                        </div>
                        <p className="text-sm text-gray-700 dark:text-gray-300 font-medium">
                          Tidak ada dosen yang belum konfirmasi
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Semua dosen sudah konfirmasi atau tidak ada jadwal
                          yang menunggu konfirmasi
                        </p>
                      </div>
                    )}

                    {pendingDosenList.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-blue-200 dark:border-blue-700">
                        <div className="flex items-center justify-between mb-4">
                          <p className="text-xs text-blue-600 dark:text-blue-400">
                            Total: {pendingDosenTotal} dosen belum konfirmasi
                          </p>
                          {selectedDosenList.size > 0 && (
                            <p className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                              {selectedDosenList.size} dosen dipilih
                            </p>
                          )}
                        </div>

                        {/* Pagination */}
                        {pendingDosenTotal > pendingDosenPageSize && (
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs text-gray-600 dark:text-gray-400">
                                Menampilkan{" "}
                                {(pendingDosenPage - 1) * pendingDosenPageSize +
                                  1}{" "}
                                -{" "}
                                {Math.min(
                                  pendingDosenPage * pendingDosenPageSize,
                                  pendingDosenTotal
                                )}{" "}
                                dari {pendingDosenTotal} dosen
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  const newPage = pendingDosenPage - 1;
                                  setPendingDosenPage(newPage);
                                  loadPendingDosen(
                                    newPage,
                                    pendingDosenPageSize,
                                    pendingDosenSemester,
                                    pendingDosenBlok,
                                    "unconfirmed",
                                    pendingDosenJadwalType // PERBAIKAN: Include jadwal type filter
                                  );
                                }}
                                disabled={pendingDosenPage <= 1}
                                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                ←
                              </button>
                              <span className="px-2 py-1 text-xs bg-blue-500 text-white rounded">
                                {pendingDosenPage}
                              </span>
                              <button
                                onClick={() => {
                                  const newPage = pendingDosenPage + 1;
                                  setPendingDosenPage(newPage);
                                  loadPendingDosen(
                                    newPage,
                                    pendingDosenPageSize,
                                    pendingDosenSemester,
                                    pendingDosenBlok,
                                    "unconfirmed",
                                    pendingDosenJadwalType // PERBAIKAN: Include jadwal type filter
                                  );
                                }}
                                disabled={
                                  pendingDosenPage * pendingDosenPageSize >=
                                  pendingDosenTotal
                                }
                                className="px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                →
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-2 relative z-20">
                  <button
                    onClick={() => {
                      setShowChangeStatusModal(false);
                      setSelectedDosenList(new Map());
                    }}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleChangeStatus}
                    disabled={selectedDosenList.size === 0 || isChangingStatus}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-blue-500 text-white text-xs sm:text-sm font-medium hover:bg-blue-600 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isChangingStatus ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Mengubah...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faCog} className="w-4 h-4" />
                        <span>Ubah Status ({selectedDosenList.size})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

        {/* Reminder Success Modal */}
      <AnimatePresence mode="wait">
          {showReminderSuccessModal && (
          <motion.div
            key="reminder-success-modal"
            className="fixed inset-0 z-[100000] flex items-center justify-center"
          >
              {/* Overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={() => setShowReminderSuccessModal(false)}
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
                  onClick={() => setShowReminderSuccessModal(false)}
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
                  {reminderSuccessMessage.includes("berhasil")
                    ? "Berhasil!"
                    : "Terjadi Kesalahan"}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mb-6">
                    {reminderSuccessMessage}
                  </p>
                  <button
                    onClick={() => setShowReminderSuccessModal(false)}
                    className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
                  >
                    OK
                  </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reset Notification Modal - Select Scope */}
      <AnimatePresence mode="wait">
        {showResetModal && (
          <motion.div
            key="reset-modal"
            className="fixed inset-0 z-[100000] flex items-center justify-center"
          >
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowResetModal(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowResetModal(false)}
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
                <div className="flex items-center space-x-4 mb-6">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={faTrash}
                      className="w-6 h-6 text-red-600 dark:text-red-400"
                    />
          </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                      Reset Notification
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Pilih scope notifikasi yang akan direset
                    </p>
                  </div>
                </div>

                {/* Scope Selection */}
                <div className="space-y-3 mb-6">
                  <label
                    className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      resetScope === "all"
                        ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 ${
                        resetScope === "all"
                          ? "bg-red-500 border-red-500"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {resetScope === "all" && (
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
                      name="resetScope"
                      value="all"
                      checked={resetScope === "all"}
                      onChange={(e) =>
                        setResetScope(
                          e.target.value as "all" | "dosen" | "mahasiswa"
                        )
                      }
                      className="sr-only"
                    />
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon
                          icon={faTrash}
                          className="w-5 h-5 text-red-600 dark:text-red-400"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Semua Notifikasi
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Reset semua notifikasi (Dosen, Mahasiswa, dan Admin)
                        </p>
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      resetScope === "dosen"
                        ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 ${
                        resetScope === "dosen"
                          ? "bg-red-500 border-red-500"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {resetScope === "dosen" && (
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
                      name="resetScope"
                      value="dosen"
                      checked={resetScope === "dosen"}
                      onChange={(e) =>
                        setResetScope(
                          e.target.value as "all" | "dosen" | "mahasiswa"
                        )
                      }
                      className="sr-only"
                    />
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon
                          icon={faUser}
                          className="w-5 h-5 text-blue-600 dark:text-blue-400"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Notifikasi Dosen
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Reset hanya notifikasi yang dikirim ke dosen
                        </p>
                      </div>
                    </div>
                  </label>

                  <label
                    className={`flex items-center p-4 border-2 rounded-xl cursor-pointer transition-all duration-200 ${
                      resetScope === "mahasiswa"
                        ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600"
                        : "border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                    }`}
                  >
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center mr-4 ${
                        resetScope === "mahasiswa"
                          ? "bg-red-500 border-red-500"
                          : "border-gray-300 dark:border-gray-600"
                      }`}
                    >
                      {resetScope === "mahasiswa" && (
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
                      name="resetScope"
                      value="mahasiswa"
                      checked={resetScope === "mahasiswa"}
                      onChange={(e) =>
                        setResetScope(
                          e.target.value as "all" | "dosen" | "mahasiswa"
                        )
                      }
                      className="sr-only"
                    />
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon
                          icon={faUser}
                          className="w-5 h-5 text-green-600 dark:text-green-400"
                        />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">
                          Notifikasi Mahasiswa
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          Reset hanya notifikasi yang dikirim ke mahasiswa
                        </p>
                      </div>
                    </div>
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <button
                    onClick={() => setShowResetModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={() => {
                      setShowResetModal(false);
                      setShowResetConfirmModal(true);
                    }}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-lg hover:bg-red-600 transition-colors flex items-center space-x-2"
                  >
                    <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                    <span>Lanjutkan</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
        </AnimatePresence>

      {/* Reset Notification Confirm Modal */}
      <AnimatePresence mode="wait">
        {showResetConfirmModal && (
          <motion.div
            key="reset-confirm-modal"
            className="fixed inset-0 z-[100000] flex items-center justify-center"
          >
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowResetConfirmModal(false)}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowResetConfirmModal(false)}
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
                    icon={faExclamationTriangle}
                    className="w-8 h-8 text-red-600 dark:text-red-400"
                  />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Apakah Anda Yakin?
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-2">
                  Anda akan mereset semua notifikasi{" "}
                  <span className="font-semibold">
                    {resetScope === "all"
                      ? "(Semua)"
                      : resetScope === "dosen"
                      ? "(Dosen)"
                      : "(Mahasiswa)"}
                  </span>
                </p>
                <p className="text-sm text-red-600 dark:text-red-400 mb-6">
                  Tindakan ini tidak dapat dibatalkan!
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={() => setShowResetConfirmModal(false)}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleResetNotifications}
                    disabled={isResetting}
                    className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-lg hover:bg-red-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isResetting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Memproses...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                        <span>Ya, Reset</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mahasiswa List Modal */}
      <AnimatePresence>
        {showMahasiswaModal && selectedJadwalForMahasiswa && (
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
                setShowMahasiswaModal(false);
                setSelectedJadwalForMahasiswa(null);
                setMahasiswaList([]);
              }}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-4xl mx-4 bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] flex flex-col"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowMahasiswaModal(false);
                  setSelectedJadwalForMahasiswa(null);
                  setMahasiswaList([]);
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

              {/* Header */}
              <div className="flex items-center justify-between pb-4 sm:pb-6 border-b border-gray-200 dark:border-gray-700">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center shadow-lg">
                    <FontAwesomeIcon
                      icon={faUsers}
                      className="w-6 h-6 text-blue-600 dark:text-blue-400"
                    />
                  </div>
                  <div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                      Daftar Mahasiswa
                    </h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {selectedJadwalForMahasiswa.jadwal_type} - {selectedJadwalForMahasiswa.mata_kuliah}
                    </p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Dosen: {selectedJadwalForMahasiswa.dosen_name} | {selectedJadwalForMahasiswa.tanggal} {selectedJadwalForMahasiswa.waktu}
                    </p>
                  </div>
                </div>
              </div>

              {/* Mahasiswa List - Scrollable */}
              <div className="flex-1 overflow-y-auto mt-4 hide-scroll">
                {loadingMahasiswa ? (
                  <div className="flex items-center justify-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Memuat data mahasiswa...
                      </p>
                    </div>
                  </div>
                ) : mahasiswaList.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                      <FontAwesomeIcon
                        icon={faUsers}
                        className="w-8 h-8 text-gray-400"
                      />
                    </div>
                    <p className="text-gray-500 dark:text-gray-400 text-sm">
                      Tidak ada data mahasiswa untuk jadwal ini
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {mahasiswaList.map((mahasiswa, index) => {
                      const isEmailValid =
                        mahasiswa.email &&
                        mahasiswa.email !== "-" &&
                        mahasiswa.email.includes("@");
                      const isEmailVerified = mahasiswa.email_verified === true;
                      const isWhatsAppValid =
                        mahasiswa.whatsapp_phone &&
                        mahasiswa.whatsapp_phone !== "-" &&
                        /^62\d+$/.test(mahasiswa.whatsapp_phone);

                      return (
                        <div
                          key={mahasiswa.id || index}
                          className="flex items-start justify-between p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                        >
                          <div className="flex items-start space-x-4 flex-1">
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center flex-shrink-0">
                              <span className="text-sm font-semibold text-blue-600 dark:text-blue-400">
                                {mahasiswa.name?.charAt(0) || "M"}
                              </span>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-2">
                                <p className="text-base font-semibold text-gray-900 dark:text-white">
                                  {mahasiswa.name || "-"}
                                </p>
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  ({mahasiswa.nim || "-"})
                                </span>
                              </div>
                              <div className="space-y-2">
                                {/* Email */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-16">
                                    Email:
                                  </span>
                                  <span
                                    className={`text-xs flex-1 ${
                                      isEmailValid && isEmailVerified
                                        ? "text-gray-700 dark:text-gray-300"
                                        : "text-red-600 dark:text-red-400"
                                    }`}
                                  >
                                    {mahasiswa.email || "-"}
                                  </span>
                                  {isEmailValid && isEmailVerified && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                                      ✓ Aktif
                                    </span>
                                  )}
                                  {isEmailValid && !isEmailVerified && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300">
                                      ⚠ Belum Aktif
                                    </span>
                                  )}
                                  {!isEmailValid && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                                      ✗ Invalid
                                    </span>
                                  )}
                                </div>
                                {/* WhatsApp */}
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-medium text-gray-600 dark:text-gray-400 w-16">
                                    WhatsApp:
                                  </span>
                                  <span
                                    className={`text-xs flex-1 ${
                                      isWhatsAppValid
                                        ? "text-gray-700 dark:text-gray-300"
                                        : "text-red-600 dark:text-red-400"
                                    }`}
                                  >
                                    {mahasiswa.whatsapp_phone || "-"}
                                  </span>
                                  {isWhatsAppValid && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                                      ✓ Aktif
                                    </span>
                                  )}
                                  {!isWhatsAppValid && (
                                    <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300">
                                      ✗ Invalid
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer */}
              <div className="flex justify-between items-center pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Total: {mahasiswaList.length} mahasiswa
                </p>
                <button
                  onClick={() => {
                    setShowMahasiswaModal(false);
                    setSelectedJadwalForMahasiswa(null);
                    setMahasiswaList([]);
                  }}
                  className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-600 transition-colors"
                >
                  Kembali
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminNotifications;
