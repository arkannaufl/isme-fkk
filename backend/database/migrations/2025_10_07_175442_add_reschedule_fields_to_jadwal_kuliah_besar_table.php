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
            $table->enum('status_reschedule', ['waiting', 'approved', 'rejected'])->nullable()->after('alasan_konfirmasi');
            $table->text('reschedule_reason')->nullable()->after('status_reschedule');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_kuliah_besar', function (Blueprint $table) {
            $table->dropColumn(['status_reschedule', 'reschedule_reason']);
        });
    }
};
