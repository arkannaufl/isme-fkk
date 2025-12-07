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
        Schema::table('ikd_pedoman', function (Blueprint $table) {
            $table->string('unit_kerja')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ikd_pedoman', function (Blueprint $table) {
            $table->string('unit_kerja')->nullable(false)->change();
        });
    }
};
