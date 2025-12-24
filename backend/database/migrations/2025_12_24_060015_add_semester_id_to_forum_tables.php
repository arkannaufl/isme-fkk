<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * Run the migrations.
     * 
     * Strategi aman:
     * 1. Tambahkan semester_id nullable
     * 2. Populate dengan semester aktif untuk data existing
     * 3. Set default untuk data baru
     * 4. Buat foreign key dan index
     */
    public function up(): void
    {
        // Ambil semester aktif untuk populate data existing
        $activeSemester = DB::table('semesters')->where('aktif', true)->first();
        
        // Daftar tabel forum yang perlu ditambahkan semester_id
        $forumTables = [
            'forums',
            'forum_replies',
            'forum_likes',
            'user_forum_bookmarks',
        ];

        foreach ($forumTables as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) use ($tableName, $activeSemester) {
                    // Tambahkan kolom semester_id nullable
                    $table->unsignedBigInteger('semester_id')->nullable()->after('id');
                });
                
                // Populate dengan semester aktif untuk data existing
                if ($activeSemester) {
                    DB::table($tableName)->whereNull('semester_id')->update([
                        'semester_id' => $activeSemester->id
                    ]);
                }
                
                // Untuk forum_replies, populate dari forum yang terkait
                if ($tableName === 'forum_replies' && Schema::hasColumn($tableName, 'forum_id')) {
                    DB::statement("
                        UPDATE forum_replies fr
                        INNER JOIN forums f ON fr.forum_id = f.id
                        SET fr.semester_id = f.semester_id
                        WHERE fr.semester_id IS NULL AND f.semester_id IS NOT NULL
                    ");
                }
                
                // Untuk forum_likes, populate dari forum yang terkait
                if ($tableName === 'forum_likes' && Schema::hasColumn($tableName, 'forum_id')) {
                    DB::statement("
                        UPDATE forum_likes fl
                        INNER JOIN forums f ON fl.forum_id = f.id
                        SET fl.semester_id = f.semester_id
                        WHERE fl.semester_id IS NULL AND f.semester_id IS NOT NULL
                    ");
                }
                
                // Untuk user_forum_bookmarks, populate dari forum yang terkait
                if ($tableName === 'user_forum_bookmarks' && Schema::hasColumn($tableName, 'forum_id')) {
                    DB::statement("
                        UPDATE user_forum_bookmarks fb
                        INNER JOIN forums f ON fb.forum_id = f.id
                        SET fb.semester_id = f.semester_id
                        WHERE fb.semester_id IS NULL AND f.semester_id IS NOT NULL
                    ");
                }
                
                // Tambahkan foreign key dan index setelah populate
                Schema::table($tableName, function (Blueprint $table) {
                    $table->foreign('semester_id')
                          ->references('id')
                          ->on('semesters')
                          ->onDelete('restrict');
                    
                    $table->index('semester_id');
                });
            }
        }
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        $forumTables = [
            'forums',
            'forum_replies',
            'forum_likes',
            'user_forum_bookmarks',
        ];

        foreach ($forumTables as $tableName) {
            if (Schema::hasTable($tableName)) {
                Schema::table($tableName, function (Blueprint $table) {
                    try {
                        $table->dropForeign(['semester_id']);
                    } catch (\Exception $e) {
                        // Skip jika foreign key tidak ada
                    }
                    try {
                        $table->dropIndex(['semester_id']);
                    } catch (\Exception $e) {
                        // Skip jika index tidak ada
                    }
                    $table->dropColumn('semester_id');
                });
            }
        }
    }
};
