<?php

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\UserController;
use App\Http\Controllers\RuanganController;
use App\Http\Controllers\MataKuliahController;
use App\Http\Controllers\ReportingController;
use App\Http\Controllers\TahunAjaranController;
use App\Http\Controllers\MataKuliahCSRController;
use App\Http\Controllers\MataKuliahPBLController;
use App\Http\Controllers\MataKuliahJurnalReadingController;
use App\Http\Controllers\CSRController;
use App\Http\Controllers\KelompokBesarController;
use App\Http\Controllers\KelompokKecilController;
use App\Http\Controllers\KelasController;
use App\Http\Controllers\MataKuliahPBLKelompokKecilController;
use App\Http\Controllers\JadwalKuliahBesarController;
use App\Http\Controllers\JadwalCSRController;
use App\Http\Controllers\JadwalNonBlokNonCSRController;
use App\Http\Controllers\KelompokBesarAntaraController;
use App\Http\Controllers\KelompokKecilAntaraController;
use App\Http\Controllers\DashboardTimAkademikController;
use App\Http\Controllers\ForumController;
use App\Http\Controllers\SupportCenterController;
use App\Http\Controllers\TicketController;
use App\Http\Controllers\KnowledgeController;
use App\Http\Controllers\MetricsController;
use App\Http\Controllers\AdminController;
use App\Http\Controllers\PBLGenerateController;
use App\Http\Controllers\MahasiswaController;
use App\Http\Controllers\JadwalPBLController;
use App\Http\Controllers\JadwalPraktikumController;
use App\Http\Controllers\JadwalJurnalReadingController;
use App\Http\Controllers\JadwalPersamaanPersepsiController;
use App\Http\Controllers\JadwalHarianController;
use App\Http\Controllers\ProportionalDistributionController;
use App\Http\Controllers\WhatsAppController;


// Login dengan rate limiting lebih ketat untuk mencegah brute force
Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:10,1');

