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
        Schema::table('kelompok_besar', function (Blueprint $table) {
            $table->foreignId('semester_id')->nullable()->after('id')->constrained('semesters')->onDelete('cascade');
        });

        Schema::table('kelompok_kecil', function (Blueprint $table) {
            $table->foreignId('semester_id')->nullable()->after('id')->constrained('semesters')->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::table('kelompok_besar', function (Blueprint $table) {
            $table->dropForeign(['semester_id']);
            $table->dropColumn('semester_id');
        });

        Schema::table('kelompok_kecil', function (Blueprint $table) {
            $table->dropForeign(['semester_id']);
            $table->dropColumn('semester_id');
        });
    }
};
