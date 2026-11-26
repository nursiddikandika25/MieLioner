import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  TrendingUp,
  Package,
  ClipboardList,
  BookOpen,
  AlertTriangle,
  CheckCircle2,
  RefreshCw,
  Plus,
  Minus,
} from 'lucide-react';
import { formatPercent, formatRupiah } from '../utils/formatters';

interface FinanceBreakdownItem {
  menuId: string;
  name: string;
  category: string;
  hpp: number | null;
  sellingPrice: number | null;
  grossProfit: number | null;
  marginPercent: number | null;
  highlightNote?: string;
  qty: number;
  revenue: number;
  totalHpp: number;
  totalProfit: number;
}

interface IngredientStock {
  id: string;
  name: string;
  unit: string;
  openingStock: number;
  used: number;
  remaining: number;
  minThreshold: number;
  priorityNote: string;
  isHighMarginIngredient?: boolean;
  status: 'Aman' | 'Menipis' | 'Kritis';
}

interface KitchenSop {
  id: string;
  title: string;
  target: string;
  steps: string[];
}

interface ManagementOverviewResponse {
  finance: {
    totalGrossRevenue: number;
    totalHppUsed: number;
    totalGrossProfit: number;
    revenueWithKnownHpp: number;
    averageMarginPercent: number;
    totalPortionsCount: number;
    breakdown: FinanceBreakdownItem[];
  };
  ingredients: IngredientStock[];
  sops: KitchenSop[];
  portionsSold: Record<string, number>;
}

interface ManagementWorkspaceProps {
  refreshSignal: number;
  onRequestAiAnalysis: (prompt: string) => void;
}

type ManagementTab = 'margin' | 'sales' | 'stock' | 'sop';

