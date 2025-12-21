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
        Schema::table('ikd_bukti_fisik', function (Blueprint $table) {
            // Drop unique constraint untuk mendukung multiple files per user + pedoman + unit
            $table->dropUnique('ikd_bukti_fisik_user_pedoman_unit_unique');
            
            // Add status_verifikasi field
            $table->enum('status_verifikasi', ['salah', 'benar', 'perbaiki'])->nullable()->after('skor');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ikd_bukti_fisik', function (Blueprint $table) {
            // Remove status_verifikasi field
            $table->dropColumn('status_verifikasi');
            
            // Restore unique constraint
            $table->unique(['user_id', 'ikd_pedoman_id', 'unit'], 'ikd_bukti_fisik_user_pedoman_unit_unique');
        });
    }
};
