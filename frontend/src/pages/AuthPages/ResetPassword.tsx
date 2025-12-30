import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ThemeToggleButton } from "../../components/common/ThemeToggleButton";
import api, { handleApiError } from "../../utils/api";
import { useTheme } from "../../context/ThemeContext";

interface LocationState {
  login?: string;
  otp?: string;
  masked?: string;
}

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const state = (location.state as LocationState) || {};
  const login = state.login || "";
  const otp = state.otp || "";
  const maskedEmail = state.masked || "";

  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Jika akses langsung tanpa data OTP/login, arahkan balik
  useEffect(() => {
    if (!login || !otp) {
      navigate("/forgot-password", { replace: true });
    }
  }, [login, otp, navigate]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");

    if (!password.trim() || !passwordConfirmation.trim()) {
      setError("Password baru dan konfirmasi wajib diisi.");
      return;
    }
    if (password !== passwordConfirmation) {
      setError("Konfirmasi password tidak sama.");
      return;
    }

    try {
      setIsSubmitting(true);

      // 1. Reset password dengan OTP
      await api.post("/forgot-password/reset-with-otp", {
        login,
        otp,
        password,
        password_confirmation: passwordConfirmation,
      });

      // 2. Auto-login dengan password baru
      const loginResp = await api.post("/login", { login, password });
      const { access_token, user } = loginResp.data;

      localStorage.setItem("token", access_token);
      localStorage.setItem("user", JSON.stringify(user));

      setSuccessMessage("Password berhasil direset. Mengarahkan ke dashboard...");

      // 3. Redirect sesuai role
      setTimeout(() => {
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
      }, 1200);
    } catch (err) {
      setIsSubmitting(false);

      if ((err as any)?.response?.data?.message) {
        setError((err as any).response.data.message);
      } else {
        const errorMessage = handleApiError(err, "Reset Password");
        setError(errorMessage);
      }
    }
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
          {/* Left: Form */}
          <div className="flex flex-col justify-center w-full md:w-1/2">
            <div className="p-8 md:p-12">
              <div className="mb-5 sm:mb-8">
                <h1 className="mb-2 font-semibold text-gray-800 text-title-sm dark:text-white/90 sm:text-title-md">
                  Reset Password
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Masukkan password baru Anda untuk menyelesaikan reset.
                </p>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="space-y-5">
                  {error && (
                    <div className="text-sm text-red-500 bg-red-100 rounded p-2">
                      {error}
                    </div>
                  )}
                  {successMessage && (
                    <div className="text-sm text-emerald-600 bg-emerald-50 rounded p-2">
                      {successMessage}
                    </div>
                  )}

                  {maskedEmail && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      OTP diverifikasi untuk email:{" "}
                      <span className="font-semibold">{maskedEmail}</span>
                    </p>
                  )}

                  <div>
                    <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium">
                      Password Baru<span className="text-error-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Masukkan password baru"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>

                  <div>
                    <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium">
                      Konfirmasi Password Baru
                      <span className="text-error-500">*</span>
                    </label>
                    <input
                      type="password"
                      value={passwordConfirmation}
                      onChange={(e) => setPasswordConfirmation(e.target.value)}
                      placeholder="Ulangi password baru"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <button
                      type="button"
                      onClick={() => navigate("/forgot-password")}
                      className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                    >
                      Kembali ke awal (minta OTP)
                    </button>
                    <Link
                      to="/login"
                      className="text-brand-600 hover:text-brand-700"
                    >
                      Batal
                    </Link>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600 ${
                        isSubmitting ? "opacity-70 cursor-not-allowed" : ""
                      }`}
                    >
                      {isSubmitting ? "Memproses..." : "Simpan & Masuk"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Right: Logo & Grid (sama seperti halaman Login) */}
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
    </div>
  );
}


