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
        Schema::table('ikd_bukti_fisik', function (Blueprint $table) {
            $table->string('unit')->nullable()->after('ikd_pedoman_id');
            $table->index(['user_id', 'ikd_pedoman_id', 'unit']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ikd_bukti_fisik', function (Blueprint $table) {
            $table->dropIndex(['user_id', 'ikd_pedoman_id', 'unit']);
            $table->dropColumn('unit');
        });
    }
};

