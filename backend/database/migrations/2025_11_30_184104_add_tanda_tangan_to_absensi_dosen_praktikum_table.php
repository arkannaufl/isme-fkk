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
        Schema::table('absensi_dosen_praktikum', function (Blueprint $table) {
            $table->text('tanda_tangan')->nullable()->after('catatan');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('absensi_dosen_praktikum', function (Blueprint $table) {
            $table->dropColumn('tanda_tangan');
        });
    }
};
