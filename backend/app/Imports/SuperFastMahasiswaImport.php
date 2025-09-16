<?php

namespace App\Imports;

use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SuperFastMahasiswaImport implements ToCollection, WithHeadingRow
{
    private $totalProcessed = 0;
    private $totalFailed = 0;
    private $errors = [];
    private $failedRows = [];

    // Disable chunk reading for maximum speed
    public function chunkSize(): int
    {
        return 10000; // Process all data at once
    }

    public function collection(Collection $rows)
    {
        $startTime = microtime(true);
        $validUsers = [];

        foreach ($rows as $index => $row) {
            $this->totalProcessed++;

            try {
                // Minimal processing - only essential fields
                $userData = [
                    'nim' => $row['nim'] ?? null,
                    'name' => $row['nama'] ?? null,
                    'username' => $row['username'] ?? null,
                    'email' => $row['email'] ?? null,
                    'telp' => $row['telepon'] ?? '0000000000',
                    'password' => bcrypt('password123'), // Default password
                    'gender' => $row['gender'] ?? 'Laki-laki',
                    'ipk' => $row['ipk'] ?? 0,
                    'status' => $row['status'] ?? 'aktif',
                    'angkatan' => $row['angkatan'] ?? date('Y'),
                    'role' => 'mahasiswa',
                    'semester' => $row['semester'] ?? 1,
                    'created_at' => now(),
                    'updated_at' => now(),
                ];

                // Only check if essential fields exist
                if (empty($userData['nim']) || empty($userData['name']) || empty($userData['username']) || empty($userData['email'])) {
                    $this->totalFailed++;
                    $this->failedRows[] = $row->toArray();
                    continue;
                }

                $validUsers[] = $userData;

            } catch (\Exception $e) {
                $this->totalFailed++;
                $this->failedRows[] = $row->toArray();
                $this->errors[] = "Error processing row " . ($index + 2) . ": " . $e->getMessage();
            }
        }

        // SUPER FAST batch insert with raw SQL
        if (!empty($validUsers)) {
            try {
                // Use raw SQL for maximum speed
                $this->batchInsertUsers($validUsers);
            } catch (\Exception $e) {
                Log::error("Error in batch insert: " . $e->getMessage());
                $this->errors[] = "Database error: " . $e->getMessage();
            }
        }

        $endTime = microtime(true);
        $processingTime = round($endTime - $startTime, 2);
        Log::info("SUPER FAST: Processed " . $rows->count() . " rows in " . $processingTime . " seconds");
    }

    /**
     * Ultra fast batch insert using raw SQL
     */
    private function batchInsertUsers(array $users)
    {
        if (empty($users)) return;

        // Build raw SQL for maximum speed
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
        return []; // No cell errors in super fast mode
    }
}
