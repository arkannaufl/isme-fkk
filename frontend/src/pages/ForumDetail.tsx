import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faEye,
  faEyeSlash,
  faReply,
  faClock,
  faUser,
  faHeart,
  faBookmark,
  faPaperPlane,
  faComments,
  faSearch,
  faPlus,
  faImage,
  faFile,
  faTimes,
  faEdit,
  faTrash,
} from "@fortawesome/free-solid-svg-icons";
import api, { handleApiError } from "../utils/api";
import { useNavigate, useParams } from "react-router-dom";
import QuillViewer from "../components/QuillViewer";
import QuillEditor from "../components/QuillEditor";
import { forumApi } from "../api/generateApi";

interface Forum {
  id: number;
  title: string;
  content: string;
  slug: string;
  status: "active" | "closed" | "pinned" | "archived";
  views_count: number;
  replies_count: number;
  likes_count: number;
  last_activity_at: string;
  created_at: string;
  edited_at?: string;
  is_edited?: boolean;
  is_new?: boolean;
  deadline?: string;
  access_type?: "public" | "private";
  allowed_users?: number[];
  attachments?: Array<{
    id: number;
    filename: string;
    original_name: string;
    file_path: string;
    file_type: string;
    file_size: number;
  }>;
  user: {
    id: number;
    name: string;
    role: string;
  };
  category: {
    id: number;
    name: string;
    slug: string;
    color: string;
  };
}

