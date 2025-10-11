import { useNavigate } from 'react-router-dom';
import { GroupIcon, UserIcon } from "../icons";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import BoxCubeIcon from '../icons/box-cube.svg';

const ganjilSemesters = [1, 3, 5, 7];
const genapSemesters = [2, 4, 6];

export default function PilihPetaBlok() {
  const navigate = useNavigate();

  const handleSemesterClick = (jenis: 'ganjil' | 'genap') => {
    if (jenis === 'ganjil') {
      navigate('/peta-blok/ganjil');
    } else {
      navigate('/peta-blok/genap');
    }
  };

  const handleAntaraClick = () => {
    navigate('/peta-blok/antara');
  };

  return (
    <div className="space-y-6">
      <PageBreadcrumb pageTitle="Pilih Peta Blok" />
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
          <div className="p-6 border-b border-gray-100 dark:border-white/[0.05]">
            <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">Pilih Peta Blok</h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Pilih semester untuk melihat jadwal lengkap (blok + non blok).</p>
          </div>
          <div className="p-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                  <span className="text-gray-600 dark:text-gray-400">Jadwal lengkap semester {ganjilSemesters.join(', ')} + Non Blok</span>
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
                  <span className="text-gray-600 dark:text-gray-400">Jadwal lengkap semester {genapSemesters.join(', ')} + Non Blok</span>
                </div>
              </div>
            </div>
            <div
              onClick={handleAntaraClick}
              className="group block rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-emerald-500 hover:shadow-theme-lg px-8 py-10 cursor-pointer"
            >
              <div className="flex flex-col items-center text-center gap-6">
                <div className="w-20 h-20 rounded-full bg-emerald-500 flex items-center justify-center transition-colors duration-200 group-hover:bg-emerald-600 mb-4">
                  <img src={BoxCubeIcon} alt="Cube Icon" className="w-10 h-10 filter invert" />
                  </div>
                  <div>
                  <span className="text-2xl font-semibold text-emerald-500 block mb-2">Semester Antara</span>
                  <span className="text-gray-600 dark:text-gray-400">Jadwal lengkap Blok 1-4 + Non Blok</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 
