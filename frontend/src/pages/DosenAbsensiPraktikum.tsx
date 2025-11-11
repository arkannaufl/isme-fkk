import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useState, useEffect, useCallback, useRef } from 'react';
import api, { handleApiError } from '../utils/api';
import { ChevronLeftIcon } from '../icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faUsers, faDesktop, faSpinner, faFileExcel, faFilePdf } from '@fortawesome/free-solid-svg-icons';
import { AnimatePresence, motion } from 'framer-motion';
import { QRCodeSVG as QRCode } from 'qrcode.react';
import { UserIcon } from '../icons';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { saveAs } from 'file-saver';

interface Mahasiswa {
  id: number;
  nim: string;
  nama: string;
}

interface AbsensiData {
  [nim: string]: {
    hadir: boolean;
  };
}

export default function DosenAbsensiPraktikumPage() {
  const { kode, jadwalId } = useParams<{ kode: string; jadwalId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mahasiswaList, setMahasiswaList] = useState<Mahasiswa[]>([]);
  const [jadwalDetail, setJadwalDetail] = useState<any | null>(null);
  const [absensi, setAbsensi] = useState<AbsensiData>({});
  const [activeTab, setActiveTab] = useState<'manual' | 'qr'>('manual');
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingChange, setPendingChange] = useState<{ nim: string; desired: boolean } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [qrEnabled, setQrEnabled] = useState<boolean>(false);
  const [togglingQR, setTogglingQR] = useState(false);
  const [qrToken, setQrToken] = useState<string>('');
  const [qrTokenExpiresAt, setQrTokenExpiresAt] = useState<number>(0);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [isFetchingToken, setIsFetchingToken] = useState<boolean>(false);
  const [lastManualSave, setLastManualSave] = useState<number>(0);
  const [qrCodeKey, setQrCodeKey] = useState<number>(0); // Key untuk animasi QR code
  const [showNewBadge, setShowNewBadge] = useState<boolean>(false);
  const [showParticles, setShowParticles] = useState<boolean>(false);
  const fetchQrTokenRef = useRef<(() => Promise<void>) | null>(null);
  const tokenRefreshCalledRef = useRef<boolean>(false);
  const newBadgeTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isDisablingOnUnmountRef = useRef<boolean>(false); // Prevent multiple disable calls on unmount
  const previousLocationRef = useRef<string>(''); // Track previous location
  
  useEffect(() => {
    fetchData();
  }, [kode, jadwalId]);

  // Fungsi untuk fetch hanya data absensi (untuk auto-refresh)
  const fetchAbsensiOnly = useCallback(async () => {
    if (!kode || !jadwalId) return;
    if (isSyncing || confirmOpen) return; // hindari overwrite saat sedang sync atau konfirmasi
    
    // Skip auto-refresh jika baru saja ada manual save (dalam 3 detik terakhir)
    const now = Date.now();
    if (now - lastManualSave < 3000) {
      return;
    }

    try {
      const absensiResponse = await api.get(`/praktikum/${kode}/jadwal/${jadwalId}/absensi`);
      const existingAbsensi: AbsensiData = {};
      
      if (absensiResponse.data?.absensi) {
        Object.keys(absensiResponse.data.absensi).forEach((nim) => {
          const absen = absensiResponse.data.absensi[nim];
          existingAbsensi[nim] = {
            hadir: absen.hadir || false
          };
        });
      }
      
      // Update state absensi - perbandingan yang lebih akurat
      setAbsensi((prev) => {
        const prevKeys = Object.keys(prev || {});
        const newKeys = Object.keys(existingAbsensi);
        
        // Check if there are any differences
        const hasNewKeys = newKeys.some(key => !prevKeys.includes(key));
        const hasChangedValues = newKeys.some(key => 
          prev[key]?.hadir !== existingAbsensi[key]?.hadir
        );
        const hasRemovedKeys = prevKeys.some(key => !newKeys.includes(key));
        
        if (hasNewKeys || hasChangedValues || hasRemovedKeys || newKeys.length !== prevKeys.length) {
          return existingAbsensi;
        }
        return prev;
      });
    } catch (err: any) {
      // Silent fail untuk auto-refresh
      // console.error('[Auto-refresh] Error fetching absensi:', err);
    }
  }, [kode, jadwalId, isSyncing, confirmOpen, lastManualSave]);

  // Fungsi untuk fetch QR token
  const fetchQrToken = useCallback(async () => {
    if (!kode || !jadwalId || !qrEnabled) return;
    
    // Prevent multiple simultaneous calls
    if (isFetchingToken) {
      console.log('Token fetch already in progress, skipping...');
      return;
    }
    
    setIsFetchingToken(true);
    
    try {
      const response = await api.get(`/praktikum/${kode}/jadwal/${jadwalId}/qr-token`);
      const token = response.data.token;
      
      // Gunakan expires_at_timestamp jika ada (lebih reliable, tidak terpengaruh timezone)
      // Jika tidak ada, fallback ke parsing expires_at string
      let expiresAt: number;
      
      if (response.data.expires_at_timestamp) {
        // Gunakan timestamp langsung (dalam milliseconds)
        expiresAt = response.data.expires_at_timestamp;
      } else {
        // Fallback: parse expires_at string
        const expiresAtStr = response.data.expires_at;
        expiresAt = new Date(expiresAtStr).getTime();
      }
      
      // Validate expires_at
      if (isNaN(expiresAt) || expiresAt <= 0) {
        console.error('Invalid expires_at:', expiresAt, response.data);
        throw new Error('Invalid expires_at format');
      }
      
      const now = Date.now();
      const expiresInSeconds = Math.floor((expiresAt - now) / 1000);
      
      console.log('QR token fetched:', {
        expiresAtStr: response.data.expires_at,
        expiresAtTimestamp: expiresAt,
        expiresAt: new Date(expiresAt).toLocaleTimeString(),
        now: new Date(now).toLocaleTimeString(),
        expiresInSeconds: expiresInSeconds,
        expiresInFormatted: Math.floor(expiresInSeconds / 60) + ':' + (expiresInSeconds % 60).toString().padStart(2, '0')
      });
      
      // Pastikan waktu tidak negatif atau terlalu kecil
      if (expiresInSeconds < 20) {
        console.warn('Token expires too soon:', expiresInSeconds, 'seconds');
      }
      
      setQrToken(token);
      setQrTokenExpiresAt(expiresAt);
      
      // Reset flag saat token baru di-fetch
      tokenRefreshCalledRef.current = false;
      
      // Calculate initial time remaining
      const remaining = Math.max(0, expiresInSeconds);
      setTimeRemaining(remaining);
      
      // Generate QR code URL dengan token
      const qrData = `${window.location.origin}/mahasiswa/absensi-praktikum/${kode}/${jadwalId}?from_qr=true&token=${token}`;
      setQrCodeData(qrData);
      
      // Update key untuk trigger animasi QR code
      setQrCodeKey(prev => prev + 1);
      
      // Trigger efek butiran
      setShowParticles(true);
      setTimeout(() => {
        setShowParticles(false);
      }, 1500);
      
      // Tampilkan badge "QR Code Baru" selama 3 detik
      setShowNewBadge(true);
      if (newBadgeTimeoutRef.current) {
        clearTimeout(newBadgeTimeoutRef.current);
      }
      newBadgeTimeoutRef.current = setTimeout(() => {
        setShowNewBadge(false);
      }, 3000);
    } catch (err: any) {
      console.error('Error fetching QR token:', err);
      // Jika error, set QR code data tanpa token (fallback)
      if (kode && jadwalId) {
        const qrData = `${window.location.origin}/mahasiswa/absensi-praktikum/${kode}/${jadwalId}?from_qr=true`;
        setQrCodeData(qrData);
      }
    } finally {
      setIsFetchingToken(false);
    }
  }, [kode, jadwalId, qrEnabled, isFetchingToken]);

  // Update ref setiap kali fetchQrToken berubah
  useEffect(() => {
    fetchQrTokenRef.current = fetchQrToken;
  }, [fetchQrToken]);

  // Countdown timer untuk QR token
  useEffect(() => {
    if (!qrEnabled || !qrTokenExpiresAt) {
      setTimeRemaining(0);
      tokenRefreshCalledRef.current = false;
      return;
    }

    const updateTimer = () => {
      const now = Date.now();
      const remaining = Math.max(0, Math.floor((qrTokenExpiresAt - now) / 1000));
      setTimeRemaining(remaining);
      
      // Jika waktu habis, fetch token baru (hanya sekali)
      if (remaining === 0 && qrEnabled && !isFetchingToken && !tokenRefreshCalledRef.current) {
        tokenRefreshCalledRef.current = true;
        console.log('Timer expired, fetching new token...');
        if (fetchQrTokenRef.current) {
          fetchQrTokenRef.current();
        }
      }
    };

    // Update setiap detik
    const intervalId = setInterval(updateTimer, 1000);
    
    // Update sekali langsung
    updateTimer();

    return () => {
      clearInterval(intervalId);
    };
  }, [qrEnabled, qrTokenExpiresAt, isFetchingToken]);

  // Auto-refresh QR token - hanya fetch pertama kali saat QR enabled
  useEffect(() => {
    if (!qrEnabled || !kode || !jadwalId) {
      setQrToken('');
      setQrCodeData('');
      setQrTokenExpiresAt(0);
      setTimeRemaining(0);
      setShowNewBadge(false);
      setShowParticles(false);
      if (newBadgeTimeoutRef.current) {
        clearTimeout(newBadgeTimeoutRef.current);
      }
      return;
    }

    // Fetch token pertama kali saat QR enabled
    // Selanjutnya countdown timer akan handle refresh
    fetchQrToken();
  }, [qrEnabled, kode, jadwalId]); // Remove fetchQrToken dari dependency
  
  // Cleanup timeout saat component unmount
  useEffect(() => {
    return () => {
      if (newBadgeTimeoutRef.current) {
        clearTimeout(newBadgeTimeoutRef.current);
      }
    };
  }, []);

  // Fungsi helper untuk disable QR code
  const disableQRCode = useCallback(async () => {
    if (!kode || !jadwalId || !qrEnabled || isDisablingOnUnmountRef.current) return;
    
    isDisablingOnUnmountRef.current = true;
    try {
      await api.put(`/praktikum/${kode}/jadwal/${jadwalId}/toggle-qr`);
      setQrEnabled(false);
      console.log('QR code automatically disabled');
    } catch (err: any) {
      console.error('Error disabling QR:', err);
    } finally {
      // Reset flag setelah delay untuk allow future calls jika perlu
      setTimeout(() => {
        isDisablingOnUnmountRef.current = false;
      }, 1000);
    }
  }, [kode, jadwalId, qrEnabled]);

  // Auto-disable QR code ketika dosen keluar dari halaman (detect location change)
  useEffect(() => {
    // Initialize previous location on mount
    if (!previousLocationRef.current) {
      previousLocationRef.current = location.pathname;
      return;
    }

    const currentPath = location.pathname;
    const expectedPath = `/absensi-praktikum/${kode}/${jadwalId}`;
    
    // Jika location berubah dan bukan lagi di halaman absensi, disable QR
    // Check: sebelumnya di halaman absensi, sekarang tidak, dan QR masih enabled
    const wasOnAbsensiPage = previousLocationRef.current === expectedPath || 
                             previousLocationRef.current.startsWith('/absensi-praktikum/');
    const isStillOnAbsensiPage = currentPath === expectedPath || 
                                  currentPath.startsWith('/absensi-praktikum/');
    
    if (wasOnAbsensiPage && !isStillOnAbsensiPage && qrEnabled) {
      console.log('Location changed from', previousLocationRef.current, 'to', currentPath, '- disabling QR code...');
      disableQRCode();
    }
    
    // Update previous location
    previousLocationRef.current = currentPath;
  }, [location.pathname, kode, jadwalId, qrEnabled, disableQRCode]);

  // Auto-disable QR code ketika component unmount (fallback)
  useEffect(() => {
    return () => {
      // Disable QR code jika masih aktif saat component unmount
      if (qrEnabled && kode && jadwalId && !isDisablingOnUnmountRef.current) {
        isDisablingOnUnmountRef.current = true;
        // Fire and forget - tidak perlu await karena component sudah unmount
        api.put(`/praktikum/${kode}/jadwal/${jadwalId}/toggle-qr`)
          .then(() => {
            console.log('QR code automatically disabled - component unmount');
          })
          .catch((err) => {
            console.error('Error disabling QR on unmount:', err);
          });
      }
    };
  }, [qrEnabled, kode, jadwalId]);

  // Auto-disable QR code ketika browser close/refresh (beforeunload)
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (qrEnabled && kode && jadwalId && !isDisablingOnUnmountRef.current) {
        isDisablingOnUnmountRef.current = true;
        
        // Gunakan fetch dengan keepalive untuk lebih reliable saat page unload
        // keepalive: true memastikan request tetap dikirim meskipun page sudah mulai unload
        // Ini penting untuk handle browser close dan page reload
        const token = localStorage.getItem('token');
        const baseURL = import.meta.env.VITE_API_URL || 'http://localhost:8000';
        const url = `${baseURL}/api/praktikum/${kode}/jadwal/${jadwalId}/toggle-qr`;
        
        // Fetch dengan keepalive: true - ini adalah cara terbaik untuk send request saat page unload
        // Browser akan memastikan request ini dikirim bahkan setelah page mulai unload
        fetch(url, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({}),
          keepalive: true // Critical: memastikan request tetap dikirim saat page unload
        }).catch(() => {
          // Silent fail - tidak perlu handle error karena page sudah unload
        });
      }
    };

    // Tambahkan event listener untuk beforeunload
    // Event ini akan trigger ketika:
    // 1. User menutup browser tab/window (close browser)
    // 2. User reload page (F5, Ctrl+R, atau klik refresh button)
    // 3. User navigate away dari page (meskipun sudah ada handler untuk location change)
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [qrEnabled, kode, jadwalId]);

  // Auto-refresh data absensi setiap 2 detik (untuk real-time update dari mahasiswa)
  useEffect(() => {
    if (!kode || !jadwalId || loading) return;
    
    // Fetch sekali dulu untuk memastikan data terbaru
    fetchAbsensiOnly();
    
    const intervalId = setInterval(() => {
      fetchAbsensiOnly();
    }, 2000); // Refresh setiap 2 detik

    // Cleanup interval saat component unmount
    return () => {
      clearInterval(intervalId);
    };
  }, [kode, jadwalId, loading, fetchAbsensiOnly]);

  const fetchData = async () => {
    if (!kode || !jadwalId) return;
    setLoading(true);
    
    try {
      const jadwalResponse = await api.get(`/praktikum/jadwal/${kode}`);
      const allJadwal = jadwalResponse.data;
      const foundJadwal = allJadwal.find((j: any) => j.id === parseInt(jadwalId));
      
      if (!foundJadwal) {
        setError('Jadwal tidak ditemukan');
        return;
      }
      setJadwalDetail(foundJadwal);
      setQrEnabled(foundJadwal.qr_enabled || false);
      
      // Fetch mahasiswa dari kelas praktikum
      try {
        const mahasiswaResponse = await api.get(`/praktikum/${kode}/jadwal/${jadwalId}/mahasiswa`);
        const mahasiswa = mahasiswaResponse.data?.mahasiswa || [];
        setMahasiswaList(mahasiswa);
        
        if (mahasiswa.length === 0) {
          setError('Tidak ada mahasiswa yang terdaftar di kelas praktikum ini.');
        }
      } catch (err: any) {
        console.error('Error fetching mahasiswa:', err);
        const errorMessage = err?.response?.data?.message || err?.message || 'Unknown error';
        setError(`Gagal memuat data mahasiswa: ${errorMessage}`);
        setMahasiswaList([]);
      }

      // Fetch absensi yang sudah ada
      try {
        const absensiResponse = await api.get(`/praktikum/${kode}/jadwal/${jadwalId}/absensi`);
        const existingAbsensi: AbsensiData = {};
        
        if (absensiResponse.data.absensi) {
          Object.keys(absensiResponse.data.absensi).forEach((nim) => {
            const absen = absensiResponse.data.absensi[nim];
            existingAbsensi[nim] = {
              hadir: absen.hadir || false
            };
          });
        }
        setAbsensi(existingAbsensi);
      } catch (err) {
        // No existing absensi data
      }

      // Generate QR code URL untuk mahasiswa (dengan query parameter untuk auto-submit)
      // Token akan di-fetch secara terpisah jika QR enabled
      if (kode && jadwalId && qrEnabled) {
        // Token akan di-fetch oleh useEffect yang terpisah
        // Jangan set QR code data di sini, biarkan useEffect yang handle
      } else if (kode && jadwalId) {
        // Jika QR tidak enabled, set tanpa token
        const qrData = `${window.location.origin}/mahasiswa/absensi-praktikum/${kode}/${jadwalId}?from_qr=true`;
        setQrCodeData(qrData);
      }
    } catch (err: any) {
      console.error('Error fetching data:', err);
      setError(handleApiError(err, 'Memuat data mahasiswa'));
      setMahasiswaList([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAbsensiChange = (nim: string, hadir: boolean) => {
    setAbsensi((prev) => ({
      ...prev,
      [nim]: { hadir }
    }));
  };

  // Toggle dengan konfirmasi untuk kedua arah
  const handleAbsensiToggle = (nim: string, desired: boolean) => {
    const current = absensi[nim]?.hadir || false;
    if (current === desired) return; // tidak ada perubahan
    // Minta konfirmasi untuk kedua perubahan (check/uncheck)
    setPendingChange({ nim, desired });
    setConfirmOpen(true);
  };

  const confirmChange = async () => {
    if (pendingChange) {
      // Update state lokal dulu (optimistic update)
      handleAbsensiChange(pendingChange.nim, pendingChange.desired);
      // Tutup modal dulu agar user tidak menunggu
      setPendingChange(null);
      setConfirmOpen(false);
      // Lalu save ke backend (async, tidak blocking UI)
      await saveSingleAttendance(pendingChange.nim, pendingChange.desired);
    } else {
      setPendingChange(null);
      setConfirmOpen(false);
    }
  };

  const cancelUncheck = () => {
    // Tutup modal tanpa mengubah state; checkbox akan tetap checked
    setPendingChange(null);
    setConfirmOpen(false);
  };

  // Kunci scroll body saat modal terbuka agar konten belakang "tenggelam"
  useEffect(() => {
    if (confirmOpen) {
      const prev = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = prev;
      };
    }
  }, [confirmOpen]);

  // Simpan satu baris absensi untuk mencegah revert oleh polling
  const saveSingleAttendance = async (nim: string, hadir: boolean) => {
    if (!kode || !jadwalId) return;
    setIsSyncing(true);
    setLastManualSave(Date.now()); // Tandai waktu manual save
    try {
      const payload = { absensi: [{ mahasiswa_nim: nim, hadir, catatan: '' }] };
      await api.post(`/praktikum/${kode}/jadwal/${jadwalId}/absensi`, payload);
      
      // Tunggu sebentar agar backend selesai memproses, lalu refresh
      // Tapi pastikan state lokal sudah benar terlebih dahulu
      setTimeout(async () => {
        try {
          const absensiResponse = await api.get(`/praktikum/${kode}/jadwal/${jadwalId}/absensi`);
          if (absensiResponse.data?.absensi) {
            const existingAbsensi: AbsensiData = {};
            Object.keys(absensiResponse.data.absensi).forEach((n) => {
              const absen = absensiResponse.data.absensi[n];
              existingAbsensi[n] = {
                hadir: absen.hadir || false
              };
            });
            // Update hanya jika data sudah tersimpan dengan benar di backend
            setAbsensi(existingAbsensi);
          }
        } catch (err) {
          console.error('Error refreshing after save:', err);
        }
      }, 500); // Delay 500ms agar backend selesai memproses
    } catch (err: any) {
      // jika gagal, rollback state lokal agar tidak menyesatkan
      setAbsensi((prev) => ({ ...prev, [nim]: { hadir: !hadir } }));
      
      // Tampilkan error message yang lebih informatif
      const errorMessage = err?.response?.data?.message || 'Gagal menyimpan perubahan. Silakan coba lagi.';
      setError(errorMessage);
      
      console.error('Error saving attendance:', err);
      console.error('Error response:', err?.response?.data);
    } finally {
      setIsSyncing(false);
    }
  };

  // hapus handleSave - tidak diperlukan karena auto-save per perubahan

  // Fungsi export Excel
  const exportToExcel = async () => {
    if (!jadwalDetail || mahasiswaList.length === 0) {
      alert('Tidak ada data untuk diekspor');
      return;
    }

    try {
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet('Absensi Praktikum');

      // Set workbook properties
      workbook.creator = 'Sistem Isme FKK';
      workbook.lastModifiedBy = 'Sistem Isme FKK';
      workbook.created = new Date();
      workbook.modified = new Date();

      // Header Universitas
      const universityRow = worksheet.addRow(['UNIVERSITAS MUHAMMADIYAH JAKARTA']);
      universityRow.font = { bold: true, size: 18, color: { argb: 'FF1F4E79' } };
      universityRow.alignment = { horizontal: 'center' };
      worksheet.mergeCells('A1:F1');

      const facultyRow = worksheet.addRow(['FAKULTAS KEDOKTERAN']);
      facultyRow.font = { bold: true, size: 16, color: { argb: 'FF2E75B6' } };
      facultyRow.alignment = { horizontal: 'center' };
      worksheet.mergeCells('A2:F2');

      // Judul Laporan
      const titleRow = worksheet.addRow(['LAPORAN HASIL ABSENSI PRAKTIKUM']);
      titleRow.font = { bold: true, size: 14, color: { argb: 'FF2E75B6' } };
      titleRow.alignment = { horizontal: 'center' };
      worksheet.mergeCells('A3:F3');

      // Spasi
      worksheet.addRow([]);

      // Informasi Kelas
      const infoTitleRow = worksheet.addRow(['INFORMASI KELAS']);
      infoTitleRow.font = { bold: true, size: 12, color: { argb: 'FF1F4E79' } };
      infoTitleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7F3FF' },
      };
      worksheet.mergeCells('A5:F5');

      // Data Informasi Kelas
      const mataKuliahNama = jadwalDetail?.mata_kuliah?.nama || jadwalDetail?.mata_kuliah_kode || '-';
      const semester = jadwalDetail?.mata_kuliah?.semester || '-';
      const kelasPraktikum = jadwalDetail?.kelas_praktikum || '-';
      const tanggal = jadwalDetail.tanggal 
        ? new Date(jadwalDetail.tanggal).toLocaleDateString('id-ID', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : '-';
      const waktu = jadwalDetail.jam_mulai && jadwalDetail.jam_selesai
        ? `${jadwalDetail.jam_mulai} - ${jadwalDetail.jam_selesai}`
        : '-';
      const ruangan = jadwalDetail?.ruangan?.nama || '-';
      const materi = jadwalDetail?.materi || '-';
      const topik = jadwalDetail?.topik || '-';
      
      // Ambil data dosen lengkap untuk Excel (praktikum bisa multiple dosen)
      const dosenListExcel = jadwalDetail?.dosen || [];
      const dosenNamaExcelLengkap = dosenListExcel.length > 0 
        ? dosenListExcel.map((d: any) => d.name).join(', ')
        : '-';
      // Untuk Excel, ambil dosen pertama untuk signature (jika ada)
      const dosenDataExcel = dosenListExcel.length > 0 ? dosenListExcel[0] : null;
      const dosenNIDExcel = dosenDataExcel?.nid || '-';
      const dosenNIDNExcel = dosenDataExcel?.nidn || '-';
      const dosenNUPTKExcel = dosenDataExcel?.nuptk || '-';
      const dosenSignatureImageExcel = dosenDataExcel?.signature_image || null;

      const infoData = [
        ['Mata Kuliah:', mataKuliahNama, '', 'Semester:', semester],
        ['Kelas Praktikum:', kelasPraktikum, '', 'Tanggal:', tanggal],
        ['Materi:', materi, '', 'Waktu:', waktu],
        ['Topik:', topik, '', 'Ruangan:', ruangan],
        ['Dibuat:', new Date().toLocaleDateString('id-ID'), '', '', ''],
      ];

      infoData.forEach((row) => {
        const infoRow = worksheet.addRow(row);
        infoRow.getCell(1).font = { bold: true };
        infoRow.getCell(4).font = { bold: true };
      });

      // Spasi
      worksheet.addRow([]);

      // INFORMASI DOSEN
      const infoDosenTitleRow = worksheet.addRow(['INFORMASI DOSEN']);
      infoDosenTitleRow.font = { bold: true, size: 12, color: { argb: 'FF1F4E79' } };
      infoDosenTitleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7F3FF' },
      };
      worksheet.mergeCells(`A${worksheet.rowCount}:F${worksheet.rowCount}`);

      const infoDosenData = [
        ['Nama Dosen:', dosenNamaExcelLengkap, '', 'NID:', dosenNIDExcel],
        ['NIDN:', dosenNIDNExcel, '', 'NUPTK:', dosenNUPTKExcel],
      ];

      infoDosenData.forEach((row) => {
        const infoDosenRow = worksheet.addRow(row);
        infoDosenRow.getCell(1).font = { bold: true };
        infoDosenRow.getCell(4).font = { bold: true };
      });

      // Spasi
      worksheet.addRow([]);

      // Summary Statistik
      const totalMahasiswa = mahasiswaList.length;
      const hadir = Object.values(absensi).filter(a => a?.hadir).length;
      const tidakHadir = totalMahasiswa - hadir;
      const persentase = totalMahasiswa > 0 ? Math.round((hadir / totalMahasiswa) * 100) : 0;

      const summaryTitleRow = worksheet.addRow(['RINGKASAN ABSENSI']);
      summaryTitleRow.font = { bold: true, size: 12, color: { argb: 'FF1F4E79' } };
      summaryTitleRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFE7F3FF' },
      };
      worksheet.mergeCells(`A${worksheet.rowCount}:F${worksheet.rowCount}`);

      const summaryData = [
        ['Total Mahasiswa:', totalMahasiswa, '', 'Hadir:', hadir],
        ['Tidak Hadir:', tidakHadir, '', 'Persentase Kehadiran:', `${persentase}%`],
      ];

      summaryData.forEach((row) => {
        const summaryRow = worksheet.addRow(row);
        summaryRow.getCell(1).font = { bold: true };
        summaryRow.getCell(4).font = { bold: true };
      });

      // Spasi
      worksheet.addRow([]);

      // Header Tabel
      const tableHeaders = ['No', 'NIM', 'Nama Mahasiswa', 'Status Kehadiran'];
      const headerRow = worksheet.addRow(tableHeaders);
      headerRow.font = { bold: true, size: 11, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF1F4E79' },
      };
      headerRow.alignment = { horizontal: 'center', vertical: 'middle' };
      headerRow.height = 25;

      // Data Tabel - Hadir
      const hadirTitleRow = worksheet.addRow(['MAHASISWA YANG HADIR']);
      hadirTitleRow.font = { bold: true, size: 11, color: { argb: 'FF2E7D32' } };
      worksheet.mergeCells(`A${worksheet.rowCount}:D${worksheet.rowCount}`);

      const mahasiswaHadir = mahasiswaList
        .filter(m => absensi[m.nim]?.hadir)
        .sort((a, b) => a.nim.localeCompare(b.nim));

      mahasiswaHadir.forEach((m, index) => {
        const row = worksheet.addRow([
          index + 1,
          m.nim,
          m.nama,
          'Hadir'
        ]);
        row.getCell(4).fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFC8E6C9' },
        };
      });

      // Spasi
      worksheet.addRow([]);

      // Data Tabel - Tidak Hadir
      const tidakHadirTitleRow = worksheet.addRow(['MAHASISWA YANG TIDAK HADIR']);
      tidakHadirTitleRow.font = { bold: true, size: 11, color: { argb: 'FFC62828' } };
      worksheet.mergeCells(`A${worksheet.rowCount}:D${worksheet.rowCount}`);

      const mahasiswaTidakHadir = mahasiswaList
        .filter(m => !absensi[m.nim]?.hadir)
        .sort((a, b) => a.nim.localeCompare(b.nim));

      if (mahasiswaTidakHadir.length === 0) {
        const row = worksheet.addRow(['-', '-', 'Semua mahasiswa hadir', '-']);
        row.getCell(3).font = { italic: true, color: { argb: 'FF666666' } };
      } else {
        mahasiswaTidakHadir.forEach((m, index) => {
          const row = worksheet.addRow([
            index + 1,
            m.nim,
            m.nama,
            'Tidak Hadir'
          ]);
          row.getCell(4).fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FFFFCDD2' },
          };
        });
      }

      // Set column widths
      worksheet.getColumn(1).width = 8; // No
      worksheet.getColumn(2).width = 15; // NIM
      worksheet.getColumn(3).width = 40; // Nama
      worksheet.getColumn(4).width = 20; // Status

      // Add borders to all cells with data
      const startRow = 1;
      const endRow = worksheet.rowCount;
      for (let row = startRow; row <= endRow; row++) {
        for (let col = 1; col <= 4; col++) {
          const cell = worksheet.getCell(row, col);
          if (cell.value !== null && cell.value !== '') {
            cell.border = {
              top: { style: 'thin' },
              left: { style: 'thin' },
              bottom: { style: 'thin' },
              right: { style: 'thin' },
            };
          }
        }
      }

      // Spasi sebelum tanda tangan
      worksheet.addRow([]);
      worksheet.addRow([]);

      // Bagian Tanda Tangan Dosen Mengajar
      const signatureRow = worksheet.rowCount + 1;
      
      // Tanggal di kanan (kolom D)
      const tanggalSignature = `Jakarta, ${new Date().toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}`;
      const tanggalCell = worksheet.getCell(`D${signatureRow}`);
      tanggalCell.value = tanggalSignature;
      tanggalCell.font = { size: 11 };
      tanggalCell.alignment = { horizontal: 'right' };

      // Title "Dosen Mengajar" (baris berikutnya)
      const dosenTitleRow = signatureRow + 2;
      const dosenTitleCell = worksheet.getCell(`D${dosenTitleRow}`);
      dosenTitleCell.value = 'Dosen Mengajar';
      dosenTitleCell.font = { size: 11, bold: true };
      dosenTitleCell.alignment = { horizontal: 'right' };

      // Fungsi helper untuk convert base64 ke buffer
      function base64ToBuffer(dataUrl: string) {
        const base64 = dataUrl.split(",")[1];
        const binary = atob(base64);
        const len = binary.length;
        const buffer = new Uint8Array(len);
        for (let i = 0; i < len; i++) buffer[i] = binary.charCodeAt(i);
        return buffer;
      }

      // Tanda tangan atau garis tanda tangan
      const dosenLineRow = dosenTitleRow + 2;
      if (dosenSignatureImageExcel) {
        // Tampilkan gambar tanda tangan
        try {
          // Tinggikan baris untuk menampung gambar
          worksheet.getRow(dosenLineRow).height = 50;
          
          // Tambahkan gambar tanda tangan ke workbook
          const imageId = workbook.addImage({
            buffer: base64ToBuffer(dosenSignatureImageExcel) as any,
            extension: "png",
          });
          
          // Tambahkan gambar di kolom D, align kanan
          // Kolom D adalah kolom ke-4 (A=1, B=2, C=3, D=4)
          // Untuk align kanan, kita perlu menempatkan gambar di kolom D dengan width kolom yang sesuai
          // Kita akan menggunakan kolom D-E untuk menampung gambar, dengan anchor di D
          worksheet.addImage(imageId, {
            tl: { col: 3.2, row: dosenLineRow - 1 }, // Kolom D (3.2 untuk sedikit offset ke kiri agar align kanan), row -1 karena 0-indexed
            ext: { width: 120, height: 35 }, // Ukuran gambar (dalam pixels) - disesuaikan agar muat di kolom D
          });
        } catch (error) {
          console.error('Error adding signature image to Excel:', error);
          // Fallback ke garis tanda tangan jika error
          const dosenLineCell = worksheet.getCell(`D${dosenLineRow}`);
          dosenLineCell.value = '(_________________________)';
          dosenLineCell.font = { size: 11 };
          dosenLineCell.alignment = { horizontal: 'right' };
        }
      } else {
        // Garis tanda tangan jika tidak ada gambar
        const dosenLineCell = worksheet.getCell(`D${dosenLineRow}`);
        dosenLineCell.value = '(_________________________)';
        dosenLineCell.font = { size: 11 };
        dosenLineCell.alignment = { horizontal: 'right' };
      }

      // Nama dosen di bawah tanda tangan (baris berikutnya)
      if (dosenNamaExcelLengkap && dosenNamaExcelLengkap !== '-') {
        const dosenNameRow = dosenLineRow + (dosenSignatureImageExcel ? 3 : 1);
        const dosenNameCell = worksheet.getCell(`D${dosenNameRow}`);
        dosenNameCell.value = dosenNamaExcelLengkap;
        dosenNameCell.font = { size: 10 };
        dosenNameCell.alignment = { horizontal: 'right' };
      }

      // Footer
      worksheet.addRow([]);
      worksheet.addRow([]);
      const footerRow = worksheet.addRow(['Laporan ini dibuat secara otomatis oleh Sistem Isme FKK']);
      footerRow.font = { size: 8, color: { argb: 'FF999999' }, italic: true };
      footerRow.alignment = { horizontal: 'center' };
      worksheet.mergeCells(`A${worksheet.rowCount}:D${worksheet.rowCount}`);

      // Generate filename
      const tanggalFile = jadwalDetail.tanggal 
        ? new Date(jadwalDetail.tanggal).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      const filename = `Absensi_Praktikum_${jadwalDetail.mata_kuliah_kode}_${tanggalFile}`;

      // Save file
      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      saveAs(blob, `${filename}.xlsx`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      alert('Gagal mengekspor data ke Excel. Silakan coba lagi.');
    }
  };

  // Fungsi export PDF
  const exportToPDF = async () => {
    if (!jadwalDetail || mahasiswaList.length === 0) {
      alert('Tidak ada data untuk diekspor');
      return;
    }

    try {
      const doc = new jsPDF('portrait', 'mm', 'a4');
      const margin = 20;
      let yPos = margin;
      const maxPageHeight = doc.internal.pageSize.height - margin;

      // Helper function untuk add new page
      const addNewPage = () => {
        doc.addPage();
        yPos = margin;
      };

      // Helper function untuk add text dengan auto page break
      const addText = (
        text: string,
        x: number,
        y: number,
        options?: { align?: string }
      ) => {
        if (y > maxPageHeight) {
          addNewPage();
          y = margin;
        }
        doc.text(text, x, y, options);
        return y;
      };

      // LOAD LOGO
      const loadLogo = async (): Promise<string> => {
        try {
          const response = await fetch("/images/logo/logo.svg");
          if (!response.ok) {
            throw new Error("Logo tidak ditemukan");
          }
          const svgText = await response.text();

          // Convert SVG to canvas then to data URL
          return new Promise((resolve) => {
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = 100;
            canvas.height = 100;

            const img = new Image();
            img.onload = () => {
              if (ctx) {
                ctx.drawImage(img, 0, 0, 100, 100);
                resolve(canvas.toDataURL("image/png"));
              } else {
                resolve("");
              }
            };
            img.onerror = () => resolve("");
            img.src = "data:image/svg+xml;base64," + btoa(svgText);
          });
        } catch (error) {
          console.error("Error loading logo:", error);
          return "";
        }
      };

      const logoDataUrl = await loadLogo();

      // HEADER UNIVERSITAS DENGAN LOGO
      if (logoDataUrl) {
        try {
          const logoWidth = 25;
          const logoHeight = 25;
          const logoX = (doc.internal.pageSize.width - logoWidth) / 2;
          const logoY = yPos;

          doc.addImage(
            logoDataUrl,
            "PNG",
            logoX,
            logoY,
            logoWidth,
            logoHeight,
            undefined,
            "FAST",
            0
          );
        } catch (logoError) {
          console.error("Error adding logo to PDF:", logoError);
          doc.setFontSize(24);
          doc.setFont("times", "bold");
          doc.text("UMJ", 105, yPos + 20, { align: "center" });
        }
      } else {
        doc.setFontSize(24);
        doc.setFont("times", "bold");
        doc.text("UMJ", 105, yPos + 20, { align: "center" });
      }

      yPos += 35;

      doc.setFontSize(18);
      doc.setFont("times", "bold");
      yPos = addText("UNIVERSITAS MUHAMMADIYAH JAKARTA", 105, yPos, {
        align: "center",
      });
      yPos += 10;

      doc.setFontSize(14);
      doc.setFont("times", "normal");
      yPos = addText("Fakultas Kedokteran", 105, yPos, { align: "center" });
      yPos = addText("Program Studi Kedokteran", 105, yPos + 7, {
        align: "center",
      });
      yPos += 5;

      doc.setFontSize(11);
      yPos = addText(
        "Jl. KH. Ahmad Dahlan, Cirendeu, Ciputat, Tangerang Selatan",
        105,
        yPos + 5,
        { align: "center" }
      );
      yPos = addText(
        "Telp. (021) 742-3740 - Fax. (021) 742-3740",
        105,
        yPos + 5,
        { align: "center" }
      );
      yPos += 15;

      doc.line(margin, yPos, doc.internal.pageSize.width - margin, yPos);
      yPos += 10;

      // JUDUL DOKUMEN
      doc.setFontSize(16);
      doc.setFont("times", "bold");
      yPos = addText("LAPORAN HASIL ABSENSI PRAKTIKUM", 105, yPos, { align: "center" });
      yPos += 20;

      // INFORMASI KELAS
      doc.setFontSize(12);
      doc.setFont("times", "bold");
      yPos = addText("INFORMASI KELAS", margin, yPos);
      yPos += 8;

      const mataKuliahNama = jadwalDetail?.mata_kuliah?.nama || jadwalDetail?.mata_kuliah_kode || '-';
      const semester = jadwalDetail?.mata_kuliah?.semester || '-';
      const kelasPraktikum = jadwalDetail?.kelas_praktikum || '-';
      const tanggal = jadwalDetail.tanggal 
        ? new Date(jadwalDetail.tanggal).toLocaleDateString('id-ID', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })
        : '-';
      const waktu = jadwalDetail.jam_mulai && jadwalDetail.jam_selesai
        ? `${jadwalDetail.jam_mulai} - ${jadwalDetail.jam_selesai}`
        : '-';
      const ruangan = jadwalDetail?.ruangan?.nama || '-';
      const materi = jadwalDetail?.materi || '-';
      const topik = jadwalDetail?.topik || '-';

      doc.setFontSize(11);
      doc.setFont("times", "normal");
      // Koordinat x untuk titik dua agar sejajar (dalam mm)
      const colonXKelas = margin + 40; // Jarak dari margin untuk titik dua
      
      doc.text('Mata Kuliah', margin, yPos);
      doc.text(`: ${mataKuliahNama}`, colonXKelas, yPos);
      yPos += 6;
      doc.text('Semester', margin, yPos);
      doc.text(`: ${semester}`, colonXKelas, yPos);
      yPos += 6;
      doc.text('Kelas Praktikum', margin, yPos);
      doc.text(`: ${kelasPraktikum}`, colonXKelas, yPos);
      yPos += 6;
      doc.text('Materi', margin, yPos);
      doc.text(`: ${materi}`, colonXKelas, yPos);
      yPos += 6;
      doc.text('Topik', margin, yPos);
      doc.text(`: ${topik}`, colonXKelas, yPos);
      yPos += 6;
      doc.text('Tanggal', margin, yPos);
      doc.text(`: ${tanggal}`, colonXKelas, yPos);
      yPos += 6;
      doc.text('Waktu', margin, yPos);
      doc.text(`: ${waktu}`, colonXKelas, yPos);
      yPos += 6;
      doc.text('Ruangan', margin, yPos);
      doc.text(`: ${ruangan}`, colonXKelas, yPos);
      yPos += 10;

      // INFORMASI DOSEN
      doc.setFontSize(12);
      doc.setFont("times", "bold");
      yPos = addText("INFORMASI DOSEN", margin, yPos);
      yPos += 8;

      // Ambil data dosen lengkap (praktikum bisa multiple dosen)
      const dosenList = jadwalDetail?.dosen || [];
      const dosenNamaLengkap = dosenList.length > 0 
        ? dosenList.map((d: any) => d.name).join(', ')
        : '-';
      // Untuk PDF, ambil dosen pertama untuk signature (jika ada)
      const dosenData = dosenList.length > 0 ? dosenList[0] : null;
      const dosenNID = dosenData?.nid || '-';
      const dosenNIDN = dosenData?.nidn || '-';
      const dosenNUPTK = dosenData?.nuptk || '-';
      const dosenSignatureImage = dosenData?.signature_image || null;

      doc.setFontSize(11);
      doc.setFont("times", "normal");
      // Koordinat x untuk titik dua agar sejajar (dalam mm)
      const colonXDosen = margin + 35; // Jarak dari margin untuk titik dua
      
      doc.text('Nama Dosen', margin, yPos);
      doc.text(`: ${dosenNamaLengkap}`, colonXDosen, yPos);
      yPos += 6;
      doc.text('NID', margin, yPos);
      doc.text(`: ${dosenNID}`, colonXDosen, yPos);
      yPos += 6;
      doc.text('NIDN', margin, yPos);
      doc.text(`: ${dosenNIDN}`, colonXDosen, yPos);
      yPos += 6;
      doc.text('NUPTK', margin, yPos);
      doc.text(`: ${dosenNUPTK}`, colonXDosen, yPos);
      yPos += 10;

      // RINGKASAN ABSENSI
      doc.setFontSize(12);
      doc.setFont("times", "bold");
      yPos = addText("RINGKASAN ABSENSI", margin, yPos);
      yPos += 8;

      const totalMahasiswa = mahasiswaList.length;
      const hadir = Object.values(absensi).filter(a => a?.hadir).length;
      const tidakHadir = totalMahasiswa - hadir;
      const persentase = totalMahasiswa > 0 ? Math.round((hadir / totalMahasiswa) * 100) : 0;

      doc.setFontSize(11);
      doc.setFont("times", "normal");
      // Koordinat x untuk titik dua agar sejajar (dalam mm) - lebih lebar untuk "Persentase Kehadiran"
      const colonXAbsensi = margin + 45; // Jarak dari margin untuk titik dua
      
      doc.text('Total Mahasiswa', margin, yPos);
      doc.text(`: ${totalMahasiswa}`, colonXAbsensi, yPos);
      yPos += 6;
      doc.text('Hadir', margin, yPos);
      doc.text(`: ${hadir}`, colonXAbsensi, yPos);
      yPos += 6;
      doc.text('Tidak Hadir', margin, yPos);
      doc.text(`: ${tidakHadir}`, colonXAbsensi, yPos);
      yPos += 6;
      doc.text('Persentase Kehadiran', margin, yPos);
      doc.text(`: ${persentase}%`, colonXAbsensi, yPos);
      yPos += 40;

      // Tabel Mahasiswa Hadir
      doc.setFontSize(12);
      doc.setFont("times", "bold");
      yPos = addText("MAHASISWA YANG HADIR", margin, yPos);
      yPos += 6;

      const mahasiswaHadir = mahasiswaList
        .filter(m => absensi[m.nim]?.hadir)
        .sort((a, b) => a.nim.localeCompare(b.nim));

      const hadirTableData = mahasiswaHadir.map((m, index) => [
        index + 1,
        m.nim,
        m.nama,
        'Hadir'
      ]);

      autoTable(doc, {
        head: [['No', 'NIM', 'Nama Mahasiswa', 'Status']],
        body: hadirTableData,
        startY: yPos,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 10,
          cellPadding: 3,
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          font: "times",
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          lineWidth: 0.2,
        },
        alternateRowStyles: {
          fillColor: [255, 255, 255],
        },
        columnStyles: {
          0: { cellWidth: 15, halign: "center" },
          1: { cellWidth: 30, halign: "left" },
          2: { cellWidth: 100, halign: "left" },
          3: { cellWidth: 30, halign: "center" },
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 20;

      // Tabel Mahasiswa Tidak Hadir
      doc.setFontSize(12);
      doc.setFont("times", "bold");
      yPos = addText("MAHASISWA YANG TIDAK HADIR", margin, yPos);
      yPos += 6;

      const mahasiswaTidakHadir = mahasiswaList
        .filter(m => !absensi[m.nim]?.hadir)
        .sort((a, b) => a.nim.localeCompare(b.nim));

      const tidakHadirTableData = mahasiswaTidakHadir.length === 0
        ? [['-', '-', 'Semua mahasiswa hadir', '-']]
        : mahasiswaTidakHadir.map((m, index) => [
            index + 1,
            m.nim,
            m.nama,
            'Tidak Hadir'
          ]);

      autoTable(doc, {
        head: [['No', 'NIM', 'Nama Mahasiswa', 'Status']],
        body: tidakHadirTableData,
        startY: yPos,
        margin: { left: margin, right: margin },
        styles: {
          fontSize: 10,
          cellPadding: 3,
          lineColor: [0, 0, 0],
          lineWidth: 0.1,
          font: "times",
        },
        headStyles: {
          fillColor: [255, 255, 255],
          textColor: [0, 0, 0],
          fontStyle: "bold",
          lineWidth: 0.2,
        },
        alternateRowStyles: {
          fillColor: [255, 255, 255],
        },
        columnStyles: {
          0: { cellWidth: 15, halign: "center" },
          1: { cellWidth: 30, halign: "left" },
          2: { cellWidth: 100, halign: "left" },
          3: { cellWidth: 30, halign: "center" },
        },
      });

      yPos = (doc as any).lastAutoTable.finalY + 10;

      // Cek apakah ada cukup ruang untuk tanda tangan, jika tidak buat halaman baru
      const spaceNeeded = 60; // Space yang dibutuhkan untuk tanda tangan
      if (yPos + spaceNeeded > maxPageHeight) {
        addNewPage();
        yPos = margin + 20; // Mulai dari atas halaman baru dengan sedikit margin
      } else {
        yPos += 20; // Tambahkan spasi jika masih ada ruang
      }

      // Bagian Tanda Tangan Dosen Mengajar
      const signYStart = yPos;

      // Tanggal di kanan
      doc.setFontSize(11);
      doc.setFont("times", "normal");
      doc.text(
        `Jakarta, ${new Date().toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })}`,
        doc.internal.pageSize.width - margin,
        signYStart,
        { align: "right" }
      );

      // Title "Dosen Mengajar"
      doc.setFontSize(11);
      doc.setFont("times", "bold");
      doc.text(
        "Dosen Mengajar",
        doc.internal.pageSize.width - margin,
        signYStart + 8,
        { align: "right" }
      );

      // Tampilkan tanda tangan jika ada, atau garis tanda tangan jika tidak ada
      if (dosenSignatureImage) {
        // Tampilkan gambar tanda tangan
        try {
          const imgWidth = 50; // Lebar gambar dalam mm
          const imgHeight = 20; // Tinggi gambar dalam mm
          const imgX = doc.internal.pageSize.width - margin - imgWidth; // Posisi X (kanan)
          const imgY = signYStart + 12; // Posisi Y (di bawah title)
          
          doc.addImage(
            dosenSignatureImage,
            'PNG',
            imgX,
            imgY,
            imgWidth,
            imgHeight
          );
        } catch (error) {
          console.error('Error adding signature image to PDF:', error);
          // Fallback ke garis tanda tangan jika error
          doc.setFont("times", "normal");
          doc.text(
            "(_________________________)",
            doc.internal.pageSize.width - margin + 7,
            signYStart + 35,
            { align: "right" }
          );
        }
      } else {
        // Garis tanda tangan jika tidak ada gambar
        doc.setFont("times", "normal");
        doc.text(
          "(_________________________)",
          doc.internal.pageSize.width - margin + 7,
          signYStart + 35,
          { align: "right" }
        );
      }

      // Nama dosen di bawah tanda tangan
      if (dosenNamaLengkap && dosenNamaLengkap !== '-') {
        doc.setFontSize(10);
        doc.setFont("times", "normal");
        const namaYPos = dosenSignatureImage ? signYStart + 35 : signYStart + 42;
        doc.text(
          dosenNamaLengkap,
          doc.internal.pageSize.width - margin,
          namaYPos,
          { align: "right" }
        );
      }

      // Buat watermark menggunakan canvas dengan resolusi tinggi
      const createWatermark = (): string => {
        const canvas = document.createElement('canvas');
        let ctx = canvas.getContext('2d');
        if (!ctx) return '';
        
        // Scale factor untuk resolusi tinggi (2x atau 3x untuk kualitas lebih baik)
        const scale = 3; // Meningkatkan resolusi 3x untuk hasil yang lebih halus
        
        // Set style untuk watermark terlebih dahulu untuk mengukur teks
        const baseFontSize = 60;
        ctx.font = `bold ${baseFontSize}px Times New Roman`;
        const text = 'FKK UMJ';
        const textMetrics = ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = baseFontSize;
        
        // Hitung ukuran canvas yang cukup besar untuk rotasi 45 derajat
        // Diagonal dari kotak yang dirotasi = sqrt(width^2 + height^2)
        const padding = 40; // Padding tambahan untuk menghindari terpotong
        const diagonal = Math.sqrt(textWidth * textWidth + textHeight * textHeight);
        const baseCanvasSize = Math.ceil(diagonal) + padding * 2;
        
        // Set ukuran canvas dengan scale tinggi untuk resolusi lebih baik
        canvas.width = baseCanvasSize * scale;
        canvas.height = baseCanvasSize * scale;
        
        // Reset context setelah resize canvas
        ctx = canvas.getContext('2d');
        if (!ctx) return '';
        
        // Scale context untuk menjaga proporsi
        ctx.scale(scale, scale);
        
        // Set style untuk watermark dengan font size yang sesuai
        ctx.fillStyle = 'rgba(200, 200, 200, 0.3)'; // Abu-abu terang dengan opacity rendah
        ctx.font = `bold ${baseFontSize}px Times New Roman`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        // Rotasi 45 derajat
        ctx.save();
        ctx.translate(baseCanvasSize / 2, baseCanvasSize / 2);
        ctx.rotate(-45 * Math.PI / 180);
        
        // Tambahkan teks watermark
        ctx.fillText(text, 0, 0);
        
        ctx.restore();
        
        return canvas.toDataURL('image/png');
      };

      const watermarkDataUrl = createWatermark();

      // Footer halaman dan Watermark
      const totalPages = doc.internal.getNumberOfPages();
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        
        // Tambahkan watermark di setiap halaman
        if (watermarkDataUrl) {
          const pageWidth = doc.internal.pageSize.width;
          const pageHeight = doc.internal.pageSize.height;
          const centerX = pageWidth / 2;
          const centerY = pageHeight / 2;
          
          // Tambahkan watermark sebagai gambar di tengah halaman
          // Ukuran watermark disesuaikan agar cukup besar dan tidak terpotong
          try {
            const watermarkWidth = 250;  // Width lebih besar
            const watermarkHeight = 250;  // Height lebih besar (persegi)
            doc.addImage(
              watermarkDataUrl,
              'PNG',
              centerX - watermarkWidth / 2, // Offset untuk posisi tengah
              centerY - watermarkHeight / 2, // Offset untuk posisi tengah
              watermarkWidth,
              watermarkHeight,
              undefined,
              'FAST'
            );
          } catch (error) {
            console.error('Error adding watermark:', error);
          }
        }
        
        // Footer
        doc.setFontSize(8);
        doc.setFont("times", "normal");
        doc.setTextColor(0, 0, 0);
        doc.text(
          `Halaman ${i} dari ${totalPages}`,
          105,
          doc.internal.pageSize.height - 15,
          { align: "center" }
        );
        doc.text(
          `Dicetak pada: ${new Date().toLocaleDateString(
            "id-ID"
          )} ${new Date().toLocaleTimeString("id-ID")}`,
          105,
          doc.internal.pageSize.height - 10,
          { align: "center" }
        );
      }

      // Generate filename
      const tanggalFile = jadwalDetail.tanggal 
        ? new Date(jadwalDetail.tanggal).toISOString().split('T')[0]
        : new Date().toISOString().split('T')[0];
      const filename = `Absensi_Praktikum_${jadwalDetail.mata_kuliah_kode}_${tanggalFile}`;

      // Save PDF
      doc.save(`${filename}.pdf`);
    } catch (error) {
      console.error('Error exporting to PDF:', error);
      alert('Gagal mengekspor data ke PDF. Silakan coba lagi.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Memuat data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 dark:text-red-400">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-gray-200 hover:bg-gray-300 rounded-lg"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const stats = {
    total: mahasiswaList.length,
    hadir: Object.values(absensi).filter(a => a?.hadir).length,
    persentase: mahasiswaList.length > 0 
      ? Math.round((Object.values(absensi).filter(a => a?.hadir).length / mahasiswaList.length) * 100)
      : 0
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white mb-4"
        >
          <ChevronLeftIcon className="w-5 h-5 mr-1" />
          Kembali
        </button>

        {/* Success Message dihapus - auto-save per perubahan */}

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6 mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <FontAwesomeIcon icon={faUsers} className="text-green-500" />
            Absensi Praktikum
          </h1>
          {jadwalDetail && (
            <div className="mt-5">
              <div className="text-sm text-gray-500 dark:text-gray-400 mb-3">Informasi Kelas</div>
              {/* Layout 2 baris: baris 1 untuk informasi konten (span lebih lebar), baris 2 untuk meta */}
              <div className="grid gap-4 grid-cols-1 md:grid-cols-6">
                {/* Row 1 */}
                <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
                  <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Mata Kuliah</div>
                  <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
                    {jadwalDetail?.mata_kuliah?.nama || jadwalDetail?.mata_kuliah_kode}
                  </div>
                </div>
                <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
                  <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Materi</div>
                  <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
                    {jadwalDetail?.materi || '-'}
                  </div>
                </div>
                <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
                  <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Topik</div>
                  <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
                    {jadwalDetail?.topik || '-'}
                  </div>
                </div>

                {/* Row 2 */}
                <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
                  <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Tanggal</div>
                  <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
                    {new Date(jadwalDetail.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </div>
                </div>
                <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
                  <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Waktu</div>
                  <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
                    {jadwalDetail.jam_mulai} - {jadwalDetail.jam_selesai}
                  </div>
                </div>
                <div className="md:col-span-2 rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50/80 dark:bg-gray-700/40 p-4">
                  <div className="text-xs font-medium tracking-wide text-gray-600 dark:text-gray-400">Ruangan</div>
                  <div className="text-base font-semibold text-gray-900 dark:text-white break-words leading-snug">
                    {jadwalDetail?.ruangan?.nama || '-'}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Total Mahasiswa</div>
            <div className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Hadir</div>
            <div className="text-2xl font-bold text-green-600">{stats.hadir}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow p-4">
            <div className="text-sm text-gray-600 dark:text-gray-400">Persentase</div>
            <div className="text-2xl font-bold text-purple-600">{stats.persentase}%</div>
          </div>
        </div>

        {/* Tombol Export */}
        <div className="flex flex-wrap gap-3 mb-6">
          <button
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-200 text-sm font-medium shadow-theme-xs hover:bg-purple-200 dark:hover:bg-purple-800 transition"
          >
            <FontAwesomeIcon icon={faFileExcel} className="w-5 h-5" />
            Export Excel
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-200 text-sm font-medium shadow-theme-xs hover:bg-red-200 dark:hover:bg-red-800 transition"
          >
            <FontAwesomeIcon icon={faFilePdf} className="w-5 h-5" />
            Export PDF
          </button>
        </div>

        {/* Tabs */}
        <div className="bg-white dark:bg-gray-800 rounded-t-2xl shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab('manual')}
              className={`px-6 py-3 font-semibold transition-colors ${
                activeTab === 'manual'
                  ? 'text-green-600 border-b-2 border-green-600 dark:text-green-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              Manual
            </button>
            <button
              onClick={() => setActiveTab('qr')}
              className={`px-6 py-3 font-semibold transition-colors flex items-center gap-2 ${
                activeTab === 'qr'
                  ? 'text-green-600 border-b-2 border-green-600 dark:text-green-400'
                  : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
              }`}
            >
              <FontAwesomeIcon icon={faDesktop} />
              Presentasi QR
            </button>
          </div>
        </div>

        {/* Content */}
        {activeTab === 'manual' ? (
          <div className="bg-white dark:bg-gray-800 rounded-b-xl shadow-md border border-t-0 border-gray-200 dark:border-gray-700">
            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-3 gap-3">
                <div className="font-semibold text-lg text-brand-700 dark:text-white/80 mb-2 md:mb-0">&nbsp;</div>
                <div className="relative w-full max-w-xs ml-auto">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
                  </span>
                  <input
                    type="text"
                    className="pl-10 pr-4 py-2 w-full bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-brand-400 focus:border-brand-500 text-gray-700 dark:text-white text-sm placeholder:text-gray-400 dark:placeholder:text-gray-300 outline-none"
                    placeholder="Cari nama atau NIM ..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                  />
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full font-inter text-[15px] rounded-b-xl overflow-hidden">
                  <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-gray-800/80 backdrop-blur-md">
                    <tr>
                      <th className="px-4 py-3 text-xs font-bold tracking-wider text-brand-700 dark:text-white/80 text-center border-b border-gray-200 dark:border-gray-700 uppercase">#</th>
                      <th className="px-4 py-3 text-xs font-bold tracking-wider text-brand-700 dark:text-white/80 text-left border-b border-gray-200 dark:border-gray-700 uppercase">NIM</th>
                      <th className="px-4 py-3 text-xs font-bold tracking-wider text-brand-700 dark:text-white/80 text-left border-b border-gray-200 dark:border-gray-700 uppercase">Nama</th>
                      <th className="px-4 py-3 text-xs font-bold tracking-wider text-brand-700 dark:text-white/80 text-center border-b border-gray-200 dark:border-gray-700 uppercase">Hadir</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                    {(mahasiswaList.filter(m => {
                      const q = searchQuery.trim().toLowerCase();
                      return q === '' || m.nama.toLowerCase().includes(q) || m.nim.toLowerCase().includes(q);
                    })).length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-16 text-center">
                          <div className="flex flex-col items-center gap-3 text-gray-400 dark:text-gray-500">
                            <svg className="w-10 h-10" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1 4h.01M12 9h.01" />
                              <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                            </svg>
                            <span className="bg-gray-100 dark:bg-gray-800/60 rounded-full px-5 py-2 mt-1 font-medium">Tidak ada data mahasiswa...</span>
                          </div>
                        </td>
                      </tr>
                    ) : mahasiswaList.filter(m => {
                      const q = searchQuery.trim().toLowerCase();
                      return q === '' || m.nama.toLowerCase().includes(q) || m.nim.toLowerCase().includes(q);
                    }).map((m, i) => {
                      const hadir = absensi[m.nim]?.hadir || false;
                      return (
                        <tr
                          key={m.id}
                          className={`transition group ${i % 2 === 1 ? 'bg-gray-50 dark:bg-gray-900/60' : 'bg-white dark:bg-gray-800'} hover:bg-brand-50 dark:hover:bg-brand-900/20 border-b border-gray-100 dark:border-gray-800`}
                        >
                          <td className="align-middle text-center text-xs text-gray-400 px-4 py-3">{i + 1}</td>
                          <td className="align-middle px-4 py-3 font-mono tracking-wide text-gray-700 dark:text-gray-200 text-left text-[15px]">{m.nim}</td>
                          <td className="align-middle px-4 py-3 text-gray-900 dark:text-white text-[15px] font-medium text-left">{m.nama}</td>
                          <td className="align-middle text-center px-4 py-3">
                            <div className="relative flex items-center justify-center select-none mx-auto" style={{ width: 24, height: 24 }}>
                              <input
                                type="checkbox"
                                checked={hadir}
                                onChange={(e) => handleAbsensiToggle(m.nim, e.target.checked)}
                                disabled={isSyncing || loading}
                                className={`w-6 h-6 appearance-none rounded-md border-2 transition-colors duration-150 focus:ring-2 focus:ring-brand-300 dark:focus:ring-brand-600 relative
                                  ${hadir ? 'border-brand-500 bg-brand-500' : 'border-brand-500 bg-transparent'} disabled:opacity-50 disabled:cursor-not-allowed`}
                                style={{ outline: 'none' }}
                              />
                              {hadir && (
                                <span style={{ position: 'absolute', left: 0, top: 0, width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                  <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="white" strokeWidth="2.5" style={{ display: 'block' }}>
                                    <polyline points="5 11 9 15 15 7" fill="none" stroke="white" strokeWidth="2.5" />
                                  </svg>
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ) : (
          <div className="bg-white dark:bg-gray-800 rounded-b-2xl shadow-sm border border-t-0 border-gray-200 dark:border-gray-700 p-4 sm:p-6">
            <div className="max-w-3xl mx-auto">
              {/* Header Section */}
              <div className="text-center mb-4 sm:mb-6">
                <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 bg-brand-500 rounded-xl mb-2 sm:mb-3">
                  <FontAwesomeIcon icon={faDesktop} className="text-white text-lg sm:text-xl" />
                </div>
                <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-white mb-1 sm:mb-2 px-2">
                  Presentasi QR Code untuk Absensi
                </h2>
                <p className="text-xs sm:text-sm text-gray-600 dark:text-gray-400 px-2">
                  Tampilkan QR code ini di layar proyektor agar mahasiswa dapat scan dengan HP mereka
                </p>
              </div>
              
              {/* Status & Control Card */}
              <div className={`rounded-xl border p-3 sm:p-4 mb-4 sm:mb-6 transition-colors ${
                qrEnabled
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : 'bg-gray-50 dark:bg-gray-700/50 border-gray-200 dark:border-gray-700'
              }`}>
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                  <div className="flex items-center gap-2 sm:gap-3 w-full sm:w-auto">
                    <div className={`w-2.5 h-2.5 sm:w-3 sm:h-3 rounded-full flex-shrink-0 ${
                      qrEnabled ? 'bg-green-500' : 'bg-gray-400'
                    }`}></div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs sm:text-sm font-semibold ${
                        qrEnabled 
                          ? 'text-green-700 dark:text-green-400' 
                          : 'text-gray-700 dark:text-gray-300'
                      }`}>
                        {qrEnabled ? 'QR Code Aktif' : 'QR Code Tidak Aktif'}
                      </p>
                      <p className="text-xs text-gray-600 dark:text-gray-400">
                        {qrEnabled ? 'Mahasiswa dapat melakukan scan sekarang' : 'Aktifkan QR code untuk memulai sesi absensi'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      if (!kode || !jadwalId) return;
                      setTogglingQR(true);
                      try {
                        const response = await api.put(`/praktikum/${kode}/jadwal/${jadwalId}/toggle-qr`);
                        setQrEnabled(response.data.qr_enabled);
                      } catch (err: any) {
                        console.error('Error toggling QR:', err);
                        setError(handleApiError(err, 'Gagal mengubah status QR code'));
                      } finally {
                        setTogglingQR(false);
                      }
                    }}
                    disabled={togglingQR}
                    className={`w-full sm:w-auto px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                      qrEnabled
                        ? 'bg-red-500 hover:bg-red-600 text-white'
                        : 'bg-brand-500 hover:bg-brand-600 text-white'
                    } ${togglingQR ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    {togglingQR ? (
                      <span className="flex items-center justify-center gap-2">
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin" />
                        <span>Memproses...</span>
                      </span>
                    ) : qrEnabled ? (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                        <span>Nonaktifkan</span>
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-3.5 h-3.5 sm:w-4 sm:h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                        </svg>
                        <span>Aktifkan QR Code</span>
                      </span>
                    )}
                  </button>
                </div>
              </div>

              {/* QR Code Display */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-3 sm:p-6 mb-4 sm:mb-6">
                {!qrEnabled ? (
                  <div className="text-center py-12">
                    <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 dark:bg-gray-700 rounded-xl mb-4">
                      <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                      </svg>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">QR Code Belum Diaktifkan</h3>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      Klik tombol <span className="font-semibold text-brand-600 dark:text-brand-400">"Aktifkan QR Code"</span> di atas untuk menampilkan QR code
                    </p>
                  </div>
                ) : qrCodeData ? (
                  <div className="flex flex-col items-center">
                    {/* Countdown Timer */}
                    {timeRemaining > 0 && (
                      <div className="mb-4 sm:mb-6 w-full flex justify-center">
                        <div className={`flex items-center justify-center gap-2 sm:gap-3 px-4 py-2.5 sm:px-6 sm:py-4 rounded-xl border transition-colors w-full sm:w-auto ${
                          timeRemaining <= 10
                            ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
                            : timeRemaining <= 30
                            ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-200 dark:border-orange-800'
                            : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                        }`}>
                          <div className={`flex items-center justify-center w-8 h-8 sm:w-10 sm:h-10 rounded-lg flex-shrink-0 ${
                            timeRemaining <= 10
                              ? 'bg-red-500 dark:bg-red-600'
                              : timeRemaining <= 30
                              ? 'bg-orange-500 dark:bg-orange-600'
                              : 'bg-blue-500 dark:bg-blue-600'
                          }`}>
                            <svg className={`w-4 h-4 sm:w-5 sm:h-5 text-white ${timeRemaining <= 10 ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                          </div>
                          <div className="flex flex-col items-center text-center">
                            <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">
                              QR Code akan berubah dalam
                            </p>
                            <p className={`text-xl sm:text-2xl font-bold ${
                              timeRemaining <= 10
                                ? 'text-red-600 dark:text-red-400'
                                : timeRemaining <= 30
                                ? 'text-orange-600 dark:text-orange-400'
                                : 'text-blue-600 dark:text-blue-400'
                            }`}>
                              {Math.floor(timeRemaining / 60)}:{(timeRemaining % 60).toString().padStart(2, '0')}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                    
                    {/* QR Code Container */}
                    <div className="bg-white dark:bg-gray-900 p-3 sm:p-6 rounded-xl border-2 border-gray-200 dark:border-gray-600 mb-4 sm:mb-6 relative overflow-hidden flex items-center justify-center">
                      {/* Loading overlay saat fetch token baru */}
                      {isFetchingToken && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm z-10 flex items-center justify-center rounded-xl"
                        >
                          <div className="flex flex-col items-center gap-2">
                            <FontAwesomeIcon icon={faSpinner} className="animate-spin text-blue-600 dark:text-blue-400 text-xl sm:text-2xl" />
                            <p className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">Memperbarui QR code...</p>
                          </div>
                        </motion.div>
                      )}
                      
                      {/* QR Code dengan animasi */}
                      <motion.div
                        key={qrCodeKey}
                        className="flex items-center justify-center relative w-full max-w-[280px]"
                      >
                        {/* Efek butiran dari QR code */}
                        {showParticles && (
                          <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden" style={{ width: '100%', height: '100%', maxWidth: '280px', maxHeight: '280px', left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}>
                            {[...Array(100)].map((_, i) => {
                              // Menggunakan ukuran container yang dinamis
                              const qrSize = 280;
                              // Posisi random di area QR code
                              const x = Math.random() * qrSize;
                              const y = Math.random() * qrSize;
                              // Warna random hitam atau putih (sesuai QR code)
                              const isBlack = Math.random() > 0.5;
                              const angle = Math.random() * Math.PI * 2;
                              const distance = 40 + Math.random() * 80;
                              
                              return (
                                <motion.div
                                  key={`particle-${qrCodeKey}-${i}`}
                                  initial={{ 
                                    opacity: 1,
                                    scale: 1,
                                    x: x,
                                    y: y,
                                  }}
                                  animate={{ 
                                    opacity: [1, 1, 0.8, 0],
                                    scale: [1, 1.2, 0.3, 0],
                                    x: x + Math.cos(angle) * distance,
                                    y: y + Math.sin(angle) * distance,
                                  }}
                                  transition={{
                                    duration: 1.8,
                                    delay: Math.random() * 0.4,
                                    ease: "easeOut"
                                  }}
                                  className="absolute rounded-sm"
                                  style={{
                                    width: '6px',
                                    height: '6px',
                                    backgroundColor: isBlack ? '#000000' : '#ffffff',
                                    boxShadow: isBlack 
                                      ? '0 0 4px rgba(0,0,0,0.8), 0 0 8px rgba(0,0,0,0.4)' 
                                      : '0 0 4px rgba(255,255,255,0.8), 0 0 8px rgba(255,255,255,0.4)',
                                    left: `${x}px`,
                                    top: `${y}px`,
                                  }}
                                />
                              );
                            })}
                          </div>
                        )}
                        
                        <QRCode 
                          value={qrCodeData} 
                          size={280}
                          level="H"
                          includeMargin={true}
                          className="w-full h-auto max-w-full relative z-10"
                          style={{ maxWidth: '280px', maxHeight: '280px' }}
                        />
                      </motion.div>
                      
                      {/* Indicator bahwa QR code baru */}
                      {showNewBadge && !isFetchingToken && (
                        <AnimatePresence>
                          <motion.div
                            initial={{ opacity: 0, y: -10, scale: 0.8 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -10, scale: 0.8 }}
                            transition={{ duration: 0.3 }}
                            className="absolute top-1 right-1 sm:top-2 sm:right-2 bg-green-500 text-white text-xs font-semibold px-2 py-0.5 sm:px-3 sm:py-1 rounded-full shadow-lg flex items-center gap-1 sm:gap-1.5 z-20"
                          >
                            <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                            </svg>
                            <span className="hidden sm:inline">QR Code Baru</span>
                            <span className="sm:hidden">Baru</span>
                          </motion.div>
                        </AnimatePresence>
                      )}
                    </div>
                    
                    {/* Instruksi */}
                    <div className="w-full max-w-lg mx-auto">
                      <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 sm:p-4 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-center gap-2 mb-2 sm:mb-3">
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          <p className="text-xs sm:text-sm font-semibold text-blue-700 dark:text-blue-400">
                            Instruksi untuk Mahasiswa
                          </p>
                        </div>
                        <ol className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm text-gray-700 dark:text-gray-300">
                          <li className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                            <span>Buka aplikasi scanner QR code di HP Anda</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                            <span>Arahkan kamera HP ke QR code yang ditampilkan di layar</span>
                          </li>
                          <li className="flex items-start gap-2">
                            <span className="flex-shrink-0 w-4 h-4 sm:w-5 sm:h-5 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                            <span>Konfirmasi kehadiran Anda di halaman yang muncul</span>
                          </li>
                        </ol>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <FontAwesomeIcon icon={faSpinner} className="animate-spin text-brand-600 dark:text-brand-400 text-2xl mb-2" />
                    <p className="text-sm text-gray-600 dark:text-gray-400">Memuat QR code...</p>
                  </div>
                )}
              </div>

              {/* Manual table untuk referensi */}
              <div className="mt-6">
                <h3 className="text-base font-semibold text-gray-900 dark:text-white mb-3">Daftar Mahasiswa (Referensi)</h3>
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
                  <div className="max-h-96 overflow-y-auto">
                    <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                      <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">NIM</th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Nama</th>
                          <th className="px-4 py-2 text-center text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 dark:divide-gray-800 bg-white dark:bg-gray-800">
                        {mahasiswaList.map((m) => (
                          <tr key={m.id} className={`${absensi[m.nim]?.hadir ? 'bg-green-50 dark:bg-green-900/10' : ''} hover:bg-gray-50 dark:hover:bg-gray-700/50`}>
                            <td className="px-4 py-2.5 font-mono text-sm text-gray-900 dark:text-white">{m.nim}</td>
                            <td className="px-4 py-2.5 text-sm text-gray-900 dark:text-white">{m.nama}</td>
                            <td className="px-4 py-2.5 text-center">
                              {absensi[m.nim]?.hadir ? (
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300 text-xs font-semibold">
                                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 20 20">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L15 7" />
                                  </svg>
                                  Hadir
                                </span>
                              ) : (
                                <span className="text-xs text-gray-400">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Save button dihapus - tidak diperlukan */}
        {/* Confirmation Modal */}
        <AnimatePresence>
          {confirmOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[99999] flex items-center justify-center bg-black/60 backdrop-blur-sm"
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-md p-6 border border-gray-200 dark:border-gray-700"
              >
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">Konfirmasi Ubah Kehadiran</h3>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
                  {pendingChange?.desired
                    ? 'Anda akan menandai mahasiswa menjadi Hadir.'
                    : 'Anda akan menandai mahasiswa menjadi Tidak Hadir.'}
                  {' '}Lanjutkan?
                </p>
                <div className="flex justify-end gap-3">
                  <button
                    onClick={cancelUncheck}
                    className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    Batal
                  </button>
                  <button
                    onClick={confirmChange}
                    className={`px-4 py-2 rounded-lg text-white ${pendingChange?.desired ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'}`}
                  >
                    {pendingChange?.desired ? 'Ya, Tandai Hadir' : 'Ya, Tandai Tidak Hadir'}
            </button>
          </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
