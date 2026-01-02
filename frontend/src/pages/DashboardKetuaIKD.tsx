import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChartLine,
    faUsers,
    faClipboardCheck,
    faCalendarAlt,
    faFilter,
    faCheckCircle,
    faExclamationTriangle,
    faInfoCircle,
    faDownload,
    faExternalLinkAlt,
    faUserShield
} from "@fortawesome/free-solid-svg-icons";
import api from "../utils/api";
import Chart from "react-apexcharts";

interface UnitProgress {
    unit: string;
    target: number;
    realization: number;
    percentage: number;
}

interface UnitAccount {
    id: number;
    name: string;
    email: string;
    username: string;
    role: string;
    is_logged_in: boolean;
    created_at: string;
}

interface DashboardStats {
    unit: string;
    total_pedoman: number;
    total_rekap: number;
    unit_progress: UnitProgress[];
    unit_accounts: UnitAccount[];
}

const DashboardKetuaIKD: React.FC = () => {
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [user, setUser] = useState<any>(null);
    const [isDarkMode, setIsDarkMode] = useState(document.documentElement.classList.contains('dark'));

    useEffect(() => {
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
        setUser(userData);

        const fetchStats = async () => {
            try {
                const res = await api.get("/rekap-ikd/dashboard-stats");
                if (res.data?.success) {
                    setStats(res.data.data);
                }
            } catch (error) {
                console.error("Error fetching stats:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        const statsTimer = setInterval(fetchStats, 10000);

        return () => {
            clearInterval(timer);
            clearInterval(statsTimer);
        };
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

    if (loading && !stats) {
        return (
            <div className="min-h-screen bg-gray-50 flex items-center justify-center">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-500 font-medium">Memuat Dashboard...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6 lg:p-8 font-sans">

            {/* Standard Header Section */}
            <div className="mb-6">
                <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-5 md:p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex items-center space-x-4">
                            <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center shadow-lg">
                                <FontAwesomeIcon icon={faUserShield} className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                                    Dashboard Ketua IKD
                                </h1>
                                <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                                    Selamat datang kembali, <span className="font-semibold text-gray-800 dark:text-gray-200">{user?.name}</span>. Ringkasan data instrumen dan verifikasi semua unit.
                                </p>
                            </div>
                        </div>
                        <div className="mt-4 sm:mt-0 text-right">
                            <div className="text-sm font-medium text-gray-500 dark:text-gray-400">
                                {currentTime.toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </div>
                            <div className="text-xl font-bold text-gray-900 dark:text-white mt-1">
                                {currentTime.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Standard Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 mb-8">
                {/* Total Target Card */}
                <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-2xl flex items-center justify-center">
                            <FontAwesomeIcon icon={faChartLine} className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">Target</span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 tracking-tight">Total Instrumen Target (Semua Unit)</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                            {stats?.total_pedoman?.toLocaleString('id-ID') || 0}
                        </p>
                    </div>
                </div>

                {/* Achievement Card */}
                <div className="bg-white dark:bg-white/[0.03] rounded-2xl p-6 shadow-sm border border-gray-200 dark:border-gray-800">
                    <div className="flex items-center justify-between mb-4">
                        <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-2xl flex items-center justify-center">
                            <FontAwesomeIcon icon={faClipboardCheck} className="w-6 h-6 text-green-600 dark:text-green-400" />
                        </div>
                        <span className="text-xs font-medium text-gray-400 uppercase tracking-widest">Actual</span>
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500 dark:text-gray-400 tracking-tight">Total Rekap Terisi (Semua Unit)</p>
                        <p className="text-3xl font-bold text-gray-900 dark:text-white mt-1">
                            {stats?.total_rekap?.toLocaleString('id-ID') || 0}
                        </p>
                    </div>
                </div>
            </div>

            {/* Unit Progress Chart Section */}
            <div className="mb-4">

                <div className="bg-white dark:bg-white/[0.03] rounded-3xl p-6 shadow-sm border border-gray-100 dark:border-gray-800">
                    {/* Title inside card */}
                    <div className="mb-6">
                        <h2 className="text-xl font-bold text-gray-900 dark:text-white tracking-tight">Capaian Instrumen Per Unit Kerja</h2>
                        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 uppercase tracking-widest font-medium opacity-80">Ringkasan kemajuan pengerjaan di setiap unit</p>
                    </div>
                    {stats?.unit_progress && stats.unit_progress.length > 0 ? (
                        <div className="h-[400px] w-full">
                            <Chart
                                options={{
                                    chart: {
                                        type: 'bar',
                                        toolbar: { show: false },
                                        zoom: { enabled: false },
                                        fontFamily: 'Inter, sans-serif'
                                    },
                                    plotOptions: {
                                        bar: {
                                            borderRadius: 8,
                                            columnWidth: '40%',
                                            distributed: false,
                                            dataLabels: { position: 'top' }
                                        }
                                    },
                                    dataLabels: {
                                        enabled: true,
                                        formatter: (val) => `${val}%`,
                                        offsetY: -20,
                                        style: {
                                            fontSize: '12px',
                                            fontWeight: 700,
                                            colors: [isDarkMode ? '#fff' : '#1e293b']
                                        }
                                    },
                                    colors: ['#3b82f6'],
                                    xaxis: {
                                        categories: stats.unit_progress.map(u => u.unit),
                                        axisBorder: { show: false },
                                        axisTicks: { show: false },
                                        labels: {
                                            style: {
                                                colors: isDarkMode ? 'rgba(255,255,255,0.5)' : '#64748b',
                                                fontSize: '12px',
                                                fontWeight: 500
                                            }
                                        }
                                    },
                                    yaxis: {
                                        max: 100,
                                        labels: {
                                            formatter: (val) => `${val}%`,
                                            style: {
                                                colors: isDarkMode ? 'rgba(255,255,255,0.4)' : '#94a3b8',
                                            }
                                        }
                                    },
                                    grid: {
                                        borderColor: isDarkMode ? 'rgba(255,255,255,0.05)' : '#f1f5f9',
                                        strokeDashArray: 4,
                                        padding: { top: 20 }
                                    },
                                    tooltip: {
                                        theme: isDarkMode ? 'dark' : 'light',
                                        y: {
                                            formatter: (val, { dataPointIndex }) => {
                                                const unit = stats.unit_progress[dataPointIndex];
                                                return `${val}% (${unit.realization.toLocaleString('id-ID')} / ${unit.target.toLocaleString('id-ID')})`;
                                            }
                                        }
                                    }
                                }}
                                series={[{
                                    name: 'Pencapaian',
                                    data: stats.unit_progress.map(u => u.target > 0 ? Math.round((u.realization / u.target) * 100) : 0)
                                }]}
                                type="bar"
                                height="100%"
                            />
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <p className="text-gray-400 font-medium">Data kemajuan unit tidak ditemukan</p>
                        </div>
                    )}
                </div>
            </div>

            <style>{`
                .custom-scrollbar::-webkit-scrollbar {
                    width: 5px;
                }
                .custom-scrollbar::-webkit-scrollbar-track {
                    background: transparent;
                }
                .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #E2E8F0;
                    border-radius: 10px;
                }
                .dark .custom-scrollbar::-webkit-scrollbar-thumb {
                    background: #334155;
                }
            `}</style>
        </div>
    );
};

export default DashboardKetuaIKD;
