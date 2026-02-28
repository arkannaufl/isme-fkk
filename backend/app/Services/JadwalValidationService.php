<?php

namespace App\Services;

use App\Models\Ruangan;
use App\Models\MataKuliah;
use App\Models\User;
use App\Models\KelompokBesar;
use App\Models\KelompokKecil;
use App\Models\KelompokBesarAntara;
use App\Models\KelompokKecilAntara;
use App\Models\JadwalKuliahBesar;
use App\Models\JadwalPBL;
use App\Models\JadwalCSR;
use App\Models\JadwalNonBlokNonCSR;
use App\Models\JadwalSeminarPleno;
use App\Models\JadwalPraktikum;
use App\Models\JadwalAgendaKhusus;
use App\Models\JadwalPersamaanPersepsi;
use App\Models\JadwalJurnalReading;
use App\Models\JadwalSeminarProposal;
use App\Models\JadwalSidangSkripsi;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Collection;

class JadwalValidationService
{
    /**
     * Konfigurasi jenis jadwal dan karakteristiknya
     */
    private const SCHEDULE_CONFIGS = [
        'kuliah_besar' => [
            'model' => JadwalKuliahBesar::class,
            'dosen_fields' => ['dosen_id', 'dosen_ids'],
            'kelompok_fields' => ['kelompok_besar_id', 'kelompok_besar_antara_id'],
            'ruangan_field' => 'ruangan_id',
            'supports_semester_antara' => true,
            'conflict_checks' => ['dosen', 'ruangan', 'kelompok'],
            'capacity_calculation' => 'kelompok_besar_plus_dosen'
        ],
        'pbl' => [
            'model' => JadwalPBL::class,
            'dosen_fields' => ['dosen_id', 'dosen_ids'],
            'kelompok_fields' => ['kelompok_kecil_id', 'kelompok_kecil_antara_id'],
            'ruangan_field' => 'ruangan_id',
            'supports_semester_antara' => true,
            'conflict_checks' => ['dosen', 'ruangan', 'kelompok'],
            'capacity_calculation' => 'kelompok_kecil_plus_dosen'
        ],
        'csr' => [
            'model' => JadwalCSR::class,
            'dosen_fields' => ['dosen_id'],
            'kelompok_fields' => ['kelompok_kecil_id'],
            'ruangan_field' => 'ruangan_id',
            'supports_semester_antara' => false,
            'conflict_checks' => ['dosen', 'ruangan', 'kelompok'],
            'capacity_calculation' => 'kelompok_kecil_plus_dosen'
        ],
        'persamaan_persepsi' => [
            'model' => JadwalPersamaanPersepsi::class,
            'dosen_fields' => ['dosen_ids', 'koordinator_ids'],
            'kelompok_fields' => [],
            'ruangan_field' => 'ruangan_id',
            'supports_semester_antara' => false,
            'conflict_checks' => ['dosen', 'ruangan'],
            'capacity_calculation' => 'dosen_only'
        ],
        'jurnal_reading' => [
            'model' => JadwalJurnalReading::class,
            'dosen_fields' => ['dosen_id', 'dosen_ids'],
            'kelompok_fields' => ['kelompok_kecil_id', 'kelompok_kecil_antara_id'],
            'ruangan_field' => 'ruangan_id',
            'supports_semester_antara' => true,
            'conflict_checks' => ['dosen', 'ruangan', 'kelompok'],
            'capacity_calculation' => 'kelompok_kecil_plus_dosen'
        ],
        'agenda_khusus' => [
            'model' => JadwalAgendaKhusus::class,
            'dosen_fields' => [],
            'kelompok_fields' => ['kelompok_besar_id', 'kelompok_besar_antara_id'],
            'ruangan_field' => 'ruangan_id',
            'supports_semester_antara' => true,
            'conflict_checks' => ['ruangan', 'kelompok'],
            'capacity_calculation' => 'kelompok_besar_plus_dosen'
        ],
        'agenda_khusus_antara' => [
            'model' => JadwalNonBlokNonCSR::class,
            'dosen_fields' => ['dosen_id', 'dosen_ids'],
            'kelompok_fields' => ['kelompok_besar_id', 'kelompok_besar_antara_id'],
            'ruangan_field' => 'ruangan_id',
            'supports_semester_antara' => true,
            'conflict_checks' => ['dosen', 'ruangan', 'kelompok'],
            'capacity_calculation' => 'kelompok_besar_plus_dosen'
        ],
        'seminar_proposal' => [
            'model' => JadwalNonBlokNonCSR::class,
            'dosen_fields' => ['pembimbing_id', 'penguji_ids', 'komentator_ids'],
            'kelompok_fields' => ['mahasiswa_nims'],
            'ruangan_field' => 'ruangan_id',
            'supports_semester_antara' => false,
            'conflict_checks' => ['dosen', 'ruangan', 'kelompok'],
            'capacity_calculation' => 'dosen_only'
        ],
        'sidang_skripsi' => [
            'model' => JadwalNonBlokNonCSR::class,
            'dosen_fields' => ['pembimbing_id', 'penguji_ids', 'komentator_ids'],
            'kelompok_fields' => ['mahasiswa_nims'],
            'ruangan_field' => 'ruangan_id',
            'supports_semester_antara' => false,
            'conflict_checks' => ['dosen', 'ruangan', 'kelompok'],
            'capacity_calculation' => 'dosen_only'
        ],
        'jadwal_non_blok_non_csr' => [
            'model' => JadwalNonBlokNonCSR::class,
            'dosen_fields' => ['dosen_id', 'dosen_ids'],
            'kelompok_fields' => ['kelompok_besar_id', 'kelompok_besar_antara_id'],
            'ruangan_field' => 'ruangan_id',
            'supports_semester_antara' => true,
            'conflict_checks' => ['dosen', 'ruangan', 'kelompok'],
            'capacity_calculation' => 'kelompok_besar_plus_dosen'
        ],
        'seminar_pleno' => [
            'model' => JadwalSeminarPleno::class,
            'dosen_fields' => ['dosen_ids', 'koordinator_ids'],
            'kelompok_fields' => ['kelompok_besar_id', 'kelompok_besar_antara_id'],
            'ruangan_field' => 'ruangan_id',
            'supports_semester_antara' => true,
            'conflict_checks' => ['dosen', 'ruangan', 'kelompok'],
            'capacity_calculation' => 'kelompok_besar_plus_dosen'
        ],
        'praktikum' => [
            'model' => JadwalPraktikum::class,
            'dosen_fields' => ['dosen_ids'],
            'kelompok_fields' => ['kelompok_kecil_ids'],
            'ruangan_field' => 'ruangan_id',
            'supports_semester_antara' => false,
            'conflict_checks' => ['dosen', 'ruangan', 'kelompok'],
            'capacity_calculation' => 'praktikum_kelompok_kecil_plus_dosen'
        ]
    ];

    /**
     * Validasi bentrok jadwal untuk semua jenis jadwal
     */
    public function validateConflict(array $data, string $scheduleType, ?int $excludeId = null, ?bool $isSemesterAntara = false): ?string
    {
        $config = $this->getScheduleConfig($scheduleType);
        if (!$config) {
            return "Tipe jadwal tidak dikenal: {$scheduleType}";
        }

        // Tambahkan schedule_type ke data untuk digunakan di method lain
        $data['schedule_type'] = $scheduleType;

        // Ambil semester dari mata kuliah
        $semester = $this->getMataKuliahSemester($data['mata_kuliah_kode'] ?? null);

        // Cek bentrok dengan semua jenis jadwal yang relevan
        foreach (self::SCHEDULE_CONFIGS as $type => $typeConfig) {
            $shouldCheckRegular = $this->shouldCheckConflict($scheduleType, $type, false);
            $shouldCheckAntara = $this->shouldCheckConflict($scheduleType, $type, true);
            
            // Check conflict with regular schedules
            if ($shouldCheckRegular) {
                $conflict = $this->checkConflictWithScheduleType($data, $type, $excludeId, false);
                
                if ($conflict) {
                    return $conflict;
                }
            }

            // Check conflict with antara schedules (for cross-semester validation)
            if ($shouldCheckAntara) {
                $conflict = $this->checkConflictWithScheduleType($data, $type, $excludeId, true);
                
                if ($conflict) {
                    return $conflict;
                }
            }
        }

        return null;
    }

