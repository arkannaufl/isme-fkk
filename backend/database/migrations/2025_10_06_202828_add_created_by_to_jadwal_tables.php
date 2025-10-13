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
        // Add created_by to jadwal_pbl table
        if (!Schema::hasColumn('jadwal_pbl', 'created_by')) {
            Schema::table('jadwal_pbl', function (Blueprint $table) {
                $table->unsignedBigInteger('created_by')->nullable()->after('created_at');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            });
        }

        // Add created_by to jadwal_kuliah_besar table
        if (!Schema::hasColumn('jadwal_kuliah_besar', 'created_by')) {
            Schema::table('jadwal_kuliah_besar', function (Blueprint $table) {
                $table->unsignedBigInteger('created_by')->nullable()->after('created_at');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            });
        }

        // Add created_by to jadwal_praktikum table
        if (!Schema::hasColumn('jadwal_praktikum', 'created_by')) {
            Schema::table('jadwal_praktikum', function (Blueprint $table) {
                $table->unsignedBigInteger('created_by')->nullable()->after('created_at');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            });
        }

        // Add created_by to jadwal_jurnal_reading table
        if (!Schema::hasColumn('jadwal_jurnal_reading', 'created_by')) {
            Schema::table('jadwal_jurnal_reading', function (Blueprint $table) {
                $table->unsignedBigInteger('created_by')->nullable()->after('created_at');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            });
        }

        // Add created_by to jadwal_csr table
        if (!Schema::hasColumn('jadwal_csr', 'created_by')) {
            Schema::table('jadwal_csr', function (Blueprint $table) {
                $table->unsignedBigInteger('created_by')->nullable()->after('created_at');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            });
        }

        // Add created_by to jadwal_non_blok_non_csr table
        if (!Schema::hasColumn('jadwal_non_blok_non_csr', 'created_by')) {
            Schema::table('jadwal_non_blok_non_csr', function (Blueprint $table) {
                $table->unsignedBigInteger('created_by')->nullable()->after('created_at');
                $table->foreign('created_by')->references('id')->on('users')->onDelete('set null');
            });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_pbl', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn('created_by');
        });

        Schema::table('jadwal_kuliah_besar', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn('created_by');
        });

        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn('created_by');
        });

        Schema::table('jadwal_jurnal_reading', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn('created_by');
        });

        Schema::table('jadwal_csr', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn('created_by');
        });

        Schema::table('jadwal_non_blok_non_csr', function (Blueprint $table) {
            $table->dropForeign(['created_by']);
            $table->dropColumn('created_by');
        });
    }
};
