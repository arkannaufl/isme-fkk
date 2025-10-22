<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\CSR;
use App\Models\MataKuliah;
use App\Models\KeahlianCSR;
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

        // Simpan keahlian CSR ke database keahlian_csr
        if (isset($validated['keahlian_required']) && is_array($validated['keahlian_required'])) {
            foreach ($validated['keahlian_required'] as $keahlian) {
                if (!empty(trim($keahlian))) {
                    KeahlianCSR::create([
                        'csr_id' => $csr->id,
                        'keahlian' => trim($keahlian)
                    ]);
                }
            }
        }

        // Log activity
        activity()
            ->performedOn($csr)
            ->withProperties([
                'mata_kuliah_kode' => $kode,
                'nomor_csr' => $csr->nomor_csr,
                'keahlian_required' => $csr->keahlian_required,
                'tanggal_mulai' => $csr->tanggal_mulai,
                'tanggal_akhir' => $csr->tanggal_akhir
            ])
            ->log("CSR created: {$csr->nomor_csr}");
        
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
            'keahlian_required' => 'nullable|array',
            'keahlian_required.*' => 'string',
            'tanggal_mulai' => 'nullable|date',
            'tanggal_akhir' => 'nullable|date',
        ]);
        
        $csr->update($validated);

        // Update keahlian CSR di database keahlian_csr
        if (isset($validated['keahlian_required'])) {
            // Hapus keahlian lama
            KeahlianCSR::where('csr_id', $csr->id)->delete();
            
            // Tambah keahlian baru
            if (is_array($validated['keahlian_required'])) {
                foreach ($validated['keahlian_required'] as $keahlian) {
                    if (!empty(trim($keahlian))) {
                        KeahlianCSR::create([
                            'csr_id' => $csr->id,
                            'keahlian' => trim($keahlian)
                        ]);
                    }
                }
            }
        }

        // Log activity
        activity()
            ->performedOn($csr)
            ->withProperties([
                'mata_kuliah_kode' => $csr->mata_kuliah_kode,
                'nomor_csr' => $csr->nomor_csr,
                'keahlian_required' => $csr->keahlian_required,
                'tanggal_mulai' => $csr->tanggal_mulai,
                'tanggal_akhir' => $csr->tanggal_akhir
            ])
            ->log("CSR updated: {$csr->nomor_csr}");
        
        return response()->json($csr);
    }

    /**
     * Remove the specified resource from storage.
     */
    public function destroy($id)
    {
        $csr = CSR::findOrFail($id);

        // Hapus keahlian CSR terlebih dahulu
        KeahlianCSR::where('csr_id', $csr->id)->delete();

        // Log activity before deletion
        activity()
            ->performedOn($csr)
            ->withProperties([
                'mata_kuliah_kode' => $csr->mata_kuliah_kode,
                'nomor_csr' => $csr->nomor_csr,
                'keahlian_required' => $csr->keahlian_required,
                'tanggal_mulai' => $csr->tanggal_mulai,
                'tanggal_akhir' => $csr->tanggal_akhir
            ])
            ->log("CSR deleted: {$csr->nomor_csr}");

        $csr->delete();
        
        return response()->json(null, Response::HTTP_NO_CONTENT);
    }
}