export function ManagementWorkspace({
  refreshSignal,
  onRequestAiAnalysis,
}: ManagementWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<ManagementTab>('margin');
  const [data, setData] = useState<ManagementOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>('Semua');

  // Editable shift sales draft
  const [draftPortions, setDraftPortions] = useState<Record<string, number>>({});
  const [isSavingSales, setIsSavingSales] = useState(false);

  // Profit bundling simulator
  const [bundleMieId, setBundleMieId] = useState('mie-hot-maks-single');
  const [bundleToppingId, setBundleToppingId] = useState('topping-keju-parut');
  const [bundleSnackId, setBundleSnackId] = useState('cemilan-popcorn');

  const fetchOverview = useCallback(async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const res = await fetch('/api/management/overview');
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal memuat data manajemen.');
      }
      setData(json as ManagementOverviewResponse);
      setDraftPortions(json.portionsSold || {});
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memuat data internal.'
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchOverview();
  }, [fetchOverview, refreshSignal]);

  const handleSaveSales = async (nextPortions: Record<string, number>) => {
    setIsSavingSales(true);
    try {
      const res = await fetch('/api/management/sales-update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ portionsSold: nextPortions }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal menyimpan rekap.');
      setData((prev) =>
        prev
          ? {
              ...prev,
              finance: json.finance,
              ingredients: json.ingredients,
              portionsSold: json.portionsSold,
            }
          : prev
      );
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memperbarui rekap penjualan.'
      );
    } finally {
      setIsSavingSales(false);
    }
  };

  const handleStockAdjust = async (ingredientId: string, delta: number) => {
    try {
      const res = await fetch('/api/management/stock-restock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ingredientId, delta }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Gagal memperbarui stok.');
      setData((prev) =>
        prev ? { ...prev, ingredients: json.ingredients } : prev
      );
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Gagal memperbarui stok.'
      );
    }
  };

  const lowStockHighMargin = useMemo(() => {
    if (!data) return [];
    return data.ingredients.filter(
      (i) => i.status !== 'Aman' && i.isHighMarginIngredient
    );
  }, [data]);

  const bundleResult = useMemo(() => {
    if (!data) return null;
    const byId = new Map(data.finance.breakdown.map((b) => [b.menuId, b]));
    const picks = [bundleMieId, bundleToppingId, bundleSnackId]
      .map((id) => byId.get(id))
      .filter((x): x is FinanceBreakdownItem => Boolean(x));

    const totalHpp = picks.reduce((sum, p) => sum + (p.hpp ?? 0), 0);
    const totalSell = picks.reduce((sum, p) => sum + (p.sellingPrice ?? 0), 0);
    const totalProfit = totalSell - totalHpp;
    const margin = totalSell > 0 ? (totalProfit / totalSell) * 100 : 0;

    return { picks, totalHpp, totalSell, totalProfit, margin };
  }, [data, bundleMieId, bundleToppingId, bundleSnackId]);

  if (isLoading && !data) {
    return (
      <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center text-sm text-zinc-600">
        Memuat data HPP, margin, dan stok bahan MieLioner...
      </div>
    );
  }

  if (errorMsg && !data) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-2xl p-6 text-red-800 text-sm">
        {errorMsg}
      </div>
    );
  }

  if (!data) return null;

  const categories = [
    'Semua',
    'Mie Lioner',
    'Topping Mie',
    'Cemilan Dayang',
    'Minuman',
    'Biaya Tambahan',
  ];

  const filteredFinance = data.finance.breakdown.filter(
    (row) => categoryFilter === 'Semua' || row.category === categoryFilter
  );

  return (
    <div className="space-y-8">
      {/* KPI Summary Strip */}
      <section
        id="ringkasan-manajemen"
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
      >
        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <p className="text-xs font-medium text-zinc-500">
            Total Omzet Kotor Hari Ini
          </p>
          <p className="font-mono tabular-nums text-2xl font-bold text-zinc-900 mt-1.5">
            {formatRupiah(data.finance.totalGrossRevenue)}
          </p>
          <p className="text-xs text-zinc-500 mt-1 tabular-nums">
            {data.finance.totalPortionsCount} item terjual tercatat
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <p className="text-xs font-medium text-zinc-500">
            Total HPP Terpakai
          </p>
          <p className="font-mono tabular-nums text-2xl font-bold text-zinc-900 mt-1.5">
            {formatRupiah(data.finance.totalHppUsed)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Berdasarkan item dengan HPP terisi
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <p className="text-xs font-medium text-zinc-500">
            Total Laba Kotor (Gross Profit)
          </p>
          <p className="font-mono tabular-nums text-2xl font-bold text-emerald-700 mt-1.5">
            {formatRupiah(data.finance.totalGrossProfit)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Omzet ber-HPP dikurangi total modal
          </p>
        </div>

        <div className="bg-white border border-stone-200 rounded-xl p-5">
          <p className="text-xs font-medium text-zinc-500">
            Margin Rata-Rata Aktual
          </p>
          <p className="font-mono tabular-nums text-2xl font-bold text-zinc-900 mt-1.5">
            {formatPercent(data.finance.averageMarginPercent)}
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Target dorong Keju Parut &amp; Pop Corn (60,0%)
          </p>
        </div>
      </section>

      {lowStockHighMargin.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-950">
            <p className="font-semibold">
              Peringatan Pengadaan Bahan Margin Tinggi
            </p>
            <p className="text-xs text-amber-900 mt-0.5">
              {lowStockHighMargin
                .map((s) => `${s.name} (sisa ${s.remaining} ${s.unit})`)
                .join(' · ')}{' '}
              — segera lakukan restok agar strategi upselling tetap optimal.
            </p>
          </div>
        </div>
      )}

      {/* Management Tabs */}
      <section
        id="operasional-manajemen"
        className="bg-white border border-stone-200 rounded-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4 bg-stone-50/70">
          <div className="flex flex-wrap items-center gap-1.5 p-1 bg-stone-200/70 rounded-xl">
            <button
              type="button"
              onClick={() => setActiveTab('margin')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'margin'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <TrendingUp className="w-4 h-4" />
              <span>HPP &amp; Margin</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sales')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'sales'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <ClipboardList className="w-4 h-4" />
              <span>Rekap Penjualan</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('stock')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'stock'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <Package className="w-4 h-4" />
              <span>Kontrol Stok</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('sop')}
              className={`px-3.5 py-2 text-xs sm:text-sm font-medium rounded-lg inline-flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                activeTab === 'sop'
                  ? 'bg-white text-zinc-900 shadow-sm'
                  : 'text-zinc-600 hover:text-zinc-900'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              <span>SOP Dapur</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => void fetchOverview()}
            className="px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-zinc-700 hover:bg-stone-50 inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Segarkan Data</span>
          </button>
        </div>

        <div className="p-6">
          {/* TAB 1: HPP & MARGIN MATRIX */}
          {activeTab === 'margin' && (
            <div className="space-y-8">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-zinc-900">
                    Matriks HPP, Harga Jual &amp; Margin Aktual
                  </h3>
                  <p className="text-sm text-zinc-600 mt-0.5">
                    Prioritaskan upselling pada Keju Parut (60,0%), Pop Corn Original (60,0%), dan Kentang Goreng (laba Rp 6.500/porsi).
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setCategoryFilter(cat)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                        categoryFilter === cat
                          ? 'bg-zinc-900 text-white'
                          : 'bg-stone-100 text-zinc-700 hover:bg-stone-200'
                      }`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>

              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-zinc-600">
                      <th className="py-3 px-4">Nama Menu</th>
                      <th className="py-3 px-4">Kategori</th>
                      <th className="py-3 px-4 text-right">HPP</th>
                      <th className="py-3 px-4 text-right">Harga Jual</th>
                      <th className="py-3 px-4 text-right">Laba Kotor</th>
                      <th className="py-3 px-4 text-right">Margin %</th>
                      <th className="py-3 px-4">Catatan Strategis</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-sm">
                    {filteredFinance.map((row) => {
                      const isStarMargin =
                        row.marginPercent !== null && row.marginPercent >= 60;
                      const isHighNominal = row.menuId === 'cemilan-kentang-goreng';

                      return (
                        <tr
                          key={row.menuId}
                          className="hover:bg-stone-50/80 transition-colors"
                        >
                          <td className="py-3 px-4 font-medium text-zinc-900">
                            {row.name}
                          </td>
                          <td className="py-3 px-4 text-zinc-600 text-xs">
                            {row.category}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-700">
                            {row.hpp !== null ? formatRupiah(row.hpp) : 'Belum diinput'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-900 font-medium">
                            {row.sellingPrice !== null
                              ? formatRupiah(row.sellingPrice)
                              : 'Kasir'}
                          </td>
                          <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                            {row.grossProfit !== null
                              ? formatRupiah(row.grossProfit)
                              : '—'}
                          </td>
                          <td
                            className={`py-3 px-4 text-right font-mono tabular-nums font-semibold ${
                              isStarMargin
                                ? 'text-emerald-700'
                                : 'text-zinc-900'
                            }`}
                          >
                            {row.marginPercent !== null
                              ? formatPercent(row.marginPercent)
                              : '—'}
                          </td>
                          <td className="py-3 px-4 text-xs">
                            {row.highlightNote ? (
                              <span
                                className={
                                  isStarMargin || isHighNominal
                                    ? 'font-semibold text-emerald-700'
                                    : 'text-zinc-500'
                                }
                              >
                                {row.highlightNote}
                              </span>
                            ) : (
                              <span className="text-zinc-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Interactive Profit Bundling Simulator */}
              {bundleResult && (
                <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 space-y-4">
                  <div>
                    <h4 className="font-display text-base font-bold text-zinc-900">
                      Simulator Bundling Berbasis Margin
                    </h4>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      Uji kombinasi Mie + Topping + Cemilan untuk melihat total laba kotor per paket.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <select
                      aria-label="Pilih Mie Utama"
                      value={bundleMieId}
                      onChange={(e) => setBundleMieId(e.target.value)}
                      className="min-h-[40px] px-3 py-2 text-sm rounded-lg border border-stone-300 bg-white text-zinc-900"
                    >
                      {data.finance.breakdown
                        .filter((b) => b.category === 'Mie Lioner')
                        .map((b) => (
                          <option key={b.menuId} value={b.menuId}>
                            {b.name}
                          </option>
                        ))}
                    </select>

                    <select
                      aria-label="Pilih Topping"
                      value={bundleToppingId}
                      onChange={(e) => setBundleToppingId(e.target.value)}
                      className="min-h-[40px] px-3 py-2 text-sm rounded-lg border border-stone-300 bg-white text-zinc-900"
                    >
                      {data.finance.breakdown
                        .filter((b) => b.category === 'Topping Mie')
                        .map((b) => (
                          <option key={b.menuId} value={b.menuId}>
                            {b.name} ({b.marginPercent !== null ? formatPercent(b.marginPercent) : '-'})
                          </option>
                        ))}
                    </select>

                    <select
                      aria-label="Pilih Cemilan Dayang"
                      value={bundleSnackId}
                      onChange={(e) => setBundleSnackId(e.target.value)}
                      className="min-h-[40px] px-3 py-2 text-sm rounded-lg border border-stone-300 bg-white text-zinc-900"
                    >
                      {data.finance.breakdown
                        .filter((b) => b.category === 'Cemilan Dayang')
                        .map((b) => (
                          <option key={b.menuId} value={b.menuId}>
                            {b.name} ({b.marginPercent !== null ? formatPercent(b.marginPercent) : '-'})
                          </option>
                        ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-stone-200 text-sm">
                    <div>
                      <span className="text-xs text-zinc-500 block">Total HPP Paket</span>
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        {formatRupiah(bundleResult.totalHpp)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500 block">Total Harga Jual</span>
                      <span className="font-mono tabular-nums font-semibold text-zinc-900">
                        {formatRupiah(bundleResult.totalSell)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500 block">Laba Kotor Paket</span>
                      <span className="font-mono tabular-nums font-bold text-emerald-700">
                        {formatRupiah(bundleResult.totalProfit)}
                      </span>
                    </div>
                    <div>
                      <span className="text-xs text-zinc-500 block">Margin Paket</span>
                      <span className="font-mono tabular-nums font-bold text-emerald-700">
                        {formatPercent(bundleResult.margin)}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* TAB 2: DAILY SALES RECAP */}
          {activeTab === 'sales' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div>
                  <h3 className="font-display text-lg font-bold text-zinc-900">
                    Kalkulator Rekap Penjualan &amp; Laba Harian
                  </h3>
                  <p className="text-sm text-zinc-600 mt-0.5">
                    Masukkan jumlah porsi terjual hari ini untuk menghitung Omzet Kotor, HPP Terpakai, dan Laba Kotor otomatis.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const zeroed: Record<string, number> = {};
                      for (const key of Object.keys(draftPortions)) {
                        zeroed[key] = 0;
                      }
                      setDraftPortions(zeroed);
                      void handleSaveSales(zeroed);
                    }}
                    className="px-3.5 py-2 rounded-lg border border-stone-300 bg-white text-xs font-semibold text-zinc-700 hover:bg-stone-50 cursor-pointer"
                  >
                    Reset ke 0
                  </button>
                  <button
                    type="button"
                    disabled={isSavingSales}
                    onClick={() => void handleSaveSales(draftPortions)}
                    className="px-4 py-2 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 disabled:opacity-50 cursor-pointer"
                  >
                    {isSavingSales ? 'Menyimpan...' : 'Simpan & Hitung Ulang'}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onRequestAiAnalysis(
                        `Lakukan analisis penjualan shift hari ini berdasarkan data rekap terbaru: Omzet Kotor ${formatRupiah(
                          data.finance.totalGrossRevenue
                        )}, Total HPP Terpakai ${formatRupiah(
                          data.finance.totalHppUsed
                        )}, Total Laba Kotor ${formatRupiah(
                          data.finance.totalGrossProfit
                        )}. Berikan rekomendasi efisiensi dan target upselling besok.`
                      )
                    }
                    className="px-4 py-2 rounded-lg bg-orange-600 text-white text-xs font-semibold hover:bg-orange-700 cursor-pointer"
                  >
                    Minta Analisis AI
                  </button>
                </div>
              </div>

              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-zinc-600">
                      <th className="py-3 px-4">Item Menu / Kemasan</th>
                      <th className="py-3 px-4 text-right">Porsi Terjual</th>
                      <th className="py-3 px-4 text-right">Omzet Kotor</th>
                      <th className="py-3 px-4 text-right">HPP Terpakai</th>
                      <th className="py-3 px-4 text-right">Laba Kotor</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-sm">
                    {data.finance.breakdown
                      .filter((b) => b.sellingPrice !== null)
                      .map((row) => {
                        const qty = draftPortions[row.menuId] ?? row.qty;
                        const rev = (row.sellingPrice ?? 0) * qty;
                        const hppUsed = row.hpp !== null ? row.hpp * qty : null;
                        const profit =
                          hppUsed !== null ? rev - hppUsed : null;

                        return (
                          <tr key={row.menuId} className="hover:bg-stone-50/70">
                            <td className="py-2.5 px-4">
                              <span className="font-medium text-zinc-900">
                                {row.name}
                              </span>
                              <span className="block text-xs text-zinc-500">
                                {row.category}
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-right">
                              <input
                                type="number"
                                min={0}
                                max={5000}
                                value={qty}
                                onChange={(e) => {
                                  const val = Math.max(
                                    0,
                                    Math.floor(Number(e.target.value) || 0)
                                  );
                                  setDraftPortions((prev) => ({
                                    ...prev,
                                    [row.menuId]: val,
                                  }));
                                }}
                                className="w-20 text-right font-mono tabular-nums px-2.5 py-1.5 rounded-lg border border-stone-300 bg-white text-zinc-900 text-sm focus:outline-none focus:border-orange-600"
                              />
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-900">
                              {formatRupiah(rev)}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums text-zinc-600">
                              {hppUsed !== null
                                ? formatRupiah(hppUsed)
                                : 'HPP belum diinput'}
                            </td>
                            <td className="py-2.5 px-4 text-right font-mono tabular-nums font-semibold text-emerald-700">
                              {profit !== null ? formatRupiah(profit) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: STOCK MONITOR */}
          {activeTab === 'stock' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-bold text-zinc-900">
                  Kontrol Stok &amp; Pemakaian Bahan Kritis
                </h3>
                <p className="text-sm text-zinc-600 mt-0.5">
                  Pemakaian bahan baku dihitung otomatis dari porsi Single/Double, topping, camilan, dan kemasan packing terjual.
                </p>
              </div>

              <div className="overflow-x-auto border border-stone-200 rounded-xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-stone-50 border-b border-stone-200 text-xs font-semibold text-zinc-600">
                      <th className="py-3 px-4">Bahan Baku</th>
                      <th className="py-3 px-4 text-right">Stok Awal</th>
                      <th className="py-3 px-4 text-right">Terpakai</th>
                      <th className="py-3 px-4 text-right">Sisa Stok</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Penyesuaian / Restok</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 text-sm">
                    {data.ingredients.map((ing) => (
                      <tr key={ing.id} className="hover:bg-stone-50/70">
                        <td className="py-3 px-4">
                          <span className="font-medium text-zinc-900">
                            {ing.name}
                          </span>
                          <span className="block text-xs text-zinc-500 mt-0.5">
                            {ing.priorityNote}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-600">
                          {ing.openingStock} {ing.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums text-zinc-700">
                          {ing.used} {ing.unit}
                        </td>
                        <td className="py-3 px-4 text-right font-mono tabular-nums font-bold text-zinc-900">
                          {ing.remaining} {ing.unit}
                        </td>
                        <td className="py-3 px-4">
                          {ing.status === 'Aman' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              <span>Aman</span>
                            </span>
                          )}
                          {ing.status === 'Menipis' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Menipis (Restok)</span>
                            </span>
                          )}
                          {ing.status === 'Kritis' && (
                            <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-700">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              <span>Kritis</span>
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => void handleStockAdjust(ing.id, -5)}
                              className="px-2.5 py-1 rounded-md border border-stone-300 bg-white text-xs font-medium text-zinc-700 hover:bg-stone-100 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Minus className="w-3 h-3" />
                              <span>5</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleStockAdjust(ing.id, 10)}
                              className="px-2.5 py-1 rounded-md bg-zinc-900 text-white text-xs font-medium hover:bg-zinc-800 inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>10</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: KITCHEN SOPS */}
          {activeTab === 'sop' && (
            <div id="sop-manajemen" className="space-y-6">
              <div>
                <h3 className="font-display text-lg font-bold text-zinc-900">
                  Standar Operasional Prosedur (SOP) Dapur
                </h3>
                <p className="text-sm text-zinc-600 mt-0.5">
                  Panduan gramasi, durasi penggorengan, dan takaran bumbu agar kualitas rasa seragam dan HPP terjaga.
                </p>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                {data.sops.map((sop, index) => (
                  <article
                    key={sop.id}
                    className="border border-stone-200 rounded-xl p-5 bg-stone-50/50 space-y-3"
                  >
                    <p className="text-xs font-medium text-zinc-500">
                      0{index + 1}. Standar Dapur · {sop.target}
                    </p>
                    <h4 className="font-display text-base font-bold text-zinc-900">
                      {sop.title}
                    </h4>
                    <ul className="space-y-2.5 text-sm text-zinc-700 leading-relaxed pt-1">
                      {sop.steps.map((step, sIdx) => (
                        <li key={sIdx} className="flex items-start gap-2">
                          <span className="font-mono text-xs font-semibold text-orange-700 mt-1">
                            {sIdx + 1}.
                          </span>
                          <span>{step}</span>
                        </li>
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
