import { useState, useEffect } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faPenToSquare,
  faTrash,
  faPlus,
} from "@fortawesome/free-solid-svg-icons";
import { AnimatePresence, motion } from "framer-motion";
import api, { handleApiError } from "../../utils/api";
import { EyeIcon, EyeCloseIcon } from "../../icons";
import RekapIKDBase from "./RekapIKDBase";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 40, 50];

// Unit Kerja options (sama dengan role)
// Catatan: "Dosen" dihapus dari dropdown karena sudah ada di halaman Dosen sendiri
// Tapi logic untuk role "dosen" tetap ada untuk kompatibilitas data yang sudah ada
const UNIT_KERJA_OPTIONS = [
  "Akademik",
  "AIK",
  "MEU",
  "Profesi",
  "Kemahasiswaan",
  "SDM",
  "UPT Jurnal",
  "UPT PPM",
  "Verifikator",
  "Ketua IKD",
];

type UserIKD = {
  id?: number;
  name: string;
  username: string;
  email: string;
  telp: string;
  password?: string;
  role?: string; // Unit Kerja = role
};

export default function UserIKD() {
  const [data, setData] = useState<UserIKD[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<UserIKD>({
    name: "",
    username: "",
    email: "",
    telp: "",
    password: "",
    role: "",
  });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(PAGE_SIZE_OPTIONS[0]);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalError, setModalError] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<{ id: number; name: string } | null>(null);
  const [filterUnit, setFilterUnit] = useState("all");

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        setSuccess(null);
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [success]);

  useEffect(() => {
    if (modalError) {
      const timer = setTimeout(() => {
        setModalError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [modalError]);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(() => {
        setError("");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);
      // Mapping Unit Kerja ke role format
      const roleMapping: { [key: string]: string } = {
        Akademik: "akademik", // Role baru, berbeda dari tim_akademik
        Dosen: "dosen", // Tetap ada untuk kompatibilitas, tapi tidak muncul di dropdown
        AIK: "aik",
        MEU: "meu",
        Profesi: "profesi",
        Kemahasiswaan: "kemahasiswaan",
        SDM: "sdm",
        "UPT Jurnal": "upt_jurnal",
        "UPT PPM": "upt_ppm",
        Verifikator: "verifikator",
        "Ketua IKD": "ketua_ikd",
      };

      const allUsers: UserIKD[] = [];
      let fetchErrors: string[] = [];

      // Fetch users untuk setiap role yang sesuai dengan Unit Kerja
      // Catatan: "Dosen" tidak di-fetch karena sudah ada di halaman Dosen sendiri
      for (const unitKerja of UNIT_KERJA_OPTIONS) {
        const role = roleMapping[unitKerja];
        if (!role) continue;

        try {
          // Tambahkan timestamp untuk cache busting agar mendapatkan data terbaru
          const cacheBuster = Date.now();
          const res = await api.get("/users", {
            params: {
              role: role,
              per_page: 2000,
              _t: cacheBuster
            }
          }); // Request 2000 items per page for consistency with master data
          let users: any[] = [];

          // Handle berbagai format response
          if (Array.isArray(res.data)) {
            // Format: langsung array
            users = res.data;
          } else if (res.data?.data && Array.isArray(res.data.data)) {
            // Format: pagination Laravel { data: [...], current_page: ..., etc }
            users = res.data.data;
          } else if (res.data?.users && Array.isArray(res.data.users)) {
            // Format: { users: [...] }
            users = res.data.users;
          } else if (res.data?.items && Array.isArray(res.data.items)) {
            // Format: { items: [...] }
            users = res.data.items;
          } else if (res.data && typeof res.data === 'object') {
            // Jika response adalah object tapi bukan array, mungkin data ada di property lain
            // Cek apakah ada property yang berisi array
            const possibleDataKeys = ['results', 'list', 'records', 'users', 'items', 'data'];
            for (const key of possibleDataKeys) {
              if (res.data[key] && Array.isArray(res.data[key])) {
                users = res.data[key];
                break;
              }
            }
          }

          // Map role kembali ke Unit Kerja format untuk display
          const mappedUsers = users.map((user) => ({
            ...user,
            role: unitKerja, // Set role ke Unit Kerja format untuk display
          }));

          allUsers.push(...mappedUsers);
        } catch (err: any) {
          // Log error tapi continue untuk role lain
          const errorMsg = err?.response?.data?.message || err?.message || 'Unknown error';
          console.warn(`Error fetching users for role ${role} (${unitKerja}):`, errorMsg);
          fetchErrors.push(`${unitKerja}: ${errorMsg}`);
          continue;
        }
      }

      // Filter out user dengan role "dosen" jika ada (untuk memastikan tidak muncul di tabel)
      const filteredUsers = allUsers.filter((user) => {
        const userRole = user.role?.toLowerCase();
        return userRole !== "dosen";
      });

      // Log untuk debugging
      console.log('Fetched users:', filteredUsers.length, 'users');
      console.log('All users before filter:', allUsers.length);

      setData(filteredUsers);

      // Jika ada error tapi masih dapat beberapa data, tampilkan warning
      if (fetchErrors.length > 0 && filteredUsers.length === 0) {
        setError(`Gagal memuat data: ${fetchErrors.join('; ')}`);
      } else if (fetchErrors.length > 0) {
        // Ada error tapi masih dapat data, log saja tanpa set error
        console.warn('Some roles failed to load:', fetchErrors);
      }
    } catch (err: any) {
      console.error('Error in fetchData:', err);
      setError(handleApiError(err, "Memuat data user IKD"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCloseModal = () => {
    setShowModal(false);
    setForm({
      name: "",
      username: "",
      email: "",
      telp: "",
      password: "",
      role: "",
    });
    setEditMode(false);
    setModalError("");
    setShowPassword(false);
  };

  const handleAdd = async () => {
    setIsSaving(true);
    setModalError("");

    // Validasi
    if (!form.name.trim()) {
      setModalError("Nama wajib diisi.");
      setIsSaving(false);
      return;
    }
    if (!form.username.trim()) {
      setModalError("Username wajib diisi.");
      setIsSaving(false);
      return;
    }
    if (!form.email.trim()) {
      setModalError("Email wajib diisi.");
      setIsSaving(false);
      return;
    }
    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(form.email.trim())) {
      setModalError("Format email tidak valid.");
      setIsSaving(false);
      return;
    }
    if (!form.telp.trim()) {
      setModalError("Telepon wajib diisi.");
      setIsSaving(false);
      return;
    }
    if (!form.role) {
      setModalError("Unit Kerja wajib dipilih.");
      setIsSaving(false);
      return;
    }
    if (!editMode && !form.password) {
      setModalError("Password wajib diisi.");
      setIsSaving(false);
      return;
    }

    try {
      // Mapping Unit Kerja ke role format
      const roleMapping: { [key: string]: string } = {
        Akademik: "akademik", // Role baru, berbeda dari tim_akademik
        Dosen: "dosen",
        AIK: "aik",
        MEU: "meu",
        Profesi: "profesi",
        Kemahasiswaan: "kemahasiswaan",
        SDM: "sdm",
        "UPT Jurnal": "upt_jurnal",
        "UPT PPM": "upt_ppm",
        Verifikator: "verifikator",
        "Ketua IKD": "ketua_ikd",
      };

      const role =
        roleMapping[form.role] || form.role.toLowerCase().replace(/\s+/g, "_");

      const payload: any = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim() || null,
        telp: form.telp.trim() || null,
        role: role,
      };

      if (editMode) {
        if (form.password && form.password.trim()) {
          payload.password = form.password.trim();
        }
        console.log("Updating user with payload:", payload);
        const response = await api.put(`/users/${form.id}`, payload);
        console.log("Update user response:", response.data);

        if (response.data && response.data.id) {
          // Convert role dari database (snake_case) ke Unit Kerja format (Title Case)
          let unitKerja = response.data.role || form.role || "";
          if (unitKerja) {
            const roleMapping: { [key: string]: string } = {
              akademik: "Akademik",
              dosen: "Dosen",
              aik: "AIK",
              meu: "MEU",
              profesi: "Profesi",
              kemahasiswaan: "Kemahasiswaan",
              sdm: "SDM",
              upt_jurnal: "UPT Jurnal",
              upt_ppm: "UPT PPM",
              verifikator: "Verifikator",
              ketua_ikd: "Ketua IKD",
            };
            const roleLower = unitKerja.toLowerCase();
            unitKerja = roleMapping[roleLower] || formatRole(unitKerja);
          }

          // Update user langsung di state untuk immediate UI update
          const updatedUser: UserIKD = {
            id: response.data.id,
            name: response.data.name || form.name,
            username: response.data.username || form.username,
            email: response.data.email || form.email,
            telp: response.data.telp || form.telp,
            role: unitKerja, // Set role ke Unit Kerja format untuk display
          };

          setData((prevData) => {
            return prevData.map((u) => (u.id === updatedUser.id ? updatedUser : u));
          });

          setSuccess("Data user IKD berhasil diupdate.");
          handleCloseModal();

          // Fetch data dari backend untuk memastikan sinkronisasi (dengan cache busting)
          // Gunakan setTimeout untuk tidak blocking UI
          setTimeout(async () => {
            try {
              await fetchData();
            } catch (fetchErr) {
              console.error("Error fetching data after update:", fetchErr);
              // Tidak perlu set error karena user sudah diupdate di state
            }
          }, 100);
        } else {
          setModalError("Gagal mengupdate user. Response tidak valid.");
        }
      } else {
        payload.password = form.password.trim();
        console.log("Creating user with payload:", payload);

        try {
          const response = await api.post("/users", payload);
          console.log("Create user response:", response);
          console.log("Response status:", response.status);
          console.log("Response data:", response.data);

          // Backend returns user object directly (status 201)
          // Check if user was created successfully by checking response data
          const createdUser = response.data;

          if (response.status === 201 && createdUser && createdUser.id) {
            console.log("User created successfully with ID:", createdUser.id);

            // Convert role dari database (snake_case) ke Unit Kerja format (Title Case)
            let unitKerja = createdUser.role || "";
            if (unitKerja) {
              const roleMapping: { [key: string]: string } = {
                akademik: "Akademik",
                dosen: "Dosen",
                aik: "AIK",
                meu: "MEU",
                profesi: "Profesi",
                kemahasiswaan: "Kemahasiswaan",
                sdm: "SDM",
                upt_jurnal: "UPT Jurnal",
                upt_ppm: "UPT PPM",
                verifikator: "Verifikator",
                ketua_ikd: "Ketua IKD",
              };
              const roleLower = unitKerja.toLowerCase();
              unitKerja = roleMapping[roleLower] || formatRole(unitKerja);
            }

            // Tambahkan user baru langsung ke state untuk immediate UI update
            const newUser: UserIKD = {
              id: createdUser.id,
              name: createdUser.name || form.name,
              username: createdUser.username || form.username,
              email: createdUser.email || form.email,
              telp: createdUser.telp || form.telp,
              role: unitKerja, // Set role ke Unit Kerja format untuk display
            };

            // Filter out jika role adalah "Dosen" (tidak ditampilkan di tabel)
            if (unitKerja.toLowerCase() !== "dosen") {
              setData((prevData) => {
                // Cek apakah user sudah ada (untuk menghindari duplikasi)
                const exists = prevData.some((u) => u.id === newUser.id);
                if (exists) {
                  // Update jika sudah ada
                  return prevData.map((u) => (u.id === newUser.id ? newUser : u));
                }
                // Tambahkan jika belum ada
                return [...prevData, newUser];
              });
            }

            setSuccess("Data user IKD berhasil ditambahkan.");
            handleCloseModal();

            // Fetch data dari backend untuk memastikan sinkronisasi (dengan cache busting)
            // Gunakan setTimeout untuk tidak blocking UI
            setTimeout(async () => {
              try {
                await fetchData();
              } catch (fetchErr) {
                console.error("Error fetching data after create:", fetchErr);
                // Tidak perlu set error karena user sudah ditambahkan ke state
              }
            }, 100);
          } else {
            console.error("Invalid response format:", response);
            setModalError("User berhasil dibuat tapi response tidak valid. Silakan refresh halaman.");
            // Refresh anyway to check if user exists
            await fetchData();
          }
        } catch (createError: any) {
          console.error("Error during user creation:", createError);
          console.error("Error response:", createError.response);
          throw createError; // Re-throw to be caught by outer catch
        }
      }
    } catch (err: any) {
      console.error("Error saving user IKD:", err);
      console.error("Error response:", err.response?.data);
      const errorMessage = handleApiError(err, "Menyimpan data user IKD");
      setModalError(errorMessage);

      // Log validation errors for debugging
      if (err.response?.status === 422) {
        console.error("Validation errors:", err.response.data?.errors);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (user: UserIKD) => {
    // Convert role dari database (snake_case) ke Unit Kerja format (Title Case)
    let unitKerja = user.role || "";
    if (unitKerja) {
      // Cari mapping yang sesuai (reverse mapping dari role ke Unit Kerja)
      const roleMapping: { [key: string]: string } = {
        akademik: "Akademik", // Role baru untuk Unit Kerja Akademik
        dosen: "Dosen",
        aik: "AIK",
        meu: "MEU",
        profesi: "Profesi",
        kemahasiswaan: "Kemahasiswaan",
        sdm: "SDM",
        upt_jurnal: "UPT Jurnal",
        upt_ppm: "UPT PPM",
        verifikator: "Verifikator",
        ketua_ikd: "Ketua IKD",
      };

      const roleLower = unitKerja.toLowerCase();
      unitKerja = roleMapping[roleLower] || formatRole(unitKerja);
    }

    setForm({
      id: user.id,
      name: user.name,
      username: user.username,
      email: user.email,
      telp: user.telp,
      role: unitKerja,
    });
    setEditMode(true);
    setShowModal(true);
    setShowPassword(false);
  };

  const handleDeleteClick = (userId: number, userName: string) => {
    // Tampilkan modal konfirmasi (karena delete dari table, bukan dari modal)
    setUserToDelete({ id: userId, name: userName });
    setShowDeleteModal(true);
  };

  const confirmDeleteUser = async () => {
    if (!userToDelete) return;

    await confirmDelete(userToDelete.id);
    setShowDeleteModal(false);
    setUserToDelete(null);
  };

  const confirmDelete = async (userId: number) => {
    setIsDeleting(true);
    try {
      // Optimistically remove from state
      setData((prevData) => prevData.filter((user) => user.id !== userId));

      // Delete from backend
      await api.delete(`/users/${userId}`);

      // Wait a bit to ensure backend cache is cleared
      await new Promise(resolve => setTimeout(resolve, 300));

      // Refresh data from server
      await fetchData();

      setSuccess("Data user IKD berhasil dihapus.");
    } catch (err: any) {
      // If delete fails, restore data by fetching again
      console.error("Error deleting user:", err);
      setError(handleApiError(err, "Menghapus data user IKD"));
      // Restore data by fetching again
      await fetchData();
    } finally {
      setIsDeleting(false);
    }
  };

  const isFormValid =
    form.name &&
    form.username &&
    form.email &&
    form.telp &&
    form.role &&
    (editMode || form.password);

  // Filter & Sort data
  const filteredData = data
    .filter((user) => {
      const searchLower = search.toLowerCase();
      const matchesSearch =
        user.name.toLowerCase().includes(searchLower) ||
        user.username.toLowerCase().includes(searchLower) ||
        user.email.toLowerCase().includes(searchLower) ||
        user.telp.toLowerCase().includes(searchLower) ||
        (user.role && user.role.toLowerCase().includes(searchLower));

      const matchesUnit = filterUnit === "all" ? true : user.role === filterUnit;

      return matchesSearch && matchesUnit;
    })
    .sort((a, b) => (b.id || 0) - (a.id || 0)); // Latest first (descending ID)

  const hasActiveFilters = search !== "" || filterUnit !== "all";

  const clearFilters = () => {
    setSearch("");
    setFilterUnit("all");
    setPage(1);
  };

  // Pagination
  const totalPages = Math.ceil(filteredData.length / pageSize);
  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedData = filteredData.slice(startIndex, endIndex);

  // Format role untuk display (convert dari snake_case ke Title Case)
  const formatRole = (role: string | undefined): string => {
    if (!role) return "";
    return role
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <RekapIKDBase
      title="User IKD"
      description="Kelola user untuk Rekap IKD berdasarkan Unit Kerja"
      hideSubMenu={true}
    >
      <div className="w-full mx-auto space-y-6">
        {/* Success/Error Messages */}
        <AnimatePresence>
          {success && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-green-600 dark:text-green-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M5 13l4 4L19 7"
                  />
                </svg>
                <p className="text-sm text-green-600 dark:text-green-400">
                  {success}
                </p>
              </div>
            </motion.div>
          )}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg"
            >
              <div className="flex items-center gap-2">
                <svg
                  className="w-5 h-5 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
                <p className="text-sm text-red-600 dark:text-red-400">
                  {error}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <div>
            <h2 className="text-xl font-bold text-gray-800 dark:text-white/90 mb-1">
              Tabel User IKD
            </h2>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Kelola user untuk Rekap IKD berdasarkan Unit Kerja
            </p>
          </div>
          <button
            onClick={() => {
              setShowModal(true);
              setEditMode(false);
              setForm({
                name: "",
                username: "",
                email: "",
                telp: "",
                password: "",
                role: "",
              });
            }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 transition"
          >
            <FontAwesomeIcon icon={faPlus} className="w-5 h-5" />
            Tambah User
          </button>
        </div>

        {/* Search & Filter Bar */}
        <div className="bg-white dark:bg-white/[0.03] border border-gray-200 dark:border-gray-800 rounded-2xl p-6 shadow-sm">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-4 flex-1">
              {/* Search Input */}
              <div className="relative flex-1 lg:max-w-96">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg
                    className="fill-gray-500 dark:fill-gray-400"
                    width="20"
                    height="20"
                    viewBox="0 0 20 20"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      fillRule="evenodd"
                      clipRule="evenodd"
                      d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z"
                    />
                  </svg>
                </span>
                <input
                  type="text"
                  placeholder="Cari nama, username..."
                  value={search}
                  onChange={(e) => {
                    setSearch(e.target.value);
                    setPage(1);
                  }}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
                />
              </div>

              {/* Unit Filter */}
              <div className="w-full sm:w-48">
                <select
                  value={filterUnit}
                  onChange={(e) => {
                    setFilterUnit(e.target.value);
                    setPage(1);
                  }}
                  className="h-11 w-full rounded-lg border border-gray-200 bg-transparent px-4 text-sm text-gray-800 shadow-theme-xs focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:focus:border-brand-800"
                >
                  <option value="all" className="dark:bg-gray-900">Semua Unit Kerja</option>
                  {UNIT_KERJA_OPTIONS.map((unit) => (
                    <option key={unit} value={unit} className="dark:bg-gray-900">
                      {unit}
                    </option>
                  ))}
                </select>
              </div>

              {/* Clear Filters */}
              {hasActiveFilters && (
                <button
                  onClick={clearFilters}
                  className="px-4 h-11 text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 transition-colors whitespace-nowrap"
                >
                  Clear Filters
                </button>
              )}
            </div>

            <div className="text-sm font-medium text-gray-600 dark:text-gray-400 bg-gray-50 dark:bg-white/[0.03] px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-800">
              {filteredData.length} user ditemukan
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="bg-white dark:bg-white/[0.03] rounded-b-xl shadow-md border border-gray-200 dark:border-gray-800">
          <div className="p-6">
            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
              {loading ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                    <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900">
                      <tr>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </th>
                        <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-white/[0.03] divide-y divide-gray-100 dark:divide-white/[0.05]">
                      {Array.from({ length: 5 }).map((_, rowIdx) => (
                        <tr key={rowIdx} className="animate-pulse">
                          <td className="px-4 py-4">
                            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          </td>
                          <td className="px-4 py-4">
                            <div className="h-6 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : paginatedData.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-400 dark:text-gray-500">
                    {search
                      ? "Tidak ada data yang sesuai dengan pencarian."
                      : "Belum ada data user IKD."}
                  </p>
                </div>
              ) : (
                <>
                  <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
                    <div
                      className="max-w-full overflow-x-auto hide-scroll"
                      style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
                    >
                      <style>{`
                    .max-w-full::-webkit-scrollbar { display: none; }
                    .hide-scroll { 
                      -ms-overflow-style: none; /* IE and Edge */
                      scrollbar-width: none; /* Firefox */
                    }
                    .hide-scroll::-webkit-scrollbar { /* Chrome, Safari, Opera */
                      display: none;
                    }
                  `}</style>
                      <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                        <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                          <tr>
                            <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Nama
                            </th>
                            <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Username
                            </th>
                            <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Email
                            </th>
                            <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Telepon
                            </th>
                            <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Unit Kerja
                            </th>
                            <th className="px-4 py-4 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                              Aksi
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedData.map((user, idx) => (
                            <tr
                              key={user.id}
                              className={
                                idx % 2 === 1 ? "bg-gray-50 dark:bg-white/[0.02]" : ""
                              }
                            >
                              <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                                {user.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                                {user.username}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                                {user.email}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-gray-800 dark:text-white/90 align-middle">
                                {user.telp}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap align-middle">
                                <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
                                  {formatRole(user.role)}
                                </span>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap align-middle">
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() => handleEdit(user)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-blue-500 hover:text-blue-700 dark:hover:text-blue-300 transition"
                                    title="Edit"
                                  >
                                    <FontAwesomeIcon icon={faPenToSquare} className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="hidden sm:inline">Edit</span>
                                  </button>
                                  <button
                                    onClick={() => handleDeleteClick(user.id || 0, user.name)}
                                    className="inline-flex items-center gap-1 px-2 py-1 text-sm font-medium text-red-500 hover:text-red-700 dark:hover:text-red-300 transition"
                                    title="Hapus"
                                  >
                                    <FontAwesomeIcon icon={faTrash} className="w-4 h-4 sm:w-5 sm:h-5" />
                                    <span className="hidden sm:inline">Hapus</span>
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Pagination */}
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 px-4 sm:px-6 py-4">
                      <div className="flex items-center gap-4">
                        <select
                          id="perPage"
                          value={pageSize}
                          onChange={(e) => {
                            setPageSize(Number(e.target.value));
                            setPage(1);
                          }}
                          className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none"
                        >
                          {PAGE_SIZE_OPTIONS.map((opt) => (
                            <option key={opt} value={opt}>
                              {opt}
                            </option>
                          ))}
                        </select>
                        <span className="text-sm text-gray-500 dark:text-gray-400">
                          Menampilkan {paginatedData.length} dari {filteredData.length} data
                        </span>
                      </div>
                      <div className="flex items-center gap-2 justify-center sm:justify-end">
                        <button
                          onClick={() => setPage((p) => Math.max(1, p - 1))}
                          disabled={page === 1}
                          className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                        >
                          Prev
                        </button>

                        {/* Smart Pagination with Scroll */}
                        <div
                          className="flex items-center gap-1 max-w-[400px] overflow-x-auto pagination-scroll"
                          style={{
                            scrollbarWidth: "thin",
                            scrollbarColor: "#cbd5e1 #f1f5f9",
                          }}
                        >
                          <style
                            dangerouslySetInnerHTML={{
                              __html: `
                          .pagination-scroll::-webkit-scrollbar {
                            height: 6px;
                          }
                          .pagination-scroll::-webkit-scrollbar-track {
                            background: #f1f5f9;
                            border-radius: 3px;
                          }
                          .pagination-scroll::-webkit-scrollbar-thumb {
                            background: #cbd5e1;
                            border-radius: 3px;
                          }
                          .pagination-scroll::-webkit-scrollbar-thumb:hover {
                            background: #94a3b8;
                          }
                          .dark .pagination-scroll::-webkit-scrollbar-track {
                            background: #1e293b;
                          }
                          .dark .pagination-scroll::-webkit-scrollbar-thumb {
                            background: #475569;
                          }
                          .dark .pagination-scroll::-webkit-scrollbar-thumb:hover {
                            background: #64748b;
                          }
                        `,
                            }}
                          />

                          {/* Always show first page */}
                          <button
                            onClick={() => setPage(1)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${page === 1
                              ? "bg-brand-500 text-white"
                              : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                              }`}
                          >
                            1
                          </button>

                          {/* Show ellipsis if current page is far from start */}
                          {page > 4 && (
                            <span className="px-2 text-gray-500 dark:text-gray-400">
                              ...
                            </span>
                          )}

                          {/* Show pages around current page */}
                          {Array.from({ length: totalPages }, (_, i) => {
                            const pageNum = i + 1;
                            // Show pages around current page (2 pages before and after)
                            const shouldShow =
                              pageNum > 1 &&
                              pageNum < totalPages &&
                              pageNum >= page - 2 &&
                              pageNum <= page + 2;

                            if (!shouldShow) return null;

                            return (
                              <button
                                key={i}
                                onClick={() => setPage(pageNum)}
                                className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${page === pageNum
                                  ? "bg-brand-500 text-white"
                                  : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                  }`}
                              >
                                {pageNum}
                              </button>
                            );
                          })}

                          {/* Show ellipsis if current page is far from end */}
                          {page < totalPages - 3 && (
                            <span className="px-2 text-gray-500 dark:text-gray-400">
                              ...
                            </span>
                          )}

                          {/* Always show last page if it's not the first page */}
                          {totalPages > 1 && (
                            <button
                              onClick={() => setPage(totalPages)}
                              className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 transition whitespace-nowrap ${page === totalPages
                                ? "bg-brand-500 text-white"
                                : "bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700"
                                }`}
                            >
                              {totalPages}
                            </button>
                          )}
                        </div>

                        <button
                          onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                          disabled={page === totalPages}
                          className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
                        >
                          Next
                        </button>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={handleCloseModal}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Close Button */}
                <button
                  onClick={handleCloseModal}
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
                      d="M5.29289 5.29289C5.68342 4.90237 6.31658 4.90237 6.70711 5.29289L12 10.5858L17.2929 5.29289C17.6834 4.90237 18.3166 4.90237 18.7071 5.29289C19.0976 5.68342 19.0976 6.31658 18.7071 6.70711L13.4142 12L18.7071 17.2929C19.0976 17.6834 19.0976 18.3166 18.7071 18.7071C18.3166 19.0976 17.6834 19.0976 17.2929 18.7071L12 13.4142L6.70711 18.7071C6.31658 19.0976 5.68342 19.0976 5.29289 18.7071C4.90237 18.3166 4.90237 17.6834 5.29289 17.2929L10.5858 12L5.29289 6.70711C4.90237 6.31658 4.90237 5.68342 5.29289 5.29289Z"
                      fill="currentColor"
                    />
                  </svg>
                </button>

                {/* Header */}
                <div className="pb-4 sm:pb-6">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                    {editMode ? "Edit" : "Tambah"} User IKD
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {editMode
                      ? "Ubah informasi user IKD"
                      : "Tambahkan user baru untuk Rekap IKD"}
                  </p>
                </div>

                {/* Error Message */}
                {modalError && (
                  <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                    <p className="text-sm text-red-600 dark:text-red-400">
                      {modalError}
                    </p>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Nama */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Nama <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) =>
                        setForm({ ...form, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="Masukkan nama"
                    />
                  </div>

                  {/* Username */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.username}
                      onChange={(e) =>
                        setForm({ ...form, username: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="Masukkan username"
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Email <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) =>
                        setForm({ ...form, email: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="Masukkan email"
                    />
                  </div>

                  {/* Telepon */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Telepon <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="tel"
                      value={form.telp}
                      onChange={(e) => {
                        // Hanya izinkan angka
                        const value = e.target.value.replace(/\D/g, '');
                        setForm({ ...form, telp: value });
                      }}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                      placeholder="Masukkan nomor telepon (hanya angka)"
                    />
                  </div>

                  {/* Unit Kerja (Role) - Dropdown Single Select */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Unit Kerja <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={form.role}
                      onChange={(e) =>
                        setForm({ ...form, role: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                    >
                      <option value="">Pilih Unit Kerja</option>
                      {UNIT_KERJA_OPTIONS.map((unit) => (
                        <option key={unit} value={unit}>
                          {unit}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Password */}
                  <div>
                    <label className="block text-sm font-medium mb-1 text-gray-700 dark:text-gray-300">
                      Password{" "}
                      {!editMode && <span className="text-red-500">*</span>}
                      {editMode && (
                        <span className="text-gray-500 text-xs">
                          (Kosongkan jika tidak ingin mengubah)
                        </span>
                      )}
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? "text" : "password"}
                        value={form.password || ""}
                        onChange={(e) =>
                          setForm({ ...form, password: e.target.value })
                        }
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500"
                        placeholder={
                          editMode
                            ? "Kosongkan jika tidak ingin mengubah"
                            : "Masukkan password"
                        }
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                      >
                        {showPassword ? (
                          <EyeCloseIcon className="w-5 h-5" />
                        ) : (
                          <EyeIcon className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex justify-end gap-3 mt-6">
                  <button
                    onClick={handleCloseModal}
                    className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 text-sm font-medium shadow-theme-xs hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={!isFormValid || isSaving}
                    className="px-4 py-2 rounded-lg bg-brand-500 text-white text-sm font-medium shadow-theme-xs hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition flex items-center gap-2"
                  >
                    {isSaving && (
                      <svg
                        className="animate-spin h-4 w-4 text-white"
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
                          d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                        ></path>
                      </svg>
                    )}
                    {isSaving ? "Menyimpan..." : editMode ? "Update" : "Simpan"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Modal Konfirmasi Delete User */}
        <AnimatePresence>
          {showDeleteModal && userToDelete && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              <div
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={() => {
                  setShowDeleteModal(false);
                  setUserToDelete(null);
                }}
              ></div>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001]"
              >
                <div className="flex items-center justify-between pb-6">
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">
                    Konfirmasi Hapus Data
                  </h2>
                </div>
                <div>
                  <p className="mb-6 text-gray-500 dark:text-gray-400">
                    Apakah Anda yakin ingin menghapus user <span className="font-semibold text-gray-800 dark:text-white">"{userToDelete.name}"</span>? Tindakan ini tidak dapat dibatalkan.
                  </p>
                  <div className="flex justify-end gap-2 pt-2">
                    <button
                      onClick={() => {
                        setShowDeleteModal(false);
                        setUserToDelete(null);
                      }}
                      className="px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition"
                    >
                      Batal
                    </button>
                    <button
                      onClick={confirmDeleteUser}
                      className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium shadow-theme-xs hover:bg-red-600 transition flex items-center justify-center"
                      disabled={isDeleting}
                    >
                      {isDeleting ? "Menghapus..." : "Hapus"}
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      </div>
    </RekapIKDBase>
  );
}
