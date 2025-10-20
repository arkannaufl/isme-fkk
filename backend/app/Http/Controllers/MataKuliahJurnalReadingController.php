<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\JurnalReading;
use App\Models\MataKuliah;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Log;

class MataKuliahJurnalReadingController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index($kode)
    {
        $jurnalReadings = JurnalReading::where('mata_kuliah_kode', $kode)->get();
        return response()->json($jurnalReadings);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request, $kode)
    {
        $validated = $request->validate([
            'topik_ke' => 'required|string',
            'nama_topik' => 'required|string',
        ]);
        $validated['mata_kuliah_kode'] = $kode;
        $jurnalReading = JurnalReading::create($validated);

        return response()->json($jurnalReading, Response::HTTP_CREATED);
    }

    /**
     * Display the specified resource.
     */
    public function show($id)
    {
        $jurnalReading = JurnalReading::findOrFail($id);
        return response()->json($jurnalReading);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $jurnalReading = JurnalReading::findOrFail($id);
        $validated = $request->validate([
            'topik_ke' => 'sometimes|required|string',
            'nama_topik' => 'sometimes|required|string',
        ]);

        $jurnalReading->update($validated);

        return response()->json($jurnalReading);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $jurnalReading = JurnalReading::findOrFail($id);
        $jurnalReading->delete();

        return response()->json(null, Response::HTTP_NO_CONTENT);
    }

    /**
     * Get all Jurnal Reading grouped by mata_kuliah_kode for Blok courses only
     */
    public function all()
    {
        $blokCourses = MataKuliah::where('jenis', 'Blok')->get(['kode', 'nama', 'semester', 'blok', 'periode', 'keahlian_required']);
        $blokKodes = $blokCourses->pluck('kode');
        $jurnalReadings = JurnalReading::whereIn('mata_kuliah_kode', $blokKodes)->get();
        $grouped = $jurnalReadings->groupBy('mata_kuliah_kode');
        $result = [];
        foreach ($blokCourses as $mk) {
            $result[$mk->kode] = [
                'mata_kuliah' => [
                    'kode' => $mk->kode,
                    'nama' => $mk->nama,
                    'semester' => $mk->semester,
                    'blok' => $mk->blok,
                    'periode' => $mk->periode,
                    'keahlian_required' => $mk->keahlian_required,
                ],
                'jurnal_readings' => isset($grouped[$mk->kode]) ? $grouped[$mk->kode]->values()->toArray() : [],
            ];
        }
        return response()->json($result);
    }

    /**
     * Get all Jurnal Readings
     */
    public function getAllJurnalReadings()
    {
        $jurnalReadings = JurnalReading::all();
        return response()->json($jurnalReadings);
    }
}
