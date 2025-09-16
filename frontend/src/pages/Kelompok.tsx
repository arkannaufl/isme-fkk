import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { UserIcon, ChevronLeftIcon, GroupIcon } from "../icons";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import {
  tahunAjaranApi,
  kelompokBesarApi,
  mahasiswaApi,
} from "../api/generateApi";

type SemesterData = {
  tahun_ajaran: string;
  semesters: {
    ganjil: number[];
    genap: number[];
  };
};

// Gunakan tipe Mahasiswa dari generateApi jika sudah ada
// Hapus deklarasi duplikat Mahasiswa

// Tipe minimal untuk mahasiswa yang dipakai di komponen
interface MahasiswaMinimal {
  id: number;
  semester: number;
  // tambahkan field lain jika ada, misal:
  // nama?: string;
}

const Kelompok: React.FC = () => {
  const navigate = useNavigate();
  const [selectedSemesterType, setSelectedSemesterType] = useState<string>("");
  const [availableSemesters, setAvailableSemesters] =
    useState<SemesterData | null>(null);
  const [loading, setLoading] = useState(true);
  const [mahasiswaList, setMahasiswaList] = useState<MahasiswaMinimal[]>([]);

  // Load available semesters from database
  useEffect(() => {
    const fetchAvailableSemesters = async () => {
      try {
        setLoading(true);
        const response = await tahunAjaranApi.getAvailableSemesters();
        setAvailableSemesters(response.data);
      } catch (err) {
        console.error("Error fetching available semesters:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchAvailableSemesters();
  }, []);

  // Load mahasiswa counts for selected semester type
  useEffect(() => {
    const fetchCounts = async () => {
      if (!selectedSemesterType || !availableSemesters) return;

      const semesterIds =
        availableSemesters.semesters[
          selectedSemesterType as keyof typeof availableSemesters.semesters
        ];
      const counts: { [semesterId: number]: number } = {};

      for (const semesterId of semesterIds) {
        try {
          const res = await kelompokBesarApi.getBySemesterId(semesterId);
          counts[semesterId] = res.data.data.length;
        } catch {
          counts[semesterId] = 0;
        }
      }
    };

    if (selectedSemesterType) {
      fetchCounts();
    }
  }, [selectedSemesterType, availableSemesters]);

  // Fetch mahasiswa untuk dapatkan semester unik
  useEffect(() => {
    const fetchMahasiswa = async () => {
      try {
        const res = await mahasiswaApi.getAll();
        setMahasiswaList(res.data as MahasiswaMinimal[]);
      } catch {
        // Optional: set error jika ingin
      }
    };
    fetchMahasiswa();
  }, []);

  // Dapatkan semester unik dari mahasiswa
  const uniqueSemesters = Array.from(
    new Set(mahasiswaList.map((m) => m.semester).filter((s) => !!s))
  ).sort((a, b) => a - b);
  const ganjilSemesters = uniqueSemesters.filter((s) =>
    [1, 3, 5, 7].includes(Number(s))
  );
  const genapSemesters = uniqueSemesters.filter((s) =>
    [2, 4, 6, 8].includes(Number(s))
  );

  // Mapping jumlah mahasiswa per semester
  const mahasiswaPerSemester: { [semester: number]: number } = {};
  mahasiswaList.forEach((m) => {
    if (m.semester) {
      mahasiswaPerSemester[m.semester] =
        (mahasiswaPerSemester[m.semester] || 0) + 1;
    }
  });

  const handleBackToSemesterType = () => {
    setSelectedSemesterType("");
  };

  // Show loading state
  if (loading) {
    return (
      <div className="space-y-6">
        <PageBreadcrumb pageTitle="Kelompok" />
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-6">
            {/* Skeleton untuk card semester type */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {[1, 2].map((i) => (
                <div
                  key={i}
                  className="rounded-xl border border-gray-200 dark:border-gray-800 bg-gray-100 dark:bg-gray-800 animate-pulse px-8 py-10 flex flex-col items-center gap-6"
                >
                  <div className="w-20 h-20 rounded-full bg-gray-200 dark:bg-gray-700 mb-4" />
                  <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-2" />
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded mt-2" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Show error state
  if (!availableSemesters) {
    return (
      <div className="space-y-6">
        <PageBreadcrumb pageTitle="Kelompok" />
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-6">
            <div className="text-center py-12">
              <div className="text-yellow-500 mb-4">
                <svg
                  className="w-12 h-12 mx-auto"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z"
                  />
                </svg>
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Tidak Ada Tahun Ajaran Aktif
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Silakan aktifkan tahun ajaran terlebih dahulu di halaman Tahun
                Ajaran.
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
        <PageBreadcrumb pageTitle="Kelompok" />

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-6 border-b border-gray-100 dark:border-white/[0.05]">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
              Tahun Ajaran {availableSemesters.tahun_ajaran}
            </h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Pilih jenis semester untuk mengelola kelompok mahasiswa
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
                      Tersedia semester {ganjilSemesters.join(", ") || "-"}
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
                      Tersedia semester {genapSemesters.join(", ") || "-"}
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
  const semesterIds =
    selectedSemesterType === "ganjil" ? ganjilSemesters : genapSemesters;
  const semesterTypeLabel =
    selectedSemesterType === "ganjil" ? "Ganjil" : "Genap";

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
              {availableSemesters.tahun_ajaran} - Semester {semesterTypeLabel}
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
                className="group block rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-brand-500 hover:shadow-theme-lg px-6 py-8"
              >
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center transition-colors duration-200 group-hover:bg-brand-600">
                    <UserIcon className="w-8 h-8 text-white transition-colors duration-200 group-hover:text-brand-100" />
                  </div>
                  <div>
                    <span className="text-xl font-semibold text-brand-500 block">
                      Semester {semesterId}
                    </span>
                    <span className="text-sm text-gray-600 dark:text-gray-400">
                      {mahasiswaPerSemester[semesterId] || 0} Mahasiswa
                    </span>
                    <div className="flex flex-col gap-3 mt-5 w-full">
                      <button
                        className="w-full flex items-center justify-center gap-2 px-4 py-1.5 text-sm rounded-xl font-medium bg-brand-500 text-white shadow-theme-xs hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-400 transition-all duration-200 min-h-[48px] scale-100 hover:scale-[1.03] active:scale-95"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/generate/kelompok-besar/${semesterId}`);
                        }}
                      >
                        <GroupIcon className="w-5 h-5" />
                        Kelompok Besar
                      </button>
                      <button
                        className="w-full flex items-center justify-center gap-2 px-4 py-1.5 text-sm rounded-xl font-medium border border-brand-500 text-brand-500 shadow-theme-xs hover:bg-brand-50 hover:text-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-200 transition-all duration-200 min-h-[48px] scale-100 hover:scale-[1.03] active:scale-95 dark:text-brand-400 dark:border-brand-400 dark:hover:bg-brand-900/10"
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/generate/kelompok/${semesterId}`);
                        }}
                      >
                        <UserIcon className="w-5 h-5" />
                        Kelompok Kecil
                      </button>
                    </div>
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

export default Kelompok;
