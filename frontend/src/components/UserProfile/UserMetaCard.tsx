import { useState, useRef, useEffect } from "react";
import api, { BASE_URL, handleApiError } from "../../utils/api";

export default function UserMetaCard() {
  const [user, setUser] = useState<any>(null);
  const [isHover, setIsHover] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [isImgError, setIsImgError] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const updateUser = () => {
      const userData = JSON.parse(localStorage.getItem("user") || "{}");
      setUser(userData);
    };
    updateUser();
    window.addEventListener("user-updated", updateUser);
    return () => window.removeEventListener("user-updated", updateUser);
  }, []);

  useEffect(() => {
    setIsImgError(false);
  }, [user && user.avatar]);

  if (!user || typeof user !== 'object' || !('avatar' in user)) return null;

  // Avatar: huruf awal nama jika tidak ada foto
  const getInitials = (name: string) => {
    if (!name) return "";
    const parts = name.split(" ");
    if (parts.length > 1) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0].toUpperCase();
  };

  const initials = getInitials(user.name || "");
  const avatarUrl = user.avatar
    ? (typeof user.avatar === 'string' && user.avatar.startsWith("http")
      ? user.avatar
      : BASE_URL + user.avatar)
    : null;
  const avatar = avatarUrl && !isImgError ? (
    <img
      src={avatarUrl}
      alt="profile"
      className="object-cover w-full h-full rounded-full bg-brand-500"
      onError={() => setIsImgError(true)}
    />
  ) : (
    <span className="flex items-center justify-center w-full h-full text-2xl font-semibold bg-brand-500 text-white rounded-full">
      {initials}
    </span>
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith("image/")) {
      setError("Please select an image file");
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      setError("Image size should be less than 2MB");
      return;
    }

    setUploading(true);
    setIsHover(true); // Keep hover state active during upload
    setError("");

    try {
      const formData = new FormData();
      formData.append("avatar", file);

      const response = await api.post("/profile/avatar", formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      const updatedUser = response.data.user;
      localStorage.setItem("user", JSON.stringify(updatedUser));
      setUser(updatedUser);
      // Dispatch event to notify other components
      window.dispatchEvent(new Event("user-updated"));
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to upload avatar");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="p-5 border border-gray-200 rounded-2xl dark:border-gray-800 lg:p-6">
      <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
          <div
            className="w-20 h-20 relative group cursor-pointer"
            onMouseEnter={() => setIsHover(true)}
            onMouseLeave={() => setIsHover(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            {avatar}
            {(isHover || uploading) && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/70 rounded-full z-10">
                <svg 
                  xmlns="http://www.w3.org/2000/svg" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  strokeWidth="1.8" 
                  stroke="currentColor" 
                  className="size-6 text-white"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 0 1 5.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 0 0 2.25 2.25h15A2.25 2.25 0 0 0 21.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 0 0-1.134-.175 2.31 2.31 0 0 1-1.64-1.055l-.822-1.316a2.192 2.192 0 0 0-1.736-1.039 48.774 48.774 0 0 0-5.232 0 2.192 2.192 0 0 0-1.736 1.039l-.821 1.316Z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0ZM18.75 10.5h.008v.008h-.008V10.5Z" />
                </svg>
                {uploading ? (
                  <span className="text-xs text-white">Uploading...</span>
                ) : (
                  <span className="text-xs text-white font-medium">Ubah Foto</span>
                )}
              </div>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>
          <div className="order-3 xl:order-2 flex flex-col gap-1">
            <h4 className="mb-1 text-lg font-semibold text-center text-gray-800 dark:text-white/90 xl:text-left">
              {user.name}
            </h4>
            <div className="flex flex-row items-center gap-2 text-center xl:text-left">
              <span className="text-sm text-gray-500 dark:text-gray-400">{user.username}</span>
            </div>
          </div>
        </div>
      </div>
      {error && (
        <div className="text-sm text-red-500 bg-red-100 rounded p-2 mt-4 dark:bg-red-900/20 dark:text-red-400">
          {error}
        </div>
      )}
    </div>
  );
}
