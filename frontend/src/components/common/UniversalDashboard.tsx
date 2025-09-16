import React, { useEffect, useState } from 'react';
import DashboardSuperAdmin from '../../pages/DashboardSuperAdmin';
import DashboardDosen from '../../pages/DashboardDosen';
import DashboardTimAkademik from '../../pages/DashboardTimAkademik';

export default function UniversalDashboard() {
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const getUser = () => {
      try {
        return JSON.parse(localStorage.getItem("user") || "{}");
      } catch {
        return {};
      }
    };

    const user = getUser();
    if (user.role) {
      setUserRole(user.role);
    }
    setLoading(false);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
          <p className="text-gray-600 dark:text-gray-400">Memuat...</p>
        </div>
      </div>
    );
  }

  // Render dashboard based on user role
  if (userRole === 'super_admin') {
    return <DashboardSuperAdmin />;
  } else if (userRole === 'dosen') {
    return <DashboardDosen />;
  } else if (userRole === 'tim_akademik') {
    return <DashboardTimAkademik />;
  } else {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">Role tidak dikenali</p>
        </div>
      </div>
    );
  }
}
