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
            // Cek apakah field sudah ada sebelum menambahkan
            if (!Schema::hasColumn('jadwal_pbl', 'alasan_konfirmasi')) {
                $table->text('alasan_konfirmasi')->nullable()->after('status_konfirmasi');
            }
            if (!Schema::hasColumn('jadwal_pbl', 'status_reschedule')) {
                $table->enum('status_reschedule', ['waiting', 'approved', 'rejected'])->nullable()->after('alasan_konfirmasi');
            }
            if (!Schema::hasColumn('jadwal_pbl', 'reschedule_reason')) {
                $table->text('reschedule_reason')->nullable()->after('status_reschedule');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_pbl', function (Blueprint $table) {
            // Hanya drop jika field ada
            if (Schema::hasColumn('jadwal_pbl', 'alasan_konfirmasi')) {
                $table->dropColumn('alasan_konfirmasi');
            }
            if (Schema::hasColumn('jadwal_pbl', 'status_reschedule')) {
                $table->dropColumn('status_reschedule');
            }
            if (Schema::hasColumn('jadwal_pbl', 'reschedule_reason')) {
                $table->dropColumn('reschedule_reason');
            }
        });
    }
};
