import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faPlus,
  faComments,
  faEye,
  faReply,
  faClock,
  faUser,
  faSearch,
  faFire,
  faGraduationCap,
  faUsers,
  faHeart,
  faBookmark,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import api, { handleApiError } from "../utils/api";
import { useNavigate, useParams } from "react-router-dom";
import QuillEditor from "../components/QuillEditor";
import { forumApi } from "../api/generateApi";

interface ForumCategory {
  id: number;
  name: string;
  slug: string;
  description: string;
  icon: string;
  color: string;
  permissions: string[];
}

interface Forum {
  id: number;
  title: string;
  content: string;
  slug: string;
  status: "active" | "closed" | "pinned" | "archived";
  views_count: number;
  replies_count: number;
  likes_count: number;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  is_edited?: boolean;
  is_new?: boolean;
  last_activity_at: string;
  created_at: string;
  access_type?: "public" | "private";
  allowed_users?: number[];
  user: {
    id: number;
    name: string;
    role: string;
  };
  last_reply_user?: {
    id: number;
    name: string;
  };
}

interface User {
  id: number;
  name: string;
  role: string;
}

interface SearchableUser {
  id: number;
  name: string;
  role: string;
  email?: string;
}

interface ForumViewer {
  id: number;
  user_id: number;
  forum_id: number;
  viewed_at: string;
  user: {
    id: number;
    name: string;
    email: string;
    role: string;
    avatar?: string;
  };
}

interface FormData {
  title: string;
  content: string;
  access_type: "public" | "private";
  selected_users: number[];
}

