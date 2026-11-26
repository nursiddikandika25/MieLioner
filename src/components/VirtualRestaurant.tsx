import { useState, useEffect, useCallback, type FormEvent } from 'react';
import {
  Briefcase,
  Receipt,
  ChefHat,
  Coffee,
  UtensilsCrossed,
  Boxes,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Users,
  MessageSquareText,
  Volume2,
  Square,
} from 'lucide-react';
import type { AppMode } from '../data/menuCatalog';
import {
  AI_STAFF_PROFILES,
  type AiStaffProfile,
  type StaffId,
} from '../data/restaurantStaff';
import {
  RestaurantSimulator3D,
  type ConversationMessage,
  type ExternalSpeechEvent,
  type IncomingOrderSimEvent,
  type StaffCommandSimEvent,
} from './RestaurantSimulator3D';
import {
  fetchLiveDialogue,
  fetchSingleSpeakerTts,
  voicePlayer,
  type DialogueScenario,
  type VoiceSpeakerId,
} from '../three/voicePlayer';

interface StaffExecutionLog {
  id: string;
  staffId: StaffId | 'all-team';
  staffName: string;
  role: string;
  instruction: string;
  output: string;
  executedAt: string;
}

interface VirtualRestaurantProps {
  mode: AppMode;
  refreshSignal: number;
  incomingOrderEvent?: IncomingOrderSimEvent | null;
}

const DIALOGUE_SCENARIOS: Array<{
  id: DialogueScenario;
  label: string;
}> = [
  { id: 'random', label: 'Acak (Semua Tim)' },
  { id: 'order_kasir', label: 'Kasir Sinta ↔ Pengunjung' },
  { id: 'kitchen_prep', label: 'Kasir ↔ Chef Dimas' },
  { id: 'snack_bar_sync', label: 'Bar Nadia ↔ Bima' },
  { id: 'table_service', label: 'Bima ↔ Tamu Meja' },
  { id: 'warehouse_sync', label: 'Raka ↔ Gudang Tania' },
];

const INITIAL_CONVERSATIONS: ConversationMessage[] = [
  {
    id: 'init-1',
    speakerId: 'sinta-kasir',
    speakerName: 'Sinta Maharani',
    speakerRole: 'Kasir & Frontliner',
    text: 'Selamat datang di MieLioner, Kak! Mau pesan Mie Polos atau Hot Maks hari ini?',
    timestamp: new Date().toISOString(),
    source: 'sim',
  },
  {
    id: 'init-2',
    speakerId: 'dimas-chef',
    speakerName: 'Chef Dimas Wijaya',
    speakerRole: 'Koki Mie & Hot Maks',
    text: 'Wajan dapur panas merata, siap masak pesanan Mie Single maupun Double sesuai SOP!',
    timestamp: new Date().toISOString(),
    source: 'sim',
  },
  {
    id: 'init-3',
    speakerId: 'nadia-snack-bar',
    speakerName: 'Nadia Putri',
    speakerRole: 'Bar & Cemilan Dayang',
    text: "Kentang Goreng 200 gram, Pop Corn, dan Te' Manis dingin siap menemani pesanan Kakak!",
    timestamp: new Date().toISOString(),
    source: 'sim',
  },
];

function getStaffIcon(id: StaffId) {
  switch (id) {
    case 'raka-manager':
      return Briefcase;
    case 'sinta-kasir':
      return Receipt;
    case 'dimas-chef':
      return ChefHat;
    case 'nadia-snack-bar':
      return Coffee;
    case 'bima-server':
      return UtensilsCrossed;
    case 'tania-inventory':
      return Boxes;
  }
}

function renderTaskOutput(text: string) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-sm leading-relaxed text-zinc-800">
      {lines.map((raw, idx) => {
        const line = raw.trim();
        if (!line) return <div key={idx} className="h-1" />;

        const renderBold = (content: string) => {
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
              <span className="flex-1">{renderBold(line.slice(2))}</span>
            </div>
          );
        }

        return <p key={idx}>{renderBold(line)}</p>;
      })}
    </div>
  );
}

