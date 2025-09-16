<?php

namespace Database\Seeders;

use App\Models\MataKuliah;
use App\Models\User;
use Illuminate\Database\Seeder;
use Spatie\Activitylog\Models\Activity;

class DatabaseSeeder extends Seeder
{
    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Nonaktifkan logging Spatie selama seeding
        activity()->disableLogging();

        $this->call([
            MataKuliahSeeder::class,
            MataKuliahAntaraSeeder::class, // Seeder untuk mata kuliah semester antara
            TahunAjaranSeeder::class, // Pindah ke atas agar tahun ajaran aktif sebelum UserSeeder
            UserSeeder::class,
            RuanganSeeder::class,
            CSRSeeder::class,
            MataKuliahKeahlianSeeder::class,
            ForumCategorySeeder::class,
        ]);

        // Aktifkan lagi logging Spatie
        activity()->enableLogging();
    }
}
