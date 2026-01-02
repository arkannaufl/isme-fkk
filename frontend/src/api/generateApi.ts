import api, { handleApiError } from '../utils/api';

// Types
export interface Mahasiswa {
  id: number;
  name: string;
  nim: string;
  gender: string;
  ipk: number;
  status: string;
  angkatan: string;
  role: string;
  semester?: number;
  is_veteran?: boolean;
  is_multi_veteran?: boolean;
  veteran_notes?: string;
  veteran_set_at?: string;
  veteran_set_by?: number;
  veteran_semester?: string;
  veteran_semesters?: string[];
  veteran_history?: any[];
  semester_asli?: number;
  is_locked?: boolean;
  is_available?: boolean;
  veteranSetBy?: {
    id: number;
    name: string;
  };
}

export interface Semester {
  id: number;
  jenis: 'Ganjil' | 'Genap';
  aktif: boolean;
  tahun_ajaran_id: number;
}

export interface TahunAjaran {
  id: number;
  tahun: string;
  aktif: boolean;
  semesters: Semester[];
}

export interface AvailableSemesters {
  tahun_ajaran: string;
  semesters: {
    ganjil: number[];
    genap: number[];
  };
}

export interface KelompokBesar {
  id: number;
  semester: string;
  mahasiswa_id: number;
  mahasiswa: Mahasiswa;
  created_at: string;
  updated_at: string;
}

export interface KelompokBesarResponse {
  semester: Semester;
  data: KelompokBesar[];
}

export interface KelompokKecil {
  id: number;
  semester: string;
  nama_kelompok: string;
  mahasiswa_id: number;
  jumlah_kelompok: number;
  mahasiswa: Mahasiswa;
  created_at: string;
  updated_at: string;
}

// Kelas interface - DIHAPUS, tidak diperlukan lagi

export interface KelompokStats {
  kelompok: string;
  jumlahMahasiswa: number;
  lakiLaki: number;
  perempuan: number;
  avgIPK: number;
}

// Tahun Ajaran API
export const tahunAjaranApi = {
  // Get tahun ajaran aktif
  getActive: () =>
    api.get<TahunAjaran>('/tahun-ajaran/active'),

  // Get semester yang tersedia
  getAvailableSemesters: () =>
    api.get<AvailableSemesters>('/tahun-ajaran/available-semesters'),
};

// Kelompok Besar API
export const kelompokBesarApi = {
  // Get mahasiswa kelompok besar per semester
  getBySemester: (semester: string) =>
    api.get<KelompokBesar[]>(`/kelompok-besar?semester=${semester}`),

  // Get mahasiswa kelompok besar per semester ID
  getBySemesterId: (semesterId: number) =>
    api.get<KelompokBesarResponse>(`/kelompok-besar/semester/${semesterId}`),

  // Tambah mahasiswa ke kelompok besar
  create: (data: { semester: string; mahasiswa_ids: number[]; is_veteran_addition?: boolean }) =>
    api.post('/kelompok-besar', data),

  // Hapus mahasiswa dari kelompok besar
  delete: (id: number) =>
    api.delete(`/kelompok-besar/${id}`),

  // Hapus mahasiswa dari kelompok besar berdasarkan mahasiswa ID
  deleteByMahasiswaId: (mahasiswaId: number, semester: string) =>
    api.delete(`/kelompok-besar/mahasiswa/${mahasiswaId}?semester=${semester}`),

  // Batch by semester
  batchBySemester: (data: { semesters: string[] }) =>
    api.post('/kelompok-besar/batch-by-semester', data),
};

