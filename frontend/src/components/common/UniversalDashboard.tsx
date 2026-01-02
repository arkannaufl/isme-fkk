import React, { useEffect, useState } from "react";
import DashboardSuperAdmin from "../../pages/DashboardSuperAdmin";
import DashboardDosen from "../../pages/DashboardDosen";
import DashboardTimAkademik from "../../pages/DashboardTimAkademik";
import DashboardMahasiswa from "../../pages/DashboardMahasiswa";
import DashboardUnitIKD from "../../pages/DashboardUnitIKD";
import DashboardKetuaIKD from "../../pages/DashboardKetuaIKD";

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
    return null; // Or return a simple div without spinner if layout flickers, but null avoids the 'double loader' issue
  }

  // Render dashboard based on user role
  if (userRole === "super_admin") {
    return <DashboardSuperAdmin />;
  } else if (userRole === "dosen") {
    return <DashboardDosen />;
  } else if (userRole === "tim_akademik") {
    return <DashboardTimAkademik />;
  } else if (userRole === "mahasiswa") {
    return <DashboardMahasiswa />;
  } else if (userRole === "ketua_ikd") {
    return <DashboardKetuaIKD />;
  } else if (
    [
      "aik",
      "meu",
      "profesi",
      "kemahasiswaan",
      "sdm",
      "upt_jurnal",
      "upt_ppm",
      "akademik",
      "verifikator"
    ].includes(userRole || "")
  ) {
    return <DashboardUnitIKD />;
  } else {
    // Fallback or specific dashboard for Ketua IKD if needed later
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-600 dark:text-gray-400">
            Role tidak dikenali: {userRole}
          </p>
        </div>
      </div>
    );
  }
}
