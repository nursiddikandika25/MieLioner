import { useState, useRef, useEffect, type FormEvent } from 'react';
import { Send, Bot, User, Loader2, AlertCircle } from 'lucide-react';
import type { AppMode } from '../data/menuCatalog';

export interface ChatMessage {
  id: string;
  role: 'user' | 'model';
  text: string;
  modeAtTime: AppMode;
}

interface AssistantPanelProps {
  mode: AppMode;
  cartSummaryText: string;
  externalPromptTrigger?: { text: string; nonce: number } | null;
  onModeSwitch: (newMode: AppMode) => void;
}

const CUSTOMER_PROMPTS = [
  'Rekomendasi Mie Hot Maks + topping & minumannya',
  'Hitung 2 Mie Hot Maks Single + Keju Leleh dibungkus',
  'Menu Cemilan Dayang apa saja yang cocok buat rame-rame?',
  'Harga Milo dan Kopi Hitam berapa ya?',
];

const MANAGEMENT_PROMPTS = [
  'Strategi upselling menu dengan margin tertinggi',
  'Analisis omzet, HPP, dan laba kotor hari ini',
  'Cek status stok bahan kritis terutama keju dan popcorn',
  'Buatkan ringkasan SOP bumbu Hot Maks & penggorengan',
];

function renderFormattedText(text: string) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed">
      {lines.map((rawLine, idx) => {
        const line = rawLine.trim();
        if (!line) return <div key={idx} className="h-1" />;

        // Render bold segments (**text**) safely without raw HTML
        const renderInline = (content: string) => {
          const parts = content.split(/(\*\*[^*]+\*\*)/g);
          return parts.map((part, pIdx) => {
            if (part.startsWith('**') && part.endsWith('**')) {
              return (
                <strong key={pIdx} className="font-semibold text-zinc-900">
                  {part.slice(2, -2)}
                </strong>
              );
            }
            return <span key={pIdx}>{part}</span>;
          });
        };

        if (line.startsWith('- ') || line.startsWith('* ')) {
          return (
            <div key={idx} className="flex items-start gap-2 pl-1">
              <span aria-hidden="true" className="text-orange-600 font-bold mt-0.5">
                •
              </span>
              <span className="flex-1">{renderInline(line.slice(2))}</span>
            </div>
          );
        }

        return <p key={idx}>{renderInline(line)}</p>;
      })}
    </div>
  );
}

