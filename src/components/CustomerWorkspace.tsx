import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Plus,
  Minus,
  Search,
  ShoppingBag,
  Utensils,
  Flame,
  Sparkles,
  Trash2,
  QrCode,
  ClipboardList,
  RefreshCw,
} from 'lucide-react';
import {
  MENU_CATEGORIES,
  PACKING_FEE,
  PUBLIC_MENU_ITEMS,
  TABLE_ZONE_OPTIONS,
  type CartItem,
  type MenuCategory,
  type OrderRecord,
  type OrderType,
  type PublicMenuItem,
} from '../data/menuCatalog';
import { formatRupiah } from '../utils/formatters';
import { BarcodeTicketCard, getStatusTextClass } from './BarcodeTicket';

interface CustomerWorkspaceProps {
  cart: CartItem[];
  orderType: OrderType;
  refreshSignal: number;
  onOrderTypeChange: (type: OrderType) => void;
  onUpdateQty: (menuId: string, delta: number) => void;
  onClearCart: () => void;
  onOrderConfirmed: (order: OrderRecord) => void;
  onAskAssistantAboutOrder: (prompt: string) => void;
}

interface OrderReportSummary {
  totalOrders: number;
  dineInCount: number;
  takeawayCount: number;
  pendingCount: number;
  cookingCount: number;
  readyCount: number;
  completedCount: number;
  totalOrderRevenue: number;
  totalPackingCollected: number;
}

