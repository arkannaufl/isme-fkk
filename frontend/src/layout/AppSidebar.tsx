import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router";

// Assume these icons are imported from an icon library
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
} from "../icons";

// Dashboard icon component
const DashboardIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
    />
  </svg>
);

// History icon component
const HistoryIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
    />
  </svg>
);

// Peta Akademik icon component (Calendar/Grid icon)
const PetaAkademikIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
    />
  </svg>
);

// Peta Blok icon component (Blocks/Cubes icon)
const PetaBlokIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
    />
  </svg>
);

// Detail Keabsenan icon component (Single person icon)
const DetailKeabsenanIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
    />
  </svg>
);

// Service Center icon component (Exclamation mark/Alert icon)
const ServiceCenterIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"
    />
  </svg>
);

// WhatsApp icon component
const WhatsAppIcon = () => (
  <svg
    className="w-5 h-5"
    fill="currentColor"
    viewBox="0 0 24 24"
  >
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
  </svg>
);

// Notifications icon component (Bell icon)
const NotificationsIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
    />
  </svg>
);

// Rekap IKD icon component (Chart/Report icon)
const RekapIKDIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={1.5}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);
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
      roles: ["super_admin", "dosen", "tim_akademik", "mahasiswa"],
    },
    {
      icon: <ListIcon />,
      name: "Tahun Ajaran",
      path: "/tahun-ajaran",
      roles: ["super_admin"],
    },
    {
      icon: <TableIcon />,
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
      ],
      roles: ["super_admin", "dosen", "tim_akademik"],
    },
    {
      icon: <PlusIcon />,
      name: "Generate Mahasiswa",
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
      roles: ["super_admin", "tim_akademik"],
    },
    {
      icon: <UserIcon />,
      name: "Manajemen Pengguna",
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
      roles: ["super_admin", "tim_akademik", "ketua_ikd"],
    },
    {
      icon: <BoxCubeIcon />,
      name: "Ruangan",
      path: "/ruangan",
      roles: ["super_admin", "tim_akademik"],
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
      new: true,
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
          path: "/reporting/histori",
          roles: ["super_admin"],
        },
      ],
      roles: ["super_admin", "tim_akademik"],
    },
    {
      icon: <ListIcon />,
      name: "Mata Kuliah",
      path: "/mata-kuliah-mahasiswa",
      roles: ["mahasiswa"],
    },
    {
      icon: <PieChartIcon />,
      name: "Nilai Akademik",
      path: "/nilai-mahasiswa",
      roles: ["mahasiswa"],
    },
    {
      icon: <PetaAkademikIcon />,
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
      icon: <DetailKeabsenanIcon />,
      name: "Detail Keabsenan",
      path: "/detail-mahasiswa-keabsenan",
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
      name: "WhatsApp Bot",
      path: "/whatsapp-test",
      roles: ["super_admin"],
    },
    {
      icon: <ServiceCenterIcon />,
      name: "Service Center",
      path: "/support-center",
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

    // Check subItems roles
    if (item.subItems) {
      item.subItems = item.subItems.filter(
        (subItem) => !subItem.roles || subItem.roles.includes(userRole)
      );
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
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
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
    setOpenNestedMenus((prev) => ({
      ...prev,
      [menuKey]: !prev[menuKey],
    }));
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

  useEffect(() => {
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        requestAnimationFrame(() => {
          setTimeout(() => {
            setSubMenuHeight((prevHeights) => ({
              ...prevHeights,
              [key]: subMenuRefs.current[key]?.scrollHeight || 0,
            }));
          }, 0);
        });
      }
    }
  }, [openSubmenu, openNestedMenus]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
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
                className={`menu-dropdown-item w-full text-left ${
                  isActive(subItem.path || "")
                    ? "menu-dropdown-item-active"
                    : "menu-dropdown-item-inactive"
                }`}
              >
                {subItem.name}
                <ChevronDownIcon
                  className={`ml-auto w-4 h-4 transition-transform duration-300 ease-in-out ${
                    openNestedMenus[`${parentKey}-${index}`] ? "rotate-180" : ""
                  }`}
                />
              </button>
              <div
                className={`overflow-hidden transition-all duration-300 ease-in-out ${
                  openNestedMenus[`${parentKey}-${index}`]
                    ? "max-h-[500px] opacity-100"
                    : "max-h-0 opacity-0"
                }`}
              >
                <ul className="mt-2 space-y-1 ml-4">
                  {subItem.subItems.map((nestedItem) => (
                    <li key={nestedItem.name}>
                      <Link
                        to={nestedItem.path}
                        className={`menu-dropdown-item ${
                          isActive(nestedItem.path)
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
              className={`menu-dropdown-item ${
                isActive(subItem.path || "")
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
              className={`menu-item group ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "menu-item-active"
                  : "menu-item-inactive"
              } cursor-pointer ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
            >
              <span
                className={`menu-item-icon-size  ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
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
                  className={`ml-auto w-5 h-5 transition-transform duration-200 ${
                    openSubmenu?.type === menuType &&
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
                className={`menu-item group ${
                  isActive(nav.path)
                    ? "bg-brand-100 text-brand-700 dark:bg-brand-900/80 dark:text-brand-300 font-semibold"
                    : "menu-item-inactive"
                }`}
              >
                <span
                  className={`menu-item-icon-size ${
                    isActive(nav.path)
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
              className="overflow-hidden transition-all duration-300"
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
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
        ${
          isExpanded || isMobileOpen
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
        className={`py-8 flex ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
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
                className={`mb-4 text-xs uppercase flex leading-[20px] text-gray-400 ${
                  !isExpanded && !isHovered
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
        {/* Hapus SidebarWidget agar tidak error */}
      </div>
    </aside>
  );
};

export default AppSidebar;
