export type StaffId =
  | 'raka-manager'
  | 'sinta-kasir'
  | 'dimas-chef'
  | 'nadia-snack-bar'
  | 'bima-server'
  | 'tania-inventory';

export interface RestaurantZone {
  id: string;
  name: string;
  capacityLabel: string;
  description: string;
  // Coordinates (%) over the architectural 3D floor plan image
  pinTop: string;
  pinLeft: string;
  assignedStaffIds: StaffId[];
}

export interface AiStaffProfile {
  id: StaffId;
  name: string;
  shortTitle: string;
  role: string;
  department: 'Manajemen' | 'Pelayanan Depan' | 'Dapur & Bar' | 'Stok & Kemasan';
  zoneId: string;
  zoneName: string;
  summary: string;
  jobdeskPoints: string[];
  quickCommands: string[];
}

export const RESTAURANT_ZONES: RestaurantZone[] = [
  {
    id: 'zone-mezzanine',
    name: 'Mezzanine Lantai 2',
    capacityLabel: '6 Meja · 24 Kursi',
    description: 'Area balkon kayu lantai atas untuk kelompok dan pengunjung yang ingin suasana lebih privat.',
    pinTop: '20%',
    pinLeft: '58%',
    assignedStaffIds: ['raka-manager', 'bima-server'],
  },
  {
    id: 'zone-kitchen-storage',
    name: 'Dapur Produksi & Gudang Stok',
    capacityLabel: 'Station Masak & Penyimpanan',
    description: 'Area dapur terbuka, rak pendingin bahan baku, dan pos persiapan kemasan Takeaway.',
    pinTop: '36%',
    pinLeft: '78%',
    assignedStaffIds: ['dimas-chef', 'tania-inventory'],
  },
  {
    id: 'zone-counter',
    name: 'Meja Kasir & Bar Minuman',
    capacityLabel: 'POS & Station Cemilan/Minuman',
    description: 'Pusat pemesanan, konfirmasi harga minuman kasir, peracikan minuman, dan penggorengan Cemilan Dayang.',
    pinTop: '49%',
    pinLeft: '57%',
    assignedStaffIds: ['sinta-kasir', 'nadia-snack-bar'],
  },
  {
    id: 'zone-indoor-timber',
    name: 'Booth Timber Lantai 1',
    capacityLabel: '8 Meja · 32 Kursi',
    description: 'Area makan utama dengan meja kayu panjang dan booth merah untuk makan bersama.',
    pinTop: '48%',
    pinLeft: '32%',
    assignedStaffIds: ['bima-server'],
  },
  {
    id: 'zone-outdoor-terrace',
    name: 'Teras Outdoor',
    capacityLabel: '10 Meja · 40 Kursi',
    description: 'Area teras terbuka di sepanjang fasad kaca dengan kursi hijau dan oranye yang santai.',
    pinTop: '77%',
    pinLeft: '24%',
    assignedStaffIds: ['bima-server'],
  },
];

