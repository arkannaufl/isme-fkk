<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddEventColumnToActivityLogTable extends Migration
{
    public function up()
    {
        Schema::connection(config('activitylog.database_connection'))->table(config('activitylog.table_name'), function (Blueprint $table) {
            // Tambah kolom hanya jika belum ada
            if (!Schema::hasColumn(config('activitylog.table_name'), 'event')) {
                $table->string('event')->nullable()->after('subject_type');
            }
        });
    }

    public function down()
    {
        Schema::connection(config('activitylog.database_connection'))->table(config('activitylog.table_name'), function (Blueprint $table) {
            // Drop kolom hanya jika ada
            if (Schema::hasColumn(config('activitylog.table_name'), 'event')) {
                $table->dropColumn('event');
            }
        });
    }
}
