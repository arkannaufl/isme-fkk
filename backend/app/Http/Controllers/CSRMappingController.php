<?php

namespace App\Http\Controllers;

use App\Models\CSRMapping;
use App\Models\CSR;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

class CSRMappingController extends Controller
{
    // List dosen yang sudah di-mapping ke CSR tertentu
    public function index($csrId)
    {
        $mappings = CSRMapping::with('dosen')
            ->where('csr_id', $csrId)
            ->get();
        // Return keahlian as well
        $data = $mappings->map(function($m) {
            if ($m->dosen) {
                // Ensure csr_assignment_count is loaded
                $m->dosen->csr_assignment_count = $m->dosen->csr_assignment_count ?? 0;
            }
            return [
                'id' => $m->id,
                'csr_id' => $m->csr_id,
                'dosen' => $m->dosen,
                'keahlian' => $m->keahlian,
            ];
        });
        return response()->json(['data' => $data]);
    }

    // Mapping dosen ke CSR (anti duplikat)
    public function store(Request $request, $csrId)
    {
        $request->validate([
            'dosen_id' => 'required|exists:users,id',
            'keahlian' => 'required|string',
        ]);
        // Cek duplikat untuk keahlian yang sama
        $exists = CSRMapping::where('csr_id', $csrId)
            ->where('dosen_id', $request->dosen_id)
            ->where('keahlian', $request->keahlian)
            ->exists();
        if ($exists) {
            return response()->json(['message' => 'Dosen sudah di-mapping ke keahlian ini'], 422);
        }
        $mapping = CSRMapping::create([
            'csr_id' => $csrId,
            'dosen_id' => $request->dosen_id,
            'keahlian' => $request->keahlian,
        ]);
        // Increment count
        $user = \App\Models\User::find($request->dosen_id);
        if ($user) $user->increment('csr_assignment_count');
        return response()->json(['data' => $mapping], 201);
    }

    // Unmapping dosen dari CSR
    public function destroy($csrId, $dosenId, $keahlian)
    {
        $mapping = CSRMapping::where('csr_id', $csrId)
            ->where('dosen_id', $dosenId)
            ->where('keahlian', $keahlian)
            ->first();
        if (!$mapping) {
            return response()->json(['message' => 'Mapping tidak ditemukan'], 404);
        }
        $mapping->delete();
        // Decrement count
        $user = \App\Models\User::find($dosenId);
        if ($user && $user->csr_assignment_count > 0) $user->decrement('csr_assignment_count');
        return response()->json(['message' => 'Mapping dihapus']);
    }
} 