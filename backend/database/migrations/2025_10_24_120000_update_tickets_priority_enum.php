<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Update the priority enum to include feature request priorities
        DB::statement("ALTER TABLE tickets MODIFY COLUMN priority ENUM('Low', 'Medium', 'High', 'Critical', 'Nice to have', 'Important') NOT NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Revert back to original enum values
        DB::statement("ALTER TABLE tickets MODIFY COLUMN priority ENUM('Low', 'Medium', 'High', 'Critical') NOT NULL");
    }
};
