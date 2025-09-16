import React, { useState, useEffect } from 'react';
import api, { handleApiError } from '../utils/api';
import {
  DownloadIcon,
  UserCircleIcon,
  PieChartIcon,
  CalenderIcon,
  HorizontaLDots,
  DocsIcon,
} from '../icons';

interface ActivityLog {
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
    }
  } | null;
  created_at: string;
  causer?: {
    id: number;
    name: string;
  };
}

interface SummaryData {
  total_activities: number;
  activities_by_action: Array<{ action: string; count: number }>;
  activities_by_module: Array<{ module: string; count: number }>;
  activities_by_date: Array<{ date: string; count: number }>;
  top_users: Array<{ user_id: number; count: number; causer?: { id: number; name: string } }>;
  modul_terbanyak?: string;
  user_terbanyak?: { name: string; count: number };
  activities_today?: number;
}

const SKELETON_ROWS = 6;

// Helper untuk menampilkan perubahan data
const renderChanges = (properties: ActivityLog['properties']) => {
  if (!properties || (!properties.old && !properties.attributes)) {
    return null;
  }

  const changes = properties.attributes ? Object.keys(properties.attributes) : [];
  if (changes.length === 0) return null;

  return (
    <div className="text-xs text-gray-500 dark:text-gray-400 mt-1 pl-4 border-l-2 border-gray-200 dark:border-gray-700">
      <ul className="list-disc pl-4 space-y-1">
        {changes.map(key => {
          const oldValue = properties.old?.[key] ?? '(tidak ada)';
          const newValue = properties.attributes?.[key] ?? '(tidak ada)';
          if (JSON.stringify(oldValue) !== JSON.stringify(newValue)) {
            return (
              <li key={key}>
                <span className="font-semibold">{key}:</span> {JSON.stringify(oldValue)} → {JSON.stringify(newValue)}
              </li>
            );
          }
          return null;
        })}
      </ul>
    </div>
  );
};


