export type MenuCategory =
  | 'Mie Lioner'
  | 'Topping Mie'
  | 'Cemilan Dayang'
  | 'Minuman';

export type OrderType = 'dine-in' | 'takeaway';
export type AppMode = 'customer' | 'management';

export interface PublicMenuItem {
  id: string;
  name: string;
  category: MenuCategory;
  price: number | null; // null means confirmed directly at cashier ([Isi Harga])
  priceNote?: string;
  description: string;
  variantTag?: string;
  isSpicy?: boolean;
  isMainNoodle?: boolean;
  portionSize?: 'Single' | 'Double';
}

export interface CartItem {
  menuId: string;
  quantity: number;
}

export type OrderStatus =
  | 'Menunggu Diproses'
  | 'Sedang Dimasak'
  | 'Siap Disajikan'
  | 'Selesai';

export const ORDER_STATUS_OPTIONS: OrderStatus[] = [
  'Menunggu Diproses',
  'Sedang Dimasak',
  'Siap Disajikan',
  'Selesai',
];

export const TABLE_ZONE_OPTIONS = [
  'Booth Timber Lantai 1',
  'Mezzanine Lantai 2',
  'Teras Outdoor',
] as const;

export interface OrderRecord {
  id: string;
  barcodeCode: string;
  createdAt: string;
  orderType: OrderType;
  status: OrderStatus;
  customerName?: string;
  tableZone?: string;
  items: Array<{
    menuId: string;
    name: string;
    unitPrice: number | null;
    quantity: number;
    subtotal: number;
  }>;
  packingFee: number;
  totalAmount: number;
  hasKasirConfirmItems: boolean;
  customerNote?: string;
}

export const PACKING_FEE = 1000;

export const MENU_CATEGORIES: MenuCategory[] = [
  'Mie Lioner',
  'Topping Mie',
  'Cemilan Dayang',
  'Minuman',
];

