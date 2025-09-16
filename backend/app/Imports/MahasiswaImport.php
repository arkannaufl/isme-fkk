<?php

namespace App\Imports;

use App\Models\User;
use App\Services\SemesterService;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Maatwebsite\Excel\Concerns\WithChunkReading;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class MahasiswaImport implements ToCollection, WithHeadingRow, WithChunkReading
{
    private $errors = [];
    private $failedRows = [];
    private $cellErrors = [];
    private $seenNimsInFile = [];
    private $seenUsernamesInFile = [];
    private $seenEmailsInFile = [];
    private $semesterService;
    private $totalProcessed = 0;
    private $totalFailed = 0;
    private $existingNims = [];
    private $existingUsernames = [];
    private $existingEmails = [];

    public function __construct(SemesterService $semesterService)
    {
        $this->semesterService = $semesterService;
        $this->loadExistingData();
    }

    public function chunkSize(): int
    {
        return 1000; // Process 1000 rows at a time for maximum performance
    }

    public function collection(Collection $rows)
    {
        $validUsers = [];
        $chunkStartTime = microtime(true);
        $chunkFailedCount = 0;

        foreach ($rows as $index => $row) {
            $this->totalProcessed++;
            $originalRowArray = $row->toArray();
            $rowArray = $originalRowArray;
            $rowArray['name'] = $originalRowArray['nama'] ?? null;
            $rowArray['telp'] = $originalRowArray['telepon'] ?? null;

            $currentRowErrors = [];

            // Minimal validation for speed - only check essential fields
            $basicValidator = Validator::make($rowArray, [
                'nim' => 'required|numeric',
                'name' => 'required',
                'username' => 'required',
                'email' => 'required|email',
            ], [
                'nim.required' => 'NIM harus diisi (Baris '.($index+2).')',
                'nim.numeric' => 'NIM harus berupa angka (Baris '.($index+2).')',
                'name.required' => 'Nama harus diisi (Baris '.($index+2).')',
                'username.required' => 'Username harus diisi (Baris '.($index+2).')',
                'email.required' => 'Email harus diisi (Baris '.($index+2).')',
                'email.email' => 'Email tidak valid (Baris '.($index+2).')',
            ]);

            if ($basicValidator->fails()) {
                foreach ($basicValidator->errors()->messages() as $field => $messages) {
                    foreach ($messages as $message) {
                        $excelFieldName = $field;
                        if ($field === 'name') $excelFieldName = 'nama';
                        if ($field === 'telp') $excelFieldName = 'telepon';
                        $currentRowErrors[] = [
                            'type' => 'required_or_min',
                            'field' => $excelFieldName,
                            'message' => $message,
                            'nim' => $rowArray['nim'] ?? null,
                        ];
                    }
                }
            }

            // Duplicate in file
            if (isset($rowArray['nim']) && trim($rowArray['nim']) !== '') {
                if (in_array(trim($rowArray['nim']), $this->seenNimsInFile)) {
                    $currentRowErrors[] = [
                        'type' => 'duplicate_in_file',
                        'field' => 'nim',
                        'message' => "NIM '{$rowArray['nim']}' sudah terdaftar dalam file ini (Baris ".($index+2).')',
                        'nim' => $rowArray['nim'] ?? null,
                    ];
                } else {
                    $this->seenNimsInFile[] = trim($rowArray['nim']);
                }
            }
            if (isset($rowArray['username']) && trim($rowArray['username']) !== '') {
                if (in_array(trim($rowArray['username']), $this->seenUsernamesInFile)) {
                    $currentRowErrors[] = [
                        'type' => 'duplicate_in_file',
                        'field' => 'username',
                        'message' => "Username '{$rowArray['username']}' sudah terdaftar dalam file ini (Baris ".($index+2).')',
                        'nim' => $rowArray['nim'] ?? null,
                    ];
                } else {
                    $this->seenUsernamesInFile[] = trim($rowArray['username']);
                }
            }
            if (isset($rowArray['email']) && trim($rowArray['email']) !== '') {
                if (in_array(trim($rowArray['email']), $this->seenEmailsInFile)) {
                    $currentRowErrors[] = [
                        'type' => 'duplicate_in_file',
                        'field' => 'email',
                        'message' => "Email '{$rowArray['email']}' sudah terdaftar dalam file ini (Baris ".($index+2).')',
                        'nim' => $rowArray['nim'] ?? null,
                    ];
                } else {
                    $this->seenEmailsInFile[] = trim($rowArray['email']);
                }
            }

            // Duplicate in DB - only check if basic validation passed
            if (empty($currentRowErrors)) {
                // Fast array lookup instead of database queries
                if (isset($rowArray['nim']) && in_array($rowArray['nim'], $this->existingNims)) {
                    $currentRowErrors[] = [
                        'type' => 'duplicate_in_db',
                        'field' => 'nim',
                        'message' => 'NIM sudah terdaftar di database (Baris '.($index+2).')',
                        'nim' => $rowArray['nim'] ?? null,
                    ];
                }
                if (isset($rowArray['username']) && in_array($rowArray['username'], $this->existingUsernames)) {
                    $currentRowErrors[] = [
                        'type' => 'duplicate_in_db',
                        'field' => 'username',
                        'message' => 'Username sudah terdaftar di database (Baris '.($index+2).')',
                        'nim' => $rowArray['nim'] ?? null,
                    ];
                }
                if (isset($rowArray['email']) && !empty($rowArray['email']) && in_array($rowArray['email'], $this->existingEmails)) {
                    $currentRowErrors[] = [
                        'type' => 'duplicate_in_db',
                        'field' => 'email',
                        'message' => 'Email sudah terdaftar di database (Baris '.($index+2).')',
                        'nim' => $rowArray['nim'] ?? null,
                    ];
                }
            }

            if (!empty($currentRowErrors)) {
                $chunkFailedCount++;
                $this->totalFailed++;
                foreach ($currentRowErrors as $error) {
                    $this->errors[] = $error['message'];
                    $this->cellErrors[] = [
                        'row' => $index,
                        'field' => $error['field'],
                        'message' => $error['message'],
                        'nim' => $error['nim'],
                    ];
                }
                $this->failedRows[] = $originalRowArray;
                continue;
            }

            // Add to valid users array for batch insert with default values
            $validUsers[] = [
                'nim' => $rowArray['nim'],
                'name' => $rowArray['name'],
                'username' => $rowArray['username'],
                'email' => $rowArray['email'],
                'telp' => $rowArray['telp'] ?? '0000000000',
                'password' => Hash::make($rowArray['password'] ?? 'password123'),
                'gender' => $rowArray['gender'] ?? 'Laki-laki',
                'ipk' => $rowArray['ipk'] ?? 0,
                'status' => $rowArray['status'] ?? 'aktif',
                'angkatan' => $rowArray['angkatan'] ?? date('Y'),
                'role' => 'mahasiswa',
                'semester' => $rowArray['semester'] ?? 1,
                'created_at' => now(),
                'updated_at' => now(),
            ];
        }

        // Batch insert valid users
        if (!empty($validUsers)) {
            try {
                DB::table('users')->insert($validUsers);

                // Skip semester update for maximum speed - can be done later via command
                // $this->updateSemesterForNewUsers($validUsers);
            } catch (\Exception $e) {
                // Log error but don't stop the process
                Log::error("Error inserting users batch: " . $e->getMessage());
                $this->errors[] = "Error database: " . $e->getMessage();
            }
        }

        // Log chunk processing time
        $chunkTime = microtime(true) - $chunkStartTime;
        Log::info("Processed chunk of " . $rows->count() . " rows in " . round($chunkTime, 2) . " seconds");
    }

    public function getErrors()
    {
        return array_unique($this->errors);
    }

    public function getFailedRows()
    {
        return $this->failedRows;
    }

    public function getCellErrors()
    {
        return $this->cellErrors;
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

    /**
     * Pre-load existing data for faster validation
     */
    private function loadExistingData()
    {
        try {
            $existingUsers = User::select('nim', 'username', 'email')->get();
            $this->existingNims = $existingUsers->pluck('nim')->toArray();
            $this->existingUsernames = $existingUsers->pluck('username')->toArray();
            $this->existingEmails = $existingUsers->pluck('email')->filter()->toArray();
        } catch (\Exception $e) {
            Log::error("Error loading existing data: " . $e->getMessage());
        }
    }

    /**
     * Batch update semester for new users
     */
    private function updateSemesterForNewUsers(array $validUsers)
    {
        try {
            // Get all NIMs from the batch
            $nims = array_column($validUsers, 'nim');

            // Get all users in one query
            $users = User::whereIn('nim', $nims)->get();

            // Update semester for each user
            foreach ($users as $user) {
                $this->semesterService->updateNewStudentSemester($user);
            }
        } catch (\Exception $e) {
            Log::error("Error updating semester for new users: " . $e->getMessage());
        }
    }
}
