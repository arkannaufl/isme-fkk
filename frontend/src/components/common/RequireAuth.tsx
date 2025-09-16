import { Navigate, Outlet } from "react-router-dom";
import { useEffect } from "react";
import api, { handleApiError } from "../../utils/api";
import { useSession } from "../../context/SessionContext";

export default function RequireAuth() {
  const token = localStorage.getItem("token");
  const { setSessionExpired } = useSession();

  useEffect(() => {
    // Verify token validity on component mount
    const verifyToken = async () => {
      try {
        await api.get("/me");
      } catch (error: any) {
        // If token is invalid, clear storage
        localStorage.removeItem("token");
        localStorage.removeItem("user");
        
        // Don't dispatch sessionExpired here as it's handled by API interceptor
        // Just redirect to login
        window.location.href = '/login';
      }
    };

    if (token) {
      verifyToken();
    }
    // If there's no token, the return statement below will handle the redirect
  }, [token, setSessionExpired]);

  // If no token exists, immediately redirect to login page
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // If token exists, render the protected content
  return <Outlet />;
} 