// Global rate limiting untuk semua API routes (120 requests per minute per user/IP)
// Ini mencegah abuse dan overload server saat banyak user mengakses bersamaan
Route::middleware('throttle:120,1')->group(function () {
    Route::middleware(['auth:sanctum', 'validate.token'])->post('/logout', [AuthController::class, 'logout']);
    Route::post('/force-logout-by-token', [AuthController::class, 'forceLogoutByToken']);
    Route::post('/force-logout-by-user', [AuthController::class, 'forceLogoutByUser']);
    Route::post('/force-logout-by-username', [AuthController::class, 'forceLogoutByUsername']);

    Route::middleware(['auth:sanctum', 'validate.token'])->get('/me', function (Request $request) {
        return $request->user();
    });

    Route::middleware(['auth:sanctum', 'validate.token'])->get('/profile', function (Request $request) {
        return response()->json([
            'user' => $request->user()
        ]);
    });
    Route::middleware(['auth:sanctum', 'validate.token'])->put('/profile', [AuthController::class, 'updateProfile']);
    Route::middleware(['auth:sanctum', 'validate.token'])->get('/profile/check-availability', [AuthController::class, 'checkAvailability']);
    Route::middleware(['auth:sanctum', 'validate.token'])->post('/profile/avatar', [AuthController::class, 'updateAvatar']);

    Route::middleware(['auth:sanctum', 'validate.token'])->get('/users/search', [UserController::class, 'search']);

    Route::middleware(['auth:sanctum', 'validate.token', 'role:super_admin,tim_akademik,dosen'])->apiResource('users', \App\Http\Controllers\UserController::class);

Route::middleware(['auth:sanctum', 'validate.token', 'role:super_admin'])->post('/users/import-dosen', [UserController::class, 'importDosen']);

Route::middleware(['auth:sanctum', 'validate.token', 'role:super_admin'])->post('/users/import-mahasiswa', [UserController::class, 'importMahasiswa']);

Route::middleware(['auth:sanctum', 'role:super_admin'])->post('/users/import-tim-akademik', [UserController::class, 'importTimAkademik']);

// Route untuk laporan jadwal mengajar dosen
Route::middleware('auth:sanctum')->get('/users/{id}/jadwal-mengajar', [UserController::class, 'getJadwalMengajar']);

// Email verification routes for dosen
Route::middleware(['auth:sanctum', 'validate.token', 'role:dosen'])->get('/users/{id}/email-status', [UserController::class, 'getEmailStatus']);
Route::middleware(['auth:sanctum', 'validate.token', 'role:dosen'])->put('/users/{id}/update-email', [UserController::class, 'updateEmail']);

Route::middleware('auth:sanctum')->post('/ruangan/import', [RuanganController::class, 'importRuangan']);

Route::middleware('auth:sanctum')->post('/mata-kuliah/bulk-import', [MataKuliahController::class, 'bulkImport']);

Route::get('/mata-kuliah/filter-options', [MataKuliahController::class, 'filterOptions']);

Route::get('/mata-kuliah/peran-kurikulum-options', [MataKuliahController::class, 'peranKurikulumOptions']);

Route::get('/mata-kuliah/keahlian-options', [MataKuliahController::class, 'keahlianOptions']);

Route::middleware('auth:sanctum')->get('/ruangan/by-capacity', [RuanganController::class, 'getRuanganByCapacity']);
Route::middleware('auth:sanctum')->get('/ruangan/options', [RuanganController::class, 'getRuanganOptions']);
Route::middleware('auth:sanctum')->apiResource('ruangan', RuanganController::class);

Route::middleware('auth:sanctum')->apiResource('mata-kuliah', MataKuliahController::class);
Route::middleware('auth:sanctum')->get('/mata-kuliah-dosen', [MataKuliahController::class, 'getMataKuliahDosen']);
Route::middleware('auth:sanctum')->get('/mata-kuliah-dosen/{kode}/jadwal', [MataKuliahController::class, 'getJadwalDosenMataKuliah']);
Route::middleware('auth:sanctum')->get('/mata-kuliah-with-materi', [MataKuliahController::class, 'getWithMateri']);
Route::middleware('auth:sanctum')->get('/mata-kuliah-with-materi-all', [MataKuliahController::class, 'getWithMateriAll']);
Route::middleware('auth:sanctum')->put('/mata-kuliah/{kode}/keahlian', [MataKuliahController::class, 'updateKeahlian']);
Route::middleware('auth:sanctum')->get('/mata-kuliah/{kode}/keahlian', [MataKuliahController::class, 'getKeahlian']);
Route::middleware('auth:sanctum')->get('/mata-kuliah/semester/{semester}', [MataKuliahController::class, 'getBySemester']);

// RPS Routes
Route::middleware('auth:sanctum')->post('/mata-kuliah/upload-rps', [MataKuliahController::class, 'uploadRps']);
Route::middleware('auth:sanctum')->get('/mata-kuliah/{kode}/download-rps', [MataKuliahController::class, 'downloadRps']);
Route::middleware('auth:sanctum')->delete('/mata-kuliah/{kode}/delete-rps', [MataKuliahController::class, 'deleteRps']);

// Materi Routes
Route::middleware('auth:sanctum')->post('/mata-kuliah/upload-materi', [MataKuliahController::class, 'uploadMateri']);
Route::middleware('auth:sanctum')->get('/mata-kuliah/{kode}/materi', [MataKuliahController::class, 'getMateri']);
Route::middleware('auth:sanctum')->get('/mata-kuliah/{kode}/download-materi', [MataKuliahController::class, 'downloadMateri']);
Route::middleware('auth:sanctum')->delete('/mata-kuliah/{kode}/delete-materi', [MataKuliahController::class, 'deleteMateri']);
Route::middleware('auth:sanctum')->put('/mata-kuliah/{kode}/update-materi-judul', [MataKuliahController::class, 'updateMateriJudul']);

// Dosen Permission Routes
Route::middleware('auth:sanctum')->get('/mata-kuliah/{kode}/dosen-permissions', [MataKuliahController::class, 'getDosenPermissions']);

// Reporting routes
Route::middleware('auth:sanctum')->prefix('reporting')->group(function () {
    Route::get('/', [ReportingController::class, 'index']);
    Route::get('/summary', [ReportingController::class, 'summary']);
    Route::get('/export', [ReportingController::class, 'export']);
    Route::get('/dosen-csr', [ReportingController::class, 'dosenCsrReport']);
    Route::get('/dosen-pbl', [ReportingController::class, 'dosenPblReport']);
    Route::get('/jadwal-all', [ReportingController::class, 'jadwalAll']);
    Route::get('/blok-data-excel', [ReportingController::class, 'getBlokDataForExcel']);
});

Route::middleware('auth:sanctum')->group(function () {
    // Tahun Ajaran Routes
    Route::get('/tahun-ajaran', [TahunAjaranController::class, 'index']);
    Route::post('/tahun-ajaran', [TahunAjaranController::class, 'store']);
    Route::delete('/tahun-ajaran/{tahunAjaran}', [TahunAjaranController::class, 'destroy']);
    Route::post('/tahun-ajaran/{tahunAjaran}/activate', [TahunAjaranController::class, 'activate']);
    Route::post('/semesters/{semester}/activate', [TahunAjaranController::class, 'activateSemester']);
    Route::get('/tahun-ajaran/active', [App\Http\Controllers\TahunAjaranController::class, 'active']);
    Route::get('/tahun-ajaran/available-semesters', [TahunAjaranController::class, 'getAvailableSemesters']);


    Route::apiResource('mata-kuliah.csrs', MataKuliahCSRController::class)->shallow();
    Route::get('/pbls/all', [MataKuliahPBLController::class, 'all']);
    Route::get('/pbls', [MataKuliahPBLController::class, 'getAllPbls']);
    Route::apiResource('mata-kuliah.pbls', MataKuliahPBLController::class)->shallow();

    // Jurnal Reading Routes
    Route::get('/jurnal-readings/all', [MataKuliahJurnalReadingController::class, 'all']);
    Route::get('/jurnal-readings', [MataKuliahJurnalReadingController::class, 'getAllJurnalReadings']);
    Route::apiResource('mata-kuliah.jurnal-readings', MataKuliahJurnalReadingController::class)->shallow();

    // CSR Routes
    Route::apiResource('csr', CSRController::class);
    Route::get('/csrs', [CSRController::class, 'batch']);
    Route::get('/csr/{csr}/mappings', [\App\Http\Controllers\CSRMappingController::class, 'index']);
    Route::post('/csr/{csr}/mappings', [\App\Http\Controllers\CSRMappingController::class, 'store']);
    Route::delete('/csr/{csr}/mappings/{dosen}/{keahlian}', [\App\Http\Controllers\CSRMappingController::class, 'destroy']);

    // Route untuk auto-delete CSR assignments saat dosen dihapus dari PBL
    Route::delete('/dosen/{dosenId}/csr-assignments', [\App\Http\Controllers\CSRMappingController::class, 'deleteByDosenSemesterBlok']);

    // Keahlian CSR Routes
    Route::post('/keahlian-csr', [\App\Http\Controllers\KeahlianCSRController::class, 'store']);
    Route::get('/keahlian-csr/csr/{csrId}', [\App\Http\Controllers\KeahlianCSRController::class, 'getByCSR']);
    Route::delete('/keahlian-csr/csr/{csrId}', [\App\Http\Controllers\KeahlianCSRController::class, 'deleteByCSR']);
    Route::get('/keahlian-csr/semester-blok', [\App\Http\Controllers\KeahlianCSRController::class, 'getBySemesterBlok']);

    Route::get('/pbls/check-blok/{blokId}', [App\Http\Controllers\MataKuliahPBLController::class, 'checkBlokGenerated']);
    Route::post('/pbls/assign-dosen-batch', [App\Http\Controllers\MataKuliahPBLController::class, 'assignDosenBatch']);
    Route::post('/pbls/reset-dosen-batch', [App\Http\Controllers\MataKuliahPBLController::class, 'resetDosenBatch']);

    // Assignment dosen ke PBL
    Route::post('/pbls/{pbl}/assign-dosen', [App\Http\Controllers\MataKuliahPBLController::class, 'assignDosen']);
    Route::delete('/pbls/{pbl}/unassign-dosen/{dosen}', [App\Http\Controllers\MataKuliahPBLController::class, 'unassignDosen']);
    Route::get('/pbls/{pbl}/assigned-dosen', [App\Http\Controllers\MataKuliahPBLController::class, 'assignedDosen']);
    Route::post('/pbls/assigned-dosen-batch', [App\Http\Controllers\MataKuliahPBLController::class, 'assignedDosenBatch']);
    Route::delete('/pbls/{pbl}/reset-dosen', [App\Http\Controllers\MataKuliahPBLController::class, 'resetDosen']);

    // Get PBL assignments for specific dosen
    Route::get('/dosen/{dosenId}/pbl-assignments', [App\Http\Controllers\MataKuliahPBLController::class, 'getDosenPBLAssignments']);

    // PBL Generate Routes - Controller khusus untuk generate sederhana
    Route::middleware(['auth:sanctum', 'validate.token'])->post('/pbl-generate/assignments', [App\Http\Controllers\PBLGenerateController::class, 'generateAssignments']);
    Route::middleware(['auth:sanctum', 'validate.token'])->post('/pbl-generate/reset', [App\Http\Controllers\PBLGenerateController::class, 'resetAssignments']);
    Route::middleware(['auth:sanctum', 'validate.token'])->post('/pbl-generate/get-assignments', [App\Http\Controllers\PBLGenerateController::class, 'getAssignments']);
    Route::middleware(['auth:sanctum', 'validate.token'])->get('/pbl-generate/check-status', [App\Http\Controllers\PBLGenerateController::class, 'checkGenerateStatus']);

    // Proportional Distribution Routes
    Route::middleware(['auth:sanctum', 'validate.token'])->post('/proportional-distribution', [ProportionalDistributionController::class, 'store']);
    Route::middleware(['auth:sanctum', 'validate.token'])->get('/proportional-distribution', [ProportionalDistributionController::class, 'show']);
    Route::middleware(['auth:sanctum', 'validate.token'])->delete('/proportional-distribution', [ProportionalDistributionController::class, 'destroy']);



    // Admin notification tracking routes (MUST come BEFORE parameterized routes)
    Route::middleware(['auth:sanctum', 'role:super_admin,tim_akademik'])->get('/notifications/admin/all', [App\Http\Controllers\NotificationController::class, 'getAllNotificationsForAdmin']);
    Route::middleware(['auth:sanctum', 'role:super_admin,tim_akademik'])->get('/notifications/admin/stats', [App\Http\Controllers\NotificationController::class, 'getNotificationStats']);
    Route::middleware(['auth:sanctum', 'role:super_admin,tim_akademik'])->delete('/notifications/admin/reset', [App\Http\Controllers\NotificationController::class, 'resetNotificationsForAdmin']);

    // Notification routes - Allow both super_admin and dosen to access their respective endpoints
    Route::middleware(['auth:sanctum'])->get('/notifications/dosen/{userId}', [App\Http\Controllers\NotificationController::class, 'getUserNotifications']);
    Route::middleware(['auth:sanctum', 'role:super_admin'])->get('/notifications/admin/{userId}', [App\Http\Controllers\NotificationController::class, 'getAdminNotifications']);
    Route::middleware(['auth:sanctum', 'sanitize'])->put('/notifications/{notificationId}/read', [App\Http\Controllers\NotificationController::class, 'markAsRead']);
    Route::middleware(['auth:sanctum'])->put('/notifications/dosen/{userId}/mark-all-read', [App\Http\Controllers\NotificationController::class, 'markAllAsRead']);
    Route::middleware(['auth:sanctum', 'role:super_admin'])->put('/notifications/admin/{userId}/mark-all-read', [App\Http\Controllers\NotificationController::class, 'markAllAsRead']);
    Route::middleware(['auth:sanctum'])->get('/notifications/dosen/{userId}/unread-count', [App\Http\Controllers\NotificationController::class, 'getUnreadCount']);
    Route::middleware(['auth:sanctum', 'role:super_admin'])->get('/notifications/admin/{userId}/unread-count', [App\Http\Controllers\NotificationController::class, 'getUnreadCount']);
    Route::middleware(['auth:sanctum'])->delete('/notifications/dosen/{userId}/clear-all', [App\Http\Controllers\NotificationController::class, 'clearAllNotifications']);
    Route::middleware(['auth:sanctum', 'role:super_admin'])->delete('/notifications/admin/{userId}/clear-all', [App\Http\Controllers\NotificationController::class, 'clearAllNotifications']);
    Route::middleware(['auth:sanctum', 'sanitize'])->delete('/notifications/{notificationId}', [App\Http\Controllers\NotificationController::class, 'deleteNotification']);

    // Dosen replacement routes
    Route::middleware(['auth:sanctum', 'role:super_admin,tim_akademik'])->post('/notifications/ask-again', [App\Http\Controllers\NotificationController::class, 'askDosenAgain']);
    Route::middleware(['auth:sanctum', 'role:super_admin,tim_akademik'])->post('/notifications/replace-dosen', [App\Http\Controllers\NotificationController::class, 'replaceDosen']);
    Route::middleware(['auth:sanctum', 'role:super_admin,tim_akademik'])->get('/notifications/check-dosen-availability', [App\Http\Controllers\NotificationController::class, 'checkDosenAvailability']);

    // Reschedule routes
    Route::middleware(['auth:sanctum', 'role:super_admin,tim_akademik'])->post('/notifications/approve-reschedule', [App\Http\Controllers\NotificationController::class, 'approveReschedule']);
    Route::middleware(['auth:sanctum', 'role:super_admin,tim_akademik'])->post('/notifications/reject-reschedule', [App\Http\Controllers\NotificationController::class, 'rejectReschedule']);

    // Reminder notification routes
    Route::middleware(['auth:sanctum', 'role:super_admin,tim_akademik'])->post('/notifications/send-reminder', [App\Http\Controllers\NotificationController::class, 'sendReminderNotifications']);
    Route::middleware(['auth:sanctum', 'role:super_admin,tim_akademik'])->get('/notifications/pending-dosen', [App\Http\Controllers\NotificationController::class, 'getPendingDosen']);
    Route::middleware(['auth:sanctum', 'role:super_admin,tim_akademik'])->post('/notifications/send-status-change', [App\Http\Controllers\NotificationController::class, 'sendStatusChangeNotification']);
});

Route::middleware('auth:sanctum')->get('/kelompok-besar', [KelompokBesarController::class, 'index']);
Route::middleware('auth:sanctum')->get('/kelompok-besar/semester/{semesterId}', [KelompokBesarController::class, 'getBySemesterId']);
Route::middleware('auth:sanctum')->post('/kelompok-besar', [KelompokBesarController::class, 'store']);
Route::middleware('auth:sanctum')->delete('/kelompok-besar/{id}', [KelompokBesarController::class, 'destroy']);
Route::middleware('auth:sanctum')->delete('/kelompok-besar/mahasiswa/{mahasiswaId}', [KelompokBesarController::class, 'deleteByMahasiswaId']);
Route::middleware('auth:sanctum')->post('/kelompok-besar/batch-by-semester', [\App\Http\Controllers\KelompokBesarController::class, 'batchBySemester']);

Route::middleware('auth:sanctum')->get('/kelompok-kecil', [KelompokKecilController::class, 'index']);
Route::middleware('auth:sanctum')->post('/kelompok-kecil', [KelompokKecilController::class, 'store']);
Route::middleware('auth:sanctum')->post('/kelompok-kecil/single', [KelompokKecilController::class, 'createSingle']);
Route::middleware('auth:sanctum')->put('/kelompok-kecil/{id}', [KelompokKecilController::class, 'update']);
Route::middleware('auth:sanctum')->delete('/kelompok-kecil/{id}', [KelompokKecilController::class, 'destroy']);
Route::middleware('auth:sanctum')->get('/kelompok-kecil/stats', [KelompokKecilController::class, 'stats']);
Route::middleware('auth:sanctum')->post('/kelompok-kecil/batch-update', [App\Http\Controllers\KelompokKecilController::class, 'batchUpdate']);
Route::middleware('auth:sanctum')->get('/kelompok-kecil/by-nama', [KelompokKecilController::class, 'getByNama']);
Route::middleware('auth:sanctum')->get('/kelompok-kecil/{id}/mahasiswa', [KelompokKecilController::class, 'getMahasiswa']);
Route::middleware('auth:sanctum')->get('/kelompok-kecil/{id}', [KelompokKecilController::class, 'show']);
Route::middleware('auth:sanctum')->post('/kelompok-kecil/batch-by-semester', [\App\Http\Controllers\KelompokKecilController::class, 'batchBySemester']);

Route::middleware('auth:sanctum')->get('/kelas', [KelasController::class, 'index']);
Route::middleware('auth:sanctum')->get('/kelas/semester/{semester}', [KelasController::class, 'getBySemester']);
Route::middleware('auth:sanctum')->get('/kelas/semester-id/{semesterId}', [KelasController::class, 'getBySemesterId']);
Route::middleware('auth:sanctum')->post('/kelas', [KelasController::class, 'store']);
Route::middleware('auth:sanctum')->get('/kelas/{id}', [KelasController::class, 'show']);
Route::middleware('auth:sanctum')->put('/kelas/{id}', [KelasController::class, 'update']);
Route::middleware('auth:sanctum')->delete('/kelas/{id}', [KelasController::class, 'destroy']);

// PBL Kelompok Kecil Routes
Route::middleware('auth:sanctum')->post('/mata-kuliah/{kode}/pbl-kelompok-kecil', [MataKuliahPBLKelompokKecilController::class, 'store']);
Route::middleware('auth:sanctum')->get('/pbl-kelompok-kecil/available', [MataKuliahPBLKelompokKecilController::class, 'getAvailableKelompok']);
Route::middleware('auth:sanctum')->get('/pbl-kelompok-kecil/all-with-status', [MataKuliahPBLKelompokKecilController::class, 'getAllKelompokWithStatus']);
Route::middleware('auth:sanctum')->delete('/mata-kuliah/{kode}/pbl-kelompok-kecil', [MataKuliahPBLKelompokKecilController::class, 'destroyMapping']);
Route::middleware('auth:sanctum')->get('/pbl-kelompok-kecil/list', [MataKuliahPBLKelompokKecilController::class, 'listKelompokWithStatus']);

// Batch mapping kelompok kecil untuk banyak mata kuliah sekaligus
Route::middleware('auth:sanctum')->post('/mata-kuliah/pbl-kelompok-kecil/batch', [\App\Http\Controllers\MataKuliahPBLKelompokKecilController::class, 'batchMapping']);
// Batch mapping kelompok kecil untuk banyak semester sekaligus
Route::middleware('auth:sanctum')->post('/mata-kuliah/pbl-kelompok-kecil/batch-multi-semester', [\App\Http\Controllers\MataKuliahPBLKelompokKecilController::class, 'batchMappingMultiSemester']);
// Batch detail kelompok kecil berdasarkan array nama_kelompok dan semester
Route::middleware('auth:sanctum')->post('/kelompok-kecil/batch-detail', [\App\Http\Controllers\KelompokKecilController::class, 'batchDetail']);

// Assignment dosen ke PBL
Route::middleware('auth:sanctum')->post('/pbls/{pbl}/assign-dosen', [App\Http\Controllers\MataKuliahPBLController::class, 'assignDosen']);
Route::middleware('auth:sanctum')->delete('/pbls/{pbl}/unassign-dosen/{dosen}', [App\Http\Controllers\MataKuliahPBLController::class, 'unassignDosen']);
Route::middleware('auth:sanctum')->get('/pbls/{pbl}/assigned-dosen', [App\Http\Controllers\MataKuliahPBLController::class, 'assignedDosen']);
Route::middleware('auth:sanctum')->post('/pbls/assigned-dosen-batch', [App\Http\Controllers\MataKuliahPBLController::class, 'assignedDosenBatch']);
Route::middleware('auth:sanctum')->post('/pbls/reset-dosen-batch', [App\Http\Controllers\MataKuliahPBLController::class, 'resetDosenBatch']);
Route::middleware('auth:sanctum')->delete('/pbls/{pbl}/reset-dosen', [App\Http\Controllers\MataKuliahPBLController::class, 'resetDosen']);

Route::middleware('auth:sanctum')->prefix('mata-kuliah/{kode}')->group(function () {
    Route::apiResource('jadwal-pbl', App\Http\Controllers\JadwalPBLController::class)->parameters([
        'jadwal-pbl' => 'id'
    ]);

    // Route untuk jadwal PBL berdasarkan PBL ID
    Route::get('/pbls/{pblId}/jadwal', [App\Http\Controllers\JadwalPBLController::class, 'getJadwalByPblId']);

    // Route untuk import Excel jadwal PBL
    Route::post('/jadwal-pbl/import', [App\Http\Controllers\JadwalPBLController::class, 'importExcel']);

    // Batch endpoint untuk DetailBlok page optimization
    Route::get('/batch-data', [App\Http\Controllers\DetailBlokController::class, 'getBatchData']);
});

// Jadwal PBL untuk dosen
Route::middleware('auth:sanctum')->get('/jadwal-pbl/dosen/{dosenId}', [App\Http\Controllers\JadwalPBLController::class, 'getJadwalForDosen']);
Route::middleware('auth:sanctum')->put('/jadwal-pbl/{jadwalId}/konfirmasi', [App\Http\Controllers\JadwalPBLController::class, 'konfirmasiJadwal']);
Route::middleware('auth:sanctum')->post('/jadwal-pbl/{jadwalId}/reschedule', [App\Http\Controllers\JadwalPBLController::class, 'reschedule']);

// Jadwal Kuliah Besar untuk dosen
Route::middleware('auth:sanctum')->get('/jadwal-kuliah-besar/dosen/{dosenId}', [JadwalKuliahBesarController::class, 'getJadwalForDosen']);
Route::middleware('auth:sanctum')->put('/jadwal-kuliah-besar/{id}/konfirmasi', [JadwalKuliahBesarController::class, 'konfirmasi']);
Route::middleware('auth:sanctum')->post('/jadwal-kuliah-besar/{id}/reschedule', [JadwalKuliahBesarController::class, 'reschedule']);
Route::middleware('auth:sanctum')->get('/riwayat-konfirmasi/dosen/{dosenId}', [JadwalKuliahBesarController::class, 'getRiwayatDosen']);

// Jadwal Praktikum untuk dosen
Route::middleware('auth:sanctum')->get('/jadwal-praktikum/dosen/{dosenId}', [App\Http\Controllers\JadwalPraktikumController::class, 'getJadwalForDosen']);
Route::middleware('auth:sanctum')->put('/jadwal-praktikum/{id}/konfirmasi', [App\Http\Controllers\JadwalPraktikumController::class, 'konfirmasi']);

// Jadwal Jurnal Reading untuk dosen
Route::middleware('auth:sanctum')->get('/jadwal-jurnal-reading/dosen/{dosenId}', [App\Http\Controllers\JadwalJurnalReadingController::class, 'getJadwalForDosen']);
Route::middleware('auth:sanctum')->put('/jadwal-jurnal-reading/{id}/konfirmasi', [App\Http\Controllers\JadwalJurnalReadingController::class, 'konfirmasi']);
Route::middleware('auth:sanctum')->post('/jadwal-jurnal-reading/{id}/reschedule', [App\Http\Controllers\JadwalJurnalReadingController::class, 'reschedule']);

// Jadwal CSR untuk dosen
Route::middleware('auth:sanctum')->get('/jadwal-csr/dosen/{dosenId}', [App\Http\Controllers\JadwalCSRController::class, 'getJadwalForDosen']);
Route::middleware('auth:sanctum')->put('/jadwal-csr/{id}/konfirmasi', [App\Http\Controllers\JadwalCSRController::class, 'konfirmasiJadwal']);
Route::middleware('auth:sanctum')->post('/jadwal-csr/{id}/reschedule', [App\Http\Controllers\JadwalCSRController::class, 'reschedule']);

// Jadwal Non Blok Non CSR untuk dosen
Route::middleware('auth:sanctum')->get('/jadwal-non-blok-non-csr/{id}', [App\Http\Controllers\JadwalNonBlokNonCSRController::class, 'show']);
Route::middleware('auth:sanctum')->get('/jadwal-non-blok-non-csr/dosen/{dosenId}', [App\Http\Controllers\JadwalNonBlokNonCSRController::class, 'getJadwalForDosen']);
Route::middleware('auth:sanctum')->put('/jadwal-non-blok-non-csr/{id}/konfirmasi', [App\Http\Controllers\JadwalNonBlokNonCSRController::class, 'konfirmasiJadwal']);
Route::middleware('auth:sanctum')->post('/jadwal-non-blok-non-csr/{id}/reschedule', [App\Http\Controllers\JadwalNonBlokNonCSRController::class, 'reschedule']);

// Penilaian Seminar Proposal
Route::middleware('auth:sanctum')->get('/penilaian-seminar-proposal/jadwal/{jadwalId}', [App\Http\Controllers\PenilaianSeminarProposalController::class, 'getByJadwal']);
Route::middleware('auth:sanctum')->get('/penilaian-seminar-proposal/jadwal/{jadwalId}/mahasiswa/{mahasiswaId}', [App\Http\Controllers\PenilaianSeminarProposalController::class, 'getSummary']);
Route::middleware('auth:sanctum')->get('/penilaian-seminar-proposal/jadwal/{jadwalId}/mahasiswa/{mahasiswaId}/my', [App\Http\Controllers\PenilaianSeminarProposalController::class, 'getMyPenilaian']);
Route::middleware('auth:sanctum')->post('/penilaian-seminar-proposal', [App\Http\Controllers\PenilaianSeminarProposalController::class, 'store']);

// Hasil Seminar Proposal (Keputusan Moderator)
Route::middleware('auth:sanctum')->get('/hasil-seminar-proposal/jadwal/{jadwalId}', [App\Http\Controllers\HasilSeminarProposalController::class, 'getByJadwal']);
Route::middleware('auth:sanctum')->get('/hasil-seminar-proposal/jadwal/{jadwalId}/mahasiswa/{mahasiswaId}', [App\Http\Controllers\HasilSeminarProposalController::class, 'getByMahasiswa']);
Route::middleware('auth:sanctum')->post('/hasil-seminar-proposal', [App\Http\Controllers\HasilSeminarProposalController::class, 'store']);
Route::middleware('auth:sanctum')->post('/hasil-seminar-proposal/finalize', [App\Http\Controllers\HasilSeminarProposalController::class, 'finalize']);
Route::middleware('auth:sanctum')->post('/hasil-seminar-proposal/unfinalize', [App\Http\Controllers\HasilSeminarProposalController::class, 'unfinalize']);

// Penilaian Sidang Skripsi
Route::middleware('auth:sanctum')->get('/penilaian-sidang-skripsi/jadwal/{jadwalId}', [App\Http\Controllers\PenilaianSidangSkripsiController::class, 'getByJadwal']);
Route::middleware('auth:sanctum')->get('/penilaian-sidang-skripsi/jadwal/{jadwalId}/mahasiswa/{mahasiswaId}', [App\Http\Controllers\PenilaianSidangSkripsiController::class, 'getSummary']);
Route::middleware('auth:sanctum')->get('/penilaian-sidang-skripsi/jadwal/{jadwalId}/mahasiswa/{mahasiswaId}/my', [App\Http\Controllers\PenilaianSidangSkripsiController::class, 'getMyPenilaian']);
Route::middleware('auth:sanctum')->post('/penilaian-sidang-skripsi', [App\Http\Controllers\PenilaianSidangSkripsiController::class, 'store']);

// Hasil Sidang Skripsi
Route::middleware('auth:sanctum')->get('/hasil-sidang-skripsi/jadwal/{jadwalId}', [App\Http\Controllers\HasilSidangSkripsiController::class, 'getByJadwal']);
Route::middleware('auth:sanctum')->get('/hasil-sidang-skripsi/jadwal/{jadwalId}/mahasiswa/{mahasiswaId}', [App\Http\Controllers\HasilSidangSkripsiController::class, 'getByMahasiswa']);
Route::middleware('auth:sanctum')->post('/hasil-sidang-skripsi', [App\Http\Controllers\HasilSidangSkripsiController::class, 'store']);
Route::middleware('auth:sanctum')->post('/hasil-sidang-skripsi/finalize', [App\Http\Controllers\HasilSidangSkripsiController::class, 'finalize']);
Route::middleware('auth:sanctum')->post('/hasil-sidang-skripsi/unfinalize', [App\Http\Controllers\HasilSidangSkripsiController::class, 'unfinalize']);

// Jadwal Hari Ini untuk dosen
Route::middleware('auth:sanctum')->get('/dosen/{dosenId}/today-schedule', [App\Http\Controllers\JadwalHarianController::class, 'getTodayScheduleForDosen']);

Route::middleware('auth:sanctum')->prefix('mata-kuliah/{kode}/kelompok/{kelompok}/pertemuan/{pertemuan}')->group(function () {
    Route::get('penilaian-pbl', [App\Http\Controllers\PenilaianPBLController::class, 'index']);
    Route::post('penilaian-pbl', [App\Http\Controllers\PenilaianPBLController::class, 'store']);
    Route::get('absensi-pbl', [App\Http\Controllers\PenilaianPBLController::class, 'getAbsensi']);
    Route::post('absensi-pbl', [App\Http\Controllers\PenilaianPBLController::class, 'storeAbsensi']);
});

Route::middleware('auth:sanctum')->prefix('mata-kuliah/{kode}/kelompok-antara/{kelompok}/pertemuan/{pertemuan}')->group(function () {
    Route::get('penilaian-pbl', [App\Http\Controllers\PenilaianPBLController::class, 'indexAntara']);
    Route::post('penilaian-pbl', [App\Http\Controllers\PenilaianPBLController::class, 'storeAntara']);
    Route::get('absensi-pbl', [App\Http\Controllers\PenilaianPBLController::class, 'getAbsensi']);
    Route::post('absensi-pbl', [App\Http\Controllers\PenilaianPBLController::class, 'storeAbsensi']);
});

Route::middleware('auth:sanctum')->prefix('kuliah-besar')->group(function () {
    Route::get('/jadwal/{kode}', [JadwalKuliahBesarController::class, 'index']);
    Route::post('/jadwal/{kode}', [JadwalKuliahBesarController::class, 'store']);
    Route::put('/jadwal/{kode}/{id}', [JadwalKuliahBesarController::class, 'update']);
    Route::delete('/jadwal/{kode}/{id}', [JadwalKuliahBesarController::class, 'destroy']);
    Route::put('/jadwal/{id}/konfirmasi', [JadwalKuliahBesarController::class, 'konfirmasi']);
    Route::get('/materi', [JadwalKuliahBesarController::class, 'materi']);
    Route::get('/pengampu', [JadwalKuliahBesarController::class, 'pengampu']);
    Route::get('/all-dosen', [JadwalKuliahBesarController::class, 'allDosen']);
    Route::get('/kelompok-besar', [JadwalKuliahBesarController::class, 'kelompokBesar']);
    Route::get('/kelompok-besar-antara', [JadwalKuliahBesarController::class, 'kelompokBesarAntara']);
    Route::post('/import/{kode}', [JadwalKuliahBesarController::class, 'importExcel']);

    // Routes untuk absensi kuliah besar
    Route::get('/{kode}/jadwal/{jadwalId}/mahasiswa', [JadwalKuliahBesarController::class, 'getMahasiswa']);
    Route::get('/{kode}/jadwal/{jadwalId}/absensi', [JadwalKuliahBesarController::class, 'getAbsensi']);
    Route::post('/{kode}/jadwal/{jadwalId}/absensi', [JadwalKuliahBesarController::class, 'saveAbsensi']);
    Route::put('/{kode}/jadwal/{jadwalId}/toggle-qr', [JadwalKuliahBesarController::class, 'toggleQr']);
    Route::get('/{kode}/jadwal/{jadwalId}/qr-token', [JadwalKuliahBesarController::class, 'generateQrToken']);
});

// Routes untuk Kelompok Besar Antara (Global untuk semester Antara)
Route::middleware('auth:sanctum')->prefix('kelompok-besar-antara')->group(function () {
    Route::get('/mahasiswa', [KelompokBesarAntaraController::class, 'getMahasiswa']);
    Route::get('/', [KelompokBesarAntaraController::class, 'index']);
    Route::get('/{id}', [KelompokBesarAntaraController::class, 'show']);
    Route::post('/', [KelompokBesarAntaraController::class, 'store']);
    Route::put('/{id}', [KelompokBesarAntaraController::class, 'update']);
    Route::delete('/{id}', [KelompokBesarAntaraController::class, 'destroy']);
});

// Routes untuk Kelompok Kecil Antara (Global untuk semester Antara)
Route::middleware('auth:sanctum')->prefix('kelompok-kecil-antara')->group(function () {
    Route::get('/', [KelompokKecilAntaraController::class, 'index']);
    Route::post('/', [KelompokKecilAntaraController::class, 'store']);
    Route::put('/{id}', [KelompokKecilAntaraController::class, 'update']);
    Route::delete('/{id}', [KelompokKecilAntaraController::class, 'destroy']);
    Route::get('/by-nama', [KelompokKecilAntaraController::class, 'getByNama']);
});



Route::middleware('auth:sanctum')->prefix('agenda-khusus')->group(function () {
    Route::get('/', [App\Http\Controllers\AgendaKhususController::class, 'index']);
    Route::get('/mata-kuliah/{kode}', [App\Http\Controllers\AgendaKhususController::class, 'getByMataKuliah']);
    Route::get('/date-range', [App\Http\Controllers\AgendaKhususController::class, 'getByDateRange']);
    Route::get('/jadwal/{kode}', [App\Http\Controllers\JadwalAgendaKhususController::class, 'index']);
    Route::post('/jadwal/{kode}', [App\Http\Controllers\JadwalAgendaKhususController::class, 'store']);
    Route::put('/jadwal/{kode}/{id}', [App\Http\Controllers\JadwalAgendaKhususController::class, 'update']);
    Route::delete('/jadwal/{kode}/{id}', [App\Http\Controllers\JadwalAgendaKhususController::class, 'destroy']);
    Route::post('/jadwal/{kode}/import', [App\Http\Controllers\JadwalAgendaKhususController::class, 'importExcel']);
    Route::get('/kelompok-besar', [App\Http\Controllers\JadwalAgendaKhususController::class, 'kelompokBesar']);
});

Route::middleware('auth:sanctum')->prefix('praktikum')->group(function () {
    Route::get('/jadwal/{kode}', [App\Http\Controllers\JadwalPraktikumController::class, 'index']);
    Route::post('/jadwal/{kode}', [App\Http\Controllers\JadwalPraktikumController::class, 'store']);
    Route::put('/jadwal/{kode}/{id}', [App\Http\Controllers\JadwalPraktikumController::class, 'update']);
    Route::delete('/jadwal/{kode}/{id}', [App\Http\Controllers\JadwalPraktikumController::class, 'destroy']);
    Route::post('/jadwal/{kode}/import', [App\Http\Controllers\JadwalPraktikumController::class, 'importExcel']);
    Route::get('/kelas/{semester}', [App\Http\Controllers\JadwalPraktikumController::class, 'getKelasPraktikum']);
    Route::get('/materi/{blok}/{semester}', [App\Http\Controllers\JadwalPraktikumController::class, 'getMateri']);
    Route::get('/pengampu/{keahlian}/{blok}/{semester}', [App\Http\Controllers\JadwalPraktikumController::class, 'getPengampu']);
    Route::get('/{kode}/jadwal/{jadwalId}/mahasiswa', [App\Http\Controllers\JadwalPraktikumController::class, 'getMahasiswa']);
    Route::get('/{kode}/jadwal/{jadwalId}/absensi', [App\Http\Controllers\JadwalPraktikumController::class, 'getAbsensi']);
    Route::post('/{kode}/jadwal/{jadwalId}/absensi', [App\Http\Controllers\JadwalPraktikumController::class, 'saveAbsensi']);
    Route::put('/{kode}/jadwal/{jadwalId}/toggle-qr', [App\Http\Controllers\JadwalPraktikumController::class, 'toggleQr']);
    Route::get('/{kode}/jadwal/{jadwalId}/qr-token', [App\Http\Controllers\JadwalPraktikumController::class, 'generateQrToken']);
    // Routes untuk absensi dosen (hanya tim akademik)
    Route::get('/{kode}/jadwal/{jadwalId}/absensi-dosen', [App\Http\Controllers\JadwalPraktikumController::class, 'getAbsensiDosen']);
    Route::post('/{kode}/jadwal/{jadwalId}/absensi-dosen', [App\Http\Controllers\JadwalPraktikumController::class, 'storeAbsensiDosen']);
    // Routes untuk koordinator signature
    Route::get('/{kode}/jadwal/{jadwalId}/koordinator-signature', [App\Http\Controllers\JadwalPraktikumController::class, 'getKoordinatorSignature']);
    Route::post('/{kode}/jadwal/{jadwalId}/koordinator-signature', [App\Http\Controllers\JadwalPraktikumController::class, 'storeKoordinatorSignature']);
});

// Route untuk praktikum koordinator pending signature
Route::middleware('auth:sanctum')->prefix('praktikum')->group(function () {
    Route::get('/koordinator-pending-signature/{dosenId}', [App\Http\Controllers\JadwalPraktikumController::class, 'getKoordinatorPendingSignature']);
});

Route::middleware('auth:sanctum')->prefix('jurnal-reading')->group(function () {
    Route::get('/jadwal/{kode}', [App\Http\Controllers\JadwalJurnalReadingController::class, 'index']);
    Route::post('/jadwal/{kode}', [App\Http\Controllers\JadwalJurnalReadingController::class, 'store']);
    Route::post('/jadwal/{kode}/import', [App\Http\Controllers\JadwalJurnalReadingController::class, 'importExcel']);
    Route::put('/jadwal/{kode}/{id}', [App\Http\Controllers\JadwalJurnalReadingController::class, 'update']);
    Route::delete('/jadwal/{kode}/{id}', [App\Http\Controllers\JadwalJurnalReadingController::class, 'destroy']);
});

// Route download tanpa auth untuk memudahkan akses file
Route::get('/jurnal-reading/download/{kode}/{id}', [App\Http\Controllers\JadwalJurnalReadingController::class, 'downloadFile'])->name('jurnal.download');

Route::middleware('auth:sanctum')->prefix('persamaan-persepsi')->group(function () {
    Route::get('/jadwal/{kode}', [App\Http\Controllers\JadwalPersamaanPersepsiController::class, 'index']);
    Route::post('/jadwal/{kode}', [App\Http\Controllers\JadwalPersamaanPersepsiController::class, 'store']);
    Route::post('/jadwal/{kode}/import', [App\Http\Controllers\JadwalPersamaanPersepsiController::class, 'import']);
    Route::put('/jadwal/{kode}/{id}', [App\Http\Controllers\JadwalPersamaanPersepsiController::class, 'update']);
    Route::delete('/jadwal/{kode}/{id}', [App\Http\Controllers\JadwalPersamaanPersepsiController::class, 'destroy']);
});

// Jadwal Persamaan Persepsi untuk dosen
Route::middleware('auth:sanctum')->get('/jadwal-persamaan-persepsi/dosen/{dosenId}', [App\Http\Controllers\JadwalPersamaanPersepsiController::class, 'getJadwalForDosen']);
Route::middleware('auth:sanctum')->put('/jadwal-persamaan-persepsi/{id}/konfirmasi', [App\Http\Controllers\JadwalPersamaanPersepsiController::class, 'konfirmasi']);
Route::middleware('auth:sanctum')->post('/jadwal-persamaan-persepsi/{id}/reschedule', [App\Http\Controllers\JadwalPersamaanPersepsiController::class, 'reschedule']);

// Routes untuk absensi Persamaan Persepsi
Route::middleware('auth:sanctum')->prefix('persamaan-persepsi')->group(function () {
    Route::get('/{kode}/jadwal/{jadwalId}/absensi', [App\Http\Controllers\JadwalPersamaanPersepsiController::class, 'getAbsensi']);
    Route::post('/{kode}/jadwal/{jadwalId}/absensi', [App\Http\Controllers\JadwalPersamaanPersepsiController::class, 'storeAbsensi']);
});

Route::middleware('auth:sanctum')->prefix('seminar-pleno')->group(function () {
    Route::get('/jadwal/{kode}', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'index']);
    Route::post('/jadwal/{kode}', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'store']);
    Route::post('/jadwal/{kode}/import', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'import']);
    Route::post('/jadwal/{kode}/validate-preview', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'validatePreview']);
    Route::put('/jadwal/{kode}/{id}', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'update']);
    Route::delete('/jadwal/{kode}/{id}', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'destroy']);
});

