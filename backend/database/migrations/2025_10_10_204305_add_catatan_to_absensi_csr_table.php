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
        Schema::table('absensi_csr', function (Blueprint $table) {
            if (!Schema::hasColumn('absensi_csr', 'catatan')) {
                $table->text('catatan')->nullable()->after('hadir');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('absensi_csr', function (Blueprint $table) {
            if (Schema::hasColumn('absensi_csr', 'catatan')) {
                $table->dropColumn('catatan');
            }
        });
    }
};
