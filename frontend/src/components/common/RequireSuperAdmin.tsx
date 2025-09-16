import React from "react";
import { Navigate } from "react-router-dom";

interface RequireSuperAdminProps {
  children: React.ReactNode;
}

export default function RequireSuperAdmin({
  children,
}: RequireSuperAdminProps) {
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

  // Cek apakah user adalah superadmin
  if (user.role !== "super_admin") {
    return <Navigate to="/access-denied" replace />;
  }

  return <>{children}</>;
}
