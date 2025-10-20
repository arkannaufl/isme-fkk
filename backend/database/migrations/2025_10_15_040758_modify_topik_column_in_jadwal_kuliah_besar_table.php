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
        Schema::table('jadwal_kuliah_besar', function (Blueprint $table) {
            // Ubah kolom topik dari VARCHAR(255) menjadi LONGTEXT untuk menampung data yang panjang
            $table->longText('topik')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_kuliah_besar', function (Blueprint $table) {
            // Kembalikan ke VARCHAR(255) jika diperlukan
            $table->string('topik')->nullable()->change();
        });
    }
};
