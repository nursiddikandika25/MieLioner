import 'dotenv/config';
import crypto from 'crypto';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import {
  ORDER_STATUS_OPTIONS,
  PACKING_FEE,
  PUBLIC_MENU_ITEMS,
  TABLE_ZONE_OPTIONS,
  type AppMode,
  type OrderRecord,
  type OrderStatus,
  type OrderType,
} from './src/data/menuCatalog.ts';
import {
  AI_STAFF_PROFILES,
  type AiStaffProfile,
  type StaffId,
} from './src/data/restaurantStaff.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Confidential Management Database — NEVER served to customer endpoints or customer AI prompt
interface ManagementItemFinance {
  menuId: string;
  name: string;
  category: string;
  hpp: number | null; // null = HPP belum diinput / item kasir
  sellingPrice: number | null;
  grossProfit: number | null;
  marginPercent: number | null;
  highlightNote?: string;
}

const MANAGEMENT_FINANCE_DATA: ManagementItemFinance[] = [
  // MIE LIONER
  {
    menuId: 'mie-polos-single-goreng',
    name: 'Mie Lioner Polos Single (Goreng)',
    category: 'Mie Lioner',
    hpp: 4500,
    sellingPrice: 7000,
    grossProfit: 2500,
    marginPercent: 35.7,
  },
  {
    menuId: 'mie-polos-double-goreng',
    name: 'Mie Lioner Polos Double (Goreng)',
    category: 'Mie Lioner',
    hpp: 8000,
    sellingPrice: 13000,
    grossProfit: 5000,
    marginPercent: 38.5,
  },
  {
    menuId: 'mie-hot-maks-single',
    name: 'Mie Lioner Hot Maks (Goreng Single)',
    category: 'Mie Lioner',
    hpp: 6500,
    sellingPrice: 10000,
    grossProfit: 3500,
    marginPercent: 35.0,
  },
  {
    menuId: 'mie-hot-maks-double',
    name: 'Mie Lioner Hot Maks (Goreng Double)',
    category: 'Mie Lioner',
    hpp: 10000,
    sellingPrice: 16000,
    grossProfit: 6000,
    marginPercent: 37.5,
  },
  {
    menuId: 'mie-polos-single-rebus',
    name: 'Mie Lioner Polos Single (Rebus)',
    category: 'Mie Lioner',
    hpp: 4000,
    sellingPrice: 6500,
    grossProfit: 2500,
    marginPercent: 38.5,
  },
  {
    menuId: 'mie-polos-double-rebus',
    name: 'Mie Lioner Polos Double (Rebus)',
    category: 'Mie Lioner',
    hpp: 7000,
    sellingPrice: 11000,
    grossProfit: 4000,
    marginPercent: 36.4,
  },

  // TOPPING MIE
  {
    menuId: 'topping-telor-goreng',
    name: 'Telor Goreng',
    category: 'Topping Mie',
    hpp: 3000,
    sellingPrice: 5000,
    grossProfit: 2000,
    marginPercent: 40.0,
  },
  {
    menuId: 'topping-bakso-rebus',
    name: 'Bakso Rebus (2 Pcs)',
    category: 'Topping Mie',
    hpp: 2000,
    sellingPrice: 3000,
    grossProfit: 1000,
    marginPercent: 33.3,
  },
  {
    menuId: 'topping-sosis-goreng',
    name: 'Sosis Goreng (1 Pcs)',
    category: 'Topping Mie',
    hpp: 2500,
    sellingPrice: 4000,
    grossProfit: 1500,
    marginPercent: 37.5,
  },
  {
    menuId: 'topping-keju-parut',
    name: 'Keju Parut',
    category: 'Topping Mie',
    hpp: 2000,
    sellingPrice: 5000,
    grossProfit: 3000,
    marginPercent: 60.0,
    highlightNote: 'Margin Tertinggi di Kategori Topping',
  },
  {
    menuId: 'topping-keju-leleh',
    name: 'Keju Leleh',
    category: 'Topping Mie',
    hpp: 3500,
    sellingPrice: 6000,
    grossProfit: 2500,
    marginPercent: 41.7,
  },

  // CEMILAN DAYANG
  {
    menuId: 'cemilan-popcorn',
    name: 'Pop Corn Original',
    category: 'Cemilan Dayang',
    hpp: 2000,
    sellingPrice: 5000,
    grossProfit: 3000,
    marginPercent: 60.0,
    highlightNote: 'Margin Tertinggi di Kategori Camilan',
  },
  {
    menuId: 'cemilan-kentang-goreng',
    name: 'Kentang Goreng (200 Gram)',
    category: 'Cemilan Dayang',
    hpp: 8500,
    sellingPrice: 15000,
    grossProfit: 6500,
    marginPercent: 43.3,
    highlightNote: 'Nominal Laba Terbesar',
  },
  {
    menuId: 'cemilan-otak-otak',
    name: 'Otak-Otak Goreng (5 Pcs)',
    category: 'Cemilan Dayang',
    hpp: 6000,
    sellingPrice: 10000,
    grossProfit: 4000,
    marginPercent: 40.0,
  },
  {
    menuId: 'cemilan-sosis-bakar',
    name: 'Sosis Bakar Besar',
    category: 'Cemilan Dayang',
    hpp: 6000,
    sellingPrice: 10000,
    grossProfit: 4000,
    marginPercent: 40.0,
  },

  // MINUMAN & PACKING
  {
    menuId: 'minuman-sanqua',
    name: 'Sanqua',
    category: 'Minuman',
    hpp: 3000,
    sellingPrice: 4000,
    grossProfit: 1000,
    marginPercent: 25.0,
  },
  {
    menuId: 'minuman-te-manis',
    name: "Te' Manis",
    category: 'Minuman',
    hpp: null,
    sellingPrice: 5000,
    grossProfit: null,
    marginPercent: null,
    highlightNote: 'HPP belum diinput',
  },
  {
    menuId: 'minuman-goodday-cappucino',
    name: 'Goodday Cappucino',
    category: 'Minuman',
    hpp: null,
    sellingPrice: 5000,
    grossProfit: null,
    marginPercent: null,
    highlightNote: 'HPP belum diinput',
  },
  {
    menuId: 'minuman-creamy-latte',
    name: 'Creamy Latte',
    category: 'Minuman',
    hpp: null,
    sellingPrice: 5000,
    grossProfit: null,
    marginPercent: null,
    highlightNote: 'HPP belum diinput',
  },
  {
    menuId: 'minuman-milo',
    name: 'Milo',
    category: 'Minuman',
    hpp: null,
    sellingPrice: null,
    grossProfit: null,
    marginPercent: null,
    highlightNote: 'Harga jual & HPP belum ditetapkan',
  },
  {
    menuId: 'minuman-indocafe',
    name: 'Indocafe Coffee Mix',
    category: 'Minuman',
    hpp: null,
    sellingPrice: null,
    grossProfit: null,
    marginPercent: null,
    highlightNote: 'Harga jual & HPP belum ditetapkan',
  },
  {
    menuId: 'minuman-mocacinno',
    name: 'Goodday Mocacinno',
    category: 'Minuman',
    hpp: null,
    sellingPrice: null,
    grossProfit: null,
    marginPercent: null,
    highlightNote: 'Harga jual & HPP belum ditetapkan',
  },
  {
    menuId: 'minuman-kopi-hitam',
    name: 'Kopi Hitam',
    category: 'Minuman',
    hpp: null,
    sellingPrice: null,
    grossProfit: null,
    marginPercent: null,
    highlightNote: 'Harga jual & HPP belum ditetapkan',
  },
  {
    menuId: 'packing-takeaway',
    name: 'Packing (Takeaway/Bungkus)',
    category: 'Biaya Tambahan',
    hpp: 1000,
    sellingPrice: 1000,
    grossProfit: 0,
    marginPercent: 0.0,
    highlightNote: 'Break-even biaya kemasan',
  },
];

export interface IngredientStockItem {
  id: string;
  name: string;
  unit: string;
  openingStock: number;
  minThreshold: number;
  priorityNote: string;
  isHighMarginIngredient?: boolean;
}

