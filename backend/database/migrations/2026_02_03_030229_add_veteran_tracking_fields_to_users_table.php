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
        Schema::table('users', function (Blueprint $table) {
            // Track semester saat mahasiswa lulus (sebelum jadi veteran)
            $table->integer('semester_saat_lulus')->nullable()->after('semester');
            
            // Track semester veteran (bisa terus bertambah)
            $table->integer('veteran_semester_count')->default(0)->after('semester_saat_lulus');
            
            // Status veteran (aktif/non-aktif)
            $table->string('veteran_status')->default('non_veteran')->after('veteran_semester_count');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn([
                'semester_saat_lulus',
                'veteran_semester_count', 
                'veteran_status'
            ]);
        });
    }
};
