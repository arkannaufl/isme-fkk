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
        Schema::table('hasil_seminar_proposal', function (Blueprint $table) {
            $table->boolean('is_finalized')->default(false)->after('catatan_perbaikan');
            $table->timestamp('finalized_at')->nullable()->after('is_finalized');
            $table->unsignedBigInteger('finalized_by')->nullable()->after('finalized_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('hasil_seminar_proposal', function (Blueprint $table) {
            $table->dropColumn(['is_finalized', 'finalized_at', 'finalized_by']);
        });
    }
};
