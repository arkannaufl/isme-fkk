import React from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTools,
  faExclamationTriangle,
} from "@fortawesome/free-solid-svg-icons";

interface MaintenancePageProps {
  title?: string;
  message?: string;
  showIcon?: boolean;
}

export default function MaintenancePage({
  title = "Sedang Dalam Perbaikan",
  message = "Sistem sedang dalam proses perbaikan untuk memberikan pengalaman yang lebih baik. Mohon maaf atas ketidaknyamanan ini.",
  showIcon = true,
}: MaintenancePageProps) {
  return (
    <div className="min-h-screen bg-white dark:bg-gray-900 flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 text-center">
          {/* Icon */}
          {showIcon && (
            <div className="mb-6">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full mb-4">
                <FontAwesomeIcon
                  icon={faTools}
                  className="text-3xl text-orange-600 dark:text-orange-400"
                />
              </div>
            </div>
          )}

          {/* Title */}
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
            {title}
          </h1>

          {/* Message */}
          <p className="text-lg text-gray-600 dark:text-gray-300 mb-6 leading-relaxed">
            {message}
          </p>

          {/* Additional Info */}
          <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <FontAwesomeIcon
                icon={faExclamationTriangle}
                className="text-yellow-600 dark:text-yellow-400 mt-1 flex-shrink-0"
              />
              <div className="text-left">
                <p className="text-sm text-yellow-800 dark:text-yellow-200 font-medium mb-1">
                  Informasi Penting
                </p>
                <p className="text-sm text-yellow-700 dark:text-yellow-300">
                  Data yang sudah tersimpan akan tetap aman. Silakan coba lagi
                  nanti atau hubungi{" "}
                  <a
                    href="/support-center"
                    className="text-yellow-800 dark:text-yellow-200 font-medium underline hover:text-yellow-900 dark:hover:text-yellow-100 transition-colors"
                  >
                    Service Center
                  </a>{" "}
                  jika ada pertanyaan mendesak.
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors duration-200"
            >
              Coba Lagi
            </button>
            <button
              onClick={() => window.history.back()}
              className="px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 font-medium rounded-lg transition-colors duration-200"
            >
              Kembali
            </button>
          </div>

          {/* Footer */}
          <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Terima kasih atas kesabaran Anda. Tim kami sedang bekerja keras
              untuk memperbaiki sistem.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
