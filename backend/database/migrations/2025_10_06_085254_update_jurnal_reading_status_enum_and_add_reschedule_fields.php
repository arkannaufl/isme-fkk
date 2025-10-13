<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Add waiting_reschedule to status_konfirmasi ENUM if using MySQL ENUM
        // and add reschedule fields if missing
        if (Schema::hasTable('jadwal_jurnal_reading')) {
            // Alter ENUM safely by querying existing definition (MySQL-specific)
            try {
                $column = DB::selectOne("SHOW COLUMNS FROM jadwal_jurnal_reading LIKE 'status_konfirmasi'");
                if ($column && isset($column->Type)) {
                    $type = $column->Type; // e.g., enum('belum_konfirmasi','bisa','tidak_bisa')
                    if (str_starts_with($type, 'enum(') && !str_contains($type, "'waiting_reschedule'")) {
                        $newType = rtrim($type, ')') . " ,'waiting_reschedule')"; // insert new enum value
                        DB::statement("ALTER TABLE jadwal_jurnal_reading MODIFY status_konfirmasi $newType DEFAULT 'belum_konfirmasi'");
                    }
                }
            } catch (\Throwable $e) {
                // ignore if not MySQL or already handled
            }

            Schema::table('jadwal_jurnal_reading', function (Blueprint $table) {
                if (!Schema::hasColumn('jadwal_jurnal_reading', 'status_reschedule')) {
                    $table->enum('status_reschedule', ['waiting', 'approved', 'rejected'])->nullable()->after('alasan_konfirmasi');
                }
                if (!Schema::hasColumn('jadwal_jurnal_reading', 'reschedule_reason')) {
                    $table->text('reschedule_reason')->nullable()->after('status_reschedule');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('jadwal_jurnal_reading')) {
            Schema::table('jadwal_jurnal_reading', function (Blueprint $table) {
                if (Schema::hasColumn('jadwal_jurnal_reading', 'reschedule_reason')) {
                    $table->dropColumn('reschedule_reason');
                }
                if (Schema::hasColumn('jadwal_jurnal_reading', 'status_reschedule')) {
                    $table->dropColumn('status_reschedule');
                }
            });
            // Note: We don't remove enum value 'waiting_reschedule' on down migration for safety
        }
    }
};
