import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBug,
  faUsers,
  faEnvelope,
  faPhone,
  faEdit,
  faTrash,
  faPlus,
  faSave,
  faCheck,
  faExclamationTriangle,
  faInfoCircle,
  faHeadset,
  faRocket,
} from "@fortawesome/free-solid-svg-icons";
import api, { handleApiError } from "../utils/api";

interface Developer {
  id: number;
  name: string;
  email: string;
  role: string;
  whatsapp: string;
  expertise: string;
  is_active: boolean;
  sort_order: number;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface FormData {
  title: string;
  description: string;
  category: string;
  priority: string;
  steps_to_reproduce: string;
  expected_behavior: string;
  actual_behavior: string;
  use_case: string;
  subject: string;
  message: string;
  developer_id: number;
  user_name: string;
  user_email: string;
}

// Skeleton Loading Components
const SkeletonCard = () => (
  <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 animate-pulse">
    <div className="space-y-4">
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
      <div className="h-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
    </div>
  </div>
);

const SkeletonDeveloper = () => (
  <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 animate-pulse">
    <div className="flex items-start justify-between">
      <div className="flex-1 min-w-0">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2 mb-2"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2"></div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-2/3 mb-3"></div>
        <div className="space-y-1">
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
          <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
        </div>
      </div>
    </div>
  </div>
);

const SupportCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"bug" | "feature" | "contact">(
    "bug"
  );
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");

  // Edit mode for super admin
  const [editMode, setEditMode] = useState(false);
  const [editingDeveloper, setEditingDeveloper] = useState<Developer | null>(
    null
  );
  const [showAddDeveloper, setShowAddDeveloper] = useState(false);

