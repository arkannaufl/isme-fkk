import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import MaintenanceGuard from '../components/common/MaintenanceGuard';

const sesiHarian = [
  { jam: '07.20-08.10' },
  { jam: '08.10-09.00' },
  { jam: '09.00-09.50' },
  { jam: '09.50-10.40' },
  { jam: '10.40-11.30' },
  { jam: '11.30-12.35', isIstirahat: true },
  { jam: '12.35-13.25' },
  { jam: '13.25-14.15' },
  { jam: '14.15-15.05' },
  { jam: '15.05-15.35', isIstirahat: true },
  { jam: '15.35-16.25' },
  { jam: '16.25-17.15' },
];

// Generate 31 hari (Senin s/d Minggu, tanggal berurutan)
const hariNames = ['SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU', 'MINGGU'];
const hariList = Array.from({ length: 31 }, (_, i) => {
  const date = new Date(2025, 6, 7 + i); // Mulai 7 Juli 2025
  const hari = hariNames[i % 7];
  const tanggal = date.toLocaleDateString('id-ID');
  return { hari, tanggal };
});

// semesterKolom tetap
const semesterGanjil = [
  { nama: 'SEMESTER I', mataKuliah: 'REPRODUKSI 1 : CIRENDEU' },
  { nama: 'SEMESTER III', mataKuliah: 'KARDIOVASKULER : CIRENDEU' },
  { nama: 'SEMESTER V', mataKuliah: 'PSIKIATRI : CIRENDEU' },
  { nama: 'SEMESTER VII', mataKuliah: 'ANESTESI : CIRENDEU' },
];
const semesterGenap = [
  { nama: 'SEMESTER II', mataKuliah: 'REPRODUKSI 2 : CIRENDEU' },
  { nama: 'SEMESTER IV', mataKuliah: 'KARDIOVASKULER 2 : CIRENDEU' },
  { nama: 'SEMESTER VI', mataKuliah: 'PSIKIATRI 2 : CIRENDEU' },
  { nama: 'SEMESTER VIII', mataKuliah: 'ANESTESI 2 : CIRENDEU' },
];

// Dummy kegiatanData 4 semester x 31 hari x 12 sesi
const kegiatanData = Array.from({ length: 4 }, () =>
  Array.from({ length: 31 }, () => Array(12).fill(null))
);
// Hapus pengisian seluruh data dengan durasi 1
// for (let h = 0; h < 31; h++) {
//   kegiatanData[0][h][0] = { nama: pelajaranSesi1[h % pelajaranSesi1.length], durasi: 1 };
//   kegiatanData[0][h][1] = { nama: pelajaranSesi2[h % pelajaranSesi2.length], durasi: 1 };
// }
// Contoh: Hari ke-0, sesi 1: Biologi (1 sesi), sesi 2-3: Matematika (2 sesi)
kegiatanData[0][0][0] = { nama: 'Biologi', durasi: 1 };
kegiatanData[0][0][1] = { nama: 'Matematika', durasi: 2 };
kegiatanData[0][0][2] = null; // pastikan cell di bawahnya kosong (rowSpan)
// sesi 2 (09.00–09.50) otomatis di-cover rowSpan, jadi biarkan null

