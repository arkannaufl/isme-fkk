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
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            if (!Schema::hasColumn('jadwal_praktikum', 'qr_enabled')) {
                $table->boolean('qr_enabled')->default(false)->after('penilaian_submitted_at');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            $table->dropColumn('qr_enabled');
        });
    }
};
