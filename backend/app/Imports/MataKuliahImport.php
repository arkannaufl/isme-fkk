<?php

namespace App\Imports;

use App\Models\MataKuliah;
use Illuminate\Validation\Rule;
use Maatwebsite\Excel\Row;
use Maatwebsite\Excel\Concerns\OnEachRow;
use Maatwebsite\Excel\Concerns\WithHeadingRow;
use Illuminate\Support\Facades\Validator;

class MataKuliahImport implements OnEachRow, WithHeadingRow
{
    protected $errors = [];
    protected $failedRows = [];
    protected $cellErrors = [];
    protected $kodeSetInFile = [];
    protected $importedCount = 0;
    protected static $nonBlokPerSemester = [];
    protected static $blokPerSemester = [];
    protected static $blokTanggalPerSemester = [];

    public function __construct()
    {
        // Reset static variables
        self::$nonBlokPerSemester = [];
        self::$blokPerSemester = [];
        self::$blokTanggalPerSemester = [];
        $this->importedCount = 0;
    }

    public function onRow(Row $row)
    {
        $rowIndex = $row->getIndex();
        $rowData = $row->toArray();
        $rowNum = $rowIndex + 1;
        $rowKode = isset($rowData['kode']) ? (string)$rowData['kode'] : '';

        // Validasi header
        $requiredHeaders = ['kode', 'nama', 'semester', 'periode', 'jenis', 'kurikulum', 'tanggal_mulai', 'tanggal_akhir', 'blok', 'durasi_minggu'];
        $headers = array_map('strtolower', array_keys($rowData));
        $missingHeaders = array_diff($requiredHeaders, $headers);
        if (!empty($missingHeaders)) {
            $this->errors[] = 'Kolom yang diperlukan tidak ditemukan: ' . implode(', ', $missingHeaders);
            return;
        }

        // --- Validasi custom blok/non blok/tanggal ---
        $jenis = $rowData['jenis'] ?? null;
        $semester = $rowData['semester'] ?? null;
        $tanggalMulai = $rowData['tanggal_mulai'] ?? null;
        $tanggalAkhir = $rowData['tanggal_akhir'] ?? null;

        // Hitung total dari database sekali di awal
        static $dbCounts = null;
        if ($dbCounts === null) {
            $dbCounts = [];
            $dbData = MataKuliah::selectRaw('semester, jenis, COUNT(*) as count')
                ->groupBy('semester', 'jenis')
                ->get();
            foreach ($dbData as $data) {
                $dbCounts[$data->semester][$data->jenis] = $data->count;
            }
        }

        // 1. Non Blok hanya 1 per semester (cek di file dan DB)
        if ($jenis === 'Non Blok') {
            self::$nonBlokPerSemester[$semester] = (self::$nonBlokPerSemester[$semester] ?? 0) + 1;
            $dbNonBlok = $dbCounts[$semester]['Non Blok'] ?? 0;
            if (self::$nonBlokPerSemester[$semester] + $dbNonBlok > 1) {
                $msg = "Mata kuliah Non Blok per semester hanya boleh 1.";
                $this->errors[] = $msg . " (Baris $rowNum)";
                $this->cellErrors[] = [
                    'row' => $rowIndex - 1,
                    'field' => 'jenis',
                    'message' => $msg,
                    'kode' => $rowKode,
                ];
                $this->failedRows[] = $rowData;
                return;
            }
        }

        // 2. Blok maksimal 4 per semester (cek di file dan DB)
        if ($jenis === 'Blok') {
            self::$blokPerSemester[$semester] = (self::$blokPerSemester[$semester] ?? 0) + 1;
            $dbBlok = $dbCounts[$semester]['Blok'] ?? 0;
            if (self::$blokPerSemester[$semester] + $dbBlok > 4) {
                $msg = "Mata kuliah Blok per semester maksimal 4.";
                $this->errors[] = $msg . " (Baris $rowNum)";
                $this->cellErrors[] = [
                    'row' => $rowIndex - 1,
                    'field' => 'blok',
                    'message' => $msg,
                    'kode' => $rowKode,
                ];
                $this->failedRows[] = $rowData;
                return;
            }

            // 3. Tanggal blok tidak boleh overlap
            if (!isset(self::$blokTanggalPerSemester[$semester])) {
                self::$blokTanggalPerSemester[$semester] = [];
                // Ambil data tanggal dari DB sekali
                $dbBlokList = MataKuliah::where('semester', $semester)
                    ->where('jenis', 'Blok')
                    ->get(['tanggal_mulai', 'tanggal_akhir', 'kode']);
                foreach ($dbBlokList as $dbBlok) {
                    self::$blokTanggalPerSemester[$semester][] = [
                        'mulai' => $dbBlok->tanggal_mulai,
                        'akhir' => $dbBlok->tanggal_akhir,
                        'kode' => $dbBlok->kode
                    ];
                }
            }

            // Cek overlap dengan data yang sudah ada (file + DB)
            foreach (self::$blokTanggalPerSemester[$semester] as $blok) {
                if ($this->isDateOverlap($tanggalMulai, $tanggalAkhir, $blok['mulai'], $blok['akhir'])) {
                    $msg = isset($blok['kode']) 
                        ? "Tanggal Blok bentrok dengan data di database (" . $blok['kode'] . ")"
                        : "Tanggal Blok bentrok dengan baris " . $blok['rowNum'];
                    $this->errors[] = $msg . " (Baris $rowNum)";
                    $this->cellErrors[] = [
                        'row' => $rowIndex - 1,
                        'field' => 'tanggal_mulai',
                        'message' => $msg,
                        'kode' => $rowKode,
                    ];
                    $this->failedRows[] = $rowData;
                    return;
                }
            }

            // Tambahkan ke list untuk pengecekan berikutnya
            self::$blokTanggalPerSemester[$semester][] = [
                'mulai' => $tanggalMulai,
                'akhir' => $tanggalAkhir,
                'rowNum' => $rowNum
            ];
        }

        // Validasi data per baris
        $validator = Validator::make($rowData, [
            'kode' => ['required', 'string', Rule::unique('mata_kuliah', 'kode')],
            'nama' => 'required|string',
            'semester' => 'required|integer',
            'periode' => 'required|string',
            'jenis' => ['required', Rule::in(['Blok', 'Non Blok'])],
            'kurikulum' => 'required|integer',
            'tanggal_mulai' => 'required|date',
            'tanggal_akhir' => 'required|date',
            'blok' => 'nullable|integer',
            'durasi_minggu' => 'required|integer',
        ]);

        if ($validator->fails()) {
            foreach ($validator->errors()->messages() as $field => $messages) {
                foreach ($messages as $msg) {
                    $this->errors[] = $msg . " (Baris $rowNum, Kolom " . strtoupper($field) . ")";
                    $this->cellErrors[] = [
                        'row' => $rowIndex - 1,
                        'field' => $field,
                        'message' => $msg,
                        'kode' => $rowKode,
                    ];
                }
            }
            $this->failedRows[] = $rowData;
            return;
        }

        // Duplikat kode di file
        if (in_array($rowKode, $this->kodeSetInFile)) {
            $msg = "Kode $rowKode sudah terdaftar dalam file Excel ini (Baris $rowNum)";
            $this->errors[] = $msg;
            $this->cellErrors[] = [
                'row' => $rowIndex - 1,
                'field' => 'kode',
                'message' => 'Kode sudah terdaftar dalam file ini',
                'kode' => $rowKode,
            ];
            $this->failedRows[] = $rowData;
            return;
        }
        
        $this->kodeSetInFile[] = $rowKode;

        // Jika valid, create MataKuliah
        MataKuliah::create($rowData);
        $this->importedCount++;
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
        return $this->cellErrors;
    }

    public function getImportedCount()
    {
        return $this->importedCount;
    }

    private function isDateOverlap($start1, $end1, $start2, $end2)
    {
        return !($end1 < $start2 || $end2 < $start1);
    }
} 