export function CustomerWorkspace({
  cart,
  orderType,
  refreshSignal,
  onOrderTypeChange,
  onUpdateQty,
  onClearCart,
  onOrderConfirmed,
  onAskAssistantAboutOrder,
}: CustomerWorkspaceProps) {
  const [selectedCategory, setSelectedCategory] = useState<'Semua' | MenuCategory>('Semua');
  const [searchQuery, setSearchQuery] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [tableZone, setTableZone] = useState<string>('');
  const [customerNote, setCustomerNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null);
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const [incomingOrders, setIncomingOrders] = useState<OrderRecord[]>([]);
  const [orderSummary, setOrderSummary] = useState<OrderReportSummary | null>(null);
  const [barcodeLookupInput, setBarcodeLookupInput] = useState('');
  const [barcodeLookupError, setBarcodeLookupError] = useState<string | null>(null);
  const [inspectedOrder, setInspectedOrder] = useState<OrderRecord | null>(null);

  const fetchIncomingOrders = useCallback(async () => {
    try {
      const res = await fetch('/api/orders');
      if (!res.ok) return;
      const json = (await res.json()) as {
        orders?: OrderRecord[];
        summary?: OrderReportSummary;
      };
      if (Array.isArray(json.orders)) {
        setIncomingOrders(json.orders);
      }
      if (json.summary) {
        setOrderSummary(json.summary);
      }
    } catch {
      // Keep current list on transient error
    }
  }, []);

  useEffect(() => {
    void fetchIncomingOrders();
  }, [fetchIncomingOrders, refreshSignal]);

  const menuMap = useMemo(
    () => new Map(PUBLIC_MENU_ITEMS.map((item) => [item.id, item])),
    []
  );

  const cartQtyMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of cart) {
      map.set(entry.menuId, entry.quantity);
    }
    return map;
  }, [cart]);

  const filteredMenu = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return PUBLIC_MENU_ITEMS.filter((item) => {
      const matchCat =
        selectedCategory === 'Semua' || item.category === selectedCategory;
      const matchQuery =
        !q ||
        item.name.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [selectedCategory, searchQuery]);

  // Cart totals & contextual upsell logic
  const cartSummary = useMemo(() => {
    let subtotal = 0;
    let totalCount = 0;
    let noodleCount = 0;
    let hasHotMaks = false;
    let hasTopping = false;
    let hasDrink = false;
    let hasCemilan = false;
    let hasKasirConfirmItem = false;

    const detailedLines: Array<{
      item: PublicMenuItem;
      quantity: number;
      lineTotal: number;
    }> = [];

    for (const entry of cart) {
      const item = menuMap.get(entry.menuId);
      if (!item || entry.quantity <= 0) continue;
      const lineTotal = item.price !== null ? item.price * entry.quantity : 0;
      subtotal += lineTotal;
      totalCount += entry.quantity;

      if (item.category === 'Mie Lioner') noodleCount += entry.quantity;
      if (item.isSpicy) hasHotMaks = true;
      if (item.category === 'Topping Mie') hasTopping = true;
      if (item.category === 'Minuman') hasDrink = true;
      if (item.category === 'Cemilan Dayang') hasCemilan = true;
      if (item.price === null) hasKasirConfirmItem = true;

      detailedLines.push({
        item,
        quantity: entry.quantity,
        lineTotal,
      });
    }

    const packingFee =
      totalCount > 0 && orderType === 'takeaway' ? PACKING_FEE : 0;
    const grandTotal = subtotal + packingFee;

    const upsellSuggestions: Array<{
      menu: PublicMenuItem;
      reason: string;
    }> = [];

    if (noodleCount > 0 && !hasTopping) {
      const telor = menuMap.get('topping-telor-goreng');
      const kejuLeleh = menuMap.get('topping-keju-leleh');
      if (telor)
        upsellSuggestions.push({
          menu: telor,
          reason: 'Biar racikan mie makin mantap',
        });
      if (kejuLeleh)
        upsellSuggestions.push({
          menu: kejuLeleh,
          reason: 'Tambahan keju creamy favorit',
        });
    }

    if (hasHotMaks && !hasDrink) {
      const teManis = menuMap.get('minuman-te-manis');
      const creamyLatte = menuMap.get('minuman-creamy-latte');
      if (teManis)
        upsellSuggestions.push({
          menu: teManis,
          reason: 'Penyegar pas untuk varian Hot Maks',
        });
      if (creamyLatte)
        upsellSuggestions.push({
          menu: creamyLatte,
          reason: 'Lembut meredam pedas Hot Maks',
        });
    }

    if (noodleCount >= 2 && !hasCemilan) {
      const kentang = menuMap.get('cemilan-kentang-goreng');
      const sosisBakar = menuMap.get('cemilan-sosis-bakar');
      if (kentang)
        upsellSuggestions.push({
          menu: kentang,
          reason: 'Cemilan Dayang porsi 200gr untuk sharing',
        });
      else if (sosisBakar)
        upsellSuggestions.push({
          menu: sosisBakar,
          reason: 'Pendamping nikmat untuk makan bareng',
        });
    }

    return {
      detailedLines,
      subtotal,
      packingFee,
      grandTotal,
      totalCount,
      hasKasirConfirmItem,
      upsellSuggestions: upsellSuggestions.slice(0, 3),
    };
  }, [cart, menuMap, orderType]);

  const handleConfirmOrder = async () => {
    if (cartSummary.totalCount === 0 || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError(null);

    try {
      const response = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          orderType,
          items: cart,
          customerName,
          tableZone: orderType === 'dine-in' ? tableZone : undefined,
          customerNote,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal mengonfirmasi pesanan.');
      }
      const newOrder = data.order as OrderRecord;
      setConfirmedOrder(newOrder);
      setInspectedOrder(newOrder);
      onOrderConfirmed(newOrder);
      onClearCart();
      setCustomerNote('');
      setCustomerName('');
      void fetchIncomingOrders();
    } catch (err: unknown) {
      setSubmitError(
        err instanceof Error ? err.message : 'Gagal mengirim pesanan.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLookupBarcode = async () => {
    const code = barcodeLookupInput.trim();
    if (!code) return;
    setBarcodeLookupError(null);
    try {
      const res = await fetch(
        `/api/orders/lookup?code=${encodeURIComponent(code)}`
      );
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Kode barcode tidak ditemukan.');
      }
      setInspectedOrder(data.order as OrderRecord);
    } catch (err: unknown) {
      setBarcodeLookupError(
        err instanceof Error ? err.message : 'Gagal memeriksa kode barcode.'
      );
    }
  };

  return (
    <div className="space-y-12">
      {/* Split Hero & Kedai Spatial Showcase */}
      <section
        id="ruang-kedai"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch"
      >
        <div className="lg:col-span-6 bg-white border border-stone-200 rounded-2xl p-8 sm:p-10 flex flex-col justify-between">
          <div className="space-y-5">
            <div className="text-xs font-medium tracking-wide text-zinc-500 flex flex-wrap items-center gap-2">
              <span>Kedai Mie Kekinian</span>
              <span aria-hidden="true">·</span>
              <span>Single &amp; Double</span>
              <span aria-hidden="true">·</span>
              <span>Dine-in &amp; Takeaway</span>
            </div>

            <h1 className="font-display text-3xl sm:text-4xl lg:text-[2.65rem] font-extrabold tracking-tight text-zinc-900 leading-[1.12] [text-wrap:balance]">
              Racik Mie Favoritmu dengan Harga Bersahabat
            </h1>

            <p className="text-base text-zinc-600 leading-relaxed max-w-xl">
              Nikmati pilihan Mie Polos Goreng maupun Rebus, tantangan pedas{' '}
              <span className="font-semibold text-zinc-900">Hot Maks</span>,
              beragam topping hangat, dan camilan santai{' '}
              <span className="font-semibold text-zinc-900">Cemilan Dayang</span>{' '}
              di suasana kedai dua lantai yang nyaman.
            </p>
          </div>

          <div className="pt-8 mt-8 border-t border-stone-200 flex flex-wrap items-center gap-4">
            <a
              href="#menu"
              className="px-5 py-3 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors whitespace-nowrap shrink-0"
            >
              Mulai Pilih Menu
            </a>
            <a
              href="#restoran-virtual"
              className="px-5 py-3 rounded-xl border border-stone-300 bg-white text-zinc-800 text-sm font-semibold hover:bg-stone-50 transition-colors whitespace-nowrap shrink-0"
            >
              Masuk Restoran Virtual
            </a>
          </div>
        </div>

        <div className="lg:col-span-6 relative rounded-2xl overflow-hidden border border-stone-200 bg-stone-200 min-h-[280px] lg:min-h-[380px]">
          {!heroImgFailed ? (
            <img
              src="/assets/aistudio/image_2a505b7f.png"
              alt="Desain ruang kedai dua lantai MieLioner dengan area indoor timber, mezzanine, bar terbuka, dan teras outdoor"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 text-center bg-gradient-to-br from-stone-100 to-stone-200">
              <Utensils className="w-10 h-10 text-zinc-500 mb-3" />
              <p className="font-display font-semibold text-zinc-800">
                Suasana Kedai MieLioner
              </p>
              <p className="text-sm text-zinc-600 mt-1">
                Tersedia area indoor, mezzanine lantai 2, dan teras terbuka
              </p>
            </div>
          )}

          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent p-6 pt-16">
            <p className="text-white font-display font-semibold text-base">
              Tiga Zona Tempat Duduk Nyaman
            </p>
            <p className="text-stone-200 text-xs mt-1">
              Booth Timber Lantai 1 · Mezzanine Lantai 2 · Teras Outdoor
            </p>
          </div>
        </div>
      </section>

      {/* Menu Catalog & Order Builder */}
      <section
        id="menu"
        className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start"
      >
        {/* Left: Menu List */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-2xl font-bold text-zinc-900">
                Daftar Menu MieLioner
              </h2>
              <p className="text-sm text-zinc-600 mt-1">
                Pilih porsi Single atau Double, lalu tambahkan topping dan minuman favorit.
              </p>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari menu..."
                className="w-full min-h-[40px] pl-10 pr-4 py-2 text-sm rounded-xl border border-stone-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
              />
            </div>
          </div>

          {/* Interactive Category Filter Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-200/70 rounded-xl w-fit">
            {(['Semua', ...MENU_CATEGORIES] as const).map((cat) => {
              const active = selectedCategory === cat;
              return (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  {cat}
                </button>
              );
            })}
          </div>

          {filteredMenu.length === 0 ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center">
              <p className="font-medium text-zinc-800">
                Menu "{searchQuery}" tidak ditemukan
              </p>
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('Semua');
                }}
                className="mt-3 text-sm font-semibold text-orange-600 hover:text-orange-700 cursor-pointer"
              >
                Tampilkan semua menu
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {filteredMenu.map((item) => {
                const qty = cartQtyMap.get(item.id) || 0;
                return (
                  <article
                    key={item.id}
                    className="bg-white border border-stone-200 rounded-xl p-5 flex flex-col justify-between transition-transform duration-150 hover:-translate-y-0.5"
                  >
                    <div>
                      <div className="flex items-center gap-2 text-xs text-zinc-500">
                        <span>{item.category}</span>
                        {item.variantTag && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{item.variantTag}</span>
                          </>
                        )}
                        {item.isSpicy && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span className="inline-flex items-center gap-1 text-orange-700 font-medium">
                              <Flame className="w-3.5 h-3.5" />
                              Pedas
                            </span>
                          </>
                        )}
                      </div>

                      <h3 className="font-display text-base font-semibold text-zinc-900 mt-1.5">
                        {item.name}
                      </h3>
                      <p className="text-sm text-zinc-600 mt-1 leading-relaxed">
                        {item.description}
                      </p>
                    </div>

                    <div className="pt-4 mt-4 border-t border-stone-100 flex items-center justify-between gap-3">
                      <div>
                        {item.price !== null ? (
                          <span className="font-mono tabular-nums text-base font-semibold text-zinc-900">
                            {formatRupiah(item.price)}
                          </span>
                        ) : (
                          <span className="text-xs font-medium text-zinc-600">
                            Konfirmasi kasir
                          </span>
                        )}
                      </div>

                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => onUpdateQty(item.id, 1)}
                          className="min-h-[40px] px-4 py-2 rounded-lg border border-stone-300 bg-white text-zinc-900 text-xs font-semibold hover:bg-orange-600 hover:text-white hover:border-orange-600 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>Tambah</span>
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-2 bg-stone-100 rounded-lg p-1">
                          <button
                            type="button"
                            aria-label={`Kurangi ${item.name}`}
                            onClick={() => onUpdateQty(item.id, -1)}
                            className="w-8 h-8 rounded-md bg-white border border-stone-200 flex items-center justify-center text-zinc-800 hover:bg-stone-50 cursor-pointer"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono tabular-nums text-sm font-semibold text-zinc-900 w-6 text-center">
                            {qty}
                          </span>
                          <button
                            type="button"
                            aria-label={`Tambah ${item.name}`}
                            onClick={() => onUpdateQty(item.id, 1)}
                            className="w-8 h-8 rounded-md bg-orange-600 text-white flex items-center justify-center hover:bg-orange-700 cursor-pointer"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        {/* Right: Order Cart & Calculator */}
        <aside
          id="pesanan"
          className="lg:col-span-5 xl:col-span-4 lg:sticky lg:top-24 space-y-4"
        >
          <div className="bg-white border border-stone-200 rounded-2xl p-6 space-y-5">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2.5">
                <ShoppingBag className="w-5 h-5 text-orange-600" />
                <h2 className="font-display text-lg font-bold text-zinc-900">
                  Ringkasan Pesanan
                </h2>
              </div>

              {cartSummary.totalCount > 0 && (
                <button
                  type="button"
                  onClick={onClearCart}
                  className="text-xs font-medium text-zinc-500 hover:text-red-600 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Kosongkan</span>
                </button>
              )}
            </div>

            {/* Dine-in vs Takeaway Selector */}
            <div>
              <p className="text-xs font-medium text-zinc-600 mb-2">
                Pilih Tipe Pesanan
              </p>
              <div className="grid grid-cols-2 gap-2 p-1 bg-stone-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => onOrderTypeChange('dine-in')}
                  className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    orderType === 'dine-in'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Makan di Tempat
                </button>
                <button
                  type="button"
                  onClick={() => onOrderTypeChange('takeaway')}
                  className={`min-h-[40px] px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                    orderType === 'takeaway'
                      ? 'bg-white text-zinc-900 shadow-sm'
                      : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  Dibungkus (+Rp 1.000)
                </button>
              </div>
            </div>

            {/* Cart Items List */}
            {cartSummary.detailedLines.length === 0 ? (
              <div className="py-8 text-center border-y border-stone-100">
                <p className="text-sm font-medium text-zinc-700">
                  Belum ada menu dipilih
                </p>
                <p className="text-xs text-zinc-500 mt-1">
                  Klik tombol Tambah pada menu untuk mulai menghitung pesanan.
                </p>
              </div>
            ) : (
              <div className="space-y-3 border-y border-stone-200 py-4">
                <ul className="space-y-3">
                  {cartSummary.detailedLines.map(({ item, quantity, lineTotal }) => (
                    <li
                      key={item.id}
                      className="flex items-start justify-between gap-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-zinc-900 truncate">
                          • {item.name}
                        </p>
                        <p className="text-xs text-zinc-500 tabular-nums mt-0.5">
                          {quantity}x{' '}
                          {item.price !== null
                            ? formatRupiah(item.price)
                            : 'Harga konfirmasi kasir'}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono tabular-nums text-sm font-medium text-zinc-900">
                          {item.price !== null
                            ? formatRupiah(lineTotal)
                            : 'Kasir'}
                        </span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            aria-label={`Kurangi ${item.name}`}
                            onClick={() => onUpdateQty(item.id, -1)}
                            className="w-6 h-6 rounded border border-stone-200 flex items-center justify-center text-zinc-700 hover:bg-stone-100 cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <button
                            type="button"
                            aria-label={`Tambah ${item.name}`}
                            onClick={() => onUpdateQty(item.id, 1)}
                            className="w-6 h-6 rounded border border-stone-200 flex items-center justify-center text-zinc-700 hover:bg-stone-100 cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>

                {orderType === 'takeaway' && (
                  <div className="flex items-center justify-between text-sm pt-2 border-t border-dashed border-stone-200 text-zinc-700">
                    <span>• Biaya Packing (Takeaway)</span>
                    <span className="font-mono tabular-nums font-medium">
                      {formatRupiah(PACKING_FEE)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* Contextual Upselling Suggestions */}
            {cartSummary.upsellSuggestions.length > 0 && (
              <div className="bg-orange-50/70 border border-orange-200/80 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-800">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Rekomendasi Pelengkap Buat Kakak</span>
                </div>
                <div className="space-y-2">
                  {cartSummary.upsellSuggestions.map(({ menu, reason }) => (
                    <div
                      key={menu.id}
                      className="flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-semibold text-zinc-900 truncate">
                          {menu.name}{' '}
                          <span className="font-mono tabular-nums text-orange-700">
                            {menu.price !== null ? formatRupiah(menu.price) : ''}
                          </span>
                        </p>
                        <p className="text-zinc-600 truncate">{reason}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => onUpdateQty(menu.id, 1)}
                        className="px-2.5 py-1.5 rounded-lg bg-white border border-orange-300 text-orange-700 font-semibold hover:bg-orange-600 hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        + Tambah
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Grand Total, Customer Info & Note */}
            {cartSummary.totalCount > 0 && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 gap-2.5">
                  <input
                    type="text"
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Nama pemesan (opsional, misal: Kak Rina)"
                    maxLength={60}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-orange-600"
                  />

                  {orderType === 'dine-in' && (
                    <select
                      aria-label="Pilih area tempat duduk"
                      value={tableZone}
                      onChange={(e) => setTableZone(e.target.value)}
                      className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 bg-white text-zinc-900 focus:outline-none focus:border-orange-600"
                    >
                      <option value="">Area Tempat Duduk: Pilihan Kasir</option>
                      {TABLE_ZONE_OPTIONS.map((z) => (
                        <option key={z} value={z}>
                          Area: {z}
                        </option>
                      ))}
                    </select>
                  )}

                  <input
                    type="text"
                    value={customerNote}
                    onChange={(e) => setCustomerNote(e.target.value)}
                    placeholder="Catatan tambahan (misal: tingkat pedas, es/hangat)"
                    maxLength={200}
                    className="w-full px-3.5 py-2 text-xs rounded-xl border border-stone-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-orange-600"
                  />
                </div>

                <div className="flex items-baseline justify-between pt-1">
                  <span className="text-sm font-semibold text-zinc-700">
                    Total Estimasi
                  </span>
                  <span className="font-mono tabular-nums text-2xl font-bold text-zinc-900">
                    {formatRupiah(cartSummary.grandTotal)}
                  </span>
                </div>

                {cartSummary.hasKasirConfirmItem && (
                  <p className="text-xs text-zinc-600">
                    Catatan: Minuman bertanda konfirmasi kasir tersedia dan harganya akan dihitung langsung di kasir.
                  </p>
                )}

                {submitError && (
                  <p className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg p-2.5">
                    {submitError}
                  </p>
                )}

                <div className="grid grid-cols-1 gap-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void handleConfirmOrder()}
                    className="w-full min-h-[44px] px-4 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmitting
                      ? 'Menerbitkan Barcode Pesanan...'
                      : 'Konfirmasi & Terima Barcode'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const itemsText = cartSummary.detailedLines
                        .map((l) => `${l.quantity}x ${l.item.name}`)
                        .join(', ');
                      onAskAssistantAboutOrder(
                        `Tolong cek pesanan saya (${
                          orderType === 'takeaway' ? 'Dibungkus' : 'Makan di Tempat'
                        }): ${itemsText}. Ada rekomendasi tambahan yang pas?`
                      );
                    }}
                    className="w-full min-h-[40px] px-4 py-2 rounded-xl border border-stone-300 bg-white text-zinc-800 text-xs font-semibold hover:bg-stone-50 transition-colors cursor-pointer"
                  >
                    Minta Saran Racikan ke Asisten
                  </button>
                </div>
              </div>
            )}

            {/* Post-Order Confirmation & Scannable Barcode Ticket */}
            {confirmedOrder && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-emerald-800">
                  Pesanan terkonfirmasi masuk ke sistem &amp; kode barcode diterbitkan:
                </p>
                <BarcodeTicketCard order={confirmedOrder} />
              </div>
            )}
          </div>
        </aside>
      </section>

      {/* Incoming Orders & Barcode Ticket Report System */}
      <section
        id="laporan-order-masuk"
        className="bg-white border border-stone-200 rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-5 border-b border-stone-200 bg-stone-50/70 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold text-zinc-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-orange-600" />
              <span>Data Order Masuk &amp; Laporan Tiket Barcode</span>
            </h2>
            <p className="text-sm text-zinc-600 mt-0.5">
              Setiap pesanan terkonfirmasi dari menu otomatis tercatat di laporan order dan dapat diverifikasi dengan kode barcode.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5">
              <input
                type="text"
                value={barcodeLookupInput}
                onChange={(e) => setBarcodeLookupInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void handleLookupBarcode();
                  }
                }}
                placeholder="Cek kode barcode (misal ML101-xxxx)"
                className="min-h-[38px] px-3 py-1.5 text-xs rounded-lg border border-stone-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-orange-600"
              />
              <button
                type="button"
                onClick={() => void handleLookupBarcode()}
                className="min-h-[38px] px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>Cek Barcode</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => void fetchIncomingOrders()}
              className="min-h-[38px] px-3 py-1.5 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-zinc-700 hover:bg-stone-50 inline-flex items-center gap-1.5 cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Segarkan</span>
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {barcodeLookupError && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
              {barcodeLookupError}
            </div>
          )}

          {orderSummary && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/50">
                <p className="text-xs text-zinc-500">Order Masuk Sesi Ini</p>
                <p className="font-mono tabular-nums text-xl font-bold text-zinc-900 mt-1">
                  {orderSummary.totalOrders} Order
                </p>
              </div>
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/50">
                <p className="text-xs text-zinc-500">Dine-in / Takeaway</p>
                <p className="font-mono tabular-nums text-xl font-bold text-zinc-900 mt-1">
                  {orderSummary.dineInCount} / {orderSummary.takeawayCount}
                </p>
              </div>
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/50">
                <p className="text-xs text-zinc-500">Sedang Diproses / Siap</p>
                <p className="font-mono tabular-nums text-xl font-bold text-orange-700 mt-1">
                  {orderSummary.pendingCount + orderSummary.cookingCount} /{' '}
                  {orderSummary.readyCount}
                </p>
              </div>
              <div className="border border-stone-200 rounded-xl p-4 bg-stone-50/50">
                <p className="text-xs text-zinc-500">Total Nilai Order</p>
                <p className="font-mono tabular-nums text-xl font-bold text-emerald-700 mt-1">
                  {formatRupiah(orderSummary.totalOrderRevenue)}
                </p>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-8 overflow-x-auto border border-stone-200 rounded-xl">
              {incomingOrders.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-500">
                  Belum ada pesanan masuk di sesi ini. Pilih menu di atas lalu klik <strong className="text-zinc-800">Konfirmasi &amp; Terima Barcode</strong> untuk mencatat pesanan pertama.
                </div>
              ) : (
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-zinc-600">
                      <th className="py-3 px-4">Order &amp; Barcode</th>
                      <th className="py-3 px-4">Pemesan &amp; Tipe</th>
                      <th className="py-3 px-4">Daftar Menu</th>
                      <th className="py-3 px-4 text-right">Total</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Tiket</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-xs">
                    {incomingOrders.map((ord) => (
                      <tr
                        key={ord.id}
                        className={`hover:bg-stone-50/80 ${
                          inspectedOrder?.id === ord.id ? 'bg-orange-50/40' : ''
                        }`}
                      >
                        <td className="py-3 px-4">
                          <span className="font-mono font-bold text-zinc-900 block">
                            #{ord.id}
                          </span>
                          <span className="font-mono text-[11px] text-zinc-600">
                            {ord.barcodeCode}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-zinc-900 block">
                            {ord.customerName || 'Pelanggan'}
                          </span>
                          <span className="text-zinc-500">
                            {ord.orderType === 'takeaway'
                              ? 'Takeaway (+Packing)'
                              : ord.tableZone || 'Dine-in'}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-zinc-700 max-w-[240px]">
                          {ord.items
                            .map((i) => `${i.quantity}x ${i.name}`)
                            .join(', ')}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-zinc-900">
                          {formatRupiah(ord.totalAmount)}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md border font-semibold whitespace-nowrap ${getStatusTextClass(
                              ord.status
                            )}`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setInspectedOrder(ord)}
                            className="px-2.5 py-1 rounded-lg border border-stone-300 bg-white hover:border-orange-500 hover:text-orange-700 font-semibold whitespace-nowrap cursor-pointer"
                          >
                            Lihat Barcode
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="lg:col-span-4">
              {inspectedOrder ? (
                <BarcodeTicketCard order={inspectedOrder} compact />
              ) : (
                <div className="border border-dashed border-stone-300 rounded-xl p-6 text-center text-xs text-zinc-500 bg-stone-50/60">
                  Tiket barcode pesanan akan tampil di sini setelah Anda mengonfirmasi pesanan atau memilih salah satu order masuk.
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
