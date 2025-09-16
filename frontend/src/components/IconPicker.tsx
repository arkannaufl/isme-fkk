import React, { useState, useMemo } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import * as faSolid from "@fortawesome/free-solid-svg-icons";
import * as faRegular from "@fortawesome/free-regular-svg-icons";
import * as faBrands from "@fortawesome/free-brands-svg-icons";

interface IconPickerProps {
  value: string;
  onChange: (iconName: string) => void;
  onClose: () => void;
}

const IconPicker: React.FC<IconPickerProps> = ({
  value,
  onChange,
  onClose,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<
    "solid" | "regular" | "brands"
  >("solid");

  // Combine all icon libraries
  const allIcons = useMemo(() => {
    const solidIcons = Object.entries(faSolid).map(([name, icon]) => ({
      name,
      icon,
      category: "solid" as const,
      searchTerm: name
        .toLowerCase()
        .replace(/([A-Z])/g, " $1")
        .toLowerCase(),
    }));

    const regularIcons = Object.entries(faRegular).map(([name, icon]) => ({
      name,
      icon,
      category: "regular" as const,
      searchTerm: name
        .toLowerCase()
        .replace(/([A-Z])/g, " $1")
        .toLowerCase(),
    }));

    const brandsIcons = Object.entries(faBrands).map(([name, icon]) => ({
      name,
      icon,
      category: "brands" as const,
      searchTerm: name
        .toLowerCase()
        .replace(/([A-Z])/g, " $1")
        .toLowerCase(),
    }));

    return [...solidIcons, ...regularIcons, ...brandsIcons];
  }, []);

  // Filter icons based on search and category
  const filteredIcons = useMemo(() => {
    return allIcons
      .filter((icon) => {
        const matchesSearch =
          searchQuery === "" ||
          icon.searchTerm.includes(searchQuery.toLowerCase()) ||
          icon.name.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = icon.category === selectedCategory;
        return matchesSearch && matchesCategory;
      })
      .slice(0, 200); // Limit to 200 icons for performance
  }, [allIcons, searchQuery, selectedCategory]);

  const handleIconSelect = (iconName: string) => {
    onChange(iconName);
    onClose();
  };

  const getIconDisplayName = (iconName: string) => {
    return iconName
      .replace(/^fa/, "")
      .replace(/([A-Z])/g, " $1")
      .trim();
  };

  return (
    <div className="fixed inset-0 z-[100002] flex items-center justify-center p-4">
      {/* Overlay dengan opacity yang sama seperti modal lainnya */}
      <div
        className="fixed inset-0 z-[100002] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
        onClick={onClose}
      ></div>

      {/* Modal Content dengan z-index lebih tinggi */}
      <div className="relative bg-white dark:bg-gray-900 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-800 max-w-4xl w-full max-h-[90vh] overflow-hidden z-[100003]">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Pilih Icon
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <FontAwesomeIcon icon={faSolid.faTimes} className="text-xl" />
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Search and Category Filter */}
          <div className="mb-6 space-y-4">
            <div className="relative">
              <FontAwesomeIcon
                icon={faSolid.faSearch}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                placeholder="Cari icon..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-white"
              />
            </div>

            <div className="flex space-x-2">
              <button
                onClick={() => setSelectedCategory("solid")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === "solid"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                Solid Icons
              </button>
              <button
                onClick={() => setSelectedCategory("regular")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === "regular"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                Regular Icons
              </button>
              <button
                onClick={() => setSelectedCategory("brands")}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  selectedCategory === "brands"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                }`}
              >
                Brand Icons
              </button>
            </div>
          </div>

          {/* Icons Grid */}
          <div className="grid grid-cols-6 gap-3 max-h-96 overflow-y-auto hide-scroll">
            {filteredIcons.map((iconData) => (
              <button
                key={`${iconData.category}-${iconData.name}`}
                onClick={() =>
                  handleIconSelect(`${iconData.category}:${iconData.name}`)
                }
                className={`p-3 rounded-lg border-2 transition-all hover:border-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20 ${
                  value === `${iconData.category}:${iconData.name}`
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                    : "border-gray-200 dark:border-gray-700 hover:border-blue-300"
                }`}
                title={getIconDisplayName(iconData.name)}
              >
                <div className="flex flex-col items-center space-y-2">
                  <FontAwesomeIcon
                    icon={iconData.icon as any}
                    className="text-2xl text-gray-700 dark:text-gray-200"
                  />
                  <span className="text-xs text-gray-600 dark:text-gray-300 text-center leading-tight">
                    {getIconDisplayName(iconData.name)}
                  </span>
                </div>
              </button>
            ))}
          </div>

          {filteredIcons.length === 0 && (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              Tidak ada icon yang ditemukan untuk "{searchQuery}"
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default IconPicker;
