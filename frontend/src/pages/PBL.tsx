import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faEdit } from "@fortawesome/free-solid-svg-icons";
import PageBreadCrumb from '../components/common/PageBreadCrumb';
import BoxCubeIcon from '../icons/box-cube.svg';

// Dummy blok data (replace with API call if needed)
const blokList = [
  { blokId: 1, nama: 'Blok 1' },
  { blokId: 2, nama: 'Blok 2' },
  { blokId: 3, nama: 'Blok 3' },
  { blokId: 4, nama: 'Blok 4' },
];

export default function PBL() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="PBL" />
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="p-6 border-b border-gray-100 dark:border-white/[0.05]">
          <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
            Pilih Blok
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Pilih blok untuk melihat modul PBL yang terkait
          </p>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {blokList.map((blok) => (
              <div
                key={blok.blokId}
                className="group block rounded-xl border border-gray-200 bg-white shadow-theme-xs dark:border-gray-800 dark:bg-white/[0.03] transition-all duration-200 hover:-translate-y-1 hover:border-brand-500 hover:shadow-theme-lg px-6 py-8"
              >
                <div className="flex flex-col items-center text-center gap-4">
                  <div className="w-16 h-16 rounded-full bg-brand-500 flex items-center justify-center transition-colors duration-200 group-hover:bg-brand-600">
                    <img src={BoxCubeIcon} alt="Cube Icon" className="w-8 h-8 filter invert" />
                  </div>
                  <div>
                    <span className="text-xl font-semibold text-brand-500 block mb-1">
                      {blok.nama}
                    </span>
                  </div>
                  <div className="flex flex-row gap-2 mt-2 w-full">
                    <button
                      onClick={() => navigate(`/pbl/blok/${blok.blokId}`)}
                      className="flex-1 px-4 py-2 bg-brand-500 text-white text-sm font-medium rounded-lg hover:bg-brand-600 transition"
                    >
                      Lihat Detail
                    </button>
                    <button
                      onClick={() => navigate(`/pbl/generate/${blok.blokId}`)}
                      className="flex-1 px-4 py-2 text-sm rounded-lg border border-brand-500 text-brand-500 bg-transparent hover:bg-brand-50 hover:text-brand-600 transition flex justify-center items-center gap-2 dark:text-brand-400 dark:border-brand-400 dark:hover:bg-brand-900/10"
                    >
                      <FontAwesomeIcon icon={faCog} className="w-4 h-4" />
                      Generate Dosen
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
          
          {/* Keahlian Management Section */}
          <div className="mt-8 p-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center">
                <FontAwesomeIcon icon={faEdit} className="w-6 h-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-blue-800 dark:text-blue-200">
                  Kelola Keahlian Mata Kuliah
                </h3>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Atur keahlian yang diperlukan untuk setiap mata kuliah PBL
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/pbl/keahlian')}
              className="px-6 py-3 bg-blue-500 text-white text-sm font-medium rounded-lg hover:bg-blue-600 transition flex items-center gap-2"
            >
              <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
              Kelola Keahlian
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
