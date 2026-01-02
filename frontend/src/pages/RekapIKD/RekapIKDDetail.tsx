import React, { useState, useEffect, useCallback } from "react";
import api, { getUser } from "../../utils/api";
import { motion } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faChartBar,
  faFileAlt,
  faDownload,
  faInfoCircle,
  faChevronDown,
  faChevronUp,
  faArrowLeft,
  faFileExcel,
  faFilePdf,
} from "@fortawesome/free-solid-svg-icons";
import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { addWatermarkToAllPages } from "../../utils/watermarkHelper";

interface IKDPedoman {
  id: number;
  no: string;
  kegiatan: string;
  indeks_poin?: number;
  unit_kerja?: string;
  bukti_fisik?: string;
  prosedur?: string;
  bidang: string;
  bidang_nama?: string;
  parent_id?: number;
  level: number;
  is_active: boolean;
}

interface IKDBuktiFisik {
  id: number;
  user_id: number;
  ikd_pedoman_id: number;
  unit?: string | null;
  file_path: string;
  file_name: string;
  file_type?: string;
  file_size?: number;
  file_url?: string;
  skor?: number | null;
  pedoman?: IKDPedoman;
}

interface BidangData {
  bidang: string;
  bidangNama: string;
  totalHasil: number;
  kegiatanCount: number;
}

interface UnitData {
  unit: string;
  pedomanList: IKDPedoman[];
  buktiFisikMap: { [key: number]: IKDBuktiFisik }; // Key: `ikd_pedoman_id` (number)
  totalHasil: number;
  kegiatanCount: number; // Jumlah kegiatan yang sudah ada file atau skor > 0
  bidangDataMap: { [key: string]: BidangData }; // Key: bidang code (A, B, D, etc.)
}

const UNIT_LIST = [
  "Akademik",
  "Dosen",
  "MEU",
  "Profesi",
  "AIK",
  "Kemahasiswaan",
  "SDM",
  "UPT Jurnal",
  "UPT PPM",
];

// Helper function to check if a pedoman belongs to a specific unit
const isPedomanInUnit = (pedoman: IKDPedoman, unit: string): boolean => {
  const pedomanUnitKerja = (pedoman.unit_kerja || "").toLowerCase().trim();
  const currentUnitLower = unit.toLowerCase().trim();

  // Split unit_kerja by comma and check if current unit is in the list
  const unitKerjaList = pedomanUnitKerja
    .split(",")
    .map((u: string) => u.trim().toLowerCase())
    .filter((u: string) => u.length > 0);

  return unitKerjaList.includes(currentUnitLower);
};

// Helper function to download file using API endpoint
const handleDownloadFile = async (fileId: number, fileName: string) => {
  try {
    const response = await api.get(
      `/rekap-ikd/bukti-fisik/${fileId}/download`,
      {
        responseType: "blob",
      }
    );

    // Create blob from response
    const blob = new Blob([response.data]);
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error downloading file:", error);
    alert("Gagal mengunduh file. Silakan coba lagi.");
  }
};

interface UserInfo {
  id: number;
  name: string;
  username?: string;
  email?: string;
  nid?: string;
  nidn?: string;
  telp?: string;
  role?: string;
}

