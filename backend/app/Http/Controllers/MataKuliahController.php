<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\MataKuliah;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\Log;

class MataKuliahController extends Controller
{
    /**
     * Check if dosen has permission for specific role in mata kuliah
     */
    private function checkDosenPermission($dosenId, $kodeMataKuliah, $requiredRoles)
    {
        // Convert single role to array for consistency
        if (!is_array($requiredRoles)) {
            $requiredRoles = [$requiredRoles];
        }

        // Check if dosen has any of the required roles for this mata kuliah
        $hasPermission = DB::table('dosen_peran')
            ->where('user_id', $dosenId)
            ->where('mata_kuliah_kode', $kodeMataKuliah)
            ->whereIn('tipe_peran', $requiredRoles)
            ->exists();

        return $hasPermission;
    }

    /**
     * Get dosen permissions for specific mata kuliah
     */
    public function getDosenPermissions(Request $request, $kode)
    {
        $user = $request->user();
        $dosenId = $user->id ?? $user['id'] ?? null;

        if (!$dosenId) {
            return response()->json(['error' => 'User not authenticated'], 401);
        }

        // Get dosen roles for this mata kuliah
        $permissions = DB::table('dosen_peran')
            ->where('user_id', $dosenId)
            ->where('mata_kuliah_kode', $kode)
            ->select('tipe_peran', 'peran_kurikulum', 'blok', 'semester')
            ->get();

        $canUploadRps = $permissions->contains('tipe_peran', 'koordinator');
        $canUploadMateri = $permissions->whereIn('tipe_peran', ['koordinator', 'tim_blok'])->isNotEmpty();

        return response()->json([
            'permissions' => $permissions,
            'can_upload_rps' => $canUploadRps,
            'can_upload_materi' => $canUploadMateri,
            'roles' => $permissions->pluck('tipe_peran')->unique()->values()
        ]);
    }
    /**
     * Upload RPS file untuk mata kuliah
     */
    public function uploadRps(Request $request)
    {
        $request->validate([
            'rps_file' => 'required|file|mimes:pdf,doc,docx,xlsx,xls|max:20480', // 20MB max
            'kode' => 'required|string|exists:mata_kuliah,kode',
        ], [
            'rps_file.max' => 'Ukuran file RPS maksimal 20MB. Silakan kompres file atau gunakan format yang lebih kecil.',
            'rps_file.mimes' => 'File RPS harus berupa PDF, DOC, DOCX, XLSX, atau XLS.',
        ]);

        $user = $request->user();
        $dosenId = $user->id ?? $user['id'] ?? null;
        $kode = $request->input('kode');

        if (!$dosenId) {
            return response()->json(['error' => 'User not authenticated'], 401);
        }

        // Validasi permission: hanya koordinator yang bisa upload RPS
        $mataKuliah = MataKuliah::findOrFail($kode);
        $hasPermission = $this->checkDosenPermission($dosenId, $kode, 'koordinator');

        if (!$hasPermission) {
            return response()->json([
                'error' => 'Anda tidak memiliki permission untuk mengupload RPS. Hanya koordinator yang diperbolehkan.'
            ], 403);
        }

        $file = $request->file('rps_file');

        // Generate unique filename
        $filename = $kode . '_' . time() . '_' . $file->getClientOriginalName();

        // Store file in storage/app/public/rps
        $path = Storage::disk('public')->putFileAs('rps', $file, $filename);

        // Update database
        $mataKuliah->update(['rps_file' => $filename]);

        return response()->json([
            'filename' => $filename,
            'message' => 'RPS file berhasil diupload'
        ]);
    }

