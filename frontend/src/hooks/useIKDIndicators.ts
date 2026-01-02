import { useState, useCallback } from "react";
import api from "../utils/api";

export interface IKDPedoman {
  id: number;
  no: string;
  kegiatan: string;
  indeks_poin?: number;
  unit_kerja?: string;
  bukti_fisik?: string;
  prosedur?: string;
  bidang: string;
  bidang_nama?: string;
  parent_id?: number;
  level: number;
  is_active: boolean;
}

export const useIKDIndicators = (pedomanList: IKDPedoman[]) => {
  // State untuk menyimpan parent items (level 0) untuk indicators
  const [parentItemsMap, setParentItemsMap] = useState<Map<number, IKDPedoman>>(
    new Map()
  );

  // Fetch parent items untuk indicators
  const fetchParentItems = useCallback(async () => {
    // Ambil semua parent_id yang unik dari sub-items
    const parentIds = [
      ...new Set(
        pedomanList
          .filter((item) => item.parent_id)
          .map((item) => item.parent_id)
      ),
    ] as number[];

    if (parentIds.length > 0) {
      // Fetch parent items berdasarkan parent_id
      try {
        const parentRes = await api.post("/rekap-ikd/pedoman-poin/parents", {
          ids: parentIds,
        });
        if (parentRes.data?.success && parentRes.data?.data) {
          const map = new Map<number, IKDPedoman>();
          parentRes.data.data.forEach((item: IKDPedoman) => {
            if (item.id) {
              map.set(item.id, item);
            }
          });
          setParentItemsMap(map);
        }
      } catch (err) {
        console.error("Error fetching parent items:", err);
      }
    }
  }, [pedomanList]);

  // Fungsi helper untuk cek apakah item punya isi
  const hasContent = (item: IKDPedoman): boolean => {
    // Cek indeks_poin: harus ada dan > 0 (bukan 0, null, atau undefined)
    const hasIndeksPoin =
      item.indeks_poin !== undefined &&
      item.indeks_poin !== null &&
      item.indeks_poin > 0;

    // Cek unit_kerja: harus string non-empty (bukan null, undefined, atau string kosong)
    const hasUnitKerja =
      item.unit_kerja &&
      typeof item.unit_kerja === "string" &&
      item.unit_kerja.trim().length > 0;

    // Cek bukti_fisik: harus string non-empty
    const hasBuktiFisik =
      item.bukti_fisik &&
      typeof item.bukti_fisik === "string" &&
      item.bukti_fisik.trim().length > 0;

    // Cek prosedur: harus string non-empty
    const hasProsedur =
      item.prosedur &&
      typeof item.prosedur === "string" &&
      item.prosedur.trim().length > 0;

    return hasIndeksPoin || hasUnitKerja || hasBuktiFisik || hasProsedur;
  };

  // Fungsi untuk mendapatkan indicator (judul) dari kegiatan
  const getIndicator = (kegiatan: IKDPedoman): string | null => {
    // Ambil nomor dari kegiatan (parse angka di awal, bisa dengan titik atau huruf)
    // Support format: "1.1.a", "2.1", "2.a", "1", dll
    const match = kegiatan.kegiatan.match(
      /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
    );
    if (!match) return null;

    let currentNumber = match[1]; // Misal: "1.1.a" atau "2.1" atau "2.a" atau "1"

    // Cek apakah item saat ini punya isi
    const itemHasContent = hasContent(kegiatan);

    // Jika item PUNYA isi → cari parent yang TIDAK punya isi (hanya punya kegiatan)
    // Jika item TIDAK punya isi → cari parent yang punya isi
    if (itemHasContent) {
      // Cek dulu: jika item ini adalah nomor utama (tidak ada titik, tidak ada huruf)
      // Misal: "5", "4", "1" (bukan "1.1", "1.1.a", "2.a")
      const isMainNumber =
        !currentNumber.includes(".") && !/[a-z]$/i.test(currentNumber);
      if (isMainNumber) {
        // Jika item utama punya isi, indicators = "-"
        return "-";
      }

      // Ambil parent number dulu (hapus bagian terakhir)
      let parentNumber = currentNumber;

      // Ambil parent number (hapus bagian terakhir)
      if (parentNumber.includes(".")) {
        const parts = parentNumber.split(".");
        if (parts.length > 1) {
          parts.pop();
          parentNumber = parts.join(".");
        } else {
          // Jika tidak ada parent, return "-"
          return "-";
        }
      } else if (/[a-z]$/i.test(parentNumber)) {
        // Jika berakhir dengan huruf (misal "2a"), hapus hurufnya jadi "2"
        parentNumber = parentNumber.replace(/[a-z]+$/i, "");
      } else {
        // Jika hanya angka (nomor utama), return "-"
        return "-";
      }

      // Cari parent yang TIDAK punya isi
      // Loop ke atas mencari parent yang tidak punya isi
      // Mulai dari parent langsung (jika ada parent_id), lalu loop ke parent berikutnya
      let currentParentId: number | null | undefined = kegiatan.parent_id;
      const checkedParentIds = new Set<number>();

      // Loop menggunakan parent_id (jika ada)
      while (currentParentId && !checkedParentIds.has(currentParentId)) {
        checkedParentIds.add(currentParentId);
        const parent = parentItemsMap.get(currentParentId);

        if (parent) {
          if (!hasContent(parent)) {
            // Parent tidak punya isi → return kegiatan parent ini
            return parent.kegiatan;
          } else {
            // Parent punya isi → lanjut ke parent berikutnya
            currentParentId = parent.parent_id;
          }
        } else {
          break;
        }
      }

      // Jika tidak ketemu dari parentItemsMap via parent_id, cari berdasarkan parsing nomor
      // Loop dari parentNumber ke atas sampai ketemu yang tidak punya isi
      let searchParentNumber = parentNumber;

      while (searchParentNumber) {
        // Cari dari parentItemsMap berdasarkan nomor
        const parentFromMap = Array.from(parentItemsMap.values()).find(
          (item) => {
            const itemMatch = item.kegiatan.match(
              /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
            );
            if (!itemMatch) return false;
            const itemNumber = itemMatch[1];
            // Match exact: "1.1" harus match dengan "1.1" saja, bukan "1.1.a" atau "1.1.b"
            if (searchParentNumber.includes(".")) {
              return (
                itemNumber === searchParentNumber && !itemNumber.match(/\.\w+$/)
              );
            } else {
              return (
                itemNumber === searchParentNumber && !itemNumber.includes(".")
              );
            }
          }
        );

        if (parentFromMap && !hasContent(parentFromMap)) {
          return parentFromMap.kegiatan;
        }

        // Cari dari pedomanList juga (fallback)
        const parentFromList = pedomanList.find((item) => {
          const itemMatch = item.kegiatan.match(
            /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
          );
          if (!itemMatch) return false;
          const itemNumber = itemMatch[1];
          if (searchParentNumber.includes(".")) {
            return (
              itemNumber === searchParentNumber && !itemNumber.match(/\.\w+$/)
            );
          } else {
            return (
              itemNumber === searchParentNumber && !itemNumber.includes(".")
            );
          }
        });

        if (parentFromList && !hasContent(parentFromList)) {
          return parentFromList.kegiatan;
        }

        // Ambil parent number berikutnya (hapus bagian terakhir)
        if (searchParentNumber.includes(".")) {
          const parts = searchParentNumber.split(".");
          if (parts.length > 1) {
            parts.pop();
            searchParentNumber = parts.join(".");
          } else {
            break;
          }
        } else if (/[a-z]$/i.test(searchParentNumber)) {
          searchParentNumber = searchParentNumber.replace(/[a-z]+$/i, "");
        } else {
          // Jika sampai nomor utama, cek apakah tidak punya isi
          const mainParent =
            parentItemsMap.size > 0
              ? Array.from(parentItemsMap.values()).find((item) => {
                  const itemMatch = item.kegiatan.match(
                    /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
                  );
                  if (!itemMatch) return false;
                  const itemNumber = itemMatch[1];
                  return (
                    itemNumber === searchParentNumber &&
                    !itemNumber.includes(".")
                  );
                })
              : null;

          if (mainParent && !hasContent(mainParent)) {
            return mainParent.kegiatan;
          }

          // Fallback ke pedomanList
          const mainParentFromList = pedomanList.find((item) => {
            const itemMatch = item.kegiatan.match(
              /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
            );
            if (!itemMatch) return false;
            const itemNumber = itemMatch[1];
            return (
              itemNumber === searchParentNumber && !itemNumber.includes(".")
            );
          });

          if (mainParentFromList && !hasContent(mainParentFromList)) {
            return mainParentFromList.kegiatan;
          }

          break;
        }
      }

      return "-";
    } else {
      // Jika item TIDAK punya isi, cari parent yang punya isi
      while (currentNumber) {
        // Cari parent di pedomanList
        const parent = pedomanList.find((item) => {
          // Parse nomor dari kegiatan item
          const itemMatch = item.kegiatan.match(
            /^(\d+(?:\.\d+)*(?:\.\w+)?|\d+\.\w+)/
          );
          if (!itemMatch) return false;

          const itemNumber = itemMatch[1];
          return itemNumber === currentNumber;
        });

        if (parent && hasContent(parent)) {
          // Return KEGIATAN dari parent yang punya isi (bukan nomornya)
          return parent.kegiatan;
        }

        // Ambil parent number (hapus bagian terakhir)
        if (currentNumber.includes(".")) {
          // Hapus bagian setelah titik terakhir
          const parts = currentNumber.split(".");
          if (parts.length > 1) {
            // Hapus bagian terakhir
            parts.pop();
            currentNumber = parts.join(".");
          } else {
            break;
          }
        } else if (/[a-z]$/i.test(currentNumber)) {
          currentNumber = currentNumber.replace(/[a-z]+$/i, "");
        } else {
          break;
        }
      }

      return "-";
    }
  };

  return {
    parentItemsMap,
    fetchParentItems,
    getIndicator,
    hasContent,
  };
};



