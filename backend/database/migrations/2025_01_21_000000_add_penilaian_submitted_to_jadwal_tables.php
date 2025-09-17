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
        // Tambah field ke jadwal_pbl
        Schema::table('jadwal_pbl', function (Blueprint $table) {
            $table->boolean('penilaian_submitted')->default(false)->after('status_konfirmasi');
            $table->unsignedBigInteger('penilaian_submitted_by')->nullable()->after('penilaian_submitted');
            $table->timestamp('penilaian_submitted_at')->nullable()->after('penilaian_submitted_by');
            
            $table->foreign('penilaian_submitted_by')->references('id')->on('users')->onDelete('set null');
        });

        // Tambah field ke jadwal_jurnal_reading
        Schema::table('jadwal_jurnal_reading', function (Blueprint $table) {
            $table->boolean('penilaian_submitted')->default(false)->after('status_konfirmasi');
            $table->unsignedBigInteger('penilaian_submitted_by')->nullable()->after('penilaian_submitted');
            $table->timestamp('penilaian_submitted_at')->nullable()->after('penilaian_submitted_by');
            
            $table->foreign('penilaian_submitted_by')->references('id')->on('users')->onDelete('set null');
        });

        // Tambah field ke jadwal_praktikum
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            $table->boolean('penilaian_submitted')->default(false)->after('jumlah_sesi');
            $table->unsignedBigInteger('penilaian_submitted_by')->nullable()->after('penilaian_submitted');
            $table->timestamp('penilaian_submitted_at')->nullable()->after('penilaian_submitted_by');
            
            $table->foreign('penilaian_submitted_by')->references('id')->on('users')->onDelete('set null');
        });

        // Tambah field ke jadwal_kuliah_besar
        Schema::table('jadwal_kuliah_besar', function (Blueprint $table) {
            $table->boolean('penilaian_submitted')->default(false)->after('status_konfirmasi');
            $table->unsignedBigInteger('penilaian_submitted_by')->nullable()->after('penilaian_submitted');
            $table->timestamp('penilaian_submitted_at')->nullable()->after('penilaian_submitted_by');
            
            $table->foreign('penilaian_submitted_by')->references('id')->on('users')->onDelete('set null');
        });

        // Tambah field ke jadwal_csr
        Schema::table('jadwal_csr', function (Blueprint $table) {
            $table->boolean('penilaian_submitted')->default(false)->after('status_konfirmasi');
            $table->unsignedBigInteger('penilaian_submitted_by')->nullable()->after('penilaian_submitted');
            $table->timestamp('penilaian_submitted_at')->nullable()->after('penilaian_submitted_by');
            
            $table->foreign('penilaian_submitted_by')->references('id')->on('users')->onDelete('set null');
        });

        // Tambah field ke jadwal_non_blok_non_csr
        Schema::table('jadwal_non_blok_non_csr', function (Blueprint $table) {
            $table->boolean('penilaian_submitted')->default(false)->after('status_konfirmasi');
            $table->unsignedBigInteger('penilaian_submitted_by')->nullable()->after('penilaian_submitted');
            $table->timestamp('penilaian_submitted_at')->nullable()->after('penilaian_submitted_by');
            
            $table->foreign('penilaian_submitted_by')->references('id')->on('users')->onDelete('set null');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Drop field dari jadwal_pbl
        Schema::table('jadwal_pbl', function (Blueprint $table) {
            $table->dropForeign(['penilaian_submitted_by']);
            $table->dropColumn(['penilaian_submitted', 'penilaian_submitted_by', 'penilaian_submitted_at']);
        });

        // Drop field dari jadwal_jurnal_reading
        Schema::table('jadwal_jurnal_reading', function (Blueprint $table) {
            $table->dropForeign(['penilaian_submitted_by']);
            $table->dropColumn(['penilaian_submitted', 'penilaian_submitted_by', 'penilaian_submitted_at']);
        });

        // Drop field dari jadwal_praktikum
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            $table->dropForeign(['penilaian_submitted_by']);
            $table->dropColumn(['penilaian_submitted', 'penilaian_submitted_by', 'penilaian_submitted_at']);
        });

        // Drop field dari jadwal_kuliah_besar
        Schema::table('jadwal_kuliah_besar', function (Blueprint $table) {
            $table->dropForeign(['penilaian_submitted_by']);
            $table->dropColumn(['penilaian_submitted', 'penilaian_submitted_by', 'penilaian_submitted_at']);
        });

        // Drop field dari jadwal_csr
        Schema::table('jadwal_csr', function (Blueprint $table) {
            $table->dropForeign(['penilaian_submitted_by']);
            $table->dropColumn(['penilaian_submitted', 'penilaian_submitted_by', 'penilaian_submitted_at']);
        });

        // Drop field dari jadwal_non_blok_non_csr
        Schema::table('jadwal_non_blok_non_csr', function (Blueprint $table) {
            $table->dropForeign(['penilaian_submitted_by']);
            $table->dropColumn(['penilaian_submitted', 'penilaian_submitted_by', 'penilaian_submitted_at']);
        });
    }
};
