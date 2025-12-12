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
        // Pastikan kolom unit sudah ada (dari migration sebelumnya)
        if (Schema::hasColumn('ikd_bukti_fisik', 'unit')) {
        Schema::table('ikd_bukti_fisik', function (Blueprint $table) {
            // Drop old unique constraint
                // Laravel akan generate nama constraint: ikd_bukti_fisik_user_id_ikd_pedoman_id_unique
            $table->dropUnique(['user_id', 'ikd_pedoman_id']);
            // Add new unique constraint with unit
            $table->unique(['user_id', 'ikd_pedoman_id', 'unit'], 'ikd_bukti_fisik_user_pedoman_unit_unique');
        });
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('ikd_bukti_fisik', function (Blueprint $table) {
            // Drop new unique constraint
            $table->dropUnique('ikd_bukti_fisik_user_pedoman_unit_unique');
            // Restore old unique constraint
            $table->unique(['user_id', 'ikd_pedoman_id']);
        });
    }
};

