<?php

namespace App\Imports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class HybridMahasiswaImport implements ToCollection, WithHeadingRow, WithChunkReading
{
    private $totalProcessed = 0;
    private $totalFailed = 0;
    private $errors = [];
    private $failedRows = [];
    private $existingNims = [];
    private $existingUsernames = [];
    private $existingEmails = [];

    public function __construct()
    {
        $this->loadExistingData();
    }

    public function chunkSize(): int
    {
        return 500; // Optimal balance
    }

    private function loadExistingData()
    {
        // Pre-load existing data for duplicate checking
        $this->existingNims = DB::table('users')
            ->where('role', 'mahasiswa')
            ->pluck('nim')
            ->toArray();

        $this->existingUsernames = DB::table('users')
            ->where('role', 'mahasiswa')
            ->pluck('username')
            ->toArray();

        $this->existingEmails = DB::table('users')
            ->where('role', 'mahasiswa')
            ->pluck('email')
            ->toArray();
    }

    public function collection(Collection $rows)
    {
        $startTime = microtime(true);
        $validUsers = [];
        $batchSize = 100; // Insert in smaller batches for safety

        foreach ($rows as $index => $row) {
            $this->totalProcessed++;

            try {
                // Basic validation
                $userData = $this->validateAndPrepareUserData($row, $index + 2);

                if ($userData === null) {
                    $this->totalFailed++;
                    continue;
                }

                $validUsers[] = $userData;

                // Batch insert when reaching batch size
                if (count($validUsers) >= $batchSize) {
                    $this->batchInsertUsers($validUsers);
                    $validUsers = [];
                }

            } catch (\Exception $e) {
                $this->totalFailed++;
                $this->failedRows[] = $row->toArray();
                $this->errors[] = "Error processing row " . ($index + 2) . ": " . $e->getMessage();
                Log::error("Import error at row " . ($index + 2) . ": " . $e->getMessage());
            }
        }

        // Insert remaining users
        if (!empty($validUsers)) {
            $this->batchInsertUsers($validUsers);
        }

        $endTime = microtime(true);
        $processingTime = round($endTime - $startTime, 2);
        Log::info("Hybrid Import: Processed " . $rows->count() . " rows in " . $processingTime . " seconds");
    }

    private function validateAndPrepareUserData($row, $rowNumber)
    {
        // Essential field validation
        $essentialFields = ['nim', 'nama', 'username', 'email'];
        foreach ($essentialFields as $field) {
            if (empty($row[$field])) {
                $this->errors[] = "Row {$rowNumber}: {$field} is required";
                return null;
            }
        }

        // Duplicate check
        if (in_array($row['nim'], $this->existingNims)) {
            $this->errors[] = "Row {$rowNumber}: NIM {$row['nim']} already exists";
            return null;
        }

        if (in_array($row['username'], $this->existingUsernames)) {
            $this->errors[] = "Row {$rowNumber}: Username {$row['username']} already exists";
            return null;
        }

        if (in_array($row['email'], $this->existingEmails)) {
            $this->errors[] = "Row {$rowNumber}: Email {$row['email']} already exists";
            return null;
        }

        // Email format validation
        if (!filter_var($row['email'], FILTER_VALIDATE_EMAIL)) {
            $this->errors[] = "Row {$rowNumber}: Invalid email format";
            return null;
        }

        // NIM format validation (basic)
        if (!preg_match('/^[0-9]{10,15}$/', $row['nim'])) {
            $this->errors[] = "Row {$rowNumber}: NIM must be 10-15 digits";
            return null;
        }

        // Prepare user data with safe defaults
        $userData = [
            'nim' => trim($row['nim']),
            'name' => trim($row['nama']),
            'username' => trim($row['username']),
            'email' => trim($row['email']),
            'telp' => $this->cleanPhoneNumber($row['telepon'] ?? ''),
            'password' => bcrypt($this->generatePassword($row['nim'])),
            'gender' => $this->validateGender($row['gender'] ?? ''),
            'ipk' => $this->validateIPK($row['ipk'] ?? ''),
            'status' => $this->validateStatus($row['status'] ?? ''),
            'angkatan' => $this->validateAngkatan($row['angkatan'] ?? ''),
            'role' => 'mahasiswa',
            'semester' => $this->validateSemester($row['semester'] ?? ''),
            'created_at' => now(),
            'updated_at' => now(),
        ];

        // Add to existing arrays to prevent duplicates in same batch
        $this->existingNims[] = $userData['nim'];
        $this->existingUsernames[] = $userData['username'];
        $this->existingEmails[] = $userData['email'];

        return $userData;
    }

    private function cleanPhoneNumber($phone)
    {
        $phone = preg_replace('/[^0-9]/', '', $phone);
        return !empty($phone) ? $phone : '0000000000';
    }

    private function generatePassword($nim)
    {
        // Generate password based on NIM for security
        return 'mahasiswa' . substr($nim, -4);
    }

    private function validateGender($gender)
    {
        $validGenders = ['Laki-laki', 'Perempuan', 'L', 'P'];
        $gender = trim($gender);

        if (in_array($gender, $validGenders)) {
            return in_array($gender, ['L', 'P']) ?
                ($gender === 'L' ? 'Laki-laki' : 'Perempuan') : $gender;
        }

        return 'Laki-laki'; // Default
    }

    private function validateIPK($ipk)
    {
        $ipk = floatval($ipk);
        return ($ipk >= 0 && $ipk <= 4) ? $ipk : 0;
    }

    private function validateStatus($status)
    {
        $validStatuses = ['aktif', 'tidak aktif', 'lulus', 'drop out'];
        $status = strtolower(trim($status));

        return in_array($status, $validStatuses) ? $status : 'aktif';
    }

    private function validateAngkatan($angkatan)
    {
        $angkatan = intval($angkatan);
        $currentYear = date('Y');

        return ($angkatan >= 2000 && $angkatan <= $currentYear + 1) ? $angkatan : $currentYear;
    }

    private function validateSemester($semester)
    {
        $semester = intval($semester);
        return ($semester >= 1 && $semester <= 14) ? $semester : 1;
    }

    private function batchInsertUsers(array $users)
    {
        if (empty($users)) return;

        try {
            DB::beginTransaction();

            // Use raw SQL for speed but with transaction safety
            $columns = ['nim', 'name', 'username', 'email', 'telp', 'password', 'gender', 'ipk', 'status', 'angkatan', 'role', 'semester', 'created_at', 'updated_at'];

            $values = [];
            $placeholders = [];

            foreach ($users as $user) {
                $rowValues = [];
                foreach ($columns as $column) {
                    $rowValues[] = $user[$column];
                }
                $values = array_merge($values, $rowValues);
                $placeholders[] = '(' . str_repeat('?,', count($columns) - 1) . '?)';
            }

            $sql = "INSERT INTO users (" . implode(',', $columns) . ") VALUES " . implode(',', $placeholders);

            DB::insert($sql, $values);
            DB::commit();

        } catch (\Exception $e) {
            DB::rollBack();
            Log::error("Batch insert failed: " . $e->getMessage());
            throw $e;
        }
    }

    public function getTotalProcessed()
    {
        return $this->totalProcessed;
    }

    public function getTotalFailed()
    {
        return $this->totalFailed;
    }

    public function getImportedCount()
    {
        return $this->totalProcessed - $this->totalFailed;
    }

    public function getErrors()
    {
        return $this->errors;
    }

    public function getFailedRows()
    {
        return $this->failedRows;
    }

    public function getCellErrors()
    {
        return []; // No cell errors in hybrid mode
    }
}
