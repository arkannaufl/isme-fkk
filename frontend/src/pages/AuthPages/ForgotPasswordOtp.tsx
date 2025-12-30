import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { ThemeToggleButton } from "../../components/common/ThemeToggleButton";
import api, { handleApiError } from "../../utils/api";
import { useTheme } from "../../context/ThemeContext";

const OTP_LENGTH = 6;

export default function ForgotPasswordOtp() {
  const location = useLocation();
  const navigate = useNavigate();
  const { theme } = useTheme();

  const state = (location.state as { login?: string; masked?: string }) || {};
  const initialLogin = state.login || "";
  const initialMasked = state.masked || "";

  const [login] = useState(initialLogin);
  const [maskedEmail] = useState(initialMasked);
  const [otpDigits, setOtpDigits] = useState<string[]>(
    Array(OTP_LENGTH).fill("")
  );
  const [error, setError] = useState("");
  const [infoMessage, setInfoMessage] = useState(
    maskedEmail ? "Kode OTP telah dikirim ke email terverifikasi Anda." : ""
  );
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastSubmittedOtp, setLastSubmittedOtp] = useState("");

  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  // Jika login tidak ada (akses langsung), arahkan balik ke halaman forgot password
  useEffect(() => {
    if (!initialLogin) {
      navigate("/forgot-password", { replace: true });
    }
  }, [initialLogin, navigate]);

  // Auto-hide info message after 3s
  useEffect(() => {
    if (!infoMessage) return;
    const t = setTimeout(() => setInfoMessage(""), 3000);
    return () => clearTimeout(t);
  }, [infoMessage]);

  const otpValue = useMemo(() => otpDigits.join("").trim(), [otpDigits]);

  const handleChange = (value: string, index: number) => {
    const sanitized = value.replace(/\D/g, "").slice(0, 1);
    const nextDigits = [...otpDigits];
    nextDigits[index] = sanitized;
    setOtpDigits(nextDigits);
    if (error) setError("");

    if (sanitized && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (
    e: React.KeyboardEvent<HTMLInputElement>,
    index: number
  ) => {
    if (e.key === "Backspace" && !otpDigits[index] && index > 0) {
      const prevIndex = index - 1;
      const nextDigits = [...otpDigits];
      nextDigits[prevIndex] = "";
      setOtpDigits(nextDigits);
      inputRefs.current[prevIndex]?.focus();
    }
  };

  // Auto verify when OTP length complete
  useEffect(() => {
    const submitIfReady = async () => {
      if (otpValue.length !== OTP_LENGTH) return;
      if (isVerifying) return;
      if (otpValue === lastSubmittedOtp) return;

      setError("");
      setInfoMessage("");
      setIsVerifying(true);
      setLastSubmittedOtp(otpValue);
      try {
        const resp = await api.post(
          "/forgot-password/verify-otp",
          { login, otp: otpValue },
          { validateStatus: () => true }
        );

        if (resp.status === 200) {
          navigate("/forgot-password/new-password", {
            state: { login, otp: otpValue, masked: maskedEmail },
            replace: true,
          });
          return;
        }

        // Non-200: tampilkan pesan tanpa melempar error ke console
        if (resp.status === 429) {
          setError(
            "Terlalu banyak percobaan. Silakan tunggu 1 menit sebelum mencoba lagi."
          );
        } else if (resp.data?.message) {
          setError(resp.data.message);
        } else {
          setError("Kode OTP tidak valid. Silakan coba lagi.");
        }
      } catch (err: unknown) {
        setError(handleApiError(err, "Verify OTP"));
      } finally {
        setIsVerifying(false);
      }
    };
    submitIfReady();
  }, [otpValue, isVerifying, login, maskedEmail, navigate, lastSubmittedOtp]);

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
                  Lupa Password
                </h1>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Masukkan kode OTP yang dikirim ke email terverifikasi Anda.
                </p>
              </div>

              <div className="space-y-5">
                {error && (
                  <div className="text-sm text-red-500 bg-red-100 rounded p-2">
                    {error}
                  </div>
                )}
                {infoMessage && (
                  <div className="text-sm text-emerald-600 bg-emerald-50 rounded p-2">
                    {infoMessage}
                  </div>
                )}

                {maskedEmail && (
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Kami telah mengirim kode OTP ke email:{" "}
                    <span className="font-semibold">{maskedEmail}</span>
                  </p>
                )}

                <div>
                  <label className="block mb-2 text-gray-700 dark:text-gray-300 font-medium">
                    Kode OTP<span className="text-error-500">*</span>
                  </label>
                  <div className="grid grid-cols-6 gap-3 max-w-md">
                    {Array.from({ length: OTP_LENGTH }).map((_, idx) => (
                      <input
                        key={idx}
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        maxLength={1}
                        value={otpDigits[idx]}
                        onChange={(e) => handleChange(e.target.value, idx)}
                        onKeyDown={(e) => handleKeyDown(e, idx)}
                        ref={(el) => {
                          inputRefs.current[idx] = el;
                        }}
                        className="h-12 text-center text-lg font-semibold tracking-[0.2em] rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        disabled={isVerifying}
                        autoFocus={idx === 0}
                      />
                    ))}
                  </div>
                  <p className="mt-2 text-xs text-gray-400">
                    OTP berisi 6 digit angka dan berlaku 10 menit.
                  </p>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                  >
                    Ganti akun / kirim ulang OTP
                  </button>
                  <Link
                    to="/login"
                    className="text-brand-600 hover:text-brand-700"
                  >
                    Kembali ke Login
                  </Link>
                </div>
              </div>
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
