import { useState, useMemo } from 'react';
import { Navbar } from './components/Navbar';
import { CustomerWorkspace } from './components/CustomerWorkspace';
import { ManagementWorkspace } from './components/ManagementWorkspace';
import { AssistantPanel } from './components/AssistantPanel';
import { VirtualRestaurant } from './components/VirtualRestaurant';
import type { IncomingOrderSimEvent } from './components/RestaurantSimulator3D';
import {
  PACKING_FEE,
  PUBLIC_MENU_ITEMS,
  type AppMode,
  type CartItem,
  type OrderRecord,
  type OrderType,
} from './data/menuCatalog';
import { formatRupiah } from './utils/formatters';

export default function App() {
  const [mode, setMode] = useState<AppMode>('customer');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [orderType, setOrderType] = useState<OrderType>('dine-in');
  const [managementRefreshSignal, setManagementRefreshSignal] = useState(0);
  const [incomingOrderEvent, setIncomingOrderEvent] =
    useState<IncomingOrderSimEvent | null>(null);
  const [externalPromptTrigger, setExternalPromptTrigger] = useState<{
    text: string;
    nonce: number;
  } | null>(null);

  const menuMap = useMemo(
    () => new Map(PUBLIC_MENU_ITEMS.map((m) => [m.id, m])),
    []
  );

  const totalCartQty = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const cartSummaryText = useMemo(() => {
    if (cart.length === 0) return 'Keranjang masih kosong.';
    const lines: string[] = [];
    let total = 0;
    for (const entry of cart) {
      const item = menuMap.get(entry.menuId);
      if (!item) continue;
      const lineTotal = item.price !== null ? item.price * entry.quantity : 0;
      total += lineTotal;
      lines.push(
        `- ${entry.quantity}x ${item.name} (${
          item.price !== null ? formatRupiah(lineTotal) : 'Konfirmasi kasir'
        })`
      );
    }
    if (orderType === 'takeaway') {
      total += PACKING_FEE;
      lines.push(`- Biaya Packing (Takeaway): ${formatRupiah(PACKING_FEE)}`);
    }
    lines.push(
      `Tipe Pesanan: ${
        orderType === 'takeaway' ? 'Dibungkus (Takeaway)' : 'Makan di Tempat (Dine-in)'
      }`
    );
    lines.push(`Estimasi Total: ${formatRupiah(total)}`);
    return lines.join('\n');
  }, [cart, menuMap, orderType]);

  const handleUpdateQty = (menuId: string, delta: number) => {
    setCart((prev) => {
      const existing = prev.find((c) => c.menuId === menuId);
      if (!existing) {
        if (delta <= 0) return prev;
        return [...prev, { menuId, quantity: delta }];
      }
      const nextQty = existing.quantity + delta;
      if (nextQty <= 0) {
        return prev.filter((c) => c.menuId !== menuId);
      }
      return prev.map((c) =>
        c.menuId === menuId ? { ...c, quantity: nextQty } : c
      );
    });
  };

  const handleClearCart = () => setCart([]);

  const handleTriggerAssistant = (promptText: string) => {
    setExternalPromptTrigger({ text: promptText, nonce: Date.now() });
    const el = document.getElementById('asisten');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  const handleNavbarAction = () => {
    if (mode === 'management') {
      setMode('customer');
      return;
    }
    const el = document.getElementById('pesanan');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <div id="top" className="min-h-screen flex flex-col bg-stone-50 text-zinc-900">
      <Navbar
        mode={mode}
        cartCount={totalCartQty}
        onPrimaryAction={handleNavbarAction}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-10 space-y-10">
        {/* Workspace Mode Bar (below header per Top Bar Contract) */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b border-stone-200">
          <div className="text-xs sm:text-sm text-zinc-600">
            {mode === 'customer' ? (
              <span>
                Tampilan Pelanggan · Pilih menu, topping, dan cek total pesanan
              </span>
            ) : (
              <span>
                Tampilan Manajemen Operasional · Data HPP, margin, stok bahan &amp; SOP dapur
              </span>
            )}
          </div>

          <div
            role="tablist"
            aria-label="Pilih mode kerja MieLioner"
            className="inline-flex items-center gap-1 p-1 bg-stone-200/75 rounded-xl"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'customer'}
              onClick={() => setMode('customer')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'customer'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Mode Pelanggan
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === 'management'}
              onClick={() => setMode('management')}
              className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                mode === 'management'
                  ? 'bg-zinc-900 text-white shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              Mode Manajemen
            </button>
          </div>
        </div>

        {mode === 'customer' ? (
          <CustomerWorkspace
            cart={cart}
            orderType={orderType}
            onOrderTypeChange={setOrderType}
            onUpdateQty={handleUpdateQty}
            onClearCart={handleClearCart}
            onOrderConfirmed={(order: OrderRecord) => {
              setManagementRefreshSignal((prev) => prev + 1);
              setIncomingOrderEvent({
                nonce: Date.now(),
                orderType: order.orderType,
                label: `#${order.id}`,
              });
            }}
            onAskAssistantAboutOrder={handleTriggerAssistant}
          />
        ) : (
          <ManagementWorkspace
            refreshSignal={managementRefreshSignal}
            onRequestAiAnalysis={handleTriggerAssistant}
          />
        )}

        <VirtualRestaurant
          mode={mode}
          refreshSignal={managementRefreshSignal}
          incomingOrderEvent={incomingOrderEvent}
        />

        <AssistantPanel
          mode={mode}
          cartSummaryText={cartSummaryText}
          externalPromptTrigger={externalPromptTrigger}
          onModeSwitch={(nextMode) => setMode(nextMode)}
        />
      </main>

      <footer className="border-t border-stone-200 bg-white mt-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-zinc-500">
          <span>MieLioner · Kedai Mie Kekinian</span>
          <span>
            Dine-in &amp; Takeaway · Biaya Packing Rp 1.000 khusus pesanan dibungkus
          </span>
        </div>
      </footer>
    </div>
  );
}