// Jadwal Seminar Pleno untuk dosen
Route::middleware('auth:sanctum')->get('/jadwal-seminar-pleno/dosen/{dosenId}', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'getJadwalForDosen']);
Route::middleware('auth:sanctum')->put('/jadwal-seminar-pleno/{id}/konfirmasi', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'konfirmasi']);
Route::middleware('auth:sanctum')->post('/jadwal-seminar-pleno/{id}/reschedule', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'reschedule']);

// Routes untuk absensi Seminar Pleno
Route::middleware('auth:sanctum')->prefix('seminar-pleno')->group(function () {
    Route::get('/{kode}/jadwal/{jadwalId}/absensi', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'getAbsensi']);
    Route::post('/{kode}/jadwal/{jadwalId}/absensi', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'storeAbsensi']);
    Route::get('/{kode}/jadwal/{jadwalId}/mahasiswa', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'getMahasiswa']);
    Route::get('/{kode}/jadwal/{jadwalId}/qr-token', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'generateQrToken']);
    Route::put('/{kode}/jadwal/{jadwalId}/toggle-qr', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'toggleQr']);
    // Routes untuk absensi dosen (hanya koordinator)
    Route::get('/{kode}/jadwal/{jadwalId}/absensi-dosen', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'getAbsensiDosen']);
    Route::post('/{kode}/jadwal/{jadwalId}/absensi-dosen', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'storeAbsensiDosen']);
});


