import React, { useState, useEffect } from "react";
import api, { handleApiError } from "../utils/api";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faCheckCircle,
  faTimesCircle,
  faSync,
  faPaperPlane,
  faMobileAlt,
  faAddressBook,
  faChartLine,
  faInfoCircle,
  faSpinner,
  faPhone,
  faEnvelope,
  faClock,
  faUser,
  faExclamationTriangle,
  faCog,
  faEye,
  faEyeSlash,
} from "@fortawesome/free-solid-svg-icons";
import { motion, AnimatePresence } from "framer-motion";
import { getUser } from "../utils/api";

interface DeviceInfo {
  serial: string;
  sender: string;
  name: string;
  quota: string;
  expired_date: string;
  status: string;
  active: boolean;
}

interface Contact {
  phone: string;
  name?: string;
  [key: string]: any;
}

export default function WhatsAppTest() {
  const [loading, setLoading] = useState(false);
  const [deviceLoading, setDeviceLoading] = useState(false);
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState(
    "Hello! This is a test message from Wablas API."
  );
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [showContactDropdown, setShowContactDropdown] = useState(false);

  // Report states
  // Load from localStorage on initial mount, but check if it's from today
  const [reportRealtime, setReportRealtime] = useState<any[]>(() => {
    try {
      const saved = localStorage.getItem("whatsapp_realtime_reports");
      const savedDate = localStorage.getItem("whatsapp_realtime_reports_date");
      
      if (saved && savedDate) {
        const savedDateObj = new Date(savedDate);
        const today = new Date();
        // Check if saved date is today (same day)
        if (
          savedDateObj.getDate() === today.getDate() &&
          savedDateObj.getMonth() === today.getMonth() &&
          savedDateObj.getFullYear() === today.getFullYear()
        ) {
          const parsed = JSON.parse(saved);
          console.log(
            "[useState] Loaded from localStorage (today):",
            parsed.length,
            "items"
          );
          return parsed;
        } else {
          // Data is from a different day, clear it
          console.log("[useState] Data from different day, clearing localStorage");
          localStorage.removeItem("whatsapp_realtime_reports");
          localStorage.removeItem("whatsapp_realtime_reports_date");
        }
      }
    } catch (err) {
      console.error("[useState] Error loading from localStorage:", err);
    }
    return [];
  });
  const [loadingRealtime, setLoadingRealtime] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);
  const [currentDay, setCurrentDay] = useState<string>("");

  // Settings states
  const [showSettings, setShowSettings] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState({
    token: "",
    secret_key: "",
    base_url: "https://tegal.wablas.com/api",
    enabled: false, // Default false, akan di-update dari loadSettings
  });
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Check if user is super_admin
  const user = getUser();
  const isSuperAdmin = user?.role === "super_admin";

  const checkDevice = async () => {
    try {
      setDeviceLoading(true);
      setError(null);
      setDeviceInfo(null);

      const response = await api.get("/whatsapp/device");

      if (response.data && response.data.connected) {
        setDeviceInfo(response.data.device);
        setError(null);
      } else if (response.data && response.data.device) {
        // Device info ada tapi tidak connected
        setDeviceInfo(response.data.device);
        setError(
          `Device tidak terhubung. Status: ${
            response.data.status || "disconnected"
          }`
        );
      } else {
        // Error dari backend
        setError(
          response.data?.error ||
            response.data?.message ||
            "Gagal mendapatkan info device"
        );
      }
    } catch (err: any) {
      const errorMessage = handleApiError(err, "Cek Device");
      setError(errorMessage);
      console.error("Error checking device:", err);
    } finally {
      setDeviceLoading(false);
    }
  };

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const response = await api.get("/whatsapp/contacts", {
        params: { limit: 1000 }, // Load banyak contact
      });

      console.log("[loadContacts] Full response:", response);
      console.log("[loadContacts] Response data:", response.data);
      console.log("[loadContacts] Response data.data:", response.data?.data);

      if (response.data && response.data.data) {
        const wablasData = response.data.data;

        // Format response dari Wablas API:
        // {
        //   "status": true,
        //   "totalData": 18,
        //   "message": [ {...}, {...} ]  <- contact array ada di sini
        // }

        let contactsData: Contact[] = [];

        // Cek apakah ada field "message" yang berisi array contacts
        if (wablasData.message && Array.isArray(wablasData.message)) {
          contactsData = wablasData.message;
          console.log(
            "[loadContacts] Found contacts in message array:",
            contactsData.length
          );
        }
        // Fallback: cek jika data langsung array
        else if (Array.isArray(wablasData)) {
          contactsData = wablasData;
          console.log(
            "[loadContacts] Found contacts as direct array:",
            contactsData.length
          );
        }
        // Fallback: cek nested data
        else if (wablasData.data && Array.isArray(wablasData.data)) {
          contactsData = wablasData.data;
          console.log(
            "[loadContacts] Found contacts in data.data:",
            contactsData.length
          );
        }
        // Fallback: cek contacts field
        else if (wablasData.contacts && Array.isArray(wablasData.contacts)) {
          contactsData = wablasData.contacts;
          console.log(
            "[loadContacts] Found contacts in contacts field:",
            contactsData.length
          );
        }

        console.log("[loadContacts] Final contacts:", contactsData);
        setContacts(contactsData);
      } else {
        console.warn("[loadContacts] No data in response:", response.data);
        setContacts([]);
      }
    } catch (err: any) {
      console.error("[loadContacts] Error loading contacts:", err);
      console.error("[loadContacts] Error response:", err.response);
      setContacts([]);
      // Tidak set error karena ini optional
    } finally {
      setLoadingContacts(false);
    }
  };

  const loadReportRealtime = async () => {
    try {
      setLoadingRealtime(true);
      // Jangan clear error saat reload, biarkan user tahu jika ada masalah sebelumnya
      // setError(null); // Removed - keep previous error message if exists

      console.log("[loadReportRealtime] Starting API call...");

      const response = await api.get("/whatsapp/report-realtime", {
        params: { limit: 20 },
      });

      console.log("[loadReportRealtime] Full response:", response);
      console.log("[loadReportRealtime] Response data:", response.data);
      console.log(
        "[loadReportRealtime] Response data.data:",
        response.data?.data
      );
      console.log(
        "[loadReportRealtime] Rate limited:",
        response.data?.rate_limited
      );

      // Handle rate limit - jangan reset data jika rate limited
      if (response.data?.rate_limited) {
        console.warn(
          "[loadReportRealtime] Rate limited - keeping existing data"
        );
        // Cek apakah ada data di localStorage jika state kosong
        setReportRealtime((prev) => {
          if (prev.length === 0) {
            // Coba load dari localStorage
            try {
              const saved = localStorage.getItem("whatsapp_realtime_reports");
              if (saved) {
                const parsed = JSON.parse(saved);
                console.log(
                  "[loadReportRealtime] Loaded from localStorage (rate limited):",
                  parsed.length,
                  "items"
                );
                if (parsed.length > 0) {
                  return parsed; // Return data dari localStorage
                }
              }
            } catch (err) {
              console.error(
                "[loadReportRealtime] Error loading from localStorage:",
                err
              );
            }
            // Jika tidak ada data di localStorage juga, set error
            setError(
              "Rate limit exceeded. Silakan tunggu beberapa saat sebelum refresh lagi."
            );
          }
          return prev; // Keep existing data
        });
        // Jangan reset data, keep existing data
        setLoadingRealtime(false);
        return;
      }

      if (response.data && response.data.data) {
        // Format response dari Wablas:
        // { status: true, message: "success...", data: [...], ... }
        // Array data sebenarnya ada di field "data", bukan "message"
        const responseData = response.data.data;

        console.log("[loadReportRealtime] ResponseData:", responseData);
        console.log(
          "[loadReportRealtime] ResponseData.data:",
          responseData.data
        );
        console.log(
          "[loadReportRealtime] ResponseData.message:",
          responseData.message
        );

        // Handle berbagai format response
        let realtimeData = [];
        if (
          responseData.data &&
          Array.isArray(responseData.data) &&
          responseData.data.length > 0
        ) {
          // Format: { status: true, data: [...] }
          realtimeData = responseData.data;
          console.log("[loadReportRealtime] Using responseData.data (array)");
        } else if (
          Array.isArray(responseData.message) &&
          responseData.message.length > 0 &&
          typeof responseData.message[0] === "object" // Pastikan ini array of objects, bukan string
        ) {
          // Format: { status: true, message: [...] } - tapi hanya jika message adalah array of objects
          realtimeData = responseData.message;
          console.log(
            "[loadReportRealtime] Using responseData.message (array)"
          );
        } else if (Array.isArray(responseData) && responseData.length > 0) {
          // Format: langsung array
          realtimeData = responseData;
          console.log(
            "[loadReportRealtime] Using responseData directly (array)"
          );
        } else if (
          responseData.messages &&
          Array.isArray(responseData.messages) &&
          responseData.messages.length > 0
        ) {
          realtimeData = responseData.messages;
          console.log(
            "[loadReportRealtime] Using responseData.messages (array)"
          );
        }

        console.log(
          "[loadReportRealtime] Final parsed data:",
          realtimeData.length,
          "items"
        );
        console.log("[loadReportRealtime] Setting state with:", realtimeData);

        // Clear error jika berhasil dan ada data
        if (realtimeData.length > 0) {
          setError(null);
        }

        // Filter to only show today's messages
        const today = new Date();
        const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD
        const filteredData = realtimeData.filter((report: any) => {
          let reportDate: string | null = null;
          
          // Try to extract date from various formats
          if (report.date) {
            if (typeof report.date === "object" && report.date.created_at) {
              reportDate = report.date.created_at;
            } else {
              reportDate = String(report.date);
            }
          } else if (report.created_at) {
            reportDate = String(report.created_at);
          } else if (report.timestamp) {
            reportDate = String(report.timestamp);
          }
          
          if (!reportDate) return false;
          
          // Parse date and compare with today
          try {
            const reportDateObj = new Date(reportDate);
            const reportDateStr = reportDateObj.toISOString().split('T')[0];
            return reportDateStr === todayStr;
          } catch (e) {
            return false;
          }
        });
        
        setReportRealtime(filteredData);
        // Update last refresh time
        setLastRefreshTime(Date.now());
        // Update current day
        const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
        const dayName = dayNames[today.getDay()];
        const dateStr = today.toLocaleDateString('id-ID', { 
          day: 'numeric', 
          month: 'long', 
          year: 'numeric' 
        });
        setCurrentDay(`${dayName}, ${dateStr}`);
        
        // Save to localStorage with today's date
        try {
          localStorage.setItem(
            "whatsapp_realtime_reports",
            JSON.stringify(filteredData)
          );
          localStorage.setItem(
            "whatsapp_realtime_reports_date",
            today.toISOString()
          );
          console.log(
            "[loadReportRealtime] Saved to localStorage:",
            filteredData.length,
            "items for",
            dayName,
            dateStr
          );
        } catch (err) {
          console.error(
            "[loadReportRealtime] Error saving to localStorage:",
            err
          );
        }
        console.log("[loadReportRealtime] State updated successfully");
      } else {
        console.warn(
          "[loadReportRealtime] No data in response:",
          response.data
        );
        // Jangan reset data jika tidak ada data baru, keep existing
        // Hanya reset jika memang belum ada data sama sekali
        setReportRealtime((prev) => {
          if (prev.length === 0) {
            // Coba load dari localStorage
            try {
              const saved = localStorage.getItem("whatsapp_realtime_reports");
              if (saved) {
                const parsed = JSON.parse(saved);
                console.log(
                  "[loadReportRealtime] Loaded from localStorage (no new data):",
                  parsed.length,
                  "items"
                );
                if (parsed.length > 0) {
                  return parsed; // Return data dari localStorage
                }
              }
            } catch (err) {
              console.error(
                "[loadReportRealtime] Error loading from localStorage:",
                err
              );
            }
            return []; // Clear jika memang tidak ada data
          }
          return prev; // Keep existing data
        });
      }
    } catch (err: any) {
      console.error(
        "[loadReportRealtime] Error loading realtime reports:",
        err
      );
      console.error("[loadReportRealtime] Error response:", err.response);
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Gagal memuat laporan realtime";

      // Jangan clear data saat error jika sudah ada data sebelumnya
      // Hanya set error dan clear data jika memang belum ada data sama sekali
      setReportRealtime((prev) => {
        if (prev.length === 0) {
          // Coba load dari localStorage
          try {
            const saved = localStorage.getItem("whatsapp_realtime_reports");
            if (saved) {
              const parsed = JSON.parse(saved);
              console.log(
                "[loadReportRealtime] Loaded from localStorage (error):",
                parsed.length,
                "items"
              );
              if (parsed.length > 0) {
                setError(
                  `Gagal refresh data: ${errorMsg}. Menampilkan data dari cache.`
                );
                return parsed; // Return data dari localStorage
              }
            }
          } catch (err) {
            console.error(
              "[loadReportRealtime] Error loading from localStorage:",
              err
            );
          }
          // Jika tidak ada data di localStorage juga, set error dan clear
          setError(errorMsg);
          return []; // Clear data jika belum ada data
        } else {
          // Keep existing data, tapi set error untuk info
          setError(
            `Gagal refresh data: ${errorMsg}. Menampilkan data sebelumnya.`
          );
          console.warn(
            "[loadReportRealtime] Keeping existing data due to error"
          );
          return prev; // Keep existing data
        }
      });
    } finally {
      setLoadingRealtime(false);
      console.log("[loadReportRealtime] Finished loading");
    }
  };

  // Load Settings
  const loadSettings = async () => {
    if (!isSuperAdmin) return;

    try {
      setLoadingSettings(true);
      const response = await api.get("/whatsapp/settings");
      if (response.data) {
        // Otomatis set enabled = true jika token dan secret_key ada
        const hasTokenAndSecret = !!(
          response.data.token && response.data.secret_key
        );
        setSettings({
          token: response.data.token || "",
          secret_key: response.data.secret_key || "",
          base_url: response.data.base_url || "https://tegal.wablas.com/api",
          enabled: hasTokenAndSecret, // Otomatis true jika token dan secret_key ada
        });
      }
    } catch (err: any) {
      console.error("Error loading settings:", err);
      setSettingsError("Gagal memuat settings");
    } finally {
      setLoadingSettings(false);
    }
  };

  // Save Settings
  const saveSettings = async () => {
    if (!isSuperAdmin) return;

    try {
      setSavingSettings(true);
      setSettingsError(null);

      // Otomatis aktifkan service jika token dan secret_key ada
      const isEnabled = !!(settings.token && settings.secret_key);

      const response = await api.put("/whatsapp/settings", {
        token: settings.token,
        secret_key: settings.secret_key,
        base_url: settings.base_url,
        enabled: isEnabled, // Otomatis true jika token dan secret_key ada
      });

      if (response.data) {
        setShowSettings(false);
        // Reload page untuk apply new settings
        window.location.reload();
      }
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.error ||
        err.response?.data?.message ||
        "Gagal menyimpan settings";
      setSettingsError(errorMsg);
    } finally {
      setSavingSettings(false);
    }
  };

  useEffect(() => {
    console.log("[useEffect] Component mounted or reloaded");

    // Check if we need to reset data (new day)
    const checkAndResetForNewDay = () => {
      const savedDate = localStorage.getItem("whatsapp_realtime_reports_date");
      if (savedDate) {
        const savedDateObj = new Date(savedDate);
        const today = new Date();
        // Check if saved date is NOT today
        if (
          savedDateObj.getDate() !== today.getDate() ||
          savedDateObj.getMonth() !== today.getMonth() ||
          savedDateObj.getFullYear() !== today.getFullYear()
        ) {
          console.log("[useEffect] New day detected, clearing old data");
          localStorage.removeItem("whatsapp_realtime_reports");
          localStorage.removeItem("whatsapp_realtime_reports_date");
          setReportRealtime([]);
        }
      }
    };

    checkAndResetForNewDay();

    // Set current day
    const today = new Date();
    const dayNames = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = dayNames[today.getDay()];
    const dateStr = today.toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    });
    setCurrentDay(`${dayName}, ${dateStr}`);

    // Load contacts saat component mount
    loadContacts();

    // Load realtime reports saat component mount
    console.log("[useEffect] Calling loadReportRealtime...");
    loadReportRealtime();

    // Load settings jika super admin
    if (isSuperAdmin) {
      loadSettings();
    }

    // Auto-refresh realtime reports setiap 30 detik untuk update status
    // Hanya refresh jika sudah lebih dari 60 detik sejak refresh terakhir (untuk menghindari rate limit)
    const intervalId = setInterval(() => {
      const now = Date.now();
      // Check for new day before refresh
      checkAndResetForNewDay();
      
      // Gunakan functional update untuk mendapatkan nilai lastRefreshTime terbaru
      setLastRefreshTime((prevTime) => {
        const timeSinceLastRefresh = now - prevTime;
        // Hanya refresh jika sudah lebih dari 60 detik (rate limit biasanya 1 request per menit)
        if (timeSinceLastRefresh >= 60000) {
          console.log("[useEffect] Auto-refreshing realtime reports...");
          loadReportRealtime();
          return now; // Update last refresh time
        } else {
          console.log(
            `[useEffect] Skipping auto-refresh (rate limit protection). Time since last refresh: ${Math.round(
              timeSinceLastRefresh / 1000
            )}s`
          );
          return prevTime; // Keep previous time
        }
      });
    }, 30000); // Check every 30 seconds

    // Cleanup interval saat component unmount
    return () => {
      clearInterval(intervalId);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty deps = hanya run saat mount/reload

  const handleContactSelect = (contact: Contact) => {
    setPhone(contact.phone || "");
    setShowContactDropdown(false);
  };

  const testSendMessage = async () => {
    if (!phone.trim()) {
      setError("Nomor telepon harus diisi");
      return;
    }
    if (!message.trim()) {
      setError("Pesan harus diisi");
      return;
    }

    try {
      setLoading(true);
      setError(null);
      setTestResult(null);

      // Kirim dengan phone dan message dari input
      const response = await api.post("/whatsapp/send", {
        phone: phone.trim(),
        message: message.trim(),
      });

      setTestResult(response.data);

      // Refresh realtime reports setelah berhasil mengirim pesan
      // Tunggu 3 detik dulu untuk memastikan pesan sudah terdaftar di Wablas
      setTimeout(() => {
        console.log(
          "[testSendMessage] Refreshing realtime reports after send..."
        );
        setLastRefreshTime(Date.now());
        loadReportRealtime();
      }, 3000);
    } catch (err: any) {
      const errorMessage = handleApiError(err, "Test Send Message");
      setError(errorMessage);
      setTestResult(err.response?.data || { error: errorMessage });
      console.error("Error testing send message:", err);
    } finally {
      setLoading(false);
    }
  };

  // Skeleton Components
  const SkeletonLine = ({
    width = "w-full",
    height = "h-4",
  }: {
    width?: string;
    height?: string;
  }) => (
    <div
      className={`bg-gray-200 dark:bg-gray-700 rounded animate-pulse ${width} ${height}`}
    />
  );

  const SkeletonTable = () => (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
          <div>
            <SkeletonLine width="w-48" height="h-6" />
            <SkeletonLine width="w-32" height="h-4" />
          </div>
        </div>
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex gap-4">
            <SkeletonLine width="w-12" height="h-4" />
            <SkeletonLine width="w-32" height="h-4" />
            <SkeletonLine width="w-48" height="h-4" />
            <SkeletonLine width="w-20" height="h-4" />
            <SkeletonLine width="w-24" height="h-4" />
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-emerald-600 rounded-2xl flex items-center justify-center shadow-lg">
                <FontAwesomeIcon
                  icon={faMobileAlt}
                  className="w-8 h-8 text-white"
                />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-gray-900 dark:text-white mb-2">
                  WhatsApp Bot
                </h1>
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  Kelola dan monitor pesan WhatsApp melalui Wablas API
                </p>
              </div>
            </div>
            {isSuperAdmin && (
              <button
                onClick={() => {
                  setShowSettings(true);
                  loadSettings();
                }}
                className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-all duration-200 font-medium flex items-center gap-2 shadow-md hover:shadow-lg"
              >
                <FontAwesomeIcon icon={faCog} className="w-4 h-4" />
                <span>Settings</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Device Status Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                    deviceInfo?.status === "connected"
                      ? "bg-green-100 dark:bg-green-900/20"
                      : "bg-gray-100 dark:bg-gray-700"
                  }`}
                >
                  <FontAwesomeIcon
                    icon={
                      deviceInfo?.status === "connected"
                        ? faCheckCircle
                        : faTimesCircle
                    }
                    className={`w-6 h-6 ${
                      deviceInfo?.status === "connected"
                        ? "text-green-600 dark:text-green-400"
                        : "text-gray-400"
                    }`}
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Device Status
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {deviceInfo?.status === "connected"
                      ? "Terhubung"
                      : "Tidak Terhubung"}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={checkDevice}
              disabled={deviceLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:shadow-none"
            >
              {deviceLoading ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    className="w-4 h-4 animate-spin"
                  />
                  <span>Memeriksa...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faSync} className="w-4 h-4" />
                  <span>Cek Status</span>
                </>
              )}
            </button>
          </motion.div>

          {/* Contacts Count Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faAddressBook}
                    className="w-6 h-6 text-indigo-600 dark:text-indigo-400"
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Total Kontak
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {contacts.length}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={loadContacts}
              disabled={loadingContacts}
              className="w-full bg-indigo-500 hover:bg-indigo-600 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:shadow-none"
            >
              {loadingContacts ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    className="w-4 h-4 animate-spin"
                  />
                  <span>Memuat...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faSync} className="w-4 h-4" />
                  <span>Refresh</span>
                </>
              )}
            </button>
          </motion.div>

          {/* Messages Today Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faChartLine}
                    className="w-6 h-6 text-purple-600 dark:text-purple-400"
                  />
                </div>
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Pesan Hari Ini
                  </p>
                  <p className="text-lg font-semibold text-gray-900 dark:text-white">
                    {reportRealtime.length}
                  </p>
                </div>
              </div>
            </div>
            <button
              onClick={loadReportRealtime}
              disabled={loadingRealtime}
              className="w-full bg-purple-500 hover:bg-purple-600 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2 shadow-md hover:shadow-lg disabled:shadow-none"
              title="Rate limit: 1 request per menit"
            >
              {loadingRealtime ? (
                <>
                  <FontAwesomeIcon
                    icon={faSpinner}
                    className="w-4 h-4 animate-spin"
                  />
                  <span>Memuat...</span>
                </>
              ) : (
                <>
                  <FontAwesomeIcon icon={faSync} className="w-4 h-4" />
                  <span>Refresh</span>
                </>
              )}
            </button>
          </motion.div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Send Message Card */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faPaperPlane}
                  className="w-5 h-5 text-green-600 dark:text-green-400"
                />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Kirim Pesan
              </h2>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FontAwesomeIcon
                    icon={faPhone}
                    className="w-4 h-4 mr-2 text-gray-500"
                  />
                  Nomor Telepon <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={phone}
                      onChange={(e) => {
                        setPhone(e.target.value);
                        setShowContactDropdown(false);
                      }}
                      onFocus={() =>
                        setShowContactDropdown(contacts.length > 0)
                      }
                      placeholder="6281234567890"
                      className="flex-1 px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all"
                    />
                    {contacts.length > 0 && (
                      <button
                        type="button"
                        onClick={() =>
                          setShowContactDropdown(!showContactDropdown)
                        }
                        className="px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-all duration-200 shadow-md hover:shadow-lg"
                        title="Pilih dari contact"
                      >
                        <FontAwesomeIcon icon={faAddressBook} />
                      </button>
                    )}
                  </div>

                  {/* Contact Dropdown */}
                  {showContactDropdown && contacts.length > 0 && (
                    <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-xl max-h-60 overflow-y-auto">
                      {contacts.map((contact, index) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => handleContactSelect(contact)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
                              <FontAwesomeIcon
                                icon={faUser}
                                className="w-4 h-4 text-indigo-600 dark:text-indigo-400"
                              />
                            </div>
                            <div>
                              <div className="font-medium">
                                {contact.name || "No Name"}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {contact.phone}
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
                  Format: 6281234567890 (tanpa +, mulai dengan 62)
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  <FontAwesomeIcon
                    icon={faEnvelope}
                    className="w-4 h-4 mr-2 text-gray-500"
                  />
                  Pesan <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Tulis pesan yang akan dikirim..."
                  rows={5}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none transition-all"
                />
              </div>

              <button
                onClick={testSendMessage}
                disabled={loading || !phone.trim() || !message.trim()}
                className="w-full bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-400 disabled:to-gray-500 text-white px-6 py-3.5 rounded-lg transition-all duration-200 font-semibold text-lg shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center gap-3"
              >
                {loading ? (
                  <>
                    <FontAwesomeIcon
                      icon={faSpinner}
                      className="w-5 h-5 animate-spin"
                    />
                    <span>Mengirim...</span>
                  </>
                ) : (
                  <>
                    <FontAwesomeIcon icon={faPaperPlane} className="w-5 h-5" />
                    <span>Kirim Pesan</span>
                  </>
                )}
              </button>

              {testResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <FontAwesomeIcon
                      icon={faCheckCircle}
                      className="w-5 h-5 text-green-600 dark:text-green-400"
                    />
                    <h3 className="font-semibold text-green-900 dark:text-green-300">
                      Response:
                    </h3>
                  </div>
                  <pre className="text-xs overflow-auto bg-white dark:bg-gray-800 p-3 rounded border border-gray-200 dark:border-gray-600 text-gray-800 dark:text-gray-200">
                    {JSON.stringify(testResult, null, 2)}
                  </pre>
                </motion.div>
              )}

              {error && testResult && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800"
                >
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      className="w-5 h-5 text-red-600 dark:text-red-400"
                    />
                    <p className="text-red-800 dark:text-red-300">{error}</p>
                  </div>
                </motion.div>
              )}
            </div>
          </motion.div>

          {/* Device Info Card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.5, delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faMobileAlt}
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
                />
              </div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                Informasi Device
              </h2>
            </div>

            {deviceInfo ? (
              <div className="space-y-4">
                <div className="p-4 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-lg border border-green-200 dark:border-green-800">
                  <div className="flex items-center gap-2 mb-3">
                    <FontAwesomeIcon
                      icon={faCheckCircle}
                      className="w-5 h-5 text-green-600 dark:text-green-400"
                    />
                    <h3 className="font-semibold text-green-800 dark:text-green-300">
                      Device Terhubung
                    </h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        Serial:
                      </span>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {deviceInfo.serial}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        Sender:
                      </span>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {deviceInfo.sender}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        Name:
                      </span>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {deviceInfo.name}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        Quota:
                      </span>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {deviceInfo.quota}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        Expired:
                      </span>
                      <p className="text-gray-900 dark:text-white font-semibold">
                        {deviceInfo.expired_date}
                      </p>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400 font-medium">
                        Status:
                      </span>
                      <p
                        className={`font-semibold ${
                          deviceInfo.status === "connected"
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        {deviceInfo.status}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faMobileAlt}
                    className="w-8 h-8 text-gray-400"
                  />
                </div>
                <p className="text-gray-500 dark:text-gray-400">
                  Klik tombol "Cek Status" untuk melihat informasi device
                </p>
              </div>
            )}

            {error && !deviceInfo && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon
                    icon={faExclamationTriangle}
                    className="w-5 h-5 text-red-600 dark:text-red-400"
                  />
                  <p className="text-red-800 dark:text-red-300 text-sm">
                    {error}
                  </p>
                </div>
              </div>
            )}
          </motion.div>
        </div>

        {/* Report Realtime Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faChartLine}
                  className="w-5 h-5 text-purple-600 dark:text-purple-400"
                />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Laporan Pesan Realtime
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {currentDay ? `Pesan yang dikirim hari ini (${currentDay})` : "Pesan yang dikirim hari ini"}
                </p>
              </div>
            </div>
          </div>

          {loadingRealtime ? (
            <SkeletonTable />
          ) : reportRealtime.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Phone
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Message
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {reportRealtime.map((report: any, index: number) => {
                    // Format phone - bisa object {from, to} atau string
                    let phoneDisplay = "-";
                    let phoneNumber = "";
                    if (report.phone) {
                      if (
                        typeof report.phone === "object" &&
                        report.phone.from &&
                        report.phone.to
                      ) {
                        phoneDisplay = `${report.phone.from} → ${report.phone.to}`;
                        phoneNumber = report.phone.to; // Ambil nomor tujuan untuk lookup nama
                      } else {
                        phoneDisplay = String(report.phone);
                        phoneNumber = String(report.phone);
                      }
                    } else if (report.recipient) {
                      phoneDisplay = String(report.recipient);
                      phoneNumber = String(report.recipient);
                    }

                    // Cari nama dari contacts berdasarkan phone number
                    let contactName = "-";
                    if (phoneNumber) {
                      // Normalize phone number untuk matching (hilangkan spasi, karakter khusus)
                      const normalizedPhone = phoneNumber
                        .replace(/\s+/g, "")
                        .replace(/[^\d]/g, "");
                      const foundContact = contacts.find((contact: Contact) => {
                        const contactPhone = String(contact.phone || "")
                          .replace(/\s+/g, "")
                          .replace(/[^\d]/g, "");
                        return (
                          contactPhone === normalizedPhone ||
                          contactPhone.endsWith(normalizedPhone) ||
                          normalizedPhone.endsWith(contactPhone)
                        );
                      });
                      if (foundContact && foundContact.name) {
                        contactName = foundContact.name;
                      }
                    }

                    // Format date - bisa object {created_at, updated_at} atau string
                    let dateDisplay = "-";
                    let dateObj: Date | null = null;
                    
                    if (report.date) {
                      if (
                        typeof report.date === "object" &&
                        report.date.created_at
                      ) {
                        dateObj = new Date(report.date.created_at);
                      } else {
                        dateObj = new Date(String(report.date));
                      }
                    } else if (report.created_at) {
                      dateObj = new Date(String(report.created_at));
                    } else if (report.timestamp) {
                      dateObj = new Date(String(report.timestamp));
                    }
                    
                    if (dateObj && !isNaN(dateObj.getTime())) {
                      // Format: "HH:mm - dd/MM/yyyy"
                      const hours = dateObj.getHours().toString().padStart(2, '0');
                      const minutes = dateObj.getMinutes().toString().padStart(2, '0');
                      const day = dateObj.getDate().toString().padStart(2, '0');
                      const month = (dateObj.getMonth() + 1).toString().padStart(2, '0');
                      const year = dateObj.getFullYear();
                      dateDisplay = `${hours}:${minutes} - ${day}/${month}/${year}`;
                    } else {
                      dateDisplay = "-";
                    }

                    return (
                      <tr
                        key={index}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {index + 1}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                          {contactName}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                          {phoneDisplay}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                          {report.message || report.text || "-"}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${
                              report.status === "read"
                                ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-300 dark:border-blue-700 font-semibold"
                                : report.status === "sent"
                                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300"
                                : report.status === "pending"
                                ? "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300"
                                : report.status === "delivered"
                                ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-300"
                                : "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {report.status ? report.status.toUpperCase() : "-"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 dark:text-gray-400">
                          <div className="flex items-center gap-2">
                            <FontAwesomeIcon
                              icon={faClock}
                              className="w-3 h-3"
                            />
                            {dateDisplay}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faChartLine}
                  className="w-8 h-8 text-gray-400"
                />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                Tidak ada laporan realtime
              </p>
            </div>
          )}
        </motion.div>

        {/* REMOVED: Report Messages (All) Section - Deleted per user request */}

        {/* Contacts List Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.7 }}
          className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6 mb-6 border border-gray-200 dark:border-gray-700"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faAddressBook}
                  className="w-5 h-5 text-indigo-600 dark:text-indigo-400"
                />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  Daftar Kontak
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {contacts.length} kontak tersedia
                </p>
              </div>
            </div>
          </div>

          {loadingContacts ? (
            <SkeletonTable />
          ) : contacts.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      No
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase tracking-wider">
                      Phone
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {contacts.map((contact: Contact, index: number) => (
                    <tr
                      key={index}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {index + 1}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
                            <FontAwesomeIcon
                              icon={faUser}
                              className="w-4 h-4 text-indigo-600 dark:text-indigo-400"
                            />
                          </div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {contact.name || "-"}
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white font-medium">
                        {contact.phone || "-"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 mx-auto mb-4 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faAddressBook}
                  className="w-8 h-8 text-gray-400"
                />
              </div>
              <p className="text-gray-500 dark:text-gray-400">
                Tidak ada contact
              </p>
            </div>
          )}
        </motion.div>

        {/* Info Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.8 }}
          className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl shadow-lg p-6 border border-blue-200 dark:border-blue-800"
        >
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
              <FontAwesomeIcon
                icon={faInfoCircle}
                className="w-5 h-5 text-blue-600 dark:text-blue-400"
              />
            </div>
            <h3 className="font-bold text-blue-900 dark:text-blue-300 text-lg">
              Catatan Penting
            </h3>
          </div>
          <ul className="space-y-2 text-sm text-blue-800 dark:text-blue-300">
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
              <span>
                Pastikan device WhatsApp sudah terhubung di dashboard Wablas
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
              <span>
                Token WABLAS_TOKEN dan WABLAS_SECRET_KEY sudah di-set di .env
                backend
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
              <span>
                Format nomor: 6281234567890 (tanpa +, mulai dengan 62)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
              <span>
                Jika IP belum di-whitelist, tambahkan IP server di dashboard
                Wablas (Device → Settings → Whitelist IP)
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
              <span>
                <strong>Data Source:</strong> Semua data (laporan, contact)
                diambil langsung dari Wablas API, bukan dari database lokal
              </span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-600 dark:text-blue-400 mt-1">•</span>
              <span>
                Jika muncul rate limit (429), tunggu beberapa saat lalu refresh
              </span>
            </li>
          </ul>
        </motion.div>

        {/* Settings Modal */}
        <AnimatePresence mode="wait">
          {showSettings && isSuperAdmin && (
            <div
              className="fixed inset-0 bg-black/80 backdrop-blur-lg z-[999999] flex items-center justify-center p-4"
              style={{ zIndex: 999999 }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto border border-gray-200 dark:border-gray-700"
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <FontAwesomeIcon
                        icon={faCog}
                        className="w-5 h-5 text-gray-600 dark:text-gray-400"
                      />
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Settings Wablas
                    </h2>
                  </div>
                  <button
                    onClick={() => setShowSettings(false)}
                    className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 flex items-center justify-center transition-colors"
                  >
                    <FontAwesomeIcon
                      icon={faTimesCircle}
                      className="w-5 h-5 text-gray-500 dark:text-gray-400"
                    />
                  </button>
                </div>

                {loadingSettings ? (
                  <div className="text-center py-12">
                    <FontAwesomeIcon
                      icon={faSpinner}
                      className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4"
                    />
                    <p className="text-gray-500 dark:text-gray-400">
                      Memuat settings...
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Token <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={settings.token}
                        onChange={(e) =>
                          setSettings({ ...settings, token: e.target.value })
                        }
                        placeholder="Masukkan Wablas Token"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Token dapat dilihat di menu: Device - Setting
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Secret Key <span className="text-red-500">*</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showSecretKey ? "text" : "password"}
                          value={settings.secret_key}
                          onChange={(e) =>
                            setSettings({
                              ...settings,
                              secret_key: e.target.value,
                            })
                          }
                          placeholder="Masukkan Secret Key"
                          className="w-full px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                        <button
                          type="button"
                          onClick={() => setShowSecretKey(!showSecretKey)}
                          className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                        >
                          <FontAwesomeIcon
                            icon={showSecretKey ? faEyeSlash : faEye}
                            className="w-5 h-5"
                          />
                        </button>
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Secret key akan dikirim ke nomor WhatsApp admin
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Base URL
                      </label>
                      <input
                        type="url"
                        value={settings.base_url}
                        onChange={(e) =>
                          setSettings({ ...settings, base_url: e.target.value })
                        }
                        placeholder="https://tegal.wablas.com/api"
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                      />
                    </div>

                    {settingsError && (
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-center gap-2">
                          <FontAwesomeIcon
                            icon={faExclamationTriangle}
                            className="w-5 h-5 text-red-600 dark:text-red-400"
                          />
                          <p className="text-sm text-red-800 dark:text-red-300">
                            {settingsError}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-3 pt-4">
                      <button
                        onClick={saveSettings}
                        disabled={
                          savingSettings ||
                          !settings.token ||
                          !settings.secret_key
                        }
                        className="flex-1 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg transition-all duration-200 font-semibold shadow-lg hover:shadow-xl disabled:shadow-none flex items-center justify-center gap-2"
                      >
                        {savingSettings ? (
                          <>
                            <FontAwesomeIcon
                              icon={faSpinner}
                              className="w-5 h-5 animate-spin"
                            />
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon
                              icon={faCheckCircle}
                              className="w-5 h-5"
                            />
                            <span>Simpan Settings</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() => {
                          setShowSettings(false);
                          setSettingsError(null);
                        }}
                        className="px-6 py-3 bg-gray-500 hover:bg-gray-600 text-white rounded-lg transition-all duration-200 font-semibold shadow-md hover:shadow-lg"
                      >
                        Batal
                      </button>
                    </div>

                    <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                      <div className="flex items-start gap-2">
                        <FontAwesomeIcon
                          icon={faInfoCircle}
                          className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5"
                        />
                        <div className="text-sm text-yellow-800 dark:text-yellow-300">
                          <p className="font-semibold mb-1">Perhatian:</p>
                          <p>
                            Setelah menyimpan settings, halaman akan otomatis
                            di-reload untuk menerapkan perubahan. Pastikan token
                            dan secret key sudah benar.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
