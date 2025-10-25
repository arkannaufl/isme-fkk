import React, { useState, useEffect, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faBug,
  faUsers,
  faEnvelope,
  faEdit,
  faTrash,
  faPlus,
  faSave,
  faCheck,
  faImage,
  faExclamationTriangle,
  faInfoCircle,
  faRocket,
  faTicket,
  faClock,
  faChartLine,
  faBook,
  faSearch,
  faFilter,
  faSort,
  faEye,
  faCheckCircle,
  faTimesCircle,
  faExclamationCircle,
  faQuestionCircle,
  faTimes,
} from "@fortawesome/free-solid-svg-icons";
import api, { handleApiError } from "../utils/api";

// Constants
const SUCCESS_MESSAGE_DURATION = 5000;
const ITEMS_PER_PAGE = 10;
const MAX_IMAGE_SIZE = 5 * 1024 * 1024; // 5MB
const SUPPORTED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif'];

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

interface KnowledgeArticle {
  id: number;
  title: string;
  content: string;
  images?: string[];
  category: string;
  tags: string[];
  is_published: boolean;
  author_id: number;
  created_at: string;
  updated_at: string;
}

interface User {
  id: number;
  name: string;
  email: string;
  role: string;
}

interface Ticket {
  id: string;
  ticket_number: string;
  title: string;
  description: string;
  images?: string[]; // Array of image paths
  category: string;
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  status: 'Open' | 'In Progress' | 'Resolved' | 'Closed';
  assigned_to: number;
  created_at: string;
  updated_at: string;
  response_time?: number;
  resolution_time?: number;
  satisfaction_rating?: number;
  user_name: string;
  user_email: string;
  developer_name?: string;
}

interface SLAMetrics {
  total_tickets: number;
  open_tickets: number;
  resolved_tickets: number;
  average_response_time: number;
  average_resolution_time: number;
  satisfaction_score: number;
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


const SupportCenter: React.FC = () => {
  const [activeTab, setActiveTab] = useState<"bug" | "feature" | "contact" | "tickets" | "analytics" | "knowledge" | "all-tickets">(
    "bug"
  );
  const [isRefreshing, setIsRefreshing] = useState(false);
  
  // Knowledge Base states
  const [knowledgeArticles, setKnowledgeArticles] = useState<KnowledgeArticle[]>([]);
  const [showAddKnowledge, setShowAddKnowledge] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState<KnowledgeArticle | null>(null);
  const [knowledgeFormData, setKnowledgeFormData] = useState({
    title: '',
    content: '',
    category: 'general',
    tags: '',
    is_published: true
  });

  // Knowledge Base image upload states
  const [knowledgeImages, setKnowledgeImages] = useState<File[]>([]);
  const [knowledgeImagePreviews, setKnowledgeImagePreviews] = useState<string[]>([]);

  // Knowledge Base delete states
  const [showDeleteKnowledge, setShowDeleteKnowledge] = useState(false);
  const [deletingKnowledge, setDeletingKnowledge] = useState<KnowledgeArticle | null>(null);

  // Knowledge Base detail states
  const [showKnowledgeDetail, setShowKnowledgeDetail] = useState(false);
  const [selectedKnowledge, setSelectedKnowledge] = useState<KnowledgeArticle | null>(null);

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [itemsPerPage] = useState(ITEMS_PER_PAGE);
  const [developers, setDevelopers] = useState<Developer[]>([]);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState("");
  
  // Image upload states - separate for each tab
  const [bugImages, setBugImages] = useState<File[]>([]);
  const [bugImagePreviews, setBugImagePreviews] = useState<string[]>([]);
  const [featureImages, setFeatureImages] = useState<File[]>([]);
  const [featureImagePreviews, setFeatureImagePreviews] = useState<string[]>([]);
  const [contactImages, setContactImages] = useState<File[]>([]);
  const [contactImagePreviews, setContactImagePreviews] = useState<string[]>([]);

  // Image preview modal state
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState('');

  // Helper functions to get current tab's image state
  const getCurrentImages = () => {
    switch (activeTab) {
      case 'bug': return bugImages;
      case 'feature': return featureImages;
      case 'contact': return contactImages;
      default: return [];
    }
  };

  const getCurrentImagePreviews = () => {
    switch (activeTab) {
      case 'bug': return bugImagePreviews;
      case 'feature': return featureImagePreviews;
      case 'contact': return contactImagePreviews;
      default: return [];
    }
  };

  const setCurrentImages = (images: File[]) => {
    switch (activeTab) {
      case 'bug': setBugImages(images); break;
      case 'feature': setFeatureImages(images); break;
      case 'contact': setContactImages(images); break;
    }
  };

  const setCurrentImagePreviews = (previews: string[]) => {
    switch (activeTab) {
      case 'bug': setBugImagePreviews(previews); break;
      case 'feature': setFeatureImagePreviews(previews); break;
      case 'contact': setContactImagePreviews(previews); break;
    }
  };

  // Ticketing system states
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [allTickets, setAllTickets] = useState<Ticket[]>([]);
  const [slaMetrics, setSlaMetrics] = useState<SLAMetrics | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);

  // Edit mode for super admin
  const [editMode, setEditMode] = useState(false);
  const [editingDeveloper, setEditingDeveloper] = useState<Developer | null>(
    null
  );
  const [showAddDeveloper, setShowAddDeveloper] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [developerToDelete, setDeveloperToDelete] = useState<Developer | null>(null);

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
      
      // Fetch developers and user data first (required)
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

