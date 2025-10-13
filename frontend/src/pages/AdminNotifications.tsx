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
} from "@fortawesome/free-solid-svg-icons";
import api, { handleApiError } from "../utils/api";

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
    "all" | "dosen" | "mahasiswa"
  >("all");
  const [notificationTypeFilter, setNotificationTypeFilter] = useState<
    "all" | "confirmation" | "assignment" | "other"
  >("all");
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Cache status_konfirmasi terbaru per jadwal (fallback setelah reschedule)
  const [jadwalStatusMap, setJadwalStatusMap] = useState<
    Record<string, string>
  >({});

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
  const [rescheduleMkKode, setRescheduleMkKode] = useState<string>("");
  const [rescheduleMkNama, setRescheduleMkNama] = useState<string>("");
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
    // Always reload when filter changes, including back to 'all'
    loadNotifications(true);
    loadStats();
  }, [userTypeFilter, notificationTypeFilter, filter]);

  const loadNotifications = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (userTypeFilter !== "all") params.append("user_type", userTypeFilter);
      if (notificationTypeFilter !== "all")
        params.append("notification_type", notificationTypeFilter);

      const response = await api.get(
        `/notifications/admin/all?${params.toString()}`
      );
      setNotifications(response.data);
      // Prefetch status_konfirmasi terbaru untuk setiap notifikasi yang punya jadwal
      prefetchJadwalStatuses(response.data);
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
      if (userTypeFilter !== "all") params.append("user_type", userTypeFilter);
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

      setRescheduleMkKode(mk?.kode || mkKode || "");
      setRescheduleMkNama(
        mk?.nama || (notification.data as any)?.mata_kuliah_nama || ""
      );
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
      setRescheduleMkKode("");
      setRescheduleMkNama("");
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
      const response = await api.get("/users?role=dosen");
      setDosenList(response.data || []);
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

  const handleRescheduleSubmit = async (action: "approve" | "reject") => {
    if (!selectedNotification) return;

    try {
      setReplacementLoading(true);

      if (action === "approve") {
        // Client-side validation mengikuti Tambah Jadwal
        // 1) Tanggal wajib dalam rentang MK jika tersedia
        const withinRange = (dateStr: string, min?: string, max?: string) => {
          if (!dateStr) return false;
          const val = new Date(dateStr).getTime();
          const minV = min ? new Date(min).getTime() : undefined;
          const maxV = max ? new Date(max).getTime() : undefined;
          if (minV !== undefined && val < minV) return false;
          if (maxV !== undefined && val > maxV) return false;
          return true;
        };
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
    const normalizeKind = (n: Notification) => {
      const kind = String(n.data?.notification_type || "").toLowerCase();
      if (kind.startsWith("reschedule")) return "reschedule";
      if (kind.includes("konfirmasi") || kind.includes("confirm"))
        return "confirmation";
      if (kind.includes("assignment") || kind.includes("jadwal"))
        return "assignment";
      return kind || "other";
    };

    const byKey: Record<string, Notification> = {};
    for (const n of notifications) {
      const type = String(n.data?.jadwal_type || "-").toLowerCase();
      const id = String(n.data?.jadwal_id || "-");
      const key = `${type}:${id}:${normalizeKind(n)}`;
      const prev = byKey[key];
      if (!prev) {
        byKey[key] = n;
      } else {
        // keep the newest by created_at/created_time
        const prevTime = new Date(
          (prev as any).created_at || prev.created_time || 0
        ).getTime();
        const curTime = new Date(
          (n as any).created_at || n.created_time || 0
        ).getTime();
        if (curTime >= prevTime) byKey[key] = n;
      }
    }

    let filtered = Object.values(byKey);

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
    const type = String(notification.data?.jadwal_type || "").toLowerCase();
    const id = notification.data?.jadwal_id
      ? Number(notification.data!.jadwal_id)
      : null;
    const key = id ? `${type}:${id}` : "";
    const statusField =
      (notification.data as any)?.status_konfirmasi ||
      (key ? jadwalStatusMap[key] : undefined);

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
      message.includes("tidak dapat mengajar")
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
    else if (
      title.includes("konfirmasi") ||
      message.includes("konfirmasi") ||
      title.includes("ketersediaan") ||
      message.includes("ketersediaan")
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {Array.from({ length: 4 }).map((_, idx) => (
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
        <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] px-6 py-6 mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
            <div className="w-full md:w-72">
              <div className="h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
            </div>
            <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto justify-end">
              <div className="w-full md:w-44 h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              <div className="w-full md:w-44 h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
              <div className="w-full md:w-auto h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
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
      <div className="bg-white dark:bg-white/[0.03] rounded-2xl border border-gray-200 dark:border-white/[0.05] px-6 py-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 w-full">
          {/* Search Bar */}
          <div className="w-full md:w-72 relative">
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
              className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-12 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <svg
                className="w-5 h-5"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                viewBox="0 0 24 24"
              >
                <circle
                  cx="11"
                  cy="11"
                  r="8"
                  stroke="currentColor"
                  strokeWidth="2"
                />
                <line
                  x1="21"
                  y1="21"
                  x2="16.65"
                  y2="16.65"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </span>
          </div>
          {/* Filter Group */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto justify-end">
            <select
              value={userTypeFilter}
              onChange={(e) =>
                setUserTypeFilter(
                  e.target.value as "all" | "dosen" | "mahasiswa"
                )
              }
              className="w-full md:w-44 h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Semua User</option>
              <option value="dosen">Dosen</option>
              <option value="mahasiswa">Mahasiswa</option>
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
              className="w-full md:w-44 h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
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
              className="w-full md:w-44 h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="all">Semua Status</option>
              <option value="unread">Belum Dibaca</option>
              <option value="read">Sudah Dibaca</option>
            </select>
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="w-full md:w-auto flex items-center justify-center gap-2 px-5 text-sm py-2 bg-brand-500 text-white rounded-lg shadow hover:bg-brand-600 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
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
              Refresh
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
              {filter === "all"
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
                          {notification.data?.dosen_name ||
                            notification.data?.sender_name ||
                            (notification.user_name !== "Unknown User"
                              ? notification.user_name
                              : "Sistem")}
                        </h4>
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs font-medium rounded-full">
                            {notification.data?.dosen_role ||
                              notification.data?.sender_role ||
                              notification.user_type}
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
                                getConfirmationStatus(notification)?.bgColor
                              } ${
                                getConfirmationStatus(notification)?.textColor
                              } border ${
                                getConfirmationStatus(notification)?.status ===
                                "bisa"
                                  ? "border-green-200 dark:border-green-700"
                                  : getConfirmationStatus(notification)
                                      ?.status === "tidak_bisa"
                                  ? "border-red-200 dark:border-red-700"
                                  : "border-yellow-200 dark:border-yellow-700"
                              }`}
                            >
                              <FontAwesomeIcon
                                icon={
                                  getConfirmationStatus(notification)?.icon ||
                                  faBell
                                }
                                className="w-3 h-3 mr-1"
                              />
                              {getConfirmationStatus(notification)?.status ===
                              "bisa"
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
                          {getConfirmationStatus(notification)?.status ===
                            "tidak_bisa" && (
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
                          )}
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
      <AnimatePresence>
        {showReplacementModal && selectedNotification && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
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

              <div className="flex-1 flex flex-col min-h-0">
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
                      Dosen:{" "}
                      {selectedNotification.data?.dosen_name ||
                        selectedNotification.data?.sender_name ||
                        selectedNotification.user_name}
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
                  <div className="mb-4">
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
                          onChange={(e) => setDosenSearchQuery(e.target.value)}
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

                {/* Footer */}
                <div className="flex justify-end gap-3 pt-4 flex-shrink-0 border-t border-gray-200 dark:border-gray-700 mt-4">
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
          </div>
        )}

        {/* Reschedule Modal */}
        {showRescheduleModal && selectedNotification && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
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
                        Dosen: {selectedNotification.data?.dosen_name}
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
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdminNotifications;
