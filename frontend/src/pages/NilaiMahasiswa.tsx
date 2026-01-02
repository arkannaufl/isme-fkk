import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faGraduationCap,
  faBookOpen,
  faCheckCircle,
  faTimesCircle,
  faChartLine,
  faSearch,
  faFilter,
  faDownload,
  faUserCheck,
  faUserTimes,
} from "@fortawesome/free-solid-svg-icons";
import api, { handleApiError, getUser } from "../utils/api";

interface ScoreSummary {
  ipk: number;
  total_sks: number;
  matkul_lulus: number;
  matkul_tidak_lulus: number;
  total_matkul: number;
  nilai_per_matkul?: NilaiMataKuliah[];
}

interface AttendanceSummary {
  mata_kuliah_kode: string;
  total_pertemuan: number;
  hadir: number;
  tidak_hadir: number;
  persentase: number;
}

interface NilaiMataKuliah {
  mata_kuliah_kode: string;
  mata_kuliah_nama: string;
  sks: number;
  semester: number;
  jenis: string;
  nilai_akhir?: number;
  nilai_huruf?: string;
  status: "lulus" | "tidak_lulus" | "belum_dinilai";
  nilai_detail?: Array<{
    jenis: string;
    nilai: number;
    tanggal: string;
  }>;
  // Attendance data
  total_pertemuan?: number;
  hadir?: number;
  tidak_hadir?: number;
  persentase_kehadiran?: number;
}

interface NilaiDetail {
  jenis: string;
  nama: string;
  nilai?: number;
  nilai_huruf?: string;
  tanggal?: string;
  keterangan?: string;
}