export function AssistantPanel({
  mode,
  cartSummaryText,
  externalPromptTrigger,
  onModeSwitch,
}: AssistantPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'model',
      modeAtTime: 'customer',
      text: 'Halo Kak, selamat datang di MieLioner! Mau pesan Mie Polos yang gurih atau tantangan pedas Hot Maks hari ini? Silakan tanya menu, kombinasi topping, atau estimasi total pesanannya ya. (Untuk pengelola: ketik "MODE MANAJEMEN" kapan saja untuk analisis HPP, stok, dan SOP.)',
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || isLoading) return;

    setErrorMsg(null);
    const userMsg: ChatMessage = {
      id: `u-${Date.now()}`,
      role: 'user',
      text: trimmed,
      modeAtTime: mode,
    };

    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          mode,
          cartSummary: mode === 'customer' ? cartSummaryText : undefined,
          history: messages.slice(-8).map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Gagal mendapatkan respons asisten.');
      }

      const returnedMode: AppMode =
        data.activeMode === 'management' ? 'management' : 'customer';

      if (data.modeSwitched && returnedMode !== mode) {
        onModeSwitch(returnedMode);
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `m-${Date.now()}`,
          role: 'model',
          text: data.reply,
          modeAtTime: returnedMode,
        },
      ]);
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : 'Terjadi gangguan koneksi ke server.';
      setErrorMsg(msg);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (externalPromptTrigger && externalPromptTrigger.text) {
      void sendMessage(externalPromptTrigger.text);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalPromptTrigger?.nonce]);

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    void sendMessage(input);
  };

  const quickPrompts =
    mode === 'customer' ? CUSTOMER_PROMPTS : MANAGEMENT_PROMPTS;

  return (
    <section
      id="asisten"
      className="bg-white border border-stone-200 rounded-2xl overflow-hidden"
    >
      <div className="px-6 py-5 border-b border-stone-200 flex flex-wrap items-center justify-between gap-4 bg-stone-50/70">
        <div>
          <h2 className="font-display text-lg font-bold text-zinc-900">
            {mode === 'customer'
              ? 'Asisten Virtual MieLioner'
              : 'Asisten Manajer Operasional'}
          </h2>
          <p className="text-sm text-zinc-600 mt-0.5">
            {mode === 'customer'
              ? 'Tanya rekomendasi menu, racikan topping, atau hitung total Dine-in & Takeaway. Ketik "MODE MANAJEMEN" untuk akses internal.'
              : 'Analisis profit HPP, rekap penjualan shift, stok bahan kritis, dan standar SOP dapur.'}
          </p>
        </div>

        <div className="text-xs font-medium text-zinc-500">
          {mode === 'customer'
            ? 'Mode Pelanggan · Harga Publik'
            : 'Mode Manajemen · Data HPP & SOP Aktif'}
        </div>
      </div>

      <div className="p-6 space-y-5">
        <div
          ref={scrollRef}
          className="h-96 overflow-y-auto pr-2 space-y-4 scroll-smooth"
        >
          {messages.map((msg) => {
            const isUser = msg.role === 'user';
            return (
              <div
                key={msg.id}
                className={`flex items-start gap-3 ${
                  isUser ? 'flex-row-reverse' : ''
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border ${
                    isUser
                      ? 'bg-zinc-900 text-white border-zinc-900'
                      : 'bg-orange-50 text-orange-700 border-orange-200'
                  }`}
                >
                  {isUser ? (
                    <User className="w-4 h-4" />
                  ) : (
                    <Bot className="w-4 h-4" />
                  )}
                </div>

                <div
                  className={`max-w-[82%] rounded-xl px-4 py-3 ${
                    isUser
                      ? 'bg-zinc-900 text-white'
                      : 'bg-stone-50 text-zinc-800 border border-stone-200'
                  }`}
                >
                  {isUser ? (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  ) : (
                    renderFormattedText(msg.text)
                  )}
                </div>
              </div>
            );
          })}

          {isLoading && (
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 bg-orange-50 text-orange-700 border border-orange-200">
                <Bot className="w-4 h-4" />
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-xl px-4 py-3 flex items-center gap-2 text-sm text-zinc-600">
                <Loader2 className="w-4 h-4 animate-spin text-orange-600" />
                <span>Menyiapkan jawaban...</span>
              </div>
            </div>
          )}
        </div>

        {errorMsg && (
          <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-red-800 text-sm">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {quickPrompts.map((prompt) => (
            <button
              key={prompt}
              type="button"
              disabled={isLoading}
              onClick={() => void sendMessage(prompt)}
              className="text-left text-xs font-medium px-3 py-2 rounded-lg border border-stone-200 bg-stone-50 text-zinc-700 hover:bg-stone-100 hover:text-zinc-900 transition-colors cursor-pointer disabled:opacity-50"
            >
              {prompt}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex items-center gap-3">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              mode === 'customer'
                ? 'Tulis pesanan atau pertanyaan Kakak di sini...'
                : 'Tanyakan analisis margin, rekap porsi, stok, atau SOP...'
            }
            disabled={isLoading}
            className="flex-1 min-h-[44px] px-4 py-2.5 text-sm rounded-xl border border-stone-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
          />
          <button
            type="submit"
            disabled={isLoading || !input.trim()}
            className="min-h-[44px] px-5 py-2.5 rounded-xl bg-orange-600 text-white text-sm font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>Kirim</span>
          </button>
        </form>
      </div>
    </section>
  );
}
