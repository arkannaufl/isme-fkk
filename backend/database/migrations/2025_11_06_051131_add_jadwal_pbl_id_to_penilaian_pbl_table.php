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
        Schema::table('penilaian_pbl', function (Blueprint $table) {
            $table->unsignedBigInteger('jadwal_pbl_id')->nullable()->after('id');
            $table->foreign('jadwal_pbl_id')->references('id')->on('jadwal_pbl')->onDelete('cascade');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('penilaian_pbl', function (Blueprint $table) {
            $table->dropForeign(['jadwal_pbl_id']);
            $table->dropColumn('jadwal_pbl_id');
        });
    }
};
