<?php

namespace App\Imports;

use App\Models\User;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class DosenImport implements ToCollection, WithHeadingRow
{
    private $errors = [];
    private $failedRows = [];
    private $cellErrors = [];
    private $seenNidsInFile = []; // Untuk cek duplikat NID di dalam file Excel
    private $seenNidnsInFile = []; // Untuk cek duplikat NIDN di dalam file Excel
    private $seenUsernamesInFile = []; // Untuk cek duplikat Username di dalam file Excel
    private $seenEmailsInFile = []; // Untuk cek duplikat Email di dalam file Excel

    public function collection(Collection $rows)
    {
        foreach ($rows as $index => $row) {
            $originalRowArray = $row->toArray();
            $rowArray = $originalRowArray; // Salin untuk digunakan dalam validasi

            // Mapping kolom agar sesuai field database (ini penting untuk validasi Laravel)
            $rowArray['name'] = $originalRowArray['nama'] ?? null;
            $rowArray['telp'] = $originalRowArray['telepon'] ?? null;
            $rowArray['kompetensi'] = $originalRowArray['kompetensi'] ?? null;
            $rowArray['keahlian'] = $originalRowArray['keahlian'] ?? null;

            $currentRowErrors = [];

            // Check if dosen is standby based on keahlian
            $keahlianString = strtolower(trim($rowArray['keahlian'] ?? ''));
            $isStandby = strpos($keahlianString, 'standby') !== false;

            // 1. Validasi keberadaan field wajib dan isinya tidak kosong (basic validation)
            // Allow "-" for NID, NIDN, and NUPTK fields
            $validationRules = [
                'nid' => 'required', // Still required but can be "-"
                'nidn' => 'required', // Still required but can be "-"
                'nuptk' => 'required', // Still required but can be "-"
                'name' => 'required',
                'username' => 'required',
                'email' => 'required|email',
                'telp' => 'required',
                'password' => 'required|min:6',
                'keahlian' => 'required',
            ];

            $validationMessages = [
                'nid.required' => 'NID harus diisi (Baris '.($index+2).')',
                'nidn.required' => 'NIDN harus diisi (Baris '.($index+2).')',
                'nuptk.required' => 'NUPTK harus diisi (Baris '.($index+2).')',
                'name.required' => 'Nama harus diisi (Baris '.($index+2).')',
                'username.required' => 'Username harus diisi (Baris '.($index+2).')',
                'email.required' => 'Email harus diisi (Baris '.($index+2).')',
                'email.email' => 'Email tidak valid (Baris '.($index+2).')',
                'telp.required' => 'Nomor telepon harus diisi (Baris '.($index+2).')',
                'password.required' => 'Password harus diisi (Baris '.($index+2).')',
                'password.min' => 'Password minimal 6 karakter (Baris '.($index+2).')',
                'keahlian.required' => 'Keahlian harus diisi (Baris '.($index+2).')',
            ];

            // Add kompetensi validation based on standby status
            if ($isStandby) {
                // Validate keahlian for standby dosen - must be ONLY "standby"
                $keahlianArray = array_map('trim', explode(',', $keahlianString));
                $hasOnlyStandby = count($keahlianArray) === 1 && $keahlianArray[0] === 'standby';

                if (!$hasOnlyStandby) {
                    $currentRowErrors[] = [
                        'type' => 'standby_keahlian_error',
                        'field' => 'keahlian',
                        'message' => 'Dosen standby hanya boleh memiliki keahlian "standby" saja, tidak boleh ada keahlian lain (Baris '.($index+2).')',
                        'nid' => $rowArray['nid'] ?? null,
                    ];
                }

                // If keahlian contains "standby", kompetensi should be empty
                if (!empty($rowArray['kompetensi'])) {
                    $currentRowErrors[] = [
                        'type' => 'standby_kompetensi_error',
                        'field' => 'kompetensi',
                        'message' => 'Jika keahlian mengandung "standby", kompetensi harus kosong (Baris '.($index+2).')',
                        'nid' => $rowArray['nid'] ?? null,
                    ];
                }
            } else {
                // If keahlian does not contain "standby", kompetensi is required
                $validationRules['kompetensi'] = 'required';
                $validationMessages['kompetensi.required'] = 'Kompetensi harus diisi jika keahlian tidak mengandung "standby" (Baris '.($index+2).')';
            }

            $basicValidator = Validator::make($rowArray, $validationRules, $validationMessages);

            if ($basicValidator->fails()) {
                foreach ($basicValidator->errors()->messages() as $field => $messages) {
                    foreach ($messages as $message) {
                        $excelFieldName = $field;
                        if ($field === 'name') $excelFieldName = 'nama';
                        if ($field === 'telp') $excelFieldName = 'telepon';
                        if ($field === 'peran_kurikulum') $excelFieldName = 'peran_dalam_kurikulum';

                        $currentRowErrors[] = [
                            'type' => 'required_or_min',
                            'field' => $excelFieldName,
                            'message' => $message,
                            'nid' => $rowArray['nid'] ?? null,
                        ];
                    }
                }
            }

            // 2. Validasi format NID, NIDN, NUPTK
            // NID dan NIDN wajib diisi dengan angka atau "-"
            if (isset($rowArray['nid']) && $rowArray['nid'] !== '-' && !is_numeric($rowArray['nid'])) {
                $currentRowErrors[] = [
                    'type' => 'format_error',
                    'field' => 'nid',
                    'message' => 'NID harus diisi dengan angka atau "-" (Baris '.($index+2).')',
                    'nid' => $rowArray['nid'] ?? null,
                ];
            }
            if (isset($rowArray['nidn']) && $rowArray['nidn'] !== '-' && !is_numeric($rowArray['nidn'])) {
                $currentRowErrors[] = [
                    'type' => 'format_error',
                    'field' => 'nidn',
                    'message' => 'NIDN harus diisi dengan angka atau "-" (Baris '.($index+2).')',
                    'nid' => $rowArray['nid'] ?? null,
                ];
            }
            // NUPTK wajib diisi dengan angka atau "-"
            if (isset($rowArray['nuptk']) && $rowArray['nuptk'] !== '-' && !is_numeric($rowArray['nuptk'])) {
                $currentRowErrors[] = [
                    'type' => 'format_error',
                    'field' => 'nuptk',
                    'message' => 'NUPTK harus diisi dengan angka atau "-" (Baris '.($index+2).')',
                    'nid' => $rowArray['nid'] ?? null,
                ];
            }

            // 3. Validasi duplikat dalam file Excel ini
            // Pastikan NID tidak kosong dan bukan "-" sebelum cek duplikat
            if (isset($rowArray['nid']) && trim($rowArray['nid']) !== '' && trim($rowArray['nid']) !== '-') {
                if (in_array(trim($rowArray['nid']), $this->seenNidsInFile)) {
                    $currentRowErrors[] = [
                        'type' => 'duplicate_in_file',
                        'field' => 'nid',
                        'message' => "NID '{$rowArray['nid']}' sudah terdaftar dalam file ini (Baris ".($index+2).')',
                        'nid' => $rowArray['nid'] ?? null,
                    ];
                } else {
                    $this->seenNidsInFile[] = trim($rowArray['nid']);
                }
            }
            if (isset($rowArray['nidn']) && trim($rowArray['nidn']) !== '' && trim($rowArray['nidn']) !== '-') {
                if (in_array(trim($rowArray['nidn']), $this->seenNidnsInFile)) {
                    $currentRowErrors[] = [
                        'type' => 'duplicate_in_file',
                        'field' => 'nidn',
                        'message' => "NIDN '{$rowArray['nidn']}' sudah terdaftar dalam file ini (Baris ".($index+2).')',
                        'nid' => $rowArray['nid'] ?? null,
                    ];
                } else {
                    $this->seenNidnsInFile[] = trim($rowArray['nidn']);
                }
            }
            if (isset($rowArray['username']) && trim($rowArray['username']) !== '') {
                if (in_array(trim($rowArray['username']), $this->seenUsernamesInFile)) {
                    $currentRowErrors[] = [
                        'type' => 'duplicate_in_file',
                        'field' => 'username',
                        'message' => "Username '{$rowArray['username']}' sudah terdaftar dalam file ini (Baris ".($index+2).')',
                        'nid' => $rowArray['nid'] ?? null,
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
                        'nid' => $rowArray['nid'] ?? null,
                    ];
                } else {
                    $this->seenEmailsInFile[] = trim($rowArray['email']);
                }
            }


            // 4. Validasi duplikat terhadap database yang sudah ada
            // Gunakan Laravel Validator untuk unique di database
            // Skip unique validation for NID and NIDN if they are "-"
            $dbValidationRules = [
                'username' => [Rule::unique('users', 'username')->ignore($originalRowArray['id'] ?? null, 'id')],
                'email' => ['nullable', Rule::unique('users', 'email')->ignore($originalRowArray['id'] ?? null, 'id')], // Email bisa null tapi kalau ada harus unique dan valid
            ];

            // Only add NID and NIDN unique validation if they are not "-"
            if (isset($rowArray['nid']) && trim($rowArray['nid']) !== '' && trim($rowArray['nid']) !== '-') {
                $dbValidationRules['nid'] = [Rule::unique('users', 'nid')->ignore($originalRowArray['id'] ?? null, 'id')];
            }
            if (isset($rowArray['nidn']) && trim($rowArray['nidn']) !== '' && trim($rowArray['nidn']) !== '-') {
                $dbValidationRules['nidn'] = [Rule::unique('users', 'nidn')->ignore($originalRowArray['id'] ?? null, 'id')];
            }

            $dbValidator = Validator::make($rowArray, $dbValidationRules, [
                'nid.unique' => 'NID sudah terdaftar di database (Baris '.($index+2).')',
                'nidn.unique' => 'NIDN sudah terdaftar di database (Baris '.($index+2).')',
                'username.unique' => 'Username sudah terdaftar di database (Baris '.($index+2).')',
                'email.unique' => 'Email sudah terdaftar di database (Baris '.($index+2).')',
                'email.email' => 'Email tidak valid (Baris '.($index+2).')',
            ]);

            if ($dbValidator->fails()) {
                foreach ($dbValidator->errors()->messages() as $field => $messages) {
                    foreach ($messages as $message) {
                        $excelFieldName = $field;
                        if ($field === 'name') $excelFieldName = 'nama';
                        if ($field === 'telp') $excelFieldName = 'telepon';
                        if ($field === 'peran_kurikulum') $excelFieldName = 'peran_dalam_kurikulum';

                        $currentRowErrors[] = [
                            'type' => 'duplicate_in_db',
                            'field' => $excelFieldName,
                            'message' => $message,
                            'nid' => $rowArray['nid'] ?? null,
                        ];
                    }
                }
            }

            // Jika ada error pada baris ini, tambahkan ke daftar error global dan skip baris
            if (!empty($currentRowErrors)) {
                foreach ($currentRowErrors as $error) {
                    $this->errors[] = $error['message'];
                    $this->cellErrors[] = [
                        'row' => $index,
                        'field' => $error['field'],
                        'message' => $error['message'],
                        'nid' => $error['nid'],
                    ];
                }
                $this->failedRows[] = $originalRowArray;
                continue; // Lanjut ke baris berikutnya di Excel
            }

            // Simpan data jika semua validasi berhasil
            // Convert "-" to null for NID, NIDN, and NUPTK fields
            $userData = [
                'nid' => ($rowArray['nid'] === '-' || $rowArray['nid'] === '') ? null : $rowArray['nid'],
                'nidn' => ($rowArray['nidn'] === '-' || $rowArray['nidn'] === '') ? null : $rowArray['nidn'],
                'nuptk' => ($rowArray['nuptk'] === '-' || $rowArray['nuptk'] === '') ? null : $rowArray['nuptk'],
                'name' => $rowArray['name'],
                'username' => $rowArray['username'],
                'email' => $rowArray['email'],
                'telp' => $rowArray['telp'],
                'password' => Hash::make($rowArray['password']),
                'role' => 'dosen',
                'keahlian' => is_array($rowArray['keahlian']) ? $rowArray['keahlian'] : explode(',', $rowArray['keahlian']),
            ];

            // Add kompetensi only if not standby
            if (!$isStandby && !empty($rowArray['kompetensi'])) {
                $userData['kompetensi'] = is_array($rowArray['kompetensi']) ? $rowArray['kompetensi'] : explode(',', $rowArray['kompetensi']);
            }

            // Set peran_utama based on standby status
            if ($isStandby) {
                $userData['peran_utama'] = 'standby';
            }

            User::create($userData);
        }
    }

    public function getErrors()
    {
        return array_unique($this->errors); // Pastikan error unik
    }

    public function getFailedRows()
    {
        return $this->failedRows;
    }

    public function getCellErrors()
    {
        return $this->cellErrors;
    }
}
