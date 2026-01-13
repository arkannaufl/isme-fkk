import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

// Import all icons from icons directory
import {
  BoxCubeIcon,
  ChevronDownIcon,
  HorizontaLDots,
  ListIcon,
  PieChartIcon,
  PlugInIcon,
  TableIcon,
  UserIcon,
  GroupIcon,
  PlusIcon,
  ChatIcon,
  DashboardIcon,
  HistoryIcon,
  AcademicIcon,
  PetaBlokIcon,
  DetailKeabsenanIcon,
  ServiceCenterIcon,
  WhatsAppIcon,
  NotificationsIcon,
  RekapIKDIcon,
  ManagementIcon,
} from "../icons";
import { useSidebar } from "../context/SidebarContext";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  roles?: string[];
  new?: boolean;
  subItems?: {
    name: string;
    path?: string;
    pro?: boolean;
    new?: boolean;
    roles?: string[];
    subItems?: {
      name: string;
      path: string;
      pro?: boolean;
      new?: boolean;
      roles?: string[];
    }[];
  }[];
};

// Menu items berdasarkan role
const getNavItems = (userRole?: string): NavItem[] => {
  const allItems: NavItem[] = [
    {
      icon: <DashboardIcon />,
      name: "Dashboard",
      path: "/dashboard",
      roles: ["super_admin", "dosen", "tim_akademik", "mahasiswa", "akademik", "aik", "meu", "profesi", "kemahasiswaan", "sdm", "upt_jurnal", "upt_ppm", "verifikator", "ketua_ikd"],
    },
    {
      icon: <ListIcon />,
      name: "Tahun Ajaran",
      path: "/tahun-ajaran",
      roles: ["super_admin"],
    },
    {
      icon: <AcademicIcon />,
      name: "Akademik",
      subItems: [
        {
          name: "Mata Kuliah",
          path: "/mata-kuliah",
          roles: ["super_admin", "tim_akademik"],
        },
        {
          name: "Mata Kuliah (Dosen)",
          path: "/mata-kuliah-dosen",
          roles: ["dosen"],
        },
        { name: "PBL", path: "/pbl", roles: ["super_admin", "tim_akademik"] },
        { name: "CSR", path: "/csr", roles: ["super_admin", "tim_akademik"] },
        {
          name: "Peta Akademik",
          path: "/peta-akademik",
          roles: ["super_admin", "dosen", "tim_akademik"],
        },
        {
          name: "Peta Blok",
          path: "/peta-blok",
          roles: ["super_admin", "dosen", "tim_akademik"],
        },
        {
          name: "Bimbingan Akhir",
          path: "/bimbingan-akhir",
          roles: ["dosen"],
        },

        {
          name: "Generate Mahasiswa",
          path: "/generate",
          roles: ["super_admin", "tim_akademik"],
          subItems: [
            {
              name: "Kelompok",
              path: "/generate/kelompok",
              roles: ["super_admin", "tim_akademik"],
            },
            {
              name: "Mahasiswa Veteran",
              path: "/generate/mahasiswa-veteran",
              roles: ["super_admin", "tim_akademik"],
            },
          ],
        },
      ],
      roles: ["super_admin", "dosen", "tim_akademik"],
    },

    {
      icon: <ManagementIcon />,
      name: "Manajemen",
      subItems: [
        {
          name: "User",
          roles: ["super_admin", "tim_akademik", "ketua_ikd"],
          subItems: [
            {
              name: "Tim Akademik",
              path: "/tim-akademik",
              roles: ["super_admin"],
            },
            {
              name: "Dosen",
              path: "/dosen",
              roles: ["super_admin", "tim_akademik"],
            },
            {
              name: "Mahasiswa",
              path: "/mahasiswa",
              roles: ["super_admin", "tim_akademik"],
            },
            {
              name: "User IKD",
              path: "/rekap-ikd/user-ikd",
              roles: ["super_admin", "ketua_ikd"],
            },
          ],
        },
        {
          name: "Ruangan",
          path: "/ruangan",
          roles: ["super_admin", "tim_akademik"],
        },
      ],
      roles: ["super_admin", "tim_akademik", "ketua_ikd"],
    },
    {
      icon: <HistoryIcon />,
      name: "Detail Riwayat Penugasan",
      path: "/dosen-riwayat",
      roles: ["dosen"],
    },
    {
      icon: <ChatIcon />,
      name: "Forum Diskusi",
      path: "/forum-diskusi",
      roles: ["super_admin", "dosen", "mahasiswa", "tim_akademik"],
    },
    {
      icon: <NotificationsIcon />,
      name: "Notifikasi",
      path: "/admin-notifications",
      roles: ["super_admin", "tim_akademik"],
    },
    {
      icon: <RekapIKDIcon />,
      name: "Rekap IKD",
      path: "/rekap-ikd",
      subItems: [
        {
          name: "Pedoman Poin IKD",
          path: "/rekap-ikd/pedoman-poin",
          roles: ["super_admin", "ketua_ikd", "akademik", "aik", "meu", "profesi", "kemahasiswaan", "sdm", "upt_jurnal", "upt_ppm", "verifikator"],
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
      ],
      roles: ["super_admin", "ketua_ikd", "akademik", "dosen", "aik", "meu", "profesi", "kemahasiswaan", "sdm", "upt_jurnal", "upt_ppm", "verifikator"],
    },
    {
      icon: <RekapIKDIcon />,
      name: "Rekap IKD Detail",
      path: "/rekap-ikd/detail",
      roles: ["dosen"], // Menu hanya untuk dosen, tapi route tetap bisa diakses oleh super_admin dan tim_akademik
    },
    {
      icon: <PieChartIcon />,
      name: "Reporting",
      subItems: [
        {
          name: "Reporting Dosen",
          path: "/reporting/dosen",
          roles: ["super_admin", "tim_akademik"],
        },
        {
          name: "Log Aktivitas",
          path: "/reporting/log-aktivitas",
          roles: ["super_admin", "tim_akademik"],
        },
      ],
      roles: ["super_admin", "tim_akademik"],
    },
    {
      icon: <AcademicIcon />,
      name: "Absen",
      path: "/akademik-mahasiswa",
      roles: ["mahasiswa"],
    },
    {
      icon: <AcademicIcon />,
      name: "Peta Akademik",
      path: "/peta-akademik",
      roles: ["mahasiswa"],
    },
    {
      icon: <PetaBlokIcon />,
      name: "Peta Blok",
      path: "/peta-blok",
      roles: ["mahasiswa"],
    },
    {
      icon: <ListIcon />,
      name: "Absen QR",
      path: "/mahasiswa/absensi-kuliah-besar",
      roles: ["mahasiswa"],
    },
    {
      icon: <WhatsAppIcon />,
      name: "WA Bot Management",
      path: "/whatsapp-bot-management",
      roles: ["super_admin"],
    },
    {
      icon: <ServiceCenterIcon />,
      name: "Service Center",
      path: "/service-center",
      roles: ["super_admin", "dosen", "mahasiswa", "tim_akademik"],
    },
  ];

  // Filter menu berdasarkan role
  if (!userRole) {
    return allItems;
  }

  return allItems.filter((item) => {
    // Check main item role
    if (item.roles && !item.roles.includes(userRole)) {
      return false;
    }

    // Check subItems roles (including nested subItems)
    if (item.subItems) {
      item.subItems = item.subItems.filter((subItem) => {
        // Check if subItem itself is accessible
        if (subItem.roles && !subItem.roles.includes(userRole)) {
          return false;
        }

        // Check nested subItems if they exist
        if (subItem.subItems) {
          subItem.subItems = subItem.subItems.filter(
            (nestedItem) => !nestedItem.roles || nestedItem.roles.includes(userRole)
          );
          // Only show subItem if it has accessible nested items or no nested items
          return subItem.subItems.length > 0 || !subItem.subItems;
        }

        return true;
      });

      // Only show parent if it has visible subItems
      return item.subItems.length > 0;
    }

    return true;
  });
};

const othersItems: NavItem[] = [
  {
    icon: <PieChartIcon />,
    name: "Charts",
    subItems: [
      { name: "Line Chart", path: "/line-chart", pro: false },
      { name: "Bar Chart", path: "/bar-chart", pro: false },
    ],
  },
  {
    icon: <BoxCubeIcon />,
    name: "UI Elements",
    subItems: [
      { name: "Alerts", path: "/alerts", pro: false },
      { name: "Avatar", path: "/avatars", pro: false },
      { name: "Badge", path: "/badge", pro: false },
      { name: "Buttons", path: "/buttons", pro: false },
      { name: "Images", path: "/images", pro: false },
      { name: "Videos", path: "/videos", pro: false },
    ],
  },
  {
    icon: <PlugInIcon />,
    name: "Authentication",
    subItems: [{ name: "Sign Up", path: "/signup", pro: false }],
  },
];

const AppSidebar: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const location = useLocation();

  // Get menu items berdasarkan role
  const getUser = () => {
    return JSON.parse(localStorage.getItem("user") || "{}");
  };

  const user = getUser();
  const navItems = getNavItems(user?.role);

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [openNestedMenus, setOpenNestedMenus] = useState<
    Record<string, boolean>
  >({});
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const isActive = useCallback(
    (path: string) => {
      if (
        path === "/tahun-ajaran" &&
        (location.pathname === "/" || location.pathname === "/tahun-ajaran")
      ) {
        return true;
      }
      return location.pathname === path;
    },
    [location.pathname]
  );

  const toggleNestedMenu = (menuKey: string) => {
    setOpenNestedMenus((prev) => {
      const newState = { ...prev, [menuKey]: !prev[menuKey] };

      // If opening a nested menu, ensure parent submenu is open
      if (!prev[menuKey]) {
        const [menuType, parentIndex] = menuKey.split('-');
        const parentIndexNum = parseInt(parentIndex);

        setOpenSubmenu(prevOpen => {
          if (!prevOpen || prevOpen.type !== menuType || prevOpen.index !== parentIndexNum) {
            return { type: menuType as "main" | "others", index: parentIndexNum };
          }
          return prevOpen;
        });
      }

      return newState;
    });
  };

  useEffect(() => {
    let submenuMatched = false;
    ["main", "others"].forEach((menuType) => {
      const items = menuType === "main" ? navItems : othersItems;
      items.forEach((nav, index) => {
        if (nav.subItems) {
          // Check if any of the subItems or their nested subItems are active
          const isNavSubItemOrNestedActive = nav.subItems.some(
            (subItem, subIndex) => {
              if (subItem.subItems) {
                // If subItem has nested subItems, check if any nested item is active
                return subItem.subItems.some((nestedItem) => {
                  if (isActive(nestedItem.path)) {
                    setOpenNestedMenus((prev) => ({
                      ...prev,
                      [`${menuType}-${index}-${subIndex}`]: true,
                    }));
                    return true;
                  }
                  return false;
                });
              } else {
                // If subItem does not have nested subItems, check if the subItem itself is active
                return isActive(subItem.path || "");
              }
            }
          );

          if (isNavSubItemOrNestedActive) {
            setOpenSubmenu({
              type: menuType as "main" | "others",
              index,
            });
            submenuMatched = true;
          }
        }
        // Check if current path matches the main menu item (for items without subItems)
        else if (nav.path && isActive(nav.path)) {
          setOpenSubmenu({
            type: menuType as "main" | "others",
            index,
          });
          submenuMatched = true;
        }
      });
    });

    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [location, isActive]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        // Close submenu and reset all nested menus
        Object.keys(openNestedMenus).forEach(key => {
          if (key.startsWith(`${menuType}-${index}-`)) {
            setOpenNestedMenus(prev => ({ ...prev, [key]: false }));
          }
        });
        return null;
      }
      return { type: menuType, index };
    });
  };

  const renderNestedSubMenuItems = (
    subItems: NavItem["subItems"],
    parentKey: string
  ) => (
    <ul className="mt-2 space-y-1 ml-9">
      {subItems?.map((subItem, index) => (
        <li key={subItem.name}>
          {subItem.subItems ? (
            <div>
              <button
                onClick={() => toggleNestedMenu(`${parentKey}-${index}`)}
                className={`menu-dropdown-item w-full text-left ${isActive(subItem.path || "")
                  ? "menu-dropdown-item-active"
                  : "menu-dropdown-item-inactive"
                  }`}
              >
                {subItem.name}
                <ChevronDownIcon
                  className={`ml-auto w-4 h-4 transition-transform duration-300 ease-in-out ${openNestedMenus[`${parentKey}-${index}`] ? "rotate-180" : ""
                    }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${openNestedMenus[`${parentKey}-${index}`]
                  ? "max-h-96 opacity-100"
                  : "max-h-0 opacity-0"
                  }`}
              >
                <ul className="mt-2 space-y-1 ml-4">
                  {subItem.subItems.map((nestedItem) => (
                    <li key={nestedItem.name}>
                      <Link
                        to={nestedItem.path}
                        className={`menu-dropdown-item ${isActive(nestedItem.path)
                          ? "menu-dropdown-item-active"
                          : "menu-dropdown-item-inactive"
                          }`}
                      >
                        {nestedItem.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <Link
              to={subItem.path || "#"}
              className={`menu-dropdown-item ${isActive(subItem.path || "")
                ? "menu-dropdown-item-active"
                : "menu-dropdown-item-inactive"
                }`}
            >
              <span className="flex items-center gap-2">
                {subItem.name}
                {subItem.new && (
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                    New
                  </span>
                )}
              </span>
            </Link>
          )}
        </li>
      ))}
    </ul>
  );

  const renderMenuItems = (items: NavItem[], menuType: "main" | "others") => (
    <ul className="flex flex-col gap-4">
      {items.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group ${openSubmenu?.type === menuType && openSubmenu?.index === index
                ? "menu-item-active"
                : "menu-item-inactive"
                } cursor-pointer ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
                }`}
            >
              <span
                className={`menu-item-icon-size  ${openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-icon-active"
                  : "menu-item-icon-inactive"
                  }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span className="menu-item-text flex items-center gap-2">
                  {nav.name}
                  {nav.new && (
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                      New
                    </span>
                  )}
                </span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                    ? "rotate-180 text-brand-500"
                    : ""
                    }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                to={nav.path}
                className={`menu-item group ${isActive(nav.path)
                  ? "bg-brand-100 text-brand-700 dark:bg-brand-900/80 dark:text-brand-300 font-semibold"
                  : "menu-item-inactive"
                  }`}
              >
                <span
                  className={`menu-item-icon-size ${isActive(nav.path)
                    ? "text-brand-700 dark:text-brand-300"
                    : "menu-item-icon-inactive"
                    }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span className="menu-item-text flex items-center gap-2">
                    {nav.name}
                    {nav.new && (
                      <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300">
                        New
                      </span>
                    )}
                  </span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className={`overflow-hidden transition-all duration-300 ease-in-out ${openSubmenu?.type === menuType && openSubmenu?.index === index
                ? "max-h-96 opacity-100"
                : "max-h-0 opacity-0"
                }`}
            >
              {renderNestedSubMenuItems(nav.subItems, `${menuType}-${index}`)}
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  return (
    <aside
      className={`fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-white dark:bg-gray-900 dark:border-gray-800 text-gray-900 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 
        ${isExpanded || isMobileOpen
          ? "w-[290px]"
          : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 flex ${!isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
          }`}
      >
        <Link to="/">
          <div className="flex items-center gap-3">
            <img
              src="/images/logo/logo-isme-icon.svg"
              alt="Logo"
              width={40}
              height={40}
            />
            {(isExpanded || isHovered || isMobileOpen) && (
              <span className="text-2xl font-semibold text-gray-900 dark:text-white">
                ISME
              </span>
            )}
          </div>
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${!isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "justify-start"
                  }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots className="size-6" />
                )}
              </h2>
              {renderMenuItems(navItems, "main")}
            </div>
          </div>
        </nav>
      </div>
    </aside>
  );
};

export default AppSidebar;
