<?php

namespace Database\Seeders;

use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use App\Models\Developer;

class DeveloperSeeder extends Seeder
{
    /**
     * Run the database seeds.
     */
    public function run(): void
    {
        $developers = [
            [
                'name' => 'Arkan Naufal Ardhani',
                'email' => 'arkannaufal024@gmail.com',
                'role' => 'Developer',
                'whatsapp' => '082262818868',
                'expertise' => 'Full Stack Development, React, Laravel',
                'is_active' => true,
                'sort_order' => 1,
            ],
            [
                'name' => 'Faris Dzu Khairil Muna',
                'email' => 'farisdzu9@gmail.com',
                'role' => 'Developer',
                'whatsapp' => '082113004533',
                'expertise' => 'Backend Development, PHP, Database Design',
                'is_active' => true,
                'sort_order' => 2,
            ],
            [
                'name' => 'Azka Savir Fauzie',
                'email' => 'azkasavir@gmail.com',
                'role' => 'Developer',
                'whatsapp' => '089620073008',
                'expertise' => 'Frontend Development, UI/UX Design, React',
                'is_active' => true,
                'sort_order' => 3,
            ],
            [
                'name' => 'Rizqi Irkham Maulana',
                'email' => 'rizqiirkhammaulana@gmail.com',
                'role' => 'Developer',
                'whatsapp' => '089689794985',
                'expertise' => 'Full Stack Development, Project Management, System Architecture',
                'is_active' => true,
                'sort_order' => 4,
            ],
        ];

        foreach ($developers as $developer) {
            Developer::create($developer);
        }
    }
}
