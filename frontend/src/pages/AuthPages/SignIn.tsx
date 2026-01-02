import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { EyeCloseIcon, EyeIcon } from "../../icons";
import { ThemeToggleButton } from "../../components/common/ThemeToggleButton";
import ForceLogoutModal from "../../components/common/ForceLogoutModal";
import api, { handleApiError } from "../../utils/api";
import { useTheme } from "../../context/ThemeContext";

export default function SignIn() {
  const [showPassword, setShowPassword] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showForceLogoutModal, setShowForceLogoutModal] = useState(false);

  const navigate = useNavigate();
  const { theme } = useTheme();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    // Simpan data login untuk force logout jika diperlukan
    localStorage.setItem("loginData", JSON.stringify({ login, password }));
    sessionStorage.setItem("loginData", JSON.stringify({ login, password }));

    try {
      const response = await api.post("/login", { login, password });
      const { access_token, user } = response.data;

      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(user));


      switch (user.role) {
        case "super_admin":
        case "dosen":
          navigate("/dashboard");
          break;
        case "tim_akademik":
          navigate("/tim-akademik");
          break;
        case "mahasiswa":
          navigate("/mahasiswa");
          break;
        default:
          navigate("/dashboard");
      }
    } catch (err: any) {
      console.error("Login error:", err);
      
      // Handle specific cases that need special handling
      if (err.response?.status === 403) {
        setShowForceLogoutModal(true);
        setError("Akun ini sedang digunakan di perangkat lain.");
      } else {
        // Use the centralized error handler for other cases
        const errorMessage = handleApiError(err, "Login");
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleForceLogoutSuccess = () => {
    setShowForceLogoutModal(false);
    setError("");
    // Retry login after force logout
    handleLogin({ preventDefault: () => {} } as React.FormEvent);
  };

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 z-0">
        <img
          src="/images/background/bg-login.png"
          alt="Background"
          className="object-cover w-full h-full blur-sm opacity-50"
        />
      </div>

      <div className="relative z-10 flex justify-center items-center min-h-screen px-4">
        <div className="flex w-full max-w-7xl rounded-2xl shadow-lg auth-card">
          <div className="flex flex-col justify-center w-full md:w-1/2">
            <div className="p-8 md:p-12">
              <div className="mb-5 sm:mb-8">
                <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
                  Login
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Enter your username and password to sign in!
                </p>
              </div>

              <form onSubmit={handleLogin}>
                <div className="space-y-5">
                  {error && (
                    <div className="text-sm text-red-500 bg-red-100 rounded p-2">
                      {error}
                    </div>
                  )}

                  <div>
                    <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium">
                      Username / NIP / NID / NIM<span className="text-error-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      placeholder="Masukkan username, NIP, NID, atau NIM"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium">
                      Password<span className="text-error-500">*</span>
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        required
                      />
                      <span
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute z-30 -translate-y-1/2 cursor-pointer right-4 top-1/2"
                      >
                        {showPassword ? (
                          <EyeIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                        ) : (
                          <EyeCloseIcon className="fill-gray-500 dark:fill-gray-400 size-5" />
                        )}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span />
                    <button
                      type="button"
                      onClick={() => navigate("/forgot-password")}
                      className="text-brand-600 hover:text-brand-700"
                    >
                      Lupa password?
                    </button>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600 ${
                        isLoading ? "opacity-70 cursor-not-allowed" : ""
                      }`}
                    >
                      {isLoading ? (
                        <>
                          <svg
                            className="w-5 h-5 mr-2 animate-spin text-white"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                          >
                            <circle
                              className="opacity-25"
                              cx="12"
                              cy="12"
                              r="10"
                              stroke="currentColor"
                              strokeWidth="4"
                            ></circle>
                            <path
                              className="opacity-75"
                              fill="currentColor"
                              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                            ></path>
                          </svg>
                          Memproses...
                        </>
                      ) : (
                        "Login"
                      )}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Right: Logo & Grid */}
          <div className="hidden w-1/2 md:flex flex-col justify-center relative min-h-full">
            {/* Grid di pojok kanan atas */}
            <div className="absolute right-0 top-0 z-0 opacity-30 w-full max-w-[250px] xl:max-w-[450px]">
              <img src="/images/shape/grid-01.svg" alt="grid" />
            </div>
            {/* Grid di pojok kiri bawah */}
            <div className="absolute bottom-0 left-0 z-0 opacity-30 w-full max-w-[250px] xl:max-w-[450px] rotate-180">
              <img src="/images/shape/grid-01.svg" alt="grid" />
            </div>
            <div className="relative flex items-center justify-center z-10">
              <div className="flex flex-col items-center max-w-md">
                <Link to="/" className="block mb-6 md:mb-7">
                  <img 
                    className="w-52 h-auto md:w-56 lg:w-60 xl:w-72 max-w-full"
                    src={theme === "dark" ? "/images/logo/logo-isme-dark.svg" : "/images/logo/logo-isme-light.svg"} 
                    alt="Logo" 
                  />
                </Link>
                <p className="text-center text-gray-800 dark:text-white text-lg md:text-xl leading-relaxed mb-2 px-4 font-semibold">
                  Integrated System Medical Education (ISME)
                </p>
                <p className="text-center text-gray-400 dark:text-white/60 text-sm md:text-base leading-relaxed px-4 max-w-sm">
                  Sistem Terpadu Untuk Manajemen Akademik Pendidikan Kedokteran
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Theme Toggle Button */}
      <div className="absolute z-20 bottom-4 right-4 lg:right-10 lg:bottom-10">
        <ThemeToggleButton />
      </div>
      
        <ForceLogoutModal
         isOpen={showForceLogoutModal}
         onClose={() => setShowForceLogoutModal(false)}
         onSuccess={handleForceLogoutSuccess}
         username={login}
       />
    </div>
  );
}
