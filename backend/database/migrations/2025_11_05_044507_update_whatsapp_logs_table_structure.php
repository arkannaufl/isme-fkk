<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        if (Schema::hasTable('whatsapp_logs')) {
            Schema::table('whatsapp_logs', function (Blueprint $table) {
                // Tambah kolom message jika belum ada
                if (!Schema::hasColumn('whatsapp_logs', 'message')) {
                    $table->text('message')->after('phone');
                }

                // Tambah kolom response jika belum ada
                if (!Schema::hasColumn('whatsapp_logs', 'response')) {
                    $table->json('response')->nullable()->after('status');
                }

                // Tambah kolom metadata jika belum ada
                if (!Schema::hasColumn('whatsapp_logs', 'metadata')) {
                    $table->json('metadata')->nullable()->after('response');
                }

                // Tambah kolom sent_by jika belum ada
                if (!Schema::hasColumn('whatsapp_logs', 'sent_by')) {
                    $table->unsignedBigInteger('sent_by')->nullable()->after('metadata');
                }
            });

            // Tambah foreign key untuk sent_by jika belum ada
            if (Schema::hasColumn('whatsapp_logs', 'sent_by')) {
                $foreignKeys = DB::select("
                    SELECT CONSTRAINT_NAME 
                    FROM information_schema.KEY_COLUMN_USAGE 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'whatsapp_logs' 
                    AND COLUMN_NAME = 'sent_by' 
                    AND REFERENCED_TABLE_NAME IS NOT NULL
                ");
                
                if (empty($foreignKeys)) {
                    Schema::table('whatsapp_logs', function (Blueprint $table) {
                        $table->foreign('sent_by')->references('id')->on('users')->onDelete('set null');
                    });
                }
            }

            // Tambah index phone jika belum ada
            if (Schema::hasColumn('whatsapp_logs', 'phone')) {
                $indexes = DB::select("
                    SELECT INDEX_NAME 
                    FROM information_schema.STATISTICS 
                    WHERE TABLE_SCHEMA = DATABASE() 
                    AND TABLE_NAME = 'whatsapp_logs' 
                    AND COLUMN_NAME = 'phone'
                    AND INDEX_NAME != 'PRIMARY'
                ");
                
                if (empty($indexes)) {
                    Schema::table('whatsapp_logs', function (Blueprint $table) {
                        $table->index('phone');
                    });
                }
            }

            // Tambah composite index phone_status jika belum ada
            $compositeIndexes = DB::select("
                SELECT INDEX_NAME 
                FROM information_schema.STATISTICS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'whatsapp_logs' 
                AND INDEX_NAME = 'whatsapp_logs_phone_status_index'
            ");
            
            if (empty($compositeIndexes)) {
                Schema::table('whatsapp_logs', function (Blueprint $table) {
                    $table->index(['phone', 'status'], 'whatsapp_logs_phone_status_index');
                });
            }

            // Tambah index created_at jika belum ada
            $createdAtIndexes = DB::select("
                SELECT INDEX_NAME 
                FROM information_schema.STATISTICS 
                WHERE TABLE_SCHEMA = DATABASE() 
                AND TABLE_NAME = 'whatsapp_logs' 
                AND INDEX_NAME = 'whatsapp_logs_created_at_index'
            ");
            
            if (empty($createdAtIndexes)) {
                Schema::table('whatsapp_logs', function (Blueprint $table) {
                    $table->index('created_at', 'whatsapp_logs_created_at_index');
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        // Tidak perlu rollback karena ini adalah update struktur
    }
};
