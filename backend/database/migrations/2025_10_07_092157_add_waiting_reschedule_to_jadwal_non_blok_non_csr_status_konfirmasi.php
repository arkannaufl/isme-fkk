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
        Schema::table('jadwal_non_blok_non_csr', function (Blueprint $table) {
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa', 'waiting_reschedule'])->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_non_blok_non_csr', function (Blueprint $table) {
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa'])->change();
        });
    }
};
