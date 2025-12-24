import React, { useState, useEffect } from "react";
import api from "../utils/api";

interface SemesterInfo {
  id: number;
  jenis: string;
  aktif: boolean;
}

interface TahunAjaran {
  id: number;
  tahun: string;
  aktif: boolean;
  semesters: SemesterInfo[];
}

interface SemesterInfoProps {
  showFilter?: boolean;
  onSemesterChange?: (semesterId: number | null) => void;
  className?: string;
}

export const SemesterInfo: React.FC<SemesterInfoProps> = ({
  showFilter = false,
  onSemesterChange,
  className = "",
}) => {
  const [tahunAjaran, setTahunAjaran] = useState<TahunAjaran | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedSemesterId, setSelectedSemesterId] = useState<number | null>(null);

  useEffect(() => {
    const fetchActiveSemester = async () => {
      try {
        const res = await api.get("/tahun-ajaran/active");
        setTahunAjaran(res.data);
        if (res.data?.semesters?.[0]) {
          setSelectedSemesterId(res.data.semesters[0].id);
          if (onSemesterChange) {
            onSemesterChange(res.data.semesters[0].id);
          }
        }
      } catch (error) {
        console.error("Error fetching active semester:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchActiveSemester();
  }, [onSemesterChange]);

  const activeSemester = tahunAjaran?.semesters?.find((s) => s.aktif);

  if (loading) {
    return (
      <div className={`text-sm text-gray-600 dark:text-gray-400 ${className}`}>
        Memuat semester...
      </div>
    );
  }

  if (!tahunAjaran || !activeSemester) {
    return (
      <div className={`text-sm text-red-600 dark:text-red-400 ${className}`}>
        Tidak ada semester aktif
      </div>
    );
  }

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <div className="px-3 py-1.5 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
        <div className="flex items-center gap-2">
          <svg
            className="w-4 h-4 text-blue-500"
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
          <span className="text-sm font-medium text-blue-700 dark:text-blue-300">
            Semester Aktif: {activeSemester.jenis} ({tahunAjaran.tahun})
          </span>
        </div>
      </div>

      {showFilter && tahunAjaran.semesters && tahunAjaran.semesters.length > 1 && (
        <select
          value={selectedSemesterId || ""}
          onChange={(e) => {
            const semesterId = e.target.value ? parseInt(e.target.value) : null;
            setSelectedSemesterId(semesterId);
            if (onSemesterChange) {
              onSemesterChange(semesterId);
            }
          }}
          className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">Semua Semester</option>
          {tahunAjaran.semesters.map((semester) => (
            <option key={semester.id} value={semester.id}>
              {semester.jenis} ({tahunAjaran.tahun})
            </option>
          ))}
        </select>
      )}
    </div>
  );
};

export default SemesterInfo;

