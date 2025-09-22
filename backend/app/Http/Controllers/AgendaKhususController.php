<?php

namespace App\Http\Controllers;

use App\Models\JadwalAgendaKhusus;
use Illuminate\Http\Request;
use Illuminate\Http\Response;

class AgendaKhususController extends Controller
{
    /**
     * Get all agenda khusus
     */
    public function index()
    {
        try {
            $agendaKhusus = JadwalAgendaKhusus::with(['mataKuliah', 'ruangan'])
                ->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();

            return response()->json([
                'message' => 'Data agenda khusus berhasil diambil',
                'data' => $agendaKhusus
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengambil data agenda khusus',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get agenda khusus by mata kuliah
     */
    public function getByMataKuliah($kode)
    {
        try {
            $agendaKhusus = JadwalAgendaKhusus::with(['mataKuliah', 'ruangan'])
                ->where('mata_kuliah_kode', $kode)
                ->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();

            return response()->json([
                'message' => 'Data agenda khusus berhasil diambil',
                'data' => $agendaKhusus
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengambil data agenda khusus',
                'error' => $e->getMessage()
            ], 500);
        }
    }

    /**
     * Get agenda khusus by date range
     */
    public function getByDateRange(Request $request)
    {
        try {
            $request->validate([
                'start_date' => 'required|date',
                'end_date' => 'required|date|after_or_equal:start_date'
            ]);

            $agendaKhusus = JadwalAgendaKhusus::with(['mataKuliah', 'ruangan'])
                ->whereBetween('tanggal', [$request->start_date, $request->end_date])
                ->orderBy('tanggal')
                ->orderBy('jam_mulai')
                ->get();

            return response()->json([
                'message' => 'Data agenda khusus berhasil diambil',
                'data' => $agendaKhusus
            ]);
        } catch (\Exception $e) {
            return response()->json([
                'message' => 'Gagal mengambil data agenda khusus',
                'error' => $e->getMessage()
            ], 500);
        }
    }
}
