import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faEdit, faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import { AnimatePresence, motion } from "framer-motion";
import PageBreadCrumb from '../components/common/PageBreadCrumb';
import BoxCubeIcon from '../icons/box-cube.svg';
import { pblGenerateApi } from '../api/generateApi';

// Dummy blok data (replace with API call if needed)
const blokList = [
  { blokId: 1, nama: 'Blok 1' },
  { blokId: 2, nama: 'Blok 2' },
  { blokId: 3, nama: 'Blok 3' },
  { blokId: 4, nama: 'Blok 4' },
];

interface BlokStatus {
  blokId: number;
  nama: string;
  isGenerated: boolean;
  assignmentCount: number;
  pblCount: number;
  message: string;
}

export default function PBL() {
  const navigate = useNavigate();
  const [blokStatuses, setBlokStatuses] = useState<BlokStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [showClearCacheModal, setShowClearCacheModal] = useState(false);

  // Fungsi untuk refresh status blok
  const refreshBlokStatus = async () => {
    setLoading(true);
    
    try {
      const statusPromises = blokList.map(async (blok) => {
        try {
          const response = await pblGenerateApi.checkGenerateStatus(blok.blokId);
          
          // Hanya gunakan data dari API (database)
          const responseData = response.data;
          const isGenerated = responseData.success && responseData.data?.is_generated === true;
          const assignmentCount = responseData.data?.assignment_count || 0;
          const pblCount = responseData.data?.pbl_count || 0;
          const message = responseData.data?.message || 'Status unknown';
          
          return {
            blokId: blok.blokId,
            nama: blok.nama,
            isGenerated,
            assignmentCount,
            pblCount,
            message
          };
        } catch (error) {
          console.error(`❌ Error checking status for blok ${blok.blokId}:`, error);
          console.error('Error details:', {
            message: error.message,
            status: error.response?.status,
            data: error.response?.data
          });
          
          // Retry dengan delay
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            const retryResponse = await pblGenerateApi.checkGenerateStatus(blok.blokId);
            
            return {
              blokId: blok.blokId,
              nama: blok.nama,
              isGenerated: retryResponse.data.data?.is_generated || false,
              assignmentCount: retryResponse.data.data?.assignment_count || 0,
              pblCount: retryResponse.data.data?.pbl_count || 0,
              message: retryResponse.data.data?.message || 'Unknown status'
            };
          } catch (retryError) {
            console.error(`❌ Retry failed for blok ${blok.blokId}:`, retryError);
            
            // Jika retry gagal, return status false
            return {
              blokId: blok.blokId,
              nama: blok.nama,
              isGenerated: false,
              assignmentCount: 0,
              pblCount: 0,
              message: 'Error checking status'
            };
          }
        }
      });

      const statuses = await Promise.all(statusPromises);
      setBlokStatuses(statuses);
    } catch (error) {
      console.error('❌ Error refreshing blok statuses:', error);
    } finally {
      setLoading(false);
    }
  };

  // Cek status generate untuk semua blok
  useEffect(() => {
    refreshBlokStatus();
    
    // Auto refresh setiap 5 menit (300000ms) - tidak terlalu sering
    const interval = setInterval(() => {
      refreshBlokStatus();
    }, 300000);
    
    return () => clearInterval(interval);
  }, []);

  const handleLihatDetail = (blokId: number) => {
    const blokStatus = blokStatuses.find(b => b.blokId === blokId);
    if (!blokStatus?.isGenerated) {
      alert('Blok ini belum di-generate. Silakan generate dosen terlebih dahulu.');
      return;
    }
    navigate(`/pbl/blok/${blokId}`);
  };

  const handleClearCache = () => {
    setShowClearCacheModal(true);
  };

  const handleConfirmClearCache = () => {
    // Refresh dari API (tidak ada localStorage lagi)
    refreshBlokStatus();
    setShowClearCacheModal(false);
  };

  const handleCancelClearCache = () => {
    setShowClearCacheModal(false);
  };

  return (
    <div className="space-y-6">
      <PageBreadCrumb pageTitle="PBL" />
      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="p-6 border-b border-gray-100 dark:border-white/[0.05]">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-xl font-semibold text-gray-800 dark:text-white/90">
                Pilih Blok
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Pilih blok untuk melihat modul PBL yang terkait
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={refreshBlokStatus}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                {loading ? 'Loading...' : 'Refresh'}
              </button>
              
              <button
                onClick={handleClearCache}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors duration-200"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                Clear Cache
              </button>
            </div>
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, index) => (
                <div
                  key={index}
                  className="group block rounded-xl border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 px-6 py-8 animate-pulse"
                >
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-gray-700"></div>
                    <div className="space-y-2">
                      <div className="h-6 w-16 bg-gray-300 dark:bg-gray-700 rounded"></div>
                      <div className="h-4 w-20 bg-gray-300 dark:bg-gray-700 rounded"></div>
                    </div>
                    <div className="flex flex-row gap-2 mt-2 w-full">
                      <div className="flex-1 h-10 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
                      <div className="flex-1 h-10 bg-gray-300 dark:bg-gray-700 rounded-lg"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {blokStatuses.map((blok) => (
                <div
                  key={blok.blokId}
                  className={`group block rounded-xl border shadow-theme-xs transition-all duration-200 hover:-translate-y-1 hover:shadow-theme-lg px-6 py-8 ${
                    blok.isGenerated
                      ? 'border-green-200 bg-white dark:border-green-800 dark:bg-white/[0.03] hover:border-green-500'
                      : 'border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 hover:border-orange-500'
                  }`}
                >
                  <div className="flex flex-col items-center text-center gap-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center transition-colors duration-200 ${
                      blok.isGenerated
                        ? 'bg-green-500 group-hover:bg-green-600'
                        : 'bg-orange-500 group-hover:bg-orange-600'
                    }`}>
                      {blok.isGenerated ? (
                        <FontAwesomeIcon icon={faCheckCircle} className="w-8 h-8 text-white" />
                      ) : (
                        <img src={BoxCubeIcon} alt="Cube Icon" className="w-8 h-8 filter invert" />
                      )}
                    </div>
                    <div>
                      <span className={`text-xl font-semibold block mb-1 ${
                        blok.isGenerated ? 'text-green-500' : 'text-orange-500'
                      }`}>
                        {blok.nama}
                      </span>
                      <div className="text-xs text-gray-500 dark:text-gray-400">
                        {blok.isGenerated ? (
                          <span className="text-green-600 dark:text-green-400">
                            {blok.assignmentCount} assignment
                          </span>
                        ) : (
                          <span className="text-orange-600 dark:text-orange-400">
                            Belum di-generate
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-row gap-2 mt-2 w-full">
                      <button
                        onClick={() => handleLihatDetail(blok.blokId)}
                        disabled={!blok.isGenerated}
                        className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition ${
                          blok.isGenerated
                            ? 'bg-brand-500 text-white hover:bg-brand-600'
                            : 'bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                        }`}
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
          )}
          
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

      {/* Clear Cache Modal */}
      <AnimatePresence>
        {showClearCacheModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={handleCancelClearCache}
            ></motion.div>
            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={handleCancelClearCache}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="w-6 h-6"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              
              <div>
                <div className="flex items-center justify-between pb-4 sm:pb-6">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                    Clear Cache
                  </h2>
                </div>
                
                <div className="mb-6">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-red-600 dark:text-red-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                        />
                      </svg>
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Konfirmasi Clear Cache
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Tindakan darurat untuk reset cache
                      </p>
                    </div>
                  </div>
                  
                  <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <svg
                        className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
                        />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-red-800 dark:text-red-200">
                          Peringatan Keadaan Darurat!
                        </p>
                        <p className="text-sm text-red-700 dark:text-red-300">
                          Tindakan ini akan menghapus semua cache status generate PBL. 
                          <strong> Sebelum melanjutkan, hubungi developer atau administrator sistem.</strong>
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    <p className="mb-2">Tindakan ini akan:</p>
                    <ul className="list-disc list-inside space-y-1 ml-2">
                      <li>Menghapus semua cache status generate PBL</li>
                      <li>Memaksa sistem untuk mengambil data fresh dari database</li>
                      <li>Mengembalikan semua blok ke status "Belum di-generate"</li>
                    </ul>
                  </div>
                </div>
                
                <div className="flex justify-end gap-2 pt-2 relative z-20">
                  <button
                    onClick={handleCancelClearCache}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-xs sm:text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 ease-in-out"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleConfirmClearCache}
                    className="px-3 sm:px-4 py-2 rounded-lg bg-red-600 text-white text-xs sm:text-sm font-medium shadow-theme-xs hover:bg-red-700 transition-all duration-300 ease-in-out relative z-10"
                  >
                    Ya, Clear Cache
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
