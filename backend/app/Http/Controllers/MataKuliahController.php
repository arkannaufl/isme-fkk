<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\MataKuliah;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;

class MataKuliahController extends Controller
{
    /**
     * Upload RPS file untuk mata kuliah
     */
    public function uploadRps(Request $request)
    {
        $request->validate([
            'rps_file' => 'required|file|mimes:pdf,doc,docx,xlsx,xls|max:10240', // 10MB max
            'kode' => 'required|string|exists:mata_kuliah,kode',
        ]);

        $file = $request->file('rps_file');
        $kode = $request->input('kode');

        // Generate unique filename
        $filename = $kode . '_' . time() . '_' . $file->getClientOriginalName();

        // Store file in storage/app/public/rps
        $path = Storage::disk('public')->putFileAs('rps', $file, $filename);

        // Update database
        $mataKuliah = MataKuliah::findOrFail($kode);
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

        return Storage::disk('public')->download($filePath, $mataKuliah->rps_file);
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
            'materi_file' => 'required|file|mimes:pdf,doc,docx,xlsx,xls,ppt,pptx,txt,jpg,jpeg,png,gif,mp4,mp3,wav,zip,rar|max:25600', // 25MB max
            'kode' => 'required|string|exists:mata_kuliah,kode',
            'judul' => 'required|string|max:255',
        ]);

        $file = $request->file('materi_file');
        $kode = $request->input('kode');
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

        return Storage::disk('public')->download($filePath, $materi->judul . '.' . $materi->file_type);
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
        return response()->json($mataKuliah);
    }

    /**
     * Hapus data mata kuliah
     */
    public function destroy($kode)
    {
        $mataKuliah = MataKuliah::findOrFail($kode);
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
}
