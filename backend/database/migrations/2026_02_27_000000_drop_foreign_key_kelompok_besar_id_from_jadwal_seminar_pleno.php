<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up()
    {
        // Drop foreign key constraint since kelompok_besar_id stores semester number, not ID
        Schema::table('jadwal_seminar_pleno', function (Blueprint $table) {
            $table->dropForeign(['kelompok_besar_id']);
        });
    }

    public function down()
    {
        // Re-add foreign key constraint if rollback is needed
        Schema::table('jadwal_seminar_pleno', function (Blueprint $table) {
            $table->foreign('kelompok_besar_id')
                  ->references('id')
                  ->on('kelompok_besar')
                  ->onDelete('set null');
        });
    }
};