// Reference data endpoints untuk CSR
Route::middleware('auth:sanctum')->get('/dosen-options', [JadwalCSRController::class, 'getDosenOptions']);
Route::middleware('auth:sanctum')->get('/ruangan-options', [JadwalCSRController::class, 'getRuanganOptions']);
Route::middleware('auth:sanctum')->get('/kelompok-options', [JadwalCSRController::class, 'getKelompokOptions']);
Route::middleware('auth:sanctum')->get('/kategori-options', [JadwalCSRController::class, 'getKategoriOptions']);
Route::middleware('auth:sanctum')->get('/jam-options', [JadwalCSRController::class, 'getJamOptions']);

// Reference data endpoints untuk Non-Blok Non-CSR
Route::middleware('auth:sanctum')->get('/non-blok-non-csr-dosen-options', [JadwalNonBlokNonCSRController::class, 'getDosenOptions']);
Route::middleware('auth:sanctum')->get('/non-blok-non-csr-ruangan-options', [JadwalNonBlokNonCSRController::class, 'getRuanganOptions']);
Route::middleware('auth:sanctum')->get('/non-blok-non-csr-jam-options', [JadwalNonBlokNonCSRController::class, 'getJamOptions']);

// Jadwal CSR routes (dalam prefix untuk menghindari konflik)
Route::middleware('auth:sanctum')->prefix('csr')->group(function () {
    Route::get('/jadwal/{kode}', [JadwalCSRController::class, 'index']);
    Route::post('/jadwal/{kode}', [JadwalCSRController::class, 'store']);
    Route::post('/jadwal/{kode}/import', [JadwalCSRController::class, 'importExcel']);
    Route::put('/jadwal/{kode}/{id}', [JadwalCSRController::class, 'update']);
    Route::delete('/jadwal/{kode}/{id}', [JadwalCSRController::class, 'destroy']);

    // Routes untuk absensi CSR
    Route::get('/{kode}/jadwal/{jadwalId}/absensi', [JadwalCSRController::class, 'getAbsensi']);
    Route::post('/{kode}/jadwal/{jadwalId}/absensi', [JadwalCSRController::class, 'storeAbsensi']);
});

