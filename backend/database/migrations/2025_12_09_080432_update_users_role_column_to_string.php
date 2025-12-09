<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     * Mengubah kolom role dari ENUM menjadi VARCHAR untuk mendukung role IKD yang lebih fleksibel
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Ubah kolom role dari ENUM menjadi VARCHAR(50)
            // Menggunakan DB::statement karena Laravel tidak support langsung mengubah ENUM ke VARCHAR
            \DB::statement("ALTER TABLE `users` MODIFY COLUMN `role` VARCHAR(50) NOT NULL DEFAULT 'mahasiswa'");
        });
    }

    /**
     * Reverse the migrations.
     * Kembalikan ke ENUM dengan nilai default
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Kembalikan ke ENUM dengan nilai default
            \DB::statement("ALTER TABLE `users` MODIFY COLUMN `role` ENUM('super_admin', 'tim_akademik', 'dosen', 'mahasiswa') NOT NULL DEFAULT 'mahasiswa'");
        });
    }
};
