import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faArrowLeft,
  faFileAlt,
  faCalendarAlt,
  faClock,
  faMapMarkerAlt,
  faUserTie,
  faUsers,
  faGraduationCap,
  faClipboardCheck,
  faDownload,
  faCheckCircle,
} from "@fortawesome/free-solid-svg-icons";
import api from "../utils/api";
import PageMeta from "../components/common/PageMeta";
import jsPDF from "jspdf";
import JSZip from "jszip";

interface JadwalDetail {
  id: number;
  tanggal: string;
  jam_mulai: string;
  jam_selesai: string;
  jenis_baris: string;
  pembimbing?: { id: number; name: string; nid?: string };
  penguji_list?: { id: number; name: string; nid?: string }[];
  mahasiswa_list?: { id: number; nim: string; name: string }[];
  ruangan?: { id: number; nama: string; gedung?: string };
  jumlah_sesi?: number;
  dosen_role?: string;
  status_konfirmasi?: string;
}

const DetailSidangSkripsi = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [jadwal, setJadwal] = useState<JadwalDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadingZip, setDownloadingZip] = useState(false);
  const [hasilData, setHasilData] = useState<Record<number, any>>({});
  const [penilaianData, setPenilaianData] = useState<Record<number, any>>({});
  const [downloadingPDF, setDownloadingPDF] = useState<Record<number, boolean>>({});
  const [showKonfirmasiModal, setShowKonfirmasiModal] = useState(false);
  const [konfirmasiStatus, setKonfirmasiStatus] = useState<'bisa' | 'tidak_bisa'>('bisa');
  const [konfirmasiAlasan, setKonfirmasiAlasan] = useState('');
  const [submittingKonfirmasi, setSubmittingKonfirmasi] = useState(false);

  const fetchJadwalDetail = useCallback(async () => {
    try {
      setLoading(true);
      const response = await api.get(`/jadwal-non-blok-non-csr/${id}`);
      setJadwal(response.data.data);
      
      // Fetch hasil dan penilaian untuk cek status
      if (id) {
        try {
          const [hasilResponse, penilaianResponse] = await Promise.all([
            api.get(`/hasil-sidang-skripsi/jadwal/${id}`),
            api.get(`/penilaian-sidang-skripsi/jadwal/${id}`),
          ]);
          
          const hasilList = hasilResponse.data.data || [];
          const penilaianList = penilaianResponse.data.data || [];
          
          const hasilMap: Record<number, any> = {};
          hasilList.forEach((h: any) => {
            hasilMap[h.mahasiswa_id] = h;
          });
          setHasilData(hasilMap);
          
          const penilaianMap: Record<number, any> = {};
          penilaianList.forEach((p: any) => {
            penilaianMap[p.mahasiswa_id] = p;
          });
          setPenilaianData(penilaianMap);
        } catch (error) {
          // Error fetching hasil/penilaian - silent fail
        }
      }
    } catch (error) {
      // Error fetching jadwal detail
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (id) {
      fetchJadwalDetail();
    }
  }, [id, fetchJadwalDetail]);

  // Helper untuk cek status jadwal
  const getJadwalStatus = (tanggal: string) => {
    if (!tanggal) return "selesai";
    
    // Handle format dd-mm-yyyy
    const parts = tanggal.split("-");
    let jadwalDate: Date;
    
    if (parts.length === 3 && parts[0].length <= 2) {
      // Format: dd-mm-yyyy
      jadwalDate = new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
    } else {
      // Format lain (ISO, etc)
      jadwalDate = new Date(tanggal);
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    jadwalDate.setHours(0, 0, 0, 0);
    
    const diffTime = jadwalDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return "selesai";
    if (diffDays === 0) return "hari_ini";
    return "akan_datang";
  };

  // Format jam (handle berbagai format)
  const formatJam = (jam: string) => {
    if (!jam) return "-";
    // Jika sudah format HH.MM atau HH:MM
    if (jam.includes(".") || jam.includes(":")) {
      return jam.replace(":", ".");
    }
    return jam;
  };

  // Fetch tanda tangan penguji
  const fetchPengujiSignature = async (pengujiId: number): Promise<string | null> => {
    try {
      const response = await api.get(`/users/${pengujiId}`);
      return response.data.signature_image || null;
    } catch (error) {
      return null;
    }
  };

  // Load watermark logo
  const loadWatermarkLogo = async (): Promise<{
    dataUrl: string;
    aspectRatio: number;
  }> => {
    try {
      const response = await fetch("/images/logo/logo-isme-light.svg");
      if (!response.ok) {
        throw new Error("Watermark logo tidak ditemukan");
      }
      const svgText = await response.text();

      // Convert SVG to canvas then to data URL
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          // Hitung aspect ratio dari gambar asli
          const aspectRatio = img.width / img.height;

          // Tentukan ukuran maksimum untuk watermark (diperbesar untuk HD)
          const maxSize = 600; // Diperbesar dari 200 ke 600 untuk kualitas lebih tinggi
          let canvasWidth: number;
          let canvasHeight: number;

          // Pertahankan aspect ratio
          if (img.width > img.height) {
            canvasWidth = maxSize;
            canvasHeight = maxSize / aspectRatio;
          } else {
            canvasHeight = maxSize;
            canvasWidth = maxSize * aspectRatio;
          }

          const canvas = document.createElement("canvas");
          const ctx = canvas.getContext("2d");
          // Set canvas size dengan scale factor untuk HD
          const scaleFactor = 2; // 2x untuk retina/HD quality
          canvas.width = canvasWidth * scaleFactor;
          canvas.height = canvasHeight * scaleFactor;

          if (ctx) {
            // Scale context untuk HD rendering
            ctx.scale(scaleFactor, scaleFactor);
            // Set opacity untuk watermark
            ctx.globalAlpha = 0.1;
            ctx.drawImage(img, 0, 0, canvasWidth, canvasHeight);
            resolve({
              dataUrl: canvas.toDataURL("image/png"),
              aspectRatio: aspectRatio,
            });
          } else {
            resolve({ dataUrl: "", aspectRatio: 1 });
          }
        };
        img.onerror = () => resolve({ dataUrl: "", aspectRatio: 1 });
        img.src = "data:image/svg+xml;base64," + btoa(svgText);
      });
    } catch (error) {
      return { dataUrl: "", aspectRatio: 1 };
    }
  };

  // Generate PDF untuk satu mahasiswa (helper function)
  const generatePDFForMahasiswa = async (
    mahasiswa: { id: number; nim: string; name: string },
    hasil: any,
    penilaian: any,
    jadwal: JadwalDetail
  ): Promise<Uint8Array | null> => {
    try {
      // Fetch tanda tangan untuk setiap penguji
      const pengujiSignatures: Record<number, string | null> = {};
      if (penilaian?.nilai_per_penguji) {
        const signaturePromises = penilaian.nilai_per_penguji.map(async (np: any) => {
          const signature = await fetchPengujiSignature(np.penguji_id);
          return { pengujiId: np.penguji_id, signature };
        });
        const results = await Promise.all(signaturePromises);
        results.forEach(({ pengujiId, signature }: any) => {
          pengujiSignatures[pengujiId] = signature;
        });
      }

      // Fetch tanda tangan untuk pembimbing juga
      if (jadwal.pembimbing?.id) {
        const pembimbingSignature = await fetchPengujiSignature(jadwal.pembimbing.id);
        if (pembimbingSignature) {
          pengujiSignatures[jadwal.pembimbing.id] = pembimbingSignature;
        }
      }

      // Fetch tanda tangan untuk penguji_list
      if (jadwal.penguji_list) {
        const pengujiPromises = jadwal.penguji_list.map(async (p) => {
          const signature = await fetchPengujiSignature(p.id);
          return { pengujiId: p.id, signature };
        });
        const pengujiResults = await Promise.all(pengujiPromises);
        pengujiResults.forEach(({ pengujiId, signature }: any) => {
          if (signature) {
            pengujiSignatures[pengujiId] = signature;
          }
        });
      }

      // Load watermark logo
      const watermarkLogo = await loadWatermarkLogo();
      const watermarkLogoDataUrl = watermarkLogo.dataUrl;
      const watermarkAspectRatio = watermarkLogo.aspectRatio;

      const doc = new jsPDF();
      const margin = 20;
      let yPos = margin;
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;

      const bulanList = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

      // Helper function untuk menambahkan watermark di setiap halaman
      const addWatermarkToPage = () => {
        if (watermarkLogoDataUrl) {
          try {
            // Hitung ukuran watermark (diperbesar untuk HD)
            const maxWatermarkSize = 150; // Diperbesar dari 90 ke 150 untuk HD
            let watermarkWidth: number;
            let watermarkHeight: number;

            if (watermarkAspectRatio > 1) {
              watermarkWidth = maxWatermarkSize;
              watermarkHeight = maxWatermarkSize / watermarkAspectRatio;
            } else {
              watermarkHeight = maxWatermarkSize;
              watermarkWidth = maxWatermarkSize * watermarkAspectRatio;
            }

            // Posisi di tengah halaman
            const xPos = (pageWidth - watermarkWidth) / 2;
            const yPos = (pageHeight - watermarkHeight) / 2;

            // Tambahkan 1 watermark di tengah halaman
            doc.addImage(
              watermarkLogoDataUrl,
              "PNG",
              xPos,
              yPos,
              watermarkWidth,
              watermarkHeight,
              undefined,
              "SLOW" // Mode SLOW untuk kualitas lebih tinggi
            );
          } catch (error) {
            // Error adding watermark - silent fail
          }
        }
      };

      // Tambahkan watermark di halaman pertama
      addWatermarkToPage();

      const addText = (text: string, x: number, y: number, options?: { align?: "center" | "left" | "right" }) => {
        doc.text(text, x, y, options);
        return y;
      };

      const formatTanggal = (tanggal: string) => {
        if (!tanggal) return "Tanggal tidak tersedia";
        try {
          const date = new Date(tanggal.split("-").reverse().join("-"));
          const hariList = ["Minggu", "Senin", "Selasa", "Rabu", "Kamis", "Jumat", "Sabtu"];
          return `${hariList[date.getDay()]}, ${date.getDate()} ${bulanList[date.getMonth()]} ${date.getFullYear()}`;
        } catch {
          return tanggal;
        }
      };

      // Get all penguji names
      const allPenguji: { name: string; role: string }[] = [];
      if (jadwal.pembimbing) {
        allPenguji.push({ name: jadwal.pembimbing.name, role: "Pembimbing" });
      }
      jadwal.penguji_list?.forEach((p, idx) => {
        allPenguji.push({ name: p.name, role: `Penguji ${idx + 1}` });
      });

      // ========== HALAMAN 1: BERITA ACARA ==========
      doc.setFontSize(14);
      doc.setFont("times", "bold");
      yPos = addText("BERITA ACARA", pageWidth / 2, yPos + 10, { align: "center" });
      yPos += 15;

      doc.setFontSize(11);
      doc.setFont("times", "normal");

      const tanggalFormatted = formatTanggal(jadwal.tanggal);
      const paragraph1 = `Pada hari ini ${tanggalFormatted}, telah diselenggarakan Sidang Skripsi terhadap Peserta didik Program Studi Kedokteran Fakultas Kedokteran dan Kesehatan Universitas Muhammadiyah Jakarta, atas nama :`;
      const p1Lines = doc.splitTextToSize(paragraph1, pageWidth - margin * 2);
      p1Lines.forEach((line: string) => {
        yPos = addText(line, margin, yPos);
        yPos += 5;
      });
      yPos += 5;

      // Info Mahasiswa
      doc.text("Nama", margin, yPos);
      doc.text(`: ${mahasiswa.name}`, margin + 35, yPos);
      yPos += 6;
      doc.text("No. Pokok", margin, yPos);
      doc.text(`: ${mahasiswa.nim}`, margin + 35, yPos);
      yPos += 6;
      doc.text("Judul Skripsi", margin, yPos);
      const judulLines = doc.splitTextToSize(`: ${hasil.judul_skripsi}`, pageWidth - margin - 40);
      judulLines.forEach((line: string, idx: number) => {
        if (idx === 0) {
          doc.text(line, margin + 35, yPos);
        } else {
          yPos += 5;
          doc.text(line, margin + 37, yPos);
        }
      });
      yPos += 12;

      // Tim Penguji
      doc.text("Berdasarkan keputusan Pembimbing dan penguji yang terdiri dari :", margin, yPos);
      yPos += 6;
      doc.text("Pembimbing", margin, yPos);
      doc.text(`: ${jadwal.pembimbing?.name || "-"}`, margin + 35, yPos);
      yPos += 6;
      doc.text("Anggota", margin, yPos);
      jadwal.penguji_list?.forEach((p, idx) => {
        const prefix = idx === 0 ? ": " : "  ";
        doc.text(`${prefix}Penguji ${idx + 1} ${p.name}`, margin + 35, yPos);
        yPos += 5;
      });
      yPos += 10;

      // Keputusan
      doc.text("Peserta di atas dinyatakan : (pilih salah satu pernyataan di bawah ini)", margin, yPos);
      yPos += 6;

      const keputusanOptions = [
        { key: "tidak_lulus", label: "tidak lulus" },
        { key: "lulus_tanpa_perbaikan", label: "lulus tanpa perbaikan" },
        { key: "lulus_dengan_perbaikan", label: "lulus dengan perbaikan sebagai berikut :" },
      ];

      keputusanOptions.forEach((opt, idx) => {
        const isSelected = hasil.keputusan === opt.key;
        doc.setFont("times", isSelected ? "bold" : "normal");
        doc.text(`${idx + 1}.`, margin + 5, yPos);
        doc.text(opt.label, margin + 15, yPos);
        
        // Coret tengah jika tidak dipilih
        if (!isSelected) {
          const textWidth = doc.getTextWidth(opt.label);
          const lineY = yPos - 1.5; // Posisi garis di tengah teks
          doc.setLineWidth(0.3);
          doc.line(margin + 15, lineY, margin + 15 + textWidth, lineY);
        }
        yPos += 6;
      });
      doc.setFont("times", "normal");
      yPos += 5;

      // Catatan perbaikan dengan pagination yang baik
      if (hasil.catatan_perbaikan) {
        const catatanText = `...sesuai masukan dan saran dari penguji: ${hasil.catatan_perbaikan}`;
        const catatanLines = doc.splitTextToSize(catatanText, pageWidth - margin * 2);
        
        // Ruang minimum yang dibutuhkan untuk tanda tangan semua penguji dan moderator
        // Estimasi: jumlah penguji * 12 + tanggal (6) + moderator (10) + tanda tangan (15) + nama (10) + spacing (10) = sekitar 50-70
        // Dikurangi agar lebih fleksibel dan memanfaatkan ruang dengan lebih baik
        const estimatedPengujiCount = allPenguji.length;
        const minSpaceForSignatures = 40 + (estimatedPengujiCount * 10); // Dikurangi untuk fleksibilitas
        const lineHeight = 5;
        const bottomMargin = 5;
        const maxYPos = pageHeight - bottomMargin - minSpaceForSignatures;
        
        // Tampilkan catatan baris per baris dengan pagination
        catatanLines.forEach((line: string) => {
          // Cek dulu apakah baris ini masih muat di halaman saat ini
          if (yPos + lineHeight > maxYPos) {
            // Tidak muat, pindah ke halaman baru
            doc.addPage();
            addWatermarkToPage();
            yPos = margin;
          }
          
          doc.text(line, margin, yPos);
          yPos += lineHeight;
        });
      } else {
        doc.text("……………….…… ...sesuai masukan dan saran dari penguji ……………….………………", margin, yPos);
        yPos += 5;
        doc.text("…………………….……………………….…………………………………….………………", margin, yPos);
      }
      
      // Pastikan ada ruang yang cukup untuk tanda tangan sebelum menampilkannya
      // Dikurangi agar lebih fleksibel dan memanfaatkan ruang dengan lebih baik
      const spaceNeededForSignatures = 35 + (allPenguji.length * 10); // Dikurangi untuk fleksibilitas
      const availableSpace = pageHeight - yPos - 10; // margin bawah 10
      
      // Hanya pindah jika ruang yang tersedia kurang dari yang dibutuhkan
      if (availableSpace < spaceNeededForSignatures) {
        doc.addPage();
        addWatermarkToPage();
        yPos = margin;
      }
      
      yPos += 10;

      // Tanda tangan semua penguji
      allPenguji.forEach((p, idx) => {
        doc.text(`${idx + 1}. ${p.name}`, margin + 5, yPos);
        // Cari penguji_id dari jadwal untuk mendapatkan tanda tangan
        let pengujiId: number | null = null;
        if (p.role === "Pembimbing" && jadwal.pembimbing?.id) {
          pengujiId = jadwal.pembimbing.id;
        } else if (p.role.startsWith("Penguji")) {
          // Cari penguji berdasarkan nama
          const pengujiIdx = jadwal.penguji_list?.findIndex(peng => peng.name === p.name);
          if (pengujiIdx !== undefined && pengujiIdx >= 0 && jadwal.penguji_list) {
            pengujiId = jadwal.penguji_list[pengujiIdx].id;
          }
        }
        
        // Selalu tampilkan garis terlebih dahulu
        doc.text("____________________", pageWidth - margin - 50, yPos);
        
        // Tambahkan gambar tanda tangan di atas garis jika ada (sedikit lebih tinggi agar garis tetap terlihat)
        if (pengujiId && pengujiSignatures[pengujiId]) {
          try {
            const signatureImg = pengujiSignatures[pengujiId];
            if (signatureImg) {
              // Posisi tanda tangan sedikit lebih tinggi agar garis tetap terlihat di bawahnya
              doc.addImage(signatureImg, "PNG", pageWidth - margin - 50, yPos - 10, 40, 15);
            }
          } catch (error) {
            // Error adding signature image - silent fail
          }
        }
        yPos += 12;
      });
      yPos += 10;

      // Tanggal dan tanda tangan pembimbing (pakai tanggal jadwal)
      const jadwalDate = new Date(jadwal.tanggal.split("-").reverse().join("-"));
      doc.text(`Jakarta, ${jadwalDate.getDate()} ${bulanList[jadwalDate.getMonth()]} ${jadwalDate.getFullYear()}`, pageWidth - margin - 60, yPos);
      yPos += 6;
      doc.text("Pembimbing,", pageWidth - margin - 60, yPos);
      yPos += 10;
      
      // Tambahkan gambar tanda tangan moderator jika ada (tanpa garis jika ada tanda tangan)
      if (jadwal.pembimbing?.id && pengujiSignatures[jadwal.pembimbing.id]) {
        try {
          const signatureImg = pengujiSignatures[jadwal.pembimbing.id];
          if (signatureImg) {
            doc.addImage(signatureImg, "PNG", pageWidth - margin - 60, yPos, 40, 15);
          }
        } catch (error) {
          // Jika error, tampilkan garis sebagai fallback
          doc.text("____________________", pageWidth - margin - 60, yPos);
        }
      } else {
        // Tampilkan garis hanya jika tidak ada tanda tangan
        doc.text("____________________", pageWidth - margin - 60, yPos);
      }
      yPos += 20;
      doc.text(`${jadwal.pembimbing?.name || "____________________"}`, pageWidth - margin - 60, yPos);

      // ========== HALAMAN 2+: FORMULIR PENILAIAN (per dosen) ==========
      const aspekData = [
        {
          no: "1.",
          title: "Penyajian Lisan.",
          sub: ["Penggunaan Waktu", "Kejelasan Penyajian", "Efektifitas, Pemakaian AVA"],
          bobot: 2,
          key: "nilai_penyajian_lisan",
        },
        {
          no: "2.",
          title: "Sistematika Penulisan",
          sub: ["Sesuai Kaidah Ilmiah", "Ketepatan Penggunaan Bahasa", "Susunan Bahasa"],
          bobot: 1,
          key: "nilai_sistematika_penulisan",
        },
        {
          no: "3.",
          title: "Isi Tulisan",
          sub: ["Latar Belakang", "Tujuan", "Kerangka Teori", "Kerangka Konsep", "Definisi Operasional (DO)", "Desain Penelitian", "Metode Pengambilan Data", "Analisis Data", "Pembahasan", "Kesimpulan", "Saran"],
          bobot: 3,
          key: "nilai_isi_tulisan",
        },
        {
          no: "4.",
          title: "Originalitas",
          sub: ["Relevansi", "Keterkinian"],
          bobot: 1,
          key: "nilai_originalitas",
        },
        {
          no: "5.",
          title: "Tanya Jawab & atau unjuk kerja :",
          sub: ["Kejelasan mengemukakan isi skripsi", "Penguasaan materi", "Ketepatan menjawab pertanyaan"],
          bobot: 3,
          key: "nilai_tanya_jawab",
        },
      ];

      if (penilaian?.nilai_per_penguji) {
        penilaian.nilai_per_penguji.forEach((pengujiNilai: any) => {
          doc.addPage();
          addWatermarkToPage();
          yPos = margin;

          doc.setFontSize(14);
          doc.setFont("times", "bold");
          yPos = addText("FORMULIR PENILAIAN SIDANG SKRIPSI", pageWidth / 2, yPos + 5, { align: "center" });
          yPos += 10;

          doc.setFontSize(11);
          doc.setFont("times", "normal");
          doc.text("Nama", margin, yPos);
          doc.text(`: ${mahasiswa.name}`, margin + 35, yPos);
          yPos += 6;
          doc.text("No. Pokok", margin, yPos);
          doc.text(`: ${mahasiswa.nim}`, margin + 35, yPos);
          yPos += 6;
          doc.text("Judul Skripsi", margin, yPos);
          const judulLines2 = doc.splitTextToSize(`: ${hasil.judul_skripsi}`, pageWidth - margin - 40);
          judulLines2.forEach((line: string, idx: number) => {
            if (idx === 0) {
              doc.text(line, margin + 35, yPos);
            } else {
              yPos += 5;
              doc.text(line, margin + 37, yPos);
            }
          });
          yPos += 12;

          // Tabel penilaian
          const colWidths = [90, 25, 20, 30];
          const tableWidth = colWidths.reduce((a, b) => a + b, 0);
          const tableStartX = (pageWidth - tableWidth) / 2;

          // Header tabel
          doc.setFont("times", "bold");
          doc.rect(tableStartX, yPos, colWidths[0], 8);
          doc.rect(tableStartX + colWidths[0], yPos, colWidths[1], 8);
          doc.rect(tableStartX + colWidths[0] + colWidths[1], yPos, colWidths[2], 8);
          doc.rect(tableStartX + colWidths[0] + colWidths[1] + colWidths[2], yPos, colWidths[3], 8);
          doc.text("Aspek yang dinilai", tableStartX + 2, yPos + 5);
          doc.text("Nilai*", tableStartX + colWidths[0] + 5, yPos + 5);
          doc.text("Bobot", tableStartX + colWidths[0] + colWidths[1] + 3, yPos + 5);
          doc.text("Nilai x Bobot", tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + 2, yPos + 5);
          yPos += 8;

          let totalNilaiBobot = 0;
          let totalBobot = 0;

          doc.setFont("times", "normal");
          aspekData.forEach((aspek) => {
            const rowHeight = 6 + aspek.sub.length * 4;
            doc.rect(tableStartX, yPos, colWidths[0], rowHeight);
            doc.rect(tableStartX + colWidths[0], yPos, colWidths[1], rowHeight);
            doc.rect(tableStartX + colWidths[0] + colWidths[1], yPos, colWidths[2], rowHeight);
            doc.rect(tableStartX + colWidths[0] + colWidths[1] + colWidths[2], yPos, colWidths[3], rowHeight);

            doc.setFont("times", "bold");
            doc.text(`${aspek.no}`, tableStartX + 2, yPos + 5);
            doc.text(`${aspek.title}`, tableStartX + 8, yPos + 5);
            doc.setFont("times", "normal");

            let subY = yPos + 9;
            aspek.sub.forEach((s) => {
              doc.setFontSize(9);
              doc.text(`–   ${s}`, tableStartX + 8, subY);
              subY += 4;
            });
            doc.setFontSize(11);

            let rawNilai: string | number | null = null;
            if (aspek.key === "nilai_penyajian_lisan") rawNilai = pengujiNilai.nilai_penyajian_lisan;
            else if (aspek.key === "nilai_sistematika_penulisan") rawNilai = pengujiNilai.nilai_sistematika_penulisan;
            else if (aspek.key === "nilai_isi_tulisan") rawNilai = pengujiNilai.nilai_isi_tulisan;
            else if (aspek.key === "nilai_originalitas") rawNilai = pengujiNilai.nilai_originalitas;
            else if (aspek.key === "nilai_tanya_jawab") rawNilai = pengujiNilai.nilai_tanya_jawab;

            const nilaiPenguji = rawNilai != null ? parseFloat(String(rawNilai)) : null;

            if (nilaiPenguji != null && !isNaN(nilaiPenguji)) {
              doc.text(nilaiPenguji.toFixed(2), tableStartX + colWidths[0] + 8, yPos + rowHeight / 2 + 2);
            }

            doc.text(aspek.bobot.toString(), tableStartX + colWidths[0] + colWidths[1] + 10, yPos + rowHeight / 2 + 2);

            if (nilaiPenguji != null && !isNaN(nilaiPenguji)) {
              const nilaiXBobot = nilaiPenguji * aspek.bobot;
              doc.text(nilaiXBobot.toFixed(2), tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + 8, yPos + rowHeight / 2 + 2);
              totalNilaiBobot += nilaiXBobot;
            }
            totalBobot += aspek.bobot;

            yPos += rowHeight;
          });

          // Total row
          doc.setFont("times", "bold");
          doc.rect(tableStartX, yPos, colWidths[0] + colWidths[1], 8);
          doc.rect(tableStartX + colWidths[0] + colWidths[1], yPos, colWidths[2] + colWidths[3], 8);
          doc.text("TOTAL", tableStartX + 2, yPos + 5);
          doc.text(totalBobot.toString(), tableStartX + colWidths[0] + colWidths[1] + 10, yPos + 5);
          if (totalNilaiBobot > 0) {
            doc.text(totalNilaiBobot.toFixed(2), tableStartX + colWidths[0] + colWidths[1] + colWidths[2] + 8, yPos + 5);
          }
          yPos += 12;

          doc.setFont("times", "normal");
          doc.text("Catatan : Rentang  nilai 0-100", margin, yPos);
          yPos += 8;

          // Catatan/Saran dari penguji dengan pagination
          if (pengujiNilai?.catatan && pengujiNilai.catatan.trim() !== "") {
            // Tampilkan "Saran dan Komentar:" di halaman yang sama dengan tabel
            doc.setFont("times", "bold");
            doc.setFontSize(11);
            doc.text("Saran dan Komentar:", margin, yPos);
            yPos += 6;
            
            // Split catatan menjadi baris-baris
            doc.setFont("times", "normal");
            doc.setFontSize(10);
            const catatanLines = doc.splitTextToSize(pengujiNilai.catatan, pageWidth - margin * 2 - 10);
            
            // Ruang minimum yang dibutuhkan untuk tanda tangan (sekitar 25 points)
            // Dikurangi agar lebih fleksibel dan memanfaatkan ruang yang tersedia dengan lebih baik
            const minSpaceForSignature = 25;
            const lineHeight = 5;
            // Gunakan margin bawah yang lebih kecil untuk memanfaatkan ruang dengan lebih baik
            const bottomMargin = 5; // Margin yang sangat kecil untuk memaksimalkan penggunaan ruang
            const maxYPos = pageHeight - bottomMargin - minSpaceForSignature;
            
            // Tampilkan catatan baris per baris, pindah halaman jika tidak muat
            catatanLines.forEach((line: string) => {
              // Cek dulu apakah baris ini masih muat di halaman saat ini
              // Hanya pindah jika benar-benar tidak muat
              if (yPos + lineHeight > maxYPos) {
                // Tidak muat, pindah ke halaman baru
                doc.addPage();
                addWatermarkToPage();
                yPos = margin;
              }
              
              // Tulis baris di halaman saat ini
              doc.text(line, margin + 5, yPos);
              yPos += lineHeight;
            });
            // Kurangi spacing setelah komentar agar lebih fleksibel
            yPos += 3;
          }

          // Pastikan ada ruang yang cukup untuk tanda tangan sebelum menampilkannya
          // Hanya pindah ke halaman baru jika benar-benar tidak muat
          // Ruang yang dibutuhkan: peran (10) + tanda tangan (15) + nama (10) = sekitar 35
          // Tapi kita kurangi menjadi 30 agar lebih fleksibel dan tanda tangan tetap di halaman yang sama jika komentar pendek
          const spaceNeededForSignature = 30;
          
          // Cek apakah masih ada ruang yang cukup untuk tanda tangan
          // Gunakan perhitungan yang lebih fleksibel - hanya pindah jika benar-benar tidak muat
          // Margin bawah dikurangi untuk memberikan lebih banyak ruang
          const bottomMargin = 10; // Margin bawah yang lebih kecil untuk perhitungan
          const availableSpace = pageHeight - yPos - bottomMargin;
          
          // Hanya pindah jika ruang yang tersedia kurang dari yang dibutuhkan
          // Ini memastikan tanda tangan tetap di halaman yang sama jika masih ada ruang yang cukup
          if (availableSpace < spaceNeededForSignature) {
            // Tidak muat, buat halaman baru
            doc.addPage();
            addWatermarkToPage();
            yPos = margin;
          }

          // Nama peran penguji
          doc.setFontSize(11);
          const peran = pengujiNilai?.peran_penguji || "";
          const peranText = peran === "moderator"
            ? "Moderator/Ketua Penguji"
            : peran === "penguji_1"
            ? "Penguji 1"
            : peran === "penguji_2"
            ? "Penguji 2"
            : "Penguji";

          // Tanda tangan penguji
          doc.text(peranText, pageWidth / 2, yPos, { align: "center" });
          yPos += 10;
          
          // Tanda tangan penguji - hanya tampilkan jika ada, tanpa garis jika ada tanda tangan
          if (pengujiNilai?.penguji_id && pengujiSignatures[pengujiNilai.penguji_id]) {
            try {
              const signatureImg = pengujiSignatures[pengujiNilai.penguji_id];
              if (signatureImg) {
                doc.addImage(signatureImg, "PNG", pageWidth / 2 - 20, yPos, 40, 15);
              }
            } catch (error) {
              // Error adding penguji signature - silent fail
            }
          }
          yPos += 20;
          doc.text(`(${pengujiNilai?.penguji_name || "____________________"})`, pageWidth / 2, yPos, { align: "center" });
        });
      }

      // ========== HALAMAN 3: NILAI SIDANG SKRIPSI ==========
      doc.addPage();
      addWatermarkToPage();
      yPos = margin;

      doc.setFontSize(14);
      doc.setFont("times", "bold");
      yPos = addText("NILAI SIDANG SKRIPSI", pageWidth / 2, yPos + 5, { align: "center" });
      yPos += 15;

      doc.setFontSize(11);
      doc.setFont("times", "normal");
      doc.text("Nama", margin, yPos);
      doc.text(`: ${mahasiswa.name}`, margin + 35, yPos);
      yPos += 6;
      doc.text("No. Pokok", margin, yPos);
      doc.text(`: ${mahasiswa.nim}`, margin + 35, yPos);
      yPos += 6;
      doc.text("Judul Skripsi", margin, yPos);
      const judulLines3 = doc.splitTextToSize(`: ${hasil.judul_skripsi}`, pageWidth - margin - 40);
      judulLines3.forEach((line: string, idx: number) => {
        if (idx === 0) {
          doc.text(line, margin + 35, yPos);
        } else {
          yPos += 5;
          doc.text(line, margin + 37, yPos);
        }
      });
      yPos += 12;

      // Tabel nilai penguji
      const nilaiTableX = margin + 20;
      const nilaiColWidths = [100, 40];
      const nilaiTableWidth = nilaiColWidths.reduce((a, b) => a + b, 0);

      doc.setFont("times", "bold");
      doc.rect(nilaiTableX, yPos, nilaiColWidths[0], 8);
      doc.rect(nilaiTableX + nilaiColWidths[0], yPos, nilaiColWidths[1], 8);
      doc.text("Pembimbing /Penguji", nilaiTableX + 30, yPos + 5);
      doc.text("Nilai", nilaiTableX + nilaiColWidths[0] + 15, yPos + 5);
      yPos += 8;

      doc.setFont("times", "normal");
      allPenguji.forEach((p, idx) => {
        doc.rect(nilaiTableX, yPos, nilaiColWidths[0], 12);
        doc.rect(nilaiTableX + nilaiColWidths[0], yPos, nilaiColWidths[1], 12);
        doc.text(`${idx + 1}. ${p.name}`, nilaiTableX + 5, yPos + 8);

        // Get nilai from penilaian data
        const pengujiNilai = penilaian?.nilai_per_penguji?.find(
          (np: any) => np.penguji_name === p.name
        );
        if (pengujiNilai?.nilai_akhir != null && typeof pengujiNilai.nilai_akhir === "number") {
          doc.text(pengujiNilai.nilai_akhir.toFixed(2), nilaiTableX + nilaiColWidths[0] + 15, yPos + 8);
        } else if (pengujiNilai?.nilai_akhir != null) {
          doc.text(String(pengujiNilai.nilai_akhir), nilaiTableX + nilaiColWidths[0] + 15, yPos + 8);
        } else {
          doc.text("__________", nilaiTableX + nilaiColWidths[0] + 10, yPos + 8);
        }
        yPos += 12;
      });

      // Total row
      doc.rect(nilaiTableX, yPos, nilaiTableWidth, 8);
      doc.text("TOTAL", nilaiTableX + nilaiColWidths[0] / 2 - 10, yPos + 5);
      yPos += 25; // Tambah jarak sebelum rumus

      // Rumus nilai akhir - posisi lebih rapi
      const rumusX = margin + 30;
      doc.text("Nilai Akhir =", rumusX, yPos);
      doc.text("Total", rumusX + 50, yPos - 4);
      doc.line(rumusX + 42, yPos - 1, rumusX + 68, yPos - 1); // Garis pecahan
      doc.text("∑ Penguji", rumusX + 43, yPos + 6);
      doc.text("=", rumusX + 80, yPos);

      // Kotak nilai akhir - lebih besar dan rapi
      const kotakX = rumusX + 95;
      const kotakW = 35;
      const kotakH = 18;
      doc.rect(kotakX, yPos - 10, kotakW, kotakH);
      if (penilaian?.nilai_akhir != null) {
        const nilaiAkhir = typeof penilaian.nilai_akhir === "number" 
          ? penilaian.nilai_akhir 
          : parseFloat(String(penilaian.nilai_akhir));
        if (!isNaN(nilaiAkhir)) {
          doc.setFontSize(14);
          doc.setFont("times", "bold");
          doc.text(nilaiAkhir.toFixed(2), kotakX + kotakW / 2, yPos + 2, { align: "center" });
          doc.setFontSize(11);
          doc.setFont("times", "normal");
        }
      }
      yPos += 20;

      // Tanda tangan pembimbing
      doc.setFont("times", "normal");
      doc.text("Pembimbing,", pageWidth / 2, yPos, { align: "center" });
      yPos += 12; // Diperbesar dari 10 ke 12 untuk spacing yang lebih baik
      
      if (jadwal.pembimbing?.id && pengujiSignatures[jadwal.pembimbing.id]) {
        try {
          const signatureImg = pengujiSignatures[jadwal.pembimbing.id];
          if (signatureImg) {
            doc.addImage(signatureImg, "PNG", pageWidth / 2 - 20, yPos, 40, 15);
          }
        } catch (error) {
          // Error adding moderator signature - silent fail
        }
      } else {
        doc.text("____________________", pageWidth / 2, yPos, { align: "center" });
      }
      yPos += 20;
      doc.text(`${jadwal.pembimbing?.name || "____________________"}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 15;

      // Catatan
      doc.setFont("times", "bold");
      doc.text("Catatan :", margin, yPos);
      doc.setFont("times", "normal");
      doc.text("*  ditulis dengan angka", margin + 25, yPos);
      yPos += 5;
      doc.text("** ditulis dengan huruf", margin + 25, yPos);
      yPos += 12;

      // Tabel rentang nilai
      const rentangX = margin;
      const rentangColWidth = 35;
      const rentangData = [
        ["85,00 – 100", "A", "60,00 – 64,99", "C+"],
        ["80,00 – 84,99", "A–", "55,00 – 59,99", "C"],
        ["75,00 – 79,99", "B+", "50,00 – 54,99", "C–"],
        ["70,00 – 74,99", "B", "45,00 – 49,99", "D"],
        ["65,00 – 69,99", "B–", "0 – 44,99", "E"],
      ];

      // Header
      doc.rect(rentangX, yPos, rentangColWidth, 8);
      doc.rect(rentangX + rentangColWidth, yPos, 15, 8);
      doc.rect(rentangX + rentangColWidth + 15, yPos, rentangColWidth, 8);
      doc.rect(rentangX + rentangColWidth * 2 + 15, yPos, 15, 8);
      doc.setFontSize(9);
      doc.text("Rentang Nilai", rentangX + 5, yPos + 5);
      doc.text("Rentang Nilai", rentangX + rentangColWidth + 20, yPos + 5);
      yPos += 8;

      rentangData.forEach((row) => {
        doc.rect(rentangX, yPos, rentangColWidth, 7);
        doc.rect(rentangX + rentangColWidth, yPos, 15, 7);
        doc.rect(rentangX + rentangColWidth + 15, yPos, rentangColWidth, 7);
        doc.rect(rentangX + rentangColWidth * 2 + 15, yPos, 15, 7);
        doc.text(row[0], rentangX + 3, yPos + 5);
        doc.text(row[1], rentangX + rentangColWidth + 5, yPos + 5);
        doc.text(row[2], rentangX + rentangColWidth + 18, yPos + 5);
        doc.text(row[3], rentangX + rentangColWidth * 2 + 20, yPos + 5);
        yPos += 7;
      });

      // Footer halaman
      const totalPages = doc.internal.pages.length - 1;
      for (let i = 1; i <= totalPages; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont("times", "normal");
        doc.text(`Halaman ${i} dari ${totalPages}`, pageWidth / 2, pageHeight - 10, { align: "center" });
      }

      // Convert PDF to Uint8Array
      const pdfBlob = doc.output("arraybuffer");
      return new Uint8Array(pdfBlob);
    } catch (error) {
      return null;
    }
  };

  // Handle download all PDF as ZIP
  const handleDownloadAllPDF = async () => {
    if (!id || !jadwal || !jadwal.mahasiswa_list || jadwal.mahasiswa_list.length === 0) {
      alert("Tidak ada mahasiswa untuk diunduh");
      return;
    }

    setDownloadingZip(true);

    try {
      // Fetch data penilaian dan hasil untuk semua mahasiswa
      const [penilaianResponse, hasilResponse] = await Promise.all([
        api.get(`/penilaian-sidang-skripsi/jadwal/${id}`),
        api.get(`/hasil-sidang-skripsi/jadwal/${id}`),
      ]);

      const penilaianData = penilaianResponse.data.data || [];
      const hasilData = hasilResponse.data.data || [];

      // Create map for easy lookup
      const penilaianMap: Record<number, any> = {};
      penilaianData.forEach((p: any) => {
        penilaianMap[p.mahasiswa_id] = p;
      });

      const hasilMap: Record<number, any> = {};
      hasilData.forEach((h: any) => {
        hasilMap[h.mahasiswa_id] = h;
      });

      // Create ZIP
      const zip = new JSZip();

      // Generate PDF for each mahasiswa
      let successCount = 0;
      let failCount = 0;

      for (const mahasiswa of jadwal.mahasiswa_list) {
        const hasil = hasilMap[mahasiswa.id];
        const penilaian = penilaianMap[mahasiswa.id];

        // Skip if no hasil data
        if (!hasil) {
          failCount++;
          continue;
        }

        const pdfData = await generatePDFForMahasiswa(mahasiswa, hasil, penilaian, jadwal);
        
        if (pdfData) {
          // Sanitize nama mahasiswa untuk nama file (hapus karakter khusus)
          const sanitizedName = mahasiswa.name
            .replace(/[^a-zA-Z0-9\s]/g, "") // Hapus karakter khusus
            .replace(/\s+/g, "_") // Ganti spasi dengan underscore
            .substring(0, 50); // Batasi panjang nama
          const fileName = `Berita_Acara_Sidang_${sanitizedName}_${mahasiswa.nim}_${jadwal.tanggal.replace(/-/g, "")}.pdf`;
          zip.file(fileName, pdfData);
          successCount++;
        } else {
          failCount++;
        }
      }

      if (successCount === 0) {
        alert("Tidak ada PDF yang berhasil di-generate. Pastikan semua mahasiswa sudah memiliki keputusan.");
        setDownloadingZip(false);
        return;
      }

      // Generate ZIP file
      const zipBlob = await zip.generateAsync({ type: "blob" });
      
      // Download ZIP
      const url = window.URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Berita_Acara_Sidang_${jadwal.tanggal.replace(/-/g, "")}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      if (failCount > 0) {
        alert(`Berhasil mengunduh ${successCount} PDF. ${failCount} PDF gagal di-generate.`);
      } else {
        alert(`Berhasil mengunduh ${successCount} PDF dalam format ZIP.`);
      }
    } catch (error) {
      alert("Gagal mengunduh PDF. Silakan coba lagi.");
    } finally {
      setDownloadingZip(false);
    }
  };

  // Handle download PDF untuk satu mahasiswa
  const handleDownloadSinglePDF = async (mahasiswa: { id: number; nim: string; name: string }) => {
    if (!id || !jadwal) return;

    setDownloadingPDF({ ...downloadingPDF, [mahasiswa.id]: true });

    try {
      const hasil = hasilData[mahasiswa.id];
      const penilaian = penilaianData[mahasiswa.id];

      if (!hasil) {
        alert("Mahasiswa ini belum memiliki keputusan. Tidak dapat mengunduh PDF.");
        setDownloadingPDF({ ...downloadingPDF, [mahasiswa.id]: false });
        return;
      }

      const pdfData = await generatePDFForMahasiswa(mahasiswa, hasil, penilaian, jadwal);
      
      if (pdfData) {
        // Sanitize nama mahasiswa untuk nama file
        const sanitizedName = mahasiswa.name
          .replace(/[^a-zA-Z0-9\s]/g, "")
          .replace(/\s+/g, "_")
          .substring(0, 50);
        const fileName = `Berita_Acara_Sidang_${sanitizedName}_${mahasiswa.nim}_${jadwal.tanggal.replace(/-/g, "")}.pdf`;
        
        // Create blob and download
        const blob = new Blob([pdfData as BlobPart], { type: "application/pdf" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert("Gagal meng-generate PDF. Silakan coba lagi.");
      }
    } catch (error) {
      alert("Gagal mengunduh PDF. Silakan coba lagi.");
    } finally {
      setDownloadingPDF({ ...downloadingPDF, [mahasiswa.id]: false });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!jadwal) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">Jadwal tidak ditemukan</p>
          <button
            onClick={() => navigate("/bimbingan-akhir")}
            className="mt-4 px-4 py-2 bg-brand-500 text-white rounded-lg hover:bg-brand-600 transition"
          >
            Kembali
          </button>
        </div>
      </div>
    );
  }

  const status = getJadwalStatus(jadwal.tanggal);

  return (
    <>
      <PageMeta title="Detail Sidang Skripsi | ISME" description="Detail Jadwal Sidang Skripsi" />
      
      <div className="p-4 md:p-6 space-y-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <button
              onClick={() => navigate("/bimbingan-akhir")}
              className="w-10 h-10 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition"
            >
              <FontAwesomeIcon icon={faArrowLeft} />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Detail Sidang Skripsi
              </h1>
              <p className="text-gray-500 dark:text-gray-400 mt-1">
                Informasi lengkap jadwal sidang skripsi
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {/* Tombol Download All PDF */}
            <button
              onClick={handleDownloadAllPDF}
              disabled={downloadingZip || !jadwal.mahasiswa_list || jadwal.mahasiswa_list.length === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-brand-500 text-white font-semibold hover:bg-brand-600 transition shadow-lg shadow-brand-500/25 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FontAwesomeIcon icon={faDownload} className={downloadingZip ? "animate-pulse" : ""} />
              <span className="hidden sm:inline">
                {downloadingZip ? "Mengunduh..." : "Download Semua PDF"}
              </span>
            </button>
            
            {/* Konfirmasi Button - hanya tampil jika pembimbing dan belum konfirmasi */}
            {jadwal && jadwal.status_konfirmasi === 'belum_konfirmasi' && jadwal.dosen_role && (jadwal.dosen_role.includes('Pembimbing') || jadwal.dosen_role.includes('Moderator')) && (
              <button
                onClick={() => setShowKonfirmasiModal(true)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-500 text-white font-semibold hover:bg-blue-600 transition shadow-lg shadow-blue-500/25"
              >
                <FontAwesomeIcon icon={faCheckCircle} />
                <span className="hidden sm:inline">Konfirmasi Ketersediaan</span>
              </button>
            )}
            
            {/* Status Menunggu - untuk komentator/penguji HANYA jika pembimbing belum konfirmasi (belum_konfirmasi) */}
            {jadwal && jadwal.status_konfirmasi === 'belum_konfirmasi' && jadwal.dosen_role && !jadwal.dosen_role.includes('Pembimbing') && !jadwal.dosen_role.includes('Moderator') && (
              <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-yellow-100 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-200 border border-yellow-200 dark:border-yellow-700">
                <FontAwesomeIcon icon={faClock} />
                <span className="hidden sm:inline">Menunggu Konfirmasi Pembimbing</span>
              </div>
            )}
            
            {/* Penilaian Button - hanya tampil jika sudah konfirmasi 'bisa' */}
            {jadwal && jadwal.status_konfirmasi === 'bisa' && (
              <button
                onClick={() => navigate(`/bimbingan-akhir/sidang-skripsi/${id}/penilaian`)}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-orange-500 text-white font-semibold hover:bg-orange-600 transition shadow-lg shadow-orange-500/25"
              >
                <FontAwesomeIcon icon={faClipboardCheck} />
                <span className="hidden sm:inline">Mulai Penilaian</span>
              </button>
            )}
          </div>
        </motion.div>

        {/* Row 1: Info Jadwal & Tim Penguji */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Info Jadwal */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center">
                <FontAwesomeIcon icon={faFileAlt} className="text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Informasi Jadwal
              </h2>
            </div>

            <div className="space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <FontAwesomeIcon icon={faCalendarAlt} className="text-gray-500 dark:text-gray-400 text-sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Tanggal</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{jadwal.tanggal}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <FontAwesomeIcon icon={faClock} className="text-gray-500 dark:text-gray-400 text-sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Waktu</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {formatJam(jadwal.jam_mulai)} - {formatJam(jadwal.jam_selesai)}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    ({jadwal.jumlah_sesi || 1} x 50 menit)
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <FontAwesomeIcon icon={faMapMarkerAlt} className="text-gray-500 dark:text-gray-400 text-sm" />
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Ruangan</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    {jadwal.ruangan?.nama || "Belum ditentukan"}
                  </p>
                  {jadwal.ruangan?.gedung && (
                    <p className="text-xs text-gray-500 dark:text-gray-400">{jadwal.ruangan.gedung}</p>
                  )}
                </div>
              </div>

              {/* Status */}
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                  <span className={`w-3 h-3 rounded-full ${
                    status === "hari_ini" ? "bg-yellow-500 animate-pulse" :
                    status === "akan_datang" ? "bg-green-500" : "bg-gray-400"
                  }`}></span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Status</p>
                  <p className={`text-sm font-medium ${
                    status === "hari_ini" ? "text-yellow-600 dark:text-yellow-400" :
                    status === "akan_datang" ? "text-green-600 dark:text-green-400" : "text-gray-600 dark:text-gray-400"
                  }`}>
                    {status === "hari_ini" ? "Hari Ini" : status === "akan_datang" ? "Akan Datang" : "Selesai"}
                  </p>
                </div>
              </div>

              {jadwal.dosen_role && (
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Peran Anda</p>
                  <span className="inline-flex items-center px-3 py-1.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800 dark:bg-purple-900/50 dark:text-purple-300 border border-purple-200 dark:border-purple-700">
                    {jadwal.dosen_role}
                  </span>
                </div>
              )}
            </div>
          </motion.div>

          {/* Pembimbing & Komentator */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
          >
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center">
                <FontAwesomeIcon icon={faUserTie} className="text-white" />
              </div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Tim Penguji
              </h2>
            </div>

            <div className="space-y-4">
              {/* Pembimbing */}
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Pembimbing / Moderator</p>
                {jadwal.pembimbing ? (
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                    <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600 dark:text-blue-400">
                        {jadwal.pembimbing.name.charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {jadwal.pembimbing.name}
                      </p>
                      {jadwal.pembimbing.nid && (
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          NID: {jadwal.pembimbing.nid}
                        </p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Belum ditentukan</p>
                )}
              </div>

              {/* Penguji */}
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Penguji</p>
                {jadwal.penguji_list && jadwal.penguji_list.length > 0 ? (
                  <div className="space-y-2">
                    {jadwal.penguji_list.map((penguji, idx) => (
                      <div key={penguji.id || idx} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 dark:bg-gray-700/50">
                        <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                          <span className="text-sm font-medium text-green-600 dark:text-green-400">
                            {penguji.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900 dark:text-white">
                            {penguji.name}
                          </p>
                          {penguji.nid && (
                            <p className="text-xs text-gray-500 dark:text-gray-400">
                              NID: {penguji.nid}
                            </p>
                          )}
                        </div>
                        <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-200 dark:bg-gray-600 px-2 py-1 rounded">
                          Penguji {idx + 1}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400">Belum ditentukan</p>
                )}
              </div>
            </div>
          </motion.div>
        </div>

        {/* Row 2: Daftar Mahasiswa (Full Width) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6"
        >
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-green-500 flex items-center justify-center">
              <FontAwesomeIcon icon={faGraduationCap} className="text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Daftar Mahasiswa
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {jadwal.mahasiswa_list?.length || 0} mahasiswa
              </p>
              </div>
            </div>

          {jadwal.mahasiswa_list && jadwal.mahasiswa_list.length > 0 ? (
            <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-100 dark:divide-white/[0.05] text-sm">
                <thead className="border-b border-gray-100 dark:border-white/[0.05] bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">No</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">NIM</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-left text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Nama Mahasiswa</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 font-semibold text-gray-500 text-center text-xs uppercase tracking-wider dark:text-gray-400 whitespace-nowrap">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-white/[0.05]">
                  {jadwal.mahasiswa_list.map((mahasiswa, idx) => {
                    const hasil = hasilData[mahasiswa.id];
                    const hasUjian = !!hasil;
                    return (
                      <tr key={mahasiswa.id || idx} className={`${idx % 2 === 1 ? 'bg-gray-50 dark:bg-white/[0.02]' : ''} hover:bg-gray-100 dark:hover:bg-white/[0.05] transition-colors`}>
                        <td className="px-4 py-4 text-center text-sm text-gray-600 dark:text-gray-400">
                          {idx + 1}
                        </td>
                        <td className="px-6 py-4 text-sm font-mono text-gray-700 dark:text-gray-300">
                          {mahasiswa.nim}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {mahasiswa.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center">
                          {hasUjian ? (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                              Sudah Ujian
                            </span>
                          ) : (
                            <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400">
                              Belum Ujian
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {hasUjian ? (
                            <button
                              onClick={() => handleDownloadSinglePDF(mahasiswa)}
                              disabled={downloadingPDF[mahasiswa.id]}
                              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-500 text-white text-xs font-medium hover:bg-brand-600 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <FontAwesomeIcon icon={faDownload} className={downloadingPDF[mahasiswa.id] ? "animate-pulse" : ""} />
                              {downloadingPDF[mahasiswa.id] ? "Mengunduh..." : "Download PDF"}
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400 dark:text-gray-500">-</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mx-auto mb-3">
                <FontAwesomeIcon icon={faUsers} className="text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada mahasiswa</p>
            </div>
          )}
        </motion.div>
      </div>

      {/* Modal Konfirmasi */}
      {showKonfirmasiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 w-full max-w-md mx-4"
          >
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              Konfirmasi Ketersediaan
            </h3>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Status
              </label>
              <div className="flex gap-3">
                <button
                  onClick={() => setKonfirmasiStatus('bisa')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    konfirmasiStatus === 'bisa'
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Bisa
                </button>
                <button
                  onClick={() => setKonfirmasiStatus('tidak_bisa')}
                  className={`flex-1 py-2 px-4 rounded-lg font-medium transition-colors ${
                    konfirmasiStatus === 'tidak_bisa'
                      ? 'bg-red-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  Tidak Bisa
                </button>
              </div>
            </div>

            {konfirmasiStatus === 'tidak_bisa' && (
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Alasan (Opsional)
                </label>
                <textarea
                  value={konfirmasiAlasan}
                  onChange={(e) => setKonfirmasiAlasan(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                  rows={3}
                  placeholder="Masukkan alasan jika tidak bisa..."
                />
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowKonfirmasiModal(false);
                  setKonfirmasiStatus('bisa');
                  setKonfirmasiAlasan('');
                }}
                className="flex-1 py-2 px-4 rounded-lg bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={async () => {
                  try {
                    setSubmittingKonfirmasi(true);
                    const user = JSON.parse(localStorage.getItem('user') || '{}');
                    await api.put(`/jadwal-non-blok-non-csr/${id}/konfirmasi`, {
                      status: konfirmasiStatus,
                      alasan: konfirmasiAlasan,
                      dosen_id: user.id,
                    });
                    setShowKonfirmasiModal(false);
                    setKonfirmasiStatus('bisa');
                    setKonfirmasiAlasan('');
                    fetchJadwalDetail();
                  } catch (error) {
                    alert('Gagal menyimpan konfirmasi');
                  } finally {
                    setSubmittingKonfirmasi(false);
                  }
                }}
                disabled={submittingKonfirmasi}
                className="flex-1 py-2 px-4 rounded-lg bg-blue-500 text-white font-medium hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submittingKonfirmasi ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
};

export default DetailSidangSkripsi;