      // Try to fetch tickets and metrics (optional)
      try {
        const [ticketsResponse, metricsResponse] = await Promise.all([
          api.get("/support-center/tickets"),
          api.get("/support-center/metrics"),
        ]);
        
        
        setTickets(ticketsResponse.data.data || []);
        setSlaMetrics(metricsResponse.data.data || null);

        // If user is super admin, also fetch all tickets
        if (userResponse.data.role === 'super_admin') {
          try {
            const allTicketsResponse = await api.get("/support-center/all-tickets");
            setAllTickets(allTicketsResponse.data.data || []);
          } catch (allTicketsError) {
            setAllTickets([]);
          }
        }
      } catch (optionalError) {
        // Optional data fetch failed, continue with default values
        setTickets([]);
        setSlaMetrics(null);
      }
    } catch (error) {
      // Handle error silently or show user-friendly message
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  };

  // Function to fetch data based on active tab
  const fetchTabData = async (tab: string, page: number = 1) => {
    if (!user) return;
    
    setIsRefreshing(true);
    try {
      switch (tab) {
        case 'tickets':
          const ticketsResponse = await api.get(`/support-center/tickets?page=${page}&per_page=${itemsPerPage}`);
          if (ticketsResponse.data.success) {
            // Handle Laravel pagination response
            const paginationData = ticketsResponse.data.data;
            const ticketsData = paginationData.data || [];
            setTickets(Array.isArray(ticketsData) ? ticketsData : []);
            setTotalPages(paginationData.last_page || 1);
            setTotalItems(paginationData.total || 0);
            setCurrentPage(paginationData.current_page || 1);
          }
          break;
          
        case 'all-tickets':
          if (user.role === 'super_admin') {
            const allTicketsResponse = await api.get(`/support-center/all-tickets?page=${page}&per_page=${itemsPerPage}`);
            if (allTicketsResponse.data.success) {
              // Handle Laravel pagination response
              const paginationData = allTicketsResponse.data.data;
              const allTicketsData = paginationData.data || [];
              setAllTickets(Array.isArray(allTicketsData) ? allTicketsData : []);
              setTotalPages(paginationData.last_page || 1);
              setTotalItems(paginationData.total || 0);
              setCurrentPage(paginationData.current_page || 1);
            }
          }
          break;
          
        case 'analytics':
          const [analyticsTicketsResponse, metricsResponse] = await Promise.all([
            api.get("/support-center/tickets"),
            api.get("/support-center/metrics"),
          ]);
          setTickets(analyticsTicketsResponse.data.data || []);
          setSlaMetrics(metricsResponse.data.data || null);
          break;
          
        case 'knowledge':
          try {
            const endpoint = user.role === 'super_admin' ? "/support-center/knowledge/all" : "/support-center/knowledge";
            const knowledgeResponse = await api.get(`${endpoint}?page=${page}&per_page=${itemsPerPage}`);
            if (knowledgeResponse.data.success) {
              // Handle Laravel pagination response
              const paginationData = knowledgeResponse.data.data;
              setKnowledgeArticles(paginationData.data || []);
              setTotalPages(paginationData.last_page || 1);
              setTotalItems(paginationData.total || 0);
              setCurrentPage(paginationData.current_page || 1);
            }
          } catch (knowledgeError) {
            setKnowledgeArticles([]);
          }
          break;
          
        default:
          // For bug, feature, contact tabs - no specific data to fetch
          break;
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const handleInputChange = useCallback((
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  }, []);

  const handleKnowledgeInputChange = useCallback((
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value, type } = e.target;
    setKnowledgeFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value,
    }));
  }, []);

  // Image upload handlers
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      const currentImages = getCurrentImages();
      const currentPreviews = getCurrentImagePreviews();
      
      const newImages = [...currentImages, ...imageFiles].slice(0, 5); // Max 5 images
      setCurrentImages(newImages);
      
      // Create previews
      const newPreviews = imageFiles.map(file => URL.createObjectURL(file));
      setCurrentImagePreviews([...currentPreviews, ...newPreviews].slice(0, 5));
    }
  };

  const removeImage = (index: number) => {
    const currentImages = getCurrentImages();
    const currentPreviews = getCurrentImagePreviews();
    
    const newImages = currentImages.filter((_, i) => i !== index);
    const newPreviews = currentPreviews.filter((_, i) => i !== index);
    
    setCurrentImages(newImages);
    setCurrentImagePreviews(newPreviews);
    
    // Revoke object URL to prevent memory leaks
    URL.revokeObjectURL(currentPreviews[index]);
  };

  const resetImageUploads = () => {
    // Revoke all object URLs for current tab
    const currentPreviews = getCurrentImagePreviews();
    currentPreviews.forEach(url => URL.revokeObjectURL(url));
    setCurrentImages([]);
    setCurrentImagePreviews([]);
  };

  // Image preview handlers
  const openImagePreview = (imageUrl: string) => {
    setPreviewImageUrl(imageUrl);
    setShowImagePreview(true);
  };

  const closeImagePreview = () => {
    setShowImagePreview(false);
    setPreviewImageUrl('');
  };

  // Knowledge Base image handlers
  const handleKnowledgeImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter(file => file.type.startsWith('image/'));
    
    if (imageFiles.length > 0) {
      const newImages = [...knowledgeImages, ...imageFiles].slice(0, 5); // Max 5 images
      setKnowledgeImages(newImages);
      
      // Create previews
      const newPreviews = imageFiles.map(file => URL.createObjectURL(file));
      setKnowledgeImagePreviews(prev => [...prev, ...newPreviews].slice(0, 5));
    }
  };

  const removeKnowledgeImage = (index: number) => {
    const newImages = knowledgeImages.filter((_, i) => i !== index);
    const newPreviews = knowledgeImagePreviews.filter((_, i) => i !== index);
    
    setKnowledgeImages(newImages);
    setKnowledgeImagePreviews(newPreviews);
    
    // Revoke object URL to prevent memory leaks
    URL.revokeObjectURL(knowledgeImagePreviews[index]);
  };

  const resetKnowledgeImages = () => {
    // Revoke all object URLs
    knowledgeImagePreviews.forEach(url => URL.revokeObjectURL(url));
    setKnowledgeImages([]);
    setKnowledgeImagePreviews([]);
  };

  // Knowledge Base delete handlers
  const handleDeleteKnowledge = (article: KnowledgeArticle) => {
    setDeletingKnowledge(article);
    setShowDeleteKnowledge(true);
  };

  const confirmDeleteKnowledge = async () => {
    if (!deletingKnowledge) return;

    try {
      setSubmitting(true);
      const response = await api.delete(`/support-center/knowledge/${deletingKnowledge.id}`);

      if (response.data.success) {
        setShowSuccess(true);
        setSuccessMessage("Artikel knowledge base berhasil dihapus!");
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          setShowSuccess(false);
        }, SUCCESS_MESSAGE_DURATION);
        
        // Refresh knowledge articles
        await fetchTabData('knowledge');
      }
    } catch (error) {
      handleApiError(error);
    } finally {
      setSubmitting(false);
      setShowDeleteKnowledge(false);
      setDeletingKnowledge(null);
    }
  };

  const closeDeleteKnowledgeModal = () => {
    setShowDeleteKnowledge(false);
    setDeletingKnowledge(null);
  };

  // Knowledge Base detail handlers
  const handleViewKnowledge = (article: KnowledgeArticle) => {
    setSelectedKnowledge(article);
    setShowKnowledgeDetail(true);
  };

  const closeKnowledgeDetailModal = () => {
    setShowKnowledgeDetail(false);
    setSelectedKnowledge(null);
  };

  // Pagination handlers
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    fetchTabData(activeTab, page);
  };

  const handlePreviousPage = () => {
    if (currentPage > 1) {
      handlePageChange(currentPage - 1);
    }
  };

  const handleNextPage = () => {
    if (currentPage < totalPages) {
      handlePageChange(currentPage + 1);
    }
  };

  // Pagination Component
  const PaginationComponent = () => {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
      const pages = [];
      const maxVisiblePages = 5;
      
      if (totalPages <= maxVisiblePages) {
        for (let i = 1; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        if (currentPage <= 3) {
          for (let i = 1; i <= 4; i++) {
            pages.push(i);
          }
          pages.push('...');
          pages.push(totalPages);
        } else if (currentPage >= totalPages - 2) {
          pages.push(1);
          pages.push('...');
          for (let i = totalPages - 3; i <= totalPages; i++) {
            pages.push(i);
          }
        } else {
          pages.push(1);
          pages.push('...');
          for (let i = currentPage - 1; i <= currentPage + 1; i++) {
            pages.push(i);
          }
          pages.push('...');
          pages.push(totalPages);
        }
      }
      
      return pages;
    };

    return (
      <div className="flex items-center justify-between mt-6 px-4 py-3 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-center text-sm text-gray-700 dark:text-gray-300">
          <span>
            Menampilkan {((currentPage - 1) * itemsPerPage) + 1} sampai {Math.min(currentPage * itemsPerPage, totalItems)} dari {totalItems} data
          </span>
        </div>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={handlePreviousPage}
            disabled={currentPage === 1}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Sebelumnya
          </button>
          
          <div className="flex items-center space-x-1">
            {getPageNumbers().map((page, index) => (
              <button
                key={index}
                onClick={() => typeof page === 'number' && handlePageChange(page)}
                disabled={page === '...'}
                className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  page === currentPage
                    ? 'bg-blue-600 text-white'
                    : page === '...'
                    ? 'text-gray-400 cursor-default'
                    : 'text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-600'
                }`}
              >
                {page}
              </button>
            ))}
          </div>
          
          <button
            onClick={handleNextPage}
            disabled={currentPage === totalPages}
            className="px-3 py-2 text-sm font-medium text-gray-500 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Selanjutnya
          </button>
        </div>
      </div>
    );
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

      // Create FormData for file upload
      const formDataToSend = new FormData();
      
      // Add form fields
      Object.entries(data).forEach(([key, value]) => {
        formDataToSend.append(key, value as string);
      });
      
      // Add images
      const currentImages = getCurrentImages();
      currentImages.forEach((image, index) => {
        formDataToSend.append(`images[${index}]`, image);
      });

      const response = await api.post(endpoint, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

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

        // Reset image uploads
        resetImageUploads();

        setTimeout(() => {
          setShowSuccess(false);
        }, SUCCESS_MESSAGE_DURATION);
      }
    } catch (error) {
      handleApiError(error);
      alert(
        "Gagal mengirim. Silakan coba lagi atau hubungi developer langsung via WhatsApp."
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleKnowledgeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    try {
      const endpoint = editingKnowledge 
        ? `/support-center/knowledge/${editingKnowledge.id}`
        : '/support-center/knowledge';
      
      const method = 'post'; // Always use POST for FormData compatibility
      
      // Create FormData for file upload
      const formDataToSend = new FormData();
      
      // Explicitly set _method for PUT requests to ensure Laravel parses FormData correctly
      if (editingKnowledge) {
        formDataToSend.append('_method', 'PUT');
      }
      
      // Add form fields
      formDataToSend.append('title', knowledgeFormData.title);
      formDataToSend.append('content', knowledgeFormData.content);
      formDataToSend.append('category', knowledgeFormData.category);
      
      // Handle tags as array
      const tagsArray = knowledgeFormData.tags.split(',').map(tag => tag.trim()).filter(tag => tag);
      tagsArray.forEach((tag, index) => {
        formDataToSend.append(`tags[${index}]`, tag);
      });
      
      // Handle is_published as boolean
      formDataToSend.append('is_published', knowledgeFormData.is_published ? '1' : '0');
      
      // Add images
      knowledgeImages.forEach((image, index) => {
        formDataToSend.append(`images[${index}]`, image);
      });

      const response = await api[method](endpoint, formDataToSend, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      if (response.data.success) {
        setShowSuccess(true);
        setSuccessMessage(
          editingKnowledge 
            ? "Artikel knowledge base berhasil diperbarui!"
            : "Artikel knowledge base berhasil ditambahkan!"
        );
        
        // Auto-hide success message after 5 seconds
        setTimeout(() => {
          setShowSuccess(false);
        }, SUCCESS_MESSAGE_DURATION);
        
        // Reset form
        setKnowledgeFormData({
          title: '',
          content: '',
          category: 'general',
          tags: '',
          is_published: true
        });
        resetKnowledgeImages();
        setShowAddKnowledge(false);
        setEditingKnowledge(null);
        
        // Refresh knowledge articles
        await fetchTabData('knowledge');
      }
    } catch (error) {
      handleApiError(error);
      alert("Gagal menyimpan artikel knowledge base");
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
      handleApiError(error);
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
      handleApiError(error);
      alert("Gagal menambah developer");
    }
  };

  const handleDeleteDeveloper = (developer: Developer) => {
    setDeveloperToDelete(developer);
    setShowDeleteModal(true);
  };

  const confirmDeleteDeveloper = async () => {
    if (!developerToDelete) return;

    try {
      const response = await api.delete(`/support-center/developers/${developerToDelete.id}`);

      if (response.data.success) {
        setDevelopers((prev) => prev.filter((dev) => dev.id !== developerToDelete.id));
        setShowDeleteModal(false);
        setDeveloperToDelete(null);
      }
    } catch (error) {
      handleApiError(error);
      alert("Gagal menghapus developer");
    }
  };

  const cancelDeleteDeveloper = () => {
    setShowDeleteModal(false);
    setDeveloperToDelete(null);
  };

  const handleStatusUpdate = async (ticketId: string, newStatus: 'Open' | 'In Progress' | 'Resolved' | 'Closed') => {
    try {
      const response = await api.put(`/support-center/tickets/${ticketId}/status`, {
        status: newStatus
      });

      if (response.data.success) {
        // Update the ticket in the list
        setTickets(prevTickets => {
          if (!Array.isArray(prevTickets)) {
            return prevTickets;
          }
          return prevTickets.map(ticket => 
            ticket.id === ticketId 
              ? { ...ticket, status: newStatus as 'Open' | 'In Progress' | 'Resolved' | 'Closed', updated_at: new Date().toISOString() }
              : ticket
          );
        });

        // Update allTickets if it exists (for Super Admin)
        setAllTickets(prevAllTickets => {
          if (!Array.isArray(prevAllTickets)) {
            return prevAllTickets;
          }
          return prevAllTickets.map(ticket => 
            ticket.id === ticketId 
              ? { ...ticket, status: newStatus as 'Open' | 'In Progress' | 'Resolved' | 'Closed', updated_at: new Date().toISOString() }
              : ticket
          );
        });

        // Update selected ticket if it's the same one
        if (selectedTicket && selectedTicket.id === ticketId) {
          setSelectedTicket(prev => prev ? { ...prev, status: newStatus as 'Open' | 'In Progress' | 'Resolved' | 'Closed', updated_at: new Date().toISOString() } : null);
        }

      }
    } catch (error) {
      handleApiError(error);
      alert("Gagal mengupdate status tiket");
    }
  };

  const isSuperAdmin = useMemo(() => user?.role === "super_admin", [user?.role]);
  

  // Helper functions for ticketing system
  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'Critical': return 'text-red-600 bg-red-50 border-red-200';
      case 'High': return 'text-orange-600 bg-orange-50 border-orange-200';
      case 'Medium': return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'Low': return 'text-green-600 bg-green-50 border-green-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Open': return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'In Progress': return 'text-purple-600 bg-purple-50 border-purple-200';
      case 'Resolved': return 'text-green-600 bg-green-50 border-green-200';
      case 'Closed': return 'text-gray-600 bg-gray-50 border-gray-200';
      default: return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'Open': return faExclamationCircle;
      case 'In Progress': return faClock;
      case 'Resolved': return faCheckCircle;
      case 'Closed': return faTimesCircle;
      default: return faQuestionCircle;
    }
  };

  const filteredTickets = Array.isArray(tickets) ? tickets : [];

  if (loading) {
    return (
      <div className="w-full mx-auto">
        {/* Header Skeleton */}
        <div className="mb-8">
          <div className="h-8 bg-gray-300 dark:bg-gray-600 rounded w-1/3 mb-2 animate-pulse"></div>
          <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-2/3 mb-4 animate-pulse"></div>
          
          {/* Info Card Skeleton */}
          <div className="mt-4 p-4 bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-lg animate-pulse">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              <div className="flex-1">
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32 mb-2"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full mb-1"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              </div>
            </div>
          </div>
        </div>

        {/* Tab Navigation Skeleton */}
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm animate-pulse">
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-xl"></div>
              <div>
                <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-32 mb-2"></div>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-48"></div>
              </div>
            </div>
          </div>

          {/* Service Cards Skeleton */}
          <div className={`grid grid-cols-1 md:grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                  <div className="h-5 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
                </div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          {/* Form Section Skeleton */}
          <div className="xl:col-span-2">
            <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm animate-pulse">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-xl"></div>
                <div>
                  <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-32 mb-2"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-48"></div>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-20 mb-2"></div>
                  <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                </div>
                <div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-16 mb-2"></div>
                  <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                </div>
                <div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-20 mb-2"></div>
                  <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                </div>
                <div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-2"></div>
                  <div className="h-20 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                </div>
                <div className="flex justify-end">
                  <div className="h-10 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Developer Sidebar Skeleton */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm animate-pulse">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-300 dark:bg-gray-600 rounded-xl"></div>
                  <div>
                    <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-32 mb-2"></div>
                    <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24"></div>
                  </div>
                </div>
                <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
              </div>
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 animate-pulse">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                          <div>
                            <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-1"></div>
                            <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-16"></div>
                          </div>
                        </div>
                        <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3 mb-3"></div>
                        <div className="space-y-2">
                          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full"></div>
                          <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                <div className="flex-1">
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-24 mb-2"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-full mb-1"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-1"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-2/3"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
    <div className="w-full mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white/90 mb-2">
          Isme Web Service Center
        </h1>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Pusat Layanan Teknologi Informasi Fakultas Kedokteran
        </p>
        
        {/* Info Card */}
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-lg">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-blue-500 flex items-center justify-center">
              <span className="text-white text-xs font-bold">i</span>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-blue-800 dark:text-blue-200 mb-1">
                Service Center Terintegrasi
              </h4>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Sistem layanan terpadu untuk laporan bug, permintaan fitur, dan konsultasi teknis dengan ticketing system dan SLA management.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Success Message */}
      <AnimatePresence mode="wait">
        {showSuccess && (
          <motion.div
            key="success-message"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-500 dark:border-green-700 rounded-lg flex items-center gap-3"
          >
            <FontAwesomeIcon
              icon={faCheck}
              className="w-6 h-6 text-green-500"
            />
            <span className="text-green-700 dark:text-green-300">{successMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tab Navigation */}
      <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm">
        <div className="flex items-start justify-between mb-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
              <FontAwesomeIcon
                icon={faUsers}
                className="w-6 h-6 text-slate-600 dark:text-slate-300"
              />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                Service Center
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Pilih jenis layanan yang Anda butuhkan
              </p>
            </div>
          </div>
        </div>

        <div className={`grid grid-cols-1 md:grid-cols-2 ${isSuperAdmin ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
          {[
            {
              key: "bug",
              label: "Laporan Bug",
              icon: faBug,
              color: "text-red-600",
              bgColor: "bg-red-50 dark:bg-red-900/20",
              borderColor: "border-red-200 dark:border-red-700",
              description: "Laporkan masalah teknis"
            },
            {
              key: "feature",
              label: "Permintaan Fitur",
              icon: faRocket,
              color: "text-emerald-600",
              bgColor: "bg-emerald-50 dark:bg-emerald-900/20",
              borderColor: "border-emerald-200 dark:border-emerald-700",
              description: "Ajukan fitur baru"
            },
            {
              key: "contact",
              label: "Hubungi Tim",
              icon: faUsers,
              color: "text-blue-600",
              bgColor: "bg-blue-50 dark:bg-blue-900/20",
              borderColor: "border-blue-200 dark:border-blue-700",
              description: "Konsultasi langsung"
            },
            {
              key: "tickets",
              label: "Tiket Saya",
              icon: faTicket,
              color: "text-purple-600",
              bgColor: "bg-purple-50 dark:bg-purple-900/20",
              borderColor: "border-purple-200 dark:border-purple-700",
              description: "Lihat status tiket"
            },
            ...(isSuperAdmin ? [{
              key: "all-tickets",
              label: "Semua Tiket",
              icon: faTicket,
              color: "text-indigo-600",
              bgColor: "bg-indigo-50 dark:bg-indigo-900/20",
              borderColor: "border-indigo-200 dark:border-indigo-700",
              description: "Kelola semua tiket"
            }] : []),
            {
              key: "analytics",
              label: "Analytics",
              icon: faChartLine,
              color: "text-indigo-600",
              bgColor: "bg-indigo-50 dark:bg-indigo-900/20",
              borderColor: "border-indigo-200 dark:border-indigo-700",
              description: "Dashboard performa"
            },
            {
              key: "knowledge",
              label: "Knowledge Base",
              icon: faBook,
              color: "text-amber-600",
              bgColor: "bg-amber-50 dark:bg-amber-900/20",
              borderColor: "border-amber-200 dark:border-amber-700",
              description: "Panduan & FAQ"
            },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={async () => {
                setActiveTab(tab.key as any);
                setCurrentPage(1); // Reset to first page when switching tabs
                
                // Fetch fresh data for the selected tab
                await fetchTabData(tab.key, 1);
              }}
              className={`p-4 rounded-xl border transition-all duration-200 hover:shadow-md ${
                activeTab === tab.key
                  ? `${tab.bgColor} ${tab.borderColor} border-2`
                  : "bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700/50"
              }`}
            >
              <div className="flex items-center space-x-3">
                <div className={`p-2 rounded-lg ${activeTab === tab.key ? tab.bgColor : 'bg-gray-100 dark:bg-gray-600'}`}>
                  <FontAwesomeIcon
                    icon={tab.icon}
                    className={`text-lg ${tab.color}`}
                  />
                </div>
                <div className="text-left">
                  <div className={`font-semibold text-sm ${
                    activeTab === tab.key 
                      ? 'text-gray-900 dark:text-white' 
                      : 'text-gray-600 dark:text-gray-400'
                  }`}>
                    {tab.label}
                  </div>
                  <div className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                    {tab.description}
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main Content */}
      {/* Tickets View */}
      {activeTab === "tickets" && (
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm">
          {isRefreshing && (
            <div className="flex items-center justify-center mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-sm text-blue-600 dark:text-blue-400">Memperbarui data...</span>
            </div>
          )}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                <FontAwesomeIcon
                  icon={faTicket}
                  className="w-6 h-6 text-slate-600 dark:text-slate-300"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  Tiket Saya
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Kelola dan pantau status tiket Anda
                </p>
              </div>
            </div>
              </div>

              {/* Tickets List */}
              <div className="space-y-4">
                {filteredTickets.length === 0 ? (
                  <div className="text-center py-12">
                    <FontAwesomeIcon icon={faTicket} className="text-4xl text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                      Belum ada tiket
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400">
                      Anda belum membuat tiket apapun. Mulai dengan melaporkan bug atau meminta fitur baru.
                    </p>
                  </div>
                ) : (
                  filteredTickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedTicket(ticket)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <span className="text-sm font-mono text-gray-500">
                              #{ticket.ticket_number}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(ticket.priority)}`}>
                              {ticket.priority}
                            </span>
                            <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                              <FontAwesomeIcon icon={getStatusIcon(ticket.status)} className="mr-1" />
                              {ticket.status}
                            </span>
                          </div>
                          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                            {ticket.title}
                          </h3>
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                            {ticket.description}
                          </p>
                          
                          {/* Images Preview */}
                          {ticket.images && ticket.images.length > 0 && (
                            <div className="flex items-center space-x-2 mb-2">
                              <FontAwesomeIcon icon={faImage} className="w-3 h-3 text-gray-400" />
                              <span className="text-xs text-gray-500">
                                {ticket.images.length} gambar
                              </span>
                              <div className="flex space-x-1">
                                {ticket.images.slice(0, 3).map((image, index) => (
                                  <img
                                    key={index}
                                    src={`${import.meta.env.VITE_API_URL}/${image}`}
                                    alt={`Preview ${index + 1}`}
                                    className="w-8 h-8 object-cover rounded border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      openImagePreview(`${import.meta.env.VITE_API_URL}/${image}`);
                                    }}
                                  />
                                ))}
                                {ticket.images.length > 3 && (
                                  <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                                    <span className="text-xs text-gray-500">+{ticket.images.length - 3}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                          
                          <div className="flex items-center space-x-4 text-xs text-gray-500">
                            <span>Dibuat: {new Date(ticket.created_at).toLocaleDateString('id-ID')}</span>
                            {ticket.developer_name && (
                              <span>Assigned to: {ticket.developer_name}</span>
                            )}
                            {ticket.response_time && (
                              <span>Response: {ticket.response_time}m</span>
                            )}
                          </div>
                        </div>
                        <FontAwesomeIcon icon={faEye} className="text-gray-400" />
                      </div>
                    </div>
                  ))
                )}
              </div>
              
              {/* Pagination */}
              <PaginationComponent />
        </div>
      )}

      {/* All Tickets View - Super Admin Only */}
      {activeTab === "all-tickets" && isSuperAdmin && (
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm">
          {isRefreshing && (
            <div className="flex items-center justify-center mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-sm text-blue-600 dark:text-blue-400">Memperbarui data...</span>
            </div>
          )}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                <FontAwesomeIcon
                  icon={faTicket}
                  className="w-6 h-6 text-slate-600 dark:text-slate-300"
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Semua Tiket
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Kelola dan pantau semua tiket sistem
                </p>
              </div>
            </div>
          </div>

          {/* Info message for Super Admin */}
          {isSuperAdmin && (
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
              <div className="flex items-start space-x-3">
                <FontAwesomeIcon 
                  icon={faInfoCircle} 
                  className="w-5 h-5 text-blue-500 dark:text-blue-400 mt-0.5 flex-shrink-0" 
                />
                <div>
                  <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                    Informasi untuk Super Admin
                  </h4>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    Klik pada tiket untuk membuka modal detail dan mengubah status tiket. 
                    Anda dapat mengubah status dari Open → In Progress → Resolved → Closed.
                  </p>
                </div>
              </div>
            </div>
          )}

          {(Array.isArray(allTickets) ? allTickets : []).length === 0 ? (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <FontAwesomeIcon icon={faTicket} className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Belum ada tiket
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                Belum ada tiket yang dibuat dalam sistem.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {(Array.isArray(allTickets) ? allTickets : []).map((ticket) => (
                  <div
                    key={ticket.id}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                    onClick={() => setSelectedTicket(ticket)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center space-x-3 mb-2">
                          <span className="text-sm font-mono text-gray-500">
                            #{ticket.ticket_number}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(ticket.priority)}`}>
                            {ticket.priority}
                          </span>
                          <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(ticket.status)}`}>
                            <FontAwesomeIcon icon={getStatusIcon(ticket.status)} className="mr-1" />
                            {ticket.status}
                          </span>
                        </div>
                        <h3 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {ticket.title}
                        </h3>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2 line-clamp-2">
                          {ticket.description}
                        </p>
                        
                        {/* Images Preview */}
                        {ticket.images && ticket.images.length > 0 && (
                          <div className="flex items-center space-x-2 mb-2">
                            <FontAwesomeIcon icon={faImage} className="w-3 h-3 text-gray-400" />
                            <span className="text-xs text-gray-500">
                              {ticket.images.length} gambar
                            </span>
                            <div className="flex space-x-1">
                              {ticket.images.slice(0, 3).map((image, index) => (
                                <img
                                  key={index}
                                  src={`${import.meta.env.VITE_API_URL}/${image}`}
                                  alt={`Preview ${index + 1}`}
                                  className="w-8 h-8 object-cover rounded border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openImagePreview(`${import.meta.env.VITE_API_URL}/${image}`);
                                  }}
                                />
                              ))}
                              {ticket.images.length > 3 && (
                                <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                                  <span className="text-xs text-gray-500">+{ticket.images.length - 3}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                        
                        <div className="flex items-center space-x-4 text-xs text-gray-500">
                          <span>Dibuat: {new Date(ticket.created_at).toLocaleDateString('id-ID')}</span>
                          <span>Oleh: {ticket.user_name}</span>
                          {ticket.developer_name && (
                            <span>Assigned to: {ticket.developer_name}</span>
                          )}
                          {ticket.response_time && (
                            <span>Response: {ticket.response_time}m</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTicket(ticket);
                          }}
                          className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                          title="Lihat Detail"
                        >
                          <FontAwesomeIcon icon={faEye} className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
            </div>
          )}
          
          {/* Pagination */}
          <PaginationComponent />
        </div>
      )}

      {/* Analytics View */}
      {activeTab === "analytics" && (
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm">
          {isRefreshing && (
            <div className="flex items-center justify-center mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-sm text-blue-600 dark:text-blue-400">Memperbarui data...</span>
            </div>
          )}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                <FontAwesomeIcon
                  icon={faChartLine}
                  className="w-6 h-6 text-slate-600 dark:text-slate-300"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  Analytics Dashboard
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Monitoring performa dan statistik layanan
                </p>
              </div>
            </div>
          </div>
          {slaMetrics ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
                <div className="flex items-center">
                  <FontAwesomeIcon icon={faTicket} className="text-2xl text-blue-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold text-blue-600">{slaMetrics.total_tickets}</div>
                    <div className="text-sm text-gray-600">Total Tickets</div>
                  </div>
                </div>
              </div>
              <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
                <div className="flex items-center">
                  <FontAwesomeIcon icon={faCheckCircle} className="text-2xl text-green-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold text-green-600">{slaMetrics.resolved_tickets}</div>
                    <div className="text-sm text-gray-600">Resolved</div>
                  </div>
                </div>
              </div>
              <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
                <div className="flex items-center">
                  <FontAwesomeIcon icon={faClock} className="text-2xl text-orange-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold text-orange-600">{slaMetrics.average_response_time}m</div>
                    <div className="text-sm text-gray-600">Avg Response</div>
                  </div>
                </div>
              </div>
              <div className="bg-purple-50 dark:bg-purple-900/20 rounded-lg p-4">
                <div className="flex items-center">
                  <FontAwesomeIcon icon={faChartLine} className="text-2xl text-purple-600 mr-3" />
                  <div>
                    <div className="text-2xl font-bold text-purple-600">{slaMetrics.satisfaction_score}%</div>
                    <div className="text-sm text-gray-600">Satisfaction</div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-12">
              <FontAwesomeIcon icon={faChartLine} className="text-4xl text-gray-400 mb-4" />
              <p className="text-gray-600 dark:text-gray-400">Tidak ada data analytics tersedia</p>
            </div>
          )}
        </div>
      )}

      {/* Knowledge Base View */}
      {activeTab === "knowledge" && (
        <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm">
          {isRefreshing && (
            <div className="flex items-center justify-center mb-4 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
              <span className="text-sm text-blue-600 dark:text-blue-400">Memperbarui data...</span>
            </div>
          )}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                <FontAwesomeIcon
                  icon={faBook}
                  className="w-6 h-6 text-slate-600 dark:text-slate-300"
                />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                  Knowledge Base
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  Panduan dan FAQ untuk layanan teknis
                </p>
              </div>
            </div>
            {isSuperAdmin && (
              <button
                onClick={() => setShowAddKnowledge(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors duration-200"
              >
                <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                Tambah Artikel
              </button>
            )}
          </div>
          
          {knowledgeArticles.length === 0 ? (
            <div className="text-center py-12">
              <FontAwesomeIcon icon={faBook} className="text-4xl text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                Knowledge Base
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                {isSuperAdmin ? "Belum ada artikel. Klik 'Tambah Artikel' untuk membuat artikel pertama." : "Panduan dan FAQ akan tersedia di sini"}
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {knowledgeArticles.map((article) => (
                <div 
                  key={article.id} 
                  className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  onClick={() => handleViewKnowledge(article)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                          {article.category}
                        </span>
                        {article.is_published ? (
                          <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-xs rounded-full">
                            Published
                          </span>
                        ) : (
                          <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-xs rounded-full">
                            Draft
                          </span>
                        )}
                      </div>
                      <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                        {article.title}
                      </h3>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-3 line-clamp-3">
                        {article.content}
                      </p>
                      {article.tags && Array.isArray(article.tags) && article.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {article.tags.map((tag: string, index: number) => (
                            <span key={`${article.id}-tag-${index}`} className="px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded">
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                      {/* Images Preview */}
                      {article.images && article.images.length > 0 && (
                        <div className="flex items-center space-x-2 mb-2">
                          <FontAwesomeIcon icon={faImage} className="w-3 h-3 text-gray-400" />
                          <span className="text-xs text-gray-500">
                            {article.images.length} gambar
                          </span>
                          <div className="flex space-x-1">
                            {article.images.slice(0, 3).map((image, index) => (
                              <img
                                key={index}
                                src={`${import.meta.env.VITE_API_URL}/${image}`}
                                alt={`Preview ${index + 1}`}
                                className="w-8 h-8 object-cover rounded border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openImagePreview(`${import.meta.env.VITE_API_URL}/${image}`);
                                }}
                              />
                            ))}
                            {article.images.length > 3 && (
                              <div className="w-8 h-8 bg-gray-100 dark:bg-gray-700 rounded border border-gray-200 dark:border-gray-600 flex items-center justify-center">
                                <span className="text-xs text-gray-500">+{article.images.length - 3}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                      
                      <div className="text-xs text-gray-500">
                        Dibuat: {new Date(article.created_at).toLocaleDateString('id-ID')}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 ml-4">
                      {/* View Button - Available for all users */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewKnowledge(article);
                        }}
                        className="p-2 text-gray-400 hover:text-green-600 dark:hover:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg transition-colors"
                        title="Lihat Detail"
                      >
                        <FontAwesomeIcon icon={faEye} className="w-4 h-4" />
                      </button>
                      
                      {isSuperAdmin && (
                        <div className="flex items-center space-x-1">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingKnowledge(article);
                              setKnowledgeFormData({
                                title: article.title,
                                content: article.content,
                                category: article.category,
                                tags: article.tags ? article.tags.join(', ') : '',
                                is_published: article.is_published
                              });
                              
                              // Load existing images for edit
                              if (article.images && article.images.length > 0) {
                                // Create preview URLs for existing images
                                const imagePreviews = article.images.map(image => 
                                  `${import.meta.env.VITE_API_URL}/${image}`
                                );
                                setKnowledgeImagePreviews(imagePreviews);
                                
                                // Create dummy File objects for existing images (for form submission)
                                const dummyFiles = article.images.map((image, index) => {
                                  const dummyFile = new File([''], `existing_${index}.jpg`, { type: 'image/jpeg' });
                                  return dummyFile;
                                });
                                setKnowledgeImages(dummyFiles);
                              } else {
                                // Clear images if no existing images
                                setKnowledgeImagePreviews([]);
                                setKnowledgeImages([]);
                              }
                              
                              setShowAddKnowledge(true);
                            }}
                            className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                            title="Edit Artikel"
                          >
                            <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
                          </button>
                          
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteKnowledge(article);
                            }}
                            className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                            title="Hapus Artikel"
                          >
                            <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* Pagination */}
          <PaginationComponent />
        </div>
      )}

      {/* Form Section for Bug, Feature, Contact */}
      {(activeTab === "bug" || activeTab === "feature" || activeTab === "contact") && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2">
            <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 mb-8 shadow-sm">
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
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-gray-400"
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

                {/* Image Upload Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Upload Gambar (Opsional) {getCurrentImages().length > 0 && `(${getCurrentImages().length}/5 dipilih)`}
                  </label>
                  <div className="space-y-4">
                    {/* File Input */}
                    <div className="flex items-center gap-4">
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        onChange={handleImageSelect}
                        className="hidden"
                        id="image-upload"
                      />
                      <label
                        htmlFor="image-upload"
                        className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                      >
                        <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                        {getCurrentImages().length > 0 ? `Pilih Gambar (${getCurrentImages().length}/5)` : 'Pilih Gambar'}
                      </label>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        Maksimal 5 gambar, format: JPG, PNG, GIF
                      </span>
                    </div>

                    {/* Image Previews */}
                    {getCurrentImagePreviews().length > 0 && (
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        {getCurrentImagePreviews().map((preview, index) => (
                          <div key={index} className="relative group">
                            <img
                              src={preview}
                              alt={`Preview ${index + 1}`}
                              className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
                              onClick={() => openImagePreview(preview)}
                            />
                            <button
                              type="button"
                              onClick={() => removeImage(index)}
                              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

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

                {/* Enhanced Submit Button */}
                <div className="flex justify-end pt-6 border-t border-gray-200 dark:border-gray-700">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-8 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-sm hover:shadow-md flex items-center space-x-2"
                  >
                    {submitting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        <span>Mengirim...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faEnvelope} />
                        <span>
                          Kirim{" "}
                          {activeTab === "bug"
                            ? "Laporan Bug"
                            : activeTab === "feature"
                            ? "Permintaan Fitur"
                            : "Pesan"}
                        </span>
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
            <div className="bg-white dark:bg-gray-800/50 border border-gray-200 dark:border-gray-700 rounded-2xl p-6 shadow-sm">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-800 rounded-xl flex items-center justify-center shadow-sm">
                    <FontAwesomeIcon
                      icon={faUsers}
                      className="w-6 h-6 text-slate-600 dark:text-slate-300"
                    />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-1">
                      Tim Pengembangan
                    </h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      Tim IT Support Isme Web
                    </p>
                  </div>
                </div>
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
                      className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
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
                      className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-all duration-200 hover:shadow-sm"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="w-8 h-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                              <FontAwesomeIcon icon={faUsers} className="text-blue-600 text-sm" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-gray-900 dark:text-gray-100 truncate">
                                {developer.name}
                              </h4>
                              <p className="text-sm text-blue-600 dark:text-blue-400 font-medium">
                                {developer.role}
                              </p>
                            </div>
                          </div>
                          
                          <p className="text-xs text-gray-600 dark:text-gray-400 mb-3 break-words">
                            {developer.expertise}
                          </p>

                          <div className="space-y-2">
                            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                              <FontAwesomeIcon
                                icon={faEnvelope}
                                className="mr-2 flex-shrink-0 w-3 h-3"
                              />
                              <span className="break-all">{developer.email}</span>
                            </div>
                            {developer.whatsapp && (
                              <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                                <FontAwesomeIcon
                                  icon={faEnvelope}
                                  className="mr-2 flex-shrink-0 w-3 h-3"
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
                              className="p-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-all duration-200"
                              title="Edit Developer"
                            >
                              <FontAwesomeIcon
                                icon={faEdit}
                                className="w-3 h-3"
                              />
                            </button>
                            <button
                              onClick={() => handleDeleteDeveloper(developer)}
                              className="p-2 text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
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
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-6">
              <div className="flex items-start space-x-4">
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={faInfoCircle}
                      className="text-blue-600 text-lg"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <h4 className="text-sm font-bold text-blue-800 dark:text-blue-200 mb-2">
                    SLA (Service Level Agreement)
                  </h4>
                  <div className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
                    <div className="flex items-center space-x-2">
                      <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
                      <span>Response Time: 2-4 jam (Critical), 24 jam (Normal)</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FontAwesomeIcon icon={faCheckCircle} className="w-3 h-3" />
                      <span>Resolution Time: 1-3 hari kerja</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <FontAwesomeIcon icon={faEnvelope} className="w-3 h-3" />
                      <span>Emergency: Hubungi langsung via WhatsApp</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            </div>
          </div>
        )}
      </div>

      {/* Enhanced Edit Developer Modal */}
      <AnimatePresence mode="wait">
        {(editMode || showAddDeveloper) && editingDeveloper && (
          <div key="edit-developer-modal" className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => {
                setEditMode(false);
                setShowAddDeveloper(false);
                setEditingDeveloper(null);
              }}
            ></motion.div>
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-lg mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={() => {
                  setEditMode(false);
                  setShowAddDeveloper(false);
                  setEditingDeveloper(null);
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
              {/* Header */}
              <div className="flex items-center gap-4 mb-8">
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center shadow-sm">
                  <FontAwesomeIcon
                    icon={faUsers}
                    className="text-blue-600 text-xl"
                  />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                    {showAddDeveloper ? "Tambah Developer" : "Edit Developer"}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {showAddDeveloper ? "Tambahkan developer baru ke tim" : "Edit informasi developer"}
                  </p>
                </div>
              </div>

              <div className="space-y-6">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                    Nama Lengkap *
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
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-gray-400"
                    placeholder="Masukkan nama lengkap"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-gray-400"
                    placeholder="Masukkan email"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-gray-400"
                    placeholder="Masukkan peran"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-gray-400"
                    placeholder="Masukkan nomor WhatsApp"
                  />
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
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
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-all duration-200 hover:border-gray-400 resize-none"
                    placeholder="Masukkan keahlian"
                  />
                </div>
                </div>

              {/* Action Buttons */}
              <div className="flex justify-end space-x-3 mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setEditMode(false);
                    setShowAddDeveloper(false);
                    setEditingDeveloper(null);
                  }}
                  className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-all duration-200 font-semibold"
                >
                  Batal
                </button>
                <button
                  onClick={
                    showAddDeveloper
                      ? handleAddDeveloper
                      : handleSaveDeveloper
                  }
                  className="px-6 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all duration-200 font-semibold shadow-sm hover:shadow-md flex items-center space-x-2"
                >
                  <FontAwesomeIcon icon={faSave} />
                  <span>{showAddDeveloper ? "Tambah" : "Simpan"}</span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Ticket Detail Modal */}
      <AnimatePresence mode="wait">
        {selectedTicket && (
          <div key={`ticket-modal-${selectedTicket.id}`} className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setSelectedTicket(null)}
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
                onClick={() => setSelectedTicket(null)}
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
              
              <div>
                <div className="flex items-center justify-between pb-4 sm:pb-6">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center shadow-sm">
                      <FontAwesomeIcon icon={faTicket} className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                        Detail Tiket
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        #{selectedTicket.ticket_number}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h4 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-2">
                      {selectedTicket.title}
                    </h4>
                    <div className="flex items-center space-x-3 mb-4">
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getPriorityColor(selectedTicket.priority)}`}>
                        {selectedTicket.priority}
                      </span>
                      <span className={`px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedTicket.status)}`}>
                        <FontAwesomeIcon icon={getStatusIcon(selectedTicket.status)} className="mr-1" />
                        {selectedTicket.status}
                      </span>
                    </div>
                  </div>

                  <div>
                    <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Deskripsi</h5>
                    <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
                      {selectedTicket.description}
                    </p>
                  </div>

                  {/* Images */}
                  {selectedTicket.images && selectedTicket.images.length > 0 ? (
                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
                        Gambar ({selectedTicket.images.length})
                      </h5>
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                        {selectedTicket.images.map((image, index) => {
                          const imageUrl = `${import.meta.env.VITE_API_URL}/${image}`;
                          return (
                            <div key={index} className="relative group">
                              <img
                                src={imageUrl}
                                alt={`Gambar ${index + 1}`}
                                className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600 transition-opacity"
                              />
                              <button
                                onClick={() => openImagePreview(imageUrl)}
                                className="absolute inset-0 bg-black bg-opacity-50 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium"
                              >
                                Lihat Gambar
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Dibuat</h5>
                      <p className="text-gray-600 dark:text-gray-400">
                        {new Date(selectedTicket.created_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Terakhir Diupdate</h5>
                      <p className="text-gray-600 dark:text-gray-400">
                        {new Date(selectedTicket.updated_at).toLocaleString('id-ID')}
                      </p>
                    </div>
                  </div>

                  {selectedTicket.developer_name && (
                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Assigned to</h5>
                      <p className="text-gray-600 dark:text-gray-400">{selectedTicket.developer_name}</p>
                    </div>
                  )}

                  {selectedTicket.response_time && (
                    <div>
                      <h5 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Response Time</h5>
                      <p className="text-gray-600 dark:text-gray-400">{selectedTicket.response_time} menit</p>
                    </div>
                  )}

                  {/* Status Update Section - Only for Super Admin */}
                  {isSuperAdmin && (
                    <div className="border-t border-gray-200 dark:border-gray-700 pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <h5 className="font-semibold text-gray-900 dark:text-gray-100">Update Status</h5>
                        <div className="flex items-center space-x-2 text-sm text-gray-500 dark:text-gray-400">
                          <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4" />
                          <span>Klik untuk mengubah status</span>
                        </div>
                      </div>
                    
                    {/* Current Status Info */}
                    <div className="mb-4 p-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <div className="flex items-center space-x-2">
                        <FontAwesomeIcon icon={faInfoCircle} className="w-4 h-4 text-slate-500 dark:text-slate-400" />
                        <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                          Status Saat Ini: 
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(selectedTicket.status)}`}>
                          <FontAwesomeIcon icon={getStatusIcon(selectedTicket.status)} className="mr-1" />
                          {selectedTicket.status}
                        </span>
                      </div>
                    </div>

                    {/* Status Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      {['Open', 'In Progress', 'Resolved', 'Closed'].map((status) => {
                        const isCurrentStatus = selectedTicket.status === status;
                        const isDestructive = status === 'Closed';
                        
                        // Get status-specific colors (subtle and soft)
                        const getStatusButtonColors = (status: string, isCurrent: boolean) => {
                          if (isCurrent) {
                            return 'bg-gray-100 dark:bg-gray-800 text-gray-500 cursor-not-allowed border-gray-300 dark:border-gray-600';
                          }
                          
                          switch (status) {
                            case 'Open':
                              return 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-600';
                            case 'In Progress':
                              return 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-600';
                            case 'Resolved':
                              return 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-600';
                            case 'Closed':
                              return 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-600';
                            default:
                              return 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:border-slate-300 dark:hover:border-slate-600';
                          }
                        };

                        const getStatusIconColors = (status: string, isCurrent: boolean) => {
                          if (isCurrent) return 'text-gray-400';
                          
                          switch (status) {
                            case 'Open':
                              return 'text-blue-500 dark:text-blue-400';
                            case 'In Progress':
                              return 'text-purple-500 dark:text-purple-400';
                            case 'Resolved':
                              return 'text-green-500 dark:text-green-400';
                            case 'Closed':
                              return 'text-red-500 dark:text-red-400';
                            default:
                              return 'text-slate-500 dark:text-slate-400';
                          }
                        };

                        const getCurrentStatusIndicatorColor = (status: string) => {
                          switch (status) {
                            case 'Open':
                              return 'bg-blue-500';
                            case 'In Progress':
                              return 'bg-purple-500';
                            case 'Resolved':
                              return 'bg-green-500';
                            case 'Closed':
                              return 'bg-red-500';
                            default:
                              return 'bg-gray-500';
                          }
                        };
                        
                        return (
                          <button
                            key={status}
                            onClick={() => {
                              if (isDestructive) {
                                if (confirm(`Apakah Anda yakin ingin menutup tiket ini? Tindakan ini tidak dapat dibatalkan.`)) {
                                  handleStatusUpdate(selectedTicket.id, status as 'Open' | 'In Progress' | 'Resolved' | 'Closed');
                                }
                              } else {
                                handleStatusUpdate(selectedTicket.id, status as 'Open' | 'In Progress' | 'Resolved' | 'Closed');
                              }
                            }}
                            disabled={isCurrentStatus}
                            className={`relative p-4 rounded-xl text-sm font-medium transition-all duration-200 border-2 ${getStatusButtonColors(status, isCurrentStatus)}`}
                          >
                            <div className="flex items-center space-x-3">
                              <FontAwesomeIcon 
                                icon={getStatusIcon(status)} 
                                className={`w-5 h-5 ${getStatusIconColors(status, isCurrentStatus)}`} 
                              />
                              <div className="text-left">
                                <div className="font-medium">{status}</div>
                                <div className="text-xs opacity-75">
                                  {status === 'Open' && 'Tiket baru, belum ditangani'}
                                  {status === 'In Progress' && 'Sedang dalam proses penanganan'}
                                  {status === 'Resolved' && 'Sudah diselesaikan, menunggu konfirmasi'}
                                  {status === 'Closed' && 'Tiket ditutup dan selesai'}
                                </div>
                              </div>
                            </div>
                            
                            {isCurrentStatus && (
                              <div className="absolute top-2 right-2">
                                <div className={`w-2 h-2 ${getCurrentStatusIndicatorColor(status)} rounded-full`}></div>
                              </div>
                            )}
                            
                            {isDestructive && !isCurrentStatus && (
                              <div className="absolute top-2 right-2">
                                <FontAwesomeIcon icon={faExclamationTriangle} className="w-3 h-3 text-red-500" />
                              </div>
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Warning for Closed Status */}
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-700 rounded-lg">
                      <div className="flex items-start space-x-2">
                        <FontAwesomeIcon icon={faExclamationTriangle} className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5" />
                        <div className="text-sm">
                          <p className="font-medium text-yellow-800 dark:text-yellow-200 mb-1">
                            ⚠️ Peringatan
                          </p>
                          <p className="text-yellow-700 dark:text-yellow-300">
                            Menutup tiket akan mengakhiri proses penanganan. Pastikan masalah sudah benar-benar terselesaikan sebelum menutup tiket.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence mode="wait">
          {showDeleteModal && (
            <div key="delete-developer-modal" className="fixed inset-0 z-[100000] flex items-center justify-center">
              {/* Overlay */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={cancelDeleteDeveloper}
              ></motion.div>
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
                  onClick={cancelDeleteDeveloper}
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
                
                <div>
                  <div className="flex items-center justify-between pb-4 sm:pb-6">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                      Hapus Developer
                    </h2>
                  </div>
                  
                  <div className="mb-6">
                    <div className="flex items-center space-x-3 mb-4">
                      <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                        <FontAwesomeIcon
                          icon={faExclamationTriangle}
                          className="w-6 h-6 text-red-600 dark:text-red-400"
                        />
                      </div>
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-white">
                          Konfirmasi Hapus
                        </h4>
                        <p className="text-sm text-gray-600 dark:text-gray-400">
                          Tindakan ini tidak dapat dibatalkan!
                        </p>
                      </div>
                    </div>
                    
                    <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                      <div className="flex items-start space-x-3">
                        <svg
                          className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.732-.833-2.5 0L4.268 18.5c-.77.833.192 2.5 1.732 2.5z"
                          />
                        </svg>
                        <div>
                          <p className="text-sm text-red-800 dark:text-red-200">
                            <strong>Developer yang akan dihapus:</strong>
                          </p>
                          <p className="text-sm text-red-700 dark:text-red-300 mt-1">
                            {developerToDelete?.name} ({developerToDelete?.email})
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex space-x-3">
                    <button
                      onClick={cancelDeleteDeveloper}
                      className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors duration-200 font-medium"
                    >
                      Batal
                    </button>
                    <button
                      onClick={confirmDeleteDeveloper}
                      className="flex-1 px-4 py-3 text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors duration-200 font-medium"
                    >
                      Hapus Developer
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
      </AnimatePresence>

      {/* Knowledge Base Modal */}
      <AnimatePresence mode="wait">
          {showAddKnowledge && (
            <div key={editingKnowledge ? `edit-knowledge-${editingKnowledge.id}` : 'add-knowledge'} className="fixed inset-0 z-[100000] flex items-center justify-center">
              {/* Overlay */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
                onClick={() => {
                  setShowAddKnowledge(false);
                  setEditingKnowledge(null);
                  setKnowledgeFormData({
                    title: '',
                    content: '',
                    category: 'general',
                    tags: '',
                    is_published: true
                  });
                }}
              />
              
              {/* Modal Content */}
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                className="relative w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
              >
                {/* Close Button */}
                <button
                  onClick={() => {
                    setShowAddKnowledge(false);
                    setEditingKnowledge(null);
                    setKnowledgeFormData({
                      title: '',
                      content: '',
                      category: 'general',
                      tags: '',
                      is_published: true
                    });
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
                
                <div>
                  <div className="flex items-center justify-between pb-4 sm:pb-6">
                    <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                      {editingKnowledge ? 'Edit Artikel' : 'Tambah Artikel Knowledge Base'}
                    </h2>
                  </div>
                  
                  <form onSubmit={handleKnowledgeSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Judul Artikel *
                      </label>
                      <input
                        type="text"
                        name="title"
                        value={knowledgeFormData.title}
                        onChange={handleKnowledgeInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                        placeholder="Masukkan judul artikel"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Kategori *
                      </label>
                      <select
                        name="category"
                        value={knowledgeFormData.category}
                        onChange={handleKnowledgeInputChange}
                        required
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                      >
                        <option value="general">Umum</option>
                        <option value="technical">Teknis</option>
                        <option value="faq">FAQ</option>
                        <option value="troubleshooting">Troubleshooting</option>
                        <option value="guide">Panduan</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Konten Artikel *
                      </label>
                      <textarea
                        name="content"
                        value={knowledgeFormData.content}
                        onChange={handleKnowledgeInputChange}
                        required
                        rows={8}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 transition-colors duration-200 resize-none"
                        placeholder="Tulis konten artikel di sini..."
                      />
                    </div>

                    {/* Image Upload Section */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Upload Gambar (Opsional) {knowledgeImages.length > 0 && `(${knowledgeImages.length}/5 dipilih)`}
                      </label>
                      <div className="space-y-4">
                        {/* File Input */}
                        <div className="flex items-center gap-4">
                          <input
                            type="file"
                            id="knowledge-image-upload"
                            multiple
                            accept="image/*"
                            onChange={handleKnowledgeImageSelect}
                            className="hidden"
                          />
                          <label
                            htmlFor="knowledge-image-upload"
                            className="flex items-center gap-2 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors cursor-pointer"
                          >
                            <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                            {knowledgeImages.length > 0 ? `Pilih Gambar (${knowledgeImages.length}/5)` : 'Pilih Gambar'}
                          </label>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Maksimal 5 gambar, format: JPG, PNG, GIF
                          </span>
                        </div>

                        {/* Image Previews */}
                        {knowledgeImagePreviews.length > 0 && (
                          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                            {knowledgeImagePreviews.map((preview, index) => (
                              <div key={index} className="relative group">
                                <img
                                  src={preview}
                                  alt={`Preview ${index + 1}`}
                                  className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-600 cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() => openImagePreview(preview)}
                                />
                                <button
                                  type="button"
                                  onClick={() => removeKnowledgeImage(index)}
                                  className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center text-xs hover:bg-red-600 transition-colors"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Tags (pisahkan dengan koma)
                      </label>
                      <input
                        type="text"
                        name="tags"
                        value={knowledgeFormData.tags}
                        onChange={handleKnowledgeInputChange}
                        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 transition-colors duration-200"
                        placeholder="Contoh: login, password, reset, error"
                      />
                    </div>

                    <div className="space-y-3">
                      <div className="flex items-center">
                        <button
                          type="button"
                          aria-checked={knowledgeFormData.is_published}
                          role="checkbox"
                          onClick={() => {
                            setKnowledgeFormData(prev => ({
                              ...prev,
                              is_published: !prev.is_published
                            }));
                          }}
                          className={`inline-flex items-center justify-center w-5 h-5 rounded-md border-2 transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-blue-500 ${
                            knowledgeFormData.is_published
                              ? "bg-blue-500 border-blue-500"
                              : "bg-white border-gray-300 dark:bg-gray-700 dark:border-gray-600"
                          } cursor-pointer`}
                        >
                          {knowledgeFormData.is_published && (
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={3}
                              viewBox="0 0 24 24"
                            >
                              <polyline points="20 7 11 17 4 10" />
                            </svg>
                          )}
                        </button>
                        <label className="ml-3 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                          Publikasikan artikel
                        </label>
                      </div>
                      
                      {/* Guide Message */}
                      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                        <div className="flex items-start">
                          <div className="flex-shrink-0">
                            <svg className="w-5 h-5 text-blue-500 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                            </svg>
                          </div>
                          <div className="ml-3">
                            <h3 className="text-sm font-medium text-blue-800 dark:text-blue-200">
                              {knowledgeFormData.is_published ? "Artikel akan dipublikasikan" : "Artikel akan disimpan sebagai draft"}
                            </h3>
                            <div className="mt-1 text-sm text-blue-700 dark:text-blue-300">
                              {knowledgeFormData.is_published ? (
                                <>
                                  <strong>Dipublikasikan:</strong> Artikel akan langsung terlihat oleh semua user di Knowledge Base dan bisa dicari oleh mahasiswa, dosen, dll.
                                </>
                              ) : (
                                <>
                                  <strong>Draft:</strong> Artikel tersimpan sebagai draft dan hanya terlihat oleh Super Admin. User tidak akan bisa melihat artikel ini sampai dipublikasikan.
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex space-x-3 pt-4">
                      <button
                        type="button"
                        onClick={() => {
                          setShowAddKnowledge(false);
                          setEditingKnowledge(null);
                          setKnowledgeFormData({
                            title: '',
                            content: '',
                            category: 'general',
                            tags: '',
                            is_published: true
                          });
                        }}
                        className="flex-1 px-4 py-3 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-xl transition-colors duration-200 font-medium"
                      >
                        Batal
                      </button>
                      <button
                        type="submit"
                        disabled={submitting}
                        className="flex-1 px-4 py-3 text-white bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 rounded-xl transition-colors duration-200 font-medium flex items-center justify-center gap-2"
                      >
                        {submitting ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Menyimpan...
                          </>
                        ) : (
                          <>
                            <FontAwesomeIcon icon={faSave} className="w-4 h-4" />
                            {editingKnowledge ? 'Update Artikel' : 'Simpan Artikel'}
                          </>
                        )}
                      </button>
                    </div>
                  </form>
                </div>
              </motion.div>
            </div>
          )}
      </AnimatePresence>

      {/* Image Preview Modal */}
      <AnimatePresence mode="wait">
        {showImagePreview && (
          <div key="image-preview-modal" className="fixed inset-0 z-[100001] flex items-center justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100001] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={closeImagePreview}
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative z-[100002] max-w-5xl max-h-[90vh] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={closeImagePreview}
                className="absolute top-4 right-4 z-10 w-8 h-8 bg-gray-500/50 text-white rounded-full flex items-center justify-center hover:bg-gray-500/70 transition-all"
              >
                <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
              </button>
              
              {/* Image */}
              <img
                src={previewImageUrl}
                alt="Preview"
                className="w-full h-full object-contain max-h-[90vh]"
              />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Knowledge Article Modal */}
      <AnimatePresence mode="wait">
        {showDeleteKnowledge && (
          <div key="delete-knowledge-modal" className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={closeDeleteKnowledgeModal}
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={closeDeleteKnowledgeModal}
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
                {/* Warning Icon */}
                <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 mb-6">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="h-8 w-8 text-red-600 dark:text-red-400" />
                </div>

                {/* Title */}
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Hapus Artikel Knowledge Base
                </h3>

                {/* Description */}
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Apakah Anda yakin ingin menghapus artikel <strong>"{deletingKnowledge?.title}"</strong>? 
                  Tindakan ini tidak dapat dibatalkan dan akan menghapus semua data artikel termasuk gambar yang terkait.
                </p>

                {/* Article Info */}
                {deletingKnowledge && (
                  <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-6 text-left">
                    <div className="flex items-center space-x-2 mb-2">
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                        {deletingKnowledge.category}
                      </span>
                      {deletingKnowledge.is_published ? (
                        <span className="px-2 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-xs rounded-full">
                          Published
                        </span>
                      ) : (
                        <span className="px-2 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-xs rounded-full">
                          Draft
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      Dibuat: {new Date(deletingKnowledge.created_at).toLocaleDateString('id-ID')}
                    </p>
                    {deletingKnowledge.images && deletingKnowledge.images.length > 0 && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {deletingKnowledge.images.length} gambar akan dihapus
                      </p>
                    )}
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex space-x-3">
                  <button
                    onClick={closeDeleteKnowledgeModal}
                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmDeleteKnowledge}
                    disabled={submitting}
                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-red-400 rounded-lg transition-colors flex items-center justify-center space-x-2"
                  >
                    {submitting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Menghapus...</span>
                      </>
                    ) : (
                      <>
                        <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                        <span>Hapus Artikel</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Knowledge Base Detail Modal */}
      <AnimatePresence mode="wait">
        {showKnowledgeDetail && selectedKnowledge && (
          <div key={`knowledge-detail-modal-${selectedKnowledge.id}`} className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={closeKnowledgeDetailModal}
            />
            
            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-4xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={closeKnowledgeDetailModal}
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

              <div className="space-y-6">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                      <FontAwesomeIcon icon={faBook} className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                        {selectedKnowledge.title}
                      </h2>
                      <div className="flex items-center space-x-3 mt-2">
                        <span className="px-3 py-1 bg-blue-100 dark:bg-blue-900/20 text-blue-800 dark:text-blue-200 text-xs rounded-full">
                          {selectedKnowledge.category}
                        </span>
                        {selectedKnowledge.is_published ? (
                          <span className="px-3 py-1 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 text-xs rounded-full">
                            Published
                          </span>
                        ) : (
                          <span className="px-3 py-1 bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 text-xs rounded-full">
                            Draft
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Content */}
                <div className="bg-gray-50 dark:bg-gray-800/50 rounded-xl p-6">
                  <div className="prose dark:prose-invert max-w-none">
                    <div className="whitespace-pre-wrap text-gray-700 dark:text-gray-300 leading-relaxed text-sm">
                      {selectedKnowledge.content}
                    </div>
                  </div>
                </div>

                {/* Tags */}
                {selectedKnowledge.tags && selectedKnowledge.tags.length > 0 && (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">Tags</h3>
                    <div className="flex flex-wrap gap-2">
                      {selectedKnowledge.tags.map((tag, index) => (
                        <span key={index} className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Images */}
                {selectedKnowledge.images && selectedKnowledge.images.length > 0 ? (
                  <div>
                    <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
                      Gambar ({selectedKnowledge.images.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {selectedKnowledge.images.map((image, index) => {
                        const imageUrl = `${import.meta.env.VITE_API_URL}/${image}`;
                        return (
                          <div key={index} className="relative group">
                            <img
                              src={imageUrl}
                              alt={`Gambar ${index + 1}`}
                              className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600 transition-opacity"
                            />
                            <button
                              onClick={() => openImagePreview(imageUrl)}
                              className="absolute inset-0 bg-black bg-opacity-50 text-white rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity text-sm font-medium"
                            >
                              Lihat Gambar
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <FontAwesomeIcon icon={faImage} className="w-12 h-12 mx-auto mb-4 opacity-50" />
                    <p>Tidak ada gambar untuk artikel ini</p>
                  </div>
                )}

                {/* Metadata */}
                <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                  <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                    <span>Dibuat: {new Date(selectedKnowledge.created_at).toLocaleDateString('id-ID', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}</span>
                    {selectedKnowledge.updated_at !== selectedKnowledge.created_at && (
                      <span>Diperbarui: {new Date(selectedKnowledge.updated_at).toLocaleDateString('id-ID', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}</span>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
};

export default SupportCenter;
