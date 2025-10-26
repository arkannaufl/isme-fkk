import { useEffect, useState, useCallback, useMemo, memo } from "react";
import api, { handleApiError } from "../utils/api";
import { AnimatePresence, motion } from "framer-motion";

type MataKuliah = {
  kode: string;
  nama: string;
  semester: number;
  jenis: "Blok" | "Non Blok";
  tanggalMulai: string;
  tanggalAkhir: string;
  tanggal_mulai?: string;
  tanggal_akhir?: string;
  blok?: number;
  tipe_non_block?: "CSR" | "Non-CSR";
};

type CSR = {
  id: number;
  mata_kuliah_kode: string;
  nomor_csr: string;
  nama: string;
  keahlian?: string;
  tanggal_mulai: string;
  tanggal_akhir: string;
};

type Holiday = {
  holiday_date: string;
  holiday_name: string;
  is_national_holiday: boolean;
};

const tailwindColors = [
  "bg-red-500",
  "bg-orange-500",
  "bg-amber-500",
  "bg-yellow-500",
  "bg-lime-500",
  "bg-green-500",
  "bg-emerald-500",
  "bg-teal-500",
  "bg-cyan-500",
  "bg-sky-500",
  "bg-blue-500",
  "bg-indigo-500",
  "bg-violet-500",
  "bg-purple-500",
  "bg-fuchsia-500",
  "bg-pink-500",
  "bg-rose-500",
];

const blokColors = [
  "bg-blue-500", // Blok 1
  "bg-yellow-400", // Blok 2
  "bg-pink-400", // Blok 3
  "bg-green-400", // Blok 4
];

const csrColors = [
  "bg-emerald-600", // CSR 1
  "bg-teal-600", // CSR 2
  "bg-cyan-600", // CSR 3
  "bg-sky-600", // CSR 4
];

const nonBlokCsrColor = "bg-orange-500"; // Non Blok CSR
const nonBlokNonCsrColor = "bg-slate-500"; // Non Blok Non CSR