const Histori: React.FC = () => {
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [summary, setSummary] = useState<SummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    action: '',
    module: '',
    search: '',
    start_date: '',
    end_date: '',
  });
  const [pagination, setPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 15,
    total: 0,
  });
  const [availableFilters, setAvailableFilters] = useState({ actions: [], modules: [] });

  const fetchLogs = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        ...filters,
        page: pagination.current_page.toString(),
        per_page: pagination.per_page.toString(),
      });
      const response = await api.get(`/reporting?${params}`);
      setLogs(response.data.data.data);
      setPagination({
        current_page: response.data.data.current_page,
        last_page: response.data.data.last_page,
        per_page: response.data.data.per_page,
        total: response.data.data.total,
      });
      setAvailableFilters(response.data.filters);
    } catch (error) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSummary = async () => {
    try {
      const params = new URLSearchParams({
        start_date: filters.start_date,
        end_date: filters.end_date,
      });
      const response = await api.get(`/reporting/summary?${params}`);
      setSummary(response.data.data);
    } catch (error) {
      setSummary(null);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchSummary();
    // eslint-disable-next-line
  }, [filters, pagination.current_page]);

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setPagination(prev => ({ ...prev, current_page: 1 }));
  };

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, current_page: page }));
  };

  const handleExport = async () => {
    try {
      const params = new URLSearchParams(filters);
      const response = await api.get(`/reporting/export?${params}`);
      const blob = new Blob([JSON.stringify(response.data.data, null, 2)], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = response.data.filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      const errorMessage = handleApiError(error, 'Export Histori');
      // Bisa ditambahkan toast notification di sini
    }
  };

  const getActionColor = (action: string) => {
    if (!action) return 'bg-gray-100 text-gray-700';
    switch (action) {
      case 'created': return 'bg-green-100 text-green-700';
      case 'updated': return 'bg-blue-100 text-blue-700';
      case 'deleted': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getModuleColor = (module: string) => {
    if (!module) return 'bg-gray-100 text-gray-700';
    const moduleName = module.split('\\').pop()?.toUpperCase() || 'UNKNOWN';
    switch (moduleName) {
      case 'USER': return 'bg-indigo-100 text-indigo-700';
      case 'MATAKULIAH': return 'bg-pink-100 text-pink-700';
      case 'RUANGAN': return 'bg-orange-100 text-orange-700';
      case 'KEGIATAN': return 'bg-teal-100 text-teal-700';
      case 'AUTH': return 'bg-cyan-100 text-cyan-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  const getMethodColor = (method: string) => {
    if (!method) return 'bg-gray-100 text-gray-700';
    switch (method.toUpperCase()) {
      case 'GET': return 'bg-blue-100 text-blue-700';
      case 'POST': return 'bg-green-100 text-green-700';
      case 'PUT': return 'bg-yellow-100 text-yellow-700';
      case 'PATCH': return 'bg-orange-100 text-orange-700';
      case 'DELETE': return 'bg-red-100 text-red-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Histori Aplikasi</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Riwayat interaksi user dengan aplikasi ini</p>
        </div>
        <button
          onClick={handleExport}
          className="w-fit flex items-center gap-2 px-5 text-sm py-2 bg-brand-500 text-white rounded-lg shadow hover:bg-brand-600 transition-colors font-semibold"
        >
          <DownloadIcon className="w-5 h-5" />
          Export Data .JSON
        </button>
      </div>

      {/* Summary Cards */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div key={idx} className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4 animate-pulse">
              <div className="w-10 h-10 rounded-full bg-gray-200 dark:bg-gray-700" />
              <div className="flex-1">
                <div className="h-3 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                <div className="h-5 w-16 bg-gray-200 dark:bg-gray-700 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : summary && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
            <PieChartIcon className="w-10 h-10 text-blue-500 bg-blue-100 rounded-full p-2" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Total Aktivitas</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total_activities}</div>
            </div>
          </div>
          <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
            <UserCircleIcon className="w-10 h-10 text-green-500 bg-green-100 rounded-full p-2" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">User Aktif</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.top_users.length}</div>
            </div>
          </div>
          <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
            <HorizontaLDots className="w-10 h-10 text-purple-500 bg-purple-100 rounded-full p-2" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Modul Terbanyak</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.modul_terbanyak || '-'}
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
            <CalenderIcon className="w-10 h-10 text-orange-500 bg-orange-100 rounded-full p-2" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Aksi Terbanyak</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">
                {summary.activities_by_action[0]?.action || '-'}
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
            <UserCircleIcon className="w-10 h-10 text-indigo-500 bg-indigo-100 rounded-full p-2" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">User Terbanyak</div>
              <div className="text-lg font-bold text-gray-900 dark:text-white">
                {summary.user_terbanyak ? summary.user_terbanyak.name : '-'}
              </div>
              <div className="text-xs text-gray-500 dark:text-gray-400">
                {summary.user_terbanyak ? `${summary.user_terbanyak.count} aktivitas` : ''}
              </div>
            </div>
          </div>
          <div className="bg-white dark:bg-white/[0.03] rounded-xl shadow border border-gray-200 dark:border-white/[0.05] p-6 flex items-center gap-4">
            <CalenderIcon className="w-10 h-10 text-pink-500 bg-pink-100 rounded-full p-2" />
            <div>
              <div className="text-xs text-gray-500 dark:text-gray-400">Aktivitas Hari Ini</div>
              <div className="text-2xl font-bold text-gray-900 dark:text-white">{summary.activities_today}</div>
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
              <DocsIcon className="w-5 h-5 text-gray-400" />
            </span>
            <input
              type="text"
              placeholder="Cari aktivitas..."
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
              className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-12 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="2"/>
                <line x1="21" y1="21" x2="16.65" y2="16.65" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </span>
          </div>
          {/* Filter Group */}
          <div className="flex flex-col md:flex-row md:items-center gap-2 w-full md:w-auto justify-end">
            <select
              value={filters.action}
              onChange={e => handleFilterChange('action', e.target.value)}
              className="w-full md:w-44 h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Semua Aksi</option>
              {availableFilters.actions.map((action: string) => (
                <option key={action} value={action}>{action}</option>
              ))}
            </select>
            <select
              value={filters.module}
              onChange={e => handleFilterChange('module', e.target.value)}
              className="w-full md:w-44 h-11 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
            >
              <option value="">Semua Modul</option>
              {availableFilters.modules.map((module: string) => (
                <option key={module} value={module}>{module}</option>
              ))}
            </select>
            <input
              type="date"
              value={filters.start_date}
              onChange={e => handleFilterChange('start_date', e.target.value)}
              className="h-11 w-full md:w-28 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Dari tanggal"
            />
            <span className="self-center text-gray-400 text-sm">sampai</span>
            <input
              type="date"
              value={filters.end_date}
              onChange={e => handleFilterChange('end_date', e.target.value)}
              className="h-11 w-full md:w-28 text-sm px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white font-normal focus:outline-none focus:ring-2 focus:ring-brand-500"
              placeholder="Sampai tanggal"
            />
          </div>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto hide-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`
            .max-w-full::-webkit-scrollbar { display: none; }
            .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
            .hide-scroll::-webkit-scrollbar { display: none; }
          `}</style>
          <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
            <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Tanggal</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Jam</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">User</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Modul</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Deskripsi</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Method</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Path</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">IP Address</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Browser</th>
                <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">OS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                Array.from({ length: SKELETON_ROWS }).map((_, idx) => (
                  <tr key={idx}>
                    {Array.from({ length: 11 }).map((_, colIdx) => (
                      <td key={colIdx} className="px-6 py-4">
                        <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded animate-pulse opacity-80"></div>
                      </td>
                    ))}
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-8 text-center text-gray-400 dark:text-gray-500">Tidak ada data aktivitas</td>
                </tr>
              ) : (
                logs.map((log, idx) => {
                  const dateObj = new Date(log.created_at);
                  const tanggal = dateObj.toLocaleDateString('id-ID');
                  const jam = dateObj.toLocaleTimeString('en-GB', { hour12: false });
                  return (
                  <tr key={log.id} className={idx % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : '' + ' hover:bg-brand-50 dark:hover:bg-brand-900/10 transition-colors'}>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">{tanggal}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">{jam}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-900 dark:text-white/90">{log.causer?.name || 'System'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getActionColor(log.event || '')}`}>{log.event || 'custom'}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getModuleColor(log.subject_type || '')}`}>{log.subject_type ? log.subject_type.split('\\').pop() : 'System'}</span>
                    </td>
                    <td className="px-6 py-4 min-w-[300px] text-gray-900 dark:text-white/90" title={log.description}>
                        <div>{log.description}</div>
                        {renderChanges(log.properties)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                        {log.properties?.details?.method ? (
                          <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getMethodColor(log.properties.details.method)}`}>
                            {log.properties.details.method}
                          </span>
                        ) : (
                          <span className="text-gray-500 dark:text-gray-400">-</span>
                      )}
                    </td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400 font-mono">{log.properties?.details?.path || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{log.properties?.details?.ip_address || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{log.properties?.details?.browser || '-'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400">{log.properties?.details?.os || '-'}</td>
                  </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {pagination.last_page > 1 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-6 py-4">
            <div className="flex items-center gap-4">
              <select
                value={pagination.per_page}
                onChange={e => setPagination(prev => ({ ...prev, per_page: Number(e.target.value), current_page: 1 }))}
                className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none"
              >
                {[10, 15, 20, 50].map(opt => (
                  <option key={opt} value={opt}>{opt}</option>
                ))}
              </select>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                Menampilkan {((pagination.current_page - 1) * pagination.per_page) + 1} - {Math.min(pagination.current_page * pagination.per_page, pagination.total)} dari {pagination.total} aktivitas
              </span>
            </div>
            <div className="flex gap-1">
              <button
                onClick={() => handlePageChange(pagination.current_page - 1)}
                disabled={pagination.current_page === 1}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Prev
              </button>
              {Array.from({ length: pagination.last_page }, (_, i) => (
                <button
                  key={i}
                  onClick={() => handlePageChange(i + 1)}
                  className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 ${
                    pagination.current_page === i + 1
                      ? 'bg-brand-500 text-white'
                      : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                  } transition`}
                >
                  {i + 1}
                </button>
              ))}
              <button
                onClick={() => handlePageChange(pagination.current_page + 1)}
                disabled={pagination.current_page === pagination.last_page}
                className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Histori; 