// Batch endpoint untuk DetailNonBlokCSR page optimization
Route::middleware('auth:sanctum')->get('/csr/{kode}/batch-data', [App\Http\Controllers\DetailNonBlokCSRController::class, 'getBatchData']);

// Batch endpoint untuk DetailNonBlokNonCSR page optimization
Route::middleware('auth:sanctum')->get('/non-blok-non-csr/{kode}/batch-data', [App\Http\Controllers\DetailNonBlokNonCSRController::class, 'getBatchData']);

// Batch endpoint untuk CSR page optimization
Route::middleware('auth:sanctum')->get('/csr-batch-data', [App\Http\Controllers\CSRBatchController::class, 'getBatchData']);

// Batch endpoint untuk CSRDetail page optimization
Route::middleware('auth:sanctum')->get('/csr-detail/{csrId}/batch-data', [App\Http\Controllers\CSRDetailBatchController::class, 'getBatchData']);

Route::middleware('auth:sanctum')->prefix('non-blok-non-csr')->group(function () {
    Route::get('/jadwal/{kode}', [JadwalNonBlokNonCSRController::class, 'index']);
    Route::post('/jadwal/{kode}', [JadwalNonBlokNonCSRController::class, 'store']);
    Route::post('/jadwal/{kode}/import', [JadwalNonBlokNonCSRController::class, 'importExcel']);
    Route::put('/jadwal/{kode}/{id}', [JadwalNonBlokNonCSRController::class, 'update']);
    Route::delete('/jadwal/{kode}/{id}', [JadwalNonBlokNonCSRController::class, 'destroy']);
    Route::get('/kelompok-besar', [JadwalNonBlokNonCSRController::class, 'kelompokBesar']);

    // Routes untuk absensi non-blok non-CSR
    Route::get('/{kode}/jadwal/{jadwalId}/absensi', [JadwalNonBlokNonCSRController::class, 'getAbsensi']);
    Route::post('/{kode}/jadwal/{jadwalId}/absensi', [JadwalNonBlokNonCSRController::class, 'saveAbsensi']);
    Route::put('/{kode}/jadwal/{jadwalId}/toggle-qr', [JadwalNonBlokNonCSRController::class, 'toggleQr']);
    Route::get('/{kode}/jadwal/{jadwalId}/qr-token', [JadwalNonBlokNonCSRController::class, 'generateQrToken']);
});

