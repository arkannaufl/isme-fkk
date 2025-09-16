<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class AddBatchUuidColumnToActivityLogTable extends Migration
{
    public function up()
    {
        Schema::connection(config('activitylog.database_connection'))->table(config('activitylog.table_name'), function (Blueprint $table) {
            // Tambah kolom hanya jika belum ada
            if (!Schema::hasColumn(config('activitylog.table_name'), 'batch_uuid')) {
                $table->uuid('batch_uuid')->nullable()->after('properties');
            }
        });
    }

    public function down()
    {
        Schema::connection(config('activitylog.database_connection'))->table(config('activitylog.table_name'), function (Blueprint $table) {
            // Drop kolom hanya jika ada
            if (Schema::hasColumn(config('activitylog.table_name'), 'batch_uuid')) {
                $table->dropColumn('batch_uuid');
            }
        });
    }
}