  const [formData, setFormData] = useState<FormData>({
    title: "",
    description: "",
    category: "",
    priority: "",
    steps_to_reproduce: "",
    expected_behavior: "",
    actual_behavior: "",
    use_case: "",
    subject: "",
    message: "",
    developer_id: 0,
    user_name: "",
    user_email: "",
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [developersResponse, userResponse] = await Promise.all([
        api.get("/support-center/developers"),
        api.get("/me"),
      ]);

      setDevelopers(developersResponse.data.data);
      setUser(userResponse.data);

      // Set user info in form data
      setFormData((prev) => ({
        ...prev,
        user_name: userResponse.data.name,
        user_email: userResponse.data.email,
      }));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.developer_id) {
      alert("Silakan pilih developer");
      return;
    }

    setSubmitting(true);

    try {
      let endpoint = "";
      let data = {};

      switch (activeTab) {
        case "bug":
          endpoint = "/support-center/bug-report";
          data = {
            title: formData.title,
            description: formData.description,
            category: formData.category,
            priority: formData.priority,
            steps_to_reproduce: formData.steps_to_reproduce,
            expected_behavior: formData.expected_behavior,
            actual_behavior: formData.actual_behavior,
            developer_id: formData.developer_id,
            user_name: formData.user_name,
            user_email: formData.user_email,
          };
          break;
        case "feature":
          endpoint = "/support-center/feature-request";
          data = {
            title: formData.title,
            description: formData.description,
            use_case: formData.use_case,
            priority: formData.priority,
            category: formData.category,
            developer_id: formData.developer_id,
            user_name: formData.user_name,
            user_email: formData.user_email,
          };
          break;
        case "contact":
          endpoint = "/support-center/contact";
          data = {
            subject: formData.subject,
            message: formData.message,
            priority: formData.priority,
            developer_id: formData.developer_id,
            user_name: formData.user_name,
            user_email: formData.user_email,
          };
          break;
      }

      const response = await api.post(endpoint, data);

      if (response.data.success) {
        setSuccessMessage(response.data.message);
        setShowSuccess(true);

        // Reset form
        setFormData((prev) => ({
          ...prev,
          title: "",
          description: "",
          category: "",
          priority: "",
          steps_to_reproduce: "",
          expected_behavior: "",
          actual_behavior: "",
          use_case: "",
          subject: "",
          message: "",
          developer_id: 0,
        }));

        setTimeout(() => {
          setShowSuccess(false);
        }, 5000);
      }
    } catch (error) {
      console.error("Error submitting form:", error);
      alert(
        "Gagal mengirim. Silakan coba lagi atau hubungi developer langsung via WhatsApp."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditDeveloper = (developer: Developer) => {
    setEditingDeveloper(developer);
    setEditMode(true);
  };

  const handleSaveDeveloper = async () => {
    if (!editingDeveloper) return;

    try {
      const response = await api.put(
        `/support-center/developers/${editingDeveloper.id}`,
        editingDeveloper
      );

      if (response.data.success) {
        setDevelopers((prev) =>
          prev.map((dev) =>
            dev.id === editingDeveloper.id ? editingDeveloper : dev
          )
        );
        setEditMode(false);
        setEditingDeveloper(null);
      }
    } catch (error) {
      console.error("Error updating developer:", error);
      alert("Gagal memperbarui developer");
    }
  };

  const handleAddDeveloper = async () => {
    if (!editingDeveloper) return;

    try {
      const response = await api.post(
        "/support-center/developers",
        editingDeveloper
      );

      if (response.data.success) {
        setDevelopers((prev) => [...prev, response.data.data]);
        setShowAddDeveloper(false);
        setEditingDeveloper(null);
      }
    } catch (error) {
      console.error("Error adding developer:", error);
      alert("Gagal menambah developer");
    }
  };

  const handleDeleteDeveloper = async (id: number) => {
    if (!confirm("Apakah Anda yakin ingin menghapus developer ini?")) return;

    try {
      const response = await api.delete(`/support-center/developers/${id}`);

      if (response.data.success) {
        setDevelopers((prev) => prev.filter((dev) => dev.id !== id));
      }
    } catch (error) {
      console.error("Error deleting developer:", error);
      alert("Gagal menghapus developer");
    }
  };

  const isSuperAdmin = user?.role === "super_admin";

  if (loading) {
    return (
      <div>
        {/* Header Skeleton */}
        <div className="mb-6">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3 animate-pulse"></div>
        </div>

        {/* Tab Navigation Skeleton */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex-1 px-6 py-4">
                <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse"></div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Form Section Skeleton */}
          <div className="xl:col-span-2">
            <SkeletonCard />
          </div>

          {/* Developer Sidebar Skeleton */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-4 animate-pulse"></div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <SkeletonDeveloper key={i} />
                ))}
              </div>
            </div>
            
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-blue-200 dark:bg-blue-800 rounded w-24 mb-2"></div>
              <div className="h-3 bg-blue-200 dark:bg-blue-800 rounded w-full mb-1"></div>
              <div className="h-3 bg-blue-200 dark:bg-blue-800 rounded w-3/4"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex items-center mb-4">
          <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-lg mr-4">
            <FontAwesomeIcon icon={faHeadset} className="text-2xl text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-2xl font-semibold text-gray-800 dark:text-white mb-2">Service Center</h1>
            <p className="text-gray-600 dark:text-gray-400">
              Dapatkan bantuan, laporkan bug, atau minta fitur baru
            </p>
          </div>
        </div>
      </div>

      {/* Success Message */}
      <AnimatePresence>
        {showSuccess && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4"
          >
            <div className="flex items-center">
              <FontAwesomeIcon
                icon={faCheck}
                className="text-green-500 mr-3"
              />
              <p className="text-green-800 dark:text-green-200 font-medium">{successMessage}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 mb-6 overflow-hidden">
        <div className="flex">
          {[
            {
              key: "bug",
              label: "Laporan Bug",
              icon: faBug,
              color: "text-red-500",
            },
            {
              key: "feature",
              label: "Permintaan Fitur",
              icon: faRocket,
              color: "text-emerald-500",
            },
            {
              key: "contact",
              label: "Hubungi Tim",
              icon: faUsers,
              color: "text-blue-500",
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`flex-1 px-6 py-4 text-left font-medium transition-colors ${
                activeTab === tab.key
                  ? "text-blue-600 dark:text-blue-400 border-b-2 border-blue-600 bg-blue-50 dark:bg-blue-900/20"
                  : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
              }`}
            >
              <div className="flex items-center">
                <FontAwesomeIcon
                  icon={tab.icon}
                  className={`mr-3 ${tab.color}`}
                />
                <span className="font-semibold">{tab.label}</span>
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        {/* Form Section */}
        <div className="xl:col-span-2">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 transition-colors duration-200">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Bug Report Form */}
                {activeTab === "bug" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Judul Bug *
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200"
                        placeholder="Deskripsi singkat tentang bug"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Kategori *
                      </label>
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                      >
                        <option value="">Pilih kategori</option>
                        <option value="Bug">Bug</option>
                        <option value="Error">Error</option>
                        <option value="Issue">Issue</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Prioritas *
                      </label>
                      <select
                        name="priority"
                        value={formData.priority}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                      >
                        <option value="">Pilih prioritas</option>
                        <option value="Low">Rendah</option>
                        <option value="Medium">Sedang</option>
                        <option value="High">Tinggi</option>
                        <option value="Critical">Kritis</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Deskripsi *
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        required
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 resize-none"
                        placeholder="Deskripsi detail tentang bug"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Langkah-langkah untuk Mereproduksi
                      </label>
                      <textarea
                        name="steps_to_reproduce"
                        value={formData.steps_to_reproduce}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 resize-none"
                        placeholder="1. Pergi ke...&#10;2. Klik pada...&#10;3. Lihat error..."
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Perilaku yang Diharapkan
                        </label>
                        <textarea
                          name="expected_behavior"
                          value={formData.expected_behavior}
                          onChange={handleInputChange}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 resize-none"
                          placeholder="Apa yang seharusnya terjadi"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Perilaku yang Terjadi
                        </label>
                        <textarea
                          name="actual_behavior"
                          value={formData.actual_behavior}
                          onChange={handleInputChange}
                          rows={3}
                          className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 resize-none"
                          placeholder="Apa yang benar-benar terjadi"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Feature Request Form */}
                {activeTab === "feature" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Judul Fitur *
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={formData.title}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200"
                        placeholder="Deskripsi singkat tentang fitur"
                      />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Kategori *
                        </label>
                        <select
                          name="category"
                          value={formData.category}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                        >
                          <option value="">Pilih kategori</option>
                          <option value="UI/UX">UI/UX</option>
                          <option value="Functionality">Fungsionalitas</option>
                          <option value="Performance">Performa</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Prioritas *
                        </label>
                        <select
                          name="priority"
                          value={formData.priority}
                          onChange={handleInputChange}
                          required
                          className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                        >
                          <option value="">Pilih prioritas</option>
                          <option value="Nice to have">
                            Bagus untuk dimiliki
                          </option>
                          <option value="Important">Penting</option>
                          <option value="Critical">Kritis</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Deskripsi *
                      </label>
                      <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleInputChange}
                        required
                        rows={4}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 resize-none"
                        placeholder="Deskripsi detail tentang fitur"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Kasus Penggunaan / Manfaat
                      </label>
                      <textarea
                        name="use_case"
                        value={formData.use_case}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 resize-none"
                        placeholder="Bagaimana fitur ini akan bermanfaat bagi pengguna?"
                      />
                    </div>
                  </>
                )}

                {/* Contact Form */}
                {activeTab === "contact" && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Subjek *
                      </label>
                      <input
                        type="text"
                        name="subject"
                        value={formData.subject}
                        onChange={handleInputChange}
                        required
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200"
                        placeholder="Subjek singkat dari pesan Anda"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Prioritas *
                      </label>
                      <select
                        name="priority"
                        value={formData.priority}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                      >
                        <option value="">Pilih prioritas</option>
                        <option value="Low">Rendah</option>
                        <option value="Medium">Sedang</option>
                        <option value="High">Tinggi</option>
                        <option value="Urgent">Mendesak</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Pesan *
                      </label>
                      <textarea
                        name="message"
                        value={formData.message}
                        onChange={handleInputChange}
                        required
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 resize-none"
                        placeholder="Pesan atau pertanyaan Anda"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Kirim ke Developer *
                      </label>
                      <select
                        name="developer_id"
                        value={formData.developer_id}
                        onChange={handleInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                      >
                        <option value="">Pilih developer</option>
                        {developers.map((developer) => (
                          <option key={developer.id} value={developer.id}>
                            {developer.name} - {developer.role}
                          </option>
                        ))}
                      </select>
                    </div>
                  </>
                )}

                {/* Developer Selection - Only for Bug Report and Feature Request */}
                {(activeTab === "bug" || activeTab === "feature") && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Kirim ke Developer *
                    </label>
                    <select
                      name="developer_id"
                      value={formData.developer_id}
                      onChange={handleInputChange}
                      required
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                    >
                      <option value="">Pilih developer</option>
                      {developers.map((developer) => (
                        <option key={developer.id} value={developer.id}>
                          {developer.name} - {developer.role}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* WhatsApp Suggestion */}
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <div className="flex items-start">
                    <FontAwesomeIcon
                      icon={faExclamationTriangle}
                      className="text-yellow-500 mr-3 mt-1"
                    />
                    <div>
                      <h4 className="text-sm font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                        💡 Saran
                      </h4>
                      <p className="text-sm text-yellow-700 dark:text-yellow-300">
                        Untuk respons yang lebih cepat, pertimbangkan untuk
                        menghubungi developer langsung via WhatsApp. Respons
                        email mungkin tertunda karena developer jarang mengecek
                        email.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold"
                  >
                    {submitting ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Mengirim...
                      </div>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faEnvelope} className="mr-2" />
                        Kirim{" "}
                        {activeTab === "bug"
                          ? "Laporan Bug"
                          : activeTab === "feature"
                          ? "Permintaan Fitur"
                          : "Pesan"}
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

        {/* Developer Info Sidebar */}
        <div className="space-y-6">
          {/* Developer List */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6 overflow-hidden transition-colors duration-200">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                Tim Pengembangan
              </h3>
              {isSuperAdmin && (
                <button
                  onClick={() => {
                    setEditingDeveloper({
                      id: 0,
                      name: "",
                      email: "",
                      role: "",
                      whatsapp: "",
                      expertise: "",
                      is_active: true,
                      sort_order: developers.length + 1,
                    });
                    setShowAddDeveloper(true);
                  }}
                  className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                  title="Tambah Developer"
                >
                  <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                </button>
              )}
            </div>

            <div className="space-y-4">
              {developers.map((developer) => (
                <div
                  key={developer.id}
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {developer.name}
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {developer.role}
                      </p>
                      <p className="text-xs text-gray-500 dark:text-gray-500 mt-1 break-words">
                        {developer.expertise}
                      </p>

                      <div className="mt-3 space-y-1">
                        <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                          <FontAwesomeIcon
                            icon={faEnvelope}
                            className="mr-2 flex-shrink-0"
                          />
                          <span className="break-all">{developer.email}</span>
                        </div>
                        {developer.whatsapp && (
                          <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                            <FontAwesomeIcon
                              icon={faPhone}
                              className="mr-2 flex-shrink-0"
                            />
                            <span className="break-all">
                              {developer.whatsapp}
                            </span>
                          </div>
                        )}
                      </div>
                    </div>

                    {isSuperAdmin && (
                      <div className="flex items-center space-x-1 ml-2 flex-shrink-0">
                        <button
                          onClick={() => handleEditDeveloper(developer)}
                          className="p-1 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
                          title="Edit Developer"
                        >
                          <FontAwesomeIcon
                            icon={faEdit}
                            className="w-3 h-3"
                          />
                        </button>
                        <button
                          onClick={() => handleDeleteDeveloper(developer.id)}
                          className="p-1 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
                          title="Hapus Developer"
                        >
                          <FontAwesomeIcon
                            icon={faTrash}
                            className="w-3 h-3"
                          />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
            </div>

          {/* Info Card */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start">
              <FontAwesomeIcon
                icon={faInfoCircle}
                className="text-blue-500 mr-3 mt-1"
              />
              <div>
                <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                  Waktu Respons
                </h4>
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  Kami biasanya merespons dalam 24-48 jam. Untuk masalah
                  mendesak, silakan hubungi developer langsung via WhatsApp.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Developer Modal */}
      <AnimatePresence>
        {(editMode || showAddDeveloper) && editingDeveloper && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div
              className="fixed inset-0 bg-gray-500/30 backdrop-blur-md"
              onClick={() => {
                setEditMode(false);
                setShowAddDeveloper(false);
                setEditingDeveloper(null);
              }}
            ></div>

            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6"
            >
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">
                {showAddDeveloper ? "Tambah Developer" : "Edit Developer"}
              </h3>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Nama *
                    </label>
                    <input
                      type="text"
                      value={editingDeveloper.name}
                      onChange={(e) =>
                        setEditingDeveloper({
                          ...editingDeveloper,
                          name: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={editingDeveloper.email}
                      onChange={(e) =>
                        setEditingDeveloper({
                          ...editingDeveloper,
                          email: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Peran
                    </label>
                    <input
                      type="text"
                      value={editingDeveloper.role}
                      onChange={(e) =>
                        setEditingDeveloper({
                          ...editingDeveloper,
                          role: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      WhatsApp
                    </label>
                    <input
                      type="text"
                      value={editingDeveloper.whatsapp}
                      onChange={(e) =>
                        setEditingDeveloper({
                          ...editingDeveloper,
                          whatsapp: e.target.value,
                        })
                      }
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Keahlian
                    </label>
                    <textarea
                      value={editingDeveloper.expertise}
                      onChange={(e) =>
                        setEditingDeveloper({
                          ...editingDeveloper,
                          expertise: e.target.value,
                        })
                      }
                      rows={3}
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 resize-none"
                    />
                  </div>
                </div>

              <div className="flex justify-end space-x-3 mt-6">
                <button
                  onClick={() => {
                    setEditMode(false);
                    setShowAddDeveloper(false);
                    setEditingDeveloper(null);
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors duration-200 font-medium"
                >
                  Batal
                </button>
                <button
                  onClick={
                    showAddDeveloper
                      ? handleAddDeveloper
                      : handleSaveDeveloper
                  }
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors duration-200 font-semibold"
                >
                  <FontAwesomeIcon icon={faSave} className="mr-2" />
                  {showAddDeveloper ? "Tambah" : "Simpan"}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SupportCenter;
