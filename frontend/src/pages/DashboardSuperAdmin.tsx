import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import api, { BASE_URL, handleApiError } from "../utils/api";

interface SuperAdmin {
  id: number;
  name: string;
  email: string;
  username: string;
  created_at: string;
  is_logged_in: number;
}

interface DashboardStats {
  totalUsers: number;
  totalMahasiswa: number;
  totalDosen: number;
  totalTimAkademik: number;
  totalSuperAdmin: number;
  superAdmins: SuperAdmin[];
  totalMataKuliah: number;
  // totalKelas removed - Kelas feature no longer exists
  totalRuangan: number;
  totalJadwalAktif: number;
  recentActivities: Activity[];
  systemHealth: SystemHealth;
  attendanceStats: SemesterAttendanceStats;
  todaySchedule: TodayScheduleItem[];
  assessmentStats: AssessmentStats;
  systemNotifications: SystemNotification[];
  academicOverview: AcademicOverview;
  // Growth percentages
  usersGrowth?: number;
  mahasiswaGrowth?: number;
  dosenGrowth?: number;
  mataKuliahGrowth?: number;
}

interface Activity {
  id: number;
  description: string;
  subject_type: string | null;
  subject_id: number | null;
  causer_type: string | null;
  causer_id: number | null;
  event: string | null;
  properties: {
    attributes?: Record<string, any>;
    old?: Record<string, any>;
    details?: {
      ip_address?: string;
      browser?: string;
      os?: string;
      method?: string;
      path?: string;
    };
  } | null;
  created_at: string;
  causer?: {
    id: number;
    name: string;
  };
  role?: string;
  timestamp?: string;
  user?: string;
}

interface SystemHealth {
  database: "healthy" | "warning" | "error";
  storage: "healthy" | "warning" | "error";
  server: "healthy" | "warning" | "error";
  lastBackup: string;
}

interface MonitoringMetrics {
  timestamp: string;
  database: {
    current_connections: number;
    max_connections: number;
    connection_usage_percent: number;
    running_threads: number;
    max_used_connections: number;
    slow_queries: number;
    table_locks_waited: number;
    table_locks_immediate: number;
    status: "healthy" | "warning" | "critical" | "error";
  };
  queue: {
    queue_length: number;
    processing_jobs: number;
    failed_jobs: number;
    queue_connection: string;
    status: "healthy" | "warning" | "critical" | "error";
  };
  performance: {
    memory_usage_mb: number;
    memory_peak_mb: number;
    memory_limit: string;
    memory_usage_percent: number;
    execution_time_ms: number;
    query_count: number;
    status: "healthy" | "warning" | "critical" | "error";
  };
  system: {
    uptime: string;
    cpu_usage_percent: number | null;
    cpu_load: {
      "1min": number;
      "5min": number;
      "15min": number;
    } | null;
    php_version: string;
    laravel_version: string;
    os: string;
    status: "healthy" | "warning" | "critical" | "error";
  };
  cache: {
    driver: string;
    hits?: number;
    misses?: number;
    hit_rate?: number;
    error?: string;
  };
}

interface AttendanceStats {
  overall_rate: number;
  pbl_rate: number;
  journal_rate: number;
  csr_rate: number;
  total_students: number;
  low_attendance_students: number;
}

interface SemesterAttendanceStats {
  regular: AttendanceStats;
  antara: AttendanceStats;
}

interface TodayScheduleItem {
  type: string;
  mata_kuliah: string;
  dosen: string;
  ruangan: string;
  waktu: string;
  topik: string;
}

interface AssessmentStats {
  total_pbl_assessments: number;
  total_journal_assessments: number;
  pending_pbl: number;
  pending_journal: number;
  completion_rate: number;
  average_score: number;
}

interface SystemNotification {
  type: "info" | "warning" | "error" | "success";
  title: string;
  message: string;
  action: string;
}

interface AcademicOverview {
  current_semester: string;
  current_tahun_ajaran: string;
  semester_progress: number;
  active_blocks: string[];
  upcoming_deadlines: Array<{
    title: string;
    date: string;
  }>;
}

