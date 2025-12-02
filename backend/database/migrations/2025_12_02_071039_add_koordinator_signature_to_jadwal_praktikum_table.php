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
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            $table->text('koordinator_signature')->nullable()->after('penilaian_submitted_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_praktikum', function (Blueprint $table) {
            $table->dropColumn('koordinator_signature');
        });
    }
};