    /**
     * Download RPS file untuk mata kuliah
     */
    public function downloadRps($kode)
    {
        $mataKuliah = MataKuliah::findOrFail($kode);

        if (!$mataKuliah->rps_file) {
            return response()->json(['error' => 'File RPS tidak ditemukan'], 404);
        }

        $filePath = 'rps/' . $mataKuliah->rps_file;

        if (!Storage::disk('public')->exists($filePath)) {
            return response()->json(['error' => 'File RPS tidak ditemukan di storage'], 404);
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk('public');
        return $disk->download($filePath, $mataKuliah->rps_file);
    }

    /**
     * Delete RPS file untuk mata kuliah
     */
    public function deleteRps($kode)
    {
        $mataKuliah = MataKuliah::findOrFail($kode);

        if (!$mataKuliah->rps_file) {
            return response()->json(['error' => 'File RPS tidak ditemukan'], 404);
        }

        $filePath = 'rps/' . $mataKuliah->rps_file;

        // Delete file from storage
        if (Storage::disk('public')->exists($filePath)) {
            Storage::disk('public')->delete($filePath);
        }

        // Update database
        $mataKuliah->update(['rps_file' => null]);

        return response()->json([
            'message' => 'RPS file berhasil dihapus'
        ]);
    }

    /**
     * Upload materi file untuk mata kuliah
     */
    public function uploadMateri(Request $request)
    {
        $request->validate([
            'materi_file' => 'required|file|mimes:pdf,doc,docx,xlsx,xls,ppt,pptx,txt,jpg,jpeg,png,gif,mp4,mp3,wav,zip,rar|max:30720', // 30MB max
            'kode' => 'required|string|exists:mata_kuliah,kode',
            'judul' => 'required|string|max:255',
        ], [
            'materi_file.max' => 'Ukuran file materi maksimal 30MB. Silakan kompres file atau gunakan format yang lebih kecil.',
            'materi_file.mimes' => 'File materi harus berupa PDF, DOC, DOCX, XLSX, XLS, PPT, PPTX, TXT, JPG, JPEG, PNG, GIF, MP4, MP3, WAV, ZIP, atau RAR.',
        ]);

        $user = $request->user();
        $dosenId = $user->id ?? $user['id'] ?? null;
        $kode = $request->input('kode');

        if (!$dosenId) {
            return response()->json(['error' => 'User not authenticated'], 401);
        }

        // Validasi permission: koordinator atau tim_blok bisa upload materi
        $mataKuliah = MataKuliah::findOrFail($kode);
        $hasPermission = $this->checkDosenPermission($dosenId, $kode, ['koordinator', 'tim_blok']);

        if (!$hasPermission) {
            return response()->json([
                'error' => 'Anda tidak memiliki permission untuk mengupload materi. Hanya koordinator atau tim blok yang diperbolehkan.'
            ], 403);
        }

        $file = $request->file('materi_file');
        $judul = $request->input('judul');

        // Generate unique filename
        $filename = $kode . '_' . time() . '_' . $file->getClientOriginalName();

        // Store file in storage/app/public/materi/{kode}
        $path = Storage::disk('public')->putFileAs('materi/' . $kode, $file, $filename);

        // Get file info
        $fileType = $file->getClientOriginalExtension();
        $fileSize = $file->getSize();
        $filePath = $path;

        // Insert ke tabel materi_pembelajaran
        DB::table('materi_pembelajaran')->insert([
            'kode_mata_kuliah' => $kode,
            'filename' => $filename,
            'judul' => $judul,
            'file_type' => $fileType,
            'file_size' => $fileSize,
            'file_path' => $filePath,
            'upload_date' => now(),
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Materi berhasil diupload',
            'data' => [
                'filename' => $filename,
                'judul' => $judul
            ]
        ]);
    }

    /**
     * Download materi file untuk mata kuliah
     */
    public function downloadMateri(Request $request, $kode)
    {
        $request->validate([
            'filename' => 'required|string',
        ]);

        $filename = $request->input('filename');

        // Cari materi di database
        $materi = DB::table('materi_pembelajaran')
            ->where('kode_mata_kuliah', $kode)
            ->where('filename', $filename)
            ->first();

        if (!$materi) {
            return response()->json(['error' => 'File materi tidak ditemukan'], 404);
        }

        $filePath = $materi->file_path;

        // Gunakan disk public untuk mencari file
        if (!Storage::disk('public')->exists($filePath)) {
            return response()->json(['error' => 'File materi tidak ditemukan di storage'], 404);
        }

        /** @var \Illuminate\Filesystem\FilesystemAdapter $disk */
        $disk = Storage::disk('public');
        return $disk->download($filePath, $materi->judul . '.' . $materi->file_type);
    }

    /**
     * Delete materi file untuk mata kuliah
     */
    public function deleteMateri(Request $request, $kode)
    {
        try {
            $filename = $request->input('filename');

            // Get materi info
            $materi = DB::table('materi_pembelajaran')
                ->where('kode_mata_kuliah', $kode)
                ->where('filename', $filename)
                ->first();

            if (!$materi) {
                return response()->json(['error' => 'Materi tidak ditemukan'], 404);
            }

            // Delete file from storage
            if (Storage::disk('public')->exists($materi->file_path)) {
                Storage::disk('public')->delete($materi->file_path);
            }

            // Delete record from database
            DB::table('materi_pembelajaran')
                ->where('id', $materi->id)
                ->delete();

            return response()->json(['message' => 'Materi berhasil dihapus']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Gagal menghapus materi: ' . $e->getMessage()], 500);
        }
    }

    public function updateMateriJudul(Request $request, $kode)
    {
        try {
            $filename = $request->input('filename');
            $judul = $request->input('judul');

            // Update judul materi
            DB::table('materi_pembelajaran')
                ->where('kode_mata_kuliah', $kode)
                ->where('filename', $filename)
                ->update(['judul' => $judul]);

            return response()->json(['message' => 'Judul materi berhasil diupdate']);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Gagal mengupdate judul materi: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Get materi untuk mata kuliah tertentu
     */
    public function getMateri($kode)
    {
        $materi = DB::table('materi_pembelajaran')
            ->where('kode_mata_kuliah', $kode)
            ->orderBy('upload_date', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'data' => $materi
        ]);
    }

    /**
     * Update keahlian required untuk mata kuliah
     */
    public function updateKeahlian(Request $request, $kode)
    {
        $validated = $request->validate([
            'keahlian_required' => 'required|array',
            'keahlian_required.*' => 'string',
        ]);

        $mataKuliah = MataKuliah::findOrFail($kode);

        $mataKuliah->update([
            'keahlian_required' => $validated['keahlian_required']
        ]);

        return response()->json($mataKuliah);
    }

    /**
     * Get keahlian required untuk mata kuliah
     */
    public function getKeahlian($kode)
    {
        $mataKuliah = MataKuliah::findOrFail($kode);
        return response()->json([
            'keahlian_required' => $mataKuliah->keahlian_required
        ]);
    }

    /**
     * Get semua mata kuliah dengan keahlian untuk semester tertentu
     */
    public function getBySemester($semester)
    {
        $mataKuliah = MataKuliah::where('semester', $semester)
            ->where('jenis', 'Blok')
            ->get(['kode', 'nama', 'semester', 'blok', 'periode', 'keahlian_required']);

        return response()->json($mataKuliah);
    }

    /**
     * Ambil seluruh daftar peran_dalam_kurikulum unik dari semua mata kuliah
     */
    public function peranKurikulumOptions()
    {
        $all = MataKuliah::pluck('peran_dalam_kurikulum')->filter()->flatten()->unique()->values();
        return response()->json($all);
    }

    /**
     * Ambil seluruh daftar keahlian unik dari semua mata kuliah
     */
    public function keahlianOptions()
    {
        $all = MataKuliah::pluck('keahlian_required')->filter()->flatten()->unique()->values();
        return response()->json($all);
    }

    /**
     * Update data mata kuliah
     */
    public function update(Request $request, $kode)
    {
        $mataKuliah = MataKuliah::findOrFail($kode);
        $data = $request->all();

        // Hapus field materi dari data yang akan disimpan ke tabel mata_kuliah
        unset($data['materi']);

        $data['keahlian_required'] = $request->input('keahlian_required', []);
        $data['peran_dalam_kurikulum'] = $request->input('peran_dalam_kurikulum', []);
        $mataKuliah->update($data);

        // Log activity
        activity()
            ->performedOn($mataKuliah)
            ->withProperties([
                'kode' => $mataKuliah->kode,
                'nama' => $mataKuliah->nama,
                'semester' => $mataKuliah->semester,
                'sks' => $mataKuliah->sks
            ])
            ->log("Mata Kuliah updated: {$mataKuliah->nama}");

        return response()->json($mataKuliah);
    }

    /**
     * Hapus data mata kuliah
     */
    public function destroy($kode)
    {
        $mataKuliah = MataKuliah::findOrFail($kode);

        // Log activity before deletion
        activity()
            ->performedOn($mataKuliah)
            ->withProperties([
                'kode' => $mataKuliah->kode,
                'nama' => $mataKuliah->nama,
                'semester' => $mataKuliah->semester,
                'sks' => $mataKuliah->sks
            ])
            ->log("Mata Kuliah deleted: {$mataKuliah->nama}");

        $mataKuliah->delete();
        return response()->json(['message' => 'Mata kuliah berhasil dihapus']);
    }

    /**
     * Simpan data mata kuliah baru
     */
    public function store(Request $request)
    {
        $data = $request->all();

        // Hapus field materi dari data yang akan disimpan ke tabel mata_kuliah
        unset($data['materi']);

        $data['keahlian_required'] = $request->input('keahlian_required', []);
        $data['peran_dalam_kurikulum'] = $request->input('peran_dalam_kurikulum', []);
        $mataKuliah = MataKuliah::create($data);

        // Log activity
        activity()
            ->performedOn($mataKuliah)
            ->withProperties([
                'kode' => $mataKuliah->kode,
                'nama' => $mataKuliah->nama,
                'semester' => $mataKuliah->semester,
                'sks' => $mataKuliah->sks
            ])
            ->log("Mata Kuliah created: {$mataKuliah->nama}");

        return response()->json($mataKuliah, 201);
    }

    /**
     * Menampilkan semua data mata kuliah
     */
    public function index()
    {
        $mataKuliah = MataKuliah::all();
        return response()->json($mataKuliah);
    }

    /**
     * Get mata kuliah yang terkait dengan dosen tertentu
     */
    public function getMataKuliahDosen(Request $request)
    {
        $user = $request->user();
        $dosenId = $user->id ?? $user['id'] ?? null;

        if (!$dosenId) {
            return response()->json(['error' => 'User not authenticated'], 401);
        }

        // Ambil mata kuliah dari DosenPeran (koordinator, tim_blok, dosen_mengajar)
        $mataKuliahFromPeran = MataKuliah::whereHas('dosenPeran', function($query) use ($dosenId) {
            $query->where('user_id', $dosenId);
        })->get();

        // Ambil mata kuliah dari jadwal mengajar (kuliah besar, praktikum, PBL, CSR, dll)
        $mataKuliahFromJadwal = collect();

        // Jadwal Kuliah Besar
        $kuliahBesar = DB::table('jadwal_kuliah_besar')
            ->join('mata_kuliah', 'jadwal_kuliah_besar.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_kuliah_besar.dosen_id', $dosenId)
            ->select('mata_kuliah.*')
            ->get();

        // Jadwal Praktikum
        $praktikum = DB::table('jadwal_praktikum')
            ->join('mata_kuliah', 'jadwal_praktikum.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->whereExists(function($query) use ($dosenId) {
                $query->select(DB::raw(1))
                    ->from('jadwal_praktikum_dosen')
                    ->whereRaw('jadwal_praktikum_dosen.jadwal_praktikum_id = jadwal_praktikum.id')
                    ->where('jadwal_praktikum_dosen.dosen_id', $dosenId);
            })
            ->select('mata_kuliah.*')
            ->get();

        // Jadwal PBL
        $pbl = DB::table('jadwal_pbl')
            ->join('mata_kuliah', 'jadwal_pbl.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_pbl.dosen_id', $dosenId)
            ->select('mata_kuliah.*')
            ->get();

        // Jadwal CSR
        $csr = DB::table('jadwal_csr')
            ->join('mata_kuliah', 'jadwal_csr.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_csr.dosen_id', $dosenId)
            ->select('mata_kuliah.*')
            ->get();

        // Jadwal Non Blok Non CSR
        $nonBlokNonCsr = DB::table('jadwal_non_blok_non_csr')
            ->join('mata_kuliah', 'jadwal_non_blok_non_csr.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_non_blok_non_csr.dosen_id', $dosenId)
            ->select('mata_kuliah.*')
            ->get();

        // Jadwal Jurnal Reading
        $jurnalReading = DB::table('jadwal_jurnal_reading')
            ->join('mata_kuliah', 'jadwal_jurnal_reading.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where('jadwal_jurnal_reading.dosen_id', $dosenId)
            ->select('mata_kuliah.*')
            ->get();

        // Gabungkan semua mata kuliah dari jadwal
        $mataKuliahFromJadwal = $mataKuliahFromJadwal
            ->merge($kuliahBesar)
            ->merge($praktikum)
            ->merge($pbl)
            ->merge($csr)
            ->merge($nonBlokNonCsr)
            ->merge($jurnalReading);

        // Gabungkan dengan mata kuliah dari peran dan hapus duplikat
        $allMataKuliah = $mataKuliahFromPeran->concat($mataKuliahFromJadwal);
        $uniqueMataKuliah = $allMataKuliah->unique('kode')->values();

        // Normalize data structure untuk memastikan konsistensi
        $normalizedMataKuliah = $uniqueMataKuliah->map(function($mk) use ($dosenId) {
            // Pastikan keahlian_required adalah array
            if (is_string($mk->keahlian_required)) {
                $mk->keahlian_required = json_decode($mk->keahlian_required, true) ?? [];
            }
            if (!is_array($mk->keahlian_required)) {
                $mk->keahlian_required = [];
            }

            // Pastikan peran_dalam_kurikulum adalah array
            if (is_string($mk->peran_dalam_kurikulum)) {
                $mk->peran_dalam_kurikulum = json_decode($mk->peran_dalam_kurikulum, true) ?? [];
            }
            if (!is_array($mk->peran_dalam_kurikulum)) {
                $mk->peran_dalam_kurikulum = [];
            }

            // Tambahkan informasi peran dosen untuk mata kuliah ini
            $dosenPeran = DB::table('dosen_peran')
                ->where('user_id', $dosenId)
                ->where('mata_kuliah_kode', $mk->kode)
                ->select('tipe_peran', 'peran_kurikulum', 'blok', 'semester')
                ->get();

            $mk->dosen_peran = $dosenPeran;
            $mk->can_upload_rps = $dosenPeran->contains('tipe_peran', 'koordinator');
            $mk->can_upload_materi = $dosenPeran->whereIn('tipe_peran', ['koordinator', 'tim_blok'])->isNotEmpty();

            return $mk;
        });

        return response()->json($normalizedMataKuliah);
    }

    /**
     * Get jadwal dosen untuk mata kuliah tertentu
     */
    public function getJadwalDosenMataKuliah(Request $request, $kode)
    {
        $user = $request->user();
        $dosenId = $user->id ?? $user['id'] ?? null;

        if (!$dosenId) {
            return response()->json(['error' => 'User not authenticated'], 401);
        }

        $mataKuliah = MataKuliah::findOrFail($kode);
        $result = [];

        // Selalu ambil jadwal kuliah besar
        $kuliahBesar = DB::table('jadwal_kuliah_besar')
            ->join('mata_kuliah', 'jadwal_kuliah_besar.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->leftJoin('users', 'jadwal_kuliah_besar.dosen_id', '=', 'users.id')
            ->leftJoin('ruangan', 'jadwal_kuliah_besar.ruangan_id', '=', 'ruangan.id')
            ->where('jadwal_kuliah_besar.dosen_id', $dosenId)
            ->where('mata_kuliah.kode', $kode)
            ->select(
                'jadwal_kuliah_besar.id',
                'jadwal_kuliah_besar.tanggal',
                'jadwal_kuliah_besar.jam_mulai',
                'jadwal_kuliah_besar.jam_selesai',
                'jadwal_kuliah_besar.materi',
                'jadwal_kuliah_besar.topik',
                'users.name as dosen_name',
                'ruangan.nama as ruangan_name',
                DB::raw('"Kelompok Besar" as kelompok_name'),
                'jadwal_kuliah_besar.status_konfirmasi'
            )
            ->get();

        $result['kuliah_besar'] = $kuliahBesar;

        // Ambil jadwal berdasarkan jenis mata kuliah
        if ($mataKuliah->jenis === "Blok") {
            // Jadwal PBL
            $pbl = DB::table('jadwal_pbl')
                ->join('mata_kuliah', 'jadwal_pbl.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                ->leftJoin('users', 'jadwal_pbl.dosen_id', '=', 'users.id')
                ->leftJoin('ruangan', 'jadwal_pbl.ruangan_id', '=', 'ruangan.id')
                ->leftJoin('kelompok_kecil', 'jadwal_pbl.kelompok_kecil_id', '=', 'kelompok_kecil.id')
                ->where('jadwal_pbl.dosen_id', $dosenId)
                ->where('mata_kuliah.kode', $kode)
                ->select(
                    'jadwal_pbl.id',
                    'jadwal_pbl.tanggal',
                    'jadwal_pbl.jam_mulai',
                    'jadwal_pbl.jam_selesai',
                    DB::raw('NULL as materi'),
                    DB::raw('NULL as topik'),
                    'users.name as dosen_name',
                    'ruangan.nama as ruangan_name',
                    'kelompok_kecil.nama_kelompok as kelompok_name',
                    'jadwal_pbl.status_konfirmasi'
                )
                ->get();

            // Jadwal Praktikum
            $praktikum = DB::table('jadwal_praktikum')
                ->join('mata_kuliah', 'jadwal_praktikum.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                ->leftJoin('ruangan', 'jadwal_praktikum.ruangan_id', '=', 'ruangan.id')
                ->whereExists(function($query) use ($dosenId) {
                    $query->select(DB::raw(1))
                        ->from('jadwal_praktikum_dosen')
                        ->whereRaw('jadwal_praktikum_dosen.jadwal_praktikum_id = jadwal_praktikum.id')
                        ->where('jadwal_praktikum_dosen.dosen_id', $dosenId);
                })
                ->where('mata_kuliah.kode', $kode)
                ->select(
                    'jadwal_praktikum.id',
                    'jadwal_praktikum.tanggal',
                    'jadwal_praktikum.jam_mulai',
                    'jadwal_praktikum.jam_selesai',
                    'jadwal_praktikum.materi',
                    'jadwal_praktikum.topik',
                    DB::raw('(SELECT GROUP_CONCAT(u.name) FROM users u JOIN jadwal_praktikum_dosen jpd ON u.id = jpd.dosen_id WHERE jpd.jadwal_praktikum_id = jadwal_praktikum.id) as dosen_name'),
                    'ruangan.nama as ruangan_name',
                    'jadwal_praktikum.kelas_praktikum as kelompok_name',
                    DB::raw('"confirmed" as status_konfirmasi')
                )
                ->get();

            // Jadwal Jurnal Reading
            $jurnalReading = DB::table('jadwal_jurnal_reading')
                ->join('mata_kuliah', 'jadwal_jurnal_reading.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                ->leftJoin('users', 'jadwal_jurnal_reading.dosen_id', '=', 'users.id')
                ->leftJoin('ruangan', 'jadwal_jurnal_reading.ruangan_id', '=', 'ruangan.id')
                ->leftJoin('kelompok_kecil', 'jadwal_jurnal_reading.kelompok_kecil_id', '=', 'kelompok_kecil.id')
                ->where('jadwal_jurnal_reading.dosen_id', $dosenId)
                ->where('mata_kuliah.kode', $kode)
                ->select(
                    'jadwal_jurnal_reading.id',
                    'jadwal_jurnal_reading.tanggal',
                    'jadwal_jurnal_reading.jam_mulai',
                    'jadwal_jurnal_reading.jam_selesai',
                    DB::raw('NULL as materi'),
                    'jadwal_jurnal_reading.topik',
                    'users.name as dosen_name',
                    'ruangan.nama as ruangan_name',
                    'kelompok_kecil.nama_kelompok as kelompok_name',
                    'jadwal_jurnal_reading.status_konfirmasi'
                )
                ->get();

            $result['pbl'] = $pbl;
            $result['praktikum'] = $praktikum;
            $result['jurnal_reading'] = $jurnalReading;

        } else if ($mataKuliah->tipe_non_block === "CSR") {
            // Jadwal CSR
            $csr = DB::table('jadwal_csr')
                ->join('mata_kuliah', 'jadwal_csr.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                ->leftJoin('users', 'jadwal_csr.dosen_id', '=', 'users.id')
                ->leftJoin('ruangan', 'jadwal_csr.ruangan_id', '=', 'ruangan.id')
                ->leftJoin('kelompok_kecil', 'jadwal_csr.kelompok_kecil_id', '=', 'kelompok_kecil.id')
                ->where('jadwal_csr.dosen_id', $dosenId)
                ->where('mata_kuliah.kode', $kode)
                ->select(
                    'jadwal_csr.id',
                    'jadwal_csr.tanggal',
                    'jadwal_csr.jam_mulai',
                    'jadwal_csr.jam_selesai',
                    DB::raw('NULL as materi'),
                    'jadwal_csr.topik',
                    'users.name as dosen_name',
                    'ruangan.nama as ruangan_name',
                    'kelompok_kecil.nama_kelompok as kelompok_name',
                    'jadwal_csr.status_konfirmasi'
                )
                ->get();

            $result['csr'] = $csr;

        } else if ($mataKuliah->tipe_non_block === "Non-CSR") {
            // Jadwal Non Blok Non CSR
            $nonBlokNonCsr = DB::table('jadwal_non_blok_non_csr')
                ->join('mata_kuliah', 'jadwal_non_blok_non_csr.mata_kuliah_kode', '=', 'mata_kuliah.kode')
                ->leftJoin('users', 'jadwal_non_blok_non_csr.dosen_id', '=', 'users.id')
                ->leftJoin('ruangan', 'jadwal_non_blok_non_csr.ruangan_id', '=', 'ruangan.id')
                ->where('jadwal_non_blok_non_csr.dosen_id', $dosenId)
                ->where('mata_kuliah.kode', $kode)
                ->select(
                    'jadwal_non_blok_non_csr.id',
                    'jadwal_non_blok_non_csr.tanggal',
                    'jadwal_non_blok_non_csr.jam_mulai',
                    'jadwal_non_blok_non_csr.jam_selesai',
                    'jadwal_non_blok_non_csr.materi',
                    DB::raw('NULL as topik'),
                    'users.name as dosen_name',
                    'ruangan.nama as ruangan_name',
                    DB::raw('"Kelompok Besar" as kelompok_name'),
                    'jadwal_non_blok_non_csr.status_konfirmasi'
                )
                ->get();

            $result['non_blok_non_csr'] = $nonBlokNonCsr;
        }

        return response()->json($result);
    }

    /**
     * Menampilkan semua data mata kuliah dengan materi dalam satu request (batch)
     */
    public function getWithMateri(Request $request)
    {
        // Ambil parameter pagination
        $perPage = $request->get('per_page', 50); // Default 50 item per halaman
        $page = $request->get('page', 1);

        // Ambil semua mata kuliah dengan pagination
        $mataKuliah = MataKuliah::paginate($perPage, ['*'], 'page', $page);

        // Ambil semua materi untuk mata kuliah yang sedang dipaginasi
        $kodeMataKuliah = $mataKuliah->pluck('kode');

        if ($kodeMataKuliah->count() > 0) {
            // Optimize query dengan select hanya kolom yang diperlukan
            $allMateri = DB::table('materi_pembelajaran')
                ->select('id', 'kode_mata_kuliah', 'filename', 'judul', 'file_type', 'file_size', 'upload_date')
                ->whereIn('kode_mata_kuliah', $kodeMataKuliah)
                ->orderBy('upload_date', 'desc')
                ->get();

            // Group materi berdasarkan kode mata kuliah
            $materiByKode = $allMateri->groupBy('kode_mata_kuliah');

            // Gabungkan mata kuliah dengan materinya
            $mataKuliah->getCollection()->transform(function ($mk) use ($materiByKode) {
                $mk->materi = $materiByKode->get($mk->kode, collect())->toArray();
                return $mk;
            });
        }

        return response()->json($mataKuliah);
    }

    /**
     * Menampilkan semua data mata kuliah dengan materi tanpa pagination (untuk data kecil)
     */
    public function getWithMateriAll()
    {
        // Ambil semua mata kuliah
        $mataKuliah = MataKuliah::all();

        // Ambil semua materi untuk semua mata kuliah dalam satu query yang dioptimasi
        $allMateri = DB::table('materi_pembelajaran')
            ->select('id', 'kode_mata_kuliah', 'filename', 'judul', 'file_type', 'file_size', 'upload_date')
            ->whereIn('kode_mata_kuliah', $mataKuliah->pluck('kode'))
            ->orderBy('upload_date', 'desc')
            ->get();

        // Group materi berdasarkan kode mata kuliah
        $materiByKode = $allMateri->groupBy('kode_mata_kuliah');

        // Gabungkan mata kuliah dengan materinya
        $mataKuliahWithMateri = $mataKuliah->map(function ($mk) use ($materiByKode) {
            $mk->materi = $materiByKode->get($mk->kode, collect())->toArray();
            return $mk;
        });

        return response()->json($mataKuliahWithMateri);
    }

    /**
     * Tampilkan detail satu mata kuliah
     */
    public function show($kode)
    {
        $mataKuliah = MataKuliah::findOrFail($kode);
        return response()->json($mataKuliah);
    }


    /**
     * Bulk import data mata kuliah dari JSON
     */
    public function bulkImport(Request $request)
    {
        try {
            $data = $request->all();

            if (!is_array($data) || empty($data)) {
                return response()->json([
                    'success' => false,
                    'message' => 'Data tidak valid atau kosong'
                ], 422);
            }

            $importedCount = 0;
            $errors = [];
            $failedRows = [];
            $cellErrors = [];

            foreach ($data as $index => $rowData) {
                try {
                    // Validasi data per baris
                    $validator = Validator::make($rowData, [
                        'kode' => 'required|string|unique:mata_kuliah,kode|max:255',
                        'nama' => 'required|string',
                        'semester' => 'required',
                        'periode' => 'required|string',
                        'jenis' => 'required|in:Blok,Non Blok',
                        'kurikulum' => 'required|integer',
                        'tanggal_mulai' => 'required|date',
                        'tanggal_akhir' => 'required|date',
                        'blok' => 'nullable|integer',
                        'durasi_minggu' => 'required|integer',
                        'tipe_non_block' => 'nullable|string|in:CSR,Non-CSR',
                        'peran_dalam_kurikulum' => 'nullable|array',
                        'keahlian_required' => 'nullable|array',
                    ]);

                    if ($validator->fails()) {
                        foreach ($validator->errors()->messages() as $field => $messages) {
                            foreach ($messages as $msg) {
                                $errors[] = $msg . " (Baris " . ($index + 1) . ", Kolom " . strtoupper($field) . ")";
                                $cellErrors[] = [
                                    'row' => $index,
                                    'field' => $field,
                                    'message' => $msg,
                                    'kode' => $rowData['kode'] ?? '',
                                ];
                            }
                        }
                        $failedRows[] = $rowData;
                        continue;
                    }

                    // Validasi khusus semester
                    if ($rowData['semester'] !== 'Antara' && !is_numeric($rowData['semester'])) {
                        $errors[] = "Semester harus berupa angka atau 'Antara' (Baris " . ($index + 1) . ")";
                        $cellErrors[] = [
                            'row' => $index,
                            'field' => 'semester',
                            'message' => 'Semester harus berupa angka atau "Antara"',
                            'kode' => $rowData['kode'] ?? '',
                        ];
                        $failedRows[] = $rowData;
                        continue;
                    }

                    // Validasi tipe_non_block
                    if ($rowData['jenis'] === 'Non Blok') {
                        if (empty($rowData['tipe_non_block']) || !in_array($rowData['tipe_non_block'], ['CSR', 'Non-CSR'])) {
                            $errors[] = "Tipe Non-Block harus diisi dengan 'CSR' atau 'Non-CSR' untuk jenis Non Blok (Baris " . ($index + 1) . ")";
                            $cellErrors[] = [
                                'row' => $index,
                                'field' => 'tipe_non_block',
                                'message' => 'Tipe Non-Block harus diisi dengan "CSR" atau "Non-CSR"',
                                'kode' => $rowData['kode'] ?? '',
                            ];
                            $failedRows[] = $rowData;
                            continue;
                        }
                    } else if ($rowData['jenis'] === 'Blok') {
                        if (!empty($rowData['tipe_non_block'])) {
                            $errors[] = "Tipe Non-Block tidak boleh diisi untuk jenis Blok (Baris " . ($index + 1) . ")";
                            $cellErrors[] = [
                                'row' => $index,
                                'field' => 'tipe_non_block',
                                'message' => 'Tipe Non-Block tidak boleh diisi untuk jenis Blok',
                                'kode' => $rowData['kode'] ?? '',
                            ];
                            $failedRows[] = $rowData;
                            continue;
                        }
                    }

                    // Validasi khusus untuk semester Antara
                    if ($rowData['semester'] === 'Antara') {
                        if ($rowData['jenis'] === 'Non Blok' && $rowData['tipe_non_block'] === 'CSR') {
                            $errors[] = "Semester Antara tidak dapat memiliki tipe CSR, hanya Non-CSR yang diperbolehkan (Baris " . ($index + 1) . ")";
                            $cellErrors[] = [
                                'row' => $index,
                                'field' => 'tipe_non_block',
                                'message' => 'Semester Antara tidak dapat memiliki tipe CSR',
                                'kode' => $rowData['kode'] ?? '',
                            ];
                            $failedRows[] = $rowData;
                            continue;
                        }
                    }

                    // Validasi peran_dalam_kurikulum dan keahlian_required untuk semester reguler
                    if ($rowData['semester'] !== 'Antara') {
                        if (empty($rowData['peran_dalam_kurikulum']) || !is_array($rowData['peran_dalam_kurikulum']) || count($rowData['peran_dalam_kurikulum']) === 0) {
                            $errors[] = "Peran dalam Kurikulum harus diisi untuk semester reguler (Baris " . ($index + 1) . ")";
                            $cellErrors[] = [
                                'row' => $index,
                                'field' => 'peran_dalam_kurikulum',
                                'message' => 'Peran dalam Kurikulum harus diisi untuk semester reguler',
                                'kode' => $rowData['kode'] ?? '',
                            ];
                            $failedRows[] = $rowData;
                            continue;
                        }

                        if (empty($rowData['keahlian_required']) || !is_array($rowData['keahlian_required']) || count($rowData['keahlian_required']) === 0) {
                            $errors[] = "Keahlian Dibutuhkan harus diisi untuk semester reguler (Baris " . ($index + 1) . ")";
                            $cellErrors[] = [
                                'row' => $index,
                                'field' => 'keahlian_required',
                                'message' => 'Keahlian Dibutuhkan harus diisi untuk semester reguler',
                                'kode' => $rowData['kode'] ?? '',
                            ];
                            $failedRows[] = $rowData;
                            continue;
                        }
                    } else {
                        // Untuk semester Antara, peran_dalam_kurikulum dan keahlian_required harus kosong
                        if (!empty($rowData['peran_dalam_kurikulum']) && is_array($rowData['peran_dalam_kurikulum']) && count($rowData['peran_dalam_kurikulum']) > 0) {
                            $errors[] = "Peran dalam Kurikulum tidak boleh diisi untuk semester Antara (Baris " . ($index + 1) . ")";
                            $cellErrors[] = [
                                'row' => $index,
                                'field' => 'peran_dalam_kurikulum',
                                'message' => 'Peran dalam Kurikulum tidak boleh diisi untuk semester Antara',
                                'kode' => $rowData['kode'] ?? '',
                            ];
                            $failedRows[] = $rowData;
                            continue;
                        }

                        if (!empty($rowData['keahlian_required']) && is_array($rowData['keahlian_required']) && count($rowData['keahlian_required']) > 0) {
                            $errors[] = "Keahlian Dibutuhkan tidak boleh diisi untuk semester Antara (Baris " . ($index + 1) . ")";
                            $cellErrors[] = [
                                'row' => $index,
                                'field' => 'keahlian_required',
                                'message' => 'Keahlian Dibutuhkan tidak boleh diisi untuk semester Antara',
                                'kode' => $rowData['kode'] ?? '',
                            ];
                            $failedRows[] = $rowData;
                            continue;
                        }
                    }

                    // Jika valid, create MataKuliah
                    MataKuliah::create($rowData);
                    $importedCount++;

                } catch (\Exception $e) {
                    $errors[] = "Error pada baris " . ($index + 1) . ": " . $e->getMessage();
                    $failedRows[] = $rowData;
                }
            }

            if ($importedCount > 0) {
                return response()->json([
                    'success' => true,
                    'imported_count' => $importedCount,
                    'errors' => $errors,
                    'failed_rows' => $failedRows,
                    'cell_errors' => $cellErrors,
                ], 200);
            } else {
                return response()->json([
                    'success' => false,
                    'message' => 'Semua data gagal diimpor. Periksa kembali format dan isian data.',
                    'errors' => $errors,
                    'cell_errors' => $cellErrors,
                ], 422);
            }

        } catch (\Exception $e) {
            Log::error("Error in bulk import mata kuliah: " . $e->getMessage());
            return response()->json([
                'success' => false,
                'message' => 'Terjadi kesalahan saat mengimpor data: ' . $e->getMessage(),
                'error' => $e->getMessage()
            ], 500);
        }
    }
}