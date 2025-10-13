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
            if (!Schema::hasColumn('jadwal_csr', 'penilaian_submitted')) {
                $table->boolean('penilaian_submitted')->default(false)->after('topik');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_csr', function (Blueprint $table) {
            $table->dropColumn('penilaian_submitted');
        });
    }
};
