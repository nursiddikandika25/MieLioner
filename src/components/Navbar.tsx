import type { AppMode } from '../data/menuCatalog';

interface NavbarProps {
  mode: AppMode;
  cartCount: number;
  onPrimaryAction: () => void;
}

export function Navbar({ mode, cartCount, onPrimaryAction }: NavbarProps) {
  const navLinks =
    mode === 'customer'
      ? [
          { href: '#restoran-virtual', label: 'Restoran Virtual' },
          { href: '#menu', label: 'Daftar Menu' },
          { href: '#pesanan', label: 'Pesanan' },
          { href: '#asisten', label: 'Asisten' },
        ]
      : [
          { href: '#restoran-virtual', label: 'Restoran Virtual' },
          { href: '#ringkasan-manajemen', label: 'Ringkasan' },
          { href: '#operasional-manajemen', label: 'Data & Stok' },
          { href: '#asisten', label: 'Asisten Bisnis' },
        ];

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-stone-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        <a
          href="#top"
          className="font-display text-xl font-extrabold tracking-tight text-zinc-900 whitespace-nowrap shrink-0"
        >
          MieLioner
        </a>

        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-zinc-600">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hover:text-zinc-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="shrink-0">
          <button
            type="button"
            onClick={onPrimaryAction}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-orange-600 ${
              mode === 'customer'
                ? 'bg-orange-600 text-white hover:bg-orange-700'
                : 'bg-zinc-900 text-white hover:bg-zinc-800'
            }`}
          >
            {mode === 'customer'
              ? `Pesanan (${cartCount})`
              : 'Mode Pelanggan'}
          </button>
        </div>
      </div>
    </header>
  );
}