// Helper to get day difference
const dayDiff = (d1: Date, d2: Date) => {
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

// Helper to calculate weeks
const getWeeksCount = (startDate: Date, endDate: Date) => {
  const days = dayDiff(startDate, endDate) + 1;
  return Math.ceil(days / 7);
};

// Helper to format course display text for the bar
const formatCourseBarText = (course: MataKuliah | any) => {
  if (course.jenis === "Blok" && course.blok) {
    return `Blok ${course.blok}: ${course.nama}`;
  }
  if (course.jenis === "CSR" && course.csr_number && course.parent_course) {
    // Gunakan nama CSR (course.nama) jika ada, jika tidak beri keterangan
    const namaCsr =
      course.nama && course.nama.trim() !== ""
        ? course.nama
        : "(Belum diisi nama CSR)";
    return `CSR ${course.parent_course.semester}.${course.csr_number}: ${namaCsr}`;
  }
  if (course.jenis === "Non Blok") {
    // Tampilkan detail jenis non blok berdasarkan tipe_non_block
    if (course.tipe_non_block === "CSR") {
      return `Non Blok CSR: ${course.nama}`;
    } else if (course.tipe_non_block === "Non-CSR") {
      return `Non Blok Non CSR: ${course.nama}`;
    } else {
      // Fallback untuk data yang belum ada tipe_non_block
      return `Non Blok: ${course.nama}`;
    }
  }
  return course.nama;
};

// Helper to format course tooltip
const formatCourseTooltip = (course: MataKuliah | any) => {
  const startDate = new Date(course.tanggalMulai || course.tanggal_mulai || "");
  const endDate = new Date(course.tanggalAkhir || course.tanggal_akhir || "");
  const weeks = getWeeksCount(startDate, endDate);

  const startStr = startDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const endStr = endDate.toLocaleDateString("id-ID", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  let courseName = course.nama;
  let courseType = course.jenis;
  let nomorCsr = "";

  if (course.jenis === "CSR" && course.parent_course) {
    courseName = course.parent_course.nama;
    courseType = `CSR ${course.parent_course.semester}.${course.csr_number}`;
    nomorCsr = course.nomor_csr ? `Nomor CSR: ${course.nomor_csr}` : "";
  } else if (course.jenis === "Non Blok") {
    // Tampilkan detail jenis non blok berdasarkan tipe_non_block
    if (course.tipe_non_block === "CSR") {
      courseType = "Non Blok CSR";
    } else if (course.tipe_non_block === "Non-CSR") {
      courseType = "Non Blok Non CSR";
    } else {
      courseType = "Non Blok";
    }
  }

  const details = [
    `Mata Kuliah: ${courseName} (${course.kode})`,
    `Semester: ${course.semester}`,
    `Jenis: ${courseType}${
      course.jenis === "Blok" && course.blok ? ` (Blok ${course.blok})` : ""
    }`,
    nomorCsr,
    `Jadwal: ${startStr} - ${endStr}`,
    `Durasi: ${weeks} minggu`,
  ].filter(Boolean);

  return details.join("\n");
};

const generateLayout = (courses: (MataKuliah | any)[]) => {
  const coursesBySemester = new Map<number, (MataKuliah | any)[]>();
  courses.forEach((course) => {
    if (!coursesBySemester.has(course.semester)) {
      coursesBySemester.set(course.semester, []);
    }
    coursesBySemester.get(course.semester)?.push(course);
  });

  const semesterLayouts = new Map<number, { lanes: (MataKuliah | any)[][] }>();
  coursesBySemester.forEach((semesterCourses, semester) => {
    // Separate courses by type: Blok, Non Blok, CSR
    const blokCourses = semesterCourses.filter((c) => c.jenis === "Blok");
    const nonBlokCourses = semesterCourses.filter(
      (c) => c.jenis === "Non Blok"
    );
    const csrCourses = semesterCourses.filter((c) => c.jenis === "CSR");

    const allLanes: (MataKuliah | any)[][] = [];

    // Process Blok courses
    if (blokCourses.length > 0) {
      const sortedBlokCourses = [...blokCourses].sort((a, b) => {
        const aStart = new Date(a.tanggalMulai || a.tanggal_mulai || "");
        const bStart = new Date(b.tanggalMulai || b.tanggal_mulai || "");
        return aStart.getTime() - bStart.getTime();
      });

      const blokLanes: { courses: (MataKuliah | any)[]; lastEndDate: Date }[] =
        [];
      sortedBlokCourses.forEach((course) => {
        const courseStart = new Date(
          course.tanggalMulai || course.tanggal_mulai || ""
        );
        const courseEnd = new Date(
          course.tanggalAkhir || course.tanggal_akhir || ""
        );

        let placed = false;
        for (let i = 0; i < blokLanes.length; i++) {
          if (courseStart > blokLanes[i].lastEndDate) {
            blokLanes[i].courses.push(course);
            blokLanes[i].lastEndDate = courseEnd;
            placed = true;
            break;
          }
        }

        if (!placed) {
          blokLanes.push({ courses: [course], lastEndDate: courseEnd });
        }
      });

      allLanes.push(...blokLanes.map((l) => l.courses));
    }

    // Process Non Blok courses
    if (nonBlokCourses.length > 0) {
      const sortedNonBlokCourses = [...nonBlokCourses].sort((a, b) => {
        const aStart = new Date(a.tanggalMulai || a.tanggal_mulai || "");
        const bStart = new Date(b.tanggalMulai || b.tanggal_mulai || "");
        return aStart.getTime() - bStart.getTime();
      });

      const nonBlokLanes: {
        courses: (MataKuliah | any)[];
        lastEndDate: Date;
      }[] = [];
      sortedNonBlokCourses.forEach((course) => {
        const courseStart = new Date(
          course.tanggalMulai || course.tanggal_mulai || ""
        );
        const courseEnd = new Date(
          course.tanggalAkhir || course.tanggal_akhir || ""
        );

        let placed = false;
        for (let i = 0; i < nonBlokLanes.length; i++) {
          if (courseStart > nonBlokLanes[i].lastEndDate) {
            nonBlokLanes[i].courses.push(course);
            nonBlokLanes[i].lastEndDate = courseEnd;
            placed = true;
            break;
          }
        }

        if (!placed) {
          nonBlokLanes.push({ courses: [course], lastEndDate: courseEnd });
        }
      });

      allLanes.push(...nonBlokLanes.map((l) => l.courses));
    }

    // Process CSR courses
    if (csrCourses.length > 0) {
      const sortedCsrCourses = [...csrCourses].sort((a, b) => {
        const aStart = new Date(a.tanggalMulai || a.tanggal_mulai || "");
        const bStart = new Date(b.tanggalMulai || b.tanggal_mulai || "");
        return aStart.getTime() - bStart.getTime();
      });

      const csrLanes: { courses: (MataKuliah | any)[]; lastEndDate: Date }[] =
        [];
      sortedCsrCourses.forEach((course) => {
        const courseStart = new Date(
          course.tanggalMulai || course.tanggal_mulai || ""
        );
        const courseEnd = new Date(
          course.tanggalAkhir || course.tanggal_akhir || ""
        );

        let placed = false;
        for (let i = 0; i < csrLanes.length; i++) {
          if (courseStart > csrLanes[i].lastEndDate) {
            csrLanes[i].courses.push(course);
            csrLanes[i].lastEndDate = courseEnd;
            placed = true;
            break;
          }
        }

        if (!placed) {
          csrLanes.push({ courses: [course], lastEndDate: courseEnd });
        }
      });

      allLanes.push(...csrLanes.map((l) => l.courses));
    }

    semesterLayouts.set(semester, { lanes: allLanes });
  });

  return new Map([...semesterLayouts.entries()].sort((a, b) => a[0] - b[0]));
};

interface CalendarTableProps {
  semesterLayouts: Map<number, { lanes: (MataKuliah | any)[][] }>;
  colorMap: Map<string, string>;
  holidayMap: Map<string, Holiday>;
  onCourseClick: (course: MataKuliah | any) => void;
}

const CalendarTable = memo(
  ({
    semesterLayouts,
    colorMap,
    holidayMap,
    onCourseClick,
  }: CalendarTableProps) => {
    // Calculate the overall date range for this table
    const allCourses = Array.from(semesterLayouts.values()).flatMap((layout) =>
      layout.lanes.flat()
    );

    if (allCourses.length === 0) {
      return (
        <div className="text-center py-4 text-gray-500">
          Tidak ada mata kuliah untuk ditampilkan
        </div>
      );
    }

    // Find min and max dates
    let minDate: Date = new Date(
      allCourses[0].tanggalMulai || allCourses[0].tanggal_mulai || ""
    );
    let maxDate: Date = new Date(
      allCourses[0].tanggalAkhir || allCourses[0].tanggal_akhir || ""
    );

    allCourses.forEach((course) => {
      const start = new Date(course.tanggalMulai || course.tanggal_mulai || "");
      const end = new Date(course.tanggalAkhir || course.tanggal_akhir || "");
      if (start < minDate) minDate = start;
      if (end > maxDate) maxDate = end;
    });

    const totalDays = dayDiff(minDate, maxDate) + 1;
    const dates = Array.from({ length: totalDays }, (_, i) => {
      const d = new Date(minDate);
      d.setDate(d.getDate() + i);
      return d;
    });

    // Group by month for header
    const months = dates.reduce((acc, date) => {
      const month = date.toLocaleString("id-ID", {
        month: "long",
        year: "numeric",
      });
      if (!acc[month]) acc[month] = 0;
      acc[month]++;
      return acc;
    }, {} as Record<string, number>);

    const DAY_WIDTH = 40;
    const LANE_HEIGHT = 50; // Increased height to accommodate longer text

    const getHoliday = (date: Date): Holiday | undefined => {
      const year = date.getFullYear();
      const month = (date.getMonth() + 1).toString().padStart(2, "0");
      const day = date.getDate().toString().padStart(2, "0");
      const dateString = `${year}-${month}-${day}`;
      return holidayMap.get(dateString);
    };

    return (
      <div className="overflow-x-auto no-scrollbar border rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div style={{ minWidth: `calc(12rem + ${totalDays * DAY_WIDTH}px)` }}>
          {/* Header with months */}
          <div className="sticky top-0 bg-white dark:bg-gray-900 z-20">
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <div className="w-48 shrink-0 border-r border-gray-200 dark:border-gray-700 font-semibold text-sm flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                Semester
              </div>
              {Object.entries(months).map(([name, days]) => (
                <div
                  key={name}
                  style={{ width: `${days * DAY_WIDTH}px` }}
                  className="shrink-0 text-sm font-bold text-center border-r border-gray-200 dark:border-gray-700 py-2 flex items-center justify-center bg-gray-50 dark:bg-gray-800 overflow-hidden whitespace-nowrap text-ellipsis"
                  title={name}
                >
                  {name}
                </div>
              ))}
            </div>

            {/* Header with days */}
            <div className="flex border-b border-gray-200 dark:border-gray-700">
              <div className="w-48 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"></div>
              {dates.map((date) => {
                const holiday = getHoliday(date);
                const dayOfWeek = date.getDay();
                const weekend =
                  !holiday && (dayOfWeek === 0 || dayOfWeek === 6);

                let dayBgClass = "bg-gray-50 dark:bg-gray-800";
                let title = "";
                if (holiday) {
                  dayBgClass = "bg-red-100 dark:bg-red-900/50";
                  title = holiday.holiday_name;
                } else if (weekend) {
                  dayBgClass = "bg-gray-100 dark:bg-gray-700/40";
                  title = "Libur Akhir Pekan Sabtu & Minggu";
                }

                return (
                  <div
                    key={date.toISOString()}
                    style={{ width: `${DAY_WIDTH}px` }}
                    className={`shrink-0 text-xs text-center border-r border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center py-1 ${dayBgClass}`}
                    title={title}
                  >
                    <span
                      className={`font-semibold ${
                        holiday
                          ? "text-red-600 dark:text-red-400"
                          : weekend
                          ? "text-gray-400"
                          : "text-gray-500"
                      }`}
                    >
                      {date
                        .toLocaleDateString("id-ID", { weekday: "short" })
                        .charAt(0)}
                    </span>
                    <span
                      className={
                        holiday
                          ? "text-red-600 dark:text-red-400 font-bold"
                          : weekend
                          ? "text-gray-400"
                          : ""
                      }
                    >
                      {date.getDate()}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Calendar grid */}
          <div className="relative">
            {/* Background grid lines & Holiday overlays */}
            <div className="absolute top-0 left-48 right-0 bottom-0 flex z-0">
              {dates.map((date, index) => {
                const holiday = getHoliday(date);
                const dayOfWeek = date.getDay();
                const weekend =
                  !holiday && (dayOfWeek === 0 || dayOfWeek === 6);
                return (
                  <div
                    key={index}
                    style={{ width: `${DAY_WIDTH}px` }}
                    className="shrink-0 h-full border-r border-gray-200 dark:border-gray-700"
                  >
                    {holiday && (
                      <div
                        className="w-full h-full bg-red-500/10"
                        title={holiday.holiday_name}
                      />
                    )}
                    {weekend && (
                      <div
                        className="w-full h-full bg-gray-500/10 dark:bg-gray-400/10"
                        title="Libur Akhir Pekan Sabtu & Minggu"
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Course content */}
            <div className="relative z-10">
              {Array.from(semesterLayouts.entries()).map(
                ([semester, layout]) => {
                  const laneCount =
                    layout.lanes.length > 0 ? layout.lanes.length : 1;
                  const semesterBlockHeight = laneCount * LANE_HEIGHT;

                  return (
                    <div key={semester} className="flex">
                      {/* Semester label */}
                      <div
                        className="w-48 shrink-0 border-r border-b border-gray-200 dark:border-gray-700 font-semibold text-sm flex items-center justify-center p-2 bg-gray-50 dark:bg-gray-800"
                        style={{ height: `${semesterBlockHeight}px` }}
                      >
                        {typeof semester === "string" &&
                        (semester === "Antara" || semester === "antara")
                          ? "Semester Antara"
                          : `Semester ${semester}`}
                      </div>

                      {/* Course lanes */}
                      <div
                        className="relative"
                        style={{ width: `${totalDays * DAY_WIDTH}px` }}
                      >
                        {layout.lanes.length > 0 ? (
                          layout.lanes.map((lane, laneIndex) => (
                            <div
                              key={laneIndex}
                              className="relative border-b border-gray-200 dark:border-gray-700"
                              style={{ height: `${LANE_HEIGHT}px` }}
                            >
                              {lane.map((course) => {
                                const courseStart = new Date(
                                  course.tanggalMulai ||
                                    course.tanggal_mulai ||
                                    ""
                                );
                                const courseEnd = new Date(
                                  course.tanggalAkhir ||
                                    course.tanggal_akhir ||
                                    ""
                                );
                                const startOffsetDays = dayDiff(
                                  minDate,
                                  courseStart
                                );
                                const durationDays =
                                  dayDiff(courseStart, courseEnd) + 1;
                                const left = startOffsetDays * DAY_WIDTH;
                                const width = durationDays * DAY_WIDTH - 4;

                                const barText = formatCourseBarText(course);
                                const tooltipText = formatCourseTooltip(course);

                                return (
                                  <div
                                    key={course.kode}
                                    className={`absolute px-2 py-1 flex items-center justify-between rounded text-white text-sm font-medium shadow-md ${colorMap.get(
                                      course.kode
                                    )} leading-tight hover:opacity-90 hover:shadow-lg transition-all duration-200 group`}
                                    style={{
                                      left: `${left}px`,
                                      width: `${width}px`,
                                      height: `${LANE_HEIGHT - 8}px`,
                                      top: "4px",
                                      cursor: "pointer",
                                      overflow: "hidden",
                                    }}
                                    title={
                                      tooltipText +
                                      "\n\n👆🏻 Klik untuk melihat detail jadwal harian"
                                    }
                                    onClick={() => onCourseClick(course)}
                                  >
                                    <span className="truncate text-sm leading-tight flex-1">
                                      {barText}
                                    </span>
                                    <div className="ml-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex-shrink-0">
                                      <svg
                                        className="w-3 h-3"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                                        />
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                                        />
                                      </svg>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ))
                        ) : (
                          <div
                            className="relative border-b border-gray-200 dark:border-gray-700"
                            style={{ height: `${LANE_HEIGHT}px` }}
                          ></div>
                        )}
                      </div>
                    </div>
                  );
                }
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
);

// Skeleton loading for jadwal harian table
function JadwalHarianSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 5 }).map((_, index) => (
        <div
          key={index}
          className="flex items-center space-x-4 p-3 bg-gray-50 dark:bg-gray-800/50 rounded-lg"
        >
          <div className="w-20 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="w-16 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="w-24 h-6 bg-gray-200 dark:bg-gray-700 rounded-full animate-pulse" />
          <div className="w-32 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          <div className="w-24 h-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function PetaAkademikSkeleton() {
  // Skeleton for 3 semester sections, each with a fake calendar header and 2 lanes
  return (
    <div>
      {["Semester Ganjil", "Semester Genap", "Semester Antara"].map(
        (title, idx) => (
          <div className={idx > 0 ? "mt-8" : "mt-4"} key={title}>
            <div className="text-xl font-bold mb-4 h-7 w-48 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            <div className="overflow-x-auto no-scrollbar border rounded-lg border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
              <div style={{ minWidth: "calc(12rem + 20*40px)" }}>
                {/* Header with months */}
                <div className="sticky top-0 bg-white dark:bg-gray-900 z-20">
                  <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <div className="w-48 shrink-0 border-r border-gray-200 dark:border-gray-700 font-semibold text-sm flex items-center justify-center bg-gray-50 dark:bg-gray-800">
                      <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                    </div>
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div
                        key={i}
                        style={{ width: "160px" }}
                        className="shrink-0 text-sm font-bold text-center border-r border-gray-200 dark:border-gray-700 py-2 flex items-center justify-center bg-gray-50 dark:bg-gray-800"
                      >
                        <div className="h-5 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                  {/* Header with days */}
                  <div className="flex border-b border-gray-200 dark:border-gray-700">
                    <div className="w-48 shrink-0 border-r border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800"></div>
                    {Array.from({ length: 20 }).map((_, i) => (
                      <div
                        key={i}
                        style={{ width: "40px" }}
                        className="shrink-0 text-xs text-center border-r border-gray-200 dark:border-gray-600 flex flex-col items-center justify-center py-1 bg-gray-50 dark:bg-gray-800"
                      >
                        <div className="h-3 w-6 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mb-1" />
                        <div className="h-3 w-4 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                      </div>
                    ))}
                  </div>
                </div>
                {/* Calendar grid skeleton */}
                <div className="relative">
                  <div className="relative z-10">
                    {Array.from({ length: 2 }).map((_, laneIdx) => (
                      <div key={laneIdx} className="flex">
                        {/* Semester label skeleton */}
                        <div
                          className="w-48 shrink-0 border-r border-b border-gray-200 dark:border-gray-700 font-semibold text-sm flex items-center justify-center p-2 bg-gray-50 dark:bg-gray-800"
                          style={{ height: "50px" }}
                        >
                          <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
                        </div>
                        {/* Lane skeleton */}
                        <div className="relative" style={{ width: "800px" }}>
                          <div
                            className="relative border-b border-gray-200 dark:border-gray-700"
                            style={{ height: "50px" }}
                          >
                            {/* Fake course blocks */}
                            {Array.from({ length: 2 }).map((_, blockIdx) => (
                              <div
                                key={blockIdx}
                                className="absolute px-2 py-1 flex items-center rounded text-white text-sm font-medium shadow-md bg-gray-300 dark:bg-gray-700 animate-pulse"
                                style={{
                                  left: `${blockIdx * 200 + 10}px`,
                                  width: "180px",
                                  height: "38px",
                                  top: "4px",
                                }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      )}
      {/* Legenda Warna Skeleton */}
      <div className="mt-8">
        <div className="text-md font-bold mb-3 h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-2">
          {/* Blok 1-4 */}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded-sm bg-blue-500 animate-pulse" />
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded-sm bg-yellow-400 animate-pulse" />
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded-sm bg-pink-400 animate-pulse" />
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded-sm bg-green-400 animate-pulse" />
            <div className="h-4 w-16 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          {/* Non Blok CSR */}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded-sm bg-orange-500 animate-pulse" />
            <div className="h-4 w-20 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          {/* Non Blok Non CSR */}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded-sm bg-slate-500 animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          {/* Hari Libur Nasional */}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded-sm bg-red-500 animate-pulse" />
            <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          {/* Libur Akhir Pekan */}
          <div className="flex items-center gap-2 text-sm">
            <div className="w-4 h-4 rounded-sm bg-gray-200 dark:bg-gray-700 animate-pulse" />
            <div className="h-4 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PetaAkademikPage() {
  const [data, setData] = useState<MataKuliah[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [csrData, setCsrData] = useState<CSR[]>([]);

  // Modal states
  const [selectedCourse, setSelectedCourse] = useState<MataKuliah | any>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jadwalHarian, setJadwalHarian] = useState<any[]>([]);
  const [isLoadingJadwal, setIsLoadingJadwal] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("Semua");

  // Badge color function for schedule types
  const getBadgeColor = (jenisJadwal: string) => {
    switch (jenisJadwal) {
      case "Kuliah Besar":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400";
      case "PBL":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400";
      case "Jurnal Reading":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400";
      case "Agenda Khusus":
        return "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400";
      case "CSR":
      case "CSR Reguler":
      case "CSR Responsi":
        return "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/20 dark:text-cyan-400";
      case "Praktikum":
        return "bg-pink-100 text-pink-800 dark:bg-pink-900/20 dark:text-pink-400";
      case "Non Blok Non CSR":
        return "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/20 dark:text-indigo-400";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900/20 dark:text-gray-400";
    }
  };

  // Handle course click to show modal
  const handleCourseClick = useCallback(async (course: MataKuliah | any) => {
    setSelectedCourse(course);
    setIsModalOpen(true);
    setIsLoadingJadwal(true);

    try {
      const response = await api.get(
        `/jadwal-harian/mata-kuliah/${course.kode}`
      );
      setJadwalHarian(response.data.data || []);
    } catch (error) {
      console.error("Error fetching jadwal harian:", error);
      console.error(
        "Error details:",
        handleApiError(error, "Memuat jadwal harian")
      );
      setJadwalHarian([]);
    } finally {
      setIsLoadingJadwal(false);
    }
  }, []);

  // Close modal
  const closeModal = useCallback(() => {
    setIsModalOpen(false);
    setSelectedCourse(null);
    setJadwalHarian([]);
    setActiveTab("Semua");
  }, []);

  const fetchAllData = useCallback(async () => {
    setError(null);
    try {
      // Fetch mata kuliah data
      const mataKuliahRes = await api.get("/mata-kuliah");
      const courses = Array.isArray(mataKuliahRes.data)
        ? mataKuliahRes.data
        : [];
      setData(courses);

      // Determine unique years from courses
      const yearsToFetch = new Set<number>();

      if (courses.length > 0) {
        courses.forEach((course) => {
          const startDate = course.tanggalMulai || course.tanggal_mulai;
          const endDate = course.tanggalAkhir || course.tanggal_akhir;

          if (startDate) {
            try {
              yearsToFetch.add(new Date(startDate).getFullYear());
            } catch (error) {
              // Silent fail - skip invalid dates
            }
          }
          if (endDate) {
            try {
              yearsToFetch.add(new Date(endDate).getFullYear());
            } catch (error) {
              // Silent fail - skip invalid dates
            }
          }
        });
      }

      // Fallback to current year if no dates are found
      if (yearsToFetch.size === 0) {
        yearsToFetch.add(new Date().getFullYear());
      }

      // Fetch holidays for all determined years
      const holidayPromises = Array.from(yearsToFetch).map((year) =>
        fetch(`https://api-harilibur.vercel.app/api?year=${year}`).then(
          (res) => {
            if (!res.ok) return []; // Return empty array on error to not break Promise.all
            return res.json();
          }
        )
      );

      const holidayResults = await Promise.all(holidayPromises);

      // Flatten the array of arrays and filter out any invalid entries
      const allHolidays = holidayResults
        .flat()
        .filter((h) => h && h.holiday_date);

      setHolidays(allHolidays);
    } catch (err) {
      console.error("Error fetching data:", err);
      console.error(
        "Error details:",
        handleApiError(err, "Memuat data peta akademik")
      );
      setError(handleApiError(err, "Memuat data peta akademik"));
    } finally {
      setLoading(false);
    }
  }, []); // Empty dependency array makes this function stable

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Fetch CSR data
  useEffect(() => {
    const fetchCSRData = async () => {
      try {
        const csrCourses = data.filter(
          (course) =>
            course.jenis === "Non Blok" && course.tipe_non_block === "CSR"
        );
        if (csrCourses.length > 0) {
          const kodeList = csrCourses.map((course) => course.kode);
          const response = await api.get("/csrs", {
            params: { kode_mk: kodeList },
          });
          setCsrData(response.data.data || []);
        } else {
          setCsrData([]);
        }
      } catch (error) {
        console.error("Error fetching CSR data:", error);
        console.error(
          "Error details:",
          handleApiError(error, "Memuat data CSR")
        );
        setCsrData([]);
      }
    };
    fetchCSRData();
  }, [data]);

  // Filter schedules based on active tab
  const filteredJadwalHarian = useMemo(() => {
    if (activeTab === "Semua") {
      return jadwalHarian;
    }
    return jadwalHarian.filter(
      (schedule) =>
        (schedule.jenis_jadwal_display || schedule.jenis_baris) === activeTab
    );
  }, [jadwalHarian, activeTab]);

  // Get unique schedule types for tabs with counts
  const scheduleTypes = useMemo(() => {
    // Define all possible schedule types in desired order
    const allTypes = [
      "Kuliah Besar",
      "PBL",
      "Praktikum",
      "CSR Reguler",
      "CSR Responsi",
      "Jurnal Reading",
      "Agenda Khusus",
      "Non Blok Non CSR",
    ];

    // Count actual schedules
    const typeCounts = new Map<string, number>();
    jadwalHarian.forEach((schedule) => {
      const type = schedule.jenis_jadwal_display || schedule.jenis_baris;
      if (type) {
        typeCounts.set(type, (typeCounts.get(type) || 0) + 1);
      }
    });

    // Return all types with their counts (0 if not found)
    return allTypes.map((type) => ({
      type,
      count: typeCounts.get(type) || 0,
    }));
  }, [jadwalHarian]);

  const { ganjilLayouts, genapLayouts, antaraLayouts, colorMap, holidayMap } =
    useMemo(() => {
      const holidayMap = new Map<string, Holiday>();
      holidays.forEach((h) => {
        if (h.is_national_holiday && h.holiday_date) {
          // Normalize the date from API to YYYY-MM-DD format
          const date = new Date(h.holiday_date);
          const year = date.getFullYear();
          const month = (date.getMonth() + 1).toString().padStart(2, "0");
          const day = date.getDate().toString().padStart(2, "0");
          const normalizedDate = `${year}-${month}-${day}`;
          holidayMap.set(normalizedDate, h);
        }
      });

      // Filter out courses without valid dates
      const validCourses = data.filter((c) => {
        const start = c.tanggalMulai || c.tanggal_mulai;
        const end = c.tanggalAkhir || c.tanggal_akhir;
        return (
          start &&
          end &&
          !isNaN(new Date(start).getTime()) &&
          !isNaN(new Date(end).getTime())
        );
      });

      // Create CSR courses from CSR data
      const csrCourses = csrData
        .map((csr) => {
          const parentCourse = validCourses.find(
            (c) => c.kode === csr.mata_kuliah_kode
          );
          if (!parentCourse) return null;

          const csrNumber = parseInt(csr.nomor_csr.split(".")[1]);
          return {
            kode: `${csr.mata_kuliah_kode}_CSR_${csrNumber}`,
            nama: csr.nama,
            semester: parentCourse.semester,
            jenis: "CSR" as const,
            tanggalMulai: csr.tanggal_mulai,
            tanggalAkhir: csr.tanggal_akhir,
            tanggal_mulai: csr.tanggal_mulai,
            tanggal_akhir: csr.tanggal_akhir,
            csr_number: csrNumber,
            parent_course: parentCourse,
          };
        })
        .filter(Boolean) as any[];

      // Combine regular courses with CSR courses
      const allCourses = [...validCourses, ...csrCourses];

      // Split into ganjil (odd), genap (even), and antara semesters
      const ganjilCourses = allCourses.filter((c) => {
        const semester = parseInt(c.semester);
        return !isNaN(semester) && semester % 2 !== 0;
      });
      const genapCourses = allCourses.filter((c) => {
        const semester = parseInt(c.semester);
        return !isNaN(semester) && semester % 2 === 0;
      });
      const antaraCourses = allCourses.filter(
        (c) => c.semester === "Antara" || c.semester === "antara"
      );

      // Generate layouts for each semester group
      const ganjilLayouts = generateLayout(ganjilCourses);
      const genapLayouts = generateLayout(genapCourses);
      const antaraLayouts = generateLayout(antaraCourses);

      // Create color mapping for courses
      const colorMap = new Map<string, string>();
      let colorIndex = 0;

      allCourses.forEach((course) => {
        if (!colorMap.has(course.kode)) {
          if (
            course.jenis === "Blok" &&
            course.blok &&
            course.blok <= blokColors.length
          ) {
            // Use predefined color for Blok courses
            colorMap.set(course.kode, blokColors[course.blok - 1]);
          } else if (
            course.jenis === "CSR" &&
            course.csr_number &&
            course.csr_number <= csrColors.length
          ) {
            // Use predefined color for CSR courses
            colorMap.set(course.kode, csrColors[course.csr_number - 1]);
          } else if (course.jenis === "Non Blok") {
            // Use different colors for Non Blok based on tipe_non_block
            if (course.tipe_non_block === "CSR") {
              colorMap.set(course.kode, nonBlokCsrColor);
            } else if (course.tipe_non_block === "Non-CSR") {
              colorMap.set(course.kode, nonBlokNonCsrColor);
            } else {
              // Fallback for courses without tipe_non_block
              colorMap.set(course.kode, nonBlokCsrColor);
            }
          } else {
            // Fallback to rotating through tailwind colors
            colorMap.set(
              course.kode,
              tailwindColors[colorIndex % tailwindColors.length]
            );
            colorIndex++;
          }
        }
      });

      return {
        ganjilLayouts,
        genapLayouts,
        antaraLayouts,
        colorMap,
        holidayMap,
      };
    }, [data, holidays, csrData]);

  return (
    <div className="rounded-2xl border border-gray-200 bg-white dark:border-gray-800 dark:bg-white/[0.03]">
      <div className="px-5 pt-5 lg:px-6 lg:pt-6">
        <h3 className="text-lg font-semibold text-gray-800 dark:text-white/90">
          Peta Akademik
        </h3>
        <div className="mt-3 flex items-center gap-2 text-sm text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-3 py-2 rounded-lg border border-blue-200 dark:border-blue-800/30">
          <svg
            className="w-4 h-4 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
          <span className="font-medium">Tips:</span>
          <span>
            Klik pada bar mata kuliah untuk melihat jadwal harian lengkap
          </span>
        </div>
      </div>
      <div className="px-5 pb-5 lg:px-6 lg:pb-6">
        {loading ? (
          <PetaAkademikSkeleton />
        ) : error ? (
          <div className="text-red-500">{error}</div>
        ) : (
          <div className="text-gray-800 dark:text-white p-4">
            <AnimatePresence>
              {ganjilLayouts.size > 0 && (
                <div>
                  <h3 className="text-xl font-bold mb-4">Semester Ganjil</h3>
                  <CalendarTable
                    semesterLayouts={ganjilLayouts}
                    colorMap={colorMap}
                    holidayMap={holidayMap}
                    onCourseClick={handleCourseClick}
                  />
                </div>
              )}
            </AnimatePresence>

            {genapLayouts.size > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">Semester Genap</h3>
                <CalendarTable
                  semesterLayouts={genapLayouts}
                  colorMap={colorMap}
                  holidayMap={holidayMap}
                  onCourseClick={handleCourseClick}
                />
              </div>
            )}

            {antaraLayouts.size > 0 && (
              <div className="mt-8">
                <h3 className="text-xl font-bold mb-4">Semester Antara</h3>
                <CalendarTable
                  semesterLayouts={antaraLayouts}
                  colorMap={colorMap}
                  holidayMap={holidayMap}
                  onCourseClick={handleCourseClick}
                />
              </div>
            )}

            {(ganjilLayouts.size > 0 ||
              genapLayouts.size > 0 ||
              antaraLayouts.size > 0) && (
              <div className="mt-8">
                <h3 className="text-md font-bold mb-3">Legenda Warna</h3>
                <div className="flex flex-wrap gap-x-6 gap-y-2">
                  {/* Blok courses */}
                  {blokColors.map((color, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <div className={`w-4 h-4 rounded-sm ${color}`}></div>
                      <span className="text-gray-700 dark:text-gray-300">
                        Blok {idx + 1}
                      </span>
                    </div>
                  ))}
                  {/* Non Blok courses */}
                  <div className="flex items-center gap-2 text-sm">
                    <div
                      className={`w-4 h-4 rounded-sm ${nonBlokCsrColor}`}
                    ></div>
                    <span className="text-gray-700 dark:text-gray-300">
                      Non Blok CSR
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div
                      className={`w-4 h-4 rounded-sm ${nonBlokNonCsrColor}`}
                    ></div>
                    <span className="text-gray-700 dark:text-gray-300">
                      Non Blok Non CSR
                    </span>
                  </div>
                  {/* CSR courses */}
                  {csrColors.map((color, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <div className={`w-4 h-4 rounded-sm ${color}`}></div>
                      <span className="text-gray-700 dark:text-gray-300">
                        CSR {idx + 1}
                      </span>
                    </div>
                  ))}
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 rounded-sm bg-red-500 dark:bg-red-400"></div>
                    <span className="text-gray-700 dark:text-gray-300">
                      Hari Libur Nasional
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <div className="w-4 h-4 rounded-sm bg-gray-200 dark:bg-gray-700"></div>
                    <span className="text-gray-700 dark:text-gray-300">
                      Libur Akhir Pekan Sabtu & Minggu
                    </span>
                  </div>
                </div>
              </div>
            )}

            {holidays.length > 0 && (
              <div className="mt-8">
                <h3 className="text-md font-bold mb-3">
                  Keterangan Hari Libur Nasional
                </h3>
                <div className="max-h-48 overflow-y-auto custom-scrollbar rounded-lg border border-gray-200 dark:border-gray-700 p-3 bg-gray-50 dark:bg-gray-800/50">
                  <ul className="space-y-2">
                    {holidays
                      .filter((h) => h.is_national_holiday)
                      .sort(
                        (a, b) =>
                          new Date(a.holiday_date).getTime() -
                          new Date(b.holiday_date).getTime()
                      )
                      .map((holiday) => (
                        <li
                          key={holiday.holiday_date}
                          className="text-sm text-gray-800 dark:text-gray-200"
                        >
                          <span className="font-semibold text-red-600 dark:text-red-400">
                            {new Date(holiday.holiday_date).toLocaleDateString(
                              "id-ID",
                              { day: "numeric", month: "long", year: "numeric" }
                            )}
                            :
                          </span>
                          <span className="ml-2">{holiday.holiday_name}</span>
                        </li>
                      ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modal Detail Jadwal Harian */}
      <AnimatePresence>
        {isModalOpen && selectedCourse && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center">
            {/* Overlay */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100000] bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
              onClick={closeModal}
            ></motion.div>

            {/* Modal Content */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-6xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-[100001] max-h-[90vh] overflow-y-auto hide-scroll"
            >
              {/* Close Button */}
              <button
                onClick={closeModal}
                className="absolute z-20 flex items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-700 dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white right-6 top-6 h-11 w-11"
              >
                <svg
                  width="20"
                  height="20"
                  fill="none"
                  viewBox="0 0 24 24"
                  className="w-6 h-6"
                >
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M6.04289 16.5413C5.65237 16.9318 5.65237 17.565 6.04289 17.9555C6.43342 18.346 7.06658 18.346 7.45711 17.9555L11.9987 13.4139L16.5408 17.956C16.9313 18.3466 17.5645 18.3466 17.955 17.956C18.3455 17.5655 18.3455 16.9323 17.955 16.5418L13.4129 11.9997L17.955 7.4576C18.3455 7.06707 18.3455 6.43391 17.955 6.04338C17.5645 5.65286 16.9313 5.65286 16.5408 6.04338L11.9987 10.5855L7.45711 6.0439C7.06658 5.65338 6.43342 5.65338 6.04289 6.0439C5.65237 6.43442 5.65237 7.06759 6.04289 7.45811L10.5845 11.9997L6.04289 16.5413Z"
                    fill="currentColor"
                  />
                </svg>
              </button>

              <div>
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-4 sm:pb-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/20 rounded-xl flex items-center justify-center">
                      <svg
                        className="w-6 h-6 text-blue-600 dark:text-blue-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold text-gray-800 dark:text-white">
                        {selectedCourse.jenis === "CSR" &&
                        selectedCourse.parent_course
                          ? selectedCourse.parent_course.nama
                          : selectedCourse.nama}
                      </h2>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        {selectedCourse.jenis === "CSR" &&
                        selectedCourse.parent_course
                          ? selectedCourse.parent_course.kode
                          : selectedCourse.kode}{" "}
                        • {selectedCourse.jenis} • Semester{" "}
                        {selectedCourse.semester}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Modal Content */}
                <div className="space-y-6">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                      Jadwal Lengkap
                    </h3>
                    <div className="flex items-center gap-2">
                      {isLoadingJadwal ? (
                        <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                          <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin"></div>
                          <span>Memuat...</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-800 px-3 py-1 rounded-full">
                          {filteredJadwalHarian.length} dari {jadwalHarian.length} jadwal
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Tab Filters */}
                  {!isLoadingJadwal && (
                    <div className="flex flex-wrap gap-2 pb-2 border-b border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => setActiveTab("Semua")}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 ${
                          activeTab === "Semua"
                            ? "bg-blue-500 text-white shadow-md"
                            : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                        }`}
                      >
                        <span>Semua</span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs ${
                            activeTab === "Semua"
                              ? "bg-blue-600 text-white"
                              : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                          }`}
                        >
                          {jadwalHarian.length}
                        </span>
                      </button>
                      {scheduleTypes.map(({ type, count }) => (
                        <button
                          key={type}
                          onClick={() => setActiveTab(type)}
                          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors duration-200 flex items-center gap-2 ${
                            activeTab === type
                              ? "bg-blue-500 text-white shadow-md"
                              : count === 0
                              ? "bg-gray-100 text-gray-400 cursor-default dark:bg-gray-800 dark:text-gray-500"
                              : "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
                          }`}
                          disabled={count === 0 && activeTab !== type}
                        >
                          <span>{type}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-xs ${
                              activeTab === type
                                ? "bg-blue-600 text-white"
                                : count === 0
                                ? "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                                : "bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300"
                            }`}
                          >
                            {count}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="bg-gray-50 dark:bg-gray-900/50 rounded-2xl p-6">
                    {isLoadingJadwal ? (
                      <JadwalHarianSkeleton />
                    ) : filteredJadwalHarian.length > 0 ? (
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-gray-200 dark:border-gray-600">
                              <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white w-80 whitespace-nowrap">
                                Tanggal
                              </th>
                              <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white w-32 whitespace-nowrap">
                                Jam
                              </th>
                              <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white w-40 whitespace-nowrap">
                                Jenis
                              </th>
                              <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">
                                Materi/Agenda
                              </th>
                              <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">
                                Dosen
                              </th>
                              <th className="text-left py-4 px-4 font-semibold text-gray-900 dark:text-white">
                                Ruangan
                              </th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                            {filteredJadwalHarian.map((schedule, index) => (
                              <tr
                                key={index}
                                className="hover:bg-white dark:hover:bg-gray-800/50 transition-colors duration-200"
                              >
                                <td className="py-4 px-4 text-sm text-gray-900 dark:text-white whitespace-nowrap">
                                  {new Date(
                                    schedule.tanggal
                                  ).toLocaleDateString("id-ID", {
                                    weekday: "long",
                                    year: "numeric",
                                    month: "long",
                                    day: "numeric",
                                  })}
                                </td>
                                <td className="py-4 px-4 text-sm text-gray-900 dark:text-white whitespace-nowrap font-medium">
                                  {schedule.jam_mulai} - {schedule.jam_selesai}
                                </td>
                                <td className="py-4 px-4 whitespace-nowrap">
                                  <span
                                    className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${getBadgeColor(
                                      (schedule as any).jenis_jadwal_display ||
                                        (schedule.jenis_baris === "materi"
                                          ? "Materi"
                                          : "Agenda")
                                    )}`}
                                  >
                                    {(schedule as any).jenis_jadwal_display ||
                                      (schedule.jenis_baris === "materi"
                                        ? "Materi"
                                        : "Agenda")}
                                  </span>
                                </td>
                                <td className="py-4 px-4 text-sm text-gray-900 dark:text-white">
                                  <div className="max-w-xs">
                                    <p className="truncate">
                                      {schedule.materi ||
                                        schedule.agenda ||
                                        "-"}
                                    </p>
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-sm text-gray-900 dark:text-white">
                                  <div className="max-w-xs">
                                    <p className="truncate">
                                      {schedule.dosen?.name ||
                                        (schedule as any).dosen_names ||
                                        "-"}
                                    </p>
                                  </div>
                                </td>
                                <td className="py-4 px-4 text-sm text-gray-900 dark:text-white">
                                  <div className="max-w-xs">
                                    <p className="truncate">
                                      {schedule.ruangan?.nama || "-"}
                                    </p>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <div className="text-center py-16">
                        <div className="mx-auto w-20 h-20 bg-gray-100 dark:bg-gray-700 rounded-2xl flex items-center justify-center mb-6">
                          <svg
                            className="w-10 h-10 text-gray-400"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                            />
                          </svg>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                          {activeTab === "Semua"
                            ? "Tidak ada jadwal"
                            : `Tidak ada jadwal ${activeTab}`}
                        </h3>
                        <p className="text-gray-500 dark:text-gray-400 max-w-sm mx-auto">
                          {activeTab === "Semua"
                            ? "Belum ada jadwal harian untuk mata kuliah ini. Silakan hubungi administrator untuk menambahkan jadwal."
                            : `Tidak ada jadwal dengan jenis ${activeTab} untuk mata kuliah ini.`}
                        </p>
                        {activeTab !== "Semua" && jadwalHarian.length > 0 && (
                          <button
                            onClick={() => setActiveTab("Semua")}
                            className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors duration-200"
                          >
                            Lihat Semua Jadwal
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
