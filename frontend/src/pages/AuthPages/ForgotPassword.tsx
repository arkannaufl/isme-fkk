import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ThemeToggleButton } from "../../components/common/ThemeToggleButton";
import api, { handleApiError } from "../../utils/api";

export default function ForgotPassword() {
  const [login, setLogin] = useState("");
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const navigate = useNavigate();

  const handleRequestOtp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    setIsLoading(true);

    try {
      const response = await api.post("/forgot-password/request-otp", {
        login,
      });
      const { masked_email } = response.data;

      setSuccessMessage("Kode OTP telah dikirim ke email terverifikasi Anda.");

      // Arahkan ke halaman OTP terpisah sambil membawa informasi yang dibutuhkan
      navigate("/forgot-password/otp", {
        state: { login, masked: masked_email || "" },
        replace: true,
      });
    } catch (err) {
      // Jika backend mengembalikan pesan khusus (misal: belum punya email verifikasi), tampilkan apa adanya
      if (err.response?.data?.message) {
        setError(err.response.data.message);
      } else {
        const errorMessage = handleApiError(err, "Forgot Password");
        setError(errorMessage);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 z-0">
        <img
          src="/images/background/background-umj.jpg"
          alt="Background UMJ"
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
                  Lupa Password
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Masukkan username atau email Anda untuk menerima kode OTP
                  reset password.
                </p>
              </div>

              <form onSubmit={handleRequestOtp}>
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

                  <div>
                    <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium">
                      Username / Email / NIP / NID / NIM
                      <span className="text-error-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={login}
                      onChange={(e) => setLogin(e.target.value)}
                      placeholder="Masukkan username atau email terdaftar"
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <Link
                      to="/login"
                      className="text-brand-600 hover:text-brand-700"
                    >
                      Kembali ke Login
                    </Link>
                  </div>

                  <div>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className={`flex items-center justify-center w-full px-4 py-3 text-sm font-medium text-white transition rounded-lg bg-brand-500 shadow-theme-xs hover:bg-brand-600 ${
                        isLoading ? "opacity-70 cursor-not-allowed" : ""
                      }`}
                    >
                      {isLoading ? "Memproses..." : "Kirim Kode OTP"}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

          {/* Right: Logo & Grid (sama seperti halaman Login) */}
          <div className="hidden w-1/2 md:flex flex-col justify-center">
            <div className="relative flex items-center justify-center z-1">
              <div className="flex flex-col items-center max-w-md">
                <Link to="/" className="block mb-4">
                  <img
                    width={151}
                    height={48}
                    src="/images/logo/logo.svg"
                    alt="Logo"
                  />
                </Link>
                <div className="absolute right-0 top-0 -z-1 w-full max-w-[250px] xl:max-w-[450px]">
                  <img src="/images/shape/grid-01.svg" alt="grid" />
                </div>
                <div className="absolute bottom-0 left-0 -z-1 w-full max-w-[250px] rotate-180 xl:max-w-[450px]">
                  <img src="/images/shape/grid-01.svg" alt="grid" />
                </div>
                <p className="text-center text-gray-800 dark:text-white text-xl leading-relaxed mb-3 px-4">
                  Integrated System Medical Education Fakultas Kedokteran dan
                  Kesehatan Universitas Muhammadiyah Jakarta
                </p>
                <p className="text-center text-gray-400 dark:text-white/60">
                  Platform Terintegrasi untuk Presensi, Jadwal dan Evaluasi
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
