import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BoxCubeIcon, ChevronLeftIcon, GroupIcon, UserIcon } from "../icons";
import { tahunAjaranApi, kelasApi, mahasiswaApi } from "../api/generateApi";
import PageBreadCrumb from "../components/common/PageBreadCrumb";

const Kelas: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSemesterType, setSelectedSemesterType] = useState<string>("");
  const [availableSemesters, setAvailableSemesters] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kelasData, setKelasData] = useState<{ [semesterId: number]: number }>({});
  const [mahasiswaList, setMahasiswaList] = useState<any[]>([]);

  // Load available semesters from database
  useEffect(() => {
    const fetchAvailableSemesters = async () => {
      try {
        setLoading(true);
        const response = await tahunAjaranApi.getActive();
        setAvailableSemesters(response.data);
      } catch (err) {
        setError('Gagal memuat tahun ajaran aktif dari database');
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableSemesters();
  }, []);

  // Load kelas data for selected semester type
  useEffect(() => {
    const loadKelasData = async () => {
      if (!selectedSemesterType || !availableSemesters) return;
      setLoading(true);
      try {
        const semesterIds = selectedSemesterType === 'ganjil' ? ganjilSemesters : genapSemesters;
        const counts: { [semesterId: number]: number } = {};
        for (const semesterId of semesterIds) {
          try {
            const response = await kelasApi.getBySemesterId(semesterId);
            // Cek apakah response berupa array langsung atau object
            let kelasArr = Array.isArray(response.data) ? response.data : response.data.data;
            counts[semesterId] = Array.isArray(kelasArr) ? kelasArr.length : 0;
          } catch {
            counts[semesterId] = 0;
          }
        }
        setKelasData(counts);
      } catch (err) {
      } finally {
        setLoading(false);
      }
    };
    if (selectedSemesterType) {
      loadKelasData();
    }
  }, [selectedSemesterType, availableSemesters]);

  // Fetch mahasiswa untuk dapatkan semester unik
  useEffect(() => {
    const fetchMahasiswa = async () => {
      try {
        const res = await mahasiswaApi.getAll();
        setMahasiswaList(res.data);
      } catch (error) {
        // Silent fail - mahasiswa data is not critical for this page
        // Could be improved with handleApiError if needed
      }
    };
    fetchMahasiswa();
  }, []);

  // Dapatkan semester unik dari mahasiswa
  const uniqueSemesters = Array.from(new Set(mahasiswaList.map(m => m.semester).filter(s => !!s))).sort((a, b) => a - b);
  const ganjilSemesters = uniqueSemesters.filter(s => [1,3,5,7].includes(Number(s)));
  const genapSemesters = uniqueSemesters.filter(s => [2,4,6,8].includes(Number(s)));

  const handleBackToSemesterType = () => {
    setSelectedSemesterType("");
  };

  const getKelasCount = (semesterId: number) => {
    return kelasData[semesterId] || 0;
  };

  const handleSemesterClick = (semesterId: number) => {
    navigate(`/generate/kelas/${semesterId}`);
  };

  // Show loading state
  if (loading) {
    if (!selectedSemesterType) {
      // Skeleton untuk pemilihan ganjil/genap (dengan breadcrumb)
      return (
        <div className="space-y-6">
          <PageBreadCrumb pageTitle="Kelas" />
          <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                {[1,2].map(i => (
                  <div key={i} className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 animate-pulse px-8 py-10 flex flex-col items-center gap-6">
                    <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 mb-4" />
                    <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    } else {
      // Skeleton untuk grid semester (tanpa breadcrumb, hanya grid card)
      return (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] mt-8">
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({length: 4}).map((_,i) => (
                <div key={i} className="group block rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] transition-all duration-200 px-6 py-8 flex flex-col items-center gap-4 animate-pulse">
                  <div className="w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 mb-2" />
                  <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                  <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              ))}
            </div>
          </div>
        </div>
      );
    }
  }

  // Show error state
  if (error) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Kelas" />
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-6">
            <div className="text-center py-12">
              <div className="text-red-500 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Terjadi Kesalahan</h3>
              <p className="text-gray-600 dark:text-gray-400">{error}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If no active academic year
  if (!availableSemesters) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Kelas" />
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-6">
            <div className="text-center py-12">
              <div className="text-yellow-500 mb-4">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">Tidak Ada Tahun Ajaran Aktif</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Silakan aktifkan tahun ajaran terlebih dahulu di halaman Tahun Ajaran.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If haven't selected semester type yet
  if (!selectedSemesterType) {
    return (
      <div className="space-y-6">
        <PageBreadCrumb pageTitle="Kelas" />
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-6 border-b border-gray-100 dark:border-white/[0.05]">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Tahun Ajaran {availableSemesters?.tahun ?? "-"}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Pilih jenis semester untuk mengelola kelas
            </p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div
                onClick={() => setSelectedSemesterType("ganjil")}
                className="group block rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-brand-500 hover:shadow-theme-lg px-8 py-10 cursor-pointer"
              >
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center transition-colors duration-200 group-hover:bg-orange-600">
                    <GroupIcon className="w-10 h-10 text-white transition-colors duration-200 group-hover:text-orange-100" />
                  </div>
                  <div>
                    <span className="text-2xl font-semibold text-orange-500 block mb-2">
                      Semester Ganjil
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      Tersedia semester {ganjilSemesters.join(', ') || '-'}
                    </span>
                  </div>
                </div>
              </div>
              <div
                onClick={() => setSelectedSemesterType("genap")}
                className="group block rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-brand-500 hover:shadow-theme-lg px-8 py-10 cursor-pointer"
              >
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center transition-colors duration-200 group-hover:bg-green-600">
                    <UserIcon className="w-10 h-10 text-white transition-colors duration-200 group-hover:text-green-100" />
                  </div>
                  <div>
                    <span className="text-2xl font-semibold text-green-500 block mb-2">
                      Semester Genap
                    </span>
                    <span className="text-gray-600 dark:text-gray-400">
                      Tersedia semester {genapSemesters.join(', ') || '-'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // If semester type is selected, show available semesters
  const semesterIds = selectedSemesterType === 'ganjil' ? ganjilSemesters : genapSemesters;
  const semesterTypeLabel = selectedSemesterType === "ganjil" ? "Ganjil" : "Genap";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex flex-col items-start gap-4">
          <button
            onClick={handleBackToSemesterType}
            className="flex items-center gap-2 text-brand-500 hover:text-brand-600 transition-all duration-300 ease-out hover:scale-105 transform"
          >
            <ChevronLeftIcon className="w-5 h-5" />
            <span>Kembali</span>
          </button>
          <div>
            <h2 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Pilih Semester
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Pilih semester yang ingin dikelola
            </p>
          </div>
        </div>
      </div>
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {semesterIds.map((semesterId) => (
              <div
                key={semesterId}
                onClick={() => handleSemesterClick(semesterId)}
                className="group block rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-brand-500 hover:shadow-theme-lg px-6 py-8 cursor-pointer"
              >
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center transition-colors duration-200 group-hover:bg-brand-600">
                    <BoxCubeIcon className="w-8 h-8 text-white transition-colors duration-200 group-hover:text-brand-100" />
                  </div>
                  <div>
                    <span className="text-xl font-semibold text-brand-500 block">
                      Semester {semesterId}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {getKelasCount(semesterId) > 0 ? `${getKelasCount(semesterId)} Kelas` : 'Tidak ada kelas'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Kelas; 
