<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Add alasan_asli column to tables that don't have it yet
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            $table->text('status_konfirmasi')->nullable()->after('penilaian_submitted_at');
            $table->text('alasan_konfirmasi')->nullable()->after('status_konfirmasi');
            $table->text('alasan_asli')->nullable()->after('alasan_konfirmasi');
        });

        Schema::table('jadwal_jurnal_reading', function (Blueprint $table) {
            $table->text('alasan_asli')->nullable()->after('alasan_konfirmasi');
        });

        Schema::table('jadwal_csr', function (Blueprint $table) {
            $table->text('alasan_asli')->nullable()->after('alasan_konfirmasi');
        });

        Schema::table('jadwal_non_blok_non_csr', function (Blueprint $table) {
            $table->text('alasan_asli')->nullable()->after('alasan_konfirmasi');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            $table->dropColumn(['alasan_asli', 'alasan_konfirmasi', 'status_konfirmasi']);
        });

        Schema::table('jadwal_jurnal_reading', function (Blueprint $table) {
            $table->dropColumn('alasan_asli');
        });

        Schema::table('jadwal_csr', function (Blueprint $table) {
            $table->dropColumn('alasan_asli');
        });

        Schema::table('jadwal_non_blok_non_csr', function (Blueprint $table) {
            $table->dropColumn('alasan_asli');
        });
    }
};
