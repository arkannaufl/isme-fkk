import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useSession } from "../../context/SessionContext";
import { useEffect, useState } from "react";

interface SessionExpiredModalProps {
  isOpen: boolean;
}

export default function SessionExpiredModal({ isOpen }: SessionExpiredModalProps) {
  const navigate = useNavigate();
  const { setSessionExpired } = useSession();
  const [message, setMessage] = useState("Sesi Anda telah berakhir. Silakan login kembali untuk melanjutkan.");

  useEffect(() => {
    const handleSessionExpired = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail?.message) {
        setMessage(customEvent.detail.message);
      }
    };

    window.addEventListener('sessionExpired', handleSessionExpired);
    return () => {
      window.removeEventListener('sessionExpired', handleSessionExpired);
    };
  }, []);

  const handleLogin = () => {
    setSessionExpired(false);
    navigate("/login");
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
              <div className="flex items-center justify-center w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full dark:bg-red-900">
                <svg
                  className="w-8 h-8 text-red-500 dark:text-red-300"
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
                Sesi Anda Telah Berakhir
              </h3>
              <p className="mb-6 text-gray-500 dark:text-gray-400 text-center">
                {message}
              </p>
              <button
                onClick={handleLogin}
                className="px-4 py-2 text-sm font-medium text-white transition-colors rounded-lg bg-brand-500 hover:bg-brand-600 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 mx-auto"
                style={{ display: 'block' }}
              >
                Login Kembali
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
} 
