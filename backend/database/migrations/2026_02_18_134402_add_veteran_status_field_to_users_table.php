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
            // Cek apakah field veteran_status sudah ada
            if (!Schema::hasColumn('users', 'veteran_status')) {
                $table->string('veteran_status')->default('non_veteran')->after('veteran_history');
            }
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (Schema::hasColumn('users', 'veteran_status')) {
                $table->dropColumn('veteran_status');
            }
        });
    }
};
