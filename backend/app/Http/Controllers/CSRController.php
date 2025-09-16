<?php

namespace App\Http\Controllers;

use App\Models\CSR;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class CSRController extends Controller
{
    /**
     * Display a listing of the resource.
     */
    public function index(Request $request)
    {
        try {
            $query = CSR::with(['mataKuliah']);
            
            // Filter berdasarkan mata_kuliah_kode jika ada
            if ($request->has('mata_kuliah_kode')) {
                $query->where('mata_kuliah_kode', $request->mata_kuliah_kode);
            }
            
            $csrs = $query->get();
            
            // Debug: log jumlah data yang ditemukan
            Log::info('CSR data found: ' . $csrs->count() . ' records');
            if ($request->has('mata_kuliah_kode')) {
                Log::info('Filtered by mata_kuliah_kode: ' . $request->mata_kuliah_kode);
            }
            
            return response()->json(['data' => $csrs]);
        } catch (\Exception $e) {
            Log::error('Error fetching CSR data: ' . $e->getMessage());
            Log::error('Stack trace: ' . $e->getTraceAsString());
            return response()->json(['message' => 'Gagal memuat data CSR: ' . $e->getMessage()], 500);
        }
    }

    /**
     * Store a newly created resource in storage.
     */
    public function store(Request $request)
    {
        try {
            $request->validate([
                'mata_kuliah_kode' => 'required|string|exists:mata_kuliah,kode',
                'nomor_csr' => 'required|string|unique:csrs,nomor_csr',
                'nama' => 'required|string',
                'keahlian_required' => 'array',
                'keahlian_required.*' => 'string'
            ]);

            // Ambil tanggal dari mata kuliah blok yang sesuai
            $parts = explode('.', $request->nomor_csr);
            $semester = (int) $parts[0];
            $blok = (int) $parts[1];

            $mataKuliahBlok = \App\Models\MataKuliah::where('kode', 'MKB' . $semester . '0' . $blok)->first();

            if ($mataKuliahBlok) {
                $request->merge([
                    'tanggal_mulai' => $mataKuliahBlok->tanggal_mulai,
                    'tanggal_akhir' => $mataKuliahBlok->tanggal_akhir
                ]);
            }

            $csr = CSR::create($request->all());

            return response()->json([
                'message' => 'Mata kuliah CSR berhasil ditambahkan',
                'data' => $csr
            ], 201);
        } catch (\Exception $e) {
            Log::error('Error creating CSR: ' . $e->getMessage());
            return response()->json(['message' => 'Gagal menambahkan mata kuliah CSR'], 500);
        }
    }

    /**
     * Display the specified resource.
     */
    public function show(CSR $csr)
    {
        try {
            $csr->load('mataKuliah');
            return response()->json(['data' => $csr]);
        } catch (\Exception $e) {
            Log::error('Error fetching CSR: ' . $e->getMessage());
            return response()->json(['message' => 'Gagal memuat data CSR'], 500);
        }
    }

    /**
     * Update the specified resource in storage.
     */
    public function update(Request $request, CSR $csr)
    {
        try {
            $request->validate([
                'mata_kuliah_kode' => 'required|string|exists:mata_kuliah,kode',
                'nomor_csr' => 'required|string|unique:csrs,nomor_csr,' . $csr->id,
                'nama' => 'required|string',
                'keahlian_required' => 'array',
                'keahlian_required.*' => 'string'
            ]);

            // Validasi duplikat keahlian_required (case-insensitive, trim)
            if ($request->has('keahlian_required')) {
                $keahlianArr = array_map(function($k) { return strtolower(trim($k)); }, $request->keahlian_required);
                if (count($keahlianArr) !== count(array_unique($keahlianArr))) {
                    return response()->json([
                        'message' => 'Nama keahlian tidak boleh duplikat.'
                    ], 422);
                }
            }

            // Ambil tanggal dari mata kuliah blok yang sesuai
            $parts = explode('.', $request->nomor_csr);
            $semester = (int) $parts[0];
            $blok = (int) $parts[1];

            $mataKuliahBlok = \App\Models\MataKuliah::where('kode', 'MKB' . $semester . '0' . $blok)->first();

            if ($mataKuliahBlok) {
                $request->merge([
                    'tanggal_mulai' => $mataKuliahBlok->tanggal_mulai,
                    'tanggal_akhir' => $mataKuliahBlok->tanggal_akhir
                ]);
            }

            $csr->update($request->all());

            return response()->json([
                'message' => 'Mata kuliah CSR berhasil diupdate',
                'data' => $csr
            ]);
        } catch (\Exception $e) {
            Log::error('Error updating CSR: ' . $e->getMessage());
            return response()->json(['message' => 'Gagal mengupdate mata kuliah CSR'], 500);
        }
    }

    public function destroy(CSR $csr)
    {
        try {
            $csr->delete();

            return response()->json(['message' => 'Mata kuliah CSR berhasil dihapus']);
        } catch (\Exception $e) {
            Log::error('Error deleting CSR: ' . $e->getMessage());
            return response()->json(['message' => 'Gagal menghapus mata kuliah CSR'], 500);
        }
    }

    public function batch(Request $request)
    {
        $kodeList = $request->input('kode_mk', []);
        if (!is_array($kodeList) || empty($kodeList)) {
            return response()->json(['message' => 'kode_mk harus berupa array dan tidak boleh kosong'], 400);
        }
        $csrs = CSR::whereIn('mata_kuliah_kode', $kodeList)->get();
        return response()->json(['data' => $csrs]);
    }
}
