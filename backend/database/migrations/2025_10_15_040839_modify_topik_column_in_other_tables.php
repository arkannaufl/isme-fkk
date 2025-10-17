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
        // Ubah kolom topik di jadwal_praktikum
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            $table->longText('topik')->nullable()->change();
        });

        // Ubah kolom topik di jadwal_jurnal_reading
        Schema::table('jadwal_jurnal_reading', function (Blueprint $table) {
            $table->longText('topik')->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Kembalikan ke VARCHAR(255) jika diperlukan
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            $table->string('topik')->nullable()->change();
        });

        Schema::table('jadwal_jurnal_reading', function (Blueprint $table) {
            $table->string('topik')->change();
        });
    }
};
