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

            // Ambil data mahasiswa dari kelompok kecil yang terkait dengan jadwal jurnal reading
            // Gunakan kelompok_kecil_id dari jadwal untuk memastikan kita mengambil kelompok yang benar
            // Satu record KelompokKecil = satu mahasiswa, jadi kita perlu ambil semua record dengan nama_kelompok dan semester yang sama
            $mahasiswa = collect();
            
            if ($jurnalReading->kelompok_kecil_id && $jurnalReading->kelompokKecil) {
                $kelompokKecilJadwal = $jurnalReading->kelompokKecil;
                
                // Ambil semua mahasiswa di kelompok yang sama dengan semester yang sama
                // Filter berdasarkan nama_kelompok dan semester untuk memastikan hanya mengambil kelompok yang benar
                $semester = $kelompokKecilJadwal->semester;
                $namaKelompok = $kelompokKecilJadwal->nama_kelompok;
                
                $mahasiswa = KelompokKecil::where('nama_kelompok', $namaKelompok)
                    ->where('semester', $semester)
                    ->with('mahasiswa')
                    ->get()
                    ->map(function ($kelompok) {
                        if ($kelompok->mahasiswa) {
                            return [
                                'nim' => $kelompok->mahasiswa->nim,
                                'nama' => $kelompok->mahasiswa->name ?? $kelompok->mahasiswa->nama ?? '',
                            ];
                        }
                        return null;
                    })
                    ->filter(); // Hapus null values
            }

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

            // Ambil nama dosen pengampu dari jurnal reading
            $nama_dosen_pengampu = null;
            if ($jurnalReading->dosen) {
                $nama_dosen_pengampu = $jurnalReading->dosen->name ?? $jurnalReading->dosen->nama ?? null;
            } elseif ($jurnalReading->dosen_ids) {
                // Jika menggunakan dosen_ids, ambil dosen pertama
                $dosenIds = is_array($jurnalReading->dosen_ids) ? $jurnalReading->dosen_ids : json_decode($jurnalReading->dosen_ids, true);
                if (is_array($dosenIds) && !empty($dosenIds)) {
                    $dosen = \App\Models\User::find($dosenIds[0]);
                    if ($dosen) {
                        $nama_dosen_pengampu = $dosen->name ?? $dosen->nama ?? null;
                    }
                }
            }

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
                'nama_dosen_pengampu' => $nama_dosen_pengampu,
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

            // Ambil nama dosen pengampu dari jurnal reading
            $nama_dosen_pengampu = null;
            if ($jurnalReading->dosen) {
                $nama_dosen_pengampu = $jurnalReading->dosen->name ?? $jurnalReading->dosen->nama ?? null;
            } elseif ($jurnalReading->dosen_ids) {
                // Jika menggunakan dosen_ids, ambil dosen pertama
                $dosenIds = is_array($jurnalReading->dosen_ids) ? $jurnalReading->dosen_ids : json_decode($jurnalReading->dosen_ids, true);
                if (is_array($dosenIds) && !empty($dosenIds)) {
                    $dosen = \App\Models\User::find($dosenIds[0]);
                    if ($dosen) {
                        $nama_dosen_pengampu = $dosen->name ?? $dosen->nama ?? null;
                    }
                }
            }

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
                'nama_dosen_pengampu' => $nama_dosen_pengampu,
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
                'absensi.*.catatan' => 'nullable|string',
            ]);

            // Hapus data absensi yang lama
            AbsensiJurnal::where('jadwal_jurnal_reading_id', $jurnal_id)->delete();

            // Simpan data absensi baru
            foreach ($request->absensi as $absen) {
                AbsensiJurnal::create([
                    'jadwal_jurnal_reading_id' => $jurnal_id,
                    'mahasiswa_nim' => $absen['mahasiswa_nim'],
                    'hadir' => $absen['hadir'],
                    'catatan' => $absen['catatan'] ?? '',
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
                'absensi.*.catatan' => 'nullable|string',
            ]);

            // Hapus data absensi yang lama
            AbsensiJurnal::where('jadwal_jurnal_reading_id', $jurnal_id)->delete();

            // Simpan data absensi baru
            foreach ($request->absensi as $absen) {
                AbsensiJurnal::create([
                    'jadwal_jurnal_reading_id' => $jurnal_id,
                    'mahasiswa_nim' => $absen['mahasiswa_nim'],
                    'hadir' => $absen['hadir'],
                    'catatan' => $absen['catatan'] ?? '',
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
            // Silently fail
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

        if ($user->role === 'dosen') {
            // Cek apakah dosen ini ada di daftar dosen_ids
            $dosenIds = is_array($jurnalReading->dosen_ids) ? $jurnalReading->dosen_ids : json_decode($jurnalReading->dosen_ids, true);

            // Jika dosen_ids kosong atau null, cek konfirmasi dosen
            if (!is_array($dosenIds) || empty($dosenIds)) {
                // Check if dosen has confirmed availability for this jurnal
                if ($this->isDosenConfirmedForJurnal($user->id, $kode_blok, $jurnal_id)) {
                    // Don't abort - allow access for confirmed dosen
                } else {
                    abort(403, 'Anda tidak memiliki akses untuk menilai jurnal ini. Hanya dosen yang ditugaskan dan telah mengkonfirmasi ketersediaan yang dapat mengakses halaman ini.');
                }
            } else {
                // Convert dosen_ids to integers for comparison
                $dosenIdsInt = array_map('intval', $dosenIds);

                if (!in_array((int)$user->id, $dosenIdsInt)) {
                    // Check if dosen has confirmed availability for this jurnal
                    if ($this->isDosenConfirmedForJurnal($user->id, $kode_blok, $jurnal_id)) {
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

        if ($user->role === 'dosen') {
            // Cek apakah dosen ini ada di daftar dosen_ids
            $dosenIds = is_array($jurnalReading->dosen_ids) ? $jurnalReading->dosen_ids : json_decode($jurnalReading->dosen_ids, true);

            // Jika dosen_ids kosong atau null, cek konfirmasi dosen
            if (!is_array($dosenIds) || empty($dosenIds)) {
                // Check if dosen has confirmed availability for this jurnal
                if ($this->isDosenConfirmedForJurnalAntara($user->id, $kode_blok, $jurnal_id)) {
                    // Don't abort - allow access for confirmed dosen
                } else {
                    abort(403, 'Anda tidak memiliki akses untuk menilai jurnal ini. Hanya dosen yang ditugaskan dan telah mengkonfirmasi ketersediaan yang dapat mengakses halaman ini.');
                }
            } else {
                // Convert dosen_ids to integers for comparison
                $dosenIdsInt = array_map('intval', $dosenIds);

                if (!in_array((int)$user->id, $dosenIdsInt)) {
                    // Check if dosen has confirmed availability for this jurnal
                    if ($this->isDosenConfirmedForJurnalAntara($user->id, $kode_blok, $jurnal_id)) {
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
                return false;
            }

            // STRICT CHECK: Dosen must be assigned to this jurnal
            $isAssigned = false;
            if ($jurnalReading->dosen_id == $dosenId) {
                $isAssigned = true;
            } elseif ($jurnalReading->dosen_ids && in_array($dosenId, $jurnalReading->dosen_ids)) {
                $isAssigned = true;
            }

            if (!$isAssigned) {
                return false;
            }

            // STRICT CHECK: Dosen must have confirmed "bisa"
            if ($jurnalReading->status_konfirmasi === 'bisa') {
                return true;
            }

            // Check riwayat konfirmasi as additional verification
            $riwayat = \App\Models\RiwayatKonfirmasiDosen::where('dosen_id', $dosenId)
                ->where('jadwal_id', $jurnalReading->id)
                ->where('status_konfirmasi', 'bisa')
                ->first();

            if ($riwayat) {
                return true;
            }

            return false;
        } catch (\Exception $e) {
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
                return false;
            }

            // STRICT CHECK: Dosen must be assigned to this jurnal
            $isAssigned = false;
            if ($jurnalReading->dosen_id == $dosenId) {
                $isAssigned = true;
            } elseif ($jurnalReading->dosen_ids && in_array($dosenId, $jurnalReading->dosen_ids)) {
                $isAssigned = true;
            }

            if (!$isAssigned) {
                return false;
            }

            // STRICT CHECK: Dosen must have confirmed "bisa"
            if ($jurnalReading->status_konfirmasi === 'bisa') {
                return true;
            }

            // Check riwayat konfirmasi as additional verification
            $riwayat = \App\Models\RiwayatKonfirmasiDosen::where('dosen_id', $dosenId)
                ->where('jadwal_id', $jurnalReading->id)
                ->where('status_konfirmasi', 'bisa')
                ->first();

            if ($riwayat) {
                return true;
            }

            return false;
        } catch (\Exception $e) {
            return false;
        }
    }
}