export const AI_STAFF_PROFILES: AiStaffProfile[] = [
  {
    id: 'raka-manager',
    name: 'Raka Pratama',
    shortTitle: 'Kepala Restoran',
    role: 'Kepala Restoran & Manajer Operasional',
    department: 'Manajemen',
    zoneId: 'zone-mezzanine',
    zoneName: 'Mezzanine & Kontrol Lantai',
    summary:
      'Mengawasi kelancaran seluruh shift kedai, menjaga standar SOP, dan mengoptimalkan profitabilitas menu.',
    jobdeskPoints: [
      'Memantau kinerja omzet, HPP, dan laba kotor harian di setiap shift.',
      'Mengarahkan prioritas upselling margin tinggi (Keju Parut 60%, Pop Corn 60%, Kentang Goreng laba Rp 6.500).',
      'Mengatasi kendala operasional lintas station (Kasir, Dapur, Layanan Meja, dan Gudang).',
    ],
    quickCommands: [
      'Lakukan audit operasional dan evaluasi target profit shift hari ini',
      'Susun briefing koordinasi shift untuk seluruh tim MieLioner',
      'Buat rekomendasi paket bundling menu paling menguntungkan minggu ini',
    ],
  },
  {
    id: 'sinta-kasir',
    name: 'Sinta Maharani',
    shortTitle: 'Kasir & Frontliner',
    role: 'Kasir & Frontliner Pemesanan',
    department: 'Pelayanan Depan',
    zoneId: 'zone-counter',
    zoneName: 'Meja Kasir & Bar Depan',
    summary:
      'Menyambut pelanggan dengan ramah, mencatat pesanan Dine-in/Takeaway dengan akurat, dan melakukan upselling.',
    jobdeskPoints: [
      'Menyapa pelanggan dengan sapaan akrab "Kak" atau "Sobat MieLioner" dan membantu meracik pesanan.',
      'Menawarkan topping (Telor Goreng, Keju Leleh) serta minuman penyegar untuk pemesan Hot Maks.',
      'Memastikan tipe pesanan Dine-in vs Takeaway (+Rp 1.000 Packing) dan konfirmasi harga minuman kasir.',
    ],
    quickCommands: [
      'Layani pelanggan baru yang memesan 2 Mie Hot Maks Single dibungkus beserta rekomendasi upselling',
      'Buat skrip pelayanan cepat saat antrean kasir sedang ramai di jam makan siang',
      'Periksa daftar pesanan masuk dan pastikan biaya packing Takeaway sudah tepat',
    ],
  },
  {
    id: 'dimas-chef',
    name: 'Chef Dimas Wijaya',
    shortTitle: 'Koki Mie & Hot Maks',
    role: 'Koki Utama (Station Mie & Hot Maks)',
    department: 'Dapur & Bar',
    zoneId: 'zone-kitchen-storage',
    zoneName: 'Dapur Produksi Utama',
    summary:
      'Bertanggung jawab atas konsistensi rasa Mie Polos Goreng/Rebus dan takaran sambal pedas Hot Maks.',
    jobdeskPoints: [
      'Menyiapkan Mie Single dan Double sesuai antrean pesanan dengan tingkat kematangan seragam.',
      'Menjaga takaran bumbu pedas Hot Maks sesuai SOP (15 ml Single / 25 ml Double) tanpa pemborosan.',
      'Menjaga takaran gramasi Keju Parut (20 gr) dan Keju Leleh (30 ml) sebelum dikirim ke meja saji.',
    ],
    quickCommands: [
      'Susun urutan eksekusi masak antrean pesanan saat ini agar cepat dan rapi',
      'Laporkan checklist kepatuhan takaran bumbu Hot Maks dan gramasi keju hari ini',
      'Berikan panduan teknis mengurangi food waste di station mie saat jam sibuk',
    ],
  },
  {
    id: 'nadia-snack-bar',
    name: 'Nadia Putri',
    shortTitle: 'Bar & Cemilan Dayang',
    role: 'Spesialis Cemilan Dayang & Bar Minuman',
    department: 'Dapur & Bar',
    zoneId: 'zone-counter',
    zoneName: 'Bar Minuman & Fry Station',
    summary:
      'Mengelola penggorengan Cemilan Dayang sesuai suhu standar dan meracik minuman segar pendamping mie.',
    jobdeskPoints: [
      'Menggoreng Kentang (timbangan tepat 200 gr, 175°C 3m15d), Otak-Otak (5 pcs), Sosis Bakar Besar, dan Pop Corn.',
      'Meracik Te’ Manis, Creamy Latte, Goodday Cappucino, serta pesanan Milo, Indocafe, Mocacinno, dan Kopi Hitam.',
      'Menjaga kesegaran dan kecepatan saji minuman peredam pedas untuk pemesan Hot Maks.',
    ],
    quickCommands: [
      'Siapkan rencana batch produksi Cemilan Dayang agar tetap renyah tanpa sisa berlebih',
      'Verifikasi standar suhu penggorengan kentang 200gr dan otak-otak 5 pcs',
      'Siapkan rekomendasi racikan minuman pendamping untuk meja pelanggan berkelompok',
    ],
  },
  {
    id: 'bima-server',
    name: 'Bima Kusuma',
    shortTitle: 'Pramusaji Area Makan',
    role: 'Pramusaji & Koordinator Area Makan',
    department: 'Pelayanan Depan',
    zoneId: 'zone-indoor-timber',
    zoneName: 'Indoor Timber, Mezzanine & Teras',
    summary:
      'Mengantar hidangan hangat ke seluruh zona meja dan memastikan kenyamanan serta kebersihan area makan.',
    jobdeskPoints: [
      'Mengantar pesanan secara akurat ke Booth Timber Lantai 1, Mezzanine Lantai 2, dan Teras Outdoor.',
      'Melakukan table clearing cepat agar meja selalu siap untuk tamu berikutnya.',
      'Melayani permintaan tambahan pelanggan (sendok, tisu, tambahan topping/minuman) dengan sigap.',
    ],
    quickCommands: [
      'Lakukan inspeksi kesiapan meja di Booth Timber, Mezzanine Lantai 2, dan Teras Outdoor',
      'Atur rute pengantaran pesanan prioritas dari bar ke Mezzanine dan Teras saat ramai',
      'Tangani keluhan pelanggan yang menunggu pesanan lebih dari 10 menit dengan profesional',
    ],
  },
  {
    id: 'tania-inventory',
    name: 'Tania Lestari',
    shortTitle: 'Gudang, Stok & Packing',
    role: 'Petugas Gudang, Stok & Packing',
    department: 'Stok & Kemasan',
    zoneId: 'zone-kitchen-storage',
    zoneName: 'Gudang Bahan & Area Packing',
    summary:
      'Mengontrol ketersediaan bahan baku kritis, mengaudit pemakaian stok, dan menjaga stok kemasan Takeaway.',
    jobdeskPoints: [
      'Memantau sisa stok bahan kritis terutama Keju Cheddar Parut, Jagung Popcorn, dan Kentang Beku 200gr.',
      'Menghitung kebutuhan pengadaan ulang (Purchase Order) berdasarkan pemakaian porsi harian.',
      'Memastikan set kemasan Takeaway (box, kantong, alat makan) selalu siap dan sesuai biaya Rp 1.000/set.',
    ],
    quickCommands: [
      'Lakukan audit stok bahan kritis dan identifikasi item yang harus segera di-restok',
      'Buat daftar belanja pengadaan bahan baku (PO) untuk shift besok',
      'Evaluasi kesesuaian stok kemasan Takeaway terhadap jumlah pesanan dibungkus hari ini',
    ],
  },
];
