<?php

namespace App\Http\Controllers;

use App\Models\PenilaianJurnal;
use App\Models\JadwalJurnalReading;
use App\Models\KelompokKecil;
use App\Models\AbsensiJurnal;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Log;

class PenilaianJurnalController extends Controller
{
    // Get penilaian jurnal untuk satu jurnal reading
    public function index($kode_blok, $kelompok, $jurnal_id)
    {
        try {
            // Ambil data jurnal reading
            $jurnalReading = JadwalJurnalReading::with(['kelompokKecil', 'dosen', 'ruangan'])
                ->where('id', $jurnal_id)
                ->where('mata_kuliah_kode', $kode_blok)
                ->first();

            if (!$jurnalReading) {
                return response()->json(['message' => 'Jurnal reading tidak ditemukan'], 404);
            }

            // Ambil data mahasiswa dari kelompok kecil
            $mahasiswa = KelompokKecil::where('nama_kelompok', $kelompok)
                ->with('mahasiswa')
                ->get()
                ->flatMap(function ($kelompok) {
                    // Jika mahasiswa adalah single User model, convert ke array
                    if ($kelompok->mahasiswa instanceof \App\Models\User) {
                        return [[
                            'nim' => $kelompok->mahasiswa->nim,
                            'nama' => $kelompok->mahasiswa->name ?? $kelompok->mahasiswa->nama ?? '',
                        ]];
                    }
                    // Jika mahasiswa adalah collection
                    return $kelompok->mahasiswa->map(function ($mhs) {
                        return [
                            'nim' => $mhs->nim,
                            'nama' => $mhs->name ?? $mhs->nama ?? '',
                        ];
                    });
                });

            // Ambil data penilaian yang sudah ada
            $penilaian = PenilaianJurnal::where('mata_kuliah_kode', $kode_blok)
                ->where('kelompok_kecil_nama', $kelompok)
                ->where('jurnal_reading_id', $jurnal_id)
                ->get()
                ->keyBy('mahasiswa_nim');

            // Ambil data tutor dan paraf (ambil dari record pertama)
            $tutorData = PenilaianJurnal::where('mata_kuliah_kode', $kode_blok)
                ->where('kelompok_kecil_nama', $kelompok)
                ->where('jurnal_reading_id', $jurnal_id)
                ->first();

            // Ambil data absensi yang sudah ada
            $absensi = AbsensiJurnal::where('jadwal_jurnal_reading_id', $jurnal_id)
                ->get()
                ->keyBy('mahasiswa_nim');

            return response()->json([
                'jurnal_reading' => $jurnalReading,
                'mahasiswa' => $mahasiswa,
                'penilaian' => $penilaian,
                'absensi' => $absensi,
                'tutor_data' => $tutorData ? [
                    'nama_tutor' => $tutorData->nama_tutor,
                    'tanggal_paraf' => $tutorData->tanggal_paraf,
                    'signature_paraf' => $tutorData->signature_paraf,
                ] : null,
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal memuat data penilaian: ' . $e->getMessage()], 500);
        }
    }

    // Store/Update penilaian jurnal
    public function store(Request $request, $kode_blok, $kelompok, $jurnal_id)
    {
        try {
            $request->validate([
                'penilaian' => 'required|array',
                'penilaian.*.mahasiswa_nim' => 'required|string',
                'penilaian.*.nilai_keaktifan' => 'required|integer|min:0|max:60',
                'penilaian.*.nilai_laporan' => 'required|integer|min:0|max:40',
                'tanggal_paraf' => 'nullable|date',
                'signature_paraf' => 'nullable|string',
                'nama_tutor' => 'nullable|string',
            ]);

            // Hapus data penilaian yang lama
            PenilaianJurnal::where('mata_kuliah_kode', $kode_blok)
                ->where('kelompok_kecil_nama', $kelompok)
                ->where('jurnal_reading_id', $jurnal_id)
                ->delete();

            // Simpan data penilaian baru
            foreach ($request->penilaian as $nilai) {
                PenilaianJurnal::create([
                    'mata_kuliah_kode' => $kode_blok,
                    'kelompok_kecil_nama' => $kelompok,
                    'jurnal_reading_id' => $jurnal_id,
                    'mahasiswa_nim' => $nilai['mahasiswa_nim'],
                    'nilai_keaktifan' => $nilai['nilai_keaktifan'],
                    'nilai_laporan' => $nilai['nilai_laporan'],
                    'tanggal_paraf' => $request->tanggal_paraf,
                    'signature_paraf' => $request->signature_paraf,
                    'nama_tutor' => $request->nama_tutor,
                ]);
            }

            return response()->json(['message' => 'Penilaian jurnal berhasil disimpan'], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal menyimpan penilaian: ' . $e->getMessage()], 500);
        }
    }

    // Get data untuk export
    public function export($kode_blok, $kelompok, $jurnal_id)
    {
        try {
            // Ambil data jurnal reading
            $jurnalReading = JadwalJurnalReading::with(['kelompokKecil', 'dosen', 'ruangan'])
                ->where('id', $jurnal_id)
                ->where('mata_kuliah_kode', $kode_blok)
                ->first();

            if (!$jurnalReading) {
                return response()->json(['message' => 'Jurnal reading tidak ditemukan'], 404);
            }

            // Ambil data mahasiswa
            $mahasiswa = KelompokKecil::where('nama_kelompok', $kelompok)
                ->with('mahasiswa')
                ->get()
                ->flatMap(function ($kelompok) {
                    return $kelompok->mahasiswa->map(function ($mhs) {
                        return [
                            'nim' => $mhs->nim,
                            'nama' => $mhs->name ?? $mhs->nama ?? '',
                        ];
                    });
                });

            // Ambil data penilaian
            $penilaian = PenilaianJurnal::where('mata_kuliah_kode', $kode_blok)
                ->where('kelompok_kecil_nama', $kelompok)
                ->where('jurnal_reading_id', $jurnal_id)
                ->get()
                ->keyBy('mahasiswa_nim');

            // Ambil data tutor
            $tutorData = PenilaianJurnal::where('mata_kuliah_kode', $kode_blok)
                ->where('kelompok_kecil_nama', $kelompok)
                ->where('jurnal_reading_id', $jurnal_id)
                ->first();

            return response()->json([
                'jurnal_reading' => $jurnalReading,
                'mahasiswa' => $mahasiswa,
                'penilaian' => $penilaian,
                'tutor_data' => $tutorData ? [
                    'nama_tutor' => $tutorData->nama_tutor,
                    'tanggal_paraf' => $tutorData->tanggal_paraf,
                    'signature_paraf' => $tutorData->signature_paraf,
                ] : null,
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal memuat data untuk export'], 500);
        }
    }

    // Method untuk semester Antara - Get penilaian jurnal untuk satu jurnal reading
    public function indexAntara($kode_blok, $kelompok, $jurnal_id)
    {
        try {
            // Ambil data jurnal reading
            $jurnalReading = JadwalJurnalReading::with(['kelompokKecilAntara', 'dosen', 'ruangan'])
                ->where('id', $jurnal_id)
                ->where('mata_kuliah_kode', $kode_blok)
                ->first();

            if (!$jurnalReading) {
                return response()->json(['message' => 'Jurnal reading tidak ditemukan'], 404);
            }

            // Ambil data mahasiswa dari kelompok kecil antara
            $kelompokKecilAntara = \App\Models\KelompokKecilAntara::where('nama_kelompok', $kelompok)->first();
            
            if (!$kelompokKecilAntara) {
                return response()->json(['message' => 'Kelompok kecil antara tidak ditemukan'], 404);
            }

            $mahasiswa = \App\Models\User::whereIn('id', $kelompokKecilAntara->mahasiswa_ids ?? [])
                ->where('role', 'mahasiswa')
                ->get()
                ->map(function ($mhs) {
                    return [
                        'nim' => $mhs->nim,
                        'nama' => $mhs->name ?? $mhs->nama ?? '',
                    ];
                });

            // Ambil data penilaian yang sudah ada
            $penilaian = PenilaianJurnal::where('mata_kuliah_kode', $kode_blok)
                ->where('kelompok_kecil_nama', $kelompok)
                ->where('jurnal_reading_id', $jurnal_id)
                ->get()
                ->keyBy('mahasiswa_nim');

            // Ambil data tutor dan paraf (ambil dari record pertama)
            $tutorData = PenilaianJurnal::where('mata_kuliah_kode', $kode_blok)
                ->where('kelompok_kecil_nama', $kelompok)
                ->where('jurnal_reading_id', $jurnal_id)
                ->first();

            // Ambil data absensi yang sudah ada
            $absensi = AbsensiJurnal::where('jadwal_jurnal_reading_id', $jurnal_id)
                ->get()
                ->keyBy('mahasiswa_nim');

            return response()->json([
                'jurnal_reading' => $jurnalReading,
                'mahasiswa' => $mahasiswa,
                'penilaian' => $penilaian,
                'absensi' => $absensi,
                'tutor_data' => $tutorData ? [
                    'nama_tutor' => $tutorData->nama_tutor,
                    'tanggal_paraf' => $tutorData->tanggal_paraf,
                    'signature_paraf' => $tutorData->signature_paraf,
                ] : null,
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal memuat data penilaian: ' . $e->getMessage()], 500);
        }
    }

    // Method untuk semester Antara - Store/Update penilaian jurnal
    public function storeAntara(Request $request, $kode_blok, $kelompok, $jurnal_id)
    {
        try {
            $request->validate([
                'penilaian' => 'required|array',
                'penilaian.*.mahasiswa_nim' => 'required|string',
                'penilaian.*.nilai_keaktifan' => 'required|integer|min:0|max:60',
                'penilaian.*.nilai_laporan' => 'required|integer|min:0|max:40',
                'tanggal_paraf' => 'nullable|date',
                'signature_paraf' => 'nullable|string',
                'nama_tutor' => 'nullable|string',
            ]);

            // Hapus data penilaian yang lama
            PenilaianJurnal::where('mata_kuliah_kode', $kode_blok)
                ->where('kelompok_kecil_nama', $kelompok)
                ->where('jurnal_reading_id', $jurnal_id)
                ->delete();

            // Simpan data penilaian baru
            foreach ($request->penilaian as $nilai) {
                PenilaianJurnal::create([
                    'mata_kuliah_kode' => $kode_blok,
                    'kelompok_kecil_nama' => $kelompok,
                    'jurnal_reading_id' => $jurnal_id,
                    'mahasiswa_nim' => $nilai['mahasiswa_nim'],
                    'nilai_keaktifan' => $nilai['nilai_keaktifan'],
                    'nilai_laporan' => $nilai['nilai_laporan'],
                    'tanggal_paraf' => $request->tanggal_paraf,
                    'signature_paraf' => $request->signature_paraf,
                    'nama_tutor' => $request->nama_tutor,
                ]);
            }

            return response()->json(['message' => 'Penilaian jurnal berhasil disimpan'], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal menyimpan penilaian: ' . $e->getMessage()], 500);
        }
    }

    // Method untuk semester Antara - Get data untuk export
    public function exportAntara($kode_blok, $kelompok, $jurnal_id)
    {
        try {
            // Ambil data jurnal reading
            $jurnalReading = JadwalJurnalReading::with(['kelompokKecilAntara', 'dosen', 'ruangan'])
                ->where('id', $jurnal_id)
                ->where('mata_kuliah_kode', $kode_blok)
                ->first();

            if (!$jurnalReading) {
                return response()->json(['message' => 'Jurnal reading tidak ditemukan'], 404);
            }

            // Ambil data mahasiswa dari kelompok kecil antara
            $kelompokKecilAntara = \App\Models\KelompokKecilAntara::where('nama_kelompok', $kelompok)->first();
            
            if (!$kelompokKecilAntara) {
                return response()->json(['message' => 'Kelompok kecil antara tidak ditemukan'], 404);
            }

            $mahasiswa = \App\Models\User::whereIn('id', $kelompokKecilAntara->mahasiswa_ids ?? [])
                ->where('role', 'mahasiswa')
                ->get()
                ->map(function ($mhs) {
                    return [
                        'nim' => $mhs->nim,
                        'nama' => $mhs->name ?? $mhs->nama ?? '',
                    ];
                });

            // Ambil data penilaian
            $penilaian = PenilaianJurnal::where('mata_kuliah_kode', $kode_blok)
                ->where('kelompok_kecil_nama', $kelompok)
                ->where('jurnal_reading_id', $jurnal_id)
                ->get()
                ->keyBy('mahasiswa_nim');

            // Ambil data tutor
            $tutorData = PenilaianJurnal::where('mata_kuliah_kode', $kode_blok)
                ->where('kelompok_kecil_nama', $kelompok)
                ->where('jurnal_reading_id', $jurnal_id)
                ->first();

            return response()->json([
                'jurnal_reading' => $jurnalReading,
                'mahasiswa' => $mahasiswa,
                'penilaian' => $penilaian,
                'tutor_data' => $tutorData ? [
                    'nama_tutor' => $tutorData->nama_tutor,
                    'tanggal_paraf' => $tutorData->tanggal_paraf,
                    'signature_paraf' => $tutorData->signature_paraf,
                ] : null,
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal memuat data export: ' . $e->getMessage()], 500);
        }
    }

    // Method untuk absensi jurnal (semester antara)
    public function getAbsensi($kode_blok, $kelompok, $jurnal_id)
    {
        try {
            // Ambil data absensi yang sudah ada
            $absensi = AbsensiJurnal::where('jadwal_jurnal_reading_id', $jurnal_id)
                ->get()
                ->keyBy('mahasiswa_nim');

            return response()->json([
                'absensi' => $absensi
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal memuat data absensi: ' . $e->getMessage()], 500);
        }
    }

    public function storeAbsensi(Request $request, $kode_blok, $kelompok, $jurnal_id)
    {
        try {
            $request->validate([
                'absensi' => 'required|array',
                'absensi.*.mahasiswa_nim' => 'required|string',
                'absensi.*.hadir' => 'required|boolean',
            ]);

            // Hapus data absensi yang lama
            AbsensiJurnal::where('jadwal_jurnal_reading_id', $jurnal_id)->delete();

            // Simpan data absensi baru
            foreach ($request->absensi as $absen) {
                AbsensiJurnal::create([
                    'jadwal_jurnal_reading_id' => $jurnal_id,
                    'mahasiswa_nim' => $absen['mahasiswa_nim'],
                    'hadir' => $absen['hadir'],
                ]);
            }

            return response()->json(['message' => 'Absensi berhasil disimpan']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal menyimpan absensi: ' . $e->getMessage()], 500);
        }
    }

    // Method untuk absensi jurnal (semester reguler)
    public function getAbsensiReguler($kode_blok, $kelompok, $jurnal_id)
    {
        try {
            // Ambil data absensi yang sudah ada
            $absensi = AbsensiJurnal::where('jadwal_jurnal_reading_id', $jurnal_id)
                ->get()
                ->keyBy('mahasiswa_nim');

            return response()->json([
                'absensi' => $absensi
            ]);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal memuat data absensi: ' . $e->getMessage()], 500);
        }
    }

    public function storeAbsensiReguler(Request $request, $kode_blok, $kelompok, $jurnal_id)
    {
        try {
            $request->validate([
                'absensi' => 'required|array',
                'absensi.*.mahasiswa_nim' => 'required|string',
                'absensi.*.hadir' => 'required|boolean',
            ]);

            // Hapus data absensi yang lama
            AbsensiJurnal::where('jadwal_jurnal_reading_id', $jurnal_id)->delete();

            // Simpan data absensi baru
            foreach ($request->absensi as $absen) {
                AbsensiJurnal::create([
                    'jadwal_jurnal_reading_id' => $jurnal_id,
                    'mahasiswa_nim' => $absen['mahasiswa_nim'],
                    'hadir' => $absen['hadir'],
                ]);
            }

            return response()->json(['message' => 'Absensi berhasil disimpan']);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal menyimpan absensi: ' . $e->getMessage()], 500);
        }
    }
}