interface ForumReply {
  id: number;
  content: string;
  created_at: string;
  edited_at?: string;
  likes_count: number;
  is_edited: boolean;
  nested_level: number;
  is_liked?: boolean;
  is_bookmarked?: boolean;
  parent_id?: number;
  parent?: {
    id: number;
    user: {
      id: number;
      name: string;
      role: string;
    };
    content: string;
  };
  user: {
    id: number;
    name: string;
    role: string;
  };
  editor?: {
    id: number;
    name: string;
  };
  children: ForumReply[];
  attachments?: Array<{
    id: number;
    filename: string;
    original_name: string;
    file_path: string;
    file_type: string;
    file_size: number;
  }>;
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

// Recursive Reply Component untuk Unlimited Nesting
interface RecursiveReplyProps {
  reply: ForumReply;
  level: number;
  onLike: (replyId: number) => void;
  likedReplies: Set<number>;
  onReply: (replyId: number) => void;
  replyingTo: number | null;
  onCancelReply: () => void;
  onSubmitReply: (e: React.FormEvent) => void;
  uploadedFiles: File[];
  setUploadedFiles: React.Dispatch<React.SetStateAction<File[]>>;
  replyContent: string;
  setReplyContent: React.Dispatch<React.SetStateAction<string>>;
  submittingReply: boolean;
  showUploadDropdown: boolean;
  setShowUploadDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  handleImageUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFileUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  removeUploadedFile: (index: number) => void;
  formatFileSize: (bytes: number) => string;
  // Edit & Delete props
  onEdit: (reply: ForumReply) => void;
  onDelete: (reply: ForumReply) => void;
  canEdit: (reply: ForumReply) => boolean;
  canDelete: (reply: ForumReply) => boolean;
  // Bookmark props
  handleReplyBookmark: (replyId: number) => void;
  // Time formatting
  currentTime: Date;
}

const RecursiveReplyComponent: React.FC<RecursiveReplyProps> = ({
  reply,
  level,
  onLike,
  likedReplies,
  onReply,
  replyingTo,
  onCancelReply,
  onSubmitReply,
  uploadedFiles,
  setUploadedFiles,
  replyContent,
  setReplyContent,
  submittingReply,
  showUploadDropdown,
  setShowUploadDropdown,
  handleImageUpload,
  handleFileUpload,
  removeUploadedFile,
  formatFileSize,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
  handleReplyBookmark,
  currentTime,
}) => {
  // Format time ago function - menggunakan currentTime dari parent
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

  // No margin left for all levels - all comments aligned
  const marginLeft = 0;

  return (
    <div style={{ marginLeft: `${marginLeft}px` }}>
      {/* Reply Content */}
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center space-x-2">
          <div
            className={`${
              level === 1 ? "w-8 h-8" : "w-6 h-6"
            } bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm`}
          >
            {reply.user.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <div className="font-medium text-gray-900 dark:text-white text-sm">
              {reply.user.name}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              {reply.is_edited && reply.edited_at
                ? formatTimeAgo(reply.edited_at)
                : formatTimeAgo(reply.created_at)}
              {reply.is_edited && (
                <span className="text-gray-400 dark:text-gray-500 text-xs ml-1">• diedit</span>
              )}
            </div>
            {/* Reply Context - Tampilkan "Balasan untuk komentar [nama user]" */}
            {reply.parent && (
              <div className="flex items-center mt-1 text-blue-600 dark:text-blue-400 text-xs">
                <FontAwesomeIcon icon={faReply} className="mr-1 w-3 h-3" />
                Balasan untuk komentar {reply.parent.user.name}
              </div>
            )}
          </div>
        </div>

        {/* Edit & Bookmark Buttons di Kanan Atas */}
        <div className="flex items-center space-x-1">
          {canEdit && canEdit(reply) && (
            <button
              onClick={() => onEdit && onEdit(reply)}
              className="p-1 text-gray-400 dark:text-gray-500 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded transition-colors"
              title="Edit komentar"
            >
              <FontAwesomeIcon icon={faEdit} className="w-3 h-3" />
            </button>
          )}

          {/* Icon Bookmark di Pojok Kanan Atas */}
          <button
            onClick={() => handleReplyBookmark(reply.id)}
            className={`p-1 rounded transition-colors ${
              reply.is_bookmarked
                ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
                : "text-gray-400 dark:text-gray-500 hover:text-yellow-500 hover:bg-yellow-50 dark:hover:bg-yellow-900/20"
            }`}
            title={reply.is_bookmarked ? "Hapus bookmark" : "Bookmark komentar"}
          >
            <FontAwesomeIcon
              icon={faBookmark}
              className={`w-3 h-3 ${reply.is_bookmarked ? "fill-current" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* Reply Content */}
      <div className="prose max-w-none mb-3 text-sm">
        <QuillViewer content={reply.content} />

        {/* Display attachments */}
        {reply.attachments && reply.attachments.length > 0 && (
          <div className="mt-2">
            <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Attachments ({reply.attachments.length}):
            </div>
            <div className="flex flex-wrap gap-2">
              {reply.attachments.map((attachment, index) => (
                <div
                  key={`recursive-reply-${reply.id}-attachment-${index}-${
                    attachment.original_name || "unknown"
                  }`}
                  className="inline-block p-1 bg-white dark:bg-gray-600 rounded border dark:border-gray-500"
                >
                  {attachment.file_type &&
                  attachment.file_type.startsWith("image/") ? (
                    <img
                      src={attachment.file_path}
                      alt={attachment.original_name}
                      className="w-20 h-20 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                      onClick={() =>
                        window.open(attachment.file_path, "_blank")
                      }
                      title="Klik untuk lihat gambar penuh"
                    />
                  ) : (
                    <div className="text-center">
                      <FontAwesomeIcon
                        icon={faFile}
                        className="w-16 h-16 text-gray-500 mb-1"
                      />
                      <div className="text-xs text-gray-600 dark:text-gray-300 font-medium truncate max-w-20 mb-1">
                        {attachment.original_name}
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                        {attachment.file_size
                          ? formatFileSize(attachment.file_size)
                          : "Unknown size"}
                      </div>
                      <div className="flex justify-center">
                        <button
                          onClick={() =>
                            window.open(attachment.file_path, "_blank")
                          }
                          className="px-2 py-0.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                          title="Buka file di tab baru"
                        >
                          Buka File
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex items-center space-x-3">
        <button
          onClick={() => onLike(reply.id)}
          className={`flex items-center space-x-1 p-1 rounded-lg transition-colors ${
            likedReplies.has(reply.id)
              ? "text-red-500 bg-red-50 dark:bg-red-900/20"
              : "text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          }`}
          title={likedReplies.has(reply.id) ? "Unlike reply" : "Like reply"}
        >
          <FontAwesomeIcon icon={faHeart} className="w-3 h-3" />
          <span className="text-xs font-medium">{reply.likes_count || 0}</span>
        </button>

        <button
          onClick={() => onReply(reply.id)}
          className={`flex items-center space-x-1 p-1 rounded-lg transition-colors text-xs ${
            replyingTo === reply.id
              ? "text-blue-600 bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700"
              : "text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          }`}
          title={
            replyingTo === reply.id
              ? "Sedang reply ke komentar ini"
              : "Balas komentar ini"
          }
        >
          <FontAwesomeIcon icon={faReply} className="w-3 h-3" />
          <span className="text-xs font-medium">
            {replyingTo === reply.id ? "Sedang Reply..." : "Balas"}
          </span>
        </button>
      </div>

      {/* Icon Delete di Pojok Bawah */}
      {canDelete && canDelete(reply) && (
        <div className="flex justify-end mt-2">
          <button
            onClick={() => onDelete && onDelete(reply)}
            className="p-1 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
            title="Hapus komentar"
          >
            <FontAwesomeIcon icon={faTrash} className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Reply Form untuk Reply Ini */}
      {replyingTo === reply.id && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm"
        >
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-blue-800">
              Balas ke komentar {reply.user.name}
            </h4>
            <button
              onClick={onCancelReply}
              className="text-blue-600 hover:text-blue-800 transition-colors p-1 rounded-full hover:bg-blue-100"
            >
              <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={onSubmitReply}>
            <div className="mb-3">
              <div className="flex items-center space-x-3">
                {/* Upload Button */}
                <div className="upload-dropdown-container">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowUploadDropdown(!showUploadDropdown)}
                      className="flex items-center justify-center w-10 h-10 bg-white dark:bg-gray-700 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-600 hover:text-white transition-colors"
                      title="Upload file"
                    >
                      <FontAwesomeIcon icon={faPlus} className="w-4 h-4" />
                    </button>

                    {/* Upload Dropdown */}
                    {showUploadDropdown && (
                      <div className="absolute bottom-full left-0 mb-2 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-50">
                        <div className="py-1">
                          <button
                            type="button"
                            onClick={() => {
                              const imageInput =
                                document.getElementById("image-upload-reply");
                              if (imageInput) {
                                imageInput.click();
                              } else {
                                console.error(
                                  "🔍 DEBUG: Image input not found!"
                                );
                              }
                              setShowUploadDropdown(false);
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <FontAwesomeIcon
                              icon={faFile}
                              className="mr-3 w-4 h-4 text-green-600"
                            />
                            Images
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              const fileInput =
                                document.getElementById("file-upload-reply");
                              if (fileInput) {
                                fileInput.click();
                              } else {
                                console.error(
                                  "🔍 DEBUG: File input not found!"
                                );
                              }
                              setShowUploadDropdown(false);
                            }}
                            className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                          >
                            <FontAwesomeIcon
                              icon={faFile}
                              className="mr-3 w-4 h-4 text-blue-600"
                            />
                            Files
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Textarea */}
                <div className="flex-1">
                  <textarea
                    value={replyContent}
                    onChange={(e) => setReplyContent(e.target.value)}
                    rows={2}
                                          className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                    placeholder="Tulis balasan Anda..."
                    required
                  />
                </div>
              </div>
            </div>

            {/* Hidden file inputs */}
            <input
              id="image-upload-reply"
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageUpload}
              className="hidden"
            />
            <input
              id="file-upload-reply"
              type="file"
              multiple
              onChange={handleFileUpload}
              className="hidden"
            />

            {/* Uploaded files preview */}
            {uploadedFiles.length > 0 && (
              <div className="mb-3">
                <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">
                  File ({uploadedFiles.length}):
                </div>
                <div className="flex flex-wrap gap-2">
                  {uploadedFiles.map((file, index) => (
                    <div
                      key={index}
                      className="inline-block p-2 bg-white dark:bg-gray-600 rounded border dark:border-gray-500 relative"
                    >
                      {file.type.startsWith("image/") ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={file.name}
                          className="w-24 h-24 object-cover rounded border"
                        />
                      ) : (
                        <div className="text-center">
                          <FontAwesomeIcon
                            icon={faFile}
                            className="w-16 h-16 text-gray-500 mb-2"
                          />
                          <div className="text-xs text-gray-600 dark:text-gray-300 font-medium truncate max-w-20">
                            {file.name}
                          </div>
                          <div className="text-xs text-gray-500 dark:text-gray-400">
                            {formatFileSize(file.size)}
                          </div>
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeUploadedFile(index)}
                        className="absolute -top-2 -right-2 text-red-500 hover:text-red-700 bg-white rounded-full p-1 hover:bg-red-50 border shadow-sm"
                      >
                        <FontAwesomeIcon icon={faTimes} className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3">
              <button
                type="button"
                onClick={onCancelReply}
                                        className="px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/20 text-sm"
              >
                Selesai
              </button>
              <button
                type="submit"
                disabled={submittingReply || !replyContent.trim()}
                className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
              >
                {submittingReply ? (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                ) : (
                  <FontAwesomeIcon
                    icon={faPaperPlane}
                    className="mr-2 w-3 h-3"
                  />
                )}
                {submittingReply ? "Mengirim..." : "Kirim Balasan"}
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Recursive Children - Unlimited Nesting */}
      {reply.children && reply.children.length > 0 && (
        <div className="mt-4 space-y-3">
          {reply.children.map((childReply) => (
            <RecursiveReplyComponent
              key={childReply.id}
              reply={childReply}
              level={level + 1}
              onLike={onLike}
              likedReplies={likedReplies}
              onReply={onReply}
              replyingTo={replyingTo}
              onCancelReply={onCancelReply}
              onSubmitReply={onSubmitReply}
              uploadedFiles={uploadedFiles}
              setUploadedFiles={setUploadedFiles}
              replyContent={replyContent}
              setReplyContent={setReplyContent}
              submittingReply={submittingReply}
              showUploadDropdown={showUploadDropdown}
              setShowUploadDropdown={setShowUploadDropdown}
              handleImageUpload={handleImageUpload}
              handleFileUpload={handleFileUpload}
              removeUploadedFile={removeUploadedFile}
              formatFileSize={formatFileSize}
              onEdit={onEdit}
              onDelete={onDelete}
              canEdit={canEdit}
              canDelete={canDelete}
              handleReplyBookmark={handleReplyBookmark}
              currentTime={currentTime}
            />
          ))}
        </div>
      )}
    </div>
  );
};

const ForumDetail: React.FC = () => {
  const navigate = useNavigate();
  const { slug } = useParams<{ slug: string }>();
  const [loading, setLoading] = useState(true);
  const [forum, setForum] = useState<Forum | null>(null);
  const [replies, setReplies] = useState<ForumReply[]>([]);
  const [user, setUser] = useState<User | null>(null);
  // State untuk bookmark tracking (seperti ForumCategory.tsx)
  const [forumBookmarks, setForumBookmarks] = useState<{
    [key: number]: boolean;
  }>({});
  const [searchQuery, setSearchQuery] = useState("");

  // UI helpers for checklist styling (match DetailBlokAntara aesthetics)
  const getEditRoleBadgeClasses = (role: string): string => {
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
  const getEditAvatarClasses = (role: string): string => {
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

  // Reply form states
  const [replyContent, setReplyContent] = useState("");
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [submittingReply, setSubmittingReply] = useState(false);

  // Upload states
  const [showUploadDropdown, setShowUploadDropdown] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<File[]>([]);

  // State untuk hide/show balasan per komentar
  const [hiddenReplies, setHiddenReplies] = useState<Set<number>>(new Set());

  // State untuk like
  const [likesCount, setLikesCount] = useState(0);
  const [isForumLiked, setIsForumLiked] = useState(false);
  const [likedReplies, setLikedReplies] = useState<Set<number>>(new Set());

  // State untuk edit mode
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null);
  const [editContent, setEditContent] = useState<string>("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [replyToDelete, setReplyToDelete] = useState<ForumReply | null>(null);
  const [replyToDeleteInfo, setReplyToDeleteInfo] = useState<{
    reply: ForumReply;
    totalReplies: number;
  } | null>(null);
  const [isDeletingForum, setIsDeletingForum] = useState(false);
  const [isDeletingReply, setIsDeletingReply] = useState(false);

  // State untuk auto-hide edit buttons untuk role Super Admin, Tim Akademik, Dosen setelah 2 menit
  const [hiddenEditButtons, setHiddenEditButtons] = useState<Set<number>>(
    new Set()
  );

  // State untuk modal delete forum utama
  const [showDeleteForumModal, setShowDeleteForumModal] = useState(false);

  // State untuk modal edit forum utama
  const [showEditForumModal, setShowEditForumModal] = useState(false);
  const [editForumTitle, setEditForumTitle] = useState("");
  const [editForumContent, setEditForumContent] = useState("");
  const [editForumAccessType, setEditForumAccessType] = useState<
    "public" | "private"
  >("public");
  const [editForumSelectedUsers, setEditForumSelectedUsers] = useState<
    number[]
  >([]);

  // State untuk access control di edit modal
  const [editSearchableUsers, setEditSearchableUsers] = useState<
    SearchableUser[]
  >([]);
  const [editSearchingUsers, setEditSearchingUsers] = useState(false);
  const [editUserSearchQuery, setEditUserSearchQuery] = useState("");
  const [editSelectAllDosen, setEditSelectAllDosen] = useState(false);
  const [isEditingForum, setIsEditingForum] = useState(false);

  // State untuk modal popup gambar forum
  const [showImageModal, setShowImageModal] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  // State untuk mode preview gambar forum
  const [showImagePreview, setShowImagePreview] = useState(false);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // State untuk real-time update waktu
  const [currentTime, setCurrentTime] = useState(new Date());

  // Toast notification state
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState("");
  const [toastType, setToastType] = useState<"success" | "warning" | "error">(
    "success"
  );

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

  useEffect(() => {
    if (slug) {
      fetchForumData();
    }
  }, [slug]);

  // Real-time update waktu setiap menit
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date());
    }, 60000); // Update setiap 1 menit (60000ms)

    return () => clearInterval(interval);
  }, []);

  // Close upload dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Element;
      if (!target.closest(".upload-dropdown-container")) {
        setShowUploadDropdown(false);
      }
    };

    if (showUploadDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showUploadDropdown]);

  // Auto-hide edit buttons untuk role Super Admin, Tim Akademik, Dosen setelah 2 menit
  useEffect(() => {
    if (!user || !["super_admin", "tim_akademik", "dosen"].includes(user.role))
      return;

    const checkAndHideButtons = () => {
      const now = new Date();
      const newHiddenButtons = new Set<number>();

      // Check semua replies untuk timing
      const checkReplies = (replies: ForumReply[]) => {
        replies.forEach((reply) => {
          const replyTime = new Date(reply.created_at);
          const diffInMinutes =
            (now.getTime() - replyTime.getTime()) / (1000 * 60);

          // Jika sudah lebih dari 2 menit, hide EDIT buttons (bukan delete)
          if (diffInMinutes > 2) {
            newHiddenButtons.add(reply.id);
          }

          // Check children replies juga
          if (reply.children && reply.children.length > 0) {
            checkReplies(reply.children);
          }
        });
      };

      checkReplies(replies);
      setHiddenEditButtons(newHiddenButtons);
    };

    // Check setiap 30 detik
    const interval = setInterval(checkAndHideButtons, 30000);

    // Initial check
    checkAndHideButtons();

    return () => clearInterval(interval);
  }, [user, replies]);

  const fetchForumData = async () => {
    try {
      setLoading(true);


      const [forumResponse, userResponse] = await Promise.all([
        api.get(`/forum/${slug}`),
        api.get("/me"),
      ]);


      const forumData = forumResponse.data.data.forum;
      const repliesData = forumResponse.data.data.replies;

      // Load attachments for each reply
      if (Array.isArray(repliesData)) {
        repliesData.forEach((reply, index) => {

          if (reply.attachments) {
            reply.attachments = Array.isArray(reply.attachments)
              ? reply.attachments
              : [];
          }
        });
      }

      setForum(forumData);
      setReplies(Array.isArray(repliesData) ? repliesData : []);

      setUser(userResponse.data);

      // Set likes state
      setLikesCount(forumData.likes_count || 0);
      setIsForumLiked(Boolean(forumResponse.data.data.is_liked));

      // Set forum bookmark state - langsung dari backend data (seperti ForumCategory.tsx)

      const bookmarksMap: { [key: number]: boolean } = {};
      // Gunakan is_bookmarked dari response level, bukan dari forum object
      bookmarksMap[forumData.id] = Boolean(
        forumResponse.data.data.is_bookmarked
      );
      setForumBookmarks(bookmarksMap);

      // Set liked replies state - Check semua level secara recursive
      if (Array.isArray(repliesData)) {
        const likedRepliesSet = new Set<number>();

        // Helper function untuk check like status secara recursive
        const checkReplyLikes = (replies: ForumReply[]) => {
          replies.forEach((reply) => {
            if (reply.is_liked) {
              likedRepliesSet.add(reply.id);
            }
            // Recursively check children replies untuk unlimited levels
            if (reply.children && Array.isArray(reply.children)) {
              checkReplyLikes(reply.children);
            }
          });
        };

        checkReplyLikes(repliesData);
        setLikedReplies(likedRepliesSet);

      }

      // Fetch bookmark status for each reply if user is authenticated
      if (userResponse.data && Array.isArray(repliesData)) {
        await fetchBookmarkStatuses(repliesData);
      }
    } catch (error: any) {
      console.error("Error fetching forum data:", error);
      console.error("Error details:", handleApiError(error, "Memuat data forum"));
      
      // Handle specific error cases
      if (error?.response?.status === 404) {
        console.error("Forum not found, redirecting to forum list");
        navigate("/forum-diskusi");
      } else if (error?.code === 'ERR_NETWORK_CHANGED' || error?.message?.includes('Network Error')) {
        console.error("Network error, retrying in 2 seconds...");
        setTimeout(() => {
          fetchForumData();
        }, 2000);
      } else {
        navigate("/forum-diskusi");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchViewers = async (page: number = 1) => {
    if (!forum) return;
    
    try {
      setViewersLoading(true);
      const response = await forumApi.getViewers(forum.id);
      
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
      console.error("Error details:", handleApiError(error, "Memuat data viewer"));
      
      // Handle 403 Unauthorized error
      if (error.response?.status === 403) {
        showToastMessage("Hanya author forum yang dapat melihat daftar viewer", "warning");
        setShowViewersModal(false);
      } else {
        showToastMessage(handleApiError(error, "Memuat data viewer"), "error");
      }
    } finally {
      setViewersLoading(false);
    }
  };

  const handleViewersClick = () => {
    if (!forum || !user) return;
    
    // Hanya author yang bisa melihat daftar viewer
    if (forum.user.id !== user.id) {
      showToastMessage("Hanya author forum yang dapat melihat daftar viewer", "warning");
      return;
    }
    
    setShowViewersModal(true);
    fetchViewers(1);
  };

  const fetchBookmarkStatuses = async (repliesList: ForumReply[]) => {
    if (!user) return;

    if (!repliesList || !Array.isArray(repliesList)) {
      console.warn("fetchBookmarkStatuses: invalid repliesList:", repliesList);
      return;
    }

    try {
      const updateBookmarkStatuses = async (replies: ForumReply[]) => {
        if (!replies || !Array.isArray(replies)) {
          console.warn("updateBookmarkStatuses: invalid replies:", replies);
          return;
        }

        for (const reply of replies) {
          if (!reply || typeof reply !== "object" || !reply.id) {
            console.warn(
              "Skipping invalid reply in fetchBookmarkStatuses:",
              reply
            );
            continue;
          }

          try {
            const response = await api.get(
              `/forum/replies/${reply.id}/bookmark-status`
            );
            if (response.data.success) {
              reply.is_bookmarked = response.data.is_bookmarked;
            }
          } catch (error) {
            console.error(
              `Error fetching bookmark status for reply ${reply.id}:`,
              error
            );
          }

          if (
            reply.children &&
            Array.isArray(reply.children) &&
            reply.children.length > 0
          ) {
            await updateBookmarkStatuses(reply.children);
          }
        }
      };

      await updateBookmarkStatuses(repliesList);

      setReplies([...repliesList]);
    } catch (error) {
      console.error("Error fetching bookmark statuses:", error);
      console.error("Error details:", handleApiError(error, "Memuat status bookmark"));
    }
  };

  // Helper function untuk update likes di nested replies
  const updateChildrenLikes = (
    children: ForumReply[],
    targetId: number,
    newLikesCount: number
  ): ForumReply[] => {
    return children.map((child) => {
      if (child.id === targetId) {
        return { ...child, likes_count: newLikesCount };
      }

      // Recursively update deeper nested replies
      if (child.children && child.children.length > 0) {
        const updatedGrandChildren = updateChildrenLikes(
          child.children,
          targetId,
          newLikesCount
        );
        if (updatedGrandChildren !== child.children) {
          return { ...child, children: updatedGrandChildren };
        }
      }

      return child;
    });
  };

  const handleLikeForum = async () => {
    if (!user || !forum) {
      showToastMessage("Anda harus login untuk like forum", "warning");
      return;
    }

    try {
      const response = await api.post(`/forum/${forum.id}/like`);

      if (response.data.success) {
        const isLiked = response.data.data.is_liked;
        const newLikesCount = response.data.data.likes_count;

        // Update forum like state
        setIsForumLiked(isLiked);
        setLikesCount(newLikesCount);

        showToastMessage(response.data.message, "success");
      }
    } catch (error) {
      console.error("Error toggling forum like:", error);
      console.error("Error details:", handleApiError(error, "Like forum"));
      showToastMessage(handleApiError(error, "Like forum"), "error");
    }
  };

  const handleLikeReply = async (replyId: number) => {
    if (!user) {
      showToastMessage("Anda harus login untuk like reply", "warning");
      return;
    }

    try {
      const response = await api.post(`/forum/replies/${replyId}/like`);

      if (response.data.success) {
        const isLiked = response.data.data.is_liked;
        const newLikesCount = response.data.data.likes_count;

        // Update likedReplies state
        setLikedReplies((prev) => {
          const newSet = new Set(prev);
          if (isLiked) {
            newSet.add(replyId);
          } else {
            newSet.delete(replyId);
          }
          return newSet;
        });

        // Update replies state dengan likes_count yang baru (termasuk nested replies)
        setReplies((prev) =>
          prev.map((reply) => {
            // Update main reply
            if (reply.id === replyId) {
              return { ...reply, likes_count: newLikesCount };
            }

            // Update children replies recursively
            if (reply.children && reply.children.length > 0) {
              const updatedChildren = updateChildrenLikes(
                reply.children,
                replyId,
                newLikesCount
              );
              if (updatedChildren !== reply.children) {
                return { ...reply, children: updatedChildren };
              }
            }

            return reply;
          })
        );

        showToastMessage(response.data.message, "success");
      }
    } catch (error) {
      console.error("Error toggling like:", error);
      console.error("Error details:", handleApiError(error, "Like reply"));
      showToastMessage(handleApiError(error, "Like reply"), "error");
    }
  };

  const handleForumBookmark = async () => {
    if (!user || !forum) return;

    try {
      const response = await api.post(`/forum/${forum.id}/bookmark`);

      if (response.data.success) {
        // Update local state langsung dari response (seperti ForumCategory.tsx)
        const newBookmarkStatus = response.data.data.is_bookmarked;

        setForumBookmarks((prev) => ({
          ...prev,
          [forum.id]: newBookmarkStatus,
        }));

        showToastMessage(
          newBookmarkStatus
            ? "Forum berhasil di-bookmark!"
            : "Bookmark forum dihapus!",
          "success"
        );
      }
    } catch (error) {
      console.error("Error toggling bookmark:", error);
      console.error("Error details:", handleApiError(error, "Bookmark forum"));
      showToastMessage(handleApiError(error, "Bookmark forum"), "error");
    }
  };

  const handleReplyBookmark = async (replyId: number) => {
    try {
      const response = await api.post(`/forum/replies/${replyId}/bookmark`);

      if (response.data.success) {
        // Handle different response structures
        let newBookmarkStatus;
        if (response.data.data && typeof response.data.data === "object") {
          newBookmarkStatus = response.data.data.is_bookmarked;
        } else if (typeof response.data.data === "boolean") {
          newBookmarkStatus = response.data.data;
        } else {
          // Fallback: try to get from response.data directly
          newBookmarkStatus = response.data.is_bookmarked;
        }

        // Update reply bookmark status in state
        const updateReplyBookmark = (replies: ForumReply[]): ForumReply[] => {
          return replies.map((reply) => {
            if (reply.id === replyId) {
              return { ...reply, is_bookmarked: newBookmarkStatus };
            }
            if (reply.children && reply.children.length > 0) {
              return {
                ...reply,
                children: updateReplyBookmark(reply.children),
              };
            }
            return reply;
          });
        };

        setReplies(updateReplyBookmark);

        showToastMessage(
          newBookmarkStatus
            ? "Komentar berhasil di-bookmark!"
            : "Bookmark komentar dihapus!",
          "success"
        );
      }
    } catch (error) {
      console.error("Error toggling reply bookmark:", error);
      console.error("Error details:", handleApiError(error, "Bookmark komentar"));
      showToastMessage(handleApiError(error, "Bookmark komentar"), "error");
    }
  };

  const handleSubmitReply = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!replyContent.trim() || !forum) return;

    if (!user) {
      showToastMessage(
        "Anda harus login terlebih dahulu untuk membalas komentar",
        "warning"
      );
      return;
    }

    try {
      setSubmittingReply(true);

      // Create FormData for file uploads
      const formData = new FormData();
      formData.append("content", replyContent);
      if (replyingTo) {
        formData.append("parent_id", replyingTo.toString());
      }

      // Add uploaded files
      uploadedFiles.forEach((file, index) => {
        formData.append("attachments[]", file);
      });


      const response = await api.post(`/forum/${forum.id}/replies`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      if (response.data.success) {
        showToastMessage("Balasan berhasil dikirim!", "success");
        setReplyContent("");
        // Reset replyingTo agar button kembali ke "Balas" (bukan "Sedang Reply...")
        setReplyingTo(null);
        setUploadedFiles([]); // Reset uploaded files
        // Update currentTime untuk real-time update
        setCurrentTime(new Date());

        // Refresh forum data dengan delay untuk memastikan backend sudah selesai
        setTimeout(async () => {
          await fetchForumData();
        }, 500);
      } else {
        showToastMessage(
          response.data.message || "Gagal mengirim balasan",
          "error"
        );
      }
    } catch (error: any) {
      console.error("Error submitting reply:", error);
      console.error("Error details:", handleApiError(error, "Mengirim balasan"));

      if (error?.response?.status === 401) {
        showToastMessage(
          "Sesi Anda telah berakhir. Silakan login ulang.",
          "warning"
        );
        navigate("/login");
      } else if (error?.response?.status === 404) {
        showToastMessage(
          "Forum tidak ditemukan atau endpoint tidak tersedia",
          "error"
        );
      } else if (error?.response?.status === 422) {
        // Validation error
        const errorData = error.response.data as {
          errors?: Record<string, string[]>;
          message?: string;
        };
        if (errorData.errors) {
          const errorMessages = Object.values(errorData.errors).flat();
          showToastMessage(
            `Error validasi: ${errorMessages.join(", ")}`,
            "error"
          );
        } else {
          showToastMessage(errorData.message || "Error validasi", "error");
        }
      } else if (error?.code === 'ERR_NETWORK_CHANGED' || error?.message?.includes('Network Error')) {
        showToastMessage(
          "Koneksi bermasalah. Silakan coba lagi.",
          "error"
        );
      } else {
        showToastMessage(
          "Gagal mengirim balasan. Silakan coba lagi.",
          "error"
        );
      }
    } finally {
      setSubmittingReply(false);
    }
  };

  const startReply = (parentId?: number) => {

    // Jika sudah reply ke komentar yang sama, cancel
    if (replyingTo === parentId) {
      cancelReply();
      return;
    }

    // Set reply state
    setReplyingTo(parentId || null);
    setReplyContent("");
    setUploadedFiles([]);
    setShowUploadDropdown(false); // Close upload dropdown if open

    // Scroll ke form reply jika ada
    setTimeout(() => {
      if (parentId) {
        const replyElement = document.getElementById(`reply-${parentId}`);
        if (replyElement) {
          replyElement.scrollIntoView({ behavior: "smooth", block: "nearest" });
        }
      }
    }, 100);
  };

  const cancelReply = () => {
    setReplyingTo(null);
    setReplyContent("");
    setUploadedFiles([]);
    setShowUploadDropdown(false); // Close upload dropdown if open
  };

  // Function untuk format file size
  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // Function untuk menghitung total semua reply (termasuk nested)
  const countTotalReplies = (replies: ForumReply[]): number => {
    let total = 0;
    replies.forEach((reply) => {
      total += 1; // Hitung reply ini
      if (reply.children && reply.children.length > 0) {
        total += countTotalReplies(reply.children); // Hitung children juga
      }
    });
    return total;
  };

  // Function untuk close modal gambar
  const closeImageModal = () => {
    setShowImageModal(false);
    setSelectedImage(null);
  };

  // Function untuk handle preview gambar forum
  const handleImagePreview = (imageSrc: string) => {
    setPreviewImage(imageSrc);
    setShowImagePreview(true);
  };

  // Function untuk close preview gambar
  const closeImagePreview = () => {
    setShowImagePreview(false);
    setPreviewImage(null);
  };

  // Function untuk handle delete forum utama
  const handleDeleteForum = async () => {
    if (!forum) return;

    try {
      setIsDeletingForum(true);
      const response = await api.delete(`/forum/${forum.id}`);

      const ok = (response && response.status === 204) ||
        (response && response.status >= 200 && response.status < 300 && (response.data?.success === true || typeof response.data !== 'undefined'));

      if (ok) {
        showToastMessage("Forum berhasil dihapus!", "success");
        navigate("/forum-diskusi"); // Kembali ke daftar forum diskusi
      } else {
        showToastMessage("Gagal menghapus forum", "error");
      }
    } catch (error) {
      console.error("Error deleting forum:", error);
      console.error("Error details:", handleApiError(error, "Menghapus forum"));
      showToastMessage(handleApiError(error, "Menghapus forum"), "error");
    } finally {
      setShowDeleteForumModal(false);
      setIsDeletingForum(false);
    }
  };

  // Function untuk handle edit forum utama
  const handleEditForum = async () => {
    if (!forum) return;

    try {
      setIsEditingForum(true);
      const response = await api.put(`/forum/${forum.id}`, {
        title: editForumTitle,
        content: editForumContent,
        access_type: editForumAccessType,
        selected_users:
          editForumAccessType === "private" ? editForumSelectedUsers : [],
      });

      if (response.data.success) {
        showToastMessage("Forum berhasil diedit!", "success");
        setShowEditForumModal(false);
        setEditForumTitle("");
        setEditForumContent("");
        setEditForumAccessType("public");
        setEditForumSelectedUsers([]);
        // Update currentTime untuk real-time update
        setCurrentTime(new Date());
        // Refresh forum data
        await fetchForumData();
      } else {
        showToastMessage("Gagal mengedit forum", "error");
      }
    } catch (error) {
      console.error("Error editing forum:", error);
      console.error("Error details:", handleApiError(error, "Mengedit forum"));
      showToastMessage(handleApiError(error, "Mengedit forum"), "error");
    } finally {
      setIsEditingForum(false);
    }
  };

  // Function untuk open edit forum modal
  const openEditForumModal = () => {
    if (!forum) return;

    setEditForumTitle(forum.title);
    setEditForumContent(forum.content);
    setEditForumAccessType(forum.access_type || "public");
    setEditForumSelectedUsers(forum.allowed_users || []);
    setShowEditForumModal(true);

    // Load users jika private
    if (forum.access_type === "private") {
      loadEditAllUsers();
    }
  };

  // Fungsi untuk search users di edit modal
  const searchEditUsers = async (query: string) => {
    if (!query.trim()) {
      setEditSearchableUsers([]);
      return;
    }

    try {
      setEditSearchingUsers(true);
      const response = await api.get(
        `/users/search?q=${encodeURIComponent(query)}`
      );

      let users = [];
      if (response.data?.data && Array.isArray(response.data.data)) {
        users = response.data.data;
      } else if (Array.isArray(response.data)) {
        users = response.data;
      } else {
        users = [];
      }

      // Filter out current user (author) dari search results
      const filteredUsers = users.filter(
        (userItem: User) => userItem.id !== (user?.id || 0)
      );

      setEditSearchableUsers(filteredUsers || []);
    } catch (error) {
      console.error("Error searching users:", error);
      console.error("Error details:", handleApiError(error, "Mencari user"));
      setEditSearchableUsers([]);
    } finally {
      setEditSearchingUsers(false);
    }
  };

  // Fungsi untuk load semua users di edit modal
  const loadEditAllUsers = async () => {
    try {
      setEditSearchingUsers(true);
      const response = await api.get("/users");

      // Handle different response structures (pagination atau langsung array)
      let users = [];
      if (Array.isArray(response.data)) {
        users = response.data;
      } else if (response.data?.data && Array.isArray(response.data.data)) {
        users = response.data.data;
      } else if (response.data?.data?.data && Array.isArray(response.data.data.data)) {
        users = response.data.data.data;
      } else {
        console.warn("⚠️ WARNING: Unexpected response structure:", response.data);
        users = [];
      }

      // Filter out current user (author) dari all users
      const filteredUsers = users.filter(
        (userItem: User) => userItem.id !== (user?.id || 0)
      );

      setEditSearchableUsers(filteredUsers);
    } catch (error) {
      console.error("Error loading all users:", error);
      console.error("Error details:", handleApiError(error, "Memuat semua user"));
      setEditSearchableUsers([]);
    } finally {
      setEditSearchingUsers(false);
    }
  };

  // Fungsi untuk handle user search di edit modal
  const handleEditUserSearch = (query: string) => {
    setEditUserSearchQuery(query);
    if (query.trim()) {
      searchEditUsers(query);
    } else {
      loadEditAllUsers();
    }
  };

  // Debounced search untuk edit modal
  const debouncedEditSearch = React.useCallback(
    React.useMemo(() => {
      let timeoutId: NodeJS.Timeout;
      return (query: string) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
          if (query.trim()) {
            searchEditUsers(query);
          } else {
            loadEditAllUsers();
          }
        }, 300);
      };
    }, []),
    []
  );

  // Handle search input change dengan debounce di edit modal
  const handleEditSearchInputChange = (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const query = e.target.value;
    setEditUserSearchQuery(query);
    debouncedEditSearch(query);
  };

  // Fungsi untuk select/deselect user di edit modal
  const toggleEditUserSelection = (userId: number) => {
    setEditForumSelectedUsers((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId]
    );
  };

  // Fungsi untuk select all dosen di edit modal
  const handleEditSelectAllDosen = () => {
    if (editSelectAllDosen) {
      // Deselect all dosen
      setEditForumSelectedUsers((prev) =>
        prev.filter((userId) => {
          const user = editSearchableUsers.find((u) => u.id === userId);
          return user && (user.role || "").toLowerCase() !== "dosen";
        })
      );
      setEditSelectAllDosen(false);
    } else {
      // Select all dosen
      const dosenIds = editSearchableUsers
        .filter((user) => (user.role || "").toLowerCase() === "dosen")
        .map((user) => user.id);

      setEditForumSelectedUsers((prev) => [...new Set([...prev, ...dosenIds])]);
      setEditSelectAllDosen(true);
    }
  };

  // Fungsi untuk handle access type change di edit modal
  const handleEditAccessTypeChange = (accessType: "public" | "private") => {
    setEditForumAccessType(accessType);
    setEditForumSelectedUsers([]);
    setEditUserSearchQuery("");

    if (accessType === "private") {
      loadEditAllUsers();
    } else {
      setEditSearchableUsers([]);
    }
  };

  // Upload functions
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    setUploadedFiles((prev) => [...prev, ...imageFiles]);
    e.target.value = ""; // Reset input
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setUploadedFiles((prev) => [...prev, ...files]);
    e.target.value = ""; // Reset input
  };

  const removeUploadedFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index));
  };

  // Function untuk edit reply
  const startEditReply = (reply: ForumReply) => {
    setEditingReplyId(reply.id);
    setEditContent(reply.content);
  };

  const cancelEditReply = () => {
    setEditingReplyId(null);
    setEditContent("");
  };

  const handleEditReply = async (replyId: number) => {
    try {
      const response = await api.put(`/forum/replies/${replyId}`, {
        content: editContent,
      });

      if (response.data.success) {
        // Update reply content in state
        const updateReplyContent = (replies: ForumReply[]): ForumReply[] => {
          return replies.map((reply) => {
            if (reply.id === replyId) {
              return {
                ...reply,
                content: editContent,
                is_edited: true,
                edited_at: new Date().toISOString(),
              };
            }
            if (reply.children && reply.children.length > 0) {
              return {
                ...reply,
                children: updateReplyContent(reply.children),
              };
            }
            return reply;
          });
        };

        setReplies(updateReplyContent);
        setEditingReplyId(null);
        setEditContent("");
        // Update currentTime untuk real-time update
        setCurrentTime(new Date());
        showToastMessage("Reply berhasil diedit!", "success");
      }
    } catch (error) {
      console.error("Error editing reply:", error);
      console.error("Error details:", handleApiError(error, "Mengedit reply"));
      showToastMessage(handleApiError(error, "Mengedit reply"), "error");
    }
  };

  // Function untuk delete reply
  const showDeleteConfirmation = (reply: ForumReply) => {
    // Hitung total balasan yang akan dihapus (termasuk nested)
    const totalReplies = countTotalReplies(reply.children || []);

    setReplyToDelete(reply);
    setReplyToDeleteInfo({
      reply,
      totalReplies,
    });
    setShowDeleteModal(true);
  };

  const handleDeleteReply = async (replyId: number) => {
    try {
      setIsDeletingReply(true);
      const response = await api.delete(`/forum/replies/${replyId}`);

      const ok = (response && response.status === 204) ||
        (response && response.status >= 200 && response.status < 300 && (response.data?.success === true || typeof response.data !== 'undefined'));

      if (ok) {
        // Remove reply from state
        const removeReplyFromState = (replies: ForumReply[]): ForumReply[] => {
          return replies
            .filter((reply) => reply.id !== replyId)
            .map((reply) => ({
              ...reply,
              children: reply.children ? removeReplyFromState(reply.children) : [],
            }));
        };

        setReplies(removeReplyFromState);
        setShowDeleteModal(false);
        setReplyToDelete(null);
        showToastMessage("Reply berhasil dihapus!", "success");
      }
    } catch (error) {
      console.error("Error deleting reply:", error);
      console.error("Error details:", handleApiError(error, "Menghapus reply"));
      // Jika backend mengembalikan 404 / model not found, sinkronkan ulang UI
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const err = error as any;
      if (err?.response?.status === 404) {
        await fetchForumData();
        showToastMessage(
          "Balasan tidak ditemukan di server. Tampilan telah disinkronkan ulang.",
          "warning"
        );
        return;
      }
      showToastMessage("Gagal menghapus reply. Coba lagi nanti.", "error");
    } finally {
      setIsDeletingReply(false);
    }
  };

  // Function untuk check timing (2 menit rule)
  const isWithin2Minutes = (createdAt: string) => {
    const now = new Date();
    const replyTime = new Date(createdAt);
    const diffInMinutes = (now.getTime() - replyTime.getTime()) / (1000 * 60);
    return diffInMinutes <= 2;
  };

  // Function untuk check permissions dengan timing
  const canEditReply = (reply: ForumReply) => {
    // Super Admin, Tim Akademik, Dosen: Bisa edit komen SENDIRI dalam 2 menit
    if (
      user?.role === "super_admin" ||
      user?.role === "tim_akademik" ||
      user?.role === "dosen"
    ) {
      return (
        reply.user.id === user?.id && // Hanya komen sendiri
        isWithin2Minutes(reply.created_at) &&
        !hiddenEditButtons.has(reply.id)
      );
    }

    // User biasa: Bisa edit komen sendiri
    return reply.user.id === user?.id;
  };

  const canDeleteReply = (reply: ForumReply) => {
    // Super Admin, Tim Akademik: Bisa delete komen siapa saja kapan saja
    if (user?.role === "super_admin" || user?.role === "tim_akademik") {
      return true; // Selalu bisa delete
    }

    // User biasa (termasuk dosen): Bisa delete komen sendiri saja
    return reply.user.id === user?.id;
  };

  // Function untuk check permission edit forum
  const canEditForum = () => {
    if (!user || !forum) return false;
    // Super Admin: Bisa edit forum siapa saja
    if (user.role === "super_admin") {
      return true;
    }
    // Author: Bisa edit forum sendiri
    return forum.user.id === user.id;
  };

  // Function untuk check permission delete forum
  const canDeleteForum = () => {
    if (!user || !forum) return false;
    // Super Admin: Bisa delete forum siapa saja
    if (user.role === "super_admin") {
      return true;
    }
    // Author: Bisa delete forum sendiri
    return forum.user.id === user.id;
  };

  const showToastMessage = (
    message: string,
    type: "success" | "warning" | "error"
  ) => {
    setToastMessage(message);
    setToastType(type);
    setShowToast(true);

    setTimeout(() => {
      setShowToast(false);
    }, 5000);
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

  // Filter replies berdasarkan search query
  const filteredReplies = replies.filter((reply) =>
    reply.content.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="py-8">
          <div className="space-y-6">
            <div className="h-8 w-48 bg-gray-200 dark:bg-gray-800 rounded-md animate-pulse" />
            {/* Header skeleton */}
            <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden">
              <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-11 h-11 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
                  <div>
                    <div className="h-4 w-56 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2" />
                    <div className="h-3 w-64 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  </div>
                </div>
                <div className="h-9 w-36 bg-gray-200 dark:bg-gray-800 rounded-lg animate-pulse" />
              </div>
              <div className="p-5 space-y-3">
                <div className="h-4 w-5/6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                <div className="h-4 w-4/6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
              </div>
            </div>

            {/* Replies skeleton */}
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden p-5">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-8 h-8 rounded-xl bg-gray-200 dark:bg-gray-800 animate-pulse" />
                  <div className="h-4 w-40 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                </div>
                <div className="h-3 w-full bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-2" />
                <div className="h-3 w-5/6 bg-gray-200 dark:bg-gray-800 rounded animate-pulse mb-4" />
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                    <div className="h-3 w-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                    <div className="h-3 w-12 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                  </div>
                  <div className="h-3 w-24 bg-gray-200 dark:bg-gray-800 rounded animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (!forum) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-300">Forum tidak ditemukan</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      {/* Toast Notification */}
      {showToast && (
        <motion.div
          initial={{ opacity: 0, y: -50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -50 }}
          className={`fixed top-4 right-4 z-50 px-6 py-3 rounded-lg shadow-lg text-white font-medium ${
            toastType === "success"
              ? "bg-green-500 text-white"
              : toastType === "warning"
              ? "bg-yellow-500 text-white"
              : "bg-red-500 text-white"
          }`}
        >
          {toastMessage}
        </motion.div>
      )}

      {/* Back Button */}
      <motion.button
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        onClick={() => navigate(-1)}
        className="flex items-center text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 mb-6 transition-colors"
      >
        <FontAwesomeIcon icon={faArrowLeft} className="mr-2" />
        Kembali
      </motion.button>

      {/* Forum Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03] overflow-hidden mb-6"
      >
        <div className="px-6 py-5 border-b border-gray-200 dark:border-gray-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${forum.category.color}20` }}>
              <FontAwesomeIcon icon={faComments} className="text-xl" style={{ color: forum.category.color }} />
            </div>
            <div>
              <h1 className="text-base lg:text-lg font-semibold text-gray-900 dark:text-white">{forum.category.name}</h1>
              <div className="flex items-center mt-2 space-x-3 text-xs text-gray-500 dark:text-gray-400">
                <span>{forum.replies_count} balasan</span>
              </div>
            </div>
          </div>
        </div>
        <div className="p-5 lg:p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center space-x-2 mb-2">
              <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-800 rounded-full">Detail Forum</span>
              {forum.status === "pinned" && (
                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-800 rounded">
                  Disematkan
                </span>
              )}
            </div>
          </div>

          {/* Edit & Delete Forum Buttons - Hanya untuk Super Admin dan Author */}
          {(canEditForum() || canDeleteForum()) && (
            <div className="flex items-center space-x-2">
              {/* Edit Forum Button */}
              {canEditForum() && (
                <button
                  onClick={openEditForumModal}
                  className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  title="Edit forum"
                >
                  <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
                </button>
              )}

              {/* Delete Forum Button */}
              {canDeleteForum() && (
                <button
                  onClick={() => setShowDeleteForumModal(true)}
                  className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Hapus forum"
                >
                  <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                </button>
              )}
            </div>
          )}
        </div>

        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">{forum.title}</h1>
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
              onClick={user && forum.user.id === user.id ? handleViewersClick : undefined}
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
          {forum.replies_count > 0 && (
            <span className="flex items-center">
              <FontAwesomeIcon icon={faReply} className="mr-1" />
              {forum.replies_count}
            </span>
          )}
          <button
            onClick={handleLikeForum}
            className={`flex items-center transition-colors ${
              isForumLiked
                ? "text-red-500"
                : "text-gray-500 hover:text-red-500"
            }`}
            title={isForumLiked ? "Unlike forum" : "Like forum"}
          >
            <FontAwesomeIcon
              icon={faHeart}
              className={`w-4 h-4 mr-1 ${isForumLiked ? "fill-current" : ""}`}
            />
            {likesCount}
          </button>
          <button
            onClick={handleForumBookmark}
            className={`flex items-center transition-colors ${
              forumBookmarks[forum.id]
                ? "text-yellow-500"
                : "text-gray-500 hover:text-yellow-500"
            }`}
            title={
              forumBookmarks[forum.id] ? "Hapus bookmark" : "Bookmark forum"
            }
          >
            <FontAwesomeIcon
              icon={faBookmark}
              className={`w-4 h-4 mr-1 ${
                forumBookmarks[forum.id] ? "fill-current" : ""
              }`}
            />
          </button>
          <span className="flex items-center">
            <FontAwesomeIcon icon={faClock} className="mr-1" />
            {formatTimeAgo(forum.last_activity_at)}
            {Boolean(forum.is_edited) && (
              <span className="text-gray-400 text-xs ml-2">• diedit</span>
            )}
          </span>
        </div>

        {/* Forum Content */}
        <div className="prose max-w-none bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mt-4">
          <QuillViewer
            content={forum.content}
            onImageClick={handleImagePreview}
          />
        </div>
        </div>
      </motion.div>

      {/* Reply Form untuk Forum Utama */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6"
      >
        {replyingTo === null ? (
          <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4">
            <form onSubmit={handleSubmitReply}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Balasan langsung ke forum
                </label>
                <div className="flex items-stretch space-x-3">
                  {/* Upload Button - Now on the LEFT */}
                  <div className="upload-dropdown-container">
                    <div className="relative">
                      <button
                        type="button"
                        onClick={() =>
                          setShowUploadDropdown(!showUploadDropdown)
                        }
                        className="px-3 h-14 w-14 text-gray-600 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 hover:bg-gray-600 hover:text-white rounded-lg transition-colors"
                        title="Upload file"
                      >
                        <FontAwesomeIcon icon={faPlus} className="w-5 h-5" />
                      </button>

                      {/* Upload Dropdown */}
                      {showUploadDropdown && (
                        <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10">
                          <div className="py-1">
                            <button
                              type="button"
                              onClick={() => {
                                const imageInput =
                                  document.getElementById("image-upload-main");
                                if (imageInput) {
                                  imageInput.click();
                                } else {
                                  console.error(
                                    "🔍 DEBUG: Image input not found! (main form)"
                                  );
                                }
                                setShowUploadDropdown(false);
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <FontAwesomeIcon
                                icon={faImage}
                                className="mr-3 w-4 h-4 text-green-600"
                              />
                              Images
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const fileInput =
                                  document.getElementById("file-upload-main");
                                if (fileInput) {
                                  fileInput.click();
                                } else {
                                  console.error(
                                    "🔍 DEBUG: File input not found! (main form)"
                                  );
                                }
                                setShowUploadDropdown(false);
                              }}
                              className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <FontAwesomeIcon
                                icon={faFile}
                                className="mr-3 w-4 h-4 text-blue-600"
                              />
                              Files
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Textarea */}
                  <div className="flex-1">
                    <textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      rows={2}
                      className="block w-full h-14 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                      placeholder="Tulis balasan Anda..."
                      required
                    />
                  </div>
                </div>

                {/* Hidden file inputs untuk form utama */}
                <input
                  id="image-upload-main"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                />
                <input
                  id="file-upload-main"
                  type="file"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />

                {/* Uploaded files preview */}
                {uploadedFiles.length > 0 && (
                  <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="text-xs font-medium text-gray-600 dark:text-gray-300 mb-2">
                      File ({uploadedFiles.length}):
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {uploadedFiles.map((file, index) => (
                        <div
                          key={index}
                          className="inline-block p-2 bg-white dark:bg-gray-600 rounded border dark:border-gray-500 relative"
                        >
                          {file.type.startsWith("image/") ? (
                            // Image preview - container seukuran gambar
                            <img
                              src={URL.createObjectURL(file)}
                              alt={file.name}
                              className="w-32 h-32 object-cover rounded border"
                            />
                          ) : (
                            // File icon for non-images - container seukuran icon + nama + size
                            <div className="text-center">
                              <FontAwesomeIcon
                                icon={faFile}
                                className="w-20 h-20 text-gray-500 mb-2"
                              />
                              <div className="text-xs text-gray-600 dark:text-gray-300 font-medium truncate max-w-24">
                                {file.name}
                              </div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {formatFileSize(file.size)}
                              </div>
                            </div>
                          )}
                          <button
                            type="button"
                            onClick={() => removeUploadedFile(index)}
                            className="absolute -top-2 -right-2 text-red-500 hover:text-red-700 bg-white dark:bg-gray-600 rounded-full p-1 hover:bg-red-50 dark:hover:bg-red-900 border dark:border-gray-500 shadow-sm"
                          >
                            <FontAwesomeIcon
                              icon={faTimes}
                              className="w-4 h-4"
                            />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={cancelReply}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submittingReply || !replyContent.trim()}
                  className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {submittingReply ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <FontAwesomeIcon icon={faPaperPlane} className="mr-2" />
                  )}
                  {submittingReply ? "Mengirim..." : "Kirim Balasan"}
                </button>
              </div>
            </form>
          </div>
        ) : (
          <button
            onClick={() => startReply()}
            className="w-full bg-white dark:bg-gray-800 border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-gray-500 dark:text-gray-400 hover:border-blue-300 dark:hover:border-blue-500 hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
          >
            <FontAwesomeIcon icon={faReply} className="mr-2" />
            Tulis balasan langsung ke forum...
          </button>
        )}
      </motion.div>

      {/* Replies Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-4"
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white flex items-center">
            <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm mr-3">
              <FontAwesomeIcon icon={faReply} className="w-4 h-4" />
            </div>
            Balasan ({countTotalReplies(replies)})
          </h2>

          {/* Search Replies */}
          <div className="relative w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <FontAwesomeIcon
                icon={faSearch}
                className="h-4 w-4 text-gray-400"
              />
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg leading-5 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
              placeholder="Cari komentar..."
            />
          </div>
        </div>

        {/* Search Results Info */}
        {searchQuery && (
          <div className="text-sm text-gray-600 dark:text-gray-300 mb-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            Hasil pencarian untuk "{searchQuery}": {filteredReplies.length}{" "}
            komentar ditemukan
            <button
              onClick={() => setSearchQuery("")}
              className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 underline"
            >
              Hapus pencarian
            </button>
          </div>
        )}

        {filteredReplies &&
        Array.isArray(filteredReplies) &&
        filteredReplies.length > 0 ? (
          <div className="space-y-4">
            {filteredReplies.map((reply) => (
              <motion.div
                key={reply.id}
                id={`reply-${reply.id}`}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-md border border-gray-100 dark:border-gray-700 p-4 hover:shadow-lg transition-shadow"
              >
                {/* Main Reply */}
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center space-x-3">
                    <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-medium shadow-sm">
                      {reply.user.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900 dark:text-white">
                        {reply.user.name}
                      </div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {reply.is_edited && reply.edited_at
                          ? formatTimeAgo(reply.edited_at)
                          : formatTimeAgo(reply.created_at)}
                        {reply.is_edited && (
                          <span className="text-gray-400 dark:text-gray-500 text-xs ml-2">
                            • diedit
                          </span>
                        )}
                      </div>
                      {/* Reply Context - Tampilkan "Balasan untuk komentar [nama user]" */}
                      {reply.parent && (
                        <div className="flex items-center mt-1 text-blue-600 dark:text-blue-400 text-xs">
                          <FontAwesomeIcon
                            icon={faReply}
                            className="mr-1 w-3 h-3"
                          />
                          Balasan untuk komentar {reply.parent.user.name}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Edit Button di Kanan Atas */}
                  <div className="flex items-center space-x-1">
                    {canEditReply(reply) && (
                      <button
                        onClick={() => startEditReply(reply)}
                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Edit komentar"
                      >
                        <FontAwesomeIcon icon={faEdit} className="w-4 h-4" />
                      </button>
                    )}

                    {/* Icon Bookmark di Pojok Kanan Atas */}
                    <button
                      onClick={() => handleReplyBookmark(reply.id)}
                      className={`p-2 rounded-lg transition-colors ${
                        reply.is_bookmarked
                          ? "text-yellow-500 hover:text-yellow-600 hover:bg-yellow-50"
                          : "text-gray-400 hover:text-yellow-500 hover:bg-yellow-50"
                      }`}
                      title={
                        reply.is_bookmarked
                          ? "Hapus bookmark"
                          : "Bookmark komentar"
                      }
                    >
                      <FontAwesomeIcon
                        icon={faBookmark}
                        className={`w-4 h-4 ${
                          reply.is_bookmarked ? "fill-current" : ""
                        }`}
                      />
                    </button>
                  </div>
                </div>

                <div className="prose max-w-none mb-3">
                  <QuillViewer content={reply.content} />

                  {/* Display attachments if any */}
                  {reply.attachments && reply.attachments.length > 0 && (
                    <div className="mt-3">
                      <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        Attachments ({reply.attachments.length}):
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {reply.attachments.map((attachment, index) => (
                          <div
                            key={`reply-${reply.id}-attachment-${index}-${
                              attachment.original_name || "unknown"
                            }`}
                            className="inline-block p-2 bg-gray-50 dark:bg-gray-600 rounded-lg border dark:border-gray-500"
                          >
                            {attachment.file_type &&
                            attachment.file_type.startsWith("image/") ? (
                              // Image preview - LEBIH BESAR & BISA DIKLIK
                              <img
                                src={attachment.file_path}
                                alt={attachment.original_name}
                                className="w-32 h-32 object-cover rounded border cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() =>
                                  window.open(attachment.file_path, "_blank")
                                }
                                title="Klik untuk lihat gambar penuh"
                              />
                            ) : (
                              // File preview dengan nama, size, dan action buttons
                              <div className="text-center">
                                <FontAwesomeIcon
                                  icon={faFile}
                                  className="w-20 h-20 text-gray-500 mb-2"
                                />
                                <div className="text-xs text-gray-600 dark:text-gray-300 font-medium truncate max-w-24 mb-1">
                                  {attachment.original_name}
                                </div>
                                <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                                  {attachment.file_size
                                    ? formatFileSize(attachment.file_size)
                                    : "Unknown size"}
                                </div>
                                <div className="flex justify-center">
                                  <button
                                    onClick={() =>
                                      window.open(
                                        attachment.file_path,
                                        "_blank"
                                      )
                                    }
                                    className="px-3 py-1 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                                    title="Buka file di tab baru"
                                  >
                                    Buka File
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => handleLikeReply(reply.id)}
                                className={`flex items-center space-x-1 p-2 rounded-lg transition-colors ${
            likedReplies.has(reply.id)
              ? "text-red-500 bg-red-50 dark:bg-red-900/20"
              : "text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
          }`}
                      title={
                        likedReplies.has(reply.id)
                          ? "Unlike reply"
                          : "Like reply"
                      }
                    >
                      <FontAwesomeIcon icon={faHeart} className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {reply.likes_count || 0}
                      </span>
                    </button>

                    <button
                      onClick={() => startReply(reply.id)}
                      className={`flex items-center space-x-1 p-2 rounded-lg transition-colors ${
                        replyingTo === reply.id
                          ? "text-blue-600 bg-blue-100 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700"
                          : "text-gray-500 dark:text-gray-400 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
                      }`}
                      title={
                        replyingTo === reply.id
                          ? "Sedang reply ke komentar ini"
                          : "Balas komentar ini"
                      }
                    >
                      <FontAwesomeIcon icon={faReply} className="w-4 h-4" />
                      <span className="text-sm font-medium">
                        {replyingTo === reply.id ? "Sedang Reply..." : "Balas"}
                      </span>
                    </button>

                    {/* Tombol Tampilkan/Sembunyikan Balasan Per Komentar - DI SEBELAH KANAN */}
                    {reply.children && reply.children.length > 0 && (
                      <button
                        onClick={() => {
                          setHiddenReplies((prev) => {
                            const newSet = new Set(prev);
                            if (newSet.has(reply.id)) {
                              newSet.delete(reply.id);
                            } else {
                              newSet.add(reply.id);
                            }
                            return newSet;
                          });
                        }}
                        className="flex items-center space-x-1 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-2 rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/20"
                        title={
                          hiddenReplies.has(reply.id)
                            ? "Tampilkan balasan"
                            : "Sembunyikan balasan"
                        }
                      >
                        <FontAwesomeIcon
                          icon={
                            hiddenReplies.has(reply.id) ? faEye : faEyeSlash
                          }
                          className="w-4 h-4"
                        />
                        <span className="text-sm text-blue-600 dark:text-blue-400">
                          {hiddenReplies.has(reply.id)
                            ? `Tampilkan Balasan (${countTotalReplies(
                                reply.children
                              )})`
                            : `Sembunyikan Balasan (${countTotalReplies(
                                reply.children
                              )})`}
                        </span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Icon Delete di Pojok Bawah */}
                {canDeleteReply(reply) && (
                  <div className="flex justify-end mt-2">
                    <button
                      onClick={() => showDeleteConfirmation(reply)}
                      className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                      title="Hapus komentar"
                    >
                      <FontAwesomeIcon icon={faTrash} className="w-4 h-4" />
                    </button>
                  </div>
                )}

                {/* Edit Form untuk Komentar Ini */}
                {editingReplyId === reply.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                        Edit komentar
                      </h4>
                      <button
                        onClick={cancelEditReply}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/20"
                      >
                        <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="mb-3">
                      <textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="w-full p-3 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
                        rows={4}
                        placeholder="Edit komentar Anda..."
                      />
                    </div>

                    <div className="flex justify-end space-x-3">
                      <button
                        type="button"
                        onClick={cancelEditReply}
                        className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 text-sm"
                      >
                        Batal
                      </button>
                      <button
                        onClick={() => handleEditReply(reply.id)}
                        disabled={!editContent.trim()}
                        className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                      >
                        Simpan
                      </button>
                    </div>
                  </motion.div>
                )}

                {/* Form Reply untuk Komentar Ini */}
                {replyingTo === reply.id && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600 shadow-sm"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-300">
                        Balas ke komentar {reply.user.name}
                      </h4>
                      <button
                        onClick={cancelReply}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 transition-colors p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/20"
                      >
                        <FontAwesomeIcon icon={faTimes} className="w-4 h-4" />
                      </button>
                    </div>

                    <form onSubmit={handleSubmitReply}>
                      <div className="mb-3">
                        <div className="flex items-stretch space-x-3">
                          {/* Upload Button */}
                          <div className="upload-dropdown-container">
                            <div className="relative">
                              <button
                                type="button"
                                onClick={() => {
                                  setShowUploadDropdown(!showUploadDropdown);
                                }}
                                className="px-3 h-14 text-blue-600 dark:text-blue-400 bg-white dark:bg-gray-700 border border-blue-300 dark:border-blue-600 hover:bg-blue-600 hover:text-white rounded-lg transition-colors"
                                title="Upload file"
                              >
                                <FontAwesomeIcon
                                  icon={faPlus}
                                  className="w-4 h-4"
                                />
                              </button>

                              {/* Upload Dropdown */}
                              {showUploadDropdown && (
                                <div className="absolute bottom-full left-0 mb-2 w-48 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50">
                                  <div className="py-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const imageInput =
                                          document.getElementById(
                                            "image-upload-reply"
                                          );
                                        if (imageInput) {
                                          imageInput.click();
                                        } else {
                                          console.error(
                                            "🔍 DEBUG: Image input not found!"
                                          );
                                        }
                                        setShowUploadDropdown(false);
                                      }}
                                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                      <FontAwesomeIcon
                                        icon={faImage}
                                        className="mr-3 w-4 h-4 text-green-600"
                                      />
                                      Images
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const fileInput =
                                          document.getElementById(
                                            "file-upload-reply"
                                          );
                                        if (fileInput) {
                                          fileInput.click();
                                        } else {
                                          console.error(
                                            "🔍 DEBUG: File input not found!"
                                          );
                                        }
                                        setShowUploadDropdown(false);
                                      }}
                                      className="flex items-center w-full px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                                    >
                                      <FontAwesomeIcon
                                        icon={faFile}
                                        className="mr-3 w-4 h-4 text-blue-600"
                                      />
                                      Files
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          </div>

                          {/* Textarea */}
                          <div className="flex-1">
                            <textarea
                              value={replyContent}
                              onChange={(e) => setReplyContent(e.target.value)}
                              rows={2}
                              className="block w-full h-14 px-3 py-2 border border-blue-300 dark:border-blue-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm resize-none"
                              placeholder={`Balas ke komentar ${reply.user.name}...`}
                              required
                            />
                          </div>
                        </div>

                        {/* Hidden file inputs untuk reply ke komentar */}
                        <input
                          id="image-upload-reply"
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={handleImageUpload}
                          className="hidden"
                        />
                        <input
                          id="file-upload-reply"
                          type="file"
                          multiple
                          onChange={handleFileUpload}
                          className="hidden"
                        />

                        {/* Uploaded files preview */}
                        {uploadedFiles.length > 0 && (
                          <div className="mb-3">
                            <div className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-2">
                              File ({uploadedFiles.length}):
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {uploadedFiles.map((file, index) => (
                                <div
                                  key={index}
                                  className="inline-block p-2 bg-white dark:bg-gray-600 rounded border dark:border-gray-500 relative"
                                >
                                  {file.type.startsWith("image/") ? (
                                    <img
                                      src={URL.createObjectURL(file)}
                                      alt={file.name}
                                      className="w-24 h-24 object-cover rounded border"
                                    />
                                  ) : (
                                    <div className="text-center">
                                      <FontAwesomeIcon
                                        icon={faFile}
                                        className="w-16 h-16 text-gray-500 mb-2"
                                      />
                                      <div className="text-xs text-gray-600 dark:text-gray-300 font-medium truncate max-w-20">
                                        {file.name}
                                      </div>
                                      <div className="text-xs text-gray-500 dark:text-gray-400">
                                        {formatFileSize(file.size)}
                                      </div>
                                    </div>
                                  )}
                                  <button
                                    type="button"
                                    onClick={() => removeUploadedFile(index)}
                                    className="absolute -top-2 -right-2 text-red-500 hover:text-red-700 bg-white dark:bg-gray-600 rounded-full p-1 hover:bg-red-50 dark:hover:bg-red-900 border dark:border-gray-500 shadow-sm"
                                  >
                                    <FontAwesomeIcon
                                      icon={faTimes}
                                      className="w-3 h-3"
                                    />
                                  </button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>

                      <div className="flex justify-end space-x-3">
                        <button
                          type="button"
                          onClick={cancelReply}
                          className="px-3 py-2 border border-blue-300 dark:border-blue-600 rounded-lg text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/20 text-sm"
                        >
                          Selesai
                        </button>
                        <button
                          type="submit"
                          disabled={submittingReply || !replyContent.trim()}
                          className="flex items-center px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
                        >
                          {submittingReply ? (
                            <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white mr-2"></div>
                          ) : (
                            <FontAwesomeIcon
                              icon={faPaperPlane}
                              className="mr-2 w-3 h-3"
                            />
                          )}
                          {submittingReply ? "Mengirim..." : "Kirim Balasan"}
                        </button>
                      </div>
                    </form>
                  </motion.div>
                )}

                {/* Children Replies (Nested Replies) */}
                {reply.children &&
                  reply.children.length > 0 &&
                  !hiddenReplies.has(reply.id) && (
                    <div className="mt-4 ml-8 space-y-3 border-l-2 border-blue-300 pl-4">
                      <div className="text-sm font-medium text-blue-700 dark:text-blue-300 mb-2 flex items-center">
                        <FontAwesomeIcon
                          icon={faReply}
                          className="mr-2 text-blue-500"
                        />
                        Balasan ({countTotalReplies(reply.children)}):
                      </div>
                      {reply.children.map((childReply) => (
                        <motion.div
                          key={childReply.id}
                          id={`reply-${childReply.id}`}
                          initial={{ opacity: 0, x: -20 }}
                          animate={{ opacity: 1, x: 0 }}
                          className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-100 dark:border-gray-700 p-3 hover:shadow-md transition-shadow"
                        >
                          {/* Recursive Reply Component - Unlimited Nesting */}
                          <RecursiveReplyComponent
                            reply={childReply}
                            level={2}
                            onLike={handleLikeReply}
                            likedReplies={likedReplies}
                            onReply={startReply}
                            replyingTo={replyingTo}
                            onCancelReply={cancelReply}
                            onSubmitReply={handleSubmitReply}
                            uploadedFiles={uploadedFiles}
                            setUploadedFiles={setUploadedFiles}
                            replyContent={replyContent}
                            setReplyContent={setReplyContent}
                            submittingReply={submittingReply}
                            showUploadDropdown={showUploadDropdown}
                            setShowUploadDropdown={setShowUploadDropdown}
                            handleImageUpload={handleImageUpload}
                            handleFileUpload={handleFileUpload}
                            removeUploadedFile={removeUploadedFile}
                            formatFileSize={formatFileSize}
                            onEdit={startEditReply}
                            onDelete={showDeleteConfirmation}
                            canEdit={canEditReply}
                            canDelete={canDeleteReply}
                            handleReplyBookmark={handleReplyBookmark}
                            currentTime={currentTime}
                          />
                        </motion.div>
                      ))}
                    </div>
                  )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <FontAwesomeIcon
              icon={faComments}
              className="h-12 w-12 text-gray-400 mb-4"
            />
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery
                ? "Tidak ada komentar yang ditemukan."
                : "Belum ada balasan. Jadilah yang pertama untuk membalas!"}
            </p>
          </div>
        )}
      </motion.div>

      {/* Image Preview Mode */}
      {showImagePreview && previewImage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md flex items-center justify-center z-[100000]"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-4xl w-full mx-4 border border-gray-100 dark:border-gray-700 relative"
          >
            {/* Close Button */}
            <button
              onClick={closeImagePreview}
              className="absolute top-4 right-4 p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Tutup"
            >
              <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
            </button>

            {/* Image Content */}
            <div className="text-center">
              <img
                src={previewImage}
                alt="Forum image preview"
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Image Modal Popup */}
      {showImageModal && selectedImage && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 flex items-center justify-center z-[100000]"
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-4xl w-full mx-4 border border-gray-100 dark:border-gray-700 relative"
          >
            {/* Close Button */}
            <button
              onClick={closeImageModal}
              className="absolute top-4 right-4 p-2 text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
              title="Tutup"
            >
              <FontAwesomeIcon icon={faTimes} className="w-5 h-5" />
            </button>

            {/* Image Content */}
            <div className="text-center">
              <img
                src={selectedImage}
                alt="Forum image"
                className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
              />
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Edit Forum Modal */}
      <AnimatePresence>
        {showEditForumModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4">
            {/* Overlay */}
            <div
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={() => setShowEditForumModal(false)}
            ></div>

            {/* Modal Content */}
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto hide-scroll z-[100001] border border-gray-200 dark:border-gray-800"
            >
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Edit Forum
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
                    value={editForumTitle}
                    onChange={(e) => setEditForumTitle(e.target.value)}
                    className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Masukkan judul forum yang menarik..."
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Konten/Deskripsi
                  </label>
                  <QuillEditor
                    value={editForumContent}
                    onChange={(content) => setEditForumContent(content)}
                    placeholder="Edit konten forum..."
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
                      const isSelected = editForumAccessType === (opt.value as "public" | "private");
                      return (
                        <button
                          type="button"
                          key={opt.value}
                          onClick={() => handleEditAccessTypeChange(opt.value as "public" | "private")}
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

                {editForumAccessType === "private" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Pilih Pengguna yang Berhak Akses
                    </label>
                    <div className="mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                      <div className="text-blue-800 dark:text-blue-300 text-sm font-medium mb-1">
                        ℹ️ Info Forum Private
                      </div>
                      <div className="text-blue-700 dark:text-blue-400 text-xs">
                        Forum private hanya bisa diakses oleh Anda (sebagai
                        pembuat) dan pengguna yang dipilih. Pengguna lain tidak
                        akan bisa melihat atau mengakses forum ini.
                      </div>
                    </div>
                    <div className="flex items-center justify-between mb-3">
                      <input
                        type="text"
                        placeholder="Cari pengguna (opsional)..."
                        value={editUserSearchQuery}
                        onChange={handleEditSearchInputChange}
                        className="block w-full px-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          handleEditUserSearch(editUserSearchQuery)
                        }
                        className="ml-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                        disabled={editSearchingUsers}
                      >
                        {editSearchingUsers ? (
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
                        <label htmlFor="editSelectAllDosen" className="flex items-center cursor-pointer select-none">
                          <input
                            type="checkbox"
                            id="editSelectAllDosen"
                            checked={editSelectAllDosen}
                            onChange={handleEditSelectAllDosen}
                            className="sr-only"
                          />
                          <span className={`mr-2 inline-flex h-4 w-4 items-center justify-center rounded border text-white shadow-sm transition-colors ${
                            editSelectAllDosen
                              ? "bg-blue-600 border-blue-600"
                              : "bg-white border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                          }`}>
                            <svg className={`h-3 w-3 ${editSelectAllDosen ? "opacity-100" : "opacity-0"}`} viewBox="0 0 20 20" fill="currentColor">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                            </svg>
                          </span>
                          <span className="text-sm text-gray-700 dark:text-gray-300">Pilih Semua Dosen</span>
                          </label>
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border border-gray-200 dark:border-gray-700">
                          Total: {editSearchableUsers.length} pengguna
                        </span>
                      </div>

                      {editSearchingUsers ? (
                        <div className="flex items-center justify-center py-8">
                          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                          <span className="ml-2 text-gray-600 dark:text-gray-300">
                            Memuat pengguna...
                          </span>
                        </div>
                      ) : (
                        <div className="max-h-60 overflow-y-auto hide-scroll border border-gray-200 dark:border-gray-700 rounded-lg">
                          {editSearchableUsers.length > 0 ? (
                            editSearchableUsers.map((user) => (
                              <div
                                key={user.id}
                                className={`group flex items-center justify-between p-3 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-b-0 hover:bg-gray-50/60 dark:hover:bg-white/[0.04] rounded-lg ${
                                  editForumSelectedUsers.includes(user.id)
                                    ? "bg-blue-50/80 dark:bg-blue-900/10 ring-1 ring-blue-300/60 dark:ring-blue-800/60"
                                    : ""
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => toggleEditUserSelection(user.id)}
                                  className="group flex items-center w-full text-left"
                                >
                                  <span className={`mr-3 inline-flex h-4 w-4 items-center justify-center rounded border text-white shadow-sm transition-colors ${
                                    editForumSelectedUsers.includes(user.id)
                                      ? "bg-blue-600 border-blue-600"
                                      : "bg-white border-gray-300 dark:border-gray-600 dark:bg-gray-800"
                                  }`}>
                                    <svg className={`h-3 w-3 ${editForumSelectedUsers.includes(user.id) ? "opacity-100" : "opacity-0"}`} viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                    </svg>
                                  </span>
                                  <div className="flex items-center gap-3">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${getEditAvatarClasses(user.role)}`}>
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
                                      <span className={`ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border ${getEditRoleBadgeClasses(user.role)}`}>
                                        {user.role || 'user'}
                                      </span>
                                    </div>
                                  </div>
                                  </button>
                                </div>
                              ))
                            ) : (
                              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                                {editUserSearchQuery
                                  ? "Tidak ada pengguna yang cocok"
                                  : "Memuat daftar pengguna..."}
                              </div>
                            )}
                          </div>
                      )}
                    </div>

                    {editForumSelectedUsers.length > 0 && (
                      <div className="mt-3">
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          Pengguna yang Dipilih ({editForumSelectedUsers.length}
                          )
                        </label>
                        <div className="flex flex-wrap gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                          {editForumSelectedUsers.map((userId) => {
                            const user = editSearchableUsers.find(
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
                                  onClick={() =>
                                    toggleEditUserSelection(user.id)
                                  }
                                  className="ml-2 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
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
                    setShowEditForumModal(false);
                    setEditForumTitle("");
                    setEditForumContent("");
                  }}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleEditForum}
                  disabled={!editForumTitle.trim() || !editForumContent.trim() || isEditingForum}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isEditingForum ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    "Simpan Perubahan"
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Forum Modal */}
      {showDeleteForumModal && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center">
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
            onClick={() => {
              if (isDeletingForum) return;
              setShowDeleteForumModal(false);
            }}
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
              onClick={() => {
                if (isDeletingForum) return;
                setShowDeleteForumModal(false);
              }}
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
                  Hapus Forum
                </h2>
              </div>
              
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={faTrash}
                      className="w-6 h-6 text-red-600 dark:text-red-400"
                    />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Konfirmasi Hapus</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Tindakan ini tidak dapat dibatalkan!</p>
                  </div>
                </div>
                
                {/* Info Balasan yang Akan Dihapus */}
                {forum && forum.replies_count > 0 && (
                  <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Perhatian!</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          Forum ini memiliki{" "}
                          <span className="font-semibold">
                            {forum.replies_count} balasan
                          </span>{" "}
                          yang akan ikut terhapus.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">Peringatan!</p>
                      <p className="text-sm text-red-700 dark:text-red-300">Apakah Anda yakin ingin menghapus forum ini? Tindakan ini tidak dapat dibatalkan.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-2 relative z-20">
                <button
                  onClick={() => setShowDeleteForumModal(false)}
                  disabled={isDeletingForum}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ease-in-out ${
                    isDeletingForum
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleDeleteForum}
                  disabled={isDeletingForum}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium shadow-theme-xs transition-all duration-300 ease-in-out relative z-10 ${
                    isDeletingForum
                      ? 'bg-red-600/70 text-white cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {isDeletingForum ? (
                    <span className="inline-flex items-center">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                      Menghapus...
                    </span>
                  ) : (
                    'Hapus Forum'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && replyToDelete && replyToDeleteInfo && (
        <div className="fixed inset-0 z-[100000] flex items-center justify-center">
          {/* Overlay */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
            onClick={() => {
              if (isDeletingReply) return;
              setShowDeleteModal(false);
              setReplyToDelete(null);
              setReplyToDeleteInfo(null);
            }}
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
              onClick={() => {
                if (isDeletingReply) return;
                setShowDeleteModal(false);
                setReplyToDelete(null);
                setReplyToDeleteInfo(null);
              }}
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
                  Hapus Komentar
                </h2>
              </div>
              
              <div className="mb-6">
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-12 h-12 bg-red-100 dark:bg-red-900/20 rounded-lg flex items-center justify-center">
                    <FontAwesomeIcon
                      icon={faTrash}
                      className="w-6 h-6 text-red-600 dark:text-red-400"
                    />
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900 dark:text-white">Konfirmasi Hapus</h4>
                    <p className="text-sm text-gray-600 dark:text-gray-400">Tindakan ini tidak dapat dibatalkan!</p>
                  </div>
                </div>
                
                {/* Info Balasan yang Akan Dihapus */}
                {replyToDeleteInfo.totalReplies > 0 && (
                  <div className="mb-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                    <div className="flex items-start space-x-3">
                      <svg className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                      </svg>
                      <div>
                        <p className="text-sm font-medium text-yellow-800 dark:text-yellow-200">Perhatian!</p>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300">
                          Komentar ini memiliki{" "}
                          <span className="font-semibold">
                            {replyToDeleteInfo.totalReplies} balasan
                          </span>{" "}
                          yang akan ikut terhapus.
                        </p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
                  <div className="flex items-start space-x-3">
                    <svg className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                    <div>
                      <p className="text-sm font-medium text-red-800 dark:text-red-200">Peringatan!</p>
                      <p className="text-sm text-red-700 dark:text-red-300">Apakah Anda yakin ingin menghapus komentar ini? Tindakan ini tidak dapat dibatalkan.</p>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 pt-2 relative z-20">
                <button
                  onClick={() => {
                    if (isDeletingReply) return;
                    setShowDeleteModal(false);
                    setReplyToDelete(null);
                    setReplyToDeleteInfo(null);
                  }}
                  disabled={isDeletingReply}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium transition-all duration-300 ease-in-out ${
                    isDeletingReply
                      ? 'bg-gray-100 dark:bg-gray-800 text-gray-400 cursor-not-allowed'
                      : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-700'
                  }`}
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteReply(replyToDelete.id)}
                  disabled={isDeletingReply}
                  className={`px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm font-medium shadow-theme-xs transition-all duration-300 ease-in-out relative z-10 ${
                    isDeletingReply
                      ? 'bg-red-600/70 text-white cursor-not-allowed'
                      : 'bg-red-600 text-white hover:bg-red-700'
                  }`}
                >
                  {isDeletingReply ? (
                    <span className="inline-flex items-center">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></span>
                      Menghapus...
                    </span>
                  ) : (
                    'Hapus Komentar'
                  )}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}

      {/* Modal Viewers */}
      <AnimatePresence>
        {showViewersModal && (
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
                      <h4 className="font-medium text-gray-900 dark:text-white">Forum: {forum?.title}</h4>
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
                          onClick={() => fetchViewers(viewersPagination.current_page + 1)}
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

export default ForumDetail;