    /**
     * Validasi kapasitas ruangan untuk semua jenis jadwal
     */
    public function validateRoomCapacity(array $data, string $scheduleType, ?bool $isSemesterAntara = false): ?string
    {
        $config = $this->getScheduleConfig($scheduleType);
        if (!$config) {
            return "Tipe jadwal tidak dikenal: {$scheduleType}";
        }

        // Skip jika tidak ada ruangan_id atau ruangan opsional
        if (!isset($data[$config['ruangan_field']]) || !$data[$config['ruangan_field']]) {
            return null;
        }

        $ruangan = Ruangan::find($data[$config['ruangan_field']]);
        if (!$ruangan) {
            return 'Ruangan tidak ditemukan';
        }

        $totalParticipants = $this->calculateTotalParticipants($data, $config['capacity_calculation'], $isSemesterAntara);

        if ($totalParticipants > $ruangan->kapasitas) {
            return "Kapasitas ruangan tidak mencukupi. Ruangan: {$ruangan->nama} hanya dapat menampung {$ruangan->kapasitas} orang, sedangkan diperlukan {$totalParticipants} orang.";
        }

        return null;
    }

    /**
     * Check conflict with specific schedule type
     */
    private function checkConflictWithScheduleType(array $data, string $checkType, ?int $excludeId, bool $isSemesterAntara): ?string
    {
        if (!$this->shouldCheckConflict($data['schedule_type'], $checkType, $isSemesterAntara)) {
            \Log::info("checkConflictWithScheduleType() - SKIP: shouldCheckConflict returned false");
            return null;
        }

        $checkConfig = self::SCHEDULE_CONFIGS[$checkType];
        
        // SPECIAL HANDLING: For agenda_khusus in antara semester, use agenda_khusus_antara config
        if ($checkType === 'agenda_khusus' && $isSemesterAntara) {
            $checkConfig = self::SCHEDULE_CONFIGS['agenda_khusus_antara'];
            \Log::info("checkConflictWithScheduleType() - Using agenda_khusus_antara config for antara semester");
        }
        
        $model = $checkConfig['model'];
        $tableName = $this->getTableName($model);

        $query = DB::table($tableName)
            ->join('mata_kuliah', $tableName . '.mata_kuliah_kode', '=', 'mata_kuliah.kode')
            ->where($tableName . '.tanggal', $data['tanggal']);

        // IMPORTANT: For cross-semester validation, we need to check BOTH regular and antara schedules
        // If we're checking as regular, filter by regular semester
        // If we're checking as antara, filter by antara semester
        if ($isSemesterAntara) {
            // When checking antara schedules, look for mata_kuliah.semester = "Antara"
            $query->where('mata_kuliah.semester', 'Antara');
        } else {
            // When checking regular schedules:
            // - If source data is from semester antara, DO NOT filter by "Antara" (would make this check one-way).
            //   Instead, explicitly exclude antara semester so we can find conflicts in regular schedules.
            // - Otherwise, filter by the input's semester.
            $sourceIsAntara = $this->isSourceSemesterAntara($data);
            if (!$this->isCrossSemesterSchedule($checkType)) {
                if ($sourceIsAntara) {
                    $query->where('mata_kuliah.semester', '!=', 'Antara');
                } else {
                    $semester = $this->getMataKuliahSemester($data['mata_kuliah_kode']);
                    if ($semester) {
                        $query->where('mata_kuliah.semester', $semester);
                    }
                }
            }
        }

        // SPECIAL HANDLING: Filter by jenis_baris for agenda_khusus antara schedules
        if ($checkType === 'agenda_khusus' && $isSemesterAntara) {
            $query->where($tableName . '.jenis_baris', 'agenda');
        } elseif ($checkType === 'agenda_khusus_antara') {
            // Also apply filter when using agenda_khusus_antara config directly
            $query->where($tableName . '.jenis_baris', 'agenda');
        }

        // Filter waktu overlap - FIX: Handle mixed time formats (07.20 and 08:10)
        $query->where(function ($q) use ($data, $tableName) {
            // Convert input times to database format (replace : with .)
            $inputJamMulai = str_replace(':', '.', $data['jam_mulai']);
            $inputJamSelesai = str_replace(':', '.', $data['jam_selesai']);
            
            // Handle both formats in database: %H.%i and %H:%i
            $q->whereRaw("(
                (TIME(STR_TO_DATE({$tableName}.jam_mulai, '%H.%i')) < TIME(STR_TO_DATE(?, '%H.%i'))) OR
                (TIME(STR_TO_DATE({$tableName}.jam_mulai, '%H:%i')) < TIME(STR_TO_DATE(?, '%H.%i')))
            )", [$inputJamSelesai, $inputJamSelesai])
            ->whereRaw("(
                (TIME(STR_TO_DATE({$tableName}.jam_selesai, '%H.%i')) > TIME(STR_TO_DATE(?, '%H.%i'))) OR
                (TIME(STR_TO_DATE({$tableName}.jam_selesai, '%H:%i')) > TIME(STR_TO_DATE(?, '%H.%i')))
            )", [$inputJamMulai, $inputJamMulai]);
        });

        // Exclude current record
        if ($excludeId) {
            $query->where($tableName . '.id', '!=', $excludeId);
        }

        $conflictingSchedule = $query->select($tableName . '.*')->first();

        if ($conflictingSchedule) {
            return $this->formatConflictMessage($conflictingSchedule, $checkType, $data, $isSemesterAntara);
        }

        return null;
    }

    /**
     * Apply conflict filters berdasarkan konfigurasi
     */
    private function applyConflictFilters($query, array $data, array $config, string $tableName, bool $isSemesterAntara): void
    {
        $query->where(function ($q) use ($data, $config, $tableName, $isSemesterAntara) {
            // Check dosen conflict
            if (in_array('dosen', $config['conflict_checks'])) {
                $this->applyDosenConflictFilter($q, $data, $config, $tableName, $isSemesterAntara);
            }

            // Check ruangan conflict
            if (in_array('ruangan', $config['conflict_checks'])) {
                if (!empty($data[$config['ruangan_field']] ?? null)) {
                    $q->orWhere($tableName . '.' . $config['ruangan_field'], $data[$config['ruangan_field']]);
                }
            }

            // Check kelompok conflict (overlap mahasiswa)
            if (in_array('kelompok', $config['conflict_checks'])) {
                $this->applyKelompokConflictFilter($q, $data, $config, $tableName, $isSemesterAntara);
            }
        });
    }

    /**
     * Apply dosen conflict filter
     */
    private function applyDosenConflictFilter($query, array $data, array $config, string $tableName, bool $isSemesterAntara): void
    {
        // Special handling for praktikum (dosen in separate table)
        if ($tableName === 'jadwal_praktikum') {
            // For praktikum, we need to check jadwal_praktikum_dosen table
            $this->applyPraktikumDosenConflictFilter($query, $data, $tableName);
            return;
        }
        
        foreach ($config['dosen_fields'] as $field) {
            if (isset($data[$field])) {
                if (is_array($data[$field])) {
                    // Multiple dosen (JSON array)
                    foreach ($data[$field] as $dosenId) {
                        $query->orWhereJsonContains($tableName . '.' . $field, $dosenId);
                    }
                } else {
                    // Single dosen
                    $query->orWhere($tableName . '.' . $field, $data[$field]);
                }
            }
        }
    }

    /**
     * Apply praktikum dosen conflict filter (special case for separate dosen table)
     */
    private function applyPraktikumDosenConflictFilter($query, array $data, string $tableName): void
    {
        // Get dosen IDs from input data (assuming it comes from praktikum form)
        $dosenIds = $data['dosen_ids'] ?? [];
        
        if (!empty($dosenIds)) {
            // Join with jadwal_praktikum_dosen table to check dosen conflicts
            $query->orWhereExists(function ($subQuery) use ($tableName, $dosenIds) {
                $subQuery->select(DB::raw(1))
                    ->from('jadwal_praktikum_dosen')
                    ->whereColumn('jadwal_praktikum_dosen.jadwal_praktikum_id', $tableName . '.id')
                    ->whereIn('jadwal_praktikum_dosen.dosen_id', $dosenIds);
            });
        }
    }

