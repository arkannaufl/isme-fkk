import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faArrowLeft } from "@fortawesome/free-solid-svg-icons";
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="mb-8">
            <div className="h-6 w-20 bg-gray-300 dark:bg-gray-600 rounded mb-4 animate-pulse"></div>
            <div className="h-8 w-32 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
            <div className="h-4 w-64 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
          </div>

          {/* Filters Skeleton */}
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="lg:col-span-2">
                <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
                <div className="h-12 w-full bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse"></div>
              </div>
              <div>
                <div className="h-4 w-20 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
                <div className="h-12 w-full bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse"></div>
              </div>
              <div>
                <div className="h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded mb-2 animate-pulse"></div>
                <div className="h-12 w-full bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse"></div>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap gap-4">
              <div className="h-8 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
              <div className="h-8 w-24 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
            </div>
          </div>

          {/* Results Count Skeleton */}
          <div className="mb-6">
            <div className="h-4 w-48 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
          </div>

               {/* Table Skeleton */}
               <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
                 {/* Table Header Skeleton */}
                 <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-xl animate-pulse"></div>
                     <div>
                       <div className="h-6 w-40 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse"></div>
                       <div className="h-4 w-48 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                     </div>
                   </div>
                 </div>

                 {/* Table Content Skeleton */}
                 <div className="overflow-x-auto">
                   <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                     <thead className="bg-gray-50 dark:bg-gray-700/50">
                       <tr>
                         {Array.from({ length: 6 }).map((_, i) => (
                           <th key={i} className="px-6 py-3">
                             <div className="h-3 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                           </th>
                         ))}
                       </tr>
                     </thead>
                     <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                       {Array.from({ length: 5 }).map((_, index) => (
                         <tr key={index} className="hover:bg-gray-50 dark:hover:bg-gray-700/50">
                           {/* Mata Kuliah Info Skeleton */}
                           <td className="px-6 py-4 whitespace-nowrap">
                             <div className="flex items-center">
                               <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"></div>
                               <div className="ml-4">
                                 <div className="h-4 w-48 bg-gray-300 dark:bg-gray-600 rounded mb-1 animate-pulse"></div>
                                 <div className="h-3 w-20 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                               </div>
                             </div>
                           </td>

                           {/* Semester Skeleton */}
                           <td className="px-6 py-4 whitespace-nowrap">
                             <div className="flex flex-col gap-1">
                               <div className="h-6 w-24 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
                               <div className="h-6 w-20 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
                             </div>
                           </td>

                           {/* SKS Skeleton */}
                           <td className="px-6 py-4 whitespace-nowrap">
                             <div className="flex items-center gap-2">
                               <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                               <div className="h-4 w-6 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                             </div>
                           </td>

                           {/* RPS Skeleton */}
                           <td className="px-6 py-4 whitespace-nowrap">
                             <div className="h-8 w-24 bg-gray-300 dark:bg-gray-600 rounded-lg animate-pulse"></div>
                           </td>

                           {/* Materi Skeleton */}
                           <td className="px-6 py-4 whitespace-nowrap">
                             <div className="flex items-center gap-2">
                               <div className="h-4 w-12 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                               <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                             </div>
                           </td>

                           {/* Status Skeleton */}
                           <td className="px-6 py-4 whitespace-nowrap">
                             <div className="flex items-center gap-2">
                               <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full animate-pulse"></div>
                               <div className="h-4 w-16 bg-gray-300 dark:bg-gray-600 rounded animate-pulse"></div>
                             </div>
                           </td>
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
        <div className="mb-8">
          <button
            onClick={() => window.history.back()}
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 transition mb-4"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-4 h-4" />
            Kembali
          </button>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
                  Mata Kuliah
                </h1>
                <p className="text-gray-600 dark:text-gray-400">
                  Daftar mata kuliah yang tersedia di program studi
                </p>
              </div>

        {/* Filters and Search */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-8">
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
        </div>

        {/* Results Count */}
        <div className="mb-6">
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
        </div>

        {/* Mata Kuliah Table */}
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
          {/* Table Header */}
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-500 rounded-xl flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Daftar Mata Kuliah
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {filteredMataKuliah.length} dari {mataKuliahList.length} mata kuliah
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Table Content */}
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
                    RPS
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Materi
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          {filteredMataKuliah.map((mataKuliah, index) => (
                  <tr key={`mata-kuliah-${mataKuliah.id}-${index}`} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                    {/* Mata Kuliah Info */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                            <svg className="w-5 h-5 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.746 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                            </svg>
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 dark:text-white">
                      {mataKuliah.nama}
                          </div>
                          <div className="text-sm text-gray-500 dark:text-gray-400 font-mono">
                      {mataKuliah.kode}
                          </div>
                        </div>
                  </div>
                    </td>

                    {/* Semester & Jenis */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex flex-col gap-1">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium w-fit ${
                          mataKuliah.semester >= 1 && mataKuliah.semester <= 7 
                            ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-300' 
                            : 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-300'
                        }`}>
                          {mataKuliah.semester >= 1 && mataKuliah.semester <= 7 
                            ? `Semester ${mataKuliah.semester}` 
                            : 'Semester Antara'}
                        </span>
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300 w-fit">
                      {mataKuliah.jenis}
                    </span>
                  </div>
                    </td>

                {/* SKS */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 bg-purple-100 dark:bg-purple-900/20 rounded flex items-center justify-center">
                          <svg className="w-3 h-3 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                        <span className="text-sm font-medium text-gray-900 dark:text-white">
                        {mataKuliah.sks}
                        </span>
                    </div>
                    </td>

                    {/* RPS */}
                    <td className="px-6 py-4 whitespace-nowrap">
                  {mataKuliah.rps_file ? (
                    <button
                      onClick={() => downloadRps(mataKuliah.kode)}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors border border-blue-200 dark:border-blue-800 text-sm"
                    >
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                          Download
                    </button>
                  ) : (
                        <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-gray-50 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-lg border border-gray-200 dark:border-gray-600 text-sm">
                          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                          Belum tersedia
                        </span>
                      )}
                    </td>

                    {/* Materi */}
                    <td className="px-6 py-4 whitespace-nowrap">
                  {mataKuliah.materi && mataKuliah.materi.length > 0 ? (
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {mataKuliah.materi.length} file
                          </span>
                          <button
                            onClick={() => {
                              // Show first materi for download
                              if (mataKuliah.materi && mataKuliah.materi.length > 0) {
                                const firstMateri = mataKuliah.materi[0];
                                downloadMateri(mataKuliah.kode, firstMateri.filename, firstMateri.judul);
                              }
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300 rounded hover:bg-green-100 dark:hover:bg-green-900/30 transition-colors"
                            title="Download materi"
                          >
                            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </button>
                    </div>
                  ) : (
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Belum tersedia
                        </span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-green-400 rounded-full"></div>
                        <span className="text-sm text-gray-900 dark:text-white">Tersedia</span>
                    </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
                </div>
              </div>

        {/* Empty State */}
        {filteredMataKuliah.length === 0 && (
          <div className="text-center py-12">
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
          </div>
        )}
      </div>
    </div>
  );
};

export default MataKuliahMahasiswa;