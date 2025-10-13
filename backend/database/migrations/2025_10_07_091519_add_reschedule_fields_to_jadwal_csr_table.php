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
        Schema::table('jadwal_csr', function (Blueprint $table) {
            // Add reschedule fields if not exist
            if (!Schema::hasColumn('jadwal_csr', 'status_reschedule')) {
                $table->string('status_reschedule')->nullable()->after('alasan_konfirmasi');
            }
            if (!Schema::hasColumn('jadwal_csr', 'reschedule_reason')) {
                $table->string('reschedule_reason')->nullable()->after('status_reschedule');
            }
        });

        // Change enum to include waiting_reschedule
        Schema::table('jadwal_csr', function (Blueprint $table) {
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa', 'waiting_reschedule'])->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert enum change
        Schema::table('jadwal_csr', function (Blueprint $table) {
            $table->enum('status_konfirmasi', ['belum_konfirmasi', 'bisa', 'tidak_bisa'])->change();
        });

        Schema::table('jadwal_csr', function (Blueprint $table) {
            if (Schema::hasColumn('jadwal_csr', 'reschedule_reason')) {
                $table->dropColumn('reschedule_reason');
            }
            if (Schema::hasColumn('jadwal_csr', 'status_reschedule')) {
                $table->dropColumn('status_reschedule');
            }
        });
    }
};
