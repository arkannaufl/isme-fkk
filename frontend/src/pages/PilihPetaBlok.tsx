import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { GroupIcon, UserIcon } from "../icons";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import BoxCubeIcon from '../icons/box-cube.svg';

const blokList = [1, 2, 3, 4];
const ganjilSemesters = [1, 3, 5, 7];
const genapSemesters = [2, 4, 6, 8];

export default function PilihPetaBlok() {
  const [step, setStep] = useState<'semester' | 'blok'>('semester');
  const [selectedSemester, setSelectedSemester] = useState<'ganjil' | 'genap' | null>(null);
  const navigate = useNavigate();

  const handleSemesterClick = (jenis: 'ganjil' | 'genap') => {
    setSelectedSemester(jenis);
    setStep('blok');
  };

  const handleBlokClick = (blok: number) => {
    // Dummy: semester 1,3,5,7 untuk ganjil; 2,4,6,8 untuk genap
    const semester = selectedSemester === 'ganjil' ? 1 : 2;
    navigate(`/peta-blok/${semester}/${blok}`, { state: { dummy: true } });
  };

  return (
    <div className="space-y-6">
      {step === 'blok' && (
        <button
          onClick={() => setStep('semester')}
          className="flex items-center gap-2 text-brand-500 text-sm font-medium hover:text-brand-600 transition px-0 py-0 bg-transparent shadow-none dark:text-green-400 dark:hover:text-green-300"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Kembali
        </button>
      )}
      <PageBreadcrumb pageTitle="Pilih Peta Blok" />
      {step === 'semester' && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-6 border-b border-gray-100 dark:border-white/[0.05]">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Pilih Peta Blok</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Silakan pilih semester dan blok untuk melihat peta jadwal blok perkuliahan.</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div
                onClick={() => handleSemesterClick('ganjil')}
                className="group block rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-brand-500 hover:shadow-theme-lg px-8 py-10 cursor-pointer"
              >
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-orange-500 flex items-center justify-center transition-colors duration-200 group-hover:bg-orange-600 mb-4">
                    <UserIcon className="w-10 h-10 text-white transition-colors duration-200 group-hover:text-orange-100" />
                  </div>
                  <div>
                    <span className="text-2xl font-semibold text-orange-500 block mb-2">Semester Ganjil</span>
                    <span className="text-gray-600 dark:text-gray-400">Tersedia semester {ganjilSemesters.join(', ')}</span>
                  </div>
                </div>
              </div>
              <div
                onClick={() => handleSemesterClick('genap')}
                className="group block rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-brand-500 hover:shadow-theme-lg px-8 py-10 cursor-pointer"
              >
                <div className="flex flex-col items-center text-center gap-6">
                  <div className="w-20 h-20 rounded-full bg-green-500 flex items-center justify-center transition-colors duration-200 group-hover:bg-green-600 mb-4">
                    <GroupIcon className="w-10 h-10 text-white transition-colors duration-200 group-hover:text-green-100" />
                  </div>
                  <div>
                    <span className="text-2xl font-semibold text-green-500 block mb-2">Semester Genap</span>
                    <span className="text-gray-600 dark:text-gray-400">Tersedia semester {genapSemesters.join(', ')}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      {step === 'blok' && (
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-6 border-b border-gray-100 dark:border-white/[0.05]">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Pilih Blok</h1>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Pilih blok untuk melihat modul PBL yang terkait</p>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {blokList.map((blok) => (
                <div
                  key={blok}
                  className="group block rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-brand-500 hover:shadow-theme-lg px-6 py-8"
                >
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center transition-colors duration-200 group-hover:bg-brand-600">
                      <img src={BoxCubeIcon} alt="Cube Icon" className="w-8 h-8 filter invert" />
                    </div>
                    <div>
                      <span className="text-xl font-bold text-brand-500 block mb-1">Blok {blok}</span>
                    </div>
                    <button
                      onClick={() => handleBlokClick(blok)}
                      className="w-full mt-4 px-4 py-2 bg-brand-500 text-white text-base  rounded-lg hover:bg-brand-600 transition"
                    >
                      Lihat Detail
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
} 
