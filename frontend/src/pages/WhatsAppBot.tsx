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

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];

export default function WhatsAppBot() {
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
          return parsed;
        } else {
          // Data is from a different day, clear it
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
  const [lastDeviceRefreshTime, setLastDeviceRefreshTime] = useState<number>(0);
  const [currentDay, setCurrentDay] = useState<string>("");

  // Settings states
  const [showSettings, setShowSettings] = useState(false);
  const [loadingSettings, setLoadingSettings] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settings, setSettings] = useState({
    token: "8nJAtEBEAggiJRZ4sii7wsTlbhEcDBXJnvPa9PZto5LN9n7U9nf3rZ3", // Default token
    secret_key: "W6hDTKYG", // Default secret key
    base_url: "https://tegal.wablas.com/api",
    enabled: false, // Default false, akan di-update dari loadSettings
  });
  const [showSecretKey, setShowSecretKey] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  // Pagination states for Report Realtime
  const [reportPage, setReportPage] = useState(1);
  const [reportPageSize, setReportPageSize] = useState(10);

  // Pagination states for Contacts
  const [contactsPage, setContactsPage] = useState(1);
  const [contactsPageSize, setContactsPageSize] = useState(10);

  // Pagination computed values for Report Realtime
  const reportTotalPages = Math.ceil(reportRealtime.length / reportPageSize);
  const paginatedReportRealtime = reportRealtime.slice(
    (reportPage - 1) * reportPageSize,
    reportPage * reportPageSize
  );

  // Pagination computed values for Contacts
  const contactsTotalPages = Math.ceil(contacts.length / contactsPageSize);
  const paginatedContacts = contacts.slice(
    (contactsPage - 1) * contactsPageSize,
    contactsPage * contactsPageSize
  );

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
      setLastDeviceRefreshTime(Date.now());
    }
  };

  const loadContacts = async () => {
    try {
      setLoadingContacts(true);
      const response = await api.get("/whatsapp/contacts", {
        params: { limit: 1000 }, // Load banyak contact
      });


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
        }
        // Fallback: cek jika data langsung array
        else if (Array.isArray(wablasData)) {
          contactsData = wablasData;
        }
        // Fallback: cek nested data
        else if (wablasData.data && Array.isArray(wablasData.data)) {
          contactsData = wablasData.data;
        }
        // Fallback: cek contacts field
        else if (wablasData.contacts && Array.isArray(wablasData.contacts)) {
          contactsData = wablasData.contacts;
        }
        setContacts(contactsData);
      } else {
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

      // Gunakan endpoint /whatsapp/report-realtime
      // Endpoint ini otomatis filter untuk hari ini ("report only today" sesuai dokumentasi Wablas)
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD format
      
      // Fetch semua halaman jika ada lebih dari 100 data
      // Catatan: Wablas API memiliki rate limit 1 request per menit, jadi kita perlu hati-hati
      let allRealtimeData: any[] = [];
      let currentPage = 1;
      let totalPages = 1;
      const limit = 100; // Max limit dari Wablas adalah 1000, tapi kita pakai 100 untuk menghindari rate limit
      
      do {
        // Tambahkan delay 1 detik antara request untuk menghindari rate limit
        if (currentPage > 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
        
        const response = await api.get("/whatsapp/report-realtime", {
          params: { 
            limit: limit,
            page: currentPage,
          },
        });

        // Handle rate limit - jangan reset data jika rate limited
        if (response.data?.rate_limited) {
          // Cek apakah ada data di localStorage jika state kosong
          setReportRealtime((prev) => {
            if (prev.length === 0) {
              // Coba load dari localStorage
              try {
                const saved = localStorage.getItem("whatsapp_realtime_reports");
                if (saved) {
                  const parsed = JSON.parse(saved);
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
        // Format response dari Wablas (sesuai dokumentasi):
        // {
        //   "status": true,
        //   "message": "success, report only today",
        //   "device_id": "...",
        //   "page": "1",
        //   "totalPage": 1,
        //   "totalData": 2,
        //   "message": [ {...}, {...} ]  <- Array data ada di sini
        // }
        const responseData = response.data.data;

        // Handle berbagai format response
        let realtimeData = [];
        
        // PRIORITAS 1: Ambil dari field "data" (untuk endpoint /report-realtime)
        if (
          responseData.data &&
          Array.isArray(responseData.data) &&
          responseData.data.length > 0
        ) {
          // Format: { status: true, data: [...] } - untuk /report-realtime
          realtimeData = responseData.data;
        } else if (
          Array.isArray(responseData.message) &&
          responseData.message.length > 0 &&
          typeof responseData.message[0] === "object" // Pastikan ini array of objects, bukan string
        ) {
          // Format: { status: true, message: [...] } - untuk /report/message
          realtimeData = responseData.message;
        } else if (Array.isArray(responseData) && responseData.length > 0) {
          // Format: langsung array
          realtimeData = responseData;
        } else if (
          responseData.messages &&
          Array.isArray(responseData.messages) &&
          responseData.messages.length > 0
        ) {
          realtimeData = responseData.messages;
        }
        
          // Debug log untuk melihat struktur data
          console.log(`[loadReportRealtime] Page ${currentPage} Response structure:`, {
            hasMessage: Array.isArray(responseData.message),
            messageLength: Array.isArray(responseData.message) ? responseData.message.length : 0,
            hasData: Array.isArray(responseData.data),
            dataLength: Array.isArray(responseData.data) ? responseData.data.length : 0,
            isArray: Array.isArray(responseData),
            responseDataKeys: Object.keys(responseData),
            totalData: responseData.totalData,
            totalPage: responseData.totalPage,
            page: responseData.page,
            fullResponseData: responseData, // Log full response untuk debugging
            realtimeDataLength: realtimeData.length,
            realtimeDataSample: realtimeData.length > 0 ? realtimeData[0] : null,
          });

          // Accumulate data dari semua halaman
          allRealtimeData = [...allRealtimeData, ...realtimeData];
          
          // Update totalPages dari response
          if (responseData.totalPage) {
            totalPages = parseInt(responseData.totalPage) || 1;
          } else if (responseData.totalData && realtimeData.length > 0) {
            // Calculate total pages jika tidak ada di response
            totalPages = Math.ceil(parseInt(responseData.totalData) / limit);
          }
          
          // Jika sudah dapat semua data atau tidak ada data lagi, break
          if (realtimeData.length === 0 || currentPage >= totalPages) {
            break;
          }
          
          currentPage++;
        } else {
          // Jika tidak ada data di response, break loop
          break;
        }
        
        // Safety check: jangan fetch lebih dari 10 halaman untuk menghindari rate limit
        if (currentPage > 10) {
          console.warn('[loadReportRealtime] Stopped fetching after 10 pages to avoid rate limit');
          break;
        }
      } while (currentPage <= totalPages);

      // Clear error jika berhasil dan ada data
      if (allRealtimeData.length > 0) {
        setError(null);
      }

      // Endpoint /report-realtime sudah otomatis filter untuk hari ini ("report only today")
      // Jadi kita tidak perlu filter lagi di frontend, langsung gunakan semua data
      const filteredData = allRealtimeData;
      
      // Debug log untuk melihat hasil filter
      console.log('[loadReportRealtime] Final results:', {
        totalRealtimeData: allRealtimeData.length,
        filteredDataLength: filteredData.length,
        todayStr,
        totalPages,
        sampleReport: allRealtimeData.length > 0 ? allRealtimeData[0] : null,
        allRealtimeData: allRealtimeData, // Log semua data untuk debugging
      });
      
      // Update state dengan semua data yang sudah di-accumulate
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
      } catch (err) {
        // Error saving to localStorage - silent fail
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
          return prev; // Keep existing data
        }
      });
    } finally {
      setLoadingRealtime(false);
    }
  };

  // Load Settings
  const loadSettings = async () => {
    if (!isSuperAdmin) return;

    // Default values yang akan digunakan jika tidak ada di backend
    const DEFAULT_TOKEN = "8nJAtEBEAggiJRZ4sii7wsTlbhEcDBXJnvPa9PZto5LN9n7U9nf3rZ3";
    const DEFAULT_SECRET_KEY = "W6hDTKYG";
    const DEFAULT_BASE_URL = "https://tegal.wablas.com/api";

    try {
      setLoadingSettings(true);
      const response = await api.get("/whatsapp/settings");
      if (response.data && response.data.token && response.data.secret_key) {
        // Jika ada data di backend, gunakan data dari backend
        const hasTokenAndSecret = !!(
          response.data.token && response.data.secret_key
        );
        setSettings({
          token: response.data.token,
          secret_key: response.data.secret_key,
          base_url: response.data.base_url || DEFAULT_BASE_URL,
          enabled: hasTokenAndSecret,
        });
      } else {
        // Jika tidak ada data di backend atau kosong, gunakan default values
        // dan auto-save ke backend agar tidak hilang
        setSettings({
          token: DEFAULT_TOKEN,
          secret_key: DEFAULT_SECRET_KEY,
          base_url: DEFAULT_BASE_URL,
          enabled: true,
        });
        
        // Auto-save default values ke backend agar tidak hilang
        try {
          await api.put("/whatsapp/settings", {
            token: DEFAULT_TOKEN,
            secret_key: DEFAULT_SECRET_KEY,
            base_url: DEFAULT_BASE_URL,
            enabled: true,
          });
          console.log("[loadSettings] Default values telah disimpan ke backend");
        } catch (saveErr: any) {
          console.error("[loadSettings] Error auto-saving default values:", saveErr);
          // Tidak set error karena ini opsional, user masih bisa menggunakan default values
        }
      }
    } catch (err: any) {
      console.error("Error loading settings:", err);
      // Jika error, tetap gunakan default values
      setSettings({
        token: DEFAULT_TOKEN,
        secret_key: DEFAULT_SECRET_KEY,
        base_url: DEFAULT_BASE_URL,
        enabled: true,
      });
      // Coba auto-save default values ke backend
      try {
        await api.put("/whatsapp/settings", {
          token: DEFAULT_TOKEN,
          secret_key: DEFAULT_SECRET_KEY,
          base_url: DEFAULT_BASE_URL,
          enabled: true,
        });
        console.log("[loadSettings] Default values telah disimpan ke backend setelah error");
      } catch (saveErr: any) {
        console.error("[loadSettings] Error auto-saving default values setelah error:", saveErr);
      }
      setSettingsError("Gagal memuat settings, menggunakan default values");
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
    loadReportRealtime();

    // Check device status saat component mount
    checkDevice();

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
          loadReportRealtime();
          return now; // Update last refresh time
        } else {
          return prevTime; // Keep previous time
        }
      });

      // Auto-refresh device status setiap 30 detik
      // Hanya refresh jika sudah lebih dari 60 detik sejak refresh terakhir (untuk menghindari rate limit)
      setLastDeviceRefreshTime((prevTime) => {
        const timeSinceLastRefresh = now - prevTime;
        // Hanya refresh jika sudah lebih dari 60 detik (rate limit biasanya 1 request per menit)
        if (timeSinceLastRefresh >= 60000) {
          checkDevice();
          return now; // Update last refresh time
        } else {
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

  // Reset page to 1 when data changes
  useEffect(() => {
    setReportPage(1);
  }, [reportRealtime.length]);

  useEffect(() => {
    setContactsPage(1);
  }, [contacts.length]);

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
      // Tunggu beberapa detik dulu untuk memastikan pesan sudah terdaftar di Wablas API
      // Wablas API butuh waktu untuk update report, jadi kita refresh beberapa kali
      let refreshAttempts = 0;
      const maxAttempts = 3;
      
      const refreshReport = () => {
        refreshAttempts++;
        console.log(`[testSendMessage] Refreshing report (attempt ${refreshAttempts}/${maxAttempts})...`);
        setLastRefreshTime(Date.now());
        loadReportRealtime();
        
        // Jika belum mencapai max attempts, refresh lagi setelah delay
        if (refreshAttempts < maxAttempts) {
          setTimeout(refreshReport, 5000); // Refresh setiap 5 detik
        }
      };
      
      // Mulai refresh setelah 3 detik pertama
      setTimeout(refreshReport, 3000);
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

  const SkeletonTable = ({ columns = 6 }: { columns?: number }) => (
    <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
      <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
        <tr>
          {Array.from({ length: columns }).map((_, i) => (
            <th key={i} className="px-6 py-4">
              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {Array.from({ length: 5 }).map((_, idx) => (
          <tr
            key={idx}
            className={idx % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""}
          >
            {Array.from({ length: columns }).map((_, i) => (
              <td key={i} className="px-6 py-4">
                <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="w-full mx-auto">
        {/* Header Section */}
      <div className="mb-8">
          <div className="flex items-center justify-between">
              <div>
            <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
                  WhatsApp Bot Management
                </h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
                  Kelola dan monitor pesan WhatsApp melalui Wablas API
                </p>
            </div>
            {isSuperAdmin && (
              <button
                onClick={() => {
                  setShowSettings(true);
                  loadSettings();
                }}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white text-sm rounded-lg transition-all duration-200 font-medium flex items-center gap-2"
              >
                <FontAwesomeIcon icon={faCog} className="w-4 h-4" />
                <span>Settings</span>
              </button>
            )}
          </div>
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                Catatan Penting
              </h4>
              <ul className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
                <li>• Pastikan device WhatsApp sudah terhubung di dashboard Wablas</li>
                <li>• Token WABLAS_TOKEN dan WABLAS_SECRET_KEY sudah di-set di .env backend</li>
                <li>• Format nomor: 6281234567890 (tanpa +, mulai dengan 62)</li>
                <li>• Jika IP belum di-whitelist, tambahkan IP server di dashboard Wablas (Device → Settings → Whitelist IP)</li>
                <li>• Data Source: Semua data (laporan, contact) diambil langsung dari Wablas API, bukan dari database lokal</li>
                <li>• Jika muncul rate limit (429), tunggu beberapa saat lalu refresh</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

        {/* Stats Cards Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {/* Device Status Card */}
        <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/[0.05] p-6">
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
            className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>

          {/* Contacts Count Card */}
        <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/[0.05] p-6">
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
            className="w-full bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>

          {/* Messages Today Card */}
        <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/[0.05] p-6">
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
            className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-gray-400 text-white px-4 py-2.5 rounded-lg transition-all duration-200 font-medium text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
        </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Send Message Card */}
        <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/[0.05] p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faPaperPlane}
                  className="w-5 h-5 text-green-600 dark:text-green-400"
                />
              </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
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
                      className="px-4 py-3 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg transition-all duration-200"
                        title="Pilih dari contact"
                      >
                        <FontAwesomeIcon icon={faAddressBook} />
                      </button>
                    )}
                  </div>

                  {/* Contact Dropdown */}
                  {showContactDropdown && contacts.length > 0 && (
                  <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg max-h-60 overflow-y-auto">
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
              className="w-full bg-brand-500 hover:bg-brand-600 disabled:bg-gray-400 text-white px-6 py-3 rounded-lg transition-all duration-200 font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
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
              <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
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
              </div>
              )}

              {error && testResult && (
              <div className="mt-4 p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-2">
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      className="w-5 h-5 text-red-600 dark:text-red-400"
                    />
                    <p className="text-red-800 dark:text-red-300">{error}</p>
                  </div>
              </div>
              )}
            </div>
        </div>

          {/* Device Info Card */}
        <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/[0.05] p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faMobileAlt}
                  className="w-5 h-5 text-blue-600 dark:text-blue-400"
                />
              </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Informasi Device
              </h2>
            </div>

            {deviceInfo ? (
              <div className="space-y-4">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
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
        </div>
        </div>

        {/* Report Realtime Section */}
      <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/[0.05] p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faChartLine}
                  className="w-5 h-5 text-purple-600 dark:text-purple-400"
                />
              </div>
              <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Laporan Pesan Realtime
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {currentDay ? `Pesan yang dikirim hari ini (${currentDay})` : "Pesan yang dikirim hari ini"}
                </p>
              </div>
            </div>
          </div>

        {/* Tabel dengan scroll horizontal */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div
            className="max-w-full overflow-x-auto hide-scroll"
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
          {loadingRealtime ? (
            <SkeletonTable columns={7} />
          ) : reportRealtime.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                      No
                    </th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                      Name
                    </th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                      Sender (BOT)
                    </th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                      Recipient
                    </th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                      Message
                    </th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                      Status
                    </th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                      Time
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedReportRealtime.map((report: any, index: number) => {
                    const globalIndex = (reportPage - 1) * reportPageSize + index;
                    // Format phone - bisa object {from, to} atau string
                    let senderPhone = "-";
                    let recipientPhone = "-";
                    let phoneNumber = "";
                    if (report.phone) {
                      if (
                        typeof report.phone === "object" &&
                        report.phone.from &&
                        report.phone.to
                      ) {
                        senderPhone = String(report.phone.from);
                        recipientPhone = String(report.phone.to);
                        phoneNumber = report.phone.to; // Ambil nomor tujuan untuk lookup nama
                      } else {
                        // Jika phone adalah string, anggap sebagai recipient
                        recipientPhone = String(report.phone);
                        phoneNumber = String(report.phone);
                      }
                    } else if (report.recipient) {
                      recipientPhone = String(report.recipient);
                      phoneNumber = String(report.recipient);
                    }
                    
                    // Cek juga field from dan to langsung di report
                    if (report.from && !senderPhone) {
                      senderPhone = String(report.from);
                    }
                    if (report.to && !recipientPhone) {
                      recipientPhone = String(report.to);
                      phoneNumber = String(report.to);
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
                        className={index % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""}
                      >
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {globalIndex + 1}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                          {contactName}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                          {senderPhone}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                          {recipientPhone}
                        </td>
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white max-w-xs truncate">
                          {report.message || report.text || "-"}
                        </td>
                        <td className="px-6 py-4">
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
                        <td className="px-6 py-4 text-sm text-gray-600 dark:text-gray-400">
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
          </div>

          {/* Pagination */}
          {reportRealtime.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-4">
              <div className="flex items-center gap-4">
                <select
                  value={reportPageSize}
                  onChange={(e) => {
                    setReportPageSize(Number(e.target.value));
                    setReportPage(1);
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
                  Menampilkan {paginatedReportRealtime.length} dari {reportRealtime.length} data
                </span>
              </div>
              <div className="flex items-center gap-2 justify-center sm:justify-end">
                <button
                  onClick={() => setReportPage((p) => Math.max(1, p - 1))}
                  disabled={reportPage === 1}
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
                    onClick={() => setReportPage(1)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                      reportPage === 1
                        ? "bg-brand-500 text-white"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    1
                  </button>

                  {/* Show ellipsis if current page is far from start */}
                  {reportPage > 4 && (
                    <span className="px-2 text-gray-500 dark:text-gray-400">
                      ...
                    </span>
                  )}

                  {/* Show pages around current page */}
                  {Array.from({ length: reportTotalPages }, (_, i) => {
                    const pageNum = i + 1;
                    // Show pages around current page (2 pages before and after)
                    const shouldShow =
                      pageNum > 1 &&
                      pageNum < reportTotalPages &&
                      pageNum >= reportPage - 2 &&
                      pageNum <= reportPage + 2;

                    if (!shouldShow) return null;

                    return (
                      <button
                        key={i}
                        onClick={() => setReportPage(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                          reportPage === pageNum
                            ? "bg-brand-500 text-white"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {/* Show ellipsis if current page is far from end */}
                  {reportPage < reportTotalPages - 3 && (
                    <span className="px-2 text-gray-500 dark:text-gray-400">
                      ...
                    </span>
                  )}

                  {/* Always show last page if it's not the first page */}
                  {reportTotalPages > 1 && (
                    <button
                      onClick={() => setReportPage(reportTotalPages)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                        reportPage === reportTotalPages
                          ? "bg-brand-500 text-white"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {reportTotalPages}
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setReportPage((p) => Math.min(reportTotalPages, p + 1))}
                  disabled={reportPage === reportTotalPages}
                  className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

        {/* REMOVED: Report Messages (All) Section - Deleted per user request */}

        {/* Contacts List Section */}
      <div className="bg-white dark:bg-white/[0.03] rounded-xl border border-gray-200 dark:border-white/[0.05] p-6 mb-8">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-900/20 flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faAddressBook}
                  className="w-5 h-5 text-indigo-600 dark:text-indigo-400"
                />
              </div>
              <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Daftar Kontak
                </h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  {contacts.length} kontak tersedia
                </p>
              </div>
            </div>
          </div>

        {/* Tabel dengan scroll horizontal */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
          <div
            className="max-w-full overflow-x-auto hide-scroll"
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
          {loadingContacts ? (
              <SkeletonTable columns={3} />
          ) : contacts.length > 0 ? (
              <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                  <tr>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                      No
                    </th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                      Name
                    </th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">
                      Phone
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedContacts.map((contact: Contact, index: number) => {
                    const globalIndex = (contactsPage - 1) * contactsPageSize + index;
                    return (
                    <tr
                      key={index}
                        className={index % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""}
                    >
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white">
                          {globalIndex + 1}
                      </td>
                        <td className="px-6 py-4">
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
                        <td className="px-6 py-4 text-sm text-gray-900 dark:text-white font-medium">
                        {contact.phone || "-"}
                      </td>
                    </tr>
                    );
                  })}
                </tbody>
              </table>
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
          </div>

          {/* Pagination */}
          {contacts.length > 0 && (
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-4">
              <div className="flex items-center gap-4">
                <select
                  value={contactsPageSize}
                  onChange={(e) => {
                    setContactsPageSize(Number(e.target.value));
                    setContactsPage(1);
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
                  Menampilkan {paginatedContacts.length} dari {contacts.length} data
                </span>
            </div>
              <div className="flex items-center gap-2 justify-center sm:justify-end">
                <button
                  onClick={() => setContactsPage((p) => Math.max(1, p - 1))}
                  disabled={contactsPage === 1}
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
                    onClick={() => setContactsPage(1)}
                    className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                      contactsPage === 1
                        ? "bg-brand-500 text-white"
                        : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    1
                  </button>

                  {/* Show ellipsis if current page is far from start */}
                  {contactsPage > 4 && (
                    <span className="px-2 text-gray-500 dark:text-gray-400">
                      ...
              </span>
                  )}

                  {/* Show pages around current page */}
                  {Array.from({ length: contactsTotalPages }, (_, i) => {
                    const pageNum = i + 1;
                    // Show pages around current page (2 pages before and after)
                    const shouldShow =
                      pageNum > 1 &&
                      pageNum < contactsTotalPages &&
                      pageNum >= contactsPage - 2 &&
                      pageNum <= contactsPage + 2;

                    if (!shouldShow) return null;

                    return (
                      <button
                        key={i}
                        onClick={() => setContactsPage(pageNum)}
                        className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                          contactsPage === pageNum
                            ? "bg-brand-500 text-white"
                            : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                        }`}
                      >
                        {pageNum}
                      </button>
                    );
                  })}

                  {/* Show ellipsis if current page is far from end */}
                  {contactsPage < contactsTotalPages - 3 && (
                    <span className="px-2 text-gray-500 dark:text-gray-400">
                      ...
              </span>
                  )}

                  {/* Always show last page if it's not the first page */}
                  {contactsTotalPages > 1 && (
                    <button
                      onClick={() => setContactsPage(contactsTotalPages)}
                      className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${
                        contactsPage === contactsTotalPages
                          ? "bg-brand-500 text-white"
                          : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                      }`}
                    >
                      {contactsTotalPages}
                    </button>
                  )}
                </div>

                <button
                  onClick={() => setContactsPage((p) => Math.min(contactsTotalPages, p + 1))}
                  disabled={contactsPage === contactsTotalPages}
                  className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>


        {/* Settings Modal */}
        <AnimatePresence mode="wait">
          {showSettings && isSuperAdmin && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowSettings(false)}
            ></motion.div>
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
                onClick={() => setShowSettings(false)}
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
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center">
                      <FontAwesomeIcon
                        icon={faCog}
                        className="w-5 h-5 text-gray-600 dark:text-gray-400"
                      />
                    </div>
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                      Settings Wablas
                    </h2>
                  </div>
                </div>

                {loadingSettings ? (
                <div className="space-y-4">
                  {/* Token Field Skeleton */}
                  <div>
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
                    <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                    <div className="h-3 w-64 bg-gray-200 dark:bg-gray-700 rounded mt-1 animate-pulse"></div>
                  </div>

                  {/* Secret Key Field Skeleton */}
                  <div>
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
                    <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                    <div className="h-3 w-72 bg-gray-200 dark:bg-gray-700 rounded mt-1 animate-pulse"></div>
                  </div>

                  {/* Base URL Field Skeleton */}
                  <div>
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mb-2 animate-pulse"></div>
                    <div className="h-12 w-full bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                  </div>

                  {/* Buttons Skeleton */}
                  <div className="flex justify-end gap-2 pt-2">
                    <div className="h-10 w-20 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                    <div className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse"></div>
                  </div>
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

                  <div className="flex justify-end gap-2 pt-2 relative z-20">
                    <button
                      onClick={() => {
                        setShowSettings(false);
                        setSettingsError(null);
                      }}
                      className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                    >
                      Batal
                    </button>
                      <button
                        onClick={saveSettings}
                        disabled={
                          savingSettings ||
                          !settings.token ||
                          !settings.secret_key
                        }
                      className="px-3 sm:px-4 py-2 rounded-lg bg-blue-600 text-white text-xs sm:text-sm font-medium shadow-theme-xs hover:bg-blue-700 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed relative z-10 flex items-center justify-center gap-2"
                      >
                        {savingSettings ? (
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
                            <span>Menyimpan...</span>
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon
                              icon={faCheckCircle}
                            className="w-4 h-4"
                            />
                            <span>Simpan Settings</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
    </div>
  );
}
