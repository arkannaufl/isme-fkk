export interface RuanganType {
  id: number;
  nama: string;
  kapasitas?: number;
  gedung?: string;
}

export const getRuanganOptions = (ruanganList: RuanganType[]) => {
  return ruanganList.map(r => ({ 
    value: r.id, 
    label: r.kapasitas ? `${r.nama} (Kapasitas: ${r.kapasitas} orang) - ${r.gedung || ''}` : r.nama 
  }));
};

export const getRuanganByCapacity = async (api: any, requiredCapacity: number = 0) => {
  try {
    const response = await api.get(`/ruangan/options?capacity=${requiredCapacity}`);
    const ruanganWithCapacity = response.data.map((r: any) => ({
      id: r.value,
      nama: r.label.split(' (Kapasitas:')[0], // Ambil nama saja tanpa kapasitas
      kapasitas: parseInt(r.label.match(/Kapasitas: (\d+)/)?.[1] || '0'),
      gedung: r.label.match(/- (.+)$/)?.[1] || ''
    }));
    return ruanganWithCapacity;
  } catch (err) {
    console.error('Error fetching ruangan by capacity:', err);
    return [];
  }
};