export function VirtualRestaurant({
  mode,
  refreshSignal,
  incomingOrderEvent,
}: VirtualRestaurantProps) {
  const [selectedStaffId, setSelectedStaffId] =
    useState<StaffId>('sinta-kasir');
  const [commandInput, setCommandInput] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [executingTarget, setExecutingTarget] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [logs, setLogs] = useState<StaffExecutionLog[]>([]);
  const [staffCommandEvent, setStaffCommandEvent] =
    useState<StaffCommandSimEvent | null>(null);

  const [conversations, setConversations] =
    useState<ConversationMessage[]>(INITIAL_CONVERSATIONS);
  const [externalSpeechEvent, setExternalSpeechEvent] =
    useState<ExternalSpeechEvent | null>(null);
  const [isDialogueLoading, setIsDialogueLoading] = useState(false);
  const [dialogueError, setDialogueError] = useState<string | null>(null);
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [isVoicePlaying, setIsVoicePlaying] = useState(false);

  useEffect(() => {
    const unsub = voicePlayer.subscribePlaying(setIsVoicePlaying);
    return () => {
      unsub();
    };
  }, []);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/staff/status');
      if (!res.ok) return;
      const json = (await res.json()) as { logs?: StaffExecutionLog[] };
      if (Array.isArray(json.logs) && json.logs.length > 0) {
        setLogs(json.logs);
      }
    } catch {
      // Keep current logs silently if network check skips
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
  }, [fetchStatus, refreshSignal]);

  const handleConversationMessage = useCallback((msg: ConversationMessage) => {
    setConversations((prev) => [msg, ...prev].slice(0, 24));
  }, []);

  const handleTriggerLiveDialogue = useCallback(
    async (scenario: DialogueScenario = 'random') => {
      if (isDialogueLoading) return;
      setIsDialogueLoading(true);
      setDialogueError(null);

      try {
        const res = await fetchLiveDialogue({ scenario, mode });
        const nowIso = new Date().toISOString();

        const formattedMsgs: ConversationMessage[] = res.lines.map((ln, idx) => ({
          id: `voice-${Date.now()}-${idx}`,
          speakerId: ln.speakerId,
          speakerName: ln.speakerName,
          speakerRole: ln.speakerRole,
          text: ln.text,
          timestamp: nowIso,
          source: 'ai-voice',
        }));

        // Display most recent at top while keeping turn flow readable
        setConversations((prev) =>
          [...formattedMsgs.slice().reverse(), ...prev].slice(0, 24)
        );

        // Animate 3D characters and sequential speech bubbles in viewport
        setExternalSpeechEvent({
          nonce: Date.now(),
          lines: res.lines.map((ln) => ({
            speakerId: ln.speakerId,
            speakerName: ln.speakerName,
            text: ln.text,
            durationSec: 3.8,
          })),
        });

        // Play crystal-clear multi-speaker Gemini TTS WAV audio immediately
        voicePlayer.enqueueWav(res.audioBase64, { interrupt: true });
      } catch (err: unknown) {
        setDialogueError(
          err instanceof Error
            ? err.message
            : 'Gagal memutar percakapan suara restoran.'
        );
      } finally {
        setIsDialogueLoading(false);
      }
    },
    [isDialogueLoading, mode]
  );

  const handleSpeakSingle = async (
    itemId: string,
    text: string,
    speakerId: VoiceSpeakerId
  ) => {
    setSpeakingId(itemId);
    setDialogueError(null);
    try {
      const res = await fetchSingleSpeakerTts({ text, speakerId });
      voicePlayer.enqueueWav(res.audioBase64, {
        interrupt: true,
        onEnd: () => setSpeakingId((curr) => (curr === itemId ? null : curr)),
      });
    } catch (err: unknown) {
      setDialogueError(
        err instanceof Error
          ? err.message
          : 'Gagal memutar suara karakter.'
      );
      setSpeakingId(null);
    }
  };

  const selectedStaff: AiStaffProfile =
    AI_STAFF_PROFILES.find((s) => s.id === selectedStaffId) ||
    AI_STAFF_PROFILES[0];

  const executeStaffCommand = async (
    targetId: StaffId | 'all-team',
    instructionText: string
  ) => {
    const trimmed = instructionText.trim();
    if (!trimmed || isExecuting) return;

    setIsExecuting(true);
    setExecutingTarget(targetId);
    setErrorMsg(null);
    setStaffCommandEvent({ nonce: Date.now(), staffId: targetId });

    try {
      const res = await fetch('/api/staff/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          staffId: targetId,
          instruction: trimmed,
          mode,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Gagal menjalankan tugas karyawan AI.');
      }

      const newLog = json.log as StaffExecutionLog;
      setLogs((prev) => [newLog, ...prev]);
      if (targetId !== 'all-team') {
        setCommandInput('');
      }

      // Show brief summary speech bubble over the assigned 3D staff
      const shortSpoken = newLog.output
        .replace(/\*\*([^*]+)\*\*/g, '$1')
        .split(/[.!?\n]/)[0]
        ?.trim()
        .slice(0, 120);
      if (shortSpoken) {
        setExternalSpeechEvent({
          nonce: Date.now(),
          lines: [
            {
              speakerId: targetId === 'all-team' ? 'raka-manager' : targetId,
              speakerName: newLog.staffName,
              text: shortSpoken,
              durationSec: 4.5,
            },
          ],
        });
      }
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : 'Terjadi kesalahan saat memerintah karyawan AI.'
      );
    } finally {
      setIsExecuting(false);
      setExecutingTarget(null);
    }
  };

  const handleFormSubmit = (e: FormEvent) => {
    e.preventDefault();
    void executeStaffCommand(selectedStaffId, commandInput);
  };

  const SelectedStaffIcon = getStaffIcon(selectedStaff.id);
  const selectedStaffLogs = logs.filter(
    (l) => l.staffId === selectedStaffId || l.staffId === 'all-team'
  );

  return (
    <section
      id="restoran-virtual"
      className="bg-white border border-stone-200 rounded-2xl overflow-hidden"
    >
      {/* Section Header */}
      <div className="px-6 py-5 border-b border-stone-200 bg-stone-50/70 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-display text-xl font-bold text-zinc-900">
            Simulator Restoran Virtual 3D &amp; Karyawan AI MieLioner
          </h2>
          <p className="text-sm text-zinc-600 mt-0.5">
            Pantau pergerakan 6 karyawan 3D dan pengunjung yang saling berinteraksi secara langsung. Aktifkan suara atau putar dialog untuk mendengar komunikasi mereka.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isVoicePlaying && (
            <button
              type="button"
              onClick={() => {
                voicePlayer.stopAll();
                setSpeakingId(null);
              }}
              className="px-3.5 py-2 rounded-xl bg-red-600 text-white text-xs sm:text-sm font-semibold hover:bg-red-700 transition-colors inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
            >
              <Square className="w-3.5 h-3.5" />
              <span>Hentikan Suara</span>
            </button>
          )}

          <button
            type="button"
            disabled={isExecuting}
            onClick={() =>
              void executeStaffCommand(
                'all-team',
                'Lakukan briefing operasional singkat seluruh tim MieLioner: laporkan kesiapan kasir, antrean dapur Hot Maks, produksi Cemilan Dayang, pengantaran meja, serta status stok bahan.'
              )
            }
            className="px-4 py-2 rounded-xl bg-zinc-900 text-white text-xs sm:text-sm font-semibold hover:bg-zinc-800 transition-colors inline-flex items-center gap-2 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
          >
            <Users className="w-4 h-4" />
            <span>Briefing Seluruh Tim</span>
          </button>
        </div>
      </div>

      <div className="p-6 space-y-8">
        {/* Full-Width Unobstructed 3D Animated Restaurant Simulator */}
        <RestaurantSimulator3D
          mode={mode}
          selectedStaffId={selectedStaffId}
          onSelectStaff={(id) => setSelectedStaffId(id)}
          incomingOrderEvent={incomingOrderEvent}
          staffCommandEvent={staffCommandEvent}
          externalSpeechEvent={externalSpeechEvent}
          onConversationMessage={handleConversationMessage}
          onTriggerLiveDialogue={(s) => void handleTriggerLiveDialogue(s)}
          isDialogueLoading={isDialogueLoading}
        />

        {/* Live Restaurant Conversations & Multi-Speaker Voice Communication Hub */}
        <div className="border border-stone-200 rounded-xl bg-stone-50/70 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-200 bg-white flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="font-display text-base font-bold text-zinc-900 flex items-center gap-2">
                <MessageSquareText className="w-4 h-4 text-orange-600" />
                <span>Percakapan Langsung Karyawan &amp; Pengunjung (Voice AI)</span>
              </h3>
              <p className="text-xs text-zinc-600 mt-0.5">
                Klik skenario di kanan untuk memicu percakapan suara dua arah langsung antar karakter 3D di restoran.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {DIALOGUE_SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  type="button"
                  disabled={isDialogueLoading}
                  onClick={() => void handleTriggerLiveDialogue(sc.id)}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-200 bg-stone-50 hover:bg-orange-50 hover:border-orange-500 text-zinc-800 text-xs font-medium transition-colors inline-flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  {isDialogueLoading ? (
                    <Loader2 className="w-3 h-3 animate-spin text-orange-600" />
                  ) : (
                    <Volume2 className="w-3 h-3 text-orange-600" />
                  )}
                  <span>{sc.label}</span>
                </button>
              ))}
            </div>
          </div>

          {dialogueError && (
            <div className="mx-5 mt-3 flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{dialogueError}</span>
            </div>
          )}

          <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[290px] overflow-y-auto">
            {conversations.map((msg) => {
              const isVisitor = msg.speakerId.startsWith('visitor');
              const isReading = speakingId === msg.id;

              return (
                <article
                  key={msg.id}
                  className={`p-3.5 rounded-xl border flex flex-col justify-between gap-2.5 ${
                    isVisitor
                      ? 'bg-amber-50/70 border-amber-200'
                      : 'bg-white border-stone-200'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-zinc-900 truncate">
                          {msg.speakerName}
                        </p>
                        <p className="text-[11px] text-zinc-500 truncate">
                          {msg.speakerRole}
                        </p>
                      </div>
                      <time className="font-mono tabular-nums text-[10px] text-zinc-400 shrink-0">
                        {new Date(msg.timestamp).toLocaleTimeString('id-ID', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                        })}
                      </time>
                    </div>

                    <p className="text-xs text-zinc-800 leading-relaxed">
                      “{msg.text}”
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-1.5 border-t border-stone-100">
                    <span className="text-[10px] font-medium text-zinc-500">
                      {msg.source === 'ai-voice' ? 'Dialog Voice AI' : 'Interaksi Kedai'}
                    </span>
                    <button
                      type="button"
                      disabled={isReading}
                      onClick={() =>
                        void handleSpeakSingle(msg.id, msg.text, msg.speakerId)
                      }
                      className="px-2 py-1 rounded-lg bg-stone-100 hover:bg-orange-100 text-zinc-800 hover:text-orange-800 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-60 cursor-pointer"
                    >
                      {isReading ? (
                        <Loader2 className="w-3 h-3 animate-spin text-orange-600" />
                      ) : (
                        <Volume2 className="w-3 h-3 text-orange-600" />
                      )}
                      <span>{isReading ? 'Memuat...' : 'Dengar'}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>

        {/* Staff Roster & Jobdesk Execution Console Below 3D Viewport */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left: 6 AI Employees Roster */}
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-zinc-900">
                Tim Karyawan 3D MieLioner (6 Personel Aktif)
              </h3>
              <span className="text-xs text-zinc-500">
                Klik kartu atau karakter 3D di atas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {AI_STAFF_PROFILES.map((staff) => {
                const Icon = getStaffIcon(staff.id);
                const isSelected = staff.id === selectedStaffId;
                const isBusy = isExecuting && executingTarget === staff.id;
                const hasCompletedLog = logs.some((l) => l.staffId === staff.id);

                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => setSelectedStaffId(staff.id)}
                    className={`text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'border-orange-600 bg-orange-50/50'
                        : 'border-stone-200 bg-white hover:bg-stone-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div
                        className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border ${
                          isSelected
                            ? 'bg-orange-600 text-white border-orange-600'
                            : 'bg-stone-100 text-zinc-700 border-stone-200'
                        }`}
                      >
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className="font-display text-sm font-bold text-zinc-900 truncate">
                          {staff.name}
                        </p>
                        <p className="text-xs text-zinc-600 truncate">
                          {staff.role}
                        </p>
                      </div>
                    </div>

                    <p className="text-xs text-zinc-600 mt-2.5 line-clamp-2 leading-relaxed">
                      {staff.summary}
                    </p>

                    <div className="mt-3 pt-2.5 border-t border-stone-100 flex items-center justify-between gap-2 text-xs">
                      <span className="text-zinc-500 truncate">
                        {staff.zoneName}
                      </span>
                      <span
                        className={`font-medium shrink-0 ${
                          isBusy
                            ? 'text-orange-700'
                            : hasCompletedLog
                            ? 'text-emerald-700'
                            : 'text-zinc-600'
                        }`}
                      >
                        {isBusy
                          ? 'Menjalankan...'
                          : hasCompletedLog
                          ? 'Tugas Selesai'
                          : 'Siap Bertugas'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Right: Command Console & Execution Log */}
          <div className="lg:col-span-5 space-y-5">
            <div className="border border-stone-200 rounded-xl p-5 bg-stone-50/60 space-y-4">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-zinc-900 text-white flex items-center justify-center shrink-0">
                  <SelectedStaffIcon className="w-5 h-5" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium text-zinc-500">
                    {selectedStaff.department} · {selectedStaff.zoneName}
                  </p>
                  <h3 className="font-display text-lg font-bold text-zinc-900">
                    {selectedStaff.name}
                  </h3>
                  <p className="text-xs font-medium text-orange-700">
                    {selectedStaff.role}
                  </p>
                </div>
              </div>

              <div className="pt-3 border-t border-stone-200 space-y-2">
                <p className="text-xs font-semibold text-zinc-700">
                  Jobdesk Profesional:
                </p>
                <ul className="space-y-1.5 text-xs text-zinc-700 leading-relaxed">
                  {selectedStaff.jobdeskPoints.map((pt, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-orange-600 font-bold">•</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-3 border-t border-stone-200 space-y-2">
                <p className="text-xs font-semibold text-zinc-700">
                  Perintahkan Tugas Cepat:
                </p>
                <div className="flex flex-col gap-2">
                  {selectedStaff.quickCommands.map((cmd) => (
                    <button
                      key={cmd}
                      type="button"
                      disabled={isExecuting}
                      onClick={() =>
                        void executeStaffCommand(selectedStaff.id, cmd)
                      }
                      className="text-left text-xs font-medium px-3.5 py-2.5 rounded-lg border border-stone-200 bg-white text-zinc-800 hover:border-orange-500 hover:bg-orange-50/40 transition-colors disabled:opacity-50 cursor-pointer"
                    >
                      {cmd}
                    </button>
                  ))}
                </div>
              </div>

              <form
                onSubmit={handleFormSubmit}
                className="pt-3 border-t border-stone-200 space-y-2.5"
              >
                <label
                  htmlFor="staff-command-input"
                  className="block text-xs font-semibold text-zinc-700"
                >
                  Instruksi Khusus untuk {selectedStaff.name.split(' ')[0]}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="staff-command-input"
                    type="text"
                    value={commandInput}
                    onChange={(e) => setCommandInput(e.target.value)}
                    disabled={isExecuting}
                    placeholder="Contoh: Siapkan 2 Hot Maks untuk meja Booth..."
                    className="flex-1 min-h-[42px] px-3.5 py-2 text-xs sm:text-sm rounded-xl border border-stone-300 bg-white text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-orange-600/20 focus:border-orange-600"
                  />
                  <button
                    type="submit"
                    disabled={isExecuting || !commandInput.trim()}
                    className="min-h-[42px] px-4 py-2 rounded-xl bg-orange-600 text-white text-xs sm:text-sm font-semibold hover:bg-orange-700 transition-colors disabled:opacity-50 inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {isExecuting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>Tugaskan</span>
                  </button>
                </div>
              </form>

              {errorMsg && (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}
            </div>

            {/* Execution Log Feed */}
            <div className="border border-stone-200 rounded-xl bg-white overflow-hidden">
              <div className="px-4 py-3 border-b border-stone-200 bg-stone-50 flex items-center justify-between">
                <h4 className="font-display text-sm font-bold text-zinc-900">
                  Laporan Eksekusi Karyawan AI
                </h4>
                <span className="font-mono tabular-nums text-xs text-zinc-500">
                  {logs.length} Tugas
                </span>
              </div>

              <div className="max-h-[380px] overflow-y-auto divide-y divide-stone-100">
                {isExecuting && (
                  <div className="p-4 flex items-center gap-2.5 text-sm text-zinc-600 bg-orange-50/40">
                    <Loader2 className="w-4 h-4 animate-spin text-orange-600 shrink-0" />
                    <span>
                      {executingTarget === 'all-team'
                        ? 'Seluruh tim MieLioner sedang menyusun briefing...'
                        : `${selectedStaff.name} sedang menjalankan tugas...`}
                    </span>
                  </div>
                )}

                {selectedStaffLogs.length === 0 && !isExecuting ? (
                  <div className="p-6 text-center text-xs text-zinc-500">
                    Belum ada tugas dijalankan untuk {selectedStaff.name}. Klik salah satu tombol perintah cepat atau tulis instruksi khusus di atas.
                  </div>
                ) : (
                  selectedStaffLogs.map((log) => {
                    const isReadingLog = speakingId === log.id;
                    return (
                      <article key={log.id} className="p-4 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-semibold text-zinc-900 flex items-center gap-1.5">
                              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                              <span>{log.staffName}</span>
                            </p>
                            <p className="text-xs text-zinc-500">{log.role}</p>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={isReadingLog}
                              onClick={() =>
                                void handleSpeakSingle(
                                  log.id,
                                  log.output,
                                  log.staffId
                                )
                              }
                              className="px-2 py-1 rounded-lg border border-stone-200 bg-stone-50 hover:bg-orange-50 hover:border-orange-400 text-zinc-700 hover:text-orange-800 text-[11px] font-semibold inline-flex items-center gap-1 transition-colors disabled:opacity-60 cursor-pointer"
                            >
                              {isReadingLog ? (
                                <Loader2 className="w-3 h-3 animate-spin text-orange-600" />
                              ) : (
                                <Volume2 className="w-3 h-3 text-orange-600" />
                              )}
                              <span>{isReadingLog ? 'Suara...' : 'Bacakan'}</span>
                            </button>
                            <time className="font-mono tabular-nums text-[11px] text-zinc-400">
                              {new Date(log.executedAt).toLocaleTimeString(
                                'id-ID',
                                {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                }
                              )}
                            </time>
                          </div>
                        </div>

                        <p className="text-xs font-medium text-zinc-700 bg-stone-50 border border-stone-200 rounded-lg px-3 py-2">
                          Perintah: {log.instruction}
                        </p>

                        <div className="pt-1">{renderTaskOutput(log.output)}</div>
                      </article>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
