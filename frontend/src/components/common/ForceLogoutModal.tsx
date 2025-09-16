import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import api, { handleApiError } from "../../utils/api";

interface ForceLogoutModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  username?: string; // Tambahkan prop username
}

export default function ForceLogoutModal({ isOpen, onClose, onSuccess, username }: ForceLogoutModalProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleForceLogout = async () => {
    setIsLoading(true);
    try {
      // Prioritas 1: Gunakan username dari prop (paling reliable)
      if (username) {
        await api.post("/force-logout-by-username", { username });
        onSuccess();
        return;
      }
      
      // Prioritas 2: Ambil user dari localStorage
      const userStr = localStorage.getItem('user');
      if (userStr) {
        const user = JSON.parse(userStr);
        await api.post("/force-logout-by-user", { user_id: user.id });
        onSuccess();
        return;
      }
      
      // Prioritas 3: Gunakan token untuk force logout
      const token = localStorage.getItem('token');
      if (token) {
        await api.post("/force-logout-by-token", { token });
        onSuccess();
        return;
      }
      
      // Prioritas 4: Coba ambil dari localStorage loginData
      const loginData = localStorage.getItem('loginData');
      if (loginData) {
        const { login } = JSON.parse(loginData);
        await api.post("/force-logout-by-username", { username: login });
        onSuccess();
        return;
      }
      
      // Prioritas 5: Coba ambil dari sessionStorage
      const sessionLoginData = sessionStorage.getItem('loginData');
      if (sessionLoginData) {
        const { login } = JSON.parse(sessionLoginData);
        await api.post("/force-logout-by-username", { username: login });
        onSuccess();
        return;
      }
      
      // Fallback: prompt user untuk username
      const promptedUsername = prompt("Masukkan username/NIP/NID/NIM untuk force logout:");
      if (promptedUsername) {
        await api.post("/force-logout-by-username", { username: promptedUsername });
        onSuccess();
      } else {
        throw new Error("Username diperlukan untuk force logout");
      }
      
    } catch (error: any) {
      console.error("Force logout failed:", error);
      alert("Gagal melakukan force logout. Silakan coba lagi.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center">
          <div className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md" />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] flex flex-col items-center"
          >
            <div className="flex flex-col items-center w-full">
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-orange-100 rounded-full dark:bg-orange-900">
                <svg
                  className="w-8 h-8 text-orange-500 dark:text-orange-300"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white text-center">
                Akun Sedang Digunakan
              </h3>
              <p className="mb-6 text-gray-500 dark:text-gray-400 text-center">
                Akun ini sedang digunakan di perangkat lain. Anda dapat memaksa logout dari perangkat lain untuk melanjutkan login.
              </p>
              <div className="flex gap-3 w-full">
                <button
                  onClick={onClose}
                  className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 dark:text-gray-300 dark:bg-gray-800 dark:hover:bg-gray-700"
                >
                  Batal
                </button>
                <button
                  onClick={handleForceLogout}
                  disabled={isLoading}
                  className={`flex-1 px-4 py-2 text-sm font-medium text-white bg-orange-500 rounded-lg hover:bg-orange-600 ${
                    isLoading ? "opacity-70 cursor-not-allowed" : ""
                  }`}
                >
                  {isLoading ? "Memproses..." : "Force Logout"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
