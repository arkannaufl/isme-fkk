<?php

namespace App\Imports;

use App\Models\User;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class TimAkademikImport implements ToCollection, WithHeadingRow
{
    private $errors = [];
    private $failedRows = [];
    private $cellErrors = [];
    private $seenNipsInFile = [];
    private $seenUsernamesInFile = [];
    private $seenEmailsInFile = [];

    public function collection(Collection $rows)
    {
        foreach ($rows as $index => $row) {
            $originalRowArray = $row->toArray();
            $rowArray = $originalRowArray;
            $rowArray['name'] = $originalRowArray['nama'] ?? null;
            $rowArray['telp'] = $originalRowArray['telepon'] ?? null;
            $rowArray['ket'] = $originalRowArray['keterangan'] ?? null;

            $currentRowErrors = [];

            $basicValidator = Validator::make($rowArray, [
                'nip' => 'required|numeric',
                'name' => 'required',
                'username' => 'required',
                'email' => 'required|email',
                'telp' => 'required',
                'ket' => 'required',
                'password' => 'required|min:6',
            ], [
                'nip.required' => 'NIP harus diisi (Baris '.($index+2).')',
                'nip.numeric' => 'NIP harus berupa angka (Baris '.($index+2).')',
                'name.required' => 'Nama harus diisi (Baris '.($index+2).')',
                'username.required' => 'Username harus diisi (Baris '.($index+2).')',
                'email.required' => 'Email harus diisi (Baris '.($index+2).')',
                'email.email' => 'Email tidak valid (Baris '.($index+2).')',
                'telp.required' => 'Nomor telepon harus diisi (Baris '.($index+2).')',
                'ket.required' => 'Keterangan harus diisi (Baris '.($index+2).')',
                'password.required' => 'Password harus diisi (Baris '.($index+2).')',
                'password.min' => 'Password minimal 6 karakter (Baris '.($index+2).')',
            ]);

            if ($basicValidator->fails()) {
                foreach ($basicValidator->errors()->messages() as $field => $messages) {
                    foreach ($messages as $message) {
                        $excelFieldName = $field;
                        if ($field === 'name') $excelFieldName = 'nama';
                        if ($field === 'telp') $excelFieldName = 'telepon';
                        if ($field === 'ket') $excelFieldName = 'keterangan';
                        $currentRowErrors[] = [
                            'type' => 'required_or_min',
                            'field' => $excelFieldName,
                            'message' => $message,
                            'nip' => $rowArray['nip'] ?? null,
                        ];
                    }
                }
            }

            if (isset($rowArray['nip']) && trim($rowArray['nip']) !== '') {
                if (in_array(trim($rowArray['nip']), $this->seenNipsInFile)) {
                    $currentRowErrors[] = [
                        'type' => 'duplicate_in_file',
                        'field' => 'nip',
                        'message' => "NIP '{$rowArray['nip']}' sudah terdaftar dalam file ini (Baris ".($index+2).')',
                        'nip' => $rowArray['nip'] ?? null,
                    ];
                } else {
                    $this->seenNipsInFile[] = trim($rowArray['nip']);
                }
            }
            if (isset($rowArray['username']) && trim($rowArray['username']) !== '') {
                if (in_array(trim($rowArray['username']), $this->seenUsernamesInFile)) {
                    $currentRowErrors[] = [
                        'type' => 'duplicate_in_file',
                        'field' => 'username',
                        'message' => "Username '{$rowArray['username']}' sudah terdaftar dalam file ini (Baris ".($index+2).')',
                        'nip' => $rowArray['nip'] ?? null,
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
                        'nip' => $rowArray['nip'] ?? null,
                    ];
                } else {
                    $this->seenEmailsInFile[] = trim($rowArray['email']);
                }
            }

            $dbValidator = Validator::make($rowArray, [
                'nip' => [Rule::unique('users', 'nip')->ignore($originalRowArray['id'] ?? null, 'id')],
                'username' => [Rule::unique('users', 'username')->ignore($originalRowArray['id'] ?? null, 'id')],
                'email' => ['nullable', Rule::unique('users', 'email')->ignore($originalRowArray['id'] ?? null, 'id')],
            ], [
                'nip.unique' => 'NIP sudah terdaftar di database (Baris '.($index+2).')',
                'username.unique' => 'Username sudah terdaftar di database (Baris '.($index+2).')',
                'email.unique' => 'Email sudah terdaftar di database (Baris '.($index+2).')',
            ]);

            if ($dbValidator->fails()) {
                foreach ($dbValidator->errors()->messages() as $field => $messages) {
                    foreach ($messages as $message) {
                        $excelFieldName = $field;
                        if ($field === 'name') $excelFieldName = 'nama';
                        if ($field === 'telp') $excelFieldName = 'telepon';
                        if ($field === 'ket') $excelFieldName = 'keterangan';
                        $currentRowErrors[] = [
                            'type' => 'duplicate_in_db',
                            'field' => $excelFieldName,
                            'message' => $message,
                            'nip' => $rowArray['nip'] ?? null,
                        ];
                    }
                }
            }

            if (!empty($currentRowErrors)) {
                foreach ($currentRowErrors as $error) {
                    $this->errors[] = $error['message'];
                    $this->cellErrors[] = [
                        'row' => $index,
                        'field' => $error['field'],
                        'message' => $error['message'],
                        'nip' => $error['nip'],
                    ];
                }
                $this->failedRows[] = $originalRowArray;
                continue;
            }

            User::create([
                'nip' => $rowArray['nip'],
                'name' => $rowArray['name'],
                'username' => $rowArray['username'],
                'email' => $rowArray['email'],
                'telp' => $rowArray['telp'],
                'ket' => $rowArray['ket'],
                'password' => Hash::make($rowArray['password']),
                'role' => 'tim_akademik',
            ]);
        }
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
} 