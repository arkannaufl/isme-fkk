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

export interface Kelas {
  id: number;
  semester: string;
  nama_kelas: string;
  deskripsi?: string;
  created_at: string;
  updated_at: string;
}

export interface KelasResponse {
  semester: Semester;
  data: Kelas[];
}

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
  create: (data: { semester: string; mahasiswa_ids: number[] }) =>
    api.post('/kelompok-besar', data),

  // Hapus mahasiswa dari kelompok besar
  delete: (id: number) =>
    api.delete(`/kelompok-besar/${id}`),

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

// Kelas API
export const kelasApi = {
  // Get kelas per semester
  getBySemester: (semester: string) =>
    api.get<Kelas[]>(`/kelas/semester/${semester}`),

  // Get kelas per semester ID
  getBySemesterId: (semesterId: number) =>
    api.get<KelasResponse>(`/kelas/semester-id/${semesterId}`),

  // Buat kelas baru
  create: (data: {
    semester: string;
    nama_kelas: string;
    deskripsi?: string;
    kelompok_ids: string[];
  }) =>
    api.post('/kelas', data),

  // Get detail kelas
  getById: (id: number) =>
    api.get(`/kelas/${id}`),

  // Update kelas
  update: (id: number, data: {
    nama_kelas: string;
    deskripsi?: string;
    kelompok_ids: string[];
  }) =>
    api.put(`/kelas/${id}`, data),

  // Hapus kelas
  delete: (id: number) =>
    api.delete(`/kelas/${id}`),
};

// Mahasiswa API (untuk mendapatkan data mahasiswa)
export const mahasiswaApi = {
  // Get semua mahasiswa
  getAll: () =>
    api.get<Mahasiswa[]>('/users?role=mahasiswa'),

  // Get mahasiswa yang tidak terdaftar di semester lain
  getAvailable: (currentSemester: string) =>
    api.get<Mahasiswa[]>(`/users?role=mahasiswa&available_semester=${currentSemester}`),

  // Get mahasiswa berdasarkan semester
  getBySemester: (semester: string) =>
    api.get<Mahasiswa[]>(`/users?role=mahasiswa&semester=${semester}`),
};

// Forum API
export const forumApi = {
  // Get forum viewers
  getViewers: (id: number) =>
    api.get(`/forum/${id}/viewers`),
}; 