export const PUBLIC_MENU_ITEMS: PublicMenuItem[] = [
  // A. MENU UTAMA (MIE LIONER)
  {
    id: 'mie-polos-single-goreng',
    name: 'Mie Lioner Polos Single (Goreng)',
    category: 'Mie Lioner',
    price: 7000,
    description: 'Mie goreng gurih racikan khas MieLioner porsi pas untuk santai.',
    variantTag: 'Single · Goreng',
    isMainNoodle: true,
    portionSize: 'Single',
  },
  {
    id: 'mie-polos-double-goreng',
    name: 'Mie Lioner Polos Double (Goreng)',
    category: 'Mie Lioner',
    price: 13000,
    description: 'Mie goreng porsi ganda yang mengenyangkan dengan bumbu spesial.',
    variantTag: 'Double · Goreng',
    isMainNoodle: true,
    portionSize: 'Double',
  },
  {
    id: 'mie-hot-maks-single',
    name: 'Mie Lioner Hot Maks (Goreng Single)',
    category: 'Mie Lioner',
    price: 10000,
    description: 'Varian pedas favorit dengan sambal cabai racikan maksimal.',
    variantTag: 'Pedas · Single',
    isSpicy: true,
    isMainNoodle: true,
    portionSize: 'Single',
  },
  {
    id: 'mie-hot-maks-double',
    name: 'Mie Lioner Hot Maks (Goreng Double)',
    category: 'Mie Lioner',
    price: 16000,
    description: 'Varian pedas porsi jumbo untuk pencinta tantangan rasa.',
    variantTag: 'Pedas Jumbo · Double',
    isSpicy: true,
    isMainNoodle: true,
    portionSize: 'Double',
  },
  {
    id: 'mie-polos-single-rebus',
    name: 'Mie Lioner Polos Single (Rebus)',
    category: 'Mie Lioner',
    price: 6500,
    description: 'Mie rebus hangat dengan kuah kaldu gurih yang menenangkan.',
    variantTag: 'Single · Rebus',
    isMainNoodle: true,
    portionSize: 'Single',
  },
  {
    id: 'mie-polos-double-rebus',
    name: 'Mie Lioner Polos Double (Rebus)',
    category: 'Mie Lioner',
    price: 11000,
    description: 'Mie rebus porsi double hangat lengkap dengan kaldu spesial.',
    variantTag: 'Double · Rebus',
    isMainNoodle: true,
    portionSize: 'Double',
  },

  // B. TOPPING MIE
  {
    id: 'topping-telor-goreng',
    name: 'Telor Goreng',
    category: 'Topping Mie',
    price: 5000,
    description: 'Telur mata sapi atau dadar hangat pendamping klasik semangkuk mie.',
    variantTag: 'Topping Favorit',
  },
  {
    id: 'topping-bakso-rebus',
    name: 'Bakso Rebus (2 Pcs)',
    category: 'Topping Mie',
    price: 3000,
    description: 'Dua butir bakso daging kenyal untuk tambahan protein hemat.',
    variantTag: '2 Pcs',
  },
  {
    id: 'topping-sosis-goreng',
    name: 'Sosis Goreng (1 Pcs)',
    category: 'Topping Mie',
    price: 4000,
    description: 'Sosis goreng gurih renyah di luar, nikmat dipadukan dengan mie goreng.',
    variantTag: '1 Pcs',
  },
  {
    id: 'topping-keju-parut',
    name: 'Keju Parut',
    category: 'Topping Mie',
    price: 5000,
    description: 'Taburan keju cheddar parut melimpah yang memberi sentuhan gurih.',
    variantTag: 'Gurih',
  },
  {
    id: 'topping-keju-leleh',
    name: 'Keju Leleh',
    category: 'Topping Mie',
    price: 6000,
    description: 'Saus keju leleh creamy, sangat cocok meredam pedas Hot Maks.',
    variantTag: 'Creamy',
  },

  // C. CEMILAN DAYANG
  {
    id: 'cemilan-popcorn',
    name: 'Pop Corn Original',
    category: 'Cemilan Dayang',
    price: 5000,
    description: 'Popcorn renyah hangat untuk teman ngobrol di teras atau mezzanine.',
    variantTag: 'Ringan',
  },
  {
    id: 'cemilan-kentang-goreng',
    name: 'Kentang Goreng (200 Gram)',
    category: 'Cemilan Dayang',
    price: 15000,
    description: 'Porsi besar 200 gram kentang goreng renyah, pas untuk dinikmati bersama.',
    variantTag: '200 Gram · Sharing',
  },
  {
    id: 'cemilan-otak-otak',
    name: 'Otak-Otak Goreng (5 Pcs)',
    category: 'Cemilan Dayang',
    price: 10000,
    description: 'Lima potong otak-otak ikan goreng renyah hangat.',
    variantTag: '5 Pcs',
  },
  {
    id: 'cemilan-sosis-bakar',
    name: 'Sosis Bakar Besar',
    category: 'Cemilan Dayang',
    price: 10000,
    description: 'Sosis jumbo panggang dengan olesan saus bakar gurih manis.',
    variantTag: 'Ukuran Besar',
  },

  // D. MINUMAN
  {
    id: 'minuman-te-manis',
    name: "Te' Manis",
    category: 'Minuman',
    price: 5000,
    description: 'Teh manis segar dingin atau hangat, penetral pedas paling pas.',
    variantTag: 'Segar',
  },
  {
    id: 'minuman-sanqua',
    name: 'Sanqua',
    category: 'Minuman',
    price: 4000,
    description: 'Air mineral kemasan botol dingin atau suhu ruang.',
    variantTag: 'Air Mineral',
  },
  {
    id: 'minuman-goodday-cappucino',
    name: 'Goodday Cappucino',
    category: 'Minuman',
    price: 5000,
    description: 'Kopi cappucino dengan taburan choco granule yang nikmat.',
    variantTag: 'Kopi Susu',
  },
  {
    id: 'minuman-creamy-latte',
    name: 'Creamy Latte',
    category: 'Minuman',
    price: 5000,
    description: 'Minuman susu creamy lembut, jagoan peredam pedas Hot Maks.',
    variantTag: 'Creamy',
  },
  {
    id: 'minuman-milo',
    name: 'Milo',
    category: 'Minuman',
    price: null,
    priceNote: 'Harga dikonfirmasi kasir',
    description: 'Minuman cokelat malt klasik favorit semua kalangan.',
    variantTag: 'Cokelat Malt',
  },
  {
    id: 'minuman-indocafe',
    name: 'Indocafe Coffee Mix',
    category: 'Minuman',
    price: null,
    priceNote: 'Harga dikonfirmasi kasir',
    description: 'Racikan kopi susu praktis dengan aroma kopi yang seimbang.',
    variantTag: 'Kopi Mix',
  },
  {
    id: 'minuman-mocacinno',
    name: 'Goodday Mocacinno',
    category: 'Minuman',
    price: null,
    priceNote: 'Harga dikonfirmasi kasir',
    description: 'Perpaduan kopi dan cokelat moka yang kaya rasa.',
    variantTag: 'Moka',
  },
  {
    id: 'minuman-kopi-hitam',
    name: 'Kopi Hitam',
    category: 'Minuman',
    price: null,
    priceNote: 'Harga dikonfirmasi kasir',
    description: 'Kopi hitam pekat untuk menemani waktu santai.',
    variantTag: 'Kopi Hitam',
  },
];
