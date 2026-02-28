import React from 'react';
import { AnimatePresence, motion } from 'framer-motion';

type TabType = 'besar' | 'kecil';

type Props = {
  isOpen: boolean;
  onClose: () => void;

  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;

  // Shared state
  selectedMahasiswa: { id: number; name: string; email: string; ipk?: number }[];
  setSelectedMahasiswa: React.Dispatch<
    React.SetStateAction<{ id: number; name: string; email: string; ipk?: number }[]>
  >;

  allMahasiswaOptions: { id: number; name: string; email: string; ipk?: number }[];
  isLoadingMahasiswa: boolean;
  isLoadingKelompok: boolean;

  searchMahasiswa: string;
  setSearchMahasiswa: React.Dispatch<React.SetStateAction<string>>;
  filterIPK: string;
  setFilterIPK: React.Dispatch<React.SetStateAction<string>>;

  // Optional: separate search/filter state for tab kelompok kecil
  searchMahasiswaKelompokKecil?: string;
  setSearchMahasiswaKelompokKecil?: React.Dispatch<React.SetStateAction<string>>;
  filterIPKKelompokKecil?: string;
  setFilterIPKKelompokKecil?: React.Dispatch<React.SetStateAction<string>>;

  getFilteredMahasiswa: () => { id: number; name: string; email: string; ipk?: number }[];
  getTotalGroupedStudents: () => number;

  // Kelompok besar
  kelompokBesarOptions: any[];
  kelompokBesarAntaraForm: { nama_kelompok: string; mahasiswa_ids: number[] };
  setKelompokBesarAntaraForm: React.Dispatch<
    React.SetStateAction<{ nama_kelompok: string; mahasiswa_ids: number[] }>
  >;
  isCreatingKelompok: boolean;
  createKelompokBesarAntara: () => void;
  deleteKelompokBesarAntara: (id: number) => void;

  // Unassign
  unassignMode: { [key: number]: boolean };
  setUnassignMode: React.Dispatch<React.SetStateAction<{ [key: number]: boolean }>>;
  handleUnassignMahasiswa: (kelompokId: number, mahasiswaId: number, kelompokType: TabType) => void;

  showUnassignKelompokKecil?: boolean;

  // Kelompok kecil
  kelompokKecilAntaraList: any[];
  isLoadingKelompokKecilAntara?: boolean;
  kelompokKecilAntaraForm: { nama_kelompok: string; mahasiswa_ids: number[] };
  setKelompokKecilAntaraForm: React.Dispatch<
    React.SetStateAction<{ nama_kelompok: string; mahasiswa_ids: number[] }>
  >;
  isCreatingKelompokKecilAntara: boolean;
  createKelompokKecilAntara: () => void;
  deleteKelompokKecilAntara: (id: number) => void;
};

