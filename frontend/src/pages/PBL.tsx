import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCog, faEdit, faExclamationTriangle, faCheckCircle } from "@fortawesome/free-solid-svg-icons";
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

  // Fungsi untuk refresh status blok
  const refreshBlokStatus = async () => {
    setLoading(true);
    console.log('🔄 Starting refresh blok status...');
    
    try {
      const statusPromises = blokList.map(async (blok) => {
        console.log(`🔍 Checking status for blok ${blok.blokId}...`);
        
        try {
          const response = await pblGenerateApi.checkGenerateStatus(blok.blokId);
          console.log(`✅ Response for blok ${blok.blokId}:`, response.data);
          
          // Debug: lihat struktur data yang sebenarnya
          const responseData = response.data;
          console.log(`🔍 Response structure:`, {
            success: responseData.success,
            data: responseData.data,
            hasData: !!responseData.data,
            isGenerated: responseData.data?.is_generated,
            assignmentCount: responseData.data?.assignment_count
          });
          
          // Cek localStorage dulu untuk override
          const storedStatus = localStorage.getItem(`pbl_generated_${blok.blokId}`);
          const isStoredGenerated = storedStatus === 'true';
          
          // Pastikan data ada dan valid
          const apiGenerated = responseData.success && responseData.data?.is_generated === true;
          const isGenerated = isStoredGenerated || apiGenerated; // Prioritas localStorage
          const assignmentCount = isStoredGenerated ? 1 : (responseData.data?.assignment_count || 0);
          const pblCount = responseData.data?.pbl_count || 0;
          const message = isStoredGenerated ? 'Generated (from cache)' : (responseData.data?.message || 'Status unknown');
          
          console.log(`🎯 Processed data for blok ${blok.blokId}:`, {
            isGenerated,
            assignmentCount,
            pblCount,
            message,
            isStoredGenerated,
            apiGenerated
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
            
            // Fallback: cek localStorage untuk status generate
            const storedStatus = localStorage.getItem(`pbl_generated_${blok.blokId}`);
            const isStoredGenerated = storedStatus === 'true';
            
            console.log(`🔍 Fallback check for blok ${blok.blokId}:`, { storedStatus, isStoredGenerated });
            
            return {
              blokId: blok.blokId,
              nama: blok.nama,
              isGenerated: isStoredGenerated,
              assignmentCount: isStoredGenerated ? 1 : 0,
              pblCount: isStoredGenerated ? 1 : 0,
              message: isStoredGenerated ? 'Generated (from cache)' : 'Error checking status'
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
          </div>
        </div>
        <div className="p-6">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
              {[1, 2, 3, 4].map((index) => (
                <div
                  key={index}
                  className="group block rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-white/[0.03] px-6 py-8 animate-pulse"
                >
                  <div className="flex flex-col items-center text-center gap-4">
                    {/* Skeleton Icon */}
                    <div className="w-16 h-16 rounded-full bg-gray-300 dark:bg-gray-700"></div>
                    
                    {/* Skeleton Text */}
                    <div className="space-y-2 w-full">
                      <div className="h-6 bg-gray-300 dark:bg-gray-700 rounded w-20 mx-auto"></div>
                      <div className="h-4 bg-gray-300 dark:bg-gray-700 rounded w-24 mx-auto"></div>
                    </div>
                    
                    {/* Skeleton Buttons */}
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
                            Sudah di-generate
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
    </div>
  );
}