// Jadwal Harian routes
Route::middleware('auth:sanctum')->prefix('jadwal-harian')->group(function () {
    Route::get('/', [App\Http\Controllers\JadwalHarianController::class, 'index']);
    Route::get('/mata-kuliah/{kode}', [App\Http\Controllers\JadwalHarianController::class, 'getByMataKuliah']);
});

// Routes untuk penilaian jurnal
Route::middleware('auth:sanctum')->prefix('penilaian-jurnal')->group(function () {
    Route::get('/{kode_blok}/{kelompok}/{jurnal_id}', [App\Http\Controllers\PenilaianJurnalController::class, 'index']);
    Route::post('/{kode_blok}/{kelompok}/{jurnal_id}', [App\Http\Controllers\PenilaianJurnalController::class, 'store']);
    Route::get('/{kode_blok}/{kelompok}/{jurnal_id}/export', [App\Http\Controllers\PenilaianJurnalController::class, 'export']);
    Route::get('/{kode_blok}/{kelompok}/{jurnal_id}/absensi', [App\Http\Controllers\PenilaianJurnalController::class, 'getAbsensiReguler']);
    Route::post('/{kode_blok}/{kelompok}/{jurnal_id}/absensi', [App\Http\Controllers\PenilaianJurnalController::class, 'storeAbsensiReguler']);
});

