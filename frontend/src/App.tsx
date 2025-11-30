import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router";
import { useEffect } from "react";
import AppLayout from "./layout/AppLayout";
import { ScrollToTop } from "./components/common/ScrollToTop";
import MataKuliah from "./pages/MataKuliah";
import CSR from "./pages/CSR";
import Dosen from "./pages/Dosen";
import Mahasiswa from "./pages/Mahasiswa";
import TimAkademik from "./pages/TimAkademik";
import TahunAjaran from "./pages/TahunAjaran";
import Ruangan from "./pages/Ruangan";
import Profile from "./pages/Profile";
import SignIn from "./pages/AuthPages/SignIn";
import RequireAuth from "./components/common/RequireAuth";
import RequireDosenRole from "./components/common/RequireDosenRole";
import RoleBasedRedirect from "./components/common/RoleBasedRedirect";
import UniversalDashboard from "./components/common/UniversalDashboard";
import RedirectIfAuth from "./components/common/RedirectIfAuth";
import { SessionProvider, useSession } from "./context/SessionContext";
import SessionExpiredModal from "./components/common/SessionExpiredModal";
import PetaAkademikPage from "./pages/PetaAkademikPage";
import BimbinganAkhir from "./pages/BimbinganAkhir";
import DetailSeminarProposal from "./pages/DetailSeminarProposal";
import DetailSidangSkripsi from "./pages/DetailSidangSkripsi";
import PenilaianSeminarProposal from "./pages/PenilaianSeminarProposal";
import PenilaianSidangSkripsi from "./pages/PenilaianSidangSkripsi";
import Kelas from "./pages/Kelas";
import KelompokBesar from "./pages/KelompokBesar";
import Kelompok from "./pages/Kelompok";
import KelompokKecil from "./pages/KelompokKecil";
import KelasDetail from "./pages/KelasDetail";
import MahasiswaVeteran from "./pages/MahasiswaVeteran";
import Histori from "./pages/Histori";
import ReportingDosen from "./pages/ReportingDosen";
import PBLDetail from "./pages/PBL-detail";
import PBLList from "./pages/PBL";
import PBLGenerate from "./pages/PBLGenerate";
import MataKuliahKeahlian from "./pages/MataKuliahKeahlian";
import CSRDetail from "./pages/CSRDetail";
import DetailBlok from "./pages/DetailBlok";
import DetailBlokAntara from "./pages/DetailBlokAntara";
import DetailNonBlokCSR from "./pages/DetailNonBlokCSR";
import DetailNonBlokNonCSR from "./pages/DetailNonBlokNonCSR";
import DetailNonBlokNonCSRAntara from "./pages/DetailNonBlokNonCSRAntara";
import PilihPetaBlok from "./pages/PilihPetaBlok";
import PetaBlok from "./pages/PetaBlok";
import PenilaianPBLPage from "./pages/PenilaianPBLPage";
import PenilaianPBLAntaraPage from "./pages/PenilaianPBLAntaraPage";
import PenilaianJurnalPage from "./pages/PenilaianJurnalPage";
import PenilaianJurnalAntaraPage from "./pages/PenilaianJurnalAntaraPage";
import DosenRiwayat from "./pages/DosenRiwayat";
import MataKuliahDosen from "./pages/MataKuliahDosen";
import MataKuliahDosenDetail from "./pages/MataKuliahDosenDetail";
import MataKuliahMahasiswa from "./pages/MataKuliahMahasiswa";
import DetailMahasiswaKeabsenan from "./pages/DetailMahasiswaKeabsenan";
import AbsensiCSRPage from "./pages/AbsensiCSRPage";
import AbsensiPersamaanPersepsiPage from "./pages/AbsensiPersamaanPersepsiPage";
import AdminNotifications from "./pages/AdminNotifications";
import DashboardTimAkademik from "./pages/DashboardTimAkademik";
import ForumDiskusi from "./pages/ForumDiskusi";
import ForumDetail from "./pages/ForumDetail";
import ForumCategory from "./pages/ForumCategory";
import Bookmarks from "./pages/Bookmarks";
import SupportCenter from "./pages/SupportCenter";