// Semester III: setiap Rabu sesi 3-4 = "Kimia" (2 sesi)
for (let h = 0; h < hariList.length; h++) {
  if (hariList[h].hari === 'RABU') {
    kegiatanData[1][h][2] = { nama: 'Kimia', durasi: 2 };
  }
}
// Semester V: setiap Jumat sesi 5-6 = "Fisika" (2 sesi)
for (let h = 0; h < hariList.length; h++) {
  if (hariList[h].hari === 'JUMAT') {
    kegiatanData[2][h][4] = { nama: 'Fisika', durasi: 2 };
  }
}
// Reset seluruh data Semester VII (kegiatanData[3]) ke null (tidak ada rowSpan sama sekali)
for (let h = 0; h < 31; h++) {
  for (let s = 0; s < 12; s++) {
    kegiatanData[3][h][s] = null;
  }
}
// Jika ingin benar-benar tidak ada pelajaran di Semester VII, hapus pengisian Matematika Sabtu
export default function PetaBlok() {
  const { semester, blok } = useParams();
  const navigate = useNavigate();

  // Tentukan ganjil/genap dari semester param
  const isGanjil = semester && parseInt(semester) % 2 === 1;
  const semesterKolom = isGanjil ? semesterGanjil : semesterGenap;

  // Pagination state
  const PAGE_SIZE_OPTIONS = [5, 7, 10, 15, 30];
  const [pageSize, setPageSize] = useState(7);
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(hariList.length / pageSize);
  // Hapus baris berikut jika tidak digunakan:
  // const filteredHariList = hariList.slice(page * pageSize, (page + 1) * pageSize);
  // Ganti parameter sem, hariIdx yang tidak digunakan di dalam map/loop dengan _

  const prevPage = () => setPage((p) => Math.max(0, p - 1));
  const nextPage = () => setPage((p) => Math.min(totalPages - 1, p + 1));
  const goToPage = (idx: number) => setPage(idx);
  const handlePageSizeChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setPageSize(Number(e.target.value));
    setPage(0);
  };

  // (Optional) Search bar for hari
  const [search, setSearch] = useState('');
  const filteredHariListForSearch = search.trim()
    ? hariList.filter(h => h.hari.toLowerCase().includes(search.toLowerCase()) || h.tanggal.includes(search))
    : hariList;
  const filteredTotalPages = Math.ceil(filteredHariListForSearch.length / pageSize);
  const filteredHariPage = filteredHariListForSearch.slice(page * pageSize, (page + 1) * pageSize);

  // Untuk skip cell yang sudah di-cover rowSpan
  function shouldRenderCell(semIdx: number, hariIdx: number, sesiIdx: number) {
    for (let prev = 1; prev <= sesiIdx; prev++) {
      const prevData = kegiatanData[semIdx][hariIdx][sesiIdx - prev];
      if (prevData && prevData.durasi > prev) {
        return false;
      }
    }
    return true;
  }

  // Export ke Excel
  function exportJadwalToExcel() {
    // Header 3 baris
    const header1 = ['HARI / TANGGAL', 'JAM', ...semesterKolom.map(sem => sem.nama)];
    const header2 = ['', '', ...semesterKolom.map(sem => sem.mataKuliah)];
    const header3 = ['', '', ...semesterKolom.map(() => 'KEGIATAN')];
    const rows = [header1, header2, header3];
    const merges: { s: { r: number, c: number }, e: { r: number, c: number } }[] = [];
    // Merge header HARI/TANGGAL
    merges.push({ s: { r: 0, c: 0 }, e: { r: 2, c: 0 } });
    merges.push({ s: { r: 0, c: 1 }, e: { r: 2, c: 1 } });
    semesterKolom.forEach((_, semIdx) => {
      merges.push({ s: { r: 0, c: 2 + semIdx }, e: { r: 0, c: 2 + semIdx } });
      merges.push({ s: { r: 1, c: 2 + semIdx }, e: { r: 1, c: 2 + semIdx } });
      merges.push({ s: { r: 2, c: 2 + semIdx }, e: { r: 2, c: 2 + semIdx } });
    });
    let rowIdx = 3;
    for (let h = 0; h < hariList.length; h++) {
      for (let s = 0; s < sesiHarian.length; s++) {
        if (s === 0) {
          // Gabungkan hari dan tanggal dalam satu cell, multi-line
          const hariTanggal = `${hariList[h].hari.toUpperCase()}\n${hariList[h].tanggal}`;
          const row = [hariTanggal, sesiHarian[s].jam];
          semesterKolom.forEach((_, semIdx) => {
            const val = kegiatanData[semIdx][h][s];
            if (val && val.durasi > 1) {
              row.push(val.nama);
              const colIdx = 2 + semIdx;
              merges.push({ s: { r: rowIdx, c: colIdx }, e: { r: rowIdx + val.durasi - 1, c: colIdx } });
            } else if (shouldRenderCell(semIdx, h, s)) {
              row.push(val && val.nama ? val.nama : '');
            }
          });
          rows.push(row);
          // Merge cell hari/tanggal ke bawah
          merges.push({ s: { r: rowIdx, c: 0 }, e: { r: rowIdx + sesiHarian.length - 1, c: 0 } });
        } else {
          const row = ['', sesiHarian[s].jam];
          semesterKolom.forEach((_, semIdx) => {
            const val = kegiatanData[semIdx][h][s];
            if (val && val.durasi > 1) {
              row.push('');
            } else if (shouldRenderCell(semIdx, h, s)) {
              row.push(val && val.nama ? val.nama : '');
            }
          });
          rows.push(row);
        }
        rowIdx++;
      }
    }
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws['!merges'] = merges;
    ws['!cols'] = [
      { wch: 18 }, // HARI/TANGGAL
      { wch: 12 }, // JAM
      ...semesterKolom.map(() => ({ wch: 28 }))
    ];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Jadwal');
    XLSX.writeFile(wb, 'JadwalBlok.xlsx');
  }

  function exportJadwalToHTML() {
    // CSS mirip web
    const css = `
      <style>
        table { border-collapse: collapse; width: 100%; font-family: Arial, sans-serif; }
        th, td { border: 1px solid #E5E7EB; padding: 8px; text-align: center; }
        th { background: #F3F4F6; color: #1E293B; font-weight: bold; font-size: 14px; }
        .matkul { font-weight: normal; color: #64748B; font-size: 12px; }
        .kegiatan { font-weight: normal; color: #64748B; font-size: 12px; }
        .hari { font-weight: bold; font-size: 15px; color: #1E293B; }
        .tanggal { color: #64748B; font-size: 12px; }
        .istirahat { color: #64748B; font-style: italic; background: #F3F4F6; }
        .even { background: #FAFAFA; }
        .odd { background: #FFFFFF; }
        .sticky-header th { position: sticky; top: 0; z-index: 2; }
      </style>
    `;
    // Header 3 baris
    let html = '<table>\n';
    html += '<thead class="sticky-header">\n';
    html += '<tr>';
    html += '<th rowspan="3">HARI / TANGGAL</th>';
    html += '<th rowspan="3">JAM</th>';
    semesterKolom.forEach(sem => {
      html += `<th colspan="1">${sem.nama}</th>`;
    });
    html += '</tr>\n<tr>';
    semesterKolom.forEach(sem => {
      html += `<th class="matkul">${sem.mataKuliah}</th>`;
    });
    html += '</tr>\n<tr>';
    semesterKolom.forEach(() => {
      html += '<th class="kegiatan">KEGIATAN</th>';
    });
    html += '</tr>\n';
    html += '</thead>\n<tbody>\n';
    for (let h = 0; h < hariList.length; h++) {
      for (let s = 0; s < sesiHarian.length; s++) {
        const isIstirahat = !!sesiHarian[s].isIstirahat;
        const rowClass = isIstirahat ? 'istirahat' : (s % 2 === 0 ? 'even' : 'odd');
        html += `<tr class="${rowClass}">`;
        if (s === 0) {
          html += `<td rowspan="${sesiHarian.length}"><div class="hari">${hariList[h].hari.toUpperCase()}</div><div class="tanggal">${hariList[h].tanggal}</div></td>`;
        }
        html += `<td>${sesiHarian[s].jam}</td>`;
        if (isIstirahat) {
          html += `<td class="istirahat" colspan="${semesterKolom.length}">Istirahat</td>`;
        } else {
          semesterKolom.forEach((_, semIdx) => {
            const val = kegiatanData[semIdx][h][s];
            if (val && val.durasi > 1) {
              html += `<td rowspan="${val.durasi}">${val.nama}</td>`;
            } else if (shouldRenderCell(semIdx, h, s)) {
              html += `<td>${val && val.nama ? val.nama : ''}</td>`;
            }
          });
        }
        html += '</tr>\n';
      }
      // Tambahkan baris pemisah antar hari
      html += `<tr><td colspan="${2 + semesterKolom.length}" style="background: #F3F4F6; height: 16px; border: none;"></td></tr>\n`;
    }
    html += '</tbody></table>';
    // Download file
    const blob = new Blob([`<html><head>${css}</head><body>${html}</body></html>`], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'JadwalBlok.html';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Tambahkan fungsi utilitas pewarnaan baris
  function getRowClass(isIstirahat: boolean, sesiIdx: number) {
    if (isIstirahat) return 'bg-gray-100 dark:bg-gray-700';
    return sesiIdx % 2 === 1 ? 'bg-gray-50 dark:bg-gray-800' : 'bg-white dark:bg-gray-900';
  }

  // Cari index hari ini di hariList
  const today = new Date();
  const todayStr = today.toLocaleDateString('id-ID');
  const todayIdx = hariList.findIndex(h => h.tanggal === todayStr);
  const jadwalHariIni = todayIdx !== -1 ? hariList[todayIdx] : null;

  return (
    <MaintenanceGuard
      maintenanceConfig={{
        title: "Peta Blok Sedang Dalam Perbaikan",
        message: "Fitur Peta Blok sedang dalam proses perbaikan untuk memberikan pengalaman yang lebih baik. Mohon maaf atas ketidaknyamanan ini.",
        showIcon: true
      }}
    >
      <div className="max-w-7xl mx-auto mt-">
      {/* Header */}
      <div className="flex flex-col gap-2 pt-1 ">
        <button
          onClick={() => navigate('/peta-blok', { state: { semester: isGanjil ? 'ganjil' : 'genap' } })}
          className="mb-4 flex items-center gap-2 text-brand-500 hover:text-brand-600 text-sm font-medium bg-transparent border-none focus:outline-none"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          Kembali
        </button>
        <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Peta Jadwal Blok Perkuliahan</h1>
        <div className="flex flex-wrap gap-4 items-center text-sm text-gray-500 dark:text-gray-300">
          {/* <span>Semester: <b>{semester}</b></span> */}
          <span>Blok: <b>{blok}</b></span>
        </div>
      </div>
      {/* Section Jadwal Hari Ini */}
      <div className="mb-8 mt-10">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-brand-200 text-brand-600 text-lg font-bold">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10m-9 4h6m-7 4h8m-9-8h10m-9 4h6m-7 4h8" /></svg>
          </span>
          <h2 className="font-bold text-xl dark:text-white text-gray-800">Jadwal Hari Ini</h2>
          {/* <span className="ml-2 px-2 py-1 rounded bg-gray-200 text-gray-700 text-xs font-bold">HARI INI</span> */}
        </div>
        {jadwalHariIni ? (
          <div className="overflow-hidden rounded-2xl border border-gray-200 mt-10 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
            <div className="max-w-full overflow-x-auto hide-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
              <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
                  <tr>
                    <th rowSpan={3} className="w-24 px-4 py-2 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle text-sm font-medium dark:text-white">HARI</th>
                    <th rowSpan={3} className="w-32 px-4 py-2 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle text-sm font-medium dark:text-white">JAM</th>
                    {semesterKolom.map((sem) => (
                      <th key={sem.nama} className="px-4 py-2 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle text-brand-700 dark:text-brand-300 text-base font-medium border-r last:border-r-0">{sem.nama}</th>
                    ))}
                  </tr>
                  <tr>
                    {semesterKolom.map((sem) => (
                      <th key={sem.nama + '-matkul'} className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle border-r last:border-r-0 text-xs font-normal dark:text-gray-200">{sem.mataKuliah}</th>
                    ))}
                  </tr>
                  <tr>
                    {semesterKolom.map((sem) => (
                      <th key={sem.nama + '-kegiatan'} className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle border-r last:border-r-0 text-xs font-normal dark:text-gray-200">KEGIATAN</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sesiHarian.map((sesi, sesiIdx) => {
                    const isIstirahat = sesi.isIstirahat;
                    return (
                      <tr key={sesiIdx} className={getRowClass(!!isIstirahat, sesiIdx)}>
                        {sesiIdx === 0 && (
                          <td rowSpan={sesiHarian.length} className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-center align-middle bg-gray-50 dark:bg-gray-900 text-xs font-medium dark:text-gray-200">
                            <span className="font-bold text-base text-gray-800 dark:text-white">{jadwalHariIni.hari}</span>
                            <br />
                            <span className="text-xs text-gray-400">{jadwalHariIni.tanggal}</span>
                          </td>
                        )}
                        <td className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-center align-middle bg-gray-50 dark:bg-gray-900 text-xs font-normal dark:text-gray-200 min-w-[8rem] whitespace-pre-line">{sesi.jam}</td>
                        {isIstirahat ? (
                          <td colSpan={semesterKolom.length} className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-center italic text-gray-400 bg-gray-100 dark:bg-gray-700 font-normal">Istirahat</td>
                        ) : (
                          semesterKolom.map((sem, semIdx) => {
                            const val = kegiatanData[semIdx][todayIdx][sesiIdx];
                            if (!shouldRenderCell(semIdx, todayIdx, sesiIdx)) return null;
                            if (val && val.durasi > 1) {
                              return (
                                <td
                                  key={sem.nama + '-' + sesiIdx}
                                  rowSpan={val.durasi}
                                  className={`flex items-center justify-center h-full px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-center align-top border-r last:border-r-0 min-w-[16rem] dark:text-brand-200 text-brand-700`}
                                >
                                  {val.nama}
                                </td>
                              );
                            } else if (val && val.durasi === 1) {
                              return (
                                <td
                                  key={sem.nama + '-' + sesiIdx}
                                  className={`flex items-center justify-center h-full px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-center align-top border-r last:border-r-0 min-w-[16rem] dark:text-brand-200 text-brand-700`}
                                >
                                  {val.nama}
                                </td>
                              );
                            } else {
                              return (
                                <td
                                  key={sem.nama + '-' + sesiIdx}
                                  className={`px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-center align-top border-r last:border-r-0 min-w-[16rem] dark:text-gray-200 bg-inherit`}
                                >
                                  {/* kosong */}
                                </td>
                              );
                            }
                          })
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="text-gray-400 italic">Tidak ada jadwal hari ini.</div>
        )}
      </div>
      {/* Tombol Export ke Excel */}
      <div className="flex justify-end mb-2 mt-10">
        <div className="flex gap-2 mb-4">
          <button
            className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded shadow"
            onClick={exportJadwalToExcel}
          >
            Export ke Excel
          </button>
          <button
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded shadow"
            onClick={exportJadwalToHTML}
          >
            Export ke HTML (Excel Style)
          </button>
        </div>
      </div>
      {/* Search & Pagination Controls */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 w-full md:w-72">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none">
            <svg className="fill-gray-500 dark:fill-gray-400" width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" clipRule="evenodd" d="M3.04175 9.37363C3.04175 5.87693 5.87711 3.04199 9.37508 3.04199C12.8731 3.04199 15.7084 5.87693 15.7084 9.37363C15.7084 12.8703 12.8731 15.7053 9.37508 15.7053C5.87711 15.7053 3.04175 12.8703 3.04175 9.37363ZM9.37508 1.54199C5.04902 1.54199 1.54175 5.04817 1.54175 9.37363C1.54175 13.6991 5.04902 17.2053 9.37508 17.2053C11.2674 17.2053 13.003 16.5344 14.357 15.4176L17.177 18.238C17.4699 18.5309 17.9448 18.5309 18.2377 18.238C18.5306 17.9451 18.5306 17.4703 18.2377 17.1774L15.418 14.3573C16.5365 13.0033 17.2084 11.2669 17.2084 9.37363C17.2084 5.04817 13.7011 1.54199 9.37508 1.54199Z" fill="" />
            </svg>
          </span>
          <input
            type="text"
            placeholder="Cari hari atau tanggal..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0); }}
            className="h-11 w-full rounded-lg border border-gray-200 bg-transparent py-2.5 pl-12 pr-4 text-sm text-gray-800 shadow-theme-xs placeholder:text-gray-400 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-800 dark:bg-white/[0.03] dark:text-white/90 dark:placeholder:text-white/30 dark:focus:border-brand-800"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 justify-end w-full md:w-auto">
          <label className="text-xs text-gray-500 dark:text-gray-300">Tampil per halaman:</label>
          <select
            value={pageSize}
            onChange={handlePageSizeChange}
            className="px-2 py-1 rounded-lg border border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-800 dark:text-white text-sm focus:outline-none"
          >
            {PAGE_SIZE_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <span className="text-xs text-gray-500 dark:text-gray-400">
            Menampilkan {filteredHariPage.length} dari {filteredHariListForSearch.length} hari
          </span>
          <button
            onClick={prevPage}
            disabled={page === 0}
            className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50`}
          >
            Prev
          </button>
          {Array.from({ length: filteredTotalPages }, (_, i) => (
            <button
              key={i}
              onClick={() => goToPage(i)}
              className={`px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 ${
                page === i
                  ? 'bg-brand-500 text-white'
                  : 'bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
              } transition`}
            >
              {i + 1}
            </button>
          ))}
          <button
            onClick={nextPage}
            disabled={page === filteredTotalPages - 1}
            className="px-3 py-1 rounded-lg text-sm font-medium border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 transition disabled:opacity-50"
          >
            Next
          </button>
          <div className="flex items-center gap-1 ml-2">
            <span className="text-xs text-gray-500 dark:text-gray-300">Lompat ke hari:</span>
            <select
              className="px-2 py-1 rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-200 text-xs font-medium focus:ring-2 focus:ring-brand-400 focus:outline-none"
              value={page}
              onChange={e => goToPage(Number(e.target.value))}
            >
              {Array.from({ length: filteredTotalPages }).map((_, i) => (
                <option key={i} value={i}>Hari {i * pageSize + 1}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      {/* Tabel Jadwal */}
      <div className="overflow-hidden rounded-2xl border border-gray-200 mt-10 bg-white dark:border-white/[0.05] dark:bg-white/[0.03]">
        <div className="max-w-full overflow-x-auto hide-scroll" style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
          <style>{`
            .max-w-full::-webkit-scrollbar { display: none; }
            .hide-scroll { -ms-overflow-style: none; scrollbar-width: none; }
            .hide-scroll::-webkit-scrollbar { display: none; }
          `}</style>
          <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
            <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900 sticky top-0 z-10">
              <tr>
                <th rowSpan={3} className="w-24 px-4 py-2 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle text-sm font-medium dark:text-white">HARI</th>
                <th rowSpan={3} className="w-32 px-4 py-2 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle text-sm font-medium dark:text-white">JAM</th>
                {semesterKolom.map((sem) => (
                  <th key={sem.nama} className="px-4 py-2 border-b border-gray-300 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle text-brand-700 dark:text-brand-300 text-base font-medium border-r last:border-r-0">{sem.nama}</th>
              ))}
            </tr>
            <tr>
                {semesterKolom.map((sem) => (
                <th key={sem.nama + '-matkul'} className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle border-r last:border-r-0 text-xs font-normal dark:text-gray-200">{sem.mataKuliah}</th>
              ))}
            </tr>
            <tr>
                {semesterKolom.map((sem) => (
                  <th key={sem.nama + '-kegiatan'} className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 text-center align-middle border-r last:border-r-0 text-xs font-normal dark:text-gray-200">KEGIATAN</th>
              ))}
            </tr>
          </thead>
          <tbody>
              {filteredHariPage.length === 0 ? (
                <tr>
                  <td colSpan={2 + semesterKolom.length} className="text-center py-8 text-gray-400 dark:text-gray-500">Tidak ada data hari.</td>
                </tr>
              ) : (
                filteredHariPage.map((hari, _) => {
                  const globalHariIdx = filteredHariListForSearch.indexOf(hari);
                  return sesiHarian.map((sesi, sesiIdx) => {
                    const isFirstSesi = sesiIdx === 0;
                    const isIstirahat = sesi.isIstirahat;
                    return (
                      <tr key={hari.hari + '-' + sesiIdx} className={getRowClass(!!isIstirahat, sesiIdx)}>
                        {isFirstSesi && (
                          <td rowSpan={sesiHarian.length} className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-center align-middle bg-gray-50 dark:bg-gray-900 text-xs font-medium dark:text-gray-200">
                            {hari.hari} <br /> <span className="text-xs text-gray-400">{hari.tanggal}</span>
                          </td>
                        )}
                        <td className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-center align-middle bg-gray-50 dark:bg-gray-900 text-xs font-normal dark:text-gray-200 min-w-[8rem] whitespace-pre-line">{sesi.jam}</td>
                        {isIstirahat ? (
                          <td colSpan={semesterKolom.length} className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-center italic text-gray-400 bg-gray-100 dark:bg-gray-700 font-normal">Istirahat</td>
                        ) : (
                          semesterKolom.map((sem, semIdx) => {
                            if (!shouldRenderCell(semIdx, globalHariIdx, sesiIdx)) return null;
                            const val = kegiatanData[semIdx][globalHariIdx][sesiIdx];
                            if (val && val.durasi > 1) {
                              return (
                                <td
                                  key={sem.nama + '-' + hari.hari + '-' + sesiIdx}
                                  rowSpan={val.durasi}
                                  className={`flex items-center justify-center h-full px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-center align-top border-r last:border-r-0 min-w-[16rem] dark:text-brand-200 text-brand-700`}
                                >
                                  {val.nama}
                                </td>
                              );
                            } else if (val && val.durasi === 1) {
                              return (
                                <td
                                  key={sem.nama + '-' + hari.hari + '-' + sesiIdx}
                                  className={`flex items-center justify-center h-full px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-center align-top border-r last:border-r-0 min-w-[16rem] dark:text-brand-200 text-brand-700`}
                                >
                                  {val.nama}
                                </td>
                              );
                            } else {
                              return (
                                <td
                                  key={sem.nama + '-' + hari.hari + '-' + sesiIdx}
                                  className={`px-4 py-2 border-b border-gray-200 dark:border-gray-700 text-xs text-center align-top border-r last:border-r-0 min-w-[16rem] dark:text-gray-200 bg-inherit`}
                                >
                                  {/* kosong */}
                                </td>
                              );
                            }
                          })
                        )}
                      </tr>
                    );
                  });
                })
              )}
          </tbody>
        </table>
        </div>
        {/* Legenda warna dummy ... */}
      </div>
      </div>
    </MaintenanceGuard>
  );
} 
