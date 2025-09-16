<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\CSR;
use App\Models\MataKuliah;
use Illuminate\Http\Response;

class MataKuliahCSRController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index($kode)
    {
        $csrs = CSR::where('mata_kuliah_kode', $kode)->get();
        return response()->json($csrs);
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request, $kode)
    {
        $validated = $request->validate([
            'nomor_csr' => 'required|string',
            'keahlian_required' => 'nullable|array',
            'keahlian_required.*' => 'string',
            'tanggal_mulai' => 'nullable|date',
            'tanggal_akhir' => 'nullable|date',
        ]);
        $validated['mata_kuliah_kode'] = $kode;
        $csr = CSR::create($validated);
        
        return response()->json($csr, Response::HTTP_CREATED);
    }

    /**
     * Display the specified resource.
     */
    public function show($kode, $id)
    {
        $csr = CSR::where('mata_kuliah_kode', $kode)->findOrFail($id);
        return response()->json($csr);
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, $id)
    {
        $csr = CSR::findOrFail($id);
        $validated = $request->validate([
            'nomor_csr' => 'sometimes|required|string',
            'keahlian' => 'nullable|string',
            'tanggal_mulai' => 'nullable|date',
            'tanggal_akhir' => 'nullable|date',
        ]);
        
        $csr->update($validated);
        
        return response()->json($csr);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $csr = CSR::findOrFail($id);
        $csr->delete();
        
        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