export default function KelolaKelompokAntaraModal({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  selectedMahasiswa,
  setSelectedMahasiswa,
  allMahasiswaOptions,
  isLoadingMahasiswa,
  isLoadingKelompok,
  searchMahasiswa,
  setSearchMahasiswa,
  filterIPK,
  setFilterIPK,
  searchMahasiswaKelompokKecil,
  setSearchMahasiswaKelompokKecil,
  filterIPKKelompokKecil,
  setFilterIPKKelompokKecil,
  getFilteredMahasiswa,
  getTotalGroupedStudents,
  kelompokBesarOptions,
  kelompokBesarAntaraForm,
  setKelompokBesarAntaraForm,
  isCreatingKelompok,
  createKelompokBesarAntara,
  deleteKelompokBesarAntara,
  unassignMode,
  setUnassignMode,
  handleUnassignMahasiswa,
  showUnassignKelompokKecil,
  kelompokKecilAntaraList,
  isLoadingKelompokKecilAntara,
  kelompokKecilAntaraForm,
  setKelompokKecilAntaraForm,
  isCreatingKelompokKecilAntara,
  createKelompokKecilAntara,
  deleteKelompokKecilAntara,
}: Props) {
  const searchKecil = searchMahasiswaKelompokKecil ?? searchMahasiswa;
  const setSearchKecil = setSearchMahasiswaKelompokKecil ?? setSearchMahasiswa;
  const filterKecil = filterIPKKelompokKecil ?? filterIPK;
  const setFilterKecil = setFilterIPKKelompokKecil ?? setFilterIPK;
  const loadingKecil = isLoadingKelompokKecilAntara ?? isLoadingKelompok;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-100000 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-gray-500/30 dark:bg-gray-500/50 backdrop-blur-md"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2 }}
            className="relative w-full max-w-7xl mx-auto bg-white dark:bg-gray-900 rounded-3xl px-8 py-8 shadow-lg z-50 max-h-[90vh] overflow-hidden"
          >
            <div className="flex items-center justify-between pb-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 bg-brand-100 dark:bg-brand-900/20 rounded-xl flex items-center justify-center">
                  <svg className="w-5 h-5 text-brand-600 dark:text-brand-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-800 dark:text-white">Kelola Kelompok Antara</h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                    Buat dan kelola kelompok besar dan kecil untuk semester antara
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="p-2.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-all duration-200 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 hover:scale-105"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="mt-8 mb-8">
              <div className="flex bg-gray-100 dark:bg-gray-800 rounded-2xl p-1.5 shadow-sm border border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setActiveTab('besar')}
                  className={`flex-1 px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                    activeTab === 'besar'
                      ? 'bg-white dark:bg-gray-700 text-brand-600 dark:text-brand-400 shadow-md'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  Kelompok Besar
                </button>
                <button
                  onClick={() => setActiveTab('kecil')}
                  className={`flex-1 px-6 py-3 text-sm font-semibold rounded-xl transition-all duration-300 ${
                    activeTab === 'kecil'
                      ? 'bg-white dark:bg-gray-700 text-green-600 dark:text-green-400 shadow-md'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50'
                  }`}
                >
                  Kelompok Kecil
                </button>
              </div>
            </div>

            <div className="flex h-[calc(90vh-200px)] min-h-0">
              {activeTab === 'besar' ? (
                <>
                  <div className="w-1/2 h-full min-h-0 border-r border-gray-200 dark:border-gray-700 pr-4 overflow-y-auto hide-scroll">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Buat Kelompok Besar Baru</h3>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nama Kelompok Besar</label>
                          <input
                            type="text"
                            value={kelompokBesarAntaraForm.nama_kelompok}
                            onChange={(e) => setKelompokBesarAntaraForm((prev) => ({ ...prev, nama_kelompok: e.target.value }))}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200 shadow-sm"
                            placeholder="Contoh: Kelompok Besar 1"
                          />
                        </div>

                        {selectedMahasiswa.length > 0 && (
                          <div className="bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-700 rounded-xl p-4 shadow-sm">
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 bg-brand-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                              <p className="text-sm font-semibold text-brand-800 dark:text-brand-200">{selectedMahasiswa.length} mahasiswa dipilih</p>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
                            Pilih Mahasiswa ({allMahasiswaOptions.length} tersedia, {getTotalGroupedStudents()} sudah dikelompokkan)
                          </label>

                          <div className="flex gap-3 mb-3">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={searchMahasiswa}
                                onChange={(e) => setSearchMahasiswa(e.target.value)}
                                placeholder="Cari nama atau email mahasiswa..."
                                className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                              />
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                  />
                                </svg>
                              </div>
                            </div>

                            <div className="w-40">
                              <select
                                value={filterIPK}
                                onChange={(e) => setFilterIPK(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition-all duration-200"
                              >
                                <option value="semua">Semua IPK</option>
                                <option value="3.5+">IPK 3.5+ (Hijau)</option>
                                <option value="3.0-3.49">IPK 3.0-3.49 (Biru)</option>
                                <option value="2.5-2.99">IPK 2.5-2.99 (Kuning)</option>
                                <option value="<2.5">IPK &lt;2.5 (Merah)</option>
                              </select>
                            </div>
                          </div>

                          <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 hide-scroll shadow-sm">
                            {(searchMahasiswa || filterIPK !== 'semua') && (
                              <div className="p-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                                <p className="text-sm text-gray-600 dark:text-gray-400">
                                  Menampilkan {getFilteredMahasiswa().length} dari {allMahasiswaOptions.length} mahasiswa
                                  {searchMahasiswa && ` untuk pencarian \"${searchMahasiswa}\"`}
                                  {filterIPK !== 'semua' && ` dengan filter IPK ${filterIPK}`}
                                </p>
                              </div>
                            )}

                            {isLoadingMahasiswa ? (
                              <div className="p-4 space-y-3">
                                {[...Array(6)].map((_, index) => (
                                  <div key={index} className="flex items-center space-x-3 animate-pulse">
                                    <div className="w-4 h-4 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                    <div className="flex-1">
                                      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-3/4 mb-2"></div>
                                      <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-1/2"></div>
                                    </div>
                                    <div className="w-16 h-6 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <>
                                {getFilteredMahasiswa().map((mahasiswa) => {
                                  const isSelected = selectedMahasiswa.some((m) => m.id === mahasiswa.id);
                                  const isInOtherGroup = kelompokBesarOptions.some((group: any) => group.mahasiswa?.some((m: any) => m.id === mahasiswa.id));

                                  return (
                                    <div
                                      key={mahasiswa.id}
                                      className={`p-4 border-b border-gray-200 dark:border-gray-600 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 ${
                                        isSelected ? 'bg-brand-50 dark:bg-brand-900/20' : ''
                                      } ${isInOtherGroup && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                                      onClick={() => {
                                        if (isInOtherGroup && !isSelected) return;

                                        if (isSelected) {
                                          setSelectedMahasiswa((prev) => prev.filter((m) => m.id !== mahasiswa.id));
                                          setKelompokBesarAntaraForm((prev) => ({
                                            ...prev,
                                            mahasiswa_ids: prev.mahasiswa_ids.filter((id) => id !== mahasiswa.id),
                                          }));
                                        } else {
                                          setSelectedMahasiswa((prev) => [...prev, mahasiswa]);
                                          setKelompokBesarAntaraForm((prev) => ({
                                            ...prev,
                                            mahasiswa_ids: [...prev.mahasiswa_ids, mahasiswa.id],
                                          }));
                                        }
                                      }}
                                    >
                                      <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-3">
                                          <div
                                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                              isSelected ? 'bg-brand-500 border-brand-500' : 'border-gray-300 dark:border-gray-600'
                                            }`}
                                          >
                                            {isSelected && (
                                              <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                <path
                                                  fillRule="evenodd"
                                                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                  clipRule="evenodd"
                                                />
                                              </svg>
                                            )}
                                          </div>
                                          <div>
                                            <div className="flex items-center space-x-2">
                                              <p className="font-medium text-gray-800 dark:text-white text-sm">{mahasiswa.name}</p>
                                              <span
                                                className={`text-xs px-2 py-0.5 rounded-full ${
                                                  (mahasiswa.ipk || 0) >= 3.5
                                                    ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                                    : (mahasiswa.ipk || 0) >= 3.0
                                                      ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                                      : (mahasiswa.ipk || 0) >= 2.5
                                                        ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                                                        : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                                }`}
                                              >
                                                IPK {mahasiswa.ipk ? mahasiswa.ipk.toFixed(2) : 'N/A'}
                                              </span>
                                            </div>
                                            <p className="text-xs text-gray-500 dark:text-gray-400">{mahasiswa.email}</p>
                                          </div>
                                        </div>
                                        {isInOtherGroup && !isSelected && <span className="text-xs text-gray-400">Sudah di kelompok lain</span>}
                                      </div>
                                    </div>
                                  );
                                })}
                              </>
                            )}
                          </div>
                        </div>

                        <button
                          onClick={createKelompokBesarAntara}
                          disabled={!kelompokBesarAntaraForm.nama_kelompok || kelompokBesarAntaraForm.mahasiswa_ids.length === 0 || isCreatingKelompok}
                          className="w-full px-6 py-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                        >
                          <div className="flex items-center justify-center space-x-2">
                            {isCreatingKelompok ? (
                              <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                                <span>Membuat Kelompok...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                <span>Buat Kelompok ({selectedMahasiswa.length} mahasiswa)</span>
                              </>
                            )}
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="w-1/2 h-full min-h-0 pl-4 overflow-y-auto hide-scroll">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">
                          Kelompok Besar yang Sudah Ada ({kelompokBesarOptions.length})
                        </h3>
                      </div>

                      <div className="space-y-3 pb-10">
                        {isLoadingKelompok ? (
                          <div className="space-y-3">
                            {[...Array(2)].map((_, index) => (
                              <div
                                key={index}
                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm animate-pulse"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                                    <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-48"></div>
                                  </div>
                                  <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {[...Array(6)].map((_, studentIndex) => (
                                    <div key={studentIndex} className="flex items-center space-x-2">
                                      <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
                                      <div className="w-16 h-5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <>
                            {kelompokBesarOptions.map((kelompok: any) => (
                              <div
                                key={kelompok.id}
                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-7 h-7 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                                      <svg
                                        className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400"
                                        fill="none"
                                        stroke="currentColor"
                                        viewBox="0 0 24 24"
                                      >
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656-.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                        />
                                      </svg>
                                    </div>
                                    <h4 className="font-semibold text-gray-800 dark:text-white">{kelompok.label}</h4>
                                  </div>
                                  <div className="flex items-center space-x-2">
                                    <button
                                      onClick={() => {
                                        setUnassignMode((prev) => ({
                                          ...prev,
                                          [kelompok.id]: !prev[kelompok.id],
                                        }));
                                      }}
                                      className={`p-1.5 rounded-lg transition-all duration-200 ${
                                        unassignMode[kelompok.id]
                                          ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                      }`}
                                      title={unassignMode[kelompok.id] ? 'Selesai unassign' : 'Unassign mahasiswa'}
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                        />
                                      </svg>
                                    </button>
                                    <button
                                      onClick={() => deleteKelompokBesarAntara(kelompok.id)}
                                      className="p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                                      title="Hapus kelompok"
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                        />
                                      </svg>
                                    </button>
                                  </div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {kelompok.mahasiswa.map((mahasiswa: any) => (
                                    <div
                                      key={mahasiswa.id}
                                      className={`flex items-center text-sm text-gray-600 dark:text-gray-400 p-1.5 rounded-lg transition-colors ${
                                        unassignMode[kelompok.id] ? 'justify-between hover:bg-gray-50 dark:hover:bg-gray-700' : ''
                                      }`}
                                    >
                                      <div className="flex items-center space-x-1.5">
                                        <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                                        <span>{mahasiswa.name}</span>
                                        <span
                                          className={`text-xs px-2 py-0.5 rounded-full ${
                                            (mahasiswa.ipk || 0) >= 3.5
                                              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                              : (mahasiswa.ipk || 0) >= 3.0
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                                : (mahasiswa.ipk || 0) >= 2.5
                                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                                                  : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                          }`}
                                        >
                                          IPK {mahasiswa.ipk ? mahasiswa.ipk.toFixed(2) : 'N/A'}
                                        </span>
                                      </div>
                                      {unassignMode[kelompok.id] && (
                                        <button
                                          onClick={() => handleUnassignMahasiswa(kelompok.id, mahasiswa.id, 'besar')}
                                          className="p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                                          title="Unassign mahasiswa dari kelompok"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}

                            {kelompokBesarOptions.length === 0 && (
                              <div className="text-center py-12">
                                <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                                  <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                    />
                                  </svg>
                                </div>
                                <p className="text-gray-500 dark:text-gray-400 font-medium">Belum ada kelompok besar yang dibuat</p>
                                <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Buat kelompok pertama di panel sebelah kiri</p>
                              </div>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-1/2 h-full min-h-0 border-r border-gray-200 dark:border-gray-700 pr-4 overflow-y-auto hide-scroll">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Buat Kelompok Kecil Baru</h3>
                      </div>

                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">Nama Kelompok Kecil</label>
                          <input
                            type="text"
                            value={kelompokKecilAntaraForm.nama_kelompok}
                            onChange={(e) => setKelompokKecilAntaraForm((prev) => ({ ...prev, nama_kelompok: e.target.value }))}
                            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200 shadow-sm"
                            placeholder="Contoh: Kelompok Kecil 1"
                          />
                        </div>

                        {kelompokKecilAntaraForm.mahasiswa_ids.length > 0 && (
                          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4 shadow-sm mb-4">
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                                  <path
                                    fillRule="evenodd"
                                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                    clipRule="evenodd"
                                  />
                                </svg>
                              </div>
                              <p className="text-sm font-semibold text-green-800 dark:text-green-200">{kelompokKecilAntaraForm.mahasiswa_ids.length} mahasiswa dipilih</p>
                            </div>
                          </div>
                        )}

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">Pilih Mahasiswa dari Kelompok Besar Antara</label>

                          <div className="flex space-x-3 mb-3">
                            <div className="relative flex-1">
                              <input
                                type="text"
                                value={searchKecil}
                                onChange={(e) => setSearchKecil(e.target.value)}
                                placeholder="Cari nama atau email mahasiswa..."
                                className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                              />
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <svg className="w-5 h-5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                                  />
                                </svg>
                              </div>
                            </div>

                            <div className="w-48">
                              <select
                                value={filterKecil}
                                onChange={(e) => setFilterKecil(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent transition-all duration-200"
                              >
                                <option value="semua">Semua IPK</option>
                                <option value=">=3.5">IPK ≥3.5 (Hijau)</option>
                                <option value="3.0-3.49">IPK 3.0-3.49 (Biru)</option>
                                <option value="2.5-2.99">IPK 2.5-2.99 (Kuning)</option>
                                <option value="<2.5">IPK &lt;2.5 (Merah)</option>
                              </select>
                            </div>
                          </div>

                          {isLoadingKelompok ? (
                            <div className="space-y-2">
                              {[...Array(3)].map((_, index) => (
                                <div key={index} className="h-10 bg-gray-200 dark:bg-gray-600 rounded-lg animate-pulse"></div>
                              ))}
                            </div>
                          ) : kelompokBesarOptions.length === 0 ? (
                            <div className="text-center py-6 bg-gray-50 dark:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-600">
                              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                              </svg>
                              <p className="text-sm text-gray-500 dark:text-gray-400">Belum ada kelompok besar yang dibuat</p>
                              <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Buat kelompok besar terlebih dahulu</p>
                            </div>
                          ) : (
                            <div className="max-h-64 overflow-y-auto border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 hide-scroll shadow-sm">
                              {(searchKecil || filterKecil !== 'semua') && (
                                <div className="p-3 border-b border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-800">
                                  <p className="text-sm text-gray-600 dark:text-gray-400">
                                    {searchKecil && `Mencari: \"${searchKecil}\"`}
                                    {searchKecil && filterKecil !== 'semua' && ' | '}
                                    {filterKecil !== 'semua' && `Filter IPK: ${filterKecil}`}
                                  </p>
                                </div>
                              )}

                              {kelompokBesarOptions.map((kelompok: any) => {
                                const filteredMahasiswa =
                                  kelompok.mahasiswa?.filter((mahasiswa: any) => {
                                    const matchesSearch =
                                      !searchKecil ||
                                      mahasiswa.name.toLowerCase().includes(searchKecil.toLowerCase()) ||
                                      mahasiswa.email.toLowerCase().includes(searchKecil.toLowerCase());

                                    const matchesIPK =
                                      filterKecil === 'semua' ||
                                      (filterKecil === '>=3.5' && (mahasiswa.ipk || 0) >= 3.5) ||
                                      (filterKecil === '3.0-3.49' && (mahasiswa.ipk || 0) >= 3.0 && (mahasiswa.ipk || 0) < 3.5) ||
                                      (filterKecil === '2.5-2.99' && (mahasiswa.ipk || 0) >= 2.5 && (mahasiswa.ipk || 0) < 3.0) ||
                                      (filterKecil === '<2.5' && (mahasiswa.ipk || 0) < 2.5);

                                    return matchesSearch && matchesIPK;
                                  }) || [];

                                if ((searchKecil || filterKecil !== 'semua') && filteredMahasiswa.length === 0) {
                                  return null;
                                }

                                return (
                                  <div key={kelompok.id} className="p-4 border-b border-gray-200 dark:border-gray-600">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center space-x-3">
                                        <div className="w-6 h-6 bg-blue-100 dark:bg-blue-900/20 rounded-lg flex items-center justify-center">
                                          <svg className="w-3 h-3 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path
                                              strokeLinecap="round"
                                              strokeLinejoin="round"
                                              strokeWidth={2}
                                              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                            />
                                          </svg>
                                        </div>
                                        <div>
                                          <span className="text-xs text-gray-500 dark:text-gray-400">{kelompok.mahasiswa?.length || 0} mahasiswa</span>
                                          <span className="text-xs text-blue-600 dark:text-blue-400 block">{kelompok.label.split(' (')[0]}</span>
                                        </div>
                                      </div>
                                    </div>
                                    <div className="space-y-1">
                                      {filteredMahasiswa.map((mahasiswa: any) => {
                                        const isSelected = kelompokKecilAntaraForm.mahasiswa_ids.includes(mahasiswa.id);
                                        const isInOtherKelompokKecil = kelompokKecilAntaraList.some((k: any) => k.mahasiswa_ids.includes(mahasiswa.id));

                                        return (
                                          <div
                                            key={mahasiswa.id}
                                            className={`p-2 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-600 transition-all duration-200 ${
                                              isSelected ? 'bg-green-50 dark:bg-green-900/20' : ''
                                            } ${isInOtherKelompokKecil && !isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            onClick={() => {
                                              if (isInOtherKelompokKecil && !isSelected) return;

                                              if (isSelected) {
                                                setKelompokKecilAntaraForm((prev) => ({
                                                  ...prev,
                                                  mahasiswa_ids: prev.mahasiswa_ids.filter((id) => id !== mahasiswa.id),
                                                }));
                                              } else {
                                                setKelompokKecilAntaraForm((prev) => ({
                                                  ...prev,
                                                  mahasiswa_ids: [...prev.mahasiswa_ids, mahasiswa.id],
                                                }));
                                              }
                                            }}
                                          >
                                            <div className="flex items-center justify-between">
                                              <div className="flex items-center space-x-3">
                                                <div
                                                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                                                    isSelected ? 'bg-green-500 border-green-500' : 'border-gray-300 dark:border-gray-600'
                                                  }`}
                                                >
                                                  {isSelected && (
                                                    <svg className="w-2.5 h-2.5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                                      <path
                                                        fillRule="evenodd"
                                                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                                        clipRule="evenodd"
                                                      />
                                                    </svg>
                                                  )}
                                                </div>
                                                <div>
                                                  <div className="flex items-center space-x-2">
                                                    <p className="font-medium text-gray-800 dark:text-white text-sm">{mahasiswa.name}</p>
                                                    <span
                                                      className={`text-xs px-2 py-0.5 rounded-full ${
                                                        (mahasiswa.ipk || 0) >= 3.5
                                                          ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                                          : (mahasiswa.ipk || 0) >= 3.0
                                                            ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                                            : (mahasiswa.ipk || 0) >= 2.5
                                                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                                                              : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                                      }`}
                                                    >
                                                      IPK {mahasiswa.ipk ? mahasiswa.ipk.toFixed(2) : 'N/A'}
                                                    </span>
                                                  </div>
                                                  <p className="text-xs text-gray-500 dark:text-gray-400">{mahasiswa.email}</p>
                                                </div>
                                              </div>
                                              {isInOtherKelompokKecil && !isSelected && (
                                                <span className="text-xs text-gray-400">Sudah di kelompok lain</span>
                                              )}
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>

                        <button
                          onClick={createKelompokKecilAntara}
                          disabled={!kelompokKecilAntaraForm.nama_kelompok || kelompokKecilAntaraForm.mahasiswa_ids.length === 0 || isCreatingKelompokKecilAntara}
                          className="w-full px-6 py-3 bg-brand-500 text-white rounded-xl hover:bg-brand-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200 font-semibold shadow-lg hover:shadow-xl transform hover:scale-[1.02] disabled:transform-none"
                        >
                          <div className="flex items-center justify-center space-x-2">
                            {isCreatingKelompokKecilAntara ? (
                              <>
                                <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                  <path
                                    className="opacity-75"
                                    fill="currentColor"
                                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                  ></path>
                                </svg>
                                <span>Membuat Kelompok...</span>
                              </>
                            ) : (
                              <>
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                                </svg>
                                <span>Buat Kelompok Kecil ({kelompokKecilAntaraForm.mahasiswa_ids.length} mahasiswa)</span>
                              </>
                            )}
                          </div>
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="w-1/2 h-full min-h-0 pl-4 overflow-y-auto hide-scroll">
                    <div className="bg-gray-50 dark:bg-gray-800 rounded-xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
                      <div className="mb-6">
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white">Kelompok Kecil yang Sudah Dibuat</h3>
                      </div>

                      <div className="space-y-3 pb-10">
                        {loadingKecil ? (
                          <div className="space-y-3">
                            {[...Array(2)].map((_, index) => (
                              <div
                                key={index}
                                className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm animate-pulse"
                              >
                                <div className="flex items-center justify-between mb-3">
                                  <div className="flex items-center space-x-3">
                                    <div className="w-8 h-8 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                                    <div className="h-6 bg-gray-300 dark:bg-gray-600 rounded w-48"></div>
                                  </div>
                                  <div className="w-10 h-10 bg-gray-300 dark:bg-gray-600 rounded-lg"></div>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {[...Array(6)].map((_, studentIndex) => (
                                    <div key={studentIndex} className="flex items-center space-x-2">
                                      <div className="w-2 h-2 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                      <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-32"></div>
                                      <div className="w-16 h-5 bg-gray-300 dark:bg-gray-600 rounded-full"></div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : kelompokKecilAntaraList.length === 0 ? (
                          <div className="text-center py-12">
                            <div className="w-16 h-16 bg-gray-100 dark:bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                              <svg className="w-8 h-8 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  strokeWidth={2}
                                  d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                />
                              </svg>
                            </div>
                            <p className="text-gray-500 dark:text-gray-400 font-medium">Belum ada kelompok kecil yang dibuat</p>
                            <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">Buat kelompok pertama di panel sebelah kiri</p>
                          </div>
                        ) : (
                          kelompokKecilAntaraList.map((kelompok: any) => (
                            <div
                              key={kelompok.id}
                              className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center space-x-3">
                                  <div className="w-7 h-7 bg-green-100 dark:bg-green-900/20 rounded-lg flex items-center justify-center">
                                    <svg className="w-3.5 h-3.5 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"
                                      />
                                    </svg>
                                  </div>
                                  <h4 className="font-semibold text-gray-800 dark:text-white">{kelompok.nama_kelompok}</h4>
                                </div>
                                <div className="flex items-center space-x-2">
                                  {showUnassignKelompokKecil && (
                                    <button
                                      onClick={() => {
                                        setUnassignMode((prev) => ({
                                          ...prev,
                                          [kelompok.id]: !prev[kelompok.id],
                                        }));
                                      }}
                                      className={`p-1.5 rounded-lg transition-all duration-200 ${
                                        unassignMode[kelompok.id]
                                          ? 'bg-orange-100 dark:bg-orange-900/20 text-orange-600 dark:text-orange-400'
                                          : 'text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700'
                                      }`}
                                      title={unassignMode[kelompok.id] ? 'Selesai unassign' : 'Unassign mahasiswa'}
                                    >
                                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path
                                          strokeLinecap="round"
                                          strokeLinejoin="round"
                                          strokeWidth={2}
                                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                                        />
                                      </svg>
                                    </button>
                                  )}
                                  <button
                                    onClick={() => deleteKelompokKecilAntara(kelompok.id)}
                                    className="p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                                    title="Hapus kelompok"
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        strokeWidth={2}
                                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                                      />
                                    </svg>
                                  </button>
                                </div>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {kelompok.mahasiswa_ids.map((mahasiswaId: any) => {
                                  const mahasiswa = allMahasiswaOptions.find((m) => m.id === mahasiswaId);
                                  return mahasiswa ? (
                                    <div
                                      key={mahasiswaId}
                                      className={`flex items-center text-sm text-gray-600 dark:text-gray-400 p-1.5 rounded-lg transition-colors ${
                                        showUnassignKelompokKecil && unassignMode[kelompok.id]
                                          ? 'justify-between hover:bg-gray-50 dark:hover:bg-gray-700'
                                          : ''
                                      }`}
                                    >
                                      <div className="flex items-center space-x-1.5">
                                        <div className="w-2 h-2 bg-gray-400 dark:bg-gray-500 rounded-full"></div>
                                        <span>{mahasiswa.name}</span>
                                        <span
                                          className={`text-xs px-2 py-0.5 rounded-full ${
                                            (mahasiswa.ipk || 0) >= 3.5
                                              ? 'bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-300'
                                              : (mahasiswa.ipk || 0) >= 3.0
                                                ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300'
                                                : (mahasiswa.ipk || 0) >= 2.5
                                                  ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-300'
                                                  : 'bg-red-100 text-red-700 dark:bg-red-900/20 dark:text-red-300'
                                          }`}
                                        >
                                          IPK {mahasiswa.ipk ? mahasiswa.ipk.toFixed(2) : 'N/A'}
                                        </span>
                                      </div>
                                      {showUnassignKelompokKecil && unassignMode[kelompok.id] && (
                                        <button
                                          onClick={() => handleUnassignMahasiswa(kelompok.id, mahasiswaId, 'kecil')}
                                          className="p-1.5 text-red-500 hover:text-red-700 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200"
                                          title="Unassign mahasiswa dari kelompok"
                                        >
                                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                          </svg>
                                        </button>
                                      )}
                                    </div>
                                  ) : null;
                                })}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