import AbSenQRMahasiswa from "./pages/AbSenQRMahasiswa";
import DetailAbSenMahasiswa from "./pages/DetailAbSenMahasiswa";
import DetailAbSenMahasiswaNonBlokNonCSR from "./pages/DetailAbSenMahasiswaNonBlokNonCSR";
import DetailAbSenMahasiswaNonBlokNonCSRAntara from "./pages/DetailAbSenMahasiswaNonBlokNonCSRAntara";
import DetailAbSenMahasiswaPraktikum from "./pages/DetailAbSenMahasiswaPraktikum";
import DetailAbSenMahasiswaKuliahBesarAntara from "./pages/DetailAbSenMahasiswaKuliahBesarAntara";
import KuliahBesarDetail from "./pages/KuliahBesarDetail";
import DosenAbsensiKuliahBesar from "./pages/DosenAbsensiKuliahBesar";
import DosenAbsensiKuliahBesarAntara from "./pages/DosenAbsensiKuliahBesarAntara";
import DosenAbsensiNonBlokNonCSR from "./pages/DosenAbsensiNonBlokNonCSR";
import DosenAbsensiNonBlokNonCSRAntara from "./pages/DosenAbsensiNonBlokNonCSRAntara";
import DosenAbsensiPraktikum from "./pages/DosenAbsensiPraktikum";
import DosenAbsensiSeminarPleno from "./pages/DosenAbsensiSeminarPleno";
import DetailAbSenMahasiswaSeminarPleno from "./pages/DetailAbSenMahasiswaSeminarPleno";

import WhatsAppTest from "./pages/WhatsAppTest";