// Kelompok Kecil API
export const kelompokKecilApi = {
  // Get kelompok kecil per semester
  getBySemester: (semester: string) =>
    api.get<KelompokKecil[]>(`/kelompok-kecil?semester=${semester}`),

  // Generate kelompok kecil
  generate: (data: {
    semester: string;
    mahasiswa_ids: number[];
    jumlah_kelompok: number
  }) =>
    api.post('/kelompok-kecil', data),

  // Create single kelompok kecil (untuk insert mahasiswa baru)
  create: (data: {
    semester: string;
    nama_kelompok: string;
    mahasiswa_id: number;
    jumlah_kelompok: number;
  }) =>
    api.post('/kelompok-kecil/single', data),

  // Update pengelompokan (drag & drop)
  update: (id: number, data: { nama_kelompok: string }) =>
    api.put(`/kelompok-kecil/${id}`, data),

  // Hapus kelompok kecil
  delete: (id: number) =>
    api.delete(`/kelompok-kecil/${id}`),

  // Get statistik kelompok
  getStats: (semester: string) =>
    api.get<KelompokStats[]>(`/kelompok-kecil/stats?semester=${semester}`),

  // Batch update pengelompokan
  batchUpdate: (updates: { id: number, nama_kelompok: string }[]) =>
    api.post('/kelompok-kecil/batch-update', { updates }),

  // Batch by semester
  batchBySemester: (data: { semesters: string[] }) =>
    api.post('/kelompok-kecil/batch-by-semester', data),
};

// Kelas API - DIHAPUS, tidak diperlukan lagi

// Mahasiswa API (untuk mendapatkan data mahasiswa)
export const mahasiswaApi = {
  // Get semua mahasiswa
  getAll: () =>
    api.get<Mahasiswa[]>('/users?role=mahasiswa&per_page=1000'),

  // Get mahasiswa yang tidak terdaftar di semester lain
  getAvailable: (currentSemester: string) =>
    api.get<Mahasiswa[]>(`/users?role=mahasiswa&available_semester=${currentSemester}`),

  // Get mahasiswa berdasarkan semester
  getBySemester: (semester: string) =>
    api.get<Mahasiswa[]>(`/users?role=mahasiswa&semester=${semester}`),
};

// Mahasiswa Veteran API
export const mahasiswaVeteranApi = {
  // Get semua mahasiswa veteran
  getAll: (params?: {
    veteran_only?: boolean;
    angkatan?: string;
    search?: string;
  }) =>
    api.get<Mahasiswa[]>('/mahasiswa-veteran', { params }),

  // Toggle veteran status
  toggleVeteran: (data: {
    user_id: number;
    is_veteran: boolean;
    veteran_notes?: string;
    veteran_semester?: string;
  }) =>
    api.post('/mahasiswa-veteran/toggle', data),

  // Bulk toggle veteran status
  bulkToggleVeteran: (data: {
    user_ids: number[];
    is_veteran: boolean;
    veteran_notes?: string;
  }) =>
    api.post('/mahasiswa-veteran/bulk-toggle', data),

  // Get veteran statistics
  getStatistics: () =>
    api.get('/mahasiswa-veteran/statistics'),

  // Toggle multi-veteran status
  toggleMultiVeteran: (data: {
    user_id: number;
    is_multi_veteran: boolean;
  }) =>
    api.post('/mahasiswa-veteran/toggle-multi-veteran', data),

  // Add veteran to semester
  addToSemester: (data: {
    user_id: number;
    semester: string;
  }) =>
    api.post('/mahasiswa-veteran/add-to-semester', data),

  // Remove veteran from semester
  removeFromSemester: (data: {
    user_id: number;
    semester: string;
  }) =>
    api.post('/mahasiswa-veteran/remove-from-semester', data),

  // Release veteran from semester
  releaseFromSemester: (data: {
    user_id: number;
    semester: string;
  }) =>
    api.post('/mahasiswa-veteran/release-from-semester', data),
};

// Forum API
export const forumApi = {
  // Get forum viewers
  getViewers: (id: number) =>
    api.get(`/forum/${id}/viewers`),
};

// PBL Generate API
export const pblGenerateApi = {
  // Generate assignments
  generateAssignments: (data: {
    assignments: Array<{
      pbl_id: number;
      dosen_id: number;
      role: string;
    }>;
  }) =>
    api.post('/pbl-generate/assignments', data),

  // Reset assignments
  resetAssignments: (data: {
    pbl_ids: number[];
  }) =>
    api.post('/pbl-generate/reset', data),

  // Get assignments
  getAssignments: (data: {
    pbl_ids: number[];
  }) =>
    api.post('/pbl-generate/get-assignments', data),

  // Check generate status per blok
  checkGenerateStatus: (blok: number) =>
    api.get(`/pbl-generate/check-status?blok=${blok}`),
};