import { useMemo, useState } from 'react';
import { Check, Copy, Download, QrCode } from 'lucide-react';
import type { OrderRecord, OrderStatus } from '../data/menuCatalog';
import { formatRupiah } from '../utils/formatters';

// Standard Code 39 character table: 9 elements (Bar, Space, Bar, Space, Bar, Space, Bar, Space, Bar)
// 'n' = narrow (1 unit), 'w' = wide (3 units)
const CODE39_PATTERNS: Record<string, string> = {
  '0': 'nnnwwnwnn',
  '1': 'wnnwnnnnw',
  '2': 'nnwwnnnnw',
  '3': 'wnwwnnnnn',
  '4': 'nnnwwnnnw',
  '5': 'wnnwwnnnn',
  '6': 'nnwwwnnnn',
  '7': 'nnnwnnwnw',
  '8': 'wnnwnnwnn',
  '9': 'nnwwnnwnn',
  A: 'wnnnnwnnw',
  B: 'nnwnnwnnw',
  C: 'wnwnnwnnn',
  D: 'nnnnwwnnw',
  E: 'wnnnwwnnn',
  F: 'nnwnwwnnn',
  G: 'nnnnnwwnw',
  H: 'wnnnnwwnn',
  I: 'nnwnnwwnn',
  J: 'nnnnwwwnn',
  K: 'wnnnnnnww',
  L: 'nnwnnnnww',
  M: 'wnwnnnnwn',
  N: 'nnnnwnnww',
  O: 'wnnnwnnwn',
  P: 'nnwnwnnwn',
  Q: 'nnnnnnwww',
  R: 'wnnnnnwwn',
  S: 'nnwnnnwwn',
  T: 'nnnnwnwwn',
  U: 'wwnnnnnnw',
  V: 'nwwnnnnnw',
  W: 'wwwnnnnnn',
  X: 'nwnnwnnnw',
  Y: 'wwnnwnnnn',
  Z: 'nwwnwnnnn',
  '-': 'nwnnnnwnw',
  '.': 'wwnnnnwnn',
  ' ': 'nwwnnnwnn',
  $: 'nwnwnwnnn',
  '/': 'nwnwnnnwn',
  '+': 'nwnnnwnwn',
  '%': 'nnnwnwnwn',
  '*': 'nwnnwnwnn',
};

export interface BarcodeBar {
  x: number;
  width: number;
}

export function encodeCode39Bars(rawCode: string): {
  bars: BarcodeBar[];
  totalWidth: number;
} {
  const sanitized = rawCode
    .toUpperCase()
    .replace(/[^A-Z0-9\-. $/+%]/g, '');
  const full = `*${sanitized || 'ML101'}*`;

  const narrow = 2;
  const wide = 5;
  const interCharGap = 2;
  const quietZone = 16;

  const bars: BarcodeBar[] = [];
  let cursor = quietZone;

  for (let i = 0; i < full.length; i++) {
    const ch = full[i];
    const pattern = CODE39_PATTERNS[ch] || CODE39_PATTERNS['-'];
    for (let j = 0; j < 9; j++) {
      const w = pattern[j] === 'w' ? wide : narrow;
      const isBar = j % 2 === 0;
      if (isBar) {
        bars.push({ x: cursor, width: w });
      }
      cursor += w;
    }
    if (i < full.length - 1) {
      cursor += interCharGap;
    }
  }

  return {
    bars,
    totalWidth: cursor + quietZone,
  };
}

export function getStatusTextClass(status: OrderStatus): string {
  switch (status) {
    case 'Menunggu Diproses':
      return 'text-amber-800 bg-amber-50 border-amber-200';
    case 'Sedang Dimasak':
      return 'text-orange-800 bg-orange-50 border-orange-200';
    case 'Siap Disajikan':
      return 'text-sky-800 bg-sky-50 border-sky-200';
    case 'Selesai':
      return 'text-emerald-800 bg-emerald-50 border-emerald-200';
  }
}

export function BarcodeGraphic({
  code,
  height = 56,
}: {
  code: string;
  height?: number;
}) {
  const { bars, totalWidth } = useMemo(() => encodeCode39Bars(code), [code]);

  return (
    <div className="bg-white border border-stone-200 rounded-xl px-3 py-2.5 flex flex-col items-center">
      <svg
        viewBox={`0 0 ${totalWidth} ${height}`}
        className="w-full max-w-[290px] h-14 block"
        role="img"
        aria-label={`Kode barcode pesanan ${code}`}
      >
        <rect x={0} y={0} width={totalWidth} height={height} fill="#ffffff" />
        {bars.map((bar, idx) => (
          <rect
            key={idx}
            x={bar.x}
            y={4}
            width={bar.width}
            height={height - 8}
            fill="#18181b"
          />
        ))}
      </svg>
      <span className="font-mono tabular-nums text-xs font-bold tracking-[0.16em] text-zinc-900 mt-1">
        {code}
      </span>
    </div>
  );
}

