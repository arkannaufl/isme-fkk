import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import api, { handleApiError } from "../utils/api";

interface MataKuliah {
  id: number;
  kode: string;
  nama: string;
  sks: number;
  semester: number;
  jenis: string;
  created_at: string;
  updated_at: string;
  rps_file?: string;
  materi?: Array<{
    id: number;
    filename: string;
    judul: string;
    file_type: string;
    file_size: number;
    upload_date: string;
  }>;
}

interface MataKuliahMahasiswaProps {}

const MataKuliahMahasiswa: React.FC<MataKuliahMahasiswaProps> = () => {
  const [mataKuliahList, setMataKuliahList] = useState<MataKuliah[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterSemester, setFilterSemester] = useState<string>("all");
  const [filterJenis, setFilterJenis] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("kode");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");

  useEffect(() => {
    fetchMataKuliah();
  }, []);

  const fetchMataKuliah = async () => {
    try {
      setLoading(true);
      const response = await api.get("/mata-kuliah");
      const mataKuliahData = response.data;
      
      // Fetch RPS and Materi for each mata kuliah
      const mataKuliahWithFiles = await Promise.all(
        mataKuliahData.map(async (mk: MataKuliah) => {
          try {
            // Fetch materi for this mata kuliah
            const materiResponse = await api.get(`/mata-kuliah/${mk.kode}/materi`);
            return {
              ...mk,
              materi: materiResponse.data.data || []
            };
          } catch (error) {
            console.error(`Error fetching materi for ${mk.kode}:`, error);
            return {
              ...mk,
              materi: []
            };
          }
        })
      );
      
      setMataKuliahList(mataKuliahWithFiles);
    } catch (error) {
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  };

  const filteredMataKuliah = mataKuliahList
    .filter((mk) => {
      const matchesSearch =
        mk.kode.toLowerCase().includes(searchTerm.toLowerCase()) ||
        mk.nama.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesSemester =
        filterSemester === "all" || mk.semester.toString() === filterSemester;
      const matchesJenis = filterJenis === "all" || mk.jenis === filterJenis;

      return matchesSearch && matchesSemester && matchesJenis;
    })
    .sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case "kode":
          comparison = a.kode.localeCompare(b.kode);
          break;
        case "nama":
          comparison = a.nama.localeCompare(b.nama);
          break;
        case "sks":
          comparison = a.sks - b.sks;
          break;
        case "semester":
          comparison = a.semester - b.semester;
          break;
        case "jenis":
          comparison = a.jenis.localeCompare(b.jenis);
          break;
        default:
          comparison = 0;
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

  const getJenisBadgeColor = (jenis: string) => {
    switch (jenis.toLowerCase()) {
      case "wajib":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
      case "pilihan":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300";
      case "pilihan wajib":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-300";
    }
  };

  const getSemesterBadgeColor = (semester: number) => {
    if (semester <= 2)
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300";
    if (semester <= 4)
      return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300";
    if (semester <= 6)
      return "bg-amber-100 text-amber-800 dark:bg-amber-900/20 dark:text-amber-300";
    return "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300";
  };

  const downloadRps = async (kode: string) => {
    try {
      const response = await api.get(`/mata-kuliah/${kode}/download-rps`, {
        responseType: 'blob'
      });
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `RPS_${kode}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading RPS:', error);
      alert('Gagal mengunduh file RPS');
    }
  };

  const downloadMateri = async (kode: string, filename: string, judul: string) => {
    try {
      const response = await api.get(`/mata-kuliah/${kode}/download-materi`, {
        params: { filename },
        responseType: 'blob'
      });
      
      // Create blob link to download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${judul}.${filename.split('.').pop()}`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error downloading materi:', error);
      alert('Gagal mengunduh file materi');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileType: string) => {
    const type = fileType.toLowerCase();
    if (type.includes('pdf')) return '📄';
    if (type.includes('doc')) return '📝';
    if (type.includes('xls')) return '📊';
    if (type.includes('ppt')) return '📽️';
    if (type.includes('image') || type.includes('jpg') || type.includes('png')) return '🖼️';
    if (type.includes('video')) return '🎥';
    if (type.includes('audio')) return '🎵';
    if (type.includes('zip') || type.includes('rar')) return '📦';
    return '📎';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">
            Memuat data mata kuliah...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mb-8"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-8">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
                  Mata Kuliah
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Daftar mata kuliah yang tersedia di program studi
                </p>
              </div>
              <div className="flex items-center space-x-4">
                <div className="text-right">
                  <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {mataKuliahList.length}
                  </div>
                  <div className="text-sm text-gray-500 dark:text-gray-400">
                    Total Mata Kuliah
                  </div>
                </div>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                    />
                  </svg>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Filters and Search */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg p-6 mb-8"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Cari Mata Kuliah
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <svg
                    className="h-5 w-5 text-gray-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                    />
                  </svg>
                </div>
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
                  placeholder="Cari berdasarkan kode atau nama..."
                />
              </div>
            </div>

            {/* Semester Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Semester
              </label>
              <select
                value={filterSemester}
                onChange={(e) => setFilterSemester(e.target.value)}
                className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="all">Semua Semester</option>
                {[1, 2, 3, 4, 5, 6, 7, 8].map((sem) => (
                  <option key={sem} value={sem.toString()}>
                    Semester {sem}
                  </option>
                ))}
              </select>
            </div>

            {/* Jenis Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Jenis
              </label>
              <select
                value={filterJenis}
                onChange={(e) => setFilterJenis(e.target.value)}
                className="block w-full px-3 py-3 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all duration-200"
              >
                <option value="all">Semua Jenis</option>
                <option value="wajib">Wajib</option>
                <option value="pilihan">Pilihan</option>
                <option value="pilihan wajib">Pilihan Wajib</option>
              </select>
            </div>
          </div>

          {/* Sort Options */}
          <div className="mt-4 flex flex-wrap gap-4">
            <div className="flex items-center space-x-2">
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Urutkan:
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="kode">Kode</option>
                <option value="nama">Nama</option>
                <option value="sks">SKS</option>
                <option value="semester">Semester</option>
                <option value="jenis">Jenis</option>
              </select>
              <button
                onClick={() =>
                  setSortOrder(sortOrder === "asc" ? "desc" : "asc")
                }
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 transition-colors"
              >
                {sortOrder === "asc" ? (
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
                      d="M5 15l7-7 7 7"
                    />
                  </svg>
                ) : (
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
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </motion.div>

        {/* Results Count */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mb-6"
        >
          <p className="text-gray-600 dark:text-gray-400">
            Menampilkan{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {filteredMataKuliah.length}
            </span>{" "}
            dari{" "}
            <span className="font-semibold text-gray-900 dark:text-white">
              {mataKuliahList.length}
            </span>{" "}
            mata kuliah
          </p>
        </motion.div>

        {/* Mata Kuliah Grid */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          {filteredMataKuliah.map((mataKuliah, index) => (
            <motion.div
              key={`mata-kuliah-${mataKuliah.id}-${index}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: index * 0.1 }}
              className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1 group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {mataKuliah.nama}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {mataKuliah.kode}
                    </p>
                  </div>
                  <div className="flex flex-col items-end space-y-2">
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getSemesterBadgeColor(
                        mataKuliah.semester
                      )}`}
                    >
                      Semester {mataKuliah.semester}
                    </span>
                    <span
                      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getJenisBadgeColor(
                        mataKuliah.jenis
                      )}`}
                    >
                      {mataKuliah.jenis}
                    </span>
                  </div>
                </div>

                {/* SKS */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-4 h-4 text-blue-600 dark:text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        SKS
                      </p>
                      <p className="text-lg font-semibold text-gray-900 dark:text-white">
                        {mataKuliah.sks}
                      </p>
                    </div>
                  </div>
                </div>

                {/* RPS Section */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    📄 RPS (Rencana Pembelajaran Semester)
                  </h4>
                  {mataKuliah.rps_file ? (
                    <button
                      onClick={() => downloadRps(mataKuliah.kode)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors border border-green-200 dark:border-green-800"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Download RPS
                    </button>
                  ) : (
                    <div className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      RPS belum tersedia
                    </div>
                  )}
                </div>

                {/* Materi Section */}
                <div className="mb-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    📚 Materi Pembelajaran {mataKuliah.materi && mataKuliah.materi.length > 0 && `(${mataKuliah.materi.length} file)`}
                  </h4>
                  {mataKuliah.materi && mataKuliah.materi.length > 0 ? (
                    <div className="space-y-2 max-h-32 overflow-y-auto">
                      {mataKuliah.materi.slice(0, 3).map((materi, idx) => (
                        <div key={idx} className="flex items-center justify-between p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                          <div className="flex items-center gap-2 flex-1 min-w-0">
                            <span className="text-lg">{getFileIcon(materi.file_type)}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                                {materi.judul}
                              </p>
                              <p className="text-xs text-gray-500 dark:text-gray-400">
                                {formatFileSize(materi.file_size)} • {new Date(materi.upload_date).toLocaleDateString('id-ID')}
                              </p>
                            </div>
                          </div>
                          <button
                            onClick={() => downloadMateri(mataKuliah.kode, materi.filename, materi.judul)}
                            className="ml-2 p-1 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/20 rounded transition-colors"
                            title="Download"
                          >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                        </div>
                      ))}
                      {mataKuliah.materi.length > 3 && (
                        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
                          +{mataKuliah.materi.length - 3} file lainnya
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-600">
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Materi belum tersedia
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>
                      Ditambahkan:{" "}
                      {new Date(mataKuliah.created_at).toLocaleDateString(
                        "id-ID"
                      )}
                    </span>
                    <div className="flex items-center space-x-1">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                      <span>Tersedia</span>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Empty State */}
        {filteredMataKuliah.length === 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5 }}
            className="text-center py-12"
          >
            <div className="w-24 h-24 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-12 h-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              Tidak ada mata kuliah ditemukan
            </h3>
            <p className="text-gray-500 dark:text-gray-400">
              Coba ubah filter atau kata kunci pencarian
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default MataKuliahMahasiswa;