const NilaiMahasiswa: React.FC = () => {
  const [user, setUser] = useState<any>(null);
  const [scoreSummary, setScoreSummary] = useState<ScoreSummary | null>(null);
  const [nilaiMataKuliah, setNilaiMataKuliah] = useState<NilaiMataKuliah[]>([]);
  const [attendanceSummary, setAttendanceSummary] = useState<AttendanceSummary[]>([]);
  const [nilaiDetail, setNilaiDetail] = useState<NilaiDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSemester, setFilterSemester] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [expandedMatkul, setExpandedMatkul] = useState<string | null>(null);

  useEffect(() => {
    fetchUserData();
  }, []);

  const fetchUserData = async () => {
    try {
      setLoading(true);
      const userData = await getUser();
      setUser(userData);
      
      if (userData?.id) {
        await Promise.all([
          fetchScoreSummary(userData.id),
          fetchAttendanceSummary(userData.id),
        ]);
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  };

  const fetchScoreSummary = async (userId: number) => {
    try {
      const response = await api.get(`/mahasiswa/${userId}/score-summary`);
      if (response.data?.data) {
        setScoreSummary(response.data.data);
        // Set nilai mata kuliah dari response
        if (response.data.data.nilai_per_matkul) {
          setNilaiMataKuliah(response.data.data.nilai_per_matkul);
        }
      }
    } catch (error) {
      console.error("Error fetching score summary:", error);
      // Set default values jika API belum ready
      setScoreSummary({
        ipk: 0,
        total_sks: 0,
        matkul_lulus: 0,
        matkul_tidak_lulus: 0,
        total_matkul: 0,
      });
      setNilaiMataKuliah([]);
    }
  };

  const fetchAttendanceSummary = async (userId: number) => {
    try {
      const response = await api.get(`/mahasiswa/${userId}/attendance-summary`);
      if (response.data?.data) {
        setAttendanceSummary(response.data.data);
        
        // Merge attendance data dengan nilai mata kuliah
        setNilaiMataKuliah((prev) => {
          return prev.map((nilai) => {
            const attendance = response.data.data.find(
              (att: AttendanceSummary) => att.mata_kuliah_kode === nilai.mata_kuliah_kode
            );
            if (attendance) {
              return {
                ...nilai,
                total_pertemuan: attendance.total_pertemuan,
                hadir: attendance.hadir,
                tidak_hadir: attendance.tidak_hadir,
                persentase_kehadiran: attendance.persentase,
              };
            }
            return nilai;
          });
        });
      }
    } catch (error) {
      console.error("Error fetching attendance summary:", error);
      setAttendanceSummary([]);
    }
  };

  const filteredNilai = nilaiMataKuliah.filter((nilai) => {
    const matchesSearch =
      nilai.mata_kuliah_kode.toLowerCase().includes(searchTerm.toLowerCase()) ||
      nilai.mata_kuliah_nama.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesSemester =
      filterSemester === "all" || nilai.semester.toString() === filterSemester;
    
    const matchesStatus =
      filterStatus === "all" || nilai.status === filterStatus;

    return matchesSearch && matchesSemester && matchesStatus;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case "lulus":
        return "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400";
      case "tidak_lulus":
        return "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300";
    }
  };

  const getNilaiColor = (nilai?: number) => {
    if (!nilai) return "text-gray-500";
    if (nilai >= 85) return "text-green-600 dark:text-green-400";
    if (nilai >= 75) return "text-blue-600 dark:text-blue-400";
    if (nilai >= 65) return "text-yellow-600 dark:text-yellow-400";
    if (nilai >= 55) return "text-orange-600 dark:text-orange-400";
    return "text-red-600 dark:text-red-400";
  };

  const getNilaiHurufColor = (huruf?: string) => {
    if (!huruf) return "text-gray-500";
    if (huruf.startsWith("A")) return "text-green-600 dark:text-green-400 font-semibold";
    if (huruf.startsWith("B")) return "text-blue-600 dark:text-blue-400 font-semibold";
    if (huruf.startsWith("C")) return "text-yellow-600 dark:text-yellow-400 font-semibold";
    if (huruf.startsWith("D")) return "text-orange-600 dark:text-orange-400 font-semibold";
    return "text-red-600 dark:text-red-400 font-semibold";
  };

  // Skeleton Loader
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-6 w-20 bg-gray-300 dark:bg-gray-600 rounded mb-4 animate-pulse"></div>
            <div className="h-10 w-64 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
            <div className="h-4 w-96 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
          </div>

          {/* Summary Cards Skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {Array.from({ length: 4 }).map((_, i) => (
              <div
                key={i}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="h-5 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                  <div className="h-8 w-8 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"></div>
                </div>
                <div className="h-8 w-20 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
                <div className="h-4 w-40 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
              </div>
            ))}
          </div>

          {/* Filters Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
                <div className="h-12 w-full bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse"></div>
              </div>
              <div>
                <div className="h-4 w-20 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
                <div className="h-12 w-full bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse"></div>
              </div>
            </div>
          </div>

          {/* Table Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <div className="h-6 w-48 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    {Array.from({ length: 6 }).map((_, i) => (
                      <th key={i} className="px-6 py-3">
                        <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <tr key={index}>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <td key={i} className="px-6 py-4">
                          <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center gap-2 mb-2">
            <FontAwesomeIcon
              icon={faGraduationCap}
              className="text-gray-500 dark:text-gray-400"
            />
            <span className="text-sm text-gray-500 dark:text-gray-400">
              Akademik
            </span>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Nilai Akademik
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Lihat semua nilai yang telah Anda peroleh selama masa studi
          </p>
        </motion.div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                IPK
              </h3>
              <div className="h-10 w-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faChartLine}
                  className="text-blue-600 dark:text-blue-400"
                />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <p className={`text-3xl font-bold ${getNilaiColor(scoreSummary?.ipk ? scoreSummary.ipk * 25 : undefined)}`}>
                {scoreSummary?.ipk ? scoreSummary.ipk.toFixed(2) : "0.00"}
              </p>
              <span className="text-sm text-gray-500 dark:text-gray-400">
                / 4.00
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Indeks Prestasi Kumulatif
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Total SKS
              </h3>
              <div className="h-10 w-10 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faBookOpen}
                  className="text-purple-600 dark:text-purple-400"
                />
              </div>
            </div>
            <p className="text-3xl font-bold text-gray-900 dark:text-white">
              {scoreSummary?.total_sks || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Satuan Kredit Semester
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Mata Kuliah Lulus
              </h3>
              <div className="h-10 w-10 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className="text-green-600 dark:text-green-400"
                />
              </div>
            </div>
            <p className="text-3xl font-bold text-green-600 dark:text-green-400">
              {scoreSummary?.matkul_lulus || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              dari {scoreSummary?.total_matkul || 0} mata kuliah
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.4 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-gray-600 dark:text-gray-400">
                Tidak Lulus
              </h3>
              <div className="h-10 w-10 bg-red-100 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faTimesCircle}
                  className="text-red-600 dark:text-red-400"
                />
              </div>
            </div>
            <p className="text-3xl font-bold text-red-600 dark:text-red-400">
              {scoreSummary?.matkul_tidak_lulus || 0}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Perlu perbaikan
            </p>
          </motion.div>
        </div>

        {/* Filters */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cari Mata Kuliah
              </label>
              <div className="relative">
                <FontAwesomeIcon
                  icon={faSearch}
                  className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-400"
                />
                <input
                  type="text"
                  placeholder="Cari berdasarkan kode atau nama mata kuliah..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Filter Semester
              </label>
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Semua Semester</option>
                {Array.from({ length: 8 }, (_, i) => i + 1).map((sem) => (
                  <option key={sem} value={sem.toString()}>
                    Semester {sem}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Filter Status
              </label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="all">Semua Status</option>
                <option value="lulus">Lulus</option>
                <option value="tidak_lulus">Tidak Lulus</option>
                <option value="belum_dinilai">Belum Dinilai</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.6 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              Daftar Nilai Mata Kuliah
            </h2>
            <button className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors">
              <FontAwesomeIcon icon={faDownload} />
              Export
            </button>
          </div>

          {filteredNilai.length === 0 ? (
            <div className="p-12 text-center">
              <FontAwesomeIcon
                icon={faBookOpen}
                className="text-6xl text-gray-300 dark:text-gray-600 mb-4"
              />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Belum ada data nilai
              </h3>
              <p className="text-gray-500 dark:text-gray-400">
                Nilai akan muncul setelah dosen melakukan penilaian
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700/50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Mata Kuliah
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Semester
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      SKS
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Nilai Angka
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Nilai Huruf
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Absensi
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredNilai.map((nilai) => (
                    <React.Fragment key={nilai.id}>
                      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {nilai.mata_kuliah_kode}
                            </div>
                            <div className="text-sm text-gray-500 dark:text-gray-400">
                              {nilai.mata_kuliah_nama}
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-3 py-1 text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                            Semester {nilai.semester}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {nilai.sks} SKS
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`text-sm font-medium ${
                              nilai.nilai_akhir
                                ? getNilaiColor(nilai.nilai_akhir)
                                : "text-gray-400"
                            }`}
                          >
                            {nilai.nilai_akhir
                              ? nilai.nilai_akhir.toFixed(2)
                              : "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`text-sm font-medium ${
                              nilai.nilai_huruf
                                ? getNilaiHurufColor(nilai.nilai_huruf)
                                : "text-gray-400"
                            }`}
                          >
                            {nilai.nilai_huruf || "-"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {nilai.total_pertemuan !== undefined ? (
                            <div className="flex flex-col gap-1">
                              <div className="flex items-center gap-2">
                                <FontAwesomeIcon
                                  icon={faUserCheck}
                                  className={`text-xs ${
                                    nilai.persentase_kehadiran && nilai.persentase_kehadiran >= 75
                                      ? "text-green-600 dark:text-green-400"
                                      : nilai.persentase_kehadiran && nilai.persentase_kehadiran >= 50
                                      ? "text-yellow-600 dark:text-yellow-400"
                                      : "text-red-600 dark:text-red-400"
                                  }`}
                                />
                                <span className="text-xs text-gray-900 dark:text-white">
                                  {nilai.hadir || 0}/{nilai.total_pertemuan}
                                </span>
                              </div>
                              <span
                                className={`text-xs font-medium ${
                                  nilai.persentase_kehadiran && nilai.persentase_kehadiran >= 75
                                    ? "text-green-600 dark:text-green-400"
                                    : nilai.persentase_kehadiran && nilai.persentase_kehadiran >= 50
                                    ? "text-yellow-600 dark:text-yellow-400"
                                    : "text-red-600 dark:text-red-400"
                                }`}
                              >
                                {nilai.persentase_kehadiran?.toFixed(1) || 0}%
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-3 py-1 text-xs font-medium rounded-full ${getStatusColor(
                              nilai.status
                            )}`}
                          >
                            {nilai.status === "lulus"
                              ? "Lulus"
                              : nilai.status === "tidak_lulus"
                              ? "Tidak Lulus"
                              : "Belum Dinilai"}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() =>
                              setExpandedMatkul(
                                expandedMatkul === nilai.mata_kuliah_kode ? null : nilai.mata_kuliah_kode
                              )
                            }
                            className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
                          >
                            {expandedMatkul === nilai.mata_kuliah_kode ? "Sembunyikan" : "Detail"}
                          </button>
                        </td>
                      </tr>
                      {expandedMatkul === nilai.mata_kuliah_kode && (
                        <tr>
                          <td colSpan={8} className="px-6 py-4 bg-gray-50 dark:bg-gray-700/30">
                            <div className="space-y-4">
                              <h4 className="font-medium text-gray-900 dark:text-white mb-4">
                                Detail Penilaian
                              </h4>
                              {nilai.nilai_detail && nilai.nilai_detail.length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                  {nilai.nilai_detail.map((detail, idx) => (
                                    <div
                                      key={idx}
                                      className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700"
                                    >
                                      <div className="flex justify-between items-start mb-2">
                                        <div>
                                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                                            {detail.jenis}
                                          </p>
                                        </div>
                                        <span
                                          className={`text-lg font-bold ${getNilaiColor(
                                            detail.nilai
                                          )}`}
                                        >
                                          {detail.nilai.toFixed(2)}
                                        </span>
                                      </div>
                                      {detail.tanggal && (
                                        <p className="text-xs text-gray-500 dark:text-gray-400">
                                          {new Date(detail.tanggal).toLocaleDateString("id-ID")}
                                        </p>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-gray-500 dark:text-gray-400">
                                  Belum ada detail penilaian
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default NilaiMahasiswa;

