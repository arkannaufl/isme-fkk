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
            // Cek apakah field sudah ada
            if (!Schema::hasColumn('users', 'veteran_completed_at')) {
                $table->timestamp('veteran_completed_at')->nullable()->after('veteran_status');
            }
            if (!Schema::hasColumn('users', 'veteran_duration_months')) {
                $table->integer('veteran_duration_months')->nullable()->after('veteran_completed_at');
            }
            if (!Schema::hasColumn('users', 'veteran_total_semesters')) {
                $table->integer('veteran_total_semesters')->nullable()->after('veteran_duration_months');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $columns = ['veteran_completed_at', 'veteran_duration_months', 'veteran_total_semesters'];
            foreach ($columns as $column) {
                if (Schema::hasColumn('users', $column)) {
                    $table->dropColumn($column);
                }
            }
        });
    }
};
