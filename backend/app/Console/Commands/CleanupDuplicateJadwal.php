<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class CleanupDuplicateJadwal extends Command
{
    /**
     * The name and signature of the console command.
     *
     * @var string
     */
    protected $signature = 'jadwal:cleanup-duplicates {--dry-run : Run without making changes}';

    /**
     * The console command description.
     *
     * @var string
     */
    protected $description = 'Cleanup duplicate jadwal rows created by old replacement logic';

    /**
     * Execute the console command.
     */
    public function handle()
    {
        $dryRun = $this->option('dry-run');
        
        if ($dryRun) {
            $this->info('🔍 DRY RUN MODE - No changes will be made');
        } else {
            $this->warn('⚠️  This will DELETE duplicate rows. Make sure you have a backup!');
            if (!$this->confirm('Do you want to continue?')) {
                $this->info('Operation cancelled.');
                return;
            }
        }

        $this->info('Starting cleanup of duplicate jadwal...');
        
        $totalDeleted = 0;
        
        // Cleanup PBL
        $this->info('Cleaning up PBL duplicates...');
        $pblDeleted = $this->cleanupPBLDuplicates($dryRun);
        $totalDeleted += $pblDeleted;
        $this->info("PBL: {$pblDeleted} duplicates removed");
        
        // Cleanup Kuliah Besar
        $this->info('Cleaning up Kuliah Besar duplicates...');
        $kbDeleted = $this->cleanupKuliahBesarDuplicates($dryRun);
        $totalDeleted += $kbDeleted;
        $this->info("Kuliah Besar: {$kbDeleted} duplicates removed");
        
        // Cleanup Jurnal Reading
        $this->info('Cleaning up Jurnal Reading duplicates...');
        $jrDeleted = $this->cleanupJurnalReadingDuplicates($dryRun);
        $totalDeleted += $jrDeleted;
        $this->info("Jurnal Reading: {$jrDeleted} duplicates removed");
        
        // Cleanup CSR
        $this->info('Cleaning up CSR duplicates...');
        $csrDeleted = $this->cleanupCSRDuplicates($dryRun);
        $totalDeleted += $csrDeleted;
        $this->info("CSR: {$csrDeleted} duplicates removed");
        
        // Cleanup Non Blok Non CSR
        $this->info('Cleaning up Non Blok Non CSR duplicates...');
        $nbcsrDeleted = $this->cleanupNonBlokNonCSRDuplicates($dryRun);
        $totalDeleted += $nbcsrDeleted;
        $this->info("Non Blok Non CSR: {$nbcsrDeleted} duplicates removed");
        
        $this->info("✅ Cleanup complete! Total duplicates removed: {$totalDeleted}");
    }

    /**
     * Cleanup PBL duplicates
     */
    private function cleanupPBLDuplicates($dryRun = false)
    {
        $deleted = 0;
        
        // Find duplicates: same tanggal, jam_mulai, jam_selesai, ruangan_id, pbl_id, kelompok_kecil_id
        // but different dosen_id and one has status_konfirmasi = 'tidak_bisa'
        $duplicates = DB::table('jadwal_pbl')
            ->select('tanggal', 'jam_mulai', 'jam_selesai', 'ruangan_id', 'pbl_id', 'kelompok_kecil_id')
            ->groupBy('tanggal', 'jam_mulai', 'jam_selesai', 'ruangan_id', 'pbl_id', 'kelompok_kecil_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();
        
        foreach ($duplicates as $dup) {
            $query = DB::table('jadwal_pbl')
                ->where('tanggal', $dup->tanggal)
                ->where('jam_mulai', $dup->jam_mulai)
                ->where('jam_selesai', $dup->jam_selesai)
                ->where('ruangan_id', $dup->ruangan_id)
                ->where('pbl_id', $dup->pbl_id);
            
            // Handle nullable kelompok_kecil_id
            if ($dup->kelompok_kecil_id === null) {
                $query->whereNull('kelompok_kecil_id');
            } else {
                $query->where('kelompok_kecil_id', $dup->kelompok_kecil_id);
            }
            
            $rows = $query->orderBy('created_at', 'asc')->get();
            
            if ($rows->count() > 1) {
                // Find the original (oldest) and duplicates (newer)
                // Original adalah yang dibuat lebih dulu (created_at lebih kecil)
                $original = $rows->sortBy('created_at')->first();
                $duplicateRows = $rows->filter(function($row) use ($original) {
                    return $row->id !== $original->id;
                });
                
                foreach ($duplicateRows as $dupRow) {
                    // Check if this is a duplicate created by replacement (status_konfirmasi = 'tidak_bisa')
                    // Atau jika created_at lebih baru dari original
                    if ($dupRow->status_konfirmasi === 'tidak_bisa' || 
                        strtotime($dupRow->created_at) > strtotime($original->created_at)) {
                        
                        // Merge dosen_ids: add duplicate's dosen_id to original's dosen_ids
                        $originalDosenIds = $original->dosen_ids 
                            ? (is_array($original->dosen_ids) ? $original->dosen_ids : json_decode($original->dosen_ids, true))
                            : [];
                        
                        // Ensure original dosen_id is at index 0 (dosen pengampu awal)
                        if (empty($originalDosenIds)) {
                            $originalDosenIds = [$original->dosen_id];
                        } else {
                            // Pastikan original dosen_id ada di index 0
                            if (!in_array($original->dosen_id, $originalDosenIds)) {
                                array_unshift($originalDosenIds, $original->dosen_id);
                            } else {
                                // Jika sudah ada, pastikan di index 0
                                $originalDosenIds = array_values(array_filter($originalDosenIds, function($id) use ($original) {
                                    return $id != $original->dosen_id;
                                }));
                                array_unshift($originalDosenIds, $original->dosen_id);
                            }
                        }
                        
                        // Add duplicate's dosen_id if not already present (sebagai dosen pengganti)
                        if (!in_array($dupRow->dosen_id, $originalDosenIds)) {
                            $originalDosenIds[] = $dupRow->dosen_id;
                        }
                        
                        if (!$dryRun) {
                            // Update original with merged dosen_ids
                            // PENTING: 
                            // - dosen_ids[0] = dosen pengampu awal (untuk DISPLAY di frontend sebagai "Pengampu")
                            // - dosen_ids terbaru (elemen terakhir) = dosen pengganti terbaru (untuk DISPLAY di frontend sebagai "Dosen Pengganti")
                            // - dosen_id di database = dosen yang saat ini mengajar = dosen_ids terbaru (elemen terakhir)
                            $latestDosenId = end($originalDosenIds); // Dosen yang saat ini mengajar
                            DB::table('jadwal_pbl')
                                ->where('id', $original->id)
                                ->update([
                                    'dosen_ids' => json_encode($originalDosenIds),
                                    // dosen_id = dosen yang saat ini mengajar (dosen_ids terbaru)
                                    'dosen_id' => $latestDosenId
                                ]);
                            
                            // Delete duplicate
                            DB::table('jadwal_pbl')->where('id', $dupRow->id)->delete();
                        }
                        
                        $deleted++;
                        $this->line("  - Deleted duplicate PBL ID: {$dupRow->id} (merged into ID: {$original->id})");
                    }
                }
            }
        }
        
        return $deleted;
    }

    /**
     * Cleanup Kuliah Besar duplicates
     */
    private function cleanupKuliahBesarDuplicates($dryRun = false)
    {
        $deleted = 0;
        
        $duplicates = DB::table('jadwal_kuliah_besar')
            ->select('tanggal', 'jam_mulai', 'jam_selesai', 'ruangan_id', 'mata_kuliah_kode')
            ->groupBy('tanggal', 'jam_mulai', 'jam_selesai', 'ruangan_id', 'mata_kuliah_kode')
            ->havingRaw('COUNT(*) > 1')
            ->get();
        
        foreach ($duplicates as $dup) {
            $rows = DB::table('jadwal_kuliah_besar')
                ->where('tanggal', $dup->tanggal)
                ->where('jam_mulai', $dup->jam_mulai)
                ->where('jam_selesai', $dup->jam_selesai)
                ->where('ruangan_id', $dup->ruangan_id)
                ->where('mata_kuliah_kode', $dup->mata_kuliah_kode)
                ->orderBy('created_at', 'asc')
                ->get();
            
            if ($rows->count() > 1) {
                // Find the original (oldest) and duplicates (newer)
                $original = $rows->sortBy('created_at')->first();
                $duplicateRows = $rows->filter(function($row) use ($original) {
                    return $row->id !== $original->id;
                });
                
                foreach ($duplicateRows as $dupRow) {
                    // Check if this is a duplicate created by replacement
                    if ($dupRow->status_konfirmasi === 'tidak_bisa' || 
                        strtotime($dupRow->created_at) > strtotime($original->created_at)) {
                        
                        $originalDosenIds = $original->dosen_ids 
                            ? (is_array($original->dosen_ids) ? $original->dosen_ids : json_decode($original->dosen_ids, true))
                            : [];
                        
                        // Ensure original dosen_id is at index 0
                        if (empty($originalDosenIds)) {
                            $originalDosenIds = [$original->dosen_id];
                        } else {
                            if (!in_array($original->dosen_id, $originalDosenIds)) {
                                array_unshift($originalDosenIds, $original->dosen_id);
                            } else {
                                $originalDosenIds = array_values(array_filter($originalDosenIds, function($id) use ($original) {
                                    return $id != $original->dosen_id;
                                }));
                                array_unshift($originalDosenIds, $original->dosen_id);
                            }
                        }
                        
                        if (!in_array($dupRow->dosen_id, $originalDosenIds)) {
                            $originalDosenIds[] = $dupRow->dosen_id;
                        }
                        
                        if (!$dryRun) {
                            // PENTING: 
                            // - dosen_ids[0] = dosen pengampu awal (untuk DISPLAY di frontend sebagai "Pengampu")
                            // - dosen_ids terbaru (elemen terakhir) = dosen pengganti terbaru (untuk DISPLAY di frontend sebagai "Dosen Pengganti")
                            // - dosen_id di database = dosen yang saat ini mengajar = dosen_ids terbaru (elemen terakhir)
                            $latestDosenId = end($originalDosenIds); // Dosen yang saat ini mengajar
                            DB::table('jadwal_kuliah_besar')
                                ->where('id', $original->id)
                                ->update([
                                    'dosen_ids' => json_encode($originalDosenIds),
                                    // dosen_id = dosen yang saat ini mengajar (dosen_ids terbaru)
                                    'dosen_id' => $latestDosenId
                                ]);
                            
                            DB::table('jadwal_kuliah_besar')->where('id', $dupRow->id)->delete();
                        }
                        
                        $deleted++;
                        $this->line("  - Deleted duplicate Kuliah Besar ID: {$dupRow->id} (merged into ID: {$original->id})");
                    }
                }
            }
        }
        
        return $deleted;
    }

    /**
     * Cleanup Jurnal Reading duplicates
     */
    private function cleanupJurnalReadingDuplicates($dryRun = false)
    {
        $deleted = 0;
        
        $duplicates = DB::table('jadwal_jurnal_reading')
            ->select('tanggal', 'jam_mulai', 'jam_selesai', 'ruangan_id', 'mata_kuliah_kode', 'kelompok_kecil_id')
            ->groupBy('tanggal', 'jam_mulai', 'jam_selesai', 'ruangan_id', 'mata_kuliah_kode', 'kelompok_kecil_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();
        
        foreach ($duplicates as $dup) {
            $rows = DB::table('jadwal_jurnal_reading')
                ->where('tanggal', $dup->tanggal)
                ->where('jam_mulai', $dup->jam_mulai)
                ->where('jam_selesai', $dup->jam_selesai)
                ->where('ruangan_id', $dup->ruangan_id)
                ->where('mata_kuliah_kode', $dup->mata_kuliah_kode)
                ->where('kelompok_kecil_id', $dup->kelompok_kecil_id)
                ->orderBy('created_at', 'asc')
                ->get();
            
            if ($rows->count() > 1) {
                // Find the original (oldest) and duplicates (newer)
                $original = $rows->sortBy('created_at')->first();
                $duplicateRows = $rows->filter(function($row) use ($original) {
                    return $row->id !== $original->id;
                });
                
                foreach ($duplicateRows as $dupRow) {
                    // Check if this is a duplicate created by replacement
                    if ($dupRow->status_konfirmasi === 'tidak_bisa' || 
                        strtotime($dupRow->created_at) > strtotime($original->created_at)) {
                        
                        $originalDosenIds = $original->dosen_ids 
                            ? (is_array($original->dosen_ids) ? $original->dosen_ids : json_decode($original->dosen_ids, true))
                            : [];
                        
                        // Ensure original dosen_id is at index 0
                        if (empty($originalDosenIds)) {
                            $originalDosenIds = [$original->dosen_id];
                        } else {
                            if (!in_array($original->dosen_id, $originalDosenIds)) {
                                array_unshift($originalDosenIds, $original->dosen_id);
                            } else {
                                $originalDosenIds = array_values(array_filter($originalDosenIds, function($id) use ($original) {
                                    return $id != $original->dosen_id;
                                }));
                                array_unshift($originalDosenIds, $original->dosen_id);
                            }
                        }
                        
                        if (!in_array($dupRow->dosen_id, $originalDosenIds)) {
                            $originalDosenIds[] = $dupRow->dosen_id;
                        }
                        
                        if (!$dryRun) {
                            // PENTING: 
                            // - dosen_ids[0] = dosen pengampu awal (untuk DISPLAY di frontend sebagai "Pengampu")
                            // - dosen_ids terbaru (elemen terakhir) = dosen pengganti terbaru (untuk DISPLAY di frontend sebagai "Dosen Pengganti")
                            // - dosen_id di database = dosen yang saat ini mengajar = dosen_ids terbaru (elemen terakhir)
                            $latestDosenId = end($originalDosenIds); // Dosen yang saat ini mengajar
                            DB::table('jadwal_jurnal_reading')
                                ->where('id', $original->id)
                                ->update([
                                    'dosen_ids' => json_encode($originalDosenIds),
                                    // dosen_id = dosen yang saat ini mengajar (dosen_ids terbaru)
                                    'dosen_id' => $latestDosenId
                                ]);
                            
                            DB::table('jadwal_jurnal_reading')->where('id', $dupRow->id)->delete();
                        }
                        
                        $deleted++;
                        $this->line("  - Deleted duplicate Jurnal Reading ID: {$dupRow->id} (merged into ID: {$original->id})");
                    }
                }
            }
        }
        
        return $deleted;
    }

    /**
     * Cleanup CSR duplicates
     */
    private function cleanupCSRDuplicates($dryRun = false)
    {
        $deleted = 0;
        
        $duplicates = DB::table('jadwal_csr')
            ->select('tanggal', 'jam_mulai', 'jam_selesai', 'ruangan_id', 'kategori_id')
            ->groupBy('tanggal', 'jam_mulai', 'jam_selesai', 'ruangan_id', 'kategori_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();
        
        foreach ($duplicates as $dup) {
            $rows = DB::table('jadwal_csr')
                ->where('tanggal', $dup->tanggal)
                ->where('jam_mulai', $dup->jam_mulai)
                ->where('jam_selesai', $dup->jam_selesai)
                ->where('ruangan_id', $dup->ruangan_id)
                ->where('kategori_id', $dup->kategori_id)
                ->orderBy('created_at', 'asc')
                ->get();
            
            if ($rows->count() > 1) {
                // Find the original (oldest) and duplicates (newer)
                $original = $rows->sortBy('created_at')->first();
                $duplicateRows = $rows->filter(function($row) use ($original) {
                    return $row->id !== $original->id;
                });
                
                foreach ($duplicateRows as $dupRow) {
                    // Check if this is a duplicate created by replacement
                    if ($dupRow->status_konfirmasi === 'tidak_bisa' || 
                        strtotime($dupRow->created_at) > strtotime($original->created_at)) {
                        
                        $originalDosenIds = $original->dosen_ids 
                            ? (is_array($original->dosen_ids) ? $original->dosen_ids : json_decode($original->dosen_ids, true))
                            : [];
                        
                        // Ensure original dosen_id is at index 0
                        if (empty($originalDosenIds)) {
                            $originalDosenIds = [$original->dosen_id];
                        } else {
                            if (!in_array($original->dosen_id, $originalDosenIds)) {
                                array_unshift($originalDosenIds, $original->dosen_id);
                            } else {
                                $originalDosenIds = array_values(array_filter($originalDosenIds, function($id) use ($original) {
                                    return $id != $original->dosen_id;
                                }));
                                array_unshift($originalDosenIds, $original->dosen_id);
                            }
                        }
                        
                        if (!in_array($dupRow->dosen_id, $originalDosenIds)) {
                            $originalDosenIds[] = $dupRow->dosen_id;
                        }
                        
                        if (!$dryRun) {
                            // PENTING: 
                            // - dosen_ids[0] = dosen pengampu awal (untuk DISPLAY di frontend sebagai "Pengampu")
                            // - dosen_ids terbaru (elemen terakhir) = dosen pengganti terbaru (untuk DISPLAY di frontend sebagai "Dosen Pengganti")
                            // - dosen_id di database = dosen yang saat ini mengajar = dosen_ids terbaru (elemen terakhir)
                            $latestDosenId = end($originalDosenIds); // Dosen yang saat ini mengajar
                            DB::table('jadwal_csr')
                                ->where('id', $original->id)
                                ->update([
                                    'dosen_ids' => json_encode($originalDosenIds),
                                    // dosen_id = dosen yang saat ini mengajar (dosen_ids terbaru)
                                    'dosen_id' => $latestDosenId
                                ]);
                            
                            DB::table('jadwal_csr')->where('id', $dupRow->id)->delete();
                        }
                        
                        $deleted++;
                        $this->line("  - Deleted duplicate CSR ID: {$dupRow->id} (merged into ID: {$original->id})");
                    }
                }
            }
        }
        
        return $deleted;
    }

    /**
     * Cleanup Non Blok Non CSR duplicates
     */
    private function cleanupNonBlokNonCSRDuplicates($dryRun = false)
    {
        $deleted = 0;
        
        $duplicates = DB::table('jadwal_non_blok_non_csr')
            ->select('tanggal', 'jam_mulai', 'jam_selesai', 'ruangan_id', 'mata_kuliah_kode')
            ->groupBy('tanggal', 'jam_mulai', 'jam_selesai', 'ruangan_id', 'mata_kuliah_kode')
            ->havingRaw('COUNT(*) > 1')
            ->get();
        
        foreach ($duplicates as $dup) {
            $rows = DB::table('jadwal_non_blok_non_csr')
                ->where('tanggal', $dup->tanggal)
                ->where('jam_mulai', $dup->jam_mulai)
                ->where('jam_selesai', $dup->jam_selesai)
                ->where('ruangan_id', $dup->ruangan_id)
                ->where('mata_kuliah_kode', $dup->mata_kuliah_kode)
                ->orderBy('created_at', 'asc')
                ->get();
            
            if ($rows->count() > 1) {
                // Find the original (oldest) and duplicates (newer)
                $original = $rows->sortBy('created_at')->first();
                $duplicateRows = $rows->filter(function($row) use ($original) {
                    return $row->id !== $original->id;
                });
                
                foreach ($duplicateRows as $dupRow) {
                    // Check if this is a duplicate created by replacement
                    if ($dupRow->status_konfirmasi === 'tidak_bisa' || 
                        strtotime($dupRow->created_at) > strtotime($original->created_at)) {
                        
                        $originalDosenIds = $original->dosen_ids 
                            ? (is_array($original->dosen_ids) ? $original->dosen_ids : json_decode($original->dosen_ids, true))
                            : [];
                        
                        // Ensure original dosen_id is at index 0
                        if (empty($originalDosenIds)) {
                            $originalDosenIds = [$original->dosen_id];
                        } else {
                            if (!in_array($original->dosen_id, $originalDosenIds)) {
                                array_unshift($originalDosenIds, $original->dosen_id);
                            } else {
                                $originalDosenIds = array_values(array_filter($originalDosenIds, function($id) use ($original) {
                                    return $id != $original->dosen_id;
                                }));
                                array_unshift($originalDosenIds, $original->dosen_id);
                            }
                        }
                        
                        if (!in_array($dupRow->dosen_id, $originalDosenIds)) {
                            $originalDosenIds[] = $dupRow->dosen_id;
                        }
                        
                        if (!$dryRun) {
                            // PENTING: 
                            // - dosen_ids[0] = dosen pengampu awal (untuk DISPLAY di frontend sebagai "Pengampu")
                            // - dosen_ids terbaru (elemen terakhir) = dosen pengganti terbaru (untuk DISPLAY di frontend sebagai "Dosen Pengganti")
                            // - dosen_id di database = dosen yang saat ini mengajar = dosen_ids terbaru (elemen terakhir)
                            $latestDosenId = end($originalDosenIds); // Dosen yang saat ini mengajar
                            DB::table('jadwal_non_blok_non_csr')
                                ->where('id', $original->id)
                                ->update([
                                    'dosen_ids' => json_encode($originalDosenIds),
                                    // dosen_id = dosen yang saat ini mengajar (dosen_ids terbaru)
                                    'dosen_id' => $latestDosenId
                                ]);
                            
                            DB::table('jadwal_non_blok_non_csr')->where('id', $dupRow->id)->delete();
                        }
                        
                        $deleted++;
                        $this->line("  - Deleted duplicate Non Blok Non CSR ID: {$dupRow->id} (merged into ID: {$original->id})");
                    }
                }
            }
        }
        
        return $deleted;
    }
}

