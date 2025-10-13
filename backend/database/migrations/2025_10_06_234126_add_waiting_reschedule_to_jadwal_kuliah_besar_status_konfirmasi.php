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
            // Add waiting_reschedule to status_konfirmasi ENUM
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa', 'waiting_reschedule'])
                ->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_kuliah_besar', function (Blueprint $table) {
            // Remove waiting_reschedule from status_konfirmasi ENUM
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa'])
                ->change();
        });
    }
};
