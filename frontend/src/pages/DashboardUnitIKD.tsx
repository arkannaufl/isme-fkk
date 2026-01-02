import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import api, { BASE_URL } from "../utils/api";
import Chart from "react-apexcharts";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faBook,
    faClipboardCheck,
    faArrowRight,
    faUsers,
    faChevronLeft,
    faChevronRight,
} from "@fortawesome/free-solid-svg-icons";

// Interface definitions
interface DashboardStats {
    unit: string;
    total_pedoman: number;
    total_rekap: number;
    unit_accounts: any[];
}

const DashboardUnitIKD: React.FC = () => {
    const navigate = useNavigate();
    const [user, setUser] = useState<any>(() => {
        try {
            return JSON.parse(localStorage.getItem("user") || "{}");
        } catch {
            return {};
        }
    });

    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));
    const [accountPage, setAccountPage] = useState(0);
    const ACCOUNTS_PER_PAGE = 3;

    // Helper to get unit accounts sorted by online status
    const getSortedAccounts = () => {
        if (!stats?.unit_accounts) return [];
        return [...stats.unit_accounts].sort((a, b) => (b.is_logged_in || 0) - (a.is_logged_in || 0));
    };

    // Real-time clock update
    useEffect(() => {
        const timer = setInterval(() => {
            setCurrentTime(new Date());
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            // Minimum loading time to show skeleton
            const [response] = await Promise.all([
                api.get("/rekap-ikd/dashboard-stats"),
                new Promise(resolve => setTimeout(resolve, 1000))
            ]);

            if (response.data && response.data.success) {
                setStats(response.data.data);
            } else {
                setError("Gagal memuat data dashboard");
            }
        } catch (err: any) {
            console.error("Error fetching dashboard stats:", err);
            setError(err?.response?.data?.message || "Terjadi kesalahan saat memuat data");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchDashboardData();
        // Refresh every 30 seconds for online/offline status
        const interval = setInterval(fetchDashboardData, 30000);
        return () => clearInterval(interval);
    }, []);

    // Theme detection for charts
    useEffect(() => {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.attributeName === 'class') {
                    setIsDarkMode(document.documentElement.classList.contains('dark'));
                }
            });
        });

        observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ['class'],
        });

        return () => observer.disconnect();
    }, []);

    // Helper to get Unit Display Name
    const getUnitDisplayName = (role: string) => {
        if (!role) return "";
        const roleMapping: { [key: string]: string } = {
            akademik: "Akademik",
            tim_akademik: "Tim Akademik",
            dosen: "Dosen",
            aik: "AIK",
            meu: "MEU",
            profesi: "Profesi",
            kemahasiswaan: "Kemahasiswaan",
            sdm: "SDM",
            upt_jurnal: "UPT Jurnal",
            upt_ppm: "UPT PPM",
            verifikator: "Verifikator",
            ketua_ikd: "Ketua IKD",
        };
        return roleMapping[role] || role.toUpperCase();
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

    if (loading && !stats) {
        return (
            <div className="min-h-screen bg-gray-50/50 dark:bg-[#1a1c23] p-6 lg:p-8 space-y-8 font-sans">
                {/* Header Skeleton */}
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <div className="space-y-3">
                        <SkeletonLine width="w-64" height="h-8" />
                        <SkeletonLine width="w-40" height="h-4" />
                    </div>
                    <div className="text-right space-y-2">
                        <div className="ml-auto">
                            <SkeletonLine width="w-32" height="h-4" />
                        </div>
                        <div className="ml-auto mt-1">
                            <SkeletonLine width="w-24" height="h-8" />
                        </div>
                    </div>
                </div>

                {/* Stats Skeleton */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="group relative overflow-hidden rounded-2xl bg-white p-6 shadow-sm border border-gray-100 dark:border-gray-700 dark:bg-gray-800">
                            <div className="absolute top-0 right-0 w-20 h-20 bg-gray-100 dark:bg-gray-700/50 rounded-full -mr-10 -mt-10 animate-pulse"></div>
                            <div className="relative">
                                <div className="p-3 bg-gray-100 dark:bg-gray-700/50 rounded-xl w-fit mb-4 animate-pulse">
                                    <div className="w-6 h-6"></div>
                                </div>
                                <div className="space-y-2">
                                    <SkeletonLine width="w-32" height="h-4" />
                                    <SkeletonLine width="w-16" height="h-8" />
                                    <SkeletonLine width="w-48" height="h-3" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50/50 dark:bg-[#1a1c23] p-6 lg:p-8 space-y-8 font-sans">

            {/* Header Section */}
            <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white dark:bg-gray-800 p-6 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700"
            >
                <div>
                    <h1 className="text-2xl lg:text-3xl font-bold text-gray-900 dark:text-white">
                        Dashboard {getUnitDisplayName(user.role)}
                    </h1>
                    <p className="text-gray-500 dark:text-gray-400 mt-1">
                        Selamat datang kembali, <span className="font-semibold text-gray-800 dark:text-gray-200">{user.name}</span>
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-sm text-gray-500 dark:text-gray-400 font-medium">
                        {currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                    </div>
                    <div className="text-2xl font-mono text-gray-800 dark:text-gray-200 font-bold tracking-tight">
                        {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                </div>
            </motion.div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6">
                {/* Card 1: Total Pedoman (Unit Wide) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition-shadow"
                >
                    <div className="relative z-10">
                        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl w-fit mb-4">
                            <FontAwesomeIcon icon={faBook} className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Target Unit</h3>
                        <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{stats?.total_pedoman || 0}</p>
                        <p className="text-xs text-gray-400 mt-2">Keseluruhan target instrumen unit</p>
                    </div>
                </motion.div>

                {/* Card 2: Total Rekap (Unit Wide) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition-shadow"
                >
                    <div className="relative z-10">
                        <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl w-fit mb-4">
                            <FontAwesomeIcon icon={faClipboardCheck} className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Total Terisi Unit</h3>
                        <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">{stats?.total_rekap || 0}</p>
                        <p className="text-xs text-gray-400 mt-2">Data rekapitulasi unit yang telah diinput</p>
                    </div>
                </motion.div>

                {/* Card 3: Target Per Akun (Individual Baseline) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition-shadow"
                >
                    <div className="relative z-10">
                        <div className="p-3 bg-indigo-50 dark:bg-indigo-900/20 rounded-xl w-fit mb-4">
                            <FontAwesomeIcon icon={faUsers} className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Target Per Akun</h3>
                        <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">
                            {stats?.unit_accounts?.length
                                ? Math.ceil(stats.total_pedoman / stats.unit_accounts.length)
                                : 0}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">Beban target per akun {getUnitDisplayName(user.role)}</p>
                    </div>
                </motion.div>

                {/* Card 4: Rekap Terisi Saya (Personal realization) */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.25 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition-shadow"
                >
                    <div className="relative z-10">
                        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl w-fit mb-4">
                            <FontAwesomeIcon icon={faClipboardCheck} className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <h3 className="text-gray-500 dark:text-gray-400 text-sm font-medium">Rekap Terisi Saya</h3>
                        <p className="text-3xl font-bold text-gray-800 dark:text-white mt-1">
                            {stats?.unit_accounts?.find(acc => acc.id === user.id)?.realization || 0}
                        </p>
                        <p className="text-xs text-gray-400 mt-2">Data yang sudah Anda input</p>
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700 relative overflow-hidden group hover:shadow-md transition-shadow flex flex-col min-h-[280px]"
                >
                    <div className="mb-4 flex items-center justify-between">
                        <div className="flex flex-col">
                            <h3 className="text-gray-800 dark:text-white text-sm font-bold">Status Online Unit</h3>
                            <span className="text-[10px] text-gray-500 dark:text-gray-400 font-medium">
                                {stats?.unit_accounts?.length || 0} Total Akun
                            </span>
                        </div>
                        {stats?.unit_accounts && stats.unit_accounts.length > ACCOUNTS_PER_PAGE && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setAccountPage(p => Math.max(0, p - 1))}
                                    disabled={accountPage === 0}
                                    className={`p-1.5 rounded-lg border transition-all ${accountPage === 0 ? 'text-gray-300 border-gray-100 dark:text-gray-700 dark:border-gray-800 cursor-not-allowed' : 'text-gray-600 border-gray-200 hover:bg-gray-50 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-800'}`}
                                >
                                    <FontAwesomeIcon icon={faChevronLeft} className="w-3 h-3" />
                                </button>
                                <button
                                    onClick={() => setAccountPage(p => Math.min(Math.ceil((stats?.unit_accounts?.length || 0) / ACCOUNTS_PER_PAGE) - 1, p + 1))}
                                    disabled={accountPage >= Math.ceil((stats?.unit_accounts?.length || 0) / ACCOUNTS_PER_PAGE) - 1}
                                    className={`p-1.5 rounded-lg border transition-all ${accountPage >= Math.ceil((stats?.unit_accounts?.length || 0) / ACCOUNTS_PER_PAGE) - 1 ? 'text-gray-300 border-gray-100 dark:text-gray-700 dark:border-gray-800 cursor-not-allowed' : 'text-gray-600 border-gray-200 hover:bg-gray-50 dark:text-gray-400 dark:border-gray-700 dark:hover:bg-gray-800'}`}
                                >
                                    <FontAwesomeIcon icon={faChevronRight} className="w-3 h-3" />
                                </button>
                            </div>
                        )}
                    </div>

                    <div className="flex-1 space-y-4">
                        {stats?.unit_accounts && stats.unit_accounts.length > 0 ? (
                            getSortedAccounts()
                                .slice(accountPage * ACCOUNTS_PER_PAGE, (accountPage + 1) * ACCOUNTS_PER_PAGE)
                                .map((acc) => (
                                    <div key={acc.id} className="flex items-center justify-between group/item">
                                        <div className="flex items-center gap-3.5">
                                            <div className="w-10 h-10 rounded-xl bg-gray-50 dark:bg-gray-800/50 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm font-black ring-1 ring-gray-200/50 dark:ring-gray-700 group-hover/item:ring-blue-400 group-hover/item:bg-blue-50 dark:group-hover/item:bg-blue-900/10 transition-all duration-300">
                                                {acc.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-xs font-bold text-gray-800 dark:text-gray-200 truncate max-w-[110px]">
                                                    {acc.name}
                                                </span>
                                                <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate max-w-[110px]">
                                                    {acc.username ? `@${acc.username}` : acc.email}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 bg-gray-50 dark:bg-white/[0.02] px-2 py-1 rounded-full border border-gray-100 dark:border-gray-800/50">
                                            <div className={`w-1.5 h-1.5 rounded-full ${acc.is_logged_in ? 'bg-green-500 animate-pulse' : 'bg-gray-300 dark:bg-gray-600'}`}></div>
                                            <span className={`text-[9px] font-bold uppercase tracking-wider ${acc.is_logged_in ? 'text-green-600 dark:text-green-400' : 'text-gray-400 dark:text-gray-500'}`}>
                                                {acc.is_logged_in ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                        ) : (
                            <div className="text-center py-4">
                                <p className="text-xs text-gray-400 font-medium italic">Tidak ada akun ditemukan.</p>
                            </div>
                        )}
                    </div>

                    {stats?.unit_accounts && stats.unit_accounts.length > ACCOUNTS_PER_PAGE && (
                        <div className="mt-4 pt-4 border-t border-gray-50 dark:border-gray-800/50 flex justify-center">
                            <span className="text-[10px] font-bold text-gray-400 dark:text-gray-500 space-x-1">
                                <span>Halaman</span>
                                <span className="text-blue-500">{accountPage + 1}</span>
                                <span>dari</span>
                                <span>{Math.ceil(stats.unit_accounts.length / ACCOUNTS_PER_PAGE)}</span>
                            </span>
                        </div>
                    )}
                </motion.div>
            </div>

            {/* Visualisasi Kemajuan Akun (Bar Chart) */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-sm border border-gray-100 dark:border-gray-700"
            >
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">Visualisasi Kemajuan Akun</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Kemajuan pengerjaan instrumen untuk masing-masing administrator {getUnitDisplayName(user.role)}</p>
                    </div>
                </div>

                <div className="w-full">
                    {stats?.unit_accounts && stats.unit_accounts.length > 0 ? (
                        <Chart
                            options={{
                                chart: {
                                    type: 'bar',
                                    toolbar: { show: false },
                                    foreColor: 'currentColor'
                                },
                                plotOptions: {
                                    bar: {
                                        horizontal: true,
                                        borderRadius: 4,
                                        barHeight: '60%',
                                        distributed: true,
                                        dataLabels: {
                                            position: 'top',
                                        },
                                    }
                                },
                                colors: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899'],
                                dataLabels: {
                                    enabled: true,
                                    formatter: (val: any, { dataPointIndex }: any) => {
                                        const acc = stats.unit_accounts[dataPointIndex];
                                        const target = stats.unit_accounts?.length
                                            ? Math.ceil(stats.total_pedoman / stats.unit_accounts.length)
                                            : 0;
                                        const pct = target > 0 ? ((val / target) * 100).toFixed(2) : '0';
                                        return `${val.toLocaleString('id-ID')} / ${target.toLocaleString('id-ID')} (${pct}%)`;
                                    },
                                    style: {
                                        fontSize: '11px',
                                        fontWeight: 800,
                                        colors: [isDarkMode ? '#fff' : '#475569']
                                    },
                                    offsetX: 10,
                                    textAnchor: 'start'
                                },
                                xaxis: {
                                    categories: stats.unit_accounts.map(acc => acc.name),
                                    max: stats.unit_accounts?.length
                                        ? Math.ceil(stats.total_pedoman / stats.unit_accounts.length)
                                        : 100,
                                    labels: {
                                        formatter: (val: any) => val.toLocaleString('id-ID'),
                                        style: {
                                            fontWeight: 500,
                                            colors: isDarkMode ? '#94a3b8' : '#64748b'
                                        }
                                    },
                                    axisBorder: { show: false },
                                    axisTicks: { show: false }
                                },
                                yaxis: {
                                    labels: {
                                        style: {
                                            fontWeight: 600,
                                            fontSize: '12px',
                                            colors: isDarkMode ? '#f1f5f9' : '#1e293b'
                                        }
                                    }
                                },
                                grid: {
                                    borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
                                    strokeDashArray: 4,
                                    xaxis: { lines: { show: true } },
                                    yaxis: { lines: { show: false } }
                                },
                                states: {
                                    hover: {
                                        filter: {
                                            type: 'lighten',
                                            // @ts-ignore
                                            value: 0.1,
                                        }
                                    },
                                    active: {
                                        filter: {
                                            type: 'none'
                                        }
                                    }
                                },
                                tooltip: {
                                    theme: isDarkMode ? 'dark' : 'light',
                                    style: {
                                        fontSize: '12px',
                                        fontFamily: 'inherit'
                                    },
                                    onDatasetHover: {
                                        highlightDataSeries: true,
                                    },
                                    x: { show: true },
                                    y: {
                                        formatter: (val: any, { seriesIndex, dataPointIndex, w }: any) => {
                                            const acc = stats.unit_accounts[dataPointIndex];
                                            const target = stats.unit_accounts?.length
                                                ? Math.ceil(stats.total_pedoman / stats.unit_accounts.length)
                                                : 0;
                                            return `${acc.realization || 0} / ${target} Instrumen (${((val / target) * 100).toFixed(2)}%)`;
                                        }
                                    },
                                    marker: { show: false }
                                },
                                legend: { show: false }
                            }}
                            series={[{
                                name: 'Realisasi',
                                data: stats.unit_accounts.map(acc => acc.realization || 0)
                            }]}
                            type="bar"
                            height={Math.max(stats.unit_accounts.length * 60, 300)}
                        />
                    ) : (
                        <div className="text-center py-20 bg-gray-50/50 dark:bg-gray-900/30 rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800">
                            <p className="text-gray-400">Belum ada data visualisasi</p>
                        </div>
                    )}
                </div>
            </motion.div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 3px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-track-piece {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #e2e8f0;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155;
                }
            `}</style>
        </div>
    );
};

export default DashboardUnitIKD;