export function BarcodeTicketCard({
  order,
  compact = false,
}: {
  order: OrderRecord;
  compact?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(order.barcodeCode);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard blocked in restricted context
    }
  };

  const handleDownloadPng = () => {
    const canvas = document.createElement('canvas');
    const width = 560;
    const itemLines = order.items.length + (order.packingFee > 0 ? 1 : 0);
    const height = 390 + itemLines * 26;
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#d6d3d1';
    ctx.lineWidth = 2;
    ctx.strokeRect(12, 12, width - 24, height - 24);

    ctx.fillStyle = '#18181b';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText('MIELIONER · TIKET PESANAN', 32, 52);

    ctx.fillStyle = '#52525b';
    ctx.font = '14px sans-serif';
    const timeStr = new Date(order.createdAt).toLocaleString('id-ID', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
    ctx.fillText(
      `Order #${order.id} · ${
        order.orderType === 'takeaway' ? 'Dibungkus (Takeaway)' : 'Makan di Tempat'
      }`,
      32,
      78
    );
    ctx.fillText(`Waktu: ${timeStr} · Status: ${order.status}`, 32, 98);
    if (order.customerName || order.tableZone) {
      ctx.fillText(
        `Pemesan: ${order.customerName || 'Pelanggan'} · ${
          order.tableZone || 'Area Kedai'
        }`,
        32,
        118
      );
    }

    ctx.strokeStyle = '#e7e5e4';
    ctx.beginPath();
    ctx.moveTo(32, 134);
    ctx.lineTo(width - 32, 134);
    ctx.stroke();

    let y = 160;
    ctx.fillStyle = '#18181b';
    ctx.font = '15px sans-serif';
    order.items.forEach((it) => {
      ctx.fillText(`${it.quantity}x ${it.name}`, 32, y);
      const priceStr =
        it.unitPrice !== null ? formatRupiah(it.subtotal) : 'Konfirmasi kasir';
      const tw = ctx.measureText(priceStr).width;
      ctx.fillText(priceStr, width - 32 - tw, y);
      y += 26;
    });

    if (order.packingFee > 0) {
      ctx.fillText('Biaya Packing (Takeaway)', 32, y);
      const packStr = formatRupiah(order.packingFee);
      ctx.fillText(packStr, width - 32 - ctx.measureText(packStr).width, y);
      y += 26;
    }

    ctx.strokeStyle = '#18181b';
    ctx.beginPath();
    ctx.moveTo(32, y);
    ctx.lineTo(width - 32, y);
    ctx.stroke();
    y += 30;

    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('TOTAL PESANAN', 32, y);
    const totalStr = formatRupiah(order.totalAmount);
    ctx.fillText(totalStr, width - 32 - ctx.measureText(totalStr).width, y);
    y += 30;

    // Render Code 39 barcode centered
    const { bars, totalWidth } = encodeCode39Bars(order.barcodeCode);
    const availW = width - 80;
    const scale = Math.min(1.6, availW / totalWidth);
    const offsetX = (width - totalWidth * scale) / 2;
    ctx.fillStyle = '#18181b';
    bars.forEach((bar) => {
      ctx.fillRect(
        offsetX + bar.x * scale,
        y,
        Math.max(1, bar.width * scale),
        64
      );
    });

    ctx.font = 'bold 16px monospace';
    const codeW = ctx.measureText(order.barcodeCode).width;
    ctx.fillText(order.barcodeCode, (width - codeW) / 2, y + 88);

    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `tiket-mielioner-${order.id}.png`;
    a.click();
  };

  return (
    <div
      className={`bg-emerald-50/80 border border-emerald-200 rounded-xl ${
        compact ? 'p-3.5' : 'p-4'
      } space-y-3`}
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5 text-emerald-900 font-semibold text-sm">
            <QrCode className="w-4 h-4 text-emerald-700 shrink-0" />
            <span>Tiket Pesanan #{order.id}</span>
          </div>
          <p className="text-xs text-emerald-900/90 mt-0.5">
            {order.customerName ? `${order.customerName} · ` : ''}
            {order.orderType === 'takeaway'
              ? 'Dibungkus (Takeaway)'
              : order.tableZone || 'Makan di Tempat (Dine-in)'}
          </p>
        </div>

        <span
          className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold shrink-0 ${getStatusTextClass(
            order.status
          )}`}
        >
          {order.status}
        </span>
      </div>

      {/* Scannable Barcode */}
      <BarcodeGraphic code={order.barcodeCode} />

      <div className="space-y-1 text-xs text-zinc-800 bg-white/80 border border-emerald-200/70 rounded-lg p-3">
        <ul className="space-y-1">
          {order.items.map((it) => (
            <li key={it.menuId} className="flex items-center justify-between gap-2">
              <span className="truncate">
                • {it.quantity}x {it.name}
              </span>
              <span className="font-mono tabular-nums shrink-0">
                {it.unitPrice !== null ? formatRupiah(it.subtotal) : 'Kasir'}
              </span>
            </li>
          ))}
          {order.packingFee > 0 && (
            <li className="flex items-center justify-between gap-2 text-zinc-700">
              <span>• Biaya Packing (Takeaway)</span>
              <span className="font-mono tabular-nums shrink-0">
                {formatRupiah(order.packingFee)}
              </span>
            </li>
          )}
        </ul>

        {order.customerNote && (
          <p className="pt-1 text-[11px] text-zinc-600 border-t border-stone-200">
            Catatan: {order.customerNote}
          </p>
        )}

        <div className="pt-1.5 border-t border-stone-200 flex items-center justify-between font-bold text-zinc-900">
          <span>Total Pesanan</span>
          <span className="font-mono tabular-nums">
            {formatRupiah(order.totalAmount)}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => void handleCopy()}
          className="flex-1 min-h-[36px] px-3 py-1.5 rounded-lg border border-emerald-300 bg-white text-emerald-900 text-xs font-semibold hover:bg-emerald-100/60 inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-emerald-700" />
              <span>Kode Disalin</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5" />
              <span>Salin Barcode</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleDownloadPng}
          className="flex-1 min-h-[36px] px-3 py-1.5 rounded-lg bg-zinc-900 text-white text-xs font-semibold hover:bg-zinc-800 inline-flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Unduh Tiket (.png)</span>
        </button>
      </div>
    </div>
  );
}
