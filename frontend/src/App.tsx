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
import Kelas from "./pages/Kelas";
import KelompokBesar from "./pages/KelompokBesar";
import Kelompok from "./pages/Kelompok";
import KelompokKecil from "./pages/KelompokKecil";
import KelasDetail from "./pages/KelasDetail";
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
import AdminNotifications from "./pages/AdminNotifications";
import DashboardTimAkademik from "./pages/DashboardTimAkademik";
import MaintenanceGuard from "./components/common/MaintenanceGuard";
import ForumDiskusi from "./pages/ForumDiskusi";
import ForumDetail from "./pages/ForumDetail";
import ForumCategory from "./pages/ForumCategory";
import Bookmarks from "./pages/Bookmarks";
import SupportCenter from "./pages/SupportCenter";

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
              <Route path="/dashboard-super-admin" element={<Navigate to="/dashboard" replace />} />
              
              {/* Tim Akademik Routes */}
              <Route path="/dashboard-tim-akademik" element={
                <RequireDosenRole allowedRoles={["tim_akademik"]}>
                  <DashboardTimAkademik />
                </RequireDosenRole>
              } />
              <Route path="/tahun-ajaran" element={
                <RequireDosenRole allowedRoles={["super_admin"]}>
                  <TahunAjaran />
                </RequireDosenRole>
              } />
              <Route path="/mata-kuliah" element={
                <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                  <MataKuliah />
                </RequireDosenRole>
              } />
              
              {/* Dosen Routes */}
              <Route path="/mata-kuliah-dosen" element={
                <RequireDosenRole allowedRoles={["dosen"]}>
                  <MataKuliahDosen />
                </RequireDosenRole>
              } />
              
              {/* Dosen Routes - Blocked direct access */}
              <Route path="/dashboard-dosen" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dosen-riwayat" element={
                <RequireDosenRole allowedRoles={["dosen"]}>
                  <DosenRiwayat />
                </RequireDosenRole>
              } />
              {/* Super Admin Only Routes */}
              <Route path="/pbl" element={
                <RequireDosenRole allowedRoles={["super_admin"]}>
               <MaintenanceGuard
                      maintenanceConfig={{
                        title: "Sistem PBL Sedang Dalam Perbaikan",
                        message:
                          "Fitur PBL sedang dalam proses perbaikan untuk memberikan pengalaman yang lebih baik. Mohon maaf atas ketidaknyamanan ini.",
                      }}
                    >
                      <PBLList />
                    </MaintenanceGuard>
                </RequireDosenRole>
              } />
             <Route
                path="/pbl/blok/:blokId"
                element={
                  <RequireDosenRole allowedRoles={["super_admin"]}>
                    <MaintenanceGuard
                      maintenanceConfig={{
                        title: "Sistem PBL Sedang Dalam Perbaikan",
                        message:
                          "Fitur PBL sedang dalam proses perbaikan untuk memberikan pengalaman yang lebih baik. Mohon maaf atas ketidaknyamanan ini.",
                      }}
                    >
                      <PBLDetail />
                    </MaintenanceGuard>
                  </RequireDosenRole>
                }
              />
              <Route
                path="/pbl/generate/:blokId"
                element={
                  <RequireDosenRole allowedRoles={["super_admin"]}>
                    <MaintenanceGuard
                      maintenanceConfig={{
                        title: "Sistem PBL Sedang Dalam Perbaikan",
                        message:
                          "Fitur PBL sedang dalam proses perbaikan untuk memberikan pengalaman yang lebih baik. Mohon maaf atas ketidaknyamanan ini.",
                      }}
                    >
                      <PBLGenerate />
                    </MaintenanceGuard>
                  </RequireDosenRole>
                }
              />
              <Route
                path="/pbl/keahlian"
                element={
                  <RequireDosenRole allowedRoles={["super_admin"]}>
                    <MaintenanceGuard
                      maintenanceConfig={{
                        title: "Sistem PBL Sedang Dalam Perbaikan",
                        message:
                          "Fitur PBL sedang dalam proses perbaikan untuk memberikan pengalaman yang lebih baik. Mohon maaf atas ketidaknyamanan ini.",
                      }}
                    >
                      <MataKuliahKeahlian />
                    </MaintenanceGuard>
                  </RequireDosenRole>
                }
              />
              <Route path="/csr" element={
                <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                  <MaintenanceGuard
                    maintenanceConfig={{
                      title: "Sistem CSR Sedang Dalam Perbaikan",
                      message:
                        "Fitur CSR sedang dalam proses perbaikan untuk memberikan pengalaman yang lebih baik. Mohon maaf atas ketidaknyamanan ini.",
                    }}
                  >
                    <CSR />
                  </MaintenanceGuard>
                </RequireDosenRole>
              } />
              <Route path="/csr/:csrId" element={
                <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                  <MaintenanceGuard
                    maintenanceConfig={{
                      title: "Sistem CSR Sedang Dalam Perbaikan",
                      message:
                        "Fitur CSR sedang dalam proses perbaikan untuk memberikan pengalaman yang lebih baik. Mohon maaf atas ketidaknyamanan ini.",
                    }}
                  >
                    <CSRDetail />
                  </MaintenanceGuard>
                </RequireDosenRole>
              } />
              <Route path="/dosen" element={
                <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                  <Dosen />
                </RequireDosenRole>
              } />
              <Route path="/dosen/:id/riwayat" element={
                <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                  <DosenRiwayat />
                </RequireDosenRole>
              } />
              <Route path="/mahasiswa" element={
                <RequireDosenRole allowedRoles={["super_admin", "tim_akademik", "dosen"]}>
                  <Mahasiswa />
                </RequireDosenRole>
              } />
              <Route path="/tim-akademik" element={
                <RequireDosenRole allowedRoles={["super_admin"]}>
                  <TimAkademik />
                </RequireDosenRole>
              } />
              <Route path="/tahun-ajaran" element={
                <RequireDosenRole allowedRoles={["super_admin"]}>
                  <TahunAjaran />
                </RequireDosenRole>
              } />
              <Route path="/ruangan" element={
                <RequireDosenRole allowedRoles={["super_admin", "tim_akademik", "dosen"]}>
                  <Ruangan />
                </RequireDosenRole>
              } />
              <Route path="/profile" element={<Profile />} />
              <Route path="/bookmarks" element={<Bookmarks />} />
              <Route path="/support-center" element={<SupportCenter />} />
              
              {/* Peta Routes - Available for both super_admin and dosen */}
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
              <Route path="/peta-blok/:semester/:blok" element={
                <RequireDosenRole allowedRoles={["super_admin", "dosen", "tim_akademik"]}>
                  <PetaBlok />
                </RequireDosenRole>
              } />
              
              {/* Super Admin Only Routes */}
              <Route
                path="/generate/kelompok-besar/:semester"
                element={
                  <RequireDosenRole allowedRoles={["super_admin", "tim_akademik", "dosen"]}>
                    <KelompokBesar />
                  </RequireDosenRole>
                }
              />
              <Route path="/generate/kelompok" element={
                <RequireDosenRole allowedRoles={["super_admin", "tim_akademik", "dosen"]}>
                  <Kelompok />
                </RequireDosenRole>
              } />
              <Route path="/generate/kelas" element={
                <RequireDosenRole allowedRoles={["super_admin", "tim_akademik", "dosen"]}>
                  <Kelas />
                </RequireDosenRole>
              } />
              <Route path="/reporting/dosen" element={
                <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                  <ReportingDosen />
                </RequireDosenRole>
              } />
              <Route path="/reporting/histori" element={
                <RequireDosenRole allowedRoles={["super_admin"]}>
                  <Histori />
                </RequireDosenRole>
              } />
              <Route path="/admin-notifications" element={
                <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                  <AdminNotifications />
                </RequireDosenRole>
              } />
              <Route
                path="/generate/kelompok/:semester"
                element={
                  <RequireDosenRole allowedRoles={["super_admin", "tim_akademik", "dosen"]}>
                    <KelompokKecil />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/generate/kelas/:semester"
                element={
                  <RequireDosenRole allowedRoles={["super_admin", "tim_akademik", "dosen"]}>
                    <KelasDetail />
                  </RequireDosenRole>
                }
              />
              <Route path="/mata-kuliah/blok/:kode" element={
                <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                  <DetailBlok />
                </RequireDosenRole>
              } />
              <Route path="/mata-kuliah/blok-antara/:kode" element={
                <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                  <DetailBlokAntara />
                </RequireDosenRole>
              } />
              <Route
                path="/mata-kuliah/non-blok-csr/:kode"
                element={
                  <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                    <MaintenanceGuard
                      maintenanceConfig={{
                        title: "Sistem CSR Sedang Dalam Perbaikan",
                        message:
                          "Fitur CSR sedang dalam proses perbaikan untuk memberikan pengalaman yang lebih baik. Mohon maaf atas ketidaknyamanan ini.",
                      }}
                    >
                      <DetailNonBlokCSR />
                    </MaintenanceGuard>
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mata-kuliah/non-blok-non-csr/:kode"
                element={
                  <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                    <DetailNonBlokNonCSR />
                  </RequireDosenRole>
                }
              />
              <Route
                path="/mata-kuliah/non-blok-non-csr-antara/:kode"
                element={
                  <RequireDosenRole allowedRoles={["super_admin", "tim_akademik"]}>
                    <DetailNonBlokNonCSRAntara />
                  </RequireDosenRole>
                }
              />
                             <Route
                 path="/penilaian-pbl/:kode_blok/:kelompok/:pertemuan"
                 element={
                   <RequireDosenRole allowedRoles={["super_admin", "tim_akademik", "dosen"]}>
                     <PenilaianPBLPage />
                   </RequireDosenRole>
                 }
               />
               <Route
                 path="/penilaian-pbl-antara/:kode_blok/:kelompok/:pertemuan"
                 element={
                   <RequireDosenRole allowedRoles={["super_admin", "tim_akademik", "dosen"]}>
                     <PenilaianPBLAntaraPage />
                   </RequireDosenRole>
                 }
               />
              <Route
                path="/penilaian-jurnal/:kode_blok/:kelompok/:jurnal_id"
                element={
                  <RequireDosenRole allowedRoles={["super_admin", "tim_akademik", "dosen"]}>
                    <PenilaianJurnalPage />
                  </RequireDosenRole>
                }
              />              
              <Route
                path="/penilaian-jurnal-antara/:kode_blok/:kelompok/:jurnal_id"
                element={
                  <RequireDosenRole allowedRoles={["super_admin", "tim_akademik", "dosen"]}>
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