    /**
     * Apply kelompok conflict filter (check mahasiswa overlap)
     */
    private function applyKelompokConflictFilter($query, array $data, array $config, string $tableName, bool $isSemesterAntara): void
    {
        foreach ($config['kelompok_fields'] as $field) {
            if (isset($data[$field]) && $data[$field]) {
                // Get mahasiswa IDs from kelompok
                $mahasiswaIds = $this->getMahasiswaIdsFromKelompok($data[$field], $field, $isSemesterAntara);
                
                if (!empty($mahasiswaIds)) {
                    // Check if any existing schedule has mahasiswa from the same kelompok
                    foreach ($mahasiswaIds as $mahasiswaId) {
                        $query->orWhereJsonContains($tableName . '.mahasiswa_ids', $mahasiswaId);
                    }
                }
            }
        }
    }

    /**
     * Get mahasiswa IDs dari kelompok
     */
    private function getMahasiswaIdsFromKelompok($kelompokId, string $kelompokField, bool $isSemesterAntara): array
    {
        if ($isSemesterAntara) {
            if (str_contains($kelompokField, 'besar')) {
                $kelompok = KelompokBesarAntara::find($kelompokId);
                return $kelompok ? $kelompok->mahasiswa_ids ?? [] : [];
            } else {
                $kelompok = KelompokKecilAntara::find($kelompokId);
                return $kelompok ? $kelompok->mahasiswa_ids ?? [] : [];
            }
        } else {
            if (str_contains($kelompokField, 'besar')) {
                // CHECK: Jika kelompokId adalah semester (bukan ID database)
                if (is_numeric($kelompokId) && $kelompokId <= 8) {
                    // Asumsi ini adalah semester number (1-8)
                    $mahasiswaIds = KelompokBesar::where('semester', (string)$kelompokId)
                        ->pluck('mahasiswa_id')
                        ->toArray();
                } else {
                    // FIX: Get semester from kelompok_besar table first, then get all mahasiswa from that semester
                    $kelompok = KelompokBesar::find($kelompokId);
                    if (!$kelompok) {
                        return [];
                    }
                    
                    $mahasiswaIds = KelompokBesar::where('semester', $kelompok->semester)
                        ->pluck('mahasiswa_id')
                        ->toArray();
                }
                
                return $mahasiswaIds;
            } else {
                $kelompokKecil = KelompokKecil::find($kelompokId);
                if (!$kelompokKecil) {
                    return [];
                }
                
                // FIX: Get all mahasiswa from same kelompok name and semester
                return KelompokKecil::where('nama_kelompok', $kelompokKecil->nama_kelompok)
                    ->where('semester', $kelompokKecil->semester)
                    ->pluck('mahasiswa_id')
                    ->toArray();
            }
        }
    }

    /**
     * Calculate total participants for capacity validation
     */
    private function calculateTotalParticipants(array $data, string $calculationType, bool $isSemesterAntara): int
    {
        switch ($calculationType) {
            case 'kelompok_besar_plus_dosen':
                $mahasiswaCount = $this->getKelompokBesarMahasiswaCount($data, $isSemesterAntara);
                $dosenCount = $this->getDosenCount($data);
                return $mahasiswaCount + $dosenCount;

            case 'kelompok_besar_antara_plus_dosen':
                $mahasiswaCount = $this->getKelompokBesarAntaraMahasiswaCount($data);
                $dosenCount = $this->getDosenCount($data);
                return $mahasiswaCount + $dosenCount;

            case 'kelompok_kecil_plus_dosen':
                $mahasiswaCount = $this->getKelompokKecilMahasiswaCount($data, $isSemesterAntara);
                $dosenCount = $this->getDosenCount($data);
                return $mahasiswaCount + $dosenCount;

            case 'praktikum_kelompok_kecil_plus_dosen':
                $mahasiswaCount = $this->getKelompokKecilMahasiswaCount($data, $isSemesterAntara);
                $dosenCount = $this->getPraktikumDosenCount($data);
                return $mahasiswaCount + $dosenCount;

            case 'dosen_only':
                return $this->getDosenCount($data);

            default:
                return 0;
        }
    }

    /**
     * Get mahasiswa count dari kelompok besar
     */
    private function getKelompokBesarMahasiswaCount(array $data, bool $isSemesterAntara): int
    {
        if ($isSemesterAntara) {
            $kelompokId = $data['kelompok_besar_antara_id'] ?? null;
            if (!$kelompokId) return 0;
            
            $kelompok = KelompokBesarAntara::find($kelompokId);
            return $kelompok ? count($kelompok->mahasiswa_ids ?? []) : 0;
        } else {
            $semester = $data['kelompok_besar_id'] ?? null;
            if (!$semester) return 0;
            
            return KelompokBesar::where('semester', $semester)->count();
        }
    }

    /**
     * Get mahasiswa count dari kelompok besar antara
     */
    private function getKelompokBesarAntaraMahasiswaCount(array $data): int
    {
        $kelompokId = $data['kelompok_besar_antara_id'] ?? null;
        if (!$kelompokId) return 0;
        
        $kelompok = KelompokBesarAntara::find($kelompokId);
        return $kelompok ? count($kelompok->mahasiswa_ids ?? []) : 0;
    }

    /**
     * Get mahasiswa count dari kelompok kecil
     */
    private function getKelompokKecilMahasiswaCount(array $data, bool $isSemesterAntara): int
    {
        if ($isSemesterAntara) {
            $kelompokId = $data['kelompok_kecil_antara_id'] ?? null;
            if (!$kelompokId) return 0;
            
            $kelompok = KelompokKecilAntara::find($kelompokId);
            return $kelompok ? count($kelompok->mahasiswa_ids ?? []) : 0;
        } else {
            $kelompokId = $data['kelompok_kecil_id'] ?? null;
            if (!$kelompokId) return 0;
            
            $kelompokKecil = KelompokKecil::find($kelompokId);
            if (!$kelompokKecil) return 0;
            
            return KelompokKecil::where('nama_kelompok', $kelompokKecil->nama_kelompok)
                ->where('semester', $kelompokKecil->semester)
                ->count();
        }
    }

    /**
     * Get dosen count dari data
     */
    private function getDosenCount(array $data): int
    {
        $count = 0;
        $dosenFields = ['dosen_id', 'dosen_ids', 'pembimbing_id', 'penguji_id', 'komentator_id', 'koordinator_id'];
        
        foreach ($dosenFields as $field) {
            if (isset($data[$field])) {
                if (is_array($data[$field])) {
                    $count += count(array_filter($data[$field]));
                } elseif ($data[$field]) {
                    $count += 1;
                }
            }
        }
        
        return $count;
    }

    /**
     * Get praktikum dosen count dari data
     */
    private function getPraktikumDosenCount(array $data): int
    {
        // For praktikum, dosen data comes from jadwal_praktikum_dosen table
        // We'll need to count based on the dosen_ids array passed in the data
        $dosenIds = $data['dosen_ids'] ?? [];
        
        if (is_array($dosenIds)) {
            return count(array_filter($dosenIds));
        }
        
        return 0;
    }

    /**
     * Get schedule configuration
     */
    private function getScheduleConfig(string $scheduleType): ?array
    {
        return self::SCHEDULE_CONFIGS[$scheduleType] ?? null;
    }

    /**
     * Get table name dari model
     */
    private function getTableName(string $modelClass): string
    {
        return (new $modelClass)->getTable();
    }

    /**
     * Get mata kuliah semester
     */
    private function getMataKuliahSemester(?string $kode): ?string
    {
        if (!$kode) return null;
        
        $mataKuliah = MataKuliah::where('kode', $kode)->first();
        return $mataKuliah ? $mataKuliah->semester : null;
    }

    /**
     * Check if schedule type is cross-semester
     */
    private function isCrossSemesterSchedule(string $scheduleType): bool
    {
        // Jadwal yang tidak perlu filter semester
        $crossSemesterSchedules = ['seminar_proposal', 'sidang_skripsi'];
        return in_array($scheduleType, $crossSemesterSchedules);
    }

