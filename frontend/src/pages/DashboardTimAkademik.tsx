import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  DocumentChartBarIcon,
  GroupIcon,
  UserIcon,
  CalenderIcon,
  TimeIcon,
  AlertIcon,
  CheckCircleIcon,
  ErrorIcon,
  InfoIcon,
  DocsIcon,
  TaskIcon,
  PieChartIcon,
  BoltIcon,
} from "../icons";
import api, { handleApiError } from "../utils/api";

// Interfaces

interface DashboardStats {
  totalMataKuliah: number;
  // totalKelas removed - Kelas feature no longer exists
  totalRuangan: number;
  totalDosen: number;
  totalMahasiswa: number;
  totalJadwalAktif: number;
  attendanceStats: AttendanceStats;
  assessmentStats: AssessmentStats;
  todaySchedule: TodayScheduleItem[];
  recentActivities: Activity[];
  academicNotifications: AcademicNotification[];
  academicOverview: AcademicOverview;
  scheduleStats: ScheduleStats;
  lowAttendanceAlerts: LowAttendanceAlert[];
  praktikumPendingAbsensi: PraktikumPendingAbsensi[];
}

interface AttendanceStats {
  overall_rate: number;
  pbl_rate: number;
  journal_rate: number;
  csr_rate: number;
  total_students: number;
  total_sessions: number;
  attended_sessions: number;
}

interface AssessmentStats {
  total_pbl_assessments: number;
  total_journal_assessments: number;
  pending_pbl: number;
  pending_journal: number;
  completion_rate: number;
  average_score: number;
  total_assessments: number;
  completed_assessments: number;
}

interface TodayScheduleItem {
  type: string;
  mata_kuliah: string;
  dosen: string;
  ruangan: string;
  waktu: string;
  topik: string;
}

interface Activity {
  id: string;
  user: string;
  action: string;
  target: string;
  timestamp: string;
  type: "create" | "update" | "delete" | "login" | "export";
}

