import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTools } from "@fortawesome/free-solid-svg-icons";
import { setMaintenanceMode, getMaintenanceMode } from "../common/MaintenanceGuard";

export default function MaintenanceToggle() {
  const [isMaintenanceMode, setIsMaintenanceMode] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    // Load current maintenance mode status
    setIsMaintenanceMode(getMaintenanceMode());
  }, []);

  const handleToggleMaintenance = async () => {
    setIsLoading(true);
    
    try {
      const newMode = !isMaintenanceMode;
      setMaintenanceMode(newMode);
      setIsMaintenanceMode(newMode);
      
      // Show success message
      const message = newMode 
        ? "Maintenance mode diaktifkan. Sistem PBL, CSR, dan Peta Blok akan menampilkan halaman perbaikan." 
        : "Maintenance mode dinonaktifkan. Sistem PBL, CSR, dan Peta Blok kembali normal.";
      
      alert(message);
    } catch (error) {
      console.error("Error toggling maintenance mode:", error);
      alert("Terjadi kesalahan saat mengubah maintenance mode.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="flex items-center justify-center w-10 h-10 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
            <FontAwesomeIcon 
              icon={faTools} 
              className="text-orange-600 dark:text-orange-400"
            />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Maintenance Mode
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {isMaintenanceMode 
                ? "Sistem PBL, CSR, dan Peta Blok sedang dalam mode perbaikan" 
                : "Sistem PBL, CSR, dan Peta Blok berjalan normal"
              }
            </p>
          </div>
        </div>
        
        <button
          onClick={handleToggleMaintenance}
          disabled={isLoading}
          className={`
            relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2
            ${isMaintenanceMode 
              ? 'bg-orange-600' 
              : 'bg-gray-200 dark:bg-gray-600'
            }
            ${isLoading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          `}
        >
          <span
            className={`
              inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 ease-in-out
              ${isMaintenanceMode ? 'translate-x-6' : 'translate-x-1'}
            `}
          />
        </button>
      </div>
      
      <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>Catatan:</strong> Ketika maintenance mode diaktifkan, semua halaman PBL akan menampilkan halaman perbaikan. 
          Mode ini berguna saat ada bug yang perlu diperbaiki sebelum deploy.
        </p>
      </div>
    </div>
  );
}
