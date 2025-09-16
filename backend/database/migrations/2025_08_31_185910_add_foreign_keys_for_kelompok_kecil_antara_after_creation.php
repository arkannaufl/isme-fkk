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
        Schema::table('jadwal_pbl', function (Blueprint $table) {
            $table->foreign('kelompok_kecil_antara_id')->references('id')->on('kelompok_kecil_antara')->onDelete('cascade');
        });

        Schema::table('jadwal_jurnal_reading', function (Blueprint $table) {
            $table->foreign('kelompok_kecil_antara_id')->references('id')->on('kelompok_kecil_antara')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_pbl', function (Blueprint $table) {
            $table->dropForeign(['kelompok_kecil_antara_id']);
        });

        Schema::table('jadwal_jurnal_reading', function (Blueprint $table) {
            $table->dropForeign(['kelompok_kecil_antara_id']);
        });
    }
};
