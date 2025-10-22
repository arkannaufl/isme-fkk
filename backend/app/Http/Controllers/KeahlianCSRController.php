<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use App\Models\KeahlianCSR;
use App\Models\CSR;

class KeahlianCSRController extends Controller
{
    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        $request->validate([
            'csr_id' => 'required|exists:csrs,id',
            'keahlian' => 'required|string|max:255',
        ]);

        $keahlianCSR = KeahlianCSR::create([
            'csr_id' => $request->csr_id,
            'keahlian' => $request->keahlian,
        ]);

        return response()->json([
            'success' => true,
            'data' => $keahlianCSR,
            'message' => 'Keahlian CSR berhasil ditambahkan'
        ]);
    }

    /**
     * Get keahlian by CSR ID
     */
    public function getByCSR($csrId)
    {
        $keahlianList = KeahlianCSR::where('csr_id', $csrId)->get();
        
        return response()->json([
            'success' => true,
            'data' => $keahlianList
        ]);
    }

    /**
     * Delete all keahlian by CSR ID
     */
    public function deleteByCSR($csrId)
    {
        KeahlianCSR::where('csr_id', $csrId)->delete();
        
        return response()->json([
            'success' => true,
            'message' => 'Keahlian CSR berhasil dihapus'
        ]);
    }

    /**
     * Get keahlian by semester and blok
     */
    public function getBySemesterBlok(Request $request)
    {
        $semester = $request->semester;
        $blok = $request->blok;
        
        // Cari CSR berdasarkan semester dan blok
        $csrs = CSR::whereHas('mataKuliah', function($query) use ($semester) {
            $query->where('semester', $semester);
        })->get();
        
        $keahlianList = [];
        foreach ($csrs as $csr) {
            $keahlian = KeahlianCSR::where('csr_id', $csr->id)->get();
            $keahlianList = array_merge($keahlianList, $keahlian->pluck('keahlian')->toArray());
        }
        
        return response()->json([
            'success' => true,
            'data' => array_unique($keahlianList)
        ]);
    }
}
