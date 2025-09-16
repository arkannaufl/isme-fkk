<?php

namespace App\Imports;

use App\Models\Ruangan;
use Illuminate\Support\Collection;
use Maatwebsite\Excel\Concerns\ToCollection;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

class RuanganImport implements ToCollection, WithHeadingRow
{
    private $errors = [];
    private $failedRows = [];
    private $cellErrors = [];
    private $seenIdRuanganInFile = [];

    /**
     * @param Collection $rows
     */
    public function collection(Collection $rows)
    {
        foreach ($rows as $index => $row) {
            $originalRowArray = $row->toArray();
            $rowArray = $originalRowArray;

            $currentRowErrors = [];

            // Basic validation for required fields and data types
            $basicValidator = Validator::make($rowArray, [
                'id_ruangan' => 'required|string',
                'nama' => 'required|string',
                'kapasitas' => 'required|integer|min:1',
                'gedung' => 'required|string',
                'keterangan' => 'nullable|string',
            ], [
                'id_ruangan.required' => 'ID Ruangan harus diisi',
                'nama.required' => 'Nama Ruangan harus diisi',
                'kapasitas.required' => 'Kapasitas harus diisi',
                'kapasitas.integer' => 'Kapasitas harus berupa angka',
                'kapasitas.min' => 'Kapasitas harus lebih dari 0',
                'gedung.required' => 'Gedung harus diisi',
            ]);

            if ($basicValidator->fails()) {
                foreach ($basicValidator->errors()->messages() as $field => $messages) {
                    foreach ($messages as $message) {
                        $currentRowErrors[] = [
                            'type' => 'basic_validation',
                            'field' => $field,
                            'message' => $message,
                            'id_ruangan' => $rowArray['id_ruangan'] ?? null,
                        ];
                    }
                }
            }

            // Check for duplicates within the current import file
            if (isset($rowArray['id_ruangan']) && trim($rowArray['id_ruangan']) !== '') {
                if (in_array(trim($rowArray['id_ruangan']), $this->seenIdRuanganInFile)) {
                    $currentRowErrors[] = [
                        'type' => 'duplicate_in_file',
                        'field' => 'id_ruangan',
                        'message' => "ID Ruangan '{$rowArray['id_ruangan']}' duplikat dalam file Excel ini (Baris ".($index+2).')',
                        'id_ruangan' => $rowArray['id_ruangan'] ?? null,
                    ];
                } else {
                    $this->seenIdRuanganInFile[] = trim($rowArray['id_ruangan']);
                }
            }

            // Check for duplicates in the database
            $dbValidator = Validator::make($rowArray, [
                'id_ruangan' => [
                    Rule::unique('ruangan', 'id_ruangan')->ignore($originalRowArray['id'] ?? null, 'id'),
                ],
            ], [
                'id_ruangan.unique' => 'ID Ruangan sudah terdaftar di database (Baris '.($index+2).')',
            ]);

            if ($dbValidator->fails()) {
                foreach ($dbValidator->errors()->messages() as $field => $messages) {
                    foreach ($messages as $message) {
                        $currentRowErrors[] = [
                            'type' => 'duplicate_in_db',
                            'field' => $field,
                            'message' => $message,
                            'id_ruangan' => $rowArray['id_ruangan'] ?? null,
                        ];
                    }
                }
            }

            // If there are any errors for the current row, record them and skip saving
            if (!empty($currentRowErrors)) {
                foreach ($currentRowErrors as $error) {
                    $this->errors[] = $error['message'];
                    $this->cellErrors[] = [
                        'row' => $index, // 0-indexed for frontend preview
                        'field' => $error['field'],
                        'message' => $error['message'],
                        'id_ruangan' => $error['id_ruangan'],
                    ];
                }
                $this->failedRows[] = $originalRowArray;
                continue; // Skip to next row if current row has errors
            }

            // If no errors, create or update the record
            Ruangan::updateOrCreate(
                ['id_ruangan' => $rowArray['id_ruangan']],
                [
                    'nama' => $rowArray['nama'],
                    'kapasitas' => $rowArray['kapasitas'],
                    'gedung' => $rowArray['gedung'],
                    'keterangan' => $rowArray['keterangan'] ?? null,
                ]
            );
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