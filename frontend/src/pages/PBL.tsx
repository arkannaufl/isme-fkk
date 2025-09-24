import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faEdit, faCheckCircle } from "@fortawesome/free-solid-svg-icons";
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
    console.log('🔄 Starting refresh blok status...');
    
    try {
      const statusPromises = blokList.map(async (blok) => {
        console.log(`🔍 Checking status for blok ${blok.blokId}...`);
        
        try {
          const response = await pblGenerateApi.checkGenerateStatus(blok.blokId);
          console.log(`✅ Response for blok ${blok.blokId}:`, response);
          console.log(`✅ Response data:`, response.data);
          
          // Debug: lihat struktur data yang sebenarnya
          const responseData = response.data;
          console.log(`🔍 Response structure:`, {
            success: responseData.success,
            data: responseData.data,
            hasData: !!responseData.data,
            isGenerated: responseData.data?.is_generated,
            assignmentCount: responseData.data?.assignment_count,
            message: responseData.data?.message
          });
          
          // Hanya gunakan data dari API (database)
          const isGenerated = responseData.success && responseData.data?.is_generated === true;
          const assignmentCount = responseData.data?.assignment_count || 0;
          const pblCount = responseData.data?.pbl_count || 0;
          const message = responseData.data?.message || 'Status unknown';
          
          console.log(`🎯 Processed data for blok ${blok.blokId}:`, {
            isGenerated,
            assignmentCount,
            pblCount,
            message
          });
          
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
          console.log(`🔄 Retrying for blok ${blok.blokId} in 2 seconds...`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          try {
            const retryResponse = await pblGenerateApi.checkGenerateStatus(blok.blokId);
            console.log(`✅ Retry successful for blok ${blok.blokId}:`, retryResponse.data);
            
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
      console.log('📊 Final statuses:', statuses);
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
            <div className="flex justify-center items-center py-12">
              <div className="w-8 h-8 border-4 border-brand-500 border-t-transparent rounded-full animate-spin"></div>
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
      {showClearCacheModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4">
            <div className="p-6">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Clear Cache
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Tindakan Darurat
                  </p>
                </div>
              </div>
              
              <div className="mb-6">
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <h4 className="text-sm font-semibold text-red-800 dark:text-red-200 mb-1">
                        ⚠️ Peringatan Keadaan Darurat
                      </h4>
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
              
              <div className="flex gap-3">
                <button
                  onClick={handleCancelClearCache}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors duration-200"
                >
                  Batal
                </button>
                <button
                  onClick={handleConfirmClearCache}
                  className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors duration-200"
                >
                  Ya, Clear Cache
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