    /**
     * Check if should validate conflict between two schedule types
     */
    private function shouldCheckConflict(string $sourceType, string $checkType, bool $isSemesterAntara): bool
    {
        // Logic untuk menentukan apakah dua tipe jadwal perlu dicek bentroknya
        // UNIVERSAL: Semua jadwal bisa bentrok dengan semua jadwal lain
        // TERMASUK same type untuk cross-semester validation (reguler vs antara)
        
        // UNIVERSAL: Semua jadwal harus cek bentrok dengan diri sendiri
        // Tidak ada pengecualian, karena semua schedule types bisa bentrok resources (dosen, ruangan, waktu)
        if ($sourceType === $checkType && !$isSemesterAntara) {
            return true; // ← SELALU CEK bentrok dengan diri sendiri
        }
        
        // UNIVERSAL: Semua jadwal bisa bentrok dengan semua jadwal lain
        return true;
    }

    /**
     * Format conflict message
     */
    private function formatConflictMessage($conflictingSchedule, string $scheduleType, array $data, bool $isSemesterAntara): string
    {
        $scheduleNames = [
            'kuliah_besar' => 'Jadwal Kuliah Besar',
            'pbl' => 'Jadwal PBL',
            'csr' => 'Jadwal CSR',
            'agenda_khusus' => 'Jadwal Agenda Khusus',
            'persamaan_persepsi' => 'Jadwal Persamaan Persepsi',
            'jurnal_reading' => 'Jadwal Jurnal Reading',
            'seminar_proposal' => 'Jadwal Seminar Proposal',
            'sidang_skripsi' => 'Jadwal Sidang Skripsi',
            'jadwal_non_blok_non_csr' => 'Jadwal Materi',
            'seminar_pleno' => 'Jadwal Seminar Pleno',
            'praktikum' => 'Jadwal Praktikum'
        ];

        $scheduleName = $scheduleNames[$scheduleType] ?? 'Jadwal';
        
        // Format jam tanpa detik: 07:20:00 → 07.20
        $jamMulai = substr(str_replace(':', '.', $conflictingSchedule->jam_mulai), 0, 5);
        $jamSelesai = substr(str_replace(':', '.', $conflictingSchedule->jam_selesai), 0, 5);

        // Analisis detail bentrok - FIX: Determine source semester correctly
        $sourceIsAntara = $this->isSourceSemesterAntara($data);
        \Log::info("formatConflictMessage() - Source data schedule_type: " . ($data['schedule_type'] ?? 'null'));
        \Log::info("formatConflictMessage() - Source isAntara: " . ($sourceIsAntara ? 'true' : 'false'));
        \Log::info("formatConflictMessage() - Target checking as Antara: " . ($isSemesterAntara ? 'true' : 'false'));
        
        // FIX: Determine nama jadwal yang lebih spesifik berdasarkan jenis_baris
        $scheduleName = $this->getSpecificScheduleName($conflictingSchedule, $scheduleType);
        
        $conflictDetails = $this->analyzeConflictDetails($data, $conflictingSchedule, $scheduleType, $sourceIsAntara);

        return "Jadwal bentrok dengan {$scheduleName} pada tanggal " .
            date('d/m/Y', strtotime($data['tanggal'])) . " jam " .
            $jamMulai . "-" . $jamSelesai . ". " . $conflictDetails;
    }

    /**
     * Get specific schedule name based on jenis_baris for jadwal_non_blok_non_csr
     */
    private function getSpecificScheduleName($conflictingSchedule, string $scheduleType): string
    {
        $scheduleNames = [
            'kuliah_besar' => 'Jadwal Kuliah Besar',
            'pbl' => 'Jadwal PBL',
            'csr' => 'Jadwal CSR',
            'agenda_khusus' => 'Jadwal Agenda Khusus',
            'persamaan_persepsi' => 'Jadwal Persamaan Persepsi',
            'jurnal_reading' => 'Jadwal Jurnal Reading',
            'seminar_proposal' => 'Jadwal Seminar Proposal',
            'sidang_skripsi' => 'Jadwal Sidang Skripsi',
            'seminar_pleno' => 'Jadwal Seminar Pleno',
            'praktikum' => 'Jadwal Praktikum'
        ];

        // FIX: Check for jenis_baris regardless of scheduleType
        // This handles cases where seminar_proposal/sidang_skripsi configs use the same model
        $jenisBaris = $conflictingSchedule->jenis_baris ?? null;
        
        if ($jenisBaris) {
            switch ($jenisBaris) {
                case 'materi':
                    return 'Jadwal Materi Kuliah';
                case 'agenda':
                    return 'Jadwal Agenda Khusus';
                case 'seminar_proposal':
                    return 'Jadwal Seminar Proposal';
                case 'sidang_skripsi':
                    return 'Jadwal Sidang Skripsi';
            }
        }

        return $scheduleNames[$scheduleType] ?? 'Jadwal';
    }

