import React, { useMemo, createContext, useContext } from "react";
import { useNavigate, useLocation } from "react-router";

// Context untuk menyembunyikan header dan sub-menu saat digunakan dalam wrapper
const RekapIKDBaseContext = createContext<{
  hideHeader?: boolean;
  hideSubMenu?: boolean;
}>({});

interface RekapIKDBaseProps {
  title: string;
  description: string;
  children?: React.ReactNode;
  hideHeader?: boolean;
  hideSubMenu?: boolean;
}

const RekapIKDBase: React.FC<RekapIKDBaseProps> = ({
  title,
  description,
  children,
  hideHeader: propHideHeader = false,
  hideSubMenu: propHideSubMenu = false,
}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const context = useContext(RekapIKDBaseContext);
  
  // Gunakan props jika ada, jika tidak gunakan context
  const hideHeader = propHideHeader || context.hideHeader || false;
  const hideSubMenu = propHideSubMenu || context.hideSubMenu || false;

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

  // Filter menus based on user role
  const subMenus = useMemo(() => {
    if (!userRole) return [];

    // All available menus
    const allMenus = [
      {
        name: "Pedoman Poin IKD",
        path: "/rekap-ikd/pedoman-poin",
        roles: ["super_admin", "ketua_ikd", "akademik", "dosen", "aik", "meu", "profesi", "kemahasiswaan", "sdm", "upt_jurnal", "upt_ppm", "verifikator"],
      },
      {
        name: "Akademik",
        path: "/rekap-ikd/tim-akademik",
        roles: ["super_admin", "ketua_ikd", "akademik"],
      },
      {
        name: "Dosen",
        path: "/rekap-ikd/dosen",
        roles: ["super_admin", "ketua_ikd", "verifikator", "dosen"],
      },
      {
        name: "AIK",
        path: "/rekap-ikd/aik",
        roles: ["super_admin", "ketua_ikd", "aik"],
      },
      {
        name: "MEU",
        path: "/rekap-ikd/meu",
        roles: ["super_admin", "ketua_ikd", "meu"],
      },
      {
        name: "Profesi",
        path: "/rekap-ikd/profesi",
        roles: ["super_admin", "ketua_ikd", "profesi"],
      },
      {
        name: "Kemahasiswaan",
        path: "/rekap-ikd/kemahasiswaan",
        roles: ["super_admin", "ketua_ikd", "kemahasiswaan"],
      },
      {
        name: "SDM",
        path: "/rekap-ikd/sdm",
        roles: ["super_admin", "ketua_ikd", "sdm"],
      },
      {
        name: "UPT Jurnal",
        path: "/rekap-ikd/upt-jurnal",
        roles: ["super_admin", "ketua_ikd", "upt_jurnal"],
      },
      {
        name: "UPT PPM",
        path: "/rekap-ikd/upt-ppm",
        roles: ["super_admin", "ketua_ikd", "upt_ppm"],
      },
    ];

    // ketua_ikd can access all menus
    if (userRole === "ketua_ikd") {
      return allMenus;
    }

    // Filter menus based on role
    return allMenus.filter((menu) => menu.roles.includes(userRole));
  }, [userRole]);

  return (
    <div className="space-y-8">
      {/* Header */}
      {!hideHeader && (
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
                  {title}
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  {description}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Sub Menu Navigation */}
      {!hideSubMenu && (
        <div className="mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-4">
            <div className="flex flex-wrap gap-2">
              {subMenus.map((menu) => (
                <button
                  key={menu.path}
                  onClick={() => navigate(menu.path)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    location.pathname === menu.path
                      ? "bg-blue-500 text-white"
                      : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600"
                  }`}
                >
                  {menu.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Content */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-8">
        {children || (
          <div className="prose dark:prose-invert max-w-none">
            <p className="text-gray-600 dark:text-gray-400">
              Halaman sedang dalam pengembangan. Konten akan segera ditambahkan.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export { RekapIKDBaseContext };
export default RekapIKDBase;
