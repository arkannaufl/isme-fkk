<?php

namespace App\Http\Controllers;

use App\Models\JadwalJurnalReading;
use App\Models\KelompokKecil;
use App\Models\User;
use App\Models\Ruangan;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Storage;

class JadwalJurnalReadingController extends Controller
{
    // List semua jadwal Jurnal Reading untuk satu mata kuliah blok
    public function index($kode)
    {
        $jadwal = JadwalJurnalReading::with(['kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan'])
            ->where('mata_kuliah_kode', $kode)
            ->orderBy('tanggal')
            ->orderBy('jam_mulai')
            ->get();
            
        // Tambahkan nama dosen untuk setiap jadwal
        foreach ($jadwal as $j) {
            if ($j->dosen_ids && is_array($j->dosen_ids)) {
                $dosenNames = User::whereIn('id', $j->dosen_ids)->pluck('name')->toArray();
                $j->dosen_names = implode(', ', $dosenNames);
            }
        }
        
        return response()->json($jadwal);
    }

    // Tambah jadwal Jurnal Reading baru
    public function store(Request $request, $kode)
    {
        // Debug: log semua data yang diterima
        \Illuminate\Support\Facades\Log::info('Store Jurnal Reading - All request data:', $request->all());
        \Illuminate\Support\Facades\Log::info('Store Jurnal Reading - Content type:', ['content_type' => $request->header('Content-Type')]);
        
        $data = $request->validate([
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
            'kelompok_kecil_id' => 'nullable',
            'kelompok_kecil_antara_id' => 'nullable|exists:kelompok_kecil_antara,id',
            'dosen_id' => 'nullable|exists:users,id',
            'dosen_ids' => 'nullable|string', // Ubah ke string untuk menerima JSON
            'ruangan_id' => 'required|exists:ruangan,id',
            'topik' => 'required|string',
            'file_jurnal' => 'nullable|file|mimes:xlsx,xls,docx,doc,pdf|max:10240', // 10MB max
        ]);

        // Debug: log data setelah validasi
        \Illuminate\Support\Facades\Log::info('Store Jurnal Reading - Data after validation:', $data);

        // Validasi: harus ada salah satu dari kelompok_kecil_id atau kelompok_kecil_antara_id
        if ((!isset($data['kelompok_kecil_id']) || !$data['kelompok_kecil_id']) && 
            (!isset($data['kelompok_kecil_antara_id']) || !$data['kelompok_kecil_antara_id'])) {
            return response()->json([
                'message' => 'Kelompok kecil harus dipilih.',
                'errors' => [
                    'kelompok_kecil_id' => ['Kelompok kecil harus dipilih.']
                ]
            ], 422);
        }

        // Untuk semester antara, pastikan kelompok_kecil_id diset ke null jika menggunakan kelompok_kecil_antara_id
        if (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
            $data['kelompok_kecil_id'] = null;
        }

        // Proses dosen_ids jika dikirim sebagai string JSON (dari FormData)
        if (isset($data['dosen_ids']) && is_string($data['dosen_ids'])) {
            $data['dosen_ids'] = json_decode($data['dosen_ids'], true);
            \Illuminate\Support\Facades\Log::info('Store Jurnal Reading - dosen_ids after JSON decode:', ['dosen_ids' => $data['dosen_ids']]);
            
            // Validasi manual untuk dosen_ids setelah JSON decode
            if (!is_array($data['dosen_ids'])) {
                return response()->json([
                    'message' => 'Format dosen_ids tidak valid.',
                    'errors' => [
                        'dosen_ids' => ['Format dosen_ids tidak valid.']
                    ]
                ], 422);
            }
            
            // Validasi setiap ID dosen
            foreach ($data['dosen_ids'] as $dosenId) {
                if (!\App\Models\User::where('id', $dosenId)->exists()) {
                    return response()->json([
                        'message' => 'Dosen tidak ditemukan.',
                        'errors' => [
                            'dosen_ids' => ["Dosen dengan ID {$dosenId} tidak ditemukan."]
                        ]
                    ], 422);
                }
            }
        }

        // Pastikan dosen_id diset ke null jika menggunakan dosen_ids
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
            $data['dosen_id'] = null;
        }

        $data['mata_kuliah_kode'] = $kode;

        // Handle file upload
        if ($request->hasFile('file_jurnal')) {
            $file = $request->file('file_jurnal');
            $fileName = $file->getClientOriginalName();
            $filePath = $file->storeAs('jurnal_reading', $fileName, 'public');
            $data['file_jurnal'] = $filePath;
        }

        // Validasi kapasitas ruangan
        $kapasitasMessage = $this->validateRuanganCapacity($data);
        if ($kapasitasMessage) {
            return response()->json(['message' => $kapasitasMessage], 422);
        }

        // Validasi bentrok
        $bentrokMessage = $this->checkBentrokWithDetail($data, null);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        $jadwal = JadwalJurnalReading::create($data);



        // Log activity


        activity()


            ->log('Jadwal Jurnal Reading deleted');



        // Log activity


        activity()


            ->log('Jadwal Jurnal Reading updated');



        // Log activity


        activity()


            ->log('Jadwal Jurnal Reading created');
        
        // Load relasi dan tambahkan dosen_names
        $jadwal->load(['kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan', 'mataKuliah']);
        
