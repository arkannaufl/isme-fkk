<?php

namespace App\Http\Controllers;

use App\Models\Kelas;
use App\Models\KelompokKecil;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class KelasController extends Controller
{
    // List kelas per semester
    public function index(Request $request)
    {
        $semester = $request->query('semester');
        $query = Kelas::with('kelompokKecil')->orderBy('nama_kelas', 'asc');
        if ($semester) {
            $query->where('semester', $semester);
        }
        return response()->json($query->get());
    }

    // Get kelas by semester dengan format yang sesuai untuk frontend
    public function getBySemester($semester)
    {
        $kelas = Kelas::where('semester', $semester)
            ->orderBy('nama_kelas', 'asc')
            ->get();

        // Tambahkan data kelompok untuk setiap kelas
        $kelasWithKelompok = $kelas->map(function($k) use ($semester) {
            $kelompokIds = DB::table('kelas_kelompok')
                ->where('kelas_id', $k->id)
                ->pluck('nama_kelompok')
                ->toArray();
            
            return [
                'id' => $k->id,
                'nama_kelas' => $k->nama_kelas,
                'semester' => $k->semester,
                'deskripsi' => $k->deskripsi,
                'kelompok_kecil' => $kelompokIds
            ];
        });

        return response()->json($kelasWithKelompok);
    }

    // Buat kelas baru
    public function store(Request $request)
    {
        $request->validate([
            'semester' => 'required|string',
            'nama_kelas' => 'required|string',
            'deskripsi' => 'nullable|string',
            'kelompok_ids' => 'nullable|array',
            'kelompok_ids.*' => 'required|string',
        ]);

        $semester = $request->semester;
        $namaKelas = $request->nama_kelas;
        $deskripsi = $request->deskripsi;
        $kelompokIds = $request->kelompok_ids ?? [];

        // Cek rule: kelompok kecil harus ada dulu (hanya jika ada kelompok_ids yang dikirim)
        if (!empty($kelompokIds)) {
            $kelompokKecil = KelompokKecil::where('semester', $semester)
                ->distinct()
                ->pluck('nama_kelompok')
                ->toArray();
            if (empty($kelompokKecil)) {
                return response()->json([
                    'message' => 'Kelompok kecil harus dibuat terlebih dahulu untuk semester ini'
                ], 422);
            }

            // Cek apakah kelompok yang dipilih ada di semester ini
            $kelompokTidakAda = array_diff($kelompokIds, $kelompokKecil);
            if (!empty($kelompokTidakAda)) {
                return response()->json([
                    'message' => 'Beberapa kelompok tidak ditemukan di semester ini',
                    'kelompok' => $kelompokTidakAda
                ], 422);
            }

            // Cek apakah kelompok sudah ada di kelas lain
            $kelompokSudahAda = DB::table('kelas_kelompok')
                ->where('semester', $semester)
                ->whereIn('nama_kelompok', $kelompokIds)
                ->pluck('nama_kelompok')
                ->toArray();
            if (!empty($kelompokSudahAda)) {
                return response()->json([
                    'message' => 'Beberapa kelompok sudah ada di kelas lain',
                    'kelompok' => $kelompokSudahAda
                ], 422);
            }
        }

        // Cek apakah nama kelas sudah ada di semester ini
        $kelasExists = Kelas::where('semester', $semester)
            ->where('nama_kelas', $namaKelas)
            ->exists();
        if ($kelasExists) {
            return response()->json([
                'message' => 'Nama kelas sudah ada di semester ini'
            ], 422);
        }

        // Simpan kelas dan relasi kelompok
        DB::transaction(function() use ($semester, $namaKelas, $deskripsi, $kelompokIds) {
            $kelas = Kelas::create([
                'semester' => $semester,
                'nama_kelas' => $namaKelas,
                'deskripsi' => $deskripsi
            ]);

            // Simpan relasi kelompok (jika ada)
            foreach ($kelompokIds as $namaKelompok) {
                DB::table('kelas_kelompok')->insert([
                    'kelas_id' => $kelas->id,
                    'semester' => $semester,
                    'nama_kelompok' => $namaKelompok,
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }
        });

        return response()->json([
            'message' => 'Kelas berhasil dibuat',
            'nama_kelas' => $namaKelas,
            'jumlah_kelompok' => count($kelompokIds)
        ]);
    }

    // Update kelas
    public function update(Request $request, $id)
    {
        $request->validate([
            'nama_kelas' => 'required|string',
            'deskripsi' => 'nullable|string',
            'kelompok_ids' => 'nullable|array',
            'kelompok_ids.*' => 'required|string',
        ]);

        $kelas = Kelas::findOrFail($id);
        $namaKelas = $request->nama_kelas;
        $deskripsi = $request->deskripsi;
        $kelompokIds = $request->kelompok_ids ?? [];

        // Cek apakah nama kelas sudah ada (kecuali kelas ini sendiri)
        $kelasExists = Kelas::where('semester', $kelas->semester)
            ->where('nama_kelas', $namaKelas)
            ->where('id', '!=', $id)
            ->exists();
        if ($kelasExists) {
            return response()->json([
                'message' => 'Nama kelas sudah ada di semester ini'
            ], 422);
        }

        // Cek apakah kelompok yang dipilih ada di semester ini (hanya jika ada kelompok_ids)
        if (!empty($kelompokIds)) {
            $kelompokKecil = KelompokKecil::where('semester', $kelas->semester)
                ->distinct()
                ->pluck('nama_kelompok')
                ->toArray();
            $kelompokTidakAda = array_diff($kelompokIds, $kelompokKecil);
            if (!empty($kelompokTidakAda)) {
                return response()->json([
                    'message' => 'Beberapa kelompok tidak ditemukan di semester ini',
                    'kelompok' => $kelompokTidakAda
                ], 422);
            }

            // Cek apakah kelompok sudah ada di kelas lain
            $kelompokSudahAda = DB::table('kelas_kelompok')
                ->where('semester', $kelas->semester)
                ->where('kelas_id', '!=', $id)
                ->whereIn('nama_kelompok', $kelompokIds)
                ->pluck('nama_kelompok')
                ->toArray();
            if (!empty($kelompokSudahAda)) {
                return response()->json([
                    'message' => 'Beberapa kelompok sudah ada di kelas lain',
                    'kelompok' => $kelompokSudahAda
                ], 422);
            }
        }

        // Update kelas dan relasi kelompok
        DB::transaction(function() use ($kelas, $namaKelas, $deskripsi, $kelompokIds) {
            $kelas->update([
                'nama_kelas' => $namaKelas,
                'deskripsi' => $deskripsi
            ]);

            // Hapus relasi lama
            DB::table('kelas_kelompok')->where('kelas_id', $kelas->id)->delete();

            // Simpan relasi baru (jika ada)
            foreach ($kelompokIds as $namaKelompok) {
                DB::table('kelas_kelompok')->insert([
                    'kelas_id' => $kelas->id,
                    'semester' => $kelas->semester,
                    'nama_kelompok' => $namaKelompok,
                    'created_at' => now(),
                    'updated_at' => now()
                ]);
            }
        });

        return response()->json(['message' => 'Kelas berhasil diupdate']);
    }

    // Hapus kelas
    public function destroy($id)
    {
        $kelas = Kelas::findOrFail($id);
        $kelas->delete(); // Relasi akan terhapus otomatis karena onDelete cascade
        return response()->json(['message' => 'Kelas berhasil dihapus']);
    }

    // Get detail kelas dengan mahasiswa
    public function show($id)
    {
        $kelas = Kelas::findOrFail($id);
        $kelompokIds = DB::table('kelas_kelompok')
            ->where('kelas_id', $id)
            ->pluck('nama_kelompok')
            ->toArray();

        $mahasiswa = KelompokKecil::with('mahasiswa')
            ->where('semester', $kelas->semester)
            ->whereIn('nama_kelompok', $kelompokIds)
            ->get()
            ->groupBy('nama_kelompok');

        return response()->json([
            'kelas' => $kelas,
            'kelompok' => $mahasiswa
        ]);
    }

    // Get kelas by semester ID
    public function getBySemesterId($semesterId)
    {
        // Get semester info
        $semester = \App\Models\Semester::find($semesterId);
        if (!$semester) {
            return response()->json(['message' => 'Semester tidak ditemukan'], 404);
        }

        $kelas = Kelas::where('semester', $semesterId)
            ->orderBy('nama_kelas', 'asc')
            ->get();

        // Tambahkan data kelompok untuk setiap kelas
        $kelasWithKelompok = $kelas->map(function($k) use ($semesterId) {
            $kelompokIds = DB::table('kelas_kelompok')
                ->where('kelas_id', $k->id)
                ->pluck('nama_kelompok')
                ->toArray();
            
            return [
                'id' => $k->id,
                'nama_kelas' => $k->nama_kelas,
                'semester' => $k->semester,
                'deskripsi' => $k->deskripsi,
                'kelompok_kecil' => $kelompokIds
            ];
        });

        return response()->json([
            'semester' => $semester,
            'data' => $kelasWithKelompok
        ]);
    }
} 