const RekapIKDDetail: React.FC = () => {
  const [unitDataMap, setUnitDataMap] = useState<{
    [key: string]: UnitData;
  }>({});
  const [loading, setLoading] = useState(true);
  const [expandedUnits, setExpandedUnits] = useState<Set<string>>(new Set());
  const isInitialLoadRef = React.useRef(true);
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const fetchingUserInfoRef = React.useRef(false);

  // Get current user - memoize to prevent unnecessary re-renders
  const currentUser = React.useMemo(() => getUser(), []);
  const currentUserRole = currentUser?.role || "";

  // Check if user is superadmin or tim_akademik
  const isSuperAdminOrTimAkademik =
    currentUserRole === "super_admin" || currentUserRole === "tim_akademik";

  // Jika ada query parameter user_id dan user adalah super_admin atau tim_akademik, gunakan user_id tersebut
  // Jika tidak, gunakan user yang login
  const targetUserIdParam = searchParams.get("user_id");
  const targetUserId =
    (currentUserRole === "super_admin" || currentUserRole === "tim_akademik") &&
    targetUserIdParam
      ? parseInt(targetUserIdParam, 10)
      : currentUser?.id;

  const userId = targetUserId;

  // Fetch data for all units
  const fetchAllUnitsData = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }

    try {
      // Only set loading on initial load, not on refresh
      if (isInitialLoadRef.current) {
        setLoading(true);
        isInitialLoadRef.current = false;
      }
      const newUnitDataMap: { [key: string]: UnitData } = {};

      // Fetch data for each unit
      for (const unit of UNIT_LIST) {
        try {
          // Fetch pedoman poin for this unit
          const pedomanRes = await api.get(
            `/rekap-ikd/pedoman-poin/unit/${encodeURIComponent(unit)}`
          );
          const pedomanList: IKDPedoman[] =
            pedomanRes.data?.success && pedomanRes.data?.data
              ? pedomanRes.data.data
              : [];

          // Fetch bukti fisik for current user in this unit
          const buktiFisikRes = await api.get(
            `/rekap-ikd/bukti-fisik?user_id=${userId}&unit=${encodeURIComponent(
              unit
            )}`
          );
          const buktiFisikArray: IKDBuktiFisik[] =
            buktiFisikRes.data?.success && buktiFisikRes.data?.data
              ? buktiFisikRes.data.data
              : [];

          // Create bukti fisik map by pedoman_id (use number as key)
          // Hanya map bukti fisik yang pedoman-nya benar-benar termasuk dalam unit ini
          // Juga include data yang unit-nya NULL untuk backward compatibility
          const buktiFisikMap: { [key: number]: IKDBuktiFisik } = {};
          buktiFisikArray.forEach((bf) => {
            // Jika bukti fisik punya unit, pastikan unit-nya sesuai
            // Jika unit-nya NULL (data lama), verifikasi berdasarkan pedoman
            if (bf.unit) {
              // Data baru: hanya map jika unit-nya sesuai
              if (bf.unit === unit) {
                buktiFisikMap[bf.ikd_pedoman_id] = bf;
              }
            } else {
              // Data lama (unit NULL): verifikasi berdasarkan pedoman unit_kerja
              let pedomanToCheck: IKDPedoman | null = null;

              if (bf.pedoman) {
                // Buat temporary pedoman object untuk menggunakan helper function
                pedomanToCheck = {
                  id: bf.pedoman.id,
                  no: bf.pedoman.no || "",
                  kegiatan: bf.pedoman.kegiatan || "",
                  indeks_poin: bf.pedoman.indeks_poin,
                  unit_kerja: bf.pedoman.unit_kerja,
                  bukti_fisik: bf.pedoman.bukti_fisik,
                  prosedur: bf.pedoman.prosedur,
                  bidang: bf.pedoman.bidang || "",
                  bidang_nama: bf.pedoman.bidang_nama,
                  parent_id: bf.pedoman.parent_id,
                  level: bf.pedoman.level || 1,
                  is_active:
                    bf.pedoman.is_active !== undefined
                      ? bf.pedoman.is_active
                      : true,
                };
              } else {
                // Jika pedoman tidak di-load, gunakan pedoman dari pedomanList untuk verifikasi
                pedomanToCheck =
                  pedomanList.find((p) => p.id === bf.ikd_pedoman_id) || null;
              }

              // Hanya map jika pedoman ditemukan dan unit saat ini ada di unit_kerja pedoman
              if (pedomanToCheck) {
                const isInUnit = isPedomanInUnit(pedomanToCheck, unit);
                if (isInUnit) {
                  buktiFisikMap[bf.ikd_pedoman_id] = bf;
                }
              }
            }
          });

          // Calculate total hasil and count kegiatan yang sudah ada file/skor
          // Hanya hitung untuk pedoman yang benar-benar termasuk dalam unit ini
          let totalHasil = 0;
          let kegiatanCount = 0;
          const bidangDataMap: { [key: string]: BidangData } = {};

          pedomanList.forEach((pedoman) => {
            // Hanya proses jika unit saat ini ada di unit_kerja pedoman
            if (isPedomanInUnit(pedoman, unit)) {
              const buktiFisik = buktiFisikMap[pedoman.id];
              if (buktiFisik && buktiFisik.skor) {
                const skor = Number(buktiFisik.skor) || 0;
                // Hitung kegiatan jika ada file dan skor > 0
                if (skor > 0) {
                  kegiatanCount++;
                  if (pedoman.indeks_poin) {
                    const indeksPoin = Number(pedoman.indeks_poin) || 0;
                    const hasil = indeksPoin * skor;
                    totalHasil += hasil;

                    // Hitung per bidang
                    const bidangCode = (pedoman.bidang || "")
                      .trim()
                      .toUpperCase();
                    if (bidangCode) {
                      if (!bidangDataMap[bidangCode]) {
                        bidangDataMap[bidangCode] = {
                          bidang: bidangCode,
                          bidangNama: pedoman.bidang_nama || bidangCode,
                          totalHasil: 0,
                          kegiatanCount: 0,
                        };
                      }
                      bidangDataMap[bidangCode].totalHasil += hasil;
                      bidangDataMap[bidangCode].kegiatanCount += 1;
                    }
                  }
                }
              }
            }
          });

          newUnitDataMap[unit] = {
            unit,
            pedomanList,
            buktiFisikMap,
            totalHasil,
            kegiatanCount,
            bidangDataMap,
          };
        } catch (error: unknown) {
          console.error(`Error fetching data for unit ${unit}:`, error);
          // Jika error 401 (Unauthorized), jangan set empty data karena akan trigger logout
          // Biarkan error propagate ke interceptor untuk handling yang tepat
          if (error && typeof error === "object" && "response" in error) {
            const axiosError = error as { response?: { status?: number } };
            if (axiosError.response?.status === 401) {
              // Error 401 akan di-handle oleh interceptor, tidak perlu set empty data
              throw error;
            }
          }
          // Untuk error lain (403, 404, dll), set empty data untuk unit ini
          newUnitDataMap[unit] = {
            unit,
            pedomanList: [],
            buktiFisikMap: {},
            totalHasil: 0,
            kegiatanCount: 0,
            bidangDataMap: {},
          };
        }
      }

      setUnitDataMap(newUnitDataMap);
      setLoading(false);
    } catch (error: unknown) {
      console.error("Error fetching all units data:", error);
      // Jika error 401 (Unauthorized), biarkan interceptor handle logout
      // Jangan set loading false karena akan redirect ke login
      if (error && typeof error === "object" && "response" in error) {
        const axiosError = error as { response?: { status?: number } };
        if (axiosError.response?.status === 401) {
          // Error 401 akan di-handle oleh interceptor, tidak perlu set loading false
          // Interceptor akan clear token dan redirect ke login
          return;
        }
      }
      // Untuk error lain, set loading false
      setLoading(false);
    }
  }, [userId]);

  // Store fetch function in ref to avoid dependency issues
  const fetchAllUnitsDataRef = React.useRef(fetchAllUnitsData);
  useEffect(() => {
    fetchAllUnitsDataRef.current = fetchAllUnitsData;
  }, [fetchAllUnitsData]);

  // Fetch user info - only when userId changes, with guard to prevent multiple calls
  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!userId) return;

      // Prevent multiple simultaneous calls
      if (fetchingUserInfoRef.current) {
        return;
      }

      fetchingUserInfoRef.current = true;

      try {
        const res = await api.get(`/users/${userId}`);
        if (res.data) {
          setUserInfo({
            id: res.data.id,
            name: res.data.name,
            username: res.data.username,
            email: res.data.email,
            nid: res.data.nid,
            nidn: res.data.nidn,
            telp: res.data.telp,
            role: res.data.role,
          });
        }
      } catch (error: unknown) {
        console.error("Error fetching user info:", error);
        // Jika error 401 (Unauthorized), jangan fallback karena akan trigger logout
        // Biarkan error propagate ke interceptor untuk handling yang tepat
        if (error && typeof error === "object" && "response" in error) {
          const axiosError = error as { response?: { status?: number } };
          if (axiosError.response?.status === 401) {
            // Error 401 akan di-handle oleh interceptor
            fetchingUserInfoRef.current = false;
            return;
          }
        }
        // Fallback to currentUser from localStorage if viewing own data (hanya untuk error selain 401)
        if (currentUser && userId === currentUser.id) {
          setUserInfo({
            id: currentUser.id,
            name: currentUser.name,
            username: currentUser.username,
            email: currentUser.email,
            nid: currentUser.nid,
            nidn: currentUser.nidn,
            telp: currentUser.telp,
            role: currentUser.role,
          });
        }
      } finally {
        fetchingUserInfoRef.current = false;
      }
    };

    fetchUserInfo();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]); // Removed currentUser from dependencies to prevent infinite loop

  // Initial fetch
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    fetchAllUnitsDataRef.current();
  }, [userId]);

  // Realtime update with longer interval to reduce reload
  useEffect(() => {
    if (!userId) return;

    // Set up interval for realtime update (every 30 seconds instead of 5)
    const interval = setInterval(() => {
      fetchAllUnitsDataRef.current();
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [userId]);

  // Calculate grand total
  const grandTotal = Object.values(unitDataMap).reduce(
    (sum, unitData) => sum + unitData.totalHasil,
    0
  );

  // Calculate total per bidang (global - dari semua unit)
  const globalBidangDataMap: { [key: string]: BidangData } = {};
  Object.values(unitDataMap).forEach((unitData) => {
    Object.values(unitData.bidangDataMap).forEach((bidangData) => {
      if (!globalBidangDataMap[bidangData.bidang]) {
        globalBidangDataMap[bidangData.bidang] = {
          bidang: bidangData.bidang,
          bidangNama: bidangData.bidangNama,
          totalHasil: 0,
          kegiatanCount: 0,
        };
      }
      globalBidangDataMap[bidangData.bidang].totalHasil +=
        bidangData.totalHasil;
      globalBidangDataMap[bidangData.bidang].kegiatanCount +=
        bidangData.kegiatanCount;
    });
  });

  // Sort bidang by code (A, B, C, D, etc.)
  const sortedGlobalBidangList = Object.values(globalBidangDataMap).sort(
    (a, b) => a.bidang.localeCompare(b.bidang)
  );

  // Toggle unit expansion
  const toggleUnit = (unit: string) => {
    setExpandedUnits((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(unit)) {
        newSet.delete(unit);
      } else {
        newSet.add(unit);
      }
      return newSet;
    });
  };

  // Get unit color
  const getUnitColor = (unit: string) => {
    const colors: { [key: string]: string } = {
      Akademik: "bg-blue-500",
      Dosen: "bg-yellow-500",
      MEU: "bg-green-500",
      Profesi: "bg-purple-500",
      AIK: "bg-orange-500",
      Kemahasiswaan: "bg-pink-500",
      SDM: "bg-indigo-500",
      "UPT Jurnal": "bg-teal-500",
      "UPT PPM": "bg-cyan-500",
    };
    return colors[unit] || "bg-gray-500";
  };

  // Export to Excel
  const exportToExcel = async () => {
    try {
      const wb = XLSX.utils.book_new();

      // 1. Summary Sheet - Total per Bidang dan Grand Total
      const summaryData: (string | number)[][] = [
        ["REKAP IKD DETAIL - RINGKASAN"],
        [""],
        ["Informasi Dosen"],
        ["Nama", userInfo?.name || "-"],
        ["NID", userInfo?.nid || "-"],
        ["NIDN", userInfo?.nidn || "-"],
        ["Email", userInfo?.email || "-"],
        ["No. Telepon", userInfo?.telp || "-"],
        [""],
        ["GRAND TOTAL KESELURUHAN", grandTotal.toFixed(2)],
        [""],
        ["Total per Bidang (Semua Unit)"],
        ["Bidang", "Nama Bidang", "Total Hasil", "Jumlah Kegiatan"],
      ];

      sortedGlobalBidangList.forEach((bidangData) => {
        summaryData.push([
          bidangData.bidang,
          bidangData.bidangNama,
          bidangData.totalHasil.toFixed(2),
          bidangData.kegiatanCount,
        ]);
      });

      summaryData.push([""]);
      summaryData.push(["Total per Unit"]);
      summaryData.push(["Unit", "Total Hasil", "Jumlah Kegiatan"]);

      UNIT_LIST.forEach((unit) => {
        const unitData = unitDataMap[unit];
        if (unitData) {
          summaryData.push([
            unit,
            unitData.totalHasil.toFixed(2),
            unitData.kegiatanCount,
          ]);
        }
      });

      summaryData.push([""]);
      summaryData.push(["Tanggal Export", new Date().toLocaleString("id-ID")]);

      const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
      summaryWs["!cols"] = [{ wch: 30 }, { wch: 30 }, { wch: 15 }, { wch: 15 }];

      // Style summary header
      if (summaryWs["A1"]) {
        summaryWs["A1"].s = {
          font: { bold: true, size: 16, color: { rgb: "FFFFFF" } },
          fill: { fgColor: { rgb: "2F5597" } },
          alignment: { horizontal: "center", vertical: "center" },
        };
      }

      XLSX.utils.book_append_sheet(wb, summaryWs, "Ringkasan");

      // 2. Detail per Unit - Create one sheet per unit
      UNIT_LIST.forEach((unit) => {
        const unitData = unitDataMap[unit];
        if (!unitData || unitData.kegiatanCount === 0) return;

        const unitDetailData: (string | number)[][] = [
          [`REKAP IKD DETAIL - ${unit.toUpperCase()}`],
          [""],
          ["Informasi Dosen"],
          ["Nama", userInfo?.name || "-"],
          ["NID", userInfo?.nid || "-"],
          ["NIDN", userInfo?.nidn || "-"],
          [""],
          ["Total Unit " + unit, unitData.totalHasil.toFixed(2)],
          ["Jumlah Kegiatan", unitData.kegiatanCount],
          [""],
          ["Total per Bidang (Unit " + unit + ")"],
          ["Bidang", "Nama Bidang", "Total Hasil", "Jumlah Kegiatan"],
        ];

        // Add bidang breakdown for this unit
        Object.values(unitData.bidangDataMap)
          .sort((a, b) => a.bidang.localeCompare(b.bidang))
          .forEach((bidangData) => {
            unitDetailData.push([
              bidangData.bidang,
              bidangData.bidangNama,
              bidangData.totalHasil.toFixed(2),
              bidangData.kegiatanCount,
            ]);
          });

        unitDetailData.push([""]);
        unitDetailData.push([
          "No",
          "Bidang",
          "Kegiatan",
          "Indeks Poin",
          "Skor",
          "Hasil",
          "File Name",
        ]);

        // Add detail rows
        unitData.pedomanList.forEach((pedoman) => {
          if (!isPedomanInUnit(pedoman, unit)) return;

          const buktiFisik = unitData.buktiFisikMap[pedoman.id];
          const skor = Number(buktiFisik?.skor) || 0;
          if (skor === 0) return;

          const indeksPoin = Number(pedoman.indeks_poin) || 0;
          const hasil = indeksPoin * skor;

          unitDetailData.push([
            pedoman.no,
            pedoman.bidang || "",
            pedoman.kegiatan,
            indeksPoin.toFixed(2),
            skor,
            hasil.toFixed(2),
            buktiFisik?.file_name || "-",
          ]);
        });

        unitDetailData.push([""]);
        unitDetailData.push([
          "Total " + unit,
          "",
          "",
          "",
          "",
          unitData.totalHasil.toFixed(2),
          "",
        ]);

        const unitWs = XLSX.utils.aoa_to_sheet(unitDetailData);
        unitWs["!cols"] = [
          { wch: 10 },
          { wch: 8 },
          { wch: 60 },
          { wch: 12 },
          { wch: 8 },
          { wch: 12 },
          { wch: 40 },
        ];

        // Style unit header
        if (unitWs["A1"]) {
          unitWs["A1"].s = {
            font: { bold: true, size: 14, color: { rgb: "FFFFFF" } },
            fill: { fgColor: { rgb: "4472C4" } },
            alignment: { horizontal: "center", vertical: "center" },
          };
        }

        // Style column headers
        const headerRow = unitDetailData.findIndex((row) => row[0] === "No");
        if (headerRow !== -1) {
          const headerRowNum = headerRow + 1; // +1 karena array 0-based, Excel 1-based
          ["A", "B", "C", "D", "E", "F", "G"].forEach((col) => {
            const cellAddress = `${col}${headerRowNum}`;
            if (unitWs[cellAddress]) {
              unitWs[cellAddress].s = {
                font: { bold: true, color: { rgb: "FFFFFF" } },
                fill: { fgColor: { rgb: "4472C4" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                  top: { style: "thin", color: { rgb: "000000" } },
                  bottom: { style: "thin", color: { rgb: "000000" } },
                  left: { style: "thin", color: { rgb: "000000" } },
                  right: { style: "thin", color: { rgb: "000000" } },
                },
              };
            }
          });
        }

        XLSX.utils.book_append_sheet(wb, unitWs, unit.substring(0, 31)); // Excel sheet name max 31 chars
      });

      // Generate filename
      const now = new Date();
      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
      const fileName = `Rekap_IKD_Detail_${
        userInfo?.name || "User"
      }_${timestamp}.xlsx`;

      // Download file
      XLSX.writeFile(wb, fileName);
    } catch (error) {
      console.error("Error exporting to Excel:", error);
      alert("Gagal mengekspor data ke Excel. Silakan coba lagi.");
    }
  };

  // Export to PDF
  const exportToPDF = async () => {
    try {
      const doc = new jsPDF("l", "mm", "a4"); // Landscape orientation

      let yPos = 10;

      // Header
      doc.setFontSize(18);
      doc.setFont("helvetica", "bold");
      doc.text("REKAP IKD DETAIL", 14, yPos);
      yPos += 8;

      // Informasi Dosen
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Informasi Dosen", 14, yPos);
      yPos += 6;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Nama: ${userInfo?.name || "-"}`, 14, yPos);
      yPos += 5;
      if (userInfo?.nid) {
        doc.text(`NID: ${userInfo.nid}`, 14, yPos);
        yPos += 5;
      }
      if (userInfo?.nidn) {
        doc.text(`NIDN: ${userInfo.nidn}`, 14, yPos);
        yPos += 5;
      }
      yPos += 3;

      // Grand Total
      doc.setFontSize(14);
      doc.setFont("helvetica", "bold");
      doc.text(`GRAND TOTAL KESELURUHAN: ${grandTotal.toFixed(2)}`, 14, yPos);
      yPos += 8;

      // Total per Bidang
      if (sortedGlobalBidangList.length > 0) {
        doc.setFontSize(12);
        doc.setFont("helvetica", "bold");
        doc.text("Total per Bidang (Semua Unit)", 14, yPos);
        yPos += 6;

        const bidangTableData = sortedGlobalBidangList.map((bidangData) => [
          bidangData.bidang,
          bidangData.bidangNama,
          bidangData.totalHasil.toFixed(2),
          bidangData.kegiatanCount.toString(),
        ]);

        autoTable(doc, {
          startY: yPos,
          head: [["Bidang", "Nama Bidang", "Total Hasil", "Jumlah Kegiatan"]],
          body: bidangTableData,
          theme: "striped",
          headStyles: { fillColor: [47, 85, 151] },
          styles: { fontSize: 9 },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        yPos = (doc as any).lastAutoTable.finalY + 10;
      }

      // Total per Unit
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("Total per Unit", 14, yPos);
      yPos += 6;

      const unitTableData = UNIT_LIST.map((unit) => {
        const unitData = unitDataMap[unit];
        return [
          unit,
          unitData ? unitData.totalHasil.toFixed(2) : "0.00",
          unitData ? unitData.kegiatanCount.toString() : "0",
        ];
      });

      autoTable(doc, {
        startY: yPos,
        head: [["Unit", "Total Hasil", "Jumlah Kegiatan"]],
        body: unitTableData,
        theme: "striped",
        headStyles: { fillColor: [47, 85, 151] },
        styles: { fontSize: 9 },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Detail per Unit
      UNIT_LIST.forEach((unit) => {
        const unitData = unitDataMap[unit];
        if (!unitData || unitData.kegiatanCount === 0) return;

        // Check if we need a new page
        if (yPos > 180) {
          doc.addPage();
          yPos = 10;
        }

        // Unit Header
        doc.setFontSize(14);
        doc.setFont("helvetica", "bold");
        doc.text(`Unit: ${unit}`, 14, yPos);
        yPos += 6;

        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Total: ${unitData.totalHasil.toFixed(2)} | Kegiatan: ${
            unitData.kegiatanCount
          }`,
          14,
          yPos
        );
        yPos += 6;

        // Bidang breakdown for this unit
        if (Object.keys(unitData.bidangDataMap).length > 0) {
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.text("Total per Bidang:", 14, yPos);
          yPos += 5;

          const unitBidangData = Object.values(unitData.bidangDataMap)
            .sort((a, b) => a.bidang.localeCompare(b.bidang))
            .map((bidangData) => [
              bidangData.bidang,
              bidangData.bidangNama,
              bidangData.totalHasil.toFixed(2),
              bidangData.kegiatanCount.toString(),
            ]);

          autoTable(doc, {
            startY: yPos,
            head: [["Bidang", "Nama Bidang", "Total Hasil", "Jumlah Kegiatan"]],
            body: unitBidangData,
            theme: "striped",
            headStyles: { fillColor: [68, 114, 196] },
            styles: { fontSize: 8 },
            margin: { left: 14 },
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          yPos = (doc as any).lastAutoTable.finalY + 8;
        }

        // Detail table
        const detailData: (string | number)[][] = [];
        unitData.pedomanList.forEach((pedoman) => {
          if (!isPedomanInUnit(pedoman, unit)) return;

          const buktiFisik = unitData.buktiFisikMap[pedoman.id];
          const skor = Number(buktiFisik?.skor) || 0;
          if (skor === 0) return;

          const indeksPoin = Number(pedoman.indeks_poin) || 0;
          const hasil = indeksPoin * skor;

          detailData.push([
            pedoman.no,
            pedoman.bidang || "",
            pedoman.kegiatan.substring(0, 60), // Truncate if too long
            indeksPoin.toFixed(2),
            skor.toString(),
            hasil.toFixed(2),
            buktiFisik?.file_name?.substring(0, 30) || "-",
          ]);
        });

        if (detailData.length > 0) {
          // Check if we need a new page for detail table
          if (yPos > 150) {
            doc.addPage();
            yPos = 10;
          }

          autoTable(doc, {
            startY: yPos,
            head: [
              [
                "No",
                "Bidang",
                "Kegiatan",
                "Indeks Poin",
                "Skor",
                "Hasil",
                "File Name",
              ],
            ],
            body: detailData,
            theme: "striped",
            headStyles: { fillColor: [68, 114, 196] },
            styles: { fontSize: 7 },
            margin: { left: 14 },
            columnStyles: {
              2: { cellWidth: 60 }, // Kegiatan column wider
              6: { cellWidth: 30 }, // File name column
            },
          });

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          yPos = (doc as any).lastAutoTable.finalY + 10;
        }
      });

      // Footer
      const pageCount = doc.getNumberOfPages();
      for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("helvetica", "italic");
        doc.text(
          `Halaman ${i} dari ${pageCount} | Dicetak pada: ${new Date().toLocaleString(
            "id-ID"
          )}`,
          14,
          doc.internal.pageSize.height - 10
        );
      }

      // Generate filename and download
      const now = new Date();
      // Add watermark using centralized helper
      addWatermarkToAllPages(doc);

      const timestamp = now.toISOString().slice(0, 19).replace(/:/g, "-");
      const fileName = `Rekap_IKD_Detail_${
        userInfo?.name || "User"
      }_${timestamp}.pdf`;

      doc.save(fileName);
    } catch (error) {
      console.error("Error exporting to PDF:", error);
      alert("Gagal mengekspor data ke PDF. Pastikan library jsPDF terinstall.");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
        <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Header Skeleton */}
          <div className="mb-6 animate-pulse">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-2xl"></div>
                <div className="flex-1">
                  <div className="h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                  <div className="h-4 w-96 bg-gray-200 dark:bg-gray-700 rounded"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Informasi Dosen Skeleton */}
          <div className="mb-6 animate-pulse">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <div className="h-6 w-32 bg-gray-200 dark:bg-gray-700 rounded mb-4"></div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, idx) => (
                  <div key={idx}>
                    <div className="h-3 w-16 bg-gray-200 dark:bg-gray-700 rounded mb-1"></div>
                    <div className="h-4 w-40 bg-gray-200 dark:bg-gray-700 rounded"></div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Grand Total Card Skeleton */}
          <div className="mb-6 animate-pulse">
            <div className="bg-gradient-to-r from-gray-200 to-gray-300 dark:from-gray-700 dark:to-gray-600 rounded-2xl p-6">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="h-4 w-32 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                  <div className="h-10 w-24 bg-gray-300 dark:bg-gray-600 rounded mb-1"></div>
                  <div className="h-3 w-48 bg-gray-300 dark:bg-gray-600 rounded"></div>
                </div>
                <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
              </div>
            </div>
          </div>

          {/* Unit Cards Skeleton */}
          <div className="space-y-4">
            {Array.from({ length: 9 }).map((_, idx) => (
              <div
                key={idx}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden animate-pulse"
              >
                {/* Unit Header Skeleton */}
                <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-gray-200 dark:bg-gray-700 rounded-xl"></div>
                      <div className="flex-1">
                        <div className="h-6 w-24 bg-gray-200 dark:bg-gray-700 rounded mb-2"></div>
                        <div className="flex items-baseline gap-3">
                          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          <div className="h-4 w-1 bg-gray-200 dark:bg-gray-700 rounded"></div>
                          <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded-full"></div>
                      <div className="w-5 h-5 bg-gray-200 dark:bg-gray-700 rounded"></div>
                    </div>
                  </div>
                </div>
                {/* Unit Content Skeleton (for expanded state) */}
                {idx < 3 && (
                  <div className="p-6">
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50 dark:bg-gray-700/50">
                          <tr>
                            <th className="px-4 py-3">
                              <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                            </th>
                            <th className="px-4 py-3">
                              <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded"></div>
                            </th>
                            <th className="px-4 py-3">
                              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                            </th>
                            <th className="px-4 py-3">
                              <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                            </th>
                            <th className="px-4 py-3">
                              <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                            </th>
                            <th className="px-4 py-3">
                              <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                          {Array.from({ length: 3 }).map((_, rowIdx) => (
                            <tr key={rowIdx}>
                              <td className="px-4 py-3">
                                <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded"></div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="h-4 w-48 bg-gray-200 dark:bg-gray-700 rounded"></div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="h-8 w-32 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="h-4 w-12 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="h-4 w-8 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20">
                          <tr>
                            <td colSpan={5} className="px-4 py-4 text-right">
                              <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded ml-auto"></div>
                            </td>
                            <td className="px-4 py-4 text-center">
                              <div className="h-6 w-20 bg-gray-200 dark:bg-gray-700 rounded mx-auto"></div>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back Button - Only for superadmin or tim_akademik */}
        {isSuperAdminOrTimAkademik && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            onClick={() => navigate("/dosen")}
            className="flex items-center gap-2 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 mb-6 transition-colors font-medium"
          >
            <FontAwesomeIcon icon={faArrowLeft} className="w-5 h-5" />
            <span>Kembali</span>
          </motion.button>
        )}

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-500 rounded-2xl flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faChartBar}
                  className="w-6 h-6 text-white"
                />
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Rekap IKD Detail
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                  Lihat detail Rekap Indikator Kinerja Dosen Anda dari semua
                  unit
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Informasi Dosen */}
        {userInfo && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="mb-6"
          >
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Informasi Dosen
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    Nama
                  </p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {userInfo.name || "-"}
                  </p>
                </div>
                {userInfo.nid && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      NID
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {userInfo.nid}
                    </p>
                  </div>
                )}
                {userInfo.nidn && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      NIDN
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {userInfo.nidn}
                    </p>
                  </div>
                )}
                {userInfo.username && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Username
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {userInfo.username}
                    </p>
                  </div>
                )}
                {userInfo.email && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      Email
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {userInfo.email}
                    </p>
                  </div>
                )}
                {userInfo.telp && (
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      No. Telepon
                    </p>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {userInfo.telp}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* Grand Total Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mb-6"
        >
          <div className="bg-gradient-to-r from-blue-500 to-indigo-600 rounded-2xl shadow-lg border border-blue-600 dark:border-blue-500 p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex-1">
                <p className="text-blue-100 text-sm font-medium mb-1">
                  Total Keseluruhan
                </p>
                <p className="text-white text-3xl font-bold">
                  {grandTotal.toFixed(2)}
                </p>
                <p className="text-blue-100 text-xs mt-1">
                  Hasil dari semua unit (Indeks Poin × Skor)
                </p>
              </div>
              <div className="flex items-center gap-3">
                {/* Export Buttons */}
                <div className="flex gap-2">
                  <button
                    onClick={exportToExcel}
                    className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg transition-colors flex items-center gap-2 shadow-md"
                    title="Export ke Excel"
                  >
                    <FontAwesomeIcon icon={faFileExcel} className="w-4 h-4" />
                    <span className="text-sm font-medium">Excel</span>
                  </button>
                  <button
                    onClick={exportToPDF}
                    className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors flex items-center gap-2 shadow-md"
                    title="Export ke PDF"
                  >
                    <FontAwesomeIcon icon={faFilePdf} className="w-4 h-4" />
                    <span className="text-sm font-medium">PDF</span>
                  </button>
                </div>
                <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                  <FontAwesomeIcon
                    icon={faChartBar}
                    className="w-8 h-8 text-white"
                  />
                </div>
              </div>
            </div>

            {/* Breakdown per Bidang (Global) */}
            {sortedGlobalBidangList.length > 0 && (
              <div className="mt-4 pt-4 border-t border-blue-400/30">
                <p className="text-blue-100 text-xs font-medium mb-3">
                  Total per Bidang (Semua Unit):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {sortedGlobalBidangList.map((bidangData) => (
                    <div
                      key={bidangData.bidang}
                      className="bg-white/10 rounded-lg p-3 backdrop-blur-sm"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-white text-sm font-semibold">
                            Bidang {bidangData.bidang}
                          </p>
                          <p className="text-blue-100 text-xs mt-0.5">
                            {bidangData.bidangNama}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-white text-lg font-bold">
                            {bidangData.totalHasil.toFixed(2)}
                          </p>
                          <p className="text-blue-100 text-xs">
                            {bidangData.kegiatanCount} kegiatan
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </motion.div>

        {/* Unit Cards */}
        <div className="space-y-4">
          {UNIT_LIST.map((unit, index) => {
            const unitData = unitDataMap[unit];
            if (!unitData) return null;

            const hasData = unitData.kegiatanCount > 0;
            const isExpanded = expandedUnits.has(unit);

            return (
              <motion.div
                key={unit}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + index * 0.05 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Unit Header */}
                <div
                  className={`px-6 py-4 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                    hasData ? "" : "opacity-60"
                  }`}
                  onClick={() => toggleUnit(unit)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div
                        className={`w-12 h-12 ${getUnitColor(
                          unit
                        )} rounded-xl flex items-center justify-center text-white font-bold text-lg`}
                      >
                        {unit.charAt(0)}
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
                          {unit}
                        </h3>
                        <div className="flex items-baseline gap-3 mb-2">
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            {unitData.kegiatanCount} kegiatan
                          </span>
                          <span className="text-gray-300 dark:text-gray-600">
                            •
                          </span>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            Total:{" "}
                            <span className="font-semibold text-blue-600 dark:text-blue-400">
                              {unitData.totalHasil.toFixed(2)}
                            </span>
                          </span>
                        </div>
                        {/* Breakdown per Bidang untuk Unit ini */}
                        {Object.keys(unitData.bidangDataMap).length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {Object.values(unitData.bidangDataMap)
                              .sort((a, b) => a.bidang.localeCompare(b.bidang))
                              .map((bidangData) => (
                                <div
                                  key={bidangData.bidang}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 bg-gray-100 dark:bg-gray-700/50 rounded-md"
                                >
                                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                    Bidang {bidangData.bidang}:
                                  </span>
                                  <span className="text-xs font-semibold text-blue-600 dark:text-blue-400">
                                    {bidangData.totalHasil.toFixed(2)}
                                  </span>
                                  <span className="text-xs text-gray-500 dark:text-gray-400">
                                    ({bidangData.kegiatanCount})
                                  </span>
                                </div>
                              ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      {hasData ? (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                          Ada Data
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300">
                          Belum Ada Data
                        </span>
                      )}
                      <FontAwesomeIcon
                        icon={isExpanded ? faChevronUp : faChevronDown}
                        className="w-5 h-5 text-gray-400"
                      />
                    </div>
                  </div>
                </div>

                {/* Unit Content */}
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="p-6"
                  >
                    {hasData ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead className="bg-gray-50 dark:bg-gray-700/50">
                            <tr>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                No
                              </th>
                              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Kegiatan
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                File
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Indeks Poin
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Skor
                              </th>
                              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                                Hasil
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {unitData.pedomanList.map((pedoman) => {
                              // Hanya tampilkan jika unit saat ini ada di unit_kerja pedoman
                              if (!isPedomanInUnit(pedoman, unit)) {
                                return null;
                              }

                              const buktiFisik =
                                unitData.buktiFisikMap[pedoman.id];
                              const skor = Number(buktiFisik?.skor) || 0;
                              const indeksPoin =
                                Number(pedoman.indeks_poin) || 0;
                              const hasil = indeksPoin * skor;

                              // Only show rows that have skor > 0
                              if (skor === 0) return null;

                              return (
                                <tr
                                  key={pedoman.id}
                                  className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                                >
                                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                                    <div className="flex items-center gap-2">
                                      <span>{pedoman.no}</span>
                                      {pedoman.bidang && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-700">
                                          {pedoman.bidang}
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                                    {pedoman.kegiatan}
                                  </td>
                                  <td className="px-4 py-3 text-center">
                                    {buktiFisik?.file_url ? (
                                      <div className="flex flex-col items-center gap-1">
                                        <button
                                          onClick={() =>
                                            handleDownloadFile(
                                              buktiFisik.id,
                                              buktiFisik.file_name
                                            )
                                          }
                                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 transition-colors"
                                          title={buktiFisik.file_name}
                                        >
                                          <FontAwesomeIcon
                                            icon={faDownload}
                                            className="w-4 h-4"
                                          />
                                          <span className="text-xs font-medium">
                                            Download File
                                          </span>
                                        </button>
                                        <p
                                          className="text-xs text-gray-500 dark:text-gray-400 max-w-[200px] truncate"
                                          title={buktiFisik.file_name}
                                        >
                                          {buktiFisik.file_name}
                                        </p>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">
                                        -
                                      </span>
                                    )}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-medium text-gray-900 dark:text-white">
                                    {indeksPoin.toFixed(2)}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-medium text-gray-900 dark:text-white">
                                    {skor}
                                  </td>
                                  <td className="px-4 py-3 whitespace-nowrap text-sm text-center font-bold text-blue-600 dark:text-blue-400">
                                    {hasil.toFixed(2)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                          <tfoot className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 border-t-2 border-blue-200 dark:border-blue-700">
                            <tr>
                              <td
                                colSpan={5}
                                className="px-4 py-4 text-right text-base font-bold text-gray-900 dark:text-white"
                              >
                                Total {unit}:
                              </td>
                              <td className="px-4 py-4 text-center text-lg font-bold text-blue-600 dark:text-blue-400">
                                {unitData.totalHasil.toFixed(2)}
                              </td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-8">
                        <FontAwesomeIcon
                          icon={faFileAlt}
                          className="w-12 h-12 text-gray-400 mb-4"
                        />
                        <p className="text-gray-500 dark:text-gray-400">
                          Belum ada data untuk unit {unit}
                        </p>
                      </div>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Info Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700 rounded-xl p-4"
        >
          <div className="flex items-start gap-3">
            <FontAwesomeIcon
              icon={faInfoCircle}
              className="w-5 h-5 text-blue-500 mt-0.5"
            />
            <div>
              <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-1">
                Informasi
              </h4>
              <p className="text-sm text-blue-800 dark:text-blue-300">
                Halaman ini menampilkan rekap IKD Anda dari semua unit. Hasil
                dihitung dengan rumus:{" "}
                <strong>Indeks Poin × Skor = Hasil</strong>. Data diperbarui
                secara realtime setiap 5 detik. Halaman ini bersifat read-only
                dan tidak dapat diubah.
              </p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default RekapIKDDetail;