        // Tambahkan nama dosen untuk response
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
            $jadwal->dosen_names = implode(', ', $dosenNames);
        }
        
        // Buat notifikasi untuk dosen yang di-assign
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            foreach ($jadwal->dosen_ids as $dosenId) {
                $dosen = User::find($dosenId);
                if ($dosen) {
                    \App\Models\Notification::create([
                        'user_id' => $dosenId,
                        'title' => 'Jadwal Jurnal Reading Baru',
                        'message' => "Anda telah di-assign untuk mengajar Jurnal Reading {$jadwal->mataKuliah->nama} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}. Silakan konfirmasi ketersediaan Anda.",
                        'type' => 'info',
                        'data' => [
                            'topik' => $jadwal->topik,
                            'materi' => $jadwal->topik,
                            'ruangan' => $jadwal->ruangan->nama,
                            'tanggal' => $jadwal->tanggal,
                            'jadwal_id' => $jadwal->id,
                            'jam_mulai' => $jadwal->jam_mulai,
                            'jadwal_type' => 'jurnal_reading',
                            'jam_selesai' => $jadwal->jam_selesai,
                            'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                            'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                            'file_jurnal' => $jadwal->file_jurnal,
                            'dosen_id' => $dosen->id,
                            'dosen_name' => $dosen->name,
                            'dosen_role' => $dosen->role
                        ]
                    ]);

                }
            }
        } elseif ($jadwal->dosen_id) {
            \App\Models\Notification::create([
                'user_id' => $jadwal->dosen_id,
                'title' => 'Jadwal Jurnal Reading Baru',
                'message' => "Anda telah di-assign untuk mengajar Jurnal Reading {$jadwal->mataKuliah->nama} pada tanggal {$jadwal->tanggal} jam {$jadwal->jam_mulai}-{$jadwal->jam_selesai} di ruangan {$jadwal->ruangan->nama}. Silakan konfirmasi ketersediaan Anda.",
                'type' => 'info',
                'data' => [
                    'topik' => $jadwal->topik,
                    'materi' => $jadwal->topik,
                    'ruangan' => $jadwal->ruangan->nama,
                    'tanggal' => $jadwal->tanggal,
                    'jadwal_id' => $jadwal->id,
                    'jam_mulai' => $jadwal->jam_mulai,
                    'jadwal_type' => 'jurnal_reading',
                    'jam_selesai' => $jadwal->jam_selesai,
                    'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                    'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                    'file_jurnal' => $jadwal->file_jurnal,
                    'dosen_id' => $jadwal->dosen->id,
                    'dosen_name' => $jadwal->dosen->name,
                    'dosen_role' => $jadwal->dosen->role
                ]
            ]);
        }
        
        return response()->json($jadwal, Response::HTTP_CREATED);
    }

    // Update jadwal Jurnal Reading
    public function update(Request $request, $kode, $id)
    {
        $jadwal = JadwalJurnalReading::findOrFail($id);

        // Debug: log semua data yang diterima
        \Illuminate\Support\Facades\Log::info('Update Jurnal Reading - All request data:', $request->all());
        \Illuminate\Support\Facades\Log::info('Update Jurnal Reading - Has file:', ['has_file' => $request->hasFile('file_jurnal')]);
        \Illuminate\Support\Facades\Log::info('Update Jurnal Reading - Content type:', ['content_type' => $request->header('Content-Type')]);

        $data = $request->validate([
            'tanggal' => 'required|date',
            'jam_mulai' => 'required|string',
            'jam_selesai' => 'required|string',
            'jumlah_sesi' => 'required|integer|min:1|max:6',
            'kelompok_kecil_id' => 'nullable',
            'kelompok_kecil_antara_id' => 'nullable|exists:kelompok_kecil_antara,id',
            'dosen_id' => 'nullable|exists:users,id',
            'dosen_ids' => 'nullable|string', // Ubah ke string untuk menerima JSON
            'ruangan_id' => 'required|exists:ruangan,id',
            'topik' => 'required|string',
            'file_jurnal' => 'nullable|file|mimes:xlsx,xls,docx,doc,pdf|max:10240',
        ]);

        // Validasi: harus ada salah satu dari kelompok_kecil_id atau kelompok_kecil_antara_id
        if ((!isset($data['kelompok_kecil_id']) || !$data['kelompok_kecil_id']) && 
            (!isset($data['kelompok_kecil_antara_id']) || !$data['kelompok_kecil_antara_id'])) {
            return response()->json([
                'message' => 'Kelompok kecil harus dipilih.',
                'errors' => [
                    'kelompok_kecil_id' => ['Kelompok kecil harus dipilih.']
                ]
            ], 422);
        }

        // Untuk semester antara, pastikan kelompok_kecil_id diset ke null jika menggunakan kelompok_kecil_antara_id
        if (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
            $data['kelompok_kecil_id'] = null;
        }

        // Proses dosen_ids jika dikirim sebagai string JSON (dari FormData)
        if (isset($data['dosen_ids']) && is_string($data['dosen_ids'])) {
            $data['dosen_ids'] = json_decode($data['dosen_ids'], true);
            
            // Validasi manual untuk dosen_ids setelah JSON decode
            if (!is_array($data['dosen_ids'])) {
                return response()->json([
                    'message' => 'Format dosen_ids tidak valid.',
                    'errors' => [
                        'dosen_ids' => ['Format dosen_ids tidak valid.']
                    ]
                ], 422);
            }
            
            // Validasi setiap ID dosen
            foreach ($data['dosen_ids'] as $dosenId) {
                if (!\App\Models\User::where('id', $dosenId)->exists()) {
                    return response()->json([
                        'message' => 'Dosen tidak ditemukan.',
                        'errors' => [
                            'dosen_ids' => ["Dosen dengan ID {$dosenId} tidak ditemukan."]
                        ]
                    ], 422);
                }
            }
        }

        // Pastikan dosen_id diset ke null jika menggunakan dosen_ids
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
            $data['dosen_id'] = null;
        }

        $data['mata_kuliah_kode'] = $kode;

        // Handle file upload
        if ($request->hasFile('file_jurnal')) {
            // Hapus file lama jika ada
            if ($jadwal->file_jurnal) {
                Storage::disk('public')->delete($jadwal->file_jurnal);
            }

            $file = $request->file('file_jurnal');
            $fileName = $file->getClientOriginalName();
            $filePath = $file->storeAs('jurnal_reading', $fileName, 'public');
            $data['file_jurnal'] = $filePath;
        }

        // Validasi kapasitas ruangan
        $kapasitasMessage = $this->validateRuanganCapacity($data);
        if ($kapasitasMessage) {
            return response()->json(['message' => $kapasitasMessage], 422);
        }

        // Validasi bentrok (kecuali dirinya sendiri)
        $bentrokMessage = $this->checkBentrokWithDetail($data, $id);
        if ($bentrokMessage) {
            return response()->json(['message' => $bentrokMessage], 422);
        }

        // Reset penilaian submitted status jika jadwal diubah
        // Ini memungkinkan dosen pengampu untuk mengisi ulang penilaian
        $jadwal->resetPenilaianSubmitted();
        
        $jadwal->update($data);


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading deleted');


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading updated');


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading created');
        
        // Load relasi dan tambahkan dosen_names
        $jadwal->load(['kelompokKecil', 'kelompokKecilAntara', 'dosen', 'ruangan']);
        
        // Tambahkan nama dosen untuk response
        if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
            $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
            $jadwal->dosen_names = implode(', ', $dosenNames);
        }
        
        return response()->json($jadwal);
    }

    // Hapus jadwal Jurnal Reading
    public function destroy($kode, $id)
    {
        $jadwal = JadwalJurnalReading::findOrFail($id);

        // Hapus file jika ada
        if ($jadwal->file_jurnal) {
            Storage::disk('public')->delete($jadwal->file_jurnal);
        }

        $jadwal->delete();


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading deleted');


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading updated');


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading created');
        return response()->json(['message' => 'Jadwal Jurnal Reading berhasil dihapus']);
    }

    // Download file jurnal
    public function downloadFile($kode, $id)
    {
        try {
            \Log::info('Download Jurnal Reading - Start:', [
                'kode' => $kode,
                'id' => $id,
                'request_url' => request()->url(),
                'user_agent' => request()->userAgent()
            ]);

            $jadwal = JadwalJurnalReading::findOrFail($id);
            
            \Log::info('Download Jurnal Reading - Found jadwal:', [
                'kode' => $kode,
                'id' => $id,
                'file_jurnal' => $jadwal->file_jurnal,
                'exists' => $jadwal->file_jurnal ? Storage::disk('public')->exists($jadwal->file_jurnal) : false
            ]);

            if (!$jadwal->file_jurnal || !Storage::disk('public')->exists($jadwal->file_jurnal)) {
                \Log::warning('Download Jurnal Reading - File not found:', [
                    'kode' => $kode,
                    'id' => $id,
                    'file_jurnal' => $jadwal->file_jurnal
                ]);
                return response()->json(['message' => 'File tidak ditemukan'], 404);
            }

            $path = Storage::disk('public')->path($jadwal->file_jurnal);
            $fileName = basename($jadwal->file_jurnal);

            \Log::info('Download Jurnal Reading - Success:', [
                'path' => $path,
                'fileName' => $fileName,
                'file_exists' => file_exists($path)
            ]);

            return response()->download($path, $fileName);
        } catch (\Exception $e) {
            \Log::error('Error downloading jurnal reading:', [
                'kode' => $kode,
                'id' => $id,
                'error' => $e->getMessage(),
                'trace' => $e->getTraceAsString()
            ]);
            
            return response()->json(['message' => 'Error downloading file: ' . $e->getMessage()], 500);
        }
    }

    // Helper validasi bentrok antar jenis baris
    private function isBentrok($data, $ignoreId = null)
    {
        // Cek bentrok dengan jadwal Jurnal Reading
        $jurnalBentrok = JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('kelompok_kecil_id', $data['kelompok_kecil_id'])
                  ->orWhere('dosen_id', $data['dosen_id'])
                  ->orWhere('ruangan_id', $data['ruangan_id']);
            })
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        if ($ignoreId) {
            $jurnalBentrok->where('id', '!=', $ignoreId);
        }
        
        // Cek bentrok dengan jadwal PBL
        $pblBentrok = \App\Models\JadwalPBL::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('kelompok_kecil_id', $data['kelompok_kecil_id'])
                  ->orWhere('dosen_id', $data['dosen_id'])
                  ->orWhere('ruangan_id', $data['ruangan_id']);
            })
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });
            
        // Cek bentrok dengan jadwal Kuliah Besar
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('dosen_id', $data['dosen_id'])
                  ->orWhere('ruangan_id', $data['ruangan_id']);
            })
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });
            
        // Cek bentrok dengan jadwal Agenda Khusus
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });
            
        // Cek bentrok dengan jadwal Praktikum
        $praktikumBentrok = \App\Models\JadwalPraktikum::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });

        // Cek bentrok dengan kelompok besar (jika ada kelompok_besar_id di jadwal lain)
        $kelompokBesarBentrok = $this->checkKelompokBesarBentrok($data, $ignoreId);
            
        return $jurnalBentrok->exists() || $pblBentrok->exists() || 
               $kuliahBesarBentrok->exists() || $agendaKhususBentrok->exists() || 
               $praktikumBentrok->exists() || $kelompokBesarBentrok;
    }

    private function checkBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Tentukan kelompok kecil ID berdasarkan jenis semester
        $kelompokKecilId = null;
        if (isset($data['kelompok_kecil_id']) && $data['kelompok_kecil_id']) {
            $kelompokKecilId = $data['kelompok_kecil_id'];
        } elseif (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
            $kelompokKecilId = $data['kelompok_kecil_antara_id'];
        }

        // Cek bentrok dengan jadwal Jurnal Reading
        $jurnalQuery = JadwalJurnalReading::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data, $kelompokKecilId) {
                $q->where('ruangan_id', $data['ruangan_id']);
                
                // Cek bentrok kelompok kecil
                if ($kelompokKecilId) {
                    $q->orWhere('kelompok_kecil_id', $kelompokKecilId)
                      ->orWhere('kelompok_kecil_antara_id', $kelompokKecilId);
                }
                
                // Cek bentrok dosen (single dosen_id)
                if (isset($data['dosen_id']) && $data['dosen_id']) {
                    $q->orWhere('dosen_id', $data['dosen_id']);
                }
                
                // Cek bentrok dosen (multiple dosen_ids)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    $q->orWhereIn('dosen_id', $data['dosen_ids']);
                }
            })
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        
        if ($ignoreId) {
            $jurnalQuery->where('id', '!=', $ignoreId);
        }
        
        $jurnalBentrok = $jurnalQuery;
        
        $jadwalBentrokJurnal = $jurnalBentrok->first();
        if ($jadwalBentrokJurnal) {
            $jamMulaiFormatted = str_replace(':', '.', $jadwalBentrokJurnal->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $jadwalBentrokJurnal->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $jadwalBentrokJurnal);
            return "Jadwal bentrok dengan Jadwal Jurnal Reading pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }
        
        // Cek bentrok dengan jadwal PBL
        $pblQuery = \App\Models\JadwalPBL::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data, $kelompokKecilId) {
                $q->where('ruangan_id', $data['ruangan_id']);
                
                // Cek bentrok kelompok kecil
                if ($kelompokKecilId) {
                    $q->orWhere('kelompok_kecil_id', $kelompokKecilId)
                      ->orWhere('kelompok_kecil_antara_id', $kelompokKecilId);
                }
                
                // Cek bentrok dosen (single dosen_id)
                if (isset($data['dosen_id']) && $data['dosen_id']) {
                    $q->orWhere('dosen_id', $data['dosen_id']);
                }
                
                // Cek bentrok dosen (multiple dosen_ids)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    $q->orWhereIn('dosen_id', $data['dosen_ids']);
                }
            })
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        
        $pblBentrok = $pblQuery->first();
            
        if ($pblBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $pblBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $pblBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $pblBentrok);
            return "Jadwal bentrok dengan Jadwal PBL pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }
        
        // Cek bentrok dengan jadwal Kuliah Besar
        $kuliahBesarQuery = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('ruangan_id', $data['ruangan_id']);
                
                // Cek bentrok dosen (single dosen_id)
                if (isset($data['dosen_id']) && $data['dosen_id']) {
                    $q->orWhere('dosen_id', $data['dosen_id']);
                }
                
                // Cek bentrok dosen (multiple dosen_ids)
                if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
                    $q->orWhereIn('dosen_id', $data['dosen_ids']);
                }
            })
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            });
        
        $kuliahBesarBentrok = $kuliahBesarQuery->first();
            
        if ($kuliahBesarBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $kuliahBesarBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $kuliahBesarBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $kuliahBesarBentrok);
            return "Jadwal bentrok dengan Jadwal Kuliah Besar pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }
        
        // Cek bentrok dengan jadwal Agenda Khusus
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();
            
        if ($agendaKhususBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $agendaKhususBentrok);
            return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }
        
        // Cek bentrok dengan jadwal Praktikum
        $praktikumBentrok = \App\Models\JadwalPraktikum::where('tanggal', $data['tanggal'])
            ->where('ruangan_id', $data['ruangan_id'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->first();
            
        if ($praktikumBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $praktikumBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $praktikumBentrok->jam_selesai);
            $bentrokReason = $this->getBentrokReason($data, $praktikumBentrok);
            return "Jadwal bentrok dengan Jadwal Praktikum pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan kelompok besar (jika ada kelompok_besar_id di jadwal lain)
        $kelompokBesarBentrokMessage = $this->checkKelompokBesarBentrokWithDetail($data, $ignoreId);
        if ($kelompokBesarBentrokMessage) {
            return $kelompokBesarBentrokMessage;
        }

        return null; // Tidak ada bentrok
    }

    /**
     * Mendapatkan alasan bentrok yang detail
     */
    private function getBentrokReason($data, $jadwalBentrok): string
    {
        $reasons = [];
        
        // Cek bentrok dosen (single dosen_id)
        if (isset($data['dosen_id']) && isset($jadwalBentrok->dosen_id) && $data['dosen_id'] == $jadwalBentrok->dosen_id) {
            $dosen = \App\Models\User::find($data['dosen_id']);
            $reasons[] = "Dosen: " . ($dosen ? $dosen->name : 'Tidak diketahui');
        }
        
        // Cek bentrok dosen (multiple dosen_ids)
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids']) && !empty($data['dosen_ids'])) {
            if (isset($jadwalBentrok->dosen_id) && in_array($jadwalBentrok->dosen_id, $data['dosen_ids'])) {
                $dosen = \App\Models\User::find($jadwalBentrok->dosen_id);
                $reasons[] = "Dosen: " . ($dosen ? $dosen->name : 'Tidak diketahui');
            }
            
            // Cek jika jadwal yang bentrok juga menggunakan multiple dosen
            if (isset($jadwalBentrok->dosen_ids) && is_array($jadwalBentrok->dosen_ids)) {
                $intersectingDosenIds = array_intersect($data['dosen_ids'], $jadwalBentrok->dosen_ids);
                if (!empty($intersectingDosenIds)) {
                    $dosenNames = \App\Models\User::whereIn('id', $intersectingDosenIds)->pluck('name')->toArray();
                    $reasons[] = "Dosen: " . implode(', ', $dosenNames);
                }
            }
        }
        
        // Cek bentrok ruangan
        if (isset($data['ruangan_id']) && isset($jadwalBentrok->ruangan_id) && $data['ruangan_id'] == $jadwalBentrok->ruangan_id) {
            $ruangan = \App\Models\Ruangan::find($data['ruangan_id']);
            $reasons[] = "Ruangan: " . ($ruangan ? $ruangan->nama : 'Tidak diketahui');
        }
        
        // Cek bentrok kelompok kecil
        if (isset($data['kelompok_kecil_id']) && isset($jadwalBentrok->kelompok_kecil_id) && $data['kelompok_kecil_id'] == $jadwalBentrok->kelompok_kecil_id) {
            $kelompokKecil = \App\Models\KelompokKecil::find($data['kelompok_kecil_id']);
            $reasons[] = "Kelompok Kecil: " . ($kelompokKecil ? $kelompokKecil->nama_kelompok : 'Tidak diketahui');
        }
        
        // Cek bentrok kelompok kecil antara
        if (isset($data['kelompok_kecil_antara_id']) && isset($jadwalBentrok->kelompok_kecil_antara_id) && $data['kelompok_kecil_antara_id'] == $jadwalBentrok->kelompok_kecil_antara_id) {
            $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($data['kelompok_kecil_antara_id']);
            $reasons[] = "Kelompok Kecil Antara: " . ($kelompokKecilAntara ? $kelompokKecilAntara->nama_kelompok : 'Tidak diketahui');
        }
        
        return implode(', ', $reasons);
    }

    /**
     * Cek bentrok dengan kelompok besar
     */
    private function checkKelompokBesarBentrok($data, $ignoreId = null): bool
    {
        // Ambil mahasiswa dalam kelompok kecil yang dipilih
        $mahasiswaIds = [];
        
        if (isset($data['kelompok_kecil_id']) && $data['kelompok_kecil_id']) {
            // Untuk semester reguler
            $mahasiswaIds = \App\Models\KelompokKecil::where('id', $data['kelompok_kecil_id'])
                ->pluck('mahasiswa_id')
                ->toArray();
        } elseif (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
            // Untuk semester antara
            $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($data['kelompok_kecil_antara_id']);
            if ($kelompokKecilAntara) {
                $mahasiswaIds = $kelompokKecilAntara->mahasiswa_ids ?? [];
            }
        }

        if (empty($mahasiswaIds)) {
            return false;
        }

        // Cek bentrok dengan jadwal Kuliah Besar yang menggunakan kelompok besar dari mahasiswa yang sama
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokBesar', function($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->exists();

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar dari mahasiswa yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokBesar', function($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->exists();

        return $kuliahBesarBentrok || $agendaKhususBentrok;
    }

    /**
     * Cek bentrok dengan kelompok besar dengan detail
     */
    private function checkKelompokBesarBentrokWithDetail($data, $ignoreId = null): ?string
    {
        // Ambil mahasiswa dalam kelompok kecil yang dipilih
        $mahasiswaIds = [];
        
        if (isset($data['kelompok_kecil_id']) && $data['kelompok_kecil_id']) {
            // Untuk semester reguler
            $mahasiswaIds = \App\Models\KelompokKecil::where('id', $data['kelompok_kecil_id'])
                ->pluck('mahasiswa_id')
                ->toArray();
        } elseif (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
            // Untuk semester antara
            $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($data['kelompok_kecil_antara_id']);
            if ($kelompokKecilAntara) {
                $mahasiswaIds = $kelompokKecilAntara->mahasiswa_ids ?? [];
            }
        }

        if (empty($mahasiswaIds)) {
            return null;
        }

        // Cek bentrok dengan jadwal Kuliah Besar yang menggunakan kelompok besar dari mahasiswa yang sama
        $kuliahBesarBentrok = \App\Models\JadwalKuliahBesar::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokBesar', function($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->first();

        if ($kuliahBesarBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $kuliahBesarBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $kuliahBesarBentrok->jam_selesai);
            
            // Tentukan nama kelompok berdasarkan jenis semester
            $namaKelompok = 'Tidak diketahui';
            if (isset($data['kelompok_kecil_id']) && $data['kelompok_kecil_id']) {
                $kelompokKecil = \App\Models\KelompokKecil::find($data['kelompok_kecil_id']);
                $namaKelompok = $kelompokKecil ? $kelompokKecil->nama_kelompok : 'Tidak diketahui';
            } elseif (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
                $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($data['kelompok_kecil_antara_id']);
                $namaKelompok = $kelompokKecilAntara ? $kelompokKecilAntara->nama_kelompok : 'Tidak diketahui';
            }
            
            $bentrokReason = "Kelompok Kecil vs Kelompok Besar: " . $namaKelompok;
            return "Jadwal bentrok dengan Jadwal Kuliah Besar pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        // Cek bentrok dengan jadwal Agenda Khusus yang menggunakan kelompok besar dari mahasiswa yang sama
        $agendaKhususBentrok = \App\Models\JadwalAgendaKhusus::where('tanggal', $data['tanggal'])
            ->where(function($q) use ($data) {
                $q->where('jam_mulai', '<', $data['jam_selesai'])
                   ->where('jam_selesai', '>', $data['jam_mulai']);
            })
            ->whereHas('kelompokBesar', function($q) use ($mahasiswaIds) {
                $q->whereIn('mahasiswa_id', $mahasiswaIds);
            })
            ->first();

        if ($agendaKhususBentrok) {
            $jamMulaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_mulai);
            $jamSelesaiFormatted = str_replace(':', '.', $agendaKhususBentrok->jam_selesai);
            
            // Tentukan nama kelompok berdasarkan jenis semester
            $namaKelompok = 'Tidak diketahui';
            if (isset($data['kelompok_kecil_id']) && $data['kelompok_kecil_id']) {
                $kelompokKecil = \App\Models\KelompokKecil::find($data['kelompok_kecil_id']);
                $namaKelompok = $kelompokKecil ? $kelompokKecil->nama_kelompok : 'Tidak diketahui';
            } elseif (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
                $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($data['kelompok_kecil_antara_id']);
                $namaKelompok = $kelompokKecilAntara ? $kelompokKecilAntara->nama_kelompok : 'Tidak diketahui';
            }
            
            $bentrokReason = "Kelompok Kecil vs Kelompok Besar: " . $namaKelompok;
            return "Jadwal bentrok dengan Jadwal Agenda Khusus pada tanggal " . 
                   date('d/m/Y', strtotime($data['tanggal'])) . " jam " . 
                   $jamMulaiFormatted . "-" . $jamSelesaiFormatted . " (" . $bentrokReason . ")";
        }

        return null;
    }

    /**
     * Validasi kapasitas ruangan berdasarkan jumlah mahasiswa
     */
    private function validateRuanganCapacity($data)
    {
        // Ambil data ruangan
        $ruangan = Ruangan::find($data['ruangan_id']);
        if (!$ruangan) {
            return 'Ruangan tidak ditemukan';
        }

        // Tentukan kelompok dan jumlah mahasiswa berdasarkan jenis semester
        $jumlahMahasiswa = 0;
        $namaKelompok = '';
        
        if (isset($data['kelompok_kecil_id']) && $data['kelompok_kecil_id']) {
            // Untuk semester reguler
            $kelompokKecil = KelompokKecil::find($data['kelompok_kecil_id']);
            if (!$kelompokKecil) {
                return 'Kelompok kecil tidak ditemukan';
            }
            
            $jumlahMahasiswa = KelompokKecil::where('nama_kelompok', $kelompokKecil->nama_kelompok)
                                           ->where('semester', $kelompokKecil->semester)
                                           ->count();
            $namaKelompok = $kelompokKecil->nama_kelompok;
        } elseif (isset($data['kelompok_kecil_antara_id']) && $data['kelompok_kecil_antara_id']) {
            // Untuk semester antara
            $kelompokKecilAntara = \App\Models\KelompokKecilAntara::find($data['kelompok_kecil_antara_id']);
            if (!$kelompokKecilAntara) {
                return 'Kelompok kecil antara tidak ditemukan';
            }
            
            $jumlahMahasiswa = count($kelompokKecilAntara->mahasiswa_ids ?? []);
            $namaKelompok = $kelompokKecilAntara->nama_kelompok;
        } else {
            return 'Kelompok kecil harus dipilih';
        }

        // Hitung total (mahasiswa + dosen)
        $jumlahDosen = 1; // Default 1 dosen
        if (isset($data['dosen_ids']) && is_array($data['dosen_ids'])) {
            $jumlahDosen = count($data['dosen_ids']);
        }
        
        $totalMahasiswa = $jumlahMahasiswa + $jumlahDosen;

        // Cek apakah kapasitas ruangan mencukupi
        if ($totalMahasiswa > $ruangan->kapasitas) {
            return "Kapasitas ruangan tidak mencukupi. Ruangan {$ruangan->nama} hanya dapat menampung {$ruangan->kapasitas} orang, sedangkan diperlukan {$totalMahasiswa} orang (kelompok {$namaKelompok} {$jumlahMahasiswa} mahasiswa + {$jumlahDosen} dosen).";
        }

        return null; // Kapasitas mencukupi
    }

    // Get jadwal Jurnal Reading untuk dosen tertentu
    public function getJadwalForDosen($dosenId, Request $request)
    {
        try {
            // Check if user exists
            $user = User::find($dosenId);
            if (!$user) {
                return response()->json([
                    'message' => 'Dosen tidak ditemukan',
                    'data' => []
                ], 404);
            }

            $semesterType = $request->query('semester_type');
            \Log::info("Getting jadwal jurnal reading for dosen ID: {$dosenId}, semester_type: {$semesterType}");

            // Use raw query to get data first
            $rawJadwal = \DB::table('jadwal_jurnal_reading')
                ->where(function($q) use ($dosenId) {
                    $q->where('dosen_id', $dosenId)
                      ->orWhereJsonContains('dosen_ids', $dosenId);
                })
                ->when($semesterType === 'antara', function($q) {
                    $q->whereNotNull('kelompok_kecil_antara_id');
                })
                ->when($semesterType === 'reguler', function($q) {
                    $q->whereNull('kelompok_kecil_antara_id');
                })
                ->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();
            
            \Log::info("Raw query found {$rawJadwal->count()} records for dosen ID: {$dosenId}");
            
            // Convert to Eloquent models for relationships
            $jadwal = JadwalJurnalReading::with([
                'mataKuliah:kode,nama,semester',
                'ruangan:id,nama,gedung',
                'dosen:id,name',
                'kelompokKecil:id,nama_kelompok',
                'kelompokKecilAntara:id,nama_kelompok'
            ])
            ->select([
                'id', 'mata_kuliah_kode', 'tanggal', 'jam_mulai', 'jam_selesai',
                'topik', 'ruangan_id', 'dosen_id', 'dosen_ids', 'jumlah_sesi',
                'kelompok_kecil_id', 'kelompok_kecil_antara_id', 'file_jurnal',
                'status_konfirmasi', 'alasan_konfirmasi', 'created_at'
            ])
            ->whereIn('id', $rawJadwal->pluck('id'))->get();


            \Log::info("Found {$jadwal->count()} JadwalJurnalReading records for dosen ID: {$dosenId}");
            
            if ($jadwal->count() === 0) {
                \Log::warning("No jadwal found for dosen ID: {$dosenId}");
                return response()->json([
                    'message' => 'Tidak ada jadwal Jurnal Reading untuk dosen ini',
                    'data' => []
                ]);
            }
            
            $mappedJadwal = $jadwal->map(function ($jadwal) {
                // Determine semester type based on kelompok_kecil_antara_id
                $semesterType = $jadwal->kelompok_kecil_antara_id ? 'antara' : 'reguler';
                
                // Get dosen names from dosen_ids array
                $dosenNames = [];
                if ($jadwal->dosen_ids && is_array($jadwal->dosen_ids)) {
                    $dosenNames = User::whereIn('id', $jadwal->dosen_ids)->pluck('name')->toArray();
                } elseif ($jadwal->dosen) {
                    $dosenNames = [$jadwal->dosen->name];
                }
                
                return (object) [
                    'id' => $jadwal->id,
                    'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                    'mata_kuliah' => (object) [
                        'kode' => $jadwal->mataKuliah->kode ?? '',
                        'nama' => $jadwal->mataKuliah->nama ?? 'Unknown',
                        'semester' => $jadwal->mataKuliah->semester ?? ''
                    ],
                    'tanggal' => $jadwal->tanggal,
                    'jam_mulai' => $jadwal->jam_mulai,
                    'jam_selesai' => $jadwal->jam_selesai,
                    'topik' => $jadwal->topik,
                    'ruangan' => (object) [
                        'id' => $jadwal->ruangan->id ?? null,
                        'nama' => $jadwal->ruangan->nama ?? 'Unknown'
                    ],
                    'status_konfirmasi' => $jadwal->status_konfirmasi ?? 'belum_konfirmasi',
                    'dosen' => !empty($dosenNames) ? (object) [
                        'id' => $jadwal->dosen_ids[0] ?? $jadwal->dosen_id,
                        'name' => implode(', ', $dosenNames)
                    ] : null,
                    'dosen_id' => $jadwal->dosen_id,
                    'dosen_ids' => $jadwal->dosen_ids,
                    'jumlah_sesi' => $jadwal->jumlah_sesi ?? 1,
                    'kelompok_kecil_id' => $jadwal->kelompok_kecil_id,
                    'kelompok_kecil_antara_id' => $jadwal->kelompok_kecil_antara_id,
                    'kelompok_kecil' => $jadwal->kelompokKecil ? (object) [
                        'id' => $jadwal->kelompokKecil->id,
                        'nama' => $jadwal->kelompokKecil->nama_kelompok
                    ] : null,
                    'kelompok_kecil_antara' => $jadwal->kelompokKecilAntara ? (object) [
                        'id' => $jadwal->kelompokKecilAntara->id,
                        'nama_kelompok' => $jadwal->kelompokKecilAntara->nama_kelompok
                    ] : null,
                    'file_jurnal' => $jadwal->file_jurnal,
                    'semester_type' => $semesterType,
                    'created_at' => $jadwal->created_at,
                ];
            });

            return response()->json([
                'message' => 'Data jadwal Jurnal Reading berhasil diambil',
                'data' => $mappedJadwal,
                'count' => $mappedJadwal->count()
            ]);

        } catch (\Exception $e) {
            \Log::error("Error getting jadwal jurnal reading for dosen: " . $e->getMessage());
            return response()->json([
                'message' => 'Gagal mengambil data jadwal Jurnal Reading',
                'data' => []
            ], 500);
        }
    }

    // Konfirmasi jadwal Jurnal Reading
    public function konfirmasi(Request $request, $id)
    {
        $request->validate([
            'status' => 'required|in:bisa,tidak_bisa',
            'alasan' => 'nullable|string|max:1000',
            'dosen_id' => 'required|exists:users,id'
        ]);

        $jadwal = JadwalJurnalReading::with(['mataKuliah', 'ruangan'])->findOrFail($id);
        
        // Check if dosen is assigned to this jadwal
        $isAssigned = false;
        if ($jadwal->dosen_id == $request->dosen_id) {
            $isAssigned = true;
        } elseif ($jadwal->dosen_ids && in_array($request->dosen_id, $jadwal->dosen_ids)) {
            $isAssigned = true;
        }

        if (!$isAssigned) {
            return response()->json([
                'message' => 'Anda tidak memiliki akses untuk mengkonfirmasi jadwal ini'
            ], 403);
        }

        $jadwal->update([
            'status_konfirmasi' => $request->status,
            'alasan_konfirmasi' => $request->alasan
        ]);

        // LONG-TERM FIX: Update dosen_ids based on confirmation status
        $this->updateDosenIdsBasedOnConfirmation($jadwal, $request->dosen_id, $request->status);


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading deleted');


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading updated');


        // Log activity

        activity()

            ->log('Jadwal Jurnal Reading created');

        // Get dosen info
        $dosen = User::find($request->dosen_id);
        
        // Save to history
        $this->saveRiwayatKonfirmasi($jadwal, $request->status, $request->alasan, $request->dosen_id);
        
        // Send notification
        if ($request->status === 'tidak_bisa') {
            $this->sendReplacementNotification($jadwal, $request->alasan, $dosen);
        } elseif ($request->status === 'bisa') {
            $this->sendConfirmationNotification($jadwal, 'bisa', $dosen);
        }

        return response()->json(['message' => 'Konfirmasi berhasil disimpan', 'status' => $request->status]);
    }

    /**
     * Update dosen_ids based on confirmation status
     * This ensures dosen_ids reflects actual confirmed dosen
     */
    private function updateDosenIdsBasedOnConfirmation($jadwal, $dosenId, $status)
    {
        try {
            $currentDosenIds = $jadwal->dosen_ids ? (is_array($jadwal->dosen_ids) ? $jadwal->dosen_ids : json_decode($jadwal->dosen_ids, true)) : [];
            
            if ($status === 'bisa') {
                // Add dosen to dosen_ids if not already present
                if (!in_array($dosenId, $currentDosenIds)) {
                    $currentDosenIds[] = $dosenId;
                    \Illuminate\Support\Facades\Log::info("Adding dosen {$dosenId} to dosen_ids for jurnal jadwal {$jadwal->id}");
                }
            } elseif ($status === 'tidak_bisa') {
                // Remove dosen from dosen_ids
                $currentDosenIds = array_filter($currentDosenIds, function($id) use ($dosenId) {
                    return $id != $dosenId;
                });
                $currentDosenIds = array_values($currentDosenIds); // Re-index array
                \Illuminate\Support\Facades\Log::info("Removing dosen {$dosenId} from dosen_ids for jurnal jadwal {$jadwal->id}");
            }

            // Update jadwal with new dosen_ids
            $jadwal->update(['dosen_ids' => $currentDosenIds]);
            
            \Illuminate\Support\Facades\Log::info("Updated dosen_ids for jurnal jadwal {$jadwal->id}: " . json_encode($currentDosenIds));
            
        } catch (\Exception $e) {
            \Illuminate\Support\Facades\Log::error("Error updating dosen_ids for jurnal jadwal {$jadwal->id}: " . $e->getMessage());
        }
    }

    private function saveRiwayatKonfirmasi($jadwal, $status, $alasan = null, $dosen_id = null)
    {
        try {
            \App\Models\RiwayatKonfirmasiDosen::create([
                'dosen_id' => $dosen_id ?: $jadwal->dosen_id,
                'jadwal_type' => 'jurnal_reading',
                'jadwal_id' => $jadwal->id,
                'mata_kuliah_kode' => $jadwal->mata_kuliah_kode,
                'mata_kuliah_nama' => $jadwal->mataKuliah->nama,
                'tanggal' => $jadwal->tanggal,
                'jam_mulai' => $jadwal->jam_mulai,
                'jam_selesai' => $jadwal->jam_selesai,
                'ruangan' => $jadwal->ruangan->nama,
                'materi' => $jadwal->topik,
                'topik' => $jadwal->topik,
                'status_konfirmasi' => $status,
                'alasan_konfirmasi' => $alasan,
                'waktu_konfirmasi' => now()
            ]);
        } catch (\Exception $e) {
            \Log::error("Gagal menyimpan riwayat konfirmasi jurnal reading: " . $e->getMessage());
        }
    }

    private function sendConfirmationNotification($jadwal, $status, $dosen)
    {
        try {
            \Log::info("Memulai pengiriman notifikasi konfirmasi untuk jadwal ID: {$jadwal->id}, Status: {$status}");
            $superAdmins = \App\Models\User::where('role', 'super_admin')->get();
            \Log::info("Ditemukan {$superAdmins->count()} super admin");
            $statusText = $status === 'bisa' ? 'Bisa Mengajar' : 'Tidak Bisa Mengajar';
            $type = $status === 'bisa' ? 'success' : 'warning';
            foreach ($superAdmins as $admin) {
                \Log::info("Mengirim notifikasi ke admin ID: {$admin->id}, Nama: {$admin->name}");
                \App\Models\Notification::create([
                    'user_id' => $dosen->id,
                    'title' => "Konfirmasi Jadwal - {$statusText}",
                    'message' => "Dosen {$dosen->name} telah mengkonfirmasi {$statusText} untuk jadwal Jurnal Reading {$jadwal->mataKuliah->nama} pada tanggal " . 
                               date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " . 
                               str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) . 
                               " di ruangan {$jadwal->ruangan->nama}.",
                    'type' => $type,
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'jurnal_reading',
                        'dosen_id' => $dosen->id,
                        'dosen_name' => $dosen->name,
                        'dosen_role' => $dosen->role,
                        'mata_kuliah' => $jadwal->mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal,
                        'waktu' => $jadwal->jam_mulai . ' - ' . $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama,
                        'status_konfirmasi' => $status
                    ]
                ]);
            }
            \Log::info("Notifikasi konfirmasi {$status} berhasil dikirim ke super admin untuk jadwal jurnal reading ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Gagal mengirim notifikasi konfirmasi: " . $e->getMessage());
        }
    }

    private function sendReplacementNotification($jadwal, $alasan = null, $dosen = null)
    {
        try {
            $superAdmins = \App\Models\User::where('role', 'super_admin')->get();
            $alasanText = $alasan ? "\n\nAlasan: {$alasan}" : "";
            if (!$dosen && $jadwal->dosen) {
                $dosen = $jadwal->dosen;
            }
            foreach ($superAdmins as $admin) {
                \App\Models\Notification::create([
                    'user_id' => $dosen->id,
                    'title' => 'Dosen Tidak Bisa Mengajar - Jurnal Reading',
                    'message' => "Dosen {$dosen->name} tidak bisa mengajar pada jadwal Jurnal Reading {$jadwal->mataKuliah->nama} pada tanggal " . 
                               date('d/m/Y', strtotime($jadwal->tanggal)) . " jam " . 
                               str_replace(':', '.', $jadwal->jam_mulai) . "-" . str_replace(':', '.', $jadwal->jam_selesai) . 
                               " di ruangan {$jadwal->ruangan->nama}.{$alasanText}",
                    'type' => 'warning',
                    'is_read' => false,
                    'data' => [
                        'jadwal_id' => $jadwal->id,
                        'jadwal_type' => 'jurnal_reading',
                        'dosen_id' => $dosen->id,
                        'dosen_name' => $dosen->name,
                        'dosen_role' => $dosen->role,
                        'mata_kuliah' => $jadwal->mataKuliah->nama,
                        'tanggal' => $jadwal->tanggal,
                        'waktu' => $jadwal->jam_mulai . ' - ' . $jadwal->jam_selesai,
                        'ruangan' => $jadwal->ruangan->nama,
                        'alasan' => $alasan
                    ]
                ]);
            }
            \Log::info("Notifikasi replacement berhasil dikirim ke super admin untuk jadwal jurnal reading ID: {$jadwal->id}");
        } catch (\Exception $e) {
            \Log::error("Gagal mengirim notifikasi replacement: " . $e->getMessage());
        }
    }

}