// Routes untuk penilaian jurnal antara
Route::middleware('auth:sanctum')->prefix('penilaian-jurnal-antara')->group(function () {
    Route::get('/{kode_blok}/{kelompok}/{jurnal_id}', [App\Http\Controllers\PenilaianJurnalController::class, 'indexAntara']);
    Route::post('/{kode_blok}/{kelompok}/{jurnal_id}', [App\Http\Controllers\PenilaianJurnalController::class, 'storeAntara']);
    Route::get('/{kode_blok}/{kelompok}/{jurnal_id}/export', [App\Http\Controllers\PenilaianJurnalController::class, 'exportAntara']);
    Route::get('/{kode_blok}/{kelompok}/{jurnal_id}/absensi', [App\Http\Controllers\PenilaianJurnalController::class, 'getAbsensi']);
    Route::post('/{kode_blok}/{kelompok}/{jurnal_id}/absensi', [App\Http\Controllers\PenilaianJurnalController::class, 'storeAbsensi']);
});

// Routes untuk dashboard super admin
Route::middleware(['auth:sanctum', 'role:super_admin'])->prefix('dashboard/super-admin')->group(function () {
    Route::get('/', [App\Http\Controllers\DashboardSuperAdminController::class, 'index']);
    Route::get('/user-stats', [App\Http\Controllers\DashboardSuperAdminController::class, 'getUserStats']);
    Route::get('/schedule-stats', [App\Http\Controllers\DashboardSuperAdminController::class, 'getScheduleStats']);
    Route::get('/monthly-user-stats', [App\Http\Controllers\DashboardSuperAdminController::class, 'getMonthlyUserStats']);
    Route::get('/system-metrics', [App\Http\Controllers\DashboardSuperAdminController::class, 'getSystemMetrics']);
});

// Routes untuk dashboard tim akademik
Route::middleware(['auth:sanctum', 'role:tim_akademik'])->prefix('dashboard-tim-akademik')->group(function () {
    Route::get('/', [App\Http\Controllers\DashboardTimAkademikController::class, 'index']);
    Route::get('/attendance-by-mata-kuliah', [App\Http\Controllers\DashboardTimAkademikController::class, 'getAttendanceByMataKuliah']);
    Route::get('/assessment-progress', [App\Http\Controllers\DashboardTimAkademikController::class, 'getAssessmentProgress']);
});

// Routes untuk system backup dan import
Route::middleware(['auth:sanctum', 'role:super_admin'])->prefix('system')->group(function () {
    Route::post('/backup', [App\Http\Controllers\SystemBackupController::class, 'createBackup']);
    Route::get('/backups', [App\Http\Controllers\SystemBackupController::class, 'getBackups']);
    Route::post('/import', [App\Http\Controllers\SystemBackupController::class, 'importBackup']);
    Route::get('/backup/{filename}/download', [App\Http\Controllers\SystemBackupController::class, 'downloadBackup']);
    Route::delete('/backup/{filename}', [App\Http\Controllers\SystemBackupController::class, 'deleteBackup']);
    Route::post('/reset', [App\Http\Controllers\SystemBackupController::class, 'resetSystem']);
});

// Routes untuk export reports
Route::middleware(['auth:sanctum', 'role:super_admin'])->prefix('reports')->group(function () {
    Route::post('/export/attendance', [App\Http\Controllers\ReportController::class, 'exportAttendance']);
    Route::post('/export/assessment', [App\Http\Controllers\ReportController::class, 'exportAssessment']);
    Route::get('/mata-kuliah-absensi', [App\Http\Controllers\ReportController::class, 'getMataKuliahWithAbsensi']);
    Route::get('/mata-kuliah-penilaian', [App\Http\Controllers\ReportController::class, 'getMataKuliahWithPenilaian']);
    // Alias routes untuk kompatibilitas
    Route::get('/mata-kuliah-with-absensi', [App\Http\Controllers\ReportController::class, 'getMataKuliahWithAbsensi']);
    Route::get('/mata-kuliah-with-penilaian', [App\Http\Controllers\ReportController::class, 'getMataKuliahWithPenilaian']);
});


// Forum Diskusi Routes
Route::prefix('forum')->group(function () {
    // Categories tanpa auth untuk testing
    Route::get('/categories', [ForumController::class, 'getCategories']);

    // Forums CRUD dengan auth
    Route::middleware('auth:sanctum')->group(function () {
        Route::get('/categories/{categorySlug}/forums', [ForumController::class, 'getForumsByCategory']);
        Route::get('/', [ForumController::class, 'index']);
        Route::post('/', [ForumController::class, 'store']);
        Route::put('/{id}', [ForumController::class, 'update']);
        Route::delete('/{id}', [ForumController::class, 'destroy']);
        Route::post('/{id}/like', [ForumController::class, 'toggleLike']);

        // Forum Replies
        Route::post('/{forumId}/replies', [ForumController::class, 'storeReply']);
        Route::put('/replies/{replyId}', [ForumController::class, 'updateReply']);
        Route::delete('/replies/{replyId}', [ForumController::class, 'deleteReply']);
        Route::post('/replies/{replyId}/like', [ForumController::class, 'toggleReplyLike']);

        // Bookmark Routes
        Route::post('/replies/{replyId}/bookmark', [ForumController::class, 'toggleBookmark']);
        Route::get('/replies/{replyId}/bookmark-status', [ForumController::class, 'checkBookmarkStatus']);
        Route::get('/bookmarks', [ForumController::class, 'getUserBookmarks']);

        // Forum bookmarks
        Route::post('/{forumId}/bookmark', [ForumController::class, 'toggleForumBookmark']);
        Route::get('/bookmarks/forums', [ForumController::class, 'getUserForumBookmarks']);
        Route::get('/bookmarks/forums/simple', [ForumController::class, 'getUserForumBookmarksSimple']);
        Route::get('/{id}/viewers', [ForumController::class, 'getForumViewers']);
    });

    // Forum detail tanpa auth agar bisa diakses tanpa login
    Route::get('/{slug}', [ForumController::class, 'show']);


    // Categories CRUD dengan auth (hanya Super Admin & Tim Akademik)
    Route::middleware('auth:sanctum')->group(function () {
        Route::post('/categories', [ForumController::class, 'storeCategory']);
        Route::put('/categories/{id}', [ForumController::class, 'updateCategory']);
        Route::delete('/categories/{id}', [ForumController::class, 'destroyCategory']);
    });
});

