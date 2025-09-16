<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\ForumCategory;

class ForumCategorySeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $categories = [
            [
                'name' => 'Forum Diskusi Dosen',
                'slug' => 'forum-diskusi-dosen',
                'description' => 'Forum diskusi khusus untuk dosen. Dosen dan Tim Akademik dapat membuat forum baru di kategori ini.',
                'icon' => 'user-circle',
                'color' => '#3B82F6',
                'is_default' => true,
                'is_active' => true,
                'permissions' => ['dosen', 'tim_akademik', 'super_admin'],
                'sort_order' => 1,
                'created_by' => null,
            ],
            [
                'name' => 'Forum Diskusi Mahasiswa',
                'slug' => 'forum-diskusi-mahasiswa',
                'description' => 'Forum diskusi khusus untuk mahasiswa. Mahasiswa, Dosen, dan Tim Akademik dapat membuat forum baru di kategori ini.',
                'icon' => 'group',
                'color' => '#10B981',
                'is_default' => true,
                'is_active' => true,
                'permissions' => ['mahasiswa', 'dosen', 'tim_akademik', 'super_admin'],
                'sort_order' => 2,
                'created_by' => null,
            ]
        ];

        foreach ($categories as $category) {
            ForumCategory::firstOrCreate(
                ['slug' => $category['slug']],
                $category
            );
        }
    }
}
