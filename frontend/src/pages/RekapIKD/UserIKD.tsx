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
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [selectedDeleteId, setSelectedDeleteId] = useState<number | null>(null);
  const [editMode, setEditMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [modalError, setModalError] = useState("");

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

      // Fetch users untuk setiap role yang sesuai dengan Unit Kerja
      // Catatan: "Dosen" tidak di-fetch karena sudah ada di halaman Dosen sendiri
      for (const unitKerja of UNIT_KERJA_OPTIONS) {
        const role = roleMapping[unitKerja];
        if (!role) continue;

        try {
          const res = await api.get(`/users?role=${role}`);
          let users: any[] = [];
          if (Array.isArray(res.data)) {
            users = res.data;
          } else if (res.data?.data && Array.isArray(res.data.data)) {
            users = res.data.data;
          }

          // Map role kembali ke Unit Kerja format untuk display
          const mappedUsers = users.map((user) => ({
            ...user,
            role: unitKerja, // Set role ke Unit Kerja format untuk display
          }));

          allUsers.push(...mappedUsers);
        } catch (err) {
          // Skip jika role tidak ada atau error
          continue;
        }
      }

      // Filter out user dengan role "dosen" jika ada (untuk memastikan tidak muncul di tabel)
      const filteredUsers = allUsers.filter((user) => {
        const userRole = user.role?.toLowerCase();
        return userRole !== "dosen";
      });

      setData(filteredUsers);
    } catch (err: any) {
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
      };

      const role =
        roleMapping[form.role] || form.role.toLowerCase().replace(/\s+/g, "_");

      const payload: any = {
        name: form.name.trim(),
        username: form.username.trim(),
        email: form.email.trim(),
        telp: form.telp.trim(),
        role: role,
      };

      if (editMode) {
        if (form.password) {
          payload.password = form.password;
        }
        await api.put(`/users/${form.id}`, payload);
        setSuccess("Data user IKD berhasil diupdate.");
      } else {
        payload.password = form.password;
        await api.post("/users", payload);
        setSuccess("Data user IKD berhasil ditambahkan.");
      }

      await fetchData();
      handleCloseModal();
    } catch (err: any) {
      setModalError(handleApiError(err, "Menyimpan data user IKD"));
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

  const confirmDelete = async () => {
    setIsDeleting(true);
    try {
      if (selectedDeleteId) {
        await api.delete(`/users/${selectedDeleteId}`);
        await fetchData();
        setSuccess("Data user IKD berhasil dihapus.");
      }
      setShowDeleteModal(false);
      setSelectedDeleteId(null);
    } catch (err: any) {
      setError(handleApiError(err, "Menghapus data user IKD"));
    } finally {
      setIsDeleting(false);
    }
  };

  const cancelDelete = () => {
    setShowDeleteModal(false);
    setSelectedDeleteId(null);
  };

  const userToDelete = data.find((u) => u.id === selectedDeleteId);

  const isFormValid =
    form.name &&
    form.username &&
    form.email &&
    form.telp &&
    form.role &&
    (editMode || form.password);

  // Filter data berdasarkan search
  const filteredData = data.filter((user) => {
    const searchLower = search.toLowerCase();
    return (
      user.name.toLowerCase().includes(searchLower) ||
      user.username.toLowerCase().includes(searchLower) ||
      user.email.toLowerCase().includes(searchLower) ||
      user.telp.toLowerCase().includes(searchLower) ||
      (user.role && user.role.toLowerCase().includes(searchLower))
    );
  });

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
    >
      <div className="space-y-6">
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

        {/* Header dengan Search dan Add Button */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex-1">
            <div className="relative">
              <input
                type="text"
                placeholder="Cari nama, username, email, telepon, atau unit kerja..."
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
            </div>
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
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium"
          >
            <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
            Tambah User
          </button>
        </div>

        {/* Table */}
        {loading ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 rounded-lg">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {Array.from({ length: 5 }).map((_, idx) => (
                  <tr key={idx} className="animate-pulse">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="h-8 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : paginatedData.length === 0 ? (
          <div className="text-center py-12 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-gray-600 dark:text-gray-400">
              {search
                ? "Tidak ada data yang sesuai dengan pencarian."
                : "Belum ada data user IKD."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 bg-white dark:bg-gray-800 rounded-lg">
              <thead className="bg-gray-50 dark:bg-gray-900">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Nama
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Telepon
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Unit Kerja
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedData.map((user) => (
                  <tr
                    key={user.id}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {user.name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.telp}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-xs font-medium">
                        {formatRole(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEdit(user)}
                          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
                        >
                          <FontAwesomeIcon icon={faPenToSquare} />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedDeleteId(user.id || null);
                            setShowDeleteModal(true);
                          }}
                          className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300"
                        >
                          <FontAwesomeIcon icon={faTrash} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between mt-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Menampilkan {startIndex + 1} -{" "}
                    {Math.min(endIndex, filteredData.length)} dari{" "}
                    {filteredData.length}
                  </span>
                  <select
                    value={pageSize}
                    onChange={(e) => {
                      setPageSize(Number(e.target.value));
                      setPage(1);
                    }}
                    className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm"
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => (
                      <option key={size} value={size}>
                        {size}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Sebelumnya
                  </button>
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    Halaman {page} dari {totalPages}
                  </span>
                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="px-3 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-600"
                  >
                    Selanjutnya
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Add/Edit Modal */}
        <AnimatePresence>
          {showModal && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-sm"
                onClick={handleCloseModal}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex justify-between items-center mb-6">
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
                    {editMode ? "Edit" : "Tambah"} User IKD
                  </h3>
                  <button
                    onClick={handleCloseModal}
                    className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                  >
                    <svg
                      className="w-6 h-6"
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
                  </button>
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                      onChange={(e) =>
                        setForm({ ...form, telp: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Masukkan nomor telepon"
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
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                        className="w-full px-3 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={handleAdd}
                    disabled={!isFormValid || isSaving}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isSaving ? "Menyimpan..." : editMode ? "Update" : "Simpan"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Delete Confirmation Modal */}
        <AnimatePresence>
          {showDeleteModal && (
            <div className="fixed inset-0 z-[100000] flex items-center justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-gray-500/30 dark:bg-gray-700/50 backdrop-blur-sm"
                onClick={cancelDelete}
              />
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-800 rounded-2xl p-6 shadow-lg z-[100001]"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Konfirmasi Hapus
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Apakah Anda yakin ingin menghapus user{" "}
                  <strong>{userToDelete?.name}</strong>? Tindakan ini tidak
                  dapat dibatalkan.
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={cancelDelete}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmDelete}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                  >
                    {isDeleting ? "Menghapus..." : "Hapus"}
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </RekapIKDBase>
  );
}
