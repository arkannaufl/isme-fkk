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
        // For MySQL, we need to use a raw query to update enum
        DB::statement("ALTER TABLE semesters MODIFY COLUMN jenis ENUM('Ganjil', 'Genap', 'Antara') NOT NULL");
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::statement("ALTER TABLE semesters MODIFY COLUMN jenis ENUM('Ganjil', 'Genap') NOT NULL");
    }
};
