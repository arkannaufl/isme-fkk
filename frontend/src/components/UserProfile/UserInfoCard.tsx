import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router";
import api, { handleApiError } from "../../utils/api";
import { AnimatePresence, motion } from "framer-motion";
import { EyeIcon, EyeCloseIcon } from "../../icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCheckCircle } from "@fortawesome/free-solid-svg-icons";

export default function UserInfoCard() {
  const navigate = useNavigate();
  const [user, setUser] = useState<any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "",
    username: "",
    email: "",
    telp: "",
    ket: "",
    current_password: "",
    new_password: "",
    confirm_password: "",
    // WhatsApp fields (wajib untuk dosen)
    whatsapp_phone: "",
    whatsapp_email: "",
    whatsapp_address: "",
    whatsapp_birth_day: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [phoneError, setPhoneError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [checkingEmail, setCheckingEmail] = useState(false);

  useEffect(() => {
    const loadUserData = async () => {
      try {
        // Ambil data user terbaru dari API
        const response = await api.get("/profile");
        const userData = response.data.user;

        // Update localStorage dengan data terbaru
        localStorage.setItem("user", JSON.stringify(userData));
        setUser(userData);
        // Telp diambil dari whatsapp_phone (sinkronisasi) - sama seperti email
        const telpFromWhatsApp = userData.whatsapp_phone
          ? userData.whatsapp_phone.replace(/^62/, "0") // Convert 62 ke 0 untuk telp
          : userData.telp || "";

        // Format whatsapp_birth_day untuk input type="date" (YYYY-MM-DD)
        let formattedBirthDay = "";
        if (userData.whatsapp_birth_day) {
          // Jika sudah format YYYY-MM-DD, gunakan langsung
          if (
            typeof userData.whatsapp_birth_day === "string" &&
            userData.whatsapp_birth_day.match(/^\d{4}-\d{2}-\d{2}$/)
          ) {
            formattedBirthDay = userData.whatsapp_birth_day;
          } else if (userData.whatsapp_birth_day instanceof Date) {
            // Jika Date object, convert ke YYYY-MM-DD
            formattedBirthDay = userData.whatsapp_birth_day
              .toISOString()
              .split("T")[0];
          } else if (typeof userData.whatsapp_birth_day === "string") {
            // Jika string dengan format lain, coba parse
            try {
              const dateObj = new Date(userData.whatsapp_birth_day);
              if (!isNaN(dateObj.getTime())) {
                formattedBirthDay = dateObj.toISOString().split("T")[0];
              }
            } catch {
              // Jika gagal, gunakan string asli
              formattedBirthDay = userData.whatsapp_birth_day;
            }
          }
        }

        setForm({
          name: userData.name || "",
          username: userData.username || "",
          email: userData.email || "",
          telp: telpFromWhatsApp, // Get dari whatsapp_phone (sinkronisasi)
          ket: userData.ket || "",
          current_password: "",
          new_password: "",
          confirm_password: "",
          whatsapp_phone: userData.whatsapp_phone || "",
          whatsapp_email: userData.whatsapp_email || userData.email || "",
          whatsapp_address: userData.whatsapp_address || "",
          whatsapp_birth_day: formattedBirthDay, // Format untuk input type="date"
        });
      } catch (error) {
        // Fallback ke localStorage jika API gagal
        console.error("Error loading user data:", error);
        const userData = JSON.parse(localStorage.getItem("user") || "{}");
        setUser(userData);
        // Telp diambil dari whatsapp_phone (sinkronisasi) - sama seperti email
        const telpFromWhatsApp = userData.whatsapp_phone
          ? userData.whatsapp_phone.replace(/^62/, "0") // Convert 62 ke 0 untuk telp
          : userData.telp || "";

        // Format whatsapp_birth_day untuk input type="date" (YYYY-MM-DD)
        let formattedBirthDay = "";
        if (userData.whatsapp_birth_day) {
          // Jika sudah format YYYY-MM-DD, gunakan langsung
          if (
            typeof userData.whatsapp_birth_day === "string" &&
            userData.whatsapp_birth_day.match(/^\d{4}-\d{2}-\d{2}$/)
          ) {
            formattedBirthDay = userData.whatsapp_birth_day;
          } else if (userData.whatsapp_birth_day instanceof Date) {
            // Jika Date object, convert ke YYYY-MM-DD
            formattedBirthDay = userData.whatsapp_birth_day
              .toISOString()
              .split("T")[0];
          } else if (typeof userData.whatsapp_birth_day === "string") {
            // Jika string dengan format lain, coba parse
            try {
              const dateObj = new Date(userData.whatsapp_birth_day);
              if (!isNaN(dateObj.getTime())) {
                formattedBirthDay = dateObj.toISOString().split("T")[0];
              }
            } catch {
              // Jika gagal, gunakan string asli
              formattedBirthDay = userData.whatsapp_birth_day;
            }
          }
        }

        setForm({
          name: userData.name || "",
          username: userData.username || "",
          email: userData.email || "",
          telp: telpFromWhatsApp, // Get dari whatsapp_phone (sinkronisasi)
          ket: userData.ket || "",
          current_password: "",
          new_password: "",
          confirm_password: "",
          whatsapp_phone: userData.whatsapp_phone || "",
          whatsapp_email: userData.whatsapp_email || userData.email || "",
          whatsapp_address: userData.whatsapp_address || "",
          whatsapp_birth_day: formattedBirthDay, // Format untuk input type="date"
        });
      }
    };

    loadUserData();

    // Listener untuk event user-updated (dari email verification)
    const handleUserUpdate = () => {
      loadUserData();
    };

    window.addEventListener("user-updated", handleUserUpdate);

    return () => {
      window.removeEventListener("user-updated", handleUserUpdate);
    };
  }, []);

  // Debounce helper function (must be defined before useCallback hooks)
  const debounce = useCallback((func: (args: any[]) => void, wait: number) => {
    let timeout: NodeJS.Timeout;
    return function executedFunction(...args: any[]) {
      const later = () => {
        clearTimeout(timeout);
        func(args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }, []);

  // Check phone availability
  const checkPhoneAvailability = useCallback(
    async (phone: string) => {
      if (!phone || !phone.match(/^62\d+$/)) {
        setPhoneError("");
        return;
      }

      // Jika nomor sama dengan yang sudah ada, tidak perlu check
      if (phone === user?.whatsapp_phone) {
        setPhoneError("");
        return;
      }

      setCheckingPhone(true);
      try {
        const response = await api.get(
          `/profile/check-availability?phone=${encodeURIComponent(phone)}`
        );
        if (!response.data.phone_available) {
          setPhoneError(
            response.data.phone_message ||
              "Nomor WhatsApp ini sudah digunakan oleh user lain."
          );
        } else {
          setPhoneError("");
        }
      } catch (error) {
        console.error("Error checking phone:", error);
        setPhoneError("");
      } finally {
        setCheckingPhone(false);
      }
    },
    [user?.whatsapp_phone]
  );

  // Check email availability
  const checkEmailAvailability = useCallback(
    async (email: string) => {
      if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
        setEmailError("");
        return;
      }

      // Jika email sama dengan yang sudah ada, tidak perlu check
      if (email === user?.email) {
        setEmailError("");
        return;
      }

      setCheckingEmail(true);
      try {
        const response = await api.get(
          `/profile/check-availability?email=${encodeURIComponent(email)}`
        );
        if (!response.data.email_available) {
          setEmailError(
            response.data.email_message ||
              "Email ini sudah digunakan oleh user lain."
          );
        } else {
          setEmailError("");
        }
      } catch (error) {
        console.error("Error checking email:", error);
        setEmailError("");
      } finally {
        setCheckingEmail(false);
      }
    },
    [user?.email]
  );

  // Debounced versions - use useRef to store debounced functions
  const debouncedCheckPhoneRef = useRef<((args: any[]) => void) | null>(null);
  const debouncedCheckEmailRef = useRef<((args: any[]) => void) | null>(null);

  useEffect(() => {
    debouncedCheckPhoneRef.current = debounce(
      (args: any[]) => checkPhoneAvailability(args[0]),
      500
    );
    debouncedCheckEmailRef.current = debounce(
      (args: any[]) => checkEmailAvailability(args[0]),
      500
    );
  }, [checkPhoneAvailability, checkEmailAvailability, debounce]);

  if (!user) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const openModal = () => {
    // Telp diambil dari whatsapp_phone (sinkronisasi)
    const telpFromWhatsApp = user.whatsapp_phone
      ? user.whatsapp_phone.replace(/^62/, "0") // Convert 62 ke 0 untuk telp
      : user.telp || "";

    // Format whatsapp_birth_day untuk input type="date" (YYYY-MM-DD)
    let formattedBirthDay = "";
    if (user.whatsapp_birth_day) {
      // Jika sudah format YYYY-MM-DD, gunakan langsung
      if (
        typeof user.whatsapp_birth_day === "string" &&
        user.whatsapp_birth_day.match(/^\d{4}-\d{2}-\d{2}$/)
      ) {
        formattedBirthDay = user.whatsapp_birth_day;
      } else if (user.whatsapp_birth_day instanceof Date) {
        // Jika Date object, convert ke YYYY-MM-DD
        formattedBirthDay = user.whatsapp_birth_day.toISOString().split("T")[0];
      } else if (typeof user.whatsapp_birth_day === "string") {
        // Jika string dengan format lain, coba parse
        try {
          const dateObj = new Date(user.whatsapp_birth_day);
          if (!isNaN(dateObj.getTime())) {
            formattedBirthDay = dateObj.toISOString().split("T")[0];
          }
        } catch {
          // Jika gagal, gunakan string asli
          formattedBirthDay = user.whatsapp_birth_day;
        }
      }
    }

    setForm({
      name: user.name || "",
      username: user.username || "",
      email: user.email || "",
      telp: telpFromWhatsApp, // Get dari whatsapp_phone
      ket: user.ket || "",
      current_password: "",
      new_password: "",
      confirm_password: "",
      whatsapp_phone: user.whatsapp_phone || "",
      whatsapp_email: user.whatsapp_email || user.email || "",
      whatsapp_address: user.whatsapp_address || "",
      whatsapp_birth_day: formattedBirthDay, // Format untuk input type="date"
    });
    setIsModalOpen(true);
    setError("");
    setPhoneError("");
    setEmailError("");
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError("");

    // Cek apakah ada error validasi
    if (phoneError || emailError) {
      setError("Silakan perbaiki error di atas sebelum menyimpan.");
      setSaving(false);
      return;
    }

    if (form.new_password && form.new_password !== form.confirm_password) {
      setError("Konfirmasi password baru tidak sama.");
      setSaving(false);
      return;
    }
    if (form.new_password && !form.current_password) {
      setError("Password saat ini harus diisi untuk mengubah password.");
      setSaving(false);
      return;
    }

    // Validasi untuk dosen: WhatsApp fields wajib
    const isDosen = user?.role === "dosen";
    if (isDosen) {
      if (!form.whatsapp_phone || !form.whatsapp_phone.match(/^62\d+$/)) {
        setError(
          "Nomor WhatsApp wajib diisi dan harus dimulai dengan 62 (contoh: 6281234567890)."
        );
        setSaving(false);
        return;
      }
      // WhatsApp email selalu sama dengan email verification (auto-sync di onChange)
      // Tidak perlu validasi lagi karena sudah dihandle di onChange email
      if (!form.whatsapp_address) {
        setError("Alamat wajib diisi untuk dosen.");
        setSaving(false);
        return;
      }
      if (!form.whatsapp_birth_day) {
        setError("Tanggal lahir wajib diisi untuk dosen.");
        setSaving(false);
        return;
      }
    }

    try {
      const payload: any = {
        name: form.name,
        username: form.username,
        email: form.email,
        telp: form.telp,
        ket: form.ket,
      };

      // Tambah WhatsApp fields
      if (isDosen || form.whatsapp_phone) {
        payload.whatsapp_phone = form.whatsapp_phone;
        payload.whatsapp_email = form.email; // Selalu sama dengan email verification
        payload.whatsapp_address = form.whatsapp_address;
        payload.whatsapp_birth_day = form.whatsapp_birth_day;

        // Sinkronisasi telp dengan whatsapp_phone (convert 62 ke 0)
        if (form.whatsapp_phone) {
          payload.telp = form.whatsapp_phone.replace(/^62/, "0");
        }
      }

      if (form.new_password) {
        payload.current_password = form.current_password;
        payload.password = form.new_password;
        payload.confirm_password = form.confirm_password;
      }

      const response = await api.put("/profile", payload);
      const updatedUser = response.data.user;
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      window.dispatchEvent(new Event("user-updated"));

      // Show success modal jika sync ke Wablas berhasil
      if (isDosen && response.data.wablas_synced) {
        setIsModalOpen(false); // Tutup modal edit dulu
        setShowSuccessModal(true); // Tampilkan success modal
      } else {
        // Jika tidak sync ke Wablas, tutup modal langsung
        setIsModalOpen(false);
      }
    } catch (err: any) {
      const errorMessage =
        err.response?.data?.message ||
        err.response?.data?.errors ||
        "Failed to update profile";
      setError(
        typeof errorMessage === "string"
          ? errorMessage
          : JSON.stringify(errorMessage)
      );
    } finally {
      setSaving(false);
    }
  };

  const renderUserInfo = () => {
    const commonFields = [
      { label: "Nama", value: user.name },
      { label: "Username", value: user.username },
      { label: "Email", value: user.email },
      { label: "Role", value: user.role },
    ];

    const roleSpecificFields = {
      super_admin: [
        { label: "No. Telepon", value: user.telp },
        { label: "Posisi/Jabatan", value: user.ket },
      ],
      tim_akademik: [
        { label: "NIP", value: user.nip },
        { label: "No. Telepon", value: user.telp },
        { label: "Keterangan", value: user.ket },
      ],
      dosen: [
        { label: "NID", value: user.nid },
        { label: "NIDN", value: user.nidn },
        { label: "No. Telepon", value: user.telp },
        { label: "Kompetensi", value: user.kompetensi },
        { label: "Keahlian", value: user.keahlian },
        { label: "Peran dalam Kurikulum", value: user.peran_kurikulum },
      ],
      mahasiswa: [
        { label: "NIM", value: user.nim },
        { label: "Gender", value: user.gender },
        { label: "IPK", value: user.ipk },
        { label: "Status", value: user.status },
        { label: "Angkatan", value: user.angkatan },
        { label: "No. Telepon", value: user.telp },
      ],
    };

    const allFields = [
      ...commonFields,
      ...(roleSpecificFields[user.role as keyof typeof roleSpecificFields] ||
        []),
    ];

    return (
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:gap-7 w-full md:max-w-xl">
        {allFields.map((field, index) => (
          <div key={index}>
            <p className="mb-2 text-xs leading-normal text-gray-500 dark:text-gray-400">
              {field.label}
            </p>
            <p className="text-sm font-medium text-gray-800 dark:text-white/90">
              {Array.isArray(field.value)
                ? field.value.join(", ")
                : field.value || "-"}
            </p>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6 mt-6">
      <button
        onClick={openModal}
        className="absolute right-6 top-6 z-10 flex items-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs hover:bg-gray-50 hover:text-gray-800 dark:border-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-white/[0.03] dark:hover:text-gray-200"
      >
        <svg
          className="fill-current"
          width="18"
          height="18"
          viewBox="0 0 18 18"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z"
            fill=""
          />
        </svg>
        Edit
      </button>

      <h4 className="text-lg font-semibold text-gray-800 dark:text-white/90 lg:mb-6">
        User Info
      </h4>

      {renderUserInfo()}

      {/* Tombol Detail Riwayat untuk Dosen */}
      {user.role === "dosen" && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={() =>
              navigate("/dosen-riwayat", { state: { dosenData: user } })
            }
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition-colors text-sm font-medium"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            Lihat Detail Riwayat Mengajar
          </button>
        </div>
      )}

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setIsModalOpen(false)}
            ></div>
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto"
            >
              <button
                onClick={() => setIsModalOpen(false)}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="24" height="24" fill="none" viewBox="0 0 24 24">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              <form onSubmit={handleSave}>
                <div className="pb-4 sm:pb-6">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    Edit Profile
                  </h2>
                </div>
                <div>
                  <div className="mb-3 sm:mb-4">
                    <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium text-sm">
                      Nama
                    </label>
                    <input
                      type="text"
                      name="name"
                      value={form.name}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium text-sm">
                      Username
                    </label>
                    <input
                      type="text"
                      name="username"
                      value={form.username}
                      onChange={handleChange}
                      className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                      required
                    />
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium text-sm">
                      Email (Verification)
                    </label>
                    <input
                      type="email"
                      name="email"
                      value={form.email}
                      onChange={(e) => {
                        const emailValue = e.target.value;
                        // Auto-sync whatsapp_email dengan email verification
                        setForm({
                          ...form,
                          email: emailValue,
                          whatsapp_email: emailValue,
                        });
                        // Check availability realtime (debounced)
                        if (debouncedCheckEmailRef.current) {
                          debouncedCheckEmailRef.current([emailValue]);
                        }
                      }}
                      className={`w-full px-3 py-2 rounded-lg border ${
                        emailError
                          ? "border-red-500 dark:border-red-500"
                          : "border-gray-300 dark:border-gray-700"
                      } bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500`}
                      required
                    />
                    {emailError && (
                      <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="currentColor"
                          viewBox="0 0 20 20"
                        >
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {emailError}
                      </p>
                    )}
                    {checkingEmail && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        Memeriksa ketersediaan...
                      </p>
                    )}
                  </div>

                  {/* WhatsApp fields untuk Dosen (wajib) */}
                  {user.role === "dosen" && (
                    <>
                      <div className="mb-3 sm:mb-4 border-t border-gray-200 dark:border-gray-700 pt-4">
                        <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                          Data WhatsApp untuk Wablas
                        </h3>
                      </div>
                      <div className="mb-3 sm:mb-4">
                        <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium text-sm">
                          Nomor WhatsApp <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="tel"
                          name="whatsapp_phone"
                          value={form.whatsapp_phone}
                          onChange={(e) => {
                            const phoneValue = e.target.value;
                            handleChange(e);
                            // Sinkronisasi telp dengan whatsapp_phone (convert 62 ke 0)
                            if (phoneValue) {
                              const telpValue = phoneValue.startsWith("62")
                                ? "0" + phoneValue.substring(2)
                                : phoneValue;
                              setForm({
                                ...form,
                                whatsapp_phone: phoneValue,
                                telp: telpValue,
                              });
                            }
                            // Check availability realtime (debounced)
                            if (debouncedCheckPhoneRef.current) {
                              debouncedCheckPhoneRef.current([phoneValue]);
                            }
                          }}
                          placeholder="6281234567890"
                          className={`w-full px-3 py-2 rounded-lg border ${
                            phoneError
                              ? "border-red-500 dark:border-red-500"
                              : "border-gray-300 dark:border-gray-700"
                          } bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500`}
                          required
                        />
                        {phoneError && (
                          <p className="text-xs text-red-500 dark:text-red-400 mt-1 flex items-center gap-1">
                            <svg
                              className="w-4 h-4"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                                clipRule="evenodd"
                              />
                            </svg>
                            {phoneError}
                          </p>
                        )}
                        {checkingPhone && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Memeriksa ketersediaan...
                          </p>
                        )}
                        {!phoneError && !checkingPhone && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                            Format: 6281234567890 (tanpa +, mulai dengan 62)
                          </p>
                        )}
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Nomor telepon akan otomatis terupdate (sinkronisasi
                          dengan nomor WhatsApp)
                        </p>
                      </div>
                      <div className="mb-3 sm:mb-4">
                        <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium text-sm">
                          Email untuk Wablas{" "}
                          <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          name="whatsapp_email"
                          value={form.email} // Selalu sama dengan email verification
                          readOnly
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 cursor-not-allowed"
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Otomatis sama dengan Email Verification di atas
                        </p>
                      </div>
                      <div className="mb-3 sm:mb-4">
                        <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium text-sm">
                          Alamat <span className="text-red-500">*</span>
                        </label>
                        <textarea
                          name="whatsapp_address"
                          value={form.whatsapp_address}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              whatsapp_address: e.target.value,
                            })
                          }
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 resize-none"
                          required
                        />
                      </div>
                      <div className="mb-3 sm:mb-4">
                        <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium text-sm">
                          Tanggal Lahir <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="date"
                          name="whatsapp_birth_day"
                          value={form.whatsapp_birth_day}
                          onChange={handleChange}
                          max={new Date().toISOString().split("T")[0]}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                          required
                        />
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          Format: YYYY-mm-dd (contoh: 1990-01-15)
                        </p>
                      </div>
                    </>
                  )}

                  {/* Super Admin extra fields */}
                  {user.role === "super_admin" && (
                    <>
                      <div className="mb-3 sm:mb-4">
                        <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium text-sm">
                          Nomor Telepon
                        </label>
                        <input
                          type="tel"
                          name="telp"
                          value={form.telp}
                          onChange={handleChange}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                      <div className="mb-3 sm:mb-4">
                        <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium text-sm">
                          Posisi/Jabatan
                        </label>
                        <input
                          type="text"
                          name="ket"
                          value={form.ket}
                          onChange={handleChange}
                          className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
                        />
                      </div>
                    </>
                  )}
                  <div className="mb-3 sm:mb-4">
                    <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium text-sm">
                      Password Saat Ini
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showCurrentPassword ? "text" : "password"}
                        name="current_password"
                        value={form.current_password}
                        onChange={handleChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 pr-10"
                        autoComplete="current-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onClick={() => setShowCurrentPassword((v) => !v)}
                        aria-label={
                          showCurrentPassword
                            ? "Sembunyikan Password"
                            : "Tampilkan Password"
                        }
                      >
                        {showCurrentPassword ? (
                          <EyeIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                        ) : (
                          <EyeCloseIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium text-sm">
                      Password Baru
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showNewPassword ? "text" : "password"}
                        name="new_password"
                        value={form.new_password}
                        onChange={handleChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onClick={() => setShowNewPassword((v) => !v)}
                        aria-label={
                          showNewPassword
                            ? "Sembunyikan Password"
                            : "Tampilkan Password"
                        }
                      >
                        {showNewPassword ? (
                          <EyeIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                        ) : (
                          <EyeCloseIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div className="mb-3 sm:mb-4">
                    <label className="block mb-1 text-gray-700 dark:text-gray-300 font-medium text-sm">
                      Konfirmasi Password Baru
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={showConfirmPassword ? "text" : "password"}
                        name="confirm_password"
                        value={form.confirm_password}
                        onChange={handleChange}
                        className="w-full px-3 py-2 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 pr-10"
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={
                          showConfirmPassword
                            ? "Sembunyikan Password"
                            : "Tampilkan Password"
                        }
                      >
                        {showConfirmPassword ? (
                          <EyeIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                        ) : (
                          <EyeCloseIcon className="size-5 fill-gray-500 dark:fill-gray-400" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                {error && (
                  <div className="text-sm text-red-500 bg-red-100 rounded p-2 mt-6">
                    {error}
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg bg-gray-100 text-sm font-medium shadow-theme-xs hover:bg-gray-200 transition dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700"
                    onClick={() => setIsModalOpen(false)}
                    disabled={saving}
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition flex items-center justify-center"
                    disabled={saving}
                  >
                    {saving ? (
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
                        Menyimpan...
                      </>
                    ) : (
                      "Simpan"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => {
                setShowSuccessModal(false);
                setIsModalOpen(false);
              }}
            />

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setShowSuccessModal(false);
                  setIsModalOpen(false);
                }}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="w-6 h-6"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>

              <div className="text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FontAwesomeIcon
                    icon={faCheckCircle}
                    className="w-8 h-8 text-green-600 dark:text-green-400"
                  />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                  Profile Berhasil Diupdate!
                </h3>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Profile Anda telah berhasil diupdate
                </p>
                <button
                  onClick={() => {
                    setShowSuccessModal(false);
                    setIsModalOpen(false);
                  }}
                  className="w-full bg-green-500 hover:bg-green-600 text-white font-medium py-3 px-4 rounded-xl transition-colors"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