const DashboardSuperAdmin: React.FC = () => {
  const navigate = useNavigate();
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Semester info state
  const [tahunAjaran, setTahunAjaran] = useState<{ tahun: string; semesters: Array<{ id: number; jenis: string; aktif: boolean }> } | null>(null);
  
  // Get current user data
  const [user, setUser] = useState<any>(() => {
    return JSON.parse(localStorage.getItem("user") || "{}");
  });

  // Update user data when localStorage changes
  useEffect(() => {
    const handleStorageChange = () => {
      const newUser = JSON.parse(localStorage.getItem("user") || "{}");
      setUser(newUser);
    };

    // Listen for custom event
    window.addEventListener("user-updated", handleStorageChange);
    
    // Also listen for storage event (in case localStorage is modified directly)
    window.addEventListener("storage", handleStorageChange);

    return () => {
      window.removeEventListener("user-updated", handleStorageChange);
      window.removeEventListener("storage", handleStorageChange);
    };
  }, []);
  
  // Modal states
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [isBacking, setIsBacking] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  // Backup and Import states
  const [selectedBackupFile, setSelectedBackupFile] = useState<File | null>(
    null
  );
  const [backupType, setBackupType] = useState<string>("full");
  const [importProgress, setImportProgress] = useState(0);
  const [isDragOver, setIsDragOver] = useState(false);
  const [importTypeWarning, setImportTypeWarning] = useState<string | null>(
    null
  );
  
  // Reset states
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetConfirmationText, setResetConfirmationText] = useState("");
  const [isResetting, setIsResetting] = useState(false);

  // Helper function untuk format semester
  const formatSemester = (semester: string, periode: string) => {
    if (semester === "Antara") {
      return "Semester Antara";
    }
    return `Semester ${semester} (${periode})`;
  };

  // Helper function untuk format jenis mata kuliah
  const formatJenisMataKuliah = (
    jenis: string,
    tipeNonBlock: string | null
  ) => {
    if (jenis === "Blok") {
      return jenis;
    }
    if (jenis === "Non Blok" && tipeNonBlock) {
      return `${jenis} - ${tipeNonBlock}`;
    }
    return jenis;
  };
  
  // Super Admin Account Creation Modal States
  const [showCreateAdminModal, setShowCreateAdminModal] = useState(false);
  const [adminFormData, setAdminFormData] = useState({
    name: "",
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
    phone: "",
    position: "",
  });
  const [adminFormErrors, setAdminFormErrors] = useState<
    Record<string, string>
  >({});
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  
  // Attendance semester state
  // const [activeAttendanceSemester, setActiveAttendanceSemester] = useState<'regular' | 'antara'>('regular');
  
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    totalMahasiswa: 0,
    totalDosen: 0,
    totalTimAkademik: 0,
    totalSuperAdmin: 0,
    superAdmins: [],
    totalMataKuliah: 0,
    // totalKelas removed
    totalRuangan: 0,
    totalJadwalAktif: 0,
    recentActivities: [],
    systemHealth: {
      database: "healthy",
      storage: "healthy",
      server: "healthy",
      lastBackup: "",
    },
    attendanceStats: {
      regular: {
      overall_rate: 0,
      pbl_rate: 0,
      journal_rate: 0,
      csr_rate: 0,
      total_students: 0,
        low_attendance_students: 0,
      },
      antara: {
        overall_rate: 0,
        pbl_rate: 0,
        journal_rate: 0,
        csr_rate: 0,
        total_students: 0,
        low_attendance_students: 0,
      },
    },
    todaySchedule: [],
    assessmentStats: {
      total_pbl_assessments: 0,
      total_journal_assessments: 0,
      pending_pbl: 0,
      pending_journal: 0,
      completion_rate: 0,
      average_score: 0,
    },
    systemNotifications: [],
    academicOverview: {
      current_semester: "",
      current_tahun_ajaran: "",
      semester_progress: 0,
      active_blocks: [],
      upcoming_deadlines: [],
    },
    // Initialize growth percentages
    usersGrowth: 0,
    mahasiswaGrowth: 0,
    dosenGrowth: 0,
    mataKuliahGrowth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  
  // Monitoring metrics state
  const [monitoringMetrics, setMonitoringMetrics] = useState<MonitoringMetrics | null>(null);
  const [loadingMonitoring, setLoadingMonitoring] = useState(false);
  const [monitoringError, setMonitoringError] = useState<string | null>(null);

  // Helper function to format growth percentage
  const formatGrowthPercentage = (
    growth: number | undefined
  ): {
    value: string;
    isPositive: boolean;
    colorClass: string;
  } => {
    if (growth === undefined || growth === null || isNaN(growth)) {
      return {
        value: "0%",
        isPositive: true,
        colorClass:
          "bg-gray-50 text-gray-700 border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800",
      };
    }
    
    const isPositive = growth >= 0;
    const formattedValue = `${isPositive ? "+" : ""}${growth.toFixed(1)}%`;
    
    const colorClass = isPositive 
      ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/20 dark:text-green-400 dark:border-green-800"
      : "bg-red-50 text-red-700 border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
    
    return {
      value: formattedValue,
      isPositive,
      colorClass,
    };
  };

  // Fetch active semester
  useEffect(() => {
    const fetchActiveSemester = async () => {
      try {
        const res = await api.get("/tahun-ajaran/active");
        setTahunAjaran(res.data);
      } catch (error) {
        console.error("Error fetching active semester:", error);
      }
    };
    fetchActiveSemester();
  }, []);

  // Real-time clock update
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // Quick Action Handlers
  const handleImportMahasiswa = () => {
    navigate("/mahasiswa");
  };

  const handleGenerateKelompok = () => {
    navigate("/generate/kelompok");
  };

  const handleBackupSystem = () => {
    setShowBackupModal(true);
  };

  const handleResetSystem = () => {
    setShowResetModal(true);
  };

  const handleConfirmReset = async () => {
    if (resetConfirmationText.toLowerCase() !== "reset") {
      setError('Konfirmasi tidak valid. Ketik "reset" untuk melanjutkan.');
      return;
    }

    setIsResetting(true);
    try {
      const response = await fetch(`${BASE_URL}/api/system/reset`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });

      if (response.ok) {
        setShowResetModal(false);
        setResetConfirmationText("");
        setSuccess(
          "Sistem berhasil di-reset! Semua data telah dihapus kecuali akun Super Admin."
        );
        // Refresh dashboard data
        fetchDashboardData();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Reset failed");
      }
    } catch (error: any) {
      setError(`Reset failed: ${error.message}`);
    } finally {
      setIsResetting(false);
    }
  };

  // Helper functions for file type detection and warnings
  const detectFileBackupType = (filename: string): string | null => {
    const lowerName = filename.toLowerCase();
    if (lowerName.includes("data_only") || lowerName.includes("dataonly")) {
      return "data_only";
    } else if (lowerName.includes("full")) {
      return "full";
    }
    return null;
  };

  const checkImportTypeCompatibility = (file: File, selectedType: string) => {
    const detectedType = detectFileBackupType(file.name);
    
    if (detectedType && detectedType !== selectedType) {
      const warnings = [];
      
      if (detectedType === "data_only" && selectedType === "full") {
        warnings.push(
          `🔄 File appears to be "Data Only" backup but "Full Restore" is selected`
        );
        warnings.push(`✅ System will auto-correct to "Data Only" import`);
      } else if (detectedType === "full" && selectedType === "data_only") {
        warnings.push(
          `🔄 File appears to be "Full" backup but "Data Only" is selected`
        );
        warnings.push(`✅ System will import data portion only as requested`);
      }
      
      setImportTypeWarning(warnings.join("\n"));
    } else {
      setImportTypeWarning(null);
    }
  };

  const handleFileSelection = (file: File | null) => {
    setSelectedBackupFile(file);
    if (file) {
      checkImportTypeCompatibility(file, backupType || "full");
    } else {
      setImportTypeWarning(null);
    }
  };

  const handleConfirmBackup = async () => {
    if (!backupType) return;
    
    setIsBacking(true);
    try {
      const response = await fetch(`${BASE_URL}/api/system/backup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify({
          type: backupType,
          include_files: backupType === "full", // Only include files for full backup
        }),
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `backup_${backupType}_${
          new Date().toISOString().split("T")[0]
        }.sql`;
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        
        setShowBackupModal(false);
        // Show success message
        setSuccess(
          `Backup berhasil dibuat dan di-download! Backup ${backupType} telah dibuat.`
        );
        // Refresh dashboard to update last backup time
        fetchDashboardData();
        // Reset selection
        setBackupType("full");
      } else {
        throw new Error(`Backup ${backupType} failed`);
      }
    } catch {
      setError("Backup failed. Please try again.");
    } finally {
      setIsBacking(false);
    }
  };

  const handleImportBackup = async () => {
    if (!selectedBackupFile) return;
    
    setIsImporting(true);
    setImportProgress(0);
    
    const formData = new FormData();
    formData.append("backup_file", selectedBackupFile);
    formData.append("type", backupType || "full"); // Use selected type or default to full
    
    try {
      const response = await fetch(`${BASE_URL}/api/system/import`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: formData,
      });
      
      if (response.ok) {
        const result = await response.json();
        setShowImportModal(false);
        setSelectedBackupFile(null);
        setImportProgress(100);
        
        // Build comprehensive success message
        let successMessage = result.message || "Database restored successfully";
        
        // Add type correction info if applicable
        if (
          result.original_requested_type &&
          result.backup_type !== result.original_requested_type
        ) {
          successMessage += `\n\n🔄 Auto-Correction Applied:\n`;
          successMessage += `• You selected: "${result.original_requested_type}" restore\n`;
          successMessage += `• File detected as: "${result.detected_file_type}" backup\n`;
          successMessage += `• System auto-corrected to: "${result.backup_type}" import`;
        }
        
        // Add warnings if any
        if (result.warnings && result.warnings.length > 0) {
          successMessage += `\n\n⚠️ Important Notes:\n`;
          result.warnings.forEach((warning: string) => {
            successMessage += `• ${warning}\n`;
          });
        }
        
        // Add additional context info
        if (result.backup_type === "data_only") {
          successMessage += "\n✅ Data has been restored to your database.";
        } else if (result.backup_type === "full") {
          successMessage +=
            "\n✅ Complete database structure and data have been restored.";
        }
        
        if (result.pre_import_backup) {
          successMessage += `\n🛡️ Safety backup created: ${result.pre_import_backup}`;
        }
        
        setSuccess(successMessage);
        
        // Refresh dashboard data
        fetchDashboardData();
      } else {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || "Import failed");
      }
    } catch (error: any) {
      if (error.message && error.message !== "Import failed") {
        setError(`Import failed: ${error.message}`);
      } else {
        setError("Import failed. Please check the backup file and try again.");
      }
    } finally {
      setIsImporting(false);
      setImportProgress(0);
    }
  };

  // Helper function to get user initials from name
  const getUserInitials = (userName: string): string => {
    if (!userName) return "?";
    const names = userName.split(" ");
    if (names.length === 1) return names[0].charAt(0).toUpperCase();
    return (
      names[0].charAt(0) + names[names.length - 1].charAt(0)
    ).toUpperCase();
  };

  const formatActivityTime = (createdAt: string): string => {
    const now = new Date();
    const activityTime = new Date(createdAt);
    const diffInMinutes = Math.floor(
      (now.getTime() - activityTime.getTime()) / (1000 * 60)
    );
    
    if (diffInMinutes < 1) return "Baru saja";
    if (diffInMinutes < 60) return `${diffInMinutes} menit yang lalu`;
    
    const diffInHours = Math.floor(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} jam yang lalu`;
    
    const diffInDays = Math.floor(diffInHours / 24);
    if (diffInDays < 7) return `${diffInDays} hari yang lalu`;
    
    return activityTime.toLocaleDateString("id-ID");
  };

  // Super Admin Account Creation Functions
  const handleCreateAdmin = () => {
    setShowCreateAdminModal(true);
    setAdminFormData({
      name: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: "",
      position: "",
    });
    setAdminFormErrors({});
  };

  const handleAdminFormChange = (field: string, value: string) => {
    setAdminFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (adminFormErrors[field]) {
      setAdminFormErrors((prev) => ({ ...prev, [field]: "" }));
    }
  };

  const validateAdminForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!adminFormData.name.trim()) {
      errors.name = "Nama wajib diisi";
    }

    if (!adminFormData.username.trim()) {
      errors.username = "Username wajib diisi";
    }

    if (!adminFormData.email.trim()) {
      errors.email = "Email wajib diisi";
    } else if (!/\S+@\S+\.\S+/.test(adminFormData.email)) {
      errors.email = "Format email tidak valid";
    }

    if (!adminFormData.password) {
      errors.password = "Password wajib diisi";
    } else if (adminFormData.password.length < 8) {
      errors.password = "Password minimal 8 karakter";
    }

    if (!adminFormData.confirmPassword) {
      errors.confirmPassword = "Konfirmasi password wajib diisi";
    } else if (adminFormData.password !== adminFormData.confirmPassword) {
      errors.confirmPassword = "Password tidak sama";
    }

    if (!adminFormData.phone.trim()) {
      errors.phone = "Nomor telepon wajib diisi";
    }

    if (!adminFormData.position.trim()) {
      errors.position = "Posisi wajib diisi";
    }

    setAdminFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmitCreateAdmin = async () => {
    if (!validateAdminForm()) {
      return;
    }

    try {
      setIsCreatingAdmin(true);
      
      const response = await api.post("/admin/create-super-admin", {
        name: adminFormData.name.trim(),
        username: adminFormData.username.trim(),
        email: adminFormData.email.trim(),
        password: adminFormData.password,
        phone: adminFormData.phone.trim(),
        position: adminFormData.position.trim(),
        role: "super_admin",
      });

      if (response.data.success) {
        setSuccess("Akun Super Admin berhasil dibuat!");
        setShowCreateAdminModal(false);
        setAdminFormData({
          name: "",
          username: "",
          email: "",
          password: "",
          confirmPassword: "",
          phone: "",
          position: "",
        });
        setAdminFormErrors({});
        // Refresh dashboard data
        fetchDashboardData();
      } else {
        throw new Error(
          response.data.message || "Gagal membuat akun Super Admin"
        );
      }
    } catch (error: any) {
      console.error("Error creating Super Admin:", error);
      console.error(
        "Error details:",
        handleApiError(error, "Membuat akun Super Admin")
      );
      setError(
        `Gagal membuat akun Super Admin: ${handleApiError(
          error,
          "Membuat akun Super Admin"
        )}`
      );
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  const handleCloseCreateAdminModal = () => {
    setShowCreateAdminModal(false);
    setAdminFormData({
      name: "",
      username: "",
      email: "",
      password: "",
      confirmPassword: "",
      phone: "",
      position: "",
    });
    setAdminFormErrors({});
  };

  // Helper function to get role color for avatar
  const getRoleColor = (): string => {
    // Semua avatar menggunakan warna abu-abu netral yang cocok untuk tema gelap dan terang
    return "bg-gray-400 dark:bg-gray-500";
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Auto-clear success message after 5 seconds
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  // Fetch monitoring metrics
  const fetchMonitoringMetrics = async () => {
    try {
      setLoadingMonitoring(true);
      setMonitoringError(null);
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found");
      }

      const response = await api.get("/dashboard/super-admin/monitoring");
      setMonitoringMetrics(response.data);
    } catch (err: any) {
      setMonitoringError(err.response?.data?.message || "Failed to fetch monitoring metrics");
      console.error("Error fetching monitoring metrics:", err);
    } finally {
      setLoadingMonitoring(false);
    }
  };

  // Auto-refresh monitoring metrics every 30 seconds
  useEffect(() => {
    fetchMonitoringMetrics();
    const interval = setInterval(fetchMonitoringMetrics, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      
      // Check if we have a token
      const token = localStorage.getItem("token");
      if (!token) {
        throw new Error("Authentication token not found. Please login again.");
      }

      // Use centralized BASE_URL
      const baseURL = BASE_URL;
      
      // Try main endpoint first, fallback to test endpoint for debugging
      const endpoint = `${baseURL}/api/dashboard/super-admin`;
      
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          localStorage.removeItem("token");
          localStorage.removeItem("user");
          setError("Session expired. Please login again.");
          window.location.href = "/signin";
          return;
        }
        
        // For development, try test endpoint if main endpoint fails
        if (
          process.env.NODE_ENV === "development" &&
          endpoint.includes("/dashboard/super-admin")
        ) {
          const testResponse = await fetch(
            `${baseURL}/api/test/dashboard-data`,
            {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            }
          );
          
          if (testResponse.ok) {
            const testData = await testResponse.json();
            setStats(testData);
            setError(
              "Using test data - authentication may not be working properly"
            );
            return;
          }
        }
        
        // Try to get error message from response
        let errorMessage = "Failed to fetch dashboard data";
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch {
          // If response is not JSON, get text
          await response.text();
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        
        throw new Error(errorMessage);
      }

      // Check if response is JSON
      const contentType = response.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        await response.text();
        throw new Error(
          "Server returned non-JSON response. Check if Laravel server is running on port 8000."
        );
      }

      const data = await response.json();
      
      // Use recent activities from dashboard API (already includes role data)
      
            // Ensure data has the required structure with fallbacks
      const safeData: DashboardStats = {
        ...data,
        recentActivities: data.recentActivities || [], // Use data from dashboard API
        attendanceStats: {
          regular: {
            overall_rate: data.attendanceStats?.overall_rate || 0,
            pbl_rate: data.attendanceStats?.pbl_rate || 0,
            journal_rate: data.attendanceStats?.journal_rate || 0,
            csr_rate: data.attendanceStats?.csr_rate || 0,
            total_students: data.attendanceStats?.total_students || 0,
            low_attendance_students:
              data.attendanceStats?.low_attendance_students || 0,
          },
          antara: {
            overall_rate: data.attendanceStatsAntara?.overall_rate || 0,
            pbl_rate: data.attendanceStatsAntara?.pbl_rate || 0,
            journal_rate: data.attendanceStatsAntara?.journal_rate || 0,
            csr_rate: 0, // Semester antara tidak ada CSR
            total_students: data.attendanceStatsAntara?.total_students || 0,
            low_attendance_students:
              data.attendanceStatsAntara?.low_attendance_students || 0,
          },
        },
        assessmentStats: {
          ...data.assessmentStats,
          // Ensure completion rate doesn't exceed 100%
          completion_rate: Math.min(
            (data.assessmentStats && data.assessmentStats.completion_rate) || 0,
            100
          ),
        },
      };
      
      setStats(safeData);
      setError(null);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An error occurred";
      setError(errorMessage);
      
      // Keep this section commented out - no more demo data
      /*if (process.env.NODE_ENV === 'development') {
        // Setting demo data for development
        const demoData: DashboardStats = {
          totalUsers: 150,
          totalMahasiswa: 120,
          totalDosen: 25,
          totalTimAkademik: 5,
          totalSuperAdmin: 3,
          superAdmins: [
            { id: 1, name: 'Atmin', email: 'atmin444@gmail.com', username: 'atmin444', created_at: '2025-09-09T08:39:29.000000Z', is_logged_in: 1 },
            { id: 2, name: 'Admin 2', email: 'admin2@example.com', username: 'admin2', created_at: '2025-09-08T10:30:00.000000Z', is_logged_in: 0 },
            { id: 3, name: 'Admin 3', email: 'admin3@example.com', username: 'admin3', created_at: '2025-09-07T14:15:00.000000Z', is_logged_in: 0 }
          ],
          totalMataKuliah: 45,
          // totalKelas removed
          totalRuangan: 15,
          totalJadwalAktif: 85,
          recentActivities: [
            {
              id: '1',
              user: 'Dr. Ahmad Fauzi',
              action: 'membuat',
              target: 'Mata Kuliah Baru',
              timestamp: '2 menit yang lalu',
              type: 'create' as const
            },
            {
              id: '2',
              user: 'Tim Akademik',
              action: 'mengupdate',
              target: 'Jadwal PBL',
              timestamp: '15 menit yang lalu',
              type: 'update' as const
            },
            {
              id: '3',
              user: 'Prof. Siti Aisyah',
              action: 'mengekspor',
              target: 'Data Penilaian',
              timestamp: '1 jam yang lalu',
              type: 'export' as const
            }
          ],
          systemHealth: {
            database: 'healthy' as const,
            storage: 'healthy' as const,
            server: 'healthy' as const,
            lastBackup: '2 jam yang lalu'
          },
          attendanceStats: {
              regular: {
            overall_rate: 85.5,
            pbl_rate: 87.2,
            journal_rate: 83.1,
            csr_rate: 86.3,
            total_students: 120,
            low_attendance_students: 8
              },
              antara: {
                overall_rate: 77.5,
                pbl_rate: 80.0,
                journal_rate: 75.0,
                csr_rate: 0, // Semester antara tidak ada CSR
                total_students: 45,
                low_attendance_students: 12
              }
          },
          todaySchedule: [
            {
              type: 'Kuliah Besar',
              mata_kuliah: 'Anatomi Dasar',
              dosen: 'Dr. Ahmad Fauzi',
              ruangan: 'Aula Utama',
              waktu: '08:00 - 10:00',
              topik: 'Sistem Muskuloskeletal'
            },
            {
              type: 'PBL',
              mata_kuliah: 'Blok Kardiovaskular',
              dosen: 'Prof. Siti Aisyah',
              ruangan: 'Ruang PBL 1',
              waktu: '10:30 - 12:30',
              topik: 'Kasus Hipertensi'
            },
            {
              type: 'Journal Reading',
              mata_kuliah: 'Blok Respirasi',
              dosen: 'Dr. Budi Santoso',
              ruangan: 'Ruang Seminar',
              waktu: '13:30 - 15:00',
              topik: 'COVID-19 Research Update'
            }
          ],
          assessmentStats: {
            total_pbl_assessments: 245,
            total_journal_assessments: 189,
            pending_pbl: 23,
            pending_journal: 17,
              completion_rate: 87.5, // (434-40)/434 * 100 = 90.8%
            average_score: 78.3
          },
          systemNotifications: [
            {
              type: 'info' as const,
              title: 'System Update Available',
              message: 'Version 2.4.1 is available with bug fixes',
              action: 'Update Now'
            },
            {
              type: 'warning' as const,
              title: 'Backup Reminder',
              message: 'Last backup was 3 days ago',
              action: 'Backup Now'
            }
          ],
          academicOverview: {
            current_semester: 'Ganjil 2024/2025',
            current_tahun_ajaran: '2024/2025',
            semester_progress: 67,
            active_blocks: ['Blok 1', 'Blok 2'],
            upcoming_deadlines: [
              { title: 'PBL Assessment Deadline', date: '2024-12-15' },
              { title: 'Semester Exam Period', date: '2024-12-20' }
            ]
          }
        };
        
        setStats(demoData);
        setError(`Demo Mode: ${errorMessage}`);
      }*/
    } finally {
      setLoading(false);
    }
  };

  // Skeleton Loading Components
  const SkeletonCard = ({
    className = "",
    children,
  }: {
    className?: string;
    children?: React.ReactNode;
  }) => (
    <div
      className={`rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 ${className}`}
    >
      {children}
    </div>
  );

  const SkeletonLine = ({
    width = "w-full",
    height = "h-4",
  }: {
    width?: string;
    height?: string;
  }) => (
    <div
      className={`${width} ${height} bg-gray-200 dark:bg-gray-700 rounded animate-pulse`}
    ></div>
  );

  const SkeletonCircle = ({ size = "w-12 h-12" }: { size?: string }) => (
    <div
      className={`${size} bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse`}
    ></div>
  );

  if (loading) {
    return (
      <>
        <style>{`
          @keyframes progressFill {
            from { width: 0%; }
            to { width: 100%; }
          }
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
          .notification-enter {
            animation: slideInRight 0.5s ease-out forwards;
          }
        `}</style>
        <div className="grid grid-cols-12 gap-4 md:gap-6">
        {/* Header Skeleton */}
        <div className="col-span-12 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <SkeletonLine width="w-64" height="h-8" />
              <div className="mt-2">
                <SkeletonLine width="w-96" height="h-4" />
              </div>
            </div>
            <div className="flex gap-3 mt-4 sm:mt-0">
              <SkeletonLine width="w-24" height="h-6" />
              <SkeletonLine width="w-16" height="h-6" />
            </div>
          </div>
        </div>

        {/* Main Statistics Cards Skeleton - 3x3 Grid */}
        <div className="col-span-12">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 mb-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800">
                <div className="absolute top-0 right-0 w-20 h-20 bg-gray-100 dark:bg-gray-700/50 rounded-full -mr-10 -mt-10 animate-pulse"></div>
                <div className="relative">
                  <div className="flex items-center justify-between mb-4">
                    <SkeletonCircle size="w-12 h-12" />
                    <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse"></div>
                  </div>
                  <div className="space-y-2">
                    <SkeletonLine width="w-20" height="h-4" />
                    <SkeletonLine width="w-16" height="h-8" />
                    <SkeletonLine width="w-32" height="h-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Analytics Cards Skeleton */}
        <div className="col-span-12">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {[1, 2, 3].map((i) => (
              <SkeletonCard key={i}>
                <div className="flex items-center justify-between mb-6">
                  <SkeletonLine width="w-32" height="h-6" />
                  <SkeletonLine width="w-16" height="h-6" />
                </div>
                <div className="space-y-4">
                  {[1, 2, 3].map((j) => (
                    <div key={j}>
                      <div className="flex justify-between mb-2">
                        <SkeletonLine width="w-20" height="h-4" />
                        <SkeletonLine width="w-12" height="h-4" />
                      </div>
                      <SkeletonLine width="w-full" height="h-2" />
              </div>
            ))}
          </div>
              </SkeletonCard>
            ))}
        </div>
      </div>

        {/* Bottom Cards Skeleton */}
        <div className="col-span-12">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
            {[1, 2].map((i) => (
              <SkeletonCard key={i}>
                <SkeletonLine width="w-40" height="h-6" />
                <div className="mt-4 space-y-3">
                  {[1, 2, 3].map((j) => (
                      <div
                        key={j}
                        className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                      >
                      <SkeletonLine width="w-full" height="h-4" />
                      <div className="mt-2">
                        <SkeletonLine width="w-3/4" height="h-3" />
                      </div>
                    </div>
                  ))}
                </div>
              </SkeletonCard>
            ))}
          </div>
        </div>

        {/* Recent Activities Table Skeleton */}
        <div className="col-span-12">
          <SkeletonCard>
            <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
              <SkeletonLine width="w-40" height="h-6" />
              <div className="flex items-center gap-3">
                <SkeletonLine width="w-24" height="h-10" />
              </div>
            </div>
            <div className="max-w-full overflow-x-auto hide-scroll">
              <table className="min-w-full">
                <thead className="border-gray-100 dark:border-gray-800 border-y">
                  <tr>
                      {[
                        "User",
                        "Role",
                        "Action",
                        "Target",
                        "Time",
                        "Status",
                      ].map((_, idx) => (
                        <th
                          key={idx}
                          className="py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400"
                        >
                        <SkeletonLine width="w-16" height="h-4" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                  {[1, 2, 3, 4, 5].map((row) => (
                    <tr key={row}>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                          <SkeletonCircle size="w-8 h-8" />
                          <SkeletonLine width="w-24" height="h-4" />
                        </div>
                      </td>
                      <td className="py-3">
                        <SkeletonLine width="w-16" height="h-4" />
                      </td>
                      <td className="py-3">
                        <SkeletonLine width="w-20" height="h-4" />
                      </td>
                      <td className="py-3">
                        <SkeletonLine width="w-16" height="h-4" />
                      </td>
                      <td className="py-3">
                        <SkeletonLine width="w-20" height="h-4" />
                      </td>
                      <td className="py-3">
                        <SkeletonLine width="w-16" height="h-6" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SkeletonCard>
        </div>
        </div>
      </>
    );
  }

  if (error) {
  return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
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
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Error Loading Dashboard
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={fetchDashboardData}
            className="px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
          >
            Coba Lagi
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes progressFill {
          from { width: 0%; }
          to { width: 100%; }
        }
        @keyframes slideInRight {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .notification-enter {
          animation: slideInRight 0.5s ease-out forwards;
        }
      `}</style>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
       <div className="grid grid-cols-12 gap-4 md:gap-6 p-4 md:p-6">
         {/* Page Header */}
         <div className="col-span-12 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-700">
             <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
               <div className="flex items-center space-x-4">
                 <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                      />
                   </svg>
                 </div>
                 <div>
                   <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Dashboard Super Admin
        </h1>
                   <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      ISME - Integrated System Medical Education
        </p>
                   {user && user.name && (
                     <p className="mt-1 text-sm text-blue-600 dark:text-blue-400 font-medium">
                       Logged in as: {user.name} ({user.username})
        </p>
                   )}
      </div>
               </div>
               <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
                 {/* Right side - Time */}
                 <div className="flex items-center gap-3 flex-wrap">
                   {/* Semester Info */}
                   {tahunAjaran && tahunAjaran.semesters?.find((s) => s.aktif) && (
                     <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 dark:bg-indigo-900/20 dark:text-indigo-400 dark:border-indigo-800">
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
                           d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                         />
                       </svg>
                       <span className="text-sm font-medium">
                         Semester Aktif: {tahunAjaran.semesters.find((s) => s.aktif)?.jenis} ({tahunAjaran.tahun})
                       </span>
                     </span>
                   )}
                   {/* Real-time Clock with Date */}
                   <span className="inline-flex items-center px-3 py-1.5 rounded-xl text-xs font-medium bg-gray-50 text-gray-700 border border-gray-200 dark:bg-gray-900/20 dark:text-gray-400 dark:border-gray-800">
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
           </div>
         </div>

         {/* Success Messages */}
         <AnimatePresence>
           {success && (
             <motion.div
               initial={{ opacity: 0, y: -10 }}
               animate={{ opacity: 1, y: 0 }}
               exit={{ opacity: 0, y: -10 }}
               transition={{ duration: 0.2 }}
               className="col-span-12"
             >
               <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                 <div className="flex items-start space-x-3">
                   <div className="flex-shrink-0">
                      <svg
                        className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5"
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
                   <div className="flex-1">
                     <h3 className="text-sm font-medium text-green-800 dark:text-green-200">
                       Berhasil
                     </h3>
                     <p className="text-sm text-green-600 dark:text-green-400 mt-1 whitespace-pre-line">
                       {success}
                     </p>
                   </div>
                 </div>
               </div>
             </motion.div>
           )}
         </AnimatePresence>

         {error && (
           <div className="col-span-12">
             <div className="relative overflow-hidden bg-gradient-to-r from-red-500 to-red-600 rounded-2xl shadow-lg border border-red-200 dark:border-red-700 notification-enter">
               {/* Background Pattern */}
               <div className="absolute inset-0 bg-red-600 opacity-10">
                  <div
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.1'%3E%3Cpath d='M30 0l4 8h8l-6 6 2 8-8-4-8 4 2-8-6-6h8z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
                    }}
                  ></div>
               </div>
               
               {/* Content */}
               <div className="relative p-6">
                 <div className="flex items-start space-x-4">
                   {/* Error Icon with Animation */}
                   <div className="flex-shrink-0">
                     <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center shadow-lg">
                        <svg
                          className="w-7 h-7 text-white animate-pulse"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                          />
                       </svg>
                     </div>
                   </div>
                   
                   {/* Content */}
                   <div className="flex-1 min-w-0">
                     <div className="flex items-center space-x-2 mb-2">
                        <h3 className="text-lg font-bold text-white">
                          ⚠️ Operation Failed
                        </h3>
                       <div className="flex space-x-1">
                         <div className="w-2 h-2 bg-white/60 rounded-full animate-ping"></div>
                       </div>
                     </div>
                      <p className="text-red-50 text-sm leading-relaxed">
                        {error}
                      </p>
                     
                     {/* Additional Info Tags */}
                     <div className="flex flex-wrap gap-2 mt-3">
                       <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm">
                          <svg
                            className="w-3 h-3 mr-1"
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
                         Safe to Retry
                       </span>
                       <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-white/20 text-white backdrop-blur-sm">
                          <svg
                            className="w-3 h-3 mr-1"
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
                         Check Logs
                       </span>
                     </div>
                   </div>
                   
                   {/* Close Button */}
                   <button
                     onClick={() => setError(null)}
                     className="flex-shrink-0 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center text-white hover:bg-white/30 transition-all duration-200 hover:scale-105"
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
               </div>
             </div>
           </div>
         )}

        {/* Main Statistics Cards - 3x3 Grid */}
         <div className="col-span-12">
           <div className="grid grid-cols-1 gap-4 md:grid-cols-3 md:gap-6 mb-6">
             {/* Total Users Card */}
              <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
               <div className="absolute top-0 right-0 w-20 h-20 bg-blue-50 dark:bg-blue-900/20 rounded-full -mr-10 -mt-10"></div>
               <div className="relative">
                 <div className="flex items-center justify-between mb-4">
                   <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                        />
                     </svg>
                  </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        formatGrowthPercentage(stats.usersGrowth).colorClass
                      }`}
                    >
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={
                            formatGrowthPercentage(stats.usersGrowth).isPositive
                              ? "M5 10l7-7m0 0l7 7m-7-7v18"
                              : "M19 14l-7 7m0 0l-7-7m7 7V3"
                          }
                        />
                     </svg>
                     {formatGrowthPercentage(stats.usersGrowth).value}
                   </span>
                 </div>
                  <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Total Users
                    </p>
                    <h4 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stats.totalUsers.toLocaleString()}
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Active system users
                    </p>
                  </div>
          </div>
        </div>

             {/* Mahasiswa Card */}
        <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
               <div className="absolute top-0 right-0 w-20 h-20 bg-green-50 dark:bg-green-900/20 rounded-full -mr-10 -mt-10"></div>
               <div className="relative">
                 <div className="flex items-center justify-between mb-4">
                   <div className="w-12 h-12 bg-green-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                        />
                     </svg>
                   </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        formatGrowthPercentage(stats.mahasiswaGrowth).colorClass
                      }`}
                    >
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={
                            formatGrowthPercentage(stats.mahasiswaGrowth)
                              .isPositive
                              ? "M5 10l7-7m0 0l7 7m-7-7v18"
                              : "M19 14l-7 7m0 0l-7-7m7 7V3"
                          }
                        />
                     </svg>
                     {formatGrowthPercentage(stats.mahasiswaGrowth).value}
                   </span>
                 </div>
            <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Mahasiswa
                    </p>
                    <h4 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stats.totalMahasiswa.toLocaleString()}
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Registered students
                    </p>
            </div>
               </div>
             </div>

             {/* Dosen Card */}
        <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
               <div className="absolute top-0 right-0 w-20 h-20 bg-purple-50 dark:bg-purple-900/20 rounded-full -mr-10 -mt-10"></div>
               <div className="relative">
                 <div className="flex items-center justify-between mb-4">
                   <div className="w-12 h-12 bg-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                      <svg
                        className="w-6 h-6 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                        />
                     </svg>
                   </div>
                    <span
                      className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${
                        formatGrowthPercentage(stats.dosenGrowth).colorClass
                      }`}
                    >
                      <svg
                        className="w-3 h-3 mr-1"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d={
                            formatGrowthPercentage(stats.dosenGrowth).isPositive
                              ? "M5 10l7-7m0 0l7 7m-7-7v18"
                              : "M19 14l-7 7m0 0l-7-7m7 7V3"
                          }
                        />
                     </svg>
                     {formatGrowthPercentage(stats.dosenGrowth).value}
                   </span>
                 </div>
                 <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Dosen
                    </p>
                    <h4 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stats.totalDosen.toLocaleString()}
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Faculty members
                    </p>
            </div>
          </div>
        </div>

             {/* Mata Kuliah Card */}
        <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
               <div className="absolute top-0 right-0 w-16 h-16 bg-indigo-50 dark:bg-indigo-900/20 rounded-full -mr-8 -mt-8"></div>
               <div className="relative">
                 <div className="w-12 h-12 bg-indigo-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                      />
                   </svg>
                 </div>
            <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Mata Kuliah
                    </p>
                    <h4 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stats.totalMataKuliah.toLocaleString()}
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Total courses
                    </p>
            </div>
               </div>
             </div>

             {/* Ruangan Card */}
        <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
               <div className="absolute top-0 right-0 w-16 h-16 bg-pink-50 dark:bg-pink-900/20 rounded-full -mr-8 -mt-8"></div>
               <div className="relative">
                 <div className="w-12 h-12 bg-pink-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
                    <svg
                      className="w-6 h-6 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2V5zM9 7h6M9 11h6"
                      />
                   </svg>
                 </div>
            <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Ruangan
                    </p>
                    <h4 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stats.totalRuangan.toLocaleString()}
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Available rooms
                    </p>
            </div>
               </div>
             </div>

             {/* Jadwal Aktif Card */}
        <div className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-200 dark:border-gray-700 dark:bg-gray-800 hover:shadow-md transition-all duration-300 hover:-translate-y-1">
               <div className="absolute top-0 right-0 w-16 h-16 bg-cyan-50 dark:bg-cyan-900/20 rounded-full -mr-8 -mt-8"></div>
               <div className="relative">
                 <div className="w-12 h-12 bg-cyan-500 rounded-2xl flex items-center justify-center shadow-lg mb-4">
                    <svg
                      className="w-6 h-6 text-white"
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
                 <div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">
                      Jadwal Aktif
                    </p>
                    <h4 className="text-3xl font-bold text-gray-900 dark:text-white">
                      {stats.totalJadwalAktif.toLocaleString()}
                    </h4>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                      Active schedules
                    </p>
            </div>
          </div>
        </div>
           </div>
         </div>

      {/* Second Row - Super Admin Management & Quick Actions */}
      <div className="col-span-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {/* Super Admin Management - Takes 2 columns */}
        <div className="md:col-span-2 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Super Admin Management
                  </h3>
              <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800">
                <div className="w-2 h-2 bg-blue-500 rounded-full mr-1.5"></div>
                {stats.totalSuperAdmin || 0} Super Admin
            </span>
                <button
                  onClick={handleCreateAdmin}
                  className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors"
                >
                  + Add Super Admin
                </button>
              </div>
          </div>
          
            {/* Super Admin List */}
            <div className="flex-1 overflow-hidden">
              <div className="h-full overflow-y-auto hide-scroll">
                <div className="space-y-3">
                  {/* Current Super Admin */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                    <div className="flex items-center space-x-3">
                      <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                        <span className="text-sm font-semibold text-white">
                              {user?.name?.charAt(0) || "A"}
                        </span>
              </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                                {user?.name || "Current User"}
                          </div>
                          {user?.username && (
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                  @{user.username}
                                </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">
                              {user?.email || "current@example.com"}
                        </div>
                      </div>
                </div>
                    <div className="flex items-center space-x-2">
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                        Active
                      </span>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        You
                      </span>
                  </div>
                      </div>

                  {/* Other Super Admins */}
                  <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                        Other Super Admins (
                        {stats.superAdmins ? stats.superAdmins.length - 1 : 0})
                </div>
                  
                  {/* List of other Super Admins */}
                  {stats.superAdmins && stats.superAdmins.length > 1 ? (
                    <div className="space-y-2">
                      {stats.superAdmins
                            .filter((admin) => admin.email !== user?.email) // Exclude current user
                        .map((admin) => (
                              <div
                                key={admin.id}
                                className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-800/30 rounded-lg"
                              >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gray-400 rounded-lg flex items-center justify-center">
                                <span className="text-xs font-semibold text-white">
                                  {admin.name.charAt(0).toUpperCase()}
                                </span>
                    </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <div className="text-sm font-medium text-gray-900 dark:text-white">
                                    {admin.name}
                                  </div>
                                  {admin.username && (
                                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                                          @{admin.username}
                                        </span>
                                  )}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">
                                  {admin.email}
                                </div>
                              </div>
                </div>
                            <div className="flex items-center space-x-2">
                                  <span
                                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                                admin.is_logged_in 
                                        ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                                        : "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400"
                                    }`}
                                  >
                                    {admin.is_logged_in ? "Online" : "Offline"}
                              </span>
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                    {new Date(
                                      admin.created_at
                                    ).toLocaleDateString()}
                              </span>
                    </div>
                      </div>
                        ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                      <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-lg flex items-center justify-center mx-auto mb-3">
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
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                              />
                        </svg>
                    </div>
                      <p className="text-sm">No other Super Admins</p>
                          <p className="text-xs">
                            Create new Super Admin accounts to manage them here
                          </p>
                    </div>
                  )}
                    </div>
                    </div>
                  </div>
        </div>
          
          {/* Quick Actions - Takes 1 column */}
          <div className="rounded-2xl border border-gray-200 bg-white p-4 dark:border-gray-800 dark:bg-white/[0.03] md:p-5 flex flex-col">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-3">
                  Quick Actions
                </h3>
            <div className="space-y-3 flex-1">
              <button 
                onClick={handleImportMahasiswa}
                className="w-full flex items-center space-x-3 p-3 rounded-lg bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30 transition text-left"
              >
                <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 6v6m0 0v6m0-6h6m-6 0H6"
                        />
                  </svg>
                </div>
            <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Import Mahasiswa
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Upload data mahasiswa baru
                      </p>
            </div>
              </button>
              
              <button 
                onClick={handleGenerateKelompok}
                className="w-full flex items-center space-x-3 p-3 rounded-lg bg-green-50 dark:bg-green-900/20 hover:bg-green-100 dark:hover:bg-green-900/30 transition text-left"
              >
                <div className="w-8 h-8 bg-green-500 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
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
                <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Generate Kelompok
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Buat kelompok mahasiswa baru
                      </p>
          </div>
              </button>
              
              <button 
                onClick={handleBackupSystem}
                className="w-full flex items-center space-x-3 p-3 rounded-lg bg-gray-50 dark:bg-gray-900/20 hover:bg-gray-100 dark:hover:bg-gray-900/30 transition text-left"
              >
                <div className="w-8 h-8 bg-gray-500 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
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
            </div>
                <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Backup System
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Download backup ke komputer Anda
                      </p>
          </div>
              </button>
              
              <button 
                onClick={() => setShowImportModal(true)}
                className="w-full flex items-center space-x-3 p-3 rounded-lg bg-teal-50 dark:bg-teal-900/20 hover:bg-teal-100 dark:hover:bg-teal-900/30 transition text-left"
              >
                <div className="w-8 h-8 bg-teal-500 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10"
                        />
                  </svg>
            </div>
            <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Import System
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Restore dari backup file
                      </p>
            </div>
              </button>
              
              <button 
                onClick={handleResetSystem}
                className="w-full flex items-center space-x-3 p-3 rounded-lg bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 transition text-left"
              >
                <div className="w-8 h-8 bg-red-500 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-white"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                  </svg>
            </div>
                <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        Reset System
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        Hapus semua data kecuali Super Admin
                      </p>
          </div>
              </button>
            </div>
          </div>
        </div>
      </div>

        {/* Today's Schedule */}
      {stats.todaySchedule.length > 0 && (
        <div className="col-span-12">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
          <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                    Today's Schedule
                  </h3>
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date().toLocaleDateString("id-ID")}
                  </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {stats.todaySchedule.map((schedule, index) => (
                    <div
                      key={index}
                      className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
                    >
                  <div className="flex items-center justify-between mb-2">
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            schedule.type === "PBL"
                              ? "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400"
                              : schedule.type === "Journal Reading"
                              ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                              : "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400"
                          }`}
                        >
                      {schedule.type}
            </span>
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {schedule.waktu}
                        </span>
          </div>
                      <h4 className="font-medium text-gray-900 dark:text-white text-sm mb-1">
                        {schedule.mata_kuliah}
                      </h4>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Dosen: {schedule.dosen}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400 mb-1">
                        Ruangan: {schedule.ruangan}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {schedule.topik}
                      </p>
              </div>
              ))}
                    </div>
          </div>
        </div>
      )}

      {/* System Notifications */}
      {stats.systemNotifications.length > 0 && (
        <div className="col-span-12 rounded-2xl border border-gray-200 bg-white p-5 dark:border-gray-800 dark:bg-white/[0.03] md:p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                System Notifications
              </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {stats.systemNotifications.map((notification, index) => (
                  <div
                    key={index}
                    className={`p-4 rounded-lg border-l-4 ${
                      notification.type === "warning"
                        ? "bg-yellow-50 border-yellow-400 dark:bg-yellow-900/20 dark:border-yellow-600"
                        : notification.type === "error"
                        ? "bg-red-50 border-red-400 dark:bg-red-900/20 dark:border-red-600"
                        : notification.type === "success"
                        ? "bg-green-50 border-green-400 dark:bg-green-900/20 dark:border-green-600"
                        : "bg-blue-50 border-blue-400 dark:bg-blue-900/20 dark:border-blue-600"
                    }`}
                  >
                <div className="flex items-start justify-between">
                    <div className="flex-1">
                        <p
                          className={`text-sm font-medium ${
                            notification.type === "warning"
                              ? "text-yellow-800 dark:text-yellow-200"
                              : notification.type === "error"
                              ? "text-red-800 dark:text-red-200"
                              : notification.type === "success"
                              ? "text-green-800 dark:text-green-200"
                              : "text-blue-800 dark:text-blue-200"
                          }`}
                        >
                      {notification.title}
                    </p>
                        <p
                          className={`text-xs mt-1 ${
                            notification.type === "warning"
                              ? "text-yellow-700 dark:text-yellow-300"
                              : notification.type === "error"
                              ? "text-red-700 dark:text-red-300"
                              : notification.type === "success"
                              ? "text-green-700 dark:text-green-300"
                              : "text-blue-700 dark:text-blue-300"
                          }`}
                        >
                      {notification.message}
                      </p>
              </div>
                      <button
                        className={`text-xs font-medium ml-3 ${
                          notification.type === "warning"
                            ? "text-yellow-800 hover:text-yellow-900 dark:text-yellow-200"
                            : notification.type === "error"
                            ? "text-red-800 hover:text-red-900 dark:text-red-200"
                            : notification.type === "success"
                            ? "text-green-800 hover:text-green-900 dark:text-green-200"
                            : "text-blue-800 hover:text-blue-900 dark:text-blue-200"
                        }`}
                      >
                    {notification.action}
                  </button>
                    </div>
                </div>
            ))}
          </div>
        </div>
      )}

      {/* System Monitoring Metrics */}
      <div className="col-span-12">
        <div className="rounded-xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] shadow-sm">
          {/* Header */}
          <div className="border-b border-gray-200 dark:border-gray-800 px-6 py-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                  System Monitoring
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Real-time system performance metrics
                </p>
              </div>
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                  <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
                  <span>{currentTime.toLocaleTimeString()}</span>
                </div>
                <button
                  onClick={fetchMonitoringMetrics}
                  disabled={loadingMonitoring}
                  className="inline-flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <svg
                    className={`w-3.5 h-3.5 ${loadingMonitoring ? 'animate-spin' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                    />
                  </svg>
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">

          {loadingMonitoring && !monitoringMetrics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm p-6 overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300 dark:bg-gray-600"></div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse"></div>
                      <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                    </div>
                    <div className="w-16 h-6 bg-gray-200 dark:bg-gray-700 rounded-md animate-pulse"></div>
                  </div>
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <div className="w-24 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        <div className="w-16 h-3 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 animate-pulse"></div>
                      <div className="w-20 h-3 bg-gray-200 dark:bg-gray-700 rounded mt-1.5 animate-pulse"></div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div>
                        <div className="w-20 h-3 bg-gray-200 dark:bg-gray-700 rounded mb-1 animate-pulse"></div>
                        <div className="w-8 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </div>
                      <div>
                        <div className="w-20 h-3 bg-gray-200 dark:bg-gray-700 rounded mb-1 animate-pulse"></div>
                        <div className="w-8 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : monitoringError ? (
            <div className="text-center py-12">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-red-50 dark:bg-red-900/20 mb-3">
                <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm font-medium text-red-600 dark:text-red-400">{monitoringError}</p>
            </div>
          ) : monitoringMetrics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {/* Database Metrics */}
              <div className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 p-6 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300 dark:bg-gray-600"></div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                      <svg className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Database
                    </h4>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                    monitoringMetrics.database.status === 'healthy' 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : monitoringMetrics.database.status === 'warning'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      monitoringMetrics.database.status === 'healthy' ? 'bg-emerald-500' :
                      monitoringMetrics.database.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                    }`}></span>
                    {monitoringMetrics.database.status}
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Connections</span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">
                        {monitoringMetrics.database.current_connections} / {monitoringMetrics.database.max_connections}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700/50 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          monitoringMetrics.database.connection_usage_percent > 90
                            ? 'bg-red-500'
                            : monitoringMetrics.database.connection_usage_percent > 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(monitoringMetrics.database.connection_usage_percent, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                      {monitoringMetrics.database.connection_usage_percent.toFixed(1)}% used
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Running Threads</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{monitoringMetrics.database.running_threads}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Slow Queries</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{monitoringMetrics.database.slow_queries}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Queue Metrics */}
              <div className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 p-6 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300 dark:bg-gray-600"></div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                      <svg className="w-4.5 h-4.5 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Queue
                    </h4>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                    monitoringMetrics.queue.status === 'healthy' 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : monitoringMetrics.queue.status === 'warning'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      monitoringMetrics.queue.status === 'healthy' ? 'bg-emerald-500' :
                      monitoringMetrics.queue.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                    }`}></span>
                    {monitoringMetrics.queue.status}
                  </span>
                </div>
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Pending</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{monitoringMetrics.queue.queue_length}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Processing</p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">{monitoringMetrics.queue.processing_jobs}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Failed</p>
                      <p className="text-lg font-semibold text-red-600 dark:text-red-400">{monitoringMetrics.queue.failed_jobs}</p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700">
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Driver: <span className="font-semibold text-gray-900 dark:text-white">{monitoringMetrics.queue.queue_connection}</span>
                    </p>
                  </div>
                </div>
              </div>

              {/* Performance Metrics */}
              <div className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 p-6 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300 dark:bg-gray-600"></div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 flex items-center justify-center">
                      <svg className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Performance
                    </h4>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                    monitoringMetrics.performance.status === 'healthy' 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : monitoringMetrics.performance.status === 'warning'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      monitoringMetrics.performance.status === 'healthy' ? 'bg-emerald-500' :
                      monitoringMetrics.performance.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                    }`}></span>
                    {monitoringMetrics.performance.status}
                  </span>
                </div>
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Memory Usage</span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">
                        {monitoringMetrics.performance.memory_usage_mb} MB / {monitoringMetrics.performance.memory_limit}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 dark:bg-gray-700/50 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-2 rounded-full transition-all duration-300 ${
                          monitoringMetrics.performance.memory_usage_percent > 90
                            ? 'bg-red-500'
                            : monitoringMetrics.performance.memory_usage_percent > 80
                            ? 'bg-amber-500'
                            : 'bg-emerald-500'
                        }`}
                        style={{ width: `${Math.min(monitoringMetrics.performance.memory_usage_percent, 100)}%` }}
                      ></div>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1.5">
                      {monitoringMetrics.performance.memory_usage_percent.toFixed(1)}% used
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Response Time</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{monitoringMetrics.performance.execution_time_ms}ms</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Queries</p>
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{monitoringMetrics.performance.query_count}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* System Metrics */}
              <div className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 p-6 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300 dark:bg-gray-600"></div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-slate-50 dark:bg-slate-900/20 flex items-center justify-center">
                      <svg className="w-4.5 h-4.5 text-slate-600 dark:text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      System
                    </h4>
                  </div>
                  <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium ${
                    monitoringMetrics.system.status === 'healthy' 
                      ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : monitoringMetrics.system.status === 'warning'
                      ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                  }`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${
                      monitoringMetrics.system.status === 'healthy' ? 'bg-emerald-500' :
                      monitoringMetrics.system.status === 'warning' ? 'bg-amber-500' : 'bg-red-500'
                    }`}></span>
                    {monitoringMetrics.system.status}
                  </span>
                </div>
                <div className="space-y-4 text-xs">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Uptime</p>
                    <p className="text-sm font-semibold text-gray-900 dark:text-white">{monitoringMetrics.system.uptime}</p>
                  </div>
                  {monitoringMetrics.system.cpu_usage_percent !== null && (
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">CPU Usage</span>
                        <span className="text-xs font-semibold text-gray-900 dark:text-white">{monitoringMetrics.system.cpu_usage_percent}%</span>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-700/50 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${
                            monitoringMetrics.system.cpu_usage_percent > 90
                              ? 'bg-red-500'
                              : monitoringMetrics.system.cpu_usage_percent > 80
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                          }`}
                          style={{ width: `${Math.min(monitoringMetrics.system.cpu_usage_percent, 100)}%` }}
                        ></div>
                      </div>
                    </div>
                  )}
                  {monitoringMetrics.system.cpu_load && (
                    <div className="grid grid-cols-3 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Load 1m</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{monitoringMetrics.system.cpu_load["1min"]}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Load 5m</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{monitoringMetrics.system.cpu_load["5min"]}</p>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Load 15m</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{monitoringMetrics.system.cpu_load["15min"]}</p>
                      </div>
                    </div>
                  )}
                  <div className="pt-3 border-t border-gray-100 dark:border-gray-700 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">PHP</span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{monitoringMetrics.system.php_version}</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-gray-500 dark:text-gray-400">Laravel</span>
                      <span className="text-xs font-semibold text-gray-900 dark:text-white">{monitoringMetrics.system.laravel_version}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Cache Metrics */}
              <div className="group relative bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 transition-all duration-200 p-6 overflow-hidden">
                <div className="absolute left-0 top-0 bottom-0 w-1 bg-gray-300 dark:bg-gray-600"></div>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 flex items-center justify-center">
                      <svg className="w-4.5 h-4.5 text-indigo-600 dark:text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 12h14M5 12a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v4a2 2 0 01-2 2M5 12a2 2 0 00-2 2v4a2 2 0 002 2h14a2 2 0 002-2v-4a2 2 0 00-2-2m-2-4h.01M17 16h.01" />
                      </svg>
                    </div>
                    <h4 className="text-sm font-semibold text-gray-900 dark:text-white">
                      Cache
                    </h4>
                  </div>
                </div>
                <div className="space-y-4 text-xs">
                  {monitoringMetrics.cache.error ? (
                    <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>{monitoringMetrics.cache.error}</span>
                    </div>
                  ) : (
                    <>
                      <div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Driver</p>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{monitoringMetrics.cache.driver}</p>
                      </div>
                      {monitoringMetrics.cache.hit_rate !== undefined && (
                        <div>
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-600 dark:text-gray-400">Hit Rate</span>
                            <span className="text-xs font-semibold text-gray-900 dark:text-white">{monitoringMetrics.cache.hit_rate}%</span>
                          </div>
                          <div className="w-full bg-gray-100 dark:bg-gray-700/50 rounded-full h-2 overflow-hidden">
                            <div
                              className={`h-2 rounded-full transition-all duration-300 ${
                                monitoringMetrics.cache.hit_rate > 80
                                  ? 'bg-emerald-500'
                                  : monitoringMetrics.cache.hit_rate > 60
                                  ? 'bg-amber-500'
                                  : 'bg-red-500'
                              }`}
                              style={{ width: `${monitoringMetrics.cache.hit_rate}%` }}
                            ></div>
                          </div>
                        </div>
                      )}
                      {monitoringMetrics.cache.hits !== undefined && (
                        <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-100 dark:border-gray-700">
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Hits</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{monitoringMetrics.cache.hits.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mb-0.5">Misses</p>
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">{monitoringMetrics.cache.misses?.toLocaleString() || 0}</p>
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Recent Activities Table */}
      <div className="col-span-12">
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white px-4 pb-3 pt-4 dark:border-gray-800 dark:bg-white/[0.03] sm:px-6">
          <div className="flex flex-col gap-2 mb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                Recent Activities
                      </h3>
                    </div>
            <div className="flex items-center gap-3">
                              <button 
                    onClick={() => navigate("/reporting/log-aktivitas")}
                 className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 transition-colors"
               >
                 View All
               </button>
                  </div>
                  </div>
          <div className="max-w-full overflow-x-auto hide-scroll">
            <table className="min-w-full">
              <thead className="border-gray-100 dark:border-gray-800 border-y">
                <tr>
                      <th className="py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        User
                      </th>
                      <th className="py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        Role
                      </th>
                      <th className="py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        Action
                      </th>
                      <th className="py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        Module
                      </th>
                      <th className="py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        Description
                      </th>
                      <th className="py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        Time
                      </th>
                      <th className="py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400">
                        Status
                      </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
              {stats.recentActivities.length === 0 ? (
                  <tr>
                        <td
                          colSpan={7}
                          className="py-8 text-center text-gray-500 dark:text-gray-400"
                        >
                      No recent activities
                    </td>
                  </tr>
              ) : (
                stats.recentActivities.map((activity) => (
                    <tr key={activity.id}>
                      <td className="py-3">
                        <div className="flex items-center gap-3">
                              <div
                                className={`w-8 h-8 rounded-lg flex items-center justify-center ${getRoleColor()}`}
                              >
                            <span className="text-sm font-semibold text-white">
                                  {getUserInitials(activity.user || "System")}
                            </span>
                </div>
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                                  {activity.user || "System"}
                            </div>
                          </div>
                    </div>
                      </td>
                          <td className="py-3 text-sm text-gray-500 dark:text-gray-400">
                            {activity.role || "System"}
                          </td>
                      <td className="py-3 text-sm text-gray-900 dark:text-white">
                            {activity.event || "custom"}
                      </td>
                      <td className="py-3 text-sm text-gray-900 dark:text-white">
                            {activity.subject_type
                              ? activity.subject_type.split("\\").pop()
                              : "System"}
                      </td>
                          <td
                            className="py-3 text-sm text-gray-900 dark:text-white/90 max-w-xs truncate"
                            title={activity.description}
                          >
                        {activity.description}
                      </td>
                          <td className="py-3 text-sm text-gray-500 dark:text-gray-400">
                            {activity.timestamp ||
                              formatActivityTime(activity.created_at)}
                          </td>
                      <td className="py-3 text-sm text-gray-900 dark:text-white">
                            {activity.event || "custom"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
      </div>
      </div>

      {/* Backup System Modal */}
      <AnimatePresence>
      {showBackupModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center">
          {/* Overlay */}
        <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
            onClick={() => setShowBackupModal(false)}
          ></motion.div>
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
              onClick={() => setShowBackupModal(false)}
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
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                  Backup System
            </h2>
          </div>
          
              <div>
                <div className="mb-3 sm:mb-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-lg flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-orange-600 dark:text-orange-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                      </svg>
                    </div>
                    <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            Konfirmasi Backup
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Proses ini akan memakan waktu beberapa menit
                          </p>
                    </div>
            </div>
            
                  <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                    <div className="flex items-start space-x-3">
                          <svg
                            className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5"
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
                      <div>
                            <p className="text-sm font-medium text-blue-800 dark:text-blue-200">
                              Info
                            </p>
                            <p className="text-sm text-blue-700 dark:text-blue-300">
                              File backup akan langsung di-download ke komputer
                              Anda. Anda bisa memilih lokasi penyimpanan sesuai
                              keinginan.
                            </p>
                      </div>
                    </div>
            </div>
            
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Pilih jenis backup yang ingin Anda buat:
                    </p>
                    {backupType && (
                      <span className="text-xs text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded-full">
                        1 jenis backup dipilih
                      </span>
                    )}
            </div>
            
                  <div className="space-y-3 mb-6">
                    {[
                      {
                            value: "full",
                            label: "Full Backup",
                            description: "Database + struktur + files",
                            badge: "Rekomendasi",
                            badgeColor:
                              "bg-orange-100 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400",
                            icon: "💾",
                          },
                          {
                            value: "data_only",
                            label: "Data Only",
                            description: "Hanya data (tanpa struktur tabel)",
                            icon: "📊",
                          },
                    ].map((backup) => {
                      const isSelected = backupType === backup.value;
                      return (
                        <div
                          key={backup.value}
                          className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 ${
                                isSelected
                                  ? "bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-600"
                                  : ""
                          }`}
                          onClick={() => {
                            setBackupType(backup.value);
                          }}
                        >
                          <div className="flex items-center space-x-3">
                                <div
                                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                              isSelected 
                                      ? "bg-orange-500 border-orange-500"
                                      : "border-gray-300 dark:border-gray-600"
                                  }`}
                                >
                              {isSelected && (
                                <div className="w-2 h-2 bg-white rounded-full"></div>
                              )}
                            </div>
                            <div className="text-2xl">{backup.icon}</div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                    <span className="font-medium text-gray-900 dark:text-white">
                                      {backup.label}
                                    </span>
                                {backup.badge && (
                                      <span
                                        className={`text-xs px-2 py-1 rounded ${backup.badgeColor}`}
                                      >
                                    {backup.badge}
                                  </span>
                                )}
                              </div>
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {backup.description}
                                  </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
            
                    <div className="flex justify-end gap-2 pt-2 relative z-20">
                  <button
                    onClick={() => setShowBackupModal(false)}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmBackup}
                    disabled={!backupType || isBacking}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-orange-600 text-white text-xs sm:text-sm font-medium shadow-theme-xs hover:bg-orange-700 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                  >
                    {isBacking ? (
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
                        Creating & Downloading...
                      </>
                    ) : (
                          "Create & Download Backup"
                    )}
            </button>
                </div>
            </div>
          </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Import System Modal */}
      <AnimatePresence>
      {showImportModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center">
          {/* Overlay */}
      <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
            onClick={() => setShowImportModal(false)}
          ></motion.div>
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
              onClick={() => setShowImportModal(false)}
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
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                  Import System
          </h2>
        </div>
        
              <div>
                <div className="mb-3 sm:mb-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                          <svg
                            className="w-6 h-6 text-red-600 dark:text-red-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                      </svg>
            </div>
                    <div>
                          <h4 className="font-medium text-gray-900 dark:text-white">
                            Restore Database
                          </h4>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Hati-hati! Ini akan mengganti data yang ada
                          </p>
                    </div>
          </div>
          
                  <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start space-x-3">
                          <svg
                            className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                            />
                      </svg>
                      <div>
                            <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">
                              Peringatan!
                            </p>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                              Proses import akan mengganti semua data yang ada.
                              Pastikan Anda telah membuat backup terlebih
                              dahulu.
                            </p>
            </div>
                    </div>
          </div>
          
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Upload Backup File
                      </label>
                      <div className="relative">
                        <input 
                          type="file" 
                          accept=".sql,.zip" 
                          onChange={(e) => {
                                const file =
                                  e.target.files && e.target.files[0];
                            if (file) {
                              // Validasi ukuran file (100MB)
                              if (file.size <= 100 * 1024 * 1024) {
                                handleFileSelection(file);
                              } else {
                                    setError(
                                      "Ukuran file terlalu besar. Maksimal 100MB."
                                    );
                                handleFileSelection(null);
                              }
                            } else {
                              handleFileSelection(null);
                            }
                          }} 
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                          id="backup-file-upload"
                        />
                        <div 
                          className={`relative border-2 border-dashed rounded-lg p-6 text-center transition-all duration-300 ease-in-out transform ${
                            isDragOver 
                                  ? "border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20 scale-105 shadow-lg"
                                  : "border-gray-300 dark:border-gray-600 hover:border-red-500 dark:hover:border-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 bg-gray-50 dark:bg-gray-800 hover:scale-102"
                          }`}
                          onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragOver(true);
                          }}
                          onDragLeave={(e) => {
                            e.preventDefault();
                            setIsDragOver(false);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            setIsDragOver(false);
                            const files = e.dataTransfer.files;
                            if (files.length > 0) {
                              const file = files[0];
                              // Validasi tipe file
                                  const allowedTypes = [".sql", ".zip"];
                                  const fileExtension =
                                    "." +
                                    file.name.split(".").pop()?.toLowerCase();
                              if (allowedTypes.includes(fileExtension)) {
                                // Validasi ukuran file (100MB)
                                if (file.size <= 100 * 1024 * 1024) {
                                  handleFileSelection(file);
                                } else {
                                      setError(
                                        "Ukuran file terlalu besar. Maksimal 100MB."
                                      );
                                  handleFileSelection(null);
                                }
                              } else {
                                    setError(
                                      "Tipe file tidak didukung. Gunakan SQL atau ZIP."
                                    );
                                handleFileSelection(null);
                              }
                            }
                          }}
                        >
                          <div className="flex flex-col items-center space-y-2">
                            {selectedBackupFile ? (
                              <div className="w-full max-w-sm bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center space-x-3">
                                    <div className="flex-shrink-0">
                                      <div className="w-10 h-10 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center">
                                            <svg
                                              className="w-5 h-5 text-green-600 dark:text-green-400"
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
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm font-medium text-green-800 dark:text-green-200 truncate">
                                            {selectedBackupFile.name.length > 28
                                              ? selectedBackupFile.name.substring(
                                                  0,
                                                  28
                                                ) + "..."
                                              : selectedBackupFile.name}
                                      </p>
                                      <p className="text-xs text-green-600 dark:text-green-400 text-left w-full">
                                            {(
                                              selectedBackupFile.size /
                                              1024 /
                                              1024
                                            ).toFixed(2)}{" "}
                                            MB
                                      </p>
                                    </div>
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      handleFileSelection(null);
                                    }}
                                    className="flex-shrink-0 p-1 text-red-500 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-full transition-colors duration-200"
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
                                            d="M6 18L18 6M6 6l12 12"
                                          />
                                    </svg>
            </button>
          </div>
                              </div>
                            ) : (
                              <>
                                    <svg
                                      className="w-8 h-8 text-gray-400 dark:text-gray-500"
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
                                  <p className="mb-2 text-sm text-gray-500 dark:text-gray-400 font-medium">
                                    Click to upload atau drag and drop
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400">
                                    SQL, ZIP (MAX. 100MB)
                                  </p>
                                </div>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
          </div>
          
                    <div className="space-y-3">
                      <div className="flex items-center justify-between mb-2">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                          Jenis Import
                        </label>
                        {backupType && (
                          <span className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 px-2 py-1 rounded-full">
                            1 jenis import dipilih
                          </span>
                        )}
            </div>
        
                      {[
                        {
                              value: "full",
                              label: "Full Restore",
                              description: "Restore struktur + data lengkap",
                              badge: "Hati-hati",
                              badgeColor:
                                "bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-400",
                              icon: "⚠️",
                            },
                            {
                              value: "data_only",
                              label: "Data Only",
                              description:
                                "Hanya import data (tabel harus sudah ada)",
                              icon: "📊",
                            },
                                            ].map((importType) => {
                        const isSelected = backupType === importType.value;
                        return (
                          <div
                            key={importType.value}
                            className={`p-4 border border-gray-200 dark:border-gray-700 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-800 transition-all duration-200 ${
                                  isSelected
                                    ? "bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-600"
                                    : ""
                            }`}
                            onClick={() => {
                                  const newType = importType.value as
                                    | "full"
                                    | "data_only";
                              setBackupType(newType);
                              if (selectedBackupFile) {
                                    checkImportTypeCompatibility(
                                      selectedBackupFile,
                                      newType
                                    );
                              }
                            }}
                          >
                            <div className="flex items-center space-x-3">
                                  <div
                                    className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                isSelected 
                                        ? "bg-red-500 border-red-500"
                                        : "border-gray-300 dark:border-gray-600"
                                    }`}
                                  >
                                {isSelected && (
                                  <div className="w-2 h-2 bg-white rounded-full"></div>
                                )}
                              </div>
                                  <div className="text-2xl">
                                    {importType.icon}
                                  </div>
                              <div className="flex-1">
                                <div className="flex items-center space-x-2">
                                      <span className="font-medium text-gray-900 dark:text-white">
                                        {importType.label}
                                      </span>
                                  {importType.badge && (
                                        <span
                                          className={`text-xs px-2 py-1 rounded ${importType.badgeColor}`}
                                        >
                                      {importType.badge}
                                    </span>
                                  )}
                                </div>
                                    <p className="text-sm text-gray-600 dark:text-gray-400">
                                      {importType.description}
                                    </p>
                              </div>
                            </div>
                          </div>
                        );
                      })}
          </div>
          
                    {isImporting && (
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
                        <div 
                          className="bg-red-600 dark:bg-red-500 h-2.5 rounded-full transition-all duration-300" 
                          style={{ width: `${importProgress}%` }}
                        ></div>
            </div>
                    )}
                  </div>
          </div>
          
                {/* Type Mismatch Warning */}
                {importTypeWarning && (
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 mb-4">
                    <div className="flex items-start space-x-3">
                          <svg
                            className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                            />
                      </svg>
                      <div className="flex-1">
                        <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200">
                          Type Mismatch Detected
                        </h4>
                        <div className="mt-1">
                              {importTypeWarning
                                .split("\n")
                                .map((line, index) => (
                                  <p
                                    key={index}
                                    className="text-sm text-amber-700 dark:text-amber-300"
                                  >
                              {line}
                            </p>
                          ))}
            </div>
          </div>
                    </div>
                  </div>
                )}
            
                    <div className="flex justify-end gap-2 pt-2 relative z-20">
                  <button
                    onClick={() => setShowImportModal(false)}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>
                  <button
                    type="button"
                    onClick={handleImportBackup}
                    disabled={isImporting || !selectedBackupFile}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-red-600 text-white text-xs sm:text-sm font-medium shadow-theme-xs hover:bg-red-700 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
                  >
                    {isImporting ? (
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
                        Importing...
                      </>
                    ) : (
                          "Start Import"
                    )}
                  </button>
            </div>
          </div>
        </div>
        </motion.div>
      </div>
      )}
      </AnimatePresence>

      {/* Reset System Modal */}
      <AnimatePresence>
      {showResetModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center">
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
            onClick={() => setShowResetModal(false)}
          ></motion.div>
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
              <div className="flex items-center justify-between pb-4 sm:pb-6">
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                  Reset System
                </h2>
              </div>
              
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-red-600 dark:text-red-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                    </svg>
                  </div>
                  <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          Konfirmasi Reset
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Tindakan ini tidak dapat dibatalkan!
                        </p>
                  </div>
                </div>
                
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start space-x-3">
                        <svg
                          className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                    </svg>
                    <div>
                          <p className="text-sm font-medium text-red-800 dark:text-red-200">
                            Peringatan Kritis!
                          </p>
                          <p className="text-sm text-red-700 dark:text-red-300">
                            Reset akan menghapus SEMUA data kecuali akun Super
                            Admin yang sedang login. Pastikan Anda telah membuat
                            backup terlebih dahulu.
                          </p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Ketik "reset" untuk konfirmasi:
                    </label>
                    <input
                      type="text"
                      value={resetConfirmationText}
                          onChange={(e) =>
                            setResetConfirmationText(e.target.value)
                          }
                      placeholder="Ketik 'reset' di sini..."
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-red-500 dark:bg-gray-800 dark:text-white transition-colors"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-2 relative z-20">
                <button
                  onClick={() => setShowResetModal(false)}
                  className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmReset}
                      disabled={
                        isResetting ||
                        resetConfirmationText.toLowerCase() !== "reset"
                      }
                  className="px-3 sm:px-4 py-2 rounded-lg bg-red-600 text-white text-xs sm:text-sm font-medium shadow-theme-xs hover:bg-red-700 transition-all duration-300 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed relative z-10"
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
                      Resetting...
                    </>
                  ) : (
                        "Konfirmasi Reset"
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>

      {/* Create Super Admin Modal */}
      <AnimatePresence>
      {showCreateAdminModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center">
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
            onClick={handleCloseCreateAdminModal}
          ></motion.div>
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
              onClick={handleCloseCreateAdminModal}
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
                <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                  Tambah Super Admin
                </h2>
              </div>
              
              <div>
                <div className="mb-3 sm:mb-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                        <svg
                          className="w-6 h-6 text-blue-600 dark:text-blue-400"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                          />
                      </svg>
                    </div>
                    <div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-white">
                          Buat Akun Super Admin Baru
                        </h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          Isi form di bawah ini untuk membuat akun Super Admin
                          baru
                        </p>
                    </div>
                  </div>
                </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSubmitCreateAdmin();
                    }}
                    className="space-y-4"
                  >
                  {/* Nama */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nama Lengkap *
                    </label>
                    <input
                      type="text"
                      value={adminFormData.name}
                        onChange={(e) =>
                          handleAdminFormChange("name", e.target.value)
                        }
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                          adminFormErrors.name
                            ? "border-red-500"
                            : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="Masukkan nama lengkap"
                    />
                    {adminFormErrors.name && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {adminFormErrors.name}
                        </p>
                    )}
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Username *
                    </label>
                    <input
                      type="text"
                      value={adminFormData.username}
                        onChange={(e) =>
                          handleAdminFormChange("username", e.target.value)
                        }
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                          adminFormErrors.username
                            ? "border-red-500"
                            : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="Masukkan username"
                    />
                    {adminFormErrors.username && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {adminFormErrors.username}
                        </p>
                    )}
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={adminFormData.email}
                        onChange={(e) =>
                          handleAdminFormChange("email", e.target.value)
                        }
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                          adminFormErrors.email
                            ? "border-red-500"
                            : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="Masukkan email"
                    />
                    {adminFormErrors.email && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {adminFormErrors.email}
                        </p>
                    )}
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Password *
                    </label>
                    <input
                      type="password"
                      value={adminFormData.password}
                        onChange={(e) =>
                          handleAdminFormChange("password", e.target.value)
                        }
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                          adminFormErrors.password
                            ? "border-red-500"
                            : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="Masukkan password (min 8 karakter)"
                    />
                    {adminFormErrors.password && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {adminFormErrors.password}
                        </p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Konfirmasi Password *
                    </label>
                    <input
                      type="password"
                      value={adminFormData.confirmPassword}
                        onChange={(e) =>
                          handleAdminFormChange(
                            "confirmPassword",
                            e.target.value
                          )
                        }
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                          adminFormErrors.confirmPassword
                            ? "border-red-500"
                            : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="Konfirmasi password"
                    />
                    {adminFormErrors.confirmPassword && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {adminFormErrors.confirmPassword}
                        </p>
                    )}
                  </div>

                  {/* Phone */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nomor Telepon *
                    </label>
                    <input
                      type="tel"
                      value={adminFormData.phone}
                        onChange={(e) =>
                          handleAdminFormChange("phone", e.target.value)
                        }
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                          adminFormErrors.phone
                            ? "border-red-500"
                            : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="Masukkan nomor telepon"
                    />
                    {adminFormErrors.phone && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {adminFormErrors.phone}
                        </p>
                    )}
                  </div>

                  {/* Position */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Posisi/Jabatan *
                    </label>
                    <input
                      type="text"
                      value={adminFormData.position}
                        onChange={(e) =>
                          handleAdminFormChange("position", e.target.value)
                        }
                      className={`w-full px-4 py-3 border rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white ${
                          adminFormErrors.position
                            ? "border-red-500"
                            : "border-gray-300 dark:border-gray-600"
                      }`}
                      placeholder="Masukkan posisi/jabatan"
                    />
                    {adminFormErrors.position && (
                        <p className="mt-1 text-sm text-red-600 dark:text-red-400">
                          {adminFormErrors.position}
                        </p>
                    )}
                  </div>

                  {/* Action Buttons */}
                  <div className="flex space-x-3 pt-6">
                    <button
                      type="button"
                      onClick={handleCloseCreateAdminModal}
                      className="flex-1 px-6 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 rounded-xl hover:bg-gray-200 dark:hover:bg-gray-700 transition font-medium"
                      disabled={isCreatingAdmin}
                    >
                      Batal
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingAdmin}
                      className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition font-medium flex items-center justify-center"
                    >
                      {isCreatingAdmin ? (
                        <>
                            <svg
                              className="animate-spin -ml-1 mr-2 h-4 w-4 text-white"
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
                          Membuat...
                        </>
                      ) : (
                          "Buat Akun"
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      )}
      </AnimatePresence>
    </>
  );
};

export default DashboardSuperAdmin;