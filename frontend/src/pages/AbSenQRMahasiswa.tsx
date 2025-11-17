import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api, { getUser } from '../utils/api';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimesCircle, faSpinner, faQrcode, faCameraRetro, faLightbulb, faInfoCircle, faRedo } from '@fortawesome/free-solid-svg-icons';
import { Html5Qrcode } from 'html5-qrcode';
import { AnimatePresence, motion } from 'framer-motion';

export default function AbSenQRMahasiswa() {
  const user = getUser();
  const navigate = useNavigate();

  const [error, setError] = useState<string | null>(null);
  const [showScanner, setShowScanner] = useState(false);
  const [scannerReady, setScannerReady] = useState(false);
  const [jadwalNotFound, setJadwalNotFound] = useState(false);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const qrScanAreaId = "qr-reader-main";

  useEffect(() => {
    if (!user || user.role !== 'mahasiswa') {
      setError('Akses ditolak. Hanya mahasiswa yang dapat mengakses halaman ini.');
      return;
    }
    
    // Auto start scanner saat halaman dimuat
    const timer = setTimeout(() => {
      startScanner();
    }, 500);
    
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Inject custom CSS untuk scanner styling
  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      #${qrScanAreaId} video {
        width: 100% !important;
        height: 100% !important;
        object-fit: cover !important;
        border-radius: 0 !important;
      }
      
      #${qrScanAreaId} .html5-qrcode-element {
        width: 100% !important;
        height: 100% !important;
        border-radius: 0 !important;
      }
      
      #${qrScanAreaId} canvas {
        width: 100% !important;
        height: 100% !important;
        border-radius: 0 !important;
      }
      
      #${qrScanAreaId} .html5-qrcode-element img {
        width: 100% !important;
        height: 100% !important;
        border-radius: 0 !important;
      }
    `;
    document.head.appendChild(style);
    
    return () => {
      document.head.removeChild(style);
    };
  }, [qrScanAreaId]);

  // Fungsi untuk meminta izin kamera terlebih dahulu
  const requestCameraPermission = async (): Promise<string | null> => {
    try {
      console.log('Checking camera API support...');
      console.log('navigator.mediaDevices:', !!navigator.mediaDevices);
      console.log('navigator.mediaDevices.getUserMedia:', !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia));
      
      // Check if getUserMedia is supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.log('Modern API not supported, trying legacy API...');
        // Fallback for older browsers
        const getUserMedia = (navigator as any).getUserMedia || 
                             (navigator as any).webkitGetUserMedia || 
                             (navigator as any).mozGetUserMedia;
        
        if (!getUserMedia) {
          console.error('No camera API available');
          throw new Error('Browser tidak mendukung akses kamera. Pastikan menggunakan Chrome atau Safari versi terbaru, dan akses melalui HTTPS.');
        }
        
        // Use legacy API
        return new Promise((resolve, reject) => {
          getUserMedia.call(navigator, { video: { facingMode: 'environment' } }, 
            (stream: MediaStream) => {
              stream.getTracks().forEach(track => track.stop());
              // Get cameras using html5-qrcode
              Html5Qrcode.getCameras()
                .then(devices => {
                  console.log('Available cameras:', devices);
                  const backCamera = devices.find(dev => 
                    dev.label.toLowerCase().includes('back') || 
                    dev.label.toLowerCase().includes('rear')
                  );
                  resolve(backCamera?.id || devices[0]?.id || null);
                })
                .catch(reject);
            },
            (err: any) => reject(err)
          );
        });
      }
      
      // Modern API
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      
      // Stop the stream immediately after getting permission
      stream.getTracks().forEach(track => track.stop());
      
      // Now get available cameras
      const devices = await Html5Qrcode.getCameras();
      console.log('Available cameras:', devices);
      
      // Pilih kamera belakang jika tersedia
      const backCamera = devices.find(dev => 
        dev.label.toLowerCase().includes('back') || 
        dev.label.toLowerCase().includes('rear')
      );
      
      if (backCamera) {
        return backCamera.id;
      } else if (devices.length > 0) {
        return devices[0].id; // Pakai kamera pertama yang tersedia
      } else {
        throw new Error('No camera found on device');
      }
    } catch (err: any) {
      console.error('Error requesting camera permission:', err);
      throw err;
    }
  };

  // Fungsi untuk memulai scanner
  const startScanner = async () => {
    try {
      setShowScanner(true);
      setScannerReady(false);
      setError(null);
      
      // Tunggu DOM ready
      setTimeout(async () => {
        try {
          const element = document.getElementById(qrScanAreaId);
          if (!element) {
            throw new Error('Scanner element not found');
          }
          
          // Request camera permission first
          const cameraId = await requestCameraPermission();
          if (!cameraId) {
            throw new Error('No camera available');
          }
          
          const scanner = new Html5Qrcode(qrScanAreaId);
          scannerRef.current = scanner;

          // Start the scanner with the selected camera
          // Calculate dynamic qrbox size for mobile-friendly scanning
          const viewportWidth = window.innerWidth;
          const viewportHeight = window.innerHeight;
          
          // For very small screens (mobile), use almost full width
          // For larger screens, limit to maximum size
          let qrboxSize;
          if (viewportWidth < 400) {
            // Mobile: use 95% of viewport width or 85% of height, whichever is smaller
            qrboxSize = Math.min(
              Math.floor(viewportWidth * 0.95),
              Math.floor(viewportHeight * 0.85)
            );
          } else if (viewportWidth < 768) {
            // Tablet: use 90% of viewport width
            qrboxSize = Math.min(600, Math.floor(viewportWidth * 0.9));
          } else {
            // Desktop: use 700px max
            qrboxSize = Math.min(700, Math.floor(viewportWidth * 0.8));
          }
          
          await scanner.start(
            cameraId,
            {
              fps: 10,
              aspectRatio: 1.0,
              qrbox: { width: qrboxSize, height: qrboxSize }
            },
            (decodedText) => {
              // QR berhasil di-scan
              handleQRScanSuccess(decodedText);
            },
            (errorMessage) => {
              // Ignore scan errors untuk menghindari log berulang
            }
          );
          
          setScannerReady(true);
        } catch (err: any) {
          console.error('Error starting scanner:', err);
          
          // Handle specific error cases
          if (err.message?.includes('Permission denied') || err.name === 'NotAllowedError') {
            setError('Akses kamera ditolak. Silakan izinkan akses kamera di pengaturan browser Anda.');
          } else if (err.message?.includes('No camera') || err.message?.includes('not found') || err.name === 'NotFoundError') {
            setError('Kamera tidak ditemukan. Pastikan HP Anda memiliki kamera dan tidak sedang digunakan aplikasi lain.');
          } else if (err.message?.includes('HTTPS') || err.name === 'SecurityError' || err.message?.includes('not allowed')) {
            setError('Kamera memerlukan HTTPS untuk diaktifkan. Silakan gunakan HTTPS atau akses via localhost.');
          } else if (err.message?.includes('already started')) {
            setError('Kamera sudah aktif. Silakan tutup dan buka ulang scanner.');
          } else if (err.message?.includes('API not supported')) {
            setError('Browser tidak mendukung akses kamera. Silakan gunakan Chrome atau Safari versi terbaru.');
          } else {
            setError(`Gagal mengaktifkan kamera: ${err.message || err.name || 'Error tidak diketahui'}`);
          }
          
          setShowScanner(false);
        }
      }, 500);
    } catch (err) {
      console.error('Error initializing scanner:', err);
      setError('Gagal menginisialisasi scanner');
    }
  };

  // Fungsi untuk menghentikan scanner
  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
      } catch (err) {
        console.log('Scanner already stopped or not started');
      }
      
      try {
        scannerRef.current.clear();
      } catch (err) {
        console.log('Scanner already cleared');
      }
      
      scannerRef.current = null;
    }
    setShowScanner(false);
    setScannerReady(false);
    setError(null);
  };

  // Fungsi untuk menangani hasil scan QR
  const handleQRScanSuccess = async (decodedText: string) => {
    // Stop scanner
    await stopScanner();
    
    // Validasi URL dan cek apakah jadwal ada di database
    try {
      const url = new URL(decodedText);
      const pathParts = url.pathname.split('/');
      
      // Validasi: URL harus dari domain yang sama dengan aplikasi
      const currentOrigin = window.location.origin;
      if (url.origin !== currentOrigin) {
        setError('QR Code tidak valid - origin tidak sesuai');
        setTimeout(() => {
          setError(null);
          startScanner();
        }, 3000);
        return;
      }
      
      // Validasi format path: support untuk kuliah besar, kuliah besar antara, non-blok non-CSR, dan praktikum
      // Path harus persis seperti format yang dihasilkan dari QR Code dosen
      const kuliahBesarPattern = /^\/mahasiswa\/absensi-kuliah-besar\/[A-Z0-9]+\/\d+(\?.*)?$/;
      const kuliahBesarAntaraPattern = /^\/mahasiswa\/absensi-kuliah-besar-antara\/[A-Z0-9]+\/\d+(\?.*)?$/;
      const nonBlokNonCSRPattern = /^\/mahasiswa\/absensi-non-blok-non-csr\/[A-Z0-9]+\/\d+(\?.*)?$/;
      const nonBlokNonCSRAntaraPattern = /^\/mahasiswa\/absensi-non-blok-non-csr-antara\/[A-Z0-9]+\/\d+(\?.*)?$/;
      const praktikumPattern = /^\/mahasiswa\/absensi-praktikum\/[A-Z0-9]+\/\d+(\?.*)?$/;
      const seminarPlenoPattern = /^\/mahasiswa\/absensi-seminar-pleno\/[A-Z0-9]+\/\d+(\?.*)?$/;
      
      if (!kuliahBesarPattern.test(url.pathname) && !kuliahBesarAntaraPattern.test(url.pathname) && !nonBlokNonCSRPattern.test(url.pathname) && !nonBlokNonCSRAntaraPattern.test(url.pathname) && !praktikumPattern.test(url.pathname) && !seminarPlenoPattern.test(url.pathname)) {
        setError('QR Code tidak valid - path tidak sesuai format jadwal');
        setTimeout(() => {
          setError(null);
          startScanner();
        }, 3000);
        return;
      }
      
      // Cek apakah URL sesuai dengan format absensi kuliah besar, kuliah besar antara, non-blok non-CSR, non-blok non-CSR antara, praktikum, atau seminar pleno
      let jadwalType: 'kuliah-besar' | 'kuliah-besar-antara' | 'non-blok-non-csr' | 'non-blok-non-csr-antara' | 'praktikum' | 'seminar-pleno' | null = null;
      let kode: string | undefined;
      let jadwalId: string | undefined;
      
      if (pathParts.includes('absensi-kuliah-besar-antara')) {
        jadwalType = 'kuliah-besar-antara';
        const kodeIndex = pathParts.indexOf('absensi-kuliah-besar-antara') + 1;
        const jadwalIdIndex = kodeIndex + 1;
        kode = pathParts[kodeIndex];
        jadwalId = pathParts[jadwalIdIndex];
      } else if (pathParts.includes('absensi-kuliah-besar')) {
        jadwalType = 'kuliah-besar';
        const kodeIndex = pathParts.indexOf('absensi-kuliah-besar') + 1;
        const jadwalIdIndex = kodeIndex + 1;
        kode = pathParts[kodeIndex];
        jadwalId = pathParts[jadwalIdIndex];
      } else if (pathParts.includes('absensi-non-blok-non-csr-antara')) {
        jadwalType = 'non-blok-non-csr-antara';
        const kodeIndex = pathParts.indexOf('absensi-non-blok-non-csr-antara') + 1;
        const jadwalIdIndex = kodeIndex + 1;
        kode = pathParts[kodeIndex];
        jadwalId = pathParts[jadwalIdIndex];
      } else if (pathParts.includes('absensi-non-blok-non-csr')) {
        jadwalType = 'non-blok-non-csr';
        const kodeIndex = pathParts.indexOf('absensi-non-blok-non-csr') + 1;
        const jadwalIdIndex = kodeIndex + 1;
        kode = pathParts[kodeIndex];
        jadwalId = pathParts[jadwalIdIndex];
      } else if (pathParts.includes('absensi-praktikum')) {
        jadwalType = 'praktikum';
        const kodeIndex = pathParts.indexOf('absensi-praktikum') + 1;
        const jadwalIdIndex = kodeIndex + 1;
        kode = pathParts[kodeIndex];
        jadwalId = pathParts[jadwalIdIndex];
      } else if (pathParts.includes('absensi-seminar-pleno')) {
        jadwalType = 'seminar-pleno';
        const kodeIndex = pathParts.indexOf('absensi-seminar-pleno') + 1;
        const jadwalIdIndex = kodeIndex + 1;
        kode = pathParts[kodeIndex];
        jadwalId = pathParts[jadwalIdIndex];
      }
      
      if (jadwalType && kode && jadwalId) {
        // Validasi jadwal ada di database
        try {
          let response;
          if (jadwalType === 'kuliah-besar' || jadwalType === 'kuliah-besar-antara') {
            response = await api.get(`/kuliah-besar/jadwal/${kode}`);
          } else if (jadwalType === 'non-blok-non-csr' || jadwalType === 'non-blok-non-csr-antara') {
            response = await api.get(`/non-blok-non-csr/jadwal/${kode}`);
          } else if (jadwalType === 'seminar-pleno') {
            response = await api.get(`/seminar-pleno/jadwal/${kode}`);
          } else {
            // Praktikum menggunakan endpoint ini
            response = await api.get(`/praktikum/jadwal/${kode}`);
          }
          
          const allJadwal = response.data;
          const foundJadwal = allJadwal.find((j: any) => j.id === parseInt(jadwalId));

          if (foundJadwal) {
            // Jadwal ditemukan, redirect ke halaman konfirmasi absensi
            // Parse token dari URL jika ada
            const token = url.searchParams.get('token');
            let redirectUrl: string;
            
            if (jadwalType === 'kuliah-besar-antara') {
              redirectUrl = token 
                ? `/mahasiswa/absensi-kuliah-besar-antara/${kode}/${jadwalId}?from_qr=true&token=${token}`
                : `/mahasiswa/absensi-kuliah-besar-antara/${kode}/${jadwalId}?from_qr=true`;
            } else if (jadwalType === 'kuliah-besar') {
              redirectUrl = token 
                ? `/mahasiswa/absensi-kuliah-besar/${kode}/${jadwalId}?from_qr=true&token=${token}`
                : `/mahasiswa/absensi-kuliah-besar/${kode}/${jadwalId}?from_qr=true`;
            } else if (jadwalType === 'non-blok-non-csr-antara') {
              redirectUrl = token 
                ? `/mahasiswa/absensi-non-blok-non-csr-antara/${kode}/${jadwalId}?from_qr=true&token=${token}`
                : `/mahasiswa/absensi-non-blok-non-csr-antara/${kode}/${jadwalId}?from_qr=true`;
            } else if (jadwalType === 'non-blok-non-csr') {
              redirectUrl = token 
                ? `/mahasiswa/absensi-non-blok-non-csr/${kode}/${jadwalId}?from_qr=true&token=${token}`
                : `/mahasiswa/absensi-non-blok-non-csr/${kode}/${jadwalId}?from_qr=true`;
            } else if (jadwalType === 'seminar-pleno') {
              redirectUrl = token 
                ? `/mahasiswa/absensi-seminar-pleno/${kode}/${jadwalId}?from_qr=true&token=${token}`
                : `/mahasiswa/absensi-seminar-pleno/${kode}/${jadwalId}?from_qr=true`;
            } else {
              redirectUrl = token 
                ? `/mahasiswa/absensi-praktikum/${kode}/${jadwalId}?from_qr=true&token=${token}`
                : `/mahasiswa/absensi-praktikum/${kode}/${jadwalId}?from_qr=true`;
            }
            
            navigate(redirectUrl);
          } else {
            // Jadwal tidak ditemukan - tampilkan page khusus
            setJadwalNotFound(true);
          }
        } catch (err) {
          console.error('Error checking jadwal:', err);
          // Jadwal tidak ditemukan - tampilkan page khusus
          setJadwalNotFound(true);
        }
      } else {
        setError('QR Code tidak valid - data tidak lengkap');
        setTimeout(() => {
          setError(null);
          startScanner();
        }, 3000);
      }
    } catch (err) {
      setError('QR Code tidak valid - format URL salah');
      setTimeout(() => {
        setError(null);
        startScanner();
      }, 3000);
    }
  };



  // Cleanup scanner saat component unmount
  useEffect(() => {
    return () => {
      if (scannerRef.current) {
        scannerRef.current.stop().catch(() => {});
      }
    };
  }, []);

  // Tampilan khusus untuk jadwal tidak ditemukan (404-like page)
  if (jadwalNotFound) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center bg-white dark:bg-gray-800 p-12 rounded-3xl shadow-lg border border-gray-200 dark:border-gray-700 max-w-2xl w-full"
        >
          {/* 404 Icon */}
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full mb-4">
              <FontAwesomeIcon icon={faTimesCircle} className="text-red-500 text-5xl" />
        </div>
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-5xl font-bold text-gray-900 dark:text-white mb-4"
          >
            Jadwal Tidak Ditemukan
          </motion.h1>

          {/* Message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-xl text-gray-600 dark:text-gray-400 mb-10"
          >
            QR Code yang Anda scan tidak terkait dengan jadwal yang tersedia.
          </motion.p>

          {/* Reasons */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-gray-50 dark:bg-gray-700/50 rounded-2xl p-8 mb-10 text-left border border-gray-200 dark:border-gray-700"
          >
            <h3 className="font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2 text-lg">
              <FontAwesomeIcon icon={faLightbulb} className="text-yellow-500 text-xl" />
              Kemungkinan penyebab:
            </h3>
            <ul className="space-y-3 text-base text-gray-600 dark:text-gray-400">
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-1">•</span>
                <span>QR Code sudah tidak berlaku atau sudah expired</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-1">•</span>
                <span>QR Code yang di-scan salah atau bukan untuk absensi kuliah</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-red-500 mt-1">•</span>
                <span>Jadwal tersebut sudah tidak ada di sistem</span>
              </li>
            </ul>
          </motion.div>

          {/* Action Button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            onClick={async () => {
              // Stop scanner dulu jika masih running
              if (scannerRef.current) {
                try {
                  await scannerRef.current.stop();
                } catch (err) {
                  console.log('Scanner already stopped');
                }
              }
              setJadwalNotFound(false);
              setShowScanner(false);
              // Start scanner baru
              setTimeout(() => {
                startScanner();
              }, 500);
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-10 rounded-xl shadow-md transition-colors flex items-center gap-2 mx-auto text-base"
          >
            <FontAwesomeIcon icon={faQrcode} />
            Scan Ulang QR Code
          </motion.button>
        </motion.div>
      </div>
    );
  }

  if (error && !showScanner) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex items-center justify-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center bg-white dark:bg-gray-800 p-12 rounded-3xl shadow-lg border border-red-200 dark:border-red-800 max-w-2xl w-full"
        >
          {/* Error Icon */}
          <motion.div
            initial={{ y: -20 }}
            animate={{ y: 0 }}
            transition={{ delay: 0.2 }}
            className="mb-6"
          >
            <div className="inline-flex items-center justify-center w-24 h-24 bg-red-100 dark:bg-red-900/20 rounded-full mb-6">
              <FontAwesomeIcon icon={faTimesCircle} className="text-red-500 text-5xl" />
            </div>
          </motion.div>

          {/* Error Title */}
          <motion.h2
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-3xl font-bold text-gray-900 dark:text-white mb-4"
          >
            QR Code Tidak Valid
          </motion.h2>

          {/* Error Message */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-gray-600 dark:text-gray-400 mb-8 text-base"
          >
            {error}
          </motion.p>

          {/* Information Box */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="bg-blue-50 dark:bg-blue-900/20 rounded-2xl p-6 mb-8 text-left border border-blue-200 dark:border-blue-800"
          >
            <div className="flex items-start gap-3">
              <FontAwesomeIcon icon={faInfoCircle} className="text-blue-500 text-xl mt-1" />
              <div className="text-sm text-gray-700 dark:text-gray-300">
                <p className="font-semibold mb-3 text-base">Pastikan Anda scan QR Code yang benar:</p>
                <ul className="space-y-2 ml-2">
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>QR Code dari dosen untuk absensi kuliah</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>Bukan QR Code dari aplikasi lain</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-blue-500 mt-1">•</span>
                    <span>QR Code yang masih berlaku</span>
                  </li>
                </ul>
              </div>
        </div>
          </motion.div>

          {/* Action Button */}
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            onClick={() => {
              setError(null);
              setTimeout(() => {
                startScanner();
              }, 300);
            }}
            className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-4 px-8 rounded-xl shadow-md transition-colors flex items-center gap-2 mx-auto text-base"
          >
            <FontAwesomeIcon icon={faRedo} />
            Scan Ulang
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 text-center"
        >
          <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500 rounded-2xl mb-4">
            <FontAwesomeIcon icon={faQrcode} className="text-white text-xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            Absen Kuliah
          </h1>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Scan QR Code dari dosen untuk mengisi kehadiran
          </p>
        </motion.div>

        {/* Start Scanner Section - Show when scanner is not active */}
          {!showScanner && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700"
          >
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 mb-4">
                <FontAwesomeIcon icon={faCameraRetro} className="text-blue-600 dark:text-blue-400 text-3xl" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
                Siap untuk Scan QR Code
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Klik tombol di bawah untuk mulai memindai QR code dari dosen
              </p>
                              <button
                  onClick={startScanner}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-3 px-8 rounded-lg shadow-sm transition-colors flex items-center gap-2 mx-auto"
                >
                  <FontAwesomeIcon icon={faQrcode} />
                  Mulai Scan QR Code
                </button>
        </div>
            
            {/* Tips Section */}
            <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-start gap-3">
                <FontAwesomeIcon icon={faLightbulb} className="text-yellow-500 text-xl mt-1" />
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white mb-2">Tips:</h3>
                  <ul className="space-y-2 text-sm text-gray-600 dark:text-gray-400">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500">•</span>
                      <span>Pastikan Anda sudah berada di kelas dan dosen sudah menampilkan QR code</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500">•</span>
                      <span>Arahkan kamera ke QR code hingga terdeteksi dengan jelas</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500">•</span>
                      <span>Pastikan koneksi internet stabil untuk mengisi absensi</span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* QR Scanner Section - Clean Design */}
        {showScanner && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            {/* Scanner Card */}
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm p-6 border border-gray-200 dark:border-gray-700">
              {/* Header with Close Button */}
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                  <FontAwesomeIcon icon={faCameraRetro} className="text-blue-500" />
                  Scan QR Code
                </h2>
              <button
                onClick={stopScanner}
                className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors"
                  title="Tutup Scanner"
              >
                  <FontAwesomeIcon icon={faTimesCircle} className="text-gray-400 hover:text-red-500 text-xl" />
              </button>
            </div>

              {/* Scanner Area */}
              <div className="bg-gray-900 rounded-xl overflow-hidden shadow-2xl relative w-full mx-auto" style={{ aspectRatio: '1 / 1' }}>
                <div id={qrScanAreaId} className="w-full h-full"></div>
                
                {/* Animated Scanning Line dengan Shadow Effect */}
                {scannerReady && (
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-b from-transparent via-blue-400/50 to-transparent animate-scan-line scan-line-shadow">
                      {/* Top glow */}
                      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-blue-300/40 to-transparent blur-sm"></div>
                      {/* Middle bright line */}
                      <div className="absolute inset-0 bg-blue-400 opacity-60"></div>
                      {/* Bottom shadow */}
                      <div className="absolute -bottom-1 left-0 right-0 h-3 bg-gradient-to-b from-blue-500/30 to-transparent blur-lg"></div>
                    </div>
                  </div>
                )}
                
              {!scannerReady && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-95">
                  <div className="text-center text-white px-6">
                      <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-blue-500/20 mb-4">
                        <FontAwesomeIcon icon={faSpinner} className="animate-spin text-4xl text-blue-400" />
                      </div>
                      <p className="text-base font-medium mb-1">Mengaktifkan kamera...</p>
                      <p className="text-sm text-gray-400">Izinkan akses kamera jika diminta</p>
                  </div>
                </div>
              )}
            </div>

              {/* Instruction Text */}
              <div className="mt-4 text-center">
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Tempatkan QR code di dalam kotak pemindai
                </p>
                  </div>
                  </div>



            {/* Error Message */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-4 bg-red-50 dark:bg-red-900/20 rounded-lg p-4 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"
                >
                  <div className="flex items-start gap-3">
                    <FontAwesomeIcon icon={faTimesCircle} className="mt-0.5" />
                    <div>
                      <p className="font-semibold mb-1">Terjadi Kesalahan</p>
                      <p className="text-sm">{error}</p>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}


      </div>
    </div>
  );
}
