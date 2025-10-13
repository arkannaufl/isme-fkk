<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('jadwal_praktikum_dosen')) {
            // Extend enum for status_konfirmasi to include waiting_reschedule (MySQL only)
            try {
                $column = DB::selectOne("SHOW COLUMNS FROM jadwal_praktikum_dosen LIKE 'status_konfirmasi'");
                if ($column && isset($column->Type)) {
                    $type = $column->Type; // e.g., enum('belum_konfirmasi','bisa','tidak_bisa') or varchar
                    if (str_starts_with($type, 'enum(') && !str_contains($type, "'waiting_reschedule'")) {
                        $newType = rtrim($type, ')') . " ,'waiting_reschedule')";
                        DB::statement("ALTER TABLE jadwal_praktikum_dosen MODIFY status_konfirmasi $newType DEFAULT 'belum_konfirmasi'");
                    }
                }
            } catch (\Throwable $e) {
                // ignore for non-MySQL or if already altered
            }

            Schema::table('jadwal_praktikum_dosen', function (Blueprint $table) {
                if (!Schema::hasColumn('jadwal_praktikum_dosen', 'status_reschedule')) {
                    $table->enum('status_reschedule', ['waiting', 'approved', 'rejected'])->nullable()->after('status_konfirmasi');
                }
                if (!Schema::hasColumn('jadwal_praktikum_dosen', 'reschedule_reason')) {
                    $table->text('reschedule_reason')->nullable()->after('status_reschedule');
                }
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('jadwal_praktikum_dosen')) {
            Schema::table('jadwal_praktikum_dosen', function (Blueprint $table) {
                if (Schema::hasColumn('jadwal_praktikum_dosen', 'reschedule_reason')) {
                    $table->dropColumn('reschedule_reason');
                }
                if (Schema::hasColumn('jadwal_praktikum_dosen', 'status_reschedule')) {
                    $table->dropColumn('status_reschedule');
                }
            });
            // We don't shrink enum values on down
        }
    }
};
