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
            // Check if columns don't exist before adding them
            if (!Schema::hasColumn('jadwal_non_blok_non_csr', 'status_reschedule')) {
                $table->enum('status_reschedule', ['waiting', 'approved', 'rejected'])->nullable()->after('alasan_konfirmasi');
            }

            if (!Schema::hasColumn('jadwal_non_blok_non_csr', 'reschedule_reason')) {
                $table->text('reschedule_reason')->nullable()->after('status_reschedule');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_non_blok_non_csr', function (Blueprint $table) {
            $table->dropColumn(['status_reschedule', 'reschedule_reason']);
        });
    }
};
