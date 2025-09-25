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
            // Validasi akses dosen terlebih dahulu
            $this->validateDosenAccessJurnal($kode_blok, $jurnal_id);

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
                'penilaian_submitted' => $jurnalReading->penilaian_submitted ?? false,
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
            // Validasi akses dosen
            $this->validateDosenAccessJurnal($kode_blok, $jurnal_id);

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

            // Update jadwal jurnal reading status penilaian_submitted
            $this->updateJadwalJurnalPenilaianStatus($jurnal_id);

            // Log activity
            activity()
                ->withProperties([
                    'mata_kuliah_kode' => $kode_blok,
                    'kelompok' => $kelompok,
                    'jurnal_id' => $jurnal_id,
                    'penilaian_count' => count($request->penilaian)
                ])
                ->log("Penilaian Jurnal created: {$kode_blok} - {$kelompok} - {$jurnal_id}");

            return response()->json(['message' => 'Penilaian jurnal berhasil disimpan'], 200);
        } catch (\Exception $e) {
            return response()->json(['message' => 'Gagal menyimpan penilaian: ' . $e->getMessage()], 500);
        }
    }

    // Get data untuk export
    public function export($kode_blok, $kelompok, $jurnal_id)
    {
        try {
            // Validasi akses dosen
            $this->validateDosenAccessJurnal($kode_blok, $jurnal_id);
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
            // Decode URL-encoded kelompok name
            $kelompokDecoded = urldecode($kelompok);
            
            // Validasi akses dosen untuk semester antara
            $this->validateDosenAccessJurnalAntara($kode_blok, $jurnal_id);
            // Ambil data jurnal reading
            $jurnalReading = JadwalJurnalReading::with(['kelompokKecilAntara', 'dosen', 'ruangan'])
                ->where('id', $jurnal_id)
                ->where('mata_kuliah_kode', $kode_blok)
                ->first();

            if (!$jurnalReading) {
                return response()->json(['message' => 'Jurnal reading tidak ditemukan'], 404);
            }

            // Ambil data mahasiswa dari kelompok kecil antara
            $kelompokKecilAntara = \App\Models\KelompokKecilAntara::where('nama_kelompok', $kelompokDecoded)->first();
            
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
                'penilaian_submitted' => $jurnalReading->penilaian_submitted ?? false,
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
            // Decode URL-encoded kelompok name
            $kelompokDecoded = urldecode($kelompok);
            
            // Validasi akses dosen untuk semester antara
            $this->validateDosenAccessJurnalAntara($kode_blok, $jurnal_id);
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
            // Decode URL-encoded kelompok name
            $kelompokDecoded = urldecode($kelompok);
            
            // Validasi akses dosen untuk semester antara
            $this->validateDosenAccessJurnalAntara($kode_blok, $jurnal_id);
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
            // Validasi akses dosen
            $this->validateDosenAccessJurnal($kode_blok, $jurnal_id);
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
            // Validasi akses dosen
            $this->validateDosenAccessJurnal($kode_blok, $jurnal_id);
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
            // Validasi akses dosen
            $this->validateDosenAccessJurnal($kode_blok, $jurnal_id);
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
            // Validasi akses dosen
            $this->validateDosenAccessJurnal($kode_blok, $jurnal_id);
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

    /**
     * Update jadwal jurnal reading penilaian_submitted status
     */
    private function updateJadwalJurnalPenilaianStatus($jurnal_id)
    {
        try {
            $jadwal = JadwalJurnalReading::find($jurnal_id);
            if ($jadwal) {
                $jadwal->update([
                    'penilaian_submitted' => true,
                    'penilaian_submitted_by' => auth()->id(),
                    'penilaian_submitted_at' => now(),
                ]);
            }
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error('Error updating jadwal jurnal penilaian status: ' . $e->getMessage());
        }
    }

    // Validasi akses dosen untuk jurnal tertentu
    private function validateDosenAccessJurnal($kode_blok, $jurnal_id)
    {
        // Ambil data jurnal reading
        $jurnalReading = JadwalJurnalReading::where('id', $jurnal_id)
            ->where('mata_kuliah_kode', $kode_blok)
            ->first();

        if (!$jurnalReading) {
            abort(404, 'Jurnal reading tidak ditemukan');
        }

        // Validasi: Cek apakah user yang akses adalah dosen yang terdaftar atau admin
        $user = auth()->user();
        \Illuminate\Support\Facades\Log::info("Validating jurnal access for user {$user->id} with role {$user->role}");
        \Illuminate\Support\Facades\Log::info("Jurnal dosen_ids: " . json_encode($jurnalReading->dosen_ids));
        
        if ($user->role === 'dosen') {
            // Cek apakah dosen ini ada di daftar dosen_ids
            $dosenIds = is_array($jurnalReading->dosen_ids) ? $jurnalReading->dosen_ids : json_decode($jurnalReading->dosen_ids, true);
            \Illuminate\Support\Facades\Log::info("Parsed dosen_ids: " . json_encode($dosenIds));
            
            // Jika dosen_ids kosong atau null, cek konfirmasi dosen
            if (!is_array($dosenIds) || empty($dosenIds)) {
                \Illuminate\Support\Facades\Log::warning("Jurnal reading {$kode_blok} - {$jurnal_id} tidak memiliki dosen_ids, checking confirmation");
                
                // Check if dosen has confirmed availability for this jurnal
                if ($this->isDosenConfirmedForJurnal($user->id, $kode_blok, $jurnal_id)) {
                    \Illuminate\Support\Facades\Log::info("Dosen {$user->id} is confirmed for jurnal, allowing access");
                    // Don't abort - allow access for confirmed dosen
                } else {
                    \Illuminate\Support\Facades\Log::error("Dosen {$user->id} is not confirmed for jurnal, denying access");
                    abort(403, 'Anda tidak memiliki akses untuk menilai jurnal ini. Hanya dosen yang ditugaskan dan telah mengkonfirmasi ketersediaan yang dapat mengakses halaman ini.');
                }
            } else {
                \Illuminate\Support\Facades\Log::info("Checking if user {$user->id} is in dosen_ids: " . json_encode($dosenIds));
                
                // Convert dosen_ids to integers for comparison
                $dosenIdsInt = array_map('intval', $dosenIds);
                \Illuminate\Support\Facades\Log::info("Converted dosen_ids to int: " . json_encode($dosenIdsInt));
                
                if (!in_array((int)$user->id, $dosenIdsInt)) {
                    \Illuminate\Support\Facades\Log::error("User {$user->id} not found in dosen_ids: " . json_encode($dosenIdsInt));
                    
                    // Check if dosen has confirmed availability for this jurnal
                    if ($this->isDosenConfirmedForJurnal($user->id, $kode_blok, $jurnal_id)) {
                        \Illuminate\Support\Facades\Log::info("Dosen {$user->id} is confirmed for jurnal, allowing access");
                        // Don't abort - allow access for confirmed dosen
                    } else {
                        abort(403, 'Anda tidak memiliki akses untuk menilai jurnal ini. Hanya dosen yang ditugaskan dan telah mengkonfirmasi ketersediaan yang dapat mengakses halaman ini.');
                    }
                }
            }
        } elseif (!in_array($user->role, ['super_admin', 'tim_akademik'])) {
            // Hanya super_admin dan tim_akademik yang bisa akses selain dosen
            abort(403, 'Anda tidak memiliki akses untuk menilai jurnal ini');
        }
    }

    // Validasi akses dosen untuk jurnal semester antara
    private function validateDosenAccessJurnalAntara($kode_blok, $jurnal_id)
    {
        // Ambil data jurnal reading
        $jurnalReading = JadwalJurnalReading::where('id', $jurnal_id)
            ->where('mata_kuliah_kode', $kode_blok)
            ->first();

        if (!$jurnalReading) {
            abort(404, 'Jurnal reading tidak ditemukan');
        }

        // Validasi: Cek apakah user yang akses adalah dosen yang terdaftar atau admin
        $user = auth()->user();
        \Illuminate\Support\Facades\Log::info("Validating jurnal antara access for user {$user->id} with role {$user->role}");
        \Illuminate\Support\Facades\Log::info("Jurnal dosen_ids: " . json_encode($jurnalReading->dosen_ids));
        
        if ($user->role === 'dosen') {
            // Cek apakah dosen ini ada di daftar dosen_ids
            $dosenIds = is_array($jurnalReading->dosen_ids) ? $jurnalReading->dosen_ids : json_decode($jurnalReading->dosen_ids, true);
            \Illuminate\Support\Facades\Log::info("Parsed dosen_ids: " . json_encode($dosenIds));
            
            // Jika dosen_ids kosong atau null, cek konfirmasi dosen
            if (!is_array($dosenIds) || empty($dosenIds)) {
                \Illuminate\Support\Facades\Log::warning("Jurnal reading antara {$kode_blok} - {$jurnal_id} tidak memiliki dosen_ids, checking confirmation");
                
                // Check if dosen has confirmed availability for this jurnal
                if ($this->isDosenConfirmedForJurnalAntara($user->id, $kode_blok, $jurnal_id)) {
                    \Illuminate\Support\Facades\Log::info("Dosen {$user->id} is confirmed for jurnal antara, allowing access");
                    // Don't abort - allow access for confirmed dosen
                } else {
                    \Illuminate\Support\Facades\Log::error("Dosen {$user->id} is not confirmed for jurnal antara, denying access");
                    abort(403, 'Anda tidak memiliki akses untuk menilai jurnal ini. Hanya dosen yang ditugaskan dan telah mengkonfirmasi ketersediaan yang dapat mengakses halaman ini.');
                }
            } else {
                \Illuminate\Support\Facades\Log::info("Checking if user {$user->id} is in dosen_ids: " . json_encode($dosenIds));
                
                // Convert dosen_ids to integers for comparison
                $dosenIdsInt = array_map('intval', $dosenIds);
                \Illuminate\Support\Facades\Log::info("Converted dosen_ids to int: " . json_encode($dosenIdsInt));
                
                if (!in_array((int)$user->id, $dosenIdsInt)) {
                    \Illuminate\Support\Facades\Log::error("User {$user->id} not found in dosen_ids: " . json_encode($dosenIdsInt));
                    
                    // Check if dosen has confirmed availability for this jurnal
                    if ($this->isDosenConfirmedForJurnalAntara($user->id, $kode_blok, $jurnal_id)) {
                        \Illuminate\Support\Facades\Log::info("Dosen {$user->id} is confirmed for jurnal antara, allowing access");
                        // Don't abort - allow access for confirmed dosen
                    } else {
                        abort(403, 'Anda tidak memiliki akses untuk menilai jurnal ini. Hanya dosen yang ditugaskan dan telah mengkonfirmasi ketersediaan yang dapat mengakses halaman ini.');
                    }
                }
            }
        } elseif (!in_array($user->role, ['super_admin', 'tim_akademik'])) {
            // Hanya super_admin dan tim_akademik yang bisa akses selain dosen
            abort(403, 'Anda tidak memiliki akses untuk menilai jurnal ini');
        }
    }

    /**
     * Check if dosen has confirmed availability for specific jurnal
     * STRICT VALIDATION: Only allow if dosen is assigned AND has confirmed "bisa"
     */
    private function isDosenConfirmedForJurnal($dosenId, $kode_blok, $jurnal_id)
    {
        try {
            // Cari jurnal reading yang sesuai
            $jurnalReading = JadwalJurnalReading::where('id', $jurnal_id)
                ->where('mata_kuliah_kode', $kode_blok)
                ->first();

            if (!$jurnalReading) {
                \Illuminate\Support\Facades\Log::info("Jurnal reading not found for {$kode_blok}/{$jurnal_id}");
                return false;
            }

            // STRICT CHECK: Dosen must be assigned to this jurnal
            $isAssigned = false;
            if ($jurnalReading->dosen_id == $dosenId) {
                $isAssigned = true;
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is assigned as single dosen for jurnal {$jurnalReading->id}");
            } elseif ($jurnalReading->dosen_ids && in_array($dosenId, $jurnalReading->dosen_ids)) {
                $isAssigned = true;
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is assigned in dosen_ids for jurnal {$jurnalReading->id}");
            }

            if (!$isAssigned) {
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is NOT assigned to jurnal {$jurnalReading->id}");
                return false;
            }

            // STRICT CHECK: Dosen must have confirmed "bisa"
            if ($jurnalReading->status_konfirmasi === 'bisa') {
                \Illuminate\Support\Facades\Log::info("Jurnal {$jurnalReading->id} has status_konfirmasi = bisa");
                return true;
            }

            // Check riwayat konfirmasi as additional verification
            $riwayat = \App\Models\RiwayatKonfirmasiDosen::where('dosen_id', $dosenId)
                ->where('jadwal_id', $jurnalReading->id)
                ->where('status_konfirmasi', 'bisa')
                ->first();

            if ($riwayat) {
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} has confirmed 'bisa' in riwayat for jurnal {$jurnalReading->id}");
                return true;
            }

            \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is assigned but NOT confirmed for jurnal {$jurnalReading->id}");
            return false;

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Error checking dosen confirmation for jurnal: " . $e->getMessage());
            return false;
        }
    }

    /**
     * Check if dosen has confirmed availability for specific jurnal semester antara
     * STRICT VALIDATION: Only allow if dosen is assigned AND has confirmed "bisa"
     */
    private function isDosenConfirmedForJurnalAntara($dosenId, $kode_blok, $jurnal_id)
    {
        try {
            // Cari jurnal reading yang sesuai untuk semester antara
            $jurnalReading = JadwalJurnalReading::where('id', $jurnal_id)
                ->where('mata_kuliah_kode', $kode_blok)
                ->whereNotNull('kelompok_kecil_antara_id') // Pastikan ini semester antara
                ->first();

            if (!$jurnalReading) {
                \Illuminate\Support\Facades\Log::info("Jurnal reading antara not found for {$kode_blok}/{$jurnal_id}");
                return false;
            }

            // STRICT CHECK: Dosen must be assigned to this jurnal
            $isAssigned = false;
            if ($jurnalReading->dosen_id == $dosenId) {
                $isAssigned = true;
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is assigned as single dosen for jurnal antara {$jurnalReading->id}");
            } elseif ($jurnalReading->dosen_ids && in_array($dosenId, $jurnalReading->dosen_ids)) {
                $isAssigned = true;
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is assigned in dosen_ids for jurnal antara {$jurnalReading->id}");
            }

            if (!$isAssigned) {
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is NOT assigned to jurnal antara {$jurnalReading->id}");
                return false;
            }

            // STRICT CHECK: Dosen must have confirmed "bisa"
            if ($jurnalReading->status_konfirmasi === 'bisa') {
                \Illuminate\Support\Facades\Log::info("Jurnal antara {$jurnalReading->id} has status_konfirmasi = bisa");
                return true;
            }

            // Check riwayat konfirmasi as additional verification
            $riwayat = \App\Models\RiwayatKonfirmasiDosen::where('dosen_id', $dosenId)
                ->where('jadwal_id', $jurnalReading->id)
                ->where('status_konfirmasi', 'bisa')
                ->first();

            if ($riwayat) {
                \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} has confirmed 'bisa' in riwayat for jurnal antara {$jurnalReading->id}");
                return true;
            }

            \Illuminate\Support\Facades\Log::info("Dosen {$dosenId} is assigned but NOT confirmed for jurnal antara {$jurnalReading->id}");
            return false;

        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Error checking dosen confirmation for jurnal antara: " . $e->getMessage());
            return false;
        }
    }
}
