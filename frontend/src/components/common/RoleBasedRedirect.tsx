import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router";

export default function RoleBasedRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const [hasRedirected, setHasRedirected] = useState(false);

  useEffect(() => {
    // Prevent infinite redirects
    if (hasRedirected) {
      return;
    }

    const getUser = () => {
      try {
        return JSON.parse(localStorage.getItem("user") || "{}");
      } catch {
        return {};
      }
    };

    const user = getUser();

    if (!user.id) {
      setHasRedirected(true);
      navigate("/signin");
      return;
    }

    // Handle root path redirects - redirect to universal dashboard first
    if (location.pathname === "/") {
      setHasRedirected(true);
      navigate("/dashboard");
      return;
    }
    
    // Handle dashboard path redirects - now handled by UniversalDashboard component
    // No need to redirect from /dashboard anymore
  }, [navigate, location.pathname, hasRedirected]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-gray-600 dark:text-gray-400">Memuat...</p>
      </div>
    </div>
  );
} 
