import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faUser,
  faCalendarAlt,
  faClock,
  faCheckCircle,
  faTimesCircle,
  faExclamationTriangle,
  faChartBar,
  faDownload,
  faFilter,
  faSearch,
  faSort,
  faArrowLeft,
} from "@fortawesome/free-solid-svg-icons";
import api, { handleApiError } from "../utils/api";

interface MahasiswaKeabsenan {
  id: number;
  nama: string;
  nid: string;
  nidn?: string;
  email: string;
  telp: string;
  username: string;
  semester: number;
  kelompok_kecil?: string;
  kelompok_besar?: string;
  total_kehadiran: number;
  total_absensi: number;
  total_waiting: number;
  total_schedules: number;
  persentase_kehadiran: number;
  status_kehadiran: "baik" | "kurang" | "buruk";
  detail_kehadiran: {
    id: number;
    tanggal: string;
    mata_kuliah: string;
    jenis_jadwal: string;
    jenis_detail?: string;
    status: "hadir" | "tidak_hadir" | "waiting";
    alasan?: string;
    jam_mulai: string;
    jam_selesai: string;
    ruangan: string;
    dosen: string;
    topik?: string;
    pbl_tipe?: string;
  }[];
}

const DetailMahasiswaKeabsenan: React.FC = () => {
  const [mahasiswaData, setMahasiswaData] = useState<MahasiswaKeabsenan | null>(
    null
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterJenis, setFilterJenis] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("tanggal");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetchMahasiswaData();
  }, []);

  const fetchMahasiswaData = async () => {
    try {
      setLoading(true);

      // Get current user ID from localStorage or context
      const user = JSON.parse(localStorage.getItem("user") || "{}");
      const mahasiswaId = user.id;

      if (!mahasiswaId) {
        setError("ID mahasiswa tidak ditemukan");
        return;
      }

      // Fetch data from API
      const response = await api.get(`/keabsenan-mahasiswa/${mahasiswaId}`);
      const data = response.data;

      // Transform API response to match our interface
      const transformedData: MahasiswaKeabsenan = {
        id: data.mahasiswa.id,
        nama: data.mahasiswa.nama,
        nid: data.mahasiswa.nid,
        email: data.mahasiswa.email,
        telp: data.mahasiswa.telp,
        username: data.mahasiswa.username,
        semester: data.mahasiswa.semester,
        kelompok_kecil: data.mahasiswa.kelompok_kecil,
        kelompok_besar: data.mahasiswa.kelompok_besar,
        total_kehadiran: data.statistik.total_kehadiran,
        total_absensi: data.statistik.total_absensi,
        total_waiting: data.statistik.total_waiting,
        total_schedules: data.statistik.total_schedules,
        persentase_kehadiran: data.statistik.persentase_kehadiran,
        status_kehadiran: data.statistik.status_kehadiran,
        detail_kehadiran: data.detail_kehadiran,
      };

      setMahasiswaData(transformedData);
    } catch (err) {
      setError("Gagal memuat data keabsenan mahasiswa");
      console.error("Error fetching data:", err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "hadir":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "tidak_hadir":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300";
      case "waiting":
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "hadir":
        return faCheckCircle;
      case "tidak_hadir":
        return faTimesCircle;
      case "waiting":
        return faClock;
      default:
        return faClock;
    }
  };

  const getJenisJadwalColor = (jenis: string) => {
    switch (jenis) {
      case "kuliah_besar":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
      case "praktikum":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "jurnal_reading":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300";
      case "pbl":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-300";
      case "csr":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
    }
  };

  const getJenisJadwalLabel = (jenis: string) => {
    switch (jenis) {
      case "kuliah_besar":
        return "Kuliah Besar";
      case "praktikum":
        return "Praktikum";
      case "jurnal_reading":
        return "Jurnal Reading";
      case "pbl":
        return "PBL";
      case "csr":
        return "CSR";
      default:
        return jenis;
    }
  };

  const getStatusKehadiranColor = (status: string) => {
    switch (status) {
      case "baik":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "kurang":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300";
      case "buruk":
        return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
    }
  };

  const getStatusKehadiranLabel = (status: string) => {
    switch (status) {
      case "baik":
        return "Baik";
      case "kurang":
        return "Kurang";
      case "buruk":
        return "Buruk";
      default:
        return status;
    }
  };

  const filteredKehadiran =
    mahasiswaData?.detail_kehadiran
      .filter((item) => {
        const matchesSearch =
          item.mata_kuliah.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.dosen.toLowerCase().includes(searchTerm.toLowerCase()) ||
          item.ruangan.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus =
          filterStatus === "all" || item.status === filterStatus;
        const matchesJenis =
          filterJenis === "all" || item.jenis_jadwal === filterJenis;

        return matchesSearch && matchesStatus && matchesJenis;
      })
      .sort((a, b) => {
        let comparison = 0;

        switch (sortBy) {
          case "tanggal":
            comparison =
              new Date(a.tanggal).getTime() - new Date(b.tanggal).getTime();
            break;
          case "mata_kuliah":
            comparison = a.mata_kuliah.localeCompare(b.mata_kuliah);
            break;
          case "status":
            comparison = a.status.localeCompare(b.status);
            break;
          case "jenis_jadwal":
            comparison = a.jenis_jadwal.localeCompare(b.jenis_jadwal);
            break;
          default:
            comparison = 0;
        }

        return sortOrder === "asc" ? comparison : -comparison;
      }) || [];

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("id-ID", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const exportPDF = () => {
    // TODO: Implement PDF export functionality
    console.log("Export PDF functionality will be implemented later");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">
              Memuat data keabsenan mahasiswa...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">{error}</p>
          <button
            onClick={() => window.history.back()}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  if (!mahasiswaData) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-500 dark:text-gray-400">
            Data mahasiswa tidak ditemukan
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition mb-4"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
            Kembali
          </button>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
            Detail Keabsenan Mahasiswa
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Rekapitulasi dan detail kehadiran mahasiswa dalam kegiatan akademik
          </p>
        </motion.div>

        {/* Informasi Mahasiswa */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-8"
        >
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
              <FontAwesomeIcon icon={faUser} className="w-8 h-8 text-white" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                {mahasiswaData.nama}
              </h2>
              <p className="text-gray-600 dark:text-gray-400">
                {mahasiswaData.nid} • Semester {mahasiswaData.semester}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">Email</p>
              <p className="text-gray-900 dark:text-white font-medium">
                {mahasiswaData.email}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Telepon
              </p>
              <p className="text-gray-900 dark:text-white font-medium">
                {mahasiswaData.telp}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Kelompok Kecil
              </p>
              <p className="text-gray-900 dark:text-white font-medium">
                {mahasiswaData.kelompok_kecil || "-"}
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Kelompok Besar
              </p>
              <p className="text-gray-900 dark:text-white font-medium">
                Semester {mahasiswaData.semester}
              </p>
            </div>
          </div>
        </motion.div>

        {/* Statistik Kehadiran */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-green-100 dark:bg-green-900/20 rounded-xl flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faCheckCircle}
                  className="w-6 h-6 text-green-600 dark:text-green-400"
                />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Hadir
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {mahasiswaData.total_kehadiran}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-xl flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faTimesCircle}
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Tidak Hadir
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {mahasiswaData.total_absensi}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-900/20 rounded-xl flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faClock}
                  className="w-6 h-6 text-gray-600 dark:text-gray-400"
                />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Menunggu
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {mahasiswaData.total_waiting}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faChartBar}
                  className="w-6 h-6 text-blue-600 dark:text-blue-400"
                />
              </div>
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Persentase
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">
                  {mahasiswaData.persentase_kehadiran.toFixed(1)}%
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Status Kehadiran */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-8"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                Status Kehadiran
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Evaluasi keseluruhan kehadiran mahasiswa
              </p>
            </div>
            <span
              className={`inline-flex items-center px-4 py-2 rounded-full text-sm font-medium ${getStatusKehadiranColor(
                mahasiswaData.status_kehadiran
              )}`}
            >
              {getStatusKehadiranLabel(mahasiswaData.status_kehadiran)}
            </span>
          </div>
        </motion.div>

        {/* Filter dan Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 p-6 mb-8"
        >
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <FontAwesomeIcon
                    icon={faSearch}
                    className="h-5 w-5 text-gray-400"
                  />
                </div>
                <input
                  type="text"
                  placeholder="Cari mata kuliah, dosen, atau ruangan..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex gap-4">
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="all">Semua Status</option>
                <option value="hadir">Hadir</option>
                <option value="tidak_hadir">Tidak Hadir</option>
                <option value="waiting">Menunggu</option>
              </select>
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="all">Semua Jenis</option>
                <option value="kuliah_besar">Kuliah Besar</option>
                <option value="praktikum">Praktikum</option>
                <option value="jurnal_reading">Jurnal Reading</option>
                <option value="pbl">PBL</option>
                <option value="csr">CSR</option>
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="tanggal">Urutkan berdasarkan Tanggal</option>
                <option value="mata_kuliah">
                  Urutkan berdasarkan Mata Kuliah
                </option>
                <option value="status">Urutkan berdasarkan Status</option>
                <option value="jenis_jadwal">Urutkan berdasarkan Jenis</option>
              </select>
              <button
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors border border-gray-300 dark:border-gray-600 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <FontAwesomeIcon icon={faSort} className="w-5 h-5" />
              </button>
            </div>
          </div>
        </motion.div>

        {/* Detail Kehadiran */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                Detail Kehadiran
              </h3>
              <button
                onClick={exportPDF}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <FontAwesomeIcon icon={faDownload} className="w-4 h-4" />
                Export PDF
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tanggal
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Mata Kuliah
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Tipe
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Jenis
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Waktu
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Ruangan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Dosen
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Alasan/Catatan
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filteredKehadiran.map((item, index) => (
                  <tr
                    key={item.id}
                    className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                      index % 2 === 0
                        ? "bg-white dark:bg-gray-800"
                        : "bg-gray-50 dark:bg-gray-700"
                    }`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      {formatDate(item.tanggal)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {item.mata_kuliah}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 dark:text-gray-300">
                      {item.jenis_detail || "-"}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getJenisJadwalColor(
                          item.jenis_jadwal
                        )}`}
                      >
                        {getJenisJadwalLabel(item.jenis_jadwal)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <FontAwesomeIcon
                          icon={getStatusIcon(item.status)}
                          className={`w-4 h-4 ${
                            item.status === "hadir"
                              ? "text-green-500"
                              : item.status === "tidak_hadir"
                              ? "text-red-500"
                              : item.status === "waiting"
                              ? "text-gray-500"
                              : "text-gray-500"
                          }`}
                        />
                        <span
                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(
                            item.status
                          )}`}
                        >
                          {item.status === "tidak_hadir"
                            ? "Tidak Hadir"
                            : item.status === "hadir"
                            ? "Hadir"
                            : item.status === "waiting"
                            ? "Menunggu"
                            : item.status}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.jam_mulai} - {item.jam_selesai}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.ruangan}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.dosen}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {item.alasan || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredKehadiran.length === 0 && (
            <div className="text-center py-12">
              <FontAwesomeIcon
                icon={faCalendarAlt}
                className="w-12 h-12 text-gray-400 mx-auto mb-4"
              />
              <p className="text-gray-500 dark:text-gray-400">
                Tidak ada data kehadiran yang sesuai dengan filter
              </p>
            </div>
          )}
        </motion.div>

        {/* Summary */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="mt-8 text-center"
        >
          <p className="text-gray-600 dark:text-gray-400">
            Menampilkan{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {filteredKehadiran.length}
            </span>{" "}
            dari{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {mahasiswaData.detail_kehadiran.length}
            </span>{" "}
            data kehadiran
          </p>
        </motion.div>
      </div>
    </div>
  );
};

export default DetailMahasiswaKeabsenan;
