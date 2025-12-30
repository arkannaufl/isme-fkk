import React, { useState, useEffect, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PedomanPoinIKD from "./PedomanPoinIKD";
import TimAkademikIKD from "./TimAkademik";
import DosenIKD from "./DosenIKD";
import AIKIKD from "./AIK";
import MEUIKD from "./MEU";
import ProfesiIKD from "./Profesi";
import KemahasiswaanIKD from "./Kemahasiswaan";
import SDMIKD from "./SDM";
import UPTJurnalIKD from "./UPTJurnal";
import UPTPPMIKD from "./UPTPPM";
import { RekapIKDBaseContext } from "./RekapIKDBase";

interface TabItem {
  id: string;
  name: string;
  path: string;
  roles: string[];
  component: React.ComponentType;
}

const RekapIKDWrapper: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  // Get user role
  const getUser = () => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  };

  const user = getUser();
  const userRole = user?.role || "";

  // All available tabs
  const allTabs: TabItem[] = [
    {
      id: "pedoman-poin",
      name: "Pedoman Poin IKD",
      path: "/rekap-ikd/pedoman-poin",
      roles: ["super_admin", "ketua_ikd"],
      component: PedomanPoinIKD,
    },
    {
      id: "akademik",
      name: "Akademik",
      path: "/rekap-ikd/tim-akademik",
      roles: ["super_admin", "ketua_ikd", "akademik"],
      component: TimAkademikIKD,
    },
    {
      id: "dosen",
      name: "Dosen",
      path: "/rekap-ikd/dosen",
      roles: ["super_admin", "ketua_ikd", "verifikator", "dosen"],
      component: DosenIKD,
    },
    {
      id: "aik",
      name: "AIK",
      path: "/rekap-ikd/aik",
      roles: ["super_admin", "ketua_ikd", "aik"],
      component: AIKIKD,
    },
    {
      id: "meu",
      name: "MEU",
      path: "/rekap-ikd/meu",
      roles: ["super_admin", "ketua_ikd", "meu"],
      component: MEUIKD,
    },
    {
      id: "profesi",
      name: "Profesi",
      path: "/rekap-ikd/profesi",
      roles: ["super_admin", "ketua_ikd", "profesi"],
      component: ProfesiIKD,
    },
    {
      id: "kemahasiswaan",
      name: "Kemahasiswaan",
      path: "/rekap-ikd/kemahasiswaan",
      roles: ["super_admin", "ketua_ikd", "kemahasiswaan"],
      component: KemahasiswaanIKD,
    },
    {
      id: "sdm",
      name: "SDM",
      path: "/rekap-ikd/sdm",
      roles: ["super_admin", "ketua_ikd", "sdm"],
      component: SDMIKD,
    },
    {
      id: "upt-jurnal",
      name: "UPT Jurnal",
      path: "/rekap-ikd/upt-jurnal",
      roles: ["super_admin", "ketua_ikd", "upt_jurnal"],
      component: UPTJurnalIKD,
    },
    {
      id: "upt-ppm",
      name: "UPT PPM",
      path: "/rekap-ikd/upt-ppm",
      roles: ["super_admin", "ketua_ikd", "upt_ppm"],
      component: UPTPPMIKD,
    },
  ];

  // Filter tabs based on user role
  const availableTabs = useMemo(() => {
    if (!userRole) return [];

    // ketua_ikd can access all tabs
    if (userRole === "ketua_ikd") {
      return allTabs;
    }

    // Filter tabs based on role
    return allTabs.filter((tab) => tab.roles.includes(userRole));
  }, [userRole]);

  // Get current active tab based on path
  const activeTab = useMemo(() => {
    const currentPath = location.pathname;
    const tab = availableTabs.find((t) => t.path === currentPath);
    return tab || null;
  }, [location.pathname, availableTabs]);

  // Navigate to first available tab if current path doesn't match any tab or is /rekap-ikd
  useEffect(() => {
    if (availableTabs.length > 0) {
      const currentPath = location.pathname;
      // If path is /rekap-ikd or doesn't match any tab, redirect to first available tab
      if (currentPath === "/rekap-ikd" || !activeTab) {
        navigate(availableTabs[0].path, { replace: true });
      }
    }
  }, [availableTabs, activeTab, navigate, location.pathname]);

  const ActiveComponent = activeTab?.component || (() => null);

  return (
    <div className="w-full mx-auto space-y-6">
      {/* Header */}
      <div className="mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
              <svg
                className="w-6 h-6 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <div className="flex-1">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Rekap IKD
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                Kelola rekap IKD untuk semua unit kerja
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Navigation */}
      {availableTabs.length > 0 && (
        <div className="mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-wrap gap-2 overflow-x-auto">
              {availableTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => navigate(tab.path)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap ${
                    location.pathname === tab.path
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {tab.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content - Komponen sudah menggunakan RekapIKDBase sendiri */}
      {activeTab && (
        <RekapIKDBaseContext.Provider
          value={{ hideHeader: true, hideSubMenu: true }}
        >
          <ActiveComponent />
        </RekapIKDBaseContext.Provider>
      )}
    </div>
  );
};

export default RekapIKDWrapper;