function AppContent() {
  const { isSessionExpired, setSessionExpired } = useSession();

  useEffect(() => {
    const handleSessionExpired = () => {
      setSessionExpired(true);
    };

    window.addEventListener("sessionExpired", handleSessionExpired);
    return () => {
      window.removeEventListener("sessionExpired", handleSessionExpired);
    };
  }, [setSessionExpired]);

  return (
    <>
      <Router>
        <ScrollToTop />
        <Routes>
          {/* Protected Routes */}
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              {/* Default route - redirect based on role */}
              <Route index path="/" element={<RoleBasedRedirect />} />

              {/* Universal Dashboard Route */}
              <Route path="/dashboard" element={<UniversalDashboard />} />

              {/* Super Admin Routes - Blocked direct access */}
              <Route
                path="/dashboard-super-admin"
                element={<Navigate to="/dashboard" replace />}
              />

              {/* Tim Akademik Routes */}
              <Route
                path="/dashboard-tim-akademik"
                element={
                  <RequireDosenRole allowedRoles={["tim_akademik"]}>
                    <DashboardTimAkademik />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/tahun-ajaran"
                element={
                  <RequireDosenRole allowedRoles={["super_admin"]}>
                    <TahunAjaran />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mata-kuliah"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <MataKuliah />
                  </RequireDosenRole>
                }
              />

              {/* Dosen Routes */}
              <Route
                path="/mata-kuliah-dosen"
                element={
                  <RequireDosenRole allowedRoles={["dosen"]}>
                    <MataKuliahDosen />
                  </RequireDosenRole>
                }
              />

              {/* Dosen Detail Routes */}
              <Route
                path="/mata-kuliah-dosen/:kode"
                element={
                  <RequireDosenRole allowedRoles={["dosen"]}>
                    <MataKuliahDosenDetail />
                  </RequireDosenRole>
                }
              />

              <Route
                path="/mata-kuliah-mahasiswa"
                element={
                  <RequireDosenRole allowedRoles={["mahasiswa"]}>
                    <MataKuliahMahasiswa />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/detail-mahasiswa-keabsenan"
                element={
                  <RequireDosenRole allowedRoles={["mahasiswa"]}>
                    <DetailMahasiswaKeabsenan />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mahasiswa/absensi-kuliah-besar"
                element={
                  <RequireDosenRole allowedRoles={["mahasiswa"]}>
                    <AbSenQRMahasiswa />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mahasiswa/absensi-kuliah-besar/:kode/:jadwalId"
                element={
                  <RequireDosenRole allowedRoles={["mahasiswa"]}>
                    <DetailAbSenMahasiswa />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mahasiswa/absensi-non-blok-non-csr/:kode/:jadwalId"
                element={
                  <RequireDosenRole allowedRoles={["mahasiswa"]}>
                    <DetailAbSenMahasiswaNonBlokNonCSR />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mahasiswa/absensi-praktikum/:kode/:jadwalId"
                element={
                  <RequireDosenRole allowedRoles={["mahasiswa"]}>
                    <DetailAbSenMahasiswaPraktikum />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mahasiswa/absensi-seminar-pleno/:kode/:jadwalId"
                element={
                  <RequireDosenRole allowedRoles={["mahasiswa"]}>
                    <DetailAbSenMahasiswaSeminarPleno />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mahasiswa/absensi-kuliah-besar-antara/:kode/:jadwalId"
                element={
                  <RequireDosenRole allowedRoles={["mahasiswa"]}>
                    <DetailAbSenMahasiswaKuliahBesarAntara />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/absensi-csr/:kode/:jadwalId"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <AbsensiCSRPage />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/absensi-persamaan-persepsi/:kode/:jadwalId"
                element={
                  <RequireDosenRole
                    allowedRoles={["dosen", "super_admin", "tim_akademik"]}
                  >
                    <AbsensiPersamaanPersepsiPage />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/absensi-persamaan-persepsi-antara/:kode/:jadwalId"
                element={
                  <RequireDosenRole
                    allowedRoles={["dosen", "super_admin", "tim_akademik"]}
                  >
                    <AbsensiPersamaanPersepsiPage />
                  </RequireDosenRole>
                }
              />

              {/* Dosen Routes - Blocked direct access */}
              <Route
                path="/dashboard-dosen"
                element={<Navigate to="/dashboard" replace />}
              />
              <Route
                path="/dosen-riwayat"
                element={
                  <RequireDosenRole allowedRoles={["dosen"]}>
                    <DosenRiwayat />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/kuliah-besar/:kode/:jadwalId"
                element={
                  <RequireDosenRole allowedRoles={["dosen", "super_admin", "tim_akademik"]}>
                    <KuliahBesarDetail />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/absensi-kuliah-besar/:kode/:jadwalId"
                element={
                  <RequireDosenRole allowedRoles={["dosen", "super_admin", "tim_akademik"]}>
                    <DosenAbsensiKuliahBesar />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/absensi-kuliah-besar-antara/:kode/:jadwalId"
                element={
                  <RequireDosenRole allowedRoles={["dosen", "super_admin", "tim_akademik"]}>
                    <DosenAbsensiKuliahBesarAntara />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/absensi-non-blok-non-csr/:kode/:jadwalId"
                element={
                  <RequireDosenRole allowedRoles={["dosen", "super_admin", "tim_akademik"]}>
                    <DosenAbsensiNonBlokNonCSR />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/absensi-non-blok-non-csr-antara/:kode/:jadwalId"
                element={
                  <RequireDosenRole allowedRoles={["dosen", "super_admin", "tim_akademik"]}>
                    <DosenAbsensiNonBlokNonCSRAntara />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/absensi-praktikum/:kode/:jadwalId"
                element={
                  <RequireDosenRole allowedRoles={["dosen", "super_admin", "tim_akademik"]}>
                    <DosenAbsensiPraktikum />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/absensi-seminar-pleno/:kode/:jadwalId"
                element={
                  <RequireDosenRole allowedRoles={["dosen", "super_admin", "tim_akademik"]}>
                    <DosenAbsensiSeminarPleno />
                  </RequireDosenRole>
                }
              />
              {/* Super Admin & Tim Akademik Routes */}
              <Route
                path="/pbl"
                element={
                  <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                    <PBLList />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/pbl/blok/:blokId"
                element={
                  <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                    <PBLDetail />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/pbl/generate/:blokId"
                element={
                  <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                    <PBLGenerate />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/pbl/keahlian"
                element={
                  <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                    <MataKuliahKeahlian />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/csr"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <CSR />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/csr/:csrId"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <CSRDetail />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/dosen"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <Dosen />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/dosen/:id/riwayat"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <DosenRiwayat />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mahasiswa"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <Mahasiswa />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/tim-akademik"
                element={
                  <RequireDosenRole allowedRoles={["super_admin"]}>
                    <TimAkademik />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/tahun-ajaran"
                element={
                  <RequireDosenRole allowedRoles={["super_admin"]}>
                    <TahunAjaran />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/ruangan"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <Ruangan />
                  </RequireDosenRole>
                }
              />
              <Route path="/profile" element={<Profile />} />
              <Route path="/bookmarks" element={<Bookmarks />} />
              <Route path="/support-center" element={<SupportCenter />} />
              <Route
                path="/whatsapp-test"
                element={
                  <RequireDosenRole allowedRoles={["super_admin"]}>
                    <WhatsAppTest />
                  </RequireDosenRole>
                }
              />

              {/* Peta Routes - Available for super_admin, dosen, tim_akademik, and mahasiswa */}
              <Route path="/peta-akademik" element={
                <RequireDosenRole allowedRoles={["super_admin", "dosen", "tim_akademik"]}>
                  <PetaAkademikPage />
                </RequireDosenRole>
              } />
              <Route path="/peta-blok" element={
                <RequireDosenRole allowedRoles={["super_admin", "dosen", "tim_akademik"]}>
                  <PilihPetaBlok />
                </RequireDosenRole>
              } />
              <Route path="/peta-blok/:semester" element={
                <RequireDosenRole allowedRoles={["super_admin", "dosen", "tim_akademik"]}>
                  <PetaBlok />
                </RequireDosenRole>
              } />
              <Route path="/peta-blok/:semester/:blok" element={
                <RequireDosenRole allowedRoles={["super_admin", "dosen", "tim_akademik"]}>
                  <PetaBlok />
                </RequireDosenRole>
              } />
              
              {/* Bimbingan Akhir - Dosen Only */}
              <Route path="/bimbingan-akhir" element={
                <RequireDosenRole allowedRoles={["dosen"]}>
                  <BimbinganAkhir />
                </RequireDosenRole>
              } />
              <Route path="/bimbingan-akhir/seminar-proposal/:id" element={
                <RequireDosenRole allowedRoles={["dosen", "super_admin", "tim_akademik"]}>
                  <DetailSeminarProposal />
                </RequireDosenRole>
              } />
              <Route path="/bimbingan-akhir/seminar-proposal/:id/penilaian" element={
                <RequireDosenRole allowedRoles={["dosen", "super_admin", "tim_akademik"]}>
                  <PenilaianSeminarProposal />
                </RequireDosenRole>
              } />
              <Route path="/bimbingan-akhir/sidang-skripsi/:id" element={
                <RequireDosenRole allowedRoles={["dosen", "super_admin", "tim_akademik"]}>
                  <DetailSidangSkripsi />
                </RequireDosenRole>
              } />
              <Route path="/bimbingan-akhir/sidang-skripsi/:id/penilaian" element={
                <RequireDosenRole allowedRoles={["dosen", "super_admin", "tim_akademik"]}>
                  <PenilaianSidangSkripsi />
                </RequireDosenRole>
              } />


              {/* Super Admin Only Routes */}
              <Route
                path="/generate/kelompok-besar/:semester"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik", "dosen"]}
                  >
                    <KelompokBesar />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/generate/kelompok"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <Kelompok />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/generate/kelas"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <Kelas />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/generate/mahasiswa-veteran"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <MahasiswaVeteran />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/reporting/dosen"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <ReportingDosen />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/reporting/histori"
                element={
                  <RequireDosenRole allowedRoles={["super_admin"]}>
                    <Histori />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/admin-notifications"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <AdminNotifications />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/generate/kelompok/:semester"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <KelompokKecil />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/generate/kelas/:semester"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <KelasDetail />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mata-kuliah/blok/:kode"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <DetailBlok />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mata-kuliah/blok-antara/:kode"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <DetailBlokAntara />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mata-kuliah/non-blok-csr/:kode"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <DetailNonBlokCSR />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mata-kuliah/non-blok-non-csr/:kode"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <DetailNonBlokNonCSR />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mata-kuliah/non-blok-non-csr-antara/:kode"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik"]}
                  >
                    <DetailNonBlokNonCSRAntara />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/penilaian-pbl/:kode_blok/:kelompok/:pertemuan"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik", "dosen"]}
                  >
                    <PenilaianPBLPage />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/penilaian-pbl-antara/:kode_blok/:kelompok/:pertemuan"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik", "dosen"]}
                  >
                    <PenilaianPBLAntaraPage />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/penilaian-jurnal/:kode_blok/:kelompok/:jurnal_id"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik", "dosen"]}
                  >
                    <PenilaianJurnalPage />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/penilaian-jurnal-antara/:kode_blok/:kelompok/:jurnal_id"
                element={
                  <RequireDosenRole
                    allowedRoles={["super_admin", "tim_akademik", "dosen"]}
                  >
                    <PenilaianJurnalAntaraPage />
                  </RequireDosenRole>
                }
              />

              {/* Forum Diskusi - Available for all users */}
              <Route
                path="/forum-diskusi"
                element={
                  <RequireDosenRole
                    allowedRoles={[
                      "super_admin",
                      "dosen",
                      "mahasiswa",
                      "tim_akademik",
                    ]}
                  >
                    <ForumDiskusi />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/forum/category/:categorySlug"
                element={
                  <RequireDosenRole
                    allowedRoles={[
                      "super_admin",
                      "dosen",
                      "mahasiswa",
                      "tim_akademik",
                    ]}
                  >
                    <ForumCategory />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/forum/:slug"
                element={
                  <RequireDosenRole
                    allowedRoles={[
                      "super_admin",
                      "dosen",
                      "mahasiswa",
                      "tim_akademik",
                    ]}
                  >
                    <ForumDetail />
                  </RequireDosenRole>
                }
              />

              {/* Admin Notifications - Available for all roles */}
              <Route
                path="/admin-notifications"
                element={<AdminNotifications />}
              />

              {/* Catch-all route for invalid URLs */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Route>
          </Route>

          {/* Public Route: Login only, with redirect if already logged in */}
          <Route
            path="/login"
            element={
              <RedirectIfAuth>
                <SignIn />
              </RedirectIfAuth>
            }
          />
        </Routes>
        <SessionExpiredModal isOpen={isSessionExpired} />
      </Router>
    </>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <AppContent />
    </SessionProvider>
  );
}