interface AcademicNotification {
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

interface ScheduleStats {
  kuliah_besar: number;
  pbl: number;
  jurnal_reading: number;
  csr: number;
  non_blok_non_csr: number;
  praktikum: number;
  agenda_khusus: number;
}

interface LowAttendanceAlert {
  student_nim: string;
  student_name: string;
  attendance_rate: number;
  type: string;
}

interface PraktikumPendingAbsensi {
  id: number;
  mata_kuliah_kode: string;
  mata_kuliah_nama: string;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  ruangan: string;
  kelompok_kecil?: { id: number; nama_kelompok: string } | null;
  materi: string;
  topik?: string | null;
  dosen_names: string[];
  total_dosen: number;
  absensi_dosen_count: number;
  is_submitted: boolean;
  status: "selesai" | "belum_diselesaikan";
  action_url: string;
}

const DashboardTimAkademik: React.FC = () => {
  const navigate = useNavigate();
  // Ambil data user dari localStorage
  const getUser = () => {
    try {
      const user = localStorage.getItem("user");
      return user ? JSON.parse(user) : null;
    } catch {
      return null;
    }
  };
  const user = getUser();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [tahunAjaran, setTahunAjaran] = useState<{ tahun: string; semesters: Array<{ id: number; jenis: string; aktif: boolean }> } | null>(null);
  const [activeAttendanceSemester, setActiveAttendanceSemester] = useState<
    "reguler" | "antara"
  >("reguler");
  const [activeAssessmentSemester, setActiveAssessmentSemester] = useState<
    "reguler" | "antara"
  >("reguler");
  const [activeScheduleSemester, setActiveScheduleSemester] = useState<
    "reguler" | "antara"
  >("reguler");
  const [stats, setStats] = useState<DashboardStats>({
    totalMataKuliah: 0,
    // totalKelas removed
    totalRuangan: 0,
    totalDosen: 0,
    totalMahasiswa: 0,
    totalJadwalAktif: 0,
    attendanceStats: {
      overall_rate: 0,
      pbl_rate: 0,
      journal_rate: 0,
      csr_rate: 0,
      total_students: 0,
      total_sessions: 0,
      attended_sessions: 0,
    },
    assessmentStats: {
      total_pbl_assessments: 0,
      total_journal_assessments: 0,
      pending_pbl: 0,
      pending_journal: 0,
      completion_rate: 0,
      average_score: 0,
      total_assessments: 0,
      completed_assessments: 0,
    },
    todaySchedule: [],
    recentActivities: [],
    academicNotifications: [],
    academicOverview: {
      current_semester: "",
      current_tahun_ajaran: "",
      semester_progress: 0,
      active_blocks: [],
      upcoming_deadlines: [],
    },
    scheduleStats: {
      kuliah_besar: 0,
      pbl: 0,
      jurnal_reading: 0,
      csr: 0,
      non_blok_non_csr: 0,
      praktikum: 0,
      agenda_khusus: 0,
    },
    lowAttendanceAlerts: [],
    praktikumPendingAbsensi: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch active semester
  useEffect(() => {
    const fetchActiveSemester = async () => {
      try {
        const res = await api.get("/tahun-ajaran/active");
        setTahunAjaran(res.data);
      } catch (error) {
        // Handle error silently
      }
    };
    fetchActiveSemester();
  }, []);

  // Update time every second for real-time clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Cache untuk menyimpan data yang sudah pernah di-fetch
  const [dataCache, setDataCache] = useState<{ [key: string]: any }>({});
  
  // Individual loading states for each card
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [scheduleLoading, setScheduleLoading] = useState(false);

  // Fetch attendance data separately
  const fetchAttendanceData = async (semester: "reguler" | "antara") => {
    const cacheKey = `${semester}-attendance`;
    
    // Jika data sudah ada di cache, gunakan cache
    if (dataCache[cacheKey]) {
      setStats(prev => ({
        ...prev,
        attendanceStats: dataCache[cacheKey].attendanceStats
      }));
      return;
    }

    try {
      setAttendanceLoading(true);
      const response = await api.get(
        `/dashboard-tim-akademik/attendance?semester=${semester}`
      );

      // Simpan ke cache
      setDataCache(prev => ({
        ...prev,
        [cacheKey]: response.data
      }));

      setStats(prev => ({
        ...prev,
        attendanceStats: response.data.attendanceStats
      }));
    } catch (err: any) {
        // Handle error silently
    } finally {
      setAttendanceLoading(false);
    }
  };

  // Fetch assessment data separately
  const fetchAssessmentData = async (semester: "reguler" | "antara") => {
    const cacheKey = `${semester}-assessment`;
    
    // Jika data sudah ada di cache, gunakan cache
    if (dataCache[cacheKey]) {
      setStats(prev => ({
        ...prev,
        assessmentStats: dataCache[cacheKey].assessmentStats
      }));
      return;
    }

    try {
      setAssessmentLoading(true);
      const response = await api.get(
        `/dashboard-tim-akademik/assessment?semester=${semester}`
      );

      // Simpan ke cache
      setDataCache(prev => ({
        ...prev,
        [cacheKey]: response.data
      }));

      setStats(prev => ({
        ...prev,
        assessmentStats: response.data.assessmentStats
      }));
    } catch (err: any) {
        // Handle error silently
    } finally {
      setAssessmentLoading(false);
    }
  };

  // Fetch schedule data separately
  const fetchScheduleData = async (semester: "reguler" | "antara") => {
    const cacheKey = `${semester}-schedule`;
    
    // Jika data sudah ada di cache, gunakan cache
    if (dataCache[cacheKey]) {
      setStats(prev => ({
        ...prev,
        scheduleStats: dataCache[cacheKey].scheduleStats
      }));
      return;
    }

    try {
      setScheduleLoading(true);
      const response = await api.get(
        `/dashboard-tim-akademik/schedule?semester=${semester}`
      );

      // Simpan ke cache
      setDataCache(prev => ({
        ...prev,
        [cacheKey]: response.data
      }));

      setStats(prev => ({
        ...prev,
        scheduleStats: response.data.scheduleStats
      }));
    } catch (err: any) {
        // Handle error silently
    } finally {
      setScheduleLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        setLoading(true);
        const response = await api.get("/dashboard-tim-akademik");
        setStats(response.data);
        setError(null);
      } catch (err: any) {
        setError(err?.response?.data?.message || "Gagal memuat data dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchInitialData();
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

  // Helper functions
  const getActivityIcon = (type: string) => {
    switch (type) {
      case "create":
        return <CheckCircleIcon className="w-4 h-4 text-green-500" />;
      case "update":
        return <DocsIcon className="w-4 h-4 text-blue-500" />;
      case "delete":
        return <ErrorIcon className="w-4 h-4 text-red-500" />;
      case "login":
        return <GroupIcon className="w-4 h-4 text-purple-500" />;
      case "export":
        return <DocsIcon className="w-4 h-4 text-orange-500" />;
      default:
        return <InfoIcon className="w-4 h-4 text-gray-500" />;
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case "success":
        return (
          <CheckCircleIcon className="w-5 h-5 text-green-500 dark:text-green-400" />
        );
      case "warning":
        return (
          <AlertIcon className="w-5 h-5 text-yellow-500 dark:text-yellow-400" />
        );
      case "error":
        return <ErrorIcon className="w-5 h-5 text-red-500 dark:text-red-400" />;
      case "info":
        return (
          <InfoIcon className="w-5 h-5 text-blue-500 dark:text-blue-400" />
        );
      default:
        return (
          <BoltIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
        );
    }
  };

  const getNotificationColor = (type: string) => {
    switch (type) {
      case "success":
        return "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800";
      case "warning":
        return "bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800";
      case "error":
        return "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800";
      case "info":
        return "bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800";
      default:
        return "bg-gray-50 border-gray-200 dark:bg-gray-800/50 dark:border-gray-700";
    }
  };

  const getAttendanceColor = (rate: number) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 80) return "text-yellow-600";
    return "text-red-600";
  };

  const getAssessmentColor = (rate: number) => {
    if (rate >= 90) return "text-green-600";
    if (rate >= 70) return "text-yellow-600";
    return "text-red-600";
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <div className="w-8 h-8 bg-blue-500 rounded-full animate-pulse"></div>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Loading Dashboard
          </h3>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
            <ErrorIcon className="w-8 h-8 text-red-500" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Error Loading Dashboard
          </h3>
          <p className="text-gray-600 dark:text-gray-400 mb-4">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
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
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <DocsIcon className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                      Dashboard Tim Akademik
                    </h1>
                    <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                      ISME - Integrated System Medical Education
                    </p>
                    {user && (
                      <p className="mt-1 text-sm text-purple-700 dark:text-purple-400 font-semibold">
                        Logged in as: {user.name} ({user.username})
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 mt-4 sm:mt-0">
                  {/* Right side - Time & Academic Info */}
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
                      <TimeIcon className="w-3 h-3 mr-2" />
                      <div className="flex flex-col">
                        <span className="font-semibold">
                          {formatTime(currentTime)}
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

          {/* Main Stats Cards */}
          <div className="col-span-12">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 md:gap-6">
              <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                    <DocsIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Total
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Mata Kuliah
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalMataKuliah}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center">
                    <GroupIcon className="w-6 h-6 text-green-600 dark:text-green-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Total
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Mahasiswa
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalMahasiswa}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900/20 rounded-2xl flex items-center justify-center">
                    <UserIcon className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Total
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Dosen
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalDosen}
                  </p>
                </div>
              </div>

              <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center">
                    <CalenderIcon className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                  </div>
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400">
                    Aktif
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Jadwal
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">
                    {stats.totalJadwalAktif}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Analytics Cards */}
          <div className="col-span-12">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
              {/* Attendance Statistics */}
              <div className="group bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-md transition-all duration-300">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl flex items-center justify-center">
                        <DocumentChartBarIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Statistik Kehadiran
                      </h3>
                    </div>
                    <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                  </div>

                  {/* Semester Tabs - Improved Design */}
                  <div className="flex bg-gray-50 dark:bg-gray-800/50 rounded-xl p-1 relative">
                    {attendanceLoading && (
                      <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 rounded-xl flex items-center justify-center z-10">
                        <div className="flex w-full px-1 gap-1">
                          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-1/2"></div>
                          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-1/2" style={{ animationDelay: "0.1s" }}></div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setActiveAttendanceSemester("reguler");
                        fetchAttendanceData("reguler");
                      }}
                      disabled={attendanceLoading}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 ${
                        activeAttendanceSemester === "reguler"
                          ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      Reguler
                    </button>
                    <button
                      onClick={() => {
                        setActiveAttendanceSemester("antara");
                        fetchAttendanceData("antara");
                      }}
                      disabled={attendanceLoading}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 ${
                        activeAttendanceSemester === "antara"
                          ? "bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      Antara
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {attendanceLoading ? (
                    // Skeleton Loading untuk Statistik Kehadiran
                    <>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                          <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2"></div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                          <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2"></div>
                      </div>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg">
                        <div className="flex justify-between items-center">
                          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                          <div className="h-6 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2"></div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-all duration-300 hover:scale-[1.02]">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Keseluruhan
                          </span>
                          <span
                            className={`font-bold text-lg ${getAttendanceColor(
                              stats.attendanceStats.overall_rate
                            )}`}
                          >
                            {stats.attendanceStats.overall_rate}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              stats.attendanceStats.overall_rate >= 80
                                ? "bg-green-500"
                                : stats.attendanceStats.overall_rate >= 60
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{
                              width: `${Math.min(
                                stats.attendanceStats.overall_rate,
                                100
                              )}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-all duration-300 hover:scale-[1.02]">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            PBL
                          </span>
                          <span
                            className={`font-bold text-lg ${getAttendanceColor(
                              stats.attendanceStats.pbl_rate
                            )}`}
                          >
                            {stats.attendanceStats.pbl_rate}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              stats.attendanceStats.pbl_rate >= 80
                                ? "bg-green-500"
                                : stats.attendanceStats.pbl_rate >= 60
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{
                              width: `${Math.min(
                                stats.attendanceStats.pbl_rate,
                                100
                              )}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-all duration-300 hover:scale-[1.02]">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Journal Reading
                          </span>
                          <span
                            className={`font-bold text-lg ${getAttendanceColor(
                              stats.attendanceStats.journal_rate
                            )}`}
                          >
                            {stats.attendanceStats.journal_rate}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              stats.attendanceStats.journal_rate >= 80
                                ? "bg-green-500"
                                : stats.attendanceStats.journal_rate >= 60
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{
                              width: `${Math.min(
                                stats.attendanceStats.journal_rate,
                                100
                              )}%`,
                            }}
                          ></div>
                        </div>
                      </div>

                      <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-all duration-300 hover:scale-[1.02]">
                        <div className="flex justify-between items-center">
                          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            CSR
                          </span>
                          <span
                            className={`font-bold text-lg ${getAttendanceColor(
                              stats.attendanceStats.csr_rate
                            )}`}
                          >
                            {stats.attendanceStats.csr_rate}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                          <div
                            className={`h-2 rounded-full transition-all duration-500 ${
                              stats.attendanceStats.csr_rate >= 80
                                ? "bg-green-500"
                                : stats.attendanceStats.csr_rate >= 60
                                ? "bg-yellow-500"
                                : "bg-red-500"
                            }`}
                            style={{
                              width: `${Math.min(
                                stats.attendanceStats.csr_rate,
                                100
                              )}%`,
                            }}
                          ></div>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Assessment Statistics */}
              <div className="group bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-md transition-all duration-300">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/20 dark:to-green-800/20 rounded-xl flex items-center justify-center">
                        <TaskIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Statistik Penilaian
                      </h3>
                    </div>
                    <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  </div>

                  {/* Semester Tabs - Improved Design */}
                  <div className="flex bg-gray-50 dark:bg-gray-800/50 rounded-xl p-1 relative">
                    {assessmentLoading && (
                      <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 rounded-xl flex items-center justify-center z-10">
                        <div className="flex w-full px-1 gap-1">
                          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-1/2"></div>
                          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-1/2" style={{ animationDelay: "0.1s" }}></div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setActiveAssessmentSemester("reguler");
                        fetchAssessmentData("reguler");
                      }}
                      disabled={assessmentLoading}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 ${
                        activeAssessmentSemester === "reguler"
                          ? "bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 shadow-sm"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      Reguler
                    </button>
                    <button
                      onClick={() => {
                        setActiveAssessmentSemester("antara");
                        fetchAssessmentData("antara");
                      }}
                      disabled={assessmentLoading}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 ${
                        activeAssessmentSemester === "antara"
                          ? "bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 shadow-sm"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      Antara
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Penyelesaian
                      </span>
                      <span
                        className={`font-bold text-lg ${getAssessmentColor(
                          stats.assessmentStats.completion_rate
                        )}`}
                      >
                        {stats.assessmentStats.completion_rate}%
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          stats.assessmentStats.completion_rate >= 80
                            ? "bg-green-500"
                            : stats.assessmentStats.completion_rate >= 60
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            stats.assessmentStats.completion_rate,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Nilai Rata-rata
                      </span>
                      <span className="font-bold text-lg text-gray-900 dark:text-white">
                        {stats.assessmentStats.average_score.toFixed(1)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mt-2">
                      <div
                        className={`h-2 rounded-full transition-all duration-500 ${
                          stats.assessmentStats.average_score >= 3.0
                            ? "bg-green-500"
                            : stats.assessmentStats.average_score >= 2.0
                            ? "bg-yellow-500"
                            : "bg-red-500"
                        }`}
                        style={{
                          width: `${Math.min(
                            (stats.assessmentStats.average_score / 4.0) * 100,
                            100
                          )}%`,
                        }}
                      ></div>
                    </div>
                  </div>

                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg transition-all duration-300 hover:scale-[1.02] border border-orange-200 dark:border-orange-800">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                        PBL Tertunda
                      </span>
                      <span className="font-bold text-lg text-orange-600 dark:text-orange-400">
                        {stats.assessmentStats.pending_pbl}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg transition-all duration-300 hover:scale-[1.02] border border-orange-200 dark:border-orange-800">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-orange-700 dark:text-orange-300">
                        Journal Tertunda
                      </span>
                      <span className="font-bold text-lg text-orange-600 dark:text-orange-400">
                        {stats.assessmentStats.pending_journal}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Schedule Statistics */}
              <div className="group bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-md transition-all duration-300">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl flex items-center justify-center">
                        <CalenderIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                      </div>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        Statistik Jadwal
                      </h3>
                    </div>
                    <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
                  </div>

                  {/* Semester Tabs - Improved Design */}
                  <div className="flex bg-gray-50 dark:bg-gray-800/50 rounded-xl p-1 relative">
                    {scheduleLoading && (
                      <div className="absolute inset-0 bg-white/50 dark:bg-gray-800/50 rounded-xl flex items-center justify-center z-10">
                        <div className="flex w-full px-1 gap-1">
                          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-1/2"></div>
                          <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse w-1/2" style={{ animationDelay: "0.1s" }}></div>
                        </div>
                      </div>
                    )}
                    <button
                      onClick={() => {
                        setActiveScheduleSemester("reguler");
                        fetchScheduleData("reguler");
                      }}
                      disabled={scheduleLoading}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 ${
                        activeScheduleSemester === "reguler"
                          ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      Reguler
                    </button>
                    <button
                      onClick={() => {
                        setActiveScheduleSemester("antara");
                        fetchScheduleData("antara");
                      }}
                      disabled={scheduleLoading}
                      className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 focus:outline-none disabled:opacity-50 ${
                        activeScheduleSemester === "antara"
                          ? "bg-white dark:bg-gray-700 text-purple-600 dark:text-purple-400 shadow-sm"
                          : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700/50"
                      }`}
                    >
                      Antara
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Kuliah Besar
                      </span>
                      <span className="font-bold text-lg text-gray-900 dark:text-white">
                        {stats.scheduleStats.kuliah_besar}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        PBL
                      </span>
                      <span className="font-bold text-lg text-gray-900 dark:text-white">
                        {stats.scheduleStats.pbl}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Journal Reading
                      </span>
                      <span className="font-bold text-lg text-gray-900 dark:text-white">
                        {stats.scheduleStats.jurnal_reading}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        CSR
                      </span>
                      <span className="font-bold text-lg text-gray-900 dark:text-white">
                        {stats.scheduleStats.csr}
                      </span>
                    </div>
                  </div>

                  <div className="p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg transition-all duration-300 hover:scale-[1.02]">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        Praktikum
                      </span>
                      <span className="font-bold text-lg text-gray-900 dark:text-white">
                        {stats.scheduleStats.praktikum}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notifications and Alerts */}
          <div className="col-span-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* Academic Notifications */}
              <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Notifikasi Akademik
                  </h3>
                  <BoltIcon className="w-5 h-5 text-gray-400" />
                </div>

                <div className="space-y-3">
                  {stats.academicNotifications.length > 0 ? (
                    stats.academicNotifications
                      .slice(0, 4)
                      .map((notification, index) => (
                        <div
                          key={index}
                          className={`p-3 rounded-lg border ${getNotificationColor(
                            notification.type
                          )}`}
                        >
                          <div className="flex items-start">
                            {getNotificationIcon(notification.type)}
                            <div className="ml-2 flex-1">
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {notification.title}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-300 mt-1">
                                {notification.message}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      Tidak ada notifikasi
                    </p>
                  )}
                </div>
              </div>

              {/* Low Attendance Alerts */}
              <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Peringatan Kehadiran
                  </h3>
                  <AlertIcon className="w-5 h-5 text-gray-400" />
                </div>

                <div className="space-y-3">
                  {stats.lowAttendanceAlerts.length > 0 ? (
                    stats.lowAttendanceAlerts
                      .slice(0, 4)
                      .map((alert, index) => (
                        <div
                          key={index}
                          className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
                        >
                          <div className="flex justify-between items-start">
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {alert.student_name}
                              </p>
                              <p className="text-xs text-gray-600 dark:text-gray-400">
                                {alert.student_nim}
                              </p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold text-red-600">
                                {alert.attendance_rate}%
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {alert.type}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))
                  ) : (
                    <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                      Tidak ada peringatan
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Praktikum Pending Absensi Dosen */}
          <div className="col-span-12">
            <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-orange-100 to-orange-200 dark:from-orange-900/20 dark:to-orange-800/20 rounded-xl flex items-center justify-center">
                    <TaskIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Absensi Dosen Praktikum
                  </h3>
                </div>
                <div className="w-2 h-2 bg-orange-500 rounded-full"></div>
              </div>

              <div className="space-y-3">
                {stats.praktikumPendingAbsensi.length > 0 ? (
                  stats.praktikumPendingAbsensi.map((praktikum, index) => (
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
                        praktikum.status === "selesai"
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
                                praktikum.status === "selesai"
                                  ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                                  : "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200"
                              }`}
                            >
                              {praktikum.status === "selesai"
                                ? "✓ Selesai"
                                : "⏳ Belum Diselesaikan"}
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
                              {praktikum.ruangan} |{" "}
                              <span className="font-medium">Kelompok Kecil:</span>{" "}
                              {praktikum.kelompok_kecil?.nama_kelompok || "-"}
                            </p>
                            {praktikum.materi && (
                              <p>
                                <span className="font-medium">Materi:</span>{" "}
                                {praktikum.materi}
                              </p>
                            )}
                            <p>
                              <span className="font-medium">Dosen:</span>{" "}
                              {praktikum.dosen_names.join(", ")} (
                              {praktikum.total_dosen} orang)
                            </p>
                          </div>
                        </div>
                        <div className="ml-4 flex items-center">
                          <div className="text-right">
                            {praktikum.status === "belum_diselesaikan" && (
                              <p className="text-xs text-orange-600 dark:text-orange-400 font-medium">
                                Klik untuk absensi
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    Tidak ada jadwal praktikum yang perlu absensi dosen
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Bottom Cards */}
          <div className="col-span-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
              {/* Today's Schedule */}
              <div className="group bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 rounded-xl flex items-center justify-center">
                      <TimeIcon className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Jadwal Hari Ini
                    </h3>
                  </div>
                  <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                </div>

                <div className="space-y-3">
                  {stats.todaySchedule.length > 0 ? (
                    stats.todaySchedule.map((schedule, index) => (
                      <div
                        key={index}
                        className="p-3 bg-gray-50 dark:bg-gray-700 rounded-lg transition-all duration-300 hover:scale-[1.02]"
                      >
                        <div className="flex justify-between items-start">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900 dark:text-white">
                              {schedule.mata_kuliah}
                            </p>
                            <p className="text-xs text-gray-600 dark:text-gray-400">
                              {schedule.type}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              {schedule.dosen}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white">
                              {schedule.waktu}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-500">
                              {schedule.ruangan}
                            </p>
                          </div>
                        </div>
                        {schedule.topik && (
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                            {schedule.topik}
                          </p>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                        <TimeIcon className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Tidak ada jadwal hari ini
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent Activities */}
              <div className="group bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-md transition-all duration-300">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-900/20 dark:to-green-800/20 rounded-xl flex items-center justify-center">
                      <DocsIcon className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Aktivitas Terbaru
                    </h3>
                  </div>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                </div>

                <div className="space-y-3">
                  {stats.recentActivities.length > 0 ? (
                    stats.recentActivities
                      .slice(0, 6)
                      .map((activity, index) => (
                        <div
                          key={index}
                          className="flex items-start space-x-3 p-2 rounded-lg transition-all duration-300 hover:bg-gray-50 dark:hover:bg-gray-800/50"
                        >
                          {getActivityIcon(activity.type)}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm text-gray-900 dark:text-white">
                              <span className="font-medium">
                                {activity.user}
                              </span>{" "}
                              {activity.action} {activity.target}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {activity.timestamp}
                            </p>
                          </div>
                        </div>
                      ))
                  ) : (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-3">
                        <DocsIcon className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        Tidak ada aktivitas terbaru
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Academic Overview */}
          <div className="col-span-12">
            <div className="group bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800 hover:shadow-md transition-all duration-300">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-900/20 dark:to-purple-800/20 rounded-xl flex items-center justify-center">
                    <PieChartIcon className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Ringkasan Akademik
                  </h3>
                </div>
                <div className="w-2 h-2 bg-purple-500 rounded-full"></div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                    Progress Semester
                  </h4>
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-2">
                    <div
                      className="bg-gradient-to-r from-blue-500 to-blue-600 h-3 rounded-full transition-all duration-500"
                      style={{
                        width: `${stats.academicOverview.semester_progress}%`,
                      }}
                    ></div>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {stats.academicOverview.semester_progress}% selesai
                  </p>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                    Blok Aktif
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {stats.academicOverview.active_blocks.map(
                      (block, index) => (
                        <span
                          key={index}
                          className="px-3 py-1 bg-gradient-to-r from-blue-100 to-blue-200 dark:from-blue-900/20 dark:to-blue-800/20 text-blue-800 dark:text-blue-400 text-xs rounded-full font-medium"
                        >
                          Blok {block}
                        </span>
                      )
                    )}
                  </div>
                </div>

                <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl">
                  <h4 className="text-sm font-medium text-gray-600 dark:text-gray-400 mb-3">
                    Deadline Mendatang
                  </h4>
                  <div className="space-y-2">
                    {stats.academicOverview.upcoming_deadlines
                      .slice(0, 3)
                      .map((deadline, index) => (
                        <div
                          key={index}
                          className="text-sm p-2 bg-white dark:bg-gray-700 rounded-lg"
                        >
                          <p className="text-gray-900 dark:text-white font-medium">
                            {deadline.title}
                          </p>
                          <p className="text-gray-500 dark:text-gray-400 text-xs">
                            {new Date(deadline.date).toLocaleDateString(
                              "id-ID"
                            )}
                          </p>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default DashboardTimAkademik;