const ForumCategory: React.FC = () => {
  const navigate = useNavigate();
  const { categorySlug } = useParams<{ categorySlug: string }>();
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ForumCategory | null>(null);
  const [forums, setForums] = useState<Forum[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState<FormData>({
    title: "",
    content: "",
    access_type: "public",
    selected_users: [],
  });

  // State untuk like tracking
  const [forumLikes, setForumLikes] = useState<{ [key: number]: boolean }>({});

  // State untuk bookmark tracking
  const [forumBookmarks, setForumBookmarks] = useState<{
    [key: number]: boolean;
  }>({});

  // State untuk delete confirmation modal
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [forumToDelete, setForumToDelete] = useState<Forum | null>(null);
  const [deletingForum, setDeletingForum] = useState(false);

  // State untuk real-time update waktu
  const [currentTime, setCurrentTime] = useState(new Date());

  // State untuk upload progress
  const [uploading, setUploading] = useState(false);
  const [isCreatingForum, setIsCreatingForum] = useState(false);

  // State untuk access control
  const [searchableUsers, setSearchableUsers] = useState<SearchableUser[]>([]);
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState("");
  const [selectAllDosen, setSelectAllDosen] = useState(false);

  // State untuk modal viewers
  const [showViewersModal, setShowViewersModal] = useState(false);
  const [viewers, setViewers] = useState<ForumViewer[]>([]);
  const [viewersLoading, setViewersLoading] = useState(false);
  const [viewersPagination, setViewersPagination] = useState({
    current_page: 1,
    last_page: 1,
    per_page: 20,
    total: 0,
    has_more: false
  });
  const [selectedForum, setSelectedForum] = useState<Forum | null>(null);

  // UI helpers for checklist styling (match DetailBlokAntara aesthetics)
  const getRoleBadgeClasses = (role: string): string => {
    const normalized = (role || "").toLowerCase();
    if (normalized.includes("super")) {
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    }
    if (normalized.includes("tim") || normalized.includes("akademik")) {
      return "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300 border-green-200 dark:border-green-800";
    }
    if (normalized.includes("dosen")) {
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-300 border-purple-200 dark:border-purple-800";
    }
    if (normalized.includes("mahasiswa")) {
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    }
    return "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-700";
  };

  // Softer avatar styles (pill, subtle bg + readable text)
  const getAvatarClasses = (role: string): string => {
    const normalized = (role || "").toLowerCase();
    if (normalized.includes("super")) {
      return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-200";
    }
    if (normalized.includes("tim") || normalized.includes("akademik")) {
      return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-200";
    }
    if (normalized.includes("dosen")) {
      return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-200";
    }
    if (normalized.includes("mahasiswa")) {
      return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-200";
    }
    return "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-200";
  };

  useEffect(() => {
    if (categorySlug) {
      fetchCategoryData();
    }
  }, [categorySlug, currentPage]);

  // Real-time update waktu setiap menit
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update setiap 1 menit (60000ms)

    return () => clearInterval(interval);
  }, []);

  // Auto-load users saat private mode dipilih
  useEffect(() => {
    if (formData.access_type === "private" && searchableUsers.length === 0) {
      loadAllUsers();
    }
  }, [formData.access_type]);

  // Fungsi untuk handle access type change
  const handleAccessTypeChange = (accessType: "public" | "private") => {
    setFormData((prev) => ({
      ...prev,
      access_type: accessType,
      selected_users: [],
    }));
    setUserSearchQuery("");

    if (accessType === "private") {
      loadAllUsers();
    } else {
      setSearchableUsers([]);
    }
  };

  const fetchCategoryData = async () => {
    try {
      setLoading(true);

      const [categoryResponse, userResponse] = await Promise.all([
        api.get(`/forum/categories/${categorySlug}/forums?page=${currentPage}`),
        api.get("/me"),
      ]);

      const categoryData = categoryResponse.data.data.category;
      const userData = userResponse.data;

      setCategory(categoryData);
      setForums(categoryResponse.data.data.forums.data);
      setTotalPages(categoryResponse.data.data.forums.last_page);
      setUser(userData);

      // Set forum likes state - convert null to false
      const likesMap: { [key: number]: boolean } = {};
      const bookmarksMap: { [key: number]: boolean } = {};
      categoryResponse.data.data.forums.data.forEach((forum: Forum) => {
        likesMap[forum.id] = Boolean(forum.is_liked);
        bookmarksMap[forum.id] = Boolean(forum.is_bookmarked);
      });
      setForumLikes(likesMap);
      setForumBookmarks(bookmarksMap);
    } catch (error) {
      console.error("Error fetching category data:", error);
      const errorMessage = handleApiError(error, "Memuat data kategori forum");
      console.error("Category data error:", errorMessage);
      navigate("/forum-diskusi");
    } finally {
      setLoading(false);
    }
  };

  const getIconForCategory = (slug: string) => {
    switch (slug) {
      case "forum-diskusi-dosen":
        return faGraduationCap;
      case "forum-diskusi-mahasiswa":
        return faUsers;
      default:
        return faComments;
    }
  };

  const canCreateForumInCategory = (): boolean => {
    if (!user || !category) {
      return false;
    }

    return category.permissions.includes(user.role);
  };

  const canDeleteForum = (forum: Forum): boolean => {
    if (!user) return false;

    // Admin dan tim akademik bisa hapus forum kapan saja
    if (["tim_akademik", "super_admin"].includes(user.role)) {
      return true;
    }

    // User biasa hanya bisa hapus forum sendiri dalam 2 menit
    if (forum.user.id === user.id) {
      const forumTime = new Date(forum.created_at);
      const timeDiff = currentTime.getTime() - forumTime.getTime();
      const minutesDiff = Math.floor(timeDiff / (1000 * 60));
      return minutesDiff < 2;
    }

    return false;
  };

  const handleDeleteForum = async (forum: Forum) => {
    setForumToDelete(forum);
    setShowDeleteModal(true);
  };

  const confirmDeleteForum = async () => {
    if (!forumToDelete) return;

    try {
      setDeletingForum(true);

      await api.delete(`/forum/${forumToDelete.id}`);

      // Remove from local state
      setForums((prev) => prev.filter((f) => f.id !== forumToDelete.id));

      // Close modal
      setShowDeleteModal(false);
      setForumToDelete(null);
    } catch (error) {
      console.error("Error deleting forum:", error);
      alert("Gagal menghapus forum. Silakan coba lagi.");
    } finally {
      setDeletingForum(false);
    }
  };

  const navigateToForum = (forum: Forum) => {
    navigate(`/forum/${forum.slug}`);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const diffMs = currentTime.getTime() - date.getTime();
    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays > 0) {
      return `${diffDays} hari yang lalu`;
    } else if (diffHours > 0) {
      return `${diffHours} jam yang lalu`;
    } else if (diffMinutes > 0) {
      return `${diffMinutes} menit yang lalu`;
    } else {
      return "Baru saja";
    }
  };

  const handleCreateForum = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim() || !formData.content.trim() || !category) return;

    try {
      setUploading(true);
      setIsCreatingForum(true);
      await api.post("/forum", {
        title: formData.title,
        content: formData.content,
        category_id: category.id,
        access_type: formData.access_type,
        selected_users:
          formData.access_type === "private" ? formData.selected_users : [],
      });

      // Reset form dan tutup modal
      setFormData({
        title: "",
        content: "",
        access_type: "public",
        selected_users: [],
      });
      setShowCreateModal(false);

      // Refresh data
      await fetchCategoryData();
    } catch (error: unknown) {
      console.error("Error creating forum:", error);

      // Log detailed error
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: { data?: { message?: string }; status?: number };
        };
        console.error("Error response:", axiosError.response?.data);
        console.error("Error status:", axiosError.response?.status);
        alert(
          `Gagal membuat forum: ${
            axiosError.response?.data?.message || "Unknown error"
          }`
        );
      } else {
        alert(
          `Gagal membuat forum: ${
            error instanceof Error ? error.message : "Unknown error"
          }`
        );
      }
    } finally {
      setUploading(false);
      setIsCreatingForum(false);
    }
  };

  // Fungsi untuk search users
  const searchUsers = async (query: string) => {
    if (!query.trim()) {
      setSearchableUsers([]);
      return;
    }

    try {
      setSearchingUsers(true);

      const response = await api.get(
        `/users/search?q=${encodeURIComponent(query)}`
      );

      // Handle different response structures
      let users = [];
      if (response.data?.data && Array.isArray(response.data.data)) {
        users = response.data.data;
      } else if (Array.isArray(response.data)) {
        users = response.data;
      } else {
        console.warn(
          "🔍 WARNING: Unexpected response structure:",
          response.data
        );
        users = [];
      }

      // Filter out current user (author) dari search results

      const filteredUsers = users.filter((userItem: User) => {
        const isNotAuthor = userItem.id !== (user?.id || 0);
        return isNotAuthor;
      });

      setSearchableUsers(filteredUsers || []);
    } catch (error: unknown) {
      console.error("Error searching users:", error);
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as {
          response?: {
            status?: number;
            statusText?: string;
            data?: unknown;
          };
          message?: string;
          config?: {
            url?: string;
            method?: string;
            headers?: Record<string, unknown>;
          };
        };
        console.error("🔍 DEBUG: Error details:", {
          status: axiosError.response?.status,
          statusText: axiosError.response?.statusText,
          data: axiosError.response?.data,
          message: axiosError.message,
          config: {
            url: axiosError.config?.url,
            method: axiosError.config?.method,
            headers: axiosError.config?.headers,
          },
        });
      }
      setSearchableUsers([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  // Fungsi untuk load semua users
  const loadAllUsers = async () => {
    try {
      setSearchingUsers(true);

      const response = await api.get("/users");

      // Filter out current user (author) dari all users
      const filteredUsers = (response.data || []).filter(
        (userItem: User) => userItem.id !== (user?.id || 0)
      );

      setSearchableUsers(filteredUsers);
    } catch (error) {
      console.error("Error loading all users:", error);
      setSearchableUsers([]);
    } finally {
      setSearchingUsers(false);
    }
  };

  // Fungsi untuk handle user search
  const handleUserSearch = (query: string) => {
    setUserSearchQuery(query);
    if (query.trim()) {
      searchUsers(query);
    } else {
      // Jika search kosong, load semua user
      loadAllUsers();
    }
  };

  // Debounced search untuk performance
  const debouncedSearch = React.useCallback(
    React.useMemo(() => {
      let timeoutId: NodeJS.Timeout;
      return (query: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (query.trim()) {
            searchUsers(query);
          } else {
            loadAllUsers();
          }
        }, 300);
      };
    }, []),
    []
  );

  // Handle search input change dengan debounce
  const handleSearchInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value;
    setUserSearchQuery(query);
    debouncedSearch(query);
  };

  // Fungsi untuk select/deselect user
  const toggleUserSelection = (userId: number) => {
    setFormData((prev) => ({
      ...prev,
      selected_users: prev.selected_users.includes(userId)
        ? prev.selected_users.filter((id) => id !== userId)
        : [...prev.selected_users, userId],
    }));
  };

  // Fungsi untuk select all dosen
  const handleSelectAllDosen = () => {
    if (selectAllDosen) {
      // Deselect all dosen
      setFormData((prev) => ({
        ...prev,
        selected_users: prev.selected_users.filter((userId) => {
          const user = searchableUsers.find((u) => u.id === userId);
          return user && (user.role || "").toLowerCase() !== "dosen";
        }),
      }));
      setSelectAllDosen(false);
    } else {
      // Select all dosen
      const dosenIds = searchableUsers
        .filter((user) => (user.role || "").toLowerCase() === "dosen")
        .map((user) => user.id);

      setFormData((prev) => ({
        ...prev,
        selected_users: [...new Set([...prev.selected_users, ...dosenIds])],
      }));
      setSelectAllDosen(true);
    }
  };

  const handleLike = async (forumId: number) => {
    if (!user) return;

    try {
      const response = await api.post(`/forum/${forumId}/like`);
      if (response.data.success) {
        // Update local state
        setForumLikes((prev) => ({
          ...prev,
          [forumId]: response.data.data.is_liked,
        }));

        // Update forum likes count
        setForums((prev) =>
          prev.map((forum) =>
            forum.id === forumId
              ? { ...forum, likes_count: response.data.data.likes_count }
              : forum
          )
        );
      }
    } catch (error) {
      console.error("Error toggling like:", error);
    }
  };

  const handleBookmark = async (forumId: number) => {
    if (!user) return;

    try {
      const response = await api.post(`/forum/${forumId}/bookmark`);
      if (response.data.success) {
        // Update local state
        setForumBookmarks((prev) => ({
          ...prev,
          [forumId]: response.data.data.is_bookmarked,
        }));
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
    }
  };

  const fetchViewers = async (forumId: number, page: number = 1) => {
    try {
      setViewersLoading(true);
      const response = await forumApi.getViewers(forumId);
      
      if (response.data.success) {
        if (page === 1) {
          setViewers(response.data.data);
        } else {
          setViewers(prev => [...prev, ...response.data.data]);
        }
        setViewersPagination(response.data.pagination);
      }
    } catch (error: any) {
      console.error("Error fetching viewers:", error);
      
      // Handle 403 Unauthorized error
      if (error.response?.status === 403) {
        alert("Hanya author forum yang dapat melihat daftar viewer");
        setShowViewersModal(false);
      } else {
        alert("Gagal mengambil data viewer");
      }
    } finally {
      setViewersLoading(false);
    }
  };

  const handleViewersClick = (forum: Forum) => {
    if (!user) return;
    
    // Hanya author yang bisa melihat daftar viewer
    if (forum.user.id !== user.id) {
      alert("Hanya author forum yang dapat melihat daftar viewer");
      return;
    }
    
    setSelectedForum(forum);
    setShowViewersModal(true);
    fetchViewers(forum.id, 1);
  };

  const filteredForums = forums.filter(
    (forum) =>
      searchQuery === "" ||
      forum.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      forum.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="py-8">
          <div className="space-y-6">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse" />
            <div className="flex items-center justify-between">
              <div className="h-10 w-full max-w-md bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
              <div className="h-10 w-48 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
            </div>
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
                <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
                    <div>
                      <div className="h-4 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2" />
                      <div className="h-3 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                    </div>
                  </div>
                  <div className="h-9 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
                </div>
                <div className="p-5 space-y-3">
                  {Array.from({ length: 2 }).map((_, j) => (
                    <div key={j} className="rounded-xl border border-gray-200 dark:border-gray-800 p-5">
                      <div className="h-4 w-56 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-3" />
                      <div className="h-3 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2" />
                      <div className="h-3 w-5/6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-4" />
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                          <div className="h-3 w-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                          <div className="h-3 w-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                          <div className="h-3 w-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                        </div>
                        <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!category) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <FontAwesomeIcon
            icon={faComments}
            className="text-6xl text-gray-300 dark:text-gray-600 mb-4"
          />
          <p className="text-gray-600 dark:text-gray-400">Kategori forum tidak ditemukan</p>
          <button
            onClick={() => navigate("/forum-diskusi")}
            className="mt-4 px-4 py-2 bg-blue-600 dark:bg-blue-700 text-white rounded-lg hover:bg-blue-700 dark:hover:bg-blue-600"
          >
            Kembali ke Forum Diskusi
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="py-8">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/forum-diskusi")}
            className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-200 mb-6"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
            Kembali ke Forum Diskusi
          </button>

          <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
            <div
              className="px-6 py-5 border-b border-gray-200 dark:border-gray-800"
              style={{ borderLeftColor: category.color, borderLeftWidth: "4px" }}
            >
              <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div
                    className="w-11 h-11 rounded-xl flex items-center justify-center mr-4"
                style={{ backgroundColor: `${category.color}20` }}
              >
                <FontAwesomeIcon
                  icon={getIconForCategory(category.slug)}
                      className="text-xl"
                  style={{ color: category.color }}
                />
              </div>
              <div>
                    <h1 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white">
                  {category.name}
                </h1>
                    <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">{category.description}</p>
                    <div className="flex items-center mt-2 space-x-3 text-xs text-gray-500 dark:text-gray-400">
                  <span>{forums.length} forum</span>
                </div>
              </div>
                </div>

                {canCreateForumInCategory() && (
                  <button
                    onClick={() => setShowCreateModal(true)}
                    className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                  >
                    <FontAwesomeIcon icon={faPlus} className="mr-2" />
                    Buat Forum Baru
                  </button>
                )}
            </div>
          </div>

            <div className="p-5 lg:p-6">
            {/* Search Bar */}
              <div className="relative max-w-md mb-6">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FontAwesomeIcon icon={faSearch} className="text-gray-400 dark:text-gray-500" />
              </div>
              <input
                type="text"
                  placeholder="Cari forum diskusi..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                  className="block w-full pl-10 pr-3 py-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>
            </div>
          </div>
        </div>

        {/* Forums List */}
        {filteredForums.length > 0 ? (
          <div className="space-y-4">
            {filteredForums.map((forum) => (
              <motion.div
                key={forum.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className={`relative rounded-2xl p-5 cursor-pointer transition-all duration-200 hover:shadow-md ${
                  forum.is_new
                    ? "bg-blue-50 dark:bg-blue-900/10 border-l-4 border-l-blue-400"
                    : "bg-white dark:bg-white/[0.02] border border-gray-200 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-white/[0.04]"
                }`}
                onClick={() => navigateToForum(forum)}
              >
                {/* Simple Badge untuk forum baru - removed per request */}

                {/* Delete Button - Pojok kanan atas */}
                {canDeleteForum(forum) && (
                  <div className="absolute top-4 right-4 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteForum(forum);
                      }}
                      className="p-2 text-red-500 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Hapus forum"
                    >
                      <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                    </button>
                  </div>
                )}

                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {forum.status === "pinned" && (
                        <FontAwesomeIcon
                          icon={faFire}
                          className="text-orange-500 text-sm"
                        />
                      )}
                      {forum.access_type === "private" && (
                        <span className="px-2 py-1 text-xs font-medium bg-red-100 text-red-800 rounded-full">
                          🔒 Private
                        </span>
                      )}
                      <h3 className="text-xl font-semibold hover:text-blue-600 dark:hover:text-blue-400 text-gray-900 dark:text-white">
                        {forum.title}
                      </h3>
                    </div>
                    <div className="text-gray-600 dark:text-gray-300 mb-3">
                      {/* Clean content preview with subtle image indicator */}
                      <div className="flex items-center space-x-2 mb-3">
                        {/* Small image indicator */}
                        {forum.content.includes("<img") && (
                          <div className="flex items-center text-xs bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 px-2.5 py-1.5 rounded-full shadow-sm transition-all duration-200 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:border-blue-300 dark:hover:border-blue-700">
                            <svg
                              className="w-3.5 h-3.5 mr-1.5 text-blue-500"
                              fill="currentColor"
                              viewBox="0 0 20 20"
                            >
                              <path
                                fillRule="evenodd"
                                d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z"
                                clipRule="evenodd"
                              />
                            </svg>
                            <span className="font-medium text-blue-700 dark:text-blue-300">
                              {(forum.content.match(/<img/g) || []).length}{" "}
                              gambar
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Clean text content */}
                      <div className="text-gray-600 dark:text-gray-300 leading-relaxed text-sm">
                        {forum.content
                          .replace(/<img[^>]*>/g, "") // Remove img tags
                          .replace(/<[^>]*>/g, "") // Remove all HTML tags
                          .trim()}
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center">
                          <FontAwesomeIcon icon={faUser} className="mr-1" />
                          {forum.user.name}
                        </span>
                        {forum.views_count > 0 && (
                          <span 
                            className={`flex items-center transition-colors ${
                              user && forum.user.id === user.id 
                                ? 'cursor-pointer hover:text-blue-600' 
                                : 'cursor-default'
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleViewersClick(forum);
                            }}
                            title={
                              user && forum.user.id === user.id 
                                ? "Klik untuk melihat siapa yang sudah melihat forum ini" 
                                : "Hanya author yang dapat melihat daftar viewer"
                            }
                          >
                            <FontAwesomeIcon icon={faEye} className="mr-1" />
                            {forum.views_count}
                          </span>
                        )}
                        <span className="flex items-center">
                          <FontAwesomeIcon icon={faReply} className="mr-1" />
                          {forum.replies_count}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleLike(forum.id);
                          }}
                          className={`flex items-center space-x-1 transition-colors ${
                            forumLikes[forum.id]
                              ? "text-red-500"
                              : "text-gray-500 dark:text-gray-400 hover:text-red-500"
                          }`}
                          title={
                            forumLikes[forum.id] ? "Unlike forum" : "Like forum"
                          }
                        >
                          <FontAwesomeIcon icon={faHeart} className="mr-1" />
                          <span>{forum.likes_count}</span>
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleBookmark(forum.id);
                          }}
                          className={`transition-colors ${
                            forumBookmarks[forum.id]
                              ? "text-yellow-500 dark:text-yellow-400"
                              : "text-gray-500 dark:text-gray-400 hover:text-yellow-500 dark:hover:text-yellow-400"
                          }`}
                          title={
                            forumBookmarks[forum.id]
                              ? "Hapus bookmark"
                              : "Bookmark forum"
                          }
                        >
                          <FontAwesomeIcon
                            icon={faBookmark}
                            className={`w-4 h-4 ${
                              forumBookmarks[forum.id] ? "fill-current" : ""
                            }`}
                          />
                        </button>
                      </div>
                      <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                        <FontAwesomeIcon icon={faClock} className="mr-1" />
                        {formatTimeAgo(forum.last_activity_at)}
                        {Boolean(forum.is_edited) && (
                          <span className="text-gray-400 text-xs ml-2">
                            • diedit
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 rounded-xl border border-dashed border-gray-200 dark:border-gray-700 bg-white dark:bg-white/[0.02]">
            <FontAwesomeIcon
              icon={faComments}
              className="text-6xl text-gray-300 mb-4"
            />
            <p className="text-gray-500 dark:text-gray-400 mb-4">
              {searchQuery
                ? "Tidak ada forum yang cocok dengan pencarian"
                : "Belum ada forum di kategori ini"}
            </p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 flex justify-center">
            <div className="flex space-x-2">
              {Array.from({ length: totalPages }, (_, i) => i + 1).map(
                (page) => (
                  <button
                    key={page}
                    onClick={() => setCurrentPage(page)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium ${
                      currentPage === page
                        ? "bg-blue-600 dark:bg-blue-700 text-white"
                        : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700"
                    }`}
                  >
                    {page}
                  </button>
                )
              )}
            </div>
          </div>
        )}
      </div>

      {/* Create Forum Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            {/* Overlay */}
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowCreateModal(false)}
            ></div>
            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto hide-scroll z-[100001] border border-gray-200 dark:border-gray-800"
            >
              <form onSubmit={handleCreateForum}>
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Buat Forum Baru di {category?.name}
                  </h3>
                </div>

                <div className="px-6 py-4 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Judul Forum
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                      className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                      placeholder="Masukkan judul forum yang menarik..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Konten/Deskripsi
                    </label>
                    <QuillEditor
                      value={formData.content}
                      onChange={(content) =>
                        setFormData({ ...formData, content })
                      }
                      placeholder="Jelaskan topik diskusi, pertanyaan, atau ide yang ingin Anda bagikan..."
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Tipe Akses
                    </label>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { value: "public", label: "Publik", info: "Terlihat oleh semua pengguna" },
                        { value: "private", label: "Privat", info: "Hanya pembuat + pengguna terpilih" },
                      ].map((opt) => {
                        const isSelected = formData.access_type === (opt.value as "public" | "private");
                        return (
                          <button
                            type="button"
                            key={opt.value}
                            onClick={() => handleAccessTypeChange(opt.value as "public" | "private")}
                            className={`text-left p-3 rounded-lg border transition-colors ${
                              isSelected
                                ? "bg-blue-50 dark:bg-blue-900/20 border-blue-300 dark:border-blue-600"
                                : "border-gray-300 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800"
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <div
                                className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                  isSelected ? "bg-blue-500 border-blue-500" : "border-gray-300 dark:border-gray-600"
                                }`}
                              >
                                {isSelected && <div className="w-2 h-2 bg-white rounded-full"></div>}
                              </div>
                              <span className="text-sm font-medium text-gray-900 dark:text-white">{opt.label}</span>
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{opt.info}</p>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {formData.access_type === "private" && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Pilih Pengguna yang Berhak Akses
                      </label>
                      <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                        <div className="text-blue-800 dark:text-blue-300 text-sm font-medium mb-1">
                          ℹ️ Info Forum Private
                        </div>
                        <div className="text-blue-700 dark:text-blue-400 text-xs">
                          Forum private hanya bisa diakses oleh Anda (sebagai pembuat) dan pengguna yang dipilih. 
                          Pengguna lain tidak akan bisa melihat atau mengakses forum ini.
                        </div>
                      </div>
                      <div className="flex items-center justify-between mb-3">
                        <input
                          type="text"
                          placeholder="Cari pengguna (opsional)..."
                          value={userSearchQuery}
                          onChange={handleSearchInputChange}
                          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                        />
                        <button
                          type="button"
                          onClick={() => handleUserSearch(userSearchQuery)}
                          className="ml-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                          disabled={searchingUsers}
                        >
                          {searchingUsers ? (
                            <div className="flex items-center space-x-2">
                              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                              <span>Mencari...</span>
                            </div>
                          ) : (
                            <FontAwesomeIcon icon={faSearch} />
                          )}
                        </button>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <label htmlFor="selectAllDosen" className="flex items-center cursor-pointer select-none">
                            <input
                              type="checkbox"
                              id="selectAllDosen"
                              checked={selectAllDosen}
                              onChange={handleSelectAllDosen}
                              className="sr-only"
                            />
                            <span className={`mr-2 inline-flex h-4 w-4 items-center justify-center rounded border text-white shadow-sm transition-colors ${
                              selectAllDosen
                                ? "bg-blue-600 border-blue-600"
                                : "bg-white border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                            }`}>
                              <svg className={`h-3 w-3 ${selectAllDosen ? "opacity-100" : "opacity-0"}`} viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </span>
                            <span className="text-sm text-gray-700 dark:text-gray-300">Pilih Semua Dosen</span>
                            </label>
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                            Total: {searchableUsers.length} pengguna
                          </span>
                        </div>

                        {searchingUsers ? (
                          <div className="space-y-3">
                            {[...Array(4)].map((_, index) => (
                              <div
                                key={index}
                                className="flex items-center justify-between p-3 border-b border-gray-100 dark:border-gray-700 last:border-b-0 animate-pulse"
                              >
                                <div className="flex items-center space-x-3">
                                  <div className="w-4 h-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                                  <div className="w-8 h-8 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                                  <div className="space-y-1">
                                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
                                    <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-20"></div>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="max-h-60 overflow-y-auto hide-scroll border border-gray-200 dark:border-gray-700 rounded-lg">
                            {searchableUsers.length > 0 ? (
                              searchableUsers.map((user) => (
                                <div
                                  key={user.id}
                                  className={`group flex items-center justify-between p-3 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50/60 dark:hover:bg-white/[0.04] rounded-lg ${
                                    formData.selected_users.includes(user.id)
                                      ? "bg-blue-50/80 dark:bg-blue-900/10 ring-1 ring-blue-300/60 dark:ring-blue-800/60"
                                      : ""
                                  }`}
                                >
                                  <button
                                    type="button"
                                    onClick={() => toggleUserSelection(user.id)}
                                    className="group flex items-center w-full text-left"
                                  >
                                    <span className={`mr-3 inline-flex h-4 w-4 items-center justify-center rounded border text-white shadow-sm transition-colors ${
                                      formData.selected_users.includes(user.id)
                                        ? "bg-blue-600 border-blue-600"
                                        : "bg-white border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                                    }`}>
                                      <svg className={`h-3 w-3 ${formData.selected_users.includes(user.id) ? "opacity-100" : "opacity-0"}`} viewBox="0 0 20 20" fill="currentColor">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </span>
                                    <div className="flex items-center gap-3">
                                      <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getAvatarClasses(user.role)}`}>
                                        <span className="text-xs font-semibold leading-none">
                                          {(user.name?.split(' ').length || 0) > 1
                                            ? `${user.name.split(' ')[0].charAt(0)}${user.name.split(' ').slice(-1)[0].charAt(0)}`.toUpperCase()
                                            : user.name?.charAt(0)?.toUpperCase() || 'U'}
                                        </span>
                                      </div>
                                      <div className="leading-tight">
                                      <span className="font-medium text-gray-900 dark:text-white">
                                        {user.name}
                                      </span>
                                        <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getRoleBadgeClasses(user.role)}`}>
                                          {user.role || 'user'}
                                      </span>
                                    </div>
                                  </div>
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                {userSearchQuery
                                  ? "Tidak ada pengguna yang cocok"
                                  : "Memuat daftar pengguna..."}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {formData.selected_users.length > 0 && (
                        <div className="mt-3">
                          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                            Pengguna yang Dipilih (
                            {formData.selected_users.length})
                          </label>
                          <div className="flex flex-wrap gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                            {formData.selected_users.map((userId) => {
                              const user = searchableUsers.find(
                                (u) => u.id === userId
                              );
                              return user ? (
                                <div
                                  key={user.id}
                                  className="flex items-center bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-200 px-2 py-1 rounded-full text-sm"
                                >
                                  <FontAwesomeIcon
                                    icon={faUser}
                                    className="mr-1"
                                  />
                                  {user.name}
                                  <button
                                    type="button"
                                    onClick={() => toggleUserSelection(user.id)}
                                    className="ml-2 text-blue-600 dark:text-blue-300 hover:text-blue-800 dark:hover:text-blue-100"
                                  >
                                    ×
                                  </button>
                                </div>
                              ) : null;
                            })}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end space-x-3">
                  <button
                    type="button"
                    onClick={() => {
                      setShowCreateModal(false);
                      setFormData({
                        title: "",
                        content: "",
                        access_type: "public",
                        selected_users: [],
                      });
                    }}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={
                      uploading ||
                      isCreatingForum ||
                      !formData.title.trim() ||
                      !formData.content.trim()
                    }
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                  >
                    {isCreatingForum ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Menyimpan...</span>
                      </>
                    ) : (
                      "Buat Forum"
                    )}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Forum Confirmation Modal */}
      <AnimatePresence>
        {showDeleteModal && forumToDelete && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            {/* Overlay */}
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => {
                if (deletingForum) return;
                setShowDeleteModal(false);
              }}
            ></div>

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-lg max-w-md w-full z-[100001] px-8 py-8 max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  if (deletingForum) return;
                  setShowDeleteModal(false);
                }}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="w-6 h-6">
                  <path fillRule="evenodd" clipRule="evenodd" d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z" fill="currentColor" />
                </svg>
              </button>

              <div className="pb-4 sm:pb-6">
                <div className="flex items-center space-x-3">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon icon={faTrash} className="text-red-600 dark:text-red-400 text-xl" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-white">Hapus Forum</h3>
                </div>
              </div>

              <div className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg border-l-4 border-l-red-400 dark:border-l-red-500">
                  <p className="text-sm text-gray-800 dark:text-gray-200 font-medium">"{forumToDelete.title}"</p>
                  <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">Oleh: {forumToDelete.user.name}</p>
                  </div>
                <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">Peringatan!</p>
                      <p className="text-sm text-red-700 dark:text-red-300">SEMUA {forumToDelete.replies_count} balasan di dalamnya akan hilang permanen. Tindakan ini tidak dapat dibatalkan.</p>
                  </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-6">
                <button
                  type="button"
                  onClick={() => {
                    if (deletingForum) return;
                    setShowDeleteModal(false);
                  }}
                  disabled={deletingForum}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ease-in-out ${
                    deletingForum
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={confirmDeleteForum}
                  disabled={deletingForum}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium shadow-theme-xs transition-all duration-300 ease-in-out ${
                    deletingForum
                      ? 'bg-red-600/70 text-white cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {deletingForum ? (
                    <span className="inline-flex items-center">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                      Menghapus...
                    </span>
                  ) : (
                    'Ya, Hapus Forum'
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Modal Viewers */}
      <AnimatePresence>
        {showViewersModal && selectedForum && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowViewersModal(false)}
            ></motion.div>
            {/* Modal Content */}
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-2xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => setShowViewersModal(false)}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg width="20" height="20" fill="none" viewBox="0 0 24 24" className="w-6 h-6">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>
              
              <div>
                <div className="flex items-center justify-between pb-4 sm:pb-6">
                  <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                    Siapa yang Melihat Forum Ini
                  </h2>
                </div>
                
                <div className="mb-4">
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                      <FontAwesomeIcon icon={faEye} className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">Forum: {selectedForum.title}</h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Daftar pengguna yang telah melihat forum ini</p>
                    </div>
                  </div>
                </div>

                <div className="mb-6">
                  {viewersLoading ? (
                    <div className="space-y-3">
                      {[...Array(3)].map((_, index) => (
                        <div
                          key={index}
                          className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl animate-pulse"
                        >
                          <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                          <div className="flex-1 space-y-2">
                            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                            <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : viewers.length === 0 ? (
                    <div className="text-center py-8">
                      <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                        <FontAwesomeIcon icon={faEye} className="w-8 h-8 text-gray-400" />
                      </div>
                      <p className="text-gray-500 dark:text-gray-400">Belum ada yang melihat forum ini</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {viewers.map((viewer) => (
                        <div
                          key={viewer.id}
                          className="flex items-center space-x-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                        >
                          <div className="flex-shrink-0">
                            {viewer.user.avatar ? (
                              <img
                                src={viewer.user.avatar}
                                alt={viewer.user.name}
                                className="w-12 h-12 rounded-full object-cover"
                              />
                            ) : (
                              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center text-white font-semibold text-lg">
                                {viewer.user.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">
                              {viewer.user.name}
                            </p>
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              {viewer.user.role} • {new Date(viewer.viewed_at).toLocaleString('id-ID')}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {viewersPagination.has_more && (
                    <div className="mt-6 text-center">
                      {viewersLoading ? (
                        <div className="inline-block px-6 py-3 bg-gray-200 dark:bg-gray-700 rounded-xl animate-pulse">
                          <div className="h-4 w-24 bg-gray-300 dark:bg-gray-600 rounded"></div>
                        </div>
                      ) : (
                        <button
                          onClick={() => fetchViewers(selectedForum.id, viewersPagination.current_page + 1)}
                          className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium"
                        >
                          Muat Lebih Banyak
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200 dark:border-gray-700">
                  {viewersLoading ? (
                    <>
                      <div className="flex items-center space-x-2 animate-pulse">
                        <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                      <div className="flex items-center space-x-2 animate-pulse">
                        <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        <div className="h-4 w-4 bg-gray-200 dark:bg-gray-700 rounded"></div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Total:</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{viewersPagination.total} viewer</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-600 dark:text-gray-400">Halaman</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{viewersPagination.current_page}</span>
                        <span className="text-sm text-gray-600 dark:text-gray-400">dari</span>
                        <span className="text-sm font-semibold text-gray-900 dark:text-white">{viewersPagination.last_page}</span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ForumCategory;