// Support Center Routes
Route::prefix('support-center')->group(function () {
    // Public routes (no auth required for form submissions)
    Route::post('/bug-report', [SupportCenterController::class, 'submitBugReport']);
    Route::post('/feature-request', [SupportCenterController::class, 'submitFeatureRequest']);
    Route::post('/contact', [SupportCenterController::class, 'submitContact']);

    // Protected routes (auth required)
    Route::middleware('auth:sanctum')->group(function () {
        // Get developers (all users can view)
        Route::get('/developers', [SupportCenterController::class, 'getDevelopers']);
        Route::get('/developers/{id}', [SupportCenterController::class, 'getDeveloper']);

        // CRUD developers (Super Admin only)
        Route::post('/developers', [SupportCenterController::class, 'store']);
        Route::put('/developers/{id}', [SupportCenterController::class, 'update']);
        Route::delete('/developers/{id}', [SupportCenterController::class, 'destroy']);

        // Ticket management
        Route::get('/all-tickets', [TicketController::class, 'allTickets']);
        Route::get('/tickets', [TicketController::class, 'index']);
        Route::get('/tickets/{id}', [TicketController::class, 'show']);
        Route::post('/tickets', [TicketController::class, 'store']);
        Route::put('/tickets/{id}/status', [TicketController::class, 'updateStatus']);
        Route::post('/tickets/{id}/rate', [TicketController::class, 'rate']);

        // Metrics and analytics
        Route::get('/metrics', [MetricsController::class, 'index']);
        Route::get('/metrics/ticket-stats', [MetricsController::class, 'ticketStats']);
        Route::get('/metrics/priority-stats', [MetricsController::class, 'priorityStats']);
        Route::get('/metrics/developer-workload', [MetricsController::class, 'developerWorkload']);
        Route::get('/metrics/monthly-trends', [MetricsController::class, 'monthlyTrends']);

        // Knowledge Base
        Route::get('/knowledge', [KnowledgeController::class, 'index']);
        Route::get('/knowledge/all', [KnowledgeController::class, 'all']);
        Route::post('/knowledge', [KnowledgeController::class, 'store']);
        Route::post('/knowledge/{id}', [KnowledgeController::class, 'update']);
        Route::delete('/knowledge/{id}', [KnowledgeController::class, 'destroy']);
    });
});

// Mahasiswa Veteran Routes (Super Admin & Tim Akademik)
Route::middleware(['auth:sanctum', 'validate.token', 'role:super_admin,tim_akademik'])->prefix('mahasiswa-veteran')->group(function () {
    Route::get('/', [App\Http\Controllers\MahasiswaVeteranController::class, 'index']);
    Route::post('/toggle', [App\Http\Controllers\MahasiswaVeteranController::class, 'toggleVeteran']);
    Route::post('/bulk-toggle', [App\Http\Controllers\MahasiswaVeteranController::class, 'bulkToggleVeteran']);
    Route::post('/toggle-multi-veteran', [App\Http\Controllers\MahasiswaVeteranController::class, 'toggleMultiVeteran']);
    Route::post('/add-to-semester', [App\Http\Controllers\MahasiswaVeteranController::class, 'addVeteranToSemester']);
    Route::post('/remove-from-semester', [App\Http\Controllers\MahasiswaVeteranController::class, 'removeVeteranFromSemester']);
    Route::post('/release-from-semester', [App\Http\Controllers\MahasiswaVeteranController::class, 'releaseFromSemester']);
    Route::get('/statistics', [App\Http\Controllers\MahasiswaVeteranController::class, 'statistics']);
});

// Admin Management Routes (Super Admin only)
Route::middleware(['auth:sanctum', 'role:super_admin'])->prefix('admin')->group(function () {
    Route::post('/create-super-admin', [AdminController::class, 'createSuperAdmin']);
    Route::get('/super-admins', [AdminController::class, 'getSuperAdmins']);
    Route::put('/super-admins/{id}', [AdminController::class, 'updateSuperAdmin']);
    Route::delete('/super-admins/{id}', [AdminController::class, 'deleteSuperAdmin']);
});

// Mahasiswa Dashboard Routes
Route::middleware(['auth:sanctum', 'role:mahasiswa'])->group(function () {
    Route::get('/mahasiswa/{id}/profil-akademik', [MahasiswaController::class, 'getProfilAkademik']);
    Route::get('/jadwal/mahasiswa/{id}/today', [MahasiswaController::class, 'getJadwalHariIni']);
    Route::get('/jadwal/mahasiswa/{id}/upcoming', [MahasiswaController::class, 'getJadwalMendatang']);
    Route::get('/mahasiswa/{id}/attendance-summary', [MahasiswaController::class, 'getAttendanceSummary']);
    Route::get('/mahasiswa/{id}/score-summary', [MahasiswaController::class, 'getScoreSummary']);

    // Jadwal routes for mahasiswa
    Route::get('/jadwal-pbl/mahasiswa/{id}', [JadwalPBLController::class, 'getJadwalForMahasiswa']);
    Route::get('/jadwal-kuliah-besar/mahasiswa/{id}', [JadwalKuliahBesarController::class, 'getJadwalForMahasiswa']);
    Route::get('/jadwal-praktikum/mahasiswa/{id}', [JadwalPraktikumController::class, 'getJadwalForMahasiswa']);
    Route::get('/jadwal-jurnal-reading/mahasiswa/{id}', [JadwalJurnalReadingController::class, 'getJadwalForMahasiswa']);
    Route::get('/jadwal-csr/mahasiswa/{id}', [JadwalCSRController::class, 'getJadwalForMahasiswa']);
    Route::get('/jadwal-non-blok-non-csr/mahasiswa/{id}', [JadwalNonBlokNonCSRController::class, 'getJadwalForMahasiswa']);
    Route::get('/jadwal-agenda-besar/mahasiswa/{id}', [App\Http\Controllers\JadwalAgendaKhususController::class, 'getJadwalForMahasiswa']);
    Route::get('/jadwal-seminar-pleno/mahasiswa/{id}', [App\Http\Controllers\JadwalSeminarPlenoController::class, 'getJadwalForMahasiswa']);

    // Keabsenan routes for mahasiswa
    Route::get('/keabsenan-mahasiswa/{id}', [App\Http\Controllers\MahasiswaKeabsenanController::class, 'getKeabsenanMahasiswa']);
});

// Email verification routes
Route::middleware('auth:sanctum')->group(function () {
    Route::get('/users/{id}/email-status', [UserController::class, 'getEmailStatus']);
    Route::put('/users/{id}/verify-email', [UserController::class, 'verifyEmail']);
});

// Report routes untuk export Excel
Route::get('/report/export-excel-non-blok', [App\Http\Controllers\ReportController::class, 'exportExcelNonBlok']);

// WhatsApp routes
Route::middleware(['auth:sanctum', 'validate.token'])->group(function () {
    Route::post('/whatsapp/send', [WhatsAppController::class, 'sendMessage']);
    Route::get('/whatsapp/logs', [WhatsAppController::class, 'getLogs']);
    Route::post('/whatsapp/test', [WhatsAppController::class, 'testConnection']);
    Route::get('/whatsapp/test', [WhatsAppController::class, 'testConnection']); // GET juga untuk mudah di-test dari browser
    Route::get('/whatsapp/device', [WhatsAppController::class, 'checkDevice']); // Cek status device
    Route::get('/whatsapp/report', [WhatsAppController::class, 'getReport']); // Laporan pesan
    Route::get('/whatsapp/report-realtime', [WhatsAppController::class, 'getReportRealtime']); // Laporan realtime
    Route::get('/whatsapp/contacts', [WhatsAppController::class, 'getContacts']); // List contact
    Route::get('/whatsapp/settings', [WhatsAppController::class, 'getSettings']); // Get settings
    Route::put('/whatsapp/settings', [WhatsAppController::class, 'updateSettings']); // Update settings
});

    // Webhook untuk Wablas (tidak perlu auth karena dari external service)
    Route::post('/whatsapp/webhook', [WhatsAppController::class, 'webhook']);
}); // End of throttle middleware group
