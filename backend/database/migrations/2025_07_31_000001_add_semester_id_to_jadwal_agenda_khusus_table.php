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
        Schema::table('jadwal_agenda_khusus', function (Blueprint $table) {
            $table->unsignedBigInteger('semester_id')->nullable()->after('mata_kuliah_kode');
            $table->foreign('semester_id')->references('id')->on('semesters')->onDelete('restrict');
            $table->index('semester_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('jadwal_agenda_khusus', function (Blueprint $table) {
            $table->dropForeign(['semester_id']);
            $table->dropIndex(['semester_id']);
            $table->dropColumn('semester_id');
        });
    }
};