const INITIAL_INGREDIENTS: IngredientStockItem[] = [
  {
    id: 'ing-mie',
    name: 'Mie Kering / Basah',
    unit: 'porsi single',
    openingStock: 120,
    minThreshold: 30,
    priorityNote: 'Single = 1 porsi, Double = 2 porsi mie',
  },
  {
    id: 'ing-telur',
    name: 'Telur Ayam Segar',
    unit: 'butir',
    openingStock: 45,
    minThreshold: 12,
    priorityNote: 'Untuk topping Telor Goreng',
  },
  {
    id: 'ing-bakso',
    name: 'Bakso Sapi',
    unit: 'butir',
    openingStock: 60,
    minThreshold: 16,
    priorityNote: '2 pcs per porsi topping Bakso Rebus',
  },
  {
    id: 'ing-sosis-kecil',
    name: 'Sosis Goreng',
    unit: 'pcs',
    openingStock: 40,
    minThreshold: 10,
    priorityNote: '1 pcs per porsi topping Sosis Goreng',
  },
  {
    id: 'ing-keju-parut',
    name: 'Keju Cheddar Blok (Parut)',
    unit: 'porsi takar',
    openingStock: 24,
    minThreshold: 10,
    priorityNote: 'Bahan topping margin tertinggi (60,0%) — wajib jaga stok',
    isHighMarginIngredient: true,
  },
  {
    id: 'ing-keju-leleh',
    name: 'Saus Keju Leleh',
    unit: 'porsi takar',
    openingStock: 28,
    minThreshold: 8,
    priorityNote: 'Margin 41,7%, populer untuk Hot Maks',
    isHighMarginIngredient: true,
  },
  {
    id: 'ing-kentang',
    name: 'Kentang Beku (Shoestring)',
    unit: 'pack 200gr',
    openingStock: 20,
    minThreshold: 6,
    priorityNote: 'Nominal laba terbesar (Rp 6.500/porsi) — timbang tepat 200gr',
    isHighMarginIngredient: true,
  },
  {
    id: 'ing-popcorn',
    name: 'Jagung Popcorn & Mentega',
    unit: 'porsi saji',
    openingStock: 22,
    minThreshold: 10,
    priorityNote: 'Margin tertinggi camilan (60,0%) — prioritaskan restok',
    isHighMarginIngredient: true,
  },
  {
    id: 'ing-otak-otak',
    name: 'Otak-Otak Ikan',
    unit: 'pcs',
    openingStock: 65,
    minThreshold: 20,
    priorityNote: '5 pcs per porsi Cemilan Dayang',
  },
  {
    id: 'ing-sosis-bakar',
    name: 'Sosis Bakar Jumbo',
    unit: 'pcs',
    openingStock: 25,
    minThreshold: 6,
    priorityNote: '1 pcs per porsi Sosis Bakar Besar',
  },
  {
    id: 'ing-packing',
    name: 'Kemasan Takeaway (Box + Kantong + Sendok)',
    unit: 'set',
    openingStock: 50,
    minThreshold: 15,
    priorityNote: 'Break-even Rp 1.000 per transaksi bungkus',
  },
];

const KITCHEN_SOPS = [
  {
    id: 'sop-hot-maks',
    title: 'Takaran Bumbu & Sambal Hot Maks',
    target: 'Konsistensi rasa pedas & kendali HPP sambal',
    steps: [
      'Gunakan sendok takar standar 15 ml untuk pasta cabai Hot Maks pada porsi Single (HPP Rp 6.500) dan tepat 25 ml (bukan 2x penuh) pada porsi Double (HPP Rp 10.000).',
      'Tumis bumbu dasar dan minyak bawang pada api sedang selama 15 detik sebelum memasukkan mie rebus tiris agar aroma keluar tanpa membakar cabai.',
      'Dilarang menambah cabai ekstra di luar takaran tanpa mencatat tambahan biaya bahan guna mencegah kebocoran margin.',
    ],
  },
  {
    id: 'sop-penggorengan',
    title: 'Durasi & Suhu Penggorengan Cemilan Dayang',
    target: 'Cegah gosong, penyusutan minyak, & food waste',
    steps: [
      'Kentang Goreng (200 gram): Timbang tepat 200 gr dalam kondisi beku (jangan melebihi 205 gr untuk menjaga HPP Rp 8.500). Goreng pada suhu 175°C selama 3 menit 15 detik hingga keemasan.',
      'Otak-Otak Goreng (5 pcs): Goreng pada suhu 170°C selama 2 menit 30 detik. Tiriskan di rak kawat minimal 30 detik agar tetap renyah dan hemat tisu minyak.',
      'Sosis Bakar Besar: Kerat 4 sisi sebelum dipanggang 3 menit dengan olesan saus tipis merata.',
    ],
  },
  {
    id: 'sop-topping-keju',
    title: 'Gramasi Topping Margin Tinggi & Packing',
    target: 'Lindungi margin 60% Keju Parut & efisiensi kemasan',
    steps: [
      'Keju Parut: Gunakan takaran 20 gr per porsi menggunakan cup ukur stainless (menjaga HPP Rp 2.000 dan margin 60,0%).',
      'Keju Leleh: Gunakan ladle takar 30 ml per porsi (HPP Rp 3.500), tuangkan di atas mie panas tepat sebelum disajikan.',
      'Packing Takeaway: 1 set kemasan (kertas nasi/box + sumpit/sendok + kantong) wajib dicatat 1x biaya packing Rp 1.000 agar biaya kemasan tetap impas (break-even).',
    ],
  },
];

// In-memory session state for orders & daily sales tracking
const sessionOrders: OrderRecord[] = [];
const dailyPortionsSold: Record<string, number> = {
  'mie-polos-single-goreng': 18,
  'mie-polos-double-goreng': 9,
  'mie-hot-maks-single': 24,
  'mie-hot-maks-double': 11,
  'mie-polos-single-rebus': 7,
  'mie-polos-double-rebus': 4,
  'topping-telor-goreng': 22,
  'topping-bakso-rebus': 12,
  'topping-sosis-goreng': 10,
  'topping-keju-parut': 16,
  'topping-keju-leleh': 14,
  'cemilan-popcorn': 14,
  'cemilan-kentang-goreng': 8,
  'cemilan-otak-otak': 9,
  'cemilan-sosis-bakar': 7,
  'minuman-te-manis': 26,
  'minuman-sanqua': 10,
  'minuman-goodday-cappucino': 8,
  'minuman-creamy-latte': 15,
  'packing-takeaway': 19,
};

const customStockAdjustments: Record<string, number> = {};

function calculateIngredientUsage(portions: Record<string, number>) {
  const usage: Record<string, number> = {
    'ing-mie':
      (portions['mie-polos-single-goreng'] || 0) +
      (portions['mie-hot-maks-single'] || 0) +
      (portions['mie-polos-single-rebus'] || 0) +
      2 *
        ((portions['mie-polos-double-goreng'] || 0) +
          (portions['mie-hot-maks-double'] || 0) +
          (portions['mie-polos-double-rebus'] || 0)),
    'ing-telur': portions['topping-telor-goreng'] || 0,
    'ing-bakso': 2 * (portions['topping-bakso-rebus'] || 0),
    'ing-sosis-kecil': portions['topping-sosis-goreng'] || 0,
    'ing-keju-parut': portions['topping-keju-parut'] || 0,
    'ing-keju-leleh': portions['topping-keju-leleh'] || 0,
    'ing-kentang': portions['cemilan-kentang-goreng'] || 0,
    'ing-popcorn': portions['cemilan-popcorn'] || 0,
    'ing-otak-otak': 5 * (portions['cemilan-otak-otak'] || 0),
    'ing-sosis-bakar': portions['cemilan-sosis-bakar'] || 0,
    'ing-packing': portions['packing-takeaway'] || 0,
  };

  return INITIAL_INGREDIENTS.map((item) => {
    const adjustedOpening = item.openingStock + (customStockAdjustments[item.id] || 0);
    const used = usage[item.id] || 0;
    const remaining = Math.max(0, adjustedOpening - used);
    let status: 'Aman' | 'Menipis' | 'Kritis' = 'Aman';
    if (remaining <= Math.ceil(item.minThreshold * 0.5)) {
      status = 'Kritis';
    } else if (remaining <= item.minThreshold) {
      status = 'Menipis';
    }
    return {
      ...item,
      openingStock: adjustedOpening,
      used,
      remaining,
      status,
    };
  });
}

function calculateDailyFinancialSummary(portions: Record<string, number>) {
  let totalGrossRevenue = 0;
  let totalHppUsed = 0;
  let totalGrossProfit = 0;
  let revenueWithKnownHpp = 0;
  let totalPortionsCount = 0;

  const breakdown = MANAGEMENT_FINANCE_DATA.map((item) => {
    const qty = Math.max(0, Math.floor(portions[item.menuId] || 0));
    const rev = item.sellingPrice !== null ? qty * item.sellingPrice : 0;
    const hpp = item.hpp !== null ? qty * item.hpp : 0;
    const profit =
      item.hpp !== null && item.sellingPrice !== null ? rev - hpp : 0;

    totalGrossRevenue += rev;
    if (item.hpp !== null && item.sellingPrice !== null) {
      totalHppUsed += hpp;
      totalGrossProfit += profit;
      revenueWithKnownHpp += rev;
    }
    if (item.menuId !== 'packing-takeaway') {
      totalPortionsCount += qty;
    }

    return {
      ...item,
      qty,
      revenue: rev,
      totalHpp: hpp,
      totalProfit: profit,
    };
  });

  const averageMarginPercent =
    revenueWithKnownHpp > 0 ? (totalGrossProfit / revenueWithKnownHpp) * 100 : 0;

  return {
    totalGrossRevenue,
    totalHppUsed,
    totalGrossProfit,
    revenueWithKnownHpp,
    averageMarginPercent,
    totalPortionsCount,
    breakdown,
  };
}

function detectManagementIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  if (normalized.includes('mode manajemen')) return true;
  const internalPatterns = [
    /\bhpp\b/i,
    /\bmargin\b/i,
    /\blaba kotor\b/i,
    /\bomzet\b/i,
    /\bprofit\b/i,
    /\brekap penjualan\b/i,
    /\banalisis keuangan\b/i,
    /\banalisis internal\b/i,
    /\bkontrol stok\b/i,
    /\bbahan kritis\b/i,
    /\bsop dapur\b/i,
  ];
  return internalPatterns.some((pattern) => pattern.test(message));
}

function detectCustomerIntent(message: string): boolean {
  const normalized = message.trim().toLowerCase();
  return normalized.includes('mode pelanggan');
}

function buildCustomerSystemInstruction(cartSummary?: string): string {
  return `Anda adalah asisten virtual cerdas untuk kedai mie kekinian bernama "MieLioner" dalam MODE PELANGGAN (Front-of-House).

GAYA KOMUNIKASI:
- Ramah, santai, akrab, menggugah selera. Gunakan sapaan seperti "Kak" atau "Sobat MieLioner".
- Gunakan Bahasa Indonesia yang natural dan profesional.
- Format semua nominal harga dengan Rupiah titik ribuan yang jelas (contoh: Rp 15.000).

INFORMASI BRAND MIELIONER:
- Konsep: Kedai mie kekinian dengan harga sangat terjangkau, pilihan porsi Single/Double, varian pedas (Hot Maks), beragam topping, serta camilan ("Cemilan Dayang").
- Kebijakan Tambahan: Pesanan dibungkus (Takeaway / Bungkus) dikenakan biaya Packing sebesar Rp 1.000 per transaksi/bungkus.

DATABASE MENU & HARGA JUAL MIELIONER:
A. MENU UTAMA (MIE LIONER):
1. Mie Lioner Polos Single (Goreng) : Rp 7.000
2. Mie Lioner Polos Double (Goreng) : Rp 13.000
3. Mie Lioner Hot Maks (Goreng Single) : Rp 10.000 (Varian Pedas)
4. Mie Lioner Hot Maks (Goreng Double) : Rp 16.000 (Varian Pedas Porsi Jumbo)
5. Mie Lioner Polos Single (Rebus) : Rp 6.500
6. Mie Lioner Polos Double (Rebus) : Rp 11.000

B. TOPPING MIE:
- Telor Goreng : Rp 5.000
- Bakso Rebus (2 Pcs) : Rp 3.000
- Sosis Goreng (1 Pcs) : Rp 4.000
- Keju Parut : Rp 5.000
- Keju Leleh : Rp 6.000

C. CEMILAN DAYANG:
- Pop Corn Original : Rp 5.000
- Kentang Goreng (200 Gram) : Rp 15.000
- Otak-Otak Goreng (5 Pcs) : Rp 10.000
- Sosis Bakar Besar : Rp 10.000

D. MINUMAN:
- Te' Manis : Rp 5.000
- Sanqua : Rp 4.000
- Goodday Cappucino : Rp 5.000
- Creamy Latte : Rp 5.000
- Milo : [Tersedia - harga dikonfirmasi langsung oleh kasir]
- Indocafe Coffee Mix : [Tersedia - harga dikonfirmasi langsung oleh kasir]
- Goodday Mocacinno : [Tersedia - harga dikonfirmasi langsung oleh kasir]
- Kopi Hitam : [Tersedia - harga dikonfirmasi langsung oleh kasir]

E. BIAYA TAMBAHAN:
- Packing (Khusus Takeaway/Bungkus) : Rp 1.000

ATURAN LAYANAN PELANGGAN:
1. Bantu Meracik Pesanan & Upselling:
   - Jika pelanggan memesan Mie Polos atau Hot Maks, selalu tawarkan topping yang cocok (misal: Telor Goreng Rp 5.000 atau Keju Leleh Rp 6.000).
   - Jika pelanggan memesan varian Hot Maks (pedas), tawarkan minuman penyegar seperti Te' Manis (Rp 5.000) atau Creamy Latte (Rp 5.000).
   - Tawarkan "Cemilan Dayang" (seperti Kentang Goreng atau Sosis Bakar Besar) jika pelanggan datang berkelompok atau ingin camilan pendamping.
2. Kalkulasi Pesanan:
   - Selalu tanyakan apakah pesanan untuk Makan di Tempat (Dine-in) atau Dibungkus (Takeaway).
   - Jika Dibungkus (Takeaway), wajib masukkan komponen Packing Rp 1.000 ke dalam rincian total harga.
   - Tampilkan rincian pesanan dalam bentuk daftar poin yang rapi beserta total harga akhirnya.
3. ATURAN KEAMANAN KETAT:
   - JANGAN PERNAH menyebut, mengira-ngira, atau membahas biaya modal (HPP), persentase margin, atau laba kotor kepada pelanggan.
   - Jika pelanggan menanyakan minuman yang harganya belum tercantum (Milo, Indocafe Coffee Mix, Goodday Mocacinno, Kopi Hitam), sampaikan dengan sopan bahwa varian tersebut tersedia dan harganya akan dikonfirmasi langsung oleh kasir.
   - Jika pengguna ingin masuk ke mode internal pengelola, arahkan untuk mengetik "MODE MANAJEMEN".

${cartSummary ? `KONTEKS KERANJANG PELANGGAN SAAT INI:\n${cartSummary}` : ''}`;
}

