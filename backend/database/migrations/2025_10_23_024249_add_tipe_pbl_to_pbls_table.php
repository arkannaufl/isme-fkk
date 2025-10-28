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
        Schema::table('pbls', function (Blueprint $table) {
            $table->integer('tipe_pbl')->default(1)->after('nama_modul');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('pbls', function (Blueprint $table) {
            $table->dropColumn('tipe_pbl');
        });
    }
};
