<?php

namespace App\Http\Controllers;

use App\Models\Ruangan;
use Illuminate\Http\Request;
use App\Imports\RuanganImport;
use Maatwebsite\Excel\Facades\Excel;
use Illuminate\Support\Facades\Auth;

class RuanganController extends Controller
{
    public function index()
    {
        return response()->json(Ruangan::all());
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'id_ruangan' => 'required|string|unique:ruangan,id_ruangan',
            'nama' => 'required|string',
            'kapasitas' => 'required|integer|min:1',
            'gedung' => 'required|string',
            'keterangan' => 'nullable|string',
        ]);

        $ruangan = Ruangan::create($validated);
        
        return response()->json($ruangan, 201);
    }

    public function show($id)
    {
        $ruangan = Ruangan::find($id);
        if (!$ruangan) {
            return response()->json(['message' => 'Ruangan tidak ditemukan'], 404);
        }
        return response()->json($ruangan);
    }

    public function update(Request $request, $id)
    {
        $ruangan = Ruangan::findOrFail($id);
        
        $validated = $request->validate([
            'id_ruangan' => 'sometimes|required|string|unique:ruangan,id_ruangan,' . $ruangan->id,
            'nama' => 'sometimes|required|string',
            'kapasitas' => 'sometimes|required|integer|min:1',
            'gedung' => 'sometimes|required|string',
            'keterangan' => 'nullable|string',
        ]);

        $ruangan->update($validated);
        
        return response()->json($ruangan);
    }

    public function destroy($id)
    {
        $ruangan = Ruangan::findOrFail($id);
        
        $ruangan->delete();
        
        return response()->json(['message' => 'Ruangan deleted']);
    }

    public function importRuangan(Request $request)
    {
        $request->validate([
            'file' => 'required|mimes:xlsx,xls',
        ]);

        $import = new RuanganImport();
        Excel::import($import, $request->file('file'));

        $errors = $import->getErrors();
        $failedRows = $import->getFailedRows();
        $cellErrors = $import->getCellErrors();

        $reader = new \PhpOffice\PhpSpreadsheet\Reader\Xlsx();
        $spreadsheet = $reader->load($request->file('file')->getPathname());
        $sheet = $spreadsheet->getActiveSheet();
        $totalRows = $sheet->getHighestDataRow() - 1; // -1 for header row

        $importedCount = $totalRows - count($failedRows);

        activity()
            ->causedBy(Auth::user())
            ->log("Mengimpor {$importedCount} data ruangan dari file: {$request->file('file')->getClientOriginalName()}");

        if ($importedCount > 0) {
            return response()->json([
                'imported_count' => $importedCount,
                'errors' => $errors,
                'failed_rows' => $failedRows,
                'cell_errors' => $cellErrors,
            ], 200);
        } else {
            return response()->json([
                'message' => 'Semua data gagal diimpor. Periksa kembali format dan isian data.',
                'errors' => $errors,
                'cell_errors' => $cellErrors,
            ], 422);
        }
    }

    /**
     * Get ruangan based on required capacity
     */
    public function getRuanganByCapacity(Request $request)
    {
        $requiredCapacity = $request->input('capacity', 0);
        
        $ruangan = Ruangan::where('kapasitas', '>=', $requiredCapacity)
                          ->orderBy('kapasitas', 'asc')
                          ->get(['id', 'nama', 'kapasitas', 'gedung']);
        
        return response()->json($ruangan);
    }

    /**
     * Get ruangan options for scheduling with capacity validation
     */
    public function getRuanganOptions(Request $request)
    {
        $requiredCapacity = $request->input('capacity', 0);
        $excludeIds = $request->input('exclude_ids', []);
        
        $query = Ruangan::where('kapasitas', '>=', $requiredCapacity);
        
        if (!empty($excludeIds)) {
            $query->whereNotIn('id', $excludeIds);
        }
        
        $ruangan = $query->orderBy('kapasitas', 'asc')
                         ->get(['id', 'nama', 'kapasitas', 'gedung'])
                         ->map(function($item) {
                             return [
                                 'value' => $item->id,
                                 'label' => "{$item->nama} (Kapasitas: {$item->kapasitas} orang) - {$item->gedung}"
                             ];
                         });
        
        return response()->json($ruangan);
    }
} 