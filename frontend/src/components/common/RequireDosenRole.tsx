import React from "react";
import { Navigate } from "react-router";

interface RequireDosenRoleProps {
  children: React.ReactNode;
  allowedRoles: string[];
}

export default function RequireDosenRole({ 
  children, 
  allowedRoles 
}: RequireDosenRoleProps) {
  const getUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  };

  const user = getUser();
  
  if (!user.id) {
    return <Navigate to="/signin" replace />;
  }

  // Cek apakah user memiliki role yang diizinkan
  if (!allowedRoles.includes(user.role)) {
    // Redirect semua user yang tidak memiliki akses ke dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
}