    /**
     * Check if schedule is antara schedule
     */
    private function isScheduleAntara($schedule, string $scheduleType): bool
    {
        $config = self::SCHEDULE_CONFIGS[$scheduleType] ?? null;
        
        if (!$config) {
            return false;
        }
        
        // Check if schedule has antara kelompok fields
        foreach ($config['kelompok_fields'] as $field) {
            if (str_contains($field, 'antara') && isset($schedule->$field) && $schedule->$field) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Check if source data is from semester antara
     */
    private function isSourceSemesterAntara(array $data): bool
    {
        $scheduleType = $data['schedule_type'] ?? '';
        $config = self::SCHEDULE_CONFIGS[$scheduleType] ?? null;
        
        if (!$config) {
            return false;
        }
        
        // Check if source data has antara kelompok fields
        foreach ($config['kelompok_fields'] as $field) {
            if (str_contains($field, 'antara') && isset($data[$field]) && $data[$field]) {
                return true;
            }
        }
        
        return false;
    }

    /**
     * Analisis detail bentrok untuk memberikan pesan yang spesifik
     */
    private function analyzeConflictDetails(array $data, $conflictingSchedule, string $scheduleType, bool $isSemesterAntara): string
    {
        $details = [];
        $sourceConfig = self::SCHEDULE_CONFIGS[$data['schedule_type']] ?? null;
        
        // FIX: Determine actual target config based on jenis_baris for jadwal_non_blok_non_csr
        $actualTargetScheduleType = $scheduleType;
        
        // SPECIAL HANDLING: For agenda_khusus in antara semester, use agenda_khusus_antara config
        if ($scheduleType === 'agenda_khusus' && $isSemesterAntara) {
            $actualTargetScheduleType = 'agenda_khusus_antara';
        } elseif ($scheduleType === 'seminar_proposal' || $scheduleType === 'sidang_skripsi') {
            $jenisBaris = $conflictingSchedule->jenis_baris ?? null;
            if ($jenisBaris === 'materi' || $jenisBaris === 'agenda') {
                $actualTargetScheduleType = 'jadwal_non_blok_non_csr';
            }
        }
        
        $targetConfig = self::SCHEDULE_CONFIGS[$actualTargetScheduleType] ?? null;
        
        if (!$sourceConfig || !$targetConfig) {
            return "Bentrok tidak diketahui (config error)";
        }

        // Cek bentrok dosen
        if (in_array('dosen', $sourceConfig['conflict_checks']) && in_array('dosen', $targetConfig['conflict_checks'])) {
            $dosenConflict = $this->checkDosenConflict($data, $conflictingSchedule, $sourceConfig, $targetConfig);
            if ($dosenConflict) {
                $details[] = $dosenConflict;
            }
        }

        // Cek bentrok ruangan
        if (in_array('ruangan', $sourceConfig['conflict_checks']) && in_array('ruangan', $targetConfig['conflict_checks'])) {
            $ruanganConflict = $this->checkRuanganConflict($data, $conflictingSchedule, $sourceConfig, $targetConfig);
            if ($ruanganConflict) {
                $details[] = $ruanganConflict;
            }
        }

        // Cek bentrok kelompok (mahasiswa overlap)
        if (in_array('kelompok', $sourceConfig['conflict_checks']) && in_array('kelompok', $targetConfig['conflict_checks'])) {
            $kelompokConflict = $this->checkKelompokConflict($data, $conflictingSchedule, $actualTargetScheduleType, $isSemesterAntara);
            if ($kelompokConflict) {
                $details[] = $kelompokConflict;
            }
        }

        return empty($details) ? "Bentrok tidak diketahui" : "Bentrok: (" . implode(', ', $details) . ")";
    }

    /**
     * Cek bentrok dosen
     */
    private function checkDosenConflict(array $data, $conflictingSchedule, array $sourceConfig, array $targetConfig): ?string
    {
        $sourceDosenIds = $this->getDosenIds($data, $sourceConfig);
        $targetDosenIds = $this->getDosenIdsFromSchedule($conflictingSchedule, $targetConfig);

        \Log::info('checkDosenConflict() - Source dosen IDs: ' . json_encode($sourceDosenIds));
        \Log::info('checkDosenConflict() - Target dosen IDs: ' . json_encode($targetDosenIds));

        if (empty($sourceDosenIds) || empty($targetDosenIds)) {
            \Log::info('checkDosenConflict() - Empty dosen IDs, returning null');
            return null;
        }

        $overlapDosenIds = array_intersect($sourceDosenIds, $targetDosenIds);
        \Log::info('checkDosenConflict() - Overlap dosen IDs: ' . json_encode($overlapDosenIds));
        
        if (!empty($overlapDosenIds)) {
            // FIX: Show ONLY overlapping dosen, not all dosen from target schedule
            $overlappingDosen = \App\Models\User::whereIn('id', $overlapDosenIds)->get();
            $dosenNames = $overlappingDosen->pluck('name')->implode(', ');
            \Log::info('checkDosenConflict() - Dosen conflict found (overlapping dosen only): ' . $dosenNames);
            return "Dosen: {$dosenNames}";
        }

        \Log::info('checkDosenConflict() - No dosen conflict');
        return null;
    }

    /**
     * Cek bentrok ruangan
     */
    private function checkRuanganConflict(array $data, $conflictingSchedule, array $sourceConfig, array $targetConfig): ?string
    {
        $sourceRuanganId = $data[$sourceConfig['ruangan_field']] ?? null;
        $targetRuanganId = $conflictingSchedule->{$targetConfig['ruangan_field']} ?? null;

        if ($sourceRuanganId && $targetRuanganId && $sourceRuanganId == $targetRuanganId) {
            $ruangan = \App\Models\Ruangan::find($sourceRuanganId);
            return "Ruangan: " . ($ruangan->nama ?? 'Tidak diketahui');
        }

        return null;
    }

    /**
     * Cek bentrok kelompok (mahasiswa overlap)
     */
    private function checkKelompokConflict(array $data, $conflictingSchedule, string $scheduleType, bool $isSemesterAntara): ?string
    {
        // FIX: Determine if TARGET schedule is antara, not source
        $isTargetAntara = $this->isScheduleAntara($conflictingSchedule, $scheduleType);
        
        $sourceMahasiswaIds = $this->getMahasiswaIdsFromData($data, $data['schedule_type'], $isSemesterAntara);
        $targetMahasiswaIds = $this->getMahasiswaIdsFromSchedule($conflictingSchedule, $scheduleType, $isTargetAntara);

        if (empty($sourceMahasiswaIds) || empty($targetMahasiswaIds)) {
            return null;
        }

        $overlapMahasiswaIds = array_intersect($sourceMahasiswaIds, $targetMahasiswaIds);
        
        if (!empty($overlapMahasiswaIds)) {
            $count = count($overlapMahasiswaIds);
            $sourceKelompokInfo = $this->getKelompokInfo($data, $data['schedule_type'], $isSemesterAntara);
            $targetKelompokInfo = $this->getKelompokInfoFromSchedule($conflictingSchedule, $scheduleType, $isTargetAntara);
            
            // SPECIAL HANDLING for seminar_proposal and sidang_skripsi
            // For these schedules, the "kelompok" concept is actually a list of mahasiswa (mahasiswa_nims).
            // Show a mahasiswa-centric message, but maintain source-first order.
            if (in_array($scheduleType, ['seminar_proposal', 'sidang_skripsi']) || in_array($data['schedule_type'], ['seminar_proposal', 'sidang_skripsi'])) {
                $overlapIds = array_values(array_unique(array_filter($overlapMahasiswaIds)));
                $names = [];
                if (!empty($overlapIds)) {
                    $names = User::whereIn('id', $overlapIds)->pluck('name')->toArray();
                }

                if (!empty($names)) {
                    $namesStr = implode(', ', array_slice($names, 0, 3));
                    $suffix = count($names) > 3 ? ' (+' . (count($names) - 3) . ' lainnya)' : '';
                    
                    // Source-first format: if source is seminar/sidang, show mahasiswa first
                    if (in_array($data['schedule_type'], ['seminar_proposal', 'sidang_skripsi'])) {
                        $result = "Mahasiswa: {$namesStr}{$suffix} vs {$targetKelompokInfo}";
                    } else {
                        $result = "{$sourceKelompokInfo} vs Mahasiswa: {$namesStr}{$suffix}";
                    }
                } else {
                    // Source-first format for count fallback
                    if (in_array($data['schedule_type'], ['seminar_proposal', 'sidang_skripsi'])) {
                        $result = "Mahasiswa: {$count} Mahasiswa vs {$targetKelompokInfo}";
                    } else {
                        $result = "{$sourceKelompokInfo} vs Mahasiswa: {$count} Mahasiswa";
                    }
                }
            } else {
                $result = "{$sourceKelompokInfo} vs {$targetKelompokInfo} ({$count} Mahasiswa)";
            }
            
            return $result;
        }

        return null;
    }

    /**
     * Get dosen IDs from data
     */
    private function getDosenIds(array $data, array $config): array
    {
        $dosenIds = [];
        foreach ($config['dosen_fields'] as $field) {
            if (isset($data[$field])) {
                if (is_array($data[$field])) {
                    $dosenIds = array_merge($dosenIds, $data[$field]);
                } else {
                    $dosenIds[] = $data[$field];
                }
            }
        }
        return array_unique(array_filter($dosenIds));
    }

    /**
     * Get dosen IDs from schedule with universal data normalization
     */
    private function getDosenIdsFromSchedule($schedule, array $config): array
    {
        $dosenIds = [];
        
        // Special handling for praktikum (dosen in separate table)
        if (isset($config['model']) && $config['model'] === 'App\\Models\\JadwalPraktikum') {
            // Get dosen from jadwal_praktikum_dosen table
            $praktikumDosen = DB::table('jadwal_praktikum_dosen')
                ->where('jadwal_praktikum_id', $schedule->id)
                ->pluck('dosen_id')
                ->toArray();
            
            \Log::info('getDosenIdsFromSchedule() - Praktikum dosen IDs: ' . json_encode($praktikumDosen));
            return $praktikumDosen;
        }
        
        foreach ($config['dosen_fields'] as $field) {
            if (isset($schedule->$field)) {
                $value = $this->normalizeFieldValue($schedule->$field, 'dosen');
                
                if (is_array($value)) {
                    $dosenIds = array_merge($dosenIds, $value);
                } elseif ($value) {
                    $dosenIds[] = $value;
                }
            }
        }
        return array_unique(array_filter($dosenIds));
    }

    /**
     * Get mahasiswa IDs from schedule with universal data normalization
     */
    private function getMahasiswaIdsFromSchedule($schedule, string $scheduleType, bool $isSemesterAntara): array
    {
        $config = $this->getScheduleConfig($scheduleType);
        if (!$config) {
            return [];
        }

        $mahasiswaIds = [];
        
        // Special handling for praktikum (multi kelompok)
        if (isset($config['model']) && $config['model'] === 'App\\Models\\JadwalPraktikum') {
            // Get kelompok from jadwal_praktikum_kelompok table
            $praktikumKelompok = DB::table('jadwal_praktikum_kelompok')
                ->where('jadwal_praktikum_id', $schedule->id)
                ->pluck('kelompok_kecil_id')
                ->toArray();
            
            foreach ($praktikumKelompok as $kelompokId) {
                if ($kelompokId) {
                    $ids = $this->getMahasiswaIdsFromKelompok($kelompokId, 'kelompok_kecil_id', $isSemesterAntara);
                    $mahasiswaIds = array_merge($mahasiswaIds, $ids);
                }
            }
        } else {
            // Standard handling for other schedule types
            foreach ($config['kelompok_fields'] as $field) {
                if (isset($schedule->$field) && $schedule->$field) {
                    
                    // SPECIAL HANDLING for mahasiswa_nims (direct NIMs, not kelompok IDs)
                    if ($field === 'mahasiswa_nims') {
                        $nimArray = $this->normalizeFieldValue($schedule->$field, 'kelompok');
                        
                        if (is_array($nimArray) && !empty($nimArray)) {
                            // Convert NIMs to user IDs for comparison
                            $userIds = User::whereIn('nim', $nimArray)->pluck('id')->toArray();
                            $mahasiswaIds = array_merge($mahasiswaIds, $userIds);
                        }
                    } else {
                        // Standard kelompok ID handling
                        $kelompokId = $this->normalizeFieldValue($schedule->$field, 'kelompok');
                        
                        if ($kelompokId) {
                            if (is_array($kelompokId)) {
                                // Handle multiple kelompok IDs
                                foreach ($kelompokId as $id) {
                                    if ($id) {
                                        $ids = $this->getMahasiswaIdsFromKelompok($id, $field, $isSemesterAntara);
                                        $mahasiswaIds = array_merge($mahasiswaIds, $ids);
                                    }
                                }
                            } else {
                                // Single kelompok ID
                                $ids = $this->getMahasiswaIdsFromKelompok($kelompokId, $field, $isSemesterAntara);
                                $mahasiswaIds = array_merge($mahasiswaIds, $ids);
                            }
                        }
                    }
                }
            }
        }
        
        return array_unique($mahasiswaIds);
    }

    /**
     * Universal field value normalizer - handles all data inconsistencies
     */
    private function normalizeFieldValue($value, string $type): mixed
    {
        // Handle null/empty values
        if ($value === null || $value === '' || $value === 'null') {
            return null;
        }
        
        // Handle JSON strings (common inconsistency)
        if (is_string($value)) {
            // JSON array: "[1,2,3]" or "[\"a\",\"b\",\"c\"]"
            if (str_starts_with($value, '[') || str_starts_with($value, '{')) {
                $decoded = json_decode($value, true);
                if (json_last_error() === JSON_ERROR_NONE) {
                    return $decoded;
                }
            }
            
            // Comma-separated: "1,2,3" or "a,b,c"
            if (str_contains($value, ',')) {
                return array_map('trim', explode(',', $value));
            }
            
            // Numeric strings: "123"
            if (is_numeric($value)) {
                return $type === 'kelompok' ? (int)$value : $value;
            }
        }
        
        // Handle arrays (already normalized)
        if (is_array($value)) {
            return array_filter($value, fn($v) => $v !== null && $v !== '');
        }
        
        return $value;
    }

    /**
     * Get kelompok info from data
     */
    private function getKelompokInfo(array $data, string $scheduleType, bool $isSemesterAntara): string
    {
        $config = self::SCHEDULE_CONFIGS[$scheduleType];
        
        // Debug: Log untuk melihat data dan config
        \Log::info('Getting kelompok info for schedule type: ' . $scheduleType);
        \Log::info('Config kelompok_fields: ' . json_encode($config['kelompok_fields']));
        \Log::info('Data: ' . json_encode($data));
        
        if ($isSemesterAntara) {
            // Loop through kelompok_fields untuk mencari field antara
            foreach ($config['kelompok_fields'] as $field) {
                if (str_contains($field, 'antara') && isset($data[$field]) && $data[$field]) {
                    \Log::info('Found antara kelompok field: ' . $field . ' with value: ' . $data[$field]);
                    
                    if (str_contains($field, 'besar')) {
                        $kelompok = \App\Models\KelompokBesarAntara::find($data[$field]);
                        return $kelompok ? "Kelompok Besar Antara {$kelompok->nama_kelompok}" : "Kelompok Besar Antara";
                    } elseif (str_contains($field, 'kecil')) {
                        $kelompok = \App\Models\KelompokKecilAntara::find($data[$field]);
                        return $kelompok ? "Kelompok Kecil Antara {$kelompok->nama_kelompok}" : "Kelompok Kecil Antara";
                    }
                }
            }
        } else {
            // Loop through kelompok_fields untuk mencari yang ada
            foreach ($config['kelompok_fields'] as $field) {
                if (str_contains($field, 'besar') && isset($data[$field])) {
                    \Log::info('Found kelompok_besar field: ' . $field . ' with value: ' . $data[$field]);
                    return "Kelompok Besar Semester {$data[$field]}";
                } elseif (str_contains($field, 'kecil') && isset($data[$field])) {
                    \Log::info('Found kelompok_kecil field: ' . $field . ' with value: ' . json_encode($data[$field]));
                    
                    // Handle array field (kelompok_kecil_ids) vs single field (kelompok_kecil_id)
                    if (is_array($data[$field])) {
                        // Array field - get multiple kelompok
                        $kelompokIds = $data[$field];
                        $kelompokList = \App\Models\KelompokKecil::whereIn('id', $kelompokIds)->get();
                        
                        if ($kelompokList->isNotEmpty()) {
                            $kelompokNames = $kelompokList->pluck('nama_kelompok')->toArray();
                            if (count($kelompokNames) === 1) {
                                return "Kelompok Kecil " . $kelompokNames[0];
                            } else {
                                return "Kelompok Kecil " . implode(', ', $kelompokNames);
                            }
                        }
                        return "Kelompok Kecil " . implode(', ', $kelompokIds);
                    } else {
                        // Single field - get single kelompok
                        $kelompok = \App\Models\KelompokKecil::find($data[$field]);
                        if ($kelompok) {
                            return "Kelompok Kecil {$kelompok->nama_kelompok}";
                        }
                        return "Kelompok Kecil {$data[$field]}";
                    }
                }
            }
        }
        
        return "Kelompok";
    }

    /**
     * Get kelompok info from schedule
     */
    private function getKelompokInfoFromSchedule($schedule, string $scheduleType, bool $isSemesterAntara): string
    {
        $config = self::SCHEDULE_CONFIGS[$scheduleType];
        
        // Special handling for praktikum (multi kelompok)
        if (isset($config['model']) && $config['model'] === 'App\\Models\\JadwalPraktikum') {
            // Get kelompok from jadwal_praktikum_kelompok table
            $praktikumKelompok = DB::table('jadwal_praktikum_kelompok')
                ->join('kelompok_kecil', 'jadwal_praktikum_kelompok.kelompok_kecil_id', '=', 'kelompok_kecil.id')
                ->where('jadwal_praktikum_kelompok.jadwal_praktikum_id', $schedule->id)
                ->pluck('kelompok_kecil.nama_kelompok')
                ->toArray();
            
            if (!empty($praktikumKelompok)) {
                if (count($praktikumKelompok) === 1) {
                    return "Kelompok Kecil " . $praktikumKelompok[0];
                } else {
                    return "Kelompok Kecil " . implode(', ', $praktikumKelompok);
                }
            }
            
            return "Kelompok Kecil Praktikum";
        }
        
        // SPECIAL HANDLING for seminar_proposal and sidang_skripsi
        // Use jenis_baris from actual data, not from scheduleType parameter
        $actualJenisBaris = $schedule->jenis_baris ?? null;
        if ($actualJenisBaris === 'seminar_proposal' || $actualJenisBaris === 'sidang_skripsi') {
            // Count mahasiswa from mahasiswa_nims field
            if (isset($schedule->mahasiswa_nims) && $schedule->mahasiswa_nims) {
                $nimArray = $this->normalizeFieldValue($schedule->mahasiswa_nims, 'kelompok');
                $count = is_array($nimArray) ? count($nimArray) : 0;
                return "{$count} Mahasiswa";
            }
            
            return "0 Mahasiswa";
        }
        
        // FIX: Determine if this is antara schedule from the schedule data itself
        $isTargetAntara = $this->isScheduleAntara($schedule, $scheduleType);
        
        if ($isTargetAntara) {
            // Loop through kelompok_fields untuk mencari field antara
            foreach ($config['kelompok_fields'] as $field) {
                if (str_contains($field, 'antara') && isset($schedule->$field) && $schedule->$field) {
                    
                    if (str_contains($field, 'besar')) {
                        $kelompok = \App\Models\KelompokBesarAntara::find($schedule->$field);
                        return $kelompok ? "Kelompok Besar Antara {$kelompok->nama_kelompok}" : "Kelompok Besar Antara";
                    } elseif (str_contains($field, 'kecil')) {
                        $kelompok = \App\Models\KelompokKecilAntara::find($schedule->$field);
                        return $kelompok ? "Kelompok Kecil Antara {$kelompok->nama_kelompok}" : "Kelompok Kecil Antara";
                    }
                }
            }
        } else {
            // Loop through kelompok_fields untuk mencari yang ada
            foreach ($config['kelompok_fields'] as $field) {
                if (str_contains($field, 'besar') && isset($schedule->$field)) {
                    \Log::info('Found kelompok_besar field: ' . $field . ' with value: ' . $schedule->$field);
                    return "Kelompok Besar Semester {$schedule->$field}";
                } elseif (str_contains($field, 'kecil') && isset($schedule->$field)) {
                    \Log::info('Found kelompok_kecil field: ' . $field . ' with value: ' . $schedule->$field);
                    
                    // Semester Reguler - format sederhana: Kelompok Kecil 1
                    $kelompok = \App\Models\KelompokKecil::find($schedule->$field);
                    \Log::info('Kelompok Kecil found: ' . json_encode($kelompok));
                    if ($kelompok) {
                        return "Kelompok Kecil {$kelompok->nama_kelompok}";
                    }
                    return "Kelompok Kecil {$schedule->$field}";
                }
            }
        }
        
        return "Kelompok";
    }

    /**
     * Validasi bentrok antar baris data Excel
     */
    public function validateAntarBarisExcel(array $excelData, string $scheduleType, ?bool $isSemesterAntara = false): array
    {
        $errors = [];

        foreach ($excelData as $index => $data) {
            try {
                // Validasi bentrok antar baris Excel
                for ($j = 0; $j < $index; $j++) {
                    $previousData = $excelData[$j];
                    
                    if ($this->isDataBentrok($data, $previousData, $scheduleType, $isSemesterAntara)) {
                        
                        // Get dosen names using config
                        $config = self::SCHEDULE_CONFIGS[$scheduleType];
                        $dosenNames = [];
                        $dosenFields = $config['dosen_fields'];
                        
                        foreach ($dosenFields as $field) {
                            $dosenIds = $this->normalizeFieldValue($data[$field] ?? null, 'dosen');
                            if (is_array($dosenIds)) {
                                foreach ($dosenIds as $dosenId) {
                                    if ($dosenId) {
                                        $dosen = \App\Models\User::find($dosenId);
                                        if ($dosen) {
                                            $dosenNames[] = $dosen->name;
                                        }
                                    }
                                }
                            } elseif ($dosenIds) {
                                $dosen = \App\Models\User::find($dosenIds);
                                if ($dosen) {
                                    $dosenNames[] = $dosen->name;
                                }
                            }
                        }
                        
                        $dosenNameStr = empty($dosenNames) ? 'N/A' : implode(', ', $dosenNames);
                        $ruanganName = \App\Models\Ruangan::find($data['ruangan_id'])->nama ?? 'N/A';
                        
                        // Cek penyebab bentrok spesifik menggunakan config
                        $conflictDetails = [];
                        
                        // Cek dosen conflict
                        foreach ($dosenFields as $field) {
                            $dosenIds1 = $this->normalizeFieldValue($data[$field] ?? null, 'dosen');
                            $dosenIds2 = $this->normalizeFieldValue($previousData[$field] ?? null, 'dosen');
                            
                            if (is_array($dosenIds1) && is_array($dosenIds2)) {
                                $intersectingDosen = array_intersect($dosenIds1, $dosenIds2);
                                if (!empty($intersectingDosen)) {
                                    $conflictDetails[] = "Dosen: {$dosenNameStr}";
                                    break;
                                }
                            } elseif ($dosenIds1 && $dosenIds2 && $dosenIds1 == $dosenIds2) {
                                $conflictDetails[] = "Dosen: {$dosenNameStr}";
                                break;
                            }
                        }
                        
                        // Cek ruangan
                        if ($data['ruangan_id'] && $previousData['ruangan_id'] && $data['ruangan_id'] == $previousData['ruangan_id']) {
                            $conflictDetails[] = "Ruangan: {$ruanganName}";
                        }
                        
                        // Cek kelompok menggunakan config (hanya untuk semester biasa)
                        if (!$isSemesterAntara) {
                            $kelompokFields = $config['kelompok_fields'];
                            
                            foreach ($kelompokFields as $field) {
                                $kelompokId1 = $this->normalizeFieldValue($data[$field] ?? null, 'kelompok');
                                $kelompokId2 = $this->normalizeFieldValue($previousData[$field] ?? null, 'kelompok');
                                
                                if ($kelompokId1 && $kelompokId2 && $kelompokId1 == $kelompokId2) {
                                    $kelompokInfo1 = $this->getKelompokInfo($data, $scheduleType, $isSemesterAntara);
                                    $kelompokInfo2 = $this->getKelompokInfo($previousData, $scheduleType, $isSemesterAntara);
                                    $conflictDetails[] = "{$kelompokInfo1} vs {$kelompokInfo2}";
                                    break;
                                }
                            }
                        }
                        
                        $conflictString = empty($conflictDetails) ? 'Tidak diketahui' : implode(', ', $conflictDetails);
                        $errors[] = "Baris " . ($index + 1) . ": Jadwal bentrok dengan data pada baris " . ($j + 1) . " ({$conflictString})";
                        break;
                    }
                }
            } catch (\Exception $e) {
                $errors[] = "Baris " . ($index + 1) . ": " . $e->getMessage();
            }
        }

        return $errors;
    }

    /**
     * Cek apakah dua data bentrok (untuk validasi import antar baris)
     */
    private function isDataBentrok($data1, $data2, string $scheduleType, bool $isSemesterAntara = false): bool
    {
        // Cek apakah tanggal sama
        if ($data1['tanggal'] !== $data2['tanggal']) {
            return false;
        }

        // Cek apakah jam bentrok
        $jamMulai1 = $data1['jam_mulai'];
        $jamSelesai1 = $data1['jam_selesai'];
        $jamMulai2 = $data2['jam_mulai'];
        $jamSelesai2 = $data2['jam_selesai'];

        // Konversi jam ke format yang bisa dibandingkan
        $jamMulai1Formatted = str_replace('.', ':', $jamMulai1);
        $jamSelesai1Formatted = str_replace('.', ':', $jamSelesai1);
        $jamMulai2Formatted = str_replace('.', ':', $jamMulai2);
        $jamSelesai2Formatted = str_replace('.', ':', $jamSelesai2);

        // Cek apakah jam bentrok
        $jamBentrok = ($jamMulai1Formatted < $jamSelesai2Formatted && $jamSelesai1Formatted > $jamMulai2Formatted);

        if (!$jamBentrok) {
            return false;
        }

        // Cek bentrok dosen menggunakan config
        $dosenBentrok = false;
        $config = self::SCHEDULE_CONFIGS[$scheduleType];
        $dosenFields = $config['dosen_fields'];
        
        foreach ($dosenFields as $field) {
            $dosenIds1 = $this->normalizeFieldValue($data1[$field] ?? null, 'dosen');
            $dosenIds2 = $this->normalizeFieldValue($data2[$field] ?? null, 'dosen');
            
            if (is_array($dosenIds1) && is_array($dosenIds2)) {
                $intersectingDosen = array_intersect($dosenIds1, $dosenIds2);
                if (!empty($intersectingDosen)) {
                    $dosenBentrok = true;
                    break;
                }
            } elseif ($dosenIds1 && $dosenIds2 && $dosenIds1 == $dosenIds2) {
                $dosenBentrok = true;
                break;
            }
        }

        // Cek bentrok ruangan
        $ruanganBentrok = false;
        if (isset($data1['ruangan_id']) && isset($data2['ruangan_id']) && $data1['ruangan_id'] == $data2['ruangan_id']) {
            $ruanganBentrok = true;
        }

        // Cek bentrok kelompok menggunakan config (hanya untuk semester biasa)
        $kelompokBentrok = false;
        if (!$isSemesterAntara) {
            $kelompokFields = $config['kelompok_fields'];
            
            foreach ($kelompokFields as $field) {
                $kelompokId1 = $this->normalizeFieldValue($data1[$field] ?? null, 'kelompok');
                $kelompokId2 = $this->normalizeFieldValue($data2[$field] ?? null, 'kelompok');
                
                if ($kelompokId1 && $kelompokId2 && $kelompokId1 == $kelompokId2) {
                    $kelompokBentrok = true;
                    break;
                }
            }
        }

        return $dosenBentrok || $ruanganBentrok || $kelompokBentrok;
    }

    private function getImportConflictDetails($data1, $data2, string $scheduleType, bool $isSemesterAntara = false): string
    {
        $config = self::SCHEDULE_CONFIGS[$scheduleType] ?? null;
        if (!$config) {
            return 'Tidak diketahui';
        }

        $conflictDetails = [];

        $dosenFields = $config['dosen_fields'] ?? [];
        $overlapDosenIds = [];
        foreach ($dosenFields as $field) {
            $dosenIds1 = $this->normalizeFieldValue($data1[$field] ?? null, 'dosen');
            $dosenIds2 = $this->normalizeFieldValue($data2[$field] ?? null, 'dosen');

            if (is_array($dosenIds1) && is_array($dosenIds2)) {
                $overlapDosenIds = array_merge($overlapDosenIds, array_values(array_intersect($dosenIds1, $dosenIds2)));
            } elseif ($dosenIds1 && $dosenIds2 && $dosenIds1 == $dosenIds2) {
                $overlapDosenIds[] = $dosenIds1;
            }
        }
        $overlapDosenIds = array_values(array_unique(array_filter($overlapDosenIds)));
        if (!empty($overlapDosenIds)) {
            $dosenNames = User::whereIn('id', $overlapDosenIds)->pluck('name')->implode(', ');
            $conflictDetails[] = "Dosen: " . ($dosenNames !== '' ? $dosenNames : 'N/A');
        }

        $ruangan1 = $data1['ruangan_id'] ?? null;
        $ruangan2 = $data2['ruangan_id'] ?? null;
        if ($ruangan1 && $ruangan2 && $ruangan1 == $ruangan2) {
            $ruanganName = \App\Models\Ruangan::find($ruangan1)->nama ?? 'N/A';
            $conflictDetails[] = "Ruangan: {$ruanganName}";
        }

        $sourceMahasiswaIds = $this->getMahasiswaIdsFromData($data1, $scheduleType, $isSemesterAntara);
        $targetMahasiswaIds = $this->getMahasiswaIdsFromData($data2, $scheduleType, $isSemesterAntara);
        if (!empty($sourceMahasiswaIds) && !empty($targetMahasiswaIds)) {
            $intersection = array_intersect($sourceMahasiswaIds, $targetMahasiswaIds);
            if (!empty($intersection)) {
                // SPECIAL HANDLING for seminar_proposal and sidang_skripsi
                // Show mahasiswa names instead of kelompok info
                if (in_array($scheduleType, ['seminar_proposal', 'sidang_skripsi'])) {
                    $overlapIds = array_values(array_unique(array_filter($intersection)));
                    $names = User::whereIn('id', $overlapIds)->pluck('name')->toArray();
                    
                    if (!empty($names)) {
                        $namesStr = implode(', ', array_slice($names, 0, 3));
                        $suffix = count($names) > 3 ? ' (+' . (count($names) - 3) . ' lainnya)' : '';
                        $conflictDetails[] = "Mahasiswa: {$namesStr}{$suffix}";
                    } else {
                        $conflictDetails[] = "Mahasiswa: " . count($intersection) . " Mahasiswa";
                    }
                } else {
                    // Standard kelompok vs kelompok for other schedule types
                    $kelompokInfo1 = $this->getKelompokInfo($data1, $scheduleType, $isSemesterAntara);
                    $kelompokInfo2 = $this->getKelompokInfo($data2, $scheduleType, $isSemesterAntara);
                    $conflictDetails[] = "Kelompok: {$kelompokInfo1} vs {$kelompokInfo2}";
                }
            }
        }

        return empty($conflictDetails) ? 'Tidak diketahui' : implode(', ', $conflictDetails);
    }

    /**
     * Public method untuk validasi bentrok antar baris import
     */
    public function validateImportDataConflict($data1, $data2, string $scheduleType, bool $isSemesterAntara = false): bool
    {
        return $this->isDataBentrok($data1, $data2, $scheduleType, $isSemesterAntara);
    }

    public function validateImportDataConflictDetail($data1, $data2, string $scheduleType, bool $isSemesterAntara = false): ?string
    {
        if (!$this->isDataBentrok($data1, $data2, $scheduleType, $isSemesterAntara)) {
            return null;
        }

        return $this->getImportConflictDetails($data1, $data2, $scheduleType, $isSemesterAntara);
    }

    private function getMahasiswaIdsFromData(array $data, string $scheduleType, bool $isSemesterAntara): array
    {
        $config = self::SCHEDULE_CONFIGS[$scheduleType];
        $mahasiswaIds = [];

        foreach ($config['kelompok_fields'] as $field) {
            if (isset($data[$field]) && $data[$field]) {
                
                // SPECIAL HANDLING for mahasiswa_nims (direct NIMs, not kelompok IDs)
                if ($field === 'mahasiswa_nims') {
                    $nimArray = $this->normalizeFieldValue($data[$field], 'kelompok');
                    
                    if (is_array($nimArray) && !empty($nimArray)) {
                        // Convert NIMs to user IDs for comparison
                        $userIds = User::whereIn('nim', $nimArray)->pluck('id')->toArray();
                        $mahasiswaIds = array_merge($mahasiswaIds, $userIds);
                    }
                } else {
                    // Standard kelompok ID handling
                    $kelompokId = $this->normalizeFieldValue($data[$field], 'kelompok');
                    
                    if ($kelompokId) {
                        if (is_array($kelompokId)) {
                            // Handle multiple kelompok IDs
                            foreach ($kelompokId as $id) {
                                $ids = $this->getMahasiswaIdsFromKelompok($id, $field, $isSemesterAntara);
                                $mahasiswaIds = array_merge($mahasiswaIds, $ids);
                            }
                        } else {
                            // Single kelompok ID
                            $ids = $this->getMahasiswaIdsFromKelompok($kelompokId, $field, $isSemesterAntara);
                            $mahasiswaIds = array_merge($mahasiswaIds, $ids);
                        }
                    }
                }
                
                if (!empty($mahasiswaIds)) {
                    break;
                }
            }
        }

        return array_filter($mahasiswaIds);
    }

    /**
     * Validasi tanggal jadwal dalam rentang mata kuliah
     */
    public function validateTanggalMataKuliah(array $data, $mataKuliah): ?string
    {
        $tanggalJadwal = $data['tanggal'];

        // Ambil tanggal mulai dan akhir mata kuliah
        $tanggalMulai = $mataKuliah->tanggal_mulai ?? $mataKuliah->tanggalMulai;
        $tanggalAkhir = $mataKuliah->tanggal_akhir ?? $mataKuliah->tanggalAkhir;

        if (!$tanggalMulai || !$tanggalAkhir) {
            return 'Mata kuliah tidak memiliki rentang tanggal yang valid';
        }

        // Konversi ke format yang sama untuk perbandingan
        $tanggalJadwalFormatted = date('Y-m-d', strtotime($tanggalJadwal));
        $tanggalMulaiFormatted = date('Y-m-d', strtotime($tanggalMulai));
        $tanggalAkhirFormatted = date('Y-m-d', strtotime($tanggalAkhir));

        // Validasi tanggal jadwal harus dalam rentang mata kuliah
        if ($tanggalJadwalFormatted < $tanggalMulaiFormatted) {
            return "Tanggal jadwal ({$tanggalJadwalFormatted}) tidak boleh sebelum tanggal mulai mata kuliah ({$tanggalMulaiFormatted})";
        }

        if ($tanggalJadwalFormatted > $tanggalAkhirFormatted) {
            return "Tanggal jadwal ({$tanggalJadwalFormatted}) tidak boleh setelah tanggal akhir mata kuliah ({$tanggalAkhirFormatted})";
        }

        return null;
    }
}
