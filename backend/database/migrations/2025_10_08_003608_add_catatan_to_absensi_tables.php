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
        // Add catatan column to absensi_pbl table
        if (!Schema::hasColumn('absensi_pbl', 'catatan')) {
            Schema::table('absensi_pbl', function (Blueprint $table) {
                $table->text('catatan')->nullable()->after('hadir');
            });
        }

        // Add catatan column to absensi_jurnal table
        if (!Schema::hasColumn('absensi_jurnal', 'catatan')) {
            Schema::table('absensi_jurnal', function (Blueprint $table) {
                $table->text('catatan')->nullable()->after('hadir');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Remove catatan column from absensi_pbl table
        if (Schema::hasColumn('absensi_pbl', 'catatan')) {
            Schema::table('absensi_pbl', function (Blueprint $table) {
                $table->dropColumn('catatan');
            });
        }

        // Remove catatan column from absensi_jurnal table
        if (Schema::hasColumn('absensi_jurnal', 'catatan')) {
            Schema::table('absensi_jurnal', function (Blueprint $table) {
                $table->dropColumn('catatan');
            });
        }
    }
};