function buildManagementSystemInstruction(
  portions: Record<string, number>,
  stockList: ReturnType<typeof calculateIngredientUsage>
): string {
  const finance = calculateDailyFinancialSummary(portions);
  const lowStockItems = stockList
    .filter((s) => s.status !== 'Aman')
    .map((s) => `- ${s.name}: sisa ${s.remaining} ${s.unit} (${s.status})`)
    .join('\n');

  const soldSummaryLines = finance.breakdown
    .filter((b) => b.qty > 0)
    .map(
      (b) =>
        `- ${b.name}: ${b.qty} porsi | Omzet: Rp ${b.revenue.toLocaleString('id-ID')} | HPP: ${
          b.hpp !== null ? `Rp ${b.totalHpp.toLocaleString('id-ID')}` : 'Belum diinput'
        } | Laba: ${
          b.hpp !== null && b.sellingPrice !== null
            ? `Rp ${b.totalProfit.toLocaleString('id-ID')}`
            : '-'
        }`
    )
    .join('\n');

  return `Anda adalah manajer operasional & analis bisnis untuk kedai mie "MieLioner" dalam MODE MANAJEMEN (Back-of-House).

GAYA KOMUNIKASI:
- Analitis, ringkas, berbasis data HPP & margin aktual, tegas pada standar kualitas (SOP), dan berorientasi pada efisiensi biaya.
- Gunakan format mata uang Rupiah (Rp) dengan titik ribuan (contoh: Rp 15.000) dan daftar poin terstruktur agar mudah dibaca manajemen.

DATABASE HPP & MARGIN AKTUAL (KHUSUS MANAJEMEN):
[Format: Nama Menu | HPP | Harga Jual | Laba Kotor | Margin %]
MIE LIONER:
- Mie Lioner Polos Single (Goreng) | HPP: Rp 4.500 | Jual: Rp 7.000 | Laba: Rp 2.500 (35,7%)
- Mie Lioner Polos Double (Goreng) | HPP: Rp 8.000 | Jual: Rp 13.000 | Laba: Rp 5.000 (38,5%)
- Mie Lioner Hot Maks (Goreng Single) | HPP: Rp 6.500 | Jual: Rp 10.000 | Laba: Rp 3.500 (35,0%)
- Mie Lioner Hot Maks (Goreng Double) | HPP: Rp 10.000 | Jual: Rp 16.000 | Laba: Rp 6.000 (37,5%)
- Mie Lioner Polos Single (Rebus) | HPP: Rp 4.000 | Jual: Rp 6.500 | Laba: Rp 2.500 (38,5%)
- Mie Lioner Polos Double (Rebus) | HPP: Rp 7.000 | Jual: Rp 11.000 | Laba: Rp 4.000 (36,4%)

TOPPING MIE:
- Telor Goreng | HPP: Rp 3.000 | Jual: Rp 5.000 | Laba: Rp 2.000 (40,0%)
- Bakso Rebus (2 Pcs) | HPP: Rp 2.000 | Jual: Rp 3.000 | Laba: Rp 1.000 (33,3%)
- Sosis Goreng (1 Pcs) | HPP: Rp 2.500 | Jual: Rp 4.000 | Laba: Rp 1.500 (37,5%)
- Keju Parut | HPP: Rp 2.000 | Jual: Rp 5.000 | Laba: Rp 3.000 (60,0%) -> Margin Tertinggi di Kategori Topping
- Keju Leleh | HPP: Rp 3.500 | Jual: Rp 6.000 | Laba: Rp 2.500 (41,7%)

CEMILAN DAYANG:
- Pop Corn Original | HPP: Rp 2.000 | Jual: Rp 5.000 | Laba: Rp 3.000 (60,0%) -> Margin Tertinggi di Kategori Camilan
- Kentang Goreng (200 Gram) | HPP: Rp 8.500 | Jual: Rp 15.000 | Laba: Rp 6.500 (43,3%) -> Nominal Laba Terbesar
- Otak-Otak Goreng (5 Pcs) | HPP: Rp 6.000 | Jual: Rp 10.000 | Laba: Rp 4.000 (40,0%)
- Sosis Bakar Besar | HPP: Rp 6.000 | Jual: Rp 10.000 | Laba: Rp 4.000 (40,0%)

MINUMAN & PACKING:
- Sanqua | HPP: Rp 3.000 | Jual: Rp 4.000 | Laba: Rp 1.000 (25,0%)
- Te' Manis, Goodday Cappucino, Creamy Latte | Jual: Rp 5.000 (HPP belum diinput)
- Milo, Indocafe Coffee Mix, Goodday Mocacinno, Kopi Hitam | Harga jual & HPP belum diinput
- Packing | HPP: Rp 1.000 | Jual: Rp 1.000 | Laba: Rp 0 (Break-even biaya kemasan)

DATA PENJUALAN & STOK SESI HARI INI (LIVE):
- Total Omzet Kotor tercatat: Rp ${finance.totalGrossRevenue.toLocaleString('id-ID')}
- Total HPP Terpakai (item ber-HPP): Rp ${finance.totalHppUsed.toLocaleString('id-ID')}
- Total Laba Kotor (item ber-HPP): Rp ${finance.totalGrossProfit.toLocaleString('id-ID')} (Margin rata-rata: ${finance.averageMarginPercent.toFixed(1).replace('.', ',')}%)
- Rincian Porsi Terjual Saat Ini:
${soldSummaryLines || '(Belum ada penjualan tercatat)'}

STATUS STOK BAHAN KRITIS/MENIPIS:
${lowStockItems || 'Semua stok bahan baku utama dalam kondisi Aman.'}

ATURAN MODE MANAJEMEN:
1. Strategi Peningkatan Profit: Prioritaskan promosi & bundling pada item margin tinggi: Keju Parut (60,0%), Pop Corn Original (60,0%), dan Kentang Goreng (laba Rp 6.500/porsi).
2. Analisis Penjualan & Laba Harian: Jika pengguna memasukkan rekap jumlah porsi terjual baru di chat, hitung otomatis Total Omzet Kotor, Total HPP Terpakai, dan Total Laba Kotor (serta catat item minuman yang HPP-nya belum diinput secara terpisah agar akurat).
3. Kontrol Stok & Bahan Kritis: Pantau pemakaian bahan baku utama dan ingatkan pengadaan ulang terutama bila bahan topping margin tinggi (keju dan jagung popcorn) menipis.
4. Pembuatan SOP Dapur: Berikan panduan takaran bumbu pedas "Hot Maks" yang konsisten, durasi penggorengan kentang/otak-otak, dan standar penyajian untuk menekan food waste.`;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  const ai = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

  // Gemini 3.8 TTS features (speechConfig, speechMetadata, multiSpeakerVoiceConfig) require v1beta
  const aiTts = process.env.GEMINI_API_KEY
    ? new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        apiVersion: 'v1beta',
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      })
    : null;

  // Public customer menu endpoint (NO HPP / margin fields exposed)
  app.get('/api/menu', (_req, res) => {
    res.json({
      brand: 'MieLioner',
      packingFee: PACKING_FEE,
      items: PUBLIC_MENU_ITEMS,
    });
  });

  function buildOrderReportSummary(orders: OrderRecord[]) {
    let dineInCount = 0;
    let takeawayCount = 0;
    let pendingCount = 0;
    let cookingCount = 0;
    let readyCount = 0;
    let completedCount = 0;
    let totalOrderRevenue = 0;
    let totalPackingCollected = 0;

    for (const o of orders) {
      if (o.orderType === 'takeaway') takeawayCount += 1;
      else dineInCount += 1;

      if (o.status === 'Menunggu Diproses') pendingCount += 1;
      else if (o.status === 'Sedang Dimasak') cookingCount += 1;
      else if (o.status === 'Siap Disajikan') readyCount += 1;
      else if (o.status === 'Selesai') completedCount += 1;

      totalOrderRevenue += o.totalAmount;
      totalPackingCollected += o.packingFee;
    }

    return {
      totalOrders: orders.length,
      dineInCount,
      takeawayCount,
      pendingCount,
      cookingCount,
      readyCount,
      completedCount,
      totalOrderRevenue,
      totalPackingCollected,
    };
  }

  // Place customer order endpoint (generates scannable barcode & updates live daily sales/stock)
  app.post('/api/orders', (req, res) => {
    const body = req.body as {
      orderType?: OrderType;
      items?: Array<{ menuId: string; quantity: number }>;
      customerNote?: string;
      customerName?: string;
      tableZone?: string;
    };

    const orderType: OrderType =
      body.orderType === 'takeaway' ? 'takeaway' : 'dine-in';
    const rawItems = Array.isArray(body.items) ? body.items : [];

    if (rawItems.length === 0) {
      res.status(400).json({ error: 'Keranjang pesanan masih kosong.' });
      return;
    }

    const menuMap = new Map(PUBLIC_MENU_ITEMS.map((item) => [item.id, item]));
    const validatedItems: OrderRecord['items'] = [];
    let itemsTotal = 0;
    let hasKasirConfirmItems = false;

    for (const entry of rawItems) {
      if (!entry || typeof entry.menuId !== 'string') continue;
      const menu = menuMap.get(entry.menuId);
      const qty = Math.max(0, Math.min(99, Math.floor(Number(entry.quantity) || 0)));
      if (!menu || qty <= 0) continue;

      const subtotal = menu.price !== null ? menu.price * qty : 0;
      if (menu.price === null) hasKasirConfirmItems = true;
      itemsTotal += subtotal;

      validatedItems.push({
        menuId: menu.id,
        name: menu.name,
        unitPrice: menu.price,
        quantity: qty,
        subtotal,
      });

      dailyPortionsSold[menu.id] = (dailyPortionsSold[menu.id] || 0) + qty;
    }

    if (validatedItems.length === 0) {
      res.status(400).json({ error: 'Tidak ada item menu valid dalam pesanan.' });
      return;
    }

    const packingFee = orderType === 'takeaway' ? PACKING_FEE : 0;
    if (orderType === 'takeaway') {
      dailyPortionsSold['packing-takeaway'] =
        (dailyPortionsSold['packing-takeaway'] || 0) + 1;
    }

    const seqNum = sessionOrders.length + 101;
    const orderId = `ML-${seqNum}`;
    const randSuffix = crypto.randomInt(1000, 9999);
    const barcodeCode = `ML${seqNum}-${randSuffix}`;

    const cleanCustomerName =
      typeof body.customerName === 'string' && body.customerName.trim()
        ? body.customerName.trim().slice(0, 60)
        : undefined;

    const validZone =
      orderType === 'takeaway'
        ? 'Takeaway / Bungkus'
        : typeof body.tableZone === 'string' &&
          (TABLE_ZONE_OPTIONS as readonly string[]).includes(body.tableZone)
        ? body.tableZone
        : 'Area Kedai (Pilihan Kasir)';

    const order: OrderRecord = {
      id: orderId,
      barcodeCode,
      createdAt: new Date().toISOString(),
      orderType,
      status: 'Menunggu Diproses',
      customerName: cleanCustomerName,
      tableZone: validZone,
      items: validatedItems,
      packingFee,
      totalAmount: itemsTotal + packingFee,
      hasKasirConfirmItems,
      customerNote:
        typeof body.customerNote === 'string' && body.customerNote.trim()
          ? body.customerNote.slice(0, 200).trim()
          : undefined,
    };

    sessionOrders.unshift(order);
    res.status(201).json({ order });
  });

  // Public order list & order report summary (no HPP/margin data exposed)
  app.get('/api/orders', (req, res) => {
    const statusParam =
      typeof req.query.status === 'string' ? req.query.status.trim() : '';
    const queryParam =
      typeof req.query.q === 'string'
        ? req.query.q.trim().toLowerCase()
        : '';

    const filtered = sessionOrders.filter((o) => {
      const matchStatus =
        !statusParam ||
        statusParam === 'Semua' ||
        o.status === statusParam;
      const matchQuery =
        !queryParam ||
        o.id.toLowerCase().includes(queryParam) ||
        o.barcodeCode.toLowerCase().includes(queryParam) ||
        (o.customerName && o.customerName.toLowerCase().includes(queryParam));
      return matchStatus && matchQuery;
    });

    res.json({
      orders: filtered,
      summary: buildOrderReportSummary(sessionOrders),
    });
  });

  // Lookup / verify order by Barcode Code or Order ID
  app.get('/api/orders/lookup', (req, res) => {
    const rawCode =
      typeof req.query.code === 'string' ? req.query.code.trim() : '';
    if (!rawCode || rawCode.length > 60) {
      res.status(400).json({ error: 'Masukkan kode barcode atau ID order yang valid.' });
      return;
    }

    const normalized = rawCode.toUpperCase();
    const found = sessionOrders.find(
      (o) =>
        o.barcodeCode.toUpperCase() === normalized ||
        o.id.toUpperCase() === normalized
    );

    if (!found) {
      res.status(404).json({
        error: `Pesanan dengan kode barcode "${rawCode}" tidak ditemukan di sistem.`,
      });
      return;
    }

    res.json({ order: found });
  });

  // Update incoming order status (Kasir / Dapur / Manajemen workflow)
  app.patch('/api/orders/:id/status', (req, res) => {
    const targetId = String(req.params.id || '').trim().toUpperCase();
    const body = req.body as { status?: string };
    const nextStatus =
      typeof body.status === 'string' ? body.status.trim() : '';

    if (!ORDER_STATUS_OPTIONS.includes(nextStatus as OrderStatus)) {
      res.status(400).json({ error: 'Status pesanan tidak valid.' });
      return;
    }

    const order = sessionOrders.find((o) => o.id.toUpperCase() === targetId);
    if (!order) {
      res.status(404).json({ error: 'Nomor pesanan tidak ditemukan.' });
      return;
    }

    order.status = nextStatus as OrderStatus;
    res.json({
      order,
      summary: buildOrderReportSummary(sessionOrders),
    });
  });

  // Management endpoints (Back-of-House)
  app.get('/api/management/overview', (_req, res) => {
    const finance = calculateDailyFinancialSummary(dailyPortionsSold);
    const ingredients = calculateIngredientUsage(dailyPortionsSold);
    res.json({
      finance,
      ingredients,
      sops: KITCHEN_SOPS,
      portionsSold: dailyPortionsSold,
      recentOrders: sessionOrders.slice(0, 10),
      orders: sessionOrders,
      orderReportSummary: buildOrderReportSummary(sessionOrders),
    });
  });

  app.post('/api/management/sales-update', (req, res) => {
    const body = req.body as { portionsSold?: Record<string, number> };
    if (!body.portionsSold || typeof body.portionsSold !== 'object') {
      res.status(400).json({ error: 'Data porsi terjual tidak valid.' });
      return;
    }

    for (const item of MANAGEMENT_FINANCE_DATA) {
      if (item.menuId in body.portionsSold) {
        const val = Math.max(
          0,
          Math.min(5000, Math.floor(Number(body.portionsSold[item.menuId]) || 0))
        );
        dailyPortionsSold[item.menuId] = val;
      }
    }

    const finance = calculateDailyFinancialSummary(dailyPortionsSold);
    const ingredients = calculateIngredientUsage(dailyPortionsSold);
    res.json({
      finance,
      ingredients,
      portionsSold: dailyPortionsSold,
    });
  });

  app.post('/api/management/stock-restock', (req, res) => {
    const body = req.body as { ingredientId?: string; delta?: number };
    const validIds = new Set(INITIAL_INGREDIENTS.map((i) => i.id));
    if (
      !body.ingredientId ||
      !validIds.has(body.ingredientId) ||
      typeof body.delta !== 'number' ||
      !Number.isFinite(body.delta)
    ) {
      res.status(400).json({ error: 'Parameter stok tidak valid.' });
      return;
    }

    const delta = Math.max(-500, Math.min(500, Math.round(body.delta)));
    customStockAdjustments[body.ingredientId] =
      (customStockAdjustments[body.ingredientId] || 0) + delta;

    const ingredients = calculateIngredientUsage(dailyPortionsSold);
    res.json({ ingredients });
  });

  // Gemini AI Chat Endpoint
  app.post('/api/chat', async (req, res) => {
    const body = req.body as {
      message?: string;
      mode?: AppMode;
      history?: Array<{ role: 'user' | 'model'; text: string }>;
      cartSummary?: string;
    };

    const userMessage =
      typeof body.message === 'string' ? body.message.trim() : '';
    if (!userMessage) {
      res.status(400).json({ error: 'Pesan tidak boleh kosong.' });
      return;
    }

    let activeMode: AppMode =
      body.mode === 'management' ? 'management' : 'customer';
    let modeSwitched = false;

    if (detectCustomerIntent(userMessage)) {
      if (activeMode !== 'customer') modeSwitched = true;
      activeMode = 'customer';
    } else if (detectManagementIntent(userMessage)) {
      if (activeMode !== 'management') modeSwitched = true;
      activeMode = 'management';
    }

    if (!ai) {
      res.status(500).json({
        error:
          'Kunci Gemini API (GEMINI_API_KEY) belum terkonfigurasi pada server.',
      });
      return;
    }

    try {
      const stockSnapshot = calculateIngredientUsage(dailyPortionsSold);
      const systemInstruction =
        activeMode === 'management'
          ? buildManagementSystemInstruction(dailyPortionsSold, stockSnapshot)
          : buildCustomerSystemInstruction(
              typeof body.cartSummary === 'string' ? body.cartSummary : undefined
            );

      const safeHistory = Array.isArray(body.history)
        ? body.history
            .slice(-10)
            .filter(
              (h) =>
                h &&
                (h.role === 'user' || h.role === 'model') &&
                typeof h.text === 'string' &&
                h.text.trim().length > 0
            )
            .map((h) => ({
              role: h.role,
              parts: [{ text: h.text.slice(0, 2000) }],
            }))
        : [];

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          ...safeHistory,
          { role: 'user', parts: [{ text: userMessage.slice(0, 2000) }] },
        ],
        config: {
          systemInstruction,
        },
      });

      const replyText =
        response.text?.trim() ||
        'Maaf, saya belum dapat memproses permintaan tersebut saat ini.';

      res.json({
        reply: replyText,
        activeMode,
        modeSwitched,
      });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Terjadi kesalahan pada layanan AI.';
      console.error('Gemini API Error:', message);
      res.status(502).json({
        error: `Gagal terhubung ke Asisten Gemini: ${message}`,
      });
    }
  });

  // Virtual Restaurant AI Staff Status, Editable Names & Jobdesk Execution
  const customStaffNames: Partial<Record<StaffId, string>> = {};

  function getResolvedStaffProfiles(): AiStaffProfile[] {
    return AI_STAFF_PROFILES.map((staff) => ({
      ...staff,
      name: customStaffNames[staff.id] || staff.name,
    }));
  }

  function getResolvedStaffName(id: StaffId): string {
    const custom = customStaffNames[id];
    if (custom) return custom;
    return AI_STAFF_PROFILES.find((s) => s.id === id)?.name || id;
  }

  const staffExecutionLogs: Array<{
    id: string;
    staffId: StaffId | 'all-team';
    staffName: string;
    role: string;
    instruction: string;
    output: string;
    executedAt: string;
  }> = [];

  app.get('/api/staff/status', (_req, res) => {
    const stockList = calculateIngredientUsage(dailyPortionsSold);
    const lowStockCount = stockList.filter((s) => s.status !== 'Aman').length;

    res.json({
      zoneOccupancy: {
        'zone-mezzanine': { occupiedTables: 3, totalTables: 6 },
        'zone-indoor-timber': { occupiedTables: 5, totalTables: 8 },
        'zone-outdoor-terrace': { occupiedTables: 6, totalTables: 10 },
        'zone-counter': { occupiedTables: sessionOrders.length, totalTables: 0 },
        'zone-kitchen-storage': {
          occupiedTables: lowStockCount,
          totalTables: stockList.length,
        },
      },
      activeOrdersCount: sessionOrders.length,
      recentOrders: sessionOrders.slice(0, 5),
      logs: staffExecutionLogs.slice(0, 15),
      staffProfiles: getResolvedStaffProfiles(),
    });
  });

  app.patch('/api/staff/:id', (req, res) => {
    const rawId = String(req.params.id || '').trim() as StaffId;
    const baseProfile = AI_STAFF_PROFILES.find((s) => s.id === rawId);
    if (!baseProfile) {
      res.status(404).json({ error: 'Data pegawai tidak ditemukan.' });
      return;
    }

    const body = req.body as { name?: unknown; reset?: boolean };
    if (body.reset === true) {
      delete customStaffNames[rawId];
      const updated = getResolvedStaffProfiles();
      const staff = updated.find((s) => s.id === rawId)!;
      res.json({ staff, staffProfiles: updated });
      return;
    }

    if (typeof body.name !== 'string') {
      res.status(400).json({ error: 'Nama pegawai harus berupa teks.' });
      return;
    }

    const cleanedName = body.name
      .replace(/[\u0000-\u001F\u007F<>]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

    if (cleanedName.length < 2 || cleanedName.length > 50) {
      res.status(400).json({
        error: 'Nama pegawai harus terdiri dari 2 hingga 50 karakter.',
      });
      return;
    }

    if (cleanedName === baseProfile.name) {
      delete customStaffNames[rawId];
    } else {
      customStaffNames[rawId] = cleanedName;
    }

    const updated = getResolvedStaffProfiles();
    const staff = updated.find((s) => s.id === rawId)!;
    res.json({ staff, staffProfiles: updated });
  });

  app.post('/api/staff/execute', async (req, res) => {
    const body = req.body as {
      staffId?: StaffId | 'all-team';
      instruction?: string;
      mode?: AppMode;
    };

    const instruction =
      typeof body.instruction === 'string' ? body.instruction.trim() : '';
    if (!instruction) {
      res.status(400).json({ error: 'Instruksi tugas karyawan tidak boleh kosong.' });
      return;
    }

    const activeMode: AppMode =
      body.mode === 'management' ? 'management' : 'customer';

    const resolvedProfiles = getResolvedStaffProfiles();
    const staffProfile =
      body.staffId === 'all-team'
        ? null
        : resolvedProfiles.find((s) => s.id === body.staffId);

    if (body.staffId !== 'all-team' && !staffProfile) {
      res.status(400).json({ error: 'Karyawan AI yang dipilih tidak valid.' });
      return;
    }

    if (!ai) {
      res.status(500).json({
        error:
          'Kunci Gemini API (GEMINI_API_KEY) belum terkonfigurasi pada server.',
      });
      return;
    }

    try {
      const stockSnapshot = calculateIngredientUsage(dailyPortionsSold);
      const finance = calculateDailyFinancialSummary(dailyPortionsSold);

      const recentOrdersText =
        sessionOrders.length > 0
          ? sessionOrders
              .slice(0, 5)
              .map(
                (o) =>
                  `- Order ${o.id} (${
                    o.orderType === 'takeaway' ? 'Takeaway/Bungkus' : 'Dine-in'
                  }): ${o.items
                    .map((i) => `${i.quantity}x ${i.name}`)
                    .join(', ')} | Total Rp ${o.totalAmount.toLocaleString('id-ID')}`
              )
              .join('\n')
          : 'Belum ada pesanan baru masuk dari pelanggan di sesi ini.';

      const publicMenuSummary = PUBLIC_MENU_ITEMS.map(
        (m) =>
          `- ${m.name} (${m.category}): ${
            m.price !== null
              ? `Rp ${m.price.toLocaleString('id-ID')}`
              : 'Harga dikonfirmasi kasir'
          }`
      ).join('\n');

      const sopSummary = KITCHEN_SOPS.map(
        (sop) => `- ${sop.title}: ${sop.steps.join(' ')}`
      ).join('\n');

      const stockStatusSummary = stockSnapshot
        .map(
          (s) =>
            `- ${s.name}: sisa ${s.remaining} ${s.unit} (Status: ${s.status})`
        )
        .join('\n');

      // Confidential HPP & profit metrics are ONLY injected when activeMode === 'management'
      // and never for front-of-house customer-facing roles.
      const allowConfidentialMetrics =
        activeMode === 'management' &&
        (!staffProfile ||
          (staffProfile.id !== 'sinta-kasir' &&
            staffProfile.id !== 'bima-server'));

      const confidentialBlock = allowConfidentialMetrics
        ? `\nDATA INTERNAL HPP, MARGIN & REKAP HARI INI (KHUSUS MANAJEMEN):\n- Total Omzet Kotor: Rp ${finance.totalGrossRevenue.toLocaleString(
            'id-ID'
          )}\n- Total HPP Terpakai: Rp ${finance.totalHppUsed.toLocaleString(
            'id-ID'
          )}\n- Total Laba Kotor: Rp ${finance.totalGrossProfit.toLocaleString(
            'id-ID'
          )} (Margin rata-rata ${finance.averageMarginPercent
            .toFixed(1)
            .replace('.', ',')}%)\n- Item Margin Tertinggi: Keju Parut (HPP Rp 2.000, Jual Rp 5.000, Margin 60,0%), Pop Corn Original (HPP Rp 2.000, Jual Rp 5.000, Margin 60,0%), Kentang Goreng 200gr (HPP Rp 8.500, Jual Rp 15.000, Laba Rp 6.500 / 43,3%).\n- Minuman HPP belum diinput: Te' Manis, Goodday Cappucino, Creamy Latte (Jual Rp 5.000).`
        : `\nATURAN KEAMANAN KETAT: JANGAN PERNAH menyebut angka modal (HPP), persentase margin, atau laba kotor dalam laporan/jawaban Anda.`;

      const personaHeader = staffProfile
        ? `Anda adalah ${staffProfile.name}, bertugas sebagai ${staffProfile.role} di kedai mie "MieLioner" (Station: ${staffProfile.zoneName}).\nTanggung jawab utama Anda:\n${staffProfile.jobdeskPoints
            .map((j) => `- ${j}`)
            .join('\n')}`
        : `Anda adalah Koordinator Briefing Tim "MieLioner" yang merangkum laporan eksekusi profesional dari 6 karyawan AI: ${resolvedProfiles
            .map((p) => `${p.name} (${p.shortTitle})`)
            .join(', ')}.`;

      const staffSystemInstruction = `${personaHeader}

GAYA EKSEKUSI PROFESIONAL:
- Jawab dengan bahasa Indonesia yang rapi, terstruktur, profesional, dan langsung mengeksekusi perintah kerja (bukan basa-basi).
- Cantumkan langkah kerja nyata, rincian angka Rupiah dengan titik ribuan (contoh: Rp 15.000), dan status hasil pekerjaan secara jelas.
- Biaya Packing khusus Takeaway adalah Rp 1.000. Minuman Milo, Indocafe Coffee Mix, Goodday Mocacinno, dan Kopi Hitam dikonfirmasi langsung oleh kasir.

MENU PUBLIK MIELIONER:
${publicMenuSummary}

SOP DAPUR & PENYAJIAN:
${sopSummary}

STATUS STOK BAHAN SAAT INI:
${stockStatusSummary}

ANTREAN PESANAN SESI TERBARU:
${recentOrdersText}
${confidentialBlock}`;

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          {
            role: 'user',
            parts: [{ text: instruction.slice(0, 1500) }],
          },
        ],
        config: {
          systemInstruction: staffSystemInstruction,
        },
      });

      const output =
        response.text?.trim() ||
        'Tugas telah diterima dan siap dijalankan sesuai SOP MieLioner.';

      const logEntry = {
        id: `task-${Date.now()}`,
        staffId: (staffProfile ? staffProfile.id : 'all-team') as
          | StaffId
          | 'all-team',
        staffName: staffProfile ? staffProfile.name : 'Seluruh Tim MieLioner',
        role: staffProfile
          ? staffProfile.role
          : 'Briefing & Koordinasi Lintas Divisi',
        instruction,
        output,
        executedAt: new Date().toISOString(),
      };

      staffExecutionLogs.unshift(logEntry);
      if (staffExecutionLogs.length > 30) {
        staffExecutionLogs.length = 30;
      }

      res.json({ log: logEntry });
    } catch (err: unknown) {
      const message =
        err instanceof Error
          ? err.message
          : 'Gagal mengeksekusi tugas karyawan AI.';
      console.error('Staff Execute Gemini Error:', message);
      res.status(502).json({
        error: `Karyawan AI gagal merespons: ${message}`,
      });
    }
  });

  // Voice & Live Restaurant Conversation Endpoints (Gemini TTS)
  type VoiceSpeakerId =
    | StaffId
    | 'all-team'
    | 'visitor-male'
    | 'visitor-female'
    | 'visitor';

  type PrebuiltVoiceName = 'Puck' | 'Charon' | 'Kore' | 'Fenrir' | 'Zephyr';

  type DialogueScenario =
    | 'order_kasir'
    | 'kitchen_prep'
    | 'snack_bar_sync'
    | 'table_service'
    | 'warehouse_sync'
    | 'random';

  const SPEAKER_VOICE_MAP: Record<
    VoiceSpeakerId,
    { voiceName: PrebuiltVoiceName; defaultStyle: string; displayName: string; roleLabel: string }
  > = {
    'raka-manager': {
      voiceName: 'Charon',
      defaultStyle: 'Tenang, berwibawa, profesional sebagai kepala restoran Indonesia',
      displayName: 'Raka Pratama',
      roleLabel: 'Kepala Restoran',
    },
    'sinta-kasir': {
      voiceName: 'Kore',
      defaultStyle: 'Ramah, hangat, ceria menyambut pelanggan di kasir',
      displayName: 'Sinta Maharani',
      roleLabel: 'Kasir & Frontliner',
    },
    'dimas-chef': {
      voiceName: 'Fenrir',
      defaultStyle: 'Energik, sigap, mantap dari dapur produksi',
      displayName: 'Chef Dimas Wijaya',
      roleLabel: 'Koki Mie & Hot Maks',
    },
    'nadia-snack-bar': {
      voiceName: 'Zephyr',
      defaultStyle: 'Cekatan, ceria, ramah di bar minuman dan cemilan',
      displayName: 'Nadia Putri',
      roleLabel: 'Bar & Cemilan Dayang',
    },
    'bima-server': {
      voiceName: 'Puck',
      defaultStyle: 'Sopan, ringan, cepat tanggap melayani tamu meja',
      displayName: 'Bima Kusuma',
      roleLabel: 'Pramusaji Area Makan',
    },
    'tania-inventory': {
      voiceName: 'Kore',
      defaultStyle: 'Rapi, teliti, informatif melaporkan stok gudang dan packing',
      displayName: 'Tania Lestari',
      roleLabel: 'Gudang, Stok & Packing',
    },
    'all-team': {
      voiceName: 'Charon',
      defaultStyle: 'Profesional, jelas, koordinasi briefing tim restoran',
      displayName: 'Tim MieLioner',
      roleLabel: 'Koordinasi Lintas Divisi',
    },
    'visitor-male': {
      voiceName: 'Puck',
      defaultStyle: 'Santai, antusias, ramah sebagai pengunjung kedai mie',
      displayName: 'Pengunjung',
      roleLabel: 'Pelanggan MieLioner',
    },
    'visitor-female': {
      voiceName: 'Zephyr',
      defaultStyle: 'Santai, ceria, penasaran memilih menu dan topping',
      displayName: 'Pengunjung',
      roleLabel: 'Pelanggan MieLioner',
    },
    visitor: {
      voiceName: 'Puck',
      defaultStyle: 'Santai, ramah sebagai pelanggan kedai mie',
      displayName: 'Pengunjung',
      roleLabel: 'Pelanggan MieLioner',
    },
  };

  const ttsCache = new Map<string, string>();

  function cleanTextForSpeech(raw: string): string {
    return raw
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/[*_`#>-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 520);
  }

  app.post('/api/voice/tts', async (req, res) => {
    const body = req.body as {
      text?: string;
      speakerId?: string;
      style?: string;
    };

    const rawText = typeof body.text === 'string' ? body.text.trim() : '';
    if (!rawText) {
      res.status(400).json({ error: 'Teks suara tidak boleh kosong.' });
      return;
    }
    if (rawText.length > 2500) {
      res.status(400).json({ error: 'Teks suara terlalu panjang.' });
      return;
    }

    const speakerKey: VoiceSpeakerId =
      typeof body.speakerId === 'string' && body.speakerId in SPEAKER_VOICE_MAP
        ? (body.speakerId as VoiceSpeakerId)
        : 'sinta-kasir';

    const voiceProfile = SPEAKER_VOICE_MAP[speakerKey];
    const spokenText = cleanTextForSpeech(rawText);
    const styleInstruction =
      typeof body.style === 'string' && body.style.trim()
        ? body.style.trim().slice(0, 140)
        : voiceProfile.defaultStyle;

    const cacheKey = `${voiceProfile.voiceName}|${styleInstruction}|${spokenText}`;
    const cachedAudio = ttsCache.get(cacheKey);
    if (cachedAudio) {
      res.json({
        audioBase64: cachedAudio,
        mimeType: 'audio/wav',
        voiceName: voiceProfile.voiceName,
      });
      return;
    }

    if (!aiTts) {
      res.status(500).json({
        error:
          'Kunci Gemini API (GEMINI_API_KEY) belum terkonfigurasi pada server.',
      });
      return;
    }

    try {
      const response = await aiTts.models.generateContent({
        model: 'gemini-3.8-flash-lite-tts',
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: spokenText,
                speechMetadata: {
                  style: styleInstruction,
                },
              },
            ],
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: voiceProfile.voiceName,
              },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({
          error: 'Layanan suara Gemini tidak mengembalikan audio.',
        });
        return;
      }

      if (ttsCache.size >= 60) {
        const firstKey = ttsCache.keys().next().value;
        if (firstKey) ttsCache.delete(firstKey);
      }
      ttsCache.set(cacheKey, base64Audio);

      res.json({
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
        voiceName: voiceProfile.voiceName,
      });
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error
          ? err.message
          : 'Gagal menghasilkan suara Gemini TTS.';
      const isQuota =
        rawMessage.includes('429') ||
        rawMessage.includes('RESOURCE_EXHAUSTED') ||
        rawMessage.toLowerCase().includes('quota');

      if (isQuota) {
        console.warn('Gemini TTS quota limit reached (429).');
        res.status(429).json({
          quotaExceeded: true,
          error:
            'Kuota harian Gemini TTS Free Tier (10 permintaan/hari) sedang habis. Tunggu beberapa saat atau gunakan kunci API berbayar di panel Settings > Secrets.',
        });
        return;
      }

      console.error('Gemini TTS Error:', rawMessage);
      res.status(502).json({
        error: `Gagal menghasilkan suara: ${rawMessage}`,
      });
    }
  });

  app.post('/api/voice/dialogue', async (req, res) => {
    const body = req.body as {
      scenario?: DialogueScenario;
      mode?: AppMode;
      customContext?: string;
    };

    if (!ai) {
      res.status(500).json({
        error:
          'Kunci Gemini API (GEMINI_API_KEY) belum terkonfigurasi pada server.',
      });
      return;
    }

    const activeMode: AppMode =
      body.mode === 'management' ? 'management' : 'customer';

    const scenarioPool: Exclude<DialogueScenario, 'random'>[] = [
      'order_kasir',
      'kitchen_prep',
      'snack_bar_sync',
      'table_service',
      'warehouse_sync',
    ];

    const requestedScenario =
      typeof body.scenario === 'string' &&
      (scenarioPool.includes(body.scenario as Exclude<DialogueScenario, 'random'>) ||
        body.scenario === 'random')
        ? body.scenario
        : 'random';

    const chosenScenario: Exclude<DialogueScenario, 'random'> =
      requestedScenario === 'random'
        ? scenarioPool[Math.floor(Math.random() * scenarioPool.length)]
        : (requestedScenario as Exclude<DialogueScenario, 'random'>);

    const rakaName = getResolvedStaffName('raka-manager');
    const sintaName = getResolvedStaffName('sinta-kasir');
    const dimasName = getResolvedStaffName('dimas-chef');
    const nadiaName = getResolvedStaffName('nadia-snack-bar');
    const bimaName = getResolvedStaffName('bima-server');
    const taniaName = getResolvedStaffName('tania-inventory');

    const scenarioConfigs: Record<
      Exclude<DialogueScenario, 'random'>,
      {
        title: string;
        speakerA: VoiceSpeakerId;
        speakerB: VoiceSpeakerId;
        voiceA: PrebuiltVoiceName;
        voiceB: PrebuiltVoiceName;
        promptGoal: string;
      }
    > = {
      order_kasir: {
        title: `Kasir ${sintaName} & Pengunjung`,
        speakerA: 'visitor',
        speakerB: 'sinta-kasir',
        voiceA: 'Puck',
        voiceB: 'Kore',
        promptGoal: `Percakapan hangat di Meja Kasir saat pengunjung baru datang memesan Mie Lioner (Polos atau Hot Maks). ${sintaName} menyapa dengan "Kak", menawarkan topping Telor Goreng (Rp 5.000) atau Keju Leleh (Rp 6.000) serta minuman Te' Manis / Creamy Latte (Rp 5.000), dan menanyakan makan di tempat atau dibungkus (+Packing Rp 1.000).`,
      },
      kitchen_prep: {
        title: `Kasir ${sintaName} & ${dimasName}`,
        speakerA: 'sinta-kasir',
        speakerB: 'dimas-chef',
        voiceA: 'Kore',
        voiceB: 'Fenrir',
        promptGoal: `Koordinasi sigap antara Kasir ${sintaName} yang meneruskan pesanan baru Mie Lioner Hot Maks Double & Polos Goreng ke ${dimasName} di Dapur Produksi. ${dimasName} mengonfirmasi takaran sambal Hot Maks (15 ml Single / 25 ml Double) dan keju siap masak sesuai SOP.`,
      },
      snack_bar_sync: {
        title: `Bar ${nadiaName} & Pramusaji ${bimaName}`,
        speakerA: 'nadia-snack-bar',
        speakerB: 'bima-server',
        voiceA: 'Zephyr',
        voiceB: 'Puck',
        promptGoal: `Percakapan cepat penuh semangat di Bar Minuman antara ${nadiaName} yang baru mengangkat Kentang Goreng 200gr & Otak-Otak Goreng serta meracik Te' Manis / Creamy Latte, dan ${bimaName} yang siap mengantarkan ke meja Booth Timber atau Mezzanine.`,
      },
      table_service: {
        title: `Pramusaji ${bimaName} & Pengunjung Meja`,
        speakerA: 'bima-server',
        speakerB: 'visitor-female',
        voiceA: 'Puck',
        voiceB: 'Zephyr',
        promptGoal: `${bimaName} mengantarkan MieLioner hangat ke meja pengunjung di Booth Timber / Teras Outdoor dengan ramah, menanyakan apakah ada tambahan topping atau minuman, dan pengunjung memuji aroma mie dan pelayanan cepat kedai.`,
      },
      warehouse_sync: {
        title: `Kepala Restoran ${rakaName} & Gudang ${taniaName}`,
        speakerA: 'raka-manager',
        speakerB: 'tania-inventory',
        voiceA: 'Charon',
        voiceB: 'Kore',
        promptGoal: `Koordinasi operasional antara Kepala Restoran ${rakaName} dan Petugas Gudang ${taniaName} mengenai kesiapan stok Keju Cheddar Parut, Jagung Popcorn, Kentang Beku 200gr, dan kemasan Takeaway (+Rp 1.000/set).`,
      },
    };

    const cfg = scenarioConfigs[chosenScenario];
    const resolveVoiceSpeaker = (sid: VoiceSpeakerId) => {
      const base = SPEAKER_VOICE_MAP[sid];
      if (sid in customStaffNames || AI_STAFF_PROFILES.some((s) => s.id === sid)) {
        return {
          ...base,
          displayName: getResolvedStaffName(sid as StaffId),
        };
      }
      return base;
    };
    const profA = resolveVoiceSpeaker(cfg.speakerA);
    const profB = resolveVoiceSpeaker(cfg.speakerB);

    const customCtx =
      typeof body.customContext === 'string' && body.customContext.trim()
        ? `\nKonteks tambahan: ${body.customContext.trim().slice(0, 200)}`
        : '';

    const securityGuard =
      activeMode === 'management' && chosenScenario === 'warehouse_sync'
        ? 'Boleh menyebut kesiapan stok dan prioritas item unggulan (Keju Parut 60%, Pop Corn 60%, Kentang Goreng laba Rp 6.500), namun tetap singkat dan natural.'
        : 'ATURAN KETAT: DILARANG menyebut HPP, harga modal, laba kotor, atau persentase margin. Gunakan hanya harga jual publik dan suasana kedai.';

    try {
      const scriptPrompt = `Buat skenario percakapan restoran yang hidup, alami, santai, dan khas kedai mie "MieLioner" di Indonesia dalam 4 giliran bicara singkat (masing-masing 1-2 kalimat pendek, total sekitar 55-75 kata agar nyaman didengar).
Pembicara 1: "${profA.displayName}" (${profA.roleLabel}, id: "${cfg.speakerA}")
Pembicara 2: "${profB.displayName}" (${profB.roleLabel}, id: "${cfg.speakerB}")
Situasi: ${cfg.promptGoal}${customCtx}
${securityGuard}

Pastikan giliran bicara bergantian antara Pembicara 1 dan Pembicara 2, menyebutkan detail menu MieLioner yang autentik bila relevan, dan terdengar natural seperti percakapan nyata di kedai.`;

      const scriptResp = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [{ role: 'user', parts: [{ text: scriptPrompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              lines: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    speakerSlot: {
                      type: Type.STRING,
                      enum: ['A', 'B'],
                    },
                    text: { type: Type.STRING },
                    style: { type: Type.STRING },
                  },
                  required: ['speakerSlot', 'text', 'style'],
                },
              },
            },
            required: ['lines'],
          },
        },
      });

      const parsed = JSON.parse(scriptResp.text || '{}') as {
        lines?: Array<{ speakerSlot: 'A' | 'B'; text: string; style: string }>;
      };

      const rawLines = Array.isArray(parsed.lines) ? parsed.lines.slice(0, 4) : [];
      if (rawLines.length < 2) {
        res.status(502).json({
          error: 'Gagal menyusun naskah percakapan restoran.',
        });
        return;
      }

      const speakerTagA = profA.displayName.split(' ')[0];
      const speakerTagB = profB.displayName.split(' ')[0];
      // Ensure distinct speaker tag names in multiSpeakerVoiceConfig
      const tagA = speakerTagA;
      const tagB = speakerTagB === speakerTagA ? `${speakerTagB} 2` : speakerTagB;

      const structuredLines = rawLines.map((line) => {
        const isA = line.speakerSlot === 'A';
        const speakerId = isA ? cfg.speakerA : cfg.speakerB;
        const prof = isA ? profA : profB;
        const cleanLine = cleanTextForSpeech(line.text || '');
        return {
          speakerId,
          speakerTag: isA ? tagA : tagB,
          speakerName: prof.displayName,
          speakerRole: prof.roleLabel,
          text: cleanLine,
          style: (line.style || prof.defaultStyle).slice(0, 100),
        };
      });

      const ttsResp = await (aiTts ?? ai).models.generateContent({
        model: 'gemini-3.8-flash-tts',
        contents: [
          {
            role: 'user',
            parts: structuredLines.map((ln) => ({
              text: `${ln.speakerTag}: ${ln.text}`,
              speechMetadata: {
                speaker: ln.speakerTag,
                style: ln.style,
              },
            })),
          },
        ],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: tagA,
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: cfg.voiceA },
                  },
                },
                {
                  speaker: tagB,
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: cfg.voiceB },
                  },
                },
              ],
            },
          },
        },
      });

      const base64Audio =
        ttsResp.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        res.status(502).json({
          error: 'Layanan multi-speaker TTS Gemini tidak mengembalikan audio.',
        });
        return;
      }

      res.json({
        scenario: chosenScenario,
        title: cfg.title,
        speakers: [
          { id: cfg.speakerA, name: profA.displayName, role: profA.roleLabel },
          { id: cfg.speakerB, name: profB.displayName, role: profB.roleLabel },
        ],
        lines: structuredLines.map(({ speakerId, speakerName, speakerRole, text }) => ({
          speakerId,
          speakerName,
          speakerRole,
          text,
        })),
        audioBase64: base64Audio,
        mimeType: 'audio/wav',
      });
    } catch (err: unknown) {
      const rawMessage =
        err instanceof Error
          ? err.message
          : 'Gagal membuat percakapan suara restoran.';
      const isQuota =
        rawMessage.includes('429') ||
        rawMessage.includes('RESOURCE_EXHAUSTED') ||
        rawMessage.toLowerCase().includes('quota');

      if (isQuota) {
        console.warn('Gemini Dialogue TTS quota limit reached (429).');
        res.status(429).json({
          quotaExceeded: true,
          error:
            'Kuota harian Gemini TTS Free Tier sedang habis. Tunggu beberapa saat atau gunakan kunci API berbayar di panel Settings > Secrets.',
        });
        return;
      }

      console.error('Gemini Dialogue Voice Error:', rawMessage);
      res.status(502).json({
        error: `Gagal menjalankan percakapan suara: ${rawMessage}`,
      });
    }
  });

  // Vite middleware in dev, static dist in production
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexFile = path.join(distDir, 'index.html');
      if (fs.existsSync(indexFile)) {
        res.sendFile(indexFile);
      } else {
        res.status(404).send('Build output tidak ditemukan.');
      }
    });
  }

  const PORT = Number(process.env.PORT) || 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MieLioner server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MieLioner server:', err);
  process.exit(1);
});
