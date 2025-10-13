import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api, { handleApiError } from "../../utils/api";

interface Notification {
  id: number;
  user_name?: string;
  user_id?: number;
  user_role?: string;
  user_type?: string;
  title: string;
  message: string;
  type: string;
  is_read: boolean;
  read_at?: string | null;
  created_at: string;
  read_status?: string;
  read_time?: string;
  time_since_read?: string;
  created_time?: string;
  created_time_ago?: string;
  jadwal_type?: string;
  jadwal_id?: number;
  data?: {
    blok?: number;
    semester?: string;
    tipe_peran?: string;
    mata_kuliah_kode?: string;
    mata_kuliah_nama?: string;
    moduls?: Array<{
      modul_ke: string;
      nama_modul: string;
      pbl_id: number;
    }>;
    total_kelompok?: number;
    periode?: string;
    durasi?: string;
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
    // Jadwal notification fields
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

export default function NotificationDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [notifying, setNotifying] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [userRole, setUserRole] = useState<string>("");
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Get user role from localStorage
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    setUserRole(user.role || "");

    // Load notifications based on user role
    if (user.id) {
      loadNotifications(user.role || "", user.id);
    }
  }, []);

  // Update notifying state when notifications change
  useEffect(() => {
    const hasUnread = notifications.some((n) => !n.is_read);
    setNotifying(hasUnread);
  }, [notifications]);

  const loadNotifications = async (role: string, userId: number) => {
    try {
      setLoading(true);
      let response;

      if (role === "super_admin" || role === "tim_akademik") {
        // Use AdminNotifications API
        response = await api.get(`/notifications/admin/all?limit=5`);
        setNotifications(response.data.slice(0, 5)); // Show only first 5
      } else if (role === "dosen") {
        // Use DashboardDosen API
        response = await api.get(`/notifications/dosen/${userId}`);
        setNotifications(response.data.slice(0, 5)); // Show only first 5
      } else if (role === "mahasiswa") {
        // Use same API as dosen for mahasiswa
        response = await api.get(`/notifications/dosen/${userId}`);
        setNotifications(response.data.slice(0, 5)); // Show only first 5
      } else {
        setNotifications([]);
      }

      // Note: notifying state will be updated by useEffect that watches notifications
    } catch (error) {
      console.error("Failed to load notifications:", error);
      setNotifications([]);
      setNotifying(false);
    } finally {
      setLoading(false);
    }
  };

  function toggleDropdown() {
    setIsOpen(!isOpen);
  }

  const handleClick = async () => {
    toggleDropdown();

    // Mark all notifications as read when dropdown is opened
    if (notifications.length > 0) {
      try {
        const user = JSON.parse(localStorage.getItem("user") || "{}");

        // Only mark as read if there are unread notifications
        const unreadNotifications = notifications.filter((n) => !n.is_read);

        if (unreadNotifications.length > 0) {
          if (user.role === "super_admin" || user.role === "tim_akademik") {
            // Mark all admin notifications as read
            await Promise.all(
              unreadNotifications.map((n) =>
                api.put(`/notifications/${n.id}/read`)
              )
            );
          } else if (user.role === "dosen" || user.role === "mahasiswa") {
            // Mark all dosen/mahasiswa notifications as read
            await Promise.all(
              unreadNotifications.map((n) =>
                api.put(`/notifications/${n.id}/read`)
              )
            );
          }

          // Update local state - mark all notifications as read
          setNotifications((prev) =>
            prev.map((n) => ({ ...n, is_read: true }))
          );

          // Hide notification indicator immediately
          setNotifying(false);
        }
      } catch (error) {
        console.error("Failed to mark notifications as read:", error);
        // Don't update local state if API call fails
      }
    }
  };

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
        setIsOpen(false);
      }
    } else if (notification.data?.notification_type === "category_created") {
      // Navigate to forum category
      if (notification.data?.category_slug) {
        navigate(`/forum-category/${notification.data.category_slug}`);
        setIsOpen(false);
      }
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "jadwal":
        return (
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
              />
            </svg>
          </div>
        );
      case "assignment":
        return (
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-green-600"
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
        );
      case "approval":
        return (
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-yellow-600"
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
        );
      case "system":
        return (
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
              />
            </svg>
          </div>
        );
      case "info":
        return (
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-blue-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        );
      case "forum_created":
      case "forum_created_public":
        return (
          <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-purple-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
        );
      case "forum_comment":
        return (
          <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-indigo-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
              />
            </svg>
          </div>
        );
      case "forum_reply":
        return (
          <div className="w-10 h-10 bg-cyan-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-cyan-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
              />
            </svg>
          </div>
        );
      case "category_created":
      case "category_created_public":
        return (
          <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-orange-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2H5a2 2 0 00-2-2z"
              />
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 5a2 2 0 012-2h4a2 2 0 012 2v2H8V5z"
              />
            </svg>
          </div>
        );
      case "success":
        return (
          <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-green-600"
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
        );
      case "warning":
        return (
          <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-yellow-600"
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
        );
      case "error":
        return (
          <div className="w-10 h-10 bg-red-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-red-600"
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
          </div>
        );
      default:
        return (
          <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center">
            <svg
              className="w-5 h-5 text-gray-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
        );
    }
  };

  const formatTime = (timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInMinutes = Math.floor(
      (now.getTime() - date.getTime()) / (1000 * 60)
    );

    if (diffInMinutes < 1) return "Baru saja";
    if (diffInMinutes < 60) return `${diffInMinutes} menit yang lalu`;
    if (diffInMinutes < 1440)
      return `${Math.floor(diffInMinutes / 60)} jam yang lalu`;
    return `${Math.floor(diffInMinutes / 1440)} hari yang lalu`;
  };

  return (
    <div className="relative">
      <button
        className="relative flex items-center justify-center text-gray-500 transition-colors bg-white border border-gray-200 rounded-full dropdown-toggle hover:text-gray-700 h-11 w-11 hover:bg-gray-100 dark:border-gray-800 dark:bg-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-white"
        onClick={handleClick}
      >
        <span
          className={`absolute right-0 top-0.5 z-10 h-2 w-2 rounded-full bg-orange-400 ${
            !notifying ? "hidden" : "flex"
          }`}
        >
          <span className="absolute inline-flex w-full h-full bg-orange-400 rounded-full opacity-75 animate-ping"></span>
        </span>
        <svg
          className="fill-current"
          width="20"
          height="20"
          viewBox="0 0 20 20"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M10.75 2.29248C10.75 1.87827 10.4143 1.54248 10 1.54248C9.58583 1.54248 9.25004 1.87827 9.25004 2.29248V2.83613C6.08266 3.20733 3.62504 5.9004 3.62504 9.16748V14.4591H3.33337C2.91916 14.4591 2.58337 14.7949 2.58337 15.2091C2.58337 15.6234 2.91916 15.9591 3.33337 15.9591H4.37504H15.625H16.6667C17.0809 15.9591 17.4167 15.6234 17.4167 15.2091C17.4167 14.7949 17.0809 14.4591 16.6667 14.4591H16.375V9.16748C16.375 5.9004 13.9174 3.20733 10.75 2.83613V2.29248ZM14.875 14.4591V9.16748C14.875 6.47509 12.6924 4.29248 10 4.29248C7.30765 4.29248 5.12504 6.47509 5.12504 9.16748V14.4591H14.875ZM8.00004 17.7085C8.00004 18.1228 8.33583 18.4585 8.75004 18.4585H11.25C11.6643 18.4585 12 18.1228 12 17.7085C12 17.2943 11.6643 16.9585 11.25 16.9585H8.75004C8.33583 16.9585 8.00004 17.2943 8.00004 17.7085Z"
            fill="currentColor"
          />
        </svg>
      </button>
      {isOpen && (
        <div className="absolute -right-[240px] mt-[17px] flex h-[520px] w-[350px] flex-col rounded-2xl border border-gray-200 bg-white p-3 shadow-theme-lg dark:border-gray-800 dark:bg-gray-dark sm:w-[361px] lg:right-0 z-50">
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-gray-100 dark:border-gray-700">
            <h5 className="text-lg font-semibold text-gray-800 dark:text-gray-200">
              Notifikasi
            </h5>
            <button
              onClick={toggleDropdown}
              className="text-gray-500 transition dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
            >
              <svg
                className="fill-current"
                width="24"
                height="24"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  fillRule="evenodd"
                  clipRule="evenodd"
                  d="M6.21967 7.28131C5.92678 6.98841 5.92678 6.51354 6.21967 6.22065C6.51256 5.92775 6.98744 5.92775 7.28033 6.22065L11.999 10.9393L16.7176 6.22078C17.0105 5.92789 17.4854 5.92788 17.7782 6.22078C18.0711 6.51367 18.0711 6.98855 17.7782 7.28144L13.0597 12L17.7782 16.7186C18.0711 17.0115 18.0711 17.4863 17.7782 17.7792C17.4854 18.0721 17.0105 18.0721 16.7176 17.7792L11.999 13.0607L7.28033 17.7794C6.98744 18.0722 6.51256 18.0722 6.21967 17.7794C5.92678 17.4865 5.92678 17.0116 6.21967 16.7187L10.9384 12L6.21967 7.28131Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
          <ul className="flex flex-col h-auto overflow-y-auto custom-scrollbar">
            {loading ? (
              <li className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                  <p>Memuat notifikasi...</p>
                </div>
              </li>
            ) : notifications.length > 0 ? (
              notifications.map((notification) => (
                <li key={notification.id}>
                  <div
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex gap-3 rounded-lg border-b border-gray-100 p-3 px-4.5 py-3 hover:bg-gray-100 dark:border-gray-800 dark:hover:bg-white/5 cursor-pointer ${
                      !notification.is_read
                        ? "bg-blue-50 dark:bg-blue-900/20"
                        : ""
                    }`}
                  >
                    {getNotificationIcon(
                      notification.data?.notification_type || notification.type
                    )}
                    <span className="block flex-1">
                      <span className="mb-1.5 block text-theme-sm text-gray-500 dark:text-gray-400">
                        <span className="font-medium text-gray-800 dark:text-white/90">
                          {notification.title}
                        </span>
                      </span>
                      <span className="block text-sm text-gray-700 dark:text-gray-300 mb-2">
                        {notification.message}
                      </span>
                      {/* User info and additional info for forum notifications */}
                      <div className="flex items-center gap-2 mb-2">
                        {/* User info */}
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                            <svg
                              className="w-3 h-3 text-blue-600 dark:text-blue-400"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
                                clipRule="evenodd"
                              />
                            </svg>
                          </div>
                          <span className="text-xs text-gray-600 dark:text-gray-400">
                            {notification.data?.created_by ||
                              notification.data?.sender_name ||
                              notification.user_name ||
                              "Sistem"}
                          </span>
                          {(notification.data?.created_by_role ||
                            notification.data?.sender_role ||
                            notification.user_type) && (
                            <span
                              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                                (notification.data?.created_by_role ||
                                  notification.data?.sender_role) ===
                                  "super_admin" ||
                                notification.user_type === "Admin"
                                  ? "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300"
                                  : notification.user_type === "Publik"
                                  ? "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300"
                                  : notification.user_type === "Dosen"
                                  ? "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300"
                                  : "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                              }`}
                            >
                              {notification.data?.created_by_role ||
                                notification.data?.sender_role ||
                                notification.user_type}
                            </span>
                          )}
                        </div>
                      </div>
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
                          {notification.data?.access_type === "public" && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300">
                              Public
                            </span>
                          )}
                          {/* Category notification badge */}
                          {(notification.data?.notification_type ===
                            "category_created" ||
                            notification.data?.notification_type ===
                              "category_created_public") && (
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300">
                              CATEGORY CREATED
                            </span>
                          )}
                        </div>
                      )}
                      <span className="flex items-center gap-2 text-gray-500 text-theme-xs dark:text-gray-400">
                        <span className="capitalize">
                          {notification.data?.notification_type ||
                            notification.type}
                        </span>
                        <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                        <span>
                          {notification.created_time_ago ||
                            formatTime(notification.created_at)}
                        </span>
                        {!notification.is_read && (
                          <>
                            <span className="w-1 h-1 bg-gray-400 rounded-full"></span>
                            <span className="text-blue-600 dark:text-blue-400 font-medium">
                              Baru
                            </span>
                          </>
                        )}
                      </span>
                    </span>
                  </div>
                </li>
              ))
            ) : (
              <li className="flex items-center justify-center h-32 text-gray-500 dark:text-gray-400">
                <div className="text-center">
                  <svg
                    className="w-12 h-12 mx-auto mb-2 text-gray-300 dark:text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  <p>Tidak ada notifikasi</p>
                </div>
              </li>
            )}
          </ul>

          {/* Button Lihat Semua Notifikasi untuk Super Admin dan Tim Akademik */}
          {(userRole === "super_admin" || userRole === "tim_akademik") &&
            notifications.length > 0 && (
              <div className="mt-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => {
                    navigate("/admin-notifications");
                    setIsOpen(false);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded-lg transition-colors duration-200"
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
                      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
                    />
                  </svg>
                  Lihat Semua Notifikasi
                </button>
              </div>
            )}
        </div>
      )}
    </div>
  );
}
